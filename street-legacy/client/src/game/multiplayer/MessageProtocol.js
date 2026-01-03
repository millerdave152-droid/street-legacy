/**
 * MessageProtocol - Phase 25: Message Protocol Definition
 *
 * Standardized message format for all communication.
 *
 * Used for:
 * - NPC messages
 * - System messages
 * - S.A.R.A.H. messages
 * - Player-to-player messages (future)
 * - Server notifications (future)
 */

// Message types
export const MESSAGE_TYPES = {
  OPPORTUNITY: 'opportunity',
  CHAT: 'chat',
  SYSTEM: 'system',
  NPC: 'npc',
  PLAYER: 'player',
  SARAH: 'sarah',
  NOTIFICATION: 'notification',
  TRADE: 'trade',
  ALLIANCE: 'alliance',
}

// Message priorities
export const MESSAGE_PRIORITY = {
  URGENT: 0,      // Immediate, interrupts
  HIGH: 1,        // Soon as possible
  NORMAL: 2,      // Standard delivery
  LOW: 3,         // Can wait
  BACKGROUND: 4,  // Silent/logged only
}

// Sender/recipient types
export const ENTITY_TYPES = {
  PLAYER: 'player',
  NPC: 'npc',
  SYSTEM: 'system',
  SARAH: 'sarah',
  EXTERNAL_PLAYER: 'external_player',
  SERVER: 'server',
}

// Message status
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  READ: 'read',
  EXPIRED: 'expired',
  FAILED: 'failed',
}

// Action types that can be attached to messages
export const ACTION_TYPES = {
  ACCEPT_DECLINE: 'accept_decline',
  REPLY: 'reply',
  VIEW_DETAILS: 'view_details',
  NAVIGATE: 'navigate',
  CONFIRM: 'confirm',
  TRADE_RESPONSE: 'trade_response',
}

/**
 * Create a message entity reference
 */
export function createEntity(id, name, type) {
  return {
    id,
    name,
    type,
  }
}

/**
 * Create a system entity
 */
export function systemEntity() {
  return createEntity('system', 'SYSTEM', ENTITY_TYPES.SYSTEM)
}

/**
 * Create a S.A.R.A.H. entity
 */
export function sarahEntity() {
  return createEntity('sarah', 'S.A.R.A.H.', ENTITY_TYPES.SARAH)
}

/**
 * Create an NPC entity
 */
export function npcEntity(id, name) {
  return createEntity(id, name, ENTITY_TYPES.NPC)
}

/**
 * Create a player entity
 */
export function playerEntity(id, name) {
  return createEntity(id, name, ENTITY_TYPES.PLAYER)
}

/**
 * Create an action
 */
export function createAction(type, config = {}) {
  return {
    type,
    label: config.label || type,
    command: config.command || null,
    data: config.data || {},
  }
}

/**
 * Create a standardized message
 */
export function createMessage(config) {
  const {
    type = MESSAGE_TYPES.CHAT,
    sender,
    recipient = null,  // null = broadcast to player
    content,
    metadata = {},
    actions = [],
    priority = MESSAGE_PRIORITY.NORMAL,
    expiresAt = null,
    threadId = null,
    replyTo = null,
  } = config

  if (!sender) {
    throw new Error('Message must have a sender')
  }

  if (!content || (!content.text && !content.template)) {
    throw new Error('Message must have content')
  }

  return {
    id: generateMessageId(),
    type,
    sender,
    recipient,
    content: normalizeContent(content),
    metadata,
    actions,
    priority,
    timestamp: Date.now(),
    expiresAt,
    readStatus: MESSAGE_STATUS.PENDING,
    threadId: threadId || generateThreadId(),
    replyTo,
  }
}

/**
 * Generate unique message ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate thread ID
 */
function generateThreadId() {
  return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
}

/**
 * Normalize content to standard format
 */
function normalizeContent(content) {
  if (typeof content === 'string') {
    return { text: content, template: null, data: {} }
  }
  return {
    text: content.text || '',
    template: content.template || null,
    data: content.data || {},
  }
}

/**
 * Create an opportunity message
 */
export function createOpportunityMessage(opportunity, sender) {
  return createMessage({
    type: MESSAGE_TYPES.OPPORTUNITY,
    sender,
    content: {
      text: opportunity.description,
      data: { opportunityId: opportunity.id, reward: opportunity.reward },
    },
    metadata: {
      opportunity: true,
      opportunityId: opportunity.id,
      category: opportunity.category,
    },
    actions: [
      createAction(ACTION_TYPES.ACCEPT_DECLINE, {
        label: 'Respond',
        command: `respond ${opportunity.id}`,
        data: { opportunityId: opportunity.id },
      }),
    ],
    priority: opportunity.urgent ? MESSAGE_PRIORITY.URGENT : MESSAGE_PRIORITY.NORMAL,
    expiresAt: opportunity.expiresAt,
  })
}

/**
 * Create a system notification
 */
export function createSystemMessage(text, priority = MESSAGE_PRIORITY.NORMAL) {
  return createMessage({
    type: MESSAGE_TYPES.SYSTEM,
    sender: systemEntity(),
    content: { text },
    priority,
  })
}

/**
 * Create a S.A.R.A.H. message
 */
export function createSarahMessage(text, metadata = {}) {
  return createMessage({
    type: MESSAGE_TYPES.SARAH,
    sender: sarahEntity(),
    content: { text },
    metadata: { ...metadata, fromSarah: true },
    priority: metadata.urgent ? MESSAGE_PRIORITY.HIGH : MESSAGE_PRIORITY.NORMAL,
  })
}

/**
 * Create an NPC message
 */
export function createNpcMessage(npcId, npcName, text, options = {}) {
  return createMessage({
    type: MESSAGE_TYPES.NPC,
    sender: npcEntity(npcId, npcName),
    content: { text },
    metadata: options.metadata || {},
    actions: options.actions || [],
    priority: options.priority || MESSAGE_PRIORITY.NORMAL,
    expiresAt: options.expiresAt || null,
    threadId: options.threadId || null,
    replyTo: options.replyTo || null,
  })
}

/**
 * Create a trade message (for multiplayer)
 */
export function createTradeMessage(senderId, senderName, trade) {
  return createMessage({
    type: MESSAGE_TYPES.TRADE,
    sender: playerEntity(senderId, senderName),
    content: {
      text: `Trade offer: ${trade.description}`,
      data: { tradeId: trade.id, offering: trade.offering, requesting: trade.requesting },
    },
    metadata: { trade: true, tradeId: trade.id },
    actions: [
      createAction(ACTION_TYPES.TRADE_RESPONSE, {
        label: 'View Trade',
        command: `trade view ${trade.id}`,
        data: { tradeId: trade.id },
      }),
    ],
    priority: MESSAGE_PRIORITY.NORMAL,
    expiresAt: trade.expiresAt,
  })
}

/**
 * Validate message format
 */
export function validateMessage(message) {
  const errors = []

  if (!message.id) errors.push('Missing message ID')
  if (!message.type) errors.push('Missing message type')
  if (!message.sender) errors.push('Missing sender')
  if (!message.content) errors.push('Missing content')
  if (!message.timestamp) errors.push('Missing timestamp')

  if (message.sender && !message.sender.type) {
    errors.push('Sender missing type')
  }

  if (message.recipient && !message.recipient.type) {
    errors.push('Recipient missing type')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Serialize message for storage/transmission
 */
export function serializeMessage(message) {
  return JSON.stringify(message)
}

/**
 * Deserialize message from storage/transmission
 */
export function deserializeMessage(data) {
  const message = typeof data === 'string' ? JSON.parse(data) : data
  const validation = validateMessage(message)
  if (!validation.valid) {
    console.warn('[MessageProtocol] Invalid message:', validation.errors)
  }
  return message
}

/**
 * Check if message is expired
 */
export function isExpired(message) {
  return message.expiresAt && Date.now() > message.expiresAt
}

/**
 * Check if message requires action
 */
export function requiresAction(message) {
  return message.actions && message.actions.length > 0 &&
         message.readStatus !== MESSAGE_STATUS.EXPIRED
}

/**
 * Mark message as read
 */
export function markAsRead(message) {
  return {
    ...message,
    readStatus: MESSAGE_STATUS.READ,
    readAt: Date.now(),
  }
}

/**
 * Mark message as delivered
 */
export function markAsDelivered(message) {
  return {
    ...message,
    readStatus: MESSAGE_STATUS.DELIVERED,
    deliveredAt: Date.now(),
  }
}

export default {
  MESSAGE_TYPES,
  MESSAGE_PRIORITY,
  ENTITY_TYPES,
  MESSAGE_STATUS,
  ACTION_TYPES,
  createMessage,
  createOpportunityMessage,
  createSystemMessage,
  createSarahMessage,
  createNpcMessage,
  createTradeMessage,
  validateMessage,
  serializeMessage,
  deserializeMessage,
  isExpired,
  requiresAction,
  markAsRead,
  markAsDelivered,
}
