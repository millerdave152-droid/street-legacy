import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Constants
const TAX_PERIOD_DAYS = 30; // Monthly taxes
const LATE_PENALTY_PERCENT = 10;
const AUDIT_BASE_CHANCE = 5; // 5% base audit chance

// GET /api/taxes/status - Get overall tax status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player tax info
    const playerResult = await pool.query(
      `SELECT total_taxes_paid, tax_evasion_amount FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get pending tax records
    const pendingResult = await pool.query(
      `SELECT tr.*, bf.name as business_name
       FROM tax_records tr
       JOIN business_fronts bf ON tr.business_id = bf.id
       WHERE tr.player_id = $1 AND tr.payment_status IN ('pending', 'partial', 'overdue')
       ORDER BY tr.due_date ASC`,
      [playerId]
    );

    // Get recent paid taxes
    const paidResult = await pool.query(
      `SELECT tr.*, bf.name as business_name
       FROM tax_records tr
       JOIN business_fronts bf ON tr.business_id = bf.id
       WHERE tr.player_id = $1 AND tr.payment_status = 'paid'
       ORDER BY tr.paid_at DESC LIMIT 10`,
      [playerId]
    );

    const totalOwed = pendingResult.rows.reduce((sum, t) => sum + (t.taxes_owed - t.taxes_paid), 0);
    const overdueCount = pendingResult.rows.filter(t => t.payment_status === 'overdue').length;

    res.json({
      success: true,
      data: {
        totalTaxesPaid: player.total_taxes_paid,
        totalTaxEvasion: player.tax_evasion_amount,
        totalOwed,
        overdueCount,
        pendingTaxes: pendingResult.rows.map(t => ({
          id: t.id,
          businessId: t.business_id,
          businessName: t.business_name,
          period: t.tax_period,
          grossIncome: t.gross_income,
          reportedIncome: t.reported_income,
          taxesOwed: t.taxes_owed,
          taxesPaid: t.taxes_paid,
          remaining: t.taxes_owed - t.taxes_paid,
          dueDate: t.due_date,
          status: t.payment_status,
          isOverdue: t.payment_status === 'overdue',
          auditFlag: t.audit_flag,
          penalty: t.penalty_amount
        })),
        recentPayments: paidResult.rows.map(t => ({
          id: t.id,
          businessName: t.business_name,
          period: t.tax_period,
          taxesPaid: t.taxes_paid,
          paidAt: t.paid_at
        }))
      }
    });
  } catch (error) {
    console.error('Get tax status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get tax status' });
  }
});

// POST /api/taxes/pay - Pay taxes for a specific record
router.post('/pay', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { taxRecordId, amount, useCleanMoney } = req.body;

    if (!taxRecordId || !amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Tax record ID and positive amount required' });
      return;
    }

    // Get tax record
    const taxResult = await pool.query(
      `SELECT tr.*, bf.name as business_name
       FROM tax_records tr
       JOIN business_fronts bf ON tr.business_id = bf.id
       WHERE tr.id = $1 AND tr.player_id = $2`,
      [taxRecordId, playerId]
    );

    if (taxResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Tax record not found' });
      return;
    }

    const taxRecord = taxResult.rows[0];
    const remaining = taxRecord.taxes_owed + taxRecord.penalty_amount - taxRecord.taxes_paid;

    if (remaining <= 0) {
      res.status(400).json({ success: false, error: 'Taxes already paid in full' });
      return;
    }

    const payAmount = Math.min(amount, remaining);

    // Check player funds
    const playerResult = await pool.query(
      `SELECT cash, clean_bank_balance FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    const moneySource = useCleanMoney ? 'clean_bank_balance' : 'cash';
    const availableFunds = useCleanMoney ? player.clean_bank_balance : player.cash;

    if (availableFunds < payAmount) {
      res.status(400).json({
        success: false,
        error: `Insufficient ${useCleanMoney ? 'clean money' : 'cash'}`
      });
      return;
    }

    // Deduct payment
    await pool.query(
      `UPDATE players SET ${moneySource} = ${moneySource} - $1, total_taxes_paid = total_taxes_paid + $1
       WHERE id = $2`,
      [payAmount, playerId]
    );

    // Update tax record
    const newPaid = taxRecord.taxes_paid + payAmount;
    const newStatus = newPaid >= taxRecord.taxes_owed + taxRecord.penalty_amount ? 'paid' : 'partial';

    await pool.query(
      `UPDATE tax_records
       SET taxes_paid = $1, payment_status = $2, paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $3`,
      [newPaid, newStatus, taxRecordId]
    );

    // Legitimacy boost for paying taxes
    if (newStatus === 'paid') {
      await pool.query(
        `UPDATE business_fronts SET legitimacy_rating = LEAST(100, legitimacy_rating + 5)
         WHERE id = $1`,
        [taxRecord.business_id]
      );
    }

    res.json({
      success: true,
      data: {
        message: newStatus === 'paid'
          ? `Taxes for ${taxRecord.business_name} paid in full!`
          : `Partial payment of $${payAmount.toLocaleString()} made`,
        amountPaid: payAmount,
        remaining: remaining - payAmount,
        status: newStatus,
        legitimacyBonus: newStatus === 'paid' ? 5 : 0
      }
    });
  } catch (error) {
    console.error('Pay taxes error:', error);
    res.status(500).json({ success: false, error: 'Failed to pay taxes' });
  }
});

// POST /api/taxes/file - File taxes for a business (choose how much to report)
router.post('/file', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { businessId, reportedPercent } = req.body;

    if (!businessId || reportedPercent === undefined) {
      res.status(400).json({ success: false, error: 'Business ID and reported percent required' });
      return;
    }

    if (reportedPercent < 0 || reportedPercent > 100) {
      res.status(400).json({ success: false, error: 'Reported percent must be 0-100' });
      return;
    }

    // Get business
    const businessResult = await pool.query(
      `SELECT bf.*, bft.tax_rate, bft.audit_risk_multiplier
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

    // Calculate current period
    const now = new Date();
    const taxPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if already filed for this period
    const existingResult = await pool.query(
      `SELECT id FROM tax_records WHERE business_id = $1 AND tax_period = $2`,
      [businessId, taxPeriod]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Taxes already filed for this period' });
      return;
    }

    // Calculate gross income (legitimate + a portion of laundered)
    const grossIncome = business.total_legitimate_income + Math.floor(business.total_laundered * 0.3);
    const reportedIncome = Math.floor(grossIncome * (reportedPercent / 100));
    const unreportedIncome = grossIncome - reportedIncome;

    const taxRate = parseFloat(business.tax_rate) / 100;
    const taxesOwed = Math.floor(reportedIncome * taxRate);

    const dueDate = new Date(now.getTime() + TAX_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Calculate audit flag chance
    const underReportingPercent = 100 - reportedPercent;
    let auditChance = AUDIT_BASE_CHANCE + (underReportingPercent * 0.5);
    auditChance *= parseFloat(business.audit_risk_multiplier);

    // Check for attorney reducing audit chance
    const attorneyResult = await pool.query(
      `SELECT audit_reduction_percent FROM player_attorney_relationships
       WHERE player_id = $1 AND is_active = true AND retainer_paid_until > NOW()`,
      [playerId]
    );

    if (attorneyResult.rows.length > 0) {
      auditChance *= (100 - attorneyResult.rows[0].audit_reduction_percent) / 100;
    }

    const auditFlag = Math.random() * 100 < auditChance;

    // Create tax record
    const taxResult = await pool.query(
      `INSERT INTO tax_records
       (player_id, business_id, tax_period, gross_income, reported_income, taxes_owed, due_date, audit_flag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [playerId, businessId, taxPeriod, grossIncome, reportedIncome, taxesOwed, dueDate, auditFlag]
    );

    // Track tax evasion amount
    if (unreportedIncome > 0) {
      await pool.query(
        `UPDATE players SET tax_evasion_amount = tax_evasion_amount + $1 WHERE id = $2`,
        [Math.floor(unreportedIncome * taxRate), playerId]
      );
    }

    // Update business last tax filed
    await pool.query(
      `UPDATE business_fronts SET last_tax_paid = NOW() WHERE id = $1`,
      [businessId]
    );

    // If audit flagged and severe under-reporting, start investigation
    if (auditFlag && underReportingPercent > 50) {
      await pool.query(
        `INSERT INTO investigations (player_id, business_id, investigation_type, trigger_reason, severity)
         VALUES ($1, $2, 'tax_fraud', 'Severe under-reporting on tax filing', 2)`,
        [playerId, businessId]
      );
    }

    res.json({
      success: true,
      data: {
        message: auditFlag
          ? 'Taxes filed, but your return has been flagged for audit!'
          : 'Taxes filed successfully',
        taxRecordId: taxResult.rows[0].id,
        period: taxPeriod,
        grossIncome,
        reportedIncome,
        taxesOwed,
        dueDate,
        auditFlag,
        savedByUnderReporting: Math.floor(unreportedIncome * taxRate)
      }
    });
  } catch (error) {
    console.error('File taxes error:', error);
    res.status(500).json({ success: false, error: 'Failed to file taxes' });
  }
});

// GET /api/taxes/attorneys - Get available tax attorneys
router.get('/attorneys', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's current attorney
    const currentResult = await pool.query(
      `SELECT * FROM player_attorney_relationships WHERE player_id = $1`,
      [playerId]
    );
    const currentAttorney = currentResult.rows[0];

    // Get player level and legitimacy average
    const playerResult = await pool.query(
      `SELECT p.level,
              (SELECT AVG(legitimacy_rating) FROM business_fronts WHERE owner_id = $1) as avg_legitimacy
       FROM players p WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];
    const avgLegitimacy = parseFloat(player.avg_legitimacy) || 0;

    // Get available attorneys
    const attorneysResult = await pool.query(
      `SELECT * FROM attorney_npcs
       WHERE required_level <= $1 AND min_legitimacy <= $2
       AND (max_clients IS NULL OR current_clients < max_clients)
       ORDER BY tier ASC`,
      [player.level, avgLegitimacy]
    );

    res.json({
      success: true,
      data: {
        currentAttorney: currentAttorney ? {
          name: currentAttorney.attorney_name,
          tier: currentAttorney.attorney_tier,
          retainerFee: currentAttorney.retainer_fee,
          retainerPaidUntil: currentAttorney.retainer_paid_until,
          isActive: currentAttorney.is_active && currentAttorney.retainer_paid_until > new Date(),
          casesHandled: currentAttorney.cases_handled,
          auditReduction: currentAttorney.audit_reduction_percent
        } : null,
        availableAttorneys: attorneysResult.rows.map(a => ({
          id: a.id,
          name: a.name,
          tier: a.tier,
          description: a.description,
          monthlyRetainer: a.monthly_retainer,
          auditReduction: a.audit_reduction_percent,
          investigationHelp: a.investigation_help_percent,
          icon: a.icon,
          spotsAvailable: a.max_clients ? a.max_clients - a.current_clients : 'Unlimited'
        }))
      }
    });
  } catch (error) {
    console.error('Get attorneys error:', error);
    res.status(500).json({ success: false, error: 'Failed to get attorneys' });
  }
});

// POST /api/taxes/hire-attorney - Hire a tax attorney
router.post('/hire-attorney', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { attorneyId } = req.body;

    if (!attorneyId) {
      res.status(400).json({ success: false, error: 'Attorney ID required' });
      return;
    }

    // Check if already has an attorney
    const existingResult = await pool.query(
      `SELECT id FROM player_attorney_relationships WHERE player_id = $1`,
      [playerId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Already have an attorney. Fire them first.' });
      return;
    }

    // Get attorney
    const attorneyResult = await pool.query(
      `SELECT * FROM attorney_npcs WHERE id = $1`,
      [attorneyId]
    );

    if (attorneyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Attorney not found' });
      return;
    }

    const attorney = attorneyResult.rows[0];

    // Check availability
    if (attorney.max_clients && attorney.current_clients >= attorney.max_clients) {
      res.status(400).json({ success: false, error: 'Attorney has no available slots' });
      return;
    }

    // Check player can afford retainer
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].cash < attorney.monthly_retainer) {
      res.status(400).json({ success: false, error: 'Cannot afford retainer fee' });
      return;
    }

    // Deduct retainer
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [attorney.monthly_retainer, playerId]
    );

    // Create relationship
    const retainerUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO player_attorney_relationships
       (player_id, attorney_name, attorney_tier, retainer_fee, retainer_paid_until, audit_reduction_percent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [playerId, attorney.name, attorney.tier, attorney.monthly_retainer, retainerUntil, attorney.audit_reduction_percent]
    );

    // Update attorney client count
    await pool.query(
      `UPDATE attorney_npcs SET current_clients = current_clients + 1 WHERE id = $1`,
      [attorneyId]
    );

    res.json({
      success: true,
      data: {
        message: `${attorney.name} is now on retainer!`,
        attorney: attorney.name,
        retainerFee: attorney.monthly_retainer,
        retainerPaidUntil: retainerUntil,
        auditReduction: attorney.audit_reduction_percent
      }
    });
  } catch (error) {
    console.error('Hire attorney error:', error);
    res.status(500).json({ success: false, error: 'Failed to hire attorney' });
  }
});

// POST /api/taxes/pay-retainer - Pay attorney retainer
router.post('/pay-retainer', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get current attorney
    const attorneyResult = await pool.query(
      `SELECT * FROM player_attorney_relationships WHERE player_id = $1`,
      [playerId]
    );

    if (attorneyResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'No attorney on retainer' });
      return;
    }

    const relationship = attorneyResult.rows[0];

    // Check funds
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].cash < relationship.retainer_fee) {
      res.status(400).json({ success: false, error: 'Cannot afford retainer' });
      return;
    }

    // Deduct and extend
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [relationship.retainer_fee, playerId]
    );

    const newUntil = new Date(Math.max(
      new Date(relationship.retainer_paid_until).getTime(),
      Date.now()
    ) + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE player_attorney_relationships SET retainer_paid_until = $1, is_active = true
       WHERE player_id = $2`,
      [newUntil, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Retainer paid for ${relationship.attorney_name}`,
        retainerFee: relationship.retainer_fee,
        paidUntil: newUntil
      }
    });
  } catch (error) {
    console.error('Pay retainer error:', error);
    res.status(500).json({ success: false, error: 'Failed to pay retainer' });
  }
});

// Process overdue taxes (call periodically)
export async function processOverdueTaxes(): Promise<void> {
  try {
    // Mark overdue taxes
    const overdueResult = await pool.query(
      `UPDATE tax_records
       SET payment_status = 'overdue',
           penalty_amount = GREATEST(penalty_amount, FLOOR(taxes_owed * $1 / 100))
       WHERE payment_status IN ('pending', 'partial')
       AND due_date < NOW()
       AND taxes_paid < taxes_owed
       RETURNING business_id`,
      [LATE_PENALTY_PERCENT]
    );

    // Decrease legitimacy for overdue taxes
    for (const row of overdueResult.rows) {
      await pool.query(
        `UPDATE business_fronts SET legitimacy_rating = GREATEST(0, legitimacy_rating - 10)
         WHERE id = $1`,
        [row.business_id]
      );
    }

    if (overdueResult.rows.length > 0) {
      console.log(`Processed ${overdueResult.rows.length} overdue tax records`);
    }
  } catch (error) {
    console.error('Process overdue taxes error:', error);
  }
}

export default router;
