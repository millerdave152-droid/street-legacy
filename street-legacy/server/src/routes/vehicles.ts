import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/vehicles - Get vehicle dealership and player garage
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all vehicles with ownership status
    const vehiclesResult = await pool.query(
      `SELECT v.*,
              CASE WHEN pv.id IS NOT NULL THEN true ELSE false END as owned,
              pv.condition,
              pv.is_active,
              pv.purchased_at
       FROM vehicles v
       LEFT JOIN player_vehicles pv ON v.id = pv.vehicle_id AND pv.player_id = $1
       ORDER BY v.min_level, v.price`,
      [playerId]
    );

    // Get active vehicle
    const activeResult = await pool.query(
      `SELECT pv.*, v.name, v.type, v.speed_bonus, v.crime_bonus, v.escape_bonus, v.image
       FROM player_vehicles pv
       JOIN vehicles v ON pv.vehicle_id = v.id
       WHERE pv.player_id = $1 AND pv.is_active = true`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        playerCash: player.cash,
        playerLevel: player.level,
        activeVehicle: activeResult.rows[0] ? {
          id: activeResult.rows[0].vehicle_id,
          name: activeResult.rows[0].name,
          type: activeResult.rows[0].type,
          condition: activeResult.rows[0].condition,
          speedBonus: activeResult.rows[0].speed_bonus,
          crimeBonus: activeResult.rows[0].crime_bonus,
          escapeBonus: activeResult.rows[0].escape_bonus,
          image: activeResult.rows[0].image
        } : null,
        vehicles: vehiclesResult.rows.map(v => ({
          id: v.id,
          name: v.name,
          type: v.type,
          description: v.description,
          price: v.price,
          minLevel: v.min_level,
          speedBonus: v.speed_bonus,
          crimeBonus: v.crime_bonus,
          escapeBonus: v.escape_bonus,
          repairCost: v.repair_cost,
          image: v.image,
          owned: v.owned,
          condition: v.condition || 100,
          isActive: v.is_active || false,
          canBuy: !v.owned && player.level >= v.min_level && player.cash >= v.price
        }))
      }
    });
  } catch (error) {
    console.error('Vehicles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get vehicles' });
  }
});

// POST /api/vehicles/buy - Purchase a vehicle
router.post('/buy', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      res.status(400).json({ success: false, error: 'Vehicle ID required' });
      return;
    }

    // Get vehicle
    const vehicleResult = await pool.query(`SELECT * FROM vehicles WHERE id = $1`, [vehicleId]);
    const vehicle = vehicleResult.rows[0];

    if (!vehicle) {
      res.status(404).json({ success: false, error: 'Vehicle not found' });
      return;
    }

    // Get player
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Check level
    if (player.level < vehicle.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${vehicle.min_level}` });
      return;
    }

    // Check ownership
    const ownedResult = await pool.query(
      `SELECT id FROM player_vehicles WHERE player_id = $1 AND vehicle_id = $2`,
      [playerId, vehicleId]
    );
    if (ownedResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Vehicle already owned' });
      return;
    }

    // Check cash
    if (player.cash < vehicle.price) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Purchase
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [vehicle.price, playerId]
    );

    // Set other vehicles to not active
    await pool.query(
      `UPDATE player_vehicles SET is_active = false WHERE player_id = $1`,
      [playerId]
    );

    // Add vehicle as active
    await pool.query(
      `INSERT INTO player_vehicles (player_id, vehicle_id, condition, is_active)
       VALUES ($1, $2, 100, true)`,
      [playerId, vehicleId]
    );

    res.json({
      success: true,
      data: {
        message: `Purchased ${vehicle.name}!`,
        vehicle: {
          id: vehicle.id,
          name: vehicle.name,
          type: vehicle.type
        },
        newCash: player.cash - vehicle.price
      }
    });
  } catch (error) {
    console.error('Buy vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase vehicle' });
  }
});

// POST /api/vehicles/activate - Set a vehicle as active
router.post('/activate', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      res.status(400).json({ success: false, error: 'Vehicle ID required' });
      return;
    }

    // Check ownership
    const ownershipResult = await pool.query(
      `SELECT pv.*, v.name FROM player_vehicles pv
       JOIN vehicles v ON pv.vehicle_id = v.id
       WHERE pv.player_id = $1 AND pv.vehicle_id = $2`,
      [playerId, vehicleId]
    );

    if (ownershipResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Vehicle not in garage' });
      return;
    }

    const vehicle = ownershipResult.rows[0];

    if (vehicle.condition <= 0) {
      res.status(400).json({ success: false, error: 'Vehicle is totaled! Repair it first.' });
      return;
    }

    // Deactivate all
    await pool.query(
      `UPDATE player_vehicles SET is_active = false WHERE player_id = $1`,
      [playerId]
    );

    // Activate selected
    await pool.query(
      `UPDATE player_vehicles SET is_active = true WHERE player_id = $1 AND vehicle_id = $2`,
      [playerId, vehicleId]
    );

    res.json({
      success: true,
      data: {
        message: `Now driving ${vehicle.name}`,
        vehicleId
      }
    });
  } catch (error) {
    console.error('Activate vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to activate vehicle' });
  }
});

// POST /api/vehicles/repair - Repair a vehicle
router.post('/repair', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      res.status(400).json({ success: false, error: 'Vehicle ID required' });
      return;
    }

    // Get vehicle and ownership
    const ownershipResult = await pool.query(
      `SELECT pv.*, v.name, v.repair_cost FROM player_vehicles pv
       JOIN vehicles v ON pv.vehicle_id = v.id
       WHERE pv.player_id = $1 AND pv.vehicle_id = $2`,
      [playerId, vehicleId]
    );

    if (ownershipResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Vehicle not in garage' });
      return;
    }

    const vehicle = ownershipResult.rows[0];

    if (vehicle.condition >= 100) {
      res.status(400).json({ success: false, error: 'Vehicle is already at full condition' });
      return;
    }

    // Calculate repair cost based on damage
    const damage = 100 - vehicle.condition;
    const repairCost = Math.ceil((damage / 100) * vehicle.repair_cost);

    // Check cash
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.cash < repairCost) {
      res.status(400).json({ success: false, error: `Need ${repairCost.toLocaleString()} to repair` });
      return;
    }

    // Repair
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [repairCost, playerId]
    );

    await pool.query(
      `UPDATE player_vehicles SET condition = 100 WHERE player_id = $1 AND vehicle_id = $2`,
      [playerId, vehicleId]
    );

    res.json({
      success: true,
      data: {
        message: `Repaired ${vehicle.name} for $${repairCost.toLocaleString()}`,
        newCash: player.cash - repairCost,
        newCondition: 100
      }
    });
  } catch (error) {
    console.error('Repair vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to repair vehicle' });
  }
});

// POST /api/vehicles/sell - Sell a vehicle
router.post('/sell', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      res.status(400).json({ success: false, error: 'Vehicle ID required' });
      return;
    }

    // Get vehicle and ownership
    const ownershipResult = await pool.query(
      `SELECT pv.*, v.name, v.price FROM player_vehicles pv
       JOIN vehicles v ON pv.vehicle_id = v.id
       WHERE pv.player_id = $1 AND pv.vehicle_id = $2`,
      [playerId, vehicleId]
    );

    if (ownershipResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Vehicle not in garage' });
      return;
    }

    const vehicle = ownershipResult.rows[0];

    // Sell value is 50% of price, adjusted by condition
    const sellValue = Math.floor((vehicle.price * 0.5) * (vehicle.condition / 100));

    // Sell
    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [sellValue, playerId]
    );

    await pool.query(
      `DELETE FROM player_vehicles WHERE player_id = $1 AND vehicle_id = $2`,
      [playerId, vehicleId]
    );

    res.json({
      success: true,
      data: {
        message: `Sold ${vehicle.name} for $${sellValue.toLocaleString()}`,
        cashGained: sellValue
      }
    });
  } catch (error) {
    console.error('Sell vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to sell vehicle' });
  }
});

// POST /api/vehicles/race - Race against another player or NPC
router.post('/race', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bet, raceType } = req.body;

    if (!bet || bet < 100) {
      res.status(400).json({ success: false, error: 'Minimum bet is $100' });
      return;
    }

    // Get player cash and active vehicle
    const playerResult = await pool.query(
      `SELECT p.cash, pv.condition, v.name, v.speed_bonus
       FROM players p
       LEFT JOIN player_vehicles pv ON pv.player_id = p.id AND pv.is_active = true
       LEFT JOIN vehicles v ON pv.vehicle_id = v.id
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    if (player.cash < bet) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Must have a vehicle to race
    if (!player.name) {
      res.status(400).json({ success: false, error: 'You need a vehicle to race!' });
      return;
    }

    // Vehicle condition affects performance
    const conditionModifier = player.condition / 100;
    const playerSpeed = (50 + (player.speed_bonus || 0)) * conditionModifier + Math.random() * 30;

    // NPC speed based on race type
    let npcSpeed: number;
    let multiplier: number;
    switch (raceType) {
      case 'easy':
        npcSpeed = 40 + Math.random() * 25;
        multiplier = 1.5;
        break;
      case 'hard':
        npcSpeed = 70 + Math.random() * 30;
        multiplier = 3;
        break;
      default: // medium
        npcSpeed = 55 + Math.random() * 25;
        multiplier = 2;
    }

    const won = playerSpeed > npcSpeed;
    const payout = won ? Math.floor(bet * multiplier) : 0;

    // Apply cash change
    if (won) {
      await pool.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [payout - bet, playerId]
      );
    } else {
      await pool.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [bet, playerId]
      );
    }

    // Damage vehicle slightly from racing (1-5%)
    const damage = Math.floor(Math.random() * 5) + 1;
    await pool.query(
      `UPDATE player_vehicles SET condition = GREATEST(0, condition - $1)
       WHERE player_id = $2 AND is_active = true`,
      [damage, playerId]
    );

    res.json({
      success: true,
      data: {
        won,
        playerSpeed: Math.round(playerSpeed),
        npcSpeed: Math.round(npcSpeed),
        payout: won ? payout : -bet,
        damage,
        newCash: won ? player.cash + (payout - bet) : player.cash - bet,
        message: won
          ? `You won the race! Earned $${payout.toLocaleString()}`
          : `You lost the race! Lost $${bet.toLocaleString()}`
      }
    });
  } catch (error) {
    console.error('Race error:', error);
    res.status(500).json({ success: false, error: 'Failed to race' });
  }
});

export default router;
