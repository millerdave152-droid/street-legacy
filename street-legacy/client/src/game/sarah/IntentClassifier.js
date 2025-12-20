/**
 * IntentClassifier - Query understanding for S.A.R.A.H.
 *
 * Classifies user queries into intent categories using pattern matching
 * and keyword analysis. No external AI required.
 */

// Intent types
export const INTENT_TYPES = {
  // Strategic advice
  CRIME_ADVICE: 'crime_advice',
  JOB_ADVICE: 'job_advice',
  MONEY_ADVICE: 'money_advice',
  HEAT_ADVICE: 'heat_advice',
  INVESTMENT: 'investment',

  // Game navigation
  HOW_TO: 'how_to',
  WHERE_IS: 'where_is',
  WHAT_IS: 'what_is',

  // Analysis
  STAT_ANALYSIS: 'stat_analysis',
  AI_INTEL: 'ai_intel',
  MARKET_ANALYSIS: 'market_analysis',
  ACHIEVEMENT: 'achievement',
  PROGRESS: 'progress',

  // Social
  GREETING: 'greeting',
  THANKS: 'thanks',
  HELP: 'help',
  WHO_ARE_YOU: 'who_are_you',

  // Fallback
  UNKNOWN: 'unknown',
}

// Intent patterns - arrays of regex patterns for each intent
const INTENT_PATTERNS = {
  [INTENT_TYPES.CRIME_ADVICE]: [
    /what (crime|should i (do|commit|steal|rob))/i,
    /best crime/i,
    /which crime/i,
    /(suggest|recommend).*(crime|steal|rob)/i,
    /crime (advice|suggestion|tip)/i,
    /should i (steal|rob|heist|burglar)/i,
    /what('s| is) (a )?good crime/i,
  ],

  [INTENT_TYPES.JOB_ADVICE]: [
    /what job/i,
    /best job/i,
    /which job/i,
    /(suggest|recommend).*job/i,
    /job (advice|suggestion|tip)/i,
    /safe (money|income|way)/i,
    /legit (work|money|income)/i,
    /earn (money )?safely/i,
  ],

  [INTENT_TYPES.MONEY_ADVICE]: [
    /how (do i |can i |to )?(make|get|earn) (more )?(money|cash)/i,
    /need (more )?(money|cash)/i,
    /(get|become) rich/i,
    /money (advice|tips?|strategy)/i,
    /broke|poor/i,
    /fastest way.*(money|cash)/i,
    /best way.*(money|cash|earn)/i,
  ],

  [INTENT_TYPES.HEAT_ADVICE]: [
    /reduce (my )?heat/i,
    /(lower|decrease|get rid of) (my )?heat/i,
    /too (much )?heat/i,
    /heat (is )?(too )?(high|hot)/i,
    /cops|police|fuzz|5-0|wanted/i,
    /(avoid|escape) (arrest|jail|police)/i,
    /how (do i |to )?(lose|shake).*(heat|cops)/i,
    /lay low/i,
  ],

  [INTENT_TYPES.INVESTMENT]: [
    /(should i |do i )?(buy|invest|purchase).*(property|properties)/i,
    /property (advice|investment)/i,
    /passive income/i,
    /what (should i )?(buy|invest)/i,
    /worth (buying|investing)/i,
    /best (property|investment)/i,
  ],

  [INTENT_TYPES.HOW_TO]: [
    /how (do|can|should) i/i,
    /how to/i,
    /what('s| is) the (best )?way to/i,
    /teach me/i,
    /explain how/i,
  ],

  [INTENT_TYPES.WHERE_IS]: [
    /where (is|can i find|do i)/i,
    /how (do i )?(get to|find|access)/i,
    /location of/i,
  ],

  [INTENT_TYPES.WHAT_IS]: [
    /what (is|are) /i,
    /what('s| does)/i,
    /explain /i,
    /tell me about (the |a )?(game|system|mechanic)/i,
    /define /i,
  ],

  [INTENT_TYPES.STAT_ANALYSIS]: [
    /how (am i|('m i)) doing/i,
    /my (stats|progress|status|situation)/i,
    /analyze (my|me)/i,
    /what('s| is) my (status|situation|state)/i,
    /give me a (rundown|summary|breakdown)/i,
    /assess (me|my)/i,
  ],

  [INTENT_TYPES.AI_INTEL]: [
    /tell me about [A-Z]/i,
    /who is [A-Z]/i,
    /info (on|about) [A-Z]/i,
    /what (do you )?know about [A-Z]/i,
    /(intel|info|information) (on|about)/i,
    /can i trust [A-Z]/i,
  ],

  [INTENT_TYPES.MARKET_ANALYSIS]: [
    /market (analysis|prices?|info)/i,
    /what (should i )?(trade|buy|sell)/i,
    /trading (advice|tips?)/i,
    /(good|best) (trade|deal)/i,
    /prices? (for|of|on)/i,
    /profit(able)?/i,
  ],

  [INTENT_TYPES.ACHIEVEMENT]: [
    /achievement/i,
    /what achievements/i,
    /close to (unlocking|getting)/i,
    /unlock/i,
    /badges?/i,
  ],

  [INTENT_TYPES.PROGRESS]: [
    /progress/i,
    /level up/i,
    /next level/i,
    /xp (needed|required|to)/i,
    /how (much )?(more )?xp/i,
  ],

  [INTENT_TYPES.GREETING]: [
    /^(hey|hi|hello|yo|sup|what'?s up)/i,
    /^good (morning|afternoon|evening)/i,
    /^greetings/i,
    /^sarah$/i,
    /^s$/i,
  ],

  [INTENT_TYPES.THANKS]: [
    /thank(s| you)/i,
    /appreciate/i,
    /helpful/i,
    /^ty$/i,
    /^thx$/i,
  ],

  [INTENT_TYPES.HELP]: [
    /^help$/i,
    /what can you (do|help)/i,
    /your (capabilities|features|functions)/i,
    /how (do i |can i )?use (you|sarah|this)/i,
    /what (do you|can you) (know|do)/i,
    /commands?/i,
  ],

  [INTENT_TYPES.WHO_ARE_YOU]: [
    /who are you/i,
    /what are you/i,
    /your name/i,
    /introduce yourself/i,
    /tell me about yourself/i,
  ],
}

// Keyword weights for additional scoring
const KEYWORD_WEIGHTS = {
  crime: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  steal: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  rob: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  heist: { [INTENT_TYPES.CRIME_ADVICE]: 2 },
  job: { [INTENT_TYPES.JOB_ADVICE]: 2 },
  work: { [INTENT_TYPES.JOB_ADVICE]: 1.5 },
  money: { [INTENT_TYPES.MONEY_ADVICE]: 1.5, [INTENT_TYPES.JOB_ADVICE]: 1 },
  cash: { [INTENT_TYPES.MONEY_ADVICE]: 1.5 },
  heat: { [INTENT_TYPES.HEAT_ADVICE]: 3 },
  cops: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  police: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  arrest: { [INTENT_TYPES.HEAT_ADVICE]: 2 },
  property: { [INTENT_TYPES.INVESTMENT]: 2 },
  invest: { [INTENT_TYPES.INVESTMENT]: 2 },
  trade: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  market: { [INTENT_TYPES.MARKET_ANALYSIS]: 2 },
  achievement: { [INTENT_TYPES.ACHIEVEMENT]: 3 },
  progress: { [INTENT_TYPES.PROGRESS]: 2 },
  level: { [INTENT_TYPES.PROGRESS]: 1.5 },
}

class IntentClassifier {
  /**
   * Classify a query into an intent category
   * @param {string} query - User query
   * @returns {object} { intent, confidence, entities }
   */
  classifyIntent(query) {
    const normalizedQuery = query.toLowerCase().trim()

    // Score each intent
    const scores = {}
    for (const intent of Object.values(INTENT_TYPES)) {
      scores[intent] = 0
    }

    // Pattern matching
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          scores[intent] += 3 // Pattern match is strong signal
        }
      }
    }

    // Keyword scoring
    const words = normalizedQuery.split(/\s+/)
    for (const word of words) {
      const weights = KEYWORD_WEIGHTS[word]
      if (weights) {
        for (const [intent, weight] of Object.entries(weights)) {
          scores[intent] += weight
        }
      }
    }

    // Find best match
    let bestIntent = INTENT_TYPES.UNKNOWN
    let bestScore = 0

    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score
        bestIntent = intent
      }
    }

    // Calculate confidence (0-1)
    const confidence = Math.min(1, bestScore / 6) // 6 is "very confident" threshold

    // Extract entities
    const entities = this.extractEntities(normalizedQuery)

    return {
      intent: bestIntent,
      confidence,
      scores, // For debugging
      entities,
    }
  }

  /**
   * Extract entities from query (names, numbers, etc.)
   * @param {string} query - Normalized query
   * @returns {object} Extracted entities
   */
  extractEntities(query) {
    const entities = {}

    // Extract player names (capitalized words that might be AI names)
    const namePatterns = [
      /(?:about|tell me about|who is|info on|trust)\s+(\w+)/i,
      /(\w+)(?:'s| is| has)/i,
    ]

    for (const pattern of namePatterns) {
      const match = query.match(pattern)
      if (match && match[1]) {
        const potentialName = match[1]
        // Filter out common words
        const commonWords = ['the', 'a', 'an', 'my', 'your', 'this', 'that', 'what', 'how', 'who', 'is', 'are']
        if (!commonWords.includes(potentialName.toLowerCase())) {
          entities.playerName = potentialName
          break
        }
      }
    }

    // Extract numbers
    const numbers = query.match(/\d+/g)
    if (numbers) {
      entities.numbers = numbers.map(n => parseInt(n, 10))
    }

    // Extract crime types mentioned
    const crimeTypes = ['pickpocket', 'shoplifting', 'mugging', 'car theft', 'burglary', 'robbery', 'heist']
    for (const crime of crimeTypes) {
      if (query.includes(crime)) {
        entities.crimeType = crime
        break
      }
    }

    // Extract job types mentioned
    const jobTypes = ['dishwasher', 'delivery', 'security', 'bartender', 'mechanic']
    for (const job of jobTypes) {
      if (query.includes(job)) {
        entities.jobType = job
        break
      }
    }

    // Extract location/district mentions
    const districts = ['downtown', 'parkdale', 'scarborough', 'yorkville', 'kensington']
    for (const district of districts) {
      if (query.includes(district)) {
        entities.district = district
        break
      }
    }

    return entities
  }

  /**
   * Check if query matches a specific intent
   * @param {string} query - User query
   * @param {string} intent - Intent to check
   * @returns {boolean} True if query matches intent
   */
  matchesIntent(query, intent) {
    const patterns = INTENT_PATTERNS[intent]
    if (!patterns) return false

    const normalizedQuery = query.toLowerCase().trim()
    return patterns.some(pattern => pattern.test(normalizedQuery))
  }

  /**
   * Get all possible intents (for help display)
   */
  getAllIntents() {
    return Object.values(INTENT_TYPES).filter(i => i !== INTENT_TYPES.UNKNOWN)
  }

  /**
   * Get intent description for help
   */
  getIntentDescription(intent) {
    const descriptions = {
      [INTENT_TYPES.CRIME_ADVICE]: 'Get crime recommendations',
      [INTENT_TYPES.JOB_ADVICE]: 'Get job recommendations',
      [INTENT_TYPES.MONEY_ADVICE]: 'Tips for making money',
      [INTENT_TYPES.HEAT_ADVICE]: 'How to reduce heat/avoid cops',
      [INTENT_TYPES.INVESTMENT]: 'Property investment advice',
      [INTENT_TYPES.HOW_TO]: 'Learn how to do things',
      [INTENT_TYPES.WHERE_IS]: 'Find locations and features',
      [INTENT_TYPES.WHAT_IS]: 'Explain game mechanics',
      [INTENT_TYPES.STAT_ANALYSIS]: 'Analyze your current stats',
      [INTENT_TYPES.AI_INTEL]: 'Info about other players',
      [INTENT_TYPES.MARKET_ANALYSIS]: 'Trading market analysis',
      [INTENT_TYPES.ACHIEVEMENT]: 'Achievement tracking',
      [INTENT_TYPES.PROGRESS]: 'Level progress info',
      [INTENT_TYPES.GREETING]: 'Say hello',
      [INTENT_TYPES.THANKS]: 'Thank S.A.R.A.H.',
      [INTENT_TYPES.HELP]: 'See what I can do',
      [INTENT_TYPES.WHO_ARE_YOU]: 'Learn about S.A.R.A.H.',
    }

    return descriptions[intent] || 'Unknown'
  }
}

// Singleton instance
export const intentClassifier = new IntentClassifier()

export default intentClassifier
