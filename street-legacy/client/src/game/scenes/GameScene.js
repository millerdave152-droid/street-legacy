import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { achievementPopup } from '../ui/AchievementPopup'
import { notificationManager } from '../managers/NotificationManager'
import { audioManager, AUDIO_KEYS } from '../managers/AudioManager'
import { tutorialManager } from '../managers/TutorialManager'
import { adminManager } from '../managers/AdminManager'
import { checkWorldEvents, getActiveEventEffects, initializePlayerState, decayDistrictHeat, savePlayerData, getNewAchievementsCount } from '../data/GameData.js'

// Network Theme imports
import {
  COLORS,
  BORDERS,
  DEPTH,
  LAYOUT,
  getTextStyle,
  getTerminalStyle,
  toHexString,
  SYMBOLS,
  createGlowBorder,
  createNetworkHeader,
  EFFECTS
} from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'
import { ModuleDrawer } from '../ui/ModuleDrawer'
import { TerminalWidget } from '../ui/TerminalWidget'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
  }

  async create() {
    console.log('[GameScene] create() started')

    // CRITICAL: Reset camera state to prevent colored screen from mini-games
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.tweens.timeScale = 1
      this.tweens.killTweensOf(this.cameras.main)
    } catch (e) {
      console.warn('[GameScene] Camera reset warning:', e)
    }

    const { width, height } = this.cameras.main
    const player = gameManager.player

    gameManager.setScene(this)

    // Initialize player state - check for expired parole/jail, update energy
    if (player) {
      const initResults = initializePlayerState(player)

      // Show any initialization messages after scene is ready
      if (initResults.messages && initResults.messages.length > 0) {
        this.time.delayedCall(500, () => {
          initResults.messages.forEach((msg, index) => {
            this.time.delayedCall(index * 2000, () => {
              notificationManager.showToast(msg, initResults.paroleExpired ? 'info' : 'success', 3000)
            })
          })
        })
      }
    }

    // Ensure input works - enable and bring to top
    this.input.setTopOnly(false)
    this.input.enabled = true
    console.log('[GameScene] Input enabled:', this.input.enabled)

    // Bring this scene to top of display list for input priority
    this.scene.bringToTop()

    // Background - Network dark screen (depth 0, NOT interactive)
    this.bg = this.add.rectangle(0, 0, width, height, COLORS.bg.screen).setOrigin(0).setDepth(0)

    // Add subtle scanline effect for that CRT terminal feel
    this.createScanlineEffect()

    // District name stored for reference but header removed to save vertical space
    // The district info is now available via MOVE button or can be shown elsewhere
    this.currentDistrict = 'Downtown Toronto'
    if (player?.current_district?.name) {
      this.currentDistrict = player.current_district.name
    } else if (gameManager.gameState?.currentDistrict?.name) {
      this.currentDistrict = gameManager.gameState.currentDistrict.name
    } else if (gameManager.gameState?.districts && gameManager.gameState.districts.length > 0) {
      this.currentDistrict = gameManager.gameState.districts[0].name
    }

    // Note: Property income panel and active effects indicators
    // have been moved to be overlaid/removed to maximize button grid space
    // These features are accessible via the Property and Events buttons

    // OS-style module grid with drawer navigation
    console.log('[GameScene] Creating module drawer and grid...')
    console.log('[GameScene] ModuleDrawer class:', ModuleDrawer)
    this.moduleDrawer = new ModuleDrawer(this)
    console.log('[GameScene] moduleDrawer instance:', this.moduleDrawer)
    console.log('[GameScene] moduleDrawer.open:', typeof this.moduleDrawer?.open)
    this.createModuleGrid()
    console.log('[GameScene] Module grid created, cards:', this.moduleCards?.length)

    // Lay Low button (shows when heat is elevated)
    this.createLayLowButton()

    // Listen for game events
    this.setupEventListeners()

    // Handle window resize
    this.scale.on('resize', this.handleResize, this)

    // Check for pending property income on scene enter
    this.checkPendingPropertyIncome()

    // Check for unclaimed achievements
    this.checkUnclaimedAchievements()

    // Initialize notification manager
    notificationManager.setScene(this)

    // Initialize audio manager and play game BGM
    audioManager.setScene(this)
    audioManager.playBGM(AUDIO_KEYS.BGM.GAME)

    // Check for active events and show badge
    this.checkActiveEvents()

    // Periodically check for new events
    this.startEventPolling()

    // Initialize tutorial system (will auto-start for new players)
    tutorialManager.initialize(this)

    // Create admin button if player is admin
    this.createAdminButton()

    // Launch UIScene as overlay on top of GameScene
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene')
    }

    // IMPORTANT: Re-enable input after UIScene launches to ensure GameScene receives clicks
    this.time.delayedCall(100, () => {
      this.input.enabled = true
      this.input.setTopOnly(false)
      console.log('[GameScene] Input re-enabled after UIScene launch')
    })

    // Re-enable input when scene resumes (after returning from hub scenes)
    this.events.on('resume', () => {
      console.log('[GameScene] Scene resumed - re-enabling input')

      // Force enable input
      this.input.enabled = true
      this.input.setTopOnly(false)

      // Ensure UIScene is running and not paused
      if (!this.scene.isActive('UIScene')) {
        console.log('[GameScene] UIScene not active, launching')
        this.scene.launch('UIScene')
      } else if (this.scene.isPaused('UIScene')) {
        console.log('[GameScene] UIScene was paused, resuming')
        this.scene.resume('UIScene')
      }

      // Double-check input after short delay (safety net)
      this.time.delayedCall(100, () => {
        if (!this.input.enabled) {
          console.warn('[GameScene] Input was disabled after resume, re-enabling')
          this.input.enabled = true
        }
      })
    })

    // DEBUG: Log all pointer events to verify input is working
    this.input.on('pointerdown', (pointer) => {
      console.log(`[GameScene] Global pointerdown at (${pointer.x.toFixed(0)}, ${pointer.y.toFixed(0)})`)
    })

    // Check for and display world events
    this.checkAndDisplayWorldEvents()

    // Periodically check for world events
    this.worldEventTimer = this.time.addEvent({
      delay: 60000, // Check every minute
      callback: () => this.checkAndDisplayWorldEvents(),
      loop: true
    })

    // Periodically decay district heat (every minute)
    this.districtHeatTimer = this.time.addEvent({
      delay: 60000, // Decay every minute
      callback: () => {
        const player = gameManager.player
        if (player) {
          decayDistrictHeat(player, 1) // 1 minute of decay
          savePlayerData(player)
        }
      },
      loop: true
    })

    console.log('[GameScene] create() completed successfully')
  }

  /**
   * Check for world events and display banner if active
   */
  checkAndDisplayWorldEvents() {
    const player = gameManager.player
    if (!player) return

    // Check/trigger world events
    const activeEvents = checkWorldEvents(player)

    // Update or create event banner
    this.updateEventBanner(activeEvents)
  }

  /**
   * Display active world events banner
   */
  updateEventBanner(activeEvents) {
    const { width } = this.cameras.main

    // Remove existing banner
    if (this.eventBanner) {
      this.eventBanner.destroy()
      this.eventBanner = null
    }
    if (this.eventBannerText) {
      this.eventBannerText.destroy()
      this.eventBannerText = null
    }

    if (!activeEvents || activeEvents.length === 0) return

    const now = Date.now()
    const validEvents = activeEvents.filter(e => now < e.expiresAt)
    if (validEvents.length === 0) return

    // Get first active event for display
    const event = validEvents[0]
    const remaining = Math.ceil((event.expiresAt - now) / 60000)

    // Create banner at top of screen
    const bannerY = 75
    this.eventBanner = this.add.rectangle(width / 2, bannerY, width - 20, 28, 0x8b5cf6, 0.9)
      .setStrokeStyle(1, 0xa78bfa, 0.8)
      .setDepth(DEPTH.PANELS)

    this.eventBannerText = this.add.text(width / 2, bannerY,
      `${event.icon} ${event.name.toUpperCase()}: ${event.description} (${remaining}m)`, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Pulse animation
    this.tweens.add({
      targets: this.eventBanner,
      alpha: { from: 0.9, to: 0.7 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    })
  }

  async createPropertyIncomePanel() {
    const { width } = this.cameras.main

    // Get property income data
    let totalHourlyIncome = 0
    let pendingIncome = 0

    try {
      const properties = await gameManager.getOwnedProperties().catch(() => gameManager.getMyProperties())
      if (properties && properties.length > 0) {
        totalHourlyIncome = properties.reduce((sum, p) => sum + (p.income_per_hour || 0), 0)

        // Calculate pending income
        properties.forEach(p => {
          if (p.last_collected && p.income_per_hour) {
            const lastCollected = new Date(p.last_collected)
            const now = new Date()
            const hoursSince = (now - lastCollected) / (1000 * 60 * 60)
            const cappedHours = Math.min(hoursSince, 24)
            pendingIncome += Math.floor(cappedHours * p.income_per_hour)
          }
        })

        this.pendingPropertyIncome = pendingIncome
      }
    } catch (error) {
      console.error('Failed to get property income:', error)
    }

    // Only show panel if player has property income
    if (totalHourlyIncome > 0) {
      // Stats panel background
      this.incomePanel = this.add.rectangle(width / 2, 125, 200, 30, 0x22c55e, 0.15)
      this.incomePanel.setStrokeStyle(1, 0x22c55e, 0.3)

      // Income text
      this.incomeText = this.add.text(width / 2, 125, `💰 ${formatMoney(totalHourlyIncome)}/hr`, {
        fontSize: '13px',
        color: '#22c55e'
      }).setOrigin(0.5)

      // If there's pending income, show indicator
      if (pendingIncome > 0) {
        this.pendingIndicator = this.add.circle(width / 2 + 95, 118, 6, 0xf59e0b)

        // Pulsing animation for pending indicator
        this.tweens.add({
          targets: this.pendingIndicator,
          alpha: { from: 1, to: 0.4 },
          scale: { from: 1, to: 1.3 },
          duration: 600,
          yoyo: true,
          repeat: -1
        })
      }
    }
  }

  async createActiveEffectsIndicator() {
    const { width } = this.cameras.main

    // Get active effects from events
    let activeEffects = []

    try {
      const events = await gameManager.getActiveEvents().catch(() => [])

      if (events && events.length > 0) {
        events.forEach(event => {
          if (event.effect_type && event.effect_value) {
            activeEffects.push({
              type: event.effect_type,
              value: event.effect_value,
              name: event.title || event.type,
              icon: this.getEffectIcon(event.effect_type),
              color: event.effect_value >= 0 ? 0x22c55e : 0xef4444
            })
          }
        })
      }

      // Store effects for use in CrimeScene
      gameManager.activeEffects = activeEffects
    } catch (error) {
      console.error('Failed to get active effects:', error)
    }

    // Only show if there are active effects
    if (activeEffects.length === 0) return

    // Effects row position (below income panel or subtitle)
    const effectsY = this.incomePanel ? 155 : 125

    // Create effects container
    this.effectsContainer = this.add.container(width / 2, effectsY)

    // Background
    const bgWidth = Math.min(activeEffects.length * 70 + 20, width - 40)
    const effectsBg = this.add.rectangle(0, 0, bgWidth, 28, 0x1a1a2e, 0.9)
    effectsBg.setStrokeStyle(1, 0x8b5cf6, 0.5)
    effectsBg.setInteractive({ useHandCursor: true })
    this.effectsContainer.add(effectsBg)

    // Effect chips
    const startX = -bgWidth / 2 + 35
    activeEffects.slice(0, 4).forEach((effect, index) => {
      const x = startX + index * 65

      // Effect chip
      const chipBg = this.add.rectangle(x, 0, 58, 22, effect.color, 0.2)
      chipBg.setStrokeStyle(1, effect.color, 0.4)

      // Icon + value text
      const valueText = effect.value > 0 ? `+${effect.value}` : effect.value
      const label = `${effect.icon}${valueText}${effect.type === 'bonus' ? 'x' : '%'}`
      const chipText = this.add.text(x, 0, label, {
        fontSize: '11px',
        color: `#${effect.color.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold'
      }).setOrigin(0.5)

      this.effectsContainer.add([chipBg, chipText])
    })

    // "More" indicator if there are more than 4 effects
    if (activeEffects.length > 4) {
      const moreText = this.add.text(bgWidth / 2 - 20, 0, `+${activeEffects.length - 4}`, {
        fontSize: '10px',
        color: '#888888'
      }).setOrigin(0.5)
      this.effectsContainer.add(moreText)
    }

    // Make tappable to show full effects list
    effectsBg.on('pointerdown', () => this.showEffectsModal(activeEffects))

    // Store for resize handling
    this.activeEffects = activeEffects
  }

  getEffectIcon(effectType) {
    const icons = {
      cash: '💰',
      xp: '⚡',
      heat: '🔥',
      bonus: '📈',
      success: '🎯',
      cooldown: '⏱',
      respect: '⭐',
      energy: '💪'
    }
    return icons[effectType] || '✨'
  }

  showEffectsModal(effects) {
    const { width, height } = this.cameras.main

    // Modal container
    const modal = this.add.container(width / 2, height / 2)
    modal.setDepth(DEPTH.MODAL)

    // Dark overlay
    const overlay = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8)
    overlay.setInteractive()
    overlay.on('pointerdown', () => modal.destroy())
    modal.add(overlay)

    // Modal background
    const modalHeight = Math.min(80 + effects.length * 50, height - 100)
    const modalBg = this.add.rectangle(0, 0, 300, modalHeight, 0x1a1a2e, 0.98)
    modalBg.setStrokeStyle(2, 0x8b5cf6)
    modal.add(modalBg)

    // Title
    const title = this.add.text(0, -modalHeight / 2 + 30, '⚡ ACTIVE EFFECTS', {
      fontSize: '18px',
      color: '#8b5cf6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    modal.add(title)

    // Effects list
    effects.forEach((effect, index) => {
      const y = -modalHeight / 2 + 70 + index * 45

      // Effect icon
      const icon = this.add.text(-120, y, effect.icon, {
        fontSize: '24px'
      }).setOrigin(0.5)

      // Effect name
      const name = this.add.text(-80, y - 8, effect.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5)

      // Effect value
      const valueStr = effect.value > 0 ? `+${effect.value}` : effect.value
      const valueLabel = effect.type === 'bonus' ? `${valueStr}x multiplier` :
        effect.type === 'cash' ? `${valueStr}% cash` :
          effect.type === 'xp' ? `${valueStr}% XP` :
            effect.type === 'heat' ? `${valueStr}% heat` :
              effect.type === 'success' ? `${valueStr}% success rate` :
                `${valueStr}%`

      const value = this.add.text(-80, y + 10, valueLabel, {
        fontSize: '11px',
        color: effect.value >= 0 ? '#22c55e' : '#ef4444'
      }).setOrigin(0, 0.5)

      modal.add([icon, name, value])
    })

    // Close button
    const closeBtn = this.add.text(130, -modalHeight / 2 + 15, '✕', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => closeBtn.setColor('#ef4444'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'))
    closeBtn.on('pointerdown', () => modal.destroy())
    modal.add(closeBtn)

    // Animate in
    modal.setScale(0.8)
    modal.setAlpha(0)
    this.tweens.add({
      targets: modal,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.out'
    })
  }

  async checkPendingPropertyIncome() {
    // Only show notification if there's significant pending income
    if (this.pendingPropertyIncome && this.pendingPropertyIncome >= 100) {
      this.time.delayedCall(500, () => {
        this.showPropertyIncomeNotification(this.pendingPropertyIncome)
      })
    }
  }

  async checkUnclaimedAchievements() {
    try {
      // Get achievement data
      const result = await gameManager.getAchievements().catch(() => null)
      if (!result || !result.achievements) return

      // Count unclaimed achievements
      const unclaimedCount = result.achievements.filter(a => a.unlocked && !a.claimed).length

      if (unclaimedCount > 0) {
        this.showAchievementBadge(unclaimedCount)
      }
    } catch (error) {
      console.error('Failed to check achievements:', error)
    }
  }

  showAchievementBadge(count) {
    // Find the achievements button
    const achievementButton = this.actionButtons.find(btn => {
      const action = btn.getData('action')
      return action && action.key === 'achievements'
    })

    if (!achievementButton) return

    // Remove existing badge if any
    const existingBadge = achievementButton.getData('badge')
    if (existingBadge) {
      existingBadge.destroy()
    }
    const existingBadgeText = achievementButton.getData('badgeText')
    if (existingBadgeText) {
      existingBadgeText.destroy()
    }

    // Create badge
    const badge = this.add.circle(50, -35, 12, 0xef4444)
    const badgeText = this.add.text(50, -35, count > 9 ? '9+' : count.toString(), {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    achievementButton.add([badge, badgeText])
    achievementButton.setData('badge', badge)
    achievementButton.setData('badgeText', badgeText)

    // Pulsing animation
    this.tweens.add({
      targets: badge,
      scale: { from: 1, to: 1.2 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  showPropertyIncomeNotification(amount) {
    const { width } = this.cameras.main

    // Notification background
    const notifBg = this.add.rectangle(width / 2, 160, 260, 45, 0xf59e0b, 0.95)
      .setDepth(DEPTH.NOTIFICATIONS)

    // Notification text
    const notifText = this.add.text(width / 2, 153, `💰 ${formatMoney(amount)} pending!`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.NOTIFICATIONS)

    const subText = this.add.text(width / 2, 170, 'Tap Properties to collect', {
      fontSize: '11px',
      color: '#fffde7'
    }).setOrigin(0.5).setDepth(DEPTH.NOTIFICATIONS)

    // Make it interactive
    notifBg.setInteractive({ useHandCursor: true })
    notifBg.on('pointerdown', () => {
      notifBg.destroy()
      notifText.destroy()
      subText.destroy()
      this.openScene('PropertyScene')
    })

    // Animate in
    notifBg.setAlpha(0).setY(130)
    notifText.setAlpha(0).setY(123)
    subText.setAlpha(0).setY(140)

    this.tweens.add({
      targets: [notifBg, notifText, subText],
      alpha: 1,
      y: '+=30',
      duration: 300,
      ease: 'Back.out'
    })

    // Auto-dismiss after 5 seconds
    this.time.delayedCall(5000, () => {
      if (notifBg.active) {
        this.tweens.add({
          targets: [notifBg, notifText, subText],
          alpha: 0,
          y: '-=20',
          duration: 300,
          onComplete: () => {
            notifBg.destroy()
            notifText.destroy()
            subText.destroy()
          }
        })
      }
    })
  }

  // ==========================================================================
  // OS-STYLE MODULE GRID (Futuristic Dashboard)
  // ==========================================================================

  /**
   * Create the 2x2 module grid + terminal status widget
   * Inspired by Blade Runner, Cyberpunk 2077, Watch Dogs
   */
  createModuleGrid() {
    const { width, height } = this.cameras.main

    // Layout constants
    const topOffset = 68    // Below UIScene header
    const bottomOffset = 55 // Above UIScene bottom bar
    const sidePadding = 12
    const moduleSpacing = 10

    // Module card dimensions (2x2 grid, ~100px each)
    const moduleWidth = Math.floor((width - sidePadding * 2 - moduleSpacing) / 2)
    const moduleHeight = 95

    // 4 System Modules configuration
    this.moduleConfigs = [
      {
        key: 'operations',
        name: 'OPS',
        fullName: 'OPERATIONS',
        icon: '[!]',
        color: 0xFF4444,  // Red/Orange - danger
        stat: this.getOpsCount(),
        options: [
          { key: 'crime', label: 'CRIME', icon: '[!]', color: COLORS.status.danger, scene: 'CrimeScene', stat: '47 available' },
          { key: 'jobs', label: 'JOBS', icon: '[W]', color: COLORS.network.primary, scene: 'JobScene', stat: '23 available' },
          { key: 'heists', label: 'HEISTS', icon: '[H]', color: COLORS.status.warning, scene: 'HeistsScene', stat: '3 active' }
        ]
      },
      {
        key: 'commerce',
        name: 'TRADE',
        fullName: 'COMMERCE',
        icon: '[$]',
        color: 0x00FF88,  // Green - money
        stat: this.getCommerceStats(),
        options: [
          { key: 'trading', label: 'TRADE', icon: '[$]', color: COLORS.status.info, scene: 'TradingScene', stat: 'Black market' },
          { key: 'property', label: 'PROPS', icon: '[P]', color: 0x7c3aed, scene: 'PropertyScene', stat: this.getPropertyCount() },
          { key: 'bank', label: 'BANK', icon: '[B]', color: 0x0d9488, scene: 'BankScene', stat: 'Accounts' }
        ]
      },
      {
        key: 'network',
        name: 'NETWORK',
        fullName: 'CONNECTIONS',
        icon: '[@]',
        color: 0x4488FF,  // Blue - social
        stat: this.getNetworkStats(),
        options: [
          { key: 'crew', label: 'CREW', icon: '[C]', color: 0x2563eb, scene: 'CrewScene', stat: 'Team' },
          { key: 'travel', label: 'MOVE', icon: '[M]', color: 0x4f46e5, scene: 'TravelScene', stat: this.currentDistrict },
          { key: 'inventory', label: 'ITEMS', icon: '[I]', color: 0xea580c, scene: 'InventoryScene', stat: 'Equipment' }
        ]
      },
      {
        key: 'system',
        name: 'SYSTEM',
        fullName: 'STATUS',
        icon: '[i]',
        color: 0xAA44FF,  // Purple - info
        stat: this.getSystemStats(),
        options: [
          { key: 'reputation', label: 'REP', icon: '[R]', color: COLORS.cred.gold, scene: 'ReputationScene', stat: 'Standing' },
          { key: 'achievements', label: 'STATS', icon: '[A]', color: 0x06b6d4, scene: 'AchievementsScene', stat: 'Progress' },
          { key: 'events', label: 'NEWS', icon: '[E]', color: COLORS.status.danger, scene: 'EventsScene', stat: 'Updates' }
        ]
      }
    ]

    this.moduleCards = []
    this.actionButtons = [] // Keep for compatibility

    // Create 2x2 grid of modules
    const gridStartY = topOffset + 5
    this.moduleConfigs.forEach((config, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = sidePadding + moduleWidth / 2 + col * (moduleWidth + moduleSpacing)
      const y = gridStartY + moduleHeight / 2 + row * (moduleHeight + moduleSpacing)

      const card = this.createModuleCard(x, y, moduleWidth, moduleHeight, config)
      this.moduleCards.push(card)
      this.actionButtons.push(card)
    })

    // Calculate position for terminal widget
    const gridEndY = gridStartY + moduleHeight * 2 + moduleSpacing + 15

    // Create terminal status widget
    this.createTerminalWidget(gridEndY, bottomOffset)
  }

  /**
   * Create a single module card (OS-style)
   * Uses container-level interactivity for reliable input handling
   */
  createModuleCard(x, y, cardWidth, cardHeight, config) {
    console.log(`[GameScene] Creating module card: ${config.name} at (${x}, ${y})`)
    const container = this.add.container(x, y)

    // Set depth above background and scanlines
    container.setDepth(DEPTH.CARDS)

    // Glow background (pulsing)
    const glowBg = this.add.rectangle(0, 0, cardWidth + 4, cardHeight + 4, config.color, 0.12)
    this.tweens.add({
      targets: glowBg,
      alpha: { from: 0.12, to: 0.22 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Main card background
    const cardBg = this.add.rectangle(0, 0, cardWidth, cardHeight, COLORS.bg.panel, 0.9)
    cardBg.setStrokeStyle(BORDERS.medium, config.color, 0.6)

    // Module icon (large, centered-left)
    const icon = this.add.text(-cardWidth / 2 + 20, -cardHeight / 4, config.icon, {
      ...getTerminalStyle('lg'),
      color: toHexString(config.color)
    }).setOrigin(0, 0.5)

    // Module name (bold, next to icon)
    const nameText = this.add.text(-cardWidth / 2 + 55, -cardHeight / 4, config.name, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '16px',
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)

    // Stat line (below name)
    const stat = this.add.text(-cardWidth / 2 + 20, cardHeight / 6, config.stat, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px',
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0, 0.5)

    // Arrow indicator (right side)
    const arrow = this.add.text(cardWidth / 2 - 15, 0, '>', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '20px',
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    container.add([glowBg, cardBg, icon, nameText, stat, arrow])

    // Set container size for proper hit area
    container.setSize(cardWidth, cardHeight)

    // Make the CONTAINER interactive (more reliable than child elements)
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    })

    container.on('pointerover', () => {
      cardBg.setFillStyle(COLORS.bg.elevated, 1)
      cardBg.setStrokeStyle(BORDERS.thick, config.color, 0.9)
      icon.setColor(toHexString(COLORS.network.glow))
      arrow.setColor(toHexString(config.color))
      audioManager.playHover()
      this.tweens.add({
        targets: container,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: 'Back.out'
      })
    })

    container.on('pointerout', () => {
      cardBg.setFillStyle(COLORS.bg.panel, 0.9)
      cardBg.setStrokeStyle(BORDERS.medium, config.color, 0.6)
      icon.setColor(toHexString(config.color))
      arrow.setColor(toHexString(COLORS.text.muted))
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100
      })
    })

    container.on('pointerdown', () => {
      console.log(`[GameScene] Module card clicked: ${config.name}`)
      audioManager.playClick()
      this.tweens.add({
        targets: container,
        scaleX: 0.97,
        scaleY: 0.97,
        duration: 50,
        yoyo: true,
        onComplete: () => this.openModuleDrawer(config)
      })
    })

    console.log(`[GameScene] Module card ${config.name} interactive:`, container.input?.enabled)
    container.setData('config', config)
    container.setData('bg', cardBg)
    return container
  }

  /**
   * Open the slide drawer for a module
   * TEMPORARY: Navigate directly to hub scenes instead of using drawer
   */
  openModuleDrawer(moduleConfig) {
    console.log('[GameScene] openModuleDrawer called for:', moduleConfig.key)

    // Navigate directly to the appropriate hub scene
    const hubSceneMap = {
      'operations': 'OperationsHubScene',
      'commerce': 'CommerceHubScene',
      'network': 'ConnectionsHubScene',
      'system': 'SystemHubScene'
    }
    const hubScene = hubSceneMap[moduleConfig.key]
    if (hubScene) {
      console.log('[GameScene] Navigating to hub scene:', hubScene)
      // CRITICAL: Disable OUR input before launching hub to prevent input conflicts
      this.input.enabled = false
      console.log('[GameScene] Input disabled before hub transition')
      networkTransition.playTransition(this, hubScene, { duration: 400 })
    }
  }

  /**
   * Called when drawer opens - dim the dashboard
   */
  onDrawerOpen() {
    this.moduleCards.forEach(card => {
      this.tweens.add({
        targets: card,
        alpha: 0.4,
        duration: 150
      })
    })
    if (this.terminalWidget) {
      this.tweens.add({
        targets: this.terminalWidget,
        alpha: 0.4,
        duration: 150
      })
    }
  }

  /**
   * Called when drawer closes - restore dashboard
   */
  onDrawerClose() {
    this.moduleCards.forEach(card => {
      this.tweens.add({
        targets: card,
        alpha: 1,
        duration: 150
      })
    })
    if (this.terminalWidget) {
      this.tweens.add({
        targets: this.terminalWidget,
        alpha: 1,
        duration: 150
      })
    }
  }

  /**
   * Create interactive terminal widget - THE CONSOLE
   */
  createTerminalWidget(startY, bottomOffset) {
    const { width, height } = this.cameras.main
    const widgetHeight = height - startY - bottomOffset - 40 // Leave room for mobile bar
    const widgetWidth = width - 24

    // Only show if we have enough space
    if (widgetHeight < 120) return

    // Create the interactive terminal widget
    this.terminalWidget = new TerminalWidget(this, {
      x: 12,
      y: startY,
      width: widgetWidth,
      height: widgetHeight,
      depth: DEPTH.CARDS
    }).create()

    console.log('[GameScene] Interactive terminal created')
  }

  /**
   * Render a text-based progress bar
   */
  renderBar(value, max) {
    const filled = Math.round((value / max) * 8)
    const empty = 8 - filled
    return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
  }

  // ==========================================================================
  // STATS HELPERS
  // ==========================================================================

  getOpsCount() {
    // Could calculate actual available jobs/crimes
    return '73 available'
  }

  getCommerceStats() {
    const player = gameManager.player || {}
    return `$${formatMoney(player.cash || 0)}`
  }

  getPropertyCount() {
    return 'Properties'
  }

  getNetworkStats() {
    return '4 online'
  }

  getSystemStats() {
    const player = gameManager.player || {}
    const newCount = getNewAchievementsCount(player)
    if (newCount > 0) {
      return `${newCount} new`
    }
    return `Lv ${player.level || 1}`
  }

  getHourlyIncome() {
    // Could calculate from properties
    return 350
  }

  /**
   * Create a hero action button (compact, prominent)
   */
  createHeroButton(x, y, width, height, action) {
    const container = this.add.container(x, y)
    const baseColor = action.color

    // Glow background
    const glowBg = this.add.rectangle(0, 0, width + 4, height + 4, baseColor, 0.15)
    glowBg.setStrokeStyle(0)

    // Slow pulse animation
    this.tweens.add({
      targets: glowBg,
      alpha: { from: 0.15, to: 0.28 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Main button background
    const bgOuter = this.add.rectangle(0, 0, width, height, COLORS.bg.panel, 0.95)
    bgOuter.setStrokeStyle(BORDERS.medium, baseColor, 0.9)

    // Icon - adjusted positioning for compact height (-8% instead of -12%)
    const icon = this.add.text(0, -height * 0.08, action.icon, {
      ...getTerminalStyle('md'),  // Slightly smaller icon
      color: toHexString(baseColor)
    }).setOrigin(0.5)

    // Label - adjusted positioning (+18% instead of +22%)
    const label = this.add.text(0, height * 0.18, action.label, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '12px',  // Slightly smaller for compact look
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    container.add([glowBg, bgOuter, icon, label])

    // Interactive
    bgOuter.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bgOuter.setFillStyle(COLORS.bg.elevated, 1)
        bgOuter.setStrokeStyle(BORDERS.thick, baseColor, 1)
        icon.setColor(toHexString(COLORS.network.glow))
        audioManager.playHover()
        this.tweens.add({
          targets: container,
          scaleX: 1.03,
          scaleY: 1.03,
          duration: 100,
          ease: 'Back.out'
        })
        this.tweens.add({
          targets: glowBg,
          alpha: 0.45,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 100
        })
      })
      .on('pointerout', () => {
        bgOuter.setFillStyle(COLORS.bg.panel, 0.95)
        bgOuter.setStrokeStyle(BORDERS.medium, baseColor, 0.9)
        icon.setColor(toHexString(baseColor))
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        })
        this.tweens.add({
          targets: glowBg,
          alpha: 0.2,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        })
      })
      .on('pointerdown', () => {
        audioManager.playClick()
        this.tweens.add({
          targets: container,
          scaleX: 0.97,
          scaleY: 0.97,
          duration: 50,
          yoyo: true,
          onComplete: () => this.openScene(action.scene)
        })
      })

    container.setData('action', action)
    container.setData('tutorialId', `${action.key}Button`)
    container.setData('bg', bgOuter)

    return container
  }

  /**
   * Create a secondary grid button (compact, optimal touch target)
   */
  createGridButton(x, y, width, height, action) {
    const container = this.add.container(x, y)
    const baseColor = action.color

    // Subtle glow
    const glowBg = this.add.rectangle(0, 0, width + 2, height + 2, baseColor, 0.08)
    glowBg.setStrokeStyle(0)

    // Button background
    const bgOuter = this.add.rectangle(0, 0, width, height, COLORS.bg.card, 0.9)
    bgOuter.setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.5)

    // Icon - centered for compact layout (horizontal arrangement)
    const icon = this.add.text(-width * 0.2, 0, action.icon, {
      ...getTerminalStyle('xs'),  // Smaller icon for compact buttons
      color: toHexString(baseColor)
    }).setOrigin(0.5)

    // Label - next to icon for horizontal arrangement
    const label = this.add.text(width * 0.08, 0, action.label, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '10px',
      color: toHexString(COLORS.text.secondary),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    container.add([glowBg, bgOuter, icon, label])

    // Interactive
    bgOuter.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bgOuter.setFillStyle(COLORS.bg.elevated, 1)
        bgOuter.setStrokeStyle(BORDERS.thin, baseColor, 0.8)
        icon.setColor(toHexString(COLORS.network.glow))
        label.setColor(toHexString(COLORS.text.primary))
        audioManager.playHover()
        this.tweens.add({
          targets: container,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 80
        })
        this.tweens.add({
          targets: glowBg,
          alpha: 0.25,
          duration: 80
        })
      })
      .on('pointerout', () => {
        bgOuter.setFillStyle(COLORS.bg.card, 0.9)
        bgOuter.setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.5)
        icon.setColor(toHexString(baseColor))
        label.setColor(toHexString(COLORS.text.secondary))
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 80
        })
        this.tweens.add({
          targets: glowBg,
          alpha: 0.1,
          duration: 80
        })
      })
      .on('pointerdown', () => {
        audioManager.playClick()
        this.tweens.add({
          targets: container,
          scaleX: 0.96,
          scaleY: 0.96,
          duration: 40,
          yoyo: true,
          onComplete: () => this.openScene(action.scene)
        })
      })

    container.setData('action', action)
    container.setData('tutorialId', `${action.key}Button`)
    container.setData('bg', bgOuter)

    return container
  }

  createActionButton(x, y, width, height, action, row) {
    const container = this.add.container(x, y)

    // Determine if this is a primary action (first row gets special treatment)
    const isPrimary = row === 0

    // Network style - darker backgrounds with colored borders
    const baseColor = action.color
    const bgColor = isPrimary ? COLORS.bg.panel : COLORS.bg.card

    // Create subtle glow effect behind button (pulsing)
    const glowBg = this.add.rectangle(0, 0, width + 4, height + 4, baseColor, isPrimary ? 0.15 : 0.08)
    glowBg.setStrokeStyle(0)

    // Add slow pulse to the glow
    this.tweens.add({
      targets: glowBg,
      alpha: { from: isPrimary ? 0.15 : 0.08, to: isPrimary ? 0.25 : 0.12 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Button background - Network style (dark with accent border)
    const bgOuter = this.add.rectangle(0, 0, width, height, bgColor, isPrimary ? 0.95 : 0.85)

    // Accent border - colored for primary, dim for secondary
    if (isPrimary) {
      bgOuter.setStrokeStyle(BORDERS.medium, baseColor, 0.8)
    } else {
      bgOuter.setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.4)
    }

    // Terminal-style icon at top
    const iconSize = Math.min(14, height * 0.2)
    const icon = this.add.text(0, -height * 0.15, action.icon, {
      ...getTerminalStyle('sm'),
      color: toHexString(baseColor)
    }).setOrigin(0.5)

    // Label - Network terminal style
    const labelSize = Math.min(11, height * 0.15)
    const label = this.add.text(0, height * 0.2, action.label, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: `${labelSize}px`,
      color: toHexString(COLORS.text.secondary),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    container.add([glowBg, bgOuter, icon, label])

    // Interactive setup - Network style hover effects
    bgOuter.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bgOuter.setFillStyle(COLORS.bg.elevated, 1)
        bgOuter.setStrokeStyle(BORDERS.medium, baseColor, 1)
        icon.setColor(toHexString(COLORS.network.glow))
        label.setColor(toHexString(COLORS.text.primary))
        audioManager.playHover()

        // Intensify the glow on hover
        this.tweens.add({
          targets: glowBg,
          alpha: isPrimary ? 0.4 : 0.25,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 150,
          ease: 'Power2'
        })

        this.tweens.add({
          targets: container,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 80,
          ease: 'Back.out'
        })
      })
      .on('pointerout', () => {
        bgOuter.setFillStyle(bgColor, isPrimary ? 0.95 : 0.85)
        bgOuter.setStrokeStyle(isPrimary ? BORDERS.medium : BORDERS.thin, isPrimary ? baseColor : COLORS.network.dim, isPrimary ? 0.8 : 0.4)
        icon.setColor(toHexString(baseColor))
        label.setColor(toHexString(COLORS.text.secondary))

        // Reset glow to pulsing state
        this.tweens.add({
          targets: glowBg,
          alpha: isPrimary ? 0.15 : 0.08,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: 'Power2'
        })

        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 80
        })
      })
      .on('pointerdown', () => {
        audioManager.playClick()

        // Quick press effect - Network glitch style
        this.tweens.add({
          targets: container,
          scaleX: 0.96,
          scaleY: 0.96,
          duration: 40,
          yoyo: true,
          onComplete: () => this.openScene(action.scene)
        })
      })

    // Store reference for badge updates and tutorial highlighting
    container.setData('action', action)
    container.setData('tutorialId', `${action.key}Button`)
    container.setData('bg', bgOuter)

    return container
  }

  openScene(sceneName) {
    // Play click sound if available
    if (this.sound.get('click')) {
      this.sound.play('click')
    }

    // Use network transition effect for immersive scene change
    networkTransition.playTransition(this, sceneName, { duration: 600 })
  }

  /**
   * Create floating Lay Low button (shows when heat >= 25%)
   */
  createLayLowButton() {
    const { width, height } = this.cameras.main
    const player = gameManager.player

    // Container for the lay low button
    this.layLowContainer = this.add.container(width - 55, 100)
    this.layLowContainer.setDepth(DEPTH.BUTTONS)

    // Check if player heat is high enough to show button
    const heat = player?.heat || 0
    const shouldShow = heat >= 25 && !gameManager.isLayingLow()

    // Button background - Network style
    const btnBg = this.add.rectangle(0, 0, 90, 36, COLORS.bg.panel, 0.95)
    btnBg.setStrokeStyle(BORDERS.thin, COLORS.status.info, 0.8)

    // Icon - Network terminal style
    const icon = this.add.text(-30, 0, '[L]', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.status.info)
    }).setOrigin(0.5)

    // Label - Network style
    const label = this.add.text(10, 0, 'HIDE', {
      ...getTextStyle('xs', COLORS.text.secondary, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.layLowContainer.add([btnBg, icon, label])

    // Interactive - Network style
    btnBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        btnBg.setFillStyle(COLORS.bg.elevated)
        btnBg.setStrokeStyle(BORDERS.thin, COLORS.status.info, 1)
        icon.setColor(toHexString(COLORS.network.glow))
        label.setColor(toHexString(COLORS.text.primary))
        this.tweens.add({
          targets: this.layLowContainer,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100
        })
      })
      .on('pointerout', () => {
        btnBg.setFillStyle(COLORS.bg.panel, 0.95)
        btnBg.setStrokeStyle(BORDERS.thin, COLORS.status.info, 0.8)
        icon.setColor(toHexString(COLORS.status.info))
        label.setColor(toHexString(COLORS.text.secondary))
        this.tweens.add({
          targets: this.layLowContainer,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        })
      })
      .on('pointerdown', () => {
        audioManager.playClick()
        this.showLayLowModal()
      })

    // Show/hide based on heat
    this.layLowContainer.setVisible(shouldShow)

    // Store references
    this.layLowBtnBg = btnBg
    this.layLowLabel = label
    this.layLowIcon = icon
  }

  /**
   * Show the Lay Low options modal
   */
  showLayLowModal() {
    const { width, height } = this.cameras.main
    const options = gameManager.getLayLowOptions()
    const player = gameManager.player

    // Check if already laying low
    if (gameManager.isLayingLow()) {
      notificationManager.showToast('Already laying low!', 'warning')
      return
    }

    // Dark overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setDepth(DEPTH.MODAL_BACKDROP)
      .setInteractive()

    // Modal background
    const modalWidth = 320
    const modalHeight = 380
    const modal = this.add.rectangle(width / 2, height / 2, modalWidth, modalHeight, 0x1a1a2e, 0.98)
      .setDepth(DEPTH.MODAL)
      .setStrokeStyle(2, 0x4b5563)

    // Title
    const title = this.add.text(width / 2, height / 2 - 150, '🏠 Lay Low', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Subtitle
    const subtitle = this.add.text(width / 2, height / 2 - 120, 'Reduce your heat by hiding out', {
      fontSize: '12px',
      color: '#9ca3af'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Close button
    const closeBtn = this.add.text(width / 2 + 140, height / 2 - 160, '✕', {
      fontSize: '24px',
      color: '#6b7280'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT).setInteractive({ useHandCursor: true })
      .on('pointerover', () => closeBtn.setColor('#ffffff'))
      .on('pointerout', () => closeBtn.setColor('#6b7280'))
      .on('pointerdown', () => {
        audioManager.playClick()
        this.closeLayLowModal()
      })

    // Option buttons
    const optionKeys = ['quick', 'safe', 'leave']
    const optionY = height / 2 - 60

    this.layLowModalElements = [overlay, modal, title, subtitle, closeBtn]

    optionKeys.forEach((key, index) => {
      const opt = options[key]
      const y = optionY + index * 90

      // Option container
      const optBg = this.add.rectangle(width / 2, y, modalWidth - 40, 75, 0x2a2a4a, 0.9)
        .setDepth(DEPTH.MODAL_CONTENT)
        .setStrokeStyle(1, 0x4b5563)

      // Check if affordable
      const canAffordCash = (player?.cash || 0) >= opt.cashCost
      const canAffordEnergy = (player?.energy || 0) >= opt.energyCost
      const canAfford = canAffordCash && canAffordEnergy

      // Icon and name
      const optIcon = this.add.text(width / 2 - 120, y - 18, opt.icon, {
        fontSize: '24px'
      }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

      const optName = this.add.text(width / 2 - 85, y - 18, opt.name, {
        fontSize: '14px',
        color: canAfford ? '#ffffff' : '#6b7280',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

      // Description
      const optDesc = this.add.text(width / 2 - 120, y + 5, opt.description, {
        fontSize: '10px',
        color: '#9ca3af'
      }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

      // Cost and benefit
      const durationMin = Math.floor(opt.duration / 60000)
      let costText = `-${opt.heatReduction} Heat | ${durationMin} min`
      if (opt.cashCost > 0) costText += ` | $${opt.cashCost}`
      if (opt.energyCost > 0) costText += ` | ${opt.energyCost} Energy`

      const optCost = this.add.text(width / 2 - 120, y + 25, costText, {
        fontSize: '10px',
        color: canAfford ? '#22c55e' : '#ef4444'
      }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

      this.layLowModalElements.push(optBg, optIcon, optName, optDesc, optCost)

      if (canAfford) {
        optBg.setInteractive({ useHandCursor: true })
          .on('pointerover', () => {
            optBg.setFillStyle(0x3b3b5a)
            optBg.setStrokeStyle(2, 0x3b82f6)
          })
          .on('pointerout', () => {
            optBg.setFillStyle(0x2a2a4a, 0.9)
            optBg.setStrokeStyle(1, 0x4b5563)
          })
          .on('pointerdown', () => {
            audioManager.playClick()
            this.startLayLow(key)
          })
      }
    })

    // Store overlay for closing
    this.layLowOverlay = overlay
  }

  /**
   * Close the Lay Low modal
   */
  closeLayLowModal() {
    if (this.layLowModalElements) {
      this.layLowModalElements.forEach(el => el.destroy())
      this.layLowModalElements = null
    }
    this.layLowOverlay = null
  }

  /**
   * Start laying low with selected option
   */
  startLayLow(type) {
    const result = gameManager.startLayLow(type)

    if (result.success) {
      this.closeLayLowModal()
      this.updateLayLowButton()

      // Show countdown status
      this.showLayLowStatus()
    } else {
      notificationManager.showToast(result.message, 'error')
    }
  }

  /**
   * Update Lay Low button visibility based on heat and status
   */
  updateLayLowButton() {
    if (!this.layLowContainer) return

    const player = gameManager.player
    const heat = player?.heat || 0
    const isLayingLow = gameManager.isLayingLow()

    if (isLayingLow) {
      // Show "Laying Low..." status instead of button - Network style
      this.layLowContainer.setVisible(true)
      if (this.layLowLabel) {
        const remaining = gameManager.getLayLowRemaining()
        const seconds = Math.ceil(remaining / 1000)
        const minutes = Math.floor(seconds / 60)
        const secs = seconds % 60
        this.layLowLabel.setText(`${minutes}:${secs.toString().padStart(2, '0')}`)
      }
      if (this.layLowIcon) this.layLowIcon.setText('[~]')
      if (this.layLowBtnBg) {
        this.layLowBtnBg.setFillStyle(COLORS.bg.panel, 0.9)
        this.layLowBtnBg.setStrokeStyle(BORDERS.thin, COLORS.text.muted, 0.5)
        this.layLowBtnBg.disableInteractive()
      }
    } else if (heat >= 25) {
      // Show normal button - Network style
      this.layLowContainer.setVisible(true)
      if (this.layLowLabel) this.layLowLabel.setText('HIDE')
      if (this.layLowIcon) this.layLowIcon.setText('[L]')
      if (this.layLowBtnBg) {
        this.layLowBtnBg.setFillStyle(COLORS.bg.panel, 0.95)
        this.layLowBtnBg.setStrokeStyle(BORDERS.thin, COLORS.status.info, 0.8)
        this.layLowBtnBg.setInteractive({ useHandCursor: true })
      }
    } else {
      // Hide button
      this.layLowContainer.setVisible(false)
    }
  }

  /**
   * Show laying low countdown status
   */
  showLayLowStatus() {
    // Update button to show countdown
    this.updateLayLowButton()

    // Set up timer to update countdown
    if (this.layLowTimer) this.layLowTimer.remove()

    this.layLowTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        const remaining = gameManager.getLayLowRemaining()
        if (remaining <= 0) {
          this.updateLayLowButton()
          if (this.layLowTimer) this.layLowTimer.remove()
        } else {
          this.updateLayLowButton()
        }
      },
      loop: true
    })
  }

  setupEventListeners() {
    // Player updates
    gameManager.on('playerUpdated', (player) => {
      // Update stored district name (header removed, but we track it)
      if (player?.current_district?.name) {
        this.currentDistrict = player.current_district.name
      } else if (gameManager.gameState?.districts?.[0]?.name) {
        this.currentDistrict = gameManager.gameState.districts[0].name
      }

      // Update lay low button visibility based on heat
      this.updateLayLowButton()
    })

    // Laying low events
    gameManager.on('layingLowStarted', () => {
      this.updateLayLowButton()
      this.showLayLowStatus()
    })

    gameManager.on('layingLowEnded', () => {
      this.updateLayLowButton()
      if (this.layLowTimer) this.layLowTimer.remove()
    })

    // Travel completed
    gameManager.on('traveled', (data) => {
      // Update stored district name (header removed)
      this.currentDistrict = data.district?.name || 'Downtown Toronto'
    })

    // Notifications
    gameManager.on('notification', (notification) => {
      this.showNotification(notification)
    })

    // Handle scene resume
    this.events.on('resume', () => {
      // Refresh state when returning to main game scene
      gameManager.refreshGameState().catch(err => {
        console.error('Failed to refresh game state:', err)
      })

      // Re-check unclaimed achievements (badge may need updating)
      this.checkUnclaimedAchievements()

      // Notify tutorial manager of scene resume
      tutorialManager.setScene(this)
    })

    // Listen for achievement claims to update badge
    gameManager.on('achievementClaimed', () => {
      this.checkUnclaimedAchievements()
    })

    // Listen for new achievements unlocked
    gameManager.on('achievementsUnlocked', (achievements) => {
      this.checkUnclaimedAchievements()
      if (achievements && achievements.length > 0) {
        // Use the AchievementPopup singleton
        achievementPopup.setScene(this)
        achievementPopup.showMultiple(achievements)
      }
    })

    // Listen for new events
    gameManager.on('newEvent', (event) => {
      notificationManager.showEvent(event)
      this.checkActiveEvents()
    })

    // Listen for event responses to refresh badge
    gameManager.on('eventResponded', () => {
      this.checkActiveEvents()
    })
  }

  showAchievementUnlockedNotification(achievement) {
    const { width } = this.cameras.main

    // Special achievement notification
    const notifBg = this.add.rectangle(width / 2, 180, 300, 70, 0xf59e0b, 0.95)
      .setDepth(DEPTH.NOTIFICATIONS)
      .setStrokeStyle(2, 0xffd700)

    const iconText = this.add.text(width / 2 - 100, 170, achievement.icon || '🏆', {
      fontSize: '36px'
    }).setOrigin(0.5).setDepth(DEPTH.NOTIFICATIONS)

    const titleText = this.add.text(width / 2 + 10, 165, 'Achievement Unlocked!', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setDepth(DEPTH.NOTIFICATIONS)

    const nameText = this.add.text(width / 2 + 10, 185, achievement.name || 'New Achievement', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(DEPTH.NOTIFICATIONS)

    // Animate in
    const elements = [notifBg, iconText, titleText, nameText]
    elements.forEach(el => {
      el.setAlpha(0)
      el.y -= 30
    })

    this.tweens.add({
      targets: elements,
      alpha: 1,
      y: '+=30',
      duration: 400,
      ease: 'Back.out'
    })

    // Make it clickable to go to achievements
    notifBg.setInteractive({ useHandCursor: true })
    notifBg.on('pointerdown', () => {
      elements.forEach(el => el.destroy())
      this.openScene('AchievementsScene')
    })

    // Auto-dismiss after 4 seconds
    this.time.delayedCall(4000, () => {
      if (notifBg.active) {
        this.tweens.add({
          targets: elements,
          alpha: 0,
          y: '-=20',
          duration: 300,
          onComplete: () => {
            elements.forEach(el => el.destroy())
          }
        })
      }
    })
  }

  showNotification(notification) {
    const { width } = this.cameras.main

    const colors = {
      success: 0x22c55e,
      danger: 0xef4444,
      info: 0x3b82f6,
      warning: 0xf59e0b,
      message: 0x8b5cf6
    }

    const bgColor = colors[notification.type] || 0x333333

    const bg = this.add.rectangle(width / 2, 150, 320, 50, bgColor, 0.95)
      .setDepth(DEPTH.NOTIFICATIONS)

    const text = this.add.text(width / 2, 150, notification.message, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: 300 }
    }).setOrigin(0.5).setDepth(DEPTH.NOTIFICATIONS)

    // Animate in
    bg.setAlpha(0)
    text.setAlpha(0)
    bg.y = 120
    text.y = 120

    this.tweens.add({
      targets: [bg, text],
      alpha: 1,
      y: 150,
      duration: 200,
      ease: 'Power2'
    })

    // Animate out after delay
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [bg, text],
        alpha: 0,
        y: 120,
        duration: 300,
        onComplete: () => {
          bg.destroy()
          text.destroy()
        }
      })
    })
  }

  handleResize(gameSize) {
    // Guard against multiple rapid calls (debounce)
    if (this._resizeInProgress) {
      return
    }

    // Guard: Don't resize if scene is paused or not active
    if (!this.scene.isActive()) {
      return
    }

    this._resizeInProgress = true

    const width = gameSize.width
    const height = gameSize.height

    // Update background
    if (this.bg) {
      this.bg.setSize(width, height)
    }

    // Recreate scanline effect for new dimensions
    if (this.scanlineGraphics) {
      this.scanlineGraphics.destroy()
      this.createScanlineEffect()
    }

    // Note: District header has been removed to save vertical space

    // Update income panel position
    if (this.incomePanel) {
      this.incomePanel.setPosition(width / 2, 125)
    }
    if (this.incomeText) {
      this.incomeText.setPosition(width / 2, 125)
    }
    if (this.pendingIndicator) {
      this.pendingIndicator.setPosition(width / 2 + 95, 118)
    }

    // Update effects container position
    if (this.effectsContainer) {
      const effectsY = this.incomePanel ? 155 : 125
      this.effectsContainer.setPosition(width / 2, effectsY)
    }

    // Recreate module grid and terminal widget with new positions
    if (this.moduleCards) {
      this.moduleCards.forEach(card => card.destroy())
      this.moduleCards = []
    }
    if (this.actionButtons) {
      // Clear references (cards already destroyed above)
      this.actionButtons = []
    }
    if (this.terminalWidget) {
      this.terminalWidget.destroy()
      this.terminalWidget = null
    }
    // Close drawer if open
    if (this.moduleDrawer) {
      this.moduleDrawer.close()
    }
    this.createModuleGrid()

    // Reset guard after a short delay
    this.time.delayedCall(100, () => {
      this._resizeInProgress = false
    })
  }

  // ==========================================
  // EVENTS SYSTEM METHODS
  // ==========================================

  async checkActiveEvents() {
    try {
      const events = await gameManager.getActiveEvents().catch(() => [])

      if (events && events.length > 0) {
        this.showEventsBadge(events.length)

        // Show notification for urgent events
        const urgentEvents = events.filter(e => e.type === 'threat' || e.expires_at)
        if (urgentEvents.length > 0) {
          notificationManager.showToast(
            `${urgentEvents.length} event${urgentEvents.length > 1 ? 's' : ''} require your attention!`,
            'warning',
            4000
          )
        }
      }
    } catch (error) {
      console.error('Failed to check active events:', error)
    }
  }

  showEventsBadge(count) {
    // Find the events button
    const eventsButton = this.actionButtons.find(btn => {
      const action = btn.getData('action')
      return action && action.key === 'events'
    })

    if (!eventsButton) return

    // Remove existing badge if any
    const existingBadge = eventsButton.getData('badge')
    if (existingBadge) {
      existingBadge.destroy()
    }
    const existingBadgeText = eventsButton.getData('badgeText')
    if (existingBadgeText) {
      existingBadgeText.destroy()
    }

    if (count <= 0) return

    // Create badge
    const badge = this.add.circle(50, -35, 12, 0xef4444)
    const badgeText = this.add.text(50, -35, count > 9 ? '9+' : count.toString(), {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    eventsButton.add([badge, badgeText])
    eventsButton.setData('badge', badge)
    eventsButton.setData('badgeText', badgeText)

    // Pulsing animation
    this.tweens.add({
      targets: badge,
      scale: { from: 1, to: 1.2 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  startEventPolling() {
    // Check for new events every 60 seconds
    this.eventPollTimer = this.time.addEvent({
      delay: 60000,
      callback: async () => {
        try {
          const result = await gameManager.checkForEvents().catch(() => null)

          if (result && result.new_events && result.new_events.length > 0) {
            // Show notification for each new event
            result.new_events.forEach(event => {
              notificationManager.showEvent(event)
            })

            // Update badge
            this.checkActiveEvents()
          }
        } catch (error) {
          console.error('Event polling failed:', error)
        }
      },
      loop: true
    })
  }

  // ==========================================================================
  // ADMIN BUTTON
  // ==========================================================================

  createAdminButton() {
    // Check both database admin flag and secret admin mode
    const isSecretAdmin = localStorage.getItem('secret_admin_mode') === 'true'
    const isDatabaseAdmin = gameManager.isAdmin()

    // Update adminManager status
    if (isSecretAdmin || isDatabaseAdmin) {
      adminManager.isAdmin = true
    }

    // Only show admin button if player is admin (either way)
    if (!isDatabaseAdmin && !isSecretAdmin) return

    const { width } = this.cameras.main

    // Admin button in top-right corner
    const adminBtn = this.add.container(width - 40, 30)
    adminBtn.setDepth(DEPTH.BUTTONS)

    // Button background
    const bg = this.add.circle(0, 0, 22, 0xef4444, 0.9)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0xffffff, 0.3)

    // Shield icon
    const icon = this.add.text(0, 0, '🛡️', {
      fontSize: '18px'
    }).setOrigin(0.5)

    adminBtn.add([bg, icon])

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(0xdc2626)
      audioManager.playHover()
      this.tweens.add({
        targets: adminBtn,
        scale: 1.1,
        duration: 100
      })
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0xef4444)
      this.tweens.add({
        targets: adminBtn,
        scale: 1,
        duration: 100
      })
    })

    bg.on('pointerdown', () => {
      audioManager.playClick()
      this.openScene('AdminScene')
    })

    // Pulsing animation to draw attention
    this.tweens.add({
      targets: bg,
      alpha: { from: 0.9, to: 0.6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.adminButton = adminBtn
  }

  /**
   * Create subtle scanline/grid effect for CRT terminal aesthetic
   */
  createScanlineEffect() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(DEPTH.SCANLINES)
    graphics.setAlpha(EFFECTS.scanlines.opacity)

    // Draw horizontal scanlines
    for (let y = 0; y < height; y += EFFECTS.scanlines.spacing) {
      graphics.fillStyle(COLORS.vhs.scanline, 0.5)
      graphics.fillRect(0, y, width, 1)
    }

    // Add subtle vertical grid lines for terminal feel
    const gridSpacing = 40
    for (let x = 0; x < width; x += gridSpacing) {
      graphics.fillStyle(COLORS.network.dim, 0.03)
      graphics.fillRect(x, 0, 1, height)
    }

    this.scanlineGraphics = graphics

    // Very subtle slow scrolling effect
    this.tweens.add({
      targets: graphics,
      y: { from: 0, to: EFFECTS.scanlines.spacing },
      duration: EFFECTS.scanlines.speed,
      repeat: -1,
      ease: 'Linear'
    })
  }

  shutdown() {
    // Clean up event listeners
    gameManager.off('playerUpdated')
    gameManager.off('traveled')
    gameManager.off('notification')
    gameManager.off('achievementClaimed')
    gameManager.off('achievementsUnlocked')
    gameManager.off('newEvent')
    this.scale.off('resize', this.handleResize, this)

    // Clean up event polling timer
    if (this.eventPollTimer) {
      this.eventPollTimer.destroy()
    }

    // Clean up module drawer
    if (this.moduleDrawer) {
      this.moduleDrawer.destroy()
    }
  }
}
