/**
 * Generational Continuity System Types
 * Character endings and heir inheritance for dynasty gameplay
 */

import { LifeChapter } from './lifeChapters.types.js';

// =============================================================================
// ENUMS / UNION TYPES
// =============================================================================

/**
 * How a character's story ends
 * - death: Killed in action
 * - prison_life: Life sentence, character removed from play
 * - retirement: Voluntary exit from the game
 * - disappearance: Vanished mysteriously
 * - exile: Forced out of the city
 */
export type EndingType =
  | 'death'
  | 'prison_life'
  | 'retirement'
  | 'disappearance'
  | 'exile';

/**
 * Who inherits the legacy
 * - player_heir: Another player character receives inheritance
 * - npc_family: NPC family member (creates new character option)
 * - npc_lieutenant: Trusted NPC lieutenant takes over
 * - crew_successor: Crew votes on successor
 */
export type HeirType =
  | 'player_heir'
  | 'npc_family'
  | 'npc_lieutenant'
  | 'crew_successor';

/**
 * Status of a dynasty member
 */
export type DynastyMemberStatus = 'active' | 'ended';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * Pre-arranged inheritance settings for a player
 */
export interface SuccessionPlan {
  /** Unique identifier */
  id: string;

  /** Player who created this plan */
  playerId: string;

  /** Player's username */
  playerName?: string;

  /** Type of heir designated */
  heirType: HeirType;

  /** Player ID of heir (if player_heir) */
  heirPlayerId?: string;

  /** Heir player's username */
  heirPlayerName?: string;

  /** NPC heir name (if npc_family or npc_lieutenant) */
  heirNpcName?: string;

  /** Percentage of properties to transfer (0-100) */
  propertyTransferPercent: number;

  /** Percentage of cash to transfer (0-100) */
  cashTransferPercent: number;

  /** Percentage of reputation bonus for heir (0-100) */
  reputationTransferPercent: number;

  /** Whether crew leadership transfers */
  crewPositionTransfer: boolean;

  /** Additional notes about succession */
  notes?: string;

  /** When plan was created */
  createdAt: Date;

  /** When plan was last updated */
  updatedAt: Date;
}

/**
 * Record of how a character's story ended
 */
export interface CharacterEnding {
  /** Unique identifier */
  id: string;

  /** Player whose character ended */
  playerId: string;

  /** Player's username */
  playerName?: string;

  /** How the character's story ended */
  endingType: EndingType;

  /** Narrative description of the ending */
  endingDescription?: string;

  /** Snapshot of all stats at time of ending */
  finalStats: Record<string, unknown>;

  /** Total net worth at ending */
  finalNetWorth: number;

  /** Number of properties owned at ending */
  propertiesOwned: number;

  /** Reputation score at ending */
  reputationScore: number;

  /** Life chapter at time of ending */
  lifeChapter?: LifeChapter;

  /** Character's age at ending */
  ageAtEnding?: number;

  /** Player who caused the death (if applicable) */
  causedByPlayerId?: string;

  /** Killer's username */
  causedByPlayerName?: string;

  /** Whether inheritance was processed */
  successionExecuted: boolean;

  /** Player who inherited (if succession executed) */
  heirPlayerId?: string;

  /** When the character ended */
  endedAt: Date;
}

/**
 * Dynasty connection and inheritance tracking
 */
export interface PlayerLineage {
  /** Unique identifier */
  id: string;

  /** Current player in lineage */
  playerId: string;

  /** Player's username */
  playerName?: string;

  /** Previous player in dynasty chain */
  predecessorPlayerId?: string;

  /** Predecessor's username */
  predecessorName?: string;

  /** Reference to predecessor's ending record */
  predecessorEndingId?: string;

  /** Generation number in dynasty (1 = founder) */
  generation: number;

  /** Property IDs inherited from predecessor */
  inheritedProperties: string[];

  /** Cash amount inherited */
  inheritedCash: number;

  /** Reputation bonus percentage inherited */
  inheritedReputationPercent: number;

  /** Whether crew position was inherited */
  inheritedCrewPosition: boolean;

  /** Name of the dynasty/crime family */
  dynastyName?: string;

  /** When this lineage branch started */
  lineageStartedAt: Date;

  /** When record was created */
  createdAt: Date;
}

/**
 * Achievement earned by a dynasty
 */
export interface DynastyAchievement {
  /** Unique identifier */
  id: string;

  /** Dynasty this achievement belongs to */
  dynastyName: string;

  /** Type of achievement */
  achievementType: string;

  /** Human-readable description */
  description?: string;

  /** Which generation earned this */
  generationAchieved: number;

  /** Player who earned it */
  playerId?: string;

  /** Player's username */
  playerName?: string;

  /** Additional achievement data */
  metadata?: Record<string, unknown>;

  /** When achieved */
  achievedAt: Date;
}

/**
 * Complete dynasty information
 */
export interface Dynasty {
  /** Dynasty name */
  name: string;

  /** Total generations in dynasty history */
  totalGenerations: number;

  /** Current active generation */
  currentGeneration: number;

  /** Total wealth accumulated across all generations */
  totalWealthAccumulated: number;

  /** Total properties currently owned */
  totalPropertiesOwned: number;

  /** Number of members total */
  totalMembers: number;

  /** Number of currently active members */
  activeMembers: number;

  /** Current active player (if any) */
  currentActivePlayerId?: string;

  /** Current active player's name */
  currentActivePlayerName?: string;

  /** Dynasty achievements */
  achievements: DynastyAchievement[];

  /** All dynasty members */
  members: DynastyMember[];

  /** When dynasty was founded */
  foundedAt: Date;

  /** Most recent succession */
  latestSuccession?: Date;
}

/**
 * A member of a dynasty
 */
export interface DynastyMember {
  /** Player ID */
  playerId: string;

  /** Player's username */
  playerName?: string;

  /** Generation number */
  generation: number;

  /** Whether player is active or ended */
  status: DynastyMemberStatus;

  /** How they ended (if ended) */
  endingType?: EndingType;

  /** When they ended (if ended) */
  endedAt?: Date;
}

/**
 * Calculated inheritance from succession
 */
export interface Inheritance {
  /** Property IDs being inherited */
  properties: string[];

  /** Number of properties */
  propertyCount: number;

  /** Cash amount being inherited */
  cash: number;

  /** Reputation bonus for heir */
  reputationBonus: number;

  /** Total estimated value */
  totalValue: number;

  /** Crew position being inherited (if any) */
  crewPosition?: {
    crewId: string;
    crewName?: string;
    rank: string;
  };
}

/**
 * Result of executing succession
 */
export interface SuccessionResult {
  /** The character ending record */
  endingId: string;

  /** Whether succession was executed */
  successionExecuted: boolean;

  /** Heir player ID (if succession executed) */
  heirPlayerId?: string;

  /** Summary of what was inherited */
  inheritanceSummary: {
    propertiesTransferred: number;
    cashTransferred: number;
    reputationBonus: number;
    crewPositionTransferred: boolean;
  };

  /** Result message */
  message: string;
}

/**
 * Lineage chain entry for ancestry display
 */
export interface LineageChainEntry {
  /** Generation number */
  generation: number;

  /** Player ID */
  playerId: string;

  /** Player's username */
  playerName?: string;

  /** How they ended (if ended) */
  endingType?: EndingType;

  /** When they ended */
  endedAt?: Date;

  /** What they inherited */
  inheritedCash: number;

  /** Properties they inherited */
  inheritedProperties: number;
}

// =============================================================================
// DATABASE ROW TYPES (snake_case)
// =============================================================================

/**
 * Database row for succession_plans table
 */
export interface SuccessionPlanRow {
  id: string;
  player_id: number;
  player_name?: string;
  heir_type: HeirType;
  heir_player_id: number | null;
  heir_player_name?: string;
  heir_npc_name: string | null;
  property_transfer_percent: number;
  cash_transfer_percent: number;
  reputation_transfer_percent: number;
  crew_position_transfer: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Database row for character_endings table
 */
export interface CharacterEndingRow {
  id: string;
  player_id: number;
  player_name?: string;
  ending_type: EndingType;
  ending_description: string | null;
  final_stats: Record<string, unknown> | null;
  final_net_worth: number | string;
  properties_owned: number;
  reputation_score: number;
  life_chapter: LifeChapter | null;
  age_at_ending: number | null;
  caused_by_player_id: number | null;
  caused_by_player_name?: string;
  succession_executed: boolean;
  heir_player_id: number | null;
  ended_at: string;
}

/**
 * Database row for player_lineage table
 */
export interface PlayerLineageRow {
  id: string;
  player_id: number;
  player_name?: string;
  predecessor_player_id: number | null;
  predecessor_name?: string;
  predecessor_ending_id: string | null;
  generation: number;
  inherited_properties: number[] | null;
  inherited_cash: number | string;
  inherited_reputation_percent: number;
  inherited_crew_position: boolean;
  dynasty_name: string | null;
  lineage_started_at: string;
  created_at: string;
}

/**
 * Database row for dynasty_achievements table
 */
export interface DynastyAchievementRow {
  id: string;
  dynasty_name: string;
  achievement_type: string;
  description: string | null;
  generation_achieved: number;
  player_id: number | null;
  player_name?: string;
  metadata: Record<string, unknown> | null;
  achieved_at: string;
}

/**
 * Database row for dynasty stats query
 */
export interface DynastyStatsRow {
  dynasty_name: string;
  total_generations: number;
  current_generation: number;
  total_members: number;
  active_members: number;
  total_wealth_accumulated: number | string;
  total_properties_owned: number;
  achievements_count: number;
  founded_at: string;
  latest_succession: string | null;
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Request to create or update a succession plan
 */
export interface CreateSuccessionPlanRequest {
  /** Type of heir */
  heirType: HeirType;

  /** Player ID of heir (required for player_heir) */
  heirPlayerId?: string;

  /** NPC name (required for npc_family/npc_lieutenant) */
  heirNpcName?: string;

  /** Property transfer percentage (default 100) */
  propertyTransferPercent?: number;

  /** Cash transfer percentage (default 50) */
  cashTransferPercent?: number;

  /** Reputation transfer percentage (default 30) */
  reputationTransferPercent?: number;

  /** Whether to transfer crew position (default true) */
  crewPositionTransfer?: boolean;

  /** Additional notes */
  notes?: string;
}

/**
 * Request to end a character
 */
export interface EndCharacterRequest {
  /** How the character ends */
  endingType: EndingType;

  /** Description of the ending */
  description?: string;

  /** Player who caused death (if applicable) */
  causedByPlayerId?: string;

  /** Whether to execute succession automatically */
  executeSuccession?: boolean;
}

/**
 * Request to update succession plan
 */
export interface UpdateSuccessionPlanRequest {
  /** Type of heir */
  heirType?: HeirType;

  /** Player ID of heir */
  heirPlayerId?: string;

  /** NPC name */
  heirNpcName?: string;

  /** Property transfer percentage */
  propertyTransferPercent?: number;

  /** Cash transfer percentage */
  cashTransferPercent?: number;

  /** Reputation transfer percentage */
  reputationTransferPercent?: number;

  /** Whether to transfer crew position */
  crewPositionTransfer?: boolean;

  /** Additional notes */
  notes?: string;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Response for getting succession plan
 */
export interface GetSuccessionPlanResponse {
  success: boolean;
  data: SuccessionPlan | null;
}

/**
 * Response for getting player lineage
 */
export interface GetLineageResponse {
  success: boolean;
  data: {
    /** Player's lineage record */
    lineage: PlayerLineage | null;

    /** Dynasty information */
    dynasty?: Dynasty;

    /** Full lineage chain */
    chain?: LineageChainEntry[];
  };
}

/**
 * Response for executing succession
 */
export interface ExecuteSuccessionResponse {
  success: boolean;
  data: {
    /** The character ending record */
    ending: CharacterEnding;

    /** What was inherited */
    inheritance?: Inheritance;

    /** Heir player ID */
    heirId?: string;

    /** Heir's new lineage */
    heirLineage?: PlayerLineage;

    /** Result message */
    message: string;
  };
}

/**
 * Response for ending a character
 */
export interface EndCharacterResponse {
  success: boolean;
  data: {
    /** The ending record */
    ending: CharacterEnding;

    /** Succession result (if executed) */
    succession?: SuccessionResult;
  };
}

/**
 * Response for getting dynasty info
 */
export interface GetDynastyResponse {
  success: boolean;
  data: Dynasty;
}

/**
 * Response for getting character endings
 */
export interface GetEndingsResponse {
  success: boolean;
  data: {
    endings: CharacterEnding[];
    total: number;
  };
}

/**
 * Response for getting dynasty achievements
 */
export interface GetAchievementsResponse {
  success: boolean;
  data: {
    achievements: DynastyAchievement[];
    total: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default transfer percentages for succession
 */
export const DEFAULT_TRANSFER_PERCENTS = {
  property: 100,
  cash: 50,
  reputation: 30
} as const;

/**
 * Minimum and maximum transfer percentages
 */
export const TRANSFER_PERCENT_LIMITS = {
  min: 0,
  max: 100
} as const;

/**
 * Human-readable labels for ending types
 */
export const ENDING_TYPE_LABELS: Record<EndingType, string> = {
  death: 'Death',
  prison_life: 'Life in Prison',
  retirement: 'Retirement',
  disappearance: 'Disappearance',
  exile: 'Exile'
};

/**
 * Narrative descriptions for ending types
 */
export const ENDING_DESCRIPTIONS: Record<EndingType, string[]> = {
  death: [
    'Died in a shootout',
    'Found dead under mysterious circumstances',
    'Killed in a territorial dispute',
    'Assassinated by rivals',
    'Caught in crossfire',
    'Died protecting their crew',
    'Went out in a blaze of glory'
  ],
  prison_life: [
    'Sentenced to life without parole',
    'Caught by the feds on RICO charges',
    'Turned in by an informant',
    'Finally caught after years on the run',
    'Convicted on multiple counts',
    'The law finally caught up'
  ],
  retirement: [
    'Retired to a quiet life',
    'Left the game for good',
    'Walked away while on top',
    'Decided to go legit',
    'Moved to the suburbs',
    'Started a legitimate business'
  ],
  disappearance: [
    'Vanished without a trace',
    'Went into hiding',
    'Disappeared one night',
    'Left everything behind',
    'No one knows what happened',
    'Simply stopped showing up'
  ],
  exile: [
    'Fled the country',
    'Banished from Toronto',
    'Forced out by rivals',
    'Had to leave or die',
    'Went into permanent exile',
    'Run out of town'
  ]
};

/**
 * Icons for ending types
 */
export const ENDING_TYPE_ICONS: Record<EndingType, string> = {
  death: '💀',
  prison_life: '⛓️',
  retirement: '🏖️',
  disappearance: '👻',
  exile: '✈️'
};

/**
 * Human-readable labels for heir types
 */
export const HEIR_TYPE_LABELS: Record<HeirType, string> = {
  player_heir: 'Player Heir',
  npc_family: 'Family Member (NPC)',
  npc_lieutenant: 'Trusted Lieutenant (NPC)',
  crew_successor: 'Crew Successor'
};

/**
 * Descriptions for heir types
 */
export const HEIR_TYPE_DESCRIPTIONS: Record<HeirType, string> = {
  player_heir: 'Another player character will inherit your legacy',
  npc_family: 'An NPC family member will continue the dynasty',
  npc_lieutenant: 'Your most trusted lieutenant takes over',
  crew_successor: 'The crew will vote on who takes your place'
};

/**
 * Dynasty achievement types
 */
export const DYNASTY_ACHIEVEMENT_TYPES = {
  THIRD_GENERATION: 'third_generation',
  FIFTH_GENERATION: 'fifth_generation',
  TENTH_GENERATION: 'tenth_generation',
  FIRST_MILLION: 'first_million',
  TERRITORY_CONTROL: 'territory_control',
  LEGENDARY_STATUS: 'legendary_status'
} as const;

/**
 * Achievement descriptions
 */
export const ACHIEVEMENT_DESCRIPTIONS: Record<string, string> = {
  third_generation: 'Dynasty reached third generation',
  fifth_generation: 'Dynasty reached fifth generation - True Legacy',
  tenth_generation: 'Dynasty reached tenth generation - Legendary Family',
  first_million: 'Dynasty accumulated $1,000,000 total wealth',
  territory_control: 'Dynasty controlled an entire district',
  legendary_status: 'A dynasty member reached legendary reputation'
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to SuccessionPlan
 */
export function rowToSuccessionPlan(row: SuccessionPlanRow): SuccessionPlan {
  return {
    id: row.id,
    playerId: String(row.player_id),
    playerName: row.player_name,
    heirType: row.heir_type,
    heirPlayerId: row.heir_player_id ? String(row.heir_player_id) : undefined,
    heirPlayerName: row.heir_player_name,
    heirNpcName: row.heir_npc_name ?? undefined,
    propertyTransferPercent: row.property_transfer_percent,
    cashTransferPercent: row.cash_transfer_percent,
    reputationTransferPercent: row.reputation_transfer_percent,
    crewPositionTransfer: row.crew_position_transfer,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/**
 * Convert database row to CharacterEnding
 */
export function rowToCharacterEnding(row: CharacterEndingRow): CharacterEnding {
  return {
    id: row.id,
    playerId: String(row.player_id),
    playerName: row.player_name,
    endingType: row.ending_type,
    endingDescription: row.ending_description ?? undefined,
    finalStats: row.final_stats ?? {},
    finalNetWorth: Number(row.final_net_worth),
    propertiesOwned: row.properties_owned,
    reputationScore: row.reputation_score,
    lifeChapter: row.life_chapter ?? undefined,
    ageAtEnding: row.age_at_ending ?? undefined,
    causedByPlayerId: row.caused_by_player_id ? String(row.caused_by_player_id) : undefined,
    causedByPlayerName: row.caused_by_player_name,
    successionExecuted: row.succession_executed,
    heirPlayerId: row.heir_player_id ? String(row.heir_player_id) : undefined,
    endedAt: new Date(row.ended_at)
  };
}

/**
 * Convert database row to PlayerLineage
 */
export function rowToPlayerLineage(row: PlayerLineageRow): PlayerLineage {
  return {
    id: row.id,
    playerId: String(row.player_id),
    playerName: row.player_name,
    predecessorPlayerId: row.predecessor_player_id ? String(row.predecessor_player_id) : undefined,
    predecessorName: row.predecessor_name,
    predecessorEndingId: row.predecessor_ending_id ?? undefined,
    generation: row.generation,
    inheritedProperties: (row.inherited_properties ?? []).map(String),
    inheritedCash: Number(row.inherited_cash),
    inheritedReputationPercent: row.inherited_reputation_percent,
    inheritedCrewPosition: row.inherited_crew_position,
    dynastyName: row.dynasty_name ?? undefined,
    lineageStartedAt: new Date(row.lineage_started_at),
    createdAt: new Date(row.created_at)
  };
}

/**
 * Convert database row to DynastyAchievement
 */
export function rowToDynastyAchievement(row: DynastyAchievementRow): DynastyAchievement {
  return {
    id: row.id,
    dynastyName: row.dynasty_name,
    achievementType: row.achievement_type,
    description: row.description ?? undefined,
    generationAchieved: row.generation_achieved,
    playerId: row.player_id ? String(row.player_id) : undefined,
    playerName: row.player_name,
    metadata: row.metadata ?? undefined,
    achievedAt: new Date(row.achieved_at)
  };
}

/**
 * Get a random ending description for an ending type
 */
export function getRandomEndingDescription(endingType: EndingType): string {
  const descriptions = ENDING_DESCRIPTIONS[endingType];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

/**
 * Validate transfer percentages
 */
export function validateTransferPercents(
  property: number,
  cash: number,
  reputation: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { min, max } = TRANSFER_PERCENT_LIMITS;

  if (property < min || property > max) {
    errors.push(`Property transfer percent must be between ${min} and ${max}`);
  }
  if (cash < min || cash > max) {
    errors.push(`Cash transfer percent must be between ${min} and ${max}`);
  }
  if (reputation < min || reputation > max) {
    errors.push(`Reputation transfer percent must be between ${min} and ${max}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if heir type requires player ID
 */
export function requiresHeirPlayerId(heirType: HeirType): boolean {
  return heirType === 'player_heir';
}

/**
 * Check if heir type requires NPC name
 */
export function requiresHeirNpcName(heirType: HeirType): boolean {
  return heirType === 'npc_family' || heirType === 'npc_lieutenant';
}

/**
 * Calculate generation title based on generation number
 */
export function getGenerationTitle(generation: number): string {
  if (generation === 1) return 'Founder';
  if (generation === 2) return 'Second Generation';
  if (generation === 3) return 'Third Generation';
  if (generation <= 5) return `${generation}th Generation`;
  if (generation <= 10) return 'Established Dynasty';
  return 'Legendary Bloodline';
}

/**
 * Format inheritance summary for display
 */
export function formatInheritanceSummary(inheritance: Inheritance): string {
  const parts: string[] = [];

  if (inheritance.propertyCount > 0) {
    parts.push(`${inheritance.propertyCount} ${inheritance.propertyCount === 1 ? 'property' : 'properties'}`);
  }
  if (inheritance.cash > 0) {
    parts.push(`$${inheritance.cash.toLocaleString()}`);
  }
  if (inheritance.reputationBonus > 0) {
    parts.push(`+${inheritance.reputationBonus}% reputation`);
  }
  if (inheritance.crewPosition) {
    parts.push(`${inheritance.crewPosition.rank} position`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Nothing inherited';
}
