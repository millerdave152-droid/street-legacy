import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { sendToUser } from '../websocket/index.js';
import { createNotification } from '../websocket/events.js';

const router = Router();

// All market routes require authentication
router.use(authMiddleware);

// =============================================================================
// GET /api/market - Get active market listings
// =============================================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      district,
      maxPrice,
      search,
      limit = '50',
      offset = '0'
    } = req.query;

    const result = await pool.query(
      `SELECT * FROM get_market_listings($1, $2, $3, $4, $5, $6)`,
      [
        type || null,
        district || null,
        maxPrice ? parseInt(maxPrice as string) : null,
        search || null,
        parseInt(limit as string),
        parseInt(offset as string)
      ]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        sellerId: row.seller_id,
        sellerUsername: row.seller_username,
        listingType: row.listing_type,
        title: row.title,
        description: row.description,
        askingPrice: parseInt(row.asking_price),
        itemData: row.item_data,
        serviceDetails: row.service_details,
        districtId: row.district_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        timeRemainingMs: row.time_remaining ?
          parseInt(row.time_remaining.hours || 0) * 3600000 +
          parseInt(row.time_remaining.minutes || 0) * 60000 : 0
      }))
    });
  } catch (error) {
    console.error('Market listings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get market listings' });
  }
});

// =============================================================================
// GET /api/market/stats - Get market statistics
// =============================================================================
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM get_market_stats()');
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        activeListings: parseInt(stats.active_listings) || 0,
        totalVolume24h: parseInt(stats.total_volume_24h) || 0,
        avgPrice: parseInt(stats.avg_price) || 0,
        listingsByType: stats.listings_by_type || {}
      }
    });
  } catch (error) {
    console.error('Market stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get market stats' });
  }
});

// =============================================================================
// GET /api/market/my-listings - Get player's own listings
// =============================================================================
router.get('/my-listings', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      'SELECT * FROM get_player_listings($1)',
      [playerId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        listingType: row.listing_type,
        title: row.title,
        askingPrice: parseInt(row.asking_price),
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        offerCount: parseInt(row.offer_count) || 0
      }))
    });
  } catch (error) {
    console.error('My listings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get your listings' });
  }
});

// =============================================================================
// GET /api/market/:id - Get single listing details
// =============================================================================
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ml.*, p.username as seller_username, p.level as seller_level
       FROM market_listings ml
       JOIN players p ON ml.seller_id = p.id
       WHERE ml.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    const listing = result.rows[0];

    res.json({
      success: true,
      data: {
        id: listing.id,
        sellerId: listing.seller_id,
        sellerUsername: listing.seller_username,
        sellerLevel: listing.seller_level,
        listingType: listing.listing_type,
        title: listing.title,
        description: listing.description,
        askingPrice: parseInt(listing.asking_price),
        minOffer: listing.min_offer ? parseInt(listing.min_offer) : null,
        listingFee: parseInt(listing.listing_fee),
        itemData: listing.item_data,
        serviceDetails: listing.service_details,
        status: listing.status,
        districtId: listing.district_id,
        createdAt: listing.created_at,
        expiresAt: listing.expires_at
      }
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ success: false, error: 'Failed to get listing' });
  }
});

// =============================================================================
// POST /api/market - Create new listing
// =============================================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const {
      listingType,
      title,
      description,
      askingPrice,
      itemData,
      serviceDetails,
      districtId,
      durationDays = 7
    } = req.body;

    // Validate required fields
    if (!listingType || !title || !askingPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: listingType, title, askingPrice'
      });
    }

    // Validate listing type
    const validTypes = ['item', 'service', 'favor', 'intel'];
    if (!validTypes.includes(listingType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid listing type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Create listing
    const result = await pool.query(
      `SELECT * FROM create_market_listing($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        playerId,
        listingType,
        title,
        description || null,
        askingPrice,
        itemData ? JSON.stringify(itemData) : null,
        serviceDetails ? JSON.stringify(serviceDetails) : null,
        districtId || null,
        durationDays
      ]
    );

    const createResult = result.rows[0];

    if (!createResult.success) {
      return res.status(400).json({
        success: false,
        error: createResult.error_message,
        feeRequired: parseInt(createResult.fee_charged) || 0
      });
    }

    res.json({
      success: true,
      data: {
        listingId: createResult.listing_id,
        feeCharged: parseInt(createResult.fee_charged)
      },
      message: `Listing created! Fee: $${parseInt(createResult.fee_charged).toLocaleString()}`
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ success: false, error: 'Failed to create listing' });
  }
});

// =============================================================================
// POST /api/market/:id/buy - Purchase a listing
// =============================================================================
router.post('/:id/buy', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM purchase_listing($1, $2)',
      [id, playerId]
    );

    const purchaseResult = result.rows[0];

    if (!purchaseResult.success) {
      return res.status(400).json({
        success: false,
        error: purchaseResult.error_message,
        amountRequired: parseInt(purchaseResult.amount_paid) || 0
      });
    }

    // Notify seller
    const listingResult = await pool.query(
      `SELECT ml.seller_id, ml.title, p.username as buyer_username
       FROM market_listings ml
       JOIN players p ON p.id = $2
       WHERE ml.id = $1`,
      [id, playerId]
    );

    if (listingResult.rows.length > 0) {
      const listing = listingResult.rows[0];
      sendToUser(listing.seller_id, createNotification({
        title: 'Item Sold!',
        message: `${listing.buyer_username} purchased your "${listing.title}" for $${parseInt(purchaseResult.amount_paid).toLocaleString()}`,
        type: 'success'
      }));
    }

    res.json({
      success: true,
      data: {
        transactionId: purchaseResult.transaction_id,
        amountPaid: parseInt(purchaseResult.amount_paid)
      },
      message: `Purchase complete! Paid $${parseInt(purchaseResult.amount_paid).toLocaleString()}`
    });
  } catch (error) {
    console.error('Purchase listing error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase listing' });
  }
});

// =============================================================================
// POST /api/market/:id/cancel - Cancel your own listing
// =============================================================================
router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM cancel_listing($1, $2)',
      [id, playerId]
    );

    const cancelResult = result.rows[0];

    if (!cancelResult.success) {
      return res.status(400).json({
        success: false,
        error: cancelResult.error_message
      });
    }

    res.json({
      success: true,
      data: {
        refundAmount: parseInt(cancelResult.refund_amount)
      },
      message: `Listing cancelled. Refunded $${parseInt(cancelResult.refund_amount).toLocaleString()} (50% of fee)`
    });
  } catch (error) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel listing' });
  }
});

// =============================================================================
// GET /api/market/types/available - Get available listing types
// =============================================================================
router.get('/types/available', async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        type: 'item',
        name: 'Item',
        description: 'Physical items like weapons, gear, or supplies',
        icon: 'box'
      },
      {
        type: 'service',
        name: 'Service',
        description: 'Help with heists, protection, or transportation',
        icon: 'briefcase'
      },
      {
        type: 'favor',
        name: 'Favor',
        description: 'One-time assistance or future IOU',
        icon: 'handshake'
      },
      {
        type: 'intel',
        name: 'Intel',
        description: 'Information about targets, opportunities, or threats',
        icon: 'eye'
      }
    ]
  });
});

export default router;
