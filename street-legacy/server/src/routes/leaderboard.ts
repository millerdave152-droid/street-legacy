import { Router } from 'express';
import pool from '../db/connection.js';
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js';

const router = Router();

// GET /api/leaderboard
router.get('/', async (_req, res) => {
  try {
    // Cache leaderboard for 5 minutes (moderately changing data)
    const leaderboard = await cache.getOrSet(
      cacheKeys.leaderboardEarnings(),
      async () => {
        const result = await pool.query(
          `SELECT id, username, level, total_earnings
           FROM players
           ORDER BY total_earnings DESC
           LIMIT 100`
        );

        return result.rows.map((row, index) => ({
          rank: index + 1,
          id: row.id,
          username: row.username,
          level: row.level,
          totalEarnings: row.total_earnings
        }));
      },
      cacheTTL.medium // 5 minutes
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

// GET /api/leaderboard/level - Top players by level
router.get('/level', async (_req, res) => {
  try {
    const leaderboard = await cache.getOrSet(
      cacheKeys.leaderboardLevel(),
      async () => {
        const result = await pool.query(
          `SELECT id, username, level, xp, total_earnings
           FROM players
           ORDER BY level DESC, xp DESC
           LIMIT 100`
        );

        return result.rows.map((row, index) => ({
          rank: index + 1,
          id: row.id,
          username: row.username,
          level: row.level,
          xp: row.xp,
          totalEarnings: row.total_earnings
        }));
      },
      cacheTTL.medium
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Level leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get level leaderboard' });
  }
});

// GET /api/leaderboard/crews - Top crews
router.get('/crews', async (_req, res) => {
  try {
    const leaderboard = await cache.getOrSet(
      cacheKeys.leaderboardCrew(),
      async () => {
        const result = await pool.query(
          `SELECT c.id, c.name, c.tag, c.bank, c.level,
                  COUNT(cm.player_id) as member_count,
                  p.username as leader_name
           FROM crews c
           JOIN players p ON c.leader_id = p.id
           LEFT JOIN crew_members cm ON cm.crew_id = c.id
           GROUP BY c.id, c.name, c.tag, c.bank, c.level, p.username
           ORDER BY c.level DESC, c.bank DESC
           LIMIT 50`
        );

        return result.rows.map((row, index) => ({
          rank: index + 1,
          id: row.id,
          name: row.name,
          tag: row.tag,
          level: row.level,
          bank: row.bank,
          memberCount: parseInt(row.member_count),
          leaderName: row.leader_name
        }));
      },
      cacheTTL.medium
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Crew leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get crew leaderboard' });
  }
});

export default router;
