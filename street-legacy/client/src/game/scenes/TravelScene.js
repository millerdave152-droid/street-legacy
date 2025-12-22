import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { DISTRICTS, getPlayerData, savePlayerData, getDistrictHeat, getDistrictEffects } from '../data/GameData.js'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * TravelScene - Dedicated Travel Tab
 *
 * Features:
 * - Tab navigation: "Fast Travel" | "Flights" | "History"
 * - Travel costs based on distance
 * - Premium instant flights (expensive, no cooldown)
 * - Travel history and districts visited tracking
 */

// Travel costs by distance tier
const TRAVEL_COSTS = {
  adjacent: 0,        // Free for adjacent districts
  nearby: 50,         // 2 districts away
  far: 150,           // 3-4 districts away
  cross_city: 500,    // Opposite side of city
}

// Flight destinations (premium instant travel)
const FLIGHT_DESTINATIONS = [
  { id: 'airport', name: 'City Airport', icon: '✈️', cost: 1000, description: 'Instant travel anywhere' },
  { id: 'helipad', name: 'Executive Helipad', icon: '🚁', cost: 2500, description: 'VIP rooftop access' },
  { id: 'private', name: 'Private Airfield', icon: '🛩️', cost: 5000, description: 'Discrete, no questions asked' },
]

// Cooldown in milliseconds
const TRAVEL_COOLDOWN = 30000 // 30 seconds

export class TravelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TravelScene' })
  }

  async create() {
    console.log('[TravelScene] create() started')
    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
      }
    } catch (e) {}

    // Constants
    this.CARD_WIDTH = width - 40
    this.CARD_HEIGHT = 80
    this.CARD_PADDING = 8
    this.SCROLL_START_Y = 200
    this.SCROLL_END_Y = height - 60

    // State
    this.districts = []
    this.travelHistory = []
    this.contentItems = []
    this.scrollOffset = 0
    this.activeTab = 'ground'
    this.currentDistrict = null

    // Full screen opaque overlay
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(100)
      .setInteractive()

    // Grid pattern background
    this.createGridPattern()

    // Create UI
    this.createHeader()
    this.createCurrentLocationPanel()
    this.createTabs()
    this.createCloseButton()
    this.setupScrolling()

    // Cooldown display
    this.cooldownText = this.add.text(width / 2, height - 30, '', {
      fontSize: '12px',
      color: '#fbbf24'
    }).setOrigin(0.5).setDepth(110)

    // Load data
    await this.loadTravelData()

    // Update cooldown periodically
    this.time.addEvent({
      delay: 1000,
      callback: this.updateCooldown,
      callbackScope: this,
      loop: true
    })
  }

  createGridPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(100)

    graphics.lineStyle(1, 0x1a2530, 0.15)
    for (let x = 0; x < width; x += 30) {
      graphics.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 30) {
      graphics.lineBetween(0, y, width, y)
    }
  }

  createHeader() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Icon background - using purple accent for travel
    const iconBg = this.add.circle(width / 2, 32, 26, COLORS.bg.panel)
      .setStrokeStyle(2, 0x4f46e5, 0.5)
      .setDepth(101)

    this.add.text(width / 2, 32, '[M]', {
      ...getTerminalStyle('lg'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)

    // Title
    this.add.text(width / 2, 68, 'TRAVEL', {
      ...getTerminalStyle('lg'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)

    // Cash display
    const cardWidth = (width - 50) / 2
    const cashCardX = 20 + cardWidth / 2
    this.add.rectangle(cashCardX, 95, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.status.success, 0.4)
      .setDepth(101)

    this.cashText = this.add.text(cashCardX, 95, `${SYMBOLS.cash} ${formatMoney(player?.cash || 0)}`, {
      fontSize: '11px',
      color: toHexString(COLORS.status.success)
    }).setOrigin(0.5).setDepth(102)

    // Districts visited count
    const visitedCardX = width - 20 - cardWidth / 2
    this.add.rectangle(visitedCardX, 95, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, 0x4f46e5, 0.4)
      .setDepth(101)

    const visited = player.districtsVisited?.length || 1
    this.visitedText = this.add.text(visitedCardX, 95, `[M] ${visited} Visited`, {
      fontSize: '11px',
      color: '#4f46e5'
    }).setOrigin(0.5).setDepth(102)
  }

  createCurrentLocationPanel() {
    const { width } = this.cameras.main
    const panelY = 130
    const panelHeight = 45

    // Background
    this.add.rectangle(width / 2, panelY, width - 30, panelHeight, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x4f46e5, 0.5)
      .setDepth(101)

    // Label
    this.add.text(25, panelY - 12, `${SYMBOLS.system} CURRENT LOCATION`, {
      fontSize: '8px',
      color: '#4f46e5',
      fontStyle: 'bold'
    }).setDepth(102)

    // Location text (will be updated)
    this.locationText = this.add.text(25, panelY + 6, 'Loading...', {
      fontSize: '14px',
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setDepth(102)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 165
    const tabWidth = (width - 60) / 3
    const gap = 5

    this.tabs = {}

    // Ground Travel tab
    const groundX = 20 + tabWidth / 2
    this.tabs.ground = this.createTab(groundX, tabY, tabWidth, '[G] Ground', 'ground', true)

    // Flights tab
    const flightsX = 20 + tabWidth + gap + tabWidth / 2
    this.tabs.flights = this.createTab(flightsX, tabY, tabWidth, '[F] Flights', 'flights', false)

    // History tab
    const historyX = width - 20 - tabWidth / 2
    this.tabs.history = this.createTab(historyX, tabY, tabWidth, '[H] History', 'history', false)
  }

  createTab(x, y, tabWidth, label, tabKey, isActive) {
    const bgColor = isActive ? 0x3b82f6 : 0x1e293b

    const bg = this.add.rectangle(x, y, tabWidth, 28, bgColor, 0.95)
      .setStrokeStyle(1, isActive ? 0x60a5fa : 0x334155)
      .setInteractive({ useHandCursor: true })
      .setDepth(101)

    const text = this.add.text(x, y, label, {
      fontSize: '11px',
      color: isActive ? '#ffffff' : '#888888',
      fontStyle: isActive ? 'bold' : 'normal'
    }).setOrigin(0.5).setDepth(102)

    bg.on('pointerover', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(0x3a3a5a, 0.95)
        text.setColor('#ffffff')
      }
    })

    bg.on('pointerout', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(0x1e293b, 0.95)
        text.setColor('#888888')
      }
    })

    bg.on('pointerdown', () => {
      audioManager.playClick()
      this.switchTab(tabKey)
    })

    return { bg, text }
  }

  switchTab(tabKey) {
    if (this.activeTab === tabKey) return

    // Update old tab appearance
    const oldTab = this.tabs[this.activeTab]
    if (oldTab) {
      oldTab.bg.setFillStyle(0x1e293b, 0.95)
      oldTab.bg.setStrokeStyle(1, 0x334155)
      oldTab.text.setColor('#888888')
      oldTab.text.setFontStyle('normal')
    }

    // Update new tab appearance
    const newTab = this.tabs[tabKey]
    if (newTab) {
      newTab.bg.setFillStyle(0x3b82f6, 0.95)
      newTab.bg.setStrokeStyle(1, 0x60a5fa)
      newTab.text.setColor('#ffffff')
      newTab.text.setFontStyle('bold')
    }

    this.activeTab = tabKey
    this.scrollOffset = 0
    this.renderContent()
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ef4444')
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff')
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })
  }

  setupScrolling() {
    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown) {
        const dy = pointer.prevPosition.y - pointer.y
        this.scrollOffset += dy

        const maxScroll = Math.max(0, this.totalContentHeight - (this.SCROLL_END_Y - this.SCROLL_START_Y))
        this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, maxScroll)

        this.renderContent()
      }
    })

    // Mouse wheel support
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollOffset += deltaY * 0.5

      const maxScroll = Math.max(0, this.totalContentHeight - (this.SCROLL_END_Y - this.SCROLL_START_Y))
      this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, maxScroll)

      this.renderContent()
    })

    this.totalContentHeight = 0
  }

  async loadTravelData() {
    const player = gameManager.player || getPlayerData()
    const playerLevel = player.level || 1

    // Get current district
    this.currentDistrict = player.current_district_id || player.currentDistrict || 'downtown'

    // Load districts with travel info
    let districts = []
    try {
      districts = await gameManager.getDistricts()
    } catch (error) {
      console.log('[TravelScene] Using fallback districts')
    }

    // Fallback to local data
    if (!districts || districts.length === 0) {
      districts = DISTRICTS
    }

    // Calculate travel costs for each district
    this.districts = districts.map((d, index) => {
      const isCurrent = d.id === this.currentDistrict
      const isLocked = (d.min_level || 1) > playerLevel
      const distance = this.calculateDistance(this.currentDistrict, d.id, index)
      const cost = this.getTravelCost(distance)

      return {
        ...d,
        is_current: isCurrent,
        is_locked: isLocked,
        distance,
        travel_cost: cost,
        danger_level: d.danger_level || d.difficulty || 1,
      }
    })

    // Load travel history
    this.travelHistory = player.travelHistory || []

    // Update current location text
    const current = this.districts.find(d => d.is_current)
    this.locationText.setText(current?.name || 'Unknown')

    // Render content
    this.renderContent()
  }

  calculateDistance(fromId, toId, toIndex) {
    if (fromId === toId) return 'current'

    // Simple distance calculation based on index difference
    // In a real game, this would use actual map coordinates
    const fromIndex = this.districts.findIndex(d => d.id === fromId)
    const diff = Math.abs(fromIndex - toIndex)

    if (diff <= 1) return 'adjacent'
    if (diff <= 2) return 'nearby'
    if (diff <= 4) return 'far'
    return 'cross_city'
  }

  getTravelCost(distance) {
    return TRAVEL_COSTS[distance] || 0
  }

  updateCooldown() {
    const remaining = gameManager.getCooldownRemaining('travel')
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000)
      this.cooldownText.setText(`⏱️ Travel cooldown: ${seconds}s`)
      this.cooldownText.setAlpha(1)
    } else {
      this.cooldownText.setText('')
      this.cooldownText.setAlpha(0)
    }
  }

  renderContent() {
    // Clear previous content
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []

    switch (this.activeTab) {
      case 'ground':
        this.renderGroundTravel()
        break
      case 'flights':
        this.renderFlights()
        break
      case 'history':
        this.renderHistory()
        break
    }
  }

  renderGroundTravel() {
    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section header
    const header = this.add.text(25, y, `${SYMBOLS.system} GROUND TRAVEL`, {
      fontSize: '14px',
      color: '#4f46e5',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(header)
    y += 30

    // Sort: available first, then locked
    const sortedDistricts = [...this.districts].sort((a, b) => {
      if (a.is_current) return -1
      if (b.is_current) return 1
      if (a.is_locked && !b.is_locked) return 1
      if (!a.is_locked && b.is_locked) return -1
      return 0
    })

    sortedDistricts.forEach((district, index) => {
      if (y > this.SCROLL_START_Y - 100 && y < this.SCROLL_END_Y + 50) {
        this.renderDistrictCard(district, y)
      }
      y += this.CARD_HEIGHT + this.CARD_PADDING
    })

    this.totalContentHeight = y - this.SCROLL_START_Y + this.scrollOffset
  }

  renderDistrictCard(district, y) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const canAfford = (player.cash || 0) >= district.travel_cost
    const onCooldown = gameManager.isOnCooldown('travel')
    const canTravel = !district.is_current && !district.is_locked && canAfford && !onCooldown

    // Card background color based on status
    let bgColor = 0x1e293b
    let borderColor = 0x334155
    if (district.is_current) {
      bgColor = 0x1a3a2a
      borderColor = 0x22c55e
    } else if (district.is_locked) {
      bgColor = 0x1a1a2a
      borderColor = 0x4b5563
    } else if (!canAfford) {
      bgColor = 0x2a1a1a
      borderColor = 0xef4444
    }

    // Card
    const card = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2, this.CARD_WIDTH, this.CARD_HEIGHT - 5, bgColor, 0.95)
      .setStrokeStyle(1, borderColor)
      .setDepth(101)
    this.contentItems.push(card)

    if (canTravel) {
      card.setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(0x2a3a4a, 0.95)
        card.setStrokeStyle(2, 0x3b82f6)
      })

      card.on('pointerout', () => {
        card.setFillStyle(bgColor, 0.95)
        card.setStrokeStyle(1, borderColor)
      })

      card.on('pointerdown', () => {
        this.travelToDistrict(district)
      })
    }

    // District icon
    const icon = this.add.text(40, y + 25, district.icon || '🏙️', {
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(icon)

    // District name
    const nameColor = district.is_current ? '#22c55e' : district.is_locked ? '#666666' : '#ffffff'
    const name = this.add.text(65, y + 15, district.name, {
      fontSize: '14px',
      color: nameColor,
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(name)

    // Status text
    let statusText = ''
    let statusColor = '#888888'
    if (district.is_current) {
      statusText = '📍 Current Location'
      statusColor = '#22c55e'
    } else if (district.is_locked) {
      statusText = `🔒 Level ${district.min_level || 5} required`
      statusColor = '#666666'
    } else {
      statusText = `📏 ${district.distance === 'adjacent' ? 'Adjacent' : district.distance === 'nearby' ? 'Nearby' : 'Far'}`
    }

    const status = this.add.text(65, y + 35, statusText, {
      fontSize: '10px',
      color: statusColor
    }).setDepth(102)
    this.contentItems.push(status)

    // Danger level
    const dangerStars = '⚠️'.repeat(Math.min(5, district.danger_level || 1))
    const danger = this.add.text(65, y + 52, `Risk: ${dangerStars}`, {
      fontSize: '9px',
      color: '#f97316'
    }).setDepth(102)
    this.contentItems.push(danger)

    // District heat indicator
    const districtHeat = getDistrictHeat(player, district.id)
    if (districtHeat > 0) {
      const heatColor = districtHeat >= 75 ? '#ef4444' : districtHeat >= 50 ? '#f97316' : districtHeat >= 25 ? '#eab308' : '#22c55e'
      const heatLabel = districtHeat >= 75 ? 'HOT' : districtHeat >= 50 ? 'WARM' : districtHeat >= 25 ? 'COOL' : 'SAFE'

      const heatBg = this.add.rectangle(width - 140, y + 52, 50, 14,
        districtHeat >= 50 ? 0x7f1d1d : 0x1a1a2a, 0.8)
        .setStrokeStyle(1, districtHeat >= 50 ? 0xef4444 : 0x666666, 0.5)
        .setDepth(102)
      this.contentItems.push(heatBg)

      const heatText = this.add.text(width - 140, y + 52, `🔥 ${heatLabel}`, {
        fontSize: '8px',
        color: heatColor,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(heatText)
    }

    // Travel cost (right side)
    if (!district.is_current && !district.is_locked) {
      const costColor = canAfford ? '#22c55e' : '#ef4444'
      const costBg = this.add.rectangle(width - 60, y + 25, 70, 30, 0x0d1a14, 0.9)
        .setStrokeStyle(1, canAfford ? 0x22c55e : 0xef4444, 0.4)
        .setDepth(102)
      this.contentItems.push(costBg)

      const cost = this.add.text(width - 60, y + 18, district.travel_cost === 0 ? 'FREE' : formatMoney(district.travel_cost), {
        fontSize: '12px',
        color: costColor,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(cost)

      const costLabel = this.add.text(width - 60, y + 32, '💵 Cost', {
        fontSize: '8px',
        color: '#888888'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(costLabel)
    }

    // Current location badge
    if (district.is_current) {
      const badge = this.add.rectangle(width - 60, y + 25, 60, 24, 0x22c55e, 0.2)
        .setStrokeStyle(1, 0x22c55e, 0.5)
        .setDepth(102)
      this.contentItems.push(badge)

      const badgeText = this.add.text(width - 60, y + 25, '📍 HERE', {
        fontSize: '10px',
        color: '#22c55e',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(badgeText)
    }
  }

  renderFlights() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section header
    const header = this.add.text(25, y, `${SYMBOLS.system} PREMIUM FLIGHTS`, {
      fontSize: '14px',
      color: '#4f46e5',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(header)

    const subheader = this.add.text(25, y + 20, `${SYMBOLS.system} Instant travel, no cooldown`, {
      fontSize: '10px',
      color: toHexString(COLORS.text.muted)
    }).setDepth(102)
    this.contentItems.push(subheader)
    y += 50

    FLIGHT_DESTINATIONS.forEach((flight, index) => {
      if (y > this.SCROLL_START_Y - 100 && y < this.SCROLL_END_Y + 50) {
        this.renderFlightCard(flight, y, player)
      }
      y += 90
    })

    // Info card
    y += 10
    const infoBg = this.add.rectangle(width / 2, y + 40, this.CARD_WIDTH, 70, 0x1a2a3a, 0.9)
      .setStrokeStyle(1, 0x3b82f6, 0.3)
      .setDepth(101)
    this.contentItems.push(infoBg)

    const infoIcon = this.add.text(30, y + 25, '💡', {
      fontSize: '20px'
    }).setDepth(102)
    this.contentItems.push(infoIcon)

    const infoText = this.add.text(60, y + 25, 'Premium flights bypass travel cooldowns\nand let you reach any district instantly.', {
      fontSize: '10px',
      color: '#888888',
      lineSpacing: 4
    }).setDepth(102)
    this.contentItems.push(infoText)

    this.totalContentHeight = y + 100 - this.SCROLL_START_Y + this.scrollOffset
  }

  renderFlightCard(flight, y, player) {
    const { width } = this.cameras.main
    const canAfford = (player.cash || 0) >= flight.cost

    // Card
    const bgColor = canAfford ? 0x1a2a4a : 0x2a1a1a
    const card = this.add.rectangle(width / 2, y + 35, this.CARD_WIDTH, 75, bgColor, 0.95)
      .setStrokeStyle(1, canAfford ? 0x3b82f6 : 0xef4444, 0.5)
      .setDepth(101)
    this.contentItems.push(card)

    if (canAfford) {
      card.setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(0x2a3a5a, 0.95)
        card.setStrokeStyle(2, 0x60a5fa)
      })

      card.on('pointerout', () => {
        card.setFillStyle(bgColor, 0.95)
        card.setStrokeStyle(1, 0x3b82f6, 0.5)
      })

      card.on('pointerdown', () => {
        this.showFlightDestinationPicker(flight)
      })
    }

    // Flight icon
    const icon = this.add.text(40, y + 35, flight.icon, {
      fontSize: '28px'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(icon)

    // Flight name
    const name = this.add.text(70, y + 20, flight.name, {
      fontSize: '14px',
      color: canAfford ? '#ffffff' : '#666666',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(name)

    // Description
    const desc = this.add.text(70, y + 40, flight.description, {
      fontSize: '10px',
      color: '#888888'
    }).setDepth(102)
    this.contentItems.push(desc)

    // Cost
    const costBg = this.add.rectangle(width - 55, y + 35, 70, 35, 0x0d1a14, 0.9)
      .setStrokeStyle(1, canAfford ? 0x22c55e : 0xef4444, 0.4)
      .setDepth(102)
    this.contentItems.push(costBg)

    const cost = this.add.text(width - 55, y + 30, formatMoney(flight.cost), {
      fontSize: '13px',
      color: canAfford ? '#22c55e' : '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(cost)

    const costLabel = this.add.text(width - 55, y + 45, 'Instant', {
      fontSize: '8px',
      color: '#3b82f6'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(costLabel)
  }

  renderHistory() {
    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section header
    const header = this.add.text(25, y, `${SYMBOLS.system} TRAVEL HISTORY`, {
      fontSize: '14px',
      color: '#4f46e5',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(header)
    y += 30

    if (this.travelHistory.length === 0) {
      // Empty state
      const emptyIcon = this.add.text(width / 2, y + 60, '🧭', {
        fontSize: '48px'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(emptyIcon)

      const emptyTitle = this.add.text(width / 2, y + 110, 'No Travel History', {
        fontSize: '16px',
        color: '#888888',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(emptyTitle)

      const emptyDesc = this.add.text(width / 2, y + 135, 'Your travels will be recorded here', {
        fontSize: '12px',
        color: '#666666'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(emptyDesc)

      this.totalContentHeight = 200
      return
    }

    // Render history entries
    this.travelHistory.slice(0, 20).forEach((entry, index) => {
      if (y > this.SCROLL_START_Y - 50 && y < this.SCROLL_END_Y + 50) {
        this.renderHistoryEntry(entry, y)
      }
      y += 55
    })

    this.totalContentHeight = y - this.SCROLL_START_Y + this.scrollOffset
  }

  renderHistoryEntry(entry, y) {
    const { width } = this.cameras.main

    // Entry background
    const entryBg = this.add.rectangle(width / 2, y + 22, this.CARD_WIDTH, 45, 0x1e293b, 0.9)
      .setStrokeStyle(1, 0x334155)
      .setDepth(101)
    this.contentItems.push(entryBg)

    // Arrow icon
    const arrow = this.add.text(30, y + 15, '➡️', {
      fontSize: '16px'
    }).setDepth(102)
    this.contentItems.push(arrow)

    // From -> To
    const fromTo = this.add.text(55, y + 12, `${entry.from || 'Unknown'} → ${entry.to || 'Unknown'}`, {
      fontSize: '12px',
      color: '#ffffff'
    }).setDepth(102)
    this.contentItems.push(fromTo)

    // Date/time
    const timeText = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : 'Recently'
    const time = this.add.text(55, y + 30, timeText, {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(102)
    this.contentItems.push(time)

    // Cost paid
    if (entry.cost > 0) {
      const cost = this.add.text(width - 30, y + 22, `-${formatMoney(entry.cost)}`, {
        fontSize: '11px',
        color: '#ef4444'
      }).setOrigin(1, 0.5).setDepth(102)
      this.contentItems.push(cost)
    } else {
      const free = this.add.text(width - 30, y + 22, 'FREE', {
        fontSize: '11px',
        color: '#22c55e'
      }).setOrigin(1, 0.5).setDepth(102)
      this.contentItems.push(free)
    }
  }

  travelToDistrict(district) {
    const player = gameManager.player || getPlayerData()

    // Check cooldown
    if (gameManager.isOnCooldown('travel')) {
      gameManager.addNotification('warning', 'Travel on cooldown!')
      return
    }

    // Check cost
    if (player.cash < district.travel_cost) {
      gameManager.addNotification('danger', `Need ${formatMoney(district.travel_cost)} to travel`)
      return
    }

    // Deduct cost
    player.cash -= district.travel_cost

    // Update location
    const previousDistrict = this.currentDistrict
    player.current_district_id = district.id
    player.currentDistrict = district.id

    // Track visited districts
    if (!player.districtsVisited) player.districtsVisited = []
    if (!player.districtsVisited.includes(district.id)) {
      player.districtsVisited.push(district.id)
    }

    // Add to history
    if (!player.travelHistory) player.travelHistory = []
    player.travelHistory.unshift({
      from: this.districts.find(d => d.id === previousDistrict)?.name || 'Unknown',
      to: district.name,
      cost: district.travel_cost,
      timestamp: Date.now()
    })

    // Keep only last 50 entries
    if (player.travelHistory.length > 50) {
      player.travelHistory = player.travelHistory.slice(0, 50)
    }

    // Save and set cooldown
    savePlayerData(player)
    gameManager.player = player
    gameManager.setCooldown('travel', TRAVEL_COOLDOWN)

    // Play sound and notify
    audioManager.playClick()
    gameManager.addNotification('success', `Traveled to ${district.name}!`)

    // Refresh scene
    this.currentDistrict = district.id
    this.loadTravelData()
  }

  showFlightDestinationPicker(flight) {
    const { width, height } = this.cameras.main
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modalHeight = 350
    const modal = this.add.rectangle(width / 2, height / 2, width - 30, modalHeight, COLORS.bg.panel, 0.98)
      .setStrokeStyle(2, 0x4f46e5)
      .setDepth(301)
    modalElements.push(modal)

    // Header
    const headerText = this.add.text(width / 2, height / 2 - modalHeight / 2 + 30, `${SYMBOLS.system} Select Destination`, {
      ...getTerminalStyle('lg'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(headerText)

    // District buttons
    const availableDistricts = this.districts.filter(d => !d.is_current && !d.is_locked)
    let btnY = height / 2 - modalHeight / 2 + 70

    availableDistricts.slice(0, 5).forEach(district => {
      const btn = this.add.rectangle(width / 2, btnY, width - 60, 40, 0x1e293b, 0.95)
        .setStrokeStyle(1, 0x334155)
        .setInteractive({ useHandCursor: true })
        .setDepth(302)
      modalElements.push(btn)

      btn.on('pointerover', () => btn.setFillStyle(0x2a3a4a, 0.95))
      btn.on('pointerout', () => btn.setFillStyle(0x1e293b, 0.95))
      btn.on('pointerdown', () => {
        this.executeFlightTravel(flight, district)
        modalElements.forEach(el => el.destroy())
      })

      const btnText = this.add.text(width / 2, btnY, `${district.icon || '🏙️'} ${district.name}`, {
        fontSize: '13px',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(303)
      modalElements.push(btnText)

      btnY += 50
    })

    // Close button
    const closeBtn = this.add.text(width / 2, height / 2 + modalHeight / 2 - 30, '✕ Cancel', {
      fontSize: '14px',
      color: '#888888',
      backgroundColor: '#1e293b',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setDepth(303).setInteractive({ useHandCursor: true })
    modalElements.push(closeBtn)

    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'))
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      modalElements.forEach(el => el.destroy())
    })

    overlay.on('pointerdown', () => {
      modalElements.forEach(el => el.destroy())
    })
  }

  executeFlightTravel(flight, district) {
    const player = gameManager.player || getPlayerData()

    // Check cost
    if (player.cash < flight.cost) {
      gameManager.addNotification('danger', `Need ${formatMoney(flight.cost)} for this flight`)
      return
    }

    // Deduct cost
    player.cash -= flight.cost

    // Update location
    const previousDistrict = this.currentDistrict
    player.current_district_id = district.id
    player.currentDistrict = district.id

    // Track visited
    if (!player.districtsVisited) player.districtsVisited = []
    if (!player.districtsVisited.includes(district.id)) {
      player.districtsVisited.push(district.id)
    }

    // Add to history
    if (!player.travelHistory) player.travelHistory = []
    player.travelHistory.unshift({
      from: this.districts.find(d => d.id === previousDistrict)?.name || 'Unknown',
      to: district.name,
      cost: flight.cost,
      method: flight.name,
      timestamp: Date.now()
    })

    // Save (no cooldown for flights!)
    savePlayerData(player)
    gameManager.player = player

    // Play sound and notify
    audioManager.playClick()
    gameManager.addNotification('success', `${flight.icon} Flew to ${district.name}!`)

    // Refresh scene
    this.currentDistrict = district.id
    this.loadTravelData()
  }

  closeScene() {
    const sceneManager = this.scene

    // CRITICAL: Re-enable input on GameScene BEFORE resuming
    try {
      const gameScene = sceneManager.get('GameScene')
      if (gameScene) {
        gameScene.input.enabled = true
      }
    } catch (e) {}

    sceneManager.stop()

    // CRITICAL: Bring GameScene to top and resume
    try {
      sceneManager.bringToTop('GameScene')
    } catch (e) {}
    sceneManager.resume('GameScene')
    try {
      sceneManager.resume('UIScene')
    } catch (e) {}
  }
}
