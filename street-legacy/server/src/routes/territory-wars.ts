import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logDistrictEvent } from '../services/districtEcosystem.service.js';

const router = Router();

router.use(authMiddleware);

// Helper to get district ID string for ecosystem tracking
async function getDistrictIdString(districtNumericId: number): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT LOWER(REPLACE(name, ' ', '_')) as district_id FROM districts WHERE id = $1`,
      [districtNumericId]
    );
    return result.rows[0]?.district_id || null;
  } catch {
    return null;
  }
}

// War declaration cost
const WAR_DECLARATION_COST = 100000;
const WAR_PREP_HOURS = 24;
const WAR_DURATION_HOURS = 48;
const PEACE_TREATY_DAYS = 7;
const REVENGE_BONUS_DAYS = 30;

// Territory control benefits
const CONTROL_BENEFITS = {
  25: { incomeBonusPercent: 5, showOnMap: true },
  50: { incomeBonusPercent: 10, safehouseAccess: true },
  75: { incomeBonusPercent: 15, rivalPenaltyPercent: 10 },
  100: { incomeBonusPercent: 25, fullControl: true, specialOps: true }
};

// GET /api/territory-wars/map - Get territory control overview
router.get('/map', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's crew
    const crewResult = await pool.query(
      `SELECT cm.crew_id, c.name as crew_name
       FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       WHERE cm.player_id = $1`,
      [playerId]
    );
    const playerCrew = crewResult.rows[0];

    // Get all districts with control info (optimized: replaced correlated subquery with LEFT JOIN + aggregation)
    const districtsResult = await pool.query(
      `SELECT d.*,
              c.name as controlling_crew_name,
              cc.name as contesting_crew_name,
              COALESCE(war_counts.active_war_count, 0) as active_war_count
       FROM districts d
       LEFT JOIN crews c ON d.controlling_crew_id = c.id
       LEFT JOIN crews cc ON d.contesting_crew_id = cc.id
       LEFT JOIN (
         SELECT district_id, COUNT(*) as active_war_count
         FROM territory_wars
         WHERE status IN ('preparing', 'active')
         GROUP BY district_id
       ) war_counts ON war_counts.district_id = d.id
       ORDER BY d.id`
    );

    // Get active wars
    const warsResult = await pool.query(
      `SELECT tw.*,
              d.name as district_name,
              ac.name as attacker_crew_name,
              dc.name as defender_crew_name
       FROM territory_wars tw
       JOIN districts d ON tw.district_id = d.id
       JOIN crews ac ON tw.attacker_crew_id = ac.id
       JOIN crews dc ON tw.defender_crew_id = dc.id
       WHERE tw.status IN ('preparing', 'active')
       ORDER BY tw.started_at DESC`
    );

    const territories = districtsResult.rows.map(d => {
      // Calculate benefits based on control percentage
      let benefits = {};
      if (d.control_percentage >= 25) benefits = { ...benefits, ...CONTROL_BENEFITS[25] };
      if (d.control_percentage >= 50) benefits = { ...benefits, ...CONTROL_BENEFITS[50] };
      if (d.control_percentage >= 75) benefits = { ...benefits, ...CONTROL_BENEFITS[75] };
      if (d.control_percentage >= 100) benefits = { ...benefits, ...CONTROL_BENEFITS[100] };

      return {
        id: d.id,
        name: d.name,
        controllingCrewId: d.controlling_crew_id,
        controllingCrewName: d.controlling_crew_name,
        controlPercentage: d.control_percentage || 0,
        contested: d.contested,
        contestingCrewId: d.contesting_crew_id,
        contestingCrewName: d.contesting_crew_name,
        adjacentDistricts: d.adjacent_districts || [],
        hasActiveWar: d.active_war_count > 0,
        peaceUntil: d.peace_until,
        isUnderPeace: d.peace_until ? new Date(d.peace_until) > new Date() : false,
        benefits,
        isOwnTerritory: playerCrew && d.controlling_crew_id === playerCrew.crew_id
      };
    });

    const activeWars = warsResult.rows.map(w => ({
      id: w.id,
      districtId: w.district_id,
      districtName: w.district_name,
      attackerCrewId: w.attacker_crew_id,
      attackerCrewName: w.attacker_crew_name,
      defenderCrewId: w.defender_crew_id,
      defenderCrewName: w.defender_crew_name,
      status: w.status,
      attackerPoints: w.attacker_points,
      defenderPoints: w.defender_points,
      startedAt: w.started_at,
      prepEndsAt: w.prep_ends_at,
      endsAt: w.ends_at,
      isInvolved: playerCrew && (w.attacker_crew_id === playerCrew.crew_id || w.defender_crew_id === playerCrew.crew_id)
    }));

    res.json({
      success: true,
      data: {
        territories,
        activeWars,
        playerCrewId: playerCrew?.crew_id || null,
        playerCrewName: playerCrew?.crew_name || null
      }
    });
  } catch (error) {
    console.error('Get territory map error:', error);
    res.status(500).json({ success: false, error: 'Failed to get territory map' });
  }
});

// GET /api/territory-wars/active - Get current wars player is involved in
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's crew
    const crewResult = await pool.query(
      `SELECT crew_id FROM crew_members WHERE player_id = $1`,
      [playerId]
    );

    if (crewResult.rows.length === 0) {
      res.json({ success: true, data: { wars: [], isInCrew: false } });
      return;
    }

    const crewId = crewResult.rows[0].crew_id;

    // Get active wars for this crew (optimized: replaced correlated subqueries with LEFT JOIN + aggregation)
    const warsResult = await pool.query(
      `SELECT tw.*,
              d.name as district_name,
              ac.name as attacker_crew_name,
              dc.name as defender_crew_name,
              COUNT(pc.id) FILTER (WHERE pc.controlling_crew_id = tw.attacker_crew_id) as attacker_pois,
              COUNT(pc.id) FILTER (WHERE pc.controlling_crew_id = tw.defender_crew_id) as defender_pois
       FROM territory_wars tw
       JOIN districts d ON tw.district_id = d.id
       JOIN crews ac ON tw.attacker_crew_id = ac.id
       JOIN crews dc ON tw.defender_crew_id = dc.id
       LEFT JOIN poi_control pc ON pc.war_id = tw.id
       WHERE tw.status IN ('preparing', 'active')
       AND (tw.attacker_crew_id = $1 OR tw.defender_crew_id = $1)
       GROUP BY tw.id, d.name, ac.name, dc.name
       ORDER BY tw.started_at DESC`,
      [crewId]
    );

    const wars = await Promise.all(warsResult.rows.map(async w => {
      // Get recent events
      const eventsResult = await pool.query(
        `SELECT we.*, p.username as player_name, tp.username as target_name
         FROM war_events we
         LEFT JOIN players p ON we.player_id = p.id
         LEFT JOIN players tp ON we.target_player_id = tp.id
         WHERE we.war_id = $1
         ORDER BY we.occurred_at DESC
         LIMIT 20`,
        [w.id]
      );

      // Get player's war missions
      const missionsResult = await pool.query(
        `SELECT pwm.*, wm.name, wm.description, wm.mission_type, wm.points_reward, wm.icon
         FROM player_war_missions pwm
         JOIN war_missions wm ON pwm.mission_id = wm.id
         WHERE pwm.player_id = $1 AND pwm.war_id = $2 AND pwm.status IN ('assigned', 'in_progress')
         ORDER BY pwm.assigned_at DESC`,
        [playerId, w.id]
      );

      const isAttacker = w.attacker_crew_id === crewId;
      const timeRemaining = new Date(w.ends_at).getTime() - Date.now();
      const prepTimeRemaining = new Date(w.prep_ends_at).getTime() - Date.now();

      return {
        id: w.id,
        districtId: w.district_id,
        districtName: w.district_name,
        status: w.status,
        isAttacker,
        yourCrewName: isAttacker ? w.attacker_crew_name : w.defender_crew_name,
        enemyCrewName: isAttacker ? w.defender_crew_name : w.attacker_crew_name,
        yourPoints: isAttacker ? w.attacker_points : w.defender_points,
        enemyPoints: isAttacker ? w.defender_points : w.attacker_points,
        yourPois: isAttacker ? w.attacker_pois : w.defender_pois,
        enemyPois: isAttacker ? w.defender_pois : w.attacker_pois,
        startedAt: w.started_at,
        prepEndsAt: w.prep_ends_at,
        endsAt: w.ends_at,
        timeRemainingMs: timeRemaining > 0 ? timeRemaining : 0,
        prepTimeRemainingMs: prepTimeRemaining > 0 ? prepTimeRemaining : 0,
        isPrepping: w.status === 'preparing',
        cashPrize: w.cash_prize,
        recentEvents: eventsResult.rows.map(e => ({
          id: e.id,
          type: e.event_type,
          playerName: e.player_name,
          targetName: e.target_name,
          pointsEarned: e.points_earned,
          description: e.description,
          occurredAt: e.occurred_at
        })),
        activeMissions: missionsResult.rows.map(m => ({
          id: m.id,
          missionId: m.mission_id,
          name: m.name,
          description: m.description,
          type: m.mission_type,
          pointsReward: m.points_reward,
          status: m.status,
          expiresAt: m.expires_at,
          icon: m.icon
        }))
      };
    }));

    res.json({
      success: true,
      data: {
        wars,
        isInCrew: true,
        crewId
      }
    });
  } catch (error) {
    console.error('Get active wars error:', error);
    res.status(500).json({ success: false, error: 'Failed to get active wars' });
  }
});

// POST /api/territory-wars/declare - Declare war on a territory
router.post('/declare', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { districtId } = req.body;

    if (!districtId) {
      res.status(400).json({ success: false, error: 'District ID required' });
      return;
    }

    // Get player's crew and check permissions
    const crewResult = await pool.query(
      `SELECT cm.crew_id, cm.role, cm.war_role, c.name as crew_name, c.bank_balance, c.leader_id
       FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       WHERE cm.player_id = $1`,
      [playerId]
    );

    if (crewResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You must be in a crew to declare war' });
      return;
    }

    const crew = crewResult.rows[0];

    // Check if player can declare war (leader or warlord)
    if (crew.leader_id !== playerId && crew.war_role !== 'warlord') {
      res.status(403).json({ success: false, error: 'Only the crew leader or warlord can declare war' });
      return;
    }

    // Check crew bank balance
    if (crew.bank_balance < WAR_DECLARATION_COST) {
      res.status(400).json({
        success: false,
        error: `Not enough funds in crew bank. Need $${WAR_DECLARATION_COST.toLocaleString()}, have $${crew.bank_balance.toLocaleString()}`
      });
      return;
    }

    // Get target district
    const districtResult = await pool.query(
      `SELECT * FROM districts WHERE id = $1`,
      [districtId]
    );

    if (districtResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'District not found' });
      return;
    }

    const district = districtResult.rows[0];

    // Check if district is controlled by another crew
    if (!district.controlling_crew_id) {
      res.status(400).json({ success: false, error: 'This territory is not controlled by any crew' });
      return;
    }

    if (district.controlling_crew_id === crew.crew_id) {
      res.status(400).json({ success: false, error: 'You already control this territory' });
      return;
    }

    // Check adjacency - can only attack adjacent territories
    const adjacentCheck = await pool.query(
      `SELECT id FROM districts
       WHERE controlling_crew_id = $1
       AND $2 = ANY(adjacent_districts)`,
      [crew.crew_id, districtId]
    );

    // Also check if crew controls any adjacent district
    const ownedAdjacentCheck = await pool.query(
      `SELECT id FROM districts
       WHERE controlling_crew_id = $1
       AND id = ANY($2::int[])`,
      [crew.crew_id, district.adjacent_districts || []]
    );

    if (adjacentCheck.rows.length === 0 && ownedAdjacentCheck.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You can only attack adjacent territories' });
      return;
    }

    // Check peace treaty
    if (district.peace_until && new Date(district.peace_until) > new Date()) {
      res.status(400).json({
        success: false,
        error: `This territory is under peace treaty until ${new Date(district.peace_until).toLocaleDateString()}`
      });
      return;
    }

    // Check for existing active war on this district
    const existingWarResult = await pool.query(
      `SELECT id FROM territory_wars
       WHERE district_id = $1 AND status IN ('preparing', 'active')`,
      [districtId]
    );

    if (existingWarResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'There is already an active war for this territory' });
      return;
    }

    // Check for active war between these crews
    const crewWarResult = await pool.query(
      `SELECT id FROM territory_wars
       WHERE ((attacker_crew_id = $1 AND defender_crew_id = $2)
              OR (attacker_crew_id = $2 AND defender_crew_id = $1))
       AND status IN ('preparing', 'active')`,
      [crew.crew_id, district.controlling_crew_id]
    );

    if (crewWarResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Your crew is already at war with this crew' });
      return;
    }

    // Check for revenge bonus
    const revengeResult = await pool.query(
      `SELECT bonus_percentage FROM war_revenge_bonus
       WHERE crew_id = $1 AND against_crew_id = $2 AND expires_at > NOW()`,
      [crew.crew_id, district.controlling_crew_id]
    );
    const revengeBonus = revengeResult.rows[0]?.bonus_percentage || 0;

    // Deduct war cost from crew bank
    await pool.query(
      `UPDATE crews SET bank_balance = bank_balance - $1 WHERE id = $2`,
      [WAR_DECLARATION_COST, crew.crew_id]
    );

    // Create the war
    const prepEndsAt = new Date(Date.now() + WAR_PREP_HOURS * 60 * 60 * 1000);
    const endsAt = new Date(prepEndsAt.getTime() + WAR_DURATION_HOURS * 60 * 60 * 1000);

    const warResult = await pool.query(
      `INSERT INTO territory_wars
       (district_id, attacker_crew_id, defender_crew_id, prep_ends_at, ends_at, status, war_config)
       VALUES ($1, $2, $3, $4, $5, 'preparing', $6)
       RETURNING *`,
      [districtId, crew.crew_id, district.controlling_crew_id, prepEndsAt, endsAt,
       JSON.stringify({ revengeBonus, declarationCost: WAR_DECLARATION_COST })]
    );

    const war = warResult.rows[0];

    // Mark district as contested
    await pool.query(
      `UPDATE districts SET contested = true, contesting_crew_id = $1 WHERE id = $2`,
      [crew.crew_id, districtId]
    );

    // Initialize POI control for this war
    const poisResult = await pool.query(
      `SELECT id, metadata FROM points_of_interest WHERE district_id = $1`,
      [districtId]
    );

    for (const poi of poisResult.rows) {
      const strategicValue = poi.metadata?.strategic_value || 1;
      await pool.query(
        `INSERT INTO poi_control (poi_id, war_id, controlling_crew_id, strategic_value)
         VALUES ($1, $2, $3, $4)`,
        [poi.id, war.id, district.controlling_crew_id, strategicValue]
      );
    }

    // Log the war declaration event
    await pool.query(
      `INSERT INTO war_events (war_id, event_type, crew_id, player_id, description)
       VALUES ($1, 'war_declared', $2, $3, $4)`,
      [war.id, crew.crew_id, playerId, `${crew.crew_name} declared war for ${district.name}!`]
    );

    // Get defender crew name
    const defenderResult = await pool.query(
      `SELECT name FROM crews WHERE id = $1`,
      [district.controlling_crew_id]
    );

    res.json({
      success: true,
      data: {
        message: `War declared on ${district.name}!`,
        warId: war.id,
        districtName: district.name,
        defenderCrewName: defenderResult.rows[0]?.name,
        prepEndsAt,
        endsAt,
        cost: WAR_DECLARATION_COST,
        revengeBonus: revengeBonus > 0 ? `+${revengeBonus}% war points (revenge bonus)` : null
      }
    });

    // Log district ecosystem event (non-blocking)
    getDistrictIdString(districtId).then(districtIdStr => {
      if (districtIdStr) {
        logDistrictEvent({
          districtId: districtIdStr,
          eventType: 'crew_battle',
          playerId: String(playerId),
          crewId: String(crew.crew_id),
          severity: 7,
          metadata: {
            warId: war.id,
            attackingCrewId: crew.crew_id,
            attackingCrewName: crew.crew_name,
            defendingCrewId: district.controlling_crew_id,
            defendingCrewName: defenderResult.rows[0]?.name,
            phase: 'declared'
          }
        }).catch(err => console.error('District ecosystem log error:', err));
      }
    }).catch(err => console.error('District ID lookup error:', err));
  } catch (error) {
    console.error('Declare war error:', error);
    res.status(500).json({ success: false, error: 'Failed to declare war' });
  }
});

// GET /api/territory-wars/:warId/status - Get detailed war status
router.get('/:warId/status', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);

    // Get war details
    const warResult = await pool.query(
      `SELECT tw.*,
              d.name as district_name,
              ac.name as attacker_crew_name, ac.id as attacker_id,
              dc.name as defender_crew_name, dc.id as defender_id
       FROM territory_wars tw
       JOIN districts d ON tw.district_id = d.id
       JOIN crews ac ON tw.attacker_crew_id = ac.id
       JOIN crews dc ON tw.defender_crew_id = dc.id
       WHERE tw.id = $1`,
      [warId]
    );

    if (warResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'War not found' });
      return;
    }

    const war = warResult.rows[0];

    // Get player's crew
    const crewResult = await pool.query(
      `SELECT crew_id FROM crew_members WHERE player_id = $1`,
      [playerId]
    );
    const playerCrewId = crewResult.rows[0]?.crew_id;
    const isInvolved = playerCrewId === war.attacker_crew_id || playerCrewId === war.defender_crew_id;

    // Get POI control status
    const poiResult = await pool.query(
      `SELECT pc.*, poi.name as poi_name, poi.type as poi_type,
              c.name as controlling_crew_name,
              cap.name as capturing_crew_name
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       LEFT JOIN crews c ON pc.controlling_crew_id = c.id
       LEFT JOIN crews cap ON pc.capturing_crew_id = cap.id
       WHERE pc.war_id = $1`,
      [warId]
    );

    // Get top contributors
    const contributorsResult = await pool.query(
      `SELECT cm.player_id, p.username, cm.war_points, cm.war_kills, cm.war_role,
              CASE WHEN cm.crew_id = $2 THEN 'attacker' ELSE 'defender' END as side
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       WHERE cm.crew_id IN ($2, $3)
       AND cm.war_points > 0
       ORDER BY cm.war_points DESC
       LIMIT 10`,
      [warId, war.attacker_crew_id, war.defender_crew_id]
    );

    // Get recent events
    const eventsResult = await pool.query(
      `SELECT we.*, p.username as player_name, tp.username as target_name
       FROM war_events we
       LEFT JOIN players p ON we.player_id = p.id
       LEFT JOIN players tp ON we.target_player_id = tp.id
       WHERE we.war_id = $1
       ORDER BY we.occurred_at DESC
       LIMIT 50`,
      [warId]
    );

    const pois = poiResult.rows.map(p => ({
      poiId: p.poi_id,
      name: p.poi_name,
      type: p.poi_type,
      controllingCrewId: p.controlling_crew_id,
      controllingCrewName: p.controlling_crew_name,
      isContested: p.is_contested,
      capturingCrewId: p.capturing_crew_id,
      capturingCrewName: p.capturing_crew_name,
      captureProgress: p.capture_progress,
      strategicValue: p.strategic_value,
      pointsGenerated: p.points_generated
    }));

    res.json({
      success: true,
      data: {
        war: {
          id: war.id,
          districtId: war.district_id,
          districtName: war.district_name,
          status: war.status,
          attackerCrewId: war.attacker_crew_id,
          attackerCrewName: war.attacker_crew_name,
          defenderCrewId: war.defender_crew_id,
          defenderCrewName: war.defender_crew_name,
          attackerPoints: war.attacker_points,
          defenderPoints: war.defender_points,
          startedAt: war.started_at,
          prepEndsAt: war.prep_ends_at,
          endsAt: war.ends_at,
          cashPrize: war.cash_prize,
          isPrepping: war.status === 'preparing',
          timeRemainingMs: Math.max(0, new Date(war.ends_at).getTime() - Date.now())
        },
        pois,
        topContributors: contributorsResult.rows,
        recentEvents: eventsResult.rows.map(e => ({
          id: e.id,
          type: e.event_type,
          crewId: e.crew_id,
          playerName: e.player_name,
          targetName: e.target_name,
          pointsEarned: e.points_earned,
          description: e.description,
          occurredAt: e.occurred_at
        })),
        isInvolved,
        playerCrewId,
        playerSide: playerCrewId === war.attacker_crew_id ? 'attacker' :
                    playerCrewId === war.defender_crew_id ? 'defender' : null
      }
    });
  } catch (error) {
    console.error('Get war status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get war status' });
  }
});

// GET /api/territory-wars/:warId/missions - Get available war missions
router.get('/:warId/missions', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);

    // Verify player is in the war
    const memberResult = await pool.query(
      `SELECT cm.crew_id, cm.war_role, p.level
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not involved in this war' });
      return;
    }

    const { crew_id, war_role, level } = memberResult.rows[0];

    // Get war status
    const warResult = await pool.query(
      `SELECT status FROM territory_wars WHERE id = $1`,
      [warId]
    );

    if (warResult.rows[0]?.status !== 'active') {
      res.status(400).json({ success: false, error: 'War is not active' });
      return;
    }

    // Get available missions based on role and level
    const missionsResult = await pool.query(
      `SELECT * FROM war_missions
       WHERE is_active = true
       AND min_level <= $1
       AND (required_role IS NULL OR required_role = $2)
       ORDER BY points_reward DESC`,
      [level, war_role]
    );

    // Get player's current missions and cooldowns
    const playerMissionsResult = await pool.query(
      `SELECT mission_id, status, completed_at
       FROM player_war_missions
       WHERE player_id = $1 AND war_id = $2
       ORDER BY assigned_at DESC`,
      [playerId, warId]
    );

    const activeMissionIds = new Set(
      playerMissionsResult.rows
        .filter(m => m.status === 'assigned' || m.status === 'in_progress')
        .map(m => m.mission_id)
    );

    const cooldowns: Record<number, Date> = {};
    for (const m of playerMissionsResult.rows) {
      if (m.completed_at) {
        const mission = missionsResult.rows.find(wm => wm.id === m.mission_id);
        if (mission) {
          const cooldownEnd = new Date(new Date(m.completed_at).getTime() + mission.cooldown_minutes * 60 * 1000);
          if (cooldownEnd > new Date() && (!cooldowns[m.mission_id] || cooldownEnd > cooldowns[m.mission_id])) {
            cooldowns[m.mission_id] = cooldownEnd;
          }
        }
      }
    }

    const missions = missionsResult.rows.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      type: m.mission_type,
      pointsReward: m.points_reward,
      cashReward: m.cash_reward,
      xpReward: m.xp_reward,
      staminaCost: m.stamina_cost,
      focusCost: m.focus_cost,
      successRate: m.success_rate,
      requiredRole: m.required_role,
      cooldownMinutes: m.cooldown_minutes,
      icon: m.icon,
      isActive: activeMissionIds.has(m.id),
      onCooldown: !!cooldowns[m.id],
      cooldownEndsAt: cooldowns[m.id] || null,
      canAccept: !activeMissionIds.has(m.id) && !cooldowns[m.id]
    }));

    res.json({
      success: true,
      data: {
        missions,
        playerRole: war_role,
        activeMissionCount: activeMissionIds.size
      }
    });
  } catch (error) {
    console.error('Get war missions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get war missions' });
  }
});

// POST /api/territory-wars/:warId/mission - Accept and attempt a war mission
router.post('/:warId/mission', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);
    const { missionId } = req.body;

    if (!missionId) {
      res.status(400).json({ success: false, error: 'Mission ID required' });
      return;
    }

    // Verify player is in the war
    const memberResult = await pool.query(
      `SELECT cm.crew_id, cm.war_role, p.level, p.stamina, p.focus
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2 AND tw.status = 'active'`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not involved in an active war' });
      return;
    }

    const { crew_id, war_role, level, stamina, focus } = memberResult.rows[0];

    // Get mission details
    const missionResult = await pool.query(
      `SELECT * FROM war_missions WHERE id = $1 AND is_active = true`,
      [missionId]
    );

    if (missionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Mission not found' });
      return;
    }

    const mission = missionResult.rows[0];

    // Check requirements
    if (level < mission.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${mission.min_level}` });
      return;
    }

    if (mission.required_role && war_role !== mission.required_role) {
      res.status(400).json({ success: false, error: `Requires ${mission.required_role} role` });
      return;
    }

    if (stamina < mission.stamina_cost) {
      res.status(400).json({ success: false, error: 'Not enough stamina' });
      return;
    }

    if (focus < mission.focus_cost) {
      res.status(400).json({ success: false, error: 'Not enough focus' });
      return;
    }

    // Check cooldown
    const cooldownResult = await pool.query(
      `SELECT completed_at FROM player_war_missions
       WHERE player_id = $1 AND mission_id = $2
       ORDER BY completed_at DESC LIMIT 1`,
      [playerId, missionId]
    );

    if (cooldownResult.rows.length > 0) {
      const lastCompleted = new Date(cooldownResult.rows[0].completed_at);
      const cooldownEnd = new Date(lastCompleted.getTime() + mission.cooldown_minutes * 60 * 1000);
      if (cooldownEnd > new Date()) {
        res.status(400).json({
          success: false,
          error: 'Mission on cooldown',
          cooldownEndsAt: cooldownEnd
        });
        return;
      }
    }

    // Deduct stamina and focus
    await pool.query(
      `UPDATE players SET stamina = stamina - $1, focus = focus - $2 WHERE id = $3`,
      [mission.stamina_cost, mission.focus_cost, playerId]
    );

    // Check for revenge bonus
    const warResult = await pool.query(
      `SELECT tw.*, wrb.bonus_percentage as revenge_bonus
       FROM territory_wars tw
       LEFT JOIN war_revenge_bonus wrb ON
         (wrb.crew_id = $1 AND wrb.against_crew_id =
           CASE WHEN tw.attacker_crew_id = $1 THEN tw.defender_crew_id ELSE tw.attacker_crew_id END
         AND wrb.expires_at > NOW())
       WHERE tw.id = $2`,
      [crew_id, warId]
    );
    const war = warResult.rows[0];
    const revengeBonus = war.revenge_bonus || 0;

    // Calculate success
    let successRate = mission.success_rate;
    if (war_role === 'spy' && mission.mission_type === 'intel') successRate += 15;
    if (war_role === 'soldier' && mission.mission_type === 'combat') successRate += 10;
    if (war_role === 'engineer' && mission.mission_type === 'sabotage') successRate += 15;
    if (war_role === 'medic' && mission.mission_type === 'support') successRate += 20;

    const roll = Math.random() * 100;
    const success = roll < successRate;

    // Calculate points
    let pointsEarned = 0;
    if (success) {
      pointsEarned = mission.points_reward;
      // Apply revenge bonus
      if (revengeBonus > 0) {
        pointsEarned = Math.floor(pointsEarned * (1 + revengeBonus / 100));
      }
      // Role bonus for soldiers
      if (war_role === 'soldier') {
        pointsEarned = Math.floor(pointsEarned * 1.1);
      }
    }

    // Record mission attempt
    await pool.query(
      `INSERT INTO player_war_missions (player_id, war_id, mission_id, status, completed_at, points_earned)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [playerId, warId, missionId, success ? 'completed' : 'failed', pointsEarned]
    );

    // Update war points
    if (pointsEarned > 0) {
      const isAttacker = war.attacker_crew_id === crew_id;
      const pointColumn = isAttacker ? 'attacker_points' : 'defender_points';

      await pool.query(
        `UPDATE territory_wars SET ${pointColumn} = ${pointColumn} + $1 WHERE id = $2`,
        [pointsEarned, warId]
      );

      // Update player war stats
      await pool.query(
        `UPDATE crew_members SET war_points = war_points + $1, last_war_action = NOW()
         WHERE player_id = $2 AND crew_id = $3`,
        [pointsEarned, playerId, crew_id]
      );
    }

    // Log war event
    const playerResult = await pool.query(`SELECT username FROM players WHERE id = $1`, [playerId]);
    await pool.query(
      `INSERT INTO war_events (war_id, event_type, crew_id, player_id, points_earned, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [warId, success ? 'mission_completed' : 'mission_failed', crew_id, playerId, pointsEarned,
       success ? `${playerResult.rows[0].username} completed ${mission.name} (+${pointsEarned} pts)`
               : `${playerResult.rows[0].username} failed ${mission.name}`]
    );

    // Award rewards if successful
    if (success) {
      if (mission.cash_reward > 0) {
        await pool.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [mission.cash_reward, playerId]
        );
      }
      if (mission.xp_reward > 0) {
        await pool.query(
          `UPDATE players SET xp = xp + $1 WHERE id = $2`,
          [mission.xp_reward, playerId]
        );
      }
    }

    res.json({
      success: true,
      data: {
        missionSuccess: success,
        missionName: mission.name,
        pointsEarned,
        cashEarned: success ? mission.cash_reward : 0,
        xpEarned: success ? mission.xp_reward : 0,
        revengeBonus: revengeBonus > 0 ? `+${revengeBonus}%` : null,
        message: success
          ? `Mission completed! Earned ${pointsEarned} war points.`
          : 'Mission failed. Better luck next time.',
        cooldownMinutes: mission.cooldown_minutes
      }
    });
  } catch (error) {
    console.error('War mission error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete war mission' });
  }
});

// Process war endings (call periodically)
export async function processWarEndings(): Promise<void> {
  try {
    // Activate wars that have finished prep
    await pool.query(
      `UPDATE territory_wars
       SET status = 'active'
       WHERE status = 'preparing' AND prep_ends_at <= NOW()`
    );

    // Get wars that have ended
    const endedWars = await pool.query(
      `SELECT tw.*, d.name as district_name,
              ac.name as attacker_name, dc.name as defender_name
       FROM territory_wars tw
       JOIN districts d ON tw.district_id = d.id
       JOIN crews ac ON tw.attacker_crew_id = ac.id
       JOIN crews dc ON tw.defender_crew_id = dc.id
       WHERE tw.status = 'active' AND tw.ends_at <= NOW()`
    );

    for (const war of endedWars.rows) {
      let winner: 'attacker' | 'defender' | 'stalemate';
      let winnerCrewId: number | null = null;
      let loserCrewId: number | null = null;

      // Determine winner
      if (war.attacker_points > war.defender_points * 1.1) {
        winner = 'attacker';
        winnerCrewId = war.attacker_crew_id;
        loserCrewId = war.defender_crew_id;
      } else if (war.defender_points > war.attacker_points * 1.1) {
        winner = 'defender';
        winnerCrewId = war.defender_crew_id;
        loserCrewId = war.attacker_crew_id;
      } else {
        winner = 'stalemate';
      }

      const newStatus = winner === 'attacker' ? 'attacker_won' :
                        winner === 'defender' ? 'defender_won' : 'stalemate';

      await pool.query(
        `UPDATE territory_wars SET status = $1 WHERE id = $2`,
        [newStatus, war.id]
      );

      // Apply consequences
      const peaceUntil = new Date(Date.now() + PEACE_TREATY_DAYS * 24 * 60 * 60 * 1000);

      if (winner !== 'stalemate' && winnerCrewId && loserCrewId) {
        // Winner takes territory
        await pool.query(
          `UPDATE districts
           SET controlling_crew_id = $1, control_percentage = 100,
               contested = false, contesting_crew_id = NULL,
               last_war_end = NOW(), peace_until = $2
           WHERE id = $3`,
          [winnerCrewId, peaceUntil, war.district_id]
        );

        // Transfer 20% of loser's bank to winner, plus cash prize
        const loserBankResult = await pool.query(
          `SELECT bank_balance FROM crews WHERE id = $1`,
          [loserCrewId]
        );
        const loserBank = loserBankResult.rows[0]?.bank_balance || 0;
        const seizure = Math.floor(loserBank * 0.2);
        const totalReward = war.cash_prize + seizure;

        await pool.query(
          `UPDATE crews SET bank_balance = bank_balance - $1, war_debuff_until = NOW() + INTERVAL '24 hours', last_war_lost = NOW()
           WHERE id = $2`,
          [seizure, loserCrewId]
        );

        await pool.query(
          `UPDATE crews SET bank_balance = bank_balance + $1, last_war_won = NOW()
           WHERE id = $2`,
          [totalReward, winnerCrewId]
        );

        // Update war stats
        await pool.query(
          `UPDATE crew_war_stats SET wars_won = wars_won + 1, territories_captured = territories_captured + 1,
           cash_won = cash_won + $1, current_war_streak = current_war_streak + 1,
           best_war_streak = GREATEST(best_war_streak, current_war_streak + 1), last_war_date = NOW()
           WHERE crew_id = $2`,
          [totalReward, winnerCrewId]
        );

        await pool.query(
          `UPDATE crew_war_stats SET wars_lost = wars_lost + 1, territories_lost = territories_lost + 1,
           cash_lost = cash_lost + $1, current_war_streak = 0, last_war_date = NOW()
           WHERE crew_id = $2`,
          [seizure, loserCrewId]
        );

        // Create revenge bonus for loser
        const revengeExpires = new Date(Date.now() + REVENGE_BONUS_DAYS * 24 * 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO war_revenge_bonus (crew_id, against_crew_id, original_war_id, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (crew_id, against_crew_id) DO UPDATE SET
           original_war_id = $3, expires_at = $4, bonus_percentage = 10`,
          [loserCrewId, winnerCrewId, war.id, revengeExpires]
        );

        // Log event
        await pool.query(
          `INSERT INTO war_events (war_id, event_type, description)
           VALUES ($1, 'war_ended', $2)`,
          [war.id, `${winner === 'attacker' ? war.attacker_name : war.defender_name} won the war for ${war.district_name}!`]
        );

        // Log district ecosystem event for territory change
        getDistrictIdString(war.district_id).then(districtIdStr => {
          if (districtIdStr) {
            // Log crew battle event (high severity - war ended)
            logDistrictEvent({
              districtId: districtIdStr,
              eventType: 'crew_battle',
              crewId: String(winnerCrewId),
              severity: 10,
              metadata: {
                warId: war.id,
                winnerCrewId,
                winnerCrewName: winner === 'attacker' ? war.attacker_name : war.defender_name,
                loserCrewId,
                loserCrewName: winner === 'attacker' ? war.defender_name : war.attacker_name,
                outcome: newStatus,
                phase: 'ended'
              }
            }).catch(err => console.error('District ecosystem log error:', err));

            // Log territory claimed event
            logDistrictEvent({
              districtId: districtIdStr,
              eventType: 'territory_claimed',
              crewId: String(winnerCrewId),
              severity: 8,
              metadata: {
                warId: war.id,
                claimedBy: winnerCrewId,
                claimedByName: winner === 'attacker' ? war.attacker_name : war.defender_name,
                previousOwner: loserCrewId
              }
            }).catch(err => console.error('District ecosystem log error:', err));
          }
        }).catch(err => console.error('District ID lookup error:', err));

      } else {
        // Stalemate - split territory 50/50, both lose $25k
        await pool.query(
          `UPDATE districts SET control_percentage = 50, contested = false, contesting_crew_id = NULL,
           last_war_end = NOW(), peace_until = $1
           WHERE id = $2`,
          [peaceUntil, war.district_id]
        );

        await pool.query(
          `UPDATE crews SET bank_balance = GREATEST(0, bank_balance - 25000) WHERE id IN ($1, $2)`,
          [war.attacker_crew_id, war.defender_crew_id]
        );

        await pool.query(
          `UPDATE crew_war_stats SET wars_stalemated = wars_stalemated + 1, cash_lost = cash_lost + 25000, last_war_date = NOW()
           WHERE crew_id IN ($1, $2)`,
          [war.attacker_crew_id, war.defender_crew_id]
        );

        await pool.query(
          `INSERT INTO war_events (war_id, event_type, description)
           VALUES ($1, 'war_ended', $2)`,
          [war.id, `The war for ${war.district_name} ended in a stalemate. Territory split 50/50.`]
        );
      }

      // Create peace treaty
      await pool.query(
        `INSERT INTO peace_treaties (crew1_id, crew2_id, district_id, war_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [war.attacker_crew_id, war.defender_crew_id, war.district_id, war.id, peaceUntil]
      );

      // Clean up POI control
      await pool.query(`DELETE FROM poi_control WHERE war_id = $1`, [war.id]);

      // Reset player war stats for both crews
      await pool.query(
        `UPDATE crew_members SET war_points = 0, war_kills = 0, war_deaths = 0
         WHERE crew_id IN ($1, $2)`,
        [war.attacker_crew_id, war.defender_crew_id]
      );
    }

    if (endedWars.rows.length > 0) {
      console.log(`Processed ${endedWars.rows.length} war endings`);
    }
  } catch (error) {
    console.error('Process war endings error:', error);
  }
}

// Award POI control points (call periodically)
export async function awardPoiControlPoints(): Promise<void> {
  try {
    // Get active wars with POIs
    const poisResult = await pool.query(
      `SELECT pc.*, tw.attacker_crew_id, tw.defender_crew_id
       FROM poi_control pc
       JOIN territory_wars tw ON pc.war_id = tw.id
       WHERE tw.status = 'active'
       AND pc.controlling_crew_id IS NOT NULL
       AND pc.is_contested = false
       AND (pc.last_point_tick IS NULL OR pc.last_point_tick < NOW() - INTERVAL '1 hour')`
    );

    for (const poi of poisResult.rows) {
      const points = poi.strategic_value * 10; // 10 or 20 points per hour
      const isAttacker = poi.controlling_crew_id === poi.attacker_crew_id;
      const column = isAttacker ? 'attacker_points' : 'defender_points';

      await pool.query(
        `UPDATE territory_wars SET ${column} = ${column} + $1 WHERE id = $2`,
        [points, poi.war_id]
      );

      await pool.query(
        `UPDATE poi_control SET points_generated = points_generated + $1, last_point_tick = NOW()
         WHERE id = $2`,
        [points, poi.id]
      );
    }

    if (poisResult.rows.length > 0) {
      console.log(`Awarded POI control points for ${poisResult.rows.length} POIs`);
    }
  } catch (error) {
    console.error('Award POI control points error:', error);
  }
}

export default router;
