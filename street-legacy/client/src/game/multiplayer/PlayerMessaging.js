/**
 * PlayerMessaging - Phase 29: Player-to-Player Messaging
 *
 * Direct messaging between players.
 *
 * Commands:
 * - msg PlayerName message
 * - reply
 * - who
 * - players
 *
 * Features:
 * - Block/unblock
 * - Message history
 * - Trade initiation
 * - Alliance proposals
 */

import { messageBroker } from './MessageBroker'
import { realtimeClient, PRESENCE_STATES } from './RealtimeClient'
import {
  MESSAGE_TYPES,
  MESSAGE_PRIORITY,
  createMessage,
  playerEntity,
} from './MessageProtocol'

const STORAGE_KEY = 'player_messaging_data'

/**
 * PlayerMessaging class
 */
class PlayerMessagingClass {
  constructor() {
    this.blockedPlayers = new Set()
    this.contacts = new Map()    // Known players
    this.lastReplyTo = null      // For 'reply' command
    this.messageHistory = []
    this.listeners = []
  }

  /**
   * Initialize player messaging
   */
  initialize() {
    this.loadState()

    // Listen for incoming player messages
    messageBroker.subscribe((message) => {
      if (message.type === MESSAGE_TYPES.PLAYER) {
        this.handleIncomingMessage(message)
      }
    })

    console.log('[PlayerMessaging] Initialized')
  }

  /**
   * Send message to another player
   */
  sendMessage(playerName, content, options = {}) {
    // Find player
    const player = this.findPlayer(playerName)
    if (!player) {
      return { success: false, error: `Player "${playerName}" not found` }
    }

    // Check if blocked
    if (this.blockedPlayers.has(player.id)) {
      return { success: false, error: 'You have blocked this player' }
    }

    // Create message
    const localPlayer = messageBroker.player
    const message = createMessage({
      type: MESSAGE_TYPES.PLAYER,
      sender: localPlayer.getReference(),
      recipient: playerEntity(player.id, player.name),
      content: { text: content },
      metadata: {
        isPlayerMessage: true,
        ...options.metadata,
      },
      priority: options.priority || MESSAGE_PRIORITY.NORMAL,
      threadId: options.threadId || null,
      replyTo: options.replyTo || null,
    })

    // Send through realtime client if connected
    if (realtimeClient.isConnected()) {
      realtimeClient.send(message)
    } else {
      // Queue for later or show offline notice
      console.log('[PlayerMessaging] Queued message (offline)')
    }

    // Store in outbox
    localPlayer.outbox.push(message)

    // Record for reply command
    this.lastReplyTo = player

    // Add to history
    this.addToHistory('sent', message)

    // Save
    messageBroker.save()
    this.saveState()

    return { success: true, message }
  }

  /**
   * Handle incoming player message
   */
  handleIncomingMessage(message) {
    // Check if sender is blocked
    if (this.blockedPlayers.has(message.sender.id)) {
      console.log('[PlayerMessaging] Blocked message from:', message.sender.name)
      return
    }

    // Add sender to contacts if not known
    if (!this.contacts.has(message.sender.id)) {
      this.contacts.set(message.sender.id, {
        id: message.sender.id,
        name: message.sender.name,
        firstContact: Date.now(),
        lastMessage: Date.now(),
      })
    } else {
      this.contacts.get(message.sender.id).lastMessage = Date.now()
    }

    // Set for reply command
    this.lastReplyTo = {
      id: message.sender.id,
      name: message.sender.name,
    }

    // Add to history
    this.addToHistory('received', message)

    // Notify listeners
    this.notifyListeners('message_received', message)

    this.saveState()
  }

  /**
   * Reply to last sender
   */
  reply(content) {
    if (!this.lastReplyTo) {
      return { success: false, error: 'No one to reply to' }
    }

    return this.sendMessage(this.lastReplyTo.name, content)
  }

  /**
   * Find player by name (case-insensitive)
   */
  findPlayer(name) {
    const lowerName = name.toLowerCase()

    // Check online players first
    const onlinePlayers = realtimeClient.getOnlinePlayers()
    for (const player of onlinePlayers) {
      if (player.name?.toLowerCase() === lowerName) {
        return player
      }
    }

    // Check contacts
    for (const [id, contact] of this.contacts) {
      if (contact.name.toLowerCase() === lowerName) {
        return contact
      }
    }

    return null
  }

  /**
   * Get online players
   */
  getOnlinePlayers() {
    return realtimeClient.getOnlinePlayers()
  }

  /**
   * Get contacts
   */
  getContacts() {
    return Array.from(this.contacts.values())
      .sort((a, b) => b.lastMessage - a.lastMessage)
  }

  /**
   * Block a player
   */
  blockPlayer(playerName) {
    const player = this.findPlayer(playerName)
    if (!player) {
      return { success: false, error: 'Player not found' }
    }

    this.blockedPlayers.add(player.id)
    this.saveState()

    this.notifyListeners('player_blocked', { playerId: player.id, playerName: player.name })

    return { success: true, message: `Blocked ${player.name}` }
  }

  /**
   * Unblock a player
   */
  unblockPlayer(playerName) {
    const player = this.findPlayer(playerName)
    if (!player) {
      // Try by name in blocked list
      for (const [id, contact] of this.contacts) {
        if (contact.name.toLowerCase() === playerName.toLowerCase()) {
          this.blockedPlayers.delete(id)
          this.saveState()
          return { success: true, message: `Unblocked ${contact.name}` }
        }
      }
      return { success: false, error: 'Player not found' }
    }

    this.blockedPlayers.delete(player.id)
    this.saveState()

    this.notifyListeners('player_unblocked', { playerId: player.id, playerName: player.name })

    return { success: true, message: `Unblocked ${player.name}` }
  }

  /**
   * Get blocked players
   */
  getBlockedPlayers() {
    const blocked = []
    for (const playerId of this.blockedPlayers) {
      const contact = this.contacts.get(playerId)
      blocked.push({
        id: playerId,
        name: contact?.name || 'Unknown',
      })
    }
    return blocked
  }

  /**
   * Check if player is blocked
   */
  isBlocked(playerId) {
    return this.blockedPlayers.has(playerId)
  }

  /**
   * Get conversation with player
   */
  getConversation(playerName) {
    const player = this.findPlayer(playerName)
    if (!player) {
      return { success: false, error: 'Player not found', messages: [] }
    }

    const localPlayer = messageBroker.player
    if (!localPlayer) {
      return { success: false, error: 'Not initialized', messages: [] }
    }

    // Get messages to/from this player
    const sent = localPlayer.outbox.filter(m =>
      m.type === MESSAGE_TYPES.PLAYER &&
      m.recipient?.id === player.id
    )

    const received = localPlayer.inbox.filter(m =>
      m.type === MESSAGE_TYPES.PLAYER &&
      m.sender.id === player.id
    )

    const messages = [...sent, ...received]
      .sort((a, b) => a.timestamp - b.timestamp)

    return { success: true, player, messages }
  }

  /**
   * Add to message history
   */
  addToHistory(direction, message) {
    this.messageHistory.push({
      direction,
      messageId: message.id,
      senderId: message.sender.id,
      senderName: message.sender.name,
      recipientId: message.recipient?.id,
      recipientName: message.recipient?.name,
      preview: message.content.text.substring(0, 50),
      timestamp: message.timestamp,
    })

    // Keep last 500
    if (this.messageHistory.length > 500) {
      this.messageHistory = this.messageHistory.slice(-500)
    }
  }

  /**
   * Get message history
   */
  getHistory(limit = 50) {
    return this.messageHistory.slice(-limit)
  }

  /**
   * Format 'who' command output
   */
  formatWhoList() {
    const online = this.getOnlinePlayers()
    const lines = ['=== ONLINE PLAYERS ===']

    if (online.length === 0) {
      lines.push('No other players online')
    } else {
      for (const player of online) {
        const status = player.presence === PRESENCE_STATES.AWAY ? ' (Away)' :
                       player.presence === PRESENCE_STATES.BUSY ? ' (Busy)' : ''
        lines.push(`  ${player.name || player.playerId}${status}`)
      }
    }

    lines.push('')
    lines.push(`Total online: ${online.length}`)
    lines.push('Use: msg <player> <message>')

    return lines.join('\n')
  }

  /**
   * Format 'players' command output (all known contacts)
   */
  formatPlayersList() {
    const contacts = this.getContacts()
    const online = new Set(this.getOnlinePlayers().map(p => p.playerId))

    const lines = ['=== KNOWN PLAYERS ===']

    if (contacts.length === 0) {
      lines.push('No contacts yet')
    } else {
      for (const contact of contacts) {
        const isOnline = online.has(contact.id)
        const isBlocked = this.isBlocked(contact.id)
        const status = isBlocked ? ' [BLOCKED]' : isOnline ? ' [ONLINE]' : ''
        const lastMsg = new Date(contact.lastMessage).toLocaleDateString()
        lines.push(`  ${contact.name}${status} - Last: ${lastMsg}`)
      }
    }

    lines.push('')
    lines.push(`Total contacts: ${contacts.length}`)

    return lines.join('\n')
  }

  /**
   * Initiate trade with player
   */
  initiateTrade(playerName, offering, requesting) {
    const player = this.findPlayer(playerName)
    if (!player) {
      return { success: false, error: 'Player not found' }
    }

    const tradeRequest = {
      type: 'trade_request',
      offering,
      requesting,
      expiresAt: Date.now() + 300000,  // 5 minutes
    }

    return this.sendMessage(playerName, `Trade request: Offering ${offering} for ${requesting}`, {
      metadata: tradeRequest,
    })
  }

  /**
   * Propose alliance with player
   */
  proposeAlliance(playerName, terms) {
    const player = this.findPlayer(playerName)
    if (!player) {
      return { success: false, error: 'Player not found' }
    }

    const allianceProposal = {
      type: 'alliance_proposal',
      terms,
      expiresAt: Date.now() + 600000,  // 10 minutes
    }

    return this.sendMessage(playerName, `Alliance proposal: ${terms}`, {
      metadata: allianceProposal,
    })
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
   * Save state
   */
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        blockedPlayers: Array.from(this.blockedPlayers),
        contacts: Array.from(this.contacts.entries()),
        lastReplyTo: this.lastReplyTo,
        messageHistory: this.messageHistory,
      }))
    } catch (e) {
      console.warn('[PlayerMessaging] Failed to save:', e)
    }
  }

  /**
   * Load state
   */
  loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.blockedPlayers = new Set(data.blockedPlayers || [])
        this.contacts = new Map(data.contacts || [])
        this.lastReplyTo = data.lastReplyTo || null
        this.messageHistory = data.messageHistory || []
      }
    } catch (e) {
      console.warn('[PlayerMessaging] Failed to load:', e)
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.blockedPlayers.clear()
    this.contacts.clear()
    this.lastReplyTo = null
    this.messageHistory = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const playerMessaging = new PlayerMessagingClass()
export default playerMessaging
