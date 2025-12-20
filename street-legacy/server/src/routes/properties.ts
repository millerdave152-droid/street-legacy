import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { withTransaction, lockRowForUpdate } from '../db/transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import { logDistrictEvent } from '../services/districtEcosystem.service.js';

// Schema for property ID params
const propertyIdParamSchema = z.object({
  params: z.object({
    propertyId: z.string().regex(/^\d+$/, 'Invalid property ID')
  })
});

const router = Router();

router.use(authMiddleware);

// Helper to get district ID string for ecosystem tracking
async function getDistrictIdString(districtNumericId: number): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT LOWER(REPLACE(name, ' ', '_')) as district_id FROM districts WHERE id = $1`,
      [districtNumericId]
    );
    return result.rows[0]?.district_id || null;
  } catch {
    return null;
  }
}

// GET /api/properties - Get all properties and player-owned properties
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player
    const playerResult = await pool.query(
      `SELECT level, cash, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all properties with ownership info
    const propertiesResult = await pool.query(
      `SELECT p.*,
              d.name as district_name,
              pp.id as owned_id,
              pp.purchased_at,
              pp.last_collected_at,
              pp.upgrade_level
       FROM properties p
       JOIN districts d ON p.district_id = d.id
       LEFT JOIN player_properties pp ON p.id = pp.property_id AND pp.player_id = $1
       ORDER BY p.min_level, p.purchase_price`,
      [playerId]
    );

    const properties = propertiesResult.rows.map(prop => {
      const isOwned = !!prop.owned_id;
      let pendingIncome = 0;

      if (isOwned && prop.daily_income > 0) {
        const lastCollected = new Date(prop.last_collected_at);
        const now = new Date();
        const hoursSinceCollection = (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60);
        const upgradeMultiplier = 1 + (prop.upgrade_level - 1) * 0.25;
        pendingIncome = Math.floor((prop.daily_income / 24) * hoursSinceCollection * upgradeMultiplier);
      }

      return {
        id: prop.id,
        name: prop.name,
        description: prop.description,
        districtId: prop.district_id,
        districtName: prop.district_name,
        propertyType: prop.property_type,
        purchasePrice: prop.purchase_price,
        dailyIncome: prop.daily_income,
        storageCapacity: prop.storage_capacity,
        heatReduction: prop.heat_reduction,
        minLevel: prop.min_level,
        isOwned,
        purchasedAt: prop.purchased_at,
        lastCollectedAt: prop.last_collected_at,
        upgradeLevel: prop.upgrade_level || 1,
        pendingIncome,
        canAfford: player.cash >= prop.purchase_price,
        meetsLevel: player.level >= prop.min_level || player.is_master
      };
    });

    // Calculate total passive income
    const ownedProperties = properties.filter(p => p.isOwned);
    const totalDailyIncome = ownedProperties.reduce((sum, p) => {
      const upgradeMultiplier = 1 + (p.upgradeLevel - 1) * 0.25;
      return sum + Math.floor(p.dailyIncome * upgradeMultiplier);
    }, 0);
    const totalPendingIncome = ownedProperties.reduce((sum, p) => sum + p.pendingIncome, 0);

    res.json({
      success: true,
      data: {
        properties,
        playerCash: player.cash,
        playerLevel: player.level,
        totalDailyIncome,
        totalPendingIncome,
        propertiesOwned: ownedProperties.length
      }
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ success: false, error: 'Failed to get properties' });
  }
});

// POST /api/properties/buy/:propertyId - Purchase a property
router.post('/buy/:propertyId', validate(propertyIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    // Get property first (doesn't need lock)
    const propertyResult = await pool.query(
      `SELECT * FROM properties WHERE id = $1`,
      [propertyId]
    );

    if (propertyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    const property = propertyResult.rows[0];

    const result = await withTransaction(async (client) => {
      // Lock player row
      const player = await lockRowForUpdate<{ level: number; cash: number; is_master: boolean }>(
        client, 'players', playerId
      );
      if (!player) throw new Error('Player not found');

      const isMaster = player.is_master === true;

      // Check level requirement
      if (!isMaster && player.level < property.min_level) {
        throw new Error(`Requires level ${property.min_level}`);
      }

      // Check if already owned (within transaction)
      const existingResult = await client.query(
        `SELECT id FROM player_properties WHERE player_id = $1 AND property_id = $2 FOR UPDATE`,
        [playerId, propertyId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('You already own this property');
      }

      // Check funds (master bypass)
      if (!isMaster && player.cash < property.purchase_price) {
        throw new Error('Not enough cash');
      }

      // Purchase property
      if (!isMaster) {
        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [property.purchase_price, playerId]
        );
      }

      await client.query(
        `INSERT INTO player_properties (player_id, property_id) VALUES ($1, $2)`,
        [playerId, propertyId]
      );

      return {
        message: `You purchased ${property.name}!`,
        propertyName: property.name,
        cost: isMaster ? 0 : property.purchase_price,
        dailyIncome: property.daily_income,
        districtId: property.district_id
      };
    });

    res.json({ success: true, data: result });

    // Log district ecosystem event (non-blocking)
    if (result.districtId) {
      getDistrictIdString(result.districtId).then(districtIdStr => {
        if (districtIdStr) {
          logDistrictEvent({
            districtId: districtIdStr,
            eventType: 'property_bought',
            playerId: String(playerId),
            severity: Math.min(10, Math.ceil(property.purchase_price / 100000)),
            metadata: {
              propertyId,
              propertyName: result.propertyName,
              price: result.cost
            }
          }).catch(err => console.error('District ecosystem log error:', err));
        }
      }).catch(err => console.error('District ID lookup error:', err));
    }
  } catch (error: any) {
    console.error('Buy property error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to purchase property' });
  }
});

// POST /api/properties/collect - Collect income from all properties
router.post('/collect', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await withTransaction(async (client) => {
      // Lock player row
      const player = await lockRowForUpdate(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      // Get and lock all owned properties with income
      const propertiesResult = await client.query(
        `SELECT pp.*, p.daily_income, p.name
         FROM player_properties pp
         JOIN properties p ON pp.property_id = p.id
         WHERE pp.player_id = $1 AND p.daily_income > 0
         FOR UPDATE OF pp`,
        [playerId]
      );

      if (propertiesResult.rows.length === 0) {
        throw new Error('No properties with income to collect');
      }

      let totalCollected = 0;
      const now = new Date();

      for (const prop of propertiesResult.rows) {
        const lastCollected = new Date(prop.last_collected_at);
        const hoursSinceCollection = (now.getTime() - lastCollected.getTime()) / (1000 * 60 * 60);
        const upgradeMultiplier = 1 + (prop.upgrade_level - 1) * 0.25;
        const income = Math.floor((prop.daily_income / 24) * hoursSinceCollection * upgradeMultiplier);

        if (income > 0) {
          totalCollected += income;
        }
      }

      if (totalCollected === 0) {
        throw new Error('No income ready to collect yet');
      }

      // Update player cash and reset collection time
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [totalCollected, playerId]
      );

      await client.query(
        `UPDATE player_properties SET last_collected_at = NOW() WHERE player_id = $1`,
        [playerId]
      );

      return {
        message: `Collected $${totalCollected.toLocaleString()} from your properties!`,
        amount: totalCollected,
        propertiesCount: propertiesResult.rows.length
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Collect income error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to collect income' });
  }
});

// POST /api/properties/upgrade/:propertyId - Upgrade a property
router.post('/upgrade/:propertyId', validate(propertyIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    const result = await withTransaction(async (client) => {
      // Lock player row
      const player = await lockRowForUpdate<{ cash: number; is_master: boolean }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      const isMaster = player.is_master === true;

      // Get and lock owned property
      const ownedResult = await client.query(
        `SELECT pp.*, p.purchase_price, p.name, p.daily_income
         FROM player_properties pp
         JOIN properties p ON pp.property_id = p.id
         WHERE pp.player_id = $1 AND pp.property_id = $2
         FOR UPDATE OF pp`,
        [playerId, propertyId]
      );

      if (ownedResult.rows.length === 0) {
        throw new Error('You do not own this property');
      }

      const owned = ownedResult.rows[0];
      const maxLevel = 5;

      if (owned.upgrade_level >= maxLevel) {
        throw new Error('Property is already at max level');
      }

      // Upgrade cost is 50% of purchase price per level
      const upgradeCost = Math.floor(owned.purchase_price * 0.5 * owned.upgrade_level);

      if (!isMaster && player.cash < upgradeCost) {
        throw new Error(`Need $${upgradeCost.toLocaleString()} to upgrade`);
      }

      // Upgrade
      if (!isMaster) {
        await client.query(
          `UPDATE players SET cash = cash - $1 WHERE id = $2`,
          [upgradeCost, playerId]
        );
      }

      await client.query(
        `UPDATE player_properties SET upgrade_level = upgrade_level + 1 WHERE player_id = $1 AND property_id = $2`,
        [playerId, propertyId]
      );

      const newLevel = owned.upgrade_level + 1;
      const newMultiplier = 1 + (newLevel - 1) * 0.25;
      const newDailyIncome = Math.floor(owned.daily_income * newMultiplier);

      return {
        message: `Upgraded ${owned.name} to level ${newLevel}!`,
        propertyName: owned.name,
        newLevel,
        cost: isMaster ? 0 : upgradeCost,
        newDailyIncome
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Upgrade property error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to upgrade property' });
  }
});

// POST /api/properties/sell/:propertyId - Sell a property
router.post('/sell/:propertyId', validate(propertyIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    const result = await withTransaction(async (client) => {
      // Lock player row
      const player = await lockRowForUpdate(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      // Get and lock owned property
      const ownedResult = await client.query(
        `SELECT pp.*, p.purchase_price, p.name, p.district_id
         FROM player_properties pp
         JOIN properties p ON pp.property_id = p.id
         WHERE pp.player_id = $1 AND pp.property_id = $2
         FOR UPDATE OF pp`,
        [playerId, propertyId]
      );

      if (ownedResult.rows.length === 0) {
        throw new Error('You do not own this property');
      }

      const owned = ownedResult.rows[0];

      // Sell price is 50% of purchase price plus upgrades
      const basePrice = Math.floor(owned.purchase_price * 0.5);
      const upgradeValue = Math.floor(owned.purchase_price * 0.25 * (owned.upgrade_level - 1));
      const sellPrice = basePrice + upgradeValue;

      // Sell property
      await client.query(
        `DELETE FROM player_properties WHERE player_id = $1 AND property_id = $2`,
        [playerId, propertyId]
      );

      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [sellPrice, playerId]
      );

      return {
        message: `Sold ${owned.name} for $${sellPrice.toLocaleString()}!`,
        propertyName: owned.name,
        sellPrice,
        districtId: owned.district_id
      };
    });

    res.json({ success: true, data: result });

    // Log district ecosystem event (non-blocking)
    if (result.districtId) {
      getDistrictIdString(result.districtId).then(districtIdStr => {
        if (districtIdStr) {
          logDistrictEvent({
            districtId: districtIdStr,
            eventType: 'property_sold',
            playerId: String(playerId),
            severity: Math.min(10, Math.ceil(result.sellPrice / 50000)),
            metadata: {
              propertyId,
              propertyName: result.propertyName,
              sellPrice: result.sellPrice
            }
          }).catch(err => console.error('District ecosystem log error:', err));
        }
      }).catch(err => console.error('District ID lookup error:', err));
    }
  } catch (error: any) {
    console.error('Sell property error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to sell property' });
  }
});

export default router;
