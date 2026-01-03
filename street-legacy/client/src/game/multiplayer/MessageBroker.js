/**
 * MessageBroker - Phase 26: Sender/Receiver Model
 *
 * Uniform messaging interface for all entities.
 * Handles routing, delivery, and acknowledgment.
 *
 * Interface for all entities:
 * - sendMessage()
 * - receiveMessage()
 * - getInbox()
 * - getOutbox()
 *
 * Entity types: Player, NPC, System, SARAH, ExternalPlayer
 */

import {
  MESSAGE_TYPES,
  MESSAGE_PRIORITY,
  MESSAGE_STATUS,
  ENTITY_TYPES,
  createMessage,
  validateMessage,
  markAsDelivered,
  markAsRead,
  isExpired,
} from './MessageProtocol'

const STORAGE_KEY = 'message_broker_data'

/**
 * MessageEntity - Base class for all message participants
 */
export class MessageEntity {
  constructor(id, name, type) {
    this.id = id
    this.name = name
    this.type = type
    this.inbox = []
    this.outbox = []
    this.handlers = []
  }

  /**
   * Get entity reference
   */
  getReference() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
    }
  }

  /**
   * Send a message
   */
  sendMessage(recipient, content, options = {}) {
    const message = createMessage({
      type: options.type || MESSAGE_TYPES.CHAT,
      sender: this.getReference(),
      recipient,
      content,
      metadata: options.metadata || {},
      actions: options.actions || [],
      priority: options.priority || MESSAGE_PRIORITY.NORMAL,
      expiresAt: options.expiresAt || null,
      threadId: options.threadId || null,
      replyTo: options.replyTo || null,
    })

    this.outbox.push(message)

    // Route through broker
    messageBroker.route(message)

    return message
  }

  /**
   * Receive a message
   */
  receiveMessage(message) {
    message = markAsDelivered(message)
    this.inbox.push(message)

    // Notify handlers
    for (const handler of this.handlers) {
      handler(message)
    }

    return message
  }

  /**
   * Register message handler
   */
  onMessage(handler) {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index !== -1) this.handlers.splice(index, 1)
    }
  }

  /**
   * Get inbox messages
   */
  getInbox(filter = {}) {
    let messages = [...this.inbox]

    if (filter.unreadOnly) {
      messages = messages.filter(m => m.readStatus !== MESSAGE_STATUS.READ)
    }

    if (filter.type) {
      messages = messages.filter(m => m.type === filter.type)
    }

    if (filter.fromEntity) {
      messages = messages.filter(m => m.sender.id === filter.fromEntity)
    }

    if (filter.excludeExpired) {
      messages = messages.filter(m => !isExpired(m))
    }

    return messages
  }

  /**
   * Get outbox messages
   */
  getOutbox(filter = {}) {
    let messages = [...this.outbox]

    if (filter.type) {
      messages = messages.filter(m => m.type === filter.type)
    }

    if (filter.toEntity) {
      messages = messages.filter(m => m.recipient?.id === filter.toEntity)
    }

    return messages
  }

  /**
   * Mark message as read
   */
  markRead(messageId) {
    const message = this.inbox.find(m => m.id === messageId)
    if (message) {
      const updated = markAsRead(message)
      const index = this.inbox.indexOf(message)
      this.inbox[index] = updated
      return updated
    }
    return null
  }

  /**
   * Get unread count
   */
  getUnreadCount() {
    return this.inbox.filter(m =>
      m.readStatus !== MESSAGE_STATUS.READ && !isExpired(m)
    ).length
  }

  /**
   * Get conversation thread
   */
  getThread(threadId) {
    const sent = this.outbox.filter(m => m.threadId === threadId)
    const received = this.inbox.filter(m => m.threadId === threadId)
    return [...sent, ...received].sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Delete message
   */
  deleteMessage(messageId, fromInbox = true) {
    const list = fromInbox ? this.inbox : this.outbox
    const index = list.findIndex(m => m.id === messageId)
    if (index !== -1) {
      list.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear old messages
   */
  clearOld(maxAge = 86400000) {  // 24 hours default
    const cutoff = Date.now() - maxAge
    this.inbox = this.inbox.filter(m => m.timestamp > cutoff)
    this.outbox = this.outbox.filter(m => m.timestamp > cutoff)
  }
}

/**
 * Player entity (the local player)
 */
export class PlayerEntity extends MessageEntity {
  constructor(id = 'player', name = 'You') {
    super(id, name, ENTITY_TYPES.PLAYER)
  }
}

/**
 * NPC entity
 */
export class NPCEntity extends MessageEntity {
  constructor(id, name, config = {}) {
    super(id, name, ENTITY_TYPES.NPC)
    this.responseDelay = config.responseDelay || { min: 2000, max: 10000 }
    this.online = config.online !== false
  }

  /**
   * Calculate response delay (simulates typing/thinking)
   */
  getResponseDelay() {
    return this.responseDelay.min +
           Math.random() * (this.responseDelay.max - this.responseDelay.min)
  }

  /**
   * Set online status
   */
  setOnline(online) {
    this.online = online
  }
}

/**
 * System entity
 */
export class SystemEntity extends MessageEntity {
  constructor() {
    super('system', 'SYSTEM', ENTITY_TYPES.SYSTEM)
  }

  /**
   * Broadcast to all entities
   */
  broadcast(content, options = {}) {
    return this.sendMessage(null, content, {
      ...options,
      type: MESSAGE_TYPES.SYSTEM,
    })
  }
}

/**
 * S.A.R.A.H. entity
 */
export class SarahEntity extends MessageEntity {
  constructor() {
    super('sarah', 'S.A.R.A.H.', ENTITY_TYPES.SARAH)
  }
}

/**
 * External player entity (for multiplayer)
 */
export class ExternalPlayerEntity extends MessageEntity {
  constructor(id, name, config = {}) {
    super(id, name, ENTITY_TYPES.EXTERNAL_PLAYER)
    this.lastSeen = config.lastSeen || null
    this.status = config.status || 'offline'
  }

  setStatus(status) {
    this.status = status
    this.lastSeen = Date.now()
  }
}

/**
 * MessageBroker class - Routes messages between entities
 */
class MessageBrokerClass {
  constructor() {
    this.entities = new Map()
    this.player = null
    this.system = null
    this.sarah = null
    this.messageLog = []
    this.subscribers = []
    this.initialized = false
  }

  /**
   * Initialize the broker
   */
  initialize(playerId = 'player', playerName = 'You') {
    // Create core entities
    this.player = new PlayerEntity(playerId, playerName)
    this.system = new SystemEntity()
    this.sarah = new SarahEntity()

    this.registerEntity(this.player)
    this.registerEntity(this.system)
    this.registerEntity(this.sarah)

    // Load stored messages
    this.load()

    this.initialized = true
    console.log('[MessageBroker] Initialized')
  }

  /**
   * Register an entity
   */
  registerEntity(entity) {
    this.entities.set(entity.id, entity)
    return entity
  }

  /**
   * Create and register an NPC entity
   */
  createNPC(id, name, config = {}) {
    const npc = new NPCEntity(id, name, config)
    return this.registerEntity(npc)
  }

  /**
   * Create and register an external player entity
   */
  createExternalPlayer(id, name, config = {}) {
    const player = new ExternalPlayerEntity(id, name, config)
    return this.registerEntity(player)
  }

  /**
   * Get an entity by ID
   */
  getEntity(id) {
    return this.entities.get(id)
  }

  /**
   * Route a message to recipient
   */
  route(message) {
    // Validate message
    const validation = validateMessage(message)
    if (!validation.valid) {
      console.warn('[MessageBroker] Invalid message:', validation.errors)
      return false
    }

    // Log message
    this.messageLog.push({
      messageId: message.id,
      from: message.sender.id,
      to: message.recipient?.id || 'broadcast',
      type: message.type,
      timestamp: message.timestamp,
    })

    // Route to recipient
    if (message.recipient) {
      const recipient = this.entities.get(message.recipient.id)
      if (recipient) {
        recipient.receiveMessage(message)
      } else {
        // Queue for unknown recipient (might connect later)
        this.queueForUnknownRecipient(message)
      }
    } else {
      // Broadcast to player
      if (this.player) {
        this.player.receiveMessage(message)
      }
    }

    // Notify subscribers
    for (const subscriber of this.subscribers) {
      subscriber(message)
    }

    // Save state
    this.save()

    return true
  }

  /**
   * Queue message for unknown recipient
   */
  queueForUnknownRecipient(message) {
    // For now, just log
    console.log(`[MessageBroker] Queued message for unknown: ${message.recipient?.id}`)
  }

  /**
   * Subscribe to all messages
   */
  subscribe(handler) {
    this.subscribers.push(handler)
    return () => {
      const index = this.subscribers.indexOf(handler)
      if (index !== -1) this.subscribers.splice(index, 1)
    }
  }

  /**
   * Send message from player to entity
   */
  sendToEntity(entityId, content, options = {}) {
    const recipient = this.entities.get(entityId)
    if (!recipient) {
      return { success: false, error: 'Entity not found' }
    }

    const message = this.player.sendMessage(
      recipient.getReference(),
      content,
      options
    )

    return { success: true, message }
  }

  /**
   * Send message from NPC to player
   */
  sendFromNPC(npcId, content, options = {}) {
    const npc = this.entities.get(npcId)
    if (!npc || npc.type !== ENTITY_TYPES.NPC) {
      return { success: false, error: 'NPC not found' }
    }

    const message = npc.sendMessage(
      this.player.getReference(),
      content,
      { ...options, type: MESSAGE_TYPES.NPC }
    )

    return { success: true, message }
  }

  /**
   * Send system message
   */
  sendSystemMessage(content, options = {}) {
    return this.system.broadcast(content, options)
  }

  /**
   * Send S.A.R.A.H. message
   */
  sendSarahMessage(content, options = {}) {
    const message = this.sarah.sendMessage(
      this.player.getReference(),
      content,
      { ...options, type: MESSAGE_TYPES.SARAH }
    )

    return { success: true, message }
  }

  /**
   * Get player's inbox
   */
  getPlayerInbox(filter = {}) {
    return this.player ? this.player.getInbox(filter) : []
  }

  /**
   * Get player's outbox
   */
  getPlayerOutbox(filter = {}) {
    return this.player ? this.player.getOutbox(filter) : []
  }

  /**
   * Get all conversations
   */
  getConversations() {
    if (!this.player) return []

    const threads = new Map()

    for (const message of [...this.player.inbox, ...this.player.outbox]) {
      if (!threads.has(message.threadId)) {
        threads.set(message.threadId, {
          threadId: message.threadId,
          participants: new Set(),
          lastMessage: null,
          messageCount: 0,
          unreadCount: 0,
        })
      }

      const thread = threads.get(message.threadId)
      thread.participants.add(message.sender.id)
      if (message.recipient) thread.participants.add(message.recipient.id)
      thread.messageCount++

      if (!thread.lastMessage || message.timestamp > thread.lastMessage.timestamp) {
        thread.lastMessage = message
      }

      if (message.readStatus !== MESSAGE_STATUS.READ && message.sender.id !== this.player.id) {
        thread.unreadCount++
      }
    }

    return Array.from(threads.values())
      .map(t => ({
        ...t,
        participants: Array.from(t.participants),
      }))
      .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp)
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      entities: this.entities.size,
      totalMessages: this.messageLog.length,
      playerInbox: this.player?.inbox.length || 0,
      playerOutbox: this.player?.outbox.length || 0,
      unreadCount: this.player?.getUnreadCount() || 0,
    }
  }

  /**
   * Save state to localStorage
   */
  save() {
    if (!this.initialized) return

    try {
      const data = {
        playerInbox: this.player?.inbox || [],
        playerOutbox: this.player?.outbox || [],
        messageLog: this.messageLog.slice(-1000),  // Keep last 1000
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[MessageBroker] Failed to save:', e)
    }
  }

  /**
   * Load state from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (this.player) {
          this.player.inbox = data.playerInbox || []
          this.player.outbox = data.playerOutbox || []
        }
        this.messageLog = data.messageLog || []
      }
    } catch (e) {
      console.warn('[MessageBroker] Failed to load:', e)
    }
  }

  /**
   * Clear all messages
   */
  clear() {
    if (this.player) {
      this.player.inbox = []
      this.player.outbox = []
    }
    this.messageLog = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const messageBroker = new MessageBrokerClass()
export default messageBroker
