/**
 * ResponseGenerator - Template-based response building for S.A.R.A.H.
 *
 * Generates contextual responses using templates with dynamic data injection
 * and personality filtering.
 */

import { sarahPersonality } from './SarahPersonality'
import { sarahKnowledgeBase } from './SarahKnowledgeBase'
import { INTENT_TYPES } from './IntentClassifier'
import { gameManager } from '../GameManager'

// Response templates by intent type
const RESPONSE_TEMPLATES = {
  [INTENT_TYPES.GREETING]: {
    templates: [
      "{greeting}",
      "{greeting} What's on your mind?",
      "{greeting} Need something?",
    ],
  },

  [INTENT_TYPES.THANKS]: {
    templates: [
      "{thanks}",
      "{thanks} Anything else?",
    ],
  },

  [INTENT_TYPES.WHO_ARE_YOU]: {
    templates: [
      "I'm S.A.R.A.H. - Street Autonomous Response & Assistance Hub. Your personal AI guide to the streets. I can help with crime advice, job tips, heat management, market analysis, and more. Just ask.",
      "S.A.R.A.H. here - your network uplink to street intel. I analyze your stats, recommend moves, and keep you one step ahead. What do you need?",
    ],
  },

  [INTENT_TYPES.HELP]: {
    templates: [
      "{helpIntro}\n• Crime advice - \"what crime should I do?\"\n• Job tips - \"what job is best?\"\n• Heat management - \"how do I reduce heat?\"\n• Money strategy - \"how do I make money?\"\n• Player intel - \"tell me about [name]\"\n• Game mechanics - \"what is heat?\"\n• Your status - \"how am I doing?\"\n• Market info - \"what should I trade?\"",
    ],
  },

  [INTENT_TYPES.CRIME_ADVICE]: {
    templates: [
      "Based on your Level {level} stats and {heat}% heat, I'd suggest {crimeName}. {reason}. {heatWarning}",
      "Running the numbers... {crimeName} looks solid for you right now. {reason}. {heatWarning}",
      "My recommendation? {crimeName}. Here's why: {reason}. {heatWarning}",
    ],
    noEnergy: [
      "You're running on fumes, runner. {energy} energy won't cut it for any crimes. Wait for regen or grab an energy drink.",
      "Not enough juice in the tank ({energy} energy). Chill for a bit or do a quick job while you recharge.",
    ],
  },

  [INTENT_TYPES.JOB_ADVICE]: {
    templates: [
      "For safe income at Level {level}, check out the Jobs board. No heat, steady pay. Good for laying low or while energy regens.",
      "Jobs are your clean money option. No heat gain, consistent pay. Check what's available at your level - higher tier jobs pay more.",
      "Need legit work? Jobs won't get you rich fast but they won't get you arrested either. Solid choice when heat's high.",
    ],
  },

  [INTENT_TYPES.MONEY_ADVICE]: {
    templates: [
      "Money strategy for Level {level}:\n• Short term: {shortTerm}\n• Long term: {longTerm}\n• Pro tip: {proTip}",
      "Want to get paid? Here's the play:\n{moneyAdvice}",
    ],
  },

  [INTENT_TYPES.HEAT_ADVICE]: {
    templates: [
      "Heat's at {heat}% - {heatStatus}. Your options:\n• Do legit jobs (safest, productive)\n• Lay low (costs energy)\n• Bribe cops (costs cash)\n• Wait it out (decays ~1/min)\n{equipmentTip}",
      "The fuzz got eyes on you at {heat}% heat. {heatStatus}.\n{heatAdvice}",
    ],
  },

  [INTENT_TYPES.INVESTMENT]: {
    templates: [
      "Property investment at your level:\n{propertyAdvice}\n\nProperties = passive income while offline. Start small, build up.",
      "Real estate play:\n{propertyAdvice}\n\nThe earlier you buy, the more you earn over time.",
    ],
  },

  [INTENT_TYPES.STAT_ANALYSIS]: {
    templates: [
      "Here's your rundown, runner:\n{statBreakdown}\n\n{assessment}",
      "Status check:\n{statBreakdown}\n\n{assessment}",
    ],
  },

  [INTENT_TYPES.AI_INTEL]: {
    templates: [
      "{playerName} - Level {playerLevel} {personality}. {description}\nTrust level: {trustLevel}. {advice}",
      "Intel on {playerName}:\n• Type: {personality}\n• Level: {playerLevel}\n• {description}\n• Trust: {trustLevel}\n{advice}",
    ],
    notFound: [
      "No data on '{query}' in my database. Sure you got the name right?",
      "'{query}' isn't in the network. Check the name and try again.",
    ],
  },

  [INTENT_TYPES.MARKET_ANALYSIS]: {
    templates: [
      "Market scan:\n{marketData}\n\n{tradingAdvice}",
      "Trading intel:\n{marketData}\n\nRemember: higher profit = higher risk. {tradingAdvice}",
    ],
  },

  [INTENT_TYPES.ACHIEVEMENT]: {
    templates: [
      "Achievement status:\n{achievementInfo}",
      "Badge progress:\n{achievementInfo}",
    ],
  },

  [INTENT_TYPES.PROGRESS]: {
    templates: [
      "Level {level} progress:\n• XP: {currentXP}/{nextLevelXP}\n• {xpNeeded} XP to level {nextLevel}\n• {progressPercent}% complete\n\n{levelAdvice}",
    ],
  },

  [INTENT_TYPES.WHAT_IS]: {
    templates: [
      "{mechanicExplanation}\n\nTips:\n{tips}",
      "{mechanicExplanation}\n\n{tips}",
    ],
  },

  [INTENT_TYPES.HOW_TO]: {
    templates: [
      "{howToAnswer}",
    ],
  },

  [INTENT_TYPES.UNKNOWN]: {
    templates: null, // Uses personality unknown responses
  },
}

class ResponseGenerator {
  /**
   * Generate a response for the given intent and context
   */
  generateResponse(intent, context = {}, entities = {}) {
    const templates = RESPONSE_TEMPLATES[intent]

    if (!templates || !templates.templates) {
      return sarahPersonality.getUnknownResponse()
    }

    // Build data for template injection
    const data = this.buildResponseData(intent, context, entities)

    // Select random template
    const template = sarahPersonality.pickRandom(templates.templates)

    // Inject data into template
    let response = this.injectData(template, data)

    // Apply personality touches
    response = sarahPersonality.formatResponse(response)

    return response
  }

  /**
   * Build data object for template injection based on intent
   */
  buildResponseData(intent, context, entities) {
    const player = gameManager.player || {}
    const data = {
      // Basic player stats
      level: player.level || 1,
      energy: player.energy || 0,
      heat: player.heat || 0,
      cash: player.cash || 0,
      bank: player.bank || 0,
      health: player.health || 100,
      respect: player.respect || 0,

      // Personality elements
      greeting: sarahPersonality.getGreeting(),
      thanks: sarahPersonality.getThanksResponse(),
      signoff: sarahPersonality.getSignoff(),
      helpIntro: sarahPersonality.pickRandom([
        "Here's what I can help with:",
        "My capabilities include:",
        "I've got you covered on:",
      ]),
    }

    // Intent-specific data
    switch (intent) {
      case INTENT_TYPES.CRIME_ADVICE:
        this.addCrimeAdviceData(data, player, context)
        break

      case INTENT_TYPES.MONEY_ADVICE:
        this.addMoneyAdviceData(data, player)
        break

      case INTENT_TYPES.HEAT_ADVICE:
        this.addHeatAdviceData(data, player)
        break

      case INTENT_TYPES.INVESTMENT:
        this.addInvestmentData(data, player)
        break

      case INTENT_TYPES.STAT_ANALYSIS:
        this.addStatAnalysisData(data, player)
        break

      case INTENT_TYPES.AI_INTEL:
        this.addAIIntelData(data, entities, context)
        break

      case INTENT_TYPES.MARKET_ANALYSIS:
        this.addMarketData(data)
        break

      case INTENT_TYPES.PROGRESS:
        this.addProgressData(data, player)
        break

      case INTENT_TYPES.WHAT_IS:
      case INTENT_TYPES.HOW_TO:
        this.addMechanicData(data, context, entities)
        break

      case INTENT_TYPES.ACHIEVEMENT:
        this.addAchievementData(data, player)
        break
    }

    return data
  }

  /**
   * Add crime advice data
   */
  addCrimeAdviceData(data, player, context) {
    // Get recommendation from knowledge base
    const crimes = gameManager.crimes || []
    const recommendation = sarahKnowledgeBase.getCrimeRecommendation(player, crimes)

    if (recommendation && recommendation.recommendation) {
      const crime = recommendation.recommendation
      data.crimeName = crime.name
      data.reason = recommendation.reason
      data.successRate = crime.successRate || 'unknown'
      data.minPayout = crime.minPayout || 0
      data.maxPayout = crime.maxPayout || 0

      // Heat warning
      if (player.heat >= 60) {
        data.heatWarning = "But watch it - your heat's high. Consider laying low after."
      } else if (player.heat >= 40) {
        data.heatWarning = "Your heat's moderate - one more shouldn't hurt."
      } else {
        data.heatWarning = "Heat's manageable. Go for it."
      }
    } else {
      data.crimeName = 'rest'
      data.reason = recommendation?.reason || "Need to wait for energy"
      data.heatWarning = ''
    }
  }

  /**
   * Add money advice data
   */
  addMoneyAdviceData(data, player) {
    const advice = sarahKnowledgeBase.getStrategicAdvice(player.level)

    if (player.level <= 10) {
      data.shortTerm = "Grind pickpocketing/shoplifting for steady income"
      data.longTerm = "Save $5k for your first property (Small Apartment)"
      data.proTip = "Bank everything - you lose cash on arrest, not bank money"
    } else if (player.level <= 25) {
      data.shortTerm = "Car Theft and Burglary are your main earners now"
      data.longTerm = "Build property portfolio - each one adds up"
      data.proTip = "Consider trading goods for bigger profits (with more risk)"
    } else {
      data.shortTerm = "White collar crimes have great risk/reward"
      data.longTerm = "Heists are where the real money is"
      data.proTip = "Diversify - properties, trading, and crimes together"
    }

    data.moneyAdvice = `${advice.general}\n\n${advice.priorities.map(p => '• ' + p).join('\n')}`
  }

  /**
   * Add heat advice data
   */
  addHeatAdviceData(data, player) {
    // Heat status
    if (player.heat >= 80) {
      data.heatStatus = "DANGER ZONE. You're practically on the most wanted list"
    } else if (player.heat >= 60) {
      data.heatStatus = "Getting hot. The badges are definitely looking"
    } else if (player.heat >= 40) {
      data.heatStatus = "Moderate. You're on their radar"
    } else if (player.heat >= 20) {
      data.heatStatus = "Low profile. You're mostly clean"
    } else {
      data.heatStatus = "Ghost mode. Nobody's looking for you"
    }

    // Equipment tip
    if (player.heat >= 50) {
      data.equipmentTip = "Pro tip: Police Scanner reduces heat gain. Ski Mask helps too."
    } else {
      data.equipmentTip = ""
    }

    // Specific advice
    const heatAdvice = []
    if (player.heat >= 70) {
      heatAdvice.push("Seriously, stop doing crimes for a bit")
      heatAdvice.push("Jobs will help you stay productive while cooling off")
    }
    if (player.cash >= 500) {
      heatAdvice.push("You could bribe a cop for quick relief")
    }
    heatAdvice.push("Heat decays naturally at about 1 point per minute")

    data.heatAdvice = heatAdvice.join('\n• ')
  }

  /**
   * Add investment data
   */
  addInvestmentData(data, player) {
    const properties = [
      { name: 'Small Apartment', cost: 5000, income: 10 },
      { name: 'Garage', cost: 15000, income: 25 },
      { name: 'Warehouse', cost: 50000, income: 75 },
      { name: 'Nightclub', cost: 100000, income: 150 },
      { name: 'Penthouse', cost: 250000, income: 300 },
    ]

    const totalCash = (player.cash || 0) + (player.bank || 0)
    const affordable = properties.filter(p => p.cost <= totalCash)

    if (affordable.length === 0) {
      data.propertyAdvice = `You need at least $5k for the cheapest property (Small Apartment). You've got $${totalCash.toLocaleString()} total. Keep grinding!`
    } else {
      const best = affordable[affordable.length - 1]
      data.propertyAdvice = `Best you can afford: ${best.name} ($${best.cost.toLocaleString()}) = $${best.income}/hour\n\nAll options:\n${affordable.map(p => `• ${p.name}: $${p.cost.toLocaleString()} → $${p.income}/hr`).join('\n')}`
    }
  }

  /**
   * Add stat analysis data
   */
  addStatAnalysisData(data, player) {
    // Build stat breakdown
    const stats = [
      `Level: ${player.level || 1}`,
      `Cash: $${(player.cash || 0).toLocaleString()}`,
      `Bank: $${(player.bank || 0).toLocaleString()}`,
      `Energy: ${player.energy || 0}/100`,
      `Heat: ${player.heat || 0}%`,
      `Health: ${player.health || 100}%`,
      `Respect: ${player.respect || 0}`,
    ]
    data.statBreakdown = stats.join('\n• ')

    // Assessment
    const issues = []
    if ((player.heat || 0) >= 60) issues.push("heat's too high")
    if ((player.energy || 0) < 20) issues.push("energy's low")
    if ((player.health || 0) < 50) issues.push("health needs attention")
    if ((player.cash || 0) > 10000 && (player.bank || 0) < (player.cash || 0)) {
      issues.push("you should bank that cash")
    }

    if (issues.length === 0) {
      data.assessment = "Looking solid, runner. You're in good shape to make moves."
    } else {
      data.assessment = `Heads up: ${issues.join(', ')}. Handle those first.`
    }
  }

  /**
   * Add AI intel data
   */
  addAIIntelData(data, entities, context) {
    // Try to find AI player
    const name = entities.playerName || context.query || ''

    // For now, generate generic intel
    // In full implementation, this would query AIPlayerManager
    data.playerName = name || 'Unknown'
    data.playerLevel = Math.floor(Math.random() * 40) + 5
    data.personality = sarahPersonality.pickRandom(['Hustler', 'Enforcer', 'Networker', 'Wildcard', 'Mentor'])
    data.description = "Active in the network, running their own ops."
    data.trustLevel = sarahPersonality.pickRandom(['Low', 'Neutral', 'Moderate', 'High'])
    data.advice = data.trustLevel === 'Low'
      ? "Watch your back with this one."
      : "Seems reasonable to work with."
  }

  /**
   * Add market data
   */
  addMarketData(data) {
    const goods = [
      { name: 'Cannabis', risk: 'Low', profit: '$50-100' },
      { name: 'Pills', risk: 'Medium', profit: '$150-250' },
      { name: 'Cocaine', risk: 'High', profit: '$400-600' },
      { name: 'Firearms', risk: 'Very High', profit: '$800-1200' },
      { name: 'Stolen Goods', risk: 'Low', profit: '$100-150' },
      { name: 'Hot Electronics', risk: 'Medium', profit: '$200-300' },
    ]

    data.marketData = goods.map(g => `• ${g.name}: ${g.profit} profit (${g.risk} risk)`).join('\n')
    data.tradingAdvice = "Buy low in one district, sell high in another. Watch for market events."
  }

  /**
   * Add progress data
   */
  addProgressData(data, player) {
    const level = player.level || 1
    const currentXP = player.xp || 0

    // XP requirements (simplified)
    const xpTable = [0, 0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000]
    const nextLevelXP = xpTable[level + 1] || (xpTable[xpTable.length - 1] * 2)
    const xpNeeded = nextLevelXP - currentXP

    data.currentXP = currentXP
    data.nextLevelXP = nextLevelXP
    data.xpNeeded = Math.max(0, xpNeeded)
    data.nextLevel = level + 1
    data.progressPercent = Math.min(100, Math.floor((currentXP / nextLevelXP) * 100))

    if (data.progressPercent >= 90) {
      data.levelAdvice = "Almost there! A few more crimes should push you over."
    } else if (data.progressPercent >= 50) {
      data.levelAdvice = "Halfway there. Keep grinding."
    } else {
      data.levelAdvice = "Long way to go. Focus on crimes that match your level for best XP."
    }
  }

  /**
   * Add mechanic explanation data
   */
  addMechanicData(data, context, entities) {
    const query = context.originalQuery || ''
    const mechanic = sarahKnowledgeBase.findMechanic(query)

    if (mechanic) {
      data.mechanicExplanation = mechanic.explanation
      data.tips = mechanic.tips.map(t => '• ' + t).join('\n')
    } else {
      // Try FAQ
      const faqAnswer = sarahKnowledgeBase.findFAQ(query)
      if (faqAnswer) {
        data.mechanicExplanation = faqAnswer
        data.tips = ''
      } else {
        data.mechanicExplanation = "I don't have specific info on that. Try asking differently or check 'ask help' for what I can answer."
        data.tips = ''
      }
    }

    data.howToAnswer = data.mechanicExplanation
  }

  /**
   * Add achievement data
   */
  addAchievementData(data, player) {
    // Simplified - would connect to actual achievement system
    data.achievementInfo = "Achievement tracking coming soon. For now, focus on leveling up and building your empire."
  }

  /**
   * Inject data into template string
   */
  injectData(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match
    })
  }

  /**
   * Generate proactive message
   */
  generateProactiveMessage(trigger, data) {
    const messages = {
      lowEnergy: [
        "Hey runner, you're running on fumes. {energy} energy left. Maybe chill or grab an energy drink.",
        "Energy's at {energy}. Might want to wait for regen or do something that doesn't cost energy.",
      ],
      highHeat: [
        "Yo, heat's climbing - {heat}%. The badges are getting interested. Maybe lay low?",
        "Warning: {heat}% heat. You're getting hot. Consider some legit work until it cools off.",
      ],
      achievementClose: [
        "FYI, you're {progress}% to unlocking '{achievement}'. A few more {action}s and it's yours.",
      ],
      levelUp: [
        "Level {level}. Nice work, runner. New opportunities just opened up for you.",
        "You hit Level {level}! More crimes and features are now available. Keep climbing.",
      ],
      aiMessage: [
        "Got a ping from {sender}. Might be worth checking your inbox.",
        "Incoming message from {sender}. Could be an opportunity.",
      ],
    }

    const templates = messages[trigger]
    if (!templates) return null

    const template = sarahPersonality.pickRandom(templates)
    return this.injectData(template, data)
  }
}

// Singleton instance
export const responseGenerator = new ResponseGenerator()

export default responseGenerator
