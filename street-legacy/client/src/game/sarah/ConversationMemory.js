/**
 * ConversationMemory - Persistent memory system for S.A.R.A.H.
 *
 * Features:
 * - Persistent conversation history (localStorage)
 * - Decision tracking (advice → action → outcome)
 * - User preference learning
 * - Session resume capability
 * - Related history lookup
 */

const STORAGE_KEY = 'sarah_memory'
const MAX_EXCHANGES = 50
const MAX_DECISIONS = 100

class ConversationMemory {
  constructor() {
    this.exchanges = []        // Query/response history
    this.decisions = []        // Tracked decisions and outcomes
    this.preferences = {}      // Learned player preferences
    this.sessionStart = Date.now()
    this.isLoaded = false
  }

  /**
   * Initialize memory - load from localStorage
   */
  initialize() {
    if (this.isLoaded) return

    this.loadFromStorage()
    this.isLoaded = true
    console.log(`[ConversationMemory] Loaded ${this.exchanges.length} exchanges, ${this.decisions.length} decisions`)
  }

  /**
   * Add an exchange to memory
   */
  addExchange(query, response, intent, context = {}) {
    const exchange = {
      id: Date.now(),
      query: query.toLowerCase().trim(),
      response: response.substring(0, 500), // Truncate for storage
      intent,
      timestamp: Date.now(),
      playerState: {
        level: context.level || 0,
        energy: context.energy || 0,
        heat: context.heat || 0,
        cash: context.cash || 0,
      },
    }

    this.exchanges.unshift(exchange)

    // Trim to max
    if (this.exchanges.length > MAX_EXCHANGES) {
      this.exchanges = this.exchanges.slice(0, MAX_EXCHANGES)
    }

    // Update preferences based on question patterns
    this.updatePreferences(intent, query)

    this.saveToStorage()
    return exchange.id
  }

  /**
   * Track a decision (advice given → action taken → outcome)
   */
  trackDecision(exchangeId, actionTaken, outcome = null) {
    const decision = {
      exchangeId,
      actionTaken,
      outcome,
      timestamp: Date.now(),
    }

    this.decisions.unshift(decision)

    // Trim to max
    if (this.decisions.length > MAX_DECISIONS) {
      this.decisions = this.decisions.slice(0, MAX_DECISIONS)
    }

    // Learn from outcome
    if (outcome) {
      this.learnFromOutcome(exchangeId, outcome)
    }

    this.saveToStorage()
  }

  /**
   * Update preferences based on query patterns
   */
  updatePreferences(intent, query) {
    // Track query frequency by intent
    if (!this.preferences.intentFrequency) {
      this.preferences.intentFrequency = {}
    }
    this.preferences.intentFrequency[intent] = (this.preferences.intentFrequency[intent] || 0) + 1

    // Track specific interests
    if (query.includes('heist')) {
      this.preferences.prefersHeists = (this.preferences.prefersHeists || 0) + 1
    }
    if (query.includes('job') || query.includes('safe')) {
      this.preferences.prefersSafety = (this.preferences.prefersSafety || 0) + 1
    }
    if (query.includes('money') || query.includes('cash') || query.includes('rich')) {
      this.preferences.focusOnMoney = (this.preferences.focusOnMoney || 0) + 1
    }
    if (query.includes('heat') || query.includes('cops') || query.includes('police')) {
      this.preferences.worriesAboutHeat = (this.preferences.worriesAboutHeat || 0) + 1
    }
  }

  /**
   * Learn from decision outcomes
   */
  learnFromOutcome(exchangeId, outcome) {
    const exchange = this.exchanges.find(e => e.id === exchangeId)
    if (!exchange) return

    // Track success rate by intent
    if (!this.preferences.successByIntent) {
      this.preferences.successByIntent = {}
    }

    if (!this.preferences.successByIntent[exchange.intent]) {
      this.preferences.successByIntent[exchange.intent] = { success: 0, total: 0 }
    }

    this.preferences.successByIntent[exchange.intent].total++
    if (outcome.success) {
      this.preferences.successByIntent[exchange.intent].success++
    }
  }

  /**
   * Get player preferences summary
   */
  getPlayerPreferences() {
    const prefs = []

    if (this.preferences.prefersHeists > 3) {
      prefs.push('likes big scores')
    }
    if (this.preferences.prefersSafety > 3) {
      prefs.push('plays it safe')
    }
    if (this.preferences.focusOnMoney > 5) {
      prefs.push('focused on money')
    }
    if (this.preferences.worriesAboutHeat > 3) {
      prefs.push('careful about heat')
    }

    // Most asked about
    if (this.preferences.intentFrequency) {
      const sorted = Object.entries(this.preferences.intentFrequency)
        .sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) {
        prefs.push(`often asks about ${sorted[0][0].replace('_', ' ')}`)
      }
    }

    return prefs
  }

  /**
   * Find related history for a query
   */
  getRelatedHistory(query, limit = 3) {
    const normalized = query.toLowerCase()
    const keywords = normalized.split(/\s+/).filter(w => w.length > 3)

    // Score each exchange by keyword matches
    const scored = this.exchanges.map(exchange => {
      let score = 0
      for (const keyword of keywords) {
        if (exchange.query.includes(keyword)) {
          score++
        }
      }
      return { exchange, score }
    })

    // Return top matches
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.exchange)
  }

  /**
   * Get recent exchanges
   */
  getRecentExchanges(limit = 5) {
    return this.exchanges.slice(0, limit)
  }

  /**
   * Check if we've answered this before
   */
  findSimilarPastQuery(query) {
    const normalized = query.toLowerCase().trim()

    // Exact match
    const exact = this.exchanges.find(e => e.query === normalized)
    if (exact) {
      return {
        type: 'exact',
        exchange: exact,
        message: `You asked this before. Here's what I said last time:`,
      }
    }

    // Fuzzy match (80% similar)
    for (const exchange of this.exchanges.slice(0, 20)) {
      const similarity = this.calculateSimilarity(normalized, exchange.query)
      if (similarity > 0.8) {
        return {
          type: 'similar',
          exchange,
          message: `You asked something similar before:`,
        }
      }
    }

    return null
  }

  /**
   * Simple similarity calculation
   */
  calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(/\s+/))
    const words2 = new Set(str2.split(/\s+/))

    let matches = 0
    for (const word of words1) {
      if (words2.has(word)) matches++
    }

    const total = Math.max(words1.size, words2.size)
    return total > 0 ? matches / total : 0
  }

  /**
   * Get conversation stats
   */
  getStats() {
    return {
      totalExchanges: this.exchanges.length,
      totalDecisions: this.decisions.length,
      sessionStart: this.sessionStart,
      topIntent: this.getTopIntent(),
      preferences: this.getPlayerPreferences(),
    }
  }

  /**
   * Get most asked intent
   */
  getTopIntent() {
    if (!this.preferences.intentFrequency) return null

    const sorted = Object.entries(this.preferences.intentFrequency)
      .sort((a, b) => b[1] - a[1])

    return sorted.length > 0 ? sorted[0][0] : null
  }

  /**
   * Generate personalized greeting based on history
   */
  getPersonalizedGreeting() {
    const exchangeCount = this.exchanges.length
    const prefs = this.getPlayerPreferences()

    if (exchangeCount === 0) {
      return null // First time, use default greeting
    }

    if (exchangeCount < 5) {
      return "Good to see you again, runner. What's on your mind?"
    }

    if (prefs.includes('focused on money')) {
      return "Back for more money-making tips? I got you."
    }

    if (prefs.includes('likes big scores')) {
      return "Ready for another big score? Let's plan something."
    }

    if (prefs.includes('careful about heat')) {
      return "Staying careful out there? Smart move. What do you need?"
    }

    return `We've talked ${exchangeCount} times now. What's the play today?`
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        exchanges: this.exchanges,
        decisions: this.decisions,
        preferences: this.preferences,
        lastSaved: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[ConversationMemory] Failed to save:', e)
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.exchanges = data.exchanges || []
        this.decisions = data.decisions || []
        this.preferences = data.preferences || {}
      }
    } catch (e) {
      console.warn('[ConversationMemory] Failed to load:', e)
    }
  }

  /**
   * Clear all memory
   */
  clearMemory() {
    this.exchanges = []
    this.decisions = []
    this.preferences = {}
    localStorage.removeItem(STORAGE_KEY)
    console.log('[ConversationMemory] Memory cleared')
  }
}

// Singleton instance
export const conversationMemory = new ConversationMemory()

export default conversationMemory
