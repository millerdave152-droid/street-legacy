// CurveballManager.js
// Manages random challenge events during minigames to increase difficulty

import Phaser from 'phaser'

export const CURVEBALL_TYPES = {
  SCREEN_SHAKE: 'screen_shake',
  CONTROL_REVERSAL: 'control_reversal',
  VISUAL_BLUR: 'visual_blur',
  SPEED_BOOST: 'speed_boost',
  SPEED_SLOW: 'speed_slow',
  DISTRACTION: 'distraction',
  BRIEF_BLACKOUT: 'brief_blackout',
  INPUT_LAG: 'input_lag'
}

// Curveball definitions with duration and intensity
export const CURVEBALL_CONFIG = {
  [CURVEBALL_TYPES.SCREEN_SHAKE]: {
    name: 'Earthquake',
    icon: '🌍',
    warning: 'Ground is shaking!',
    duration: 2000,
    intensity: { novice: 0.01, master: 0.03 },
    cooldown: 8000
  },
  [CURVEBALL_TYPES.CONTROL_REVERSAL]: {
    name: 'Confusion',
    icon: '🔄',
    warning: 'Controls reversed!',
    duration: 3000,
    cooldown: 12000
  },
  [CURVEBALL_TYPES.VISUAL_BLUR]: {
    name: 'Dazed',
    icon: '😵',
    warning: 'Vision blurring...',
    duration: 2500,
    intensity: { novice: 0.3, master: 0.6 },
    cooldown: 10000
  },
  [CURVEBALL_TYPES.SPEED_BOOST]: {
    name: 'Adrenaline',
    icon: '⚡',
    warning: 'Everything speeds up!',
    duration: 3000,
    multiplier: { novice: 1.25, master: 1.5 },
    cooldown: 8000
  },
  [CURVEBALL_TYPES.SPEED_SLOW]: {
    name: 'Sluggish',
    icon: '🐌',
    warning: 'Slowing down...',
    duration: 2500,
    multiplier: { novice: 0.75, master: 0.5 },
    cooldown: 8000
  },
  [CURVEBALL_TYPES.DISTRACTION]: {
    name: 'Distraction',
    icon: '📢',
    warning: 'Something is happening!',
    duration: 2000,
    cooldown: 6000
  },
  [CURVEBALL_TYPES.BRIEF_BLACKOUT]: {
    name: 'Blackout',
    icon: '🌑',
    warning: 'Lights flickering...',
    duration: 800,
    cooldown: 15000
  },
  [CURVEBALL_TYPES.INPUT_LAG]: {
    name: 'Lag Spike',
    icon: '📶',
    warning: 'Connection unstable!',
    duration: 2000,
    delay: { novice: 150, master: 300 },
    cooldown: 10000
  }
}

// Tier-based curveball frequency (events per minute)
export const TIER_CURVEBALL_FREQUENCY = {
  'Novice': 0,       // No curveballs for beginners
  'Apprentice': 0.5, // ~1 per 2 minutes
  'Skilled': 1,      // ~1 per minute
  'Expert': 1.5,     // ~1.5 per minute
  'Master': 2        // ~2 per minute
}

export class CurveballManager {
  constructor(scene) {
    this.scene = scene
    this.activeCurveball = null
    this.cooldowns = new Map()
    this.lastCurveballTime = 0
    this.supportedCurveballs = []
    this.tierName = 'Novice'
    this.isEnabled = true
    this.warningText = null
    this.blurOverlay = null
    this.curveballCount = 0
  }

  /**
   * Initialize with supported curveball types for this game
   * @param {string[]} supportedTypes - Array of CURVEBALL_TYPES
   * @param {string} tierName - Current difficulty tier
   */
  initialize(supportedTypes, tierName) {
    this.supportedCurveballs = supportedTypes || []
    this.tierName = tierName || 'Novice'
    this.lastCurveballTime = Date.now()
    this.curveballCount = 0
  }

  /**
   * Called each frame to potentially trigger curveballs
   * @param {number} timeRemaining - Seconds left in game
   * @param {number} totalTime - Total game time
   */
  update(timeRemaining, totalTime) {
    if (!this.isEnabled) return
    if (this.supportedCurveballs.length === 0) return
    if (this.activeCurveball) return

    // Safety windows - no curveballs at start or end
    const elapsedTime = totalTime - timeRemaining
    if (elapsedTime < 3 || timeRemaining < 2) return

    // Check if we should trigger based on tier frequency
    const frequency = TIER_CURVEBALL_FREQUENCY[this.tierName] || 0
    if (frequency === 0) return

    const timeSinceLast = (Date.now() - this.lastCurveballTime) / 1000
    const expectedInterval = 60 / frequency // seconds between curveballs

    // Random chance increases as we approach expected interval
    const triggerChance = (timeSinceLast / expectedInterval) * 0.02

    if (Math.random() < triggerChance) {
      this.triggerRandomCurveball()
    }
  }

  triggerRandomCurveball() {
    // Filter out curveballs on cooldown
    const available = this.supportedCurveballs.filter(type => {
      const cooldownEnd = this.cooldowns.get(type) || 0
      return Date.now() > cooldownEnd
    })

    if (available.length === 0) return

    // Pick a random curveball
    const curveballType = available[Math.floor(Math.random() * available.length)]
    this.executeCurveball(curveballType)
  }

  executeCurveball(type) {
    const config = CURVEBALL_CONFIG[type]
    if (!config) return

    this.lastCurveballTime = Date.now()
    this.cooldowns.set(type, Date.now() + config.cooldown)
    this.curveballCount++

    // Show warning
    this.showWarning(config)

    // Execute after brief warning delay
    this.scene.time.delayedCall(500, () => {
      if (this.scene.isGameOver) return

      this.activeCurveball = type
      this.applyCurveball(type, config)

      // Schedule end
      this.scene.time.delayedCall(config.duration, () => {
        this.endCurveball(type)
      })
    })
  }

  showWarning(config) {
    const centerX = this.scene.gameWidth / 2
    const centerY = this.scene.gameHeight / 2

    // Warning flash
    try {
      this.scene.cameras.main.flash(100, 255, 200, 0, false)
    } catch (e) { /* ignore */ }

    // Warning text
    this.warningText = this.scene.add.text(centerX, centerY - 50,
      `${config.icon} ${config.warning}`, {
        fontSize: '18px',
        color: '#fbbf24',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5).setDepth(200)

    // Animate and remove warning
    this.scene.tweens.add({
      targets: this.warningText,
      alpha: 0,
      y: centerY - 80,
      duration: 500,
      onComplete: () => {
        if (this.warningText) {
          this.warningText.destroy()
          this.warningText = null
        }
      }
    })
  }

  applyCurveball(type, config) {
    // Get intensity based on tier
    const tierMultiplier = this.getTierMultiplier()

    switch (type) {
      case CURVEBALL_TYPES.SCREEN_SHAKE:
        this.applyScreenShake(config, tierMultiplier)
        break
      case CURVEBALL_TYPES.CONTROL_REVERSAL:
        this.applyControlReversal()
        break
      case CURVEBALL_TYPES.VISUAL_BLUR:
        this.applyVisualBlur(config, tierMultiplier)
        break
      case CURVEBALL_TYPES.SPEED_BOOST:
        this.applySpeedChange(config.multiplier, tierMultiplier, true)
        break
      case CURVEBALL_TYPES.SPEED_SLOW:
        this.applySpeedChange(config.multiplier, tierMultiplier, false)
        break
      case CURVEBALL_TYPES.DISTRACTION:
        this.applyDistraction()
        break
      case CURVEBALL_TYPES.BRIEF_BLACKOUT:
        this.applyBlackout()
        break
      case CURVEBALL_TYPES.INPUT_LAG:
        this.applyInputLag(config, tierMultiplier)
        break
    }

    // Emit event for game-specific handling
    this.scene.events.emit('curveballStart', { type, config })
  }

  getTierMultiplier() {
    const multipliers = {
      'Novice': 0,
      'Apprentice': 0.25,
      'Skilled': 0.5,
      'Expert': 0.75,
      'Master': 1.0
    }
    return multipliers[this.tierName] || 0.5
  }

  // Individual curveball implementations
  applyScreenShake(config, tierMult) {
    const intensity = config.intensity.novice +
      (config.intensity.master - config.intensity.novice) * tierMult
    try {
      this.scene.cameras.main.shake(config.duration, intensity)
    } catch (e) { /* ignore */ }
  }

  applyControlReversal() {
    this.scene.controlsReversed = true
  }

  applyVisualBlur(config, tierMult) {
    const intensity = config.intensity.novice +
      (config.intensity.master - config.intensity.novice) * tierMult

    // Create blur overlay
    this.blurOverlay = this.scene.add.rectangle(
      this.scene.gameWidth / 2,
      this.scene.gameHeight / 2,
      this.scene.gameWidth,
      this.scene.gameHeight,
      0x000000, intensity
    ).setDepth(150)
  }

  applySpeedChange(multiplierConfig, tierMult, isBoost) {
    const mult = multiplierConfig.novice +
      (multiplierConfig.master - multiplierConfig.novice) * tierMult
    this.scene.speedMultiplier = mult
  }

  applyDistraction() {
    // Create distracting elements
    const distractions = ['🚨', '💥', '⚠️', '🔊', '👀', '🎯', '💣', '🔔']
    for (let i = 0; i < 5; i++) {
      const x = 50 + Math.random() * (this.scene.gameWidth - 100)
      const y = 150 + Math.random() * (this.scene.gameHeight - 250)
      const emoji = distractions[Math.floor(Math.random() * distractions.length)]

      const text = this.scene.add.text(x, y, emoji, {
        fontSize: '32px'
      }).setDepth(180)

      this.scene.tweens.add({
        targets: text,
        alpha: 0,
        scale: 2,
        duration: 1500,
        onComplete: () => text.destroy()
      })
    }
  }

  applyBlackout() {
    const blackout = this.scene.add.rectangle(
      this.scene.gameWidth / 2,
      this.scene.gameHeight / 2,
      this.scene.gameWidth,
      this.scene.gameHeight,
      0x000000, 0.95
    ).setDepth(180)

    this.scene.tweens.add({
      targets: blackout,
      alpha: 0,
      duration: 800,
      onComplete: () => blackout.destroy()
    })
  }

  applyInputLag(config, tierMult) {
    const delay = config.delay.novice +
      (config.delay.master - config.delay.novice) * tierMult
    this.scene.inputLagDelay = delay
  }

  endCurveball(type) {
    // Clean up based on type
    switch (type) {
      case CURVEBALL_TYPES.CONTROL_REVERSAL:
        this.scene.controlsReversed = false
        break
      case CURVEBALL_TYPES.VISUAL_BLUR:
        if (this.blurOverlay) {
          this.blurOverlay.destroy()
          this.blurOverlay = null
        }
        break
      case CURVEBALL_TYPES.SPEED_BOOST:
      case CURVEBALL_TYPES.SPEED_SLOW:
        this.scene.speedMultiplier = 1.0
        break
      case CURVEBALL_TYPES.INPUT_LAG:
        this.scene.inputLagDelay = 0
        break
    }

    this.activeCurveball = null
    this.scene.events.emit('curveballEnd', { type })
  }

  /**
   * Get count of curveballs survived this game
   */
  getCurveballCount() {
    return this.curveballCount
  }

  disable() {
    this.isEnabled = false
    if (this.activeCurveball) {
      this.endCurveball(this.activeCurveball)
    }
  }

  destroy() {
    this.disable()
    if (this.warningText) {
      this.warningText.destroy()
    }
    if (this.blurOverlay) {
      this.blurOverlay.destroy()
    }
  }
}

export default CurveballManager
