/**
 * CoreBaseScene - Generic base class for all Phaser scenes
 *
 * Core engine component - no game-specific logic.
 *
 * Features:
 * - Automatic cleanup of tweens, timers, and listeners
 * - Scene lifecycle hooks (sleep, wake, pause, resume)
 * - Generic transition helpers
 * - Memory leak prevention
 *
 * Usage:
 *   import { CoreBaseScene } from '../core/scenes/CoreBaseScene'
 *
 *   export class MyScene extends CoreBaseScene {
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

export class CoreBaseScene extends Phaser.Scene {
  constructor(key, config = {}) {
    super({ key })

    // Track custom event listeners for cleanup
    this.customListeners = []

    // Track custom intervals/timeouts
    this.customIntervals = []
    this.customTimeouts = []

    // Scene dimensions (set in create)
    this.width = 0
    this.height = 0
    this.centerX = 0
    this.centerY = 0

    // Transition lock
    this.isTransitioning = false

    // Optional manager hooks - game layer can provide these
    this._onSceneReady = config.onSceneReady || null
    this._onSceneWake = config.onSceneWake || null
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
   */
  create(options = {}) {
    // Store dimensions for easy access
    this.width = this.cameras.main.width
    this.height = this.cameras.main.height
    this.centerX = this.width / 2
    this.centerY = this.height / 2

    // Listen for scene events
    this.events.on('shutdown', this.shutdown, this)
    this.events.on('destroy', this.destroy, this)

    // Listen for sleep/wake (for overlay scenes)
    this.events.on('sleep', this.onSleep, this)
    this.events.on('wake', this.onWake, this)
    this.events.on('pause', this.onPause, this)
    this.events.on('resume', this.onResume, this)

    // Call optional ready hook
    if (this._onSceneReady) {
      this._onSceneReady(this)
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
    // Call optional wake hook for manager re-initialization
    if (this._onSceneWake) {
      this._onSceneWake(this)
    }
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
   * Go back to previous scene (uses initData.returnScene or default)
   * @param {Object} data - Data to pass back
   * @param {string} defaultScene - Default scene if no returnScene
   */
  goBack(data = {}, defaultScene = 'GameScene') {
    const returnScene = this.initData?.returnScene || defaultScene
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
   */
  closeOverlay(data = {}) {
    const returnScene = this.initData?.returnScene

    if (returnScene) {
      this.scene.resume(returnScene, data)
    }
    this.scene.stop()
  }

  // ==========================================================================
  // GENERIC UI HELPERS
  // ==========================================================================

  /**
   * Show generic loading indicator
   * @param {string} message - Loading message
   * @param {Object} config - Optional config (bgColor, textColor, depth)
   * @returns {Phaser.GameObjects.Container}
   */
  showLoading(message = 'Loading...', config = {}) {
    const bgColor = config.bgColor ?? 0x000000
    const bgAlpha = config.bgAlpha ?? 0.8
    const textColor = config.textColor ?? '#ffffff'
    const depth = config.depth ?? 9999

    const container = this.add.container(this.centerX, this.centerY)
      .setDepth(depth)

    const bg = this.add.rectangle(0, 0, 200, 80, bgColor, bgAlpha)
    const text = this.add.text(0, 0, message, {
      fontSize: '16px',
      color: textColor
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

  /**
   * Safe call wrapper - calls a function only if it exists
   * @param {Function} fn - Function to call
   * @param {...any} args - Arguments to pass
   * @returns {any} Result of the function call
   */
  safeCall(fn, ...args) {
    if (typeof fn === 'function') {
      try {
        return fn(...args)
      } catch (e) {
        console.error('[CoreBaseScene] safeCall error:', e)
      }
    }
    return undefined
  }

  /**
   * Add fade in animation to object
   * @param {Phaser.GameObjects.GameObject} target - Target object
   * @param {number} duration - Animation duration
   * @param {number} delay - Animation delay
   */
  addFadeIn(target, duration = 200, delay = 0) {
    target.setAlpha(0)
    this.tweens.add({
      targets: target,
      alpha: 1,
      duration,
      delay,
      ease: 'Power2'
    })
  }

  /**
   * Add scale pop animation to object
   * @param {Phaser.GameObjects.GameObject} target - Target object
   * @param {number} duration - Animation duration
   * @param {number} delay - Animation delay
   */
  addScalePop(target, duration = 200, delay = 0) {
    target.setScale(0)
    this.tweens.add({
      targets: target,
      scale: 1,
      duration,
      delay,
      ease: 'Back.easeOut'
    })
  }
}

export default CoreBaseScene
