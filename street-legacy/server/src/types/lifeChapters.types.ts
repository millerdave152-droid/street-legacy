/**
 * Life Chapters System Types
 * Character aging with distinct life phases affecting gameplay
 */

// =============================================================================
// ENUMS / UNION TYPES
// =============================================================================

/**
 * Life chapter phases representing different stages of a criminal career
 * - come_up: Young hustler building reputation (18-25)
 * - player: Established operator expanding operations (26-35)
 * - boss: Crime boss running an empire (36-50)
 * - legacy: OG status, focusing on succession (51+)
 */
export type LifeChapter = 'come_up' | 'player' | 'boss' | 'legacy';

/**
 * What triggered a chapter transition
 */
export type TransitionTrigger = 'age' | 'achievement' | 'manual' | 'death' | 'system';

/**
 * Game features that can be unlocked/locked by chapters
 */
export type GameFeature =
  | 'street_crimes'
  | 'basic_jobs'
  | 'crew_member'
  | 'petty_theft'
  | 'drug_running'
  | 'street_racing'
  | 'own_business'
  | 'crew_lieutenant'
  | 'crew_leader'
  | 'crew_founder'
  | 'property_ownership'
  | 'advanced_crimes'
  | 'heists'
  | 'heist_participation'
  | 'protection_rackets'
  | 'smuggling'
  | 'delegation'
  | 'political_influence'
  | 'money_laundering'
  | 'territory_control'
  | 'crew_wars'
  | 'legitimate_fronts'
  | 'direct_combat'
  | 'direct_drug_dealing'
  | 'succession_planning'
  | 'mentorship'
  | 'legacy_projects'
  | 'wisdom_bonuses'
  | 'retirement_options'
  | 'dynasty_founding';

// =============================================================================
// MODIFIER INTERFACES
// =============================================================================

/**
 * Gameplay modifiers applied based on current life chapter
 * Values are multipliers (0.2 = 20% bonus/penalty)
 */
export interface ChapterModifiers {
  /** Bonus XP gained from crimes */
  crimeXpBonus?: number;

  /** Penalty to income (early career) */
  incomePenalty?: number;

  /** Bonus to all income */
  incomeBonus?: number;

  /** Faster heat decay */
  heatDecayBonus?: number;

  /** Bonus to reputation gains */
  reputationGainBonus?: number;

  /** Penalty to reputation gains (early career) */
  reputationGainPenalty?: number;

  /** Bonus when working with crew */
  crewBonus?: number;

  /** Penalty when doing crimes personally (boss phase) */
  personalCrimePenalty?: number;

  /** Energy regeneration bonus */
  energyRegenBonus?: number;

  /** Energy maximum penalty */
  energyPenalty?: number;

  /** Business profit bonus */
  businessProfitBonus?: number;

  /** Crew loyalty bonus */
  crewLoyaltyBonus?: number;

  /** Heat gained from crimes (boss gets more attention) */
  heatFromCrimesBonus?: number;

  /** Efficiency when delegating tasks */
  delegationEfficiency?: number;

  /** Bonus when mentoring other players */
  mentorshipBonus?: number;

  /** Bonus for crew inheritance mechanics */
  crewInheritanceBonus?: number;

  /** Bonus to passive income sources */
  passiveIncomeBonus?: number;

  /** Allow additional custom modifiers */
  [key: string]: number | undefined;
}

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * Configuration for a life chapter
 */
export interface LifeChapterConfig {
  /** Chapter identifier */
  id: LifeChapter;

  /** Human-readable name */
  displayName: string;

  /** Minimum age for this chapter */
  ageRangeStart: number;

  /** Maximum age for this chapter (null for legacy) */
  ageRangeEnd: number | null;

  /** Maximum energy in this chapter */
  energyMax: number;

  /** Flavor description of this life phase */
  description: string;

  /** Features that become available in this chapter */
  unlockedFeatures: string[];

  /** Features that are locked/unavailable in this chapter */
  lockedFeatures: string[];

  /** Gameplay modifiers active during this chapter */
  modifiers: ChapterModifiers;

  /** When config was created */
  createdAt: Date;
}

/**
 * Record of a chapter transition event
 */
export interface ChapterTransition {
  /** Unique identifier */
  id: string;

  /** Player who transitioned */
  playerId: number;

  /** Previous chapter (null for initial) */
  fromChapter: LifeChapter | null;

  /** New chapter */
  toChapter: LifeChapter;

  /** What caused the transition */
  triggeredBy: TransitionTrigger;

  /** Player's age at time of transition */
  playerAgeAtTransition: number;

  /** Player stats before transition */
  previousStats?: Record<string, unknown>;

  /** Player stats after transition */
  newStats?: Record<string, unknown>;

  /** Additional transition metadata */
  metadata: Record<string, unknown>;

  /** When the transition occurred */
  transitionedAt: Date;
}

/**
 * Complete life state for a player
 */
export interface PlayerLifeState {
  /** Player identifier */
  playerId: number;

  /** Player username */
  username?: string;

  /** Character birth date */
  birthDate: Date;

  /** Current age in game years */
  currentAge: number;

  /** Current life chapter */
  currentChapter: LifeChapter;

  /** When player entered current chapter */
  chapterStartedAt: Date;

  /** Days spent in current chapter */
  daysInChapter: number;

  /** Game years until next chapter transition (null if in legacy) */
  yearsUntilNextChapter: number | null;

  /** Full config for current chapter */
  chapterConfig: LifeChapterConfig;

  /** Total game days played */
  totalDaysPlayed: number;

  /** Current energy maximum */
  energyMax: number;
}

/**
 * Game time configuration
 */
export interface GameTimeConfig {
  /** Config identifier */
  id: string;

  /** How many real days equal one game year */
  realDaysPerGameYear: number;

  /** Current game date/time */
  currentGameDate: Date;

  /** Game days per real day */
  timeMultiplier: number;

  /** When config was created */
  createdAt: Date;

  /** When config was last updated */
  updatedAt: Date;
}

// =============================================================================
// DATABASE ROW TYPES (snake_case)
// =============================================================================

/**
 * Database row for life_chapters_config table
 */
export interface LifeChapterConfigRow {
  id: LifeChapter;
  display_name: string;
  age_range_start: number;
  age_range_end: number | null;
  energy_max: number;
  description: string;
  unlocked_features: string[];
  locked_features: string[];
  modifiers: ChapterModifiers;
  created_at: string;
}

/**
 * Database row for chapter_transitions table
 */
export interface ChapterTransitionRow {
  id: string;
  player_id: number;
  from_chapter: LifeChapter | null;
  to_chapter: LifeChapter;
  triggered_by: TransitionTrigger;
  player_age_at_transition: number;
  previous_stats: Record<string, unknown>;
  new_stats: Record<string, unknown>;
  metadata: Record<string, unknown>;
  transitioned_at: string;
}

/**
 * Database row for game_time_config table
 */
export interface GameTimeConfigRow {
  id: string;
  real_days_per_game_year: number;
  current_game_date: string;
  time_multiplier: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database row for player life state (from view or join)
 */
export interface PlayerLifeStateRow {
  player_id: number;
  username?: string;
  birth_date: string;
  game_age: number;
  current_chapter: LifeChapter;
  chapter_started_at: string;
  days_in_chapter?: number;
  years_until_next_chapter: number | null;
  total_days_played: number;
  energy_max?: number;
  chapter_name?: string;
  chapter_description?: string;
  unlocked_features?: string[];
  locked_features?: string[];
  modifiers?: ChapterModifiers;
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Request to manually transition chapter
 */
export interface TransitionChapterRequest {
  /** Target chapter (if specified, for admin/special events) */
  newChapter?: LifeChapter;

  /** Reason for manual transition */
  reason?: string;
}

/**
 * Request to check feature availability
 */
export interface CheckFeatureRequest {
  /** Feature to check */
  feature: string;
}

/**
 * Request to apply a modifier
 */
export interface ApplyModifierRequest {
  /** Modifier name */
  modifierName: string;

  /** Base value to modify */
  baseValue: number;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Response for getting player life state
 */
export interface GetPlayerLifeStateResponse {
  success: boolean;
  data: PlayerLifeState;
}

/**
 * Response for getting all chapter configs
 */
export interface GetChapterConfigsResponse {
  success: boolean;
  data: {
    chapters: LifeChapterConfig[];
    currentChapter?: LifeChapter;
  };
}

/**
 * Response for checking chapter transition
 */
export interface CheckTransitionResponse {
  success: boolean;
  data: {
    transitioned: boolean;
    fromChapter: LifeChapter | null;
    toChapter: LifeChapter;
    newAge: number;
    transitionId?: string;
  };
}

/**
 * Response for getting chapter history
 */
export interface GetChapterHistoryResponse {
  success: boolean;
  data: {
    transitions: ChapterTransition[];
    total: number;
  };
}

/**
 * Response for checking feature availability
 */
export interface CheckFeatureResponse {
  success: boolean;
  data: {
    feature: string;
    unlocked: boolean;
    requiredChapter?: LifeChapter;
    currentChapter: LifeChapter;
  };
}

/**
 * Response for applying modifier
 */
export interface ApplyModifierResponse {
  success: boolean;
  data: {
    modifierName: string;
    baseValue: number;
    modifiedValue: number;
    modifierAmount: number;
  };
}

/**
 * Response for getting game time config
 */
export interface GetGameTimeConfigResponse {
  success: boolean;
  data: GameTimeConfig;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Age thresholds for each chapter
 */
export const CHAPTER_AGE_THRESHOLDS: Record<LifeChapter, { start: number; end: number | null }> = {
  come_up: { start: 18, end: 25 },
  player: { start: 26, end: 35 },
  boss: { start: 36, end: 50 },
  legacy: { start: 51, end: null }
};

/**
 * Which chapters allow each feature
 */
export const FEATURE_REQUIREMENTS: Record<string, LifeChapter[]> = {
  // Available in early chapters
  street_crimes: ['come_up', 'player'],
  basic_jobs: ['come_up', 'player', 'boss'],
  crew_member: ['come_up', 'player', 'boss', 'legacy'],
  petty_theft: ['come_up', 'player'],
  drug_running: ['come_up', 'player'],
  street_racing: ['come_up', 'player'],

  // Available in middle chapters
  own_business: ['player', 'boss', 'legacy'],
  crew_lieutenant: ['player', 'boss'],
  property_ownership: ['player', 'boss', 'legacy'],
  advanced_crimes: ['player', 'boss'],
  heists: ['player', 'boss'],
  protection_rackets: ['player', 'boss'],
  smuggling: ['player', 'boss'],

  // Available in late chapters
  delegation: ['boss', 'legacy'],
  crew_founder: ['boss', 'legacy'],
  crew_leader: ['boss', 'legacy'],
  political_influence: ['boss', 'legacy'],
  money_laundering: ['boss', 'legacy'],
  territory_control: ['boss', 'legacy'],
  crew_wars: ['boss', 'legacy'],
  legitimate_fronts: ['boss', 'legacy'],

  // Legacy only
  succession_planning: ['legacy'],
  mentorship: ['legacy'],
  legacy_projects: ['legacy'],
  wisdom_bonuses: ['legacy'],
  retirement_options: ['legacy'],
  dynasty_founding: ['legacy'],

  // Combat available until legacy
  direct_combat: ['come_up', 'player', 'boss'],
  heist_participation: ['come_up', 'player', 'boss']
};

/**
 * Chapter display names
 */
export const CHAPTER_DISPLAY_NAMES: Record<LifeChapter, string> = {
  come_up: 'The Come Up',
  player: 'Player',
  boss: 'Boss',
  legacy: 'Legacy'
};

/**
 * Chapter icons for UI
 */
export const CHAPTER_ICONS: Record<LifeChapter, string> = {
  come_up: '🌱',
  player: '💰',
  boss: '👑',
  legacy: '🏛️'
};

/**
 * Chapter colors for UI
 */
export const CHAPTER_COLORS: Record<LifeChapter, string> = {
  come_up: '#22c55e', // Green
  player: '#eab308', // Yellow
  boss: '#ef4444',   // Red
  legacy: '#8b5cf6'  // Purple
};

/**
 * Default energy max per chapter
 */
export const CHAPTER_ENERGY_MAX: Record<LifeChapter, number> = {
  come_up: 120,
  player: 100,
  boss: 80,
  legacy: 60
};

/**
 * Default game time settings
 */
export const DEFAULT_GAME_TIME_CONFIG = {
  realDaysPerGameYear: 30,
  timeMultiplier: 12.17
};

/**
 * Starting age for new characters
 */
export const STARTING_AGE = 18;

/**
 * Life chapters in order
 */
export const CHAPTER_ORDER: LifeChapter[] = ['come_up', 'player', 'boss', 'legacy'];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to LifeChapterConfig
 */
export function rowToChapterConfig(row: LifeChapterConfigRow): LifeChapterConfig {
  return {
    id: row.id,
    displayName: row.display_name,
    ageRangeStart: row.age_range_start,
    ageRangeEnd: row.age_range_end,
    energyMax: row.energy_max,
    description: row.description,
    unlockedFeatures: row.unlocked_features || [],
    lockedFeatures: row.locked_features || [],
    modifiers: row.modifiers || {},
    createdAt: new Date(row.created_at)
  };
}

/**
 * Convert database row to ChapterTransition
 */
export function rowToChapterTransition(row: ChapterTransitionRow): ChapterTransition {
  return {
    id: row.id,
    playerId: row.player_id,
    fromChapter: row.from_chapter,
    toChapter: row.to_chapter,
    triggeredBy: row.triggered_by,
    playerAgeAtTransition: row.player_age_at_transition,
    previousStats: row.previous_stats,
    newStats: row.new_stats,
    metadata: row.metadata || {},
    transitionedAt: new Date(row.transitioned_at)
  };
}

/**
 * Convert database row to GameTimeConfig
 */
export function rowToGameTimeConfig(row: GameTimeConfigRow): GameTimeConfig {
  return {
    id: row.id,
    realDaysPerGameYear: row.real_days_per_game_year,
    currentGameDate: new Date(row.current_game_date),
    timeMultiplier: parseFloat(row.time_multiplier),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/**
 * Get chapter for a given age
 */
export function getChapterForAge(age: number): LifeChapter {
  for (const chapter of CHAPTER_ORDER) {
    const threshold = CHAPTER_AGE_THRESHOLDS[chapter];
    if (age >= threshold.start && (threshold.end === null || age <= threshold.end)) {
      return chapter;
    }
  }
  return 'legacy';
}

/**
 * Get next chapter in progression
 */
export function getNextChapter(currentChapter: LifeChapter): LifeChapter | null {
  const index = CHAPTER_ORDER.indexOf(currentChapter);
  if (index === -1 || index >= CHAPTER_ORDER.length - 1) {
    return null;
  }
  return CHAPTER_ORDER[index + 1];
}

/**
 * Check if a feature is available for a chapter
 */
export function isFeatureAvailableForChapter(feature: string, chapter: LifeChapter): boolean {
  const allowedChapters = FEATURE_REQUIREMENTS[feature];
  if (!allowedChapters) {
    return true; // Unknown features default to available
  }
  return allowedChapters.includes(chapter);
}

/**
 * Calculate game age from birth date
 */
export function calculateGameAge(
  birthDate: Date,
  realDaysPerGameYear: number = DEFAULT_GAME_TIME_CONFIG.realDaysPerGameYear
): number {
  const realDaysPassed = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
  return STARTING_AGE + Math.floor(realDaysPassed / realDaysPerGameYear);
}

/**
 * Calculate years until next chapter
 */
export function calculateYearsUntilNextChapter(
  currentAge: number,
  currentChapter: LifeChapter
): number | null {
  const threshold = CHAPTER_AGE_THRESHOLDS[currentChapter];
  if (threshold.end === null) {
    return null; // In legacy, no next chapter
  }
  return Math.max(0, threshold.end - currentAge + 1);
}

/**
 * Apply a modifier to a base value
 */
export function applyModifier(
  baseValue: number,
  modifierName: string,
  modifiers: ChapterModifiers
): number {
  const modifier = modifiers[modifierName];
  if (modifier === undefined) {
    return baseValue;
  }

  // Bonuses add, penalties subtract
  if (modifierName.includes('Bonus') || modifierName.includes('bonus')) {
    return baseValue * (1 + modifier);
  } else if (modifierName.includes('Penalty') || modifierName.includes('penalty')) {
    return baseValue * (1 - modifier);
  }

  return baseValue * (1 + modifier);
}
