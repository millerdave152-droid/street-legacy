import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// War roles and their bonuses
const WAR_ROLES = {
  warlord: {
    name: 'Warlord',
    description: 'Declares wars, sets targets. Only one per crew.',
    maxPerCrew: 1,
    permissions: ['declare_war', 'set_targets', 'assign_missions'],
    bonuses: { warPointsMultiplier: 1.0 }
  },
  captain: {
    name: 'Captain',
    description: 'Leads squads, assigns missions to soldiers.',
    maxPerCrew: 3,
    permissions: ['assign_missions', 'lead_squad'],
    bonuses: { warPointsMultiplier: 1.05, squadBonus: 0.1 }
  },
  soldier: {
    name: 'Soldier',
    description: 'Front line fighter. Earns bonus war points.',
    maxPerCrew: null,
    permissions: [],
    bonuses: { warPointsMultiplier: 1.1, combatBonus: 0.15 }
  },
  spy: {
    name: 'Spy',
    description: 'Infiltration and intel gathering specialist.',
    maxPerCrew: 5,
    permissions: ['view_intel'],
    bonuses: { intelSuccessBonus: 0.2, detectBonus: 0.25 }
  },
  medic: {
    name: 'Medic',
    description: 'Heals crew members, reduces injury recovery time.',
    maxPerCrew: 3,
    permissions: ['heal_allies'],
    bonuses: { healBonus: 0.3, injuryReduction: 0.25 }
  },
  engineer: {
    name: 'Engineer',
    description: 'Captures POIs faster, sabotage expert.',
    maxPerCrew: 3,
    permissions: ['fast_capture'],
    bonuses: { captureSpeedBonus: 0.3, sabotageBonus: 0.2 }
  }
};

// Default rank structure for new crews
const DEFAULT_RANKS = [
  { name: 'Boss', rankLevel: 1, permissions: { all: true }, salaryPerDay: 0, icon: '👑' },
  { name: 'Underboss', rankLevel: 2, permissions: { manage_members: true, manage_ranks: true, access_bank: true }, salaryPerDay: 5000, icon: '🎩' },
  { name: 'Capo', rankLevel: 3, permissions: { recruit: true, kick_below: true, access_bank: true }, salaryPerDay: 2500, icon: '💼' },
  { name: 'Soldier', rankLevel: 4, permissions: { recruit: true }, salaryPerDay: 1000, icon: '🔫' },
  { name: 'Associate', rankLevel: 5, permissions: {}, salaryPerDay: 500, icon: '👤' },
  { name: 'Recruit', rankLevel: 6, permissions: {}, salaryPerDay: 0, icon: '🆕' }
];

// GET /api/crew-ranks/:crewId - Get all ranks for a crew
router.get('/:crewId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const crewId = parseInt(req.params.crewId);

    // Verify player is in this crew
    const memberResult = await pool.query(
      `SELECT cm.*, c.leader_id FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       WHERE cm.player_id = $1 AND cm.crew_id = $2`,
      [playerId, crewId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in this crew' });
      return;
    }

    const member = memberResult.rows[0];
    const isLeader = member.leader_id === playerId;

    // Get ranks
    const ranksResult = await pool.query(
      `SELECT cr.*,
              (SELECT COUNT(*) FROM crew_members WHERE rank_id = cr.id) as member_count
       FROM crew_ranks cr
       WHERE cr.crew_id = $1
       ORDER BY cr.rank_level ASC`,
      [crewId]
    );

    // If no ranks exist, create defaults
    if (ranksResult.rows.length === 0 && isLeader) {
      for (const rank of DEFAULT_RANKS) {
        await pool.query(
          `INSERT INTO crew_ranks (crew_id, name, rank_level, permissions, salary_per_day, icon)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [crewId, rank.name, rank.rankLevel, JSON.stringify(rank.permissions), rank.salaryPerDay, rank.icon]
        );
      }

      // Re-fetch
      const newRanksResult = await pool.query(
        `SELECT cr.*,
                (SELECT COUNT(*) FROM crew_members WHERE rank_id = cr.id) as member_count
         FROM crew_ranks cr
         WHERE cr.crew_id = $1
         ORDER BY cr.rank_level ASC`,
        [crewId]
      );

      res.json({
        success: true,
        data: {
          ranks: newRanksResult.rows.map(r => ({
            id: r.id,
            name: r.name,
            rankLevel: r.rank_level,
            permissions: r.permissions,
            warRole: r.war_role,
            salaryPerDay: r.salary_per_day,
            maxMembers: r.max_members,
            memberCount: parseInt(r.member_count),
            icon: r.icon
          })),
          isLeader,
          canManageRanks: isLeader || member.permissions?.manage_ranks
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ranks: ranksResult.rows.map(r => ({
          id: r.id,
          name: r.name,
          rankLevel: r.rank_level,
          permissions: r.permissions,
          warRole: r.war_role,
          salaryPerDay: r.salary_per_day,
          maxMembers: r.max_members,
          memberCount: parseInt(r.member_count),
          icon: r.icon
        })),
        isLeader,
        canManageRanks: isLeader || member.permissions?.manage_ranks
      }
    });
  } catch (error) {
    console.error('Get crew ranks error:', error);
    res.status(500).json({ success: false, error: 'Failed to get crew ranks' });
  }
});

// POST /api/crew-ranks/:crewId/create - Create a new rank
router.post('/:crewId/create', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const crewId = parseInt(req.params.crewId);
    const { name, rankLevel, permissions, salaryPerDay, maxMembers, icon } = req.body;

    if (!name || rankLevel === undefined) {
      res.status(400).json({ success: false, error: 'Name and rank level required' });
      return;
    }

    // Verify permission
    const memberResult = await pool.query(
      `SELECT cm.*, c.leader_id FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       WHERE cm.player_id = $1 AND cm.crew_id = $2`,
      [playerId, crewId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in this crew' });
      return;
    }

    const member = memberResult.rows[0];
    if (member.leader_id !== playerId && !member.permissions?.manage_ranks) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage ranks' });
      return;
    }

    // Check for duplicate name or level
    const existingResult = await pool.query(
      `SELECT id FROM crew_ranks WHERE crew_id = $1 AND (name = $2 OR rank_level = $3)`,
      [crewId, name, rankLevel]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Rank name or level already exists' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO crew_ranks (crew_id, name, rank_level, permissions, salary_per_day, max_members, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [crewId, name, rankLevel, JSON.stringify(permissions || {}), salaryPerDay || 0, maxMembers, icon || '👤']
    );

    res.json({
      success: true,
      data: {
        rank: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          rankLevel: result.rows[0].rank_level,
          permissions: result.rows[0].permissions,
          salaryPerDay: result.rows[0].salary_per_day,
          maxMembers: result.rows[0].max_members,
          icon: result.rows[0].icon
        }
      }
    });
  } catch (error) {
    console.error('Create rank error:', error);
    res.status(500).json({ success: false, error: 'Failed to create rank' });
  }
});

// PUT /api/crew-ranks/:crewId/:rankId - Update a rank
router.put('/:crewId/:rankId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const crewId = parseInt(req.params.crewId);
    const rankId = parseInt(req.params.rankId);
    const { name, permissions, salaryPerDay, maxMembers, icon } = req.body;

    // Verify permission
    const memberResult = await pool.query(
      `SELECT cm.*, c.leader_id FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       WHERE cm.player_id = $1 AND cm.crew_id = $2`,
      [playerId, crewId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in this crew' });
      return;
    }

    const member = memberResult.rows[0];
    if (member.leader_id !== playerId && !member.permissions?.manage_ranks) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage ranks' });
      return;
    }

    // Verify rank exists and belongs to crew
    const rankResult = await pool.query(
      `SELECT * FROM crew_ranks WHERE id = $1 AND crew_id = $2`,
      [rankId, crewId]
    );

    if (rankResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Rank not found' });
      return;
    }

    // Can't modify the top rank
    if (rankResult.rows[0].rank_level === 1 && member.leader_id !== playerId) {
      res.status(403).json({ success: false, error: 'Only the leader can modify the top rank' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(permissions));
    }
    if (salaryPerDay !== undefined) {
      updates.push(`salary_per_day = $${paramIndex++}`);
      values.push(salaryPerDay);
    }
    if (maxMembers !== undefined) {
      updates.push(`max_members = $${paramIndex++}`);
      values.push(maxMembers);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(icon);
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: 'No updates provided' });
      return;
    }

    values.push(rankId);
    const result = await pool.query(
      `UPDATE crew_ranks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: {
        rank: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          rankLevel: result.rows[0].rank_level,
          permissions: result.rows[0].permissions,
          salaryPerDay: result.rows[0].salary_per_day,
          maxMembers: result.rows[0].max_members,
          icon: result.rows[0].icon
        }
      }
    });
  } catch (error) {
    console.error('Update rank error:', error);
    res.status(500).json({ success: false, error: 'Failed to update rank' });
  }
});

// GET /api/crew-ranks/war-roles - Get available war roles
router.get('/war-roles/list', async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        roles: Object.entries(WAR_ROLES).map(([key, role]) => ({
          id: key,
          name: role.name,
          description: role.description,
          maxPerCrew: role.maxPerCrew,
          permissions: role.permissions,
          bonuses: role.bonuses
        }))
      }
    });
  } catch (error) {
    console.error('Get war roles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get war roles' });
  }
});

// POST /api/crew-ranks/:crewId/assign-role - Assign war role to a member
router.post('/:crewId/assign-role', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const crewId = parseInt(req.params.crewId);
    const { targetPlayerId, warRole } = req.body;

    if (!targetPlayerId || !warRole) {
      res.status(400).json({ success: false, error: 'Target player and war role required' });
      return;
    }

    if (!WAR_ROLES[warRole as keyof typeof WAR_ROLES]) {
      res.status(400).json({ success: false, error: 'Invalid war role' });
      return;
    }

    // Verify permission
    const memberResult = await pool.query(
      `SELECT cm.*, c.leader_id FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       WHERE cm.player_id = $1 AND cm.crew_id = $2`,
      [playerId, crewId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in this crew' });
      return;
    }

    const member = memberResult.rows[0];
    const isLeader = member.leader_id === playerId;
    const isWarlord = member.war_role === 'warlord';

    if (!isLeader && !isWarlord) {
      res.status(403).json({ success: false, error: 'Only the leader or warlord can assign war roles' });
      return;
    }

    // Check target is in crew
    const targetResult = await pool.query(
      `SELECT * FROM crew_members WHERE player_id = $1 AND crew_id = $2`,
      [targetPlayerId, crewId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Target player is not in this crew' });
      return;
    }

    // Check role limit
    const roleInfo = WAR_ROLES[warRole as keyof typeof WAR_ROLES];
    if (roleInfo.maxPerCrew) {
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM crew_members WHERE crew_id = $1 AND war_role = $2`,
        [crewId, warRole]
      );

      if (parseInt(countResult.rows[0].count) >= roleInfo.maxPerCrew) {
        res.status(400).json({
          success: false,
          error: `Maximum ${roleInfo.maxPerCrew} ${roleInfo.name}(s) allowed per crew`
        });
        return;
      }
    }

    // Assign role
    await pool.query(
      `UPDATE crew_members SET war_role = $1 WHERE player_id = $2 AND crew_id = $3`,
      [warRole, targetPlayerId, crewId]
    );

    // Get target username
    const targetPlayerResult = await pool.query(
      `SELECT username FROM players WHERE id = $1`,
      [targetPlayerId]
    );

    res.json({
      success: true,
      data: {
        message: `Assigned ${roleInfo.name} role to ${targetPlayerResult.rows[0].username}`,
        targetPlayerId,
        warRole,
        roleName: roleInfo.name
      }
    });
  } catch (error) {
    console.error('Assign war role error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign war role' });
  }
});

// POST /api/crew-ranks/:crewId/set-rank - Set a member's rank
router.post('/:crewId/set-rank', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const crewId = parseInt(req.params.crewId);
    const { targetPlayerId, rankId } = req.body;

    if (!targetPlayerId || !rankId) {
      res.status(400).json({ success: false, error: 'Target player and rank ID required' });
      return;
    }

    // Verify permission
    const memberResult = await pool.query(
      `SELECT cm.*, c.leader_id, cr.rank_level as my_rank_level
       FROM crew_members cm
       JOIN crews c ON cm.crew_id = c.id
       LEFT JOIN crew_ranks cr ON cm.rank_id = cr.id
       WHERE cm.player_id = $1 AND cm.crew_id = $2`,
      [playerId, crewId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in this crew' });
      return;
    }

    const member = memberResult.rows[0];
    const isLeader = member.leader_id === playerId;

    if (!isLeader && !member.permissions?.manage_members) {
      res.status(403).json({ success: false, error: 'You do not have permission to change ranks' });
      return;
    }

    // Get target rank
    const rankResult = await pool.query(
      `SELECT * FROM crew_ranks WHERE id = $1 AND crew_id = $2`,
      [rankId, crewId]
    );

    if (rankResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Rank not found' });
      return;
    }

    const targetRank = rankResult.rows[0];

    // Can't assign rank higher than or equal to own (unless leader)
    if (!isLeader && member.my_rank_level >= targetRank.rank_level) {
      res.status(403).json({ success: false, error: 'Cannot assign a rank equal to or higher than your own' });
      return;
    }

    // Get target member
    const targetResult = await pool.query(
      `SELECT cm.*, cr.rank_level as target_rank_level
       FROM crew_members cm
       LEFT JOIN crew_ranks cr ON cm.rank_id = cr.id
       WHERE cm.player_id = $1 AND cm.crew_id = $2`,
      [targetPlayerId, crewId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Target player not in crew' });
      return;
    }

    const target = targetResult.rows[0];

    // Can't modify someone with equal or higher rank (unless leader)
    if (!isLeader && target.target_rank_level && member.my_rank_level >= target.target_rank_level) {
      res.status(403).json({ success: false, error: 'Cannot modify someone with equal or higher rank' });
      return;
    }

    // Check max members for rank
    if (targetRank.max_members) {
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM crew_members WHERE rank_id = $1 AND player_id != $2`,
        [rankId, targetPlayerId]
      );

      if (parseInt(countResult.rows[0].count) >= targetRank.max_members) {
        res.status(400).json({ success: false, error: `Maximum ${targetRank.max_members} members for this rank` });
        return;
      }
    }

    // Set rank
    await pool.query(
      `UPDATE crew_members SET rank_id = $1 WHERE player_id = $2 AND crew_id = $3`,
      [rankId, targetPlayerId, crewId]
    );

    const targetPlayerResult = await pool.query(
      `SELECT username FROM players WHERE id = $1`,
      [targetPlayerId]
    );

    res.json({
      success: true,
      data: {
        message: `Set ${targetPlayerResult.rows[0].username}'s rank to ${targetRank.name}`,
        targetPlayerId,
        rankId,
        rankName: targetRank.name
      }
    });
  } catch (error) {
    console.error('Set rank error:', error);
    res.status(500).json({ success: false, error: 'Failed to set rank' });
  }
});

// GET /api/crew-ranks/:crewId/members - Get crew members with ranks and war roles
router.get('/:crewId/members', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const crewId = parseInt(req.params.crewId);

    // Verify player is in this crew
    const memberResult = await pool.query(
      `SELECT crew_id FROM crew_members WHERE player_id = $1 AND crew_id = $2`,
      [playerId, crewId]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You are not in this crew' });
      return;
    }

    const membersResult = await pool.query(
      `SELECT cm.*, p.username, p.level, cr.name as rank_name, cr.icon as rank_icon,
              cr.rank_level, c.leader_id
       FROM crew_members cm
       JOIN players p ON cm.player_id = p.id
       JOIN crews c ON cm.crew_id = c.id
       LEFT JOIN crew_ranks cr ON cm.rank_id = cr.id
       WHERE cm.crew_id = $1
       ORDER BY cr.rank_level ASC NULLS LAST, cm.war_points DESC`,
      [crewId]
    );

    const members = membersResult.rows.map(m => ({
      playerId: m.player_id,
      username: m.username,
      level: m.level,
      isLeader: m.player_id === m.leader_id,
      rankId: m.rank_id,
      rankName: m.rank_name || 'Unranked',
      rankIcon: m.rank_icon || '👤',
      rankLevel: m.rank_level,
      warRole: m.war_role,
      warRoleName: m.war_role ? WAR_ROLES[m.war_role as keyof typeof WAR_ROLES]?.name : null,
      warPoints: m.war_points,
      warKills: m.war_kills,
      warDeaths: m.war_deaths,
      lastWarAction: m.last_war_action,
      joinedAt: m.joined_at
    }));

    // Count war roles
    const roleCounts: Record<string, number> = {};
    for (const role of Object.keys(WAR_ROLES)) {
      roleCounts[role] = members.filter(m => m.warRole === role).length;
    }

    res.json({
      success: true,
      data: {
        members,
        roleCounts,
        totalMembers: members.length
      }
    });
  } catch (error) {
    console.error('Get crew members error:', error);
    res.status(500).json({ success: false, error: 'Failed to get crew members' });
  }
});

// Pay daily salaries (call once per day)
export async function payCrewSalaries(): Promise<void> {
  try {
    // Get all crews with members who have ranks with salaries
    const salariesResult = await pool.query(
      `SELECT cm.player_id, cm.crew_id, cr.salary_per_day, c.bank_balance, c.name as crew_name
       FROM crew_members cm
       JOIN crew_ranks cr ON cm.rank_id = cr.id
       JOIN crews c ON cm.crew_id = c.id
       WHERE cr.salary_per_day > 0`
    );

    // Group by crew
    const crewSalaries: Record<number, { total: number; balance: number; members: { playerId: number; salary: number }[] }> = {};

    for (const row of salariesResult.rows) {
      if (!crewSalaries[row.crew_id]) {
        crewSalaries[row.crew_id] = {
          total: 0,
          balance: row.bank_balance,
          members: []
        };
      }
      crewSalaries[row.crew_id].total += row.salary_per_day;
      crewSalaries[row.crew_id].members.push({
        playerId: row.player_id,
        salary: row.salary_per_day
      });
    }

    // Pay salaries for crews that can afford it
    for (const [crewIdStr, data] of Object.entries(crewSalaries)) {
      const crewId = parseInt(crewIdStr);

      if (data.balance >= data.total) {
        // Deduct from crew bank
        await pool.query(
          `UPDATE crews SET bank_balance = bank_balance - $1 WHERE id = $2`,
          [data.total, crewId]
        );

        // Pay each member
        for (const member of data.members) {
          await pool.query(
            `UPDATE players SET cash = cash + $1 WHERE id = $2`,
            [member.salary, member.playerId]
          );
        }

        console.log(`Paid $${data.total} in salaries for crew ${crewId}`);
      } else {
        console.log(`Crew ${crewId} cannot afford salaries ($${data.total} needed, $${data.balance} available)`);
      }
    }
  } catch (error) {
    console.error('Pay crew salaries error:', error);
  }
}

export default router;
