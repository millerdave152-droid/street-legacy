/**
 * IntelligenceCoordinator - Unified AI Intelligence Layer
 *
 * Orchestrates all intelligence systems for the terminal:
 * - PredictiveInputEngine (ghost text suggestions)
 * - SmartErrorCorrector (typo correction)
 * - IntentPredictionEngine (next action hints)
 * - ContextMemoryManager (cross-session memory)
 */

import { gameManager } from '../GameManager'
import { terminalManager } from '../managers/TerminalManager'
import { predictiveInputEngine } from './PredictiveInputEngine'
import { contextMemoryManager } from './ContextMemoryManager'

class IntelligenceCoordinatorClass {
  constructor() {
    this.isInitialized = false
    this.listeners = []
    this.currentPredictions = null
    this.lastInputTime = 0
    this.isProcessingEvent = false  // Guard against recursive event handling
  }

  /**
   * Initialize all intelligence subsystems
   */
  initialize() {
    if (this.isInitialized) return

    // Initialize subsystems
    contextMemoryManager.initialize()
    predictiveInputEngine.initialize()

    // Subscribe to terminal events
    this.terminalUnsubscribe = terminalManager.addListener((event, data) => {
      this.handleTerminalEvent(event, data)
    })

    // Subscribe to game events for context tracking
    if (gameManager.on) {
      gameManager.on('crimeCompleted', (result) => {
        contextMemoryManager.recordAction('crime', result)
        this.updatePredictions()
      })

      gameManager.on('playerUpdated', () => {
        this.updatePredictions()
      })
    }

    this.isInitialized = true
    console.log('[IntelligenceCoordinator] Initialized')
  }

  /**
   * Handle terminal events for learning and predictions
   */
  handleTerminalEvent(event, data) {
    // Guard against recursive event handling
    if (this.isProcessingEvent) {
      return
    }

    this.isProcessingEvent = true

    try {
      switch (event) {
        case 'input':
          // Update predictions as user types
          this.lastInputTime = Date.now()
          const predictions = this.getPredictions(data.input)
          this.currentPredictions = predictions
          this.notifyListeners('predictions', predictions)
          break

        case 'output':
          // Track executed commands
          if (data.type === 'command') {
            const command = data.text?.replace(/^>\s*/, '') || ''
            this.onCommandExecuted(command)
          }
          break
      }
    } finally {
      this.isProcessingEvent = false
    }
  }

  /**
   * Called when a command is executed - for learning
   */
  onCommandExecuted(command) {
    if (!command) return

    // Record in context memory
    const gameState = this.getGameState()
    contextMemoryManager.recordCommand(command, { success: true }, gameState)

    // Update frequency data for predictions
    predictiveInputEngine.recordCommand(command, gameState)
  }

  /**
   * Get current game state for context
   */
  getGameState() {
    const player = gameManager?.player || {}
    return {
      player: {
        level: player.level || 1,
        cash: player.cash || 0,
        heat: player.heat || 0,
        energy: player.energy || 100,
        location: player.current_district_id || 'downtown'
      },
      lastInputTime: this.lastInputTime
    }
  }

  /**
   * Get predictions for current input
   * @param {string} partialInput - Current input text
   * @returns {Object} Predictions object with autocomplete and hints
   */
  getPredictions(partialInput) {
    const gameState = this.getGameState()

    return {
      // Ghost text suggestions
      autocomplete: predictiveInputEngine.getPredictions(partialInput, gameState),

      // Next action hints (show when input is empty or after delay)
      hints: partialInput.length === 0
        ? this.getActionHints(gameState)
        : [],

      // Current input for reference
      input: partialInput
    }
  }

  /**
   * Get contextual action hints based on game state
   */
  getActionHints(gameState) {
    const hints = []
    const player = gameState.player

    // Low cash hint
    if (player.cash < 500) {
      hints.push({
        cmd: 'crime',
        hint: 'Low on cash? Time for a job.',
        priority: 80
      })
    }

    // High heat warning
    if (player.heat > 70) {
      hints.push({
        cmd: 'lay low',
        hint: `Heat at ${player.heat}% - Consider laying low`,
        priority: 95
      })
    }

    // Low energy
    if (player.energy < 20) {
      hints.push({
        cmd: 'rest',
        hint: 'Energy low. Rest to recharge.',
        priority: 85
      })
    }

    // Check for pending opportunities
    const unreadCount = this.getUnreadMessageCount()
    if (unreadCount > 0) {
      hints.push({
        cmd: 'opportunities',
        hint: `${unreadCount} pending offer${unreadCount > 1 ? 's' : ''}`,
        priority: 70
      })
    }

    return hints.sort((a, b) => b.priority - a.priority).slice(0, 3)
  }

  /**
   * Get unread message count (integrate with opportunity system)
   */
  getUnreadMessageCount() {
    try {
      const opportunityManager = require('../opportunity/OpportunityManager').opportunityManager
      return opportunityManager?.getActiveOpportunities()?.length || 0
    } catch (e) {
      return 0
    }
  }

  /**
   * Get the top prediction for ghost text
   */
  getTopPrediction(input) {
    if (!input || input.length < 1) return null

    const predictions = predictiveInputEngine.getPredictions(input, this.getGameState())
    return predictions.length > 0 ? predictions[0] : null
  }

  /**
   * Get personalized greeting based on session history
   */
  getGreeting() {
    return contextMemoryManager.getPersonalizedGreeting()
  }

  /**
   * Check if user seems frustrated (repeated errors)
   */
  isFrustrated() {
    return contextMemoryManager.checkFrustration()
  }

  /**
   * Resolve pronoun references in input
   * e.g., "msg them" -> "msg snoop" (if snoop was last mentioned)
   */
  resolveReferences(input) {
    return contextMemoryManager.resolveReference(input)
  }

  /**
   * Add a listener for intelligence events
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Notify listeners of events
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data)
      } catch (e) {
        console.error('[IntelligenceCoordinator] Listener error:', e)
      }
    })
  }

  /**
   * Trigger prediction update
   */
  updatePredictions() {
    const input = terminalManager?.inputBuffer || ''
    const predictions = this.getPredictions(input)
    this.currentPredictions = predictions
    this.notifyListeners('predictions', predictions)
  }

  /**
   * End session and save data
   */
  endSession() {
    contextMemoryManager.endSession()
    predictiveInputEngine.save()
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.terminalUnsubscribe) {
      this.terminalUnsubscribe()
    }
    this.endSession()
    this.isInitialized = false
  }
}

// Singleton instance
export const intelligenceCoordinator = new IntelligenceCoordinatorClass()
export default intelligenceCoordinator
