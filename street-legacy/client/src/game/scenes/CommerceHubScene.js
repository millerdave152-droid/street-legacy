/**
 * CommerceHubScene - Consolidated Trade/Properties/Bank Hub
 *
 * Part of the OS-style dashboard redesign.
 * Combines all economy operations into a single tabbed interface.
 */

import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { SceneReadinessManager } from '../managers/SceneReadinessManager'
import { TRADING_GOODS, PROPERTIES, getPlayerData, savePlayerData } from '../data/GameData.js'
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'

export class CommerceHubScene extends BaseScene {
  constructor() {
    super('CommerceHubScene')
    this.activeTab = 'trade' // 'trade' | 'properties' | 'bank'
    this.contentItems = []
    this.tabButtons = []
    this.scrollY = 0
    this.readiness = null // SceneReadinessManager instance
  }

  /**
   * Get dynamic trading prices from localStorage cache
   * These are the same prices TradingScene generates and caches
   */
  getDynamicTradingPrices() {
    try {
      const stored = localStorage.getItem('street_legacy_trading')
      if (stored) {
        const tradingData = JSON.parse(stored)
        return tradingData.prices || {}
      }
    } catch (e) {
      console.warn('[CommerceHubScene] Failed to load trading prices:', e)
    }
    return {}
  }

  init(data) {
    super.init(data)
    console.log('[CommerceHubScene] init() called with data:', JSON.stringify(data || {}))
    console.log('[CommerceHubScene] returnScene:', data?.returnScene)

    // Create readiness manager for proper lifecycle handling
    this.readiness = new SceneReadinessManager(this)

    if (data?.tab) {
      this.activeTab = data.tab
    }
  }

  async create() {
    console.log('[CommerceHubScene] create() started')
    super.create({ skipIntro: true })

    // CRITICAL: Block input until scene is fully ready
    this.readiness.beginCreate()

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()
    console.log('[CommerceHubScene] Brought self to top of scene stack')

    const { width, height } = this.cameras.main

    // Pause UIScene - we have our own header/UI
    this.readiness.pauseUIScene()

    // Full screen background (NOT interactive - allows clicks to pass through to elements)
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(DEPTH.BACKGROUND)

    // Background pattern
    this.createBackgroundPattern()

    // Play scene intro
    networkTransition.playSceneIntro(this, 'CommerceHubScene')

    // Header
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Balance overview
    this.createBalanceOverview()

    // Tab bar
    this.createTabBar()

    // AWAIT content loading (like CrimeScene does)
    try {
      await this.loadContent()
      console.log('[CommerceHubScene] Content loaded successfully')
    } catch (error) {
      console.error('[CommerceHubScene] Failed to load content:', error)
    }

    // CRITICAL: Mark scene ready - this enables input after a short delay
    await this.readiness.markReady(100)

    // Emit sceneReady for NetworkTransition coordination
    this.events.emit('sceneReady')
    console.log('[CommerceHubScene] create() completed, scene fully ready')

    // Handle scene resume/pause for input management
    this.events.on('resume', () => {
      console.log('[CommerceHubScene] Scene resumed')
      this.input.enabled = true
    })

    this.events.on('pause', () => {
      console.log('[CommerceHubScene] Scene paused')
      this.input.enabled = false
    })
  }

  createBackgroundPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(DEPTH.GRID)

    // Grid pattern with green tint for commerce
    graphics.lineStyle(1, 0x00FF88, 0.1)
    const gridSize = 40
    for (let x = 0; x < width; x += gridSize) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.moveTo(0, y)
      graphics.lineTo(width, y)
    }
    graphics.strokePath()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background
    this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(DEPTH.CONTENT_BASE)

    // Green accent line (commerce = money color)
    this.add.rectangle(width / 2, 68, width, 2, 0x00FF88, 0.8)
      .setDepth(DEPTH.CONTENT_BASE)

    // Icon
    const icon = this.add.text(width / 2 - 115, 28, '[$]', {
      ...getTerminalStyle('lg'),
      color: '#00FF88'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Animate icon
    this.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0.6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Title
    this.add.text(width / 2, 28, 'COMMERCE TERMINAL', {
      ...getTerminalStyle('xl'),
      color: '#00FF88'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Subtitle
    this.add.text(width / 2, 52, `${SYMBOLS.system} TRADE • PROPERTIES • BANKING`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.secondary)
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#00FF88')
      closeBtn.setScale(1.2)
      audioManager.playHover()
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.secondary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })
  }

  createBalanceOverview() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Balance bar background
    const barY = 85
    this.add.rectangle(width / 2, barY, width - 20, 30, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x00FF88, 0.3)
      .setDepth(DEPTH.CONTENT_BASE)

    // Cash on hand
    this.add.text(25, barY, '[$] CASH:', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)

    this.cashText = this.add.text(90, barY, formatMoney(player.cash || 0), {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.gold)
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Bank balance
    this.add.text(width / 2 + 10, barY, '[B] BANK:', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)

    this.bankText = this.add.text(width / 2 + 80, barY, formatMoney(player.bank || 0), {
      ...getTerminalStyle('sm'),
      color: '#0D9488'
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)
  }

  createTabBar() {
    const { width } = this.cameras.main
    const tabY = 118
    const tabWidth = (width - 40) / 3

    const tabs = [
      { key: 'trade', label: 'TRADE', icon: '[T]', color: 0x22C55E },
      { key: 'properties', label: 'PROPS', icon: '[P]', color: 0x7C3AED },
      { key: 'bank', label: 'BANK', icon: '[B]', color: 0x0D9488 }
    ]

    // Tab bar background
    this.add.rectangle(width / 2, tabY, width - 20, 32, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, COLORS.network.dim, 0.3)
      .setDepth(DEPTH.CONTENT_BASE)

    this.tabButtons = []

    tabs.forEach((tab, index) => {
      const x = 20 + tabWidth / 2 + index * tabWidth

      const isActive = this.activeTab === tab.key
      const tabBg = this.add.rectangle(x, tabY, tabWidth - 4, 28,
        isActive ? tab.color : COLORS.bg.card,
        isActive ? 0.3 : 0.6
      )
        .setStrokeStyle(isActive ? 2 : 1, tab.color, isActive ? 0.8 : 0.3)
        .setDepth(DEPTH.PANEL_CONTENT)
        .setInteractive({ useHandCursor: true })

      const tabLabel = this.add.text(x, tabY, `${tab.icon} ${tab.label}`, {
        ...getTextStyle('sm', isActive ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
        fontStyle: isActive ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)

      tabBg.on('pointerover', () => {
        if (this.activeTab !== tab.key) {
          tabBg.setFillStyle(tab.color, 0.15)
          tabLabel.setColor(toHexString(COLORS.text.primary))
          audioManager.playHover()
        }
      })

      tabBg.on('pointerout', () => {
        if (this.activeTab !== tab.key) {
          tabBg.setFillStyle(COLORS.bg.card, 0.6)
          tabLabel.setColor(toHexString(COLORS.text.muted))
        }
      })

      tabBg.on('pointerdown', () => {
        if (this.activeTab !== tab.key) {
          audioManager.playClick()
          this.switchTab(tab.key)
        }
      })

      this.tabButtons.push({ key: tab.key, bg: tabBg, label: tabLabel, color: tab.color })
    })
  }

  switchTab(tabKey) {
    this.activeTab = tabKey

    // Update tab visuals
    this.tabButtons.forEach(tab => {
      const isActive = tab.key === tabKey
      tab.bg.setFillStyle(isActive ? tab.color : COLORS.bg.card, isActive ? 0.3 : 0.6)
      tab.bg.setStrokeStyle(isActive ? 2 : 1, tab.color, isActive ? 0.8 : 0.3)
      tab.label.setColor(toHexString(isActive ? COLORS.text.primary : COLORS.text.muted))
      tab.label.setFontStyle(isActive ? 'bold' : 'normal')
    })

    // Reload content
    this.loadContent()
  }

  async loadContent() {
    // Clear existing content
    this.clearContent()

    const { width, height } = this.cameras.main
    const startY = 150

    // Loading indicator
    const loadingText = this.add.text(width / 2, height / 2, `${SYMBOLS.system} LOADING...`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(150)
    this.contentItems.push(loadingText)

    // Wait a brief moment then render content
    await new Promise(resolve => this.time.delayedCall(100, resolve))

    loadingText.destroy()

    switch (this.activeTab) {
      case 'trade':
        this.renderTradeContent(startY)
        break
      case 'properties':
        this.renderPropertiesContent(startY)
        break
      case 'bank':
        this.renderBankContent(startY)
        break
    }
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []
  }

  renderTradeContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}
    const playerLevel = player.level || 1

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} MARKET GOODS`, {
      ...getTerminalStyle('sm'),
      color: '#22C55E'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Hint
    const hintText = this.add.text(width - 25, startY, 'Tap to open market →', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(hintText)

    // Available goods with dynamic prices
    const dynamicPrices = this.getDynamicTradingPrices()
    const goods = TRADING_GOODS.filter(g => playerLevel >= g.min_level).map(good => ({
      ...good,
      currentBuyPrice: dynamicPrices[good.id]?.buyPrice || good.buy_price,
      currentSellPrice: dynamicPrices[good.id]?.sellPrice || good.sell_price,
      trend: dynamicPrices[good.id]?.trend || 'stable'
    }))
    const cardHeight = 65
    const cardSpacing = 6

    if (goods.length === 0) {
      const noDataText = this.add.text(width / 2, height / 2, 'No goods available at your level', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noDataText)
      return
    }

    goods.slice(0, 6).forEach((good, index) => {
      const y = startY + 30 + index * (cardHeight + cardSpacing)
      this.createGoodCard(good, y, cardHeight)
    })

    // View all button
    if (goods.length > 6) {
      const btnY = startY + 30 + 6 * (cardHeight + cardSpacing) + 10
      this.createActionButton(width / 2, btnY, `View All ${goods.length} Goods`, 0x22C55E, () => {
        this.openFullScene('TradingScene')
      })
    }
  }

  createGoodCard(good, y, cardHeight) {
    const { width } = this.cameras.main

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, 0x22C55E, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    // Card interaction
    card.on('pointerover', () => {
      card.setStrokeStyle(2, 0x22C55E, 0.7)
      audioManager.playHover()
    })
    card.on('pointerout', () => {
      card.setStrokeStyle(1, 0x22C55E, 0.4)
    })
    card.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('TradingScene')
    })

    // Left accent
    const accent = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, 0x22C55E)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accent)

    // Good name
    const nameText = this.add.text(35, y + 12, good.name, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(nameText)

    // Risk level
    const riskColors = { low: 0x22C55E, medium: 0xF59E0B, high: 0xEF4444 }
    const riskText = this.add.text(35, y + 32, `Risk: ${good.risk.toUpperCase()}`, {
      ...getTextStyle('xs', riskColors[good.risk] || COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(riskText)

    // Prices (dynamic from market)
    const trendIcons = { up: '^', down: 'v', stable: '-' }
    const trendColors = { up: 0x22C55E, down: 0xEF4444, stable: 0x888888 }
    const trendIcon = trendIcons[good.trend] || '-'
    const trendColor = trendColors[good.trend] || COLORS.text.muted

    const buyText = this.add.text(width - 100, y + 15, `BUY: ${formatMoney(good.currentBuyPrice || good.buy_price)}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(0, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(buyText)

    const sellText = this.add.text(width - 100, y + 32, `SELL: ${formatMoney(good.currentSellPrice || good.sell_price)} ${trendIcon}`, {
      ...getTextStyle('xs', trendColor, 'terminal')
    }).setOrigin(0, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(sellText)
  }

  renderPropertiesContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}
    const playerLevel = player.level || 1
    const ownedProps = player.ownedProperties || []

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} REAL ESTATE`, {
      ...getTerminalStyle('sm'),
      color: '#7C3AED'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Owned count
    const ownedText = this.add.text(width - 25, startY, `Owned: ${ownedProps.length}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(ownedText)

    // Available properties
    const availableProps = PROPERTIES.filter(p => playerLevel >= p.min_level && !ownedProps.includes(p.id))
    const cardHeight = 70
    const cardSpacing = 6

    if (availableProps.length === 0 && ownedProps.length === 0) {
      const noDataText = this.add.text(width / 2, height / 2, 'No properties available', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noDataText)
      return
    }

    availableProps.slice(0, 5).forEach((prop, index) => {
      const y = startY + 30 + index * (cardHeight + cardSpacing)
      this.createPropertyCard(prop, y, cardHeight)
    })

    // View all button
    const btnY = startY + 30 + Math.min(5, availableProps.length) * (cardHeight + cardSpacing) + 10
    this.createActionButton(width / 2, btnY, 'View All Properties', 0x7C3AED, () => {
      this.openFullScene('PropertyScene')
    })
  }

  createPropertyCard(prop, y, cardHeight) {
    const { width } = this.cameras.main

    const typeColors = {
      business: 0x22C55E,
      safehouse: 0x3B82F6,
      front: 0x8B5CF6
    }
    const propColor = typeColors[prop.type] || 0x7C3AED

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, propColor, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    card.on('pointerover', () => {
      card.setStrokeStyle(2, propColor, 0.7)
      audioManager.playHover()
    })
    card.on('pointerout', () => {
      card.setStrokeStyle(1, propColor, 0.4)
    })
    card.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('PropertyScene')
    })

    // Left accent
    const accent = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, propColor)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accent)

    // Type icon
    const typeIcons = { business: '[B]', safehouse: '[S]', front: '[F]' }
    const iconText = this.add.text(40, y + 18, typeIcons[prop.type] || '[P]', {
      ...getTerminalStyle('md'),
      color: toHexString(propColor)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(iconText)

    // Property name
    const nameText = this.add.text(60, y + 12, prop.name, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(nameText)

    // Benefits
    let benefitStr = ''
    if (prop.income_per_hour) benefitStr += `+${formatMoney(prop.income_per_hour)}/hr `
    if (prop.heat_reduction) benefitStr += `-${prop.heat_reduction}% heat`
    const benefitText = this.add.text(60, y + 32, benefitStr || 'No passive benefits', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(benefitText)

    // Price
    const priceText = this.add.text(width - 35, y + cardHeight / 2, formatMoney(prop.price), {
      ...getTextStyle('sm', COLORS.text.gold, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(priceText)
  }

  renderBankContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} FINANCIAL SERVICES`, {
      ...getTerminalStyle('sm'),
      color: '#0D9488'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Bank overview cards
    const cardWidth = (width - 45) / 2
    const cardY = startY + 55

    // Savings card
    const savingsCard = this.add.rectangle(20 + cardWidth / 2, cardY, cardWidth, 70, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, 0x0D9488, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(savingsCard)

    savingsCard.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('BankScene')
    })

    const savingsLabel = this.add.text(20 + cardWidth / 2, cardY - 18, '[B] SAVINGS', {
      ...getTerminalStyle('xs'),
      color: '#0D9488'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(savingsLabel)

    const savingsValue = this.add.text(20 + cardWidth / 2, cardY + 8, formatMoney(player.bank || 0), {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(savingsValue)

    const interestText = this.add.text(20 + cardWidth / 2, cardY + 25, '+0.5%/day interest', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(interestText)

    // Loans card
    const loanCard = this.add.rectangle(width - 20 - cardWidth / 2, cardY, cardWidth, 70, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, 0xEF4444, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(loanCard)

    loanCard.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('BankScene')
    })

    const loanLabel = this.add.text(width - 20 - cardWidth / 2, cardY - 18, '[L] LOANS', {
      ...getTerminalStyle('xs'),
      color: '#EF4444'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(loanLabel)

    const loanValue = this.add.text(width - 20 - cardWidth / 2, cardY + 8, formatMoney(player.loan || 0), {
      ...getTerminalStyle('lg'),
      color: player.loan > 0 ? '#EF4444' : toHexString(COLORS.text.primary)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(loanValue)

    const loanRateText = this.add.text(width - 20 - cardWidth / 2, cardY + 25, '5%/day interest', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(loanRateText)

    // Quick actions
    const actionsY = cardY + 70

    const actionsHeader = this.add.text(25, actionsY, `${SYMBOLS.system} QUICK ACTIONS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(actionsHeader)

    // Action buttons
    const btnWidth = (width - 45) / 2
    const btnY = actionsY + 35

    // Deposit button
    this.createQuickActionButton(20 + btnWidth / 2, btnY, 'DEPOSIT', 0x22C55E, () => {
      this.openFullScene('BankScene')
    })

    // Withdraw button
    this.createQuickActionButton(width - 20 - btnWidth / 2, btnY, 'WITHDRAW', 0x3B82F6, () => {
      this.openFullScene('BankScene')
    })

    // Gambling section
    const gambleY = btnY + 55

    const gambleHeader = this.add.text(25, gambleY, `${SYMBOLS.system} GAMBLING`, {
      ...getTerminalStyle('xs'),
      color: '#F59E0B'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(gambleHeader)

    const gambleCard = this.add.rectangle(width / 2, gambleY + 45, width - 30, 50, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, 0xF59E0B, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(gambleCard)

    gambleCard.on('pointerover', () => {
      gambleCard.setStrokeStyle(2, 0xF59E0B, 0.7)
      audioManager.playHover()
    })
    gambleCard.on('pointerout', () => {
      gambleCard.setStrokeStyle(1, 0xF59E0B, 0.4)
    })
    gambleCard.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('BankScene')
    })

    const gambleIcon = this.add.text(45, gambleY + 45, '[G]', {
      ...getTerminalStyle('lg'),
      color: '#F59E0B'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(gambleIcon)

    const gambleText = this.add.text(70, gambleY + 38, 'CASINO', {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(gambleText)

    const gambleSubtext = this.add.text(70, gambleY + 52, 'Coin flip, dice, high stakes', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(gambleSubtext)

    const gambleArrow = this.add.text(width - 40, gambleY + 45, '>', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(gambleArrow)
  }

  createQuickActionButton(x, y, label, color, onClick) {
    const { width } = this.cameras.main
    const btnWidth = (width - 45) / 2

    const btn = this.add.rectangle(x, y, btnWidth, 35, color, 0.2)
      .setStrokeStyle(1, color, 0.5)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(btn)

    btn.on('pointerover', () => {
      btn.setFillStyle(color, 0.35)
      audioManager.playHover()
    })
    btn.on('pointerout', () => {
      btn.setFillStyle(color, 0.2)
    })
    btn.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    const btnLabel = this.add.text(x, y, label, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(btnLabel)
  }

  createActionButton(x, y, label, color, onClick) {
    const btn = this.add.rectangle(x, y, 200, 40, color, 0.2)
      .setStrokeStyle(2, color, 0.6)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(btn)

    btn.on('pointerover', () => {
      btn.setFillStyle(color, 0.35)
      btn.setStrokeStyle(2, color, 0.9)
      audioManager.playHover()
    })
    btn.on('pointerout', () => {
      btn.setFillStyle(color, 0.2)
      btn.setStrokeStyle(2, color, 0.6)
    })
    btn.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    const btnLabel = this.add.text(x, y, label, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(btnLabel)
  }

  openFullScene(sceneName) {
    console.log(`[CommerceHubScene] Navigating to ${sceneName}`)

    // Resume UIScene before transitioning - original scenes expect it to be active
    try {
      this.scene.resume('UIScene')
    } catch (e) {
      console.error('[CommerceHubScene] Failed to resume UIScene:', e)
    }

    // DO NOT resume GameScene here - keep it paused with input disabled
    // The target scene will handle returning to GameScene when done

    // Use scene.start() for cleaner transition to sub-scenes
    this.scene.start(sceneName)
  }

  closeScene() {
    console.log('[CommerceHubScene] closeScene() called')

    const returnScene = this.initData?.returnScene || 'GameScene'
    console.log('[CommerceHubScene] Returning to:', returnScene)

    // CRITICAL: Proper order to prevent input conflicts
    // 1. Disable input on THIS scene first
    this.input.enabled = false
    console.log('[CommerceHubScene] Disabled input on hub scene')

    // 2. Re-enable input on the RETURN scene BEFORE resuming
    try {
      const gameScene = this.scene.get(returnScene)
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[CommerceHubScene] Re-enabled input on:', returnScene)
      }
    } catch (e) {
      console.error('[CommerceHubScene] Failed to re-enable input:', e)
    }

    // 3. Bring return scene to TOP of scene stack (for input priority)
    try {
      this.scene.bringToTop(returnScene)
      console.log('[CommerceHubScene] Brought to top:', returnScene)
    } catch (e) {
      console.error('[CommerceHubScene] Failed to bring to top:', e)
    }

    // 4. Resume the return scene
    try {
      this.scene.resume(returnScene)
      console.log('[CommerceHubScene] Resumed:', returnScene)
    } catch (e) {
      console.error('[CommerceHubScene] Failed to resume return scene:', e)
    }

    // 5. Resume UIScene
    this.readiness.resumeUIScene()

    // 5. Stop THIS scene LAST
    this.scene.stop()
    console.log('[CommerceHubScene] Scene stopped')
  }

  shutdown() {
    console.log('[CommerceHubScene] shutdown() called')

    // Safety net: always try to resume UIScene on shutdown
    try {
      this.scene.resume('UIScene')
    } catch (e) {
      // Ignore errors
    }

    super.shutdown()
    this.contentItems = []
    this.tabButtons = []
  }
}

export default CommerceHubScene
