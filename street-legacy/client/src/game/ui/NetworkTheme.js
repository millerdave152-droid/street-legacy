/**
 * THE NETWORK - Street Legacy Design System
 *
 * 80s/90s Raw Encrypted Communication Hub Aesthetic
 * "Where you are is where you're at"
 *
 * Visual Language:
 * - CRT monitor glow effects
 * - VHS tracking lines and static
 * - Burner phone interface elements
 * - Raw, unfiltered colors
 * - Surveillance/intercept motif
 */

// =============================================================================
// COLOR PALETTE - Raw 80s/90s Street
// =============================================================================

export const COLORS = {
  // Primary backgrounds - dark, grimy, real
  bg: {
    void: 0x000000,        // Pure black - the darkness
    screen: 0x0a0a0a,      // CRT off-black
    panel: 0x111111,       // Panel background
    card: 0x1a1a1a,        // Card surface
    elevated: 0x222222,    // Elevated elements
  },

  // The Network accent colors - surveillance green
  network: {
    primary: 0x00ff41,     // Classic terminal green
    dim: 0x00aa2a,         // Dimmed green
    glow: 0x33ff66,        // Bright glow
    dark: 0x003311,        // Dark green tint
  },

  // Alert/Status colors - raw and urgent
  status: {
    danger: 0xff0040,      // Hot pink-red (heat, danger)
    warning: 0xffaa00,     // Amber warning
    success: 0x00ff41,     // Network green
    info: 0x00aaff,        // Cool blue info
    neutral: 0x666666,     // Gray neutral
  },

  // Street cred colors - the currency of respect
  cred: {
    gold: 0xffd700,        // Real gold
    silver: 0xc0c0c0,      // Silver
    bronze: 0xcd7f32,      // Bronze
    platinum: 0xe5e4e2,    // Platinum
  },

  // Faction colors - territory markers
  faction: {
    heat: 0xff0040,        // Police heat - hot red
    gang: 0x8b00ff,        // Gang purple
    cartel: 0xff6600,      // Cartel orange
    mob: 0x1a1a1a,         // Mob black
    street: 0x00ff41,      // Street green
  },

  // Text colors
  text: {
    primary: 0xffffff,     // Bright white
    secondary: 0xaaaaaa,   // Dimmed
    muted: 0x666666,       // Very dim
    glow: 0x00ff41,        // Terminal glow
    danger: 0xff0040,      // Warning text
    gold: 0xffd700,        // Reward/money
  },

  // VHS/CRT effect colors
  vhs: {
    scanline: 0x000000,    // Scanline dark
    tracking: 0xff0040,    // Tracking error pink
    static: 0x333333,      // Static noise
    glow: 0x00ff41,        // Screen glow
  }
}

// =============================================================================
// TYPOGRAPHY - Raw Street Fonts
// =============================================================================

export const FONTS = {
  // Primary display font - modern hacker monospace
  terminal: {
    fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
    letterSpacing: 0.5,
  },

  // Headers - bold and loud
  header: {
    fontFamily: '"JetBrains Mono", "Arial Black", sans-serif',
    fontStyle: 'bold',
  },

  // Body text - clean but raw
  body: {
    fontFamily: '"JetBrains Mono", Arial, sans-serif',
  },

  // Numbers/stats - monospace for alignment
  stats: {
    fontFamily: '"JetBrains Mono", "Courier New", monospace',
  }
}

// Font size scale
export const FONT_SIZES = {
  xs: '10px',
  sm: '12px',
  md: '14px',
  lg: '16px',
  xl: '20px',
  '2xl': '28px',
  xxl: '24px',
  display: '32px',
}

// =============================================================================
// SPACING & DIMENSIONS
// =============================================================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const BORDERS = {
  thin: 1,
  medium: 2,
  thick: 3,
  glow: 4,
}

// =============================================================================
// DEPTH LAYERS - Standardized Z-Index System
// =============================================================================

export const DEPTH = {
  // Base layers (0-99)
  BACKGROUND: 0,
  SCANLINES: 1,
  GRID: 2,

  // Content layers (100-499)
  CONTENT_BASE: 100,
  CARDS: 150,
  PANELS: 200,
  PANEL_CONTENT: 250,
  STATS_BAR: 300,
  LIST_ITEMS: 350,

  // Interactive layers (500-999)
  BUTTONS: 500,
  TOOLTIPS: 600,
  DROPDOWNS: 700,
  CLOSE_BUTTON: 800,

  // Overlay layers (1000-4999)
  MODAL_BACKDROP: 1000,
  MODAL: 1100,
  MODAL_CONTENT: 1200,
  MODAL_BUTTONS: 1300,

  // System layers (5000-9999)
  NOTIFICATIONS: 5000,
  TOAST: 5500,
  ALERTS: 6000,

  // UI Scene layers (10000+) - Always on top
  UI_BAR_BG: 10000,
  UI_BAR_CONTENT: 10001,
  UI_BAR_INTERACTIVE: 10002,
}

// =============================================================================
// LAYOUT - Consistent Spacing & Dimensions
// =============================================================================

export const LAYOUT = {
  // Bar heights
  TOP_BAR_HEIGHT: 60,
  BOTTOM_BAR_HEIGHT: 55,

  // Safe areas (content should stay within these)
  SAFE_AREA_TOP: 65,
  SAFE_AREA_BOTTOM: 60,
  SAFE_AREA_LEFT: 10,
  SAFE_AREA_RIGHT: 10,

  // Card dimensions
  CARD_PADDING: 15,
  CARD_GAP: 10,
  CARD_BORDER_RADIUS: 4,

  // Scroll settings
  SCROLL_PADDING: 20,
  SCROLL_BAR_WIDTH: 8,

  // Modal dimensions
  MODAL_WIDTH: 320,
  MODAL_PADDING: 20,

  // Button dimensions
  BUTTON_HEIGHT: 40,
  BUTTON_MIN_WIDTH: 100,
}

/**
 * Helper to calculate scroll bounds for a scene
 * @param {Phaser.Scene} scene - The Phaser scene
 * @returns {object} Scroll bounds { top, bottom, height, left, right, width }
 */
export function getScrollBounds(scene) {
  const { width, height } = scene.cameras.main
  return {
    top: LAYOUT.SAFE_AREA_TOP,
    bottom: height - LAYOUT.SAFE_AREA_BOTTOM,
    height: height - LAYOUT.SAFE_AREA_TOP - LAYOUT.SAFE_AREA_BOTTOM,
    left: LAYOUT.SAFE_AREA_LEFT,
    right: width - LAYOUT.SAFE_AREA_RIGHT,
    width: width - LAYOUT.SAFE_AREA_LEFT - LAYOUT.SAFE_AREA_RIGHT,
  }
}

// =============================================================================
// VISUAL EFFECTS - CRT/VHS Aesthetic
// =============================================================================

export const EFFECTS = {
  // Glow intensities
  glow: {
    none: 0,
    subtle: 0.3,
    medium: 0.5,
    strong: 0.8,
    intense: 1.0,
  },

  // Animation durations
  duration: {
    instant: 50,
    fast: 100,
    normal: 200,
    slow: 400,
    dramatic: 800,
  },

  // Scanline settings
  scanlines: {
    spacing: 3,
    opacity: 0.08,
    speed: 2000,
  },

  // Static/noise settings
  static: {
    intensity: 0.05,
    speed: 100,
  },

  // Glitch effect settings
  glitch: {
    probability: 0.02,
    duration: 50,
    offset: 3,
  }
}

// =============================================================================
// UI ELEMENT STYLES
// =============================================================================

export const STYLES = {
  // Panel/Card base styles
  panel: {
    backgroundColor: COLORS.bg.panel,
    borderColor: COLORS.network.dim,
    borderWidth: BORDERS.thin,
    cornerRadius: 2, // Sharp corners for raw look
  },

  // Button styles
  button: {
    primary: {
      bg: COLORS.network.dark,
      border: COLORS.network.primary,
      text: COLORS.network.primary,
      hoverBg: COLORS.network.dim,
      hoverBorder: COLORS.network.glow,
    },
    danger: {
      bg: 0x1a0010,
      border: COLORS.status.danger,
      text: COLORS.status.danger,
      hoverBg: 0x2a0020,
      hoverBorder: 0xff3366,
    },
    secondary: {
      bg: COLORS.bg.elevated,
      border: COLORS.text.muted,
      text: COLORS.text.secondary,
      hoverBg: COLORS.bg.card,
      hoverBorder: COLORS.text.secondary,
    }
  },

  // Input field styles
  input: {
    bg: COLORS.bg.void,
    border: COLORS.network.dim,
    text: COLORS.network.primary,
    placeholder: COLORS.text.muted,
    focusBorder: COLORS.network.primary,
  },

  // Tab styles
  tab: {
    inactive: {
      bg: COLORS.bg.panel,
      text: COLORS.text.muted,
      border: 0x333333,
    },
    active: {
      bg: COLORS.bg.card,
      text: COLORS.network.primary,
      border: COLORS.network.primary,
    }
  },

  // Badge/notification styles
  badge: {
    alert: {
      bg: COLORS.status.danger,
      text: COLORS.text.primary,
    },
    success: {
      bg: COLORS.network.primary,
      text: COLORS.bg.void,
    },
    info: {
      bg: COLORS.status.info,
      text: COLORS.text.primary,
    }
  },

  // Progress bar styles
  progress: {
    bg: COLORS.bg.void,
    fill: COLORS.network.primary,
    border: COLORS.network.dim,
  }
}

// =============================================================================
// TEXT SYMBOLS - Network Communication Icons
// =============================================================================

export const SYMBOLS = {
  // Navigation/UI
  back: '\u25C0',          // Black left-pointing triangle
  forward: '\u25B6',       // Black right-pointing triangle
  up: '\u25B2',            // Black up-pointing triangle
  down: '\u25BC',          // Black down-pointing triangle
  close: '\u2715',         // Multiplication X
  check: '\u2713',         // Check mark
  bullet: '\u25AA',        // Black small square

  // Network/Status
  signal: '\u2759',        // Signal bars (using vertical lines)
  encrypted: '\u25A0',     // Filled square (encrypted)
  decrypted: '\u25A1',     // Empty square (decrypted)
  connected: '\u25CF',     // Filled circle
  disconnected: '\u25CB',  // Empty circle

  // Actions
  transmit: '\u25B8',      // Black right-pointing small triangle
  receive: '\u25C2',       // Black left-pointing small triangle
  alert: '\u25B3',         // White up-pointing triangle (warning)
  locked: '\u25A0',        // Locked (filled)
  unlocked: '\u25A1',      // Unlocked (empty)

  // Status indicators
  online: '[\u25CF]',      // [*] Online
  offline: '[\u25CB]',     // [o] Offline
  busy: '[\u25AA]',        // [-] Busy
  recording: '\u25CF REC', // Recording indicator

  // Currency/Value
  cash: '$',
  cred: '\u2605',          // Black star
  heat: '\u25B2',          // Up arrow (heat rising)
  star: '\u2605',          // Filled star (favorited)
  starEmpty: '\u2606',     // Empty star (not favorited)

  // Message types
  incoming: '>>',
  outgoing: '<<',
  system: '::',
  encrypted_msg: '[ENC]',

  // Network indicators
  network: '[N]',
  inbox: '[I]',
  contacts: '[C]',
  ops: '[O]',
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert hex color to CSS string
 * @param {number} hex - Hex color value
 * @returns {string} CSS hex string
 */
export function toHexString(hex) {
  return '#' + hex.toString(16).padStart(6, '0')
}

/**
 * Get text style object for Phaser
 * @param {string} size - Font size key
 * @param {number} color - Color value
 * @param {string} style - 'terminal' | 'header' | 'body' | 'stats'
 * @returns {object} Phaser text style object
 */
export function getTextStyle(size = 'md', color = COLORS.text.primary, style = 'body') {
  const fontConfig = FONTS[style] || FONTS.body
  return {
    fontSize: FONT_SIZES[size] || size,
    fontFamily: fontConfig.fontFamily,
    fontStyle: fontConfig.fontStyle || 'normal',
    color: toHexString(color),
  }
}

/**
 * Get terminal-style text (green on black)
 * @param {string} size - Font size key
 * @returns {object} Phaser text style object
 */
export function getTerminalStyle(size = 'md') {
  return getTextStyle(size, COLORS.network.primary, 'terminal')
}

/**
 * Format text as "encrypted" network message
 * @param {string} text - Text to format
 * @param {string} prefix - Message prefix
 * @returns {string} Formatted message
 */
export function formatNetworkMessage(text, prefix = '>>') {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
  return `[${timestamp}] ${prefix} ${text}`
}

/**
 * Generate "static" noise characters
 * @param {number} length - Number of characters
 * @returns {string} Static noise string
 */
export function generateStatic(length = 10) {
  const chars = '\u2588\u2593\u2592\u2591 '
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * Create glitched text effect
 * @param {string} text - Original text
 * @param {number} intensity - Glitch intensity 0-1
 * @returns {string} Glitched text
 */
export function glitchText(text, intensity = 0.1) {
  const glitchChars = '\u2588\u2593\u2592\u2591\u25A0\u25AA'
  return text.split('').map(char => {
    if (Math.random() < intensity) {
      return glitchChars[Math.floor(Math.random() * glitchChars.length)]
    }
    return char
  }).join('')
}

// =============================================================================
// SCENE HELPERS - Apply Theme to Phaser Scenes
// =============================================================================

/**
 * Create a themed panel background
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Panel width
 * @param {number} height - Panel height
 * @param {object} options - Additional options
 * @returns {Phaser.GameObjects.Rectangle}
 */
export function createPanel(scene, x, y, width, height, options = {}) {
  const {
    bg = COLORS.bg.panel,
    border = COLORS.network.dim,
    borderWidth = BORDERS.thin,
    alpha = 0.95,
  } = options

  const panel = scene.add.rectangle(x, y, width, height, bg, alpha)
  panel.setStrokeStyle(borderWidth, border)
  return panel
}

/**
 * Create a themed button
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Button text
 * @param {Function} callback - Click callback
 * @param {string} variant - 'primary' | 'danger' | 'secondary'
 * @returns {Phaser.GameObjects.Container}
 */
export function createButton(scene, x, y, text, callback, variant = 'primary') {
  const style = STYLES.button[variant]
  const container = scene.add.container(x, y)

  // Background
  const bg = scene.add.rectangle(0, 0, 120, 36, style.bg, 0.9)
  bg.setStrokeStyle(BORDERS.thin, style.border)

  // Text
  const label = scene.add.text(0, 0, text.toUpperCase(), {
    ...getTextStyle('sm', style.text, 'terminal'),
  }).setOrigin(0.5)

  container.add([bg, label])

  // Interactive
  bg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => {
      bg.setFillStyle(style.hoverBg)
      bg.setStrokeStyle(BORDERS.medium, style.hoverBorder)
    })
    .on('pointerout', () => {
      bg.setFillStyle(style.bg, 0.9)
      bg.setStrokeStyle(BORDERS.thin, style.border)
    })
    .on('pointerdown', () => {
      scene.tweens.add({
        targets: container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: callback
      })
    })

  return container
}

/**
 * Create header with Network styling
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} text - Header text
 * @param {number} y - Y position
 * @returns {Phaser.GameObjects.Container}
 */
export function createHeader(scene, text, y = 50) {
  const { width } = scene.cameras.main
  const container = scene.add.container(width / 2, y)

  // Decorative lines
  const lineLeft = scene.add.rectangle(-140, 0, 60, 2, COLORS.network.dim)
  const lineRight = scene.add.rectangle(140, 0, 60, 2, COLORS.network.dim)

  // Header text
  const header = scene.add.text(0, 0, text.toUpperCase(), {
    ...getTextStyle('xl', COLORS.network.primary, 'terminal'),
  }).setOrigin(0.5)

  container.add([lineLeft, header, lineRight])

  return container
}

/**
 * Create "REC" indicator for surveillance feel
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {Phaser.GameObjects.Container}
 */
export function createRecIndicator(scene, x, y) {
  const container = scene.add.container(x, y)

  // Red dot
  const dot = scene.add.circle(0, 0, 5, COLORS.status.danger)

  // REC text
  const text = scene.add.text(12, 0, 'REC', {
    ...getTextStyle('xs', COLORS.status.danger, 'terminal'),
  }).setOrigin(0, 0.5)

  container.add([dot, text])

  // Blinking animation
  scene.tweens.add({
    targets: dot,
    alpha: { from: 1, to: 0.3 },
    duration: 500,
    yoyo: true,
    repeat: -1,
  })

  return container
}

/**
 * Create timestamp display
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {Phaser.GameObjects.Text}
 */
export function createTimestamp(scene, x, y) {
  const updateTime = () => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const text = scene.add.text(x, y, updateTime(), {
    ...getTextStyle('xs', COLORS.network.dim, 'terminal'),
  }).setOrigin(1, 0.5)

  // Update every second
  scene.time.addEvent({
    delay: 1000,
    callback: () => {
      if (text.active) {
        text.setText(updateTime())
      }
    },
    loop: true
  })

  return text
}

// =============================================================================
// ADVANCED GLOW & STYLING UTILITIES - Underground Network Aesthetics
// =============================================================================

/**
 * Create a glowing border effect around a rectangle
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} color - Glow color
 * @param {object} options - Additional options
 * @returns {Phaser.GameObjects.Container}
 */
export function createGlowBorder(scene, x, y, width, height, color = COLORS.network.primary, options = {}) {
  const {
    glowIntensity = 0.4,
    pulseSpeed = 2000,
    animated = true,
    depth = 0
  } = options

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  // Outer glow (larger, more diffuse)
  const outerGlow = scene.add.rectangle(0, 0, width + 8, height + 8, color, glowIntensity * 0.3)
  outerGlow.setStrokeStyle(0)

  // Middle glow
  const midGlow = scene.add.rectangle(0, 0, width + 4, height + 4, color, glowIntensity * 0.5)
  midGlow.setStrokeStyle(0)

  // Inner border (sharp)
  const innerBorder = scene.add.rectangle(0, 0, width, height)
  innerBorder.setFillStyle(0x000000, 0)
  innerBorder.setStrokeStyle(BORDERS.medium, color, 0.9)

  container.add([outerGlow, midGlow, innerBorder])

  // Pulsing animation
  if (animated) {
    scene.tweens.add({
      targets: [outerGlow, midGlow],
      alpha: { from: glowIntensity * 0.3, to: glowIntensity * 0.6 },
      duration: pulseSpeed,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  return container
}

/**
 * Create an enhanced Network-style header with glow and scanline
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} title - Header title
 * @param {string} subtitle - Optional subtitle
 * @param {number} y - Y position
 * @param {number} color - Accent color
 * @returns {Phaser.GameObjects.Container}
 */
export function createNetworkHeader(scene, title, subtitle = null, y = 40, color = COLORS.network.primary) {
  const { width } = scene.cameras.main
  const container = scene.add.container(width / 2, y)
  container.setDepth(102)

  // Glowing accent line under header
  const glowLine = scene.add.rectangle(0, 25, width - 60, 2, color, 0.8)
  const glowLineSoft = scene.add.rectangle(0, 25, width - 60, 6, color, 0.2)

  // Title with terminal bracket styling
  const titleText = scene.add.text(0, 0, `[ ${title.toUpperCase()} ]`, {
    fontFamily: '"Courier New", monospace',
    fontSize: '20px',
    color: toHexString(color),
    fontStyle: 'bold'
  }).setOrigin(0.5)

  container.add([glowLineSoft, glowLine, titleText])

  // Subtitle if provided
  if (subtitle) {
    const subText = scene.add.text(0, 40, subtitle, {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    container.add(subText)
  }

  // Subtle pulse animation on glow line
  scene.tweens.add({
    targets: glowLineSoft,
    alpha: { from: 0.2, to: 0.4 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  })

  return container
}

/**
 * Create a stat display with terminal styling and optional glow
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} label - Stat label (e.g., "CASH", "HEAT")
 * @param {string} value - Stat value
 * @param {number} color - Value color
 * @param {object} options - Additional options
 * @returns {Phaser.GameObjects.Container}
 */
export function createStatDisplay(scene, x, y, label, value, color = COLORS.network.primary, options = {}) {
  const {
    showGlow = true,
    labelColor = COLORS.text.muted,
    width = 100,
    height = 36,
    depth = 100
  } = options

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  // Background with subtle border
  const bg = scene.add.rectangle(0, 0, width, height, COLORS.bg.void, 0.9)
  bg.setStrokeStyle(1, color, 0.4)

  // Glow effect on left edge
  if (showGlow) {
    const edgeGlow = scene.add.rectangle(-width/2 + 2, 0, 4, height - 4, color, 0.6)
    container.add(edgeGlow)
  }

  // Label (smaller, muted)
  const labelText = scene.add.text(-width/2 + 10, -6, label, {
    fontFamily: '"Courier New", monospace',
    fontSize: '8px',
    color: toHexString(labelColor)
  }).setOrigin(0, 0.5)

  // Value (larger, colored)
  const valueText = scene.add.text(0, 6, value, {
    fontFamily: '"Courier New", monospace',
    fontSize: '14px',
    color: toHexString(color),
    fontStyle: 'bold'
  }).setOrigin(0.5, 0.5)

  container.add([bg, labelText, valueText])

  // Store reference to value text for updates
  container.setData('valueText', valueText)

  return container
}

/**
 * Create a Network-style action button with glow hover effects
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Button text
 * @param {Function} onClick - Click callback
 * @param {object} options - Styling options
 * @returns {Phaser.GameObjects.Container}
 */
export function createNetworkButton(scene, x, y, text, onClick, options = {}) {
  const {
    width = 120,
    height = 40,
    color = COLORS.network.primary,
    bgColor = COLORS.bg.panel,
    depth = 100,
    icon = null
  } = options

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  // Glow background (hidden by default)
  const glowBg = scene.add.rectangle(0, 0, width + 6, height + 6, color, 0)

  // Main background
  const bg = scene.add.rectangle(0, 0, width, height, bgColor, 0.95)
  bg.setStrokeStyle(BORDERS.medium, color, 0.7)
  bg.setInteractive({ useHandCursor: true })

  // Icon + Text
  let displayText = text.toUpperCase()
  if (icon) displayText = `${icon} ${displayText}`

  const label = scene.add.text(0, 0, displayText, {
    fontFamily: '"Courier New", monospace',
    fontSize: '12px',
    color: toHexString(color),
    fontStyle: 'bold'
  }).setOrigin(0.5)

  container.add([glowBg, bg, label])

  // Hover effects
  bg.on('pointerover', () => {
    bg.setFillStyle(color, 0.15)
    bg.setStrokeStyle(BORDERS.thick, color, 1)
    glowBg.setAlpha(0.2)
    scene.tweens.add({
      targets: container,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 100,
      ease: 'Power2'
    })
  })

  bg.on('pointerout', () => {
    bg.setFillStyle(bgColor, 0.95)
    bg.setStrokeStyle(BORDERS.medium, color, 0.7)
    glowBg.setAlpha(0)
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Power2'
    })
  })

  bg.on('pointerdown', () => {
    scene.tweens.add({
      targets: container,
      scaleX: 0.97,
      scaleY: 0.97,
      duration: 50,
      yoyo: true,
      onComplete: onClick
    })
  })

  return container
}

/**
 * Create encrypted transmission indicator (animated)
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {Phaser.GameObjects.Container}
 */
export function createEncryptedIndicator(scene, x, y) {
  const container = scene.add.container(x, y)

  // Lock icon
  const lockText = scene.add.text(0, 0, '🔒', {
    fontSize: '12px'
  }).setOrigin(0.5)

  // ENCRYPTED text
  const encText = scene.add.text(18, 0, 'ENCRYPTED', {
    fontFamily: '"Courier New", monospace',
    fontSize: '9px',
    color: toHexString(COLORS.network.primary),
    fontStyle: 'bold'
  }).setOrigin(0, 0.5)

  container.add([lockText, encText])

  // Subtle pulse
  scene.tweens.add({
    targets: encText,
    alpha: { from: 1, to: 0.6 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  })

  return container
}

/**
 * Create NODE ID badge (shows player's network identity)
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} nodeId - Node identifier
 * @returns {Phaser.GameObjects.Container}
 */
export function createNodeBadge(scene, x, y, nodeId = 'NODE-7X2K') {
  const container = scene.add.container(x, y)

  // Background
  const bg = scene.add.rectangle(0, 0, 90, 22, COLORS.bg.void, 0.9)
  bg.setStrokeStyle(1, COLORS.network.dim, 0.6)

  // Node text
  const text = scene.add.text(0, 0, nodeId, {
    fontFamily: '"Courier New", monospace',
    fontSize: '10px',
    color: toHexString(COLORS.network.dim)
  }).setOrigin(0.5)

  container.add([bg, text])

  return container
}

// =============================================================================
// EXPORT DEFAULT THEME OBJECT
// =============================================================================

export default {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDERS,
  DEPTH,
  LAYOUT,
  EFFECTS,
  STYLES,
  SYMBOLS,
  // Functions
  toHexString,
  getTextStyle,
  getTerminalStyle,
  formatNetworkMessage,
  generateStatic,
  glitchText,
  getScrollBounds,
  // Scene helpers
  createPanel,
  createButton,
  createHeader,
  createRecIndicator,
  createTimestamp,
  // Advanced styling
  createGlowBorder,
  createNetworkHeader,
  createStatDisplay,
  createNetworkButton,
  createEncryptedIndicator,
  createNodeBadge,
}
