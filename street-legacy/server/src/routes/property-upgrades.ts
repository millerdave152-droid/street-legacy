import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/property-upgrades/types - Get all available upgrade types
router.get('/types', async (req: AuthRequest, res: Response) => {
  try {
    const { category, propertyType } = req.query;

    let query = `SELECT * FROM property_upgrade_types WHERE 1=1`;
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ` ORDER BY category, cost ASC`;

    const upgradesResult = await pool.query(query, params);

    // Filter by property type if specified
    let upgrades = upgradesResult.rows;
    if (propertyType) {
      upgrades = upgrades.filter(u =>
        u.applicable_types.includes(propertyType) ||
        u.applicable_categories.length === 0
      );
    }

    res.json({
      success: true,
      data: {
        upgrades: upgrades.map(u => ({
          id: u.id,
          name: u.name,
          description: u.description,
          category: u.category,
          applicableTypes: u.applicable_types,
          applicableCategories: u.applicable_categories,
          cost: u.cost,
          monthlyCost: u.monthly_cost,
          minLevel: u.min_level,
          requiredUpgradeId: u.required_upgrade_id,
          effects: u.effects,
          installTimeHours: u.install_time_hours,
          icon: u.icon
        }))
      }
    });
  } catch (error) {
    console.error('Get upgrade types error:', error);
    res.status(500).json({ success: false, error: 'Failed to get upgrade types' });
  }
});

// GET /api/property-upgrades/:propertyId/available - Get available upgrades for a property
router.get('/:propertyId/available', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    // Get property info
    const propertyResult = await pool.query(
      `SELECT op.*, pl.property_type, pl.category, pl.upgrade_slots
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

    // Get installed upgrades
    const installedResult = await pool.query(
      `SELECT upgrade_type_id FROM property_upgrades WHERE property_id = $1`,
      [propertyId]
    );
    const installedIds = new Set(installedResult.rows.map(r => r.upgrade_type_id));

    // Get player level
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all applicable upgrades
    const upgradesResult = await pool.query(
      `SELECT * FROM property_upgrade_types
       WHERE ($1 = ANY(applicable_types) OR $2 = ANY(applicable_categories) OR array_length(applicable_categories, 1) IS NULL)
       ORDER BY category, cost ASC`,
      [property.property_type, property.category]
    );

    const availableUpgrades = upgradesResult.rows.filter(u => {
      // Not already installed
      if (installedIds.has(u.id)) return false;

      // Check required upgrade
      if (u.required_upgrade_id && !installedIds.has(u.required_upgrade_id)) return false;

      return true;
    }).map(u => ({
      id: u.id,
      name: u.name,
      description: u.description,
      category: u.category,
      cost: u.cost,
      monthlyCost: u.monthly_cost,
      minLevel: u.min_level,
      effects: u.effects,
      installTimeHours: u.install_time_hours,
      icon: u.icon,
      canInstall: player.level >= u.min_level && player.cash >= u.cost,
      canAfford: player.cash >= u.cost,
      meetsLevel: player.level >= u.min_level,
      requiredUpgrade: u.required_upgrade_id ? {
        id: u.required_upgrade_id,
        isInstalled: installedIds.has(u.required_upgrade_id)
      } : null
    }));

    res.json({
      success: true,
      data: {
        propertyId,
        propertyType: property.property_type,
        category: property.category,
        upgradeSlots: property.upgrade_slots,
        usedSlots: installedIds.size,
        availableSlots: property.upgrade_slots - installedIds.size,
        upgrades: availableUpgrades,
        playerFunds: player.cash
      }
    });
  } catch (error) {
    console.error('Get available upgrades error:', error);
    res.status(500).json({ success: false, error: 'Failed to get available upgrades' });
  }
});

// POST /api/property-upgrades/:propertyId/install - Install an upgrade
router.post('/:propertyId/install', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { upgradeTypeId } = req.body;

    if (!upgradeTypeId) {
      res.status(400).json({ success: false, error: 'Upgrade type ID required' });
      return;
    }

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.property_type, pl.category, pl.upgrade_slots, pl.name
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

    // Check upgrade slots
    const installedCount = await pool.query(
      `SELECT COUNT(*) FROM property_upgrades WHERE property_id = $1`,
      [propertyId]
    );

    if (parseInt(installedCount.rows[0].count) >= property.upgrade_slots) {
      res.status(400).json({ success: false, error: 'No upgrade slots available' });
      return;
    }

    // Get upgrade type
    const upgradeResult = await pool.query(
      `SELECT * FROM property_upgrade_types WHERE id = $1`,
      [upgradeTypeId]
    );

    if (upgradeResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Upgrade type not found' });
      return;
    }

    const upgrade = upgradeResult.rows[0];

    // Check if applicable to this property type
    const isApplicable = upgrade.applicable_types.includes(property.property_type) ||
                         upgrade.applicable_categories.includes(property.category) ||
                         (upgrade.applicable_types.length === 0 && upgrade.applicable_categories.length === 0);

    if (!isApplicable) {
      res.status(400).json({ success: false, error: 'This upgrade cannot be installed on this property type' });
      return;
    }

    // Check if already installed
    const existingResult = await pool.query(
      `SELECT id FROM property_upgrades WHERE property_id = $1 AND upgrade_type_id = $2`,
      [propertyId, upgradeTypeId]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Upgrade already installed' });
      return;
    }

    // Check required upgrade
    if (upgrade.required_upgrade_id) {
      const reqResult = await pool.query(
        `SELECT id FROM property_upgrades WHERE property_id = $1 AND upgrade_type_id = $2`,
        [propertyId, upgrade.required_upgrade_id]
      );

      if (reqResult.rows.length === 0) {
        res.status(400).json({ success: false, error: 'Required prerequisite upgrade not installed' });
        return;
      }
    }

    // Check player funds and level
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.level < upgrade.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${upgrade.min_level}` });
      return;
    }

    if (player.cash < upgrade.cost) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Deduct cost
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [upgrade.cost, playerId]
    );

    // Calculate installation completion time
    const installingUntil = upgrade.install_time_hours > 0
      ? new Date(Date.now() + upgrade.install_time_hours * 60 * 60 * 1000)
      : null;

    // Install upgrade
    await pool.query(
      `INSERT INTO property_upgrades (property_id, upgrade_type_id, installing_until)
       VALUES ($1, $2, $3)`,
      [propertyId, upgradeTypeId, installingUntil]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO currency_transactions (player_id, currency_type, amount, transaction_type, description)
       VALUES ($1, 'cash', $2, 'spend', $3)`,
      [playerId, -upgrade.cost, `Installed ${upgrade.name} at ${property.name}`]
    );

    res.json({
      success: true,
      data: {
        message: `Installing ${upgrade.name} at ${property.name}`,
        upgrade: {
          name: upgrade.name,
          effects: upgrade.effects,
          icon: upgrade.icon
        },
        cost: upgrade.cost,
        monthlyCost: upgrade.monthly_cost,
        installTimeHours: upgrade.install_time_hours,
        completesAt: installingUntil
      }
    });
  } catch (error) {
    console.error('Install upgrade error:', error);
    res.status(500).json({ success: false, error: 'Failed to install upgrade' });
  }
});

// POST /api/property-upgrades/:propertyId/remove - Remove an upgrade
router.post('/:propertyId/remove', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { upgradeId } = req.body;

    if (!upgradeId) {
      res.status(400).json({ success: false, error: 'Upgrade ID required' });
      return;
    }

    // Verify ownership
    const propertyResult = await pool.query(
      `SELECT op.id, pl.name FROM owned_properties op
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE op.id = $1 AND op.owner_id = $2`,
      [propertyId, playerId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    // Get upgrade info
    const upgradeResult = await pool.query(
      `SELECT pu.*, put.name, put.cost
       FROM property_upgrades pu
       JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
       WHERE pu.id = $1 AND pu.property_id = $2`,
      [upgradeId, propertyId]
    );

    if (upgradeResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Upgrade not found' });
      return;
    }

    const upgrade = upgradeResult.rows[0];

    // Check if any other upgrade depends on this one
    const dependentResult = await pool.query(
      `SELECT put.name FROM property_upgrades pu
       JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
       WHERE pu.property_id = $1 AND put.required_upgrade_id = $2`,
      [propertyId, upgrade.upgrade_type_id]
    );

    if (dependentResult.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot remove: ${dependentResult.rows[0].name} depends on this upgrade`
      });
      return;
    }

    // Remove upgrade (no refund)
    await pool.query(
      `DELETE FROM property_upgrades WHERE id = $1`,
      [upgradeId]
    );

    res.json({
      success: true,
      data: {
        message: `Removed ${upgrade.name}`,
        note: 'Upgrades are not refunded when removed'
      }
    });
  } catch (error) {
    console.error('Remove upgrade error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove upgrade' });
  }
});

// POST /api/property-upgrades/:propertyId/toggle - Enable/disable an upgrade
router.post('/:propertyId/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { upgradeId, enabled } = req.body;

    if (!upgradeId || enabled === undefined) {
      res.status(400).json({ success: false, error: 'Upgrade ID and enabled status required' });
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

    // Update upgrade status
    const result = await pool.query(
      `UPDATE property_upgrades SET is_active = $1
       WHERE id = $2 AND property_id = $3
       RETURNING id`,
      [enabled, upgradeId, propertyId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Upgrade not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        message: `Upgrade ${enabled ? 'enabled' : 'disabled'}`,
        isActive: enabled
      }
    });
  } catch (error) {
    console.error('Toggle upgrade error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle upgrade' });
  }
});

export default router;
