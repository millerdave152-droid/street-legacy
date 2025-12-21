/**
 * OpportunityScheduler - Smart timing and anti-spam for opportunities
 *
 * Controls when opportunities can be generated:
 * - Minimum gaps between any opportunities
 * - Per-category cooldowns
 * - Maximum opportunities per hour
 * - Context modifiers (heat, level, recent activity)
 */

import { gameManager } from '../GameManager'

// Cooldown settings (in milliseconds)
const COOLDOWNS = {
  // Minimum time between ANY opportunities
  global: 60 * 1000, // 1 minute

  // Per-type cooldowns
  npc_job: 3 * 60 * 1000,      // 3 minutes
  trade_deal: 5 * 60 * 1000,   // 5 minutes
  alliance: 15 * 60 * 1000,    // 15 minutes
  adventure: 10 * 60 * 1000,   // 10 minutes
  intel: 8 * 60 * 1000,        // 8 minutes
  favor: 12 * 60 * 1000,       // 12 minutes
}

// Rate limits
const RATE_LIMITS = {
  perHour: 8,           // Max opportunities per hour
  perSession: 50,       // Max opportunities per session
}

// Context modifiers (multiply cooldowns)
const CONTEXT_MODIFIERS = {
  // Heat levels affect opportunity frequency
  heat: {
    low: 0.8,      // Low heat = opportunities come faster
    medium: 1.0,   // Normal
    high: 1.5,     // High heat = slower (laying low)
    critical: 2.5, // Critical heat = very slow
  },

  // Level affects frequency
  level: {
    beginner: 1.2,    // Levels 1-5: slightly slower
    intermediate: 1.0, // Levels 6-15: normal
    advanced: 0.8,    // Levels 16-25: faster
    veteran: 0.6,     // Levels 26+: much faster
  },

  // Recent success affects frequency
  recentSuccess: 0.7,  // Just completed a job = faster
  recentFailure: 1.3,  // Just failed = slower
}

class OpportunitySchedulerClass {
  constructor() {
    this.lastOpportunityTime = 0
    this.lastOpportunityByType = new Map()
    this.opportunitiesThisHour = 0
    this.opportunitiesThisSession = 0
    this.hourlyResetTime = Date.now()

    this.initialized = false
  }

  /**
   * Initialize scheduler
   */
  initialize() {
    if (this.initialized) return

    // Load saved state
    this.loadState()

    // Reset hourly counter if needed
    this.checkHourlyReset()

    this.initialized = true
    console.log('[OpportunityScheduler] Initialized')
  }

  /**
   * Check if we can generate a new opportunity of a given type
   */
  canGenerateOpportunity(type = 'npc_job') {
    // Check hourly reset
    this.checkHourlyReset()

    // Check rate limits
    if (this.opportunitiesThisHour >= RATE_LIMITS.perHour) {
      console.log('[OpportunityScheduler] Hourly limit reached')
      return false
    }

    if (this.opportunitiesThisSession >= RATE_LIMITS.perSession) {
      console.log('[OpportunityScheduler] Session limit reached')
      return false
    }

    const now = Date.now()
    const contextMod = this.getContextModifier()

    // Check global cooldown
    const globalCooldown = COOLDOWNS.global * contextMod
    if (now - this.lastOpportunityTime < globalCooldown) {
      return false
    }

    // Check type-specific cooldown
    const typeCooldown = (COOLDOWNS[type] || COOLDOWNS.npc_job) * contextMod
    const lastOfType = this.lastOpportunityByType.get(type) || 0
    if (now - lastOfType < typeCooldown) {
      return false
    }

    return true
  }

  /**
   * Get time until next opportunity is allowed
   */
  getTimeUntilNextOpportunity(type = 'npc_job') {
    this.checkHourlyReset()

    const now = Date.now()
    const contextMod = this.getContextModifier()

    // Global cooldown remaining
    const globalCooldown = COOLDOWNS.global * contextMod
    const globalRemaining = Math.max(0, (this.lastOpportunityTime + globalCooldown) - now)

    // Type cooldown remaining
    const typeCooldown = (COOLDOWNS[type] || COOLDOWNS.npc_job) * contextMod
    const lastOfType = this.lastOpportunityByType.get(type) || 0
    const typeRemaining = Math.max(0, (lastOfType + typeCooldown) - now)

    // Return the longer wait
    return Math.max(globalRemaining, typeRemaining)
  }

  /**
   * Record that an opportunity was generated
   */
  recordOpportunity(type) {
    const now = Date.now()
    this.lastOpportunityTime = now
    this.lastOpportunityByType.set(type, now)
    this.opportunitiesThisHour++
    this.opportunitiesThisSession++
    this.saveState()
  }

  /**
   * Get context-based cooldown modifier
   */
  getContextModifier() {
    const player = gameManager.player
    if (!player) return 1.0

    let modifier = 1.0

    // Heat modifier
    const heat = player.heat || 0
    if (heat >= 80) {
      modifier *= CONTEXT_MODIFIERS.heat.critical
    } else if (heat >= 50) {
      modifier *= CONTEXT_MODIFIERS.heat.high
    } else if (heat >= 20) {
      modifier *= CONTEXT_MODIFIERS.heat.medium
    } else {
      modifier *= CONTEXT_MODIFIERS.heat.low
    }

    // Level modifier
    const level = player.level || 1
    if (level >= 26) {
      modifier *= CONTEXT_MODIFIERS.level.veteran
    } else if (level >= 16) {
      modifier *= CONTEXT_MODIFIERS.level.advanced
    } else if (level >= 6) {
      modifier *= CONTEXT_MODIFIERS.level.intermediate
    } else {
      modifier *= CONTEXT_MODIFIERS.level.beginner
    }

    return modifier
  }

  /**
   * Apply success modifier (call after completing a job)
   */
  applySuccessModifier() {
    // Temporarily reduce cooldowns after success
    this.tempModifier = CONTEXT_MODIFIERS.recentSuccess
    this.tempModifierExpiry = Date.now() + 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Apply failure modifier (call after failing a job)
   */
  applyFailureModifier() {
    // Temporarily increase cooldowns after failure
    this.tempModifier = CONTEXT_MODIFIERS.recentFailure
    this.tempModifierExpiry = Date.now() + 10 * 60 * 1000 // 10 minutes
  }

  /**
   * Check and reset hourly counter
   */
  checkHourlyReset() {
    const now = Date.now()
    const hourInMs = 60 * 60 * 1000

    if (now - this.hourlyResetTime >= hourInMs) {
      this.opportunitiesThisHour = 0
      this.hourlyResetTime = now
      console.log('[OpportunityScheduler] Hourly counter reset')
    }
  }

  /**
   * Get remaining capacity this hour
   */
  getRemainingCapacity() {
    this.checkHourlyReset()
    return {
      thisHour: RATE_LIMITS.perHour - this.opportunitiesThisHour,
      thisSession: RATE_LIMITS.perSession - this.opportunitiesThisSession,
    }
  }

  /**
   * Schedule an opportunity for a specific time in the future
   */
  scheduleOpportunity(callback, delayMs, type = 'npc_job') {
    // Add some randomness
    const jitter = Math.random() * 0.3 * delayMs // +/- 30% jitter
    const actualDelay = delayMs + jitter - (0.15 * delayMs)

    return setTimeout(() => {
      if (this.canGenerateOpportunity(type)) {
        callback()
      }
    }, actualDelay)
  }

  /**
   * Get optimal time to show next opportunity
   */
  getOptimalNextTime(type = 'npc_job') {
    const minWait = this.getTimeUntilNextOpportunity(type)

    // Add some variance based on player engagement
    const player = gameManager.player
    const baseDelay = minWait + 30000 // 30 second buffer

    // If player is active (low energy), show opportunities sooner
    if (player && player.energy < 30) {
      return baseDelay + Math.random() * 60000 // Extra 0-1 minute
    }

    // Normal variance
    return baseDelay + Math.random() * 120000 // Extra 0-2 minutes
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {
        lastOpportunityTime: this.lastOpportunityTime,
        lastOpportunityByType: Array.from(this.lastOpportunityByType.entries()),
        opportunitiesThisHour: this.opportunitiesThisHour,
        hourlyResetTime: this.hourlyResetTime,
      }
      localStorage.setItem('street_legacy_opp_scheduler', JSON.stringify(state))
    } catch (e) {
      // Ignore save errors
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem('street_legacy_opp_scheduler')
      if (saved) {
        const state = JSON.parse(saved)
        this.lastOpportunityTime = state.lastOpportunityTime || 0
        this.lastOpportunityByType = new Map(state.lastOpportunityByType || [])
        this.opportunitiesThisHour = state.opportunitiesThisHour || 0
        this.hourlyResetTime = state.hourlyResetTime || Date.now()
      }
    } catch (e) {
      // Ignore load errors
    }
  }

  /**
   * Reset all cooldowns (for testing)
   */
  resetCooldowns() {
    this.lastOpportunityTime = 0
    this.lastOpportunityByType.clear()
    this.saveState()
  }

  /**
   * Reset session (call on new game session)
   */
  resetSession() {
    this.opportunitiesThisSession = 0
    this.resetCooldowns()
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      lastOpportunity: this.lastOpportunityTime,
      opportunitiesThisHour: this.opportunitiesThisHour,
      opportunitiesThisSession: this.opportunitiesThisSession,
      contextModifier: this.getContextModifier(),
      capacity: this.getRemainingCapacity(),
    }
  }
}

// Singleton export
export const opportunityScheduler = new OpportunitySchedulerClass()
export default opportunityScheduler
