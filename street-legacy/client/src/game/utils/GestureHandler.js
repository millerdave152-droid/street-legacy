/**
 * GestureHandler - Unified gesture detection for Phaser scenes
 *
 * Supports:
 * - Tap (with configurable threshold)
 * - Long press
 * - Swipe (4 directions)
 * - Double tap
 * - Pinch zoom (basic)
 * - Drag
 */

import { DeviceCapabilities } from './MobileUtils'

// Gesture types
export const GESTURE_TYPES = {
  TAP: 'tap',
  DOUBLE_TAP: 'doubleTap',
  LONG_PRESS: 'longPress',
  SWIPE_UP: 'swipeUp',
  SWIPE_DOWN: 'swipeDown',
  SWIPE_LEFT: 'swipeLeft',
  SWIPE_RIGHT: 'swipeRight',
  DRAG_START: 'dragStart',
  DRAG: 'drag',
  DRAG_END: 'dragEnd',
  PINCH: 'pinch'
}

// Default configuration
const DEFAULT_OPTIONS = {
  tapThreshold: 200,        // Max ms for tap
  longPressThreshold: 500,  // Min ms for long press
  swipeThreshold: 50,       // Min px for swipe
  swipeVelocity: 0.3,       // Min velocity (px/ms) for swipe
  doubleTapDelay: 300,      // Max ms between double taps
  dragThreshold: 10,        // Min px movement to start drag
  enabled: true
}

/**
 * GestureHandler class for a Phaser scene
 */
export class GestureHandler {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {object} options - Configuration options
   */
  constructor(scene, options = {}) {
    this.scene = scene
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // Pointer tracking
    this.pointers = new Map()
    this.lastTapTime = 0
    this.lastTapPosition = { x: 0, y: 0 }

    // Long press timer
    this.longPressTimer = null

    // Callbacks organized by gesture type
    this.callbacks = {}
    Object.values(GESTURE_TYPES).forEach(type => {
      this.callbacks[type] = []
    })

    // Drag state
    this.isDragging = false
    this.dragTarget = null

    // Active state
    this.enabled = this.options.enabled

    // Set up event listeners
    this.setupListeners()
  }

  /**
   * Set up Phaser input listeners
   */
  setupListeners() {
    this.scene.input.on('pointerdown', this.onPointerDown, this)
    this.scene.input.on('pointermove', this.onPointerMove, this)
    this.scene.input.on('pointerup', this.onPointerUp, this)
    this.scene.input.on('pointerupoutside', this.onPointerUp, this)
  }

  /**
   * Handle pointer down
   */
  onPointerDown(pointer) {
    if (!this.enabled) return

    const data = {
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      currentX: pointer.x,
      currentY: pointer.y,
      startTime: Date.now(),
      moved: false,
      target: pointer.downElement || null
    }

    this.pointers.set(pointer.id, data)

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      const pointerData = this.pointers.get(pointer.id)
      if (pointerData && !pointerData.moved) {
        this.emit(GESTURE_TYPES.LONG_PRESS, {
          x: pointerData.startX,
          y: pointerData.startY,
          target: pointerData.target
        })
        // Mark as handled to prevent tap
        pointerData.handled = true
      }
    }, this.options.longPressThreshold)

    // Haptic feedback on touch
    if (DeviceCapabilities.supportsHaptics()) {
      DeviceCapabilities.hapticFeedback(5)
    }
  }

  /**
   * Handle pointer move
   */
  onPointerMove(pointer) {
    if (!this.enabled) return

    const data = this.pointers.get(pointer.id)
    if (!data) return

    const dx = pointer.x - data.startX
    const dy = pointer.y - data.startY
    const distance = Math.sqrt(dx * dx + dy * dy)

    data.currentX = pointer.x
    data.currentY = pointer.y

    // Check if movement exceeds drag threshold
    if (distance > this.options.dragThreshold) {
      data.moved = true

      // Cancel long press if moved
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }

      // Start or continue drag
      if (!this.isDragging) {
        this.isDragging = true
        this.dragTarget = data.target
        this.emit(GESTURE_TYPES.DRAG_START, {
          x: data.startX,
          y: data.startY,
          target: data.target
        })
      }

      this.emit(GESTURE_TYPES.DRAG, {
        x: pointer.x,
        y: pointer.y,
        deltaX: dx,
        deltaY: dy,
        startX: data.startX,
        startY: data.startY,
        target: data.target
      })
    }
  }

  /**
   * Handle pointer up
   */
  onPointerUp(pointer) {
    if (!this.enabled) return

    const data = this.pointers.get(pointer.id)
    if (!data) return

    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }

    const duration = Date.now() - data.startTime
    const dx = pointer.x - data.startX
    const dy = pointer.y - data.startY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const velocity = distance / duration

    // End drag if active
    if (this.isDragging) {
      this.emit(GESTURE_TYPES.DRAG_END, {
        x: pointer.x,
        y: pointer.y,
        deltaX: dx,
        deltaY: dy,
        velocityX: dx / duration,
        velocityY: dy / duration,
        target: this.dragTarget
      })
      this.isDragging = false
      this.dragTarget = null
    }

    // Skip if already handled (long press)
    if (data.handled) {
      this.pointers.delete(pointer.id)
      return
    }

    // Detect gesture type
    if (!data.moved && duration < this.options.tapThreshold) {
      // Check for double tap
      const now = Date.now()
      const timeSinceLastTap = now - this.lastTapTime
      const distanceFromLastTap = Math.sqrt(
        Math.pow(pointer.x - this.lastTapPosition.x, 2) +
        Math.pow(pointer.y - this.lastTapPosition.y, 2)
      )

      if (timeSinceLastTap < this.options.doubleTapDelay && distanceFromLastTap < 30) {
        this.emit(GESTURE_TYPES.DOUBLE_TAP, {
          x: pointer.x,
          y: pointer.y,
          target: data.target
        })
        this.lastTapTime = 0 // Reset to prevent triple-tap detection
      } else {
        // Single tap
        this.emit(GESTURE_TYPES.TAP, {
          x: pointer.x,
          y: pointer.y,
          target: data.target
        })
        this.lastTapTime = now
        this.lastTapPosition = { x: pointer.x, y: pointer.y }
      }
    } else if (data.moved && distance >= this.options.swipeThreshold && velocity >= this.options.swipeVelocity) {
      // Swipe detected
      this.detectSwipeDirection(dx, dy, { velocity, distance, duration, target: data.target })
    }

    this.pointers.delete(pointer.id)
  }

  /**
   * Detect and emit swipe direction
   */
  detectSwipeDirection(dx, dy, data) {
    const angle = Math.atan2(dy, dx)

    // Convert to degrees for easier understanding
    const degrees = angle * (180 / Math.PI)

    if (degrees > -45 && degrees <= 45) {
      this.emit(GESTURE_TYPES.SWIPE_RIGHT, { ...data, direction: 'right' })
    } else if (degrees > 45 && degrees <= 135) {
      this.emit(GESTURE_TYPES.SWIPE_DOWN, { ...data, direction: 'down' })
    } else if (degrees > -135 && degrees <= -45) {
      this.emit(GESTURE_TYPES.SWIPE_UP, { ...data, direction: 'up' })
    } else {
      this.emit(GESTURE_TYPES.SWIPE_LEFT, { ...data, direction: 'left' })
    }
  }

  /**
   * Register a callback for a gesture type
   * @param {string} gestureType - Gesture type from GESTURE_TYPES
   * @param {function} callback - Callback function
   * @returns {GestureHandler} this for chaining
   */
  on(gestureType, callback) {
    if (this.callbacks[gestureType]) {
      this.callbacks[gestureType].push(callback)
    }
    return this
  }

  /**
   * Remove a callback for a gesture type
   * @param {string} gestureType - Gesture type
   * @param {function} callback - Callback to remove
   * @returns {GestureHandler} this for chaining
   */
  off(gestureType, callback) {
    if (this.callbacks[gestureType]) {
      this.callbacks[gestureType] = this.callbacks[gestureType].filter(cb => cb !== callback)
    }
    return this
  }

  /**
   * Remove all callbacks for a gesture type or all types
   * @param {string} gestureType - Optional gesture type
   * @returns {GestureHandler} this for chaining
   */
  offAll(gestureType = null) {
    if (gestureType) {
      this.callbacks[gestureType] = []
    } else {
      Object.keys(this.callbacks).forEach(type => {
        this.callbacks[type] = []
      })
    }
    return this
  }

  /**
   * Emit a gesture event
   */
  emit(gestureType, data) {
    const callbacks = this.callbacks[gestureType] || []
    callbacks.forEach(cb => {
      try {
        cb(data)
      } catch (e) {
        console.error(`[GestureHandler] Error in ${gestureType} callback:`, e)
      }
    })
  }

  /**
   * Enable gesture detection
   */
  enable() {
    this.enabled = true
    return this
  }

  /**
   * Disable gesture detection
   */
  disable() {
    this.enabled = false
    return this
  }

  /**
   * Check if a gesture type has any callbacks
   */
  hasListeners(gestureType) {
    return this.callbacks[gestureType] && this.callbacks[gestureType].length > 0
  }

  /**
   * Update options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options }
    return this
  }

  /**
   * Clean up and destroy
   */
  destroy() {
    // Clear timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
    }

    // Remove Phaser listeners
    this.scene.input.off('pointerdown', this.onPointerDown, this)
    this.scene.input.off('pointermove', this.onPointerMove, this)
    this.scene.input.off('pointerup', this.onPointerUp, this)
    this.scene.input.off('pointerupoutside', this.onPointerUp, this)

    // Clear state
    this.pointers.clear()
    this.callbacks = {}
    this.isDragging = false
    this.dragTarget = null
  }
}

/**
 * Create a gesture handler with common scroll behavior
 * @param {Phaser.Scene} scene - Phaser scene
 * @param {object} scrollConfig - Scroll configuration
 * @returns {GestureHandler} Configured gesture handler
 */
export function createScrollGestureHandler(scene, scrollConfig = {}) {
  const {
    onScroll = () => {},
    scrollSpeed = 1,
    momentum = true,
    momentumDecay = 0.95
  } = scrollConfig

  const handler = new GestureHandler(scene)

  let scrollVelocity = 0
  let lastScrollY = 0
  let momentumInterval = null

  handler.on(GESTURE_TYPES.DRAG, (data) => {
    const deltaY = data.y - lastScrollY
    lastScrollY = data.y
    scrollVelocity = deltaY

    onScroll(-deltaY * scrollSpeed)
  })

  handler.on(GESTURE_TYPES.DRAG_START, (data) => {
    lastScrollY = data.y
    scrollVelocity = 0

    if (momentumInterval) {
      clearInterval(momentumInterval)
      momentumInterval = null
    }
  })

  handler.on(GESTURE_TYPES.DRAG_END, (data) => {
    if (momentum && Math.abs(scrollVelocity) > 1) {
      momentumInterval = setInterval(() => {
        scrollVelocity *= momentumDecay
        onScroll(-scrollVelocity * scrollSpeed)

        if (Math.abs(scrollVelocity) < 0.5) {
          clearInterval(momentumInterval)
          momentumInterval = null
        }
      }, 16) // ~60fps
    }
  })

  // Store cleanup function
  const originalDestroy = handler.destroy.bind(handler)
  handler.destroy = () => {
    if (momentumInterval) {
      clearInterval(momentumInterval)
    }
    originalDestroy()
  }

  return handler
}

export default GestureHandler
