// District Ecosystem Routes
// API endpoints for the dynamic territorial ecosystem

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import pool from '../db/connection.js';
import {
  getDistrictState,
  getAllDistrictStates,
  getDistrictModifiers,
  getPlayerDistrictModifiers,
  getStatusReputationMultiplier,
  getDistrictHistory,
  processAllDistricts
} from '../services/districtEcosystem.service.js';

const router = Router();

// All district ecosystem routes require authentication
router.use(authMiddleware);

// ============================================================================
// GET /api/districts/states - Get all district states (for map display)
// ============================================================================
router.get('/states', async (req: AuthRequest, res: Response) => {
  console.log('[DistrictEcosystem Routes] GET /states');

  try {
    const states = await getAllDistrictStates();

    res.json({
      success: true,
      data: {
        districts: states.map(state => ({
          districtId: state.districtId,
          crimeIndex: state.crimeIndex,
          policePresence: state.policePresence,
          propertyValues: state.propertyValues,
          businessHealth: state.businessHealth,
          streetActivity: state.streetActivity,
          status: state.status,
          heatLevel: state.heatLevel,
          crewTension: state.crewTension,
          lastCalculated: state.lastCalculated
        })),
        count: states.length
      }
    });
  } catch (error) {
    console.error('[DistrictEcosystem Routes] Error getting all states:', error);
    res.status(500).json({ success: false, error: 'Failed to get district states' });
  }
});

// ============================================================================
// GET /api/districts/:districtId/state - Get single district state
// ============================================================================
router.get('/:districtId/state', async (req: AuthRequest, res: Response) => {
  const { districtId } = req.params;
  console.log(`[DistrictEcosystem Routes] GET /${districtId}/state`);

  try {
    const state = await getDistrictState(districtId);

    if (!state) {
      res.status(404).json({
        success: false,
        error: `District not found: ${districtId}`
      });
      return;
    }

    res.json({
      success: true,
      data: {
        districtId: state.districtId,
        crimeIndex: state.crimeIndex,
        policePresence: state.policePresence,
        propertyValues: state.propertyValues,
        businessHealth: state.businessHealth,
        streetActivity: state.streetActivity,
        status: state.status,
        heatLevel: state.heatLevel,
        crewTension: state.crewTension,
        dailyCrimeCount: state.dailyCrimeCount,
        activeBusinesses: state.activeBusinesses,
        lastCalculated: state.lastCalculated,
        lastStatusChange: state.lastStatusChange
      }
    });
  } catch (error) {
    console.error(`[DistrictEcosystem Routes] Error getting state for ${districtId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get district state' });
  }
});

// ============================================================================
// GET /api/districts/:districtId/history - Get district event history
// ============================================================================
router.get('/:districtId/history', async (req: AuthRequest, res: Response) => {
  const { districtId } = req.params;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  console.log(`[DistrictEcosystem Routes] GET /${districtId}/history (limit: ${limit})`);

  try {
    const events = await getDistrictHistory(districtId, limit);

    res.json({
      success: true,
      data: {
        districtId,
        events: events.map(event => ({
          id: event.id,
          eventType: event.eventType,
          severity: event.severity,
          playerId: event.playerId,
          metadata: event.metadata,
          createdAt: event.createdAt
        })),
        count: events.length
      }
    });
  } catch (error) {
    console.error(`[DistrictEcosystem Routes] Error getting history for ${districtId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get district history' });
  }
});

// ============================================================================
// GET /api/districts/:districtId/modifiers - Get gameplay modifiers
// ============================================================================
router.get('/:districtId/modifiers', async (req: AuthRequest, res: Response) => {
  const { districtId } = req.params;
  console.log(`[DistrictEcosystem Routes] GET /${districtId}/modifiers`);

  try {
    const modifiers = await getDistrictModifiers(districtId);

    if (!modifiers) {
      res.status(404).json({
        success: false,
        error: `District not found: ${districtId}`
      });
      return;
    }

    res.json({
      success: true,
      data: {
        districtId,
        modifiers: {
          crimeDifficulty: modifiers.crimeDifficulty,
          propertyIncome: modifiers.propertyIncome,
          recruitmentEase: modifiers.recruitmentEase,
          heatDecay: modifiers.heatDecay,
          policeResponseTime: modifiers.policeResponseTime,
          crimePayoutBonus: modifiers.crimePayoutBonus,
          shopPriceModifier: modifiers.shopPriceModifier
        },
        explanations: {
          crimeDifficulty: 'Multiplier for crime success chance (1.0 = normal, lower = harder)',
          propertyIncome: 'Multiplier for property revenue (1.0 = normal)',
          recruitmentEase: 'Multiplier for crew recruitment success (1.0 = normal)',
          heatDecay: 'Multiplier for heat reduction rate (1.0 = normal, higher = faster decay)',
          policeResponseTime: 'Police response factor (higher = slower response, better for escape)',
          crimePayoutBonus: 'Bonus multiplier for crime payouts (0.25 = 25% bonus)',
          shopPriceModifier: 'Price modifier for shops (1.0 = normal prices)'
        }
      }
    });
  } catch (error) {
    console.error(`[DistrictEcosystem Routes] Error getting modifiers for ${districtId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get district modifiers' });
  }
});

// ============================================================================
// GET /api/districts/:districtId/player-modifiers - Get player-specific modifiers with reputation
// ============================================================================
router.get('/:districtId/player-modifiers', async (req: AuthRequest, res: Response) => {
  const { districtId } = req.params;
  const playerId = req.player!.id;
  console.log(`[DistrictEcosystem Routes] GET /${districtId}/player-modifiers for player ${playerId}`);

  try {
    // Get state for status multiplier
    const state = await getDistrictState(districtId);
    if (!state) {
      res.status(404).json({
        success: false,
        error: `District not found: ${districtId}`
      });
      return;
    }

    // Get player-specific modifiers
    const modifiers = await getPlayerDistrictModifiers(districtId, String(playerId));

    if (!modifiers) {
      res.status(404).json({
        success: false,
        error: `Could not calculate modifiers for district: ${districtId}`
      });
      return;
    }

    // Calculate reputation multiplier from district status
    const statusRepMultiplier = getStatusReputationMultiplier(state.status);

    res.json({
      success: true,
      data: {
        districtId,
        playerId,
        districtStatus: state.status,
        statusReputationMultiplier: statusRepMultiplier,
        modifiers: {
          // Base modifiers
          crimeDifficulty: modifiers.crimeDifficulty,
          propertyIncome: modifiers.propertyIncome,
          recruitmentEase: modifiers.recruitmentEase,
          heatDecay: modifiers.heatDecay,
          policeResponseTime: modifiers.policeResponseTime,
          crimePayoutBonus: modifiers.crimePayoutBonus,
          shopPriceModifier: modifiers.shopPriceModifier,
          // Reputation-based modifiers
          reputationBonus: modifiers.reputationBonus,
          factionDiscount: modifiers.factionDiscount,
          crimeSuccessBonus: modifiers.crimeSuccessBonus,
          heatGenerationMod: modifiers.heatGenerationMod,
          recruitmentBonus: modifiers.recruitmentBonus
        },
        explanations: {
          crimeDifficulty: 'Multiplier for crime success chance (1.0 = normal, lower = harder)',
          propertyIncome: 'Multiplier for property revenue (1.0 = normal)',
          recruitmentEase: 'Multiplier for crew recruitment success (1.0 = normal)',
          heatDecay: 'Multiplier for heat reduction rate (higher = faster decay)',
          policeResponseTime: 'Police response factor (higher = slower response)',
          crimePayoutBonus: 'Bonus multiplier for crime payouts',
          shopPriceModifier: 'Price modifier for shops (1.0 = normal)',
          reputationBonus: 'Multiplier for reputation gains based on your standing',
          factionDiscount: 'Shop discount from faction reputation (0 to 0.2)',
          crimeSuccessBonus: 'Crime success bonus from fear/respect',
          heatGenerationMod: 'Heat generation modifier (lower = less heat)',
          recruitmentBonus: 'Recruitment bonus from local trust',
          statusReputationMultiplier: `Rep gain multiplier in ${state.status} districts`
        }
      }
    });
  } catch (error) {
    console.error(`[DistrictEcosystem Routes] Error getting player modifiers for ${districtId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get player district modifiers' });
  }
});

// ============================================================================
// POST /api/districts/process - Trigger manual recalculation (admin only)
// ============================================================================
router.post('/process', async (req: AuthRequest, res: Response) => {
  console.log('[DistrictEcosystem Routes] POST /process');

  try {
    // Check if player is admin/master
    const playerId = req.player?.id;
    if (!playerId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const playerResult = await pool.query(
      'SELECT is_master FROM players WHERE id = $1',
      [playerId]
    );

    if (!playerResult.rows[0]?.is_master) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const processed = await processAllDistricts();

    res.json({
      success: true,
      data: {
        message: `Processed ${processed} districts`,
        districtsProcessed: processed
      }
    });
  } catch (error) {
    console.error('[DistrictEcosystem Routes] Error processing districts:', error);
    res.status(500).json({ success: false, error: 'Failed to process districts' });
  }
});

export default router;
