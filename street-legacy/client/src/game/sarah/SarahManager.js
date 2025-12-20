/**
 * SarahManager - Core AI engine for S.A.R.A.H.
 * Street Autonomous Response & Assistance Hub
 *
 * Main singleton that coordinates all S.A.R.A.H. components:
 * - Intent classification
 * - Response generation
 * - Knowledge base queries
 * - Proactive monitoring
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'
import { sarahPersonality, SARAH_IDENTITY } from './SarahPersonality'
import { intentClassifier, INTENT_TYPES } from './IntentClassifier'
import { responseGenerator } from './ResponseGenerator'
import { sarahKnowledgeBase } from './SarahKnowledgeBase'
import { proactiveMonitor } from './ProactiveMonitor'

class SarahManagerClass {
  constructor() {
    this.isInitialized = false
    this.conversationContext = [] // Recent Q&A for context
    this.maxContextLength = 5 // Remember last 5 exchanges

    // Debug mode
    this.debugMode = false
  }

  /**
   * Initialize S.A.R.A.H. system
   */
  initialize() {
    if (this.isInitialized) {
      console.log('[SarahManager] Already initialized')
      return
    }

    // Initialize proactive monitor with callback
    proactiveMonitor.initialize(this.handleProactiveNotification.bind(this))

    this.isInitialized = true
    console.log('[SarahManager] S.A.R.A.H. initialized - Street Autonomous Response & Assistance Hub online')
  }

  /**
   * Shutdown S.A.R.A.H.
   */
  shutdown() {
    proactiveMonitor.shutdown()
    this.isInitialized = false
    console.log('[SarahManager] S.A.R.A.H. shutdown')
  }

  /**
   * Process a user query and generate response
   * @param {string} query - User's question/input
   * @returns {object} Response object { output, type }
   */
  async processQuery(query) {
    if (!query || query.trim().length === 0) {
      return this.formatOutput(sarahPersonality.getGreeting())
    }

    const normalizedQuery = query.trim()

    try {
      // Classify intent
      const classification = intentClassifier.classifyIntent(normalizedQuery)

      if (this.debugMode) {
        console.log('[SarahManager] Classification:', classification)
      }

      // Build context
      const context = this.buildContext(normalizedQuery, classification)

      // Generate response based on intent
      let response

      if (classification.intent === INTENT_TYPES.UNKNOWN || classification.confidence < 0.3) {
        // Try FAQ as fallback
        const faqAnswer = sarahKnowledgeBase.findFAQ(normalizedQuery)
        if (faqAnswer) {
          response = faqAnswer
        } else {
          response = sarahPersonality.getUnknownResponse()
        }
      } else {
        response = responseGenerator.generateResponse(
          classification.intent,
          context,
          classification.entities
        )
      }

      // Store in conversation context
      this.addToContext(normalizedQuery, response, classification.intent)

      return this.formatOutput(response)

    } catch (error) {
      console.error('[SarahManager] Error processing query:', error)
      return this.formatOutput(sarahPersonality.getErrorResponse())
    }
  }

  /**
   * Build context object for response generation
   */
  buildContext(query, classification) {
    const player = gameManager.player || {}

    return {
      originalQuery: query,
      intent: classification.intent,
      confidence: classification.confidence,
      entities: classification.entities,
      player: {
        level: player.level || 1,
        energy: player.energy || 0,
        heat: player.heat || 0,
        cash: player.cash || 0,
        bank: player.bank || 0,
        health: player.health || 100,
        respect: player.respect || 0,
      },
      recentContext: this.conversationContext,
    }
  }

  /**
   * Add exchange to conversation context
   */
  addToContext(query, response, intent) {
    this.conversationContext.unshift({
      query,
      response: response.substring(0, 100), // Truncate for memory
      intent,
      timestamp: Date.now(),
    })

    // Trim to max length
    if (this.conversationContext.length > this.maxContextLength) {
      this.conversationContext.pop()
    }
  }

  /**
   * Get quick contextual advice without a specific query
   */
  getQuickAdvice() {
    const player = gameManager.player

    if (!player) {
      return this.formatOutput("Can't read your stats right now. Try again in a moment.")
    }

    const tips = sarahKnowledgeBase.getContextualTip(player)
    const tip = Array.isArray(tips) ? tips[0] : tips

    return this.formatOutput(tip)
  }

  /**
   * Get a greeting response
   */
  getGreeting() {
    return this.formatOutput(sarahPersonality.getGreeting())
  }

  /**
   * Get help information
   */
  getHelp() {
    const response = responseGenerator.generateResponse(INTENT_TYPES.HELP, {}, {})
    return this.formatOutput(response)
  }

  /**
   * Get identity information
   */
  getIdentity() {
    return this.formatOutput(
      `I'm ${SARAH_IDENTITY.name} - ${SARAH_IDENTITY.fullName}. ` +
      `Your personal AI guide to the streets. Version ${SARAH_IDENTITY.version}. ` +
      `I analyze stats, recommend moves, and keep you ahead of the game. What do you need?`
    )
  }

  /**
   * Handle proactive notifications from the monitor
   */
  handleProactiveNotification(notification) {
    if (!notification || !notification.message) return

    // Add S.A.R.A.H. message to terminal
    if (terminalManager) {
      const outputType = OUTPUT_TYPES.SARAH || OUTPUT_TYPES.SYSTEM
      terminalManager.addOutput(`[S.A.R.A.H.] ${notification.message}`, outputType)
    }
  }

  /**
   * Format output for terminal display
   */
  formatOutput(text) {
    // Split multi-line responses
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
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled
    console.log(`[SarahManager] Debug mode: ${enabled ? 'ON' : 'OFF'}`)
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      contextLength: this.conversationContext.length,
      proactiveStatus: proactiveMonitor.getStatus(),
      personality: sarahPersonality.getPersonalityInfo(),
    }
  }

  /**
   * Clear conversation context
   */
  clearContext() {
    this.conversationContext = []
  }

  /**
   * Force a proactive check
   */
  forceProactiveCheck() {
    proactiveMonitor.forceCheck()
  }
}

// Singleton instance
export const sarahManager = new SarahManagerClass()

// Auto-initialize when game manager is ready
if (typeof window !== 'undefined') {
  // Wait a bit for game to be ready
  setTimeout(() => {
    if (gameManager.player) {
      sarahManager.initialize()
    }
  }, 2000)
}

export default sarahManager
