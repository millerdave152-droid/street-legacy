import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { cache, cacheTTL } from '../utils/cache.js';
import { sendToUser } from '../websocket/index.js';
import { createNotification } from '../websocket/events.js';

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

// =============================================================================
// TERRITORY INVESTMENT ENDPOINTS
// =============================================================================

// GET /api/territory/investments/:districtId - Get investments for a district
router.get('/investments/:districtId', async (req: AuthRequest, res: Response) => {
  try {
    const { districtId } = req.params;

    const result = await pool.query(
      'SELECT * FROM get_district_investments($1)',
      [districtId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        crewId: row.crew_id,
        crewName: row.crew_name,
        crewTag: row.crew_tag,
        investments: {
          security: parseInt(row.security_investment) || 0,
          corruption: parseInt(row.corruption_investment) || 0,
          business: parseInt(row.business_investment) || 0,
          street: parseInt(row.street_investment) || 0
        },
        influence: {
          security: row.security_influence,
          corruption: row.corruption_influence,
          business: row.business_influence,
          street: row.street_influence
        },
        totalInvested: parseInt(row.total_invested) || 0,
        rank: parseInt(row.rank)
      }))
    });
  } catch (error) {
    console.error('Get district investments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get investments' });
  }
});

// GET /api/territory/investments/my/all - Get player's crew investments
router.get('/investments/my/all', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's crew
    const crewResult = await pool.query(
      'SELECT crew_id FROM players WHERE id = $1',
      [playerId]
    );

    if (!crewResult.rows[0]?.crew_id) {
      return res.status(400).json({ success: false, error: 'You must be in a crew to view investments' });
    }

    const crewId = crewResult.rows[0].crew_id;

    const result = await pool.query(
      'SELECT * FROM get_crew_investments($1)',
      [crewId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        districtId: row.district_id,
        districtName: row.district_name,
        investments: {
          security: parseInt(row.security_investment) || 0,
          corruption: parseInt(row.corruption_investment) || 0,
          business: parseInt(row.business_investment) || 0,
          street: parseInt(row.street_investment) || 0
        },
        totalInvested: parseInt(row.total_invested) || 0,
        districtRank: parseInt(row.district_rank)
      }))
    });
  } catch (error) {
    console.error('Get crew investments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get investments' });
  }
});

// GET /api/territory/modifiers/:districtId - Get investment modifiers for a district
router.get('/modifiers/:districtId', async (req: AuthRequest, res: Response) => {
  try {
    const { districtId } = req.params;

    const result = await pool.query(
      'SELECT * FROM get_district_investment_modifiers($1)',
      [districtId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          policePresenceMod: 1.0,
          policeEffectivenessMod: 1.0,
          propertyIncomeMod: 1.0,
          crimePayoutMod: 1.0,
          dominantCrew: null
        }
      });
    }

    const mods = result.rows[0];

    res.json({
      success: true,
      data: {
        policePresenceMod: parseFloat(mods.police_presence_mod),
        policeEffectivenessMod: parseFloat(mods.police_effectiveness_mod),
        propertyIncomeMod: parseFloat(mods.property_income_mod),
        crimePayoutMod: parseFloat(mods.crime_payout_mod),
        dominantCrew: mods.dominant_crew_id ? {
          id: mods.dominant_crew_id,
          name: mods.dominant_crew_name
        } : null
      }
    });
  } catch (error) {
    console.error('Get district modifiers error:', error);
    res.status(500).json({ success: false, error: 'Failed to get modifiers' });
  }
});

// GET /api/territory/investments/leaderboard/:districtId - Get investor leaderboard
router.get('/investments/leaderboard/:districtId', async (req: AuthRequest, res: Response) => {
  try {
    const { districtId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await pool.query(
      'SELECT * FROM get_district_investor_leaderboard($1, $2)',
      [districtId, limit]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        rank: parseInt(row.rank),
        crewId: row.crew_id,
        crewName: row.crew_name,
        crewTag: row.crew_tag,
        totalInvested: parseInt(row.total_invested),
        dominantType: row.dominant_type
      }))
    });
  } catch (error) {
    console.error('Get investor leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

// POST /api/territory/invest - Make an investment in a district
router.post('/invest', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { districtId, investmentType, amount } = req.body;

    if (!districtId || !investmentType || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: districtId, investmentType, amount'
      });
    }

    // Validate investment type
    const validTypes = ['security', 'corruption', 'business', 'street'];
    if (!validTypes.includes(investmentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid investment type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Get player's crew
    const crewResult = await pool.query(
      `SELECT p.crew_id, c.name as crew_name, cm.role
       FROM players p
       JOIN crews c ON p.crew_id = c.id
       LEFT JOIN crew_members cm ON cm.player_id = p.id AND cm.crew_id = c.id
       WHERE p.id = $1`,
      [playerId]
    );

    if (!crewResult.rows[0]?.crew_id) {
      return res.status(400).json({ success: false, error: 'You must be in a crew to invest' });
    }

    const crew = crewResult.rows[0];

    // Check if player has permission (leader or officer)
    if (!['leader', 'officer'].includes(crew.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only crew leaders and officers can make investments'
      });
    }

    // Make investment
    const result = await pool.query(
      'SELECT * FROM make_territory_investment($1, $2, $3, $4, $5)',
      [crew.crew_id, playerId, districtId, investmentType, amount]
    );

    const investResult = result.rows[0];

    if (!investResult.success) {
      return res.status(400).json({
        success: false,
        error: investResult.error_message
      });
    }

    // Get district name for notification
    const districtResult = await pool.query(
      'SELECT name FROM districts WHERE id = $1',
      [districtId]
    );
    const districtName = districtResult.rows[0]?.name || districtId;

    res.json({
      success: true,
      data: {
        newInfluence: investResult.new_influence,
        totalInvested: parseInt(investResult.total_invested)
      },
      message: `Invested $${amount.toLocaleString()} in ${investmentType} for ${districtName}. Influence: ${investResult.new_influence}`
    });
  } catch (error) {
    console.error('Territory investment error:', error);
    res.status(500).json({ success: false, error: 'Failed to make investment' });
  }
});

// =============================================================================
// HEIST CONTRACT ENDPOINTS
// =============================================================================

// GET /api/territory/contracts - Get open contracts
router.get('/contracts', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await pool.query(
      'SELECT * FROM get_open_contracts($1)',
      [limit]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        funderId: row.funder_id,
        funderUsername: row.funder_username,
        targetType: row.target_type,
        targetDescription: row.target_description,
        fundedAmount: parseInt(row.funded_amount),
        executorSplitPercent: row.executor_split_percent,
        expiresAt: row.expires_at,
        timeRemainingMs: row.time_remaining ?
          parseInt(row.time_remaining.hours || 0) * 3600000 +
          parseInt(row.time_remaining.minutes || 0) * 60000 : 0
      }))
    });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get contracts' });
  }
});

// GET /api/territory/contracts/my - Get player's contracts
router.get('/contracts/my', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT hc.*,
              fp.username as funder_username,
              ep.username as executor_username
       FROM heist_contracts hc
       JOIN players fp ON hc.funder_id = fp.id
       LEFT JOIN players ep ON hc.executor_id = ep.id
       WHERE hc.funder_id = $1 OR hc.executor_id = $1
       ORDER BY hc.created_at DESC
       LIMIT 20`,
      [playerId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        funderId: row.funder_id,
        funderUsername: row.funder_username,
        executorId: row.executor_id,
        executorUsername: row.executor_username,
        targetType: row.target_type,
        targetDescription: row.target_description,
        fundedAmount: parseInt(row.funded_amount),
        executorSplitPercent: row.executor_split_percent,
        status: row.status,
        payoutAmount: row.payout_amount ? parseInt(row.payout_amount) : null,
        executorPayout: row.executor_payout ? parseInt(row.executor_payout) : null,
        funderPayout: row.funder_payout ? parseInt(row.funder_payout) : null,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      }))
    });
  } catch (error) {
    console.error('Get my contracts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get contracts' });
  }
});

// POST /api/territory/contracts - Create a new contract
router.post('/contracts', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { targetType, targetDescription, fundedAmount, executorSplit = 70 } = req.body;

    if (!targetType || !targetDescription || !fundedAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: targetType, targetDescription, fundedAmount'
      });
    }

    const validTypes = ['heist', 'crime', 'territory'];
    if (!validTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid target type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const result = await pool.query(
      'SELECT * FROM create_heist_contract($1, $2, $3, $4, $5)',
      [playerId, targetType, targetDescription, fundedAmount, executorSplit]
    );

    const createResult = result.rows[0];

    if (!createResult.success) {
      return res.status(400).json({
        success: false,
        error: createResult.error_message
      });
    }

    res.json({
      success: true,
      data: { contractId: createResult.contract_id },
      message: `Contract created with $${fundedAmount.toLocaleString()} funding. ${executorSplit}% goes to executor.`
    });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ success: false, error: 'Failed to create contract' });
  }
});

// POST /api/territory/contracts/:id/accept - Accept a contract
router.post('/contracts/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM accept_heist_contract($1, $2)',
      [id, playerId]
    );

    const acceptResult = result.rows[0];

    if (!acceptResult.success) {
      return res.status(400).json({
        success: false,
        error: acceptResult.error_message
      });
    }

    // Get contract details for notification
    const contractResult = await pool.query(
      `SELECT hc.*, p.username as executor_username
       FROM heist_contracts hc
       JOIN players p ON p.id = $2
       WHERE hc.id = $1`,
      [id, playerId]
    );

    if (contractResult.rows.length > 0) {
      const contract = contractResult.rows[0];
      sendToUser(contract.funder_id, createNotification(
        'info',
        'Contract Accepted!',
        `${contract.executor_username} accepted your contract: "${contract.target_description}"`
      ));
    }

    res.json({
      success: true,
      message: 'Contract accepted! Complete the task to earn your payout.'
    });
  } catch (error) {
    console.error('Accept contract error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept contract' });
  }
});

// POST /api/territory/contracts/:id/cancel - Cancel own contract (funder only)
router.post('/contracts/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { id } = req.params;

    // Check contract belongs to player and is open
    const contractResult = await pool.query(
      `SELECT * FROM heist_contracts WHERE id = $1 AND funder_id = $2 AND status = 'open'`,
      [id, playerId]
    );

    if (contractResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Contract not found or cannot be cancelled'
      });
    }

    const contract = contractResult.rows[0];

    // Refund and cancel
    await pool.query('UPDATE players SET cash_balance = cash_balance + $1 WHERE id = $2',
      [contract.funded_amount, playerId]);
    await pool.query(`UPDATE heist_contracts SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);

    res.json({
      success: true,
      data: { refundAmount: parseInt(contract.funded_amount) },
      message: `Contract cancelled. Refunded $${parseInt(contract.funded_amount).toLocaleString()}`
    });
  } catch (error) {
    console.error('Cancel contract error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel contract' });
  }
});

export default router;
