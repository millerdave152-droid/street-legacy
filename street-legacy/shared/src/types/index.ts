/**
 * Street Legacy - Shared TypeScript Types
 * Core type definitions for the game
 */

// =============================================================================
// STARTER BUILD TYPES
// =============================================================================

/**
 * Available starter build types
 */
export type StarterBuildType = 'hustler' | 'entrepreneur' | 'community_kid';

/**
 * Starter build configuration
 */
export interface StarterBuild {
  cash: number;
  bank: number;
  rep_crime: number;
  rep_business: number;
  rep_family: number;
}

/**
 * Map of starter build types to their configurations
 */
export type StarterBuildsMap = Record<StarterBuildType, StarterBuild>;

// =============================================================================
// CRIME TYPES
// =============================================================================

/**
 * Available crime type IDs
 */
export type CrimeTypeId =
  | 'pickpocket'
  | 'shoplifting'
  | 'mugging'
  | 'car_theft'
  | 'burglary'
  | 'drug_run'
  | 'armed_robbery'
  | 'bank_heist';

/**
 * Crime type configuration
 */
export interface CrimeType {
  /** Minimum player level required */
  level: number;
  /** Minimum cash payout on success */
  payoutMin: number;
  /** Maximum cash payout on success */
  payoutMax: number;
  /** Base success rate (0-100) */
  successRate: number;
  /** Minimum heat gained */
  heatMin: number;
  /** Maximum heat gained */
  heatMax: number;
  /** Energy cost to attempt */
  energy: number;
  /** Cooldown in seconds */
  cooldown: number;
  /** Whether this crime can target other players */
  allowsPvp?: boolean;
  /** Whether this crime has an interactive minigame */
  hasMinigame?: boolean;
  /** Whether a weapon is required */
  requiresWeapon?: boolean;
}

/**
 * Map of crime type IDs to their configurations
 */
export type CrimeTypesMap = Record<CrimeTypeId, CrimeType>;

// =============================================================================
// JOB TYPES
// =============================================================================

/**
 * Available job type IDs
 */
export type JobTypeId =
  | 'delivery'
  | 'security'
  | 'temp_work'
  | 'bartending'
  | 'accounting';

/**
 * Job type configuration
 */
export interface JobType {
  /** Minimum player level required */
  level: number;
  /** Fixed cash payout */
  payout: number;
  /** Energy cost */
  energy: number;
  /** Cooldown in seconds */
  cooldown: number;
}

/**
 * Map of job type IDs to their configurations
 */
export type JobTypesMap = Record<JobTypeId, JobType>;

// =============================================================================
// BUSINESS TYPES
// =============================================================================

/**
 * Business category
 */
export type BusinessCategory = 'legit' | 'gray' | 'underground';

/**
 * Available business type IDs
 */
export type BusinessTypeId =
  | 'laundromat'
  | 'restaurant'
  | 'bar'
  | 'gym'
  | 'pawn_shop'
  | 'dispensary'
  | 'drug_lab'
  | 'chop_shop'
  | 'gambling_den'
  | 'weapons_cache';

/**
 * Business type configuration
 */
export interface BusinessType {
  /** Business category */
  category: BusinessCategory;
  /** Initial setup cost */
  setupCost: number;
  /** Gross income per hour */
  incomePerHour: number;
  /** Operating cost per hour */
  costPerHour: number;
  /** Maximum number of employees */
  maxEmployees: number;
  /** Minimum player level required */
  level: number;
  /** Heat generated per hour (for gray/underground) */
  heatGeneration?: number;
  /** Minimum business reputation required */
  requiredRepBusiness?: number;
  /** Minimum crime reputation required */
  requiredRepCrime?: number;
}

/**
 * Map of business type IDs to their configurations
 */
export type BusinessTypesMap = Record<BusinessTypeId, BusinessType>;

// =============================================================================
// DISTRICT TYPES
// =============================================================================

/**
 * Available district IDs
 */
export type DistrictId =
  | 'scarborough'
  | 'etobicoke'
  | 'north_york'
  | 'east_york'
  | 'york'
  | 'queen_west'
  | 'kensington'
  | 'chinatown'
  | 'downtown'
  | 'entertainment'
  | 'yorkville'
  | 'financial'
  | 'waterfront'
  | 'distillery'
  | 'liberty'
  | 'parkdale';

/**
 * District difficulty level (1-5)
 */
export type DistrictDifficulty = 1 | 2 | 3 | 4 | 5;

/**
 * District configuration
 */
export interface District {
  /** Display name */
  name: string;
  /** Total property parcels available */
  totalParcels: number;
  /** Difficulty level (1-5) */
  difficulty: DistrictDifficulty;
  /** Base price for properties */
  basePropertyPrice: number;
  /** Economy level (0-100) - affects business income */
  economyLevel: number;
  /** Police presence (0-100) - affects heat gain and crime difficulty */
  policePresence: number;
  /** Crime rate (0-100) - affects crime success and random events */
  crimeRate: number;
  /** Whether new players can start here */
  isStarterDistrict: boolean;
}

/**
 * Map of district IDs to their configurations
 */
export type DistrictsMap = Record<DistrictId, District>;

// =============================================================================
// PROGRESSION TYPES
// =============================================================================

/**
 * Progression configuration
 */
export interface ProgressionConfig {
  /** XP multiplier per level (XP needed = level * this value) */
  XP_PER_LEVEL_MULTIPLIER: number;
  /** Maximum achievable level */
  MAX_LEVEL: number;
  /** Maximum energy capacity */
  MAX_ENERGY: number;
  /** Seconds between energy regeneration ticks */
  ENERGY_REGEN_SECONDS: number;
}

// =============================================================================
// ECONOMY TYPES
// =============================================================================

/**
 * Economy configuration
 */
export interface EconomyConfig {
  /** Daily property tax rate (as decimal, e.g., 0.001 = 0.1%) */
  PROPERTY_TAX_RATE: number;
  /** Heat decay per hour */
  HEAT_DECAY_PER_HOUR: number;
  /** Heat level that triggers arrest */
  JAIL_HEAT_THRESHOLD: number;
  /** Days of newbie protection */
  NEWBIE_PROTECTION_DAYS: number;
  /** Level at which newbie protection ends */
  NEWBIE_PROTECTION_LEVEL: number;
  /** Sell rate when selling property to system (as decimal) */
  PROPERTY_SELL_RATE: number;
  /** Cost to create a crew */
  CREW_CREATION_COST: number;
  /** Minimum level to create a crew */
  CREW_MIN_LEVEL: number;
  /** Maximum crew tax rate (percentage) */
  MAX_CREW_TAX_RATE: number;
}

// =============================================================================
// PLAYER TYPES
// =============================================================================

/**
 * Player reputation categories
 */
export interface PlayerReputation {
  crime: number;
  business: number;
  family: number;
}

/**
 * Player currency holdings
 */
export interface PlayerCurrency {
  cash: number;
  bank: number;
  cleanMoney?: number;
  crypto?: number;
  tokens?: number;
}

/**
 * Player attributes
 */
export interface PlayerAttributes {
  level: number;
  xp: number;
  energy: number;
  energyMax: number;
  heat: number;
  health: number;
  healthMax: number;
}

/**
 * Player status flags
 */
export interface PlayerStatus {
  isOnline: boolean;
  inJail: boolean;
  jailReleaseAt: string | null;
  inHospital: boolean;
  hospitalReleaseAt: string | null;
  hasNewbieProtection: boolean;
}

/**
 * Player location
 */
export interface PlayerLocation {
  districtId: DistrictId;
  positionX?: number;
  positionY?: number;
}

/**
 * Complete player state
 */
export interface Player {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  reputation: PlayerReputation;
  currency: PlayerCurrency;
  attributes: PlayerAttributes;
  status: PlayerStatus;
  location: PlayerLocation;
  crewId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

// =============================================================================
// ACTION RESULT TYPES
// =============================================================================

/**
 * Generic action result
 */
export interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Crime attempt result
 */
export interface CrimeResult {
  success: boolean;
  payout: number;
  heatGained: number;
  xpGained: number;
  caught: boolean;
  jailTime?: number;
  message: string;
}

/**
 * Job completion result
 */
export interface JobResult {
  success: boolean;
  payout: number;
  xpGained: number;
  message: string;
}

/**
 * Business income collection result
 */
export interface BusinessIncomeResult {
  businessId: string;
  grossIncome: number;
  operatingCost: number;
  netIncome: number;
  heatGenerated: number;
}

// =============================================================================
// COOLDOWN TYPES
// =============================================================================

/**
 * Cooldown status for an action
 */
export interface CooldownStatus {
  isOnCooldown: boolean;
  remainingSeconds: number;
  availableAt: string | null;
}

/**
 * Map of action IDs to their cooldown status
 */
export type CooldownMap = Record<string, CooldownStatus>;

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams<T> {
  field: keyof T;
  direction: SortDirection;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
}
