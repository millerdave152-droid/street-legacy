/**
 * ConversationOrchestrator - Multi-NPC Conversation System
 *
 * Enables emergent NPC interactions:
 * - NPC interrupts during messages
 * - Multi-NPC debates on topics
 * - Chain reactions (NPC A triggers NPC B)
 * - Cross-references ("Like Snoop said...")
 * - Faction tension dynamics
 *
 * Creates illusion of living NPCs with opinions
 */

import { npcMemoryManager } from './NPCMemoryManager'
import { personalityEvolution, PERSONALITY_TYPES } from './PersonalityEvolution'

const STORAGE_KEY = 'street_legacy_conversations'

// Conversation types
const CONVERSATION_TYPES = {
  INTERRUPT: 'interrupt',       // NPC cuts in on another
  DEBATE: 'debate',             // Two+ NPCs argue
  CHAIN: 'chain',               // Sequential NPC responses
  GOSSIP: 'gossip',             // NPC shares what they heard
  FACTION_CONFLICT: 'faction',  // Rival NPCs clash
  AGREEMENT: 'agreement',       // NPC supports another
  WARNING: 'warning'            // NPC warns about another
}

// Topics that can trigger conversations
const TOPICS = {
  MONEY: 'money',
  POLICE: 'police',
  TERRITORY: 'territory',
  LOYALTY: 'loyalty',
  DEALS: 'deals',
  REPUTATION: 'reputation',
  RISK: 'risk',
  PLAYER_ACTIONS: 'player_actions'
}

// NPC opinion stances
const STANCES = {
  STRONGLY_AGREE: 2,
  AGREE: 1,
  NEUTRAL: 0,
  DISAGREE: -1,
  STRONGLY_DISAGREE: -2
}

// Interrupt triggers
const INTERRUPT_TRIGGERS = {
  // When NPC A says something, NPC B might interrupt
  mention_rival: {
    condition: (speakerNpc, listenerNpc, context) =>
      context.mentionsNpc && isRival(speakerNpc, listenerNpc),
    probability: 0.7,
    type: CONVERSATION_TYPES.FACTION_CONFLICT
  },
  money_disagreement: {
    condition: (speakerNpc, listenerNpc, context) =>
      context.topic === TOPICS.MONEY && hasOpposingView(speakerNpc, listenerNpc, TOPICS.MONEY),
    probability: 0.5,
    type: CONVERSATION_TYPES.DEBATE
  },
  loyalty_question: {
    condition: (speakerNpc, listenerNpc, context) =>
      context.topic === TOPICS.LOYALTY && listenerNpc.hasStrongOpinion,
    probability: 0.6,
    type: CONVERSATION_TYPES.INTERRUPT
  },
  support_friend: {
    condition: (speakerNpc, listenerNpc, context) =>
      context.aboutPlayer && hasFriendlyRelation(speakerNpc, listenerNpc),
    probability: 0.4,
    type: CONVERSATION_TYPES.AGREEMENT
  }
}

// Pre-defined conversation templates
const CONVERSATION_TEMPLATES = {
  // Debates about player's reliability
  player_reliability: {
    topic: TOPICS.LOYALTY,
    minParticipants: 2,
    maxParticipants: 3,
    exchanges: [
      { role: 'skeptic', template: 'I don\'t know about {player}. They\'ve {negative_history}.' },
      { role: 'defender', template: 'Come on, {skeptic_name}. {player} came through on {positive_history}.' },
      { role: 'skeptic', template: 'That was one time. I\'ve seen too many {player_type} fall apart.' },
      { role: 'mediator', template: 'Both of you got points. {player}, prove yourself and we\'ll see.' }
    ]
  },

  // Money/deal discussions
  deal_value_debate: {
    topic: TOPICS.MONEY,
    minParticipants: 2,
    maxParticipants: 2,
    exchanges: [
      { role: 'generous', template: 'The deal\'s solid. ${amount} is fair for everyone.' },
      { role: 'greedy', template: 'Fair? We could get more. {player} doesn\'t know the real value.' },
      { role: 'generous', template: 'Don\'t be greedy, {greedy_name}. Good partners are worth more than extra cash.' }
    ]
  },

  // Territory/faction tension
  territory_dispute: {
    topic: TOPICS.TERRITORY,
    minParticipants: 2,
    maxParticipants: 2,
    exchanges: [
      { role: 'aggressor', template: 'Your crew\'s been pushing into {territory}. That\'s not smart.' },
      { role: 'defender', template: 'We go where the money is, {aggressor_name}. Don\'t start something.' },
      { role: 'aggressor', template: 'Just saying. Keep {player} out of our business.' }
    ]
  },

  // Gossip chain
  reputation_gossip: {
    topic: TOPICS.REPUTATION,
    minParticipants: 2,
    maxParticipants: 3,
    exchanges: [
      { role: 'gossiper', template: 'You hear what {player} pulled off? {recent_action}.' },
      { role: 'listener', template: 'No way. For real?' },
      { role: 'gossiper', template: 'Dead serious. {npc_opinion} about them now.' },
      { role: 'listener', template: 'Interesting. I\'ll keep that in mind.' }
    ]
  }
}

// Cross-reference templates
const CROSS_REFERENCES = {
  agreement: [
    'Like {npc} said...',
    '{npc} was right about this.',
    'I was talking to {npc} and they said the same thing.',
    '{npc} told me you\'d say that.'
  ],
  disagreement: [
    'Don\'t listen to {npc}, they\'re wrong.',
    '{npc} doesn\'t know what they\'re talking about.',
    'Unlike what {npc} thinks...',
    '{npc} and I don\'t see eye to eye on this.'
  ],
  warning: [
    'Watch out for {npc}. They\'re not happy.',
    '{npc} was asking about you. Careful.',
    'I heard {npc} is planning something.',
    'Between us? {npc} can\'t be trusted right now.'
  ]
}

// Check if two NPCs are rivals
function isRival(npc1, npc2) {
  const npc1Data = npc1.factionData || {}
  const npc2Data = npc2.factionData || {}
  return npc1Data.faction && npc2Data.faction &&
         npc1Data.rivals?.includes(npc2Data.faction)
}

// Check if NPCs have opposing views on a topic
function hasOpposingView(npc1, npc2, topic) {
  const stance1 = npc1.stances?.[topic] || 0
  const stance2 = npc2.stances?.[topic] || 0
  return Math.abs(stance1 - stance2) >= 2
}

// Check if NPCs have friendly relation
function hasFriendlyRelation(npc1, npc2) {
  return npc1.alliedWith?.includes(npc2.id) || npc2.alliedWith?.includes(npc1.id)
}

class ConversationOrchestratorClass {
  constructor() {
    this.activeConversations = []
    this.conversationHistory = []
    this.npcRegistry = {}
    this.isInitialized = false
    this.listeners = []
    this.pendingInterrupts = []
  }

  /**
   * Initialize the orchestrator
   */
  initialize() {
    if (this.isInitialized) return

    this.loadHistory()
    this.isInitialized = true
    console.log('[ConversationOrchestrator] Initialized')
  }

  /**
   * Register an NPC with their conversation data
   */
  registerNPC(npcId, data) {
    this.npcRegistry[npcId] = {
      id: npcId,
      name: data.name || npcId,
      personality: data.personality || PERSONALITY_TYPES.PROFESSIONAL,
      factionData: data.faction || null,
      stances: data.stances || {},
      alliedWith: data.allies || [],
      rivalsWith: data.rivals || [],
      hasStrongOpinion: data.opinionated || false,
      isActive: true
    }
  }

  /**
   * Check if an NPC message should trigger an interrupt
   * @param {string} speakerId - Current speaker NPC ID
   * @param {Object} context - Message context (topic, mentions, etc.)
   * @returns {Object|null} Interrupt data or null
   */
  checkForInterrupt(speakerId, context = {}) {
    const speaker = this.npcRegistry[speakerId]
    if (!speaker) return null

    const potentialInterrupters = Object.values(this.npcRegistry)
      .filter(npc => npc.id !== speakerId && npc.isActive)

    for (const listener of potentialInterrupters) {
      for (const [triggerName, trigger] of Object.entries(INTERRUPT_TRIGGERS)) {
        if (trigger.condition(speaker, listener, context)) {
          if (Math.random() < trigger.probability) {
            return {
              type: trigger.type,
              interrupter: listener,
              speaker,
              trigger: triggerName,
              context
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Generate an interrupt message
   * @param {Object} interruptData - Data from checkForInterrupt
   * @returns {Object} Generated interrupt
   */
  generateInterrupt(interruptData) {
    const { type, interrupter, speaker, context } = interruptData

    let message = ''
    const personality = personalityEvolution.getPersonality(interrupter.id)

    switch (type) {
      case CONVERSATION_TYPES.FACTION_CONFLICT:
        message = this.generateFactionConflictMessage(interrupter, speaker)
        break

      case CONVERSATION_TYPES.DEBATE:
        message = this.generateDebateInterjection(interrupter, speaker, context)
        break

      case CONVERSATION_TYPES.AGREEMENT:
        message = this.generateAgreementMessage(interrupter, speaker)
        break

      case CONVERSATION_TYPES.INTERRUPT:
      default:
        message = this.generateGenericInterrupt(interrupter, context)
    }

    return {
      npcId: interrupter.id,
      npcName: interrupter.name,
      message,
      type,
      timestamp: Date.now()
    }
  }

  /**
   * Generate faction conflict message
   */
  generateFactionConflictMessage(interrupter, speaker) {
    const templates = [
      `Hold up, ${speaker.name}. Don't speak for all of us.`,
      `${speaker.name}, you know that's not how we see it.`,
      `Careful, ${speaker.name}. You're crossing lines.`,
      `That's rich coming from ${speaker.name}'s crew.`,
      `${speaker.name}, stay in your lane.`
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Generate debate interjection
   */
  generateDebateInterjection(interrupter, speaker, context) {
    const topic = context.topic || 'this'
    const templates = [
      `I disagree with ${speaker.name} on ${topic}.`,
      `That's one way to look at it, ${speaker.name}. Here's another.`,
      `${speaker.name}'s got it wrong.`,
      `No offense, ${speaker.name}, but that's not how it works.`
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Generate agreement message
   */
  generateAgreementMessage(interrupter, speaker) {
    const templates = [
      `${speaker.name}'s right about this.`,
      `I'm with ${speaker.name} on this one.`,
      `Listen to ${speaker.name}. They know what they're talking about.`,
      `${speaker.name} gets it.`
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Generate generic interrupt
   */
  generateGenericInterrupt(interrupter, context) {
    const templates = [
      'Wait, let me say something.',
      'Hold on a second.',
      'I need to jump in here.',
      'Before we continue...',
      'Actually...'
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * Start a multi-NPC conversation
   * @param {string} templateName - Name of conversation template
   * @param {Array} participants - Array of NPC IDs
   * @param {Object} context - Additional context
   * @returns {Object} Conversation object with messages
   */
  startConversation(templateName, participants, context = {}) {
    const template = CONVERSATION_TEMPLATES[templateName]
    if (!template) {
      console.warn(`[ConversationOrchestrator] Unknown template: ${templateName}`)
      return null
    }

    if (participants.length < template.minParticipants) {
      console.warn(`[ConversationOrchestrator] Not enough participants for ${templateName}`)
      return null
    }

    // Assign roles to participants
    const roles = this.assignRoles(template, participants)

    // Generate messages
    const messages = template.exchanges.map((exchange, index) => {
      const npcId = roles[exchange.role]
      const npc = this.npcRegistry[npcId]

      let message = exchange.template
      message = this.fillTemplateVariables(message, {
        ...context,
        npc,
        roles,
        exchange,
        participants
      })

      return {
        npcId,
        npcName: npc?.name || npcId,
        message,
        role: exchange.role,
        delay: index * 1500 + Math.random() * 500, // Staggered timing
        timestamp: Date.now() + index * 1500
      }
    })

    const conversation = {
      id: `conv_${Date.now()}`,
      type: template.topic,
      templateName,
      participants,
      roles,
      messages,
      startedAt: Date.now(),
      status: 'active'
    }

    this.activeConversations.push(conversation)
    this.notifyListeners('conversation_started', conversation)

    return conversation
  }

  /**
   * Assign roles to participants based on personality
   */
  assignRoles(template, participants) {
    const roles = {}
    const availableParticipants = [...participants]
    const roleNames = [...new Set(template.exchanges.map(e => e.role))]

    roleNames.forEach(role => {
      if (availableParticipants.length === 0) {
        // Reuse participants if needed
        roles[role] = participants[Math.floor(Math.random() * participants.length)]
        return
      }

      // Try to match role to personality
      let bestMatch = null
      let bestScore = -1

      availableParticipants.forEach(npcId => {
        const npc = this.npcRegistry[npcId]
        if (!npc) return

        let score = 0
        const personality = personalityEvolution.getPersonality(npcId)

        // Role matching logic
        if (role === 'skeptic' && personality.modifiers?.trust < 0) score += 2
        if (role === 'defender' && personality.modifiers?.warmth > 0) score += 2
        if (role === 'mediator' && npc.personality === PERSONALITY_TYPES.PROFESSIONAL) score += 2
        if (role === 'generous' && personality.modifiers?.warmth > 0.3) score += 2
        if (role === 'greedy' && npc.personality === PERSONALITY_TYPES.OPPORTUNISTIC) score += 2
        if (role === 'aggressor' && npc.personality === PERSONALITY_TYPES.AGGRESSIVE) score += 2

        score += Math.random() // Add randomness

        if (score > bestScore) {
          bestScore = score
          bestMatch = npcId
        }
      })

      if (bestMatch) {
        roles[role] = bestMatch
        const index = availableParticipants.indexOf(bestMatch)
        if (index > -1) availableParticipants.splice(index, 1)
      }
    })

    return roles
  }

  /**
   * Fill template variables with actual values
   */
  fillTemplateVariables(template, context) {
    let result = template

    // Replace {player}
    result = result.replace(/\{player\}/g, 'you')

    // Replace role names
    if (context.roles) {
      Object.entries(context.roles).forEach(([role, npcId]) => {
        const npc = this.npcRegistry[npcId]
        if (npc) {
          result = result.replace(new RegExp(`\\{${role}_name\\}`, 'g'), npc.name)
        }
      })
    }

    // Replace context values
    Object.entries(context).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value.toString())
      }
    })

    // Replace any remaining placeholders with generic text
    result = result.replace(/\{[^}]+\}/g, 'something')

    return result
  }

  /**
   * Generate a cross-reference to another NPC
   * @param {string} speakerId - Current speaker
   * @param {string} referencedId - NPC being referenced
   * @param {string} type - 'agreement', 'disagreement', or 'warning'
   */
  generateCrossReference(speakerId, referencedId, type = 'agreement') {
    const referenced = this.npcRegistry[referencedId]
    if (!referenced) return null

    const templates = CROSS_REFERENCES[type] || CROSS_REFERENCES.agreement
    const template = templates[Math.floor(Math.random() * templates.length)]

    return template.replace(/\{npc\}/g, referenced.name)
  }

  /**
   * Generate gossip about player from one NPC to another
   */
  generateGossip(sourceNpcId, targetNpcId, playerContext = {}) {
    const source = this.npcRegistry[sourceNpcId]
    const target = this.npcRegistry[targetNpcId]

    if (!source || !target) return null

    const memory = npcMemoryManager.getMemory(sourceNpcId)
    const recentActions = memory.memorableEvents.slice(0, 2)

    if (recentActions.length === 0) {
      return null
    }

    const recentEvent = recentActions[0]
    const sentiment = recentEvent.sentiment

    let gossip = ''
    if (sentiment === 'positive') {
      gossip = `${source.name} to ${target.name}: "That player? They ${recentEvent.description}. Not bad."`
    } else if (sentiment === 'negative') {
      gossip = `${source.name} to ${target.name}: "Watch out for that one. They ${recentEvent.description}."`
    } else {
      gossip = `${source.name} to ${target.name}: "Heard about that player? ${recentEvent.description}."`
    }

    // Record gossip in target's memory
    npcMemoryManager.addGossip(targetNpcId, sourceNpcId, recentEvent.description)

    return {
      from: sourceNpcId,
      to: targetNpcId,
      message: gossip,
      sentiment,
      timestamp: Date.now()
    }
  }

  /**
   * Check if conversation should naturally end
   */
  checkConversationEnd(conversationId) {
    const conv = this.activeConversations.find(c => c.id === conversationId)
    if (!conv) return true

    const allDelivered = conv.messages.every(m => m.delivered)
    if (allDelivered) {
      conv.status = 'completed'
      this.conversationHistory.push(conv)
      this.activeConversations = this.activeConversations.filter(c => c.id !== conversationId)
      this.notifyListeners('conversation_ended', conv)
      this.saveHistory()
      return true
    }

    return false
  }

  /**
   * Mark a message as delivered
   */
  markMessageDelivered(conversationId, messageIndex) {
    const conv = this.activeConversations.find(c => c.id === conversationId)
    if (conv && conv.messages[messageIndex]) {
      conv.messages[messageIndex].delivered = true
      this.checkConversationEnd(conversationId)
    }
  }

  /**
   * Get pending interrupts
   */
  getPendingInterrupts() {
    const pending = [...this.pendingInterrupts]
    this.pendingInterrupts = []
    return pending
  }

  /**
   * Queue an interrupt for delivery
   */
  queueInterrupt(interrupt) {
    this.pendingInterrupts.push(interrupt)
    this.notifyListeners('interrupt_queued', interrupt)
  }

  /**
   * Add listener for conversation events
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data)
      } catch (e) {
        console.error('[ConversationOrchestrator] Listener error:', e)
      }
    })
  }

  /**
   * Save conversation history
   */
  saveHistory() {
    try {
      // Only save last 50 conversations
      const toSave = this.conversationHistory.slice(-50)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        history: toSave,
        savedAt: Date.now()
      }))
    } catch (e) {
      console.warn('[ConversationOrchestrator] Save failed:', e)
    }
  }

  /**
   * Load conversation history
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        this.conversationHistory = data.history || []
      }
    } catch (e) {
      console.warn('[ConversationOrchestrator] Load failed:', e)
      this.conversationHistory = []
    }
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.conversationHistory = []
    this.activeConversations = []
    localStorage.removeItem(STORAGE_KEY)
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      registeredNPCs: Object.keys(this.npcRegistry).length,
      activeConversations: this.activeConversations.length,
      historicalConversations: this.conversationHistory.length,
      pendingInterrupts: this.pendingInterrupts.length
    }
  }
}

// Singleton instance
export const conversationOrchestrator = new ConversationOrchestratorClass()

// Export constants
export { CONVERSATION_TYPES, TOPICS, STANCES, CONVERSATION_TEMPLATES }
export default conversationOrchestrator
