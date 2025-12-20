/**
 * Street Legacy - Game Constants
 * Core game configuration values for the Toronto crime/business simulation
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface StarterBuild {
  cash: number;
  bank: number;
  rep_crime: number;
  rep_business: number;
  rep_family: number;
}

export interface CrimeType {
  level: number;
  payoutMin: number;
  payoutMax: number;
  successRate: number;
  heatMin: number;
  heatMax: number;
  energy: number;
  cooldown: number;
  allowsPvp?: boolean;
  hasMinigame?: boolean;
  requiresWeapon?: boolean;
}

export interface JobType {
  level: number;
  payout: number;
  energy: number;
  cooldown: number;
}

export type BusinessCategory = 'legit' | 'gray' | 'underground';

export interface BusinessType {
  category: BusinessCategory;
  setupCost: number;
  incomePerHour: number;
  costPerHour: number;
  maxEmployees: number;
  level: number;
  heatGeneration?: number;
  requiredRepBusiness?: number;
  requiredRepCrime?: number;
}

// =============================================================================
// STARTER BUILDS
// =============================================================================

export const STARTER_BUILDS: Record<string, StarterBuild> = {
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
} as const;

// =============================================================================
// PROGRESSION
// =============================================================================

export const PROGRESSION = {
  XP_PER_LEVEL_MULTIPLIER: 100,
  MAX_LEVEL: 50,
  MAX_ENERGY: 100,
  ENERGY_REGEN_SECONDS: 30
} as const;

/**
 * Calculate XP required for a specific level
 */
export function getXPForLevel(level: number): number {
  return level * PROGRESSION.XP_PER_LEVEL_MULTIPLIER;
}

/**
 * Calculate total XP required to reach a level from level 1
 */
export function getTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += getXPForLevel(i);
  }
  return total;
}

// =============================================================================
// CRIME TYPES
// =============================================================================

export const CRIME_TYPES: Record<string, CrimeType> = {
  pickpocket: {
    level: 1,
    payoutMin: 20,
    payoutMax: 80,
    successRate: 70,
    heatMin: 2,
    heatMax: 5,
    energy: 5,
    cooldown: 30
  },
  shoplifting: {
    level: 1,
    payoutMin: 30,
    payoutMax: 100,
    successRate: 65,
    heatMin: 3,
    heatMax: 8,
    energy: 8,
    cooldown: 60
  },
  mugging: {
    level: 2,
    payoutMin: 50,
    payoutMax: 200,
    successRate: 55,
    heatMin: 8,
    heatMax: 15,
    energy: 12,
    cooldown: 120,
    allowsPvp: true
  },
  car_theft: {
    level: 3,
    payoutMin: 200,
    payoutMax: 800,
    successRate: 45,
    heatMin: 15,
    heatMax: 25,
    energy: 15,
    cooldown: 300,
    hasMinigame: true
  },
  burglary: {
    level: 4,
    payoutMin: 300,
    payoutMax: 1200,
    successRate: 40,
    heatMin: 20,
    heatMax: 35,
    energy: 20,
    cooldown: 600,
    hasMinigame: true
  },
  drug_run: {
    level: 2,
    payoutMin: 100,
    payoutMax: 400,
    successRate: 50,
    heatMin: 10,
    heatMax: 20,
    energy: 10,
    cooldown: 180
  },
  armed_robbery: {
    level: 5,
    payoutMin: 500,
    payoutMax: 2000,
    successRate: 35,
    heatMin: 30,
    heatMax: 50,
    energy: 25,
    cooldown: 900,
    requiresWeapon: true
  },
  bank_heist: {
    level: 8,
    payoutMin: 5000,
    payoutMax: 20000,
    successRate: 20,
    heatMin: 50,
    heatMax: 80,
    energy: 50,
    cooldown: 3600,
    hasMinigame: true
  }
} as const;

// =============================================================================
// JOB TYPES
// =============================================================================

export const JOB_TYPES: Record<string, JobType> = {
  delivery: {
    level: 1,
    payout: 50,
    energy: 10,
    cooldown: 60
  },
  security: {
    level: 2,
    payout: 100,
    energy: 15,
    cooldown: 120
  },
  temp_work: {
    level: 1,
    payout: 75,
    energy: 20,
    cooldown: 90
  },
  bartending: {
    level: 3,
    payout: 150,
    energy: 12,
    cooldown: 150
  },
  accounting: {
    level: 5,
    payout: 300,
    energy: 8,
    cooldown: 300
  }
} as const;

// =============================================================================
// BUSINESS TYPES
// =============================================================================

export const BUSINESS_TYPES: Record<string, BusinessType> = {
  // Legit Businesses
  laundromat: {
    category: 'legit',
    setupCost: 5000,
    incomePerHour: 50,
    costPerHour: 10,
    maxEmployees: 2,
    level: 1
  },
  restaurant: {
    category: 'legit',
    setupCost: 15000,
    incomePerHour: 150,
    costPerHour: 40,
    maxEmployees: 5,
    level: 2
  },
  bar: {
    category: 'legit',
    setupCost: 25000,
    incomePerHour: 250,
    costPerHour: 60,
    maxEmployees: 4,
    level: 3
  },
  gym: {
    category: 'legit',
    setupCost: 30000,
    incomePerHour: 200,
    costPerHour: 50,
    maxEmployees: 3,
    level: 3
  },

  // Gray Market Businesses
  pawn_shop: {
    category: 'gray',
    setupCost: 10000,
    incomePerHour: 120,
    costPerHour: 25,
    maxEmployees: 2,
    level: 1,
    heatGeneration: 5
  },
  dispensary: {
    category: 'gray',
    setupCost: 20000,
    incomePerHour: 300,
    costPerHour: 70,
    maxEmployees: 3,
    level: 3,
    heatGeneration: 10,
    requiredRepBusiness: 100
  },

  // Underground Businesses
  drug_lab: {
    category: 'underground',
    setupCost: 50000,
    incomePerHour: 500,
    costPerHour: 100,
    maxEmployees: 4,
    level: 5,
    heatGeneration: 30,
    requiredRepCrime: 200
  },
  chop_shop: {
    category: 'underground',
    setupCost: 40000,
    incomePerHour: 400,
    costPerHour: 80,
    maxEmployees: 5,
    level: 4,
    heatGeneration: 25,
    requiredRepCrime: 150
  },
  gambling_den: {
    category: 'underground',
    setupCost: 35000,
    incomePerHour: 350,
    costPerHour: 90,
    maxEmployees: 4,
    level: 4,
    heatGeneration: 20
  },
  weapons_cache: {
    category: 'underground',
    setupCost: 60000,
    incomePerHour: 600,
    costPerHour: 120,
    maxEmployees: 3,
    level: 6,
    heatGeneration: 40,
    requiredRepCrime: 300
  }
} as const;

// =============================================================================
// ECONOMY SETTINGS
// =============================================================================

export const ECONOMY = {
  PROPERTY_TAX_RATE: 0.001,
  HEAT_DECAY_PER_HOUR: 2,
  JAIL_HEAT_THRESHOLD: 100,
  NEWBIE_PROTECTION_DAYS: 7,
  NEWBIE_PROTECTION_LEVEL: 5,
  PROPERTY_SELL_RATE: 0.7,
  CREW_CREATION_COST: 5000,
  CREW_MIN_LEVEL: 3,
  MAX_CREW_TAX_RATE: 50
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate crime payout within range
 */
export function calculateCrimePayout(crime: CrimeType): number {
  return Math.floor(
    Math.random() * (crime.payoutMax - crime.payoutMin + 1) + crime.payoutMin
  );
}

/**
 * Calculate heat gained from crime
 */
export function calculateCrimeHeat(crime: CrimeType): number {
  return Math.floor(
    Math.random() * (crime.heatMax - crime.heatMin + 1) + crime.heatMin
  );
}

/**
 * Check if crime succeeds based on success rate
 */
export function rollCrimeSuccess(crime: CrimeType, bonusModifier: number = 0): boolean {
  const effectiveRate = Math.min(95, crime.successRate + bonusModifier);
  return Math.random() * 100 < effectiveRate;
}

/**
 * Calculate business net income per hour
 */
export function getBusinessNetIncome(business: BusinessType): number {
  return business.incomePerHour - business.costPerHour;
}

/**
 * Get all crimes available at a given level
 */
export function getAvailableCrimes(level: number): CrimeType[] {
  return Object.values(CRIME_TYPES).filter(crime => crime.level <= level);
}

/**
 * Get all jobs available at a given level
 */
export function getAvailableJobs(level: number): JobType[] {
  return Object.values(JOB_TYPES).filter(job => job.level <= level);
}

/**
 * Get all businesses available at a given level and reputation
 */
export function getAvailableBusinesses(
  level: number,
  repCrime: number = 0,
  repBusiness: number = 0
): BusinessType[] {
  return Object.values(BUSINESS_TYPES).filter(
    biz =>
      biz.level <= level &&
      (biz.requiredRepCrime ?? 0) <= repCrime &&
      (biz.requiredRepBusiness ?? 0) <= repBusiness
  );
}

/**
 * Check if player is in newbie protection
 */
export function hasNewbieProtection(accountCreated: Date, level: number): boolean {
  if (level >= ECONOMY.NEWBIE_PROTECTION_LEVEL) {
    return false;
  }

  const daysSinceCreation =
    (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceCreation < ECONOMY.NEWBIE_PROTECTION_DAYS;
}

/**
 * Get businesses by category
 */
export function getBusinessesByCategory(category: BusinessCategory): BusinessType[] {
  return Object.values(BUSINESS_TYPES).filter(biz => biz.category === category);
}

/**
 * Get crime by ID
 */
export function getCrimeById(id: string): CrimeType | undefined {
  return CRIME_TYPES[id];
}

/**
 * Get job by ID
 */
export function getJobById(id: string): JobType | undefined {
  return JOB_TYPES[id];
}

/**
 * Get business by ID
 */
export function getBusinessById(id: string): BusinessType | undefined {
  return BUSINESS_TYPES[id];
}
