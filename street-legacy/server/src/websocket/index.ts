/**
 * WebSocket Server
 *
 * Real-time communication for Street Legacy
 * Handles chat, game events, notifications, and presence
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import { logger } from '../utils/logger.js';
import {
  WSEventType,
  ServerEvent,
  ClientMessage,
  ChatMessage,
  createEvent,
  createNotification,
  isValidChannel,
  NotificationEvent,
  StatUpdateEvent,
  TransferReceivedEvent,
  AttackReceivedEvent,
  CrewMemberOnlineEvent,
  CrewMemberOfflineEvent,
  FriendOnlineEvent,
  FriendOfflineEvent,
  TerritoryControlChangedEvent,
  BountyPlacedEvent,
} from './events.js';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
  crewId?: number;
  crewTag?: string;
  districtId?: number;
  isAlive?: boolean;
  channels: Set<string>;
  lastActivity: number;
}

interface PlayerInfo {
  id: number;
  username: string;
  level: number;
  crewId?: number;
  crewTag?: string;
  districtId: number;
}

// ============================================================================
// State Management
// ============================================================================

// Connected clients by userId
const clients = new Map<number, AuthenticatedWebSocket>();

// Channel subscriptions: channel -> Set of userIds
const channelSubscriptions = new Map<string, Set<number>>();

// Track online users by crew
const crewOnlineMembers = new Map<number, Set<number>>();

// Track online users by district
const districtOnlinePlayers = new Map<number, Set<number>>();

// Friends list cache for quick online notifications
const friendsCache = new Map<number, Set<number>>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

// ============================================================================
// Setup
// ============================================================================

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss!.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        logger.info('Terminating dead WebSocket connection', { userId: authWs.userId });
        handleDisconnect(authWs);
        return authWs.terminate();
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  // Broadcast online count periodically
  const presenceInterval = setInterval(() => {
    broadcastOnlineCount();
  }, 60000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(presenceInterval);
  });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    ws.channels = new Set(['global']);
    ws.lastActivity = Date.now();

    // Handle pong responses
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Authenticate via token in query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET!;
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };

      // Get player info from database
      const playerInfo = await getPlayerInfo(decoded.id);
      if (!playerInfo) {
        ws.close(4003, 'Player not found');
        return;
      }

      // Set connection properties
      ws.userId = playerInfo.id;
      ws.username = playerInfo.username;
      ws.crewId = playerInfo.crewId;
      ws.crewTag = playerInfo.crewTag;
      ws.districtId = playerInfo.districtId;

      // Store client connection
      clients.set(playerInfo.id, ws);

      // Add to global channel
      addToChannel('global', playerInfo.id);

      // Add to district channel
      if (playerInfo.districtId) {
        addToChannel(`district:${playerInfo.districtId}`, playerInfo.id);
        trackDistrictPlayer(playerInfo.districtId, playerInfo.id, true);
      }

      // Add to crew channel if in a crew
      if (playerInfo.crewId) {
        addToChannel(`crew:${playerInfo.crewId}`, playerInfo.id);
        await trackCrewMember(playerInfo.crewId, playerInfo.id, true);
      }

      // Load and cache friends list
      await loadFriendsCache(playerInfo.id);
      await notifyFriendsOnline(playerInfo.id, playerInfo.username, true);

      logger.info('WebSocket connected', {
        userId: playerInfo.id,
        username: playerInfo.username,
        crewId: playerInfo.crewId,
      });

      // Send connection confirmation
      const connectedEvent = createEvent('connected', {
        userId: playerInfo.id,
        username: playerInfo.username,
        onlineCount: clients.size,
      });
      ws.send(JSON.stringify(connectedEvent));

      // Send recent chat messages
      const recentMessages = await getRecentMessages('global', 50);
      ws.send(JSON.stringify({
        type: 'chat:history',
        timestamp: Date.now(),
        channel: 'global',
        messages: recentMessages,
      }));

    } catch (error) {
      logger.error('WebSocket authentication failed', error as Error);
      ws.close(4002, 'Invalid token');
      return;
    }

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        ws.lastActivity = Date.now();
        const message: ClientMessage = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        logger.error('WebSocket message error', error as Error);
        sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
      }
    });

    // Handle disconnection
    ws.on('close', () => handleDisconnect(ws));

    ws.on('error', (error) => {
      logger.error('WebSocket error', error, { userId: ws.userId });
    });
  });

  logger.info('WebSocket server started');
  return wss;
}

// ============================================================================
// Message Handling
// ============================================================================

async function handleMessage(ws: AuthenticatedWebSocket, message: ClientMessage) {
  if (!ws.userId || !ws.username) return;

  switch (message.type) {
    case 'chat':
      if ('message' in message && 'channel' in message) {
        await handleChatMessage(ws, message.channel, message.message);
      }
      break;

    case 'subscribe':
      if ('channel' in message) {
        handleSubscribe(ws, message.channel);
      }
      break;

    case 'unsubscribe':
      if ('channel' in message) {
        handleUnsubscribe(ws, message.channel);
      }
      break;

    case 'typing':
      if ('channel' in message) {
        broadcastToChannel(message.channel, {
          type: 'chat:typing',
          timestamp: Date.now(),
          channel: message.channel,
          userId: ws.userId,
          username: ws.username,
        }, ws.userId);
      }
      break;

    case 'presence:request':
      if ('districtId' in message && message.districtId) {
        await sendDistrictPlayers(ws, message.districtId);
      }
      break;

    default:
      sendError(ws, 'UNKNOWN_TYPE', 'Unknown message type');
  }
}

async function handleChatMessage(ws: AuthenticatedWebSocket, channel: string, content: string) {
  if (!ws.userId || !ws.username) return;

  const trimmedContent = content.trim().slice(0, 500);
  if (!trimmedContent) return;

  // Validate channel access
  if (!canAccessChannel(ws, channel)) {
    sendError(ws, 'ACCESS_DENIED', 'You cannot send messages to this channel');
    return;
  }

  try {
    // Get player level and crew info
    const playerInfo = await getPlayerInfo(ws.userId);

    // Save to database
    const result = await pool.query(
      `INSERT INTO chat_messages (player_id, channel, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, created_at`,
      [ws.userId, channel, trimmedContent]
    );

    const chatMessage: ChatMessage = {
      id: result.rows[0].id,
      message: trimmedContent,
      createdAt: result.rows[0].created_at,
      player: {
        id: ws.userId,
        username: ws.username,
        level: playerInfo?.level || 1,
        crewTag: ws.crewTag,
      },
    };

    // Broadcast to channel
    broadcastToChannel(channel, {
      type: 'chat',
      timestamp: Date.now(),
      channel,
      message: chatMessage,
    });

    logger.game.action(ws.userId, 'chat_message', { channel, messageId: result.rows[0].id });

  } catch (error) {
    logger.error('Failed to save chat message', error as Error);
    sendError(ws, 'SEND_FAILED', 'Failed to send message');
  }
}

function handleSubscribe(ws: AuthenticatedWebSocket, channel: string) {
  if (!ws.userId) return;

  if (!canAccessChannel(ws, channel)) {
    sendError(ws, 'ACCESS_DENIED', `Cannot subscribe to channel: ${channel}`);
    return;
  }

  addToChannel(channel, ws.userId);
  ws.channels.add(channel);

  ws.send(JSON.stringify({
    type: 'chat:subscribed',
    timestamp: Date.now(),
    channel,
  }));
}

function handleUnsubscribe(ws: AuthenticatedWebSocket, channel: string) {
  if (!ws.userId || channel === 'global') return;

  removeFromChannel(channel, ws.userId);
  ws.channels.delete(channel);

  ws.send(JSON.stringify({
    type: 'chat:unsubscribed',
    timestamp: Date.now(),
    channel,
  }));
}

// ============================================================================
// Disconnection Handling
// ============================================================================

async function handleDisconnect(ws: AuthenticatedWebSocket) {
  if (!ws.userId) return;

  const userId = ws.userId;
  const crewId = ws.crewId;
  const districtId = ws.districtId;
  const username = ws.username || 'Unknown';

  // Remove from clients
  clients.delete(userId);

  // Remove from all channels
  for (const channel of ws.channels) {
    removeFromChannel(channel, userId);
  }

  // Update district tracking
  if (districtId) {
    trackDistrictPlayer(districtId, userId, false);
  }

  // Update crew tracking and notify
  if (crewId) {
    await trackCrewMember(crewId, userId, false);
  }

  // Notify friends
  await notifyFriendsOnline(userId, username, false);

  // Clean up friends cache
  friendsCache.delete(userId);

  logger.info('WebSocket disconnected', { userId });
}

// ============================================================================
// Channel Management
// ============================================================================

function addToChannel(channel: string, userId: number) {
  if (!channelSubscriptions.has(channel)) {
    channelSubscriptions.set(channel, new Set());
  }
  channelSubscriptions.get(channel)!.add(userId);
}

function removeFromChannel(channel: string, userId: number) {
  channelSubscriptions.get(channel)?.delete(userId);
}

function canAccessChannel(ws: AuthenticatedWebSocket, channel: string): boolean {
  // Everyone can access global, trade, help
  if (['global', 'trade', 'help'].includes(channel)) {
    return true;
  }

  // Crew channel requires being in that crew
  if (channel.startsWith('crew:')) {
    const crewId = parseInt(channel.split(':')[1]);
    return ws.crewId === crewId;
  }

  // District channel requires being in that district
  if (channel.startsWith('district:')) {
    const districtId = parseInt(channel.split(':')[1]);
    return ws.districtId === districtId;
  }

  return false;
}

// ============================================================================
// Broadcasting Functions
// ============================================================================

function broadcastToChannel(channel: string, event: any, excludeUserId?: number) {
  const subscribers = channelSubscriptions.get(channel);
  if (!subscribers) return;

  const payload = JSON.stringify(event);

  for (const userId of subscribers) {
    if (userId === excludeUserId) continue;

    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastOnlineCount() {
  const count = clients.size;
  const byDistrict: Record<number, number> = {};

  for (const [districtId, players] of districtOnlinePlayers) {
    byDistrict[districtId] = players.size;
  }

  broadcastToChannel('global', {
    type: 'presence:online_count',
    timestamp: Date.now(),
    count,
    byDistrict,
  });
}

// ============================================================================
// Presence Tracking
// ============================================================================

function trackDistrictPlayer(districtId: number, userId: number, online: boolean) {
  if (!districtOnlinePlayers.has(districtId)) {
    districtOnlinePlayers.set(districtId, new Set());
  }

  if (online) {
    districtOnlinePlayers.get(districtId)!.add(userId);
  } else {
    districtOnlinePlayers.get(districtId)!.delete(userId);
  }
}

async function trackCrewMember(crewId: number, userId: number, online: boolean) {
  if (!crewOnlineMembers.has(crewId)) {
    crewOnlineMembers.set(crewId, new Set());
  }

  const crewChannel = `crew:${crewId}`;
  const client = clients.get(userId);
  const username = client?.username || 'Unknown';

  if (online) {
    crewOnlineMembers.get(crewId)!.add(userId);

    // Notify crew members
    broadcastToChannel(crewChannel, createEvent<CrewMemberOnlineEvent>('crew:member_online', {
      crewId,
      member: { id: userId, username },
      onlineCount: crewOnlineMembers.get(crewId)!.size,
    }), userId);
  } else {
    crewOnlineMembers.get(crewId)!.delete(userId);

    // Notify crew members
    broadcastToChannel(crewChannel, createEvent<CrewMemberOfflineEvent>('crew:member_offline', {
      crewId,
      member: { id: userId, username },
      onlineCount: crewOnlineMembers.get(crewId)!.size,
    }));
  }
}

async function loadFriendsCache(userId: number) {
  try {
    const result = await pool.query(
      `SELECT friend_id FROM friends WHERE player_id = $1 AND status = 'accepted'
       UNION
       SELECT player_id FROM friends WHERE friend_id = $1 AND status = 'accepted'`,
      [userId]
    );

    const friendIds = new Set(result.rows.map(r => r.friend_id || r.player_id));
    friendsCache.set(userId, friendIds);
  } catch (error) {
    logger.error('Failed to load friends cache', error as Error);
    friendsCache.set(userId, new Set());
  }
}

async function notifyFriendsOnline(userId: number, username: string, online: boolean) {
  const friends = friendsCache.get(userId);
  if (!friends || friends.size === 0) return;

  const event = online
    ? createEvent<FriendOnlineEvent>('social:friend_online', {
        friend: { id: userId, username },
      })
    : createEvent<FriendOfflineEvent>('social:friend_offline', {
        friend: { id: userId, username },
      });

  const payload = JSON.stringify(event);

  for (const friendId of friends) {
    const friendClient = clients.get(friendId);
    if (friendClient && friendClient.readyState === WebSocket.OPEN) {
      friendClient.send(payload);
    }
  }
}

async function sendDistrictPlayers(ws: AuthenticatedWebSocket, districtId: number) {
  const playerIds = districtOnlinePlayers.get(districtId);
  if (!playerIds || playerIds.size === 0) {
    ws.send(JSON.stringify({
      type: 'presence:district_players',
      timestamp: Date.now(),
      districtId,
      players: [],
    }));
    return;
  }

  try {
    const result = await pool.query(
      `SELECT p.id, p.username, p.level, c.tag as "crewTag"
       FROM players p
       LEFT JOIN crews c ON p.crew_id = c.id
       WHERE p.id = ANY($1)`,
      [Array.from(playerIds)]
    );

    ws.send(JSON.stringify({
      type: 'presence:district_players',
      timestamp: Date.now(),
      districtId,
      players: result.rows,
    }));
  } catch (error) {
    logger.error('Failed to get district players', error as Error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function sendError(ws: AuthenticatedWebSocket, code: string, message: string) {
  ws.send(JSON.stringify({
    type: 'error',
    timestamp: Date.now(),
    code,
    message,
  }));
}

async function getPlayerInfo(userId: number): Promise<PlayerInfo | null> {
  try {
    const result = await pool.query(
      `SELECT p.id, p.username, p.level, p.crew_id as "crewId",
              p.current_district as "districtId", c.tag as "crewTag"
       FROM players p
       LEFT JOIN crews c ON p.crew_id = c.id
       WHERE p.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get player info', error as Error);
    return null;
  }
}

async function getRecentMessages(channel: string, limit: number = 50): Promise<ChatMessage[]> {
  try {
    const result = await pool.query(
      `SELECT cm.id, cm.message, cm.created_at as "createdAt",
              p.id as "playerId", p.username, p.level, c.tag as "crewTag"
       FROM chat_messages cm
       JOIN players p ON cm.player_id = p.id
       LEFT JOIN crews c ON p.crew_id = c.id
       WHERE cm.channel = $1
       ORDER BY cm.created_at DESC
       LIMIT $2`,
      [channel, limit]
    );

    return result.rows.reverse().map(row => ({
      id: row.id,
      message: row.message,
      createdAt: row.createdAt,
      player: {
        id: row.playerId,
        username: row.username,
        level: row.level,
        crewTag: row.crewTag,
      },
    }));
  } catch (error) {
    logger.error('Failed to get recent messages', error as Error);
    return [];
  }
}

// ============================================================================
// Exported Functions for Route Integration
// ============================================================================

/**
 * Send a message to a specific user
 */
export function sendToUser(userId: number, event: ServerEvent | object) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    const payload = 'timestamp' in event ? event : { ...event, timestamp: Date.now() };
    client.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

/**
 * Send to multiple users
 */
export function sendToUsers(userIds: number[], event: ServerEvent | object) {
  const payload = JSON.stringify('timestamp' in event ? event : { ...event, timestamp: Date.now() });
  let sent = 0;

  for (const userId of userIds) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  }

  return sent;
}

/**
 * Broadcast a notification to all online users
 */
export function broadcastNotification(notification: Omit<NotificationEvent, 'type' | 'timestamp'>) {
  const event = createNotification(
    notification.category,
    notification.title,
    notification.message,
    { link: notification.link, persistent: notification.persistent }
  );
  broadcastToChannel('global', event);
}

/**
 * Broadcast a system notification
 */
export function broadcastSystemNotification(message: string, level: 'info' | 'warning' | 'critical' = 'info') {
  broadcastToChannel('global', {
    type: 'notification:system',
    timestamp: Date.now(),
    message,
    level,
  });
}

/**
 * Notify a user of a stat update
 */
export function notifyStatUpdate(userId: number, stats: StatUpdateEvent['stats']) {
  sendToUser(userId, createEvent<StatUpdateEvent>('game:stat_update', { stats }));
}

/**
 * Notify a user of a transfer received
 */
export function notifyTransferReceived(
  recipientId: number,
  fromPlayer: { id: number; username: string },
  amount: number,
  newBankBalance: number,
  note?: string
) {
  sendToUser(recipientId, createEvent<TransferReceivedEvent>('economy:transfer_received', {
    fromPlayer,
    amount,
    newBankBalance,
    note,
  }));
}

/**
 * Notify a user they've been attacked
 */
export function notifyAttackReceived(
  victimId: number,
  attacker: { id: number; username: string; level: number; crewTag?: string },
  damage: number,
  healthRemaining: number,
  cashLost?: number
) {
  sendToUser(victimId, createEvent<AttackReceivedEvent>('pvp:attack_received', {
    attacker,
    damage,
    healthRemaining,
    cashLost,
  }));
}

/**
 * Broadcast territory control change
 */
export function broadcastTerritoryChange(
  districtId: number,
  districtName: string,
  newController?: { crewId: number; crewName: string; crewTag: string },
  previousController?: { crewId: number; crewName: string; crewTag: string }
) {
  broadcastToChannel('global', createEvent<TerritoryControlChangedEvent>('territory:control_changed', {
    districtId,
    districtName,
    newController,
    previousController,
  }));
}

/**
 * Notify about a bounty being placed
 */
export function notifyBountyPlaced(
  targetId: number,
  targetUsername: string,
  amount: number,
  totalBounty: number,
  placedBy?: string
) {
  // Notify the target
  sendToUser(targetId, createEvent<BountyPlacedEvent>('pvp:bounty_placed', {
    targetId,
    targetUsername,
    amount,
    totalBounty,
    placedBy,
  }));

  // Broadcast to global (for bounty hunters)
  broadcastToChannel('global', createEvent<BountyPlacedEvent>('pvp:bounty_placed', {
    targetId,
    targetUsername,
    amount,
    totalBounty,
    // Don't include placedBy in public broadcast for anonymity
  }));
}

/**
 * Notify crew members
 */
export function notifyCrewMembers(crewId: number, event: ServerEvent | object) {
  const channel = `crew:${crewId}`;
  const payload = JSON.stringify('timestamp' in event ? event : { ...event, timestamp: Date.now() });

  const subscribers = channelSubscriptions.get(channel);
  if (!subscribers) return 0;

  let sent = 0;
  for (const userId of subscribers) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  }
  return sent;
}

/**
 * Broadcast to all connected users
 */
export function broadcast(event: ServerEvent | object) {
  const payload = JSON.stringify('timestamp' in event ? event : { ...event, timestamp: Date.now() });

  for (const client of clients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

/**
 * Send to all members of a crew
 */
export function sendToCrew(crewId: string | number, event: ServerEvent | object) {
  const channel = `crew:${crewId}`;
  const payload = JSON.stringify('timestamp' in event ? event : { ...event, timestamp: Date.now() });

  const subscribers = channelSubscriptions.get(channel);
  if (!subscribers) return 0;

  let sent = 0;
  for (const userId of subscribers) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  }
  return sent;
}

/**
 * Send to all players in a district
 */
export function sendToDistrict(districtId: string | number, event: ServerEvent | object) {
  const channel = `district:${districtId}`;
  const payload = JSON.stringify('timestamp' in event ? event : { ...event, timestamp: Date.now() });

  const subscribers = channelSubscriptions.get(channel);
  if (!subscribers) return 0;

  let sent = 0;
  for (const userId of subscribers) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  }
  return sent;
}

/**
 * Update a user's district (for travel)
 */
export function updateUserDistrict(userId: number, newDistrictId: number) {
  const client = clients.get(userId);
  if (!client) return;

  const oldDistrictId = client.districtId;

  // Remove from old district
  if (oldDistrictId) {
    trackDistrictPlayer(oldDistrictId, userId, false);
    removeFromChannel(`district:${oldDistrictId}`, userId);
    client.channels.delete(`district:${oldDistrictId}`);
  }

  // Add to new district
  client.districtId = newDistrictId;
  trackDistrictPlayer(newDistrictId, userId, true);
  addToChannel(`district:${newDistrictId}`, userId);
  client.channels.add(`district:${newDistrictId}`);
}

/**
 * Update a user's crew (for join/leave)
 */
export async function updateUserCrew(userId: number, newCrewId: number | null, newCrewTag?: string) {
  const client = clients.get(userId);
  if (!client) return;

  const oldCrewId = client.crewId;

  // Remove from old crew
  if (oldCrewId) {
    await trackCrewMember(oldCrewId, userId, false);
    removeFromChannel(`crew:${oldCrewId}`, userId);
    client.channels.delete(`crew:${oldCrewId}`);
  }

  // Add to new crew
  if (newCrewId) {
    client.crewId = newCrewId;
    client.crewTag = newCrewTag;
    await trackCrewMember(newCrewId, userId, true);
    addToChannel(`crew:${newCrewId}`, userId);
    client.channels.add(`crew:${newCrewId}`);
  } else {
    client.crewId = undefined;
    client.crewTag = undefined;
  }
}

/**
 * Get list of online user IDs
 */
export function getOnlineUsers(): number[] {
  return Array.from(clients.keys());
}

/**
 * Check if a user is online
 */
export function isUserOnline(userId: number): boolean {
  const client = clients.get(userId);
  return client?.readyState === WebSocket.OPEN;
}

/**
 * Get online count
 */
export function getOnlineCount(): number {
  return clients.size;
}

/**
 * Get crew online members
 */
export function getCrewOnlineMembers(crewId: number): number[] {
  return Array.from(crewOnlineMembers.get(crewId) || []);
}

/**
 * Get district online players
 */
export function getDistrictOnlinePlayers(districtId: number): number[] {
  return Array.from(districtOnlinePlayers.get(districtId) || []);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  setupWebSocket,
  sendToUser,
  sendToUsers,
  broadcast,
  sendToCrew,
  sendToDistrict,
  broadcastNotification,
  broadcastSystemNotification,
  notifyStatUpdate,
  notifyTransferReceived,
  notifyAttackReceived,
  broadcastTerritoryChange,
  notifyBountyPlaced,
  notifyCrewMembers,
  updateUserDistrict,
  updateUserCrew,
  getOnlineUsers,
  isUserOnline,
  getOnlineCount,
  getCrewOnlineMembers,
  getDistrictOnlinePlayers,
};
