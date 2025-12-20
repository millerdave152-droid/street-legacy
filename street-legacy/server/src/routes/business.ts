import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/business - Get available operations and player's active ones
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info
    const playerResult = await pool.query(
      `SELECT level, cash, heat_level FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all business operations
    const operationsResult = await pool.query(
      `SELECT * FROM business_operations ORDER BY min_level, setup_cost`
    );

    // Get player's properties (needed for some operations)
    const propertiesResult = await pool.query(
      `SELECT pp.*, p.name, p.property_type
       FROM player_properties pp
       JOIN properties p ON pp.property_id = p.id
       WHERE pp.player_id = $1`,
      [playerId]
    );

    // Get player's active operations
    const activeResult = await pool.query(
      `SELECT po.*, bo.name, bo.description, bo.type, bo.daily_revenue, bo.daily_expense,
              bo.heat_generated, p.name as property_name
       FROM player_operations po
       JOIN business_operations bo ON po.operation_id = bo.id
       LEFT JOIN player_properties pp ON po.property_id = pp.id
       LEFT JOIN properties p ON pp.property_id = p.id
       WHERE po.player_id = $1 AND po.status = 'active'`,
      [playerId]
    );

    // Calculate totals
    let totalDailyRevenue = 0;
    let totalDailyExpense = 0;
    let totalHeat = 0;

    const activeOperations = activeResult.rows.map(op => {
      totalDailyRevenue += op.daily_revenue;
      totalDailyExpense += op.daily_expense;
      totalHeat += op.heat_generated;

      // Calculate uncollected revenue
      const hoursSinceCollect = (Date.now() - new Date(op.last_collected_at).getTime()) / (1000 * 60 * 60);
      const uncollectedRevenue = Math.floor((op.daily_revenue / 24) * hoursSinceCollect);
      const uncollectedExpense = Math.floor((op.daily_expense / 24) * hoursSinceCollect);

      return {
        id: op.id,
        operationId: op.operation_id,
        name: op.name,
        description: op.description,
        type: op.type,
        dailyRevenue: op.daily_revenue,
        dailyExpense: op.daily_expense,
        heatGenerated: op.heat_generated,
        heatLevel: op.heat_level,
        propertyName: op.property_name,
        status: op.status,
        lastCollectedAt: op.last_collected_at,
        startedAt: op.started_at,
        uncollectedRevenue,
        uncollectedExpense,
        netUncollected: uncollectedRevenue - uncollectedExpense
      };
    });

    // Build available operations with unlock status
    const availableOperations = operationsResult.rows.map(op => {
      const meetsLevel = player.level >= op.min_level;
      const canAfford = player.cash >= op.setup_cost;
      const alreadyOwns = activeResult.rows.some(a => a.operation_id === op.id);

      // Check property requirement
      let hasProperty = true;
      let suitableProperty = null;
      if (op.required_property_type) {
        const matching = propertiesResult.rows.find(p => p.property_type === op.required_property_type);
        hasProperty = !!matching;
        suitableProperty = matching || null;
      }

      return {
        id: op.id,
        name: op.name,
        description: op.description,
        type: op.type,
        setupCost: op.setup_cost,
        dailyRevenue: op.daily_revenue,
        dailyExpense: op.daily_expense,
        netDaily: op.daily_revenue - op.daily_expense,
        heatGenerated: op.heat_generated,
        minLevel: op.min_level,
        requiredPropertyType: op.required_property_type,
        meetsLevel,
        canAfford,
        hasProperty,
        alreadyOwns,
        canPurchase: meetsLevel && canAfford && hasProperty && !alreadyOwns,
        suitablePropertyId: suitableProperty?.id
      };
    });

    res.json({
      success: true,
      data: {
        playerHeat: player.heat_level,
        activeOperations,
        availableOperations,
        properties: propertiesResult.rows.map(p => ({
          id: p.id,
          propertyId: p.property_id,
          name: p.name,
          type: p.property_type
        })),
        summary: {
          totalOperations: activeOperations.length,
          totalDailyRevenue,
          totalDailyExpense,
          netDailyProfit: totalDailyRevenue - totalDailyExpense,
          totalHeatGeneration: totalHeat
        }
      }
    });
  } catch (error) {
    console.error('Business error:', error);
    res.status(500).json({ success: false, error: 'Failed to load business operations' });
  }
});

// POST /api/business/start - Start a new operation
router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { operationId, propertyId } = req.body;

    if (!operationId) {
      res.status(400).json({ success: false, error: 'Operation ID required' });
      return;
    }

    // Get operation details
    const operationResult = await pool.query(
      `SELECT * FROM business_operations WHERE id = $1`,
      [operationId]
    );

    if (operationResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Operation not found' });
      return;
    }

    const operation = operationResult.rows[0];

    // Check player eligibility
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.level < operation.min_level) {
      res.status(400).json({
        success: false,
        error: `You need to be level ${operation.min_level} to start this operation`
      });
      return;
    }

    if (player.cash < operation.setup_cost) {
      res.status(400).json({
        success: false,
        error: `Insufficient funds. Need $${operation.setup_cost.toLocaleString()}`
      });
      return;
    }

    // Check if already owns this operation
    const existingResult = await pool.query(
      `SELECT id FROM player_operations WHERE player_id = $1 AND operation_id = $2 AND status = 'active'`,
      [playerId, operationId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'You already run this operation' });
      return;
    }

    // Check property requirement
    let linkedPropertyId = null;
    if (operation.required_property_type) {
      const propResult = await pool.query(
        `SELECT pp.id FROM player_properties pp
         JOIN properties p ON pp.property_id = p.id
         WHERE pp.player_id = $1 AND p.property_type = $2
         LIMIT 1`,
        [playerId, operation.required_property_type]
      );

      if (propResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          error: `This operation requires a ${operation.required_property_type} property`
        });
        return;
      }

      linkedPropertyId = propResult.rows[0].id;
    }

    // Deduct setup cost
    await pool.query(
      `UPDATE players SET cash = cash - $2 WHERE id = $1`,
      [playerId, operation.setup_cost]
    );

    // Create operation
    await pool.query(
      `INSERT INTO player_operations (player_id, operation_id, property_id, status, heat_level)
       VALUES ($1, $2, $3, 'active', 0)`,
      [playerId, operationId, linkedPropertyId]
    );

    res.json({
      success: true,
      data: {
        message: `Started ${operation.name}!`,
        operation: {
          name: operation.name,
          dailyRevenue: operation.daily_revenue,
          dailyExpense: operation.daily_expense,
          netDaily: operation.daily_revenue - operation.daily_expense
        },
        setupCost: operation.setup_cost
      }
    });
  } catch (error) {
    console.error('Start operation error:', error);
    res.status(500).json({ success: false, error: 'Failed to start operation' });
  }
});

// POST /api/business/collect - Collect revenue from an operation
router.post('/collect', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { playerOperationId } = req.body;

    if (!playerOperationId) {
      res.status(400).json({ success: false, error: 'Operation ID required' });
      return;
    }

    // Get operation
    const opResult = await pool.query(
      `SELECT po.*, bo.name, bo.daily_revenue, bo.daily_expense, bo.heat_generated
       FROM player_operations po
       JOIN business_operations bo ON po.operation_id = bo.id
       WHERE po.id = $1 AND po.player_id = $2 AND po.status = 'active'`,
      [playerOperationId, playerId]
    );

    if (opResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Operation not found' });
      return;
    }

    const operation = opResult.rows[0];

    // Calculate earnings since last collection
    const hoursSinceCollect = (Date.now() - new Date(operation.last_collected_at).getTime()) / (1000 * 60 * 60);

    if (hoursSinceCollect < 1) {
      res.status(400).json({
        success: false,
        error: 'You can only collect once per hour. Wait a bit longer.'
      });
      return;
    }

    const revenue = Math.floor((operation.daily_revenue / 24) * hoursSinceCollect);
    const expense = Math.floor((operation.daily_expense / 24) * hoursSinceCollect);
    const netProfit = revenue - expense;
    const heatGained = Math.floor((operation.heat_generated / 24) * hoursSinceCollect);

    // Update player cash and heat
    await pool.query(
      `UPDATE players SET cash = cash + $2, heat_level = LEAST(100, heat_level + $3) WHERE id = $1`,
      [playerId, netProfit, heatGained]
    );

    // Update operation's last collected and heat
    await pool.query(
      `UPDATE player_operations SET last_collected_at = NOW(), heat_level = LEAST(100, heat_level + $3) WHERE id = $1`,
      [playerOperationId, heatGained]
    );

    res.json({
      success: true,
      data: {
        message: `Collected $${netProfit.toLocaleString()} from ${operation.name}`,
        revenue,
        expense,
        netProfit,
        heatGained,
        hoursCollected: Math.floor(hoursSinceCollect)
      }
    });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect revenue' });
  }
});

// POST /api/business/collectall - Collect from all operations
router.post('/collectall', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get all active operations
    const opsResult = await pool.query(
      `SELECT po.*, bo.name, bo.daily_revenue, bo.daily_expense, bo.heat_generated
       FROM player_operations po
       JOIN business_operations bo ON po.operation_id = bo.id
       WHERE po.player_id = $1 AND po.status = 'active'`,
      [playerId]
    );

    let totalRevenue = 0;
    let totalExpense = 0;
    let totalHeat = 0;
    let operationsCollected = 0;

    for (const operation of opsResult.rows) {
      const hoursSinceCollect = (Date.now() - new Date(operation.last_collected_at).getTime()) / (1000 * 60 * 60);

      if (hoursSinceCollect >= 1) {
        const revenue = Math.floor((operation.daily_revenue / 24) * hoursSinceCollect);
        const expense = Math.floor((operation.daily_expense / 24) * hoursSinceCollect);
        const heatGained = Math.floor((operation.heat_generated / 24) * hoursSinceCollect);

        totalRevenue += revenue;
        totalExpense += expense;
        totalHeat += heatGained;
        operationsCollected++;

        await pool.query(
          `UPDATE player_operations SET last_collected_at = NOW(), heat_level = LEAST(100, heat_level + $2) WHERE id = $1`,
          [operation.id, heatGained]
        );
      }
    }

    const netProfit = totalRevenue - totalExpense;

    if (operationsCollected === 0) {
      res.status(400).json({
        success: false,
        error: 'No operations ready to collect. Wait at least an hour.'
      });
      return;
    }

    // Update player
    await pool.query(
      `UPDATE players SET cash = cash + $2, heat_level = LEAST(100, heat_level + $3) WHERE id = $1`,
      [playerId, netProfit, totalHeat]
    );

    res.json({
      success: true,
      data: {
        message: `Collected from ${operationsCollected} operations!`,
        operationsCollected,
        totalRevenue,
        totalExpense,
        netProfit,
        totalHeat
      }
    });
  } catch (error) {
    console.error('Collect all error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect revenue' });
  }
});

// POST /api/business/shutdown - Shut down an operation
router.post('/shutdown', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { playerOperationId } = req.body;

    if (!playerOperationId) {
      res.status(400).json({ success: false, error: 'Operation ID required' });
      return;
    }

    // Get operation
    const opResult = await pool.query(
      `SELECT po.*, bo.name, bo.setup_cost
       FROM player_operations po
       JOIN business_operations bo ON po.operation_id = bo.id
       WHERE po.id = $1 AND po.player_id = $2 AND po.status = 'active'`,
      [playerOperationId, playerId]
    );

    if (opResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Operation not found' });
      return;
    }

    const operation = opResult.rows[0];

    // Refund 25% of setup cost
    const refund = Math.floor(operation.setup_cost * 0.25);

    await pool.query(
      `UPDATE players SET cash = cash + $2 WHERE id = $1`,
      [playerId, refund]
    );

    await pool.query(
      `UPDATE player_operations SET status = 'shutdown' WHERE id = $1`,
      [playerOperationId]
    );

    res.json({
      success: true,
      data: {
        message: `Shut down ${operation.name}. Recovered $${refund.toLocaleString()} in assets.`,
        refund
      }
    });
  } catch (error) {
    console.error('Shutdown error:', error);
    res.status(500).json({ success: false, error: 'Failed to shutdown operation' });
  }
});

// POST /api/business/launder - Reduce heat by laundering money
router.post('/launder', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      res.status(400).json({ success: false, error: 'Minimum laundering amount is $1,000' });
      return;
    }

    // Get player
    const playerResult = await pool.query(
      `SELECT cash, heat_level FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.cash < amount) {
      res.status(400).json({ success: false, error: 'Insufficient cash' });
      return;
    }

    // Laundering costs 15% and reduces heat by $1000 = 1 heat
    const cost = Math.floor(amount * 0.15);
    const netAmount = amount - cost;
    const heatReduced = Math.floor(amount / 1000);

    await pool.query(
      `UPDATE players SET cash = cash - $2, heat_level = GREATEST(0, heat_level - $3) WHERE id = $1`,
      [playerId, cost, heatReduced]
    );

    res.json({
      success: true,
      data: {
        message: `Laundered $${amount.toLocaleString()}. Heat reduced by ${heatReduced}.`,
        amountLaundered: amount,
        fee: cost,
        heatReduced,
        newHeat: Math.max(0, player.heat_level - heatReduced)
      }
    });
  } catch (error) {
    console.error('Launder error:', error);
    res.status(500).json({ success: false, error: 'Failed to launder money' });
  }
});

export default router;
