/**
 * Enhanced Chat Routes
 *
 * Multi-channel chat system with moderation, filtering, and real-time updates.
 * Supports global, district, crew, and private channels.
 */

import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import { broadcast, sendToUser, sendToCrew, sendToDistrict } from '../websocket/index.js';
import { createEvent } from '../websocket/events.js';

const router = Router();

// Validation schemas
const sendMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Message is required').max(500, 'Message must be 1-500 characters'),
    channelId: z.string().optional().default('global'),
    replyToId: z.number().int().positive().optional()
  })
});

const getMessagesSchema = z.object({
  query: z.object({
    channel: z.string().optional().default('global'),
    before: z.string().optional(),
    after: z.string().optional(),
    limit: z.string().optional().default('50')
  })
});

const reportMessageSchema = z.object({
  body: z.object({
    reason: z.enum(['spam', 'harassment', 'inappropriate', 'scam', 'other']),
    details: z.string().max(500).optional()
  })
});

// Simple profanity filter (words loaded from DB would be better)
const FILTER_WORDS = ['spam', 'scam'];

function filterMessage(message: string): string {
  let filtered = message;
  for (const word of FILTER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  }
  return filtered;
}

/**
 * Helper: Get unread count for a channel
 */
async function getUnreadCount(playerId: number, channelId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int as unread
       FROM chat_messages cm
       LEFT JOIN chat_read_positions crp ON crp.player_id = $1 AND crp.channel_id = $2
       WHERE cm.channel_id = $2
         AND cm.is_deleted = false
         AND cm.player_id != $1
         AND cm.id > COALESCE(crp.last_read_message_id, 0)`,
      [playerId, channelId]
    );
    return result.rows[0]?.unread || 0;
  } catch {
    return 0; // If table doesn't exist yet, return 0
  }
}

/**
 * GET /api/chat/channels
 * Get available chat channels for the player
 */
router.get('/channels', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info for channel access
    const playerResult = await pool.query(
      `SELECT p.level, p.current_district, cm.crew_id
       FROM players p
       LEFT JOIN crew_members cm ON cm.player_id = p.id AND cm.is_active = true
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all accessible channels
    const channels = [];
    const channelIds: string[] = [];

    // Global channels
    const globalResult = await pool.query(
      `SELECT id, name, description, min_level, type
       FROM chat_channels
       WHERE type IN ('global', 'system')
       ORDER BY id`
    );
    for (const ch of globalResult.rows) {
      if (player.level >= ch.min_level) {
        channelIds.push(ch.id);
        channels.push({
          ...ch,
          accessible: true,
          unread: 0
        });
      }
    }

    // District channel
    if (player.current_district) {
      const districtChannelId = `district:${player.current_district}`;
      channelIds.push(districtChannelId);
      channels.push({
        id: districtChannelId,
        name: 'District Chat',
        description: 'Chat with players in your district',
        type: 'district',
        accessible: true,
        unread: 0
      });
    }

    // Crew channel
    if (player.crew_id) {
      const crewResult = await pool.query(
        `SELECT name FROM crews WHERE id = $1`,
        [player.crew_id]
      );
      if (crewResult.rows[0]) {
        const crewChannelId = `crew:${player.crew_id}`;
        channelIds.push(crewChannelId);
        channels.push({
          id: crewChannelId,
          name: `${crewResult.rows[0].name} Crew`,
          description: 'Private crew chat',
          type: 'crew',
          accessible: true,
          unread: 0
        });
      }
    }

    // Get unread counts for all channels
    const unreadCounts = await Promise.all(
      channelIds.map(id => getUnreadCount(playerId, id))
    );
    channels.forEach((ch, i) => {
      ch.unread = unreadCounts[i];
    });

    res.json({ success: true, data: { channels } });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to get channels' });
  }
});

/**
 * GET /api/chat/messages
 * Get messages for a channel with pagination
 */
router.get('/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const channel = (req.query.channel as string) || 'global';
    const before = req.query.before as string;
    const after = req.query.after as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Verify channel access
    const hasAccess = await verifyChannelAccess(playerId, channel);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'No access to this channel' });
      return;
    }

    // Build query
    let query = `
      SELECT cm.id, cm.message, cm.created_at, cm.reply_to_id, cm.metadata,
             p.id as player_id, p.username, p.level, p.prestige_level,
             crw.tag as crew_tag
      FROM chat_messages cm
      JOIN players p ON cm.player_id = p.id
      LEFT JOIN crew_members crm ON crm.player_id = p.id AND crm.is_active = true
      LEFT JOIN crews crw ON crw.id = crm.crew_id
      WHERE cm.channel_id = $1 AND cm.is_deleted = false
    `;
    const params: any[] = [channel];

    if (before) {
      query += ` AND cm.id < $${params.length + 1}`;
      params.push(parseInt(before));
    }
    if (after) {
      query += ` AND cm.id > $${params.length + 1}`;
      params.push(parseInt(after));
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Format messages (reverse to get chronological order)
    const messages = result.rows.reverse().map(row => ({
      id: row.id,
      message: row.message,
      createdAt: row.created_at,
      replyToId: row.reply_to_id,
      player: {
        id: row.player_id,
        username: row.username,
        level: row.level,
        prestigeLevel: row.prestige_level,
        crewTag: row.crew_tag
      }
    }));

    res.json({
      success: true,
      data: {
        messages,
        channel,
        hasMore: result.rows.length === limit,
        oldestId: messages[0]?.id,
        newestId: messages[messages.length - 1]?.id
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to get messages' });
  }
});

/**
 * POST /api/chat/send
 * Send a message to a channel
 */
router.post('/send', authMiddleware, validate(sendMessageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { message, channelId, replyToId } = req.body;
    const channel = channelId || 'global';

    // Check if player is muted
    const muteResult = await pool.query(
      `SELECT id, expires_at, reason FROM chat_mutes
       WHERE player_id = $1
         AND (channel_id IS NULL OR channel_id = $2)
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [playerId, channel]
    );

    if (muteResult.rows.length > 0) {
      const mute = muteResult.rows[0];
      const expiresText = mute.expires_at
        ? `until ${new Date(mute.expires_at).toLocaleString()}`
        : 'permanently';
      res.status(403).json({
        success: false,
        error: `You are muted ${expiresText}. Reason: ${mute.reason || 'No reason provided'}`
      });
      return;
    }

    // Verify channel access
    const hasAccess = await verifyChannelAccess(playerId, channel);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'No access to this channel' });
      return;
    }

    // Filter message
    const filteredMessage = filterMessage(message.trim());

    // Insert message
    const insertResult = await pool.query(
      `INSERT INTO chat_messages (channel_id, player_id, message, reply_to_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [channel, playerId, filteredMessage, replyToId || null]
    );

    // Get player info for response
    const playerResult = await pool.query(
      `SELECT p.id, p.username, p.level, p.prestige_level, crw.tag as crew_tag
       FROM players p
       LEFT JOIN crew_members crm ON crm.player_id = p.id AND crm.is_active = true
       LEFT JOIN crews crw ON crw.id = crm.crew_id
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    const newMessage = {
      id: insertResult.rows[0].id,
      message: filteredMessage,
      createdAt: insertResult.rows[0].created_at,
      replyToId: replyToId || null,
      channel,
      player: {
        id: player.id,
        username: player.username,
        level: player.level,
        prestigeLevel: player.prestige_level,
        crewTag: player.crew_tag
      }
    };

    res.status(201).json({ success: true, data: newMessage });

    // Broadcast via WebSocket
    const chatEvent = createEvent('chat:message', newMessage);

    if (channel === 'global' || channel === 'trade' || channel === 'help') {
      broadcast(chatEvent);
    } else if (channel.startsWith('crew:')) {
      const crewId = channel.replace('crew:', '');
      sendToCrew(crewId, chatEvent);
    } else if (channel.startsWith('district:')) {
      const districtId = channel.replace('district:', '');
      sendToDistrict(districtId, chatEvent);
    }

    // Cleanup old messages (keep last 500 per channel)
    await pool.query(`
      DELETE FROM chat_messages
      WHERE channel_id = $1 AND id NOT IN (
        SELECT id FROM chat_messages
        WHERE channel_id = $1
        ORDER BY created_at DESC
        LIMIT 500
      )
    `, [channel]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

/**
 * POST /api/chat/messages/:id/report
 * Report a message for moderation
 */
router.post('/messages/:id/report', authMiddleware, validate(reportMessageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const messageId = parseInt(req.params.id);
    const { reason, details } = req.body;

    // Check message exists
    const msgResult = await pool.query(
      `SELECT id, player_id FROM chat_messages WHERE id = $1`,
      [messageId]
    );
    if (msgResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Message not found' });
      return;
    }

    // Can't report own messages
    if (msgResult.rows[0].player_id === playerId) {
      res.status(400).json({ success: false, error: 'Cannot report your own message' });
      return;
    }

    // Create report
    await pool.query(
      `INSERT INTO chat_reports (message_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (message_id, reporter_id) DO UPDATE SET
         reason = EXCLUDED.reason,
         details = EXCLUDED.details,
         created_at = NOW()`,
      [messageId, playerId, reason, details]
    );

    res.json({ success: true, data: { message: 'Report submitted successfully' } });
  } catch (error) {
    console.error('Report message error:', error);
    res.status(500).json({ success: false, error: 'Failed to report message' });
  }
});

/**
 * DELETE /api/chat/messages/:id
 * Delete a message (own message or moderator)
 */
router.delete('/messages/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const messageId = parseInt(req.params.id);

    // Check if player can delete (own message or moderator)
    const playerResult = await pool.query(
      `SELECT is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const isModerator = playerResult.rows[0]?.is_master;

    const msgResult = await pool.query(
      `SELECT player_id FROM chat_messages WHERE id = $1 AND is_deleted = false`,
      [messageId]
    );

    if (msgResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Message not found' });
      return;
    }

    const isOwnMessage = msgResult.rows[0].player_id === playerId;

    if (!isOwnMessage && !isModerator) {
      res.status(403).json({ success: false, error: 'Cannot delete this message' });
      return;
    }

    await pool.query(
      `UPDATE chat_messages SET is_deleted = true, deleted_by = $1 WHERE id = $2`,
      [playerId, messageId]
    );

    res.json({ success: true, data: { message: 'Message deleted' } });

    // Broadcast deletion
    broadcast(createEvent('chat:message_deleted', { messageId }));
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

/**
 * POST /api/chat/mute/:playerId
 * Mute a player (moderator only)
 */
router.post('/mute/:targetId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const targetId = req.params.targetId;
    const { duration, reason, channelId } = req.body;

    // Check if moderator
    const playerResult = await pool.query(
      `SELECT is_master FROM players WHERE id = $1`,
      [playerId]
    );
    if (!playerResult.rows[0]?.is_master) {
      res.status(403).json({ success: false, error: 'Moderator access required' });
      return;
    }

    // Calculate expiry
    let expiresAt = null;
    if (duration) {
      expiresAt = new Date(Date.now() + duration * 60 * 1000); // duration in minutes
    }

    await pool.query(
      `INSERT INTO chat_mutes (player_id, muted_by, channel_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id, channel_id) DO UPDATE SET
         muted_by = EXCLUDED.muted_by,
         reason = EXCLUDED.reason,
         expires_at = EXCLUDED.expires_at,
         created_at = NOW()`,
      [targetId, playerId, channelId || null, reason, expiresAt]
    );

    res.json({ success: true, data: { message: 'Player muted successfully' } });
  } catch (error) {
    console.error('Mute player error:', error);
    res.status(500).json({ success: false, error: 'Failed to mute player' });
  }
});

/**
 * DELETE /api/chat/mute/:playerId
 * Unmute a player (moderator only)
 */
router.delete('/mute/:targetId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const targetId = req.params.targetId;
    const channelId = req.query.channel as string;

    // Check if moderator
    const playerResult = await pool.query(
      `SELECT is_master FROM players WHERE id = $1`,
      [playerId]
    );
    if (!playerResult.rows[0]?.is_master) {
      res.status(403).json({ success: false, error: 'Moderator access required' });
      return;
    }

    await pool.query(
      `DELETE FROM chat_mutes WHERE player_id = $1 AND (channel_id = $2 OR $2 IS NULL)`,
      [targetId, channelId || null]
    );

    res.json({ success: true, data: { message: 'Player unmuted' } });
  } catch (error) {
    console.error('Unmute player error:', error);
    res.status(500).json({ success: false, error: 'Failed to unmute player' });
  }
});

/**
 * POST /api/chat/mark-read
 * Mark messages as read in a channel
 */
router.post('/mark-read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { channelId, messageId } = req.body;

    if (!channelId) {
      res.status(400).json({ success: false, error: 'Channel ID required' });
      return;
    }

    // Verify channel access
    const hasAccess = await verifyChannelAccess(playerId, channelId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'No access to this channel' });
      return;
    }

    // Get latest message ID if not provided
    let latestMessageId = messageId;
    if (!latestMessageId) {
      const result = await pool.query(
        `SELECT MAX(id) as latest FROM chat_messages WHERE channel_id = $1 AND is_deleted = false`,
        [channelId]
      );
      latestMessageId = result.rows[0]?.latest || 0;
    }

    // Upsert read position
    await pool.query(
      `INSERT INTO chat_read_positions (player_id, channel_id, last_read_message_id, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (player_id, channel_id)
       DO UPDATE SET last_read_message_id = GREATEST(chat_read_positions.last_read_message_id, $3),
                     last_read_at = NOW()`,
      [playerId, channelId, latestMessageId]
    );

    res.json({ success: true, data: { channelId, lastReadMessageId: latestMessageId } });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
  }
});

/**
 * GET /api/chat/unread
 * Get unread counts for all accessible channels
 */
router.get('/unread', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info for channel access
    const playerResult = await pool.query(
      `SELECT p.current_district, cm.crew_id
       FROM players p
       LEFT JOIN crew_members cm ON cm.player_id = p.id AND cm.is_active = true
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Build list of accessible channels
    const channelIds = ['global', 'trade', 'help'];
    if (player?.current_district) {
      channelIds.push(`district:${player.current_district}`);
    }
    if (player?.crew_id) {
      channelIds.push(`crew:${player.crew_id}`);
    }

    // Get unread counts
    const unreadCounts = await Promise.all(
      channelIds.map(async (id) => ({
        channelId: id,
        unread: await getUnreadCount(playerId, id)
      }))
    );

    const totalUnread = unreadCounts.reduce((sum, ch) => sum + ch.unread, 0);

    res.json({
      success: true,
      data: {
        channels: unreadCounts,
        totalUnread
      }
    });
  } catch (error) {
    console.error('Get unread error:', error);
    res.status(500).json({ success: false, error: 'Failed to get unread counts' });
  }
});

/**
 * Helper: Verify channel access for a player
 */
async function verifyChannelAccess(playerId: number, channel: string): Promise<boolean> {
  // Global channels are accessible to all
  if (['global', 'trade', 'help', 'system'].includes(channel)) {
    return true;
  }

  // Crew channel
  if (channel.startsWith('crew:')) {
    const crewId = channel.replace('crew:', '');
    const result = await pool.query(
      `SELECT 1 FROM crew_members WHERE player_id = $1 AND crew_id = $2 AND is_active = true`,
      [playerId, crewId]
    );
    return result.rows.length > 0;
  }

  // District channel
  if (channel.startsWith('district:')) {
    const districtId = channel.replace('district:', '');
    const result = await pool.query(
      `SELECT 1 FROM players WHERE id = $1 AND current_district = $2`,
      [playerId, districtId]
    );
    return result.rows.length > 0;
  }

  return false;
}

export default router;
