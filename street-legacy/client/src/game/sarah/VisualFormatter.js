/**
 * VisualFormatter - Enhanced output formatting for S.A.R.A.H.
 *
 * Creates structured, visually appealing terminal output with:
 * - Box drawing characters
 * - Progress bars
 * - Color-coded stats
 * - Confidence indicators
 */

// Box drawing characters
const BOX = {
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  T_RIGHT: '├',
  T_LEFT: '┤',
}

// Symbols
const SYMBOLS = {
  ARROW: '→',
  CHECK: '✓',
  CROSS: '✗',
  WARNING: '⚠',
  STAR: '★',
  BULLET: '•',
  FILLED: '■',
  EMPTY: '□',
  MONEY: '$',
}

class VisualFormatter {
  /**
   * Create a progress bar
   * @param {number} value - Current value
   * @param {number} max - Maximum value
   * @param {number} width - Bar width in characters
   */
  createProgressBar(value, max, width = 10) {
    const percent = Math.min(1, Math.max(0, value / max))
    const filled = Math.round(percent * width)
    const empty = width - filled

    return `[${SYMBOLS.FILLED.repeat(filled)}${SYMBOLS.EMPTY.repeat(empty)}]`
  }

  /**
   * Format a stat line with progress bar
   */
  formatStatLine(label, value, max, suffix = '') {
    const bar = this.createProgressBar(value, max)
    return `${bar} ${label}: ${value}${max ? '/' + max : ''}${suffix}`
  }

  /**
   * Get stat status (good/warning/critical)
   */
  getStatStatus(statName, value) {
    switch (statName.toLowerCase()) {
      case 'energy':
        if (value > 50) return 'good'
        if (value > 20) return 'warning'
        return 'critical'

      case 'heat':
        if (value < 30) return 'good'
        if (value < 60) return 'warning'
        return 'critical'

      case 'health':
        if (value > 50) return 'good'
        if (value > 25) return 'warning'
        return 'critical'

      default:
        return 'neutral'
    }
  }

  /**
   * Create a boxed panel with title
   */
  createPanel(title, lines, width = 40) {
    const output = []

    // Top border with title
    const titlePadded = ` ${title} `
    const remainingWidth = width - titlePadded.length - 2
    const leftDash = Math.floor(remainingWidth / 2)
    const rightDash = remainingWidth - leftDash

    output.push(
      `${BOX.TOP_LEFT}${BOX.HORIZONTAL.repeat(leftDash)}${titlePadded}${BOX.HORIZONTAL.repeat(rightDash)}${BOX.TOP_RIGHT}`
    )

    // Content lines
    for (const line of lines) {
      const paddedLine = this.padLine(line, width - 4)
      output.push(`${BOX.VERTICAL} ${paddedLine} ${BOX.VERTICAL}`)
    }

    // Bottom border
    output.push(`${BOX.BOTTOM_LEFT}${BOX.HORIZONTAL.repeat(width - 2)}${BOX.BOTTOM_RIGHT}`)

    return output
  }

  /**
   * Pad a line to a specific width
   */
  padLine(text, width) {
    if (text.length >= width) {
      return text.substring(0, width)
    }
    return text + ' '.repeat(width - text.length)
  }

  /**
   * Format a recommendation with arrow
   */
  formatRecommendation(text) {
    return `${SYMBOLS.ARROW} ${text}`
  }

  /**
   * Format a warning
   */
  formatWarning(text) {
    return `${SYMBOLS.WARNING} ${text}`
  }

  /**
   * Format a success message
   */
  formatSuccess(text) {
    return `${SYMBOLS.CHECK} ${text}`
  }

  /**
   * Format confidence level
   */
  formatConfidence(percent) {
    if (percent >= 80) return `CONFIDENCE: ${percent}% ${SYMBOLS.STAR}`
    if (percent >= 60) return `CONFIDENCE: ${percent}%`
    return `CONFIDENCE: ${percent}% (uncertain)`
  }

  /**
   * Format money value
   */
  formatMoney(amount) {
    return `$${amount.toLocaleString()}`
  }

  /**
   * Create a full analysis panel for S.A.R.A.H.
   */
  createAnalysisPanel(playerData, recommendation, confidence = 85) {
    const lines = [
      '',
      'YOUR STATUS',
      `├─ ${this.formatStatLine('Energy', playerData.energy || 0, 100)}`,
      `├─ ${this.formatStatLine('Heat', playerData.heat || 0, 100, '%')}`,
      `└─ Cash: ${this.formatMoney(playerData.cash || 0)}`,
      '',
      'RECOMMENDATION',
      this.formatRecommendation(recommendation),
      '',
      this.formatConfidence(confidence),
    ]

    return this.createPanel('S.A.R.A.H. ANALYSIS', lines)
  }

  /**
   * Create a threat assessment panel
   */
  createThreatPanel(threats) {
    if (threats.length === 0) {
      return this.createPanel('THREAT ASSESSMENT', [
        '',
        `${SYMBOLS.CHECK} No active threats detected`,
        '',
      ])
    }

    const lines = ['']
    for (const threat of threats.slice(0, 3)) {
      const icon = threat.threat.level === 'HIGH' ? SYMBOLS.WARNING : SYMBOLS.BULLET
      lines.push(`${icon} ${threat.name} (Lvl ${threat.level})`)
      lines.push(`  ${threat.threat.warning}`)
    }
    lines.push('')

    return this.createPanel('THREAT ASSESSMENT', lines)
  }

  /**
   * Create an AI intel panel
   */
  createIntelPanel(intel) {
    if (!intel.found) {
      return this.createPanel('AI INTEL', [
        '',
        `${SYMBOLS.CROSS} ${intel.message}`,
        '',
      ])
    }

    const trustBar = this.createProgressBar(intel.trustLevel, 100)
    const lines = [
      '',
      `Name: ${intel.name}`,
      `Level: ${intel.level} | Type: ${intel.personality}`,
      `Crew: ${intel.crewName}`,
      '',
      `Trust: ${trustBar} ${intel.trustLevel}%`,
      `Threat: ${intel.threatLevel?.level || 'LOW'}`,
      '',
      intel.recommendation,
      '',
    ]

    return this.createPanel('AI INTEL', lines)
  }

  /**
   * Create a trade analysis panel
   */
  createTradePanel(analysis) {
    const icon = analysis.safe ? SYMBOLS.CHECK : SYMBOLS.WARNING
    const lines = [
      '',
      `From: ${analysis.sender}`,
      `Status: ${icon} ${analysis.safe ? 'SAFE' : 'RISKY'}`,
      '',
    ]

    if (analysis.warnings.length > 0) {
      lines.push('Warnings:')
      for (const warning of analysis.warnings) {
        lines.push(`${SYMBOLS.BULLET} ${warning}`)
      }
      lines.push('')
    }

    lines.push(`${SYMBOLS.ARROW} ${analysis.recommendation.toUpperCase()}`)
    lines.push('')

    return this.createPanel('TRADE ANALYSIS', lines)
  }

  /**
   * Format output as array of { text, type } objects for terminal
   */
  formatForTerminal(panelLines, baseType = 'sarah') {
    return panelLines.map(line => ({
      text: line,
      type: baseType,
    }))
  }

  /**
   * Create simple bullet list
   */
  createBulletList(items) {
    return items.map(item => `${SYMBOLS.BULLET} ${item}`)
  }

  /**
   * Create numbered list
   */
  createNumberedList(items) {
    return items.map((item, i) => `${i + 1}. ${item}`)
  }
}

// Singleton instance
export const visualFormatter = new VisualFormatter()

// Export symbols for use elsewhere
export { SYMBOLS, BOX }

export default visualFormatter
