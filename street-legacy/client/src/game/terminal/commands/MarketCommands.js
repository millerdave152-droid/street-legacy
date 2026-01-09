/**
 * MarketCommands - Terminal commands for the player marketplace
 *
 * Commands:
 * - market: Browse market listings
 * - market list: Create a new listing
 * - market buy: Purchase a listing
 * - market cancel: Cancel your listing
 * - market my: View your listings
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'

// Listing type display info
const LISTING_TYPES = {
  item: { icon: '[I]', name: 'Item', color: 'handler' },
  service: { icon: '[S]', name: 'Service', color: 'success' },
  favor: { icon: '[F]', name: 'Favor', color: 'warning' },
  intel: { icon: '[?]', name: 'Intel', color: 'sarah' }
}

/**
 * Format money with commas
 */
function formatMoney(amount) {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return `$${amount.toLocaleString()}`
}

/**
 * Format time remaining
 */
function formatTimeRemaining(ms) {
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Register market commands
 */
export function registerMarketCommands() {
  // ============================================================
  // MARKET command - Browse/manage market
  // ============================================================
  commandRegistry.register({
    name: 'market',
    aliases: ['marketplace', 'shop', 'bazaar'],
    handler: async ({ args }) => {
      // Handle subcommands
      if (args.length > 0) {
        const subcommand = args[0].toLowerCase()

        switch (subcommand) {
          case 'list':
          case 'sell':
          case 'create':
            return handleCreateListing(args.slice(1))

          case 'buy':
          case 'purchase':
            return handleBuyListing(args.slice(1))

          case 'cancel':
          case 'remove':
            return handleCancelListing(args.slice(1))

          case 'my':
          case 'mine':
          case 'listings':
            return handleMyListings()

          case 'stats':
            return handleMarketStats()

          case 'item':
          case 'service':
          case 'favor':
          case 'intel':
            return handleBrowseByType(subcommand)

          default:
            // Try to find listing by ID or search term
            if (args[0].length > 8) {
              return handleViewListing(args[0])
            }
            return handleSearch(args.join(' '))
        }
      }

      // Default: show market overview
      return showMarketOverview()
    },
    help: 'Browse the player marketplace',
    usage: 'market [list|buy|cancel|my|stats|<type>|<search>]',
    examples: [
      'market',
      'market item',
      'market list item 5000 "Stolen Pistol"',
      'market buy <listing_id>',
      'market my'
    ],
    category: CATEGORIES.ECONOMY,
    minLevel: 3,
  })

  console.log('[MarketCommands] Registered market commands')
}

/**
 * Show market overview with stats and recent listings
 */
async function showMarketOverview() {
  const output = [
    { text: '╔══════════════════════════════════════════╗', type: 'system' },
    { text: '║         PLAYER MARKETPLACE               ║', type: 'system' },
    { text: '╚══════════════════════════════════════════╝', type: 'system' },
    { text: '', type: 'response' },
  ]

  try {
    // Get market stats
    const statsResponse = await fetch('/api/market/stats')
    const statsData = await statsResponse.json()

    if (statsData.success) {
      const stats = statsData.data
      output.push({ text: '  ─── MARKET STATS ───', type: 'system' })
      output.push({
        text: `  Active Listings: ${stats.activeListings}`,
        type: 'response'
      })
      output.push({
        text: `  24h Volume: ${formatMoney(stats.totalVolume24h)}`,
        type: 'success'
      })
      output.push({
        text: `  Avg Price: ${formatMoney(stats.avgPrice)}`,
        type: 'response'
      })
      output.push({ text: '', type: 'response' })
    }

    // Get recent listings
    const listingsResponse = await fetch('/api/market?limit=5')
    const listingsData = await listingsResponse.json()

    if (listingsData.success && listingsData.data.length > 0) {
      output.push({ text: '  ─── RECENT LISTINGS ───', type: 'system' })

      listingsData.data.forEach(listing => {
        const typeInfo = LISTING_TYPES[listing.listingType] || LISTING_TYPES.item
        output.push({
          text: `  ${typeInfo.icon} ${listing.title.substring(0, 25).padEnd(25)} ${formatMoney(listing.askingPrice)}`,
          type: typeInfo.color
        })
        output.push({
          text: `     by ${listing.sellerUsername} | ${formatTimeRemaining(listing.timeRemainingMs)} left`,
          type: 'response'
        })
      })
    } else {
      output.push({
        text: '  No active listings. Be the first to sell!',
        type: 'system'
      })
    }

    output.push({ text: '', type: 'response' })
    output.push({ text: '  ─── COMMANDS ───', type: 'system' })
    output.push({ text: '  market item/service/favor/intel - Browse by type', type: 'response' })
    output.push({ text: '  market list <type> <price> "<title>" - Create listing', type: 'response' })
    output.push({ text: '  market buy <id> - Purchase listing', type: 'response' })
    output.push({ text: '  market my - View your listings', type: 'response' })

  } catch (error) {
    output.push({
      text: '  [Market data unavailable - offline mode]',
      type: 'warning'
    })
    output.push({ text: '', type: 'response' })
    output.push({ text: '  Market requires server connection.', type: 'system' })
  }

  return { output }
}

/**
 * Browse listings by type
 */
async function handleBrowseByType(type) {
  const typeInfo = LISTING_TYPES[type] || LISTING_TYPES.item

  const output = [
    { text: `:: ${typeInfo.name.toUpperCase()} LISTINGS ::`, type: 'system' },
    { text: '', type: 'response' },
  ]

  try {
    const response = await fetch(`/api/market?type=${type}&limit=15`)
    const data = await response.json()

    if (!data.success) {
      return { error: true, message: data.error || 'Failed to load listings' }
    }

    if (data.data.length === 0) {
      output.push({
        text: `  No ${type} listings available.`,
        type: 'system'
      })
      output.push({ text: '', type: 'response' })
      output.push({
        text: `  Create one: market list ${type} <price> "<title>"`,
        type: 'response'
      })
      return { output }
    }

    data.data.forEach((listing, index) => {
      output.push({
        text: `  ${index + 1}. ${listing.title}`,
        type: typeInfo.color
      })
      output.push({
        text: `     ${formatMoney(listing.askingPrice)} | ${listing.sellerUsername} | ${formatTimeRemaining(listing.timeRemainingMs)}`,
        type: 'response'
      })
      output.push({
        text: `     ID: ${listing.id.substring(0, 8)}...`,
        type: 'system'
      })
      output.push({ text: '', type: 'response' })
    })

    output.push({ text: `  Use "market buy <id>" to purchase`, type: 'system' })

  } catch (error) {
    return { error: true, message: 'Failed to connect to market' }
  }

  return { output }
}

/**
 * Create a new listing
 */
async function handleCreateListing(args) {
  // Parse: list <type> <price> "<title>" [description]
  if (args.length < 3) {
    return {
      output: [
        { text: ':: CREATE LISTING ::', type: 'system' },
        { text: '', type: 'response' },
        { text: '  Usage: market list <type> <price> "<title>"', type: 'response' },
        { text: '', type: 'response' },
        { text: '  Types:', type: 'system' },
        { text: '    item    - Physical items (weapons, gear)', type: 'response' },
        { text: '    service - Help with heists, protection', type: 'response' },
        { text: '    favor   - One-time assistance, IOUs', type: 'response' },
        { text: '    intel   - Information, tips, secrets', type: 'response' },
        { text: '', type: 'response' },
        { text: '  Example: market list item 5000 "Stolen Pistol"', type: 'handler' },
        { text: '', type: 'response' },
        { text: '  Note: 5% listing fee is charged upfront.', type: 'warning' },
      ]
    }
  }

  const listingType = args[0].toLowerCase()
  const price = parseInt(args[1].replace(/[$,]/g, ''))

  if (!LISTING_TYPES[listingType]) {
    return { error: true, message: `Invalid type. Use: item, service, favor, intel` }
  }

  if (isNaN(price) || price <= 0) {
    return { error: true, message: 'Invalid price. Must be a positive number.' }
  }

  // Extract title from remaining args (handle quotes)
  const remainingText = args.slice(2).join(' ')
  const titleMatch = remainingText.match(/^["'](.+?)["']/) || [null, remainingText]
  const title = titleMatch[1] || remainingText

  if (!title || title.length < 3) {
    return { error: true, message: 'Title must be at least 3 characters.' }
  }

  const listingFee = Math.max(100, Math.round(price * 0.05))

  try {
    const response = await fetch('/api/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingType,
        title: title.substring(0, 100),
        askingPrice: price
      })
    })

    const data = await response.json()

    if (!data.success) {
      if (data.feeRequired) {
        return { error: true, message: `${data.error} (Fee: ${formatMoney(data.feeRequired)})` }
      }
      return { error: true, message: data.error || 'Failed to create listing' }
    }

    return {
      output: [
        { text: ':: LISTING CREATED ::', type: 'success' },
        { text: '', type: 'response' },
        { text: `  "${title}"`, type: 'handler' },
        { text: `  Price: ${formatMoney(price)}`, type: 'response' },
        { text: `  Fee Paid: ${formatMoney(data.data.feeCharged)}`, type: 'warning' },
        { text: '', type: 'response' },
        { text: `  Listing ID: ${data.data.listingId.substring(0, 8)}...`, type: 'system' },
        { text: '  Expires in 7 days.', type: 'system' },
      ]
    }

  } catch (error) {
    return { error: true, message: 'Failed to create listing' }
  }
}

/**
 * Purchase a listing
 */
async function handleBuyListing(args) {
  if (args.length === 0) {
    return { error: true, message: 'Usage: market buy <listing_id>' }
  }

  const listingId = args[0]

  try {
    // First get listing details
    const detailsResponse = await fetch(`/api/market/${listingId}`)
    const detailsData = await detailsResponse.json()

    if (!detailsData.success) {
      return { error: true, message: detailsData.error || 'Listing not found' }
    }

    const listing = detailsData.data
    const player = gameManager.player

    // Check if player can afford
    if (player && player.cash < listing.askingPrice) {
      return {
        error: true,
        message: `Not enough cash. Need ${formatMoney(listing.askingPrice)}, have ${formatMoney(player.cash)}`
      }
    }

    // Confirm purchase
    const response = await fetch(`/api/market/${listingId}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await response.json()

    if (!data.success) {
      return { error: true, message: data.error || 'Purchase failed' }
    }

    return {
      output: [
        { text: ':: PURCHASE COMPLETE ::', type: 'success' },
        { text: '', type: 'response' },
        { text: `  "${listing.title}"`, type: 'handler' },
        { text: `  Paid: ${formatMoney(data.data.amountPaid)}`, type: 'warning' },
        { text: '', type: 'response' },
        { text: `  Seller: ${listing.sellerUsername}`, type: 'response' },
        { text: '  Item has been added to your inventory.', type: 'system' },
      ]
    }

  } catch (error) {
    return { error: true, message: 'Failed to complete purchase' }
  }
}

/**
 * Cancel your listing
 */
async function handleCancelListing(args) {
  if (args.length === 0) {
    return { error: true, message: 'Usage: market cancel <listing_id>' }
  }

  const listingId = args[0]

  try {
    const response = await fetch(`/api/market/${listingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await response.json()

    if (!data.success) {
      return { error: true, message: data.error || 'Failed to cancel listing' }
    }

    return {
      output: [
        { text: ':: LISTING CANCELLED ::', type: 'warning' },
        { text: '', type: 'response' },
        { text: `  Refunded: ${formatMoney(data.data.refundAmount)} (50% of fee)`, type: 'success' },
      ]
    }

  } catch (error) {
    return { error: true, message: 'Failed to cancel listing' }
  }
}

/**
 * View your own listings
 */
async function handleMyListings() {
  const output = [
    { text: ':: YOUR LISTINGS ::', type: 'system' },
    { text: '', type: 'response' },
  ]

  try {
    const response = await fetch('/api/market/my-listings')
    const data = await response.json()

    if (!data.success) {
      return { error: true, message: data.error || 'Failed to load listings' }
    }

    if (data.data.length === 0) {
      output.push({
        text: '  You have no listings.',
        type: 'system'
      })
      output.push({ text: '', type: 'response' })
      output.push({
        text: '  Create one: market list <type> <price> "<title>"',
        type: 'response'
      })
      return { output }
    }

    data.data.forEach((listing, index) => {
      const typeInfo = LISTING_TYPES[listing.listingType] || LISTING_TYPES.item
      const statusColor = listing.status === 'active' ? 'success' :
        listing.status === 'sold' ? 'handler' : 'warning'

      output.push({
        text: `  ${index + 1}. ${typeInfo.icon} ${listing.title}`,
        type: typeInfo.color
      })
      output.push({
        text: `     ${formatMoney(listing.askingPrice)} | ${listing.status.toUpperCase()}`,
        type: statusColor
      })

      if (listing.offerCount > 0) {
        output.push({
          text: `     ${listing.offerCount} pending offer(s)!`,
          type: 'warning'
        })
      }

      output.push({
        text: `     ID: ${listing.id.substring(0, 8)}...`,
        type: 'system'
      })
      output.push({ text: '', type: 'response' })
    })

    output.push({ text: '  Use "market cancel <id>" to remove a listing', type: 'system' })

  } catch (error) {
    return { error: true, message: 'Failed to load your listings' }
  }

  return { output }
}

/**
 * View market stats
 */
async function handleMarketStats() {
  const output = [
    { text: ':: MARKET STATISTICS ::', type: 'system' },
    { text: '', type: 'response' },
  ]

  try {
    const response = await fetch('/api/market/stats')
    const data = await response.json()

    if (!data.success) {
      return { error: true, message: 'Failed to load stats' }
    }

    const stats = data.data

    output.push({ text: '  ─── OVERVIEW ───', type: 'system' })
    output.push({
      text: `  Active Listings: ${stats.activeListings}`,
      type: 'response'
    })
    output.push({
      text: `  24h Volume: ${formatMoney(stats.totalVolume24h)}`,
      type: 'success'
    })
    output.push({
      text: `  Average Price: ${formatMoney(stats.avgPrice)}`,
      type: 'response'
    })

    if (stats.listingsByType && Object.keys(stats.listingsByType).length > 0) {
      output.push({ text: '', type: 'response' })
      output.push({ text: '  ─── BY TYPE ───', type: 'system' })

      Object.entries(stats.listingsByType).forEach(([type, count]) => {
        const typeInfo = LISTING_TYPES[type] || { icon: '[?]', name: type }
        output.push({
          text: `  ${typeInfo.icon} ${typeInfo.name}: ${count} listings`,
          type: 'response'
        })
      })
    }

  } catch (error) {
    return { error: true, message: 'Failed to load market stats' }
  }

  return { output }
}

/**
 * View single listing details
 */
async function handleViewListing(listingId) {
  try {
    const response = await fetch(`/api/market/${listingId}`)
    const data = await response.json()

    if (!data.success) {
      return { error: true, message: data.error || 'Listing not found' }
    }

    const listing = data.data
    const typeInfo = LISTING_TYPES[listing.listingType] || LISTING_TYPES.item

    const output = [
      { text: ':: LISTING DETAILS ::', type: 'system' },
      { text: '', type: 'response' },
      { text: `  ${typeInfo.icon} ${listing.title}`, type: typeInfo.color },
      { text: '', type: 'response' },
      { text: `  Price: ${formatMoney(listing.askingPrice)}`, type: 'success' },
      { text: `  Seller: ${listing.sellerUsername} (Lv.${listing.sellerLevel})`, type: 'response' },
      { text: `  Status: ${listing.status.toUpperCase()}`, type: 'handler' },
      { text: '', type: 'response' },
    ]

    if (listing.description) {
      output.push({ text: `  "${listing.description}"`, type: 'system' })
      output.push({ text: '', type: 'response' })
    }

    if (listing.status === 'active') {
      output.push({ text: `  To purchase: market buy ${listingId.substring(0, 8)}`, type: 'warning' })
    }

    return { output }

  } catch (error) {
    return { error: true, message: 'Failed to load listing' }
  }
}

/**
 * Search listings
 */
async function handleSearch(searchTerm) {
  const output = [
    { text: `:: SEARCH: "${searchTerm}" ::`, type: 'system' },
    { text: '', type: 'response' },
  ]

  try {
    const response = await fetch(`/api/market?search=${encodeURIComponent(searchTerm)}&limit=10`)
    const data = await response.json()

    if (!data.success) {
      return { error: true, message: 'Search failed' }
    }

    if (data.data.length === 0) {
      output.push({
        text: '  No listings found.',
        type: 'system'
      })
      return { output }
    }

    data.data.forEach((listing, index) => {
      const typeInfo = LISTING_TYPES[listing.listingType] || LISTING_TYPES.item
      output.push({
        text: `  ${index + 1}. ${typeInfo.icon} ${listing.title}`,
        type: typeInfo.color
      })
      output.push({
        text: `     ${formatMoney(listing.askingPrice)} | ${listing.sellerUsername}`,
        type: 'response'
      })
    })

  } catch (error) {
    return { error: true, message: 'Search failed' }
  }

  return { output }
}

export default registerMarketCommands
