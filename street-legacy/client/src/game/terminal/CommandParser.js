/**
 * CommandParser - Parse command strings into executable parts
 *
 * Handles:
 * - Basic commands: "help", "status"
 * - Commands with args: "go ops", "msg fixer hello there"
 * - Commands with flags: "crime --list", "jobs -a"
 * - Quoted strings: "msg fixer "I need money""
 */

/**
 * Parse a command string into structured parts
 * @param {string} input - Raw command input
 * @returns {{ command: string, args: string[], flags: object, raw: string }}
 */
export function parseCommand(input) {
  const raw = input.trim()
  if (!raw) {
    return { command: '', args: [], flags: {}, raw: '' }
  }

  const tokens = tokenize(raw)

  if (tokens.length === 0) {
    return { command: '', args: [], flags: {}, raw }
  }

  const command = tokens[0].toLowerCase()
  const args = []
  const flags = {}

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]

    // Long flag: --name or --name=value
    if (token.startsWith('--')) {
      const flagPart = token.slice(2)
      if (flagPart.includes('=')) {
        const [name, value] = flagPart.split('=', 2)
        flags[name] = value
      } else {
        flags[flagPart] = true
      }
    }
    // Short flag: -l or -la (combined)
    else if (token.startsWith('-') && token.length > 1 && !token.startsWith('--')) {
      const flagChars = token.slice(1)
      for (const char of flagChars) {
        flags[char] = true
      }
    }
    // Regular argument
    else {
      args.push(token)
    }
  }

  return { command, args, flags, raw }
}

/**
 * Tokenize input string, handling quotes
 * @param {string} input - Raw input string
 * @returns {string[]} Array of tokens
 */
function tokenize(input) {
  const tokens = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    // Handle quote characters
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
      continue
    }

    if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
      // Don't skip - we want to end the current token
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    // Handle spaces
    if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  // Push final token
  if (current) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Join remaining args into a single message string
 * Useful for commands like "msg fixer hello how are you"
 * @param {string[]} args - Array of arguments
 * @param {number} startIndex - Index to start joining from
 * @returns {string} Joined string
 */
export function joinArgs(args, startIndex = 0) {
  return args.slice(startIndex).join(' ')
}

/**
 * Check if a flag is set
 * @param {object} flags - Flags object
 * @param {string|string[]} names - Flag name(s) to check
 * @returns {boolean} True if any flag is set
 */
export function hasFlag(flags, names) {
  const nameList = Array.isArray(names) ? names : [names]
  return nameList.some(name => flags[name] === true)
}

/**
 * Get flag value (for --flag=value style)
 * @param {object} flags - Flags object
 * @param {string|string[]} names - Flag name(s) to check
 * @param {*} defaultValue - Default if not found
 * @returns {*} Flag value or default
 */
export function getFlagValue(flags, names, defaultValue = null) {
  const nameList = Array.isArray(names) ? names : [names]
  for (const name of nameList) {
    if (flags[name] !== undefined && flags[name] !== true) {
      return flags[name]
    }
  }
  return defaultValue
}

export default parseCommand
