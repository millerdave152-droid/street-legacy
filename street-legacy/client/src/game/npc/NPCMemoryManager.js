/**
 * NPCMemoryManager - NPC Interaction Memory System
 *
 * NPCs remember every interaction with the player:
 * - Deal outcomes (success, failure, betrayal)
 * - Conversation topics
 * - Favors given/received
 * - Trust-building moments
 * - Breaking point events
 *
 * Memory enables:
 * - Callbacks in dialogue ("Remember that heist?")
 * - Evolving relationships
 * - Gossip propagation between NPCs
 * - Dynamic epithets based on history
 */

const STORAGE_KEY = 'street_legacy_npc_memories'

// Memory significance levels
const SIGNIFICANCE = {
  TRIVIAL: 1,      // Small talk, minor interactions
  MINOR: 2,        // Regular deals, standard jobs
  MODERATE: 3,     // Successful partnerships, medium deals
  MAJOR: 4,        // Big scores, significant help
  LEGENDARY: 5     // Life-changing events, massive betrayals
}

// Event types that can be remembered
const EVENT_TYPES = {
  // Deals
  DEAL_ACCEPTED: 'deal_accepted',
  DEAL_DECLINED: 'deal_declined',
  DEAL_COMPLETED: 'deal_completed',
  DEAL_FAILED: 'deal_failed',
  DEAL_BETRAYED: 'deal_betrayed',

  // Jobs
  JOB_COMPLETED: 'job_completed',
  JOB_BOTCHED: 'job_botched',

  // Social
  FIRST_MEETING: 'first_meeting',
  FAVOR_GIVEN: 'favor_given',
  FAVOR_RECEIVED: 'favor_received',
  HELPED_ESCAPE: 'helped_escape',
  SAVED_FROM_COPS: 'saved_from_cops',
  LIED_TO: 'lied_to',
  STOOD_UP: 'stood_up',

  // Trust
  TRUST_BROKEN: 'trust_broken',
  TRUST_PROVEN: 'trust_proven',
  LOYALTY_DEMONSTRATED: 'loyalty_demonstrated',

  // Scores
  BIG_SCORE: 'big_score',
  SHARED_PROFITS: 'shared_profits',
  SHORTCHANGED: 'shortchanged',

  // Conflict
  ARGUMENT: 'argument',
  FIGHT: 'fight',
  MADE_AMENDS: 'made_amends',
  FORGIVEN: 'forgiven'
}

// Player epithets based on relationship level
const EPITHETS = {
  stranger: ['stranger', 'new face', 'unknown'],
  acquaintance: ['kid', 'newcomer', 'rookie'],
  business: ['associate', 'partner', 'contact'],
  friend: ['friend', 'homie', 'fam'],
  trusted: ['legend', 'blood', 'family', 'ride-or-die'],
  enemy: ['snake', 'rat', 'traitor', 'dead man walking']
}

// Default memory structure for an NPC
const createDefaultNPCMemory = (npcId) => ({
  npcId,
  interactions: [],
  summary: {
    totalDeals: 0,
    successfulDeals: 0,
    failedDeals: 0,
    betrayals: 0,
    totalValue: 0,
    favorsOwed: 0,
    favorsGiven: 0,
    lastInteraction: null,
    firstInteraction: null,
    interactionCount: 0
  },
  memorableEvents: [],
  relationshipStage: 'stranger',
  playerEpithets: ['stranger'],
  gossip: {
    heardFrom: [],
    content: []
  },
  tags: [],
  version: 1
})

class NPCMemoryManagerClass {
  constructor() {
    this.memories = {}
    this.isInitialized = false
    this.listeners = []
  }

  /**
   * Initialize the memory manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadMemories()
    this.isInitialized = true
    console.log('[NPCMemoryManager] Initialized with ' +
      Object.keys(this.memories).length + ' NPC memories')
  }

  /**
   * Get or create memory for an NPC
   */
  getMemory(npcId) {
    if (!this.memories[npcId]) {
      this.memories[npcId] = createDefaultNPCMemory(npcId)
    }
    return this.memories[npcId]
  }

  /**
   * Record an interaction with an NPC
   * @param {string} npcId - NPC identifier
   * @param {string} eventType - Type of event from EVENT_TYPES
   * @param {Object} context - Additional context for the event
   */
  recordInteraction(npcId, eventType, context = {}) {
    const memory = this.getMemory(npcId)
    const now = Date.now()

    const interaction = {
      type: eventType,
      timestamp: now,
      context: {
        location: context.location || null,
        dealValue: context.dealValue || 0,
        playerLevel: context.playerLevel || 1,
        playerHeat: context.playerHeat || 0,
        details: context.details || null
      },
      significance: this.calculateSignificance(eventType, context)
    }

    // Add to interactions list
    memory.interactions.unshift(interaction)

    // Keep only last 100 interactions per NPC
    if (memory.interactions.length > 100) {
      memory.interactions.pop()
    }

    // Update summary
    this.updateSummary(memory, eventType, context)

    // Check for memorable events
    if (interaction.significance >= SIGNIFICANCE.MODERATE) {
      this.addMemorableEvent(memory, eventType, interaction)
    }

    // Update relationship stage
    this.updateRelationshipStage(memory)

    // Update epithets
    this.updateEpithets(memory)

    // First interaction tracking
    if (!memory.summary.firstInteraction) {
      memory.summary.firstInteraction = now
    }
    memory.summary.lastInteraction = now
    memory.summary.interactionCount++

    // Auto-save
    this.saveMemories()

    // Notify listeners
    this.notifyListeners('interaction', { npcId, eventType, interaction })

    return interaction
  }

  /**
   * Calculate significance of an event
   */
  calculateSignificance(eventType, context) {
    const value = context.dealValue || 0

    switch (eventType) {
      case EVENT_TYPES.DEAL_BETRAYED:
      case EVENT_TYPES.SAVED_FROM_COPS:
      case EVENT_TYPES.BIG_SCORE:
        return SIGNIFICANCE.LEGENDARY

      case EVENT_TYPES.TRUST_BROKEN:
      case EVENT_TYPES.TRUST_PROVEN:
      case EVENT_TYPES.LOYALTY_DEMONSTRATED:
      case EVENT_TYPES.HELPED_ESCAPE:
        return SIGNIFICANCE.MAJOR

      case EVENT_TYPES.DEAL_COMPLETED:
      case EVENT_TYPES.JOB_COMPLETED:
        if (value > 5000) return SIGNIFICANCE.MAJOR
        if (value > 1000) return SIGNIFICANCE.MODERATE
        return SIGNIFICANCE.MINOR

      case EVENT_TYPES.FIRST_MEETING:
        return SIGNIFICANCE.MODERATE

      case EVENT_TYPES.DEAL_DECLINED:
      case EVENT_TYPES.DEAL_ACCEPTED:
        return SIGNIFICANCE.MINOR

      default:
        return SIGNIFICANCE.TRIVIAL
    }
  }

  /**
   * Update summary statistics
   */
  updateSummary(memory, eventType, context) {
    const summary = memory.summary
    const value = context.dealValue || 0

    switch (eventType) {
      case EVENT_TYPES.DEAL_COMPLETED:
        summary.totalDeals++
        summary.successfulDeals++
        summary.totalValue += value
        break

      case EVENT_TYPES.DEAL_FAILED:
      case EVENT_TYPES.JOB_BOTCHED:
        summary.totalDeals++
        summary.failedDeals++
        break

      case EVENT_TYPES.DEAL_BETRAYED:
        summary.betrayals++
        break

      case EVENT_TYPES.FAVOR_GIVEN:
        summary.favorsGiven++
        break

      case EVENT_TYPES.FAVOR_RECEIVED:
        summary.favorsOwed++
        break
    }
  }

  /**
   * Add a memorable event that can be referenced later
   */
  addMemorableEvent(memory, eventType, interaction) {
    const event = {
      type: eventType,
      description: this.generateEventDescription(eventType, interaction.context),
      sentiment: this.getEventSentiment(eventType),
      timestamp: interaction.timestamp,
      canReference: true,
      referencedCount: 0
    }

    memory.memorableEvents.unshift(event)

    // Keep only 20 memorable events
    if (memory.memorableEvents.length > 20) {
      memory.memorableEvents.pop()
    }
  }

  /**
   * Generate a description for a memorable event
   */
  generateEventDescription(eventType, context) {
    const value = context.dealValue ? `$${context.dealValue.toLocaleString()}` : null

    switch (eventType) {
      case EVENT_TYPES.DEAL_COMPLETED:
        return value ? `that ${value} deal we did` : 'that deal we closed'
      case EVENT_TYPES.DEAL_BETRAYED:
        return 'when you stabbed me in the back'
      case EVENT_TYPES.BIG_SCORE:
        return value ? `the ${value} score we pulled` : 'that big score'
      case EVENT_TYPES.SAVED_FROM_COPS:
        return 'when you saved me from the cops'
      case EVENT_TYPES.HELPED_ESCAPE:
        return 'when you helped me escape'
      case EVENT_TYPES.FIRST_MEETING:
        return 'when we first met'
      case EVENT_TYPES.TRUST_PROVEN:
        return 'when you proved your loyalty'
      case EVENT_TYPES.LOYALTY_DEMONSTRATED:
        return 'when you had my back'
      case EVENT_TYPES.JOB_COMPLETED:
        return 'that job we pulled off'
      default:
        return 'that time'
    }
  }

  /**
   * Get sentiment of an event (positive, negative, neutral)
   */
  getEventSentiment(eventType) {
    const positive = [
      EVENT_TYPES.DEAL_COMPLETED,
      EVENT_TYPES.BIG_SCORE,
      EVENT_TYPES.SAVED_FROM_COPS,
      EVENT_TYPES.HELPED_ESCAPE,
      EVENT_TYPES.TRUST_PROVEN,
      EVENT_TYPES.LOYALTY_DEMONSTRATED,
      EVENT_TYPES.FAVOR_RECEIVED,
      EVENT_TYPES.JOB_COMPLETED,
      EVENT_TYPES.SHARED_PROFITS,
      EVENT_TYPES.MADE_AMENDS,
      EVENT_TYPES.FORGIVEN
    ]

    const negative = [
      EVENT_TYPES.DEAL_BETRAYED,
      EVENT_TYPES.DEAL_FAILED,
      EVENT_TYPES.JOB_BOTCHED,
      EVENT_TYPES.TRUST_BROKEN,
      EVENT_TYPES.LIED_TO,
      EVENT_TYPES.STOOD_UP,
      EVENT_TYPES.SHORTCHANGED,
      EVENT_TYPES.ARGUMENT,
      EVENT_TYPES.FIGHT
    ]

    if (positive.includes(eventType)) return 'positive'
    if (negative.includes(eventType)) return 'negative'
    return 'neutral'
  }

  /**
   * Update relationship stage based on history
   */
  updateRelationshipStage(memory) {
    const s = memory.summary

    // Check for enemy status
    if (s.betrayals > 0) {
      memory.relationshipStage = 'enemy'
      return
    }

    // Calculate trust score
    const successRate = s.totalDeals > 0 ?
      s.successfulDeals / s.totalDeals : 0
    const favorBalance = s.favorsGiven - s.favorsOwed

    let trustScore = 0
    trustScore += Math.min(s.interactionCount * 2, 20)  // Max 20 from interactions
    trustScore += Math.min(s.successfulDeals * 5, 30)   // Max 30 from deals
    trustScore += successRate * 20                       // Max 20 from success rate
    trustScore += Math.min(s.totalValue / 1000, 20)     // Max 20 from deal value
    trustScore += favorBalance * 5                       // Favor balance

    // Check for legendary events
    const legendaryEvents = memory.memorableEvents.filter(
      e => this.calculateSignificance(e.type, {}) === SIGNIFICANCE.LEGENDARY
    )
    trustScore += legendaryEvents.length * 15

    // Determine stage
    if (trustScore >= 80) {
      memory.relationshipStage = 'trusted'
    } else if (trustScore >= 50) {
      memory.relationshipStage = 'friend'
    } else if (trustScore >= 25) {
      memory.relationshipStage = 'business'
    } else if (trustScore >= 10) {
      memory.relationshipStage = 'acquaintance'
    } else {
      memory.relationshipStage = 'stranger'
    }
  }

  /**
   * Update player epithets based on relationship
   */
  updateEpithets(memory) {
    const stage = memory.relationshipStage
    const epithetPool = EPITHETS[stage] || EPITHETS.stranger

    // Mix in some variation
    memory.playerEpithets = [...epithetPool]

    // Add special epithets based on history
    const summary = memory.summary

    if (summary.totalValue > 50000) {
      memory.playerEpithets.push('big earner')
    }
    if (summary.successfulDeals > 10 && summary.failedDeals === 0) {
      memory.playerEpithets.push('reliable')
    }
    if (summary.favorsGiven > 3) {
      memory.playerEpithets.push('generous')
    }
  }

  /**
   * Get a random epithet for the player from this NPC's perspective
   */
  getEpithet(npcId) {
    const memory = this.getMemory(npcId)
    const epithets = memory.playerEpithets

    if (epithets.length === 0) return 'stranger'
    return epithets[Math.floor(Math.random() * epithets.length)]
  }

  /**
   * Get referencable memories for dialogue
   */
  getReferencableMemories(npcId, limit = 3) {
    const memory = this.getMemory(npcId)

    return memory.memorableEvents
      .filter(e => e.canReference)
      .slice(0, limit)
      .map(e => ({
        description: e.description,
        sentiment: e.sentiment,
        timeAgo: this.formatTimeAgo(e.timestamp)
      }))
  }

  /**
   * Format time ago string
   */
  formatTimeAgo(timestamp) {
    const now = Date.now()
    const diff = now - timestamp

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const weeks = Math.floor(diff / 604800000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
    return 'a while back'
  }

  /**
   * Mark a memory as referenced (to avoid repeating)
   */
  markAsReferenced(npcId, eventType) {
    const memory = this.getMemory(npcId)
    const event = memory.memorableEvents.find(e => e.type === eventType)

    if (event) {
      event.referencedCount++
      // Reduce reference probability after 3 uses
      if (event.referencedCount >= 3) {
        event.canReference = false
      }
      this.saveMemories()
    }
  }

  /**
   * Add gossip from another NPC
   */
  addGossip(targetNpcId, sourceNpcId, content) {
    const memory = this.getMemory(targetNpcId)

    memory.gossip.heardFrom.push(sourceNpcId)
    memory.gossip.content.push({
      from: sourceNpcId,
      content,
      timestamp: Date.now()
    })

    // Keep only last 10 gossip items
    if (memory.gossip.content.length > 10) {
      memory.gossip.content.pop()
      memory.gossip.heardFrom.pop()
    }

    this.saveMemories()
  }

  /**
   * Get gossip this NPC has heard about the player
   */
  getGossip(npcId) {
    const memory = this.getMemory(npcId)
    return memory.gossip.content.slice(0, 3)
  }

  /**
   * Check if NPC has met player before
   */
  hasMetPlayer(npcId) {
    const memory = this.getMemory(npcId)
    return memory.summary.interactionCount > 0
  }

  /**
   * Get relationship summary for display
   */
  getRelationshipSummary(npcId) {
    const memory = this.getMemory(npcId)
    const s = memory.summary

    return {
      stage: memory.relationshipStage,
      totalDeals: s.totalDeals,
      successRate: s.totalDeals > 0 ?
        Math.round((s.successfulDeals / s.totalDeals) * 100) : 0,
      totalValue: s.totalValue,
      favorsBalance: s.favorsGiven - s.favorsOwed,
      lastSeen: s.lastInteraction ? this.formatTimeAgo(s.lastInteraction) : 'never',
      isEnemy: memory.relationshipStage === 'enemy'
    }
  }

  /**
   * Add listener for memory events
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data)
      } catch (e) {
        console.error('[NPCMemoryManager] Listener error:', e)
      }
    })
  }

  /**
   * Save all memories to localStorage
   */
  saveMemories() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        memories: this.memories,
        savedAt: Date.now(),
        version: 1
      }))
    } catch (e) {
      console.warn('[NPCMemoryManager] Save failed:', e)
    }
  }

  /**
   * Load memories from localStorage
   */
  loadMemories() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.memories = data.memories || {}
      }
    } catch (e) {
      console.warn('[NPCMemoryManager] Load failed:', e)
      this.memories = {}
    }
  }

  /**
   * Clear all NPC memories (for testing/reset)
   */
  clearAllMemories() {
    this.memories = {}
    localStorage.removeItem(STORAGE_KEY)
    console.log('[NPCMemoryManager] All memories cleared')
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      npcCount: Object.keys(this.memories).length,
      totalInteractions: Object.values(this.memories)
        .reduce((sum, m) => sum + m.summary.interactionCount, 0),
      memorableEvents: Object.values(this.memories)
        .reduce((sum, m) => sum + m.memorableEvents.length, 0)
    }
  }
}

// Singleton instance
export const npcMemoryManager = new NPCMemoryManagerClass()

// Export constants for external use
export { EVENT_TYPES, SIGNIFICANCE, EPITHETS }
export default npcMemoryManager
