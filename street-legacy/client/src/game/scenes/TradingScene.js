import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { TRADING_GOODS, getPlayerData, savePlayerData } from '../data/GameData.js'
import { aiSimulationManager } from '../managers/AISimulationManager.js'
import { COLORS, BORDERS, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * TradingScene - Local Buy/Sell Trading (Local Data Mode)
 *
 * Features:
 * - Buy goods at market prices
 * - Sell goods for profit
 * - Risk-based pricing system
 */
export class TradingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TradingScene' })
    this.goods = []
    this.playerInventory = []
    this.currentTab = 'buy' // 'buy', 'sell'
    // Quantity selector state
    this.selectedGood = null
    this.selectedQuantity = 1
    this.modalContainer = null
    this.modalMode = null // 'buy' or 'sell'
  }

  async create() {
    console.log('[TradingScene] create() started')
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

    // FULL opaque background - covers everything underneath
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1).setOrigin(0).setDepth(100).setInteractive()

    // Header
    this.add.text(width / 2, 40, '[T] TRADING', {
      ...getTerminalStyle('xxl'),
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(width / 2, 75, `${SYMBOLS.system} Buy low, sell high - manage your inventory`, {
      fontSize: '14px',
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5)

    // Close button
    this.createCloseButton()

    // Create tabs
    this.createTabs()

    // Load data
    this.loadData()
    this.showCurrentTab()
  }

  loadData() {
    const player = gameManager.player || getPlayerData()

    // Load trading goods with persistent price variations
    this.goods = this.getOrGenerateTradingPrices(player)

    // Get player's trading inventory
    this.playerInventory = player.tradingGoods || []
  }

  /**
   * Get or generate trading prices with persistence
   * Prices update every 15 minutes to simulate market fluctuations
   */
  getOrGenerateTradingPrices(player) {
    const PRICE_UPDATE_INTERVAL = 900000 // 15 minutes
    const now = Date.now()

    // Try to load from localStorage
    let tradingData
    try {
      const stored = localStorage.getItem('street_legacy_trading')
      tradingData = stored ? JSON.parse(stored) : null
    } catch (e) {
      tradingData = null
    }

    // Check if we need to generate new prices
    const needsUpdate = !tradingData || !tradingData.prices ||
      (now - tradingData.lastUpdate) > PRICE_UPDATE_INTERVAL

    if (needsUpdate) {
      // Generate new prices with some variation from previous
      const previousPrices = tradingData?.prices || {}

      const newPrices = {}
      TRADING_GOODS.forEach(good => {
        const prevBuy = previousPrices[good.id]?.buyPrice || good.buy_price
        const prevSell = previousPrices[good.id]?.sellPrice || good.sell_price

        // Price can change by -15% to +15% from previous
        let buyChange = 0.85 + Math.random() * 0.3
        let sellChange = 0.85 + Math.random() * 0.3

        // Apply AI market influence
        // Positive influence = AIs buying more (price goes up)
        // Negative influence = AIs selling more (price goes down)
        const aiInfluence = aiSimulationManager.getMarketInfluence(good.id) || 0
        const aiPriceFactor = 1 + (aiInfluence * 0.005) // Each unit of influence = 0.5% price change

        buyChange *= aiPriceFactor
        sellChange *= aiPriceFactor

        // Calculate new price but stay within bounds of base price ±40%
        let newBuyPrice = Math.floor(prevBuy * buyChange)
        let newSellPrice = Math.floor(prevSell * sellChange)

        // Clamp to base price bounds
        const minBuy = Math.floor(good.buy_price * 0.6)
        const maxBuy = Math.floor(good.buy_price * 1.4)
        const minSell = Math.floor(good.sell_price * 0.6)
        const maxSell = Math.floor(good.sell_price * 1.4)

        newBuyPrice = Math.max(minBuy, Math.min(maxBuy, newBuyPrice))
        newSellPrice = Math.max(minSell, Math.min(maxSell, newSellPrice))

        // Ensure sell price is always higher than buy price
        if (newSellPrice <= newBuyPrice) {
          newSellPrice = newBuyPrice + Math.floor(good.buy_price * 0.2)
        }

        // Determine trend - factor in AI influence
        let trend = 'stable'
        if (aiInfluence > 3) trend = 'up'
        else if (aiInfluence < -3) trend = 'down'
        else if (newBuyPrice > prevBuy) trend = 'up'
        else if (newBuyPrice < prevBuy) trend = 'down'

        newPrices[good.id] = {
          buyPrice: newBuyPrice,
          sellPrice: newSellPrice,
          trend: trend,
          aiInfluence: aiInfluence
        }
      })

      tradingData = {
        prices: newPrices,
        lastUpdate: now
      }

      // Save to localStorage
      try {
        localStorage.setItem('street_legacy_trading', JSON.stringify(tradingData))
      } catch (e) {
        console.warn('[TradingScene] Failed to save prices:', e)
      }
    }

    // Build goods array with persistent prices
    return TRADING_GOODS.map(good => ({
      ...good,
      currentBuyPrice: tradingData.prices[good.id]?.buyPrice || good.buy_price,
      currentSellPrice: tradingData.prices[good.id]?.sellPrice || good.sell_price,
      trend: tradingData.prices[good.id]?.trend || 'stable',
      canBuy: player.level >= good.min_level
    }))
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      fontSize: '32px',
      color: toHexString(COLORS.text.primary),
      fontFamily: 'Arial'
    })
    .setOrigin(0.5)
    .setDepth(999)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.status.info))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.primary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[TradingScene] Close button clicked')
      this.closeScene()
    })
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 110
    const tabWidth = 100
    const tabs = [
      { key: 'buy', label: 'Buy' },
      { key: 'sell', label: 'Sell' },
      { key: 'history', label: 'History' }
    ]

    this.tabButtons = []
    const startX = width / 2 - (tabs.length * tabWidth) / 2 + tabWidth / 2

    tabs.forEach((tab, i) => {
      const x = startX + i * tabWidth
      const isActive = this.currentTab === tab.key

      const bg = this.add.rectangle(x, tabY, tabWidth - 10, 35,
        isActive ? COLORS.status.info : COLORS.bg.elevated)
        .setInteractive({ useHandCursor: true })

      const label = this.add.text(x, tabY, tab.label, {
        fontSize: '14px',
        color: isActive ? toHexString(COLORS.bg.void) : toHexString(COLORS.text.primary)
      }).setOrigin(0.5)

      bg.on('pointerdown', () => {
        this.currentTab = tab.key
        this.refreshTabs()
        this.showCurrentTab()
      })

      this.tabButtons.push({ bg, label, key: tab.key })
    })
  }

  refreshTabs() {
    this.tabButtons.forEach(({ bg, label, key }) => {
      const isActive = this.currentTab === key
      bg.setFillStyle(isActive ? COLORS.status.info : COLORS.bg.elevated)
      label.setColor(isActive ? toHexString(COLORS.bg.void) : toHexString(COLORS.text.primary))
    })
  }

  showCurrentTab() {
    // Clear content area
    if (this.contentContainer) {
      this.contentContainer.destroy()
    }
    this.contentContainer = this.add.container(0, 0)

    // Show cash
    const player = gameManager.player || getPlayerData()
    const { width } = this.cameras.main

    const cashText = this.add.text(width / 2, 140, `${SYMBOLS.cash} Cash: ${formatMoney(player.cash || 0)}`, {
      fontSize: '14px',
      color: toHexString(COLORS.text.gold)
    }).setOrigin(0.5)
    this.contentContainer.add(cashText)

    switch (this.currentTab) {
      case 'buy':
        this.showBuyGoods()
        break
      case 'sell':
        this.showSellGoods()
        break
      case 'history':
        this.showHistory()
        break
    }
  }

  showBuyGoods() {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const startY = 170
    const cardHeight = 70

    if (this.goods.length === 0) {
      this.contentContainer.add(
        this.add.text(width / 2, height / 2, 'No goods available', {
          fontSize: '16px',
          color: '#666666'
        }).setOrigin(0.5)
      )
      return
    }

    this.goods.forEach((good, index) => {
      const y = startY + index * cardHeight
      if (y > height - 80) return

      const canAfford = (player.cash || 0) >= good.currentBuyPrice
      const canBuy = good.canBuy && canAfford

      // Card background
      const card = this.add.rectangle(width / 2, y + cardHeight / 2 - 5, width - 60, cardHeight - 8,
        canBuy ? COLORS.bg.card : COLORS.bg.panel)
        .setInteractive({ useHandCursor: canBuy })
      this.contentContainer.add(card)

      // Good name and risk
      const riskColors = { Low: toHexString(COLORS.status.success), Medium: toHexString(COLORS.status.warning), High: toHexString(COLORS.status.danger), 'Very High': toHexString(COLORS.status.danger) }
      const trendIcons = { up: SYMBOLS.up, down: SYMBOLS.down, stable: SYMBOLS.forward }
      const trendColors = { up: toHexString(COLORS.status.success), down: toHexString(COLORS.status.danger), stable: toHexString(COLORS.text.muted) }

      this.contentContainer.add(
        this.add.text(50, y + 8, `${good.name} ${trendIcons[good.trend] || ''}`, {
          fontSize: '15px',
          color: canBuy ? toHexString(COLORS.text.primary) : toHexString(COLORS.text.muted),
          fontStyle: 'bold'
        })
      )

      this.contentContainer.add(
        this.add.text(50, y + 28, `Risk: ${good.risk} | Min Lv.${good.min_level}`, {
          fontSize: '11px',
          color: riskColors[good.risk] || '#888888'
        })
      )

      // Price
      this.contentContainer.add(
        this.add.text(width - 120, y + 12, formatMoney(good.currentBuyPrice), {
          fontSize: '14px',
          color: canAfford ? toHexString(COLORS.text.gold) : toHexString(COLORS.status.danger)
        }).setOrigin(1, 0)
      )

      // Buy button
      if (canBuy) {
        const buyBtn = this.add.rectangle(width - 55, y + cardHeight / 2 - 5, 60, 30, COLORS.status.info)
          .setInteractive({ useHandCursor: true })
        this.contentContainer.add(buyBtn)

        this.contentContainer.add(
          this.add.text(width - 55, y + cardHeight / 2 - 5, 'BUY', {
            fontSize: '12px',
            color: toHexString(COLORS.bg.void),
            fontStyle: 'bold'
          }).setOrigin(0.5)
        )

        buyBtn.on('pointerover', () => buyBtn.setFillStyle(COLORS.network.primary))
        buyBtn.on('pointerout', () => buyBtn.setFillStyle(COLORS.status.info))
        buyBtn.on('pointerdown', () => this.showQuantityModal(good, 'buy', 999))
      } else if (!good.canBuy) {
        this.contentContainer.add(
          this.add.text(width - 55, y + cardHeight / 2 - 5, SYMBOLS.locked, {
            fontSize: '16px',
            color: toHexString(COLORS.text.muted)
          }).setOrigin(0.5)
        )
      }
    })
  }

  showSellGoods() {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const tradingGoods = player.tradingGoods || []
    const startY = 170
    const cardHeight = 70

    if (tradingGoods.length === 0) {
      this.contentContainer.add(
        this.add.text(width / 2, height / 2 - 30, 'No goods to sell', {
          fontSize: '18px',
          color: '#666666'
        }).setOrigin(0.5)
      )
      this.contentContainer.add(
        this.add.text(width / 2, height / 2 + 10, 'Buy some goods first!', {
          fontSize: '14px',
          color: '#888888'
        }).setOrigin(0.5)
      )
      return
    }

    tradingGoods.forEach((item, index) => {
      const y = startY + index * cardHeight
      if (y > height - 80) return

      const good = this.goods.find(g => g.id === item.id) || item

      // Card background
      const card = this.add.rectangle(width / 2, y + cardHeight / 2 - 5, width - 60, cardHeight - 8, COLORS.bg.card)
        .setInteractive({ useHandCursor: true })
      this.contentContainer.add(card)

      // Good name and quantity
      this.contentContainer.add(
        this.add.text(50, y + 8, `${item.name} x${item.quantity || 1}`, {
          fontSize: '15px',
          color: toHexString(COLORS.text.primary),
          fontStyle: 'bold'
        })
      )

      this.contentContainer.add(
        this.add.text(50, y + 28, `Bought at: ${formatMoney(item.boughtAt || good.buy_price)}`, {
          fontSize: '11px',
          color: toHexString(COLORS.text.secondary)
        })
      )

      // Sell price
      const sellPrice = good.currentSellPrice || good.sell_price
      const profit = sellPrice - (item.boughtAt || good.buy_price)
      const profitColor = profit > 0 ? toHexString(COLORS.status.success) : (profit < 0 ? toHexString(COLORS.status.danger) : toHexString(COLORS.text.muted))

      this.contentContainer.add(
        this.add.text(width - 120, y + 8, formatMoney(sellPrice), {
          fontSize: '14px',
          color: toHexString(COLORS.status.warning)
        }).setOrigin(1, 0)
      )

      this.contentContainer.add(
        this.add.text(width - 120, y + 26, `${profit >= 0 ? '+' : ''}${formatMoney(profit)}`, {
          fontSize: '11px',
          color: profitColor
        }).setOrigin(1, 0)
      )

      // Sell button
      const sellBtn = this.add.rectangle(width - 55, y + cardHeight / 2 - 5, 60, 30, COLORS.status.warning)
        .setInteractive({ useHandCursor: true })
      this.contentContainer.add(sellBtn)

      this.contentContainer.add(
        this.add.text(width - 55, y + cardHeight / 2 - 5, 'SELL', {
          fontSize: '12px',
          color: toHexString(COLORS.bg.void),
          fontStyle: 'bold'
        }).setOrigin(0.5)
      )

      sellBtn.on('pointerover', () => sellBtn.setFillStyle(COLORS.network.primary))
      sellBtn.on('pointerout', () => sellBtn.setFillStyle(COLORS.status.warning))
      sellBtn.on('pointerdown', () => this.showQuantityModal(good, 'sell', item.quantity || 1))
    })
  }

  showHistory() {
    const { width, height } = this.cameras.main
    const startY = 170
    const rowHeight = 50

    // Load transaction history
    let history = []
    try {
      const stored = localStorage.getItem('street_legacy_trade_history')
      history = stored ? JSON.parse(stored) : []
    } catch (e) {
      history = []
    }

    if (history.length === 0) {
      this.contentContainer.add(
        this.add.text(width / 2, height / 2 - 30, 'No transactions yet', {
          fontSize: '18px',
          color: '#666666'
        }).setOrigin(0.5)
      )
      this.contentContainer.add(
        this.add.text(width / 2, height / 2 + 10, 'Your buy/sell history will appear here', {
          fontSize: '14px',
          color: '#888888'
        }).setOrigin(0.5)
      )
      return
    }

    // Calculate total P&L
    let totalProfit = 0
    history.forEach(tx => {
      if (tx.type === 'sell') {
        totalProfit += tx.total
      } else {
        totalProfit -= tx.total
      }
    })

    // Show P&L summary
    const plColor = totalProfit >= 0 ? toHexString(COLORS.status.success) : toHexString(COLORS.status.danger)
    const plText = this.add.text(width / 2, startY - 20,
      `Net P&L: ${totalProfit >= 0 ? '+' : ''}${formatMoney(totalProfit)}`, {
      fontSize: '14px',
      color: plColor,
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentContainer.add(plText)

    // Show recent transactions (up to 10)
    const maxDisplay = Math.min(history.length, 10)
    history.slice(0, maxDisplay).forEach((tx, index) => {
      const y = startY + 10 + index * rowHeight
      if (y > height - 80) return

      // Row background
      const rowBg = this.add.rectangle(width / 2, y + rowHeight / 2 - 5, width - 60, rowHeight - 6,
        index % 2 === 0 ? COLORS.bg.card : COLORS.bg.panel)
      this.contentContainer.add(rowBg)

      // Transaction type icon and good name
      const typeIcon = tx.type === 'buy' ? '-' : '+'
      const typeColor = tx.type === 'buy' ? toHexString(COLORS.status.danger) : toHexString(COLORS.status.success)

      this.contentContainer.add(
        this.add.text(40, y + 8, `${typeIcon} ${tx.goodName} x${tx.quantity}`, {
          fontSize: '13px',
          color: toHexString(COLORS.text.primary),
          fontStyle: 'bold'
        })
      )

      // Time ago
      const timeAgo = this.formatTimeAgo(tx.timestamp)
      this.contentContainer.add(
        this.add.text(40, y + 26, timeAgo, {
          fontSize: '10px',
          color: toHexString(COLORS.text.muted)
        })
      )

      // Amount
      this.contentContainer.add(
        this.add.text(width - 40, y + 17, `${tx.type === 'buy' ? '-' : '+'}${formatMoney(tx.total)}`, {
          fontSize: '14px',
          color: typeColor
        }).setOrigin(1, 0.5)
      )
    })

    if (history.length > maxDisplay) {
      this.contentContainer.add(
        this.add.text(width / 2, startY + 10 + maxDisplay * rowHeight + 10,
          `+ ${history.length - maxDisplay} more transactions`, {
          fontSize: '11px',
          color: toHexString(COLORS.text.muted)
        }).setOrigin(0.5)
      )
    }
  }

  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  buyGood(good) {
    const player = gameManager.player || getPlayerData()

    if ((player.cash || 0) < good.currentBuyPrice) {
      return
    }

    // Deduct cash
    player.cash -= good.currentBuyPrice

    // Add to trading goods
    if (!player.tradingGoods) player.tradingGoods = []

    const existing = player.tradingGoods.find(g => g.id === good.id)
    if (existing) {
      // Calculate weighted average purchase price
      const oldQuantity = existing.quantity || 1
      const oldTotal = existing.boughtAt * oldQuantity
      const newTotal = oldTotal + good.currentBuyPrice
      existing.quantity = oldQuantity + 1
      existing.boughtAt = Math.round(newTotal / existing.quantity)
    } else {
      player.tradingGoods.push({
        id: good.id,
        name: good.name,
        quantity: 1,
        boughtAt: good.currentBuyPrice
      })
    }

    savePlayerData(player)
    gameManager.player = player

    try {
      audioManager.playClick()
    } catch (e) { /* ignore */ }

    // Refresh
    this.loadData()
    this.showCurrentTab()
  }

  sellGood(item, good) {
    const player = gameManager.player || getPlayerData()
    const sellPrice = good.currentSellPrice || good.sell_price

    // Add cash
    player.cash += sellPrice

    // Remove from inventory
    const idx = player.tradingGoods.findIndex(g => g.id === item.id)
    if (idx !== -1) {
      if (player.tradingGoods[idx].quantity > 1) {
        player.tradingGoods[idx].quantity--
      } else {
        player.tradingGoods.splice(idx, 1)
      }
    }

    savePlayerData(player)
    gameManager.player = player

    try {
      audioManager.playCashGain(sellPrice)
    } catch (e) { /* ignore */ }

    // Refresh
    this.loadData()
    this.showCurrentTab()
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

  /**
   * Show quantity selector modal for buying/selling
   */
  showQuantityModal(good, mode, maxQuantity) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Close any existing modal
    this.closeModal()

    this.selectedGood = good
    this.selectedQuantity = 1
    this.modalMode = mode

    // Calculate max affordable/sellable
    const price = mode === 'buy' ? good.currentBuyPrice : good.currentSellPrice
    const maxAffordable = mode === 'buy'
      ? Math.floor((player.cash || 0) / price)
      : maxQuantity

    this.maxQuantity = Math.min(maxQuantity, maxAffordable)
    if (this.maxQuantity <= 0) return

    // Create modal container
    this.modalContainer = this.add.container(0, 0).setDepth(500)

    // Backdrop
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setInteractive()
    backdrop.on('pointerdown', () => this.closeModal())
    this.modalContainer.add(backdrop)

    // Modal panel
    const panelWidth = 320
    const panelHeight = 280
    const panelX = width / 2
    const panelY = height / 2

    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, COLORS.bg.elevated)
      .setStrokeStyle(2, COLORS.status.info)
      .setInteractive() // Block clicks from reaching backdrop
    this.modalContainer.add(panel)

    // Title
    const title = this.add.text(panelX, panelY - 110,
      `${mode === 'buy' ? 'BUY' : 'SELL'}: ${good.name}`, {
      fontSize: '18px',
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.modalContainer.add(title)

    // Price per unit
    const priceLabel = this.add.text(panelX, panelY - 80,
      `Price: ${formatMoney(price)} each`, {
      fontSize: '13px',
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5)
    this.modalContainer.add(priceLabel)

    // Quantity selector row
    const qtyY = panelY - 30

    // Minus button
    const minusBtn = this.add.rectangle(panelX - 80, qtyY, 40, 40, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.text.muted)
      .setInteractive({ useHandCursor: true })
    minusBtn.on('pointerdown', () => this.adjustQuantity(-1))
    minusBtn.on('pointerover', () => minusBtn.setFillStyle(COLORS.bg.card))
    minusBtn.on('pointerout', () => minusBtn.setFillStyle(COLORS.bg.panel))
    this.modalContainer.add(minusBtn)

    const minusText = this.add.text(panelX - 80, qtyY, '-', {
      fontSize: '24px',
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)
    this.modalContainer.add(minusText)

    // Quantity display
    this.qtyText = this.add.text(panelX, qtyY, '1', {
      fontSize: '28px',
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.modalContainer.add(this.qtyText)

    // Plus button
    const plusBtn = this.add.rectangle(panelX + 80, qtyY, 40, 40, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.text.muted)
      .setInteractive({ useHandCursor: true })
    plusBtn.on('pointerdown', () => this.adjustQuantity(1))
    plusBtn.on('pointerover', () => plusBtn.setFillStyle(COLORS.bg.card))
    plusBtn.on('pointerout', () => plusBtn.setFillStyle(COLORS.bg.panel))
    this.modalContainer.add(plusBtn)

    const plusText = this.add.text(panelX + 80, qtyY, '+', {
      fontSize: '24px',
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)
    this.modalContainer.add(plusText)

    // Quick quantity buttons
    const quickY = qtyY + 50
    const quickBtns = [1, 5, 10, 'MAX']
    const btnSpacing = 70
    const startX = panelX - (quickBtns.length - 1) * btnSpacing / 2

    quickBtns.forEach((qty, i) => {
      const x = startX + i * btnSpacing
      const qtyValue = qty === 'MAX' ? this.maxQuantity : qty
      const isDisabled = qtyValue > this.maxQuantity

      const btn = this.add.rectangle(x, quickY, 55, 30,
        isDisabled ? COLORS.bg.panel : COLORS.bg.card)
        .setStrokeStyle(1, isDisabled ? COLORS.text.muted : COLORS.status.info)
        .setInteractive({ useHandCursor: !isDisabled })

      if (!isDisabled) {
        btn.on('pointerdown', () => this.setQuantity(qtyValue))
        btn.on('pointerover', () => btn.setFillStyle(COLORS.status.info))
        btn.on('pointerout', () => btn.setFillStyle(COLORS.bg.card))
      }
      this.modalContainer.add(btn)

      const btnLabel = this.add.text(x, quickY, qty === 'MAX' ? 'MAX' : `x${qty}`, {
        fontSize: '12px',
        color: isDisabled ? toHexString(COLORS.text.muted) : toHexString(COLORS.text.primary)
      }).setOrigin(0.5)
      this.modalContainer.add(btnLabel)
    })

    // Total cost/revenue display
    this.totalText = this.add.text(panelX, panelY + 45,
      `Total: ${formatMoney(price)}`, {
      fontSize: '16px',
      color: mode === 'buy' ? toHexString(COLORS.text.gold) : toHexString(COLORS.status.success),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.modalContainer.add(this.totalText)

    // Confirm button
    const confirmBtn = this.add.rectangle(panelX, panelY + 95, 140, 45,
      mode === 'buy' ? COLORS.status.info : COLORS.status.warning)
      .setInteractive({ useHandCursor: true })
    confirmBtn.on('pointerdown', () => this.confirmTransaction())
    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(COLORS.network.primary))
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(
      mode === 'buy' ? COLORS.status.info : COLORS.status.warning))
    this.modalContainer.add(confirmBtn)

    const confirmText = this.add.text(panelX, panelY + 95,
      mode === 'buy' ? 'CONFIRM BUY' : 'CONFIRM SELL', {
      fontSize: '14px',
      color: toHexString(COLORS.bg.void),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.modalContainer.add(confirmText)

    // Cancel button
    const cancelBtn = this.add.text(panelX, panelY + 130, 'Cancel', {
      fontSize: '12px',
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    cancelBtn.on('pointerdown', () => this.closeModal())
    cancelBtn.on('pointerover', () => cancelBtn.setColor(toHexString(COLORS.text.primary)))
    cancelBtn.on('pointerout', () => cancelBtn.setColor(toHexString(COLORS.text.muted)))
    this.modalContainer.add(cancelBtn)
  }

  adjustQuantity(delta) {
    const newQty = this.selectedQuantity + delta
    if (newQty >= 1 && newQty <= this.maxQuantity) {
      this.setQuantity(newQty)
    }
  }

  setQuantity(qty) {
    this.selectedQuantity = Math.max(1, Math.min(qty, this.maxQuantity))
    const price = this.modalMode === 'buy'
      ? this.selectedGood.currentBuyPrice
      : this.selectedGood.currentSellPrice
    const total = price * this.selectedQuantity

    if (this.qtyText) this.qtyText.setText(this.selectedQuantity.toString())
    if (this.totalText) this.totalText.setText(`Total: ${formatMoney(total)}`)
  }

  confirmTransaction() {
    const good = this.selectedGood
    const qty = this.selectedQuantity
    const mode = this.modalMode

    if (!good || qty <= 0) return

    if (mode === 'buy') {
      this.executeBuy(good, qty)
    } else {
      this.executeSell(good, qty)
    }

    this.closeModal()
  }

  executeBuy(good, quantity) {
    const player = gameManager.player || getPlayerData()
    const totalCost = good.currentBuyPrice * quantity

    if ((player.cash || 0) < totalCost) return

    // Deduct cash
    player.cash -= totalCost

    // Add to trading goods
    if (!player.tradingGoods) player.tradingGoods = []

    const existing = player.tradingGoods.find(g => g.id === good.id)
    if (existing) {
      // Calculate weighted average purchase price
      const oldQuantity = existing.quantity || 1
      const oldTotal = existing.boughtAt * oldQuantity
      const newTotal = oldTotal + totalCost
      existing.quantity = oldQuantity + quantity
      existing.boughtAt = Math.round(newTotal / existing.quantity)
    } else {
      player.tradingGoods.push({
        id: good.id,
        name: good.name,
        quantity: quantity,
        boughtAt: good.currentBuyPrice
      })
    }

    // Log transaction
    this.logTransaction('buy', good, quantity, good.currentBuyPrice)

    savePlayerData(player)
    gameManager.player = player

    try { audioManager.playClick() } catch (e) {}

    // Refresh
    this.loadData()
    this.showCurrentTab()
  }

  executeSell(good, quantity) {
    const player = gameManager.player || getPlayerData()
    const item = player.tradingGoods?.find(g => g.id === good.id)
    if (!item || item.quantity < quantity) return

    const sellPrice = good.currentSellPrice || good.sell_price
    const totalRevenue = sellPrice * quantity

    // Add cash
    player.cash += totalRevenue

    // Remove from inventory
    item.quantity -= quantity
    if (item.quantity <= 0) {
      const idx = player.tradingGoods.indexOf(item)
      player.tradingGoods.splice(idx, 1)
    }

    // Log transaction
    this.logTransaction('sell', good, quantity, sellPrice)

    savePlayerData(player)
    gameManager.player = player

    try { audioManager.playCashGain(totalRevenue) } catch (e) {}

    // Refresh
    this.loadData()
    this.showCurrentTab()
  }

  logTransaction(type, good, quantity, price) {
    try {
      const stored = localStorage.getItem('street_legacy_trade_history')
      const history = stored ? JSON.parse(stored) : []

      history.unshift({
        type,
        goodId: good.id,
        goodName: good.name,
        quantity,
        price,
        total: price * quantity,
        timestamp: Date.now()
      })

      // Keep only last 50 transactions
      if (history.length > 50) history.length = 50

      localStorage.setItem('street_legacy_trade_history', JSON.stringify(history))
    } catch (e) {
      console.warn('[TradingScene] Failed to log transaction:', e)
    }
  }

  closeModal() {
    if (this.modalContainer) {
      this.modalContainer.destroy()
      this.modalContainer = null
    }
    this.selectedGood = null
    this.selectedQuantity = 1
    this.modalMode = null
  }
}
