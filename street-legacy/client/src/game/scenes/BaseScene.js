/**
 * BaseScene - Base class for all game scenes with proper cleanup
 *
 * Features:
 * - Automatic cleanup of tweens, timers, and listeners
 * - Scene transition helpers
 * - Common utility methods
 * - Memory leak prevention
 *
 * Usage:
 *   import BaseScene from './BaseScene'
 *
 *   export class MyScene extends BaseScene {
 *     constructor() {
 *       super('MyScene')
 *     }
 *
 *     create() {
 *       super.create()
 *       // Your scene setup...
 *     }
 *   }
 */

import Phaser from 'phaser'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
import { networkTransition } from '../ui/NetworkTransition'
import { DEPTH, getTerminalStyle } from '../ui/NetworkTheme'

export class BaseScene extends Phaser.Scene {
  constructor(key) {
    super({ key })

    // Track custom event listeners for cleanup
    this.customListeners = []

    // Track custom intervals/timeouts
    this.customIntervals = []
    this.customTimeouts = []

    // Scene dimensions
    this.width = 0
    this.height = 0
    this.centerX = 0
    this.centerY = 0
  }

  /**
   * Initialize scene - called with data passed from previous scene
   */
  init(data) {
    this.initData = data || {}
  }

  /**
   * Create - set up common scene elements
   * @param {Object} options - Options for scene creation
   * @param {boolean} options.skipIntro - Skip the intro animation
   */
  create(options = {}) {
    // Store dimensions for easy access
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height
    this.centerX = this.width / 2
    this.centerY = this.height / 2

    // Set up audio manager for this scene
    audioManager.setScene(this)

    // Set up notification manager for this scene
    notificationManager.setScene(this)

    // Listen for scene events
    this.events.on('shutdown', this.shutdown, this)
    this.events.on('destroy', this.destroy, this)

    // Listen for sleep/wake (for overlay scenes)
    this.events.on('sleep', this.onSleep, this)
    this.events.on('wake', this.onWake, this)
    this.events.on('pause', this.onPause, this)
    this.events.on('resume', this.onResume, this)

    // Play scene intro animation (unless skipped)
    // Skip for utility scenes like Settings, Boot, Preload, etc.
    const skipScenes = ['BootScene', 'PreloadScene', 'NetworkBootScene', 'MainMenuScene',
      'GameScene', 'UIScene', 'SettingsScene', 'AudioSettingsScene', 'AdminScene']
    if (!options.skipIntro && !skipScenes.includes(this.scene.key)) {
      this.time.delayedCall(100, () => {
        networkTransition.playSceneIntro(this, this.scene.key)
      })
    }
  }

  // ==========================================================================
  // SCENE LIFECYCLE HOOKS (Override in subclasses)
  // ==========================================================================

  /**
   * Called when scene goes to sleep (another scene overlays)
   */
  onSleep() {
    // Override in subclass if needed
  }

  /**
   * Called when scene wakes up from sleep
   */
  onWake(sys, data) {
    // Re-initialize managers
    audioManager.setScene(this)
    notificationManager.setScene(this)
    // Override in subclass for custom behavior
  }

  /**
   * Called when scene is paused
   */
  onPause() {
    // Override in subclass if needed
  }

  /**
   * Called when scene resumes from pause
   */
  onResume() {
    // Override in subclass if needed
  }

  // ==========================================================================
  // CLEANUP METHODS
  // ==========================================================================

  /**
   * Shutdown - cleanup all resources
   * Called when scene is stopped/switched
   */
  shutdown() {
    // Kill all tweens in this scene
    this.tweens.killAll()

    // Remove all time events (timers)
    this.time.removeAllEvents()

    // Remove all input listeners
    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners()
      this.input.keyboard.removeAllKeys()
    }
    this.input.removeAllListeners()

    // Clear custom listeners
    this.clearCustomListeners()

    // Clear custom intervals and timeouts
    this.clearCustomTimers()

    // Remove scene event listeners
    this.events.off('shutdown', this.shutdown, this)
    this.events.off('destroy', this.destroy, this)
    this.events.off('sleep', this.onSleep, this)
    this.events.off('wake', this.onWake, this)
    this.events.off('pause', this.onPause, this)
    this.events.off('resume', this.onResume, this)
  }

  /**
   * Destroy - called when scene is completely removed
   */
  destroy() {
    this.shutdown()
  }

  /**
   * Clear all custom event listeners
   */
  clearCustomListeners() {
    for (const { target, event, handler } of this.customListeners) {
      if (target && typeof target.off === 'function') {
        target.off(event, handler)
      } else if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(event, handler)
      }
    }
    this.customListeners = []
  }

  /**
   * Clear all custom intervals and timeouts
   */
  clearCustomTimers() {
    for (const id of this.customIntervals) {
      clearInterval(id)
    }
    this.customIntervals = []

    for (const id of this.customTimeouts) {
      clearTimeout(id)
    }
    this.customTimeouts = []
  }

  // ==========================================================================
  // EVENT LISTENER HELPERS (Auto-tracked for cleanup)
  // ==========================================================================

  /**
   * Add event listener that will be auto-cleaned on shutdown
   * @param {EventEmitter} target - Target object
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  addListener(target, event, handler) {
    this.customListeners.push({ target, event, handler })
    target.on(event, handler)
  }

  /**
   * Add DOM event listener that will be auto-cleaned on shutdown
   * @param {Element} target - DOM element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  addDOMListener(target, event, handler) {
    this.customListeners.push({ target, event, handler })
    target.addEventListener(event, handler)
  }

  /**
   * Create tracked interval (auto-cleared on shutdown)
   * @param {Function} callback
   * @param {number} delay
   * @returns {number} Interval ID
   */
  createInterval(callback, delay) {
    const id = setInterval(callback, delay)
    this.customIntervals.push(id)
    return id
  }

  /**
   * Create tracked timeout (auto-cleared on shutdown)
   * @param {Function} callback
   * @param {number} delay
   * @returns {number} Timeout ID
   */
  createTimeout(callback, delay) {
    const id = setTimeout(callback, delay)
    this.customTimeouts.push(id)
    return id
  }

  // ==========================================================================
  // SCENE TRANSITION HELPERS
  // ==========================================================================

  /**
   * Transition to another scene with fade effect
   * @param {string} sceneName - Target scene key
   * @param {Object} data - Data to pass to target scene
   * @param {number} duration - Fade duration in ms (default: 300)
   */
  transitionTo(sceneName, data = {}, duration = 300) {
    // Prevent double transitions
    if (this.isTransitioning) return
    this.isTransitioning = true

    // Fade out
    this.cameras.main.fade(duration, 0, 0, 0)

    this.time.delayedCall(duration, () => {
      this.scene.start(sceneName, data)
    })
  }

  /**
   * Go back to previous scene (or GameScene by default)
   * @param {Object} data - Data to pass back
   */
  goBack(data = {}) {
    const returnScene = this.initData?.returnScene || 'GameScene'
    this.transitionTo(returnScene, { ...data, from: this.scene.key })
  }

  /**
   * Launch overlay scene (keeps current scene active)
   * @param {string} sceneName - Overlay scene key
   * @param {Object} data - Data to pass
   */
  launchOverlay(sceneName, data = {}) {
    this.scene.launch(sceneName, {
      ...data,
      returnScene: this.scene.key
    })
    this.scene.pause()
  }

  /**
   * Close this scene if it's an overlay and return to previous
   * @param {Object} data - Data to return
   * @param {boolean} animate - Whether to play exit animation
   */
  closeOverlay(data = {}, animate = true) {
    console.log(`[BaseScene] closeOverlay() called on ${this.scene.key}`)
    console.trace(`[BaseScene] closeOverlay stack trace`)
    const returnScene = this.initData?.returnScene

    if (animate) {
      // Play exit animation then close
      networkTransition.playSceneExit(this, () => {
        if (returnScene) {
          this.scene.resume(returnScene, data)
        }
        this.scene.stop()
      })
    } else {
      if (returnScene) {
        this.scene.resume(returnScene, data)
      }
      this.scene.stop()
    }
  }

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  /**
   * Create a back button in top-left corner
   * Specs: position (20,20), rgba(0,0,0,0.6) bg, white border, red hover
   * @param {Function} onClick - Optional click handler (default: goBack)
   * @returns {Phaser.GameObjects.Container}
   */
  createBackButton(onClick = null) {
    const btn = this.add.container(20, 20).setDepth(DEPTH.CLOSE_BUTTON)

    // Background: rgba(0,0,0,0.6), padding 8px 16px, border 1px white 0.3
    const bg = this.add.rectangle(50, 16, 100, 32, 0x000000, 0.6)
      .setStrokeStyle(1, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true })

    // Terminal-style text: "← BACK"
    const label = this.add.text(50, 16, '← BACK', {
      ...getTerminalStyle('sm'),
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5)

    btn.add([bg, label])

    bg.on('pointerover', () => {
      bg.setFillStyle(0xff0000, 0.4)
      bg.setStrokeStyle(1, 0xffffff, 0.5)
      audioManager.playHover()
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x000000, 0.6)
      bg.setStrokeStyle(1, 0xffffff, 0.3)
    })

    bg.on('pointerdown', () => {
      audioManager.playClick()
      if (onClick) {
        onClick()
      } else {
        this.goBack()
      }
    })

    return btn
  }

  /**
   * Create a close button in top-right corner
   * @param {Function} onClick - Click handler
   * @returns {Phaser.GameObjects.Container}
   */
  createCloseButton(onClick) {
    const btn = this.add.container(this.width - 40, 50).setDepth(DEPTH.CLOSE_BUTTON)

    const bg = this.add.circle(0, 0, 24, 0x333333)
      .setInteractive({ useHandCursor: true })

    const icon = this.add.text(0, 0, '×', {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5)

    btn.add([bg, icon])

    bg.on('pointerover', () => {
      bg.setFillStyle(0xef4444)
      audioManager.playHover()
    })

    bg.on('pointerout', () => bg.setFillStyle(0x333333))

    bg.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    return btn
  }

  /**
   * Show loading indicator
   * @param {string} message - Loading message
   * @returns {Phaser.GameObjects.Container}
   */
  showLoading(message = 'Loading...') {
    const container = this.add.container(this.centerX, this.centerY)
      .setDepth(9999)

    const bg = this.add.rectangle(0, 0, 200, 80, 0x000000, 0.8)
    const text = this.add.text(0, 0, message, {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5)

    container.add([bg, text])
    container.setData('loadingIndicator', true)

    // Pulse animation
    this.tweens.add({
      targets: text,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    return container
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loadingIndicators = this.children.list.filter(
      child => child.getData && child.getData('loadingIndicator')
    )
    loadingIndicators.forEach(indicator => indicator.destroy())
  }
}

export default BaseScene
