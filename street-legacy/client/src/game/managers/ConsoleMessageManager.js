/**
 * ConsoleMessageManager - Central manager for terminal console messages
 *
 * Features:
 * - Message lifecycle (create, read, respond, expire)
 * - Saved intel bookmarking
 * - Unread message tracking
 * - Expiry management
 * - LocalStorage persistence
 */

import {
  MESSAGE_TYPES,
  getMessageType,
  getRandomExpiry,
  formatTimeRemaining,
  isAboutToExpire,
  URGENCY
} from '../terminal/MessageTypes'
import { getContactById } from '../data/NPCContacts'

// Storage keys
const STORAGE_KEYS = {
  MESSAGES: 'street_legacy_console_messages',
  SAVED_INTEL: 'street_legacy_saved_intel',
  READ_MESSAGES: 'street_legacy_read_messages'
}

// Maximum messages to keep
const MAX_MESSAGES = 50
const MAX_SAVED_INTEL = 20

class ConsoleMessageManager {
  constructor() {
    this.messages = new Map()      // Active messages
    this.savedIntel = new Map()    // Bookmarked intel
    this.readMessages = new Set()  // Read message IDs
    this.listeners = new Set()     // Event listeners
    this.expiryCheckInterval = null

    // Load persisted state
    this.loadState()

    // Start expiry checker
    this.startExpiryChecker()
  }

  // ============================================================
  // INITIALIZATION & PERSISTENCE
  // ============================================================

  /**
   * Load messages from localStorage
   */
  loadState() {
    try {
      // Load active messages
      const messagesData = localStorage.getItem(STORAGE_KEYS.MESSAGES)
      if (messagesData) {
        const parsed = JSON.parse(messagesData)
        parsed.forEach(msg => {
          // Only load non-expired messages
          if (!msg.expiresAt || msg.expiresAt > Date.now()) {
            this.messages.set(msg.id, msg)
          }
        })
      }

      // Load saved intel
      const intelData = localStorage.getItem(STORAGE_KEYS.SAVED_INTEL)
      if (intelData) {
        const parsed = JSON.parse(intelData)
        parsed.forEach(intel => this.savedIntel.set(intel.id, intel))
      }

      // Load read message IDs
      const readData = localStorage.getItem(STORAGE_KEYS.READ_MESSAGES)
      if (readData) {
        const parsed = JSON.parse(readData)
        parsed.forEach(id => this.readMessages.add(id))
      }

      console.log(`[ConsoleMessageManager] Loaded ${this.messages.size} messages, ${this.savedIntel.size} saved intel`)
    } catch (e) {
      console.error('[ConsoleMessageManager] Error loading state:', e)
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      // Save messages
      const messagesArray = [...this.messages.values()]
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messagesArray))

      // Save intel
      const intelArray = [...this.savedIntel.values()]
      localStorage.setItem(STORAGE_KEYS.SAVED_INTEL, JSON.stringify(intelArray))

      // Save read IDs (limit to last 100)
      const readArray = [...this.readMessages].slice(-100)
      localStorage.setItem(STORAGE_KEYS.READ_MESSAGES, JSON.stringify(readArray))
    } catch (e) {
      console.error('[ConsoleMessageManager] Error saving state:', e)
    }
  }

  /**
   * Start checking for expired messages
   */
  startExpiryChecker() {
    this.expiryCheckInterval = setInterval(() => {
      this.expireOldMessages()
    }, 30000) // Check every 30 seconds
  }

  /**
   * Stop expiry checker
   */
  shutdown() {
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval)
      this.expiryCheckInterval = null
    }
  }

  // ============================================================
  // MESSAGE CREATION
  // ============================================================

  /**
   * Create a new console message
   * @param {Object} options Message options
   * @returns {Object} The created message
   */
  createMessage(options) {
    const {
      npcId,
      type,
      content,
      offer = null,
      urgency = null,
      customExpiry = null
    } = options

    const contact = getContactById(npcId)
    const messageType = getMessageType(type)

    const message = {
      id: `msg_${npcId}_${Date.now()}`,
      from: {
        id: npcId,
        name: contact?.name || 'Unknown',
        avatar: contact?.avatar || '?',
        prefix: contact?.displayPrefix || '[???]'
      },
      type,
      content,
      timestamp: Date.now(),
      expiresAt: customExpiry || (Date.now() + getRandomExpiry(type)),
      urgency: urgency || messageType?.urgencyDefault || URGENCY.NORMAL,
      offer,
      responded: false,
      savedForLater: false,
      read: false
    }

    // Add to messages
    this.messages.set(message.id, message)

    // Enforce max limit
    this.enforceMessageLimit()

    // Save and notify
    this.saveState()
    this.notifyListeners('new_message', message)

    console.log(`[ConsoleMessageManager] Created message: ${message.id} from ${message.from.name}`)
    return message
  }

  /**
   * Enforce maximum message limit
   */
  enforceMessageLimit() {
    if (this.messages.size <= MAX_MESSAGES) return

    // Remove oldest messages first
    const sorted = [...this.messages.values()].sort((a, b) => a.timestamp - b.timestamp)
    const toRemove = sorted.slice(0, this.messages.size - MAX_MESSAGES)
    toRemove.forEach(msg => this.messages.delete(msg.id))
  }

  // ============================================================
  // MESSAGE RETRIEVAL
  // ============================================================

  /**
   * Get message by ID
   */
  getMessage(id) {
    return this.messages.get(id) || null
  }

  /**
   * Get all active messages
   */
  getAllMessages() {
    return [...this.messages.values()]
      .filter(msg => !msg.expiresAt || msg.expiresAt > Date.now())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get unread messages
   */
  getUnreadMessages() {
    return this.getAllMessages().filter(msg => !msg.read && !this.readMessages.has(msg.id))
  }

  /**
   * Get unread count
   */
  getUnreadCount() {
    return this.getUnreadMessages().length
  }

  /**
   * Get messages from a specific NPC
   */
  getMessagesByNPC(npcId) {
    return this.getAllMessages().filter(msg => msg.from.id === npcId)
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type) {
    return this.getAllMessages().filter(msg => msg.type === type)
  }

  /**
   * Get pending (unresponded) messages
   */
  getPendingMessages() {
    return this.getAllMessages().filter(msg => !msg.responded)
  }

  /**
   * Get urgent messages (about to expire)
   */
  getUrgentMessages() {
    return this.getAllMessages()
      .filter(msg => !msg.responded && msg.expiresAt && isAboutToExpire(msg.expiresAt))
  }

  // ============================================================
  // MESSAGE ACTIONS
  // ============================================================

  /**
   * Mark message as read
   */
  markAsRead(messageId) {
    const message = this.messages.get(messageId)
    if (message) {
      message.read = true
      this.readMessages.add(messageId)
      this.saveState()
      this.notifyListeners('message_read', message)
    }
    return message
  }

  /**
   * Mark all messages as read
   */
  markAllAsRead() {
    this.messages.forEach(msg => {
      msg.read = true
      this.readMessages.add(msg.id)
    })
    this.saveState()
    this.notifyListeners('all_read')
  }

  /**
   * Save message for later (bookmark intel)
   */
  saveForLater(messageId) {
    const message = this.messages.get(messageId)
    if (!message) {
      return { success: false, error: 'Message not found' }
    }

    if (message.type !== 'INTEL') {
      return { success: false, error: 'Only INTEL messages can be saved' }
    }

    message.savedForLater = true

    // Add to saved intel
    const intel = {
      id: message.id,
      from: message.from,
      content: message.content,
      savedAt: Date.now(),
      originalTimestamp: message.timestamp
    }
    this.savedIntel.set(intel.id, intel)

    // Enforce limit
    if (this.savedIntel.size > MAX_SAVED_INTEL) {
      const oldest = [...this.savedIntel.values()]
        .sort((a, b) => a.savedAt - b.savedAt)[0]
      this.savedIntel.delete(oldest.id)
    }

    this.saveState()
    this.notifyListeners('message_saved', message)

    return { success: true, message: `Intel saved. Type 'intel' to view saved intel.` }
  }

  /**
   * Get all saved intel
   */
  getSavedIntel() {
    return [...this.savedIntel.values()].sort((a, b) => b.savedAt - a.savedAt)
  }

  /**
   * Delete saved intel
   */
  deleteSavedIntel(intelId) {
    const deleted = this.savedIntel.delete(intelId)
    if (deleted) {
      this.saveState()
    }
    return deleted
  }

  /**
   * Clear all saved intel
   */
  clearSavedIntel() {
    this.savedIntel.clear()
    this.saveState()
  }

  /**
   * Respond to a message
   */
  respondToMessage(messageId, response) {
    const message = this.messages.get(messageId)
    if (!message) {
      return { success: false, error: 'Message not found or expired' }
    }

    if (message.responded) {
      return { success: false, error: 'Already responded to this message' }
    }

    if (message.expiresAt && message.expiresAt < Date.now()) {
      return { success: false, error: 'This message has expired' }
    }

    message.responded = true
    message.responseTime = Date.now()
    message.response = response

    this.saveState()
    this.notifyListeners('message_responded', { message, response })

    return { success: true, message: message }
  }

  // ============================================================
  // EXPIRY MANAGEMENT
  // ============================================================

  /**
   * Expire old messages
   */
  expireOldMessages() {
    const now = Date.now()
    const expired = []

    this.messages.forEach((msg, id) => {
      if (msg.expiresAt && msg.expiresAt < now && !msg.responded) {
        expired.push(msg)
        this.messages.delete(id)
      }
    })

    if (expired.length > 0) {
      this.saveState()
      expired.forEach(msg => {
        this.notifyListeners('message_expired', msg)
      })
      console.log(`[ConsoleMessageManager] Expired ${expired.length} messages`)
    }

    return expired
  }

  /**
   * Get time remaining for a message
   */
  getTimeRemaining(messageId) {
    const message = this.messages.get(messageId)
    if (!message || !message.expiresAt) return null
    return formatTimeRemaining(message.expiresAt)
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Remove event listener
   */
  removeListener(callback) {
    this.listeners.delete(callback)
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data)
      } catch (e) {
        console.error('[ConsoleMessageManager] Listener error:', e)
      }
    })
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get message statistics
   */
  getStats() {
    const all = this.getAllMessages()
    return {
      total: all.length,
      unread: this.getUnreadCount(),
      pending: this.getPendingMessages().length,
      urgent: this.getUrgentMessages().length,
      savedIntel: this.savedIntel.size,
      byType: {
        INTEL: all.filter(m => m.type === 'INTEL').length,
        DEALS: all.filter(m => m.type === 'DEALS').length,
        JOBS: all.filter(m => m.type === 'JOBS').length,
        SCAMS: all.filter(m => m.type === 'SCAMS').length,
        WARNINGS: all.filter(m => m.type === 'WARNINGS').length,
        BETRAYALS: all.filter(m => m.type === 'BETRAYALS').length
      }
    }
  }

  /**
   * Clear all messages
   */
  clearAll() {
    this.messages.clear()
    this.saveState()
    this.notifyListeners('cleared')
  }
}

// Singleton instance
export const consoleMessageManager = new ConsoleMessageManager()

export default consoleMessageManager
