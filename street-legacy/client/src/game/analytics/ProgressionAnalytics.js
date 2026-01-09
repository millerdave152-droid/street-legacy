/**
 * ProgressionAnalytics - Client-side progression event tracking
 *
 * Tracks player progression events, buffers them, and sends to server.
 * Used to identify where players stall and optimize the game experience.
 */

import { gameManager } from '../GameManager.js'
import { wsService } from '../../services/websocket.service.js'

// Event types
export const ANALYTICS_EVENTS = {
  // Crime events
  CRIME_ATTEMPTED: 'CRIME_ATTEMPTED',
  CRIME_COMPLETED: 'CRIME_COMPLETED',
  CRIME_FAILED: 'CRIME_FAILED',

  // Heist events
  HEIST_STARTED: 'HEIST_STARTED',
  HEIST_COMPLETED: 'HEIST_COMPLETED',
  HEIST_FAILED: 'HEIST_FAILED',

  // Progression events
  LEVEL_UP: 'LEVEL_UP',
  QUEST_COMPLETED: 'QUEST_COMPLETED',
  MILESTONE_REACHED: 'MILESTONE_REACHED',
  BAND_TRANSITION: 'BAND_TRANSITION',

  // Economy events
  PROPERTY_PURCHASED: 'PROPERTY_PURCHASED',
  CREW_HIRED: 'CREW_HIRED',
  BANK_DEPOSIT: 'BANK_DEPOSIT',

  // Session events
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
}

class ProgressionAnalytics {
  constructor() {
    this.buffer = []
    this.flushInterval = 30000 // 30 seconds
    this.maxBufferSize = 50
    this.isInitialized = false
    this.sessionId = null
    this.sessionStartTime = null
    this.unsubscribers = []
    this.flushTimer = null
  }

  /**
   * Initialize analytics tracking
   */
  initialize() {
    if (this.isInitialized) return

    this.sessionId = this.generateSessionId()
    this.sessionStartTime = Date.now()

    this.setupListeners()
    this.startFlushTimer()

    // Track session start
    this.track(ANALYTICS_EVENTS.SESSION_START, {
      sessionId: this.sessionId,
    })

    // Track session end on page unload
    window.addEventListener('beforeunload', () => {
      this.track(ANALYTICS_EVENTS.SESSION_END, {
        sessionId: this.sessionId,
        duration: Date.now() - this.sessionStartTime,
      })
      this.flush(true) // Synchronous flush on exit
    })

    this.isInitialized = true
    console.log('[ProgressionAnalytics] Initialized, session:', this.sessionId)
  }

  /**
   * Shutdown analytics
   */
  shutdown() {
    this.unsubscribers.forEach(unsub => unsub())
    this.unsubscribers = []

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    this.flush()
    this.isInitialized = false
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Setup event listeners
   */
  setupListeners() {
    if (!gameManager.on) return

    // Crime events
    const unsubCrime = gameManager.on('crimeCompleted', (data) => {
      this.track(ANALYTICS_EVENTS.CRIME_COMPLETED, {
        crimeId: data.crimeId || data.crime?.id,
        payout: data.payout || data.result?.payout,
        xpGained: data.xpGained || data.result?.xpGained,
      })
    })
    this.unsubscribers.push(unsubCrime)

    const unsubCrimeFail = gameManager.on('crimeFailed', (data) => {
      this.track(ANALYTICS_EVENTS.CRIME_FAILED, {
        crimeId: data.crimeId || data.crime?.id,
        reason: data.reason,
      })
    })
    this.unsubscribers.push(unsubCrimeFail)

    // Heist events
    const unsubHeistStart = gameManager.on('heistStarted', (data) => {
      this.track(ANALYTICS_EVENTS.HEIST_STARTED, {
        heistId: data.heistId,
      })
    })
    this.unsubscribers.push(unsubHeistStart)

    const unsubHeist = gameManager.on('heistCompleted', (data) => {
      this.track(ANALYTICS_EVENTS.HEIST_COMPLETED, {
        heistId: data.heistId,
        payout: data.payout,
        success: data.success,
      })
    })
    this.unsubscribers.push(unsubHeist)

    // Level up
    const unsubLevel = gameManager.on('levelUp', (data) => {
      this.track(ANALYTICS_EVENTS.LEVEL_UP, {
        newLevel: data.newLevel || data.level,
        oldLevel: data.oldLevel,
      })
    })
    this.unsubscribers.push(unsubLevel)

    // Quest completed
    const unsubQuest = gameManager.on('questCompleted', (data) => {
      this.track(ANALYTICS_EVENTS.QUEST_COMPLETED, {
        questId: data.questId,
        nextQuest: data.nextQuest,
      })
    })
    this.unsubscribers.push(unsubQuest)

    // Property purchased
    const unsubProperty = gameManager.on('propertyPurchased', (data) => {
      this.track(ANALYTICS_EVENTS.PROPERTY_PURCHASED, {
        propertyId: data.propertyId || data.id,
        cost: data.cost || data.price,
      })
    })
    this.unsubscribers.push(unsubProperty)

    // Crew hired
    const unsubCrew = gameManager.on('crewHired', (data) => {
      this.track(ANALYTICS_EVENTS.CREW_HIRED, {
        memberId: data.memberId || data.id,
      })
    })
    this.unsubscribers.push(unsubCrew)

    // Bank deposit
    const unsubBank = gameManager.on('bankDeposit', (data) => {
      this.track(ANALYTICS_EVENTS.BANK_DEPOSIT, {
        amount: data.amount,
      })
    })
    this.unsubscribers.push(unsubBank)
  }

  /**
   * Get current player band
   */
  getCurrentBand() {
    const level = gameManager.player?.level || 1
    if (level <= 10) return 'EARLY'
    if (level <= 25) return 'MID'
    return 'LATE'
  }

  /**
   * Track an analytics event
   */
  track(eventType, data = {}) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      level: gameManager.player?.level || 1,
      band: this.getCurrentBand(),
      ...this.sanitize(data),
    }

    this.buffer.push(event)

    // Immediate flush for important events
    const immediateEvents = [
      ANALYTICS_EVENTS.LEVEL_UP,
      ANALYTICS_EVENTS.QUEST_COMPLETED,
      ANALYTICS_EVENTS.HEIST_COMPLETED,
      ANALYTICS_EVENTS.BAND_TRANSITION,
    ]

    if (immediateEvents.includes(eventType)) {
      this.flush()
    }

    // Flush if buffer is getting large
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush()
    }
  }

  /**
   * Sanitize event data (remove sensitive fields)
   */
  sanitize(data) {
    const { password, token, authToken, ...safe } = data
    return safe
  }

  /**
   * Start periodic flush timer
   */
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * Flush buffered events to server
   */
  async flush(synchronous = false) {
    if (this.buffer.length === 0) return

    const events = [...this.buffer]
    this.buffer = []

    try {
      // Send via WebSocket if connected
      if (wsService.isConnected && wsService.isConnected()) {
        wsService.send({
          type: 'analytics:progression_events',
          events,
        })
      } else {
        // Fallback: Store locally for later sync
        this.storeLocally(events)
      }
    } catch (err) {
      // Re-add to buffer on failure
      this.buffer = [...events, ...this.buffer].slice(0, this.maxBufferSize * 2)
      console.warn('[ProgressionAnalytics] Flush failed, will retry:', err)
    }
  }

  /**
   * Store events locally for later sync
   */
  storeLocally(events) {
    try {
      const key = 'streetLegacy_analyticsBuffer'
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      const combined = [...existing, ...events].slice(-100) // Keep last 100
      localStorage.setItem(key, JSON.stringify(combined))
    } catch (e) {
      console.warn('[ProgressionAnalytics] Local storage failed:', e)
    }
  }

  /**
   * Sync locally stored events on reconnection
   */
  syncLocalEvents() {
    try {
      const key = 'streetLegacy_analyticsBuffer'
      const events = JSON.parse(localStorage.getItem(key) || '[]')

      if (events.length > 0 && wsService.isConnected && wsService.isConnected()) {
        wsService.send({
          type: 'analytics:progression_events',
          events,
        })
        localStorage.removeItem(key)
        console.log('[ProgressionAnalytics] Synced', events.length, 'local events')
      }
    } catch (e) {
      console.warn('[ProgressionAnalytics] Local sync failed:', e)
    }
  }

  /**
   * Get analytics status for debugging
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      sessionId: this.sessionId,
      bufferSize: this.buffer.length,
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
    }
  }
}

// Singleton instance
export const progressionAnalytics = new ProgressionAnalytics()

export default progressionAnalytics
