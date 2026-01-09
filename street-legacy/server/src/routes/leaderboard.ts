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

// =============================================================================
// WEEKLY LEADERBOARDS
// =============================================================================

// GET /api/leaderboard/weekly/cash - Most cash earned this week
router.get('/weekly/cash', async (_req, res) => {
  try {
    const weekStart = getWeekStart();
    const result = await pool.query(
      `SELECT ws.player_id, p.username, p.display_name, p.level, ws.cash_earned
       FROM weekly_player_stats ws
       JOIN players p ON ws.player_id = p.id
       WHERE ws.week_start = $1 AND ws.cash_earned > 0
       ORDER BY ws.cash_earned DESC
       LIMIT 50`,
      [weekStart]
    );

    res.json({
      success: true,
      category: 'cash',
      weekStart,
      data: result.rows.map((row, index) => ({
        rank: index + 1,
        playerId: row.player_id,
        username: row.username,
        displayName: row.display_name,
        level: row.level,
        value: parseInt(row.cash_earned)
      }))
    });
  } catch (error) {
    console.error('Weekly cash leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get weekly cash leaderboard' });
  }
});

// GET /api/leaderboard/weekly/heat - Most heat accumulated this week
router.get('/weekly/heat', async (_req, res) => {
  try {
    const weekStart = getWeekStart();
    const result = await pool.query(
      `SELECT ws.player_id, p.username, p.display_name, p.level, ws.heat_accumulated
       FROM weekly_player_stats ws
       JOIN players p ON ws.player_id = p.id
       WHERE ws.week_start = $1 AND ws.heat_accumulated > 0
       ORDER BY ws.heat_accumulated DESC
       LIMIT 50`,
      [weekStart]
    );

    res.json({
      success: true,
      category: 'heat',
      weekStart,
      data: result.rows.map((row, index) => ({
        rank: index + 1,
        playerId: row.player_id,
        username: row.username,
        displayName: row.display_name,
        level: row.level,
        value: parseInt(row.heat_accumulated)
      }))
    });
  } catch (error) {
    console.error('Weekly heat leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get weekly heat leaderboard' });
  }
});

// GET /api/leaderboard/weekly/heist - Biggest single heist this week
router.get('/weekly/heist', async (_req, res) => {
  try {
    const weekStart = getWeekStart();
    const result = await pool.query(
      `SELECT ws.player_id, p.username, p.display_name, p.level,
              ws.biggest_heist_payout, ws.biggest_heist_name
       FROM weekly_player_stats ws
       JOIN players p ON ws.player_id = p.id
       WHERE ws.week_start = $1 AND ws.biggest_heist_payout > 0
       ORDER BY ws.biggest_heist_payout DESC
       LIMIT 50`,
      [weekStart]
    );

    res.json({
      success: true,
      category: 'heist',
      weekStart,
      data: result.rows.map((row, index) => ({
        rank: index + 1,
        playerId: row.player_id,
        username: row.username,
        displayName: row.display_name,
        level: row.level,
        value: parseInt(row.biggest_heist_payout),
        heistName: row.biggest_heist_name
      }))
    });
  } catch (error) {
    console.error('Weekly heist leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get weekly heist leaderboard' });
  }
});

// GET /api/leaderboard/weekly/property - Most property value gained this week
router.get('/weekly/property', async (_req, res) => {
  try {
    const weekStart = getWeekStart();
    const result = await pool.query(
      `SELECT ws.player_id, p.username, p.display_name, p.level, ws.property_value_gained
       FROM weekly_player_stats ws
       JOIN players p ON ws.player_id = p.id
       WHERE ws.week_start = $1 AND ws.property_value_gained > 0
       ORDER BY ws.property_value_gained DESC
       LIMIT 50`,
      [weekStart]
    );

    res.json({
      success: true,
      category: 'property',
      weekStart,
      data: result.rows.map((row, index) => ({
        rank: index + 1,
        playerId: row.player_id,
        username: row.username,
        displayName: row.display_name,
        level: row.level,
        value: parseInt(row.property_value_gained)
      }))
    });
  } catch (error) {
    console.error('Weekly property leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get weekly property leaderboard' });
  }
});

// Helper function to get Monday of current week
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default router;
