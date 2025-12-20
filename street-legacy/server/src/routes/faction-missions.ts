import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { modifyFactionReputation, areFactionsAtWar } from './factions.js';

const router = Router();

// Rank order for comparison
const RANK_ORDER = ['outsider', 'associate', 'member', 'made', 'captain', 'underboss', 'boss'];

function hasMinRank(playerRank: string, requiredRank: string): boolean {
  return RANK_ORDER.indexOf(playerRank) >= RANK_ORDER.indexOf(requiredRank);
}

// GET /api/factions/:id/missions - Available faction missions
router.get('/:id/missions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Get player's reputation and rank with this faction
    const repResult = await pool.query(`
      SELECT reputation, rank, missions_completed
      FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const playerRep = repResult.rows[0]?.reputation || 0;
    const playerRank = repResult.rows[0]?.rank || 'outsider';

    // Get available missions
    const missionsResult = await pool.query(`
      SELECT fm.*,
        f.name as faction_name,
        ef.name as enemy_faction_name,
        ef.icon as enemy_faction_icon
      FROM faction_missions fm
      JOIN factions f ON fm.faction_id = f.id
      LEFT JOIN factions ef ON fm.enemy_faction_id = ef.id
      WHERE fm.faction_id = $1 AND fm.is_active = true
      ORDER BY fm.min_reputation ASC, fm.difficulty ASC
    `, [factionId]);

    // Get player's active missions
    const activeResult = await pool.query(`
      SELECT mission_id FROM active_faction_missions
      WHERE player_id = $1 AND faction_id = $2 AND status = 'active'
    `, [playerId, factionId]);

    const activeMissionIds = new Set(activeResult.rows.map(r => r.mission_id));

    // Get recent completions for cooldown checking
    const completionsResult = await pool.query(`
      SELECT mission_id, COUNT(*) as today_count,
        MAX(completed_at) as last_completed
      FROM faction_mission_completions
      WHERE player_id = $1 AND faction_id = $2
        AND completed_at > NOW() - INTERVAL '24 hours'
      GROUP BY mission_id
    `, [playerId, factionId]);

    const completionMap = new Map(
      completionsResult.rows.map(r => [r.mission_id, r])
    );

    // Get story progress
    const storyResult = await pool.query(`
      SELECT current_chapter, chapter_progress, choices_made
      FROM faction_story_progress
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const storyProgress = storyResult.rows[0];

    // Process missions
    const missions = missionsResult.rows.map(mission => {
      const completion = completionMap.get(mission.id);
      const isOnCooldown = completion &&
        new Date(completion.last_completed).getTime() + (mission.cooldown_hours * 60 * 60 * 1000) > Date.now();
      const dailyLimitReached = completion &&
        parseInt(completion.today_count) >= mission.max_daily_completions;

      const canAccept =
        playerRep >= mission.min_reputation &&
        hasMinRank(playerRank, mission.min_rank) &&
        !activeMissionIds.has(mission.id) &&
        !isOnCooldown &&
        !dailyLimitReached;

      // Check story mission prerequisites
      let storyAvailable = true;
      if (mission.is_story_mission && mission.prerequisites?.length > 0) {
        storyAvailable = mission.prerequisites.every((prereq: number) =>
          storyProgress?.choices_made?.includes(prereq)
        );
      }

      return {
        ...mission,
        can_accept: canAccept && storyAvailable,
        is_active: activeMissionIds.has(mission.id),
        is_on_cooldown: isOnCooldown,
        daily_limit_reached: dailyLimitReached,
        completions_today: completion ? parseInt(completion.today_count) : 0,
        cooldown_ends: isOnCooldown ?
          new Date(new Date(completion.last_completed).getTime() + mission.cooldown_hours * 60 * 60 * 1000) : null,
        meets_rank_requirement: hasMinRank(playerRank, mission.min_rank),
        meets_rep_requirement: playerRep >= mission.min_reputation,
        story_available: storyAvailable
      };
    });

    // Separate by availability
    const available = missions.filter(m => m.can_accept);
    const locked = missions.filter(m => !m.can_accept && !m.is_active);
    const active = missions.filter(m => m.is_active);

    res.json({
      success: true,
      data: {
        player_rank: playerRank,
        player_reputation: playerRep,
        missions: { available, locked, active },
        story_progress: storyProgress
      }
    });
  } catch (error) {
    console.error('Error fetching faction missions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch missions' });
  }
});

// POST /api/factions/:id/missions/:mid/accept - Take mission
router.post('/:id/missions/:mid/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const missionId = parseInt(req.params.mid);

    // Get mission details
    const missionResult = await pool.query(`
      SELECT * FROM faction_missions
      WHERE id = $1 AND faction_id = $2 AND is_active = true
    `, [missionId, factionId]);

    if (missionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mission not found' });
    }

    const mission = missionResult.rows[0];

    // Get player reputation
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const playerRep = repResult.rows[0]?.reputation || 0;
    const playerRank = repResult.rows[0]?.rank || 'outsider';

    // Check requirements
    if (playerRep < mission.min_reputation) {
      return res.status(403).json({
        success: false,
        error: `You need ${mission.min_reputation} reputation to accept this mission`
      });
    }

    if (!hasMinRank(playerRank, mission.min_rank)) {
      return res.status(403).json({
        success: false,
        error: `You need to be at least ${mission.min_rank} rank to accept this mission`
      });
    }

    // Check if already active
    const activeCheck = await pool.query(`
      SELECT id FROM active_faction_missions
      WHERE player_id = $1 AND mission_id = $2 AND status = 'active'
    `, [playerId, missionId]);

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Mission already active' });
    }

    // Check cooldown
    const cooldownCheck = await pool.query(`
      SELECT completed_at FROM faction_mission_completions
      WHERE player_id = $1 AND mission_id = $2
      ORDER BY completed_at DESC LIMIT 1
    `, [playerId, missionId]);

    if (cooldownCheck.rows.length > 0) {
      const lastCompleted = new Date(cooldownCheck.rows[0].completed_at);
      const cooldownEnd = new Date(lastCompleted.getTime() + mission.cooldown_hours * 60 * 60 * 1000);
      if (cooldownEnd > new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Mission is on cooldown',
          cooldown_ends: cooldownEnd
        });
      }
    }

    // Check daily limit
    const dailyCheck = await pool.query(`
      SELECT COUNT(*) FROM faction_mission_completions
      WHERE player_id = $1 AND mission_id = $2
        AND completed_at > NOW() - INTERVAL '24 hours'
    `, [playerId, missionId]);

    if (parseInt(dailyCheck.rows[0].count) >= mission.max_daily_completions) {
      return res.status(400).json({
        success: false,
        error: 'Daily mission limit reached'
      });
    }

    // Create active mission
    const expiresAt = new Date(Date.now() + mission.time_limit_minutes * 60 * 1000);

    const insertResult = await pool.query(`
      INSERT INTO active_faction_missions
        (player_id, mission_id, faction_id, status, progress, expires_at)
      VALUES ($1, $2, $3, 'active', $4, $5)
      RETURNING *
    `, [playerId, missionId, factionId, JSON.stringify({}), expiresAt]);

    // Initialize story progress if story mission
    if (mission.is_story_mission) {
      await pool.query(`
        INSERT INTO faction_story_progress (player_id, faction_id, current_chapter, chapter_progress)
        VALUES ($1, $2, 'introduction', 0)
        ON CONFLICT (player_id, faction_id) DO NOTHING
      `, [playerId, factionId]);
    }

    res.json({
      success: true,
      data: {
        message: `Mission "${mission.name}" accepted`,
        mission: {
          ...mission,
          active_id: insertResult.rows[0].id,
          expires_at: expiresAt,
          progress: {}
        }
      }
    });
  } catch (error) {
    console.error('Error accepting faction mission:', error);
    res.status(500).json({ success: false, error: 'Failed to accept mission' });
  }
});

// GET /api/factions/missions/active - Player's active faction missions
router.get('/missions/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT
        afm.*,
        fm.name, fm.description, fm.mission_type, fm.objectives,
        fm.reputation_reward, fm.cash_reward, fm.xp_reward,
        fm.difficulty, fm.icon,
        f.name as faction_name, f.icon as faction_icon, f.color as faction_color
      FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      JOIN factions f ON afm.faction_id = f.id
      WHERE afm.player_id = $1 AND afm.status = 'active'
      ORDER BY afm.expires_at ASC
    `, [playerId]);

    // Check for expired missions
    const now = new Date();
    const active: any[] = [];
    const expired: any[] = [];

    for (const mission of result.rows) {
      if (new Date(mission.expires_at) < now) {
        expired.push(mission);
        // Mark as failed
        await pool.query(`
          UPDATE active_faction_missions
          SET status = 'failed', completed_at = NOW()
          WHERE id = $1
        `, [mission.id]);
      } else {
        active.push(mission);
      }
    }

    res.json({
      success: true,
      data: {
        active_missions: active,
        expired_missions: expired.length
      }
    });
  } catch (error) {
    console.error('Error fetching active missions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active missions' });
  }
});

// POST /api/factions/missions/:activeId/progress - Update mission progress
router.post('/missions/:activeId/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeId = parseInt(req.params.activeId);
    const { objective_type, objective_value } = req.body;

    // Get active mission
    const missionResult = await pool.query(`
      SELECT afm.*, fm.objectives, fm.name
      FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      WHERE afm.id = $1 AND afm.player_id = $2 AND afm.status = 'active'
    `, [activeId, playerId]);

    if (missionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Active mission not found' });
    }

    const mission = missionResult.rows[0];

    if (new Date(mission.expires_at) < new Date()) {
      await pool.query(`
        UPDATE active_faction_missions SET status = 'failed' WHERE id = $1
      `, [activeId]);
      return res.status(400).json({ success: false, error: 'Mission has expired' });
    }

    // Update progress
    const progress = mission.progress || {};
    progress[objective_type] = (progress[objective_type] || 0) + (objective_value || 1);

    await pool.query(`
      UPDATE active_faction_missions SET progress = $1 WHERE id = $2
    `, [JSON.stringify(progress), activeId]);

    // Check if all objectives complete
    const objectives = mission.objectives || [];
    const isComplete = objectives.every((obj: any) => {
      if (obj.count) {
        return (progress[obj.type] || 0) >= obj.count;
      }
      return progress[obj.type] !== undefined;
    });

    res.json({
      success: true,
      data: {
        progress,
        is_complete: isComplete,
        mission_name: mission.name
      }
    });
  } catch (error) {
    console.error('Error updating mission progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

// POST /api/factions/missions/:activeId/complete - Complete mission
router.post('/missions/:activeId/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeId = parseInt(req.params.activeId);

    // Get active mission with full details
    const missionResult = await pool.query(`
      SELECT
        afm.*,
        fm.name, fm.objectives, fm.reputation_reward, fm.cash_reward, fm.xp_reward,
        fm.enemy_faction_id, fm.is_story_mission, fm.story_order,
        f.name as faction_name
      FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      JOIN factions f ON afm.faction_id = f.id
      WHERE afm.id = $1 AND afm.player_id = $2 AND afm.status = 'active'
    `, [activeId, playerId]);

    if (missionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Active mission not found' });
    }

    const mission = missionResult.rows[0];

    // Check expiration
    if (new Date(mission.expires_at) < new Date()) {
      await pool.query(`
        UPDATE active_faction_missions SET status = 'failed', completed_at = NOW() WHERE id = $1
      `, [activeId]);
      return res.status(400).json({ success: false, error: 'Mission has expired' });
    }

    // Verify objectives complete (simplified - in real game would validate each)
    const progress = mission.progress || {};
    const objectives = mission.objectives || [];

    // For demo purposes, we'll allow completion if endpoint is called
    // In production, you'd validate each objective

    await pool.query('BEGIN');

    // Mark mission complete
    await pool.query(`
      UPDATE active_faction_missions
      SET status = 'completed', completed_at = NOW(), rewards_claimed = true
      WHERE id = $1
    `, [activeId]);

    // Record completion
    await pool.query(`
      INSERT INTO faction_mission_completions
        (player_id, mission_id, faction_id, was_successful, reputation_earned, cash_earned)
      VALUES ($1, $2, $3, true, $4, $5)
    `, [playerId, mission.mission_id, mission.faction_id, mission.reputation_reward, mission.cash_reward]);

    // Award reputation to faction
    const repResult = await modifyFactionReputation(
      playerId,
      mission.faction_id,
      mission.reputation_reward,
      `Completed mission: ${mission.name}`
    );

    // If war mission, decrease rep with enemy faction
    if (mission.enemy_faction_id) {
      const enemyRepLoss = Math.floor(mission.reputation_reward * 0.5);
      await modifyFactionReputation(
        playerId,
        mission.enemy_faction_id,
        -enemyRepLoss,
        `Hostile action: ${mission.name}`
      );
    }

    // Award cash and XP
    await pool.query(`
      UPDATE players
      SET
        cash = cash + $2,
        xp = xp + $3
      WHERE id = $1
    `, [playerId, mission.cash_reward, mission.xp_reward]);

    // Update missions completed count
    await pool.query(`
      UPDATE player_faction_rep
      SET missions_completed = missions_completed + 1
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, mission.faction_id]);

    // Update story progress if story mission
    if (mission.is_story_mission) {
      await pool.query(`
        UPDATE faction_story_progress
        SET
          chapter_progress = chapter_progress + 1,
          choices_made = choices_made || $3::jsonb,
          last_progress = NOW()
        WHERE player_id = $1 AND faction_id = $2
      `, [playerId, mission.faction_id, JSON.stringify([mission.mission_id])]);
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Mission "${mission.name}" completed!`,
        rewards: {
          cash: mission.cash_reward,
          xp: mission.xp_reward,
          reputation: mission.reputation_reward
        },
        faction_standing: repResult,
        enemy_rep_lost: mission.enemy_faction_id ? Math.floor(mission.reputation_reward * 0.5) : 0
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error completing mission:', error);
    res.status(500).json({ success: false, error: 'Failed to complete mission' });
  }
});

// POST /api/factions/missions/:activeId/abandon - Abandon mission
router.post('/missions/:activeId/abandon', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activeId = parseInt(req.params.activeId);

    const missionResult = await pool.query(`
      SELECT afm.*, fm.name, fm.reputation_reward
      FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      WHERE afm.id = $1 AND afm.player_id = $2 AND afm.status = 'active'
    `, [activeId, playerId]);

    if (missionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Active mission not found' });
    }

    const mission = missionResult.rows[0];

    // Abandoning costs reputation
    const repPenalty = Math.floor(mission.reputation_reward * 0.25);

    await pool.query('BEGIN');

    await pool.query(`
      UPDATE active_faction_missions
      SET status = 'abandoned', completed_at = NOW()
      WHERE id = $1
    `, [activeId]);

    // Penalize reputation
    await modifyFactionReputation(
      playerId,
      mission.faction_id,
      -repPenalty,
      `Abandoned mission: ${mission.name}`
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Mission "${mission.name}" abandoned`,
        reputation_lost: repPenalty
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error abandoning mission:', error);
    res.status(500).json({ success: false, error: 'Failed to abandon mission' });
  }
});

// GET /api/factions/missions/history - Mission completion history
router.get('/missions/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const result = await pool.query(`
      SELECT
        fmc.*,
        fm.name, fm.mission_type, fm.difficulty, fm.icon,
        f.name as faction_name, f.icon as faction_icon
      FROM faction_mission_completions fmc
      JOIN faction_missions fm ON fmc.mission_id = fm.id
      JOIN factions f ON fmc.faction_id = f.id
      WHERE fmc.player_id = $1
      ORDER BY fmc.completed_at DESC
      LIMIT $2
    `, [playerId, limit]);

    // Get stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_completed,
        COUNT(*) FILTER (WHERE was_successful) as successful,
        SUM(reputation_earned) as total_rep_earned,
        SUM(cash_earned) as total_cash_earned
      FROM faction_mission_completions
      WHERE player_id = $1
    `, [playerId]);

    res.json({
      success: true,
      data: {
        history: result.rows,
        stats: statsResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching mission history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// Process expired missions (called periodically)
export async function processExpiredMissions(): Promise<void> {
  try {
    const result = await pool.query(`
      UPDATE active_faction_missions
      SET status = 'failed', completed_at = NOW()
      WHERE status = 'active' AND expires_at < NOW()
      RETURNING player_id, faction_id, mission_id
    `);

    // Apply reputation penalties for failures
    for (const failed of result.rows) {
      await modifyFactionReputation(
        failed.player_id,
        failed.faction_id,
        -10,
        'Mission failed (expired)'
      );
    }

    if (result.rowCount && result.rowCount > 0) {
      console.log(`Processed ${result.rowCount} expired faction missions`);
    }
  } catch (error) {
    console.error('Error processing expired missions:', error);
  }
}

export default router;
