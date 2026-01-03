/**
 * OperationsHubScene - Operations Hub (Street Ops / Contracts / Major Ops)
 *
 * Part of the OS-style dashboard redesign.
 * Combines all "work" operations into a single tabbed interface.
 * Uses coded language for immersion - this is an encrypted underground network.
 */

import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
import { PlayerStatsBar } from '../ui/PlayerStatsBar'
import { SceneReadinessManager } from '../managers/SceneReadinessManager'
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'

// Import local data from existing scenes
import { HEISTS, getPlayerData, savePlayerData, applyTimeModifierToJob } from '../data/GameData.js'

// Import mini-game mappings for direct execution
import { getJobMapping, getSceneKeyForGame, createDefaultJobMapping } from '../config/JobGameMapping'
import { getCrimeMapping, getSceneKeyForGame as getSceneKeyForCrime } from '../config/CrimeGameMapping'
import { networkMessageManager } from '../managers/NetworkMessageManager'

// Local crime database
const LOCAL_CRIMES = [
  // TIER 1: PETTY STREET CRIMES
  { id: 'pickpocket', name: 'Pickpocket', description: 'Lift wallets from tourists', min_level: 1, energy_cost: 5, base_success_rate: 85, min_payout: 20, max_payout: 100, heat_gain: 3, xp_reward: 10, tier: 'petty', has_minigame: true },
  { id: 'shoplift', name: 'Shoplifting', description: 'Five finger discount', min_level: 1, energy_cost: 5, base_success_rate: 80, min_payout: 15, max_payout: 75, heat_gain: 2, xp_reward: 8, tier: 'petty', has_minigame: true },
  { id: 'purse_snatch', name: 'Purse Snatching', description: 'Grab and run', min_level: 2, energy_cost: 8, base_success_rate: 70, min_payout: 30, max_payout: 150, heat_gain: 5, xp_reward: 12, tier: 'petty', has_minigame: true },
  { id: 'package_theft', name: 'Package Theft', description: 'Steal porch packages', min_level: 2, energy_cost: 6, base_success_rate: 85, min_payout: 20, max_payout: 200, heat_gain: 3, xp_reward: 10, tier: 'petty', has_minigame: true },

  // TIER 2: PROPERTY CRIMES
  { id: 'car_break_in', name: 'Car Break-in', description: 'Smash windows, grab valuables', min_level: 5, energy_cost: 10, base_success_rate: 75, min_payout: 50, max_payout: 300, heat_gain: 8, xp_reward: 15, tier: 'theft', has_minigame: true },
  { id: 'bike_theft', name: 'Bike Theft', description: 'Steal bicycles to sell', min_level: 5, energy_cost: 8, base_success_rate: 80, min_payout: 50, max_payout: 200, heat_gain: 3, xp_reward: 12, tier: 'theft', has_minigame: true },
  { id: 'house_burglary', name: 'House Burglary', description: 'Break into homes', min_level: 10, energy_cost: 20, base_success_rate: 60, min_payout: 200, max_payout: 1000, heat_gain: 15, xp_reward: 35, tier: 'theft', has_minigame: true },

  // TIER 3: ROBBERY
  { id: 'mugging', name: 'Mugging', description: 'Rob pedestrians', min_level: 10, energy_cost: 15, base_success_rate: 70, min_payout: 50, max_payout: 300, heat_gain: 10, xp_reward: 25, tier: 'violent', has_minigame: true },
  { id: 'convenience_robbery', name: 'Store Robbery', description: 'Hold up small shops', min_level: 14, energy_cost: 22, base_success_rate: 60, min_payout: 200, max_payout: 800, heat_gain: 20, xp_reward: 40, tier: 'violent', has_minigame: true },

  // TIER 4: VEHICLE CRIMES
  { id: 'car_theft', name: 'Car Theft', description: 'Steal vehicles for chop shop', min_level: 15, energy_cost: 20, base_success_rate: 60, min_payout: 1000, max_payout: 5000, heat_gain: 20, xp_reward: 50, tier: 'vehicle', has_minigame: true },
  { id: 'luxury_theft', name: 'Luxury Car Theft', description: 'Target high-end vehicles', min_level: 20, energy_cost: 28, base_success_rate: 50, min_payout: 3000, max_payout: 15000, heat_gain: 30, xp_reward: 80, tier: 'vehicle', has_minigame: true },
]

// Local jobs database
const LOCAL_JOBS = [
  // TIER 1: ENTRY-LEVEL
  { id: 'dishwasher', name: 'Dishwasher', description: 'Wash dishes at restaurant', min_level: 1, energy_cost: 10, base_pay: 35, xp_reward: 5, duration_seconds: 30, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'dog_walker', name: 'Dog Walker', description: 'Walk neighborhood dogs', min_level: 2, energy_cost: 10, base_pay: 40, xp_reward: 6, duration_seconds: 30, tier: 'entry', skill: 'Charisma', has_minigame: true },
  { id: 'lawn_mowing', name: 'Lawn Mowing', description: 'Mow residential lawns', min_level: 2, energy_cost: 18, base_pay: 45, xp_reward: 7, duration_seconds: 35, tier: 'entry', skill: 'Endurance', has_minigame: true },

  // TIER 2: SERVICE
  { id: 'fast_food', name: 'Fast Food Worker', description: 'Take orders, cook, serve', min_level: 5, energy_cost: 12, base_pay: 40, xp_reward: 8, duration_seconds: 35, tier: 'service', skill: 'Charisma', has_minigame: true },
  { id: 'bartender', name: 'Bartender', description: 'Mix drinks and serve', min_level: 8, energy_cost: 15, base_pay: 60, xp_reward: 11, duration_seconds: 40, tier: 'service', skill: 'Charisma', has_minigame: true },
  { id: 'pizza_delivery', name: 'Pizza Delivery', description: 'Deliver pizzas around town', min_level: 6, energy_cost: 12, base_pay: 55, xp_reward: 9, duration_seconds: 35, tier: 'service', skill: 'Street Cred', has_minigame: true },

  // TIER 3: SKILLED
  { id: 'warehouse', name: 'Warehouse Worker', description: 'Load and unload shipments', min_level: 10, energy_cost: 20, base_pay: 65, xp_reward: 12, duration_seconds: 45, tier: 'labor', skill: 'Endurance', has_minigame: true },
  { id: 'construction', name: 'Construction Laborer', description: 'General construction work', min_level: 12, energy_cost: 25, base_pay: 80, xp_reward: 15, duration_seconds: 50, tier: 'labor', skill: 'Endurance', has_minigame: true },
  { id: 'mechanic', name: 'Auto Mechanic', description: 'Repair and maintain vehicles', min_level: 20, energy_cost: 20, base_pay: 90, xp_reward: 16, duration_seconds: 50, tier: 'technical', skill: 'Technical', has_minigame: true },
]

export class OperationsHubScene extends BaseScene {
  constructor() {
    super('OperationsHubScene')
    this.activeTab = 'crime' // 'crime' | 'jobs' | 'heists'
    this.statsBar = null
    this.scrollY = 0
    this.maxScrollY = 0
    this.scrollContainer = null
    this.contentItems = []
    this.tabButtons = []
    this.readiness = null // SceneReadinessManager instance
  }

  init(data) {
    super.init(data)
    console.log('[OperationsHubScene] init() called with data:', JSON.stringify(data || {}))
    console.log('[OperationsHubScene] returnScene:', data?.returnScene)

    // Create readiness manager for proper lifecycle handling
    this.readiness = new SceneReadinessManager(this)

    // Allow specifying initial tab from drawer
    if (data?.tab) {
      this.activeTab = data.tab
    }

    // Check if we're returning from a mini-game
    this.returningFromMiniGame = !!(data?.miniGameResult)
    this.miniGameResult = data?.miniGameResult || null
    this.returnedItemType = data?.itemType || null
    this.returnedItemData = data?.itemData || null

    if (this.returningFromMiniGame) {
      console.log('[OperationsHubScene] Returning from mini-game with result:', data.miniGameResult)
      console.log('[OperationsHubScene] Item type:', this.returnedItemType)
      console.log('[OperationsHubScene] Item data:', this.returnedItemData)
    }
  }

  /**
   * Clean up other scenes to prevent layer conflicts
   * This is critical when returning from mini-games
   */
  cleanupOtherScenes() {
    console.log('[OperationsHubScene] Cleaning up other scenes...')

    // List of all mini-game scenes that might still be running
    const miniGameScenes = [
      'SnakeGame', 'LockPickGame', 'QTEGame', 'FroggerGame',
      'MemoryGame', 'SteadyHandGame', 'ChaseGame', 'SniperGame',
      'SafeCrackGame', 'WireGame', 'RhythmGame', 'HackingGame',
      'GetawayGame', 'NegotiationGame', 'SurveillanceGame', 'MiniGameResult'
    ]

    // Stop all mini-game scenes
    miniGameScenes.forEach(sceneKey => {
      try {
        if (this.scene.isActive(sceneKey) || this.scene.isPaused(sceneKey)) {
          this.scene.stop(sceneKey)
          console.log(`[OperationsHubScene] Stopped scene: ${sceneKey}`)
        }
      } catch (e) {
        // Scene may not exist, ignore
      }
    })

    // Also stop other hub/detail scenes that might be lingering
    const otherScenes = ['JobScene', 'CrimeScene', 'HeistsScene']
    otherScenes.forEach(sceneKey => {
      try {
        if (this.scene.isActive(sceneKey)) {
          this.scene.stop(sceneKey)
          console.log(`[OperationsHubScene] Stopped scene: ${sceneKey}`)
        }
      } catch (e) {
        // Ignore
      }
    })

    // Reset camera state to ensure clean rendering
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.cameras.main.setBackgroundColor(0x0a0a0a)
    } catch (e) {
      console.warn('[OperationsHubScene] Camera reset warning:', e)
    }

    console.log('[OperationsHubScene] Scene cleanup complete')
  }

  async create() {
    console.log('[OperationsHubScene] create() started')
    super.create({ skipIntro: true })

    // CRITICAL: Block input until scene is fully ready
    this.readiness.beginCreate()

    // CRITICAL: Stop ALL other active scenes to prevent layer conflicts
    // This is especially important when returning from mini-games
    this.cleanupOtherScenes()

    // CRITICAL: Bring this scene to top of scene stack for input priority
    // This ensures clicks go to hub scene, not GameScene below
    this.scene.bringToTop()
    console.log('[OperationsHubScene] Brought self to top of scene stack')

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
    networkTransition.playSceneIntro(this, 'OperationsHubScene')

    // Header
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Tab bar
    this.createTabBar()

    // Player stats bar
    this.statsBar = new PlayerStatsBar(this, {
      y: 115,
      cooldownAction: this.activeTab,
      showHeat: this.activeTab === 'crime' || this.activeTab === 'heists',
      depth: DEPTH.STATS_BAR
    }).create()

    // AWAIT content loading (like CrimeScene does)
    try {
      await this.loadContent()
      console.log('[OperationsHubScene] Content loaded successfully')
    } catch (error) {
      console.error('[OperationsHubScene] Failed to load content:', error)
    }

    // CRITICAL: Mark scene ready - this enables input after a short delay
    await this.readiness.markReady(100)

    // Emit sceneReady for NetworkTransition coordination
    this.events.emit('sceneReady')
    console.log('[OperationsHubScene] create() completed, scene fully ready')

    // Process mini-game result if returning from one
    if (this.returningFromMiniGame && this.miniGameResult && this.returnedItemData) {
      this.processMiniGameResult()
    }

    // Handle scene resume/pause for input management
    this.events.on('resume', () => {
      console.log('[OperationsHubScene] Scene resumed')
      this.input.enabled = true
    })

    this.events.on('pause', () => {
      console.log('[OperationsHubScene] Scene paused')
      this.input.enabled = false
    })
  }

  createBackgroundPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(DEPTH.GRID)

    // Subtle grid pattern
    graphics.lineStyle(1, COLORS.network.dark, 0.15)
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

    // Red accent line (operations = danger color)
    this.add.rectangle(width / 2, 68, width, 2, 0xFF4444, 0.8)
      .setDepth(DEPTH.CONTENT_BASE)

    // Icon
    const icon = this.add.text(width / 2 - 120, 28, '[!]', {
      ...getTerminalStyle('lg'),
      color: '#FF4444'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Animate icon
    this.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Title
    this.add.text(width / 2, 28, 'OPERATIONS TERMINAL', {
      ...getTerminalStyle('xl'),
      color: '#FF4444'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Subtitle
    this.add.text(width / 2, 52, `${SYMBOLS.system} CRIMINAL & WORK ACTIVITIES`, {
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
      closeBtn.setColor('#FF4444')
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

  createTabBar() {
    const { width } = this.cameras.main
    const tabY = 85
    const tabWidth = (width - 40) / 3

    const tabs = [
      { key: 'crime', label: 'STREET OPS', icon: '[S]', color: 0xEF4444, count: 0 },
      { key: 'jobs', label: 'CONTRACTS', icon: '[C]', color: 0x22C55E, count: 0 },
      { key: 'heists', label: 'MAJOR OPS', icon: '[M]', color: 0xF59E0B, count: 0 }
    ]

    // Tab bar background
    this.add.rectangle(width / 2, tabY, width - 20, 32, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, COLORS.network.dim, 0.3)
      .setDepth(DEPTH.PANELS)

    this.tabButtons = []

    tabs.forEach((tab, index) => {
      const x = 20 + tabWidth / 2 + index * tabWidth

      // Tab background
      const isActive = this.activeTab === tab.key
      const tabBg = this.add.rectangle(x, tabY, tabWidth - 4, 28,
        isActive ? tab.color : COLORS.bg.card,
        isActive ? 0.3 : 0.6
      )
        .setStrokeStyle(isActive ? 2 : 1, tab.color, isActive ? 0.8 : 0.3)
        .setDepth(DEPTH.PANEL_CONTENT)
        .setInteractive({ useHandCursor: true })

      // Tab label
      const tabLabel = this.add.text(x, tabY, `${tab.icon} ${tab.label}`, {
        ...getTextStyle('sm', isActive ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
        fontStyle: isActive ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(DEPTH.BUTTONS)

      // Tab interactions
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

    // Update stats bar
    if (this.statsBar) {
      this.statsBar.destroy()
    }
    this.statsBar = new PlayerStatsBar(this, {
      y: 115,
      cooldownAction: tabKey === 'heists' ? 'crime' : tabKey,
      showHeat: tabKey === 'crime' || tabKey === 'heists',
      depth: DEPTH.STATS_BAR
    }).create()

    // Reload content
    this.loadContent()
  }

  async loadContent() {
    // Clear existing content
    this.clearContent()

    const { width, height } = this.cameras.main
    const statsBarHeight = this.statsBar ? this.statsBar.getHeight() : 0
    const startY = 115 + statsBarHeight + 15

    // Loading indicator
    const loadingText = this.add.text(width / 2, height / 2, `${SYMBOLS.system} LOADING...`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.STATS_BAR)
    this.contentItems.push(loadingText)

    try {
      let data
      switch (this.activeTab) {
        case 'crime':
          data = await this.loadCrimes()
          break
        case 'jobs':
          data = await this.loadJobs()
          break
        case 'heists':
          data = await this.loadHeists()
          break
      }

      loadingText.destroy()
      this.renderContent(data, startY)
    } catch (error) {
      console.error('[OperationsHub] Failed to load content:', error)
      loadingText.setText(`${SYMBOLS.system} LOAD FAILED`)
    }
  }

  async loadCrimes() {
    try {
      const crimes = await gameManager.getAvailableCrimes()
      return crimes && crimes.length > 0 ? crimes : LOCAL_CRIMES
    } catch (e) {
      return LOCAL_CRIMES
    }
  }

  async loadJobs() {
    try {
      const jobs = await gameManager.getAvailableJobs()
      return jobs && jobs.length > 0 ? jobs : LOCAL_JOBS
    } catch (e) {
      return LOCAL_JOBS
    }
  }

  async loadHeists() {
    const player = gameManager.player || getPlayerData()
    const playerLevel = player.level || 1

    return HEISTS.map(heist => ({
      ...heist,
      canStart: playerLevel >= heist.min_level,
      minLevel: heist.min_level,
      minPayout: heist.min_payout,
      maxPayout: heist.max_payout,
      baseSuccessRate: heist.success_rate,
      heatGenerated: heist.heat_gain
    }))
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []
    this.scrollY = 0
  }

  renderContent(data, startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}
    const playerLevel = player.level || 1
    const playerEnergy = player.energy || 100
    const playerHeat = player.heat || 0

    // Sort items: unlocked first, then by level requirement
    const sortedItems = [...data].sort((a, b) => {
      const aLevel = a.min_level || a.required_level || 1
      const bLevel = b.min_level || b.required_level || 1
      const aUnlocked = aLevel <= playerLevel
      const bUnlocked = bLevel <= playerLevel
      if (aUnlocked && !bUnlocked) return -1
      if (!aUnlocked && bUnlocked) return 1
      return aLevel - bLevel
    })

    if (sortedItems.length === 0) {
      const noDataText = this.add.text(width / 2, height / 2,
        `${SYMBOLS.system} NO ${this.activeTab.toUpperCase()} AVAILABLE`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.STATS_BAR)
      this.contentItems.push(noDataText)
      return
    }

    // Create scrollable content area
    const cardHeight = this.activeTab === 'heists' ? 85 : 78
    const cardSpacing = 8
    const maxVisibleY = height - 20

    sortedItems.forEach((item, index) => {
      const y = startY + index * (cardHeight + cardSpacing)
      if (y < maxVisibleY) {
        // Determine lock reason
        const reqLevel = item.min_level || item.required_level || 1
        const energyCost = item.energy_cost || item.stamina_cost || 10
        const heatLimit = item.heat_limit || 100

        const lockInfo = {
          levelLocked: reqLevel > playerLevel,
          requiredLevel: reqLevel,
          energyLocked: playerEnergy < energyCost,
          requiredEnergy: energyCost,
          heatLocked: playerHeat > heatLimit,
          heatLimit: heatLimit
        }

        this.createItemCard(item, y, cardHeight, lockInfo)
      }
    })

    // Calculate scroll limits
    this.maxScrollY = Math.max(0, (sortedItems.length * (cardHeight + cardSpacing)) - (maxVisibleY - startY))
  }

  createItemCard(item, y, cardHeight, lockInfo = {}) {
    const { width } = this.cameras.main

    // Determine if locked and why
    const isLocked = lockInfo.levelLocked || lockInfo.energyLocked || lockInfo.heatLocked
    const canExecute = !isLocked

    // Build lock reason message
    let lockReason = ''
    if (lockInfo.levelLocked) {
      lockReason = `UNLOCK AT LEVEL ${lockInfo.requiredLevel}`
    } else if (lockInfo.energyLocked) {
      lockReason = `REQUIRES ${lockInfo.requiredEnergy} ENERGY`
    } else if (lockInfo.heatLocked) {
      lockReason = `REDUCE HEAT BELOW ${lockInfo.heatLimit}%`
    }

    // Determine card style based on tab and item type
    let cardConfig
    switch (this.activeTab) {
      case 'crime':
        cardConfig = this.getCrimeCardConfig(item)
        break
      case 'jobs':
        cardConfig = this.getJobCardConfig(item)
        break
      case 'heists':
        cardConfig = this.getHeistCardConfig(item)
        break
    }

    // Card background
    const cardBg = canExecute ? COLORS.bg.panel : COLORS.bg.void
    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, cardBg, canExecute ? 0.95 : 0.6)
      .setDepth(DEPTH.CONTENT_BASE)
    this.contentItems.push(card)

    // Entrance animation
    card.setAlpha(0).setScale(0.95)
    this.tweens.add({
      targets: card,
      alpha: canExecute ? 0.95 : 0.6,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut'
    })

    // Left accent bar
    const accentBar = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, canExecute ? cardConfig.color : COLORS.text.muted)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accentBar)

    if (canExecute) {
      card.setStrokeStyle(1, cardConfig.color, 0.4)
        .setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(Phaser.Display.Color.ValueToColor(COLORS.bg.panel).lighten(15).color, 1)
        card.setStrokeStyle(2, cardConfig.color, 0.7)
        audioManager.playHover()
      })

      card.on('pointerout', () => {
        card.setFillStyle(COLORS.bg.panel, 0.95)
        card.setStrokeStyle(1, cardConfig.color, 0.4)
      })

      card.on('pointerdown', () => {
        audioManager.playClick()
        this.tweens.add({
          targets: card,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          onComplete: () => this.executeItem(item)
        })
      })
    } else {
      card.setStrokeStyle(1, 0xef4444, 0.3)
    }

    // Icon
    const iconBg = this.add.circle(45, y + cardHeight / 2 - 6, 16, cardConfig.color, canExecute ? 0.15 : 0.05)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(iconBg)

    const iconText = this.add.text(45, y + cardHeight / 2 - 6, cardConfig.icon, {
      ...getTerminalStyle('md'),
      color: toHexString(cardConfig.color)
    }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS).setAlpha(canExecute ? 1 : 0.4)
    this.contentItems.push(iconText)

    // Item name (dimmed if locked)
    const nameText = this.add.text(70, y + 10, item.name.toUpperCase(), {
      ...getTextStyle('sm', canExecute ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT).setAlpha(canExecute ? 1 : 0.4)
    this.contentItems.push(nameText)

    // Show lock reason instead of description when locked
    if (isLocked && lockReason) {
      // Lock icon + requirement text in bright red
      const lockDisplay = this.add.text(70, y + 28, `🔒 ${lockReason}`, {
        ...getTextStyle('xs', 0xef4444, 'terminal'),
        fontStyle: 'bold'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(lockDisplay)
    } else if (item.description) {
      // Normal description
      const descText = this.add.text(70, y + 28, item.description.substring(0, 38) + (item.description.length > 38 ? '...' : ''), {
        ...getTextStyle('xs', COLORS.text.secondary, 'body')
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(descText)
    }

    // Stats row (dimmed if locked)
    this.createStatsRow(item, y, cardHeight, canExecute, cardConfig)

    // Reward display (dimmed if locked)
    this.createRewardDisplay(item, y, cardHeight, canExecute)
  }

  getCrimeCardConfig(item) {
    const tierConfig = {
      petty: { color: 0x22C55E, icon: '[P]' },
      theft: { color: 0x3B82F6, icon: '[T]' },
      violent: { color: 0xEF4444, icon: '[V]' },
      vehicle: { color: 0xA855F7, icon: '[C]' },
      fraud: { color: 0xF59E0B, icon: '[F]' },
      drugs: { color: 0x06B6D4, icon: '[D]' },
      organized: { color: 0xEC4899, icon: '[O]' },
      cyber: { color: 0x8B5CF6, icon: '[@]' },
      classic: { color: 0xFBBF24, icon: '[*]' },
      default: { color: 0xEF4444, icon: '[!]' }
    }
    return tierConfig[item.tier] || tierConfig.default
  }

  getJobCardConfig(item) {
    const tierConfig = {
      entry: { color: 0x22C55E, icon: '[E]' },
      service: { color: 0x3B82F6, icon: '[S]' },
      labor: { color: 0xF59E0B, icon: '[L]' },
      driving: { color: 0xA855F7, icon: '[D]' },
      security: { color: 0xEF4444, icon: '[X]' },
      technical: { color: 0x06B6D4, icon: '[T]' },
      gig: { color: 0x8B5CF6, icon: '[G]' },
      default: { color: 0x22C55E, icon: '[W]' }
    }
    return tierConfig[item.tier] || tierConfig.default
  }

  getHeistCardConfig(item) {
    const diffColors = {
      1: { color: 0x22C55E, icon: '[S]' },
      2: { color: 0x3B82F6, icon: '[J]' },
      3: { color: 0xF59E0B, icon: '[W]' },
      4: { color: 0xF97316, icon: '[A]' },
      5: { color: 0xEF4444, icon: '[B]' }
    }
    return diffColors[item.difficulty] || diffColors[1]
  }

  createStatsRow(item, y, cardHeight, canExecute, config) {
    const { width } = this.cameras.main
    const statsY = y + cardHeight - 18
    let statsX = 35

    // Energy cost
    const energyPillWidth = 45
    const energyBg = this.add.rectangle(statsX + energyPillWidth / 2, statsY, energyPillWidth, 16, 0x3B82F6, 0.15)
      .setStrokeStyle(1, 0x3B82F6, 0.3).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(energyBg)

    const energyCost = item.energy_cost || item.stamina_cost || 10
    const energyText = this.add.text(statsX + energyPillWidth / 2, statsY, `E:${energyCost}`, {
      ...getTextStyle('xs', canExecute ? 0x60A5FA : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
    this.contentItems.push(energyText)

    statsX += energyPillWidth + 5

    // Type-specific stats
    if (this.activeTab === 'crime' || this.activeTab === 'heists') {
      // Success rate
      const successRate = item.base_success_rate || item.baseSuccessRate || 70
      const successColor = successRate >= 70 ? 0x22C55E : successRate >= 50 ? 0xF59E0B : 0xEF4444
      const successPillWidth = 45
      const successBg = this.add.rectangle(statsX + successPillWidth / 2, statsY, successPillWidth, 16, successColor, 0.15)
        .setStrokeStyle(1, successColor, 0.3).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(successBg)

      const successText = this.add.text(statsX + successPillWidth / 2, statsY, `${successRate}%`, {
        ...getTextStyle('xs', canExecute ? 0xFFFFFF : COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(successText)

      statsX += successPillWidth + 5

      // Heat gain
      const heatGain = item.heat_gain || item.heatGenerated || 5
      const heatPillWidth = 48
      const heatBg = this.add.rectangle(statsX + heatPillWidth / 2, statsY, heatPillWidth, 16, 0xEF4444, 0.15)
        .setStrokeStyle(1, 0xEF4444, 0.3).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(heatBg)

      const heatText = this.add.text(statsX + heatPillWidth / 2, statsY, `🔥+${heatGain}`, {
        ...getTextStyle('xs', canExecute ? 0xF87171 : COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(heatText)

    } else if (this.activeTab === 'jobs') {
      // Duration
      const duration = item.duration_seconds || 60
      const durationPillWidth = 45
      const durationBg = this.add.rectangle(statsX + durationPillWidth / 2, statsY, durationPillWidth, 16, 0x8B5CF6, 0.15)
        .setStrokeStyle(1, 0x8B5CF6, 0.3).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(durationBg)

      const durationText = this.add.text(statsX + durationPillWidth / 2, statsY, `${duration}s`, {
        ...getTextStyle('xs', canExecute ? 0xA78BFA : COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(durationText)

      statsX += durationPillWidth + 5

      // XP
      const xp = item.xp_reward || 10
      const xpPillWidth = 42
      const xpBg = this.add.rectangle(statsX + xpPillWidth / 2, statsY, xpPillWidth, 16, 0xF59E0B, 0.15)
        .setStrokeStyle(1, 0xF59E0B, 0.3).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(xpBg)

      const xpText = this.add.text(statsX + xpPillWidth / 2, statsY, `+${xp}XP`, {
        ...getTextStyle('xs', canExecute ? 0xFBBF24 : COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(xpText)
    }
  }

  createRewardDisplay(item, y, cardHeight, canExecute) {
    const { width } = this.cameras.main
    const payBoxWidth = 75

    // Pay box background
    const payBg = this.add.rectangle(width - 15 - payBoxWidth / 2, y + cardHeight / 2, payBoxWidth, cardHeight - 14, COLORS.bg.void, 0.95)
      .setStrokeStyle(1, COLORS.network.primary, canExecute ? 0.5 : 0.2).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(payBg)

    // Money icon
    const moneyIcon = this.add.text(width - 15 - payBoxWidth / 2, y + 14, SYMBOLS.cash, {
      ...getTerminalStyle('md'),
      color: toHexString(canExecute ? COLORS.text.gold : COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
    this.contentItems.push(moneyIcon)

    // Payout amount
    let payout
    if (this.activeTab === 'jobs') {
      const basePay = item.base_pay || 50
      const levelBonus = Math.floor((gameManager.player?.level || 1) * 5)
      payout = Math.floor(basePay * (1 + levelBonus / 100))
    } else if (this.activeTab === 'heists') {
      payout = item.minPayout || item.min_payout || 1000
    } else {
      payout = item.max_payout || item.min_payout || 100
    }

    const payText = this.add.text(width - 15 - payBoxWidth / 2, y + 32, formatMoney(payout), {
      ...getTextStyle('sm', canExecute ? COLORS.text.gold : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
    this.contentItems.push(payText)

    // Range for crimes/heists
    if (this.activeTab !== 'jobs' && item.max_payout) {
      const rangeText = this.add.text(width - 15 - payBoxWidth / 2, y + 48, `to ${formatMoney(item.max_payout)}`, {
        ...getTextStyle('xs', canExecute ? COLORS.network.primary : COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(rangeText)
    }
  }

  executeItem(item) {
    console.log('[OperationsHubScene] ========== executeItem CALLED ==========')
    console.log('[OperationsHubScene] Item:', item?.name || 'undefined')
    console.log('[OperationsHubScene] Active tab:', this.activeTab)

    // Execute directly based on tab type - no more intermediate scenes!
    switch (this.activeTab) {
      case 'jobs':
        this.executeJob(item)
        break
      case 'crime':
        this.executeCrime(item)
        break
      case 'heists':
        this.executeHeist(item)
        break
      default:
        console.error('[OperationsHubScene] Unknown tab:', this.activeTab)
    }
  }

  /**
   * Execute a job directly with mini-game support
   */
  executeJob(job) {
    console.log('[OperationsHubScene] Executing job:', job.name)

    // Check cooldown
    if (gameManager.isOnCooldown('job')) {
      if (this.statsBar) {
        this.statsBar.showCooldownWarning()
      }
      audioManager.playMiss()
      return
    }

    const player = gameManager.player || getPlayerData() || {}
    const playerEnergy = player.energy || 100
    const energyCost = job.energy_cost || job.stamina_cost || 10

    // Check energy
    if (playerEnergy < energyCost) {
      if (this.statsBar) {
        this.statsBar.showWarning(`Need ${energyCost} energy (have ${Math.floor(playerEnergy)})`)
      }
      audioManager.playMiss()
      return
    }

    // Check if this job has a mini-game
    const mapping = getJobMapping(job.id)
    console.log(`[OperationsHubScene] Job ${job.id} - mapping:`, mapping ? 'found' : 'NOT FOUND', ', has_minigame:', job.has_minigame)

    if (mapping) {
      this.launchJobMiniGame(job, mapping)
    } else {
      console.warn(`[OperationsHubScene] No mini-game mapping for job: ${job.id}, using working animation`)
      this.showWorkingAnimation(job, 'job')
    }
  }

  /**
   * Launch mini-game for a job
   */
  launchJobMiniGame(job, mapping) {
    console.log(`[OperationsHubScene] Launching job mini-game: ${job.id}`)

    const playerLevel = gameManager.player?.level || 1
    const baseDifficulty = mapping.difficulty || 1
    const difficulty = Math.min(5, baseDifficulty + Math.floor(playerLevel / 10))

    const gameData = {
      crimeId: job.id,
      crimeName: job.name,
      gameType: mapping.gameType,
      difficulty,
      timeLimit: mapping.timeLimit,
      targetScore: mapping.targetScore,
      perfectScore: mapping.perfectScore,
      theme: mapping.theme,
      returnScene: 'OperationsHubScene',
      returnData: {
        tab: 'jobs',
        itemType: 'job',
        itemData: job  // Pass job data for reward processing
      },
      isJob: true,
      jobData: job,
      // Note: onComplete callback won't work since scene is stopped
      // Rewards are processed in OperationsHubScene.init() using miniGameResult
      difficultyTier: { name: 'Worker', color: '#22c55e' },
      rewardMultiplier: 1 + (playerLevel * 0.05),
      baseCashReward: job.base_pay || 50,
      baseXpReward: job.xp_reward || 10
    }

    const sceneKey = getSceneKeyForGame(mapping.gameType)

    if (!this.scene.get(sceneKey)) {
      console.error(`[OperationsHubScene] Mini-game scene not found: ${sceneKey}`)
      this.showWorkingAnimation(job, 'job')
      return
    }

    // Store for return
    this.pendingItem = job
    this.pendingType = 'job'

    // Clean up
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    // Launch mini-game
    console.log(`[OperationsHubScene] Starting mini-game: ${sceneKey}`)
    this.scene.stop()
    this.scene.start(sceneKey, gameData)
  }

  /**
   * Handle job completion (from mini-game or working animation)
   */
  handleJobComplete(result, job) {
    console.log('[OperationsHubScene] Job completed:', result)

    const player = gameManager.player || getPlayerData() || {}
    const basePay = job.base_pay || 50
    const baseXp = job.xp_reward || 10
    const bonusMultiplier = result?.bonusMultiplier || 1

    let cashEarned = 0
    let xpEarned = 0

    if (result?.success !== false) {
      cashEarned = Math.floor(basePay * bonusMultiplier)
      xpEarned = Math.floor(baseXp * bonusMultiplier)

      if (result?.perfectRun) {
        cashEarned = Math.floor(cashEarned * 1.5)
        xpEarned = Math.floor(xpEarned * 1.5)
      }
    } else {
      cashEarned = Math.floor(basePay * 0.2)
      xpEarned = Math.floor(baseXp * 0.3)
    }

    // Apply rewards
    player.cash = (player.cash || 0) + cashEarned
    player.totalEarnings = (player.totalEarnings || 0) + cashEarned
    player.xp = (player.xp || 0) + xpEarned
    player.jobs_completed = (player.jobs_completed || 0) + 1

    // Deduct energy
    const energyCost = job.energy_cost || job.stamina_cost || 10
    player.energy = Math.max(0, (player.energy || 100) - energyCost)

    // Check for level up
    const oldLevel = player.level || 1
    const newLevel = Math.floor(Math.sqrt((player.xp || 0) / 100)) + 1

    if (newLevel > oldLevel) {
      player.level = newLevel
      networkMessageManager.createSystemMessage(
        `LEVEL ${newLevel} ACHIEVED`,
        `Your work ethic has paid off. New opportunities may be available.`
      )
    }

    // Save
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    // Set cooldown
    const cooldown = (job.duration_seconds || 60) * 1000
    gameManager.setCooldown('job', cooldown)
  }

  /**
   * Execute a crime directly with mini-game support
   */
  executeCrime(crime) {
    console.log('[OperationsHubScene] Executing crime:', crime.name)

    // Check cooldown
    if (gameManager.isOnCooldown('crime')) {
      if (this.statsBar) {
        this.statsBar.showCooldownWarning()
      }
      audioManager.playMiss()
      return
    }

    const player = gameManager.player || getPlayerData() || {}
    const playerEnergy = player.energy || 100
    const energyCost = crime.energy_cost || 10

    if (playerEnergy < energyCost) {
      if (this.statsBar) {
        this.statsBar.showWarning(`Need ${energyCost} energy (have ${Math.floor(playerEnergy)})`)
      }
      audioManager.playMiss()
      return
    }

    // Check for mini-game
    const mapping = getCrimeMapping(crime.id)
    console.log(`[OperationsHubScene] Crime ${crime.id} - mapping:`, mapping ? 'found' : 'NOT FOUND', ', has_minigame:', crime.has_minigame)

    if (mapping) {
      this.launchCrimeMiniGame(crime, mapping)
    } else {
      console.warn(`[OperationsHubScene] No mini-game mapping for crime: ${crime.id}, using working animation`)
      this.showWorkingAnimation(crime, 'crime')
    }
  }

  /**
   * Launch mini-game for a crime
   */
  launchCrimeMiniGame(crime, mapping) {
    console.log(`[OperationsHubScene] Launching crime mini-game: ${crime.id}`)

    const playerLevel = gameManager.player?.level || 1
    const baseDifficulty = mapping.difficulty || 1
    const difficulty = Math.min(5, baseDifficulty + Math.floor(playerLevel / 10))

    const gameData = {
      crimeId: crime.id,
      crimeName: crime.name,
      gameType: mapping.gameType,
      difficulty,
      timeLimit: mapping.timeLimit,
      targetScore: mapping.targetScore,
      perfectScore: mapping.perfectScore,
      theme: mapping.theme,
      returnScene: 'OperationsHubScene',
      returnData: {
        tab: 'crime',
        itemType: 'crime',
        itemData: crime  // Pass crime data for reward processing
      },
      isCrime: true,
      crimeData: crime,
      // Note: onComplete callback won't work since scene is stopped
      // Rewards are processed in OperationsHubScene.init() using miniGameResult
      difficultyTier: { name: crime.tier || 'petty', color: '#ef4444' },
      rewardMultiplier: 1 + (playerLevel * 0.05),
      baseCashReward: crime.max_payout || 100,
      baseXpReward: crime.xp_reward || 10
    }

    const sceneKey = getSceneKeyForCrime(mapping.gameType)

    if (!this.scene.get(sceneKey)) {
      console.error(`[OperationsHubScene] Mini-game scene not found: ${sceneKey}`)
      this.showWorkingAnimation(crime, 'crime')
      return
    }

    this.pendingItem = crime
    this.pendingType = 'crime'

    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    console.log(`[OperationsHubScene] Starting mini-game: ${sceneKey}`)
    this.scene.stop()
    this.scene.start(sceneKey, gameData)
  }

  /**
   * Handle crime completion
   */
  handleCrimeComplete(result, crime) {
    console.log('[OperationsHubScene] Crime completed:', result)

    const player = gameManager.player || getPlayerData() || {}
    const successRate = crime.base_success_rate || 70
    const bonusMultiplier = result?.bonusMultiplier || 1

    let cashEarned = 0
    let xpEarned = 0
    let heatGained = 0

    // Determine success
    const isSuccess = result?.success !== false && (result?.success || Math.random() * 100 < successRate * bonusMultiplier)

    if (isSuccess) {
      const minPay = crime.min_payout || 20
      const maxPay = crime.max_payout || 100
      cashEarned = Math.floor((minPay + Math.random() * (maxPay - minPay)) * bonusMultiplier)
      xpEarned = Math.floor((crime.xp_reward || 10) * bonusMultiplier)
      heatGained = crime.heat_gain || 5

      if (result?.perfectRun) {
        cashEarned = Math.floor(cashEarned * 1.5)
        xpEarned = Math.floor(xpEarned * 1.5)
        heatGained = Math.floor(heatGained * 0.7)
      }
    } else {
      xpEarned = Math.floor((crime.xp_reward || 10) * 0.2)
      heatGained = Math.floor((crime.heat_gain || 5) * 1.5)
    }

    // Apply rewards
    player.cash = (player.cash || 0) + cashEarned
    player.totalEarnings = (player.totalEarnings || 0) + cashEarned
    player.xp = (player.xp || 0) + xpEarned
    player.heat = Math.min(100, (player.heat || 0) + heatGained)
    player.crimes_committed = (player.crimes_committed || 0) + 1

    // Deduct energy
    const energyCost = crime.energy_cost || 10
    player.energy = Math.max(0, (player.energy || 100) - energyCost)

    // Check level up
    const oldLevel = player.level || 1
    const newLevel = Math.floor(Math.sqrt((player.xp || 0) / 100)) + 1
    if (newLevel > oldLevel) {
      player.level = newLevel
    }

    // Save
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    // Set cooldown
    gameManager.setCooldown('crime', 30000)
  }

  /**
   * Process mini-game result when returning from a mini-game
   * This is called instead of the onComplete callback since the scene was stopped
   */
  processMiniGameResult() {
    console.log('[OperationsHubScene] Processing mini-game result')
    console.log('[OperationsHubScene] Result:', this.miniGameResult)
    console.log('[OperationsHubScene] Item type:', this.returnedItemType)
    console.log('[OperationsHubScene] Item data:', this.returnedItemData)

    const result = this.miniGameResult
    const itemType = this.returnedItemType
    const itemData = this.returnedItemData

    if (!result || !itemData) {
      console.warn('[OperationsHubScene] Missing result or item data')
      return
    }

    // Apply rewards based on item type
    if (itemType === 'job') {
      this.handleJobComplete(result, itemData)
    } else if (itemType === 'crime') {
      this.handleCrimeComplete(result, itemData)
    }

    // Show result overlay
    this.showMiniGameResultOverlay(result, itemType, itemData)

    // Clear the stored data
    this.miniGameResult = null
    this.returnedItemType = null
    this.returnedItemData = null
    this.returningFromMiniGame = false
  }

  /**
   * Show a result overlay after mini-game completion
   */
  showMiniGameResultOverlay(result, itemType, itemData) {
    const { width, height } = this.cameras.main
    const success = result.success !== false

    // Clear content first
    this.clearContent()

    // Create overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(DEPTH.CLOSE_BUTTON + 20)
      .setInteractive()
    this.contentItems.push(overlay)

    // Result panel
    const panelColor = success ? COLORS.network.primary : COLORS.status.danger
    const panelBg = this.add.rectangle(width / 2, height / 2, 320, 280, COLORS.bg.panel, 0.98)
      .setStrokeStyle(3, panelColor, 0.9)
      .setDepth(DEPTH.CLOSE_BUTTON + 21)
    this.contentItems.push(panelBg)

    // Result icon
    const icon = success ? (result.perfectRun ? '💎' : '✓') : '✗'
    const iconColor = success ? (result.perfectRun ? '#ffd700' : toHexString(COLORS.network.primary)) : toHexString(COLORS.status.danger)
    const iconText = this.add.text(width / 2, height / 2 - 90, icon, {
      fontSize: '48px',
      color: iconColor
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
    this.contentItems.push(iconText)

    // Title
    const titleText = success
      ? (result.perfectRun ? 'PERFECT!' : 'SUCCESS!')
      : 'FAILED'
    const title = this.add.text(width / 2, height / 2 - 40, `${SYMBOLS.system} ${titleText}`, {
      ...getTerminalStyle('xl'),
      color: iconColor
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
    this.contentItems.push(title)

    // Item name
    const itemName = this.add.text(width / 2, height / 2 - 10, itemData.name, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
    this.contentItems.push(itemName)

    // Stats
    let yPos = height / 2 + 25
    const statsStyle = { ...getTerminalStyle('md'), color: toHexString(COLORS.text.primary) }

    // Score
    const scoreText = this.add.text(width / 2, yPos, `Score: ${result.score || 0}`, statsStyle)
      .setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
    this.contentItems.push(scoreText)
    yPos += 28

    // Cash earned (calculate based on result)
    const basePay = itemType === 'job' ? (itemData.base_pay || 50) : (itemData.max_payout || 100)
    const cashEarned = success ? Math.floor(basePay * (result.bonusMultiplier || 1)) : 0
    const cashText = this.add.text(width / 2, yPos, `💵 $${cashEarned.toLocaleString()}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
    this.contentItems.push(cashText)
    yPos += 28

    // XP earned
    const baseXp = itemData.xp_reward || 10
    const xpEarned = success ? Math.floor(baseXp * (result.bonusMultiplier || 1)) : Math.floor(baseXp * 0.2)
    const xpText = this.add.text(width / 2, yPos, `⚡ +${xpEarned} XP`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.status.warning)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
    this.contentItems.push(xpText)

    // Continue button
    const continueBtn = this.add.text(width / 2, height / 2 + 110, `[ ${SYMBOLS.forward} CONTINUE ]`, {
      ...getTerminalStyle('lg'),
      color: toHexString(panelColor)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 22)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(continueBtn)

    continueBtn.on('pointerover', () => {
      continueBtn.setColor(toHexString(COLORS.network.glow))
    })
    continueBtn.on('pointerout', () => {
      continueBtn.setColor(toHexString(panelColor))
    })
    continueBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.clearContent()
      this.loadContent()
    })

    // Also close on overlay click
    overlay.on('pointerdown', () => {
      audioManager.playClick()
      this.clearContent()
      this.loadContent()
    })

    // Play sound
    if (success) {
      if (result.perfectRun) {
        audioManager.playPerfect()
      } else {
        audioManager.playCashGain(cashEarned)
      }
    } else {
      audioManager.playMiss()
    }
  }

  /**
   * Execute a heist - still goes to HeistsScene for planning (heists are complex)
   */
  executeHeist(heist) {
    console.log('[OperationsHubScene] Launching heist planning:', heist.name)

    // Heists require planning, so we still use the separate scene
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    try {
      this.scene.resume('UIScene')
    } catch (e) {}

    this.scene.start('HeistsScene', { selectedItem: heist })
  }

  /**
   * Show working animation for jobs/crimes without mini-games
   */
  showWorkingAnimation(item, type) {
    const { width, height } = this.cameras.main

    // Clear all existing content to prevent interference
    this.clearContent()

    // Create overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setDepth(DEPTH.CLOSE_BUTTON + 10)
    this.contentItems.push(overlay)

    const workingBg = this.add.rectangle(width / 2, height / 2, 300, 150, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, COLORS.network.primary, 0.5)
      .setDepth(DEPTH.CLOSE_BUTTON + 11)
    this.contentItems.push(workingBg)

    const actionText = type === 'job' ? 'EXECUTING CONTRACT...' : 'COMMITTING CRIME...'
    const workingText = this.add.text(width / 2, height / 2 - 20, `${SYMBOLS.system} ${actionText}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 12)
    this.contentItems.push(workingText)

    const progressBg = this.add.rectangle(width / 2, height / 2 + 30, 200, 20, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.network.dim, 0.5)
      .setDepth(DEPTH.CLOSE_BUTTON + 11)
    this.contentItems.push(progressBg)

    const progressBar = this.add.rectangle(width / 2 - 100, height / 2 + 30, 0, 20, COLORS.network.primary)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.CLOSE_BUTTON + 12)
    this.contentItems.push(progressBar)

    // Animate progress
    this.tweens.add({
      targets: progressBar,
      width: 200,
      duration: 1500,
      ease: 'Linear',
      onComplete: () => {
        if (type === 'job') {
          this.completeJobAnimation(item, workingText, progressBg, progressBar, overlay, workingBg)
        } else {
          this.completeCrimeAnimation(item, workingText, progressBg, progressBar, overlay, workingBg)
        }
      }
    })
  }

  /**
   * Complete job animation and show results
   */
  completeJobAnimation(job, workingText, progressBg, progressBar, overlay, workingBg) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Execute job
    const basePay = job.base_pay || 50
    const timeAdjusted = applyTimeModifierToJob ? applyTimeModifierToJob(basePay) : { adjustedPay: basePay }
    const levelBonus = Math.floor((player.level || 1) * 5)
    const cashEarned = Math.floor(timeAdjusted.adjustedPay * (1 + levelBonus / 100))
    const xpEarned = job.xp_reward || Math.floor(basePay * 0.2)

    // Apply rewards
    this.handleJobComplete({ success: true, bonusMultiplier: 1 }, job)

    // Play sound
    audioManager.playCashGain(cashEarned)

    // Update UI
    workingText.setText(`${SYMBOLS.check} CONTRACT COMPLETE`)
    progressBar.destroy()
    progressBg.destroy()

    notificationManager.setScene(this)

    const earnedText = this.add.text(width / 2, height / 2 + 20, `EARNED ${formatMoney(cashEarned)}`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.gold)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 12)
    this.contentItems.push(earnedText)

    notificationManager.showCashGain(width / 2 - 30, height / 2 - 10, cashEarned)
    this.time.delayedCall(200, () => {
      notificationManager.showXPGain(width / 2 + 30, height / 2 - 10, xpEarned)
    })

    // Auto-reload after delay
    this.time.delayedCall(2000, () => {
      this.loadContent()
    })
  }

  /**
   * Complete crime animation and show results
   */
  completeCrimeAnimation(crime, workingText, progressBg, progressBar, overlay, workingBg) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Determine success
    const successRate = crime.base_success_rate || 70
    const isSuccess = Math.random() * 100 < successRate

    let cashEarned = 0
    let heatGained = crime.heat_gain || 5

    if (isSuccess) {
      const minPay = crime.min_payout || 20
      const maxPay = crime.max_payout || 100
      cashEarned = Math.floor(minPay + Math.random() * (maxPay - minPay))
      this.handleCrimeComplete({ success: true, bonusMultiplier: 1 }, crime)
      audioManager.playCashGain(cashEarned)
      workingText.setText(`${SYMBOLS.check} CRIME SUCCESSFUL`)
    } else {
      this.handleCrimeComplete({ success: false }, crime)
      audioManager.playMiss()
      workingText.setText(`${SYMBOLS.close} CRIME FAILED`)
      workingText.setColor('#EF4444')
    }

    progressBar.destroy()
    progressBg.destroy()

    notificationManager.setScene(this)

    if (isSuccess) {
      const earnedText = this.add.text(width / 2, height / 2 + 20, `SCORED ${formatMoney(cashEarned)}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.gold)
      }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 12)
      this.contentItems.push(earnedText)

      notificationManager.showCashGain(width / 2, height / 2 - 10, cashEarned)
    } else {
      const failText = this.add.text(width / 2, height / 2 + 20, `+${heatGained} HEAT`, {
        ...getTerminalStyle('md'),
        color: '#EF4444'
      }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON + 12)
      this.contentItems.push(failText)
    }

    // Auto-reload
    this.time.delayedCall(2000, () => {
      this.loadContent()
    })
  }

  closeScene() {
    console.log('[OperationsHubScene] closeScene() called')

    // Clean up stats bar
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    const returnScene = this.initData?.returnScene || 'GameScene'
    console.log('[OperationsHubScene] Returning to:', returnScene)

    // CRITICAL: Proper order to prevent input conflicts
    // 1. Disable input on THIS scene first
    this.input.enabled = false
    console.log('[OperationsHubScene] Disabled input on hub scene')

    // 2. Re-enable input on the RETURN scene BEFORE resuming
    try {
      const gameScene = this.scene.get(returnScene)
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[OperationsHubScene] Re-enabled input on:', returnScene)
      }
    } catch (e) {
      console.error('[OperationsHubScene] Failed to re-enable input:', e)
    }

    // 3. Bring return scene to TOP of scene stack (for input priority)
    try {
      this.scene.bringToTop(returnScene)
      console.log('[OperationsHubScene] Brought to top:', returnScene)
    } catch (e) {
      console.error('[OperationsHubScene] Failed to bring to top:', e)
    }

    // 4. Resume the return scene
    try {
      this.scene.resume(returnScene)
      console.log('[OperationsHubScene] Resumed:', returnScene)
    } catch (e) {
      console.error('[OperationsHubScene] Failed to resume return scene:', e)
    }

    // 4. Resume UIScene
    this.readiness.resumeUIScene()

    // 5. Stop THIS scene LAST
    this.scene.stop()
    console.log('[OperationsHubScene] Scene stopped')
  }

  shutdown() {
    console.log('[OperationsHubScene] shutdown() called')

    // Safety net: always try to resume UIScene on shutdown
    try {
      this.scene.resume('UIScene')
    } catch (e) {
      // Ignore errors - scene may already be active
    }

    super.shutdown()
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }
    this.contentItems = []
    this.tabButtons = []
  }
}

export default OperationsHubScene
