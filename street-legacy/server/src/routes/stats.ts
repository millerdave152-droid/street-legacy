import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/stats - Get player stats (requires auth)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get total crimes and success rate
    const crimeStatsResult = await pool.query(`
      SELECT
        COUNT(*) as total_crimes,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_crimes,
        SUM(CASE WHEN caught THEN 1 ELSE 0 END) as times_caught,
        SUM(cash_gained) as total_cash_earned
      FROM crime_logs
      WHERE player_id = $1
    `, [playerId]);

    const crimeStats = crimeStatsResult.rows[0];
    const totalCrimes = parseInt(crimeStats.total_crimes) || 0;
    const successfulCrimes = parseInt(crimeStats.successful_crimes) || 0;
    const timesCaught = parseInt(crimeStats.times_caught) || 0;
    const totalCashEarned = parseInt(crimeStats.total_cash_earned) || 0;
    const successRate = totalCrimes > 0 ? Math.round((successfulCrimes / totalCrimes) * 100) : 0;

    // Get favorite district (most crimes committed there)
    const favoriteDistrictResult = await pool.query(`
      SELECT d.id, d.name, d.city, COUNT(*) as crime_count
      FROM crime_logs cl
      JOIN districts d ON cl.district_id = d.id
      WHERE cl.player_id = $1
      GROUP BY d.id, d.name, d.city
      ORDER BY crime_count DESC
      LIMIT 1
    `, [playerId]);

    const favoriteDistrict = favoriteDistrictResult.rows[0] || null;

    // Get crime breakdown by type
    const crimeBreakdownResult = await pool.query(`
      SELECT
        c.id,
        c.name,
        COUNT(*) as attempts,
        SUM(CASE WHEN cl.success THEN 1 ELSE 0 END) as successes,
        SUM(cl.cash_gained) as earnings
      FROM crime_logs cl
      JOIN crimes c ON cl.crime_id = c.id
      WHERE cl.player_id = $1
      GROUP BY c.id, c.name
      ORDER BY attempts DESC
    `, [playerId]);

    const crimeBreakdown = crimeBreakdownResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      attempts: parseInt(row.attempts),
      successes: parseInt(row.successes),
      successRate: parseInt(row.attempts) > 0
        ? Math.round((parseInt(row.successes) / parseInt(row.attempts)) * 100)
        : 0,
      earnings: parseInt(row.earnings) || 0
    }));

    // Get player's basic info
    const playerResult = await pool.query(`
      SELECT username, level, xp, total_earnings, created_at
      FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    // Calculate estimated jail time (jail_minutes * times_caught)
    const jailTimeResult = await pool.query(`
      SELECT SUM(c.jail_minutes) as total_jail_minutes
      FROM crime_logs cl
      JOIN crimes c ON cl.crime_id = c.id
      WHERE cl.player_id = $1 AND cl.caught = true
    `, [playerId]);

    const totalJailMinutes = parseInt(jailTimeResult.rows[0]?.total_jail_minutes) || 0;

    res.json({
      success: true,
      data: {
        player: {
          username: player.username,
          level: player.level,
          xp: player.xp,
          totalEarnings: player.total_earnings,
          memberSince: player.created_at
        },
        crimeStats: {
          totalCrimes,
          successfulCrimes,
          successRate,
          timesCaught,
          totalCashEarned,
          totalJailMinutes
        },
        favoriteDistrict: favoriteDistrict ? {
          id: favoriteDistrict.id,
          name: favoriteDistrict.name,
          city: favoriteDistrict.city,
          crimeCount: parseInt(favoriteDistrict.crime_count)
        } : null,
        crimeBreakdown
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
