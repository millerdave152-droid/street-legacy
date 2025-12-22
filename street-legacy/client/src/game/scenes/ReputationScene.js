import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { getPlayerData, savePlayerData } from '../data/GameData'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * ReputationScene - "Rags" Tab - Player reputation and street cred tracking
 *
 * Features:
 * - Tab navigation: "Overview" | "Factions" | "Districts" | "History"
 * - 4-dimension reputation: Respect, Fear, Trust, Heat
 * - Standing levels from Unknown to Legendary
 * - Street cred currency display
 * - Reputation history log
 */

// Local fallback data for factions
const LOCAL_FACTIONS = [
  { id: 'triads', name: 'The Triads', icon: '🐉', color: 0xef4444, territory: 'Chinatown' },
  { id: 'bikers', name: 'Iron Wolves MC', icon: '🏍️', color: 0xf97316, territory: 'Industrial' },
  { id: 'cartel', name: 'Los Diablos', icon: '💀', color: 0xa855f7, territory: 'South Side' },
  { id: 'mafia', name: 'The Family', icon: '🎩', color: 0x3b82f6, territory: 'Downtown' },
  { id: 'yakuza', name: 'Sakura-kai', icon: '🌸', color: 0xec4899, territory: 'Little Tokyo' },
  { id: 'russians', name: 'Bratva', icon: '🐻', color: 0x22d3ee, territory: 'Brighton' },
]

// Standing levels based on total reputation score
const STANDING_LEVELS = [
  { name: 'Unknown', min: -999, max: -50, color: '#6b7280', icon: '❓' },
  { name: 'Hated', min: -50, max: -20, color: '#ef4444', icon: '💢' },
  { name: 'Disliked', min: -20, max: 0, color: '#f97316', icon: '👎' },
  { name: 'Known', min: 0, max: 30, color: '#fbbf24', icon: '👁️' },
  { name: 'Respected', min: 30, max: 60, color: '#22c55e', icon: '✊' },
  { name: 'Feared', min: 60, max: 80, color: '#a855f7', icon: '😰' },
  { name: 'Trusted', min: 80, max: 100, color: '#3b82f6', icon: '🤝' },
  { name: 'Legendary', min: 100, max: 999, color: '#fbbf24', icon: '👑' },
]

export class ReputationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ReputationScene' })
  }

  async create() {
    console.log('[ReputationScene] create() started')
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
    this.CARD_HEIGHT = 85
    this.CARD_PADDING = 8
    this.SCROLL_START_Y = 200
    this.SCROLL_END_Y = height - 20

    // State
    this.factionReps = []
    this.districtReps = []
    this.repHistory = []
    this.streetCred = 0
    this.contentItems = []
    this.scrollOffset = 0
    this.activeTab = 'overview'
    this.isLoading = true

    // Full screen opaque overlay
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(100)
      .setInteractive()

    // Grid pattern background
    this.createGridPattern()

    // Create UI
    this.createHeader()
    this.createTabs()
    this.createCloseButton()
    this.setupScrolling()

    // Loading state
    this.loadingText = this.add.text(width / 2, height / 2, 'Loading reputation...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(102)

    // Load data
    await this.loadReputationData()
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

    // Header icon with background
    const iconBg = this.add.circle(width / 2, 32, 26, COLORS.bg.panel)
      .setStrokeStyle(2, COLORS.cred.gold, 0.5)
      .setDepth(101)

    this.add.text(width / 2, 32, '[R]', {
      ...getTerminalStyle('lg'),
      fontSize: '20px'
    }).setOrigin(0.5).setDepth(102)

    // Title
    this.add.text(width / 2, 68, 'REPUTATION', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.cred.gold)
    }).setOrigin(0.5).setDepth(102)

    // Street cred display
    const cardWidth = (width - 50) / 2
    const credCardX = 20 + cardWidth / 2
    this.add.rectangle(credCardX, 95, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.cred.gold, 0.4)
      .setDepth(101)

    this.credText = this.add.text(credCardX, 95, `${SYMBOLS.cred} ${this.streetCred} Cred`, {
      ...getTerminalStyle('sm'),
      fontSize: '11px',
      color: toHexString(COLORS.cred.gold)
    }).setOrigin(0.5).setDepth(102)

    // Overall standing display
    const standingCardX = width - 20 - cardWidth / 2
    this.add.rectangle(standingCardX, 95, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.network.primary, 0.4)
      .setDepth(101)

    this.standingText = this.add.text(standingCardX, 95, '[S] Known', {
      ...getTerminalStyle('sm'),
      fontSize: '11px',
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(102)

    // Summary bar below header
    this.createSummaryBar()
  }

  createSummaryBar() {
    const { width } = this.cameras.main
    const barY = 130
    const barHeight = 40

    // Background
    this.add.rectangle(width / 2, barY, width - 30, barHeight, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, COLORS.cred.gold, 0.3)
      .setDepth(101)

    // Label
    this.add.text(25, barY - 10, `${SYMBOLS.system} REPUTATION OVERVIEW`, {
      ...getTerminalStyle('xs'),
      fontSize: '8px',
      color: toHexString(COLORS.cred.gold)
    }).setDepth(102)

    // Summary stats (will be updated)
    this.summaryText = this.add.text(25, barY + 6, 'Build your reputation on the streets', {
      ...getTerminalStyle('xs'),
      fontSize: '10px',
      color: toHexString(COLORS.text.muted)
    }).setDepth(102)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 165
    const tabWidth = (width - 75) / 4
    const gap = 5

    this.tabs = {}

    // Overview tab
    const overviewX = 20 + tabWidth / 2
    this.tabs.overview = this.createTab(overviewX, tabY, tabWidth, '📊', 'overview', true)

    // Factions tab
    const factionsX = 20 + tabWidth + gap + tabWidth / 2
    this.tabs.factions = this.createTab(factionsX, tabY, tabWidth, '👥', 'factions', false)

    // Districts tab
    const districtsX = 20 + (tabWidth + gap) * 2 + tabWidth / 2
    this.tabs.districts = this.createTab(districtsX, tabY, tabWidth, '🗺️', 'districts', false)

    // History tab
    const historyX = width - 20 - tabWidth / 2
    this.tabs.history = this.createTab(historyX, tabY, tabWidth, '📜', 'history', false)
  }

  createTab(x, y, tabWidth, label, tabKey, isActive) {
    const bgColor = isActive ? 0xf59e0b : 0x1e293b

    const bg = this.add.rectangle(x, y, tabWidth, 28, bgColor, 0.95)
      .setStrokeStyle(1, isActive ? 0xfbbf24 : 0x334155)
      .setInteractive({ useHandCursor: true })
      .setDepth(101)

    const text = this.add.text(x, y, label, {
      fontSize: '14px',
      color: isActive ? '#000000' : '#888888'
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
    }

    // Update new tab appearance
    const newTab = this.tabs[tabKey]
    if (newTab) {
      newTab.bg.setFillStyle(0xf59e0b, 0.95)
      newTab.bg.setStrokeStyle(1, 0xfbbf24)
      newTab.text.setColor('#000000')
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
    const { height } = this.cameras.main

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

  async loadReputationData() {
    const player = gameManager.player || getPlayerData()

    try {
      // Try to load from API first
      if (!gameManager.useLocalData) {
        // API calls would go here
        // const repData = await playerService.getReputation(player.id)
      }
    } catch (error) {
      console.log('[ReputationScene] Using local reputation data')
    }

    // Use local data (stored in player object or defaults)
    this.streetCred = player.street_cred || player.streetCred || 0

    // Initialize faction reputation from player data or defaults
    this.factionReps = LOCAL_FACTIONS.map(faction => {
      const savedRep = player.factionReputation?.[faction.id] || {}
      return {
        ...faction,
        respect: savedRep.respect || 0,
        fear: savedRep.fear || 0,
        trust: savedRep.trust || 0,
        heat: savedRep.heat || 0,
      }
    })

    // Initialize district reputation
    const districts = gameManager.gameState?.districts || []
    this.districtReps = districts.slice(0, 6).map(district => {
      const savedRep = player.districtReputation?.[district.id] || {}
      return {
        id: district.id,
        name: district.name,
        icon: district.icon || '🏙️',
        respect: savedRep.respect || 0,
        fear: savedRep.fear || 0,
        trust: savedRep.trust || 0,
        heat: savedRep.heat || 0,
      }
    })

    // If no districts, use defaults
    if (this.districtReps.length === 0) {
      this.districtReps = [
        { id: 'downtown', name: 'Downtown', icon: '🏙️', respect: 0, fear: 0, trust: 0, heat: 0 },
        { id: 'industrial', name: 'Industrial', icon: '🏭', respect: 0, fear: 0, trust: 0, heat: 0 },
        { id: 'suburbs', name: 'Suburbs', icon: '🏡', respect: 0, fear: 0, trust: 0, heat: 0 },
        { id: 'docks', name: 'Docks', icon: '🚢', respect: 0, fear: 0, trust: 0, heat: 0 },
      ]
    }

    // Load reputation history from player data
    this.repHistory = player.repHistory || []

    // Update UI
    this.credText.setText(`${SYMBOLS.cred} ${this.streetCred} Cred`)
    this.updateOverallStanding()

    // Hide loading and render
    this.loadingText.destroy()
    this.isLoading = false
    this.renderContent()
  }

  updateOverallStanding() {
    // Calculate average reputation across all factions
    let totalRep = 0
    let count = 0

    this.factionReps.forEach(faction => {
      totalRep += faction.respect + faction.trust - faction.heat
      count++
    })

    const avgRep = count > 0 ? totalRep / count : 0

    // Find standing level
    const standing = STANDING_LEVELS.find(s => avgRep >= s.min && avgRep < s.max) || STANDING_LEVELS[3]
    this.standingText.setText(`[S] ${standing.name}`)
    this.standingText.setColor(standing.color)

    // Update summary
    const factionsKnown = this.factionReps.filter(f => f.respect > 0 || f.fear > 0).length
    const highestRep = this.factionReps.reduce((max, f) =>
      (f.respect + f.trust) > (max.respect + max.trust) ? f : max, this.factionReps[0])

    if (factionsKnown > 0) {
      this.summaryText.setText(`${factionsKnown} factions know you | Highest: ${highestRep?.name || 'None'}`)
      this.summaryText.setColor(toHexString(COLORS.cred.gold))
    }
  }

  renderContent() {
    // Clear previous content
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []

    switch (this.activeTab) {
      case 'overview':
        this.renderOverview()
        break
      case 'factions':
        this.renderFactions()
        break
      case 'districts':
        this.renderDistricts()
        break
      case 'history':
        this.renderHistory()
        break
    }
  }

  renderOverview() {
    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Street Cred card
    this.renderOverviewCard(y, '⭐ STREET CRED', `${this.streetCred}`, '#f59e0b',
      'Earned through actions and daily login. Spend on skipping jail, resetting cooldowns, and more.')
    y += 90

    // Overall standing card
    const standing = this.getOverallStanding()
    this.renderOverviewCard(y, '📊 OVERALL STANDING', standing.name, standing.color,
      'Your combined reputation across all factions and districts.')
    y += 90

    // Quick stats
    const statsY = y
    this.renderQuickStats(statsY)
    y += 130

    // Tips section
    this.renderTipsSection(y)
    y += 100

    this.totalContentHeight = y - this.SCROLL_START_Y + this.scrollOffset
  }

  renderOverviewCard(y, title, value, valueColor, description) {
    const { width } = this.cameras.main

    if (y < this.SCROLL_START_Y - 100 || y > this.SCROLL_END_Y + 50) return

    // Card background
    const card = this.add.rectangle(width / 2, y + 35, this.CARD_WIDTH, 80, 0x1e293b, 0.95)
      .setStrokeStyle(1, 0x334155)
      .setDepth(101)
    this.contentItems.push(card)

    // Title
    const titleText = this.add.text(30, y + 15, title, {
      fontSize: '12px',
      color: '#888888',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(titleText)

    // Value
    const valueText = this.add.text(30, y + 38, value, {
      fontSize: '24px',
      color: valueColor,
      fontFamily: 'Arial Black, Arial'
    }).setDepth(102)
    this.contentItems.push(valueText)

    // Description
    const descText = this.add.text(30, y + 65, description, {
      fontSize: '9px',
      color: '#666666',
      wordWrap: { width: this.CARD_WIDTH - 40 }
    }).setDepth(102)
    this.contentItems.push(descText)
  }

  renderQuickStats(y) {
    const { width } = this.cameras.main

    if (y < this.SCROLL_START_Y - 150 || y > this.SCROLL_END_Y + 50) return

    // Section title
    const sectionTitle = this.add.text(25, y, '📈 QUICK STATS', {
      fontSize: '12px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(sectionTitle)

    y += 25

    // Stats grid (2x2)
    const statWidth = (width - 55) / 2
    const stats = [
      { label: 'Respect', value: this.getTotalStat('respect'), color: '#22c55e', icon: '✊' },
      { label: 'Fear', value: this.getTotalStat('fear'), color: '#ef4444', icon: '😰' },
      { label: 'Trust', value: this.getTotalStat('trust'), color: '#3b82f6', icon: '🤝' },
      { label: 'Heat', value: this.getTotalStat('heat'), color: '#f97316', icon: '🔥' },
    ]

    stats.forEach((stat, i) => {
      const row = Math.floor(i / 2)
      const col = i % 2
      const statX = 25 + col * (statWidth + 10)
      const statY = y + row * 50

      // Stat card
      const statCard = this.add.rectangle(statX + statWidth / 2, statY + 20, statWidth, 40, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(stat.color).color, 0.4)
        .setDepth(101)
      this.contentItems.push(statCard)

      // Icon and label
      const labelText = this.add.text(statX + 10, statY + 12, `${stat.icon} ${stat.label}`, {
        fontSize: '10px',
        color: '#888888'
      }).setDepth(102)
      this.contentItems.push(labelText)

      // Value
      const valueText = this.add.text(statX + statWidth - 10, statY + 22, `${stat.value}`, {
        fontSize: '16px',
        color: stat.color,
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(102)
      this.contentItems.push(valueText)
    })
  }

  renderTipsSection(y) {
    const { width } = this.cameras.main

    if (y < this.SCROLL_START_Y - 100 || y > this.SCROLL_END_Y + 50) return

    // Tips card
    const tipsCard = this.add.rectangle(width / 2, y + 40, this.CARD_WIDTH, 80, 0x1a2a1a, 0.9)
      .setStrokeStyle(1, 0x22c55e, 0.3)
      .setDepth(101)
    this.contentItems.push(tipsCard)

    const tipsTitle = this.add.text(30, y + 15, '💡 HOW TO BUILD REPUTATION', {
      fontSize: '11px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(tipsTitle)

    const tips = [
      '• Complete crimes in faction territories',
      '• Do jobs for faction contacts',
      '• Trade goods in their markets',
    ]

    tips.forEach((tip, i) => {
      const tipText = this.add.text(30, y + 35 + i * 15, tip, {
        fontSize: '10px',
        color: '#888888'
      }).setDepth(102)
      this.contentItems.push(tipText)
    })
  }

  renderFactions() {
    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section header
    const header = this.add.text(25, y, '👥 FACTION REPUTATION', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(header)
    y += 30

    this.factionReps.forEach((faction, index) => {
      if (y > this.SCROLL_START_Y - 100 && y < this.SCROLL_END_Y + 50) {
        this.renderFactionCard(faction, y)
      }
      y += this.CARD_HEIGHT + this.CARD_PADDING
    })

    this.totalContentHeight = y - this.SCROLL_START_Y + this.scrollOffset
  }

  renderFactionCard(faction, y) {
    const { width } = this.cameras.main
    const standing = this.getStanding(faction)

    // Card background
    const card = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2, this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e293b, 0.95)
      .setStrokeStyle(2, faction.color)
      .setInteractive({ useHandCursor: true })
      .setDepth(101)
    this.contentItems.push(card)

    // Left accent bar
    const accent = this.add.rectangle(25, y + this.CARD_HEIGHT / 2, 4, this.CARD_HEIGHT - 15, faction.color)
      .setDepth(102)
    this.contentItems.push(accent)

    // Faction icon
    const iconBg = this.add.circle(50, y + 25, 18, faction.color, 0.2)
      .setDepth(102)
    this.contentItems.push(iconBg)

    const icon = this.add.text(50, y + 25, faction.icon, {
      fontSize: '18px'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(icon)

    // Faction name
    const name = this.add.text(78, y + 15, faction.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(name)

    // Territory
    const territory = this.add.text(78, y + 32, `📍 ${faction.territory}`, {
      fontSize: '10px',
      color: '#888888'
    }).setDepth(102)
    this.contentItems.push(territory)

    // Standing badge
    const badgeBg = this.add.rectangle(width - 60, y + 22, 70, 22, Phaser.Display.Color.HexStringToColor(standing.color).color, 0.2)
      .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(standing.color).color, 0.5)
      .setDepth(102)
    this.contentItems.push(badgeBg)

    const badgeText = this.add.text(width - 60, y + 22, `${standing.icon} ${standing.name}`, {
      fontSize: '9px',
      color: standing.color
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(badgeText)

    // Reputation bars
    const barsY = y + 52
    const barWidth = (this.CARD_WIDTH - 50) / 4 - 8

    const stats = [
      { label: '✊', value: faction.respect, color: 0x22c55e },
      { label: '😰', value: faction.fear, color: 0xef4444 },
      { label: '🤝', value: faction.trust, color: 0x3b82f6 },
      { label: '🔥', value: faction.heat, color: 0xf97316 },
    ]

    stats.forEach((stat, i) => {
      const barX = 35 + i * (barWidth + 8)
      this.renderMiniBar(barX, barsY, barWidth, stat.label, stat.value, stat.color)
    })

    // Click handler for details
    card.on('pointerdown', () => {
      this.showFactionDetails(faction)
    })
  }

  renderMiniBar(x, y, barWidth, label, value, color) {
    // Label
    const labelText = this.add.text(x, y, label, {
      fontSize: '10px'
    }).setDepth(103)
    this.contentItems.push(labelText)

    // Bar background
    const barBg = this.add.rectangle(x + 20 + (barWidth - 20) / 2, y + 5, barWidth - 20, 8, 0x1a1a2e)
      .setDepth(102)
    this.contentItems.push(barBg)

    // Bar fill
    const fillWidth = Math.max(2, ((barWidth - 20) * Math.min(100, Math.max(0, value))) / 100)
    const barFill = this.add.rectangle(x + 20 + fillWidth / 2, y + 5, fillWidth, 8, color)
      .setDepth(103)
    this.contentItems.push(barFill)

    // Value text
    const valueText = this.add.text(x + barWidth - 5, y + 5, `${value}`, {
      fontSize: '8px',
      color: '#888888'
    }).setOrigin(1, 0.5).setDepth(103)
    this.contentItems.push(valueText)
  }

  renderDistricts() {
    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section header
    const header = this.add.text(25, y, '🗺️ DISTRICT REPUTATION', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(header)
    y += 30

    this.districtReps.forEach((district, index) => {
      if (y > this.SCROLL_START_Y - 100 && y < this.SCROLL_END_Y + 50) {
        this.renderDistrictCard(district, y)
      }
      y += 75
    })

    this.totalContentHeight = y - this.SCROLL_START_Y + this.scrollOffset
  }

  renderDistrictCard(district, y) {
    const { width } = this.cameras.main
    const totalRep = district.respect + district.trust - district.heat

    // Card background
    const card = this.add.rectangle(width / 2, y + 30, this.CARD_WIDTH, 60, 0x1e293b, 0.95)
      .setStrokeStyle(1, 0x334155)
      .setDepth(101)
    this.contentItems.push(card)

    // District icon
    const icon = this.add.text(35, y + 20, district.icon, {
      fontSize: '22px'
    }).setDepth(102)
    this.contentItems.push(icon)

    // District name
    const name = this.add.text(65, y + 15, district.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(name)

    // Rep summary
    const repColor = totalRep >= 0 ? '#22c55e' : '#ef4444'
    const repSign = totalRep >= 0 ? '+' : ''
    const repText = this.add.text(65, y + 35, `Rep: ${repSign}${totalRep} | Heat: ${district.heat}`, {
      fontSize: '11px',
      color: '#888888'
    }).setDepth(102)
    this.contentItems.push(repText)

    // Heat indicator bar
    const heatBarX = width - 80
    const heatBarWidth = 60
    const heatBarBg = this.add.rectangle(heatBarX, y + 30, heatBarWidth, 10, 0x1a1a2e)
      .setDepth(102)
    this.contentItems.push(heatBarBg)

    const heatFill = Math.max(2, (heatBarWidth * district.heat) / 100)
    const heatBarFill = this.add.rectangle(heatBarX - heatBarWidth / 2 + heatFill / 2, y + 30, heatFill, 10, 0xf97316)
      .setDepth(103)
    this.contentItems.push(heatBarFill)

    const heatLabel = this.add.text(heatBarX, y + 15, '🔥', {
      fontSize: '12px'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(heatLabel)
  }

  renderHistory() {
    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section header
    const header = this.add.text(25, y, '📜 REPUTATION HISTORY', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setDepth(102)
    this.contentItems.push(header)
    y += 30

    if (this.repHistory.length === 0) {
      // Empty state
      const emptyIcon = this.add.text(width / 2, y + 60, '📜', {
        fontSize: '48px'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(emptyIcon)

      const emptyTitle = this.add.text(width / 2, y + 110, 'No History Yet', {
        fontSize: '16px',
        color: '#888888',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(emptyTitle)

      const emptyDesc = this.add.text(width / 2, y + 135, 'Your reputation changes will appear here', {
        fontSize: '12px',
        color: '#666666'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(emptyDesc)

      this.totalContentHeight = 200
      return
    }

    // Render history entries
    this.repHistory.slice(0, 20).forEach((entry, index) => {
      if (y > this.SCROLL_START_Y - 60 && y < this.SCROLL_END_Y + 50) {
        this.renderHistoryEntry(entry, y)
      }
      y += 50
    })

    this.totalContentHeight = y - this.SCROLL_START_Y + this.scrollOffset
  }

  renderHistoryEntry(entry, y) {
    const { width } = this.cameras.main
    const isPositive = entry.change > 0

    // Entry background
    const entryBg = this.add.rectangle(width / 2, y + 20, this.CARD_WIDTH, 40, 0x1e293b, 0.9)
      .setStrokeStyle(1, isPositive ? 0x22c55e : 0xef4444, 0.3)
      .setDepth(101)
    this.contentItems.push(entryBg)

    // Change indicator
    const changeIcon = isPositive ? '📈' : '📉'
    const changeText = this.add.text(30, y + 12, changeIcon, {
      fontSize: '16px'
    }).setDepth(102)
    this.contentItems.push(changeText)

    // Description
    const desc = this.add.text(55, y + 12, entry.description || 'Reputation changed', {
      fontSize: '11px',
      color: '#ffffff'
    }).setDepth(102)
    this.contentItems.push(desc)

    // Target (faction/district)
    const target = this.add.text(55, y + 28, entry.target || '', {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(102)
    this.contentItems.push(target)

    // Change value
    const changeValue = this.add.text(width - 35, y + 20, `${isPositive ? '+' : ''}${entry.change}`, {
      fontSize: '14px',
      color: isPositive ? '#22c55e' : '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(102)
    this.contentItems.push(changeValue)
  }

  showFactionDetails(faction) {
    const { width, height } = this.cameras.main
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modalHeight = 300
    const modal = this.add.rectangle(width / 2, height / 2, width - 40, modalHeight, 0x1a1a2e, 0.98)
      .setStrokeStyle(2, faction.color)
      .setDepth(301)
    modalElements.push(modal)

    // Header
    const headerBg = this.add.rectangle(width / 2, height / 2 - modalHeight / 2 + 30, width - 40, 60, faction.color, 0.2)
      .setDepth(302)
    modalElements.push(headerBg)

    const factionIcon = this.add.text(width / 2, height / 2 - modalHeight / 2 + 30, faction.icon, {
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(factionIcon)

    const factionName = this.add.text(width / 2, height / 2 - modalHeight / 2 + 65, faction.name, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial Black, Arial'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(factionName)

    // Reputation details
    const detailsY = height / 2 - 30
    const stats = [
      { label: 'Respect', value: faction.respect, color: '#22c55e', desc: 'How much they respect you' },
      { label: 'Fear', value: faction.fear, color: '#ef4444', desc: 'How much they fear you' },
      { label: 'Trust', value: faction.trust, color: '#3b82f6', desc: 'How much they trust you' },
      { label: 'Heat', value: faction.heat, color: '#f97316', desc: 'Wanted level with them' },
    ]

    stats.forEach((stat, i) => {
      const statY = detailsY + i * 40

      const label = this.add.text(40, statY, stat.label, {
        fontSize: '12px',
        color: stat.color,
        fontStyle: 'bold'
      }).setDepth(303)
      modalElements.push(label)

      // Progress bar
      const barWidth = width - 150
      const barBg = this.add.rectangle(width / 2 + 20, statY + 5, barWidth, 12, 0x1a1a2e)
        .setDepth(302)
      modalElements.push(barBg)

      const fillWidth = Math.max(2, (barWidth * Math.min(100, Math.max(0, stat.value))) / 100)
      const barFill = this.add.rectangle(width / 2 + 20 - barWidth / 2 + fillWidth / 2, statY + 5, fillWidth, 12,
        Phaser.Display.Color.HexStringToColor(stat.color).color)
        .setDepth(303)
      modalElements.push(barFill)

      const valueText = this.add.text(width - 40, statY + 5, `${stat.value}/100`, {
        fontSize: '11px',
        color: '#888888'
      }).setOrigin(1, 0.5).setDepth(303)
      modalElements.push(valueText)
    })

    // Close button
    const closeBtn = this.add.text(width / 2, height / 2 + modalHeight / 2 - 30, '✕ Close', {
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

  // Helper methods
  getStanding(entity) {
    const total = (entity.respect || 0) + (entity.trust || 0) - (entity.heat || 0)
    return STANDING_LEVELS.find(s => total >= s.min && total < s.max) || STANDING_LEVELS[3]
  }

  getOverallStanding() {
    let total = 0
    this.factionReps.forEach(f => {
      total += f.respect + f.trust - f.heat
    })
    const avg = this.factionReps.length > 0 ? total / this.factionReps.length : 0
    return STANDING_LEVELS.find(s => avg >= s.min && avg < s.max) || STANDING_LEVELS[3]
  }

  getTotalStat(statName) {
    return this.factionReps.reduce((sum, f) => sum + (f[statName] || 0), 0)
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
