import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { withTransaction, lockRowForUpdate } from '../db/transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const loanAmountSchema = z.object({
  body: z.object({
    amount: z.coerce.number().int().positive('Amount must be positive').max(999999999, 'Amount too large')
  })
});

const loanPaymentSchema = z.object({
  body: z.object({
    loanId: z.coerce.number().int().positive('Invalid loan ID'),
    amount: z.coerce.number().int().positive('Amount must be positive').max(999999999, 'Amount too large')
  })
});

const safeTierSchema = z.object({
  body: z.object({
    tier: z.coerce.number().int().min(1, 'Tier must be at least 1').max(5, 'Tier must be at most 5')
  })
});

const safeAmountSchema = z.object({
  body: z.object({
    amount: z.coerce.number().int().positive('Amount must be positive').max(999999999, 'Amount too large')
  })
});

router.use(authMiddleware);

// Interest rates by level
const INTEREST_RATES = {
  savings: 0.005, // 0.5% per collection
  loan: 0.10, // 10% interest on loans
};

// Safe deposit box tiers
const SAFE_DEPOSIT_TIERS = [
  { tier: 1, capacity: 10000, monthlyFee: 100, minLevel: 1 },
  { tier: 2, capacity: 50000, monthlyFee: 500, minLevel: 3 },
  { tier: 3, capacity: 200000, monthlyFee: 2000, minLevel: 5 },
  { tier: 4, capacity: 1000000, monthlyFee: 10000, minLevel: 8 },
  { tier: 5, capacity: 5000000, monthlyFee: 50000, minLevel: 10 },
];

// Loan limits by level
function getMaxLoanAmount(level: number): number {
  return level * 10000;
}

// GET /api/banking - Get full banking status
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info
    const playerResult = await pool.query(
      `SELECT cash, bank, level, protected_cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get active loans
    const loansResult = await pool.query(
      `SELECT id, amount, interest_rate, total_owed, paid_amount, due_date, status, created_at
       FROM bank_loans WHERE player_id = $1 AND status = 'active'
       ORDER BY due_date`,
      [playerId]
    );

    // Get safe deposit box
    const safeResult = await pool.query(
      `SELECT tier, capacity, protected_cash, monthly_fee, last_fee_paid
       FROM safe_deposit_boxes WHERE player_id = $1`,
      [playerId]
    );

    // Get interest history (last 10)
    const interestResult = await pool.query(
      `SELECT interest_earned, bank_balance, created_at
       FROM bank_interest_log WHERE player_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [playerId]
    );

    const maxLoan = getMaxLoanAmount(player.level);
    const totalOwed = loansResult.rows.reduce((sum: number, l: { total_owed: number; paid_amount: number }) =>
      sum + (l.total_owed - l.paid_amount), 0);
    const availableLoan = Math.max(0, maxLoan - totalOwed);

    res.json({
      success: true,
      data: {
        cash: player.cash,
        bank: player.bank,
        protectedCash: player.protected_cash,
        loans: loansResult.rows.map(l => ({
          id: l.id,
          amount: l.amount,
          interestRate: parseFloat(l.interest_rate),
          totalOwed: l.total_owed,
          paidAmount: l.paid_amount,
          remaining: l.total_owed - l.paid_amount,
          dueDate: l.due_date,
          status: l.status,
          createdAt: l.created_at
        })),
        safeDeposit: safeResult.rows[0] ? {
          tier: safeResult.rows[0].tier,
          capacity: safeResult.rows[0].capacity,
          stored: safeResult.rows[0].protected_cash,
          monthlyFee: safeResult.rows[0].monthly_fee,
          lastFeePaid: safeResult.rows[0].last_fee_paid
        } : null,
        interestHistory: interestResult.rows,
        maxLoanAmount: maxLoan,
        availableLoanAmount: availableLoan,
        interestRate: INTEREST_RATES.loan * 100,
        savingsRate: INTEREST_RATES.savings * 100,
        safeDepositTiers: SAFE_DEPOSIT_TIERS.filter(t => t.minLevel <= player.level)
      }
    });
  } catch (error) {
    console.error('Banking status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get banking status' });
  }
});

// POST /api/banking/loan/take - Take out a loan
// Validation ensures amount is a positive integer
router.post('/loan/take', validate(loanAmountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock player row to prevent race conditions
      const player = await lockRowForUpdate<{ level: number; cash: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      const maxLoan = getMaxLoanAmount(player.level);

      // Check existing loans (within transaction)
      const existingResult = await client.query(
        `SELECT COALESCE(SUM(total_owed - paid_amount), 0) as total_owed
         FROM bank_loans WHERE player_id = $1 AND status = 'active'`,
        [playerId]
      );
      const currentDebt = parseInt(existingResult.rows[0].total_owed);
      const availableLoan = maxLoan - currentDebt;

      if (amount > availableLoan) {
        throw new Error(`Maximum loan available: $${availableLoan.toLocaleString()}`);
      }

      // Calculate total with interest
      const totalOwed = Math.floor(amount * (1 + INTEREST_RATES.loan));
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await client.query(
        `INSERT INTO bank_loans (player_id, amount, interest_rate, total_owed, due_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [playerId, amount, INTEREST_RATES.loan * 100, totalOwed, dueDate]
      );

      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [amount, playerId]
      );

      return {
        message: `Loan approved! Received $${amount.toLocaleString()}`,
        loanAmount: amount,
        totalOwed,
        dueDate,
        newCash: player.cash + amount
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Take loan error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to process loan' });
  }
});

// POST /api/banking/loan/pay - Pay back a loan
// Validation ensures loanId and amount are valid
router.post('/loan/pay', validate(loanPaymentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { loanId, amount } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock player row to prevent race conditions
      const player = await lockRowForUpdate<{ cash: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      if (player.cash < amount) {
        throw new Error('Insufficient cash');
      }

      // Lock loan row
      const loanResult = await client.query(
        `SELECT id, total_owed, paid_amount FROM bank_loans
         WHERE id = $1 AND player_id = $2 AND status = 'active' FOR UPDATE`,
        [loanId, playerId]
      );

      if (loanResult.rows.length === 0) {
        throw new Error('Loan not found');
      }

      const loan = loanResult.rows[0];
      const remaining = loan.total_owed - loan.paid_amount;
      const payment = Math.min(amount, remaining);
      const newPaid = loan.paid_amount + payment;
      const isPaidOff = newPaid >= loan.total_owed;

      await client.query(
        `UPDATE bank_loans SET paid_amount = $1, status = $2 WHERE id = $3`,
        [newPaid, isPaidOff ? 'paid' : 'active', loanId]
      );

      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [payment, playerId]
      );

      return {
        message: isPaidOff ? 'Loan fully paid off!' : `Paid $${payment.toLocaleString()} towards loan`,
        paymentAmount: payment,
        remaining: remaining - payment,
        isPaidOff,
        newCash: player.cash - payment
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Pay loan error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to process payment' });
  }
});

// POST /api/banking/interest/collect - Collect interest on bank balance
router.post('/interest/collect', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await withTransaction(async (client) => {
      // Lock player row
      const player = await lockRowForUpdate<{ bank: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      // Check last collection time (once per hour) - within transaction
      const lastResult = await client.query(
        `SELECT created_at FROM bank_interest_log
         WHERE player_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [playerId]
      );

      if (lastResult.rows.length > 0) {
        const lastCollection = new Date(lastResult.rows[0].created_at);
        const hoursSince = (Date.now() - lastCollection.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 1) {
          const minutesLeft = Math.ceil(60 - (hoursSince * 60));
          throw new Error(`Interest available in ${minutesLeft} minutes`);
        }
      }

      if (player.bank <= 0) {
        throw new Error('No bank balance to earn interest');
      }

      const interest = Math.floor(player.bank * INTEREST_RATES.savings);

      if (interest <= 0) {
        throw new Error('Balance too low to earn interest');
      }

      await client.query(
        `UPDATE players SET bank = bank + $1 WHERE id = $2`,
        [interest, playerId]
      );

      await client.query(
        `INSERT INTO bank_interest_log (player_id, interest_earned, bank_balance)
         VALUES ($1, $2, $3)`,
        [playerId, interest, player.bank + interest]
      );

      return {
        message: `Collected $${interest.toLocaleString()} in interest!`,
        interestEarned: interest,
        newBalance: player.bank + interest
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Collect interest error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to collect interest' });
  }
});

// POST /api/banking/safe/rent - Rent or upgrade safe deposit box
// Validation ensures tier is between 1 and 5
router.post('/safe/rent', validate(safeTierSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { tier } = req.body;

    const tierInfo = SAFE_DEPOSIT_TIERS.find(t => t.tier === tier);
    if (!tierInfo) {
      res.status(400).json({ success: false, error: 'Invalid tier' });
      return;
    }

    const result = await withTransaction(async (client) => {
      // Lock player row
      const player = await lockRowForUpdate<{ level: number; cash: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      if (player.level < tierInfo.minLevel) {
        throw new Error(`Requires level ${tierInfo.minLevel}`);
      }

      if (player.cash < tierInfo.monthlyFee) {
        throw new Error('Insufficient cash for fee');
      }

      // Check existing safe (with lock)
      const existingResult = await client.query(
        `SELECT tier, protected_cash FROM safe_deposit_boxes WHERE player_id = $1 FOR UPDATE`,
        [playerId]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        if (tier <= existing.tier) {
          throw new Error('Can only upgrade to a higher tier');
        }

        await client.query(
          `UPDATE safe_deposit_boxes
           SET tier = $1, capacity = $2, monthly_fee = $3, last_fee_paid = NOW()
           WHERE player_id = $4`,
          [tier, tierInfo.capacity, tierInfo.monthlyFee, playerId]
        );
      } else {
        await client.query(
          `INSERT INTO safe_deposit_boxes (player_id, tier, capacity, monthly_fee)
           VALUES ($1, $2, $3, $4)`,
          [playerId, tier, tierInfo.capacity, tierInfo.monthlyFee]
        );
      }

      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [tierInfo.monthlyFee, playerId]
      );

      return {
        message: `Safe deposit box tier ${tier} activated!`,
        tier,
        capacity: tierInfo.capacity,
        monthlyFee: tierInfo.monthlyFee,
        newCash: player.cash - tierInfo.monthlyFee
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Rent safe error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to rent safe' });
  }
});

// POST /api/banking/safe/deposit - Store cash in safe deposit
// Validation ensures amount is a positive integer
router.post('/safe/deposit', validate(safeAmountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock both player and safe to prevent race conditions
      const player = await lockRowForUpdate<{ cash: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      const safeResult = await client.query(
        `SELECT capacity, protected_cash FROM safe_deposit_boxes WHERE player_id = $1 FOR UPDATE`,
        [playerId]
      );

      if (safeResult.rows.length === 0) {
        throw new Error('No safe deposit box rented');
      }

      const safe = safeResult.rows[0];
      const available = safe.capacity - safe.protected_cash;

      if (amount > available) {
        throw new Error(`Safe can only hold $${available.toLocaleString()} more`);
      }

      if (player.cash < amount) {
        throw new Error('Insufficient cash');
      }

      await client.query(
        `UPDATE safe_deposit_boxes SET protected_cash = protected_cash + $1 WHERE player_id = $2`,
        [amount, playerId]
      );

      await client.query(
        `UPDATE players SET cash = cash - $1, protected_cash = protected_cash + $1 WHERE id = $2`,
        [amount, playerId]
      );

      return {
        message: `Stored $${amount.toLocaleString()} in safe deposit box`,
        amount,
        newProtected: safe.protected_cash + amount,
        capacity: safe.capacity
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Safe deposit error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to deposit in safe' });
  }
});

// POST /api/banking/safe/withdraw - Withdraw cash from safe deposit
// Validation ensures amount is a positive integer
router.post('/safe/withdraw', validate(safeAmountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock both player and safe to prevent race conditions
      const player = await lockRowForUpdate(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      const safeResult = await client.query(
        `SELECT protected_cash FROM safe_deposit_boxes WHERE player_id = $1 FOR UPDATE`,
        [playerId]
      );

      if (safeResult.rows.length === 0) {
        throw new Error('No safe deposit box rented');
      }

      const safe = safeResult.rows[0];

      if (amount > safe.protected_cash) {
        throw new Error('Insufficient funds in safe');
      }

      await client.query(
        `UPDATE safe_deposit_boxes SET protected_cash = protected_cash - $1 WHERE player_id = $2`,
        [amount, playerId]
      );

      await client.query(
        `UPDATE players SET cash = cash + $1, protected_cash = protected_cash - $1 WHERE id = $2`,
        [amount, playerId]
      );

      return {
        message: `Withdrew $${amount.toLocaleString()} from safe deposit box`,
        amount,
        newProtected: safe.protected_cash - amount
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Safe withdraw error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to withdraw from safe' });
  }
});

export default router;
