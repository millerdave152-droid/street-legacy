import Phaser from 'phaser'
import { gameManager } from '../GameManager'

/**
 * TutorialManager - Manages guided tutorial steps with spotlights and tooltips
 * Supports step sequences, conditional triggers, and progress persistence
 */
class TutorialManagerClass {
  constructor() {
    this.scene = null
    this.isActive = false
    this.currentTutorial = null
    this.currentStepIndex = 0

    // Tutorial elements
    this.overlay = null
    this.spotlight = null
    this.tooltip = null
    this.skipButton = null

    // Tutorial definitions
    this.tutorials = {
      // New player onboarding
      newPlayer: {
        id: 'new_player',
        name: 'Welcome to Street Legacy',
        steps: [
          {
            id: 'welcome',
            title: 'Welcome!',
            message: 'Welcome to Street Legacy! Let\'s show you around the streets.',
            position: 'center',
            highlight: null
          },
          {
            id: 'stats_bar',
            title: 'Your Stats',
            message: 'This is your status bar. Keep an eye on your cash, energy, and heat level.',
            position: 'below',
            highlight: { type: 'element', key: 'topBar' }
          },
          {
            id: 'crime_button',
            title: 'Commit Crimes',
            message: 'Click here to start committing crimes and earn cash. Be careful - you might get caught!',
            position: 'right',
            highlight: { type: 'button', key: 'crime' },
            requireClick: true
          },
          {
            id: 'heat_warning',
            title: 'Heat Level',
            message: 'Committing crimes increases your heat. High heat means higher chance of getting caught!',
            position: 'left',
            highlight: { type: 'element', key: 'heatText' }
          },
          {
            id: 'bank_intro',
            title: 'The Bank',
            message: 'Store your cash in the bank to keep it safe. Cash on hand can be lost if you get caught!',
            position: 'left',
            highlight: { type: 'button', key: 'bank' }
          },
          {
            id: 'complete',
            title: 'You\'re Ready!',
            message: 'That\'s the basics! Explore, commit crimes, and build your criminal empire.',
            position: 'center',
            highlight: null
          }
        ]
      },

      // Crime tutorial
      firstCrime: {
        id: 'first_crime',
        name: 'Your First Crime',
        steps: [
          {
            id: 'crime_intro',
            title: 'Crime Scene',
            message: 'This is where you plan your crimes. Each crime has different rewards and risks.',
            position: 'center',
            highlight: null
          },
          {
            id: 'crime_list',
            title: 'Choose Wisely',
            message: 'Select a crime that matches your skill level. Harder crimes pay more but are riskier!',
            position: 'right',
            highlight: { type: 'element', key: 'crimeList' }
          },
          {
            id: 'mini_game',
            title: 'Mini-Games',
            message: 'Some crimes require completing a mini-game. Success improves your payout!',
            position: 'center',
            highlight: null
          }
        ]
      },

      // Property tutorial
      properties: {
        id: 'properties',
        name: 'Property Guide',
        steps: [
          {
            id: 'property_intro',
            title: 'Properties',
            message: 'Properties generate passive income. Buy them to build your empire!',
            position: 'center',
            highlight: null
          },
          {
            id: 'buy_tab',
            title: 'Buy Properties',
            message: 'Check available properties in your district and buy ones you can afford.',
            position: 'below',
            highlight: { type: 'tab', key: 'buy' }
          },
          {
            id: 'income',
            title: 'Collect Income',
            message: 'Come back regularly to collect income from your properties and businesses!',
            position: 'center',
            highlight: null
          }
        ]
      }
    }

    // Load completion state
    this.loadProgress()
  }

  /**
   * Initialize the tutorial manager
   */
  initialize(scene) {
    this.scene = scene

    // Check if new player needs tutorial
    this.checkFirstTimeTutorial()
  }

  /**
   * Load tutorial progress from localStorage
   */
  loadProgress() {
    try {
      const progress = localStorage.getItem('streetLegacyTutorialProgress')
      this.completedTutorials = progress ? JSON.parse(progress) : {}
    } catch (error) {
      console.error('Failed to load tutorial progress:', error)
      this.completedTutorials = {}
    }
  }

  /**
   * Save tutorial progress to localStorage
   */
  saveProgress() {
    try {
      localStorage.setItem('streetLegacyTutorialProgress', JSON.stringify(this.completedTutorials))
    } catch (error) {
      console.error('Failed to save tutorial progress:', error)
    }
  }

  /**
   * Check if this is a first-time player
   */
  checkFirstTimeTutorial() {
    if (!this.completedTutorials['new_player']) {
      // Wait a short moment before starting
      this.scene.time.delayedCall(1000, () => {
        this.startTutorial('newPlayer')
      })
    }
  }

  /**
   * Start a tutorial sequence
   */
  startTutorial(tutorialKey) {
    const tutorial = this.tutorials[tutorialKey]
    if (!tutorial) {
      console.warn(`Tutorial not found: ${tutorialKey}`)
      return
    }

    // Don't restart completed tutorials unless forced
    if (this.completedTutorials[tutorial.id]) {
      return
    }

    this.isActive = true
    this.currentTutorial = tutorial
    this.currentStepIndex = 0

    this.createOverlay()
    this.showStep(this.currentTutorial.steps[0])
  }

  /**
   * Create the tutorial overlay
   */
  createOverlay() {
    const { width, height } = this.scene.cameras.main

    // Semi-transparent overlay
    this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setDepth(10000)
      .setInteractive() // Blocks clicks

    // Skip button
    this.skipButton = this.scene.add.text(width - 20, 20, 'Skip Tutorial', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial'
    }).setOrigin(1, 0).setDepth(10002).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.skipButton.setColor('#ffffff'))
      .on('pointerout', () => this.skipButton.setColor('#888888'))
      .on('pointerdown', () => this.skipTutorial())
  }

  /**
   * Show a tutorial step
   */
  showStep(step) {
    // Clear previous elements
    this.clearStepElements()

    const { width, height } = this.scene.cameras.main

    // Create spotlight if needed
    if (step.highlight) {
      this.createSpotlight(step.highlight)
    }

    // Create tooltip
    this.createTooltip(step)

    // Create next button or wait for click
    if (!step.requireClick) {
      this.createNextButton()
    } else {
      this.setupClickHandler(step.highlight)
    }
  }

  /**
   * Create spotlight highlight
   */
  createSpotlight(highlight) {
    const { width, height } = this.scene.cameras.main

    // Find the target element
    let target = this.findHighlightTarget(highlight)

    if (!target) {
      console.warn(`Highlight target not found: ${highlight.key}`)
      return
    }

    // Get target bounds
    const bounds = target.getBounds ? target.getBounds() : {
      x: target.x - 50,
      y: target.y - 25,
      width: 100,
      height: 50
    }

    // Create spotlight effect using graphics
    const padding = 10

    // Make a "hole" in the overlay
    this.overlay.destroy()

    // Recreate overlay with spotlight hole
    const graphics = this.scene.add.graphics().setDepth(10000)

    // Draw overlay
    graphics.fillStyle(0x000000, 0.7)
    graphics.fillRect(0, 0, width, height)

    // Clear spotlight area
    graphics.fillStyle(0x000000, 0)
    graphics.blendMode = Phaser.BlendModes.ERASE

    // Draw rounded rectangle for spotlight
    graphics.fillRoundedRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
      10
    )

    graphics.blendMode = Phaser.BlendModes.NORMAL

    // Border around spotlight
    graphics.lineStyle(2, 0xffd700, 1)
    graphics.strokeRoundedRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2,
      10
    )

    this.spotlight = graphics
  }

  /**
   * Find the target element for highlighting
   */
  findHighlightTarget(highlight) {
    switch (highlight.type) {
      case 'element':
        // Find by key in current scene
        return this.scene[highlight.key]

      case 'button':
        // Find action button by key
        const gameScene = this.scene.scene.get('GameScene')
        if (gameScene && gameScene.actionButtons) {
          const buttonIndex = ['crime', 'job', 'map', 'property', 'inventory', 'crew', 'bank', 'leaderboard', 'achievements']
            .indexOf(highlight.key)
          return gameScene.actionButtons[buttonIndex]
        }
        return null

      case 'tab':
        // Find tab by key in current scene
        if (this.scene.tabButtons) {
          return this.scene.tabButtons.find(t => t.getData('tabKey') === highlight.key)
        }
        return null

      default:
        return null
    }
  }

  /**
   * Create tooltip for current step
   */
  createTooltip(step) {
    const { width, height } = this.scene.cameras.main

    let x = width / 2
    let y = height / 2

    // Position based on step config
    if (step.highlight) {
      const target = this.findHighlightTarget(step.highlight)
      if (target) {
        const bounds = target.getBounds ? target.getBounds() : { x: target.x, y: target.y, width: 100, height: 50 }

        switch (step.position) {
          case 'above':
            x = bounds.x + bounds.width / 2
            y = bounds.y - 80
            break
          case 'below':
            x = bounds.x + bounds.width / 2
            y = bounds.y + bounds.height + 80
            break
          case 'left':
            x = bounds.x - 160
            y = bounds.y + bounds.height / 2
            break
          case 'right':
            x = bounds.x + bounds.width + 160
            y = bounds.y + bounds.height / 2
            break
        }
      }
    }

    // Keep tooltip on screen
    x = Phaser.Math.Clamp(x, 160, width - 160)
    y = Phaser.Math.Clamp(y, 80, height - 100)

    // Create tooltip container
    this.tooltip = this.scene.add.container(x, y).setDepth(10001)

    // Background
    const bg = this.scene.add.rectangle(0, 0, 300, 120, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xffd700)

    // Title
    const title = this.scene.add.text(0, -35, step.title, {
      fontSize: '18px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffd700',
      align: 'center'
    }).setOrigin(0.5)

    // Message
    const message = this.scene.add.text(0, 10, step.message, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 270 }
    }).setOrigin(0.5)

    // Step indicator
    const stepText = this.scene.add.text(0, 50,
      `Step ${this.currentStepIndex + 1} of ${this.currentTutorial.steps.length}`, {
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5)

    this.tooltip.add([bg, title, message, stepText])

    // Animate in
    this.tooltip.setAlpha(0)
    this.tooltip.setScale(0.8)

    this.scene.tweens.add({
      targets: this.tooltip,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    })
  }

  /**
   * Create next button
   */
  createNextButton() {
    if (!this.tooltip) return

    const isLastStep = this.currentStepIndex >= this.currentTutorial.steps.length - 1
    const buttonText = isLastStep ? 'Finish' : 'Next'

    const nextBtn = this.scene.add.text(0, 80, buttonText, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#1a1a2e',
      backgroundColor: '#ffd700',
      padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => nextBtn.setStyle({ backgroundColor: '#ffed4a' }))
      .on('pointerout', () => nextBtn.setStyle({ backgroundColor: '#ffd700' }))
      .on('pointerdown', () => this.nextStep())

    this.tooltip.add(nextBtn)
  }

  /**
   * Setup click handler for interactive steps
   */
  setupClickHandler(highlight) {
    const target = this.findHighlightTarget(highlight)
    if (target) {
      // Bring target above overlay
      target.setDepth(10001)

      // Add click handler
      const handler = () => {
        target.off('pointerdown', handler)
        this.scene.time.delayedCall(300, () => {
          this.nextStep()
        })
      }

      target.on('pointerdown', handler)

      // Add hint text
      const hint = this.scene.add.text(0, 80, 'Click to continue', {
        fontSize: '12px',
        color: '#ffd700',
        fontStyle: 'italic'
      }).setOrigin(0.5)

      this.tooltip.add(hint)

      // Pulse animation on hint
      this.scene.tweens.add({
        targets: hint,
        alpha: 0.5,
        duration: 500,
        yoyo: true,
        repeat: -1
      })
    }
  }

  /**
   * Advance to next step
   */
  nextStep() {
    this.currentStepIndex++

    if (this.currentStepIndex >= this.currentTutorial.steps.length) {
      this.completeTutorial()
    } else {
      this.showStep(this.currentTutorial.steps[this.currentStepIndex])
    }
  }

  /**
   * Skip the current tutorial
   */
  skipTutorial() {
    this.completeTutorial()
  }

  /**
   * Complete the current tutorial
   */
  completeTutorial() {
    // Mark as completed
    this.completedTutorials[this.currentTutorial.id] = true
    this.saveProgress()

    // Clean up
    this.cleanup()

    // Emit completion event
    gameManager.emit('tutorialCompleted', this.currentTutorial.id)

    this.isActive = false
    this.currentTutorial = null
    this.currentStepIndex = 0
  }

  /**
   * Clear step elements
   */
  clearStepElements() {
    if (this.spotlight) {
      this.spotlight.destroy()
      this.spotlight = null
    }

    if (this.tooltip) {
      this.tooltip.destroy()
      this.tooltip = null
    }
  }

  /**
   * Clean up all tutorial elements
   */
  cleanup() {
    this.clearStepElements()

    if (this.overlay) {
      this.overlay.destroy()
      this.overlay = null
    }

    if (this.skipButton) {
      this.skipButton.destroy()
      this.skipButton = null
    }
  }

  /**
   * Reset all tutorial progress
   */
  resetProgress() {
    this.completedTutorials = {}
    this.saveProgress()
  }

  /**
   * Check if a tutorial has been completed
   */
  isTutorialCompleted(tutorialId) {
    return !!this.completedTutorials[tutorialId]
  }

  /**
   * Force start a specific tutorial (even if completed)
   */
  forceStartTutorial(tutorialKey) {
    const tutorial = this.tutorials[tutorialKey]
    if (!tutorial) return

    // Temporarily remove completion status
    delete this.completedTutorials[tutorial.id]

    this.startTutorial(tutorialKey)
  }
}

// Export singleton instance
export const tutorialManager = new TutorialManagerClass()
export default tutorialManager
