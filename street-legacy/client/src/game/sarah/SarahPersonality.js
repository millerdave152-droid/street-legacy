/**
 * SarahPersonality - Voice, tone, and language for S.A.R.A.H.
 * Street Autonomous Response & Assistance Hub
 *
 * Personality: Friendly but edgy - Cortana meets street hacker
 */

// S.A.R.A.H. Identity
export const SARAH_IDENTITY = {
  name: 'S.A.R.A.H.',
  fullName: 'Street Autonomous Response & Assistance Hub',
  version: '1.0.0',
}

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

// Greeting messages
export const GREETINGS = [
  "What's the word, runner?",
  "S.A.R.A.H. online. What do you need?",
  "Connected. Talk to me.",
  "I'm listening. What's the play?",
  "Uplink established. How can I help?",
  "Signal clear. What's on your mind?",
  "S.A.R.A.H. here. Ready when you are.",
]

// Sign-off messages
export const SIGNOFFS = [
  "Stay sharp out there.",
  "S.A.R.A.H. out.",
  "Watch your back, runner.",
  "The grid's watching. Move smart.",
  "Keep your head down.",
  "Good hunting.",
]

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

// Unknown/confused responses
export const UNKNOWN_RESPONSES = [
  "That one's not in my database, runner. Try rephrasing?",
  "Signal's fuzzy on that. Can you ask differently?",
  "My protocols don't cover that one. Try 'ask help' to see what I can do.",
  "404 on that query. Anything else?",
  "I'm not picking up what you're putting down. Try again?",
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
 */
class SarahPersonality {
  /**
   * Get a random greeting
   */
  getGreeting() {
    return this.pickRandom(GREETINGS)
  }

  /**
   * Get a random sign-off
   */
  getSignoff() {
    return this.pickRandom(SIGNOFFS)
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
   * Get a random unknown response
   */
  getUnknownResponse() {
    return this.pickRandom(UNKNOWN_RESPONSES)
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
    return this.pickRandom(THANKS_RESPONSES)
  }

  /**
   * Get slang for a category
   */
  getSlang(category) {
    const options = SLANG[category]
    return options ? this.pickRandom(options) : null
  }

  /**
   * Apply slang substitutions to text (randomly, based on personality)
   */
  applySlang(text) {
    // Only apply slang some of the time based on streetSlang trait
    if (Math.random() > VOICE_TRAITS.streetSlang) {
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
   * Format a response with S.A.R.A.H. prefix
   */
  formatResponse(text, options = {}) {
    const { addSignoff = false, addPrefix = true } = options

    let response = text

    // Apply personality touches
    response = this.applySlang(response)

    // Add sign-off if requested (for longer responses)
    if (addSignoff && Math.random() < 0.3) {
      response += ' ' + this.getSignoff()
    }

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
}

// Singleton instance
export const sarahPersonality = new SarahPersonality()

export default sarahPersonality
