/**
 * UndoManager - Undo/Redo Stack for Reversible Actions
 *
 * Reversible actions:
 * - deposit/withdraw (bank)
 * - buy/sell (items)
 * - go (movement)
 * - trade
 * - hire/fire
 *
 * Non-reversible (tracked but can't undo):
 * - crime (outcomes are random)
 * - job (time-based)
 * - accept/decline (opportunities expire)
 *
 * Commands:
 * - undo [n]: Undo last n actions
 * - redo [n]: Redo last n undone actions
 * - history: Show action history
 * - history browse: Interactive history browser
 */

const STORAGE_KEY = 'streetLegacy_undoHistory'

// Maximum undo entries
const MAX_UNDO_ENTRIES = 50

// Action types
const ACTION_TYPES = {
  // Reversible
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  BUY: 'buy',
  SELL: 'sell',
  GO: 'go',
  TRADE: 'trade',
  HIRE: 'hire',
  FIRE: 'fire',

  // Non-reversible (tracked for history)
  CRIME: 'crime',
  JOB: 'job',
  ACCEPT: 'accept',
  DECLINE: 'decline',
  MESSAGE: 'message'
}

// Which actions can be undone
const REVERSIBLE_ACTIONS = [
  ACTION_TYPES.DEPOSIT,
  ACTION_TYPES.WITHDRAW,
  ACTION_TYPES.BUY,
  ACTION_TYPES.SELL,
  ACTION_TYPES.GO,
  ACTION_TYPES.TRADE,
  ACTION_TYPES.HIRE,
  ACTION_TYPES.FIRE
]

class UndoManagerClass {
  constructor() {
    this.undoStack = []
    this.redoStack = []
    this.history = []
    this.commandExecutor = null
    this.stateGetter = null
    this.listeners = []
    this.isInitialized = false
  }

  /**
   * Initialize the undo manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadHistory()
    this.isInitialized = true
    console.log('[UndoManager] Initialized')
  }

  /**
   * Set the command executor function
   */
  setCommandExecutor(executor) {
    this.commandExecutor = executor
  }

  /**
   * Set the state getter function
   */
  setStateGetter(getter) {
    this.stateGetter = getter
  }

  /**
   * Record an action for potential undo
   * @param {Object} action - Action details
   */
  recordAction(action) {
    const {
      type,
      command,
      description,
      reverseCommand,
      stateBefore,
      stateAfter,
      data
    } = action

    const entry = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      command,
      description: description || command,
      reverseCommand,
      stateBefore: stateBefore || this.captureState(),
      stateAfter: stateAfter || null,
      data,
      timestamp: Date.now(),
      canUndo: REVERSIBLE_ACTIONS.includes(type)
    }

    // Add to undo stack if reversible
    if (entry.canUndo && reverseCommand) {
      this.undoStack.push(entry)

      // Limit stack size
      if (this.undoStack.length > MAX_UNDO_ENTRIES) {
        this.undoStack.shift()
      }

      // Clear redo stack on new action
      this.redoStack = []
    }

    // Add to history
    this.history.unshift(entry)
    if (this.history.length > MAX_UNDO_ENTRIES * 2) {
      this.history.pop()
    }

    this.emit('actionRecorded', entry)
    this.saveHistory()

    return entry
  }

  /**
   * Capture current game state
   */
  captureState() {
    if (!this.stateGetter) return null

    try {
      const state = this.stateGetter()
      return {
        cash: state.player?.cash,
        level: state.player?.level,
        heat: state.player?.heat,
        energy: state.player?.energy,
        location: state.player?.current_district_id,
        inventory: state.player?.inventory ? [...state.player.inventory] : [],
        timestamp: Date.now()
      }
    } catch (e) {
      return null
    }
  }

  /**
   * Undo the last n actions
   * @param {number} count - Number of actions to undo
   * @returns {Promise<Object>} Result object
   */
  async undo(count = 1) {
    if (this.undoStack.length === 0) {
      return { success: false, message: 'Nothing to undo' }
    }

    const results = []
    const toUndo = Math.min(count, this.undoStack.length)

    for (let i = 0; i < toUndo; i++) {
      const action = this.undoStack.pop()

      if (action.reverseCommand && this.commandExecutor) {
        try {
          await this.commandExecutor(action.reverseCommand)
          results.push({ action, success: true })
          this.redoStack.push(action)
        } catch (e) {
          results.push({ action, success: false, error: e.message })
          // Put it back on the stack
          this.undoStack.push(action)
          break
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    this.emit('undoPerformed', { results, count: successCount })
    this.saveHistory()

    return {
      success: successCount > 0,
      message: `Undid ${successCount} action(s)`,
      results
    }
  }

  /**
   * Redo the last n undone actions
   * @param {number} count - Number of actions to redo
   * @returns {Promise<Object>} Result object
   */
  async redo(count = 1) {
    if (this.redoStack.length === 0) {
      return { success: false, message: 'Nothing to redo' }
    }

    const results = []
    const toRedo = Math.min(count, this.redoStack.length)

    for (let i = 0; i < toRedo; i++) {
      const action = this.redoStack.pop()

      if (action.command && this.commandExecutor) {
        try {
          await this.commandExecutor(action.command)
          results.push({ action, success: true })
          this.undoStack.push(action)
        } catch (e) {
          results.push({ action, success: false, error: e.message })
          // Put it back on the redo stack
          this.redoStack.push(action)
          break
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    this.emit('redoPerformed', { results, count: successCount })
    this.saveHistory()

    return {
      success: successCount > 0,
      message: `Redid ${successCount} action(s)`,
      results
    }
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0
  }

  /**
   * Get undo stack size
   */
  getUndoCount() {
    return this.undoStack.length
  }

  /**
   * Get redo stack size
   */
  getRedoCount() {
    return this.redoStack.length
  }

  /**
   * Get action history
   * @param {number} limit - Maximum entries to return
   */
  getHistory(limit = 20) {
    return this.history.slice(0, limit)
  }

  /**
   * Format history for display
   */
  formatHistory(limit = 20) {
    const entries = this.getHistory(limit)

    if (entries.length === 0) {
      return 'No action history'
    }

    const lines = ['Action History:', '']

    entries.forEach((entry, i) => {
      const time = this.formatTimeAgo(entry.timestamp)
      const undoable = entry.canUndo ? '[undoable]' : ''
      lines.push(`  ${i + 1}. ${entry.description} ${undoable}`)
      lines.push(`     ${time}`)
    })

    if (this.undoStack.length > 0) {
      lines.push('')
      lines.push(`${this.undoStack.length} action(s) can be undone`)
    }

    return lines.join('\n')
  }

  /**
   * Format time ago
   */
  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  /**
   * Get reverse command for an action type
   */
  static getReverseCommand(type, data) {
    switch (type) {
      case ACTION_TYPES.DEPOSIT:
        return `withdraw ${data.amount}`

      case ACTION_TYPES.WITHDRAW:
        return `deposit ${data.amount}`

      case ACTION_TYPES.BUY:
        return `sell ${data.item} ${data.quantity || 1}`

      case ACTION_TYPES.SELL:
        return `buy ${data.item} ${data.quantity || 1}`

      case ACTION_TYPES.GO:
        return data.previousLocation ? `go ${data.previousLocation}` : null

      case ACTION_TYPES.HIRE:
        return `fire ${data.npc}`

      case ACTION_TYPES.FIRE:
        return `hire ${data.npc}`

      default:
        return null
    }
  }

  /**
   * Create an action record helper
   */
  static createAction(type, command, data, description) {
    const reverseCommand = UndoManagerClass.getReverseCommand(type, data)
    return {
      type,
      command,
      reverseCommand,
      data,
      description: description || command
    }
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.undoStack = []
    this.redoStack = []
    this.history = []
    this.saveHistory()
    this.emit('historyCleared')
  }

  /**
   * Add listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Emit event
   */
  emit(event, data = {}) {
    this.listeners.forEach(l => {
      try {
        l(event, data)
      } catch (e) {
        console.error('[UndoManager] Listener error:', e)
      }
    })
  }

  /**
   * Save history to localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        history: this.history.slice(0, MAX_UNDO_ENTRIES),
        version: 1
      }))
    } catch (e) {
      console.warn('[UndoManager] Save failed:', e)
    }
  }

  /**
   * Load history from localStorage
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.history = data.history || []
        // Note: undo/redo stacks are not persisted as they depend on current session
      }
    } catch (e) {
      console.warn('[UndoManager] Load failed:', e)
      this.history = []
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      historyCount: this.history.length
    }
  }
}

// Singleton instance
export const undoManager = new UndoManagerClass()

// Export constants and class
export { ACTION_TYPES, REVERSIBLE_ACTIONS }

export default undoManager
