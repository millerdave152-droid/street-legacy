/**
 * TerminalManager - Core terminal state and logic
 * Singleton managing all terminal interactions for THE CONSOLE
 */

import { commandRegistry } from '../terminal/CommandRegistry'
import { parseCommand } from '../terminal/CommandParser'
import { inputRouter } from '../terminal/InputRouter'
import { conversationalSarah } from '../sarah/ConversationalSarah'
import { adventureEngine } from '../adventure/AdventureEngine'
import { opportunityManager } from '../opportunity/OpportunityManager'
import { audioManager } from './AudioManager'

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

  // S.A.R.A.H. enhanced output types
  SARAH_HEADER: 'sarah_header',       // Panel header (bright cyan)
  SARAH_STAT: 'sarah_stat',           // Stat line with bar
  SARAH_STAT_GOOD: 'sarah_stat_good', // Good stat (green)
  SARAH_STAT_WARN: 'sarah_stat_warn', // Warning stat (amber)
  SARAH_STAT_CRIT: 'sarah_stat_crit', // Critical stat (red)
  SARAH_RECOMMEND: 'sarah_recommend', // Recommendation arrow
  SARAH_WARNING: 'sarah_warning',     // S.A.R.A.H. warning (amber)
  SARAH_CRITICAL: 'sarah_critical',   // Critical alert (red pulsing)
  SARAH_INTEL: 'sarah_intel',         // AI intel (purple)
  SARAH_THREAT: 'sarah_threat',       // Threat warning (red)

  // NPC messaging output types
  NPC_INTEL: 'npc_intel',             // Intel messages (cyan)
  NPC_DEAL: 'npc_deal',               // Deal/trade offers (green)
  NPC_JOB: 'npc_job',                 // Job offers (amber)
  NPC_WARNING: 'npc_warning',         // NPC warnings (orange)
  NPC_URGENT: 'npc_urgent',           // Urgent messages (red)
  NPC_BETRAYAL: 'npc_betrayal',       // Betrayal events (red pulse)
  NPC_SCAM: 'npc_scam',               // Scam messages (hidden as green)
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

    // Display options
    this.showTimestamps = false

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
        // Execute async and catch any errors
        this.executeCurrentInput().catch(err => {
          console.error('[TerminalManager] executeCurrentInput error:', err)
        })
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
        if (event && event.ctrlKey) {
          // Ctrl+Home: scroll to top
          this.scrollToTop()
        } else {
          this.cursorPosition = 0
          this.notifyListeners('cursor', { cursor: this.cursorPosition })
        }
        break

      case 'End':
        if (event && event.ctrlKey) {
          // Ctrl+End: scroll to bottom
          this.scrollToBottom()
        } else {
          this.cursorPosition = this.inputBuffer.length
          this.notifyListeners('cursor', { cursor: this.cursorPosition })
        }
        break

      case 'Tab':
        this.handleAutocomplete()
        if (event) event.preventDefault()
        break

      case 'PageUp':
        this.scrollOutput(5)  // Scroll up (increase offset)
        break

      case 'PageDown':
        this.scrollOutput(-5)  // Scroll down (decrease offset)
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
   * Uses InputRouter for smart command vs conversation detection
   */
  async executeCurrentInput() {
    console.log('[TerminalManager] executeCurrentInput called, buffer:', this.inputBuffer)
    const input = this.inputBuffer.trim()

    if (!input) {
      console.log('[TerminalManager] Empty input, returning')
      return
    }

    // TEMPORARY DEBUG: Show alert to confirm execution
    console.log('[TerminalManager] Processing input:', input)
    console.log('[TerminalManager] outputBuffer length before:', this.outputBuffer.length)

    // Play command submit sound
    audioManager.playClick()

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

    // Show input in output
    this.addOutput(`> ${input}`, OUTPUT_TYPES.COMMAND)

    // Route input through smart classification
    try {
      const routing = await inputRouter.route(input, this)
      console.log('[TerminalManager] Input routed as:', routing.type, routing)

      switch (routing.type) {
        case 'adventure':
          // Active adventure - route to adventure engine
          const advResult = adventureEngine.processInput(routing.data)
          if (advResult.output) {
            advResult.output.forEach(line => {
              this.addOutput(line, OUTPUT_TYPES.RESPONSE)
            })
          }
          if (advResult.error) {
            audioManager.playError()
            this.addOutput(advResult.error, OUTPUT_TYPES.ERROR)
          }
          break

        case 'opportunity_response':
          // Responding to an opportunity
          const oppData = routing.data
          const opp = opportunityManager.getOpportunityByIndex(oppData.index)
          if (!opp) {
            audioManager.playError()
            this.addOutput(`No opportunity #${oppData.index} found. Type 'opportunities' to see available.`, OUTPUT_TYPES.ERROR)
          } else if (!oppData.response) {
            // Just viewing the opportunity
            this.addOutput(`[${opp.npcName}] "${opp.message}"`, OUTPUT_TYPES.HANDLER)
            this.addOutput(`Type: respond ${oppData.index} yes/no`, OUTPUT_TYPES.SYSTEM)
          } else {
            // Actually responding
            const oppResult = opportunityManager.respond(opp.id, oppData.response)
            if (oppResult.success) {
              this.addOutput(oppResult.message || 'Response recorded.', OUTPUT_TYPES.SUCCESS)
              // Check if adventure should start
              if (oppResult.adventureStart && oppResult.adventureId) {
                const advStart = adventureEngine.startAdventure(oppResult.adventureId)
                if (advStart.output) {
                  advStart.output.forEach(line => {
                    this.addOutput(line, OUTPUT_TYPES.RESPONSE)
                  })
                }
              }
            } else {
              audioManager.playError()
              this.addOutput(oppResult.error || 'Failed to respond.', OUTPUT_TYPES.ERROR)
            }
          }
          break

        case 'command':
          // Direct command execution (existing path)
          await this.executeDirectCommand(input)
          break

        case 'nl_command':
          // Natural language mapped to command
          if (routing.echo) {
            this.addOutput(`[S.A.R.A.H.] ${routing.echo}`, OUTPUT_TYPES.SARAH)
          }
          await this.executeDirectCommand(routing.data)
          break

        case 'conversation':
        case 'ambiguous':
          // Conversational query - S.A.R.A.H. handles it
          console.log('[TerminalManager] Routing to S.A.R.A.H.')
          const response = await conversationalSarah.processInput(input, this)
          console.log('[TerminalManager] S.A.R.A.H. response:', response)
          this.handleSarahResponse(response)
          break

        case 'empty':
          // Empty input - ignore
          break

        default:
          // Fallback to conversation
          const fallbackResponse = await conversationalSarah.processInput(input, this)
          this.handleSarahResponse(fallbackResponse)
      }
    } catch (error) {
      console.error('[TerminalManager] Input processing error:', error)
      audioManager.playError()
      this.addOutput(`Error: ${error.message}`, OUTPUT_TYPES.ERROR)
    }
  }

  /**
   * Execute a direct command (internal helper)
   */
  async executeDirectCommand(commandString) {
    console.log('[TerminalManager] executeDirectCommand:', commandString)
    try {
      const parsed = parseCommand(commandString)
      console.log('[TerminalManager] parsed:', parsed)
      const result = await commandRegistry.execute(parsed, this)
      console.log('[TerminalManager] result:', result)

      if (result) {
        if (result.error) {
          console.log('[TerminalManager] result has error')
          audioManager.playError()
          this.addOutput(result.message || result.error, OUTPUT_TYPES.ERROR)
        } else if (result.output) {
          console.log('[TerminalManager] result has output, lines:', result.output.length)
          const lines = Array.isArray(result.output) ? result.output : [result.output]
          lines.forEach(line => {
            if (typeof line === 'object') {
              console.log('[TerminalManager] adding line:', line.text?.substring(0, 50))
              this.addOutput(line.text, line.type || OUTPUT_TYPES.RESPONSE)
            } else {
              this.addOutput(line, result.type || OUTPUT_TYPES.RESPONSE)
            }
          })
        } else {
          console.log('[TerminalManager] result has no output or error')
        }
      } else {
        console.log('[TerminalManager] no result returned')
      }
    } catch (error) {
      console.error('[TerminalManager] Command error:', error)
      audioManager.playError()
      this.addOutput(`Error: ${error.message}`, OUTPUT_TYPES.ERROR)
    }
  }

  /**
   * Handle S.A.R.A.H. response output
   */
  handleSarahResponse(response) {
    if (response && response.output) {
      const lines = Array.isArray(response.output) ? response.output : [response.output]
      lines.forEach(line => {
        if (typeof line === 'object') {
          this.addOutput(line.text, line.type || OUTPUT_TYPES.SARAH)
        } else {
          this.addOutput(line, OUTPUT_TYPES.SARAH)
        }
      })
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
   * Add output line to buffer with automatic text wrapping
   * Long lines are pre-split to prevent rendering issues
   */
  addOutput(text, type = OUTPUT_TYPES.RESPONSE) {
    console.log('[TerminalManager] addOutput:', text?.substring(0, 60), 'type:', type)
    const timestamp = Date.now()

    // Pre-wrap long lines to avoid rendering issues
    // Use 64 chars to leave room for timestamp prefix "[HH:MM:SS] " (11 chars)
    const wrappedLines = wrapText(text, 64)

    // Add each wrapped line as a separate buffer entry
    for (const lineText of wrappedLines) {
      const line = {
        text: lineText,
        type,
        timestamp
      }

      this.outputBuffer.push(line)
    }

    // Trim if over max
    if (this.outputBuffer.length > this.maxOutputLines) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxOutputLines)
    }

    // Reset scroll to bottom
    this.scrollOffset = 0

    this.notifyListeners('output', { line: { text, type, timestamp } })
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
    this.notifyListeners('scroll', { offset: this.scrollOffset, max: maxScroll })
  }

  /**
   * Scroll to top of output
   */
  scrollToTop() {
    const maxScroll = Math.max(0, this.outputBuffer.length - 10)
    this.scrollOffset = maxScroll
    this.notifyListeners('scroll', { offset: this.scrollOffset, max: maxScroll })
  }

  /**
   * Scroll to bottom of output (most recent)
   */
  scrollToBottom() {
    this.scrollOffset = 0
    const maxScroll = Math.max(0, this.outputBuffer.length - 10)
    this.notifyListeners('scroll', { offset: this.scrollOffset, max: maxScroll })
  }

  /**
   * Get scroll info for UI indicators
   */
  getScrollInfo() {
    const total = this.outputBuffer.length
    const maxScroll = Math.max(0, total - 10)
    return {
      offset: this.scrollOffset,
      maxScroll,
      total,
      atBottom: this.scrollOffset === 0,
      atTop: this.scrollOffset >= maxScroll,
      canScroll: maxScroll > 0
    }
  }

  /**
   * Toggle timestamp display
   */
  toggleTimestamps(enable = null) {
    if (enable === null) {
      this.showTimestamps = !this.showTimestamps
    } else {
      this.showTimestamps = enable
    }
    // Save preference
    try {
      localStorage.setItem('terminal_show_timestamps', JSON.stringify(this.showTimestamps))
    } catch (e) {}
    this.notifyListeners('refresh')
    return this.showTimestamps
  }

  /**
   * Get timestamps setting
   */
  getShowTimestamps() {
    return this.showTimestamps
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const mins = date.getMinutes().toString().padStart(2, '0')
    const secs = date.getSeconds().toString().padStart(2, '0')
    return `[${hours}:${mins}:${secs}]`
  }

  /**
   * Load display settings
   */
  loadDisplaySettings() {
    try {
      const saved = localStorage.getItem('terminal_show_timestamps')
      if (saved) {
        this.showTimestamps = JSON.parse(saved)
      }
    } catch (e) {}
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
    this.loadDisplaySettings()
    console.log('[TerminalManager] Initialized with', this.outputBuffer.length, 'lines,', this.commandHistory.length, 'history items')
  }
}

/**
 * Wrap text to a maximum character width
 * Preserves words and handles long words gracefully
 * @param {string} text - Text to wrap
 * @param {number} maxChars - Maximum characters per line (default 75)
 * @returns {string[]} Array of wrapped lines
 */
function wrapText(text, maxChars = 75) {
  if (!text || text.length <= maxChars) {
    return [text]
  }

  const lines = []
  const words = text.split(' ')
  let currentLine = ''

  for (const word of words) {
    // Handle very long words (break them)
    if (word.length > maxChars) {
      // Finish current line if any
      if (currentLine) {
        lines.push(currentLine.trim())
        currentLine = ''
      }
      // Break the long word into chunks
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars))
      }
      continue
    }

    // Check if adding this word would exceed max
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (testLine.length > maxChars) {
      // Start a new line
      if (currentLine) {
        lines.push(currentLine.trim())
      }
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  // Don't forget the last line
  if (currentLine) {
    lines.push(currentLine.trim())
  }

  return lines.length > 0 ? lines : ['']
}

// Singleton instance
export const terminalManager = new TerminalManager()

export default terminalManager
