/**
 * RichTextParser - Markdown-like Syntax for Terminal
 *
 * Supported Syntax:
 * - *bold* - Bold text
 * - _italic_ - Italic text
 * - ~dim~ - Dimmed text
 * - [color:red]text[/color] - Colored text
 * - @icon:warning@ - Inline icons
 * - >>>pulse>>> - Pulsing animation
 * - ~~~glow~~~ - Glowing text
 * - `code` - Monospace/code style
 * - ||spoiler|| - Hidden text (click to reveal)
 *
 * Returns array of segments for Phaser text rendering
 */

// Color name to hex mapping
const COLOR_MAP = {
  red: '#ff4444',
  green: '#00ff41',
  blue: '#00aaff',
  yellow: '#ffff00',
  orange: '#ffaa00',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  white: '#ffffff',
  gray: '#888888',
  dim: '#444444',
  gold: '#ffd700',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',
  cash: '#22c55e',
  heat: '#ef4444',
  energy: '#3b82f6',
  rep: '#a855f7'
}

// Icon definitions (Unicode or text representations)
const ICONS = {
  warning: '⚠',
  error: '✖',
  success: '✓',
  info: 'ℹ',
  money: '$',
  heat: '🔥',
  energy: '⚡',
  star: '★',
  arrow: '→',
  bullet: '•',
  check: '✓',
  cross: '✗',
  lock: '🔒',
  unlock: '🔓',
  user: '👤',
  message: '✉',
  time: '⏱',
  location: '📍',
  deal: '🤝',
  danger: '☠',
  phone: '📱',
  gang: '👥'
}

// Segment types
const SEGMENT_TYPES = {
  TEXT: 'text',
  BOLD: 'bold',
  ITALIC: 'italic',
  DIM: 'dim',
  COLOR: 'color',
  ICON: 'icon',
  PULSE: 'pulse',
  GLOW: 'glow',
  CODE: 'code',
  SPOILER: 'spoiler',
  LINK: 'link'
}

/**
 * Parse rich text string into segments
 * @param {string} input - Raw text with markup
 * @returns {Array} Array of segment objects
 */
export function parseRichText(input) {
  if (!input || typeof input !== 'string') {
    return [{ type: SEGMENT_TYPES.TEXT, text: '', style: {} }]
  }

  const segments = []
  let remaining = input
  let position = 0

  while (remaining.length > 0) {
    let matched = false

    // Try each pattern
    const patterns = [
      // Bold: *text*
      {
        regex: /^\*([^*]+)\*/,
        type: SEGMENT_TYPES.BOLD,
        getStyle: () => ({ fontStyle: 'bold' })
      },
      // Italic: _text_
      {
        regex: /^_([^_]+)_/,
        type: SEGMENT_TYPES.ITALIC,
        getStyle: () => ({ fontStyle: 'italic' })
      },
      // Dim: ~text~
      {
        regex: /^~([^~]+)~/,
        type: SEGMENT_TYPES.DIM,
        getStyle: () => ({ color: COLOR_MAP.dim, alpha: 0.6 })
      },
      // Color: [color:name]text[/color]
      {
        regex: /^\[color:(\w+)\]([^\[]+)\[\/color\]/,
        type: SEGMENT_TYPES.COLOR,
        getStyle: (match) => ({ color: COLOR_MAP[match[1]] || match[1] }),
        getText: (match) => match[2]
      },
      // Icon: @icon:name@
      {
        regex: /^@icon:(\w+)@/,
        type: SEGMENT_TYPES.ICON,
        getText: (match) => ICONS[match[1]] || `[${match[1]}]`,
        getStyle: () => ({ isIcon: true })
      },
      // Pulse: >>>text>>>
      {
        regex: /^>>>([^>]+)>>>/,
        type: SEGMENT_TYPES.PULSE,
        getStyle: () => ({ animation: 'pulse' })
      },
      // Glow: ~~~text~~~
      {
        regex: /^~~~([^~]+)~~~/,
        type: SEGMENT_TYPES.GLOW,
        getStyle: () => ({ animation: 'glow', color: COLOR_MAP.green })
      },
      // Code: `text`
      {
        regex: /^`([^`]+)`/,
        type: SEGMENT_TYPES.CODE,
        getStyle: () => ({
          backgroundColor: '#1a1a1a',
          padding: 2,
          color: COLOR_MAP.cyan
        })
      },
      // Spoiler: ||text||
      {
        regex: /^\|\|([^|]+)\|\|/,
        type: SEGMENT_TYPES.SPOILER,
        getStyle: () => ({
          backgroundColor: '#333333',
          color: '#333333',
          spoiler: true
        })
      },
      // Link: [text](command)
      {
        regex: /^\[([^\]]+)\]\(([^)]+)\)/,
        type: SEGMENT_TYPES.LINK,
        getText: (match) => match[1],
        getStyle: (match) => ({
          color: COLOR_MAP.cyan,
          underline: true,
          command: match[2]
        })
      }
    ]

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex)
      if (match) {
        const text = pattern.getText ? pattern.getText(match) : match[1]
        const style = pattern.getStyle ? pattern.getStyle(match) : {}

        segments.push({
          type: pattern.type,
          text,
          style,
          position,
          length: match[0].length
        })

        remaining = remaining.slice(match[0].length)
        position += match[0].length
        matched = true
        break
      }
    }

    // No pattern matched - consume one character as plain text
    if (!matched) {
      // Look for next potential markup
      const nextMarkup = remaining.slice(1).search(/[\*_~\[\]@>`\|]/)
      const plainLength = nextMarkup === -1 ? remaining.length : nextMarkup + 1

      const plainText = remaining.slice(0, plainLength)

      // Merge with previous plain text segment if possible
      const lastSegment = segments[segments.length - 1]
      if (lastSegment && lastSegment.type === SEGMENT_TYPES.TEXT) {
        lastSegment.text += plainText
        lastSegment.length += plainLength
      } else {
        segments.push({
          type: SEGMENT_TYPES.TEXT,
          text: plainText,
          style: {},
          position,
          length: plainLength
        })
      }

      remaining = remaining.slice(plainLength)
      position += plainLength
    }
  }

  return segments
}

/**
 * Convert segments to plain text (strip formatting)
 * @param {Array} segments - Parsed segments
 * @returns {string} Plain text
 */
export function segmentsToPlainText(segments) {
  return segments.map(s => s.text).join('')
}

/**
 * Get total character count of segments
 * @param {Array} segments - Parsed segments
 * @returns {number} Total characters
 */
export function getSegmentLength(segments) {
  return segments.reduce((sum, s) => sum + s.text.length, 0)
}

/**
 * Check if text contains any rich formatting
 * @param {string} input - Text to check
 * @returns {boolean} True if contains formatting
 */
export function hasRichFormatting(input) {
  if (!input) return false
  return /[\*_~\[\]@>`\|]{2,}/.test(input) ||
         /\[color:/.test(input) ||
         /@icon:/.test(input)
}

/**
 * Escape rich text markup
 * @param {string} input - Text to escape
 * @returns {string} Escaped text
 */
export function escapeRichText(input) {
  if (!input) return ''
  return input
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/@/g, '\\@')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
}

/**
 * Create a colored text shorthand
 * @param {string} text - Text to color
 * @param {string} color - Color name
 * @returns {string} Formatted string
 */
export function colorText(text, color) {
  return `[color:${color}]${text}[/color]`
}

/**
 * Create bold text
 * @param {string} text - Text to bold
 * @returns {string} Formatted string
 */
export function boldText(text) {
  return `*${text}*`
}

/**
 * Create a status line with icon
 * @param {string} icon - Icon name
 * @param {string} label - Label text
 * @param {string|number} value - Value
 * @param {string} color - Color for value
 * @returns {string} Formatted string
 */
export function statusLine(icon, label, value, color = 'white') {
  return `@icon:${icon}@ ${label}: [color:${color}]${value}[/color]`
}

/**
 * Create a clickable command link
 * @param {string} text - Display text
 * @param {string} command - Command to execute
 * @returns {string} Formatted string
 */
export function commandLink(text, command) {
  return `[${text}](${command})`
}

/**
 * Apply rich text to Phaser text objects
 * This creates multiple text objects for different styles
 * @param {Phaser.Scene} scene - The scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} richText - Rich text string
 * @param {Object} baseStyle - Base text style
 * @returns {Phaser.GameObjects.Container} Container with styled texts
 */
export function createRichTextDisplay(scene, x, y, richText, baseStyle = {}) {
  const container = scene.add.container(x, y)
  const segments = parseRichText(richText)

  let currentX = 0
  const defaultStyle = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
    color: '#cccccc',
    ...baseStyle
  }

  segments.forEach(segment => {
    const style = { ...defaultStyle }

    // Apply segment-specific styles
    if (segment.style.color) style.color = segment.style.color
    if (segment.style.fontStyle) style.fontStyle = segment.style.fontStyle
    if (segment.style.backgroundColor) style.backgroundColor = segment.style.backgroundColor

    const text = scene.add.text(currentX, 0, segment.text, style)

    // Apply animations
    if (segment.style.animation === 'pulse') {
      scene.tweens.add({
        targets: text,
        alpha: { from: 1, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: -1
      })
    }

    if (segment.style.animation === 'glow') {
      scene.tweens.add({
        targets: text,
        alpha: { from: 0.8, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }

    // Make links interactive
    if (segment.style.command) {
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => text.setColor('#44ffff'))
        .on('pointerout', () => text.setColor(segment.style.color))
        .on('pointerdown', () => {
          // Emit command event
          scene.events.emit('richtext:command', segment.style.command)
        })
    }

    // Handle spoilers
    if (segment.style.spoiler) {
      text.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          text.setColor('#cccccc')
          text.setBackgroundColor(null)
        })
    }

    container.add(text)
    currentX += text.width
  })

  return container
}

// Export constants
export { COLOR_MAP, ICONS, SEGMENT_TYPES }

export default {
  parseRichText,
  segmentsToPlainText,
  getSegmentLength,
  hasRichFormatting,
  escapeRichText,
  colorText,
  boldText,
  statusLine,
  commandLink,
  createRichTextDisplay,
  COLOR_MAP,
  ICONS,
  SEGMENT_TYPES
}
