import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Raid configuration
const RAID_CONFIG = {
  baseChancePerHour: 0.005, // 0.5% base chance per hour
  heatMultiplier: 2, // Each point of heat adds to chance
  maxChance: 0.15, // Max 15% chance per check
  cooldownHours: 24, // Can't be raided again for 24 hours
  evidenceDecayHours: 48 // Evidence found decays after 48 hours
};

// GET /api/property-raids/:propertyId/defense - Get property's defense status
router.get('/:propertyId/defense', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);

    // Get property with details
    const propertyResult = await pool.query(
      `SELECT op.*, pl.name, pl.base_price, pl.is_hidden
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

    // Get security upgrades
    const upgradesResult = await pool.query(
      `SELECT put.name, put.effects, put.icon
       FROM property_upgrades pu
       JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
       WHERE pu.property_id = $1 AND pu.is_active = true AND put.category = 'security'`,
      [propertyId]
    );

    // Calculate total defense rating
    let raidResistance = 0;
    let protectedInventory = 0;
    let protectedCash = 0;
    let hasAlert = false;
    let hasEscape = false;
    const securityFeatures: string[] = [];

    upgradesResult.rows.forEach(u => {
      const effects = u.effects || {};
      if (effects.raid_resistance) raidResistance += effects.raid_resistance;
      if (effects.protect_inventory_percent) protectedInventory = Math.max(protectedInventory, effects.protect_inventory_percent);
      if (effects.protect_cash_percent) protectedCash = Math.max(protectedCash, effects.protect_cash_percent);
      if (effects.alert_on_raid) hasAlert = true;
      if (effects.raid_escape) hasEscape = true;
      securityFeatures.push(`${u.icon} ${u.name}`);
    });

    // Hidden properties get bonus resistance
    if (property.is_hidden) {
      raidResistance += 25;
      securityFeatures.push('🔒 Hidden Location');
    }

    // Get security staff
    const staffResult = await pool.query(
      `SELECT COUNT(*) as guards FROM property_staff
       WHERE property_id = $1 AND staff_type = 'security_guard' AND is_active = true`,
      [propertyId]
    );
    const guardCount = parseInt(staffResult.rows[0].guards);
    if (guardCount > 0) {
      raidResistance += guardCount * 15;
      securityFeatures.push(`💂 ${guardCount} Security Guard(s)`);
    }

    // Get current operation heat
    const operationsResult = await pool.query(
      `SELECT SUM(current_heat) as total_heat FROM property_operations
       WHERE property_id = $1 AND status = 'running'`,
      [propertyId]
    );
    const operationHeat = parseInt(operationsResult.rows[0].total_heat) || 0;

    // Calculate raid chance
    const baseChance = RAID_CONFIG.baseChancePerHour * 100;
    const heatBonus = operationHeat * RAID_CONFIG.heatMultiplier / 10;
    const resistanceReduction = raidResistance / 2;
    const netChance = Math.max(0.1, Math.min(RAID_CONFIG.maxChance * 100, baseChance + heatBonus - resistanceReduction));

    // Check if on cooldown
    const isOnCooldown = property.raid_lockout_until && new Date(property.raid_lockout_until) > new Date();

    // Get recent raids
    const raidsResult = await pool.query(
      `SELECT * FROM property_raids WHERE property_id = $1 ORDER BY raided_at DESC LIMIT 5`,
      [propertyId]
    );

    res.json({
      success: true,
      data: {
        propertyId,
        propertyName: property.name,
        defense: {
          raidResistance,
          raidResistancePercent: Math.min(95, raidResistance),
          protectedInventoryPercent: protectedInventory,
          protectedCashPercent: protectedCash,
          hasAlertSystem: hasAlert,
          hasEscapeRoute: hasEscape,
          securityFeatures
        },
        threat: {
          operationHeat,
          estimatedRaidChancePercent: isOnCooldown ? 0 : netChance.toFixed(1),
          isOnCooldown,
          cooldownEndsAt: property.raid_lockout_until,
          riskLevel: netChance < 2 ? 'low' : netChance < 5 ? 'medium' : netChance < 10 ? 'high' : 'critical'
        },
        recentRaids: raidsResult.rows.map(r => ({
          id: r.id,
          type: r.raid_type,
          success: r.raid_success,
          cashSeized: r.cash_seized,
          propertyDamage: r.property_damage,
          raidedAt: r.raided_at
        })),
        recommendations: generateDefenseRecommendations(raidResistance, operationHeat, upgradesResult.rows)
      }
    });
  } catch (error) {
    console.error('Get defense status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get defense status' });
  }
});

function generateDefenseRecommendations(resistance: number, heat: number, upgrades: any[]): string[] {
  const recommendations: string[] = [];
  const upgradeNames = new Set(upgrades.map(u => u.name));

  if (resistance < 30) {
    if (!upgradeNames.has('Basic Alarm System')) {
      recommendations.push('Install Basic Alarm System for early warning');
    }
    if (!upgradeNames.has('Security Camera System')) {
      recommendations.push('Install Security Cameras to identify threats');
    }
  }

  if (resistance < 50 && !upgradeNames.has('Armed Security Guard')) {
    recommendations.push('Hire Armed Security Guard for significant protection');
  }

  if (heat > 50) {
    recommendations.push('Reduce operation intensity to lower heat');
  }

  if (heat > 75) {
    recommendations.push('URGENT: Pause operations until heat decreases');
  }

  if (!upgradeNames.has('Panic Room') && !upgradeNames.has('Safe Room')) {
    recommendations.push('Install a safe room to protect valuables during raids');
  }

  if (recommendations.length === 0) {
    recommendations.push('Your property is well defended!');
  }

  return recommendations;
}

// POST /api/property-raids/:propertyId/check - Manually check for raid (for testing/events)
router.post('/:propertyId/check', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const propertyId = parseInt(req.params.propertyId);
    const { forceRaid = false } = req.body; // For testing

    // Get property
    const propertyResult = await pool.query(
      `SELECT op.*, pl.name, pl.is_hidden
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

    // Check cooldown
    if (property.raid_lockout_until && new Date(property.raid_lockout_until) > new Date()) {
      res.json({
        success: true,
        data: {
          raided: false,
          reason: 'Property on raid cooldown',
          cooldownEndsAt: property.raid_lockout_until
        }
      });
      return;
    }

    // Calculate raid chance
    const { shouldRaid, raidChance, raidResistance, operationHeat } = await calculateRaidChance(propertyId, property.is_hidden);

    if (!forceRaid && !shouldRaid) {
      res.json({
        success: true,
        data: {
          raided: false,
          raidChanceWas: raidChance.toFixed(1) + '%'
        }
      });
      return;
    }

    // Execute raid
    const raidResult = await executeRaid(propertyId, playerId, raidResistance, 'police');

    res.json({
      success: true,
      data: {
        raided: true,
        raidResult
      }
    });
  } catch (error) {
    console.error('Check raid error:', error);
    res.status(500).json({ success: false, error: 'Failed to check for raid' });
  }
});

async function calculateRaidChance(propertyId: number, isHidden: boolean): Promise<{
  shouldRaid: boolean;
  raidChance: number;
  raidResistance: number;
  operationHeat: number;
}> {
  // Get security upgrades
  const upgradesResult = await pool.query(
    `SELECT put.effects FROM property_upgrades pu
     JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
     WHERE pu.property_id = $1 AND pu.is_active = true AND put.category = 'security'`,
    [propertyId]
  );

  let raidResistance = 0;
  upgradesResult.rows.forEach(u => {
    if (u.effects?.raid_resistance) raidResistance += u.effects.raid_resistance;
  });

  if (isHidden) raidResistance += 25;

  // Get guards
  const staffResult = await pool.query(
    `SELECT COUNT(*) as guards FROM property_staff
     WHERE property_id = $1 AND staff_type = 'security_guard' AND is_active = true`,
    [propertyId]
  );
  raidResistance += parseInt(staffResult.rows[0].guards) * 15;

  // Get operation heat
  const operationsResult = await pool.query(
    `SELECT SUM(current_heat) as total_heat FROM property_operations
     WHERE property_id = $1 AND status = 'running'`,
    [propertyId]
  );
  const operationHeat = parseInt(operationsResult.rows[0].total_heat) || 0;

  // Calculate chance
  const baseChance = RAID_CONFIG.baseChancePerHour * 100;
  const heatBonus = operationHeat * RAID_CONFIG.heatMultiplier / 10;
  const resistanceReduction = raidResistance / 2;
  const raidChance = Math.max(0.1, Math.min(RAID_CONFIG.maxChance * 100, baseChance + heatBonus - resistanceReduction));

  const shouldRaid = Math.random() * 100 < raidChance;

  return { shouldRaid, raidChance, raidResistance, operationHeat };
}

async function executeRaid(propertyId: number, playerId: number, raidResistance: number, raidType: string) {
  // Determine if raid succeeds (for the raiders)
  const defenseRoll = Math.random() * 100;
  const raidSuccess = defenseRoll > raidResistance;

  let cashSeized = 0;
  let inventorySeized: any[] = [];
  let propertyDamage = 0;
  let operationsBusted: string[] = [];
  let arrests = 0;

  if (raidSuccess) {
    // Get cash stored at property
    const inventoryResult = await pool.query(
      `SELECT * FROM property_inventory WHERE property_id = $1 AND item_type = 'cash' AND is_hidden = false`,
      [propertyId]
    );

    // Get protection percentage from upgrades
    const protectionResult = await pool.query(
      `SELECT put.effects FROM property_upgrades pu
       JOIN property_upgrade_types put ON pu.upgrade_type_id = put.id
       WHERE pu.property_id = $1 AND pu.is_active = true
       AND (put.effects->>'protect_cash_percent' IS NOT NULL OR put.effects->>'protect_inventory_percent' IS NOT NULL)`,
      [propertyId]
    );

    let cashProtection = 0;
    let inventoryProtection = 0;
    protectionResult.rows.forEach(p => {
      if (p.effects?.protect_cash_percent) cashProtection = Math.max(cashProtection, p.effects.protect_cash_percent);
      if (p.effects?.protect_inventory_percent) inventoryProtection = Math.max(inventoryProtection, p.effects.protect_inventory_percent);
    });

    // Calculate seized amounts
    if (inventoryResult.rows.length > 0) {
      const storedCash = inventoryResult.rows.reduce((sum, i) => sum + i.quantity, 0);
      cashSeized = Math.floor(storedCash * (1 - cashProtection / 100));

      // Remove seized cash
      await pool.query(
        `UPDATE property_inventory SET quantity = quantity - $1 WHERE property_id = $2 AND item_type = 'cash' AND is_hidden = false`,
        [cashSeized, propertyId]
      );
    }

    // Bust running operations
    const operationsResult = await pool.query(
      `SELECT operation_type FROM property_operations WHERE property_id = $1 AND status = 'running'`,
      [propertyId]
    );

    for (const op of operationsResult.rows) {
      if (Math.random() > 0.3) { // 70% chance each operation gets busted
        operationsBusted.push(op.operation_type);
        await pool.query(
          `UPDATE property_operations SET status = 'busted', current_heat = 0 WHERE property_id = $1 AND operation_type = $2`,
          [propertyId, op.operation_type]
        );
      }
    }

    // Property damage (10-30%)
    propertyDamage = 10 + Math.floor(Math.random() * 20);
    await pool.query(
      `UPDATE owned_properties SET condition = GREATEST(0, condition - $1) WHERE id = $2`,
      [propertyDamage, propertyId]
    );

    // Chance of player arrest if they have high heat
    const playerResult = await pool.query(
      `SELECT heat_level FROM players WHERE id = $1`,
      [playerId]
    );
    if (playerResult.rows[0].heat_level > 50 && Math.random() < 0.3) {
      arrests = 1;
      // Could trigger jail time here
    }
  } else {
    // Raid failed - minor damage and heat reduction
    propertyDamage = Math.floor(Math.random() * 5);
    await pool.query(
      `UPDATE owned_properties SET condition = GREATEST(0, condition - $1) WHERE id = $2`,
      [propertyDamage, propertyId]
    );

    // Reduce operation heat since they "got away with it"
    await pool.query(
      `UPDATE property_operations SET current_heat = GREATEST(0, current_heat - 20) WHERE property_id = $1`,
      [propertyId]
    );
  }

  // Set cooldown
  const cooldownUntil = new Date(Date.now() + RAID_CONFIG.cooldownHours * 60 * 60 * 1000);
  await pool.query(
    `UPDATE owned_properties SET is_raided = $1, raid_lockout_until = $2 WHERE id = $3`,
    [raidSuccess, cooldownUntil, propertyId]
  );

  // Add heat to player
  const heatGenerated = raidSuccess ? 15 : 5;
  await pool.query(
    `UPDATE players SET heat_level = LEAST(100, heat_level + $1) WHERE id = $2`,
    [heatGenerated, playerId]
  );

  // Record raid
  await pool.query(
    `INSERT INTO property_raids
     (property_id, raid_type, triggered_by, raid_success, defense_rating, cash_seized,
      inventory_seized, operations_busted, arrests_made, property_damage, heat_generated)
     VALUES ($1, $2, 'high_heat', $3, $4, $5, $6, $7, $8, $9, $10)`,
    [propertyId, raidType, raidSuccess, raidResistance, cashSeized,
     JSON.stringify(inventorySeized), JSON.stringify(operationsBusted), arrests, propertyDamage, heatGenerated]
  );

  return {
    raidType,
    raidSuccess,
    defenseRating: raidResistance,
    cashSeized,
    inventorySeized,
    operationsBusted,
    arrests,
    propertyDamage,
    heatGenerated,
    cooldownEndsAt: cooldownUntil.toISOString(),
    message: raidSuccess
      ? `Your property was raided! $${cashSeized.toLocaleString()} seized, ${operationsBusted.length} operations busted.`
      : 'Your defenses held! The raid was unsuccessful.'
  };
}

// GET /api/property-raids/history - Get all raid history for player's properties
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT pr.*, pl.name as property_name
       FROM property_raids pr
       JOIN owned_properties op ON pr.property_id = op.id
       JOIN property_listings pl ON op.listing_id = pl.id
       WHERE op.owner_id = $1
       ORDER BY pr.raided_at DESC
       LIMIT 50`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        raids: result.rows.map(r => ({
          id: r.id,
          propertyId: r.property_id,
          propertyName: r.property_name,
          raidType: r.raid_type,
          raidSuccess: r.raid_success,
          defenseRating: r.defense_rating,
          cashSeized: r.cash_seized,
          operationsBusted: r.operations_busted,
          arrests: r.arrests_made,
          propertyDamage: r.property_damage,
          heatGenerated: r.heat_generated,
          raidedAt: r.raided_at
        })),
        summary: {
          totalRaids: result.rows.length,
          successfulDefenses: result.rows.filter(r => !r.raid_success).length,
          totalCashLost: result.rows.reduce((sum, r) => sum + r.cash_seized, 0)
        }
      }
    });
  } catch (error) {
    console.error('Get raid history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get raid history' });
  }
});

// Export raid check for periodic processing
export async function checkAllPropertiesForRaids() {
  try {
    // Get all properties with running operations
    const propertiesResult = await pool.query(`
      SELECT DISTINCT op.id, op.owner_id, pl.is_hidden, op.raid_lockout_until
      FROM owned_properties op
      JOIN property_listings pl ON op.listing_id = pl.id
      JOIN property_operations po ON po.property_id = op.id
      WHERE po.status = 'running'
      AND po.current_heat > 25
      AND (op.raid_lockout_until IS NULL OR op.raid_lockout_until < NOW())
    `);

    for (const property of propertiesResult.rows) {
      const { shouldRaid, raidResistance } = await calculateRaidChance(property.id, property.is_hidden);

      if (shouldRaid) {
        console.log(`Raid triggered on property ${property.id}`);
        await executeRaid(property.id, property.owner_id, raidResistance, 'police');
      }
    }
  } catch (error) {
    console.error('Check properties for raids error:', error);
  }
}

export default router;
