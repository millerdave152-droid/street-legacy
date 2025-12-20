// District Ecosystem Type Definitions
// Defines types for the dynamic territorial ecosystem system

export type DistrictStatus = 'stable' | 'volatile' | 'warzone' | 'gentrifying' | 'declining';

export type DistrictEventType =
  | 'crime_committed'
  | 'property_bought'
  | 'property_sold'
  | 'crew_battle'
  | 'business_opened'
  | 'business_closed'
  | 'player_attacked'
  | 'police_raid'
  | 'territory_claimed'
  | 'territory_lost'
  | 'heist_executed'
  | 'drug_bust'
  | 'gentrification'
  | 'economic_boost'
  | 'economic_crash';

export interface DistrictState {
  id: string;
  districtId: string;
  crimeIndex: number;
  policePresence: number;
  propertyValues: number;
  businessHealth: number;
  streetActivity: number;
  status: DistrictStatus;
  heatLevel: number;
  crewTension: number;
  dailyCrimeCount: number;
  dailyTransactionVolume: number;
  activeBusinesses: number;
  lastCalculated: Date;
  lastStatusChange: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistrictEvent {
  id: string;
  districtId: string;
  eventType: DistrictEventType;
  severity: number;
  playerId: string | null;
  targetPlayerId: string | null;
  crewId: string | null;
  metadata: Record<string, unknown>;
  crimeImpact: number;
  policeImpact: number;
  propertyImpact: number;
  businessImpact: number;
  activityImpact: number;
  processed: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

export interface DistrictModifiers {
  crimeDifficulty: number;      // Multiplier for crime success chance (lower = harder)
  propertyIncome: number;       // Multiplier for property revenue
  recruitmentEase: number;      // Multiplier for crew recruitment success
  heatDecay: number;            // Multiplier for heat reduction rate
  policeResponseTime: number;   // Affects escape mechanics (higher = slower response)
  crimePayoutBonus: number;     // Bonus to crime payouts
  shopPriceModifier: number;    // Modifier for shop prices
}

export interface LogEventParams {
  districtId: string;
  eventType: DistrictEventType;
  playerId?: string;
  targetPlayerId?: string;
  crewId?: string;
  severity?: number;
  metadata?: Record<string, unknown>;
}

export interface DistrictStateRow {
  id: string;
  district_id: string;
  crime_index: number;
  police_presence: number;
  property_values: number;
  business_health: number;
  street_activity: number;
  district_status: DistrictStatus;
  heat_level: number;
  crew_tension: number;
  daily_crime_count: number;
  daily_transaction_volume: string;
  active_businesses: number;
  last_calculated: Date;
  last_status_change: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DistrictEventRow {
  id: string;
  district_id: string;
  event_type: DistrictEventType;
  severity: number;
  player_id: string | null;
  target_player_id: string | null;
  crew_id: string | null;
  metadata: Record<string, unknown>;
  crime_impact: number;
  police_impact: number;
  property_impact: number;
  business_impact: number;
  activity_impact: number;
  processed: boolean;
  processed_at: Date | null;
  created_at: Date;
}

// Event counts from aggregation query
export interface EventCounts {
  crime_committed: number;
  property_bought: number;
  property_sold: number;
  crew_battle: number;
  business_opened: number;
  business_closed: number;
  player_attacked: number;
  police_raid: number;
  territory_claimed: number;
  territory_lost: number;
  heist_executed: number;
  drug_bust: number;
  gentrification: number;
  economic_boost: number;
  economic_crash: number;
}
