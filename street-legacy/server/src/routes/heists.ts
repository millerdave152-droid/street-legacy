import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';

// Schema for heist ID params
const heistIdParamSchema = z.object({
  params: z.object({
    heistId: z.string().regex(/^\d+$/, 'Invalid heist ID')
  })
});

const activeHeistIdParamSchema = z.object({
  params: z.object({
    activeHeistId: z.string().regex(/^\d+$/, 'Invalid active heist ID')
  })
});

const selectRoleSchema = z.object({
  params: z.object({
    activeHeistId: z.string().regex(/^\d+$/, 'Invalid active heist ID')
  }),
  body: z.object({
    roleId: z.number().int().positive().optional()
  })
});

const router = Router();

router.use(authMiddleware);

// GET /api/heists - Get available heists and player's active heist
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info
    const playerResult = await pool.query(
      `SELECT p.level, p.crew_id, p.is_master, c.name as crew_name
       FROM players p
       LEFT JOIN crews c ON p.crew_id = c.id
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all heists with roles
    const heistsResult = await pool.query(
      `SELECT h.*,
              (SELECT json_agg(json_build_object('id', hr.id, 'roleName', hr.role_name, 'description', hr.description, 'bonusType', hr.bonus_type, 'bonusValue', hr.bonus_value, 'required', hr.required))
               FROM heist_roles hr WHERE hr.heist_id = h.id) as roles
       FROM heists h
       ORDER BY h.min_level, h.min_payout`
    );

    const heists = heistsResult.rows.map(h => ({
      id: h.id,
      name: h.name,
      description: h.description,
      minLevel: h.min_level,
      minCrewSize: h.min_crew_size,
      maxCrewSize: h.max_crew_size,
      planningHours: h.planning_hours,
      baseSuccessRate: h.base_success_rate,
      minPayout: h.min_payout,
      maxPayout: h.max_payout,
      heatGenerated: h.heat_generated,
      cooldownHours: h.cooldown_hours,
      roles: h.roles || [],
      canStart: player.level >= h.min_level || player.is_master,
      hasCrew: !!player.crew_id
    }));

    // Get player's active heist if any
    let activeHeist = null;
    if (player.crew_id) {
      const activeResult = await pool.query(
        `SELECT ah.*, h.name as heist_name, h.max_crew_size, h.base_success_rate, h.min_payout, h.max_payout, h.planning_hours,
                p.username as leader_name,
                (SELECT json_agg(json_build_object(
                  'playerId', hp.player_id,
                  'username', pl.username,
                  'roleId', hp.role_id,
                  'roleName', hr.role_name,
                  'ready', hp.ready
                ))
                FROM heist_participants hp
                JOIN players pl ON hp.player_id = pl.id
                LEFT JOIN heist_roles hr ON hp.role_id = hr.id
                WHERE hp.active_heist_id = ah.id) as participants
         FROM active_heists ah
         JOIN heists h ON ah.heist_id = h.id
         JOIN players p ON ah.leader_id = p.id
         WHERE ah.crew_id = $1 AND ah.status IN ('planning', 'ready')`,
        [player.crew_id]
      );

      if (activeResult.rows.length > 0) {
        const ah = activeResult.rows[0];

        // Get roles for this heist
        const rolesResult = await pool.query(
          `SELECT * FROM heist_roles WHERE heist_id = $1`,
          [ah.heist_id]
        );

        activeHeist = {
          id: ah.id,
          heistId: ah.heist_id,
          heistName: ah.heist_name,
          status: ah.status,
          leaderId: ah.leader_id,
          leaderName: ah.leader_name,
          plannedFor: ah.planned_for,
          maxCrewSize: ah.max_crew_size,
          baseSuccessRate: ah.base_success_rate,
          minPayout: ah.min_payout,
          maxPayout: ah.max_payout,
          planningHours: ah.planning_hours,
          participants: ah.participants || [],
          roles: rolesResult.rows.map(r => ({
            id: r.id,
            roleName: r.role_name,
            description: r.description,
            bonusType: r.bonus_type,
            bonusValue: r.bonus_value,
            required: r.required
          })),
          isLeader: ah.leader_id === playerId
        };
      }
    }

    res.json({
      success: true,
      data: {
        heists,
        activeHeist,
        playerLevel: player.level,
        crewId: player.crew_id,
        crewName: player.crew_name
      }
    });
  } catch (error) {
    console.error('Get heists error:', error);
    res.status(500).json({ success: false, error: 'Failed to get heists' });
  }
});

// POST /api/heists/plan/:heistId - Start planning a heist
router.post('/plan/:heistId', validate(heistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const heistId = parseInt(req.params.heistId);

    // Get player with crew info
    const playerResult = await pool.query(
      `SELECT p.*, cm.role as crew_role
       FROM players p
       LEFT JOIN crew_members cm ON cm.player_id = p.id AND cm.crew_id = p.crew_id
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];
    const isMaster = player.is_master === true;

    if (!player.crew_id && !isMaster) {
      res.status(400).json({ success: false, error: 'You need to be in a crew to plan heists' });
      return;
    }

    // Check if crew already has an active heist
    const existingResult = await pool.query(
      `SELECT id FROM active_heists WHERE crew_id = $1 AND status IN ('planning', 'ready', 'in_progress')`,
      [player.crew_id]
    );

    if (existingResult.rows.length > 0 && !isMaster) {
      res.status(400).json({ success: false, error: 'Your crew already has an active heist' });
      return;
    }

    // Get heist details
    const heistResult = await pool.query(
      `SELECT * FROM heists WHERE id = $1`,
      [heistId]
    );

    if (heistResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Heist not found' });
      return;
    }

    const heist = heistResult.rows[0];

    if (!isMaster && player.level < heist.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${heist.min_level}` });
      return;
    }

    // Create the active heist
    const plannedFor = new Date();
    plannedFor.setHours(plannedFor.getHours() + heist.planning_hours);

    const insertResult = await pool.query(
      `INSERT INTO active_heists (heist_id, crew_id, leader_id, status, planned_for)
       VALUES ($1, $2, $3, 'planning', $4)
       RETURNING id`,
      [heistId, player.crew_id, playerId, plannedFor]
    );

    const activeHeistId = insertResult.rows[0].id;

    // Add leader as first participant
    await pool.query(
      `INSERT INTO heist_participants (active_heist_id, player_id, ready)
       VALUES ($1, $2, false)`,
      [activeHeistId, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Started planning ${heist.name}!`,
        activeHeistId,
        heistName: heist.name,
        plannedFor
      }
    });
  } catch (error) {
    console.error('Plan heist error:', error);
    res.status(500).json({ success: false, error: 'Failed to plan heist' });
  }
});

// POST /api/heists/join/:activeHeistId - Join an active heist
router.post('/join/:activeHeistId', validate(activeHeistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeHeistId = parseInt(req.params.activeHeistId);

    // Get player
    const playerResult = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get the active heist
    const heistResult = await pool.query(
      `SELECT ah.*, h.max_crew_size, h.name as heist_name
       FROM active_heists ah
       JOIN heists h ON ah.heist_id = h.id
       WHERE ah.id = $1 AND ah.status = 'planning'`,
      [activeHeistId]
    );

    if (heistResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Heist not found or not in planning phase' });
      return;
    }

    const activeHeist = heistResult.rows[0];

    // Check if player is in the same crew
    if (player.crew_id !== activeHeist.crew_id) {
      res.status(400).json({ success: false, error: 'You must be in the same crew' });
      return;
    }

    // Check if already joined
    const existingResult = await pool.query(
      `SELECT id FROM heist_participants WHERE active_heist_id = $1 AND player_id = $2`,
      [activeHeistId, playerId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'You have already joined this heist' });
      return;
    }

    // Check crew size
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM heist_participants WHERE active_heist_id = $1`,
      [activeHeistId]
    );

    if (parseInt(countResult.rows[0].count) >= activeHeist.max_crew_size) {
      res.status(400).json({ success: false, error: 'Heist crew is full' });
      return;
    }

    // Join the heist
    await pool.query(
      `INSERT INTO heist_participants (active_heist_id, player_id, ready)
       VALUES ($1, $2, false)`,
      [activeHeistId, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Joined ${activeHeist.heist_name}!`
      }
    });
  } catch (error) {
    console.error('Join heist error:', error);
    res.status(500).json({ success: false, error: 'Failed to join heist' });
  }
});

// POST /api/heists/role/:activeHeistId - Select a role for the heist
router.post('/role/:activeHeistId', validate(selectRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeHeistId = parseInt(req.params.activeHeistId);
    const { roleId } = req.body;

    // Check if participant
    const participantResult = await pool.query(
      `SELECT * FROM heist_participants WHERE active_heist_id = $1 AND player_id = $2`,
      [activeHeistId, playerId]
    );

    if (participantResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You are not part of this heist' });
      return;
    }

    // Check if role is already taken
    if (roleId) {
      const roleTakenResult = await pool.query(
        `SELECT player_id FROM heist_participants WHERE active_heist_id = $1 AND role_id = $2 AND player_id != $3`,
        [activeHeistId, roleId, playerId]
      );

      if (roleTakenResult.rows.length > 0) {
        res.status(400).json({ success: false, error: 'Role is already taken' });
        return;
      }
    }

    // Update role
    await pool.query(
      `UPDATE heist_participants SET role_id = $1 WHERE active_heist_id = $2 AND player_id = $3`,
      [roleId || null, activeHeistId, playerId]
    );

    res.json({
      success: true,
      data: { message: 'Role updated' }
    });
  } catch (error) {
    console.error('Select role error:', error);
    res.status(500).json({ success: false, error: 'Failed to select role' });
  }
});

// POST /api/heists/ready/:activeHeistId - Mark yourself as ready
router.post('/ready/:activeHeistId', validate(activeHeistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeHeistId = parseInt(req.params.activeHeistId);

    // Update ready status
    const result = await pool.query(
      `UPDATE heist_participants SET ready = NOT ready
       WHERE active_heist_id = $1 AND player_id = $2
       RETURNING ready`,
      [activeHeistId, playerId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You are not part of this heist' });
      return;
    }

    // Check if all required roles are filled and everyone is ready
    const heistResult = await pool.query(
      `SELECT ah.*, h.min_crew_size
       FROM active_heists ah
       JOIN heists h ON ah.heist_id = h.id
       WHERE ah.id = $1`,
      [activeHeistId]
    );
    const activeHeist = heistResult.rows[0];

    const participantsResult = await pool.query(
      `SELECT hp.*, hr.required
       FROM heist_participants hp
       LEFT JOIN heist_roles hr ON hp.role_id = hr.id
       WHERE hp.active_heist_id = $1`,
      [activeHeistId]
    );

    const allReady = participantsResult.rows.every(p => p.ready);
    const hasEnoughPeople = participantsResult.rows.length >= activeHeist.min_crew_size;

    // Check required roles
    const requiredRolesResult = await pool.query(
      `SELECT id FROM heist_roles WHERE heist_id = $1 AND required = true`,
      [activeHeist.heist_id]
    );
    const requiredRoleIds = requiredRolesResult.rows.map(r => r.id);
    const filledRoles = participantsResult.rows.filter(p => p.role_id).map(p => p.role_id);
    const allRequiredFilled = requiredRoleIds.every(id => filledRoles.includes(id));

    // Update heist status if ready
    if (allReady && hasEnoughPeople && allRequiredFilled && activeHeist.status === 'planning') {
      await pool.query(
        `UPDATE active_heists SET status = 'ready' WHERE id = $1`,
        [activeHeistId]
      );
    } else if (activeHeist.status === 'ready' && !allReady) {
      await pool.query(
        `UPDATE active_heists SET status = 'planning' WHERE id = $1`,
        [activeHeistId]
      );
    }

    res.json({
      success: true,
      data: {
        ready: result.rows[0].ready,
        heistReady: allReady && hasEnoughPeople && allRequiredFilled
      }
    });
  } catch (error) {
    console.error('Ready heist error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ready status' });
  }
});

// POST /api/heists/execute/:activeHeistId - Execute the heist
router.post('/execute/:activeHeistId', validate(activeHeistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeHeistId = parseInt(req.params.activeHeistId);

    // Get active heist
    const heistResult = await pool.query(
      `SELECT ah.*, h.*
       FROM active_heists ah
       JOIN heists h ON ah.heist_id = h.id
       WHERE ah.id = $1`,
      [activeHeistId]
    );

    if (heistResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Heist not found' });
      return;
    }

    const activeHeist = heistResult.rows[0];

    // Check if player is the leader
    const playerResult = await pool.query(`SELECT is_master FROM players WHERE id = $1`, [playerId]);
    const isMaster = playerResult.rows[0].is_master === true;

    if (activeHeist.leader_id !== playerId && !isMaster) {
      res.status(400).json({ success: false, error: 'Only the heist leader can execute' });
      return;
    }

    if (activeHeist.status !== 'ready' && !isMaster) {
      res.status(400).json({ success: false, error: 'Heist is not ready to execute' });
      return;
    }

    // Get participants with roles
    const participantsResult = await pool.query(
      `SELECT hp.*, hr.bonus_type, hr.bonus_value, p.username
       FROM heist_participants hp
       JOIN players p ON hp.player_id = p.id
       LEFT JOIN heist_roles hr ON hp.role_id = hr.id
       WHERE hp.active_heist_id = $1`,
      [activeHeistId]
    );

    // Calculate success chance with role bonuses
    let successChance = activeHeist.base_success_rate;
    for (const p of participantsResult.rows) {
      if (p.bonus_type === 'success') {
        successChance += p.bonus_value;
      }
    }
    successChance = Math.min(95, Math.max(5, successChance));

    // Calculate payout multiplier from roles
    let payoutMultiplier = 1;
    for (const p of participantsResult.rows) {
      if (p.bonus_type === 'payout') {
        payoutMultiplier += p.bonus_value / 100;
      }
    }

    // Execute the heist
    const success = isMaster ? true : Math.random() * 100 < successChance;

    if (success) {
      // Calculate payout
      const basePayout = Math.floor(Math.random() * (activeHeist.max_payout - activeHeist.min_payout)) + activeHeist.min_payout;
      const totalPayout = Math.floor(basePayout * payoutMultiplier);
      const sharePerPerson = Math.floor(totalPayout / participantsResult.rows.length);

      // Distribute payout
      for (const p of participantsResult.rows) {
        await pool.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [sharePerPerson, p.player_id]
        );

        await pool.query(
          `UPDATE heist_participants SET payout_share = $1 WHERE id = $2`,
          [sharePerPerson, p.id]
        );
      }

      // Mark heist as completed
      await pool.query(
        `UPDATE active_heists SET status = 'completed', completed_at = NOW(), total_payout = $1 WHERE id = $2`,
        [totalPayout, activeHeistId]
      );

      res.json({
        success: true,
        data: {
          heistSuccess: true,
          message: `The ${activeHeist.name} was a success!`,
          totalPayout,
          sharePerPerson,
          participants: participantsResult.rows.map(p => ({
            username: p.username,
            share: sharePerPerson
          }))
        }
      });
    } else {
      // Heist failed
      await pool.query(
        `UPDATE active_heists SET status = 'failed', completed_at = NOW() WHERE id = $1`,
        [activeHeistId]
      );

      res.json({
        success: true,
        data: {
          heistSuccess: false,
          message: `The ${activeHeist.name} failed! The crew got away but empty-handed.`
        }
      });
    }
  } catch (error) {
    console.error('Execute heist error:', error);
    res.status(500).json({ success: false, error: 'Failed to execute heist' });
  }
});

// POST /api/heists/cancel/:activeHeistId - Cancel a heist
router.post('/cancel/:activeHeistId', validate(activeHeistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeHeistId = parseInt(req.params.activeHeistId);

    const heistResult = await pool.query(
      `SELECT * FROM active_heists WHERE id = $1`,
      [activeHeistId]
    );

    if (heistResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Heist not found' });
      return;
    }

    const activeHeist = heistResult.rows[0];

    const playerResult = await pool.query(`SELECT is_master FROM players WHERE id = $1`, [playerId]);
    const isMaster = playerResult.rows[0].is_master === true;

    if (activeHeist.leader_id !== playerId && !isMaster) {
      res.status(400).json({ success: false, error: 'Only the heist leader can cancel' });
      return;
    }

    await pool.query(
      `UPDATE active_heists SET status = 'cancelled' WHERE id = $1`,
      [activeHeistId]
    );

    res.json({
      success: true,
      data: { message: 'Heist cancelled' }
    });
  } catch (error) {
    console.error('Cancel heist error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel heist' });
  }
});

// POST /api/heists/leave/:activeHeistId - Leave a heist
router.post('/leave/:activeHeistId', validate(activeHeistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeHeistId = parseInt(req.params.activeHeistId);

    const heistResult = await pool.query(
      `SELECT * FROM active_heists WHERE id = $1`,
      [activeHeistId]
    );

    if (heistResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Heist not found' });
      return;
    }

    const activeHeist = heistResult.rows[0];

    // Leader cannot leave (must cancel instead)
    if (activeHeist.leader_id === playerId) {
      res.status(400).json({ success: false, error: 'Leader cannot leave. Cancel the heist instead.' });
      return;
    }

    await pool.query(
      `DELETE FROM heist_participants WHERE active_heist_id = $1 AND player_id = $2`,
      [activeHeistId, playerId]
    );

    // Reset to planning if was ready
    if (activeHeist.status === 'ready') {
      await pool.query(
        `UPDATE active_heists SET status = 'planning' WHERE id = $1`,
        [activeHeistId]
      );
    }

    res.json({
      success: true,
      data: { message: 'Left the heist' }
    });
  } catch (error) {
    console.error('Leave heist error:', error);
    res.status(500).json({ success: false, error: 'Failed to leave heist' });
  }
});

export default router;
