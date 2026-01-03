/**
 * Inbox - Phase 27: Inbox/Outbox System
 *
 * Persistent message storage with UI integration.
 *
 * Features:
 * - Categories: All, NPC, System, Players, Unread
 * - Thread view for conversations
 * - Actions: Read, Reply, Delete, Archive
 * - Terminal command: inbox
 */

import { messageBroker } from './MessageBroker'
import {
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  isExpired,
  requiresAction,
} from './MessageProtocol'

// Inbox categories
export const INBOX_CATEGORIES = {
  ALL: 'all',
  NPC: 'npc',
  SYSTEM: 'system',
  PLAYERS: 'players',
  UNREAD: 'unread',
  OPPORTUNITIES: 'opportunities',
  ARCHIVED: 'archived',
}

// Sort options
export const SORT_OPTIONS = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  PRIORITY: 'priority',
  SENDER: 'sender',
}

/**
 * Inbox class
 */
class InboxClass {
  constructor() {
    this.archivedIds = new Set()
    this.deletedIds = new Set()
    this.currentCategory = INBOX_CATEGORIES.ALL
    this.currentSort = SORT_OPTIONS.NEWEST
    this.listeners = []
  }

  /**
   * Initialize inbox
   */
  initialize() {
    // Load archived/deleted from storage
    this.loadState()

    // Listen for new messages
    messageBroker.subscribe((message) => {
      this.notifyListeners('new_message', message)
    })

    console.log('[Inbox] Initialized')
  }

  /**
   * Get messages by category
   */
  getMessages(category = INBOX_CATEGORIES.ALL, options = {}) {
    const player = messageBroker.player
    if (!player) return []

    let messages = player.getInbox({ excludeExpired: true })

    // Filter out deleted
    messages = messages.filter(m => !this.deletedIds.has(m.id))

    // Apply category filter
    switch (category) {
      case INBOX_CATEGORIES.NPC:
        messages = messages.filter(m => m.type === MESSAGE_TYPES.NPC)
        break
      case INBOX_CATEGORIES.SYSTEM:
        messages = messages.filter(m =>
          m.type === MESSAGE_TYPES.SYSTEM || m.type === MESSAGE_TYPES.SARAH
        )
        break
      case INBOX_CATEGORIES.PLAYERS:
        messages = messages.filter(m => m.type === MESSAGE_TYPES.PLAYER)
        break
      case INBOX_CATEGORIES.UNREAD:
        messages = messages.filter(m => m.readStatus !== MESSAGE_STATUS.READ)
        break
      case INBOX_CATEGORIES.OPPORTUNITIES:
        messages = messages.filter(m => m.type === MESSAGE_TYPES.OPPORTUNITY)
        break
      case INBOX_CATEGORIES.ARCHIVED:
        messages = messages.filter(m => this.archivedIds.has(m.id))
        break
      case INBOX_CATEGORIES.ALL:
      default:
        messages = messages.filter(m => !this.archivedIds.has(m.id))
    }

    // Apply sorting
    const sortFn = this.getSortFunction(options.sort || this.currentSort)
    messages.sort(sortFn)

    // Apply limit
    if (options.limit) {
      messages = messages.slice(0, options.limit)
    }

    return messages
  }

  /**
   * Get sort function
   */
  getSortFunction(sortOption) {
    switch (sortOption) {
      case SORT_OPTIONS.OLDEST:
        return (a, b) => a.timestamp - b.timestamp
      case SORT_OPTIONS.PRIORITY:
        return (a, b) => a.priority - b.priority || b.timestamp - a.timestamp
      case SORT_OPTIONS.SENDER:
        return (a, b) => a.sender.name.localeCompare(b.sender.name)
      case SORT_OPTIONS.NEWEST:
      default:
        return (a, b) => b.timestamp - a.timestamp
    }
  }

  /**
   * Get message by ID
   */
  getMessage(messageId) {
    const player = messageBroker.player
    if (!player) return null

    return player.inbox.find(m => m.id === messageId)
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId) {
    const player = messageBroker.player
    if (!player) return false

    const result = player.markRead(messageId)
    if (result) {
      messageBroker.save()
      this.notifyListeners('message_read', result)
    }
    return !!result
  }

  /**
   * Mark all as read
   */
  markAllAsRead(category = INBOX_CATEGORIES.ALL) {
    const messages = this.getMessages(category)
    let count = 0

    for (const message of messages) {
      if (message.readStatus !== MESSAGE_STATUS.READ) {
        this.markAsRead(message.id)
        count++
      }
    }

    return count
  }

  /**
   * Archive a message
   */
  archive(messageId) {
    this.archivedIds.add(messageId)
    this.saveState()
    this.notifyListeners('message_archived', { messageId })
    return true
  }

  /**
   * Unarchive a message
   */
  unarchive(messageId) {
    this.archivedIds.delete(messageId)
    this.saveState()
    this.notifyListeners('message_unarchived', { messageId })
    return true
  }

  /**
   * Delete a message (soft delete)
   */
  delete(messageId) {
    this.deletedIds.add(messageId)
    this.archivedIds.delete(messageId)
    this.saveState()
    this.notifyListeners('message_deleted', { messageId })
    return true
  }

  /**
   * Get thread
   */
  getThread(threadId) {
    const player = messageBroker.player
    if (!player) return []

    return player.getThread(threadId)
  }

  /**
   * Reply to message
   */
  reply(messageId, content, options = {}) {
    const message = this.getMessage(messageId)
    if (!message) return { success: false, error: 'Message not found' }

    return messageBroker.sendToEntity(message.sender.id, content, {
      ...options,
      threadId: message.threadId,
      replyTo: messageId,
    })
  }

  /**
   * Get unread count
   */
  getUnreadCount(category = INBOX_CATEGORIES.ALL) {
    const messages = this.getMessages(category)
    return messages.filter(m => m.readStatus !== MESSAGE_STATUS.READ).length
  }

  /**
   * Get category counts
   */
  getCategoryCounts() {
    return {
      [INBOX_CATEGORIES.ALL]: this.getMessages(INBOX_CATEGORIES.ALL).length,
      [INBOX_CATEGORIES.NPC]: this.getMessages(INBOX_CATEGORIES.NPC).length,
      [INBOX_CATEGORIES.SYSTEM]: this.getMessages(INBOX_CATEGORIES.SYSTEM).length,
      [INBOX_CATEGORIES.PLAYERS]: this.getMessages(INBOX_CATEGORIES.PLAYERS).length,
      [INBOX_CATEGORIES.UNREAD]: this.getMessages(INBOX_CATEGORIES.UNREAD).length,
      [INBOX_CATEGORIES.OPPORTUNITIES]: this.getMessages(INBOX_CATEGORIES.OPPORTUNITIES).length,
      [INBOX_CATEGORIES.ARCHIVED]: this.getMessages(INBOX_CATEGORIES.ARCHIVED).length,
    }
  }

  /**
   * Get messages requiring action
   */
  getActionRequired() {
    return this.getMessages(INBOX_CATEGORIES.ALL).filter(m =>
      requiresAction(m) && !isExpired(m)
    )
  }

  /**
   * Format message for terminal display
   */
  formatForTerminal(message, detailed = false) {
    const time = new Date(message.timestamp)
    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

    const readMarker = message.readStatus === MESSAGE_STATUS.READ ? ' ' : '*'
    const sender = message.sender.name.padEnd(15).substring(0, 15)

    if (detailed) {
      const lines = [
        `From: ${message.sender.name}`,
        `Time: ${time.toLocaleString()}`,
        `Type: ${message.type}`,
        `Status: ${message.readStatus}`,
        `---`,
        message.content.text,
      ]

      if (message.actions && message.actions.length > 0) {
        lines.push('')
        lines.push('Actions:')
        message.actions.forEach((action, i) => {
          lines.push(`  [[${action.command}:${action.label}]]`)
        })
      }

      return lines.join('\n')
    }

    const preview = message.content.text.substring(0, 40).replace(/\n/g, ' ')
    return `${readMarker} [${timeStr}] ${sender} ${preview}...`
  }

  /**
   * Get inbox summary for terminal
   */
  getSummary() {
    const counts = this.getCategoryCounts()
    const unread = this.getUnreadCount()
    const actionRequired = this.getActionRequired().length

    return {
      total: counts[INBOX_CATEGORIES.ALL],
      unread,
      actionRequired,
      byCategory: counts,
    }
  }

  /**
   * Format summary for terminal
   */
  formatSummaryForTerminal() {
    const summary = this.getSummary()
    const lines = [
      '=== INBOX ===',
      `Total: ${summary.total} | Unread: ${summary.unread} | Action Required: ${summary.actionRequired}`,
      '',
      'Categories:',
      `  NPC: ${summary.byCategory.npc}`,
      `  System: ${summary.byCategory.system}`,
      `  Opportunities: ${summary.byCategory.opportunities}`,
      `  Archived: ${summary.byCategory.archived}`,
      '',
      'Commands: inbox [category], inbox read [id], inbox delete [id]',
    ]

    return lines.join('\n')
  }

  /**
   * Set current category
   */
  setCategory(category) {
    if (Object.values(INBOX_CATEGORIES).includes(category)) {
      this.currentCategory = category
      this.notifyListeners('category_changed', { category })
    }
  }

  /**
   * Set sort option
   */
  setSort(sortOption) {
    if (Object.values(SORT_OPTIONS).includes(sortOption)) {
      this.currentSort = sortOption
      this.notifyListeners('sort_changed', { sort: sortOption })
    }
  }

  /**
   * Add listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      listener(event, data)
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      localStorage.setItem('inbox_state', JSON.stringify({
        archivedIds: Array.from(this.archivedIds),
        deletedIds: Array.from(this.deletedIds),
      }))
    } catch (e) {
      console.warn('[Inbox] Failed to save state:', e)
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem('inbox_state')
      if (stored) {
        const data = JSON.parse(stored)
        this.archivedIds = new Set(data.archivedIds || [])
        this.deletedIds = new Set(data.deletedIds || [])
      }
    } catch (e) {
      console.warn('[Inbox] Failed to load state:', e)
    }
  }

  /**
   * Clear all
   */
  clear() {
    this.archivedIds.clear()
    this.deletedIds.clear()
    localStorage.removeItem('inbox_state')
  }
}

// Export singleton
export const inbox = new InboxClass()
export default inbox
