/**
 * DialogueTreeManager - Handles conversation trees and negotiations
 *
 * Features:
 * - Multi-branch dialogue trees
 * - Negotiation system with counter-offers
 * - Trust/reputation impacts from choices
 * - Context-aware response options
 */

import { gameManager } from '../GameManager'
import { NPC_CONTACTS } from '../data/NPCContacts'
import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'
import { playerReputationManager } from '../managers/PlayerReputationManager'
import { opportunityManager, OPPORTUNITY_TYPES } from '../opportunity/OpportunityManager'

// Dialogue node types
export const NODE_TYPES = {
  MESSAGE: 'message',
  CHOICE: 'choice',
  OUTCOME: 'outcome',
  NEGOTIATE: 'negotiate',
  END: 'end'
}

// Negotiation result types
export const NEGOTIATE_RESULTS = {
  ACCEPTED: 'accepted',
  COUNTER: 'counter',
  REJECTED: 'rejected',
  WALKED_AWAY: 'walked_away'
}

const STORAGE_KEY = 'streetLegacy_dialogues'

class DialogueTreeManager {
  constructor() {
    this.activeDialogues = new Map() // dialogueId -> dialogue state
    this.dialogueTemplates = new Map() // templateId -> template
    this.isInitialized = false

    // Register default dialogue templates
    this.registerDefaultTemplates()
  }

  /**
   * Initialize the dialogue manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadFromStorage()
    this.isInitialized = true
    console.log('[DialogueTreeManager] Initialized')
  }

  /**
   * Register default dialogue templates
   */
  registerDefaultTemplates() {
    // Scarlett crew mission negotiation
    this.dialogueTemplates.set('scarlett_crew_mission', {
      id: 'scarlett_crew_mission',
      npcId: 'scarlett',
      title: 'Crew Mission',
      nodes: {
        start: {
          type: NODE_TYPES.MESSAGE,
          text: 'Crew hitting {location}. Need {role}.\nYour cut: ${baseReward}. You in?',
          next: 'initial_choice'
        },
        initial_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: "I'm in", next: 'accepted' },
            { text: 'info', label: "What's the target?", next: 'more_info' },
            { text: 'negotiate', label: 'I want more', next: 'negotiate_start' },
            { text: 'crew', label: 'Who else is in?', next: 'crew_info' },
            { text: 'decline', label: 'Not interested', next: 'declined' }
          ]
        },
        more_info: {
          type: NODE_TYPES.MESSAGE,
          text: '{location}. {difficulty} security. Expected take: ${totalScore}.\nYour role: {role}. Clean in, clean out.',
          next: 'post_info_choice'
        },
        post_info_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: "I'm in", next: 'accepted' },
            { text: 'negotiate', label: 'I want a bigger cut', next: 'negotiate_start' },
            { text: 'decline', label: 'Too risky', next: 'declined' }
          ]
        },
        crew_info: {
          type: NODE_TYPES.MESSAGE,
          text: 'Me, you, and {crewMember}. Tight crew. No loose ends.\nWe move as one or not at all.',
          next: 'post_crew_choice'
        },
        post_crew_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: "Count me in", next: 'accepted' },
            { text: 'negotiate', label: 'What about the pay?', next: 'negotiate_start' },
            { text: 'decline', label: "I'll pass", next: 'declined' }
          ]
        },
        negotiate_start: {
          type: NODE_TYPES.NEGOTIATE,
          npcResponse: '{negotiateResponse}',
          minOffer: 0.8, // 80% of base
          maxOffer: 1.3, // 130% of base
          next: 'negotiate_choice'
        },
        negotiate_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: 'Deal', next: 'negotiated_accept' },
            { text: 'push', label: 'I want more', next: 'negotiate_push', condition: 'canPush' },
            { text: 'decline', label: 'Forget it', next: 'negotiate_walked' }
          ]
        },
        negotiate_push: {
          type: NODE_TYPES.NEGOTIATE,
          npcResponse: '{pushResponse}',
          riskLevel: 'high',
          next: 'negotiate_final'
        },
        negotiate_final: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: 'Fine, deal', next: 'negotiated_accept' },
            { text: 'decline', label: 'Actually never mind', next: 'negotiate_insulted' }
          ]
        },
        accepted: {
          type: NODE_TYPES.OUTCOME,
          text: 'Good. Be ready at {time}. Don\'t be late.',
          result: { type: 'mission_accepted', trustChange: 5 },
          next: 'end'
        },
        negotiated_accept: {
          type: NODE_TYPES.OUTCOME,
          text: 'Fine. ${finalReward}. Don\'t make me regret this.',
          result: { type: 'mission_accepted', negotiated: true },
          next: 'end'
        },
        negotiate_walked: {
          type: NODE_TYPES.OUTCOME,
          text: 'Your loss. Don\'t come crying when you need work.',
          result: { type: 'declined', trustChange: -5 },
          next: 'end'
        },
        negotiate_insulted: {
          type: NODE_TYPES.OUTCOME,
          text: 'You wasted my time. Remember that.',
          result: { type: 'declined', trustChange: -15, blocked: true },
          next: 'end'
        },
        declined: {
          type: NODE_TYPES.OUTCOME,
          text: 'Suit yourself. Opportunity doesn\'t knock twice.',
          result: { type: 'declined', trustChange: -2 },
          next: 'end'
        },
        end: {
          type: NODE_TYPES.END
        }
      }
    })

    // The Connect deal negotiation
    this.dialogueTemplates.set('connect_deal', {
      id: 'connect_deal',
      npcId: 'the_connect',
      title: 'Business Deal',
      nodes: {
        start: {
          type: NODE_TYPES.MESSAGE,
          text: 'Opportunity. {quantity}x {item}. ${basePrice} total.\n{discount}% below market. Yes or no.',
          next: 'initial_choice'
        },
        initial_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: 'Deal', next: 'accepted' },
            { text: 'negotiate', label: 'Lower', next: 'negotiate' },
            { text: 'decline', label: 'Pass', next: 'declined' }
          ]
        },
        negotiate: {
          type: NODE_TYPES.NEGOTIATE,
          npcResponse: 'Price is fair. Best offer: ${counterPrice}. Final.',
          next: 'negotiate_choice'
        },
        negotiate_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: 'Fine', next: 'negotiated_accept' },
            { text: 'decline', label: 'No', next: 'negotiate_declined' }
          ]
        },
        negotiated_accept: {
          type: NODE_TYPES.OUTCOME,
          text: 'Confirmed. Delivery arranged.',
          result: { type: 'deal_accepted', negotiated: true },
          next: 'end'
        },
        negotiate_declined: {
          type: NODE_TYPES.OUTCOME,
          text: 'Understood. Next opportunity may not come.',
          result: { type: 'declined', trustChange: -3 },
          next: 'end'
        },
        accepted: {
          type: NODE_TYPES.OUTCOME,
          text: 'Done. Goods en route.',
          result: { type: 'deal_accepted', trustChange: 3 },
          next: 'end'
        },
        declined: {
          type: NODE_TYPES.OUTCOME,
          text: 'Noted.',
          result: { type: 'declined' },
          next: 'end'
        },
        end: {
          type: NODE_TYPES.END
        }
      }
    })

    // Silkroad bulk trade
    this.dialogueTemplates.set('silkroad_bulk', {
      id: 'silkroad_bulk',
      npcId: 'silkroad',
      title: 'Bulk Trade',
      nodes: {
        start: {
          type: NODE_TYPES.MESSAGE,
          text: 'New shipment. {quantity} units {item}.\nWholesale: ${basePrice}. Street value: ${streetValue}.\nInterested?',
          next: 'initial_choice'
        },
        initial_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'buy_all', label: 'Take all', next: 'buy_all' },
            { text: 'buy_half', label: 'Half order', next: 'buy_half' },
            { text: 'negotiate', label: 'Better price', next: 'negotiate' },
            { text: 'decline', label: 'Not now', next: 'declined' }
          ]
        },
        buy_all: {
          type: NODE_TYPES.OUTCOME,
          text: 'Full order confirmed. ${basePrice}. Delivery in 1 hour.',
          result: { type: 'purchase', quantity: 'full', trustChange: 5 },
          next: 'end'
        },
        buy_half: {
          type: NODE_TYPES.OUTCOME,
          text: 'Half order. ${halfPrice}. Will find another buyer for rest.',
          result: { type: 'purchase', quantity: 'half' },
          next: 'end'
        },
        negotiate: {
          type: NODE_TYPES.NEGOTIATE,
          npcResponse: 'Bulk discount already applied. Best: ${counterPrice}.',
          next: 'negotiate_choice'
        },
        negotiate_choice: {
          type: NODE_TYPES.CHOICE,
          options: [
            { text: 'accept', label: 'Agreed', next: 'negotiated_accept' },
            { text: 'decline', label: 'Too high', next: 'declined' }
          ]
        },
        negotiated_accept: {
          type: NODE_TYPES.OUTCOME,
          text: 'Done. ${counterPrice}. Pleasure doing business.',
          result: { type: 'purchase', negotiated: true, trustChange: 2 },
          next: 'end'
        },
        declined: {
          type: NODE_TYPES.OUTCOME,
          text: 'Understood. Stock moves fast.',
          result: { type: 'declined' },
          next: 'end'
        },
        end: {
          type: NODE_TYPES.END
        }
      }
    })

    console.log('[DialogueTreeManager] Registered default templates')
  }

  /**
   * Start a dialogue from template
   */
  startDialogue(templateId, context = {}) {
    const template = this.dialogueTemplates.get(templateId)
    if (!template) {
      console.warn(`[DialogueTreeManager] Unknown template: ${templateId}`)
      return null
    }

    const dialogueId = `${templateId}_${Date.now()}`
    const dialogue = {
      id: dialogueId,
      templateId,
      npcId: template.npcId,
      title: template.title,
      currentNode: 'start',
      context: {
        ...context,
        baseReward: context.baseReward || 3500,
        currentOffer: context.baseReward || 3500,
        negotiationAttempts: 0
      },
      history: [],
      startedAt: Date.now()
    }

    this.activeDialogues.set(dialogueId, dialogue)
    this.saveToStorage()

    // Display initial node
    this.displayCurrentNode(dialogueId)

    return dialogueId
  }

  /**
   * Display current dialogue node
   */
  displayCurrentNode(dialogueId) {
    const dialogue = this.activeDialogues.get(dialogueId)
    if (!dialogue) return

    const template = this.dialogueTemplates.get(dialogue.templateId)
    const node = template.nodes[dialogue.currentNode]
    const npc = NPC_CONTACTS[dialogue.npcId]

    if (!node) return

    // Process text with context
    const text = this.processText(node.text || '', dialogue.context)

    switch (node.type) {
      case NODE_TYPES.MESSAGE:
        terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
        terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_JOB)
        terminalManager.addOutput(text, OUTPUT_TYPES.RESPONSE)
        // Auto-advance to next node if it's a choice
        if (node.next) {
          dialogue.currentNode = node.next
          this.displayCurrentNode(dialogueId)
        }
        break

      case NODE_TYPES.CHOICE:
        terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
        node.options.forEach((opt, i) => {
          // Check condition if exists
          if (opt.condition && !this.checkCondition(opt.condition, dialogue)) {
            return
          }
          terminalManager.addOutput(`  [${opt.text}] ${opt.label}`, OUTPUT_TYPES.HANDLER)
        })
        terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
        terminalManager.addOutput(`Type your choice to respond.`, OUTPUT_TYPES.SYSTEM)
        break

      case NODE_TYPES.NEGOTIATE:
        const npcResponse = this.processText(node.npcResponse, dialogue.context)
        terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
        terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_JOB)
        terminalManager.addOutput(npcResponse, OUTPUT_TYPES.RESPONSE)
        if (node.next) {
          dialogue.currentNode = node.next
          this.displayCurrentNode(dialogueId)
        }
        break

      case NODE_TYPES.OUTCOME:
        const outcomeText = this.processText(text, dialogue.context)
        terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
        terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_JOB)
        terminalManager.addOutput(outcomeText, OUTPUT_TYPES.RESPONSE)

        // Apply result
        if (node.result) {
          this.applyResult(dialogue, node.result)
        }

        // Advance to end
        if (node.next) {
          dialogue.currentNode = node.next
        }
        this.endDialogue(dialogueId)
        break

      case NODE_TYPES.END:
        this.endDialogue(dialogueId)
        break
    }

    this.saveToStorage()
  }

  /**
   * Process player choice in dialogue
   */
  processChoice(dialogueId, choice) {
    const dialogue = this.activeDialogues.get(dialogueId)
    if (!dialogue) return { error: 'No active dialogue' }

    const template = this.dialogueTemplates.get(dialogue.templateId)
    const node = template.nodes[dialogue.currentNode]

    if (node.type !== NODE_TYPES.CHOICE) {
      return { error: 'Not waiting for choice' }
    }

    // Find matching option
    const option = node.options.find(opt =>
      opt.text.toLowerCase() === choice.toLowerCase() ||
      opt.label.toLowerCase().includes(choice.toLowerCase())
    )

    if (!option) {
      return { error: `Unknown choice: "${choice}"` }
    }

    // Check condition
    if (option.condition && !this.checkCondition(option.condition, dialogue)) {
      return { error: 'Cannot select that option' }
    }

    // Record choice
    dialogue.history.push({
      node: dialogue.currentNode,
      choice: option.text,
      timestamp: Date.now()
    })

    // Handle negotiation push
    if (option.text === 'push') {
      dialogue.context.negotiationAttempts++
      const pushSuccess = this.calculateNegotiationSuccess(dialogue)

      if (pushSuccess) {
        dialogue.context.currentOffer = Math.floor(dialogue.context.currentOffer * 1.15)
        dialogue.context.pushResponse = `You got balls. Fine. $${dialogue.context.currentOffer.toLocaleString()}. But don't push your luck.`
      } else {
        dialogue.context.pushResponse = `Don't waste my time. Take it or leave it.`
        // Remove push option for next round
        dialogue.context.canPush = false
      }
    }

    // Move to next node
    dialogue.currentNode = option.next
    this.displayCurrentNode(dialogueId)

    return { success: true }
  }

  /**
   * Calculate negotiation success
   */
  calculateNegotiationSuccess(dialogue) {
    const npc = NPC_CONTACTS[dialogue.npcId]
    const player = gameManager.player || {}

    // Base chance decreases with attempts
    let chance = 0.6 - (dialogue.context.negotiationAttempts * 0.2)

    // Reputation bonus
    const relationship = playerReputationManager.getNPCRelationship(dialogue.npcId)
    if (relationship.trust > 50) chance += 0.15
    if (relationship.trust < 0) chance -= 0.2

    // Personality affects willingness
    if (npc.personality === 'professional' || npc.personality === 'calculated') {
      chance -= 0.1 // Harder to negotiate
    }
    if (npc.personality === 'desperate') {
      chance += 0.2 // Easier to negotiate
    }

    return Math.random() < chance
  }

  /**
   * Get personality-based negotiation responses
   */
  getNegotiationResponses(npcId) {
    const npc = NPC_CONTACTS[npcId]
    if (!npc) return this.getDefaultResponses()

    // Personality-based responses
    const responses = {
      chatty: {
        accept: [
          "Alright alright, you drive a hard bargain! Fine, deal.",
          "You know what? I like your style. You got it.",
          "Okay okay, you win this one. But next time..."
        ],
        reluctant: [
          "Man, you're killing me here... fine, I guess.",
          "You're lucky I need this done. Alright.",
          "Ugh, okay. But you owe me one!"
        ],
        reject: [
          "Nah man, that's way too low. Come on!",
          "You serious right now? That ain't happening.",
          "I got bills to pay! Can't go that low."
        ],
        counter: [
          "Tell you what... meet me at",
          "How about we split the difference?",
          "Best I can do is"
        ],
        insulted: [
          "You trying to insult me? We're done here.",
          "That's disrespectful. Don't contact me again.",
          "Waste of my time. Get lost."
        ]
      },
      professional: {
        accept: [
          "Acceptable. Terms agreed.",
          "Very well. Deal confirmed.",
          "Agreed. Proceed."
        ],
        reluctant: [
          "Borderline acceptable. Confirmed.",
          "Against my better judgment. Agreed.",
          "This is my final concession."
        ],
        reject: [
          "Unacceptable. Terms are non-negotiable.",
          "That offer is below threshold. Declined.",
          "These terms cannot be met. Final answer."
        ],
        counter: [
          "Counter proposal:",
          "Alternative terms:",
          "Final offer:"
        ],
        insulted: [
          "This negotiation is terminated. Do not contact again.",
          "Unprofessional conduct noted. Blacklisted.",
          "We have nothing further to discuss."
        ]
      },
      desperate: {
        accept: [
          "Yes! Yes! Deal! Thank you!",
          "Fine fine, whatever you want! Just do it!",
          "Okay! Okay! You got me, deal!"
        ],
        reluctant: [
          "Ugh... I really need this... okay.",
          "You're really squeezing me... fine.",
          "I can't believe I'm agreeing to this..."
        ],
        reject: [
          "Come on! I'm already giving you everything!",
          "I literally can't go lower! Please!",
          "You're asking the impossible!"
        ],
        counter: [
          "Please, at least",
          "I'm begging you, how about",
          "Just give me"
        ],
        insulted: [
          "You... you're heartless! Forget it!",
          "Even I have limits! Get out!",
          "Fine! Find someone else then!"
        ]
      },
      calculated: {
        accept: [
          "Optimal outcome achieved. Proceed.",
          "Risk/reward acceptable. Agreed.",
          "Calculations confirmed. Deal."
        ],
        reluctant: [
          "Suboptimal but within parameters.",
          "Marginal gain acceptable.",
          "Proceeding against model recommendations."
        ],
        reject: [
          "Negative expected value. Declined.",
          "Outside acceptable parameters.",
          "Risk exceeds tolerance. No deal."
        ],
        counter: [
          "Adjusted proposal:",
          "Revised calculation suggests:",
          "Optimal counter:"
        ],
        insulted: [
          "Hostile actor flagged. Communication terminated.",
          "Trust score below threshold. Blocked.",
          "Bad faith detected. Relationship severed."
        ]
      },
      tough: {
        accept: [
          "Fine. Don't make me regret this.",
          "You got guts. Deal.",
          "Alright. But cross me and you're done."
        ],
        reluctant: [
          "This better be worth it. Fine.",
          "I don't like this. But okay.",
          "One time only. Deal."
        ],
        reject: [
          "Not happening. Take it or leave it.",
          "Do I look like a charity? No.",
          "Get real. That's insulting."
        ],
        counter: [
          "Here's how this works:",
          "My terms:",
          "Take this or walk:"
        ],
        insulted: [
          "You just made an enemy. Get out.",
          "Wrong move. You're done in this town.",
          "Remember my face. You'll see it again."
        ]
      }
    }

    return responses[npc.personality] || this.getDefaultResponses()
  }

  /**
   * Get default negotiation responses
   */
  getDefaultResponses() {
    return {
      accept: ["Deal.", "Agreed.", "Fine."],
      reluctant: ["Okay, I guess.", "If you insist.", "Fine..."],
      reject: ["No deal.", "Can't do that.", "Not happening."],
      counter: ["How about", "Best I can do is", "Counter:"],
      insulted: ["We're done.", "Don't contact me again.", "Conversation over."]
    }
  }

  /**
   * Generate negotiation response based on offer difference and personality
   */
  generateNegotiationResponse(dialogue, playerOffer) {
    const npc = NPC_CONTACTS[dialogue.npcId]
    const responses = this.getNegotiationResponses(dialogue.npcId)
    const originalOffer = dialogue.context.baseReward
    const percentDiff = ((playerOffer - originalOffer) / originalOffer) * 100

    let responseType, accepted = false, trustChange = 0
    let counterOffer = null

    if (percentDiff < 5) {
      // Close to original - likely accept
      accepted = Math.random() < 0.9
      responseType = accepted ? 'accept' : 'reluctant'
      if (accepted) trustChange = 2
    } else if (percentDiff < 15) {
      // Moderate increase - personality dependent
      const flexibility = npc?.personality === 'desperate' ? 0.7 :
                         npc?.personality === 'calculated' ? 0.3 : 0.5
      accepted = Math.random() < flexibility

      if (accepted) {
        responseType = 'reluctant'
      } else {
        responseType = 'counter'
        counterOffer = Math.floor((playerOffer + originalOffer) / 2)
      }
    } else if (percentDiff < 30) {
      // High increase - usually reject with counter
      responseType = 'counter'
      counterOffer = Math.floor(originalOffer * 1.1) // 10% above original
    } else {
      // Insulting offer
      responseType = 'insulted'
      trustChange = -10
    }

    // Pick random response from type
    const responseOptions = responses[responseType]
    let response = responseOptions[Math.floor(Math.random() * responseOptions.length)]

    // Add counter offer if applicable
    if (counterOffer && responseType === 'counter') {
      response = `${response} $${counterOffer.toLocaleString()}.`
      dialogue.context.currentOffer = counterOffer
    }

    return {
      response,
      accepted,
      trustChange,
      counterOffer,
      responseType
    }
  }

  /**
   * Check dialogue condition
   */
  checkCondition(condition, dialogue) {
    switch (condition) {
      case 'canPush':
        return dialogue.context.negotiationAttempts < 2 &&
               dialogue.context.canPush !== false
      case 'hasEnoughCash':
        const player = gameManager.player || {}
        return (player.cash || 0) >= dialogue.context.currentOffer
      default:
        return true
    }
  }

  /**
   * Process text with context variables
   */
  processText(text, context) {
    if (!text) return ''

    let result = text
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g')
      result = result.replace(regex, value)
    })
    return result
  }

  /**
   * Apply dialogue result
   */
  applyResult(dialogue, result) {
    // Trust change
    if (result.trustChange) {
      playerReputationManager.modifyNPCTrust(
        dialogue.npcId,
        result.trustChange,
        `dialogue: ${result.type}`
      )
    }

    // Create mission/deal opportunity
    if (result.type === 'mission_accepted') {
      opportunityManager.createOpportunity({
        type: OPPORTUNITY_TYPES.NPC_JOB,
        npcId: dialogue.npcId,
        title: dialogue.title,
        message: `Mission with ${NPC_CONTACTS[dialogue.npcId]?.name}`,
        rewards: {
          cash: dialogue.context.currentOffer,
          respect: 50
        },
        risks: { heat: 15 },
        expiryMs: 30 * 60 * 1000
      })
    }

    // Handle blocking
    if (result.blocked) {
      // Temporary cooldown with this NPC
      dialogue.context.blockedUntil = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }
  }

  /**
   * End a dialogue
   */
  endDialogue(dialogueId) {
    const dialogue = this.activeDialogues.get(dialogueId)
    if (!dialogue) return

    dialogue.endedAt = Date.now()
    dialogue.completed = true

    // Keep in history but remove from active
    setTimeout(() => {
      this.activeDialogues.delete(dialogueId)
      this.saveToStorage()
    }, 5000)
  }

  /**
   * Get active dialogue for player input processing
   */
  getActiveDialogue() {
    for (const [id, dialogue] of this.activeDialogues) {
      if (!dialogue.completed) {
        return { id, dialogue }
      }
    }
    return null
  }

  /**
   * Check if player input matches a dialogue choice
   */
  tryProcessInput(input) {
    const active = this.getActiveDialogue()
    if (!active) return null

    const result = this.processChoice(active.id, input)
    if (result.error) {
      return null // Not a valid choice, let terminal handle normally
    }
    return result
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        dialogues: Array.from(this.activeDialogues.entries())
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[DialogueTreeManager] Save error:', e)
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.dialogues) {
          this.activeDialogues = new Map(data.dialogues)
        }
      }
    } catch (e) {
      console.error('[DialogueTreeManager] Load error:', e)
    }
  }

  /**
   * Create a quick negotiation dialogue
   */
  createNegotiation(npcId, baseOffer, context = {}) {
    return this.startDialogue(`${npcId}_deal`, {
      baseReward: baseOffer,
      basePrice: baseOffer,
      currentOffer: baseOffer,
      counterPrice: Math.floor(baseOffer * 0.9),
      halfPrice: Math.floor(baseOffer * 0.55),
      streetValue: Math.floor(baseOffer * 1.4),
      ...context
    })
  }
}

// Singleton instance
export const dialogueTreeManager = new DialogueTreeManager()

export default dialogueTreeManager
