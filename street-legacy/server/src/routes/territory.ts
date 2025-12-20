import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { cache, cacheTTL } from '../utils/cache.js';

const router = Router();

router.use(authMiddleware);

const TERRITORY_PAYOUT_BONUS = 20; // 20% bonus
const PASSIVE_INCOME_PER_HOUR = 100;

// GET /api/territory - Get territory control status
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    // Get all districts with controlling crew info - use CTE to avoid correlated subquery
    const districtsResult = await pool.query(
      `WITH crime_counts AS (
        SELECT district_id, COUNT(*) as crime_count
        FROM crime_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        AND success = true
        GROUP BY district_id
      )
      SELECT d.*, c.name as crew_name, c.tag as crew_tag,
             COALESCE(cc.crime_count, 0) as total_crimes_today
       FROM districts d
       LEFT JOIN crews c ON d.controlling_crew_id = c.id
       LEFT JOIN crime_counts cc ON d.id = cc.district_id
       ORDER BY d.id`
    );

    // Get crime counts by crew for each district (last 24 hours)
    const crewStatsResult = await pool.query(
      `SELECT cl.district_id, p.crew_id, c.name as crew_name, c.tag as crew_tag,
              COUNT(*) as crime_count
       FROM crime_logs cl
       JOIN players p ON cl.player_id = p.id
       JOIN crews c ON p.crew_id = c.id
       WHERE cl.created_at > NOW() - INTERVAL '24 hours'
       AND cl.success = true
       AND p.crew_id IS NOT NULL
       GROUP BY cl.district_id, p.crew_id, c.name, c.tag
       ORDER BY cl.district_id, crime_count DESC`
    );

    // Group crew stats by district
    const crewStatsByDistrict: Record<number, any[]> = {};
    for (const stat of crewStatsResult.rows) {
      if (!crewStatsByDistrict[stat.district_id]) {
        crewStatsByDistrict[stat.district_id] = [];
      }
      crewStatsByDistrict[stat.district_id].push({
        crewId: stat.crew_id,
        crewName: stat.crew_name,
        crewTag: stat.crew_tag,
        crimeCount: parseInt(stat.crime_count)
      });
    }

    res.json({
      success: true,
      data: {
        territories: districtsResult.rows.map(d => ({
          id: d.id,
          name: d.name,
          city: d.city,
          controllingCrew: d.controlling_crew_id ? {
            id: d.controlling_crew_id,
            name: d.crew_name,
            tag: d.crew_tag
          } : null,
          controlStartedAt: d.control_started_at,
          totalCrimesToday: parseInt(d.total_crimes_today),
          contestingCrews: crewStatsByDistrict[d.id] || [],
          payoutBonus: d.controlling_crew_id ? TERRITORY_PAYOUT_BONUS : 0
        })),
        bonusInfo: {
          payoutBonus: TERRITORY_PAYOUT_BONUS,
          passiveIncomePerHour: PASSIVE_INCOME_PER_HOUR
        }
      }
    });
  } catch (error) {
    console.error('Get territory error:', error);
    res.status(500).json({ success: false, error: 'Failed to get territory' });
  }
});

// GET /api/territory/leaderboard - Get crew territory leaderboard
router.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  try {
    // Use cache for expensive leaderboard query (5 minute TTL)
    const leaderboard = await cache.getOrSet(
      'territory:leaderboard',
      async () => {
        // Optimized: replaced correlated subquery with CTE for crew crime counts
        const leaderboardResult = await pool.query(
          `WITH crew_crimes AS (
             SELECT p.crew_id, COUNT(*) as crime_count
             FROM crime_logs cl
             JOIN players p ON cl.player_id = p.id
             WHERE cl.created_at > NOW() - INTERVAL '24 hours'
             AND cl.success = true
             AND p.crew_id IS NOT NULL
             GROUP BY p.crew_id
           )
           SELECT c.id, c.name, c.tag,
                  COUNT(DISTINCT d.id) as territories_controlled,
                  COALESCE(cc.crime_count, 0) as total_crimes_today
           FROM crews c
           LEFT JOIN districts d ON d.controlling_crew_id = c.id
           LEFT JOIN crew_crimes cc ON cc.crew_id = c.id
           GROUP BY c.id, c.name, c.tag, cc.crime_count
           ORDER BY territories_controlled DESC, total_crimes_today DESC
           LIMIT 20`
        );

        return leaderboardResult.rows.map((c, index) => ({
          rank: index + 1,
          crewId: c.id,
          crewName: c.name,
          crewTag: c.tag,
          territoriesControlled: parseInt(c.territories_controlled),
          totalCrimesToday: parseInt(c.total_crimes_today)
        }));
      },
      cacheTTL.medium // 5 minutes
    );

    res.json({
      success: true,
      data: { leaderboard }
    });
  } catch (error) {
    console.error('Get territory leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

// Update territory control - call this periodically or after crimes
export async function updateTerritoryControl(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get all districts
    const districtsResult = await pool.query(`SELECT id FROM districts`);

    for (const district of districtsResult.rows) {
      // Find crew with most successful crimes in last 24 hours
      const topCrewResult = await pool.query(
        `SELECT p.crew_id, c.name, COUNT(*) as crime_count
         FROM crime_logs cl
         JOIN players p ON cl.player_id = p.id
         JOIN crews c ON p.crew_id = c.id
         WHERE cl.district_id = $1
         AND cl.created_at > NOW() - INTERVAL '24 hours'
         AND cl.success = true
         AND p.crew_id IS NOT NULL
         GROUP BY p.crew_id, c.name
         ORDER BY crime_count DESC
         LIMIT 1`,
        [district.id]
      );

      if (topCrewResult.rows.length > 0) {
        const topCrew = topCrewResult.rows[0];

        // Check if control changed
        const currentResult = await pool.query(
          `SELECT controlling_crew_id FROM districts WHERE id = $1`,
          [district.id]
        );

        const currentController = currentResult.rows[0].controlling_crew_id;

        if (currentController !== topCrew.crew_id) {
          // Update territory control
          await pool.query(
            `UPDATE districts SET controlling_crew_id = $1, control_started_at = NOW() WHERE id = $2`,
            [topCrew.crew_id, district.id]
          );

          // Record in territory wars history
          await pool.query(
            `INSERT INTO territory_wars (district_id, winning_crew_id, crime_count, war_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (district_id, war_date)
             DO UPDATE SET winning_crew_id = $2, crime_count = $3`,
            [district.id, topCrew.crew_id, topCrew.crime_count, today]
          );
        }
      }
    }
  } catch (error) {
    console.error('Update territory control error:', error);
  }
}

// Pay passive income to controlling crews - call hourly
export async function payTerritoryIncome(): Promise<void> {
  try {
    // Get all controlled districts
    const controlledResult = await pool.query(
      `SELECT controlling_crew_id, COUNT(*) as district_count
       FROM districts
       WHERE controlling_crew_id IS NOT NULL
       GROUP BY controlling_crew_id`
    );

    for (const row of controlledResult.rows) {
      const income = parseInt(row.district_count) * PASSIVE_INCOME_PER_HOUR;
      await pool.query(
        `UPDATE crews SET bank = bank + $1 WHERE id = $2`,
        [income, row.controlling_crew_id]
      );
    }
  } catch (error) {
    console.error('Pay territory income error:', error);
  }
}

// Get territory bonus for a player's crew in a district
export async function getTerritoryBonus(playerId: number, districtId: number): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT d.controlling_crew_id, p.crew_id
       FROM districts d, players p
       WHERE d.id = $1 AND p.id = $2`,
      [districtId, playerId]
    );

    if (result.rows.length > 0) {
      const { controlling_crew_id, crew_id } = result.rows[0];
      if (controlling_crew_id && crew_id && controlling_crew_id === crew_id) {
        return TERRITORY_PAYOUT_BONUS;
      }
    }
  } catch (error) {
    console.error('Get territory bonus error:', error);
  }
  return 0;
}

export default router;
