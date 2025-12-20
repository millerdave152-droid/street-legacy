/**
 * CommandRegistry - Register and execute terminal commands
 *
 * Commands are registered with:
 * - name: Primary command name
 * - aliases: Alternative names (e.g., 'cd' for 'go')
 * - handler: Async function that executes the command
 * - help: Description for help text
 * - usage: Usage example
 * - minLevel: Minimum player level to use (progressive unlocks)
 * - category: Command category for organization
 */

import { gameManager } from '../GameManager'

// Command categories
export const CATEGORIES = {
  INFO: 'info',
  NAVIGATION: 'navigation',
  ACTION: 'action',
  SOCIAL: 'social',
  SYSTEM: 'system',
}

class CommandRegistry {
  constructor() {
    // Map of command name -> handler config
    this.commands = new Map()

    // Map of alias -> primary command name
    this.aliases = new Map()

    // Category groupings
    this.categories = new Map()
  }

  /**
   * Register a command
   * @param {object} config - Command configuration
   */
  register(config) {
    const {
      name,
      aliases = [],
      handler,
      help = '',
      usage = '',
      minLevel = 1,
      category = CATEGORIES.SYSTEM,
      hidden = false,
    } = config

    if (!name || !handler) {
      console.error('[CommandRegistry] Invalid command config:', config)
      return
    }

    const commandName = name.toLowerCase()

    // Store command
    this.commands.set(commandName, {
      name: commandName,
      handler,
      help,
      usage: usage || name,
      minLevel,
      category,
      hidden,
      aliases,
    })

    // Register aliases
    for (const alias of aliases) {
      this.aliases.set(alias.toLowerCase(), commandName)
    }

    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, [])
    }
    this.categories.get(category).push(commandName)

    // console.log(`[CommandRegistry] Registered: ${commandName}`, aliases.length ? `(aliases: ${aliases.join(', ')})` : '')
  }

  /**
   * Register multiple commands at once
   * @param {object[]} commands - Array of command configs
   */
  registerAll(commands) {
    for (const cmd of commands) {
      this.register(cmd)
    }
  }

  /**
   * Get command by name or alias
   * @param {string} name - Command name or alias
   * @returns {object|null} Command config or null
   */
  getCommand(name) {
    const lowerName = name.toLowerCase()

    // Direct match
    if (this.commands.has(lowerName)) {
      return this.commands.get(lowerName)
    }

    // Alias match
    if (this.aliases.has(lowerName)) {
      const primaryName = this.aliases.get(lowerName)
      return this.commands.get(primaryName)
    }

    return null
  }

  /**
   * Check if player can use command (level requirement)
   * @param {object} command - Command config
   * @returns {boolean} True if player can use
   */
  canUseCommand(command) {
    const playerLevel = gameManager.player?.level || 1
    return playerLevel >= command.minLevel
  }

  /**
   * Execute a parsed command
   * @param {object} parsed - Parsed command from CommandParser
   * @param {object} terminal - TerminalManager instance
   * @returns {Promise<object>} Result object
   */
  async execute(parsed, terminal) {
    const { command: cmdName, args, flags } = parsed

    if (!cmdName) {
      return { error: true, message: 'No command entered' }
    }

    const command = this.getCommand(cmdName)

    if (!command) {
      return {
        error: true,
        message: `Unknown command: ${cmdName}. Type "help" for available commands.`
      }
    }

    // Check level requirement
    if (!this.canUseCommand(command)) {
      return {
        error: true,
        message: `Command "${cmdName}" requires level ${command.minLevel}. You are level ${gameManager.player?.level || 1}.`
      }
    }

    try {
      // Execute the handler
      const result = await command.handler({ args, flags, terminal, command })
      return result || { success: true }
    } catch (error) {
      console.error(`[CommandRegistry] Error executing ${cmdName}:`, error)
      return {
        error: true,
        message: `Error: ${error.message}`
      }
    }
  }

  /**
   * Get help text for a specific command
   * @param {string} name - Command name
   * @returns {string[]} Help text lines
   */
  getHelp(name) {
    const command = this.getCommand(name)

    if (!command) {
      return [`Unknown command: ${name}`]
    }

    const lines = []
    lines.push(`${command.name.toUpperCase()}`)
    if (command.help) {
      lines.push(`  ${command.help}`)
    }
    lines.push(`  Usage: ${command.usage}`)
    if (command.aliases.length > 0) {
      lines.push(`  Aliases: ${command.aliases.join(', ')}`)
    }
    if (command.minLevel > 1) {
      lines.push(`  Requires: Level ${command.minLevel}`)
    }

    return lines
  }

  /**
   * Get all available commands (respecting level)
   * @returns {object[]} Array of available commands
   */
  getAvailableCommands() {
    const available = []

    for (const command of this.commands.values()) {
      if (!command.hidden && this.canUseCommand(command)) {
        available.push(command)
      }
    }

    return available
  }

  /**
   * Get commands by category
   * @param {string} category - Category name
   * @returns {object[]} Commands in category
   */
  getCommandsByCategory(category) {
    const names = this.categories.get(category) || []
    return names
      .map(name => this.commands.get(name))
      .filter(cmd => cmd && !cmd.hidden && this.canUseCommand(cmd))
  }

  /**
   * Get autocomplete suggestions
   * @param {string} input - Partial input
   * @returns {string[]} Matching suggestions
   */
  getSuggestions(input) {
    const parts = input.toLowerCase().split(' ')
    const suggestions = []

    if (parts.length === 1) {
      // Autocomplete command name
      const partial = parts[0]

      // Match command names
      for (const name of this.commands.keys()) {
        if (name.startsWith(partial) && !this.commands.get(name).hidden) {
          if (this.canUseCommand(this.commands.get(name))) {
            suggestions.push(name)
          }
        }
      }

      // Match aliases
      for (const [alias, cmdName] of this.aliases.entries()) {
        if (alias.startsWith(partial)) {
          const cmd = this.commands.get(cmdName)
          if (cmd && !cmd.hidden && this.canUseCommand(cmd)) {
            suggestions.push(alias)
          }
        }
      }
    } else {
      // Autocomplete arguments based on command
      const cmdName = parts[0]
      const command = this.getCommand(cmdName)

      if (command && command.getSuggestions) {
        const argSuggestions = command.getSuggestions(parts.slice(1))
        suggestions.push(...argSuggestions)
      }
    }

    // Remove duplicates and sort
    return [...new Set(suggestions)].sort()
  }

  /**
   * Get all command names (for help display)
   * @returns {string[]} All command names
   */
  getAllCommandNames() {
    return [...this.commands.keys()].filter(name => {
      const cmd = this.commands.get(name)
      return !cmd.hidden
    })
  }

  /**
   * Get formatted help for all commands
   * @returns {object[]} Array of { text, type } for output
   */
  getFullHelp() {
    const output = []
    const playerLevel = gameManager.player?.level || 1

    output.push({ text: ':: AVAILABLE COMMANDS', type: 'system' })
    output.push({ text: '', type: 'response' })

    // Group by category
    const categoryOrder = [
      CATEGORIES.INFO,
      CATEGORIES.NAVIGATION,
      CATEGORIES.ACTION,
      CATEGORIES.SOCIAL,
      CATEGORIES.SYSTEM,
    ]

    for (const category of categoryOrder) {
      const commands = this.getCommandsByCategory(category)
      if (commands.length === 0) continue

      // Category header
      output.push({ text: `  [${category.toUpperCase()}]`, type: 'system' })

      for (const cmd of commands) {
        const lockedIndicator = cmd.minLevel > playerLevel ? ' [LOCKED]' : ''
        const aliasText = cmd.aliases.length > 0 ? ` (${cmd.aliases[0]})` : ''
        output.push({
          text: `    ${cmd.usage.padEnd(20)} ${cmd.help}${aliasText}${lockedIndicator}`,
          type: cmd.minLevel > playerLevel ? 'warning' : 'response'
        })
      }

      output.push({ text: '', type: 'response' })
    }

    output.push({ text: '  Type "help <command>" for detailed help', type: 'system' })

    return output
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry()

export default commandRegistry
