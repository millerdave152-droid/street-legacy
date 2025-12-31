import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { COLORS as OLD_COLORS } from '../../utils/constants'
import { CREW_MEMBERS, getPlayerData, savePlayerData } from '../data/GameData.js'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * CrewScene - Full NPC crew management system with long-term effects
 *
 * Crew Roles:
 * - Enforcer: +15% success rate on violent ops, intimidation bonus
 * - Hacker: -20% op cooldown time, security bypass
 * - Driver: +20% vehicle op success, +10% escape chance
 * - Lookout: -25% heat gain from ops, early warning
 *
 * Long-term Effects:
 * - Crew loyalty affects bonus effectiveness
 * - Training improves skill over time
 * - Synergy bonuses for balanced crews
 * - Reputation impact from crew actions
 */
export class CrewScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrewScene' })
  }

  init(data) {
    this.initData = data || {}
    // Allow external tab selection (e.g., from ConnectionsHubScene)
    if (data?.tab && ['hire', 'crew', 'train'].includes(data.tab)) {
      this.initialTab = data.tab
    } else {
      this.initialTab = 'hire'
    }
  }

  async create() {
    console.log('[CrewScene] create() started')
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
    this.CARD_WIDTH = width - 30
    this.CARD_HEIGHT = 105  // Taller cards for more info
    this.CARD_PADDING = 8
    this.SCROLL_START_Y = 200  // More room for header
    this.SCROLL_END_Y = height - 20

    // Role configuration with enhanced bonuses
    this.ROLE_CONFIG = {
      enforcer: {
        icon: '[E]',
        color: 0x2563eb,
        textColor: '#2563eb',
        bonus: '+15% violent op success',
        longTermEffect: 'Builds street reputation over time',
        bonusValue: { violence: 15, intimidation: 10 },
        specialty: 'Mugging, Armed Robbery'
      },
      hacker: {
        icon: '[H]',
        color: 0x2563eb,
        textColor: '#2563eb',
        bonus: '-20% op cooldown',
        longTermEffect: 'Unlocks high-tech major op options',
        bonusValue: { cooldown: 20, security: 15 },
        specialty: 'Bank Heist, Burglary'
      },
      driver: {
        icon: '[D]',
        color: 0x2563eb,
        textColor: '#2563eb',
        bonus: '+20% vehicle, +10% escape',
        longTermEffect: 'Faster travel between districts',
        bonusValue: { vehicle: 20, escape: 10, travel: 15 },
        specialty: 'Car Theft, Getaways'
      },
      lookout: {
        icon: '[L]',
        color: 0x2563eb,
        textColor: '#2563eb',
        bonus: '-25% heat gain',
        longTermEffect: 'Police warning system unlocked',
        bonusValue: { heat: 25, warning: 20 },
        specialty: 'All Ops, Intel'
      },
      muscle: {
        icon: '[M]',
        color: 0x2563eb,
        textColor: '#2563eb',
        bonus: '+20% intimidation',
        longTermEffect: 'Protection from rival crews',
        bonusValue: { intimidation: 20, protection: 15 },
        specialty: 'Debt Collection, Territory'
      },
      insider: {
        icon: '[I]',
        color: 0x2563eb,
        textColor: '#2563eb',
        bonus: '+15% intel on targets',
        longTermEffect: 'Access to exclusive opportunities',
        bonusValue: { intel: 15, access: 20 },
        specialty: 'High-Value Targets'
      }
    }

    // State
    this.myCrewMembers = []
    this.availableHires = []
    this.contentItems = []
    this.scrollOffset = 0
    this.activeTab = this.initialTab || 'hire'
    this.isLoading = true
    this.crewSlots = { current: 0, max: 6 }  // Increased max slots

    // Full screen dark background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(0)

    // Grid pattern background
    this.createGridPattern()

    // Create UI elements
    this.createHeader()
    this.createSynergyPanel()
    this.createTabs()
    this.createCloseButton()
    this.setupScrolling()

    // Loading state
    this.loadingText = this.add.text(width / 2, height / 2, 'Loading crew data...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(10)

    // Load data
    await this.loadCrewData()
  }

  createSynergyPanel() {
    const { width } = this.cameras.main
    const panelY = 130
    const panelHeight = 55

    // Synergy panel background
    this.synergyPanel = this.add.rectangle(width / 2, panelY, width - 30, panelHeight, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, COLORS.network.primary, 0.4)
      .setDepth(10)

    // Synergy label
    this.add.text(25, panelY - 18, `${SYMBOLS.system} CREW SYNERGY`, {
      ...getTerminalStyle('xs'),
      fontStyle: 'bold'
    }).setDepth(11)

    // Synergy bonus display (will be updated)
    this.synergyText = this.add.text(25, panelY + 2, 'Hire crew members to unlock synergy bonuses', {
      fontSize: '10px',
      color: '#6b7280'
    }).setDepth(11)

    // Synergy meter
    this.synergyMeterBg = this.add.rectangle(width - 80, panelY, 100, 20, 0x1e293b)
      .setStrokeStyle(1, 0x334155)
      .setDepth(11)

    this.synergyMeterFill = this.add.rectangle(width - 130, panelY, 0, 16, 0x06b6d4)
      .setOrigin(0, 0.5)
      .setDepth(12)

    this.synergyPercent = this.add.text(width - 80, panelY, '0%', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13)
  }

  updateSynergyDisplay() {
    if (!this.myCrewMembers || this.myCrewMembers.length === 0) {
      this.synergyText.setText('Hire crew members to unlock synergy bonuses')
      this.synergyMeterFill.width = 0
      this.synergyPercent.setText('0%')
      return
    }

    // Calculate synergy based on role diversity and loyalty
    const roles = new Set(this.myCrewMembers.map(m => m.role))
    const roleCount = roles.size
    const avgLoyalty = this.myCrewMembers.reduce((sum, m) => sum + (m.loyalty || 100), 0) / this.myCrewMembers.length
    const avgSkill = this.myCrewMembers.reduce((sum, m) => sum + (m.skill || 50), 0) / this.myCrewMembers.length

    // Synergy increases with diverse roles
    const diversityBonus = roleCount * 15
    const loyaltyBonus = (avgLoyalty / 100) * 20
    const skillBonus = (avgSkill / 100) * 15
    const synergy = Math.min(100, Math.floor(diversityBonus + loyaltyBonus + skillBonus))

    // Determine synergy tier and bonus
    let synergyTier = 'None'
    let synergyBonus = ''
    if (synergy >= 80) {
      synergyTier = 'Elite'
      synergyBonus = '+25% all bonuses, -50% daily costs'
    } else if (synergy >= 60) {
      synergyTier = 'Strong'
      synergyBonus = '+15% all bonuses, -25% daily costs'
    } else if (synergy >= 40) {
      synergyTier = 'Moderate'
      synergyBonus = '+10% all bonuses'
    } else if (synergy >= 20) {
      synergyTier = 'Weak'
      synergyBonus = '+5% success rate'
    }

    this.synergyText.setText(synergy >= 20 ? `${synergyTier}: ${synergyBonus}` : 'Build a diverse crew for synergy bonuses')

    // Update meter
    const meterWidth = (synergy / 100) * 96
    this.synergyMeterFill.width = meterWidth

    // Color based on tier
    const tierColors = { Elite: 0xf59e0b, Strong: 0x22c55e, Moderate: 0x3b82f6, Weak: 0x6b7280, None: 0x374151 }
    this.synergyMeterFill.setFillStyle(tierColors[synergyTier] || 0x374151)

    this.synergyPercent.setText(`${synergy}%`)
  }

  createGridPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(1)

    // Draw subtle grid
    graphics.lineStyle(1, 0x1a2530, 0.2)
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
    const iconBg = this.add.circle(width / 2, 35, 26, COLORS.bg.elevated)
      .setStrokeStyle(2, 0x2563eb, 0.5)
      .setDepth(9)

    this.add.text(width / 2, 35, '[C]', {
      ...getTerminalStyle('xl'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10)

    // Title
    this.add.text(width / 2, 72, 'CREW', {
      ...getTerminalStyle('xl'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10)

    // Cash and slots cards
    const infoY = 100
    const cardWidth = (width - 50) / 2

    // Cash card
    const cashCardX = 20 + cardWidth / 2
    this.add.rectangle(cashCardX, infoY, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.status.success, 0.4)
      .setDepth(9)

    this.cashText = this.add.text(cashCardX, infoY, `${SYMBOLS.cash} ${formatMoney(player?.cash || 0)}`, {
      ...getTerminalStyle('sm')
    }).setOrigin(0.5).setDepth(10)

    // Slots card
    const slotsCardX = width - 20 - cardWidth / 2
    this.add.rectangle(slotsCardX, infoY, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, 0x2563eb, 0.4)
      .setDepth(9)

    this.slotsText = this.add.text(slotsCardX, infoY, '[C] 0/4 Slots', {
      fontSize: '11px',
      color: toHexString(0x2563eb)
    }).setOrigin(0.5).setDepth(10)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 175
    const tabWidth = (width - 60) / 3
    const tabSpacing = 5

    this.tabs = {}

    // Hire tab
    const hireX = 20 + tabWidth / 2
    this.tabs.hire = this.createTab(hireX, tabY, tabWidth, '[H] Hire', true)

    // Your Crew tab
    const crewX = 20 + tabWidth + tabSpacing + tabWidth / 2
    this.tabs.crew = this.createTab(crewX, tabY, tabWidth, '[C] Crew', false)

    // Training tab
    const trainX = width - 20 - tabWidth / 2
    this.tabs.train = this.createTab(trainX, tabY, tabWidth, '[T] Train', false)
  }

  createTab(x, y, tabWidth, label, isActive) {
    const bgColor = isActive ? COLORS.network.primary : COLORS.bg.panel
    const strokeColor = isActive ? COLORS.network.glow : COLORS.bg.elevated

    const bg = this.add.rectangle(x, y, tabWidth, 30, bgColor, 0.95)
      .setStrokeStyle(1, strokeColor)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)

    const text = this.add.text(x, y, label, {
      ...getTerminalStyle('sm'),
      color: isActive ? toHexString(COLORS.bg.void) : toHexString(COLORS.text.secondary),
      fontStyle: isActive ? 'bold' : 'normal'
    }).setOrigin(0.5).setDepth(11)

    const tabKey = label.includes('Hire') ? 'hire' : (label.includes('Train') ? 'train' : 'crew')

    bg.on('pointerover', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(COLORS.bg.elevated, 0.95)
        text.setColor(toHexString(COLORS.text.primary))
      }
    })

    bg.on('pointerout', () => {
      if (this.activeTab !== tabKey) {
        bg.setFillStyle(COLORS.bg.panel, 0.95)
        text.setColor(toHexString(COLORS.text.secondary))
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
      this.tabs[key].bg.setFillStyle(isActive ? COLORS.network.primary : COLORS.bg.panel, 0.95)
      this.tabs[key].bg.setStrokeStyle(1, isActive ? COLORS.network.glow : COLORS.bg.elevated)
      this.tabs[key].text.setColor(isActive ? toHexString(COLORS.bg.void) : toHexString(COLORS.text.secondary))
      this.tabs[key].text.setStyle({ fontStyle: isActive ? 'bold' : 'normal' })
    })

    this.renderContent()
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      fontSize: '28px',
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

  async loadCrewData() {
    try {
      const player = gameManager.player || getPlayerData()

      // Generate available hires
      this.availableHires = this.generateAvailableHires()

      // Load player's hired crew from localStorage
      this.myCrewMembers = player.crew || []
      this.crewSlots = { current: this.myCrewMembers.length, max: 6 }

      // Update slots display
      this.slotsText.setText(`[C] ${this.myCrewMembers.length}/${this.crewSlots.max} Slots`)

      // Update synergy display
      this.updateSynergyDisplay()

      this.isLoading = false
      this.loadingText?.destroy()
      this.renderContent()
    } catch (error) {
      console.error('Failed to load crew data:', error)
      this.loadingText?.setText('Failed to load crew')
    }
  }

  generateAvailableHires() {
    const roles = ['enforcer', 'hacker', 'driver', 'lookout', 'muscle', 'insider']
    const firstNames = ['Mike', 'Tony', 'Sara', 'Jake', 'Rico', 'Vince', 'Nina', 'Leo', 'Max', 'Eva', 'Dom', 'Lex', 'Zoe', 'Rex']
    const lastNames = ['Stone', 'Vega', 'Black', 'Cross', 'Wolf', 'Fox', 'Sharp', 'Steel', 'Blaze', 'Night', 'Frost', 'Drake', 'Raven', 'Storm']
    const nicknames = {
      enforcer: ['Knuckles', 'Hammer', 'Brick', 'Tank', 'Crusher', 'Fist'],
      hacker: ['Ghost', 'Zero', 'Cipher', 'Proxy', 'Glitch', 'Shadow'],
      driver: ['Wheels', 'Drift', 'Turbo', 'Nitro', 'Ace', 'Flash'],
      lookout: ['Eyes', 'Hawk', 'Scout', 'Shadow', 'Whisper', 'Owl'],
      muscle: ['Bruiser', 'Boulder', 'Iron', 'Titan', 'Beast', 'Kong'],
      insider: ['Viper', 'Snake', 'Whisper', 'Charm', 'Silver', 'Mask']
    }

    const hires = []
    for (let i = 0; i < 10; i++) {
      const role = roles[i % 6]
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const nickname = nicknames[role][Math.floor(Math.random() * nicknames[role].length)]
      const level = Math.floor(Math.random() * 8) + 1
      const skill = Math.floor(Math.random() * 50) + 50

      hires.push({
        id: `crew_${Date.now()}_${i}`,
        name: `${firstName} "${nickname}" ${lastName}`,
        role,
        level,
        skill,
        loyalty: 100,
        trainingProgress: 0,
        hire_cost: this.calculateHireCost(role, level, skill),
        daily_cost: this.calculateDailyCost(role, level)
      })
    }

    return hires
  }

  calculateHireCost(role, level, skill) {
    const baseCost = {
      enforcer: 5000, hacker: 8000, driver: 6000, lookout: 4000,
      muscle: 6000, insider: 9000
    }
    return Math.floor((baseCost[role] || 5000) * (1 + level * 0.3) * (skill / 70))
  }

  calculateDailyCost(role, level) {
    const baseCost = {
      enforcer: 200, hacker: 350, driver: 250, lookout: 150,
      muscle: 250, insider: 400
    }
    return Math.floor((baseCost[role] || 200) * (1 + level * 0.2))
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    if (this.activeTab === 'hire') {
      this.renderHireTab()
    } else if (this.activeTab === 'train') {
      this.renderTrainTab()
    } else {
      this.renderCrewTab()
    }
  }

  renderHireTab() {
    const { width } = this.cameras.main

    if (this.availableHires.length === 0) {
      this.renderEmptyState('🤝', 'No Recruits Available',
        'Check back later for new crew members!')
      return
    }

    const atMaxCapacity = this.myCrewMembers.length >= this.crewSlots.max
    let y = this.SCROLL_START_Y - this.scrollOffset

    // Capacity warning
    if (atMaxCapacity) {
      const warningBg = this.add.rectangle(width / 2, this.SCROLL_START_Y - 15, this.CARD_WIDTH, 25, 0xf59e0b, 0.2)
        .setStrokeStyle(1, 0xf59e0b)
        .setDepth(10)
      this.contentItems.push(warningBg)

      const warningText = this.add.text(width / 2, this.SCROLL_START_Y - 15, '⚠️ Crew is full! Fire someone to hire more.', {
        fontSize: '11px',
        color: '#f59e0b'
      }).setOrigin(0.5).setDepth(11)
      this.contentItems.push(warningText)

      y += 30
    }

    // Render available crew cards
    this.availableHires.forEach((member, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderHireCard(member, cardY, atMaxCapacity)
      }
    })
  }

  renderCrewTab() {
    const { width, height } = this.cameras.main

    if (this.myCrewMembers.length === 0) {
      this.renderEmptyState('👥', 'No Crew Members',
        'Visit the Hire tab to recruit your first crew member!')
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // Crew bonuses summary card
    const bonuses = this.calculateCrewBonuses()
    this.renderBonusSummary(y, bonuses)
    y += 75

    // Daily cost display
    const totalDailyCost = this.myCrewMembers.reduce((sum, m) => sum + (m.daily_cost || 0), 0)
    const costText = this.add.text(width / 2, y - 5, `💸 Daily Payroll: ${formatMoney(totalDailyCost)}`, {
      fontSize: '11px',
      color: '#f59e0b'
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(costText)
    y += 25

    // Low loyalty warning
    const atRiskMembers = this.myCrewMembers.filter(m => m.loyalty < 30)
    if (atRiskMembers.length > 0) {
      const warningText = this.add.text(width / 2, y,
        `⚠️ ${atRiskMembers.length} member(s) may leave due to low loyalty!`, {
        fontSize: '10px',
        color: '#ef4444'
      }).setOrigin(0.5).setDepth(10)
      this.contentItems.push(warningText)
      y += 20
    }

    // Render crew member cards
    this.myCrewMembers.forEach((member, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderCrewCard(member, cardY)
      }
    })
  }

  renderTrainTab() {
    const { width } = this.cameras.main

    if (this.myCrewMembers.length === 0) {
      this.renderEmptyState('🎯', 'No Crew to Train',
        'Hire crew members first to train them!')
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // Training info panel
    const infoBg = this.add.rectangle(width / 2, y + 30, this.CARD_WIDTH, 65, 0x1a2a1a, 0.95)
      .setStrokeStyle(1, 0x22c55e)
      .setDepth(10)
    this.contentItems.push(infoBg)

    const infoTitle = this.add.text(25, y + 10, '🎓 TRAINING CENTER', {
      fontSize: '12px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(infoTitle)

    const infoDesc = this.add.text(25, y + 30, 'Train your crew to increase skills and loyalty.', {
      fontSize: '10px',
      color: '#888888'
    }).setDepth(11)
    this.contentItems.push(infoDesc)

    const infoDetails = this.add.text(25, y + 48, 'Training costs $500 per session • +5 Skill, +10 Loyalty', {
      fontSize: '9px',
      color: '#22c55e'
    }).setDepth(11)
    this.contentItems.push(infoDetails)

    y += 85

    // Render trainable crew cards
    this.myCrewMembers.forEach((member, index) => {
      const cardY = y + index * 95

      if (cardY + 90 > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderTrainCard(member, cardY)
      }
    })
  }

  renderTrainCard(member, y) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const trainingCost = 500
    const canAfford = (player?.cash || 0) >= trainingCost
    const isMaxSkill = member.skill >= 100
    const roleConfig = this.ROLE_CONFIG[member.role] || { icon: '👤', color: 0x6b7280 }

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + 40, this.CARD_WIDTH, 85, 0x1e293b, 0.95)
      .setStrokeStyle(1, roleConfig.color)
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Icon
    const iconBg = this.add.circle(45, y + 40, 22, roleConfig.color, 0.2).setDepth(11)
    this.contentItems.push(iconBg)

    const icon = this.add.text(45, y + 40, roleConfig.icon, { fontSize: '24px' })
      .setOrigin(0.5).setDepth(12)
    this.contentItems.push(icon)

    // Name
    const name = this.add.text(80, y + 20, member.name.split('"')[1] || member.name, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(name)

    // Role
    const role = this.add.text(80, y + 38, `${member.role.toUpperCase()} • Lv.${member.level}`, {
      fontSize: '9px',
      color: roleConfig.textColor
    }).setDepth(11)
    this.contentItems.push(role)

    // Progress bars
    const barWidth = 100

    // Skill bar
    const skillLabel = this.add.text(80, y + 55, 'Skill:', { fontSize: '9px', color: '#3b82f6' }).setDepth(11)
    this.contentItems.push(skillLabel)

    const skillBg = this.add.rectangle(155 + barWidth / 2, y + 57, barWidth, 10, 0x1a1a2e).setDepth(11)
    this.contentItems.push(skillBg)

    const skillFill = this.add.rectangle(155 + (barWidth * member.skill / 100) / 2, y + 57,
      Math.max(2, barWidth * member.skill / 100), 8, 0x3b82f6).setOrigin(0, 0.5).setDepth(12)
    skillFill.x = 155
    this.contentItems.push(skillFill)

    const skillText = this.add.text(160 + barWidth, y + 57, `${member.skill}%`, {
      fontSize: '9px', color: '#3b82f6'
    }).setOrigin(0, 0.5).setDepth(11)
    this.contentItems.push(skillText)

    // Loyalty bar
    const loyaltyLabel = this.add.text(80, y + 70, 'Loyalty:', { fontSize: '9px', color: '#22c55e' }).setDepth(11)
    this.contentItems.push(loyaltyLabel)

    const loyaltyBg = this.add.rectangle(155 + barWidth / 2, y + 72, barWidth, 10, 0x1a1a2e).setDepth(11)
    this.contentItems.push(loyaltyBg)

    const loyaltyFill = this.add.rectangle(155 + (barWidth * member.loyalty / 100) / 2, y + 72,
      Math.max(2, barWidth * member.loyalty / 100), 8, 0x22c55e).setOrigin(0, 0.5).setDepth(12)
    loyaltyFill.x = 155
    this.contentItems.push(loyaltyFill)

    const loyaltyText = this.add.text(160 + barWidth, y + 72, `${member.loyalty}%`, {
      fontSize: '9px', color: '#22c55e'
    }).setOrigin(0, 0.5).setDepth(11)
    this.contentItems.push(loyaltyText)

    // Train button
    const canTrain = canAfford && !isMaxSkill
    const btnColor = isMaxSkill ? 0x6b7280 : (canAfford ? 0x22c55e : 0xef4444)

    const trainBtn = this.add.rectangle(width - 55, y + 40, 65, 45, btnColor)
      .setInteractive({ useHandCursor: canTrain })
      .setDepth(11)
    this.contentItems.push(trainBtn)

    if (canTrain) {
      trainBtn.on('pointerover', () => trainBtn.setFillStyle(0x16a34a))
      trainBtn.on('pointerout', () => trainBtn.setFillStyle(0x22c55e))
      trainBtn.on('pointerdown', () => this.trainMember(member))
    }

    const btnLabel = isMaxSkill ? 'MAX' : (canAfford ? 'TRAIN' : '💸')
    const trainText = this.add.text(width - 55, y + 35, btnLabel, {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(trainText)

    if (!isMaxSkill) {
      const costText = this.add.text(width - 55, y + 50, '$500', {
        fontSize: '9px', color: canAfford ? '#ffffff' : '#ef4444'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(costText)
    }
  }

  trainMember(member) {
    const player = gameManager.player || getPlayerData()
    const trainingCost = 500

    if ((player.cash || 0) < trainingCost) {
      this.showToast('Not enough cash!', false)
      return
    }

    if (member.skill >= 100) {
      this.showToast('Member is already at max skill!', false)
      return
    }

    // Deduct cost
    player.cash -= trainingCost

    // Find and update member in crew
    const crewMember = player.crew?.find(m => m.id === member.id)
    if (crewMember) {
      crewMember.skill = Math.min(100, (crewMember.skill || 50) + 5)
      crewMember.loyalty = Math.min(100, (crewMember.loyalty || 100) + 10)

      // Update local reference
      member.skill = crewMember.skill
      member.loyalty = crewMember.loyalty
    }

    // Save
    savePlayerData(player)
    gameManager.player = player

    // Update UI
    this.cashText.setText(`${SYMBOLS.cash} ${formatMoney(player.cash)}`)
    this.updateSynergyDisplay()
    this.showToast(`Trained ${member.name.split('"')[1] || 'crew member'}!`, true)
    try { audioManager.playClick() } catch (e) { /* ignore */ }
    this.renderContent()
  }

  renderBonusSummary(y, bonuses) {
    const { width } = this.cameras.main

    // Summary background
    const summaryBg = this.add.rectangle(width / 2, y + 25, this.CARD_WIDTH, 55, 0x1e293b, 0.95)
      .setStrokeStyle(1, 0x06b6d4)
      .setDepth(10)
    this.contentItems.push(summaryBg)

    // Title
    const title = this.add.text(25, y + 10, '📊 Active Crew Bonuses', {
      fontSize: '12px',
      color: '#06b6d4',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(title)

    // Bonus list
    const bonusStrings = []
    if (bonuses.violence > 0) bonusStrings.push(`💪+${bonuses.violence}%`)
    if (bonuses.cooldown > 0) bonusStrings.push(`⏱️-${bonuses.cooldown}%`)
    if (bonuses.escape > 0) bonusStrings.push(`🏃+${bonuses.escape}%`)
    if (bonuses.heat > 0) bonusStrings.push(`🔥-${bonuses.heat}%`)
    if (bonuses.vehicle > 0) bonusStrings.push(`🚗+${bonuses.vehicle}%`)
    if (bonuses.intimidation > 0) bonusStrings.push(`🥊+${bonuses.intimidation}%`)
    if (bonuses.intel > 0) bonusStrings.push(`🎯+${bonuses.intel}%`)

    const bonusText = this.add.text(25, y + 32,
      bonusStrings.length > 0 ? bonusStrings.join('   ') : 'No active bonuses', {
      fontSize: '11px',
      color: bonusStrings.length > 0 ? '#22c55e' : '#666666'
    }).setDepth(11)
    this.contentItems.push(bonusText)
  }

  calculateCrewBonuses() {
    const bonuses = { violence: 0, cooldown: 0, escape: 0, heat: 0, vehicle: 0, intimidation: 0, intel: 0 }

    this.myCrewMembers.forEach(member => {
      const effectiveness = member.skill / 100
      const loyaltyMultiplier = member.loyalty / 100

      switch (member.role) {
        case 'enforcer':
          bonuses.violence += Math.floor(15 * effectiveness * loyaltyMultiplier)
          break
        case 'hacker':
          bonuses.cooldown += Math.floor(20 * effectiveness * loyaltyMultiplier)
          break
        case 'driver':
          bonuses.vehicle += Math.floor(20 * effectiveness * loyaltyMultiplier)
          bonuses.escape += Math.floor(10 * effectiveness * loyaltyMultiplier)
          break
        case 'lookout':
          bonuses.heat += Math.floor(25 * effectiveness * loyaltyMultiplier)
          break
        case 'muscle':
          bonuses.intimidation += Math.floor(20 * effectiveness * loyaltyMultiplier)
          bonuses.violence += Math.floor(10 * effectiveness * loyaltyMultiplier)
          break
        case 'insider':
          bonuses.intel += Math.floor(15 * effectiveness * loyaltyMultiplier)
          bonuses.cooldown += Math.floor(10 * effectiveness * loyaltyMultiplier)
          break
      }
    })

    return bonuses
  }

  renderHireCard(member, y, atMaxCapacity) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const canAfford = (player?.cash || 0) >= member.hire_cost
    const canHire = canAfford && !atMaxCapacity

    const roleConfig = this.ROLE_CONFIG[member.role] || { icon: '👤', color: 0x6b7280, bonus: 'No bonus' }

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e293b, 0.95)
      .setStrokeStyle(2, roleConfig.color)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Left accent bar
    const accentBar = this.add.rectangle(22, y + this.CARD_HEIGHT / 2, 4, this.CARD_HEIGHT - 15, roleConfig.color)
      .setDepth(11)
    this.contentItems.push(accentBar)

    // Role icon
    const iconBg = this.add.circle(50, y + 30, 20, roleConfig.color, 0.2)
      .setDepth(11)
    this.contentItems.push(iconBg)

    const iconText = this.add.text(50, y + 30, roleConfig.icon, { fontSize: '22px' })
      .setOrigin(0.5)
      .setDepth(12)
    this.contentItems.push(iconText)

    // Name (shortened if needed)
    const displayName = member.name.length > 22 ? member.name.substring(0, 22) + '...' : member.name
    const nameText = this.add.text(80, y + 12, displayName, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(nameText)

    // Role badge
    const roleText = this.add.text(80, y + 32, member.role.toUpperCase(), {
      fontSize: '10px',
      color: roleConfig.textColor
    }).setDepth(11)
    this.contentItems.push(roleText)

    // Level
    const levelText = this.add.text(160, y + 32, `Lv.${member.level}`, {
      fontSize: '10px',
      color: '#888888'
    }).setDepth(11)
    this.contentItems.push(levelText)

    // Skill bar
    this.renderProgressBar(80, y + 52, 120, member.skill, 0x3b82f6, 'Skill')

    // Role bonus
    const bonusText = this.add.text(80, y + 72, `✓ ${roleConfig.bonus}`, {
      fontSize: '9px',
      color: '#22c55e'
    }).setDepth(11)
    this.contentItems.push(bonusText)

    // Price section (right side)
    const priceX = width - 70

    const hireCostText = this.add.text(priceX, y + 20, formatMoney(member.hire_cost), {
      fontSize: '14px',
      color: canAfford ? '#22c55e' : '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)
    this.contentItems.push(hireCostText)

    const dailyCostText = this.add.text(priceX, y + 38, `${formatMoney(member.daily_cost)}/day`, {
      fontSize: '9px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(11)
    this.contentItems.push(dailyCostText)

    // Hire button
    const btnColor = canHire ? 0x22c55e : (atMaxCapacity ? 0x6b7280 : 0xef4444)
    const hireBtn = this.add.rectangle(priceX, y + 68, 70, 30, btnColor)
      .setInteractive({ useHandCursor: canHire })
      .setDepth(11)
    this.contentItems.push(hireBtn)

    if (canHire) {
      hireBtn.on('pointerover', () => hireBtn.setFillStyle(0x16a34a))
      hireBtn.on('pointerout', () => hireBtn.setFillStyle(0x22c55e))
      hireBtn.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation()
        this.showHireConfirmation(member)
      })
    }

    const btnLabel = atMaxCapacity ? 'FULL' : (canAfford ? 'HIRE' : '💸')
    const hireText = this.add.text(priceX, y + 68, btnLabel, {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(hireText)

    // Card tap for details
    cardBg.on('pointerdown', () => this.showMemberDetails(member, false))
  }

  renderCrewCard(member, y) {
    const { width } = this.cameras.main
    const roleConfig = this.ROLE_CONFIG[member.role] || { icon: '👤', color: 0x6b7280, bonus: 'No bonus' }

    const isLoyal = member.loyalty > 80
    const isAtRisk = member.loyalty < 30

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e293b, 0.95)
      .setStrokeStyle(2, roleConfig.color)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Left accent bar
    const accentBar = this.add.rectangle(22, y + this.CARD_HEIGHT / 2, 4, this.CARD_HEIGHT - 15, roleConfig.color)
      .setDepth(11)
    this.contentItems.push(accentBar)

    // Role icon
    const iconBg = this.add.circle(50, y + 30, 20, roleConfig.color, 0.2)
      .setDepth(11)
    this.contentItems.push(iconBg)

    const iconText = this.add.text(50, y + 30, roleConfig.icon, { fontSize: '22px' })
      .setOrigin(0.5)
      .setDepth(12)
    this.contentItems.push(iconText)

    // Name
    const displayName = member.name.length > 20 ? member.name.substring(0, 20) + '...' : member.name
    const nameText = this.add.text(80, y + 12, displayName, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(nameText)

    // Status badge
    if (isLoyal) {
      const loyalBadge = this.add.rectangle(250, y + 16, 45, 16, 0x22c55e, 0.8)
        .setDepth(11)
      this.contentItems.push(loyalBadge)

      const loyalLabel = this.add.text(250, y + 16, 'LOYAL', {
        fontSize: '8px',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(loyalLabel)
    } else if (isAtRisk) {
      const riskBadge = this.add.rectangle(250, y + 16, 50, 16, 0xef4444, 0.8)
        .setDepth(11)
      this.contentItems.push(riskBadge)

      const riskLabel = this.add.text(250, y + 16, 'AT RISK', {
        fontSize: '8px',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(riskLabel)
    }

    // Role and level
    const infoText = this.add.text(80, y + 32, `${member.role.toUpperCase()} • Lv.${member.level}`, {
      fontSize: '10px',
      color: roleConfig.textColor
    }).setDepth(11)
    this.contentItems.push(infoText)

    // Skill bar
    this.renderProgressBar(80, y + 52, 100, member.skill, 0x3b82f6, 'Skill')

    // Loyalty bar
    const loyaltyColor = member.loyalty > 70 ? 0x22c55e : (member.loyalty > 40 ? 0xf59e0b : 0xef4444)
    this.renderProgressBar(80, y + 70, 100, member.loyalty, loyaltyColor, 'Loyal')

    // Daily cost
    const costText = this.add.text(200, y + 55, `💸 ${formatMoney(member.daily_cost)}/day`, {
      fontSize: '10px',
      color: '#f59e0b'
    }).setDepth(11)
    this.contentItems.push(costText)

    // Fire button
    const fireBtn = this.add.rectangle(width - 50, y + this.CARD_HEIGHT / 2, 55, 30, 0xef4444)
      .setInteractive({ useHandCursor: true })
      .setDepth(11)
    this.contentItems.push(fireBtn)

    fireBtn.on('pointerover', () => fireBtn.setFillStyle(0xdc2626))
    fireBtn.on('pointerout', () => fireBtn.setFillStyle(0xef4444))
    fireBtn.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation()
      this.showFireConfirmation(member)
    })

    const fireText = this.add.text(width - 50, y + this.CARD_HEIGHT / 2, 'FIRE', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(fireText)

    // Card tap for details
    cardBg.on('pointerdown', () => this.showMemberDetails(member, true))
  }

  renderProgressBar(x, y, barWidth, value, color, label) {
    const barHeight = 8

    // Label
    const labelText = this.add.text(x, y, `${label}:`, {
      fontSize: '9px',
      color: '#666666'
    }).setDepth(11)
    this.contentItems.push(labelText)

    // Background
    const bg = this.add.rectangle(x + 35 + barWidth / 2, y + barHeight / 2 - 1, barWidth, barHeight, 0x1a1a2e)
      .setDepth(11)
    this.contentItems.push(bg)

    // Fill
    const fillWidth = Math.max(2, (barWidth * value) / 100)
    const fill = this.add.rectangle(x + 35 + fillWidth / 2, y + barHeight / 2 - 1, fillWidth, barHeight - 2, color)
      .setDepth(12)
    this.contentItems.push(fill)

    // Value text
    const valueText = this.add.text(x + 35 + barWidth + 6, y + barHeight / 2 - 1, `${value}%`, {
      fontSize: '8px',
      color: '#888888'
    }).setOrigin(0, 0.5).setDepth(11)
    this.contentItems.push(valueText)
  }

  renderEmptyState(icon, title, message) {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 40, icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 15, title, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 45, message, {
      fontSize: '12px',
      color: '#888888',
      align: 'center',
      wordWrap: { width: this.CARD_WIDTH - 40 }
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(msgText)
  }

  showMemberDetails(member, isHired) {
    const { width, height } = this.cameras.main
    const modalElements = []
    const roleConfig = this.ROLE_CONFIG[member.role] || { icon: '👤', color: 0x6b7280, bonus: 'No bonus' }

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setInteractive()
      .setDepth(200)
    modalElements.push(overlay)

    // Modal
    const modalHeight = 320
    const modalWidth = Math.min(320, width - 40)
    const modal = this.add.rectangle(width / 2, height / 2, modalWidth, modalHeight, 0x1a1a3a, 0.98)
      .setStrokeStyle(2, roleConfig.color)
      .setDepth(201)
    modalElements.push(modal)

    // Close button
    const closeBtn = this.add.text(width / 2 + modalWidth / 2 - 20, height / 2 - modalHeight / 2 + 20, '✕', {
      fontSize: '20px',
      color: '#888888'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202)
    modalElements.push(closeBtn)

    // Header
    const headerY = height / 2 - modalHeight / 2 + 50
    const headerIcon = this.add.text(width / 2, headerY, roleConfig.icon, {
      fontSize: '40px'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(headerIcon)

    const headerName = this.add.text(width / 2, headerY + 40, member.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: modalWidth - 40 },
      align: 'center'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(headerName)

    // Role badge
    const roleBadge = this.add.rectangle(width / 2, headerY + 70, 80, 20, roleConfig.color, 0.9).setDepth(202)
    modalElements.push(roleBadge)

    const roleText = this.add.text(width / 2, headerY + 70, member.role.toUpperCase(), {
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(203)
    modalElements.push(roleText)

    // Stats
    const statsY = headerY + 100
    const statsX = width / 2 - modalWidth / 2 + 30

    const stats = [
      { label: 'Level', value: `${member.level}`, color: '#ffffff' },
      { label: 'Skill', value: `${member.skill}%`, color: '#3b82f6' },
      isHired ? { label: 'Loyalty', value: `${member.loyalty}%`, color: member.loyalty > 70 ? '#22c55e' : (member.loyalty > 40 ? '#f59e0b' : '#ef4444') } : null,
      { label: 'Bonus', value: roleConfig.bonus, color: '#22c55e' },
      isHired
        ? { label: 'Daily Cost', value: formatMoney(member.daily_cost), color: '#f59e0b' }
        : { label: 'Hire Cost', value: formatMoney(member.hire_cost), color: '#22c55e' }
    ].filter(Boolean)

    stats.forEach((stat, i) => {
      const labelText = this.add.text(statsX, statsY + i * 22, stat.label + ':', {
        fontSize: '11px',
        color: '#888888'
      }).setDepth(202)
      modalElements.push(labelText)

      const valueText = this.add.text(statsX + 80, statsY + i * 22, stat.value, {
        fontSize: '11px',
        color: stat.color
      }).setDepth(202)
      modalElements.push(valueText)
    })

    // Action button
    const btnY = height / 2 + modalHeight / 2 - 45

    if (isHired) {
      const fireBtn = this.add.rectangle(width / 2, btnY, 120, 36, 0xef4444)
        .setInteractive({ useHandCursor: true }).setDepth(202)
      modalElements.push(fireBtn)

      fireBtn.on('pointerover', () => fireBtn.setFillStyle(0xdc2626))
      fireBtn.on('pointerout', () => fireBtn.setFillStyle(0xef4444))
      fireBtn.on('pointerdown', () => {
        this.closeModal(modalElements)
        this.showFireConfirmation(member)
      })

      const fireText = this.add.text(width / 2, btnY, 'Fire Member', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(203)
      modalElements.push(fireText)
    } else {
      const canAfford = (gameManager.player?.cash || 0) >= member.hire_cost
      const atMaxCapacity = this.myCrewMembers.length >= this.crewSlots.max
      const canHire = canAfford && !atMaxCapacity

      const hireBtn = this.add.rectangle(width / 2, btnY, 150, 38, canHire ? 0x22c55e : 0x444444)
        .setInteractive({ useHandCursor: canHire }).setDepth(202)
      modalElements.push(hireBtn)

      if (canHire) {
        hireBtn.on('pointerover', () => hireBtn.setFillStyle(0x16a34a))
        hireBtn.on('pointerout', () => hireBtn.setFillStyle(0x22c55e))
        hireBtn.on('pointerdown', () => {
          this.closeModal(modalElements)
          this.showHireConfirmation(member)
        })
      }

      let btnLabel = `Hire ${formatMoney(member.hire_cost)}`
      if (!canAfford) btnLabel = 'Not Enough Cash'
      if (atMaxCapacity) btnLabel = 'Crew is Full'

      const hireText = this.add.text(width / 2, btnY, btnLabel, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: canHire ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(203)
      modalElements.push(hireText)
    }

    // Close handlers
    const closeModal = () => this.closeModal(modalElements)
    closeBtn.on('pointerdown', closeModal)
    overlay.on('pointerdown', closeModal)
  }

  showHireConfirmation(member) {
    const { width, height } = this.cameras.main
    const modalElements = []
    const roleConfig = this.ROLE_CONFIG[member.role] || { icon: '👤', color: 0x6b7280 }

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modal = this.add.rectangle(width / 2, height / 2, 280, 180, 0x1a1a3a, 0.98)
      .setStrokeStyle(2, 0x22c55e)
      .setDepth(301)
    modalElements.push(modal)

    // Title
    const title = this.add.text(width / 2, height / 2 - 65, 'Hire Crew Member?', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(title)

    // Member info
    const memberInfo = this.add.text(width / 2, height / 2 - 35, `${roleConfig.icon} ${member.name}`, {
      fontSize: '12px',
      color: '#cccccc',
      wordWrap: { width: 240 },
      align: 'center'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(memberInfo)

    // Costs
    const hireCost = this.add.text(width / 2, height / 2, `Hire: ${formatMoney(member.hire_cost)}`, {
      fontSize: '13px',
      color: '#22c55e'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(hireCost)

    const dailyCost = this.add.text(width / 2, height / 2 + 20, `Daily: ${formatMoney(member.daily_cost)}`, {
      fontSize: '11px',
      color: '#f59e0b'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(dailyCost)

    // Buttons
    const btnY = height / 2 + 60

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 - 65, btnY, 90, 32, 0x444444)
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
    const confirmBtn = this.add.rectangle(width / 2 + 65, btnY, 90, 32, 0x22c55e)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(confirmBtn)

    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0x16a34a))
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0x22c55e))
    confirmBtn.on('pointerdown', async () => {
      this.closeModal(modalElements)
      await this.hireMember(member)
    })

    const confirmText = this.add.text(width / 2 + 65, btnY, 'Hire', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(confirmText)
  }

  showFireConfirmation(member) {
    const { width, height } = this.cameras.main
    const modalElements = []
    const roleConfig = this.ROLE_CONFIG[member.role] || { icon: '👤', color: 0x6b7280 }

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()
      .setDepth(300)
    modalElements.push(overlay)

    // Modal
    const modal = this.add.rectangle(width / 2, height / 2, 280, 160, 0x1a1a3a, 0.98)
      .setStrokeStyle(2, 0xef4444)
      .setDepth(301)
    modalElements.push(modal)

    // Title
    const title = this.add.text(width / 2, height / 2 - 55, '⚠️ Fire Crew Member?', {
      fontSize: '16px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(title)

    // Member info
    const memberInfo = this.add.text(width / 2, height / 2 - 20, `${roleConfig.icon} ${member.name}`, {
      fontSize: '12px',
      color: '#cccccc',
      wordWrap: { width: 240 },
      align: 'center'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(memberInfo)

    // Warning
    const warning = this.add.text(width / 2, height / 2 + 5, 'This cannot be undone!', {
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(302)
    modalElements.push(warning)

    // Buttons
    const btnY = height / 2 + 50

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 - 65, btnY, 90, 32, 0x444444)
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

    // Fire button
    const fireBtn = this.add.rectangle(width / 2 + 65, btnY, 90, 32, 0xef4444)
      .setInteractive({ useHandCursor: true }).setDepth(302)
    modalElements.push(fireBtn)

    fireBtn.on('pointerover', () => fireBtn.setFillStyle(0xdc2626))
    fireBtn.on('pointerout', () => fireBtn.setFillStyle(0xef4444))
    fireBtn.on('pointerdown', async () => {
      this.closeModal(modalElements)
      await this.fireMember(member)
    })

    const fireText = this.add.text(width / 2 + 65, btnY, 'Fire', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(303)
    modalElements.push(fireText)
  }

  closeModal(elements) {
    elements.forEach(el => el.destroy())
  }

  showToast(message, isSuccess = true) {
    const { width } = this.cameras.main

    const toastBg = this.add.rectangle(width / 2, 180, 240, 36, isSuccess ? 0x22c55e : 0xef4444, 0.95)
      .setDepth(400)
    const toastText = this.add.text(width / 2, 180, message, {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(401)

    // Animate in
    toastBg.setAlpha(0).setY(160)
    toastText.setAlpha(0).setY(160)

    this.tweens.add({
      targets: [toastBg, toastText],
      alpha: 1,
      y: 180,
      duration: 200,
      ease: 'Power2'
    })

    // Animate out
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [toastBg, toastText],
        alpha: 0,
        y: 160,
        duration: 300,
        onComplete: () => {
          toastBg.destroy()
          toastText.destroy()
        }
      })
    })
  }

  async hireMember(member) {
    try {
      const player = gameManager.player || getPlayerData()

      if ((player.cash || 0) < member.hire_cost) {
        this.showToast('Not enough cash!', false)
        return
      }

      // Deduct hire cost
      player.cash -= member.hire_cost

      // Add to player's crew
      if (!player.crew) player.crew = []
      const hiredMember = { ...member, loyalty: 100, hired_at: new Date().toISOString() }
      player.crew.push(hiredMember)

      // Save to localStorage
      savePlayerData(player)
      gameManager.player = player

      // Add to local scene state
      this.myCrewMembers.push(hiredMember)

      // Remove from available
      this.availableHires = this.availableHires.filter(h => h.id !== member.id)

      // Update UI
      this.slotsText.setText(`[C] ${this.myCrewMembers.length}/${this.crewSlots.max} Slots`)
      this.cashText.setText(`${SYMBOLS.cash} ${formatMoney(player.cash)}`)
      this.updateSynergyDisplay()

      this.showToast(`Hired ${member.name.split('"')[1] || member.name}!`, true)
      try { audioManager.playClick() } catch (e) { /* ignore */ }
      this.switchTab('crew')
    } catch (error) {
      this.showToast(error.message || 'Hire failed', false)
    }
  }

  async fireMember(member) {
    try {
      const player = gameManager.player || getPlayerData()

      // Remove from player's crew
      if (player.crew) {
        player.crew = player.crew.filter(m => m.id !== member.id)
      }

      // Save to localStorage
      savePlayerData(player)
      gameManager.player = player

      // Remove from local scene state
      this.myCrewMembers = this.myCrewMembers.filter(m => m.id !== member.id)

      // Update UI
      this.slotsText.setText(`[C] ${this.myCrewMembers.length}/${this.crewSlots.max} Slots`)
      this.updateSynergyDisplay()

      this.showToast(`Fired ${member.name.split('"')[1] || member.name}`, true)
      try { audioManager.playClick() } catch (e) { /* ignore */ }
      this.renderContent()
    } catch (error) {
      this.showToast(error.message || 'Fire failed', false)
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
