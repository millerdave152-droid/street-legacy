/**
 * Generational Continuity Routes
 * API endpoints for character endings and dynasty inheritance
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  getSuccessionPlan,
  createOrUpdateSuccessionPlan,
  validateSuccessionPlan,
  deleteSuccessionPlan,
  endCharacter,
  executeSuccession,
  calculateInheritance,
  getPlayerLineage,
  getDynasty,
  getPlayerDynasty,
  getLineageChain,
  getCharacterEndings,
  getCharacterEnding,
  getDynastyAchievements,
  initializeLineage,
  getAllDynasties
} from '../services/generationalContinuity.service.js';
import {
  HEIR_TYPE_LABELS,
  HEIR_TYPE_DESCRIPTIONS,
  ENDING_TYPE_LABELS,
  ENDING_DESCRIPTIONS,
  DEFAULT_TRANSFER_PERCENTS,
  TRANSFER_PERCENT_LIMITS
} from '../types/generationalContinuity.types.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const playerIdParamSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  })
});

const dynastyNameParamSchema = z.object({
  params: z.object({
    dynastyName: z.string().min(1, 'Dynasty name required').max(100)
  })
});

const endingIdParamSchema = z.object({
  params: z.object({
    endingId: z.string().uuid('Invalid ending ID')
  })
});

const successionPlanSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  }),
  body: z.object({
    heirType: z.enum(['player_heir', 'npc_family', 'npc_lieutenant', 'crew_successor']),
    heirPlayerId: z.string().regex(/^\d+$/).optional(),
    heirNpcName: z.string().min(1).max(100).optional(),
    propertyTransferPercent: z.number().int()
      .min(TRANSFER_PERCENT_LIMITS.min)
      .max(TRANSFER_PERCENT_LIMITS.max)
      .optional(),
    cashTransferPercent: z.number().int()
      .min(TRANSFER_PERCENT_LIMITS.min)
      .max(TRANSFER_PERCENT_LIMITS.max)
      .optional(),
    reputationTransferPercent: z.number().int()
      .min(TRANSFER_PERCENT_LIMITS.min)
      .max(TRANSFER_PERCENT_LIMITS.max)
      .optional(),
    crewPositionTransfer: z.boolean().optional(),
    notes: z.string().max(500).optional()
  }).refine(
    (data) => {
      // Validate player_heir requires heirPlayerId
      if (data.heirType === 'player_heir' && !data.heirPlayerId) {
        return false;
      }
      return true;
    },
    { message: 'player_heir type requires heirPlayerId' }
  ).refine(
    (data) => {
      // Validate NPC heirs require heirNpcName
      if ((data.heirType === 'npc_family' || data.heirType === 'npc_lieutenant') && !data.heirNpcName) {
        return false;
      }
      return true;
    },
    { message: 'NPC heir types require heirNpcName' }
  )
});

const endCharacterSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  }),
  body: z.object({
    endingType: z.enum(['death', 'prison_life', 'retirement', 'disappearance', 'exile']),
    description: z.string().max(500).optional(),
    causedByPlayerId: z.string().regex(/^\d+$/).optional(),
    executeSuccession: z.boolean().optional()
  })
});

const inheritancePreviewSchema = z.object({
  query: z.object({
    propertyPercent: z.string().regex(/^\d+$/).optional(),
    cashPercent: z.string().regex(/^\d+$/).optional(),
    reputationPercent: z.string().regex(/^\d+$/).optional()
  }).optional()
});

// =============================================================================
// REFERENCE DATA ROUTES
// =============================================================================

/**
 * GET /api/succession/types
 * Get information about succession types and endings
 */
router.get('/succession/types', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[SuccessionRoutes] GET succession types`);

    res.json({
      success: true,
      data: {
        heirTypes: Object.entries(HEIR_TYPE_LABELS).map(([type, label]) => ({
          type,
          label,
          description: HEIR_TYPE_DESCRIPTIONS[type as keyof typeof HEIR_TYPE_DESCRIPTIONS]
        })),
        endingTypes: Object.entries(ENDING_TYPE_LABELS).map(([type, label]) => ({
          type,
          label,
          descriptions: ENDING_DESCRIPTIONS[type as keyof typeof ENDING_DESCRIPTIONS]
        })),
        defaultTransferPercents: DEFAULT_TRANSFER_PERCENTS,
        transferLimits: TRANSFER_PERCENT_LIMITS
      }
    });
  } catch (error) {
    console.error('[SuccessionRoutes] Error getting succession types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get succession types'
    });
  }
});

/**
 * GET /api/succession/dynasties
 * Get all dynasties list
 */
router.get('/succession/dynasties', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    console.log(`[SuccessionRoutes] GET all dynasties`);

    const dynasties = await getAllDynasties(limit);

    res.json({
      success: true,
      data: {
        dynasties,
        total: dynasties.length
      }
    });
  } catch (error) {
    console.error('[SuccessionRoutes] Error getting dynasties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dynasties'
    });
  }
});

// =============================================================================
// SUCCESSION PLAN ROUTES
// =============================================================================

/**
 * GET /api/players/:playerId/succession
 * Get player's succession plan
 */
router.get(
  '/players/:playerId/succession',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = String(req.player!.id);

      // Only own plan viewable
      if (playerId !== requestingPlayerId) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own succession plan'
        });
        return;
      }

      console.log(`[SuccessionRoutes] GET succession plan for player: ${playerId}`);

      const plan = await getSuccessionPlan(playerId);

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting succession plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get succession plan'
      });
    }
  }
);

/**
 * POST /api/players/:playerId/succession
 * Create or update succession plan
 */
router.post(
  '/players/:playerId/succession',
  validate(successionPlanSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = String(req.player!.id);

      // Only own plan editable
      if (playerId !== requestingPlayerId) {
        res.status(403).json({
          success: false,
          error: 'You can only edit your own succession plan'
        });
        return;
      }

      console.log(`[SuccessionRoutes] Creating/updating succession plan for player: ${playerId}`);

      const {
        heirType,
        heirPlayerId,
        heirNpcName,
        propertyTransferPercent,
        cashTransferPercent,
        reputationTransferPercent,
        crewPositionTransfer,
        notes
      } = req.body;

      // Cannot designate self as heir
      if (heirPlayerId && heirPlayerId === playerId) {
        res.status(400).json({
          success: false,
          error: 'You cannot designate yourself as your heir'
        });
        return;
      }

      const plan = await createOrUpdateSuccessionPlan(playerId, {
        heirType,
        heirPlayerId,
        heirNpcName,
        propertyTransferPercent,
        cashTransferPercent,
        reputationTransferPercent,
        crewPositionTransfer,
        notes
      });

      if (!plan) {
        res.status(400).json({
          success: false,
          error: 'Failed to create succession plan. Check heir details.'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          plan,
          message: 'Succession plan saved successfully'
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error creating succession plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create succession plan'
      });
    }
  }
);

/**
 * DELETE /api/players/:playerId/succession
 * Delete succession plan
 */
router.delete(
  '/players/:playerId/succession',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = String(req.player!.id);

      if (playerId !== requestingPlayerId) {
        res.status(403).json({
          success: false,
          error: 'You can only delete your own succession plan'
        });
        return;
      }

      console.log(`[SuccessionRoutes] Deleting succession plan for player: ${playerId}`);

      const deleted = await deleteSuccessionPlan(playerId);

      res.json({
        success: true,
        data: {
          deleted,
          message: deleted ? 'Succession plan deleted' : 'No succession plan found'
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error deleting succession plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete succession plan'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/succession/validate
 * Validate current succession plan
 */
router.get(
  '/players/:playerId/succession/validate',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = String(req.player!.id);

      if (playerId !== requestingPlayerId) {
        res.status(403).json({
          success: false,
          error: 'You can only validate your own succession plan'
        });
        return;
      }

      console.log(`[SuccessionRoutes] Validating succession plan for player: ${playerId}`);

      const plan = await getSuccessionPlan(playerId);

      if (!plan) {
        res.json({
          success: true,
          data: {
            valid: false,
            errors: ['No succession plan exists'],
            plan: null
          }
        });
        return;
      }

      const validation = validateSuccessionPlan(plan);

      res.json({
        success: true,
        data: {
          ...validation,
          plan
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error validating succession plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate succession plan'
      });
    }
  }
);

/**
 * GET /api/succession/inheritance-preview
 * Preview what would be inherited with current or custom plan
 */
router.get(
  '/succession/inheritance-preview',
  validate(inheritancePreviewSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const playerId = String(req.player!.id);
      const { propertyPercent, cashPercent, reputationPercent } = req.query as {
        propertyPercent?: string;
        cashPercent?: string;
        reputationPercent?: string;
      };

      console.log(`[SuccessionRoutes] Inheritance preview for player: ${playerId}`);

      // Get existing plan or use defaults/query params
      let plan = await getSuccessionPlan(playerId);

      // Create a mock plan for calculation if none exists
      const mockPlan = {
        id: 'preview',
        playerId,
        heirType: 'player_heir' as const,
        propertyTransferPercent: propertyPercent
          ? parseInt(propertyPercent)
          : (plan?.propertyTransferPercent ?? DEFAULT_TRANSFER_PERCENTS.property),
        cashTransferPercent: cashPercent
          ? parseInt(cashPercent)
          : (plan?.cashTransferPercent ?? DEFAULT_TRANSFER_PERCENTS.cash),
        reputationTransferPercent: reputationPercent
          ? parseInt(reputationPercent)
          : (plan?.reputationTransferPercent ?? DEFAULT_TRANSFER_PERCENTS.reputation),
        crewPositionTransfer: plan?.crewPositionTransfer ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const inheritance = await calculateInheritance(playerId, mockPlan);

      res.json({
        success: true,
        data: {
          inheritance,
          transferPercents: {
            property: mockPlan.propertyTransferPercent,
            cash: mockPlan.cashTransferPercent,
            reputation: mockPlan.reputationTransferPercent
          },
          hasExistingPlan: !!plan
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting inheritance preview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get inheritance preview'
      });
    }
  }
);

// =============================================================================
// CHARACTER ENDING ROUTES
// =============================================================================

/**
 * POST /api/players/:playerId/end
 * End a character (trigger ending)
 */
router.post(
  '/players/:playerId/end',
  validate(endCharacterSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = String(req.player!.id);

      // Only for own character (unless admin)
      const isAdmin = (req.player as any)?.role === 'admin';
      if (playerId !== requestingPlayerId && !isAdmin) {
        res.status(403).json({
          success: false,
          error: 'You can only end your own character'
        });
        return;
      }

      console.log(`[SuccessionRoutes] Ending character: ${playerId}`);

      const { endingType, description, causedByPlayerId, executeSuccession } = req.body;

      const result = await endCharacter(playerId, {
        endingType,
        description,
        causedByPlayerId,
        executeSuccession
      });

      res.json({
        success: true,
        data: {
          ending: result.ending,
          succession: result.succession,
          message: result.succession?.heirId
            ? `Character ended. Inheritance transferred to heir.`
            : `Character ended. ${result.succession ? 'Assets archived.' : 'No succession plan was executed.'}`
        }
      });
    } catch (error: any) {
      console.error('[SuccessionRoutes] Error ending character:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to end character'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/endings
 * Get character endings history
 */
router.get(
  '/players/:playerId/endings',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = String(req.player!.id);
      const asKiller = req.query.asKiller === 'true';

      // Can view own endings or endings where you're the killer
      if (playerId !== requestingPlayerId && !asKiller) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own character endings'
        });
        return;
      }

      console.log(`[SuccessionRoutes] GET endings for player: ${playerId}`);

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const endings = await getCharacterEndings(playerId, { asKiller, limit });

      res.json({
        success: true,
        data: {
          endings,
          total: endings.length
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting character endings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get character endings'
      });
    }
  }
);

/**
 * GET /api/endings/:endingId
 * Get a single character ending
 */
router.get(
  '/endings/:endingId',
  validate(endingIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { endingId } = req.params;
      const requestingPlayerId = String(req.player!.id);

      console.log(`[SuccessionRoutes] GET ending: ${endingId}`);

      const ending = await getCharacterEnding(endingId);

      if (!ending) {
        res.status(404).json({
          success: false,
          error: 'Ending not found'
        });
        return;
      }

      // Check access (involved parties only)
      const isInvolved = ending.playerId === requestingPlayerId ||
        ending.causedByPlayerId === requestingPlayerId ||
        ending.heirPlayerId === requestingPlayerId;

      if (!isInvolved) {
        res.status(403).json({
          success: false,
          error: 'You are not involved in this character ending'
        });
        return;
      }

      res.json({
        success: true,
        data: ending
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting ending:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ending'
      });
    }
  }
);

// =============================================================================
// LINEAGE & DYNASTY ROUTES
// =============================================================================

/**
 * GET /api/players/:playerId/lineage
 * Get player's lineage info
 */
router.get(
  '/players/:playerId/lineage',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const includeChain = req.query.chain === 'true';

      console.log(`[SuccessionRoutes] GET lineage for player: ${playerId}`);

      const lineage = await getPlayerLineage(playerId);

      if (!lineage) {
        // Initialize lineage if not exists
        const newLineage = await initializeLineage(playerId);
        res.json({
          success: true,
          data: {
            lineage: newLineage,
            chain: [],
            isFounder: true
          }
        });
        return;
      }

      let chain: any[] = [];
      if (includeChain) {
        chain = await getLineageChain(playerId);
      }

      res.json({
        success: true,
        data: {
          lineage,
          chain,
          isFounder: lineage.generation === 1
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting lineage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get lineage'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/dynasty
 * Get full dynasty info for player
 */
router.get(
  '/players/:playerId/dynasty',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;

      console.log(`[SuccessionRoutes] GET dynasty for player: ${playerId}`);

      const dynasty = await getPlayerDynasty(playerId);

      if (!dynasty) {
        // Check if player has lineage
        const lineage = await getPlayerLineage(playerId);

        if (!lineage) {
          // Initialize and return basic dynasty
          await initializeLineage(playerId);
          const newDynasty = await getPlayerDynasty(playerId);

          res.json({
            success: true,
            data: newDynasty
          });
          return;
        }

        res.status(404).json({
          success: false,
          error: 'Dynasty not found'
        });
        return;
      }

      res.json({
        success: true,
        data: dynasty
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting player dynasty:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dynasty'
      });
    }
  }
);

/**
 * GET /api/dynasties/:dynastyName
 * Get dynasty by name (public info)
 */
router.get(
  '/dynasties/:dynastyName',
  validate(dynastyNameParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { dynastyName } = req.params;

      console.log(`[SuccessionRoutes] GET dynasty: ${dynastyName}`);

      const dynasty = await getDynasty(decodeURIComponent(dynastyName));

      if (!dynasty) {
        res.status(404).json({
          success: false,
          error: 'Dynasty not found'
        });
        return;
      }

      res.json({
        success: true,
        data: dynasty
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting dynasty:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dynasty'
      });
    }
  }
);

/**
 * GET /api/dynasties/:dynastyName/achievements
 * Get dynasty achievements
 */
router.get(
  '/dynasties/:dynastyName/achievements',
  validate(dynastyNameParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { dynastyName } = req.params;

      console.log(`[SuccessionRoutes] GET achievements for dynasty: ${dynastyName}`);

      const achievements = await getDynastyAchievements(decodeURIComponent(dynastyName));

      res.json({
        success: true,
        data: {
          achievements,
          total: achievements.length
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error getting dynasty achievements:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dynasty achievements'
      });
    }
  }
);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

/**
 * POST /api/admin/succession/:endingId/execute
 * Manually execute succession for an ending (admin only)
 */
router.post(
  '/admin/succession/:endingId/execute',
  validate(endingIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      // Check admin role
      const isAdmin = (req.player as any)?.role === 'admin';
      if (!isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const { endingId } = req.params;

      console.log(`[SuccessionRoutes] Admin executing succession for ending: ${endingId}`);

      // Get the ending to find playerId
      const ending = await getCharacterEnding(endingId);

      if (!ending) {
        res.status(404).json({
          success: false,
          error: 'Ending not found'
        });
        return;
      }

      if (ending.successionExecuted) {
        res.status(400).json({
          success: false,
          error: 'Succession already executed for this ending'
        });
        return;
      }

      const result = await executeSuccession(endingId, ending.playerId);

      if (!result) {
        res.status(400).json({
          success: false,
          error: 'Failed to execute succession. Check if succession plan exists.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...result,
          message: 'Succession executed successfully'
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error executing succession:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute succession'
      });
    }
  }
);

/**
 * POST /api/admin/lineage/:playerId/initialize
 * Initialize lineage for a player (admin only)
 */
router.post(
  '/admin/lineage/:playerId/initialize',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const isAdmin = (req.player as any)?.role === 'admin';
      if (!isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const { playerId } = req.params;
      const { dynastyName } = req.body as { dynastyName?: string };

      console.log(`[SuccessionRoutes] Admin initializing lineage for player: ${playerId}`);

      const lineage = await initializeLineage(playerId, dynastyName);

      res.json({
        success: true,
        data: {
          lineage,
          message: 'Lineage initialized'
        }
      });
    } catch (error) {
      console.error('[SuccessionRoutes] Error initializing lineage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize lineage'
      });
    }
  }
);

export default router;
