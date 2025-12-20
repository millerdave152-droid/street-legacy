/**
 * AISimulationManager - Main simulation loop for AI players
 *
 * Handles:
 * - Running AI actions every simulation tick
 * - AI-to-AI relationships (alliances, rivalries)
 * - AI-to-player interactions
 * - Market influence from AI activity
 */

import { aiPlayerManager } from './AIPlayerManager.js'
import { aiDecisionEngine, AI_ACTIONS } from './AIDecisionEngine.js'
import { aiMessageManager } from './AIMessageManager.js'
import { getPersonality, PERSONALITY_TYPES } from '../data/AIPersonalities.js'

const SIMULATION_INTERVAL = 60000 // 1 minute
const PLAYER_CONTACT_MIN_INTERVAL = 300000 // 5 minutes minimum between AI contacts
const PLAYER_CONTACT_MAX_INTERVAL = 900000 // 15 minutes maximum

class AISimulationManagerClass {
  constructor() {
    this.isRunning = false
    this.simulationTimer = null
    this.playerContactTimer = null
    this.listeners = new Map()
    this.lastSimulation = 0
    this.marketInfluence = new Map() // Tracks AI market manipulation effects
  }

  /**
   * Initialize and start the AI simulation
   */
  start() {
    if (this.isRunning) return

    // Ensure AI players are initialized
    aiPlayerManager.initialize()

    this.isRunning = true
    this.lastSimulation = Date.now()

    // Start main simulation loop
    this.simulationTimer = setInterval(() => {
      this.simulateTick()
    }, SIMULATION_INTERVAL)

    // Start player contact scheduler
    this.scheduleNextPlayerContact()

    console.log('[AISimulationManager] Started')
    this.emit('started')
  }

  /**
   * Stop the simulation
   */
  stop() {
    this.isRunning = false

    if (this.simulationTimer) {
      clearInterval(this.simulationTimer)
      this.simulationTimer = null
    }

    if (this.playerContactTimer) {
      clearTimeout(this.playerContactTimer)
      this.playerContactTimer = null
    }

    console.log('[AISimulationManager] Stopped')
    this.emit('stopped')
  }

  /**
   * Main simulation tick - each AI takes an action
   */
  simulateTick() {
    if (!this.isRunning) return

    const startTime = Date.now()
    const aiPlayers = aiPlayerManager.getAll()

    // Build game state for decision making
    const gameState = this.buildGameState()

    // Process a subset of AIs each tick to spread load
    const tickIndex = Math.floor(Date.now() / SIMULATION_INTERVAL) % 3
    const aiSubset = aiPlayers.filter((_, i) => i % 3 === tickIndex)

    aiSubset.forEach(ai => {
      try {
        this.processAI(ai, gameState)
      } catch (e) {
        console.error(`[AISimulationManager] Error processing AI ${ai.id}:`, e)
      }
    })

    // Update AI-to-AI relationships periodically
    if (tickIndex === 0) {
      this.updateAIRelationships()
    }

    // Apply market effects
    this.applyMarketEffects()

    // Save state
    aiPlayerManager.save()

    const duration = Date.now() - startTime
    console.log(`[AISimulationManager] Tick completed in ${duration}ms, processed ${aiSubset.length} AIs`)
  }

  /**
   * Process a single AI's turn
   */
  processAI(ai, gameState) {
    // Skip if on cooldown
    if (ai.actionCooldown && Date.now() < ai.actionCooldown) {
      return
    }

    // Get AI's decision
    const action = aiDecisionEngine.decideAction(ai, gameState)

    // Execute the action
    this.executeAction(ai, action, gameState)

    // Set cooldown based on action type
    ai.actionCooldown = Date.now() + this.getActionCooldown(action.type)
    ai.lastAction = { type: action.type, time: Date.now() }
  }

  /**
   * Execute an AI action
   */
  executeAction(ai, action, gameState) {
    switch (action.type) {
      case AI_ACTIONS.BUY_GOODS:
        this.executeBuyGoods(ai, action.params)
        break

      case AI_ACTIONS.SELL_GOODS:
        this.executeSellGoods(ai, action.params)
        break

      case AI_ACTIONS.BUY_PROPERTY:
        this.executeBuyProperty(ai, action.params)
        break

      case AI_ACTIONS.COLLECT_INCOME:
        this.executeCollectIncome(ai, action.params)
        break

      case AI_ACTIONS.COMMIT_CRIME:
        this.executeCommitCrime(ai, action.params)
        break

      case AI_ACTIONS.FORM_ALLIANCE:
        this.executeFormAlliance(ai, action.params)
        break

      case AI_ACTIONS.CREATE_RIVALRY:
        this.executeCreateRivalry(ai, action.params)
        break

      case AI_ACTIONS.WAIT:
        // Do nothing
        break
    }
  }

  /**
   * Execute buying goods
   */
  executeBuyGoods(ai, params) {
    if (!params || !params.good) return

    const price = params.currentPrice || params.good.basePrice
    const quantity = Math.min(
      Math.floor(ai.cash / price),
      Math.floor(Math.random() * 5) + 1 // Buy 1-5 at a time
    )

    if (quantity < 1) return

    const totalCost = price * quantity
    ai.cash -= totalCost

    // Add to inventory
    if (!ai.tradingGoods) ai.tradingGoods = []

    const existing = ai.tradingGoods.find(g => g.type === params.good.id)
    if (existing) {
      // Average the buy price
      existing.boughtAt = Math.floor(
        (existing.boughtAt * existing.quantity + price * quantity) /
        (existing.quantity + quantity)
      )
      existing.quantity += quantity
    } else {
      ai.tradingGoods.push({
        type: params.good.id,
        quantity,
        boughtAt: price
      })
    }

    // Record market activity
    this.recordMarketActivity(params.good.id, 'buy', quantity, price)
  }

  /**
   * Execute selling goods
   */
  executeSellGoods(ai, params) {
    if (!params || !params.good) return

    const item = ai.tradingGoods?.find(g => g.type === params.good.type)
    if (!item) return

    const sellQuantity = Math.min(item.quantity, Math.floor(Math.random() * 3) + 1)
    const price = params.currentPrice || params.good.basePrice
    const revenue = price * sellQuantity

    ai.cash += revenue
    item.quantity -= sellQuantity

    // Remove if depleted
    if (item.quantity <= 0) {
      ai.tradingGoods = ai.tradingGoods.filter(g => g.type !== item.type)
    }

    // Respect gain for successful trades
    const profit = (price - item.boughtAt) * sellQuantity
    if (profit > 0) {
      ai.respect += Math.floor(profit / 100)
    }

    // Record market activity
    this.recordMarketActivity(params.good.type, 'sell', sellQuantity, price)
  }

  /**
   * Execute buying property
   */
  executeBuyProperty(ai, params) {
    if (!params || !params.property) return
    if (ai.cash < params.property.price) return

    ai.cash -= params.property.price

    if (!ai.properties) ai.properties = []
    ai.properties.push({
      id: params.property.id,
      type: params.property.type,
      level: 1,
      purchasedAt: Date.now()
    })

    ai.respect += 50 // Property ownership boosts respect
  }

  /**
   * Execute collecting property income
   */
  executeCollectIncome(ai, params) {
    if (!ai.properties || ai.properties.length === 0) return

    const baseIncome = ai.properties.length * 50 * (ai.level / 10)
    const income = Math.floor(baseIncome * (0.8 + Math.random() * 0.4))

    ai.cash += income
  }

  /**
   * Execute committing crime
   */
  executeCommitCrime(ai, params) {
    if (!params || !params.crime) return
    if (ai.energy < params.crime.energy_cost) return

    ai.energy -= params.crime.energy_cost

    // Determine success
    const successRoll = Math.random() * 100
    const success = successRoll < params.crime.success_rate

    if (success) {
      // Random payout
      const payout = params.crime.min_payout +
        Math.floor(Math.random() * (params.crime.max_payout - params.crime.min_payout))

      ai.cash += payout
      ai.respect += Math.floor(payout / 50)
      ai.heat += Math.floor(params.crime.heat_gain * 0.5) // AI gets less heat
    } else {
      ai.heat += params.crime.heat_gain
    }
  }

  /**
   * Execute forming alliance
   */
  executeFormAlliance(ai, params) {
    if (!params || !params.target) return

    const targetId = params.target.id
    aiPlayerManager.formAIAlliance(ai.id, targetId)

    this.emit('allianceFormed', { ai1: ai.id, ai2: targetId })
  }

  /**
   * Execute creating rivalry
   */
  executeCreateRivalry(ai, params) {
    if (!params || !params.target) return

    const targetId = params.target.id
    aiPlayerManager.createAIRivalry(ai.id, targetId)

    this.emit('rivalryCreated', { ai1: ai.id, ai2: targetId })
  }

  /**
   * Schedule next AI contact with player
   */
  scheduleNextPlayerContact() {
    if (!this.isRunning) return

    // Random interval between 5-15 minutes
    const interval = PLAYER_CONTACT_MIN_INTERVAL +
      Math.random() * (PLAYER_CONTACT_MAX_INTERVAL - PLAYER_CONTACT_MIN_INTERVAL)

    this.playerContactTimer = setTimeout(() => {
      this.initiatePlayerContact()
      this.scheduleNextPlayerContact()
    }, interval)
  }

  /**
   * Select an AI to contact the player
   */
  initiatePlayerContact() {
    if (!this.isRunning) return

    const aiPlayers = aiPlayerManager.getAll()
    const now = Date.now()

    // Filter AIs that can contact (not on cooldown)
    const eligibleAIs = aiPlayers.filter(ai => {
      const timeSinceContact = now - (ai.lastContactPlayer || 0)
      return timeSinceContact > PLAYER_CONTACT_MIN_INTERVAL
    })

    if (eligibleAIs.length === 0) return

    // Weight selection by socialness and relationship
    const weighted = eligibleAIs.map(ai => ({
      ai,
      weight: ai.socialness * 50 +
        (ai.playerRelationship === 'allied' ? 30 : 0) +
        (ai.playerRelationship === 'hostile' ? -20 : 0) +
        Math.random() * 30
    }))

    weighted.sort((a, b) => b.weight - a.weight)
    const selectedAI = weighted[0].ai

    // Generate message/offer
    aiMessageManager.generateOffer(selectedAI)

    // Record contact time
    aiPlayerManager.setLastContact(selectedAI.id)

    console.log(`[AISimulationManager] ${selectedAI.username} is contacting the player`)
  }

  /**
   * Update AI-to-AI relationships
   */
  updateAIRelationships() {
    const aiPlayers = aiPlayerManager.getAll()

    // Small chance for new alliances/rivalries each tick
    aiPlayers.forEach(ai => {
      const personality = getPersonality(ai.personality)

      // Networkers form more alliances
      if (Math.random() < ai.socialness * 0.1) {
        const potentialAlly = aiPlayers.find(other =>
          other.id !== ai.id &&
          !ai.alliances.includes(other.id) &&
          !ai.rivals.includes(other.id)
        )

        if (potentialAlly) {
          aiPlayerManager.formAIAlliance(ai.id, potentialAlly.id)
        }
      }

      // Aggressive AIs create rivalries
      if (Math.random() < ai.aggressiveness * 0.05) {
        const potentialRival = aiPlayers.find(other =>
          other.id !== ai.id &&
          !ai.alliances.includes(other.id) &&
          !ai.rivals.includes(other.id)
        )

        if (potentialRival) {
          aiPlayerManager.createAIRivalry(ai.id, potentialRival.id)
        }
      }

      // Saboteurs might betray allies
      if (ai.personality === PERSONALITY_TYPES.SABOTEUR &&
          ai.alliances.length > 0 &&
          Math.random() < 0.1) {
        const betrayTarget = ai.alliances[Math.floor(Math.random() * ai.alliances.length)]
        aiPlayerManager.createAIRivalry(ai.id, betrayTarget)
        this.emit('betrayal', { betrayer: ai.id, victim: betrayTarget })
      }
    })
  }

  /**
   * Record market activity for tracking
   */
  recordMarketActivity(goodId, type, quantity, price) {
    const key = `${goodId}_${type}`
    const current = this.marketInfluence.get(key) || { total: 0, avgPrice: 0, count: 0 }

    current.total += quantity
    current.avgPrice = (current.avgPrice * current.count + price) / (current.count + 1)
    current.count++
    current.lastUpdate = Date.now()

    this.marketInfluence.set(key, current)
  }

  /**
   * Apply market effects from AI activity
   */
  applyMarketEffects() {
    // Market influence decays over time
    const now = Date.now()

    for (const [key, data] of this.marketInfluence.entries()) {
      if (now - data.lastUpdate > 300000) { // 5 minutes
        data.total *= 0.5 // Decay
        if (data.total < 1) {
          this.marketInfluence.delete(key)
        }
      }
    }
  }

  /**
   * Get market influence for a good
   */
  getMarketInfluence(goodId) {
    const buyData = this.marketInfluence.get(`${goodId}_buy`)
    const sellData = this.marketInfluence.get(`${goodId}_sell`)

    const buyPressure = buyData?.total || 0
    const sellPressure = sellData?.total || 0

    // Positive = price should go up, negative = down
    return buyPressure - sellPressure
  }

  /**
   * Get action cooldown in ms
   */
  getActionCooldown(actionType) {
    const cooldowns = {
      [AI_ACTIONS.BUY_GOODS]: 30000,
      [AI_ACTIONS.SELL_GOODS]: 30000,
      [AI_ACTIONS.BUY_PROPERTY]: 120000,
      [AI_ACTIONS.COLLECT_INCOME]: 300000,
      [AI_ACTIONS.COMMIT_CRIME]: 60000,
      [AI_ACTIONS.CONTACT_PLAYER]: 300000,
      [AI_ACTIONS.FORM_ALLIANCE]: 300000,
      [AI_ACTIONS.CREATE_RIVALRY]: 300000,
      [AI_ACTIONS.WAIT]: 10000
    }

    return cooldowns[actionType] || 30000
  }

  /**
   * Build current game state for AI decisions
   */
  buildGameState() {
    return {
      aiPlayers: aiPlayerManager.getAll(),
      marketInfluence: Object.fromEntries(this.marketInfluence),
      timestamp: Date.now()
    }
  }

  /**
   * Force an AI to contact the player (for testing)
   */
  forcePlayerContact(aiId) {
    const ai = aiPlayerManager.getById(aiId)
    if (ai) {
      aiMessageManager.generateOffer(ai)
      aiPlayerManager.setLastContact(ai.id)
    }
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (e) {
          console.error(`[AISimulationManager] Error in ${event} listener:`, e)
        }
      })
    }
  }
}

// Singleton instance
export const aiSimulationManager = new AISimulationManagerClass()
export default aiSimulationManager
