/**
 * ProgressionManager - Handles level-based progression and unlocks
 *
 * Progression Tiers:
 * - Level 1-3 (Starting Zone): Snoop, Marcus, System messages
 * - Level 4-6 (Expansion): Watcher, Ironman, Silkroad
 * - Level 7-9 (Criminal Network): The Connect, The Pharmacist, Network Hub
 * - Level 10-12 (Crew Access): Scarlett, Crew formation, Territory control
 * - Level 13-15 (Elite Tier): The Architect, VIP Network, Cross-city ops
 */

import { gameManager } from '../GameManager'
import { NPC_CONTACTS } from '../data/NPCContacts'
import { terminalManager, OUTPUT_TYPES } from './TerminalManager'
import { notificationManager } from './NotificationManager'

// Progression Tiers
export const PROGRESSION_TIERS = {
  STARTING: {
    name: 'Starting Zone',
    minLevel: 1,
    maxLevel: 3,
    description: 'Learning the ropes',
    color: 0x9ca3af, // Gray
    unlocks: ['snoop', 'marcus'],
    features: ['Basic crimes', 'System messages', 'Tutorial missions']
  },
  EXPANSION: {
    name: 'Expansion',
    minLevel: 4,
    maxLevel: 6,
    description: 'Building your network',
    color: 0x22c55e, // Green
    unlocks: ['watcher', 'ironman', 'silkroad'],
    features: ['Better intel', 'Scam detection training', 'Bulk trade access']
  },
  CRIMINAL_NETWORK: {
    name: 'Criminal Network',
    minLevel: 7,
    maxLevel: 9,
    description: 'Connected to the underworld',
    color: 0x3b82f6, // Blue
    unlocks: ['the_connect', 'the_pharmacist'],
    features: ['High-value opportunities', 'Restricted items', 'Network Hub']
  },
  CREW_ACCESS: {
    name: 'Crew Access',
    minLevel: 10,
    maxLevel: 12,
    description: 'Leading your own crew',
    color: 0xa855f7, // Purple
    unlocks: ['scarlett'],
    features: ['Crew formation', 'Territory missions', 'Jane & Finch access']
  },
  ELITE: {
    name: 'Elite',
    minLevel: 13,
    maxLevel: 15,
    description: 'Legendary status',
    color: 0xfbbf24, // Gold
    unlocks: ['the_architect'],
    features: ['Legendary heists', 'VIP Network', 'Cross-city operations']
  }
}

// Feature unlock levels
export const FEATURE_UNLOCKS = {
  BULK_TRADING: 4,
  NETWORK_HUB: 7,
  CREW_FORMATION: 10,
  TERRITORY_CONTROL: 10,
  VIP_NETWORK: 13,
  LEGENDARY_HEISTS: 13
}

const STORAGE_KEY = 'streetLegacy_progression'

class ProgressionManager {
  constructor() {
    this.isInitialized = false
    this.progression = this.getDefaultProgression()
    this.previousLevel = 1
  }

  /**
   * Get default progression state
   */
  getDefaultProgression() {
    return {
      unlockedNPCs: ['snoop', 'marcus'],
      unlockedFeatures: [],
      seenUnlockMessages: [],
      currentTier: 'STARTING',
      lastUpdate: Date.now()
    }
  }

  /**
   * Initialize the progression manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadFromStorage()

    // Store current level
    const player = gameManager.player
    this.previousLevel = player?.level || 1

    // Check unlocks on init
    this.checkUnlocks(this.previousLevel)

    // Listen for level up events from GameManager
    gameManager.on('levelUp', (data) => {
      this.onLevelUp(data.newLevel)
    })

    // Also check on player updates in case level changed
    gameManager.on('playerUpdated', (player) => {
      if (player.level && player.level !== this.previousLevel) {
        this.onLevelUp(player.level)
      }
    })

    this.isInitialized = true
    console.log('[ProgressionManager] Initialized')
  }

  /**
   * Shutdown the manager
   */
  shutdown() {
    this.saveToStorage()
    this.isInitialized = false
  }

  /**
   * Load progression from localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        this.progression = { ...this.getDefaultProgression(), ...parsed }
      }
    } catch (e) {
      console.error('[ProgressionManager] Load error:', e)
      this.progression = this.getDefaultProgression()
    }
  }

  /**
   * Save progression to localStorage
   */
  saveToStorage() {
    try {
      this.progression.lastUpdate = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progression))
    } catch (e) {
      console.error('[ProgressionManager] Save error:', e)
    }
  }

  /**
   * Get current progression tier for a level
   */
  getTierForLevel(level) {
    for (const [key, tier] of Object.entries(PROGRESSION_TIERS)) {
      if (level >= tier.minLevel && level <= tier.maxLevel) {
        return { key, ...tier }
      }
    }
    // Above max level
    return { key: 'ELITE', ...PROGRESSION_TIERS.ELITE }
  }

  /**
   * Check if player leveled up and handle unlocks
   */
  onLevelUp(newLevel) {
    const oldLevel = this.previousLevel
    this.previousLevel = newLevel

    if (newLevel <= oldLevel) return

    console.log(`[ProgressionManager] Level up: ${oldLevel} -> ${newLevel}`)

    // Check for tier change
    const oldTier = this.getTierForLevel(oldLevel)
    const newTier = this.getTierForLevel(newLevel)

    if (oldTier.key !== newTier.key) {
      this.handleTierChange(oldTier, newTier)
    }

    // Check for new unlocks
    this.checkUnlocks(newLevel)
  }

  /**
   * Handle tier progression
   */
  handleTierChange(oldTier, newTier) {
    this.progression.currentTier = newTier.key
    this.saveToStorage()

    // Show tier advancement notification
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: TIER ADVANCEMENT ::`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`You've reached: ${newTier.name}`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`"${newTier.description}"`, OUTPUT_TYPES.HANDLER)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)

    // Show new features
    if (newTier.features && newTier.features.length > 0) {
      terminalManager.addOutput(`New features unlocked:`, OUTPUT_TYPES.SYSTEM)
      newTier.features.forEach(feature => {
        terminalManager.addOutput(`  + ${feature}`, OUTPUT_TYPES.NPC_DEAL)
      })
      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    }

    notificationManager.showToast(
      `Tier Up! Welcome to ${newTier.name}`,
      'success',
      5000
    )
  }

  /**
   * Check for new NPC unlocks at a level
   */
  checkUnlocks(level) {
    const newUnlocks = []

    // Check all NPCs
    Object.entries(NPC_CONTACTS).forEach(([npcId, npc]) => {
      // Skip already unlocked
      if (this.progression.unlockedNPCs.includes(npcId)) return

      // Skip NPCs with no level requirement (heat-based like Morgan)
      if (npc.minLevel === null) return

      // Check if player meets level requirement
      if (level >= npc.minLevel) {
        newUnlocks.push({ id: npcId, npc })
        this.progression.unlockedNPCs.push(npcId)
      }
    })

    // Check feature unlocks
    Object.entries(FEATURE_UNLOCKS).forEach(([feature, requiredLevel]) => {
      if (!this.progression.unlockedFeatures.includes(feature) && level >= requiredLevel) {
        this.progression.unlockedFeatures.push(feature)
      }
    })

    // Show unlock notifications
    if (newUnlocks.length > 0) {
      this.showUnlockNotifications(newUnlocks)
    }

    this.saveToStorage()
  }

  /**
   * Show notifications for newly unlocked NPCs
   */
  showUnlockNotifications(unlocks) {
    unlocks.forEach(({ id, npc }) => {
      // Skip if already seen
      if (this.progression.seenUnlockMessages.includes(id)) return
      this.progression.seenUnlockMessages.push(id)

      // Terminal message
      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(`:: NEW CONTACT UNLOCKED ::`, OUTPUT_TYPES.NPC_DEAL)
      terminalManager.addOutput(`${npc.displayPrefix} ${npc.name}`, OUTPUT_TYPES.HANDLER)
      terminalManager.addOutput(`Role: ${npc.role}`, OUTPUT_TYPES.RESPONSE)
      terminalManager.addOutput(`"${npc.description}"`, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(`Type 'msg ${npc.id}' to contact`, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)

      // Toast notification
      notificationManager.showToast(
        `New Contact: ${npc.name} (${npc.role})`,
        'success',
        4000
      )
    })
  }

  /**
   * Check if an NPC is unlocked
   */
  isNPCUnlocked(npcId) {
    const npc = NPC_CONTACTS[npcId]
    if (!npc) return false

    // Heat-based NPCs (Morgan) are always "unlocked" but appear based on heat
    if (npc.minLevel === null) return true

    const player = gameManager.player
    const level = player?.level || 1

    return level >= npc.minLevel
  }

  /**
   * Check if a feature is unlocked
   */
  isFeatureUnlocked(feature) {
    return this.progression.unlockedFeatures.includes(feature)
  }

  /**
   * Get all available NPCs for current level
   */
  getAvailableNPCs() {
    const player = gameManager.player
    const level = player?.level || 1

    return Object.entries(NPC_CONTACTS)
      .filter(([id, npc]) => {
        // Exclude special NPCs
        if (npc.isPoliceTrap) return false
        if (npc.role === 'SNITCH' && npc.id === 'rat') return false

        // Check level requirement
        return npc.minLevel === null || level >= npc.minLevel
      })
      .map(([id, npc]) => ({
        id,
        name: npc.name,
        role: npc.role,
        unlocked: true
      }))
  }

  /**
   * Get locked NPCs that player hasn't reached yet
   */
  getLockedNPCs() {
    const player = gameManager.player
    const level = player?.level || 1

    return Object.entries(NPC_CONTACTS)
      .filter(([id, npc]) => {
        // Exclude special NPCs
        if (npc.isPoliceTrap) return false

        // Check if locked
        return npc.minLevel !== null && level < npc.minLevel
      })
      .map(([id, npc]) => ({
        id,
        name: npc.name,
        role: npc.role,
        requiredLevel: npc.minLevel,
        unlocked: false
      }))
      .sort((a, b) => a.requiredLevel - b.requiredLevel)
  }

  /**
   * Get current tier info
   */
  getCurrentTier() {
    const player = gameManager.player
    const level = player?.level || 1
    return this.getTierForLevel(level)
  }

  /**
   * Get next tier info
   */
  getNextTier() {
    const current = this.getCurrentTier()
    const tiers = Object.entries(PROGRESSION_TIERS)
    const currentIndex = tiers.findIndex(([key]) => key === current.key)

    if (currentIndex < tiers.length - 1) {
      const [key, tier] = tiers[currentIndex + 1]
      return { key, ...tier }
    }

    return null // Already at max tier
  }

  /**
   * Get progression summary
   */
  getSummary() {
    const player = gameManager.player
    const level = player?.level || 1
    const currentTier = this.getTierForLevel(level)
    const nextTier = this.getNextTier()

    return {
      level,
      currentTier,
      nextTier,
      unlockedNPCs: this.getAvailableNPCs(),
      lockedNPCs: this.getLockedNPCs(),
      unlockedFeatures: this.progression.unlockedFeatures,
      levelsToNextTier: nextTier ? nextTier.minLevel - level : 0
    }
  }

  /**
   * Reset progression (for testing or new game)
   */
  reset() {
    this.progression = this.getDefaultProgression()
    this.previousLevel = 1
    this.saveToStorage()
    console.log('[ProgressionManager] Reset to default')
  }
}

// Singleton instance
export const progressionManager = new ProgressionManager()

export default progressionManager
