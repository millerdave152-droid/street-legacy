/**
 * AIDecisionEngine - Smart decision-making for AI players
 *
 * Handles:
 * - Evaluating available actions
 * - Scoring actions based on expected value
 * - Personality-based decision biases
 * - Risk/reward calculations
 */

import { getPersonality, PERSONALITY_TYPES } from '../data/AIPersonalities.js'
import { CRIMES, PROPERTIES, TRADING_GOODS } from '../data/GameData.js'

// Action types
export const AI_ACTIONS = {
  // Economic
  BUY_GOODS: 'buy_goods',
  SELL_GOODS: 'sell_goods',
  BUY_PROPERTY: 'buy_property',
  COLLECT_INCOME: 'collect_income',
  COMMIT_CRIME: 'commit_crime',

  // Social
  CONTACT_PLAYER: 'contact_player',
  FORM_ALLIANCE: 'form_alliance',
  BREAK_ALLIANCE: 'break_alliance',
  CREATE_RIVALRY: 'create_rivalry',

  // Competitive
  UNDERCUT_MARKET: 'undercut_market',
  SPREAD_RUMOR: 'spread_rumor',

  // Passive
  WAIT: 'wait'
}

class AIDecisionEngineClass {
  constructor() {
    this.marketPrices = new Map()
    this.recentActions = new Map() // Track recent AI actions for variety
  }

  /**
   * Decide the best action for an AI player
   * @param {object} ai - AI player object
   * @param {object} gameState - Current game state
   * @returns {object} Chosen action with parameters
   */
  decideAction(ai, gameState) {
    const personality = getPersonality(ai.personality)
    const availableActions = this.getAvailableActions(ai, gameState)

    if (availableActions.length === 0) {
      return { type: AI_ACTIONS.WAIT }
    }

    // Score each action
    const scoredActions = availableActions.map(action => ({
      action,
      score: this.scoreAction(ai, action, gameState, personality)
    }))

    // Add randomness based on personality (wildcards are more random)
    const randomnessFactor = ai.personality === PERSONALITY_TYPES.WILDCARD ? 0.4 : 0.15

    scoredActions.forEach(sa => {
      sa.score *= (1 - randomnessFactor) + (Math.random() * randomnessFactor * 2)
    })

    // Sort by score descending
    scoredActions.sort((a, b) => b.score - a.score)

    // Select action (weighted towards top choices)
    const selected = this.selectWeightedAction(scoredActions)

    // Record this action to prevent repetition
    this.recordAction(ai.id, selected.type)

    return selected
  }

  /**
   * Get all actions available to an AI
   */
  getAvailableActions(ai, gameState) {
    const actions = []

    // Economic actions
    if (ai.cash > 100) {
      actions.push({
        type: AI_ACTIONS.BUY_GOODS,
        params: this.findBestGoodsToBuy(ai, gameState)
      })
    }

    if (ai.tradingGoods && ai.tradingGoods.length > 0) {
      actions.push({
        type: AI_ACTIONS.SELL_GOODS,
        params: this.findBestGoodsToSell(ai, gameState)
      })
    }

    if (ai.cash > 5000) {
      actions.push({
        type: AI_ACTIONS.BUY_PROPERTY,
        params: this.findBestPropertyToBuy(ai, gameState)
      })
    }

    if (ai.properties && ai.properties.length > 0) {
      actions.push({
        type: AI_ACTIONS.COLLECT_INCOME,
        params: { properties: ai.properties }
      })
    }

    if (ai.energy > 20) {
      actions.push({
        type: AI_ACTIONS.COMMIT_CRIME,
        params: this.findBestCrime(ai)
      })
    }

    // Social actions (limited by cooldown)
    const canContactPlayer = !ai.lastContactPlayer ||
      (Date.now() - ai.lastContactPlayer > 300000) // 5 min cooldown

    if (canContactPlayer) {
      actions.push({
        type: AI_ACTIONS.CONTACT_PLAYER,
        params: this.generateOfferParams(ai, gameState)
      })
    }

    // Alliance/rivalry actions
    if (gameState.aiPlayers) {
      const potentialAllies = gameState.aiPlayers.filter(other =>
        other.id !== ai.id &&
        !ai.alliances.includes(other.id) &&
        !ai.rivals.includes(other.id)
      )

      if (potentialAllies.length > 0) {
        actions.push({
          type: AI_ACTIONS.FORM_ALLIANCE,
          params: { target: this.selectAllianceTarget(ai, potentialAllies) }
        })
      }
    }

    // Always allow waiting
    actions.push({ type: AI_ACTIONS.WAIT, params: {} })

    return actions
  }

  /**
   * Score an action based on expected value and personality
   */
  scoreAction(ai, action, gameState, personality) {
    let score = 0

    switch (action.type) {
      case AI_ACTIONS.BUY_GOODS:
        score = this.scoreBuyGoods(ai, action.params, personality)
        break

      case AI_ACTIONS.SELL_GOODS:
        score = this.scoreSellGoods(ai, action.params, personality)
        break

      case AI_ACTIONS.BUY_PROPERTY:
        score = this.scoreBuyProperty(ai, action.params, personality)
        break

      case AI_ACTIONS.COLLECT_INCOME:
        score = 40 // Reliable income
        break

      case AI_ACTIONS.COMMIT_CRIME:
        score = this.scoreCrime(ai, action.params, personality)
        break

      case AI_ACTIONS.CONTACT_PLAYER:
        score = this.scoreContactPlayer(ai, gameState, personality)
        break

      case AI_ACTIONS.FORM_ALLIANCE:
        score = this.scoreFormAlliance(ai, action.params, personality)
        break

      case AI_ACTIONS.WAIT:
        score = 10 // Low base score
        break

      default:
        score = 0
    }

    // Apply personality modifiers
    score *= this.getPersonalityModifier(ai, action.type, personality)

    // Penalize recently taken actions (variety)
    const recentCount = this.getRecentActionCount(ai.id, action.type)
    score *= Math.max(0.5, 1 - (recentCount * 0.1))

    return Math.max(0, score)
  }

  /**
   * Score buying goods action
   */
  scoreBuyGoods(ai, params, personality) {
    if (!params || !params.good) return 0

    let score = 30

    // Price analysis
    const priceRatio = params.currentPrice / params.good.basePrice
    if (priceRatio < 0.8) score += 30 // Good deal
    else if (priceRatio < 1.0) score += 15
    else if (priceRatio > 1.2) score -= 20 // Bad deal

    // Risk tolerance affects willingness to buy risky goods
    const riskLevel = params.good.risk || 0.5
    score += (ai.riskTolerance - 0.5) * 20 * riskLevel

    // Can we afford a meaningful amount?
    const canBuy = Math.floor(ai.cash / params.currentPrice)
    if (canBuy < 2) score -= 20

    return score
  }

  /**
   * Score selling goods action
   */
  scoreSellGoods(ai, params, personality) {
    if (!params || !params.good) return 0

    let score = 35

    // Profit calculation
    const profit = params.currentPrice - params.good.boughtAt
    const profitRatio = profit / params.good.boughtAt

    if (profitRatio > 0.3) score += 40 // Great profit
    else if (profitRatio > 0.1) score += 20
    else if (profitRatio < -0.1) score -= 30 // Loss

    // Urgency based on heat
    if (ai.heat > 50) score += 20 // Need to sell before getting caught

    return score
  }

  /**
   * Score buying property action
   */
  scoreBuyProperty(ai, params, personality) {
    if (!params || !params.property) return 0

    let score = 25

    // Can we afford it comfortably?
    const affordabilityRatio = ai.cash / params.property.price
    if (affordabilityRatio > 2) score += 20
    else if (affordabilityRatio < 1.2) score -= 30

    // ROI calculation
    const monthlyROI = (params.property.incomePerHour * 24 * 30) / params.property.price
    score += monthlyROI * 100

    // Don't over-invest in property
    const propertyCount = ai.properties ? ai.properties.length : 0
    if (propertyCount >= 5) score -= 30

    return score
  }

  /**
   * Score committing crime action
   */
  scoreCrime(ai, params, personality) {
    if (!params || !params.crime) return 0

    let score = 20

    const crime = params.crime

    // Expected value calculation
    const expectedCash = crime.min_payout * crime.success_rate / 100
    score += expectedCash / 50

    // Heat risk
    const heatRisk = crime.heat_gain * (1 - crime.success_rate / 100)
    score -= heatRisk * (1 - ai.riskTolerance)

    // Level requirement
    if (ai.level < (crime.min_level || 1)) score = 0

    // Energy cost consideration
    if (ai.energy < crime.energy_cost) score = 0

    return score
  }

  /**
   * Score contacting player action
   */
  scoreContactPlayer(ai, gameState, personality) {
    let score = 30

    // Social personalities contact more often
    score += ai.socialness * 30

    // Relationship affects desire to contact
    if (ai.playerRelationship === 'allied') score += 20
    else if (ai.playerRelationship === 'hostile') score -= 10

    // Manipulators and networkers love contacting
    if (ai.personality === PERSONALITY_TYPES.MANIPULATOR) score += 25
    if (ai.personality === PERSONALITY_TYPES.NETWORKER) score += 20
    if (ai.personality === PERSONALITY_TYPES.MENTOR) score += 15

    return score
  }

  /**
   * Score forming alliance action
   */
  scoreFormAlliance(ai, params, personality) {
    let score = 15

    // Networkers love alliances
    score += ai.socialness * 30

    // Already have many alliances?
    const allianceCount = ai.alliances ? ai.alliances.length : 0
    if (allianceCount >= 5) score -= 20

    return score
  }

  /**
   * Get personality modifier for action type
   */
  getPersonalityModifier(ai, actionType, personality) {
    const modifiers = {
      [AI_ACTIONS.BUY_GOODS]: 1 + (ai.riskTolerance - 0.5) * 0.3,
      [AI_ACTIONS.SELL_GOODS]: 1,
      [AI_ACTIONS.BUY_PROPERTY]: 1 + (ai.patience - 0.5) * 0.4,
      [AI_ACTIONS.COMMIT_CRIME]: 1 + (ai.aggressiveness - 0.5) * 0.5,
      [AI_ACTIONS.CONTACT_PLAYER]: 1 + (ai.socialness - 0.5) * 0.4,
      [AI_ACTIONS.FORM_ALLIANCE]: 1 + (ai.socialness - 0.5) * 0.5,
      [AI_ACTIONS.WAIT]: 1 + (ai.patience - 0.5) * 0.3
    }

    return modifiers[actionType] || 1
  }

  /**
   * Find best goods to buy
   */
  findBestGoodsToBuy(ai, gameState) {
    const availableGoods = TRADING_GOODS.filter(g =>
      ai.level >= (g.min_level || 1)
    )

    if (availableGoods.length === 0) return null

    // Score each good
    const scoredGoods = availableGoods.map(good => {
      const currentPrice = this.getCurrentPrice(good)
      const priceRatio = currentPrice / good.basePrice
      const score = (1 - priceRatio) * 100 + Math.random() * 20

      return { good, currentPrice, score }
    })

    scoredGoods.sort((a, b) => b.score - a.score)

    return scoredGoods[0] || null
  }

  /**
   * Find best goods to sell
   */
  findBestGoodsToSell(ai, gameState) {
    if (!ai.tradingGoods || ai.tradingGoods.length === 0) return null

    const scoredGoods = ai.tradingGoods.map(item => {
      const goodDef = TRADING_GOODS.find(g => g.id === item.type)
      const currentPrice = this.getCurrentPrice(goodDef)
      const profit = currentPrice - item.boughtAt
      const profitRatio = profit / item.boughtAt

      return {
        good: { ...item, ...goodDef },
        currentPrice,
        profit,
        profitRatio,
        score: profitRatio * 100 + Math.random() * 10
      }
    })

    scoredGoods.sort((a, b) => b.score - a.score)

    return scoredGoods[0] || null
  }

  /**
   * Find best property to buy
   */
  findBestPropertyToBuy(ai, gameState) {
    const availableProps = PROPERTIES.filter(p =>
      ai.level >= (p.min_level || 1) &&
      ai.cash >= p.price * 1.1 // Need some buffer
    )

    if (availableProps.length === 0) return null

    // Score by ROI
    const scoredProps = availableProps.map(prop => {
      const monthlyROI = (prop.income_per_hour * 24 * 30) / prop.price
      return {
        property: prop,
        score: monthlyROI * 1000 + Math.random() * 10
      }
    })

    scoredProps.sort((a, b) => b.score - a.score)

    return scoredProps[0] || null
  }

  /**
   * Find best crime for AI to commit
   */
  findBestCrime(ai) {
    const availableCrimes = CRIMES.filter(c =>
      ai.level >= (c.min_level || 1) &&
      ai.energy >= c.energy_cost
    )

    if (availableCrimes.length === 0) return null

    // Score crimes by expected value adjusted for risk
    const scoredCrimes = availableCrimes.map(crime => {
      const expectedValue = ((crime.min_payout + crime.max_payout) / 2) * (crime.success_rate / 100)
      const riskPenalty = crime.heat_gain * (1 - ai.riskTolerance)
      const score = expectedValue - riskPenalty + Math.random() * 50

      return { crime, score }
    })

    scoredCrimes.sort((a, b) => b.score - a.score)

    return scoredCrimes[0] || null
  }

  /**
   * Generate offer parameters for contacting player
   */
  generateOfferParams(ai, gameState) {
    const personality = getPersonality(ai.personality)

    // Select offer type based on personality preferences
    const offerTypes = personality.preferredOffers || ['trade_deal']
    const selectedType = offerTypes[Math.floor(Math.random() * offerTypes.length)]

    // Determine if this will be deceptive
    const deceptionChance = ai.deceptiveness * ((100 - ai.playerTrust) / 100)
    const isDeceptive = Math.random() < deceptionChance

    return {
      offerType: selectedType,
      isDeceptive,
      personality: ai.personality
    }
  }

  /**
   * Select alliance target
   */
  selectAllianceTarget(ai, potentialAllies) {
    // Prefer AIs with similar personality or complementary skills
    const scored = potentialAllies.map(other => {
      let score = 50

      // Similar level
      const levelDiff = Math.abs(ai.level - other.level)
      score -= levelDiff

      // Similar personality bonus
      if (ai.personality === other.personality) score += 20

      // Networkers are good allies
      if (other.personality === PERSONALITY_TYPES.NETWORKER) score += 15

      return { ai: other, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.ai || null
  }

  /**
   * Select action with weighted randomness
   */
  selectWeightedAction(scoredActions) {
    if (scoredActions.length === 0) return { type: AI_ACTIONS.WAIT }

    const totalScore = scoredActions.reduce((sum, sa) => sum + Math.max(0.1, sa.score), 0)
    let random = Math.random() * totalScore
    let cumulative = 0

    for (const sa of scoredActions) {
      cumulative += Math.max(0.1, sa.score)
      if (random <= cumulative) {
        return sa.action
      }
    }

    return scoredActions[0].action
  }

  /**
   * Get current market price for a good (with some variance)
   */
  getCurrentPrice(good) {
    if (!good) return 100

    // Check cached price
    const cached = this.marketPrices.get(good.id)
    if (cached && Date.now() - cached.time < 60000) {
      return cached.price
    }

    // Generate new price with variance
    const variance = 0.6 + Math.random() * 0.8 // 60-140%
    const price = Math.floor(good.basePrice * variance)

    this.marketPrices.set(good.id, { price, time: Date.now() })
    return price
  }

  /**
   * Record an action to prevent repetition
   */
  recordAction(aiId, actionType) {
    const key = `${aiId}_${actionType}`
    const count = this.recentActions.get(key) || 0
    this.recentActions.set(key, count + 1)

    // Decay over time (simple version)
    setTimeout(() => {
      const current = this.recentActions.get(key) || 0
      if (current > 0) {
        this.recentActions.set(key, current - 1)
      }
    }, 60000)
  }

  /**
   * Get count of recent actions of a type
   */
  getRecentActionCount(aiId, actionType) {
    return this.recentActions.get(`${aiId}_${actionType}`) || 0
  }

  /**
   * Clear market price cache (for testing)
   */
  clearPriceCache() {
    this.marketPrices.clear()
  }
}

// Singleton instance
export const aiDecisionEngine = new AIDecisionEngineClass()
export default aiDecisionEngine
