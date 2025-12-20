import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// =====================================================
// PHASE 7: PREMIUM SHOP & MONETIZATION (2091)
// =====================================================

// GET /api/premium-shop - Get full shop catalog
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player currencies
    const playerResult = await pool.query(`
      SELECT synth_credits, hydra_coins, level FROM players WHERE id = $1
    `, [playerId]);
    const player = playerResult.rows[0];

    // Get categories
    const categoriesResult = await pool.query(`
      SELECT * FROM premium_shop_categories WHERE is_active = true ORDER BY sort_order
    `);

    // Get active items
    const itemsResult = await pool.query(`
      SELECT psi.*, psc.category_key, psc.name as category_name
      FROM premium_shop_items psi
      JOIN premium_shop_categories psc ON psi.category_id = psc.id
      WHERE psi.is_active = true
      AND (psi.available_from IS NULL OR psi.available_from <= NOW())
      AND (psi.available_until IS NULL OR psi.available_until > NOW())
      AND (psi.stock_limit IS NULL OR psi.current_stock > 0)
      ORDER BY psi.is_featured DESC, psc.sort_order, psi.rarity DESC
    `);

    // Get player's purchase counts for limited items
    const purchasesResult = await pool.query(`
      SELECT item_key, COUNT(*) as count
      FROM premium_purchases
      WHERE player_id = $1
      GROUP BY item_key
    `, [playerId]);

    const purchaseCounts = new Map(
      purchasesResult.rows.map(p => [p.item_key, parseInt(p.count)])
    );

    // Group items by category
    const itemsByCategory: Record<string, any[]> = {};
    for (const item of itemsResult.rows) {
      const playerPurchases = purchaseCounts.get(item.item_key) || 0;
      const canAffordHydra = !item.price_hydra || player.hydra_coins >= item.price_hydra;
      const canAffordSynth = !item.price_synth || player.synth_credits >= item.price_synth;
      const meetsLevel = player.level >= (item.required_level || 1);
      const withinLimit = !item.purchase_limit || playerPurchases < item.purchase_limit;

      const formattedItem = {
        id: item.id,
        itemKey: item.item_key,
        name: item.name,
        description: item.description,
        loreText: item.lore_text,
        priceHydra: item.price_hydra,
        priceSynth: item.price_synth,
        originalPriceHydra: item.original_price_hydra,
        itemType: item.item_type,
        rewardData: item.reward_data,
        stockLimit: item.stock_limit,
        currentStock: item.current_stock,
        purchaseLimit: item.purchase_limit,
        playerPurchases,
        availableUntil: item.available_until,
        requiredLevel: item.required_level,
        requiredFaction: item.required_faction,
        icon: item.icon,
        rarity: item.rarity,
        isFeatured: item.is_featured,
        isLimited: item.is_limited,
        canPurchase: canAffordHydra && canAffordSynth && meetsLevel && withinLimit,
        canAfford: canAffordHydra && canAffordSynth,
        meetsRequirements: meetsLevel && withinLimit
      };

      if (!itemsByCategory[item.category_key]) {
        itemsByCategory[item.category_key] = [];
      }
      itemsByCategory[item.category_key].push(formattedItem);
    }

    res.json({
      success: true,
      data: {
        currencies: {
          synthCredits: player.synth_credits,
          hydraCoins: player.hydra_coins
        },
        categories: categoriesResult.rows.map(c => ({
          id: c.id,
          categoryKey: c.category_key,
          name: c.name,
          description: c.description,
          icon: c.icon,
          itemCount: (itemsByCategory[c.category_key] || []).length
        })),
        items: itemsResult.rows.map(item => {
          const playerPurchases = purchaseCounts.get(item.item_key) || 0;
          return {
            id: item.id,
            itemKey: item.item_key,
            categoryKey: item.category_key,
            name: item.name,
            description: item.description,
            priceHydra: item.price_hydra,
            priceSynth: item.price_synth,
            itemType: item.item_type,
            icon: item.icon,
            rarity: item.rarity,
            isFeatured: item.is_featured,
            purchaseLimit: item.purchase_limit,
            playerPurchases
          };
        }),
        itemsByCategory,
        featuredItems: itemsResult.rows.filter(i => i.is_featured).map(i => i.item_key)
      }
    });
  } catch (error) {
    console.error('Error fetching premium shop:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shop' });
  }
});

// GET /api/premium-shop/item/:key - Get specific item details
router.get('/item/:key', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const itemKey = req.params.key;

    const itemResult = await pool.query(`
      SELECT psi.*, psc.category_key, psc.name as category_name
      FROM premium_shop_items psi
      JOIN premium_shop_categories psc ON psi.category_id = psc.id
      WHERE psi.item_key = $1
    `, [itemKey]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // Get player info
    const playerResult = await pool.query(`
      SELECT synth_credits, hydra_coins, level FROM players WHERE id = $1
    `, [playerId]);
    const player = playerResult.rows[0];

    // Get player's purchases of this item
    const purchasesResult = await pool.query(`
      SELECT COUNT(*) as count FROM premium_purchases
      WHERE player_id = $1 AND item_key = $2
    `, [playerId, itemKey]);

    const playerPurchases = parseInt(purchasesResult.rows[0].count);

    res.json({
      success: true,
      data: {
        item: {
          id: item.id,
          itemKey: item.item_key,
          categoryKey: item.category_key,
          categoryName: item.category_name,
          name: item.name,
          description: item.description,
          loreText: item.lore_text,
          priceHydra: item.price_hydra,
          priceSynth: item.price_synth,
          originalPriceHydra: item.original_price_hydra,
          itemType: item.item_type,
          rewardData: item.reward_data,
          stockLimit: item.stock_limit,
          currentStock: item.current_stock,
          purchaseLimit: item.purchase_limit,
          availableFrom: item.available_from,
          availableUntil: item.available_until,
          requiredLevel: item.required_level,
          requiredFaction: item.required_faction,
          icon: item.icon,
          rarity: item.rarity,
          isFeatured: item.is_featured,
          isLimited: item.is_limited
        },
        playerInfo: {
          synthCredits: player.synth_credits,
          hydraCoins: player.hydra_coins,
          level: player.level,
          purchasesOfItem: playerPurchases,
          canAffordHydra: !item.price_hydra || player.hydra_coins >= item.price_hydra,
          canAffordSynth: !item.price_synth || player.synth_credits >= item.price_synth,
          meetsLevel: player.level >= (item.required_level || 1),
          withinLimit: !item.purchase_limit || playerPurchases < item.purchase_limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch item' });
  }
});

// POST /api/premium-shop/purchase/:key - Purchase an item
router.post('/purchase/:key', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const itemKey = req.params.key;
    const { payWithSynth = false } = req.body;

    // Get item
    const itemResult = await pool.query(`
      SELECT * FROM premium_shop_items WHERE item_key = $1 AND is_active = true
    `, [itemKey]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found or inactive' });
    }

    const item = itemResult.rows[0];

    // Check availability
    if (item.available_from && new Date(item.available_from) > new Date()) {
      return res.status(400).json({ success: false, error: 'Item not yet available' });
    }
    if (item.available_until && new Date(item.available_until) < new Date()) {
      return res.status(400).json({ success: false, error: 'Item no longer available' });
    }

    // Check stock
    if (item.stock_limit && item.current_stock <= 0) {
      return res.status(400).json({ success: false, error: 'Item out of stock' });
    }

    // Get player info
    const playerResult = await pool.query(`
      SELECT synth_credits, hydra_coins, level, cash, nuclear_cells, nuclear_cells_max, xp
      FROM players WHERE id = $1
    `, [playerId]);
    const player = playerResult.rows[0];

    // Check level requirement
    if (item.required_level && player.level < item.required_level) {
      return res.status(400).json({
        success: false,
        error: `Requires level ${item.required_level}`
      });
    }

    // Check purchase limit
    if (item.purchase_limit) {
      const countResult = await pool.query(`
        SELECT COUNT(*) as count FROM premium_purchases
        WHERE player_id = $1 AND item_key = $2
      `, [playerId, itemKey]);

      if (parseInt(countResult.rows[0].count) >= item.purchase_limit) {
        return res.status(400).json({ success: false, error: 'Purchase limit reached' });
      }
    }

    // Determine payment
    let pricePaid = { hydra: 0, synth: 0 };
    if (payWithSynth && item.price_synth > 0) {
      if (player.synth_credits < item.price_synth) {
        return res.status(400).json({ success: false, error: 'Insufficient Synth Credits' });
      }
      pricePaid.synth = item.price_synth;
    } else if (item.price_hydra > 0) {
      if (player.hydra_coins < item.price_hydra) {
        return res.status(400).json({ success: false, error: 'Insufficient HydraCoins' });
      }
      pricePaid.hydra = item.price_hydra;
    }

    await pool.query('BEGIN');

    // Deduct payment
    if (pricePaid.hydra > 0) {
      await pool.query(`
        UPDATE players SET hydra_coins = hydra_coins - $1 WHERE id = $2
      `, [pricePaid.hydra, playerId]);
    }
    if (pricePaid.synth > 0) {
      await pool.query(`
        UPDATE players SET synth_credits = synth_credits - $1 WHERE id = $2
      `, [pricePaid.synth, playerId]);
    }

    // Apply rewards
    const rewards = item.reward_data || {};
    const appliedRewards: string[] = [];

    if (rewards.cash) {
      await pool.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [rewards.cash, playerId]);
      appliedRewards.push(`$${rewards.cash.toLocaleString()} Credits`);
    }
    if (rewards.xp) {
      await pool.query(`UPDATE players SET xp = xp + $1 WHERE id = $2`, [rewards.xp, playerId]);
      appliedRewards.push(`${rewards.xp.toLocaleString()} XP`);
    }
    if (rewards.cells) {
      await pool.query(`
        UPDATE players SET nuclear_cells = LEAST(nuclear_cells_max, nuclear_cells + $1) WHERE id = $2
      `, [rewards.cells, playerId]);
      appliedRewards.push(`${rewards.cells} Nuclear Cells`);
    }
    if (rewards.synth_credits) {
      await pool.query(`UPDATE players SET synth_credits = synth_credits + $1 WHERE id = $2`, [rewards.synth_credits, playerId]);
      appliedRewards.push(`${rewards.synth_credits} Synth Credits`);
    }
    if (rewards.hydra_coins) {
      await pool.query(`UPDATE players SET hydra_coins = hydra_coins + $1 WHERE id = $2`, [rewards.hydra_coins, playerId]);
      appliedRewards.push(`${rewards.hydra_coins} HydraCoins`);
    }

    // Handle boosters
    if (rewards.boost_type) {
      const durationHours = rewards.duration_hours || 1;
      const durationMinutes = rewards.duration_minutes || (durationHours * 60);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

      await pool.query(`
        INSERT INTO player_active_boosters (player_id, booster_type, multiplier, expires_at, source)
        VALUES ($1, $2, $3, $4, 'shop')
      `, [playerId, rewards.boost_type, rewards.multiplier || 1, expiresAt]);

      appliedRewards.push(`${rewards.boost_type.toUpperCase()} Boost (${durationMinutes}min)`);
    }

    // Handle cosmetics
    if (rewards.cosmetic_id || item.item_type === 'cosmetic') {
      const cosmeticId = rewards.cosmetic_id || item.item_key;
      await pool.query(`
        INSERT INTO player_cosmetics (player_id, cosmetic_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [playerId, cosmeticId]);
      appliedRewards.push(`Cosmetic: ${item.name}`);
    }

    // Update stock
    if (item.stock_limit) {
      await pool.query(`
        UPDATE premium_shop_items SET current_stock = current_stock - 1 WHERE id = $1
      `, [item.id]);
    }

    // Record purchase
    await pool.query(`
      INSERT INTO premium_purchases (player_id, item_id, item_key, price_hydra, price_synth, reward_data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [playerId, item.id, itemKey, pricePaid.hydra, pricePaid.synth, rewards]);

    await pool.query('COMMIT');

    // Get updated balances
    const updatedResult = await pool.query(`
      SELECT synth_credits, hydra_coins FROM players WHERE id = $1
    `, [playerId]);

    res.json({
      success: true,
      data: {
        message: `Purchased ${item.name}!`,
        itemName: item.name,
        pricePaid,
        rewards: appliedRewards,
        newBalances: {
          synthCredits: updatedResult.rows[0].synth_credits,
          hydraCoins: updatedResult.rows[0].hydra_coins
        }
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error purchasing item:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase item' });
  }
});

// GET /api/premium-shop/coin-packages - Get HydraCoin purchase packages
router.get('/coin-packages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hydra_coin_packages WHERE is_active = true ORDER BY price_usd ASC
    `);

    res.json({
      success: true,
      data: {
        packages: result.rows.map(p => ({
          id: p.id,
          packageKey: p.package_key,
          name: p.name,
          description: p.description,
          coinAmount: p.coin_amount,
          bonusCoins: p.bonus_coins,
          bonusSynthCredits: p.bonus_synth_credits,
          totalCoins: p.coin_amount + p.bonus_coins,
          priceUsd: parseFloat(p.price_usd),
          isFeatured: p.is_featured,
          isBestValue: p.is_best_value,
          discountPercent: p.discount_percent,
          icon: p.icon
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching coin packages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch packages' });
  }
});

// GET /api/premium-shop/boosters - Get player's active boosters
router.get('/boosters', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Clean up expired boosters first
    await pool.query(`
      UPDATE player_active_boosters SET is_active = false
      WHERE player_id = $1 AND expires_at < NOW() AND is_active = true
    `, [playerId]);

    // Get active boosters
    const result = await pool.query(`
      SELECT *, EXTRACT(EPOCH FROM (expires_at - NOW())) * 1000 as time_remaining
      FROM player_active_boosters
      WHERE player_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY expires_at ASC
    `, [playerId]);

    res.json({
      success: true,
      data: {
        boosters: result.rows.map(b => ({
          id: b.id,
          boosterType: b.booster_type,
          multiplier: parseFloat(b.multiplier),
          activatedAt: b.activated_at,
          expiresAt: b.expires_at,
          timeRemaining: Math.max(0, b.time_remaining),
          source: b.source
        })),
        activeEffects: {
          xpMultiplier: result.rows.filter(b => b.booster_type === 'xp').reduce((max, b) => Math.max(max, parseFloat(b.multiplier)), 1),
          cashMultiplier: result.rows.filter(b => b.booster_type === 'cash').reduce((max, b) => Math.max(max, parseFloat(b.multiplier)), 1),
          heatReduction: result.rows.filter(b => b.booster_type === 'heat_reduction').reduce((max, b) => Math.max(max, parseFloat(b.multiplier)), 1),
          cellRegenMultiplier: result.rows.filter(b => b.booster_type === 'cell_regen').reduce((max, b) => Math.max(max, parseFloat(b.multiplier)), 1)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching boosters:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch boosters' });
  }
});

// GET /api/premium-shop/daily-login - Get daily login status
router.get('/daily-login', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get or create login tracking
    let loginResult = await pool.query(`
      SELECT * FROM player_daily_logins WHERE player_id = $1
    `, [playerId]);

    if (loginResult.rows.length === 0) {
      await pool.query(`
        INSERT INTO player_daily_logins (player_id, last_login_date, current_cycle_day)
        VALUES ($1, CURRENT_DATE, 1)
      `, [playerId]);
      loginResult = await pool.query(`
        SELECT * FROM player_daily_logins WHERE player_id = $1
      `, [playerId]);
    }

    const loginData = loginResult.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = loginData.last_login_date?.toISOString().split('T')[0];
    const lastClaim = loginData.last_claim_date?.toISOString().split('T')[0];

    const canClaim = lastClaim !== today;

    // Get all rewards
    const rewardsResult = await pool.query(`
      SELECT * FROM daily_login_rewards ORDER BY day_number
    `);

    // Check if player has premium battle pass
    const premiumResult = await pool.query(`
      SELECT is_premium FROM player_battle_pass pbp
      JOIN seasons s ON pbp.season_id = s.id
      WHERE pbp.player_id = $1 AND s.is_active = true
    `, [playerId]);
    const hasPremium = premiumResult.rows[0]?.is_premium || false;

    res.json({
      success: true,
      data: {
        currentStreak: loginData.current_streak,
        longestStreak: loginData.longest_streak,
        totalLogins: loginData.total_logins,
        currentCycleDay: loginData.current_cycle_day,
        canClaim,
        lastClaimDate: lastClaim,
        hasPremium,
        rewards: rewardsResult.rows.map(r => ({
          dayNumber: r.day_number,
          rewardType: r.reward_type,
          rewardValue: r.reward_value,
          rewardName: r.reward_name,
          rewardIcon: r.reward_icon,
          isClaimed: r.day_number < loginData.current_cycle_day || (r.day_number === loginData.current_cycle_day && !canClaim),
          isToday: r.day_number === loginData.current_cycle_day,
          premiumBonusType: r.premium_bonus_type,
          premiumBonusValue: r.premium_bonus_value
        })),
        todayReward: rewardsResult.rows.find(r => r.day_number === loginData.current_cycle_day)
      }
    });
  } catch (error) {
    console.error('Error fetching daily login:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch login status' });
  }
});

// POST /api/premium-shop/daily-login/claim - Claim daily login reward
router.post('/daily-login/claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get login data
    const loginResult = await pool.query(`
      SELECT * FROM player_daily_logins WHERE player_id = $1
    `, [playerId]);

    if (loginResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Login tracking not initialized' });
    }

    const loginData = loginResult.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastClaim = loginData.last_claim_date?.toISOString().split('T')[0];

    if (lastClaim === today) {
      return res.status(400).json({ success: false, error: 'Already claimed today' });
    }

    // Get today's reward
    const rewardResult = await pool.query(`
      SELECT * FROM daily_login_rewards WHERE day_number = $1
    `, [loginData.current_cycle_day]);

    if (rewardResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Reward not found' });
    }

    const reward = rewardResult.rows[0];

    // Check premium status
    const premiumResult = await pool.query(`
      SELECT is_premium FROM player_battle_pass pbp
      JOIN seasons s ON pbp.season_id = s.id
      WHERE pbp.player_id = $1 AND s.is_active = true
    `, [playerId]);
    const hasPremium = premiumResult.rows[0]?.is_premium || false;

    await pool.query('BEGIN');

    // Apply reward
    const appliedRewards: string[] = [];
    let totalValue = reward.reward_value;

    switch (reward.reward_type) {
      case 'cash':
        await pool.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [reward.reward_value, playerId]);
        appliedRewards.push(`$${reward.reward_value.toLocaleString()}`);
        break;
      case 'xp':
        await pool.query(`UPDATE players SET xp = xp + $1 WHERE id = $2`, [reward.reward_value, playerId]);
        appliedRewards.push(`${reward.reward_value} XP`);
        break;
      case 'cells':
        await pool.query(`UPDATE players SET nuclear_cells = LEAST(nuclear_cells_max, nuclear_cells + $1) WHERE id = $2`, [reward.reward_value, playerId]);
        appliedRewards.push(`${reward.reward_value} Cells`);
        break;
      case 'synth':
        await pool.query(`UPDATE players SET synth_credits = synth_credits + $1 WHERE id = $2`, [reward.reward_value, playerId]);
        appliedRewards.push(`${reward.reward_value} Synth Credits`);
        break;
    }

    // Apply premium bonus if applicable
    let premiumBonus = null;
    if (hasPremium && reward.is_premium_bonus && reward.premium_bonus_type) {
      premiumBonus = {
        type: reward.premium_bonus_type,
        value: reward.premium_bonus_value
      };

      switch (reward.premium_bonus_type) {
        case 'cash':
          await pool.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [reward.premium_bonus_value, playerId]);
          appliedRewards.push(`+$${reward.premium_bonus_value.toLocaleString()} (Premium)`);
          break;
        case 'xp':
          await pool.query(`UPDATE players SET xp = xp + $1 WHERE id = $2`, [reward.premium_bonus_value, playerId]);
          appliedRewards.push(`+${reward.premium_bonus_value} XP (Premium)`);
          break;
        case 'cells':
          await pool.query(`UPDATE players SET nuclear_cells = LEAST(nuclear_cells_max, nuclear_cells + $1) WHERE id = $2`, [reward.premium_bonus_value, playerId]);
          appliedRewards.push(`+${reward.premium_bonus_value} Cells (Premium)`);
          break;
        case 'synth':
          await pool.query(`UPDATE players SET synth_credits = synth_credits + $1 WHERE id = $2`, [reward.premium_bonus_value, playerId]);
          appliedRewards.push(`+${reward.premium_bonus_value} Synth (Premium)`);
          break;
      }
    }

    // Update login tracking
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastLoginStr = loginData.last_login_date?.toISOString().split('T')[0];

    let newStreak = loginData.current_streak;
    if (lastLoginStr === yesterdayStr) {
      newStreak += 1;
    } else if (lastLoginStr !== today) {
      newStreak = 1;
    }

    const nextCycleDay = loginData.current_cycle_day >= 28 ? 1 : loginData.current_cycle_day + 1;

    await pool.query(`
      UPDATE player_daily_logins
      SET current_streak = $1,
          longest_streak = GREATEST(longest_streak, $1),
          total_logins = total_logins + 1,
          last_login_date = CURRENT_DATE,
          last_claim_date = CURRENT_DATE,
          current_cycle_day = $2
      WHERE player_id = $3
    `, [newStreak, nextCycleDay, playerId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Claimed Day ${loginData.current_cycle_day} reward!`,
        dayNumber: loginData.current_cycle_day,
        rewards: appliedRewards,
        baseReward: {
          type: reward.reward_type,
          value: reward.reward_value,
          name: reward.reward_name
        },
        premiumBonus,
        newStreak,
        nextDay: nextCycleDay
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error claiming daily reward:', error);
    res.status(500).json({ success: false, error: 'Failed to claim reward' });
  }
});

// GET /api/premium-shop/purchase-history - Get purchase history
router.get('/purchase-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT pp.*, psi.name, psi.icon, psi.rarity
      FROM premium_purchases pp
      LEFT JOIN premium_shop_items psi ON pp.item_id = psi.id
      WHERE pp.player_id = $1
      ORDER BY pp.purchased_at DESC
      LIMIT 50
    `, [playerId]);

    res.json({
      success: true,
      data: {
        purchases: result.rows.map(p => ({
          id: p.id,
          itemKey: p.item_key,
          itemName: p.name,
          icon: p.icon,
          rarity: p.rarity,
          priceHydra: p.price_hydra,
          priceSynth: p.price_synth,
          quantity: p.quantity,
          rewardData: p.reward_data,
          purchasedAt: p.purchased_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// Helper: Get player's active booster multipliers (for use by other routes)
export async function getPlayerBoosters(playerId: number): Promise<{
  xpMultiplier: number;
  cashMultiplier: number;
  heatReduction: number;
  cellRegenMultiplier: number;
}> {
  try {
    const result = await pool.query(`
      SELECT booster_type, MAX(multiplier) as max_multiplier
      FROM player_active_boosters
      WHERE player_id = $1 AND is_active = true AND expires_at > NOW()
      GROUP BY booster_type
    `, [playerId]);

    const boosters: Record<string, number> = {};
    for (const row of result.rows) {
      boosters[row.booster_type] = parseFloat(row.max_multiplier);
    }

    return {
      xpMultiplier: boosters['xp'] || 1,
      cashMultiplier: boosters['cash'] || 1,
      heatReduction: boosters['heat_reduction'] || 1,
      cellRegenMultiplier: boosters['cell_regen'] || 1
    };
  } catch (error) {
    console.error('Error getting player boosters:', error);
    return { xpMultiplier: 1, cashMultiplier: 1, heatReduction: 1, cellRegenMultiplier: 1 };
  }
}

// Process expired boosters - called periodically
export async function processExpiredBoosters(): Promise<void> {
  try {
    const result = await pool.query(`
      UPDATE player_active_boosters
      SET is_active = false
      WHERE is_active = true AND expires_at < NOW()
      RETURNING player_id, booster_type
    `);

    if (result.rows.length > 0) {
      console.log(`[Premium Shop] Expired ${result.rows.length} boosters`);
    }
  } catch (error) {
    console.error('[Premium Shop] Error processing expired boosters:', error);
  }
}

export default router;
