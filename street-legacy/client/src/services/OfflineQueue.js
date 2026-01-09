/**
 * Offline Queue Service
 * Manages offline action queuing and sync for server-authoritative gameplay
 */

const STORAGE_KEY = 'offlineQueue'
const LAST_SYNC_KEY = 'lastSyncTimestamp'
const MAX_QUEUE_AGE = 24 * 60 * 60 * 1000 // 24 hours

// Action types that can be queued
export const ActionTypes = {
  CRIME: 'crime',
  HEIST: 'heist',
  PROPERTY: 'property'
}

// Sync status values
export const SyncStatus = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  ADJUSTED: 'adjusted',
  REJECTED: 'rejected'
}

class OfflineQueueService {
  constructor() {
    this.queue = []
    this.syncInProgress = false
    this.isOnline = navigator.onLine
    this.listeners = new Set()
    this.reconciliationListeners = new Set()

    // Load queue from localStorage
    this.loadQueue()

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.queue = JSON.parse(stored)
        // Filter out expired actions
        this.queue = this.queue.filter(action => {
          const age = Date.now() - action.timestamp
          return age < MAX_QUEUE_AGE
        })
        this.persist()
      }
    } catch (e) {
      console.error('[OfflineQueue] Failed to load queue:', e)
      this.queue = []
    }
  }

  /**
   * Persist queue to localStorage
   */
  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
    } catch (e) {
      console.error('[OfflineQueue] Failed to persist queue:', e)
    }
  }

  /**
   * Enqueue an action for later sync
   * @param {Object} action - Action to queue
   * @param {string} action.type - Action type (crime, heist, property)
   * @param {Object} action.data - Action-specific data
   * @param {Object} action.localResult - Result calculated locally
   */
  enqueue(action) {
    const queuedAction = {
      id: crypto.randomUUID(),
      type: action.type,
      data: action.data,
      localResult: action.localResult,
      timestamp: Date.now(),
      status: SyncStatus.PENDING,
      attempts: 0
    }

    this.queue.push(queuedAction)
    this.persist()
    this.notifyListeners()

    console.log('[OfflineQueue] Enqueued action:', queuedAction.type, queuedAction.id)
    return queuedAction.id
  }

  /**
   * Get queue length
   */
  getQueueLength() {
    return this.queue.filter(a => a.status === SyncStatus.PENDING).length
  }

  /**
   * Get all queued actions
   */
  getQueue() {
    return [...this.queue]
  }

  /**
   * Clear the queue
   */
  clearQueue() {
    this.queue = []
    this.persist()
    this.notifyListeners()
  }

  /**
   * Remove a specific action from queue
   */
  removeAction(actionId) {
    this.queue = this.queue.filter(a => a.id !== actionId)
    this.persist()
    this.notifyListeners()
  }

  // ============================================================================
  // ONLINE/OFFLINE HANDLING
  // ============================================================================

  /**
   * Check if currently online
   */
  getIsOnline() {
    return this.isOnline
  }

  /**
   * Handle going online
   */
  handleOnline() {
    console.log('[OfflineQueue] Back online')
    this.isOnline = true
    this.notifyListeners()

    // Auto-sync when back online
    if (this.queue.length > 0) {
      this.syncAll()
    }
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.log('[OfflineQueue] Went offline')
    this.isOnline = false
    this.notifyListeners()
  }

  // ============================================================================
  // SYNC LOGIC
  // ============================================================================

  /**
   * Sync all pending actions to server
   */
  async syncAll() {
    if (this.syncInProgress) {
      console.log('[OfflineQueue] Sync already in progress')
      return
    }

    if (!this.isOnline) {
      console.log('[OfflineQueue] Cannot sync - offline')
      return
    }

    const pendingActions = this.queue.filter(a => a.status === SyncStatus.PENDING)
    if (pendingActions.length === 0) {
      console.log('[OfflineQueue] No pending actions to sync')
      return
    }

    console.log(`[OfflineQueue] Syncing ${pendingActions.length} actions...`)
    this.syncInProgress = true
    this.notifyListeners()

    const results = []

    for (const action of pendingActions) {
      try {
        action.status = SyncStatus.SYNCING
        action.attempts++
        this.persist()
        this.notifyListeners()

        const result = await this.submitToServer(action)
        results.push({ action, result })

        // Update action status based on result
        if (result.offlineRejected) {
          action.status = SyncStatus.REJECTED
          action.serverError = result.error
        } else if (result.offlineReconciliation?.serverDiffered) {
          action.status = SyncStatus.ADJUSTED
          action.serverResult = result
          action.reconciliation = result.offlineReconciliation

          // Notify about reconciliation
          this.notifyReconciliation(action, result)
        } else {
          action.status = SyncStatus.SYNCED
          action.serverResult = result
        }

        this.persist()
        this.notifyListeners()

      } catch (error) {
        console.error(`[OfflineQueue] Failed to sync action ${action.id}:`, error)

        // Keep as pending if network error, reject if validation error
        if (error.message?.includes('Not authenticated') ||
            error.message?.includes('rejected') ||
            action.attempts >= 3) {
          action.status = SyncStatus.REJECTED
          action.serverError = error.message
        }
        // Otherwise stays as pending for retry

        this.persist()
        this.notifyListeners()
      }
    }

    this.syncInProgress = false
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString())
    this.notifyListeners()

    // Clean up completed/rejected actions after delay
    setTimeout(() => this.cleanupCompletedActions(), 5000)

    console.log('[OfflineQueue] Sync complete')
    return results
  }

  /**
   * Submit a single action to the server
   */
  async submitToServer(action) {
    const token = this.getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    // Route action to appropriate endpoint
    let endpoint
    let body

    switch (action.type) {
      case ActionTypes.CRIME:
        endpoint = '/api/game/crime'
        body = {
          crimeId: action.data.crimeId,
          miniGameResult: action.data.miniGameResult,
          offlineSubmission: {
            timestamp: action.timestamp,
            localResult: action.localResult
          }
        }
        break

      case ActionTypes.HEIST:
        endpoint = '/api/ops/heist/execute'
        body = {
          heistId: action.data.heistId,
          offlineSubmission: {
            timestamp: action.timestamp,
            localResult: action.localResult
          }
        }
        break

      case ActionTypes.PROPERTY:
        endpoint = `/api/properties/${action.data.operation}/${action.data.propertyId}`
        body = {
          offlineSubmission: {
            timestamp: action.timestamp,
            localResult: action.localResult
          }
        }
        break

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })

    const result = await response.json()

    if (!response.ok) {
      // Check if it's an offline rejection
      if (result.offlineRejected) {
        return { offlineRejected: true, error: result.error }
      }
      throw new Error(result.error || `Request failed: ${response.status}`)
    }

    return result.data || result
  }

  /**
   * Get auth token from localStorage
   */
  getAuthToken() {
    try {
      const authData = localStorage.getItem('auth-storage')
      if (authData) {
        const parsed = JSON.parse(authData)
        return parsed?.state?.token || null
      }
    } catch (e) {
      console.error('[OfflineQueue] Failed to get auth token:', e)
    }
    return null
  }

  /**
   * Clean up completed and rejected actions
   */
  cleanupCompletedActions() {
    const before = this.queue.length
    this.queue = this.queue.filter(a =>
      a.status === SyncStatus.PENDING ||
      a.status === SyncStatus.SYNCING
    )
    const removed = before - this.queue.length
    if (removed > 0) {
      console.log(`[OfflineQueue] Cleaned up ${removed} completed actions`)
      this.persist()
      this.notifyListeners()
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Subscribe to queue changes
   * @param {Function} callback - Called when queue changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Subscribe to reconciliation events
   * @param {Function} callback - Called when server result differs from local
   * @returns {Function} Unsubscribe function
   */
  onReconciliation(callback) {
    this.reconciliationListeners.add(callback)
    return () => this.reconciliationListeners.delete(callback)
  }

  /**
   * Notify all listeners of queue change
   */
  notifyListeners() {
    const state = {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      queueLength: this.getQueueLength(),
      queue: this.getQueue()
    }
    this.listeners.forEach(cb => {
      try {
        cb(state)
      } catch (e) {
        console.error('[OfflineQueue] Listener error:', e)
      }
    })
  }

  /**
   * Notify reconciliation listeners
   */
  notifyReconciliation(action, serverResult) {
    const event = {
      actionType: action.type,
      actionId: action.id,
      localResult: action.localResult,
      serverResult: serverResult,
      adjustments: serverResult.offlineReconciliation?.adjustments,
      timestamp: action.timestamp
    }

    console.log('[OfflineQueue] Reconciliation needed:', event)

    this.reconciliationListeners.forEach(cb => {
      try {
        cb(event)
      } catch (e) {
        console.error('[OfflineQueue] Reconciliation listener error:', e)
      }
    })
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get last sync timestamp
   */
  getLastSyncTime() {
    const timestamp = localStorage.getItem(LAST_SYNC_KEY)
    return timestamp ? parseInt(timestamp, 10) : null
  }

  /**
   * Check if there are actions needing attention
   */
  hasActionsNeedingAttention() {
    return this.queue.some(a =>
      a.status === SyncStatus.ADJUSTED ||
      a.status === SyncStatus.REJECTED
    )
  }

  /**
   * Get actions by status
   */
  getActionsByStatus(status) {
    return this.queue.filter(a => a.status === status)
  }

  /**
   * Get summary of queue state
   */
  getSummary() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pending: this.queue.filter(a => a.status === SyncStatus.PENDING).length,
      synced: this.queue.filter(a => a.status === SyncStatus.SYNCED).length,
      adjusted: this.queue.filter(a => a.status === SyncStatus.ADJUSTED).length,
      rejected: this.queue.filter(a => a.status === SyncStatus.REJECTED).length,
      total: this.queue.length,
      lastSync: this.getLastSyncTime()
    }
  }
}

// Export singleton instance
const offlineQueue = new OfflineQueueService()
export default offlineQueue

// Named exports for convenience
export { offlineQueue, OfflineQueueService }
