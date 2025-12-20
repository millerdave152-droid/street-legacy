// Street Legacy - WebSocket Service
// Real-time communication for game events, chat, and notifications

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const WS_URL = BASE_URL.replace(/^http/, 'ws')

// Connection states
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
}

// Reconnection config
const RECONNECT_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 1.5,
  maxAttempts: 10,
}

// Get auth token from localStorage
function getAuthToken() {
  try {
    const authData = localStorage.getItem('auth-storage')
    if (authData) {
      const parsed = JSON.parse(authData)
      return parsed?.state?.token || null
    }
  } catch (e) {
    console.error('[WS] Failed to get auth token:', e)
  }
  return null
}

class WebSocketService {
  constructor() {
    this.ws = null
    this.state = ConnectionState.DISCONNECTED
    this.reconnectAttempts = 0
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.heartbeatTimeout = null

    // Event listeners by type
    this.listeners = new Map()

    // Subscribed channels
    this.subscribedChannels = new Set()

    // Message queue for offline messages
    this.messageQueue = []

    // Connection state listeners
    this.stateListeners = new Set()

    // Online count cache
    this.onlineCount = 0

    // Bind methods
    this.connect = this.connect.bind(this)
    this.disconnect = this.disconnect.bind(this)
    this.send = this.send.bind(this)
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  connect() {
    const token = getAuthToken()
    if (!token) {
      console.warn('[WS] Cannot connect: No auth token')
      return false
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[WS] Already connected')
      return true
    }

    if (this.state === ConnectionState.CONNECTING) {
      console.warn('[WS] Connection already in progress')
      return false
    }

    this.setState(ConnectionState.CONNECTING)

    try {
      this.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)

      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onclose = this.handleClose.bind(this)
      this.ws.onerror = this.handleError.bind(this)

      return true
    } catch (err) {
      console.error('[WS] Failed to create connection:', err)
      this.setState(ConnectionState.DISCONNECTED)
      this.scheduleReconnect()
      return false
    }
  }

  disconnect() {
    this.clearTimers()
    this.reconnectAttempts = 0

    if (this.ws) {
      this.ws.onclose = null // Prevent reconnect on intentional disconnect
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.setState(ConnectionState.DISCONNECTED)
    this.subscribedChannels.clear()
  }

  handleOpen() {
    console.log('[WS] Connected')
    this.setState(ConnectionState.CONNECTED)
    this.reconnectAttempts = 0

    // Start heartbeat
    this.startHeartbeat()

    // Resubscribe to channels
    this.resubscribeChannels()

    // Flush message queue
    this.flushMessageQueue()
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data)

      // Handle heartbeat response
      if (data.type === 'pong') {
        this.handlePong()
        return
      }

      // Handle connection confirmation
      if (data.type === 'connected') {
        this.onlineCount = data.onlineCount || 0
        this.emit('connected', data)
        return
      }

      // Handle subscription confirmations
      if (data.type === 'chat:subscribed') {
        this.subscribedChannels.add(data.channel)
      } else if (data.type === 'chat:unsubscribed') {
        this.subscribedChannels.delete(data.channel)
      }

      // Update online count
      if (data.type === 'presence:online_count') {
        this.onlineCount = data.count
      }

      // Emit to type-specific listeners
      this.emit(data.type, data)

      // Emit to catch-all listeners
      this.emit('*', data)

    } catch (err) {
      console.error('[WS] Failed to parse message:', err)
    }
  }

  handleClose(event) {
    console.log(`[WS] Disconnected: ${event.code} ${event.reason}`)
    this.clearTimers()

    // Don't reconnect on certain codes
    if (event.code === 4001 || event.code === 4003) {
      // Authentication error - don't reconnect
      console.warn('[WS] Authentication failed, not reconnecting')
      this.setState(ConnectionState.DISCONNECTED)
      this.emit('auth_error', { code: event.code, reason: event.reason })
      return
    }

    this.setState(ConnectionState.RECONNECTING)
    this.scheduleReconnect()
  }

  handleError(error) {
    console.error('[WS] Error:', error)
    this.emit('error', { error })
  }

  // ==========================================================================
  // HEARTBEAT
  // ==========================================================================

  startHeartbeat() {
    this.clearTimers()

    // Send ping every 25 seconds
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' })

        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('[WS] Heartbeat timeout, reconnecting...')
          this.ws?.close(4000, 'Heartbeat timeout')
        }, 5000)
      }
    }, 25000)
  }

  handlePong() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ==========================================================================
  // RECONNECTION
  // ==========================================================================

  scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_CONFIG.maxAttempts) {
      console.error('[WS] Max reconnection attempts reached')
      this.setState(ConnectionState.DISCONNECTED)
      this.emit('max_reconnects', { attempts: this.reconnectAttempts })
      return
    }

    const delay = Math.min(
      RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.backoffMultiplier, this.reconnectAttempts),
      RECONNECT_CONFIG.maxDelay
    )

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  resubscribeChannels() {
    // Re-subscribe to previously subscribed channels
    const channels = Array.from(this.subscribedChannels)
    this.subscribedChannels.clear()

    channels.forEach(channel => {
      this.subscribeToChannel(channel)
    })
  }

  // ==========================================================================
  // SENDING MESSAGES
  // ==========================================================================

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
      return true
    } else {
      // Queue message for later
      this.messageQueue.push(data)
      return false
    }
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift()
      this.ws.send(JSON.stringify(msg))
    }
  }

  // ==========================================================================
  // CHAT FUNCTIONALITY
  // ==========================================================================

  subscribeToChannel(channel) {
    this.subscribedChannels.add(channel)
    return this.send({ type: 'subscribe', channel })
  }

  unsubscribeFromChannel(channel) {
    this.subscribedChannels.delete(channel)
    return this.send({ type: 'unsubscribe', channel })
  }

  sendChatMessage(channel, message) {
    return this.send({ type: 'chat', channel, message })
  }

  sendTypingIndicator(channel) {
    return this.send({ type: 'typing', channel })
  }

  // ==========================================================================
  // PRESENCE
  // ==========================================================================

  requestPresence(districtId = null) {
    return this.send({ type: 'presence:request', districtId })
  }

  getOnlineCount() {
    return this.onlineCount
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType).add(callback)

    // Return unsubscribe function
    return () => this.off(eventType, callback)
  }

  off(eventType, callback) {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  once(eventType, callback) {
    const wrapper = (data) => {
      this.off(eventType, wrapper)
      callback(data)
    }
    return this.on(eventType, wrapper)
  }

  emit(eventType, data) {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (err) {
          console.error(`[WS] Error in ${eventType} listener:`, err)
        }
      })
    }
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  setState(newState) {
    const oldState = this.state
    this.state = newState

    if (oldState !== newState) {
      this.stateListeners.forEach(callback => {
        try {
          callback(newState, oldState)
        } catch (err) {
          console.error('[WS] Error in state listener:', err)
        }
      })
    }
  }

  onStateChange(callback) {
    this.stateListeners.add(callback)
    return () => this.stateListeners.delete(callback)
  }

  isConnected() {
    return this.state === ConnectionState.CONNECTED
  }

  getState() {
    return this.state
  }

  // ==========================================================================
  // CONVENIENCE METHODS FOR GAME EVENTS
  // ==========================================================================

  // Listen for stat updates (cash, health, energy, etc.)
  onStatUpdate(callback) {
    return this.on('game:stat_update', callback)
  }

  // Listen for crime results
  onCrimeResult(callback) {
    return this.on('game:crime_result', callback)
  }

  // Listen for cooldown ready notifications
  onCooldownReady(callback) {
    return this.on('game:cooldown_ready', callback)
  }

  // Listen for level up events
  onLevelUp(callback) {
    return this.on('game:level_up', callback)
  }

  // Listen for achievements
  onAchievement(callback) {
    return this.on('game:achievement', callback)
  }

  // Listen for incoming attacks
  onAttackReceived(callback) {
    return this.on('pvp:attack_received', callback)
  }

  // Listen for attack results
  onAttackResult(callback) {
    return this.on('pvp:attack_result', callback)
  }

  // Listen for money transfers
  onTransferReceived(callback) {
    return this.on('economy:transfer_received', callback)
  }

  // Listen for notifications
  onNotification(callback) {
    return this.on('notification', callback)
  }

  // Listen for system notifications
  onSystemNotification(callback) {
    return this.on('notification:system', callback)
  }

  // Listen for chat messages
  onChatMessage(callback) {
    return this.on('chat', callback)
  }

  // Listen for chat history
  onChatHistory(callback) {
    return this.on('chat:history', callback)
  }

  // Listen for typing indicators
  onTypingIndicator(callback) {
    return this.on('chat:typing', callback)
  }

  // Listen for crew member online/offline
  onCrewMemberOnline(callback) {
    return this.on('crew:member_online', callback)
  }

  onCrewMemberOffline(callback) {
    return this.on('crew:member_offline', callback)
  }

  // Listen for friend online/offline
  onFriendOnline(callback) {
    return this.on('social:friend_online', callback)
  }

  onFriendOffline(callback) {
    return this.on('social:friend_offline', callback)
  }

  // Listen for territory changes
  onTerritoryChange(callback) {
    return this.on('territory:control_changed', callback)
  }

  onTerritoryWar(callback) {
    const unsub1 = this.on('territory:war_started', callback)
    const unsub2 = this.on('territory:war_ended', callback)
    return () => {
      unsub1()
      unsub2()
    }
  }

  // Listen for bounty events
  onBountyPlaced(callback) {
    return this.on('pvp:bounty_placed', callback)
  }

  onBountyClaimed(callback) {
    return this.on('pvp:bounty_claimed', callback)
  }

  // Listen for jail release
  onJailReleased(callback) {
    return this.on('pvp:jail_released', callback)
  }

  // Listen for online count updates
  onOnlineCountUpdate(callback) {
    return this.on('presence:online_count', callback)
  }

  // Listen for chat:message events (from API routes)
  onChatMessageFromAPI(callback) {
    return this.on('chat:message', callback)
  }

  // Listen for message deletions
  onChatMessageDeleted(callback) {
    return this.on('chat:message_deleted', callback)
  }

  // Listen for friend requests
  onFriendRequest(callback) {
    return this.on('social:friend_request', callback)
  }

  // Listen for friend accepted
  onFriendAccepted(callback) {
    return this.on('social:friend_accepted', callback)
  }

  // Listen for crew announcements
  onCrewAnnouncement(callback) {
    return this.on('crew:announcement', callback)
  }

  // Listen for crew rank changes
  onCrewRankChanged(callback) {
    return this.on('crew:rank_changed', callback)
  }

  // Listen for crew member joins
  onCrewMemberJoined(callback) {
    return this.on('crew:member_joined', callback)
  }

  // Listen for crew member leaves
  onCrewMemberLeft(callback) {
    return this.on('crew:member_left', callback)
  }

  // Listen for property income
  onPropertyIncome(callback) {
    return this.on('economy:property_income', callback)
  }

  // Listen for business income
  onBusinessIncome(callback) {
    return this.on('economy:business_income', callback)
  }

  // Listen for any transaction
  onTransaction(callback) {
    return this.on('economy:transaction', callback)
  }

  // Listen for trade request received
  onTradeRequest(callback) {
    return this.on('trade:request_received', callback)
  }

  // Listen for trade completed
  onTradeCompleted(callback) {
    return this.on('trade:completed', callback)
  }

  // Listen for trade cancelled
  onTradeCancelled(callback) {
    return this.on('trade:request_cancelled', callback)
  }

  // Listen for heist started
  onHeistStarted(callback) {
    return this.on('heist:started', callback)
  }

  // Listen for heist player joined
  onHeistPlayerJoined(callback) {
    return this.on('heist:player_joined', callback)
  }

  // Listen for heist executed
  onHeistExecuted(callback) {
    return this.on('heist:executed', callback)
  }
}

// Export singleton instance
export const wsService = new WebSocketService()

// Export connection states for external use
export { ConnectionState }

export default wsService
