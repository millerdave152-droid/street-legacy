/**
 * Heist Service
 * Server-side authoritative heist planning and execution for solo heists
 */

import pool from '../db/connection.js';
import { withTransaction } from '../db/transaction.js';
import { PoolClient } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface PlanningActivity {
  id: string;
  name: string;
  description: string;
  duration: number;
  energyCost: number;
  cashCost?: number;
  maxLevel: number;
  bonuses: {
    successBonus: number;
    heatReduction: number;
    escapeBonus: number;
  };
}

export interface PlanningBonuses {
  successBonus: number;
  heatReduction: number;
  escapeBonus: number;
}

export interface PlanningSession {
  id: number;
  playerId: number;
  heistId: string;
  startedAt: string;
  expiresAt: string;
  activities: Record<string, number>;
  totalBonuses: PlanningBonuses;
}

export interface HeistExecutionResult {
  heistSuccess: boolean;
  payout: number;
  xpGained: number;
  heatGained: number;
  planningBonusApplied: PlanningBonuses;
  message: string;
  player: {
    cash: number;
    xp: number;
    heat: number;
    level: number;
    stamina: number;
  };
}

// ============================================================================
// PLANNING CONFIGURATION (mirrored from client)
// ============================================================================

export const HEIST_PLANNING_CONFIG = {
  activities: [
    {
      id: 'scout',
      name: 'Scout Location',
      description: 'Case the target for entry points and guard patterns',
      duration: 60,
      energyCost: 15,
      maxLevel: 3,
      bonuses: { successBonus: 5, heatReduction: 0, escapeBonus: 0 }
    },
    {
      id: 'intel',
      name: 'Gather Intel',
      description: 'Research security systems and schedules',
      duration: 45,
      energyCost: 10,
      maxLevel: 2,
      bonuses: { successBonus: 3, heatReduction: 10, escapeBonus: 0 }
    },
    {
      id: 'escape_route',
      name: 'Plan Escape',
      description: 'Map out getaway routes and safe houses',
      duration: 50,
      energyCost: 12,
      maxLevel: 3,
      bonuses: { successBonus: 0, heatReduction: 0, escapeBonus: 15 }
    },
    {
      id: 'equipment',
      name: 'Prep Equipment',
      description: 'Gather and test specialized gear',
      duration: 40,
      energyCost: 8,
      maxLevel: 2,
      bonuses: { successBonus: 4, heatReduction: 5, escapeBonus: 5 }
    },
    {
      id: 'bribe_insider',
      name: 'Bribe Insider',
      description: 'Pay someone on the inside for access',
      duration: 30,
      energyCost: 5,
      cashCost: 1000,
      maxLevel: 1,
      bonuses: { successBonus: 10, heatReduction: 15, escapeBonus: 0 }
    }
  ] as PlanningActivity[],

  minPlanningByDifficulty: {
    1: 0, 2: 0, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 10: 4
  } as Record<number, number>,

  planningDecayHours: 24,

  maxTotalBonuses: {
    successBonus: 30,
    heatReduction: 40,
    escapeBonus: 45
  }
};

// Heist definitions (should match client HEISTS)
const HEISTS: Record<string, { minLevel: number; minPayout: number; maxPayout: number; baseSuccessRate: number; heatGain: number; difficulty: number }> = {
  convenience: { minLevel: 5, minPayout: 500, maxPayout: 1500, baseSuccessRate: 80, heatGain: 15, difficulty: 1 },
  pawn_shop: { minLevel: 8, minPayout: 1500, maxPayout: 4000, baseSuccessRate: 70, heatGain: 20, difficulty: 2 },
  jewelry: { minLevel: 10, minPayout: 2000, maxPayout: 5000, baseSuccessRate: 65, heatGain: 25, difficulty: 2 },
  electronics: { minLevel: 12, minPayout: 3000, maxPayout: 8000, baseSuccessRate: 60, heatGain: 28, difficulty: 3 },
  mansion: { minLevel: 15, minPayout: 8000, maxPayout: 20000, baseSuccessRate: 50, heatGain: 35, difficulty: 3 },
  warehouse: { minLevel: 15, minPayout: 5000, maxPayout: 12000, baseSuccessRate: 55, heatGain: 35, difficulty: 3 },
  train: { minLevel: 20, minPayout: 15000, maxPayout: 40000, baseSuccessRate: 40, heatGain: 45, difficulty: 4 },
  armored: { minLevel: 20, minPayout: 10000, maxPayout: 25000, baseSuccessRate: 45, heatGain: 45, difficulty: 4 },
  museum: { minLevel: 25, minPayout: 30000, maxPayout: 80000, baseSuccessRate: 35, heatGain: 50, difficulty: 5 },
  diamond_exchange: { minLevel: 28, minPayout: 40000, maxPayout: 90000, baseSuccessRate: 32, heatGain: 55, difficulty: 5 },
  bank: { minLevel: 30, minPayout: 50000, maxPayout: 100000, baseSuccessRate: 30, heatGain: 60, difficulty: 5 },
  casino: { minLevel: 35, minPayout: 75000, maxPayout: 200000, baseSuccessRate: 25, heatGain: 70, difficulty: 6 },
  penthouse: { minLevel: 38, minPayout: 80000, maxPayout: 180000, baseSuccessRate: 28, heatGain: 65, difficulty: 6 },
  yacht: { minLevel: 40, minPayout: 100000, maxPayout: 250000, baseSuccessRate: 20, heatGain: 80, difficulty: 7 },
  gold_reserve: { minLevel: 45, minPayout: 200000, maxPayout: 500000, baseSuccessRate: 15, heatGain: 90, difficulty: 8 },
  federal_reserve: { minLevel: 50, minPayout: 500000, maxPayout: 1000000, baseSuccessRate: 10, heatGain: 100, difficulty: 10 }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getActivity(activityId: string): PlanningActivity | undefined {
  return HEIST_PLANNING_CONFIG.activities.find(a => a.id === activityId);
}

function getHeistDef(heistId: string) {
  return HEISTS[heistId];
}

function calculateBonuses(activities: Record<string, number>): PlanningBonuses {
  const bonuses: PlanningBonuses = { successBonus: 0, heatReduction: 0, escapeBonus: 0 };

  for (const [activityId, level] of Object.entries(activities)) {
    const activity = getActivity(activityId);
    if (activity && level > 0) {
      bonuses.successBonus += activity.bonuses.successBonus * level;
      bonuses.heatReduction += activity.bonuses.heatReduction * level;
      bonuses.escapeBonus += activity.bonuses.escapeBonus * level;
    }
  }

  // Cap bonuses
  const caps = HEIST_PLANNING_CONFIG.maxTotalBonuses;
  bonuses.successBonus = Math.min(bonuses.successBonus, caps.successBonus);
  bonuses.heatReduction = Math.min(bonuses.heatReduction, caps.heatReduction);
  bonuses.escapeBonus = Math.min(bonuses.escapeBonus, caps.escapeBonus);

  return bonuses;
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

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
// PLANNING FUNCTIONS
// ============================================================================

/**
 * Start a planning session for a heist
 */
export async function startPlanning(
  playerId: number,
  heistId: string
): Promise<PlanningSession> {
  const heist = getHeistDef(heistId);
  if (!heist) {
    throw new Error(`Heist '${heistId}' not found`);
  }

  return withTransaction(async (client) => {
    // Lock player row
    const playerResult = await client.query(
      `SELECT level FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player) {
      throw new Error('Player not found');
    }

    // Check level requirement
    if (player.level < heist.minLevel) {
      throw new Error(`Requires level ${heist.minLevel}`);
    }

    // Check for existing planning session
    const existingResult = await client.query(
      `SELECT * FROM heist_planning_sessions WHERE player_id = $1 AND heist_id = $2`,
      [playerId, heistId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      // Check if expired
      if (new Date(existing.expires_at) > new Date()) {
        // Return existing session
        return {
          id: existing.id,
          playerId: existing.player_id,
          heistId: existing.heist_id,
          startedAt: existing.started_at,
          expiresAt: existing.expires_at,
          activities: existing.activities || {},
          totalBonuses: existing.total_bonuses || { successBonus: 0, heatReduction: 0, escapeBonus: 0 }
        };
      }
      // Delete expired session
      await client.query(`DELETE FROM heist_planning_sessions WHERE id = $1`, [existing.id]);
    }

    // Create new planning session
    const expiresAt = new Date(Date.now() + HEIST_PLANNING_CONFIG.planningDecayHours * 60 * 60 * 1000);

    const insertResult = await client.query(
      `INSERT INTO heist_planning_sessions (player_id, heist_id, expires_at, activities, total_bonuses)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        playerId,
        heistId,
        expiresAt,
        JSON.stringify({}),
        JSON.stringify({ successBonus: 0, heatReduction: 0, escapeBonus: 0 })
      ]
    );

    const session = insertResult.rows[0];

    return {
      id: session.id,
      playerId: session.player_id,
      heistId: session.heist_id,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      activities: session.activities || {},
      totalBonuses: session.total_bonuses || { successBonus: 0, heatReduction: 0, escapeBonus: 0 }
    };
  });
}

/**
 * Get current planning session for a heist
 */
export async function getPlanning(
  playerId: number,
  heistId: string
): Promise<PlanningSession | null> {
  const result = await pool.query(
    `SELECT * FROM heist_planning_sessions
     WHERE player_id = $1 AND heist_id = $2 AND expires_at > NOW()`,
    [playerId, heistId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];
  return {
    id: session.id,
    playerId: session.player_id,
    heistId: session.heist_id,
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    activities: session.activities || {},
    totalBonuses: session.total_bonuses || { successBonus: 0, heatReduction: 0, escapeBonus: 0 }
  };
}

/**
 * Perform a planning activity
 */
export async function performActivity(
  playerId: number,
  heistId: string,
  activityId: string
): Promise<{
  success: boolean;
  newLevel: number;
  energySpent: number;
  cashSpent: number;
  totalBonuses: PlanningBonuses;
  activitiesCompleted: number;
  readyToExecute: boolean;
}> {
  const activity = getActivity(activityId);
  if (!activity) {
    throw new Error(`Activity '${activityId}' not found`);
  }

  const heist = getHeistDef(heistId);
  if (!heist) {
    throw new Error(`Heist '${heistId}' not found`);
  }

  return withTransaction(async (client) => {
    // Lock player
    const playerResult = await client.query(
      `SELECT * FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player) {
      throw new Error('Player not found');
    }

    // Check energy
    const playerEnergy = player.stamina ?? player.energy ?? 100;
    if (playerEnergy < activity.energyCost) {
      throw new Error('Not enough energy');
    }

    // Check cash if required
    if (activity.cashCost && (player.cash || 0) < activity.cashCost) {
      throw new Error(`Need $${activity.cashCost}`);
    }

    // Get or create planning session
    let session = await getPlanning(playerId, heistId);
    if (!session) {
      // Start new session
      session = await startPlanning(playerId, heistId);
    }

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      throw new Error('Planning session has expired');
    }

    // Check if at max level
    const currentLevel = session.activities[activityId] || 0;
    if (currentLevel >= activity.maxLevel) {
      throw new Error(`Already at max level for ${activity.name}`);
    }

    // Deduct resources
    const newEnergy = playerEnergy - activity.energyCost;
    const cashSpent = activity.cashCost || 0;
    const newCash = (player.cash || 0) - cashSpent;

    await client.query(
      `UPDATE players SET stamina = $1, cash = $2, updated_at = NOW() WHERE id = $3`,
      [newEnergy, newCash, playerId]
    );

    // Update activity
    const newActivities = { ...session.activities };
    newActivities[activityId] = currentLevel + 1;

    const newBonuses = calculateBonuses(newActivities);

    await client.query(
      `UPDATE heist_planning_sessions
       SET activities = $1, total_bonuses = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(newActivities), JSON.stringify(newBonuses), session.id]
    );

    const activitiesCompleted = Object.values(newActivities).filter(v => v > 0).length;
    const minRequired = HEIST_PLANNING_CONFIG.minPlanningByDifficulty[heist.difficulty] || 0;

    return {
      success: true,
      newLevel: currentLevel + 1,
      energySpent: activity.energyCost,
      cashSpent,
      totalBonuses: newBonuses,
      activitiesCompleted,
      readyToExecute: activitiesCompleted >= minRequired
    };
  });
}

/**
 * Execute a heist
 */
export async function executeHeist(
  playerId: number,
  heistId: string
): Promise<HeistExecutionResult> {
  const heist = getHeistDef(heistId);
  if (!heist) {
    throw new Error(`Heist '${heistId}' not found`);
  }

  return withTransaction(async (client) => {
    // Lock player
    const playerResult = await client.query(
      `SELECT * FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player) {
      throw new Error('Player not found');
    }

    // Check level
    if (player.level < heist.minLevel) {
      throw new Error(`Requires level ${heist.minLevel}`);
    }

    // Get planning session
    const sessionResult = await client.query(
      `SELECT * FROM heist_planning_sessions
       WHERE player_id = $1 AND heist_id = $2
       FOR UPDATE`,
      [playerId, heistId]
    );

    const session = sessionResult.rows[0];
    const activities = session?.activities || {};
    const bonuses = session ? calculateBonuses(activities) : { successBonus: 0, heatReduction: 0, escapeBonus: 0 };

    // Check planning requirements
    const minRequired = HEIST_PLANNING_CONFIG.minPlanningByDifficulty[heist.difficulty] || 0;
    const activitiesCompleted = Object.values(activities).filter(v => (v as number) > 0).length;

    if (activitiesCompleted < minRequired) {
      throw new Error(`Need at least ${minRequired} planning activities for this heist`);
    }

    // Check if planning expired
    if (session && new Date(session.expires_at) < new Date()) {
      throw new Error('Planning has expired - start over');
    }

    // Calculate success rate
    let successRate = heist.baseSuccessRate + bonuses.successBonus;
    successRate = Math.min(95, Math.max(5, successRate)); // Cap 5-95%

    // Server-side roll
    const roll = Math.random() * 100;
    const success = roll < successRate;

    let payout = 0;
    let xpGained = 0;
    let heatGained = 0;
    let message = '';

    if (success) {
      // Calculate payout
      payout = heist.minPayout + Math.floor(Math.random() * (heist.maxPayout - heist.minPayout));
      xpGained = Math.floor(payout / 10);

      // Calculate heat with reduction
      const baseHeat = heist.heatGain;
      const heatReduction = bonuses.heatReduction / 100;
      heatGained = Math.floor(baseHeat * (1 - heatReduction));

      message = `Heist successful! Scored $${payout.toLocaleString()}`;
    } else {
      // Failed heist - double heat, reduced by escape bonus
      const baseHeat = heist.heatGain * 2;
      const escapeReduction = bonuses.escapeBonus / 200; // Escape bonus helps reduce failure heat
      heatGained = Math.floor(baseHeat * (1 - escapeReduction));

      message = 'Heist failed! Better luck next time.';
    }

    // Check level up
    const levelCheck = checkLevelUp(player.level, player.xp || 0, xpGained);

    // Update player
    const newCash = (player.cash || 0) + payout;
    const newHeat = Math.min(100, (player.heat || 0) + heatGained);
    const newXp = levelCheck.newXp;
    const newLevel = levelCheck.newLevel;

    await client.query(
      `UPDATE players SET
        cash = $1,
        heat = $2,
        xp = $3,
        level = $4,
        total_earnings = total_earnings + $5,
        updated_at = NOW()
       WHERE id = $6`,
      [newCash, newHeat, newXp, newLevel, payout, playerId]
    );

    // Clear planning session
    if (session) {
      await client.query(
        `DELETE FROM heist_planning_sessions WHERE id = $1`,
        [session.id]
      );
    }

    return {
      heistSuccess: success,
      payout,
      xpGained,
      heatGained,
      planningBonusApplied: bonuses,
      message,
      player: {
        cash: newCash,
        xp: newXp,
        heat: newHeat,
        level: newLevel,
        stamina: player.stamina || 100
      }
    };
  });
}

/**
 * Clear planning session (e.g., when canceling)
 */
export async function clearPlanning(playerId: number, heistId: string): Promise<void> {
  await pool.query(
    `DELETE FROM heist_planning_sessions WHERE player_id = $1 AND heist_id = $2`,
    [playerId, heistId]
  );
}

export default {
  startPlanning,
  getPlanning,
  performActivity,
  executeHeist,
  clearPlanning,
  HEIST_PLANNING_CONFIG
};
