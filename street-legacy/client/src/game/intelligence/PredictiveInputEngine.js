/**
 * PredictiveInputEngine - Ghost Text Predictions
 *
 * Features:
 * - Prefix matching with command registry
 * - Fuzzy matching for typos
 * - Context-aware suggestions (low cash -> suggest "bank", "job")
 * - Frequency-based predictions from user patterns
 * - Sequence prediction (what follows last command)
 */

import { commandRegistry } from '../terminal/CommandRegistry'

const STORAGE_KEY = 'terminal_prediction_data'

// Context triggers for suggestions
const CONTEXT_TRIGGERS = {
  lowCash: {
    condition: (state) => state.player?.cash < 500,
    suggestions: ['crime', 'job', 'bank'],
    priority: 70
  },
  highHeat: {
    condition: (state) => state.player?.heat > 60,
    suggestions: ['lay low', 'status', 'lawyer'],
    priority: 90
  },
  lowEnergy: {
    condition: (state) => state.player?.energy < 20,
    suggestions: ['rest', 'status'],
    priority: 80
  },
  newGame: {
    condition: (state) => state.player?.level === 1,
    suggestions: ['help', 'status', 'tutorial'],
    priority: 60
  }
}

// Common typos and their corrections
const KNOWN_TYPOS = {
  'sttaus': 'status',
  'stauts': 'status',
  'statsu': 'status',
  'hlep': 'help',
  'hepl': 'help',
  'crim': 'crime',
  'criem': 'crime',
  'bnk': 'bank',
  'banik': 'bank',
  'jbo': 'job',
  'jbos': 'jobs',
  'goo': 'go',
  'opportunites': 'opportunities',
  'opps': 'opportunities'
}

class PredictiveInputEngineClass {
  constructor() {
    this.data = null
    this.commandList = []
    this.isInitialized = false
  }

  /**
   * Initialize the prediction engine
   */
  initialize() {
    if (this.isInitialized) return

    this.data = this.loadData()
    this.refreshCommandList()

    this.isInitialized = true
    console.log('[PredictiveInputEngine] Initialized with ' + this.commandList.length + ' commands')
  }

  /**
   * Refresh the list of available commands
   */
  refreshCommandList() {
    try {
      this.commandList = commandRegistry.getAllCommandNames?.() || []

      // Add common aliases
      const aliases = ['y', 'n', 'yes', 'no', 'ok', 'help', 'status', 'go', 'crime',
                       'job', 'bank', 'msg', 'contacts', 'opportunities', 'accept',
                       'decline', 'negotiate', 'lawyer', 'hideout', 'reputation']

      this.commandList = [...new Set([...this.commandList, ...aliases])]
    } catch (e) {
      // Fallback command list
      this.commandList = ['help', 'status', 'go', 'crime', 'job', 'bank', 'msg',
                          'contacts', 'opportunities', 'accept', 'decline', 'clear']
    }
  }

  /**
   * Get predictions for partial input
   * @param {string} partialInput - Current input text
   * @param {Object} gameState - Current game state
   * @returns {Array} Array of predictions with scores
   */
  getPredictions(partialInput, gameState = {}) {
    if (!partialInput || partialInput.length === 0) {
      return this.getContextualSuggestions(gameState)
    }

    const input = partialInput.toLowerCase().trim()
    const predictions = []

    // 1. Exact prefix matching (highest priority)
    const prefixMatches = this.commandList
      .filter(cmd => cmd.startsWith(input))
      .map(cmd => ({
        text: cmd,
        score: 100 - (cmd.length - input.length), // Shorter matches score higher
        source: 'prefix',
        completion: cmd.slice(input.length)
      }))
    predictions.push(...prefixMatches)

    // 2. Known typo corrections
    if (KNOWN_TYPOS[input]) {
      predictions.push({
        text: KNOWN_TYPOS[input],
        score: 95,
        source: 'typo_correction',
        completion: KNOWN_TYPOS[input]
      })
    }

    // 3. Fuzzy matching for longer inputs
    if (input.length >= 3) {
      const fuzzyMatches = this.getFuzzyMatches(input)
      predictions.push(...fuzzyMatches)
    }

    // 4. Frequency-based predictions
    if (this.data.commandFrequency[input]) {
      const freq = this.data.commandFrequency[input]
      predictions.push({
        text: input,
        score: 50 + Math.min(freq.count, 20),
        source: 'frequency'
      })
    }

    // 5. Sequence predictions (what usually follows last command)
    const sequencePredictions = this.getSequencePredictions(input, gameState)
    predictions.push(...sequencePredictions)

    // 6. Context-aware suggestions
    const contextSuggestions = this.getContextualSuggestions(gameState)
      .filter(s => s.text.startsWith(input))
      .map(s => ({ ...s, score: s.score * 0.8 }))
    predictions.push(...contextSuggestions)

    // Deduplicate and sort
    return this.deduplicateAndSort(predictions)
  }

  /**
   * Get fuzzy matches for typos
   */
  getFuzzyMatches(input) {
    const matches = []

    for (const cmd of this.commandList) {
      if (cmd.length < 3) continue

      const distance = this.levenshteinDistance(input, cmd)
      const maxDistance = Math.floor(input.length / 3) + 1

      if (distance <= maxDistance && distance > 0) {
        matches.push({
          text: cmd,
          score: 80 - (distance * 15),
          source: 'fuzzy',
          completion: cmd
        })
      }
    }

    return matches.slice(0, 3)
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
   * Get sequence predictions based on previous command
   */
  getSequencePredictions(input, gameState) {
    const predictions = []

    // Get last command from context
    try {
      const contextMemory = require('./ContextMemoryManager').contextMemoryManager
      const recentCommands = contextMemory?.getRecentCommands?.(3) || []

      if (recentCommands.length > 0) {
        const lastCmd = recentCommands[0].split(' ')[0]
        const sequences = this.data.sequences[lastCmd]

        if (sequences) {
          Object.entries(sequences)
            .filter(([cmd]) => cmd.startsWith(input))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .forEach(([cmd, count]) => {
              predictions.push({
                text: cmd,
                score: 60 + Math.min(count * 2, 20),
                source: 'sequence',
                completion: cmd
              })
            })
        }
      }
    } catch (e) {
      // Context memory not available
    }

    return predictions
  }

  /**
   * Get context-aware suggestions based on game state
   */
  getContextualSuggestions(gameState) {
    const suggestions = []

    for (const [name, trigger] of Object.entries(CONTEXT_TRIGGERS)) {
      if (trigger.condition(gameState)) {
        trigger.suggestions.forEach(cmd => {
          suggestions.push({
            text: cmd,
            score: trigger.priority,
            source: 'context',
            context: name
          })
        })
      }
    }

    return suggestions
  }

  /**
   * Deduplicate predictions and sort by score
   */
  deduplicateAndSort(predictions) {
    const seen = new Map()

    predictions.forEach(p => {
      if (!seen.has(p.text) || seen.get(p.text).score < p.score) {
        seen.set(p.text, p)
      }
    })

    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  /**
   * Record a command execution for learning
   */
  recordCommand(command, gameState = {}) {
    if (!command) return

    const cmdParts = command.toLowerCase().split(' ')
    const baseCmd = cmdParts[0]

    // Update command frequency
    if (!this.data.commandFrequency[baseCmd]) {
      this.data.commandFrequency[baseCmd] = {
        count: 0,
        lastUsed: null,
        contexts: {}
      }
    }

    const freq = this.data.commandFrequency[baseCmd]
    freq.count++
    freq.lastUsed = Date.now()

    // Track context
    const contextKey = this.getContextKey(gameState)
    if (contextKey) {
      freq.contexts[contextKey] = (freq.contexts[contextKey] || 0) + 1
    }

    // Update sequences (what command follows what)
    const recentCommands = this.getRecentCommandsFromMemory()
    if (recentCommands.length > 0) {
      const prevCmd = recentCommands[0].split(' ')[0]

      if (!this.data.sequences[prevCmd]) {
        this.data.sequences[prevCmd] = {}
      }

      this.data.sequences[prevCmd][baseCmd] =
        (this.data.sequences[prevCmd][baseCmd] || 0) + 1
    }

    // Auto-save periodically
    if (freq.count % 10 === 0) {
      this.save()
    }
  }

  /**
   * Get context key from game state
   */
  getContextKey(gameState) {
    if (!gameState?.player) return null

    const p = gameState.player
    if (p.cash < 500) return 'lowCash'
    if (p.heat > 70) return 'highHeat'
    if (p.energy < 20) return 'lowEnergy'
    return 'normal'
  }

  /**
   * Get recent commands from context memory
   */
  getRecentCommandsFromMemory() {
    try {
      const contextMemory = require('./ContextMemoryManager').contextMemoryManager
      return contextMemory?.getRecentCommands?.(3) || []
    } catch (e) {
      return []
    }
  }

  /**
   * Get the top prediction for ghost text
   */
  getTopPrediction(input, gameState = {}) {
    const predictions = this.getPredictions(input, gameState)
    return predictions.length > 0 ? predictions[0] : null
  }

  /**
   * Check if input might be a typo
   */
  mightBeTypo(input) {
    if (input.length < 3) return false
    if (KNOWN_TYPOS[input.toLowerCase()]) return true

    // Check if no exact prefix match but fuzzy matches exist
    const hasPrefix = this.commandList.some(cmd => cmd.startsWith(input.toLowerCase()))
    if (!hasPrefix) {
      const fuzzy = this.getFuzzyMatches(input.toLowerCase())
      return fuzzy.length > 0
    }

    return false
  }

  /**
   * Get correction for a typo
   */
  getCorrection(input) {
    const lower = input.toLowerCase()

    // Check known typos first
    if (KNOWN_TYPOS[lower]) {
      return KNOWN_TYPOS[lower]
    }

    // Try fuzzy match
    const fuzzy = this.getFuzzyMatches(lower)
    return fuzzy.length > 0 ? fuzzy[0].text : null
  }

  /**
   * Save prediction data to localStorage
   */
  save() {
    try {
      const data = {
        ...this.data,
        lastSaved: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[PredictiveInputEngine] Save failed:', e)
    }
  }

  /**
   * Load prediction data from localStorage
   */
  loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        return {
          commandFrequency: data.commandFrequency || {},
          sequences: data.sequences || {},
          version: data.version || 1
        }
      }
    } catch (e) {
      console.warn('[PredictiveInputEngine] Load failed:', e)
    }

    return {
      commandFrequency: {},
      sequences: {},
      version: 1
    }
  }

  /**
   * Clear all prediction data
   */
  clearData() {
    localStorage.removeItem(STORAGE_KEY)
    this.data = this.loadData()
    console.log('[PredictiveInputEngine] Data cleared')
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      commandCount: Object.keys(this.data.commandFrequency).length,
      sequenceCount: Object.keys(this.data.sequences).length,
      topCommands: Object.entries(this.data.commandFrequency)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([cmd, data]) => ({ cmd, count: data.count }))
    }
  }
}

// Singleton instance
export const predictiveInputEngine = new PredictiveInputEngineClass()
export default predictiveInputEngine
