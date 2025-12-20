import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// =====================================================
// PHASE 6: AI GRID / HYDRANET SURVEILLANCE SYSTEM
// =====================================================

// GET /api/ai-grid/status - Get global grid status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get average surveillance across all sectors
    const surveillanceResult = await pool.query(`
      SELECT
        AVG(surveillance_level) as avg_surveillance,
        COUNT(*) FILTER (WHERE grid_status = 'blackout') as blackout_count,
        COUNT(*) FILTER (WHERE alert_level IN ('critical', 'lockdown')) as critical_sectors
      FROM sector_surveillance
    `);

    // Count active pursuits
    const pursuitsResult = await pool.query(`
      SELECT COUNT(*) as count FROM hnc_pursuits WHERE is_active = true
    `);

    // Count recent grid hacks
    const hacksResult = await pool.query(`
      SELECT COUNT(*) as count FROM grid_incidents
      WHERE incident_type = 'grid_hack'
      AND created_at > NOW() - INTERVAL '1 hour'
    `);

    // Get blackout sectors
    const blackoutResult = await pool.query(`
      SELECT sector_code FROM sector_surveillance WHERE grid_status = 'blackout'
    `);

    // Determine global alert level
    const stats = surveillanceResult.rows[0];
    const avgSurveillance = parseFloat(stats.avg_surveillance) || 50;
    const activePursuits = parseInt(pursuitsResult.rows[0].count) || 0;
    let hncAlertLevel = 'normal';

    if (stats.critical_sectors > 2) hncAlertLevel = 'critical';
    else if (activePursuits > 10) hncAlertLevel = 'high';
    else if (activePursuits > 5) hncAlertLevel = 'elevated';
    else if (stats.blackout_count > 3) hncAlertLevel = 'minimal';

    // Determine ARIA status
    let ariaStatus = 'online';
    if (avgSurveillance < 30) ariaStatus = 'degraded';
    if (avgSurveillance < 15 || stats.blackout_count > 5) ariaStatus = 'offline';

    res.json({
      success: true,
      data: {
        ariaStatus,
        globalSurveillance: Math.round(avgSurveillance),
        activeBlackouts: blackoutResult.rows.map(r => r.sector_code),
        hncAlertLevel,
        activePursuits,
        recentGridHacks: parseInt(hacksResult.rows[0].count) || 0,
        gridHealthPercent: Math.round(avgSurveillance)
      }
    });
  } catch (error) {
    console.error('Error fetching grid status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch grid status' });
  }
});

// GET /api/ai-grid/sectors - Get all sector surveillance data
router.get('/sectors', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM sector_surveillance ORDER BY sector_code
    `);

    // Calculate global alert level
    const avgSurveillance = result.rows.reduce((sum, s) => sum + s.surveillance_level, 0) / result.rows.length;
    let globalAlertLevel = 'normal';
    const criticalCount = result.rows.filter(s => s.alert_level === 'critical' || s.alert_level === 'lockdown').length;

    if (criticalCount > 2) globalAlertLevel = 'critical';
    else if (avgSurveillance > 70) globalAlertLevel = 'elevated';
    else if (avgSurveillance < 30) globalAlertLevel = 'minimal';

    res.json({
      success: true,
      data: {
        sectors: result.rows.map(s => ({
          id: s.id,
          sectorCode: s.sector_code,
          surveillanceLevel: s.surveillance_level,
          gridStatus: s.grid_status,
          droneDensity: s.drone_density,
          scannerCoverage: parseFloat(s.scanner_coverage),
          hncPresence: s.hnc_presence,
          lastSweep: s.last_sweep,
          sweepIntervalMinutes: s.sweep_interval_minutes,
          alertLevel: s.alert_level
        })),
        globalAlertLevel,
        ariaCoreStatus: avgSurveillance < 30 ? 'degraded' : 'online'
      }
    });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sectors' });
  }
});

// GET /api/ai-grid/sector/:code - Get specific sector
router.get('/sector/:code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sectorCode = req.params.code.toUpperCase();

    const result = await pool.query(`
      SELECT * FROM sector_surveillance WHERE sector_code = $1
    `, [sectorCode]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sector not found' });
    }

    // Get recent incidents in this sector
    const incidentsResult = await pool.query(`
      SELECT * FROM grid_incidents
      WHERE sector_code = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [sectorCode]);

    const sector = result.rows[0];

    res.json({
      success: true,
      data: {
        sector: {
          id: sector.id,
          sectorCode: sector.sector_code,
          surveillanceLevel: sector.surveillance_level,
          gridStatus: sector.grid_status,
          droneDensity: sector.drone_density,
          scannerCoverage: parseFloat(sector.scanner_coverage),
          hncPresence: sector.hnc_presence,
          lastSweep: sector.last_sweep,
          sweepIntervalMinutes: sector.sweep_interval_minutes,
          alertLevel: sector.alert_level
        },
        recentIncidents: incidentsResult.rows.map(i => ({
          id: i.id,
          incidentType: i.incident_type,
          severity: i.severity,
          description: i.description,
          heatChange: i.heat_change,
          resolved: i.resolved,
          createdAt: i.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching sector:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sector' });
  }
});

// GET /api/ai-grid/heat - Get player's heat status
router.get('/heat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get or create player heat record
    let heatResult = await pool.query(`
      SELECT * FROM player_heat WHERE player_id = $1
    `, [playerId]);

    if (heatResult.rows.length === 0) {
      await pool.query(`
        INSERT INTO player_heat (player_id) VALUES ($1)
      `, [playerId]);
      heatResult = await pool.query(`
        SELECT * FROM player_heat WHERE player_id = $1
      `, [playerId]);
    }

    const heat = heatResult.rows[0];

    // Get current sector surveillance
    const sectorResult = await pool.query(`
      SELECT * FROM sector_surveillance WHERE sector_code = $1
    `, [heat.current_sector || 'ON-0']);

    const sector = sectorResult.rows[0] || {
      surveillance_level: 50,
      scanner_coverage: 0.75,
      grid_status: 'active'
    };

    // Get active pursuit if any
    const pursuitResult = await pool.query(`
      SELECT p.*, pl.name as level_name, pl.description as level_desc,
             pl.drones, pl.enforcers, pl.escape_difficulty, pl.icon
      FROM hnc_pursuits p
      JOIN pursuit_levels pl ON p.pursuit_level = pl.level
      WHERE p.player_id = $1 AND p.is_active = true
    `, [playerId]);

    // Get recent incidents
    const incidentsResult = await pool.query(`
      SELECT * FROM grid_incidents
      WHERE player_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [playerId]);

    // Calculate detection chance
    const detectionChance = Math.min(95, Math.max(5,
      Math.round(((sector.surveillance_level + heat.heat_level) / 2) * parseFloat(sector.scanner_coverage || 0.75))
    ));

    // Generate recommendations
    const recommendations: string[] = [];
    if (heat.heat_level > 60) recommendations.push('Lay low - your heat is dangerously high');
    if (heat.heat_level > 40) recommendations.push('Avoid high-surveillance sectors');
    if (sector.grid_status === 'active' && sector.surveillance_level > 70) {
      recommendations.push('Current sector has heavy surveillance - consider relocating');
    }
    if (heat.is_flagged) recommendations.push('You are flagged by HNC - proceed with extreme caution');
    if (sector.grid_status === 'blackout') recommendations.push('Sector is in blackout - reduced detection risk');
    if (recommendations.length === 0) recommendations.push('Heat level acceptable - normal operations');

    res.json({
      success: true,
      data: {
        heat: {
          id: heat.id,
          playerId: heat.player_id,
          heatLevel: heat.heat_level,
          lastCrimeDetected: heat.last_crime_detected,
          crimesInSession: heat.crimes_in_session,
          currentSector: heat.current_sector,
          isFlagged: heat.is_flagged,
          flagReason: heat.flag_reason,
          flagExpiresAt: heat.flag_expires_at,
          droneTracking: heat.drone_tracking,
          lastScanEvaded: heat.last_scan_evaded,
          totalScansEvaded: heat.total_scans_evaded,
          totalDetections: heat.total_detections,
          bountyFromHnc: heat.bounty_from_hnc
        },
        currentSector: {
          sectorCode: sector.sector_code,
          surveillanceLevel: sector.surveillance_level,
          gridStatus: sector.grid_status,
          droneDensity: sector.drone_density,
          scannerCoverage: parseFloat(sector.scanner_coverage),
          alertLevel: sector.alert_level
        },
        pursuitStatus: pursuitResult.rows.length > 0 ? {
          id: pursuitResult.rows[0].id,
          playerId: pursuitResult.rows[0].player_id,
          pursuitLevel: pursuitResult.rows[0].pursuit_level,
          levelInfo: {
            level: pursuitResult.rows[0].pursuit_level,
            name: pursuitResult.rows[0].level_name,
            description: pursuitResult.rows[0].level_desc,
            drones: pursuitResult.rows[0].drones,
            enforcers: pursuitResult.rows[0].enforcers,
            escapeDifficulty: pursuitResult.rows[0].escape_difficulty,
            icon: pursuitResult.rows[0].icon
          },
          startedAt: pursuitResult.rows[0].started_at,
          isActive: pursuitResult.rows[0].is_active
        } : null,
        recentIncidents: incidentsResult.rows.map(i => ({
          id: i.id,
          incidentType: i.incident_type,
          sectorCode: i.sector_code,
          severity: i.severity,
          description: i.description,
          heatChange: i.heat_change,
          createdAt: i.created_at
        })),
        detectionChance,
        recommendations
      }
    });
  } catch (error) {
    console.error('Error fetching heat status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch heat status' });
  }
});

// POST /api/ai-grid/travel/:sector - Move to a new sector
router.post('/travel/:sector', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const targetSector = req.params.sector.toUpperCase();

    // Verify sector exists
    const sectorResult = await pool.query(`
      SELECT * FROM sector_surveillance WHERE sector_code = $1
    `, [targetSector]);

    if (sectorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid sector code' });
    }

    const sector = sectorResult.rows[0];

    // Update player's current sector
    await pool.query(`
      UPDATE player_heat SET current_sector = $1, updated_at = NOW()
      WHERE player_id = $2
    `, [targetSector, playerId]);

    // Check if player is detected entering the sector
    const heatResult = await pool.query(`
      SELECT heat_level FROM player_heat WHERE player_id = $1
    `, [playerId]);
    const heatLevel = heatResult.rows[0]?.heat_level || 0;

    const detectionRoll = Math.random() * 100;
    const detectionChance = ((sector.surveillance_level + heatLevel) / 2) * parseFloat(sector.scanner_coverage);
    const detected = detectionRoll < detectionChance && sector.grid_status !== 'blackout';

    let incident = null;
    if (detected) {
      const incidentResult = await pool.query(`
        INSERT INTO grid_incidents (incident_type, player_id, sector_code, severity, description, heat_change)
        VALUES ('identity_scanned', $1, $2, 1, 'Identity scanned upon sector entry', 5)
        RETURNING *
      `, [playerId, targetSector]);

      await pool.query(`
        UPDATE player_heat SET heat_level = LEAST(100, heat_level + 5) WHERE player_id = $1
      `, [playerId]);

      incident = incidentResult.rows[0];
    }

    res.json({
      success: true,
      data: {
        message: `Arrived in ${targetSector}`,
        sector: {
          sectorCode: sector.sector_code,
          surveillanceLevel: sector.surveillance_level,
          gridStatus: sector.grid_status,
          alertLevel: sector.alert_level
        },
        detected,
        incident: incident ? {
          type: incident.incident_type,
          description: incident.description,
          heatGained: incident.heat_change
        } : null
      }
    });
  } catch (error) {
    console.error('Error traveling to sector:', error);
    res.status(500).json({ success: false, error: 'Failed to travel' });
  }
});

// POST /api/ai-grid/hack - Attempt to hack local grid
router.post('/hack', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { sectorCode } = req.body;

    if (!sectorCode) {
      return res.status(400).json({ success: false, error: 'Sector code required' });
    }

    // Get sector
    const sectorResult = await pool.query(`
      SELECT * FROM sector_surveillance WHERE sector_code = $1
    `, [sectorCode.toUpperCase()]);

    if (sectorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sector not found' });
    }

    const sector = sectorResult.rows[0];

    // Base success rate: 60% - (surveillance / 2)
    const baseSuccess = 60 - (sector.surveillance_level / 2);
    const successRoll = Math.random() * 100;
    const success = successRoll < baseSuccess;

    if (success) {
      // Reduce sector surveillance temporarily
      const reductionAmount = 15 + Math.floor(Math.random() * 15);
      await pool.query(`
        UPDATE sector_surveillance
        SET surveillance_level = GREATEST(0, surveillance_level - $1),
            updated_at = NOW()
        WHERE sector_code = $2
      `, [reductionAmount, sectorCode]);

      // Log incident
      await pool.query(`
        INSERT INTO grid_incidents (incident_type, player_id, sector_code, severity, description, heat_change)
        VALUES ('grid_hack', $1, $2, 2, 'Grid hack successful - surveillance disrupted', 0)
      `, [playerId, sectorCode]);

      // FFN reputation bonus (if applicable)
      // TODO: Check if FFN faction system is active

      res.json({
        success: true,
        data: {
          message: 'Grid hack successful! Local surveillance disrupted.',
          effectDuration: 1800, // 30 minutes
          sectorAffected: sectorCode,
          surveillanceReduced: reductionAmount,
          heatGained: 0,
          reputationGained: { ffn: 5, hnc: -10 }
        }
      });
    } else {
      // Failed - gain heat
      const heatGain = 15 + Math.floor(Math.random() * 10);
      await pool.query(`
        UPDATE player_heat SET heat_level = LEAST(100, heat_level + $1) WHERE player_id = $2
      `, [heatGain, playerId]);

      await pool.query(`
        INSERT INTO grid_incidents (incident_type, player_id, sector_code, severity, description, heat_change)
        VALUES ('grid_hack', $1, $2, 3, 'Grid hack attempt detected by ARIA', $3)
      `, [playerId, sectorCode, heatGain]);

      res.json({
        success: false,
        error: 'Hack attempt detected! ARIA has flagged your signature.',
        data: {
          heatGained: heatGain,
          detected: true
        }
      });
    }
  } catch (error) {
    console.error('Error attempting grid hack:', error);
    res.status(500).json({ success: false, error: 'Failed to hack grid' });
  }
});

// POST /api/ai-grid/evade - Attempt to evade current pursuit
router.post('/evade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { method } = req.body;

    // Get active pursuit
    const pursuitResult = await pool.query(`
      SELECT p.*, pl.*
      FROM hnc_pursuits p
      JOIN pursuit_levels pl ON p.pursuit_level = pl.level
      WHERE p.player_id = $1 AND p.is_active = true
    `, [playerId]);

    if (pursuitResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active pursuit' });
    }

    const pursuit = pursuitResult.rows[0];
    const escapeOptions = getEscapeOptions(pursuit.pursuit_level);

    // Validate method
    const chosenMethod = escapeOptions.find(o => o.method === method);
    if (!chosenMethod) {
      return res.json({
        success: true,
        data: {
          message: 'Choose an escape method',
          escapeOptions
        }
      });
    }

    // Check if player can afford the method
    const playerResult = await pool.query(`
      SELECT cash FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].cash < chosenMethod.cost) {
      return res.status(400).json({ success: false, error: 'Insufficient funds for this escape method' });
    }

    // Attempt escape
    const successRoll = Math.random() * 100;
    const success = successRoll < chosenMethod.successChance;

    await pool.query('BEGIN');

    // Deduct cost
    if (chosenMethod.cost > 0) {
      await pool.query(`
        UPDATE players SET cash = cash - $1 WHERE id = $2
      `, [chosenMethod.cost, playerId]);
    }

    if (success) {
      // End pursuit
      await pool.query(`
        UPDATE hnc_pursuits
        SET is_active = false, escaped_at = NOW(), escape_method = $1
        WHERE id = $2
      `, [method, pursuit.id]);

      // Reduce heat
      const heatReduction = 20 + Math.floor(Math.random() * 10);
      await pool.query(`
        UPDATE player_heat SET heat_level = GREATEST(0, heat_level - $1) WHERE player_id = $2
      `, [heatReduction, playerId]);

      await pool.query(`
        INSERT INTO grid_incidents (incident_type, player_id, sector_code, severity, description, heat_change)
        VALUES ('pursuit_escaped', $1, (SELECT current_sector FROM player_heat WHERE player_id = $1), 2, $2, $3)
      `, [playerId, `Escaped pursuit using ${method}`, -heatReduction]);

      await pool.query('COMMIT');

      res.json({
        success: true,
        data: {
          message: `Escape successful! You lost them using ${method}.`,
          methodUsed: method,
          heatReduced: heatReduction,
          newPursuitLevel: null,
          costPaid: chosenMethod.cost,
          consequenceApplied: null
        }
      });
    } else {
      // Failed - pursuit escalates
      const newLevel = Math.min(5, pursuit.pursuit_level + 1);

      await pool.query(`
        UPDATE hnc_pursuits
        SET pursuit_level = $1, last_spotted_at = NOW()
        WHERE id = $2
      `, [newLevel, pursuit.id]);

      // Gain heat
      const heatGain = 10;
      await pool.query(`
        UPDATE player_heat SET heat_level = LEAST(100, heat_level + $1) WHERE player_id = $2
      `, [heatGain, playerId]);

      await pool.query('COMMIT');

      res.json({
        success: false,
        error: 'Escape failed! Pursuit escalated.',
        data: {
          methodUsed: method,
          heatReduced: 0,
          newPursuitLevel: newLevel,
          costPaid: chosenMethod.cost,
          consequenceApplied: 'Pursuit escalated'
        }
      });
    }
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error evading pursuit:', error);
    res.status(500).json({ success: false, error: 'Failed to evade pursuit' });
  }
});

// Helper: Get escape options based on pursuit level
function getEscapeOptions(pursuitLevel: number) {
  const options = [
    {
      method: 'blend_in',
      description: 'Blend into a crowd and disappear',
      successChance: Math.max(10, 70 - (pursuitLevel * 15)),
      cost: 0,
      requirements: []
    },
    {
      method: 'underground',
      description: 'Escape through the underground tunnels',
      successChance: Math.max(20, 60 - (pursuitLevel * 10)),
      cost: 500 * pursuitLevel,
      requirements: []
    },
    {
      method: 'bribe',
      description: 'Bribe an HNC officer to look the other way',
      successChance: Math.max(30, 80 - (pursuitLevel * 10)),
      cost: 2000 * pursuitLevel,
      requirements: []
    },
    {
      method: 'safehouse',
      description: 'Head to a faction safehouse',
      successChance: Math.max(40, 85 - (pursuitLevel * 8)),
      cost: 1000 * pursuitLevel,
      requirements: ['Faction membership']
    },
    {
      method: 'decoy',
      description: 'Deploy a holographic decoy',
      successChance: Math.max(50, 90 - (pursuitLevel * 8)),
      cost: 5000 * pursuitLevel,
      requirements: ['Level 20+']
    }
  ];

  return options;
}

// Process heat decay - called periodically
export async function processHeatDecay(): Promise<void> {
  try {
    // Decay heat by 1 every 5 minutes for players not in pursuit
    await pool.query(`
      UPDATE player_heat ph
      SET heat_level = GREATEST(0, heat_level - 1),
          updated_at = NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM hnc_pursuits p
        WHERE p.player_id = ph.player_id AND p.is_active = true
      )
      AND heat_level > 0
      AND updated_at < NOW() - INTERVAL '5 minutes'
    `);

    // Expire flags
    await pool.query(`
      UPDATE player_heat
      SET is_flagged = false, flag_reason = NULL, flag_expires_at = NULL
      WHERE is_flagged = true AND flag_expires_at < NOW()
    `);

    // Process pursuit timeouts (escape if not spotted for 30 minutes)
    const escapedResult = await pool.query(`
      UPDATE hnc_pursuits
      SET is_active = false, escaped_at = NOW(), escape_method = 'timeout'
      WHERE is_active = true
      AND last_spotted_at < NOW() - INTERVAL '30 minutes'
      RETURNING player_id
    `);

    for (const row of escapedResult.rows) {
      await pool.query(`
        UPDATE player_heat SET heat_level = GREATEST(0, heat_level - 15) WHERE player_id = $1
      `, [row.player_id]);
    }

    if (escapedResult.rows.length > 0) {
      console.log(`[AI Grid] ${escapedResult.rows.length} pursuits timed out`);
    }
  } catch (error) {
    console.error('[AI Grid] Error processing heat decay:', error);
  }
}

// Process sector sweeps
export async function processSectorSweeps(): Promise<void> {
  try {
    // Reset surveillance in sectors that haven't been swept
    await pool.query(`
      UPDATE sector_surveillance
      SET surveillance_level = LEAST(surveillance_level + 5, 100),
          last_sweep = NOW()
      WHERE grid_status != 'blackout'
      AND last_sweep < NOW() - INTERVAL '1 minute' * sweep_interval_minutes
    `);
  } catch (error) {
    console.error('[AI Grid] Error processing sector sweeps:', error);
  }
}

export default router;
