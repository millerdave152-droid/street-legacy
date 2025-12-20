/**
 * THE NETWORK - Message Manager
 *
 * Core messaging system for the encrypted criminal communication network.
 * Transforms game events, jobs, and notifications into messages from
 * persistent handler personas.
 */

import { gameManager } from '../GameManager'

// Message types
export const MESSAGE_TYPES = {
  INTEL: 'intel',           // Opportunities, tips, intercepted info
  CONTRACT: 'contract',     // Job offers from handlers
  ALERT: 'alert',          // Heat warnings, police, threats
  CONTACT: 'contact',      // Messages from crew/contacts
  CHANNEL: 'channel',      // Group/faction messages
  SYSTEM: 'system'         // Achievements, level ups, network status
}

// Handler personas - persistent NPCs that send messages
export const HANDLERS = {
  THE_FIXER: {
    id: 'handler_fixer',
    name: 'The Fixer',
    codename: 'FIXER',
    avatar: '[F]',
    role: 'Handler',
    encrypted: true,
    description: 'Your main contact for contracts and opportunities'
  },
  THE_WHISPER: {
    id: 'handler_whisper',
    name: 'The Whisper',
    codename: 'WHISPER',
    avatar: '[W]',
    role: 'Informant',
    encrypted: true,
    description: 'Intel source - tips, opportunities, intercepted comms'
  },
  THE_CLEANER: {
    id: 'handler_cleaner',
    name: 'The Cleaner',
    codename: 'CLEANER',
    avatar: '[C]',
    role: 'Handler',
    encrypted: true,
    description: 'Service and manual labor contracts'
  },
  THE_SHADOW: {
    id: 'handler_shadow',
    name: 'The Shadow',
    codename: 'SHADOW',
    avatar: '[S]',
    role: 'Handler',
    encrypted: true,
    description: 'Criminal contracts - the dark stuff'
  },
  THE_MECHANIC: {
    id: 'handler_mechanic',
    name: 'The Mechanic',
    codename: 'MECH',
    avatar: '[M]',
    role: 'Handler',
    encrypted: true,
    description: 'Skilled labor and technical jobs'
  },
  NETWORK: {
    id: 'system_network',
    name: 'THE NETWORK',
    codename: 'NETWORK',
    avatar: '[N]',
    role: 'System',
    encrypted: true,
    description: 'System alerts, achievements, status updates'
  },
  SCANNER: {
    id: 'system_scanner',
    name: 'SCANNER',
    codename: 'SCANNER',
    avatar: '[!]',
    role: 'System',
    encrypted: false,
    description: 'Police/heat alerts - intercepted communications'
  }
}

// Job category to handler mapping
const JOB_CATEGORY_HANDLERS = {
  manual: HANDLERS.THE_CLEANER,
  service: HANDLERS.THE_CLEANER,
  skilled: HANDLERS.THE_MECHANIC,
  criminal: HANDLERS.THE_SHADOW
}

// Event type to handler mapping
const EVENT_TYPE_HANDLERS = {
  opportunity: HANDLERS.THE_WHISPER,
  threat: HANDLERS.SCANNER,
  bonus: HANDLERS.THE_FIXER,
  police: HANDLERS.SCANNER,
  gang: HANDLERS.THE_WHISPER,
  random: HANDLERS.THE_WHISPER
}

/**
 * Network Message Manager - Singleton
 */
class NetworkMessageManager {
  constructor() {
    this.messages = []
    this.unreadCount = 0
    this.listeners = []
    this.initialized = false
  }

  /**
   * Initialize the message system
   */
  initialize() {
    if (this.initialized) return

    // Load saved messages from localStorage
    this.loadMessages()

    // Generate initial messages if empty
    if (this.messages.length === 0) {
      this.generateWelcomeMessages()
    }

    this.initialized = true
    console.log('[NetworkMessageManager] Initialized with', this.messages.length, 'messages')
  }

  /**
   * Load messages from localStorage
   */
  loadMessages() {
    try {
      const saved = localStorage.getItem('network_messages')
      if (saved) {
        this.messages = JSON.parse(saved)
        this.updateUnreadCount()
      }
    } catch (e) {
      console.error('[NetworkMessageManager] Failed to load messages:', e)
      this.messages = []
    }
  }

  /**
   * Save messages to localStorage
   */
  saveMessages() {
    try {
      localStorage.setItem('network_messages', JSON.stringify(this.messages))
    } catch (e) {
      console.error('[NetworkMessageManager] Failed to save messages:', e)
    }
  }

  /**
   * Generate welcome messages for new players
   */
  generateWelcomeMessages() {
    const now = new Date()

    // Welcome from The Network
    this.addMessage({
      type: MESSAGE_TYPES.SYSTEM,
      from: HANDLERS.NETWORK,
      subject: 'SECURE CONNECTION ESTABLISHED',
      body: 'Welcome to THE NETWORK. Your node is now active and encrypted. All communications on this channel are end-to-end encrypted.\n\nYour contacts will reach out with opportunities. Stay alert. Trust no one outside the network.',
      timestamp: new Date(now.getTime() - 60000).toISOString(),
      read: false,
      starred: true
    })

    // Introduction from The Fixer
    this.addMessage({
      type: MESSAGE_TYPES.CONTRACT,
      from: HANDLERS.THE_FIXER,
      subject: 'First time on the network?',
      body: 'I hear you\'re new around here. Good. Fresh faces are always useful.\n\nI\'m The Fixer. I connect people with opportunities. You want work? I\'ve got work. Check your messages regularly - contracts don\'t last forever.\n\nProve yourself reliable, and the jobs get better. Simple as that.',
      timestamp: new Date(now.getTime() - 30000).toISOString(),
      read: false,
      payload: {
        type: 'intro',
        actions: ['understood']
      }
    })

    // Tip from The Whisper
    this.addMessage({
      type: MESSAGE_TYPES.INTEL,
      from: HANDLERS.THE_WHISPER,
      subject: 'A word of advice...',
      body: 'I deal in information. Tips, opportunities, things people don\'t want known.\n\nKeep your heat low. The cops have their own network - and it\'s not as secure as ours. I\'ll let you know when I hear chatter.\n\nStay sharp.',
      timestamp: now.toISOString(),
      read: false
    })

    this.saveMessages()
  }

  /**
   * Add a new message
   * @param {object} messageData - Message data
   * @returns {object} The created message
   */
  addMessage(messageData) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: messageData.type || MESSAGE_TYPES.SYSTEM,
      from: messageData.from || HANDLERS.NETWORK,
      subject: messageData.subject || 'No subject',
      body: messageData.body || '',
      timestamp: messageData.timestamp || new Date().toISOString(),
      expiresAt: messageData.expiresAt || null,
      read: messageData.read || false,
      starred: messageData.starred || false,
      payload: messageData.payload || null,
      replies: messageData.replies || [],
      thread: messageData.thread || null
    }

    // Add to beginning (newest first)
    this.messages.unshift(message)
    this.updateUnreadCount()
    this.saveMessages()
    this.notifyListeners('new_message', message)

    return message
  }

  /**
   * Convert a game event to a network message
   * @param {object} event - Game event data
   * @returns {object} The created message
   */
  eventToMessage(event) {
    const handler = EVENT_TYPE_HANDLERS[event.type] || HANDLERS.THE_WHISPER

    const subjects = {
      opportunity: 'Opportunity detected',
      threat: 'THREAT ALERT',
      bonus: 'Bonus available',
      police: 'INTERCEPTED: Police chatter',
      gang: 'Faction activity detected',
      random: 'Intel report'
    }

    return this.addMessage({
      type: event.type === 'police' || event.type === 'threat' ? MESSAGE_TYPES.ALERT : MESSAGE_TYPES.INTEL,
      from: handler,
      subject: event.title || subjects[event.type] || 'Intel',
      body: event.description || 'No details available.',
      expiresAt: event.expires_at || null,
      payload: {
        type: 'event',
        data: event,
        actions: event.choices ? event.choices.map(c => c.label) : ['acknowledge']
      }
    })
  }

  /**
   * Convert a job to a contract message
   * @param {object} job - Job data
   * @returns {object} The created message
   */
  jobToMessage(job) {
    const handler = JOB_CATEGORY_HANDLERS[job.category] || HANDLERS.THE_FIXER

    return this.addMessage({
      type: MESSAGE_TYPES.CONTRACT,
      from: handler,
      subject: `Contract: ${job.name}`,
      body: `${job.description}\n\nPay: $${job.base_pay}\nDuration: ${Math.floor(job.duration_seconds / 60)} min\nEnergy required: ${job.energy_cost}`,
      payload: {
        type: 'job',
        data: job,
        actions: ['accept', 'decline']
      }
    })
  }

  /**
   * Create an alert message
   * @param {string} subject - Alert subject
   * @param {string} body - Alert body
   * @param {string} alertType - Type of alert (heat, police, danger)
   */
  createAlert(subject, body, alertType = 'general') {
    const handler = alertType === 'police' ? HANDLERS.SCANNER : HANDLERS.NETWORK

    return this.addMessage({
      type: MESSAGE_TYPES.ALERT,
      from: handler,
      subject: subject.toUpperCase(),
      body: body,
      payload: {
        type: 'alert',
        alertType: alertType,
        actions: ['acknowledge']
      }
    })
  }

  /**
   * Create a system message
   * @param {string} subject - Message subject
   * @param {string} body - Message body
   */
  createSystemMessage(subject, body) {
    return this.addMessage({
      type: MESSAGE_TYPES.SYSTEM,
      from: HANDLERS.NETWORK,
      subject: subject,
      body: body
    })
  }

  /**
   * Mark a message as read
   * @param {string} messageId - Message ID
   */
  markAsRead(messageId) {
    const message = this.messages.find(m => m.id === messageId)
    if (message && !message.read) {
      message.read = true
      this.updateUnreadCount()
      this.saveMessages()
      this.notifyListeners('message_read', message)
    }
  }

  /**
   * Mark all messages as read
   */
  markAllAsRead() {
    this.messages.forEach(m => m.read = true)
    this.updateUnreadCount()
    this.saveMessages()
    this.notifyListeners('all_read')
  }

  /**
   * Toggle starred status
   * @param {string} messageId - Message ID
   */
  toggleStarred(messageId) {
    const message = this.messages.find(m => m.id === messageId)
    if (message) {
      message.starred = !message.starred
      this.saveMessages()
      this.notifyListeners('message_starred', message)
    }
  }

  /**
   * Delete a message
   * @param {string} messageId - Message ID
   */
  deleteMessage(messageId) {
    const index = this.messages.findIndex(m => m.id === messageId)
    if (index !== -1) {
      this.messages.splice(index, 1)
      this.updateUnreadCount()
      this.saveMessages()
      this.notifyListeners('message_deleted', messageId)
    }
  }

  /**
   * Get all messages
   * @param {object} filter - Optional filter (type, read, starred)
   * @returns {array} Filtered messages
   */
  getMessages(filter = {}) {
    let result = [...this.messages]

    // Remove expired messages
    const now = new Date()
    result = result.filter(m => !m.expiresAt || new Date(m.expiresAt) > now)

    // Apply filters
    if (filter.type) {
      result = result.filter(m => m.type === filter.type)
    }
    if (filter.read !== undefined) {
      result = result.filter(m => m.read === filter.read)
    }
    if (filter.starred !== undefined) {
      result = result.filter(m => m.starred === filter.starred)
    }
    if (filter.from) {
      result = result.filter(m => m.from.id === filter.from)
    }

    return result
  }

  /**
   * Get a single message by ID
   * @param {string} messageId - Message ID
   * @returns {object|null} The message or null
   */
  getMessage(messageId) {
    return this.messages.find(m => m.id === messageId) || null
  }

  /**
   * Update unread count
   */
  updateUnreadCount() {
    this.unreadCount = this.messages.filter(m => !m.read).length
  }

  /**
   * Get unread count
   * @returns {number} Number of unread messages
   */
  getUnreadCount() {
    return this.unreadCount
  }

  /**
   * Add a listener for message events
   * @param {function} callback - Callback function
   */
  addListener(callback) {
    this.listeners.push(callback)
  }

  /**
   * Remove a listener
   * @param {function} callback - Callback function
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback)
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event type
   * @param {any} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data)
      } catch (e) {
        console.error('[NetworkMessageManager] Listener error:', e)
      }
    })
  }

  /**
   * Get relative time string
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Relative time (e.g., "2m ago")
   */
  getRelativeTime(timestamp) {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now - then
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return 'now'
    if (diffMin < 60) return `${diffMin}m`
    if (diffHour < 24) return `${diffHour}h`
    if (diffDay < 7) return `${diffDay}d`
    return then.toLocaleDateString()
  }

  /**
   * Get time remaining until expiration
   * @param {string} expiresAt - ISO timestamp
   * @returns {string|null} Time remaining or null if not expiring
   */
  getTimeRemaining(expiresAt) {
    if (!expiresAt) return null

    const now = new Date()
    const expires = new Date(expiresAt)
    const diffMs = expires - now

    if (diffMs <= 0) return 'EXPIRED'

    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)

    if (diffMin < 60) {
      const sec = diffSec % 60
      return `${diffMin}:${sec.toString().padStart(2, '0')}`
    }
    if (diffHour < 24) {
      const min = diffMin % 60
      return `${diffHour}h ${min}m`
    }
    return `${Math.floor(diffHour / 24)}d`
  }

  /**
   * Clear all messages (for testing/reset)
   */
  clearAll() {
    this.messages = []
    this.unreadCount = 0
    this.saveMessages()
    this.notifyListeners('cleared')
  }
}

// Export singleton instance
export const networkMessageManager = new NetworkMessageManager()
export default networkMessageManager
