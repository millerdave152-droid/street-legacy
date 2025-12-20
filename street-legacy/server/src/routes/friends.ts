import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { addFriendSchema, friendRequestActionSchema, searchPlayersSchema } from '../validation/schemas/index.js';
import { z } from 'zod';

// Local schemas for routes not in the shared schemas
const removeFriendSchema = z.object({
  body: z.object({
    friendId: z.number().int().positive()
  })
});

const sendMessageSchema = z.object({
  body: z.object({
    friendId: z.number().int().positive(),
    content: z.string().min(1, 'Message required').max(500, 'Message too long (max 500 chars)')
  })
});

const router = Router();

router.use(authMiddleware);

// GET /api/friends - Get friends list and pending requests
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Execute all 3 queries in parallel for better performance
    const [friendsResult, pendingReceivedResult, pendingSentResult] = await Promise.all([
      // Get accepted friends (both directions)
      pool.query(
        `SELECT
          CASE WHEN f.player_id = $1 THEN f.friend_id ELSE f.player_id END as friend_id,
          p.username, p.level, p.current_district, p.last_seen, p.crew_id,
          c.tag as crew_tag, d.name as district_name,
          f.created_at as friends_since
         FROM friends f
         JOIN players p ON p.id = CASE WHEN f.player_id = $1 THEN f.friend_id ELSE f.player_id END
         LEFT JOIN crews c ON p.crew_id = c.id
         LEFT JOIN districts d ON p.current_district = d.id
         WHERE (f.player_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
         ORDER BY p.last_seen DESC`,
        [playerId]
      ),
      // Get pending requests (received)
      pool.query(
        `SELECT f.id, f.player_id as from_id, p.username, p.level, f.created_at
         FROM friends f
         JOIN players p ON f.player_id = p.id
         WHERE f.friend_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [playerId]
      ),
      // Get pending requests (sent)
      pool.query(
        `SELECT f.id, f.friend_id as to_id, p.username, p.level, f.created_at
         FROM friends f
         JOIN players p ON f.friend_id = p.id
         WHERE f.player_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [playerId]
      )
    ]);

    // Calculate online status (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    res.json({
      success: true,
      data: {
        friends: friendsResult.rows.map(f => ({
          id: f.friend_id,
          username: f.username,
          level: f.level,
          crewTag: f.crew_tag,
          currentDistrict: f.district_name,
          isOnline: new Date(f.last_seen) > fiveMinutesAgo,
          lastSeen: f.last_seen,
          friendsSince: f.friends_since
        })),
        pendingReceived: pendingReceivedResult.rows.map(r => ({
          requestId: r.id,
          fromId: r.from_id,
          username: r.username,
          level: r.level,
          createdAt: r.created_at
        })),
        pendingSent: pendingSentResult.rows.map(r => ({
          requestId: r.id,
          toId: r.to_id,
          username: r.username,
          level: r.level,
          createdAt: r.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ success: false, error: 'Failed to get friends' });
  }
});

// POST /api/friends/add - Send friend request
router.post('/add', validate(addFriendSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { username } = req.body;

    // Find player by username
    const targetResult = await pool.query(
      `SELECT id, username FROM players WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const targetId = targetResult.rows[0].id;

    if (targetId === playerId) {
      res.status(400).json({ success: false, error: "Can't add yourself" });
      return;
    }

    // Check if already friends or pending
    const existingResult = await pool.query(
      `SELECT status FROM friends
       WHERE (player_id = $1 AND friend_id = $2) OR (player_id = $2 AND friend_id = $1)`,
      [playerId, targetId]
    );

    if (existingResult.rows.length > 0) {
      const status = existingResult.rows[0].status;
      if (status === 'accepted') {
        res.status(400).json({ success: false, error: 'Already friends' });
        return;
      }
      if (status === 'pending') {
        res.status(400).json({ success: false, error: 'Request already pending' });
        return;
      }
      if (status === 'blocked') {
        res.status(400).json({ success: false, error: 'Unable to send request' });
        return;
      }
    }

    // Create friend request
    await pool.query(
      `INSERT INTO friends (player_id, friend_id, status) VALUES ($1, $2, 'pending')`,
      [playerId, targetId]
    );

    // Notify target
    await pool.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'friend_request', $2, $3)`,
      [
        targetId,
        `${req.player!.username} sent you a friend request`,
        JSON.stringify({ fromId: playerId, fromUsername: req.player!.username })
      ]
    );

    res.json({
      success: true,
      data: { message: `Friend request sent to ${targetResult.rows[0].username}` }
    });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ success: false, error: 'Failed to send friend request' });
  }
});

// POST /api/friends/accept - Accept friend request
router.post('/accept', validate(friendRequestActionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { requestId } = req.body;

    // Find and verify request
    const requestResult = await pool.query(
      `SELECT f.*, p.username FROM friends f
       JOIN players p ON f.player_id = p.id
       WHERE f.id = $1 AND f.friend_id = $2 AND f.status = 'pending'`,
      [requestId, playerId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    const request = requestResult.rows[0];

    // Accept request
    await pool.query(
      `UPDATE friends SET status = 'accepted' WHERE id = $1`,
      [requestId]
    );

    // Notify the requester
    await pool.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'friend_accepted', $2, $3)`,
      [
        request.player_id,
        `${req.player!.username} accepted your friend request`,
        JSON.stringify({ friendId: playerId, friendUsername: req.player!.username })
      ]
    );

    res.json({
      success: true,
      data: { message: `You are now friends with ${request.username}` }
    });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept request' });
  }
});

// POST /api/friends/decline - Decline friend request
router.post('/decline', validate(friendRequestActionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { requestId } = req.body;

    // Delete the request
    const result = await pool.query(
      `DELETE FROM friends WHERE id = $1 AND friend_id = $2 AND status = 'pending' RETURNING player_id`,
      [requestId, playerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Friend request declined' }
    });
  } catch (error) {
    console.error('Decline friend error:', error);
    res.status(500).json({ success: false, error: 'Failed to decline request' });
  }
});

// POST /api/friends/remove - Remove friend
router.post('/remove', validate(removeFriendSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { friendId } = req.body;

    await pool.query(
      `DELETE FROM friends
       WHERE ((player_id = $1 AND friend_id = $2) OR (player_id = $2 AND friend_id = $1))
       AND status = 'accepted'`,
      [playerId, friendId]
    );

    res.json({
      success: true,
      data: { message: 'Friend removed' }
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove friend' });
  }
});

// GET /api/messages/:friendId - Get messages with a friend
router.get('/messages/:friendId', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const friendId = parseInt(req.params.friendId);

    // Verify friendship
    const friendshipResult = await pool.query(
      `SELECT id FROM friends
       WHERE ((player_id = $1 AND friend_id = $2) OR (player_id = $2 AND friend_id = $1))
       AND status = 'accepted'`,
      [playerId, friendId]
    );

    if (friendshipResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'Not friends with this player' });
      return;
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT dm.*, p.username as from_username
       FROM direct_messages dm
       JOIN players p ON dm.from_id = p.id
       WHERE (dm.from_id = $1 AND dm.to_id = $2) OR (dm.from_id = $2 AND dm.to_id = $1)
       ORDER BY dm.created_at DESC
       LIMIT 100`,
      [playerId, friendId]
    );

    // Mark received messages as read
    await pool.query(
      `UPDATE direct_messages SET read = true WHERE to_id = $1 AND from_id = $2 AND read = false`,
      [playerId, friendId]
    );

    res.json({
      success: true,
      data: {
        messages: messagesResult.rows.reverse().map(m => ({
          id: m.id,
          fromId: m.from_id,
          fromUsername: m.from_username,
          content: m.content,
          read: m.read,
          createdAt: m.created_at,
          isMine: m.from_id === playerId
        }))
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to get messages' });
  }
});

// POST /api/messages/send - Send direct message
router.post('/messages/send', validate(sendMessageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { friendId, content } = req.body;

    // Verify friendship
    const friendshipResult = await pool.query(
      `SELECT id FROM friends
       WHERE ((player_id = $1 AND friend_id = $2) OR (player_id = $2 AND friend_id = $1))
       AND status = 'accepted'`,
      [playerId, friendId]
    );

    if (friendshipResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'Not friends with this player' });
      return;
    }

    // Send message
    const result = await pool.query(
      `INSERT INTO direct_messages (from_id, to_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [playerId, friendId, content.trim()]
    );

    res.json({
      success: true,
      data: {
        message: {
          id: result.rows[0].id,
          fromId: playerId,
          content: content.trim(),
          createdAt: result.rows[0].created_at
        }
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// GET /api/friends/unread - Get unread message counts
router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const unreadResult = await pool.query(
      `SELECT from_id, COUNT(*) as count
       FROM direct_messages
       WHERE to_id = $1 AND read = false
       GROUP BY from_id`,
      [playerId]
    );

    const unreadCounts: Record<number, number> = {};
    let totalUnread = 0;
    for (const row of unreadResult.rows) {
      unreadCounts[row.from_id] = parseInt(row.count);
      totalUnread += parseInt(row.count);
    }

    res.json({
      success: true,
      data: {
        unreadCounts,
        totalUnread
      }
    });
  } catch (error) {
    console.error('Get unread error:', error);
    res.status(500).json({ success: false, error: 'Failed to get unread counts' });
  }
});

export default router;
