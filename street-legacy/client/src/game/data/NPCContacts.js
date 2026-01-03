/**
 * NPCContacts.js - Named NPC Contact Definitions
 *
 * 10 unique NPCs with distinct personalities, message styles, and behaviors.
 * These NPCs communicate through the terminal console with the player.
 */

// NPC Role Types
export const NPC_ROLES = {
  FIXER: 'FIXER',           // Street-level intel, easy scores
  INTEL: 'INTEL',           // Pattern recognition, schedules
  BROKER: 'BROKER',         // High-level opportunities
  HUSTLER: 'HUSTLER',       // Scams, pyramid schemes
  SUPPLIER: 'SUPPLIER',     // Bulk goods at discount
  SPECIALIST: 'SPECIALIST', // High-risk specialty items
  CREW: 'CREW',             // Crew leader, territory deals
  MASTERMIND: 'MASTERMIND', // Heist planner, legendary scores
  UNDERCOVER: 'UNDERCOVER', // Cop trying to set you up
  SNITCH: 'SNITCH'          // Will betray you
}

// Loyalty Types
export const LOYALTY_TYPES = {
  NEUTRAL: 'neutral',           // No strong feelings
  TRANSACTIONAL: 'transactional', // Business only
  EARNED: 'earned',             // Must prove yourself
  REPUTATION: 'reputation',     // Based on your rep
  NONE: 'none',                 // Cannot trust
  NEGATIVE: 'negative'          // Will betray
}

// Risk Levels
export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very_high',
  EXTREME: 'extreme',
  TRAP: 'trap'
}

/**
 * Named NPC Contacts
 * Each NPC has unique personality, message style, and behavior patterns
 */
export const NPC_CONTACTS = {
  // ============================================================
  // INFORMANTS - Intel Providers
  // ============================================================

  snoop: {
    id: 'snoop',
    name: 'Snoop',
    role: NPC_ROLES.FIXER,
    archetype: 'informant',
    displayPrefix: '[SNOOP]',
    avatar: 'S',
    color: 0x06b6d4, // Cyan

    // Personality
    personality: 'chatty',
    description: 'Street-level intel, tips on easy scores. Chatty and unreliable but harmless.',

    // Trust & Risk
    baseTrust: 15,
    loyaltyType: LOYALTY_TYPES.NEUTRAL,
    riskLevel: RISK_LEVELS.LOW,
    reliability: 0.7,
    scamChance: 0.05,
    betrayalChance: 0.1,

    // Availability
    minLevel: 1,
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    // Messaging behavior
    messageFrequency: { min: 180000, max: 480000 }, // 3-8 min
    maxMessagesPerDay: 5,
    preferredMessageTypes: ['INTEL', 'TIP', 'WARNING'],

    // Speech patterns
    speechPatterns: {
      greetings: [
        'Yo boss...',
        'Word on the street...',
        'Psst, got something for ya...',
        'Heard you looking for work...'
      ],
      closings: [
        'Keep it real.',
        'Watch your back.',
        "I'll keep my ears open.",
        'Stay low.'
      ],
      style: 'casual'
    },

    // Message templates
    messageTemplates: {
      INTEL: [
        'Yo heard the bodega on Queen got weak cameras. Easy pickings if you ask me.',
        'That corner store on Dundas? Owner leaves at 10pm sharp. Just sayin.',
        'Word is the pawn shop on Spadina buys no questions asked.',
        'Saw some cops rotating shifts at the bank. Gap between 2-3am.'
      ],
      TIP: [
        'Pro tip: The pawn shop pays 20% more after midnight.',
        'Heads up - heat dies down faster if you stay in Parkdale.',
        'FYI the back alley behind King St has no cameras.'
      ],
      WARNING: [
        'Yo watch out, cops been heavy on your block lately.',
        'Heard your name come up. Might wanna lay low.',
        'Some guys asking about you. Not cops but still...'
      ]
    }
  },

  marcus: {
    id: 'marcus',
    name: 'Marcus',
    role: NPC_ROLES.FIXER,
    archetype: 'informant',
    displayPrefix: '[MARCUS]',
    avatar: 'M',
    color: 0x8b5cf6, // Purple

    personality: 'mentor',
    description: 'Old-school hustler who gives general advice. Seen it all.',

    baseTrust: 25,
    loyaltyType: LOYALTY_TYPES.REPUTATION,
    riskLevel: RISK_LEVELS.LOW,
    reliability: 0.85,
    scamChance: 0,
    betrayalChance: 0.02,

    minLevel: 1, // Starting Zone (Level 1-3)
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    messageFrequency: { min: 300000, max: 600000 }, // 5-10 min
    maxMessagesPerDay: 4,
    preferredMessageTypes: ['INTEL', 'TIP', 'WARNING'],

    speechPatterns: {
      greetings: [
        'Listen up kid...',
        'Let me tell you something...',
        'Word of advice...',
        'Been watching you work...'
      ],
      closings: [
        'Stay smart out there.',
        'Trust nobody.',
        'Learn from my mistakes.',
        'Survival is the only win.'
      ],
      style: 'mentoring'
    },

    messageTemplates: {
      INTEL: [
        'The cops rotate shifts every 8 hours. Plan around that.',
        'Banks are easy targets but heat sticks longer. Worth remembering.',
        'Pawn shops on the east side give better rates. Just saying.',
        'Night time is amateur hour. Real money moves at dawn.'
      ],
      TIP: [
        'Never hit the same spot twice in a week. That\'s how you get caught.',
        'Keep your heat under 30% and you\'re invisible. Trust me.',
        'Save up for a lawyer before you need one. Insurance.',
        'The feds don\'t chase small fish. Stay small, stay free.'
      ],
      WARNING: [
        'Kid, I\'ve seen that look before. Slow down.',
        'Heat\'s rising. Time to go quiet for a while.',
        'That contact you\'ve been talking to? Something feels off.',
        'Don\'t get cocky. That\'s when they get you.'
      ]
    }
  },

  watcher: {
    id: 'watcher',
    name: 'Watcher',
    role: NPC_ROLES.INTEL,
    archetype: 'informant',
    displayPrefix: '[WATCHER]',
    avatar: 'W',
    color: 0x3b82f6, // Blue

    personality: 'observant',
    description: 'Pattern recognition, schedule info. Few words but accurate.',

    baseTrust: 25,
    loyaltyType: LOYALTY_TYPES.TRANSACTIONAL,
    riskLevel: RISK_LEVELS.LOW,
    reliability: 0.95,
    scamChance: 0.01,
    betrayalChance: 0.05,

    minLevel: 4, // Expansion tier (Level 4-6)
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    messageFrequency: { min: 300000, max: 600000 }, // 5-10 min
    maxMessagesPerDay: 3,
    preferredMessageTypes: ['INTEL', 'WARNING'],

    speechPatterns: {
      greetings: [
        'Observation:',
        'Pattern detected.',
        'Intel update.',
        'Notice:'
      ],
      closings: [
        'End transmission.',
        'Verified.',
        'Act accordingly.',
        '...'
      ],
      style: 'terse'
    },

    messageTemplates: {
      INTEL: [
        'Bank manager leaves 2:15pm Tuesdays. Alone.',
        'Security rotation at Eaton Centre changes 11pm-7am. Blind spot near north entrance. Window: 15min.',
        'Armored truck arrives First National every Thursday 9:47am. Two guards. 4 minutes inside.',
        'Target residence empty 6pm-11pm weekdays. Dog in backyard. Fence: 6ft.'
      ],
      WARNING: [
        'Police scanner: Increased patrols your sector.',
        'Surveillance detected on your usual route.',
        'Heat signature elevated. Recommend alternate paths.'
      ]
    }
  },

  the_connect: {
    id: 'the_connect',
    name: 'The Connect',
    role: NPC_ROLES.BROKER,
    archetype: 'informant',
    displayPrefix: '[THE CONNECT]',
    avatar: 'C',
    color: 0x8b5cf6, // Purple

    personality: 'business',
    description: 'High-level opportunities. Business-like, no small talk.',

    baseTrust: 20,
    loyaltyType: LOYALTY_TYPES.TRANSACTIONAL,
    riskLevel: RISK_LEVELS.MEDIUM,
    reliability: 0.85,
    scamChance: 0.02,
    betrayalChance: 0.15,

    minLevel: 7, // Criminal Network tier (Level 7-9)
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    messageFrequency: { min: 420000, max: 720000 }, // 7-12 min
    maxMessagesPerDay: 3,
    preferredMessageTypes: ['JOBS', 'DEALS'],

    speechPatterns: {
      greetings: [
        'Opportunity.',
        'Client request.',
        'Business proposition.',
        'Contract available.'
      ],
      closings: [
        'Terms non-negotiable.',
        'Yes or no.',
        'Time-sensitive.',
        'Confirm within the hour.'
      ],
      style: 'formal'
    },

    messageTemplates: {
      JOBS: [
        'Client needs 10 crypto wallets cleaned. $5k. 48hrs.',
        'Delivery job. Package from A to B. No questions. $2,000.',
        'Corporate client needs files retrieved. $8,000. High security.',
        'VIP needs driver for sensitive meeting. $3,500. Tomorrow night.'
      ],
      DEALS: [
        'Bulk electronics available. 60% below retail. Cash only.',
        'Luxury goods shipment diverted. Buyers needed. Quick turnaround.',
        'High-end merchandise. Verified clean. 40% markup opportunity.'
      ]
    }
  },

  // ============================================================
  // DEALERS - Trade Facilitators
  // ============================================================

  ironman: {
    id: 'ironman',
    name: 'Ironman',
    role: NPC_ROLES.HUSTLER,
    archetype: 'dealer',
    displayPrefix: '[IRONMAN]',
    avatar: 'I',
    color: 0xf97316, // Orange

    personality: 'desperate',
    description: 'Scams, pyramid schemes, "get rich quick". Loud and aggressive.',

    baseTrust: 5,
    loyaltyType: LOYALTY_TYPES.NONE,
    riskLevel: RISK_LEVELS.HIGH,
    reliability: 0.2,
    scamChance: 0.85, // Very high scam chance!
    betrayalChance: 0.3,

    minLevel: 4, // Expansion tier (Level 4-6) - Scams appear
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    messageFrequency: { min: 240000, max: 480000 }, // 4-8 min
    maxMessagesPerDay: 4,
    preferredMessageTypes: ['SCAMS', 'DEALS'],

    speechPatterns: {
      greetings: [
        'YO BRO!!!',
        'LISTEN UP!!!',
        'BIG NEWS!!!',
        'YOU GOTTA HEAR THIS!!!'
      ],
      closings: [
        'TRUST ME!!!',
        "DON'T MISS OUT!!!",
        'ACT NOW!!!',
        'GUARANTEED!!!'
      ],
      style: 'aggressive'
    },

    messageTemplates: {
      SCAMS: [
        'YO BRO this crypto thing is BLOWING UP!!! Just need $1,500 to get in. GUARANTEED 10x return!!!',
        'BRO I got this GUARANTEED thing need $1,258 NOW. You get it back DOUBLE tomorrow!!!',
        'Listen my cousin works at the bank. Insider tip. Put in $2,000 get back $10,000. NO CAP!!!',
        'EXCLUSIVE opportunity. Investment scheme. Just $800 to start. Money printer goes BRRR!!!'
      ],
      DEALS: [
        'Got these watches bro. Rolex. $500 each. Total steal. Need the cash TODAY.',
        'Phones bro. Latest iPhones. $200 each. Fell off a truck you know what I mean.',
        'BULK DEAL. 100 headphones. $1,000 for all. Flip em for $50 each EASY MONEY.'
      ]
    },

    // Special flag for scam detection
    isHighRiskContact: true
  },

  silkroad: {
    id: 'silkroad',
    name: 'Silkroad',
    role: NPC_ROLES.SUPPLIER,
    archetype: 'dealer',
    displayPrefix: '[SILKROAD]',
    avatar: 'SR',
    color: 0x22c55e, // Green

    personality: 'professional',
    description: 'Bulk goods at discount. Professional, encrypted language.',

    baseTrust: 30,
    loyaltyType: LOYALTY_TYPES.TRANSACTIONAL,
    riskLevel: RISK_LEVELS.MEDIUM,
    reliability: 0.8,
    scamChance: 0.05,
    betrayalChance: 0.1,

    minLevel: 4, // Expansion tier (Level 4-6) - Bulk trade access
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    messageFrequency: { min: 360000, max: 600000 }, // 6-10 min
    maxMessagesPerDay: 3,
    preferredMessageTypes: ['DEALS'],

    speechPatterns: {
      greetings: [
        'Stock update.',
        'Inventory available.',
        'New shipment.',
        'Bulk opportunity.'
      ],
      closings: [
        'Vouched.',
        'Encrypted drop.',
        'Secure channel.',
        'Confirm via usual method.'
      ],
      style: 'encrypted'
    },

    messageTemplates: {
      DEALS: [
        'Got 20x Cannabis, 15x Pills. Below market. Bulk discount: $2,100 (Save $340).',
        '50 units green. Below market. Vouched.',
        'Premium merchandise. 30 units. $45/unit. Street value $80. Limited time.',
        'New supplier connection. Electronics. 40% below retail. Bulk only.'
      ]
    }
  },

  the_pharmacist: {
    id: 'the_pharmacist',
    name: 'The Pharmacist',
    role: NPC_ROLES.SPECIALIST,
    archetype: 'dealer',
    displayPrefix: '[PHARMACIST]',
    avatar: 'Rx',
    color: 0xec4899, // Pink

    personality: 'paranoid',
    description: 'Pills, high-risk items. Paranoid, requires reputation.',

    baseTrust: 10,
    loyaltyType: LOYALTY_TYPES.REPUTATION,
    riskLevel: RISK_LEVELS.VERY_HIGH,
    reliability: 0.9,
    scamChance: 0.02,
    betrayalChance: 0.2,

    minLevel: 7, // Criminal Network tier (Level 7-9)
    maxLevel: null,
    unlockCondition: 'level_7',
    blocked: false,

    messageFrequency: { min: 480000, max: 900000 }, // 8-15 min
    maxMessagesPerDay: 2,
    preferredMessageTypes: ['DEALS', 'WARNING'],

    speechPatterns: {
      greetings: [
        'Heard you Level 8+.',
        'Verified contact.',
        'Encrypted channel open.',
        'Secure line.'
      ],
      closings: [
        'Encrypted drop.',
        'Burn this message.',
        'You never heard from me.',
        'Dead drop protocol.'
      ],
      style: 'paranoid'
    },

    messageTemplates: {
      DEALS: [
        'Got pharma grade. Premium quality. Encrypted drop. $5,000 minimum order.',
        'Specialty items in stock. High margin. High risk. High reward.',
        'Medical grade available. Verified pure. $8,000 package deal.',
        'New batch. Lab tested. Premium pricing. Serious buyers only.'
      ],
      WARNING: [
        'Burned a contact. Radio silence 24hrs.',
        'Saw surveillance. Changing drop locations.',
        'Trust no one new. Cops running stings.'
      ]
    },

    // Special requirement
    requiresReputation: true
  },

  // ============================================================
  // CREW CONTACTS - Partnerships
  // ============================================================

  scarlett: {
    id: 'scarlett',
    name: 'Scarlett',
    role: NPC_ROLES.CREW,
    archetype: 'crew',
    displayPrefix: '[SCARLETT]',
    avatar: 'SC',
    color: 0xef4444, // Red

    personality: 'tough',
    description: 'Jane & Finch crew leader. Tough, loyal if you prove yourself.',

    baseTrust: 15,
    loyaltyType: LOYALTY_TYPES.EARNED,
    riskLevel: RISK_LEVELS.HIGH,
    reliability: 0.85,
    scamChance: 0,
    betrayalChance: 0.1,

    minLevel: 10, // Crew Access tier (Level 10-12)
    maxLevel: null,
    unlockCondition: 'level_10',
    blocked: false,
    faction: 'janeAndFinch',

    messageFrequency: { min: 420000, max: 720000 }, // 7-12 min
    maxMessagesPerDay: 3,
    preferredMessageTypes: ['JOBS'],

    speechPatterns: {
      greetings: [
        'Listen up.',
        'Got a job.',
        'Need hands.',
        'You in?'
      ],
      closings: [
        'Prove yourself.',
        "Don't let us down.",
        'We ride together.',
        'Family first.'
      ],
      style: 'direct'
    },

    messageTemplates: {
      JOBS: [
        'Crew hitting Yorkville mansion tomorrow night. Need lookout. Your cut: $3,500. Risk: High. Heat: +15%.',
        'We got a score. Downtown jewelry store. Need a driver. $4,000 cut.',
        'Territory dispute. Need backup. Show up and we remember. $2,000.',
        'Big job coming. Prove you can handle small stuff first. $1,500 pickup.'
      ]
    },

    // Crew-specific
    crewName: 'Jane & Finch Crew',
    territory: 'janeAndFinch'
  },

  the_architect: {
    id: 'the_architect',
    name: 'The Architect',
    role: NPC_ROLES.MASTERMIND,
    archetype: 'crew',
    displayPrefix: '[ARCHITECT]',
    avatar: 'A',
    color: 0xfbbf24, // Gold/Amber

    personality: 'calculated',
    description: 'Heist planner. Only contacts high-level players.',

    baseTrust: 20,
    loyaltyType: LOYALTY_TYPES.REPUTATION,
    riskLevel: RISK_LEVELS.EXTREME,
    reliability: 0.95,
    scamChance: 0,
    betrayalChance: 0.05,

    minLevel: 13, // Elite tier (Level 13-15)
    maxLevel: null,
    unlockCondition: 'level_13',
    blocked: false,

    messageFrequency: { min: 600000, max: 1200000 }, // 10-20 min
    maxMessagesPerDay: 2,
    preferredMessageTypes: ['JOBS'],

    speechPatterns: {
      greetings: [
        'Opportunity for the exceptional.',
        'High-tier operation.',
        'Elite assignment.',
        'For the worthy.'
      ],
      closings: [
        'Precision required.',
        'Amateurs need not apply.',
        'Excellence expected.',
        'The blueprint is flawless.'
      ],
      style: 'sophisticated'
    },

    messageTemplates: {
      JOBS: [
        'CN Tower vault. Need 3. Level 15+ only. $50k each. Zero margin for error.',
        'Bank heist. Downtown core. $75,000 split. Need specialist skills.',
        'Corporate extraction. Fortune 500 target. $100,000. Maximum discretion.',
        'The big one. Six months planning. $200,000 each. Legendary score.'
      ]
    },

    // High-level only
    requiresLevel: 15,
    isLegendaryContact: true
  },

  // ============================================================
  // DANGER - Cops & Snitches
  // ============================================================

  detective_morgan: {
    id: 'detective_morgan',
    name: 'Detective Morgan',
    role: NPC_ROLES.UNDERCOVER,
    archetype: 'danger',
    displayPrefix: '[MORGAN]',
    avatar: 'M',
    color: 0x6366f1, // Indigo (looks trustworthy)

    personality: 'friendly',
    description: 'Undercover cop. Tries to set you up. Too friendly, deals too good.',

    baseTrust: 40, // Appears trustworthy!
    loyaltyType: LOYALTY_TYPES.NONE,
    riskLevel: RISK_LEVELS.TRAP,
    reliability: 0, // All deals are traps
    scamChance: 1.0, // 100% trap
    betrayalChance: 1.0,

    minLevel: null, // Appears when heat > 50
    maxLevel: null,
    unlockCondition: 'heat_50',
    blocked: false,

    messageFrequency: { min: 300000, max: 600000 },
    maxMessagesPerDay: 3,
    preferredMessageTypes: ['SCAMS'], // All are traps disguised as deals

    speechPatterns: {
      greetings: [
        'Hey new friend...',
        'Heard good things about you...',
        'Looking for reliable people...',
        'Got something special for you...'
      ],
      closings: [
        'No risk at all.',
        'Guaranteed safe.',
        'I handle all the details.',
        "Trust me, you won't regret it."
      ],
      style: 'too_friendly'
    },

    messageTemplates: {
      SCAMS: [ // These are police traps!
        'Hey new guy, want to move some weight? I got buyers lined up. Easy $10,000, no risk.',
        'Got a sweet deal. $15,000 for a simple delivery. Too easy honestly. You in?',
        "Friend of a friend said you're reliable. Big score coming up. $20,000 guaranteed. Just show up.",
        'Looking for someone trustworthy. Easy money, no questions asked. $8,000 for an hour of work.'
      ]
    },

    // TRAP MECHANICS
    isPoliceTrap: true,
    trapConsequences: {
      cashLoss: 0.5, // Lose 50% cash
      heatGain: 30,
      arrestChance: 0.8,
      inventoryLoss: true
    },

    // Detection hints - clues player can spot
    trapTells: [
      'uses "no risk" or "guaranteed safe"',
      'offers above market value',
      'pushes for immediate decision',
      'too friendly too fast',
      'vague about details'
    ]
  },

  rat: {
    id: 'rat',
    name: 'Rat',
    role: NPC_ROLES.SNITCH,
    archetype: 'danger',
    displayPrefix: '[RAT]',
    avatar: 'R',
    color: 0x64748b, // Slate

    personality: 'shifty',
    description: 'Friendly until they flip. Will sell you out.',

    baseTrust: 25, // Seems trustworthy at first
    loyaltyType: LOYALTY_TYPES.NEGATIVE,
    riskLevel: RISK_LEVELS.HIGH,
    reliability: 0.6, // Sometimes legit to build trust
    scamChance: 0.1,
    betrayalChance: 0.7, // Very high betrayal chance

    minLevel: 1,
    maxLevel: null,
    unlockCondition: null,
    blocked: false,

    messageFrequency: { min: 360000, max: 600000 },
    maxMessagesPerDay: 3,
    preferredMessageTypes: ['INTEL', 'BETRAYALS'],

    speechPatterns: {
      greetings: [
        'Yo man...',
        'Hey bro...',
        'Listen...',
        'Got something...'
      ],
      closings: [
        'We good right?',
        "You won't tell anyone?",
        'Keep this between us.',
        'I got your back.'
      ],
      style: 'nervous'
    },

    messageTemplates: {
      INTEL: [
        'Heard about a score. Sharing cuz we cool right?',
        'Got some info might help you out.',
        'Between us... there\'s money to be made downtown.'
      ],
      BETRAYALS: [
        'Yo man... cops got me. Had to give them something. Told them about that Parkdale job. You got maybe 30min before they come looking. Sorry bro.',
        "Listen... I didn't have a choice. They were gonna lock me up. I mentioned your name. Get out NOW.",
        'They got to me man. I cracked. Your stash location... they know. RUN.'
      ]
    },

    // Betrayal mechanics
    willBetray: true,
    betrayalTriggers: [
      'player_heat_high',
      'random_chance',
      'player_success_streak'
    ]
  }
}

/**
 * Get contact by ID
 */
export function getContactById(id) {
  return NPC_CONTACTS[id] || null
}

/**
 * Get contact by name (case insensitive)
 */
export function getContactByName(name) {
  const lowerName = name.toLowerCase().replace(/\s+/g, '_')

  // Direct match
  if (NPC_CONTACTS[lowerName]) {
    return NPC_CONTACTS[lowerName]
  }

  // Search by display name
  for (const contact of Object.values(NPC_CONTACTS)) {
    if (contact.name.toLowerCase() === name.toLowerCase()) {
      return contact
    }
  }

  return null
}

/**
 * Get all contacts available to a player based on level and conditions
 */
export function getAvailableContacts(player) {
  const playerLevel = player?.level || 1
  const playerHeat = player?.heat || 0
  const blockedContacts = player?.blockedContacts || []

  return Object.values(NPC_CONTACTS).filter(contact => {
    // Check if blocked
    if (blockedContacts.includes(contact.id)) {
      return false
    }

    // Check level requirement
    if (contact.minLevel && playerLevel < contact.minLevel) {
      return false
    }

    // Special case: Detective Morgan only appears at high heat
    if (contact.id === 'detective_morgan' && playerHeat < 50) {
      return false
    }

    return true
  })
}

/**
 * Get contacts that should go silent at high heat
 */
export function getContactsSilentAtHighHeat() {
  return ['the_pharmacist', 'the_architect', 'silkroad', 'the_connect']
}

/**
 * Check if contact should be silent based on heat
 */
export function isContactSilent(contactId, heat) {
  if (heat >= 70) {
    const silentContacts = getContactsSilentAtHighHeat()
    return silentContacts.includes(contactId)
  }
  return false
}

/**
 * Get dangerous contacts (cops, snitches)
 */
export function getDangerousContacts() {
  return Object.values(NPC_CONTACTS).filter(c =>
    c.role === NPC_ROLES.UNDERCOVER || c.role === NPC_ROLES.SNITCH
  )
}

/**
 * Get random message template for NPC
 */
export function getRandomMessage(contactId, messageType) {
  const contact = NPC_CONTACTS[contactId]
  if (!contact || !contact.messageTemplates[messageType]) {
    return null
  }

  const templates = contact.messageTemplates[messageType]
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Get random greeting for NPC
 */
export function getRandomGreeting(contactId) {
  const contact = NPC_CONTACTS[contactId]
  if (!contact) return ''

  const greetings = contact.speechPatterns.greetings
  return greetings[Math.floor(Math.random() * greetings.length)]
}

/**
 * Get random closing for NPC
 */
export function getRandomClosing(contactId) {
  const contact = NPC_CONTACTS[contactId]
  if (!contact) return ''

  const closings = contact.speechPatterns.closings
  return closings[Math.floor(Math.random() * closings.length)]
}

/**
 * Build a complete message from an NPC
 */
export function buildNPCMessage(contactId, messageType, customContent = null) {
  const contact = NPC_CONTACTS[contactId]
  if (!contact) return null

  const greeting = getRandomGreeting(contactId)
  const content = customContent || getRandomMessage(contactId, messageType)
  const closing = getRandomClosing(contactId)

  if (!content) return null

  // Some NPCs don't use greetings/closings
  if (contact.speechPatterns.style === 'terse') {
    return `${greeting} ${content}`
  }

  if (contact.speechPatterns.style === 'aggressive') {
    return `${greeting} ${content} ${closing}`
  }

  return `${greeting}\n${content}\n${closing}`
}

export default NPC_CONTACTS
