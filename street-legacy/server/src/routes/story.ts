import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/story - Get player's story progress and available chapters
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player level
    const playerResult = await pool.query(
      `SELECT level, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all chapters with player progress
    const chaptersResult = await pool.query(
      `SELECT sc.*,
              psp.current_mission, psp.mission_progress, psp.started_at, psp.completed_at,
              (SELECT COUNT(*) FROM story_missions WHERE chapter_id = sc.id) as total_missions
       FROM story_chapters sc
       LEFT JOIN player_story_progress psp ON sc.id = psp.chapter_id AND psp.player_id = $1
       WHERE sc.min_level <= $2 OR $3 = true
       ORDER BY sc.chapter_number`,
      [playerId, player.level, player.is_master]
    );

    // For each chapter, get the current mission details if in progress
    const chapters = await Promise.all(chaptersResult.rows.map(async (chapter) => {
      let currentMissionDetails = null;

      if (chapter.current_mission && !chapter.completed_at) {
        const missionResult = await pool.query(
          `SELECT * FROM story_missions
           WHERE chapter_id = $1 AND mission_order = $2`,
          [chapter.id, chapter.current_mission]
        );
        currentMissionDetails = missionResult.rows[0] || null;
      }

      return {
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        chapterNumber: chapter.chapter_number,
        minLevel: chapter.min_level,
        totalMissions: parseInt(chapter.total_missions),
        rewardCash: chapter.reward_cash,
        rewardXp: chapter.reward_xp,
        rewardCred: chapter.reward_cred,
        progress: chapter.current_mission ? {
          currentMission: chapter.current_mission,
          missionProgress: chapter.mission_progress,
          startedAt: chapter.started_at,
          completedAt: chapter.completed_at
        } : null,
        currentMissionDetails: currentMissionDetails ? {
          id: currentMissionDetails.id,
          title: currentMissionDetails.title,
          description: currentMissionDetails.description,
          dialogue: currentMissionDetails.dialogue,
          missionType: currentMissionDetails.mission_type,
          targetCount: currentMissionDetails.target_count,
          targetAmount: currentMissionDetails.target_amount,
          bossName: currentMissionDetails.boss_name,
          bossDifficulty: currentMissionDetails.boss_difficulty,
          energyCost: currentMissionDetails.energy_cost,
          nerveCost: currentMissionDetails.nerve_cost,
          rewardCash: currentMissionDetails.reward_cash,
          rewardXp: currentMissionDetails.reward_xp
        } : null
      };
    }));

    res.json({
      success: true,
      data: { chapters }
    });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({ success: false, error: 'Failed to get story' });
  }
});

// POST /api/story/start/:chapterId - Start a chapter
router.post('/start/:chapterId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const chapterId = parseInt(req.params.chapterId);

    // Check if chapter exists and player meets requirements
    const chapterResult = await pool.query(
      `SELECT * FROM story_chapters WHERE id = $1`,
      [chapterId]
    );

    if (chapterResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Chapter not found' });
      return;
    }

    const chapter = chapterResult.rows[0];

    // Get player
    const playerResult = await pool.query(
      `SELECT level, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.level < chapter.min_level && !player.is_master) {
      res.status(400).json({ success: false, error: `Requires level ${chapter.min_level}` });
      return;
    }

    // Check if previous chapter is complete (if not chapter 1)
    if (chapter.chapter_number > 1) {
      const prevChapterResult = await pool.query(
        `SELECT psp.completed_at
         FROM story_chapters sc
         JOIN player_story_progress psp ON sc.id = psp.chapter_id
         WHERE sc.chapter_number = $1 AND psp.player_id = $2`,
        [chapter.chapter_number - 1, playerId]
      );

      if (prevChapterResult.rows.length === 0 || !prevChapterResult.rows[0].completed_at) {
        if (!player.is_master) {
          res.status(400).json({ success: false, error: 'Complete previous chapter first' });
          return;
        }
      }
    }

    // Check if already started
    const existingResult = await pool.query(
      `SELECT * FROM player_story_progress WHERE player_id = $1 AND chapter_id = $2`,
      [playerId, chapterId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Chapter already started' });
      return;
    }

    // Start the chapter
    await pool.query(
      `INSERT INTO player_story_progress (player_id, chapter_id, current_mission, mission_progress)
       VALUES ($1, $2, 1, 0)`,
      [playerId, chapterId]
    );

    // Get first mission
    const firstMissionResult = await pool.query(
      `SELECT * FROM story_missions WHERE chapter_id = $1 AND mission_order = 1`,
      [chapterId]
    );

    res.json({
      success: true,
      data: {
        message: `Started Chapter ${chapter.chapter_number}: ${chapter.title}`,
        firstMission: firstMissionResult.rows[0] ? {
          id: firstMissionResult.rows[0].id,
          title: firstMissionResult.rows[0].title,
          description: firstMissionResult.rows[0].description,
          dialogue: firstMissionResult.rows[0].dialogue,
          missionType: firstMissionResult.rows[0].mission_type,
          targetCount: firstMissionResult.rows[0].target_count
        } : null
      }
    });
  } catch (error) {
    console.error('Start chapter error:', error);
    res.status(500).json({ success: false, error: 'Failed to start chapter' });
  }
});

// POST /api/story/mission/progress - Update mission progress (called by crime/travel/etc)
router.post('/mission/progress', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { actionType, value } = req.body; // actionType: 'crime', 'travel', 'collect', 'rob', 'boss'

    // Get active story progress
    const progressResult = await pool.query(
      `SELECT psp.*, sm.*
       FROM player_story_progress psp
       JOIN story_missions sm ON sm.chapter_id = psp.chapter_id AND sm.mission_order = psp.current_mission
       WHERE psp.player_id = $1 AND psp.completed_at IS NULL`,
      [playerId]
    );

    if (progressResult.rows.length === 0) {
      res.json({ success: true, data: { updated: false, message: 'No active story mission' } });
      return;
    }

    const progress = progressResult.rows[0];

    // Check if action matches mission type
    if (progress.mission_type !== actionType) {
      res.json({ success: true, data: { updated: false, message: 'Action does not match mission type' } });
      return;
    }

    // Update progress based on mission type
    let newProgress = progress.mission_progress;
    let missionComplete = false;

    if (actionType === 'crime' || actionType === 'rob') {
      newProgress += 1;
      if (newProgress >= progress.target_count) {
        missionComplete = true;
      }
    } else if (actionType === 'travel') {
      // For travel missions, check if player traveled to target district
      if (value === progress.target_district_id || !progress.target_district_id) {
        missionComplete = true;
        newProgress = 1;
      }
    } else if (actionType === 'collect') {
      // For collect missions, add the value
      newProgress += value || 0;
      if (newProgress >= progress.target_amount) {
        missionComplete = true;
      }
    } else if (actionType === 'boss') {
      // Boss missions complete when boss is defeated
      missionComplete = true;
      newProgress = 1;
    }

    // Update progress
    await pool.query(
      `UPDATE player_story_progress SET mission_progress = $1 WHERE player_id = $2 AND chapter_id = $3`,
      [newProgress, playerId, progress.chapter_id]
    );

    let response: any = {
      updated: true,
      missionProgress: newProgress,
      targetCount: progress.target_count || progress.target_amount,
      missionComplete
    };

    // If mission complete, award rewards and advance
    if (missionComplete) {
      // Award mission rewards
      await pool.query(
        `UPDATE players SET cash = cash + $1, xp = xp + $2 WHERE id = $3`,
        [progress.reward_cash, progress.reward_xp, playerId]
      );

      response.rewardCash = progress.reward_cash;
      response.rewardXp = progress.reward_xp;

      // Check if there's a next mission
      const nextMissionResult = await pool.query(
        `SELECT * FROM story_missions WHERE chapter_id = $1 AND mission_order = $2`,
        [progress.chapter_id, progress.current_mission + 1]
      );

      if (nextMissionResult.rows.length > 0) {
        // Advance to next mission
        await pool.query(
          `UPDATE player_story_progress
           SET current_mission = $1, mission_progress = 0
           WHERE player_id = $2 AND chapter_id = $3`,
          [progress.current_mission + 1, playerId, progress.chapter_id]
        );

        response.nextMission = {
          title: nextMissionResult.rows[0].title,
          description: nextMissionResult.rows[0].description,
          dialogue: nextMissionResult.rows[0].dialogue
        };
      } else {
        // Chapter complete!
        await pool.query(
          `UPDATE player_story_progress SET completed_at = NOW() WHERE player_id = $1 AND chapter_id = $2`,
          [playerId, progress.chapter_id]
        );

        // Get chapter rewards
        const chapterResult = await pool.query(
          `SELECT * FROM story_chapters WHERE id = $1`,
          [progress.chapter_id]
        );
        const chapter = chapterResult.rows[0];

        // Award chapter completion rewards
        await pool.query(
          `UPDATE players SET cash = cash + $1, xp = xp + $2, street_cred = street_cred + $3 WHERE id = $4`,
          [chapter.reward_cash, chapter.reward_xp, chapter.reward_cred, playerId]
        );

        response.chapterComplete = true;
        response.chapterRewardCash = chapter.reward_cash;
        response.chapterRewardXp = chapter.reward_xp;
        response.chapterRewardCred = chapter.reward_cred;
      }
    }

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Mission progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to update mission progress' });
  }
});

// POST /api/story/boss/:missionId - Attempt a boss fight
router.post('/boss/:missionId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const missionId = parseInt(req.params.missionId);

    // Get the mission
    const missionResult = await pool.query(
      `SELECT * FROM story_missions WHERE id = $1 AND mission_type = 'boss'`,
      [missionId]
    );

    if (missionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Boss mission not found' });
      return;
    }

    const mission = missionResult.rows[0];

    // Check if player is on this mission
    const progressResult = await pool.query(
      `SELECT * FROM player_story_progress
       WHERE player_id = $1 AND chapter_id = $2 AND current_mission = $3 AND completed_at IS NULL`,
      [playerId, mission.chapter_id, mission.mission_order]
    );

    if (progressResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'You are not on this mission' });
      return;
    }

    // Get player
    const playerResult = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];
    const isMaster = player.is_master === true;

    // Check energy and nerve (master bypass)
    if (!isMaster && player.energy < mission.energy_cost) {
      res.status(400).json({ success: false, error: 'Not enough energy' });
      return;
    }

    if (!isMaster && player.nerve < mission.nerve_cost) {
      res.status(400).json({ success: false, error: 'Not enough nerve' });
      return;
    }

    // Calculate success chance based on level and boss difficulty
    // Base 50% + 5% per level above boss difficulty * 10
    const bossLevel = (mission.boss_difficulty || 1) * 2;
    let successChance = 50 + (player.level - bossLevel) * 5;
    successChance = Math.max(20, Math.min(90, successChance));

    // Master always wins
    const success = isMaster ? true : Math.random() * 100 < successChance;

    // Deduct energy/nerve (master bypass)
    if (!isMaster) {
      await pool.query(
        `UPDATE players SET energy = energy - $1, nerve = nerve - $2 WHERE id = $3`,
        [mission.energy_cost, mission.nerve_cost, playerId]
      );
    }

    if (success) {
      // Boss defeated - complete mission
      await pool.query(
        `UPDATE players SET cash = cash + $1, xp = xp + $2 WHERE id = $3`,
        [mission.reward_cash, mission.reward_xp, playerId]
      );

      // Check for next mission
      const nextMissionResult = await pool.query(
        `SELECT * FROM story_missions WHERE chapter_id = $1 AND mission_order = $2`,
        [mission.chapter_id, mission.mission_order + 1]
      );

      let nextMission = null;
      let chapterComplete = false;

      if (nextMissionResult.rows.length > 0) {
        await pool.query(
          `UPDATE player_story_progress
           SET current_mission = $1, mission_progress = 0
           WHERE player_id = $2 AND chapter_id = $3`,
          [mission.mission_order + 1, playerId, mission.chapter_id]
        );
        nextMission = nextMissionResult.rows[0];
      } else {
        // Chapter complete
        await pool.query(
          `UPDATE player_story_progress SET completed_at = NOW() WHERE player_id = $1 AND chapter_id = $2`,
          [playerId, mission.chapter_id]
        );

        // Award chapter rewards
        const chapterResult = await pool.query(
          `SELECT * FROM story_chapters WHERE id = $1`,
          [mission.chapter_id]
        );
        const chapter = chapterResult.rows[0];

        await pool.query(
          `UPDATE players SET cash = cash + $1, xp = xp + $2, street_cred = street_cred + $3 WHERE id = $4`,
          [chapter.reward_cash, chapter.reward_xp, chapter.reward_cred, playerId]
        );

        chapterComplete = true;
      }

      res.json({
        success: true,
        data: {
          victory: true,
          bossName: mission.boss_name,
          message: `You defeated ${mission.boss_name}!`,
          rewardCash: mission.reward_cash,
          rewardXp: mission.reward_xp,
          nextMission: nextMission ? {
            title: nextMission.title,
            description: nextMission.description,
            dialogue: nextMission.dialogue
          } : null,
          chapterComplete
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          victory: false,
          bossName: mission.boss_name,
          message: `${mission.boss_name} was too strong. Train more and try again.`
        }
      });
    }
  } catch (error) {
    console.error('Boss fight error:', error);
    res.status(500).json({ success: false, error: 'Failed to attempt boss fight' });
  }
});

export default router;
