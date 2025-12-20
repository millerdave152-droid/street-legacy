/**
 * AIPlayerManager - Manages AI player entities
 *
 * Handles:
 * - AI player generation and persistence
 * - Loading/saving AI state to localStorage
 * - AI stat progression over time
 * - Managing 25-30 AI players in the game world
 */

import {
  PERSONALITY_TYPES,
  PERSONALITIES,
  getPersonality,
  getRandomPersonalityType,
  generateAIName,
  generateCrewName
} from '../data/AIPersonalities.js'

const STORAGE_KEY = 'street_legacy_ai_players'
const TARGET_AI_COUNT = 27 // 25-30 range

class AIPlayerManagerClass {
  constructor() {
    this.aiPlayers = []
    this.isInitialized = false
  }

  /**
   * Initialize the AI player system
   */
  initialize() {
    if (this.isInitialized) return

    // Load existing AI players or generate new ones
    const savedData = this.loadFromStorage()

    if (savedData && savedData.aiPlayers && savedData.aiPlayers.length > 0) {
      this.aiPlayers = savedData.aiPlayers

      // Ensure we have enough AI players
      if (this.aiPlayers.length < TARGET_AI_COUNT) {
        this.generateAdditionalAIs(TARGET_AI_COUNT - this.aiPlayers.length)
      }

      // Progress AI stats based on time elapsed
      this.progressAIStats(savedData.lastUpdate)
    } else {
      // Generate fresh AI players
      this.generateAllAIs()
    }

    this.isInitialized = true
    this.save()

    console.log(`[AIPlayerManager] Initialized with ${this.aiPlayers.length} AI players`)
  }

  /**
   * Generate all AI players from scratch
   */
  generateAllAIs() {
    this.aiPlayers = []
    const usedNames = new Set()
    const usedCrews = new Set()

    // Ensure at least one of each personality type
    const personalityTypes = Object.values(PERSONALITY_TYPES)

    for (let i = 0; i < TARGET_AI_COUNT; i++) {
      // First 8 get one of each personality, rest are random
      const personality = i < personalityTypes.length
        ? personalityTypes[i]
        : getRandomPersonalityType()

      const ai = this.createAIPlayer(personality, i, usedNames, usedCrews)
      this.aiPlayers.push(ai)
      usedNames.add(ai.username)
      if (ai.crew_name) usedCrews.add(ai.crew_name)
    }

    // Sort by level/respect for initial ranking
    this.aiPlayers.sort((a, b) => b.respect - a.respect)
  }

  /**
   * Generate additional AI players
   */
  generateAdditionalAIs(count) {
    const usedNames = new Set(this.aiPlayers.map(ai => ai.username))
    const usedCrews = new Set(this.aiPlayers.filter(ai => ai.crew_name).map(ai => ai.crew_name))

    for (let i = 0; i < count; i++) {
      const personality = getRandomPersonalityType()
      const ai = this.createAIPlayer(personality, this.aiPlayers.length + i, usedNames, usedCrews)
      this.aiPlayers.push(ai)
      usedNames.add(ai.username)
      if (ai.crew_name) usedCrews.add(ai.crew_name)
    }
  }

  /**
   * Create a single AI player
   */
  createAIPlayer(personalityType, rankHint, usedNames, usedCrews) {
    const personality = getPersonality(personalityType)
    const username = generateAIName(usedNames)

    // Generate stats with exponential decay based on rank hint
    // Top players are significantly stronger
    const baseMultiplier = Math.pow(0.92, rankHint)
    const variance = 0.7 + Math.random() * 0.6

    // Level: 5-45 range
    const level = Math.max(5, Math.min(45, Math.floor(40 * baseMultiplier * variance) + 5))

    // Respect: scales with level
    const baseRespect = level * 500
    const respect = Math.floor(baseRespect * (0.8 + Math.random() * 0.4))

    // Wealth: scales with level
    const baseCash = level * 5000
    const cash = Math.floor(baseCash * (0.5 + Math.random() * 1.0))
    const bank = Math.floor(baseCash * (1.0 + Math.random() * 2.0))

    // 60% chance to have a crew
    const hasCrew = Math.random() < 0.6
    const crew_name = hasCrew ? generateCrewName(usedCrews) : null

    // Generate behavior traits based on personality with some variance
    const traits = {}
    for (const [key, value] of Object.entries(personality.traits)) {
      // Add ±15% variance to personality traits
      traits[key] = Math.max(0, Math.min(1, value + (Math.random() - 0.5) * 0.3))
    }

    return {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username,
      personality: personalityType,

      // Stats
      level,
      xp: level * 100,
      cash,
      bank,
      respect,
      heat: Math.floor(Math.random() * 20),
      health: 100,
      energy: 100,

      // Assets
      properties: this.generateRandomProperties(level),
      inventory: [],
      tradingGoods: this.generateRandomGoods(level),

      // Social
      crew_name,
      alliances: [],
      rivals: [],
      playerRelationship: 'neutral',
      playerTrust: 50,

      // Behavior (from personality + variance)
      ...traits,

      // Activity tracking
      lastAction: null,
      lastContactPlayer: null,
      actionCooldown: 0,
      totalDeals: 0,
      honestDeals: 0,
      deceptiveDeals: 0,

      // Timestamps
      createdAt: Date.now(),
      lastUpdate: Date.now()
    }
  }

  /**
   * Generate random properties for AI based on level
   */
  generateRandomProperties(level) {
    const properties = []
    const propertyCount = Math.min(5, Math.floor(level / 8))

    for (let i = 0; i < propertyCount; i++) {
      properties.push({
        id: `prop_${i}`,
        type: ['apartment', 'garage', 'warehouse', 'nightclub', 'penthouse'][Math.min(4, Math.floor(Math.random() * (level / 8)))],
        level: Math.floor(Math.random() * 3) + 1
      })
    }

    return properties
  }

  /**
   * Generate random trading goods for AI
   */
  generateRandomGoods(level) {
    const goods = []
    const goodTypes = ['cannabis', 'pills', 'cocaine', 'firearms', 'stolen_goods', 'electronics']
    const goodCount = Math.floor(Math.random() * 3)

    for (let i = 0; i < goodCount; i++) {
      const type = goodTypes[Math.floor(Math.random() * Math.min(goodTypes.length, Math.floor(level / 5) + 2))]
      goods.push({
        type,
        quantity: Math.floor(Math.random() * 10) + 1,
        boughtAt: Math.floor(Math.random() * 500) + 100
      })
    }

    return goods
  }

  /**
   * Progress AI stats based on time elapsed since last update
   */
  progressAIStats(lastUpdate) {
    const now = Date.now()
    const hoursSinceUpdate = (now - (lastUpdate || now)) / 3600000

    if (hoursSinceUpdate < 1) return

    this.aiPlayers.forEach(ai => {
      // Random progress based on personality traits
      const personality = getPersonality(ai.personality)

      // Cash/bank progression (0-5% per hour based on risk tolerance)
      const cashGrowth = 1 + (ai.riskTolerance * 0.05 * hoursSinceUpdate * Math.random())
      ai.cash = Math.floor(ai.cash * cashGrowth)
      ai.bank = Math.floor(ai.bank * (1 + 0.02 * hoursSinceUpdate * Math.random()))

      // Respect progression (0-3% per hour)
      const respectGrowth = 1 + (ai.aggressiveness * 0.03 * hoursSinceUpdate * Math.random())
      ai.respect = Math.floor(ai.respect * respectGrowth)

      // Small chance to level up (1% per hour)
      if (Math.random() < 0.01 * hoursSinceUpdate && ai.level < 50) {
        ai.level++
        ai.respect += 100
      }

      // Heat decay
      ai.heat = Math.max(0, ai.heat - Math.floor(hoursSinceUpdate * 2))

      ai.lastUpdate = now
    })
  }

  /**
   * Get all AI players
   */
  getAll() {
    return this.aiPlayers
  }

  /**
   * Get AI player by ID
   */
  getById(id) {
    return this.aiPlayers.find(ai => ai.id === id)
  }

  /**
   * Get AI players sorted by respect (for leaderboard)
   */
  getByRespect() {
    return [...this.aiPlayers].sort((a, b) => b.respect - a.respect)
  }

  /**
   * Get AI players sorted by wealth
   */
  getByWealth() {
    return [...this.aiPlayers].sort((a, b) => (b.cash + b.bank) - (a.cash + a.bank))
  }

  /**
   * Get AI players sorted by level
   */
  getByLevel() {
    return [...this.aiPlayers].sort((a, b) => b.level - a.level)
  }

  /**
   * Get AI players by personality type
   */
  getByPersonality(type) {
    return this.aiPlayers.filter(ai => ai.personality === type)
  }

  /**
   * Get AI players the player has allied with
   */
  getAllies() {
    return this.aiPlayers.filter(ai => ai.playerRelationship === 'allied')
  }

  /**
   * Get AI players hostile to the player
   */
  getHostiles() {
    return this.aiPlayers.filter(ai => ai.playerRelationship === 'hostile')
  }

  /**
   * Update player relationship with an AI
   */
  updatePlayerRelationship(aiId, relationship) {
    const ai = this.getById(aiId)
    if (ai) {
      ai.playerRelationship = relationship
      this.save()
    }
  }

  /**
   * Adjust player trust with an AI
   */
  adjustPlayerTrust(aiId, amount) {
    const ai = this.getById(aiId)
    if (ai) {
      ai.playerTrust = Math.max(0, Math.min(100, ai.playerTrust + amount))

      // Update relationship based on trust
      if (ai.playerTrust >= 80) {
        ai.playerRelationship = 'allied'
      } else if (ai.playerTrust >= 60) {
        ai.playerRelationship = 'friendly'
      } else if (ai.playerTrust >= 40) {
        ai.playerRelationship = 'neutral'
      } else if (ai.playerTrust >= 20) {
        ai.playerRelationship = 'suspicious'
      } else {
        ai.playerRelationship = 'hostile'
      }

      this.save()
    }
  }

  /**
   * Record a deal outcome
   */
  recordDeal(aiId, wasHonest) {
    const ai = this.getById(aiId)
    if (ai) {
      ai.totalDeals++
      if (wasHonest) {
        ai.honestDeals++
      } else {
        ai.deceptiveDeals++
      }
      this.save()
    }
  }

  /**
   * Get AI's deception rate (for player to analyze)
   */
  getDeceptionRate(aiId) {
    const ai = this.getById(aiId)
    if (!ai || ai.totalDeals === 0) return null
    return ai.deceptiveDeals / ai.totalDeals
  }

  /**
   * Update AI cash
   */
  updateCash(aiId, amount) {
    const ai = this.getById(aiId)
    if (ai) {
      ai.cash = Math.max(0, ai.cash + amount)
      this.save()
    }
  }

  /**
   * Update AI respect
   */
  updateRespect(aiId, amount) {
    const ai = this.getById(aiId)
    if (ai) {
      ai.respect = Math.max(0, ai.respect + amount)
      this.save()
    }
  }

  /**
   * Set AI last contact time
   */
  setLastContact(aiId) {
    const ai = this.getById(aiId)
    if (ai) {
      ai.lastContactPlayer = Date.now()
      this.save()
    }
  }

  /**
   * Form alliance between two AIs
   */
  formAIAlliance(ai1Id, ai2Id) {
    const ai1 = this.getById(ai1Id)
    const ai2 = this.getById(ai2Id)

    if (ai1 && ai2) {
      if (!ai1.alliances.includes(ai2Id)) ai1.alliances.push(ai2Id)
      if (!ai2.alliances.includes(ai1Id)) ai2.alliances.push(ai1Id)

      // Remove from rivals if present
      ai1.rivals = ai1.rivals.filter(id => id !== ai2Id)
      ai2.rivals = ai2.rivals.filter(id => id !== ai1Id)

      this.save()
    }
  }

  /**
   * Create rivalry between two AIs
   */
  createAIRivalry(ai1Id, ai2Id) {
    const ai1 = this.getById(ai1Id)
    const ai2 = this.getById(ai2Id)

    if (ai1 && ai2) {
      if (!ai1.rivals.includes(ai2Id)) ai1.rivals.push(ai2Id)
      if (!ai2.rivals.includes(ai1Id)) ai2.rivals.push(ai1Id)

      // Remove from alliances if present
      ai1.alliances = ai1.alliances.filter(id => id !== ai2Id)
      ai2.alliances = ai2.alliances.filter(id => id !== ai1Id)

      this.save()
    }
  }

  /**
   * Save AI data to localStorage
   */
  save() {
    try {
      const data = {
        aiPlayers: this.aiPlayers,
        lastUpdate: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[AIPlayerManager] Failed to save:', e)
    }
  }

  /**
   * Load AI data from localStorage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : null
    } catch (e) {
      console.error('[AIPlayerManager] Failed to load:', e)
      return null
    }
  }

  /**
   * Reset all AI data (for testing/development only)
   * @param {boolean} force - Set to true to bypass DEBUG check
   */
  reset(force = false) {
    // Only allow reset in development or with force flag
    if (!force && typeof window !== 'undefined' && !window.DEBUG_MODE) {
      console.warn('[AIPlayerManager] reset() is only available in debug mode')
      return
    }
    localStorage.removeItem(STORAGE_KEY)
    this.aiPlayers = []
    this.isInitialized = false
    this.initialize()
  }
}

// Singleton instance
export const aiPlayerManager = new AIPlayerManagerClass()
export default aiPlayerManager
