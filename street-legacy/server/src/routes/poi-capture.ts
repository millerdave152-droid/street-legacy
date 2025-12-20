import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Capture timing constants
const BASE_CAPTURE_TIME_MINUTES = 10;
const PRESENCE_TIMEOUT_MINUTES = 5;

// GET /api/poi-capture/:warId/status - Get POI control status for a war
router.get('/:warId/status', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);

    // Verify player is in the war
    const memberResult = await pool.query(
      `SELECT cm.crew_id, cm.war_role
       FROM crew_members cm
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not involved in this war' });
      return;
    }

    const { crew_id } = memberResult.rows[0];

    // Get war info
    const warResult = await pool.query(
      `SELECT tw.*, d.name as district_name
       FROM territory_wars tw
       JOIN districts d ON tw.district_id = d.id
       WHERE tw.id = $1`,
      [warId]
    );

    if (warResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'War not found' });
      return;
    }

    const war = warResult.rows[0];

    // Get all POIs for this war
    const poisResult = await pool.query(
      `SELECT pc.*, poi.name as poi_name, poi.type as poi_type, poi.metadata,
              c.name as controlling_crew_name,
              cap.name as capturing_crew_name,
              p.username as capturing_player_name
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       LEFT JOIN crews c ON pc.controlling_crew_id = c.id
       LEFT JOIN crews cap ON pc.capturing_crew_id = cap.id
       LEFT JOIN players p ON pc.capturing_player_id = p.id
       WHERE pc.war_id = $1`,
      [warId]
    );

    // Get player presence at POIs
    const presenceResult = await pool.query(
      `SELECT poi_id, entered_at, last_action FROM player_poi_presence
       WHERE player_id = $1 AND war_id = $2`,
      [playerId, warId]
    );
    const playerPresence: Record<number, { enteredAt: string; lastAction: string }> = {};
    for (const p of presenceResult.rows) {
      playerPresence[p.poi_id] = { enteredAt: p.entered_at, lastAction: p.last_action };
    }

    // Get presence counts per POI - SECURITY: Use make_interval
    const presenceCountsResult = await pool.query(
      `SELECT ppp.poi_id, cm.crew_id, COUNT(*) as count
       FROM player_poi_presence ppp
       JOIN crew_members cm ON ppp.player_id = cm.player_id
       WHERE ppp.war_id = $1
       AND ppp.last_action > NOW() - make_interval(mins => $2)
       GROUP BY ppp.poi_id, cm.crew_id`,
      [warId, PRESENCE_TIMEOUT_MINUTES]
    );

    const presenceCounts: Record<number, { attacker: number; defender: number }> = {};
    for (const pc of presenceCountsResult.rows) {
      if (!presenceCounts[pc.poi_id]) {
        presenceCounts[pc.poi_id] = { attacker: 0, defender: 0 };
      }
      if (pc.crew_id === war.attacker_crew_id) {
        presenceCounts[pc.poi_id].attacker = parseInt(pc.count);
      } else if (pc.crew_id === war.defender_crew_id) {
        presenceCounts[pc.poi_id].defender = parseInt(pc.count);
      }
    }

    const isAttacker = crew_id === war.attacker_crew_id;

    const pois = poisResult.rows.map(poi => {
      const captureTimeMinutes = poi.metadata?.capture_time_minutes || BASE_CAPTURE_TIME_MINUTES;
      const presence = presenceCounts[poi.poi_id] || { attacker: 0, defender: 0 };
      const yourPresence = isAttacker ? presence.attacker : presence.defender;
      const enemyPresence = isAttacker ? presence.defender : presence.attacker;

      const isYourPoi = poi.controlling_crew_id === crew_id;
      const isEnemyPoi = poi.controlling_crew_id && poi.controlling_crew_id !== crew_id;
      const isNeutral = !poi.controlling_crew_id;

      const youAreCapturing = poi.capturing_crew_id === crew_id;
      const enemyIsCapturing = poi.capturing_crew_id && poi.capturing_crew_id !== crew_id;

      return {
        poiId: poi.poi_id,
        name: poi.poi_name,
        type: poi.poi_type,
        strategicValue: poi.strategic_value,
        controllingCrewId: poi.controlling_crew_id,
        controllingCrewName: poi.controlling_crew_name,
        isYourPoi,
        isEnemyPoi,
        isNeutral,
        isContested: poi.is_contested,
        capturingCrewId: poi.capturing_crew_id,
        capturingCrewName: poi.capturing_crew_name,
        capturingPlayerName: poi.capturing_player_name,
        captureProgress: poi.capture_progress,
        captureTimeMinutes,
        youAreCapturing,
        enemyIsCapturing,
        pointsGenerated: poi.points_generated,
        yourPresence,
        enemyPresence,
        youArePresent: !!playerPresence[poi.poi_id],
        canCapture: (isNeutral || isEnemyPoi) && !youAreCapturing && !poi.is_contested,
        canContest: enemyIsCapturing && !poi.is_contested
      };
    });

    res.json({
      success: true,
      data: {
        warId,
        districtName: war.district_name,
        status: war.status,
        pois,
        summary: {
          total: pois.length,
          yourControl: pois.filter(p => p.isYourPoi).length,
          enemyControl: pois.filter(p => p.isEnemyPoi).length,
          neutral: pois.filter(p => p.isNeutral).length,
          contested: pois.filter(p => p.isContested).length,
          beingCapturedByYou: pois.filter(p => p.youAreCapturing).length,
          beingCapturedByEnemy: pois.filter(p => p.enemyIsCapturing).length
        }
      }
    });
  } catch (error) {
    console.error('Get POI status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get POI status' });
  }
});

// POST /api/poi-capture/:warId/enter/:poiId - Enter a POI (establish presence)
router.post('/:warId/enter/:poiId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);
    const poiId = parseInt(req.params.poiId);

    // Verify player is in the war and it's active
    const memberResult = await pool.query(
      `SELECT cm.crew_id
       FROM crew_members cm
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2 AND tw.status = 'active'`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in an active war' });
      return;
    }

    // Verify POI is part of this war
    const poiResult = await pool.query(
      `SELECT pc.*, poi.name as poi_name
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       WHERE pc.war_id = $1 AND pc.poi_id = $2`,
      [warId, poiId]
    );

    if (poiResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'POI not found in this war' });
      return;
    }

    // Record presence
    await pool.query(
      `INSERT INTO player_poi_presence (player_id, poi_id, war_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, poi_id, war_id) DO UPDATE SET
       last_action = NOW()`,
      [playerId, poiId, warId]
    );

    res.json({
      success: true,
      data: {
        message: `Entered ${poiResult.rows[0].poi_name}`,
        poiId,
        poiName: poiResult.rows[0].poi_name
      }
    });
  } catch (error) {
    console.error('Enter POI error:', error);
    res.status(500).json({ success: false, error: 'Failed to enter POI' });
  }
});

// POST /api/poi-capture/:warId/leave/:poiId - Leave a POI
router.post('/:warId/leave/:poiId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);
    const poiId = parseInt(req.params.poiId);

    await pool.query(
      `DELETE FROM player_poi_presence
       WHERE player_id = $1 AND poi_id = $2 AND war_id = $3`,
      [playerId, poiId, warId]
    );

    // If this player was capturing, cancel capture
    await pool.query(
      `UPDATE poi_control
       SET capturing_crew_id = NULL, capturing_player_id = NULL,
           capture_started_at = NULL, capture_progress = 0
       WHERE war_id = $1 AND poi_id = $2 AND capturing_player_id = $3`,
      [warId, poiId, playerId]
    );

    res.json({
      success: true,
      data: { message: 'Left POI' }
    });
  } catch (error) {
    console.error('Leave POI error:', error);
    res.status(500).json({ success: false, error: 'Failed to leave POI' });
  }
});

// POST /api/poi-capture/:warId/capture/:poiId - Start capturing a POI
router.post('/:warId/capture/:poiId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);
    const poiId = parseInt(req.params.poiId);

    // Verify player is in the war and present at POI
    const memberResult = await pool.query(
      `SELECT cm.crew_id, cm.war_role, p.stamina
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2 AND tw.status = 'active'`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in an active war' });
      return;
    }

    const { crew_id, war_role, stamina } = memberResult.rows[0];

    // Check stamina
    if (stamina < 10) {
      res.status(400).json({ success: false, error: 'Not enough stamina (need 10)' });
      return;
    }

    // Verify presence
    const presenceResult = await pool.query(
      `SELECT id FROM player_poi_presence
       WHERE player_id = $1 AND poi_id = $2 AND war_id = $3
       AND last_action > NOW() - make_interval(mins => $4)`,
      [playerId, poiId, warId, PRESENCE_TIMEOUT_MINUTES]
    );

    if (presenceResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You must be present at the POI to capture it' });
      return;
    }

    // Get POI status
    const poiResult = await pool.query(
      `SELECT pc.*, poi.name as poi_name, poi.metadata
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       WHERE pc.war_id = $1 AND pc.poi_id = $2`,
      [warId, poiId]
    );

    if (poiResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'POI not found' });
      return;
    }

    const poi = poiResult.rows[0];

    // Check if already controlled by player's crew
    if (poi.controlling_crew_id === crew_id) {
      res.status(400).json({ success: false, error: 'Your crew already controls this POI' });
      return;
    }

    // Check if already being captured by this crew
    if (poi.capturing_crew_id === crew_id) {
      res.status(400).json({ success: false, error: 'Your crew is already capturing this POI' });
      return;
    }

    // Check if contested
    if (poi.is_contested) {
      res.status(400).json({ success: false, error: 'POI is contested - drive away enemies first' });
      return;
    }

    // Check if enemy is capturing
    if (poi.capturing_crew_id && poi.capturing_crew_id !== crew_id) {
      res.status(400).json({
        success: false,
        error: 'Enemy is capturing this POI - contest their capture first'
      });
      return;
    }

    // Deduct stamina
    await pool.query(
      `UPDATE players SET stamina = stamina - 10 WHERE id = $1`,
      [playerId]
    );

    // Start capture
    await pool.query(
      `UPDATE poi_control
       SET capturing_crew_id = $1, capturing_player_id = $2,
           capture_started_at = NOW(), capture_progress = 0
       WHERE war_id = $3 AND poi_id = $4`,
      [crew_id, playerId, warId, poiId]
    );

    // Update presence
    await pool.query(
      `UPDATE player_poi_presence SET last_action = NOW()
       WHERE player_id = $1 AND poi_id = $2 AND war_id = $3`,
      [playerId, poiId, warId]
    );

    const captureTimeMinutes = poi.metadata?.capture_time_minutes || BASE_CAPTURE_TIME_MINUTES;
    // Engineer role captures faster
    const adjustedTime = war_role === 'engineer' ? Math.floor(captureTimeMinutes * 0.7) : captureTimeMinutes;

    res.json({
      success: true,
      data: {
        message: `Started capturing ${poi.poi_name}`,
        poiId,
        poiName: poi.poi_name,
        captureTimeMinutes: adjustedTime,
        completesAt: new Date(Date.now() + adjustedTime * 60 * 1000)
      }
    });
  } catch (error) {
    console.error('Capture POI error:', error);
    res.status(500).json({ success: false, error: 'Failed to start capture' });
  }
});

// POST /api/poi-capture/:warId/contest/:poiId - Contest an enemy capture
router.post('/:warId/contest/:poiId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);
    const poiId = parseInt(req.params.poiId);

    // Verify player is in the war
    const memberResult = await pool.query(
      `SELECT cm.crew_id, p.stamina
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2 AND tw.status = 'active'`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in an active war' });
      return;
    }

    const { crew_id, stamina } = memberResult.rows[0];

    if (stamina < 5) {
      res.status(400).json({ success: false, error: 'Not enough stamina (need 5)' });
      return;
    }

    // Verify presence
    const presenceResult = await pool.query(
      `SELECT id FROM player_poi_presence
       WHERE player_id = $1 AND poi_id = $2 AND war_id = $3
       AND last_action > NOW() - make_interval(mins => $4)`,
      [playerId, poiId, warId, PRESENCE_TIMEOUT_MINUTES]
    );

    if (presenceResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You must be present at the POI to contest' });
      return;
    }

    // Get POI status
    const poiResult = await pool.query(
      `SELECT pc.*, poi.name as poi_name
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       WHERE pc.war_id = $1 AND pc.poi_id = $2`,
      [warId, poiId]
    );

    if (poiResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'POI not found' });
      return;
    }

    const poi = poiResult.rows[0];

    // Check if enemy is capturing
    if (!poi.capturing_crew_id || poi.capturing_crew_id === crew_id) {
      res.status(400).json({ success: false, error: 'No enemy capture to contest' });
      return;
    }

    // Deduct stamina
    await pool.query(
      `UPDATE players SET stamina = stamina - 5 WHERE id = $1`,
      [playerId]
    );

    // Mark as contested
    await pool.query(
      `UPDATE poi_control SET is_contested = true WHERE war_id = $1 AND poi_id = $2`,
      [warId, poiId]
    );

    // Log event
    const playerResult = await pool.query(`SELECT username FROM players WHERE id = $1`, [playerId]);
    await pool.query(
      `INSERT INTO war_events (war_id, event_type, crew_id, player_id, poi_id, description)
       VALUES ($1, 'poi_contested', $2, $3, $4, $5)`,
      [warId, crew_id, playerId, poiId, `${playerResult.rows[0].username} is contesting ${poi.poi_name}!`]
    );

    res.json({
      success: true,
      data: {
        message: `Contesting capture of ${poi.poi_name}`,
        poiId,
        poiName: poi.poi_name
      }
    });
  } catch (error) {
    console.error('Contest POI error:', error);
    res.status(500).json({ success: false, error: 'Failed to contest' });
  }
});

// POST /api/poi-capture/:warId/defend/:poiId - Defend a POI from capture (drive away enemy)
router.post('/:warId/defend/:poiId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const warId = parseInt(req.params.warId);
    const poiId = parseInt(req.params.poiId);

    // Verify player is in the war
    const memberResult = await pool.query(
      `SELECT cm.crew_id, cm.war_role, p.stamina, p.focus
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       JOIN territory_wars tw ON (tw.attacker_crew_id = cm.crew_id OR tw.defender_crew_id = cm.crew_id)
       WHERE cm.player_id = $1 AND tw.id = $2 AND tw.status = 'active'`,
      [playerId, warId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in an active war' });
      return;
    }

    const { crew_id, war_role, stamina, focus } = memberResult.rows[0];

    if (stamina < 15 || focus < 10) {
      res.status(400).json({ success: false, error: 'Not enough stamina (15) and focus (10)' });
      return;
    }

    // Verify presence
    const presenceResult = await pool.query(
      `SELECT id FROM player_poi_presence
       WHERE player_id = $1 AND poi_id = $2 AND war_id = $3
       AND last_action > NOW() - make_interval(mins => $4)`,
      [playerId, poiId, warId, PRESENCE_TIMEOUT_MINUTES]
    );

    if (presenceResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You must be present at the POI' });
      return;
    }

    // Get POI status
    const poiResult = await pool.query(
      `SELECT pc.*, poi.name as poi_name, tw.attacker_crew_id, tw.defender_crew_id
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       JOIN territory_wars tw ON pc.war_id = tw.id
       WHERE pc.war_id = $1 AND pc.poi_id = $2`,
      [warId, poiId]
    );

    if (poiResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'POI not found' });
      return;
    }

    const poi = poiResult.rows[0];

    // Must be your POI being captured or contested
    if (poi.controlling_crew_id !== crew_id) {
      res.status(400).json({ success: false, error: 'You can only defend POIs your crew controls' });
      return;
    }

    if (!poi.capturing_crew_id && !poi.is_contested) {
      res.status(400).json({ success: false, error: 'This POI is not under attack' });
      return;
    }

    // Deduct resources
    await pool.query(
      `UPDATE players SET stamina = stamina - 15, focus = focus - 10 WHERE id = $1`,
      [playerId]
    );

    // Calculate success (soldier role has advantage)
    let successChance = 60;
    if (war_role === 'soldier') successChance += 20;

    const success = Math.random() * 100 < successChance;
    let pointsEarned = 0;

    if (success) {
      // Reset capture state
      await pool.query(
        `UPDATE poi_control
         SET capturing_crew_id = NULL, capturing_player_id = NULL,
             capture_started_at = NULL, capture_progress = 0, is_contested = false
         WHERE war_id = $1 AND poi_id = $2`,
        [warId, poiId]
      );

      // Award defense points
      pointsEarned = 75;
      const isAttacker = poi.attacker_crew_id === crew_id;
      const column = isAttacker ? 'attacker_points' : 'defender_points';

      await pool.query(
        `UPDATE territory_wars SET ${column} = ${column} + $1 WHERE id = $2`,
        [pointsEarned, warId]
      );

      await pool.query(
        `UPDATE crew_members SET war_points = war_points + $1 WHERE player_id = $2`,
        [pointsEarned, playerId]
      );

      // Log event
      const playerResult = await pool.query(`SELECT username FROM players WHERE id = $1`, [playerId]);
      await pool.query(
        `INSERT INTO war_events (war_id, event_type, crew_id, player_id, poi_id, points_earned, description)
         VALUES ($1, 'poi_defended', $2, $3, $4, $5, $6)`,
        [warId, crew_id, playerId, poiId, pointsEarned,
         `${playerResult.rows[0].username} successfully defended ${poi.poi_name}! (+${pointsEarned} pts)`]
      );
    }

    res.json({
      success: true,
      data: {
        defenseSuccess: success,
        poiName: poi.poi_name,
        pointsEarned,
        message: success
          ? `Successfully defended ${poi.poi_name}! (+${pointsEarned} war points)`
          : `Defense failed. Enemy is still attacking ${poi.poi_name}.`
      }
    });
  } catch (error) {
    console.error('Defend POI error:', error);
    res.status(500).json({ success: false, error: 'Failed to defend' });
  }
});

// Process POI captures (call periodically)
export async function processPoiCaptures(): Promise<void> {
  try {
    // Get POIs that are being captured and not contested
    const capturingPois = await pool.query(
      `SELECT pc.*, poi.name as poi_name, poi.metadata,
              tw.attacker_crew_id, tw.defender_crew_id,
              c.name as capturing_crew_name,
              p.username as capturing_player_name,
              cm.war_role
       FROM poi_control pc
       JOIN points_of_interest poi ON pc.poi_id = poi.id
       JOIN territory_wars tw ON pc.war_id = tw.id
       JOIN crews c ON pc.capturing_crew_id = c.id
       LEFT JOIN players p ON pc.capturing_player_id = p.id
       LEFT JOIN crew_members cm ON pc.capturing_player_id = cm.player_id AND pc.capturing_crew_id = cm.crew_id
       WHERE pc.capturing_crew_id IS NOT NULL
       AND pc.is_contested = false
       AND tw.status = 'active'`
    );

    for (const poi of capturingPois.rows) {
      const captureTimeMinutes = poi.metadata?.capture_time_minutes || BASE_CAPTURE_TIME_MINUTES;
      const adjustedTime = poi.war_role === 'engineer' ? Math.floor(captureTimeMinutes * 0.7) : captureTimeMinutes;

      const startedAt = new Date(poi.capture_started_at);
      const elapsedMinutes = (Date.now() - startedAt.getTime()) / (60 * 1000);
      const progress = Math.min(100, Math.floor((elapsedMinutes / adjustedTime) * 100));

      // Update progress
      await pool.query(
        `UPDATE poi_control SET capture_progress = $1 WHERE id = $2`,
        [progress, poi.id]
      );

      // Check if capture complete
      if (progress >= 100) {
        const oldController = poi.controlling_crew_id;

        // Transfer control
        await pool.query(
          `UPDATE poi_control
           SET controlling_crew_id = $1, capturing_crew_id = NULL,
               capturing_player_id = NULL, capture_started_at = NULL,
               capture_progress = 0, points_generated = 0
           WHERE id = $2`,
          [poi.capturing_crew_id, poi.id]
        );

        // Award capture points
        const pointsEarned = 100 * poi.strategic_value;
        const isAttacker = poi.capturing_crew_id === poi.attacker_crew_id;
        const column = isAttacker ? 'attacker_points' : 'defender_points';

        await pool.query(
          `UPDATE territory_wars SET ${column} = ${column} + $1 WHERE id = $2`,
          [pointsEarned, poi.war_id]
        );

        if (poi.capturing_player_id) {
          await pool.query(
            `UPDATE crew_members SET war_points = war_points + $1 WHERE player_id = $2`,
            [pointsEarned, poi.capturing_player_id]
          );
        }

        // Update crew war stats
        await pool.query(
          `UPDATE crew_war_stats SET pois_captured = pois_captured + 1 WHERE crew_id = $1`,
          [poi.capturing_crew_id]
        );

        // Log event
        await pool.query(
          `INSERT INTO war_events (war_id, event_type, crew_id, player_id, poi_id, points_earned, description)
           VALUES ($1, 'poi_captured', $2, $3, $4, $5, $6)`,
          [poi.war_id, poi.capturing_crew_id, poi.capturing_player_id, poi.poi_id, pointsEarned,
           `${poi.capturing_crew_name} captured ${poi.poi_name}! (+${pointsEarned} pts)`]
        );

        console.log(`POI ${poi.poi_name} captured by ${poi.capturing_crew_name}`);
      }
    }

    // Clear stale presences - SECURITY: Use make_interval
    const staleTimeout = PRESENCE_TIMEOUT_MINUTES * 2;
    await pool.query(
      `DELETE FROM player_poi_presence
       WHERE last_action < NOW() - make_interval(mins => $1)`,
      [staleTimeout]
    );

  } catch (error) {
    console.error('Process POI captures error:', error);
  }
}

export default router;
