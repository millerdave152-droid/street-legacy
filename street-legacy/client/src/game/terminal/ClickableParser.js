/**
 * ClickableParser - Phase 12: Parse and handle clickable terminal shortcuts
 *
 * Syntax: [[command:label]]
 * Examples:
 *   [[respond 1 yes:Accept]] → Shows "Accept" as clickable, executes "respond 1 yes"
 *   [[status:Check Status]] → Shows "Check Status" as clickable, executes "status"
 *   [[bank:Bank Cash]] → Shows "Bank Cash" as clickable
 */

// Regex to match [[command:label]] pattern
const CLICKABLE_PATTERN = /\[\[([^:\]]+):([^\]]+)\]\]/g

/**
 * Parse text and extract clickable regions
 *
 * @param {string} text - Text to parse
 * @returns {object} Parsed result with segments
 */
export function parseClickables(text) {
  if (!text || typeof text !== 'string') {
    return {
      hasClickables: false,
      segments: [{ type: 'text', content: text || '' }],
      plainText: text || '',
    }
  }

  const segments = []
  let lastIndex = 0
  let match
  let plainText = ''

  // Reset regex
  CLICKABLE_PATTERN.lastIndex = 0

  while ((match = CLICKABLE_PATTERN.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index)
      segments.push({ type: 'text', content: textBefore })
      plainText += textBefore
    }

    // Add the clickable segment
    const command = match[1].trim()
    const label = match[2].trim()

    segments.push({
      type: 'clickable',
      command,
      label,
      startIndex: plainText.length,
      endIndex: plainText.length + label.length,
    })
    plainText += label

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex)
    segments.push({ type: 'text', content: textAfter })
    plainText += textAfter
  }

  return {
    hasClickables: segments.some(s => s.type === 'clickable'),
    segments,
    plainText,
  }
}

/**
 * Get only the plain text (clickable labels shown, markup removed)
 *
 * @param {string} text - Text with clickable markup
 * @returns {string} Plain text
 */
export function getPlainText(text) {
  if (!text) return ''
  return text.replace(CLICKABLE_PATTERN, '$2')
}

/**
 * Check if text contains clickable elements
 *
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function hasClickables(text) {
  if (!text) return false
  CLICKABLE_PATTERN.lastIndex = 0
  return CLICKABLE_PATTERN.test(text)
}

/**
 * Create a clickable shortcut string
 *
 * @param {string} command - Command to execute
 * @param {string} label - Display label
 * @returns {string} Formatted clickable string
 */
export function createClickable(command, label) {
  return `[[${command}:${label}]]`
}

/**
 * Common clickable shortcuts for convenience
 */
export const SHORTCUTS = {
  accept: createClickable('respond 1 yes', 'Accept'),
  decline: createClickable('respond 1 no', 'Decline'),
  status: createClickable('status', 'Status'),
  help: createClickable('help', 'Help'),
  bank: createClickable('bank', 'Bank Cash'),
  offers: createClickable('offers', 'View Offers'),
  clear: createClickable('clear', 'Clear'),
}

/**
 * Add shortcuts to a message based on context
 *
 * @param {string} message - Base message
 * @param {string[]} shortcuts - Shortcut keys to add
 * @returns {string} Message with shortcuts appended
 */
export function addShortcuts(message, shortcuts) {
  if (!shortcuts || shortcuts.length === 0) return message

  const shortcutText = shortcuts
    .map(key => SHORTCUTS[key])
    .filter(Boolean)
    .join(' | ')

  if (!shortcutText) return message

  return `${message}\n${shortcutText}`
}

export default {
  parseClickables,
  getPlainText,
  hasClickables,
  createClickable,
  addShortcuts,
  SHORTCUTS,
}
