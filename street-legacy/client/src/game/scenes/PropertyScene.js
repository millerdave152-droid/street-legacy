import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney, formatDuration } from '../../utils/formatters'
import { playerService } from '../../services/player.service'
import { achievementPopup } from '../ui/AchievementPopup'
import { getPlayerData, savePlayerData, PROPERTIES } from '../data/GameData'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * PropertyScene - Full property management system
 *
 * Property Types:
 * - Business: Generates cash per hour
 * - Safehouse: Reduces heat passively, extra storage
 * - Front: Launders money (converts dirty cash to clean)
 *
 * Features:
 * - Tab navigation: "Available" | "Owned" | "Manage"
 * - Property cards with type-specific icons and colors
 * - Detail modal with full stats
 * - Collect All income functionality
 * - Upgrade and Sell system
 * - Property benefits overview
 */
export class PropertyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PropertyScene' })
  }

  async create() {
    console.log('[PropertyScene] create() started')
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
    this.CARD_HEIGHT = 100
    this.CARD_PADDING = 10
    this.SCROLL_START_Y = 195
    this.SCROLL_END_Y = height - 20

    // Property type colors
    this.TYPE_COLORS = {
      business: 0x22c55e,  // Green
      safehouse: 0x3b82f6, // Blue
      front: 0x8b5cf6,     // Purple
      default: 0x6b7280
    }

    // Property type icons
    this.TYPE_ICONS = {
      business: '🏪',
      safehouse: '🏠',
      front: '🎰',
      default: '🏢'
    }

    // Property type benefits
    this.TYPE_BENEFITS = {
      business: { label: 'Passive Income', icon: '💰' },
      safehouse: { label: 'Heat Reduction', icon: '🔥' },
      front: { label: 'Money Laundering', icon: '💸' }
    }

    // State
    this.ownedProperties = []
    this.availableProperties = []
    this.contentItems = []
    this.scrollOffset = 0
    this.activeTab = 'available'
    this.isLoading = true

    // Full screen opaque overlay - depth 100 to cover everything
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(100)
      .setInteractive()

    // Grid pattern background
    this.createGridPattern()

    // Create UI
    this.createHeader()
    this.createBenefitsPanel()
    this.createTabs()
    this.createCloseButton()
    this.setupScrolling()

    // Loading state
    this.loadingText = this.add.text(width / 2, height / 2, 'Loading properties...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(102)

    // Load data
    await this.loadPropertyData()
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
      .setStrokeStyle(2, 0x7c3aed, 0.5)
      .setDepth(101)

    this.add.text(width / 2, 32, '[P]', {
      ...getTerminalStyle('xl'),
    }).setOrigin(0.5).setDepth(102)

    // Title
    this.add.text(width / 2, 68, 'PROPERTIES', {
      ...getTerminalStyle('xl'),
      color: toHexString(0x7c3aed)
    }).setOrigin(0.5).setDepth(102)

    // Cash display card
    const cardWidth = (width - 50) / 2
    const cashCardX = 20 + cardWidth / 2
    this.add.rectangle(cashCardX, 95, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.network.dim, 0.4)
      .setDepth(101)

    this.cashText = this.add.text(cashCardX, 95, `$ ${formatMoney(player?.cash || 0)}`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.gold)
    }).setOrigin(0.5).setDepth(102)

    // Properties owned count
    const countCardX = width - 20 - cardWidth / 2
    this.add.rectangle(countCardX, 95, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, 0x7c3aed, 0.4)
      .setDepth(101)

    this.propertyCountText = this.add.text(countCardX, 95, '[P] 0 Properties', {
      ...getTerminalStyle('sm'),
      color: toHexString(0x7c3aed)
    }).setOrigin(0.5).setDepth(102)
  }

  createBenefitsPanel() {
    const { width } = this.cameras.main
    const panelY = 130
    const panelHeight = 45

    // Benefits panel background
    this.add.rectangle(width / 2, panelY, width - 30, panelHeight, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x7c3aed, 0.3)
      .setDepth(101)

    // Benefits title
    this.add.text(25, panelY - 12, `${SYMBOLS.system} TOTAL BENEFITS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(0x7c3aed),
      fontStyle: 'bold'
    }).setDepth(102)

    // Benefits display (will be updated)
    this.benefitsText = this.add.text(25, panelY + 5, 'No properties yet', {
      fontSize: '10px',
      color: '#666666'
    }).setDepth(102)
  }

  updateBenefitsDisplay() {
    if (!this.ownedProperties || this.ownedProperties.length === 0) {
      this.benefitsText.setText('Purchase properties to earn passive income')
      this.benefitsText.setColor(toHexString(COLORS.text.muted))
      this.propertyCountText?.setText('[P] 0 Properties')
      return
    }

    const totalIncome = this.ownedProperties.reduce((sum, p) => sum + (p.income_per_hour || 0), 0)
    const totalHeatReduction = this.ownedProperties.reduce((sum, p) => sum + (p.heat_reduction || 0), 0)
    const totalStorage = this.ownedProperties.reduce((sum, p) => sum + (p.storage_slots || 0), 0)

    const benefits = []
    if (totalIncome > 0) benefits.push(`$ ${formatMoney(totalIncome)}/hr`)
    if (totalHeatReduction > 0) benefits.push(`[HEAT] -${totalHeatReduction}%`)
    if (totalStorage > 0) benefits.push(`[STOR] +${totalStorage}`)

    this.benefitsText.setText(benefits.join('   '))
    this.benefitsText.setColor(toHexString(COLORS.network.primary))
    this.propertyCountText?.setText(`[P] ${this.ownedProperties.length} Properties`)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 165
    const tabWidth = (width - 60) / 3
    const gap = 5

    this.tabs = {}

    // Available tab
    const availX = 20 + tabWidth / 2
    this.tabs.available = this.createTab(availX, tabY, tabWidth, '[BUY]', 'available', true)

    // Owned tab
    const ownedX = 20 + tabWidth + gap + tabWidth / 2
    this.tabs.owned = this.createTab(ownedX, tabY, tabWidth, '[OWN]', 'owned', false)

    // Manage tab
    const manageX = width - 20 - tabWidth / 2
    this.tabs.manage = this.createTab(manageX, tabY, tabWidth, '[MGT]', 'manage', false)
  }

  createTab(x, y, tabWidth, label, tabKey, isActive) {
    const bgColor = isActive ? 0x7c3aed : COLORS.bg.elevated

    const bg = this.add.rectangle(x, y, tabWidth, 28, bgColor, 0.95)
      .setStrokeStyle(1, isActive ? 0x7c3aed : COLORS.network.dim)
      .setInteractive({ useHandCursor: true })
      .setDepth(101)

    const text = this.add.text(x, y, label, {
      ...getTerminalStyle('sm'),
      color: isActive ? toHexString(COLORS.text.primary) : toHexString(COLORS.text.muted),
      fontStyle: isActive ? 'bold' : 'normal'
    }).setOrigin(0.5).setDepth(102)

    bg.on('pointerover', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(COLORS.bg.card, 0.95)
        text.setColor(toHexString(COLORS.text.primary))
      }
    })

    bg.on('pointerout', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(COLORS.bg.elevated, 0.95)
        text.setColor(toHexString(COLORS.text.muted))
      }
    })

    bg.on('pointerdown', () => {
      this.switchTab(tabKey)
      try { audioManager.playClick() } catch (e) { /* ignore */ }
    })

    return { bg, text }
  }

  switchTab(tabName) {
    if (this.activeTab === tabName) return

    this.activeTab = tabName
    this.scrollOffset = 0

    // Update tab styles
    Object.keys(this.tabs).forEach(key => {
      const isActive = key === tabName
      this.tabs[key].bg.setFillStyle(isActive ? 0x7c3aed : COLORS.bg.elevated, 0.95)
      this.tabs[key].bg.setStrokeStyle(1, isActive ? 0x7c3aed : COLORS.network.dim)
      this.tabs[key].text.setColor(isActive ? toHexString(COLORS.text.primary) : toHexString(COLORS.text.muted))
      this.tabs[key].text.setStyle({ fontStyle: isActive ? 'bold' : 'normal' })
    })

    this.renderContent()
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.text.primary)
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.status.danger))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.primary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      this.closeScene()
    })
  }

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollOffset = Math.max(0, this.scrollOffset + deltaY * 0.5)
      this.renderContent()
    })

    // Touch scrolling
    let startY = 0
    let startOffset = 0

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.SCROLL_START_Y && pointer.y < this.SCROLL_END_Y) {
        startY = pointer.y
        startOffset = this.scrollOffset
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && startY > 0) {
        const deltaY = startY - pointer.y
        this.scrollOffset = Math.max(0, startOffset + deltaY)
        this.renderContent()
      }
    })

    this.input.on('pointerup', () => {
      startY = 0
    })
  }

  async loadPropertyData() {
    try {
      // Try API first, fall back to local
      let owned = []
      let available = []

      try {
        const [apiOwned, apiAvailable] = await Promise.all([
          gameManager.getOwnedProperties().catch(() => null),
          gameManager.getAllProperties().catch(() => null)
        ])
        owned = apiOwned || []
        available = apiAvailable || []
      } catch (e) {
        console.log('[PropertyScene] API failed, using local data')
      }

      // If API failed or returned empty, use local data
      if (available.length === 0) {
        available = PROPERTIES
      }

      // Get owned properties from local storage
      const player = gameManager.player || getPlayerData() || {}
      if (owned.length === 0 && player.properties) {
        owned = player.properties
      }

      this.ownedProperties = (owned || []).map(p => ({
        ...p,
        pending_income: this.calculatePendingIncome(p)
      }))

      // Filter available to exclude owned
      const ownedIds = new Set(this.ownedProperties.map(p => p.id))
      this.availableProperties = (available || []).filter(p => !ownedIds.has(p.id))

      // Filter by player level / unlocked districts
      const playerLevel = player?.level || 1
      this.availableProperties = this.availableProperties.filter(p => {
        const minLevel = p.min_level || p.required_level || 1
        return playerLevel >= minLevel
      })

      this.isLoading = false
      this.loadingText?.destroy()
      this.updateBenefitsDisplay()
      this.renderContent()
    } catch (error) {
      console.error('Failed to load property data:', error)
      // Even on error, use local PROPERTIES
      this.availableProperties = PROPERTIES
      this.ownedProperties = []
      this.isLoading = false
      this.loadingText?.destroy()
      this.updateBenefitsDisplay()
      this.renderContent()
    }
  }

  calculatePendingIncome(property) {
    if (!property.last_collected || !property.income_per_hour) return 0

    const lastCollected = new Date(property.last_collected)
    const now = new Date()
    const hoursSince = (now - lastCollected) / (1000 * 60 * 60)

    // Cap at 24 hours of income
    const cappedHours = Math.min(hoursSince, 24)
    return Math.floor(cappedHours * property.income_per_hour)
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    if (this.activeTab === 'available') {
      this.renderAvailableTab()
    } else if (this.activeTab === 'manage') {
      this.renderManageTab()
    } else {
      this.renderOwnedTab()
    }
  }

  renderAvailableTab() {
    const { width, height } = this.cameras.main

    if (this.availableProperties.length === 0) {
      this.renderEmptyState('🏢', 'No Properties Available',
        'All properties in your unlocked districts are owned!\nLevel up to unlock more districts.')
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // District indicator
    const districtName = gameManager.player?.current_district?.name || 'Unknown'
    if (y > this.SCROLL_START_Y - 30) {
      const districtText = this.add.text(width / 2, Math.max(y, this.SCROLL_START_Y),
        `📍 Available in unlocked districts`, {
        fontSize: '12px',
        color: '#666666'
      }).setOrigin(0.5)
      this.contentItems.push(districtText)
    }

    y += 25

    // Render property cards
    this.availableProperties.forEach((property, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      // Only render visible cards
      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y && cardY < this.SCROLL_END_Y) {
        this.renderAvailablePropertyCard(property, cardY)
      }
    })
  }

  renderOwnedTab() {
    const { width, height } = this.cameras.main

    if (this.ownedProperties.length === 0) {
      this.renderEmptyState('🏠', 'No Properties Owned',
        'Purchase your first property from the Available tab!')
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // Income summary bar
    const totalIncome = this.ownedProperties.reduce((sum, p) => sum + (p.income_per_hour || 0), 0)
    const totalPending = this.ownedProperties.reduce((sum, p) => sum + (p.pending_income || 0), 0)

    if (y > this.SCROLL_START_Y - 60) {
      this.renderIncomeSummary(Math.max(y, this.SCROLL_START_Y), totalIncome, totalPending)
    }

    y += 65

    // Render property cards
    this.ownedProperties.forEach((property, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y && cardY < this.SCROLL_END_Y) {
        this.renderOwnedPropertyCard(property, cardY)
      }
    })
  }

  renderManageTab() {
    const { width, height } = this.cameras.main

    if (this.ownedProperties.length === 0) {
      this.renderEmptyState('⚙️', 'No Properties to Manage',
        'Purchase properties first to manage them!')
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // Management info panel
    const infoBg = this.add.rectangle(width / 2, y + 30, this.CARD_WIDTH, 55, 0x1a2a1a, 0.95)
      .setStrokeStyle(1, 0x22c55e)
      .setDepth(10)
    this.contentItems.push(infoBg)

    const infoTitle = this.add.text(25, y + 15, '⚙️ PROPERTY MANAGEMENT', {
      fontSize: '11px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(infoTitle)

    const infoDesc = this.add.text(25, y + 35, 'Sell properties for 50% of their current value', {
      fontSize: '10px',
      color: '#888888'
    }).setDepth(11)
    this.contentItems.push(infoDesc)

    y += 75

    // Render property cards with sell option
    this.ownedProperties.forEach((property, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y && cardY < this.SCROLL_END_Y) {
        this.renderManagePropertyCard(property, cardY)
      }
    })
  }

  renderManagePropertyCard(property, y) {
    const { width } = this.cameras.main
    const sellValue = Math.floor((property.price || 10000) * 0.5)

    const typeKey = (property.type || 'default').toLowerCase()
    const borderColor = this.TYPE_COLORS[typeKey] || this.TYPE_COLORS.default
    const icon = this.TYPE_ICONS[typeKey] || this.TYPE_ICONS.default

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e1e2e, 0.98)
    cardBg.setStrokeStyle(2, borderColor)
    this.contentItems.push(cardBg)

    // Type icon with background
    const iconBg = this.add.circle(45, y + 35, 22, borderColor, 0.2).setDepth(10)
    this.contentItems.push(iconBg)

    const iconText = this.add.text(45, y + 35, icon, { fontSize: '26px' }).setOrigin(0.5).setDepth(11)
    this.contentItems.push(iconText)

    // Property name
    const nameText = this.add.text(80, y + 18, property.name || `Property #${property.id}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(10)
    this.contentItems.push(nameText)

    // Type and level
    const infoText = this.add.text(80, y + 38, `${property.type || 'Unknown'} • Level ${property.level || 1}`, {
      fontSize: '10px',
      color: '#888888'
    }).setDepth(10)
    this.contentItems.push(infoText)

    // Stats
    let statsText = ''
    if (property.income_per_hour) statsText += `💰 ${formatMoney(property.income_per_hour)}/hr`
    if (property.heat_reduction) statsText += `  🔥 -${property.heat_reduction}%`

    const stats = this.add.text(80, y + 58, statsText, {
      fontSize: '10px',
      color: '#22c55e'
    }).setDepth(10)
    this.contentItems.push(stats)

    // Sell value display
    const sellLabel = this.add.text(80, y + 78, `Sell Value: ${formatMoney(sellValue)}`, {
      fontSize: '11px',
      color: '#f59e0b'
    }).setDepth(10)
    this.contentItems.push(sellLabel)

    // Sell button
    const sellBtn = this.add.rectangle(width - 55, y + this.CARD_HEIGHT / 2, 70, 40, 0xef4444)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
    this.contentItems.push(sellBtn)

    sellBtn.on('pointerover', () => sellBtn.setFillStyle(0xdc2626))
    sellBtn.on('pointerout', () => sellBtn.setFillStyle(0xef4444))
    sellBtn.on('pointerdown', () => this.showSellConfirmation(property, sellValue))

    const sellText = this.add.text(width - 55, y + this.CARD_HEIGHT / 2, 'SELL', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)
    this.contentItems.push(sellText)
  }

  showSellConfirmation(property, sellValue) {
    const { width, height } = this.cameras.main
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modal = this.add.rectangle(width / 2, height / 2, 280, 200, 0x1a1a3a, 0.98)
      .setStrokeStyle(2, 0xef4444)
      .setDepth(301)
    modalElements.push(modal)

    // Title
    const title = this.add.text(width / 2, height / 2 - 70, '⚠️ Sell Property?', {
      fontSize: '18px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(title)

    // Property name
    const icon = this.TYPE_ICONS[(property.type || 'default').toLowerCase()] || '🏢'
    const nameText = this.add.text(width / 2, height / 2 - 35, `${icon} ${property.name}`, {
      fontSize: '13px',
      color: '#cccccc'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(nameText)

    // Sell value
    const valueText = this.add.text(width / 2, height / 2, `You will receive: ${formatMoney(sellValue)}`, {
      fontSize: '14px',
      color: '#22c55e'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(valueText)

    // Warning
    const warningText = this.add.text(width / 2, height / 2 + 25, 'This cannot be undone!', {
      fontSize: '11px',
      color: '#ef4444'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(warningText)

    // Buttons
    const btnY = height / 2 + 65

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 - 65, btnY, 100, 36, 0x444444)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(cancelBtn)

    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x555555))
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x444444))
    cancelBtn.on('pointerdown', () => this.closeModal(modalElements))

    const cancelText = this.add.text(width / 2 - 65, btnY, 'Cancel', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(cancelText)

    // Confirm button
    const confirmBtn = this.add.rectangle(width / 2 + 65, btnY, 100, 36, 0xef4444)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(confirmBtn)

    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0xdc2626))
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0xef4444))
    confirmBtn.on('pointerdown', async () => {
      this.closeModal(modalElements)
      await this.sellProperty(property, sellValue)
    })

    const confirmText = this.add.text(width / 2 + 65, btnY, 'Sell', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(confirmText)
  }

  async sellProperty(property, sellValue) {
    try {
      const player = gameManager.player || getPlayerData()

      // Add sell value to cash
      player.cash = (player.cash || 0) + sellValue

      // Remove from owned properties locally
      this.ownedProperties = this.ownedProperties.filter(p => p.id !== property.id)

      // Try to sell via gameManager if available
      try {
        await gameManager.sellProperty(property.id)
      } catch (e) {
        // Fallback - just update local state
        console.log('Using local property sell')
      }

      // Save player data
      savePlayerData(player)
      gameManager.player = player

      // Update UI
      this.cashText.setText(`$ ${formatMoney(player.cash)}`)
      this.updateBenefitsDisplay()
      this.showSuccessToast(`Sold ${property.name} for ${formatMoney(sellValue)}!`)
      this.renderContent()

      try { audioManager.playCashGain(sellValue) } catch (e) { /* ignore */ }
    } catch (error) {
      this.showErrorToast(error.message || 'Sale failed')
    }
  }

  renderIncomeSummary(y, totalIncome, totalPending) {
    const { width } = this.cameras.main

    // Summary background
    const summaryBg = this.add.rectangle(width / 2, y + 22, this.CARD_WIDTH, 50, 0x1a1a3a, 0.95)
    this.contentItems.push(summaryBg)

    // Income text
    const incomeText = this.add.text(30, y + 10, `💰 ${formatMoney(totalIncome)}/hr total income`, {
      fontSize: '13px',
      color: COLORS.CASH
    })
    this.contentItems.push(incomeText)

    // Pending income
    if (totalPending > 0) {
      const pendingText = this.add.text(30, y + 30, `📥 ${formatMoney(totalPending)} ready to collect`, {
        fontSize: '12px',
        color: '#f59e0b'
      })
      this.contentItems.push(pendingText)

      // Collect All button
      const collectAllBtn = this.add.rectangle(width - 70, y + 22, 90, 36, 0x22c55e)
        .setInteractive({ useHandCursor: true })
      this.contentItems.push(collectAllBtn)

      collectAllBtn.on('pointerover', () => collectAllBtn.setFillStyle(0x16a34a))
      collectAllBtn.on('pointerout', () => collectAllBtn.setFillStyle(0x22c55e))
      collectAllBtn.on('pointerdown', () => this.collectAllIncome())

      const collectAllText = this.add.text(width - 70, y + 22, 'Collect All', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(collectAllText)
    }
  }

  renderAvailablePropertyCard(property, y) {
    const { width } = this.cameras.main
    const player = gameManager.player
    const canAfford = (player?.cash || 0) >= (property.price || 0)

    const typeKey = (property.type || 'default').toLowerCase()
    const borderColor = this.TYPE_COLORS[typeKey] || this.TYPE_COLORS.default
    const icon = this.TYPE_ICONS[typeKey] || this.TYPE_ICONS.default

    // Card background with colored border
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e1e2e, 0.98)
    cardBg.setStrokeStyle(2, borderColor)
    cardBg.setInteractive({ useHandCursor: true })
    this.contentItems.push(cardBg)

    // Type icon
    const iconText = this.add.text(35, y + 18, icon, { fontSize: '28px' })
    this.contentItems.push(iconText)

    // Property name
    const nameText = this.add.text(75, y + 12, property.name || `Property #${property.id}`, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentItems.push(nameText)

    // Type badge
    const typeBadge = this.add.rectangle(75 + nameText.width + 15, y + 18, 65, 18, borderColor, 0.9)
    this.contentItems.push(typeBadge)

    const typeLabel = this.add.text(75 + nameText.width + 15, y + 18, property.type || 'Unknown', {
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5)
    this.contentItems.push(typeLabel)

    // District
    const districtText = this.add.text(75, y + 35, `📍 ${property.district_name || property.district || 'Unknown'}`, {
      fontSize: '11px',
      color: '#888888'
    })
    this.contentItems.push(districtText)

    // Stats row
    const statsY = y + 55
    let statsX = 75

    if (property.income_per_hour) {
      const incText = this.add.text(statsX, statsY, `💰 ${formatMoney(property.income_per_hour)}/hr`, {
        fontSize: '11px',
        color: COLORS.CASH
      })
      this.contentItems.push(incText)
      statsX += 100
    }

    if (property.heat_reduction) {
      const heatText = this.add.text(statsX, statsY, `🔥 -${property.heat_reduction}%`, {
        fontSize: '11px',
        color: COLORS.INFO
      })
      this.contentItems.push(heatText)
      statsX += 70
    }

    if (property.storage_slots) {
      const storageText = this.add.text(statsX, statsY, `📦 +${property.storage_slots}`, {
        fontSize: '11px',
        color: COLORS.WARNING
      })
      this.contentItems.push(storageText)
    }

    // Price
    const priceText = this.add.text(75, y + 75, `Price: ${formatMoney(property.price || 0)}`, {
      fontSize: '13px',
      color: canAfford ? '#ffffff' : '#ef4444'
    })
    this.contentItems.push(priceText)

    // Buy button
    const buyBtn = this.add.rectangle(width - 55, y + this.CARD_HEIGHT / 2, 65, 36,
      canAfford ? 0x22c55e : 0x444444)
      .setInteractive({ useHandCursor: canAfford })
    this.contentItems.push(buyBtn)

    if (canAfford) {
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x16a34a))
      buyBtn.on('pointerout', () => buyBtn.setFillStyle(0x22c55e))
      buyBtn.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation()
        this.showPurchaseConfirmation(property)
      })
    }

    const buyText = this.add.text(width - 55, y + this.CARD_HEIGHT / 2, canAfford ? 'BUY' : '💸', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(buyText)

    // Click for details
    cardBg.on('pointerdown', () => this.showPropertyDetails(property, false))
  }

  renderOwnedPropertyCard(property, y) {
    const { width } = this.cameras.main
    const pending = property.pending_income || 0
    const hasPending = pending > 0

    const typeKey = (property.type || 'default').toLowerCase()
    const borderColor = this.TYPE_COLORS[typeKey] || this.TYPE_COLORS.default
    const icon = this.TYPE_ICONS[typeKey] || this.TYPE_ICONS.default

    // Card background with colored border
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e1e2e, 0.98)
    cardBg.setStrokeStyle(2, borderColor)
    cardBg.setInteractive({ useHandCursor: true })
    this.contentItems.push(cardBg)

    // Type icon
    const iconText = this.add.text(35, y + 18, icon, { fontSize: '28px' })
    this.contentItems.push(iconText)

    // Property name
    const nameText = this.add.text(75, y + 12, property.name || `Property #${property.id}`, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentItems.push(nameText)

    // Level badge
    const levelBadge = this.add.rectangle(75 + nameText.width + 15, y + 18, 45, 18, 0x3b82f6, 0.9)
    this.contentItems.push(levelBadge)

    const levelLabel = this.add.text(75 + nameText.width + 15, y + 18, `Lv.${property.level || 1}`, {
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5)
    this.contentItems.push(levelLabel)

    // Type and district
    const infoText = this.add.text(75, y + 35,
      `${property.type || 'Unknown'} • ${property.district_name || property.district || 'Unknown'}`, {
      fontSize: '11px',
      color: '#888888'
    })
    this.contentItems.push(infoText)

    // Stats row
    const statsY = y + 55
    let statsX = 75

    if (property.income_per_hour) {
      const incText = this.add.text(statsX, statsY, `💰 ${formatMoney(property.income_per_hour)}/hr`, {
        fontSize: '11px',
        color: COLORS.CASH
      })
      this.contentItems.push(incText)
      statsX += 100
    }

    if (property.heat_reduction) {
      const heatText = this.add.text(statsX, statsY, `🔥 -${property.heat_reduction}% heat`, {
        fontSize: '11px',
        color: COLORS.INFO
      })
      this.contentItems.push(heatText)
      statsX += 90
    }

    if (property.storage_slots) {
      const storageText = this.add.text(statsX, statsY, `📦 ${property.storage_slots} slots`, {
        fontSize: '11px',
        color: COLORS.WARNING
      })
      this.contentItems.push(storageText)
    }

    // Pending income indicator with animation
    if (hasPending) {
      const pendingBg = this.add.rectangle(75, y + 78, 120, 18, 0xf59e0b, 0.2).setOrigin(0, 0.5)
      this.contentItems.push(pendingBg)

      const pendingText = this.add.text(80, y + 78, `+${formatMoney(pending)} ready!`, {
        fontSize: '12px',
        color: '#f59e0b',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5)
      this.contentItems.push(pendingText)

      // Pulsing animation
      this.tweens.add({
        targets: pendingText,
        alpha: { from: 1, to: 0.6 },
        duration: 800,
        yoyo: true,
        repeat: -1
      })

      // Collect button
      const collectBtn = this.add.rectangle(width - 55, y + this.CARD_HEIGHT / 2, 65, 36, 0x22c55e)
        .setInteractive({ useHandCursor: true })
      this.contentItems.push(collectBtn)

      collectBtn.on('pointerover', () => collectBtn.setFillStyle(0x16a34a))
      collectBtn.on('pointerout', () => collectBtn.setFillStyle(0x22c55e))
      collectBtn.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation()
        this.collectIncome(property)
      })

      const collectText = this.add.text(width - 55, y + this.CARD_HEIGHT / 2, 'Collect', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(collectText)
    } else {
      // Upgrade button if not max level
      const maxLevel = property.max_level || property.max_upgrade || 10
      if ((property.level || 1) < maxLevel) {
        const upgradeCost = this.calculateUpgradeCost(property)
        const canAfford = (gameManager.player?.cash || 0) >= upgradeCost

        const upgradeBtn = this.add.rectangle(width - 55, y + this.CARD_HEIGHT / 2, 65, 36,
          canAfford ? 0x3b82f6 : 0x444444)
          .setInteractive({ useHandCursor: canAfford })
        this.contentItems.push(upgradeBtn)

        if (canAfford) {
          upgradeBtn.on('pointerover', () => upgradeBtn.setFillStyle(0x2563eb))
          upgradeBtn.on('pointerout', () => upgradeBtn.setFillStyle(0x3b82f6))
          upgradeBtn.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation()
            this.showUpgradeConfirmation(property, upgradeCost)
          })
        }

        const upgradeText = this.add.text(width - 55, y + this.CARD_HEIGHT / 2, '⬆️ Up', {
          fontSize: '12px',
          color: canAfford ? '#ffffff' : '#666666'
        }).setOrigin(0.5)
        this.contentItems.push(upgradeText)
      }
    }

    // Click for details
    cardBg.on('pointerdown', () => this.showPropertyDetails(property, true))
  }

  calculateUpgradeCost(property) {
    return property.upgrade_cost || Math.floor((property.price || 10000) * 0.5 * (property.level || 1))
  }

  renderEmptyState(icon, title, message) {
    const { width, height } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 50, icon, {
      fontSize: '56px'
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 10, title, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 50, message, {
      fontSize: '13px',
      color: '#888888',
      align: 'center',
      wordWrap: { width: this.CARD_WIDTH - 20 }
    }).setOrigin(0.5)
    this.contentItems.push(msgText)
  }

  showPropertyDetails(property, isOwned) {
    const { width, height } = this.cameras.main

    // Modal elements array for cleanup
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setInteractive()
      .setDepth(200)
    modalElements.push(overlay)

    // Modal
    const modalHeight = 320
    const modal = this.add.rectangle(width / 2, height / 2, this.CARD_WIDTH + 20, modalHeight, 0x1a1a3a, 0.98)
      .setDepth(201)
    modal.setStrokeStyle(2, this.TYPE_COLORS[(property.type || 'default').toLowerCase()] || 0x6b7280)
    modalElements.push(modal)

    // Header
    const icon = this.TYPE_ICONS[(property.type || 'default').toLowerCase()] || '🏢'
    const headerText = this.add.text(width / 2, height / 2 - modalHeight / 2 + 30,
      `${icon} ${property.name}`, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(headerText)

    // Close button
    const closeBtn = this.add.text(width / 2 + this.CARD_WIDTH / 2 - 5, height / 2 - modalHeight / 2 + 20, '✕', {
      fontSize: '20px',
      color: '#888888'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202)
    modalElements.push(closeBtn)

    // Type badge
    const typeBadge = this.add.rectangle(width / 2, height / 2 - modalHeight / 2 + 60, 80, 22,
      this.TYPE_COLORS[(property.type || 'default').toLowerCase()], 0.9).setDepth(202)
    modalElements.push(typeBadge)

    const typeText = this.add.text(width / 2, height / 2 - modalHeight / 2 + 60, property.type || 'Unknown', {
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(typeText)

    // Description based on type
    const descriptions = {
      business: 'Generates passive cash income every hour.',
      safehouse: 'Reduces your heat passively and provides extra storage.',
      front: 'Launders dirty money, converting heat to clean cash.'
    }
    const desc = descriptions[(property.type || '').toLowerCase()] || 'A property in the city.'
    const descText = this.add.text(width / 2, height / 2 - modalHeight / 2 + 90, desc, {
      fontSize: '12px',
      color: '#888888',
      wordWrap: { width: this.CARD_WIDTH - 40 },
      align: 'center'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(descText)

    // Stats section
    const statsStartY = height / 2 - modalHeight / 2 + 120
    const statsX = width / 2 - this.CARD_WIDTH / 2 + 30

    const stats = [
      { label: 'District', value: property.district_name || property.district || 'Unknown' },
      isOwned ? { label: 'Level', value: `${property.level || 1} / ${property.max_level || 10}` } : null,
      property.income_per_hour ? { label: 'Income', value: `${formatMoney(property.income_per_hour)}/hr`, color: COLORS.CASH } : null,
      property.heat_reduction ? { label: 'Heat Reduction', value: `-${property.heat_reduction}%`, color: COLORS.INFO } : null,
      property.storage_slots ? { label: 'Extra Storage', value: `+${property.storage_slots} slots`, color: COLORS.WARNING } : null,
      property.price ? { label: isOwned ? 'Value' : 'Price', value: formatMoney(property.price) } : null
    ].filter(Boolean)

    stats.forEach((stat, i) => {
      const labelText = this.add.text(statsX, statsStartY + i * 25, stat.label + ':', {
        fontSize: '13px',
        color: '#888888'
      }).setDepth(202)
      modalElements.push(labelText)

      const valueText = this.add.text(statsX + 120, statsStartY + i * 25, stat.value, {
        fontSize: '13px',
        color: stat.color || '#ffffff'
      }).setDepth(202)
      modalElements.push(valueText)
    })

    // Action buttons
    const btnY = height / 2 + modalHeight / 2 - 45

    if (isOwned) {
      const pending = property.pending_income || 0
      if (pending > 0) {
        // Collect button
        const collectBtn = this.add.rectangle(width / 2 - 60, btnY, 110, 38, 0x22c55e)
          .setInteractive({ useHandCursor: true }).setDepth(202)
        modalElements.push(collectBtn)

        collectBtn.on('pointerover', () => collectBtn.setFillStyle(0x16a34a))
        collectBtn.on('pointerout', () => collectBtn.setFillStyle(0x22c55e))
        collectBtn.on('pointerdown', () => {
          this.collectIncome(property)
          this.closeModal(modalElements)
        })

        const collectText = this.add.text(width / 2 - 60, btnY, `Collect ${formatMoney(pending)}`, {
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203)
        modalElements.push(collectText)
      }

      // Upgrade button
      const maxLevel = property.max_level || 10
      if ((property.level || 1) < maxLevel) {
        const upgradeCost = this.calculateUpgradeCost(property)
        const canAfford = (gameManager.player?.cash || 0) >= upgradeCost

        const upgradeBtn = this.add.rectangle(width / 2 + 60, btnY, 110, 38, canAfford ? 0x3b82f6 : 0x444444)
          .setInteractive({ useHandCursor: canAfford }).setDepth(202)
        modalElements.push(upgradeBtn)

        if (canAfford) {
          upgradeBtn.on('pointerover', () => upgradeBtn.setFillStyle(0x2563eb))
          upgradeBtn.on('pointerout', () => upgradeBtn.setFillStyle(0x3b82f6))
          upgradeBtn.on('pointerdown', () => {
            this.closeModal(modalElements)
            this.showUpgradeConfirmation(property, upgradeCost)
          })
        }

        const upgradeText = this.add.text(width / 2 + 60, btnY, `⬆️ ${formatMoney(upgradeCost)}`, {
          fontSize: '11px',
          color: canAfford ? '#ffffff' : '#666666'
        }).setOrigin(0.5).setDepth(203)
        modalElements.push(upgradeText)
      }
    } else {
      // Buy button
      const canAfford = (gameManager.player?.cash || 0) >= (property.price || 0)

      const buyBtn = this.add.rectangle(width / 2, btnY, 140, 42, canAfford ? 0x22c55e : 0x444444)
        .setInteractive({ useHandCursor: canAfford }).setDepth(202)
      modalElements.push(buyBtn)

      if (canAfford) {
        buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x16a34a))
        buyBtn.on('pointerout', () => buyBtn.setFillStyle(0x22c55e))
        buyBtn.on('pointerdown', () => {
          this.closeModal(modalElements)
          this.showPurchaseConfirmation(property)
        })
      }

      const buyText = this.add.text(width / 2, btnY,
        canAfford ? `Buy for ${formatMoney(property.price)}` : 'Not Enough Cash', {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(203)
      modalElements.push(buyText)
    }

    // Close handlers
    const closeModal = () => this.closeModal(modalElements)
    closeBtn.on('pointerdown', closeModal)
    overlay.on('pointerdown', closeModal)
  }

  showPurchaseConfirmation(property) {
    const { width, height } = this.cameras.main
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modal = this.add.rectangle(width / 2, height / 2, 280, 180, 0x1a1a3a, 0.98)
      .setDepth(301)
    modal.setStrokeStyle(2, 0x22c55e)
    modalElements.push(modal)

    // Title
    const title = this.add.text(width / 2, height / 2 - 60, 'Confirm Purchase', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(title)

    // Property name
    const icon = this.TYPE_ICONS[(property.type || 'default').toLowerCase()] || '🏢'
    const nameText = this.add.text(width / 2, height / 2 - 25, `${icon} ${property.name}`, {
      fontSize: '14px',
      color: '#cccccc'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(nameText)

    // Price
    const priceText = this.add.text(width / 2, height / 2, `Price: ${formatMoney(property.price)}`, {
      fontSize: '16px',
      color: COLORS.CASH
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(priceText)

    // Buttons
    const btnY = height / 2 + 50

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 - 65, btnY, 100, 36, 0x444444)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(cancelBtn)

    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x555555))
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x444444))
    cancelBtn.on('pointerdown', () => this.closeModal(modalElements))

    const cancelText = this.add.text(width / 2 - 65, btnY, 'Cancel', {
      fontSize: '13px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(cancelText)

    // Confirm button
    const confirmBtn = this.add.rectangle(width / 2 + 65, btnY, 100, 36, 0x22c55e)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(confirmBtn)

    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0x16a34a))
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0x22c55e))
    confirmBtn.on('pointerdown', async () => {
      this.closeModal(modalElements)
      await this.purchaseProperty(property)
    })

    const confirmText = this.add.text(width / 2 + 65, btnY, 'Buy', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(confirmText)
  }

  showUpgradeConfirmation(property, cost) {
    const { width, height } = this.cameras.main
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modal = this.add.rectangle(width / 2, height / 2, 280, 200, 0x1a1a3a, 0.98)
      .setDepth(301)
    modal.setStrokeStyle(2, 0x3b82f6)
    modalElements.push(modal)

    // Title
    const title = this.add.text(width / 2, height / 2 - 70, 'Upgrade Property', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(title)

    // Property name
    const nameText = this.add.text(width / 2, height / 2 - 40, property.name, {
      fontSize: '14px',
      color: '#cccccc'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(nameText)

    // Level change
    const currentLevel = property.level || 1
    const levelText = this.add.text(width / 2, height / 2 - 10,
      `Level ${currentLevel} → Level ${currentLevel + 1}`, {
      fontSize: '14px',
      color: '#3b82f6'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(levelText)

    // Cost
    const costText = this.add.text(width / 2, height / 2 + 20, `Cost: ${formatMoney(cost)}`, {
      fontSize: '16px',
      color: COLORS.WARNING
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(costText)

    // Buttons
    const btnY = height / 2 + 65

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 - 65, btnY, 100, 36, 0x444444)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(cancelBtn)

    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x555555))
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x444444))
    cancelBtn.on('pointerdown', () => this.closeModal(modalElements))

    const cancelText = this.add.text(width / 2 - 65, btnY, 'Cancel', {
      fontSize: '13px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(cancelText)

    // Confirm button
    const confirmBtn = this.add.rectangle(width / 2 + 65, btnY, 100, 36, 0x3b82f6)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(confirmBtn)

    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0x2563eb))
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0x3b82f6))
    confirmBtn.on('pointerdown', async () => {
      this.closeModal(modalElements)
      await this.upgradeProperty(property)
    })

    const confirmText = this.add.text(width / 2 + 65, btnY, 'Upgrade', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(confirmText)
  }

  closeModal(elements) {
    elements.forEach(el => el.destroy())
  }

  showSuccessToast(message) {
    const { width } = this.cameras.main

    const toastBg = this.add.rectangle(width / 2, 170, 260, 40, 0x22c55e, 0.95).setDepth(400)
    const toastText = this.add.text(width / 2, 170, message, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(401)

    // Animate in
    toastBg.setAlpha(0).setY(140)
    toastText.setAlpha(0).setY(140)

    this.tweens.add({
      targets: [toastBg, toastText],
      alpha: 1,
      y: 170,
      duration: 200,
      ease: 'Power2'
    })

    // Animate out
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [toastBg, toastText],
        alpha: 0,
        y: 140,
        duration: 300,
        onComplete: () => {
          toastBg.destroy()
          toastText.destroy()
        }
      })
    })
  }

  showErrorToast(message) {
    const { width } = this.cameras.main

    const toastBg = this.add.rectangle(width / 2, 170, 280, 40, 0xef4444, 0.95).setDepth(400)
    const toastText = this.add.text(width / 2, 170, message, {
      fontSize: '13px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(401)

    toastBg.setAlpha(0).setY(140)
    toastText.setAlpha(0).setY(140)

    this.tweens.add({
      targets: [toastBg, toastText],
      alpha: 1,
      y: 170,
      duration: 200
    })

    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [toastBg, toastText],
        alpha: 0,
        y: 140,
        duration: 300,
        onComplete: () => {
          toastBg.destroy()
          toastText.destroy()
        }
      })
    })
  }

  async purchaseProperty(property) {
    try {
      await gameManager.buyProperty(property.id)
      this.showSuccessToast(`Purchased ${property.name}!`)
      this.cashText.setText(`Cash: ${formatMoney(gameManager.player?.cash || 0)}`)
      await this.loadPropertyData()
      this.switchTab('owned')

      // Check for property achievements
      this.checkAchievements()
    } catch (error) {
      console.log('[PropertyScene] API failed, purchasing locally')
      this.purchasePropertyLocal(property)
    }
  }

  purchasePropertyLocal(property) {
    const player = gameManager.player || getPlayerData() || {}
    const price = property.price || 10000

    if ((player.cash || 0) < price) {
      this.showErrorToast('Not enough cash!')
      return
    }

    // Deduct cash
    player.cash = (player.cash || 0) - price

    // Add to owned properties
    if (!player.properties) player.properties = []
    const ownedProperty = {
      ...property,
      purchased_at: Date.now(),
      last_collected: Date.now(),
      level: 1
    }
    player.properties.push(ownedProperty)

    // Save and update
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    this.showSuccessToast(`Purchased ${property.name}!`)
    this.cashText.setText(`$ ${formatMoney(player.cash)}`)
    this.loadPropertyData()
    this.switchTab('owned')
  }

  async checkAchievements() {
    try {
      achievementPopup.setScene(this)
      const result = await gameManager.checkAchievements()
      if (result?.new_achievements?.length > 0) {
        achievementPopup.showMultiple(result.new_achievements)
      }
    } catch (error) {
      console.error('Failed to check achievements:', error)
    }
  }

  async upgradeProperty(property) {
    try {
      await gameManager.upgradeProperty(property.id)
      this.showSuccessToast(`${property.name} upgraded!`)
      this.cashText.setText(`Cash: ${formatMoney(gameManager.player?.cash || 0)}`)
      await this.loadPropertyData()
    } catch (error) {
      this.showErrorToast(error.message || 'Upgrade failed')
    }
  }

  async collectIncome(property) {
    try {
      await gameManager.collectPropertyIncome(property.id)
      this.showSuccessToast(`Collected ${formatMoney(property.pending_income)}!`)
      this.cashText.setText(`Cash: ${formatMoney(gameManager.player?.cash || 0)}`)
      await this.loadPropertyData()
    } catch (error) {
      console.log('[PropertyScene] API failed, collecting locally')
      this.collectIncomeLocal(property)
    }
  }

  collectIncomeLocal(property) {
    const player = gameManager.player || getPlayerData() || {}
    const income = property.pending_income || 0

    if (income <= 0) {
      this.showErrorToast('No income to collect!')
      return
    }

    // Add income to cash
    player.cash = (player.cash || 0) + income
    player.totalEarnings = (player.totalEarnings || 0) + income

    // Update last collected time
    if (player.properties) {
      const ownedProp = player.properties.find(p => p.id === property.id)
      if (ownedProp) {
        ownedProp.last_collected = Date.now()
      }
    }

    // Save and update
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    try { audioManager.playCashGain(income) } catch (e) { /* ignore */ }
    this.showSuccessToast(`Collected ${formatMoney(income)}!`)
    this.cashText.setText(`$ ${formatMoney(player.cash)}`)
    this.loadPropertyData()
  }

  async collectAllIncome() {
    try {
      const totalPending = this.ownedProperties.reduce((sum, p) => sum + (p.pending_income || 0), 0)
      await gameManager.collectAllPropertyIncome()
      this.showSuccessToast(`Collected ${formatMoney(totalPending)}!`)
      this.cashText.setText(`Cash: ${formatMoney(gameManager.player?.cash || 0)}`)
      await this.loadPropertyData()
    } catch (error) {
      this.showErrorToast(error.message || 'Collection failed')
    }
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
