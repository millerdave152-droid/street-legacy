/**
 * SessionContext - Multi-turn Conversation State Management
 *
 * Tracks conversation state across turns for contextual understanding:
 * - Recent conversation turns
 * - Current topic/theme
 * - Pending clarifications
 * - Pronoun resolution ("it", "there", "that")
 */

class SessionContextClass {
  constructor() {
    this.turns = []
    this.maxTurns = 10
    this.currentTopic = null
    this.pendingClarification = null
    this.entityMemory = {} // Remember mentioned entities (names, places, items)
    this.lastActionContext = null // What action was just taken

    // Phase 6: Context-aware response selection
    this.intentHistory = []          // Last 5 intents for pattern detection
    this.templateUsage = new Map()   // Track which templates were used recently
    this.repeatQuestions = new Map() // Track repeated questions for frustration detection
    this.sessionStartTime = Date.now()
    this.interactionCount = 0        // Total interactions this session
  }

  /**
   * Track intent usage for smarter template selection
   */
  recordIntent(intent) {
    this.intentHistory.unshift(intent)
    if (this.intentHistory.length > 5) {
      this.intentHistory.pop()
    }
    this.interactionCount++
  }

  /**
   * Record template usage to avoid repetition
   */
  recordTemplateUsage(intent, templateIndex) {
    if (!this.templateUsage.has(intent)) {
      this.templateUsage.set(intent, [])
    }
    const usage = this.templateUsage.get(intent)
    usage.unshift({ index: templateIndex, time: Date.now() })
    // Keep only last 5 uses per intent
    if (usage.length > 5) {
      usage.pop()
    }
  }

  /**
   * Get template indices to avoid (recently used)
   */
  getRecentlyUsedTemplates(intent, withinTurns = 3) {
    if (!this.templateUsage.has(intent)) {
      return []
    }
    return this.templateUsage.get(intent)
      .slice(0, withinTurns)
      .map(u => u.index)
  }

  /**
   * Track repeated questions for frustration detection
   */
  trackQuestion(normalizedQuery) {
    const key = normalizedQuery.toLowerCase().trim()
    const count = (this.repeatQuestions.get(key) || 0) + 1
    this.repeatQuestions.set(key, count)
    return count
  }

  /**
   * Check if user is frustrated (asking same thing repeatedly)
   */
  isFrustrated(normalizedQuery) {
    const key = normalizedQuery.toLowerCase().trim()
    const count = this.repeatQuestions.get(key) || 0
    return count >= 3
  }

  /**
   * Check if this is a repeat question (asked before)
   */
  isRepeatQuestion(normalizedQuery) {
    const key = normalizedQuery.toLowerCase().trim()
    return (this.repeatQuestions.get(key) || 0) >= 2
  }

  /**
   * Get session duration in minutes
   */
  getSessionDuration() {
    return Math.floor((Date.now() - this.sessionStartTime) / 60000)
  }

  /**
   * Get user familiarity level (based on interaction count)
   */
  getFamiliarityLevel() {
    if (this.interactionCount < 5) return 'new'
    if (this.interactionCount < 20) return 'familiar'
    if (this.interactionCount < 50) return 'regular'
    return 'veteran'
  }

  /**
   * Check if same intent was just asked
   */
  isSameIntentAsLast(intent) {
    return this.intentHistory.length > 0 && this.intentHistory[0] === intent
  }

  /**
   * Get context modifiers for response generation
   */
  getResponseModifiers() {
    return {
      familiarity: this.getFamiliarityLevel(),
      sessionDuration: this.getSessionDuration(),
      isRepeat: this.intentHistory.length >= 2 && this.intentHistory[0] === this.intentHistory[1],
      recentIntents: this.intentHistory.slice(0, 3),
      interactionCount: this.interactionCount,
    }
  }

  /**
   * Add a conversation turn
   * @param {string} input - User input
   * @param {string} response - S.A.R.A.H.'s response (first 200 chars)
   * @param {string} intent - Classified intent
   * @param {object} entities - Extracted entities
   */
  addTurn(input, response, intent, entities = {}) {
    const turn = {
      input,
      response: typeof response === 'string' ? response.substring(0, 200) : '',
      intent,
      entities,
      timestamp: Date.now(),
    }

    this.turns.unshift(turn)
    if (this.turns.length > this.maxTurns) {
      this.turns.pop()
    }

    // Update entity memory
    Object.assign(this.entityMemory, entities)

    // Update topic tracking
    this.updateTopic(intent, entities)
  }

  /**
   * Update the current conversation topic
   */
  updateTopic(intent, entities) {
    // Map intents to topic categories
    const topicMap = {
      'crime_advice': 'crime',
      'job_advice': 'jobs',
      'money_advice': 'money',
      'heat_advice': 'heat',
      'stat_analysis': 'status',
      'ai_intel': 'intel',
      'market_analysis': 'market',
      'time_management': 'strategy',
      'crew_management': 'crew',
      'equipment_advice': 'equipment',
      'location_tips': 'locations',
      'territory_strategy': 'territory',
      'jail_strategy': 'jail',
      'alliance_strategy': 'alliances',
    }

    const newTopic = topicMap[intent]
    if (newTopic) {
      this.currentTopic = newTopic
    }

    // Also track location if mentioned
    if (entities.location) {
      this.entityMemory.location = entities.location
    }
    if (entities.playerName) {
      this.entityMemory.playerName = entities.playerName
    }
    if (entities.crimeName) {
      this.entityMemory.crimeName = entities.crimeName
    }
  }

  /**
   * Get recent conversation context
   */
  getRecentContext() {
    return {
      recentTurns: this.turns.slice(0, 3),
      currentTopic: this.currentTopic,
      rememberedEntities: this.entityMemory,
      pendingClarification: this.pendingClarification,
    }
  }

  /**
   * Resolve anaphora (pronouns and references like "it", "there", "that")
   * @param {string} input - User input
   * @returns {string} Input with pronouns resolved
   */
  resolveAnaphora(input) {
    let resolved = input

    // "there" or "that place" → last mentioned location
    if (/\b(there|that place|that area|that district)\b/i.test(input) && this.entityMemory.location) {
      resolved = resolved.replace(/\b(there|that place|that area|that district)\b/gi, this.entityMemory.location)
    }

    // "him", "her", "them", "that person" → last mentioned player
    if (/\b(him|her|them|that person|that player|that guy)\b/i.test(input) && this.entityMemory.playerName) {
      resolved = resolved.replace(/\b(him|her|them|that person|that player|that guy)\b/gi, this.entityMemory.playerName)
    }

    // "it" → context dependent
    if (/\bit\b/i.test(input)) {
      // Try to resolve based on current topic
      if (this.currentTopic === 'crime' && this.entityMemory.crimeName) {
        resolved = resolved.replace(/\bit\b/gi, this.entityMemory.crimeName)
      } else if (this.currentTopic === 'locations' && this.entityMemory.location) {
        resolved = resolved.replace(/\bit\b/gi, this.entityMemory.location)
      }
      // Otherwise leave "it" as is - S.A.R.A.H. will handle
    }

    // "that" → last mentioned thing
    if (/\bthat\b/i.test(input) && !input.match(/\bthat (place|person|player|guy|thing|one)\b/i)) {
      // Only resolve standalone "that" if we have clear context
      if (this.currentTopic && this.turns.length > 0) {
        // Keep as is - too ambiguous to auto-resolve
      }
    }

    return resolved
  }

  /**
   * Set a pending clarification (waiting for user response)
   */
  setPendingClarification(clarification) {
    this.pendingClarification = {
      ...clarification,
      timestamp: Date.now(),
    }
  }

  /**
   * Check if there's a pending clarification
   */
  hasPendingClarification() {
    if (!this.pendingClarification) return false
    // Expire after 2 minutes
    return Date.now() - this.pendingClarification.timestamp < 120000
  }

  /**
   * Get the pending clarification
   */
  getPendingClarification() {
    if (this.hasPendingClarification()) {
      return this.pendingClarification
    }
    return null
  }

  /**
   * Clear the pending clarification
   */
  clearClarification() {
    this.pendingClarification = null
  }

  /**
   * Set context after an action was executed
   */
  setActionContext(action, target) {
    this.lastActionContext = {
      action,
      target,
      timestamp: Date.now()
    }
  }

  /**
   * Get the last action context
   */
  getLastAction() {
    if (!this.lastActionContext) return null
    // Expire after 30 seconds
    if (Date.now() - this.lastActionContext.timestamp > 30000) {
      return null
    }
    return this.lastActionContext
  }

  /**
   * Get the previous turn (for follow-up detection)
   */
  getPreviousTurn() {
    return this.turns[0] || null
  }

  /**
   * Check if this looks like a follow-up to the previous turn
   */
  isFollowUp(input) {
    const normalized = input.toLowerCase().trim()

    // Short responses that are likely follow-ups
    const followUpPatterns = [
      /^(yes|yeah|yep|yea|sure|ok|okay|right|correct|exactly|that'?s? (it|right)|no|nope|nah|not really)$/i,
      /^(the (first|second|third|last) one)$/i,
      /^(option )?\d$/i,
      /^(what about|how about|and|but|also|or)/i,
      /^(tell me more|more info|details|explain)/i,
      /^(why|how|what|when|where)\??$/i,
    ]

    for (const pattern of followUpPatterns) {
      if (pattern.test(normalized)) {
        return true
      }
    }

    // Very short input after a question might be a follow-up
    if (normalized.split(/\s+/).length <= 3 && this.turns.length > 0) {
      const lastTurn = this.turns[0]
      // If last response ended with a question, this is likely an answer
      if (lastTurn.response && lastTurn.response.includes('?')) {
        return true
      }
    }

    return false
  }

  /**
   * Reset session context
   */
  reset() {
    this.turns = []
    this.currentTopic = null
    this.pendingClarification = null
    this.entityMemory = {}
    this.lastActionContext = null
  }

  /**
   * Get session stats for debugging
   */
  getStats() {
    return {
      turnCount: this.turns.length,
      currentTopic: this.currentTopic,
      entities: Object.keys(this.entityMemory),
      hasPendingClarification: this.hasPendingClarification(),
    }
  }
}

// Singleton instance
export const sessionContext = new SessionContextClass()
export default sessionContext
