/**
 * RedemptionArcs - Phase 17: Redemption and Escape Arcs
 *
 * Provides paths out of dark situations (trapped, enslaved, blackmailed).
 *
 * Escape Opportunities:
 * - Risky heist to clear debts
 * - Information trade for blackmail
 * - Alliance with enemy's enemy
 * - Underground disappearance (reset with penalties)
 *
 * Triggered when player is in "trapped" state
 */

import { narrativeState, STORY_ARCS, TRAITS } from './NarrativeState'
import { obligationTracker } from './ObligationTracker'

// Redemption path types
export const REDEMPTION_PATHS = {
  BIG_SCORE: 'big_score',           // High-risk heist to clear everything
  INFORMATION_TRADE: 'info_trade',  // Trade secrets for freedom
  ALLIANCE: 'alliance',             // Join a powerful faction
  DISAPPEAR: 'disappear',           // Fake death, new identity
  BETRAYAL_REVENGE: 'betrayal',     // Turn tables on oppressor
  LEGAL_ESCAPE: 'legal',            // Find legal loophole
}

// Redemption opportunity templates
const REDEMPTION_TEMPLATES = {
  [REDEMPTION_PATHS.BIG_SCORE]: {
    name: 'The Big Score',
    description: 'One massive heist could clear all your debts',
    requirements: {
      minLevel: 15,
      needsCrew: true,
      crewSize: 3,
    },
    risk: 'extreme',
    successChance: 0.4,
    onSuccess: [
      { type: 'clear_debts', percentage: 100 },
      { type: 'cash', value: 50000 },
      { type: 'arc_transition', to: STORY_ARCS.RISING },
      { type: 'remove_trait', trait: TRAITS.DEBT_RIDDEN },
    ],
    onFailure: [
      { type: 'arrest', severity: 'major' },
      { type: 'debts_increase', percentage: 50 },
      { type: 'trait', value: TRAITS.MARKED_FOR_DEATH },
    ],
  },

  [REDEMPTION_PATHS.INFORMATION_TRADE]: {
    name: 'The Information Game',
    description: 'Trade valuable intel for your freedom',
    requirements: {
      hasIntel: true,
      intelValue: 'high',
    },
    risk: 'high',
    successChance: 0.6,
    onSuccess: [
      { type: 'clear_blackmail' },
      { type: 'obligation_forgiven', percentage: 50 },
      { type: 'arc_transition', to: STORY_ARCS.REDEMPTION },
    ],
    onFailure: [
      { type: 'trait', value: TRAITS.SNITCH },
      { type: 'faction_reputation', faction: 'underground', value: -40 },
      { type: 'enemy_made', count: 2 },
    ],
  },

  [REDEMPTION_PATHS.ALLIANCE]: {
    name: "The Enemy's Enemy",
    description: 'Join a powerful faction that can protect you',
    requirements: {
      hasPotentialAllies: true,
      minReputation: 20,
    },
    risk: 'moderate',
    successChance: 0.7,
    onSuccess: [
      { type: 'protection', duration: 'indefinite' },
      { type: 'arc_transition', to: STORY_ARCS.REDEMPTION },
      { type: 'new_obligations', severity: 'moderate' },
    ],
    onFailure: [
      { type: 'faction_reputation', faction: 'potential_ally', value: -30 },
      { type: 'trait', value: TRAITS.DISLOYAL },
    ],
  },

  [REDEMPTION_PATHS.DISAPPEAR]: {
    name: 'The Disappearing Act',
    description: 'Fake your death, start fresh with a new identity',
    requirements: {
      minCash: 10000,
    },
    risk: 'moderate',
    successChance: 0.8,
    onSuccess: [
      { type: 'reset_identity' },
      { type: 'clear_all_obligations' },
      { type: 'clear_all_enemies' },
      { type: 'stat_penalty', stats: ['level', 'reputation'], percentage: 50 },
      { type: 'arc_transition', to: STORY_ARCS.SURVIVOR },
    ],
    onFailure: [
      { type: 'cash', value: -10000 },
      { type: 'message', template: 'disappear_failed' },
    ],
  },

  [REDEMPTION_PATHS.BETRAYAL_REVENGE]: {
    name: 'Turning the Tables',
    description: 'Gather evidence and take down your oppressor',
    requirements: {
      hasOppressor: true,
      evidenceGathered: true,
    },
    risk: 'high',
    successChance: 0.5,
    onSuccess: [
      { type: 'eliminate_enemy', target: 'oppressor' },
      { type: 'clear_obligations', fromCreditor: 'oppressor' },
      { type: 'reputation', value: 20 },
      { type: 'trait', value: TRAITS.DANGEROUS },
      { type: 'arc_transition', to: STORY_ARCS.RISING },
    ],
    onFailure: [
      { type: 'oppressor_retaliation' },
      { type: 'health', value: -50 },
      { type: 'obligations_double' },
    ],
  },
}

/**
 * RedemptionArcs class
 */
class RedemptionArcsClass {
  constructor() {
    this.activeOpportunities = []
    this.completedArcs = []
  }

  /**
   * Check if player qualifies for any redemption paths
   */
  checkEligibility() {
    const eligible = []

    // Must be in dark state
    if (!narrativeState.isInDarkState() && !narrativeState.hasFlag('debt_enslaved')) {
      return eligible
    }

    for (const [pathId, template] of Object.entries(REDEMPTION_TEMPLATES)) {
      if (this.meetsRequirements(template.requirements)) {
        eligible.push({
          pathId,
          ...template,
          eligibilityScore: this.calculateEligibilityScore(pathId, template),
        })
      }
    }

    // Sort by eligibility score
    return eligible.sort((a, b) => b.eligibilityScore - a.eligibilityScore)
  }

  /**
   * Check if player meets requirements for a path
   */
  meetsRequirements(requirements) {
    // This would integrate with actual game systems
    // For now, simplified checks
    for (const [req, value] of Object.entries(requirements)) {
      switch (req) {
        case 'minLevel':
          // Would check actual player level
          break
        case 'minCash':
          // Would check actual cash
          break
        case 'needsCrew':
          // Would check crew availability
          break
        // Add more requirement checks as needed
      }
    }
    return true  // Simplified - always eligible for demo
  }

  /**
   * Calculate how suitable a path is for the player
   */
  calculateEligibilityScore(pathId, template) {
    let score = template.successChance * 100

    // Adjust based on player state
    if (template.risk === 'extreme') score -= 20
    if (template.risk === 'high') score -= 10
    if (template.risk === 'low') score += 10

    // Bonus for matching player's style
    if (pathId === REDEMPTION_PATHS.ALLIANCE && narrativeState.hasTrait(TRAITS.CONNECTED)) {
      score += 15
    }
    if (pathId === REDEMPTION_PATHS.BETRAYAL_REVENGE && narrativeState.hasTrait(TRAITS.DANGEROUS)) {
      score += 15
    }

    return score
  }

  /**
   * Generate a redemption opportunity
   */
  generateOpportunity(pathId = null) {
    const eligible = this.checkEligibility()

    if (eligible.length === 0) {
      return null
    }

    // Use specified path or pick best eligible one
    const path = pathId
      ? eligible.find(e => e.pathId === pathId)
      : eligible[0]

    if (!path) return null

    const opportunity = {
      id: `redemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...path,
      generatedAt: Date.now(),
      expiresAt: Date.now() + 600000,  // 10 minutes to decide
      status: 'available',
    }

    this.activeOpportunities.push(opportunity)

    console.log(`[RedemptionArcs] Opportunity generated: ${path.name}`)

    // Emit event
    const event = new CustomEvent('redemption_opportunity', { detail: opportunity })
    window.dispatchEvent(event)

    return opportunity
  }

  /**
   * Accept a redemption opportunity
   */
  acceptOpportunity(opportunityId) {
    const opportunity = this.activeOpportunities.find(o => o.id === opportunityId)
    if (!opportunity || opportunity.status !== 'available') {
      return { success: false, error: 'Opportunity not available' }
    }

    // Check if expired
    if (Date.now() > opportunity.expiresAt) {
      opportunity.status = 'expired'
      return { success: false, error: 'Opportunity expired' }
    }

    opportunity.status = 'accepted'
    opportunity.acceptedAt = Date.now()

    console.log(`[RedemptionArcs] Opportunity accepted: ${opportunity.name}`)

    return { success: true, opportunity }
  }

  /**
   * Execute a redemption path (after any required steps)
   */
  executeRedemption(opportunityId) {
    const opportunity = this.activeOpportunities.find(o => o.id === opportunityId)
    if (!opportunity || opportunity.status !== 'accepted') {
      return { success: false, error: 'Opportunity not accepted' }
    }

    // Roll for success
    const roll = Math.random()
    const succeeded = roll < opportunity.successChance

    if (succeeded) {
      this.applyOutcome(opportunity.onSuccess, opportunity)
      opportunity.status = 'succeeded'

      console.log(`[RedemptionArcs] REDEMPTION SUCCEEDED: ${opportunity.name}`)
    } else {
      this.applyOutcome(opportunity.onFailure, opportunity)
      opportunity.status = 'failed'

      console.log(`[RedemptionArcs] REDEMPTION FAILED: ${opportunity.name}`)
    }

    opportunity.completedAt = Date.now()
    this.completedArcs.push({
      opportunityId: opportunity.id,
      pathId: opportunity.pathId,
      name: opportunity.name,
      succeeded,
      completedAt: opportunity.completedAt,
    })

    // Emit event
    const event = new CustomEvent('redemption_complete', {
      detail: { opportunity, succeeded },
    })
    window.dispatchEvent(event)

    return { success: true, succeeded, opportunity }
  }

  /**
   * Apply outcome effects
   */
  applyOutcome(effects, opportunity) {
    for (const effect of effects) {
      this.applyEffect(effect, opportunity)
    }
  }

  /**
   * Apply a single effect
   */
  applyEffect(effect, context) {
    console.log(`[RedemptionArcs] Applying effect:`, effect)

    switch (effect.type) {
      case 'clear_debts':
        // Clear percentage of debts
        break

      case 'arc_transition':
        narrativeState.transitionArc(effect.to)
        break

      case 'remove_trait':
        narrativeState.removeTrait(effect.trait)
        break

      case 'trait':
        narrativeState.addTrait(effect.value)
        break

      case 'clear_all_obligations':
        // Would clear all obligations
        break

      case 'reset_identity':
        // Would trigger identity reset
        narrativeState.reset()
        break

      default:
        // Emit for other systems to handle
        const event = new CustomEvent('narrative_effect', {
          detail: { effect, context },
        })
        window.dispatchEvent(event)
    }
  }

  /**
   * Get active opportunities
   */
  getActiveOpportunities() {
    // Filter out expired
    const now = Date.now()
    return this.activeOpportunities.filter(o =>
      o.status === 'available' && o.expiresAt > now
    )
  }

  /**
   * Get redemption history
   */
  getHistory() {
    return [...this.completedArcs]
  }
}

// Export singleton
export const redemptionArcs = new RedemptionArcsClass()
export default redemptionArcs
