import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/expansions - Get all expansion types and player's progress
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get all expansion types with player progress
    const expansionsResult = await pool.query(
      `SELECT ce.*,
              COALESCE(pe.missions_completed, 0) as missions_completed,
              COALESCE(pe.tokens_purchased, 0) as tokens_purchased,
              COALESCE(pe.total_expansion, 0) as total_expansion
       FROM capacity_expansions ce
       LEFT JOIN player_expansions pe ON pe.expansion_id = ce.id AND pe.player_id = $1
       ORDER BY ce.expansion_type`,
      [playerId]
    );

    // Get player's current caps
    const playerResult = await pool.query(
      `SELECT stamina_max, focus_max, influence FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    const expansions = expansionsResult.rows.map(e => {
      const missionsRemaining = e.mission_chain_stages - e.missions_completed;
      const purchasesRemaining = e.max_purchases - e.tokens_purchased;
      const expansionRemaining = e.max_total_expansion - e.total_expansion;

      // Calculate what the current cap should be based on base + expansions
      let currentCap = 100; // Default base
      switch (e.expansion_type) {
        case 'stamina_max':
          currentCap = player.stamina_max;
          break;
        case 'focus_max':
          currentCap = player.focus_max;
          break;
        case 'influence_max':
          currentCap = 100; // Base influence cap
          break;
      }

      return {
        id: e.id,
        name: e.name,
        description: e.description,
        expansionType: e.expansion_type,
        currentCap,

        // Gameplay path
        missionChain: {
          name: e.mission_chain_name,
          totalStages: e.mission_chain_stages,
          completedStages: e.missions_completed,
          remainingStages: missionsRemaining,
          expansionPerStage: e.expansion_per_stage,
          potentialExpansion: missionsRemaining * e.expansion_per_stage
        },

        // Purchase path
        tokenPurchase: {
          tokenCost: e.token_cost,
          maxPurchases: e.max_purchases,
          purchasesMade: e.tokens_purchased,
          purchasesRemaining,
          expansionPerPurchase: e.expansion_per_purchase,
          potentialExpansion: purchasesRemaining * e.expansion_per_purchase
        },

        // Progress
        totalExpansion: e.total_expansion,
        maxTotalExpansion: e.max_total_expansion,
        expansionRemaining,
        percentComplete: Math.round((e.total_expansion / e.max_total_expansion) * 100)
      };
    });

    res.json({
      success: true,
      data: {
        expansions,
        currentCaps: {
          staminaMax: player.stamina_max,
          focusMax: player.focus_max,
          influenceMax: 100 // Could be made dynamic
        }
      }
    });
  } catch (error) {
    console.error('Get expansions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get expansions' });
  }
});

// GET /api/expansions/:id/missions - Get mission chain for an expansion
router.get('/:id/missions', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const expansionId = parseInt(req.params.id);

    if (isNaN(expansionId)) {
      res.status(400).json({ success: false, error: 'Invalid expansion ID' });
      return;
    }

    // Get expansion details
    const expansionResult = await pool.query(
      `SELECT ce.*,
              COALESCE(pe.missions_completed, 0) as missions_completed
       FROM capacity_expansions ce
       LEFT JOIN player_expansions pe ON pe.expansion_id = ce.id AND pe.player_id = $1
       WHERE ce.id = $2`,
      [playerId, expansionId]
    );

    if (expansionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Expansion not found' });
      return;
    }

    const expansion = expansionResult.rows[0];
    const currentStage = expansion.missions_completed + 1;

    // Generate mission chain stages
    const missions = [];
    for (let stage = 1; stage <= expansion.mission_chain_stages; stage++) {
      const isCompleted = stage <= expansion.missions_completed;
      const isCurrent = stage === currentStage;

      // Generate mission requirements based on expansion type and stage
      let requirements: any = {};
      switch (expansion.expansion_type) {
        case 'stamina_max':
          requirements = {
            type: 'crimes',
            target: 10 + (stage * 5), // 15, 20, 25, 30, 35 crimes
            description: `Complete ${10 + (stage * 5)} successful crimes`
          };
          break;
        case 'focus_max':
          requirements = {
            type: 'strategic',
            target: 5 + (stage * 3), // 8, 11, 14, 17, 20 strategic actions
            description: `Complete ${5 + (stage * 3)} planning or investigation missions`
          };
          break;
        case 'influence_max':
          requirements = {
            type: 'social',
            target: 3 + (stage * 2), // 5, 7, 9, 11, 13 social interactions
            description: `Complete ${3 + (stage * 2)} NPC interactions at 50+ trust`
          };
          break;
        case 'inventory_slots':
          requirements = {
            type: 'collection',
            target: 5 + stage, // 6, 7, 8 items collected
            description: `Own ${5 + stage} different items simultaneously`
          };
          break;
      }

      missions.push({
        stage,
        name: `${expansion.mission_chain_name} - Stage ${stage}`,
        requirements,
        reward: {
          expansionAmount: expansion.expansion_per_stage,
          expansionType: expansion.expansion_type
        },
        status: isCompleted ? 'completed' : (isCurrent ? 'available' : 'locked'),
        isCompleted,
        isCurrent
      });
    }

    res.json({
      success: true,
      data: {
        expansion: {
          id: expansion.id,
          name: expansion.name,
          missionChainName: expansion.mission_chain_name,
          expansionType: expansion.expansion_type
        },
        missions,
        currentStage,
        totalStages: expansion.mission_chain_stages
      }
    });
  } catch (error) {
    console.error('Get expansion missions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get expansion missions' });
  }
});

// POST /api/expansions/:id/complete-stage - Complete current mission stage
router.post('/:id/complete-stage', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const expansionId = parseInt(req.params.id);

    if (isNaN(expansionId)) {
      res.status(400).json({ success: false, error: 'Invalid expansion ID' });
      return;
    }

    // Get expansion and player progress
    const expansionResult = await pool.query(
      `SELECT ce.*,
              COALESCE(pe.missions_completed, 0) as missions_completed,
              COALESCE(pe.total_expansion, 0) as total_expansion
       FROM capacity_expansions ce
       LEFT JOIN player_expansions pe ON pe.expansion_id = ce.id AND pe.player_id = $1
       WHERE ce.id = $2`,
      [playerId, expansionId]
    );

    if (expansionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Expansion not found' });
      return;
    }

    const expansion = expansionResult.rows[0];

    // Check if max stages reached
    if (expansion.missions_completed >= expansion.mission_chain_stages) {
      res.status(400).json({ success: false, error: 'All mission stages completed' });
      return;
    }

    // Check if max expansion reached
    if (expansion.total_expansion >= expansion.max_total_expansion) {
      res.status(400).json({ success: false, error: 'Maximum expansion reached' });
      return;
    }

    // In a real system, we would verify the player completed the requirements
    // For now, we'll trust the client (or implement tracking separately)

    const newMissionsCompleted = expansion.missions_completed + 1;
    const newTotalExpansion = expansion.total_expansion + expansion.expansion_per_stage;

    // Update player expansion progress
    await pool.query(
      `INSERT INTO player_expansions (player_id, expansion_id, missions_completed, total_expansion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, expansion_id)
       DO UPDATE SET missions_completed = $3, total_expansion = $4`,
      [playerId, expansionId, newMissionsCompleted, newTotalExpansion]
    );

    // Apply the expansion to the player
    let updateQuery = '';
    switch (expansion.expansion_type) {
      case 'stamina_max':
        updateQuery = `UPDATE players SET stamina_max = stamina_max + $1 WHERE id = $2`;
        break;
      case 'focus_max':
        updateQuery = `UPDATE players SET focus_max = focus_max + $1 WHERE id = $2`;
        break;
      case 'influence_max':
        // Would need an influence_max column
        break;
      case 'inventory_slots':
        // Would need an inventory_slots column
        break;
    }

    if (updateQuery) {
      await pool.query(updateQuery, [expansion.expansion_per_stage, playerId]);
    }

    res.json({
      success: true,
      data: {
        message: `${expansion.mission_chain_name} Stage ${newMissionsCompleted} completed!`,
        expansion: {
          type: expansion.expansion_type,
          amount: expansion.expansion_per_stage
        },
        progress: {
          stagesCompleted: newMissionsCompleted,
          totalStages: expansion.mission_chain_stages,
          totalExpansion: newTotalExpansion,
          maxExpansion: expansion.max_total_expansion
        }
      }
    });
  } catch (error) {
    console.error('Complete expansion stage error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete stage' });
  }
});

// POST /api/expansions/:id/purchase - Purchase expansion with tokens
router.post('/:id/purchase', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const expansionId = parseInt(req.params.id);

    if (isNaN(expansionId)) {
      res.status(400).json({ success: false, error: 'Invalid expansion ID' });
      return;
    }

    // Get player tokens
    const playerResult = await pool.query(
      `SELECT tokens FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Get expansion and player progress
    const expansionResult = await pool.query(
      `SELECT ce.*,
              COALESCE(pe.tokens_purchased, 0) as tokens_purchased,
              COALESCE(pe.total_expansion, 0) as total_expansion
       FROM capacity_expansions ce
       LEFT JOIN player_expansions pe ON pe.expansion_id = ce.id AND pe.player_id = $1
       WHERE ce.id = $2`,
      [playerId, expansionId]
    );

    if (expansionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Expansion not found' });
      return;
    }

    const expansion = expansionResult.rows[0];

    // Check if max purchases reached
    if (expansion.tokens_purchased >= expansion.max_purchases) {
      res.status(400).json({
        success: false,
        error: `Maximum token purchases reached (${expansion.max_purchases})`
      });
      return;
    }

    // Check if max expansion reached
    if (expansion.total_expansion >= expansion.max_total_expansion) {
      res.status(400).json({ success: false, error: 'Maximum expansion reached' });
      return;
    }

    // Check if player has enough tokens
    if (player.tokens < expansion.token_cost) {
      res.status(400).json({
        success: false,
        error: 'Not enough tokens',
        tokensNeeded: expansion.token_cost,
        tokensHave: player.tokens
      });
      return;
    }

    // Deduct tokens
    await pool.query(
      `UPDATE players SET tokens = tokens - $1 WHERE id = $2`,
      [expansion.token_cost, playerId]
    );

    const newTokensPurchased = expansion.tokens_purchased + 1;
    const newTotalExpansion = expansion.total_expansion + expansion.expansion_per_purchase;

    // Update player expansion progress
    await pool.query(
      `INSERT INTO player_expansions (player_id, expansion_id, tokens_purchased, total_expansion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, expansion_id)
       DO UPDATE SET tokens_purchased = $3,
                     total_expansion = player_expansions.total_expansion + $5`,
      [playerId, expansionId, newTokensPurchased, newTotalExpansion, expansion.expansion_per_purchase]
    );

    // Apply the expansion to the player
    let updateQuery = '';
    switch (expansion.expansion_type) {
      case 'stamina_max':
        updateQuery = `UPDATE players SET stamina_max = stamina_max + $1 WHERE id = $2`;
        break;
      case 'focus_max':
        updateQuery = `UPDATE players SET focus_max = focus_max + $1 WHERE id = $2`;
        break;
      case 'influence_max':
        // Would need an influence_max column
        break;
      case 'inventory_slots':
        // Would need an inventory_slots column
        break;
    }

    if (updateQuery) {
      await pool.query(updateQuery, [expansion.expansion_per_purchase, playerId]);
    }

    // Log the token spend
    await pool.query(
      `INSERT INTO token_spend_log (player_id, tokens_spent, spend_type, description)
       VALUES ($1, $2, 'expansion', $3)`,
      [playerId, expansion.token_cost, `Purchased ${expansion.expansion_per_purchase} ${expansion.expansion_type}`]
    );

    res.json({
      success: true,
      data: {
        message: `${expansion.name} expansion purchased!`,
        tokensSpent: expansion.token_cost,
        expansion: {
          type: expansion.expansion_type,
          amount: expansion.expansion_per_purchase
        },
        progress: {
          purchasesMade: newTokensPurchased,
          maxPurchases: expansion.max_purchases,
          purchasesRemaining: expansion.max_purchases - newTokensPurchased,
          totalExpansion: newTotalExpansion,
          maxExpansion: expansion.max_total_expansion
        }
      }
    });
  } catch (error) {
    console.error('Purchase expansion error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase expansion' });
  }
});

export default router;
