/**
 * TutorialManager - Singleton tutorial system for Street Legacy
 *
 * Features:
 * - Step-by-step guided tutorial
 * - Spotlight highlighting with pulsing border
 * - Speech bubble tooltips
 * - Progress tracking with persistence
 * - Skip option and resume capability
 * - Tutorial rewards on completion
 *
 * Usage:
 *   import { tutorialManager } from '../managers/TutorialManager'
 *   tutorialManager.setScene(scene)
 *   tutorialManager.startTutorial()
 */

import { gameManager } from '../GameManager'
import { audioManager } from './AudioManager'
import { AnimationHelper } from '../utils/AnimationHelper'
import { DEBUG } from '../config/Constants'

// Tutorial step definitions
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    scene: 'GameScene',
    target: null,
    message: 'Welcome to Street Legacy! 🌃\n\nYou\'re about to enter Toronto\'s criminal underworld. Let me show you the ropes.',
    position: 'center',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'stats_intro',
    scene: 'GameScene',
    target: 'statsPanel',
    message: '📊 These are your vital stats:\n\n💚 Energy - Needed for crimes\n🔥 Heat - Police attention\n⭐ Level - Your street cred',
    position: 'bottom',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'cash_display',
    scene: 'GameScene',
    target: 'cashDisplay',
    message: '💵 This is your cash on hand.\n\nYou\'ll need money for everything - bribes, equipment, properties, and more.',
    position: 'bottom',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'crime_button',
    scene: 'GameScene',
    target: 'crimeButton',
    message: '🔫 Ready to make some money?\n\nTap the CRIMES button to see what\'s available.',
    position: 'top',
    action: 'navigate',
    waitFor: 'CrimeScene',
    allowSkip: true
  },
  {
    id: 'crime_list',
    scene: 'CrimeScene',
    target: 'crimeCard_0',
    message: '📋 Here are your available crimes.\n\nEach shows the payout, energy cost, and success rate. Start with something easy!',
    position: 'bottom',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'minigame_tip',
    scene: 'CrimeScene',
    target: null,
    message: '🎮 Pro Tip: Some crimes have mini-games!\n\nDo well to earn bonus cash and XP. Look for the 🎮 icon.',
    position: 'center',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'return_game',
    scene: 'GameScene',
    target: null,
    message: '✅ Great work!\n\nYou earned cash and XP. Notice your energy went down - it regenerates over time.',
    position: 'center',
    action: 'click',
    allowSkip: true,
    waitOnSceneChange: true
  },
  {
    id: 'job_button',
    scene: 'GameScene',
    target: 'jobButton',
    message: '💼 Need legitimate income?\n\nJobs are safer than crimes - no heat, steady pay. Great when you need to lay low.',
    position: 'top',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'bank_intro',
    scene: 'GameScene',
    target: 'bankButton',
    message: '🏦 The Bank keeps your money safe.\n\nDeposit cash to protect it from being stolen. You can also earn interest!',
    position: 'top',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'map_intro',
    scene: 'GameScene',
    target: 'mapButton',
    message: '🗺️ Toronto has many districts to explore.\n\nNew areas unlock as you level up. Each has unique opportunities.',
    position: 'top',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'heat_warning',
    scene: 'GameScene',
    target: null,
    message: '🚨 Watch your Heat level!\n\nToo much heat attracts police. Lay low, do jobs, or bribe cops to reduce it.',
    position: 'center',
    action: 'click',
    allowSkip: true
  },
  {
    id: 'complete',
    scene: 'GameScene',
    target: null,
    message: '🎉 You\'re ready for the streets!\n\nBuild your empire, avoid the cops, become a legend.\n\nHere\'s $500 and 50 Respect to get started!',
    position: 'center',
    action: 'click',
    allowSkip: false,
    isLast: true
  }
]

// Contextual tips shown when entering scenes for the first time
const CONTEXTUAL_TIPS = {
  CrimeScene: {
    id: 'tip_crime',
    message: '💡 Tip: Higher level crimes pay more but have lower success rates. Build your skills on easy crimes first!',
    shownKey: 'tip_crime_shown'
  },
  JobScene: {
    id: 'tip_job',
    message: '💡 Tip: Jobs don\'t generate heat and are a safe way to earn money while waiting for energy to regenerate.',
    shownKey: 'tip_job_shown'
  },
  BankScene: {
    id: 'tip_bank',
    message: '💡 Tip: Money in the bank earns interest every hour. Deposit regularly to grow your wealth!',
    shownKey: 'tip_bank_shown'
  },
  MapScene: {
    id: 'tip_map',
    message: '💡 Tip: Different districts have different crime opportunities. Explore to find the best payouts!',
    shownKey: 'tip_map_shown'
  },
  PropertyScene: {
    id: 'tip_property',
    message: '💡 Tip: Properties generate passive income. The more you own, the more you earn while offline!',
    shownKey: 'tip_property_shown'
  },
  CrewScene: {
    id: 'tip_crew',
    message: '💡 Tip: Crew members provide bonuses to your crimes. Hire specialists to improve your success rate!',
    shownKey: 'tip_crew_shown'
  }
}

class TutorialManagerClass {
  constructor() {
    this.scene = null
    this.currentStep = 0
    this.steps = TUTORIAL_STEPS
    this.isActive = false
    this.isPaused = false

    // Visual elements
    this.overlay = null
    this.spotlight = null
    this.spotlightBorder = null
    this.tooltip = null
    this.progressDots = null

    // State
    this.tutorialCompleted = false
    this.shownTips = {}

    // Scene change listener
    this.pendingSceneWait = null
  }

  /**
   * Set the current Phaser scene
   * @param {Phaser.Scene} scene
   */
  setScene(scene) {
    this.scene = scene

    // Check for pending scene wait
    if (this.pendingSceneWait && this.pendingSceneWait === scene.scene.key) {
      this.pendingSceneWait = null
      // Resume tutorial after short delay
      this.scene.time.delayedCall(500, () => {
        this.nextStep()
      })
    }
  }

  /**
   * Initialize tutorial system - check if should start
   * @param {Phaser.Scene} scene
   */
  async initialize(scene) {
    // Skip tutorial if DEBUG flag is set
    if (DEBUG.SKIP_TUTORIAL) {
      console.log('[TutorialManager] Tutorial skipped via DEBUG.SKIP_TUTORIAL')
      this.tutorialCompleted = true
      return
    }

    this.setScene(scene)

    // Load tutorial state from player data
    const player = gameManager.player
    if (player) {
      this.tutorialCompleted = player.tutorial_completed || false
      this.currentStep = player.tutorial_step || 0
      this.shownTips = player.shown_tips || {}
    }

    // Auto-start tutorial for new players
    if (!this.tutorialCompleted && this.currentStep === 0 && scene.scene.key === 'GameScene') {
      // Small delay for scene to fully load
      this.scene.time.delayedCall(1000, () => {
        this.startTutorial()
      })
    } else if (!this.tutorialCompleted && this.currentStep > 0 && scene.scene.key === 'GameScene') {
      // Resume interrupted tutorial
      this.scene.time.delayedCall(500, () => {
        this.resumeTutorial()
      })
    }
  }

  /**
   * Start the tutorial from the beginning
   */
  startTutorial() {
    if (this.tutorialCompleted) return

    this.isActive = true
    this.isPaused = false
    this.currentStep = 0

    // Create visual elements
    this.createOverlay()
    this.showStep(this.currentStep)

    // Play intro sound
    audioManager.playNotification()

    // Save state
    this.saveProgress()
  }

  /**
   * Resume tutorial from saved step
   */
  resumeTutorial() {
    if (this.tutorialCompleted) return
    if (this.currentStep >= this.steps.length) {
      this.completeTutorial()
      return
    }

    this.isActive = true
    this.isPaused = false

    // Find the right step for current scene
    const currentSceneKey = this.scene.scene.key
    const stepForScene = this.steps.findIndex(
      (step, index) => index >= this.currentStep && step.scene === currentSceneKey
    )

    if (stepForScene >= 0) {
      this.currentStep = stepForScene
    }

    this.createOverlay()
    this.showStep(this.currentStep)
  }

  /**
   * Create the dark overlay
   */
  createOverlay() {
    if (this.overlay) return

    const { width, height } = this.scene.cameras.main

    // Dark overlay
    this.overlay = this.scene.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0)
      .setOrigin(0)
      .setDepth(5000)
      .setScrollFactor(0)

    // Fade in overlay
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0.8,
      duration: 300
    })
  }

  /**
   * Show a tutorial step
   * @param {number} stepIndex
   */
  showStep(stepIndex) {
    if (stepIndex >= this.steps.length) {
      this.completeTutorial()
      return
    }

    const step = this.steps[stepIndex]

    // Check if we need to wait for a different scene
    if (step.scene !== this.scene.scene.key) {
      if (step.waitOnSceneChange) {
        // Pause and wait for scene change
        this.pendingSceneWait = step.scene
        this.hideAllElements()
        return
      }
      // Skip this step if wrong scene
      this.currentStep++
      this.showStep(this.currentStep)
      return
    }

    // Clear previous spotlight
    this.clearHighlight()

    // Create spotlight if target exists
    if (step.target) {
      const targetBounds = this.getTargetBounds(step.target)
      if (targetBounds) {
        this.highlightElement(targetBounds.x, targetBounds.y, targetBounds.width, targetBounds.height)
      }
    }

    // Show tooltip
    this.showTooltip(step.message, step.position, step.allowSkip, step.isLast)

    // Show progress dots
    this.showProgress()

    // Call onEnter callback if exists
    if (step.onEnter) {
      step.onEnter()
    }

    // Handle different action types
    if (step.action === 'navigate' && step.waitFor) {
      this.pendingSceneWait = step.waitFor
    }
  }

  /**
   * Get bounds of a target element by ID
   * @param {string} targetId
   * @returns {object|null} { x, y, width, height }
   */
  getTargetBounds(targetId) {
    // Try to find element by data attribute or custom lookup
    const gameObjects = this.scene.children.list

    // Look for object with matching tutorialId data
    for (const obj of gameObjects) {
      if (obj.getData && obj.getData('tutorialId') === targetId) {
        const bounds = obj.getBounds ? obj.getBounds() : { x: obj.x, y: obj.y, width: 100, height: 50 }
        return bounds
      }
    }

    // Fallback: known positions for common elements
    const { width, height } = this.scene.cameras.main
    const knownPositions = {
      statsPanel: { x: width - 160, y: 20, width: 140, height: 60 },
      cashDisplay: { x: 10, y: 30, width: 120, height: 30 },
      crimeButton: { x: 30, y: 120, width: 100, height: 80 },
      jobButton: { x: 140, y: 120, width: 100, height: 80 },
      bankButton: { x: 250, y: 120, width: 100, height: 80 },
      mapButton: { x: 30, y: 220, width: 100, height: 80 },
      crimeCard_0: { x: 30, y: 110, width: width - 60, height: 75 }
    }

    return knownPositions[targetId] || null
  }

  /**
   * Highlight an element with spotlight effect
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  highlightElement(x, y, w, h) {
    const padding = 8

    // Create spotlight mask (transparent rectangle in dark overlay)
    // We'll use a graphics object to create the cutout effect
    if (this.spotlight) {
      this.spotlight.destroy()
    }

    const { width, height } = this.scene.cameras.main

    // Create composite mask using graphics
    this.spotlight = this.scene.add.graphics()
      .setDepth(5001)
      .setScrollFactor(0)

    // Draw the overlay with a hole
    this.spotlight.fillStyle(0x000000, 0.8)

    // Top section
    this.spotlight.fillRect(0, 0, width, y - padding)

    // Left section
    this.spotlight.fillRect(0, y - padding, x - padding, h + padding * 2)

    // Right section
    this.spotlight.fillRect(x + w + padding, y - padding, width - (x + w + padding), h + padding * 2)

    // Bottom section
    this.spotlight.fillRect(0, y + h + padding, width, height - (y + h + padding))

    // Hide the original overlay since spotlight handles darkness
    if (this.overlay) {
      this.overlay.setAlpha(0)
    }

    // Pulsing border around highlighted area
    if (this.spotlightBorder) {
      this.spotlightBorder.destroy()
    }

    this.spotlightBorder = this.scene.add.rectangle(
      x + w / 2,
      y + h / 2,
      w + padding * 2,
      h + padding * 2,
      0xffffff, 0
    )
      .setStrokeStyle(3, 0xfbbf24)
      .setDepth(5002)
      .setScrollFactor(0)

    // Pulse animation
    this.scene.tweens.add({
      targets: this.spotlightBorder,
      alpha: { from: 1, to: 0.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    })
  }

  /**
   * Clear spotlight highlight
   */
  clearHighlight() {
    if (this.spotlight) {
      this.spotlight.destroy()
      this.spotlight = null
    }
    if (this.spotlightBorder) {
      this.spotlightBorder.destroy()
      this.spotlightBorder = null
    }
    if (this.overlay) {
      this.overlay.setAlpha(0.8)
    }
  }

  /**
   * Show tooltip with message
   * @param {string} message
   * @param {string} position - 'top', 'bottom', 'center'
   * @param {boolean} allowSkip
   * @param {boolean} isLast
   */
  showTooltip(message, position = 'center', allowSkip = true, isLast = false) {
    if (this.tooltip) {
      this.tooltip.destroy()
    }

    const { width, height } = this.scene.cameras.main
    const tooltipWidth = Math.min(320, width - 40)
    const padding = 20

    // Calculate text height
    const tempText = this.scene.add.text(0, 0, message, {
      fontSize: '14px',
      wordWrap: { width: tooltipWidth - padding * 2 },
      lineSpacing: 4
    })
    const textHeight = tempText.height
    tempText.destroy()

    const tooltipHeight = textHeight + 100 // Extra space for buttons

    // Position tooltip
    let tooltipX = width / 2
    let tooltipY
    switch (position) {
      case 'top':
        tooltipY = 120
        break
      case 'bottom':
        tooltipY = height - tooltipHeight - 80
        break
      default: // center
        tooltipY = (height - tooltipHeight) / 2
    }

    // Create tooltip container
    this.tooltip = this.scene.add.container(tooltipX, tooltipY)
      .setDepth(5010)
      .setScrollFactor(0)

    // Background
    const bg = this.scene.add.rectangle(0, 0, tooltipWidth, tooltipHeight, 0x1e293b, 0.98)
      .setStrokeStyle(2, 0x3b82f6)
      .setOrigin(0.5, 0)

    // Message text
    const text = this.scene.add.text(0, padding, message, {
      fontSize: '14px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: tooltipWidth - padding * 2 },
      lineSpacing: 4
    }).setOrigin(0.5, 0)

    // Next/Continue button
    const buttonY = tooltipHeight - 45
    const buttonText = isLast ? 'Claim Reward!' : 'Continue'
    const buttonColor = isLast ? 0x22c55e : 0x3b82f6

    const nextBtn = this.scene.add.rectangle(0, buttonY, 140, 36, buttonColor)
      .setInteractive({ useHandCursor: true })

    const nextBtnText = this.scene.add.text(0, buttonY, buttonText, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    nextBtn.on('pointerover', () => {
      nextBtn.setFillStyle(Phaser.Display.Color.ValueToColor(buttonColor).lighten(20).color)
      audioManager.playHover()
    })
    nextBtn.on('pointerout', () => nextBtn.setFillStyle(buttonColor))
    nextBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.nextStep()
    })

    this.tooltip.add([bg, text, nextBtn, nextBtnText])

    // Skip button (if allowed)
    if (allowSkip && !isLast) {
      const skipBtn = this.scene.add.text(tooltipWidth / 2 - 10, buttonY + 25, 'Skip Tutorial', {
        fontSize: '11px',
        color: '#6b7280'
      }).setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })

      skipBtn.on('pointerover', () => skipBtn.setColor('#9ca3af'))
      skipBtn.on('pointerout', () => skipBtn.setColor('#6b7280'))
      skipBtn.on('pointerdown', () => {
        this.skipTutorial()
      })

      this.tooltip.add(skipBtn)
    }

    // Arrow pointer (if not center)
    if (position !== 'center') {
      const arrowY = position === 'top' ? tooltipHeight + 5 : -10
      const arrowDirection = position === 'top' ? 1 : -1

      const arrow = this.scene.add.triangle(
        0, arrowY,
        -10, 0,
        10, 0,
        0, 15 * arrowDirection,
        0x1e293b
      )

      this.tooltip.add(arrow)
    }

    // Animate in
    this.tooltip.setScale(0.8)
    this.tooltip.setAlpha(0)

    this.scene.tweens.add({
      targets: this.tooltip,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.out'
    })
  }

  /**
   * Show progress dots
   */
  showProgress() {
    if (this.progressDots) {
      this.progressDots.destroy()
    }

    const { width, height } = this.scene.cameras.main
    const dotSize = 8
    const spacing = 16
    const totalWidth = this.steps.length * spacing
    const startX = (width - totalWidth) / 2

    this.progressDots = this.scene.add.container(0, height - 30)
      .setDepth(5015)
      .setScrollFactor(0)

    // Step counter text
    const counterText = this.scene.add.text(width / 2, -20, `Step ${this.currentStep + 1} of ${this.steps.length}`, {
      fontSize: '11px',
      color: '#6b7280'
    }).setOrigin(0.5)

    this.progressDots.add(counterText)

    // Dots
    for (let i = 0; i < this.steps.length; i++) {
      const dotX = startX + i * spacing
      const isActive = i === this.currentStep
      const isComplete = i < this.currentStep

      const dot = this.scene.add.circle(dotX, 0, dotSize / 2,
        isActive ? 0x3b82f6 : (isComplete ? 0x22c55e : 0x374151)
      )

      if (isActive) {
        // Pulse current dot
        this.scene.tweens.add({
          targets: dot,
          scale: { from: 1, to: 1.3 },
          duration: 500,
          yoyo: true,
          repeat: -1
        })
      }

      this.progressDots.add(dot)
    }
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this.tooltip) {
      this.scene.tweens.add({
        targets: this.tooltip,
        scale: 0.8,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          if (this.tooltip) {
            this.tooltip.destroy()
            this.tooltip = null
          }
        }
      })
    }
  }

  /**
   * Hide all visual elements
   */
  hideAllElements() {
    this.hideTooltip()
    this.clearHighlight()

    if (this.progressDots) {
      this.progressDots.destroy()
      this.progressDots = null
    }

    if (this.overlay) {
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: 200
      })
    }
  }

  /**
   * Advance to next step
   */
  nextStep() {
    const currentStepData = this.steps[this.currentStep]

    // Call onComplete callback if exists
    if (currentStepData && currentStepData.onComplete) {
      currentStepData.onComplete()
    }

    this.currentStep++
    this.saveProgress()

    if (this.currentStep >= this.steps.length) {
      this.completeTutorial()
    } else {
      this.showStep(this.currentStep)
    }
  }

  /**
   * Skip the tutorial
   */
  skipTutorial() {
    audioManager.playClick()

    this.hideAllElements()
    this.destroyOverlay()

    this.isActive = false
    this.tutorialCompleted = true

    // Save skip state (but don't give rewards)
    this.saveCompletion(false)

    // Show skip message
    if (this.scene && this.scene.sys.isActive()) {
      const { width, height } = this.scene.cameras.main
      const skipText = this.scene.add.text(width / 2, height / 2, 'Tutorial skipped\nYou can restart it from Settings', {
        fontSize: '16px',
        color: '#9ca3af',
        align: 'center'
      }).setOrigin(0.5).setDepth(6000)

      this.scene.tweens.add({
        targets: skipText,
        alpha: 0,
        y: height / 2 - 30,
        duration: 2000,
        delay: 1000,
        onComplete: () => skipText.destroy()
      })
    }
  }

  /**
   * Complete the tutorial successfully
   */
  completeTutorial() {
    this.hideAllElements()
    this.destroyOverlay()

    this.isActive = false
    this.tutorialCompleted = true

    // Award rewards
    this.awardRewards()

    // Save completion
    this.saveCompletion(true)

    // Play success sound and effects
    audioManager.playLevelUp()

    if (this.scene && this.scene.sys.isActive()) {
      // Import particle helper dynamically to avoid circular deps
      import('../utils/ParticleHelper').then(({ ParticleHelper }) => {
        ParticleHelper.successConfetti(this.scene)
      })
    }
  }

  /**
   * Award tutorial completion rewards
   */
  awardRewards() {
    // Add cash bonus
    gameManager.addCash(500)

    // Add respect bonus
    gameManager.addRespect(50)

    // Unlock achievement
    gameManager.unlockAchievement('newcomer')

    // Show notification
    import('./NotificationManager').then(({ notificationManager }) => {
      if (this.scene) {
        notificationManager.setScene(this.scene)
        notificationManager.showToast('Tutorial Complete! +$500, +50 Respect', 'reward', 5000)
      }
    })
  }

  /**
   * Destroy overlay
   */
  destroyOverlay() {
    if (this.overlay) {
      this.overlay.destroy()
      this.overlay = null
    }
  }

  /**
   * Save progress to server
   */
  async saveProgress() {
    try {
      await gameManager.updatePlayerData({
        tutorial_step: this.currentStep,
        tutorial_completed: this.tutorialCompleted
      })
    } catch (error) {
      console.error('Failed to save tutorial progress:', error)
    }
  }

  /**
   * Save tutorial completion
   * @param {boolean} completed - Whether tutorial was completed (true) or skipped (false)
   */
  async saveCompletion(completed) {
    try {
      await gameManager.updatePlayerData({
        tutorial_completed: true,
        tutorial_step: this.steps.length,
        tutorial_rewards_claimed: completed
      })
    } catch (error) {
      console.error('Failed to save tutorial completion:', error)
    }
  }

  /**
   * Reset tutorial for replay
   */
  async resetTutorial() {
    this.tutorialCompleted = false
    this.currentStep = 0
    this.isActive = false
    this.shownTips = {}

    try {
      await gameManager.updatePlayerData({
        tutorial_completed: false,
        tutorial_step: 0,
        tutorial_rewards_claimed: false,
        shown_tips: {}
      })
    } catch (error) {
      console.error('Failed to reset tutorial:', error)
    }
  }

  // ==========================================================================
  // CONTEXTUAL TIPS
  // ==========================================================================

  /**
   * Show contextual tip for a scene (first time only)
   * @param {string} sceneKey
   */
  showContextualTip(sceneKey) {
    if (this.isActive) return // Don't show during tutorial
    if (this.tutorialCompleted === false) return // Tutorial not done

    const tip = CONTEXTUAL_TIPS[sceneKey]
    if (!tip) return

    // Check if already shown
    if (this.shownTips[tip.shownKey]) return

    // Mark as shown
    this.shownTips[tip.shownKey] = true
    this.saveShownTips()

    // Show tip after short delay
    this.scene.time.delayedCall(800, () => {
      this.showTipBubble(tip.message)
    })
  }

  /**
   * Show a tip bubble
   * @param {string} message
   */
  showTipBubble(message) {
    if (!this.scene || !this.scene.sys.isActive()) return

    const { width, height } = this.scene.cameras.main

    const tipContainer = this.scene.add.container(width / 2, height - 120)
      .setDepth(4000)
      .setScrollFactor(0)

    // Background
    const bg = this.scene.add.rectangle(0, 0, 320, 80, 0x1e293b, 0.95)
      .setStrokeStyle(2, 0xfbbf24)

    // Tip icon
    const icon = this.scene.add.text(-140, 0, '💡', {
      fontSize: '24px'
    }).setOrigin(0.5)

    // Message
    const text = this.scene.add.text(-110, 0, message.replace('💡 Tip: ', ''), {
      fontSize: '12px',
      color: '#ffffff',
      wordWrap: { width: 200 }
    }).setOrigin(0, 0.5)

    // Dismiss button
    const dismissBtn = this.scene.add.text(145, -25, '✕', {
      fontSize: '16px',
      color: '#6b7280'
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    dismissBtn.on('pointerover', () => dismissBtn.setColor('#ffffff'))
    dismissBtn.on('pointerout', () => dismissBtn.setColor('#6b7280'))
    dismissBtn.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: tipContainer,
        alpha: 0,
        y: height - 80,
        duration: 200,
        onComplete: () => tipContainer.destroy()
      })
    })

    tipContainer.add([bg, icon, text, dismissBtn])

    // Animate in
    tipContainer.setAlpha(0)
    tipContainer.y = height - 80

    this.scene.tweens.add({
      targets: tipContainer,
      alpha: 1,
      y: height - 120,
      duration: 400,
      ease: 'Back.out'
    })

    // Auto-dismiss after 8 seconds
    this.scene.time.delayedCall(8000, () => {
      if (tipContainer && tipContainer.active) {
        this.scene.tweens.add({
          targets: tipContainer,
          alpha: 0,
          y: height - 80,
          duration: 300,
          onComplete: () => tipContainer.destroy()
        })
      }
    })
  }

  /**
   * Save shown tips to server
   */
  async saveShownTips() {
    try {
      await gameManager.updatePlayerData({
        shown_tips: this.shownTips
      })
    } catch (error) {
      console.error('Failed to save shown tips:', error)
    }
  }

  // ==========================================================================
  // STATE GETTERS
  // ==========================================================================

  isTutorialActive() {
    return this.isActive
  }

  isTutorialCompleted() {
    return this.tutorialCompleted
  }

  getCurrentStep() {
    return this.currentStep
  }

  getTotalSteps() {
    return this.steps.length
  }

  /**
   * Cleanup on scene destroy
   */
  cleanup() {
    this.hideAllElements()
    this.destroyOverlay()
  }
}

// Singleton instance
export const tutorialManager = new TutorialManagerClass()
export default tutorialManager
