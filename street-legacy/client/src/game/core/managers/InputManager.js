/**
 * InputManager - Centralized input handling for Phaser scenes
 *
 * Core engine component - no game-specific logic.
 *
 * Provides a unified interface for:
 * - Keyboard input (confirm, cancel, navigate, pause)
 * - Touch/pointer input normalization
 * - Input event callbacks
 * - Input state tracking
 *
 * Usage:
 *   this.inputManager = new InputManager(this)
 *   this.inputManager.on('confirm', () => this.handleConfirm())
 *   this.inputManager.on('cancel', () => this.handleCancel())
 *   this.inputManager.setupKeyboard()
 */
export class InputManager {
  constructor(scene, config = {}) {
    this.scene = scene

    // Configurable key bindings
    this.keyBindings = {
      confirm: config.confirmKeys || ['ENTER', 'SPACE'],
      cancel: config.cancelKeys || ['ESC'],
      up: config.upKeys || ['UP', 'W'],
      down: config.downKeys || ['DOWN', 'S'],
      left: config.leftKeys || ['LEFT', 'A'],
      right: config.rightKeys || ['RIGHT', 'D'],
      pause: config.pauseKeys || ['P']
    }

    // Event callbacks
    this.callbacks = {
      confirm: [],
      cancel: [],
      up: [],
      down: [],
      left: [],
      right: [],
      navigate: [], // Fires for any direction
      pause: []
    }

    // Input state
    this.enabled = true
    this.keys = {}

    // Bind cleanup
    this.scene.events.once('shutdown', () => this.destroy())
    this.scene.events.once('destroy', () => this.destroy())
  }

  /**
   * Set up keyboard input handlers
   * Call this in your scene's create() method
   */
  setupKeyboard() {
    // Create key objects for all bindings
    Object.entries(this.keyBindings).forEach(([action, keys]) => {
      this.keys[action] = keys.map(key => {
        return this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[key])
      })
    })

    // Set up key handlers
    this.scene.input.keyboard.on('keydown', (event) => {
      if (!this.enabled) return

      const keyCode = event.keyCode

      // Check confirm keys
      if (this.isKeyInBinding('confirm', keyCode)) {
        this.emit('confirm', event)
      }

      // Check cancel keys
      if (this.isKeyInBinding('cancel', keyCode)) {
        this.emit('cancel', event)
      }

      // Check directional keys
      if (this.isKeyInBinding('up', keyCode)) {
        this.emit('up', event)
        this.emit('navigate', { direction: 'up', event })
      }
      if (this.isKeyInBinding('down', keyCode)) {
        this.emit('down', event)
        this.emit('navigate', { direction: 'down', event })
      }
      if (this.isKeyInBinding('left', keyCode)) {
        this.emit('left', event)
        this.emit('navigate', { direction: 'left', event })
      }
      if (this.isKeyInBinding('right', keyCode)) {
        this.emit('right', event)
        this.emit('navigate', { direction: 'right', event })
      }

      // Check pause keys
      if (this.isKeyInBinding('pause', keyCode)) {
        this.emit('pause', event)
      }
    })
  }

  /**
   * Check if a keyCode matches a binding
   */
  isKeyInBinding(action, keyCode) {
    const keys = this.keyBindings[action] || []
    return keys.some(keyName => {
      return Phaser.Input.Keyboard.KeyCodes[keyName] === keyCode
    })
  }

  /**
   * Register an event callback
   * @param {string} event - Event name (confirm, cancel, up, down, left, right, navigate, pause)
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.callbacks[event]) {
      console.warn(`[InputManager] Unknown event: ${event}`)
      return () => {}
    }

    this.callbacks[event].push(callback)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  /**
   * Remove an event callback
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove
   */
  off(event, callback) {
    if (!this.callbacks[event]) return

    const index = this.callbacks[event].indexOf(callback)
    if (index !== -1) {
      this.callbacks[event].splice(index, 1)
    }
  }

  /**
   * Emit an event to all registered callbacks
   * @param {string} event - Event name
   * @param {any} data - Data to pass to callbacks
   */
  emit(event, data) {
    if (!this.callbacks[event]) return

    this.callbacks[event].forEach(callback => {
      try {
        callback(data)
      } catch (e) {
        console.error(`[InputManager] Error in ${event} callback:`, e)
      }
    })
  }

  /**
   * Check if a key is currently pressed
   * @param {string} action - Action name (confirm, cancel, up, down, left, right, pause)
   * @returns {boolean}
   */
  isPressed(action) {
    if (!this.keys[action]) return false

    return this.keys[action].some(key => key.isDown)
  }

  /**
   * Check if a key was just pressed this frame
   * @param {string} action - Action name
   * @returns {boolean}
   */
  justPressed(action) {
    if (!this.keys[action]) return false

    return this.keys[action].some(key => Phaser.Input.Keyboard.JustDown(key))
  }

  /**
   * Enable input handling
   */
  enable() {
    this.enabled = true
  }

  /**
   * Disable input handling
   */
  disable() {
    this.enabled = false
  }

  /**
   * Get normalized pointer position (0-1 range)
   * Useful for touch input normalization
   * @param {Phaser.Input.Pointer} pointer
   * @returns {{x: number, y: number}}
   */
  getNormalizedPointer(pointer) {
    return {
      x: pointer.x / this.scene.cameras.main.width,
      y: pointer.y / this.scene.cameras.main.height
    }
  }

  /**
   * Check if pointer is in a specific region
   * @param {Phaser.Input.Pointer} pointer
   * @param {Object} bounds - {x, y, width, height}
   * @returns {boolean}
   */
  isPointerInBounds(pointer, bounds) {
    return (
      pointer.x >= bounds.x &&
      pointer.x <= bounds.x + bounds.width &&
      pointer.y >= bounds.y &&
      pointer.y <= bounds.y + bounds.height
    )
  }

  /**
   * Cleanup
   */
  destroy() {
    // Clear all callbacks
    Object.keys(this.callbacks).forEach(event => {
      this.callbacks[event] = []
    })

    // Clear key references
    this.keys = {}
    this.enabled = false
  }
}

export default InputManager
