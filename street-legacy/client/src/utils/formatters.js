// Street Legacy - Formatting Utilities

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} type - Optional type ('cash', 'bank', 'crypto')
 * @returns {string} Formatted currency string
 */
export const formatMoney = (amount, type = 'cash') => {
  if (amount === null || amount === undefined) {
    return '$0'
  }

  const num = Number(amount)

  // Handle invalid numbers
  if (isNaN(num)) {
    return '$0'
  }

  // Format with commas
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(num))

  // Add prefix based on type
  switch (type) {
    case 'bank':
      return `🏦 ${formatted}`
    case 'crypto':
      return `₿ ${num.toLocaleString()}`
    case 'clean':
      return `✓ ${formatted}`
    default:
      return formatted
  }
}

/**
 * Format a large number with abbreviations (K, M, B)
 * @param {number} num - The number to format
 * @returns {string} Abbreviated number string
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) {
    return '0'
  }

  const n = Number(num)

  if (isNaN(n)) {
    return '0'
  }

  if (n >= 1000000000) {
    return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B'
  }
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return n.toLocaleString()
}

/**
 * Format time duration in seconds to human readable
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) {
    return '0s'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

/**
 * Format a timestamp as relative time (e.g., "5 minutes ago")
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return 'Unknown'
  }

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'Just now'
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return date.toLocaleDateString()
}

/**
 * Format percentage value
 * @param {number} value - The percentage value (0-100 or 0-1)
 * @param {boolean} isDecimal - Whether the value is decimal (0-1)
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, isDecimal = false) => {
  if (value === null || value === undefined) {
    return '0%'
  }

  const num = isDecimal ? value * 100 : value
  return `${Math.round(num)}%`
}

/**
 * Format player level display
 * @param {number} level - Player level
 * @returns {string} Formatted level string
 */
export const formatLevel = (level) => {
  return `Lv.${level || 1}`
}

/**
 * Format heat level with color indicator
 * @param {number} heat - Heat level (0-100)
 * @returns {object} Object with text and color
 */
export const formatHeat = (heat) => {
  const h = Math.min(100, Math.max(0, heat || 0))

  let color
  if (h < 25) {
    color = '#22c55e' // green
  } else if (h < 50) {
    color = '#eab308' // yellow
  } else if (h < 75) {
    color = '#f97316' // orange
  } else {
    color = '#ef4444' // red
  }

  return {
    text: `${h}%`,
    color,
    level: h < 25 ? 'low' : h < 50 ? 'medium' : h < 75 ? 'high' : 'critical'
  }
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 20) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format XP progress
 * @param {number} currentXp - Current XP amount
 * @param {number} level - Current level
 * @returns {object} Object with current, needed, and percentage
 */
export const formatXpProgress = (currentXp, level) => {
  const xpNeeded = Math.floor(100 * Math.pow(1.5, (level || 1) - 1))
  const xp = currentXp || 0
  const percent = Math.min(100, (xp / xpNeeded) * 100)

  return {
    current: formatNumber(xp),
    needed: formatNumber(xpNeeded),
    percent: Math.round(percent),
    raw: { current: xp, needed: xpNeeded }
  }
}

export default {
  formatMoney,
  formatNumber,
  formatDuration,
  formatRelativeTime,
  formatPercent,
  formatLevel,
  formatHeat,
  truncateText,
  formatXpProgress
}
