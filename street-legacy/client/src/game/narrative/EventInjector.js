/**
 * EventInjector - Phase 18: Unpredictable Event Injection
 *
 * Random events that disrupt plans and create emergent stories.
 *
 * Event Categories:
 * - WINDFALL: Unexpected money/opportunity
 * - CRISIS: Sudden problem
 * - REVELATION: Hidden information revealed
 * - TWIST: Belief proven wrong
 * - ENCOUNTER: Forced NPC interaction
 *
 * Balance: Max 1 major disruption per session
 */

import { narrativeState, STORY_ARCS } from './NarrativeState'
import { messageQueue, PRIORITY, MESSAGE_TYPES } from '../terminal/MessageQueue'

// Event categories
export const EVENT_CATEGORIES = {
  WINDFALL: 'windfall',
  CRISIS: 'crisis',
  REVELATION: 'revelation',
  TWIST: 'twist',
  ENCOUNTER: 'encounter',
}

// Event severity
export const EVENT_SEVERITY = {
  MINOR: 'minor',
  MODERATE: 'moderate',
  MAJOR: 'major',
}

// Event templates
const EVENT_TEMPLATES = {
  // Windfall events - good surprises
  lucky_find: {
    category: EVENT_CATEGORIES.WINDFALL,
    severity: EVENT_SEVERITY.MINOR,
    name: 'Lucky Find',
    message: "You stumble across a hidden stash. Someone's loss is your gain.",
    effects: [{ type: 'cash', value: { min: 200, max: 1000 } }],
    weight: 10,
  },

  anonymous_benefactor: {
    category: EVENT_CATEGORIES.WINDFALL,
    severity: EVENT_SEVERITY.MODERATE,
    name: 'Anonymous Benefactor',
    message: "A mysterious message arrives: 'For services rendered.' An envelope of cash is waiting.",
    effects: [{ type: 'cash', value: { min: 1000, max: 5000 } }],
    conditions: { minLevel: 10 },
    weight: 5,
  },

  inheritance: {
    category: EVENT_CATEGORIES.WINDFALL,
    severity: EVENT_SEVERITY.MAJOR,
    name: 'Unexpected Inheritance',
    message: "A distant relative you never knew you had has passed. You're the sole heir.",
    effects: [
      { type: 'cash', value: { min: 10000, max: 25000 } },
      { type: 'property', value: 'random' },
    ],
    conditions: { minLevel: 20 },
    weight: 1,
    oncePerSession: true,
  },

  // Crisis events - problems
  mugged: {
    category: EVENT_CATEGORIES.CRISIS,
    severity: EVENT_SEVERITY.MINOR,
    name: 'Mugged',
    message: "Wrong place, wrong time. Someone got the drop on you.",
    effects: [
      { type: 'cash', value: { percentage: -20 } },
      { type: 'health', value: -10 },
    ],
    conditions: { inDistrict: ['downtown', 'scarborough'] },
    weight: 8,
  },

  betrayed_contact: {
    category: EVENT_CATEGORIES.CRISIS,
    severity: EVENT_SEVERITY.MODERATE,
    name: 'Betrayed by a Contact',
    message: "Someone you trusted sold information about you. Your heat just spiked.",
    effects: [
      { type: 'heat', value: 30 },
      { type: 'message', template: 'betrayal_news' },
    ],
    conditions: { minContacts: 3 },
    weight: 5,
  },

  police_crackdown: {
    category: EVENT_CATEGORIES.CRISIS,
    severity: EVENT_SEVERITY.MAJOR,
    name: 'Police Crackdown',
    message: "The cops are everywhere. A major operation is underway. Lay low.",
    effects: [
      { type: 'heat', value: 40 },
      { type: 'global_modifier', modifier: 'police_presence', value: 2, duration: 300000 },
    ],
    weight: 3,
    oncePerSession: true,
  },

  // Revelation events - information
  overheard_secret: {
    category: EVENT_CATEGORIES.REVELATION,
    severity: EVENT_SEVERITY.MINOR,
    name: 'Overheard Secret',
    message: "You overhear something interesting at the bar. Could be valuable info.",
    effects: [{ type: 'intel', value: 'random' }],
    weight: 7,
  },

  true_identity: {
    category: EVENT_CATEGORIES.REVELATION,
    severity: EVENT_SEVERITY.MODERATE,
    name: 'True Identity Revealed',
    message: "Turns out that NPC you've been working with isn't who they claimed to be.",
    effects: [
      { type: 'npc_reveal', npc: 'random_contact' },
      { type: 'relationship_change', value: 'reveal_reaction' },
    ],
    conditions: { minInteractions: 10 },
    weight: 4,
  },

  // Twist events - expectations subverted
  ally_secret: {
    category: EVENT_CATEGORIES.TWIST,
    severity: EVENT_SEVERITY.MODERATE,
    name: "Ally's Dark Secret",
    message: "Your trusted ally has been hiding something. The truth changes everything.",
    effects: [
      { type: 'npc_secret', npc: 'trusted_ally' },
      { type: 'narrative_flag', flag: 'ally_secret_known' },
    ],
    conditions: { hasTrustedAlly: true },
    weight: 3,
  },

  // Encounter events - forced interactions
  old_acquaintance: {
    category: EVENT_CATEGORIES.ENCOUNTER,
    severity: EVENT_SEVERITY.MINOR,
    name: 'Old Acquaintance',
    message: "Someone from your past shows up. This could go many ways.",
    effects: [{ type: 'spawn_npc', npc: 'past_contact' }],
    weight: 6,
  },

  faction_emissary: {
    category: EVENT_CATEGORIES.ENCOUNTER,
    severity: EVENT_SEVERITY.MODERATE,
    name: 'Faction Emissary',
    message: "A representative from a powerful faction wants to talk. This could be opportunity or trouble.",
    effects: [
      { type: 'spawn_npc', npc: 'faction_rep' },
      { type: 'opportunity', type: 'faction_offer' },
    ],
    conditions: { minLevel: 15 },
    weight: 4,
  },

  nemesis_appears: {
    category: EVENT_CATEGORIES.ENCOUNTER,
    severity: EVENT_SEVERITY.MAJOR,
    name: 'Nemesis Returns',
    message: "An old enemy has resurfaced. They haven't forgotten what you did.",
    effects: [
      { type: 'spawn_enemy', enemy: 'nemesis' },
      { type: 'narrative_flag', flag: 'nemesis_active' },
    ],
    conditions: { hasNemesis: true },
    weight: 2,
    oncePerSession: true,
  },
}

/**
 * EventInjector class
 */
class EventInjectorClass {
  constructor() {
    this.triggeredEvents = []
    this.sessionEvents = []
    this.lastMajorEvent = 0
    this.majorEventCooldown = 600000  // 10 minutes between major events
    this.checkInterval = null

    this.sessionStart = Date.now()
  }

  /**
   * Initialize event injection
   */
  initialize() {
    // Check for random events periodically
    this.checkInterval = setInterval(() => {
      this.checkForRandomEvent()
    }, 60000)  // Check every minute

    console.log('[EventInjector] Initialized')
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Check if a random event should occur
   */
  checkForRandomEvent() {
    // Base chance per check
    let eventChance = 0.05  // 5% base chance

    // Increase chance if player has been idle
    // Decrease chance if lots of activity

    // Adjust based on narrative arc
    const arc = narrativeState.state.currentArc
    if (arc === STORY_ARCS.FALLING || arc === STORY_ARCS.TRAPPED) {
      eventChance *= 1.5  // More events in dark times
    }

    if (Math.random() < eventChance) {
      this.triggerRandomEvent()
    }
  }

  /**
   * Trigger a random event
   */
  triggerRandomEvent() {
    const eligibleEvents = this.getEligibleEvents()
    if (eligibleEvents.length === 0) return null

    const event = this.selectWeightedEvent(eligibleEvents)
    if (!event) return null

    return this.executeEvent(event)
  }

  /**
   * Get events that can currently trigger
   */
  getEligibleEvents() {
    const eligible = []
    const now = Date.now()

    for (const [eventId, template] of Object.entries(EVENT_TEMPLATES)) {
      // Check once per session
      if (template.oncePerSession && this.sessionEvents.includes(eventId)) {
        continue
      }

      // Check major event cooldown
      if (template.severity === EVENT_SEVERITY.MAJOR) {
        if (now - this.lastMajorEvent < this.majorEventCooldown) {
          continue
        }
      }

      // Check conditions
      if (template.conditions && !this.checkConditions(template.conditions)) {
        continue
      }

      eligible.push({ id: eventId, ...template })
    }

    return eligible
  }

  /**
   * Check if conditions are met
   */
  checkConditions(conditions) {
    // Simplified condition checking
    // Would integrate with actual game state
    for (const [condition, value] of Object.entries(conditions)) {
      switch (condition) {
        case 'minLevel':
          // Would check actual level
          break
        case 'minContacts':
          // Would check contact count
          break
        // Add more condition checks
      }
    }
    return true  // Simplified - always pass
  }

  /**
   * Select an event based on weights
   */
  selectWeightedEvent(events) {
    const totalWeight = events.reduce((sum, e) => sum + e.weight, 0)
    let random = Math.random() * totalWeight

    for (const event of events) {
      random -= event.weight
      if (random <= 0) {
        return event
      }
    }

    return events[0]  // Fallback
  }

  /**
   * Execute an event
   */
  executeEvent(eventTemplate) {
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId: eventTemplate.id,
      name: eventTemplate.name,
      category: eventTemplate.category,
      severity: eventTemplate.severity,
      message: eventTemplate.message,
      triggeredAt: Date.now(),
    }

    // Record event
    this.triggeredEvents.push(event)
    this.sessionEvents.push(eventTemplate.id)

    if (eventTemplate.severity === EVENT_SEVERITY.MAJOR) {
      this.lastMajorEvent = Date.now()
    }

    // Apply effects
    const appliedEffects = []
    for (const effect of eventTemplate.effects || []) {
      const result = this.applyEffect(effect)
      appliedEffects.push(result)
    }

    event.appliedEffects = appliedEffects

    console.log(`[EventInjector] Event triggered: ${event.name}`)

    // Send message through queue
    if (messageQueue.initialized) {
      messageQueue.add({
        content: `[EVENT] ${event.message}`,
        type: MESSAGE_TYPES.SYSTEM,
        priority: eventTemplate.severity === EVENT_SEVERITY.MAJOR ? PRIORITY.URGENT : PRIORITY.HIGH,
        sender: 'SYSTEM',
        metadata: { event: true, eventId: event.id },
      })
    }

    // Emit event
    const customEvent = new CustomEvent('random_event', { detail: event })
    window.dispatchEvent(customEvent)

    return event
  }

  /**
   * Apply an effect from an event
   */
  applyEffect(effect) {
    let value = effect.value

    // Handle value ranges
    if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
      value = Math.floor(Math.random() * (value.max - value.min + 1)) + value.min
    }

    // Handle percentage values
    if (typeof value === 'object' && value.percentage !== undefined) {
      // Would calculate actual percentage of current value
      value = value.percentage
    }

    // Emit effect for game systems
    const event = new CustomEvent('narrative_effect', {
      detail: { effect: { ...effect, value }, source: 'random_event' },
    })
    window.dispatchEvent(event)

    return { type: effect.type, value }
  }

  /**
   * Force trigger a specific event (for testing/narrative purposes)
   */
  forceEvent(eventId) {
    const template = EVENT_TEMPLATES[eventId]
    if (!template) {
      console.warn(`[EventInjector] Unknown event: ${eventId}`)
      return null
    }

    return this.executeEvent({ id: eventId, ...template })
  }

  /**
   * Get event history
   */
  getHistory() {
    return [...this.triggeredEvents]
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      totalEvents: this.sessionEvents.length,
      byCategory: this.triggeredEvents.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1
        return acc
      }, {}),
      lastMajorEvent: this.lastMajorEvent,
      sessionDuration: Date.now() - this.sessionStart,
    }
  }

  /**
   * Reset session
   */
  resetSession() {
    this.sessionEvents = []
    this.sessionStart = Date.now()
  }
}

// Export singleton
export const eventInjector = new EventInjectorClass()
export default eventInjector
