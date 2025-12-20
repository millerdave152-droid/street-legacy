import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { narrativeService } from '../../services/narrativeSystems.service'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
import { gameManager } from '../GameManager'
import { getPlayerData, savePlayerData } from '../data/GameData'
import { formatMoney } from '../../utils/formatters'

/**
 * DebtScene - Debt Economy Management
 *
 * Features:
 * - Two tabs: "Owed To Me" / "I Owe"
 * - Debt cards with creditor/debtor name, type, value, status, due date
 * - Action buttons: Call In, Fulfill, Transfer, Forgive
 * - Debt marketplace section for buying/selling
 * - Color coding by status (red=called_in, green=fulfilled, yellow=outstanding)
 * - Mobile-first touch scrolling
 */
export class DebtScene extends BaseScene {
  constructor() {
    super('DebtScene')
  }

  create() {
    super.create()

    // Constants
    this.CARD_HEIGHT = 130
    this.CARD_PADDING = 10
    this.HEADER_HEIGHT = 120
    this.TAB_HEIGHT = 45
    this.SCROLL_START_Y = this.HEADER_HEIGHT + this.TAB_HEIGHT + 10
    this.SCROLL_END_Y = this.height - 20

    // Debt type configurations
    this.DEBT_TYPES = {
      favor: { icon: '🤝', color: 0x8b5cf6, label: 'Favor' },
      loan: { icon: '💵', color: 0x22c55e, label: 'Loan' },
      blood_debt: { icon: '🩸', color: 0xef4444, label: 'Blood Debt' },
      service: { icon: '⚙️', color: 0x3b82f6, label: 'Service' },
      protection: { icon: '🛡️', color: 0xf59e0b, label: 'Protection' },
      information: { icon: '🔍', color: 0x06b6d4, label: 'Information' }
    }

    // Status configurations
    this.STATUS_COLORS = {
      outstanding: { bg: 0x3a3a1a, stroke: 0xf59e0b, label: 'Outstanding', textColor: '#f59e0b' },
      called_in: { bg: 0x3a1a1a, stroke: 0xef4444, label: 'Called In', textColor: '#ef4444' },
      fulfilled: { bg: 0x1a3a1a, stroke: 0x22c55e, label: 'Fulfilled', textColor: '#22c55e' },
      defaulted: { bg: 0x2a1a1a, stroke: 0x991b1b, label: 'Defaulted', textColor: '#991b1b' },
      forgiven: { bg: 0x1a2a3a, stroke: 0x6b7280, label: 'Forgiven', textColor: '#6b7280' },
      transferred: { bg: 0x2a2a3a, stroke: 0x8b5cf6, label: 'Transferred', textColor: '#8b5cf6' }
    }

    // NPC Names for debt system
    this.NPC_NAMES = [
      'Tony "The Shark" Marino', 'Big Mike', 'Slick Eddie', 'Carmen Rosa',
      'The Professor', 'Lucky Lou', 'Snake Eyes Sam', 'Vinnie Bags',
      'Maria "Ice" Santos', 'Frankie Knuckles', 'The Accountant', 'Red Murphy',
      'Silent Joe', 'Mama Chen', 'Duke Williams', 'Crazy Pete'
    ]

    // State
    this.debtsOwedToMe = []
    this.debtsIOwe = []
    this.marketplace = []
    this.contentItems = []
    this.scrollOffset = 0
    this.maxScrollOffset = 0
    this.activeTab = 'owedToMe'
    this.isLoading = true
    this.selectedDebt = null

    // Create UI
    this.createBackground()
    this.createHeader()
    this.createTabs()
    this.createCloseButton()
    this.createLoadingSpinner()
    this.setupScrolling()

    // Load data
    this.loadData()
  }

  createBackground() {
    this.add.rectangle(0, 0, this.width, this.height, 0x0a0a15, 1)
      .setOrigin(0)
      .setDepth(0)
      .setInteractive()
  }

  createHeader() {
    // Header background
    this.add.rectangle(0, 0, this.width, this.HEADER_HEIGHT, 0x12121f, 1)
      .setOrigin(0)
      .setDepth(10)

    // Title
    this.add.text(this.centerX, 35, '💰 DEBT LEDGER', {
      fontSize: '22px',
      color: '#f59e0b',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Summary stats
    this.summaryText = this.add.text(this.centerX, 65, 'Loading...', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(11)

    // Net worth indicator
    this.netWorthText = this.add.text(this.centerX, 90, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Create new debt button
    const newDebtBtn = this.add.rectangle(30, 35, 50, 30, 0x22c55e, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(11)

    this.add.text(30, 35, '+ New', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)

    newDebtBtn.on('pointerover', () => newDebtBtn.setFillStyle(0x16a34a))
    newDebtBtn.on('pointerout', () => newDebtBtn.setFillStyle(0x22c55e, 0.9))
    newDebtBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.showCreateDebtModal()
    })

    // Divider
    this.add.rectangle(this.centerX, this.HEADER_HEIGHT - 5, this.width - 40, 1, 0x333333)
      .setDepth(11)
  }

  createTabs() {
    const tabY = this.HEADER_HEIGHT + this.TAB_HEIGHT / 2
    const tabWidth = (this.width - 50) / 3
    const startX = 25 + tabWidth / 2

    this.tabs = {}

    const tabConfigs = [
      { key: 'owedToMe', label: '💎 Owed To Me', color: 0x22c55e },
      { key: 'iOwe', label: '📋 I Owe', color: 0xef4444 },
      { key: 'marketplace', label: '🏪 Market', color: 0x8b5cf6 }
    ]

    tabConfigs.forEach((config, index) => {
      const x = startX + index * (tabWidth + 10)
      const isActive = config.key === this.activeTab

      const bg = this.add.rectangle(x, tabY, tabWidth, 36, isActive ? config.color : 0x2a2a4a, 0.95)
        .setInteractive({ useHandCursor: true })
        .setDepth(11)

      const text = this.add.text(x, tabY, config.label, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: isActive ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(12)

      // Count badge
      const countBadge = this.add.circle(x + tabWidth / 2 - 10, tabY - 12, 10, 0x333333)
        .setDepth(12)
        .setVisible(false)

      const countText = this.add.text(x + tabWidth / 2 - 10, tabY - 12, '0', {
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(13).setVisible(false)

      bg.on('pointerover', () => {
        if (this.activeTab !== config.key) {
          bg.setFillStyle(0x3a3a5a, 0.95)
          audioManager.playHover()
        }
      })

      bg.on('pointerout', () => {
        if (this.activeTab !== config.key) {
          bg.setFillStyle(0x2a2a4a, 0.95)
        }
      })

      bg.on('pointerdown', () => {
        if (!this.isLoading) {
          audioManager.playClick()
          this.switchTab(config.key)
        }
      })

      this.tabs[config.key] = { bg, text, config, countBadge, countText }
    })
  }

  switchTab(tab) {
    if (this.activeTab === tab) return

    this.activeTab = tab
    this.scrollOffset = 0

    // Update tab styles
    Object.keys(this.tabs).forEach(key => {
      const isActive = key === tab
      const { bg, text, config } = this.tabs[key]
      bg.setFillStyle(isActive ? config.color : 0x2a2a4a, 0.95)
      text.setStyle({ fontStyle: isActive ? 'bold' : 'normal' })
    })

    this.renderContent()
  }

  updateTabCounts() {
    const counts = {
      owedToMe: this.debtsOwedToMe.filter(d => d.status === 'outstanding' || d.status === 'called_in').length,
      iOwe: this.debtsIOwe.filter(d => d.status === 'outstanding' || d.status === 'called_in').length,
      marketplace: this.marketplace.length
    }

    Object.keys(this.tabs).forEach(key => {
      const { countBadge, countText } = this.tabs[key]
      const count = counts[key] || 0

      if (count > 0) {
        countBadge.setVisible(true)
        countText.setVisible(true)
        countText.setText(count > 99 ? '99+' : count.toString())
      } else {
        countBadge.setVisible(false)
        countText.setVisible(false)
      }
    })
  }

  createCloseButton() {
    const closeBtn = this.add.text(this.width - 25, 30, '✕', {
      fontSize: '28px',
      color: '#ffffff'
    })
      .setOrigin(0.5)
      .setDepth(999)
      .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ef4444')
      closeBtn.setScale(1.1)
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

  createLoadingSpinner() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    this.loadingContainer = this.add.container(this.centerX, centerY).setDepth(50)

    const spinner = this.add.circle(0, -20, 20, 0x333333, 0)
    spinner.setStrokeStyle(3, 0xf59e0b)
    this.loadingContainer.add(spinner)

    const loadingText = this.add.text(0, 20, 'Loading debts...', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5)
    this.loadingContainer.add(loadingText)

    this.tweens.add({
      targets: spinner,
      angle: 360,
      duration: 1000,
      repeat: -1
    })
  }

  hideLoadingSpinner() {
    if (this.loadingContainer) {
      this.loadingContainer.setVisible(false)
    }
  }

  setupScrolling() {
    // Mouse wheel
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isLoading) {
        this.scrollOffset = Phaser.Math.Clamp(
          this.scrollOffset + deltaY * 0.5,
          0,
          this.maxScrollOffset
        )
        this.renderContent()
      }
    })

    // Touch scrolling
    let startY = 0
    let startOffset = 0
    let velocity = 0
    let lastY = 0

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.SCROLL_START_Y && pointer.y < this.SCROLL_END_Y) {
        startY = pointer.y
        lastY = pointer.y
        startOffset = this.scrollOffset
        velocity = 0
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && startY > 0 && !this.isLoading) {
        const deltaY = startY - pointer.y
        velocity = lastY - pointer.y
        lastY = pointer.y
        this.scrollOffset = Math.max(0, startOffset + deltaY)
        this.renderContent()
      }
    })

    this.input.on('pointerup', () => {
      if (Math.abs(velocity) > 2) {
        this.applyMomentum(velocity * 5)
      }
      startY = 0
    })
  }

  applyMomentum(velocity) {
    this.tweens.add({
      targets: { offset: this.scrollOffset },
      offset: Phaser.Math.Clamp(this.scrollOffset + velocity, 0, this.maxScrollOffset),
      duration: 500,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        this.scrollOffset = tween.getValue()
        this.renderContent()
      }
    })
  }

  async loadData() {
    this.isLoading = true
    this.clearContent()

    try {
      // Try API first
      const [debts, market] = await Promise.all([
        narrativeService.getMyDebts(),
        narrativeService.getDebtMarketplace()
      ])

      this.debtsOwedToMe = debts.owedToMe || []
      this.debtsIOwe = debts.owedByMe || []
      this.marketplace = market || []

    } catch (error) {
      console.log('[DebtScene] Using local data fallback')
      // Fallback to local storage
      this.loadLocalData()
    }

    this.updateSummary()
    this.updateTabCounts()

    this.isLoading = false
    this.hideLoadingSpinner()
    this.renderContent()
  }

  loadLocalData() {
    const player = gameManager.player || getPlayerData()

    // Initialize debts in player data if not exists
    if (!player.debts) {
      player.debts = {
        owedToMe: [],
        owedByMe: [],
        marketplace: this.generateInitialMarketplace()
      }
      // Generate some starter debts for new players
      if ((player.level || 1) >= 2) {
        player.debts.owedToMe = this.generateStarterDebts(2, true)
        player.debts.owedByMe = this.generateStarterDebts(1, false)
      }
      savePlayerData(player)
      gameManager.player = player
    }

    this.debtsOwedToMe = player.debts.owedToMe || []
    this.debtsIOwe = player.debts.owedByMe || []
    this.marketplace = player.debts.marketplace || []
  }

  generateStarterDebts(count, isCreditor) {
    const debts = []
    const types = ['favor', 'loan', 'service', 'protection', 'information']

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)]
      const value = this.getDebtValueByType(type)
      const npcName = this.NPC_NAMES[Math.floor(Math.random() * this.NPC_NAMES.length)]

      debts.push({
        id: `debt_${Date.now()}_${i}`,
        debtType: type,
        value: value,
        status: 'outstanding',
        description: this.getDebtDescription(type, isCreditor),
        [isCreditor ? 'debtorName' : 'creditorName']: npcName,
        [isCreditor ? 'debtorId' : 'creditorId']: `npc_${i}`,
        createdAt: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        dueDate: Date.now() + (7 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000
      })
    }
    return debts
  }

  generateInitialMarketplace() {
    const listings = []
    const types = ['favor', 'loan', 'blood_debt', 'service']

    for (let i = 0; i < 3; i++) {
      const type = types[Math.floor(Math.random() * types.length)]
      const originalValue = this.getDebtValueByType(type)
      const discount = 0.1 + Math.random() * 0.3 // 10-40% discount

      listings.push({
        id: `market_${Date.now()}_${i}`,
        debtType: type,
        originalValue: originalValue,
        askingPrice: Math.floor(originalValue * (1 - discount)),
        debtorName: this.NPC_NAMES[Math.floor(Math.random() * this.NPC_NAMES.length)],
        sellerName: this.NPC_NAMES[Math.floor(Math.random() * this.NPC_NAMES.length)],
        description: this.getDebtDescription(type, true)
      })
    }
    return listings
  }

  getDebtValueByType(type) {
    const values = {
      favor: 500 + Math.floor(Math.random() * 1000),
      loan: 1000 + Math.floor(Math.random() * 4000),
      blood_debt: 5000 + Math.floor(Math.random() * 10000),
      service: 800 + Math.floor(Math.random() * 1200),
      protection: 1500 + Math.floor(Math.random() * 2000),
      information: 600 + Math.floor(Math.random() * 900)
    }
    return values[type] || 1000
  }

  getDebtDescription(type, isCreditor) {
    const descriptions = {
      favor: isCreditor
        ? ['Helped them escape a tight spot', 'Covered for them with the boss', 'Introduced them to a contact']
        : ['They got you out of jail', 'They vouched for you', 'They saved your business'],
      loan: isCreditor
        ? ['Emergency cash loan', 'Business investment loan', 'Bail money']
        : ['Borrowed for a job', 'Needed startup cash', 'Emergency funds'],
      blood_debt: isCreditor
        ? ['Saved their life', 'Took a bullet for them', 'Protected their family']
        : ['They saved your life', 'Risked everything for you', 'Protected someone you love'],
      service: isCreditor
        ? ['Did a job for free', 'Provided muscle', 'Made an introduction']
        : ['They handled a problem', 'They did dirty work', 'They took a risk for you'],
      protection: isCreditor
        ? ['Kept their territory safe', 'Scared off enemies', 'Provided security']
        : ['They watch your back', 'They keep you safe', 'They handle threats'],
      information: isCreditor
        ? ['Shared valuable intel', 'Warned about a raid', 'Gave inside information']
        : ['They tipped you off', 'They shared secrets', 'They kept you informed']
    }
    const options = descriptions[type] || ['General debt']
    return options[Math.floor(Math.random() * options.length)]
  }

  saveDebts() {
    const player = gameManager.player || getPlayerData()
    player.debts = {
      owedToMe: this.debtsOwedToMe,
      owedByMe: this.debtsIOwe,
      marketplace: this.marketplace
    }
    savePlayerData(player)
    gameManager.player = player
  }

  updateSummary() {
    const owedToMeTotal = this.debtsOwedToMe
      .filter(d => d.status === 'outstanding' || d.status === 'called_in')
      .reduce((sum, d) => sum + (d.value || 0), 0)

    const iOweTotal = this.debtsIOwe
      .filter(d => d.status === 'outstanding' || d.status === 'called_in')
      .reduce((sum, d) => sum + (d.value || 0), 0)

    const netWorth = owedToMeTotal - iOweTotal

    this.summaryText.setText(
      `Credits: $${owedToMeTotal.toLocaleString()} | Debts: $${iOweTotal.toLocaleString()}`
    )

    // Net worth with color
    const netColor = netWorth >= 0 ? '#22c55e' : '#ef4444'
    const netSign = netWorth >= 0 ? '+' : ''
    this.netWorthText.setText(`Net: ${netSign}$${netWorth.toLocaleString()}`)
    this.netWorthText.setColor(netColor)
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    switch (this.activeTab) {
      case 'owedToMe':
        this.renderDebtList(this.debtsOwedToMe, true)
        break
      case 'iOwe':
        this.renderDebtList(this.debtsIOwe, false)
        break
      case 'marketplace':
        this.renderMarketplace()
        break
    }
  }

  renderDebtList(debts, isCreditor) {
    if (debts.length === 0) {
      this.renderEmptyState(isCreditor)
      return
    }

    // Sort: called_in first, then outstanding, then others
    const sortedDebts = [...debts].sort((a, b) => {
      const priority = { called_in: 0, outstanding: 1, fulfilled: 2, defaulted: 3, forgiven: 4 }
      return (priority[a.status] || 5) - (priority[b.status] || 5)
    })

    let y = this.SCROLL_START_Y - this.scrollOffset

    sortedDebts.forEach((debt, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 20 && cardY < this.SCROLL_END_Y + 20) {
        this.renderDebtCard(debt, cardY, isCreditor)
      }
    })

    // Calculate max scroll
    const totalHeight = sortedDebts.length * (this.CARD_HEIGHT + this.CARD_PADDING)
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight + 20)
  }

  renderDebtCard(debt, y, isCreditor) {
    const cardWidth = this.width - 30
    const x = this.centerX

    const typeConfig = this.DEBT_TYPES[debt.debtType] || this.DEBT_TYPES.favor
    const statusConfig = this.STATUS_COLORS[debt.status] || this.STATUS_COLORS.outstanding

    // Card background
    const cardBg = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth, this.CARD_HEIGHT - 4,
      statusConfig.bg, 0.95)
    cardBg.setStrokeStyle(2, statusConfig.stroke, 0.8)
    this.contentItems.push(cardBg)

    // Left color bar
    const colorBar = this.add.rectangle(x - cardWidth / 2 + 4, y + this.CARD_HEIGHT / 2, 4,
      this.CARD_HEIGHT - 8, typeConfig.color)
    this.contentItems.push(colorBar)

    // Type icon
    const iconX = x - cardWidth / 2 + 35
    const icon = this.add.text(iconX, y + 30, typeConfig.icon, {
      fontSize: '24px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Type label
    const typeLabel = this.add.text(iconX, y + 55, typeConfig.label, {
      fontSize: '9px',
      color: `#${typeConfig.color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(typeLabel)

    // Person name (creditor or debtor)
    const textX = x - cardWidth / 2 + 70
    const personLabel = isCreditor ? 'From:' : 'To:'
    const personName = isCreditor ? (debt.debtorName || debt.debtorId) : (debt.creditorName || debt.creditorId)

    const personText = this.add.text(textX, y + 18, `${personLabel} ${personName}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentItems.push(personText)

    // Status badge
    const statusBadge = this.add.rectangle(textX + personText.width + 15, y + 18, 70, 18,
      statusConfig.stroke, 0.3)
    this.contentItems.push(statusBadge)

    const statusText = this.add.text(textX + personText.width + 15, y + 18, statusConfig.label.toUpperCase(), {
      fontSize: '9px',
      color: statusConfig.textColor,
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(statusText)

    // Description
    let desc = debt.description || 'No description'
    if (desc.length > 50) desc = desc.substring(0, 50) + '...'

    const descText = this.add.text(textX, y + 42, desc, {
      fontSize: '11px',
      color: '#888888',
      wordWrap: { width: cardWidth - 170 }
    })
    this.contentItems.push(descText)

    // Value
    const valueX = x + cardWidth / 2 - 60
    const valueText = this.add.text(valueX, y + 20, `$${(debt.value || 0).toLocaleString()}`, {
      fontSize: '16px',
      color: isCreditor ? '#22c55e' : '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(valueText)

    // Due date if exists
    if (debt.dueDate) {
      const dueDate = new Date(debt.dueDate)
      const isOverdue = dueDate < new Date()
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24))

      let dueText = isOverdue ? 'OVERDUE' : `${daysLeft}d left`
      const dueColor = isOverdue ? '#ef4444' : (daysLeft <= 3 ? '#f59e0b' : '#888888')

      const dueDateText = this.add.text(valueX, y + 42, `⏱ ${dueText}`, {
        fontSize: '10px',
        color: dueColor
      }).setOrigin(0.5)
      this.contentItems.push(dueDateText)
    }

    // Action buttons (only for active debts)
    if (debt.status === 'outstanding' || debt.status === 'called_in') {
      this.renderDebtActions(debt, y, cardWidth, x, isCreditor)
    }

    // Trust indicator
    if (debt.trustBonus) {
      const trustText = this.add.text(textX, y + this.CARD_HEIGHT - 25, `🤝 Trust bonus: +${debt.trustBonus}`, {
        fontSize: '10px',
        color: '#22c55e'
      })
      this.contentItems.push(trustText)
    }
  }

  renderDebtActions(debt, y, cardWidth, x, isCreditor) {
    const btnY = y + this.CARD_HEIGHT - 25
    const btnHeight = 28
    const btnSpacing = 5

    if (isCreditor) {
      // Creditor actions depend on status
      let actions = []

      if (debt.status === 'called_in') {
        // Can collect or forgive
        actions = [
          { label: '💰 Collect', color: 0x22c55e, action: () => this.collectDebt(debt) },
          { label: '🛒 Sell', color: 0x8b5cf6, action: () => this.showSellDebtModal(debt) },
          { label: '🕊️ Forgive', color: 0x6b7280, action: () => this.forgiveDebt(debt) }
        ]
      } else {
        // Can call in, transfer, or forgive
        actions = [
          { label: '📞 Call In', color: 0xf59e0b, action: () => this.callInDebt(debt) },
          { label: '🛒 Sell', color: 0x8b5cf6, action: () => this.showSellDebtModal(debt) },
          { label: '🕊️ Forgive', color: 0x6b7280, action: () => this.forgiveDebt(debt) }
        ]
      }

      const startX = x - cardWidth / 2 + 70

      actions.forEach((action, index) => {
        const btnX = startX + index * (75 + btnSpacing) + 37.5
        this.createActionButton(btnX, btnY, 72, btnHeight, action.label, action.color, action.action, action.disabled)
      })
    } else {
      // Debtor actions: Fulfill (if called in)
      if (debt.status === 'called_in') {
        const btnX = x - cardWidth / 2 + 70 + 50
        this.createActionButton(btnX, btnY, 100, btnHeight, '💵 Pay Now', 0x22c55e, () => this.fulfillDebt(debt))
      } else if (debt.status === 'outstanding') {
        const btnX = x - cardWidth / 2 + 70 + 50
        this.createActionButton(btnX, btnY, 100, btnHeight, '💵 Pay Early', 0x3b82f6, () => this.fulfillDebt(debt))
      }
    }
  }

  createActionButton(x, y, width, height, label, color, onClick, disabled = false) {
    const bg = this.add.rectangle(x, y, width, height, disabled ? 0x333333 : color, disabled ? 0.5 : 0.9)
      .setInteractive({ useHandCursor: !disabled })
    this.contentItems.push(bg)

    const text = this.add.text(x, y, label, {
      fontSize: '10px',
      color: disabled ? '#666666' : '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(text)

    if (!disabled) {
      bg.on('pointerover', () => {
        bg.setFillStyle(color, 1)
        audioManager.playHover()
      })
      bg.on('pointerout', () => bg.setFillStyle(color, 0.9))
      bg.on('pointerdown', () => {
        audioManager.playClick()
        onClick()
      })
    }

    return { bg, text }
  }

  renderMarketplace() {
    if (this.marketplace.length === 0) {
      this.renderEmptyMarketplace()
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // Add "Sell Your Debt" button at top
    const sellBtnY = y + 25
    this.createActionButton(this.centerX, sellBtnY, 200, 40, '💰 List Debt For Sale', 0x8b5cf6, () => this.showSellDebtModal())
    y += 70

    this.marketplace.forEach((listing, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 20 && cardY < this.SCROLL_END_Y + 20) {
        this.renderMarketplaceListing(listing, cardY)
      }
    })

    const totalHeight = 70 + this.marketplace.length * (this.CARD_HEIGHT + this.CARD_PADDING)
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight + 20)
  }

  renderMarketplaceListing(listing, y) {
    const cardWidth = this.width - 30
    const x = this.centerX

    const typeConfig = this.DEBT_TYPES[listing.debtType] || this.DEBT_TYPES.favor

    // Card background
    const cardBg = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth, this.CARD_HEIGHT - 4, 0x1a1a2a, 0.95)
    cardBg.setStrokeStyle(1, 0x8b5cf6, 0.6)
    this.contentItems.push(cardBg)

    // Type icon
    const iconX = x - cardWidth / 2 + 35
    const icon = this.add.text(iconX, y + 35, typeConfig.icon, {
      fontSize: '28px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Seller info
    const textX = x - cardWidth / 2 + 70

    const sellerText = this.add.text(textX, y + 18, `Seller: ${listing.sellerName || 'Anonymous'}`, {
      fontSize: '12px',
      color: '#aaaaaa'
    })
    this.contentItems.push(sellerText)

    // Debtor info
    const debtorText = this.add.text(textX, y + 38, `Debtor: ${listing.debtorName}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentItems.push(debtorText)

    // Original value
    const originalText = this.add.text(textX, y + 62, `Original: $${(listing.originalValue || 0).toLocaleString()}`, {
      fontSize: '11px',
      color: '#888888'
    })
    this.contentItems.push(originalText)

    // Description
    let desc = listing.description || typeConfig.label
    if (desc.length > 40) desc = desc.substring(0, 40) + '...'

    const descText = this.add.text(textX, y + 82, desc, {
      fontSize: '10px',
      color: '#666666'
    })
    this.contentItems.push(descText)

    // Asking price
    const priceX = x + cardWidth / 2 - 70

    const priceLabel = this.add.text(priceX, y + 25, 'ASKING', {
      fontSize: '9px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(priceLabel)

    const priceText = this.add.text(priceX, y + 45, `$${(listing.askingPrice || 0).toLocaleString()}`, {
      fontSize: '18px',
      color: '#8b5cf6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(priceText)

    // Discount indicator
    const discount = listing.originalValue > 0
      ? Math.round((1 - listing.askingPrice / listing.originalValue) * 100)
      : 0

    if (discount > 0) {
      const discountText = this.add.text(priceX, y + 65, `${discount}% OFF`, {
        fontSize: '10px',
        color: '#22c55e',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(discountText)
    }

    // Buy button
    this.createActionButton(priceX, y + this.CARD_HEIGHT - 25, 80, 30, '🛒 BUY', 0x22c55e, () => this.buyDebt(listing))
  }

  renderEmptyState(isCreditor) {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(this.centerX, centerY - 40, isCreditor ? '📭' : '✨', {
      fontSize: '56px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const title = this.add.text(this.centerX, centerY + 20,
      isCreditor ? 'No One Owes You' : "You're Debt Free!", {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
    this.contentItems.push(title)

    const msg = this.add.text(this.centerX, centerY + 55,
      isCreditor ? 'Start building your network of favors' : 'Keep it that way!', {
        fontSize: '13px',
        color: '#888888'
      }).setOrigin(0.5)
    this.contentItems.push(msg)
  }

  renderEmptyMarketplace() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    // Sell button at top
    this.createActionButton(this.centerX, this.SCROLL_START_Y + 25, 200, 40, '💰 List Debt For Sale', 0x8b5cf6, () => this.showSellDebtModal())

    const icon = this.add.text(this.centerX, centerY - 20, '🏪', {
      fontSize: '56px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const title = this.add.text(this.centerX, centerY + 40, 'Marketplace Empty', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(title)

    const msg = this.add.text(this.centerX, centerY + 75, 'No debts for sale right now', {
      fontSize: '13px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(msg)
  }

  renderError() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(this.centerX, centerY - 30, '⚠️', {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const title = this.add.text(this.centerX, centerY + 20, 'Failed to Load Debts', {
      fontSize: '18px',
      color: '#ef4444'
    }).setOrigin(0.5)
    this.contentItems.push(title)

    this.createActionButton(this.centerX, centerY + 70, 100, 36, '↻ Retry', 0x3b82f6, () => this.loadData())
  }

  // ============================================================================
  // Debt Actions
  // ============================================================================

  async callInDebt(debt) {
    try {
      // Try API first
      await narrativeService.callInDebt(debt.id)
    } catch (error) {
      // Local fallback
      const debtIndex = this.debtsOwedToMe.findIndex(d => d.id === debt.id)
      if (debtIndex !== -1) {
        this.debtsOwedToMe[debtIndex].status = 'called_in'
        this.debtsOwedToMe[debtIndex].calledInDate = Date.now()
        this.saveDebts()
      }
    }

    audioManager.playSuccess()
    notificationManager.showToast('Debt called in! They must pay up.', 'success')
    this.updateSummary()
    this.updateTabCounts()
    this.renderContent()
  }

  async fulfillDebt(debt) {
    const player = gameManager.player || getPlayerData()

    // Check if player has enough cash
    if ((player.cash || 0) < debt.value) {
      notificationManager.showToast(`Not enough cash! Need ${formatMoney(debt.value)}`, 'error')
      audioManager.playMiss()
      return
    }

    this.showConfirmModal(
      'Fulfill Debt?',
      `Pay ${formatMoney(debt.value)} to settle this debt?\n\nYour cash: ${formatMoney(player.cash || 0)}`,
      async () => {
        try {
          await narrativeService.fulfillDebt(debt.id)
        } catch (error) {
          // Local fallback
          const debtIndex = this.debtsIOwe.findIndex(d => d.id === debt.id)
          if (debtIndex !== -1) {
            this.debtsIOwe[debtIndex].status = 'fulfilled'
            this.debtsIOwe[debtIndex].fulfilledDate = Date.now()

            // Deduct cash
            player.cash -= debt.value
            player.respect = (player.respect || 0) + 5 // Trust bonus
            savePlayerData(player)
            gameManager.player = player

            this.saveDebts()
          }
        }

        audioManager.playSuccess()
        notificationManager.showToast('Debt fulfilled! +5 Respect', 'success')
        this.cameras.main.flash(200, 34, 197, 94)
        this.updateSummary()
        this.updateTabCounts()
        this.renderContent()
      }
    )
  }

  async forgiveDebt(debt) {
    this.showConfirmModal(
      'Forgive Debt?',
      `Forgiving this ${formatMoney(debt.value)} debt will gain you trust with ${debt.debtorName}.\n\nYou will NOT receive the money.`,
      async () => {
        try {
          await narrativeService.apiRequest?.(`/debts/${debt.id}/forgive`, 'POST')
        } catch (error) {
          // Local fallback
          const debtIndex = this.debtsOwedToMe.findIndex(d => d.id === debt.id)
          if (debtIndex !== -1) {
            this.debtsOwedToMe[debtIndex].status = 'forgiven'
            this.debtsOwedToMe[debtIndex].forgivenDate = Date.now()

            // Gain respect for forgiving
            const player = gameManager.player || getPlayerData()
            const respectGain = Math.floor(debt.value / 100)
            player.respect = (player.respect || 0) + respectGain
            savePlayerData(player)
            gameManager.player = player

            this.saveDebts()
          }
        }

        audioManager.playSuccess()
        notificationManager.showToast(`Debt forgiven! +${Math.floor(debt.value / 100)} Respect`, 'success')
        this.cameras.main.flash(200, 139, 92, 246)
        this.updateSummary()
        this.updateTabCounts()
        this.renderContent()
      }
    )
  }

  async collectDebt(debt) {
    // NPC pays up when debt is called in
    const player = gameManager.player || getPlayerData()

    // Random chance NPC refuses (10% for regular, 30% for blood debt)
    const refuseChance = debt.debtType === 'blood_debt' ? 0.3 : 0.1
    if (Math.random() < refuseChance) {
      // NPC defaults
      const debtIndex = this.debtsOwedToMe.findIndex(d => d.id === debt.id)
      if (debtIndex !== -1) {
        this.debtsOwedToMe[debtIndex].status = 'defaulted'
        this.saveDebts()
      }
      audioManager.playMiss()
      notificationManager.showToast(`${debt.debtorName} refused to pay! Debt defaulted.`, 'error')
      this.cameras.main.shake(200, 0.02)
    } else {
      // NPC pays
      player.cash = (player.cash || 0) + debt.value
      savePlayerData(player)
      gameManager.player = player

      const debtIndex = this.debtsOwedToMe.findIndex(d => d.id === debt.id)
      if (debtIndex !== -1) {
        this.debtsOwedToMe[debtIndex].status = 'fulfilled'
        this.debtsOwedToMe[debtIndex].fulfilledDate = Date.now()
        this.saveDebts()
      }

      audioManager.playSuccess()
      notificationManager.showToast(`Collected ${formatMoney(debt.value)} from ${debt.debtorName}!`, 'success')
      this.cameras.main.flash(200, 34, 197, 94)
    }

    this.updateSummary()
    this.updateTabCounts()
    this.renderContent()
  }

  showConfirmModal(title, message, onConfirm) {
    const modalBg = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 0.85)
      .setInteractive()
      .setDepth(100)
    this.contentItems.push(modalBg)

    const modalWidth = this.width - 80
    const modalHeight = 200
    const modalY = this.centerY

    const modal = this.add.rectangle(this.centerX, modalY, modalWidth, modalHeight, 0x1a1a2a, 0.98)
    modal.setStrokeStyle(2, 0xf59e0b, 0.8)
    modal.setDepth(101)
    this.contentItems.push(modal)

    const titleText = this.add.text(this.centerX, modalY - 60, title, {
      fontSize: '18px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(titleText)

    const msgText = this.add.text(this.centerX, modalY - 10, message, {
      fontSize: '12px',
      color: '#cccccc',
      wordWrap: { width: modalWidth - 40 },
      align: 'center'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(msgText)

    // Buttons
    const cancelBtn = this.createActionButton(this.centerX - 60, modalY + 60, 90, 36, 'Cancel', 0x6b7280, () => {
      this.renderContent()
    })
    cancelBtn.bg.setDepth(102)
    cancelBtn.text.setDepth(103)

    const confirmBtn = this.createActionButton(this.centerX + 60, modalY + 60, 90, 36, 'Confirm', 0x22c55e, () => {
      this.renderContent()
      onConfirm()
    })
    confirmBtn.bg.setDepth(102)
    confirmBtn.text.setDepth(103)
  }

  showSellDebtModal(debt = null) {
    // If no debt passed, show list of debts to sell
    if (!debt) {
      if (this.debtsOwedToMe.filter(d => d.status === 'outstanding' || d.status === 'called_in').length === 0) {
        notificationManager.showToast('No debts available to sell!', 'info')
        return
      }
      // Switch to owedToMe tab and prompt to select
      this.activeTab = 'owedToMe'
      notificationManager.showToast('Click "Sell" on a debt to list it', 'info')
      this.renderContent()
      return
    }

    // Create sell modal
    const modalBg = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 0.85)
      .setInteractive()
      .setDepth(100)
    this.contentItems.push(modalBg)

    const modalWidth = this.width - 50
    const modalHeight = 320
    const modalY = this.centerY

    const modal = this.add.rectangle(this.centerX, modalY, modalWidth, modalHeight, 0x1a1a2a, 0.98)
    modal.setStrokeStyle(2, 0x8b5cf6, 0.8)
    modal.setDepth(101)
    this.contentItems.push(modal)

    // Title
    const title = this.add.text(this.centerX, modalY - modalHeight / 2 + 30, '🛒 Sell Debt to Marketplace', {
      fontSize: '16px',
      color: '#8b5cf6',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(title)

    // Debt info
    const typeConfig = this.DEBT_TYPES[debt.debtType] || this.DEBT_TYPES.favor
    const info = this.add.text(this.centerX, modalY - 60,
      `${typeConfig.icon} ${typeConfig.label} from ${debt.debtorName}\nOriginal Value: ${formatMoney(debt.value)}`, {
        fontSize: '13px',
        color: '#cccccc',
        align: 'center'
      }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(info)

    // Price options
    const priceLabel = this.add.text(this.centerX, modalY - 10, 'Select asking price:', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(priceLabel)

    const discounts = [
      { label: '90%', multiplier: 0.9 },
      { label: '75%', multiplier: 0.75 },
      { label: '50%', multiplier: 0.5 }
    ]

    discounts.forEach((opt, index) => {
      const btnX = this.centerX - 80 + index * 80
      const btnY = modalY + 30
      const price = Math.floor(debt.value * opt.multiplier)

      const btn = this.createActionButton(btnX, btnY, 70, 40, `${opt.label}\n${formatMoney(price)}`, 0x8b5cf6, () => {
        this.listDebtForSale(debt, price)
      })
      btn.bg.setDepth(102)
      btn.text.setDepth(103)
    })

    // Cancel button
    const cancelBtn = this.createActionButton(this.centerX, modalY + modalHeight / 2 - 40, 100, 36, 'Cancel', 0x6b7280, () => {
      this.renderContent()
    })
    cancelBtn.bg.setDepth(102)
    cancelBtn.text.setDepth(103)

    modalBg.on('pointerdown', () => this.renderContent())
  }

  listDebtForSale(debt, askingPrice) {
    // Remove from owedToMe
    const debtIndex = this.debtsOwedToMe.findIndex(d => d.id === debt.id)
    if (debtIndex !== -1) {
      this.debtsOwedToMe.splice(debtIndex, 1)
    }

    // Add to marketplace
    const listing = {
      id: `market_${Date.now()}`,
      debtType: debt.debtType,
      originalValue: debt.value,
      askingPrice: askingPrice,
      debtorName: debt.debtorName,
      debtorId: debt.debtorId,
      sellerName: 'You',
      sellerId: 'player',
      description: debt.description,
      listedDate: Date.now()
    }
    this.marketplace.push(listing)

    this.saveDebts()
    audioManager.playSuccess()
    notificationManager.showToast(`Listed for ${formatMoney(askingPrice)}!`, 'success')

    this.activeTab = 'marketplace'
    this.updateSummary()
    this.updateTabCounts()
    this.renderContent()
  }

  async buyDebt(listing) {
    const player = gameManager.player || getPlayerData()

    // Can't buy your own listings
    if (listing.sellerId === 'player') {
      this.showConfirmModal(
        'Remove Listing?',
        `Remove this ${formatMoney(listing.askingPrice)} listing from the marketplace?`,
        () => {
          // Return to owedToMe
          const newDebt = {
            id: `debt_${Date.now()}`,
            debtType: listing.debtType,
            value: listing.originalValue,
            status: 'outstanding',
            description: listing.description,
            debtorName: listing.debtorName,
            debtorId: listing.debtorId,
            createdAt: Date.now(),
            dueDate: Date.now() + 14 * 24 * 60 * 60 * 1000
          }
          this.debtsOwedToMe.push(newDebt)

          // Remove from marketplace
          const listingIndex = this.marketplace.findIndex(l => l.id === listing.id)
          if (listingIndex !== -1) {
            this.marketplace.splice(listingIndex, 1)
          }

          this.saveDebts()
          audioManager.playClick()
          notificationManager.showToast('Listing removed', 'info')
          this.updateSummary()
          this.updateTabCounts()
          this.renderContent()
        }
      )
      return
    }

    // Check if player can afford
    if ((player.cash || 0) < listing.askingPrice) {
      notificationManager.showToast(`Not enough cash! Need ${formatMoney(listing.askingPrice)}`, 'error')
      audioManager.playMiss()
      return
    }

    this.showConfirmModal(
      'Buy Debt?',
      `Purchase this debt for ${formatMoney(listing.askingPrice)}?\n\n${listing.debtorName} will now owe YOU ${formatMoney(listing.originalValue)}.`,
      () => {
        // Deduct cash
        player.cash -= listing.askingPrice
        savePlayerData(player)
        gameManager.player = player

        // Add to owedToMe
        const newDebt = {
          id: `debt_${Date.now()}`,
          debtType: listing.debtType,
          value: listing.originalValue,
          status: 'outstanding',
          description: listing.description,
          debtorName: listing.debtorName,
          debtorId: listing.debtorId,
          createdAt: Date.now(),
          dueDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
          purchasedFor: listing.askingPrice
        }
        this.debtsOwedToMe.push(newDebt)

        // Remove from marketplace
        const listingIndex = this.marketplace.findIndex(l => l.id === listing.id)
        if (listingIndex !== -1) {
          this.marketplace.splice(listingIndex, 1)
        }

        this.saveDebts()
        audioManager.playSuccess()
        notificationManager.showToast(`Bought debt for ${formatMoney(listing.askingPrice)}!`, 'success')
        this.cameras.main.flash(200, 139, 92, 246)
        this.updateSummary()
        this.updateTabCounts()
        this.renderContent()
      }
    )
  }

  showCreateDebtModal() {
    const modalBg = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 0.85)
      .setInteractive()
      .setDepth(100)
    this.contentItems.push(modalBg)

    const modalWidth = this.width - 40
    const modalHeight = 420
    const modalY = this.centerY

    const modal = this.add.rectangle(this.centerX, modalY, modalWidth, modalHeight, 0x1a1a2a, 0.98)
    modal.setStrokeStyle(2, 0x22c55e, 0.8)
    modal.setDepth(101)
    this.contentItems.push(modal)

    // Title
    const title = this.add.text(this.centerX, modalY - modalHeight / 2 + 30, '➕ Create New Debt', {
      fontSize: '18px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(title)

    // Direction selection
    const dirLabel = this.add.text(this.centerX, modalY - 130, 'Who owes who?', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(dirLabel)

    let selectedDirection = 'owedToMe' // or 'iOwe'
    const dirBtnY = modalY - 100

    const owedToMeBtn = this.add.rectangle(this.centerX - 70, dirBtnY, 120, 35, 0x22c55e, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(102)
    this.contentItems.push(owedToMeBtn)

    const owedToMeText = this.add.text(this.centerX - 70, dirBtnY, '💎 They Owe Me', {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(owedToMeText)

    const iOweBtn = this.add.rectangle(this.centerX + 70, dirBtnY, 120, 35, 0x3a3a4a, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(102)
    this.contentItems.push(iOweBtn)

    const iOweText = this.add.text(this.centerX + 70, dirBtnY, '📋 I Owe Them', {
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(iOweText)

    owedToMeBtn.on('pointerdown', () => {
      selectedDirection = 'owedToMe'
      owedToMeBtn.setFillStyle(0x22c55e, 0.9)
      owedToMeText.setColor('#ffffff').setStyle({ fontStyle: 'bold' })
      iOweBtn.setFillStyle(0x3a3a4a, 0.9)
      iOweText.setColor('#888888').setStyle({ fontStyle: 'normal' })
    })

    iOweBtn.on('pointerdown', () => {
      selectedDirection = 'iOwe'
      iOweBtn.setFillStyle(0xef4444, 0.9)
      iOweText.setColor('#ffffff').setStyle({ fontStyle: 'bold' })
      owedToMeBtn.setFillStyle(0x3a3a4a, 0.9)
      owedToMeText.setColor('#888888').setStyle({ fontStyle: 'normal' })
    })

    // Type selection
    const typeLabel = this.add.text(this.centerX, modalY - 55, 'Debt Type:', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(typeLabel)

    const types = ['favor', 'loan', 'service', 'protection', 'information']
    let selectedType = 'favor'
    const typeBtnY = modalY - 25

    types.forEach((type, index) => {
      const config = this.DEBT_TYPES[type]
      const btnX = this.centerX - 100 + index * 50
      const isSelected = type === selectedType

      const typeBtn = this.add.rectangle(btnX, typeBtnY, 42, 42, isSelected ? config.color : 0x2a2a3a, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(102)
      this.contentItems.push(typeBtn)

      const typeIcon = this.add.text(btnX, typeBtnY, config.icon, {
        fontSize: '20px'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(typeIcon)

      typeBtn.on('pointerdown', () => {
        selectedType = type
        // Update all type buttons (simplified - just re-render would be better)
        audioManager.playClick()
      })

      typeBtn.on('pointerover', () => typeBtn.setStrokeStyle(2, config.color))
      typeBtn.on('pointerout', () => typeBtn.setStrokeStyle(0))
    })

    // Value selection
    const valueLabel = this.add.text(this.centerX, modalY + 25, 'Value:', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(valueLabel)

    const values = [500, 1000, 2500, 5000, 10000]
    let selectedValue = 1000
    const valueBtnY = modalY + 55

    values.forEach((value, index) => {
      const btnX = this.centerX - 100 + index * 50
      const isSelected = value === selectedValue

      const valueBtn = this.add.rectangle(btnX, valueBtnY, 42, 30, isSelected ? 0xf59e0b : 0x2a2a3a, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(102)
      this.contentItems.push(valueBtn)

      const valueText = this.add.text(btnX, valueBtnY, value >= 1000 ? `${value / 1000}K` : value.toString(), {
        fontSize: '10px',
        color: isSelected ? '#000000' : '#888888',
        fontStyle: isSelected ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(valueText)

      valueBtn.on('pointerdown', () => {
        selectedValue = value
        audioManager.playClick()
      })
    })

    // NPC selection (random)
    const npcLabel = this.add.text(this.centerX, modalY + 100, 'Person: (Random NPC)', {
      fontSize: '11px',
      color: '#666666'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(npcLabel)

    // Buttons
    const cancelBtn = this.createActionButton(this.centerX - 60, modalY + modalHeight / 2 - 40, 100, 40, 'Cancel', 0x6b7280, () => {
      this.renderContent()
    })
    cancelBtn.bg.setDepth(102)
    cancelBtn.text.setDepth(103)

    const createBtn = this.createActionButton(this.centerX + 60, modalY + modalHeight / 2 - 40, 100, 40, '✓ Create', 0x22c55e, () => {
      this.createNewDebt(selectedDirection, selectedType, selectedValue)
    })
    createBtn.bg.setDepth(102)
    createBtn.text.setDepth(103)

    modalBg.on('pointerdown', () => this.renderContent())
  }

  createNewDebt(direction, type, value) {
    const npcName = this.NPC_NAMES[Math.floor(Math.random() * this.NPC_NAMES.length)]
    const isCreditor = direction === 'owedToMe'

    const newDebt = {
      id: `debt_${Date.now()}`,
      debtType: type,
      value: value,
      status: 'outstanding',
      description: this.getDebtDescription(type, isCreditor),
      [isCreditor ? 'debtorName' : 'creditorName']: npcName,
      [isCreditor ? 'debtorId' : 'creditorId']: `npc_${Date.now()}`,
      createdAt: Date.now(),
      dueDate: Date.now() + (14 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000
    }

    if (isCreditor) {
      this.debtsOwedToMe.push(newDebt)
      this.activeTab = 'owedToMe'
    } else {
      this.debtsIOwe.push(newDebt)
      this.activeTab = 'iOwe'
    }

    this.saveDebts()
    audioManager.playSuccess()
    notificationManager.showToast(`New ${this.DEBT_TYPES[type].label} created with ${npcName}!`, 'success')
    this.cameras.main.flash(200, 34, 197, 94)
    this.updateSummary()
    this.updateTabCounts()
    this.renderContent()
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}

export default DebtScene
