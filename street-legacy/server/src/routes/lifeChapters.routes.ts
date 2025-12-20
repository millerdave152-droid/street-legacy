/**
 * Life Chapters Routes
 * API endpoints for the character aging and life phase system
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  getAllChapterConfigs,
  getChapterConfig,
  getPlayerLifeState,
  getChapterModifiers,
  getUnlockedFeatures,
  getLockedFeatures,
  checkChapterTransition,
  getChapterHistory,
  getGameTimeConfig,
  canUseFeature,
  applyChapterModifier,
  getChapterStatistics
} from '../services/lifeChapters.service.js';
import {
  LifeChapter,
  CHAPTER_ORDER,
  FEATURE_REQUIREMENTS
} from '../types/lifeChapters.types.js';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const chapterIdParamSchema = z.object({
  params: z.object({
    chapterId: z.enum(['come_up', 'player', 'boss', 'legacy'])
  })
});

const playerIdParamSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  })
});

const checkFeatureSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  }),
  query: z.object({
    feature: z.string().min(1, 'Feature name is required')
  })
});

const applyModifierSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  }),
  body: z.object({
    modifierName: z.string().min(1, 'Modifier name is required'),
    baseValue: z.number()
  })
});

// =============================================================================
// PUBLIC CHAPTER ENDPOINTS
// =============================================================================

/**
 * GET /api/chapters
 * Get all chapter configurations (public game mechanics info)
 */
router.get('/chapters', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[LifeChaptersRoutes] GET all chapter configs`);

    const chapters = await getAllChapterConfigs();

    res.json({
      success: true,
      data: {
        chapters,
        order: CHAPTER_ORDER,
        total: chapters.length
      }
    });
  } catch (error) {
    console.error('[LifeChaptersRoutes] Error getting chapter configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chapter configurations'
    });
  }
});

/**
 * GET /api/chapters/:chapterId
 * Get single chapter configuration
 */
router.get(
  '/chapters/:chapterId',
  validate(chapterIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { chapterId } = req.params;

      console.log(`[LifeChaptersRoutes] GET chapter config: ${chapterId}`);

      const chapter = await getChapterConfig(chapterId as LifeChapter);

      if (!chapter) {
        res.status(404).json({
          success: false,
          error: 'Chapter not found'
        });
        return;
      }

      // Get index in progression
      const index = CHAPTER_ORDER.indexOf(chapterId as LifeChapter);
      const nextChapter = index < CHAPTER_ORDER.length - 1 ? CHAPTER_ORDER[index + 1] : null;
      const previousChapter = index > 0 ? CHAPTER_ORDER[index - 1] : null;

      res.json({
        success: true,
        data: {
          ...chapter,
          progression: {
            index,
            previousChapter,
            nextChapter,
            isFirst: index === 0,
            isLast: index === CHAPTER_ORDER.length - 1
          }
        }
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error getting chapter config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chapter configuration'
      });
    }
  }
);

// =============================================================================
// GAME TIME ENDPOINT
// =============================================================================

/**
 * GET /api/game/time
 * Get game time configuration
 */
router.get('/game/time', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[LifeChaptersRoutes] GET game time config`);

    const timeConfig = await getGameTimeConfig();

    res.json({
      success: true,
      data: {
        ...timeConfig,
        description: `${timeConfig.realDaysPerGameYear} real days = 1 game year`
      }
    });
  } catch (error) {
    console.error('[LifeChaptersRoutes] Error getting game time config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get game time configuration'
    });
  }
});

/**
 * GET /api/game/chapters/stats
 * Get chapter distribution statistics
 */
router.get('/game/chapters/stats', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[LifeChaptersRoutes] GET chapter statistics`);

    const stats = await getChapterStatistics();

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);

    res.json({
      success: true,
      data: {
        distribution: stats,
        total,
        percentages: {
          come_up: total > 0 ? Math.round((stats.come_up / total) * 100) : 0,
          player: total > 0 ? Math.round((stats.player / total) * 100) : 0,
          boss: total > 0 ? Math.round((stats.boss / total) * 100) : 0,
          legacy: total > 0 ? Math.round((stats.legacy / total) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('[LifeChaptersRoutes] Error getting chapter statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chapter statistics'
    });
  }
});

// =============================================================================
// PLAYER LIFE STATE ENDPOINTS (Require Auth)
// =============================================================================

// Apply auth middleware for player-specific routes
router.use('/players', authMiddleware);

/**
 * GET /api/players/:playerId/life
 * Get player's complete life state
 */
router.get(
  '/players/:playerId/life',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = req.player!.id;

      // Players can only view their own life state
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own life state'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] GET life state for player: ${playerId}`);

      const lifeState = await getPlayerLifeState(playerId);

      if (!lifeState) {
        res.status(404).json({
          success: false,
          error: 'Player not found'
        });
        return;
      }

      res.json({
        success: true,
        data: lifeState
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error getting player life state:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get player life state'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/life/modifiers
 * Get current chapter modifiers for player
 */
router.get(
  '/players/:playerId/life/modifiers',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = req.player!.id;

      // Players can only view their own modifiers
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own modifiers'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] GET modifiers for player: ${playerId}`);

      const modifiers = await getChapterModifiers(playerId);

      res.json({
        success: true,
        data: {
          modifiers,
          description: 'Values are multipliers (e.g., 0.2 = 20% bonus/penalty)'
        }
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error getting player modifiers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get player modifiers'
      });
    }
  }
);

/**
 * POST /api/players/:playerId/life/modifiers/apply
 * Apply a modifier to a base value
 */
router.post(
  '/players/:playerId/life/modifiers/apply',
  validate(applyModifierSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const { modifierName, baseValue } = req.body;
      const requestingPlayerId = req.player!.id;

      // Players can only apply their own modifiers
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only apply your own modifiers'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] Apply modifier ${modifierName} for player: ${playerId}`);

      const modifiers = await getChapterModifiers(playerId);
      const modifiedValue = await applyChapterModifier(playerId, modifierName, baseValue);
      const modifierAmount = modifiers[modifierName] || 0;

      res.json({
        success: true,
        data: {
          modifierName,
          baseValue,
          modifiedValue,
          modifierAmount,
          difference: modifiedValue - baseValue
        }
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error applying modifier:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply modifier'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/life/features
 * Get unlocked and locked features for player
 */
router.get(
  '/players/:playerId/life/features',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = req.player!.id;

      // Players can only view their own features
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own features'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] GET features for player: ${playerId}`);

      const [unlocked, locked] = await Promise.all([
        getUnlockedFeatures(playerId),
        getLockedFeatures(playerId)
      ]);

      res.json({
        success: true,
        data: {
          unlocked,
          locked,
          unlockedCount: unlocked.length,
          lockedCount: locked.length
        }
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error getting player features:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get player features'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/life/features/check
 * Check if a specific feature is available
 */
router.get(
  '/players/:playerId/life/features/check',
  validate(checkFeatureSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const { feature } = req.query as { feature: string };
      const requestingPlayerId = req.player!.id;

      // Players can only check their own features
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only check your own features'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] Check feature ${feature} for player: ${playerId}`);

      const available = await canUseFeature(playerId, feature);
      const lifeState = await getPlayerLifeState(playerId);
      const requiredChapters = FEATURE_REQUIREMENTS[feature];

      res.json({
        success: true,
        data: {
          feature,
          available,
          currentChapter: lifeState?.currentChapter,
          requiredChapters: requiredChapters || 'any',
          message: available
            ? `Feature "${feature}" is available in your current chapter`
            : `Feature "${feature}" is not available in your current chapter`
        }
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error checking feature:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check feature availability'
      });
    }
  }
);

/**
 * POST /api/players/:playerId/life/check-transition
 * Manually trigger chapter transition check
 */
router.post(
  '/players/:playerId/life/check-transition',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = req.player!.id;

      // Players can only trigger their own transition check
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only check your own transitions'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] Check transition for player: ${playerId}`);

      const transition = await checkChapterTransition(playerId);

      if (transition) {
        // Get updated life state
        const lifeState = await getPlayerLifeState(playerId);

        res.json({
          success: true,
          data: {
            transitioned: true,
            transition,
            newLifeState: lifeState,
            message: `Congratulations! You've entered the ${transition.toChapter} chapter.`
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            transitioned: false,
            transition: null,
            message: 'No chapter transition needed at this time'
          }
        });
      }
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error checking transition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check chapter transition'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/life/history
 * Get chapter transition history
 */
router.get(
  '/players/:playerId/life/history',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = req.player!.id;

      // Players can only view their own history
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own chapter history'
        });
        return;
      }

      console.log(`[LifeChaptersRoutes] GET chapter history for player: ${playerId}`);

      const history = await getChapterHistory(playerId);

      res.json({
        success: true,
        data: {
          transitions: history,
          total: history.length
        }
      });
    } catch (error) {
      console.error('[LifeChaptersRoutes] Error getting chapter history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chapter history'
      });
    }
  }
);

/**
 * GET /api/features
 * Get all feature requirements (public info)
 */
router.get('/features', async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[LifeChaptersRoutes] GET all feature requirements`);

    // Transform feature requirements for response
    const features = Object.entries(FEATURE_REQUIREMENTS).map(([feature, chapters]) => ({
      feature,
      availableInChapters: chapters,
      earliestChapter: chapters[0],
      latestChapter: chapters[chapters.length - 1]
    }));

    res.json({
      success: true,
      data: {
        features,
        total: features.length,
        byChapter: CHAPTER_ORDER.reduce((acc, chapter) => {
          acc[chapter] = features
            .filter(f => f.availableInChapters.includes(chapter))
            .map(f => f.feature);
          return acc;
        }, {} as Record<string, string[]>)
      }
    });
  } catch (error) {
    console.error('[LifeChaptersRoutes] Error getting feature requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get feature requirements'
    });
  }
});

export default router;
