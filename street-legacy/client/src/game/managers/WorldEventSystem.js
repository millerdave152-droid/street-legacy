/**
 * WorldEventSystem - Dynamic world events that affect gameplay
 *
 * Event Types:
 * - Police Crackdown: Increased police presence, reduced success rates
 * - Gang War: Faction conflict, choose sides
 * - Market Boom: Prices surge, sell opportunity
 * - Snitch Wave: Trust becomes unreliable
 * - VIP Auction: Weekly special event
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from './TerminalManager'
import { notificationManager } from './NotificationManager'
import { NPC_CONTACTS } from '../data/NPCContacts'
import { FACTIONS } from './PlayerReputationManager'

// Event Types
export const WORLD_EVENT_TYPES = {
  POLICE_CRACKDOWN: 'police_crackdown',
  GANG_WAR: 'gang_war',
  MARKET_BOOM: 'market_boom',
  SNITCH_WAVE: 'snitch_wave',
  VIP_AUCTION: 'vip_auction',
  HEAT_WAVE: 'heat_wave',
  BLACKOUT: 'blackout'
}

// Event Definitions
const EVENT_DEFINITIONS = {
  [WORLD_EVENT_TYPES.POLICE_CRACKDOWN]: {
    name: 'Police Crackdown',
    icon: '🚨',
    description: 'Increased police presence in all districts',
    durationRange: { min: 60, max: 180 }, // minutes
    effects: {
      successRateMod: -0.15,
      heatGainMod: 2.0,
      detectiveMorganMod: 3.0,
      message: 'All operation success rates -15%. Heat gain doubled.'
    },
    announcements: [
      'POLICE CRACKDOWN: Major police operation underway.',
      'ADVISORY: Increased law enforcement activity.',
      'ALERT: Task force deployed across districts.'
    ],
    weight: 20 // Spawn weight
  },

  [WORLD_EVENT_TYPES.GANG_WAR]: {
    name: 'Gang War',
    icon: '⚔️',
    description: 'Faction conflict erupts',
    durationRange: { min: 120, max: 360 },
    effects: {
      territoryConflict: true,
      factionChoice: true,
      message: 'Factions clashing. Choose a side or stay neutral.'
    },
    factions: ['janeAndFinch', 'yorkville'],
    announcements: [
      'GANG WAR: Tensions boil over between crews.',
      'CONFLICT: Territory dispute escalates to violence.',
      'WARNING: Street warfare reported across districts.'
    ],
    weight: 10
  },

  [WORLD_EVENT_TYPES.MARKET_BOOM]: {
    name: 'Market Boom',
    icon: '📈',
    description: 'Black market prices surge',
    durationRange: { min: 20, max: 60 },
    effects: {
      sellPriceMod: 1.3,
      buyPriceMod: 1.1,
      message: 'Sell prices +30%. Limited time opportunity.'
    },
    announcements: [
      'MARKET BOOM: Prices skyrocketing!',
      'OPPORTUNITY: Demand surge on black market.',
      'ALERT: Sellers making bank. Move product now.'
    ],
    weight: 25
  },

  [WORLD_EVENT_TYPES.SNITCH_WAVE]: {
    name: 'Snitch Wave',
    icon: '🐀',
    description: 'Trust becomes unreliable',
    durationRange: { min: 30, max: 90 },
    effects: {
      betrayalChanceMod: 2.0,
      intelReliabilityMod: 0.5,
      message: 'Someone is talking. Trust no one.'
    },
    announcements: [
      'PARANOIA: Word on street - someone\'s snitching.',
      'WARNING: Intel sources compromised.',
      'CAUTION: Undercovers reportedly active.'
    ],
    weight: 15
  },

  [WORLD_EVENT_TYPES.VIP_AUCTION]: {
    name: 'VIP Auction',
    icon: '💎',
    description: 'Underground auction event',
    durationRange: { min: 30, max: 30 }, // Fixed duration
    effects: {
      specialItems: true,
      minLevel: 10,
      message: 'Rare items available. Level 10+ only.'
    },
    announcements: [
      'VIP AUCTION: Underground sale starting soon.',
      'EXCLUSIVE: High-value items changing hands.',
      'INVITATION: Elite players only.'
    ],
    weight: 5,
    scheduled: true // Only spawns at specific times
  },

  [WORLD_EVENT_TYPES.HEAT_WAVE]: {
    name: 'Heat Wave',
    icon: '🔥',
    description: 'City-wide police alert',
    durationRange: { min: 15, max: 45 },
    effects: {
      heatDecayMod: 0.5,
      heatGainMod: 1.5,
      message: 'Heat decay slowed. Cops on high alert.'
    },
    announcements: [
      'HEAT WAVE: City on lockdown.',
      'ALERT: All units on high alert.',
      'WARNING: Laying low harder than usual.'
    ],
    weight: 15
  },

  [WORLD_EVENT_TYPES.BLACKOUT]: {
    name: 'Blackout',
    icon: '🌑',
    description: 'Power outage creates opportunities',
    durationRange: { min: 10, max: 30 },
    effects: {
      successRateMod: 0.2,
      heatGainMod: 0.5,
      message: 'Security systems down. Opportunity window.'
    },
    announcements: [
      'BLACKOUT: Power grid failure across districts.',
      'OPPORTUNITY: Security systems offline.',
      'ALERT: Make your move while you can.'
    ],
    weight: 10
  }
}

const STORAGE_KEY = 'streetLegacy_worldEvents'

class WorldEventSystem {
  constructor() {
    this.isInitialized = false
    this.activeEvents = new Map() // eventId -> event
    this.eventHistory = []
    this.checkInterval = null
    this.spawnInterval = null
  }

  /**
   * Initialize the world event system
   */
  initialize() {
    if (this.isInitialized) return

    this.loadFromStorage()

    // Check for expired events every minute
    this.checkInterval = setInterval(() => {
      this.checkEventExpiry()
    }, 60000)

    // Try to spawn events periodically (every 10 minutes)
    this.spawnInterval = setInterval(() => {
      this.trySpawnEvent()
    }, 10 * 60 * 1000)

    // Initial check
    this.checkEventExpiry()

    this.isInitialized = true
    console.log('[WorldEventSystem] Initialized')
  }

  /**
   * Shutdown the system
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    if (this.spawnInterval) {
      clearInterval(this.spawnInterval)
      this.spawnInterval = null
    }
    this.saveToStorage()
    this.isInitialized = false
  }

  /**
   * Try to spawn a random world event
   */
  trySpawnEvent() {
    // Don't spawn if too many events active
    if (this.activeEvents.size >= 2) return

    // Random chance to spawn
    if (Math.random() > 0.3) return // 30% chance per check

    // Weighted random selection
    const totalWeight = Object.values(EVENT_DEFINITIONS)
      .filter(e => !e.scheduled)
      .reduce((sum, e) => sum + e.weight, 0)

    let random = Math.random() * totalWeight
    let selectedType = null

    for (const [type, def] of Object.entries(EVENT_DEFINITIONS)) {
      if (def.scheduled) continue

      random -= def.weight
      if (random <= 0) {
        selectedType = type
        break
      }
    }

    if (selectedType) {
      this.startEvent(selectedType)
    }
  }

  /**
   * Start a world event
   */
  startEvent(type, options = {}) {
    const definition = EVENT_DEFINITIONS[type]
    if (!definition) {
      console.warn(`[WorldEventSystem] Unknown event type: ${type}`)
      return null
    }

    // Check if same type already active
    for (const event of this.activeEvents.values()) {
      if (event.type === type) {
        console.log(`[WorldEventSystem] Event ${type} already active`)
        return null
      }
    }

    // Calculate duration
    const durationMs = (
      definition.durationRange.min +
      Math.floor(Math.random() * (definition.durationRange.max - definition.durationRange.min))
    ) * 60 * 1000

    const eventId = `${type}_${Date.now()}`
    const event = {
      id: eventId,
      type,
      name: definition.name,
      icon: definition.icon,
      description: definition.description,
      effects: { ...definition.effects },
      startedAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      factions: definition.factions || null,
      playerChoice: null,
      ...options
    }

    this.activeEvents.set(eventId, event)

    // Announce the event
    this.announceEvent(event, definition)

    this.saveToStorage()

    console.log(`[WorldEventSystem] Started event: ${definition.name} (${Math.round(durationMs / 60000)}m)`)

    return eventId
  }

  /**
   * Announce event to terminal
   */
  announceEvent(event, definition) {
    const announcement = definition.announcements[
      Math.floor(Math.random() * definition.announcements.length)
    ]

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`${definition.icon} ${definition.name.toUpperCase()} ${definition.icon}`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(announcement, OUTPUT_TYPES.WARNING)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)

    if (event.effects.message) {
      terminalManager.addOutput(`Effects: ${event.effects.message}`, OUTPUT_TYPES.SYSTEM)
    }

    const durationMins = Math.round((event.expiresAt - Date.now()) / 60000)
    terminalManager.addOutput(`Duration: ${durationMins} minutes`, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)

    notificationManager.showToast(
      `${definition.icon} ${definition.name}!`,
      'warning',
      5000
    )
  }

  /**
   * Check for expired events
   */
  checkEventExpiry() {
    const now = Date.now()

    for (const [eventId, event] of this.activeEvents) {
      if (event.expiresAt <= now) {
        this.endEvent(eventId)
      }
    }
  }

  /**
   * End an event
   */
  endEvent(eventId) {
    const event = this.activeEvents.get(eventId)
    if (!event) return

    // Record in history
    this.eventHistory.push({
      ...event,
      endedAt: Date.now()
    })

    // Keep history limited
    if (this.eventHistory.length > 20) {
      this.eventHistory = this.eventHistory.slice(-20)
    }

    this.activeEvents.delete(eventId)

    // Announce end
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`${event.icon} ${event.name} has ended.`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`Normal conditions restored.`, OUTPUT_TYPES.SYSTEM)

    notificationManager.showToast(`${event.name} ended`, 'success', 3000)

    this.saveToStorage()

    console.log(`[WorldEventSystem] Ended event: ${event.name}`)
  }

  /**
   * Get all active events
   */
  getActiveEvents() {
    return Array.from(this.activeEvents.values())
  }

  /**
   * Check if specific event type is active
   */
  isEventActive(type) {
    for (const event of this.activeEvents.values()) {
      if (event.type === type) return true
    }
    return false
  }

  /**
   * Get combined modifiers from all active events
   */
  getActiveModifiers() {
    const modifiers = {
      successRateMod: 0,
      heatGainMod: 1,
      heatDecayMod: 1,
      sellPriceMod: 1,
      buyPriceMod: 1,
      betrayalChanceMod: 1,
      intelReliabilityMod: 1,
      detectiveMorganMod: 1
    }

    for (const event of this.activeEvents.values()) {
      const effects = event.effects

      if (effects.successRateMod !== undefined) {
        modifiers.successRateMod += effects.successRateMod
      }
      if (effects.heatGainMod !== undefined) {
        modifiers.heatGainMod *= effects.heatGainMod
      }
      if (effects.heatDecayMod !== undefined) {
        modifiers.heatDecayMod *= effects.heatDecayMod
      }
      if (effects.sellPriceMod !== undefined) {
        modifiers.sellPriceMod *= effects.sellPriceMod
      }
      if (effects.buyPriceMod !== undefined) {
        modifiers.buyPriceMod *= effects.buyPriceMod
      }
      if (effects.betrayalChanceMod !== undefined) {
        modifiers.betrayalChanceMod *= effects.betrayalChanceMod
      }
      if (effects.intelReliabilityMod !== undefined) {
        modifiers.intelReliabilityMod *= effects.intelReliabilityMod
      }
      if (effects.detectiveMorganMod !== undefined) {
        modifiers.detectiveMorganMod *= effects.detectiveMorganMod
      }
    }

    return modifiers
  }

  /**
   * Handle player choosing side in gang war
   */
  chooseGangWarSide(eventId, faction) {
    const event = this.activeEvents.get(eventId)
    if (!event || event.type !== WORLD_EVENT_TYPES.GANG_WAR) {
      return { error: 'No active gang war event' }
    }

    if (!event.factions.includes(faction)) {
      return { error: 'Invalid faction choice' }
    }

    event.playerChoice = faction

    // Apply faction reputation changes
    const otherFaction = event.factions.find(f => f !== faction)

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`You've sided with ${FACTIONS[faction] || faction}!`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`${FACTIONS[otherFaction] || otherFaction} now sees you as hostile.`, OUTPUT_TYPES.WARNING)

    this.saveToStorage()

    return {
      success: true,
      alliedFaction: faction,
      hostileFaction: otherFaction
    }
  }

  /**
   * Get event summary for display
   */
  getEventSummary() {
    const events = this.getActiveEvents()

    if (events.length === 0) {
      return { active: false, events: [] }
    }

    return {
      active: true,
      events: events.map(e => ({
        name: e.name,
        icon: e.icon,
        description: e.description,
        remainingMins: Math.max(0, Math.round((e.expiresAt - Date.now()) / 60000)),
        effects: e.effects.message
      }))
    }
  }

  /**
   * Force start an event (for testing or admin)
   */
  forceEvent(type, durationMins = null) {
    const definition = EVENT_DEFINITIONS[type]
    if (!definition) return null

    const options = {}
    if (durationMins) {
      // Override duration
      const now = Date.now()
      return this.startEvent(type, {
        expiresAt: now + (durationMins * 60 * 1000)
      })
    }

    return this.startEvent(type)
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        events: Array.from(this.activeEvents.entries()),
        history: this.eventHistory.slice(-10)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[WorldEventSystem] Save error:', e)
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.events) {
          this.activeEvents = new Map(data.events)
        }
        if (data.history) {
          this.eventHistory = data.history
        }
      }
    } catch (e) {
      console.error('[WorldEventSystem] Load error:', e)
    }
  }
}

// Singleton instance
export const worldEventSystem = new WorldEventSystem()

export default worldEventSystem
