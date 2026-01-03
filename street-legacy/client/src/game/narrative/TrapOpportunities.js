/**
 * TrapOpportunities - Phase 15: Trap Opportunity System
 *
 * Some opportunities are not what they seem.
 *
 * Trap Types:
 * - SCAM: Lose money/resources
 * - SETUP: Police ambush
 * - DEBT_TRAP: Creates unwanted obligation
 * - INFILTRATION: Work for enemy unknowingly
 * - ADDICTION_HOOK: Leads to dependency mechanic
 *
 * Detection:
 * - S.A.R.A.H. can warn if trust level is high enough
 * - Subtle grammar/behavior cues in NPC messages
 * - Pattern recognition from past traps
 */

import { narrativeState, TRAITS } from './NarrativeState'
import { consequenceChain } from './ConsequenceChain'

// Trap types
export const TRAP_TYPES = {
  SCAM: 'scam',
  SETUP: 'setup',
  DEBT_TRAP: 'debt_trap',
  INFILTRATION: 'infiltration',
  ADDICTION_HOOK: 'addiction_hook',
  BLACKMAIL_SETUP: 'blackmail_setup',
}

// Trap configurations
const TRAP_CONFIGS = {
  [TRAP_TYPES.SCAM]: {
    name: 'Scam',
    description: 'This deal was designed to take your money',
    consequences: [
      { type: 'cash', value: 'negative_payout' },
      { type: 'trait', value: TRAITS.EASY_MARK, duration: 600000 },
    ],
    warningSignsStrength: 0.6,
  },

  [TRAP_TYPES.SETUP]: {
    name: 'Police Setup',
    description: 'This was a sting operation',
    consequences: [
      { type: 'event', event: 'police_ambush' },
      { type: 'heat', value: 50 },
      { type: 'arrest_chance', value: 0.7 },
    ],
    warningSignsStrength: 0.7,
  },

  [TRAP_TYPES.DEBT_TRAP]: {
    name: 'Debt Trap',
    description: 'The job was designed to put you in their debt',
    consequences: [
      { type: 'obligation', obligationType: 'monetary', value: 5000 },
      { type: 'chain', chainId: 'debt_chain' },
    ],
    warningSignsStrength: 0.4,
  },

  [TRAP_TYPES.INFILTRATION]: {
    name: 'Infiltration',
    description: 'You were unknowingly working for the enemy',
    consequences: [
      { type: 'faction_reputation', faction: 'ally', value: -30 },
      { type: 'message', template: 'infiltration_reveal' },
    ],
    warningSignsStrength: 0.3,
  },

  [TRAP_TYPES.ADDICTION_HOOK]: {
    name: 'Addiction Hook',
    description: 'The "sample" creates dependency',
    consequences: [
      { type: 'status', status: 'dependency', severity: 'mild' },
      { type: 'chain', chainId: 'addiction_chain' },
    ],
    warningSignsStrength: 0.5,
  },

  [TRAP_TYPES.BLACKMAIL_SETUP]: {
    name: 'Blackmail Setup',
    description: 'They have compromising evidence on you now',
    consequences: [
      { type: 'vulnerability', vulnerability: 'blackmail_material' },
      { type: 'chain', chainId: 'blackmail_chain' },
    ],
    warningSignsStrength: 0.5,
  },
}

// Warning signs in NPC messages that hint at traps
const WARNING_SIGNS = {
  urgency: [
    'right now',
    'immediately',
    'no time to explain',
    'quick decision',
    'one time offer',
    "won't last",
  ],
  tooGood: [
    'easy money',
    'no risk',
    'guaranteed',
    'foolproof',
    'can\'t lose',
    'simple job',
  ],
  vague: [
    'don\'t worry about',
    'you\'ll see',
    'trust me',
    'details later',
    'just show up',
  ],
  pressure: [
    'only you can',
    'no one else',
    'special for you',
    'proving yourself',
    'test of loyalty',
  ],
}

/**
 * TrapOpportunities class
 */
class TrapOpportunitiesClass {
  constructor() {
    this.trapHistory = []
    this.detectedTraps = []
  }

  /**
   * Generate a trap opportunity
   *
   * @param {string} trapType - Type of trap
   * @param {object} disguise - How the trap appears
   * @returns {object} Trap opportunity
   */
  generateTrap(trapType, disguise = {}) {
    const config = TRAP_CONFIGS[trapType]
    if (!config) return null

    const {
      npcId = 'unknown_npc',
      npcName = 'A contact',
      offerText = 'I have a job for you.',
      apparentValue = 1000,
      apparentType = 'job',
    } = disguise

    // Add warning signs to the message (subtle)
    const messageWithSigns = this.addWarningSignsToMessage(offerText, trapType)

    return {
      id: `trap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isTrap: true,
      trapType,
      trapConfig: config,

      // What it appears to be
      apparent: {
        type: apparentType,
        value: apparentValue,
        description: offerText,
      },

      // NPC details
      npcId,
      npcName,

      // The message with subtle warning signs
      message: messageWithSigns,

      // Detection difficulty (lower = easier to detect)
      detectionDifficulty: 1 - config.warningSignsStrength,

      createdAt: Date.now(),
    }
  }

  /**
   * Add warning signs to a message (subtle tells)
   */
  addWarningSignsToMessage(message, trapType) {
    // Pick a random warning sign category
    const categories = Object.keys(WARNING_SIGNS)
    const category = categories[Math.floor(Math.random() * categories.length)]
    const signs = WARNING_SIGNS[category]
    const sign = signs[Math.floor(Math.random() * signs.length)]

    // Insert the warning sign naturally
    const insertions = [
      `${message} ${sign}.`,
      `${sign}. ${message}`,
      message.replace('.', `, ${sign}.`),
    ]

    return insertions[Math.floor(Math.random() * insertions.length)]
  }

  /**
   * Attempt to detect if an opportunity is a trap
   * Called by S.A.R.A.H. when analyzing offers
   *
   * @param {object} opportunity - The opportunity to analyze
   * @param {number} trustLevel - Player's trust level with S.A.R.A.H.
   * @returns {object} Detection result
   */
  analyzeForTrap(opportunity, trustLevel = 50) {
    if (!opportunity.isTrap) {
      return {
        detected: false,
        isTrap: false,
        confidence: 'high',
        warnings: [],
      }
    }

    const config = opportunity.trapConfig
    const detectionChance = config.warningSignsStrength * (trustLevel / 100)

    // Higher S.A.R.A.H. trust = better detection
    const detected = Math.random() < detectionChance

    // Scan message for warning signs
    const warnings = this.scanForWarningSigns(opportunity.message)

    if (detected) {
      this.detectedTraps.push({
        opportunityId: opportunity.id,
        trapType: opportunity.trapType,
        detectedAt: Date.now(),
      })
    }

    return {
      detected,
      isTrap: true,
      trapType: detected ? opportunity.trapType : null,
      confidence: detectionChance > 0.6 ? 'high' : detectionChance > 0.3 ? 'medium' : 'low',
      warnings: detected ? warnings : warnings.slice(0, 1), // Partial warnings if not fully detected
      sarahWarning: detected ? this.generateSarahWarning(opportunity.trapType) : null,
    }
  }

  /**
   * Scan a message for warning signs
   */
  scanForWarningSigns(message) {
    const foundWarnings = []
    const lowerMessage = message.toLowerCase()

    for (const [category, signs] of Object.entries(WARNING_SIGNS)) {
      for (const sign of signs) {
        if (lowerMessage.includes(sign.toLowerCase())) {
          foundWarnings.push({
            category,
            sign,
            warning: this.getCategoryWarning(category),
          })
        }
      }
    }

    return foundWarnings
  }

  /**
   * Get warning message for a category
   */
  getCategoryWarning(category) {
    const warnings = {
      urgency: "They're pushing for a quick decision",
      tooGood: "This sounds too good to be true",
      vague: "They're being evasive about details",
      pressure: "They're using pressure tactics",
    }
    return warnings[category] || "Something feels off"
  }

  /**
   * Generate S.A.R.A.H.'s warning about a detected trap
   */
  generateSarahWarning(trapType) {
    const warnings = {
      [TRAP_TYPES.SCAM]: "This smells like a scam. The numbers don't add up.",
      [TRAP_TYPES.SETUP]: "My sensors are picking up unusual activity. Could be a setup.",
      [TRAP_TYPES.DEBT_TRAP]: "Careful - this looks designed to put you in someone's debt.",
      [TRAP_TYPES.INFILTRATION]: "Something's off about this contact. I can't verify their allegiances.",
      [TRAP_TYPES.ADDICTION_HOOK]: "Free samples? Classic hook. This could create dependency.",
      [TRAP_TYPES.BLACKMAIL_SETUP]: "This situation could compromise you. Be very careful.",
    }
    return warnings[trapType] || "My analysis suggests this opportunity has hidden risks."
  }

  /**
   * Spring a trap (player accepted the trap opportunity)
   */
  springTrap(opportunity) {
    if (!opportunity.isTrap) return null

    const config = opportunity.trapConfig

    // Record trap
    const trapEvent = {
      opportunityId: opportunity.id,
      trapType: opportunity.trapType,
      sprungAt: Date.now(),
      npcId: opportunity.npcId,
      npcName: opportunity.npcName,
    }

    this.trapHistory.push(trapEvent)

    // Apply consequences
    for (const consequence of config.consequences) {
      this.applyTrapConsequence(consequence, opportunity)
    }

    // Update narrative state
    if (narrativeState.hasTrait(TRAITS.EASY_MARK)) {
      // Already marked - consequences are worse
      narrativeState.addPressure('threats', 1)
    }

    console.log(`[TrapOpportunities] Trap sprung: ${config.name}`)

    // Emit event
    const event = new CustomEvent('trap_sprung', { detail: trapEvent })
    window.dispatchEvent(event)

    return {
      trapType: opportunity.trapType,
      name: config.name,
      description: config.description,
      consequences: config.consequences,
    }
  }

  /**
   * Apply a trap consequence
   */
  applyTrapConsequence(consequence, opportunity) {
    // Handle chain consequences specially
    if (consequence.type === 'chain') {
      consequenceChain.startChain(consequence.chainId, {
        triggeredBy: 'trap',
        trapType: opportunity.trapType,
        npcId: opportunity.npcId,
      })
      return
    }

    // Emit for other systems
    const event = new CustomEvent('narrative_effect', {
      detail: {
        effect: consequence,
        context: {
          source: 'trap',
          trapType: opportunity.trapType,
          npcId: opportunity.npcId,
        },
      },
    })
    window.dispatchEvent(event)
  }

  /**
   * Get trap statistics
   */
  getTrapStats() {
    return {
      totalFallen: this.trapHistory.length,
      totalDetected: this.detectedTraps.length,
      byType: this.trapHistory.reduce((acc, t) => {
        acc[t.trapType] = (acc[t.trapType] || 0) + 1
        return acc
      }, {}),
    }
  }

  /**
   * Check if player has fallen for a specific trap type before
   */
  hasFallenFor(trapType) {
    return this.trapHistory.some(t => t.trapType === trapType)
  }
}

// Export singleton
export const trapOpportunities = new TrapOpportunitiesClass()
export default trapOpportunities
