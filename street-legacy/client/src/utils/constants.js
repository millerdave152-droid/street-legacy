// Street Legacy - Game Constants
// Centralized configuration values

// =============================================================================
// GAME BALANCE
// =============================================================================

export const GAME_CONFIG = {
  // Starting values for new players
  STARTING_CASH: 500,
  STARTING_BANK: 0,
  STARTING_ENERGY: 100,
  STARTING_HEALTH: 100,
  STARTING_LEVEL: 1,

  // Maximum values
  MAX_ENERGY: 100,
  MAX_HEALTH: 100,
  MAX_HEAT: 100,
  MAX_LEVEL: 100,

  // Regeneration rates
  ENERGY_REGEN_RATE: 1,         // Energy per minute
  ENERGY_REGEN_INTERVAL: 60000, // Milliseconds
  HEALTH_REGEN_RATE: 0.5,       // Health per minute
  HEAT_DECAY_RATE: 1,           // Heat decay per hour

  // Banking
  BANK_DEPOSIT_FEE: 0.05,       // 5% fee
  BANK_WITHDRAWAL_FEE: 0,       // Free withdrawals

  // XP curve: XP needed = BASE_XP * (LEVEL_MULTIPLIER ^ (level - 1))
  BASE_XP: 100,
  LEVEL_MULTIPLIER: 1.5
}

// =============================================================================
// COOLDOWNS (in milliseconds)
// =============================================================================

export const COOLDOWNS = {
  CRIME: 30000,           // 30 seconds
  JOB: 60000,             // 1 minute
  TRAVEL: 10000,          // 10 seconds
  ATTACK: 300000,         // 5 minutes
  BUSINESS_COLLECT: 3600000, // 1 hour
}

// =============================================================================
// DISTRICTS
// =============================================================================

export const DISTRICTS = {
  SCARBOROUGH: { id: 1, name: 'Scarborough', minLevel: 1 },
  ETOBICOKE: { id: 2, name: 'Etobicoke', minLevel: 1 },
  NORTH_YORK: { id: 3, name: 'North York', minLevel: 3 },
  DOWNTOWN: { id: 4, name: 'Downtown', minLevel: 5 },
  YORKVILLE: { id: 5, name: 'Yorkville', minLevel: 10 },
  REXDALE: { id: 6, name: 'Rexdale', minLevel: 8 },
  JANE_FINCH: { id: 7, name: 'Jane & Finch', minLevel: 7 },
  REGENT_PARK: { id: 8, name: 'Regent Park', minLevel: 6 },
  BEACHES: { id: 9, name: 'The Beaches', minLevel: 12 },
  LIBERTY: { id: 10, name: 'Liberty Village', minLevel: 15 },
  HARBOURFRONT: { id: 11, name: 'Harbourfront', minLevel: 20 },
  BAY_STREET: { id: 12, name: 'Bay Street', minLevel: 25 }
}

// =============================================================================
// CRIME CATEGORIES
// =============================================================================

export const CRIME_CATEGORIES = {
  PETTY: 'petty',
  THEFT: 'theft',
  FRAUD: 'fraud',
  DRUGS: 'drugs',
  VIOLENCE: 'violence',
  ORGANIZED: 'organized',
  WHITE_COLLAR: 'white_collar'
}

// =============================================================================
// JOB CATEGORIES
// =============================================================================

export const JOB_CATEGORIES = {
  LABOR: 'labor',
  SERVICE: 'service',
  RETAIL: 'retail',
  OFFICE: 'office',
  SKILLED: 'skilled',
  PROFESSIONAL: 'professional'
}

// =============================================================================
// PROPERTY TYPES
// =============================================================================

export const PROPERTY_TYPES = {
  APARTMENT: 'apartment',
  HOUSE: 'house',
  CONDO: 'condo',
  COMMERCIAL: 'commercial',
  WAREHOUSE: 'warehouse',
  PENTHOUSE: 'penthouse'
}

// =============================================================================
// BUSINESS TYPES
// =============================================================================

export const BUSINESS_TYPES = {
  CORNER_STORE: 'corner_store',
  RESTAURANT: 'restaurant',
  BAR: 'bar',
  NIGHTCLUB: 'nightclub',
  CAR_WASH: 'car_wash',
  LAUNDROMAT: 'laundromat',
  GYM: 'gym',
  CASINO: 'casino'
}

// =============================================================================
// CREW RANKS
// =============================================================================

export const CREW_RANKS = {
  BOSS: { id: 1, name: 'Boss', permissions: ['all'] },
  UNDERBOSS: { id: 2, name: 'Underboss', permissions: ['invite', 'kick', 'promote', 'bank'] },
  CAPTAIN: { id: 3, name: 'Captain', permissions: ['invite', 'bank'] },
  SOLDIER: { id: 4, name: 'Soldier', permissions: ['invite'] },
  ASSOCIATE: { id: 5, name: 'Associate', permissions: [] }
}

// =============================================================================
// UI COLORS
// =============================================================================

export const COLORS = {
  // Primary colors
  PRIMARY: '#4a4a6a',
  PRIMARY_HOVER: '#6a6a8a',
  BACKGROUND: '#1a1a2e',
  SURFACE: '#2a2a4a',

  // Status colors
  SUCCESS: '#22c55e',
  DANGER: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',

  // Currency colors
  CASH: '#22c55e',
  BANK: '#3b82f6',
  CRYPTO: '#f59e0b',

  // Heat colors
  HEAT_LOW: '#22c55e',
  HEAT_MEDIUM: '#eab308',
  HEAT_HIGH: '#f97316',
  HEAT_CRITICAL: '#ef4444'
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  DANGER: 'danger',
  WARNING: 'warning',
  INFO: 'info',
  MESSAGE: 'message'
}

// =============================================================================
// API ENDPOINTS (for reference)
// =============================================================================

export const ENDPOINTS = {
  AUTH: 'auth-handler',
  PLAYER: 'player-actions',
  CREW: 'crew-actions',
  SOCIAL: 'social-actions',
  ADMIN: 'admin-actions',
  MAINTENANCE: 'scheduled-maintenance'
}

export default {
  GAME_CONFIG,
  COOLDOWNS,
  DISTRICTS,
  CRIME_CATEGORIES,
  JOB_CATEGORIES,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  CREW_RANKS,
  COLORS,
  NOTIFICATION_TYPES,
  ENDPOINTS
}
