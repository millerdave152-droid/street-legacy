import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// =====================================================
// PHASE 5: NUCLEAR CELLS ENERGY SYSTEM
// =====================================================

// Helper: Calculate cells to regen based on time passed
function calculateRegenAmount(
  lastRegen: Date,
  regenRate: number,
  regenInterval: number,
  maxCells: number,
  currentCells: number
): { amount: number; ticksPassed: number } {
  const now = new Date();
  const msSinceRegen = now.getTime() - lastRegen.getTime();
  const ticksPassed = Math.floor(msSinceRegen / (regenInterval * 1000));

  if (ticksPassed <= 0) return { amount: 0, ticksPassed: 0 };

  const potentialRegen = ticksPassed * regenRate;
  const actualRegen = Math.min(potentialRegen, maxCells - currentCells);

  return { amount: Math.max(0, actualRegen), ticksPassed };
}

// Helper: Apply passive regen if needed
async function applyPassiveRegen(playerId: number): Promise<number> {
  // Get player's current state and reactor
  const playerResult = await pool.query(`
    SELECT
      p.nuclear_cells, p.nuclear_cells_max, p.last_cell_regen,
      pr.regen_rate, pr.regen_interval_seconds, pr.condition_percent,
      rt.base_regen_rate, rt.regen_interval_seconds as default_interval
    FROM players p
    LEFT JOIN player_reactors pr ON p.id = pr.player_id
    LEFT JOIN reactor_types rt ON pr.reactor_type = rt.type_key
    WHERE p.id = $1
  `, [playerId]);

  if (playerResult.rows.length === 0) return 0;

  const player = playerResult.rows[0];
  const currentCells = player.nuclear_cells || 100;
  const maxCells = player.nuclear_cells_max || 100;
  const lastRegen = player.last_cell_regen ? new Date(player.last_cell_regen) : new Date();

  // Use reactor stats if available, otherwise defaults
  const regenRate = player.regen_rate || player.base_regen_rate || 1;
  const regenInterval = player.regen_interval_seconds || player.default_interval || 60;

  // Apply condition modifier to regen rate
  const conditionModifier = player.condition_percent ? (0.5 + player.condition_percent / 200) : 1;
  const effectiveRegenRate = Math.max(1, Math.floor(regenRate * conditionModifier));

  const { amount, ticksPassed } = calculateRegenAmount(
    lastRegen,
    effectiveRegenRate,
    regenInterval,
    maxCells,
    currentCells
  );

  if (amount > 0) {
    // Update player's cells and last regen time
    await pool.query(`
      UPDATE players
      SET
        nuclear_cells = LEAST(nuclear_cells_max, nuclear_cells + $1),
        last_cell_regen = NOW()
      WHERE id = $2
    `, [amount, playerId]);

    // Log the regen
    await pool.query(`
      INSERT INTO cell_regen_log (player_id, regen_type, amount, source)
      VALUES ($1, 'passive', $2, 'Reactor passive regeneration')
    `, [playerId, amount]);
  }

  return amount;
}

// GET /api/nuclear-cells/status - Get current cell status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Apply any pending regen first
    const regenApplied = await applyPassiveRegen(playerId);

    // Get full status
    const result = await pool.query(`
      SELECT
        p.nuclear_cells, p.nuclear_cells_max, p.last_cell_regen, p.level,
        pr.*,
        rt.name as reactor_name, rt.description as reactor_description,
        rt.base_regen_rate, rt.regen_interval_seconds as default_interval,
        rt.efficiency_bonus as type_efficiency, rt.icon as reactor_icon
      FROM players p
      LEFT JOIN player_reactors pr ON p.id = pr.player_id
      LEFT JOIN reactor_types rt ON pr.reactor_type = rt.type_key
      WHERE p.id = $1
    `, [playerId]);

    const player = result.rows[0];

    // Get available upgrades
    const upgradesResult = await pool.query(`
      SELECT * FROM reactor_types
      WHERE min_level <= $1
      ORDER BY purchase_price ASC
    `, [player.level]);

    // Calculate next regen
    const lastRegen = player.last_cell_regen ? new Date(player.last_cell_regen) : new Date();
    const regenInterval = player.regen_interval_seconds || player.default_interval || 60;
    const msSinceRegen = Date.now() - lastRegen.getTime();
    const msUntilNextRegen = Math.max(0, (regenInterval * 1000) - (msSinceRegen % (regenInterval * 1000)));
    const regenRate = player.regen_rate || player.base_regen_rate || 1;

    res.json({
      success: true,
      data: {
        cells: {
          cells: player.nuclear_cells || 100,
          maxCells: player.nuclear_cells_max || 100,
          lastRegen: player.last_cell_regen,
          regenRate: regenRate,
          regenIntervalSeconds: regenInterval,
          efficiency: (player.efficiency_bonus || 0) + (player.type_efficiency || 0)
        },
        reactor: player.reactor_type ? {
          id: player.id,
          playerId: playerId,
          reactorType: player.reactor_type,
          reactorName: player.reactor_name || 'Basic Cell Generator',
          maxCapacity: player.max_capacity || 100,
          regenRate: regenRate,
          regenIntervalSeconds: regenInterval,
          efficiencyBonus: player.efficiency_bonus || 0,
          isOverclocked: player.is_overclocked || false,
          overclockExpiresAt: player.overclock_expires_at,
          installedAt: player.installed_at,
          lastMaintenance: player.last_maintenance,
          conditionPercent: player.condition_percent || 100
        } : null,
        nextRegen: {
          inSeconds: Math.ceil(msUntilNextRegen / 1000),
          amount: regenRate
        },
        availableUpgrades: upgradesResult.rows.map(r => ({
          id: r.id,
          typeKey: r.type_key,
          name: r.name,
          description: r.description,
          maxCapacity: r.max_capacity,
          baseRegenRate: r.base_regen_rate,
          regenIntervalSeconds: r.regen_interval_seconds,
          efficiencyBonus: r.efficiency_bonus,
          purchasePrice: r.purchase_price,
          minLevel: r.min_level,
          minFactionRank: r.min_faction_rank,
          factionRequired: r.faction_required,
          icon: r.icon
        })),
        regenApplied
      }
    });
  } catch (error) {
    console.error('Error fetching nuclear cells status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
});

// GET /api/nuclear-cells/action-costs - Get all action cell costs
router.get('/action-costs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's efficiency bonus
    const efficiencyResult = await pool.query(`
      SELECT
        COALESCE(pr.efficiency_bonus, 0) + COALESCE(rt.efficiency_bonus, 0) as total_efficiency
      FROM players p
      LEFT JOIN player_reactors pr ON p.id = pr.player_id
      LEFT JOIN reactor_types rt ON pr.reactor_type = rt.type_key
      WHERE p.id = $1
    `, [playerId]);

    const efficiency = efficiencyResult.rows[0]?.total_efficiency || 0;

    // Get all action costs
    const costsResult = await pool.query(`
      SELECT * FROM action_cell_costs ORDER BY action_category, base_cost
    `);

    const costs = costsResult.rows.map(c => ({
      ...c,
      effectiveCost: Math.max(0, Math.floor(c.base_cost * (1 - efficiency)))
    }));

    res.json({
      success: true,
      data: {
        costs,
        playerEfficiency: efficiency,
        highRiskActions: costs.filter(c => c.is_high_risk),
        freeActions: costs.filter(c => !c.is_high_risk && c.base_cost === 0)
      }
    });
  } catch (error) {
    console.error('Error fetching action costs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch action costs' });
  }
});

// POST /api/nuclear-cells/use - Use cells for an action
router.post('/use', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { actionType, amount } = req.body;

    if (!actionType) {
      return res.status(400).json({ success: false, error: 'Action type required' });
    }

    // Apply pending regen first
    await applyPassiveRegen(playerId);

    // Get action cost info
    const costResult = await pool.query(`
      SELECT * FROM action_cell_costs WHERE action_type = $1
    `, [actionType]);

    let baseCost = amount || 0;
    let isHighRisk = false;

    if (costResult.rows.length > 0) {
      baseCost = costResult.rows[0].base_cost;
      isHighRisk = costResult.rows[0].is_high_risk;
    }

    // Get player's current cells and efficiency
    const playerResult = await pool.query(`
      SELECT
        p.nuclear_cells,
        COALESCE(pr.efficiency_bonus, 0) + COALESCE(rt.efficiency_bonus, 0) as efficiency
      FROM players p
      LEFT JOIN player_reactors pr ON p.id = pr.player_id
      LEFT JOIN reactor_types rt ON pr.reactor_type = rt.type_key
      WHERE p.id = $1
    `, [playerId]);

    const currentCells = playerResult.rows[0]?.nuclear_cells || 0;
    const efficiency = playerResult.rows[0]?.efficiency || 0;
    const effectiveCost = Math.max(0, Math.floor(baseCost * (1 - efficiency)));

    // Check if action requires cells but player doesn't have enough
    if (isHighRisk && effectiveCost > 0 && currentCells < effectiveCost) {
      return res.status(400).json({
        success: false,
        error: `Not enough nuclear cells. Required: ${effectiveCost}, Available: ${currentCells}`,
        required: effectiveCost,
        available: currentCells,
        isHighRisk: true
      });
    }

    // For non-high-risk actions with insufficient cells, action proceeds but no bonus
    if (!isHighRisk && effectiveCost > 0 && currentCells < effectiveCost) {
      return res.json({
        success: true,
        data: {
          cellsUsed: 0,
          cellsRemaining: currentCells,
          actionAllowed: true,
          powerBonus: false,
          message: 'Action allowed without power bonus (insufficient cells)'
        }
      });
    }

    // Deduct cells
    if (effectiveCost > 0) {
      await pool.query(`
        UPDATE players SET nuclear_cells = nuclear_cells - $1 WHERE id = $2
      `, [effectiveCost, playerId]);
    }

    res.json({
      success: true,
      data: {
        cellsUsed: effectiveCost,
        cellsRemaining: currentCells - effectiveCost,
        actionAllowed: true,
        powerBonus: effectiveCost > 0,
        efficiencySaved: baseCost - effectiveCost
      }
    });
  } catch (error) {
    console.error('Error using nuclear cells:', error);
    res.status(500).json({ success: false, error: 'Failed to use cells' });
  }
});

// GET /api/nuclear-cells/packs - Get available cell packs
router.get('/packs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player level
    const playerResult = await pool.query(`
      SELECT level FROM players WHERE id = $1
    `, [playerId]);
    const playerLevel = playerResult.rows[0]?.level || 1;

    // Get available packs
    const packsResult = await pool.query(`
      SELECT * FROM cell_packs WHERE min_level <= $1 ORDER BY price_credits ASC
    `, [playerLevel]);

    // Get purchase history for today
    const today = new Date().toISOString().split('T')[0];
    const purchasesResult = await pool.query(`
      SELECT pack_key, COUNT(*) as count, MAX(purchased_at) as last_purchase
      FROM cell_purchases
      WHERE player_id = $1 AND DATE(purchased_at) = $2
      GROUP BY pack_key
    `, [playerId, today]);

    const purchaseMap: Record<string, { count: number; lastPurchase: Date }> = {};
    for (const p of purchasesResult.rows) {
      purchaseMap[p.pack_key] = {
        count: parseInt(p.count),
        lastPurchase: new Date(p.last_purchase)
      };
    }

    const packs = packsResult.rows.map(pack => {
      const purchases = purchaseMap[pack.pack_key];
      const purchasesToday = purchases?.count || 0;
      const lastPurchase = purchases?.lastPurchase;

      let canPurchase = true;
      let nextPurchaseAt = null;

      // Check daily limit
      if (pack.daily_limit > 0 && purchasesToday >= pack.daily_limit) {
        canPurchase = false;
      }

      // Check cooldown
      if (pack.cooldown_hours > 0 && lastPurchase) {
        const cooldownEnd = new Date(lastPurchase);
        cooldownEnd.setHours(cooldownEnd.getHours() + pack.cooldown_hours);
        if (new Date() < cooldownEnd) {
          canPurchase = false;
          nextPurchaseAt = cooldownEnd.toISOString();
        }
      }

      return {
        id: pack.id,
        packKey: pack.pack_key,
        name: pack.name,
        description: pack.description,
        cellAmount: pack.cell_amount,
        priceCredits: pack.price_credits,
        priceTokens: pack.price_tokens,
        bonusCells: pack.bonus_cells,
        cooldownHours: pack.cooldown_hours,
        dailyLimit: pack.daily_limit,
        isPremium: pack.is_premium,
        minLevel: pack.min_level,
        icon: pack.icon,
        canPurchase,
        nextPurchaseAt,
        purchasesToday
      };
    });

    res.json({
      success: true,
      data: {
        packs,
        regularPacks: packs.filter(p => !p.isPremium),
        premiumPacks: packs.filter(p => p.isPremium),
        factionPacks: packs.filter(p => p.packKey.includes('faction'))
      }
    });
  } catch (error) {
    console.error('Error fetching cell packs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch packs' });
  }
});

// POST /api/nuclear-cells/packs/:packKey/buy - Purchase a cell pack
router.post('/packs/:packKey/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const packKey = req.params.packKey;

    // Get pack info
    const packResult = await pool.query(`
      SELECT * FROM cell_packs WHERE pack_key = $1
    `, [packKey]);

    if (packResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pack not found' });
    }

    const pack = packResult.rows[0];

    // Get player info
    const playerResult = await pool.query(`
      SELECT level, cash, nuclear_cells, nuclear_cells_max FROM players WHERE id = $1
    `, [playerId]);
    const player = playerResult.rows[0];

    // Check level requirement
    if (player.level < pack.min_level) {
      return res.status(400).json({
        success: false,
        error: `Requires level ${pack.min_level}`
      });
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    if (pack.daily_limit > 0) {
      const countResult = await pool.query(`
        SELECT COUNT(*) as count FROM cell_purchases
        WHERE player_id = $1 AND pack_key = $2 AND DATE(purchased_at) = $3
      `, [playerId, packKey, today]);

      if (parseInt(countResult.rows[0].count) >= pack.daily_limit) {
        return res.status(400).json({
          success: false,
          error: `Daily limit reached (${pack.daily_limit}/day)`
        });
      }
    }

    // Check cooldown
    if (pack.cooldown_hours > 0) {
      const lastResult = await pool.query(`
        SELECT MAX(purchased_at) as last FROM cell_purchases
        WHERE player_id = $1 AND pack_key = $2
      `, [playerId, packKey]);

      if (lastResult.rows[0].last) {
        const cooldownEnd = new Date(lastResult.rows[0].last);
        cooldownEnd.setHours(cooldownEnd.getHours() + pack.cooldown_hours);
        if (new Date() < cooldownEnd) {
          const remainingMins = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
          return res.status(400).json({
            success: false,
            error: `On cooldown. Available in ${remainingMins} minutes.`
          });
        }
      }
    }

    // Check payment
    if (pack.price_credits > 0 && player.cash < pack.price_credits) {
      return res.status(400).json({
        success: false,
        error: `Insufficient credits. Need $${pack.price_credits.toLocaleString()}`
      });
    }

    // TODO: Check tokens for premium packs
    // if (pack.price_tokens > 0) { ... }

    await pool.query('BEGIN');

    // Deduct payment
    if (pack.price_credits > 0) {
      await pool.query(`
        UPDATE players SET cash = cash - $1 WHERE id = $2
      `, [pack.price_credits, playerId]);
    }

    // Add cells
    const totalCells = pack.cell_amount + pack.bonus_cells;
    await pool.query(`
      UPDATE players
      SET nuclear_cells = LEAST(nuclear_cells_max, nuclear_cells + $1)
      WHERE id = $2
    `, [totalCells, playerId]);

    // Record purchase
    await pool.query(`
      INSERT INTO cell_purchases (player_id, pack_key, cells_received, price_paid_credits, price_paid_tokens)
      VALUES ($1, $2, $3, $4, $5)
    `, [playerId, packKey, totalCells, pack.price_credits, pack.price_tokens]);

    // Log regen
    await pool.query(`
      INSERT INTO cell_regen_log (player_id, regen_type, amount, source)
      VALUES ($1, 'purchase', $2, $3)
    `, [playerId, totalCells, `Purchased: ${pack.name}`]);

    await pool.query('COMMIT');

    // Get new total
    const newResult = await pool.query(`
      SELECT nuclear_cells FROM players WHERE id = $1
    `, [playerId]);

    res.json({
      success: true,
      data: {
        cellsReceived: pack.cell_amount,
        bonusCells: pack.bonus_cells,
        totalReceived: totalCells,
        newTotal: newResult.rows[0].nuclear_cells,
        priceCredits: pack.price_credits,
        priceTokens: pack.price_tokens,
        message: `Purchased ${pack.name} (+${totalCells} cells)`
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error purchasing cell pack:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase pack' });
  }
});

// GET /api/nuclear-cells/reactors - Get available reactor types
router.get('/reactors', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player level and current reactor
    const playerResult = await pool.query(`
      SELECT p.level, pr.reactor_type as current_type
      FROM players p
      LEFT JOIN player_reactors pr ON p.id = pr.player_id
      WHERE p.id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    // Get all reactor types
    const reactorsResult = await pool.query(`
      SELECT * FROM reactor_types ORDER BY purchase_price ASC
    `);

    const currentTypeIndex = reactorsResult.rows.findIndex(r => r.type_key === player.current_type);

    const reactors = reactorsResult.rows.map((r, index) => ({
      id: r.id,
      typeKey: r.type_key,
      name: r.name,
      description: r.description,
      maxCapacity: r.max_capacity,
      baseRegenRate: r.base_regen_rate,
      regenIntervalSeconds: r.regen_interval_seconds,
      efficiencyBonus: r.efficiency_bonus,
      purchasePrice: r.purchase_price,
      minLevel: r.min_level,
      minFactionRank: r.min_faction_rank,
      factionRequired: r.faction_required,
      icon: r.icon,
      isOwned: index <= currentTypeIndex,
      isCurrent: r.type_key === player.current_type,
      canUpgrade: player.level >= r.min_level && index > currentTypeIndex
    }));

    res.json({
      success: true,
      data: {
        reactors,
        currentReactor: reactors.find(r => r.isCurrent) || reactors[0],
        availableUpgrades: reactors.filter(r => r.canUpgrade)
      }
    });
  } catch (error) {
    console.error('Error fetching reactors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reactors' });
  }
});

// POST /api/nuclear-cells/reactors/:typeKey/upgrade - Upgrade reactor
router.post('/reactors/:typeKey/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const typeKey = req.params.typeKey;

    // Get reactor type info
    const typeResult = await pool.query(`
      SELECT * FROM reactor_types WHERE type_key = $1
    `, [typeKey]);

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reactor type not found' });
    }

    const newReactor = typeResult.rows[0];

    // Get player info and current reactor
    const playerResult = await pool.query(`
      SELECT p.level, p.cash, pr.reactor_type as current_type
      FROM players p
      LEFT JOIN player_reactors pr ON p.id = pr.player_id
      WHERE p.id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    // Check level
    if (player.level < newReactor.min_level) {
      return res.status(400).json({
        success: false,
        error: `Requires level ${newReactor.min_level}`
      });
    }

    // Check faction requirement
    if (newReactor.faction_required) {
      const factionResult = await pool.query(`
        SELECT rank, reputation FROM player_faction_rep pfr
        JOIN factions f ON pfr.faction_id = f.id
        WHERE pfr.player_id = $1 AND f.code = $2
      `, [playerId, newReactor.faction_required]);

      if (factionResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Requires membership in ${newReactor.faction_required}`
        });
      }

      // Check rank if required
      if (newReactor.min_faction_rank) {
        const rankOrder = ['outsider', 'contact', 'associate', 'member', 'trusted', 'lieutenant', 'commander', 'council'];
        const playerRankIndex = rankOrder.indexOf(factionResult.rows[0].rank);
        const requiredRankIndex = rankOrder.indexOf(newReactor.min_faction_rank);

        if (playerRankIndex < requiredRankIndex) {
          return res.status(400).json({
            success: false,
            error: `Requires ${newReactor.min_faction_rank} rank in ${newReactor.faction_required}`
          });
        }
      }
    }

    // Check payment
    if (newReactor.purchase_price > 0 && player.cash < newReactor.purchase_price) {
      return res.status(400).json({
        success: false,
        error: `Insufficient funds. Need $${newReactor.purchase_price.toLocaleString()}`
      });
    }

    await pool.query('BEGIN');

    // Deduct payment
    if (newReactor.purchase_price > 0) {
      await pool.query(`
        UPDATE players SET cash = cash - $1 WHERE id = $2
      `, [newReactor.purchase_price, playerId]);
    }

    // Update player's max cells
    await pool.query(`
      UPDATE players
      SET nuclear_cells_max = $1
      WHERE id = $2
    `, [newReactor.max_capacity, playerId]);

    // Update or create reactor record
    await pool.query(`
      INSERT INTO player_reactors (player_id, reactor_type, reactor_name, max_capacity, regen_rate, regen_interval_seconds, efficiency_bonus)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (player_id) DO UPDATE SET
        reactor_type = $2,
        reactor_name = $3,
        max_capacity = $4,
        regen_rate = $5,
        regen_interval_seconds = $6,
        efficiency_bonus = $7,
        installed_at = NOW(),
        condition_percent = 100
    `, [playerId, typeKey, newReactor.name, newReactor.max_capacity, newReactor.base_regen_rate, newReactor.regen_interval_seconds, newReactor.efficiency_bonus]);

    await pool.query('COMMIT');

    // Get previous capacity for comparison
    const prevType = await pool.query(`
      SELECT max_capacity, efficiency_bonus FROM reactor_types WHERE type_key = $1
    `, [player.current_type || 'basic']);

    const prevCapacity = prevType.rows[0]?.max_capacity || 100;
    const prevEfficiency = prevType.rows[0]?.efficiency_bonus || 0;

    res.json({
      success: true,
      data: {
        message: `Upgraded to ${newReactor.name}!`,
        newReactor: {
          typeKey: typeKey,
          name: newReactor.name,
          maxCapacity: newReactor.max_capacity,
          regenRate: newReactor.base_regen_rate,
          regenIntervalSeconds: newReactor.regen_interval_seconds,
          efficiencyBonus: newReactor.efficiency_bonus
        },
        previousType: player.current_type || 'basic',
        capacityIncrease: newReactor.max_capacity - prevCapacity,
        efficiencyIncrease: newReactor.efficiency_bonus - prevEfficiency,
        pricePaid: newReactor.purchase_price
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error upgrading reactor:', error);
    res.status(500).json({ success: false, error: 'Failed to upgrade reactor' });
  }
});

// POST /api/nuclear-cells/overclock - Temporarily boost reactor
router.post('/overclock', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { durationMinutes = 30 } = req.body;

    // Check if already overclocked
    const reactorResult = await pool.query(`
      SELECT * FROM player_reactors WHERE player_id = $1
    `, [playerId]);

    if (reactorResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No reactor installed'
      });
    }

    const reactor = reactorResult.rows[0];

    if (reactor.is_overclocked && new Date(reactor.overclock_expires_at) > new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Reactor already overclocked'
      });
    }

    // Overclock cost: 20 cells per 30 minutes
    const cellCost = Math.ceil(durationMinutes / 30) * 20;

    // Check cells
    const playerResult = await pool.query(`
      SELECT nuclear_cells FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].nuclear_cells < cellCost) {
      return res.status(400).json({
        success: false,
        error: `Not enough cells. Need ${cellCost} for ${durationMinutes} minute overclock.`
      });
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    await pool.query('BEGIN');

    // Deduct cells
    await pool.query(`
      UPDATE players SET nuclear_cells = nuclear_cells - $1 WHERE id = $2
    `, [cellCost, playerId]);

    // Activate overclock
    await pool.query(`
      UPDATE player_reactors
      SET is_overclocked = true, overclock_expires_at = $2
      WHERE player_id = $1
    `, [playerId, expiresAt]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Reactor overclocked for ${durationMinutes} minutes!`,
        expiresAt: expiresAt.toISOString(),
        cellsUsed: cellCost,
        bonus: '+50% regen rate while active'
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error overclocking reactor:', error);
    res.status(500).json({ success: false, error: 'Failed to overclock' });
  }
});

// Process passive regeneration for all players (called by server interval)
export async function processPassiveRegen(): Promise<void> {
  try {
    // Find all players who need regen (not at max, and enough time passed)
    const result = await pool.query(`
      SELECT p.id, p.nuclear_cells, p.nuclear_cells_max, p.last_cell_regen,
             pr.regen_rate, pr.regen_interval_seconds, pr.condition_percent,
             rt.base_regen_rate, rt.regen_interval_seconds as default_interval
      FROM players p
      LEFT JOIN player_reactors pr ON p.id = pr.player_id
      LEFT JOIN reactor_types rt ON pr.reactor_type = rt.type_key
      WHERE p.nuclear_cells < p.nuclear_cells_max
        AND p.last_cell_regen < NOW() - INTERVAL '1 second' * COALESCE(pr.regen_interval_seconds, rt.regen_interval_seconds, 60)
    `);

    let totalRegenerated = 0;
    let playersUpdated = 0;

    for (const player of result.rows) {
      const regenRate = player.regen_rate || player.base_regen_rate || 1;
      const conditionModifier = player.condition_percent ? (0.5 + player.condition_percent / 200) : 1;
      const effectiveRegenRate = Math.max(1, Math.floor(regenRate * conditionModifier));
      const maxCells = player.nuclear_cells_max || 100;
      const currentCells = player.nuclear_cells || 0;
      const regenAmount = Math.min(effectiveRegenRate, maxCells - currentCells);

      if (regenAmount > 0) {
        await pool.query(`
          UPDATE players
          SET nuclear_cells = LEAST(nuclear_cells_max, nuclear_cells + $1),
              last_cell_regen = NOW()
          WHERE id = $2
        `, [regenAmount, player.id]);

        await pool.query(`
          INSERT INTO cell_regen_log (player_id, regen_type, amount, source)
          VALUES ($1, 'passive', $2, 'Reactor passive regeneration')
        `, [player.id, regenAmount]);

        totalRegenerated += regenAmount;
        playersUpdated++;
      }
    }

    if (playersUpdated > 0) {
      console.log(`[Nuclear Cells] Processed passive regen: ${totalRegenerated} cells for ${playersUpdated} players`);
    }
  } catch (error) {
    console.error('[Nuclear Cells] Error processing passive regen:', error);
  }
}

export default router;
