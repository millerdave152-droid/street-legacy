/**
 * Street Broadcast Routes
 * API endpoints for the dynamic news system
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import {
  getPlayerFeed,
  getNewsById,
  markNewsRead,
  getDistrictNews,
  getSubscriptions,
  subscribe,
  unsubscribe,
  createNews,
  getUnreadCount
} from '../services/streetBroadcast.service.js';
import {
  NewsType,
  NewsCategory,
  SubscriptionType,
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT
} from '../types/streetBroadcast.types.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const newsIdParamSchema = z.object({
  params: z.object({
    newsId: z.string().uuid('Invalid news ID')
  })
});

const districtIdParamSchema = z.object({
  params: z.object({
    districtId: z.string().regex(/^\d+$/, 'Invalid district ID')
  })
});

const feedQuerySchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    includeRead: z.enum(['true', 'false']).optional()
  })
});

const districtNewsQuerySchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
    category: z.enum(['crime', 'business', 'territory', 'crew', 'politics', 'general']).optional()
  })
});

const subscribeSchema = z.object({
  body: z.object({
    subscriptionType: z.enum(['district', 'crew', 'player', 'category']),
    targetId: z.string().min(1, 'Target ID is required')
  })
});

const unsubscribeParamsSchema = z.object({
  params: z.object({
    subscriptionType: z.enum(['district', 'crew', 'player', 'category']),
    targetId: z.string().min(1, 'Target ID is required')
  })
});

const createNewsSchema = z.object({
  body: z.object({
    newsType: z.enum(['breaking', 'rumor', 'weekly_recap', 'district_update', 'player_spotlight']),
    category: z.enum(['crime', 'business', 'territory', 'crew', 'politics', 'general']),
    headline: z.string().min(1).max(200, 'Headline must be 200 characters or less'),
    body: z.string().min(1).max(5000, 'Body must be 5000 characters or less'),
    districtId: z.number().int().positive().optional(),
    relatedPlayerIds: z.array(z.number().int().positive()).optional(),
    relatedCrewIds: z.array(z.number().int().positive()).optional(),
    significance: z.number().int().min(1).max(10).optional(),
    expiresHours: z.number().int().min(1).max(720).nullable().optional(),
    isAnonymous: z.boolean().optional()
  })
});

const breakingQuerySchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional()
  })
});

// =============================================================================
// NEWS FEED ENDPOINTS
// =============================================================================

/**
 * GET /api/news/feed
 * Get personalized news feed for current player
 */
router.get('/feed', validate(feedQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const {
      limit = String(DEFAULT_FEED_LIMIT),
      offset = '0',
      includeRead = 'false'
    } = req.query as { limit?: string; offset?: string; includeRead?: string };

    console.log(`[StreetBroadcastRoutes] GET feed for player: ${playerId}`);

    const parsedLimit = Math.min(MAX_FEED_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_FEED_LIMIT));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const { news, unreadCount } = await getPlayerFeed(
      String(playerId),
      parsedLimit,
      parsedOffset,
      includeRead === 'true'
    );

    res.json({
      success: true,
      data: {
        news,
        unreadCount,
        hasMore: news.length === parsedLimit
      }
    });
  } catch (error) {
    console.error('[StreetBroadcastRoutes] Error getting feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get news feed'
    });
  }
});

/**
 * GET /api/news/unread-count
 * Get unread news count for current player
 */
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    console.log(`[StreetBroadcastRoutes] GET unread count for player: ${playerId}`);

    const count = await getUnreadCount(String(playerId));

    res.json({
      success: true,
      data: {
        unreadCount: count
      }
    });
  } catch (error) {
    console.error('[StreetBroadcastRoutes] Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

/**
 * GET /api/news/breaking
 * Get all breaking news (significance >= 8)
 */
router.get('/breaking', validate(breakingQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '10' } = req.query as { limit?: string };
    const playerId = req.player!.id;

    console.log(`[StreetBroadcastRoutes] GET breaking news`);

    const parsedLimit = Math.min(MAX_FEED_LIMIT, Math.max(1, parseInt(limit, 10) || 10));

    // Get breaking news using player feed with high significance filter
    const { news } = await getPlayerFeed(String(playerId), parsedLimit, 0, true);

    // Filter to only breaking news
    const breakingNews = news.filter(n => n.significance >= 8 || n.newsType === 'breaking');

    res.json({
      success: true,
      data: {
        news: breakingNews,
        total: breakingNews.length
      }
    });
  } catch (error) {
    console.error('[StreetBroadcastRoutes] Error getting breaking news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get breaking news'
    });
  }
});

/**
 * GET /api/news/district/:districtId
 * Get news for specific district
 */
router.get(
  '/district/:districtId',
  validate(districtIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { districtId } = req.params;
      const { limit = '20', category } = req.query as { limit?: string; category?: NewsCategory };

      console.log(`[StreetBroadcastRoutes] GET news for district: ${districtId}`);

      const parsedLimit = Math.min(MAX_FEED_LIMIT, Math.max(1, parseInt(limit, 10) || 20));

      let news = await getDistrictNews(districtId, parsedLimit);

      // Filter by category if provided
      if (category) {
        news = news.filter(n => n.category === category);
      }

      res.json({
        success: true,
        data: {
          districtId: parseInt(districtId, 10),
          news,
          total: news.length
        }
      });
    } catch (error) {
      console.error('[StreetBroadcastRoutes] Error getting district news:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get district news'
      });
    }
  }
);

/**
 * GET /api/news/:newsId
 * Get single news article (auto-marks as read)
 */
router.get(
  '/:newsId',
  validate(newsIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { newsId } = req.params;
      const playerId = req.player!.id;

      console.log(`[StreetBroadcastRoutes] GET news: ${newsId}`);

      const news = await getNewsById(newsId);

      if (!news) {
        res.status(404).json({
          success: false,
          error: 'News article not found'
        });
        return;
      }

      // Auto-mark as read
      await markNewsRead(String(playerId), newsId);

      res.json({
        success: true,
        data: {
          ...news,
          isRead: true
        }
      });
    } catch (error) {
      console.error('[StreetBroadcastRoutes] Error getting news:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get news article'
      });
    }
  }
);

/**
 * POST /api/news/:newsId/read
 * Explicitly mark news as read
 */
router.post(
  '/:newsId/read',
  validate(newsIdParamSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { newsId } = req.params;
      const playerId = req.player!.id;

      console.log(`[StreetBroadcastRoutes] POST mark read: ${newsId}`);

      const success = await markNewsRead(String(playerId), newsId);

      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to mark news as read'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          newsId,
          readAt: new Date()
        }
      });
    } catch (error) {
      console.error('[StreetBroadcastRoutes] Error marking news read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark news as read'
      });
    }
  }
);

// =============================================================================
// SUBSCRIPTION ENDPOINTS
// =============================================================================

/**
 * GET /api/news/subscriptions
 * Get current player's news subscriptions
 */
router.get('/subscriptions', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    console.log(`[StreetBroadcastRoutes] GET subscriptions for player: ${playerId}`);

    const subscriptions = await getSubscriptions(String(playerId));

    res.json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length
      }
    });
  } catch (error) {
    console.error('[StreetBroadcastRoutes] Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions'
    });
  }
});

/**
 * POST /api/news/subscriptions
 * Subscribe to news source
 */
router.post(
  '/subscriptions',
  validate(subscribeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { subscriptionType, targetId } = req.body;
      const playerId = req.player!.id;

      console.log(`[StreetBroadcastRoutes] POST subscribe: ${subscriptionType}:${targetId}`);

      const subscription = await subscribe(
        String(playerId),
        subscriptionType as SubscriptionType,
        targetId
      );

      if (!subscription) {
        res.status(400).json({
          success: false,
          error: 'Failed to create subscription'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: subscription
      });
    } catch (error) {
      console.error('[StreetBroadcastRoutes] Error subscribing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to subscribe'
      });
    }
  }
);

/**
 * DELETE /api/news/subscriptions/:subscriptionType/:targetId
 * Unsubscribe from news source
 */
router.delete(
  '/subscriptions/:subscriptionType/:targetId',
  validate(unsubscribeParamsSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { subscriptionType, targetId } = req.params;
      const playerId = req.player!.id;

      console.log(`[StreetBroadcastRoutes] DELETE subscription: ${subscriptionType}:${targetId}`);

      const success = await unsubscribe(
        String(playerId),
        subscriptionType as SubscriptionType,
        targetId
      );

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          unsubscribed: true,
          subscriptionType,
          targetId
        }
      });
    } catch (error) {
      console.error('[StreetBroadcastRoutes] Error unsubscribing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe'
      });
    }
  }
);

// =============================================================================
// ADMIN/INTERNAL ENDPOINTS
// =============================================================================

/**
 * POST /api/news
 * Create news article directly (internal/admin use)
 */
router.post(
  '/',
  validate(createNewsSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        newsType,
        category,
        headline,
        body,
        districtId,
        relatedPlayerIds,
        relatedCrewIds,
        significance,
        expiresHours,
        isAnonymous
      } = req.body;

      console.log(`[StreetBroadcastRoutes] POST create news: ${headline}`);

      // TODO: Add admin/moderator check here
      // For now, allow any authenticated user (for testing)

      const news = await createNews({
        newsType: newsType as NewsType,
        category: category as NewsCategory,
        headline,
        body,
        districtId,
        relatedPlayerIds,
        relatedCrewIds,
        significance,
        expiresHours,
        isAnonymous
      });

      if (!news) {
        res.status(400).json({
          success: false,
          error: 'Failed to create news article'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: news
      });
    } catch (error) {
      console.error('[StreetBroadcastRoutes] Error creating news:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create news article'
      });
    }
  }
);

/**
 * POST /api/news/mark-all-read
 * Mark all news as read for current player
 */
router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    console.log(`[StreetBroadcastRoutes] POST mark all read for player: ${playerId}`);

    // Get all unread news for player and mark them read
    const { news } = await getPlayerFeed(String(playerId), MAX_FEED_LIMIT, 0, false);

    let markedCount = 0;
    for (const article of news) {
      const success = await markNewsRead(String(playerId), article.id);
      if (success) markedCount++;
    }

    res.json({
      success: true,
      data: {
        markedCount
      }
    });
  } catch (error) {
    console.error('[StreetBroadcastRoutes] Error marking all read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all as read'
    });
  }
});

export default router;
