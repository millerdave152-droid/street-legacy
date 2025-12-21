/**
 * AdventureEngine - Core state machine for text adventures
 *
 * Manages:
 * - Adventure state and progression
 * - Node navigation
 * - Choice handling with skill checks
 * - Consequence application
 * - Save/load state
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'
import { relationshipTracker } from '../opportunity/RelationshipTracker'
import { adventureParser } from './AdventureParser'
import { adventureRegistry } from './AdventureRegistry'

// Adventure states
export const ADVENTURE_STATES = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABANDONED: 'abandoned',
}

// Consequence types
export const CONSEQUENCE_TYPES = {
  CASH: 'cash',
  HEAT: 'heat',
  XP: 'xp',
  HEALTH: 'health',
  ENERGY: 'energy',
  RESPECT: 'respect',
  ITEM_GIVE: 'item_give',
  ITEM_TAKE: 'item_take',
  RELATIONSHIP: 'relationship',
  UNLOCK: 'unlock',
  FLAG: 'flag',
  JAIL: 'jail',
  ADVENTURE_START: 'adventure_start',
}

class AdventureEngineClass {
  constructor() {
    // Current adventure state
    this.currentAdventure = null
    this.currentNode = null
    this.adventureState = ADVENTURE_STATES.INACTIVE

    // Adventure progress
    this.visitedNodes = new Set()
    this.choiceHistory = []
    this.flags = new Map()            // Adventure-specific flags
    this.globalFlags = new Map()      // Persistent flags across adventures

    // Timing
    this.startTime = null
    this.totalTime = 0

    // Callbacks
    this.onStateChange = null
    this.onNodeChange = null
    this.onAdventureEnd = null

    this.initialized = false
  }

  /**
   * Initialize the engine
   */
  initialize() {
    if (this.initialized) return

    // Load global flags
    this.loadGlobalFlags()

    // Check for saved adventure in progress
    this.loadSavedState()

    this.initialized = true
    console.log('[AdventureEngine] Initialized')
  }

  /**
   * Start a new adventure
   */
  startAdventure(adventureId) {
    const adventure = adventureRegistry.getAdventure(adventureId)

    if (!adventure) {
      return {
        success: false,
        error: `Adventure "${adventureId}" not found.`
      }
    }

    // Check requirements
    if (adventure.requirements) {
      const meetsReq = this.checkRequirements(adventure.requirements)
      if (!meetsReq.success) {
        return {
          success: false,
          error: meetsReq.message || 'Requirements not met.'
        }
      }
    }

    // Initialize adventure state
    this.currentAdventure = adventure
    this.adventureState = ADVENTURE_STATES.ACTIVE
    this.visitedNodes = new Set()
    this.choiceHistory = []
    this.flags = new Map()
    this.startTime = Date.now()
    this.totalTime = 0

    // Navigate to start node
    const startNodeId = adventure.startNode || 'start'
    this.navigateToNode(startNodeId)

    // Save state
    this.saveState()

    // Callback
    if (this.onStateChange) {
      this.onStateChange(this.adventureState, this.currentAdventure)
    }

    console.log('[AdventureEngine] Started adventure:', adventureId)

    return {
      success: true,
      adventure: adventure,
      output: this.renderCurrentNode()
    }
  }

  /**
   * Navigate to a specific node
   */
  navigateToNode(nodeId) {
    if (!this.currentAdventure) {
      return { success: false, error: 'No active adventure.' }
    }

    const node = this.currentAdventure.nodes[nodeId]

    if (!node) {
      console.error('[AdventureEngine] Node not found:', nodeId)
      return { success: false, error: `Node "${nodeId}" not found.` }
    }

    // Mark as visited
    this.visitedNodes.add(nodeId)

    // Update current node
    this.currentNode = { ...node, id: nodeId }

    // Apply any automatic consequences
    if (node.consequences) {
      this.applyConsequences(node.consequences)
    }

    // Check for auto-navigation (nodes that immediately redirect)
    if (node.autoNext) {
      // Delay slightly for dramatic effect
      setTimeout(() => {
        this.navigateToNode(node.autoNext)
      }, 100)
    }

    // Check for adventure end
    if (node.isEnding) {
      this.endAdventure(node.endingType || 'completed', node.endingMessage)
    }

    // Callback
    if (this.onNodeChange) {
      this.onNodeChange(this.currentNode)
    }

    this.saveState()

    return { success: true, node: this.currentNode }
  }

  /**
   * Process player input during adventure
   */
  processInput(input) {
    if (this.adventureState !== ADVENTURE_STATES.ACTIVE) {
      return {
        success: false,
        error: 'No active adventure.',
        output: []
      }
    }

    if (!this.currentNode) {
      return {
        success: false,
        error: 'Invalid adventure state.',
        output: []
      }
    }

    // Check for special commands
    const lowerInput = input.toLowerCase().trim()

    if (lowerInput === 'quit' || lowerInput === 'exit' || lowerInput === 'abandon') {
      return this.abandonAdventure()
    }

    if (lowerInput === 'save') {
      this.saveState()
      return { success: true, output: ['Adventure progress saved.'] }
    }

    if (lowerInput === 'look' || lowerInput === 'where am i') {
      return { success: true, output: this.renderCurrentNode() }
    }

    // Try to match input to a choice
    const choices = this.currentNode.choices || []

    if (choices.length === 0) {
      // No choices = just continue
      if (this.currentNode.next) {
        this.navigateToNode(this.currentNode.next)
        return { success: true, output: this.renderCurrentNode() }
      }
      return {
        success: false,
        error: 'Stuck - no choices and no continuation.',
        output: []
      }
    }

    // Parse input to find matching choice
    const matchResult = adventureParser.matchChoice(input, choices)

    if (!matchResult.matched) {
      // No match found
      return {
        success: false,
        error: matchResult.suggestion ||
          "I don't understand. Type a number or keyword from the choices.",
        output: this.renderChoices()
      }
    }

    // Execute the matched choice
    return this.executeChoice(matchResult.choice)
  }

  /**
   * Execute a chosen option
   */
  executeChoice(choice) {
    // Check if choice has requirements
    if (choice.requirements) {
      const meetsReq = this.checkRequirements(choice.requirements)
      if (!meetsReq.success) {
        return {
          success: false,
          error: choice.requirementFailMessage || meetsReq.message,
          output: this.renderCurrentNode()
        }
      }
    }

    // Check for skill check
    if (choice.skillCheck) {
      const checkResult = this.performSkillCheck(choice.skillCheck)

      if (!checkResult.success) {
        // Failed skill check - go to failure node if specified
        const failNode = choice.failNext || choice.skillCheck.failNext
        if (failNode) {
          // Record choice with failure
          this.recordChoice(choice, false, checkResult)

          // Show failure message
          const output = [
            choice.skillCheck.failMessage || 'The check failed...',
          ]

          this.navigateToNode(failNode)
          return {
            success: true,
            output: [...output, ...this.renderCurrentNode()],
            checkResult
          }
        }
        // No fail node - just show failure message
        return {
          success: false,
          error: choice.skillCheck.failMessage || 'You failed the check.',
          output: this.renderCurrentNode(),
          checkResult
        }
      }

      // Skill check passed
      if (choice.skillCheck.successMessage) {
        // Will be prepended to next node
      }
    }

    // Record choice
    this.recordChoice(choice, true)

    // Apply consequences
    if (choice.consequences) {
      this.applyConsequences(choice.consequences)
    }

    // Set any flags
    if (choice.setFlags) {
      for (const [flag, value] of Object.entries(choice.setFlags)) {
        this.flags.set(flag, value)
      }
    }

    // Navigate to next node
    const nextNode = choice.next || this.currentNode.defaultNext

    if (!nextNode) {
      return {
        success: false,
        error: 'Adventure broken - no next node defined.',
        output: []
      }
    }

    this.navigateToNode(nextNode)

    // Build output
    let output = []

    // Add transition text if any
    if (choice.transitionText) {
      output.push('')
      output.push(choice.transitionText)
    }

    // Add current node render
    output = [...output, ...this.renderCurrentNode()]

    return { success: true, output }
  }

  /**
   * Perform a skill check
   */
  performSkillCheck(check) {
    const player = gameManager.player

    if (!player) {
      return { success: false, message: 'Cannot read player stats.' }
    }

    const stat = check.stat
    const threshold = check.threshold
    const comparison = check.comparison || 'greater'

    let playerValue

    switch (stat) {
      case 'heat': playerValue = player.heat || 0; break
      case 'level': playerValue = player.level || 1; break
      case 'cash': playerValue = player.cash || 0; break
      case 'health': playerValue = player.health || 100; break
      case 'energy': playerValue = player.energy || 0; break
      case 'respect': playerValue = player.respect || 0; break
      default: playerValue = 0
    }

    let success = false

    switch (comparison) {
      case 'greater':
      case 'more':
        success = playerValue > threshold
        break
      case 'less':
      case 'fewer':
        success = playerValue < threshold
        break
      case 'equal':
        success = playerValue === threshold
        break
      case 'greaterEqual':
      case 'atLeast':
        success = playerValue >= threshold
        break
      case 'lessEqual':
      case 'atMost':
        success = playerValue <= threshold
        break
      default:
        success = playerValue >= threshold
    }

    // Random factor (if specified)
    if (check.randomFactor) {
      const roll = Math.random()
      success = success && (roll <= check.randomFactor)
    }

    return {
      success,
      stat,
      playerValue,
      threshold,
      comparison
    }
  }

  /**
   * Check if requirements are met
   */
  checkRequirements(requirements) {
    const player = gameManager.player

    if (!player) {
      return { success: false, message: 'Cannot verify requirements.' }
    }

    // Level requirement
    if (requirements.minLevel && player.level < requirements.minLevel) {
      return { success: false, message: `Requires level ${requirements.minLevel}` }
    }

    // Cash requirement
    if (requirements.minCash && player.cash < requirements.minCash) {
      return { success: false, message: `Requires $${requirements.minCash}` }
    }

    // Heat requirement (max)
    if (requirements.maxHeat && player.heat > requirements.maxHeat) {
      return { success: false, message: `Heat must be below ${requirements.maxHeat}` }
    }

    // Flag requirements
    if (requirements.flags) {
      for (const [flag, requiredValue] of Object.entries(requirements.flags)) {
        const currentValue = this.flags.get(flag) ?? this.globalFlags.get(flag)
        if (currentValue !== requiredValue) {
          return { success: false, message: requirements.flagFailMessage || 'Requirements not met.' }
        }
      }
    }

    // Item requirements
    if (requirements.items) {
      // TODO: Check player inventory
    }

    return { success: true }
  }

  /**
   * Apply consequences to player
   */
  applyConsequences(consequences) {
    if (!consequences || !Array.isArray(consequences)) {
      consequences = [consequences]
    }

    for (const consequence of consequences) {
      if (!consequence) continue

      switch (consequence.type) {
        case CONSEQUENCE_TYPES.CASH:
          gameManager.updatePlayerCash?.(consequence.amount)
          break

        case CONSEQUENCE_TYPES.HEAT:
          gameManager.updatePlayerHeat?.(consequence.amount)
          break

        case CONSEQUENCE_TYPES.XP:
          gameManager.addExperience?.(consequence.amount)
          break

        case CONSEQUENCE_TYPES.HEALTH:
          // gameManager.updatePlayerHealth?.(consequence.amount)
          break

        case CONSEQUENCE_TYPES.ENERGY:
          // gameManager.updatePlayerEnergy?.(consequence.amount)
          break

        case CONSEQUENCE_TYPES.RESPECT:
          gameManager.updatePlayerRespect?.(consequence.amount)
          break

        case CONSEQUENCE_TYPES.RELATIONSHIP:
          if (consequence.npcId) {
            relationshipTracker.recordInteraction(
              consequence.npcId,
              consequence.interaction || 'custom',
              consequence.amount
            )
          }
          break

        case CONSEQUENCE_TYPES.FLAG:
          if (consequence.global) {
            this.globalFlags.set(consequence.name, consequence.value)
            this.saveGlobalFlags()
          } else {
            this.flags.set(consequence.name, consequence.value)
          }
          break

        case CONSEQUENCE_TYPES.UNLOCK:
          if (consequence.adventureId) {
            adventureRegistry.unlockAdventure(consequence.adventureId)
          }
          break

        case CONSEQUENCE_TYPES.JAIL:
          // TODO: Trigger jail scene
          break
      }
    }
  }

  /**
   * Record a choice in history
   */
  recordChoice(choice, succeeded, checkResult = null) {
    this.choiceHistory.push({
      nodeId: this.currentNode.id,
      choiceId: choice.id,
      choiceText: choice.text,
      timestamp: Date.now(),
      succeeded,
      checkResult
    })
  }

  /**
   * Render the current node for terminal display
   */
  renderCurrentNode() {
    if (!this.currentNode) {
      return ['No current location.']
    }

    const lines = []

    // Add separator
    lines.push('')
    lines.push('─'.repeat(50))

    // Add node text
    const nodeText = Array.isArray(this.currentNode.text)
      ? this.currentNode.text
      : [this.currentNode.text]

    nodeText.forEach(line => {
      lines.push(line)
    })

    // Add choices
    lines.push(...this.renderChoices())

    return lines
  }

  /**
   * Render choices for terminal display
   */
  renderChoices() {
    if (!this.currentNode || !this.currentNode.choices) {
      return []
    }

    const choices = this.currentNode.choices
    if (choices.length === 0) return []

    const lines = []
    lines.push('')

    choices.forEach((choice, index) => {
      // Check if choice is visible
      if (choice.showIf) {
        const shouldShow = this.evaluateCondition(choice.showIf)
        if (!shouldShow) return
      }

      const prefix = `  [${index + 1}]`
      lines.push(`${prefix} ${choice.text}`)

      // Show hint if available
      if (choice.hint) {
        lines.push(`      ${choice.hint}`)
      }
    })

    return lines
  }

  /**
   * Evaluate a condition
   */
  evaluateCondition(condition) {
    if (!condition) return true

    // Flag check
    if (condition.flag) {
      const value = this.flags.get(condition.flag) ?? this.globalFlags.get(condition.flag)
      return value === (condition.value ?? true)
    }

    // Visited check
    if (condition.visited) {
      return this.visitedNodes.has(condition.visited)
    }

    // Not visited check
    if (condition.notVisited) {
      return !this.visitedNodes.has(condition.notVisited)
    }

    return true
  }

  /**
   * End the adventure
   */
  endAdventure(type = 'completed', message = null) {
    this.adventureState = type === 'completed'
      ? ADVENTURE_STATES.COMPLETED
      : ADVENTURE_STATES.FAILED

    this.totalTime = Date.now() - this.startTime

    // Apply ending consequences
    if (this.currentAdventure.endConsequences?.[type]) {
      this.applyConsequences(this.currentAdventure.endConsequences[type])
    }

    // Set global completion flag
    this.globalFlags.set(`completed_${this.currentAdventure.id}`, true)
    this.saveGlobalFlags()

    // Record stats
    const result = {
      adventureId: this.currentAdventure.id,
      adventureName: this.currentAdventure.name,
      endType: type,
      nodesVisited: this.visitedNodes.size,
      choicesMade: this.choiceHistory.length,
      totalTime: this.totalTime,
      message: message || (type === 'completed' ? 'Adventure completed!' : 'Adventure ended.')
    }

    // Clear active adventure
    const adventure = this.currentAdventure
    this.currentAdventure = null
    this.currentNode = null
    this.clearSavedState()

    // Callback
    if (this.onAdventureEnd) {
      this.onAdventureEnd(result)
    }

    // Notify terminal
    if (terminalManager) {
      terminalManager.addOutput('', OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput('═'.repeat(50), OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(result.message, OUTPUT_TYPES.SUCCESS)
      terminalManager.addOutput(`Time: ${Math.round(result.totalTime / 1000)}s | Choices: ${result.choicesMade}`, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput('═'.repeat(50), OUTPUT_TYPES.SYSTEM)
    }

    return result
  }

  /**
   * Abandon the current adventure
   */
  abandonAdventure() {
    if (this.adventureState !== ADVENTURE_STATES.ACTIVE) {
      return { success: false, error: 'No active adventure to abandon.' }
    }

    this.adventureState = ADVENTURE_STATES.ABANDONED
    this.endAdventure('abandoned', 'Adventure abandoned.')

    return {
      success: true,
      output: ['You have abandoned the adventure.']
    }
  }

  /**
   * Pause the adventure (for saving/quitting)
   */
  pauseAdventure() {
    if (this.adventureState === ADVENTURE_STATES.ACTIVE) {
      this.adventureState = ADVENTURE_STATES.PAUSED
      this.saveState()
      return { success: true }
    }
    return { success: false }
  }

  /**
   * Resume a paused adventure
   */
  resumeAdventure() {
    if (this.adventureState === ADVENTURE_STATES.PAUSED) {
      this.adventureState = ADVENTURE_STATES.ACTIVE
      return {
        success: true,
        output: this.renderCurrentNode()
      }
    }
    return { success: false, error: 'No paused adventure to resume.' }
  }

  /**
   * Check if an adventure is active
   */
  isActive() {
    return this.adventureState === ADVENTURE_STATES.ACTIVE
  }

  /**
   * Get current adventure info
   */
  getCurrentAdventure() {
    if (!this.currentAdventure) return null

    return {
      id: this.currentAdventure.id,
      name: this.currentAdventure.name,
      state: this.adventureState,
      currentNodeId: this.currentNode?.id,
      nodesVisited: this.visitedNodes.size,
      choicesMade: this.choiceHistory.length,
    }
  }

  /**
   * Save current state
   */
  saveState() {
    if (!this.currentAdventure) return

    try {
      const state = {
        adventureId: this.currentAdventure.id,
        currentNodeId: this.currentNode?.id,
        adventureState: this.adventureState,
        visitedNodes: Array.from(this.visitedNodes),
        choiceHistory: this.choiceHistory,
        flags: Array.from(this.flags.entries()),
        startTime: this.startTime,
        savedAt: Date.now(),
      }
      localStorage.setItem('street_legacy_adventure_state', JSON.stringify(state))
    } catch (e) {
      console.warn('[AdventureEngine] Failed to save state:', e)
    }
  }

  /**
   * Load saved state
   */
  loadSavedState() {
    try {
      const saved = localStorage.getItem('street_legacy_adventure_state')
      if (saved) {
        const state = JSON.parse(saved)

        // Verify adventure still exists
        const adventure = adventureRegistry.getAdventure(state.adventureId)
        if (adventure && state.adventureState === ADVENTURE_STATES.ACTIVE) {
          this.currentAdventure = adventure
          this.adventureState = ADVENTURE_STATES.PAUSED // Pause until resumed
          this.visitedNodes = new Set(state.visitedNodes || [])
          this.choiceHistory = state.choiceHistory || []
          this.flags = new Map(state.flags || [])
          this.startTime = state.startTime
          this.currentNode = adventure.nodes[state.currentNodeId]

          console.log('[AdventureEngine] Loaded saved adventure:', state.adventureId)
        }
      }
    } catch (e) {
      console.warn('[AdventureEngine] Failed to load state:', e)
    }
  }

  /**
   * Clear saved state
   */
  clearSavedState() {
    try {
      localStorage.removeItem('street_legacy_adventure_state')
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Save global flags
   */
  saveGlobalFlags() {
    try {
      localStorage.setItem('street_legacy_adventure_flags',
        JSON.stringify(Array.from(this.globalFlags.entries())))
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Load global flags
   */
  loadGlobalFlags() {
    try {
      const saved = localStorage.getItem('street_legacy_adventure_flags')
      if (saved) {
        this.globalFlags = new Map(JSON.parse(saved))
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      isActive: this.isActive(),
      currentAdventure: this.getCurrentAdventure(),
      globalFlagsCount: this.globalFlags.size,
    }
  }
}

// Singleton export
export const adventureEngine = new AdventureEngineClass()
export default adventureEngine
