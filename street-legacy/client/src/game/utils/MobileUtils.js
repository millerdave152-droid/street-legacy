/**
 * MobileUtils - Device detection and mobile optimization utilities
 *
 * Provides:
 * - Device capability detection (hardware-based, not just user-agent)
 * - Responsive scaling calculations
 * - Touch-friendly hit area helpers
 * - Performance tier detection
 */

// Minimum touch target sizes (Apple HIG recommends 44pt)
export const TOUCH_TARGETS = {
  MINIMUM: 44,      // Absolute minimum for touch
  COMFORTABLE: 48,  // Comfortable touch target
  LARGE: 56,        // Large/important buttons
  EXTRA_LARGE: 64,  // Primary actions
}

// Performance tiers
export const PERFORMANCE_TIERS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
}

/**
 * Device capability detection
 */
export const DeviceCapabilities = {
  /**
   * Check if device supports touch input
   */
  isTouchDevice() {
    return 'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  },

  /**
   * Check if device is mobile based on user agent
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  },

  /**
   * Check if device is a tablet
   */
  isTablet() {
    return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
      (this.isTouchDevice() && Math.min(window.innerWidth, window.innerHeight) >= 600)
  },

  /**
   * Check if device is low-end based on hardware
   */
  isLowEndDevice() {
    // Check hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency || 2
    // Check device memory if available
    const memory = navigator.deviceMemory || 4

    return cores <= 4 || memory <= 2
  },

  /**
   * Get device pixel ratio (capped at 2 for performance)
   */
  getPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, 2)
  },

  /**
   * Check if screen is small (phone)
   */
  isSmallScreen() {
    return window.innerWidth < 400 || window.innerHeight < 700
  },

  /**
   * Check if screen is medium (large phone/small tablet)
   */
  isMediumScreen() {
    return window.innerWidth >= 400 && window.innerWidth < 600
  },

  /**
   * Check if screen is large (tablet/desktop)
   */
  isLargeScreen() {
    return window.innerWidth >= 600
  },

  /**
   * Check if device is in portrait orientation
   */
  isPortrait() {
    return window.innerHeight > window.innerWidth
  },

  /**
   * Check if device is in landscape orientation
   */
  isLandscape() {
    return window.innerWidth > window.innerHeight
  },

  /**
   * Get screen size category
   */
  getScreenCategory() {
    if (this.isSmallScreen()) return 'small'
    if (this.isMediumScreen()) return 'medium'
    return 'large'
  },

  /**
   * Get performance tier based on device capabilities
   */
  getPerformanceTier() {
    const cores = navigator.hardwareConcurrency || 2
    const memory = navigator.deviceMemory || 4
    const pixelRatio = this.getPixelRatio()

    // Calculate performance score
    const coreScore = Math.min(cores / 8, 1)
    const memoryScore = Math.min(memory / 8, 1)
    const pixelScore = pixelRatio >= 2 ? 1 : 0.7

    const score = (coreScore + memoryScore + pixelScore) / 3

    if (score >= 0.7) return PERFORMANCE_TIERS.HIGH
    if (score >= 0.4) return PERFORMANCE_TIERS.MEDIUM
    return PERFORMANCE_TIERS.LOW
  },

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  /**
   * Check if device supports haptic feedback
   */
  supportsHaptics() {
    return 'vibrate' in navigator
  },

  /**
   * Trigger haptic feedback
   */
  hapticFeedback(pattern = 10) {
    if (this.supportsHaptics()) {
      navigator.vibrate(pattern)
    }
  }
}

/**
 * Calculate responsive scale factor based on screen size
 * @param {number} baseWidth - Design base width (default 450)
 * @param {number} baseHeight - Design base height (default 800)
 * @returns {number} Scale factor
 */
export function getScaleFactor(baseWidth = 450, baseHeight = 800) {
  const width = window.innerWidth
  const height = window.innerHeight
  const scaleX = width / baseWidth
  const scaleY = height / baseHeight
  return Math.min(scaleX, scaleY, 1.2) // Cap at 1.2x to avoid oversized elements
}

/**
 * Get responsive font size
 * @param {number} baseSizePx - Base font size in pixels
 * @returns {string} Responsive font size with px unit
 */
export function getResponsiveFontSize(baseSizePx) {
  const scale = getScaleFactor()
  const isSmall = DeviceCapabilities.isSmallScreen()

  if (isSmall) {
    // Reduce by 2px on small screens
    baseSizePx = Math.max(baseSizePx - 2, 10)
  }

  const adjusted = Math.round(baseSizePx * scale)
  return Math.max(10, Math.min(adjusted, baseSizePx * 1.3)) + 'px'
}

/**
 * Get responsive spacing value
 * @param {number} baseSpacing - Base spacing in pixels
 * @returns {number} Responsive spacing value
 */
export function getResponsiveSpacing(baseSpacing) {
  const scale = getScaleFactor()
  return Math.round(baseSpacing * scale)
}

/**
 * Calculate expanded hit area for touch targets
 * @param {number} visualWidth - Visual element width
 * @param {number} visualHeight - Visual element height
 * @param {number} minSize - Minimum touch target size
 * @returns {object} Hit area dimensions
 */
export function calculateTouchHitArea(visualWidth, visualHeight, minSize = TOUCH_TARGETS.MINIMUM) {
  return {
    width: Math.max(visualWidth, minSize),
    height: Math.max(visualHeight, minSize),
    paddingX: Math.max(0, (minSize - visualWidth) / 2),
    paddingY: Math.max(0, (minSize - visualHeight) / 2)
  }
}

/**
 * Create an invisible touch hit area for a Phaser scene
 * @param {Phaser.Scene} scene - Phaser scene
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} visualWidth - Visual element width
 * @param {number} visualHeight - Visual element height
 * @param {number} minSize - Minimum touch target size
 * @returns {Phaser.GameObjects.Rectangle} Invisible hit area
 */
export function createTouchHitArea(scene, x, y, visualWidth, visualHeight, minSize = TOUCH_TARGETS.MINIMUM) {
  const hitArea = calculateTouchHitArea(visualWidth, visualHeight, minSize)

  return scene.add.rectangle(x, y, hitArea.width, hitArea.height, 0x000000, 0)
    .setInteractive({ useHandCursor: true })
}

/**
 * Get responsive layout values for a scene
 * @param {number} sceneWidth - Scene width
 * @param {number} sceneHeight - Scene height
 * @returns {object} Layout values
 */
export function getResponsiveLayout(sceneWidth, sceneHeight) {
  const isSmall = sceneWidth < 400
  const scale = getScaleFactor()

  return {
    TOP_BAR_HEIGHT: isSmall ? 50 : Math.round(60 * scale),
    BOTTOM_BAR_HEIGHT: isSmall ? 50 : Math.round(55 * scale),
    SAFE_AREA_TOP: isSmall ? 55 : Math.round(65 * scale),
    SAFE_AREA_BOTTOM: isSmall ? 55 : Math.round(60 * scale),
    SAFE_AREA_LEFT: Math.max(8, Math.round(10 * scale)),
    SAFE_AREA_RIGHT: Math.max(8, Math.round(10 * scale)),
    CARD_PADDING: isSmall ? 10 : Math.round(15 * scale),
    CARD_GAP: isSmall ? 8 : Math.round(10 * scale),
    BUTTON_HEIGHT: Math.max(40, Math.round(44 * scale)),
    BUTTON_MIN_WIDTH: Math.max(80, Math.round(100 * scale)),
  }
}

/**
 * Get responsive font sizes object
 * @returns {object} Font sizes object
 */
export function getResponsiveFontSizes() {
  const scale = getScaleFactor()
  const isSmall = DeviceCapabilities.isSmallScreen()

  return {
    xs: isSmall ? '9px' : Math.round(10 * scale) + 'px',
    sm: isSmall ? '11px' : Math.round(12 * scale) + 'px',
    md: isSmall ? '12px' : Math.round(14 * scale) + 'px',
    lg: isSmall ? '14px' : Math.round(16 * scale) + 'px',
    xl: isSmall ? '18px' : Math.round(20 * scale) + 'px',
    xxl: isSmall ? '20px' : Math.round(24 * scale) + 'px',
    display: isSmall ? '26px' : Math.round(32 * scale) + 'px',
  }
}

/**
 * Get responsive spacing object
 * @returns {object} Spacing values object
 */
export function getResponsiveSpacingValues() {
  const scale = getScaleFactor()

  return {
    xs: Math.round(4 * scale),
    sm: Math.round(8 * scale),
    md: Math.round(12 * scale),
    lg: Math.round(16 * scale),
    xl: Math.round(24 * scale),
    xxl: Math.round(32 * scale),
  }
}

/**
 * Detect if we should use simplified graphics
 * @returns {boolean} True if simplified graphics recommended
 */
export function shouldUseSimplifiedGraphics() {
  const tier = DeviceCapabilities.getPerformanceTier()
  const reducedMotion = DeviceCapabilities.prefersReducedMotion()

  return tier === PERFORMANCE_TIERS.LOW || reducedMotion
}

/**
 * Get recommended render settings based on device
 * @returns {object} Render configuration
 */
export function getAdaptiveRenderSettings() {
  const tier = DeviceCapabilities.getPerformanceTier()
  const isMobile = DeviceCapabilities.isMobile()

  const settings = {
    antialias: tier !== PERFORMANCE_TIERS.LOW,
    antialiasGL: tier === PERFORMANCE_TIERS.HIGH,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    batchSize: tier === PERFORMANCE_TIERS.LOW ? 2048 : 4096,
    roundPixels: true,
    maxLights: tier === PERFORMANCE_TIERS.LOW ? 4 : 10,
    targetFps: tier === PERFORMANCE_TIERS.LOW ? 30 : 60,
  }

  return settings
}

/**
 * Mobile settings storage
 */
const MOBILE_SETTINGS_KEY = 'street_legacy_mobile_settings'

export const MobileSettings = {
  defaults: {
    touchSensitivity: 'normal',    // 'low', 'normal', 'high'
    reduceMotion: false,           // Disable animations
    hapticFeedback: true,          // Vibration on touch
    autoQuality: true,             // Adaptive quality
    fontSize: 'normal',            // 'small', 'normal', 'large'
    highContrast: false,           // Accessibility
  },

  load() {
    try {
      const saved = localStorage.getItem(MOBILE_SETTINGS_KEY)
      return saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults }
    } catch {
      return { ...this.defaults }
    }
  },

  save(settings) {
    try {
      localStorage.setItem(MOBILE_SETTINGS_KEY, JSON.stringify(settings))
    } catch (e) {
      console.warn('Failed to save mobile settings:', e)
    }
  },

  get(key) {
    return this.load()[key]
  },

  set(key, value) {
    const settings = this.load()
    settings[key] = value
    this.save(settings)
  },

  reset() {
    this.save(this.defaults)
  }
}

export default {
  DeviceCapabilities,
  TOUCH_TARGETS,
  PERFORMANCE_TIERS,
  getScaleFactor,
  getResponsiveFontSize,
  getResponsiveSpacing,
  calculateTouchHitArea,
  createTouchHitArea,
  getResponsiveLayout,
  getResponsiveFontSizes,
  getResponsiveSpacingValues,
  shouldUseSimplifiedGraphics,
  getAdaptiveRenderSettings,
  MobileSettings
}
