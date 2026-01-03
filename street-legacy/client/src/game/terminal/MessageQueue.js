/**
 * MessageQueue - Central message queue for terminal communications
 *
 * Provides:
 * - Priority-based message delivery
 * - Delayed message scheduling
 * - Rate limiting to prevent spam
 * - Organic delivery timing
 */

import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'

// Message priority levels
export const PRIORITY = {
  URGENT: 0,    // Immediate display (system alerts, errors)
  HIGH: 1,      // Soon (opportunity responses, adventure output)
  NORMAL: 2,    // Standard (NPC messages, tips)
  LOW: 3,       // Background (ambient chatter, info)
}

// Message types for formatting
export const MESSAGE_TYPES = {
  SYSTEM: 'system',
  NPC: 'npc',
  SARAH: 'sarah',
  OPPORTUNITY: 'opportunity',
  ADVENTURE: 'adventure',
  PLAYER: 'player',  // For multiplayer
  AMBIENT: 'ambient',
}

class MessageQueueClass {
  constructor() {
    this.queue = []
    this.isProcessing = false
    this.processInterval = null

    // Rate limiting
    this.lastDeliveryTime = 0
    this.minDeliveryGap = 500   // Minimum 500ms between messages
    this.maxMessagesPerMinute = 20

    // Delivery tracking
    this.deliveredThisMinute = 0
    this.minuteResetTime = Date.now()

    // Callbacks
    this.onMessageDelivered = null
    this.onQueueEmpty = null

    this.initialized = false
  }

  /**
   * Initialize the message queue
   */
  initialize() {
    if (this.initialized) return

    // Start processing loop
    this.processInterval = setInterval(() => {
      this.process()
    }, 100)  // Check every 100ms

    // Reset per-minute counter
    setInterval(() => {
      this.deliveredThisMinute = 0
      this.minuteResetTime = Date.now()
    }, 60000)

    this.initialized = true
    console.log('[MessageQueue] Initialized')
  }

  /**
   * Add a message to the queue
   *
   * @param {object} config Message configuration
   * @param {string} config.content - The message text or array of lines
   * @param {string} config.type - Message type (npc, sarah, system, etc.)
   * @param {number} config.priority - Priority level (0-3)
   * @param {number} config.delay - Delay in ms before delivery
   * @param {string} config.sender - Sender name/id
   * @param {object} config.metadata - Additional data
   */
  add(config) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: config.content,
      type: config.type || MESSAGE_TYPES.SYSTEM,
      priority: config.priority ?? PRIORITY.NORMAL,
      sender: config.sender || null,
      metadata: config.metadata || {},
      scheduledTime: Date.now() + (config.delay || 0),
      createdAt: Date.now(),
    }

    // Insert in priority order
    const insertIndex = this.queue.findIndex(
      m => m.priority > message.priority ||
           (m.priority === message.priority && m.scheduledTime > message.scheduledTime)
    )

    if (insertIndex === -1) {
      this.queue.push(message)
    } else {
      this.queue.splice(insertIndex, 0, message)
    }

    console.log(`[MessageQueue] Added message: ${message.id} (priority ${message.priority})`)
    return message.id
  }

  /**
   * Process the queue - deliver due messages
   */
  process() {
    if (!this.initialized) return
    if (this.queue.length === 0) return
    if (this.isProcessing) return

    const now = Date.now()

    // Check rate limiting
    if (now - this.lastDeliveryTime < this.minDeliveryGap) return
    if (this.deliveredThisMinute >= this.maxMessagesPerMinute) return

    // Find the next message that's due
    const nextMessage = this.queue.find(m => m.scheduledTime <= now)
    if (!nextMessage) return

    this.isProcessing = true

    try {
      this.deliverMessage(nextMessage)

      // Remove from queue
      const index = this.queue.indexOf(nextMessage)
      if (index > -1) {
        this.queue.splice(index, 1)
      }

      // Update tracking
      this.lastDeliveryTime = now
      this.deliveredThisMinute++

      // Callback
      if (this.onMessageDelivered) {
        this.onMessageDelivered(nextMessage)
      }

      // Check if queue is empty
      if (this.queue.length === 0 && this.onQueueEmpty) {
        this.onQueueEmpty()
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Deliver a message to the terminal
   */
  deliverMessage(message) {
    if (!terminalManager) return

    const lines = Array.isArray(message.content) ? message.content : [message.content]

    // Determine output type based on message type
    const outputType = this.getOutputType(message.type)

    // Format with sender if present
    lines.forEach((line, index) => {
      let formattedLine = line

      // Add sender prefix for first line only
      if (index === 0 && message.sender) {
        formattedLine = `[${message.sender}] ${line}`
      }

      terminalManager.addOutput(formattedLine, outputType)
    })
  }

  /**
   * Map message type to terminal output type
   */
  getOutputType(messageType) {
    const typeMap = {
      [MESSAGE_TYPES.SYSTEM]: OUTPUT_TYPES.SYSTEM,
      [MESSAGE_TYPES.NPC]: OUTPUT_TYPES.HANDLER,
      [MESSAGE_TYPES.SARAH]: OUTPUT_TYPES.SARAH,
      [MESSAGE_TYPES.OPPORTUNITY]: OUTPUT_TYPES.SYSTEM,
      [MESSAGE_TYPES.ADVENTURE]: OUTPUT_TYPES.RESPONSE,
      [MESSAGE_TYPES.PLAYER]: OUTPUT_TYPES.HANDLER,
      [MESSAGE_TYPES.AMBIENT]: OUTPUT_TYPES.RESPONSE,
    }
    return typeMap[messageType] || OUTPUT_TYPES.RESPONSE
  }

  /**
   * Cancel a pending message by ID
   */
  cancel(messageId) {
    const index = this.queue.findIndex(m => m.id === messageId)
    if (index > -1) {
      this.queue.splice(index, 1)
      console.log(`[MessageQueue] Cancelled message: ${messageId}`)
      return true
    }
    return false
  }

  /**
   * Clear all pending messages
   */
  clear() {
    const count = this.queue.length
    this.queue = []
    console.log(`[MessageQueue] Cleared ${count} messages`)
  }

  /**
   * Get pending messages (for debugging)
   */
  getPending() {
    return [...this.queue]
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      pending: this.queue.length,
      deliveredThisMinute: this.deliveredThisMinute,
      lastDeliveryTime: this.lastDeliveryTime,
      byPriority: {
        urgent: this.queue.filter(m => m.priority === PRIORITY.URGENT).length,
        high: this.queue.filter(m => m.priority === PRIORITY.HIGH).length,
        normal: this.queue.filter(m => m.priority === PRIORITY.NORMAL).length,
        low: this.queue.filter(m => m.priority === PRIORITY.LOW).length,
      }
    }
  }

  /**
   * Shutdown the queue
   */
  shutdown() {
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
    }
    this.queue = []
    this.initialized = false
    console.log('[MessageQueue] Shutdown')
  }
}

// Singleton
export const messageQueue = new MessageQueueClass()
export default messageQueue
