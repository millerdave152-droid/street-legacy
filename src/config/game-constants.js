/**
 * Street Legacy - Game Constants
 * Core game configuration values for the Toronto crime/business simulation
 */

// =============================================================================
// STARTER BUILDS
// =============================================================================
export const STARTER_BUILDS = {
  hustler: {
    cash: 1000,
    bank: 0,
    rep_crime: 50,
    rep_business: 10,
    rep_family: 10
  },
  entrepreneur: {
    cash: 500,
    bank: 500,
    rep_crime: 10,
    rep_business: 50,
    rep_family: 20
  },
  community_kid: {
    cash: 300,
    bank: 200,
    rep_crime: 10,
    rep_business: 20,
    rep_family: 50
  }
};

// =============================================================================
// PROGRESSION
// =============================================================================
export const PROGRESSION = {
  xp_per_level: (level) => level * 100,
  max_level: 50,
  energy_max: 100,
  energy_regen_seconds: 30, // 1 energy per 30 seconds
  energy_regen_rate: 1
};

// =============================================================================
// CRIME TYPES
// =============================================================================
export const CRIME_TYPES = {
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    description: 'Lift wallets from unsuspecting pedestrians',
    level_required: 1,
    payout_min: 20,
    payout_max: 80,
    success_rate: 0.70,
    heat_min: 2,
    heat_max: 5,
    energy_cost: 5,
    cooldown_seconds: 30
  },
  shoplifting: {
    id: 'shoplifting',
    name: 'Shoplifting',
    description: 'Steal merchandise from retail stores',
    level_required: 1,
    payout_min: 30,
    payout_max: 100,
    success_rate: 0.65,
    heat_min: 3,
    heat_max: 8,
    energy_cost: 8,
    cooldown_seconds: 60
  },
  mugging: {
    id: 'mugging',
    name: 'Mugging',
    description: 'Rob people on the street by force',
    level_required: 2,
    payout_min: 50,
    payout_max: 200,
    success_rate: 0.55,
    heat_min: 8,
    heat_max: 15,
    energy_cost: 12,
    cooldown_seconds: 120,
    allows_pvp: true
  },
  car_theft: {
    id: 'car_theft',
    name: 'Car Theft',
    description: 'Steal vehicles for resale or parts',
    level_required: 3,
    payout_min: 200,
    payout_max: 800,
    success_rate: 0.45,
    heat_min: 15,
    heat_max: 25,
    energy_cost: 15,
    cooldown_seconds: 300,
    has_minigame: true
  },
  burglary: {
    id: 'burglary',
    name: 'Burglary',
    description: 'Break into homes and businesses',
    level_required: 4,
    payout_min: 300,
    payout_max: 1200,
    success_rate: 0.40,
    heat_min: 20,
    heat_max: 35,
    energy_cost: 20,
    cooldown_seconds: 600,
    has_minigame: true
  },
  drug_run: {
    id: 'drug_run',
    name: 'Drug Run',
    description: 'Transport contraband across districts',
    level_required: 2,
    payout_min: 100,
    payout_max: 400,
    success_rate: 0.50,
    heat_min: 10,
    heat_max: 20,
    energy_cost: 10,
    cooldown_seconds: 180
  },
  armed_robbery: {
    id: 'armed_robbery',
    name: 'Armed Robbery',
    description: 'Hold up businesses at gunpoint',
    level_required: 5,
    payout_min: 500,
    payout_max: 2000,
    success_rate: 0.35,
    heat_min: 30,
    heat_max: 50,
    energy_cost: 25,
    cooldown_seconds: 900,
    requires_weapon: true
  },
  bank_heist: {
    id: 'bank_heist',
    name: 'Bank Heist',
    description: 'The big score - rob a bank vault',
    level_required: 8,
    payout_min: 5000,
    payout_max: 20000,
    success_rate: 0.20,
    heat_min: 50,
    heat_max: 80,
    energy_cost: 50,
    cooldown_seconds: 3600,
    has_minigame: true
  }
};

// =============================================================================
// JOB TYPES
// =============================================================================
export const JOB_TYPES = {
  delivery: {
    id: 'delivery',
    name: 'Delivery Driver',
    description: 'Deliver packages around the city',
    level_required: 1,
    payout: 50,
    energy_cost: 10,
    cooldown_seconds: 60,
    available_districts: 'all'
  },
  security: {
    id: 'security',
    name: 'Security Guard',
    description: 'Stand watch at local businesses',
    level_required: 2,
    payout: 100,
    energy_cost: 15,
    cooldown_seconds: 120,
    available_districts: null
  },
  temp_work: {
    id: 'temp_work',
    name: 'Temp Work',
    description: 'Day labor and odd jobs',
    level_required: 1,
    payout: 75,
    energy_cost: 20,
    cooldown_seconds: 90,
    available_districts: null
  },
  bartending: {
    id: 'bartending',
    name: 'Bartending',
    description: 'Serve drinks at local bars',
    level_required: 3,
    payout: 150,
    energy_cost: 12,
    cooldown_seconds: 150,
    available_districts: null
  },
  accounting: {
    id: 'accounting',
    name: 'Accounting',
    description: 'Cook the books for local businesses',
    level_required: 5,
    payout: 300,
    energy_cost: 8,
    cooldown_seconds: 300,
    available_districts: null
  }
};

// =============================================================================
// BUSINESS TYPES
// =============================================================================
export const BUSINESS_TYPES = {
  // Legit Businesses
  laundromat: {
    id: 'laundromat',
    name: 'Laundromat',
    description: 'Self-service laundry facility',
    category: 'legit',
    setup_cost: 5000,
    income_per_hour: 50,
    cost_per_hour: 10,
    max_employees: 2,
    level_required: 1,
    rep_business_required: 0,
    rep_crime_required: 0,
    heat_generation: 0
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Local eatery serving the community',
    category: 'legit',
    setup_cost: 15000,
    income_per_hour: 150,
    cost_per_hour: 40,
    max_employees: 5,
    level_required: 2,
    rep_business_required: 0,
    rep_crime_required: 0,
    heat_generation: 0
  },
  bar: {
    id: 'bar',
    name: 'Bar',
    description: 'Neighborhood watering hole',
    category: 'legit',
    setup_cost: 25000,
    income_per_hour: 250,
    cost_per_hour: 60,
    max_employees: 4,
    level_required: 3,
    rep_business_required: 0,
    rep_crime_required: 0,
    heat_generation: 0
  },
  gym: {
    id: 'gym',
    name: 'Gym',
    description: 'Fitness center and training facility',
    category: 'legit',
    setup_cost: 30000,
    income_per_hour: 200,
    cost_per_hour: 50,
    max_employees: 3,
    level_required: 3,
    rep_business_required: 0,
    rep_crime_required: 0,
    heat_generation: 0
  },

  // Gray Market Businesses
  pawn_shop: {
    id: 'pawn_shop',
    name: 'Pawn Shop',
    description: 'Buy and sell secondhand goods, no questions asked',
    category: 'gray',
    setup_cost: 10000,
    income_per_hour: 120,
    cost_per_hour: 25,
    max_employees: 2,
    level_required: 1,
    rep_business_required: 0,
    rep_crime_required: 0,
    heat_generation: 5
  },
  dispensary: {
    id: 'dispensary',
    name: 'Dispensary',
    description: 'Licensed cannabis retail outlet',
    category: 'gray',
    setup_cost: 20000,
    income_per_hour: 300,
    cost_per_hour: 70,
    max_employees: 3,
    level_required: 3,
    rep_business_required: 100,
    rep_crime_required: 0,
    heat_generation: 0
  },

  // Underground Businesses
  drug_lab: {
    id: 'drug_lab',
    name: 'Drug Lab',
    description: 'Manufacturing facility for illegal substances',
    category: 'underground',
    setup_cost: 50000,
    income_per_hour: 500,
    cost_per_hour: 100,
    max_employees: 4,
    level_required: 5,
    rep_business_required: 0,
    rep_crime_required: 200,
    heat_generation: 30
  },
  chop_shop: {
    id: 'chop_shop',
    name: 'Chop Shop',
    description: 'Disassemble stolen vehicles for parts',
    category: 'underground',
    setup_cost: 40000,
    income_per_hour: 400,
    cost_per_hour: 80,
    max_employees: 5,
    level_required: 4,
    rep_business_required: 0,
    rep_crime_required: 150,
    heat_generation: 25
  },
  gambling_den: {
    id: 'gambling_den',
    name: 'Gambling Den',
    description: 'Underground casino and card room',
    category: 'underground',
    setup_cost: 35000,
    income_per_hour: 350,
    cost_per_hour: 90,
    max_employees: 4,
    level_required: 4,
    rep_business_required: 0,
    rep_crime_required: 0,
    heat_generation: 20
  },
  weapons_cache: {
    id: 'weapons_cache',
    name: 'Weapons Cache',
    description: 'Arms storage and distribution point',
    category: 'underground',
    setup_cost: 60000,
    income_per_hour: 600,
    cost_per_hour: 120,
    max_employees: 3,
    level_required: 6,
    rep_business_required: 0,
    rep_crime_required: 300,
    heat_generation: 40
  }
};

// =============================================================================
// ECONOMY
// =============================================================================
export const ECONOMY = {
  property_tax_rate: 0.001, // 0.1% of value per day
  heat_decay_per_hour: 2,
  jail_threshold: 100, // heat >= 100 triggers arrest
  newbie_protection_days: 7,
  newbie_protection_level: 5 // or until level 5
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate XP required for a specific level
 * @param {number} level - Target level
 * @returns {number} XP required
 */
export function getXPForLevel(level) {
  return PROGRESSION.xp_per_level(level);
}

/**
 * Calculate total XP required to reach a level from level 1
 * @param {number} level - Target level
 * @returns {number} Total XP required
 */
export function getTotalXPForLevel(level) {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += PROGRESSION.xp_per_level(i);
  }
  return total;
}

/**
 * Calculate crime payout within range
 * @param {object} crime - Crime type object
 * @returns {number} Random payout within range
 */
export function calculateCrimePayout(crime) {
  return Math.floor(
    Math.random() * (crime.payout_max - crime.payout_min + 1) + crime.payout_min
  );
}

/**
 * Calculate heat gained from crime
 * @param {object} crime - Crime type object
 * @returns {number} Random heat within range
 */
export function calculateCrimeHeat(crime) {
  return Math.floor(
    Math.random() * (crime.heat_max - crime.heat_min + 1) + crime.heat_min
  );
}

/**
 * Check if crime succeeds based on success rate
 * @param {object} crime - Crime type object
 * @param {number} bonusModifier - Optional success rate modifier (0-1)
 * @returns {boolean} Whether crime succeeded
 */
export function rollCrimeSuccess(crime, bonusModifier = 0) {
  const effectiveRate = Math.min(0.95, crime.success_rate + bonusModifier);
  return Math.random() < effectiveRate;
}

/**
 * Calculate business net income per hour
 * @param {object} business - Business type object
 * @returns {number} Net income per hour
 */
export function getBusinessNetIncome(business) {
  return business.income_per_hour - business.cost_per_hour;
}

/**
 * Get all crimes available at a given level
 * @param {number} level - Player level
 * @returns {object[]} Array of available crime types
 */
export function getAvailableCrimes(level) {
  return Object.values(CRIME_TYPES).filter(
    crime => crime.level_required <= level
  );
}

/**
 * Get all jobs available at a given level
 * @param {number} level - Player level
 * @returns {object[]} Array of available job types
 */
export function getAvailableJobs(level) {
  return Object.values(JOB_TYPES).filter(
    job => job.level_required <= level
  );
}

/**
 * Get all businesses available at a given level and reputation
 * @param {number} level - Player level
 * @param {number} repCrime - Crime reputation
 * @param {number} repBusiness - Business reputation
 * @returns {object[]} Array of available business types
 */
export function getAvailableBusinesses(level, repCrime = 0, repBusiness = 0) {
  return Object.values(BUSINESS_TYPES).filter(
    biz =>
      biz.level_required <= level &&
      biz.rep_crime_required <= repCrime &&
      biz.rep_business_required <= repBusiness
  );
}

/**
 * Check if player is in newbie protection
 * @param {Date} accountCreated - Account creation date
 * @param {number} level - Player level
 * @returns {boolean} Whether player has newbie protection
 */
export function hasNewbieProtection(accountCreated, level) {
  if (level >= ECONOMY.newbie_protection_level) {
    return false;
  }

  const daysSinceCreation =
    (Date.now() - new Date(accountCreated).getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceCreation < ECONOMY.newbie_protection_days;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================
export default {
  STARTER_BUILDS,
  PROGRESSION,
  CRIME_TYPES,
  JOB_TYPES,
  BUSINESS_TYPES,
  ECONOMY,
  getXPForLevel,
  getTotalXPForLevel,
  calculateCrimePayout,
  calculateCrimeHeat,
  rollCrimeSuccess,
  getBusinessNetIncome,
  getAvailableCrimes,
  getAvailableJobs,
  getAvailableBusinesses,
  hasNewbieProtection
};
