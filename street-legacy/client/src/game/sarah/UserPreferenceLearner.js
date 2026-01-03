/**
 * UserPreferenceLearner - Phase 11: Learning User Preferences
 *
 * Tracks and learns player preferences over time:
 * - Preferred crime types
 * - Response length preference
 * - Risk tolerance
 * - Play patterns (time of day, session length)
 * - Communication style preference
 *
 * Data persisted to localStorage
 */

const STORAGE_KEY = 'sarah_user_preferences'

// Decay factor for preference weights (older actions matter less)
const DECAY_FACTOR = 0.95

/**
 * UserPreferenceLearner class
 */
class UserPreferenceLearnerClass {
  constructor() {
    this.preferences = this.loadPreferences()
  }

  /**
   * Load preferences from localStorage
   */
  loadPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.warn('[UserPreferenceLearner] Failed to load preferences:', e)
    }

    // Default preferences
    return {
      // Crime preferences (weighted by frequency)
      crimePreferences: {
        pickpocket: 0,
        shoplifting: 0,
        mugging: 0,
        burglary: 0,
        carTheft: 0,
        fraud: 0,
        hacking: 0,
        heist: 0,
      },

      // Risk tolerance (0-100)
      riskTolerance: 50,
      riskDataPoints: 0,

      // Response length preference (short, medium, long)
      responseLengthPreference: 'medium',
      responseLengthScores: { short: 0, medium: 0, long: 0 },

      // Communication style
      prefersFormalStyle: false,
      prefersSlang: true,
      prefersEmoji: false,

      // Play patterns
      playPatterns: {
        sessions: [],
        totalPlayTime: 0,
        averageSessionLength: 0,
        preferredTimeOfDay: null,
        weekdayVsWeekend: { weekday: 0, weekend: 0 },
      },

      // Feature usage tracking
      featureUsage: {
        askCommands: 0,
        crimeCommands: 0,
        jobCommands: 0,
        bankCommands: 0,
        statusChecks: 0,
        helpRequests: 0,
      },

      // Question patterns
      questionPatterns: {
        howTo: 0,
        whatIs: 0,
        crimeAdvice: 0,
        moneyAdvice: 0,
        statusQueries: 0,
      },

      // Last updated
      lastUpdated: Date.now(),
      dataVersion: 1,
    }
  }

  /**
   * Save preferences to localStorage
   */
  savePreferences() {
    try {
      this.preferences.lastUpdated = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences))
    } catch (e) {
      console.warn('[UserPreferenceLearner] Failed to save preferences:', e)
    }
  }

  /**
   * Record a crime being committed
   */
  recordCrime(crimeType, succeeded, heatBefore) {
    // Normalize crime type
    const normalizedType = this.normalizeCrimeType(crimeType)
    if (!normalizedType) return

    // Decay existing preferences
    this.decayPreferences('crimePreferences')

    // Increase preference for this crime type
    const weight = succeeded ? 1.5 : 0.5  // Success weighs more
    this.preferences.crimePreferences[normalizedType] =
      (this.preferences.crimePreferences[normalizedType] || 0) + weight

    // Update risk tolerance based on heat level when committing crime
    this.updateRiskTolerance(heatBefore)

    this.savePreferences()
  }

  /**
   * Normalize crime type to standard key
   */
  normalizeCrimeType(crimeType) {
    const normalized = crimeType.toLowerCase().replace(/[^a-z]/g, '')

    const typeMap = {
      pickpocket: 'pickpocket',
      pickpocketing: 'pickpocket',
      shoplifting: 'shoplifting',
      shoplift: 'shoplifting',
      mugging: 'mugging',
      mug: 'mugging',
      burglary: 'burglary',
      burgle: 'burglary',
      cartheft: 'carTheft',
      car: 'carTheft',
      fraud: 'fraud',
      scam: 'fraud',
      hacking: 'hacking',
      hack: 'hacking',
      cyber: 'hacking',
      heist: 'heist',
      robbery: 'heist',
    }

    return typeMap[normalized] || null
  }

  /**
   * Update risk tolerance based on player behavior
   */
  updateRiskTolerance(heatLevel) {
    // Players who commit crimes at high heat are risk-tolerant
    const riskScore = heatLevel / 100 * 100  // Convert to 0-100 scale

    // Weighted average with existing tolerance
    const dataPoints = this.preferences.riskDataPoints || 0
    const currentTolerance = this.preferences.riskTolerance || 50

    this.preferences.riskTolerance =
      (currentTolerance * dataPoints + riskScore) / (dataPoints + 1)
    this.preferences.riskDataPoints = dataPoints + 1

    this.savePreferences()
  }

  /**
   * Get the player's preferred crime types (top 3)
   */
  getPreferredCrimes() {
    const crimes = Object.entries(this.preferences.crimePreferences)
      .filter(([_, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type)

    return crimes
  }

  /**
   * Check if player prefers a certain crime type
   */
  prefersCrimeType(crimeType) {
    const normalized = this.normalizeCrimeType(crimeType)
    if (!normalized) return false

    const preferred = this.getPreferredCrimes()
    return preferred.includes(normalized)
  }

  /**
   * Record response interaction (did user seem satisfied?)
   */
  recordResponseInteraction(responseLength, followedUp, askedForMore) {
    // Determine which length bucket this falls into
    let lengthCategory
    if (responseLength < 100) {
      lengthCategory = 'short'
    } else if (responseLength < 300) {
      lengthCategory = 'medium'
    } else {
      lengthCategory = 'long'
    }

    // If they asked for more, they wanted longer
    // If they immediately moved on, length was fine or too long
    if (askedForMore) {
      this.preferences.responseLengthScores.long =
        (this.preferences.responseLengthScores.long || 0) + 1
    } else if (followedUp) {
      // Following up means engaged - current length is good
      this.preferences.responseLengthScores[lengthCategory] =
        (this.preferences.responseLengthScores[lengthCategory] || 0) + 1
    }

    // Update preference based on scores
    const scores = this.preferences.responseLengthScores
    if (scores.long > scores.medium && scores.long > scores.short) {
      this.preferences.responseLengthPreference = 'long'
    } else if (scores.short > scores.medium && scores.short > scores.long) {
      this.preferences.responseLengthPreference = 'short'
    } else {
      this.preferences.responseLengthPreference = 'medium'
    }

    this.savePreferences()
  }

  /**
   * Get preferred response length
   */
  getPreferredResponseLength() {
    return this.preferences.responseLengthPreference || 'medium'
  }

  /**
   * Record session start
   */
  recordSessionStart() {
    const now = Date.now()
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    // Track time of day preference
    const timeOfDay = hour < 6 ? 'night' :
      hour < 12 ? 'morning' :
      hour < 18 ? 'afternoon' : 'evening'

    // Track weekday vs weekend
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Store session start
    this.currentSessionStart = now
    this.preferences.playPatterns.lastTimeOfDay = timeOfDay

    if (isWeekend) {
      this.preferences.playPatterns.weekdayVsWeekend.weekend++
    } else {
      this.preferences.playPatterns.weekdayVsWeekend.weekday++
    }

    this.savePreferences()
  }

  /**
   * Record session end
   */
  recordSessionEnd() {
    if (!this.currentSessionStart) return

    const sessionLength = Date.now() - this.currentSessionStart
    const sessions = this.preferences.playPatterns.sessions || []

    // Keep last 20 sessions
    sessions.push({
      start: this.currentSessionStart,
      length: sessionLength,
      timeOfDay: this.preferences.playPatterns.lastTimeOfDay,
    })

    if (sessions.length > 20) {
      sessions.shift()
    }

    // Update averages
    this.preferences.playPatterns.sessions = sessions
    this.preferences.playPatterns.totalPlayTime += sessionLength
    this.preferences.playPatterns.averageSessionLength =
      sessions.reduce((sum, s) => sum + s.length, 0) / sessions.length

    // Determine preferred time of day
    const timeFrequency = {}
    sessions.forEach(s => {
      timeFrequency[s.timeOfDay] = (timeFrequency[s.timeOfDay] || 0) + 1
    })
    const preferredTime = Object.entries(timeFrequency)
      .sort(([, a], [, b]) => b - a)[0]
    if (preferredTime) {
      this.preferences.playPatterns.preferredTimeOfDay = preferredTime[0]
    }

    this.currentSessionStart = null
    this.savePreferences()
  }

  /**
   * Record feature usage
   */
  recordFeatureUsage(feature) {
    const featureMap = {
      ask: 'askCommands',
      crime: 'crimeCommands',
      job: 'jobCommands',
      bank: 'bankCommands',
      status: 'statusChecks',
      help: 'helpRequests',
    }

    const key = featureMap[feature]
    if (key) {
      this.preferences.featureUsage[key] =
        (this.preferences.featureUsage[key] || 0) + 1
      this.savePreferences()
    }
  }

  /**
   * Record question type
   */
  recordQuestionType(questionType) {
    const key = questionType
    if (this.preferences.questionPatterns[key] !== undefined) {
      this.preferences.questionPatterns[key]++
      this.savePreferences()
    }
  }

  /**
   * Get player profile summary
   */
  getPlayerProfile() {
    const prefs = this.preferences

    return {
      // Crime style
      preferredCrimes: this.getPreferredCrimes(),
      riskTolerance: Math.round(prefs.riskTolerance),
      riskLevel: prefs.riskTolerance > 70 ? 'high' :
        prefs.riskTolerance > 40 ? 'medium' : 'low',

      // Communication
      preferredResponseLength: prefs.responseLengthPreference,

      // Play patterns
      preferredTimeOfDay: prefs.playPatterns.preferredTimeOfDay,
      averageSessionMinutes: Math.round(prefs.playPatterns.averageSessionLength / 60000),
      prefersWeekends: prefs.playPatterns.weekdayVsWeekend.weekend >
        prefs.playPatterns.weekdayVsWeekend.weekday,

      // Most used features
      topFeatures: Object.entries(prefs.featureUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([feature]) => feature),

      // Question style
      mostCommonQuestions: Object.entries(prefs.questionPatterns)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([type]) => type),
    }
  }

  /**
   * Decay preference weights over time
   */
  decayPreferences(category) {
    const prefs = this.preferences[category]
    if (!prefs || typeof prefs !== 'object') return

    for (const key of Object.keys(prefs)) {
      if (typeof prefs[key] === 'number') {
        prefs[key] *= DECAY_FACTOR
        // Remove negligible weights
        if (prefs[key] < 0.01) {
          prefs[key] = 0
        }
      }
    }
  }

  /**
   * Get recommendation adjustments based on preferences
   */
  getRecommendationAdjustments() {
    const profile = this.getPlayerProfile()

    return {
      // Prioritize preferred crime types in recommendations
      preferredCrimes: profile.preferredCrimes,

      // Adjust risk in recommendations
      shouldSuggestRisky: profile.riskLevel === 'high',
      shouldSuggestSafe: profile.riskLevel === 'low',

      // Response formatting
      useShortResponses: profile.preferredResponseLength === 'short',
      useDetailedResponses: profile.preferredResponseLength === 'long',
    }
  }

  /**
   * Reset all preferences
   */
  reset() {
    localStorage.removeItem(STORAGE_KEY)
    this.preferences = this.loadPreferences()
  }

  /**
   * Get raw preferences (for debugging)
   */
  getRawPreferences() {
    return { ...this.preferences }
  }
}

// Export singleton
export const userPreferenceLearner = new UserPreferenceLearnerClass()
export default userPreferenceLearner
