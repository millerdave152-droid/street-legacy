/**
 * CommandChainExecutor - Pipe and Chain Command Execution
 *
 * Syntax:
 * - Pipe: command1 | filter (output of cmd1 -> input of filter)
 * - Sequence: cmd1 && cmd2 (run cmd2 only if cmd1 succeeds)
 * - Always: cmd1 ; cmd2 (run both regardless)
 * - Conditional: if condition then cmd1 else cmd2
 *
 * Pipe Filters:
 * - grep <pattern>: Filter lines matching pattern
 * - head <n>: First n lines
 * - tail <n>: Last n lines
 * - sort: Sort lines alphabetically
 * - uniq: Remove duplicate lines
 * - count: Count lines
 * - upper: Convert to uppercase
 * - lower: Convert to lowercase
 */

// Pipe filter implementations
const PIPE_FILTERS = {
  grep: {
    description: 'Filter lines matching pattern',
    usage: 'grep <pattern>',
    execute: (input, args) => {
      if (!args[0]) return { success: false, error: 'grep requires a pattern' }
      const pattern = new RegExp(args[0], 'i')
      const lines = input.split('\n').filter(line => pattern.test(line))
      return { success: true, output: lines.join('\n') }
    }
  },

  head: {
    description: 'Show first n lines',
    usage: 'head [n=10]',
    execute: (input, args) => {
      const n = parseInt(args[0]) || 10
      const lines = input.split('\n').slice(0, n)
      return { success: true, output: lines.join('\n') }
    }
  },

  tail: {
    description: 'Show last n lines',
    usage: 'tail [n=10]',
    execute: (input, args) => {
      const n = parseInt(args[0]) || 10
      const lines = input.split('\n').slice(-n)
      return { success: true, output: lines.join('\n') }
    }
  },

  sort: {
    description: 'Sort lines alphabetically',
    usage: 'sort [-r for reverse]',
    execute: (input, args) => {
      const lines = input.split('\n').sort()
      if (args.includes('-r')) lines.reverse()
      return { success: true, output: lines.join('\n') }
    }
  },

  uniq: {
    description: 'Remove duplicate lines',
    usage: 'uniq',
    execute: (input) => {
      const lines = [...new Set(input.split('\n'))]
      return { success: true, output: lines.join('\n') }
    }
  },

  count: {
    description: 'Count lines',
    usage: 'count',
    execute: (input) => {
      const lines = input.split('\n').filter(l => l.trim())
      return { success: true, output: `${lines.length} lines` }
    }
  },

  upper: {
    description: 'Convert to uppercase',
    usage: 'upper',
    execute: (input) => {
      return { success: true, output: input.toUpperCase() }
    }
  },

  lower: {
    description: 'Convert to lowercase',
    usage: 'lower',
    execute: (input) => {
      return { success: true, output: input.toLowerCase() }
    }
  },

  trim: {
    description: 'Trim whitespace from lines',
    usage: 'trim',
    execute: (input) => {
      const lines = input.split('\n').map(l => l.trim())
      return { success: true, output: lines.join('\n') }
    }
  },

  reverse: {
    description: 'Reverse line order',
    usage: 'reverse',
    execute: (input) => {
      const lines = input.split('\n').reverse()
      return { success: true, output: lines.join('\n') }
    }
  },

  number: {
    description: 'Add line numbers',
    usage: 'number',
    execute: (input) => {
      const lines = input.split('\n').map((l, i) => `${i + 1}: ${l}`)
      return { success: true, output: lines.join('\n') }
    }
  },

  first: {
    description: 'Get first word of each line',
    usage: 'first',
    execute: (input) => {
      const lines = input.split('\n').map(l => l.split(/\s+/)[0] || '')
      return { success: true, output: lines.join('\n') }
    }
  },

  last: {
    description: 'Get last word of each line',
    usage: 'last',
    execute: (input) => {
      const lines = input.split('\n').map(l => {
        const words = l.split(/\s+/)
        return words[words.length - 1] || ''
      })
      return { success: true, output: lines.join('\n') }
    }
  }
}

// Chain operators
const OPERATORS = {
  PIPE: '|',
  AND: '&&',
  SEQUENCE: ';',
  OR: '||'
}

class CommandChainExecutorClass {
  constructor() {
    this.commandExecutor = null  // Set by terminal manager
    this.gameState = null
    this.listeners = []
  }

  /**
   * Set the command executor function
   * @param {Function} executor - Function that executes a single command
   */
  setCommandExecutor(executor) {
    this.commandExecutor = executor
  }

  /**
   * Set game state for conditionals
   * @param {Object} state - Current game state
   */
  setGameState(state) {
    this.gameState = state
  }

  /**
   * Parse and execute a command chain
   * @param {string} input - Full command string
   * @returns {Promise<Object>} Execution result
   */
  async execute(input) {
    if (!input || !input.trim()) {
      return { success: false, output: '', error: 'Empty command' }
    }

    // Check for conditional first
    if (input.trim().startsWith('if ')) {
      return this.executeConditional(input)
    }

    // Parse the command chain
    const chain = this.parseChain(input)

    if (chain.length === 0) {
      return { success: false, output: '', error: 'No commands to execute' }
    }

    // Single command - just execute it
    if (chain.length === 1 && !chain[0].pipes?.length) {
      return this.executeSingleCommand(chain[0].command)
    }

    // Execute chain
    return this.executeChain(chain)
  }

  /**
   * Parse command string into chain structure
   * @param {string} input - Command string
   * @returns {Array} Array of command objects
   */
  parseChain(input) {
    const chain = []

    // Split by operators (but not inside pipes)
    const tokens = this.tokenize(input)

    let currentCommand = null
    let pipes = []
    let operator = null

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      if (token === OPERATORS.AND || token === OPERATORS.SEQUENCE || token === OPERATORS.OR) {
        // Save current command
        if (currentCommand) {
          chain.push({
            command: currentCommand,
            pipes: pipes,
            operator: operator
          })
        }
        currentCommand = null
        pipes = []
        operator = token
      } else if (token === OPERATORS.PIPE) {
        // Start pipe chain
        if (!currentCommand) {
          return [{ error: 'Pipe requires a command before it' }]
        }
        // Next token is the pipe filter
        i++
        if (i < tokens.length) {
          pipes.push(tokens[i])
        }
      } else {
        // Regular command or continuation
        if (currentCommand === null) {
          currentCommand = token
        } else {
          currentCommand += ' ' + token
        }
      }
    }

    // Add final command
    if (currentCommand) {
      chain.push({
        command: currentCommand,
        pipes: pipes,
        operator: operator
      })
    }

    return chain
  }

  /**
   * Tokenize input string
   */
  tokenize(input) {
    const tokens = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < input.length; i++) {
      const char = input[i]
      const nextChar = input[i + 1]

      // Handle quotes
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true
        quoteChar = char
        continue
      }
      if (char === quoteChar && inQuotes) {
        inQuotes = false
        continue
      }

      if (inQuotes) {
        current += char
        continue
      }

      // Check for operators
      if (char === '|' && nextChar !== '|') {
        if (current.trim()) tokens.push(current.trim())
        tokens.push(OPERATORS.PIPE)
        current = ''
      } else if (char === '&' && nextChar === '&') {
        if (current.trim()) tokens.push(current.trim())
        tokens.push(OPERATORS.AND)
        current = ''
        i++  // Skip next &
      } else if (char === '|' && nextChar === '|') {
        if (current.trim()) tokens.push(current.trim())
        tokens.push(OPERATORS.OR)
        current = ''
        i++  // Skip next |
      } else if (char === ';') {
        if (current.trim()) tokens.push(current.trim())
        tokens.push(OPERATORS.SEQUENCE)
        current = ''
      } else {
        current += char
      }
    }

    if (current.trim()) {
      tokens.push(current.trim())
    }

    return tokens
  }

  /**
   * Execute a chain of commands
   */
  async executeChain(chain) {
    let lastResult = { success: true, output: '' }
    const allOutput = []

    for (const item of chain) {
      // Check operator conditions
      if (item.operator === OPERATORS.AND && !lastResult.success) {
        // Skip this command if previous failed
        continue
      }
      if (item.operator === OPERATORS.OR && lastResult.success) {
        // Skip this command if previous succeeded
        continue
      }

      // Execute the command
      let result = await this.executeSingleCommand(item.command)

      // Apply pipes
      if (item.pipes && item.pipes.length > 0 && result.success) {
        result = this.applyPipes(result.output, item.pipes)
      }

      lastResult = result
      if (result.output) {
        allOutput.push(result.output)
      }
      if (result.error) {
        allOutput.push(`Error: ${result.error}`)
      }
    }

    return {
      success: lastResult.success,
      output: allOutput.join('\n'),
      error: lastResult.error
    }
  }

  /**
   * Execute a single command
   */
  async executeSingleCommand(command) {
    if (!this.commandExecutor) {
      return { success: false, error: 'No command executor set' }
    }

    try {
      const result = await this.commandExecutor(command)
      return {
        success: result?.success !== false,
        output: result?.output || result?.message || '',
        error: result?.error
      }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * Apply pipe filters to output
   */
  applyPipes(input, pipes) {
    let output = input

    for (const pipeStr of pipes) {
      const parts = pipeStr.trim().split(/\s+/)
      const filterName = parts[0]
      const args = parts.slice(1)

      const filter = PIPE_FILTERS[filterName]
      if (!filter) {
        return { success: false, error: `Unknown filter: ${filterName}` }
      }

      const result = filter.execute(output, args)
      if (!result.success) {
        return result
      }
      output = result.output
    }

    return { success: true, output }
  }

  /**
   * Execute conditional command
   * Syntax: if <condition> then <command> [else <command>]
   */
  async executeConditional(input) {
    const match = input.match(/^if\s+(.+?)\s+then\s+(.+?)(?:\s+else\s+(.+))?$/i)

    if (!match) {
      return { success: false, error: 'Invalid conditional syntax. Use: if <condition> then <command> [else <command>]' }
    }

    const condition = match[1].trim()
    const thenCommand = match[2].trim()
    const elseCommand = match[3]?.trim()

    // Evaluate condition
    const conditionResult = this.evaluateCondition(condition)

    if (conditionResult) {
      return this.execute(thenCommand)
    } else if (elseCommand) {
      return this.execute(elseCommand)
    }

    return { success: true, output: '' }
  }

  /**
   * Evaluate a condition
   */
  evaluateCondition(condition) {
    if (!this.gameState?.player) {
      return false
    }

    const player = this.gameState.player

    // Parse condition
    // Supported: heat > 50, cash < 1000, level >= 5, energy == 100
    const match = condition.match(/^(\w+)\s*(>=|<=|>|<|==|!=)\s*(\d+)$/i)

    if (!match) {
      // Try boolean conditions
      if (condition === 'true') return true
      if (condition === 'false') return false
      return false
    }

    const [, variable, operator, valueStr] = match
    const value = parseInt(valueStr)
    const actual = player[variable.toLowerCase()]

    if (actual === undefined) {
      return false
    }

    switch (operator) {
      case '>': return actual > value
      case '<': return actual < value
      case '>=': return actual >= value
      case '<=': return actual <= value
      case '==': return actual === value
      case '!=': return actual !== value
      default: return false
    }
  }

  /**
   * Check if input contains chain operators
   */
  hasChainOperators(input) {
    return /[|&;]/.test(input) || input.trim().startsWith('if ')
  }

  /**
   * Get available filters
   */
  getAvailableFilters() {
    return Object.entries(PIPE_FILTERS).map(([name, filter]) => ({
      name,
      description: filter.description,
      usage: filter.usage
    }))
  }

  /**
   * Get filter help
   */
  getFilterHelp() {
    const lines = ['Available pipe filters:', '']
    Object.entries(PIPE_FILTERS).forEach(([name, filter]) => {
      lines.push(`  ${filter.usage.padEnd(20)} - ${filter.description}`)
    })
    lines.push('')
    lines.push('Chain operators:')
    lines.push('  cmd1 | filter      - Pipe output to filter')
    lines.push('  cmd1 && cmd2       - Run cmd2 only if cmd1 succeeds')
    lines.push('  cmd1 ; cmd2        - Run both commands')
    lines.push('  cmd1 || cmd2       - Run cmd2 only if cmd1 fails')
    lines.push('')
    lines.push('Conditionals:')
    lines.push('  if heat > 50 then hideout')
    lines.push('  if cash < 100 then crime else status')
    return lines.join('\n')
  }
}

// Singleton instance
export const commandChainExecutor = new CommandChainExecutorClass()

// Export constants
export { PIPE_FILTERS, OPERATORS }

export default commandChainExecutor
