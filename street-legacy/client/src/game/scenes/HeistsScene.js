import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
import {
  HEISTS,
  getPlayerData,
  savePlayerData,
  HEIST_PLANNING_CONFIG,
  getHeistPlanning,
  performPlanningActivity,
  getHeistPlanningStatus,
  clearHeistPlanning,
  isPlanningValid,
  generatePlayerNews,
  checkHeistRequirements,
  getTimeOfDay
} from '../data/GameData.js'
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * HeistsScene - Solo heist planning and execution (Local Data Mode)
 *
 * Features:
 * - View available heists
 * - Execute solo heists
 * - Level-gated progression
 */
export class HeistsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HeistsScene' })
    this.heists = []
    this.activeHeist = null
    this.selectedHeist = null
    this.refreshInterval = null
    this.planningHeist = null  // Currently planning heist
    this.planningCooldowns = {} // Activity cooldowns
  }

  async create() {
    console.log('[HeistsScene] create() started')
    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top of scene stack for input priority
    // This ensures HeistsScene receives input, not GameScene below
    this.scene.bringToTop()
    console.log('[HeistsScene] Brought self to top of scene stack')

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
        console.log('[HeistsScene] Disabled GameScene input')
      }
    } catch (e) {
      console.log('[HeistsScene] Could not access GameScene:', e.message)
    }

    // FULL opaque background - covers everything underneath
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1).setOrigin(0).setDepth(100).setInteractive()

    // Header
    this.add.text(width / 2, 40, '[M] MAJOR OPS', {
      ...getTerminalStyle('display'),
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(width / 2, 75, `${SYMBOLS.system} High-risk coordinated operations`, {
      ...getTextStyle('md', COLORS.text.secondary),
    }).setOrigin(0.5)

    // Close button
    this.createCloseButton()

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2, 'Loading operations...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5)

    // Load heist data - use local data
    try {
      await this.loadHeistData()
      this.loadingText.destroy()
      this.createUI()
    } catch (error) {
      console.error('Failed to load heists:', error)
      this.loadingText.setText('Failed to load heists')
    }
  }

  async loadHeistData() {
    const player = gameManager.player || getPlayerData()
    const playerLevel = player.level || 1

    // Load crew bonuses for heist modifiers
    try {
      this.crewBonuses = await gameManager.getCrewBonuses()
    } catch (e) {
      this.crewBonuses = { violence: 0, cooldown: 0, escape: 0, heat: 0, vehicle: 0, intimidation: 0, intel: 0 }
    }

    // Use local HEISTS data
    this.heists = HEISTS.map(heist => ({
      ...heist,
      canStart: playerLevel >= heist.min_level,
      hasCrew: true, // Solo mode - always has "crew"
      minLevel: heist.min_level,
      minCrewSize: heist.min_crew,
      maxCrewSize: heist.max_crew,
      minPayout: heist.min_payout,
      maxPayout: heist.max_payout,
      baseSuccessRate: heist.success_rate,
      heatGenerated: heist.heat_gain,
      planningHours: 0 // No planning in local mode
    }))
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTextStyle('display', COLORS.text.primary),
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.status.warning))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.primary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[HeistsScene] Close button clicked')
      this.closeScene()
    })
  }

  createUI() {
    // Solo mode - always show heist list
    this.showHeistList()
  }

  /**
   * Show heist planning screen with activities
   */
  showHeistPlanning(heist) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    this.planningHeist = heist
    this.children.removeAll()

    // Full background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1).setOrigin(0).setDepth(100)

    // Header
    this.add.text(width / 2, 35, `[P] PLANNING: ${heist.name.toUpperCase()}`, {
      ...getTerminalStyle('lg'),
    }).setOrigin(0.5)

    // Get planning status
    const planningStatus = getHeistPlanningStatus(player, heist.id, heist.difficulty || 1)
    const minRequired = planningStatus.minRequired

    // Progress bar
    const progY = 70
    this.add.rectangle(width / 2, progY, width - 80, 25, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x444444)

    const progressPct = minRequired > 0
      ? Math.min(1, planningStatus.activitiesCompleted / minRequired)
      : 1
    const progFill = this.add.rectangle(45, progY, (width - 90) * progressPct, 20, 0x8b5cf6, 0.8)
      .setOrigin(0, 0.5)

    // Progress text
    const progressText = minRequired > 0
      ? `${planningStatus.activitiesCompleted}/${minRequired} required activities`
      : 'Optional planning (any activity helps)'
    this.add.text(width / 2, progY, progressText, {
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5)

    // Bonuses summary
    const bonusY = 100
    this.add.text(30, bonusY, 'CURRENT BONUSES:', {
      ...getTextStyle('xs', COLORS.text.muted),
    })

    const bonuses = planningStatus.bonuses
    this.add.text(width / 2 - 60, bonusY, `⚡+${bonuses.successBonus}%`, {
      fontSize: '10px',
      color: bonuses.successBonus > 0 ? '#4ade80' : '#666666'
    })
    this.add.text(width / 2 + 10, bonusY, `🔥-${bonuses.heatReduction}%`, {
      fontSize: '10px',
      color: bonuses.heatReduction > 0 ? '#22d3ee' : '#666666'
    })
    this.add.text(width / 2 + 80, bonusY, `🚗+${bonuses.escapeBonus}%`, {
      fontSize: '10px',
      color: bonuses.escapeBonus > 0 ? '#fbbf24' : '#666666'
    })

    // Activities list
    const startY = 130
    const activityHeight = 70

    this.add.text(30, startY - 15, '>> PLANNING ACTIVITIES', {
      ...getTextStyle('md', COLORS.status.warning, 'terminal'),
    })

    HEIST_PLANNING_CONFIG.activities.forEach((activity, index) => {
      const y = startY + 10 + index * activityHeight
      this.createPlanningActivityCard(activity, heist, y, activityHeight - 5)
    })

    // Energy display
    this.add.text(30, height - 95, `⚡ Energy: ${player.energy || 0}/${100}`, {
      fontSize: '12px',
      color: (player.energy || 0) >= 10 ? '#ffffff' : '#ef4444'
    })

    // Cash display
    this.add.text(width - 120, height - 95, `💵 ${formatMoney(player.cash || 0)}`, {
      fontSize: '12px',
      color: '#22c55e'
    })

    // Back button
    const backBtn = this.add.rectangle(100, height - 50, 130, 40, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x666666)
      .setInteractive({ useHandCursor: true })
    this.add.text(100, height - 50, '← BACK', {
      ...getTextStyle('md', COLORS.text.primary),
    }).setOrigin(0.5)

    backBtn.on('pointerover', () => backBtn.setFillStyle(0x444444))
    backBtn.on('pointerout', () => backBtn.setFillStyle(COLORS.bg.panel))
    backBtn.on('pointerdown', () => {
      this.planningHeist = null
      this.children.removeAll()
      this.createCloseButton()
      this.createUI()
    })

    // Execute button (if meets requirements)
    if (planningStatus.meetsMinimum) {
      const execBtn = this.add.rectangle(width - 100, height - 50, 140, 40, 0x22c55e, 0.9)
        .setStrokeStyle(1, 0x16a34a)
        .setInteractive({ useHandCursor: true })
      this.add.text(width - 100, height - 50, '⚡ EXECUTE!', {
        fontSize: '14px',
        color: '#000000',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      execBtn.on('pointerover', () => execBtn.setFillStyle(0x16a34a))
      execBtn.on('pointerout', () => execBtn.setFillStyle(0x22c55e))
      execBtn.on('pointerdown', () => {
        this.executeHeistLocal(heist)
      })
    } else {
      // Show locked indicator
      this.add.rectangle(width - 100, height - 50, 140, 40, COLORS.bg.panel, 0.5)
        .setStrokeStyle(1, 0x333333)
      this.add.text(width - 100, height - 50, `🔒 PLAN MORE`, {
        fontSize: '12px',
        color: '#666666'
      }).setOrigin(0.5)
    }

    // Close button
    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTextStyle('display', COLORS.text.primary),
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => closeBtn.setColor(toHexString(COLORS.status.warning)))
    closeBtn.on('pointerout', () => closeBtn.setColor(toHexString(COLORS.text.primary)))
    closeBtn.on('pointerdown', () => this.closeScene())
  }

  /**
   * Create a planning activity card
   */
  createPlanningActivityCard(activity, heist, y, cardHeight) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Get current level for this activity
    const planning = getHeistPlanning(player, heist.id)
    const currentLevel = planning.activities[activity.id] || 0
    const isMaxed = currentLevel >= activity.maxLevel
    const hasEnergy = (player.energy || 0) >= activity.energyCost
    const hasCash = !activity.cashCost || (player.cash || 0) >= activity.cashCost
    const isOnCooldown = this.planningCooldowns[activity.id] && Date.now() < this.planningCooldowns[activity.id]
    const canPerform = !isMaxed && hasEnergy && hasCash && !isOnCooldown

    // Card background
    const cardBg = canPerform ? 0x1a1a2e : isMaxed ? 0x1a2e1a : 0x1a1a1a
    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 40, cardHeight - 3, cardBg, 0.9)

    // Border color based on state
    const borderColor = isMaxed ? 0x22c55e : canPerform ? 0x8b5cf6 : 0x444444
    card.setStrokeStyle(1, borderColor, isMaxed ? 0.8 : 0.5)

    if (canPerform) {
      card.setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(0x2a2a4e)
        card.setStrokeStyle(2, 0x8b5cf6, 0.8)
      })
      card.on('pointerout', () => {
        card.setFillStyle(0x1a1a2e)
        card.setStrokeStyle(1, 0x8b5cf6, 0.5)
      })
      card.on('pointerdown', () => {
        this.performActivity(activity, heist)
      })
    }

    // Activity icon
    this.add.text(35, y + 12, activity.icon, {
      fontSize: '18px'
    })

    // Activity name
    this.add.text(60, y + 10, activity.name, {
      fontSize: '13px',
      color: canPerform ? '#ffffff' : isMaxed ? '#4ade80' : '#666666',
      fontStyle: canPerform || isMaxed ? 'bold' : 'normal'
    })

    // Level indicator
    const levelText = isMaxed ? '✓ MAX' : `${currentLevel}/${activity.maxLevel}`
    this.add.text(width - 55, y + 10, levelText, {
      fontSize: '10px',
      color: isMaxed ? '#4ade80' : '#a78bfa'
    }).setOrigin(0.5)

    // Description
    this.add.text(35, y + 28, activity.description, {
      fontSize: '9px',
      color: '#888888',
      wordWrap: { width: width - 120 }
    })

    // Bottom row: costs and bonuses
    const bottomY = y + cardHeight - 12
    let xPos = 35

    // Energy cost
    const energyColor = hasEnergy ? '#fbbf24' : '#ef4444'
    this.add.text(xPos, bottomY, `⚡${activity.energyCost}`, {
      fontSize: '9px',
      color: energyColor
    })
    xPos += 35

    // Cash cost if any
    if (activity.cashCost) {
      const cashColor = hasCash ? '#22c55e' : '#ef4444'
      this.add.text(xPos, bottomY, `💵${formatMoney(activity.cashCost)}`, {
        fontSize: '9px',
        color: cashColor
      })
      xPos += 55
    }

    // Duration
    this.add.text(xPos, bottomY, `⏱${activity.duration}s`, {
      fontSize: '9px',
      color: '#888888'
    })

    // Bonuses on right side
    const bonusX = width - 100
    if (activity.bonuses.successBonus > 0) {
      this.add.text(bonusX, bottomY, `+${activity.bonuses.successBonus}%📈`, {
        fontSize: '9px',
        color: '#4ade80'
      })
    }
    if (activity.bonuses.heatReduction > 0) {
      this.add.text(bonusX + 40, bottomY, `-${activity.bonuses.heatReduction}%🔥`, {
        fontSize: '9px',
        color: '#22d3ee'
      })
    }
    if (activity.bonuses.escapeBonus > 0) {
      this.add.text(bonusX + 40, bottomY, `+${activity.bonuses.escapeBonus}%🚗`, {
        fontSize: '9px',
        color: '#fbbf24'
      })
    }
  }

  /**
   * Perform a planning activity (server-first with offline fallback)
   */
  async performActivity(activity, heist) {
    const { width, height } = this.cameras.main

    try {
      // Use GameManager's server-first approach
      const result = await gameManager.performHeistActivity(heist.id, activity.id)

      if (result.success !== false) {
        // Set cooldown
        this.planningCooldowns[activity.id] = Date.now() + (activity.duration * 1000)

        // Track activity stats for achievements
        const player = gameManager.player || getPlayerData()
        if (activity.id === 'scout') {
          player.scout_activities = (player.scout_activities || 0) + 1
        } else if (activity.id === 'intel') {
          player.intel_activities = (player.intel_activities || 0) + 1
        }
        savePlayerData(player)

        // Play sound
        try {
          audioManager.playClick()
        } catch (e) {}

        // Show feedback
        const message = result.message || 'Activity completed!'
        const feedback = this.add.text(width / 2, height / 2, message, {
          fontSize: '16px',
          color: '#4ade80',
          backgroundColor: '#000000aa',
          padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(1000)

        this.tweens.add({
          targets: feedback,
          alpha: 0,
          y: height / 2 - 50,
          duration: 1500,
          onComplete: () => feedback.destroy()
        })

        // Refresh the planning UI
        this.time.delayedCall(100, () => {
          this.showHeistPlanning(heist)
        })
      } else {
        // Show error
        const error = this.add.text(width / 2, height / 2, result.message || 'Activity failed', {
          fontSize: '14px',
          color: '#ef4444',
          backgroundColor: '#000000aa',
          padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(1000)

        this.tweens.add({
          targets: error,
          alpha: 0,
          duration: 2000,
          onComplete: () => error.destroy()
        })
      }
    } catch (error) {
      // Show error
      const errorText = this.add.text(width / 2, height / 2, error.message || 'Activity failed', {
        fontSize: '14px',
        color: '#ef4444',
        backgroundColor: '#000000aa',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setDepth(1000)

      this.tweens.add({
        targets: errorText,
        alpha: 0,
        duration: 2000,
        onComplete: () => errorText.destroy()
      })
    }
  }

  showHeistList() {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const startY = 120
    const cardHeight = 90
    const cardSpacing = 8

    // Section header
    this.add.text(50, startY - 20, '>> AVAILABLE OPS (SOLO MODE)', {
      ...getTextStyle('lg', COLORS.status.warning, 'terminal'),
    })

    if (this.heists.length === 0) {
      this.add.text(width / 2, height / 2, 'No operations available', {
        fontSize: '16px',
        color: '#666666'
      }).setOrigin(0.5)
      return
    }

    this.heistCards = []

    this.heists.forEach((heist, index) => {
      if (startY + index * (cardHeight + cardSpacing) > height - 60) return
      const y = startY + index * (cardHeight + cardSpacing)
      this.createHeistCard(heist, y, cardHeight)
    })
  }

  createHeistCard(heist, y, cardHeight) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const levelOk = heist.canStart

    // Check special requirements (night_only, hacker, etc.)
    const reqCheck = checkHeistRequirements(player, heist)
    const canStart = levelOk && reqCheck.canStart

    // Difficulty-based colors
    const difficultyColors = {
      1: { bg: 0x1e3a2e, border: 0x22c55e, name: 'Easy' },
      2: { bg: 0x1e2a3e, border: 0x3b82f6, name: 'Medium' },
      3: { bg: 0x2e2a1e, border: 0xf59e0b, name: 'Hard' },
      4: { bg: 0x3e2a1e, border: 0xf97316, name: 'Very Hard' },
      5: { bg: 0x3e1e2e, border: 0xef4444, name: 'Extreme' },
      6: { bg: 0x3e1e3e, border: 0xdc2626, name: 'Brutal' },
      7: { bg: 0x2e1e3e, border: 0x9333ea, name: 'Insane' },
      8: { bg: 0x1e1e3e, border: 0x7c3aed, name: 'Nightmare' },
      10: { bg: 0x0e0e1e, border: 0xffd700, name: 'LEGENDARY' }
    }

    const difficulty = heist.difficulty || 1
    const colors = difficultyColors[difficulty] || difficultyColors[1]

    // Card background with difficulty-based styling
    const cardBg = canStart ? colors.bg : COLORS.bg.panel
    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 40, cardHeight - 5, cardBg, canStart ? 0.95 : 0.6)

    // Left accent bar showing difficulty
    const accentBar = this.add.rectangle(28, y + cardHeight / 2, 4, cardHeight - 15, canStart ? colors.border : 0x444444)

    if (canStart) {
      card.setStrokeStyle(1, colors.border, 0.4)
        .setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(Phaser.Display.Color.ValueToColor(colors.bg).lighten(15).color, 1)
        card.setStrokeStyle(2, colors.border, 0.7)
        accentBar.setFillStyle(Phaser.Display.Color.ValueToColor(colors.border).lighten(20).color)
        this.tweens.add({
          targets: card,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 80
        })
      })

      card.on('pointerout', () => {
        card.setFillStyle(colors.bg, 0.95)
        card.setStrokeStyle(1, colors.border, 0.4)
        accentBar.setFillStyle(colors.border)
        this.tweens.add({
          targets: card,
          scaleX: 1,
          scaleY: 1,
          duration: 80
        })
      })

      card.on('pointerdown', () => {
        this.tweens.add({
          targets: card,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          onComplete: () => this.executeHeistLocal(heist)
        })
      })
    } else {
      card.setStrokeStyle(1, 0x333333, 0.3)
    }

    // Heist icon - terminal style
    const heistIcons = {
      'convenience': '[S]',     // Store
      'pawn_shop': '[P]',       // Pawn
      'jewelry': '[J]',         // Jewelry
      'electronics': '[E]',     // Electronics
      'mansion': '[M]',         // Mansion
      'warehouse': '[W]',       // Warehouse
      'train': '[T]',           // Train
      'armored': '[A]',         // Armored
      'museum': '[U]',          // Museum
      'diamond_exchange': '[D]', // Diamond
      'bank': '[B]',            // Bank
      'casino': '[C]',          // Casino
      'penthouse': '[P]',       // Penthouse
      'yacht': '[Y]',           // Yacht
      'gold_reserve': '[G]',    // Gold
      'federal_reserve': '[!]'  // The Big One
    }
    const icon = heistIcons[heist.id] || '[H]'
    this.add.text(42, y + 18, icon, {
      ...getTextStyle('md', COLORS.status.warning, 'terminal'),
    }).setAlpha(canStart ? 0.9 : 0.4)

    // Heist name with styling
    this.add.text(65, y + 14, heist.name, {
      fontSize: '15px',
      color: canStart ? '#ffffff' : '#555555',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    })

    // Difficulty badge
    const diffBadgeWidth = 55
    this.add.rectangle(65 + diffBadgeWidth / 2, y + 34, diffBadgeWidth, 16, colors.border, 0.2)
      .setStrokeStyle(1, colors.border, 0.4)
    this.add.text(65 + diffBadgeWidth / 2, y + 34, colors.name, {
      fontSize: '9px',
      color: canStart ? '#ffffff' : '#555555'
    }).setOrigin(0.5)

    // Description
    this.add.text(42, y + 50, heist.description || 'High-stakes operation', {
      fontSize: '10px',
      color: canStart ? '#999999' : '#444444',
      wordWrap: { width: width - 180 }
    })

    // Requirements & bonuses row (if any)
    if (reqCheck.hasRequirements || reqCheck.hasBonuses) {
      const reqY = y + 65
      let reqX = 42

      // Show unmet requirements in red
      reqCheck.requirements.forEach(req => {
        const reqColor = req.met ? '#4ade80' : '#ef4444'
        const reqIcon = req.met ? '✓' : '✗'
        this.add.text(reqX, reqY, `${req.icon}${reqIcon}`, {
          fontSize: '10px',
          color: reqColor
        })
        reqX += 25
      })

      // Show active bonuses in cyan
      reqCheck.bonuses.forEach(bonus => {
        if (bonus.active) {
          this.add.text(reqX, reqY, `${bonus.icon}+${bonus.value}%`, {
            fontSize: '9px',
            color: '#22d3ee'
          })
          reqX += 35
        }
      })
    }

    // Stats pills at bottom
    const statsY = y + cardHeight - 18
    let statsX = 42

    // Level requirement
    const lvlPillWidth = 45
    const lvlColor = canStart ? 0x22c55e : 0xef4444
    this.add.rectangle(statsX + lvlPillWidth / 2, statsY, lvlPillWidth, 16, lvlColor, 0.15)
      .setStrokeStyle(1, lvlColor, 0.3)
    this.add.text(statsX + lvlPillWidth / 2, statsY, `Lv.${heist.minLevel}`, {
      fontSize: '9px',
      color: canStart ? '#4ade80' : '#ef4444'
    }).setOrigin(0.5)

    statsX += lvlPillWidth + 6

    // Success rate
    const successColor = heist.baseSuccessRate >= 60 ? 0x22c55e : heist.baseSuccessRate >= 40 ? 0xf59e0b : 0xef4444
    const successPillWidth = 50
    this.add.rectangle(statsX + successPillWidth / 2, statsY, successPillWidth, 16, successColor, 0.15)
      .setStrokeStyle(1, successColor, 0.3)
    this.add.text(statsX + successPillWidth / 2, statsY, `${heist.baseSuccessRate}%`, {
      fontSize: '9px',
      color: canStart ? '#ffffff' : '#555555'
    }).setOrigin(0.5)

    statsX += successPillWidth + 6

    // Heat indicator
    const heatPillWidth = 50
    this.add.rectangle(statsX + heatPillWidth / 2, statsY, heatPillWidth, 16, 0xef4444, 0.15)
      .setStrokeStyle(1, 0xef4444, 0.3)
    this.add.text(statsX + heatPillWidth / 2, statsY, `🔥+${heist.heatGenerated}`, {
      fontSize: '9px',
      color: canStart ? '#f87171' : '#555555'
    }).setOrigin(0.5)

    // Right side: Payout display
    const payBg = this.add.rectangle(width - 55, y + 28, 80, 36, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x22c55e, canStart ? 0.5 : 0.2)

    this.add.text(width - 55, y + 18, `${SYMBOLS.cash} REWARD`, {
      ...getTextStyle('xs', canStart ? COLORS.text.muted : COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5)

    this.add.text(width - 55, y + 33, formatMoney(heist.minPayout), {
      fontSize: '11px',
      color: canStart ? '#22c55e' : '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.add.text(width - 55, y + 46, `to ${formatMoney(heist.maxPayout)}`, {
      fontSize: '9px',
      color: canStart ? '#16a34a' : '#333333'
    }).setOrigin(0.5)

    // Get planning status (player already defined at start of function)
    const planningStatus = getHeistPlanningStatus(player, heist.id, difficulty)
    const minPlanning = planningStatus.minRequired

    // Action indicator or lock
    if (canStart) {
      // Show planning requirement if heist needs planning
      if (minPlanning > 0 && !planningStatus.meetsMinimum) {
        // Needs planning - show PLAN button
        const planBadge = this.add.rectangle(width - 55, y + cardHeight - 18, 70, 18, 0x8b5cf6, 0.4)
          .setStrokeStyle(1, 0x8b5cf6, 0.6)
          .setInteractive({ useHandCursor: true })
        const planText = this.add.text(width - 55, y + cardHeight - 18, `📋 PLAN`, {
          ...getTextStyle('xs', COLORS.text.primary, 'terminal'),
        }).setOrigin(0.5)

        // Show progress indicator
        if (planningStatus.activitiesCompleted > 0) {
          this.add.text(width - 55, y + cardHeight - 30, `${planningStatus.activitiesCompleted}/${minPlanning}`, {
            fontSize: '8px',
            color: '#a78bfa'
          }).setOrigin(0.5)
        }

        planBadge.on('pointerdown', (pointer) => {
          pointer.event.stopPropagation()
          this.showHeistPlanning(heist)
        })
      } else if (planningStatus.activitiesCompleted > 0 && planningStatus.meetsMinimum) {
        // Has planning bonuses - show EXECUTE with bonus indicator
        const startBadge = this.add.rectangle(width - 55, y + cardHeight - 18, 70, 18, 0x22c55e, 0.4)
          .setStrokeStyle(1, 0x22c55e, 0.6)
        this.add.text(width - 55, y + cardHeight - 18, `⚡ GO!`, {
          ...getTextStyle('xs', COLORS.text.primary, 'terminal'),
        }).setOrigin(0.5)
        // Show bonus
        this.add.text(width - 55, y + cardHeight - 30, `+${planningStatus.bonuses.successBonus}%`, {
          fontSize: '8px',
          color: '#4ade80'
        }).setOrigin(0.5)
      } else {
        // No planning needed or optional - show START
        const startBadge = this.add.rectangle(width - 55, y + cardHeight - 18, 70, 18, colors.border, 0.3)
          .setStrokeStyle(1, colors.border, 0.5)
        this.add.text(width - 55, y + cardHeight - 18, `${SYMBOLS.transmit} START`, {
          ...getTextStyle('xs', COLORS.text.primary, 'terminal'),
        }).setOrigin(0.5)
      }
    } else {
      // Show what's blocking the heist
      if (!levelOk) {
        // Level requirement not met
        this.add.text(width - 55, y + cardHeight - 18, `${SYMBOLS.locked} Lv.${heist.minLevel}`, {
          ...getTextStyle('xs', COLORS.status.danger, 'terminal'),
        }).setOrigin(0.5)
      } else if (!reqCheck.canStart && reqCheck.requirements.length > 0) {
        // Special requirement not met - show first unmet requirement
        const unmetReq = reqCheck.requirements.find(r => !r.met)
        if (unmetReq) {
          this.add.text(width - 55, y + cardHeight - 18, `${unmetReq.icon} ${unmetReq.name}`, {
            ...getTextStyle('xs', COLORS.status.danger, 'terminal'),
          }).setOrigin(0.5)
        }
      }
    }

    this.heistCards.push(card)
  }

  /**
   * Execute a solo heist (server-first with offline fallback)
   * Uses GameManager.executeSoloHeist which handles the server call
   */
  async executeHeistLocal(heist) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Check special requirements before execution (safety check)
    const reqCheck = checkHeistRequirements(player, heist)
    if (!reqCheck.canStart) {
      // Show error message
      const errorMsg = reqCheck.messages[0] || 'Requirements not met'
      const error = this.add.text(width / 2, height / 2, errorMsg, {
        fontSize: '16px',
        color: '#ef4444',
        backgroundColor: '#000000dd',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setDepth(1000)

      this.tweens.add({
        targets: error,
        alpha: 0,
        duration: 2500,
        onComplete: () => error.destroy()
      })
      return
    }

    // Show execution animation
    this.children.removeAll()

    const executingBg = this.add.rectangle(width / 2, height / 2, width, height, COLORS.bg.void)
    const executingText = this.add.text(width / 2, height / 2 - 30, `>> EXECUTING: ${heist.name.toUpperCase()}...`, {
      ...getTerminalStyle('xxl'),
    }).setOrigin(0.5)

    // Pulse animation
    this.tweens.add({
      targets: executingText,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: 3
    })

    // Wait for animation
    await new Promise(resolve => this.time.delayedCall(2000, resolve))

    try {
      // Execute via GameManager (server-first with offline fallback)
      const result = await gameManager.executeSoloHeist(heist.id)

      executingText.destroy()

      if (result.success) {
        const payout = result.payout || 0

        try {
          audioManager.playCashGain(payout)
        } catch (e) { /* ignore audio errors */ }

        // Generate news for successful heist
        generatePlayerNews('heist_success', {
          district: player.current_district_id || 'Downtown',
          amount: payout,
          target: heist.name
        })

        this.add.text(width / 2, height / 2 - 60, 'HEIST SUCCESSFUL!', {
          fontSize: '28px',
          color: '#22c55e',
          fontFamily: 'Arial Black, Arial'
        }).setOrigin(0.5)

        this.add.text(width / 2, height / 2, `You earned: ${formatMoney(payout)}`, {
          fontSize: '20px',
          color: '#ffffff'
        }).setOrigin(0.5)

        // Show bonus info if applicable
        let yOffset = 35

        // Planning bonus applied
        if (result.planningBonusApplied) {
          this.add.text(width / 2, height / 2 + yOffset, `📋 Planning bonus applied`, {
            fontSize: '12px',
            color: '#a78bfa'
          }).setOrigin(0.5)
          yOffset += 18
        }

        // Sync status indicator
        if (result.syncStatus === 'pending') {
          this.add.text(width / 2, height / 2 + yOffset, `⏳ Pending sync`, {
            fontSize: '12px',
            color: '#f59e0b'
          }).setOrigin(0.5)
          yOffset += 18
        }

        // Heat display
        if (result.heatGained !== undefined) {
          this.add.text(width / 2, height / 2 + yOffset, `Heat: +${result.heatGained}`, {
            fontSize: '14px',
            color: '#ef4444'
          }).setOrigin(0.5)
        }
      } else {
        // Generate news for failed heist
        generatePlayerNews('heist_fail', {
          district: player.current_district_id || 'Downtown',
          target: heist.name
        })

        this.add.text(width / 2, height / 2 - 40, 'HEIST FAILED', {
          fontSize: '28px',
          color: '#ef4444',
          fontFamily: 'Arial Black, Arial'
        }).setOrigin(0.5)

        this.add.text(width / 2, height / 2 + 10, result.message || 'The operation went wrong!', {
          fontSize: '16px',
          color: '#aaaaaa'
        }).setOrigin(0.5)

        // Heat display
        if (result.heatGained !== undefined) {
          this.add.text(width / 2, height / 2 + 45, `Heat: +${result.heatGained}`, {
            fontSize: '14px',
            color: '#ef4444'
          }).setOrigin(0.5)
        }

        // Sync status indicator
        if (result.syncStatus === 'pending') {
          this.add.text(width / 2, height / 2 + 70, `⏳ Pending sync`, {
            fontSize: '12px',
            color: '#f59e0b'
          }).setOrigin(0.5)
        }
      }

      // Close button after results
      this.time.delayedCall(3000, () => {
        this.closeScene()
      })
    } catch (error) {
      // Error executing heist
      executingText.destroy()

      this.add.text(width / 2, height / 2 - 40, 'HEIST ERROR', {
        fontSize: '28px',
        color: '#ef4444',
        fontFamily: 'Arial Black, Arial'
      }).setOrigin(0.5)

      this.add.text(width / 2, height / 2 + 10, error.message || 'Something went wrong', {
        fontSize: '16px',
        color: '#aaaaaa'
      }).setOrigin(0.5)

      this.time.delayedCall(3000, () => {
        this.closeScene()
      })
    }
  }

  showHeistDetails(heist) {
    const { width, height } = this.cameras.main
    this.selectedHeist = heist

    // Clear existing UI
    this.children.removeAll()
    this.createCloseButton()

    // Header with heist name
    this.add.text(width / 2, 40, `[H] ${heist.name.toUpperCase()}`, {
      ...getTerminalStyle('xxl'),
    }).setOrigin(0.5)

    // Description
    this.add.text(width / 2, 80, heist.description, {
      fontSize: '14px',
      color: '#aaaaaa'
    }).setOrigin(0.5)

    // Details panel
    const panelY = 120
    this.add.rectangle(width / 2, panelY + 80, width - 80, 160, COLORS.bg.panel)

    // Stats
    const statsX = 80
    const statsY = panelY + 20

    this.add.text(statsX, statsY, 'Payout:', { fontSize: '14px', color: '#888888' })
    this.add.text(statsX + 120, statsY, `${formatMoney(heist.minPayout)} - ${formatMoney(heist.maxPayout)}`, {
      fontSize: '14px', color: '#22c55e'
    })

    this.add.text(statsX, statsY + 25, 'Success Rate:', { fontSize: '14px', color: '#888888' })
    this.add.text(statsX + 120, statsY + 25, `${heist.baseSuccessRate}%`, {
      fontSize: '14px', color: '#ffffff'
    })

    this.add.text(statsX, statsY + 50, 'Crew Size:', { fontSize: '14px', color: '#888888' })
    this.add.text(statsX + 120, statsY + 50, `${heist.minCrewSize} - ${heist.maxCrewSize} members`, {
      fontSize: '14px', color: '#ffffff'
    })

    this.add.text(statsX, statsY + 75, 'Planning Time:', { fontSize: '14px', color: '#888888' })
    this.add.text(statsX + 120, statsY + 75, `${heist.planningHours} hours`, {
      fontSize: '14px', color: '#ffffff'
    })

    this.add.text(statsX, statsY + 100, 'Heat Generated:', { fontSize: '14px', color: '#888888' })
    this.add.text(statsX + 120, statsY + 100, `+${heist.heatGenerated}`, {
      fontSize: '14px', color: '#ef4444'
    })

    // Roles section
    const rolesY = panelY + 200
    this.add.text(width / 2, rolesY, '>> REQUIRED ROLES', {
      ...getTextStyle('lg', COLORS.status.warning, 'terminal'),
    }).setOrigin(0.5)

    if (heist.roles && heist.roles.length > 0) {
      heist.roles.forEach((role, i) => {
        const roleY = rolesY + 30 + i * 25
        const required = role.required ? '*' : ''
        this.add.text(100, roleY, `${required}${role.roleName}`, {
          fontSize: '13px', color: role.required ? '#ffffff' : '#aaaaaa'
        })
        this.add.text(width - 100, roleY, `+${role.bonusValue}% ${role.bonusType}`, {
          fontSize: '12px', color: '#22c55e'
        }).setOrigin(1, 0)
      })
    }

    // Buttons
    const buttonY = height - 80

    // Back button
    const backBtn = this.add.rectangle(width / 2 - 100, buttonY, 140, 40, 0x333333)
      .setInteractive({ useHandCursor: true })
    this.add.text(width / 2 - 100, buttonY, 'Back', {
      fontSize: '16px', color: '#ffffff'
    }).setOrigin(0.5)

    backBtn.on('pointerover', () => backBtn.setFillStyle(0x444444))
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x333333))
    backBtn.on('pointerdown', () => {
      this.selectedHeist = null
      this.children.removeAll()
      this.createCloseButton()
      this.createUI()
    })

    // Start heist button
    const startBtn = this.add.rectangle(width / 2 + 100, buttonY, 160, 40, 0xf59e0b)
      .setInteractive({ useHandCursor: true })
    this.add.text(width / 2 + 100, buttonY, 'Start Planning', {
      fontSize: '16px', color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5)

    startBtn.on('pointerover', () => startBtn.setFillStyle(0xfbbf24))
    startBtn.on('pointerout', () => startBtn.setFillStyle(0xf59e0b))
    startBtn.on('pointerdown', () => this.startHeist(heist))
  }

  async startHeist(heist) {
    try {
      const result = await gameManager.startHeist(heist.id)
      this.activeHeist = result.activeHeist
      audioManager.playClick()

      // Refresh UI to show active heist
      this.children.removeAll()
      this.createCloseButton()
      this.createUI()
    } catch (error) {
      console.error('Failed to start heist:', error)
    }
  }

  showActiveHeistPanel() {
    const { width, height } = this.cameras.main
    const heist = this.activeHeist

    // Header
    this.add.text(width / 2, 100, '>> ACTIVE HEIST', {
      ...getTextStyle('md', COLORS.status.warning, 'terminal'),
    }).setOrigin(0.5)

    this.add.text(width / 2, 125, heist.heistName || 'UNKNOWN HEIST', {
      ...getTerminalStyle('xl'),
    }).setOrigin(0.5)

    // Status
    const statusColor = heist.status === 'ready' ? '#22c55e' : '#f59e0b'
    this.add.text(width / 2, 155, `Status: ${heist.status.toUpperCase()}`, {
      fontSize: '14px',
      color: statusColor
    }).setOrigin(0.5)

    // Leader
    this.add.text(width / 2, 180, `Leader: ${heist.leaderName || 'Unknown'}`, {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5)

    // Participants section
    const partY = 220
    this.add.text(width / 2, partY, '>> CREW MEMBERS', {
      ...getTextStyle('lg', COLORS.status.warning, 'terminal'),
    }).setOrigin(0.5)

    if (heist.participants && heist.participants.length > 0) {
      heist.participants.forEach((p, i) => {
        const pY = partY + 30 + i * 30
        const readyIcon = p.ready ? '\u2713' : '\u2717'
        const readyColor = p.ready ? '#22c55e' : '#ef4444'

        this.add.text(100, pY, p.username, {
          fontSize: '14px', color: '#ffffff'
        })

        this.add.text(250, pY, p.roleName || 'No role', {
          fontSize: '12px', color: '#888888'
        })

        this.add.text(width - 100, pY, readyIcon, {
          fontSize: '18px', color: readyColor
        }).setOrigin(0.5)
      })
    } else {
      this.add.text(width / 2, partY + 40, 'No participants yet', {
        fontSize: '14px', color: '#666666'
      }).setOrigin(0.5)
    }

    // Role selection (if player hasn't selected)
    const player = gameManager.player
    const myParticipation = heist.participants?.find(p => p.playerId === player.id)

    if (myParticipation && !myParticipation.roleId && heist.roles) {
      this.showRoleSelection(heist)
    }

    // Action buttons
    const buttonY = height - 100

    if (heist.leaderId === player.id) {
      // Leader controls
      if (heist.status === 'ready') {
        const executeBtn = this.add.rectangle(width / 2, buttonY, 200, 45, 0x22c55e)
          .setInteractive({ useHandCursor: true })
        this.add.text(width / 2, buttonY, 'EXECUTE HEIST', {
          fontSize: '18px', color: '#000000', fontStyle: 'bold'
        }).setOrigin(0.5)

        executeBtn.on('pointerover', () => executeBtn.setFillStyle(0x16a34a))
        executeBtn.on('pointerout', () => executeBtn.setFillStyle(0x22c55e))
        executeBtn.on('pointerdown', () => this.executeHeist())
      }

      // Cancel button
      const cancelBtn = this.add.rectangle(width / 2, buttonY + 55, 120, 35, 0xef4444)
        .setInteractive({ useHandCursor: true })
      this.add.text(width / 2, buttonY + 55, 'Cancel', {
        fontSize: '14px', color: '#ffffff'
      }).setOrigin(0.5)

      cancelBtn.on('pointerdown', () => this.cancelHeist())
    } else if (myParticipation) {
      // Member controls - Ready button
      if (!myParticipation.ready) {
        const readyBtn = this.add.rectangle(width / 2, buttonY, 150, 40, 0x22c55e)
          .setInteractive({ useHandCursor: true })
        this.add.text(width / 2, buttonY, 'Ready Up', {
          fontSize: '16px', color: '#000000', fontStyle: 'bold'
        }).setOrigin(0.5)

        readyBtn.on('pointerdown', () => this.readyUp())
      } else {
        this.add.text(width / 2, buttonY, 'Waiting for leader...', {
          fontSize: '14px', color: '#888888'
        }).setOrigin(0.5)
      }

      // Leave button
      const leaveBtn = this.add.rectangle(width / 2, buttonY + 50, 100, 30, 0x666666)
        .setInteractive({ useHandCursor: true })
      this.add.text(width / 2, buttonY + 50, 'Leave', {
        fontSize: '12px', color: '#ffffff'
      }).setOrigin(0.5)

      leaveBtn.on('pointerdown', () => this.leaveHeist())
    } else {
      // Not in heist - Join button
      const joinBtn = this.add.rectangle(width / 2, buttonY, 150, 40, 0xf59e0b)
        .setInteractive({ useHandCursor: true })
      this.add.text(width / 2, buttonY, 'Join Heist', {
        fontSize: '16px', color: '#000000', fontStyle: 'bold'
      }).setOrigin(0.5)

      joinBtn.on('pointerdown', () => this.joinHeist())
    }
  }

  showRoleSelection(heist) {
    const { width } = this.cameras.main
    const rolesY = 420

    this.add.text(width / 2, rolesY, '>> SELECT YOUR ROLE', {
      ...getTextStyle('lg', COLORS.status.warning, 'terminal'),
    }).setOrigin(0.5)

    heist.roles.forEach((role, i) => {
      const roleY = rolesY + 35 + i * 40
      const roleBtn = this.add.rectangle(width / 2, roleY, width - 100, 35, COLORS.bg.card)
        .setInteractive({ useHandCursor: true })

      this.add.text(width / 2 - 100, roleY, role.roleName, {
        fontSize: '14px', color: '#ffffff'
      }).setOrigin(0, 0.5)

      this.add.text(width / 2 + 100, roleY, `+${role.bonusValue}% ${role.bonusType}`, {
        fontSize: '12px', color: '#22c55e'
      }).setOrigin(1, 0.5)

      roleBtn.on('pointerover', () => roleBtn.setFillStyle(COLORS.bg.elevated))
      roleBtn.on('pointerout', () => roleBtn.setFillStyle(COLORS.bg.card))
      roleBtn.on('pointerdown', () => this.selectRole(role.id))
    })
  }

  async selectRole(roleId) {
    try {
      await gameManager.selectHeistRole(this.activeHeist.id, roleId)
      await this.refreshActiveHeist()
    } catch (error) {
      console.error('Failed to select role:', error)
    }
  }

  async readyUp() {
    try {
      await gameManager.readyHeist(this.activeHeist.id)
      await this.refreshActiveHeist()
    } catch (error) {
      console.error('Failed to ready up:', error)
    }
  }

  async joinHeist() {
    try {
      await gameManager.joinHeist(this.activeHeist.id)
      await this.refreshActiveHeist()
    } catch (error) {
      console.error('Failed to join heist:', error)
    }
  }

  async leaveHeist() {
    try {
      await gameManager.leaveHeist(this.activeHeist.id)
      this.activeHeist = null
      this.children.removeAll()
      this.createCloseButton()
      this.createUI()
    } catch (error) {
      console.error('Failed to leave heist:', error)
    }
  }

  async executeHeist() {
    const { width, height } = this.cameras.main

    // Show execution animation
    this.children.removeAll()

    const executingBg = this.add.rectangle(width / 2, height / 2, width, height, COLORS.bg.void)
    const executingText = this.add.text(width / 2, height / 2 - 30, '>> EXECUTING HEIST...', {
      ...getTerminalStyle('xxl'),
    }).setOrigin(0.5)

    // Pulse animation
    this.tweens.add({
      targets: executingText,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: 3
    })

    try {
      await new Promise(resolve => this.time.delayedCall(2000, resolve))

      const result = await gameManager.executeHeist(this.activeHeist.id)

      // Show results
      executingText.destroy()

      if (result.success) {
        audioManager.playCashGain(result.totalPayout)

        this.add.text(width / 2, height / 2 - 60, 'HEIST SUCCESSFUL!', {
          fontSize: '32px',
          color: '#22c55e',
          fontFamily: 'Arial Black, Arial'
        }).setOrigin(0.5)

        this.add.text(width / 2, height / 2, `Crew earned: ${formatMoney(result.totalPayout)}`, {
          fontSize: '20px',
          color: '#ffffff'
        }).setOrigin(0.5)

        this.add.text(width / 2, height / 2 + 35, `Your share: ${formatMoney(result.playerShare || 0)}`, {
          fontSize: '18px',
          color: '#22c55e'
        }).setOrigin(0.5)

        notificationManager.setScene(this)
        notificationManager.showCashGain(width / 2, height / 2 - 100, result.playerShare || 0)
      } else {
        this.add.text(width / 2, height / 2 - 40, 'HEIST FAILED', {
          fontSize: '32px',
          color: '#ef4444',
          fontFamily: 'Arial Black, Arial'
        }).setOrigin(0.5)

        this.add.text(width / 2, height / 2 + 10, result.message || 'The crew was detected!', {
          fontSize: '16px',
          color: '#aaaaaa'
        }).setOrigin(0.5)

        if (result.heatGained) {
          this.add.text(width / 2, height / 2 + 45, `Heat gained: +${result.heatGained}`, {
            fontSize: '14px',
            color: '#ef4444'
          }).setOrigin(0.5)
        }
      }

      // Close button after results
      this.time.delayedCall(3000, () => {
        this.activeHeist = null
        this.scene.restart()
      })

    } catch (error) {
      console.error('Heist execution failed:', error)
      executingText.setText('Heist failed!')
      this.time.delayedCall(2000, () => this.scene.restart())
    }
  }

  async cancelHeist() {
    try {
      await gameManager.cancelHeist(this.activeHeist.id)
      this.activeHeist = null
      this.children.removeAll()
      this.createCloseButton()
      this.createUI()
    } catch (error) {
      console.error('Failed to cancel heist:', error)
    }
  }

  async refreshActiveHeist() {
    if (!this.activeHeist) return

    try {
      const data = await gameManager.getHeists()
      if (data.activeHeist) {
        this.activeHeist = data.activeHeist
        // Only refresh UI if on active heist panel
        if (this.scene.isActive()) {
          this.children.removeAll()
          this.createCloseButton()
          this.showActiveHeistPanel()
        }
      }
    } catch (error) {
      console.error('Failed to refresh heist:', error)
    }
  }

  closeScene() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    // Get scene manager reference before stopping
    const sceneManager = this.scene

    // CRITICAL: Re-enable input on GameScene BEFORE resuming
    try {
      const gameScene = sceneManager.get('GameScene')
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[HeistsScene] Re-enabled GameScene input')
      }
    } catch (e) {
      console.error('[HeistsScene] Failed to re-enable GameScene input:', e)
    }

    // Stop this scene
    sceneManager.stop()

    // CRITICAL: Bring GameScene to top of scene stack for input priority
    try {
      sceneManager.bringToTop('GameScene')
      console.log('[HeistsScene] Brought GameScene to top')
    } catch (e) {
      console.error('[HeistsScene] Failed to bring GameScene to top:', e)
    }

    // Resume GameScene and UIScene
    sceneManager.resume('GameScene')
    try {
      sceneManager.resume('UIScene')
    } catch (e) {
      // UIScene might already be running
    }
  }
}
