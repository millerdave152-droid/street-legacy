/**
 * Witness Mechanic Routes
 * API endpoints for the witness/testimonial system
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  getWitnessableEvents,
  getEventById,
  getEventWitnesses,
  verifyWitness,
  getPlayerTestimonials,
  setTestimonialFeatured,
  getWitnessHistory
} from '../services/witness.service.js';
import { isVerificationWindowOpen } from '../types/witness.types.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const eventIdParamSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'Invalid event ID')
  })
});

const verifyWitnessSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'Invalid event ID')
  }),
  body: z.object({
    testimony: z.string().max(500, 'Testimony must be 500 characters or less').optional()
  })
});

const playerIdParamSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID')
  })
});

const testimonialsQuerySchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    featuredOnly: z.enum(['true', 'false']).optional()
  })
});

const featureTestimonialSchema = z.object({
  params: z.object({
    playerId: z.string().regex(/^\d+$/, 'Invalid player ID'),
    testimonialId: z.string().regex(/^\d+$/, 'Invalid testimonial ID')
  }),
  body: z.object({
    featured: z.boolean()
  })
});

// =============================================================================
// WITNESS EVENT ENDPOINTS
// =============================================================================

/**
 * GET /api/witness/events
 * Get events the current player can witness (is potential witness)
 */
router.get('/events', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    console.log(`[WitnessRoutes] GET witnessable events for player: ${playerId}`);

    const events = await getWitnessableEvents(String(playerId));

    // Add canVerify flag to each event
    const eventsWithFlags = events.map(event => ({
      ...event,
      canVerify: isVerificationWindowOpen(event)
    }));

    res.json({
      success: true,
      data: {
        events: eventsWithFlags,
        total: events.length
      }
    });
  } catch (error) {
    console.error('[WitnessRoutes] Error getting witnessable events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get witnessable events'
    });
  }
});

/**
 * GET /api/witness/events/:eventId
 * Get single witnessed event details with list of witnesses
 */
router.get(
  '/events/:eventId',
  validate(eventIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventId } = req.params;
      const playerId = req.player!.id;

      console.log(`[WitnessRoutes] GET event details: ${eventId}`);

      const event = await getEventById(parseInt(eventId, 10));

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        });
        return;
      }

      // Get all witnesses for this event
      const witnesses = await getEventWitnesses(eventId);

      // Check if current player is a witness
      const playerWitness = witnesses.find(w => w.witnessPlayerId === playerId);
      const isWitness = !!playerWitness;
      const canVerify = isWitness &&
        playerWitness.witnessStatus === 'potential' &&
        isVerificationWindowOpen(event);

      res.json({
        success: true,
        data: {
          ...event,
          witnesses,
          isWitness,
          canVerify,
          playerWitnessStatus: playerWitness?.witnessStatus || null
        }
      });
    } catch (error) {
      console.error('[WitnessRoutes] Error getting event details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get event details'
      });
    }
  }
);

/**
 * POST /api/witness/events/:eventId/verify
 * Verify that you witnessed an event
 */
router.post(
  '/events/:eventId/verify',
  validate(verifyWitnessSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventId } = req.params;
      const { testimony } = req.body;
      const playerId = req.player!.id;

      console.log(`[WitnessRoutes] POST verify witness: event=${eventId}, player=${playerId}`);

      // Verify the event exists
      const event = await getEventById(parseInt(eventId, 10));

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        });
        return;
      }

      // Check verification window
      if (!isVerificationWindowOpen(event)) {
        res.status(400).json({
          success: false,
          error: 'Verification window has expired'
        });
        return;
      }

      // Attempt to verify
      const result = await verifyWitness(eventId, String(playerId), testimony);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Failed to verify witness. You may not be a potential witness for this event.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          verified: true,
          message: 'Successfully verified witness',
          testimonial: result.testimonial || null
        }
      });
    } catch (error) {
      console.error('[WitnessRoutes] Error verifying witness:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify witness'
      });
    }
  }
);

// =============================================================================
// TESTIMONIAL ENDPOINTS
// =============================================================================

/**
 * GET /api/players/:playerId/testimonials
 * Get testimonials about a player (public for any player)
 */
router.get(
  '/players/:playerId/testimonials',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const { limit = '20', featuredOnly = 'false' } = req.query as { limit?: string; featuredOnly?: string };

      console.log(`[WitnessRoutes] GET testimonials for player: ${playerId}`);

      const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
      let testimonials = await getPlayerTestimonials(playerId, parsedLimit);

      // Filter to featured only if requested
      if (featuredOnly === 'true') {
        testimonials = testimonials.filter(t => t.featured);
      }

      const featuredCount = testimonials.filter(t => t.featured).length;

      res.json({
        success: true,
        data: {
          testimonials,
          total: testimonials.length,
          featuredCount
        }
      });
    } catch (error) {
      console.error('[WitnessRoutes] Error getting testimonials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get testimonials'
      });
    }
  }
);

/**
 * PUT /api/players/:playerId/testimonials/:testimonialId/feature
 * Toggle featured status (only own testimonials)
 */
router.put(
  '/players/:playerId/testimonials/:testimonialId/feature',
  validate(featureTestimonialSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId, testimonialId } = req.params;
      const { featured } = req.body;
      const requestingPlayerId = req.player!.id;

      console.log(`[WitnessRoutes] PUT feature testimonial: player=${playerId}, testimonial=${testimonialId}, featured=${featured}`);

      // Players can only modify their own testimonials
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only modify your own testimonials'
        });
        return;
      }

      const success = await setTestimonialFeatured(testimonialId, playerId, featured);

      if (!success) {
        res.status(400).json({
          success: false,
          error: featured
            ? 'Failed to feature testimonial. You may have reached the maximum featured limit.'
            : 'Failed to unfeature testimonial. Testimonial may not exist.'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          testimonialId: parseInt(testimonialId, 10),
          featured
        }
      });
    } catch (error) {
      console.error('[WitnessRoutes] Error featuring testimonial:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update testimonial featured status'
      });
    }
  }
);

/**
 * GET /api/players/:playerId/witness-history
 * Get events player has witnessed and verification count
 */
router.get(
  '/players/:playerId/witness-history',
  validate(playerIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { playerId } = req.params;
      const requestingPlayerId = req.player!.id;

      console.log(`[WitnessRoutes] GET witness history for player: ${playerId}`);

      // Players can only view their own witness history
      if (String(playerId) !== String(requestingPlayerId)) {
        res.status(403).json({
          success: false,
          error: 'You can only view your own witness history'
        });
        return;
      }

      const history = await getWitnessHistory(playerId);

      res.json({
        success: true,
        data: {
          events: history.witnessed,
          totalWitnessed: history.witnessed.length,
          totalVerified: history.verified
        }
      });
    } catch (error) {
      console.error('[WitnessRoutes] Error getting witness history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get witness history'
      });
    }
  }
);

export default router;
