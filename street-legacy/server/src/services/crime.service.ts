/**
 * Crime Service
 * Server-side authoritative crime execution with mini-game validation
 */

import pool from '../db/connection.js';
import { withTransaction, lockRowForUpdate } from '../db/transaction.js';
import { PoolClient } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface MiniGameResult {
  success: boolean;
  score: number;
  perfectRun?: boolean;
  curveballsSurvived?: number;
  timeTaken?: number;  // milliseconds
  gameType?: string;
}

export interface OfflineSubmission {
  timestamp: number;
  localResult: {
    success: boolean;
    cashGained: number;
    xpGained: number;
    heatGained: number;
  };
}

export interface MiniGameValidation {
  accepted: boolean;
  bonusApplied: number;  // percentage bonus (0-20)
  reason?: string;
}

export interface CrimeExecutionResult {
  crimeSuccess: boolean;
  cashGained: number;
  xpGained: number;
  heatGained: number;
  caught: boolean;
  jailUntil: string | null;
  leveledUp: boolean;
  newLevel: number;
  player: {
    stamina: number;
    focus: number;
    heat: number;
    cash: number;
    xp: number;
    level: number;
    inJail: boolean;
    jailReleaseAt: string | null;
  };
  miniGameValidation?: MiniGameValidation;
  offlineReconciliation?: {
    serverDiffered: boolean;
    adjustments: {
      cash: number;
      xp: number;
      heat: number;
    };
  };
}

// Mini-game plausibility thresholds (minimum time in ms)
const MINIGAME_MIN_TIMES: Record<string, number> = {
  pickpocket: 2000,
  mugging: 3000,
  car_theft: 5000,
  bank_heist: 8000,
  default: 2000
};

// Maximum score typically achievable
const MINIGAME_MAX_SCORE = 100;

// Maximum bonus from mini-game (percentage)
const MAX_MINIGAME_BONUS = 20;

// ============================================================================
// MINI-GAME VALIDATION
// ============================================================================

/**
 * Validate mini-game result for plausibility
 */
export async function validateMiniGameResult(
  playerId: number,
  crimeId: string,
  miniGameResult: MiniGameResult
): Promise<MiniGameValidation> {
  // If no mini-game result, no bonus
  if (!miniGameResult) {
    return { accepted: false, bonusApplied: 0, reason: 'No mini-game result provided' };
  }

  // Check if mini-game was even successful
  if (!miniGameResult.success) {
    return { accepted: false, bonusApplied: 0, reason: 'Mini-game failed' };
  }

  // Validate time plausibility
  const minTime = MINIGAME_MIN_TIMES[crimeId] || MINIGAME_MIN_TIMES.default;
  if (miniGameResult.timeTaken && miniGameResult.timeTaken < minTime) {
    // Suspiciously fast - reject bonus but log for review
    console.warn(`[CrimeService] Suspicious mini-game time for player ${playerId}: ${miniGameResult.timeTaken}ms (min: ${minTime}ms)`);
    return {
      accepted: false,
      bonusApplied: 0,
      reason: 'Completion time too fast'
    };
  }

  // Validate score is within bounds
  const score = Math.min(miniGameResult.score, MINIGAME_MAX_SCORE);
  if (score < 0) {
    return { accepted: false, bonusApplied: 0, reason: 'Invalid score' };
  }

  // Get player's historical stats for this crime
  const statsResult = await pool.query(
    `SELECT high_score, avg_time_ms, plays FROM minigame_stats
     WHERE player_id = $1 AND crime_id = $2`,
    [playerId, crimeId]
  );

  const stats = statsResult.rows[0];

  // If player has history, check if score is plausible (not > 2x their high score)
  if (stats && stats.high_score > 0) {
    const maxPlausibleScore = Math.min(100, stats.high_score * 2);
    if (score > maxPlausibleScore) {
      console.warn(`[CrimeService] Suspicious mini-game score for player ${playerId}: ${score} (max plausible: ${maxPlausibleScore})`);
      // Still accept but flag - could be legitimate improvement
    }
  }

  // Calculate bonus: score percentage of max bonus
  // Perfect score (100) = 20% bonus, 50 score = 10% bonus
  const bonusApplied = Math.floor((score / MINIGAME_MAX_SCORE) * MAX_MINIGAME_BONUS);

  // Update player's mini-game stats
  await updateMiniGameStats(playerId, crimeId, miniGameResult);

  return {
    accepted: true,
    bonusApplied
  };
}

/**
 * Update player's mini-game statistics
 */
async function updateMiniGameStats(
  playerId: number,
  crimeId: string,
  result: MiniGameResult
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO minigame_stats (player_id, crime_id, game_type, plays, wins, total_score, high_score, avg_time_ms, min_time_ms, last_played)
       VALUES ($1, $2, $3, 1, $4, $5, $5, $6, $6, NOW())
       ON CONFLICT (player_id, crime_id) DO UPDATE SET
         plays = minigame_stats.plays + 1,
         wins = minigame_stats.wins + $4,
         total_score = minigame_stats.total_score + $5,
         high_score = GREATEST(minigame_stats.high_score, $5),
         avg_time_ms = (minigame_stats.avg_time_ms * minigame_stats.plays + $6) / (minigame_stats.plays + 1),
         min_time_ms = LEAST(COALESCE(minigame_stats.min_time_ms, $6), $6),
         last_played = NOW(),
         updated_at = NOW()`,
      [
        playerId,
        crimeId,
        result.gameType || 'unknown',
        result.success ? 1 : 0,
        result.score || 0,
        result.timeTaken || 0
      ]
    );
  } catch (error) {
    console.error('[CrimeService] Failed to update mini-game stats:', error);
    // Non-fatal - continue with crime execution
  }
}

// ============================================================================
// OFFLINE SUBMISSION HANDLING
// ============================================================================

/**
 * Validate offline submission timestamp
 */
export function validateOfflineTimestamp(timestamp: number): { valid: boolean; reason?: string } {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (timestamp > now) {
    return { valid: false, reason: 'Future timestamp not allowed' };
  }

  if (now - timestamp > maxAge) {
    return { valid: false, reason: 'Submission too old (>24 hours)' };
  }

  return { valid: true };
}

/**
 * Log offline action for audit
 */
export async function logOfflineAction(
  playerId: number,
  actionType: string,
  actionData: any,
  localResult: any,
  serverResult: any,
  offlineTimestamp: number,
  reconciliation?: any
): Promise<void> {
  try {
    const differed = JSON.stringify(localResult) !== JSON.stringify(serverResult);

    await pool.query(
      `INSERT INTO offline_action_log
       (player_id, action_type, action_data, local_result, server_result, offline_timestamp, result_differed, reconciliation_applied)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), $7, $8)`,
      [
        playerId,
        actionType,
        JSON.stringify(actionData),
        JSON.stringify(localResult),
        JSON.stringify(serverResult),
        offlineTimestamp,
        differed,
        reconciliation ? JSON.stringify(reconciliation) : null
      ]
    );
  } catch (error) {
    console.error('[CrimeService] Failed to log offline action:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get equipment bonuses for a player
 */
async function getEquipmentBonuses(client: PoolClient, playerId: number, crimeCategory?: string): Promise<{
  successBonus: number;
  payoutBonus: number;
  cooldownBonus: number;
}> {
  const result = await client.query(
    `SELECT i.bonus_type, i.bonus_value, i.crime_category
     FROM player_inventory pi
     JOIN items i ON pi.item_id = i.id
     WHERE pi.player_id = $1 AND pi.equipped = true`,
    [playerId]
  );

  let successBonus = 0;
  let payoutBonus = 0;
  let cooldownBonus = 0;

  for (const item of result.rows) {
    if (item.bonus_type === 'success_rate') {
      successBonus += item.bonus_value;
    } else if (item.bonus_type === 'payout') {
      payoutBonus += item.bonus_value;
    } else if (item.bonus_type === 'cooldown') {
      cooldownBonus += item.bonus_value;
    } else if (item.bonus_type === 'crime_specific' && crimeCategory === item.crime_category) {
      successBonus += item.bonus_value;
    }
  }

  return { successBonus, payoutBonus, cooldownBonus };
}

/**
 * Calculate XP required for next level
 */
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Check if player leveled up and calculate new level
 */
function checkLevelUp(currentLevel: number, currentXp: number, xpGained: number): {
  leveledUp: boolean;
  newLevel: number;
  newXp: number;
} {
  let newXp = currentXp + xpGained;
  let newLevel = currentLevel;
  let leveledUp = false;

  while (newXp >= xpForLevel(newLevel + 1)) {
    newXp -= xpForLevel(newLevel + 1);
    newLevel++;
    leveledUp = true;
  }

  return { leveledUp, newLevel, newXp };
}

// ============================================================================
// MAIN CRIME EXECUTION
// ============================================================================

/**
 * Execute a crime with server-side authority
 */
export async function executeCrime(
  playerId: number,
  crimeId: string | number,
  miniGameResult?: MiniGameResult,
  offlineSubmission?: OfflineSubmission
): Promise<CrimeExecutionResult> {
  // Validate offline submission if present
  if (offlineSubmission) {
    const timestampValidation = validateOfflineTimestamp(offlineSubmission.timestamp);
    if (!timestampValidation.valid) {
      throw new Error(`Offline submission rejected: ${timestampValidation.reason}`);
    }
  }

  // Validate mini-game result if present
  let miniGameValidation: MiniGameValidation | undefined;
  if (miniGameResult) {
    miniGameValidation = await validateMiniGameResult(playerId, String(crimeId), miniGameResult);
  }

  // Execute crime in transaction
  return withTransaction(async (client) => {
    // Get crime definition
    const crimeResult = await client.query(
      `SELECT id, name, category,
              COALESCE(required_level, 1) as min_level,
              COALESCE(payout_min, 50) as min_payout,
              COALESCE(payout_max, 200) as max_payout,
              COALESCE(success_rate, 70) as base_success_rate,
              COALESCE(heat_min, 3) as heat_min,
              COALESCE(heat_max, 10) as heat_max,
              COALESCE(energy_cost, 5) as stamina_cost,
              COALESCE(cooldown_seconds, 30) as cooldown_seconds,
              COALESCE(cooldown_seconds / 60, 5) as jail_minutes,
              COALESCE(xp_reward, 10) as xp_reward
       FROM crime_types WHERE id = $1`,
      [crimeId]
    );

    const crime = crimeResult.rows[0];
    if (!crime) {
      throw new Error(`Crime '${crimeId}' not found`);
    }

    // Lock and get player
    const playerResult = await client.query(
      `SELECT p.*, d.police_presence, d.wealth
       FROM players p
       LEFT JOIN districts d ON p.current_district = d.id
       WHERE p.id = $1
       FOR UPDATE OF p`,
      [playerId]
    );

    const player = playerResult.rows[0];
    if (!player) {
      throw new Error('Player not found');
    }

    const isMaster = player.is_master === true;

    // Check jail status
    if (player.in_jail && !isMaster) {
      if (!player.jail_release_at || new Date(player.jail_release_at) > new Date()) {
        throw new Error('Cannot commit crimes while in jail');
      }
    }

    // Check level requirement
    if (player.level < crime.min_level && !isMaster) {
      throw new Error(`Requires level ${crime.min_level}`);
    }

    // Check stamina
    const staminaCost = crime.stamina_cost || 5;
    const playerStamina = player.stamina ?? player.energy ?? 100;
    if (playerStamina < staminaCost && !isMaster) {
      throw new Error('Not enough stamina');
    }

    // Check cooldown
    if (!isMaster) {
      const cooldownResult = await client.query(
        `SELECT available_at FROM player_cooldowns
         WHERE player_id = $1 AND crime_id = $2 AND available_at > NOW()`,
        [playerId, crimeId]
      );
      if (cooldownResult.rows.length > 0) {
        throw new Error('Crime on cooldown');
      }
    }

    // Get equipment bonuses
    const equipBonuses = await getEquipmentBonuses(client, playerId, crime.category);

    // Calculate success rate
    let successRate: number;
    let success: boolean;

    if (isMaster) {
      successRate = 100;
      success = true;
    } else {
      const policePresence = player.police_presence || 3;
      const policeModifier = 1 - (policePresence / 200);

      successRate = crime.base_success_rate * policeModifier;
      successRate += equipBonuses.successBonus;

      // Apply mini-game bonus if validated
      if (miniGameValidation?.accepted) {
        successRate += miniGameValidation.bonusApplied;
      }

      successRate = Math.min(95, successRate); // Cap at 95%

      // Server-side roll
      const roll = Math.random() * 100;
      success = roll < successRate;
    }

    // Calculate results
    let cashGained = 0;
    let xpGained = 0;
    let heatGained = 0;
    let caught = false;
    let jailUntil: Date | null = null;

    if (success) {
      // Calculate payout
      const basePayout = crime.min_payout + Math.random() * (crime.max_payout - crime.min_payout);
      const wealthModifier = (player.wealth || 5) / 5;
      const payoutMultiplier = 1 + (equipBonuses.payoutBonus / 100);

      cashGained = Math.floor(basePayout * wealthModifier * payoutMultiplier);
      xpGained = crime.xp_reward || Math.floor(crime.min_level * 10 + cashGained / 10);

      // Calculate heat
      heatGained = crime.heat_min + Math.random() * (crime.heat_max - crime.heat_min);
    } else {
      // Failure - check for arrest
      const policePresence = player.police_presence || 3;
      const arrestChance = (policePresence / 10) * 0.5;
      caught = Math.random() < arrestChance;

      if (caught) {
        jailUntil = new Date(Date.now() + crime.jail_minutes * 60 * 1000);
        heatGained = crime.heat_max + Math.random() * 10;
      } else {
        heatGained = crime.heat_min / 2;
      }
    }

    // Round heat
    heatGained = Math.floor(heatGained);

    // Check level up
    const levelCheck = checkLevelUp(player.level, player.xp || 0, xpGained);

    // Calculate new values
    const newStamina = Math.max(0, playerStamina - staminaCost);
    const newCash = (player.cash || 0) + cashGained;
    const newHeat = Math.min(100, (player.heat || 0) + heatGained);
    const newXp = levelCheck.newXp;
    const newLevel = levelCheck.newLevel;
    const newTotalEarnings = (player.total_earnings || 0) + cashGained;

    // Update player
    await client.query(
      `UPDATE players SET
        stamina = $1,
        cash = $2,
        heat = $3,
        xp = $4,
        level = $5,
        total_earnings = $6,
        in_jail = $7,
        jail_release_at = $8,
        updated_at = NOW()
       WHERE id = $9`,
      [
        newStamina,
        newCash,
        newHeat,
        newXp,
        newLevel,
        newTotalEarnings,
        caught,
        jailUntil,
        playerId
      ]
    );

    // Set cooldown
    const cooldownSeconds = Math.max(1, crime.cooldown_seconds - equipBonuses.cooldownBonus);
    await client.query(
      `INSERT INTO player_cooldowns (player_id, crime_id, available_at)
       VALUES ($1, $2, NOW() + INTERVAL '${cooldownSeconds} seconds')
       ON CONFLICT (player_id, crime_id) DO UPDATE SET available_at = NOW() + INTERVAL '${cooldownSeconds} seconds'`,
      [playerId, crimeId]
    );

    // Build result
    const result: CrimeExecutionResult = {
      crimeSuccess: success,
      cashGained,
      xpGained,
      heatGained,
      caught,
      jailUntil: jailUntil?.toISOString() || null,
      leveledUp: levelCheck.leveledUp,
      newLevel,
      player: {
        stamina: newStamina,
        focus: player.focus || 100,
        heat: newHeat,
        cash: newCash,
        xp: newXp,
        level: newLevel,
        inJail: caught,
        jailReleaseAt: jailUntil?.toISOString() || null
      },
      miniGameValidation
    };

    // Handle offline reconciliation
    if (offlineSubmission) {
      const localResult = offlineSubmission.localResult;
      const serverDiffered =
        localResult.success !== success ||
        localResult.cashGained !== cashGained ||
        Math.abs(localResult.heatGained - heatGained) > 5;

      result.offlineReconciliation = {
        serverDiffered,
        adjustments: {
          cash: cashGained - localResult.cashGained,
          xp: xpGained - localResult.xpGained,
          heat: heatGained - localResult.heatGained
        }
      };

      // Log for audit
      await logOfflineAction(
        playerId,
        'crime',
        { crimeId, miniGameResult },
        localResult,
        { success, cashGained, xpGained, heatGained },
        offlineSubmission.timestamp,
        result.offlineReconciliation
      );
    }

    return result;
  });
}

export default {
  executeCrime,
  validateMiniGameResult,
  validateOfflineTimestamp,
  logOfflineAction
};
