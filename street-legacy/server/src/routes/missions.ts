import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { claimMissionSchema } from '../validation/schemas/index.js';

const router = Router();

router.use(authMiddleware);

const MISSIONS_PER_DAY = 3;

// GET /api/missions - Get player's daily missions
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const today = new Date().toISOString().split('T')[0];

    // Check if player has missions for today
    const existingMissionsResult = await pool.query(
      `SELECT pm.*, m.description, m.type, m.target_value, m.reward_cash, m.reward_xp,
              m.target_district_id, m.target_crime_id,
              d.name as district_name, c.name as crime_name
       FROM player_missions pm
       JOIN missions m ON pm.mission_id = m.id
       LEFT JOIN districts d ON m.target_district_id = d.id
       LEFT JOIN crimes c ON m.target_crime_id = c.id
       WHERE pm.player_id = $1 AND pm.assigned_at = $2`,
      [playerId, today]
    );

    if (existingMissionsResult.rows.length > 0) {
      res.json({
        success: true,
        data: {
          missions: existingMissionsResult.rows.map(m => ({
            id: m.id,
            missionId: m.mission_id,
            description: m.description,
            type: m.type,
            targetValue: m.target_value,
            progress: m.progress,
            completed: m.completed,
            claimed: m.claimed,
            rewardCash: m.reward_cash,
            rewardXp: m.reward_xp,
            districtName: m.district_name,
            crimeName: m.crime_name
          }))
        }
      });
      return;
    }

    // Assign new random missions for today
    const availableMissionsResult = await pool.query(
      `SELECT id FROM missions ORDER BY RANDOM() LIMIT $1`,
      [MISSIONS_PER_DAY]
    );

    // OPTIMIZATION: Batch INSERT using unnest instead of loop
    const missionIds = availableMissionsResult.rows.map(m => m.id);
    const insertResult = await pool.query(
      `INSERT INTO player_missions (player_id, mission_id, assigned_at)
       SELECT $1, unnest($2::int[]), $3
       RETURNING id`,
      [playerId, missionIds, today]
    );
    const assignedMissions = insertResult.rows.map(r => r.id);

    // Fetch the full mission data
    const newMissionsResult = await pool.query(
      `SELECT pm.*, m.description, m.type, m.target_value, m.reward_cash, m.reward_xp,
              m.target_district_id, m.target_crime_id,
              d.name as district_name, c.name as crime_name
       FROM player_missions pm
       JOIN missions m ON pm.mission_id = m.id
       LEFT JOIN districts d ON m.target_district_id = d.id
       LEFT JOIN crimes c ON m.target_crime_id = c.id
       WHERE pm.id = ANY($1)`,
      [assignedMissions]
    );

    res.json({
      success: true,
      data: {
        missions: newMissionsResult.rows.map(m => ({
          id: m.id,
          missionId: m.mission_id,
          description: m.description,
          type: m.type,
          targetValue: m.target_value,
          progress: m.progress,
          completed: m.completed,
          claimed: m.claimed,
          rewardCash: m.reward_cash,
          rewardXp: m.reward_xp,
          districtName: m.district_name,
          crimeName: m.crime_name
        }))
      }
    });
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get missions' });
  }
});

// POST /api/missions/claim - Claim a completed mission reward
router.post('/claim', validate(claimMissionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { playerMissionId } = req.body;

    // Get the mission
    const missionResult = await pool.query(
      `SELECT pm.*, m.reward_cash, m.reward_xp
       FROM player_missions pm
       JOIN missions m ON pm.mission_id = m.id
       WHERE pm.id = $1 AND pm.player_id = $2`,
      [playerMissionId, playerId]
    );

    if (missionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Mission not found' });
      return;
    }

    const mission = missionResult.rows[0];

    if (!mission.completed) {
      res.status(400).json({ success: false, error: 'Mission not completed yet' });
      return;
    }

    if (mission.claimed) {
      res.status(400).json({ success: false, error: 'Mission already claimed' });
      return;
    }

    // Award rewards
    await pool.query(
      `UPDATE players SET cash = cash + $1, xp = xp + $2 WHERE id = $3`,
      [mission.reward_cash, mission.reward_xp, playerId]
    );

    // Mark as claimed
    await pool.query(
      `UPDATE player_missions SET claimed = true WHERE id = $1`,
      [playerMissionId]
    );

    res.json({
      success: true,
      data: {
        message: 'Mission reward claimed!',
        rewardCash: mission.reward_cash,
        rewardXp: mission.reward_xp
      }
    });
  } catch (error) {
    console.error('Claim mission error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim mission' });
  }
});

// Helper function to update mission progress (called from crime route)
// OPTIMIZED: Uses batch UPDATE instead of individual queries per mission
export async function updateMissionProgress(
  playerId: number,
  crimeId: number,
  districtId: number,
  earnings: number,
  success: boolean
): Promise<void> {
  if (!success) return; // Only successful crimes count

  const today = new Date().toISOString().split('T')[0];

  // Get player's active missions for today
  const missionsResult = await pool.query(
    `SELECT pm.id, pm.progress, pm.completed, m.type, m.target_value,
            m.target_district_id, m.target_crime_id
     FROM player_missions pm
     JOIN missions m ON pm.mission_id = m.id
     WHERE pm.player_id = $1 AND pm.assigned_at = $2 AND pm.completed = false`,
    [playerId, today]
  );

  // Early return if no active missions
  if (missionsResult.rows.length === 0) return;

  // Collect updates to batch process
  const incrementUpdates: { id: number; newProgress: number; completed: boolean }[] = [];
  const earningsUpdates: { id: number; newProgress: number; completed: boolean }[] = [];

  for (const mission of missionsResult.rows) {
    let shouldIncrement = false;

    switch (mission.type) {
      case 'crime_count':
        // Any successful crime counts
        shouldIncrement = true;
        break;

      case 'district':
        // Crime must be in target district
        shouldIncrement = districtId === mission.target_district_id;
        break;

      case 'specific_crime':
        // Crime must be the specific crime
        shouldIncrement = crimeId === mission.target_crime_id;
        break;

      case 'earnings':
        // Add earnings to progress
        if (earnings > 0) {
          const newProgress = mission.progress + earnings;
          const completed = newProgress >= mission.target_value;
          earningsUpdates.push({ id: mission.id, newProgress, completed });
        }
        continue; // Skip the standard increment logic
    }

    if (shouldIncrement) {
      const newProgress = mission.progress + 1;
      const completed = newProgress >= mission.target_value;
      incrementUpdates.push({ id: mission.id, newProgress, completed });
    }
  }

  // Execute batch updates
  const allUpdates = [...incrementUpdates, ...earningsUpdates];
  if (allUpdates.length > 0) {
    // Use a single UPDATE with CASE statements for efficiency
    const ids = allUpdates.map(u => u.id);
    const progressCases = allUpdates.map(u => `WHEN ${u.id} THEN ${u.newProgress}`).join(' ');
    const completedCases = allUpdates.map(u => `WHEN ${u.id} THEN ${u.completed}`).join(' ');

    await pool.query(
      `UPDATE player_missions
       SET progress = CASE id ${progressCases} END,
           completed = CASE id ${completedCases} END
       WHERE id = ANY($1)`,
      [ids]
    );
  }
}

export default router;
