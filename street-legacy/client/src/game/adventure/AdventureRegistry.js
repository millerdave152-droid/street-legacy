/**
 * AdventureRegistry - Catalog and management of all adventures
 *
 * Stores adventure definitions and tracks:
 * - Available adventures
 * - Locked/unlocked status
 * - Completion history
 */

// Import adventure data
import { WAREHOUSE_HEIST } from './data/HeistAdventures'
import { STREET_ENCOUNTER } from './data/EncounterAdventures'
import { MARCUS_RELATIONSHIP } from './data/RelationshipAdventures'

// Adventure categories
export const ADVENTURE_CATEGORIES = {
  HEIST: 'heist',           // Planning and executing heists
  ENCOUNTER: 'encounter',   // Random street encounters
  RELATIONSHIP: 'relationship', // NPC relationship arcs
  TERRITORY: 'territory',   // Territory exploration
  SAGA: 'saga',             // Multi-part epics
}

class AdventureRegistryClass {
  constructor() {
    this.adventures = new Map()
    this.unlockedAdventures = new Set()
    this.completedAdventures = new Map() // adventureId -> completion count
    this.initialized = false
  }

  /**
   * Initialize the registry
   */
  initialize() {
    if (this.initialized) return

    // Register built-in adventures
    this.registerBuiltInAdventures()

    // Load unlock/completion state
    this.loadState()

    this.initialized = true
    console.log('[AdventureRegistry] Initialized with', this.adventures.size, 'adventures')
  }

  /**
   * Register all built-in adventures
   */
  registerBuiltInAdventures() {
    // Heist adventures
    if (WAREHOUSE_HEIST) {
      this.registerAdventure(WAREHOUSE_HEIST)
    }

    // Encounter adventures
    if (STREET_ENCOUNTER) {
      this.registerAdventure(STREET_ENCOUNTER)
    }

    // Relationship adventures
    if (MARCUS_RELATIONSHIP) {
      this.registerAdventure(MARCUS_RELATIONSHIP)
    }
  }

  /**
   * Register a new adventure
   */
  registerAdventure(adventure) {
    if (!adventure || !adventure.id) {
      console.error('[AdventureRegistry] Invalid adventure - missing id')
      return false
    }

    // Validate adventure structure
    if (!adventure.nodes || Object.keys(adventure.nodes).length === 0) {
      console.error('[AdventureRegistry] Invalid adventure - no nodes:', adventure.id)
      return false
    }

    if (!adventure.startNode && !adventure.nodes.start) {
      console.error('[AdventureRegistry] Invalid adventure - no start node:', adventure.id)
      return false
    }

    this.adventures.set(adventure.id, adventure)

    // Auto-unlock if no requirements
    if (!adventure.requirements && !adventure.locked) {
      this.unlockedAdventures.add(adventure.id)
    }

    return true
  }

  /**
   * Get an adventure by ID
   */
  getAdventure(adventureId) {
    return this.adventures.get(adventureId) || null
  }

  /**
   * Get all adventures
   */
  getAllAdventures() {
    return Array.from(this.adventures.values())
  }

  /**
   * Get available (unlocked) adventures
   */
  getAvailableAdventures() {
    return this.getAllAdventures().filter(a =>
      this.unlockedAdventures.has(a.id) || (!a.requirements && !a.locked)
    )
  }

  /**
   * Get adventures by category
   */
  getAdventuresByCategory(category) {
    return this.getAllAdventures().filter(a => a.category === category)
  }

  /**
   * Check if adventure is unlocked
   */
  isUnlocked(adventureId) {
    const adventure = this.getAdventure(adventureId)
    if (!adventure) return false

    // Always unlocked if no requirements
    if (!adventure.requirements && !adventure.locked) return true

    return this.unlockedAdventures.has(adventureId)
  }

  /**
   * Unlock an adventure
   */
  unlockAdventure(adventureId) {
    this.unlockedAdventures.add(adventureId)
    this.saveState()
    console.log('[AdventureRegistry] Unlocked:', adventureId)
  }

  /**
   * Record adventure completion
   */
  recordCompletion(adventureId, result) {
    const count = this.completedAdventures.get(adventureId) || 0
    this.completedAdventures.set(adventureId, count + 1)
    this.saveState()
  }

  /**
   * Get completion count for an adventure
   */
  getCompletionCount(adventureId) {
    return this.completedAdventures.get(adventureId) || 0
  }

  /**
   * Check if adventure was ever completed
   */
  wasCompleted(adventureId) {
    return this.getCompletionCount(adventureId) > 0
  }

  /**
   * Format adventures for terminal display
   */
  formatAdventuresForTerminal() {
    const available = this.getAvailableAdventures()

    if (available.length === 0) {
      return [
        'No adventures available yet.',
        'Complete jobs and level up to unlock adventures.',
      ]
    }

    const lines = [':: AVAILABLE ADVENTURES ::']

    available.forEach((adventure, index) => {
      const completed = this.wasCompleted(adventure.id) ? ' [COMPLETED]' : ''
      const difficulty = adventure.difficulty ? ` (${adventure.difficulty})` : ''

      lines.push('')
      lines.push(`[${index + 1}] ${adventure.name}${difficulty}${completed}`)
      lines.push(`    ${adventure.description}`)

      if (adventure.estimatedTime) {
        lines.push(`    Est. time: ${adventure.estimatedTime}`)
      }
    })

    lines.push('')
    lines.push('Type: adventure <number> to start')

    return lines
  }

  /**
   * Get adventure by index (1-based)
   */
  getAdventureByIndex(index) {
    const available = this.getAvailableAdventures()
    return available[index - 1] || null
  }

  /**
   * Search adventures by keyword
   */
  searchAdventures(keyword) {
    const lower = keyword.toLowerCase()
    return this.getAllAdventures().filter(a =>
      a.name.toLowerCase().includes(lower) ||
      a.description?.toLowerCase().includes(lower) ||
      a.id.toLowerCase().includes(lower)
    )
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {
        unlocked: Array.from(this.unlockedAdventures),
        completed: Array.from(this.completedAdventures.entries()),
      }
      localStorage.setItem('street_legacy_adventure_registry', JSON.stringify(state))
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem('street_legacy_adventure_registry')
      if (saved) {
        const state = JSON.parse(saved)
        this.unlockedAdventures = new Set(state.unlocked || [])
        this.completedAdventures = new Map(state.completed || [])
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalAdventures: this.adventures.size,
      unlockedCount: this.unlockedAdventures.size,
      completedCount: this.completedAdventures.size,
    }
  }
}

// Singleton export
export const adventureRegistry = new AdventureRegistryClass()
export default adventureRegistry
