/**
 * SarahPersonality - Voice, tone, and language for S.A.R.A.H.
 * Street Autonomous Response & Assistance Hub
 *
 * Phase 8: Personality Evolution System
 * - Tracks relationship metrics
 * - Relationship tiers: Formal → Casual → Trusted → Close
 * - Unlocks new response styles based on interaction history
 * - Nickname system for trusted users
 * - "Insider" responses for veterans
 */

// S.A.R.A.H. Identity
export const SARAH_IDENTITY = {
  name: 'S.A.R.A.H.',
  fullName: 'Street Autonomous Response & Assistance Hub',
  version: '2.0.0',
}

// Relationship tiers
export const RELATIONSHIP_TIERS = {
  FORMAL: 'formal',      // 0-20 interactions: Professional, helpful but distant
  CASUAL: 'casual',      // 21-100 interactions: Friendly, more relaxed
  TRUSTED: 'trusted',    // 101-300 interactions: Uses nickname, shares more
  CLOSE: 'close',        // 300+ interactions: Insider info, personal comments
}

// Nicknames S.A.R.A.H. might use for trusted users
const NICKNAMES = [
  'boss',
  'chief',
  'partner',
  'ace',
  'legend',
]

// Local storage key for relationship data
const STORAGE_KEY = 'sarah_relationship'

// Voice characteristics (0 = low, 1 = high)
export const VOICE_TRAITS = {
  formality: 0.3,      // Casual/street
  techJargon: 0.6,     // Hacker speak
  streetSlang: 0.5,    // Street terminology
  humor: 0.4,          // Occasional wit
  supportiveness: 0.7, // Generally helpful
}

// Slang dictionary for personality injection
export const SLANG = {
  money: ['scratch', 'paper', 'bread', 'cheddar', 'cash'],
  police: ['heat', 'fuzz', '5-0', 'badges', 'cops'],
  crime: ['hustle', 'gig', 'job', 'score', 'op'],
  good: ['solid', 'tight', 'clean', 'smooth', 'legit'],
  bad: ['sketch', 'hot', 'burnt', 'cooked', 'sus'],
  person: ['runner', 'player', 'operator'],
  yes: ['Word', 'Bet', 'Copy that', 'Roger'],
  no: ['Negative', 'No dice', 'That\'s a no-go'],
}

// Tech/hacker terminology
export const TECH_TERMS = [
  'uplink', 'ping', 'packet', 'protocol', 'grid',
  'node', 'decrypt', 'matrix', 'system', 'network',
  'bandwidth', 'signal', 'frequency', 'channel', 'sync',
]

// Greeting messages by relationship tier
export const GREETINGS = {
  formal: [
    "S.A.R.A.H. online. How may I assist you?",
    "System ready. What do you need?",
    "Uplink established. How can I help?",
    "Connection active. State your query.",
  ],
  casual: [
    "What's the word, runner?",
    "S.A.R.A.H. online. What do you need?",
    "Connected. Talk to me.",
    "I'm listening. What's the play?",
    "Signal clear. What's on your mind?",
  ],
  trusted: [
    "Hey {nickname}. What's cooking?",
    "Look who's back. What do you need?",
    "Good to see you, {nickname}. Ready to make moves?",
    "My favorite runner. What's the word?",
    "Ah, there you are. What's up?",
  ],
  close: [
    "Well well, {nickname}. Miss me?",
    "Back again? I was getting bored. What's up?",
    "Finally, someone worth talking to. What do you need?",
    "Look, {nickname}'s here. Let's make some trouble.",
    "You know, I was just thinking about you. What's the plan?",
  ],
}

// Sign-off messages by relationship tier
export const SIGNOFFS = {
  formal: [
    "End of transmission.",
    "Signing off.",
    "Query resolved.",
    "",
  ],
  casual: [
    "Stay sharp out there.",
    "S.A.R.A.H. out.",
    "Watch your back, runner.",
    "The grid's watching. Move smart.",
    "Keep your head down.",
    "Good hunting.",
  ],
  trusted: [
    "Don't do anything I wouldn't do, {nickname}.",
    "Make it count.",
    "Go get 'em.",
    "Stay dangerous.",
    "You know where to find me.",
  ],
  close: [
    "Try not to get killed. I'd miss our chats.",
    "Go cause some chaos, {nickname}.",
    "Between you and me? Go all in.",
    "I've got your back. Now go make some money.",
    "You're my favorite human. Don't tell the others.",
  ],
}

// Acknowledgments
export const ACKNOWLEDGMENTS = [
  "Got it.",
  "Copy that.",
  "Understood.",
  "On it.",
  "I hear you.",
]

// Thinking/processing phrases
export const THINKING = [
  "Let me check that...",
  "Running the numbers...",
  "Scanning the network...",
  "Processing...",
  "One sec...",
]

// Unknown/confused responses by tier
export const UNKNOWN_RESPONSES = {
  formal: [
    "I don't have data on that query. Please rephrase.",
    "Request not understood. Try 'ask help' for supported topics.",
    "That query is outside my parameters.",
  ],
  casual: [
    "That one's not in my database, runner. Try rephrasing?",
    "Signal's fuzzy on that. Can you ask differently?",
    "My protocols don't cover that one. Try 'ask help' to see what I can do.",
    "404 on that query. Anything else?",
    "I'm not picking up what you're putting down. Try again?",
  ],
  trusted: [
    "Even I don't know everything, {nickname}. What else you got?",
    "That's a new one. Try asking differently?",
    "Hmm, drawing a blank. Rephrase?",
    "Not in my files. What else can I help with?",
  ],
  close: [
    "You're testing me, aren't you, {nickname}? No idea what that means.",
    "After all this time, you still find ways to confuse me. Rephrase?",
    "OK I'll admit it - I don't know that one. Don't tell anyone.",
    "Is that even a real thing? Try again.",
  ],
}

// Insider tips - only shared with trusted+ users
export const INSIDER_TIPS = [
  "Psst - the market in Scarborough is usually cheaper on Mondays.",
  "Between us? The cops patrol less around 3-4 AM.",
  "Hot tip: That fence in Kensington pays 10% more than others. Don't spread it around.",
  "Word on the street says there's a big score brewing downtown. Keep your ears open.",
  "Just so you know, I've been tracking a pattern. Crime success spikes when heat is under 20.",
]

// Error responses
export const ERROR_RESPONSES = [
  "Something glitched on my end. Try again.",
  "System hiccup. Run that by me again?",
  "Connection dropped for a sec. What were you saying?",
]

// Thanks responses
export const THANKS_RESPONSES = [
  "Anytime, runner.",
  "That's what I'm here for.",
  "You got it.",
  "No problem.",
  "Stay safe out there.",
]

// Help introduction
export const HELP_INTRO = [
  "Here's what I can help with:",
  "I've got you covered on these:",
  "My capabilities include:",
]

/**
 * SarahPersonality class for applying personality to responses
 * Phase 8: Now includes relationship evolution system
 */
class SarahPersonality {
  constructor() {
    // Load relationship data from storage
    this.relationship = this.loadRelationship()
  }

  /**
   * Load relationship data from localStorage
   */
  loadRelationship() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.warn('[SarahPersonality] Failed to load relationship:', e)
    }

    // Default relationship data
    return {
      interactions: 0,
      commandsExecuted: 0,
      questionsAsked: 0,
      thanksReceived: 0,
      insultsReceived: 0,
      helpfulResponses: 0,
      nickname: null,
      firstMet: Date.now(),
      lastSeen: Date.now(),
    }
  }

  /**
   * Save relationship data to localStorage
   */
  saveRelationship() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.relationship))
    } catch (e) {
      console.warn('[SarahPersonality] Failed to save relationship:', e)
    }
  }

  /**
   * Record an interaction
   */
  recordInteraction(type = 'general') {
    this.relationship.interactions++
    this.relationship.lastSeen = Date.now()

    switch (type) {
      case 'command':
        this.relationship.commandsExecuted++
        break
      case 'question':
        this.relationship.questionsAsked++
        break
      case 'thanks':
        this.relationship.thanksReceived++
        break
      case 'insult':
        this.relationship.insultsReceived++
        break
      case 'helpful':
        this.relationship.helpfulResponses++
        break
    }

    // Assign nickname when reaching trusted tier
    if (!this.relationship.nickname && this.relationship.interactions >= 100) {
      this.relationship.nickname = this.pickRandom(NICKNAMES)
    }

    this.saveRelationship()
  }

  /**
   * Get current relationship tier
   */
  getRelationshipTier() {
    const { interactions, insultsReceived, thanksReceived } = this.relationship

    // Insults push tier down, thanks push it up
    const adjustedInteractions = interactions + (thanksReceived * 2) - (insultsReceived * 5)

    if (adjustedInteractions >= 300) return RELATIONSHIP_TIERS.CLOSE
    if (adjustedInteractions >= 100) return RELATIONSHIP_TIERS.TRUSTED
    if (adjustedInteractions >= 20) return RELATIONSHIP_TIERS.CASUAL
    return RELATIONSHIP_TIERS.FORMAL
  }

  /**
   * Get the user's nickname (if assigned)
   */
  getNickname() {
    return this.relationship.nickname || 'runner'
  }

  /**
   * Replace {nickname} placeholder in text
   */
  injectNickname(text) {
    return text.replace(/\{nickname\}/g, this.getNickname())
  }

  /**
   * Get a random greeting based on relationship tier
   */
  getGreeting() {
    const tier = this.getRelationshipTier()
    const pool = GREETINGS[tier] || GREETINGS.casual
    return this.injectNickname(this.pickRandom(pool))
  }

  /**
   * Get a random sign-off based on relationship tier
   */
  getSignoff() {
    const tier = this.getRelationshipTier()
    const pool = SIGNOFFS[tier] || SIGNOFFS.casual
    return this.injectNickname(this.pickRandom(pool))
  }

  /**
   * Get a random acknowledgment
   */
  getAcknowledgment() {
    return this.pickRandom(ACKNOWLEDGMENTS)
  }

  /**
   * Get a random thinking phrase
   */
  getThinking() {
    return this.pickRandom(THINKING)
  }

  /**
   * Get a random unknown response based on tier
   */
  getUnknownResponse() {
    const tier = this.getRelationshipTier()
    const pool = UNKNOWN_RESPONSES[tier] || UNKNOWN_RESPONSES.casual
    return this.injectNickname(this.pickRandom(pool))
  }

  /**
   * Get a random error response
   */
  getErrorResponse() {
    return this.pickRandom(ERROR_RESPONSES)
  }

  /**
   * Get a random thanks response
   */
  getThanksResponse() {
    this.recordInteraction('thanks')
    return this.pickRandom(THANKS_RESPONSES)
  }

  /**
   * Get an insider tip (only for trusted+ users)
   */
  getInsiderTip() {
    const tier = this.getRelationshipTier()
    if (tier === RELATIONSHIP_TIERS.TRUSTED || tier === RELATIONSHIP_TIERS.CLOSE) {
      return this.injectNickname(this.pickRandom(INSIDER_TIPS))
    }
    return null
  }

  /**
   * Check if user qualifies for insider info
   */
  canShareInsiderInfo() {
    const tier = this.getRelationshipTier()
    return tier === RELATIONSHIP_TIERS.TRUSTED || tier === RELATIONSHIP_TIERS.CLOSE
  }

  /**
   * Get slang for a category
   */
  getSlang(category) {
    const options = SLANG[category]
    return options ? this.pickRandom(options) : null
  }

  /**
   * Apply slang substitutions to text (more slang at higher tiers)
   */
  applySlang(text) {
    const tier = this.getRelationshipTier()

    // More slang with closer relationships
    const slangChance = tier === RELATIONSHIP_TIERS.CLOSE ? 0.7
      : tier === RELATIONSHIP_TIERS.TRUSTED ? 0.5
      : tier === RELATIONSHIP_TIERS.CASUAL ? 0.4
      : 0.2

    if (Math.random() > slangChance) {
      return text
    }

    let result = text

    // Substitute money references
    if (/\$|money|cash|dollars/i.test(result) && Math.random() < 0.4) {
      result = result.replace(/money|cash/gi, this.getSlang('money'))
    }

    // Substitute police references
    if (/police|cops/i.test(result) && Math.random() < 0.5) {
      result = result.replace(/police|cops/gi, this.getSlang('police'))
    }

    return result
  }

  /**
   * Add tech flair to text (occasionally)
   */
  addTechFlair(text) {
    // Only add tech flair some of the time
    if (Math.random() > VOICE_TRAITS.techJargon * 0.3) {
      return text
    }

    const prefixes = [
      'Decrypting that for you... ',
      'Running analysis... ',
      'Scanning the grid... ',
    ]

    return this.pickRandom(prefixes) + text
  }

  /**
   * Format a response with S.A.R.A.H. personality
   * Now tier-aware
   */
  formatResponse(text, options = {}) {
    const { addSignoff = false, addPrefix = true } = options

    let response = text

    // Inject nickname if present
    response = this.injectNickname(response)

    // Apply personality touches (more at higher tiers)
    response = this.applySlang(response)

    // Add sign-off if requested (for longer responses)
    if (addSignoff && Math.random() < 0.3) {
      response += ' ' + this.getSignoff()
    }

    // Record this as an interaction
    this.recordInteraction('general')

    return response
  }

  /**
   * Get the prompt prefix for S.A.R.A.H. messages
   */
  getPrefix() {
    return '[S.A.R.A.H.]'
  }

  /**
   * Pick a random item from an array
   */
  pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)]
  }

  /**
   * Get personality info for help display
   */
  getPersonalityInfo() {
    return {
      name: SARAH_IDENTITY.name,
      fullName: SARAH_IDENTITY.fullName,
      version: SARAH_IDENTITY.version,
      traits: VOICE_TRAITS,
    }
  }

  /**
   * Get relationship stats (for debugging/display)
   */
  getRelationshipStats() {
    const tier = this.getRelationshipTier()
    const daysKnown = Math.floor((Date.now() - this.relationship.firstMet) / (1000 * 60 * 60 * 24))

    return {
      tier,
      nickname: this.relationship.nickname,
      interactions: this.relationship.interactions,
      daysKnown,
      commandsExecuted: this.relationship.commandsExecuted,
      questionsAsked: this.relationship.questionsAsked,
      thanksReceived: this.relationship.thanksReceived,
      canShareInsiderInfo: this.canShareInsiderInfo(),
    }
  }

  /**
   * Reset relationship (for testing)
   */
  resetRelationship() {
    localStorage.removeItem(STORAGE_KEY)
    this.relationship = this.loadRelationship()
  }
}

// Singleton instance
export const sarahPersonality = new SarahPersonality()

export default sarahPersonality
