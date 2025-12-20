import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Constants
const LARGE_DEPOSIT_THRESHOLD = 10000;
const STRUCTURING_DETECTION_THRESHOLD = 9000; // Multiple deposits just under 10k
const LAUNDERING_FEE_PERCENT = 15; // Base fee
const HOURS_PER_LAUNDERING_CYCLE = 24;

// GET /api/money-laundering/status - Get player's overall laundering status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's dirty and clean cash
    const playerResult = await pool.query(
      `SELECT cash, clean_bank_balance, total_taxes_paid FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get total across all businesses
    const businessResult = await pool.query(
      `SELECT
         SUM(dirty_cash_stored) as total_dirty_stored,
         SUM(clean_cash_pending) as total_clean_pending,
         SUM(total_laundered) as total_laundered
       FROM business_fronts WHERE owner_id = $1`,
      [playerId]
    );
    const totals = businessResult.rows[0];

    // Get pending laundering operations
    const pendingResult = await pool.query(
      `SELECT SUM(dirty_amount) as pending_dirty, SUM(clean_amount) as pending_clean
       FROM laundering_operations
       WHERE player_id = $1 AND status = 'processing'`,
      [playerId]
    );
    const pending = pendingResult.rows[0];

    // Get recent flags
    const flagsResult = await pool.query(
      `SELECT COUNT(*) as flag_count
       FROM cash_transaction_flags
       WHERE player_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [playerId]
    );
    const recentFlags = parseInt(flagsResult.rows[0].flag_count);

    // Calculate risk level
    let riskLevel = 'low';
    if (recentFlags > 5) riskLevel = 'critical';
    else if (recentFlags > 3) riskLevel = 'high';
    else if (recentFlags > 1) riskLevel = 'medium';

    res.json({
      success: true,
      data: {
        dirtyCash: player.cash,
        cleanCash: player.clean_bank_balance,
        totalTaxesPaid: player.total_taxes_paid,
        totalDirtyStored: parseInt(totals.total_dirty_stored) || 0,
        totalCleanPending: parseInt(totals.total_clean_pending) || 0,
        totalLaundered: parseInt(totals.total_laundered) || 0,
        pendingDirtyAmount: parseInt(pending.pending_dirty) || 0,
        pendingCleanAmount: parseInt(pending.pending_clean) || 0,
        recentFlags,
        riskLevel,
        launderingFeePercent: LAUNDERING_FEE_PERCENT
      }
    });
  } catch (error) {
    console.error('Get laundering status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get laundering status' });
  }
});

// POST /api/money-laundering/deposit - Deposit dirty cash into a business
router.post('/deposit', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { businessId, amount } = req.body;

    if (!businessId || !amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Business ID and positive amount required' });
      return;
    }

    // Verify business ownership
    const businessResult = await pool.query(
      `SELECT bf.*, bft.max_daily_laundering, bft.audit_risk_multiplier
       FROM business_fronts bf
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       WHERE bf.id = $1 AND bf.owner_id = $2`,
      [businessId, playerId]
    );

    if (businessResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const business = businessResult.rows[0];

    // Check player has enough dirty cash
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].cash < amount) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Check daily limit
    const todayDeposits = await pool.query(
      `SELECT COALESCE(SUM(dirty_amount), 0) as today_total
       FROM laundering_operations
       WHERE business_id = $1 AND started_at > NOW() - INTERVAL '24 hours'`,
      [businessId]
    );

    const todayTotal = parseInt(todayDeposits.rows[0].today_total);
    if (todayTotal + amount > business.max_daily_laundering) {
      res.status(400).json({
        success: false,
        error: `Daily limit exceeded. Max: $${business.max_daily_laundering}, Today: $${todayTotal}`
      });
      return;
    }

    // Flag detection
    let wasFlagged = false;
    let flagReason = null;

    // Large deposit flag
    if (amount >= LARGE_DEPOSIT_THRESHOLD) {
      wasFlagged = true;
      flagReason = 'Large cash deposit over $10,000';

      await pool.query(
        `INSERT INTO cash_transaction_flags (player_id, business_id, transaction_type, amount, flag_type, flag_reason)
         VALUES ($1, $2, 'deposit', $3, 'large_deposit', $4)`,
        [playerId, businessId, amount, flagReason]
      );
    }

    // Structuring detection (multiple deposits just under threshold)
    const recentDeposits = await pool.query(
      `SELECT COUNT(*) as count, SUM(dirty_amount) as total
       FROM laundering_operations
       WHERE player_id = $1 AND started_at > NOW() - INTERVAL '7 days'
       AND dirty_amount >= $2 AND dirty_amount < $3`,
      [playerId, STRUCTURING_DETECTION_THRESHOLD, LARGE_DEPOSIT_THRESHOLD]
    );

    if (parseInt(recentDeposits.rows[0].count) >= 3 && amount >= STRUCTURING_DETECTION_THRESHOLD && amount < LARGE_DEPOSIT_THRESHOLD) {
      wasFlagged = true;
      flagReason = 'Potential structuring - multiple deposits just under reporting threshold';

      await pool.query(
        `INSERT INTO cash_transaction_flags (player_id, business_id, transaction_type, amount, flag_type, flag_reason)
         VALUES ($1, $2, 'deposit', $3, 'structuring', $4)`,
        [playerId, businessId, amount, flagReason]
      );
    }

    // Calculate fee based on business legitimacy
    const legitimacyBonus = business.legitimacy_rating / 200; // 0 to 0.5
    const effectiveFee = Math.max(5, LAUNDERING_FEE_PERCENT - (legitimacyBonus * 10));
    const feeAmount = Math.floor(amount * (effectiveFee / 100));
    const cleanAmount = amount - feeAmount;

    // Calculate completion time
    const completesAt = new Date(Date.now() + HOURS_PER_LAUNDERING_CYCLE * 60 * 60 * 1000);

    // Deduct from player's dirty cash
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [amount, playerId]
    );

    // Update business dirty cash stored
    await pool.query(
      `UPDATE business_fronts SET dirty_cash_stored = dirty_cash_stored + $1 WHERE id = $2`,
      [amount, businessId]
    );

    // Create laundering operation
    const operationResult = await pool.query(
      `INSERT INTO laundering_operations
       (business_id, player_id, dirty_amount, clean_amount, fee_amount, fee_percentage, completes_at, was_flagged, flag_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [businessId, playerId, amount, cleanAmount, feeAmount, effectiveFee, completesAt, wasFlagged, flagReason]
    );

    // If flagged, chance to start investigation
    if (wasFlagged && Math.random() < 0.1 * parseFloat(business.audit_risk_multiplier)) {
      await pool.query(
        `INSERT INTO investigations (player_id, business_id, investigation_type, trigger_reason, severity)
         VALUES ($1, $2, 'money_laundering', $3, 1)`,
        [playerId, businessId, flagReason]
      );
    }

    res.json({
      success: true,
      data: {
        message: wasFlagged
          ? 'Deposit made but transaction was flagged!'
          : 'Deposit successful. Laundering in progress.',
        operationId: operationResult.rows[0].id,
        dirtyAmount: amount,
        cleanAmount,
        fee: feeAmount,
        feePercent: effectiveFee,
        completesAt,
        wasFlagged,
        flagReason
      }
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ success: false, error: 'Failed to deposit' });
  }
});

// GET /api/money-laundering/pending - Get pending laundering operations
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const pendingResult = await pool.query(
      `SELECT lo.*, bf.name as business_name, bft.icon as business_icon
       FROM laundering_operations lo
       JOIN business_fronts bf ON lo.business_id = bf.id
       JOIN business_front_types bft ON bf.business_type_id = bft.id
       WHERE lo.player_id = $1 AND lo.status = 'processing'
       ORDER BY lo.completes_at ASC`,
      [playerId]
    );

    const pending = pendingResult.rows.map(p => ({
      id: p.id,
      businessId: p.business_id,
      businessName: p.business_name,
      businessIcon: p.business_icon,
      dirtyAmount: p.dirty_amount,
      cleanAmount: p.clean_amount,
      fee: p.fee_amount,
      feePercent: parseFloat(p.fee_percentage),
      startedAt: p.started_at,
      completesAt: p.completes_at,
      isReady: new Date(p.completes_at) <= new Date(),
      wasFlagged: p.was_flagged,
      flagReason: p.flag_reason
    }));

    res.json({
      success: true,
      data: {
        pending,
        totalPending: pending.length,
        totalDirty: pending.reduce((sum, p) => sum + p.dirtyAmount, 0),
        totalClean: pending.reduce((sum, p) => sum + p.cleanAmount, 0),
        readyToCollect: pending.filter(p => p.isReady).length
      }
    });
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending operations' });
  }
});

// POST /api/money-laundering/collect/:operationId - Collect clean money
router.post('/collect/:operationId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const operationId = parseInt(req.params.operationId);

    // Get operation
    const operationResult = await pool.query(
      `SELECT lo.*, bf.name as business_name
       FROM laundering_operations lo
       JOIN business_fronts bf ON lo.business_id = bf.id
       WHERE lo.id = $1 AND lo.player_id = $2 AND lo.status = 'processing'`,
      [operationId, playerId]
    );

    if (operationResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Operation not found' });
      return;
    }

    const operation = operationResult.rows[0];

    // Check if ready
    if (new Date(operation.completes_at) > new Date()) {
      res.status(400).json({
        success: false,
        error: 'Not ready yet',
        completesAt: operation.completes_at
      });
      return;
    }

    // Update operation status
    await pool.query(
      `UPDATE laundering_operations SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [operationId]
    );

    // Update business totals
    await pool.query(
      `UPDATE business_fronts
       SET dirty_cash_stored = dirty_cash_stored - $1,
           clean_cash_pending = clean_cash_pending + $2,
           total_laundered = total_laundered + $1
       WHERE id = $3`,
      [operation.dirty_amount, operation.clean_amount, operation.business_id]
    );

    // Add clean money to player
    await pool.query(
      `UPDATE players SET clean_bank_balance = clean_bank_balance + $1 WHERE id = $2`,
      [operation.clean_amount, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Collected $${operation.clean_amount.toLocaleString()} clean money!`,
        cleanAmount: operation.clean_amount,
        businessName: operation.business_name,
        totalFee: operation.fee_amount
      }
    });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect' });
  }
});

// POST /api/money-laundering/collect-all - Collect all ready operations
router.post('/collect-all', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get all ready operations
    const readyResult = await pool.query(
      `SELECT lo.*, bf.name as business_name
       FROM laundering_operations lo
       JOIN business_fronts bf ON lo.business_id = bf.id
       WHERE lo.player_id = $1 AND lo.status = 'processing' AND lo.completes_at <= NOW()`,
      [playerId]
    );

    if (readyResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'No operations ready to collect' });
      return;
    }

    let totalClean = 0;
    let totalFees = 0;

    for (const operation of readyResult.rows) {
      // Update operation
      await pool.query(
        `UPDATE laundering_operations SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [operation.id]
      );

      // Update business
      await pool.query(
        `UPDATE business_fronts
         SET dirty_cash_stored = dirty_cash_stored - $1,
             total_laundered = total_laundered + $1
         WHERE id = $2`,
        [operation.dirty_amount, operation.business_id]
      );

      totalClean += operation.clean_amount;
      totalFees += operation.fee_amount;
    }

    // Add all clean money to player
    await pool.query(
      `UPDATE players SET clean_bank_balance = clean_bank_balance + $1 WHERE id = $2`,
      [totalClean, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Collected $${totalClean.toLocaleString()} clean money from ${readyResult.rows.length} operations!`,
        operationsCollected: readyResult.rows.length,
        totalClean,
        totalFees
      }
    });
  } catch (error) {
    console.error('Collect all error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect all' });
  }
});

// POST /api/money-laundering/withdraw - Withdraw clean money to regular cash
router.post('/withdraw', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Positive amount required' });
      return;
    }

    // Check clean balance
    const playerResult = await pool.query(
      `SELECT clean_bank_balance FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].clean_bank_balance < amount) {
      res.status(400).json({ success: false, error: 'Insufficient clean money' });
      return;
    }

    // Transfer clean to regular cash (now it's spendable anywhere)
    await pool.query(
      `UPDATE players SET clean_bank_balance = clean_bank_balance - $1, cash = cash + $1
       WHERE id = $2`,
      [amount, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Withdrew $${amount.toLocaleString()} to your wallet`,
        amount
      }
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ success: false, error: 'Failed to withdraw' });
  }
});

// GET /api/money-laundering/history - Get laundering history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const historyResult = await pool.query(
      `SELECT lo.*, bf.name as business_name
       FROM laundering_operations lo
       JOIN business_fronts bf ON lo.business_id = bf.id
       WHERE lo.player_id = $1
       ORDER BY lo.started_at DESC
       LIMIT $2`,
      [playerId, limit]
    );

    res.json({
      success: true,
      data: {
        history: historyResult.rows.map(h => ({
          id: h.id,
          businessName: h.business_name,
          dirtyAmount: h.dirty_amount,
          cleanAmount: h.clean_amount,
          fee: h.fee_amount,
          status: h.status,
          startedAt: h.started_at,
          completedAt: h.completed_at,
          wasFlagged: h.was_flagged
        }))
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// GET /api/money-laundering/flags - Get transaction flags
router.get('/flags', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const flagsResult = await pool.query(
      `SELECT ctf.*, bf.name as business_name
       FROM cash_transaction_flags ctf
       LEFT JOIN business_fronts bf ON ctf.business_id = bf.id
       WHERE ctf.player_id = $1
       ORDER BY ctf.created_at DESC
       LIMIT 50`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        flags: flagsResult.rows.map(f => ({
          id: f.id,
          businessName: f.business_name,
          transactionType: f.transaction_type,
          amount: f.amount,
          flagType: f.flag_type,
          reason: f.flag_reason,
          reportedToAuthorities: f.reported_to_authorities,
          createdAt: f.created_at
        })),
        totalFlags: flagsResult.rows.length,
        reportedFlags: flagsResult.rows.filter(f => f.reported_to_authorities).length
      }
    });
  } catch (error) {
    console.error('Get flags error:', error);
    res.status(500).json({ success: false, error: 'Failed to get flags' });
  }
});

// Process laundering operations (call periodically to auto-complete)
export async function processLaunderingOperations(): Promise<void> {
  try {
    // Find completed operations
    const completedResult = await pool.query(
      `SELECT * FROM laundering_operations
       WHERE status = 'processing' AND completes_at <= NOW()`
    );

    console.log(`Found ${completedResult.rows.length} laundering operations ready to complete`);

    // Auto-completion is optional - players must collect manually
    // This is just for logging purposes
  } catch (error) {
    console.error('Process laundering error:', error);
  }
}

export default router;
