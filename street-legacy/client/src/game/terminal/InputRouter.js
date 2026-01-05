/**
 * InputRouter - Smart Input Classification and Routing
 *
 * Routes user input to the appropriate handler:
 * 1. Active adventure → AdventureEngine
 * 2. Pending opportunity response → OpportunityManager
 * 3. Direct commands (status, go ops, help)
 * 4. Natural language commands ("take me to ops" → go ops)
 * 5. Conversational queries → S.A.R.A.H.
 * 6. Ambiguous input → Ask clarification
 */

import { commandRegistry } from './CommandRegistry'
import { parseCommand } from './CommandParser'
import { adventureEngine } from '../adventure/AdventureEngine'
import { opportunityManager } from '../opportunity/OpportunityManager'

// Natural language patterns that map to commands
const NL_COMMAND_PATTERNS = [
  // Navigation
  { pattern: /^take me (to )?(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `Got it, heading to ${m[2]}...` },
  { pattern: /^bring me (to )?(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `On my way to ${m[2]}...` },
  { pattern: /^let'?s go (to )?(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `Alright, navigating to ${m[2]}...` },
  { pattern: /^head (to |over to )(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `Heading to ${m[2]}...` },
  { pattern: /^navigate (to )?(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `Navigating to ${m[2]}...` },
  { pattern: /^i want to go (to )?(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `Taking you to ${m[2]}...` },
  { pattern: /^can you take me (to )?(.+)$/i, command: (m) => `go ${m[2]}`, echo: (m) => `Sure, heading to ${m[2]}...` },

  // Status checks
  { pattern: /^(show|check|get|display)( me)?( my)? (stats?|status|info)$/i, command: () => 'status', echo: () => 'Checking your stats...' },
  { pattern: /^(what|how)('?s| is| are)( my)? (stats?|status|situation)(\?)?$/i, command: () => 'status', echo: () => 'Let me check your situation...' },
  { pattern: /^am i doing (ok|okay|good|well|alright)(\?)?$/i, command: () => 'status', echo: () => 'Let me see how you\'re doing...' },
  { pattern: /^how much (money|cash) (do i have|i got)(\?)?$/i, command: () => 'status', echo: () => 'Checking your finances...' },

  // Help
  { pattern: /^what can (i|you) do(\?)?$/i, command: () => 'help', echo: () => 'Here\'s what I can help with...' },
  { pattern: /^show me (the )?commands?$/i, command: () => 'help', echo: () => 'Here are the available commands...' },
  { pattern: /^what('?s| is) available(\?)?$/i, command: () => 'help', echo: () => 'Let me show you what\'s available...' },
  { pattern: /^help me( out)?$/i, command: () => 'help', echo: () => 'I got you. Here\'s what I can do...' },

  // Clear
  { pattern: /^clear( the)?( screen| terminal| console)?$/i, command: () => 'clear', echo: () => 'Clearing the terminal...' },
  { pattern: /^clean( up)?( the)?( screen| terminal)?$/i, command: () => 'clear', echo: () => 'Cleaning up...' },

  // Map
  { pattern: /^(show|open)( me)?( the)? map$/i, command: () => 'map', echo: () => 'Opening the map...' },
  { pattern: /^where (am i|can i go)(\?)?$/i, command: () => 'map', echo: () => 'Let me show you the map...' },
]

// Conversation indicators - phrases that suggest the user wants to chat, not run a command
const CONVERSATION_INDICATORS = [
  /^(what|how|why|when|where|who|which|can|should|would|could|will|is|are|do|does|did)\b/i,
  /\?$/,  // Ends with question mark
  /^(tell me|explain|describe|help me understand)/i,
  /^i (want|need|think|feel|have|am|was|don't|can't)/i,
  /^(hey|hi|hello|yo|sup|what's up)/i,
  /^(thanks|thank you|thx|ty)/i,
  /^(yes|no|yeah|nah|yep|nope|ok|okay|sure|maybe)/i,
]

// Words that strongly suggest a command intent
const COMMAND_KEYWORDS = [
  'go', 'status', 'help', 'clear', 'map', 'crime', 'job', 'heist',
  'trade', 'bank', 'crew', 'inventory', 'inv', 'msg', 'messages'
]

class InputRouterClass {
  constructor() {
    this.lastRouting = null
  }

  /**
   * Route input to the appropriate handler
   * @param {string} input - Raw user input
   * @param {object} terminal - Terminal manager reference
   * @returns {object} Routing decision { type, data, echo? }
   */
  async route(input, terminal) {
    const trimmed = input.trim()
    if (!trimmed) {
      return { type: 'empty' }
    }

    const normalized = trimmed.toLowerCase()

    // 0a. Check if in active adventure mode
    if (adventureEngine.isActive()) {
      // Allow system commands to break out
      if (['quit', 'exit', 'abandon'].includes(normalized)) {
        this.lastRouting = { type: 'adventure_exit', input: trimmed }
        return { type: 'adventure', data: trimmed, isExit: true }
      }

      // Route to adventure engine
      this.lastRouting = { type: 'adventure', input: trimmed }
      return { type: 'adventure', data: trimmed }
    }

    // 0b. Check for opportunity response (respond 1 yes/no)
    const oppResponse = this.matchOpportunityResponse(trimmed)
    if (oppResponse) {
      this.lastRouting = { type: 'opportunity_response', input: trimmed }
      return {
        type: 'opportunity_response',
        data: oppResponse
      }
    }

    // 1. Check for natural language command patterns FIRST
    // This prevents phrases like "take me to ops" from matching the "take" command alias
    const nlCommand = this.matchNLPattern(trimmed)
    if (nlCommand) {
      this.lastRouting = { type: 'nl_command', input: trimmed, command: nlCommand.command }
      return {
        type: 'nl_command',
        data: nlCommand.command,
        echo: nlCommand.echo
      }
    }

    // 2. Check for exact command match
    const directCommand = this.checkDirectCommand(trimmed)
    if (directCommand) {
      this.lastRouting = { type: 'command', input: trimmed }
      return { type: 'command', data: trimmed }
    }

    // 3. Score the input to determine if it's a command or conversation
    const commandScore = this.scoreCommandIntent(normalized)
    const conversationScore = this.scoreConversationIntent(normalized)

    // 4. Route based on scores
    if (commandScore > conversationScore && commandScore > 0.5) {
      // Looks like a command but we didn't recognize it - treat as conversation
      // S.A.R.A.H. might understand it
      this.lastRouting = { type: 'conversation', input: trimmed, reason: 'unrecognized_command' }
      return { type: 'conversation', data: trimmed }
    }

    if (conversationScore > 0.3) {
      // Clear conversation intent
      this.lastRouting = { type: 'conversation', input: trimmed }
      return { type: 'conversation', data: trimmed }
    }

    // 5. Ambiguous - let S.A.R.A.H. handle with potential clarification
    this.lastRouting = { type: 'ambiguous', input: trimmed, scores: { commandScore, conversationScore } }
    return {
      type: 'ambiguous',
      data: trimmed,
      scores: { commandScore, conversationScore }
    }
  }

  /**
   * Match opportunity response pattern (respond 1 yes/no)
   */
  matchOpportunityResponse(input) {
    const pattern = /^respond\s+(\d+)\s*(yes|no|accept|decline)?$/i
    const match = input.match(pattern)

    if (match) {
      return {
        index: parseInt(match[1], 10),
        response: match[2] || null
      }
    }

    return null
  }

  /**
   * Check if input is a direct command (starts with known command name)
   */
  checkDirectCommand(input) {
    const parsed = parseCommand(input)
    if (!parsed || !parsed.command) return false

    const cmd = commandRegistry.getCommand(parsed.command)
    if (cmd) {
      return true
    }

    return false
  }

  /**
   * Match input against natural language command patterns
   */
  matchNLPattern(input) {
    for (const { pattern, command, echo } of NL_COMMAND_PATTERNS) {
      const match = input.match(pattern)
      if (match) {
        return {
          command: command(match),
          echo: echo(match)
        }
      }
    }
    return null
  }

  /**
   * Score how likely the input is a command
   */
  scoreCommandIntent(input) {
    let score = 0
    const words = input.split(/\s+/)
    const firstWord = words[0]

    // First word is a command keyword
    if (COMMAND_KEYWORDS.includes(firstWord)) {
      score += 0.6
    }

    // Contains command keyword anywhere
    for (const keyword of COMMAND_KEYWORDS) {
      if (input.includes(keyword)) {
        score += 0.2
        break
      }
    }

    // Short input (1-2 words) more likely to be command
    if (words.length <= 2) {
      score += 0.2
    }

    // No question mark
    if (!input.includes('?')) {
      score += 0.1
    }

    return Math.min(1, score)
  }

  /**
   * Score how likely the input is conversational
   */
  scoreConversationIntent(input) {
    let score = 0

    // Check conversation indicators
    for (const pattern of CONVERSATION_INDICATORS) {
      if (pattern.test(input)) {
        score += 0.3
      }
    }

    // Has question mark
    if (input.includes('?')) {
      score += 0.3
    }

    // Longer input (more natural language)
    const words = input.split(/\s+/)
    if (words.length >= 4) {
      score += 0.2
    }

    // Contains pronouns (I, me, my, you)
    if (/\b(i|me|my|you|your|we|us)\b/i.test(input)) {
      score += 0.2
    }

    return Math.min(1, score)
  }

  /**
   * Get the last routing decision (for debugging)
   */
  getLastRouting() {
    return this.lastRouting
  }
}

// Singleton instance
export const inputRouter = new InputRouterClass()
export default inputRouter
