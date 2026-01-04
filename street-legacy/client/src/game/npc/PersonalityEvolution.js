/**
 * PersonalityEvolution - NPC Personality Drift System
 *
 * NPCs evolve their behavior based on:
 * - Relationship history with player
 * - Major events (breaking points)
 * - Trust levels
 * - Mood states (temporary)
 *
 * Enables:
 * - Cold contacts becoming warm friends
 * - Trusted allies turning hostile after betrayal
 * - Personality-colored dialogue responses
 * - Dynamic NPC behavior
 */

const STORAGE_KEY = 'street_legacy_personality_states'

// Base personality types
const PERSONALITY_TYPES = {
  PROFESSIONAL: 'professional',     // Business-focused, formal
  FRIENDLY: 'friendly',             // Warm, casual
  AGGRESSIVE: 'aggressive',         // Confrontational, demanding
  CAUTIOUS: 'cautious',             // Suspicious, careful
  CHARISMATIC: 'charismatic',       // Smooth, persuasive
  COLD: 'cold',                     // Distant, unemotional
  LOYAL: 'loyal',                   // Ride-or-die mentality
  OPPORTUNISTIC: 'opportunistic',   // Self-serving
  MENTOR: 'mentor',                 // Teaching, guiding
  UNPREDICTABLE: 'unpredictable'    // Erratic, mood-dependent
}

// Relationship stages affect personality expression
const RELATIONSHIP_STAGES = {
  STRANGER: 'stranger',
  ACQUAINTANCE: 'acquaintance',
  BUSINESS: 'business',
  FRIEND: 'friend',
  TRUSTED: 'trusted',
  ENEMY: 'enemy'
}

// Mood states (temporary modifiers)
const MOODS = {
  NEUTRAL: 'neutral',
  HAPPY: 'happy',
  ANGRY: 'angry',
  SUSPICIOUS: 'suspicious',
  GRATEFUL: 'grateful',
  BETRAYED: 'betrayed',
  IMPRESSED: 'impressed',
  DISAPPOINTED: 'disappointed'
}

// Breaking points - events that permanently alter personality
const BREAKING_POINTS = {
  SAVED_LIFE: {
    trigger: 'saved_from_cops',
    effect: { trust: 0.5, warmth: 0.4 },
    newTrait: 'loyal_forever',
    message: 'You saved my life. I owe you everything.'
  },
  BETRAYED: {
    trigger: 'deal_betrayed',
    effect: { trust: -0.8, warmth: -0.6, aggression: 0.5 },
    newTrait: 'bitter',
    stageChange: 'enemy',
    message: 'I trusted you. Never again.'
  },
  BIG_SCORE_TOGETHER: {
    trigger: 'big_score',
    effect: { trust: 0.3, warmth: 0.2 },
    newTrait: 'bonded',
    message: 'After what we pulled off... we\'re family now.'
  },
  HELPED_IN_CRISIS: {
    trigger: 'helped_escape',
    effect: { trust: 0.4, warmth: 0.3 },
    newTrait: 'grateful',
    message: 'You came through when it mattered. I won\'t forget.'
  },
  PROVEN_UNRELIABLE: {
    trigger: 'multiple_failures',
    effect: { trust: -0.3, patience: -0.4 },
    newTrait: 'doubtful',
    message: 'Look, I like you... but you keep dropping the ball.'
  },
  SHOWN_GENEROSITY: {
    trigger: 'shared_profits',
    effect: { warmth: 0.3, trust: 0.2 },
    newTrait: 'appreciative',
    message: 'You didn\'t have to share that. That means something.'
  }
}

// Dialogue style modifiers based on personality + relationship
const DIALOGUE_STYLES = {
  professional_stranger: {
    greetings: ['Let\'s talk business.', 'What do you need?', 'Time is money.'],
    affirmative: ['Done.', 'Agreed.', 'Terms accepted.'],
    negative: ['No deal.', 'That doesn\'t work.', 'Pass.'],
    tone: 'formal'
  },
  professional_friend: {
    greetings: ['Good to see you again.', 'Ready to make money?', 'What\'s the opportunity?'],
    affirmative: ['Count me in.', 'Let\'s do it.', 'You got it.'],
    negative: ['Can\'t do that one.', 'Not this time.', 'Have to pass.'],
    tone: 'warm_professional'
  },
  friendly_stranger: {
    greetings: ['Hey, new face!', 'Haven\'t seen you around.', 'What brings you by?'],
    affirmative: ['Sure thing!', 'Sounds good!', 'I\'m in!'],
    negative: ['Nah, not for me.', 'Gonna have to pass.', 'Maybe next time.'],
    tone: 'casual'
  },
  friendly_friend: {
    greetings: ['My favorite person!', 'Yooo!', 'What\'s good, fam?'],
    affirmative: ['Always, homie.', 'You know I got you.', 'Say less.'],
    negative: ['Love you but no.', 'Can\'t do it, fam.', 'This one\'s not me.'],
    tone: 'intimate'
  },
  aggressive_stranger: {
    greetings: ['Who the hell are you?', 'What do you want?', 'Make it quick.'],
    affirmative: ['Fine.', 'Whatever.', 'Just get it done.'],
    negative: ['Get lost.', 'Not happening.', 'Are you stupid?'],
    tone: 'hostile'
  },
  aggressive_enemy: {
    greetings: ['You\'ve got nerve showing up.', 'What do you want, traitor?', 'I should kill you.'],
    affirmative: ['Against my better judgment.', 'This changes nothing.', 'Don\'t mistake this for forgiveness.'],
    negative: ['Rot in hell.', 'Never.', 'Get out of my sight.'],
    tone: 'threatening'
  },
  cold_stranger: {
    greetings: ['...', 'State your business.', 'Yes?'],
    affirmative: ['Acceptable.', 'Proceed.', 'Very well.'],
    negative: ['No.', 'Declined.', 'Unacceptable.'],
    tone: 'detached'
  },
  cold_trusted: {
    greetings: ['You\'re here.', 'I expected you.', 'Finally.'],
    affirmative: ['As you wish.', 'It will be done.', 'Of course.'],
    negative: ['Even I have limits.', 'That\'s not possible.', 'Choose differently.'],
    tone: 'reserved_warm'
  }
}

// Default personality state
const createDefaultPersonality = (npcId, baseType = PERSONALITY_TYPES.PROFESSIONAL) => ({
  npcId,
  basePersonality: baseType,
  currentPersonality: baseType,

  // Personality modifiers (-1 to 1)
  modifiers: {
    warmth: 0,        // How friendly/cold
    trust: 0,         // How much they trust player
    aggression: 0,    // How confrontational
    patience: 0,      // Tolerance for mistakes
    formality: 0,     // How formal/casual
    openness: 0       // How much they share
  },

  // Current mood (temporary)
  mood: {
    current: MOODS.NEUTRAL,
    intensity: 0.5,
    expiresAt: null
  },

  // Relationship stage
  stage: RELATIONSHIP_STAGES.STRANGER,

  // Acquired traits from breaking points
  traits: [],

  // Evolution history
  evolutionLog: [],

  version: 1
})

class PersonalityEvolutionClass {
  constructor() {
    this.personalities = {}
    this.isInitialized = false
    this.listeners = []
  }

  /**
   * Initialize the personality system
   */
  initialize() {
    if (this.isInitialized) return

    this.loadPersonalities()
    this.isInitialized = true
    console.log('[PersonalityEvolution] Initialized with ' +
      Object.keys(this.personalities).length + ' NPC personalities')
  }

  /**
   * Get or create personality for an NPC
   */
  getPersonality(npcId, baseType = PERSONALITY_TYPES.PROFESSIONAL) {
    if (!this.personalities[npcId]) {
      this.personalities[npcId] = createDefaultPersonality(npcId, baseType)
    }
    return this.personalities[npcId]
  }

  /**
   * Set base personality type for an NPC
   */
  setBasePersonality(npcId, baseType) {
    const personality = this.getPersonality(npcId, baseType)
    personality.basePersonality = baseType
    personality.currentPersonality = baseType
    this.savePersonalities()
  }

  /**
   * Update relationship stage
   */
  setRelationshipStage(npcId, stage) {
    const personality = this.getPersonality(npcId)
    const oldStage = personality.stage
    personality.stage = stage

    if (oldStage !== stage) {
      this.logEvolution(npcId, 'stage_change', { from: oldStage, to: stage })
      this.notifyListeners('stage_change', { npcId, from: oldStage, to: stage })
    }

    this.savePersonalities()
  }

  /**
   * Apply modifier changes based on event
   */
  applyModifiers(npcId, modifiers) {
    const personality = this.getPersonality(npcId)

    Object.entries(modifiers).forEach(([key, value]) => {
      if (personality.modifiers.hasOwnProperty(key)) {
        // Clamp between -1 and 1
        personality.modifiers[key] = Math.max(-1,
          Math.min(1, personality.modifiers[key] + value)
        )
      }
    })

    // Update current personality based on modifiers
    this.updateCurrentPersonality(npcId)
    this.savePersonalities()
  }

  /**
   * Update current personality based on modifiers
   */
  updateCurrentPersonality(npcId) {
    const p = this.getPersonality(npcId)
    const mods = p.modifiers

    // Start with base personality
    let current = p.basePersonality

    // Shift personality based on strong modifiers
    if (mods.warmth > 0.5 && p.basePersonality !== PERSONALITY_TYPES.FRIENDLY) {
      current = PERSONALITY_TYPES.FRIENDLY
    } else if (mods.warmth < -0.5 && p.basePersonality !== PERSONALITY_TYPES.COLD) {
      current = PERSONALITY_TYPES.COLD
    }

    if (mods.aggression > 0.6) {
      current = PERSONALITY_TYPES.AGGRESSIVE
    }

    if (mods.trust > 0.6 && mods.warmth > 0.3) {
      current = PERSONALITY_TYPES.LOYAL
    }

    if (p.stage === RELATIONSHIP_STAGES.ENEMY) {
      current = PERSONALITY_TYPES.AGGRESSIVE
    }

    p.currentPersonality = current
  }

  /**
   * Set temporary mood
   */
  setMood(npcId, mood, intensity = 0.7, durationMs = 300000) {
    const personality = this.getPersonality(npcId)

    personality.mood = {
      current: mood,
      intensity: Math.min(1, Math.max(0, intensity)),
      expiresAt: Date.now() + durationMs
    }

    this.savePersonalities()
  }

  /**
   * Get current mood (checking expiry)
   */
  getMood(npcId) {
    const personality = this.getPersonality(npcId)

    if (personality.mood.expiresAt && Date.now() > personality.mood.expiresAt) {
      personality.mood = {
        current: MOODS.NEUTRAL,
        intensity: 0.5,
        expiresAt: null
      }
    }

    return personality.mood
  }

  /**
   * Check and apply breaking points
   */
  checkBreakingPoint(npcId, eventType, context = {}) {
    const personality = this.getPersonality(npcId)

    for (const [name, breakpoint] of Object.entries(BREAKING_POINTS)) {
      if (breakpoint.trigger === eventType) {
        // Check if already have this trait
        if (!personality.traits.includes(breakpoint.newTrait)) {
          // Apply breaking point
          this.applyModifiers(npcId, breakpoint.effect)

          // Add trait
          personality.traits.push(breakpoint.newTrait)

          // Change stage if specified
          if (breakpoint.stageChange) {
            this.setRelationshipStage(npcId, breakpoint.stageChange)
          }

          // Log the breaking point
          this.logEvolution(npcId, 'breaking_point', {
            name,
            trait: breakpoint.newTrait,
            message: breakpoint.message
          })

          // Notify listeners
          this.notifyListeners('breaking_point', {
            npcId,
            breakpoint: name,
            message: breakpoint.message
          })

          return {
            occurred: true,
            name,
            message: breakpoint.message
          }
        }
      }
    }

    return { occurred: false }
  }

  /**
   * Get dialogue style for NPC based on personality + stage
   */
  getDialogueStyle(npcId) {
    const personality = this.getPersonality(npcId)
    const key = `${personality.currentPersonality}_${personality.stage}`

    // Try exact match first
    if (DIALOGUE_STYLES[key]) {
      return DIALOGUE_STYLES[key]
    }

    // Fallback to personality + closest stage
    const fallbackKeys = [
      `${personality.currentPersonality}_stranger`,
      `${personality.basePersonality}_${personality.stage}`,
      `${personality.basePersonality}_stranger`,
      'professional_stranger'
    ]

    for (const fallback of fallbackKeys) {
      if (DIALOGUE_STYLES[fallback]) {
        return DIALOGUE_STYLES[fallback]
      }
    }

    return DIALOGUE_STYLES.professional_stranger
  }

  /**
   * Get a contextual greeting
   */
  getGreeting(npcId) {
    const style = this.getDialogueStyle(npcId)
    const mood = this.getMood(npcId)

    // Mood can override greeting
    if (mood.current === MOODS.ANGRY && mood.intensity > 0.7) {
      return 'What do you want?'
    }
    if (mood.current === MOODS.HAPPY && mood.intensity > 0.7) {
      return 'Hey! Great to see you!'
    }
    if (mood.current === MOODS.BETRAYED) {
      return '...'
    }

    const greetings = style.greetings
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  /**
   * Get response style for yes/no
   */
  getResponse(npcId, isAffirmative) {
    const style = this.getDialogueStyle(npcId)
    const responses = isAffirmative ? style.affirmative : style.negative
    return responses[Math.floor(Math.random() * responses.length)]
  }

  /**
   * Check if NPC would accept a request based on personality
   */
  wouldAccept(npcId, context = {}) {
    const personality = this.getPersonality(npcId)
    const mood = this.getMood(npcId)

    // Base acceptance chance
    let chance = 0.5

    // Modifiers affect chance
    chance += personality.modifiers.trust * 0.2
    chance += personality.modifiers.warmth * 0.1

    // Mood affects chance
    if (mood.current === MOODS.HAPPY) chance += 0.2
    if (mood.current === MOODS.ANGRY) chance -= 0.3
    if (mood.current === MOODS.GRATEFUL) chance += 0.3
    if (mood.current === MOODS.SUSPICIOUS) chance -= 0.2
    if (mood.current === MOODS.BETRAYED) chance -= 0.5

    // Stage affects chance
    if (personality.stage === RELATIONSHIP_STAGES.TRUSTED) chance += 0.3
    if (personality.stage === RELATIONSHIP_STAGES.FRIEND) chance += 0.2
    if (personality.stage === RELATIONSHIP_STAGES.ENEMY) chance -= 0.4

    // Context modifiers
    if (context.riskLevel > 0.7) chance -= 0.2
    if (context.valueToNPC > 1000) chance += 0.1

    return Math.random() < Math.max(0.1, Math.min(0.95, chance))
  }

  /**
   * Get personality summary for display
   */
  getPersonalitySummary(npcId) {
    const p = this.getPersonality(npcId)
    const mood = this.getMood(npcId)

    return {
      base: p.basePersonality,
      current: p.currentPersonality,
      stage: p.stage,
      mood: mood.current,
      traits: p.traits,
      warmth: this.modifierToText(p.modifiers.warmth),
      trust: this.modifierToText(p.modifiers.trust),
      isEnemy: p.stage === RELATIONSHIP_STAGES.ENEMY
    }
  }

  /**
   * Convert modifier value to descriptive text
   */
  modifierToText(value) {
    if (value > 0.6) return 'very high'
    if (value > 0.3) return 'high'
    if (value > -0.3) return 'neutral'
    if (value > -0.6) return 'low'
    return 'very low'
  }

  /**
   * Log evolution event
   */
  logEvolution(npcId, eventType, details) {
    const personality = this.getPersonality(npcId)

    personality.evolutionLog.unshift({
      type: eventType,
      details,
      timestamp: Date.now()
    })

    // Keep only last 50 events
    if (personality.evolutionLog.length > 50) {
      personality.evolutionLog.pop()
    }
  }

  /**
   * Add listener for personality events
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
        console.error('[PersonalityEvolution] Listener error:', e)
      }
    })
  }

  /**
   * Save all personalities to localStorage
   */
  savePersonalities() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        personalities: this.personalities,
        savedAt: Date.now(),
        version: 1
      }))
    } catch (e) {
      console.warn('[PersonalityEvolution] Save failed:', e)
    }
  }

  /**
   * Load personalities from localStorage
   */
  loadPersonalities() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.personalities = data.personalities || {}
      }
    } catch (e) {
      console.warn('[PersonalityEvolution] Load failed:', e)
      this.personalities = {}
    }
  }

  /**
   * Clear all personality data (for testing/reset)
   */
  clearAllPersonalities() {
    this.personalities = {}
    localStorage.removeItem(STORAGE_KEY)
    console.log('[PersonalityEvolution] All personalities cleared')
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      npcCount: Object.keys(this.personalities).length,
      totalTraits: Object.values(this.personalities)
        .reduce((sum, p) => sum + p.traits.length, 0),
      evolutionEvents: Object.values(this.personalities)
        .reduce((sum, p) => sum + p.evolutionLog.length, 0)
    }
  }
}

// Singleton instance
export const personalityEvolution = new PersonalityEvolutionClass()

// Export constants
export { PERSONALITY_TYPES, RELATIONSHIP_STAGES, MOODS, BREAKING_POINTS, DIALOGUE_STYLES }
export default personalityEvolution
