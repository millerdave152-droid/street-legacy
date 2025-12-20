/**
 * Reputation Web Service
 * Manages multi-dimensional reputation across districts, factions, crews, and players
 */

import pool from '../db/connection.js';
import {
  ReputationType,
  ReputationDimension,
  ReputationScore,
  ReputationChange,
  ReputationRecord,
  ReputationModification,
  ReputationWeb,
  Standing,
  Faction,
  PropagationConfig,
  DEFAULT_PROPAGATION_CONFIG,
  DISTRICT_ADJACENCY
} from '../types/reputation.types.js';

// =============================================================================
// STANDING CALCULATION
// =============================================================================

/**
 * Calculate standing based on reputation scores
 */
export function calculateStanding(score: ReputationScore): Standing {
  const total = score.respect + score.fear + score.trust;

  // Negative reputation states
  if (total < -50) return 'hated';
  if (score.fear > 60 && score.respect < 0) return 'notorious';

  // Neutral/low reputation
  if (total < 20) return 'unknown';
  if (total < 50) return 'known';

  // High reputation states
  if (score.fear > score.respect && score.fear > 40) return 'feared';
  if (score.trust > 60) return 'trusted';
  if (score.respect > 70) return 'respected';
  if (total > 150) return 'legendary';

  return 'known';
}

/**
 * Calculate overall standing from multiple reputations
 */
export function calculateOverallStanding(records: ReputationRecord[]): Standing {
  if (records.length === 0) return 'unknown';

  const avgScore: ReputationScore = {
    respect: 0,
    fear: 0,
    trust: 0,
    heat: 0
  };

  records.forEach(record => {
    avgScore.respect += record.score.respect;
    avgScore.fear += record.score.fear;
    avgScore.trust += record.score.trust;
    avgScore.heat += record.score.heat;
  });

  avgScore.respect = Math.round(avgScore.respect / records.length);
  avgScore.fear = Math.round(avgScore.fear / records.length);
  avgScore.trust = Math.round(avgScore.trust / records.length);
  avgScore.heat = Math.round(avgScore.heat / records.length);

  return calculateStanding(avgScore);
}

// =============================================================================
// CORE REPUTATION OPERATIONS
// =============================================================================

/**
 * Ensure a reputation record exists for a player-target pair
 */
export async function ensureReputationExists(
  playerId: string,
  reputationType: ReputationType,
  targetId: string
): Promise<string> {
  console.log(`[ReputationService] Ensuring reputation exists: player=${playerId}, type=${reputationType}, target=${targetId}`);

  const result = await pool.query(
    `INSERT INTO player_reputations (player_id, reputation_type, target_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, reputation_type, target_id) DO UPDATE SET player_id = EXCLUDED.player_id
     RETURNING id`,
    [playerId, reputationType, targetId]
  );

  return result.rows[0].id;
}

/**
 * Get a specific reputation record
 */
export async function getReputation(
  playerId: string,
  reputationType: ReputationType,
  targetId: string
): Promise<ReputationRecord | null> {
  console.log(`[ReputationService] Getting reputation: player=${playerId}, type=${reputationType}, target=${targetId}`);

  const result = await pool.query(
    `SELECT
       pr.id,
       pr.player_id,
       pr.reputation_type,
       pr.target_id,
       pr.respect,
       pr.fear,
       pr.trust,
       pr.heat,
       pr.last_updated,
       pr.created_at,
       CASE
         WHEN pr.reputation_type = 'faction' THEN rf.name
         WHEN pr.reputation_type = 'crew' THEN c.name
         WHEN pr.reputation_type = 'player' THEN p.username
         ELSE pr.target_id
       END as target_name
     FROM player_reputations pr
     LEFT JOIN reputation_factions rf ON pr.reputation_type = 'faction' AND pr.target_id = rf.id
     LEFT JOIN crews c ON pr.reputation_type = 'crew' AND pr.target_id = c.id::VARCHAR
     LEFT JOIN players p ON pr.reputation_type = 'player' AND pr.target_id = p.id::VARCHAR
     WHERE pr.player_id = $1 AND pr.reputation_type = $2 AND pr.target_id = $3`,
    [playerId, reputationType, targetId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const score: ReputationScore = {
    respect: row.respect,
    fear: row.fear,
    trust: row.trust,
    heat: row.heat
  };

  return {
    id: row.id,
    playerId: row.player_id,
    reputationType: row.reputation_type,
    targetId: row.target_id,
    targetName: row.target_name || row.target_id,
    score,
    standing: calculateStanding(score),
    combinedScore: score.respect + score.fear + score.trust - score.heat,
    lastUpdated: row.last_updated,
    createdAt: row.created_at
  };
}

/**
 * Get or create a reputation record
 */
export async function getOrCreateReputation(
  playerId: string,
  reputationType: ReputationType,
  targetId: string
): Promise<ReputationRecord> {
  let record = await getReputation(playerId, reputationType, targetId);

  if (!record) {
    await ensureReputationExists(playerId, reputationType, targetId);
    record = await getReputation(playerId, reputationType, targetId);
  }

  return record!;
}

/**
 * Get full reputation web for a player
 */
export async function getReputationWeb(playerId: string): Promise<ReputationWeb> {
  console.log(`[ReputationService] Getting reputation web for player: ${playerId}`);

  const result = await pool.query(
    `SELECT
       pr.id,
       pr.player_id,
       pr.reputation_type,
       pr.target_id,
       pr.respect,
       pr.fear,
       pr.trust,
       pr.heat,
       pr.last_updated,
       pr.created_at,
       CASE
         WHEN pr.reputation_type = 'faction' THEN rf.name
         WHEN pr.reputation_type = 'crew' THEN c.name
         WHEN pr.reputation_type = 'player' THEN p.username
         ELSE pr.target_id
       END as target_name
     FROM player_reputations pr
     LEFT JOIN reputation_factions rf ON pr.reputation_type = 'faction' AND pr.target_id = rf.id
     LEFT JOIN crews c ON pr.reputation_type = 'crew' AND pr.target_id = c.id::VARCHAR
     LEFT JOIN players p ON pr.reputation_type = 'player' AND pr.target_id = p.id::VARCHAR
     WHERE pr.player_id = $1
     ORDER BY pr.reputation_type, (pr.respect + pr.fear + pr.trust - pr.heat) DESC`,
    [playerId]
  );

  const records: ReputationRecord[] = result.rows.map(row => {
    const score: ReputationScore = {
      respect: row.respect,
      fear: row.fear,
      trust: row.trust,
      heat: row.heat
    };

    return {
      id: row.id,
      playerId: row.player_id,
      reputationType: row.reputation_type,
      targetId: row.target_id,
      targetName: row.target_name || row.target_id,
      score,
      standing: calculateStanding(score),
      combinedScore: score.respect + score.fear + score.trust - score.heat,
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    };
  });

  // Categorize records
  const districts = records.filter(r => r.reputationType === 'district');
  const factions = records.filter(r => r.reputationType === 'faction');
  const crews = records.filter(r => r.reputationType === 'crew');
  const players = records.filter(r => r.reputationType === 'player');

  // Calculate summary
  const findHighest = (dimension: keyof ReputationScore) => {
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => b.score[dimension] - a.score[dimension]);
    const highest = sorted[0];
    return {
      targetId: highest.targetId,
      targetName: highest.targetName || highest.targetId,
      value: highest.score[dimension]
    };
  };

  const avgReputation = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.combinedScore, 0) / records.length)
    : 0;

  console.log(`[ReputationService] Found ${records.length} reputation records for player ${playerId}`);

  return {
    playerId,
    totalRecords: records.length,
    districts,
    factions,
    crews,
    players,
    summary: {
      highestRespect: findHighest('respect'),
      highestFear: findHighest('fear'),
      highestTrust: findHighest('trust'),
      highestHeat: findHighest('heat'),
      overallStanding: calculateOverallStanding(records),
      averageReputation: avgReputation
    }
  };
}

// =============================================================================
// REPUTATION MODIFICATION
// =============================================================================

/**
 * Modify a single reputation dimension
 */
async function modifyReputationDimension(
  playerId: string,
  reputationType: ReputationType,
  targetId: string,
  dimension: ReputationDimension,
  change: number,
  reason: string,
  relatedPlayerId?: string,
  metadata?: Record<string, unknown>
): Promise<ReputationModification> {
  // Ensure record exists
  const reputationId = await ensureReputationExists(playerId, reputationType, targetId);

  // Get current value
  const currentResult = await pool.query(
    `SELECT ${dimension} as value FROM player_reputations WHERE id = $1`,
    [reputationId]
  );
  const oldValue = currentResult.rows[0].value;

  // Calculate new value with clamping
  const minValue = dimension === 'heat' ? 0 : -100;
  const maxValue = 100;
  let newValue = oldValue + change;
  let clamped = false;

  if (newValue < minValue) {
    newValue = minValue;
    clamped = true;
  } else if (newValue > maxValue) {
    newValue = maxValue;
    clamped = true;
  }

  // Update reputation
  await pool.query(
    `UPDATE player_reputations SET ${dimension} = $1 WHERE id = $2`,
    [newValue, reputationId]
  );

  // Log event
  await pool.query(
    `INSERT INTO reputation_events
     (player_id, reputation_type, target_id, dimension, change_amount, old_value, new_value, reason, related_player_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [playerId, reputationType, targetId, dimension, change, oldValue, newValue, reason, relatedPlayerId || null, metadata || {}]
  );

  console.log(`[ReputationService] Modified ${dimension}: ${oldValue} -> ${newValue} (${change > 0 ? '+' : ''}${change}) for ${reputationType}:${targetId}`);

  return {
    reputationId,
    dimension,
    oldValue,
    newValue,
    change,
    clamped
  };
}

/**
 * Modify reputation with multiple dimension changes
 */
export async function modifyReputation(
  playerId: string,
  reputationType: ReputationType,
  targetId: string,
  changes: ReputationChange,
  reason: string,
  relatedPlayerId?: string,
  metadata?: Record<string, unknown>
): Promise<{
  modifications: ReputationModification[];
  newScore: ReputationScore;
  newStanding: Standing;
}> {
  console.log(`[ReputationService] Modifying reputation: player=${playerId}, type=${reputationType}, target=${targetId}, changes=${JSON.stringify(changes)}`);

  const modifications: ReputationModification[] = [];

  // Apply each dimension change
  if (changes.respect !== undefined && changes.respect !== 0) {
    const mod = await modifyReputationDimension(
      playerId, reputationType, targetId, 'respect', changes.respect, reason, relatedPlayerId, metadata
    );
    modifications.push(mod);
  }

  if (changes.fear !== undefined && changes.fear !== 0) {
    const mod = await modifyReputationDimension(
      playerId, reputationType, targetId, 'fear', changes.fear, reason, relatedPlayerId, metadata
    );
    modifications.push(mod);
  }

  if (changes.trust !== undefined && changes.trust !== 0) {
    const mod = await modifyReputationDimension(
      playerId, reputationType, targetId, 'trust', changes.trust, reason, relatedPlayerId, metadata
    );
    modifications.push(mod);
  }

  if (changes.heat !== undefined && changes.heat !== 0) {
    const mod = await modifyReputationDimension(
      playerId, reputationType, targetId, 'heat', changes.heat, reason, relatedPlayerId, metadata
    );
    modifications.push(mod);
  }

  // Get updated reputation
  const record = await getReputation(playerId, reputationType, targetId);

  return {
    modifications,
    newScore: record!.score,
    newStanding: record!.standing
  };
}

// =============================================================================
// REPUTATION PROPAGATION
// =============================================================================

/**
 * Propagate reputation changes to related entities
 */
export async function propagateReputation(
  playerId: string,
  reputationType: ReputationType,
  targetId: string,
  changes: ReputationChange,
  config: PropagationConfig = DEFAULT_PROPAGATION_CONFIG
): Promise<{ targetId: string; targetType: ReputationType; changes: ReputationChange }[]> {
  console.log(`[ReputationService] Propagating reputation from ${reputationType}:${targetId}`);

  const propagated: { targetId: string; targetType: ReputationType; changes: ReputationChange }[] = [];

  if (reputationType === 'faction') {
    // Get faction details
    const faction = await getFaction(targetId);
    if (!faction) return propagated;

    // Propagate to allied factions (positive changes only)
    for (const allyId of faction.allies) {
      const allyChanges: ReputationChange = {};

      if (changes.respect && changes.respect > 0) {
        allyChanges.respect = Math.round(changes.respect * config.alliedFactionMultiplier);
      }
      if (changes.trust && changes.trust > 0) {
        allyChanges.trust = Math.round(changes.trust * config.alliedFactionMultiplier);
      }

      if (Object.keys(allyChanges).length > 0) {
        await modifyReputation(playerId, 'faction', allyId, allyChanges, `Spillover from allied faction ${targetId}`);
        propagated.push({ targetId: allyId, targetType: 'faction', changes: allyChanges });
      }
    }

    // Propagate to enemy factions (inverted)
    for (const enemyId of faction.enemies) {
      const enemyChanges: ReputationChange = {};

      if (changes.respect) {
        enemyChanges.respect = Math.round(changes.respect * config.enemyFactionMultiplier);
      }
      if (changes.trust) {
        enemyChanges.trust = Math.round(changes.trust * config.enemyFactionMultiplier);
      }
      if (changes.fear) {
        // Fear can spread to enemies positively (they fear you more if you're threatening their enemy)
        enemyChanges.fear = Math.round(Math.abs(changes.fear) * config.alliedFactionMultiplier);
      }

      if (Object.keys(enemyChanges).length > 0) {
        await modifyReputation(playerId, 'faction', enemyId, enemyChanges, `Spillover from enemy faction ${targetId}`);
        propagated.push({ targetId: enemyId, targetType: 'faction', changes: enemyChanges });
      }
    }

    // Propagate to home district
    const districtChanges: ReputationChange = {};
    if (changes.respect) {
      districtChanges.respect = Math.round(changes.respect * config.homeDistrictMultiplier);
    }
    if (changes.fear) {
      districtChanges.fear = Math.round(changes.fear * config.homeDistrictMultiplier);
    }

    if (Object.keys(districtChanges).length > 0) {
      await modifyReputation(playerId, 'district', faction.homeDistrict, districtChanges, `Spillover from faction ${targetId}`);
      propagated.push({ targetId: faction.homeDistrict, targetType: 'district', changes: districtChanges });
    }
  }

  if (reputationType === 'district') {
    // Propagate to adjacent districts
    const adjacentDistricts = DISTRICT_ADJACENCY[targetId] || [];

    for (const adjacentId of adjacentDistricts) {
      const adjacentChanges: ReputationChange = {};

      if (changes.respect) {
        adjacentChanges.respect = Math.round(changes.respect * config.adjacentDistrictMultiplier);
      }
      if (changes.fear) {
        adjacentChanges.fear = Math.round(changes.fear * config.adjacentDistrictMultiplier);
      }

      if (Object.keys(adjacentChanges).length > 0 && (adjacentChanges.respect !== 0 || adjacentChanges.fear !== 0)) {
        await modifyReputation(playerId, 'district', adjacentId, adjacentChanges, `Spillover from adjacent district ${targetId}`);
        propagated.push({ targetId: adjacentId, targetType: 'district', changes: adjacentChanges });
      }
    }

    // Propagate to factions in this district
    const factionsInDistrict = await getFactionsInDistrict(targetId);

    for (const faction of factionsInDistrict) {
      const factionChanges: ReputationChange = {};

      if (changes.respect) {
        factionChanges.respect = Math.round(changes.respect * config.districtFactionMultiplier);
      }
      if (changes.fear) {
        factionChanges.fear = Math.round(changes.fear * config.districtFactionMultiplier);
      }

      if (Object.keys(factionChanges).length > 0 && (factionChanges.respect !== 0 || factionChanges.fear !== 0)) {
        await modifyReputation(playerId, 'faction', faction.id, factionChanges, `Spillover from district ${targetId}`);
        propagated.push({ targetId: faction.id, targetType: 'faction', changes: factionChanges });
      }
    }
  }

  console.log(`[ReputationService] Propagated to ${propagated.length} related entities`);
  return propagated;
}

// =============================================================================
// FACTION OPERATIONS
// =============================================================================

/**
 * Get a faction by ID
 */
export async function getFaction(factionId: string): Promise<Faction | null> {
  console.log(`[ReputationService] Getting faction: ${factionId}`);

  const result = await pool.query(
    `SELECT * FROM reputation_factions WHERE id = $1`,
    [factionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    homeDistrict: row.home_district,
    alliedDistricts: row.allied_districts || [],
    valuesLoyalty: row.values_loyalty,
    valuesViolence: row.values_violence,
    valuesBusiness: row.values_business,
    allies: row.allies || [],
    enemies: row.enemies || [],
    icon: row.icon || '👥',
    color: row.color || '#6b7280',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get all factions
 */
export async function getAllFactions(): Promise<Faction[]> {
  console.log(`[ReputationService] Getting all factions`);

  const result = await pool.query(
    `SELECT * FROM reputation_factions ORDER BY name`
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    homeDistrict: row.home_district,
    alliedDistricts: row.allied_districts || [],
    valuesLoyalty: row.values_loyalty,
    valuesViolence: row.values_violence,
    valuesBusiness: row.values_business,
    allies: row.allies || [],
    enemies: row.enemies || [],
    icon: row.icon || '👥',
    color: row.color || '#6b7280',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Get factions operating in a district
 */
export async function getFactionsInDistrict(districtId: string): Promise<Faction[]> {
  console.log(`[ReputationService] Getting factions in district: ${districtId}`);

  const result = await pool.query(
    `SELECT * FROM reputation_factions
     WHERE home_district = $1
        OR $1 = ANY(allied_districts)
     ORDER BY name`,
    [districtId]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    homeDistrict: row.home_district,
    alliedDistricts: row.allied_districts || [],
    valuesLoyalty: row.values_loyalty,
    valuesViolence: row.values_violence,
    valuesBusiness: row.values_business,
    allies: row.allies || [],
    enemies: row.enemies || [],
    icon: row.icon || '👥',
    color: row.color || '#6b7280',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

// =============================================================================
// REPUTATION HISTORY
// =============================================================================

/**
 * Get reputation event history for a player
 */
export async function getReputationHistory(
  playerId: string,
  limit: number = 50,
  reputationType?: ReputationType,
  targetId?: string
): Promise<{
  events: {
    id: string;
    reputationType: ReputationType;
    targetId: string;
    dimension: ReputationDimension;
    changeAmount: number;
    oldValue: number;
    newValue: number;
    reason: string;
    createdAt: Date;
  }[];
}> {
  console.log(`[ReputationService] Getting reputation history for player: ${playerId}`);

  let query = `
    SELECT id, reputation_type, target_id, dimension, change_amount, old_value, new_value, reason, created_at
    FROM reputation_events
    WHERE player_id = $1
  `;
  const params: (string | number)[] = [playerId];

  if (reputationType) {
    params.push(reputationType);
    query += ` AND reputation_type = $${params.length}`;
  }

  if (targetId) {
    params.push(targetId);
    query += ` AND target_id = $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);

  return {
    events: result.rows.map(row => ({
      id: row.id,
      reputationType: row.reputation_type,
      targetId: row.target_id,
      dimension: row.dimension,
      changeAmount: row.change_amount,
      oldValue: row.old_value,
      newValue: row.new_value,
      reason: row.reason,
      createdAt: row.created_at
    }))
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Decay heat for all reputations (to be called by scheduled job)
 */
export async function decayAllHeat(decayAmount: number = 1): Promise<number> {
  console.log(`[ReputationService] Decaying heat by ${decayAmount}`);

  const result = await pool.query(
    `UPDATE player_reputations
     SET heat = GREATEST(0, heat - $1)
     WHERE heat > 0
     RETURNING id`,
    [decayAmount]
  );

  const count = result.rows.length;
  console.log(`[ReputationService] Decayed heat for ${count} reputation records`);
  return count;
}

/**
 * Get reputation modifiers based on faction values
 */
export function getReputationModifiers(
  faction: Faction,
  action: 'violence' | 'business' | 'loyalty' | 'betrayal'
): ReputationChange {
  const modifiers: ReputationChange = {};

  switch (action) {
    case 'violence':
      if (faction.valuesViolence) {
        modifiers.respect = 5;
        modifiers.fear = 10;
      } else {
        modifiers.respect = -3;
        modifiers.trust = -5;
      }
      break;

    case 'business':
      if (faction.valuesBusiness) {
        modifiers.respect = 8;
        modifiers.trust = 5;
      } else {
        modifiers.respect = 2;
      }
      break;

    case 'loyalty':
      if (faction.valuesLoyalty) {
        modifiers.trust = 15;
        modifiers.respect = 5;
      } else {
        modifiers.trust = 5;
      }
      break;

    case 'betrayal':
      if (faction.valuesLoyalty) {
        modifiers.trust = -30;
        modifiers.respect = -20;
      } else {
        modifiers.trust = -15;
        modifiers.respect = -5;
      }
      break;
  }

  return modifiers;
}

export default {
  calculateStanding,
  calculateOverallStanding,
  ensureReputationExists,
  getReputation,
  getOrCreateReputation,
  getReputationWeb,
  modifyReputation,
  propagateReputation,
  getFaction,
  getAllFactions,
  getFactionsInDistrict,
  getReputationHistory,
  decayAllHeat,
  getReputationModifiers
};
