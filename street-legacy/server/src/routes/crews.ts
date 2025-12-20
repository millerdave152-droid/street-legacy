import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import { modifyReputation } from '../services/reputationWeb.service.js';

const router = Router();

// Validation schemas
const createCrewSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be at most 50 characters')
      .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
    tag: z.string()
      .min(2, 'Tag must be at least 2 characters')
      .max(4, 'Tag must be at most 4 characters')
      .regex(/^[a-zA-Z0-9]+$/, 'Tag can only contain letters and numbers')
      .transform(val => val.toUpperCase())
  })
});

const joinCrewSchema = z.object({
  body: z.object({
    crewId: z.coerce.number().int().positive('Invalid crew ID')
  })
});

const memberIdSchema = z.object({
  body: z.object({
    memberId: z.coerce.number().int().positive('Invalid member ID')
  })
});

const crewAmountSchema = z.object({
  body: z.object({
    amount: z.coerce.number().int().positive('Amount must be positive').max(999999999, 'Amount too large')
  })
});

router.use(authMiddleware);

// GET /api/crews - Get player's crew or list of crews
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Single query to get player's crew, crew details, and members using CTE
    const result = await pool.query(
      `WITH player_crew AS (
        SELECT crew_id FROM players WHERE id = $1
      ),
      crew_details AS (
        SELECT c.*, p.username as leader_name
        FROM crews c
        JOIN players p ON c.leader_id = p.id
        WHERE c.id = (SELECT crew_id FROM player_crew)
      ),
      crew_members_data AS (
        SELECT cm.role, cm.joined_at, p.id, p.username, p.level, p.total_earnings
        FROM crew_members cm
        JOIN players p ON cm.player_id = p.id
        WHERE cm.crew_id = (SELECT crew_id FROM player_crew)
        ORDER BY
          CASE cm.role WHEN 'leader' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END,
          cm.joined_at
      )
      SELECT
        (SELECT crew_id FROM player_crew) as player_crew_id,
        (SELECT row_to_json(cd) FROM crew_details cd) as crew,
        (SELECT json_agg(cmd) FROM crew_members_data cmd) as members`,
      [playerId]
    );

    const { player_crew_id, crew, members } = result.rows[0];

    if (player_crew_id && crew) {
      const membersList = members || [];

      res.json({
        success: true,
        data: {
          crew: {
            id: crew.id,
            name: crew.name,
            tag: crew.tag,
            bank: crew.bank,
            leaderId: crew.leader_id,
            leaderName: crew.leader_name,
            createdAt: crew.created_at,
            memberCount: membersList.length
          },
          members: membersList.map((m: any) => ({
            id: m.id,
            username: m.username,
            level: m.level,
            role: m.role,
            totalEarnings: m.total_earnings,
            joinedAt: m.joined_at
          })),
          isLeader: crew.leader_id === playerId,
          isOfficer: membersList.find((m: any) => m.id === playerId)?.role === 'officer'
        }
      });
    } else {
      // List available crews - use CTE to avoid correlated subquery
      const crewsResult = await pool.query(
        `WITH crew_counts AS (
          SELECT crew_id, COUNT(*) as member_count
          FROM crew_members
          GROUP BY crew_id
        )
        SELECT c.id, c.name, c.tag, c.created_at, p.username as leader_name,
               COALESCE(cc.member_count, 0) as member_count
        FROM crews c
        JOIN players p ON c.leader_id = p.id
        LEFT JOIN crew_counts cc ON c.id = cc.crew_id
        ORDER BY member_count DESC
        LIMIT 20`
      );

      res.json({
        success: true,
        data: {
          crew: null,
          availableCrews: crewsResult.rows.map(c => ({
            id: c.id,
            name: c.name,
            tag: c.tag,
            leaderName: c.leader_name,
            memberCount: parseInt(c.member_count),
            createdAt: c.created_at
          }))
        }
      });
    }
  } catch (error) {
    console.error('Get crews error:', error);
    res.status(500).json({ success: false, error: 'Failed to get crews' });
  }
});

// POST /api/crews/create - Create a new crew
// Validation ensures name and tag meet requirements
router.post('/create', validate(createCrewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { name, tag } = req.body;
    // Validation already ensures name and tag meet requirements, tag is uppercased

    // Check if player already in a crew
    const playerResult = await pool.query(
      `SELECT crew_id, level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.crew_id) {
      res.status(400).json({ success: false, error: 'Already in a crew' });
      return;
    }

    // Require level 5 and $10,000 to create crew
    if (player.level < 5) {
      res.status(400).json({ success: false, error: 'Must be level 5 to create a crew' });
      return;
    }

    if (player.cash < 10000) {
      res.status(400).json({ success: false, error: 'Creating a crew costs $10,000' });
      return;
    }

    // Create crew (tag already uppercased by validation)
    const crewResult = await pool.query(
      `INSERT INTO crews (name, tag, leader_id) VALUES ($1, $2, $3) RETURNING id`,
      [name, tag, playerId]
    );
    const crewId = crewResult.rows[0].id;

    // Deduct cost and assign crew
    await pool.query(
      `UPDATE players SET cash = cash - 10000, crew_id = $1 WHERE id = $2`,
      [crewId, playerId]
    );

    // Add player as leader member
    await pool.query(
      `INSERT INTO crew_members (crew_id, player_id, role) VALUES ($1, $2, 'leader')`,
      [crewId, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Created crew [${tag}] ${name}`,
        crewId,
        name,
        tag
      }
    });

    // Update reputation - founding a crew gains respect (non-blocking)
    modifyReputation(
      String(playerId),
      'crew',
      String(crewId),
      { respect: 10, trust: 15 },
      'Founded crew'
    ).catch(err => console.error('Crew creation reputation error:', err));
  } catch (error: any) {
    console.error('Create crew error:', error);
    if (error.code === '23505') {
      res.status(400).json({ success: false, error: 'Crew name or tag already taken' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create crew' });
  }
});

// POST /api/crews/join - Join a crew
// Validation ensures crewId is a positive integer
router.post('/join', validate(joinCrewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { crewId } = req.body;
    // Validation already ensures crewId is valid

    // Check if player already in a crew
    const playerResult = await pool.query(
      `SELECT crew_id FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].crew_id) {
      res.status(400).json({ success: false, error: 'Already in a crew' });
      return;
    }

    // Check crew exists
    const crewResult = await pool.query(
      `SELECT id, name, tag FROM crews WHERE id = $1`,
      [crewId]
    );

    if (crewResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Crew not found' });
      return;
    }

    const crew = crewResult.rows[0];

    // Join crew
    await pool.query(
      `UPDATE players SET crew_id = $1 WHERE id = $2`,
      [crewId, playerId]
    );

    await pool.query(
      `INSERT INTO crew_members (crew_id, player_id, role) VALUES ($1, $2, 'member')`,
      [crewId, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Joined [${crew.tag}] ${crew.name}`,
        crewId,
        crewName: crew.name
      }
    });

    // Update reputation - joining builds initial trust (non-blocking)
    modifyReputation(
      String(playerId),
      'crew',
      String(crewId),
      { trust: 5 },
      'Joined crew'
    ).catch(err => console.error('Crew join reputation error:', err));
  } catch (error) {
    console.error('Join crew error:', error);
    res.status(500).json({ success: false, error: 'Failed to join crew' });
  }
});

// POST /api/crews/leave - Leave current crew
router.post('/leave', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Check if player is in a crew
    const playerResult = await pool.query(
      `SELECT crew_id FROM players WHERE id = $1`,
      [playerId]
    );
    const crewId = playerResult.rows[0].crew_id;

    if (!crewId) {
      res.status(400).json({ success: false, error: 'Not in a crew' });
      return;
    }

    // Check if player is leader
    const crewResult = await pool.query(
      `SELECT leader_id, name FROM crews WHERE id = $1`,
      [crewId]
    );

    if (crewResult.rows[0].leader_id === playerId) {
      res.status(400).json({ success: false, error: 'Leaders must disband or transfer leadership' });
      return;
    }

    // Leave crew
    await pool.query(`UPDATE players SET crew_id = NULL WHERE id = $1`, [playerId]);
    await pool.query(`DELETE FROM crew_members WHERE crew_id = $1 AND player_id = $2`, [crewId, playerId]);

    res.json({
      success: true,
      data: {
        message: `Left ${crewResult.rows[0].name}`
      }
    });

    // Update reputation - leaving damages trust (non-blocking)
    modifyReputation(
      String(playerId),
      'crew',
      String(crewId),
      { trust: -10 },
      'Left crew voluntarily'
    ).catch(err => console.error('Crew leave reputation error:', err));
  } catch (error) {
    console.error('Leave crew error:', error);
    res.status(500).json({ success: false, error: 'Failed to leave crew' });
  }
});

// POST /api/crews/deposit - Deposit to crew bank
// Validation ensures amount is a positive integer
router.post('/deposit', validate(crewAmountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;
    // Validation already ensures amount is valid

    // Check if player is in a crew
    const playerResult = await pool.query(
      `SELECT crew_id, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player.crew_id) {
      res.status(400).json({ success: false, error: 'Not in a crew' });
      return;
    }

    if (player.cash < amount) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Transfer to crew bank
    await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [amount, playerId]);
    await pool.query(`UPDATE crews SET bank = bank + $1 WHERE id = $2`, [amount, player.crew_id]);

    const crewResult = await pool.query(`SELECT bank FROM crews WHERE id = $1`, [player.crew_id]);

    res.json({
      success: true,
      data: {
        message: `Deposited $${amount} to crew bank`,
        newCash: player.cash - amount,
        crewBank: crewResult.rows[0].bank
      }
    });

    // Update reputation - contributing builds trust (non-blocking)
    // Scale trust gain based on deposit size
    const trustGain = Math.min(5, Math.ceil(amount / 5000));
    modifyReputation(
      String(playerId),
      'crew',
      String(player.crew_id),
      { trust: trustGain },
      'Deposited to crew bank'
    ).catch(err => console.error('Crew deposit reputation error:', err));
  } catch (error) {
    console.error('Crew deposit error:', error);
    res.status(500).json({ success: false, error: 'Failed to deposit' });
  }
});

// POST /api/crews/promote - Promote member to officer
// Validation ensures memberId is a positive integer
router.post('/promote', validate(memberIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { memberId } = req.body;
    // Validation already ensures memberId is valid

    // Check if player is leader
    const playerResult = await pool.query(
      `SELECT crew_id FROM players WHERE id = $1`,
      [playerId]
    );
    const crewId = playerResult.rows[0].crew_id;

    if (!crewId) {
      res.status(400).json({ success: false, error: 'Not in a crew' });
      return;
    }

    const crewResult = await pool.query(
      `SELECT leader_id FROM crews WHERE id = $1`,
      [crewId]
    );

    if (crewResult.rows[0].leader_id !== playerId) {
      res.status(403).json({ success: false, error: 'Only leaders can promote' });
      return;
    }

    // Check member is in crew
    const memberResult = await pool.query(
      `SELECT role FROM crew_members WHERE crew_id = $1 AND player_id = $2`,
      [crewId, memberId]
    );

    if (memberResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Member not found in crew' });
      return;
    }

    if (memberResult.rows[0].role !== 'member') {
      res.status(400).json({ success: false, error: 'Can only promote regular members' });
      return;
    }

    await pool.query(
      `UPDATE crew_members SET role = 'officer' WHERE crew_id = $1 AND player_id = $2`,
      [crewId, memberId]
    );

    res.json({
      success: true,
      data: { message: 'Promoted to officer' }
    });

    // Update reputation - promoted member gains trust and respect with crew (non-blocking)
    modifyReputation(
      String(memberId),
      'crew',
      String(crewId),
      { respect: 5, trust: 8 },
      'Promoted to officer'
    ).catch(err => console.error('Crew promote reputation error:', err));
  } catch (error) {
    console.error('Promote error:', error);
    res.status(500).json({ success: false, error: 'Failed to promote' });
  }
});

// POST /api/crews/kick - Kick a member (leader/officer only)
// Validation ensures memberId is a positive integer
router.post('/kick', validate(memberIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { memberId } = req.body;
    // Validation already ensures memberId is valid

    // Get player's crew and role
    const playerMemberResult = await pool.query(
      `SELECT cm.role, p.crew_id FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       WHERE cm.player_id = $1`,
      [playerId]
    );

    if (playerMemberResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Not in a crew' });
      return;
    }

    const { role: playerRole, crew_id: crewId } = playerMemberResult.rows[0];

    if (playerRole !== 'leader' && playerRole !== 'officer') {
      res.status(403).json({ success: false, error: 'Only leaders and officers can kick members' });
      return;
    }

    // Check target member
    const targetResult = await pool.query(
      `SELECT role FROM crew_members WHERE crew_id = $1 AND player_id = $2`,
      [crewId, memberId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Member not found in crew' });
      return;
    }

    const targetRole = targetResult.rows[0].role;

    // Officers can't kick officers or leader
    if (playerRole === 'officer' && targetRole !== 'member') {
      res.status(403).json({ success: false, error: 'Officers can only kick regular members' });
      return;
    }

    // Can't kick leader
    if (targetRole === 'leader') {
      res.status(400).json({ success: false, error: 'Cannot kick the leader' });
      return;
    }

    // Kick member
    await pool.query(`UPDATE players SET crew_id = NULL WHERE id = $1`, [memberId]);
    await pool.query(`DELETE FROM crew_members WHERE crew_id = $1 AND player_id = $2`, [crewId, memberId]);

    res.json({
      success: true,
      data: { message: 'Member kicked from crew' }
    });

    // Update reputation (non-blocking)
    // Kicked member loses all trust with crew, but kicker gains fear
    Promise.all([
      modifyReputation(
        String(memberId),
        'crew',
        String(crewId),
        { trust: -20, respect: -10 },
        'Kicked from crew'
      ),
      modifyReputation(
        String(playerId),
        'crew',
        String(crewId),
        { fear: 3 },
        'Kicked a member'
      )
    ]).catch(err => console.error('Crew kick reputation error:', err));
  } catch (error) {
    console.error('Kick error:', error);
    res.status(500).json({ success: false, error: 'Failed to kick member' });
  }
});

// POST /api/crews/disband - Disband the crew (leader only)
router.post('/disband', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Check if player is leader
    const playerResult = await pool.query(
      `SELECT crew_id FROM players WHERE id = $1`,
      [playerId]
    );
    const crewId = playerResult.rows[0].crew_id;

    if (!crewId) {
      res.status(400).json({ success: false, error: 'Not in a crew' });
      return;
    }

    const crewResult = await pool.query(
      `SELECT leader_id, name, bank FROM crews WHERE id = $1`,
      [crewId]
    );

    if (crewResult.rows[0].leader_id !== playerId) {
      res.status(403).json({ success: false, error: 'Only leaders can disband' });
      return;
    }

    // Return crew bank to leader
    const crewBank = crewResult.rows[0].bank;
    if (crewBank > 0) {
      await pool.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [crewBank, playerId]);
    }

    // Remove all members from crew
    await pool.query(`UPDATE players SET crew_id = NULL WHERE crew_id = $1`, [crewId]);

    // Delete crew members and crew
    await pool.query(`DELETE FROM crew_members WHERE crew_id = $1`, [crewId]);
    await pool.query(`DELETE FROM crews WHERE id = $1`, [crewId]);

    res.json({
      success: true,
      data: {
        message: `Disbanded ${crewResult.rows[0].name}`,
        refundedBank: crewBank
      }
    });
  } catch (error) {
    console.error('Disband error:', error);
    res.status(500).json({ success: false, error: 'Failed to disband crew' });
  }
});

export default router;
