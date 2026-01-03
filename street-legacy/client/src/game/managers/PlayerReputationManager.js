/**
 * PlayerReputationManager - Manages player reputation across factions and NPCs
 *
 * Features:
 * - Overall trust level (0-100)
 * - Faction-based reputation (Toronto neighborhoods)
 * - Individual NPC relationship tracking
 * - Trade history statistics
 * - Reputation decay over time
 * - LocalStorage persistence
 */

import { gameManager } from '../GameManager'
import { NPC_CONTACTS } from '../data/NPCContacts'

// Faction definitions - Toronto neighborhoods
export const FACTIONS = {
  JANE_AND_FINCH: 'janeAndFinch',
  PARKDALE: 'parkdale',
  YORKVILLE: 'yorkville',
  SCARBOROUGH: 'scarborough',
  DOWNTOWN: 'downtown'
}

// Faction display names
export const FACTION_NAMES = {
  [FACTIONS.JANE_AND_FINCH]: 'Jane & Finch',
  [FACTIONS.PARKDALE]: 'Parkdale',
  [FACTIONS.YORKVILLE]: 'Yorkville',
  [FACTIONS.SCARBOROUGH]: 'Scarborough',
  [FACTIONS.DOWNTOWN]: 'Downtown'
}

// Reputation thresholds
export const REPUTATION_LEVELS = {
  HATED: { min: -100, max: -60, name: 'Hated', color: 0xef4444 },
  HOSTILE: { min: -59, max: -30, name: 'Hostile', color: 0xf97316 },
  UNFRIENDLY: { min: -29, max: -10, name: 'Unfriendly', color: 0xfbbf24 },
  NEUTRAL: { min: -9, max: 9, name: 'Neutral', color: 0x9ca3af },
  FRIENDLY: { min: 10, max: 29, name: 'Friendly', color: 0x22c55e },
  TRUSTED: { min: 30, max: 59, name: 'Trusted', color: 0x06b6d4 },
  RESPECTED: { min: 60, max: 100, name: 'Respected', color: 0xa855f7 }
}

// NPC to faction mapping
const NPC_FACTION_MAP = {
  snoop: FACTIONS.JANE_AND_FINCH,
  marcus: FACTIONS.DOWNTOWN,
  watcher: FACTIONS.DOWNTOWN,
  the_connect: FACTIONS.PARKDALE,
  ironman: FACTIONS.SCARBOROUGH,
  silkroad: FACTIONS.DOWNTOWN,
  the_pharmacist: FACTIONS.YORKVILLE,
  scarlett: FACTIONS.SCARBOROUGH,
  the_architect: FACTIONS.YORKVILLE,
  rat: FACTIONS.JANE_AND_FINCH
}

const STORAGE_KEY = 'streetLegacy_playerReputation'

class PlayerReputationManager {
  constructor() {
    this.isInitialized = false
    this.reputation = this.getDefaultReputation()
    this.decayInterval = null
  }

  /**
   * Get default reputation structure
   */
  getDefaultReputation() {
    return {
      overallTrust: 50,
      factions: {
        [FACTIONS.JANE_AND_FINCH]: 0,
        [FACTIONS.PARKDALE]: 0,
        [FACTIONS.YORKVILLE]: 0,
        [FACTIONS.SCARBOROUGH]: 0,
        [FACTIONS.DOWNTOWN]: 0
      },
      tradeHistory: {
        completed: 0,
        failed: 0,
        scammed: 0,
        totalValue: 0
      },
      npcRelationships: {},
      lastUpdate: Date.now()
    }
  }

  /**
   * Initialize the reputation manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadFromStorage()
    this.initializeNPCRelationships()

    // Start reputation decay check (every 5 minutes)
    this.decayInterval = setInterval(() => {
      this.applyReputationDecay()
    }, 5 * 60 * 1000)

    this.isInitialized = true
    console.log('[PlayerReputationManager] Initialized')
  }

  /**
   * Shutdown the manager
   */
  shutdown() {
    if (this.decayInterval) {
      clearInterval(this.decayInterval)
      this.decayInterval = null
    }
    this.saveToStorage()
    this.isInitialized = false
  }

  /**
   * Initialize relationships for all NPCs
   */
  initializeNPCRelationships() {
    Object.keys(NPC_CONTACTS).forEach(npcId => {
      if (!this.reputation.npcRelationships[npcId]) {
        const npc = NPC_CONTACTS[npcId]
        // Start with NPC's base trust, or 0 for undercover/snitch
        const baseTrust = npc.isPoliceTrap ? 0 : (npc.baseTrust || 0)
        this.reputation.npcRelationships[npcId] = {
          trust: baseTrust,
          interactions: 0,
          successfulDeals: 0,
          failedDeals: 0,
          lastInteraction: null,
          betrayed: false,
          blocked: false
        }
      }
    })
    this.saveToStorage()
  }

  /**
   * Load reputation from localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.reputation = { ...this.getDefaultReputation(), ...parsed }
      }
    } catch (e) {
      console.error('[PlayerReputationManager] Load error:', e)
      this.reputation = this.getDefaultReputation()
    }
  }

  /**
   * Save reputation to localStorage
   */
  saveToStorage() {
    try {
      this.reputation.lastUpdate = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reputation))
    } catch (e) {
      console.error('[PlayerReputationManager] Save error:', e)
    }
  }

  /**
   * Get overall trust level
   */
  getOverallTrust() {
    return this.reputation.overallTrust
  }

  /**
   * Get faction reputation
   */
  getFactionReputation(faction) {
    return this.reputation.factions[faction] || 0
  }

  /**
   * Get all faction reputations
   */
  getAllFactionReputations() {
    return Object.entries(this.reputation.factions).map(([id, value]) => ({
      id,
      name: FACTION_NAMES[id] || id,
      value,
      level: this.getReputationLevel(value)
    }))
  }

  /**
   * Get NPC relationship
   */
  getNPCRelationship(npcId) {
    return this.reputation.npcRelationships[npcId] || {
      trust: 0,
      interactions: 0,
      successfulDeals: 0,
      failedDeals: 0,
      lastInteraction: null,
      betrayed: false,
      blocked: false
    }
  }

  /**
   * Get reputation level from value
   */
  getReputationLevel(value) {
    for (const [key, level] of Object.entries(REPUTATION_LEVELS)) {
      if (value >= level.min && value <= level.max) {
        return { key, ...level }
      }
    }
    return REPUTATION_LEVELS.NEUTRAL
  }

  /**
   * Modify NPC trust
   */
  modifyNPCTrust(npcId, amount, reason = '') {
    const relationship = this.reputation.npcRelationships[npcId]
    if (!relationship) {
      console.warn(`[PlayerReputationManager] Unknown NPC: ${npcId}`)
      return
    }

    const oldTrust = relationship.trust
    relationship.trust = Math.max(-100, Math.min(100, relationship.trust + amount))
    relationship.interactions++
    relationship.lastInteraction = Date.now()

    // Update faction reputation
    const faction = NPC_FACTION_MAP[npcId]
    if (faction) {
      this.modifyFactionReputation(faction, Math.floor(amount * 0.3))
    }

    // Update overall trust
    this.updateOverallTrust()

    this.saveToStorage()

    console.log(`[PlayerReputationManager] ${npcId} trust: ${oldTrust} -> ${relationship.trust} (${reason})`)

    return {
      npcId,
      oldTrust,
      newTrust: relationship.trust,
      faction,
      reason
    }
  }

  /**
   * Modify faction reputation
   */
  modifyFactionReputation(faction, amount) {
    if (!this.reputation.factions.hasOwnProperty(faction)) {
      console.warn(`[PlayerReputationManager] Unknown faction: ${faction}`)
      return
    }

    const oldValue = this.reputation.factions[faction]
    this.reputation.factions[faction] = Math.max(-100, Math.min(100, oldValue + amount))

    // Cascade to allied/rival factions (smaller effect)
    this.applyFactionCascade(faction, amount)

    this.saveToStorage()

    return {
      faction,
      oldValue,
      newValue: this.reputation.factions[faction]
    }
  }

  /**
   * Apply faction cascade - allied/rival factions affected
   */
  applyFactionCascade(sourceFaction, amount) {
    const cascadeRules = {
      [FACTIONS.JANE_AND_FINCH]: {
        allies: [FACTIONS.SCARBOROUGH],
        rivals: [FACTIONS.YORKVILLE]
      },
      [FACTIONS.PARKDALE]: {
        allies: [FACTIONS.DOWNTOWN],
        rivals: []
      },
      [FACTIONS.YORKVILLE]: {
        allies: [],
        rivals: [FACTIONS.JANE_AND_FINCH, FACTIONS.SCARBOROUGH]
      },
      [FACTIONS.SCARBOROUGH]: {
        allies: [FACTIONS.JANE_AND_FINCH],
        rivals: [FACTIONS.YORKVILLE]
      },
      [FACTIONS.DOWNTOWN]: {
        allies: [FACTIONS.PARKDALE],
        rivals: []
      }
    }

    const rules = cascadeRules[sourceFaction]
    if (!rules) return

    // Allies get 20% of the effect
    rules.allies.forEach(ally => {
      const cascadeAmount = Math.floor(amount * 0.2)
      if (cascadeAmount !== 0) {
        this.reputation.factions[ally] = Math.max(-100, Math.min(100,
          this.reputation.factions[ally] + cascadeAmount
        ))
      }
    })

    // Rivals get -15% of the effect (opposite direction)
    rules.rivals.forEach(rival => {
      const cascadeAmount = Math.floor(amount * -0.15)
      if (cascadeAmount !== 0) {
        this.reputation.factions[rival] = Math.max(-100, Math.min(100,
          this.reputation.factions[rival] + cascadeAmount
        ))
      }
    })
  }

  /**
   * Update overall trust based on NPC relationships
   */
  updateOverallTrust() {
    const relationships = Object.values(this.reputation.npcRelationships)
    if (relationships.length === 0) return

    // Calculate weighted average (exclude police trap NPCs)
    let totalWeight = 0
    let weightedSum = 0

    relationships.forEach(rel => {
      if (!rel.betrayed) {
        const weight = 1 + (rel.interactions * 0.1) // More interactions = more weight
        totalWeight += weight
        weightedSum += rel.trust * weight
      }
    })

    if (totalWeight > 0) {
      // Map from -100..100 to 0..100
      const avgTrust = weightedSum / totalWeight
      this.reputation.overallTrust = Math.round(50 + (avgTrust * 0.5))
    }
  }

  /**
   * Record a completed trade
   */
  recordTrade(npcId, success, value = 0) {
    const relationship = this.reputation.npcRelationships[npcId]

    if (success) {
      this.reputation.tradeHistory.completed++
      this.reputation.tradeHistory.totalValue += value
      if (relationship) {
        relationship.successfulDeals++
        this.modifyNPCTrust(npcId, 3, 'successful trade')
      }
    } else {
      this.reputation.tradeHistory.failed++
      if (relationship) {
        relationship.failedDeals++
        this.modifyNPCTrust(npcId, -5, 'failed trade')
      }
    }

    this.saveToStorage()
  }

  /**
   * Record being scammed
   */
  recordScam(npcId) {
    this.reputation.tradeHistory.scammed++

    const relationship = this.reputation.npcRelationships[npcId]
    if (relationship) {
      relationship.trust = -100
      relationship.betrayed = true
    }

    // Major faction hit
    const faction = NPC_FACTION_MAP[npcId]
    if (faction) {
      this.modifyFactionReputation(faction, -20)
    }

    this.updateOverallTrust()
    this.saveToStorage()

    console.log(`[PlayerReputationManager] Scammed by ${npcId}!`)
  }

  /**
   * Record NPC betrayal (Rat scenario)
   */
  recordBetrayal(npcId) {
    const relationship = this.reputation.npcRelationships[npcId]
    if (relationship) {
      relationship.betrayed = true
      relationship.trust = -100
    }

    // Betray hits all factions slightly
    Object.keys(this.reputation.factions).forEach(faction => {
      this.reputation.factions[faction] = Math.max(-100,
        this.reputation.factions[faction] - 5
      )
    })

    this.updateOverallTrust()
    this.saveToStorage()

    console.log(`[PlayerReputationManager] Betrayed by ${npcId}!`)
  }

  /**
   * Apply reputation decay over time
   */
  applyReputationDecay() {
    const now = Date.now()
    const hoursSinceUpdate = (now - this.reputation.lastUpdate) / (60 * 60 * 1000)

    if (hoursSinceUpdate < 1) return

    // Decay extreme values towards neutral
    Object.keys(this.reputation.factions).forEach(faction => {
      const value = this.reputation.factions[faction]
      if (Math.abs(value) > 10) {
        const decayAmount = Math.sign(value) * Math.min(Math.abs(value) * 0.02, 2)
        this.reputation.factions[faction] = value - decayAmount
      }
    })

    // Decay NPC relationships slightly
    Object.values(this.reputation.npcRelationships).forEach(rel => {
      if (!rel.betrayed && Math.abs(rel.trust) > 10) {
        const decayAmount = Math.sign(rel.trust) * Math.min(Math.abs(rel.trust) * 0.01, 1)
        rel.trust = rel.trust - decayAmount
      }
    })

    this.updateOverallTrust()
    this.saveToStorage()
  }

  /**
   * Get trade statistics
   */
  getTradeStats() {
    const stats = this.reputation.tradeHistory
    const total = stats.completed + stats.failed
    const successRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0

    return {
      ...stats,
      total,
      successRate
    }
  }

  /**
   * Get full reputation summary
   */
  getSummary() {
    return {
      overallTrust: this.reputation.overallTrust,
      overallLevel: this.getReputationLevel(this.reputation.overallTrust - 50), // Shift to -50..50 scale
      factions: this.getAllFactionReputations(),
      tradeStats: this.getTradeStats(),
      npcCount: Object.keys(this.reputation.npcRelationships).length,
      betrayedBy: Object.entries(this.reputation.npcRelationships)
        .filter(([_, rel]) => rel.betrayed)
        .map(([id, _]) => id)
    }
  }

  /**
   * Check if player can access high-tier NPCs based on reputation
   */
  canAccessNPC(npcId) {
    const npc = NPC_CONTACTS[npcId]
    if (!npc) return false

    // Check level requirement
    const player = gameManager.player || {}
    if (npc.minLevel && (player.level || 1) < npc.minLevel) {
      return { allowed: false, reason: `Requires level ${npc.minLevel}` }
    }

    // Check faction reputation for high-tier NPCs
    const faction = NPC_FACTION_MAP[npcId]
    if (faction && npc.minLevel >= 8) {
      const factionRep = this.getFactionReputation(faction)
      if (factionRep < 20) {
        return { allowed: false, reason: `Requires ${FACTION_NAMES[faction]} reputation 20+` }
      }
    }

    // Check if betrayed
    const relationship = this.getNPCRelationship(npcId)
    if (relationship.betrayed) {
      return { allowed: false, reason: `${npc.name} betrayed you` }
    }

    // Check if blocked
    if (relationship.blocked) {
      return { allowed: false, reason: `${npc.name} is blocked` }
    }

    return { allowed: true }
  }

  /**
   * Reset reputation (for testing or new game)
   */
  reset() {
    this.reputation = this.getDefaultReputation()
    this.initializeNPCRelationships()
    this.saveToStorage()
    console.log('[PlayerReputationManager] Reset to default')
  }
}

// Singleton instance
export const playerReputationManager = new PlayerReputationManager()

export default playerReputationManager
