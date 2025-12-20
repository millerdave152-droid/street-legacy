/**
 * AI Personality Definitions
 * 8 distinct archetypes with unique behaviors and traits
 */

// Personality type constants
export const PERSONALITY_TYPES = {
  MANIPULATOR: 'manipulator',
  ENFORCER: 'enforcer',
  NETWORKER: 'networker',
  OPPORTUNIST: 'opportunist',
  SABOTEUR: 'saboteur',
  MENTOR: 'mentor',
  RIVAL: 'rival',
  WILDCARD: 'wildcard'
}

// Personality definitions with behavior modifiers
export const PERSONALITIES = {
  [PERSONALITY_TYPES.MANIPULATOR]: {
    name: 'Manipulator',
    description: 'Cunning and deceptive, makes enticing offers with hidden catches',
    icon: '🎭',
    color: '#a855f7',

    // Behavior modifiers (0-1 scale)
    traits: {
      aggressiveness: 0.4,
      deceptiveness: 0.8,
      generosity: 0.2,
      riskTolerance: 0.6,
      socialness: 0.7,
      patience: 0.8
    },

    // Offer type preferences (weighted)
    preferredOffers: ['trade_deal', 'investment', 'alliance', 'gift'],

    // How they talk
    speechStyle: {
      greetings: ['Friend...', 'Let me share something with you...', 'Between us...'],
      closings: ['Trust me.', 'You won\'t regret this.', 'This is your lucky day.'],
      deceptiveTells: ['absolutely', 'guaranteed', 'no risk']
    },

    // Decision biases
    decisionBias: {
      preferDeception: 0.6,
      targetWeakPlayers: 0.7,
      formFakeAlliances: 0.5
    }
  },

  [PERSONALITY_TYPES.ENFORCER]: {
    name: 'Enforcer',
    description: 'Aggressive and dominant, demands tribute and controls territory',
    icon: '💪',
    color: '#ef4444',

    traits: {
      aggressiveness: 0.9,
      deceptiveness: 0.3,
      generosity: 0.1,
      riskTolerance: 0.8,
      socialness: 0.4,
      patience: 0.2
    },

    preferredOffers: ['protection', 'warning', 'job_offer'],

    speechStyle: {
      greetings: ['Listen up.', 'We need to talk.', 'You\'re in my territory.'],
      closings: ['Don\'t make me ask twice.', 'Smart choice.', 'You know what\'s good for you.'],
      deceptiveTells: ['last chance', 'consequences']
    },

    decisionBias: {
      preferDeception: 0.2,
      targetWeakPlayers: 0.8,
      formFakeAlliances: 0.2
    }
  },

  [PERSONALITY_TYPES.NETWORKER]: {
    name: 'Networker',
    description: 'Alliance builder, shares intel and recruits allies',
    icon: '🤝',
    color: '#3b82f6',

    traits: {
      aggressiveness: 0.2,
      deceptiveness: 0.3,
      generosity: 0.6,
      riskTolerance: 0.4,
      socialness: 0.95,
      patience: 0.7
    },

    preferredOffers: ['alliance', 'hot_tip', 'job_offer', 'investment'],

    speechStyle: {
      greetings: ['Hey friend!', 'Got a minute?', 'I\'ve been meaning to reach out...'],
      closings: ['We\'re stronger together.', 'Let\'s build something.', 'I\'ve got your back.'],
      deceptiveTells: ['everyone\'s doing it', 'exclusive opportunity']
    },

    decisionBias: {
      preferDeception: 0.25,
      targetWeakPlayers: 0.3,
      formFakeAlliances: 0.3
    }
  },

  [PERSONALITY_TYPES.OPPORTUNIST]: {
    name: 'Opportunist',
    description: 'Profit-driven, buys low sells high, exploits every situation',
    icon: '💰',
    color: '#22c55e',

    traits: {
      aggressiveness: 0.5,
      deceptiveness: 0.5,
      generosity: 0.1,
      riskTolerance: 0.7,
      socialness: 0.5,
      patience: 0.6
    },

    preferredOffers: ['trade_deal', 'investment', 'hot_tip'],

    speechStyle: {
      greetings: ['I\'ve got a deal for you...', 'Quick opportunity here.', 'Time-sensitive offer.'],
      closings: ['Act fast.', 'This won\'t last.', 'Your loss if you pass.'],
      deceptiveTells: ['limited time', 'once in a lifetime', 'below market']
    },

    decisionBias: {
      preferDeception: 0.45,
      targetWeakPlayers: 0.5,
      formFakeAlliances: 0.4
    }
  },

  [PERSONALITY_TYPES.SABOTEUR]: {
    name: 'Saboteur',
    description: 'Chaotic disruptor, causes crashes, spreads rumors, betrays',
    icon: '💣',
    color: '#f97316',

    traits: {
      aggressiveness: 0.7,
      deceptiveness: 0.9,
      generosity: 0.05,
      riskTolerance: 0.9,
      socialness: 0.6,
      patience: 0.3
    },

    preferredOffers: ['warning', 'hot_tip', 'alliance', 'investment'],

    speechStyle: {
      greetings: ['URGENT!', 'You need to hear this...', 'Everything\'s about to change.'],
      closings: ['Don\'t say I didn\'t warn you.', 'Good luck out there.', 'Watch your back.'],
      deceptiveTells: ['everyone\'s panicking', 'insider info', 'before it\'s too late']
    },

    decisionBias: {
      preferDeception: 0.75,
      targetWeakPlayers: 0.6,
      formFakeAlliances: 0.8
    }
  },

  [PERSONALITY_TYPES.MENTOR]: {
    name: 'Mentor',
    description: 'Helpful veteran, gives genuine tips and warns of dangers',
    icon: '🎓',
    color: '#06b6d4',

    traits: {
      aggressiveness: 0.1,
      deceptiveness: 0.1,
      generosity: 0.9,
      riskTolerance: 0.3,
      socialness: 0.7,
      patience: 0.9
    },

    preferredOffers: ['hot_tip', 'warning', 'gift', 'alliance'],

    speechStyle: {
      greetings: ['Kid, listen up.', 'Let me give you some advice.', 'I\'ve seen this before.'],
      closings: ['Stay sharp.', 'You\'ve got potential.', 'Learn from my mistakes.'],
      deceptiveTells: [] // Mentors rarely deceive
    },

    decisionBias: {
      preferDeception: 0.1,
      targetWeakPlayers: 0.2, // Helps weak players
      formFakeAlliances: 0.05
    }
  },

  [PERSONALITY_TYPES.RIVAL]: {
    name: 'Rival',
    description: 'Competitive, always tries to one-up the player',
    icon: '🏆',
    color: '#eab308',

    traits: {
      aggressiveness: 0.7,
      deceptiveness: 0.4,
      generosity: 0.15,
      riskTolerance: 0.7,
      socialness: 0.5,
      patience: 0.4
    },

    preferredOffers: ['trade_deal', 'job_offer', 'protection'],

    speechStyle: {
      greetings: ['Heard you\'re doing well...', 'Think you can keep up?', 'Let\'s see what you\'ve got.'],
      closings: ['May the best player win.', 'I\'ll be watching.', 'Don\'t disappoint me.'],
      deceptiveTells: ['friendly competition', 'prove yourself']
    },

    decisionBias: {
      preferDeception: 0.35,
      targetWeakPlayers: 0.3, // Prefers strong opponents
      formFakeAlliances: 0.3
    }
  },

  [PERSONALITY_TYPES.WILDCARD]: {
    name: 'Wildcard',
    description: 'Unpredictable, alternates between helpful and harmful',
    icon: '🃏',
    color: '#ec4899',

    traits: {
      aggressiveness: 0.5,
      deceptiveness: 0.5,
      generosity: 0.5,
      riskTolerance: 0.8,
      socialness: 0.6,
      patience: 0.4
    },

    preferredOffers: ['gift', 'trade_deal', 'hot_tip', 'warning', 'investment'],

    speechStyle: {
      greetings: ['Feeling lucky?', 'Roll the dice with me.', 'Who knows what could happen...'],
      closings: ['Let\'s see how this plays out.', 'Fortune favors the bold.', 'Life\'s a gamble.'],
      deceptiveTells: ['trust me', 'what could go wrong']
    },

    decisionBias: {
      preferDeception: 0.5, // 50/50
      targetWeakPlayers: 0.5, // Random
      formFakeAlliances: 0.5
    }
  }
}

// Name generation pools
export const AI_NAME_POOLS = {
  firstNames: [
    'Shadow', 'Dark', 'Night', 'Street', 'Money', 'Ice', 'Fire', 'Steel', 'Gold', 'Silver',
    'Diamond', 'Black', 'Red', 'Blue', 'King', 'Queen', 'Boss', 'Chief', 'Don', 'Big',
    'Slim', 'Fat', 'Quick', 'Crazy', 'Silent', 'Loud', 'Mad', 'Bad', 'Sick', 'Wild',
    'Lucky', 'Slick', 'Smooth', 'Snake', 'Viper', 'Ghost', 'Phantom', 'Ace', 'Duke', 'Prince',
    'Razor', 'Blade', 'Chrome', 'Neon', 'Volt', 'Blaze', 'Frost', 'Storm', 'Thunder', 'Flash'
  ],

  lastNames: [
    'King', 'Boss', 'Lord', 'Wolf', 'Dog', 'Cat', 'Snake', 'Hawk', 'Bear', 'Lion',
    'Tiger', 'Dragon', 'Ghost', 'Demon', 'Angel', 'Reaper', 'Hunter', 'Killer', 'Dealer', 'Hustler',
    'Runner', 'Player', 'Maker', 'Breaker', 'Shaker', 'Taker', 'Giver', 'Rider', 'Fighter', 'Master',
    'Money', 'Cash', 'Stack', 'Vice', 'Blade', 'Edge', 'Fist', 'Fury', 'Flame', 'Frost',
    'Shadow', 'Knight', 'Raven', 'Crow', 'Venom', 'Strike', 'Bullet', 'Trigger', 'Knuckles', 'Chains'
  ],

  crewNames: [
    'Street Kings', 'Dark Legion', 'Money Mob', 'Night Wolves', 'Blood Empire',
    'Shadow Syndicate', 'Gold Gang', 'Diamond Crew', 'Iron Fist', 'Black Ravens',
    'Red Dragons', 'Blue Devils', 'Silent Killers', 'Mad Dogs', 'Wild Cards',
    'Ghost Protocol', 'Neon Vipers', 'Chrome Saints', 'Frost Giants', 'Thunder Lords',
    'Venom Squad', 'Steel Serpents', 'Phantom Force', 'Blaze Brothers', 'Storm Riders'
  ]
}

// Offer type definitions
export const OFFER_TYPES = {
  TRADE_DEAL: 'trade_deal',
  ALLIANCE: 'alliance',
  HOT_TIP: 'hot_tip',
  PROTECTION: 'protection',
  INVESTMENT: 'investment',
  WARNING: 'warning',
  JOB_OFFER: 'job_offer',
  GIFT: 'gift'
}

// Deception type definitions
export const DECEPTION_TYPES = {
  INFLATED_PRICE: 'inflated_price',
  BAD_INTEL: 'bad_intel',
  SETUP: 'setup',
  SCAM: 'scam',
  FALSE_PANIC: 'false_panic',
  BETRAYAL: 'betrayal',
  DEBT_TRAP: 'debt_trap',
  EXTORTION: 'extortion'
}

// Helper function to get personality by type
export function getPersonality(type) {
  return PERSONALITIES[type] || PERSONALITIES[PERSONALITY_TYPES.WILDCARD]
}

// Helper function to get random personality type
export function getRandomPersonalityType() {
  const types = Object.values(PERSONALITY_TYPES)
  return types[Math.floor(Math.random() * types.length)]
}

// Generate a random AI name
export function generateAIName(usedNames = new Set()) {
  let attempts = 0
  let name

  do {
    const first = AI_NAME_POOLS.firstNames[Math.floor(Math.random() * AI_NAME_POOLS.firstNames.length)]
    const last = AI_NAME_POOLS.lastNames[Math.floor(Math.random() * AI_NAME_POOLS.lastNames.length)]
    name = `${first}${last}`

    // Add number suffix if name is taken after 10 attempts
    if (attempts > 10 && usedNames.has(name)) {
      name += Math.floor(Math.random() * 99)
    }
    attempts++
  } while (usedNames.has(name) && attempts < 50)

  return name
}

// Generate a random crew name
export function generateCrewName(usedCrews = new Set()) {
  let attempts = 0
  let name

  do {
    name = AI_NAME_POOLS.crewNames[Math.floor(Math.random() * AI_NAME_POOLS.crewNames.length)]
    attempts++
  } while (usedCrews.has(name) && attempts < 20)

  return name
}

export default {
  PERSONALITY_TYPES,
  PERSONALITIES,
  AI_NAME_POOLS,
  OFFER_TYPES,
  DECEPTION_TYPES,
  getPersonality,
  getRandomPersonalityType,
  generateAIName,
  generateCrewName
}
