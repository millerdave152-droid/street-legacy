/**
 * RealtimeClient - Phase 28: Real-Time Message Infrastructure
 *
 * WebSocket infrastructure for live messaging.
 *
 * Features:
 * - WebSocket with auto-reconnect
 * - Message types: SEND, RECEIVE, ACK, PRESENCE
 * - Presence system (online/offline/busy)
 * - Queue when offline, deliver on reconnect
 * - Fallback to polling
 */

import { messageBroker } from './MessageBroker'
import { MESSAGE_STATUS } from './MessageProtocol'

// Connection states
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
}

// Presence states
export const PRESENCE_STATES = {
  ONLINE: 'online',
  AWAY: 'away',
  BUSY: 'busy',
  OFFLINE: 'offline',
}

// Message types for WebSocket
export const WS_MESSAGE_TYPES = {
  SEND: 'send',
  RECEIVE: 'receive',
  ACK: 'ack',
  PRESENCE: 'presence',
  PRESENCE_UPDATE: 'presence_update',
  PING: 'ping',
  PONG: 'pong',
  AUTH: 'auth',
  ERROR: 'error',
}

/**
 * RealtimeClient class
 */
class RealtimeClientClass {
  constructor() {
    this.socket = null
    this.state = CONNECTION_STATES.DISCONNECTED
    this.presence = PRESENCE_STATES.OFFLINE
    this.serverUrl = null
    this.playerId = null
    this.authToken = null

    this.messageQueue = []      // Messages to send when reconnected
    this.pendingAcks = new Map()  // Messages awaiting acknowledgment
    this.onlinePlayers = new Map()  // Other players' presence

    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000  // Start with 1 second
    this.maxReconnectDelay = 30000  // Max 30 seconds
    this.reconnectTimer = null

    this.pingInterval = null
    this.pingTimeout = null
    this.lastPing = null
    this.latency = 0

    this.listeners = []

    // Polling fallback
    this.pollingEnabled = false
    this.pollingInterval = null
    this.pollDelay = 5000  // 5 seconds
  }

  /**
   * Initialize the realtime client
   */
  initialize(config = {}) {
    this.serverUrl = config.serverUrl || null
    this.playerId = config.playerId || 'player'
    this.authToken = config.authToken || null
    this.pollingEnabled = config.enablePolling !== false

    console.log('[RealtimeClient] Initialized (offline mode until server configured)')

    // If no server URL, work in offline mode
    if (!this.serverUrl) {
      this.state = CONNECTION_STATES.DISCONNECTED
      this.presence = PRESENCE_STATES.OFFLINE
      return
    }

    this.connect()
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (!this.serverUrl) {
      console.log('[RealtimeClient] No server URL configured')
      return
    }

    if (this.state === CONNECTION_STATES.CONNECTING) {
      return
    }

    this.setState(CONNECTION_STATES.CONNECTING)

    try {
      this.socket = new WebSocket(this.serverUrl)
      this.setupSocketHandlers()
    } catch (e) {
      console.error('[RealtimeClient] Connection failed:', e)
      this.handleConnectionError()
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupSocketHandlers() {
    if (!this.socket) return

    this.socket.onopen = () => {
      console.log('[RealtimeClient] Connected')
      this.setState(CONNECTION_STATES.CONNECTED)
      this.reconnectAttempts = 0
      this.reconnectDelay = 1000

      // Authenticate
      this.sendAuth()

      // Set presence to online
      this.setPresence(PRESENCE_STATES.ONLINE)

      // Start ping interval
      this.startPingInterval()

      // Send queued messages
      this.flushQueue()

      // Stop polling fallback if running
      this.stopPolling()
    }

    this.socket.onclose = (event) => {
      console.log('[RealtimeClient] Disconnected:', event.code)
      this.handleDisconnect()
    }

    this.socket.onerror = (error) => {
      console.error('[RealtimeClient] WebSocket error:', error)
      this.handleConnectionError()
    }

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data)
    }
  }

  /**
   * Send authentication
   */
  sendAuth() {
    this.sendRaw({
      type: WS_MESSAGE_TYPES.AUTH,
      playerId: this.playerId,
      token: this.authToken,
      timestamp: Date.now(),
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case WS_MESSAGE_TYPES.RECEIVE:
          this.handleIncomingMessage(message.payload)
          break

        case WS_MESSAGE_TYPES.ACK:
          this.handleAck(message.messageId)
          break

        case WS_MESSAGE_TYPES.PRESENCE_UPDATE:
          this.handlePresenceUpdate(message)
          break

        case WS_MESSAGE_TYPES.PONG:
          this.handlePong(message.timestamp)
          break

        case WS_MESSAGE_TYPES.ERROR:
          console.error('[RealtimeClient] Server error:', message.error)
          this.notifyListeners('error', message)
          break

        default:
          console.log('[RealtimeClient] Unknown message type:', message.type)
      }
    } catch (e) {
      console.error('[RealtimeClient] Failed to parse message:', e)
    }
  }

  /**
   * Handle incoming chat message
   */
  handleIncomingMessage(payload) {
    // Route through message broker
    messageBroker.route(payload)

    // Send acknowledgment
    this.sendRaw({
      type: WS_MESSAGE_TYPES.ACK,
      messageId: payload.id,
      timestamp: Date.now(),
    })

    this.notifyListeners('message', payload)
  }

  /**
   * Handle message acknowledgment
   */
  handleAck(messageId) {
    const pending = this.pendingAcks.get(messageId)
    if (pending) {
      pending.status = MESSAGE_STATUS.DELIVERED
      pending.resolve?.()
      this.pendingAcks.delete(messageId)
    }
  }

  /**
   * Handle presence update from server
   */
  handlePresenceUpdate(message) {
    const { playerId, presence, lastSeen } = message

    if (playerId !== this.playerId) {
      this.onlinePlayers.set(playerId, {
        presence,
        lastSeen: lastSeen || Date.now(),
      })

      this.notifyListeners('presence', { playerId, presence })
    }
  }

  /**
   * Handle pong response
   */
  handlePong(serverTimestamp) {
    if (this.lastPing) {
      this.latency = Date.now() - this.lastPing
      this.lastPing = null
    }

    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }
  }

  /**
   * Send a message
   */
  send(message) {
    if (this.state !== CONNECTION_STATES.CONNECTED) {
      // Queue for later
      this.messageQueue.push(message)
      return { success: false, queued: true }
    }

    // Track for acknowledgment
    this.pendingAcks.set(message.id, {
      message,
      sentAt: Date.now(),
      status: 'pending',
    })

    this.sendRaw({
      type: WS_MESSAGE_TYPES.SEND,
      payload: message,
      timestamp: Date.now(),
    })

    return { success: true, queued: false }
  }

  /**
   * Send raw data to WebSocket
   */
  sendRaw(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data))
      return true
    }
    return false
  }

  /**
   * Flush message queue
   */
  flushQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }

  /**
   * Set presence
   */
  setPresence(presence) {
    this.presence = presence

    if (this.state === CONNECTION_STATES.CONNECTED) {
      this.sendRaw({
        type: WS_MESSAGE_TYPES.PRESENCE,
        playerId: this.playerId,
        presence,
        timestamp: Date.now(),
      })
    }

    this.notifyListeners('presence_self', { presence })
  }

  /**
   * Start ping interval
   */
  startPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    this.pingInterval = setInterval(() => {
      this.ping()
    }, 30000)  // Ping every 30 seconds
  }

  /**
   * Send ping
   */
  ping() {
    this.lastPing = Date.now()

    this.sendRaw({
      type: WS_MESSAGE_TYPES.PING,
      timestamp: this.lastPing,
    })

    // Set timeout for pong response
    this.pingTimeout = setTimeout(() => {
      console.warn('[RealtimeClient] Ping timeout')
      this.handleConnectionError()
    }, 10000)  // 10 second timeout
  }

  /**
   * Handle disconnect
   */
  handleDisconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }

    this.presence = PRESENCE_STATES.OFFLINE
    this.setState(CONNECTION_STATES.DISCONNECTED)

    this.scheduleReconnect()
  }

  /**
   * Handle connection error
   */
  handleConnectionError() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.setState(CONNECTION_STATES.ERROR)
    this.scheduleReconnect()

    // Start polling fallback if enabled
    if (this.pollingEnabled) {
      this.startPolling()
    }
  }

  /**
   * Schedule reconnect
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[RealtimeClient] Max reconnect attempts reached')
      this.notifyListeners('max_reconnect_reached', {})
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.setState(CONNECTION_STATES.RECONNECTING)
    this.reconnectAttempts++

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    )

    console.log(`[RealtimeClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * Start polling fallback
   */
  startPolling() {
    if (this.pollingInterval) return

    console.log('[RealtimeClient] Starting polling fallback')

    this.pollingInterval = setInterval(() => {
      this.poll()
    }, this.pollDelay)
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * Poll for messages (fallback)
   */
  async poll() {
    if (!this.serverUrl) return

    try {
      // Would make HTTP request to poll endpoint
      // For now, just a placeholder
      console.log('[RealtimeClient] Polling...')

      // const response = await fetch(`${this.serverUrl}/poll?playerId=${this.playerId}`)
      // const messages = await response.json()
      // messages.forEach(m => this.handleIncomingMessage(m))
    } catch (e) {
      console.error('[RealtimeClient] Poll failed:', e)
    }
  }

  /**
   * Set state
   */
  setState(state) {
    const oldState = this.state
    this.state = state

    if (oldState !== state) {
      this.notifyListeners('state_change', { oldState, newState: state })
    }
  }

  /**
   * Get online players
   */
  getOnlinePlayers() {
    const result = []
    for (const [playerId, data] of this.onlinePlayers) {
      if (data.presence !== PRESENCE_STATES.OFFLINE) {
        result.push({
          playerId,
          presence: data.presence,
          lastSeen: data.lastSeen,
        })
      }
    }
    return result
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      state: this.state,
      presence: this.presence,
      latency: this.latency,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingAcks: this.pendingAcks.size,
      onlinePlayers: this.getOnlinePlayers().length,
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
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stopPolling()

    this.setState(CONNECTION_STATES.DISCONNECTED)
    this.presence = PRESENCE_STATES.OFFLINE
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.state === CONNECTION_STATES.CONNECTED
  }

  /**
   * Check if offline
   */
  isOffline() {
    return this.state === CONNECTION_STATES.DISCONNECTED ||
           this.state === CONNECTION_STATES.ERROR
  }
}

// Export singleton
export const realtimeClient = new RealtimeClientClass()
export default realtimeClient
