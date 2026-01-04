/**
 * SmartErrorCorrector - Intelligent Typo Correction System
 *
 * Features:
 * - Known typo dictionary with instant corrections
 * - Confidence thresholds:
 *   - >95% = auto-correct silently
 *   - >80% = single "Did you mean?" suggestion
 *   - >60% = multiple suggestions
 *   - <60% = natural language fallback
 * - Context-aware corrections based on game state
 * - Learning from user corrections
 */

import { commandRegistry } from '../terminal/CommandRegistry'

// Known typos -> corrections (instant fix)
const KNOWN_TYPOS = {
  // Status variations
  'sttaus': 'status',
  'stauts': 'status',
  'statsu': 'status',
  'statu': 'status',
  'satus': 'status',
  'satatus': 'status',

  // Help variations
  'hlep': 'help',
  'hepl': 'help',
  'hel': 'help',
  'halp': 'help',

  // Crime variations
  'crim': 'crime',
  'criem': 'crime',
  'cirme': 'crime',
  'crimd': 'crime',

  // Bank variations
  'bnk': 'bank',
  'banik': 'bank',
  'bakn': 'bank',
  'bnak': 'bank',

  // Job variations
  'jbo': 'job',
  'jbos': 'jobs',
  'jbob': 'job',

  // Go variations
  'goo': 'go',
  'og': 'go',
  'gi': 'go',

  // Common commands
  'opportunites': 'opportunities',
  'opps': 'opportunities',
  'opp': 'opportunities',
  'opprotunities': 'opportunities',
  'oppurtunities': 'opportunities',
  'msg': 'message',
  'contacs': 'contacts',
  'contatcs': 'contacts',
  'deposite': 'deposit',
  'withdrawl': 'withdraw',
  'widthdraw': 'withdraw',
  'withdaw': 'withdraw',
  'hideotu': 'hideout',
  'hidout': 'hideout',
  'reputaiton': 'reputation',
  'reputaton': 'reputation',
  'laywer': 'lawyer',
  'lawer': 'lawyer'
}

// Confidence thresholds
const THRESHOLDS = {
  AUTO_CORRECT: 95,      // Auto-correct without asking
  SINGLE_SUGGESTION: 80, // Show single "Did you mean?"
  MULTI_SUGGESTION: 60,  // Show multiple options
  FALLBACK: 40           // Natural language help
}

// Storage key for learned corrections
const STORAGE_KEY = 'terminal_error_corrections'

class SmartErrorCorrectorClass {
  constructor() {
    this.commandList = []
    this.learnedCorrections = {}
    this.isInitialized = false
    this.pendingCorrection = null
  }

  /**
   * Initialize the error corrector
   */
  initialize() {
    if (this.isInitialized) return

    this.refreshCommandList()
    this.loadLearnedCorrections()

    this.isInitialized = true
    console.log('[SmartErrorCorrector] Initialized')
  }

  /**
   * Refresh command list from registry
   */
  refreshCommandList() {
    try {
      this.commandList = commandRegistry.getAllCommandNames?.() || []

      // Add common variations
      const extras = ['y', 'n', 'yes', 'no', 'ok', 'help', 'status', 'go',
                      'crime', 'job', 'bank', 'msg', 'contacts', 'opportunities',
                      'accept', 'decline', 'negotiate', 'lawyer', 'hideout',
                      'reputation', 'deposit', 'withdraw', 'clear', 'rest',
                      'lay low', 'tutorial']

      this.commandList = [...new Set([...this.commandList, ...extras])]
    } catch (e) {
      this.commandList = Object.keys(KNOWN_TYPOS).map(k => KNOWN_TYPOS[k])
      this.commandList = [...new Set(this.commandList)]
    }
  }

  /**
   * Check if input is an error and get correction suggestion
   * @param {string} input - User input
   * @param {Object} gameState - Current game state
   * @returns {Object|null} Correction result or null if valid
   */
  checkForError(input, gameState = {}) {
    if (!input || input.length < 2) return null

    const parts = input.toLowerCase().split(/\s+/)
    const baseCmd = parts[0]

    // Check if it's a valid command
    if (this.isValidCommand(baseCmd)) {
      return null
    }

    // Check known typos first (highest priority)
    if (KNOWN_TYPOS[baseCmd]) {
      return {
        type: 'auto_correct',
        original: baseCmd,
        correction: KNOWN_TYPOS[baseCmd],
        confidence: 100,
        fullCommand: this.replaceFirstWord(input, KNOWN_TYPOS[baseCmd])
      }
    }

    // Check learned corrections
    if (this.learnedCorrections[baseCmd]) {
      const learned = this.learnedCorrections[baseCmd]
      return {
        type: 'auto_correct',
        original: baseCmd,
        correction: learned.correction,
        confidence: learned.confidence,
        fullCommand: this.replaceFirstWord(input, learned.correction)
      }
    }

    // Calculate best matches
    const matches = this.findBestMatches(baseCmd)

    if (matches.length === 0) {
      return {
        type: 'unknown',
        original: baseCmd,
        suggestions: this.getContextualSuggestions(gameState)
      }
    }

    const best = matches[0]

    // Auto-correct if very confident
    if (best.confidence >= THRESHOLDS.AUTO_CORRECT) {
      return {
        type: 'auto_correct',
        original: baseCmd,
        correction: best.command,
        confidence: best.confidence,
        fullCommand: this.replaceFirstWord(input, best.command)
      }
    }

    // Single suggestion
    if (best.confidence >= THRESHOLDS.SINGLE_SUGGESTION) {
      return {
        type: 'single_suggestion',
        original: baseCmd,
        correction: best.command,
        confidence: best.confidence,
        fullCommand: this.replaceFirstWord(input, best.command),
        message: `Did you mean "${best.command}"?`
      }
    }

    // Multiple suggestions
    if (best.confidence >= THRESHOLDS.MULTI_SUGGESTION) {
      return {
        type: 'multi_suggestion',
        original: baseCmd,
        suggestions: matches.slice(0, 3).map(m => ({
          command: m.command,
          confidence: m.confidence,
          fullCommand: this.replaceFirstWord(input, m.command)
        })),
        message: 'Did you mean one of these?'
      }
    }

    // Fallback - command not recognized
    return {
      type: 'fallback',
      original: baseCmd,
      suggestions: this.getContextualSuggestions(gameState),
      message: `Command "${baseCmd}" not recognized. Try "help" for available commands.`
    }
  }

  /**
   * Check if command is valid
   */
  isValidCommand(cmd) {
    return this.commandList.some(c =>
      c.toLowerCase() === cmd.toLowerCase() ||
      c.toLowerCase().startsWith(cmd.toLowerCase())
    )
  }

  /**
   * Find best matching commands using Levenshtein distance
   */
  findBestMatches(input) {
    const matches = []

    for (const cmd of this.commandList) {
      if (cmd.length < 2) continue

      const distance = this.levenshteinDistance(input.toLowerCase(), cmd.toLowerCase())
      const maxLen = Math.max(input.length, cmd.length)
      const similarity = ((maxLen - distance) / maxLen) * 100

      // Only include if reasonably similar
      if (similarity >= THRESHOLDS.FALLBACK) {
        matches.push({
          command: cmd,
          distance,
          confidence: Math.round(similarity)
        })
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate Levenshtein edit distance
   */
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const matrix = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }

  /**
   * Get context-aware suggestions
   */
  getContextualSuggestions(gameState) {
    const suggestions = []
    const player = gameState?.player

    if (player) {
      if (player.cash < 500) {
        suggestions.push({ cmd: 'crime', reason: 'Need cash' })
        suggestions.push({ cmd: 'job', reason: 'Earn money' })
      }
      if (player.heat > 60) {
        suggestions.push({ cmd: 'lay low', reason: 'High heat' })
        suggestions.push({ cmd: 'lawyer', reason: 'Get legal help' })
      }
      if (player.energy < 20) {
        suggestions.push({ cmd: 'rest', reason: 'Low energy' })
      }
    }

    // Always suggest help
    if (suggestions.length < 3) {
      suggestions.push({ cmd: 'help', reason: 'See all commands' })
      suggestions.push({ cmd: 'status', reason: 'Check your stats' })
    }

    return suggestions.slice(0, 3)
  }

  /**
   * Replace first word in input
   */
  replaceFirstWord(input, replacement) {
    const parts = input.split(/\s+/)
    parts[0] = replacement
    return parts.join(' ')
  }

  /**
   * Set a pending correction for user confirmation
   */
  setPendingCorrection(correction) {
    this.pendingCorrection = correction
  }

  /**
   * Get pending correction
   */
  getPendingCorrection() {
    return this.pendingCorrection
  }

  /**
   * Clear pending correction
   */
  clearPendingCorrection() {
    this.pendingCorrection = null
  }

  /**
   * User accepted a correction - learn it
   */
  acceptCorrection(original, correction) {
    // Increase confidence for this correction
    if (!this.learnedCorrections[original]) {
      this.learnedCorrections[original] = {
        correction,
        confidence: 90,
        count: 1
      }
    } else {
      const learned = this.learnedCorrections[original]
      learned.count++
      learned.confidence = Math.min(99, learned.confidence + 2)
    }

    this.saveLearnedCorrections()
    this.clearPendingCorrection()
  }

  /**
   * User rejected a correction - learn to avoid it
   */
  rejectCorrection(original, correction) {
    if (this.learnedCorrections[original]?.correction === correction) {
      this.learnedCorrections[original].confidence = Math.max(0,
        this.learnedCorrections[original].confidence - 20
      )

      // Remove if confidence too low
      if (this.learnedCorrections[original].confidence < 30) {
        delete this.learnedCorrections[original]
      }

      this.saveLearnedCorrections()
    }
    this.clearPendingCorrection()
  }

  /**
   * Format correction message for terminal display
   */
  formatCorrectionMessage(result) {
    switch (result.type) {
      case 'auto_correct':
        return `[Auto-corrected: ${result.original} → ${result.correction}]`

      case 'single_suggestion':
        return `Did you mean "${result.correction}"? (Y/N)`

      case 'multi_suggestion':
        const opts = result.suggestions
          .map((s, i) => `${i + 1}. ${s.command}`)
          .join('  ')
        return `Unknown command. Did you mean: ${opts}`

      case 'fallback':
        return result.message

      case 'unknown':
        return `Command "${result.original}" not recognized. Type "help" for commands.`

      default:
        return null
    }
  }

  /**
   * Save learned corrections to localStorage
   */
  saveLearnedCorrections() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.learnedCorrections))
    } catch (e) {
      console.warn('[SmartErrorCorrector] Save failed:', e)
    }
  }

  /**
   * Load learned corrections from localStorage
   */
  loadLearnedCorrections() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        this.learnedCorrections = JSON.parse(saved)
      }
    } catch (e) {
      console.warn('[SmartErrorCorrector] Load failed:', e)
      this.learnedCorrections = {}
    }
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      knownTypos: Object.keys(KNOWN_TYPOS).length,
      learnedCorrections: Object.keys(this.learnedCorrections).length,
      commandCount: this.commandList.length
    }
  }

  /**
   * Clear all learned data
   */
  clearLearned() {
    this.learnedCorrections = {}
    localStorage.removeItem(STORAGE_KEY)
    console.log('[SmartErrorCorrector] Learned data cleared')
  }
}

// Singleton instance
export const smartErrorCorrector = new SmartErrorCorrectorClass()
export default smartErrorCorrector
