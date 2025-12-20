/**
 * World Memory Routes
 * API endpoints for the persistent world memory system
 * Tracks significant game events, monuments, and NPC memories
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  recordWorldEvent,
  getWorldEvent,
  getRecentWorldEvents,
  getDistrictHistory,
  getPlayerLegacy,
  getLandmarkEvents,
  getMonuments,
  getNpcMemories,
  getNpcDialogue,
  checkAndRecordLandmark,
  getWorldMemoryStats,
  cleanExpiredMemories
} from '../services/worldMemory.service.js';
import { WorldEventType, LANDMARK_TRIGGERS } from '../types/worldMemory.types.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const eventIdParamSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'Event ID must be a number').transform(Number)
  })
});

const districtIdParamSchema = z.object({
  params: z.object({
    districtId: z.string().min(1, 'District ID is required')
  })
});

const npcIdParamSchema = z.object({
  params: z.object({
    npcId: z.string().min(1, 'NPC ID is required')
  })
});

const playerIdParamSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Player ID must be a number').transform(Number)
  })
});

const getEventsQuerySchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
    minSignificance: z.string().regex(/^\d+$/).transform(Number).optional().default('1')
  })
});

const recordLandmarkSchema = z.object({
  body: z.object({
    trigger: z.string().min(1, 'Trigger name is required'),
    districtId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    crewId: z.number().int().positive().optional()
  })
});

// =============================================================================
// WORLD EVENT ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/events
 * Get recent world events
 */
router.get('/events', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const minSignificance = Math.max(1, parseInt(req.query.minSignificance as string) || 1);

    console.log(`[WorldMemoryRoutes] GET events: limit=${limit}, minSignificance=${minSignificance}`);

    const events = await getRecentWorldEvents(limit, minSignificance);

    res.json({
      success: true,
      data: {
        events,
        total: events.length
      }
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error getting events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get world events'
    });
  }
});

/**
 * GET /api/world-memory/events/landmarks
 * Get landmark events (history book moments)
 */
router.get('/events/landmarks', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    console.log(`[WorldMemoryRoutes] GET landmark events: limit=${limit}`);

    const events = await getLandmarkEvents(limit);

    res.json({
      success: true,
      data: {
        events,
        total: events.length
      }
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error getting landmark events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get landmark events'
    });
  }
});

/**
 * GET /api/world-memory/events/:eventId
 * Get a specific world event by ID
 */
router.get(
  '/events/:eventId',
  validate(eventIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);

      console.log(`[WorldMemoryRoutes] GET event: ${eventId}`);

      const event = await getWorldEvent(eventId);

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'World event not found'
        });
        return;
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('[WorldMemoryRoutes] Error getting event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get world event'
      });
    }
  }
);

// =============================================================================
// DISTRICT HISTORY ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/districts/:districtId/history
 * Get history for a specific district (events and monuments)
 */
router.get(
  '/districts/:districtId/history',
  validate(districtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { districtId } = req.params;
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

      console.log(`[WorldMemoryRoutes] GET district history: ${districtId}, limit=${limit}`);

      const history = await getDistrictHistory(districtId, limit);

      res.json({
        success: true,
        data: {
          districtId,
          ...history
        }
      });
    } catch (error) {
      console.error('[WorldMemoryRoutes] Error getting district history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get district history'
      });
    }
  }
);

// =============================================================================
// MONUMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/monuments
 * Get all monuments, optionally filtered by district
 */
router.get('/monuments', async (req: AuthRequest, res: Response) => {
  try {
    const districtId = req.query.districtId as string | undefined;

    console.log(`[WorldMemoryRoutes] GET monuments: district=${districtId || 'all'}`);

    const monuments = await getMonuments(districtId);

    res.json({
      success: true,
      data: {
        monuments,
        total: monuments.length,
        districtId: districtId || null
      }
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error getting monuments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monuments'
    });
  }
});

// =============================================================================
// PLAYER LEGACY ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/players/:playerId/legacy
 * Get a player's legacy (all events they're involved in)
 */
router.get(
  '/players/:playerId/legacy',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const requestingPlayerId = req.player!.id;

      // Players can view their own legacy, or we could make legacy public for fame
      // For now, allow viewing any player's legacy
      console.log(`[WorldMemoryRoutes] GET player legacy: ${playerId}`);

      const legacy = await getPlayerLegacy(playerId);

      res.json({
        success: true,
        data: {
          playerId,
          ...legacy
        }
      });
    } catch (error) {
      console.error('[WorldMemoryRoutes] Error getting player legacy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get player legacy'
      });
    }
  }
);

/**
 * GET /api/world-memory/me/legacy
 * Get the current player's own legacy
 */
router.get('/me/legacy', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    console.log(`[WorldMemoryRoutes] GET my legacy: ${playerId}`);

    const legacy = await getPlayerLegacy(playerId);

    res.json({
      success: true,
      data: {
        playerId,
        ...legacy
      }
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error getting my legacy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get your legacy'
    });
  }
});

// =============================================================================
// NPC MEMORY ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/npcs/:npcId/memories
 * Get an NPC's memories of world events
 */
router.get(
  '/npcs/:npcId/memories',
  validate(npcIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { npcId } = req.params;
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

      console.log(`[WorldMemoryRoutes] GET NPC memories: ${npcId}, limit=${limit}`);

      const memories = await getNpcMemories(npcId, limit);

      res.json({
        success: true,
        data: {
          npcId,
          memories,
          total: memories.length
        }
      });
    } catch (error) {
      console.error('[WorldMemoryRoutes] Error getting NPC memories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get NPC memories'
      });
    }
  }
);

/**
 * GET /api/world-memory/npcs/:npcId/dialogue
 * Get dialogue snippets an NPC might say about remembered events
 */
router.get(
  '/npcs/:npcId/dialogue',
  validate(npcIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { npcId } = req.params;
      const limit = Math.min(10, Math.max(1, parseInt(req.query.limit as string) || 5));

      console.log(`[WorldMemoryRoutes] GET NPC dialogue: ${npcId}, limit=${limit}`);

      const dialogue = await getNpcDialogue(npcId, limit);

      res.json({
        success: true,
        data: {
          npcId,
          dialogue,
          total: dialogue.length
        }
      });
    } catch (error) {
      console.error('[WorldMemoryRoutes] Error getting NPC dialogue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get NPC dialogue'
      });
    }
  }
);

// =============================================================================
// LANDMARK TRIGGER ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/triggers
 * Get available landmark triggers and their significance levels
 */
router.get('/triggers', async (req: AuthRequest, res: Response) => {
  try {
    console.log('[WorldMemoryRoutes] GET landmark triggers');

    const triggers = Object.entries(LANDMARK_TRIGGERS).map(([key, config]) => ({
      trigger: key,
      eventType: config.eventType,
      significance: config.significance,
      isLandmark: config.significance >= 8
    }));

    res.json({
      success: true,
      data: {
        triggers,
        total: triggers.length
      }
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error getting triggers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get landmark triggers'
    });
  }
});

/**
 * POST /api/world-memory/record-landmark
 * Record a landmark event (called by game systems when achievements occur)
 */
router.post(
  '/record-landmark',
  validate(recordLandmarkSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { trigger, districtId, metadata, crewId } = req.body;
      const playerId = req.player!.id;
      const playerName = req.player!.username;

      console.log(`[WorldMemoryRoutes] POST record landmark: trigger=${trigger}, player=${playerId}`);

      // Validate trigger exists
      if (!LANDMARK_TRIGGERS[trigger]) {
        res.status(400).json({
          success: false,
          error: `Unknown landmark trigger: ${trigger}`,
          availableTriggers: Object.keys(LANDMARK_TRIGGERS)
        });
        return;
      }

      const event = await checkAndRecordLandmark(
        trigger,
        playerId,
        districtId,
        metadata,
        playerName,
        districtId, // Use districtId as districtName for now
        crewId
      );

      if (!event) {
        res.json({
          success: true,
          data: {
            recorded: false,
            message: 'Landmark already exists or conditions not met'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          recorded: true,
          event
        }
      });
    } catch (error) {
      console.error('[WorldMemoryRoutes] Error recording landmark:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record landmark'
      });
    }
  }
);

// =============================================================================
// STATISTICS ENDPOINTS
// =============================================================================

/**
 * GET /api/world-memory/stats
 * Get world memory statistics
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    console.log('[WorldMemoryRoutes] GET stats');

    const stats = await getWorldMemoryStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get world memory statistics'
    });
  }
});

// =============================================================================
// MAINTENANCE ENDPOINTS (Admin only - could add admin middleware)
// =============================================================================

/**
 * POST /api/world-memory/cleanup
 * Clean up expired NPC memories (maintenance task)
 */
router.post('/cleanup', async (req: AuthRequest, res: Response) => {
  try {
    console.log('[WorldMemoryRoutes] POST cleanup expired memories');

    const cleanedCount = await cleanExpiredMemories();

    res.json({
      success: true,
      data: {
        cleanedMemories: cleanedCount
      }
    });
  } catch (error) {
    console.error('[WorldMemoryRoutes] Error cleaning memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean expired memories'
    });
  }
});

export default router;

// Export cleanup function for scheduled jobs
export { cleanExpiredMemories };
