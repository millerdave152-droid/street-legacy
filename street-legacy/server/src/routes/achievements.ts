import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/achievements - Get all achievements with unlock status
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const achievementsResult = await pool.query(
      `SELECT a.*,
              pa.unlocked_at,
              CASE WHEN pa.player_id IS NOT NULL THEN true ELSE false END as unlocked
       FROM achievements a
       LEFT JOIN player_achievements pa ON a.id = pa.achievement_id AND pa.player_id = $1
       ORDER BY a.id`,
      [playerId]
    );

    // Get counts
    const totalCount = achievementsResult.rows.length;
    const unlockedCount = achievementsResult.rows.filter(a => a.unlocked).length;

    res.json({
      success: true,
      data: {
        achievements: achievementsResult.rows.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          requirementType: a.requirement_type,
          requirementValue: a.requirement_value,
          rewardCash: a.reward_cash,
          rewardXp: a.reward_xp,
          unlocked: a.unlocked,
          unlockedAt: a.unlocked_at
        })),
        stats: {
          total: totalCount,
          unlocked: unlockedCount,
          percentage: Math.round((unlockedCount / totalCount) * 100)
        }
      }
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ success: false, error: 'Failed to get achievements' });
  }
});

// Check and award achievements - called after various actions
// OPTIMIZED: Pre-fetches all conditional data to avoid N+1 queries
export async function checkAchievements(playerId: number): Promise<{
  newAchievements: { id: number; name: string; icon: string; rewardCash: number; rewardXp: number }[];
}> {
  const newAchievements: { id: number; name: string; icon: string; rewardCash: number; rewardXp: number }[] = [];

  try {
    // Ensure player_stats exists
    await pool.query(
      `INSERT INTO player_stats (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [playerId]
    );

    // OPTIMIZATION: Fetch all needed data in parallel to avoid N+1 queries
    const [
      playerResult,
      unlockedResult,
      achievementsResult,
      crewLeaderResult,
      robCountResult,
      districtCrimesResult
    ] = await Promise.all([
      // Get player data and stats
      pool.query(
        `SELECT p.*, ps.*
         FROM players p
         LEFT JOIN player_stats ps ON p.id = ps.player_id
         WHERE p.id = $1`,
        [playerId]
      ),
      // Get already unlocked achievements
      pool.query(
        `SELECT achievement_id FROM player_achievements WHERE player_id = $1`,
        [playerId]
      ),
      // Get all achievements
      pool.query(`SELECT * FROM achievements`),
      // Pre-fetch: Is player a crew leader?
      pool.query(
        `SELECT id FROM crews WHERE leader_id = $1 LIMIT 1`,
        [playerId]
      ),
      // Pre-fetch: Rob count
      pool.query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE player_id != $1 AND type = 'robbed' AND (data->>'attackerId')::int = $1`,
        [playerId]
      ),
      // Pre-fetch: All district crime counts (grouped)
      pool.query(
        `SELECT district_id, COUNT(*) as count FROM crime_logs
         WHERE player_id = $1 AND success = true
         GROUP BY district_id`,
        [playerId]
      )
    ]);

    const player = playerResult.rows[0];
    const unlockedIds = new Set(unlockedResult.rows.map(r => r.achievement_id));

    // Build lookup maps from pre-fetched data
    const isCrewLeader = crewLeaderResult.rows.length > 0;
    const robCount = parseInt(robCountResult.rows[0]?.count || '0');
    const districtCrimeCounts = new Map<number, number>(
      districtCrimesResult.rows.map(r => [r.district_id, parseInt(r.count)])
    );

    // Collect achievements to unlock (for batch processing)
    const achievementsToUnlock: typeof achievementsResult.rows = [];

    for (const achievement of achievementsResult.rows) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.requirement_type) {
        case 'total_crimes':
          shouldUnlock = (player.total_crimes || 0) >= achievement.requirement_value;
          break;

        case 'total_earnings':
          shouldUnlock = (player.total_earnings || 0) >= achievement.requirement_value;
          break;

        case 'jail_time':
          shouldUnlock = (player.total_jail_minutes || 0) >= achievement.requirement_value;
          break;

        case 'crime_streak':
          shouldUnlock = (player.best_streak || 0) >= achievement.requirement_value;
          break;

        case 'items_bought':
          shouldUnlock = (player.items_purchased || 0) >= achievement.requirement_value;
          break;

        case 'prestige_level':
          shouldUnlock = (player.prestige_level || 0) >= achievement.requirement_value;
          break;

        case 'create_crew':
          // Use pre-fetched data instead of query
          shouldUnlock = isCrewLeader;
          break;

        case 'rob_player':
          // Use pre-fetched data instead of query
          shouldUnlock = robCount >= achievement.requirement_value;
          break;

        case 'all_districts':
          const districtsVisited = player.districts_visited || [];
          shouldUnlock = districtsVisited.length >= achievement.requirement_value;
          break;

        case 'all_crimes':
          const crimesCommitted = player.crimes_committed || [];
          shouldUnlock = crimesCommitted.length >= achievement.requirement_value;
          break;

        case 'specific_district_crimes':
          // Use pre-fetched data instead of query
          if (achievement.requirement_extra?.district_id) {
            const count = districtCrimeCounts.get(achievement.requirement_extra.district_id) || 0;
            shouldUnlock = count >= achievement.requirement_value;
          }
          break;
      }

      if (shouldUnlock) {
        achievementsToUnlock.push(achievement);
      }
    }

    // Batch process all unlocked achievements
    if (achievementsToUnlock.length > 0) {
      // Calculate total rewards
      let totalCash = 0;
      let totalXp = 0;

      for (const achievement of achievementsToUnlock) {
        totalCash += achievement.reward_cash || 0;
        totalXp += achievement.reward_xp || 0;

        newAchievements.push({
          id: achievement.id,
          name: achievement.name,
          icon: achievement.icon,
          rewardCash: achievement.reward_cash,
          rewardXp: achievement.reward_xp
        });
      }

      // Batch insert achievements using unnest
      const achievementIds = achievementsToUnlock.map(a => a.id);
      await pool.query(
        `INSERT INTO player_achievements (player_id, achievement_id)
         SELECT $1, unnest($2::int[])
         ON CONFLICT (player_id, achievement_id) DO NOTHING`,
        [playerId, achievementIds]
      );

      // Single update for all rewards
      if (totalCash > 0 || totalXp > 0) {
        await pool.query(
          `UPDATE players SET cash = cash + $1, xp = xp + $2 WHERE id = $3`,
          [totalCash, totalXp, playerId]
        );
      }

      // Batch insert notifications
      const notificationValues = achievementsToUnlock.map((a, i) => {
        const paramOffset = i * 3;
        return `($1, 'achievement', $${paramOffset + 2}, $${paramOffset + 3})`;
      }).join(', ');

      const notificationParams: any[] = [playerId];
      for (const achievement of achievementsToUnlock) {
        notificationParams.push(
          `Achievement Unlocked: ${achievement.name}!`,
          JSON.stringify({
            achievementId: achievement.id,
            name: achievement.name,
            icon: achievement.icon,
            rewardCash: achievement.reward_cash,
            rewardXp: achievement.reward_xp
          })
        );
      }

      await pool.query(
        `INSERT INTO notifications (player_id, type, message, data) VALUES ${notificationValues}`,
        notificationParams
      );
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }

  return { newAchievements };
}

// Update player stats after a crime
export async function updatePlayerStats(
  playerId: number,
  crimeId: number,
  districtId: number,
  success: boolean,
  jailMinutes: number = 0
): Promise<void> {
  try {
    // Ensure stats row exists
    await pool.query(
      `INSERT INTO player_stats (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [playerId]
    );

    if (success) {
      // Update successful crime stats
      await pool.query(
        `UPDATE player_stats SET
          total_crimes = total_crimes + 1,
          successful_crimes = successful_crimes + 1,
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          districts_visited = CASE
            WHEN NOT ($2 = ANY(districts_visited)) THEN array_append(districts_visited, $2)
            ELSE districts_visited
          END,
          crimes_committed = CASE
            WHEN NOT ($3 = ANY(crimes_committed)) THEN array_append(crimes_committed, $3)
            ELSE crimes_committed
          END
         WHERE player_id = $1`,
        [playerId, districtId, crimeId]
      );
    } else {
      // Failed crime - reset streak, add jail time
      await pool.query(
        `UPDATE player_stats SET
          total_crimes = total_crimes + 1,
          current_streak = 0,
          total_jail_minutes = total_jail_minutes + $2
         WHERE player_id = $1`,
        [playerId, jailMinutes]
      );
    }
  } catch (error) {
    console.error('Update player stats error:', error);
  }
}

// Update items purchased count
export async function updateItemsPurchased(playerId: number): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO player_stats (player_id, items_purchased)
       VALUES ($1, 1)
       ON CONFLICT (player_id)
       DO UPDATE SET items_purchased = player_stats.items_purchased + 1`,
      [playerId]
    );
  } catch (error) {
    console.error('Update items purchased error:', error);
  }
}

// GET /api/achievements/recent - Get recently unlocked achievements
router.get('/recent', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const recentResult = await pool.query(
      `SELECT a.*, pa.unlocked_at
       FROM player_achievements pa
       JOIN achievements a ON pa.achievement_id = a.id
       WHERE pa.player_id = $1
       ORDER BY pa.unlocked_at DESC
       LIMIT 5`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        achievements: recentResult.rows.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          rewardCash: a.reward_cash,
          rewardXp: a.reward_xp,
          unlockedAt: a.unlocked_at
        }))
      }
    });
  } catch (error) {
    console.error('Get recent achievements error:', error);
    res.status(500).json({ success: false, error: 'Failed to get recent achievements' });
  }
});

export default router;
