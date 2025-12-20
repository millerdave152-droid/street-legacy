/**
 * Reputation System Types
 * Multi-dimensional reputation tracking across districts, factions, crews, and players
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type ReputationType = 'district' | 'faction' | 'crew' | 'player';

export type ReputationDimension = 'respect' | 'fear' | 'trust' | 'heat';

export type Standing =
  | 'unknown'     // No significant reputation
  | 'known'       // People know who you are
  | 'respected'   // High respect, seen as capable
  | 'feared'      // High fear, seen as dangerous
  | 'trusted'     // High trust, seen as reliable
  | 'legendary'   // Exceptional combined reputation
  | 'hated'       // Strongly negative reputation
  | 'notorious';  // High fear with negative respect

// =============================================================================
// REPUTATION SCORE
// =============================================================================

export interface ReputationScore {
  respect: number;  // -100 to 100: Are you taken seriously?
  fear: number;     // -100 to 100: Are you dangerous?
  trust: number;    // -100 to 100: Can you be relied on?
  heat: number;     // 0 to 100: Are authorities watching you?
}

export interface ReputationChange {
  respect?: number;
  fear?: number;
  trust?: number;
  heat?: number;
}

// =============================================================================
// REPUTATION RECORD
// =============================================================================

export interface ReputationRecord {
  id: string;
  playerId: string;
  reputationType: ReputationType;
  targetId: string;
  targetName?: string;
  score: ReputationScore;
  standing: Standing;
  combinedScore: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface ReputationModification {
  reputationId: string;
  dimension: ReputationDimension;
  oldValue: number;
  newValue: number;
  change: number;
  clamped: boolean;
}

// =============================================================================
// REPUTATION EVENT (Audit Log)
// =============================================================================

export interface ReputationEvent {
  id: string;
  playerId: string;
  reputationType: ReputationType;
  targetId: string;
  dimension: ReputationDimension;
  changeAmount: number;
  oldValue: number;
  newValue: number;
  reason: string;
  relatedPlayerId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// =============================================================================
// FACTION
// =============================================================================

export interface Faction {
  id: string;
  name: string;
  description: string;
  homeDistrict: string;
  alliedDistricts: string[];
  valuesLoyalty: boolean;
  valuesViolence: boolean;
  valuesBusiness: boolean;
  allies: string[];
  enemies: string[];
  icon: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactionRelationship {
  factionId: string;
  factionName: string;
  relationship: 'ally' | 'enemy' | 'neutral';
  playerReputation?: ReputationRecord;
}

// =============================================================================
// REPUTATION WEB (Full Player Reputation View)
// =============================================================================

export interface ReputationWeb {
  playerId: string;
  totalRecords: number;
  districts: ReputationRecord[];
  factions: ReputationRecord[];
  crews: ReputationRecord[];
  players: ReputationRecord[];
  summary: {
    highestRespect: { targetId: string; targetName: string; value: number } | null;
    highestFear: { targetId: string; targetName: string; value: number } | null;
    highestTrust: { targetId: string; targetName: string; value: number } | null;
    highestHeat: { targetId: string; targetName: string; value: number } | null;
    overallStanding: Standing;
    averageReputation: number;
  };
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface ModifyReputationRequest {
  changes: ReputationChange;
  reason: string;
  relatedPlayerId?: string;
  metadata?: Record<string, unknown>;
}

export interface ModifyReputationResponse {
  success: boolean;
  modifications: ReputationModification[];
  newScore: ReputationScore;
  newStanding: Standing;
  propagated: {
    targetId: string;
    targetType: ReputationType;
    changes: ReputationChange;
  }[];
}

export interface GetReputationResponse {
  success: boolean;
  data: ReputationRecord;
}

export interface GetReputationWebResponse {
  success: boolean;
  data: ReputationWeb;
}

export interface GetFactionsResponse {
  success: boolean;
  data: {
    factions: Faction[];
    total: number;
  };
}

export interface GetFactionResponse {
  success: boolean;
  data: Faction;
}

// =============================================================================
// PROPAGATION CONFIG
// =============================================================================

export interface PropagationConfig {
  alliedFactionMultiplier: number;    // 0.3 = 30% of positive changes
  enemyFactionMultiplier: number;     // -0.3 = 30% inverted
  homeDistrictMultiplier: number;     // 0.2 = 20% spillover
  adjacentDistrictMultiplier: number; // 0.15 = 15% spillover
  districtFactionMultiplier: number;  // 0.25 = 25% spillover
}

export const DEFAULT_PROPAGATION_CONFIG: PropagationConfig = {
  alliedFactionMultiplier: 0.3,
  enemyFactionMultiplier: -0.3,
  homeDistrictMultiplier: 0.2,
  adjacentDistrictMultiplier: 0.15,
  districtFactionMultiplier: 0.25
};

// =============================================================================
// DISTRICT ADJACENCY MAP
// =============================================================================

export const DISTRICT_ADJACENCY: Record<string, string[]> = {
  downtown: ['yorkville', 'kensington', 'queen_west', 'financial', 'chinatown'],
  yorkville: ['downtown', 'north_york', 'rosedale'],
  scarborough: ['north_york', 'regent_park'],
  etobicoke: ['junction', 'north_york'],
  north_york: ['yorkville', 'scarborough', 'etobicoke'],
  kensington: ['downtown', 'chinatown', 'queen_west', 'little_italy'],
  port_lands: ['downtown', 'regent_park'],
  junction: ['etobicoke', 'parkdale', 'queen_west'],
  parkdale: ['junction', 'queen_west', 'liberty_village'],
  little_italy: ['kensington', 'queen_west'],
  queen_west: ['downtown', 'kensington', 'parkdale', 'little_italy', 'junction'],
  regent_park: ['downtown', 'scarborough', 'port_lands'],
  financial: ['downtown', 'yorkville'],
  chinatown: ['downtown', 'kensington'],
  liberty_village: ['parkdale', 'queen_west'],
  rosedale: ['yorkville', 'north_york'],
  bridle_path: ['north_york', 'rosedale']
};
