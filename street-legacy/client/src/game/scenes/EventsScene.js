import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { notificationManager } from '../managers/NotificationManager'
import { audioManager } from '../managers/AudioManager'
import { networkMessageManager } from '../managers/NetworkMessageManager'

// Network Theme
import { COLORS, BORDERS, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

// Local storage helpers
const getPlayerData = () => {
  try {
    const data = localStorage.getItem('street_legacy_player')
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

const savePlayerData = (data) => {
  try {
    localStorage.setItem('street_legacy_player', JSON.stringify(data))
    return true
  } catch (e) {
    return false
  }
}

/**
 * EventsScene - View and manage active events
 *
 * Features:
 * - Persistent random events that affect gameplay
 * - Event choices with real consequences
 * - Event history tracking
 * - Dynamic event generation based on player state
 */
export class EventsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EventsScene' })

    // Event templates for random generation
    this.EVENT_TEMPLATES = {
      opportunity: [
        {
          title: 'Hot Tip',
          description: 'A contact has inside information on a warehouse full of goods.',
          effectType: 'cash',
          minValue: 2000,
          maxValue: 8000,
          duration: 15, // minutes
          choices: [
            { label: '💰 Take the Job', action: 'accept', successRate: 0.7 },
            { label: '❌ Pass', action: 'decline' }
          ]
        },
        {
          title: 'Street Race',
          description: 'Underground street race with a big cash prize. High risk, high reward.',
          effectType: 'cash',
          minValue: 3000,
          maxValue: 10000,
          duration: 20,
          choices: [
            { label: '🏎️ Enter Race', action: 'accept', successRate: 0.5 },
            { label: '❌ Too Risky', action: 'decline' }
          ]
        },
        {
          title: 'Fence Contact',
          description: 'A fence is buying stolen goods at premium prices for the next hour.',
          effectType: 'cash',
          minValue: 1500,
          maxValue: 5000,
          duration: 60,
          choices: [
            { label: '🤝 Make the Deal', action: 'accept', successRate: 0.85 },
            { label: '❌ Not Interested', action: 'decline' }
          ]
        },
        {
          title: 'Hired Muscle',
          description: 'Someone needs protection for a meeting. Easy money.',
          effectType: 'cash',
          minValue: 1000,
          maxValue: 3000,
          duration: 30,
          choices: [
            { label: '💪 Take the Job', action: 'accept', successRate: 0.9 },
            { label: '❌ Pass', action: 'decline' }
          ]
        }
      ],
      threat: [
        {
          title: 'Police Crackdown',
          description: 'Cops are patrolling your area heavily. Lay low or risk getting caught.',
          effectType: 'heat',
          minValue: 10,
          maxValue: 25,
          duration: 30,
          choices: [
            { label: '🏠 Lay Low', action: 'accept', effect: 'avoid' },
            { label: '😤 Ignore It', action: 'decline', effect: 'heat' }
          ]
        },
        {
          title: 'Gang Shakedown',
          description: 'A local gang is demanding protection money from your turf.',
          effectType: 'cash',
          minValue: -2000,
          maxValue: -500,
          duration: 45,
          choices: [
            { label: '💵 Pay Them', action: 'accept', effect: 'pay' },
            { label: '👊 Fight Back', action: 'decline', successRate: 0.4, effect: 'fight' }
          ]
        },
        {
          title: 'Snitch Alert',
          description: 'Word is someone\'s been talking to the cops about your activities.',
          effectType: 'heat',
          minValue: 15,
          maxValue: 30,
          duration: 20,
          choices: [
            { label: '🔍 Investigate', action: 'accept', successRate: 0.6 },
            { label: '🤷 Ignore', action: 'decline', effect: 'heat' }
          ]
        },
        {
          title: 'Rival Territory',
          description: 'You\'ve been spotted in rival gang territory. They\'re not happy.',
          effectType: 'health',
          minValue: -30,
          maxValue: -10,
          duration: 15,
          choices: [
            { label: '🏃 Run', action: 'accept', effect: 'escape' },
            { label: '⚔️ Stand Ground', action: 'decline', successRate: 0.5, effect: 'fight' }
          ]
        }
      ],
      bonus: [
        {
          title: 'Lucky Day',
          description: 'You found a hidden stash while walking through an alley!',
          effectType: 'cash',
          minValue: 500,
          maxValue: 2000,
          duration: 5,
          autoApply: true
        },
        {
          title: 'Reputation Boost',
          description: 'Word of your exploits is spreading. People respect you more.',
          effectType: 'reputation',
          minValue: 5,
          maxValue: 15,
          duration: 10,
          autoApply: true
        },
        {
          title: 'Energy Drink',
          description: 'Someone left an energy drink. You feel refreshed!',
          effectType: 'energy',
          minValue: 20,
          maxValue: 50,
          duration: 5,
          autoApply: true
        },
        {
          title: 'Heat Cooldown',
          description: 'The cops got distracted by something else. Your heat is dropping.',
          effectType: 'heat',
          minValue: -20,
          maxValue: -10,
          duration: 10,
          autoApply: true
        }
      ],
      random: [
        {
          title: 'Mysterious Stranger',
          description: 'A stranger offers you a job. It could go either way...',
          effectType: 'cash',
          minValue: -1000,
          maxValue: 5000,
          duration: 30,
          choices: [
            { label: '🎲 Take the Risk', action: 'accept', successRate: 0.5 },
            { label: '❌ Walk Away', action: 'decline' }
          ]
        },
        {
          title: 'Gambling Den',
          description: 'You stumble upon an underground gambling den.',
          effectType: 'cash',
          minValue: -2000,
          maxValue: 4000,
          duration: 45,
          choices: [
            { label: '🎰 Try Your Luck', action: 'accept', successRate: 0.45 },
            { label: '❌ Keep Walking', action: 'decline' }
          ]
        },
        {
          title: 'Old Friend',
          description: 'An old friend from the neighborhood needs help.',
          effectType: 'reputation',
          minValue: 5,
          maxValue: 20,
          duration: 60,
          choices: [
            { label: '🤝 Help Them', action: 'accept', successRate: 0.8 },
            { label: '❌ Too Busy', action: 'decline', effect: 'rep_loss' }
          ]
        }
      ],
      police: [
        {
          title: 'Patrol Spotted',
          description: 'A police patrol is heading your way. What do you do?',
          effectType: 'heat',
          minValue: 5,
          maxValue: 20,
          duration: 10,
          choices: [
            { label: '🏃 Hide', action: 'accept', successRate: 0.8 },
            { label: '🚶 Act Natural', action: 'decline', successRate: 0.6 }
          ]
        },
        {
          title: 'Warrant Check',
          description: 'Cops are doing random ID checks in the area.',
          effectType: 'heat',
          minValue: 10,
          maxValue: 30,
          duration: 20,
          heatRequired: 30,
          choices: [
            { label: '🏠 Go Home', action: 'accept', effect: 'avoid' },
            { label: '🎭 Fake ID', action: 'decline', successRate: 0.7 }
          ]
        }
      ],
      gang: [
        {
          title: 'Turf War',
          description: 'Two gangs are fighting nearby. Stay out or join in?',
          effectType: 'reputation',
          minValue: 10,
          maxValue: 30,
          duration: 25,
          choices: [
            { label: '⚔️ Join the Fight', action: 'accept', successRate: 0.5, effect: 'fight' },
            { label: '🏃 Stay Clear', action: 'decline' }
          ]
        },
        {
          title: 'Gang Recruitment',
          description: 'A gang is impressed with you. They\'re offering membership.',
          effectType: 'reputation',
          minValue: 15,
          maxValue: 40,
          duration: 60,
          levelRequired: 5,
          choices: [
            { label: '🤝 Consider It', action: 'accept', effect: 'reputation' },
            { label: '✋ Stay Independent', action: 'decline' }
          ]
        }
      ]
    }
  }

  async create() {
    console.log('[EventsScene] create() started')
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
    this.CARD_HEIGHT = 110
    this.CARD_PADDING = 10
    this.SCROLL_START_Y = 145
    this.SCROLL_END_Y = height - 20

    // Event type configurations
    this.EVENT_TYPES = {
      opportunity: { icon: '💰', color: 0x22c55e, label: 'Opportunity' },
      threat: { icon: '🚨', color: 0xef4444, label: 'Threat' },
      bonus: { icon: '⚡', color: 0xf59e0b, label: 'Bonus' },
      random: { icon: '🎲', color: 0x8b5cf6, label: 'Random' },
      police: { icon: '🚔', color: 0x3b82f6, label: 'Police' },
      gang: { icon: '💀', color: 0x991b1b, label: 'Gang' }
    }

    // State
    this.activeEvents = []
    this.eventHistory = []
    this.contentItems = []
    this.scrollOffset = 0
    this.activeTab = 'active'
    this.isLoading = true

    // FULL opaque background - covers everything underneath - Network dark
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1).setOrigin(0).setDepth(100).setInteractive()

    // Create UI
    this.createHeader()
    this.createTabs()
    this.createCloseButton()
    this.setupScrolling()

    // Loading spinner
    this.createLoadingSpinner()

    // Load data
    await this.loadEventData()

    // Set up timer updates
    this.setupTimerUpdates()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background bar - Network dark panel
    const headerBg = this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(101)

    // Warning accent line at bottom of header - events = orange/warning
    this.add.rectangle(width / 2, 68, width, 2, COLORS.status.warning, 0.8)
      .setDepth(101)

    // Events icon - Network terminal style
    const icon = this.add.text(width / 2 - 130, 28, '[E]', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.warning)
    }).setOrigin(0.5).setDepth(102)

    // Title - Network terminal style
    this.add.text(width / 2, 28, 'EVENTS LOG', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.status.warning)
    }).setOrigin(0.5).setDepth(102)

    // Subtitle - Network style
    this.subtitleText = this.add.text(width / 2, 52, `${SYMBOLS.system} ACTIVE EVENTS`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5).setDepth(102)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 105
    const tabWidth = 120
    const tabSpacing = 10

    this.tabs = {}

    const tabConfigs = [
      { key: 'active', label: '⚡ ACTIVE', color: COLORS.status.warning },
      { key: 'history', label: '📜 HISTORY', color: COLORS.text.muted }
    ]

    const totalWidth = tabConfigs.length * tabWidth + (tabConfigs.length - 1) * tabSpacing
    const startX = width / 2 - totalWidth / 2 + tabWidth / 2

    tabConfigs.forEach((config, index) => {
      const x = startX + index * (tabWidth + tabSpacing)
      const isActive = config.key === this.activeTab

      const bg = this.add.rectangle(x, tabY, tabWidth, 32, isActive ? COLORS.bg.card : COLORS.bg.panel, 0.95)
        .setStrokeStyle(BORDERS.thin, isActive ? config.color : 0x333333, isActive ? 1 : 0.5)
        .setInteractive({ useHandCursor: true })

      const text = this.add.text(x, tabY, config.label, {
        ...getTextStyle('xs', isActive ? config.color : COLORS.text.muted, 'terminal'),
      }).setOrigin(0.5)

      bg.on('pointerover', () => {
        if (this.activeTab !== config.key) {
          bg.setFillStyle(COLORS.bg.elevated, 0.95)
          bg.setStrokeStyle(BORDERS.thin, config.color, 0.7)
        }
      })

      bg.on('pointerout', () => {
        if (this.activeTab !== config.key) {
          bg.setFillStyle(COLORS.bg.panel, 0.95)
          bg.setStrokeStyle(BORDERS.thin, 0x333333, 0.5)
        }
      })

      bg.on('pointerdown', () => {
        if (!this.isLoading) {
          this.switchTab(config.key)
        }
      })

      this.tabs[config.key] = { bg, text, config }
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
      bg.setFillStyle(isActive ? COLORS.bg.card : COLORS.bg.panel, 0.95)
      bg.setStrokeStyle(BORDERS.thin, isActive ? config.color : 0x333333, isActive ? 1 : 0.5)
      text.setStyle(getTextStyle('xs', isActive ? config.color : COLORS.text.muted, 'terminal'))
    })

    // Update subtitle
    this.subtitleText.setText(tab === 'active' ? `${SYMBOLS.system} ACTIVE EVENTS` : `${SYMBOLS.system} EVENT HISTORY`)

    // Render content
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
    .setDepth(999)
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
      console.log('[EventsScene] Close button clicked')
      this.closeScene()
    })
  }

  createLoadingSpinner() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    this.loadingContainer = this.add.container(width / 2, centerY)

    const spinner = this.add.circle(0, -20, 20, 0x333333, 0)
    spinner.setStrokeStyle(3, COLORS.status.warning)
    this.loadingContainer.add(spinner)

    const loadingText = this.add.text(0, 20, 'LOADING...', {
      ...getTextStyle('sm', COLORS.text.muted, 'terminal'),
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
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isLoading) {
        this.scrollOffset = Math.max(0, this.scrollOffset + deltaY * 0.5)
        this.renderContent()
      }
    })

    let startY = 0
    let startOffset = 0

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.SCROLL_START_Y && pointer.y < this.SCROLL_END_Y) {
        startY = pointer.y
        startOffset = this.scrollOffset
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && startY > 0 && !this.isLoading) {
        const deltaY = startY - pointer.y
        this.scrollOffset = Math.max(0, startOffset + deltaY)
        this.renderContent()
      }
    })

    this.input.on('pointerup', () => {
      startY = 0
    })
  }

  setupTimerUpdates() {
    // Update timers every second
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.activeTab === 'active' && !this.isLoading) {
          this.updateTimers()
        }
      }
    })
  }

  updateTimers() {
    // Update remaining time on timer texts
    this.contentItems.forEach(item => {
      const timerText = item.getData?.('timerText')
      const expiresAt = item.getData?.('expiresAt')

      if (timerText && expiresAt) {
        const remaining = Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000))

        if (remaining <= 0) {
          timerText.setText('Expired')
          timerText.setColor('#ef4444')
        } else {
          const mins = Math.floor(remaining / 60)
          const secs = remaining % 60
          timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`)

          if (remaining <= 60) {
            timerText.setColor('#ef4444')
          }
        }
      }
    })
  }

  async loadEventData() {
    this.isLoading = true
    this.clearContent()

    try {
      // Try to load from backend first
      try {
        const [active, history] = await Promise.all([
          gameManager.getActiveEvents(),
          gameManager.getEventHistory(20)
        ])
        this.activeEvents = active || []
        this.eventHistory = history || []
      } catch (e) {
        // Use local storage
        console.log('[EventsScene] Using local event data')
        this.loadLocalEventData()
      }

      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderContent()
    } catch (error) {
      console.error('Failed to load events:', error)
      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderError()
    }
  }

  loadLocalEventData() {
    const player = getPlayerData() || {}

    // Initialize events storage if needed
    if (!player.events) {
      player.events = {
        active: [],
        history: [],
        lastEventGeneration: 0,
        nextEventId: 1
      }
      savePlayerData(player)
    }

    // Clean up expired events
    this.cleanupExpiredEvents(player)

    // Check if we should generate new events
    this.checkEventGeneration(player)

    // Load events
    this.activeEvents = player.events.active || []
    this.eventHistory = (player.events.history || []).slice(0, 20) // Keep last 20
  }

  cleanupExpiredEvents(player) {
    const now = Date.now()
    const expiredEvents = []

    player.events.active = (player.events.active || []).filter(event => {
      const expiresAt = new Date(event.expires_at).getTime()
      if (expiresAt <= now) {
        // Move to history as expired
        expiredEvents.push({
          ...event,
          result: 'expired',
          completed_at: new Date().toISOString()
        })
        return false
      }
      return true
    })

    // Add expired events to history
    if (expiredEvents.length > 0) {
      player.events.history = [...expiredEvents, ...(player.events.history || [])]
      savePlayerData(player)
    }
  }

  checkEventGeneration(player) {
    const now = Date.now()
    const lastGen = player.events.lastEventGeneration || 0
    const timeSinceLastGen = now - lastGen

    // Generate new event every 5-15 minutes (randomized)
    const minInterval = 5 * 60 * 1000  // 5 minutes
    const maxActiveEvents = 5

    // Only generate if enough time passed and not at max events
    if (timeSinceLastGen >= minInterval && (player.events.active || []).length < maxActiveEvents) {
      // 60% chance to generate an event on each check
      if (Math.random() < 0.6) {
        const newEvent = this.generateRandomEvent(player)
        if (newEvent) {
          player.events.active.push(newEvent)
          player.events.lastEventGeneration = now

          // Send as Network message (THE NETWORK integration)
          networkMessageManager.eventToMessage(newEvent)

          // Apply auto-apply events immediately
          if (newEvent.autoApply) {
            this.applyEventEffect(newEvent, player, true)
            // Move to history
            player.events.active = player.events.active.filter(e => e.id !== newEvent.id)
            player.events.history = [{
              ...newEvent,
              result: 'auto',
              completed_at: new Date().toISOString()
            }, ...(player.events.history || [])]
          }

          savePlayerData(player)
        }
      } else {
        // Update last gen time even if no event generated
        player.events.lastEventGeneration = now
        savePlayerData(player)
      }
    }
  }

  generateRandomEvent(player) {
    const playerLevel = player.level || 1
    const playerHeat = player.heat || 0

    // Weight event types based on player state
    const weights = {
      opportunity: 30,
      threat: playerHeat > 50 ? 25 : 15,
      bonus: 20,
      random: 15,
      police: playerHeat > 30 ? 20 : 10,
      gang: playerLevel >= 3 ? 15 : 5
    }

    // Select event type
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
    let random = Math.random() * totalWeight
    let selectedType = 'opportunity'

    for (const [type, weight] of Object.entries(weights)) {
      random -= weight
      if (random <= 0) {
        selectedType = type
        break
      }
    }

    // Get templates for selected type
    const templates = this.EVENT_TEMPLATES[selectedType]
    if (!templates || templates.length === 0) return null

    // Filter templates by requirements
    const validTemplates = templates.filter(t => {
      if (t.levelRequired && playerLevel < t.levelRequired) return false
      if (t.heatRequired && playerHeat < t.heatRequired) return false
      return true
    })

    if (validTemplates.length === 0) return null

    // Select random template
    const template = validTemplates[Math.floor(Math.random() * validTemplates.length)]

    // Generate event from template
    const effectValue = Math.floor(
      template.minValue + Math.random() * (template.maxValue - template.minValue)
    )

    const event = {
      id: player.events.nextEventId++,
      type: selectedType,
      title: template.title,
      description: template.description,
      effect_type: template.effectType,
      effect_value: effectValue,
      expires_at: new Date(Date.now() + template.duration * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      autoApply: template.autoApply || false
    }

    // Add choices if available
    if (template.choices) {
      event.choices = template.choices.map(c => ({
        ...c,
        successRate: c.successRate || 1.0
      }))
    }

    return event
  }

  handleEventChoice(event, choice) {
    const player = getPlayerData() || {}
    if (!player.events) return

    audioManager.playClick()

    let result = 'completed'
    let actualEffect = event.effect_value

    if (choice.action === 'decline') {
      // Handle decline effects
      if (choice.effect === 'heat') {
        // Ignoring threat adds heat
        player.heat = Math.min(100, (player.heat || 0) + Math.abs(event.effect_value))
        result = 'ignored'
        notificationManager.showToast(`🔥 +${Math.abs(event.effect_value)} Heat`, 'warning')
      } else if (choice.effect === 'rep_loss') {
        // Declining help loses reputation
        player.reputation = Math.max(0, (player.reputation || 0) - 5)
        result = 'declined'
        notificationManager.showToast('👎 -5 Reputation', 'warning')
      } else {
        result = 'declined'
        notificationManager.showToast('Event declined', 'info')
      }
    } else if (choice.action === 'accept') {
      // Check success rate
      const success = Math.random() < (choice.successRate || 1.0)

      if (success) {
        this.applyEventEffect(event, player, true)
        result = 'success'
      } else {
        // Failed - apply penalty or reduced effect
        if (choice.effect === 'fight') {
          // Lost fight - take damage and lose money
          player.health = Math.max(0, (player.health || 100) - 20)
          player.cash = Math.max(0, (player.cash || 0) - 500)
          result = 'failed'
          notificationManager.showToast('💔 Fight lost! -20 HP, -$500', 'error')
        } else if (event.effect_type === 'cash' && event.effect_value > 0) {
          // Failed opportunity - no reward
          result = 'failed'
          notificationManager.showToast('❌ Failed! No reward.', 'error')
        } else {
          // Generic failure
          result = 'failed'
          notificationManager.showToast('❌ That didn\'t work out...', 'error')
        }
      }
    } else if (choice.effect === 'pay') {
      // Paying protection - lose money but avoid consequences
      const cost = Math.abs(event.effect_value)
      player.cash = Math.max(0, (player.cash || 0) - cost)
      result = 'paid'
      notificationManager.showToast(`💵 Paid $${cost.toLocaleString()}`, 'warning')
    } else if (choice.effect === 'avoid' || choice.effect === 'escape') {
      // Successfully avoided
      result = 'avoided'
      notificationManager.showToast('✅ Crisis averted!', 'success')
    }

    // Move event to history
    player.events.active = (player.events.active || []).filter(e => e.id !== event.id)
    player.events.history = [{
      ...event,
      result: result,
      choice_made: choice.label,
      completed_at: new Date().toISOString()
    }, ...(player.events.history || [])]

    // Keep history limited
    if (player.events.history.length > 50) {
      player.events.history = player.events.history.slice(0, 50)
    }

    savePlayerData(player)

    // Update gameManager if available
    if (gameManager.player) {
      gameManager.player = { ...gameManager.player, ...player }
    }

    // Reload events
    this.loadLocalEventData()
    this.renderContent()
  }

  applyEventEffect(event, player, showNotification = true) {
    const value = event.effect_value
    let message = ''

    switch (event.effect_type) {
      case 'cash':
        player.cash = Math.max(0, (player.cash || 0) + value)
        if (value >= 0) {
          message = `💵 +$${value.toLocaleString()}`
          if (showNotification) notificationManager.showToast(message, 'success')
        } else {
          message = `💸 -$${Math.abs(value).toLocaleString()}`
          if (showNotification) notificationManager.showToast(message, 'error')
        }
        break

      case 'reputation':
        player.reputation = Math.max(0, (player.reputation || 0) + value)
        message = value >= 0 ? `⭐ +${value} Rep` : `👎 ${value} Rep`
        if (showNotification) notificationManager.showToast(message, value >= 0 ? 'success' : 'warning')
        break

      case 'heat':
        player.heat = Math.max(0, Math.min(100, (player.heat || 0) + value))
        if (value > 0) {
          message = `🔥 +${value} Heat`
          if (showNotification) notificationManager.showToast(message, 'warning')
        } else {
          message = `❄️ ${value} Heat`
          if (showNotification) notificationManager.showToast(message, 'success')
        }
        break

      case 'energy':
        player.energy = Math.min(100, (player.energy || 100) + value)
        message = `⚡ +${value} Energy`
        if (showNotification) notificationManager.showToast(message, 'success')
        break

      case 'health':
        player.health = Math.max(0, Math.min(100, (player.health || 100) + value))
        if (value > 0) {
          message = `❤️ +${value} HP`
          if (showNotification) notificationManager.showToast(message, 'success')
        } else {
          message = `💔 ${value} HP`
          if (showNotification) notificationManager.showToast(message, 'error')
        }
        break

      case 'xp':
        player.xp = (player.xp || 0) + value
        message = `✨ +${value} XP`
        if (showNotification) notificationManager.showToast(message, 'success')
        break
    }

    // Track total earnings for dynasty
    if (event.effect_type === 'cash' && value > 0) {
      player.totalEarnings = (player.totalEarnings || 0) + value
    }

    savePlayerData(player)

    // Update gameManager
    if (gameManager.player) {
      gameManager.player = { ...gameManager.player, ...player }
    }
  }

  // Force generate a new event (for testing or special triggers)
  forceGenerateEvent(type = null) {
    const player = getPlayerData() || {}
    if (!player.events) {
      player.events = { active: [], history: [], lastEventGeneration: 0, nextEventId: 1 }
    }

    // Temporarily set a specific type if requested
    const originalTemplates = this.EVENT_TEMPLATES
    if (type && this.EVENT_TEMPLATES[type]) {
      const temp = {}
      temp[type] = this.EVENT_TEMPLATES[type]
      this.EVENT_TEMPLATES = temp
    }

    const newEvent = this.generateRandomEvent(player)

    // Restore templates
    this.EVENT_TEMPLATES = originalTemplates

    if (newEvent) {
      player.events.active.push(newEvent)

      // Send as Network message (THE NETWORK integration)
      networkMessageManager.eventToMessage(newEvent)

      savePlayerData(player)
      this.loadLocalEventData()
      this.renderContent()
      return newEvent
    }
    return null
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item.destroy) item.destroy()
    })
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    const events = this.activeTab === 'active' ? this.activeEvents : this.eventHistory

    if (events.length === 0) {
      this.renderEmptyState()
      return
    }

    this.renderEvents(events)
  }

  renderEvents(events) {
    const { width } = this.cameras.main

    let y = this.SCROLL_START_Y - this.scrollOffset

    events.forEach((event, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 20 && cardY < this.SCROLL_END_Y + 20) {
        this.renderEventCard(event, cardY, this.activeTab === 'history')
      }
    })

    // Calculate max scroll
    const totalHeight = events.length * (this.CARD_HEIGHT + this.CARD_PADDING)
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight + 20)

    if (this.scrollOffset > this.maxScrollOffset) {
      this.scrollOffset = this.maxScrollOffset
    }
  }

  renderEventCard(event, y, isHistory = false) {
    const { width } = this.cameras.main
    const cardWidth = width - 40
    const x = width / 2

    const config = this.EVENT_TYPES[event.type] || this.EVENT_TYPES.random

    // Card background - Network dark theme
    const cardBg = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth, this.CARD_HEIGHT - 5,
      isHistory ? COLORS.bg.panel : COLORS.bg.card, isHistory ? 0.7 : 0.95)
    cardBg.setStrokeStyle(isHistory ? BORDERS.thin : BORDERS.medium, config.color, isHistory ? 0.5 : 0.9)
    this.contentItems.push(cardBg)

    // Left color bar
    const colorBar = this.add.rectangle(x - cardWidth / 2 + 5, y + this.CARD_HEIGHT / 2, 6, this.CARD_HEIGHT - 10, config.color)
    this.contentItems.push(colorBar)

    // Icon background
    const iconX = 55
    const iconBg = this.add.rectangle(iconX, y + this.CARD_HEIGHT / 2, 45, 45, config.color, 0.2)
    this.contentItems.push(iconBg)

    // Icon
    const icon = this.add.text(iconX, y + this.CARD_HEIGHT / 2, config.icon, {
      fontSize: '24px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Title - Network terminal style
    const titleX = 90
    const title = this.add.text(titleX, y + 20, event.title, {
      ...getTextStyle('md', isHistory ? COLORS.text.secondary : COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    })
    this.contentItems.push(title)

    // Type label - Network style
    const typeLabel = this.add.text(titleX + title.width + 10, y + 20, config.label.toUpperCase(), {
      ...getTextStyle('xs', config.color, 'terminal'),
    }).setOrigin(0, 0.5)
    this.contentItems.push(typeLabel)

    // Description (truncated) - Network style
    let desc = event.description || ''
    if (desc.length > 60) {
      desc = desc.substring(0, 60) + '...'
    }

    const descText = this.add.text(titleX, y + 45, desc, {
      ...getTextStyle('xs', COLORS.text.muted, 'body'),
      wordWrap: { width: cardWidth - 120 }
    })
    this.contentItems.push(descText)

    // Effect preview
    if (event.effect_type && event.effect_value !== undefined) {
      let effectStr = ''
      let effectColor = '#22c55e'

      switch (event.effect_type) {
        case 'cash':
          effectStr = `${event.effect_value >= 0 ? '+' : ''}$${event.effect_value.toLocaleString()}`
          effectColor = event.effect_value >= 0 ? '#22c55e' : '#ef4444'
          break
        case 'xp':
        case 'xp_multiplier':
          effectStr = event.effect_type === 'xp_multiplier' ? `${event.effect_value}x XP` : `+${event.effect_value} XP`
          effectColor = '#8b5cf6'
          break
        case 'modifier':
          effectStr = `${event.effect_value > 0 ? '+' : ''}${event.effect_value}%`
          effectColor = event.effect_value >= 0 ? '#22c55e' : '#ef4444'
          break
        default:
          effectStr = `${event.effect_value}`
      }

      const effectText = this.add.text(titleX, y + 75, effectStr, {
        fontSize: '13px',
        color: effectColor,
        fontStyle: 'bold'
      })
      this.contentItems.push(effectText)
    }

    // Timer or completion time
    const timerX = width - 70

    if (isHistory) {
      // Show completion time
      const completedAt = new Date(event.completed_at)
      const timeAgo = this.getTimeAgo(completedAt)

      const timeText = this.add.text(timerX, y + 30, timeAgo, {
        fontSize: '11px',
        color: '#666666'
      }).setOrigin(1, 0.5)
      this.contentItems.push(timeText)

      // Result badge if available
      if (event.result) {
        const resultColors = {
          won: 0x22c55e,
          lost: 0xef4444,
          paid: 0xf59e0b,
          kept: 0x22c55e,
          declined: 0x6b7280
        }
        const resultColor = resultColors[event.result] || 0x6b7280

        const resultBadge = this.add.rectangle(timerX - 30, y + 55, 60, 20, resultColor, 0.8)
        this.contentItems.push(resultBadge)

        const resultText = this.add.text(timerX - 30, y + 55, event.result.toUpperCase(), {
          fontSize: '9px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5)
        this.contentItems.push(resultText)
      }
    } else {
      // Show remaining time
      if (event.expires_at) {
        const remaining = Math.max(0, Math.floor((new Date(event.expires_at) - new Date()) / 1000))
        const mins = Math.floor(remaining / 60)
        const secs = remaining % 60

        const timerBg = this.add.rectangle(timerX - 20, y + 30, 70, 24, 0x333333, 0.8)
        this.contentItems.push(timerBg)

        const timerIcon = this.add.text(timerX - 50, y + 30, '⏱', {
          fontSize: '12px'
        }).setOrigin(0.5)
        this.contentItems.push(timerIcon)

        const timerText = this.add.text(timerX - 15, y + 30, `${mins}:${secs.toString().padStart(2, '0')}`, {
          fontSize: '13px',
          color: remaining <= 60 ? '#ef4444' : '#f59e0b',
          fontStyle: 'bold'
        }).setOrigin(0.5)
        this.contentItems.push(timerText)

        // Store timer data for updates
        timerText.setData('expiresAt', event.expires_at)
        cardBg.setData('timerText', timerText)
        cardBg.setData('expiresAt', event.expires_at)
      }

      // View/Interact button
      const viewBtn = this.add.rectangle(timerX - 20, y + 70, 70, 28, config.color, 0.9)
        .setInteractive({ useHandCursor: true })
      this.contentItems.push(viewBtn)

      const viewText = this.add.text(timerX - 20, y + 70, 'VIEW', {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(viewText)

      viewBtn.on('pointerover', () => viewBtn.setAlpha(1))
      viewBtn.on('pointerout', () => viewBtn.setAlpha(0.9))
      viewBtn.on('pointerdown', () => this.showEventDetails(event))
    }

    // Make card clickable (for active events)
    if (!isHistory) {
      cardBg.setInteractive({ useHandCursor: true })
      cardBg.on('pointerdown', () => this.showEventDetails(event))
    }
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  showEventDetails(event) {
    // Create custom modal for event details with choices
    const { width, height } = this.cameras.main

    // Modal overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setInteractive()
      .setDepth(200)
    this.contentItems.push(overlay)

    const config = this.EVENT_TYPES[event.type] || this.EVENT_TYPES.random
    const modalWidth = width - 40
    const modalHeight = event.choices ? 320 : 220

    // Modal background - Network dark theme
    const modalBg = this.add.rectangle(width / 2, height / 2, modalWidth, modalHeight, COLORS.bg.panel, 0.98)
      .setStrokeStyle(BORDERS.medium, config.color, 0.9)
      .setDepth(201)
    this.contentItems.push(modalBg)

    const modalTop = height / 2 - modalHeight / 2

    // Event type icon
    const iconBg = this.add.circle(width / 2, modalTop + 40, 30, config.color, 0.3).setDepth(202)
    this.contentItems.push(iconBg)

    const icon = this.add.text(width / 2, modalTop + 40, config.icon, {
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(202)
    this.contentItems.push(icon)

    // Title - Network terminal style
    const title = this.add.text(width / 2, modalTop + 80, event.title, {
      ...getTextStyle('lg', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202)
    this.contentItems.push(title)

    // Type badge - Network style
    const typeBadge = this.add.text(width / 2, modalTop + 105, config.label.toUpperCase(), {
      ...getTextStyle('xs', config.color, 'terminal'),
    }).setOrigin(0.5).setDepth(202)
    this.contentItems.push(typeBadge)

    // Description - Network style
    const desc = this.add.text(width / 2, modalTop + 135, event.description, {
      ...getTextStyle('sm', COLORS.text.secondary, 'body'),
      wordWrap: { width: modalWidth - 40 },
      align: 'center'
    }).setOrigin(0.5, 0).setDepth(202)
    this.contentItems.push(desc)

    // Effect preview
    if (event.effect_value !== undefined) {
      let effectStr = ''
      let effectColor = '#22c55e'

      switch (event.effect_type) {
        case 'cash':
          effectStr = event.effect_value >= 0 ? `+$${event.effect_value.toLocaleString()}` : `-$${Math.abs(event.effect_value).toLocaleString()}`
          effectColor = event.effect_value >= 0 ? '#22c55e' : '#ef4444'
          break
        case 'reputation':
          effectStr = `${event.effect_value >= 0 ? '+' : ''}${event.effect_value} Rep`
          effectColor = event.effect_value >= 0 ? '#22c55e' : '#ef4444'
          break
        case 'heat':
          effectStr = `${event.effect_value >= 0 ? '+' : ''}${event.effect_value} Heat`
          effectColor = event.effect_value >= 0 ? '#ef4444' : '#22c55e'
          break
        case 'energy':
          effectStr = `+${event.effect_value} Energy`
          effectColor = '#3b82f6'
          break
        case 'health':
          effectStr = `${event.effect_value >= 0 ? '+' : ''}${event.effect_value} HP`
          effectColor = event.effect_value >= 0 ? '#22c55e' : '#ef4444'
          break
      }

      const effectText = this.add.text(width / 2, modalTop + 175, effectStr, {
        fontSize: '16px',
        color: effectColor,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(202)
      this.contentItems.push(effectText)
    }

    // Timer
    if (event.expires_at) {
      const remaining = Math.max(0, Math.floor((new Date(event.expires_at) - new Date()) / 1000))
      const mins = Math.floor(remaining / 60)
      const secs = remaining % 60

      const timerText = this.add.text(width / 2, modalTop + 200, `⏱️ ${mins}:${secs.toString().padStart(2, '0')} remaining`, {
        fontSize: '12px',
        color: remaining <= 60 ? '#ef4444' : '#f59e0b'
      }).setOrigin(0.5).setDepth(202)
      this.contentItems.push(timerText)
    }

    // Choice buttons
    if (event.choices && event.choices.length > 0) {
      const buttonY = modalTop + 240
      const buttonWidth = (modalWidth - 50) / event.choices.length
      const buttonHeight = 44

      event.choices.forEach((choice, index) => {
        const btnX = width / 2 - (modalWidth - 50) / 2 + buttonWidth / 2 + index * (buttonWidth + 10)

        // Determine button color
        let btnColor = 0x3b82f6
        if (choice.action === 'accept') btnColor = 0x22c55e
        if (choice.action === 'decline') btnColor = 0x6b7280
        if (choice.effect === 'fight') btnColor = 0xef4444
        if (choice.effect === 'pay') btnColor = 0xf59e0b

        const btn = this.add.rectangle(btnX, buttonY, buttonWidth - 5, buttonHeight, btnColor, 0.9)
          .setInteractive({ useHandCursor: true })
          .setDepth(202)
        this.contentItems.push(btn)

        // Success rate indicator
        if (choice.successRate && choice.successRate < 1) {
          const successPct = Math.floor(choice.successRate * 100)
          const rateText = this.add.text(btnX, buttonY - 12, `${successPct}% success`, {
            fontSize: '9px',
            color: '#fbbf24'
          }).setOrigin(0.5).setDepth(203)
          this.contentItems.push(rateText)
        }

        const btnText = this.add.text(btnX, buttonY + 3, choice.label, {
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203)
        this.contentItems.push(btnText)

        btn.on('pointerover', () => {
          btn.setAlpha(1)
          btn.setScale(1.02)
        })
        btn.on('pointerout', () => {
          btn.setAlpha(0.9)
          btn.setScale(1)
        })
        btn.on('pointerdown', () => {
          // Close modal and handle choice
          this.handleEventChoice(event, choice)
        })
      })
    } else {
      // Just a close button for auto events or no-choice events
      const closeBtn = this.add.rectangle(width / 2, modalTop + modalHeight - 40, 120, 40, 0x6b7280, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(202)
      this.contentItems.push(closeBtn)

      const closeText = this.add.text(width / 2, modalTop + modalHeight - 40, 'Close', {
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(203)
      this.contentItems.push(closeText)

      closeBtn.on('pointerdown', () => {
        this.renderContent()
      })
    }

    // Click overlay to dismiss
    overlay.on('pointerdown', () => {
      this.renderContent()
    })
  }

  renderEmptyState() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 50,
      this.activeTab === 'active' ? '📭' : '📜', {
        fontSize: '56px'
      }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 10,
      this.activeTab === 'active' ? 'NO ACTIVE EVENTS' : 'NO EVENT HISTORY', {
        ...getTextStyle('lg', COLORS.text.primary, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 45,
      this.activeTab === 'active' ?
        'Events spawn randomly as you play.\nCheck back in a few minutes!' :
        'Complete events to build your history', {
          ...getTextStyle('sm', COLORS.text.muted, 'body'),
          align: 'center'
        }).setOrigin(0.5)
    this.contentItems.push(msgText)

    // Generate Event button (for active tab only)
    if (this.activeTab === 'active') {
      const genBtn = this.add.rectangle(width / 2, centerY + 100, 160, 44, COLORS.bg.elevated, 0.9)
        .setStrokeStyle(BORDERS.medium, COLORS.status.warning)
        .setInteractive({ useHandCursor: true })
      this.contentItems.push(genBtn)

      const genText = this.add.text(width / 2, centerY + 100, '🎲 GENERATE EVENT', {
        ...getTextStyle('sm', COLORS.status.warning, 'terminal'),
      }).setOrigin(0.5)
      this.contentItems.push(genText)

      genBtn.on('pointerover', () => {
        genBtn.setFillStyle(COLORS.bg.card, 1)
        genBtn.setStrokeStyle(BORDERS.thick, COLORS.status.warning, 1)
        genBtn.setScale(1.05)
        audioManager.playHover()
      })
      genBtn.on('pointerout', () => {
        genBtn.setFillStyle(COLORS.bg.elevated, 0.9)
        genBtn.setStrokeStyle(BORDERS.medium, COLORS.status.warning)
        genBtn.setScale(1)
      })
      genBtn.on('pointerdown', () => {
        audioManager.playClick()
        const newEvent = this.forceGenerateEvent()
        if (newEvent) {
          notificationManager.showToast(`New event: ${newEvent.title}!`, 'info')
        }
      })
    }
  }

  renderError() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 30, '⚠️', {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 20, 'FAILED TO LOAD', {
      ...getTextStyle('lg', COLORS.status.danger, 'terminal'),
    }).setOrigin(0.5)
    this.contentItems.push(titleText)
  }

  closeScene() {
    if (this.timerEvent) {
      this.timerEvent.remove()
    }

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
