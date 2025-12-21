/**
 * ConversationalSarah - Enhanced Conversational Layer
 *
 * Wraps SarahManager to provide a more conversational experience:
 * - Echo/confirm pattern ("Got it, you want to...")
 * - Clarifying questions when ambiguous
 * - Execute actions when appropriate
 * - Multi-turn context awareness
 */

import { sarahManager } from './SarahManager'
import { intentClassifier } from './IntentClassifier'
import { sessionContext } from './SessionContext'
import { commandRegistry } from '../terminal/CommandRegistry'
import { parseCommand } from '../terminal/CommandParser'

// Echo templates by intent category
const ECHO_TEMPLATES = {
  crime_advice: [
    "Looking for a score, huh?",
    "Crime tips coming up.",
    "Let me find you something good...",
    "Checking what's available at your level...",
  ],
  money_advice: [
    "Need help stacking that paper?",
    "Money moves, got it.",
    "Let me break down your options...",
    "Checking the best ways to earn...",
  ],
  stat_analysis: [
    "Checking your status...",
    "Let me pull up your stats...",
    "Running a quick analysis...",
    "Looking at your situation...",
  ],
  heat_advice: [
    "Worried about the heat? Smart.",
    "Let me see how hot you are...",
    "Checking your wanted level...",
    "Heat check coming up...",
  ],
  time_management: [
    "Wondering what to do next?",
    "Let me figure out your priorities...",
    "Analyzing your situation...",
    "Checking what makes sense right now...",
  ],
  job_advice: [
    "Looking for legit work?",
    "Jobs, got it.",
    "Let me check what's hiring...",
  ],
  ai_intel: [
    "Intel request received.",
    "Let me dig up what I know...",
    "Checking my sources...",
  ],
  market_analysis: [
    "Market analysis coming up...",
    "Let me check the prices...",
    "Looking at the current market...",
  ],
  crew_management: [
    "Crew questions, got it.",
    "Let me check your crew situation...",
  ],
  equipment_advice: [
    "Looking for gear?",
    "Equipment check...",
  ],
  location_tips: [
    "District info coming up...",
    "Let me tell you about that area...",
  ],
  help: null, // No echo for help
  greeting: null, // No echo for greetings
  thanks: null, // No echo for thanks
  who_are_you: null, // No echo for identity questions
}

// Clarification templates
const CLARIFICATION_TEMPLATES = [
  "I'm not 100% sure what you need. Are you asking about {options}?",
  "Just to make sure - did you mean {options}?",
  "I want to help. Are you looking for {options}?",
  "Could you clarify? Are you asking about {options}?",
]

class ConversationalSarahClass {
  constructor() {
    this.initialized = false
  }

  /**
   * Initialize the conversational layer
   */
  initialize() {
    if (this.initialized) return
    this.initialized = true
    console.log('[ConversationalSarah] Initialized')
  }

  /**
   * Process user input conversationally
   * @param {string} input - User input
   * @param {object} terminal - Terminal manager reference
   * @returns {object} Response { output: [], type: 'sarah' }
   */
  async processInput(input, terminal) {
    const trimmed = input.trim()
    if (!trimmed) {
      return this.formatResponse("What's on your mind?")
    }

    // Resolve any pronouns/references from context
    const resolvedInput = sessionContext.resolveAnaphora(trimmed)

    // Check if this is a response to a pending clarification
    if (sessionContext.hasPendingClarification()) {
      return this.handleClarificationResponse(resolvedInput, terminal)
    }

    // Check if this is a follow-up to the previous turn
    if (sessionContext.isFollowUp(resolvedInput)) {
      return this.handleFollowUp(resolvedInput, terminal)
    }

    // Classify the intent
    const classification = intentClassifier.classifyIntent(resolvedInput)

    // Build the response
    const lines = []

    // 1. Generate echo/confirmation (if appropriate)
    const echo = this.generateEcho(resolvedInput, classification)
    if (echo) {
      lines.push({ text: `[S.A.R.A.H.] ${echo}`, type: 'sarah' })
    }

    // 2. Check if we should ask for clarification
    if (classification.confidence < 0.25) {
      const clarification = this.generateClarification(resolvedInput, classification)
      sessionContext.setPendingClarification({
        originalInput: resolvedInput,
        classification,
        options: clarification.options,
      })
      lines.push({ text: `[S.A.R.A.H.] ${clarification.message}`, type: 'sarah' })
      return { output: lines, type: 'sarah' }
    }

    // 3. Check if this maps to an executable action
    const action = this.detectAction(resolvedInput, classification)
    if (action) {
      const actionResult = await this.executeAction(action, terminal)
      if (actionResult.echo) {
        lines.push({ text: `[S.A.R.A.H.] ${actionResult.echo}`, type: 'sarah' })
      }
      // The command itself will produce output, so we might not need more
      if (actionResult.skipResponse) {
        sessionContext.addTurn(resolvedInput, actionResult.echo || '', classification.intent, classification.entities)
        return { output: lines, type: 'sarah' }
      }
    }

    // 4. Get the main response from SarahManager
    const response = await sarahManager.processQuery(resolvedInput)

    // Merge responses
    if (response && response.output) {
      const responseLines = Array.isArray(response.output) ? response.output : [response.output]
      // If we already have an echo, skip the first line (which is usually the S.A.R.A.H. header)
      const startIndex = echo ? 1 : 0
      for (let i = startIndex; i < responseLines.length; i++) {
        const line = responseLines[i]
        if (typeof line === 'object') {
          lines.push(line)
        } else {
          lines.push({ text: line, type: 'sarah' })
        }
      }
    }

    // Store in session context
    const responseText = lines.map(l => l.text || l).join(' ')
    sessionContext.addTurn(resolvedInput, responseText, classification.intent, classification.entities)

    return { output: lines, type: 'sarah' }
  }

  /**
   * Generate an echo/confirmation for the user's input
   */
  generateEcho(input, classification) {
    const templates = ECHO_TEMPLATES[classification.intent]

    // No echo for certain intents
    if (templates === null) {
      return null
    }

    // Pick a random template if available
    if (templates && templates.length > 0) {
      return templates[Math.floor(Math.random() * templates.length)]
    }

    // Default echo for unknown intents with decent confidence
    if (classification.confidence >= 0.4) {
      return "Let me help with that..."
    }

    return null
  }

  /**
   * Generate a clarifying question
   */
  generateClarification(input, classification) {
    // Get top matches from intent classifier
    const topMatches = intentClassifier.getTopMatches ? intentClassifier.getTopMatches(input, 3) : []

    if (topMatches.length === 0) {
      return {
        message: "I'm not sure what you need. Try asking about crime tips, money, stats, or type 'help' to see what I can do.",
        options: []
      }
    }

    if (topMatches.length === 1) {
      return {
        message: `I think you're asking about ${topMatches[0].friendlyName}. Is that right? (yes/no)`,
        options: [topMatches[0]]
      }
    }

    const optionNames = topMatches.slice(0, 3).map(m => m.friendlyName)
    const optionsStr = optionNames.slice(0, -1).join(', ') + ', or ' + optionNames[optionNames.length - 1]

    const template = CLARIFICATION_TEMPLATES[Math.floor(Math.random() * CLARIFICATION_TEMPLATES.length)]
    const message = template.replace('{options}', optionsStr)

    return { message, options: topMatches }
  }

  /**
   * Handle a response to a pending clarification
   */
  async handleClarificationResponse(input, terminal) {
    const clarification = sessionContext.getPendingClarification()
    sessionContext.clearClarification()

    const normalized = input.toLowerCase().trim()

    // Check for affirmative response
    if (/^(yes|yeah|yep|yea|sure|ok|okay|right|correct|that'?s? (it|right))$/i.test(normalized)) {
      // User confirmed - use the top match
      if (clarification.options && clarification.options.length > 0) {
        const confirmedIntent = clarification.options[0]
        return this.formatResponse(`Got it! ${confirmedIntent.friendlyName} it is.`)
      }
    }

    // Check for negative response
    if (/^(no|nope|nah|not really|wrong|that'?s? not (it|right))$/i.test(normalized)) {
      return this.formatResponse("No problem. What would you like to know? Try being more specific or type 'help'.")
    }

    // Check if they specified an option
    if (clarification.options) {
      for (const option of clarification.options) {
        if (normalized.includes(option.friendlyName.toLowerCase())) {
          // They specified this option - process it
          return this.formatResponse(`${option.friendlyName}, got it. Let me help with that...`)
        }
      }
    }

    // Treat as new input
    return this.processInput(input, terminal)
  }

  /**
   * Handle a follow-up to the previous turn
   */
  async handleFollowUp(input, terminal) {
    const prevTurn = sessionContext.getPreviousTurn()

    if (!prevTurn) {
      // No previous turn - treat as new input
      return this.processInput(input, terminal)
    }

    const normalized = input.toLowerCase().trim()

    // "Tell me more" type follow-ups
    if (/^(tell me more|more info|details|explain|go on|continue)$/i.test(normalized)) {
      return this.formatResponse("What specifically would you like to know more about?")
    }

    // "Why?" or "How?" follow-ups
    if (/^(why|how)\??$/i.test(normalized)) {
      return this.formatResponse(`Good question. About ${sessionContext.currentTopic || 'that'} - what specifically are you wondering?`)
    }

    // Otherwise process as new input with context
    return this.processInput(input, terminal)
  }

  /**
   * Detect if input implies an executable action
   */
  detectAction(input, classification) {
    const normalized = input.toLowerCase()

    // Navigation patterns
    const navPatterns = [
      { pattern: /^(go|take me|bring me|head|navigate)( to)? (.+)$/i, action: 'navigate', extract: (m) => m[3] },
      { pattern: /^let'?s go( to)? (.+)$/i, action: 'navigate', extract: (m) => m[2] },
    ]

    for (const { pattern, action, extract } of navPatterns) {
      const match = normalized.match(pattern)
      if (match) {
        return { type: action, target: extract(match) }
      }
    }

    // Status check
    if (/^(show|check|get)( me)?( my)? (stats?|status)$/i.test(normalized)) {
      return { type: 'status' }
    }

    // Clear
    if (/^clear( the)?( screen| terminal)?$/i.test(normalized)) {
      return { type: 'clear' }
    }

    return null
  }

  /**
   * Execute a detected action
   */
  async executeAction(action, terminal) {
    switch (action.type) {
      case 'navigate': {
        const target = action.target
        // Check if this is a valid navigation target
        const goCommand = `go ${target}`
        const parsed = parseCommand(goCommand)

        // Execute the command through the terminal
        if (terminal && terminal.executeCommand) {
          terminal.executeCommand(goCommand)
          sessionContext.setActionContext('navigate', target)
          return {
            echo: `Taking you to ${target}...`,
            skipResponse: true
          }
        }
        return { echo: null, skipResponse: false }
      }

      case 'status':
        if (terminal && terminal.executeCommand) {
          terminal.executeCommand('status')
          return { echo: null, skipResponse: true }
        }
        return { echo: null, skipResponse: false }

      case 'clear':
        if (terminal && terminal.executeCommand) {
          terminal.executeCommand('clear')
          return { echo: 'Clearing...', skipResponse: true }
        }
        return { echo: null, skipResponse: false }

      default:
        return { echo: null, skipResponse: false }
    }
  }

  /**
   * Format a simple response
   */
  formatResponse(text) {
    const lines = text.split('\n')
    return {
      output: lines.map((line, index) => ({
        text: index === 0 ? `[S.A.R.A.H.] ${line}` : `           ${line}`,
        type: 'sarah',
      })),
      type: 'sarah',
    }
  }

  /**
   * Get session stats for debugging
   */
  getStats() {
    return {
      ...sessionContext.getStats(),
      initialized: this.initialized,
    }
  }
}

// Singleton instance
export const conversationalSarah = new ConversationalSarahClass()
export default conversationalSarah
