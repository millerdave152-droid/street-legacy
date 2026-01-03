/**
 * ConversationStateMachine - Phase 9: Multi-turn Conversation Handling
 *
 * Manages complex, multi-turn conversations with S.A.R.A.H.
 * States: IDLE, GATHERING_INFO, CONFIRMING, ADVISING, TEACHING
 *
 * Enables conversations like:
 * User: "Plan a heist"
 * SARAH: "What type of heist?"
 * User: "Bank"
 * SARAH: "How big is your crew?"
 * etc.
 */

import { sessionContext } from './SessionContext'
import { sarahPersonality } from './SarahPersonality'

// Conversation states
export const CONVERSATION_STATES = {
  IDLE: 'idle',               // Ready for new conversation
  GATHERING_INFO: 'gathering', // Collecting information for complex request
  CONFIRMING: 'confirming',    // Waiting for yes/no confirmation
  ADVISING: 'advising',        // In the middle of multi-part advice
  TEACHING: 'teaching',        // Teaching a concept step by step
  PLANNING: 'planning',        // Multi-step planning session
}

// Multi-turn conversation templates
const CONVERSATION_FLOWS = {
  // Heist planning flow
  heist_planning: {
    name: 'Heist Planning',
    steps: [
      {
        question: "What type of heist are you planning? (bank, jewelry, casino, warehouse)",
        field: 'heistType',
        validate: (input) => ['bank', 'jewelry', 'casino', 'warehouse', 'store', 'museum'].some(t => input.toLowerCase().includes(t)),
        errorMsg: "I need a specific heist type - bank, jewelry store, casino, or warehouse.",
      },
      {
        question: "How many crew members do you have available?",
        field: 'crewSize',
        validate: (input) => {
          const num = parseInt(input)
          return !isNaN(num) && num >= 0 && num <= 10
        },
        transform: (input) => parseInt(input) || 0,
        errorMsg: "Give me a number between 0 and 10.",
      },
      {
        question: "What's your risk tolerance? (low, medium, high)",
        field: 'riskLevel',
        validate: (input) => ['low', 'medium', 'high', 'safe', 'risky'].some(r => input.toLowerCase().includes(r)),
        transform: (input) => {
          if (input.includes('low') || input.includes('safe')) return 'low'
          if (input.includes('high') || input.includes('risky')) return 'high'
          return 'medium'
        },
        errorMsg: "Tell me if you want low, medium, or high risk.",
      },
    ],
    onComplete: (data) => {
      return {
        response: generateHeistPlan(data),
        action: null,
      }
    },
  },

  // Money strategy flow
  money_strategy: {
    name: 'Money Strategy',
    steps: [
      {
        question: "What's your current cash situation? (broke, some, comfortable, rich)",
        field: 'cashLevel',
        validate: () => true,
        transform: (input) => {
          if (input.includes('broke') || input.includes('nothing')) return 'broke'
          if (input.includes('rich') || input.includes('lot')) return 'rich'
          if (input.includes('comfortable') || input.includes('ok')) return 'comfortable'
          return 'some'
        },
      },
      {
        question: "Are you looking for quick cash or long-term wealth?",
        field: 'timeframe',
        validate: () => true,
        transform: (input) => input.includes('quick') || input.includes('fast') || input.includes('now') ? 'short' : 'long',
      },
      {
        question: "How much heat can you handle? (none, some, lots)",
        field: 'heatTolerance',
        validate: () => true,
        transform: (input) => {
          if (input.includes('none') || input.includes('no')) return 'none'
          if (input.includes('lots') || input.includes('any')) return 'high'
          return 'some'
        },
      },
    ],
    onComplete: (data) => {
      return {
        response: generateMoneyStrategy(data),
        action: null,
      }
    },
  },

  // Crime recommendation flow
  crime_advice: {
    name: 'Crime Advice',
    steps: [
      {
        question: "What's more important right now - XP or cash?",
        field: 'priority',
        validate: () => true,
        transform: (input) => input.toLowerCase().includes('xp') || input.toLowerCase().includes('level') ? 'xp' : 'cash',
      },
      {
        question: "How much time do you have? (few minutes, an hour, all day)",
        field: 'timeAvailable',
        validate: () => true,
        transform: (input) => {
          if (input.includes('few') || input.includes('quick')) return 'short'
          if (input.includes('all') || input.includes('lot')) return 'long'
          return 'medium'
        },
      },
    ],
    onComplete: (data) => {
      return {
        response: generateCrimeAdvice(data),
        action: null,
      }
    },
  },

  // Confirmation flow (generic)
  confirm_action: {
    name: 'Confirm Action',
    steps: [
      {
        question: "{confirmQuestion}",
        field: 'confirmed',
        validate: (input) => {
          const lower = input.toLowerCase()
          return ['yes', 'no', 'yeah', 'nah', 'ok', 'cancel', 'do it', 'stop'].some(w => lower.includes(w))
        },
        transform: (input) => {
          const lower = input.toLowerCase()
          return ['yes', 'yeah', 'ok', 'do it', 'sure', 'yep'].some(w => lower.includes(w))
        },
        errorMsg: "Just say yes or no.",
      },
    ],
    onComplete: (data, context) => {
      if (data.confirmed && context.pendingAction) {
        return {
          response: "Done. " + (context.successMessage || "Action completed."),
          action: context.pendingAction,
        }
      } else {
        return {
          response: "Cancelled. " + (context.cancelMessage || "Let me know if you need anything else."),
          action: null,
        }
      }
    },
  },
}

// Generate heist plan from collected data
function generateHeistPlan(data) {
  const { heistType, crewSize, riskLevel } = data

  const plans = {
    bank: {
      low: `Conservative bank job plan:\n• Scout for 2-3 days\n• Need: Driver, Hacker minimum\n• Entry: During business hours, blend in\n• Target: Safety deposit boxes (lower value but less security)\n• Exit: Through service entrance\n• Crew: ${crewSize} is ${crewSize >= 3 ? 'good' : 'too small - recruit more'}`,
      medium: `Standard bank heist:\n• 1 day scout, hit during shift change\n• Need: Driver, Hacker, Muscle\n• Target: Teller cash + vault if possible\n• Crew: ${crewSize >= 3 ? 'solid team' : 'need more backup'}`,
      high: `Aggressive bank raid:\n• Minimal planning, maximum speed\n• Go in hot, control the room\n• Target: Everything you can grab\n• Warning: High heat guaranteed\n• Crew: ${crewSize >= 4 ? 'ready' : 'dangerous with only ' + crewSize}`,
    },
    jewelry: {
      low: `Quiet jewelry grab:\n• Scope the displays\n• Distraction + grab\n• Small items only\n• Crew: 2 enough`,
      medium: `Smash and grab:\n• Break display cases\n• 90 seconds in and out\n• Crew: 3 recommended`,
      high: `Full store takeover:\n• Control staff and customers\n• Clean out everything\n• Need getaway ready\n• Crew: 4+`,
    },
    casino: {
      low: `Cage observation:\n• Learn the patterns\n• Small score, walk away\n• Patience required`,
      medium: `Inside job:\n• Bribe a dealer or security\n• Coordinated extraction`,
      high: `Vault hit:\n• Major operation\n• Need inside man + tech expert\n• Big crew required`,
    },
    warehouse: {
      low: `Night sneak:\n• Disable alarm\n• Cherry pick valuables\n• Low heat`,
      medium: `Truck hijack:\n• Intercept delivery\n• Quick swap`,
      high: `Full clearout:\n• Multiple vehicles\n• Empty the place`,
    },
  }

  const type = heistType.toLowerCase().replace(/[^a-z]/g, '')
  const planSet = plans[type] || plans.bank
  return planSet[riskLevel] || planSet.medium
}

// Generate money strategy from collected data
function generateMoneyStrategy(data) {
  const { cashLevel, timeframe, heatTolerance } = data

  let strategy = `Money strategy for your situation:\n\n`

  if (cashLevel === 'broke') {
    strategy += `Starting from zero:\n`
    if (timeframe === 'short') {
      strategy += `• Quick crimes: Pickpocket, mug, shoplifting\n`
      strategy += `• Do jobs between crimes for zero-heat income\n`
    } else {
      strategy += `• Grind consistently - every crime adds up\n`
      strategy += `• Save first $5k for property investment\n`
    }
  } else if (cashLevel === 'rich') {
    strategy += `With money to invest:\n`
    strategy += `• Max out property portfolio\n`
    strategy += `• Consider high-stakes heists\n`
    strategy += `• Trading for big margins\n`
  } else {
    strategy += `Building wealth:\n`
    if (heatTolerance === 'high') {
      strategy += `• Higher crimes pay more\n`
      strategy += `• Accept the heat, bank the cash\n`
    } else {
      strategy += `• Balance crime with jobs\n`
      strategy += `• Property income is your friend\n`
    }
  }

  return strategy
}

// Generate crime advice from collected data
function generateCrimeAdvice(data) {
  const { priority, timeAvailable } = data

  let advice = `Based on your situation:\n\n`

  if (priority === 'xp' && timeAvailable === 'short') {
    advice += `Quick XP:\n• Do crimes at your level\n• Avoid failed attempts (waste time)`
  } else if (priority === 'xp') {
    advice += `XP farming:\n• Grind consistently\n• Mix crime types for variety\n• Heists give big XP bursts`
  } else if (priority === 'cash' && timeAvailable === 'short') {
    advice += `Fast cash:\n• Hit the highest-paying crime you can succeed at\n• Bank immediately`
  } else {
    advice += `Cash grinding:\n• Work up to bigger scores\n• Property investment compounds over time`
  }

  return advice
}

/**
 * ConversationStateMachine class
 */
class ConversationStateMachineClass {
  constructor() {
    this.state = CONVERSATION_STATES.IDLE
    this.currentFlow = null
    this.currentStep = 0
    this.collectedData = {}
    this.flowContext = {}
    this.timeoutId = null
    this.timeoutDuration = 120000 // 2 minutes timeout
  }

  /**
   * Check if we're in a multi-turn conversation
   */
  isInConversation() {
    return this.state !== CONVERSATION_STATES.IDLE
  }

  /**
   * Start a new conversation flow
   *
   * @param {string} flowId - ID of the flow to start
   * @param {object} context - Additional context for the flow
   * @returns {object} First question to ask
   */
  startFlow(flowId, context = {}) {
    const flow = CONVERSATION_FLOWS[flowId]
    if (!flow) {
      console.warn(`[ConversationStateMachine] Unknown flow: ${flowId}`)
      return null
    }

    this.state = CONVERSATION_STATES.GATHERING_INFO
    this.currentFlow = flow
    this.currentStep = 0
    this.collectedData = {}
    this.flowContext = context
    this.resetTimeout()

    // Get first question
    return this.getCurrentQuestion()
  }

  /**
   * Start a confirmation dialog
   *
   * @param {string} question - The confirmation question
   * @param {object} context - Contains pendingAction, successMessage, cancelMessage
   */
  startConfirmation(question, context = {}) {
    this.state = CONVERSATION_STATES.CONFIRMING
    this.currentFlow = CONVERSATION_FLOWS.confirm_action
    this.currentStep = 0
    this.collectedData = {}
    this.flowContext = {
      ...context,
      confirmQuestion: question,
    }
    this.resetTimeout()

    return {
      question,
      awaitingResponse: true,
    }
  }

  /**
   * Get the current question to ask
   */
  getCurrentQuestion() {
    if (!this.currentFlow || this.currentStep >= this.currentFlow.steps.length) {
      return null
    }

    const step = this.currentFlow.steps[this.currentStep]
    let question = step.question

    // Replace placeholders in question
    for (const [key, value] of Object.entries(this.flowContext)) {
      question = question.replace(`{${key}}`, value)
    }

    return {
      question: sarahPersonality.injectNickname(question),
      awaitingResponse: true,
      flowName: this.currentFlow.name,
      progress: `${this.currentStep + 1}/${this.currentFlow.steps.length}`,
    }
  }

  /**
   * Process user input in the current conversation
   *
   * @param {string} input - User's response
   * @returns {object} Response and whether conversation continues
   */
  processInput(input) {
    if (!this.isInConversation()) {
      return { handled: false }
    }

    this.resetTimeout()

    const step = this.currentFlow.steps[this.currentStep]

    // Validate input
    if (step.validate && !step.validate(input)) {
      return {
        handled: true,
        response: step.errorMsg || "I didn't quite get that. Try again?",
        continues: true,
        nextQuestion: this.getCurrentQuestion(),
      }
    }

    // Transform and store input
    const value = step.transform ? step.transform(input) : input
    this.collectedData[step.field] = value

    // Move to next step
    this.currentStep++

    // Check if flow is complete
    if (this.currentStep >= this.currentFlow.steps.length) {
      return this.completeFlow()
    }

    // Return next question
    return {
      handled: true,
      response: sarahPersonality.getAcknowledgment(),
      continues: true,
      nextQuestion: this.getCurrentQuestion(),
    }
  }

  /**
   * Complete the current flow and generate final response
   */
  completeFlow() {
    const result = this.currentFlow.onComplete(this.collectedData, this.flowContext)

    // Reset state
    this.state = CONVERSATION_STATES.IDLE
    this.currentFlow = null
    this.currentStep = 0
    this.collectedData = {}
    this.flowContext = {}
    this.clearTimeout()

    return {
      handled: true,
      response: result.response,
      continues: false,
      action: result.action,
    }
  }

  /**
   * Cancel the current conversation
   */
  cancel() {
    const wasInConversation = this.isInConversation()

    this.state = CONVERSATION_STATES.IDLE
    this.currentFlow = null
    this.currentStep = 0
    this.collectedData = {}
    this.flowContext = {}
    this.clearTimeout()

    return wasInConversation
  }

  /**
   * Check if input is a cancel command
   */
  isCancelCommand(input) {
    const cancelWords = ['cancel', 'stop', 'quit', 'exit', 'nevermind', 'forget it', 'abort']
    const lower = input.toLowerCase()
    return cancelWords.some(w => lower.includes(w))
  }

  /**
   * Set timeout for conversation expiry
   */
  resetTimeout() {
    this.clearTimeout()
    this.timeoutId = setTimeout(() => {
      if (this.isInConversation()) {
        console.log('[ConversationStateMachine] Conversation timed out')
        this.cancel()
      }
    }, this.timeoutDuration)
  }

  /**
   * Clear the timeout
   */
  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  /**
   * Get current conversation state info
   */
  getStateInfo() {
    return {
      state: this.state,
      isInConversation: this.isInConversation(),
      flowName: this.currentFlow?.name || null,
      progress: this.currentFlow
        ? `${this.currentStep}/${this.currentFlow.steps.length}`
        : null,
      collectedData: { ...this.collectedData },
    }
  }

  /**
   * Check if a query should trigger a multi-turn flow
   */
  detectFlow(query) {
    const lower = query.toLowerCase()

    // Heist planning triggers
    if (lower.includes('plan') && (lower.includes('heist') || lower.includes('robbery') || lower.includes('score'))) {
      return 'heist_planning'
    }

    // Money strategy triggers
    if ((lower.includes('money') || lower.includes('cash')) && (lower.includes('strategy') || lower.includes('plan') || lower.includes('make'))) {
      return 'money_strategy'
    }

    // Detailed crime advice
    if (lower.includes('detailed') && lower.includes('crime')) {
      return 'crime_advice'
    }

    return null
  }
}

// Export singleton
export const conversationStateMachine = new ConversationStateMachineClass()
export default conversationStateMachine
