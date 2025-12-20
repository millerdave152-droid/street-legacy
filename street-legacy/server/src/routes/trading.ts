import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { economyAudit } from '../utils/auditLog.js';
import { validate } from '../validation/validate.middleware.js';
import { createTradeSchema, tradeActionSchema } from '../validation/schemas/index.js';
import { notifyTransferReceived, notifyStatUpdate, sendToUser } from '../websocket/index.js';
import { createNotification, createEvent, BaseWSEvent } from '../websocket/events.js';

// Trade event types
interface TradeRequestEvent extends BaseWSEvent {
  type: 'trade:request_received';
  tradeId: number;
  fromPlayerId: number;
  fromUsername: string;
  offeringCash: number;
  requestingCash: number;
  itemCount: number;
}

interface TradeCompletedEvent extends BaseWSEvent {
  type: 'trade:completed';
  tradeId: number;
  withPlayerId: number;
  withUsername: string;
  cashReceived: number;
  itemsReceived: number;
}

const router = Router();

router.use(authMiddleware);

// GET /api/trade/pending - Get pending trades for the player
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get trades where player is sender or receiver
    const tradesResult = await pool.query(
      `SELECT t.*,
              fp.username as from_username, fp.level as from_level,
              tp.username as to_username, tp.level as to_level
       FROM trades t
       JOIN players fp ON t.from_player_id = fp.id
       JOIN players tp ON t.to_player_id = tp.id
       WHERE (t.from_player_id = $1 OR t.to_player_id = $1)
       AND t.status = 'pending'
       ORDER BY t.created_at DESC`,
      [playerId]
    );

    // Batch fetch all items for all trades (fix N+1 query)
    const tradeIds = tradesResult.rows.map(t => t.id);
    let itemsByTrade: Record<number, any[]> = {};

    if (tradeIds.length > 0) {
      const itemsResult = await pool.query(
        `SELECT ti.trade_id, ti.item_id, ti.direction, i.name, i.type, i.price
         FROM trade_items ti
         JOIN items i ON ti.item_id = i.id
         WHERE ti.trade_id = ANY($1)`,
        [tradeIds]
      );

      // Group items by trade ID
      for (const item of itemsResult.rows) {
        if (!itemsByTrade[item.trade_id]) {
          itemsByTrade[item.trade_id] = [];
        }
        itemsByTrade[item.trade_id].push(item);
      }
    }

    const tradesWithItems = tradesResult.rows.map(trade => {
      const tradeItems = itemsByTrade[trade.id] || [];

      return {
        id: trade.id,
        fromPlayer: {
          id: trade.from_player_id,
          username: trade.from_username,
          level: trade.from_level
        },
        toPlayer: {
          id: trade.to_player_id,
          username: trade.to_username,
          level: trade.to_level
        },
        fromCash: trade.from_cash,
        toCash: trade.to_cash,
        offering: tradeItems
          .filter(i => i.direction === 'offering')
          .map(i => ({ id: i.item_id, name: i.name, type: i.type, price: i.price })),
        requesting: tradeItems
          .filter(i => i.direction === 'requesting')
          .map(i => ({ id: i.item_id, name: i.name, type: i.type, price: i.price })),
        isIncoming: trade.to_player_id === playerId,
        createdAt: trade.created_at,
        expiresAt: trade.expires_at
      };
    });

    res.json({
      success: true,
      data: { trades: tradesWithItems }
    });
  } catch (error) {
    console.error('Get pending trades error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending trades' });
  }
});

// POST /api/trade/create - Create a new trade offer
router.post('/create', validate(createTradeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { targetPlayerId, offeringItems, requestingItems, offeringCash, requestingCash } = req.body;

    if (targetPlayerId === playerId) {
      res.status(400).json({ success: false, error: "Can't trade with yourself" });
      return;
    }

    // Get current player data
    const playerResult = await pool.query(
      `SELECT id, username, current_district, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Verify target exists and is in same district
    const targetResult = await pool.query(
      `SELECT id, username, current_district FROM players WHERE id = $1`,
      [targetPlayerId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const target = targetResult.rows[0];

    if (target.current_district !== player.current_district) {
      res.status(400).json({ success: false, error: 'Must be in same district to trade' });
      return;
    }

    // Validate offering cash
    const cashOffering = offeringCash || 0;
    if (cashOffering < 0) {
      res.status(400).json({ success: false, error: 'Invalid cash amount' });
      return;
    }

    if (cashOffering > player.cash) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Validate player owns offering items
    const offerItemIds = offeringItems || [];
    if (offerItemIds.length > 0) {
      const ownedResult = await pool.query(
        `SELECT item_id FROM player_inventory WHERE player_id = $1 AND item_id = ANY($2)`,
        [playerId, offerItemIds]
      );

      if (ownedResult.rows.length !== offerItemIds.length) {
        res.status(400).json({ success: false, error: "You don't own all offered items" });
        return;
      }
    }

    // Create the trade
    const tradeResult = await pool.query(
      `INSERT INTO trades (from_player_id, to_player_id, from_cash, to_cash)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [playerId, targetPlayerId, cashOffering, requestingCash || 0]
    );

    const tradeId = tradeResult.rows[0].id;

    // Add offering items
    for (const itemId of offerItemIds) {
      await pool.query(
        `INSERT INTO trade_items (trade_id, item_id, direction) VALUES ($1, $2, 'offering')`,
        [tradeId, itemId]
      );
    }

    // Add requesting items
    const requestItemIds = requestingItems || [];
    for (const itemId of requestItemIds) {
      await pool.query(
        `INSERT INTO trade_items (trade_id, item_id, direction) VALUES ($1, $2, 'requesting')`,
        [tradeId, itemId]
      );
    }

    // Notify target player in database
    await pool.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'trade_request', $2, $3)`,
      [
        targetPlayerId,
        `${player.username} sent you a trade offer`,
        JSON.stringify({ tradeId, fromId: playerId, fromUsername: player.username })
      ]
    );

    // WebSocket: Notify target player in real-time with trade event
    sendToUser(targetPlayerId, createEvent<TradeRequestEvent>('trade:request_received', {
      tradeId,
      fromPlayerId: playerId,
      fromUsername: player.username,
      offeringCash: cashOffering,
      requestingCash: requestingCash || 0,
      itemCount: offerItemIds.length + requestItemIds.length
    }));

    // Also send notification for UI toast
    sendToUser(targetPlayerId, createNotification(
      'info',
      'Trade Request',
      `${player.username} sent you a trade offer`
    ));

    res.json({
      success: true,
      data: { tradeId, message: `Trade offer sent to ${target.username}` }
    });
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ success: false, error: 'Failed to create trade' });
  }
});

// POST /api/trade/accept - Accept a trade offer
router.post('/accept', validate(tradeActionSchema), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const playerId = req.player!.id;
    const { tradeId } = req.body;

    await client.query('BEGIN');

    // Get and lock the trade
    const tradeResult = await client.query(
      `SELECT t.*, fp.username as from_username, fp.cash as from_cash_balance,
              tp.username as to_username, tp.cash as to_cash_balance
       FROM trades t
       JOIN players fp ON t.from_player_id = fp.id
       JOIN players tp ON t.to_player_id = tp.id
       WHERE t.id = $1 AND t.to_player_id = $2 AND t.status = 'pending'
       FOR UPDATE`,
      [tradeId, playerId]
    );

    if (tradeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Trade not found or already processed' });
      return;
    }

    const trade = tradeResult.rows[0];

    // Check receiver has enough cash
    if (trade.to_cash > trade.to_cash_balance) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: "You don't have enough cash for this trade" });
      return;
    }

    // Check sender still has enough cash
    if (trade.from_cash > trade.from_cash_balance) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: 'Sender no longer has enough cash' });
      return;
    }

    // Get trade items
    const itemsResult = await client.query(
      `SELECT * FROM trade_items WHERE trade_id = $1`,
      [tradeId]
    );

    // Verify ownership of items
    for (const item of itemsResult.rows) {
      const ownerId = item.direction === 'offering' ? trade.from_player_id : trade.to_player_id;
      const ownershipResult = await client.query(
        `SELECT id FROM player_inventory WHERE player_id = $1 AND item_id = $2`,
        [ownerId, item.item_id]
      );

      if (ownershipResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: 'One or more items are no longer available' });
        return;
      }
    }

    // Execute the trade - transfer cash
    if (trade.from_cash > 0) {
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [trade.from_cash, trade.from_player_id]
      );
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [trade.from_cash, trade.to_player_id]
      );
    }

    if (trade.to_cash > 0) {
      await client.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [trade.to_cash, trade.to_player_id]
      );
      await client.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [trade.to_cash, trade.from_player_id]
      );
    }

    // Transfer items
    for (const item of itemsResult.rows) {
      const fromId = item.direction === 'offering' ? trade.from_player_id : trade.to_player_id;
      const toId = item.direction === 'offering' ? trade.to_player_id : trade.from_player_id;

      // Remove from original owner
      await client.query(
        `DELETE FROM player_inventory WHERE player_id = $1 AND item_id = $2`,
        [fromId, item.item_id]
      );

      // Add to new owner
      await client.query(
        `INSERT INTO player_inventory (player_id, item_id) VALUES ($1, $2)
         ON CONFLICT (player_id, item_id) DO NOTHING`,
        [toId, item.item_id]
      );
    }

    // Update trade status
    await client.query(
      `UPDATE trades SET status = 'accepted' WHERE id = $1`,
      [tradeId]
    );

    // Notify the original sender
    await client.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'trade_accepted', $2, $3)`,
      [
        trade.from_player_id,
        `${trade.to_username} accepted your trade offer`,
        JSON.stringify({ tradeId })
      ]
    );

    await client.query('COMMIT');

    // Get updated balances for WebSocket notifications
    const updatedBalances = await pool.query(
      `SELECT id, cash, bank FROM players WHERE id IN ($1, $2)`,
      [trade.from_player_id, trade.to_player_id]
    );
    const balanceMap = new Map(updatedBalances.rows.map(r => [r.id, r]));

    // WebSocket: Notify both parties of cash changes
    if (trade.from_cash > 0) {
      // Notify receiver they got cash
      notifyTransferReceived(
        trade.to_player_id,
        { id: trade.from_player_id, username: trade.from_username },
        trade.from_cash,
        balanceMap.get(trade.to_player_id)?.cash || 0,
        'Trade completed'
      );
      // Update sender's stats
      notifyStatUpdate(trade.from_player_id, { cash: balanceMap.get(trade.from_player_id)?.cash || 0 });
    }

    if (trade.to_cash > 0) {
      // Notify original sender they got cash from the trade request
      notifyTransferReceived(
        trade.from_player_id,
        { id: trade.to_player_id, username: trade.to_username },
        trade.to_cash,
        balanceMap.get(trade.from_player_id)?.cash || 0,
        'Trade completed'
      );
      // Update receiver's stats
      notifyStatUpdate(trade.to_player_id, { cash: balanceMap.get(trade.to_player_id)?.cash || 0 });
    }

    // Notify original sender that trade was accepted with trade completed event
    const offeringItems = itemsResult.rows.filter(i => i.direction === 'offering');
    const requestingItems = itemsResult.rows.filter(i => i.direction === 'requesting');

    sendToUser(trade.from_player_id, createEvent<TradeCompletedEvent>('trade:completed', {
      tradeId,
      withPlayerId: trade.to_player_id,
      withUsername: trade.to_username,
      cashReceived: trade.to_cash,
      itemsReceived: requestingItems.length
    }));

    sendToUser(trade.to_player_id, createEvent<TradeCompletedEvent>('trade:completed', {
      tradeId,
      withPlayerId: trade.from_player_id,
      withUsername: trade.from_username,
      cashReceived: trade.from_cash,
      itemsReceived: offeringItems.length
    }));

    // Also send notification toast
    sendToUser(trade.from_player_id, createNotification('success', 'Trade Accepted', `${trade.to_username} accepted your trade offer`));

    // Audit log: cash transfers (only for significant amounts)
    if (trade.from_cash > 0) {
      await economyAudit.cashTransfer(req, trade.from_player_id, trade.to_player_id, trade.from_cash);
    }
    if (trade.to_cash > 0) {
      await economyAudit.cashTransfer(req, trade.to_player_id, trade.from_player_id, trade.to_cash);
    }

    res.json({
      success: true,
      data: { message: 'Trade completed successfully' }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept trade error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept trade' });
  } finally {
    client.release();
  }
});

// POST /api/trade/decline - Decline a trade offer
router.post('/decline', validate(tradeActionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { tradeId } = req.body;

    // Update trade status
    const result = await pool.query(
      `UPDATE trades SET status = 'declined'
       WHERE id = $1 AND to_player_id = $2 AND status = 'pending'
       RETURNING from_player_id`,
      [tradeId, playerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trade not found' });
      return;
    }

    // Notify the sender in database
    await pool.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'trade_declined', $2, $3)`,
      [
        result.rows[0].from_player_id,
        `${req.player!.username} declined your trade offer`,
        JSON.stringify({ tradeId })
      ]
    );

    // WebSocket: Notify sender in real-time
    sendToUser(result.rows[0].from_player_id, createNotification(
      'warning',
      'Trade Declined',
      `${req.player!.username} declined your trade offer`
    ));

    res.json({
      success: true,
      data: { message: 'Trade declined' }
    });
  } catch (error) {
    console.error('Decline trade error:', error);
    res.status(500).json({ success: false, error: 'Failed to decline trade' });
  }
});

// POST /api/trade/cancel - Cancel your own trade offer
router.post('/cancel', validate(tradeActionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { tradeId } = req.body;

    const result = await pool.query(
      `UPDATE trades SET status = 'cancelled'
       WHERE id = $1 AND from_player_id = $2 AND status = 'pending'
       RETURNING to_player_id`,
      [tradeId, playerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trade not found' });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Trade cancelled' }
    });
  } catch (error) {
    console.error('Cancel trade error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel trade' });
  }
});

// GET /api/trade/history - Get trade history for the player
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get trade history from archive table or completed/cancelled trades
    const historyResult = await pool.query(
      `SELECT t.id, t.from_player_id, t.to_player_id, t.from_cash, t.to_cash,
              t.status, t.created_at, t.updated_at,
              fp.username as from_username, tp.username as to_username
       FROM trades t
       JOIN players fp ON t.from_player_id = fp.id
       JOIN players tp ON t.to_player_id = tp.id
       WHERE (t.from_player_id = $1 OR t.to_player_id = $2)
       AND t.status IN ('accepted', 'declined', 'cancelled', 'expired')
       ORDER BY t.updated_at DESC
       LIMIT $3 OFFSET $4`,
      [playerId, playerId, limit, offset]
    );

    // Get all trade IDs to batch fetch items
    const tradeIds = historyResult.rows.map(t => t.id);

    let itemsByTrade: Record<number, any[]> = {};
    if (tradeIds.length > 0) {
      const itemsResult = await pool.query(
        `SELECT ti.trade_id, ti.item_id, ti.direction, i.name, i.type
         FROM trade_items ti
         JOIN items i ON ti.item_id = i.id
         WHERE ti.trade_id = ANY($1)`,
        [tradeIds]
      );

      // Group items by trade ID
      for (const item of itemsResult.rows) {
        if (!itemsByTrade[item.trade_id]) {
          itemsByTrade[item.trade_id] = [];
        }
        itemsByTrade[item.trade_id].push(item);
      }
    }

    const history = historyResult.rows.map(trade => {
      const tradeItems = itemsByTrade[trade.id] || [];
      const isOutgoing = trade.from_player_id === playerId;

      return {
        id: trade.id,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        partner: isOutgoing
          ? { id: trade.to_player_id, username: trade.to_username }
          : { id: trade.from_player_id, username: trade.from_username },
        status: trade.status,
        cashSent: isOutgoing ? trade.from_cash : trade.to_cash,
        cashReceived: isOutgoing ? trade.to_cash : trade.from_cash,
        itemsOffered: tradeItems.filter(i => i.direction === 'offering').map(i => ({
          id: i.item_id,
          name: i.name,
          type: i.type
        })),
        itemsRequested: tradeItems.filter(i => i.direction === 'requesting').map(i => ({
          id: i.item_id,
          name: i.name,
          type: i.type
        })),
        createdAt: trade.created_at,
        completedAt: trade.updated_at
      };
    });

    res.json({
      success: true,
      data: {
        history,
        pagination: { limit, offset, hasMore: history.length === limit }
      }
    });
  } catch (error) {
    console.error('Get trade history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get trade history' });
  }
});

// GET /api/trade/players - Get players in same district for trading
router.get('/players', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get current player's district
    const playerResult = await pool.query(
      `SELECT current_district FROM players WHERE id = $1`,
      [playerId]
    );
    const districtId = playerResult.rows[0]?.current_district;

    if (!districtId) {
      res.status(400).json({ success: false, error: 'You must be in a district to trade' });
      return;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const playersResult = await pool.query(
      `SELECT id, username, level, last_seen
       FROM players
       WHERE current_district = $1
       AND id != $2
       AND last_seen > $3
       ORDER BY username`,
      [districtId, playerId, fiveMinutesAgo]
    );

    res.json({
      success: true,
      data: {
        players: playersResult.rows.map(p => ({
          id: p.id,
          username: p.username,
          level: p.level
        }))
      }
    });
  } catch (error) {
    console.error('Get trade players error:', error);
    res.status(500).json({ success: false, error: 'Failed to get players' });
  }
});

export default router;
