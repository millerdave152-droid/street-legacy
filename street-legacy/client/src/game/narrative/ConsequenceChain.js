/**
 * ConsequenceChain - Phase 13: Consequence Chain Framework
 *
 * Choices cascade into deeper consequences over time.
 * Types: IMMEDIATE, DELAYED, CONDITIONAL, BRANCHING
 *
 * Example chain:
 * Accept sketchy job → Complete job → Get paid →
 * DELAYED: Blackmail attempt 2 days later →
 * BRANCHING: Pay up OR Refuse →
 *   Pay: Marked as easy target (more extortion)
 *   Refuse: Enemy made, potential attack
 */

const STORAGE_KEY = 'narrative_consequences'

// Consequence types
export const CONSEQUENCE_TYPES = {
  IMMEDIATE: 'immediate',   // Happens right away
  DELAYED: 'delayed',       // Triggers after time passes
  CONDITIONAL: 'conditional', // Triggers when condition is met
  BRANCHING: 'branching',   // Creates multiple possible outcomes
}

// Consequence severity
export const SEVERITY = {
  MINOR: 'minor',       // Small stat change, flavor text
  MODERATE: 'moderate', // Notable impact on gameplay
  MAJOR: 'major',       // Significant story/gameplay change
  CRITICAL: 'critical', // Game-changing consequence
}

/**
 * ConsequenceChain class
 */
class ConsequenceChainClass {
  constructor() {
    this.activeChains = []
    this.triggeredConsequences = []
    this.pendingDelayed = []
    this.chainTemplates = this.initChainTemplates()

    this.load()
  }

  /**
   * Initialize chain templates - predefined consequence patterns
   */
  initChainTemplates() {
    return {
      // Accepting a job from untrustworthy NPC
      sketchy_job: {
        trigger: 'job_accepted_low_trust',
        steps: [
          {
            id: 'job_complete',
            type: CONSEQUENCE_TYPES.CONDITIONAL,
            condition: 'job_completed',
            effects: [{ type: 'cash', value: 'job_payout' }],
            nextSteps: ['blackmail_chance'],
          },
          {
            id: 'blackmail_chance',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 120000, // 2 minutes (in real game would be 2 days)
            chance: 0.4,   // 40% chance
            effects: [{ type: 'message', npc: 'job_giver', template: 'blackmail' }],
            branches: {
              pay: { effects: [{ type: 'cash', value: -500 }, { type: 'trait', value: 'easy_mark' }], nextSteps: ['more_extortion'] },
              refuse: { effects: [{ type: 'relationship', npc: 'job_giver', value: -50 }], nextSteps: ['retaliation'] },
            },
          },
          {
            id: 'more_extortion',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 300000,
            chance: 0.6,
            effects: [{ type: 'message', template: 'extortion_2' }],
          },
          {
            id: 'retaliation',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 180000,
            chance: 0.7,
            effects: [{ type: 'event', event: 'ambush' }],
          },
        ],
      },

      // Betraying an ally
      betrayal_chain: {
        trigger: 'player_betrayed_ally',
        steps: [
          {
            id: 'reputation_hit',
            type: CONSEQUENCE_TYPES.IMMEDIATE,
            effects: [
              { type: 'reputation', value: -20 },
              { type: 'trait', value: 'untrustworthy' },
            ],
            nextSteps: ['word_spreads'],
          },
          {
            id: 'word_spreads',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 60000,
            effects: [{ type: 'message', template: 'reputation_damaged' }],
            nextSteps: ['trust_loss'],
          },
          {
            id: 'trust_loss',
            type: CONSEQUENCE_TYPES.CONDITIONAL,
            condition: 'interaction_with_npc',
            effects: [{ type: 'trust_modifier', value: -0.2 }],
          },
        ],
      },

      // Getting in debt to dangerous NPC
      debt_chain: {
        trigger: 'debt_incurred',
        steps: [
          {
            id: 'debt_reminder',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 180000,
            effects: [{ type: 'message', template: 'debt_reminder' }],
            nextSteps: ['debt_pressure'],
          },
          {
            id: 'debt_pressure',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 300000,
            effects: [
              { type: 'message', template: 'debt_warning' },
              { type: 'stat', stat: 'stress', value: 10 },
            ],
            nextSteps: ['debt_collection'],
          },
          {
            id: 'debt_collection',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 600000,
            effects: [{ type: 'event', event: 'debt_collectors' }],
          },
        ],
      },

      // Helping the wrong person
      wrong_side: {
        trigger: 'helped_enemy_faction',
        steps: [
          {
            id: 'faction_anger',
            type: CONSEQUENCE_TYPES.IMMEDIATE,
            effects: [{ type: 'faction_reputation', faction: 'opposing', value: 20 }],
            nextSteps: ['ally_disappointment'],
          },
          {
            id: 'ally_disappointment',
            type: CONSEQUENCE_TYPES.DELAYED,
            delay: 60000,
            effects: [
              { type: 'message', template: 'ally_disappointed' },
              { type: 'faction_reputation', faction: 'allied', value: -15 },
            ],
          },
        ],
      },
    }
  }

  /**
   * Start a consequence chain
   */
  startChain(templateId, context = {}) {
    const template = this.chainTemplates[templateId]
    if (!template) {
      console.warn(`[ConsequenceChain] Unknown template: ${templateId}`)
      return null
    }

    const chain = {
      id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      startedAt: Date.now(),
      context: { ...context },
      currentStep: 0,
      completedSteps: [],
      status: 'active',
    }

    this.activeChains.push(chain)
    this.save()

    // Execute first step if immediate
    const firstStep = template.steps[0]
    if (firstStep && firstStep.type === CONSEQUENCE_TYPES.IMMEDIATE) {
      this.executeStep(chain, firstStep)
    }

    console.log(`[ConsequenceChain] Started chain: ${templateId}`)
    return chain.id
  }

  /**
   * Execute a consequence step
   */
  executeStep(chain, step) {
    const template = this.chainTemplates[chain.templateId]
    if (!template) return

    // Check chance
    if (step.chance !== undefined && Math.random() > step.chance) {
      console.log(`[ConsequenceChain] Step ${step.id} failed chance check`)
      chain.completedSteps.push({ stepId: step.id, skipped: true })
      this.advanceChain(chain, step)
      return
    }

    // Execute effects
    for (const effect of step.effects || []) {
      this.applyEffect(effect, chain.context)
    }

    // Record completion
    chain.completedSteps.push({ stepId: step.id, at: Date.now() })
    this.triggeredConsequences.push({
      chainId: chain.id,
      stepId: step.id,
      at: Date.now(),
    })

    // Handle next steps
    if (step.type === CONSEQUENCE_TYPES.BRANCHING) {
      // Wait for player choice
      chain.awaitingChoice = true
      chain.branches = step.branches
    } else {
      this.advanceChain(chain, step)
    }

    this.save()
  }

  /**
   * Advance to next step(s) in chain
   */
  advanceChain(chain, currentStep) {
    const template = this.chainTemplates[chain.templateId]
    if (!template) return

    const nextStepIds = currentStep.nextSteps || []

    if (nextStepIds.length === 0) {
      // Chain complete
      chain.status = 'completed'
      console.log(`[ConsequenceChain] Chain completed: ${chain.id}`)
      return
    }

    // Schedule next steps
    for (const stepId of nextStepIds) {
      const step = template.steps.find(s => s.id === stepId)
      if (!step) continue

      if (step.type === CONSEQUENCE_TYPES.DELAYED) {
        this.scheduleDelayed(chain, step)
      } else if (step.type === CONSEQUENCE_TYPES.CONDITIONAL) {
        this.registerConditional(chain, step)
      } else {
        this.executeStep(chain, step)
      }
    }
  }

  /**
   * Schedule a delayed consequence
   */
  scheduleDelayed(chain, step) {
    const triggerAt = Date.now() + step.delay

    this.pendingDelayed.push({
      chainId: chain.id,
      stepId: step.id,
      triggerAt,
    })

    console.log(`[ConsequenceChain] Scheduled delayed: ${step.id} at ${new Date(triggerAt).toISOString()}`)
    this.save()
  }

  /**
   * Register a conditional consequence
   */
  registerConditional(chain, step) {
    chain.pendingConditionals = chain.pendingConditionals || []
    chain.pendingConditionals.push({
      stepId: step.id,
      condition: step.condition,
    })
    this.save()
  }

  /**
   * Make a choice at a branching point
   */
  makeChoice(chainId, choice) {
    const chain = this.activeChains.find(c => c.id === chainId)
    if (!chain || !chain.awaitingChoice || !chain.branches) {
      return false
    }

    const branch = chain.branches[choice]
    if (!branch) {
      console.warn(`[ConsequenceChain] Invalid choice: ${choice}`)
      return false
    }

    // Apply branch effects
    for (const effect of branch.effects || []) {
      this.applyEffect(effect, chain.context)
    }

    // Record choice
    chain.completedSteps.push({
      stepId: `choice_${choice}`,
      at: Date.now(),
      choice,
    })

    chain.awaitingChoice = false
    chain.branches = null

    // Continue with branch's next steps
    if (branch.nextSteps) {
      const template = this.chainTemplates[chain.templateId]
      for (const stepId of branch.nextSteps) {
        const step = template.steps.find(s => s.id === stepId)
        if (step) {
          if (step.type === CONSEQUENCE_TYPES.DELAYED) {
            this.scheduleDelayed(chain, step)
          } else {
            this.executeStep(chain, step)
          }
        }
      }
    }

    this.save()
    return true
  }

  /**
   * Apply an effect
   */
  applyEffect(effect, context) {
    console.log(`[ConsequenceChain] Applying effect:`, effect)

    // Effect handlers would integrate with game systems
    // For now, emit events that game systems can listen to
    const event = new CustomEvent('narrative_effect', {
      detail: { effect, context },
    })
    window.dispatchEvent(event)
  }

  /**
   * Check for triggered delayed consequences
   */
  checkDelayed() {
    const now = Date.now()
    const triggered = []

    for (let i = this.pendingDelayed.length - 1; i >= 0; i--) {
      const pending = this.pendingDelayed[i]
      if (pending.triggerAt <= now) {
        triggered.push(pending)
        this.pendingDelayed.splice(i, 1)
      }
    }

    for (const item of triggered) {
      const chain = this.activeChains.find(c => c.id === item.chainId)
      if (!chain) continue

      const template = this.chainTemplates[chain.templateId]
      if (!template) continue

      const step = template.steps.find(s => s.id === item.stepId)
      if (step) {
        this.executeStep(chain, step)
      }
    }

    if (triggered.length > 0) {
      this.save()
    }
  }

  /**
   * Check if a condition triggers any pending conditionals
   */
  checkCondition(conditionType, data = {}) {
    for (const chain of this.activeChains) {
      if (!chain.pendingConditionals) continue

      for (let i = chain.pendingConditionals.length - 1; i >= 0; i--) {
        const pending = chain.pendingConditionals[i]
        if (pending.condition === conditionType) {
          const template = this.chainTemplates[chain.templateId]
          if (!template) continue

          const step = template.steps.find(s => s.id === pending.stepId)
          if (step) {
            chain.context = { ...chain.context, ...data }
            this.executeStep(chain, step)
            chain.pendingConditionals.splice(i, 1)
          }
        }
      }
    }

    this.save()
  }

  /**
   * Get active chains (for UI display)
   */
  getActiveChains() {
    return this.activeChains.filter(c => c.status === 'active')
  }

  /**
   * Get chains awaiting player choice
   */
  getPendingChoices() {
    return this.activeChains.filter(c => c.awaitingChoice)
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeChains: this.activeChains,
        pendingDelayed: this.pendingDelayed,
        triggeredConsequences: this.triggeredConsequences.slice(-50), // Keep last 50
      }))
    } catch (e) {
      console.warn('[ConsequenceChain] Failed to save:', e)
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
        this.activeChains = data.activeChains || []
        this.pendingDelayed = data.pendingDelayed || []
        this.triggeredConsequences = data.triggeredConsequences || []
      }
    } catch (e) {
      console.warn('[ConsequenceChain] Failed to load:', e)
    }
  }

  /**
   * Reset all chains (for testing)
   */
  reset() {
    this.activeChains = []
    this.pendingDelayed = []
    this.triggeredConsequences = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const consequenceChain = new ConsequenceChainClass()
export default consequenceChain
