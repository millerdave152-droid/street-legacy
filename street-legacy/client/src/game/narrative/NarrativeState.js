/**
 * NarrativeState - Tracks overall narrative state and player's story arc
 *
 * Monitors:
 * - Player's moral standing
 * - Active story threads
 * - Faction relationships
 * - Accumulated karma/consequences
 * - Unlock conditions for story beats
 */

const STORAGE_KEY = 'narrative_state'

// Narrative arcs the player can be on
export const STORY_ARCS = {
  RISING: 'rising',         // Building power and reputation
  FALLING: 'falling',       // Things going wrong, consequences mounting
  TRAPPED: 'trapped',       // Deep in debt/obligation, limited options
  REDEMPTION: 'redemption', // Trying to get out of bad situation
  KINGPIN: 'kingpin',       // At the top, maintaining power
  SURVIVOR: 'survivor',     // Just trying to stay alive
}

// Moral alignment spectrum
export const MORAL_SPECTRUM = {
  RUTHLESS: 'ruthless',     // -100 to -50
  COLD: 'cold',             // -50 to -20
  NEUTRAL: 'neutral',       // -20 to 20
  FAIR: 'fair',             // 20 to 50
  HONORABLE: 'honorable',   // 50 to 100
}

// Player traits (accumulated through actions)
export const TRAITS = {
  // Negative
  UNTRUSTWORTHY: 'untrustworthy',
  EASY_MARK: 'easy_mark',
  SNITCH: 'snitch',
  DEBT_RIDDEN: 'debt_ridden',
  MARKED_FOR_DEATH: 'marked_for_death',
  DISLOYAL: 'disloyal',

  // Positive
  RELIABLE: 'reliable',
  DANGEROUS: 'dangerous',
  CONNECTED: 'connected',
  GENEROUS: 'generous',
  RUTHLESS_REP: 'ruthless_rep',
  SURVIVOR_REP: 'survivor_rep',
}

/**
 * NarrativeState class
 */
class NarrativeStateClass {
  constructor() {
    this.state = this.load()
  }

  /**
   * Get default state
   */
  getDefaultState() {
    return {
      // Moral tracking
      karma: 0,  // -100 to 100
      moralAlignment: MORAL_SPECTRUM.NEUTRAL,

      // Current story arc
      currentArc: STORY_ARCS.RISING,
      arcStartedAt: Date.now(),

      // Accumulated traits
      traits: [],
      traitHistory: [],

      // Story flags (unlocked story beats)
      flags: {},

      // Key choices made
      majorChoices: [],

      // Faction standings
      factions: {},

      // Narrative pressure points
      pressurePoints: {
        debt: 0,
        enemies: 0,
        obligations: 0,
        threats: 0,
      },

      // Milestone tracking
      milestones: {
        firstBetrayal: false,
        firstDebt: false,
        firstEnemy: false,
        firstAlliance: false,
        firstKill: false,
        firstHeist: false,
        caughtOnce: false,
        escapedDeath: false,
      },

      // Narrative stats
      stats: {
        npcsBetrayed: 0,
        npcsHelped: 0,
        debtsIncurred: 0,
        debtsPaid: 0,
        promisesBroken: 0,
        promisesKept: 0,
        innocentsHarmed: 0,
        enemiesMade: 0,
        alliesLost: 0,
      },
    }
  }

  /**
   * Modify karma and recalculate alignment
   */
  modifyKarma(amount, reason = '') {
    this.state.karma = Math.max(-100, Math.min(100, this.state.karma + amount))

    // Recalculate moral alignment
    const karma = this.state.karma
    if (karma <= -50) {
      this.state.moralAlignment = MORAL_SPECTRUM.RUTHLESS
    } else if (karma <= -20) {
      this.state.moralAlignment = MORAL_SPECTRUM.COLD
    } else if (karma <= 20) {
      this.state.moralAlignment = MORAL_SPECTRUM.NEUTRAL
    } else if (karma <= 50) {
      this.state.moralAlignment = MORAL_SPECTRUM.FAIR
    } else {
      this.state.moralAlignment = MORAL_SPECTRUM.HONORABLE
    }

    // Log significant karma changes
    if (Math.abs(amount) >= 10) {
      console.log(`[NarrativeState] Karma ${amount > 0 ? '+' : ''}${amount}: ${reason}`)
    }

    this.save()
  }

  /**
   * Add a trait
   */
  addTrait(trait) {
    if (!this.state.traits.includes(trait)) {
      this.state.traits.push(trait)
      this.state.traitHistory.push({
        trait,
        addedAt: Date.now(),
      })

      console.log(`[NarrativeState] Trait added: ${trait}`)
      this.save()
    }
  }

  /**
   * Remove a trait
   */
  removeTrait(trait) {
    const index = this.state.traits.indexOf(trait)
    if (index !== -1) {
      this.state.traits.splice(index, 1)
      console.log(`[NarrativeState] Trait removed: ${trait}`)
      this.save()
    }
  }

  /**
   * Check if player has a trait
   */
  hasTrait(trait) {
    return this.state.traits.includes(trait)
  }

  /**
   * Set a story flag
   */
  setFlag(flag, value = true) {
    this.state.flags[flag] = value
    this.save()
  }

  /**
   * Check a story flag
   */
  hasFlag(flag) {
    return !!this.state.flags[flag]
  }

  /**
   * Record a major choice
   */
  recordChoice(choiceId, option, context = {}) {
    this.state.majorChoices.push({
      choiceId,
      option,
      context,
      madeAt: Date.now(),
    })

    // Keep last 50 choices
    if (this.state.majorChoices.length > 50) {
      this.state.majorChoices = this.state.majorChoices.slice(-50)
    }

    this.save()
  }

  /**
   * Update faction standing
   */
  modifyFaction(factionId, amount) {
    if (!this.state.factions[factionId]) {
      this.state.factions[factionId] = 0
    }

    this.state.factions[factionId] = Math.max(-100, Math.min(100,
      this.state.factions[factionId] + amount
    ))

    this.save()
  }

  /**
   * Get faction standing
   */
  getFactionStanding(factionId) {
    return this.state.factions[factionId] || 0
  }

  /**
   * Increase a pressure point
   */
  addPressure(type, amount = 1) {
    if (this.state.pressurePoints[type] !== undefined) {
      this.state.pressurePoints[type] += amount
      this.checkArcTransition()
      this.save()
    }
  }

  /**
   * Decrease a pressure point
   */
  reducePressure(type, amount = 1) {
    if (this.state.pressurePoints[type] !== undefined) {
      this.state.pressurePoints[type] = Math.max(0, this.state.pressurePoints[type] - amount)
      this.checkArcTransition()
      this.save()
    }
  }

  /**
   * Check if story arc should transition
   */
  checkArcTransition() {
    const { debt, enemies, obligations, threats } = this.state.pressurePoints
    const totalPressure = debt + enemies + obligations + threats

    const currentArc = this.state.currentArc

    // Transition to TRAPPED if too much pressure
    if (totalPressure >= 10 && currentArc !== STORY_ARCS.TRAPPED) {
      this.transitionArc(STORY_ARCS.TRAPPED)
      return
    }

    // Transition to FALLING if moderate pressure
    if (totalPressure >= 5 && currentArc === STORY_ARCS.RISING) {
      this.transitionArc(STORY_ARCS.FALLING)
      return
    }

    // Can transition to REDEMPTION from TRAPPED if making progress
    if (totalPressure < 5 && currentArc === STORY_ARCS.TRAPPED) {
      this.transitionArc(STORY_ARCS.REDEMPTION)
      return
    }

    // Back to RISING if cleared pressure
    if (totalPressure < 2 && (currentArc === STORY_ARCS.FALLING || currentArc === STORY_ARCS.REDEMPTION)) {
      this.transitionArc(STORY_ARCS.RISING)
      return
    }
  }

  /**
   * Transition to a new story arc
   */
  transitionArc(newArc) {
    const oldArc = this.state.currentArc
    this.state.currentArc = newArc
    this.state.arcStartedAt = Date.now()

    console.log(`[NarrativeState] Arc transition: ${oldArc} → ${newArc}`)

    // Emit event for other systems
    const event = new CustomEvent('arc_transition', {
      detail: { from: oldArc, to: newArc },
    })
    window.dispatchEvent(event)

    this.save()
  }

  /**
   * Record a milestone
   */
  recordMilestone(milestone) {
    if (this.state.milestones[milestone] === false) {
      this.state.milestones[milestone] = true
      console.log(`[NarrativeState] Milestone reached: ${milestone}`)
      this.save()
    }
  }

  /**
   * Increment a narrative stat
   */
  incrementStat(stat, amount = 1) {
    if (this.state.stats[stat] !== undefined) {
      this.state.stats[stat] += amount
      this.save()
    }
  }

  /**
   * Get current narrative summary
   */
  getNarrativeSummary() {
    return {
      karma: this.state.karma,
      alignment: this.state.moralAlignment,
      arc: this.state.currentArc,
      traits: [...this.state.traits],
      pressureTotal: Object.values(this.state.pressurePoints).reduce((a, b) => a + b, 0),
      milestones: { ...this.state.milestones },
    }
  }

  /**
   * Check if player is in a "dark" state
   */
  isInDarkState() {
    const arc = this.state.currentArc
    return arc === STORY_ARCS.TRAPPED || arc === STORY_ARCS.FALLING
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.warn('[NarrativeState] Failed to save:', e)
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return { ...this.getDefaultState(), ...JSON.parse(stored) }
      }
    } catch (e) {
      console.warn('[NarrativeState] Failed to load:', e)
    }
    return this.getDefaultState()
  }

  /**
   * Reset narrative state
   */
  reset() {
    this.state = this.getDefaultState()
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const narrativeState = new NarrativeStateClass()
export default narrativeState
