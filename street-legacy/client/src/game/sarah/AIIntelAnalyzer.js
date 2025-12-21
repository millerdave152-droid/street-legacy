/**
 * AIIntelAnalyzer - Bridge between S.A.R.A.H. and AI player systems
 *
 * Provides real intel on AI players by connecting to:
 * - AIPlayerManager (player data, personalities)
 * - AIMessageManager (offers, deception tracking)
 * - AIDecisionEngine (market data, behavior prediction)
 */

import { aiPlayerManager } from '../managers/AIPlayerManager'
import { aiMessageManager } from '../managers/AIMessageManager'
import { aiDecisionEngine } from '../managers/AIDecisionEngine'
import { gameManager } from '../GameManager'

// Deception types from AIMessageManager
const DECEPTION_TYPES = {
  INFLATED_PRICE: 'Inflated prices',
  BAD_INTEL: 'False market tips',
  BETRAYAL: 'Alliance betrayal risk',
  FALSE_PANIC: 'Fake warnings',
  SCAM: 'Investment scam',
  EXTORTION: 'Protection racket',
  SETUP: 'Job trap',
  DEBT_TRAP: 'Gift with strings',
}

class AIIntelAnalyzer {
  /**
   * Get comprehensive intel on an AI player by name
   */
  getAIPlayerIntel(name) {
    if (!aiPlayerManager) {
      return this.getFallbackIntel(name)
    }

    // Try to find by name (case-insensitive)
    const aiPlayers = aiPlayerManager.aiPlayers || []
    const aiPlayer = aiPlayers.find(
      ai => ai.username?.toLowerCase() === name.toLowerCase()
    )

    if (!aiPlayer) {
      return {
        found: false,
        name,
        message: `No intel on "${name}" in my database. Check the name?`,
      }
    }

    // Build comprehensive profile
    const profile = {
      found: true,
      name: aiPlayer.username,
      level: aiPlayer.level || 1,
      personality: aiPlayer.personality || 'Unknown',
      crewName: aiPlayer.crewName || 'Independent',

      // Stats
      wealth: aiPlayer.cash + (aiPlayer.bank || 0),
      respect: aiPlayer.respect || 0,
      heat: aiPlayer.heat || 0,

      // Personality traits
      traits: aiPlayer.traits || {},
      aggressiveness: aiPlayer.traits?.aggressiveness || 0.5,
      trustworthiness: 1 - (aiPlayer.traits?.deceptiveness || 0.5),

      // Relationship with player
      relationshipType: aiPlayer.playerRelationship || 'neutral',
      trustLevel: aiPlayer.playerTrust || 50,

      // Message history analysis
      messageHistory: this.analyzeMessageHistory(aiPlayer.id),

      // Threat assessment
      threatLevel: this.calculateThreatLevel(aiPlayer),

      // Recommendation
      recommendation: this.getRelationshipRecommendation(aiPlayer),
    }

    return profile
  }

  /**
   * Analyze message history for deception patterns
   */
  analyzeMessageHistory(aiPlayerId) {
    if (!aiMessageManager?.messageHistory) {
      return { totalMessages: 0, deceptionRate: 0 }
    }

    const history = aiMessageManager.messageHistory[aiPlayerId] || {
      totalMessages: 0,
      honestDeals: 0,
      deceptiveDeals: 0,
    }

    const totalDeals = history.honestDeals + history.deceptiveDeals
    const deceptionRate = totalDeals > 0
      ? (history.deceptiveDeals / totalDeals) * 100
      : 0

    return {
      totalMessages: history.totalMessages,
      honestDeals: history.honestDeals,
      deceptiveDeals: history.deceptiveDeals,
      deceptionRate: Math.round(deceptionRate),
    }
  }

  /**
   * Calculate threat level of an AI player
   */
  calculateThreatLevel(aiPlayer) {
    let threatScore = 0

    // Higher level = more threat
    threatScore += (aiPlayer.level || 1) * 2

    // More aggressive = more threat
    threatScore += (aiPlayer.traits?.aggressiveness || 0.5) * 30

    // Hostile relationship = major threat
    if (aiPlayer.playerRelationship === 'hostile') {
      threatScore += 40
    } else if (aiPlayer.playerRelationship === 'rival') {
      threatScore += 25
    }

    // More wealth = more resources to attack
    const wealth = (aiPlayer.cash || 0) + (aiPlayer.bank || 0)
    threatScore += Math.min(20, wealth / 10000)

    // Cap at 100
    threatScore = Math.min(100, threatScore)

    // Categorize
    if (threatScore >= 70) return { score: threatScore, level: 'HIGH', warning: 'Major threat - stay alert' }
    if (threatScore >= 40) return { score: threatScore, level: 'MEDIUM', warning: 'Keep an eye on them' }
    return { score: threatScore, level: 'LOW', warning: 'Not a significant threat' }
  }

  /**
   * Get relationship recommendation for an AI player
   */
  getRelationshipRecommendation(aiPlayer) {
    const trustworthiness = 1 - (aiPlayer.traits?.deceptiveness || 0.5)
    const aggressiveness = aiPlayer.traits?.aggressiveness || 0.5
    const relationship = aiPlayer.playerRelationship

    if (relationship === 'allied') {
      if (trustworthiness < 0.4) {
        return 'Allied but untrustworthy - watch your back'
      }
      return 'Good ally - maintain the relationship'
    }

    if (relationship === 'hostile' || relationship === 'rival') {
      return 'Hostile - avoid or prepare for conflict'
    }

    // Neutral - should we ally?
    if (trustworthiness > 0.6 && aggressiveness < 0.5) {
      return 'Potential ally - trustworthy and not too aggressive'
    }

    if (trustworthiness < 0.4) {
      return 'Risky - high chance of deception in deals'
    }

    return 'Neutral - proceed with caution'
  }

  /**
   * Get all active threats (hostile/rival AI players)
   */
  getActiveThreats() {
    if (!aiPlayerManager?.aiPlayers) {
      return []
    }

    const threats = aiPlayerManager.aiPlayers
      .filter(ai =>
        ai.playerRelationship === 'hostile' ||
        ai.playerRelationship === 'rival'
      )
      .map(ai => ({
        name: ai.username,
        level: ai.level,
        type: ai.playerRelationship,
        personality: ai.personality,
        threat: this.calculateThreatLevel(ai),
      }))
      .sort((a, b) => b.threat.score - a.threat.score)

    return threats
  }

  /**
   * Analyze a trade offer for deception
   */
  analyzeTradeOffer(offer) {
    if (!offer) {
      return { safe: false, message: 'No offer data to analyze' }
    }

    const analysis = {
      sender: offer.sender || offer.from || 'Unknown',
      type: offer.type || 'UNKNOWN',
      safe: true,
      warnings: [],
      recommendation: 'accept',
    }

    // Check for known deception types
    if (offer.deceptionType) {
      analysis.safe = false
      analysis.warnings.push(DECEPTION_TYPES[offer.deceptionType] || 'Unknown scam type')
      analysis.recommendation = 'decline'
    }

    // Check sender's deception history
    const senderHistory = this.analyzeMessageHistory(offer.senderId)
    if (senderHistory.deceptionRate > 30) {
      analysis.warnings.push(`Sender has ${senderHistory.deceptionRate}% deception rate`)
      if (senderHistory.deceptionRate > 50) {
        analysis.safe = false
        analysis.recommendation = 'decline'
      }
    }

    // Check for unrealistic returns (scam indicator)
    if (offer.type === 'INVESTMENT' && offer.returnRate > 50) {
      analysis.safe = false
      analysis.warnings.push('Return rate too good to be true')
      analysis.recommendation = 'decline'
    }

    // Check price against market (if available)
    if (offer.price && offer.goodType && aiDecisionEngine) {
      const marketPrice = aiDecisionEngine.getCurrentPrice?.(offer.goodType)
      if (marketPrice && offer.price > marketPrice * 1.3) {
        analysis.warnings.push(`Price is ${Math.round((offer.price / marketPrice - 1) * 100)}% above market`)
        analysis.safe = false
        analysis.recommendation = 'negotiate'
      }
    }

    // Generate final message
    if (!analysis.safe) {
      analysis.message = `WARNING: ${analysis.warnings.join('. ')}. Recommendation: ${analysis.recommendation.toUpperCase()}.`
    } else if (analysis.warnings.length > 0) {
      analysis.message = `Proceed with caution: ${analysis.warnings.join('. ')}. But probably okay.`
    } else {
      analysis.message = 'Looks like a legit deal. Should be safe to accept.'
    }

    return analysis
  }

  /**
   * Suggest alliance targets
   */
  suggestAlliances(playerData) {
    if (!aiPlayerManager?.aiPlayers) {
      return []
    }

    const suggestions = aiPlayerManager.aiPlayers
      .filter(ai => ai.playerRelationship === 'neutral')
      .map(ai => {
        const trustworthiness = 1 - (ai.traits?.deceptiveness || 0.5)
        const compatibility = this.calculateCompatibility(ai, playerData)

        return {
          name: ai.username,
          level: ai.level,
          personality: ai.personality,
          trustworthiness: Math.round(trustworthiness * 100),
          compatibility,
          reason: this.getAllianceReason(ai, compatibility),
        }
      })
      .filter(s => s.compatibility > 50)
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, 5)

    return suggestions
  }

  /**
   * Calculate compatibility with an AI player
   */
  calculateCompatibility(aiPlayer, playerData) {
    let score = 50 // Base neutral

    // Trustworthiness is good
    const trustworthiness = 1 - (aiPlayer.traits?.deceptiveness || 0.5)
    score += trustworthiness * 30

    // Similar level is good for cooperation
    const levelDiff = Math.abs((aiPlayer.level || 1) - (playerData?.level || 1))
    score -= Math.min(20, levelDiff * 2)

    // Low aggression is safer
    const aggression = aiPlayer.traits?.aggressiveness || 0.5
    score += (1 - aggression) * 20

    // Networker/Mentor personalities are best allies
    if (['Networker', 'Mentor'].includes(aiPlayer.personality)) {
      score += 15
    }

    // Manipulator/Wildcard are risky
    if (['Manipulator', 'Wildcard'].includes(aiPlayer.personality)) {
      score -= 15
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Get reason for alliance suggestion
   */
  getAllianceReason(aiPlayer, compatibility) {
    if (compatibility >= 80) {
      return 'Highly compatible - trustworthy and cooperative'
    }
    if (compatibility >= 65) {
      return 'Good potential ally - worth approaching'
    }
    if (compatibility >= 50) {
      return 'Possible ally - proceed carefully'
    }
    return 'Risky alliance - better options exist'
  }

  /**
   * Predict what an AI player might do next
   */
  predictAIAction(aiPlayer) {
    if (!aiPlayer) {
      return 'Unable to predict - no data'
    }

    const personality = aiPlayer.personality
    const aggression = aiPlayer.traits?.aggressiveness || 0.5
    const wealth = (aiPlayer.cash || 0) + (aiPlayer.bank || 0)

    const predictions = []

    // Aggressive + hostile = likely attack
    if (aggression > 0.7 && aiPlayer.playerRelationship === 'hostile') {
      predictions.push('Likely to attack or undercut you soon')
    }

    // Low on cash = desperate moves
    if (wealth < 1000 && aggression > 0.5) {
      predictions.push('May attempt risky crimes or ask for "loans"')
    }

    // High wealth + deceptive = scam offers
    if (wealth > 50000 && (aiPlayer.traits?.deceptiveness || 0) > 0.6) {
      predictions.push('May send deceptive offers to grow wealth further')
    }

    // Personality-based predictions
    switch (personality) {
      case 'Enforcer':
        predictions.push('Will demand respect or retaliate')
        break
      case 'Hustler':
        predictions.push('Always looking for deals - expect offers')
        break
      case 'Networker':
        predictions.push('May reach out to form connections')
        break
      case 'Manipulator':
        predictions.push('Watch for deceptive schemes')
        break
    }

    return predictions.length > 0
      ? predictions.join('. ')
      : 'No significant predicted actions'
  }

  /**
   * Fallback intel when AI systems not available
   */
  getFallbackIntel(name) {
    return {
      found: true,
      name,
      level: Math.floor(Math.random() * 40) + 5,
      personality: ['Hustler', 'Enforcer', 'Networker', 'Wildcard'][Math.floor(Math.random() * 4)],
      trustLevel: Math.floor(Math.random() * 100),
      message: 'Limited intel available - AI systems initializing',
      recommendation: 'Proceed with caution until more data available',
    }
  }
}

// Singleton instance
export const aiIntelAnalyzer = new AIIntelAnalyzer()

export default aiIntelAnalyzer
