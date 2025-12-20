/**
 * Generational Continuity Service
 * Handles character endings and heir inheritance for dynasty gameplay
 */

import pool from '../db/connection.js';
import {
  EndingType,
  HeirType,
  SuccessionPlan,
  CharacterEnding,
  PlayerLineage,
  DynastyAchievement,
  Dynasty,
  DynastyMember,
  Inheritance,
  LineageChainEntry,
  SuccessionPlanRow,
  CharacterEndingRow,
  PlayerLineageRow,
  DynastyAchievementRow,
  DynastyStatsRow,
  CreateSuccessionPlanRequest,
  EndCharacterRequest,
  rowToSuccessionPlan,
  rowToCharacterEnding,
  rowToPlayerLineage,
  rowToDynastyAchievement,
  DEFAULT_TRANSFER_PERCENTS,
  TRANSFER_PERCENT_LIMITS,
  getRandomEndingDescription
} from '../types/generationalContinuity.types.js';
import { modifyReputation } from './reputationWeb.service.js';

// =============================================================================
// SUCCESSION PLAN MANAGEMENT
// =============================================================================

/**
 * Get a player's current succession plan
 */
export async function getSuccessionPlan(playerId: string): Promise<SuccessionPlan | null> {
  const result = await pool.query<SuccessionPlanRow>(
    `SELECT
      sp.*,
      p.username as player_name,
      hp.username as heir_player_name
    FROM succession_plans sp
    JOIN players p ON p.id = sp.player_id
    LEFT JOIN players hp ON hp.id = sp.heir_player_id
    WHERE sp.player_id = $1`,
    [playerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToSuccessionPlan(result.rows[0]);
}

/**
 * Create or update a succession plan
 */
export async function createOrUpdateSuccessionPlan(
  playerId: string,
  params: CreateSuccessionPlanRequest
): Promise<SuccessionPlan | null> {
  const {
    heirType,
    heirPlayerId,
    heirNpcName,
    propertyTransferPercent = DEFAULT_TRANSFER_PERCENTS.property,
    cashTransferPercent = DEFAULT_TRANSFER_PERCENTS.cash,
    reputationTransferPercent = DEFAULT_TRANSFER_PERCENTS.reputation,
    crewPositionTransfer = true,
    notes
  } = params;

  // Validate heir_player_id is not self
  if (heirPlayerId && heirPlayerId === playerId) {
    console.log(`[Succession] Cannot designate self as heir: ${playerId}`);
    return null;
  }

  // If player_heir, validate heir exists
  if (heirType === 'player_heir') {
    if (!heirPlayerId) {
      console.log(`[Succession] player_heir requires heirPlayerId`);
      return null;
    }

    const heirCheck = await pool.query(
      `SELECT id FROM players WHERE id = $1`,
      [heirPlayerId]
    );

    if (heirCheck.rows.length === 0) {
      console.log(`[Succession] Heir player not found: ${heirPlayerId}`);
      return null;
    }
  }

  // Validate NPC name for NPC heirs
  if ((heirType === 'npc_family' || heirType === 'npc_lieutenant') && !heirNpcName) {
    console.log(`[Succession] NPC heir types require heirNpcName`);
    return null;
  }

  // Validate transfer percentages
  const { min, max } = TRANSFER_PERCENT_LIMITS;
  if (propertyTransferPercent < min || propertyTransferPercent > max ||
      cashTransferPercent < min || cashTransferPercent > max ||
      reputationTransferPercent < min || reputationTransferPercent > max) {
    console.log(`[Succession] Transfer percentages must be between ${min} and ${max}`);
    return null;
  }

  // Upsert succession plan
  const result = await pool.query<SuccessionPlanRow>(
    `INSERT INTO succession_plans (
      player_id, heir_type, heir_player_id, heir_npc_name,
      property_transfer_percent, cash_transfer_percent, reputation_transfer_percent,
      crew_position_transfer, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (player_id) DO UPDATE SET
      heir_type = EXCLUDED.heir_type,
      heir_player_id = EXCLUDED.heir_player_id,
      heir_npc_name = EXCLUDED.heir_npc_name,
      property_transfer_percent = EXCLUDED.property_transfer_percent,
      cash_transfer_percent = EXCLUDED.cash_transfer_percent,
      reputation_transfer_percent = EXCLUDED.reputation_transfer_percent,
      crew_position_transfer = EXCLUDED.crew_position_transfer,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *`,
    [
      playerId,
      heirType,
      heirPlayerId || null,
      heirNpcName || null,
      propertyTransferPercent,
      cashTransferPercent,
      reputationTransferPercent,
      crewPositionTransfer,
      notes || null
    ]
  );

  console.log(`[Succession] Updated plan for ${playerId}: ${heirType}`);

  return getSuccessionPlan(playerId);
}

/**
 * Validate a succession plan
 */
export function validateSuccessionPlan(
  plan: SuccessionPlan
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { min, max } = TRANSFER_PERCENT_LIMITS;

  // Check heir designation
  if (plan.heirType === 'player_heir' && !plan.heirPlayerId) {
    errors.push('Player heir type requires a designated heir player');
  }

  if ((plan.heirType === 'npc_family' || plan.heirType === 'npc_lieutenant') && !plan.heirNpcName) {
    errors.push('NPC heir types require an NPC name');
  }

  // Check transfer percentages
  if (plan.propertyTransferPercent < min || plan.propertyTransferPercent > max) {
    errors.push(`Property transfer percent must be between ${min} and ${max}`);
  }

  if (plan.cashTransferPercent < min || plan.cashTransferPercent > max) {
    errors.push(`Cash transfer percent must be between ${min} and ${max}`);
  }

  if (plan.reputationTransferPercent < min || plan.reputationTransferPercent > max) {
    errors.push(`Reputation transfer percent must be between ${min} and ${max}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Delete a succession plan
 */
export async function deleteSuccessionPlan(playerId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM succession_plans WHERE player_id = $1 RETURNING id`,
    [playerId]
  );

  return (result.rowCount ?? 0) > 0;
}

// =============================================================================
// CHARACTER ENDING
// =============================================================================

/**
 * End a character and optionally execute succession
 */
export async function endCharacter(
  playerId: string,
  params: EndCharacterRequest
): Promise<{
  ending: CharacterEnding;
  succession?: { inheritance: Inheritance; heirId?: string };
}> {
  const {
    endingType,
    description,
    causedByPlayerId,
    executeSuccession: shouldExecute = true
  } = params;

  // Get player stats for final snapshot
  const playerResult = await pool.query(
    `SELECT
      p.*,
      (SELECT COUNT(*) FROM properties WHERE owner_id = p.id) as property_count,
      (SELECT COALESCE(SUM(value), 0) FROM properties WHERE owner_id = p.id) as property_value
    FROM players p
    WHERE p.id = $1`,
    [playerId]
  );

  if (playerResult.rows.length === 0) {
    throw new Error('Player not found');
  }

  const player = playerResult.rows[0];

  // Calculate net worth
  const cash = Number(player.cash) || 0;
  const propertyValue = Number(player.property_value) || 0;
  const netWorth = cash + propertyValue;

  // Build final stats snapshot
  const finalStats = {
    cash: player.cash,
    level: player.level,
    experience: player.experience,
    health: player.health,
    properties_owned: Number(player.property_count)
  };

  // Get life chapter and age if available
  let lifeChapter = null;
  let ageAtEnding = null;
  try {
    if (player.current_chapter) {
      lifeChapter = player.current_chapter;
    }
    if (player.birth_date) {
      const birthDate = new Date(player.birth_date);
      const now = new Date();
      ageAtEnding = now.getFullYear() - birthDate.getFullYear();
    }
  } catch (e) {
    // Fields may not exist
  }

  // Generate description if not provided
  const endingDescription = description || getRandomEndingDescription(endingType);

  // Insert character ending
  const endingResult = await pool.query<CharacterEndingRow>(
    `INSERT INTO character_endings (
      player_id, ending_type, ending_description, final_stats,
      final_net_worth, properties_owned, life_chapter,
      age_at_ending, caused_by_player_id, succession_executed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
    RETURNING *`,
    [
      playerId,
      endingType,
      endingDescription,
      JSON.stringify(finalStats),
      netWorth,
      Number(player.property_count),
      lifeChapter,
      ageAtEnding,
      causedByPlayerId || null
    ]
  );

  const ending = rowToCharacterEnding(endingResult.rows[0]);

  console.log(`[Succession] Character ${playerId} ended: ${endingType}`);

  // Execute succession if requested and plan exists
  let successionResult: { inheritance: Inheritance; heirId?: string } | undefined;

  if (shouldExecute) {
    const plan = await getSuccessionPlan(playerId);

    if (plan && plan.heirType === 'player_heir' && plan.heirPlayerId) {
      successionResult = await executeSuccession(ending.id, playerId) || undefined;
    } else if (plan && (plan.heirType === 'npc_family' || plan.heirType === 'npc_lieutenant')) {
      // Handle NPC succession
      const inheritance = await calculateInheritance(playerId, plan);
      await handleNpcSuccession(playerId, plan, inheritance, ending.id);
      successionResult = { inheritance };
    }
  }

  return { ending, succession: successionResult };
}

/**
 * Execute succession for a character ending
 */
export async function executeSuccession(
  endingId: string,
  playerId: string
): Promise<{ inheritance: Inheritance; heirId?: string } | null> {
  // Get succession plan
  const plan = await getSuccessionPlan(playerId);

  if (!plan) {
    console.log(`[Succession] No succession plan for player ${playerId}`);
    return null;
  }

  // Validate plan
  const validation = validateSuccessionPlan(plan);
  if (!validation.valid) {
    console.log(`[Succession] Invalid plan: ${validation.errors.join(', ')}`);
    return null;
  }

  // Calculate inheritance
  const inheritance = await calculateInheritance(playerId, plan);

  let heirId: string | undefined;

  // Handle based on heir type
  if (plan.heirType === 'player_heir' && plan.heirPlayerId) {
    const success = await transferToHeir(playerId, plan.heirPlayerId, inheritance, endingId);
    if (success) {
      heirId = plan.heirPlayerId;
    }
  } else if (plan.heirType === 'npc_family' || plan.heirType === 'npc_lieutenant') {
    await handleNpcSuccession(playerId, plan, inheritance, endingId);
  }

  // Update ending succession_executed
  await pool.query(
    `UPDATE character_endings
     SET succession_executed = TRUE, heir_player_id = $1
     WHERE id = $2`,
    [heirId || null, endingId]
  );

  console.log(`[Succession] Succession executed for ending ${endingId}`);

  return { inheritance, heirId };
}

/**
 * Calculate inheritance based on player assets and plan percentages
 */
export async function calculateInheritance(
  playerId: string,
  plan: SuccessionPlan
): Promise<Inheritance> {
  // Get player's properties
  const propertiesResult = await pool.query(
    `SELECT id, name, value FROM properties WHERE owner_id = $1`,
    [playerId]
  );

  const allProperties = propertiesResult.rows;
  const propertyPercent = plan.propertyTransferPercent / 100;
  const propertyCount = Math.floor(allProperties.length * propertyPercent);
  const propertiesToTransfer = allProperties.slice(0, propertyCount);

  // Get player's cash
  const cashResult = await pool.query(
    `SELECT cash FROM players WHERE id = $1`,
    [playerId]
  );

  const totalCash = Number(cashResult.rows[0]?.cash) || 0;
  const cashToTransfer = Math.floor(totalCash * (plan.cashTransferPercent / 100));

  // Calculate reputation bonus
  const reputationBonus = Math.floor(50 * (plan.reputationTransferPercent / 100));

  // Get crew position if applicable
  let crewPosition: Inheritance['crewPosition'] = undefined;

  if (plan.crewPositionTransfer) {
    const crewResult = await pool.query(
      `SELECT cm.crew_id, c.name as crew_name, cm.role
       FROM crew_members cm
       JOIN crews c ON c.id = cm.crew_id
       WHERE cm.player_id = $1
         AND cm.role IN ('leader', 'boss', 'underboss')
       LIMIT 1`,
      [playerId]
    );

    if (crewResult.rows.length > 0) {
      const crew = crewResult.rows[0];
      crewPosition = {
        crewId: String(crew.crew_id),
        crewName: crew.crew_name,
        rank: crew.role
      };
    }
  }

  // Calculate total value
  const propertyValue = propertiesToTransfer.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const totalValue = cashToTransfer + propertyValue;

  return {
    properties: propertiesToTransfer.map(p => String(p.id)),
    propertyCount: propertiesToTransfer.length,
    cash: cashToTransfer,
    reputationBonus,
    totalValue,
    crewPosition
  };
}

/**
 * Transfer inheritance to heir player
 */
export async function transferToHeir(
  predecessorId: string,
  heirPlayerId: string,
  inheritance: Inheritance,
  endingId: string
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Transfer properties
    if (inheritance.properties.length > 0) {
      await client.query(
        `UPDATE properties
         SET owner_id = $1, updated_at = NOW()
         WHERE id = ANY($2::INTEGER[]) AND owner_id = $3`,
        [heirPlayerId, inheritance.properties.map(Number), predecessorId]
      );
    }

    // Transfer cash
    if (inheritance.cash > 0) {
      // Deduct from predecessor
      await client.query(
        `UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id = $2`,
        [inheritance.cash, predecessorId]
      );

      // Add to heir
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [inheritance.cash, heirPlayerId]
      );
    }

    // Transfer crew position
    if (inheritance.crewPosition) {
      await client.query(
        `UPDATE crew_members
         SET player_id = $1
         WHERE player_id = $2 AND role = $3`,
        [heirPlayerId, predecessorId, inheritance.crewPosition.rank]
      );
    }

    // Apply reputation bonus
    if (inheritance.reputationBonus > 0) {
      try {
        await modifyReputation(
          heirPlayerId,
          'district',
          '1', // Default district
          { respect: inheritance.reputationBonus },
          `Inherited reputation from predecessor`
        );
      } catch (e) {
        // Reputation system may not be available
        console.log(`[Succession] Could not apply reputation bonus`);
      }
    }

    // Get predecessor's lineage info for dynasty
    const predecessorLineageResult = await client.query<PlayerLineageRow>(
      `SELECT * FROM player_lineage WHERE player_id = $1`,
      [predecessorId]
    );

    const predecessorLineage = predecessorLineageResult.rows[0];
    const newGeneration = predecessorLineage ? predecessorLineage.generation + 1 : 2;
    const dynastyName = predecessorLineage?.dynasty_name ||
      (await client.query(`SELECT 'Dynasty_' || username FROM players WHERE id = $1`, [predecessorId])).rows[0]?.column1 ||
      `Dynasty_${predecessorId}`;

    // Create or update lineage record for heir
    await client.query(
      `INSERT INTO player_lineage (
        player_id, predecessor_player_id, predecessor_ending_id,
        generation, inherited_properties, inherited_cash,
        inherited_reputation_percent, inherited_crew_position,
        dynasty_name, lineage_started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (player_id) DO UPDATE SET
        predecessor_player_id = EXCLUDED.predecessor_player_id,
        predecessor_ending_id = EXCLUDED.predecessor_ending_id,
        generation = EXCLUDED.generation,
        inherited_properties = EXCLUDED.inherited_properties,
        inherited_cash = EXCLUDED.inherited_cash,
        inherited_reputation_percent = EXCLUDED.inherited_reputation_percent,
        inherited_crew_position = EXCLUDED.inherited_crew_position,
        dynasty_name = EXCLUDED.dynasty_name`,
      [
        heirPlayerId,
        predecessorId,
        endingId,
        newGeneration,
        inheritance.properties.map(Number),
        inheritance.cash,
        inheritance.reputationBonus,
        !!inheritance.crewPosition,
        dynastyName
      ]
    );

    // Check for dynasty achievements
    await checkDynastyAchievements(client, dynastyName, newGeneration, heirPlayerId);

    await client.query('COMMIT');

    console.log(`[Succession] Transferred inheritance to heir ${heirPlayerId}`);

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Succession] Transfer failed:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Handle NPC succession (archive assets for potential future claim)
 */
export async function handleNpcSuccession(
  playerId: string,
  plan: SuccessionPlan,
  inheritance: Inheritance,
  endingId: string
): Promise<void> {
  // For NPC heirs, we create a record but don't transfer to a real player
  // Assets could be held in escrow or archived

  console.log(`[Succession] NPC succession for ${playerId}: ${plan.heirNpcName}`);

  // Get dynasty name
  const lineageResult = await pool.query<PlayerLineageRow>(
    `SELECT dynasty_name FROM player_lineage WHERE player_id = $1`,
    [playerId]
  );

  const dynastyName = lineageResult.rows[0]?.dynasty_name || `Dynasty_${playerId}`;

  // Record the NPC succession in a log or world memory
  // This could be expanded to create a claimable inheritance system

  // Mark the ending as having had succession processed
  await pool.query(
    `UPDATE character_endings
     SET succession_executed = TRUE
     WHERE id = $1`,
    [endingId]
  );

  console.log(`[Succession] NPC ${plan.heirNpcName} takes over dynasty ${dynastyName}`);
}

/**
 * Check and award dynasty achievements
 */
async function checkDynastyAchievements(
  client: any,
  dynastyName: string,
  generation: number,
  playerId: string
): Promise<void> {
  // Generation milestones
  const milestones = [
    { gen: 3, type: 'third_generation', desc: 'Dynasty reached third generation' },
    { gen: 5, type: 'fifth_generation', desc: 'Dynasty reached fifth generation - True Legacy' },
    { gen: 10, type: 'tenth_generation', desc: 'Dynasty reached tenth generation - Legendary Family' }
  ];

  for (const milestone of milestones) {
    if (generation === milestone.gen) {
      await client.query(
        `INSERT INTO dynasty_achievements (dynasty_name, achievement_type, description, generation_achieved, player_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [dynastyName, milestone.type, milestone.desc, generation, playerId]
      );
    }
  }
}

// =============================================================================
// LINEAGE & DYNASTY QUERIES
// =============================================================================

/**
 * Get a player's lineage record
 */
export async function getPlayerLineage(playerId: string): Promise<PlayerLineage | null> {
  const result = await pool.query<PlayerLineageRow>(
    `SELECT
      pl.*,
      p.username as player_name,
      pp.username as predecessor_name
    FROM player_lineage pl
    JOIN players p ON p.id = pl.player_id
    LEFT JOIN players pp ON pp.id = pl.predecessor_player_id
    WHERE pl.player_id = $1`,
    [playerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToPlayerLineage(result.rows[0]);
}

/**
 * Get dynasty by name
 */
export async function getDynasty(dynastyName: string): Promise<Dynasty | null> {
  // Get dynasty stats
  const statsResult = await pool.query<DynastyStatsRow>(
    `SELECT
      $1 as dynasty_name,
      MAX(pl.generation)::INTEGER as total_generations,
      (SELECT pl2.generation FROM player_lineage pl2
       WHERE pl2.dynasty_name = $1
       ORDER BY pl2.created_at DESC LIMIT 1)::INTEGER as current_generation,
      COUNT(DISTINCT pl.player_id)::INTEGER as total_members,
      COUNT(DISTINCT pl.player_id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM character_endings ce WHERE ce.player_id = pl.player_id
        )
      )::INTEGER as active_members,
      COALESCE(SUM(pl.inherited_cash), 0)::BIGINT as total_wealth_accumulated,
      (SELECT COUNT(*)::INTEGER FROM properties pr
       JOIN player_lineage pl3 ON pl3.player_id = pr.owner_id
       WHERE pl3.dynasty_name = $1) as total_properties_owned,
      (SELECT COUNT(*)::INTEGER FROM dynasty_achievements da
       WHERE da.dynasty_name = $1) as achievements_count,
      MIN(pl.lineage_started_at) as founded_at,
      MAX(pl.created_at) as latest_succession
    FROM player_lineage pl
    WHERE pl.dynasty_name = $1
    GROUP BY pl.dynasty_name`,
    [dynastyName]
  );

  if (statsResult.rows.length === 0) {
    return null;
  }

  const stats = statsResult.rows[0];

  // Get achievements
  const achievementsResult = await pool.query<DynastyAchievementRow>(
    `SELECT
      da.*,
      p.username as player_name
    FROM dynasty_achievements da
    LEFT JOIN players p ON p.id = da.player_id
    WHERE da.dynasty_name = $1
    ORDER BY da.achieved_at DESC`,
    [dynastyName]
  );

  // Get members
  const membersResult = await pool.query(
    `SELECT
      pl.player_id,
      p.username as player_name,
      pl.generation,
      CASE
        WHEN EXISTS (SELECT 1 FROM character_endings ce WHERE ce.player_id = pl.player_id)
        THEN 'ended'
        ELSE 'active'
      END as status,
      ce.ending_type,
      ce.ended_at
    FROM player_lineage pl
    JOIN players p ON p.id = pl.player_id
    LEFT JOIN character_endings ce ON ce.player_id = pl.player_id
    WHERE pl.dynasty_name = $1
    ORDER BY pl.generation ASC, pl.created_at ASC`,
    [dynastyName]
  );

  // Find current active player
  const activePlayer = membersResult.rows.find(m => m.status === 'active');

  return {
    name: dynastyName,
    totalGenerations: stats.total_generations || 1,
    currentGeneration: stats.current_generation || 1,
    totalWealthAccumulated: Number(stats.total_wealth_accumulated),
    totalPropertiesOwned: stats.total_properties_owned,
    totalMembers: stats.total_members,
    activeMembers: stats.active_members,
    currentActivePlayerId: activePlayer ? String(activePlayer.player_id) : undefined,
    currentActivePlayerName: activePlayer?.player_name,
    achievements: achievementsResult.rows.map(rowToDynastyAchievement),
    members: membersResult.rows.map(row => ({
      playerId: String(row.player_id),
      playerName: row.player_name,
      generation: row.generation,
      status: row.status as 'active' | 'ended',
      endingType: row.ending_type,
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined
    })),
    foundedAt: new Date(stats.founded_at),
    latestSuccession: stats.latest_succession ? new Date(stats.latest_succession) : undefined
  };
}

/**
 * Get a player's dynasty
 */
export async function getPlayerDynasty(playerId: string): Promise<Dynasty | null> {
  const lineage = await getPlayerLineage(playerId);

  if (!lineage?.dynastyName) {
    return null;
  }

  return getDynasty(lineage.dynastyName);
}

/**
 * Get full lineage chain for a player (ancestry)
 */
export async function getLineageChain(playerId: string): Promise<LineageChainEntry[]> {
  const result = await pool.query(
    `WITH RECURSIVE lineage_chain AS (
      SELECT
        pl.generation,
        pl.player_id,
        p.username as player_name,
        NULL::ending_type_enum as ending_type,
        NULL::TIMESTAMPTZ as ended_at,
        pl.inherited_cash,
        COALESCE(array_length(pl.inherited_properties, 1), 0) as inherited_properties,
        pl.predecessor_player_id
      FROM player_lineage pl
      JOIN players p ON p.id = pl.player_id
      WHERE pl.player_id = $1

      UNION ALL

      SELECT
        pl.generation,
        pl.player_id,
        p.username as player_name,
        ce.ending_type,
        ce.ended_at,
        pl.inherited_cash,
        COALESCE(array_length(pl.inherited_properties, 1), 0) as inherited_properties,
        pl.predecessor_player_id
      FROM player_lineage pl
      JOIN players p ON p.id = pl.player_id
      LEFT JOIN character_endings ce ON ce.player_id = pl.player_id
      JOIN lineage_chain lc ON lc.predecessor_player_id = pl.player_id
    )
    SELECT * FROM lineage_chain ORDER BY generation ASC`,
    [playerId]
  );

  return result.rows.map(row => ({
    generation: row.generation,
    playerId: String(row.player_id),
    playerName: row.player_name,
    endingType: row.ending_type,
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    inheritedCash: Number(row.inherited_cash),
    inheritedProperties: row.inherited_properties
  }));
}

/**
 * Get character endings for a player (or all if killed by them)
 */
export async function getCharacterEndings(
  playerId: string,
  options: { asKiller?: boolean; limit?: number } = {}
): Promise<CharacterEnding[]> {
  const { asKiller = false, limit = 50 } = options;

  const whereClause = asKiller
    ? `ce.caused_by_player_id = $1`
    : `ce.player_id = $1`;

  const result = await pool.query<CharacterEndingRow>(
    `SELECT
      ce.*,
      p.username as player_name,
      cp.username as caused_by_player_name
    FROM character_endings ce
    JOIN players p ON p.id = ce.player_id
    LEFT JOIN players cp ON cp.id = ce.caused_by_player_id
    WHERE ${whereClause}
    ORDER BY ce.ended_at DESC
    LIMIT $2`,
    [playerId, limit]
  );

  return result.rows.map(rowToCharacterEnding);
}

/**
 * Get a single character ending
 */
export async function getCharacterEnding(endingId: string): Promise<CharacterEnding | null> {
  const result = await pool.query<CharacterEndingRow>(
    `SELECT
      ce.*,
      p.username as player_name,
      cp.username as caused_by_player_name
    FROM character_endings ce
    JOIN players p ON p.id = ce.player_id
    LEFT JOIN players cp ON cp.id = ce.caused_by_player_id
    WHERE ce.id = $1`,
    [endingId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToCharacterEnding(result.rows[0]);
}

/**
 * Get dynasty achievements
 */
export async function getDynastyAchievements(dynastyName: string): Promise<DynastyAchievement[]> {
  const result = await pool.query<DynastyAchievementRow>(
    `SELECT
      da.*,
      p.username as player_name
    FROM dynasty_achievements da
    LEFT JOIN players p ON p.id = da.player_id
    WHERE da.dynasty_name = $1
    ORDER BY da.achieved_at DESC`,
    [dynastyName]
  );

  return result.rows.map(rowToDynastyAchievement);
}

/**
 * Initialize lineage for a new player (generation 1 founder)
 */
export async function initializeLineage(
  playerId: string,
  dynastyName?: string
): Promise<PlayerLineage | null> {
  const generatedName = dynastyName ||
    (await pool.query(`SELECT 'Dynasty_' || username FROM players WHERE id = $1`, [playerId])).rows[0]?.column1 ||
    `Dynasty_${playerId}`;

  const result = await pool.query<PlayerLineageRow>(
    `INSERT INTO player_lineage (
      player_id, generation, dynasty_name, lineage_started_at
    ) VALUES ($1, 1, $2, NOW())
    ON CONFLICT (player_id) DO NOTHING
    RETURNING *`,
    [playerId, generatedName]
  );

  if (result.rows.length === 0) {
    // Already exists
    return getPlayerLineage(playerId);
  }

  console.log(`[Succession] Initialized lineage for ${playerId} as founder of ${generatedName}`);

  return rowToPlayerLineage(result.rows[0]);
}

/**
 * Get all dynasties with basic stats
 */
export async function getAllDynasties(
  limit: number = 50
): Promise<Array<{ name: string; generations: number; members: number; wealth: number }>> {
  const result = await pool.query(
    `SELECT
      dynasty_name as name,
      MAX(generation) as generations,
      COUNT(DISTINCT player_id) as members,
      COALESCE(SUM(inherited_cash), 0) as wealth
    FROM player_lineage
    WHERE dynasty_name IS NOT NULL
    GROUP BY dynasty_name
    ORDER BY MAX(generation) DESC, wealth DESC
    LIMIT $1`,
    [limit]
  );

  return result.rows.map(row => ({
    name: row.name,
    generations: Number(row.generations),
    members: Number(row.members),
    wealth: Number(row.wealth)
  }));
}

// =============================================================================
// EXPORT SERVICE OBJECT
// =============================================================================

export default {
  // Succession plan management
  getSuccessionPlan,
  createOrUpdateSuccessionPlan,
  validateSuccessionPlan,
  deleteSuccessionPlan,

  // Character ending
  endCharacter,
  executeSuccession,
  calculateInheritance,
  transferToHeir,
  handleNpcSuccession,

  // Lineage & dynasty queries
  getPlayerLineage,
  getDynasty,
  getPlayerDynasty,
  getLineageChain,
  getCharacterEndings,
  getCharacterEnding,
  getDynastyAchievements,
  initializeLineage,
  getAllDynasties
};
