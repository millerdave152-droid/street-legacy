// District Ecosystem Service
// Handles all business logic for the dynamic territorial ecosystem

import pool from '../db/connection.js';
import {
  DistrictState,
  DistrictEvent,
  DistrictModifiers,
  DistrictStatus,
  DistrictEventType,
  LogEventParams,
  DistrictStateRow,
  DistrictEventRow,
  EventCounts
} from '../types/districtEcosystem.types.js';
import { getReputation } from './reputationWeb.service.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapRowToDistrictState(row: DistrictStateRow): DistrictState {
  return {
    id: row.id,
    districtId: row.district_id,
    crimeIndex: row.crime_index,
    policePresence: row.police_presence,
    propertyValues: row.property_values,
    businessHealth: row.business_health,
    streetActivity: row.street_activity,
    status: row.district_status,
    heatLevel: row.heat_level,
    crewTension: row.crew_tension,
    dailyCrimeCount: row.daily_crime_count,
    dailyTransactionVolume: parseInt(row.daily_transaction_volume) || 0,
    activeBusinesses: row.active_businesses,
    lastCalculated: row.last_calculated,
    lastStatusChange: row.last_status_change,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRowToDistrictEvent(row: DistrictEventRow): DistrictEvent {
  return {
    id: row.id,
    districtId: row.district_id,
    eventType: row.event_type,
    severity: row.severity,
    playerId: row.player_id,
    targetPlayerId: row.target_player_id,
    crewId: row.crew_id,
    metadata: row.metadata,
    crimeImpact: row.crime_impact,
    policeImpact: row.police_impact,
    propertyImpact: row.property_impact,
    businessImpact: row.business_impact,
    activityImpact: row.activity_impact,
    processed: row.processed,
    processedAt: row.processed_at,
    createdAt: row.created_at
  };
}

// Calculate district status from metrics
function calculateStatus(
  crimeIndex: number,
  policePresence: number,
  propertyValues: number,
  businessHealth: number,
  streetActivity: number,
  crewTension: number
): DistrictStatus {
  // Warzone: High crime AND high crew tension
  if (crimeIndex >= 80 && streetActivity >= 70) {
    return 'warzone';
  }
  if (crimeIndex >= 70 && crewTension >= 60) {
    return 'warzone';
  }

  // Gentrifying: Low crime, high property values
  if (crimeIndex < 30 && propertyValues >= 70) {
    return 'gentrifying';
  }
  if (propertyValues >= 65 && businessHealth >= 60 && crimeIndex <= 40) {
    return 'gentrifying';
  }

  // Declining: Low business health and property values
  if (businessHealth <= 30 && propertyValues <= 40) {
    return 'declining';
  }

  // Volatile: Moderate-high crime or activity
  if (crimeIndex >= 60 || streetActivity >= 60) {
    return 'volatile';
  }
  if (crimeIndex >= 55 && crewTension >= 40) {
    return 'volatile';
  }

  return 'stable';
}

// Calculate event impacts based on type and severity
function calculateEventImpacts(eventType: DistrictEventType, severity: number): {
  crimeImpact: number;
  policeImpact: number;
  propertyImpact: number;
  businessImpact: number;
  activityImpact: number;
} {
  let crimeImpact = 0;
  let policeImpact = 0;
  let propertyImpact = 0;
  let businessImpact = 0;
  let activityImpact = 0;

  switch (eventType) {
    case 'crime_committed':
      crimeImpact = severity * 2;
      policeImpact = severity;
      activityImpact = 1;
      break;

    case 'property_bought':
      propertyImpact = severity;
      businessImpact = Math.ceil(severity * 0.5);
      break;

    case 'property_sold':
      propertyImpact = -Math.ceil(severity * 0.3);
      break;

    case 'crew_battle':
      crimeImpact = severity * 3;
      policeImpact = severity * 2;
      businessImpact = -severity;
      activityImpact = severity * 2;
      break;

    case 'business_opened':
      businessImpact = severity * 2;
      propertyImpact = severity;
      activityImpact = 1;
      break;

    case 'business_closed':
      businessImpact = -severity * 2;
      propertyImpact = -severity;
      break;

    case 'player_attacked':
      crimeImpact = severity * 2;
      policeImpact = severity;
      activityImpact = 1;
      break;

    case 'police_raid':
      policeImpact = severity * 3;
      crimeImpact = -severity * 2;
      businessImpact = -severity;
      break;

    case 'territory_claimed':
      crimeImpact = severity;
      activityImpact = severity * 2;
      break;

    case 'territory_lost':
      crimeImpact = severity * 2;
      activityImpact = severity;
      break;

    case 'heist_executed':
      crimeImpact = severity * 4;
      policeImpact = severity * 3;
      activityImpact = severity * 2;
      break;

    case 'drug_bust':
      policeImpact = severity * 2;
      crimeImpact = -severity;
      break;

    case 'gentrification':
      propertyImpact = severity * 2;
      businessImpact = severity;
      crimeImpact = -severity;
      break;

    case 'economic_boost':
      businessImpact = severity * 2;
      propertyImpact = severity;
      break;

    case 'economic_crash':
      businessImpact = -severity * 3;
      propertyImpact = -severity * 2;
      break;

    default:
      activityImpact = 1;
  }

  // Clamp impacts to valid range (-50 to 50)
  return {
    crimeImpact: Math.max(-50, Math.min(50, crimeImpact)),
    policeImpact: Math.max(-50, Math.min(50, policeImpact)),
    propertyImpact: Math.max(-50, Math.min(50, propertyImpact)),
    businessImpact: Math.max(-50, Math.min(50, businessImpact)),
    activityImpact: Math.max(-50, Math.min(50, activityImpact))
  };
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Log a district event (any player action that affects a district)
 */
export async function logDistrictEvent(params: LogEventParams): Promise<string | null> {
  const {
    districtId,
    eventType,
    playerId = null,
    targetPlayerId = null,
    crewId = null,
    severity = 1,
    metadata = {}
  } = params;

  console.log(`[DistrictEcosystem] Logging event: ${eventType} in ${districtId} (severity: ${severity})`);

  try {
    // Calculate impacts based on event type
    const impacts = calculateEventImpacts(eventType, severity);

    const result = await pool.query(
      `INSERT INTO district_events (
        district_id, event_type, severity, player_id, target_player_id, crew_id,
        metadata, crime_impact, police_impact, property_impact, business_impact, activity_impact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        districtId,
        eventType,
        severity,
        playerId,
        targetPlayerId,
        crewId,
        JSON.stringify(metadata),
        impacts.crimeImpact,
        impacts.policeImpact,
        impacts.propertyImpact,
        impacts.businessImpact,
        impacts.activityImpact
      ]
    );

    const eventId = result.rows[0]?.id;
    console.log(`[DistrictEcosystem] Event logged with ID: ${eventId}`);
    return eventId;
  } catch (error) {
    console.error('[DistrictEcosystem] Error logging event:', error);
    return null;
  }
}

/**
 * Recalculate district state based on recent events (last 24 hours)
 */
export async function recalculateDistrictState(districtId: string): Promise<DistrictState | null> {
  console.log(`[DistrictEcosystem] Recalculating state for district: ${districtId}`);

  try {
    // Get current state
    const currentResult = await pool.query(
      'SELECT * FROM district_states WHERE district_id = $1',
      [districtId]
    );

    if (currentResult.rows.length === 0) {
      console.log(`[DistrictEcosystem] No state found for district: ${districtId}`);
      return null;
    }

    const current = currentResult.rows[0] as DistrictStateRow;

    // Get event counts from last 24 hours
    const eventsResult = await pool.query(
      `SELECT
        event_type,
        COUNT(*) as count,
        COALESCE(SUM(crime_impact), 0) as total_crime_impact,
        COALESCE(SUM(police_impact), 0) as total_police_impact,
        COALESCE(SUM(property_impact), 0) as total_property_impact,
        COALESCE(SUM(business_impact), 0) as total_business_impact,
        COALESCE(SUM(activity_impact), 0) as total_activity_impact
      FROM district_events
      WHERE district_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type`,
      [districtId]
    );

    // Calculate deltas from events
    let crimeDeltas = 0;
    let policeDeltas = 0;
    let propertyDeltas = 0;
    let businessDeltas = 0;
    let activityDeltas = 0;
    let totalCrimes = 0;

    for (const row of eventsResult.rows) {
      crimeDeltas += parseInt(row.total_crime_impact) || 0;
      policeDeltas += parseInt(row.total_police_impact) || 0;
      propertyDeltas += parseInt(row.total_property_impact) || 0;
      businessDeltas += parseInt(row.total_business_impact) || 0;
      activityDeltas += parseInt(row.total_activity_impact) || 0;

      if (row.event_type === 'crime_committed' || row.event_type === 'heist_executed') {
        totalCrimes += parseInt(row.count) || 0;
      }
    }

    // Apply time decay (reduces intensity over time)
    const hoursSinceLastCalc = (Date.now() - new Date(current.last_calculated).getTime()) / (1000 * 60 * 60);
    const decayFactor = Math.max(0.1, 1 - (hoursSinceLastCalc * 0.02)); // 2% decay per hour

    // Calculate new values with deltas and decay
    const newCrimeIndex = Math.max(0, Math.min(100,
      Math.round((current.crime_index + crimeDeltas) * decayFactor + (50 * (1 - decayFactor)))
    ));
    const newPolicePresence = Math.max(0, Math.min(100,
      Math.round((current.police_presence + policeDeltas) * decayFactor + (50 * (1 - decayFactor)))
    ));
    const newPropertyValues = Math.max(0, Math.min(100,
      Math.round((current.property_values + propertyDeltas) * 0.98 + (50 * 0.02)) // Slower change for property
    ));
    const newBusinessHealth = Math.max(0, Math.min(100,
      Math.round((current.business_health + businessDeltas) * 0.95 + (50 * 0.05))
    ));
    const newStreetActivity = Math.max(0, Math.min(100,
      Math.round((current.street_activity + activityDeltas) * decayFactor + (50 * (1 - decayFactor)))
    ));

    // Calculate new crew tension (based on crew battles)
    const crewBattles = eventsResult.rows.find(r => r.event_type === 'crew_battle');
    const crewBattleCount = crewBattles ? parseInt(crewBattles.count) : 0;
    const newCrewTension = Math.max(0, Math.min(100,
      Math.round(current.crew_tension * 0.9 + crewBattleCount * 10)
    ));

    // Determine new status
    const newStatus = calculateStatus(
      newCrimeIndex,
      newPolicePresence,
      newPropertyValues,
      newBusinessHealth,
      newStreetActivity,
      newCrewTension
    );

    // Check if status changed
    const statusChanged = newStatus !== current.district_status;

    // Update district state
    const updateResult = await pool.query(
      `UPDATE district_states SET
        crime_index = $1,
        police_presence = $2,
        property_values = $3,
        business_health = $4,
        street_activity = $5,
        crew_tension = $6,
        district_status = $7,
        daily_crime_count = $8,
        last_calculated = NOW(),
        last_status_change = CASE WHEN $9 THEN NOW() ELSE last_status_change END
      WHERE district_id = $10
      RETURNING *`,
      [
        newCrimeIndex,
        newPolicePresence,
        newPropertyValues,
        newBusinessHealth,
        newStreetActivity,
        newCrewTension,
        newStatus,
        totalCrimes,
        statusChanged,
        districtId
      ]
    );

    // Mark recent events as processed
    await pool.query(
      `UPDATE district_events SET processed = true, processed_at = NOW()
       WHERE district_id = $1 AND processed = false`,
      [districtId]
    );

    if (statusChanged) {
      console.log(`[DistrictEcosystem] District ${districtId} status changed: ${current.district_status} -> ${newStatus}`);
    }

    console.log(`[DistrictEcosystem] State recalculated for ${districtId}: crime=${newCrimeIndex}, status=${newStatus}`);

    return mapRowToDistrictState(updateResult.rows[0]);
  } catch (error) {
    console.error('[DistrictEcosystem] Error recalculating state:', error);
    return null;
  }
}

/**
 * Get current state for a single district
 */
export async function getDistrictState(districtId: string): Promise<DistrictState | null> {
  console.log(`[DistrictEcosystem] Getting state for district: ${districtId}`);

  try {
    const result = await pool.query(
      'SELECT * FROM district_states WHERE district_id = $1',
      [districtId]
    );

    if (result.rows.length === 0) {
      console.log(`[DistrictEcosystem] No state found for district: ${districtId}`);
      return null;
    }

    return mapRowToDistrictState(result.rows[0] as DistrictStateRow);
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting district state:', error);
    return null;
  }
}

/**
 * Get all district states (for map display)
 */
export async function getAllDistrictStates(): Promise<DistrictState[]> {
  console.log('[DistrictEcosystem] Getting all district states');

  try {
    const result = await pool.query(
      'SELECT * FROM district_states ORDER BY district_id'
    );

    return result.rows.map((row: DistrictStateRow) => mapRowToDistrictState(row));
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting all district states:', error);
    return [];
  }
}

/**
 * Get gameplay modifiers for a district based on current state
 */
export async function getDistrictModifiers(districtId: string): Promise<DistrictModifiers | null> {
  console.log(`[DistrictEcosystem] Getting modifiers for district: ${districtId}`);

  try {
    const state = await getDistrictState(districtId);
    if (!state) {
      return null;
    }

    // Calculate modifiers based on district metrics
    // Crime difficulty: Higher police = harder crimes
    // Range: 0.5 (very hard) to 1.5 (very easy)
    const crimeDifficulty = 1.5 - (state.policePresence / 100);

    // Property income: Higher property values = more income
    // Range: 0.5x to 1.5x
    const propertyIncome = 0.5 + (state.propertyValues / 100);

    // Recruitment ease: Higher street activity = easier recruitment
    // Range: 0.5x to 1.5x
    const recruitmentEase = 0.5 + (state.streetActivity / 100);

    // Heat decay: Higher police = slower heat decay
    // Range: 0.5x to 1.5x (higher = faster decay)
    const heatDecay = 1.5 - (state.policePresence / 100);

    // Police response time: Higher crime = slower response (cops are busy)
    // Range: 0.5 to 1.5 (higher = slower, better for escape)
    const policeResponseTime = 0.5 + (state.crimeIndex / 100);

    // Crime payout bonus: Based on district wealth (property values)
    // Range: 0% to 50% bonus
    const crimePayoutBonus = (state.propertyValues / 200); // 0 to 0.5

    // Shop price modifier: Higher property values = more expensive
    // Range: 0.8x to 1.2x
    const shopPriceModifier = 0.8 + (state.propertyValues / 250);

    const modifiers: DistrictModifiers = {
      crimeDifficulty: Math.round(crimeDifficulty * 100) / 100,
      propertyIncome: Math.round(propertyIncome * 100) / 100,
      recruitmentEase: Math.round(recruitmentEase * 100) / 100,
      heatDecay: Math.round(heatDecay * 100) / 100,
      policeResponseTime: Math.round(policeResponseTime * 100) / 100,
      crimePayoutBonus: Math.round(crimePayoutBonus * 100) / 100,
      shopPriceModifier: Math.round(shopPriceModifier * 100) / 100
    };

    console.log(`[DistrictEcosystem] Modifiers for ${districtId}:`, modifiers);
    return modifiers;
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting modifiers:', error);
    return null;
  }
}

/**
 * Extended modifiers that include player reputation effects
 */
export interface PlayerDistrictModifiers extends DistrictModifiers {
  reputationBonus: number;       // Bonus to rep gains (0.8 to 1.5)
  factionDiscount: number;       // Shop discount from faction rep (0 to 0.2)
  crimeSuccessBonus: number;     // Bonus to crime success from fear/respect
  heatGenerationMod: number;     // Heat generation modifier (lower = less heat)
  recruitmentBonus: number;      // Bonus to recruitment from local rep
}

/**
 * Get player-specific district modifiers based on their reputation
 */
export async function getPlayerDistrictModifiers(
  districtId: string,
  playerId: string
): Promise<PlayerDistrictModifiers | null> {
  console.log(`[DistrictEcosystem] Getting player modifiers for ${playerId} in ${districtId}`);

  try {
    // Get base modifiers
    const baseModifiers = await getDistrictModifiers(districtId);
    if (!baseModifiers) {
      return null;
    }

    // Get player's reputation in this district
    const districtRep = await getReputation(playerId, 'district', districtId);

    // Default values if no reputation
    let reputationBonus = 1.0;
    let factionDiscount = 0;
    let crimeSuccessBonus = 0;
    let heatGenerationMod = 1.0;
    let recruitmentBonus = 0;

    if (districtRep) {
      const { respect, fear, trust, heat } = districtRep.score;

      // Reputation bonus: Higher combined rep = faster rep gains
      // Range: 0.8x to 1.5x
      const combinedRep = (respect + fear + trust) / 3;
      reputationBonus = Math.max(0.8, Math.min(1.5, 1 + (combinedRep / 200)));

      // Crime success bonus: Fear and respect help with crimes
      // Range: 0% to 15% bonus
      crimeSuccessBonus = Math.max(0, Math.min(0.15, (fear + respect) / 400));

      // Heat generation mod: Higher fear = less heat (people are scared to report)
      // Range: 0.7x to 1.2x (lower = less heat generated)
      heatGenerationMod = Math.max(0.7, Math.min(1.2, 1 - (fear / 250)));

      // Recruitment bonus: Trust helps with recruitment
      // Range: 0% to 20% bonus
      recruitmentBonus = Math.max(0, Math.min(0.2, trust / 500));

      // Note: factionDiscount would be calculated from faction rep, not district rep
    }

    const playerModifiers: PlayerDistrictModifiers = {
      ...baseModifiers,
      reputationBonus: Math.round(reputationBonus * 100) / 100,
      factionDiscount: Math.round(factionDiscount * 100) / 100,
      crimeSuccessBonus: Math.round(crimeSuccessBonus * 100) / 100,
      heatGenerationMod: Math.round(heatGenerationMod * 100) / 100,
      recruitmentBonus: Math.round(recruitmentBonus * 100) / 100
    };

    console.log(`[DistrictEcosystem] Player modifiers for ${playerId} in ${districtId}:`, playerModifiers);
    return playerModifiers;
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting player modifiers:', error);
    return null;
  }
}

/**
 * Calculate reputation multiplier based on district status
 * Volatile/warzone districts give higher reputation gains
 */
export function getStatusReputationMultiplier(status: DistrictStatus): number {
  switch (status) {
    case 'warzone':
      return 1.5;      // 50% bonus - high risk, high reward
    case 'volatile':
      return 1.25;     // 25% bonus
    case 'stable':
      return 1.0;      // Normal
    case 'declining':
      return 1.1;      // 10% bonus - desperation breeds opportunity
    case 'gentrifying':
      return 0.9;      // 10% penalty - harder to make an impression
    default:
      return 1.0;
  }
}

/**
 * Get recent events for a district (history)
 */
export async function getDistrictHistory(districtId: string, limit: number = 50): Promise<DistrictEvent[]> {
  console.log(`[DistrictEcosystem] Getting history for district: ${districtId} (limit: ${limit})`);

  try {
    const result = await pool.query(
      `SELECT * FROM district_events
       WHERE district_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [districtId, limit]
    );

    return result.rows.map((row: DistrictEventRow) => mapRowToDistrictEvent(row));
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting district history:', error);
    return [];
  }
}

/**
 * Process all districts (called periodically, e.g., every 15 minutes)
 */
export async function processAllDistricts(): Promise<number> {
  console.log('[DistrictEcosystem] Processing all districts...');

  try {
    const result = await pool.query('SELECT district_id FROM district_states');
    let processed = 0;

    for (const row of result.rows) {
      await recalculateDistrictState(row.district_id);
      processed++;
    }

    console.log(`[DistrictEcosystem] Processed ${processed} districts`);
    return processed;
  } catch (error) {
    console.error('[DistrictEcosystem] Error processing districts:', error);
    return 0;
  }
}

/**
 * Initialize district state for a new district (if not exists)
 */
export async function initializeDistrictState(
  districtId: string,
  initialValues?: Partial<{
    crimeIndex: number;
    policePresence: number;
    propertyValues: number;
    businessHealth: number;
    streetActivity: number;
  }>
): Promise<DistrictState | null> {
  console.log(`[DistrictEcosystem] Initializing state for district: ${districtId}`);

  try {
    const result = await pool.query(
      `INSERT INTO district_states (district_id, crime_index, police_presence, property_values, business_health, street_activity)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (district_id) DO NOTHING
       RETURNING *`,
      [
        districtId,
        initialValues?.crimeIndex ?? 50,
        initialValues?.policePresence ?? 50,
        initialValues?.propertyValues ?? 50,
        initialValues?.businessHealth ?? 50,
        initialValues?.streetActivity ?? 50
      ]
    );

    if (result.rows.length === 0) {
      // Already exists, fetch it
      return getDistrictState(districtId);
    }

    return mapRowToDistrictState(result.rows[0] as DistrictStateRow);
  } catch (error) {
    console.error('[DistrictEcosystem] Error initializing district state:', error);
    return null;
  }
}

// ============================================================================
// THRESHOLD EVENT MONITORING
// ============================================================================

/**
 * District threshold event definition
 */
interface ThresholdEventType {
  eventType: string;
  name: string;
  description: string;
  triggerMetric: 'crime_index' | 'police_presence' | 'business_health' | 'street_activity' | 'crew_tension';
  triggerThreshold: number;
  triggerDirection: 'above' | 'below';
  effects: Record<string, number>;
  defaultDurationMinutes: number;
  cooldownMinutes: number;
  icon: string;
  color: string;
}

/**
 * Active district event info
 */
export interface ActiveDistrictEvent {
  eventId: string;
  eventType: string;
  name: string;
  description: string;
  effects: Record<string, number>;
  startedAt: Date;
  expiresAt: Date;
  timeRemainingMs: number;
  icon: string;
  color: string;
}

/**
 * Triggered event result
 */
interface TriggeredEventResult {
  districtId: string;
  eventType: string;
  eventId: string | null;
}

/**
 * Check if a specific event type is currently active in a district
 */
export async function isDistrictEventActive(districtId: string, eventType: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM district_event_history
       WHERE district_id = $1
       AND event_type = $2
       AND ended_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [districtId, eventType]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[DistrictEcosystem] Error checking active event:', error);
    return false;
  }
}

/**
 * Check if an event is on cooldown for a district
 */
export async function isDistrictEventOnCooldown(districtId: string, eventType: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT det.cooldown_minutes, MAX(COALESCE(deh.ended_at, deh.expires_at)) as last_ended
       FROM district_event_types det
       LEFT JOIN district_event_history deh ON deh.event_type = det.event_type
         AND deh.district_id = $1
       WHERE det.event_type = $2
       GROUP BY det.cooldown_minutes`,
      [districtId, eventType]
    );

    if (result.rows.length === 0 || !result.rows[0].last_ended) {
      return false;
    }

    const { cooldown_minutes, last_ended } = result.rows[0];
    const cooldownEnds = new Date(last_ended);
    cooldownEnds.setMinutes(cooldownEnds.getMinutes() + cooldown_minutes);

    return cooldownEnds > new Date();
  } catch (error) {
    console.error('[DistrictEcosystem] Error checking cooldown:', error);
    return false;
  }
}

/**
 * Trigger a district event
 */
export async function triggerDistrictEvent(
  districtId: string,
  eventType: string,
  triggeredBy: 'threshold' | 'scheduled' | 'admin' | 'player' = 'threshold',
  triggerValue?: number,
  triggerMetric?: string,
  durationOverride?: number
): Promise<string | null> {
  console.log(`[DistrictEcosystem] Attempting to trigger ${eventType} in ${districtId}`);

  try {
    // Check if already active
    if (await isDistrictEventActive(districtId, eventType)) {
      console.log(`[DistrictEcosystem] Event ${eventType} already active in ${districtId}`);
      return null;
    }

    // Check cooldown
    if (await isDistrictEventOnCooldown(districtId, eventType)) {
      console.log(`[DistrictEcosystem] Event ${eventType} on cooldown in ${districtId}`);
      return null;
    }

    // Get event definition
    const defResult = await pool.query(
      `SELECT * FROM district_event_types WHERE event_type = $1`,
      [eventType]
    );

    if (defResult.rows.length === 0) {
      console.error(`[DistrictEcosystem] Unknown event type: ${eventType}`);
      return null;
    }

    const eventDef = defResult.rows[0];
    const duration = durationOverride || eventDef.default_duration_minutes;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + duration);

    // Insert event
    const insertResult = await pool.query(
      `INSERT INTO district_event_history (
        district_id, event_type, triggered_by, trigger_value, trigger_metric,
        effects, duration_minutes, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        districtId,
        eventType,
        triggeredBy,
        triggerValue || null,
        triggerMetric || null,
        eventDef.effects,
        duration,
        expiresAt
      ]
    );

    const eventId = insertResult.rows[0].id;
    console.log(`[DistrictEcosystem] Triggered event ${eventType} (${eventId}) in ${districtId}`);

    // Update district_states active event
    await pool.query(
      `UPDATE district_states SET
        active_event = $1,
        event_started_at = NOW(),
        event_expires_at = $2
       WHERE district_id = $3`,
      [eventType, expiresAt, districtId]
    ).catch(() => {
      // Columns might not exist yet if migration hasn't run
    });

    return eventId;
  } catch (error) {
    console.error('[DistrictEcosystem] Error triggering event:', error);
    return null;
  }
}

/**
 * End a district event
 */
export async function endDistrictEvent(
  districtId: string,
  eventType: string,
  endedBy: 'expired' | 'admin' | 'countered' = 'expired'
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE district_event_history SET
        ended_at = NOW(),
        ended_by = $1
       WHERE district_id = $2
       AND event_type = $3
       AND ended_at IS NULL
       RETURNING id`,
      [endedBy, districtId, eventType]
    );

    if (result.rows.length === 0) {
      return false;
    }

    // Clear district_states active event
    await pool.query(
      `UPDATE district_states SET
        active_event = NULL,
        event_started_at = NULL,
        event_expires_at = NULL
       WHERE district_id = $1`,
      [districtId]
    ).catch(() => {
      // Columns might not exist yet
    });

    console.log(`[DistrictEcosystem] Ended event ${eventType} in ${districtId}`);
    return true;
  } catch (error) {
    console.error('[DistrictEcosystem] Error ending event:', error);
    return false;
  }
}

/**
 * Get active events for a district
 */
export async function getActiveDistrictEvents(districtId: string): Promise<ActiveDistrictEvent[]> {
  try {
    const result = await pool.query(
      `SELECT
        deh.id as event_id,
        deh.event_type,
        det.name,
        det.description,
        deh.effects,
        deh.started_at,
        deh.expires_at,
        det.icon,
        det.color
       FROM district_event_history deh
       JOIN district_event_types det ON deh.event_type = det.event_type
       WHERE deh.district_id = $1
       AND deh.ended_at IS NULL
       AND (deh.expires_at IS NULL OR deh.expires_at > NOW())`,
      [districtId]
    );

    return result.rows.map(row => ({
      eventId: row.event_id,
      eventType: row.event_type,
      name: row.name,
      description: row.description,
      effects: row.effects || {},
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      timeRemainingMs: row.expires_at ? new Date(row.expires_at).getTime() - Date.now() : 0,
      icon: row.icon,
      color: row.color
    }));
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting active events:', error);
    return [];
  }
}

/**
 * Get combined event modifiers for a district
 */
export async function getDistrictEventModifiers(districtId: string): Promise<Record<string, number>> {
  try {
    const result = await pool.query(
      `SELECT effects FROM district_event_history
       WHERE district_id = $1
       AND ended_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [districtId]
    );

    const combined: Record<string, number> = {};
    for (const row of result.rows) {
      if (row.effects) {
        Object.assign(combined, row.effects);
      }
    }

    return combined;
  } catch (error) {
    console.error('[DistrictEcosystem] Error getting event modifiers:', error);
    return {};
  }
}

/**
 * Check and trigger threshold events for all districts
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function checkAllDistrictThresholds(): Promise<TriggeredEventResult[]> {
  console.log('[DistrictEcosystem] Checking district thresholds...');
  const triggered: TriggeredEventResult[] = [];

  try {
    // Get all district states
    const statesResult = await pool.query(
      `SELECT district_id, crime_index, police_presence, business_health,
              street_activity, crew_tension
       FROM district_states`
    );

    // Get all active event types
    const eventTypesResult = await pool.query(
      `SELECT * FROM district_event_types
       WHERE is_active = true AND trigger_metric IS NOT NULL`
    );

    for (const state of statesResult.rows) {
      for (const eventType of eventTypesResult.rows) {
        let shouldTrigger = false;
        let metricValue = 0;

        // Get the metric value
        switch (eventType.trigger_metric) {
          case 'crime_index':
            metricValue = state.crime_index;
            break;
          case 'police_presence':
            metricValue = state.police_presence;
            break;
          case 'business_health':
            metricValue = state.business_health;
            break;
          case 'street_activity':
            metricValue = state.street_activity;
            break;
          case 'crew_tension':
            metricValue = state.crew_tension;
            break;
        }

        // Check if threshold is crossed
        if (eventType.trigger_direction === 'above') {
          shouldTrigger = metricValue >= eventType.trigger_threshold;
        } else if (eventType.trigger_direction === 'below') {
          shouldTrigger = metricValue <= eventType.trigger_threshold;
        }

        // Trigger event if threshold crossed
        if (shouldTrigger) {
          const eventId = await triggerDistrictEvent(
            state.district_id,
            eventType.event_type,
            'threshold',
            metricValue,
            eventType.trigger_metric
          );

          if (eventId) {
            triggered.push({
              districtId: state.district_id,
              eventType: eventType.event_type,
              eventId
            });
            console.log(`[DistrictEcosystem] Threshold triggered: ${eventType.event_type} in ${state.district_id} (${eventType.trigger_metric}=${metricValue})`);
          }
        }
      }
    }

    console.log(`[DistrictEcosystem] Threshold check complete. Triggered ${triggered.length} events.`);
    return triggered;
  } catch (error) {
    console.error('[DistrictEcosystem] Error checking thresholds:', error);
    return [];
  }
}

/**
 * Expire ended events (cleanup)
 */
export async function expireDistrictEvents(): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE district_event_history SET
        ended_at = NOW(),
        ended_by = 'expired'
       WHERE ended_at IS NULL
       AND expires_at < NOW()
       RETURNING district_id, event_type`
    );

    // Clear district_states for expired events
    for (const row of result.rows) {
      await pool.query(
        `UPDATE district_states SET
          active_event = NULL,
          event_started_at = NULL,
          event_expires_at = NULL
         WHERE district_id = $1 AND active_event = $2`,
        [row.district_id, row.event_type]
      ).catch(() => {});
    }

    console.log(`[DistrictEcosystem] Expired ${result.rows.length} events`);
    return result.rows.length;
  } catch (error) {
    console.error('[DistrictEcosystem] Error expiring events:', error);
    return 0;
  }
}

/**
 * Process all districts and check thresholds (combined periodic task)
 * Should be called every 5-15 minutes
 */
export async function processDistrictsAndThresholds(): Promise<{
  districtsProcessed: number;
  eventsExpired: number;
  eventsTriggered: TriggeredEventResult[];
}> {
  console.log('[DistrictEcosystem] Running periodic district processing...');

  // First expire any ended events
  const eventsExpired = await expireDistrictEvents();

  // Recalculate all district states
  const districtsProcessed = await processAllDistricts();

  // Check thresholds and trigger events
  const eventsTriggered = await checkAllDistrictThresholds();

  return {
    districtsProcessed,
    eventsExpired,
    eventsTriggered
  };
}

// Export all methods as a service object for convenience
export const districtEcosystemService = {
  logDistrictEvent,
  recalculateDistrictState,
  getDistrictState,
  getAllDistrictStates,
  getDistrictModifiers,
  getPlayerDistrictModifiers,
  getStatusReputationMultiplier,
  getDistrictHistory,
  processAllDistricts,
  initializeDistrictState,
  // Threshold event methods
  isDistrictEventActive,
  isDistrictEventOnCooldown,
  triggerDistrictEvent,
  endDistrictEvent,
  getActiveDistrictEvents,
  getDistrictEventModifiers,
  checkAllDistrictThresholds,
  expireDistrictEvents,
  processDistrictsAndThresholds
};

export default districtEcosystemService;
