/**
 * MacroManager - Record and Playback Command Sequences
 *
 * Features:
 * - macro record <name>: Start recording
 * - macro stop: Stop recording
 * - macro run <name> [args]: Run a macro
 * - macro define <name> "<commands>": Define inline
 * - macro bind Ctrl+1 <name>: Bind to key
 * - macro list: Show all macros
 * - macro delete <name>: Delete a macro
 *
 * Parameterized macros:
 * - Use {0}, {1}, etc. for arguments
 * - Example: macro define greet "msg {0} && status"
 * - Run: macro run greet snoop
 */

const STORAGE_KEY = 'streetLegacy_macros'

// Maximum macros to store
const MAX_MACROS = 50

// Maximum commands per macro
const MAX_COMMANDS_PER_MACRO = 20

// Key binding slots (Ctrl+1 through Ctrl+9)
const KEY_BINDING_SLOTS = ['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5',
                           'Ctrl+6', 'Ctrl+7', 'Ctrl+8', 'Ctrl+9', 'Ctrl+0']

class MacroManagerClass {
  constructor() {
    this.macros = {}
    this.keyBindings = {}
    this.isRecording = false
    this.recordingName = null
    this.recordingCommands = []
    this.commandExecutor = null
    this.listeners = []
    this.isInitialized = false
  }

  /**
   * Initialize the macro manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadMacros()
    this.isInitialized = true
    console.log('[MacroManager] Initialized with ' + Object.keys(this.macros).length + ' macros')
  }

  /**
   * Set the command executor function
   * @param {Function} executor - Function that executes commands
   */
  setCommandExecutor(executor) {
    this.commandExecutor = executor
  }

  /**
   * Start recording a macro
   * @param {string} name - Macro name
   * @returns {Object} Result object
   */
  startRecording(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, message: 'Macro name required' }
    }

    if (this.isRecording) {
      return { success: false, message: `Already recording macro "${this.recordingName}". Use "macro stop" first.` }
    }

    // Validate name
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      return { success: false, message: 'Macro name must start with letter and contain only letters, numbers, underscore, hyphen' }
    }

    this.isRecording = true
    this.recordingName = name
    this.recordingCommands = []

    this.emit('recordingStarted', { name })
    return { success: true, message: `Recording macro "${name}". Type commands then "macro stop" to save.` }
  }

  /**
   * Stop recording and save the macro
   * @returns {Object} Result object
   */
  stopRecording() {
    if (!this.isRecording) {
      return { success: false, message: 'Not currently recording' }
    }

    if (this.recordingCommands.length === 0) {
      this.isRecording = false
      this.recordingName = null
      return { success: false, message: 'No commands recorded. Macro discarded.' }
    }

    const macro = {
      name: this.recordingName,
      commands: [...this.recordingCommands],
      createdAt: Date.now(),
      runCount: 0
    }

    this.macros[this.recordingName] = macro
    this.saveMacros()

    const name = this.recordingName
    const count = this.recordingCommands.length

    this.isRecording = false
    this.recordingName = null
    this.recordingCommands = []

    this.emit('recordingStopped', { name, commands: count })
    return { success: true, message: `Macro "${name}" saved with ${count} commands.` }
  }

  /**
   * Record a command during recording
   * @param {string} command - Command to record
   */
  recordCommand(command) {
    if (!this.isRecording) return

    // Don't record macro commands themselves
    if (command.trim().startsWith('macro ')) return

    // Limit commands per macro
    if (this.recordingCommands.length >= MAX_COMMANDS_PER_MACRO) {
      this.emit('recordingWarning', { message: `Maximum ${MAX_COMMANDS_PER_MACRO} commands per macro` })
      return
    }

    this.recordingCommands.push(command)
    this.emit('commandRecorded', { command, count: this.recordingCommands.length })
  }

  /**
   * Define a macro inline
   * @param {string} name - Macro name
   * @param {string} commandString - Commands separated by && or ;
   * @returns {Object} Result object
   */
  defineMacro(name, commandString) {
    if (!name || !commandString) {
      return { success: false, message: 'Usage: macro define <name> "<commands>"' }
    }

    // Validate name
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      return { success: false, message: 'Invalid macro name' }
    }

    // Parse commands
    const commands = commandString.split(/\s*(?:&&|;)\s*/).filter(c => c.trim())

    if (commands.length === 0) {
      return { success: false, message: 'No valid commands in definition' }
    }

    if (commands.length > MAX_COMMANDS_PER_MACRO) {
      return { success: false, message: `Maximum ${MAX_COMMANDS_PER_MACRO} commands per macro` }
    }

    this.macros[name] = {
      name,
      commands,
      createdAt: Date.now(),
      runCount: 0
    }

    this.saveMacros()
    return { success: true, message: `Macro "${name}" defined with ${commands.length} command(s).` }
  }

  /**
   * Run a macro
   * @param {string} name - Macro name
   * @param {Array} args - Arguments to substitute
   * @returns {Promise<Object>} Result object
   */
  async runMacro(name, args = []) {
    const macro = this.macros[name]

    if (!macro) {
      return { success: false, message: `Macro "${name}" not found` }
    }

    if (!this.commandExecutor) {
      return { success: false, message: 'No command executor available' }
    }

    // Track run count
    macro.runCount++
    macro.lastRun = Date.now()

    const results = []
    let allSuccess = true

    for (let command of macro.commands) {
      // Substitute parameters
      command = this.substituteParams(command, args)

      try {
        const result = await this.commandExecutor(command)
        results.push({ command, result })

        if (result?.success === false) {
          allSuccess = false
        }
      } catch (e) {
        results.push({ command, error: e.message })
        allSuccess = false
      }
    }

    this.emit('macroExecuted', { name, results, success: allSuccess })
    this.saveMacros()  // Save updated run count

    return {
      success: allSuccess,
      message: `Executed macro "${name}" (${macro.commands.length} commands)`,
      results
    }
  }

  /**
   * Substitute parameters in command
   */
  substituteParams(command, args) {
    // Replace {0}, {1}, etc. with args
    return command.replace(/\{(\d+)\}/g, (match, index) => {
      const i = parseInt(index)
      return args[i] !== undefined ? args[i] : match
    })
  }

  /**
   * Bind a macro to a key
   * @param {string} key - Key binding (e.g., "Ctrl+1")
   * @param {string} macroName - Macro name
   * @returns {Object} Result object
   */
  bindKey(key, macroName) {
    if (!KEY_BINDING_SLOTS.includes(key)) {
      return { success: false, message: `Invalid key binding. Use: ${KEY_BINDING_SLOTS.join(', ')}` }
    }

    if (!this.macros[macroName]) {
      return { success: false, message: `Macro "${macroName}" not found` }
    }

    this.keyBindings[key] = macroName
    this.saveMacros()

    return { success: true, message: `Bound ${key} to macro "${macroName}"` }
  }

  /**
   * Unbind a key
   * @param {string} key - Key to unbind
   * @returns {Object} Result object
   */
  unbindKey(key) {
    if (!this.keyBindings[key]) {
      return { success: false, message: `No binding for ${key}` }
    }

    delete this.keyBindings[key]
    this.saveMacros()

    return { success: true, message: `Unbound ${key}` }
  }

  /**
   * Get macro bound to a key
   */
  getKeyBinding(key) {
    return this.keyBindings[key]
  }

  /**
   * Handle a key press (check for macro binding)
   * @param {string} key - Key combination
   * @returns {boolean} True if handled
   */
  async handleKeyPress(key) {
    const macroName = this.keyBindings[key]
    if (macroName && this.macros[macroName]) {
      await this.runMacro(macroName)
      return true
    }
    return false
  }

  /**
   * Delete a macro
   * @param {string} name - Macro name
   * @returns {Object} Result object
   */
  deleteMacro(name) {
    if (!this.macros[name]) {
      return { success: false, message: `Macro "${name}" not found` }
    }

    delete this.macros[name]

    // Remove any key bindings to this macro
    Object.keys(this.keyBindings).forEach(key => {
      if (this.keyBindings[key] === name) {
        delete this.keyBindings[key]
      }
    })

    this.saveMacros()
    return { success: true, message: `Macro "${name}" deleted` }
  }

  /**
   * List all macros
   * @returns {Array} Array of macro info
   */
  listMacros() {
    return Object.values(this.macros).map(macro => ({
      name: macro.name,
      commands: macro.commands.length,
      runCount: macro.runCount || 0,
      lastRun: macro.lastRun,
      binding: Object.entries(this.keyBindings)
        .find(([k, v]) => v === macro.name)?.[0] || null
    }))
  }

  /**
   * Get macro details
   * @param {string} name - Macro name
   * @returns {Object|null} Macro object or null
   */
  getMacro(name) {
    return this.macros[name] || null
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording() {
    return this.isRecording
  }

  /**
   * Get recording status
   */
  getRecordingStatus() {
    if (!this.isRecording) return null
    return {
      name: this.recordingName,
      commandCount: this.recordingCommands.length
    }
  }

  /**
   * Format macros for display
   */
  formatMacroList() {
    const macros = this.listMacros()

    if (macros.length === 0) {
      return 'No macros defined. Use "macro record <name>" to create one.'
    }

    const lines = ['Macros:', '']
    macros.forEach(m => {
      const binding = m.binding ? ` [${m.binding}]` : ''
      const runs = m.runCount > 0 ? ` (${m.runCount} runs)` : ''
      lines.push(`  ${m.name}${binding}: ${m.commands} command(s)${runs}`)
    })

    return lines.join('\n')
  }

  /**
   * Format macro details
   */
  formatMacroDetails(name) {
    const macro = this.macros[name]
    if (!macro) return `Macro "${name}" not found`

    const lines = [
      `Macro: ${macro.name}`,
      `Commands: ${macro.commands.length}`,
      `Run count: ${macro.runCount || 0}`,
      '',
      'Commands:'
    ]

    macro.commands.forEach((cmd, i) => {
      lines.push(`  ${i + 1}. ${cmd}`)
    })

    return lines.join('\n')
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
   * Emit event
   */
  emit(event, data) {
    this.listeners.forEach(l => {
      try {
        l(event, data)
      } catch (e) {
        console.error('[MacroManager] Listener error:', e)
      }
    })
  }

  /**
   * Save macros to localStorage
   */
  saveMacros() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        macros: this.macros,
        keyBindings: this.keyBindings,
        version: 1
      }))
    } catch (e) {
      console.warn('[MacroManager] Save failed:', e)
    }
  }

  /**
   * Load macros from localStorage
   */
  loadMacros() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.macros = data.macros || {}
        this.keyBindings = data.keyBindings || {}
      }
    } catch (e) {
      console.warn('[MacroManager] Load failed:', e)
      this.macros = {}
      this.keyBindings = {}
    }
  }

  /**
   * Clear all macros
   */
  clearAll() {
    this.macros = {}
    this.keyBindings = {}
    this.saveMacros()
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      macroCount: Object.keys(this.macros).length,
      keyBindings: Object.keys(this.keyBindings).length,
      isRecording: this.isRecording,
      recordingName: this.recordingName
    }
  }
}

// Singleton instance
export const macroManager = new MacroManagerClass()

export default macroManager
