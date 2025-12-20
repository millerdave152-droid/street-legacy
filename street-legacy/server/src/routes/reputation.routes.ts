/**
 * Reputation Routes
 * API endpoints for the contextual reputation system
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  getReputationWeb,
  getReputation,
  getOrCreateReputation,
  modifyReputation,
  propagateReputation,
  getFaction,
  getAllFactions,
  getFactionsInDistrict,
  getReputationHistory,
  calculateStanding
} from '../services/reputationWeb.service.js';
import {
  ReputationType,
  ReputationChange,
  DEFAULT_PROPAGATION_CONFIG
} from '../types/reputation.types.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const reputationTypeSchema = z.enum(['district', 'faction', 'crew', 'player']);

const getReputationParamsSchema = z.object({
  params: z.object({
    playerId: z.string().uuid('Invalid player ID'),
    type: reputationTypeSchema,
    targetId: z.string().min(1, 'Target ID is required')
  })
});

const modifyReputationSchema = z.object({
  params: z.object({
    playerId: z.string().uuid('Invalid player ID'),
    type: reputationTypeSchema,
    targetId: z.string().min(1, 'Target ID is required')
  }),
  body: z.object({
    changes: z.object({
      respect: z.number().int().min(-100).max(100).optional(),
      fear: z.number().int().min(-100).max(100).optional(),
      trust: z.number().int().min(-100).max(100).optional(),
      heat: z.number().int().min(-100).max(100).optional()
    }),
    reason: z.string().min(1).max(100),
    relatedPlayerId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    propagate: z.boolean().optional().default(true)
  })
});

const factionIdParamSchema = z.object({
  params: z.object({
    factionId: z.string().min(1, 'Faction ID is required')
  })
});

const districtIdParamSchema = z.object({
  params: z.object({
    districtId: z.string().min(1, 'District ID is required')
  })
});

// =============================================================================
// PLAYER REPUTATION ENDPOINTS
// =============================================================================

/**
 * GET /api/players/:playerId/reputation
 * Get full reputation web for a player
 */
router.get('/players/:playerId/reputation', async (req: AuthRequest, res: Response) => {
  try {
    const { playerId } = req.params;
    const requestingPlayerId = req.player!.id;

    // Players can only view their own reputation web
    // TODO: Add admin/moderator access
    if (String(playerId) !== String(requestingPlayerId)) {
      res.status(403).json({
        success: false,
        error: 'You can only view your own reputation'
      });
      return;
    }

    console.log(`[ReputationRoutes] GET reputation web for player: ${playerId}`);

    const reputationWeb = await getReputationWeb(playerId);

    res.json({
      success: true,
      data: reputationWeb
    });
  } catch (error) {
    console.error('[ReputationRoutes] Error getting reputation web:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reputation'
    });
  }
});

/**
 * GET /api/players/:playerId/reputation/:type/:targetId
 * Get specific reputation record
 */
router.get(
  '/players/:playerId/reputation/:type/:targetId',
  validate(getReputationParamsSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId, type, targetId } = req.params;
      const requestingPlayerId = req.player!.id;

      // Players can view their own reputation, or reputation others have with them
      const canView = String(playerId) === String(requestingPlayerId) ||
        (type === 'player' && targetId === String(requestingPlayerId));

      if (!canView) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own reputation or reputation others have with you'
        });
        return;
      }

      console.log(`[ReputationRoutes] GET reputation: player=${playerId}, type=${type}, target=${targetId}`);

      const reputation = await getReputation(playerId, type as ReputationType, targetId);

      if (!reputation) {
        // Return default reputation if none exists
        res.json({
          success: true,
          data: {
            playerId,
            reputationType: type,
            targetId,
            score: { respect: 0, fear: 0, trust: 0, heat: 0 },
            standing: 'unknown',
            combinedScore: 0,
            lastUpdated: null,
            createdAt: null
          }
        });
        return;
      }

      res.json({
        success: true,
        data: reputation
      });
    } catch (error) {
      console.error('[ReputationRoutes] Error getting reputation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get reputation'
      });
    }
  }
);

/**
 * POST /api/players/:playerId/reputation/:type/:targetId
 * Modify reputation (internal use / admin)
 */
router.post(
  '/players/:playerId/reputation/:type/:targetId',
  validate(modifyReputationSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId, type, targetId } = req.params;
      const { changes, reason, relatedPlayerId, metadata, propagate } = req.body;
      const requestingPlayerId = req.player!.id;

      // Only the player can modify their own reputation through game actions
      // This endpoint is primarily for internal service use
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'Cannot modify another player\'s reputation directly'
        });
        return;
      }

      console.log(`[ReputationRoutes] POST modify reputation: player=${playerId}, type=${type}, target=${targetId}`);
      console.log(`[ReputationRoutes] Changes: ${JSON.stringify(changes)}, Reason: ${reason}`);

      // Validate at least one change is provided
      const hasChanges = Object.values(changes as ReputationChange).some(v => v !== undefined && v !== 0);
      if (!hasChanges) {
        res.status(400).json({
          success: false,
          error: 'At least one reputation change must be provided'
        });
        return;
      }

      // Modify reputation
      const result = await modifyReputation(
        playerId,
        type as ReputationType,
        targetId,
        changes,
        reason,
        relatedPlayerId,
        metadata
      );

      // Propagate if requested
      let propagated: { targetId: string; targetType: ReputationType; changes: ReputationChange }[] = [];
      if (propagate !== false) {
        propagated = await propagateReputation(
          playerId,
          type as ReputationType,
          targetId,
          changes,
          DEFAULT_PROPAGATION_CONFIG
        );
      }

      res.json({
        success: true,
        data: {
          modifications: result.modifications,
          newScore: result.newScore,
          newStanding: result.newStanding,
          propagated
        }
      });
    } catch (error) {
      console.error('[ReputationRoutes] Error modifying reputation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to modify reputation'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/reputation/history
 * Get reputation event history
 */
router.get('/players/:playerId/reputation/history', async (req: AuthRequest, res: Response) => {
  try {
    const { playerId } = req.params;
    const { type, targetId, limit = '50' } = req.query;
    const requestingPlayerId = req.player!.id;

    if (String(playerId) !== String(requestingPlayerId)) {
      res.status(403).json({
        success: false,
        error: 'You can only view your own reputation history'
      });
      return;
    }

    console.log(`[ReputationRoutes] GET reputation history for player: ${playerId}`);

    const history = await getReputationHistory(
      playerId,
      Math.min(100, Math.max(1, parseInt(limit as string) || 50)),
      type as ReputationType | undefined,
      targetId as string | undefined
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[ReputationRoutes] Error getting reputation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reputation history'
    });
  }
});

// =============================================================================
// FACTION ENDPOINTS
// =============================================================================

/**
 * GET /api/factions
 * Get all factions
 */
router.get('/factions', async (req: AuthRequest, res: Response) => {
  try {
    console.log('[ReputationRoutes] GET all factions');

    const factions = await getAllFactions();

    res.json({
      success: true,
      data: {
        factions,
        total: factions.length
      }
    });
  } catch (error) {
    console.error('[ReputationRoutes] Error getting factions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get factions'
    });
  }
});

/**
 * GET /api/factions/:factionId
 * Get single faction details
 */
router.get(
  '/factions/:factionId',
  validate(factionIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { factionId } = req.params;

      console.log(`[ReputationRoutes] GET faction: ${factionId}`);

      const faction = await getFaction(factionId);

      if (!faction) {
        res.status(404).json({
          success: false,
          error: 'Faction not found'
        });
        return;
      }

      // Optionally include player's reputation with this faction
      const playerId = req.player!.id;
      const reputation = await getReputation(String(playerId), 'faction', factionId);

      res.json({
        success: true,
        data: {
          ...faction,
          playerReputation: reputation || null
        }
      });
    } catch (error) {
      console.error('[ReputationRoutes] Error getting faction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get faction'
      });
    }
  }
);

/**
 * GET /api/factions/:factionId/relationships
 * Get faction relationships (allies, enemies) with player rep
 */
router.get('/factions/:factionId/relationships', async (req: AuthRequest, res: Response) => {
  try {
    const { factionId } = req.params;
    const playerId = req.player!.id;

    console.log(`[ReputationRoutes] GET faction relationships: ${factionId}`);

    const faction = await getFaction(factionId);

    if (!faction) {
      res.status(404).json({
        success: false,
        error: 'Faction not found'
      });
      return;
    }

    // Get all related factions with player reputation
    const relationships = [];

    for (const allyId of faction.allies) {
      const ally = await getFaction(allyId);
      const rep = await getReputation(String(playerId), 'faction', allyId);
      relationships.push({
        factionId: allyId,
        factionName: ally?.name || allyId,
        relationship: 'ally' as const,
        playerReputation: rep
      });
    }

    for (const enemyId of faction.enemies) {
      const enemy = await getFaction(enemyId);
      const rep = await getReputation(String(playerId), 'faction', enemyId);
      relationships.push({
        factionId: enemyId,
        factionName: enemy?.name || enemyId,
        relationship: 'enemy' as const,
        playerReputation: rep
      });
    }

    res.json({
      success: true,
      data: {
        faction: {
          id: faction.id,
          name: faction.name
        },
        relationships
      }
    });
  } catch (error) {
    console.error('[ReputationRoutes] Error getting faction relationships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get faction relationships'
    });
  }
});

// =============================================================================
// DISTRICT FACTION ENDPOINTS
// =============================================================================

/**
 * GET /api/districts/:districtId/factions
 * Get factions operating in a district
 */
router.get(
  '/districts/:districtId/factions',
  validate(districtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { districtId } = req.params;
      const playerId = req.player!.id;

      console.log(`[ReputationRoutes] GET factions in district: ${districtId}`);

      const factions = await getFactionsInDistrict(districtId);

      // Include player's reputation with each faction
      const factionsWithRep = await Promise.all(
        factions.map(async (faction) => {
          const reputation = await getReputation(String(playerId), 'faction', faction.id);
          return {
            ...faction,
            playerReputation: reputation || null
          };
        })
      );

      res.json({
        success: true,
        data: {
          districtId,
          factions: factionsWithRep,
          total: factions.length
        }
      });
    } catch (error) {
      console.error('[ReputationRoutes] Error getting district factions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get district factions'
      });
    }
  }
);

/**
 * GET /api/districts/:districtId/reputation
 * Get player's reputation in a specific district
 */
router.get('/districts/:districtId/reputation', async (req: AuthRequest, res: Response) => {
  try {
    const { districtId } = req.params;
    const playerId = req.player!.id;

    console.log(`[ReputationRoutes] GET district reputation: player=${playerId}, district=${districtId}`);

    const reputation = await getOrCreateReputation(String(playerId), 'district', districtId);

    // Also get factions in district with reputation
    const factions = await getFactionsInDistrict(districtId);
    const factionReps = await Promise.all(
      factions.map(async (faction) => {
        const rep = await getReputation(String(playerId), 'faction', faction.id);
        return {
          factionId: faction.id,
          factionName: faction.name,
          icon: faction.icon,
          color: faction.color,
          reputation: rep
        };
      })
    );

    res.json({
      success: true,
      data: {
        districtReputation: reputation,
        factionReputations: factionReps
      }
    });
  } catch (error) {
    console.error('[ReputationRoutes] Error getting district reputation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get district reputation'
    });
  }
});

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================

/**
 * GET /api/reputation/standing/:respect/:fear/:trust
 * Calculate standing from scores (utility endpoint)
 */
router.get('/reputation/standing/:respect/:fear/:trust', async (req: AuthRequest, res: Response) => {
  try {
    const respect = parseInt(req.params.respect) || 0;
    const fear = parseInt(req.params.fear) || 0;
    const trust = parseInt(req.params.trust) || 0;

    const standing = calculateStanding({ respect, fear, trust, heat: 0 });

    res.json({
      success: true,
      data: {
        respect,
        fear,
        trust,
        standing,
        combinedScore: respect + fear + trust
      }
    });
  } catch (error) {
    console.error('[ReputationRoutes] Error calculating standing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate standing'
    });
  }
});

export default router;
