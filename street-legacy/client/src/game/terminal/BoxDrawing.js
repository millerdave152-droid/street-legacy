/**
 * BoxDrawing - ASCII Art Utilities for Terminal
 *
 * Functions:
 * - createBox: Draw box around text
 * - createTable: Formatted tables
 * - createProgressBar: Text-based progress bars
 * - createBanner: Large text banners
 * - createDivider: Horizontal dividers
 * - createTree: Tree structure display
 */

// Box drawing characters (Unicode)
const BOX_CHARS = {
  // Single line
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    leftT: '├',
    rightT: '┤',
    topT: '┬',
    bottomT: '┴',
    cross: '┼'
  },
  // Double line
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    leftT: '╠',
    rightT: '╣',
    topT: '╦',
    bottomT: '╩',
    cross: '╬'
  },
  // Rounded corners
  rounded: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    leftT: '├',
    rightT: '┤',
    topT: '┬',
    bottomT: '┴',
    cross: '┼'
  },
  // Heavy/bold
  heavy: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
    leftT: '┣',
    rightT: '┫',
    topT: '┳',
    bottomT: '┻',
    cross: '╋'
  },
  // ASCII fallback
  ascii: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
    leftT: '+',
    rightT: '+',
    topT: '+',
    bottomT: '+',
    cross: '+'
  }
}

// Progress bar characters
const PROGRESS_CHARS = {
  filled: '█',
  halfFilled: '▓',
  empty: '░',
  leftCap: '[',
  rightCap: ']'
}

// Block characters for banners
const BLOCK_CHARS = {
  full: '█',
  upper: '▀',
  lower: '▄',
  left: '▌',
  right: '▐',
  shade1: '░',
  shade2: '▒',
  shade3: '▓'
}

/**
 * Create a box around content
 * @param {string|Array} content - Text or array of lines
 * @param {Object} options - Box options
 * @returns {string} Box as string
 */
export function createBox(content, options = {}) {
  const {
    width = null,
    title = null,
    border = 'single',
    padding = 1,
    align = 'left'
  } = options

  const chars = BOX_CHARS[border] || BOX_CHARS.single
  const lines = Array.isArray(content) ? content : content.split('\n')

  // Calculate width
  const maxLineLength = Math.max(...lines.map(l => stripAnsi(l).length))
  const contentWidth = width || maxLineLength + (padding * 2)
  const innerWidth = contentWidth

  const result = []

  // Top border with optional title
  let topBorder = chars.topLeft
  if (title) {
    const titleText = ` ${title} `
    const titlePadding = Math.floor((innerWidth - titleText.length) / 2)
    topBorder += chars.horizontal.repeat(Math.max(0, titlePadding))
    topBorder += titleText
    topBorder += chars.horizontal.repeat(Math.max(0, innerWidth - titlePadding - titleText.length))
  } else {
    topBorder += chars.horizontal.repeat(innerWidth)
  }
  topBorder += chars.topRight
  result.push(topBorder)

  // Content lines
  lines.forEach(line => {
    const stripped = stripAnsi(line)
    const paddingSpaces = ' '.repeat(padding)
    let paddedLine = paddingSpaces + line

    // Calculate remaining space
    const remainingSpace = innerWidth - stripped.length - (padding * 2)

    if (align === 'center') {
      const leftPad = Math.floor(remainingSpace / 2)
      const rightPad = remainingSpace - leftPad
      paddedLine = ' '.repeat(leftPad + padding) + line + ' '.repeat(rightPad + padding)
    } else if (align === 'right') {
      paddedLine = ' '.repeat(remainingSpace + padding) + line + paddingSpaces
    } else {
      paddedLine = paddingSpaces + line + ' '.repeat(remainingSpace + padding)
    }

    result.push(chars.vertical + paddedLine + chars.vertical)
  })

  // Bottom border
  result.push(chars.bottomLeft + chars.horizontal.repeat(innerWidth) + chars.bottomRight)

  return result.join('\n')
}

/**
 * Create a formatted table
 * @param {Array} headers - Column headers
 * @param {Array} rows - Array of row arrays
 * @param {Object} options - Table options
 * @returns {string} Table as string
 */
export function createTable(headers, rows, options = {}) {
  const {
    border = 'single',
    padding = 1,
    headerColor = null,
    alternateRows = false
  } = options

  const chars = BOX_CHARS[border] || BOX_CHARS.single

  // Calculate column widths
  const columnWidths = headers.map((header, i) => {
    const headerLen = stripAnsi(String(header)).length
    const maxRowLen = Math.max(...rows.map(row =>
      stripAnsi(String(row[i] || '')).length
    ))
    return Math.max(headerLen, maxRowLen) + (padding * 2)
  })

  const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + columnWidths.length + 1
  const result = []

  // Top border
  let topBorder = chars.topLeft
  columnWidths.forEach((width, i) => {
    topBorder += chars.horizontal.repeat(width)
    topBorder += i < columnWidths.length - 1 ? chars.topT : chars.topRight
  })
  result.push(topBorder)

  // Header row
  let headerRow = chars.vertical
  headers.forEach((header, i) => {
    const text = String(header)
    const padded = padString(text, columnWidths[i], 'center')
    headerRow += padded + chars.vertical
  })
  result.push(headerRow)

  // Header separator
  let headerSep = chars.leftT
  columnWidths.forEach((width, i) => {
    headerSep += chars.horizontal.repeat(width)
    headerSep += i < columnWidths.length - 1 ? chars.cross : chars.rightT
  })
  result.push(headerSep)

  // Data rows
  rows.forEach((row, rowIndex) => {
    let rowStr = chars.vertical
    row.forEach((cell, i) => {
      const text = String(cell || '')
      const padded = padString(text, columnWidths[i], 'left')
      rowStr += padded + chars.vertical
    })
    result.push(rowStr)
  })

  // Bottom border
  let bottomBorder = chars.bottomLeft
  columnWidths.forEach((width, i) => {
    bottomBorder += chars.horizontal.repeat(width)
    bottomBorder += i < columnWidths.length - 1 ? chars.bottomT : chars.bottomRight
  })
  result.push(bottomBorder)

  return result.join('\n')
}

/**
 * Create a text-based progress bar
 * @param {number} value - Current value
 * @param {number} max - Maximum value
 * @param {Object} options - Progress bar options
 * @returns {string} Progress bar as string
 */
export function createProgressBar(value, max, options = {}) {
  const {
    width = 20,
    showPercent = true,
    showValue = false,
    label = null,
    filledChar = PROGRESS_CHARS.filled,
    emptyChar = PROGRESS_CHARS.empty,
    leftCap = PROGRESS_CHARS.leftCap,
    rightCap = PROGRESS_CHARS.rightCap
  } = options

  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  const filledWidth = Math.round((percent / 100) * width)
  const emptyWidth = width - filledWidth

  let bar = leftCap
  bar += filledChar.repeat(filledWidth)
  bar += emptyChar.repeat(emptyWidth)
  bar += rightCap

  const parts = []
  if (label) parts.push(label)
  parts.push(bar)
  if (showPercent) parts.push(`${Math.round(percent)}%`)
  if (showValue) parts.push(`(${value}/${max})`)

  return parts.join(' ')
}

/**
 * Create a horizontal divider
 * @param {number} width - Divider width
 * @param {Object} options - Divider options
 * @returns {string} Divider as string
 */
export function createDivider(width, options = {}) {
  const {
    char = '─',
    label = null,
    labelAlign = 'center'
  } = options

  if (!label) {
    return char.repeat(width)
  }

  const labelText = ` ${label} `
  const remainingWidth = width - labelText.length

  if (labelAlign === 'left') {
    return labelText + char.repeat(remainingWidth)
  } else if (labelAlign === 'right') {
    return char.repeat(remainingWidth) + labelText
  } else {
    const leftPad = Math.floor(remainingWidth / 2)
    const rightPad = remainingWidth - leftPad
    return char.repeat(leftPad) + labelText + char.repeat(rightPad)
  }
}

/**
 * Create a tree structure display
 * @param {Object} tree - Tree object with label and children
 * @param {Object} options - Tree options
 * @returns {string} Tree as string
 */
export function createTree(tree, options = {}) {
  const {
    indent = 2,
    branchChar = '├',
    lastBranchChar = '└',
    verticalChar = '│',
    horizontalChar = '─'
  } = options

  const lines = []

  function processNode(node, prefix = '', isLast = true) {
    const connector = isLast ? lastBranchChar : branchChar
    const extension = horizontalChar.repeat(indent - 1)

    if (prefix === '') {
      lines.push(node.label || node.name || String(node))
    } else {
      lines.push(prefix + connector + extension + ' ' + (node.label || node.name || String(node)))
    }

    if (node.children && node.children.length > 0) {
      const newPrefix = prefix + (isLast ? ' ' : verticalChar) + ' '.repeat(indent)
      node.children.forEach((child, i) => {
        processNode(child, newPrefix, i === node.children.length - 1)
      })
    }
  }

  processNode(tree)
  return lines.join('\n')
}

/**
 * Create a simple bar chart
 * @param {Array} data - Array of {label, value} objects
 * @param {Object} options - Chart options
 * @returns {string} Chart as string
 */
export function createBarChart(data, options = {}) {
  const {
    maxWidth = 30,
    barChar = '█',
    showValues = true
  } = options

  const maxValue = Math.max(...data.map(d => d.value))
  const maxLabelLen = Math.max(...data.map(d => d.label.length))
  const lines = []

  data.forEach(item => {
    const barWidth = Math.round((item.value / maxValue) * maxWidth)
    const label = item.label.padEnd(maxLabelLen)
    const bar = barChar.repeat(barWidth)
    const value = showValues ? ` ${item.value}` : ''
    lines.push(`${label} │${bar}${value}`)
  })

  return lines.join('\n')
}

/**
 * Create a key-value list
 * @param {Object} data - Object with key-value pairs
 * @param {Object} options - List options
 * @returns {string} List as string
 */
export function createKeyValueList(data, options = {}) {
  const {
    separator = ': ',
    indent = 0,
    alignValues = true
  } = options

  const entries = Object.entries(data)
  const maxKeyLen = alignValues ? Math.max(...entries.map(([k]) => k.length)) : 0
  const indentStr = ' '.repeat(indent)

  return entries.map(([key, value]) => {
    const paddedKey = alignValues ? key.padEnd(maxKeyLen) : key
    return `${indentStr}${paddedKey}${separator}${value}`
  }).join('\n')
}

/**
 * Create a section header
 * @param {string} title - Section title
 * @param {Object} options - Header options
 * @returns {string} Header as string
 */
export function createSectionHeader(title, options = {}) {
  const {
    width = 40,
    style = 'double',
    padding = 1
  } = options

  const chars = BOX_CHARS[style] || BOX_CHARS.double
  const titleWithPad = ' '.repeat(padding) + title + ' '.repeat(padding)
  const sideWidth = Math.floor((width - titleWithPad.length) / 2)

  return chars.horizontal.repeat(sideWidth) + titleWithPad +
         chars.horizontal.repeat(width - sideWidth - titleWithPad.length)
}

/**
 * Strip ANSI codes from string (for length calculations)
 * @param {string} str - String to strip
 * @returns {string} Stripped string
 */
function stripAnsi(str) {
  if (!str) return ''
  // Remove common terminal formatting
  return String(str).replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Pad a string to a specific length
 * @param {string} str - String to pad
 * @param {number} length - Target length
 * @param {string} align - 'left', 'right', or 'center'
 * @returns {string} Padded string
 */
function padString(str, length, align = 'left') {
  const stripped = stripAnsi(str)
  const padding = length - stripped.length

  if (padding <= 0) return str

  if (align === 'right') {
    return ' '.repeat(padding) + str
  } else if (align === 'center') {
    const leftPad = Math.floor(padding / 2)
    const rightPad = padding - leftPad
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad)
  } else {
    return str + ' '.repeat(padding)
  }
}

// Export constants
export { BOX_CHARS, PROGRESS_CHARS, BLOCK_CHARS }

export default {
  createBox,
  createTable,
  createProgressBar,
  createDivider,
  createTree,
  createBarChart,
  createKeyValueList,
  createSectionHeader,
  BOX_CHARS,
  PROGRESS_CHARS,
  BLOCK_CHARS
}
