import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { getPlayerData, savePlayerData } from '../data/GameData'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * BankScene - Complete financial hub with banking, investments, and gambling
 *
 * Features:
 * - Banking: Deposit/Withdraw with fees, protected savings
 * - Investments: Stock market with buy/sell, daily returns
 * - Gambling: Coin flip, dice roll, high stakes options
 * - Loans: Borrow money with interest rates
 */
export class BankScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BankScene' })
    this.amountValue = ''
    this.activeTab = 'banking'
    this.stocks = []
    this.selectedStock = null
    this.loanAmount = ''
    this.pendingCasinoResult = null
  }

  init(data) {
    // Check if we're returning from a casino game with results
    if (data?.casinoResult) {
      console.log('[BankScene] Received casino result:', data.casinoResult)
      this.pendingCasinoResult = data.casinoResult
      // If returning from casino, switch to gambling tab
      this.activeTab = 'gambling'
    } else {
      this.pendingCasinoResult = null
    }
  }

  create() {
    console.log('[BankScene] create() started')
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

    // Full screen dark background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(DEPTH.BACKGROUND)

    // Decorative vault pattern background
    this.createVaultPattern()

    // Header section with bank icon
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Check and apply daily interest
    this.checkDailyInterest()

    // Check loan interest
    this.checkLoanInterest()

    // Balance overview
    this.createBalanceOverview()

    // Tab navigation
    this.createTabs()

    // Content area
    this.contentItems = []
    this.renderContent()

    // Process pending casino result if returning from a casino game
    if (this.pendingCasinoResult) {
      // Delay slightly to ensure UI is ready
      this.time.delayedCall(100, () => {
        this.processCasinoResult(this.pendingCasinoResult)
        this.pendingCasinoResult = null
      })
    }
  }

  /**
   * Process casino result passed via scene data
   */
  processCasinoResult(result) {
    console.log('[BankScene] Processing casino result:', result)
    const player = gameManager.player || getPlayerData()
    const { won, payout, gameType, cancelled, betAmount } = result

    if (cancelled) {
      // Refund the bet on cancel
      player.cash += betAmount
      savePlayerData(player)
      gameManager.player = player
      this.updateBalances()
      this.renderContent()
      return
    }

    if (won) {
      // Add winnings to cash
      player.cash += payout
      savePlayerData(player)
      gameManager.player = player

      // Show win result
      const emoji = gameType === 'coinflip' ? '🪙' : '🎲'
      this.showGambleResult(true, `${emoji} Won ${formatMoney(payout)}!`)

      try {
        audioManager.playCashGain(payout)
      } catch (e) { /* ignore */ }
    } else {
      // Bet was already deducted, just show loss
      const emoji = gameType === 'coinflip' ? '🪙' : '🎲'
      this.showGambleResult(false, `${emoji} Better luck next time!`)

      try {
        audioManager.playMiss()
      } catch (e) { /* ignore */ }
    }

    this.updateBalances()
    this.renderContent()
  }

  createHeader() {
    const { width } = this.cameras.main
    const tealAccent = 0x0d9488

    // Icon background with teal accent
    const iconBg = this.add.circle(width / 2, 35, 26, COLORS.bg.panel)
      .setStrokeStyle(2, tealAccent, 0.5)
      .setDepth(DEPTH.CONTENT_BASE)

    // Terminal-style icon [B]
    this.add.text(width / 2, 35, '[B]', {
      ...getTerminalStyle('lg'),
      color: toHexString(tealAccent)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Title with terminal styling
    this.add.text(width / 2, 72, 'STREET BANK', {
      ...getTerminalStyle('xl'),
      color: toHexString(tealAccent)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Subtitle with system prefix
    this.add.text(width / 2, 90, `${SYMBOLS.system} FINANCIAL NETWORK`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)
  }

  createVaultPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(DEPTH.GRID)
    const tealAccent = 0x0d9488

    // Draw subtle grid pattern
    graphics.lineStyle(1, COLORS.bg.panel, 0.2)
    for (let x = 0; x < width; x += 30) {
      graphics.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 30) {
      graphics.lineBetween(0, y, width, y)
    }

    // Corner decorations with teal accent
    graphics.lineStyle(1, tealAccent, 0.15)
    graphics.lineBetween(0, 0, 40, 0)
    graphics.lineBetween(0, 0, 0, 40)
    graphics.lineBetween(width, 0, width - 40, 0)
    graphics.lineBetween(width, 0, width, 40)
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      fontSize: '28px',
      color: toHexString(COLORS.text.primary),
      fontFamily: 'Arial'
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

  createBalanceOverview() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const cardY = 115
    const cardWidth = (width - 50) / 2
    const cardHeight = 50
    const tealAccent = 0x0d9488

    // Cash on Hand card
    const cashCardX = 20 + cardWidth / 2
    this.add.rectangle(cashCardX, cardY, cardWidth, cardHeight, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.network.primary, 0.5)
      .setDepth(DEPTH.PANELS)

    this.add.text(cashCardX, cardY - 12, '[$] CASH', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    this.cashText = this.add.text(cashCardX, cardY + 8, formatMoney(player?.cash || 0), {
      ...getTerminalStyle('md'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Bank Balance card
    const bankCardX = width - 20 - cardWidth / 2
    this.add.rectangle(bankCardX, cardY, cardWidth, cardHeight, COLORS.bg.panel)
      .setStrokeStyle(1, tealAccent, 0.5)
      .setDepth(DEPTH.PANELS)

    this.add.text(bankCardX, cardY - 12, '[B] BANK', {
      ...getTerminalStyle('xs'),
      color: toHexString(tealAccent)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    this.bankText = this.add.text(bankCardX, cardY + 8, formatMoney(player?.bank || 0), {
      ...getTerminalStyle('md'),
      color: toHexString(tealAccent),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 180
    const tabWidth = (width - 55) / 4
    const gap = 5

    this.tabs = {}

    // Banking tab
    const bankX = 20 + tabWidth / 2
    this.tabs.banking = this.createTab(bankX, tabY, tabWidth, '[B] BANK', 'banking', true)

    // Investments tab
    const investX = bankX + tabWidth + gap
    this.tabs.invest = this.createTab(investX, tabY, tabWidth, '[I] INVEST', 'invest', false)

    // Gambling tab
    const gambleX = investX + tabWidth + gap
    this.tabs.gamble = this.createTab(gambleX, tabY, tabWidth, '[G] GAMBLE', 'gamble', false)

    // Loans tab
    const loansX = gambleX + tabWidth + gap
    this.tabs.loans = this.createTab(loansX, tabY, tabWidth, '[L] LOANS', 'loans', false)
  }

  createTab(x, y, tabWidth, label, tabKey, isActive) {
    const tealAccent = 0x0d9488
    const bgColor = isActive ? COLORS.bg.elevated : COLORS.bg.panel

    const bg = this.add.rectangle(x, y, tabWidth, 28, bgColor, 0.95)
      .setStrokeStyle(1, isActive ? tealAccent : COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.PANELS)

    const text = this.add.text(x, y, label, {
      ...getTerminalStyle('xs'),
      color: isActive ? toHexString(tealAccent) : toHexString(COLORS.text.muted),
      fontStyle: isActive ? 'bold' : 'normal'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    bg.on('pointerover', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(COLORS.bg.card, 0.95)
        text.setColor(toHexString(COLORS.network.primary))
      }
    })

    bg.on('pointerout', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(COLORS.bg.panel, 0.95)
        text.setColor(toHexString(COLORS.text.muted))
      }
    })

    bg.on('pointerdown', () => {
      this.switchTab(tabKey)
      try { audioManager.playClick() } catch (e) { /* ignore */ }
    })

    return { bg, text }
  }

  switchTab(tabKey) {
    if (this.activeTab === tabKey) return

    this.activeTab = tabKey
    this.amountValue = ''
    const tealAccent = 0x0d9488

    // Update tab styles
    Object.keys(this.tabs).forEach(key => {
      const isActive = key === tabKey
      this.tabs[key].bg.setFillStyle(isActive ? COLORS.bg.elevated : COLORS.bg.panel, 0.95)
      this.tabs[key].bg.setStrokeStyle(1, isActive ? tealAccent : COLORS.bg.elevated)
      this.tabs[key].text.setColor(isActive ? toHexString(tealAccent) : toHexString(COLORS.text.muted))
      this.tabs[key].text.setStyle({ fontStyle: isActive ? 'bold' : 'normal' })
    })

    this.renderContent()
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    if (this.activeTab === 'banking') {
      this.renderBankingTab()
    } else if (this.activeTab === 'invest') {
      this.renderInvestTab()
    } else if (this.activeTab === 'gamble') {
      this.renderGambleTab()
    } else if (this.activeTab === 'loans') {
      this.renderLoansTab()
    }
  }

  // ==================== BANKING TAB ====================
  renderBankingTab() {
    const { width, height } = this.cameras.main
    const startY = 180

    // Amount input
    const inputY = startY + 25
    const inputLabel = this.add.text(width / 2, inputY - 18, 'ENTER AMOUNT', {
      fontSize: '10px',
      color: '#666666'
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)
    this.contentItems.push(inputLabel)

    const inputBg = this.add.rectangle(width / 2, inputY + 10, width - 40, 40, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.network.dim)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(inputBg)

    const dollar = this.add.text(30, inputY + 10, '$', {
      ...getTerminalStyle('lg'),
      color: toHexString(0x0d9488),
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(dollar)

    this.amountText = this.add.text(width / 2, inputY + 10, '0', {
      ...getTerminalStyle('lg'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(this.amountText)

    // Status text
    this.statusText = this.add.text(width / 2, inputY + 38, '', {
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(this.statusText)

    // Number pad
    this.createNumberPad(startY + 85)

    // Action buttons
    const btnY = height - 100
    const btnWidth = (width - 50) / 2

    // Deposit button
    const depositBtn = this.add.rectangle(20 + btnWidth / 2, btnY, btnWidth, 45, 0x22c55e)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(depositBtn)

    const depositText = this.add.text(20 + btnWidth / 2, btnY - 5, '⬆ DEPOSIT', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(depositText)

    const depositFee = this.add.text(20 + btnWidth / 2, btnY + 12, '-5% fee', {
      fontSize: '9px',
      color: '#166534'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(depositFee)

    depositBtn.on('pointerover', () => depositBtn.setFillStyle(0x16a34a))
    depositBtn.on('pointerout', () => depositBtn.setFillStyle(0x22c55e))
    depositBtn.on('pointerdown', () => this.handleDeposit())

    // Withdraw button
    const withdrawBtn = this.add.rectangle(width - 20 - btnWidth / 2, btnY, btnWidth, 45, 0xdaa520)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(withdrawBtn)

    const withdrawText = this.add.text(width - 20 - btnWidth / 2, btnY - 5, '⬇ WITHDRAW', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(withdrawText)

    const withdrawFree = this.add.text(width - 20 - btnWidth / 2, btnY + 12, 'FREE', {
      fontSize: '9px',
      color: '#78350f'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(withdrawFree)

    withdrawBtn.on('pointerover', () => withdrawBtn.setFillStyle(0xb8860b))
    withdrawBtn.on('pointerout', () => withdrawBtn.setFillStyle(0xdaa520))
    withdrawBtn.on('pointerdown', () => this.handleWithdraw())

    // Info bar
    const infoBg = this.add.rectangle(width / 2, height - 35, width - 40, 40, 0x0d0d1a)
      .setStrokeStyle(1, 0x222233)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(infoBg)

    const infoText = this.add.text(width / 2, height - 35, '🔒 Bank deposits are protected from theft', {
      fontSize: '10px',
      color: '#666666'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(infoText)
  }

  createNumberPad(startY) {
    const { width } = this.cameras.main
    const buttonSize = 50
    const gap = 6
    const cols = 4
    const padWidth = cols * buttonSize + (cols - 1) * gap
    const startX = (width - padWidth) / 2 + buttonSize / 2

    const buttons = [
      ['1', '2', '3', '$1K'],
      ['4', '5', '6', '$10K'],
      ['7', '8', '9', 'MAX'],
      ['C', '0', '⌫', '']
    ]

    buttons.forEach((row, rowIndex) => {
      row.forEach((label, colIndex) => {
        if (!label) return

        const x = startX + colIndex * (buttonSize + gap)
        const y = startY + rowIndex * (buttonSize + gap)

        let bgColor = COLORS.bg.card
        let textColor = toHexString(COLORS.text.primary)

        if (label === 'C') {
          bgColor = 0x1a0010
          textColor = toHexString(COLORS.status.danger)
        } else if (label === '⌫') {
          bgColor = COLORS.bg.elevated
          textColor = toHexString(COLORS.status.warning)
        } else if (label === 'MAX') {
          bgColor = COLORS.network.dark
          textColor = toHexString(COLORS.network.primary)
        } else if (label.startsWith('$')) {
          bgColor = COLORS.bg.elevated
          textColor = '#8b5cf6'
        }

        const btn = this.add.rectangle(x, y, buttonSize, buttonSize, bgColor)
          .setStrokeStyle(1, 0x333344)
          .setInteractive({ useHandCursor: true })
          .setDepth(DEPTH.PANELS)
        this.contentItems.push(btn)

        const text = this.add.text(x, y, label, {
          fontSize: label.length > 2 ? '10px' : '16px',
          color: textColor
        }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
        this.contentItems.push(text)

        btn.on('pointerover', () => btn.setStrokeStyle(1, 0xdaa520))
        btn.on('pointerout', () => btn.setStrokeStyle(1, 0x333344))
        btn.on('pointerdown', () => {
          this.handleNumberPadPress(label)
          try { audioManager.playClick() } catch (e) { /* ignore */ }
        })
      })
    })
  }

  handleNumberPadPress(label) {
    if (label >= '0' && label <= '9') {
      if (this.amountValue.length < 10) {
        this.amountValue += label
        this.updateAmountDisplay()
      }
    } else if (label === 'C') {
      this.amountValue = ''
      this.updateAmountDisplay()
    } else if (label === '⌫') {
      this.amountValue = this.amountValue.slice(0, -1)
      this.updateAmountDisplay()
    } else if (label === 'MAX') {
      const player = gameManager.player || getPlayerData()
      this.amountValue = String(player?.cash || 0)
      this.updateAmountDisplay()
    } else if (label === '$1K') {
      this.amountValue = '1000'
      this.updateAmountDisplay()
    } else if (label === '$10K') {
      this.amountValue = '10000'
      this.updateAmountDisplay()
    }
  }

  updateAmountDisplay() {
    const displayValue = this.amountValue || '0'
    const numValue = parseInt(displayValue) || 0
    if (this.amountText) {
      this.amountText.setText(numValue.toLocaleString())
    }
  }

  handleDeposit() {
    const amount = parseInt(this.amountValue) || 0
    if (amount <= 0) {
      this.showStatus('Enter an amount to deposit', '#f59e0b')
      return
    }

    const player = gameManager.player || getPlayerData()
    if (amount > (player?.cash || 0)) {
      this.showStatus('Not enough cash!', '#ef4444')
      return
    }

    const fee = Math.floor(amount * 0.05)
    const netDeposit = amount - fee

    player.cash -= amount
    player.bank = (player.bank || 0) + netDeposit

    savePlayerData(player)
    gameManager.player = player

    this.updateBalances()
    this.showStatus(`Deposited ${formatMoney(netDeposit)} (${formatMoney(fee)} fee)`, '#22c55e')
    this.amountValue = ''
    this.updateAmountDisplay()

    try { audioManager.playClick() } catch (e) { /* ignore */ }
  }

  handleWithdraw() {
    const amount = parseInt(this.amountValue) || 0
    if (amount <= 0) {
      this.showStatus('Enter an amount to withdraw', '#f59e0b')
      return
    }

    const player = gameManager.player || getPlayerData()
    if (amount > (player?.bank || 0)) {
      this.showStatus('Not enough in bank!', '#ef4444')
      return
    }

    player.bank -= amount
    player.cash = (player.cash || 0) + amount

    savePlayerData(player)
    gameManager.player = player

    this.updateBalances()
    this.showStatus(`Withdrew ${formatMoney(amount)}`, '#3b82f6')
    this.amountValue = ''
    this.updateAmountDisplay()

    try { audioManager.playCashGain(amount) } catch (e) { /* ignore */ }
  }

  // ==================== INVESTMENTS TAB ====================
  renderInvestTab() {
    const { width, height } = this.cameras.main
    const startY = 180
    const player = gameManager.player || getPlayerData()

    // Portfolio header
    const portfolioValue = this.calculatePortfolioValue(player)
    const headerBg = this.add.rectangle(width / 2, startY + 25, width - 40, 50, 0x0d1a14)
      .setStrokeStyle(1, 0x22c55e, 0.5)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(headerBg)

    const portfolioLabel = this.add.text(25, startY + 12, '📊 YOUR PORTFOLIO', {
      fontSize: '9px',
      color: '#22c55e'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(portfolioLabel)

    const portfolioText = this.add.text(25, startY + 30, formatMoney(portfolioValue), {
      fontSize: '16px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(portfolioText)

    // Daily interest info
    const interestText = this.add.text(width - 25, startY + 25, '+2% daily', {
      fontSize: '10px',
      color: '#22c55e'
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(interestText)

    // Stock list
    const stocksY = startY + 70
    const stocksLabel = this.add.text(25, stocksY, '📈 STREET STOCKS', {
      fontSize: '11px',
      color: '#daa520',
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(stocksLabel)

    // Initialize stocks if not exists
    if (!player.stocks) {
      player.stocks = {}
    }

    // Stock data with persistence
    const stocks = this.getOrGenerateStockPrices()

    stocks.forEach((stock, index) => {
      const y = stocksY + 30 + index * 65
      this.renderStockCard(stock, y, player)
    })
  }

  renderStockCard(stock, y, player) {
    const { width } = this.cameras.main
    const owned = player.stocks?.[stock.symbol] || 0
    const isPositive = stock.change >= 0

    // Card background - taller if owned to fit sell button
    const cardHeight = owned > 0 ? 70 : 55
    const cardBg = this.add.rectangle(width / 2, y + cardHeight / 2, width - 40, cardHeight, 0x1e293b, 0.95)
      .setStrokeStyle(1, owned > 0 ? 0x3b82f6 : 0x334155)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(cardBg)

    // Stock symbol
    const symbol = this.add.text(25, y + 12, stock.symbol, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(symbol)

    // Stock name
    const name = this.add.text(25, y + 30, stock.name, {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(name)

    // Owned shares and value
    if (owned > 0) {
      const ownedValue = owned * stock.price
      const ownedText = this.add.text(25, y + 48, `📊 ${owned} shares = ${formatMoney(ownedValue)}`, {
        fontSize: '10px',
        color: '#3b82f6'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(ownedText)
    }

    // Price and change
    const priceX = width - 140
    const price = this.add.text(priceX, y + 15, `$${stock.price}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(price)

    const change = this.add.text(priceX, y + 35, `${isPositive ? '+' : ''}${stock.change}%`, {
      fontSize: '11px',
      color: isPositive ? '#22c55e' : '#ef4444'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(change)

    // Buy button
    const canAfford = (player.cash || 0) >= stock.price
    const btnY = owned > 0 ? y + 18 : y + 25
    const buyBtn = this.add.rectangle(width - 55, btnY, 50, owned > 0 ? 28 : 40, canAfford ? 0x22c55e : 0x444444)
      .setInteractive({ useHandCursor: canAfford })
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(buyBtn)

    if (canAfford) {
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x16a34a))
      buyBtn.on('pointerout', () => buyBtn.setFillStyle(0x22c55e))
      buyBtn.on('pointerdown', () => this.buyStock(stock))
    }

    const buyText = this.add.text(width - 55, btnY, 'BUY', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
    this.contentItems.push(buyText)

    // Sell button (if owned)
    if (owned > 0) {
      const sellBtnY = y + 50
      const sellBtn = this.add.rectangle(width - 55, sellBtnY, 50, 28, 0xef4444)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(sellBtn)

      sellBtn.on('pointerover', () => sellBtn.setFillStyle(0xdc2626))
      sellBtn.on('pointerout', () => sellBtn.setFillStyle(0xef4444))
      sellBtn.on('pointerdown', () => this.sellStock(stock))

      const sellText = this.add.text(width - 55, sellBtnY, 'SELL', {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(sellText)
    }
  }

  buyStock(stock) {
    const player = gameManager.player || getPlayerData()

    if ((player.cash || 0) < stock.price) {
      this.showStatus('Not enough cash!', '#ef4444')
      return
    }

    player.cash -= stock.price
    if (!player.stocks) player.stocks = {}
    player.stocks[stock.symbol] = (player.stocks[stock.symbol] || 0) + 1

    // Track purchase for profit calculation
    if (!player.stockPurchases) player.stockPurchases = {}
    if (!player.stockPurchases[stock.symbol]) player.stockPurchases[stock.symbol] = []
    player.stockPurchases[stock.symbol].push({ price: stock.price, date: Date.now() })

    savePlayerData(player)
    gameManager.player = player

    this.updateBalances()
    this.showStatus(`Bought 1 share of ${stock.symbol}!`, '#22c55e')
    this.renderContent()

    try { audioManager.playClick() } catch (e) { /* ignore */ }
  }

  sellStock(stock) {
    const player = gameManager.player || getPlayerData()
    const owned = player.stocks?.[stock.symbol] || 0

    if (owned <= 0) {
      this.showStatus('No shares to sell!', '#ef4444')
      return
    }

    // Sell at current market price
    const salePrice = stock.price
    player.cash = (player.cash || 0) + salePrice
    player.stocks[stock.symbol] = owned - 1

    // Remove from purchases (FIFO)
    if (player.stockPurchases?.[stock.symbol]?.length > 0) {
      const purchasePrice = player.stockPurchases[stock.symbol].shift().price
      const profit = salePrice - purchasePrice
      const profitColor = profit >= 0 ? '#22c55e' : '#ef4444'
      const profitText = profit >= 0 ? `+${formatMoney(profit)}` : formatMoney(profit)
      this.showStatus(`Sold ${stock.symbol} for ${formatMoney(salePrice)} (${profitText})`, profitColor)
    } else {
      this.showStatus(`Sold 1 share of ${stock.symbol} for ${formatMoney(salePrice)}!`, '#3b82f6')
    }

    // Clean up if no shares left
    if (player.stocks[stock.symbol] <= 0) {
      delete player.stocks[stock.symbol]
      if (player.stockPurchases?.[stock.symbol]) {
        delete player.stockPurchases[stock.symbol]
      }
    }

    savePlayerData(player)
    gameManager.player = player

    this.updateBalances()
    this.renderContent()

    try { audioManager.playCashGain(salePrice) } catch (e) { /* ignore */ }
  }

  calculatePortfolioValue(player) {
    if (!player.stocks) return 0
    // Simplified calculation - in real game would track buy prices
    let total = 0
    Object.entries(player.stocks).forEach(([symbol, shares]) => {
      const basePrice = { STRM: 175, DRGS: 87, GUNS: 250, CRPT: 125, TERR: 135 }
      total += (basePrice[symbol] || 100) * shares
    })
    return total
  }

  // ==================== GAMBLING TAB ====================
  renderGambleTab() {
    const { width, height } = this.cameras.main
    const startY = 180
    const player = gameManager.player || getPlayerData()

    // Warning banner
    const warningBg = this.add.rectangle(width / 2, startY + 15, width - 40, 30, 0x3a1a1a, 0.95)
      .setStrokeStyle(1, 0xef4444)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(warningBg)

    const warningText = this.add.text(width / 2, startY + 15, '⚠️ GAMBLE AT YOUR OWN RISK', {
      fontSize: '11px',
      color: '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(warningText)

    // Gambling options
    const optionsY = startY + 50

    // Coin Flip
    this.renderGambleOption('🪙', 'COIN FLIP', '2x Payout', 'coinflip', optionsY, 50)

    // Dice Roll
    this.renderGambleOption('🎲', 'DICE ROLL', '6x on 6', 'dice', optionsY + 120, 45)

    // High Stakes
    this.renderGambleOption('💎', 'HIGH ROLLER', '10x Payout', 'highroller', optionsY + 240, 40)
  }

  renderGambleOption(icon, title, payout, type, y, winChance) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + 45, width - 40, 100, 0x1e293b, 0.95)
      .setStrokeStyle(1, 0xf59e0b)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(cardBg)

    // Icon
    const iconText = this.add.text(40, y + 35, icon, {
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(iconText)

    // Title
    const titleText = this.add.text(75, y + 20, title, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(titleText)

    // Payout info
    const payoutText = this.add.text(75, y + 40, `Win: ${payout}`, {
      fontSize: '11px',
      color: '#22c55e'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(payoutText)

    // Win chance
    const chanceText = this.add.text(75, y + 57, `${winChance}% win chance`, {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(chanceText)

    // Bet buttons
    const bets = [100, 500, 1000]
    const btnWidth = 65
    const btnStartX = width - 30 - (bets.length * (btnWidth + 5))

    bets.forEach((bet, index) => {
      const btnX = btnStartX + index * (btnWidth + 5) + btnWidth / 2
      const canAfford = (player.cash || 0) >= bet

      const btn = this.add.rectangle(btnX, y + 45, btnWidth, 35, canAfford ? 0xf59e0b : 0x444444)
        .setInteractive({ useHandCursor: canAfford })
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(btn)

      if (canAfford) {
        btn.on('pointerover', () => btn.setFillStyle(0xd97706))
        btn.on('pointerout', () => btn.setFillStyle(0xf59e0b))
        btn.on('pointerdown', () => this.placeGamble(type, bet, winChance))
      }

      const btnText = this.add.text(btnX, y + 45, `$${bet >= 1000 ? bet / 1000 + 'K' : bet}`, {
        fontSize: '11px',
        color: canAfford ? '#000000' : '#888888',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(btnText)
    })
  }

  placeGamble(type, bet, winChance) {
    const player = gameManager.player || getPlayerData()

    if ((player.cash || 0) < bet) {
      this.showStatus('Not enough cash!', '#ef4444')
      return
    }

    // For coinflip and dice, launch animated casino scenes
    if (type === 'coinflip') {
      // Deduct bet before launching
      player.cash -= bet
      savePlayerData(player)
      gameManager.player = player
      this.updateBalances()

      console.log('[BankScene] Launching CoinFlipScene with bet:', bet)

      // Stop BankScene and start CoinFlipScene
      this.scene.stop()
      this.scene.start('CoinFlipScene', {
        betAmount: bet,
        returnScene: 'BankScene'
      })
      return
    }

    if (type === 'dice') {
      // Deduct bet before launching
      player.cash -= bet
      savePlayerData(player)
      gameManager.player = player
      this.updateBalances()

      console.log('[BankScene] Launching DiceRollScene with bet:', bet)

      // Stop BankScene and start DiceRollScene
      this.scene.stop()
      this.scene.start('DiceRollScene', {
        betAmount: bet,
        returnScene: 'BankScene'
      })
      return
    }

    // High roller remains instant (no animation)
    player.cash -= bet

    const roll = Math.random() * 100
    let won = false
    let payout = 0
    let message = ''

    if (type === 'highroller') {
      won = roll < 10
      payout = won ? bet * 10 : 0
      message = won ? `💎 JACKPOT! Won ${formatMoney(payout)}!` : '💎 No luck this time!'
    }

    // Apply winnings
    if (won) {
      player.cash += payout
    }

    // Save
    savePlayerData(player)
    gameManager.player = player

    // Update UI
    this.updateBalances()
    this.showGambleResult(won, message)
    this.renderContent()

    try {
      if (won) {
        audioManager.playCashGain(payout)
      } else {
        audioManager.playMiss()
      }
    } catch (e) { /* ignore */ }
  }

  showGambleResult(won, message) {
    const { width, height } = this.cameras.main

    const resultBg = this.add.rectangle(width / 2, height / 2, 280, 100,
      won ? 0x14532d : 0x450a0a, 0.98)
      .setStrokeStyle(2, won ? 0x22c55e : 0xef4444)
      .setDepth(DEPTH.MODAL)

    const resultText = this.add.text(width / 2, height / 2, message, {
      fontSize: '14px',
      color: won ? '#22c55e' : '#ef4444',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 250 }
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Animate and remove
    this.tweens.add({
      targets: [resultBg, resultText],
      alpha: { from: 1, to: 0 },
      y: height / 2 - 30,
      duration: 2000,
      delay: 1500,
      onComplete: () => {
        resultBg.destroy()
        resultText.destroy()
      }
    })

    // Shake on loss
    if (!won) {
      this.cameras.main.shake(200, 0.01)
    } else {
      this.cameras.main.flash(200, 34, 197, 94)
    }
  }

  updateBalances() {
    const player = gameManager.player || getPlayerData()
    if (this.cashText) {
      this.cashText.setText(formatMoney(player?.cash || 0))
    }
    if (this.bankText) {
      this.bankText.setText(formatMoney(player?.bank || 0))
    }
  }

  showStatus(message, color) {
    if (this.statusText) {
      this.statusText.setText(message)
      this.statusText.setColor(color)

      this.time.delayedCall(3000, () => {
        if (this.statusText) {
          this.statusText.setText('')
        }
      })
    }
  }

  // ==================== DAILY INTEREST ====================
  checkDailyInterest() {
    const player = gameManager.player || getPlayerData()
    const now = Date.now()
    const lastInterestDate = player.lastInterestDate || 0
    const oneDayMs = 24 * 60 * 60 * 1000 // 24 hours

    // Check if 24 hours have passed
    if (now - lastInterestDate >= oneDayMs) {
      const portfolioValue = this.calculatePortfolioValue(player)

      if (portfolioValue > 0) {
        // 2% daily interest on portfolio
        const interest = Math.floor(portfolioValue * 0.02)
        player.cash = (player.cash || 0) + interest
        player.lastInterestDate = now
        player.totalInterestEarned = (player.totalInterestEarned || 0) + interest

        savePlayerData(player)
        gameManager.player = player

        // Show notification
        this.showInterestNotification(interest)
      } else {
        player.lastInterestDate = now
        savePlayerData(player)
        gameManager.player = player
      }
    }
  }

  showInterestNotification(amount) {
    const { width, height } = this.cameras.main

    const notifBg = this.add.rectangle(width / 2, 200, 260, 60, 0x14532d, 0.98)
      .setStrokeStyle(2, 0x22c55e)
      .setDepth(DEPTH.MODAL)

    const notifIcon = this.add.text(width / 2, 185, '📈', {
      fontSize: '20px'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    const notifText = this.add.text(width / 2, 210, `Daily Interest: +${formatMoney(amount)}`, {
      fontSize: '14px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Animate and remove
    this.tweens.add({
      targets: [notifBg, notifIcon, notifText],
      alpha: { from: 1, to: 0 },
      y: '-=30',
      duration: 1500,
      delay: 2500,
      onComplete: () => {
        notifBg.destroy()
        notifIcon.destroy()
        notifText.destroy()
      }
    })
  }

  // ==================== LOAN INTEREST ====================
  checkLoanInterest() {
    const player = gameManager.player || getPlayerData()
    if (!player.loan || player.loan <= 0) return

    const now = Date.now()
    const lastLoanCheck = player.lastLoanInterestDate || now
    const oneDayMs = 24 * 60 * 60 * 1000 // 24 hours

    // Apply 5% daily interest on loans
    if (now - lastLoanCheck >= oneDayMs) {
      const daysPassed = Math.floor((now - lastLoanCheck) / oneDayMs)
      const interestRate = 0.05 // 5% daily

      for (let i = 0; i < daysPassed; i++) {
        const interest = Math.floor(player.loan * interestRate)
        player.loan += interest
      }

      player.lastLoanInterestDate = now
      savePlayerData(player)
      gameManager.player = player

      if (daysPassed > 0) {
        this.showLoanInterestWarning(daysPassed)
      }
    }
  }

  showLoanInterestWarning(days) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    const warningBg = this.add.rectangle(width / 2, 200, 280, 60, 0x450a0a, 0.98)
      .setStrokeStyle(2, 0xef4444)
      .setDepth(DEPTH.MODAL)

    const warningText = this.add.text(width / 2, 200, `⚠️ Loan interest accrued!\nYou now owe: ${formatMoney(player.loan)}`, {
      fontSize: '12px',
      color: '#ef4444',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    this.tweens.add({
      targets: [warningBg, warningText],
      alpha: { from: 1, to: 0 },
      duration: 1000,
      delay: 3000,
      onComplete: () => {
        warningBg.destroy()
        warningText.destroy()
      }
    })
  }

  // ==================== LOANS TAB ====================
  renderLoansTab() {
    const { width, height } = this.cameras.main
    const startY = 180
    const player = gameManager.player || getPlayerData()
    const currentLoan = player.loan || 0
    const maxLoan = this.calculateMaxLoan(player)

    // Loan status header
    const headerBg = this.add.rectangle(width / 2, startY + 25, width - 40, 60, currentLoan > 0 ? 0x3a1a1a : 0x0d1a14)
      .setStrokeStyle(1, currentLoan > 0 ? 0xef4444 : 0x22c55e, 0.5)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(headerBg)

    const statusLabel = this.add.text(25, startY + 8, currentLoan > 0 ? '💳 CURRENT DEBT' : '✅ NO OUTSTANDING LOANS', {
      fontSize: '10px',
      color: currentLoan > 0 ? '#ef4444' : '#22c55e'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(statusLabel)

    if (currentLoan > 0) {
      const debtText = this.add.text(25, startY + 30, formatMoney(currentLoan), {
        fontSize: '18px',
        color: '#ef4444',
        fontStyle: 'bold'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(debtText)

      const interestInfo = this.add.text(width - 25, startY + 25, '5% daily\ninterest', {
        fontSize: '9px',
        color: '#f87171',
        align: 'right'
      }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(interestInfo)
    } else {
      const cleanText = this.add.text(25, startY + 32, 'Debt-free!', {
        fontSize: '14px',
        color: '#22c55e'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(cleanText)
    }

    // Loan options section
    const optionsY = startY + 80
    const optionsLabel = this.add.text(25, optionsY, '🏦 LOAN OPTIONS', {
      fontSize: '11px',
      color: '#daa520',
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(optionsLabel)

    const maxLoanText = this.add.text(width - 25, optionsY, `Max loan: ${formatMoney(maxLoan)}`, {
      fontSize: '9px',
      color: '#888888'
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(maxLoanText)

    // Loan amount options
    const loanAmounts = [1000, 5000, 10000, 25000, 50000]
    const cardStartY = optionsY + 25

    loanAmounts.forEach((amount, index) => {
      const y = cardStartY + index * 50
      const canBorrow = currentLoan === 0 && amount <= maxLoan

      const cardBg = this.add.rectangle(width / 2, y + 20, width - 40, 42, canBorrow ? 0x1e293b : 0x1a1a2a, 0.95)
        .setStrokeStyle(1, canBorrow ? 0xdaa520 : 0x333333, canBorrow ? 0.5 : 0.3)
        .setDepth(DEPTH.PANELS)
      this.contentItems.push(cardBg)

      const amountText = this.add.text(30, y + 15, formatMoney(amount), {
        fontSize: '14px',
        color: canBorrow ? '#ffffff' : '#555555',
        fontStyle: 'bold'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(amountText)

      const repayText = this.add.text(30, y + 32, `Repay: ${formatMoney(Math.floor(amount * 1.05))} (+5%)`, {
        fontSize: '9px',
        color: canBorrow ? '#f59e0b' : '#444444'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(repayText)

      if (canBorrow) {
        const borrowBtn = this.add.rectangle(width - 55, y + 20, 60, 32, 0xdaa520)
          .setInteractive({ useHandCursor: true })
          .setDepth(DEPTH.PANEL_CONTENT)
        this.contentItems.push(borrowBtn)

        borrowBtn.on('pointerover', () => borrowBtn.setFillStyle(0xb8860b))
        borrowBtn.on('pointerout', () => borrowBtn.setFillStyle(0xdaa520))
        borrowBtn.on('pointerdown', () => this.takeLoan(amount))

        const btnText = this.add.text(width - 55, y + 20, 'BORROW', {
          fontSize: '9px',
          color: '#000000',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
        this.contentItems.push(btnText)
      } else if (currentLoan > 0) {
        const lockedText = this.add.text(width - 55, y + 20, '🔒', {
          fontSize: '16px'
        }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
        this.contentItems.push(lockedText)
      }
    })

    // Repay section (if has loan)
    if (currentLoan > 0) {
      const repayY = height - 120

      const repayBg = this.add.rectangle(width / 2, repayY + 30, width - 40, 80, 0x1a2a1a)
        .setStrokeStyle(1, 0x22c55e, 0.5)
        .setDepth(DEPTH.PANELS)
      this.contentItems.push(repayBg)

      const repayLabel = this.add.text(25, repayY + 5, '💰 REPAY LOAN', {
        fontSize: '11px',
        color: '#22c55e',
        fontStyle: 'bold'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(repayLabel)

      const canRepayFull = (player.cash || 0) >= currentLoan
      const canRepayPartial = (player.cash || 0) >= Math.min(1000, currentLoan)

      // Repay $1000 button
      const partial1kBtn = this.add.rectangle(width / 2 - 70, repayY + 45, 80, 35, canRepayPartial ? 0x22c55e : 0x444444)
        .setInteractive({ useHandCursor: canRepayPartial })
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(partial1kBtn)

      if (canRepayPartial) {
        partial1kBtn.on('pointerover', () => partial1kBtn.setFillStyle(0x16a34a))
        partial1kBtn.on('pointerout', () => partial1kBtn.setFillStyle(0x22c55e))
        partial1kBtn.on('pointerdown', () => this.repayLoan(Math.min(1000, currentLoan)))
      }

      const partial1kText = this.add.text(width / 2 - 70, repayY + 45, '$1K', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(partial1kText)

      // Repay Full button
      const fullBtn = this.add.rectangle(width / 2 + 50, repayY + 45, 100, 35, canRepayFull ? 0x22c55e : 0x444444)
        .setInteractive({ useHandCursor: canRepayFull })
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(fullBtn)

      if (canRepayFull) {
        fullBtn.on('pointerover', () => fullBtn.setFillStyle(0x16a34a))
        fullBtn.on('pointerout', () => fullBtn.setFillStyle(0x22c55e))
        fullBtn.on('pointerdown', () => this.repayLoan(currentLoan))
      }

      const fullText = this.add.text(width / 2 + 50, repayY + 45, 'PAY FULL', {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(fullText)
    }

    // Warning info
    const infoY = height - 30
    const infoBg = this.add.rectangle(width / 2, infoY, width - 40, 35, 0x0d0d1a)
      .setStrokeStyle(1, 0x222233)
      .setDepth(DEPTH.PANELS)
    this.contentItems.push(infoBg)

    const infoText = this.add.text(width / 2, infoY, '⚠️ Unpaid loans grow 5% daily! Pay off ASAP.', {
      fontSize: '9px',
      color: '#f59e0b'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(infoText)
  }

  calculateMaxLoan(player) {
    // Max loan based on player level and assets
    const level = player.level || 1
    const bankBalance = player.bank || 0
    const portfolioValue = this.calculatePortfolioValue(player)

    // Base: $5000 + $5000 per level + 50% of bank + 25% of portfolio
    return Math.floor(5000 + (level * 5000) + (bankBalance * 0.5) + (portfolioValue * 0.25))
  }

  takeLoan(amount) {
    const player = gameManager.player || getPlayerData()

    if (player.loan && player.loan > 0) {
      this.showStatus('Pay off current loan first!', '#ef4444')
      return
    }

    const maxLoan = this.calculateMaxLoan(player)
    if (amount > maxLoan) {
      this.showStatus('Amount exceeds your loan limit!', '#ef4444')
      return
    }

    player.loan = amount
    player.loanOriginal = amount
    player.loanDate = Date.now()
    player.lastLoanInterestDate = Date.now()
    player.cash = (player.cash || 0) + amount

    savePlayerData(player)
    gameManager.player = player

    this.updateBalances()
    this.showStatus(`Borrowed ${formatMoney(amount)}!`, '#daa520')
    this.renderContent()

    try { audioManager.playCashGain(amount) } catch (e) { /* ignore */ }
  }

  repayLoan(amount) {
    const player = gameManager.player || getPlayerData()
    const currentLoan = player.loan || 0

    if (currentLoan <= 0) {
      this.showStatus('No loan to repay!', '#f59e0b')
      return
    }

    const repayAmount = Math.min(amount, currentLoan, player.cash || 0)

    if (repayAmount <= 0) {
      this.showStatus('Not enough cash!', '#ef4444')
      return
    }

    player.cash -= repayAmount
    player.loan -= repayAmount

    if (player.loan <= 0) {
      player.loan = 0
      player.loanOriginal = 0
      player.loanDate = null
      this.showStatus('🎉 Loan paid off!', '#22c55e')
      this.cameras.main.flash(200, 34, 197, 94)
    } else {
      this.showStatus(`Repaid ${formatMoney(repayAmount)}. Remaining: ${formatMoney(player.loan)}`, '#3b82f6')
    }

    savePlayerData(player)
    gameManager.player = player

    this.updateBalances()
    this.renderContent()

    try { audioManager.playClick() } catch (e) { /* ignore */ }
  }

  // Get or generate stock prices with persistence
  getOrGenerateStockPrices() {
    const STOCK_UPDATE_INTERVAL = 300000 // 5 minutes
    const BASE_STOCKS = [
      { symbol: 'STRM', name: 'Street Motors', basePrice: 175, volatility: 50 },
      { symbol: 'DRGS', name: 'Corner Pharma', basePrice: 87, volatility: 25 },
      { symbol: 'GUNS', name: 'Iron Works', basePrice: 250, volatility: 100 },
      { symbol: 'CRPT', name: 'Shadow Crypto', basePrice: 125, volatility: 150 },
      { symbol: 'TERR', name: 'Turf Holdings', basePrice: 135, volatility: 30 }
    ]

    // Try to get stored stock data
    let stockData
    try {
      const stored = localStorage.getItem('street_legacy_stocks')
      stockData = stored ? JSON.parse(stored) : null
    } catch (e) {
      stockData = null
    }

    const now = Date.now()

    // Check if we need to update prices
    if (!stockData || !stockData.prices || (now - stockData.lastUpdate) > STOCK_UPDATE_INTERVAL) {
      // Generate new prices based on previous prices or base
      const newPrices = BASE_STOCKS.map(stock => {
        let prevPrice = stockData?.prices?.find(s => s.symbol === stock.symbol)?.price || stock.basePrice

        // Apply market movement (+/- volatility%)
        const maxChange = Math.floor(prevPrice * (stock.volatility / 100) * 0.1)
        const change = Math.floor(Math.random() * maxChange * 2) - maxChange

        // Keep prices within reasonable bounds
        let newPrice = Math.max(
          Math.floor(stock.basePrice * 0.5),
          Math.min(Math.floor(stock.basePrice * 2), prevPrice + change)
        )

        return {
          symbol: stock.symbol,
          name: stock.name,
          price: newPrice,
          change: change
        }
      })

      // Save new prices
      stockData = {
        prices: newPrices,
        lastUpdate: now
      }
      try {
        localStorage.setItem('street_legacy_stocks', JSON.stringify(stockData))
      } catch (e) {
        console.error('[BankScene] Failed to save stock prices:', e)
      }
    }

    return stockData.prices
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
