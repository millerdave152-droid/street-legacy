/**
 * SarahManager - Core AI engine for S.A.R.A.H.
 * Street Autonomous Response & Assistance Hub
 *
 * Main singleton that coordinates all S.A.R.A.H. components:
 * - Intent classification
 * - Response generation
 * - Knowledge base queries
 * - Proactive monitoring
 * - Conversation memory (persistent)
 * - AI player intel
 * - Visual formatting
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'
import { sarahPersonality, SARAH_IDENTITY } from './SarahPersonality'
import { intentClassifier, INTENT_TYPES } from './IntentClassifier'
import { semanticIntentClassifier } from './SemanticIntentClassifier'
import { responseGenerator } from './ResponseGenerator'
import { sarahKnowledgeBase } from './SarahKnowledgeBase'
import { proactiveMonitor } from './ProactiveMonitor'
import { conversationMemory } from './ConversationMemory'
import { aiIntelAnalyzer } from './AIIntelAnalyzer'
import { visualFormatter } from './VisualFormatter'

class SarahManagerClass {
  constructor() {
    this.isInitialized = false
    this.conversationContext = [] // Recent Q&A for context (backup)
    this.maxContextLength = 5 // Remember last 5 exchanges

    // Debug mode
    this.debugMode = false

    // Current exchange ID for decision tracking
    this.currentExchangeId = null

    // Semantic understanding mode (enabled by default)
    this.useSemanticMode = true
  }

  /**
   * Initialize S.A.R.A.H. system
   */
  initialize() {
    if (this.isInitialized) {
      console.log('[SarahManager] Already initialized')
      return
    }

    // Initialize semantic understanding engine
    if (this.useSemanticMode) {
      semanticIntentClassifier.initialize()
      console.log('[SarahManager] Semantic understanding engine initialized')
    }

    // Initialize conversation memory (loads from localStorage)
    conversationMemory.initialize()

    // Initialize proactive monitor with callback
    proactiveMonitor.initialize(this.handleProactiveNotification.bind(this))

    this.isInitialized = true

    // Log memory stats
    const memStats = conversationMemory.getStats()
    console.log(`[SarahManager] S.A.R.A.H. initialized - ${memStats.totalExchanges} exchanges in memory`)
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
      // Check for similar past queries
      const pastQuery = conversationMemory.findSimilarPastQuery(normalizedQuery)

      // Classify intent using semantic or pattern matching
      let classification
      if (this.useSemanticMode) {
        // Use semantic classification with slang/typo handling
        classification = semanticIntentClassifier.classifyIntent(normalizedQuery)
      } else {
        // Fallback to pattern-only classification
        classification = intentClassifier.classifyIntent(normalizedQuery)
      }

      if (this.debugMode) {
        console.log('[SarahManager] Classification:', classification)
        console.log('[SarahManager] Source:', classification.source || 'pattern')
        if (classification.preprocessed?.wasModified) {
          console.log('[SarahManager] Input normalized:', classification.preprocessed.normalized)
        }
        if (pastQuery) {
          console.log('[SarahManager] Similar past query found:', pastQuery.type)
        }
      }

      // Build context with memory info
      const context = this.buildContext(normalizedQuery, classification)

      // Add player preferences from memory
      context.preferences = conversationMemory.getPlayerPreferences()
      context.relatedHistory = conversationMemory.getRelatedHistory(normalizedQuery, 2)

      // Generate response based on intent
      let response

      // If exact same question was asked before, acknowledge it
      if (pastQuery && pastQuery.type === 'exact') {
        response = `${pastQuery.message}\n\n${pastQuery.exchange.response}`
      } else if (classification.intent === INTENT_TYPES.UNKNOWN || classification.confidence < 0.15) {
        // Smart fallback: Try to understand what user might be asking
        response = this.generateSmartFallback(normalizedQuery, classification)
      } else {
        response = responseGenerator.generateResponse(
          classification.intent,
          context,
          classification.entities
        )
      }

      // Store in persistent conversation memory
      const player = gameManager.player || {}
      this.currentExchangeId = conversationMemory.addExchange(
        normalizedQuery,
        response,
        classification.intent,
        {
          level: player.level || 1,
          energy: player.energy || 0,
          heat: player.heat || 0,
          cash: player.cash || 0,
        }
      )

      // Also store in session context (backup)
      this.addToContext(normalizedQuery, response, classification.intent)

      return this.formatOutput(response)

    } catch (error) {
      console.error('[SarahManager] Error processing query:', error)
      return this.formatOutput(sarahPersonality.getErrorResponse())
    }
  }

  /**
   * Track decision outcome (call after player acts on advice)
   */
  trackDecision(actionTaken, outcome = null) {
    if (this.currentExchangeId) {
      conversationMemory.trackDecision(this.currentExchangeId, actionTaken, outcome)
    }
  }

  /**
   * Generate a smart fallback response when query isn't clear
   * Suggests similar topics, asks clarifying questions, or guides user
   */
  generateSmartFallback(query, classification) {
    // First check FAQ
    const faqAnswer = sarahKnowledgeBase.findFAQ(query)
    if (faqAnswer) {
      return faqAnswer
    }

    // Use semantic suggestions if in semantic mode
    if (this.useSemanticMode) {
      const semanticSuggestions = semanticIntentClassifier.getSuggestions(query)
      const concepts = semanticIntentClassifier.getConcepts(query)

      if (semanticSuggestions.length > 0 && semanticSuggestions[0].confidence > 0.2) {
        const bestMatch = semanticSuggestions[0]
        const suggestions = semanticSuggestions.slice(0, 3)
          .map(s => `• ${s.friendlyName} - ${s.suggestion}`)
          .join('\n')

        return `I think you might be asking about ${bestMatch.friendlyName}.\n\n` +
               `Here's what I can help with:\n${suggestions}\n\n` +
               `Or type "help" to see everything I can do.`
      }

      // If we detected concepts but no strong intent
      if (concepts.length > 0) {
        const conceptList = concepts.slice(0, 3).join(', ')
        return `I picked up on "${conceptList}" but I'm not 100% sure what you need.\n\n` +
               `Try being more specific, like:\n` +
               `• "How do I make money?"\n` +
               `• "What crime should I do?"\n` +
               `• "Check my stats"\n\n` +
               `Just talk naturally - I understand street talk and typos!`
      }
    }

    // Fallback to pattern-based suggestions
    const topMatches = intentClassifier.getTopMatches(query, 3)

    if (topMatches.length > 0) {
      const clarifyingQuestion = intentClassifier.getClarifyingQuestion(query, topMatches)

      if (topMatches[0].score >= 1.5) {
        const bestMatch = topMatches[0]
        const suggestions = topMatches.map(m => `• "${m.friendlyName}"`).join('\n')

        return `I'm not 100% sure what you need, but I think you might be asking about ${bestMatch.friendlyName}.\n\n` +
               `Try asking me about:\n${suggestions}\n\n` +
               `Or type "help" to see everything I can do.`
      }

      if (clarifyingQuestion) {
        return `${clarifyingQuestion}\n\nTip: Type "help" to see all the things I can help with.`
      }
    }

    // Check if query contains any recognizable words at all
    const recognizedWords = intentClassifier.getRecognizedWords(query)

    if (recognizedWords.length > 0) {
      return `I heard "${recognizedWords.join(', ')}" but I'm not sure what you need.\n\n` +
             `Try being more specific, like:\n` +
             `• "How do I make money?"\n` +
             `• "What crime should I do?"\n` +
             `• "Check my stats"\n` +
             `• "Tell me about [player name]"\n\n` +
             `Type "help" for the full menu.`
    }

    // Complete unknown - give a friendly guide
    const quickTips = [
      '• "money" or "cash" - money tips',
      '• "crime" or "score" - crime recommendations',
      '• "heat" or "cops" - how to cool down',
      '• "stats" or "me" - check your status',
      '• "help" - see everything I can do',
    ]

    return `Not sure I follow, runner. Here are some things you can ask me:\n\n` +
           `${quickTips.join('\n')}\n\n` +
           `Just type naturally - I understand street talk and typos too!`
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
   * Get a greeting response (personalized based on history)
   */
  getGreeting() {
    // Try to get personalized greeting from memory
    const personalizedGreeting = conversationMemory.getPersonalizedGreeting()
    if (personalizedGreeting) {
      return this.formatOutput(personalizedGreeting)
    }
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
   * Enable/disable semantic understanding mode
   */
  setSemanticMode(enabled) {
    this.useSemanticMode = enabled
    if (enabled && !semanticIntentClassifier.initialized) {
      semanticIntentClassifier.initialize()
    }
    console.log(`[SarahManager] Semantic mode: ${enabled ? 'ON' : 'OFF'}`)
  }

  /**
   * Get semantic classification stats
   */
  getSemanticStats() {
    if (!this.useSemanticMode) {
      return { enabled: false }
    }
    return {
      enabled: true,
      ...semanticIntentClassifier.getStats()
    }
  }

  /**
   * Analyze an input in detail (for debugging)
   */
  analyzeInput(input) {
    if (!this.useSemanticMode) {
      return { semanticMode: false, classification: intentClassifier.classifyIntent(input) }
    }
    return semanticIntentClassifier.analyze(input)
  }

  /**
   * Get status information
   */
  getStatus() {
    const memStats = conversationMemory.getStats()
    const threats = aiIntelAnalyzer.getActiveThreats()

    return {
      initialized: this.isInitialized,
      contextLength: this.conversationContext.length,
      proactiveStatus: proactiveMonitor.getStatus(),
      personality: sarahPersonality.getPersonalityInfo(),
      memory: {
        totalExchanges: memStats.totalExchanges,
        totalDecisions: memStats.totalDecisions,
        preferences: memStats.preferences,
      },
      threats: threats.length,
      semantic: this.useSemanticMode ? semanticIntentClassifier.getStats() : { enabled: false },
    }
  }

  /**
   * Get AI player intel
   */
  getAIIntel(playerName) {
    return aiIntelAnalyzer.getAIPlayerIntel(playerName)
  }

  /**
   * Get active threats
   */
  getThreats() {
    return aiIntelAnalyzer.getActiveThreats()
  }

  /**
   * Analyze a trade offer
   */
  analyzeOffer(offer) {
    return aiIntelAnalyzer.analyzeTradeOffer(offer)
  }

  /**
   * Get alliance suggestions
   */
  getAllianceSuggestions() {
    const player = gameManager.player || {}
    return aiIntelAnalyzer.suggestAlliances(player)
  }

  /**
   * Get formatted analysis panel (visual output)
   */
  getFormattedAnalysis(recommendation, confidence = 85) {
    const player = gameManager.player || {}
    return visualFormatter.createAnalysisPanel(player, recommendation, confidence)
  }

  /**
   * Clear conversation memory
   */
  clearMemory() {
    conversationMemory.clearMemory()
    this.conversationContext = []
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
