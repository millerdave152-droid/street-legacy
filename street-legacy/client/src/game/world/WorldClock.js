/**
 * WorldClock - Phase 22: Time-Based World Events
 *
 * Manages game world time and time-based modifiers.
 *
 * Features:
 * - Day/night cycle affecting gameplay
 * - Scheduled events (weekly markets, monthly events)
 * - Time modifiers for crimes and activities
 * - Seasonal patterns
 */

// Time periods
export const TIME_PERIODS = {
  DAWN: 'dawn',         // 5-7 AM
  MORNING: 'morning',   // 7-12 PM
  AFTERNOON: 'afternoon', // 12-6 PM
  EVENING: 'evening',   // 6-9 PM
  NIGHT: 'night',       // 9 PM - 12 AM
  LATE_NIGHT: 'late_night', // 12-5 AM
}

// Days of week
export const DAYS = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
}

// Time modifiers
const TIME_MODIFIERS = {
  [TIME_PERIODS.DAWN]: {
    crimeSuccess: 0.9,
    policePresence: 0.7,
    witnessChance: 0.5,
    trafficLevel: 0.4,
    npcActivity: 0.3,
  },
  [TIME_PERIODS.MORNING]: {
    crimeSuccess: 0.8,
    policePresence: 1.0,
    witnessChance: 1.2,
    trafficLevel: 1.0,
    npcActivity: 0.8,
  },
  [TIME_PERIODS.AFTERNOON]: {
    crimeSuccess: 0.85,
    policePresence: 1.1,
    witnessChance: 1.3,
    trafficLevel: 1.2,
    npcActivity: 1.0,
  },
  [TIME_PERIODS.EVENING]: {
    crimeSuccess: 0.95,
    policePresence: 0.9,
    witnessChance: 1.0,
    trafficLevel: 1.1,
    npcActivity: 1.2,
  },
  [TIME_PERIODS.NIGHT]: {
    crimeSuccess: 1.1,
    policePresence: 0.8,
    witnessChance: 0.6,
    trafficLevel: 0.6,
    npcActivity: 1.3,
  },
  [TIME_PERIODS.LATE_NIGHT]: {
    crimeSuccess: 1.2,
    policePresence: 0.6,
    witnessChance: 0.3,
    trafficLevel: 0.2,
    npcActivity: 0.5,
  },
}

// Weekend modifiers (stack with time modifiers)
const WEEKEND_MODIFIERS = {
  crimeSuccess: 1.05,
  policePresence: 0.85,
  witnessChance: 0.9,
  npcActivity: 1.2,
  marketActivity: 1.3,
}

// Scheduled events
const SCHEDULED_EVENTS = {
  weekly: [
    {
      name: 'Underground Market',
      day: DAYS.FRIDAY,
      time: TIME_PERIODS.NIGHT,
      effects: { marketPrices: 0.85, rareItemChance: 1.5 },
    },
    {
      name: 'Police Patrol Day',
      day: DAYS.MONDAY,
      time: TIME_PERIODS.MORNING,
      effects: { policePresence: 1.5, arrestChance: 1.3 },
    },
    {
      name: 'Street Racing',
      day: DAYS.SATURDAY,
      time: TIME_PERIODS.LATE_NIGHT,
      effects: { carTheftValue: 1.3, policePresence: 0.7 },
    },
  ],
  monthly: [
    {
      name: 'Rent Day',
      dayOfMonth: 1,
      effects: { cashDrain: true, npcMoodDown: true },
    },
    {
      name: 'Big Game Night',
      dayOfMonth: 15,
      effects: { distractionHigh: true, burglarySuccess: 1.2 },
    },
  ],
}

/**
 * WorldClock class
 */
class WorldClockClass {
  constructor() {
    this.timeMultiplier = 60  // 1 real second = 1 game minute
    this.baseTime = Date.now()
    this.gameStartTime = new Date()
    this.gameStartTime.setHours(8, 0, 0, 0)  // Start at 8 AM

    this.activeEvents = []
    this.listeners = []
    this.intervalId = null
  }

  /**
   * Initialize the world clock
   */
  initialize() {
    // Update every game minute (every real second)
    this.intervalId = setInterval(() => {
      this.update()
    }, 1000)

    console.log('[WorldClock] Initialized')
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Get current game time
   */
  getGameTime() {
    const elapsed = Date.now() - this.baseTime
    const gameElapsed = elapsed * this.timeMultiplier / 1000  // Convert to game seconds

    const gameDate = new Date(this.gameStartTime.getTime() + gameElapsed * 1000)

    return {
      date: gameDate,
      hour: gameDate.getHours(),
      minute: gameDate.getMinutes(),
      dayOfWeek: gameDate.getDay(),
      dayOfMonth: gameDate.getDate(),
      month: gameDate.getMonth(),
      formatted: this.formatTime(gameDate),
      period: this.getTimePeriod(gameDate.getHours()),
      isWeekend: gameDate.getDay() === 0 || gameDate.getDay() === 6,
    }
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHour = hours % 12 || 12

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${days[date.getDay()]} ${displayHour}:${minutes} ${ampm}`
  }

  /**
   * Get time period from hour
   */
  getTimePeriod(hour) {
    if (hour >= 5 && hour < 7) return TIME_PERIODS.DAWN
    if (hour >= 7 && hour < 12) return TIME_PERIODS.MORNING
    if (hour >= 12 && hour < 18) return TIME_PERIODS.AFTERNOON
    if (hour >= 18 && hour < 21) return TIME_PERIODS.EVENING
    if (hour >= 21 || hour < 0) return TIME_PERIODS.NIGHT
    return TIME_PERIODS.LATE_NIGHT
  }

  /**
   * Get current modifiers
   */
  getModifiers() {
    const time = this.getGameTime()
    const periodMods = TIME_MODIFIERS[time.period] || {}
    const modifiers = { ...periodMods }

    // Apply weekend modifiers
    if (time.isWeekend) {
      for (const [key, value] of Object.entries(WEEKEND_MODIFIERS)) {
        modifiers[key] = (modifiers[key] || 1) * value
      }
    }

    // Apply active event modifiers
    for (const event of this.activeEvents) {
      for (const [key, value] of Object.entries(event.effects)) {
        modifiers[key] = (modifiers[key] || 1) * value
      }
    }

    return modifiers
  }

  /**
   * Get modifier for specific stat
   */
  getModifier(stat) {
    const modifiers = this.getModifiers()
    return modifiers[stat] || 1
  }

  /**
   * Update - check for events, notify listeners
   */
  update() {
    const time = this.getGameTime()

    // Check for scheduled events
    this.checkScheduledEvents(time)

    // Notify listeners
    for (const listener of this.listeners) {
      listener(time)
    }
  }

  /**
   * Check if any scheduled events should activate
   */
  checkScheduledEvents(time) {
    // Weekly events
    for (const event of SCHEDULED_EVENTS.weekly) {
      if (time.dayOfWeek === event.day && time.period === event.time) {
        if (!this.isEventActive(event.name)) {
          this.activateEvent(event)
        }
      } else {
        this.deactivateEvent(event.name)
      }
    }

    // Monthly events
    for (const event of SCHEDULED_EVENTS.monthly) {
      if (time.dayOfMonth === event.dayOfMonth) {
        if (!this.isEventActive(event.name)) {
          this.activateEvent(event)
        }
      } else {
        this.deactivateEvent(event.name)
      }
    }
  }

  /**
   * Check if an event is currently active
   */
  isEventActive(eventName) {
    return this.activeEvents.some(e => e.name === eventName)
  }

  /**
   * Activate a scheduled event
   */
  activateEvent(event) {
    this.activeEvents.push(event)
    console.log(`[WorldClock] Event activated: ${event.name}`)

    const customEvent = new CustomEvent('world_event_start', { detail: event })
    window.dispatchEvent(customEvent)
  }

  /**
   * Deactivate an event
   */
  deactivateEvent(eventName) {
    const index = this.activeEvents.findIndex(e => e.name === eventName)
    if (index !== -1) {
      const event = this.activeEvents[index]
      this.activeEvents.splice(index, 1)
      console.log(`[WorldClock] Event ended: ${eventName}`)

      const customEvent = new CustomEvent('world_event_end', { detail: event })
      window.dispatchEvent(customEvent)
    }
  }

  /**
   * Add time listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * Skip time (for testing)
   */
  skipTime(hours) {
    const skipMs = (hours * 3600 * 1000) / this.timeMultiplier
    this.baseTime -= skipMs
  }

  /**
   * Get active events
   */
  getActiveEvents() {
    return [...this.activeEvents]
  }

  /**
   * Get world status summary
   */
  getStatus() {
    const time = this.getGameTime()
    return {
      time: time.formatted,
      period: time.period,
      isWeekend: time.isWeekend,
      activeEvents: this.activeEvents.map(e => e.name),
      modifiers: this.getModifiers(),
    }
  }
}

// Export singleton
export const worldClock = new WorldClockClass()
export default worldClock
