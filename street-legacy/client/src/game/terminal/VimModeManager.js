/**
 * VimModeManager - Modal Editing for Terminal (Opt-in)
 *
 * Modes:
 * - NORMAL: Navigation (j/k scroll, gg/G jump, / search)
 * - INSERT: Standard typing (default)
 * - COMMAND: :commands (:w, :q, :set, :macro)
 * - VISUAL: Text selection (future)
 *
 * Key Mappings:
 * - Escape: Return to NORMAL mode
 * - i, a: Enter INSERT mode
 * - :: Enter COMMAND mode
 * - /: Search mode
 * - j/k: Scroll up/down
 * - gg/G: Jump to top/bottom
 */

const STORAGE_KEY = 'streetLegacy_vimMode'

// Vim modes
const MODES = {
  NORMAL: 'NORMAL',
  INSERT: 'INSERT',
  COMMAND: 'COMMAND',
  VISUAL: 'VISUAL',
  SEARCH: 'SEARCH'
}

// Mode colors for status display
const MODE_COLORS = {
  [MODES.NORMAL]: '#00ff41',
  [MODES.INSERT]: '#3b82f6',
  [MODES.COMMAND]: '#f59e0b',
  [MODES.VISUAL]: '#8b5cf6',
  [MODES.SEARCH]: '#06b6d4'
}

// Default key bindings
const DEFAULT_BINDINGS = {
  // Mode switching
  'Escape': { action: 'toNormal', modes: ['INSERT', 'COMMAND', 'VISUAL', 'SEARCH'] },
  'i': { action: 'toInsert', modes: ['NORMAL'] },
  'a': { action: 'toInsertAfter', modes: ['NORMAL'] },
  'A': { action: 'toInsertEnd', modes: ['NORMAL'] },
  'I': { action: 'toInsertStart', modes: ['NORMAL'] },
  ':': { action: 'toCommand', modes: ['NORMAL'] },
  '/': { action: 'toSearch', modes: ['NORMAL'] },
  'v': { action: 'toVisual', modes: ['NORMAL'] },

  // Navigation (NORMAL mode)
  'j': { action: 'scrollDown', modes: ['NORMAL'] },
  'k': { action: 'scrollUp', modes: ['NORMAL'] },
  'h': { action: 'cursorLeft', modes: ['NORMAL'] },
  'l': { action: 'cursorRight', modes: ['NORMAL'] },
  'w': { action: 'wordForward', modes: ['NORMAL'] },
  'b': { action: 'wordBackward', modes: ['NORMAL'] },
  '0': { action: 'lineStart', modes: ['NORMAL'] },
  '$': { action: 'lineEnd', modes: ['NORMAL'] },
  'gg': { action: 'jumpTop', modes: ['NORMAL'] },
  'G': { action: 'jumpBottom', modes: ['NORMAL'] },

  // Editing (NORMAL mode)
  'x': { action: 'deleteChar', modes: ['NORMAL'] },
  'dd': { action: 'deleteLine', modes: ['NORMAL'] },
  'dw': { action: 'deleteWord', modes: ['NORMAL'] },
  'D': { action: 'deleteToEnd', modes: ['NORMAL'] },
  'u': { action: 'undo', modes: ['NORMAL'] },
  'Ctrl+r': { action: 'redo', modes: ['NORMAL'] },
  'yy': { action: 'yankLine', modes: ['NORMAL'] },
  'p': { action: 'paste', modes: ['NORMAL'] },

  // History navigation
  'Ctrl+p': { action: 'historyPrev', modes: ['NORMAL', 'INSERT'] },
  'Ctrl+n': { action: 'historyNext', modes: ['NORMAL', 'INSERT'] },

  // Search
  'n': { action: 'searchNext', modes: ['NORMAL'] },
  'N': { action: 'searchPrev', modes: ['NORMAL'] },

  // Command mode confirmations
  'Enter': { action: 'executeCommand', modes: ['COMMAND', 'SEARCH'] }
}

// Built-in command mode commands
const COMMAND_HANDLERS = {
  'q': { handler: (vm) => vm.emit('quit'), description: 'Quit' },
  'w': { handler: (vm) => vm.emit('save'), description: 'Save' },
  'wq': { handler: (vm) => { vm.emit('save'); vm.emit('quit') }, description: 'Save and quit' },
  'set': { handler: (vm, args) => vm.handleSet(args), description: 'Set option' },
  'help': { handler: (vm) => vm.showHelp(), description: 'Show help' },
  'noh': { handler: (vm) => vm.clearSearch(), description: 'Clear search highlight' },
  'macro': { handler: (vm, args) => vm.handleMacro(args), description: 'Macro commands' },
  'clear': { handler: (vm) => vm.emit('clear'), description: 'Clear terminal' },
  'history': { handler: (vm) => vm.emit('history'), description: 'Show history' }
}

class VimModeManagerClass {
  constructor() {
    this.enabled = false
    this.mode = MODES.INSERT  // Default to INSERT for non-vim users
    this.commandBuffer = ''
    this.searchQuery = ''
    this.yankBuffer = ''
    this.keySequence = ''
    this.keySequenceTimer = null
    this.listeners = []
    this.customBindings = {}
    this.isInitialized = false
  }

  /**
   * Initialize vim mode
   */
  initialize() {
    if (this.isInitialized) return

    this.loadSettings()
    this.isInitialized = true
    console.log('[VimModeManager] Initialized - Enabled:', this.enabled)
  }

  /**
   * Enable vim mode
   */
  enable() {
    this.enabled = true
    this.mode = MODES.NORMAL
    this.saveSettings()
    this.emit('modeChange', { mode: this.mode, enabled: true })
    console.log('[VimModeManager] Vim mode enabled')
  }

  /**
   * Disable vim mode
   */
  disable() {
    this.enabled = false
    this.mode = MODES.INSERT
    this.saveSettings()
    this.emit('modeChange', { mode: this.mode, enabled: false })
    console.log('[VimModeManager] Vim mode disabled')
  }

  /**
   * Toggle vim mode
   */
  toggle() {
    if (this.enabled) {
      this.disable()
    } else {
      this.enable()
    }
  }

  /**
   * Check if vim mode is enabled
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.mode
  }

  /**
   * Get mode display info
   */
  getModeDisplay() {
    if (!this.enabled) {
      return null
    }

    return {
      mode: this.mode,
      color: MODE_COLORS[this.mode],
      commandBuffer: this.mode === MODES.COMMAND ? ':' + this.commandBuffer : null,
      searchQuery: this.mode === MODES.SEARCH ? '/' + this.searchQuery : null
    }
  }

  /**
   * Handle keydown event
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {boolean} True if event was handled
   */
  handleKeyDown(event) {
    if (!this.enabled) return false

    const key = this.getKeyString(event)

    // Build key sequence for multi-key commands
    this.keySequence += key

    // Clear sequence after timeout
    if (this.keySequenceTimer) {
      clearTimeout(this.keySequenceTimer)
    }
    this.keySequenceTimer = setTimeout(() => {
      this.keySequence = ''
    }, 500)

    // Check for matching binding
    const binding = this.findBinding(this.keySequence) || this.findBinding(key)

    if (binding && binding.modes.includes(this.mode)) {
      event.preventDefault()
      this.executeAction(binding.action, event)
      this.keySequence = ''
      return true
    }

    // Handle mode-specific input
    if (this.mode === MODES.COMMAND) {
      return this.handleCommandModeInput(event)
    }

    if (this.mode === MODES.SEARCH) {
      return this.handleSearchModeInput(event)
    }

    // In INSERT mode, let input through
    if (this.mode === MODES.INSERT) {
      return false
    }

    // In NORMAL mode, block most keys
    if (this.mode === MODES.NORMAL) {
      // Allow through if it's a number (for counts)
      if (/^\d$/.test(key)) {
        this.keySequence = key
        return true
      }
      return true  // Block other keys in NORMAL mode
    }

    return false
  }

  /**
   * Get key string from event
   */
  getKeyString(event) {
    let key = event.key

    // Handle modifiers
    if (event.ctrlKey && key !== 'Control') {
      key = 'Ctrl+' + key
    }
    if (event.altKey && key !== 'Alt') {
      key = 'Alt+' + key
    }
    if (event.metaKey && key !== 'Meta') {
      key = 'Meta+' + key
    }

    return key
  }

  /**
   * Find binding for key or sequence
   */
  findBinding(keyOrSequence) {
    // Check custom bindings first
    if (this.customBindings[keyOrSequence]) {
      return this.customBindings[keyOrSequence]
    }
    return DEFAULT_BINDINGS[keyOrSequence]
  }

  /**
   * Execute an action
   */
  executeAction(action, event) {
    switch (action) {
      // Mode switching
      case 'toNormal':
        this.setMode(MODES.NORMAL)
        break
      case 'toInsert':
        this.setMode(MODES.INSERT)
        break
      case 'toInsertAfter':
        this.emit('cursorRight')
        this.setMode(MODES.INSERT)
        break
      case 'toInsertEnd':
        this.emit('lineEnd')
        this.setMode(MODES.INSERT)
        break
      case 'toInsertStart':
        this.emit('lineStart')
        this.setMode(MODES.INSERT)
        break
      case 'toCommand':
        this.setMode(MODES.COMMAND)
        this.commandBuffer = ''
        break
      case 'toSearch':
        this.setMode(MODES.SEARCH)
        this.searchQuery = ''
        break
      case 'toVisual':
        this.setMode(MODES.VISUAL)
        break

      // Navigation
      case 'scrollDown':
        this.emit('scrollDown')
        break
      case 'scrollUp':
        this.emit('scrollUp')
        break
      case 'cursorLeft':
        this.emit('cursorLeft')
        break
      case 'cursorRight':
        this.emit('cursorRight')
        break
      case 'wordForward':
        this.emit('wordForward')
        break
      case 'wordBackward':
        this.emit('wordBackward')
        break
      case 'lineStart':
        this.emit('lineStart')
        break
      case 'lineEnd':
        this.emit('lineEnd')
        break
      case 'jumpTop':
        this.emit('jumpTop')
        break
      case 'jumpBottom':
        this.emit('jumpBottom')
        break

      // Editing
      case 'deleteChar':
        this.emit('deleteChar')
        break
      case 'deleteLine':
        this.emit('deleteLine')
        break
      case 'deleteWord':
        this.emit('deleteWord')
        break
      case 'deleteToEnd':
        this.emit('deleteToEnd')
        break
      case 'undo':
        this.emit('undo')
        break
      case 'redo':
        this.emit('redo')
        break
      case 'yankLine':
        this.emit('yankLine')
        break
      case 'paste':
        this.emit('paste', { text: this.yankBuffer })
        break

      // History
      case 'historyPrev':
        this.emit('historyPrev')
        break
      case 'historyNext':
        this.emit('historyNext')
        break

      // Search
      case 'searchNext':
        this.emit('searchNext', { query: this.searchQuery })
        break
      case 'searchPrev':
        this.emit('searchPrev', { query: this.searchQuery })
        break

      // Command execution
      case 'executeCommand':
        if (this.mode === MODES.COMMAND) {
          this.executeCommandBuffer()
        } else if (this.mode === MODES.SEARCH) {
          this.executeSearch()
        }
        break
    }
  }

  /**
   * Set current mode
   */
  setMode(newMode) {
    const oldMode = this.mode
    this.mode = newMode
    this.emit('modeChange', { mode: newMode, previousMode: oldMode })
  }

  /**
   * Handle input in COMMAND mode
   */
  handleCommandModeInput(event) {
    if (event.key === 'Backspace') {
      this.commandBuffer = this.commandBuffer.slice(0, -1)
      if (this.commandBuffer.length === 0) {
        this.setMode(MODES.NORMAL)
      }
      this.emit('commandBufferChange', { buffer: this.commandBuffer })
      return true
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      this.commandBuffer += event.key
      this.emit('commandBufferChange', { buffer: this.commandBuffer })
      return true
    }

    return false
  }

  /**
   * Handle input in SEARCH mode
   */
  handleSearchModeInput(event) {
    if (event.key === 'Backspace') {
      this.searchQuery = this.searchQuery.slice(0, -1)
      if (this.searchQuery.length === 0) {
        this.setMode(MODES.NORMAL)
      }
      this.emit('searchQueryChange', { query: this.searchQuery })
      return true
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      this.searchQuery += event.key
      this.emit('searchQueryChange', { query: this.searchQuery })
      // Live search
      this.emit('searchLive', { query: this.searchQuery })
      return true
    }

    return false
  }

  /**
   * Execute command buffer
   */
  executeCommandBuffer() {
    const parts = this.commandBuffer.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    if (COMMAND_HANDLERS[cmd]) {
      COMMAND_HANDLERS[cmd].handler(this, args)
    } else {
      this.emit('commandError', { command: cmd, message: `Unknown command: ${cmd}` })
    }

    this.commandBuffer = ''
    this.setMode(MODES.NORMAL)
  }

  /**
   * Execute search
   */
  executeSearch() {
    this.emit('search', { query: this.searchQuery })
    this.setMode(MODES.NORMAL)
  }

  /**
   * Handle :set command
   */
  handleSet(args) {
    if (args.length === 0) {
      this.emit('showSettings')
      return
    }

    const setting = args[0]
    const value = args[1]

    // Handle boolean toggles
    if (setting.startsWith('no')) {
      this.emit('setSetting', { key: setting.slice(2), value: false })
    } else if (!value) {
      this.emit('setSetting', { key: setting, value: true })
    } else {
      this.emit('setSetting', { key: setting, value })
    }
  }

  /**
   * Handle :macro command
   */
  handleMacro(args) {
    this.emit('macro', { action: args[0], name: args[1], content: args.slice(2).join(' ') })
  }

  /**
   * Show help
   */
  showHelp() {
    const help = [
      '=== Vim Mode Help ===',
      '',
      'Modes:',
      '  NORMAL  - Navigation (default when vim enabled)',
      '  INSERT  - Text input (i to enter)',
      '  COMMAND - Ex commands (: to enter)',
      '  SEARCH  - Search (/ to enter)',
      '',
      'Normal Mode:',
      '  i/a     - Enter INSERT mode',
      '  :       - Enter COMMAND mode',
      '  /       - Enter SEARCH mode',
      '  j/k     - Scroll down/up',
      '  h/l     - Cursor left/right',
      '  gg/G    - Jump to top/bottom',
      '  u       - Undo',
      '  Ctrl+r  - Redo',
      '',
      'Commands:',
      '  :q      - Quit',
      '  :help   - Show help',
      '  :set    - Show/change settings',
      '  :clear  - Clear terminal'
    ]

    this.emit('showHelp', { lines: help })
  }

  /**
   * Clear search highlighting
   */
  clearSearch() {
    this.searchQuery = ''
    this.emit('clearSearch')
  }

  /**
   * Set yank buffer
   */
  setYankBuffer(text) {
    this.yankBuffer = text
  }

  /**
   * Add custom key binding
   */
  addBinding(key, action, modes = ['NORMAL']) {
    this.customBindings[key] = { action, modes }
  }

  /**
   * Remove custom key binding
   */
  removeBinding(key) {
    delete this.customBindings[key]
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data = {}) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data)
      } catch (e) {
        console.error('[VimModeManager] Listener error:', e)
      }
    })
  }

  /**
   * Save settings
   */
  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: this.enabled,
        customBindings: this.customBindings
      }))
    } catch (e) {
      console.warn('[VimModeManager] Save failed:', e)
    }
  }

  /**
   * Load settings
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.enabled = data.enabled || false
        this.customBindings = data.customBindings || {}
        if (this.enabled) {
          this.mode = MODES.NORMAL
        }
      }
    } catch (e) {
      console.warn('[VimModeManager] Load failed:', e)
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      enabled: this.enabled,
      currentMode: this.mode,
      customBindings: Object.keys(this.customBindings).length
    }
  }
}

// Singleton instance
export const vimModeManager = new VimModeManagerClass()

// Export constants
export { MODES, MODE_COLORS, DEFAULT_BINDINGS }

export default vimModeManager
