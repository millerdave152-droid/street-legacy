import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/npcs/nearby - Get NPCs in player's current location
router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's current district
    const playerResult = await pool.query(
      `SELECT current_district FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const districtId = playerResult.rows[0].current_district;
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // Get NPCs in current district with relationship info
    const npcsResult = await pool.query(
      `SELECT n.id, n.name, n.type, n.district_id, n.trust_level_required,
              n.avatar_emoji, n.description, n.cut_percentage, n.schedule,
              p.name as poi_name, p.type as poi_type,
              COALESCE(nr.trust, 0) as player_trust,
              COALESCE(nr.missions_completed, 0) as missions_completed
       FROM npcs n
       LEFT JOIN points_of_interest p ON n.poi_id = p.id
       LEFT JOIN npc_relationships nr ON nr.npc_id = n.id AND nr.player_id = $1
       WHERE n.district_id = $2
       ORDER BY n.trust_level_required ASC`,
      [playerId, districtId]
    );

    // Filter by schedule and trust level
    const availableNpcs = npcsResult.rows.filter(npc => {
      const schedule = npc.schedule || { days: [0,1,2,3,4,5,6], hours_start: 0, hours_end: 24 };
      const isAvailableDay = schedule.days.includes(currentDay);
      const isAvailableHour = currentHour >= schedule.hours_start && currentHour < schedule.hours_end;
      return isAvailableDay && isAvailableHour;
    });

    // Get POIs in the district
    const poisResult = await pool.query(
      `SELECT id, name, type, description FROM points_of_interest WHERE district_id = $1`,
      [districtId]
    );

    res.json({
      success: true,
      data: {
        districtId,
        npcs: availableNpcs.map(npc => ({
          id: npc.id,
          name: npc.name,
          type: npc.type,
          avatarEmoji: npc.avatar_emoji,
          description: npc.description,
          cutPercentage: npc.cut_percentage,
          trustRequired: npc.trust_level_required,
          playerTrust: npc.player_trust,
          missionsCompleted: npc.missions_completed,
          isUnlocked: npc.player_trust >= npc.trust_level_required,
          location: npc.poi_name ? { name: npc.poi_name, type: npc.poi_type } : null
        })),
        pointsOfInterest: poisResult.rows.map(poi => ({
          id: poi.id,
          name: poi.name,
          type: poi.type,
          description: poi.description
        }))
      }
    });
  } catch (error) {
    console.error('Get nearby NPCs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get nearby NPCs' });
  }
});

// GET /api/npcs/:id - Get specific NPC details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const npcId = parseInt(req.params.id);

    if (isNaN(npcId)) {
      res.status(400).json({ success: false, error: 'Invalid NPC ID' });
      return;
    }

    // Get NPC with relationship info
    const npcResult = await pool.query(
      `SELECT n.*,
              p.name as poi_name, p.type as poi_type,
              d.name as district_name,
              COALESCE(nr.trust, 0) as player_trust,
              COALESCE(nr.missions_completed, 0) as missions_completed,
              COALESCE(nr.missions_failed, 0) as missions_failed,
              nr.last_interaction
       FROM npcs n
       LEFT JOIN points_of_interest p ON n.poi_id = p.id
       LEFT JOIN districts d ON n.district_id = d.id
       LEFT JOIN npc_relationships nr ON nr.npc_id = n.id AND nr.player_id = $1
       WHERE n.id = $2`,
      [playerId, npcId]
    );

    if (npcResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'NPC not found' });
      return;
    }

    const npc = npcResult.rows[0];
    const isUnlocked = npc.player_trust >= npc.trust_level_required;

    // Get available missions from this NPC
    let missions: any[] = [];
    if (isUnlocked && (npc.type === 'fixer')) {
      const missionsResult = await pool.query(
        `SELECT nm.*,
                (SELECT COUNT(*) FROM player_encounters pe
                 WHERE pe.player_id = $1
                 AND pe.encounter_id = nm.id
                 AND pe.occurred_at > NOW() - INTERVAL '1 hour' * nm.cooldown_hours) as on_cooldown
         FROM npc_missions nm
         WHERE nm.npc_id = $2 AND nm.min_trust <= $3
         ORDER BY nm.min_level ASC`,
        [playerId, npcId, npc.player_trust]
      );

      // Get player level
      const playerResult = await pool.query(
        `SELECT level FROM players WHERE id = $1`,
        [playerId]
      );
      const playerLevel = playerResult.rows[0]?.level || 1;

      missions = missionsResult.rows
        .filter(m => m.min_level <= playerLevel)
        .map(m => ({
          id: m.id,
          title: m.title,
          description: m.description,
          missionType: m.mission_type,
          minLevel: m.min_level,
          minTrust: m.min_trust,
          staminaCost: m.stamina_cost,
          focusCost: m.focus_cost,
          timeMinutes: m.time_minutes,
          baseSuccessRate: m.base_success_rate,
          baseCashReward: m.base_cash_reward,
          baseXpReward: m.base_xp_reward,
          trustReward: m.trust_reward,
          heatGenerated: m.heat_generated,
          isRepeatable: m.is_repeatable,
          onCooldown: m.on_cooldown > 0
        }));
    }

    // Determine which dialogue to show
    const dialogue = npc.dialogue || {};
    let currentDialogue = dialogue.greeting || 'Hello.';
    if (!isUnlocked) {
      currentDialogue = dialogue.locked || `You need ${npc.trust_level_required} trust to talk to me.`;
    } else if (npc.player_trust >= 75) {
      currentDialogue = dialogue.high_trust || dialogue.greeting || 'Good to see you, friend.';
    } else if (npc.player_trust >= 25) {
      currentDialogue = dialogue.greeting || 'What can I do for you?';
    } else {
      currentDialogue = dialogue.low_trust || dialogue.greeting || 'What do you want?';
    }

    res.json({
      success: true,
      data: {
        npc: {
          id: npc.id,
          name: npc.name,
          type: npc.type,
          avatarEmoji: npc.avatar_emoji,
          description: npc.description,
          cutPercentage: npc.cut_percentage,
          trustRequired: npc.trust_level_required,
          district: npc.district_name,
          location: npc.poi_name ? { name: npc.poi_name, type: npc.poi_type } : null
        },
        relationship: {
          trust: npc.player_trust,
          missionsCompleted: npc.missions_completed,
          missionsFailed: npc.missions_failed,
          lastInteraction: npc.last_interaction,
          isUnlocked
        },
        dialogue: currentDialogue,
        missions
      }
    });
  } catch (error) {
    console.error('Get NPC error:', error);
    res.status(500).json({ success: false, error: 'Failed to get NPC details' });
  }
});

// GET /api/npcs/:id/dialogue - Start conversation with NPC
router.get('/:id/dialogue', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const npcId = parseInt(req.params.id);

    if (isNaN(npcId)) {
      res.status(400).json({ success: false, error: 'Invalid NPC ID' });
      return;
    }

    // Get NPC with relationship
    const npcResult = await pool.query(
      `SELECT n.*, COALESCE(nr.trust, 0) as player_trust
       FROM npcs n
       LEFT JOIN npc_relationships nr ON nr.npc_id = n.id AND nr.player_id = $1
       WHERE n.id = $2`,
      [playerId, npcId]
    );

    if (npcResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'NPC not found' });
      return;
    }

    const npc = npcResult.rows[0];
    const isUnlocked = npc.player_trust >= npc.trust_level_required;
    const dialogue = npc.dialogue || {};

    // Update last interaction
    await pool.query(
      `INSERT INTO npc_relationships (player_id, npc_id, trust, last_interaction)
       VALUES ($1, $2, 0, NOW())
       ON CONFLICT (player_id, npc_id)
       DO UPDATE SET last_interaction = NOW()`,
      [playerId, npcId]
    );

    // Determine dialogue based on trust level
    let response: { text: string; options: string[] };

    if (!isUnlocked) {
      response = {
        text: dialogue.locked || `I don't deal with strangers. Come back when you've proven yourself. (Need ${npc.trust_level_required} trust)`,
        options: ['Leave']
      };
    } else {
      const trustLevel = npc.player_trust;
      let text = dialogue.greeting || 'What can I do for you?';

      if (trustLevel >= 75) {
        text = dialogue.high_trust || 'My best customer! What do you need?';
      } else if (trustLevel < 25) {
        text = dialogue.low_trust || 'What do you want?';
      }

      // Options based on NPC type
      const options: string[] = [];
      switch (npc.type) {
        case 'fixer':
          options.push('I need work', 'What jobs do you have?', 'Just passing through');
          break;
        case 'fence':
          options.push('I have goods to sell', 'What are your rates?', 'Just browsing');
          break;
        case 'informant':
          options.push('I need information', 'What do you know?', 'Maybe later');
          break;
        case 'supplier':
          options.push('Show me what you got', 'I need equipment', 'Just looking');
          break;
        case 'lawyer':
          options.push('I need legal help', 'Can you reduce my heat?', 'No problems today');
          break;
        case 'doctor':
          options.push('I need patching up', 'Full treatment', 'Just a check-up');
          break;
      }

      response = { text, options };
    }

    res.json({
      success: true,
      data: {
        npcName: npc.name,
        npcType: npc.type,
        avatarEmoji: npc.avatar_emoji,
        isUnlocked,
        trust: npc.player_trust,
        ...response
      }
    });
  } catch (error) {
    console.error('NPC dialogue error:', error);
    res.status(500).json({ success: false, error: 'Failed to start dialogue' });
  }
});

// POST /api/npcs/:id/mission/accept - Accept a mission from an NPC
router.post('/:id/mission/accept', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const npcId = parseInt(req.params.id);
    const { missionId } = req.body;

    if (isNaN(npcId) || !missionId) {
      res.status(400).json({ success: false, error: 'Invalid NPC ID or mission ID' });
      return;
    }

    // Get player data
    const playerResult = await pool.query(
      `SELECT level, stamina, focus, heat_level, current_district, in_jail
       FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    if (player.in_jail) {
      res.status(400).json({ success: false, error: 'Cannot accept missions while in jail' });
      return;
    }

    // Get NPC and mission
    const missionResult = await pool.query(
      `SELECT nm.*, n.name as npc_name, n.cut_percentage, n.district_id,
              COALESCE(nr.trust, 0) as player_trust
       FROM npc_missions nm
       JOIN npcs n ON nm.npc_id = n.id
       LEFT JOIN npc_relationships nr ON nr.npc_id = n.id AND nr.player_id = $1
       WHERE nm.id = $2 AND nm.npc_id = $3`,
      [playerId, missionId, npcId]
    );

    if (missionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Mission not found' });
      return;
    }

    const mission = missionResult.rows[0];

    // Check requirements
    if (player.level < mission.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${mission.min_level}` });
      return;
    }

    if (mission.player_trust < mission.min_trust) {
      res.status(400).json({ success: false, error: `Requires ${mission.min_trust} trust with ${mission.npc_name}` });
      return;
    }

    if (player.stamina < mission.stamina_cost) {
      res.status(400).json({ success: false, error: 'Not enough stamina' });
      return;
    }

    if (player.focus < mission.focus_cost) {
      res.status(400).json({ success: false, error: 'Not enough focus' });
      return;
    }

    // Check if player is in the right district
    if (mission.required_district_id && player.current_district !== mission.required_district_id) {
      res.status(400).json({ success: false, error: 'Must be in the required district' });
      return;
    }

    // Check cooldown
    const cooldownResult = await pool.query(
      `SELECT occurred_at FROM player_encounters
       WHERE player_id = $1 AND encounter_id = $2
       ORDER BY occurred_at DESC LIMIT 1`,
      [playerId, missionId]
    );

    if (cooldownResult.rows.length > 0 && mission.cooldown_hours > 0) {
      const lastAttempt = new Date(cooldownResult.rows[0].occurred_at);
      const cooldownEnd = new Date(lastAttempt.getTime() + mission.cooldown_hours * 60 * 60 * 1000);
      if (new Date() < cooldownEnd) {
        res.status(400).json({
          success: false,
          error: 'Mission on cooldown',
          cooldownEnds: cooldownEnd.toISOString()
        });
        return;
      }
    }

    // Calculate success rate with modifiers
    let successRate = mission.base_success_rate;

    // Trust bonus: up to +15% at 100 trust
    successRate += Math.floor(mission.player_trust * 0.15);

    // Level bonus: +2% per level above min
    const levelBonus = (player.level - mission.min_level) * 2;
    successRate += Math.min(levelBonus, 20);

    // Cap success rate
    successRate = Math.min(Math.max(successRate, 5), 95);

    // Roll for success
    const roll = Math.random() * 100;
    const success = roll < successRate;

    // Deduct costs
    await pool.query(
      `UPDATE players SET stamina = stamina - $1, focus = focus - $2 WHERE id = $3`,
      [mission.stamina_cost, mission.focus_cost, playerId]
    );

    let cashReward = 0;
    let xpReward = 0;
    let trustChange = 0;
    let heatChange = 0;
    let jailMinutes = 0;

    if (success) {
      // Calculate rewards with scaling
      const difficultyMultiplier = 1 + (mission.player_trust / 200); // Up to 1.5x at max trust
      cashReward = Math.floor(mission.base_cash_reward * difficultyMultiplier);
      xpReward = Math.floor(mission.base_xp_reward * difficultyMultiplier);
      trustChange = mission.trust_reward;
      heatChange = mission.heat_generated;

      // NPC takes their cut
      const npcCut = Math.floor(cashReward * (mission.cut_percentage / 100));
      cashReward -= npcCut;

      // Award rewards
      await pool.query(
        `UPDATE players
         SET cash = cash + $1, xp = xp + $2, heat_level = LEAST(100, heat_level + $3)
         WHERE id = $4`,
        [cashReward, xpReward, heatChange, playerId]
      );

      // Update relationship
      await pool.query(
        `INSERT INTO npc_relationships (player_id, npc_id, trust, missions_completed, last_interaction)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (player_id, npc_id)
         DO UPDATE SET trust = LEAST(100, npc_relationships.trust + $3),
                       missions_completed = npc_relationships.missions_completed + 1,
                       last_interaction = NOW()`,
        [playerId, npcId, trustChange]
      );
    } else {
      // Failure
      trustChange = -mission.trust_penalty;
      jailMinutes = mission.jail_minutes;

      // Update relationship
      await pool.query(
        `INSERT INTO npc_relationships (player_id, npc_id, trust, missions_failed, last_interaction)
         VALUES ($1, $2, 0, 1, NOW())
         ON CONFLICT (player_id, npc_id)
         DO UPDATE SET trust = GREATEST(0, npc_relationships.trust + $3),
                       missions_failed = npc_relationships.missions_failed + 1,
                       last_interaction = NOW()`,
        [playerId, npcId, trustChange]
      );

      // Chance to go to jail on failure (50% for failed missions)
      if (Math.random() < 0.5 && jailMinutes > 0) {
        const releaseTime = new Date(Date.now() + jailMinutes * 60 * 1000);
        await pool.query(
          `UPDATE players SET in_jail = true, jail_release_at = $1 WHERE id = $2`,
          [releaseTime, playerId]
        );
      } else {
        jailMinutes = 0;
      }
    }

    // Log the encounter
    await pool.query(
      `INSERT INTO player_encounters (player_id, encounter_id, choice_made, outcome, rewards_gained)
       VALUES ($1, $2, 'accept', $3, $4)`,
      [playerId, missionId, success ? 'success' : 'failure',
       JSON.stringify({ cash: cashReward, xp: xpReward, trust: trustChange })]
    );

    // Get NPC's response
    const dialogueResult = await pool.query(
      `SELECT dialogue FROM npcs WHERE id = $1`,
      [npcId]
    );
    const npcDialogue = dialogueResult.rows[0]?.dialogue || {};

    res.json({
      success: true,
      data: {
        missionSuccess: success,
        successRate,
        roll: Math.floor(roll),
        rewards: success ? {
          cash: cashReward,
          xp: xpReward,
          trust: trustChange,
          heat: heatChange
        } : null,
        penalties: !success ? {
          trust: trustChange,
          jailMinutes
        } : null,
        dialogue: success
          ? (mission.dialogue_success || npcDialogue.mission_success || 'Good work.')
          : (mission.dialogue_failure || npcDialogue.mission_failure || 'You failed me.'),
        inJail: jailMinutes > 0
      }
    });
  } catch (error) {
    console.error('Accept mission error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept mission' });
  }
});

// POST /api/npcs/:id/gift - Give a gift to improve trust
router.post('/:id/gift', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const npcId = parseInt(req.params.id);
    const { amount } = req.body;

    if (isNaN(npcId)) {
      res.status(400).json({ success: false, error: 'Invalid NPC ID' });
      return;
    }

    const giftAmount = parseInt(amount);
    if (isNaN(giftAmount) || giftAmount < 100) {
      res.status(400).json({ success: false, error: 'Gift must be at least $100' });
      return;
    }

    // Check player has enough cash
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0 || playerResult.rows[0].cash < giftAmount) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Calculate trust gain (diminishing returns)
    // $100 = 1 trust, $500 = 3 trust, $1000 = 5 trust, $5000 = 10 trust
    const trustGain = Math.floor(Math.sqrt(giftAmount / 100) * 2);
    const cappedTrustGain = Math.min(trustGain, 15); // Max 15 trust per gift

    // Deduct cash
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [giftAmount, playerId]
    );

    // Update relationship
    await pool.query(
      `INSERT INTO npc_relationships (player_id, npc_id, trust, gifts_given, last_interaction)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (player_id, npc_id)
       DO UPDATE SET trust = LEAST(100, npc_relationships.trust + $3),
                     gifts_given = npc_relationships.gifts_given + $4,
                     last_interaction = NOW()`,
      [playerId, npcId, cappedTrustGain, giftAmount]
    );

    res.json({
      success: true,
      data: {
        message: 'Gift accepted',
        cashSpent: giftAmount,
        trustGained: cappedTrustGain
      }
    });
  } catch (error) {
    console.error('Gift NPC error:', error);
    res.status(500).json({ success: false, error: 'Failed to give gift' });
  }
});

// GET /api/npcs/all - Get all NPCs across all districts (for map/overview)
router.get('/all/list', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const npcsResult = await pool.query(
      `SELECT n.id, n.name, n.type, n.district_id, n.trust_level_required,
              n.avatar_emoji, n.description,
              d.name as district_name,
              COALESCE(nr.trust, 0) as player_trust
       FROM npcs n
       LEFT JOIN districts d ON n.district_id = d.id
       LEFT JOIN npc_relationships nr ON nr.npc_id = n.id AND nr.player_id = $1
       ORDER BY d.name, n.trust_level_required`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        npcs: npcsResult.rows.map(npc => ({
          id: npc.id,
          name: npc.name,
          type: npc.type,
          districtId: npc.district_id,
          districtName: npc.district_name,
          avatarEmoji: npc.avatar_emoji,
          description: npc.description,
          trustRequired: npc.trust_level_required,
          playerTrust: npc.player_trust,
          isUnlocked: npc.player_trust >= npc.trust_level_required
        }))
      }
    });
  } catch (error) {
    console.error('Get all NPCs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get NPCs' });
  }
});

export default router;
