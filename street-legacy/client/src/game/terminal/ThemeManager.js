/**
 * ThemeManager - Terminal Theme Customization
 *
 * Preset Themes:
 * - CLASSIC_GREEN: Default hacker green
 * - CYBERPUNK_NEON: Pink/cyan neon
 * - AMBER_CRT: Retro amber monitor
 * - MATRIX: Black/green with rain
 * - BLOOD_RED: Dark red for high heat
 * - MIDNIGHT_BLUE: Cool blue tones
 * - MONOCHROME: Classic black/white
 *
 * Customizable:
 * - Background color/opacity
 * - Text colors per output type
 * - Font size (9-14px)
 * - CRT effect intensity
 * - Scanline visibility
 */

const STORAGE_KEY = 'streetLegacy_theme'

// Preset themes
const THEMES = {
  CLASSIC_GREEN: {
    name: 'Classic Green',
    description: 'Default hacker terminal',
    colors: {
      background: '#0a0a0a',
      backgroundAlpha: 0.95,
      primary: '#00ff41',
      secondary: '#00cc33',
      text: '#00ff41',
      textDim: '#006622',
      command: '#00ff41',
      response: '#cccccc',
      error: '#ff4444',
      warning: '#ffaa00',
      success: '#22c55e',
      system: '#00aaff',
      npc: '#06b6d4',
      highlight: '#44ff77'
    },
    effects: {
      scanlines: true,
      scanlineIntensity: 0.06,
      glow: true,
      glowIntensity: 0.02,
      crtCurve: false
    },
    font: {
      family: '"JetBrains Mono", "Fira Code", monospace',
      size: 11,
      lineHeight: 1.4
    }
  },

  CYBERPUNK_NEON: {
    name: 'Cyberpunk Neon',
    description: 'Vibrant pink and cyan',
    colors: {
      background: '#0d0221',
      backgroundAlpha: 0.95,
      primary: '#ff00ff',
      secondary: '#00ffff',
      text: '#ff66ff',
      textDim: '#660066',
      command: '#00ffff',
      response: '#ff99ff',
      error: '#ff0066',
      warning: '#ffff00',
      success: '#00ff99',
      system: '#00ffff',
      npc: '#ff00ff',
      highlight: '#ffffff'
    },
    effects: {
      scanlines: true,
      scanlineIntensity: 0.04,
      glow: true,
      glowIntensity: 0.03,
      crtCurve: false
    },
    font: {
      family: '"JetBrains Mono", monospace',
      size: 11,
      lineHeight: 1.4
    }
  },

  AMBER_CRT: {
    name: 'Amber CRT',
    description: 'Retro amber monitor',
    colors: {
      background: '#1a1000',
      backgroundAlpha: 0.98,
      primary: '#ffb000',
      secondary: '#cc8800',
      text: '#ffb000',
      textDim: '#664400',
      command: '#ffcc00',
      response: '#ffaa00',
      error: '#ff4400',
      warning: '#ffff00',
      success: '#88ff00',
      system: '#ffcc00',
      npc: '#ff8800',
      highlight: '#ffff88'
    },
    effects: {
      scanlines: true,
      scanlineIntensity: 0.08,
      glow: true,
      glowIntensity: 0.025,
      crtCurve: true
    },
    font: {
      family: '"Courier New", monospace',
      size: 12,
      lineHeight: 1.5
    }
  },

  MATRIX: {
    name: 'Matrix',
    description: 'Classic matrix rain style',
    colors: {
      background: '#000000',
      backgroundAlpha: 1.0,
      primary: '#00ff00',
      secondary: '#008800',
      text: '#00ff00',
      textDim: '#004400',
      command: '#00ff00',
      response: '#00cc00',
      error: '#ff0000',
      warning: '#ffff00',
      success: '#00ff00',
      system: '#00ff00',
      npc: '#00ff88',
      highlight: '#88ff88'
    },
    effects: {
      scanlines: false,
      scanlineIntensity: 0,
      glow: true,
      glowIntensity: 0.04,
      crtCurve: false,
      matrixRain: true
    },
    font: {
      family: '"JetBrains Mono", monospace',
      size: 11,
      lineHeight: 1.3
    }
  },

  BLOOD_RED: {
    name: 'Blood Red',
    description: 'Dark red for dangerous times',
    colors: {
      background: '#1a0000',
      backgroundAlpha: 0.95,
      primary: '#ff0000',
      secondary: '#cc0000',
      text: '#ff4444',
      textDim: '#660000',
      command: '#ff6666',
      response: '#ff8888',
      error: '#ff0000',
      warning: '#ff6600',
      success: '#00ff00',
      system: '#ff4444',
      npc: '#ff0066',
      highlight: '#ffffff'
    },
    effects: {
      scanlines: true,
      scanlineIntensity: 0.05,
      glow: true,
      glowIntensity: 0.02,
      crtCurve: false
    },
    font: {
      family: '"JetBrains Mono", monospace',
      size: 11,
      lineHeight: 1.4
    }
  },

  MIDNIGHT_BLUE: {
    name: 'Midnight Blue',
    description: 'Cool blue professional',
    colors: {
      background: '#0a1628',
      backgroundAlpha: 0.95,
      primary: '#3b82f6',
      secondary: '#1d4ed8',
      text: '#60a5fa',
      textDim: '#1e3a5f',
      command: '#93c5fd',
      response: '#bfdbfe',
      error: '#f87171',
      warning: '#fbbf24',
      success: '#4ade80',
      system: '#38bdf8',
      npc: '#818cf8',
      highlight: '#ffffff'
    },
    effects: {
      scanlines: false,
      scanlineIntensity: 0,
      glow: true,
      glowIntensity: 0.015,
      crtCurve: false
    },
    font: {
      family: '"JetBrains Mono", monospace',
      size: 11,
      lineHeight: 1.4
    }
  },

  MONOCHROME: {
    name: 'Monochrome',
    description: 'Classic black and white',
    colors: {
      background: '#000000',
      backgroundAlpha: 1.0,
      primary: '#ffffff',
      secondary: '#cccccc',
      text: '#ffffff',
      textDim: '#666666',
      command: '#ffffff',
      response: '#cccccc',
      error: '#ffffff',
      warning: '#cccccc',
      success: '#ffffff',
      system: '#ffffff',
      npc: '#aaaaaa',
      highlight: '#ffffff'
    },
    effects: {
      scanlines: true,
      scanlineIntensity: 0.1,
      glow: false,
      glowIntensity: 0,
      crtCurve: true
    },
    font: {
      family: '"Courier New", monospace',
      size: 12,
      lineHeight: 1.5
    }
  }
}

// Default theme
const DEFAULT_THEME = 'CLASSIC_GREEN'

class ThemeManagerClass {
  constructor() {
    this.currentTheme = null
    this.customOverrides = {}
    this.listeners = []
    this.isInitialized = false
  }

  /**
   * Initialize the theme manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadTheme()
    this.isInitialized = true
    console.log('[ThemeManager] Initialized with theme:', this.currentTheme?.name || DEFAULT_THEME)
  }

  /**
   * Get available theme names
   */
  getAvailableThemes() {
    return Object.keys(THEMES)
  }

  /**
   * Get theme list with descriptions
   */
  getThemeList() {
    return Object.entries(THEMES).map(([key, theme]) => ({
      key,
      name: theme.name,
      description: theme.description
    }))
  }

  /**
   * Set theme by name
   * @param {string} themeName - Theme key
   * @returns {Object} Result object
   */
  setTheme(themeName) {
    const themeKey = themeName.toUpperCase().replace(/\s+/g, '_')

    if (!THEMES[themeKey]) {
      return { success: false, message: `Unknown theme: ${themeName}` }
    }

    this.currentTheme = { ...THEMES[themeKey], key: themeKey }
    this.applyCustomOverrides()
    this.saveTheme()
    this.emit('themeChanged', { theme: this.currentTheme })

    return { success: true, message: `Theme set to: ${this.currentTheme.name}` }
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    if (!this.currentTheme) {
      this.currentTheme = { ...THEMES[DEFAULT_THEME], key: DEFAULT_THEME }
    }
    return this.currentTheme
  }

  /**
   * Get a specific color
   * @param {string} colorKey - Color key (e.g., 'primary', 'error')
   */
  getColor(colorKey) {
    return this.getCurrentTheme().colors[colorKey] || '#ffffff'
  }

  /**
   * Get all colors
   */
  getColors() {
    return { ...this.getCurrentTheme().colors }
  }

  /**
   * Get effects settings
   */
  getEffects() {
    return { ...this.getCurrentTheme().effects }
  }

  /**
   * Get font settings
   */
  getFont() {
    return { ...this.getCurrentTheme().font }
  }

  /**
   * Set a custom color override
   * @param {string} colorKey - Color key
   * @param {string} value - Hex color value
   */
  setColor(colorKey, value) {
    // Validate hex color
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
      return { success: false, message: 'Invalid color format. Use #RRGGBB' }
    }

    if (!this.customOverrides.colors) {
      this.customOverrides.colors = {}
    }

    this.customOverrides.colors[colorKey] = value
    this.applyCustomOverrides()
    this.saveTheme()
    this.emit('colorChanged', { key: colorKey, value })

    return { success: true, message: `Color ${colorKey} set to ${value}` }
  }

  /**
   * Set font size
   * @param {number} size - Font size in px (9-14)
   */
  setFontSize(size) {
    const sizeNum = parseInt(size)
    if (isNaN(sizeNum) || sizeNum < 9 || sizeNum > 14) {
      return { success: false, message: 'Font size must be between 9 and 14' }
    }

    if (!this.customOverrides.font) {
      this.customOverrides.font = {}
    }

    this.customOverrides.font.size = sizeNum
    this.applyCustomOverrides()
    this.saveTheme()
    this.emit('fontChanged', { size: sizeNum })

    return { success: true, message: `Font size set to ${sizeNum}px` }
  }

  /**
   * Set effect option
   * @param {string} effectKey - Effect key
   * @param {boolean|number} value - Effect value
   */
  setEffect(effectKey, value) {
    if (!this.customOverrides.effects) {
      this.customOverrides.effects = {}
    }

    // Handle boolean effects
    if (['scanlines', 'glow', 'crtCurve', 'matrixRain'].includes(effectKey)) {
      value = value === 'true' || value === true || value === 'on'
    }

    // Handle intensity values
    if (effectKey.includes('Intensity')) {
      value = parseFloat(value)
      if (isNaN(value)) value = 0
      value = Math.max(0, Math.min(1, value))
    }

    this.customOverrides.effects[effectKey] = value
    this.applyCustomOverrides()
    this.saveTheme()
    this.emit('effectChanged', { key: effectKey, value })

    return { success: true, message: `Effect ${effectKey} set to ${value}` }
  }

  /**
   * Apply custom overrides to current theme
   */
  applyCustomOverrides() {
    if (!this.currentTheme) return

    // Apply color overrides
    if (this.customOverrides.colors) {
      Object.assign(this.currentTheme.colors, this.customOverrides.colors)
    }

    // Apply effect overrides
    if (this.customOverrides.effects) {
      Object.assign(this.currentTheme.effects, this.customOverrides.effects)
    }

    // Apply font overrides
    if (this.customOverrides.font) {
      Object.assign(this.currentTheme.font, this.customOverrides.font)
    }
  }

  /**
   * Reset to default theme
   */
  resetToDefault() {
    this.currentTheme = { ...THEMES[DEFAULT_THEME], key: DEFAULT_THEME }
    this.customOverrides = {}
    this.saveTheme()
    this.emit('themeReset')

    return { success: true, message: 'Theme reset to default' }
  }

  /**
   * Reset custom overrides only
   */
  resetOverrides() {
    this.customOverrides = {}
    const themeKey = this.currentTheme?.key || DEFAULT_THEME
    this.currentTheme = { ...THEMES[themeKey], key: themeKey }
    this.saveTheme()
    this.emit('overridesReset')

    return { success: true, message: 'Custom overrides reset' }
  }

  /**
   * Get CSS variables for current theme
   */
  getCSSVariables() {
    const theme = this.getCurrentTheme()
    const vars = {}

    // Colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      vars[`--terminal-${key}`] = value
    })

    // Font
    vars['--terminal-font-family'] = theme.font.family
    vars['--terminal-font-size'] = `${theme.font.size}px`
    vars['--terminal-line-height'] = theme.font.lineHeight

    return vars
  }

  /**
   * Format theme for display
   */
  formatCurrentTheme() {
    const theme = this.getCurrentTheme()
    const lines = [
      `Current Theme: ${theme.name}`,
      `Description: ${theme.description}`,
      '',
      'Colors:',
      ...Object.entries(theme.colors).map(([k, v]) => `  ${k}: ${v}`),
      '',
      'Effects:',
      ...Object.entries(theme.effects).map(([k, v]) => `  ${k}: ${v}`),
      '',
      'Font:',
      `  Family: ${theme.font.family}`,
      `  Size: ${theme.font.size}px`,
      `  Line Height: ${theme.font.lineHeight}`
    ]

    if (Object.keys(this.customOverrides).length > 0) {
      lines.push('')
      lines.push('Custom Overrides Active')
    }

    return lines.join('\n')
  }

  /**
   * Add listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Emit event
   */
  emit(event, data = {}) {
    this.listeners.forEach(l => {
      try {
        l(event, data)
      } catch (e) {
        console.error('[ThemeManager] Listener error:', e)
      }
    })
  }

  /**
   * Save theme to localStorage
   */
  saveTheme() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        themeKey: this.currentTheme?.key || DEFAULT_THEME,
        customOverrides: this.customOverrides,
        version: 1
      }))
    } catch (e) {
      console.warn('[ThemeManager] Save failed:', e)
    }
  }

  /**
   * Load theme from localStorage
   */
  loadTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        const themeKey = data.themeKey || DEFAULT_THEME

        if (THEMES[themeKey]) {
          this.currentTheme = { ...THEMES[themeKey], key: themeKey }
          this.customOverrides = data.customOverrides || {}
          this.applyCustomOverrides()
        } else {
          this.currentTheme = { ...THEMES[DEFAULT_THEME], key: DEFAULT_THEME }
        }
      } else {
        this.currentTheme = { ...THEMES[DEFAULT_THEME], key: DEFAULT_THEME }
      }
    } catch (e) {
      console.warn('[ThemeManager] Load failed:', e)
      this.currentTheme = { ...THEMES[DEFAULT_THEME], key: DEFAULT_THEME }
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      currentTheme: this.currentTheme?.name,
      availableThemes: Object.keys(THEMES).length,
      customOverrides: Object.keys(this.customOverrides).length > 0
    }
  }
}

// Singleton instance
export const themeManager = new ThemeManagerClass()

// Export themes for reference
export { THEMES }

export default themeManager
