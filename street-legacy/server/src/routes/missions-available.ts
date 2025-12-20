import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

const DAILY_CONTRACTS_COUNT = 5;
const HOURLY_TASKS_COUNT = 4;

// GET /api/missions/available - Get ALL available missions for the player
router.get('/available', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player data
    const playerResult = await pool.query(
      `SELECT level, current_district, crew_id, stamina, focus
       FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];
    const today = new Date().toISOString().split('T')[0];

    // 1. Get NPC Jobs (from contacts in current district)
    const npcJobsResult = await pool.query(
      `SELECT nm.*, n.name as npc_name, n.avatar_emoji, n.cut_percentage,
              COALESCE(nr.trust, 0) as player_trust
       FROM npc_missions nm
       JOIN npcs n ON nm.npc_id = n.id
       LEFT JOIN npc_relationships nr ON nr.npc_id = n.id AND nr.player_id = $1
       WHERE n.district_id = $2
         AND nm.min_level <= $3
         AND (nr.trust >= n.trust_level_required OR n.trust_level_required = 0)
         AND nm.min_trust <= COALESCE(nr.trust, 0)
       ORDER BY nm.min_level ASC
       LIMIT 10`,
      [playerId, player.current_district, player.level]
    );

    const npcJobs = npcJobsResult.rows.map(m => ({
      id: m.id,
      category: 'npc_job',
      title: m.title,
      description: m.description,
      npcName: m.npc_name,
      npcEmoji: m.avatar_emoji,
      missionType: m.mission_type,
      staminaCost: m.stamina_cost,
      focusCost: m.focus_cost,
      timeMinutes: m.time_minutes,
      baseSuccessRate: m.base_success_rate,
      baseCashReward: m.base_cash_reward,
      baseXpReward: m.base_xp_reward,
      canAccept: player.stamina >= m.stamina_cost && player.focus >= m.focus_cost
    }));

    // 2. Get Daily Contracts
    const dailyContracts = await getDailyContracts(playerId, player.level, today);

    // 3. Get Hourly Tasks
    const hourlyTasks = await getHourlyTasks(playerId, player.level);

    // 4. Get Story Missions (current chapter)
    const storyMissionsResult = await pool.query(
      `SELECT sm.*, sc.title as chapter_title, psp.current_mission, psp.mission_progress
       FROM story_missions sm
       JOIN story_chapters sc ON sm.chapter_id = sc.id
       LEFT JOIN player_story_progress psp ON psp.chapter_id = sc.id AND psp.player_id = $1
       WHERE sc.min_level <= $2
         AND (psp.completed_at IS NULL OR psp.id IS NULL)
         AND (sm.mission_order = COALESCE(psp.current_mission, 1))
       ORDER BY sc.chapter_number ASC
       LIMIT 3`,
      [playerId, player.level]
    );

    const storyMissions = storyMissionsResult.rows.map(m => ({
      id: m.id,
      category: 'story',
      title: m.title,
      description: m.description,
      chapterTitle: m.chapter_title,
      missionType: m.mission_type,
      progress: m.mission_progress || 0,
      targetCount: m.target_count,
      staminaCost: m.stamina_cost,
      focusCost: m.focus_cost,
      cashReward: m.reward_cash,
      xpReward: m.reward_xp,
      canAccept: player.stamina >= m.stamina_cost && player.focus >= m.focus_cost
    }));

    // 5. Get Crew Assignments (if in a crew)
    let crewAssignments: any[] = [];
    if (player.crew_id) {
      const crewResult = await pool.query(
        `SELECT ca.*, p.username as assigned_by_name
         FROM crew_assignments ca
         JOIN players p ON ca.assigned_by = p.id
         WHERE ca.crew_id = $1
           AND (ca.assigned_to IS NULL OR ca.assigned_to = $2)
           AND ca.status IN ('pending', 'in_progress')
           AND (ca.expires_at IS NULL OR ca.expires_at > NOW())
         ORDER BY ca.created_at DESC
         LIMIT 5`,
        [player.crew_id, playerId]
      );

      crewAssignments = crewResult.rows.map(ca => ({
        id: ca.id,
        category: 'crew_assignment',
        title: ca.title,
        description: ca.description,
        assignedBy: ca.assigned_by_name,
        missionType: ca.mission_type,
        targetValue: ca.target_value,
        progress: ca.progress,
        status: ca.status,
        cashReward: ca.cash_reward,
        xpReward: ca.xp_reward,
        repReward: ca.rep_reward,
        expiresAt: ca.expires_at
      }));
    }

    // 6. Get Regeneration Activities
    const regenActivities = await getRegenActivities(playerId);

    // Combine all available missions
    res.json({
      success: true,
      data: {
        npcJobs: {
          category: 'NPC Jobs',
          description: 'Jobs from your contacts in the criminal underworld',
          icon: '🤝',
          missions: npcJobs
        },
        dailyContracts: {
          category: 'Daily Contracts',
          description: '5 new missions every day',
          icon: '📅',
          refreshesAt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString(),
          missions: dailyContracts
        },
        hourlyTasks: {
          category: 'Hourly Tasks',
          description: 'Quick jobs that refresh every hour',
          icon: '⏰',
          missions: hourlyTasks.tasks,
          refreshesAt: hourlyTasks.refreshesAt
        },
        storyMissions: {
          category: 'Story Missions',
          description: 'One-time campaign missions',
          icon: '📖',
          missions: storyMissions
        },
        crewAssignments: {
          category: 'Crew Assignments',
          description: 'Tasks from your crew leadership',
          icon: '👥',
          missions: crewAssignments
        },
        regenActivities: {
          category: 'Recovery',
          description: 'Rest and recover your attributes',
          icon: '💤',
          activities: regenActivities
        }
      }
    });
  } catch (error) {
    console.error('Get available missions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get available missions' });
  }
});

// Helper: Get or generate daily contracts
async function getDailyContracts(playerId: number, playerLevel: number, today: string) {
  // Check if contracts exist for today
  let contractsResult = await pool.query(
    `SELECT * FROM daily_contracts WHERE date = $1`,
    [today]
  );

  // Generate new contracts if none exist
  if (contractsResult.rows.length === 0) {
    const contracts = generateDailyContracts(playerLevel);
    await pool.query(
      `INSERT INTO daily_contracts (date, mission_data, expires_at)
       VALUES ($1, $2, $3)`,
      [today, JSON.stringify(contracts), new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)]
    );

    contractsResult = await pool.query(
      `SELECT * FROM daily_contracts WHERE date = $1`,
      [today]
    );
  }

  const contracts = contractsResult.rows[0].mission_data;

  // Get player's progress on these contracts
  const progressResult = await pool.query(
    `SELECT * FROM player_daily_contracts
     WHERE player_id = $1 AND contract_date = $2`,
    [playerId, today]
  );

  const progressMap = new Map();
  progressResult.rows.forEach(p => progressMap.set(p.contract_index, p));

  return contracts.map((contract: any, index: number) => {
    const progress = progressMap.get(index);
    return {
      id: `daily_${today}_${index}`,
      category: 'daily_contract',
      index,
      ...contract,
      progress: progress?.progress || 0,
      completed: progress?.completed || false,
      claimed: progress?.claimed || false
    };
  });
}

// Helper: Generate daily contracts
function generateDailyContracts(playerLevel: number) {
  const contracts: Array<{
    title: string;
    description: string;
    type: string;
    targetValue: number;
    cashReward: number;
    xpReward: number;
    difficulty: string;
  }> = [];
  const types = [
    { type: 'crimes', description: 'Complete {n} crimes', targets: [3, 5, 8, 12, 20] },
    { type: 'earnings', description: 'Earn ${n} from crimes', targets: [500, 1000, 2500, 5000, 10000] },
    { type: 'streak', description: 'Complete {n} crimes without failing', targets: [3, 5, 7, 10, 15] },
    { type: 'district', description: 'Complete {n} crimes in any district', targets: [2, 3, 5, 7, 10] },
    { type: 'specific', description: 'Complete a specific crime type', targets: [1, 2, 3, 4, 5] }
  ];

  // Select 5 random contract types
  const shuffled = types.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, DAILY_CONTRACTS_COUNT);

  selected.forEach((template, index) => {
    // Scale target based on player level
    const targetIndex = Math.min(Math.floor(playerLevel / 3), template.targets.length - 1);
    const target = template.targets[targetIndex];

    // Calculate reward based on difficulty
    const baseReward = 200 + (index * 100) + (playerLevel * 50);
    const baseXp = 50 + (index * 25) + (playerLevel * 10);

    contracts.push({
      title: `Contract ${index + 1}`,
      description: template.description.replace('{n}', target.toString()),
      type: template.type,
      targetValue: target,
      cashReward: baseReward,
      xpReward: baseXp,
      difficulty: ['Easy', 'Medium', 'Hard', 'Expert', 'Master'][index]
    });
  });

  return contracts;
}

// Helper: Get or generate hourly tasks
async function getHourlyTasks(playerId: number, playerLevel: number) {
  // Get player's hourly tasks record
  let tasksResult = await pool.query(
    `SELECT * FROM player_hourly_tasks WHERE player_id = $1`,
    [playerId]
  );

  const now = new Date();

  // Check if needs refresh
  if (tasksResult.rows.length === 0 || new Date(tasksResult.rows[0].refreshes_at) < now) {
    // Get available hourly tasks
    const availableTasksResult = await pool.query(
      `SELECT * FROM hourly_tasks WHERE min_level <= $1 ORDER BY RANDOM() LIMIT $2`,
      [playerLevel, HOURLY_TASKS_COUNT]
    );

    const taskIds = availableTasksResult.rows.map(t => t.id);
    const refreshTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    await pool.query(
      `INSERT INTO player_hourly_tasks (player_id, task_ids, completed_ids, refreshes_at)
       VALUES ($1, $2, '[]', $3)
       ON CONFLICT (player_id)
       DO UPDATE SET task_ids = $2, completed_ids = '[]', refreshes_at = $3`,
      [playerId, JSON.stringify(taskIds), refreshTime]
    );

    tasksResult = await pool.query(
      `SELECT * FROM player_hourly_tasks WHERE player_id = $1`,
      [playerId]
    );
  }

  const playerTasks = tasksResult.rows[0];
  const taskIds = playerTasks.task_ids;
  const completedIds = playerTasks.completed_ids;

  // Get task details
  const tasksDetailResult = await pool.query(
    `SELECT * FROM hourly_tasks WHERE id = ANY($1)`,
    [taskIds]
  );

  const tasks = tasksDetailResult.rows.map(t => ({
    id: t.id,
    category: 'hourly_task',
    name: t.name,
    description: t.description,
    taskType: t.task_type,
    staminaCost: t.stamina_cost,
    focusCost: t.focus_cost,
    timeMinutes: t.time_minutes,
    cashReward: t.base_cash_reward,
    xpReward: t.base_xp_reward,
    completed: completedIds.includes(t.id)
  }));

  return {
    tasks,
    refreshesAt: playerTasks.refreshes_at
  };
}

// Helper: Get regeneration activities
async function getRegenActivities(playerId: number) {
  // Get all regen activities with cooldown status
  const activitiesResult = await pool.query(
    `SELECT ra.*,
            prc.available_at
     FROM regen_activities ra
     LEFT JOIN player_regen_cooldowns prc ON prc.activity_id = ra.id AND prc.player_id = $1
     ORDER BY ra.activity_type, ra.time_minutes`,
    [playerId]
  );

  const now = new Date();

  return activitiesResult.rows.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    activityType: a.activity_type,
    staminaRegen: a.stamina_regen,
    focusRegen: a.focus_regen,
    heatReduction: a.heat_reduction,
    influenceGain: a.influence_gain,
    timeMinutes: a.time_minutes,
    cashCost: a.cash_cost,
    cooldownMinutes: a.cooldown_minutes,
    onCooldown: a.available_at && new Date(a.available_at) > now,
    availableAt: a.available_at
  }));
}

// POST /api/missions/daily/:index/start - Start working on a daily contract
router.post('/daily/:index/start', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const contractIndex = parseInt(req.params.index);
    const today = new Date().toISOString().split('T')[0];

    if (isNaN(contractIndex) || contractIndex < 0 || contractIndex >= DAILY_CONTRACTS_COUNT) {
      res.status(400).json({ success: false, error: 'Invalid contract index' });
      return;
    }

    // Get the contract
    const contractResult = await pool.query(
      `SELECT * FROM daily_contracts WHERE date = $1`,
      [today]
    );

    if (contractResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No contracts for today' });
      return;
    }

    const contracts = contractResult.rows[0].mission_data;
    const contract = contracts[contractIndex];

    if (!contract) {
      res.status(404).json({ success: false, error: 'Contract not found' });
      return;
    }

    // Start tracking progress
    await pool.query(
      `INSERT INTO player_daily_contracts (player_id, contract_date, contract_index, started_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (player_id, contract_date, contract_index) DO NOTHING`,
      [playerId, today, contractIndex]
    );

    res.json({
      success: true,
      data: {
        message: 'Contract started',
        contract: { ...contract, index: contractIndex }
      }
    });
  } catch (error) {
    console.error('Start daily contract error:', error);
    res.status(500).json({ success: false, error: 'Failed to start contract' });
  }
});

// POST /api/missions/daily/:index/claim - Claim completed daily contract reward
router.post('/daily/:index/claim', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const contractIndex = parseInt(req.params.index);
    const today = new Date().toISOString().split('T')[0];

    // Get player's progress
    const progressResult = await pool.query(
      `SELECT * FROM player_daily_contracts
       WHERE player_id = $1 AND contract_date = $2 AND contract_index = $3`,
      [playerId, today, contractIndex]
    );

    if (progressResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Contract progress not found' });
      return;
    }

    const progress = progressResult.rows[0];

    if (!progress.completed) {
      res.status(400).json({ success: false, error: 'Contract not completed' });
      return;
    }

    if (progress.claimed) {
      res.status(400).json({ success: false, error: 'Reward already claimed' });
      return;
    }

    // Get contract rewards
    const contractResult = await pool.query(
      `SELECT mission_data FROM daily_contracts WHERE date = $1`,
      [today]
    );

    const contract = contractResult.rows[0].mission_data[contractIndex];

    // Award rewards
    await pool.query(
      `UPDATE players SET cash = cash + $1, xp = xp + $2 WHERE id = $3`,
      [contract.cashReward, contract.xpReward, playerId]
    );

    // Mark as claimed
    await pool.query(
      `UPDATE player_daily_contracts SET claimed = true WHERE id = $1`,
      [progress.id]
    );

    res.json({
      success: true,
      data: {
        message: 'Reward claimed!',
        cashReward: contract.cashReward,
        xpReward: contract.xpReward
      }
    });
  } catch (error) {
    console.error('Claim daily contract error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim reward' });
  }
});

// POST /api/missions/hourly/:id/complete - Complete an hourly task
router.post('/hourly/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const taskId = parseInt(req.params.id);

    // Get player
    const playerResult = await pool.query(
      `SELECT stamina, focus FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Get the task
    const taskResult = await pool.query(
      `SELECT * FROM hourly_tasks WHERE id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const task = taskResult.rows[0];

    // Check if player has this task active
    const playerTasksResult = await pool.query(
      `SELECT * FROM player_hourly_tasks WHERE player_id = $1`,
      [playerId]
    );

    if (playerTasksResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'No active hourly tasks' });
      return;
    }

    const playerTasks = playerTasksResult.rows[0];
    const taskIds = playerTasks.task_ids;
    const completedIds = playerTasks.completed_ids;

    if (!taskIds.includes(taskId)) {
      res.status(400).json({ success: false, error: 'Task not in your active tasks' });
      return;
    }

    if (completedIds.includes(taskId)) {
      res.status(400).json({ success: false, error: 'Task already completed' });
      return;
    }

    // Check costs
    if (player.stamina < task.stamina_cost) {
      res.status(400).json({ success: false, error: 'Not enough stamina' });
      return;
    }

    if (player.focus < task.focus_cost) {
      res.status(400).json({ success: false, error: 'Not enough focus' });
      return;
    }

    // Deduct costs and award rewards
    await pool.query(
      `UPDATE players
       SET stamina = stamina - $1, focus = focus - $2,
           cash = cash + $3, xp = xp + $4
       WHERE id = $5`,
      [task.stamina_cost, task.focus_cost, task.base_cash_reward, task.base_xp_reward, playerId]
    );

    // Mark task as completed
    const newCompletedIds = [...completedIds, taskId];
    await pool.query(
      `UPDATE player_hourly_tasks SET completed_ids = $1 WHERE player_id = $2`,
      [JSON.stringify(newCompletedIds), playerId]
    );

    res.json({
      success: true,
      data: {
        message: 'Task completed!',
        taskName: task.name,
        cashReward: task.base_cash_reward,
        xpReward: task.base_xp_reward,
        staminaSpent: task.stamina_cost,
        focusSpent: task.focus_cost
      }
    });
  } catch (error) {
    console.error('Complete hourly task error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete task' });
  }
});

// POST /api/missions/regen/:id - Perform a regeneration activity
router.post('/regen/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const activityId = parseInt(req.params.id);

    // Get player
    const playerResult = await pool.query(
      `SELECT cash, stamina, stamina_max, focus, focus_max, heat_level, influence
       FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Get the activity
    const activityResult = await pool.query(
      `SELECT * FROM regen_activities WHERE id = $1`,
      [activityId]
    );

    if (activityResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Activity not found' });
      return;
    }

    const activity = activityResult.rows[0];

    // Check cash cost
    if (player.cash < activity.cash_cost) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Check cooldown
    const cooldownResult = await pool.query(
      `SELECT available_at FROM player_regen_cooldowns
       WHERE player_id = $1 AND activity_id = $2`,
      [playerId, activityId]
    );

    if (cooldownResult.rows.length > 0) {
      const availableAt = new Date(cooldownResult.rows[0].available_at);
      if (availableAt > new Date()) {
        res.status(400).json({
          success: false,
          error: 'Activity on cooldown',
          availableAt: availableAt.toISOString()
        });
        return;
      }
    }

    // Apply the activity effects
    const newStamina = Math.min(player.stamina + activity.stamina_regen, player.stamina_max);
    const newFocus = Math.min(player.focus + activity.focus_regen, player.focus_max);
    const newHeat = Math.max(0, player.heat_level - activity.heat_reduction);
    const newInfluence = Math.min(100, player.influence + activity.influence_gain);

    await pool.query(
      `UPDATE players
       SET cash = cash - $1,
           stamina = $2,
           focus = $3,
           heat_level = $4,
           influence = $5
       WHERE id = $6`,
      [activity.cash_cost, newStamina, newFocus, newHeat, newInfluence, playerId]
    );

    // Set cooldown
    const cooldownEnd = new Date(Date.now() + activity.cooldown_minutes * 60 * 1000);
    await pool.query(
      `INSERT INTO player_regen_cooldowns (player_id, activity_id, available_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, activity_id)
       DO UPDATE SET available_at = $3`,
      [playerId, activityId, cooldownEnd]
    );

    res.json({
      success: true,
      data: {
        message: `${activity.name} completed!`,
        effects: {
          staminaRecovered: activity.stamina_regen,
          focusRecovered: activity.focus_regen,
          heatReduced: activity.heat_reduction,
          influenceGained: activity.influence_gain
        },
        cashSpent: activity.cash_cost,
        cooldownEnds: cooldownEnd.toISOString()
      }
    });
  } catch (error) {
    console.error('Regen activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to perform activity' });
  }
});

// Helper function to update daily contract progress (called from crime route)
export async function updateDailyContractProgress(
  playerId: number,
  crimeId: number,
  earnings: number,
  success: boolean,
  currentStreak: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Get today's contracts
  const contractsResult = await pool.query(
    `SELECT mission_data FROM daily_contracts WHERE date = $1`,
    [today]
  );

  if (contractsResult.rows.length === 0) return;

  const contracts = contractsResult.rows[0].mission_data;

  // Get player's contract progress
  const progressResult = await pool.query(
    `SELECT * FROM player_daily_contracts
     WHERE player_id = $1 AND contract_date = $2`,
    [playerId, today]
  );

  const progressMap = new Map();
  progressResult.rows.forEach(p => progressMap.set(p.contract_index, p));

  // Update each applicable contract
  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    let progress = progressMap.get(i);

    // Skip if not started or already completed
    if (!progress || progress.completed) continue;

    let newProgress = progress.progress;
    let shouldUpdate = false;

    switch (contract.type) {
      case 'crimes':
        if (success) {
          newProgress += 1;
          shouldUpdate = true;
        }
        break;

      case 'earnings':
        if (success && earnings > 0) {
          newProgress += earnings;
          shouldUpdate = true;
        }
        break;

      case 'streak':
        if (success) {
          // Use the current streak value
          newProgress = currentStreak;
          shouldUpdate = true;
        } else {
          // Reset on failure
          newProgress = 0;
          shouldUpdate = true;
        }
        break;

      case 'district':
        if (success) {
          newProgress += 1;
          shouldUpdate = true;
        }
        break;

      case 'specific':
        if (success) {
          newProgress += 1;
          shouldUpdate = true;
        }
        break;
    }

    if (shouldUpdate) {
      const completed = newProgress >= contract.targetValue;
      await pool.query(
        `UPDATE player_daily_contracts
         SET progress = $1, completed = $2, completed_at = $3
         WHERE id = $4`,
        [newProgress, completed, completed ? new Date() : null, progress.id]
      );
    }
  }
}

export default router;
