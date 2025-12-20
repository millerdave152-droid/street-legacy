import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Operation type definition
interface OperationConfig {
  name: string;
  description: string;
  requiredCapability?: string;
  requiredType?: string | string[];
  requiredUpgrade?: string;
  baseIncomeMultiplier?: number;
  baseIncomePerHour?: number[];
  baseHeatPerHour: number[];
  baseFeePercent?: number[];
  processingHours?: number[];
}

// Operation configurations
const OPERATIONS: Record<string, OperationConfig> = {
  money_laundering: {
    name: 'Money Laundering',
    description: 'Clean dirty money through the business',
    requiredCapability: 'can_launder_money',
    baseIncomeMultiplier: 0, // Doesn't generate income, processes money
    baseHeatPerHour: [2, 4, 6, 8, 12], // By intensity
    baseFeePercent: [20, 18, 15, 12, 10], // Lower fee at higher intensity but more risk
    processingHours: [48, 36, 24, 18, 12] // Faster at higher intensity
  },
  drug_manufacturing: {
    name: 'Drug Manufacturing',
    description: 'Produce illegal substances',
    requiredCapability: 'can_manufacture',
    baseIncomePerHour: [200, 500, 1000, 2000, 4000],
    baseHeatPerHour: [5, 10, 18, 30, 50],
    requiredUpgrade: 'Lab Equipment'
  },
  vehicle_chopping: {
    name: 'Vehicle Chopping',
    description: 'Strip stolen vehicles for parts',
    requiredType: 'chop_shop',
    baseIncomePerHour: [150, 350, 700, 1200, 2000],
    baseHeatPerHour: [3, 6, 12, 20, 35]
  },
  smuggling: {
    name: 'Smuggling Operations',
    description: 'Import and export contraband',
    requiredCapability: 'dock_access',
    baseIncomePerHour: [300, 700, 1500, 3000, 6000],
    baseHeatPerHour: [8, 15, 25, 40, 60]
  },
  counterfeiting: {
    name: 'Counterfeiting',
    description: 'Print counterfeit currency',
    requiredUpgrade: 'Counterfeiting Press',
    baseIncomePerHour: [250, 600, 1200, 2500, 5000],
    baseHeatPerHour: [6, 12, 22, 35, 55]
  },
  protection_racket: {
    name: 'Protection Racket',
    description: 'Collect protection money from local businesses',
    requiredType: ['corner_store', 'restaurant', 'nightclub', 'strip_mall'],
    baseIncomePerHour: [100, 250, 500, 900, 1500],
    baseHeatPerHour: [2, 4, 8, 14, 22]
  }
};

// GET /api/property-operations/:propertyId - Get operations for a property
router.get('/:propertyId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    // Get property with capabilities
    const propertyResult = await pool.query(
      `SELECT op.*, pl.property_type, pl.can_launder_money, pl.can_manufacture,
              pl.can_store_vehicles, pl.name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    const property = propertyResult.rows[0];

    // Check condition
    if (property.condition < 25) {
      res.status(400).json({
        success: false,
        error: 'Property condition too low for operations. Repair first.'
      });
      return;
    }

    // Get installed upgrades to check for required ones
    const upgradesResult = await pool.query(
      `SELECT put.name FROM property_upgrades pu
       JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
       WHERE pu.property_id = $1 AND pu.is_active = true`,
      [propertyId]
    );
    const installedUpgrades = new Set(upgradesResult.rows.map(u => u.name));

    // Get current operations
    const operationsResult = await pool.query(
      `SELECT * FROM property_operations WHERE property_id = $1`,
      [propertyId]
    );
    const currentOps = new Map(operationsResult.rows.map(o => [o.operation_type, o]));

    // Determine available operations
    const availableOps: any[] = [];

    for (const [opType, config] of Object.entries(OPERATIONS)) {
      let isAvailable = true;
      let unavailableReason = '';

      // Check required capability
      if (config.requiredCapability) {
        const capKey = config.requiredCapability as keyof typeof property;
        if (!property[capKey]) {
          isAvailable = false;
          unavailableReason = `Property doesn't support ${config.name}`;
        }
      }

      // Check required type
      if (config.requiredType) {
        const types = Array.isArray(config.requiredType) ? config.requiredType : [config.requiredType];
        if (!types.includes(property.property_type)) {
          isAvailable = false;
          unavailableReason = `Requires property type: ${types.join(' or ')}`;
        }
      }

      // Check required upgrade
      if (config.requiredUpgrade && !installedUpgrades.has(config.requiredUpgrade)) {
        isAvailable = false;
        unavailableReason = `Requires upgrade: ${config.requiredUpgrade}`;
      }

      const currentOp = currentOps.get(opType);

      availableOps.push({
        type: opType,
        name: config.name,
        description: config.description,
        isAvailable,
        unavailableReason,
        isRunning: currentOp?.status === 'running',
        currentStatus: currentOp?.status || 'idle',
        currentIntensity: currentOp?.intensity || 0,
        currentHeat: currentOp?.current_heat || 0,
        totalRevenue: currentOp?.total_revenue || 0,
        incomePerHour: config.baseIncomePerHour || null,
        heatPerHour: config.baseHeatPerHour,
        specialConfig: opType === 'money_laundering' ? {
          feePercent: config.baseFeePercent,
          processingHours: config.processingHours
        } : null
      });
    }

    res.json({
      success: true,
      data: {
        propertyId,
        propertyName: property.name,
        propertyCondition: property.condition,
        operations: availableOps
      }
    });
  } catch (error) {
    console.error('Get operations error:', error);
    res.status(500).json({ success: false, error: 'Failed to get operations' });
  }
});

// POST /api/property-operations/:propertyId/start - Start an operation
router.post('/:propertyId/start', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { operationType, intensity = 1 } = req.body;

    if (!operationType || !OPERATIONS[operationType as keyof typeof OPERATIONS]) {
      res.status(400).json({ success: false, error: 'Invalid operation type' });
      return;
    }

    const opConfig = OPERATIONS[operationType as keyof typeof OPERATIONS];

    // Validate intensity
    const validIntensity = Math.max(1, Math.min(5, intensity));

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.property_type, pl.can_launder_money, pl.can_manufacture, pl.name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    const property = propertyResult.rows[0];

    // Check condition
    if (property.condition < 25) {
      res.status(400).json({ success: false, error: 'Property condition too low' });
      return;
    }

    // Check capability
    if (opConfig.requiredCapability) {
      const capKey = opConfig.requiredCapability as keyof typeof property;
      if (!property[capKey]) {
        res.status(400).json({ success: false, error: `Property doesn't support ${opConfig.name}` });
        return;
      }
    }

    // Check if operation already running
    const existingResult = await pool.query(
      `SELECT id, status FROM property_operations
       WHERE property_id = $1 AND operation_type = $2`,
      [propertyId, operationType]
    );

    if (existingResult.rows.length > 0 && existingResult.rows[0].status === 'running') {
      res.status(400).json({ success: false, error: 'Operation already running' });
      return;
    }

    // Start or update operation
    if (existingResult.rows.length > 0) {
      await pool.query(
        `UPDATE property_operations
         SET status = 'running', intensity = $1, started_at = NOW()
         WHERE property_id = $2 AND operation_type = $3`,
        [validIntensity, propertyId, operationType]
      );
    } else {
      await pool.query(
        `INSERT INTO property_operations (property_id, operation_type, status, intensity, started_at)
         VALUES ($1, $2, 'running', $3, NOW())`,
        [propertyId, operationType, validIntensity]
      );
    }

    const incomePerHour = opConfig.baseIncomePerHour ? opConfig.baseIncomePerHour[validIntensity - 1] : 0;
    const heatPerHour = opConfig.baseHeatPerHour[validIntensity - 1];

    res.json({
      success: true,
      data: {
        message: `Started ${opConfig.name} at intensity ${validIntensity}`,
        operation: operationType,
        intensity: validIntensity,
        incomePerHour,
        heatPerHour,
        warning: validIntensity >= 4 ? 'High intensity operations attract significant police attention!' : null
      }
    });
  } catch (error) {
    console.error('Start operation error:', error);
    res.status(500).json({ success: false, error: 'Failed to start operation' });
  }
});

// POST /api/property-operations/:propertyId/stop - Stop an operation
router.post('/:propertyId/stop', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { operationType } = req.body;

    // Verify ownership
    const propertyResult = await pool.query(
      `SELECT op.id FROM owned_properties op WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    // Stop operation
    const result = await pool.query(
      `UPDATE property_operations
       SET status = 'idle'
       WHERE property_id = $1 AND operation_type = $2 AND status = 'running'
       RETURNING id`,
      [propertyId, operationType]
    );

    if (result.rowCount === 0) {
      res.status(400).json({ success: false, error: 'Operation not running' });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Operation stopped',
        note: 'Heat will gradually decrease while operation is idle'
      }
    });
  } catch (error) {
    console.error('Stop operation error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop operation' });
  }
});

// POST /api/property-operations/:propertyId/adjust - Adjust operation intensity
router.post('/:propertyId/adjust', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { operationType, intensity } = req.body;

    if (!intensity || intensity < 1 || intensity > 5) {
      res.status(400).json({ success: false, error: 'Intensity must be 1-5' });
      return;
    }

    // Verify ownership
    const propertyResult = await pool.query(
      `SELECT op.id FROM owned_properties op WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    // Update intensity
    const result = await pool.query(
      `UPDATE property_operations
       SET intensity = $1
       WHERE property_id = $2 AND operation_type = $3
       RETURNING id, status`,
      [intensity, propertyId, operationType]
    );

    if (result.rowCount === 0) {
      res.status(400).json({ success: false, error: 'Operation not found' });
      return;
    }

    const opConfig = OPERATIONS[operationType as keyof typeof OPERATIONS];
    const incomePerHour = opConfig.baseIncomePerHour ? opConfig.baseIncomePerHour[intensity - 1] : 0;
    const heatPerHour = opConfig.baseHeatPerHour[intensity - 1];

    res.json({
      success: true,
      data: {
        message: `Adjusted intensity to ${intensity}`,
        newIncomePerHour: incomePerHour,
        newHeatPerHour: heatPerHour
      }
    });
  } catch (error) {
    console.error('Adjust operation error:', error);
    res.status(500).json({ success: false, error: 'Failed to adjust operation' });
  }
});

// POST /api/property-operations/:propertyId/collect - Collect operation revenue
router.post('/:propertyId/collect', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { operationType } = req.body;

    // Get property and operation
    const result = await pool.query(
      `SELECT op.owner_id, po.*, pl.name as property_name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       JOIN property_operations po ON po.property_id = op.id
       WHERE op.id = $1 AND op.owner_id = $2 AND po.operation_type = $3`,
      [propertyId, playerId, operationType]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Operation not found' });
      return;
    }

    const operation = result.rows[0];

    if (operation.status !== 'running') {
      res.status(400).json({ success: false, error: 'Operation not running' });
      return;
    }

    const opConfig = OPERATIONS[operationType as keyof typeof OPERATIONS];
    if (!opConfig.baseIncomePerHour) {
      res.status(400).json({ success: false, error: 'This operation type generates no direct income' });
      return;
    }

    // Calculate pending revenue
    const lastPayout = operation.last_payout || operation.started_at;
    const hoursSincePayout = (Date.now() - new Date(lastPayout).getTime()) / (1000 * 60 * 60);
    const incomePerHour = opConfig.baseIncomePerHour[operation.intensity - 1];
    const pendingRevenue = Math.floor(hoursSincePayout * incomePerHour);

    if (pendingRevenue <= 0) {
      res.status(400).json({ success: false, error: 'No revenue to collect yet' });
      return;
    }

    // Calculate heat generated
    const heatPerHour = opConfig.baseHeatPerHour[operation.intensity - 1];
    const heatGenerated = Math.floor(hoursSincePayout * heatPerHour);

    // Update operation
    await pool.query(
      `UPDATE property_operations
       SET last_payout = NOW(),
           total_revenue = total_revenue + $1,
           current_heat = LEAST(100, current_heat + $2),
           total_heat_generated = total_heat_generated + $2
       WHERE id = $3`,
      [pendingRevenue, heatGenerated, operation.id]
    );

    // Add cash to player (dirty money from illegal ops)
    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [pendingRevenue, playerId]
    );

    // Update player heat
    await pool.query(
      `UPDATE players SET heat_level = LEAST(100, heat_level + $1) WHERE id = $2`,
      [Math.floor(heatGenerated / 2), playerId] // Player gets half the heat
    );

    // Log income
    await pool.query(
      `INSERT INTO property_income_log (property_id, income_type, amount, source_description)
       VALUES ($1, 'operation', $2, $3)`,
      [propertyId, pendingRevenue, `${opConfig.name} revenue collected`]
    );

    res.json({
      success: true,
      data: {
        message: `Collected $${pendingRevenue.toLocaleString()} from ${opConfig.name}`,
        revenue: pendingRevenue,
        hoursCollected: Math.floor(hoursSincePayout),
        heatGenerated,
        currentOperationHeat: Math.min(100, operation.current_heat + heatGenerated),
        warning: operation.current_heat + heatGenerated > 75 ? 'High heat! Consider reducing intensity or laying low.' : null
      }
    });
  } catch (error) {
    console.error('Collect operation revenue error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect revenue' });
  }
});

// POST /api/property-operations/:propertyId/launder - Start money laundering
router.post('/:propertyId/launder', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { amount, intensity = 1 } = req.body;

    if (!amount || amount < 1000) {
      res.status(400).json({ success: false, error: 'Minimum laundering amount is $1,000' });
      return;
    }

    const validIntensity = Math.max(1, Math.min(5, intensity));

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.can_launder_money, pl.name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    const property = propertyResult.rows[0];

    // Check if property can launder
    if (!property.can_launder_money) {
      // Check for Back Office upgrade
      const upgradeResult = await pool.query(
        `SELECT pu.id FROM property_upgrades pu
         JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
         WHERE pu.property_id = $1 AND put.name = 'Back Office' AND pu.is_active = true`,
        [propertyId]
      );

      if (upgradeResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Property cannot launder money. Install Back Office upgrade.'
        });
        return;
      }
    }

    // Check player cash
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].cash < amount) {
      res.status(400).json({ success: false, error: 'Not enough dirty cash' });
      return;
    }

    // Calculate fee and processing time
    const config = OPERATIONS.money_laundering;
    const feePercent = config.baseFeePercent![validIntensity - 1];
    const processingHours = config.processingHours![validIntensity - 1];
    const heatPerHour = config.baseHeatPerHour[validIntensity - 1];

    const feeAmount = Math.floor(amount * (feePercent / 100));
    const cleanAmount = amount - feeAmount;
    const heatGenerated = Math.floor(heatPerHour * (processingHours / 24)); // Spread over processing time

    // Deduct dirty cash
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [amount, playerId]
    );

    // Create laundering transaction
    await pool.query(
      `INSERT INTO laundering_transactions
       (property_id, player_id, dirty_amount, clean_amount, fee_amount, fee_percentage,
        processing_time_hours, heat_generated, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')`,
      [propertyId, playerId, amount, cleanAmount, feeAmount, feePercent, processingHours, heatGenerated]
    );

    res.json({
      success: true,
      data: {
        message: `Started laundering $${amount.toLocaleString()}`,
        dirtyAmount: amount,
        cleanAmount,
        fee: feeAmount,
        feePercent,
        processingHours,
        completesAt: new Date(Date.now() + processingHours * 60 * 60 * 1000).toISOString(),
        heatGenerated
      }
    });
  } catch (error) {
    console.error('Launder money error:', error);
    res.status(500).json({ success: false, error: 'Failed to start laundering' });
  }
});

// GET /api/property-operations/laundering/pending - Get pending laundering transactions
router.get('/laundering/pending', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT lt.*, pl.name as property_name
       FROM laundering_transactions lt
       JOIN owned_properties op ON lt.property_id = op.id
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE lt.player_id = $1 AND lt.status = 'processing'
       ORDER BY lt.started_at DESC`,
      [playerId]
    );

    const transactions = result.rows.map(t => {
      const completesAt = new Date(new Date(t.started_at).getTime() + t.processing_time_hours * 60 * 60 * 1000);
      const isComplete = new Date() >= completesAt;

      return {
        id: t.id,
        propertyId: t.property_id,
        propertyName: t.property_name,
        dirtyAmount: t.dirty_amount,
        cleanAmount: t.clean_amount,
        feeAmount: t.fee_amount,
        feePercent: parseFloat(t.fee_percentage),
        startedAt: t.started_at,
        processingHours: t.processing_time_hours,
        completesAt: completesAt.toISOString(),
        isComplete
      };
    });

    res.json({
      success: true,
      data: { transactions }
    });
  } catch (error) {
    console.error('Get pending laundering error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending transactions' });
  }
});

// POST /api/property-operations/laundering/:transactionId/collect - Collect laundered money
router.post('/laundering/:transactionId/collect', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const transactionId = parseInt(req.params.transactionId);

    // Get transaction
    const result = await pool.query(
      `SELECT * FROM laundering_transactions
       WHERE id = $1 AND player_id = $2 AND status = 'processing'`,
      [transactionId, playerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Transaction not found' });
      return;
    }

    const transaction = result.rows[0];

    // Check if complete
    const completesAt = new Date(new Date(transaction.started_at).getTime() + transaction.processing_time_hours * 60 * 60 * 1000);
    if (new Date() < completesAt) {
      res.status(400).json({
        success: false,
        error: 'Still processing',
        completesAt: completesAt.toISOString()
      });
      return;
    }

    // Mark complete and add clean money
    await pool.query(
      `UPDATE laundering_transactions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [transactionId]
    );

    await pool.query(
      `UPDATE players SET clean_money = clean_money + $1, heat_level = LEAST(100, heat_level + $2) WHERE id = $3`,
      [transaction.clean_amount, transaction.heat_generated, playerId]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO currency_transactions (player_id, currency_type, amount, transaction_type, description)
       VALUES ($1, 'clean_money', $2, 'earn', $3)`,
      [playerId, transaction.clean_amount, `Laundered money collected`]
    );

    res.json({
      success: true,
      data: {
        message: `Collected $${transaction.clean_amount.toLocaleString()} in clean money`,
        cleanAmount: transaction.clean_amount,
        heatGenerated: transaction.heat_generated
      }
    });
  } catch (error) {
    console.error('Collect laundered money error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect money' });
  }
});

// Export for periodic processing
export async function processOperations() {
  // This would be called periodically to update operation stats and heat
  // Not implementing full periodic processing in this route file
  console.log('Processing property operations...');
}

export default router;
