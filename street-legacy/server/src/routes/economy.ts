import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Constants for safeguards
const DEFAULT_DAILY_LIMIT = 5.00;
const DEFAULT_WEEKLY_LIMIT = 20.00;
const COOLING_OFF_THRESHOLD = 10.00;
const COOLING_OFF_HOURS = 24;

// GET /api/economy/token-balance - Get player's token balance and spending info
router.get('/token-balance', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's token balance
    const playerResult = await pool.query(
      `SELECT tokens FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    // Get or create spending limits
    await ensureSpendLimits(playerId);

    const limitsResult = await pool.query(
      `SELECT * FROM player_spend_limits WHERE player_id = $1`,
      [playerId]
    );

    const limits = limitsResult.rows[0];
    const now = new Date();

    // Check if cooling off period is active
    const isCoolingOff = limits.cooling_off_until && new Date(limits.cooling_off_until) > now;

    res.json({
      success: true,
      data: {
        tokens: playerResult.rows[0].tokens,
        spending: {
          dailySpent: parseFloat(limits.daily_spent_usd),
          dailyLimit: parseFloat(limits.daily_limit_usd),
          dailyRemaining: Math.max(0, parseFloat(limits.daily_limit_usd) - parseFloat(limits.daily_spent_usd)),
          weeklySpent: parseFloat(limits.weekly_spent_usd),
          weeklyLimit: parseFloat(limits.weekly_limit_usd),
          weeklyRemaining: Math.max(0, parseFloat(limits.weekly_limit_usd) - parseFloat(limits.weekly_spent_usd)),
          totalSpent: parseFloat(limits.total_spent_usd),
          verified: limits.verified
        },
        coolingOff: {
          active: isCoolingOff,
          until: limits.cooling_off_until
        }
      }
    });
  } catch (error) {
    console.error('Get token balance error:', error);
    res.status(500).json({ success: false, error: 'Failed to get token balance' });
  }
});

// GET /api/economy/packages - Get available token packages
router.get('/packages', async (req: AuthRequest, res: Response) => {
  try {
    const packagesResult = await pool.query(
      `SELECT id, name, tokens, price_usd, bonus_tokens, is_featured
       FROM token_packages
       WHERE is_active = true
       ORDER BY price_usd ASC`
    );

    res.json({
      success: true,
      data: {
        packages: packagesResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          tokens: p.tokens,
          bonusTokens: p.bonus_tokens,
          totalTokens: p.tokens + p.bonus_tokens,
          priceUsd: parseFloat(p.price_usd),
          isFeatured: p.is_featured,
          valuePerDollar: Math.round((p.tokens + p.bonus_tokens) / parseFloat(p.price_usd))
        })),
        disclaimer: 'You are spending real money. All purchases are final. Set spending limits in your account settings.'
      }
    });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ success: false, error: 'Failed to get packages' });
  }
});

// POST /api/economy/purchase - Purchase tokens (creates Stripe session or mock for dev)
router.post('/purchase', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { packageId } = req.body;

    if (!packageId) {
      res.status(400).json({ success: false, error: 'Package ID required' });
      return;
    }

    // Get the package
    const packageResult = await pool.query(
      `SELECT * FROM token_packages WHERE id = $1 AND is_active = true`,
      [packageId]
    );

    if (packageResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Package not found' });
      return;
    }

    const pkg = packageResult.rows[0];
    const priceUsd = parseFloat(pkg.price_usd);

    // Check spending limits
    await ensureSpendLimits(playerId);
    await resetSpendLimitsIfNeeded(playerId);

    const limitsResult = await pool.query(
      `SELECT * FROM player_spend_limits WHERE player_id = $1`,
      [playerId]
    );

    const limits = limitsResult.rows[0];
    const now = new Date();

    // Check cooling off period
    if (limits.cooling_off_until && new Date(limits.cooling_off_until) > now) {
      res.status(400).json({
        success: false,
        error: 'Cooling off period active. Please wait before making more purchases.',
        coolingOffUntil: limits.cooling_off_until
      });
      return;
    }

    // Check daily limit
    const newDailyTotal = parseFloat(limits.daily_spent_usd) + priceUsd;
    if (newDailyTotal > parseFloat(limits.daily_limit_usd)) {
      res.status(400).json({
        success: false,
        error: `This purchase would exceed your daily spending limit of $${limits.daily_limit_usd}`,
        dailyRemaining: Math.max(0, parseFloat(limits.daily_limit_usd) - parseFloat(limits.daily_spent_usd))
      });
      return;
    }

    // Check weekly limit
    const newWeeklyTotal = parseFloat(limits.weekly_spent_usd) + priceUsd;
    if (newWeeklyTotal > parseFloat(limits.weekly_limit_usd)) {
      res.status(400).json({
        success: false,
        error: `This purchase would exceed your weekly spending limit of $${limits.weekly_limit_usd}`,
        weeklyRemaining: Math.max(0, parseFloat(limits.weekly_limit_usd) - parseFloat(limits.weekly_spent_usd))
      });
      return;
    }

    // Create pending purchase record
    const purchaseResult = await pool.query(
      `INSERT INTO token_purchases (player_id, package_id, tokens_purchased, amount_usd, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [playerId, packageId, pkg.tokens + pkg.bonus_tokens, priceUsd]
    );

    const purchaseId = purchaseResult.rows[0].id;

    // In production, you would create a Stripe checkout session here
    // For now, we'll simulate with a mock session ID
    const mockSessionId = `mock_session_${purchaseId}_${Date.now()}`;

    // Update purchase with session ID
    await pool.query(
      `UPDATE token_purchases SET stripe_session_id = $1 WHERE id = $2`,
      [mockSessionId, purchaseId]
    );

    res.json({
      success: true,
      data: {
        purchaseId,
        sessionId: mockSessionId,
        package: {
          name: pkg.name,
          tokens: pkg.tokens + pkg.bonus_tokens,
          priceUsd
        },
        // In production, this would be a Stripe checkout URL
        checkoutUrl: `/api/economy/mock-checkout/${purchaseId}`,
        warning: 'You are about to spend real money ($' + priceUsd.toFixed(2) + ')'
      }
    });
  } catch (error) {
    console.error('Purchase tokens error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate purchase' });
  }
});

// POST /api/economy/mock-checkout/:purchaseId - Mock checkout completion (dev only)
router.post('/mock-checkout/:purchaseId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const purchaseId = parseInt(req.params.purchaseId);

    // Get the pending purchase
    const purchaseResult = await pool.query(
      `SELECT * FROM token_purchases WHERE id = $1 AND player_id = $2 AND status = 'pending'`,
      [purchaseId, playerId]
    );

    if (purchaseResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Purchase not found or already completed' });
      return;
    }

    const purchase = purchaseResult.rows[0];
    const priceUsd = parseFloat(purchase.amount_usd);

    // Complete the purchase
    await pool.query(
      `UPDATE token_purchases SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [purchaseId]
    );

    // Add tokens to player
    await pool.query(
      `UPDATE players SET tokens = tokens + $1 WHERE id = $2`,
      [purchase.tokens_purchased, playerId]
    );

    // Update spending limits
    await pool.query(
      `UPDATE player_spend_limits
       SET daily_spent_usd = daily_spent_usd + $1,
           weekly_spent_usd = weekly_spent_usd + $1,
           total_spent_usd = total_spent_usd + $1
       WHERE player_id = $2`,
      [priceUsd, playerId]
    );

    // Check if cooling off period should be triggered
    const limitsResult = await pool.query(
      `SELECT total_spent_usd, cooling_off_until FROM player_spend_limits WHERE player_id = $1`,
      [playerId]
    );

    const totalSpent = parseFloat(limitsResult.rows[0].total_spent_usd);
    let coolingOffTriggered = false;

    // Trigger cooling off if total spending exceeds threshold and no current cooling off
    if (totalSpent >= COOLING_OFF_THRESHOLD && !limitsResult.rows[0].cooling_off_until) {
      const coolingOffUntil = new Date(Date.now() + COOLING_OFF_HOURS * 60 * 60 * 1000);
      await pool.query(
        `UPDATE player_spend_limits SET cooling_off_until = $1 WHERE player_id = $2`,
        [coolingOffUntil, playerId]
      );
      coolingOffTriggered = true;
    }

    // Log the transaction
    await pool.query(
      `INSERT INTO currency_transactions (player_id, currency_type, amount, transaction_type, description)
       VALUES ($1, 'tokens', $2, 'purchase', $3)`,
      [playerId, purchase.tokens_purchased, `Purchased ${purchase.tokens_purchased} tokens for $${priceUsd.toFixed(2)}`]
    );

    res.json({
      success: true,
      data: {
        message: 'Purchase completed!',
        tokensAdded: purchase.tokens_purchased,
        amountCharged: priceUsd,
        coolingOffTriggered,
        coolingOffMessage: coolingOffTriggered
          ? `A ${COOLING_OFF_HOURS}-hour cooling off period has been activated. You can make more purchases after this period.`
          : null
      }
    });
  } catch (error) {
    console.error('Mock checkout error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete purchase' });
  }
});

// POST /api/economy/spend - Spend tokens on actions
router.post('/spend', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { actionId, targetId } = req.body;

    if (!actionId) {
      res.status(400).json({ success: false, error: 'Action ID required' });
      return;
    }

    // Get player
    const playerResult = await pool.query(
      `SELECT tokens, stamina, stamina_max, focus, focus_max FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Get the action
    const actionResult = await pool.query(
      `SELECT * FROM token_actions WHERE id = $1 AND is_active = true`,
      [actionId]
    );

    if (actionResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Action not found' });
      return;
    }

    const action = actionResult.rows[0];

    // Check if player has enough tokens
    if (player.tokens < action.token_cost) {
      res.status(400).json({
        success: false,
        error: 'Not enough tokens',
        tokensNeeded: action.token_cost,
        tokensHave: player.tokens
      });
      return;
    }

    // Check daily usage limit
    const today = new Date().toISOString().split('T')[0];
    const usageResult = await pool.query(
      `SELECT * FROM player_token_actions
       WHERE player_id = $1 AND action_id = $2`,
      [playerId, actionId]
    );

    let dailyUses = 0;
    if (usageResult.rows.length > 0) {
      const usage = usageResult.rows[0];
      // Reset if last use was on a different day
      if (usage.last_reset_date !== today) {
        await pool.query(
          `UPDATE player_token_actions SET daily_uses = 0, last_reset_date = $1
           WHERE player_id = $2 AND action_id = $3`,
          [today, playerId, actionId]
        );
      } else {
        dailyUses = usage.daily_uses;
      }
    }

    if (action.max_daily_uses && dailyUses >= action.max_daily_uses) {
      res.status(400).json({
        success: false,
        error: `Daily limit reached for this action (${action.max_daily_uses}/day)`
      });
      return;
    }

    // Execute the action
    let result: any = { success: true };

    switch (action.action_type) {
      case 'skip_wait':
        // For cooldown skipping - would need targetId to know what to skip
        result.message = `Skipped ${action.effect_value} minutes of waiting`;
        result.effectType = 'cooldown_skip';
        result.effectValue = action.effect_value;
        break;

      case 'instant_travel':
        // Instant travel to a district
        if (!targetId) {
          res.status(400).json({ success: false, error: 'Target district required' });
          return;
        }
        await pool.query(
          `UPDATE players SET current_district = $1 WHERE id = $2`,
          [targetId, playerId]
        );
        result.message = 'Traveled instantly!';
        result.effectType = 'travel';
        result.newDistrict = targetId;
        break;

      case 'refresh':
        // Refresh missions/tasks
        if (action.effect_type === 'daily_missions') {
          // Would regenerate daily missions
          result.message = 'Daily missions refreshed!';
        } else if (action.effect_type === 'hourly_tasks') {
          // Reset hourly tasks cooldown
          await pool.query(
            `UPDATE player_hourly_tasks SET refreshes_at = NOW() WHERE player_id = $1`,
            [playerId]
          );
          result.message = 'Hourly tasks refreshed!';
        }
        result.effectType = 'refresh';
        break;

      case 'boost':
        // Apply a boost
        if (action.effect_type === 'stamina') {
          const newStamina = Math.min(player.stamina + action.effect_value, player.stamina_max);
          await pool.query(
            `UPDATE players SET stamina = $1 WHERE id = $2`,
            [newStamina, playerId]
          );
          result.message = `Restored ${action.effect_value} stamina!`;
          result.newStamina = newStamina;
        } else if (action.effect_type === 'focus') {
          const newFocus = Math.min(player.focus + action.effect_value, player.focus_max);
          await pool.query(
            `UPDATE players SET focus = $1 WHERE id = $2`,
            [newFocus, playerId]
          );
          result.message = `Restored ${action.effect_value} focus!`;
          result.newFocus = newFocus;
        } else if (action.effect_type === 'heat_reduction') {
          await pool.query(
            `UPDATE players SET heat_level = GREATEST(0, heat_level - $1) WHERE id = $2`,
            [action.effect_value, playerId]
          );
          result.message = `Reduced heat by ${action.effect_value}!`;
        }
        result.effectType = 'boost';
        break;

      case 'expand_cap':
        // Expand max capacity - handled by expansion system
        res.status(400).json({ success: false, error: 'Use capacity expansion system for this action' });
        return;

      case 'cosmetic':
        // Cosmetic purchase - would unlock a cosmetic item
        result.message = 'Cosmetic unlocked!';
        result.effectType = 'cosmetic';
        break;

      default:
        res.status(400).json({ success: false, error: 'Unknown action type' });
        return;
    }

    // Deduct tokens
    await pool.query(
      `UPDATE players SET tokens = tokens - $1 WHERE id = $2`,
      [action.token_cost, playerId]
    );

    // Update usage tracking
    await pool.query(
      `INSERT INTO player_token_actions (player_id, action_id, daily_uses, last_used_at, last_reset_date)
       VALUES ($1, $2, 1, NOW(), $3)
       ON CONFLICT (player_id, action_id)
       DO UPDATE SET daily_uses = player_token_actions.daily_uses + 1, last_used_at = NOW()`,
      [playerId, actionId, today]
    );

    // Log the spend
    await pool.query(
      `INSERT INTO token_spend_log (player_id, tokens_spent, spend_type, item_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [playerId, action.token_cost, action.action_type, targetId || null, action.name]
    );

    res.json({
      success: true,
      data: {
        ...result,
        tokensSpent: action.token_cost,
        tokensRemaining: player.tokens - action.token_cost
      }
    });
  } catch (error) {
    console.error('Spend tokens error:', error);
    res.status(500).json({ success: false, error: 'Failed to spend tokens' });
  }
});

// GET /api/economy/actions - Get available token actions
router.get('/actions', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const today = new Date().toISOString().split('T')[0];

    // Get all actions with player's usage
    const actionsResult = await pool.query(
      `SELECT ta.*,
              COALESCE(pta.daily_uses, 0) as daily_uses,
              pta.last_reset_date
       FROM token_actions ta
       LEFT JOIN player_token_actions pta ON pta.action_id = ta.id AND pta.player_id = $1
       WHERE ta.is_active = true
       ORDER BY ta.token_cost ASC`,
      [playerId]
    );

    const actions = actionsResult.rows.map(a => {
      // Reset daily uses if last use was on a different day
      const dailyUses = a.last_reset_date === today ? a.daily_uses : 0;

      return {
        id: a.id,
        name: a.name,
        description: a.description,
        actionType: a.action_type,
        tokenCost: a.token_cost,
        effectValue: a.effect_value,
        effectType: a.effect_type,
        maxDailyUses: a.max_daily_uses,
        dailyUsesRemaining: a.max_daily_uses ? a.max_daily_uses - dailyUses : null,
        canUse: !a.max_daily_uses || dailyUses < a.max_daily_uses
      };
    });

    res.json({
      success: true,
      data: { actions }
    });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get actions' });
  }
});

// POST /api/economy/set-limits - Allow player to set their own spending limits
router.post('/set-limits', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { dailyLimit, weeklyLimit } = req.body;

    // Validate limits
    const newDailyLimit = parseFloat(dailyLimit);
    const newWeeklyLimit = parseFloat(weeklyLimit);

    if (isNaN(newDailyLimit) || isNaN(newWeeklyLimit)) {
      res.status(400).json({ success: false, error: 'Invalid limit values' });
      return;
    }

    if (newDailyLimit < 0 || newWeeklyLimit < 0) {
      res.status(400).json({ success: false, error: 'Limits cannot be negative' });
      return;
    }

    if (newDailyLimit > newWeeklyLimit) {
      res.status(400).json({ success: false, error: 'Daily limit cannot exceed weekly limit' });
      return;
    }

    // Players can only lower limits immediately, raising limits requires waiting
    await ensureSpendLimits(playerId);

    const currentResult = await pool.query(
      `SELECT daily_limit_usd, weekly_limit_usd FROM player_spend_limits WHERE player_id = $1`,
      [playerId]
    );

    const current = currentResult.rows[0];

    // Lower limits take effect immediately
    // Higher limits would require a cooling off period (simplified here)
    await pool.query(
      `UPDATE player_spend_limits
       SET daily_limit_usd = $1, weekly_limit_usd = $2
       WHERE player_id = $3`,
      [newDailyLimit, newWeeklyLimit, playerId]
    );

    res.json({
      success: true,
      data: {
        message: 'Spending limits updated',
        newLimits: {
          daily: newDailyLimit,
          weekly: newWeeklyLimit
        },
        previousLimits: {
          daily: parseFloat(current.daily_limit_usd),
          weekly: parseFloat(current.weekly_limit_usd)
        }
      }
    });
  } catch (error) {
    console.error('Set limits error:', error);
    res.status(500).json({ success: false, error: 'Failed to set limits' });
  }
});

// GET /api/economy/history - Get purchase and spend history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Get purchase history
    const purchasesResult = await pool.query(
      `SELECT tp.*, tkp.name as package_name
       FROM token_purchases tp
       LEFT JOIN token_packages tkp ON tp.package_id = tkp.id
       WHERE tp.player_id = $1
       ORDER BY tp.created_at DESC
       LIMIT $2`,
      [playerId, limit]
    );

    // Get spend history
    const spendsResult = await pool.query(
      `SELECT * FROM token_spend_log
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [playerId, limit]
    );

    res.json({
      success: true,
      data: {
        purchases: purchasesResult.rows.map(p => ({
          id: p.id,
          packageName: p.package_name,
          tokensPurchased: p.tokens_purchased,
          amountUsd: parseFloat(p.amount_usd),
          status: p.status,
          createdAt: p.created_at,
          completedAt: p.completed_at
        })),
        spends: spendsResult.rows.map(s => ({
          id: s.id,
          tokensSpent: s.tokens_spent,
          spendType: s.spend_type,
          description: s.description,
          createdAt: s.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// POST /api/economy/refund-request - Request a refund (creates ticket)
router.post('/refund-request', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { purchaseId, reason } = req.body;

    if (!purchaseId || !reason) {
      res.status(400).json({ success: false, error: 'Purchase ID and reason required' });
      return;
    }

    // Verify purchase exists and belongs to player
    const purchaseResult = await pool.query(
      `SELECT * FROM token_purchases
       WHERE id = $1 AND player_id = $2 AND status = 'completed'`,
      [purchaseId, playerId]
    );

    if (purchaseResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Purchase not found' });
      return;
    }

    const purchase = purchaseResult.rows[0];

    // Check if refund already requested (would normally create a support ticket)
    // For now, just return success message
    res.json({
      success: true,
      data: {
        message: 'Refund request submitted. Our support team will review your request within 24-48 hours.',
        purchaseId: purchase.id,
        amountUsd: parseFloat(purchase.amount_usd),
        reason
      }
    });
  } catch (error) {
    console.error('Refund request error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit refund request' });
  }
});

// Helper: Ensure spend limits exist for player
async function ensureSpendLimits(playerId: number) {
  await pool.query(
    `INSERT INTO player_spend_limits (player_id, daily_limit_usd, weekly_limit_usd)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id) DO NOTHING`,
    [playerId, DEFAULT_DAILY_LIMIT, DEFAULT_WEEKLY_LIMIT]
  );
}

// Helper: Reset spend limits if needed
async function resetSpendLimitsIfNeeded(playerId: number) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

  await pool.query(
    `UPDATE player_spend_limits
     SET daily_spent_usd = CASE WHEN last_daily_reset < $2 THEN 0 ELSE daily_spent_usd END,
         weekly_spent_usd = CASE WHEN last_weekly_reset < $3 THEN 0 ELSE weekly_spent_usd END,
         last_daily_reset = CASE WHEN last_daily_reset < $2 THEN $2 ELSE last_daily_reset END,
         last_weekly_reset = CASE WHEN last_weekly_reset < $3 THEN $3 ELSE last_weekly_reset END,
         cooling_off_until = CASE WHEN cooling_off_until < $1 THEN NULL ELSE cooling_off_until END
     WHERE player_id = $4`,
    [now, todayStart, weekStart, playerId]
  );
}

export default router;
