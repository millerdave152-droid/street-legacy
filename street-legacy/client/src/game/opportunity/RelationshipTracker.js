/**
 * RelationshipTracker - Track NPC relationships and trust levels
 *
 * Manages:
 * - Trust levels per NPC (-100 to 100)
 * - Relationship status (hostile, neutral, friendly, allied)
 * - Favor balance (who owes who)
 * - Interaction history
 * - Betrayal risk calculation
 */

// Relationship status thresholds
export const RELATIONSHIP_STATUS = {
  HOSTILE: { min: -100, max: -50, label: 'Hostile' },
  DISTRUSTED: { min: -49, max: -20, label: 'Distrusted' },
  WARY: { min: -19, max: 0, label: 'Wary' },
  NEUTRAL: { min: 1, max: 20, label: 'Neutral' },
  FRIENDLY: { min: 21, max: 50, label: 'Friendly' },
  TRUSTED: { min: 51, max: 80, label: 'Trusted' },
  LOYAL: { min: 81, max: 100, label: 'Loyal' },
}

// Interaction types and their trust impacts
const INTERACTION_IMPACTS = {
  // Positive interactions
  completed_job: 10,
  successful_heist: 15,
  shared_loot: 8,
  defended_npc: 20,
  paid_debt: 12,
  gift: 5,
  alliance_formed: 25,
  secret_shared: 10,

  // Neutral interactions
  conversation: 1,
  trade_fair: 2,
  met: 1,

  // Negative interactions
  declined_job: -2,
  failed_job: -15,
  betrayed: -50,
  stole_from: -30,
  snitched: -80,
  ignored: -5,
  rude: -3,
  broke_promise: -25,
  alliance_broken: -40,
}

// NPC archetypes with base traits
const NPC_ARCHETYPES = {
  fixer: {
    baseTrust: 10,
    loyalty: 0.7,
    forgiveness: 0.5,
    betrayalRisk: 0.2,
  },
  dealer: {
    baseTrust: 0,
    loyalty: 0.4,
    forgiveness: 0.6,
    betrayalRisk: 0.4,
  },
  enforcer: {
    baseTrust: -10,
    loyalty: 0.8,
    forgiveness: 0.2,
    betrayalRisk: 0.3,
  },
  informant: {
    baseTrust: 5,
    loyalty: 0.3,
    forgiveness: 0.7,
    betrayalRisk: 0.6,
  },
  boss: {
    baseTrust: 0,
    loyalty: 0.6,
    forgiveness: 0.3,
    betrayalRisk: 0.5,
  },
}

class RelationshipTrackerClass {
  constructor() {
    this.relationships = new Map()  // npcId -> relationship data
    this.alliances = new Set()      // Set of allied NPC IDs
    this.enemies = new Set()        // Set of enemy NPC IDs
    this.initialized = false
  }

  /**
   * Initialize the tracker
   */
  initialize() {
    if (this.initialized) return

    this.loadState()

    this.initialized = true
    console.log('[RelationshipTracker] Initialized with', this.relationships.size, 'relationships')
  }

  /**
   * Get or create relationship with an NPC
   */
  getRelationship(npcId) {
    if (!this.relationships.has(npcId)) {
      this.createRelationship(npcId)
    }
    return this.relationships.get(npcId)
  }

  /**
   * Create a new relationship
   */
  createRelationship(npcId, archetype = 'fixer', displayName = null) {
    const archetypeData = NPC_ARCHETYPES[archetype] || NPC_ARCHETYPES.fixer

    const relationship = {
      npcId,
      displayName: displayName || npcId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      archetype,

      // Trust level (-100 to 100)
      trust: archetypeData.baseTrust,

      // Favor balance (positive = they owe you, negative = you owe them)
      favorBalance: 0,

      // Traits from archetype
      loyalty: archetypeData.loyalty,
      forgiveness: archetypeData.forgiveness,
      betrayalRisk: archetypeData.betrayalRisk,

      // Interaction history (last 50)
      interactions: [],

      // Timestamps
      firstMet: Date.now(),
      lastInteraction: Date.now(),

      // Special flags
      isAlly: false,
      isEnemy: false,
      hasBetrayed: false,
      wasBetrayed: false,
    }

    this.relationships.set(npcId, relationship)
    this.saveState()

    return relationship
  }

  /**
   * Record an interaction with an NPC
   */
  recordInteraction(npcId, interactionType, customImpact = null) {
    const relationship = this.getRelationship(npcId)

    // Calculate trust impact
    const baseImpact = customImpact !== null ? customImpact :
      (INTERACTION_IMPACTS[interactionType] || 0)

    // Apply forgiveness modifier for negative impacts
    let impact = baseImpact
    if (baseImpact < 0) {
      impact = baseImpact * (1 - relationship.forgiveness * 0.3)
    }

    // Apply loyalty modifier for positive impacts
    if (baseImpact > 0) {
      impact = baseImpact * (1 + relationship.loyalty * 0.2)
    }

    // Update trust
    relationship.trust = Math.max(-100, Math.min(100, relationship.trust + impact))

    // Update favor balance for certain interactions
    if (['paid_debt', 'shared_loot', 'gift'].includes(interactionType)) {
      relationship.favorBalance -= Math.abs(impact) // They owe you less
    }
    if (['borrowed', 'asked_favor'].includes(interactionType)) {
      relationship.favorBalance += Math.abs(impact) // You owe them more
    }

    // Record in history
    relationship.interactions.unshift({
      type: interactionType,
      impact: Math.round(impact),
      timestamp: Date.now(),
    })

    // Trim history
    if (relationship.interactions.length > 50) {
      relationship.interactions = relationship.interactions.slice(0, 50)
    }

    relationship.lastInteraction = Date.now()

    // Check for status changes
    this.checkStatusChange(relationship)

    this.saveState()

    return {
      newTrust: relationship.trust,
      impact: Math.round(impact),
      status: this.getStatus(npcId),
    }
  }

  /**
   * Get the current status of a relationship
   */
  getStatus(npcId) {
    const relationship = this.getRelationship(npcId)
    const trust = relationship.trust

    for (const [key, range] of Object.entries(RELATIONSHIP_STATUS)) {
      if (trust >= range.min && trust <= range.max) {
        return { key, label: range.label, trust }
      }
    }

    return { key: 'NEUTRAL', label: 'Neutral', trust }
  }

  /**
   * Check for status changes and update flags
   */
  checkStatusChange(relationship) {
    const status = this.getStatus(relationship.npcId)

    // Update enemy/ally status based on trust
    if (status.key === 'HOSTILE' && !relationship.isEnemy) {
      relationship.isEnemy = true
      relationship.isAlly = false
      this.enemies.add(relationship.npcId)
      this.alliances.delete(relationship.npcId)
    } else if (status.key === 'LOYAL' && !relationship.isAlly) {
      // Loyal doesn't auto-ally, but they're more likely to accept
    }

    // Remove from enemies if trust improves
    if (relationship.trust > -20 && relationship.isEnemy) {
      relationship.isEnemy = false
      this.enemies.delete(relationship.npcId)
    }
  }

  /**
   * Form an alliance with an NPC
   */
  formAlliance(npcId) {
    const relationship = this.getRelationship(npcId)

    if (relationship.trust < 20) {
      return {
        success: false,
        message: 'Trust too low to form alliance.',
      }
    }

    relationship.isAlly = true
    relationship.isEnemy = false
    this.alliances.add(npcId)
    this.enemies.delete(npcId)

    // Boost trust for alliance
    this.recordInteraction(npcId, 'alliance_formed')

    return {
      success: true,
      message: `Alliance formed with ${relationship.displayName}.`,
    }
  }

  /**
   * Break an alliance
   */
  breakAlliance(npcId) {
    const relationship = this.getRelationship(npcId)

    if (!relationship.isAlly) {
      return { success: false, message: 'No alliance exists.' }
    }

    relationship.isAlly = false
    this.alliances.delete(npcId)

    // Significant trust hit
    this.recordInteraction(npcId, 'alliance_broken')

    return {
      success: true,
      message: `Alliance with ${relationship.displayName} has ended.`,
    }
  }

  /**
   * Calculate betrayal risk for an NPC
   */
  calculateBetrayalRisk(npcId) {
    const relationship = this.getRelationship(npcId)

    // Base risk from archetype
    let risk = relationship.betrayalRisk

    // Trust reduces risk
    risk *= (1 - (relationship.trust + 100) / 400) // -100 trust = full risk, 100 trust = 50% risk

    // Favor balance affects risk
    if (relationship.favorBalance > 20) {
      // They owe you a lot = less likely to betray
      risk *= 0.7
    } else if (relationship.favorBalance < -20) {
      // You owe them = more likely to betray/force payment
      risk *= 1.3
    }

    // Past betrayals increase risk
    if (relationship.hasBetrayed) {
      risk *= 1.5
    }

    // Alliance reduces risk
    if (relationship.isAlly) {
      risk *= 0.5
    }

    return Math.min(1, Math.max(0, risk))
  }

  /**
   * Simulate a betrayal check
   */
  checkForBetrayal(npcId, situation = 'normal') {
    const risk = this.calculateBetrayalRisk(npcId)

    // Situation modifiers
    let modifier = 1.0
    if (situation === 'high_stakes') modifier = 1.5
    if (situation === 'desperate') modifier = 2.0
    if (situation === 'safe') modifier = 0.5

    const finalRisk = risk * modifier

    if (Math.random() < finalRisk) {
      const relationship = this.getRelationship(npcId)
      relationship.hasBetrayed = true
      this.recordInteraction(npcId, 'betrayed')

      return {
        betrayed: true,
        npcName: relationship.displayName,
        message: `${relationship.displayName} has betrayed you!`,
      }
    }

    return { betrayed: false }
  }

  /**
   * Get all relationships with their statuses
   */
  getAllRelationships() {
    const results = []

    for (const [npcId, relationship] of this.relationships) {
      results.push({
        npcId,
        displayName: relationship.displayName,
        trust: relationship.trust,
        status: this.getStatus(npcId),
        isAlly: relationship.isAlly,
        isEnemy: relationship.isEnemy,
        favorBalance: relationship.favorBalance,
        lastInteraction: relationship.lastInteraction,
      })
    }

    return results.sort((a, b) => b.trust - a.trust)
  }

  /**
   * Get allies
   */
  getAllies() {
    return Array.from(this.alliances).map(id => this.getRelationship(id))
  }

  /**
   * Get enemies
   */
  getEnemies() {
    return Array.from(this.enemies).map(id => this.getRelationship(id))
  }

  /**
   * Get NPCs at a specific status level
   */
  getNPCsByStatus(statusKey) {
    const range = RELATIONSHIP_STATUS[statusKey]
    if (!range) return []

    return this.getAllRelationships()
      .filter(r => r.trust >= range.min && r.trust <= range.max)
  }

  /**
   * Format relationships for terminal display
   */
  formatRelationshipsForTerminal() {
    const relationships = this.getAllRelationships()

    if (relationships.length === 0) {
      return ['No established relationships yet.', 'Complete jobs and interact with NPCs to build connections.']
    }

    const lines = [':: RELATIONSHIPS ::']

    // Group by status
    const allies = relationships.filter(r => r.isAlly)
    const friends = relationships.filter(r => r.trust >= 21 && r.trust <= 80 && !r.isAlly)
    const neutral = relationships.filter(r => r.trust >= -19 && r.trust <= 20)
    const hostile = relationships.filter(r => r.trust < -19)

    if (allies.length > 0) {
      lines.push('')
      lines.push('ALLIES:')
      allies.forEach(r => {
        lines.push(`  ${r.displayName} - Trust: ${r.trust} [${r.status.label}]`)
      })
    }

    if (friends.length > 0) {
      lines.push('')
      lines.push('TRUSTED:')
      friends.forEach(r => {
        lines.push(`  ${r.displayName} - Trust: ${r.trust} [${r.status.label}]`)
      })
    }

    if (neutral.length > 0) {
      lines.push('')
      lines.push('NEUTRAL:')
      neutral.forEach(r => {
        lines.push(`  ${r.displayName} - Trust: ${r.trust} [${r.status.label}]`)
      })
    }

    if (hostile.length > 0) {
      lines.push('')
      lines.push('HOSTILE:')
      hostile.forEach(r => {
        const warning = r.isEnemy ? ' [ENEMY]' : ''
        lines.push(`  ${r.displayName} - Trust: ${r.trust} [${r.status.label}]${warning}`)
      })
    }

    return lines
  }

  /**
   * Get relationship summary for S.A.R.A.H.
   */
  getRelationshipInsight(npcId) {
    const relationship = this.getRelationship(npcId)
    const status = this.getStatus(npcId)
    const risk = this.calculateBetrayalRisk(npcId)

    let insight = `${relationship.displayName} - ${status.label} (Trust: ${relationship.trust})`

    if (relationship.isAlly) {
      insight += '\nThey are your ally and can be trusted for most jobs.'
    } else if (relationship.isEnemy) {
      insight += '\nThey are hostile - be careful dealing with them.'
    }

    if (risk > 0.5) {
      insight += `\nWARNING: High betrayal risk (${Math.round(risk * 100)}%)`
    }

    if (relationship.favorBalance > 10) {
      insight += `\nThey owe you favors (balance: +${relationship.favorBalance})`
    } else if (relationship.favorBalance < -10) {
      insight += `\nYou owe them (balance: ${relationship.favorBalance})`
    }

    return insight
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {
        relationships: Array.from(this.relationships.entries()),
        alliances: Array.from(this.alliances),
        enemies: Array.from(this.enemies),
      }
      localStorage.setItem('street_legacy_relationships', JSON.stringify(state))
    } catch (e) {
      console.warn('[RelationshipTracker] Failed to save state:', e)
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem('street_legacy_relationships')
      if (saved) {
        const state = JSON.parse(saved)
        this.relationships = new Map(state.relationships || [])
        this.alliances = new Set(state.alliances || [])
        this.enemies = new Set(state.enemies || [])
      }
    } catch (e) {
      console.warn('[RelationshipTracker] Failed to load state:', e)
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalRelationships: this.relationships.size,
      allies: this.alliances.size,
      enemies: this.enemies.size,
    }
  }
}

// Singleton export
export const relationshipTracker = new RelationshipTrackerClass()
export default relationshipTracker
