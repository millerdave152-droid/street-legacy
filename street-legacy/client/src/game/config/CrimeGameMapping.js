// Crime to Mini-Game Mapping Configuration
// Maps each crime type to its corresponding mini-game

export const MINI_GAME_TYPES = {
  SNAKE: 'snake',
  LOCKPICK: 'lockpick',
  QTE: 'qte',
  FROGGER: 'frogger',
  MEMORY: 'memory',
  STEADYHAND: 'steadyhand',
  CHASE: 'chase',
  SNIPER: 'sniper',
  SAFECRACK: 'safecrack',
  WIRE: 'wire',
  // New enhanced mini-games
  RHYTHM: 'rhythm',
  HACKING: 'hacking',
  GETAWAY: 'getaway',
  NEGOTIATION: 'negotiation',
  SURVEILLANCE: 'surveillance',
  STEALTH: 'stealth',
  DISGUISE: 'disguise'
}

const COLORS = {
  RED: 0xef4444,
  GREEN: 0x22c55e,
  BLUE: 0x3b82f6,
  AMBER: 0xf59e0b,
  PURPLE: 0xa855f7,
  ORANGE: 0xf97316,
  PINK: 0xec4899,
  GRAY: 0x6b7280,
  DARK: 0x0a0a0a,
  SUCCESS: 0x10b981,
}

/**
 * Crime to mini-game mappings
 * @type {Object.<string, {
 *   crimeId: string,
 *   crimeName: string,
 *   gameType: string,
 *   difficulty: number,
 *   timeLimit: number,
 *   targetScore: number,
 *   perfectScore: number,
 *   theme: {
 *     primaryColor: number,
 *     secondaryColor: number,
 *     dangerColor: number,
 *     successColor: number,
 *     backgroundColor: number,
 *     icon: string
 *   },
 *   description: string
 * }>}
 */
export const CRIME_GAME_MAPPINGS = {
  // PETTY CRIMES (Level 1)
  pickpocket: {
    crimeId: 'pickpocket',
    crimeName: 'Pickpocket',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 1,
    timeLimit: 15,
    targetScore: 100,
    perfectScore: 200,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x15803d,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '👛'
    },
    description: 'Keep your hand steady'
  },
  shoplifting: {
    crimeId: 'shoplifting',
    crimeName: 'Shoplifting',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 1,
    timeLimit: 20,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🛒'
    },
    description: 'Avoid cameras and guards'
  },
  panhandling_scam: {
    crimeId: 'panhandling_scam',
    crimeName: 'Panhandling Scam',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 12,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🪙'
    },
    description: 'Work the sympathy angle!'
  },
  fare_evasion: {
    crimeId: 'fare_evasion',
    crimeName: 'TTC Fare Evasion',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 1,
    timeLimit: 15,
    targetScore: 2,
    perfectScore: 4,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚇'
    },
    description: 'Dodge the fare inspectors!'
  },

  // STREET CRIMES (Level 3-4)
  mugging: {
    crimeId: 'mugging',
    crimeName: 'Mugging',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 12,
    targetScore: 6,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔪'
    },
    description: 'Intimidate with quick actions'
  },
  car_prowling: {
    crimeId: 'car_prowling',
    crimeName: 'Car Prowling',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 18,
    targetScore: 120,
    perfectScore: 200,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚙'
    },
    description: 'Smash and grab valuables!'
  },
  drug_dealing: {
    crimeId: 'drug_dealing',
    crimeName: 'Street Dealing',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 500,
    perfectScore: 1000,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💊'
    },
    description: 'Collect product, avoid cops'
  },
  vandalism: {
    crimeId: 'vandalism',
    crimeName: 'Vandalism for Hire',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 15,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎨'
    },
    description: 'Tag the target quickly!'
  },

  // SERIOUS CRIMES (Level 8-12)
  car_theft: {
    crimeId: 'car_theft',
    crimeName: 'Car Theft',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 25,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔑'
    },
    description: 'Hotwire before the alarm'
  },
  burglary: {
    crimeId: 'burglary',
    crimeName: 'Burglary',
    gameType: MINI_GAME_TYPES.LOCKPICK,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏠'
    },
    description: 'Pick the locks'
  },
  armed_robbery: {
    crimeId: 'armed_robbery',
    crimeName: 'Armed Robbery',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 20,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔫'
    },
    description: 'Control the room'
  },
  drug_trafficking: {
    crimeId: 'drug_trafficking',
    crimeName: 'Drug Trafficking',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 1500,
    perfectScore: 2500,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📦'
    },
    description: 'Move the weight across the city'
  },
  extortion: {
    crimeId: 'extortion',
    crimeName: 'Extortion',
    gameType: MINI_GAME_TYPES.NEGOTIATION,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: 0x1e293b,
      secondaryColor: 0x0f172a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🤝'
    },
    description: 'Make them an offer they cant refuse'
  },

  // ORGANIZED CRIMES (Level 15-20)
  heist_planning: {
    crimeId: 'heist_planning',
    crimeName: 'Heist Planning',
    gameType: MINI_GAME_TYPES.SURVEILLANCE,
    difficulty: 3,
    timeLimit: 45,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📋'
    },
    description: 'Case the location!'
  },
  money_laundering: {
    crimeId: 'money_laundering',
    crimeName: 'Money Laundering',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 800,
    perfectScore: 1500,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💵'
    },
    description: 'Route the money carefully'
  },
  warehouse_heist: {
    crimeId: 'warehouse_heist',
    crimeName: 'Warehouse Heist',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 4,
    timeLimit: 50,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏭'
    },
    description: 'Navigate the warehouse security'
  },

  // ELITE CRIMES (Level 25+)
  bank_heist: {
    crimeId: 'bank_heist',
    crimeName: 'Bank Heist',
    gameType: MINI_GAME_TYPES.SAFECRACK,
    difficulty: 5,
    timeLimit: 60,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏦'
    },
    description: 'Crack the vault'
  },
  art_theft: {
    crimeId: 'art_theft',
    crimeName: 'Art Theft',
    gameType: MINI_GAME_TYPES.SNIPER,
    difficulty: 5,
    timeLimit: 35,
    targetScore: 1,
    perfectScore: 1,
    theme: {
      primaryColor: 0xeab308,
      secondaryColor: 0xca8a04,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🖼️'
    },
    description: 'Precision required'
  },

  // ==========================================
  // TIER 1: PETTY STREET CRIMES (Level 1-5)
  // ==========================================

  shoplift: {
    crimeId: 'shoplift',
    crimeName: 'Shoplifting',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 1,
    timeLimit: 20,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x15803d,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🛒'
    },
    description: 'Avoid cameras and staff!'
  },

  dine_dash: {
    crimeId: 'dine_dash',
    crimeName: 'Dine and Dash',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 12,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍽️'
    },
    description: 'Eat fast and bolt!'
  },

  purse_snatch: {
    crimeId: 'purse_snatch',
    crimeName: 'Purse Snatching',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 10,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.PINK,
      secondaryColor: 0xdb2777,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '👜'
    },
    description: 'Quick reflexes - grab and run!'
  },

  package_theft: {
    crimeId: 'package_theft',
    crimeName: 'Package Theft',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 1,
    timeLimit: 18,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: 0x8b4513,
      secondaryColor: 0x654321,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📦'
    },
    description: 'Grab packages, avoid neighbors!'
  },

  gas_driveoff: {
    crimeId: 'gas_driveoff',
    crimeName: 'Gas Station Drive-off',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 12,
    targetScore: 5,
    perfectScore: 7,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '⛽'
    },
    description: 'Fill up and floor it!'
  },

  // ==========================================
  // TIER 2: PROPERTY CRIMES (Level 5-15)
  // ==========================================

  car_break_in: {
    crimeId: 'car_break_in',
    crimeName: 'Car Break-in',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 18,
    targetScore: 120,
    perfectScore: 200,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚙'
    },
    description: 'Smash and grab fast!'
  },

  bike_theft: {
    crimeId: 'bike_theft',
    crimeName: 'Bike Theft',
    gameType: MINI_GAME_TYPES.LOCKPICK,
    difficulty: 1,
    timeLimit: 20,
    targetScore: 2,
    perfectScore: 4,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚲'
    },
    description: 'Cut the lock fast!'
  },

  joyriding: {
    crimeId: 'joyriding',
    crimeName: 'Joyriding',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 2,
    timeLimit: 22,
    targetScore: 3,
    perfectScore: 4,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏎️'
    },
    description: 'Hotwire and ride!'
  },

  copper_theft: {
    crimeId: 'copper_theft',
    crimeName: 'Copper Wire Theft',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: 0xb87333,
      secondaryColor: 0x996515,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔌'
    },
    description: 'Strip the wiring fast!'
  },

  catalytic_theft: {
    crimeId: 'catalytic_theft',
    crimeName: 'Catalytic Converter Theft',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 20,
    targetScore: 150,
    perfectScore: 250,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔧'
    },
    description: 'Cut it clean and fast!'
  },

  graffiti_vandalism: {
    crimeId: 'graffiti_vandalism',
    crimeName: 'Graffiti Tag',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 1,
    timeLimit: 18,
    targetScore: 100,
    perfectScore: 180,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎨'
    },
    description: 'Tag your mark!'
  },

  house_burglary: {
    crimeId: 'house_burglary',
    crimeName: 'House Burglary',
    gameType: MINI_GAME_TYPES.LOCKPICK,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏠'
    },
    description: 'Pick the locks quietly!'
  },

  atm_skimming: {
    crimeId: 'atm_skimming',
    crimeName: 'ATM Skimming',
    gameType: MINI_GAME_TYPES.HACKING,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 500,
    perfectScore: 800,
    theme: {
      primaryColor: 0x00ff41,
      secondaryColor: 0x00cc33,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💳'
    },
    description: 'Hack the ATM system!'
  },

  // ==========================================
  // TIER 3: ROBBERY & THEFT (Level 10-25)
  // ==========================================

  strong_arm: {
    crimeId: 'strong_arm',
    crimeName: 'Strong-arm Robbery',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 15,
    targetScore: 8,
    perfectScore: 12,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💪'
    },
    description: 'Overpower the mark!'
  },

  convenience_robbery: {
    crimeId: 'convenience_robbery',
    crimeName: 'Convenience Store Robbery',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 20,
    targetScore: 10,
    perfectScore: 14,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏪'
    },
    description: 'Control the store!'
  },

  gas_station_robbery: {
    crimeId: 'gas_station_robbery',
    crimeName: 'Gas Station Robbery',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 18,
    targetScore: 8,
    perfectScore: 12,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '⛽'
    },
    description: 'Hit the register fast!'
  },

  liquor_store_robbery: {
    crimeId: 'liquor_store_robbery',
    crimeName: 'Liquor Store Robbery',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 20,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍾'
    },
    description: 'Empty the register!'
  },

  jewelry_smash: {
    crimeId: 'jewelry_smash',
    crimeName: 'Jewelry Smash & Grab',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 15,
    targetScore: 12,
    perfectScore: 18,
    theme: {
      primaryColor: 0xeab308,
      secondaryColor: 0xca8a04,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💎'
    },
    description: 'Smash and grab the goods!'
  },

  // LEGACY MAPPINGS (keep for backward compatibility)
  purse_snatching: {
    crimeId: 'purse_snatching',
    crimeName: 'Purse Snatching',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 10,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.PINK,
      secondaryColor: 0xdb2777,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '👜'
    },
    description: 'Quick reflexes - grab and run!'
  },
  drug_deal: {
    crimeId: 'drug_deal',
    crimeName: 'Drug Deal',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 500,
    perfectScore: 1000,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💊'
    },
    description: 'Collect product, avoid cops'
  },

  // SERIOUS CRIMES
  grand_theft_auto: {
    crimeId: 'grand_theft_auto',
    crimeName: 'Grand Theft Auto',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 3,
    timeLimit: 45,
    targetScore: 1000,
    perfectScore: 2000,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏎️'
    },
    description: 'Steal and escape'
  },
  robbery: {
    crimeId: 'robbery',
    crimeName: 'Armed Robbery',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 20,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔫'
    },
    description: 'Control the room'
  },
  jewelry_heist: {
    crimeId: 'jewelry_heist',
    crimeName: 'Jewelry Heist',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: 0xeab308,
      secondaryColor: 0xca8a04,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💎'
    },
    description: 'Memorize the laser grid'
  },

  // MAJOR CRIMES
  bank_heist: {
    crimeId: 'bank_heist',
    crimeName: 'Bank Heist',
    gameType: MINI_GAME_TYPES.SAFECRACK,
    difficulty: 4,
    timeLimit: 60,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏦'
    },
    description: 'Crack the vault'
  },
  armored_car: {
    crimeId: 'armored_car',
    crimeName: 'Armored Car Heist',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 4,
    timeLimit: 60,
    targetScore: 2000,
    perfectScore: 3500,
    theme: {
      primaryColor: 0x64748b,
      secondaryColor: 0x475569,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚐'
    },
    description: 'Intercept and escape'
  },
  assassination: {
    crimeId: 'assassination',
    crimeName: 'Contract Hit',
    gameType: MINI_GAME_TYPES.SNIPER,
    difficulty: 5,
    timeLimit: 30,
    targetScore: 1,
    perfectScore: 1,
    theme: {
      primaryColor: 0x1e293b,
      secondaryColor: 0x0f172a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: 0x000000,
      icon: '🎯'
    },
    description: 'One shot. Make it count.'
  },

  // ==========================================
  // TIER 4: VEHICLE CRIMES (Level 15-30)
  // ==========================================

  luxury_theft: {
    crimeId: 'luxury_theft',
    crimeName: 'Luxury Car Theft',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 4,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 7,
    theme: {
      primaryColor: 0xeab308,
      secondaryColor: 0xca8a04,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏎️'
    },
    description: 'Hotwire the exotic!'
  },

  chop_shop: {
    crimeId: 'chop_shop',
    crimeName: 'Chop Shop Work',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 6,
    perfectScore: 9,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔧'
    },
    description: 'Disassemble fast!'
  },

  vin_switching: {
    crimeId: 'vin_switching',
    crimeName: 'VIN Switching',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏷️'
    },
    description: 'Match the VIN codes!'
  },

  carjacking: {
    crimeId: 'carjacking',
    crimeName: 'Carjacking',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 4,
    timeLimit: 15,
    targetScore: 12,
    perfectScore: 18,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚗'
    },
    description: 'Take the car by force!'
  },

  truck_hijacking: {
    crimeId: 'truck_hijacking',
    crimeName: 'Truck Hijacking',
    gameType: MINI_GAME_TYPES.GETAWAY,
    difficulty: 4,
    timeLimit: 45,
    targetScore: 800,
    perfectScore: 1500,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚛'
    },
    description: 'Escape with the cargo!'
  },

  // ==========================================
  // TIER 5: CON ARTIST & FRAUD (Level 10-35)
  // ==========================================

  fake_charity: {
    crimeId: 'fake_charity',
    crimeName: 'Fake Charity',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 20,
    targetScore: 8,
    perfectScore: 12,
    theme: {
      primaryColor: 0x06b6d4,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '❤️'
    },
    description: 'Sell the sympathy story!'
  },

  identity_theft: {
    crimeId: 'identity_theft',
    crimeName: 'Identity Theft',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 6,
    perfectScore: 10,
    theme: {
      primaryColor: 0x06b6d4,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🪪'
    },
    description: 'Match the identity docs!'
  },

  check_fraud: {
    crimeId: 'check_fraud',
    crimeName: 'Check Fraud',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 3,
    timeLimit: 25,
    targetScore: 180,
    perfectScore: 280,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '✍️'
    },
    description: 'Forge the signature!'
  },

  credit_fraud: {
    crimeId: 'credit_fraud',
    crimeName: 'Credit Card Fraud',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💳'
    },
    description: 'Match the card data!'
  },

  rental_scam: {
    crimeId: 'rental_scam',
    crimeName: 'Rental Scam',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 25,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: 0x06b6d4,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏠'
    },
    description: 'Close the fake deal!'
  },

  insurance_fraud: {
    crimeId: 'insurance_fraud',
    crimeName: 'Insurance Fraud',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: 0x06b6d4,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🩹'
    },
    description: 'Sell the fake injury!'
  },

  romance_scam: {
    crimeId: 'romance_scam',
    crimeName: 'Romance Scam',
    gameType: MINI_GAME_TYPES.RHYTHM,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 600,
    perfectScore: 1000,
    theme: {
      primaryColor: COLORS.PINK,
      secondaryColor: 0xdb2777,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💕'
    },
    description: 'Keep the rhythm of romance!'
  },

  // ==========================================
  // TIER 6: DRUG OPERATIONS (Level 15-40)
  // ==========================================

  street_deal: {
    crimeId: 'street_deal',
    crimeName: 'Street Dealing',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 500,
    perfectScore: 1000,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💊'
    },
    description: 'Collect product, avoid cops!'
  },

  dead_drop: {
    crimeId: 'dead_drop',
    crimeName: 'Dead Drop Pickup',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📍'
    },
    description: 'Find the stash unseen!'
  },

  drug_runner: {
    crimeId: 'drug_runner',
    crimeName: 'Drug Runner',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 1500,
    perfectScore: 2500,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏃'
    },
    description: 'Deliver the package!'
  },

  cutting_packaging: {
    crimeId: 'cutting_packaging',
    crimeName: 'Cutting & Packaging',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 200,
    perfectScore: 350,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '⚖️'
    },
    description: 'Measure precisely!'
  },

  drug_mule: {
    crimeId: 'drug_mule',
    crimeName: 'Drug Mule',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 4,
    timeLimit: 45,
    targetScore: 6,
    perfectScore: 9,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '✈️'
    },
    description: 'Get through customs!'
  },

  // ==========================================
  // TIER 7: ORGANIZED CRIME (Level 25-50)
  // ==========================================

  protection_racket: {
    crimeId: 'protection_racket',
    crimeName: 'Protection Racket',
    gameType: MINI_GAME_TYPES.NEGOTIATION,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: 0xf59e0b,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🤝'
    },
    description: 'Negotiate your terms!'
  },

  debt_collection: {
    crimeId: 'debt_collection',
    crimeName: 'Debt Collection',
    gameType: MINI_GAME_TYPES.NEGOTIATION,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: 0x7f1d1d,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💰'
    },
    description: 'Make them an offer!'
  },

  fencing: {
    crimeId: 'fencing',
    crimeName: 'Fencing',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 6,
    perfectScore: 10,
    theme: {
      primaryColor: 0xf59e0b,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏪'
    },
    description: 'Match goods to buyers!'
  },

  fight_fixing: {
    crimeId: 'fight_fixing',
    crimeName: 'Fight Fixing',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 4,
    timeLimit: 30,
    targetScore: 15,
    perfectScore: 22,
    theme: {
      primaryColor: 0xf59e0b,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🥊'
    },
    description: 'Control the outcome!'
  },

  smuggling: {
    crimeId: 'smuggling',
    crimeName: 'Smuggling',
    gameType: MINI_GAME_TYPES.GETAWAY,
    difficulty: 4,
    timeLimit: 50,
    targetScore: 1000,
    perfectScore: 1800,
    theme: {
      primaryColor: 0xf59e0b,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📦'
    },
    description: 'Outrun the border patrol!'
  },

  // ==========================================
  // TIER 8: CYBER CRIMES (Level 20-45)
  // ==========================================

  phishing: {
    crimeId: 'phishing',
    crimeName: 'Phishing',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: 0x00ff88,
      secondaryColor: 0x00cc66,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎣'
    },
    description: 'Match the credentials!'
  },

  card_skimming: {
    crimeId: 'card_skimming',
    crimeName: 'Card Skimming',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 7,
    theme: {
      primaryColor: 0x00ff88,
      secondaryColor: 0x00cc66,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💳'
    },
    description: 'Install the skimmer!'
  },

  sim_swapping: {
    crimeId: 'sim_swapping',
    crimeName: 'SIM Swapping',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 25,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: 0x00ff88,
      secondaryColor: 0x00cc66,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📱'
    },
    description: 'Social engineer the carrier!'
  },

  account_takeover: {
    crimeId: 'account_takeover',
    crimeName: 'Account Takeover',
    gameType: MINI_GAME_TYPES.HACKING,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 500,
    perfectScore: 900,
    theme: {
      primaryColor: 0x00ff88,
      secondaryColor: 0x00cc66,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔓'
    },
    description: 'Bypass their security!'
  },

  ransomware: {
    crimeId: 'ransomware',
    crimeName: 'Ransomware Attack',
    gameType: MINI_GAME_TYPES.HACKING,
    difficulty: 4,
    timeLimit: 45,
    targetScore: 700,
    perfectScore: 1200,
    theme: {
      primaryColor: 0x00ff88,
      secondaryColor: 0x00cc66,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔒'
    },
    description: 'Breach the firewall!'
  },

  crypto_scam: {
    crimeId: 'crypto_scam',
    crimeName: 'Crypto Scam',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 4,
    timeLimit: 40,
    targetScore: 1000,
    perfectScore: 1800,
    theme: {
      primaryColor: 0x00ff88,
      secondaryColor: 0x00cc66,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '₿'
    },
    description: 'Collect the crypto!'
  },

  // ==========================================
  // TIER 9: CLASSIC CRIMES (Level 10-35)
  // ==========================================

  three_card: {
    crimeId: 'three_card',
    crimeName: 'Three-Card Monte',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: 0xd4a574,
      secondaryColor: 0xb8956f,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🃏'
    },
    description: 'Hustle the marks!'
  },

  shell_game: {
    crimeId: 'shell_game',
    crimeName: 'Shell Game',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: 0xd4a574,
      secondaryColor: 0xb8956f,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🥜'
    },
    description: 'Confuse the crowd!'
  },

  bootlegging: {
    crimeId: 'bootlegging',
    crimeName: 'Bootlegging',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 3,
    timeLimit: 45,
    targetScore: 1500,
    perfectScore: 2500,
    theme: {
      primaryColor: 0xd4a574,
      secondaryColor: 0xb8956f,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🥃'
    },
    description: 'Run the moonshine!'
  },

  counterfeiting: {
    crimeId: 'counterfeiting',
    crimeName: 'Counterfeiting',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 4,
    timeLimit: 40,
    targetScore: 280,
    perfectScore: 400,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💵'
    },
    description: 'Print perfect bills!'
  },

  art_forgery: {
    crimeId: 'art_forgery',
    crimeName: 'Art Forgery',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 4,
    timeLimit: 45,
    targetScore: 300,
    perfectScore: 450,
    theme: {
      primaryColor: 0xd4a574,
      secondaryColor: 0xb8956f,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🖼️'
    },
    description: 'Copy the masterpiece!'
  },

  safe_cracking: {
    crimeId: 'safe_cracking',
    crimeName: 'Safe Cracking',
    gameType: MINI_GAME_TYPES.SAFECRACK,
    difficulty: 4,
    timeLimit: 50,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔐'
    },
    description: 'Crack the combination!'
  },

  cat_burglary: {
    crimeId: 'cat_burglary',
    crimeName: 'Cat Burglary',
    gameType: MINI_GAME_TYPES.STEALTH,
    difficulty: 4,
    timeLimit: 50,
    targetScore: 200,
    perfectScore: 350,
    theme: {
      primaryColor: 0x1e293b,
      secondaryColor: 0x0f172a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: 0x000000,
      icon: '🐱'
    },
    description: 'Navigate past guards unseen!'
  },

  // Social engineering with disguise
  impersonation: {
    crimeId: 'impersonation',
    crimeName: 'Identity Impersonation',
    gameType: MINI_GAME_TYPES.DISGUISE,
    difficulty: 3,
    timeLimit: 45,
    targetScore: 300,
    perfectScore: 500,
    theme: {
      primaryColor: 0x06b6d4,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎭'
    },
    description: 'Maintain your cover identity!'
  },

  infiltration: {
    crimeId: 'infiltration',
    crimeName: 'Corporate Infiltration',
    gameType: MINI_GAME_TYPES.STEALTH,
    difficulty: 4,
    timeLimit: 60,
    targetScore: 250,
    perfectScore: 400,
    theme: {
      primaryColor: 0x3b82f6,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏢'
    },
    description: 'Infiltrate the secure facility!'
  },

  social_engineering: {
    crimeId: 'social_engineering',
    crimeName: 'Social Engineering',
    gameType: MINI_GAME_TYPES.DISGUISE,
    difficulty: 3,
    timeLimit: 40,
    targetScore: 250,
    perfectScore: 400,
    theme: {
      primaryColor: 0x8b5cf6,
      secondaryColor: 0x7c3aed,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🗣️'
    },
    description: 'Talk your way past security!'
  }
}

/**
 * Get mini-game mapping for a crime
 * @param {string} crimeId - Crime identifier (name or id)
 * @returns {Object|null} The crime mapping or null
 */
export function getCrimeMapping(crimeId) {
  // Normalize the ID
  const normalizedId = String(crimeId).toLowerCase().replace(/\s+/g, '_')

  // Try direct match
  if (CRIME_GAME_MAPPINGS[normalizedId]) {
    return CRIME_GAME_MAPPINGS[normalizedId]
  }

  // Try matching by crime name
  for (const key of Object.keys(CRIME_GAME_MAPPINGS)) {
    const mapping = CRIME_GAME_MAPPINGS[key]
    if (mapping.crimeName.toLowerCase().replace(/\s+/g, '_') === normalizedId) {
      return mapping
    }
  }

  return null
}

/**
 * Get the scene key for a mini-game type
 * @param {string} gameType - Mini-game type
 * @returns {string} Scene key
 */
export function getSceneKeyForGame(gameType) {
  const sceneMap = {
    [MINI_GAME_TYPES.SNAKE]: 'SnakeGame',
    [MINI_GAME_TYPES.LOCKPICK]: 'LockPickGame',
    [MINI_GAME_TYPES.QTE]: 'QTEGame',
    [MINI_GAME_TYPES.FROGGER]: 'FroggerGame',
    [MINI_GAME_TYPES.MEMORY]: 'MemoryGame',
    [MINI_GAME_TYPES.STEADYHAND]: 'SteadyHandGame',
    [MINI_GAME_TYPES.CHASE]: 'ChaseGame',
    [MINI_GAME_TYPES.SNIPER]: 'SniperGame',
    [MINI_GAME_TYPES.SAFECRACK]: 'SafeCrackGame',
    [MINI_GAME_TYPES.WIRE]: 'WireGame',
    // New enhanced mini-games
    [MINI_GAME_TYPES.RHYTHM]: 'RhythmGame',
    [MINI_GAME_TYPES.HACKING]: 'HackingGame',
    [MINI_GAME_TYPES.GETAWAY]: 'GetawayGame',
    [MINI_GAME_TYPES.NEGOTIATION]: 'NegotiationGame',
    [MINI_GAME_TYPES.SURVEILLANCE]: 'SurveillanceGame',
    [MINI_GAME_TYPES.STEALTH]: 'StealthGame',
    [MINI_GAME_TYPES.DISGUISE]: 'DisguiseGame'
  }
  return sceneMap[gameType] || 'QTEGame' // Default to QTE
}

/**
 * Create a default mapping for unknown crimes
 * @param {string} crimeId
 * @param {string} crimeName
 * @param {number} difficulty
 * @returns {Object}
 */
export function createDefaultMapping(crimeId, crimeName, difficulty = 1) {
  return {
    crimeId,
    crimeName,
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: Math.min(5, Math.max(1, difficulty)),
    timeLimit: 15,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎯'
    },
    description: 'Complete the challenge!'
  }
}
