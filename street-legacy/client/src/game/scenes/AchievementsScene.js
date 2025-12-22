import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'

// Network Theme
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

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
 * AchievementsScene - Player achievements and rewards
 *
 * Features:
 * - Persistent achievement tracking with local storage
 * - Real progress based on player stats
 * - Claim rewards that apply to player
 * - Category filtering
 * - Secret achievements
 */
export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AchievementsScene' })

    // Achievement definitions
    this.ACHIEVEMENT_DEFS = {
      // Crime achievements
      first_crime: {
        name: 'First Steps',
        description: 'Complete your first op',
        icon: '🔫',
        category: 'crime',
        cashReward: 100,
        xpReward: 25,
        target: 1,
        stat: 'crimes_committed',
        secret: false
      },
      crime_10: {
        name: 'Street Runner',
        description: 'Complete 10 ops',
        icon: '🎯',
        category: 'crime',
        cashReward: 500,
        xpReward: 100,
        target: 10,
        stat: 'crimes_committed',
        secret: false
      },
      crime_50: {
        name: 'Veteran Operator',
        description: 'Complete 50 ops',
        icon: '💣',
        category: 'crime',
        cashReward: 2500,
        xpReward: 500,
        target: 50,
        stat: 'crimes_committed',
        secret: false
      },
      crime_100: {
        name: 'Network Boss',
        description: 'Complete 100 ops',
        icon: '👑',
        category: 'crime',
        cashReward: 10000,
        xpReward: 1000,
        target: 100,
        stat: 'crimes_committed',
        secret: false
      },
      crime_500: {
        name: 'Mastermind',
        description: 'Complete 500 ops',
        icon: '🧠',
        category: 'crime',
        cashReward: 50000,
        xpReward: 5000,
        target: 500,
        stat: 'crimes_committed',
        secret: false
      },
      heist_1: {
        name: 'First Major Op',
        description: 'Complete your first major op',
        icon: '🎭',
        category: 'crime',
        cashReward: 1000,
        xpReward: 200,
        target: 1,
        stat: 'heists_completed',
        secret: false
      },
      heist_10: {
        name: 'Major Ops Specialist',
        description: 'Complete 10 major ops',
        icon: '🏦',
        category: 'crime',
        cashReward: 15000,
        xpReward: 1500,
        target: 10,
        stat: 'heists_completed',
        secret: false
      },
      kills_10: {
        name: 'Enforcer',
        description: 'Eliminate 10 enemies',
        icon: '💀',
        category: 'crime',
        cashReward: 2000,
        xpReward: 400,
        target: 10,
        stat: 'kills',
        secret: false
      },
      kills_50: {
        name: 'Hitman',
        description: 'Eliminate 50 enemies',
        icon: '☠️',
        category: 'crime',
        cashReward: 10000,
        xpReward: 2000,
        target: 50,
        stat: 'kills',
        secret: true
      },

      // Wealth achievements
      earn_1k: {
        name: 'First Grand',
        description: 'Earn $1,000 total',
        icon: '💵',
        category: 'wealth',
        cashReward: 200,
        xpReward: 50,
        target: 1000,
        stat: 'totalEarnings',
        secret: false
      },
      earn_10k: {
        name: 'Money Maker',
        description: 'Earn $10,000 total',
        icon: '💰',
        category: 'wealth',
        cashReward: 1000,
        xpReward: 200,
        target: 10000,
        stat: 'totalEarnings',
        secret: false
      },
      earn_100k: {
        name: 'Big Earner',
        description: 'Earn $100,000 total',
        icon: '🤑',
        category: 'wealth',
        cashReward: 5000,
        xpReward: 500,
        target: 100000,
        stat: 'totalEarnings',
        secret: false
      },
      earn_1m: {
        name: 'Millionaire',
        description: 'Earn $1,000,000 total',
        icon: '💎',
        category: 'wealth',
        cashReward: 25000,
        xpReward: 2500,
        target: 1000000,
        stat: 'totalEarnings',
        secret: false
      },
      cash_50k: {
        name: 'Fat Stacks',
        description: 'Have $50,000 cash at once',
        icon: '💳',
        category: 'wealth',
        cashReward: 5000,
        xpReward: 300,
        target: 50000,
        stat: 'cash',
        secret: false
      },
      property_1: {
        name: 'Landlord',
        description: 'Own your first property',
        icon: '🏠',
        category: 'wealth',
        cashReward: 1000,
        xpReward: 100,
        target: 1,
        stat: 'properties_owned',
        secret: false
      },
      property_5: {
        name: 'Real Estate Mogul',
        description: 'Own 5 properties',
        icon: '🏢',
        category: 'wealth',
        cashReward: 10000,
        xpReward: 1000,
        target: 5,
        stat: 'properties_owned',
        secret: false
      },
      invest_profit: {
        name: 'Wall Street Wolf',
        description: 'Make $10,000 from investments',
        icon: '📈',
        category: 'wealth',
        cashReward: 5000,
        xpReward: 500,
        target: 10000,
        stat: 'investment_profits',
        secret: false
      },

      // Level achievements
      level_5: {
        name: 'Rising Star',
        description: 'Reach level 5',
        icon: '⬆️',
        category: 'level',
        cashReward: 500,
        xpReward: 0,
        target: 5,
        stat: 'level',
        secret: false
      },
      level_10: {
        name: 'Established',
        description: 'Reach level 10',
        icon: '📊',
        category: 'level',
        cashReward: 2000,
        xpReward: 0,
        target: 10,
        stat: 'level',
        secret: false
      },
      level_25: {
        name: 'Veteran',
        description: 'Reach level 25',
        icon: '🎖️',
        category: 'level',
        cashReward: 10000,
        xpReward: 0,
        target: 25,
        stat: 'level',
        secret: false
      },
      level_50: {
        name: 'Legend',
        description: 'Reach level 50',
        icon: '🏆',
        category: 'level',
        cashReward: 50000,
        xpReward: 0,
        target: 50,
        stat: 'level',
        secret: false
      },
      reputation_100: {
        name: 'Street Cred',
        description: 'Reach 100 reputation',
        icon: '⭐',
        category: 'level',
        cashReward: 2000,
        xpReward: 200,
        target: 100,
        stat: 'reputation',
        secret: false
      },
      reputation_500: {
        name: 'Respected',
        description: 'Reach 500 reputation',
        icon: '🌟',
        category: 'level',
        cashReward: 10000,
        xpReward: 1000,
        target: 500,
        stat: 'reputation',
        secret: false
      },

      // Special achievements
      first_login: {
        name: 'Welcome',
        description: 'Join the network',
        icon: '👋',
        category: 'special',
        cashReward: 500,
        xpReward: 50,
        target: 1,
        stat: 'logins',
        secret: false,
        autoUnlock: true
      },
      jobs_10: {
        name: 'Hard Worker',
        description: 'Complete 10 legal jobs',
        icon: '💼',
        category: 'special',
        cashReward: 500,
        xpReward: 100,
        target: 10,
        stat: 'jobs_completed',
        secret: false
      },
      jobs_50: {
        name: 'Employee of the Month',
        description: 'Complete 50 legal jobs',
        icon: '🏅',
        category: 'special',
        cashReward: 2500,
        xpReward: 500,
        target: 50,
        stat: 'jobs_completed',
        secret: false
      },
      events_10: {
        name: 'Opportunist',
        description: 'Complete 10 events',
        icon: '📋',
        category: 'special',
        cashReward: 1000,
        xpReward: 200,
        target: 10,
        stat: 'events_completed',
        secret: false
      },
      minigames_25: {
        name: 'Gamer',
        description: 'Complete 25 minigames',
        icon: '🎮',
        category: 'special',
        cashReward: 2000,
        xpReward: 400,
        target: 25,
        stat: 'minigames_completed',
        secret: false
      },
      debt_collect: {
        name: 'Loan Shark',
        description: 'Collect 5 debts',
        icon: '🦈',
        category: 'special',
        cashReward: 3000,
        xpReward: 300,
        target: 5,
        stat: 'debts_collected',
        secret: false
      },
      generation_2: {
        name: 'Legacy',
        description: 'Start a second generation character',
        icon: '👶',
        category: 'special',
        cashReward: 5000,
        xpReward: 500,
        target: 2,
        stat: 'generation',
        secret: false
      },
      survive_arrest: {
        name: 'Slippery',
        description: 'Avoid arrest 10 times',
        icon: '🏃',
        category: 'special',
        cashReward: 2000,
        xpReward: 300,
        target: 10,
        stat: 'arrests_avoided',
        secret: true
      },
      high_heat: {
        name: 'Most Wanted',
        description: 'Reach 100 heat and survive',
        icon: '🔥',
        category: 'special',
        cashReward: 5000,
        xpReward: 500,
        target: 100,
        stat: 'max_heat_survived',
        secret: true
      }
    }
  }

  async create() {
    console.log('[AchievementsScene] create() started')
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
    this.CARD_HEIGHT = 100
    this.CARD_PADDING = 10
    this.SCROLL_START_Y = 155
    this.SCROLL_END_Y = height - 20

    // Category configuration
    this.CATEGORIES = {
      all: { label: 'All', icon: '📋' },
      crime: { label: 'Ops', icon: '🔫', color: 0xef4444 },
      wealth: { label: 'Wealth', icon: '💰', color: 0x22c55e },
      level: { label: 'Level', icon: '📈', color: 0x3b82f6 },
      special: { label: 'Special', icon: '⭐', color: 0xf59e0b }
    }

    // State
    this.achievements = []
    this.stats = { total: 0, unlocked: 0, claimed: 0 }
    this.contentItems = []
    this.scrollOffset = 0
    this.activeCategory = 'all'
    this.isLoading = true
    this.selectedAchievement = null

    // FULL opaque background - covers everything underneath - Network theme
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1).setOrigin(0).setDepth(100).setInteractive()

    // Create UI
    this.createHeader()
    this.createTabs()
    this.createCloseButton()
    this.setupScrolling()

    // Loading spinner
    this.createLoadingSpinner()

    // Load data
    await this.loadAchievements()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background bar - Network dark panel
    const headerBg = this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(101)

    // Green accent line at bottom of header - success color (achievements)
    this.add.rectangle(width / 2, 68, width, 2, COLORS.status.success, 0.8)
      .setDepth(101)

    // Achievement icon - Network terminal style
    const icon = this.add.text(width / 2 - 130, 28, '[A]', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.success)
    }).setOrigin(0.5).setDepth(102)

    // Animate icon
    this.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0.6 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Title - Network terminal style
    this.titleText = this.add.text(width / 2, 28, 'ACHIEVEMENTS', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.status.success)
    }).setOrigin(0.5).setDepth(102)

    // Counter text with system symbol prefix
    this.counterText = this.add.text(width / 2, 48, `${SYMBOLS.system} 0/0 UNLOCKED`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(102)

    // Progress bar background
    this.progressBg = this.add.rectangle(width / 2, 82, width - 100, 8, COLORS.bg.void)
    this.progressBg.setStrokeStyle(BORDERS.thin, COLORS.network.dim)

    // Progress bar fill
    this.progressFill = this.add.rectangle(
      50,
      82,
      0,
      8,
      COLORS.status.success
    ).setOrigin(0, 0.5)

    // Horizontal divider
    this.add.rectangle(width / 2, 100, width - 40, 1, COLORS.network.dim)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 125
    const tabWidth = 70
    const tabSpacing = 5

    this.tabs = {}

    const categories = Object.keys(this.CATEGORIES)
    const totalWidth = categories.length * tabWidth + (categories.length - 1) * tabSpacing
    const startX = width / 2 - totalWidth / 2 + tabWidth / 2

    categories.forEach((key, index) => {
      const config = this.CATEGORIES[key]
      const x = startX + index * (tabWidth + tabSpacing)
      const isActive = key === this.activeCategory

      const bg = this.add.rectangle(x, tabY, tabWidth, 28,
        isActive ? (config.color || COLORS.status.success) : COLORS.bg.card, 0.95)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(BORDERS.thin, isActive ? (config.color || COLORS.status.success) : COLORS.network.dim)

      const text = this.add.text(x, tabY, config.icon, {
        ...getTerminalStyle('md'),
        color: toHexString(isActive ? COLORS.text.primary : COLORS.text.muted)
      }).setOrigin(0.5)

      bg.on('pointerover', () => {
        if (this.activeCategory !== key) {
          bg.setFillStyle(COLORS.bg.elevated, 0.95)
          bg.setStrokeStyle(BORDERS.thin, COLORS.text.muted)
        }
      })

      bg.on('pointerout', () => {
        if (this.activeCategory !== key) {
          bg.setFillStyle(COLORS.bg.card, 0.95)
          bg.setStrokeStyle(BORDERS.thin, COLORS.network.dim)
        }
      })

      bg.on('pointerdown', () => {
        if (!this.isLoading) {
          this.switchCategory(key)
        }
      })

      this.tabs[key] = { bg, text, config }
    })
  }

  switchCategory(category) {
    if (this.activeCategory === category) return

    this.activeCategory = category
    this.scrollOffset = 0

    // Update tab styles
    Object.keys(this.tabs).forEach(key => {
      const isActive = key === category
      const config = this.CATEGORIES[key]
      const tabBg = this.tabs[key].bg
      const tabText = this.tabs[key].text

      tabBg.setFillStyle(isActive ? (config.color || COLORS.status.success) : COLORS.bg.card, 0.95)
      tabBg.setStrokeStyle(BORDERS.thin, isActive ? (config.color || COLORS.status.success) : COLORS.network.dim)
      tabText.setColor(toHexString(isActive ? COLORS.text.primary : COLORS.text.muted))
    })

    // Reload display
    this.renderContent()
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
      closeBtn.setColor(toHexString(COLORS.status.danger))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.secondary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[AchievementsScene] Close button clicked')
      this.closeScene()
    })
  }

  createLoadingSpinner() {
    const { width, height } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    // Loading container
    this.loadingContainer = this.add.container(width / 2, centerY)

    // Spinner circle
    this.spinner = this.add.circle(0, -20, 20, COLORS.bg.void, 0)
    this.spinner.setStrokeStyle(3, COLORS.status.success)
    this.loadingContainer.add(this.spinner)

    // Loading text - terminal style
    this.loadingText = this.add.text(0, 20, `${SYMBOLS.system} LOADING...`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5)
    this.loadingContainer.add(this.loadingText)

    // Spin animation
    this.tweens.add({
      targets: this.spinner,
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

  showLoadingSpinner() {
    if (this.loadingContainer) {
      this.loadingContainer.setVisible(true)
    }
  }

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isLoading) {
        this.scrollOffset = Math.max(0, this.scrollOffset + deltaY * 0.5)
        this.renderContent()
      }
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

  async loadAchievements() {
    this.isLoading = true
    this.showLoadingSpinner()
    this.clearContent()

    try {
      // Try to load from backend first
      let result
      try {
        result = await gameManager.getAchievements()
        this.achievements = result.achievements || []
        this.stats = result.stats || { total: 0, unlocked: 0, claimed: 0 }
      } catch (e) {
        // Use local storage system
        console.log('[AchievementsScene] Using local achievement data')
        this.loadLocalAchievements()
      }

      // Update header stats
      this.updateHeader()

      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderContent()
    } catch (error) {
      console.error('Failed to load achievements:', error)
      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderError()
    }
  }

  loadLocalAchievements() {
    const player = getPlayerData() || gameManager.player || {}

    // Initialize achievements storage if needed
    if (!player.achievements) {
      player.achievements = {
        unlocked: {},  // { achievementId: unlockedAt timestamp }
        claimed: {}    // { achievementId: claimedAt timestamp }
      }
      savePlayerData(player)
    }

    // Build achievements list with real progress
    this.achievements = []
    const newlyUnlocked = []

    for (const [id, def] of Object.entries(this.ACHIEVEMENT_DEFS)) {
      const progress = this.getStatValue(player, def.stat)
      const wasUnlocked = !!player.achievements.unlocked[id]
      const isUnlocked = progress >= def.target || def.autoUnlock
      const isClaimed = !!player.achievements.claimed[id]

      // Check for new unlocks
      if (isUnlocked && !wasUnlocked) {
        player.achievements.unlocked[id] = Date.now()
        newlyUnlocked.push({ id, def })
      }

      this.achievements.push({
        id: id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        cash_reward: def.cashReward,
        xp_reward: def.xpReward,
        target: def.target,
        progress: Math.min(progress, def.target),
        is_secret: def.secret,
        unlocked: isUnlocked || wasUnlocked,
        claimed: isClaimed,
        unlocked_at: player.achievements.unlocked[id] ?
          new Date(player.achievements.unlocked[id]).toISOString() : null
      })
    }

    // Save any new unlocks
    if (newlyUnlocked.length > 0) {
      savePlayerData(player)

      // Show notifications for new unlocks (max 3)
      newlyUnlocked.slice(0, 3).forEach((item, index) => {
        setTimeout(() => {
          notificationManager.showToast(
            `🏆 Achievement Unlocked: ${item.def.name}!`,
            'success'
          )
        }, index * 1000)
      })
    }

    // Calculate stats
    const unlocked = this.achievements.filter(a => a.unlocked).length
    const claimed = this.achievements.filter(a => a.claimed).length

    this.stats = {
      total: this.achievements.length,
      unlocked: unlocked,
      claimed: claimed
    }
  }

  getStatValue(player, stat) {
    // Map stat names to player data locations
    switch (stat) {
      case 'crimes_committed':
        return player.crimes_committed || player.stats?.crimes_committed || 0
      case 'heists_completed':
        return player.heists_completed || player.stats?.heists_completed || 0
      case 'kills':
        return player.kills || player.stats?.kills || 0
      case 'totalEarnings':
        return player.totalEarnings || player.stats?.total_earned || 0
      case 'cash':
        return player.cash || 0
      case 'properties_owned':
        const props = player.properties || []
        return Array.isArray(props) ? props.length : 0
      case 'investment_profits':
        return player.investment_profits || 0
      case 'level':
        return player.level || 1
      case 'reputation':
        return player.reputation || 0
      case 'logins':
        return 1 // Always at least 1 login
      case 'jobs_completed':
        return player.jobs_completed || player.stats?.jobs_completed || 0
      case 'events_completed':
        const events = player.events?.history || []
        return events.filter(e => e.result === 'success' || e.result === 'auto').length
      case 'minigames_completed':
        return player.minigames_completed || player.stats?.minigames_completed || 0
      case 'debts_collected':
        return player.debts_collected || 0
      case 'generation':
        return player.lineage?.generation || 1
      case 'arrests_avoided':
        return player.arrests_avoided || 0
      case 'max_heat_survived':
        return player.max_heat_survived || 0
      default:
        return 0
    }
  }

  // Check achievements progress (call this from other scenes when stats change)
  static checkAchievements() {
    const player = getPlayerData()
    if (!player || !player.achievements) return

    // This can be called statically to check for new unlocks
    // without opening the achievements scene
  }

  updateHeader() {
    const { width } = this.cameras.main

    // Update counter with system symbol
    this.counterText.setText(`${SYMBOLS.system} ${this.stats.unlocked}/${this.stats.total} UNLOCKED`)

    // Update progress bar
    const barWidth = width - 100
    const fillWidth = this.stats.total > 0 ? (this.stats.unlocked / this.stats.total) * barWidth : 0

    this.tweens.add({
      targets: this.progressFill,
      width: fillWidth,
      duration: 500,
      ease: 'Power2'
    })
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []

    // Clean up glow tweens
    if (this.glowTweens) {
      this.glowTweens.forEach(tween => tween.stop())
      this.glowTweens = []
    }
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    if (this.achievements.length === 0) {
      this.renderEmptyState()
      return
    }

    // Filter achievements by category
    let filtered = this.achievements
    if (this.activeCategory !== 'all') {
      filtered = this.achievements.filter(a => a.category === this.activeCategory)
    }

    // Sort: unclaimed first, then unlocked, then locked
    filtered.sort((a, b) => {
      if (a.unlocked && !a.claimed && !(b.unlocked && !b.claimed)) return -1
      if (b.unlocked && !b.claimed && !(a.unlocked && !a.claimed)) return 1
      if (a.unlocked && !b.unlocked) return -1
      if (b.unlocked && !a.unlocked) return 1
      return 0
    })

    this.renderAchievements(filtered)
  }

  renderAchievements(achievements) {
    const { width, height } = this.cameras.main
    this.glowTweens = []

    let y = this.SCROLL_START_Y - this.scrollOffset

    achievements.forEach((achievement, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + this.CARD_PADDING)

      // Only render visible cards
      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 20 && cardY < this.SCROLL_END_Y + 20) {
        this.renderAchievementCard(achievement, cardY)
      }
    })

    // Calculate max scroll
    const totalHeight = achievements.length * (this.CARD_HEIGHT + this.CARD_PADDING)
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight + 20)

    // Clamp scroll offset
    if (this.scrollOffset > this.maxScrollOffset) {
      this.scrollOffset = this.maxScrollOffset
    }
  }

  renderAchievementCard(achievement, y) {
    const { width } = this.cameras.main
    const cardWidth = width - 40
    const x = width / 2

    // Determine state
    const isLocked = !achievement.unlocked
    const isUnclaimed = achievement.unlocked && !achievement.claimed
    const isClaimed = achievement.claimed

    // Card background color based on state - Network theme
    let bgColor, bgAlpha, strokeColor, strokeWidth

    if (isLocked) {
      bgColor = COLORS.bg.card
      bgAlpha = 0.7
      strokeColor = COLORS.network.dim
      strokeWidth = BORDERS.thin
    } else if (isUnclaimed) {
      bgColor = COLORS.bg.panel
      bgAlpha = 0.95
      strokeColor = COLORS.status.success
      strokeWidth = BORDERS.medium
    } else {
      bgColor = COLORS.bg.card
      bgAlpha = 0.85
      strokeColor = COLORS.status.success
      strokeWidth = BORDERS.thin
    }

    // Card background
    const cardBg = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth, this.CARD_HEIGHT - 5, bgColor, bgAlpha)
    cardBg.setStrokeStyle(strokeWidth, strokeColor)
    this.contentItems.push(cardBg)

    // Glow effect for unclaimed - Network theme
    if (isUnclaimed) {
      const glow = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth + 6, this.CARD_HEIGHT + 2, COLORS.status.success, 0.15)
      glow.setDepth(-1)
      this.contentItems.push(glow)

      // Pulsing glow animation
      const glowTween = this.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.3 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
      this.glowTweens.push(glowTween)
    }

    // Icon container - Network theme
    const iconX = 50
    const iconBgColor = isLocked ? COLORS.bg.elevated : (this.CATEGORIES[achievement.category]?.color || COLORS.status.info)

    const iconBg = this.add.rectangle(iconX, y + this.CARD_HEIGHT / 2, 50, 50, iconBgColor, isLocked ? 0.5 : 0.9)
    this.contentItems.push(iconBg)

    // Icon
    let iconText = achievement.icon || '🏆'
    if (isLocked) {
      iconText = '🔒'
    }

    const icon = this.add.text(iconX, y + this.CARD_HEIGHT / 2, iconText, {
      fontSize: '28px'
    }).setOrigin(0.5)

    if (isLocked) {
      icon.setAlpha(0.6)
    }
    this.contentItems.push(icon)

    // Achievement name - Network terminal style
    const nameX = 90
    let displayName = achievement.name

    // Hide name for locked secret achievements
    if (isLocked && achievement.is_secret) {
      displayName = '???'
    }

    const nameText = this.add.text(nameX, y + 18, displayName, {
      ...getTerminalStyle('md'),
      color: toHexString(isLocked ? COLORS.text.muted : (isClaimed ? COLORS.text.secondary : COLORS.text.primary)),
      fontStyle: 'bold'
    })
    this.contentItems.push(nameText)

    // Status badge - Network theme
    let badge = null
    if (isUnclaimed) {
      badge = this.createBadge(nameX + nameText.width + 12, y + 18, 'NEW', COLORS.status.success)
    } else if (isClaimed) {
      badge = this.createBadge(nameX + nameText.width + 12, y + 18, SYMBOLS.check, COLORS.text.muted)
    }

    // Description - Network terminal style
    let description = achievement.description
    if (isLocked && achievement.is_secret) {
      description = 'Complete the secret objective to unlock'
    }

    const descText = this.add.text(nameX, y + 40, description, {
      ...getTerminalStyle('xs'),
      color: toHexString(isLocked ? COLORS.text.muted : COLORS.text.secondary),
      wordWrap: { width: cardWidth - 160 }
    })
    this.contentItems.push(descText)

    // Progress bar (for trackable achievements) - Network theme
    if (achievement.target && achievement.target > 1 && !isClaimed) {
      const progressY = y + 68
      const progressWidth = 150
      const progressHeight = 8

      // Progress bar background
      const progressBg = this.add.rectangle(nameX + progressWidth / 2, progressY, progressWidth, progressHeight, COLORS.bg.void)
      progressBg.setStrokeStyle(BORDERS.thin, COLORS.network.dim)
      this.contentItems.push(progressBg)

      // Progress fill
      const fillPercent = Math.min(1, (achievement.progress || 0) / achievement.target)
      const fillWidth = fillPercent * progressWidth

      if (fillWidth > 0) {
        const progressFill = this.add.rectangle(
          nameX,
          progressY,
          fillWidth,
          progressHeight,
          isLocked ? COLORS.text.muted : COLORS.status.success
        ).setOrigin(0, 0.5)
        this.contentItems.push(progressFill)
      }

      // Progress text - terminal style
      const progressText = this.add.text(nameX + progressWidth + 10, progressY, `${achievement.progress || 0}/${achievement.target}`, {
        ...getTerminalStyle('xs'),
        color: toHexString(isLocked ? COLORS.text.muted : COLORS.text.secondary)
      }).setOrigin(0, 0.5)
      this.contentItems.push(progressText)
    }

    // Rewards section (right side) - Network theme
    const rewardX = width - 80

    // Cash reward
    if (achievement.cash_reward) {
      const cashText = this.add.text(rewardX, y + 25, formatMoney(achievement.cash_reward), {
        ...getTerminalStyle('sm'),
        color: toHexString(isLocked ? COLORS.text.muted : COLORS.text.gold)
      }).setOrigin(1, 0.5)
      this.contentItems.push(cashText)
    }

    // XP reward
    if (achievement.xp_reward) {
      const xpText = this.add.text(rewardX, y + 45, `+${achievement.xp_reward} XP`, {
        ...getTerminalStyle('xs'),
        color: toHexString(isLocked ? COLORS.text.muted : COLORS.status.info)
      }).setOrigin(1, 0.5)
      this.contentItems.push(xpText)
    }

    // CLAIM button for unclaimed achievements - Network theme
    if (isUnclaimed) {
      const claimBtn = this.add.rectangle(rewardX - 25, y + 72, 65, 26, COLORS.status.success, 0.95)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(BORDERS.thin, COLORS.status.success)
      this.contentItems.push(claimBtn)

      const claimText = this.add.text(rewardX - 25, y + 72, 'CLAIM', {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.bg.void),
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(claimText)

      claimBtn.on('pointerover', () => {
        claimBtn.setFillStyle(COLORS.network.dim, 0.95)
        claimBtn.setStrokeStyle(BORDERS.medium, COLORS.network.glow)
      })
      claimBtn.on('pointerout', () => {
        claimBtn.setFillStyle(COLORS.status.success, 0.95)
        claimBtn.setStrokeStyle(BORDERS.thin, COLORS.status.success)
      })
      claimBtn.on('pointerdown', () => this.claimAchievement(achievement))
    }

    // Make card interactive for details
    cardBg.setInteractive({ useHandCursor: true })
    cardBg.on('pointerdown', () => {
      if (!isLocked || !achievement.is_secret) {
        this.showAchievementDetails(achievement)
      }
    })
  }

  createBadge(x, y, text, color) {
    const badge = this.add.rectangle(x, y, 35, 16, color, 0.9)
    badge.setStrokeStyle(BORDERS.thin, color)
    this.contentItems.push(badge)

    const badgeText = this.add.text(x, y, text, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(badgeText)

    return { badge, text: badgeText }
  }

  async claimAchievement(achievement) {
    try {
      // Try backend claim first
      try {
        await gameManager.claimAchievement(achievement.id)
      } catch (e) {
        // Use local claim
        this.claimAchievementLocal(achievement)
      }

      // Update local state
      achievement.claimed = true

      // Update stats
      this.stats.claimed++

      // Play success sound
      audioManager.playSuccess()

      // Show success toast
      let rewardText = ''
      if (achievement.cash_reward) rewardText += `+${formatMoney(achievement.cash_reward)}`
      if (achievement.xp_reward) rewardText += ` +${achievement.xp_reward} XP`
      this.showToast(`🎉 Claimed! ${rewardText}`, 'success')

      // Re-render
      this.renderContent()
    } catch (error) {
      this.showToast('Failed to claim reward', 'danger')
    }
  }

  claimAchievementLocal(achievement) {
    const player = getPlayerData() || {}

    // Initialize if needed
    if (!player.achievements) {
      player.achievements = { unlocked: {}, claimed: {} }
    }

    // Mark as claimed
    player.achievements.claimed[achievement.id] = Date.now()

    // Apply cash reward
    if (achievement.cash_reward) {
      player.cash = (player.cash || 0) + achievement.cash_reward
      player.totalEarnings = (player.totalEarnings || 0) + achievement.cash_reward
    }

    // Apply XP reward
    if (achievement.xp_reward) {
      player.xp = (player.xp || 0) + achievement.xp_reward

      // Check for level up (simple formula: level = sqrt(xp / 100))
      const newLevel = Math.floor(Math.sqrt(player.xp / 100)) + 1
      if (newLevel > (player.level || 1)) {
        player.level = newLevel
        notificationManager.showToast(`🎊 Level Up! You are now level ${newLevel}`, 'success')
      }
    }

    savePlayerData(player)

    // Update gameManager if available
    if (gameManager.player) {
      gameManager.player = { ...gameManager.player, ...player }
    }
  }

  showAchievementDetails(achievement) {
    const { width, height } = this.cameras.main

    // Modal overlay - Network theme
    const modalBg = this.add.rectangle(width / 2, height / 2, width, height, COLORS.bg.void, 0.8)
      .setInteractive()
    this.contentItems.push(modalBg)

    // Modal container - Network theme
    const modalWidth = Math.min(350, width - 40)
    const modalHeight = 280
    const modalX = width / 2
    const modalY = height / 2

    const modal = this.add.rectangle(modalX, modalY, modalWidth, modalHeight, COLORS.bg.panel, 0.98)
    modal.setStrokeStyle(BORDERS.medium, this.CATEGORIES[achievement.category]?.color || COLORS.status.success)
    this.contentItems.push(modal)

    // Close button - Network theme
    const closeBtn = this.add.text(modalX + modalWidth / 2 - 20, modalY - modalHeight / 2 + 20, SYMBOLS.close, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on('pointerover', () => closeBtn.setColor(toHexString(COLORS.status.danger)))
    closeBtn.on('pointerout', () => closeBtn.setColor(toHexString(COLORS.text.secondary)))
    closeBtn.on('pointerdown', () => this.closeModal())
    this.contentItems.push(closeBtn)

    // Icon - Network theme
    const iconBg = this.add.rectangle(modalX, modalY - 80, 60, 60,
      this.CATEGORIES[achievement.category]?.color || COLORS.status.info, 0.9)
    iconBg.setStrokeStyle(BORDERS.thin, this.CATEGORIES[achievement.category]?.color || COLORS.status.info)
    this.contentItems.push(iconBg)

    const icon = this.add.text(modalX, modalY - 80, achievement.icon || '🏆', {
      fontSize: '36px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Name - Network terminal style
    const nameText = this.add.text(modalX, modalY - 30, achievement.name, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(nameText)

    // Category - Network terminal style
    const categoryText = this.add.text(modalX, modalY - 5, `${this.CATEGORIES[achievement.category]?.icon || ''} ${this.CATEGORIES[achievement.category]?.label || achievement.category}`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5)
    this.contentItems.push(categoryText)

    // Description - Network terminal style
    const descText = this.add.text(modalX, modalY + 30, achievement.description, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary),
      wordWrap: { width: modalWidth - 40 },
      align: 'center'
    }).setOrigin(0.5)
    this.contentItems.push(descText)

    // Rewards - Network terminal style
    const rewardY = modalY + 70
    const rewardText = this.add.text(modalX, rewardY, `${SYMBOLS.system} REWARDS`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    this.contentItems.push(rewardText)

    const rewardsLine = this.add.text(modalX, rewardY + 22,
      `${formatMoney(achievement.cash_reward)}  ${SYMBOLS.bullet}  +${achievement.xp_reward} XP`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.success),
        fontStyle: 'bold'
      }).setOrigin(0.5)
    this.contentItems.push(rewardsLine)

    // Status / Claim button - Network theme
    const buttonY = modalY + modalHeight / 2 - 35

    if (achievement.unlocked && !achievement.claimed) {
      const claimBtn = this.add.rectangle(modalX, buttonY, 120, 36, COLORS.status.success, 0.95)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(BORDERS.thin, COLORS.status.success)
      this.contentItems.push(claimBtn)

      const claimText = this.add.text(modalX, buttonY, 'CLAIM REWARD', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.bg.void),
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(claimText)

      claimBtn.on('pointerover', () => {
        claimBtn.setFillStyle(COLORS.network.dim, 0.95)
        claimBtn.setStrokeStyle(BORDERS.medium, COLORS.network.glow)
      })
      claimBtn.on('pointerout', () => {
        claimBtn.setFillStyle(COLORS.status.success, 0.95)
        claimBtn.setStrokeStyle(BORDERS.thin, COLORS.status.success)
      })
      claimBtn.on('pointerdown', async () => {
        await this.claimAchievement(achievement)
        this.closeModal()
      })
    } else if (achievement.claimed) {
      const claimedText = this.add.text(modalX, buttonY, `${SYMBOLS.check} CLAIMED`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)
      this.contentItems.push(claimedText)

      if (achievement.unlocked_at) {
        const dateText = this.add.text(modalX, buttonY + 20,
          `${SYMBOLS.system} Unlocked: ${new Date(achievement.unlocked_at).toLocaleDateString()}`, {
            ...getTerminalStyle('xs'),
            color: toHexString(COLORS.text.muted)
          }).setOrigin(0.5)
        this.contentItems.push(dateText)
      }
    } else {
      // Progress for locked - Network theme
      if (achievement.target && achievement.target > 1) {
        const percent = Math.floor(((achievement.progress || 0) / achievement.target) * 100)
        const progressText = this.add.text(modalX, buttonY,
          `${SYMBOLS.system} PROGRESS: ${achievement.progress || 0}/${achievement.target} (${percent}%)`, {
            ...getTerminalStyle('sm'),
            color: toHexString(COLORS.status.warning)
          }).setOrigin(0.5)
        this.contentItems.push(progressText)
      } else {
        const lockedText = this.add.text(modalX, buttonY, `${SYMBOLS.locked} LOCKED`, {
          ...getTerminalStyle('md'),
          color: toHexString(COLORS.text.muted)
        }).setOrigin(0.5)
        this.contentItems.push(lockedText)
      }
    }

    // Close on background tap
    modalBg.on('pointerdown', () => this.closeModal())

    this.modalOpen = true
  }

  closeModal() {
    this.modalOpen = false
    this.renderContent()
  }

  showToast(message, type = 'info') {
    const { width } = this.cameras.main

    const colors = {
      success: COLORS.status.success,
      danger: COLORS.status.danger,
      info: COLORS.status.info,
      warning: COLORS.status.warning
    }

    const toastBg = this.add.rectangle(width / 2, 150, 280, 45, colors[type], 0.95)
      .setDepth(1000)
      .setStrokeStyle(BORDERS.thin, colors[type])

    const toastText = this.add.text(width / 2, 150, message, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1001)

    // Animate in
    toastBg.setAlpha(0).setY(120)
    toastText.setAlpha(0).setY(120)

    this.tweens.add({
      targets: [toastBg, toastText],
      alpha: 1,
      y: 150,
      duration: 200,
      ease: 'Power2'
    })

    // Animate out
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [toastBg, toastText],
        alpha: 0,
        y: 120,
        duration: 300,
        onComplete: () => {
          toastBg.destroy()
          toastText.destroy()
        }
      })
    })
  }

  renderEmptyState() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 40, '[A]', {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 20, 'NO ACHIEVEMENTS', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.secondary),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 55, `${SYMBOLS.system} Start running ops to earn achievements!`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    this.contentItems.push(msgText)
  }

  renderError() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 30, SYMBOLS.alert, {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 20, 'FAILED TO LOAD', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 50, `${SYMBOLS.system} Please try again later`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5)
    this.contentItems.push(msgText)
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
