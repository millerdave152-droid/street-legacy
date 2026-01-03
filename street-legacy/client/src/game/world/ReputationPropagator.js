/**
 * ReputationPropagator - Phase 23: Reputation Ripple Effects
 *
 * Reputation spreads through the world creating cascading effects.
 *
 * Reputation Sources:
 * - Direct witness → Strong effect
 * - Heard from friend → Medium effect
 * - Rumor → Weak effect
 *
 * Reputation Aspects:
 * - Reliability: Do they deliver on promises?
 * - Danger: Are they someone to fear?
 * - Generosity: Do they share the wealth?
 * - Discretion: Can they keep secrets?
 */

const STORAGE_KEY = 'world_reputation'

// Reputation aspects
export const REPUTATION_ASPECTS = {
  RELIABILITY: 'reliability',
  DANGER: 'danger',
  GENEROSITY: 'generosity',
  DISCRETION: 'discretion',
  COMPETENCE: 'competence',
  LOYALTY: 'loyalty',
}

// How information spreads
export const SPREAD_TYPES = {
  DIRECT_WITNESS: 'direct_witness',   // Saw it happen
  HEARD_FROM_FRIEND: 'heard_friend',  // One degree removed
  RUMOR: 'rumor',                     // Multiple degrees
  NEWS: 'news',                       // Public knowledge
}

// Spread strength multipliers
const SPREAD_STRENGTH = {
  [SPREAD_TYPES.DIRECT_WITNESS]: 1.0,
  [SPREAD_TYPES.HEARD_FROM_FRIEND]: 0.6,
  [SPREAD_TYPES.RUMOR]: 0.3,
  [SPREAD_TYPES.NEWS]: 0.8,
}

// Decay rates (per hour of game time)
const DECAY_RATES = {
  positive: 0.02,   // Good rep fades slowly
  negative: 0.01,   // Bad rep sticks longer
  rumor: 0.05,      // Rumors fade faster
}

// NPC networks - who talks to whom
const NPC_NETWORKS = {
  street: ['marcus_chen', 'dex_johnson', 'nina_santos'],
  underworld: ['vince_romano', 'ghost', 'black_market_betty'],
  corporate: ['elena_voss', 'mr_smith', 'insider_info'],
  enforcement: ['detective_hayes', 'officer_chen', 'fed_agent'],
}

/**
 * ReputationPropagator class
 */
class ReputationPropagatorClass {
  constructor() {
    this.reputation = this.load()
    this.pendingSpread = []
    this.lastUpdate = Date.now()
    this.intervalId = null
  }

  /**
   * Initialize propagation system
   */
  initialize() {
    // Update reputation spread periodically
    this.intervalId = setInterval(() => {
      this.update()
    }, 30000)  // Every 30 seconds

    console.log('[ReputationPropagator] Initialized')
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Record a reputation event
   */
  recordEvent(config) {
    const {
      aspect,
      value,                    // Positive or negative
      witnesses = [],           // NPCs who directly saw
      context = {},             // Additional context
      isPublic = false,         // Was this public knowledge?
    } = config

    const event = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      aspect,
      value,
      witnesses,
      context,
      isPublic,
      timestamp: Date.now(),
    }

    // Immediate effect on witnesses
    for (const witnessId of witnesses) {
      this.applyReputationChange(witnessId, aspect, value, SPREAD_TYPES.DIRECT_WITNESS)
    }

    // If public, everyone knows
    if (isPublic) {
      this.broadcastPublicEvent(aspect, value)
    }

    // Queue for spreading
    this.pendingSpread.push(event)

    console.log(`[ReputationPropagator] Event recorded: ${aspect} ${value > 0 ? '+' : ''}${value}`)

    return event
  }

  /**
   * Apply reputation change to specific NPC
   */
  applyReputationChange(npcId, aspect, value, spreadType) {
    if (!this.reputation[npcId]) {
      this.reputation[npcId] = {
        aspects: {},
        lastInteraction: Date.now(),
        totalKnowledge: 0,
      }
    }

    const npc = this.reputation[npcId]
    if (!npc.aspects[aspect]) {
      npc.aspects[aspect] = {
        value: 0,
        certainty: 0,
        sources: [],
      }
    }

    const aspectData = npc.aspects[aspect]
    const strength = SPREAD_STRENGTH[spreadType] || 0.3
    const actualChange = value * strength

    // Apply change with diminishing returns
    const oldValue = aspectData.value
    aspectData.value = Math.max(-100, Math.min(100, aspectData.value + actualChange))

    // Update certainty (higher certainty from direct witness)
    aspectData.certainty = Math.min(1, aspectData.certainty + (strength * 0.2))

    // Track source
    aspectData.sources.push({
      type: spreadType,
      value: actualChange,
      timestamp: Date.now(),
    })

    // Keep only last 10 sources
    if (aspectData.sources.length > 10) {
      aspectData.sources = aspectData.sources.slice(-10)
    }

    npc.lastInteraction = Date.now()
    npc.totalKnowledge++

    this.save()

    // Emit event for UI
    const changeEvent = new CustomEvent('reputation_changed', {
      detail: {
        npcId,
        aspect,
        oldValue,
        newValue: aspectData.value,
        spreadType,
      },
    })
    window.dispatchEvent(changeEvent)
  }

  /**
   * Broadcast public event to all NPCs
   */
  broadcastPublicEvent(aspect, value) {
    const allNpcs = Object.values(NPC_NETWORKS).flat()
    const uniqueNpcs = [...new Set(allNpcs)]

    for (const npcId of uniqueNpcs) {
      this.applyReputationChange(npcId, aspect, value, SPREAD_TYPES.NEWS)
    }

    console.log(`[ReputationPropagator] Public broadcast: ${aspect} to ${uniqueNpcs.length} NPCs`)
  }

  /**
   * Process reputation spread
   */
  update() {
    const now = Date.now()

    // Spread pending events through networks
    this.processPendingSpread()

    // Apply decay
    this.applyDecay(now - this.lastUpdate)

    this.lastUpdate = now
    this.save()
  }

  /**
   * Spread reputation through NPC networks
   */
  processPendingSpread() {
    const toProcess = [...this.pendingSpread]
    this.pendingSpread = []

    for (const event of toProcess) {
      // Find network connections for witnesses
      for (const witnessId of event.witnesses) {
        const network = this.findNpcNetwork(witnessId)
        if (network) {
          // Spread to network members
          for (const networkMember of NPC_NETWORKS[network]) {
            if (networkMember !== witnessId) {
              // Chance to spread based on time
              if (Math.random() < 0.5) {
                this.applyReputationChange(
                  networkMember,
                  event.aspect,
                  event.value,
                  SPREAD_TYPES.HEARD_FROM_FRIEND
                )
              }
            }
          }
        }
      }

      // Small chance of becoming a rumor to other networks
      if (Math.abs(event.value) > 15 && Math.random() < 0.2) {
        this.spreadAsRumor(event)
      }
    }
  }

  /**
   * Find which network an NPC belongs to
   */
  findNpcNetwork(npcId) {
    for (const [network, members] of Object.entries(NPC_NETWORKS)) {
      if (members.includes(npcId)) {
        return network
      }
    }
    return null
  }

  /**
   * Spread an event as a rumor to other networks
   */
  spreadAsRumor(event) {
    const originNetwork = event.witnesses.length > 0
      ? this.findNpcNetwork(event.witnesses[0])
      : null

    for (const [network, members] of Object.entries(NPC_NETWORKS)) {
      if (network === originNetwork) continue

      // Pick random member of other networks
      const randomMember = members[Math.floor(Math.random() * members.length)]
      this.applyReputationChange(
        randomMember,
        event.aspect,
        event.value,
        SPREAD_TYPES.RUMOR
      )
    }
  }

  /**
   * Apply natural decay to reputation
   */
  applyDecay(elapsedMs) {
    const hours = elapsedMs / 3600000

    for (const npcId of Object.keys(this.reputation)) {
      const npc = this.reputation[npcId]

      for (const aspect of Object.keys(npc.aspects)) {
        const aspectData = npc.aspects[aspect]
        const isPositive = aspectData.value > 0
        const decayRate = isPositive ? DECAY_RATES.positive : DECAY_RATES.negative

        // Decay toward 0
        const decay = aspectData.value * decayRate * hours
        aspectData.value -= decay

        // Decay certainty faster
        aspectData.certainty = Math.max(0, aspectData.certainty - (0.05 * hours))
      }
    }
  }

  /**
   * Get player's reputation with specific NPC
   */
  getReputation(npcId) {
    const npc = this.reputation[npcId]
    if (!npc) {
      return {
        known: false,
        aspects: {},
        overall: 0,
      }
    }

    // Calculate overall reputation
    let total = 0
    let count = 0
    for (const aspect of Object.values(npc.aspects)) {
      total += aspect.value
      count++
    }

    return {
      known: true,
      aspects: { ...npc.aspects },
      overall: count > 0 ? total / count : 0,
      totalKnowledge: npc.totalKnowledge,
      lastInteraction: npc.lastInteraction,
    }
  }

  /**
   * Get reputation aspect with specific NPC
   */
  getAspect(npcId, aspect) {
    const rep = this.getReputation(npcId)
    if (!rep.known || !rep.aspects[aspect]) {
      return { value: 0, certainty: 0, known: false }
    }
    return { ...rep.aspects[aspect], known: true }
  }

  /**
   * Get overall reputation across all NPCs
   */
  getOverallReputation() {
    const aspects = {}
    let npcCount = 0

    for (const aspect of Object.values(REPUTATION_ASPECTS)) {
      aspects[aspect] = { total: 0, count: 0 }
    }

    for (const npc of Object.values(this.reputation)) {
      npcCount++
      for (const [aspect, data] of Object.entries(npc.aspects)) {
        if (aspects[aspect]) {
          aspects[aspect].total += data.value
          aspects[aspect].count++
        }
      }
    }

    const result = {}
    for (const [aspect, data] of Object.entries(aspects)) {
      result[aspect] = data.count > 0 ? data.total / data.count : 0
    }

    return {
      aspects: result,
      knownBy: npcCount,
      overall: Object.values(result).reduce((a, b) => a + b, 0) / Object.keys(result).length,
    }
  }

  /**
   * Check if reputation affects NPC behavior
   */
  getReputationEffects(npcId) {
    const rep = this.getReputation(npcId)
    const effects = {
      priceModifier: 1.0,
      trustLevel: 'neutral',
      willBetray: false,
      willHelp: false,
      specialAccess: false,
    }

    if (!rep.known) return effects

    // Reliability affects prices and trust
    const reliability = rep.aspects[REPUTATION_ASPECTS.RELIABILITY]?.value || 0
    if (reliability > 30) {
      effects.priceModifier = 0.9  // Better deals
      effects.trustLevel = 'trusted'
    } else if (reliability < -30) {
      effects.priceModifier = 1.2  // Worse deals
      effects.trustLevel = 'distrusted'
    }

    // Danger affects whether they'll cross you
    const danger = rep.aspects[REPUTATION_ASPECTS.DANGER]?.value || 0
    if (danger > 40) {
      effects.willBetray = false  // Too scared
      effects.trustLevel = 'feared'
    } else if (danger < -20 && reliability < 0) {
      effects.willBetray = true  // Easy target
    }

    // Generosity affects whether they'll help
    const generosity = rep.aspects[REPUTATION_ASPECTS.GENEROSITY]?.value || 0
    if (generosity > 30) {
      effects.willHelp = true
    }

    // Discretion affects special access
    const discretion = rep.aspects[REPUTATION_ASPECTS.DISCRETION]?.value || 0
    if (discretion > 50) {
      effects.specialAccess = true  // Trusted with secrets
    }

    return effects
  }

  /**
   * Get reputation summary
   */
  getSummary() {
    const overall = this.getOverallReputation()
    return {
      ...overall,
      pendingSpread: this.pendingSpread.length,
      reputation: Object.entries(this.reputation).map(([npcId, data]) => ({
        npcId,
        overall: Object.values(data.aspects).reduce((a, b) => a + b.value, 0) /
                 Object.keys(data.aspects).length || 0,
        knowledge: data.totalKnowledge,
      })),
    }
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        reputation: this.reputation,
        pendingSpread: this.pendingSpread,
        lastUpdate: this.lastUpdate,
      }))
    } catch (e) {
      console.warn('[ReputationPropagator] Failed to save:', e)
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.pendingSpread = data.pendingSpread || []
        this.lastUpdate = data.lastUpdate || Date.now()
        return data.reputation || {}
      }
    } catch (e) {
      console.warn('[ReputationPropagator] Failed to load:', e)
    }
    return {}
  }

  /**
   * Reset reputation
   */
  reset() {
    this.reputation = {}
    this.pendingSpread = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const reputationPropagator = new ReputationPropagatorClass()
export default reputationPropagator
