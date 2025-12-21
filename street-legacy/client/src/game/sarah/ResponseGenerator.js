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
import { aiIntelAnalyzer } from './AIIntelAnalyzer'
import { visualFormatter } from './VisualFormatter'

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

  // ===== NEW INTENT TEMPLATES =====

  // Crew & Equipment
  [INTENT_TYPES.CREW_MANAGEMENT]: {
    templates: [
      "Crew management advice:\n{crewAdvice}\n\nCrew members boost your heist success rates and bring special abilities.",
      "Looking to build your team?\n{crewAdvice}\n\nRemember: quality over quantity. Each member costs upkeep.",
    ],
  },

  [INTENT_TYPES.CREW_SYNERGY]: {
    templates: [
      "For {heistType}:\n{synergyAdvice}\n\nThe right combo can boost success by 20%+.",
      "Best crew combos for {heistType}:\n{synergyAdvice}",
    ],
  },

  [INTENT_TYPES.EQUIPMENT_ADVICE]: {
    templates: [
      "Equipment recommendation for Level {level}:\n{equipmentAdvice}\n\nGear makes the difference between success and jail time.",
      "Based on your playstyle:\n{equipmentAdvice}",
    ],
  },

  [INTENT_TYPES.EQUIPMENT_COMPARE]: {
    templates: [
      "Comparison:\n{comparisonData}\n\nBottom line: {recommendation}",
      "{item1} vs {item2}:\n{comparisonData}\n\n→ {recommendation}",
    ],
  },

  // Location & Strategy
  [INTENT_TYPES.LOCATION_TIPS]: {
    templates: [
      "{districtName} breakdown:\n{districtInfo}\n\nTips:\n{districtTips}",
      "Intel on {districtName}:\n{districtInfo}\n\nPro tips:\n{districtTips}",
    ],
  },

  [INTENT_TYPES.TERRITORY_STRATEGY]: {
    templates: [
      "Territory control strategy:\n{territoryAdvice}\n\nControlling turf = passive income + respect. Worth the effort.",
      "Turf war tactics:\n{territoryAdvice}",
    ],
  },

  [INTENT_TYPES.TIME_MANAGEMENT]: {
    templates: [
      "Priority analysis:\n{priorityList}\n\nFocus on: {topPriority}",
      "Right now you should:\n{priorityList}\n\n→ {topPriority}",
    ],
  },

  [INTENT_TYPES.EFFICIENCY]: {
    templates: [
      "Optimal path to {goal}:\n{efficiencyPath}\n\nEstimated: {estimate}",
      "Fastest route:\n{efficiencyPath}\n\nKey: {efficiencyTip}",
    ],
  },

  // Legal & Jail
  [INTENT_TYPES.JAIL_STRATEGY]: {
    templates: [
      "Jail situation analysis:\n{jailAdvice}\n\nOptions:\n{jailOptions}",
      "Behind bars? Here's the play:\n{jailAdvice}\n\n{jailOptions}",
    ],
  },

  [INTENT_TYPES.LAWYER_ADVICE]: {
    templates: [
      "Legal defense options:\n{lawyerAdvice}\n\nBetter lawyers = shorter sentences, but cost more upfront.",
      "Lawyer breakdown:\n{lawyerAdvice}\n\nInvest in good legal help - it pays off.",
    ],
  },

  [INTENT_TYPES.PAROLE_STRATEGY]: {
    templates: [
      "Parole tactics:\n{paroleAdvice}\n\nGood behavior is key, but it's not the only way.",
      "Getting out early:\n{paroleAdvice}",
    ],
  },

  // AI Players
  [INTENT_TYPES.AI_RELATIONSHIP]: {
    templates: [
      "Relationship analysis for {playerName}:\n{relationshipData}\n\nRecommendation: {recommendation}",
      "{playerName} relationship status:\n{relationshipData}\n\n→ {recommendation}",
    ],
  },

  [INTENT_TYPES.AI_THREAT]: {
    templates: [
      "Threat assessment:\n{threatList}\n\nWatch your back around these ones.",
      "Active threats detected:\n{threatList}\n\nStay alert, runner.",
    ],
    noThreats: [
      "All clear - no major threats detected right now. But stay sharp.",
      "No immediate threats on your radar. Keep it that way.",
    ],
  },

  [INTENT_TYPES.TRADE_ANALYSIS]: {
    templates: [
      "Trade analysis:\n{tradeAnalysis}\n\nVerdict: {verdict}",
      "Scanning this deal...\n{tradeAnalysis}\n\n→ {verdict}",
    ],
  },

  [INTENT_TYPES.ALLIANCE_STRATEGY]: {
    templates: [
      "Alliance recommendations:\n{allianceList}\n\nChoose wisely - allies can become enemies.",
      "Potential partners:\n{allianceList}\n\nTrust is earned, not given.",
    ],
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

      // New intent data builders
      case INTENT_TYPES.CREW_MANAGEMENT:
        this.addCrewManagementData(data, player)
        break

      case INTENT_TYPES.CREW_SYNERGY:
        this.addCrewSynergyData(data, entities, context)
        break

      case INTENT_TYPES.EQUIPMENT_ADVICE:
        this.addEquipmentAdviceData(data, player)
        break

      case INTENT_TYPES.EQUIPMENT_COMPARE:
        this.addEquipmentCompareData(data, entities, context)
        break

      case INTENT_TYPES.LOCATION_TIPS:
        this.addLocationTipsData(data, entities)
        break

      case INTENT_TYPES.TERRITORY_STRATEGY:
        this.addTerritoryData(data, player)
        break

      case INTENT_TYPES.TIME_MANAGEMENT:
        this.addTimeManagementData(data, player)
        break

      case INTENT_TYPES.EFFICIENCY:
        this.addEfficiencyData(data, player, context)
        break

      case INTENT_TYPES.JAIL_STRATEGY:
        this.addJailStrategyData(data, player)
        break

      case INTENT_TYPES.LAWYER_ADVICE:
        this.addLawyerAdviceData(data, player)
        break

      case INTENT_TYPES.PAROLE_STRATEGY:
        this.addParoleStrategyData(data, player)
        break

      case INTENT_TYPES.AI_RELATIONSHIP:
        this.addAIRelationshipData(data, entities)
        break

      case INTENT_TYPES.AI_THREAT:
        this.addAIThreatData(data)
        break

      case INTENT_TYPES.TRADE_ANALYSIS:
        this.addTradeAnalysisData(data, context)
        break

      case INTENT_TYPES.ALLIANCE_STRATEGY:
        this.addAllianceStrategyData(data, player)
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

  // ===== NEW DATA BUILDERS =====

  /**
   * Add crew management data
   */
  addCrewManagementData(data, player) {
    const level = player.level || 1
    const cash = (player.cash || 0) + (player.bank || 0)

    const crewAdvice = []
    if (level < 10) {
      crewAdvice.push("You need Level 10 to start recruiting crew members")
      crewAdvice.push("Focus on building your rep and cash first")
    } else {
      crewAdvice.push("• Check the Crew tab for available members")
      crewAdvice.push("• Each crew member has unique skills (Driver, Hacker, Muscle, etc.)")
      crewAdvice.push("• Higher tier members cost more but boost heist success")
      if (cash < 5000) {
        crewAdvice.push("• Build up more cash before hiring - good crew isn't cheap")
      } else {
        crewAdvice.push("• You've got enough to start building your team")
      }
    }
    data.crewAdvice = crewAdvice.join('\n')
  }

  /**
   * Add crew synergy data
   */
  addCrewSynergyData(data, entities, context) {
    const query = context.originalQuery || ''

    // Detect heist type from query
    let heistType = 'general heists'
    if (query.includes('bank')) heistType = 'Bank Vault'
    else if (query.includes('jewelry')) heistType = 'Jewelry Store'
    else if (query.includes('casino')) heistType = 'Casino'
    else if (query.includes('museum')) heistType = 'Museum'

    data.heistType = heistType

    const synergies = {
      'Bank Vault': '• Driver (escape) + Hacker (security) + Muscle (intimidation)\n• Alt: Safecracker + Hacker + Lookout',
      'Jewelry Store': '• Safecracker (cases) + Driver (getaway) + Lookout\n• Fast in-and-out requires speed over force',
      'Casino': '• Hacker (cameras) + Con Artist (distraction) + Muscle\n• High security - need electronics expert',
      'Museum': '• Hacker (alarms) + Acrobat (lasers) + Driver\n• Stealth is key - avoid muscle builds',
      'general heists': '• Driver: Essential for escape - never skip\n• Hacker: Disables cameras and alarms\n• Muscle: Intimidation and combat backup\n• Lookout: Early warning system\n\nBest combo depends on the job.',
    }

    data.synergyAdvice = synergies[heistType] || synergies['general heists']
  }

  /**
   * Add equipment advice data
   */
  addEquipmentAdviceData(data, player) {
    const level = player.level || 1
    const heat = player.heat || 0
    const cash = (player.cash || 0) + (player.bank || 0)

    const advice = []

    // Level-based recommendations
    if (level < 10) {
      advice.push("Early game essentials:")
      advice.push("• Lockpick Set ($500) - Boosts burglary success")
      advice.push("• Ski Mask ($200) - Reduces heat gain")
      advice.push("• Switchblade ($300) - Basic protection")
    } else if (level < 25) {
      advice.push("Mid-game upgrades:")
      advice.push("• Police Scanner ($2,000) - Monitor cop activity")
      advice.push("• Glock ($1,500) - Solid firearm for protection")
      advice.push("• Laptop ($3,000) - Required for cyber crimes")
    } else {
      advice.push("End-game gear:")
      advice.push("• Hacking Rig ($15,000) - High-level cyber crimes")
      advice.push("• Kevlar Vest ($5,000) - Survive encounters")
      advice.push("• Getaway Vehicle ($25,000) - Heist essential")
    }

    // Situational advice
    if (heat >= 50) {
      advice.push("\nWith your heat level, prioritize:")
      advice.push("• Police Scanner (if you don't have it)")
      advice.push("• Burner Phone ($100) - Can tip off cops falsely")
    }

    data.equipmentAdvice = advice.join('\n')
  }

  /**
   * Add equipment comparison data
   */
  addEquipmentCompareData(data, entities, context) {
    const query = context.originalQuery || ''

    // Common comparisons
    const comparisons = {
      'pistol|knife': {
        item1: 'Pistol ($1,500)',
        item2: 'Switchblade ($300)',
        data: '• Pistol: +15% crime success, +10% heat on use\n• Knife: +8% crime success, +3% heat on use\n• Pistol is better for higher stakes',
        recommendation: 'Pistol for serious crimes, knife for low-heat grinding',
      },
      'scanner|mask': {
        item1: 'Police Scanner ($2,000)',
        item2: 'Ski Mask ($200)',
        data: '• Scanner: -20% arrest chance, see cop patrols\n• Mask: -15% heat gain, +5% robbery success\n• Different purposes - both are useful',
        recommendation: 'Get the mask first (cheaper), scanner when you can afford it',
      },
      'lockpick|crowbar': {
        item1: 'Lockpick Set ($500)',
        item2: 'Crowbar ($150)',
        data: '• Lockpick: +15% burglary success, silent entry\n• Crowbar: +8% burglary success, loud entry (+heat)\n• Lockpicks are the pro choice',
        recommendation: 'Lockpicks for serious burglars, crowbar is budget option',
      },
    }

    // Find matching comparison
    let found = null
    for (const [pattern, comp] of Object.entries(comparisons)) {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(query)) {
        found = comp
        break
      }
    }

    if (found) {
      data.item1 = found.item1
      data.item2 = found.item2
      data.comparisonData = found.data
      data.recommendation = found.recommendation
    } else {
      data.item1 = 'Item A'
      data.item2 = 'Item B'
      data.comparisonData = "I need more specifics. Try 'pistol vs knife' or 'scanner vs mask'."
      data.recommendation = "Be more specific about which items to compare"
    }
  }

  /**
   * Add location tips data
   */
  addLocationTipsData(data, entities) {
    const district = entities.district || 'downtown'

    const districts = {
      downtown: {
        name: 'Downtown',
        info: '• High-end targets: Banks, corporate offices\n• Heavy police presence\n• Best for: White collar crimes, high-stakes heists\n• Risk: HIGH | Reward: HIGH',
        tips: '• Scout during day, strike at night\n• Have an escape route planned\n• Police response time: 2-3 minutes',
      },
      parkdale: {
        name: 'Parkdale',
        info: '• Mixed residential/commercial\n• Moderate police patrols\n• Best for: Burglary, car theft, muggings\n• Risk: MEDIUM | Reward: MEDIUM',
        tips: '• Good balance of risk/reward\n• Local gangs may be territorial\n• Best starting area for mid-level players',
      },
      scarborough: {
        name: 'Scarborough',
        info: '• Industrial and suburban mix\n• Lower police presence\n• Best for: Warehouse heists, car theft, fencing\n• Risk: LOW-MEDIUM | Reward: MEDIUM',
        tips: '• Good for laying low\n• Warehouse district has valuable targets\n• Watch for rival crews',
      },
      yorkville: {
        name: 'Yorkville',
        info: '• Wealthy residential area\n• Private security common\n• Best for: High-end burglary, identity theft\n• Risk: MEDIUM-HIGH | Reward: HIGH',
        tips: '• Rich targets but alert residents\n• Security systems are better\n• Timing is everything',
      },
      kensington: {
        name: 'Kensington Market',
        info: '• Busy market area, diverse crowd\n• Moderate patrols, lots of witnesses\n• Best for: Pickpocketing, small cons, fencing\n• Risk: LOW | Reward: LOW-MEDIUM',
        tips: '• Great for beginners\n• Blend with the crowd\n• Quick hits, quick exits',
      },
    }

    const districtData = districts[district.toLowerCase()] || districts.downtown
    data.districtName = districtData.name
    data.districtInfo = districtData.info
    data.districtTips = districtData.tips
  }

  /**
   * Add territory strategy data
   */
  addTerritoryData(data, player) {
    const level = player.level || 1
    const respect = player.respect || 0

    const advice = []

    if (level < 15) {
      advice.push("Territory control unlocks at Level 15")
      advice.push("For now:")
      advice.push("• Build respect through crimes and heists")
      advice.push("• Make connections with other players")
      advice.push("• Save cash for territory wars")
    } else {
      advice.push("Territory Control Basics:")
      advice.push("• Claim turf through the Territory menu")
      advice.push("• Defend with crew and equipment")
      advice.push("• Controlled territory = passive income")
      advice.push("")
      advice.push("Strategy:")
      advice.push("• Start with low-value territories to learn")
      advice.push("• Build defense before expanding")
      advice.push("• Alliance with neighbors prevents wars")

      if (respect < 100) {
        advice.push("\nYou need more respect to claim serious turf. Keep grinding.")
      }
    }

    data.territoryAdvice = advice.join('\n')
  }

  /**
   * Add time management/priority data
   */
  addTimeManagementData(data, player) {
    const energy = player.energy || 0
    const heat = player.heat || 0
    const cash = player.cash || 0
    const health = player.health || 100
    const level = player.level || 1

    const priorities = []
    let topPriority = ''

    // Urgent issues first
    if (health < 30) {
      priorities.push("1. URGENT: Heal up - you're at risk of death")
      topPriority = "Get medical attention immediately"
    } else if (heat >= 80) {
      priorities.push("1. URGENT: Lay low - cops are closing in")
      topPriority = "Do legit jobs or wait for heat to drop"
    } else if (energy < 10) {
      priorities.push("1. Wait for energy regen (or use consumable)")
      topPriority = "Rest up before making moves"
    } else {
      // Normal priority assessment
      if (heat >= 50) {
        priorities.push("1. Cool off heat with jobs or waiting")
      }
      if (cash > 5000 && level >= 5) {
        priorities.push("2. Consider investing in property")
      }
      if (energy >= 50 && heat < 40) {
        priorities.push("3. Good conditions for crimes")
      }
      if (level >= 10 && !priorities.includes('property')) {
        priorities.push("4. Check heist opportunities")
      }

      if (priorities.length === 0) {
        priorities.push("1. Grind crimes matching your level")
        priorities.push("2. Bank any cash over $1000")
        priorities.push("3. Check for new equipment")
      }

      topPriority = priorities[0]?.replace(/^\d\.\s*/, '') || "Keep grinding"
    }

    data.priorityList = priorities.join('\n')
    data.topPriority = topPriority
  }

  /**
   * Add efficiency/optimal path data
   */
  addEfficiencyData(data, player, context) {
    const query = context.originalQuery || ''
    const level = player.level || 1

    // Detect goal from query
    let goal = 'leveling'
    if (query.includes('level 20') || query.includes('lvl 20')) goal = 'Level 20'
    else if (query.includes('level 10') || query.includes('lvl 10')) goal = 'Level 10'
    else if (query.includes('rich') || query.includes('money') || query.includes('100k')) goal = '$100k'
    else if (query.includes('heist')) goal = 'first heist'

    data.goal = goal

    const paths = {
      'Level 10': {
        path: '1. Grind Pickpocketing until Lvl 5\n2. Switch to Shoplifting (better XP)\n3. At Lvl 7, try Mugging\n4. Do jobs when heat is high',
        estimate: '2-3 hours of active play',
        tip: 'Crimes matching your level give best XP',
      },
      'Level 20': {
        path: '1. Burglary and Car Theft are your bread\n2. Mix in jobs to manage heat\n3. Start simple heists at Lvl 15\n4. Property income helps fund operations',
        estimate: '8-12 hours from Level 10',
        tip: 'Heists give massive XP bursts',
      },
      '$100k': {
        path: '1. Heists are fastest for big scores\n2. Property passive income adds up\n3. Trading has high profit potential\n4. Higher crimes pay more but risk more',
        estimate: 'Depends on level and risk tolerance',
        tip: 'Bank everything - arrests drain cash',
      },
      'first heist': {
        path: '1. Reach Level 10 minimum\n2. Recruit at least 2 crew members\n3. Get basic equipment (lockpicks, scanner)\n4. Start with Convenience Store heist',
        estimate: 'About 4-5 hours from Level 1',
        tip: 'Scout first, plan second, execute third',
      },
      'leveling': {
        path: '1. Focus on crimes at your skill level\n2. Avoid jail (wastes time)\n3. Use energy efficiently\n4. Heists give best XP per action',
        estimate: 'Varies by playstyle',
        tip: 'Consistency beats intensity',
      },
    }

    const pathData = paths[goal] || paths.leveling
    data.efficiencyPath = pathData.path
    data.estimate = pathData.estimate
    data.efficiencyTip = pathData.tip
  }

  /**
   * Add jail strategy data
   */
  addJailStrategyData(data, player) {
    const inJail = player.inJail || false
    const jailTime = player.jailTime || 0
    const cash = player.cash || 0

    const advice = []
    const options = []

    if (inJail) {
      advice.push(`You're locked up with ${jailTime} minutes remaining.`)
      advice.push("Your options:")

      options.push("• Wait it out - Safest, no risk")
      if (cash >= 5000) {
        options.push(`• Post bail ($${Math.min(cash, 10000).toLocaleString()}) - Instant release`)
      } else {
        options.push("• Bail - Need more cash")
      }
      options.push("• Attempt jailbreak - 30% success, adds time if failed")
      options.push("• Good behavior - Reduce time by 20%")
    } else {
      advice.push("Not in jail currently. Prevention tips:")
      advice.push("• Keep heat below 50% for safe operations")
      advice.push("• Police Scanner reduces arrest chance")
      advice.push("• Always have bail money in the bank")
      advice.push("• Good lawyer = shorter sentences if caught")

      options.push("• Lay low when heat is high")
      options.push("• Bribe cops if you can afford it")
      options.push("• Avoid crimes above your skill level")
    }

    data.jailAdvice = advice.join('\n')
    data.jailOptions = options.join('\n')
  }

  /**
   * Add lawyer advice data
   */
  addLawyerAdviceData(data, player) {
    const cash = (player.cash || 0) + (player.bank || 0)
    const level = player.level || 1

    const lawyers = [
      { name: 'Public Defender', cost: 0, reduction: '10%', desc: 'Free but barely helps' },
      { name: 'Jimmy the Fixer', cost: 2000, reduction: '25%', desc: 'Cheap, knows the system' },
      { name: 'Sarah Chen, Esq.', cost: 10000, reduction: '40%', desc: 'Professional, reliable' },
      { name: 'Marcus Drake', cost: 25000, reduction: '60%', desc: 'Top tier, great connections' },
      { name: 'The Ghost', cost: 100000, reduction: '80%', desc: 'Legend. Cases disappear.' },
    ]

    const advice = lawyers.map(l => {
      const canAfford = cash >= l.cost
      const status = canAfford ? '✓' : '✗'
      return `${status} ${l.name} ($${l.cost.toLocaleString()}) - ${l.reduction} sentence reduction\n  "${l.desc}"`
    }).join('\n\n')

    const affordable = lawyers.filter(l => cash >= l.cost)
    const best = affordable[affordable.length - 1]

    data.lawyerAdvice = advice + `\n\nBest you can afford: ${best?.name || 'Public Defender'}`
  }

  /**
   * Add parole strategy data
   */
  addParoleStrategyData(data, player) {
    const advice = []

    advice.push("Parole Strategies:")
    advice.push("")
    advice.push("• Good Behavior - Stay out of trouble in jail")
    advice.push("  - No fights, follow rules")
    advice.push("  - 20% time reduction possible")
    advice.push("")
    advice.push("• Work Programs - Jail jobs reduce time")
    advice.push("  - Kitchen duty: -5% time")
    advice.push("  - Library: -8% time")
    advice.push("  - Maintenance: -10% time")
    advice.push("")
    advice.push("• Connections - Know the right people")
    advice.push("  - Guards can be bribed")
    advice.push("  - Crew on outside can help")
    advice.push("")
    advice.push("• Parole Hearing - Available after 50% time served")
    advice.push("  - Good behavior record helps")
    advice.push("  - Better lawyer = better odds")

    data.paroleAdvice = advice.join('\n')
  }

  /**
   * Add AI relationship data using real AI intel
   */
  addAIRelationshipData(data, entities) {
    const name = entities.playerName || 'Unknown'

    // Use the AIIntelAnalyzer for real data
    const intel = aiIntelAnalyzer.getAIPlayerIntel(name)

    if (!intel.found) {
      data.playerName = name
      data.relationshipData = `No data on "${name}" in my network.`
      data.recommendation = "Check the spelling or wait for them to show up on radar."
      return
    }

    data.playerName = intel.name
    data.relationshipData = [
      `Level: ${intel.level} | Type: ${intel.personality}`,
      `Crew: ${intel.crewName}`,
      `Current relationship: ${intel.relationshipType}`,
      `Trust level: ${intel.trustLevel}%`,
      `Deception rate: ${intel.messageHistory?.deceptionRate || 0}%`,
    ].join('\n')

    data.recommendation = intel.recommendation
  }

  /**
   * Add AI threat data
   */
  addAIThreatData(data) {
    const threats = aiIntelAnalyzer.getActiveThreats()

    if (threats.length === 0) {
      data.threatList = "No active threats detected.\nYou're flying under the radar."
      return
    }

    const threatLines = threats.slice(0, 5).map((t, i) => {
      const icon = t.threat.level === 'HIGH' ? '⚠' : '•'
      return `${icon} ${t.name} (Lvl ${t.level}) - ${t.type}\n  ${t.threat.warning}`
    })

    data.threatList = threatLines.join('\n\n')
  }

  /**
   * Add trade analysis data
   */
  addTradeAnalysisData(data, context) {
    // Would normally get offer from context
    const offer = context.offer || null

    if (!offer) {
      data.tradeAnalysis = "No active trade offer to analyze.\nWhen you receive an offer, ask me 'is this offer legit?' or 'analyze this deal'."
      data.verdict = "Need an offer to analyze"
      return
    }

    const analysis = aiIntelAnalyzer.analyzeTradeOffer(offer)

    data.tradeAnalysis = [
      `From: ${analysis.sender}`,
      `Type: ${analysis.type}`,
      `Safe: ${analysis.safe ? 'YES' : 'NO ⚠'}`,
      analysis.warnings.length > 0 ? `Warnings:\n• ${analysis.warnings.join('\n• ')}` : 'No red flags detected',
    ].join('\n')

    data.verdict = analysis.recommendation.toUpperCase()
  }

  /**
   * Add alliance strategy data
   */
  addAllianceStrategyData(data, player) {
    const suggestions = aiIntelAnalyzer.suggestAlliances(player)

    if (suggestions.length === 0) {
      data.allianceList = "No good alliance targets found right now.\nBuild your rep and they'll come around."
      return
    }

    const lines = suggestions.map((s, i) => {
      return `${i + 1}. ${s.name} (Lvl ${s.level})\n   Trust: ${s.trustworthiness}% | Compatibility: ${s.compatibility}%\n   "${s.reason}"`
    })

    data.allianceList = lines.join('\n\n')
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
