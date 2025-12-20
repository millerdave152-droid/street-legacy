import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Constants
const MAINTENANCE_DECAY_PER_DAY = 1; // 1% condition loss per day
const MAINTENANCE_COST_PERCENT = 0.01; // 1% of property value per 10% repair
const MANAGER_DAILY_FEE_PERCENT = 0.001; // 0.1% of property value per day

// GET /api/real-estate/listings - Get available properties for purchase
router.get('/listings', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { district, category, type, maxPrice, minLevel } = req.query;

    // Get player data
    const playerResult = await pool.query(
      `SELECT level, cash, clean_money, current_district FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const player = playerResult.rows[0];

    // Build query
    let query = `
      SELECT pl.*, d.name as district_name,
             NOT EXISTS (
               SELECT 1 FROM owned_properties op WHERE op.listing_id = pl.id
             ) as is_available
      FROM property_listings pl
      JOIN districts d ON pl.district_id = d.id
      WHERE pl.is_available = true
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (district) {
      paramCount++;
      query += ` AND pl.district_id = $${paramCount}`;
      params.push(parseInt(district as string));
    }

    if (category) {
      paramCount++;
      query += ` AND pl.category = $${paramCount}`;
      params.push(category);
    }

    if (type) {
      paramCount++;
      query += ` AND pl.property_type = $${paramCount}`;
      params.push(type);
    }

    if (maxPrice) {
      paramCount++;
      query += ` AND pl.base_price <= $${paramCount}`;
      params.push(parseInt(maxPrice as string));
    }

    if (minLevel) {
      paramCount++;
      query += ` AND pl.min_level <= $${paramCount}`;
      params.push(parseInt(minLevel as string));
    }

    query += ` ORDER BY pl.base_price ASC`;

    const listingsResult = await pool.query(query, params);

    // Check which properties are already owned
    const ownedResult = await pool.query(
      `SELECT listing_id FROM owned_properties WHERE owner_id = $1`,
      [playerId]
    );
    const ownedListingIds = new Set(ownedResult.rows.map(r => r.listing_id));

    const listings = listingsResult.rows.map(l => ({
      id: l.id,
      name: l.name,
      description: l.description,
      propertyType: l.property_type,
      category: l.category,
      districtId: l.district_id,
      districtName: l.district_name,
      location: l.lat && l.lng ? { lat: l.lat, lng: l.lng } : null,
      address: l.address,
      price: l.base_price,
      cleanMoneyRequired: l.clean_money_required,
      minLevel: l.min_level,
      stats: {
        incomePerHour: l.base_income_per_hour,
        storageCapacity: l.base_storage_capacity,
        heatReduction: l.base_heat_reduction,
        influenceBonus: l.base_influence_bonus
      },
      capacity: {
        upgradeSlots: l.upgrade_slots,
        vehicleSlots: l.vehicle_slots,
        staffSlots: l.staff_slots
      },
      capabilities: {
        canLaunderMoney: l.can_launder_money,
        canManufacture: l.can_manufacture,
        canStoreVehicles: l.can_store_vehicles,
        canBeCrewHQ: l.can_be_crew_hq,
        isHidden: l.is_hidden
      },
      isAvailable: l.is_available && !ownedListingIds.has(l.id),
      isOwned: ownedListingIds.has(l.id),
      canAfford: player.cash >= l.base_price && player.clean_money >= l.clean_money_required,
      meetsLevel: player.level >= l.min_level
    }));

    res.json({
      success: true,
      data: {
        listings,
        playerFunds: {
          cash: player.cash,
          cleanMoney: player.clean_money,
          level: player.level
        },
        filters: {
          categories: ['residential', 'commercial', 'industrial', 'illegal'],
          types: [...new Set(listingsResult.rows.map(l => l.property_type))]
        }
      }
    });
  } catch (error) {
    console.error('Get property listings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get listings' });
  }
});

// GET /api/real-estate/owned - Get player's owned properties
router.get('/owned', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const propertiesResult = await pool.query(
      `SELECT op.*, pl.name, pl.description, pl.property_type, pl.category,
              pl.district_id, pl.base_price, pl.base_income_per_hour,
              pl.base_storage_capacity, pl.base_heat_reduction, pl.base_influence_bonus,
              pl.upgrade_slots, pl.vehicle_slots, pl.staff_slots,
              pl.can_launder_money, pl.can_manufacture, pl.can_store_vehicles, pl.can_be_crew_hq,
              d.name as district_name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       JOIN districts d ON pl.district_id = d.id
       WHERE op.owner_id = $1
       ORDER BY op.purchased_at DESC`,
      [playerId]
    );

    // Get upgrades for each property
    const properties = await Promise.all(propertiesResult.rows.map(async (p) => {
      // Get installed upgrades
      const upgradesResult = await pool.query(
        `SELECT pu.*, put.name, put.description, put.category, put.effects, put.monthly_cost, put.icon
         FROM property_upgrades pu
         JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
         WHERE pu.property_id = $1 AND pu.is_active = true`,
        [p.id]
      );

      // Get active operations
      const operationsResult = await pool.query(
        `SELECT * FROM property_operations WHERE property_id = $1`,
        [p.id]
      );

      // Get staff
      const staffResult = await pool.query(
        `SELECT * FROM property_staff WHERE property_id = $1 AND is_active = true`,
        [p.id]
      );

      // Calculate current income with upgrades
      let incomeMultiplier = 1;
      let storageBonusTotal = 0;
      let heatReductionBonus = 0;
      let raidResistance = 0;

      upgradesResult.rows.forEach(u => {
        const effects = u.effects || {};
        if (effects.income_multiplier) incomeMultiplier *= effects.income_multiplier;
        if (effects.storage_bonus) storageBonusTotal += effects.storage_bonus;
        if (effects.heat_reduction_bonus) heatReductionBonus += effects.heat_reduction_bonus;
        if (effects.raid_resistance) raidResistance += effects.raid_resistance;
      });

      // Apply condition penalty
      let conditionMultiplier = 1;
      if (p.condition < 50) conditionMultiplier = 0.75;
      if (p.condition < 25) conditionMultiplier = 0.5;

      const effectiveIncome = Math.floor(p.base_income_per_hour * incomeMultiplier * conditionMultiplier);

      // Calculate pending income
      const hoursSinceCollection = (Date.now() - new Date(p.last_income_collected).getTime()) / (1000 * 60 * 60);
      const pendingIncome = Math.floor(hoursSinceCollection * effectiveIncome);

      return {
        id: p.id,
        listingId: p.listing_id,
        name: p.custom_name || p.name,
        originalName: p.name,
        description: p.description,
        propertyType: p.property_type,
        category: p.category,
        districtId: p.district_id,
        districtName: p.district_name,
        purchasePrice: p.purchase_price,
        purchasedAt: p.purchased_at,
        condition: p.condition,
        lastMaintained: p.last_maintained,
        isCrewHQ: p.is_crew_hq,
        isRaided: p.is_raided,
        raidLockoutUntil: p.raid_lockout_until,
        hasManager: p.has_property_manager,
        stats: {
          baseIncome: p.base_income_per_hour,
          effectiveIncome,
          pendingIncome,
          storageCapacity: p.base_storage_capacity + storageBonusTotal,
          heatReduction: p.base_heat_reduction + heatReductionBonus,
          influenceBonus: p.base_influence_bonus,
          raidResistance
        },
        capacity: {
          upgradeSlots: p.upgrade_slots,
          usedUpgradeSlots: upgradesResult.rows.length,
          vehicleSlots: p.vehicle_slots,
          staffSlots: p.staff_slots,
          usedStaffSlots: staffResult.rows.length
        },
        upgrades: upgradesResult.rows.map(u => ({
          id: u.id,
          typeId: u.upgrade_type_id,
          name: u.name,
          description: u.description,
          category: u.category,
          effects: u.effects,
          monthlyCost: u.monthly_cost,
          icon: u.icon,
          installedAt: u.installed_at,
          installing: u.installing_until && new Date(u.installing_until) > new Date()
        })),
        operations: operationsResult.rows.map(o => ({
          id: o.id,
          type: o.operation_type,
          status: o.status,
          intensity: o.intensity,
          currentHeat: o.current_heat,
          totalRevenue: o.total_revenue
        })),
        staff: staffResult.rows.map(s => ({
          id: s.id,
          type: s.staff_type,
          name: s.npc_name,
          dailySalary: s.daily_salary,
          effectiveness: s.effectiveness
        })),
        totalIncomeEarned: p.total_income_earned
      };
    }));

    // Calculate portfolio totals
    const totalValue = properties.reduce((sum, p) => sum + p.purchasePrice, 0);
    const totalIncome = properties.reduce((sum, p) => sum + p.stats.effectiveIncome, 0);
    const totalPending = properties.reduce((sum, p) => sum + p.stats.pendingIncome, 0);

    res.json({
      success: true,
      data: {
        properties,
        portfolio: {
          totalProperties: properties.length,
          totalValue,
          totalIncomePerHour: totalIncome,
          totalPendingIncome: totalPending,
          byCategory: {
            residential: properties.filter(p => p.category === 'residential').length,
            commercial: properties.filter(p => p.category === 'commercial').length,
            industrial: properties.filter(p => p.category === 'industrial').length,
            illegal: properties.filter(p => p.category === 'illegal').length
          }
        }
      }
    });
  } catch (error) {
    console.error('Get owned properties error:', error);
    res.status(500).json({ success: false, error: 'Failed to get properties' });
  }
});

// POST /api/real-estate/buy/:listingId - Purchase a property
router.post('/buy/:listingId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const listingId = parseInt(req.params.listingId);

    if (isNaN(listingId)) {
      res.status(400).json({ success: false, error: 'Invalid listing ID' });
      return;
    }

    // Get listing
    const listingResult = await pool.query(
      `SELECT * FROM property_listings WHERE id = $1 AND is_available = true`,
      [listingId]
    );

    if (listingResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found or unavailable' });
      return;
    }

    const listing = listingResult.rows[0];

    // Check if already owned
    const existingResult = await pool.query(
      `SELECT id FROM owned_properties WHERE listing_id = $1`,
      [listingId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Property already owned by another player' });
      return;
    }

    // Get player
    const playerResult = await pool.query(
      `SELECT level, cash, clean_money FROM players WHERE id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];

    // Check requirements
    if (player.level < listing.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${listing.min_level}` });
      return;
    }

    if (player.cash < listing.base_price) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    if (player.clean_money < listing.clean_money_required) {
      res.status(400).json({
        success: false,
        error: `Requires $${listing.clean_money_required.toLocaleString()} in clean money`
      });
      return;
    }

    // Deduct funds
    await pool.query(
      `UPDATE players
       SET cash = cash - $1, clean_money = clean_money - $2
       WHERE id = $3`,
      [listing.base_price, listing.clean_money_required, playerId]
    );

    // Create ownership record
    const ownershipResult = await pool.query(
      `INSERT INTO owned_properties (listing_id, owner_id, purchase_price)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [listingId, playerId, listing.base_price]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO currency_transactions (player_id, currency_type, amount, transaction_type, description)
       VALUES ($1, 'cash', $2, 'spend', $3)`,
      [playerId, -listing.base_price, `Purchased property: ${listing.name}`]
    );

    res.json({
      success: true,
      data: {
        message: `Congratulations! You now own ${listing.name}`,
        propertyId: ownershipResult.rows[0].id,
        property: {
          name: listing.name,
          type: listing.property_type,
          category: listing.category
        },
        spent: {
          cash: listing.base_price,
          cleanMoney: listing.clean_money_required
        }
      }
    });
  } catch (error) {
    console.error('Buy property error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase property' });
  }
});

// POST /api/real-estate/sell/:propertyId - Sell an owned property
router.post('/sell/:propertyId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    if (isNaN(propertyId)) {
      res.status(400).json({ success: false, error: 'Invalid property ID' });
      return;
    }

    // Get property with listing info
    const propertyResult = await pool.query(
      `SELECT op.*, pl.name, pl.base_price
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found or not owned by you' });
      return;
    }

    const property = propertyResult.rows[0];

    // Calculate sale price (50-80% of original price based on condition)
    const conditionMultiplier = 0.5 + (property.condition / 200); // 50-100% based on condition
    const salePrice = Math.floor(property.base_price * conditionMultiplier);

    // Delete associated records
    await pool.query(`DELETE FROM property_upgrades WHERE property_id = $1`, [propertyId]);
    await pool.query(`DELETE FROM property_operations WHERE property_id = $1`, [propertyId]);
    await pool.query(`DELETE FROM property_staff WHERE property_id = $1`, [propertyId]);
    await pool.query(`DELETE FROM property_inventory WHERE property_id = $1`, [propertyId]);

    // Delete ownership
    await pool.query(`DELETE FROM owned_properties WHERE id = $1`, [propertyId]);

    // Add funds to player
    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [salePrice, playerId]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO currency_transactions (player_id, currency_type, amount, transaction_type, description)
       VALUES ($1, 'cash', $2, 'earn', $3)`,
      [playerId, salePrice, `Sold property: ${property.name}`]
    );

    res.json({
      success: true,
      data: {
        message: `Sold ${property.name} for $${salePrice.toLocaleString()}`,
        salePrice,
        originalPrice: property.base_price,
        conditionAtSale: property.condition
      }
    });
  } catch (error) {
    console.error('Sell property error:', error);
    res.status(500).json({ success: false, error: 'Failed to sell property' });
  }
});

// POST /api/real-estate/:propertyId/collect - Collect pending income
router.post('/:propertyId/collect', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.base_income_per_hour, pl.name
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

    // Check if operations are disabled due to condition
    if (property.condition < 25) {
      res.status(400).json({
        success: false,
        error: 'Property condition too low. Perform maintenance first.'
      });
      return;
    }

    // Calculate income with upgrades
    const upgradesResult = await pool.query(
      `SELECT put.effects FROM property_upgrades pu
       JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
       WHERE pu.property_id = $1 AND pu.is_active = true`,
      [propertyId]
    );

    let incomeMultiplier = 1;
    upgradesResult.rows.forEach(u => {
      if (u.effects?.income_multiplier) {
        incomeMultiplier *= u.effects.income_multiplier;
      }
    });

    // Condition penalty
    let conditionMultiplier = 1;
    if (property.condition < 50) conditionMultiplier = 0.75;

    const effectiveIncome = property.base_income_per_hour * incomeMultiplier * conditionMultiplier;

    // Calculate pending income
    const hoursSinceCollection = (Date.now() - new Date(property.last_income_collected).getTime()) / (1000 * 60 * 60);
    const pendingIncome = Math.floor(hoursSinceCollection * effectiveIncome);

    if (pendingIncome <= 0) {
      res.status(400).json({ success: false, error: 'No income to collect yet' });
      return;
    }

    // Update property and player
    await pool.query(
      `UPDATE owned_properties
       SET last_income_collected = NOW(),
           total_income_earned = total_income_earned + $1
       WHERE id = $2`,
      [pendingIncome, propertyId]
    );

    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [pendingIncome, playerId]
    );

    // Log income
    await pool.query(
      `INSERT INTO property_income_log (property_id, income_type, amount, source_description)
       VALUES ($1, 'passive', $2, $3)`,
      [propertyId, pendingIncome, `Collected ${Math.floor(hoursSinceCollection)} hours of income`]
    );

    res.json({
      success: true,
      data: {
        message: `Collected $${pendingIncome.toLocaleString()} from ${property.name}`,
        income: pendingIncome,
        hoursCollected: Math.floor(hoursSinceCollection),
        incomePerHour: Math.floor(effectiveIncome)
      }
    });
  } catch (error) {
    console.error('Collect income error:', error);
    res.status(500).json({ success: false, error: 'Failed to collect income' });
  }
});

// POST /api/real-estate/:propertyId/maintain - Perform maintenance
router.post('/:propertyId/maintain', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { repairPercent = 10 } = req.body;

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.base_price, pl.name
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

    // Calculate repair cost (1% of property value per 10% repair)
    const repairAmount = Math.min(repairPercent, 100 - property.condition);
    const costPer10Percent = Math.floor(property.base_price * MAINTENANCE_COST_PERCENT);
    const totalCost = Math.floor(costPer10Percent * (repairAmount / 10));

    // Check player funds
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].cash < totalCost) {
      res.status(400).json({
        success: false,
        error: 'Not enough cash',
        required: totalCost,
        have: playerResult.rows[0].cash
      });
      return;
    }

    const newCondition = Math.min(100, property.condition + repairAmount);

    // Update property
    await pool.query(
      `UPDATE owned_properties
       SET condition = $1, last_maintained = NOW()
       WHERE id = $2`,
      [newCondition, propertyId]
    );

    // Deduct cost
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [totalCost, playerId]
    );

    // Log maintenance
    await pool.query(
      `INSERT INTO property_maintenance_log (property_id, maintenance_type, condition_before, condition_after, cost)
       VALUES ($1, 'repair', $2, $3, $4)`,
      [propertyId, property.condition, newCondition, totalCost]
    );

    res.json({
      success: true,
      data: {
        message: `Maintained ${property.name}`,
        previousCondition: property.condition,
        newCondition,
        cost: totalCost,
        repairPercent: repairAmount
      }
    });
  } catch (error) {
    console.error('Maintain property error:', error);
    res.status(500).json({ success: false, error: 'Failed to maintain property' });
  }
});

// POST /api/real-estate/:propertyId/hire-manager - Hire property manager
router.post('/:propertyId/hire-manager', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.base_price, pl.name
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

    if (property.has_property_manager) {
      res.status(400).json({ success: false, error: 'Already has a property manager' });
      return;
    }

    // Calculate manager fee (0.1% of property value per day)
    const dailyFee = Math.floor(property.base_price * MANAGER_DAILY_FEE_PERCENT);

    // Update property
    await pool.query(
      `UPDATE owned_properties
       SET has_property_manager = true, manager_fee_per_day = $1
       WHERE id = $2`,
      [dailyFee, propertyId]
    );

    // Add staff record
    await pool.query(
      `INSERT INTO property_staff (property_id, staff_type, npc_name, daily_salary, effectiveness)
       VALUES ($1, 'manager', 'Property Manager', $2, 80)`,
      [propertyId, dailyFee]
    );

    res.json({
      success: true,
      data: {
        message: `Hired property manager for ${property.name}`,
        dailyFee,
        benefits: [
          'Auto-maintenance when condition drops below 75%',
          'Auto-collect income daily',
          'Better raid response time'
        ]
      }
    });
  } catch (error) {
    console.error('Hire manager error:', error);
    res.status(500).json({ success: false, error: 'Failed to hire manager' });
  }
});

// POST /api/real-estate/:propertyId/fire-manager - Fire property manager
router.post('/:propertyId/fire-manager', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    const propertyResult = await pool.query(
      `SELECT op.*, pl.name
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

    if (!property.has_property_manager) {
      res.status(400).json({ success: false, error: 'No property manager to fire' });
      return;
    }

    // Update property
    await pool.query(
      `UPDATE owned_properties
       SET has_property_manager = false, manager_fee_per_day = 0
       WHERE id = $1`,
      [propertyId]
    );

    // Remove staff record
    await pool.query(
      `DELETE FROM property_staff WHERE property_id = $1 AND staff_type = 'manager'`,
      [propertyId]
    );

    res.json({
      success: true,
      data: {
        message: `Fired property manager from ${property.name}`
      }
    });
  } catch (error) {
    console.error('Fire manager error:', error);
    res.status(500).json({ success: false, error: 'Failed to fire manager' });
  }
});

// POST /api/real-estate/:propertyId/rename - Rename a property
router.post('/:propertyId/rename', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { newName } = req.body;

    if (!newName || newName.length < 3 || newName.length > 50) {
      res.status(400).json({ success: false, error: 'Name must be 3-50 characters' });
      return;
    }

    const result = await pool.query(
      `UPDATE owned_properties
       SET custom_name = $1
       WHERE id = $2 AND owner_id = $3
       RETURNING id`,
      [newName, propertyId, playerId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        message: `Property renamed to "${newName}"`
      }
    });
  } catch (error) {
    console.error('Rename property error:', error);
    res.status(500).json({ success: false, error: 'Failed to rename property' });
  }
});

// GET /api/real-estate/:propertyId - Get single property details
router.get('/:propertyId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    const propertyResult = await pool.query(
      `SELECT op.*, pl.*, d.name as district_name
       FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       JOIN districts d ON pl.district_id = d.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    const p = propertyResult.rows[0];

    // Get all related data
    const [upgradesResult, operationsResult, staffResult, inventoryResult, incomeLogResult, raidsResult] = await Promise.all([
      pool.query(`
        SELECT pu.*, put.name, put.description, put.category, put.effects, put.monthly_cost, put.icon
        FROM property_upgrades pu
        JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
        WHERE pu.property_id = $1
      `, [propertyId]),
      pool.query(`SELECT * FROM property_operations WHERE property_id = $1`, [propertyId]),
      pool.query(`SELECT * FROM property_staff WHERE property_id = $1`, [propertyId]),
      pool.query(`SELECT * FROM property_inventory WHERE property_id = $1`, [propertyId]),
      pool.query(`SELECT * FROM property_income_log WHERE property_id = $1 ORDER BY logged_at DESC LIMIT 20`, [propertyId]),
      pool.query(`SELECT * FROM property_raids WHERE property_id = $1 ORDER BY raided_at DESC LIMIT 5`, [propertyId])
    ]);

    // Calculate stats
    let incomeMultiplier = 1;
    let storageBonus = 0;
    let heatReductionBonus = 0;
    let raidResistance = 0;

    upgradesResult.rows.forEach(u => {
      const effects = u.effects || {};
      if (effects.income_multiplier) incomeMultiplier *= effects.income_multiplier;
      if (effects.storage_bonus) storageBonus += effects.storage_bonus;
      if (effects.heat_reduction_bonus) heatReductionBonus += effects.heat_reduction_bonus;
      if (effects.raid_resistance) raidResistance += effects.raid_resistance;
    });

    res.json({
      success: true,
      data: {
        property: {
          id: p.id,
          listingId: p.listing_id,
          name: p.custom_name || p.name,
          originalName: p.name,
          description: p.description,
          propertyType: p.property_type,
          category: p.category,
          districtId: p.district_id,
          districtName: p.district_name,
          address: p.address,
          location: p.lat && p.lng ? { lat: p.lat, lng: p.lng } : null,
          purchasePrice: p.purchase_price,
          currentValue: Math.floor(p.base_price * (0.5 + p.condition / 200)),
          purchasedAt: p.purchased_at,
          condition: p.condition,
          lastMaintained: p.last_maintained,
          isCrewHQ: p.is_crew_hq,
          isRaided: p.is_raided,
          hasManager: p.has_property_manager,
          managerFee: p.manager_fee_per_day
        },
        stats: {
          baseIncome: p.base_income_per_hour,
          effectiveIncome: Math.floor(p.base_income_per_hour * incomeMultiplier * (p.condition < 50 ? 0.75 : 1)),
          storageCapacity: p.base_storage_capacity + storageBonus,
          heatReduction: p.base_heat_reduction + heatReductionBonus,
          influenceBonus: p.base_influence_bonus,
          raidResistance,
          totalIncomeEarned: p.total_income_earned
        },
        capacity: {
          upgradeSlots: p.upgrade_slots,
          vehicleSlots: p.vehicle_slots,
          staffSlots: p.staff_slots
        },
        capabilities: {
          canLaunderMoney: p.can_launder_money,
          canManufacture: p.can_manufacture,
          canStoreVehicles: p.can_store_vehicles,
          canBeCrewHQ: p.can_be_crew_hq,
          isHidden: p.is_hidden
        },
        upgrades: upgradesResult.rows,
        operations: operationsResult.rows,
        staff: staffResult.rows,
        inventory: inventoryResult.rows,
        recentIncome: incomeLogResult.rows,
        recentRaids: raidsResult.rows
      }
    });
  } catch (error) {
    console.error('Get property details error:', error);
    res.status(500).json({ success: false, error: 'Failed to get property details' });
  }
});

// Export for use in periodic tasks
export async function processPropertyDecay() {
  try {
    // Reduce condition by 1% per day for all properties
    await pool.query(`
      UPDATE owned_properties
      SET condition = GREATEST(0, condition - ${MAINTENANCE_DECAY_PER_DAY})
      WHERE last_maintained < NOW() - INTERVAL '1 day'
    `);

    // Auto-maintain for properties with managers
    const managerPropertiesResult = await pool.query(`
      SELECT op.id, op.condition, pl.base_price
      FROM owned_properties op
      JOIN property_listings pl ON op.listing_id = pl.id
      WHERE op.has_property_manager = true AND op.condition < 75
    `);

    for (const prop of managerPropertiesResult.rows) {
      const repairAmount = 75 - prop.condition;
      const cost = Math.floor(prop.base_price * MAINTENANCE_COST_PERCENT * (repairAmount / 10));

      await pool.query(`
        UPDATE owned_properties SET condition = 75, last_maintained = NOW() WHERE id = $1
      `, [prop.id]);

      await pool.query(`
        INSERT INTO property_maintenance_log (property_id, maintenance_type, condition_before, condition_after, cost)
        VALUES ($1, 'manager_auto', $2, 75, $3)
      `, [prop.id, prop.condition, cost]);
    }

    console.log('Property decay processed');
  } catch (error) {
    console.error('Property decay processing error:', error);
  }
}

export default router;
