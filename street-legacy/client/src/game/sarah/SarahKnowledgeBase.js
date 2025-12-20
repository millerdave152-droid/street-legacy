/**
 * SarahKnowledgeBase - Game knowledge and FAQ for S.A.R.A.H.
 *
 * Contains all game mechanics explanations, strategic advice,
 * and frequently asked questions.
 */

import { gameManager } from '../GameManager'

// Game mechanics explanations
export const MECHANICS = {
  heat: {
    keywords: ['heat', 'wanted', 'police', 'cops', 'fuzz', 'arrest'],
    explanation: "Heat is police attention on you. It builds from crimes and decays over time. High heat means higher chance of arrest. You can reduce it by laying low, doing legit jobs, or bribing cops.",
    tips: [
      "Jobs don't generate heat - do them when you're hot",
      "Heat decays faster in some districts",
      "The Ski Mask item reduces heat gain by 20%",
    ],
  },

  energy: {
    keywords: ['energy', 'stamina', 'tired', 'exhausted'],
    explanation: "Energy is your fuel for actions. It regenerates over time - about 5 per minute at low levels, more as you level up. Max energy also increases with level.",
    tips: [
      "Energy Drinks restore 25 energy instantly",
      "Higher level = more max energy and faster regen",
      "Plan your crimes around energy availability",
    ],
  },

  level: {
    keywords: ['level', 'xp', 'experience', 'level up'],
    explanation: "Your level unlocks new crimes, jobs, and features. Earn XP from crimes, jobs, and heists. Higher level crimes give more XP but are riskier.",
    tips: [
      "Early game: grind easy crimes for quick XP",
      "Mini-games give bonus XP on good performance",
      "Each level unlocks new opportunities",
    ],
  },

  respect: {
    keywords: ['respect', 'reputation', 'rep', 'street cred'],
    explanation: "Respect is your street reputation. It affects how AI players treat you and unlocks certain opportunities. Build it through successful crimes and smart plays.",
    tips: [
      "Completing heists boosts respect significantly",
      "Some AI players respect strength, others respect cunning",
    ],
  },

  bank: {
    keywords: ['bank', 'deposit', 'interest', 'save', 'savings'],
    explanation: "The bank keeps your money safe from loss on arrest. Deposited cash earns 1% interest per hour. Always bank your profits!",
    tips: [
      "Deposit regularly - you lose cash on arrest, not bank money",
      "Interest compounds - the more you save, the more you earn",
      "Don't carry more cash than you need",
    ],
  },

  properties: {
    keywords: ['property', 'properties', 'passive income', 'real estate'],
    explanation: "Properties generate passive income every hour even when offline. Start with cheaper properties and work your way up. They're the key to long-term wealth.",
    tips: [
      "Small Apartment ($5k) = $10/hour - best starter",
      "Nightclub ($100k) = $150/hour - solid mid-game",
      "Buy properties early - income adds up over time",
    ],
  },

  crew: {
    keywords: ['crew', 'team', 'gang', 'members', 'partner'],
    explanation: "Crew members provide bonuses to your operations. Each has a specialty - drivers help escapes, hackers boost success rates, etc. They take a cut of heist profits.",
    tips: [
      "Marcus (Driver) - +20% escape chance",
      "Luna (Hacker) - +15% success rate",
      "Mix crew based on the heist type",
    ],
  },

  minigames: {
    keywords: ['mini-game', 'minigame', 'mini game', 'game', 'qte'],
    explanation: "Some crimes and jobs have mini-games that affect your rewards. Better performance = bonus cash and XP. Look for the gamepad icon.",
    tips: [
      "Practice makes perfect - difficulty adapts to your skill",
      "Perfect scores can drop rare loot",
      "Curveballs appear at higher difficulties",
    ],
  },

  jail: {
    keywords: ['jail', 'prison', 'arrested', 'caught', 'lockup'],
    explanation: "Get caught and you do time. Jail time depends on your wanted level - higher heat = longer sentence. You can pay bail, attempt jailbreak, or wait it out.",
    tips: [
      "Lawyers reduce sentence and improve bail/parole odds",
      "Good behavior in jail improves parole chances",
      "Jailbreak has risks - failure adds time",
    ],
  },

  trading: {
    keywords: ['trading', 'trade', 'goods', 'buy', 'sell', 'market'],
    explanation: "Trading goods is risky but profitable. Buy low in one district, sell high in another. Prices fluctuate - watch the market.",
    tips: [
      "Cannabis is low risk, low reward",
      "Firearms have the highest margins but major heat",
      "Watch for market events that affect prices",
    ],
  },

  heists: {
    keywords: ['heist', 'heists', 'big score', 'major job'],
    explanation: "Heists are multi-part operations with huge payouts. They require planning, crew, and higher levels. Risk is high but so are rewards.",
    tips: [
      "Start with Convenience Store (Level 5)",
      "Crew selection matters - match skills to the job",
      "Federal Reserve is the ultimate score (Level 40+)",
    ],
  },

  districts: {
    keywords: ['district', 'area', 'location', 'neighborhood', 'zone'],
    explanation: "Toronto has 13 districts, each with unique crime opportunities, danger levels, and police presence. Unlock new areas as you level up.",
    tips: [
      "Start in safer areas like Parkdale",
      "Financial District has best payouts but heavy police",
      "Each district tracks heat separately",
    ],
  },
}

// Strategic advice by player level tier
export const STRATEGIC_ADVICE = {
  beginner: {
    levelRange: [1, 10],
    general: "You're just starting out. Focus on easy crimes to build XP and learn the ropes. Bank your money, buy your first property when you can.",
    crimes: [
      "Pickpocketing and Shoplifting are your bread and butter",
      "Low risk, decent XP, builds your skills",
      "Car Break-ins at level 3 are solid money",
    ],
    priorities: [
      "Complete the tutorial for bonus rewards",
      "Bank everything - don't lose cash to arrests",
      "Save $5k for your first property",
      "Do jobs when heat is high",
    ],
  },

  intermediate: {
    levelRange: [11, 25],
    general: "You're getting established. Time to step up to better crimes and start building passive income. Consider your first heist.",
    crimes: [
      "Car Theft and Burglary pay well now",
      "Armed Robbery if you've got a Pistol",
      "Start eyeing your first heist (level 15+)",
    ],
    priorities: [
      "Build property portfolio for passive income",
      "Hire crew members for heist bonuses",
      "Explore different districts",
      "Watch your heat - stakes are higher now",
    ],
  },

  advanced: {
    levelRange: [26, 40],
    general: "You're a serious player now. White collar crimes and major heists are your game. Build your empire strategically.",
    crimes: [
      "White collar crimes have great risk/reward",
      "Territory crimes build street control",
      "Major heists like Museum and Casino",
    ],
    priorities: [
      "Diversify income streams",
      "Build alliances with useful AI players",
      "Control key territories",
      "Elite crew for major heists",
    ],
  },

  expert: {
    levelRange: [41, 99],
    general: "You're at the top. Federal Reserve, Gold Reserve, legendary scores. Play the long game and dominate.",
    crimes: [
      "Legendary heists for massive payouts",
      "Turf control for passive power",
      "White collar for clean money",
    ],
    priorities: [
      "Federal Reserve heist is the ultimate goal",
      "Control multiple territories",
      "Network with powerful AI players",
      "Maintain low heat despite high activity",
    ],
  },
}

// FAQ database
export const FAQ = [
  {
    patterns: ['how do i start', 'what should i do first', 'just started', 'new player'],
    answer: "Welcome, runner! Start with the tutorial - it gives you $500 and teaches the basics. Then do some pickpocketing to level up, bank your earnings, and save for your first property. Jobs are safe income when heat gets high.",
  },
  {
    patterns: ['how do i escape jail', 'get out of jail', 'stuck in jail'],
    answer: "Three ways out: Pay bail (costs money but fast), attempt jailbreak (risky - can add time if you fail), or wait it out. Having a lawyer improves all options. Good behavior during your sentence helps parole chances.",
  },
  {
    patterns: ['best way to make money', 'how to get rich', 'money fast'],
    answer: "Short term: grind crimes that match your level for steady income. Long term: invest in properties for passive income that works while you're offline. Trading goods is risky but can be very profitable.",
  },
  {
    patterns: ['what are heists', 'how do heists work'],
    answer: "Heists are major multi-part operations. You need the right level, crew members, and sometimes items. They pay big but require planning. Start with Convenience Store at level 5, work up to Bank Vault and beyond.",
  },
  {
    patterns: ['how does heat decay', 'heat go down', 'lose heat naturally'],
    answer: "Heat decays at about 1 point per minute naturally. Different districts have different decay rates. Doing legit jobs speeds it up. The Police Scanner item reduces heat gain. Laying low costs energy but reduces heat faster.",
  },
  {
    patterns: ['should i do crimes or jobs', 'crimes vs jobs', 'which is better'],
    answer: "Both have their place. Crimes pay more and give more XP but generate heat and can get you caught. Jobs are slower but safer - no heat, steady income. Do jobs when your heat is high to stay productive while laying low.",
  },
  {
    patterns: ['what is a fixer', 'who is the fixer'],
    answer: "The Fixer is a top-tier lawyer you can hire. Expensive ($100k retainer) but they slash bail costs by 80% and sentences by 70%. Worth it at high levels when getting caught is costly.",
  },
  {
    patterns: ['how do ai players work', 'are npcs real', 'other players'],
    answer: "AI players are computer-controlled characters with distinct personalities. They run businesses, commit crimes, and can become allies or enemies. Each has trust levels - work with reliable ones, watch out for manipulators.",
  },
  {
    patterns: ['best crime for my level', 'what crime should i do'],
    answer: "Depends on your stats. Generally: Level 1-5 pickpocket/shoplift, Level 5-10 car break-ins, Level 10-20 car theft/burglary, Level 20+ armed robbery/heists. Check success rates - if it's below 50%, you might want something easier.",
  },
  {
    patterns: ['how do i level up fast', 'fastest xp', 'quick levels'],
    answer: "XP farming: Do crimes that match your level with high success rates. Mini-game bonuses add significant XP. Daily challenges give chunks of XP. Heists give the most XP but require setup.",
  },
]

class SarahKnowledgeBase {
  /**
   * Find mechanic explanation by keyword
   */
  findMechanic(query) {
    const normalizedQuery = query.toLowerCase()

    for (const [key, mechanic] of Object.entries(MECHANICS)) {
      for (const keyword of mechanic.keywords) {
        if (normalizedQuery.includes(keyword)) {
          return {
            topic: key,
            ...mechanic,
          }
        }
      }
    }

    return null
  }

  /**
   * Get strategic advice for player's level
   */
  getStrategicAdvice(playerLevel = 1) {
    if (playerLevel <= 10) return STRATEGIC_ADVICE.beginner
    if (playerLevel <= 25) return STRATEGIC_ADVICE.intermediate
    if (playerLevel <= 40) return STRATEGIC_ADVICE.advanced
    return STRATEGIC_ADVICE.expert
  }

  /**
   * Find FAQ answer matching query
   */
  findFAQ(query) {
    const normalizedQuery = query.toLowerCase()

    for (const faq of FAQ) {
      for (const pattern of faq.patterns) {
        if (normalizedQuery.includes(pattern) || this.fuzzyMatch(normalizedQuery, pattern)) {
          return faq.answer
        }
      }
    }

    return null
  }

  /**
   * Simple fuzzy matching
   */
  fuzzyMatch(query, pattern) {
    const queryWords = query.split(/\s+/)
    const patternWords = pattern.split(/\s+/)

    let matches = 0
    for (const patternWord of patternWords) {
      if (queryWords.some(qw => qw.includes(patternWord) || patternWord.includes(qw))) {
        matches++
      }
    }

    return matches >= patternWords.length * 0.6
  }

  /**
   * Get contextual tip based on player state
   */
  getContextualTip(playerData) {
    const tips = []

    if (!playerData) {
      return "No player data available. Try again after starting a game."
    }

    const { level, energy, heat, cash, bank } = playerData

    // Energy-based tips
    if (energy < 20) {
      tips.push("Your energy is low. Consider doing a quick job or waiting for regen.")
    }

    // Heat-based tips
    if (heat >= 70) {
      tips.push("Your heat is dangerously high. Lay low or do jobs to reduce it before the cops catch you.")
    } else if (heat >= 40) {
      tips.push("Heat's climbing. Keep an eye on it - maybe mix in some legit work.")
    }

    // Money-based tips
    if (cash > 10000 && bank < cash) {
      tips.push(`You're carrying $${cash.toLocaleString()} in cash. Bank it before you lose it to an arrest!`)
    }

    if (cash < 100 && bank < 500) {
      tips.push("Funds are tight. Focus on quick crimes or jobs to build up some scratch.")
    }

    // Level-based tips
    const advice = this.getStrategicAdvice(level)
    tips.push(...advice.priorities.slice(0, 2))

    return tips.length > 0 ? tips : ["You're doing solid. Keep grinding and watch your heat."]
  }

  /**
   * Get crime recommendation based on player stats
   */
  getCrimeRecommendation(playerData, availableCrimes) {
    if (!playerData || !availableCrimes) {
      return null
    }

    const { level, energy, heat } = playerData

    // Filter crimes player can do
    const doableCrimes = availableCrimes.filter(crime => {
      return crime.minLevel <= level && crime.energyCost <= energy
    })

    if (doableCrimes.length === 0) {
      return {
        recommendation: null,
        reason: "Not enough energy for any crimes right now. Wait for regen or do a job.",
      }
    }

    // Score crimes based on multiple factors
    const scoredCrimes = doableCrimes.map(crime => {
      let score = 0

      // Prefer high success rate
      score += crime.successRate * 2

      // Prefer good payout
      const avgPayout = (crime.minPayout + crime.maxPayout) / 2
      score += avgPayout / 100

      // Penalize high heat if player heat is already high
      if (heat > 50) {
        score -= crime.heatGain * 2
      }

      // Prefer appropriate level (not too easy, not too hard)
      const levelDiff = level - crime.minLevel
      if (levelDiff >= 0 && levelDiff <= 5) {
        score += 20 // Sweet spot
      }

      return { crime, score }
    })

    // Sort by score
    scoredCrimes.sort((a, b) => b.score - a.score)

    const best = scoredCrimes[0]
    return {
      recommendation: best.crime,
      reason: this.buildCrimeReason(best.crime, playerData),
      alternatives: scoredCrimes.slice(1, 3).map(s => s.crime),
    }
  }

  /**
   * Build explanation for crime recommendation
   */
  buildCrimeReason(crime, playerData) {
    const reasons = []

    if (crime.successRate >= 70) {
      reasons.push(`${crime.successRate}% success rate - solid odds`)
    }

    const avgPayout = (crime.minPayout + crime.maxPayout) / 2
    reasons.push(`pays $${avgPayout.toLocaleString()} average`)

    if (playerData.heat > 50 && crime.heatGain < 10) {
      reasons.push("low heat gain which you need right now")
    }

    return reasons.join(', ')
  }

  /**
   * Get all mechanic topics for help display
   */
  getAllTopics() {
    return Object.keys(MECHANICS)
  }

  /**
   * Get mechanic by exact topic name
   */
  getMechanic(topic) {
    return MECHANICS[topic] || null
  }
}

// Singleton instance
export const sarahKnowledgeBase = new SarahKnowledgeBase()

export default sarahKnowledgeBase
