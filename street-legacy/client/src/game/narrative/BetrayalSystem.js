/**
 * BetrayalSystem - Phase 14: NPC Betrayal Mechanics
 *
 * NPCs can betray the player based on trust levels and circumstances.
 *
 * Betrayal Types:
 * - SNITCH: NPC tips off cops, police arrive during job
 * - SETUP: The job is a trap, enemies waiting
 * - STEAL: NPC takes the loot and runs
 * - ABANDON: NPC disappears mid-heist, leaving player alone
 * - DOUBLE_CROSS: NPC was working for enemy all along
 *
 * Triggers:
 * - Low trust + high-value job
 * - NPC has betrayal history
 * - Player owes NPC
 * - External pressure on NPC
 */

import { narrativeState, TRAITS } from './NarrativeState'

// Betrayal types
export const BETRAYAL_TYPES = {
  SNITCH: 'snitch',
  SETUP: 'setup',
  STEAL: 'steal',
  ABANDON: 'abandon',
  DOUBLE_CROSS: 'double_cross',
}

// Betrayal severity and consequences
const BETRAYAL_CONFIG = {
  [BETRAYAL_TYPES.SNITCH]: {
    description: 'tips off the cops',
    severity: 'moderate',
    effects: [
      { type: 'heat', value: 40 },
      { type: 'event', event: 'police_arrival' },
    ],
  },
  [BETRAYAL_TYPES.SETUP]: {
    description: 'led you into a trap',
    severity: 'major',
    effects: [
      { type: 'event', event: 'ambush' },
      { type: 'health', value: -30 },
    ],
  },
  [BETRAYAL_TYPES.STEAL]: {
    description: 'took the loot and vanished',
    severity: 'major',
    effects: [
      { type: 'cash', value: 'job_value_negative' },
      { type: 'message', template: 'npc_escaped' },
    ],
  },
  [BETRAYAL_TYPES.ABANDON]: {
    description: 'abandoned you mid-job',
    severity: 'moderate',
    effects: [
      { type: 'job_difficulty', value: 1.5 },
      { type: 'message', template: 'left_alone' },
    ],
  },
  [BETRAYAL_TYPES.DOUBLE_CROSS]: {
    description: 'was working against you all along',
    severity: 'critical',
    effects: [
      { type: 'event', event: 'enemy_reveal' },
      { type: 'faction_reputation', faction: 'enemy', value: -30 },
      { type: 'trait', value: TRAITS.MARKED_FOR_DEATH },
    ],
  },
}

/**
 * BetrayalSystem class
 */
class BetrayalSystemClass {
  constructor() {
    this.betrayalHistory = []
    this.pendingBetrayals = []
  }

  /**
   * Calculate betrayal chance for an NPC in a given context
   *
   * @param {object} npc - NPC data
   * @param {object} context - Job/situation context
   * @returns {object} Betrayal assessment
   */
  assessBetrayalRisk(npc, context = {}) {
    const {
      trustLevel = 50,
      betrayalRisk = 0,
      loyaltyScore = 50,
      isOwedMoney = false,
      isOwedFavor = false,
      underExternalPressure = false,
    } = npc

    const {
      jobValue = 0,
      jobRisk = 'medium',
      isHeist = false,
      playerReputation = 0,
    } = context

    let betrayalChance = 0

    // Base chance from trust level (low trust = higher chance)
    betrayalChance += Math.max(0, (50 - trustLevel) / 100) * 0.3

    // NPC's natural betrayal risk
    betrayalChance += betrayalRisk / 100 * 0.2

    // Low loyalty increases chance
    betrayalChance += Math.max(0, (50 - loyaltyScore) / 100) * 0.15

    // Owing the NPC increases chance
    if (isOwedMoney) betrayalChance += 0.15
    if (isOwedFavor) betrayalChance += 0.1

    // External pressure
    if (underExternalPressure) betrayalChance += 0.2

    // High-value jobs are more tempting
    if (jobValue >= 10000) betrayalChance += 0.1
    if (jobValue >= 50000) betrayalChance += 0.15

    // Player's reputation can deter or encourage
    if (narrativeState.hasTrait(TRAITS.DANGEROUS)) {
      betrayalChance *= 0.7  // Less likely to betray dangerous player
    }
    if (narrativeState.hasTrait(TRAITS.EASY_MARK)) {
      betrayalChance *= 1.3  // More likely to betray easy mark
    }

    // Cap at reasonable levels
    betrayalChance = Math.min(0.7, Math.max(0, betrayalChance))

    // Determine most likely betrayal type
    const likelyType = this.determineBetrayalType(npc, context)

    return {
      chance: betrayalChance,
      percentage: Math.round(betrayalChance * 100),
      likelyType,
      riskLevel: betrayalChance > 0.4 ? 'high' : betrayalChance > 0.2 ? 'medium' : 'low',
      warnings: this.generateWarnings(npc, betrayalChance),
    }
  }

  /**
   * Determine most likely type of betrayal
   */
  determineBetrayalType(npc, context) {
    const { greed = 50, cowardice = 50, connections = [] } = npc
    const { jobValue = 0, isHeist = false } = context

    // High greed + valuable job = likely to STEAL
    if (greed > 70 && jobValue >= 5000) {
      return BETRAYAL_TYPES.STEAL
    }

    // Coward likely to ABANDON
    if (cowardice > 70) {
      return BETRAYAL_TYPES.ABANDON
    }

    // Connected to enemies = DOUBLE_CROSS
    if (connections.includes('enemy_faction')) {
      return BETRAYAL_TYPES.DOUBLE_CROSS
    }

    // Connection to cops = SNITCH
    if (connections.includes('police')) {
      return BETRAYAL_TYPES.SNITCH
    }

    // Default: SETUP
    return BETRAYAL_TYPES.SETUP
  }

  /**
   * Generate warning signs for S.A.R.A.H. to detect
   */
  generateWarnings(npc, betrayalChance) {
    const warnings = []

    if (betrayalChance > 0.5) {
      warnings.push('High risk - something feels off about this one')
    } else if (betrayalChance > 0.3) {
      warnings.push('Moderate risk - keep your guard up')
    }

    if (npc.betrayalHistory && npc.betrayalHistory.length > 0) {
      warnings.push('Has betrayed others before')
    }

    if (npc.trustLevel < 30) {
      warnings.push('Trust level is very low')
    }

    if (npc.underExternalPressure) {
      warnings.push("Seems nervous - might be under pressure")
    }

    return warnings
  }

  /**
   * Execute a betrayal
   */
  executeBetray(npc, type, context = {}) {
    const config = BETRAYAL_CONFIG[type]
    if (!config) return null

    // Record betrayal
    const betrayal = {
      npcId: npc.id,
      npcName: npc.name,
      type,
      description: config.description,
      severity: config.severity,
      occurredAt: Date.now(),
      context,
    }

    this.betrayalHistory.push(betrayal)

    // Apply effects
    for (const effect of config.effects) {
      this.applyBetrayalEffect(effect, context)
    }

    // Update narrative state
    narrativeState.incrementStat('npcsBetrayed', -1)  // Actually they betrayed us
    narrativeState.addPressure('enemies', 1)

    if (config.severity === 'critical') {
      narrativeState.recordMilestone('firstBetrayal')
    }

    console.log(`[BetrayalSystem] ${npc.name} ${config.description}!`)

    // Emit event
    const event = new CustomEvent('npc_betrayal', { detail: betrayal })
    window.dispatchEvent(event)

    return betrayal
  }

  /**
   * Apply a betrayal effect
   */
  applyBetrayalEffect(effect, context) {
    const event = new CustomEvent('narrative_effect', {
      detail: { effect, context, source: 'betrayal' },
    })
    window.dispatchEvent(event)
  }

  /**
   * Check if betrayal should trigger during a job
   *
   * @param {object} npc - NPC involved
   * @param {object} jobContext - Job details
   * @returns {object|null} Betrayal result if triggered
   */
  checkJobBetrayal(npc, jobContext) {
    const assessment = this.assessBetrayalRisk(npc, jobContext)

    // Roll for betrayal
    if (Math.random() < assessment.chance) {
      return this.executeBetray(npc, assessment.likelyType, jobContext)
    }

    return null
  }

  /**
   * Schedule a delayed betrayal (for setup/long cons)
   */
  scheduleBetray(npc, type, delay, context = {}) {
    const triggerAt = Date.now() + delay

    this.pendingBetrayals.push({
      npcId: npc.id,
      npc,
      type,
      context,
      triggerAt,
    })

    console.log(`[BetrayalSystem] Betrayal scheduled for ${new Date(triggerAt).toISOString()}`)
  }

  /**
   * Check and trigger any pending betrayals
   */
  checkPendingBetrayals() {
    const now = Date.now()
    const triggered = []

    for (let i = this.pendingBetrayals.length - 1; i >= 0; i--) {
      const pending = this.pendingBetrayals[i]
      if (pending.triggerAt <= now) {
        triggered.push(pending)
        this.pendingBetrayals.splice(i, 1)
      }
    }

    const results = []
    for (const pending of triggered) {
      const result = this.executeBetray(pending.npc, pending.type, pending.context)
      if (result) results.push(result)
    }

    return results
  }

  /**
   * Get betrayal history
   */
  getBetrayalHistory() {
    return [...this.betrayalHistory]
  }

  /**
   * Check if player has been betrayed by specific NPC
   */
  hasBeenBetrayedBy(npcId) {
    return this.betrayalHistory.some(b => b.npcId === npcId)
  }
}

// Export singleton
export const betrayalSystem = new BetrayalSystemClass()
export default betrayalSystem
