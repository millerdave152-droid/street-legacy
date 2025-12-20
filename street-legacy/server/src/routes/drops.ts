import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All drop routes require auth
router.use(authMiddleware);

// Rewards type for drop zones
interface DropRewards {
  cashMin?: number;
  cashMax?: number;
  items?: boolean;
  multiplier?: number;
  heatReduction?: boolean;
  rep?: number;
  mission?: boolean;
  xp?: number;
}

interface DropTypeConfig {
  name: string;
  icon: string;
  emoji: string;
  color: string;
  duration: number;
  maxClaims: number;
  rewards: DropRewards;
  action: string;
  description: string;
}

// Drop zone types with their configurations
const DROP_TYPES: Record<string, DropTypeConfig> = {
  cash_drop: {
    name: 'Cash Drop',
    icon: 'briefcase',
    emoji: '💼',
    color: '#22c55e',
    duration: 15, // minutes
    maxClaims: 1,
    rewards: { cashMin: 5000, cashMax: 50000 },
    action: 'grab',
    description: 'Abandoned briefcase full of cash'
  },
  supply_crate: {
    name: 'Supply Crate',
    icon: 'crate',
    emoji: '📦',
    color: '#f59e0b',
    duration: 20,
    maxClaims: 3,
    rewards: { items: true },
    action: 'lockpick',
    description: 'Military supply crate with valuable gear'
  },
  hot_zone: {
    name: 'Hot Zone',
    icon: 'fire',
    emoji: '🔥',
    color: '#ef4444',
    duration: 30,
    maxClaims: 999,
    rewards: { multiplier: 2.0 },
    action: 'enter',
    description: '2x crime rewards in this area'
  },
  police_void: {
    name: 'Police Void',
    icon: 'shield',
    emoji: '🛡️',
    color: '#3b82f6',
    duration: 20,
    maxClaims: 999,
    rewards: { heatReduction: true },
    action: 'enter',
    description: 'Zero heat gain in this zone'
  },
  turf_battle: {
    name: 'Turf Battle',
    icon: 'swords',
    emoji: '⚔️',
    color: '#a855f7',
    duration: 25,
    maxClaims: 1,
    rewards: { cashMin: 10000, cashMax: 100000, rep: 500 },
    action: 'fight',
    description: 'PvP zone - winner takes all'
  },
  informant: {
    name: 'Informant',
    icon: 'spy',
    emoji: '🕵️',
    color: '#0ea5e9',
    duration: 10,
    maxClaims: 1,
    rewards: { mission: true, xp: 500 },
    action: 'talk',
    description: 'Mysterious informant with a special job'
  }
};

// Possible items from supply crates
const SUPPLY_ITEMS = [
  { name: 'Lockpick Set', type: 'tool', rarity: 'common', value: 500 },
  { name: 'Kevlar Vest', type: 'armor', rarity: 'uncommon', value: 2000 },
  { name: 'Glock 19', type: 'weapon', rarity: 'uncommon', value: 3000 },
  { name: 'Hacking Device', type: 'tool', rarity: 'rare', value: 5000 },
  { name: 'AK-47', type: 'weapon', rarity: 'rare', value: 8000 },
  { name: 'Night Vision Goggles', type: 'gear', rarity: 'rare', value: 6000 },
  { name: 'C4 Explosive', type: 'tool', rarity: 'epic', value: 15000 },
  { name: 'RPG Launcher', type: 'weapon', rarity: 'epic', value: 25000 },
  { name: 'Stealth Suit', type: 'armor', rarity: 'legendary', value: 50000 }
];

// Toronto spawn points for drops (spread across the city)
const SPAWN_POINTS = [
  { lat: 43.6532, lng: -79.3832, district: 'Downtown Core' },
  { lat: 43.6453, lng: -79.3806, district: 'Downtown Core' },
  { lat: 43.6544, lng: -79.3807, district: 'Downtown Core' },
  { lat: 43.6576, lng: -79.4012, district: 'Kensington Market' },
  { lat: 43.6560, lng: -79.4020, district: 'Kensington Market' },
  { lat: 43.7752, lng: -79.2578, district: 'Scarborough' },
  { lat: 43.8060, lng: -79.2170, district: 'Scarborough' },
  { lat: 43.7420, lng: -79.2350, district: 'Scarborough' },
  { lat: 43.7650, lng: -79.5150, district: 'York' },
  { lat: 43.7254, lng: -79.4522, district: 'York' },
  { lat: 43.7170, lng: -79.6030, district: 'Etobicoke' },
  { lat: 43.6120, lng: -79.5570, district: 'Etobicoke' },
  { lat: 43.7615, lng: -79.4111, district: 'North York' },
  { lat: 43.7780, lng: -79.3460, district: 'North York' },
  { lat: 43.6840, lng: -79.3270, district: 'East York' },
  { lat: 43.6410, lng: -79.4300, district: 'Parkdale' },
  { lat: 43.6390, lng: -79.4395, district: 'Parkdale' },
  { lat: 43.6487, lng: -79.3715, district: 'Downtown Core' },
  { lat: 43.7807, lng: -79.4149, district: 'North York' },
  { lat: 43.6050, lng: -79.5200, district: 'Etobicoke' }
];

// GET /api/drops/active - Get all active drop zones
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM drop_zones
       WHERE expire_time > NOW()
       AND (max_claims IS NULL OR current_claims < max_claims)
       ORDER BY spawn_time DESC`
    );

    const drops = result.rows.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lng),
      radiusMeters: d.radius_meters,
      rewards: d.rewards,
      spawnTime: d.spawn_time,
      expireTime: d.expire_time,
      maxClaims: d.max_claims,
      currentClaims: d.current_claims,
      requiredLevel: d.required_level,
      requiredRep: d.required_rep,
      config: DROP_TYPES[d.type as keyof typeof DROP_TYPES] || DROP_TYPES.cash_drop
    }));

    res.json({ success: true, data: { drops } });
  } catch (error) {
    console.error('Active drops error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drops' });
  }
});

// GET /api/drops/nearby - Get drops within range of player
router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { range = 5 } = req.query; // km range

    // Get player location
    const playerResult = await pool.query(
      'SELECT location_lat, location_lng FROM players WHERE id = $1',
      [playerId]
    );
    const player = playerResult.rows[0];
    const playerLat = parseFloat(player.location_lat) || 43.6532;
    const playerLng = parseFloat(player.location_lng) || -79.3832;

    // Get active drops
    const result = await pool.query(
      `SELECT * FROM drop_zones
       WHERE expire_time > NOW()
       AND (max_claims IS NULL OR current_claims < max_claims)
       ORDER BY spawn_time DESC`
    );

    // Filter by distance
    const nearbyDrops = result.rows
      .map(d => {
        const distance = calculateDistance(
          playerLat, playerLng,
          parseFloat(d.lat), parseFloat(d.lng)
        );
        return {
          id: d.id,
          name: d.name,
          type: d.type,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lng),
          radiusMeters: d.radius_meters,
          rewards: d.rewards,
          spawnTime: d.spawn_time,
          expireTime: d.expire_time,
          maxClaims: d.max_claims,
          currentClaims: d.current_claims,
          requiredLevel: d.required_level,
          requiredRep: d.required_rep,
          distance: Math.round(distance * 100) / 100,
          travelTime: Math.ceil(distance), // 1 min per km
          config: DROP_TYPES[d.type as keyof typeof DROP_TYPES] || DROP_TYPES.cash_drop
        };
      })
      .filter(d => d.distance <= Number(range))
      .sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      data: {
        drops: nearbyDrops,
        playerLocation: { lat: playerLat, lng: playerLng }
      }
    });
  } catch (error) {
    console.error('Nearby drops error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nearby drops' });
  }
});

// POST /api/drops/:id/claim - Claim a drop
router.post('/:id/claim', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const playerId = req.player!.id;
    const dropId = parseInt(req.params.id);

    // Get player info
    const playerResult = await client.query(
      `SELECT id, username, level, location_lat, location_lng, cash, crypto,
              street_rep, stamina, focus, heat, is_master
       FROM players WHERE id = $1 FOR UPDATE`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get drop info
    const dropResult = await client.query(
      `SELECT * FROM drop_zones WHERE id = $1 FOR UPDATE`,
      [dropId]
    );
    const drop = dropResult.rows[0];

    if (!drop) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Drop zone not found' });
      return;
    }

    // Check if expired
    if (new Date(drop.expire_time) < new Date()) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: 'Drop zone has expired' });
      return;
    }

    // Check if fully claimed
    if (drop.max_claims && drop.current_claims >= drop.max_claims) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: 'Drop zone already claimed' });
      return;
    }

    // Check level requirement
    if (drop.required_level && player.level < drop.required_level && !player.is_master) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: `Requires level ${drop.required_level}` });
      return;
    }

    // Check if already claimed by this player
    const claimCheck = await client.query(
      'SELECT id FROM drop_claims WHERE drop_id = $1 AND player_id = $2',
      [dropId, playerId]
    );
    if (claimCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: 'You already claimed this drop' });
      return;
    }

    // Check distance (must be within 500m or travel there)
    const playerLat = parseFloat(player.location_lat) || 43.6532;
    const playerLng = parseFloat(player.location_lng) || -79.3832;
    const distance = calculateDistance(playerLat, playerLng, parseFloat(drop.lat), parseFloat(drop.lng));

    if (distance > 0.5 && !player.is_master) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        error: `Too far away! You are ${distance.toFixed(2)}km away. Get within 500m to claim.`
      });
      return;
    }

    // Process claim based on drop type
    const dropType = DROP_TYPES[drop.type as keyof typeof DROP_TYPES] || DROP_TYPES.cash_drop;
    const rewards: any = { claimed: true };

    // Calculate rewards
    if (drop.rewards.cashMin && drop.rewards.cashMax) {
      rewards.cash = Math.floor(Math.random() * (drop.rewards.cashMax - drop.rewards.cashMin + 1)) + drop.rewards.cashMin;
    }
    if (drop.rewards.crypto) {
      rewards.crypto = drop.rewards.crypto;
    }
    if (drop.rewards.rep) {
      rewards.rep = drop.rewards.rep;
    }
    if (drop.rewards.xp) {
      rewards.xp = drop.rewards.xp;
    }
    if (drop.rewards.items) {
      // Random item from supply crate
      const rarity = Math.random();
      let itemPool = SUPPLY_ITEMS.filter(i => {
        if (rarity < 0.5) return i.rarity === 'common';
        if (rarity < 0.8) return i.rarity === 'uncommon';
        if (rarity < 0.95) return i.rarity === 'rare';
        if (rarity < 0.99) return i.rarity === 'epic';
        return i.rarity === 'legendary';
      });
      if (itemPool.length === 0) itemPool = SUPPLY_ITEMS.filter(i => i.rarity === 'common');
      rewards.item = itemPool[Math.floor(Math.random() * itemPool.length)];
    }
    if (drop.rewards.multiplier) {
      rewards.buffType = 'crime_multiplier';
      rewards.buffValue = drop.rewards.multiplier;
      rewards.buffDuration = dropType.duration; // minutes
    }
    if (drop.rewards.heatReduction) {
      rewards.buffType = 'no_heat';
      rewards.buffDuration = dropType.duration;
    }

    // Apply rewards
    let updateQuery = 'UPDATE players SET ';
    const updateParts = [];
    const updateValues = [];
    let paramIndex = 1;

    if (rewards.cash) {
      updateParts.push(`cash = cash + $${paramIndex}`);
      updateValues.push(rewards.cash);
      paramIndex++;
    }
    if (rewards.crypto) {
      updateParts.push(`crypto = crypto + $${paramIndex}`);
      updateValues.push(rewards.crypto);
      paramIndex++;
    }
    if (rewards.rep) {
      updateParts.push(`street_rep = COALESCE(street_rep, 0) + $${paramIndex}`);
      updateValues.push(rewards.rep);
      paramIndex++;
    }
    if (rewards.xp) {
      updateParts.push(`xp = xp + $${paramIndex}`);
      updateValues.push(rewards.xp);
      paramIndex++;
    }

    if (updateParts.length > 0) {
      updateQuery += updateParts.join(', ') + ` WHERE id = $${paramIndex}`;
      updateValues.push(playerId);
      await client.query(updateQuery, updateValues);
    }

    // Record the claim
    await client.query(
      `INSERT INTO drop_claims (drop_id, player_id, claimed_at, rewards_received)
       VALUES ($1, $2, NOW(), $3)`,
      [dropId, playerId, JSON.stringify(rewards)]
    );

    // Increment claim count
    await client.query(
      'UPDATE drop_zones SET current_claims = current_claims + 1 WHERE id = $1',
      [dropId]
    );

    // If item was received, add to inventory
    if (rewards.item) {
      await client.query(
        `INSERT INTO inventory (player_id, item_type, item_name, item_data, quantity)
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (player_id, item_name)
         DO UPDATE SET quantity = inventory.quantity + 1`,
        [playerId, rewards.item.type, rewards.item.name, JSON.stringify(rewards.item)]
      );
    }

    // If buff was received, add to player buffs
    if (rewards.buffType) {
      const buffExpires = new Date(Date.now() + rewards.buffDuration * 60000);
      await client.query(
        `INSERT INTO player_buffs (player_id, buff_type, buff_value, expires_at, source)
         VALUES ($1, $2, $3, $4, $5)`,
        [playerId, rewards.buffType, rewards.buffValue || 1, buffExpires, `drop_${drop.type}`]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Claimed ${dropType.name}!`,
        rewards,
        dropType: drop.type
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Claim drop error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim drop' });
  } finally {
    client.release();
  }
});

// Admin/System: Spawn new drops (called by scheduler)
export async function spawnDrops(count: number = 3) {
  try {
    const dropTypes = Object.keys(DROP_TYPES);
    const spawned = [];

    for (let i = 0; i < count; i++) {
      // Random type (weighted)
      const typeRoll = Math.random();
      let type: string;
      if (typeRoll < 0.35) type = 'cash_drop';
      else if (typeRoll < 0.55) type = 'supply_crate';
      else if (typeRoll < 0.70) type = 'hot_zone';
      else if (typeRoll < 0.82) type = 'police_void';
      else if (typeRoll < 0.92) type = 'turf_battle';
      else type = 'informant';

      const config = DROP_TYPES[type as keyof typeof DROP_TYPES];

      // Random spawn point
      const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
      // Add some randomness to exact position
      const lat = spawnPoint.lat + (Math.random() - 0.5) * 0.01;
      const lng = spawnPoint.lng + (Math.random() - 0.5) * 0.01;

      const now = new Date();
      const expireTime = new Date(now.getTime() + config.duration * 60000);

      // Build rewards object
      const rewards: any = {};
      if (config.rewards.cashMin) {
        rewards.cashMin = config.rewards.cashMin;
        rewards.cashMax = config.rewards.cashMax;
      }
      if (config.rewards.items) rewards.items = true;
      if (config.rewards.multiplier) rewards.multiplier = config.rewards.multiplier;
      if (config.rewards.heatReduction) rewards.heatReduction = true;
      if (config.rewards.mission) rewards.mission = true;
      if (config.rewards.xp) rewards.xp = config.rewards.xp;
      if (config.rewards.rep) rewards.rep = config.rewards.rep;

      // Random level requirement
      const requiredLevel = Math.floor(Math.random() * 10) + 1;

      const result = await pool.query(
        `INSERT INTO drop_zones
         (name, type, lat, lng, radius_meters, rewards, spawn_time, expire_time, max_claims, current_claims, required_level, required_rep, district)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, 0, $11)
         RETURNING id`,
        [
          config.name,
          type,
          lat,
          lng,
          100 + Math.floor(Math.random() * 200), // 100-300m radius
          JSON.stringify(rewards),
          now,
          expireTime,
          config.maxClaims,
          requiredLevel,
          spawnPoint.district
        ]
      );

      spawned.push({
        id: result.rows[0].id,
        type,
        name: config.name,
        lat,
        lng,
        expireTime
      });
    }

    console.log(`Spawned ${spawned.length} drop zones`);
    return spawned;
  } catch (error) {
    console.error('Spawn drops error:', error);
    return [];
  }
}

// Clean up expired drops
export async function cleanupExpiredDrops() {
  try {
    const result = await pool.query(
      `DELETE FROM drop_zones WHERE expire_time < NOW() RETURNING id`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} expired drops`);
    }
  } catch (error) {
    console.error('Cleanup drops error:', error);
  }
}

// Helper function to calculate distance between two points (in km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router;
