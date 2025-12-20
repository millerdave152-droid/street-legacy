/**
 * TerminalManager - Core terminal state and logic
 * Singleton managing all terminal interactions for THE CONSOLE
 */

import { commandRegistry } from '../terminal/CommandRegistry'
import { parseCommand } from '../terminal/CommandParser'

// Output line types for styling
export const OUTPUT_TYPES = {
  COMMAND: 'command',      // User-entered commands (green)
  RESPONSE: 'response',    // Normal response text
  ERROR: 'error',          // Error messages (red)
  SYSTEM: 'system',        // System messages (:: prefix)
  SUCCESS: 'success',      // Success messages (green)
  WARNING: 'warning',      // Warning messages (amber)
  HANDLER: 'handler',      // Handler messages ([FIXER] etc)
  SARAH: 'sarah',          // S.A.R.A.H. AI assistant (cyan)
}

class TerminalManager {
  constructor() {
    // Output buffer - array of { text, type, timestamp }
    this.outputBuffer = []
    this.maxOutputLines = 500 // Maximum history

    // Input state
    this.inputBuffer = ''
    this.cursorPosition = 0

    // Command history (for up/down arrows)
    this.commandHistory = []
    this.historyIndex = -1
    this.maxHistory = 50

    // Terminal state
    this.isActive = false
    this.isVisible = true

    // Scroll state
    this.scrollOffset = 0

    // Scene listeners for UI updates
    this.listeners = []

    // Current scene reference (for navigation commands)
    this.currentScene = null

    // Initialize with welcome message
    this.addWelcomeMessage()
  }

  /**
   * Add welcome message on first load
   */
  addWelcomeMessage() {
    const savedHistory = this.loadHistory()
    if (savedHistory.length === 0) {
      this.addOutput(':: THE CONSOLE initialized', OUTPUT_TYPES.SYSTEM)
      this.addOutput(':: Type "help" for available commands', OUTPUT_TYPES.SYSTEM)
    }
  }

  /**
   * Set the current active scene (for navigation)
   */
  setCurrentScene(scene) {
    this.currentScene = scene
  }

  /**
   * Add a listener for terminal updates
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Notify all listeners of an update
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data)
      } catch (e) {
        console.error('[TerminalManager] Listener error:', e)
      }
    })
  }

  /**
   * Focus the terminal (activate input)
   */
  focus() {
    this.isActive = true
    this.notifyListeners('focus')
  }

  /**
   * Blur the terminal (deactivate input)
   */
  blur() {
    this.isActive = false
    this.notifyListeners('blur')
  }

  /**
   * Toggle terminal visibility
   */
  toggle() {
    this.isVisible = !this.isVisible
    this.notifyListeners('toggle', { visible: this.isVisible })
    return this.isVisible
  }

  /**
   * Show the terminal
   */
  show() {
    this.isVisible = true
    this.notifyListeners('show')
  }

  /**
   * Hide the terminal
   */
  hide() {
    this.isVisible = false
    this.blur()
    this.notifyListeners('hide')
  }

  /**
   * Process a keyboard input
   */
  processInput(key, event = null) {
    if (!this.isActive) return

    switch (key) {
      case 'Enter':
        this.executeCurrentInput()
        break

      case 'Backspace':
        if (this.cursorPosition > 0) {
          this.inputBuffer =
            this.inputBuffer.slice(0, this.cursorPosition - 1) +
            this.inputBuffer.slice(this.cursorPosition)
          this.cursorPosition--
          this.notifyListeners('input', { input: this.inputBuffer, cursor: this.cursorPosition })
        }
        break

      case 'Delete':
        if (this.cursorPosition < this.inputBuffer.length) {
          this.inputBuffer =
            this.inputBuffer.slice(0, this.cursorPosition) +
            this.inputBuffer.slice(this.cursorPosition + 1)
          this.notifyListeners('input', { input: this.inputBuffer, cursor: this.cursorPosition })
        }
        break

      case 'ArrowLeft':
        if (this.cursorPosition > 0) {
          this.cursorPosition--
          this.notifyListeners('cursor', { cursor: this.cursorPosition })
        }
        break

      case 'ArrowRight':
        if (this.cursorPosition < this.inputBuffer.length) {
          this.cursorPosition++
          this.notifyListeners('cursor', { cursor: this.cursorPosition })
        }
        break

      case 'ArrowUp':
        this.navigateHistory(-1)
        break

      case 'ArrowDown':
        this.navigateHistory(1)
        break

      case 'Home':
        this.cursorPosition = 0
        this.notifyListeners('cursor', { cursor: this.cursorPosition })
        break

      case 'End':
        this.cursorPosition = this.inputBuffer.length
        this.notifyListeners('cursor', { cursor: this.cursorPosition })
        break

      case 'Tab':
        this.handleAutocomplete()
        if (event) event.preventDefault()
        break

      case 'Escape':
        this.blur()
        break

      default:
        // Only add printable characters
        if (key.length === 1 && this.inputBuffer.length < 200) {
          this.inputBuffer =
            this.inputBuffer.slice(0, this.cursorPosition) +
            key +
            this.inputBuffer.slice(this.cursorPosition)
          this.cursorPosition++
          this.historyIndex = -1 // Reset history navigation
          this.notifyListeners('input', { input: this.inputBuffer, cursor: this.cursorPosition })
        }
        break
    }
  }

  /**
   * Navigate through command history
   */
  navigateHistory(direction) {
    if (this.commandHistory.length === 0) return

    const newIndex = this.historyIndex + direction

    if (newIndex < -1) return
    if (newIndex >= this.commandHistory.length) return

    this.historyIndex = newIndex

    if (this.historyIndex === -1) {
      // Back to current input
      this.inputBuffer = ''
    } else {
      this.inputBuffer = this.commandHistory[this.historyIndex]
    }

    this.cursorPosition = this.inputBuffer.length
    this.notifyListeners('input', { input: this.inputBuffer, cursor: this.cursorPosition })
  }

  /**
   * Handle tab autocomplete
   */
  handleAutocomplete() {
    const input = this.inputBuffer.trim()
    if (input.length < 2) return

    const suggestions = commandRegistry.getSuggestions(input)

    if (suggestions.length === 1) {
      // Single match - complete it
      const parts = input.split(' ')
      if (parts.length === 1) {
        // Completing command name
        this.inputBuffer = suggestions[0] + ' '
      } else {
        // Completing argument
        parts[parts.length - 1] = suggestions[0]
        this.inputBuffer = parts.join(' ') + ' '
      }
      this.cursorPosition = this.inputBuffer.length
      this.notifyListeners('input', { input: this.inputBuffer, cursor: this.cursorPosition })
    } else if (suggestions.length > 1) {
      // Multiple matches - show them
      this.notifyListeners('suggestions', { suggestions })
    }
  }

  /**
   * Execute the current input buffer
   */
  async executeCurrentInput() {
    const input = this.inputBuffer.trim()

    if (!input) return

    // Add to history
    if (this.commandHistory[0] !== input) {
      this.commandHistory.unshift(input)
      if (this.commandHistory.length > this.maxHistory) {
        this.commandHistory.pop()
      }
      this.saveHistory()
    }

    // Clear input
    this.inputBuffer = ''
    this.cursorPosition = 0
    this.historyIndex = -1
    this.notifyListeners('input', { input: '', cursor: 0 })

    // Show command in output
    this.addOutput(`> ${input}`, OUTPUT_TYPES.COMMAND)

    // Parse and execute
    try {
      const parsed = parseCommand(input)
      const result = await commandRegistry.execute(parsed, this)

      if (result) {
        if (result.error) {
          this.addOutput(result.message || result.error, OUTPUT_TYPES.ERROR)
        } else if (result.output) {
          // Handle array of output lines
          const lines = Array.isArray(result.output) ? result.output : [result.output]
          lines.forEach(line => {
            if (typeof line === 'object') {
              this.addOutput(line.text, line.type || OUTPUT_TYPES.RESPONSE)
            } else {
              this.addOutput(line, result.type || OUTPUT_TYPES.RESPONSE)
            }
          })
        }
      }
    } catch (error) {
      console.error('[TerminalManager] Command error:', error)
      this.addOutput(`Error: ${error.message}`, OUTPUT_TYPES.ERROR)
    }
  }

  /**
   * Execute a command string directly (programmatic)
   */
  async executeCommand(commandString) {
    const input = commandString.trim()
    if (!input) return

    this.addOutput(`> ${input}`, OUTPUT_TYPES.COMMAND)

    try {
      const parsed = parseCommand(input)
      return await commandRegistry.execute(parsed, this)
    } catch (error) {
      this.addOutput(`Error: ${error.message}`, OUTPUT_TYPES.ERROR)
      return { error: error.message }
    }
  }

  /**
   * Add output line to buffer
   */
  addOutput(text, type = OUTPUT_TYPES.RESPONSE) {
    const line = {
      text,
      type,
      timestamp: Date.now()
    }

    this.outputBuffer.push(line)

    // Trim if over max
    if (this.outputBuffer.length > this.maxOutputLines) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxOutputLines)
    }

    // Reset scroll to bottom
    this.scrollOffset = 0

    this.notifyListeners('output', { line })
    this.saveOutput()
  }

  /**
   * Add a system message (:: prefix style)
   */
  addSystemMessage(text) {
    this.addOutput(`:: ${text}`, OUTPUT_TYPES.SYSTEM)
  }

  /**
   * Add a handler message ([HANDLER] style)
   */
  addHandlerMessage(handler, text) {
    this.addOutput(`[${handler.toUpperCase()}] ${text}`, OUTPUT_TYPES.HANDLER)
  }

  /**
   * Get visible output lines
   */
  getVisibleOutput(lineCount = 10) {
    const start = Math.max(0, this.outputBuffer.length - lineCount - this.scrollOffset)
    const end = this.outputBuffer.length - this.scrollOffset
    return this.outputBuffer.slice(start, end)
  }

  /**
   * Get all output
   */
  getAllOutput() {
    return [...this.outputBuffer]
  }

  /**
   * Scroll output
   */
  scrollOutput(delta) {
    const maxScroll = Math.max(0, this.outputBuffer.length - 10)
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + delta))
    this.notifyListeners('scroll', { offset: this.scrollOffset })
  }

  /**
   * Clear output buffer
   */
  clearOutput() {
    this.outputBuffer = []
    this.scrollOffset = 0
    this.addOutput(':: Terminal cleared', OUTPUT_TYPES.SYSTEM)
    this.notifyListeners('clear')
  }

  /**
   * Get current input
   */
  getInput() {
    return this.inputBuffer
  }

  /**
   * Get cursor position
   */
  getCursorPosition() {
    return this.cursorPosition
  }

  /**
   * Save command history to localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem('terminal_history', JSON.stringify(this.commandHistory))
    } catch (e) {
      console.warn('[TerminalManager] Failed to save history:', e)
    }
  }

  /**
   * Load command history from localStorage
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem('terminal_history')
      if (saved) {
        this.commandHistory = JSON.parse(saved)
      }
    } catch (e) {
      console.warn('[TerminalManager] Failed to load history:', e)
    }
    return this.commandHistory
  }

  /**
   * Save output to localStorage (for persistence across sessions)
   */
  saveOutput() {
    try {
      // Only save last 50 lines
      const toSave = this.outputBuffer.slice(-50)
      localStorage.setItem('terminal_output', JSON.stringify(toSave))
    } catch (e) {
      // Ignore save errors
    }
  }

  /**
   * Load saved output from localStorage
   */
  loadOutput() {
    try {
      const saved = localStorage.getItem('terminal_output')
      if (saved) {
        this.outputBuffer = JSON.parse(saved)
      }
    } catch (e) {
      // Ignore load errors
    }
    return this.outputBuffer
  }

  /**
   * Initialize terminal (load saved state)
   */
  initialize() {
    this.loadHistory()
    this.loadOutput()
    console.log('[TerminalManager] Initialized with', this.outputBuffer.length, 'lines,', this.commandHistory.length, 'history items')
  }
}

// Singleton instance
export const terminalManager = new TerminalManager()

export default terminalManager
