/**
 * TradeSystem - Phase 30: Cross-Player Interactions (Trade)
 *
 * Trade functionality between players.
 *
 * Features:
 * - Propose via message
 * - Item/cash exchange
 * - Escrow system
 * - Trade history
 */

import { messageBroker } from './MessageBroker'
import { playerMessaging } from './PlayerMessaging'
import { MESSAGE_TYPES, MESSAGE_PRIORITY, createAction, ACTION_TYPES } from './MessageProtocol'

const STORAGE_KEY = 'trade_system_data'

// Trade states
export const TRADE_STATES = {
  PROPOSED: 'proposed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}

// Trade item types
export const TRADE_ITEM_TYPES = {
  CASH: 'cash',
  ITEM: 'item',
  INTEL: 'intel',
  TERRITORY: 'territory',
  SERVICE: 'service',
}

/**
 * TradeSystem class
 */
class TradeSystemClass {
  constructor() {
    this.activeTrades = new Map()
    this.tradeHistory = []
    this.listeners = []
    this.defaultExpiry = 300000  // 5 minutes
  }

  /**
   * Initialize trade system
   */
  initialize() {
    this.loadState()

    // Listen for trade-related messages
    messageBroker.subscribe((message) => {
      if (message.metadata?.type === 'trade_request') {
        this.handleTradeRequest(message)
      } else if (message.metadata?.type === 'trade_response') {
        this.handleTradeResponse(message)
      }
    })

    // Cleanup expired trades
    setInterval(() => this.cleanupExpired(), 60000)

    console.log('[TradeSystem] Initialized')
  }

  /**
   * Create a trade proposal
   */
  createTrade(recipientName, offering, requesting, options = {}) {
    const trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      initiator: messageBroker.player.getReference(),
      recipient: null,  // Will be set when found
      offering: this.normalizeItems(offering),
      requesting: this.normalizeItems(requesting),
      state: TRADE_STATES.PROPOSED,
      createdAt: Date.now(),
      expiresAt: Date.now() + (options.expiry || this.defaultExpiry),
      notes: options.notes || '',
      escrow: {
        initiatorDeposited: false,
        recipientDeposited: false,
      },
    }

    // Find recipient
    const recipient = playerMessaging.findPlayer(recipientName)
    if (!recipient) {
      return { success: false, error: 'Player not found' }
    }

    trade.recipient = {
      id: recipient.id,
      name: recipient.name,
      type: 'player',
    }

    // Store trade
    this.activeTrades.set(trade.id, trade)

    // Send trade message
    playerMessaging.sendMessage(recipientName, this.formatTradeMessage(trade), {
      metadata: {
        type: 'trade_request',
        tradeId: trade.id,
      },
      priority: MESSAGE_PRIORITY.NORMAL,
    })

    this.saveState()

    console.log(`[TradeSystem] Trade proposed: ${trade.id}`)

    return { success: true, trade }
  }

  /**
   * Normalize items to standard format
   */
  normalizeItems(items) {
    if (!items) return []
    if (!Array.isArray(items)) items = [items]

    return items.map(item => {
      if (typeof item === 'string') {
        // Parse "500 cash" or "item:weapon_knife"
        if (item.includes('cash')) {
          const amount = parseInt(item) || 0
          return { type: TRADE_ITEM_TYPES.CASH, amount }
        }
        return { type: TRADE_ITEM_TYPES.ITEM, itemId: item, quantity: 1 }
      }
      return item
    })
  }

  /**
   * Format trade message for display
   */
  formatTradeMessage(trade) {
    const offering = this.formatItems(trade.offering)
    const requesting = this.formatItems(trade.requesting)

    return `TRADE PROPOSAL\n` +
           `Offering: ${offering}\n` +
           `Requesting: ${requesting}\n` +
           `Expires: ${new Date(trade.expiresAt).toLocaleTimeString()}\n` +
           `Use: trade accept ${trade.id} or trade decline ${trade.id}`
  }

  /**
   * Format items for display
   */
  formatItems(items) {
    if (!items || items.length === 0) return 'Nothing'

    return items.map(item => {
      switch (item.type) {
        case TRADE_ITEM_TYPES.CASH:
          return `$${item.amount}`
        case TRADE_ITEM_TYPES.ITEM:
          return `${item.quantity || 1}x ${item.itemId || item.name || 'item'}`
        case TRADE_ITEM_TYPES.INTEL:
          return `Intel: ${item.description || 'classified'}`
        case TRADE_ITEM_TYPES.TERRITORY:
          return `Territory: ${item.territoryId || 'area'}`
        case TRADE_ITEM_TYPES.SERVICE:
          return `Service: ${item.description || 'favor'}`
        default:
          return JSON.stringify(item)
      }
    }).join(', ')
  }

  /**
   * Handle incoming trade request
   */
  handleTradeRequest(message) {
    const tradeId = message.metadata.tradeId

    // Store the trade if we don't have it (from other player)
    if (!this.activeTrades.has(tradeId)) {
      const trade = {
        id: tradeId,
        initiator: message.sender,
        recipient: messageBroker.player.getReference(),
        offering: message.metadata.offering || [],
        requesting: message.metadata.requesting || [],
        state: TRADE_STATES.PROPOSED,
        receivedAt: Date.now(),
        expiresAt: message.metadata.expiresAt || Date.now() + this.defaultExpiry,
      }

      this.activeTrades.set(tradeId, trade)
      this.saveState()
    }

    this.notifyListeners('trade_received', { tradeId, message })
  }

  /**
   * Handle trade response
   */
  handleTradeResponse(message) {
    const { tradeId, accepted } = message.metadata
    const trade = this.activeTrades.get(tradeId)

    if (!trade) return

    if (accepted) {
      trade.state = TRADE_STATES.ACCEPTED
      trade.acceptedAt = Date.now()
      this.notifyListeners('trade_accepted', { trade })
    } else {
      trade.state = TRADE_STATES.DECLINED
      trade.declinedAt = Date.now()
      this.notifyListeners('trade_declined', { trade })
    }

    this.saveState()
  }

  /**
   * Accept a trade
   */
  acceptTrade(tradeId) {
    const trade = this.activeTrades.get(tradeId)
    if (!trade) {
      return { success: false, error: 'Trade not found' }
    }

    if (trade.state !== TRADE_STATES.PROPOSED) {
      return { success: false, error: 'Trade is not pending' }
    }

    if (Date.now() > trade.expiresAt) {
      trade.state = TRADE_STATES.EXPIRED
      this.saveState()
      return { success: false, error: 'Trade expired' }
    }

    trade.state = TRADE_STATES.ACCEPTED
    trade.acceptedAt = Date.now()

    // Notify initiator
    playerMessaging.sendMessage(trade.initiator.name, `Trade accepted! Trade ID: ${tradeId}`, {
      metadata: {
        type: 'trade_response',
        tradeId,
        accepted: true,
      },
    })

    this.saveState()

    return { success: true, trade }
  }

  /**
   * Decline a trade
   */
  declineTrade(tradeId, reason = '') {
    const trade = this.activeTrades.get(tradeId)
    if (!trade) {
      return { success: false, error: 'Trade not found' }
    }

    trade.state = TRADE_STATES.DECLINED
    trade.declinedAt = Date.now()
    trade.declineReason = reason

    // Notify initiator
    playerMessaging.sendMessage(trade.initiator.name, `Trade declined.${reason ? ' Reason: ' + reason : ''}`, {
      metadata: {
        type: 'trade_response',
        tradeId,
        accepted: false,
        reason,
      },
    })

    this.saveState()

    return { success: true }
  }

  /**
   * Confirm trade (after both parties ready)
   */
  confirmTrade(tradeId) {
    const trade = this.activeTrades.get(tradeId)
    if (!trade) {
      return { success: false, error: 'Trade not found' }
    }

    if (trade.state !== TRADE_STATES.ACCEPTED) {
      return { success: false, error: 'Trade not accepted yet' }
    }

    trade.state = TRADE_STATES.CONFIRMED
    trade.confirmedAt = Date.now()

    this.saveState()

    return { success: true, trade }
  }

  /**
   * Complete trade (execute exchange)
   */
  completeTrade(tradeId) {
    const trade = this.activeTrades.get(tradeId)
    if (!trade) {
      return { success: false, error: 'Trade not found' }
    }

    if (trade.state !== TRADE_STATES.CONFIRMED) {
      return { success: false, error: 'Trade not confirmed' }
    }

    // Execute the exchange
    // In a real implementation, this would modify player inventories

    trade.state = TRADE_STATES.COMPLETED
    trade.completedAt = Date.now()

    // Move to history
    this.tradeHistory.push({
      ...trade,
      archivedAt: Date.now(),
    })

    // Remove from active
    this.activeTrades.delete(tradeId)

    this.saveState()

    this.notifyListeners('trade_completed', { trade })

    console.log(`[TradeSystem] Trade completed: ${tradeId}`)

    return { success: true, trade }
  }

  /**
   * Cancel a trade
   */
  cancelTrade(tradeId, reason = '') {
    const trade = this.activeTrades.get(tradeId)
    if (!trade) {
      return { success: false, error: 'Trade not found' }
    }

    if (trade.state === TRADE_STATES.COMPLETED) {
      return { success: false, error: 'Cannot cancel completed trade' }
    }

    trade.state = TRADE_STATES.CANCELLED
    trade.cancelledAt = Date.now()
    trade.cancelReason = reason

    // Notify other party
    const otherParty = trade.initiator.id === messageBroker.player.id
      ? trade.recipient
      : trade.initiator

    playerMessaging.sendMessage(otherParty.name, `Trade cancelled.${reason ? ' Reason: ' + reason : ''}`, {
      metadata: {
        type: 'trade_cancelled',
        tradeId,
        reason,
      },
    })

    this.saveState()

    return { success: true }
  }

  /**
   * Counter-offer
   */
  counterOffer(tradeId, newOffering, newRequesting) {
    const originalTrade = this.activeTrades.get(tradeId)
    if (!originalTrade) {
      return { success: false, error: 'Original trade not found' }
    }

    // Cancel original
    this.cancelTrade(tradeId, 'Counter-offer made')

    // Create new trade
    return this.createTrade(
      originalTrade.initiator.name,
      newOffering,
      newRequesting,
      { notes: `Counter-offer to ${tradeId}` }
    )
  }

  /**
   * Get active trades
   */
  getActiveTrades() {
    return Array.from(this.activeTrades.values())
      .filter(t => t.state === TRADE_STATES.PROPOSED || t.state === TRADE_STATES.ACCEPTED)
  }

  /**
   * Get trade by ID
   */
  getTrade(tradeId) {
    return this.activeTrades.get(tradeId)
  }

  /**
   * Get trade history
   */
  getHistory(limit = 50) {
    return this.tradeHistory.slice(-limit)
  }

  /**
   * Cleanup expired trades
   */
  cleanupExpired() {
    const now = Date.now()
    let cleaned = 0

    for (const [id, trade] of this.activeTrades) {
      if (trade.expiresAt && now > trade.expiresAt && trade.state === TRADE_STATES.PROPOSED) {
        trade.state = TRADE_STATES.EXPIRED
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.saveState()
      console.log(`[TradeSystem] Cleaned ${cleaned} expired trades`)
    }
  }

  /**
   * Format trade for terminal
   */
  formatTradeForTerminal(trade) {
    const lines = [
      `Trade ID: ${trade.id}`,
      `State: ${trade.state}`,
      `With: ${trade.initiator.id === messageBroker.player.id ? trade.recipient.name : trade.initiator.name}`,
      `Offering: ${this.formatItems(trade.offering)}`,
      `Requesting: ${this.formatItems(trade.requesting)}`,
      `Expires: ${new Date(trade.expiresAt).toLocaleString()}`,
    ]

    if (trade.state === TRADE_STATES.PROPOSED) {
      lines.push('')
      lines.push(`Commands: trade accept ${trade.id}, trade decline ${trade.id}`)
    }

    return lines.join('\n')
  }

  /**
   * Add listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      listener(event, data)
    }
  }

  /**
   * Save state
   */
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeTrades: Array.from(this.activeTrades.entries()),
        tradeHistory: this.tradeHistory.slice(-100),
      }))
    } catch (e) {
      console.warn('[TradeSystem] Failed to save:', e)
    }
  }

  /**
   * Load state
   */
  loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.activeTrades = new Map(data.activeTrades || [])
        this.tradeHistory = data.tradeHistory || []
      }
    } catch (e) {
      console.warn('[TradeSystem] Failed to load:', e)
    }
  }

  /**
   * Clear all
   */
  clear() {
    this.activeTrades.clear()
    this.tradeHistory = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const tradeSystem = new TradeSystemClass()
export default tradeSystem
