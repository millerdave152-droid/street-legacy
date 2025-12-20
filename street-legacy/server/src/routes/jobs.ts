/**
 * Jobs Routes
 *
 * Legitimate employment system - earn clean money without generating heat.
 * Jobs provide steady income for new players and those avoiding criminal activity.
 */

import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { withTransaction, lockRowForUpdate } from '../db/transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js';
import { notifyStatUpdate, sendToUser } from '../websocket/index.js';
import { createEvent, LevelUpEvent } from '../websocket/events.js';

const router = Router();

// Validation schemas
const workJobSchema = z.object({
  body: z.object({
    jobId: z.string().min(1, 'Job ID is required')
  })
});

// XP required for each level
const XP_PER_LEVEL = [0, 0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000];

function getRequiredXP(level: number): number {
  return XP_PER_LEVEL[level] || level * 50000;
}

// All job routes require authentication
router.use(authMiddleware);

/**
 * GET /api/jobs
 * Get all available jobs with player eligibility
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player data
    const playerResult = await pool.query(
      `SELECT level, energy, stamina, rep_business, is_master, current_district
       FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    // Get district economy modifier
    const districtResult = await pool.query(
      `SELECT economy_level, wealth FROM districts WHERE id = $1`,
      [player.current_district || 1]
    );
    const district = districtResult.rows[0] || { economy_level: 50, wealth: 5 };
    const economyModifier = (district.economy_level || district.wealth * 10) / 50;

    // Get all active jobs from cache
    const allJobs = await cache.getOrSet(
      cacheKeys.allJobs?.() || 'jobs:all',
      async () => {
        const result = await pool.query(
          `SELECT id, name, description, category,
                  COALESCE(required_level, 1) as required_level,
                  COALESCE(payout, 50) as payout,
                  COALESCE(energy_cost, 10) as energy_cost,
                  COALESCE(cooldown_seconds, 60) as cooldown_seconds,
                  COALESCE(xp_reward, 5) as xp_reward,
                  COALESCE(required_rep_business, 0) as required_rep_business,
                  icon
           FROM job_types
           WHERE is_active = true OR is_active IS NULL
           ORDER BY COALESCE(required_level, 1), COALESCE(payout, 50)`
        );
        return result.rows;
      },
      cacheTTL.long // 1 hour cache for job types
    );

    // Get player cooldowns
    const cooldownResult = await pool.query(
      `SELECT action_type, expires_at
       FROM player_cooldowns
       WHERE player_id = $1
         AND action_type LIKE 'job:%'
         AND expires_at > NOW()`,
      [playerId]
    );

    const cooldowns: Record<string, Date> = {};
    for (const row of cooldownResult.rows) {
      const jobId = row.action_type.replace('job:', '');
      cooldowns[jobId] = row.expires_at;
    }

    // Build jobs list with eligibility info
    const playerEnergy = player.stamina || player.energy || 100;
    const playerRep = player.rep_business || 0;

    const jobs = allJobs.map((job: any) => {
      const meetsLevel = player.level >= job.required_level || player.is_master;
      const meetsRep = playerRep >= (job.required_rep_business || 0) || player.is_master;
      const hasEnergy = playerEnergy >= job.energy_cost || player.is_master;
      const isOnCooldown = !!cooldowns[job.id];
      const cooldownRemaining = isOnCooldown
        ? Math.max(0, Math.floor((new Date(cooldowns[job.id]).getTime() - Date.now()) / 1000))
        : 0;

      // Calculate payout with level bonus and district economy
      const levelBonus = 1 + (player.level * 0.05);
      const calculatedPayout = Math.floor(job.payout * levelBonus * economyModifier);

      return {
        id: job.id,
        name: job.name,
        description: job.description,
        category: job.category,
        icon: job.icon,
        min_level: job.required_level,
        required_rep_business: job.required_rep_business || 0,
        energy_cost: job.energy_cost,
        stamina_cost: job.energy_cost, // Alias for client compatibility
        base_pay: job.payout,
        calculated_pay: calculatedPayout,
        cooldown_seconds: job.cooldown_seconds,
        xp_reward: job.xp_reward,
        // Eligibility
        can_work: meetsLevel && meetsRep && hasEnergy && !isOnCooldown,
        meets_level: meetsLevel,
        meets_rep: meetsRep,
        has_energy: hasEnergy,
        is_on_cooldown: isOnCooldown,
        cooldown_remaining: cooldownRemaining,
        reason_unavailable: !meetsLevel
          ? `Requires level ${job.required_level}`
          : !meetsRep
            ? `Requires ${job.required_rep_business} business rep`
            : !hasEnergy
              ? `Not enough energy (need ${job.energy_cost})`
              : isOnCooldown
                ? `On cooldown (${cooldownRemaining}s remaining)`
                : null
      };
    });

    res.json({
      success: true,
      data: {
        jobs,
        player: {
          level: player.level,
          energy: playerEnergy,
          rep_business: playerRep
        }
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get jobs' });
  }
});

/**
 * POST /api/jobs/work
 * Complete a job and receive payment
 */
router.post('/work', validate(workJobSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { jobId } = req.body;

    // Get job type - try with is_active check first, then without
    let jobResult = await pool.query(
      `SELECT id, name, description, category,
              COALESCE(required_level, 1) as required_level,
              COALESCE(payout, 50) as payout,
              COALESCE(energy_cost, 10) as energy_cost,
              COALESCE(cooldown_seconds, 60) as cooldown_seconds,
              COALESCE(xp_reward, 5) as xp_reward,
              COALESCE(required_rep_business, 0) as required_rep_business
       FROM job_types
       WHERE id = $1 AND (is_active = true OR is_active IS NULL)`,
      [jobId]
    );

    // If no result, try without the is_active check
    if (jobResult.rows.length === 0) {
      jobResult = await pool.query(
        `SELECT id, name, description, category,
                COALESCE(required_level, 1) as required_level,
                COALESCE(payout, 50) as payout,
                COALESCE(energy_cost, 10) as energy_cost,
                COALESCE(cooldown_seconds, 60) as cooldown_seconds,
                COALESCE(xp_reward, 5) as xp_reward,
                COALESCE(required_rep_business, 0) as required_rep_business
         FROM job_types
         WHERE id = $1`,
        [jobId]
      );
    }

    const job = jobResult.rows[0];

    if (!job) {
      console.log(`Job not found: ${jobId}. Checking available jobs...`);
      const availableJobs = await pool.query(`SELECT id FROM job_types LIMIT 10`);
      console.log('Available jobs:', availableJobs.rows.map(r => r.id));
      res.status(404).json({ success: false, error: `Job '${jobId}' not found. Check if job_types table is seeded.` });
      return;
    }

    // Execute job within transaction
    const result = await withTransaction(async (client) => {
      // Lock player row
      const playerResult = await client.query(
        `SELECT p.*, d.economy_level, d.wealth
         FROM players p
         LEFT JOIN districts d ON p.current_district = d.id
         WHERE p.id = $1
         FOR UPDATE OF p`,
        [playerId]
      );
      const player = playerResult.rows[0];
      const isMaster = player?.is_master === true;

      if (!player) {
        throw new Error('Player not found');
      }

      // Check level requirement
      if (player.level < job.required_level && !isMaster) {
        throw new Error(`Requires level ${job.required_level}`);
      }

      // Check reputation requirement
      const playerRep = player.rep_business || 0;
      if (playerRep < (job.required_rep_business || 0) && !isMaster) {
        throw new Error(`Requires ${job.required_rep_business} business reputation`);
      }

      // Check energy
      const playerEnergy = player.stamina ?? player.energy ?? 100;
      if (playerEnergy < job.energy_cost && !isMaster) {
        throw new Error(`Not enough energy (need ${job.energy_cost})`);
      }

      // Check cooldown
      if (!isMaster) {
        const cooldownResult = await client.query(
          `SELECT expires_at FROM player_cooldowns
           WHERE player_id = $1 AND action_type = $2 AND expires_at > NOW()`,
          [playerId, `job:${jobId}`]
        );
        if (cooldownResult.rows.length > 0) {
          const remaining = Math.ceil(
            (new Date(cooldownResult.rows[0].expires_at).getTime() - Date.now()) / 1000
          );
          throw new Error(`Job on cooldown (${remaining}s remaining)`);
        }
      }

      // Calculate payout
      const economyModifier = (player.economy_level || player.wealth * 10 || 50) / 50;
      const levelBonus = 1 + (player.level * 0.05);
      const cashEarned = Math.floor(job.payout * levelBonus * economyModifier);
      const xpEarned = job.xp_reward;

      // Deduct energy (master accounts have unlimited)
      const newEnergy = isMaster ? playerEnergy : playerEnergy - job.energy_cost;
      const newCash = player.cash + cashEarned;
      const newXP = player.xp + xpEarned;

      // Check for level up
      let leveledUp = false;
      let newLevel = player.level;
      let xpRemaining = newXP;

      while (xpRemaining >= getRequiredXP(newLevel + 1)) {
        xpRemaining -= getRequiredXP(newLevel + 1);
        newLevel++;
        leveledUp = true;
      }

      // Update player
      await client.query(
        `UPDATE players SET
          stamina = $1, energy = $1,
          cash = $2, xp = $3, level = $4,
          last_job_at = NOW()
         WHERE id = $5`,
        [newEnergy, newCash, leveledUp ? xpRemaining : newXP, newLevel, playerId]
      );

      // Set cooldown
      if (!isMaster) {
        await client.query(
          `INSERT INTO player_cooldowns (player_id, action_type, expires_at)
           VALUES ($1, $2, NOW() + make_interval(secs => $3))
           ON CONFLICT (player_id, action_type)
           DO UPDATE SET expires_at = NOW() + make_interval(secs => $3)`,
          [playerId, `job:${jobId}`, job.cooldown_seconds]
        );
      }

      // Add small amount of business reputation
      const repGained = Math.max(1, Math.floor(cashEarned / 200));
      await client.query(
        `UPDATE players SET rep_business = COALESCE(rep_business, 0) + $1 WHERE id = $2`,
        [repGained, playerId]
      );

      // Log job completion
      try {
        await client.query(
          `INSERT INTO job_logs (player_id, job_type_id, district_id, payout, xp_gained, energy_spent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [playerId, jobId, player.current_district || 1, cashEarned, xpEarned, job.energy_cost]
        );
      } catch {
        // Non-critical, continue if table doesn't exist
        console.log('Job log skipped (table may not exist)');
      }

      return {
        success: true,
        job_name: job.name,
        cash_earned: cashEarned,
        xp_earned: xpEarned,
        rep_earned: repGained,
        energy_spent: isMaster ? 0 : job.energy_cost,
        leveled_up: leveledUp,
        new_level: newLevel,
        cooldown_seconds: job.cooldown_seconds,
        player: {
          cash: newCash,
          xp: leveledUp ? xpRemaining : newXP,
          level: newLevel,
          energy: newEnergy,
          stamina: newEnergy
        }
      };
    });

    res.json({ success: true, data: result });

    // Send WebSocket updates
    notifyStatUpdate(playerId, {
      cash: result.player.cash,
      xp: result.player.xp,
      energy: result.player.energy
    });

    if (result.leveled_up) {
      sendToUser(playerId, createEvent<LevelUpEvent>('game:level_up', {
        oldLevel: result.new_level - 1,
        newLevel: result.new_level,
        rewards: { statPoints: 3 }
      }));
    }
  } catch (error: any) {
    console.error('Work job error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to complete job' });
  }
});

/**
 * GET /api/jobs/history
 * Get player's job completion history
 */
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT jl.id, jl.job_type_id, jt.name as job_name, jt.icon,
              jl.payout, jl.xp_gained, jl.energy_spent,
              d.name as district_name, jl.completed_at
       FROM job_logs jl
       JOIN job_types jt ON jt.id = jl.job_type_id
       LEFT JOIN districts d ON d.id = jl.district_id
       WHERE jl.player_id = $1
       ORDER BY jl.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [playerId, limit, offset]
    );

    res.json({
      success: true,
      data: {
        history: result.rows,
        pagination: {
          limit,
          offset,
          hasMore: result.rows.length === limit
        }
      }
    });
  } catch (error) {
    console.error('Get job history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get job history' });
  }
});

/**
 * GET /api/jobs/stats
 * Get player's job statistics
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT
        COUNT(*)::int as total_jobs_completed,
        COALESCE(SUM(payout), 0)::bigint as total_earnings,
        COALESCE(SUM(xp_gained), 0)::bigint as total_xp_earned,
        (
          SELECT jt.name FROM job_logs jl2
          JOIN job_types jt ON jt.id = jl2.job_type_id
          WHERE jl2.player_id = $1
          GROUP BY jt.name
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as favorite_job,
        (
          SELECT jt.name FROM job_logs jl2
          JOIN job_types jt ON jt.id = jl2.job_type_id
          WHERE jl2.player_id = $1
          GROUP BY jt.name
          ORDER BY SUM(jl2.payout) DESC
          LIMIT 1
        ) as most_profitable_job
       FROM job_logs
       WHERE player_id = $1`,
      [playerId]
    );

    res.json({
      success: true,
      data: result.rows[0] || {
        total_jobs_completed: 0,
        total_earnings: 0,
        total_xp_earned: 0,
        favorite_job: null,
        most_profitable_job: null
      }
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get job stats' });
  }
});

export default router;
