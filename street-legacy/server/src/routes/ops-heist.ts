/**
 * Solo Heist Operations Routes
 * Server-authoritative endpoints for solo heist planning and execution
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import heistService, { HEIST_PLANNING_CONFIG } from '../services/heist.service.js';
import { eventPipeline } from '../services/eventPipeline.service.js';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const startPlanningSchema = z.object({
  body: z.object({
    heistId: z.string().min(1, 'Heist ID is required')
  })
});

const performActivitySchema = z.object({
  body: z.object({
    heistId: z.string().min(1, 'Heist ID is required'),
    activityId: z.string().min(1, 'Activity ID is required')
  })
});

const executeHeistSchema = z.object({
  body: z.object({
    heistId: z.string().min(1, 'Heist ID is required'),
    operationId: z.string().uuid().optional()
  })
});

const heistIdParamSchema = z.object({
  params: z.object({
    heistId: z.string().min(1, 'Heist ID is required')
  })
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

router.use(authMiddleware);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/ops/heist/config
 * Get heist planning configuration (activities, requirements, etc.)
 */
router.get('/config', async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        activities: HEIST_PLANNING_CONFIG.activities,
        minPlanningByDifficulty: HEIST_PLANNING_CONFIG.minPlanningByDifficulty,
        planningDecayHours: HEIST_PLANNING_CONFIG.planningDecayHours,
        maxTotalBonuses: HEIST_PLANNING_CONFIG.maxTotalBonuses
      }
    });
  } catch (error) {
    console.error('Get heist config error:', error);
    res.status(500).json({ success: false, error: 'Failed to get heist config' });
  }
});

/**
 * GET /api/ops/heist/planning/:heistId
 * Get current planning session for a heist
 */
router.get('/planning/:heistId', validate(heistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const heistId = req.params.heistId;

    const planning = await heistService.getPlanning(playerId, heistId);

    if (!planning) {
      res.json({
        success: true,
        data: {
          hasPlanning: false,
          planning: null
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        hasPlanning: true,
        planning: {
          id: planning.id,
          heistId: planning.heistId,
          startedAt: planning.startedAt,
          expiresAt: planning.expiresAt,
          activities: planning.activities,
          totalBonuses: planning.totalBonuses,
          activitiesCompleted: Object.values(planning.activities).filter(v => v > 0).length
        }
      }
    });
  } catch (error) {
    console.error('Get planning error:', error);
    res.status(500).json({ success: false, error: 'Failed to get planning session' });
  }
});

/**
 * POST /api/ops/heist/start-planning
 * Start a new planning session for a solo heist
 */
router.post('/start-planning', validate(startPlanningSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { heistId } = req.body;

    const session = await heistService.startPlanning(playerId, heistId);

    res.json({
      success: true,
      data: {
        message: 'Planning session started',
        planning: {
          id: session.id,
          heistId: session.heistId,
          startedAt: session.startedAt,
          expiresAt: session.expiresAt,
          activities: session.activities,
          totalBonuses: session.totalBonuses,
          activitiesCompleted: 0
        }
      }
    });
  } catch (error: any) {
    console.error('Start planning error:', error);
    const message = error.message || 'Failed to start planning';

    if (message.includes('Requires level') || message.includes('not found')) {
      res.status(400).json({ success: false, error: message });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
});

/**
 * POST /api/ops/heist/activity
 * Perform a planning activity (costs energy/cash, grants bonuses)
 */
router.post('/activity', validate(performActivitySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { heistId, activityId } = req.body;

    const result = await heistService.performActivity(playerId, heistId, activityId);

    const activity = HEIST_PLANNING_CONFIG.activities.find(a => a.id === activityId);

    res.json({
      success: true,
      data: {
        message: `${activity?.name || activityId} completed!`,
        activityId,
        newLevel: result.newLevel,
        maxLevel: activity?.maxLevel || 1,
        energySpent: result.energySpent,
        cashSpent: result.cashSpent,
        totalBonuses: result.totalBonuses,
        activitiesCompleted: result.activitiesCompleted,
        readyToExecute: result.readyToExecute
      }
    });
  } catch (error: any) {
    console.error('Perform activity error:', error);
    const message = error.message || 'Failed to perform activity';

    if (message.includes('Not enough') || message.includes('Need $') ||
        message.includes('max level') || message.includes('expired') ||
        message.includes('not found')) {
      res.status(400).json({ success: false, error: message });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
});

/**
 * POST /api/ops/heist/execute
 * Execute the heist (server-side roll, planning bonuses applied)
 */
router.post('/execute', validate(executeHeistSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { heistId, operationId } = req.body;

    // Idempotency check - return cached result if operation already processed
    if (operationId && eventPipeline.isOperationProcessed(operationId)) {
      res.status(200).json({
        success: true,
        duplicate: true,
        operationId,
        message: 'Operation already processed'
      });
      return;
    }

    const result = await heistService.executeHeist(playerId, heistId);

    const responseData = {
      heistSuccess: result.heistSuccess,
      payout: result.payout,
      xpGained: result.xpGained,
      heatGained: result.heatGained,
      planningBonusApplied: result.planningBonusApplied,
      message: result.message,
      player: result.player
    };

    res.json({
      success: true,
      operationId: operationId || undefined,
      data: responseData
    });

    // Log to audit trail (async, non-blocking)
    if (operationId) {
      eventPipeline.processIntent(
        playerId,
        {
          operationId,
          type: 'EXECUTE_HEIST',
          params: { heistId },
          timestamp: Date.now()
        },
        async () => ({
          success: true,
          operationId,
          type: 'EXECUTE_HEIST' as const,
          data: responseData,
          playerState: result.player ? {
            cash: result.player.cash,
            xp: result.player.xp,
            heat: result.player.heat,
            energy: result.player.stamina || 0
          } : undefined
        }),
        {
          playerId,
          isNewsworthy: result.heistSuccess && result.payout > 50000,
          newsSignificance: Math.min(9, Math.ceil(result.payout / 10000))
        },
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      ).catch(err => console.error('[Heist] Audit log error:', err));
    }
  } catch (error: any) {
    console.error('Execute heist error:', error);
    const message = error.message || 'Failed to execute heist';

    if (message.includes('Requires level') || message.includes('not found') ||
        message.includes('Need at least') || message.includes('expired')) {
      res.status(400).json({ success: false, error: message });
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
});

/**
 * POST /api/ops/heist/cancel/:heistId
 * Cancel planning session (clear bonuses, start over)
 */
router.post('/cancel/:heistId', validate(heistIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const heistId = req.params.heistId;

    await heistService.clearPlanning(playerId, heistId);

    res.json({
      success: true,
      data: {
        message: 'Planning cancelled'
      }
    });
  } catch (error) {
    console.error('Cancel planning error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel planning' });
  }
});

export default router;
