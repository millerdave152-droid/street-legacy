/**
 * MessageTemplateSystem - Dynamic message generation with templates
 *
 * Features:
 * - Template-based message generation
 * - Context-aware variable substitution
 * - NPC personality adjustments
 * - Time-based and location-based context
 */

import { gameManager } from '../GameManager'
import { NPC_CONTACTS } from '../data/NPCContacts'
import { DISTRICTS } from '../data/GameData'

// Toronto locations for templates
const LOCATIONS = [
  'Queen Street bodega', 'Dundas corner store', 'Spadina pawn shop',
  'King Street warehouse', 'Yorkville mansion', 'Regent Park complex',
  'Bay Street tower', 'Kensington alley', 'Chinatown market',
  'Port Lands dock', 'Scarborough plaza', 'Etobicoke industrial yard',
  'Financial District vault', 'The Beach boardwalk', 'Jane & Finch block'
]

// Time periods
const TIME_PERIODS = [
  '2-3am', '10pm', 'midnight', 'between shifts', 'during lunch',
  'after dark', 'early morning', 'shift change', 'closing time'
]

// Items/targets
const ITEMS = [
  'electronics', 'cash', 'jewelry', 'documents', 'product',
  'merchandise', 'crypto wallet', 'safe contents', 'inventory'
]

// Security levels
const SECURITY_LEVELS = ['minimal', 'light', 'moderate', 'heavy', 'tight']

// Schemes for scams
const SCHEMES = [
  'crypto investment', 'NFT project', 'forex trading',
  'sports betting tip', 'insider stock deal', 'real estate flip'
]

// Message Templates by Type
export const MESSAGE_TEMPLATES = {
  INTEL_TIP: [
    '{location} security guard takes smoke break {time}. {duration} window.',
    'Heard {target} keeps {item} in {location}. {securityLevel} security.',
    'Pattern spotted: {event} happens every {frequency}. Opportunity.',
    'The {location} closes at {time}. Back door left unlocked until {duration}.',
    '{target} spotted with {item} near {location}. Worth investigating.',
    'Security camera blind spot at {location}. {duration} to move.',
    'Delivery truck at {location} every {frequency}. Easy pickings.'
  ],

  DEAL_OFFER: [
    'Got {quantity}x {item}. ${price} total. {discount}% off market. Expires {time}.',
    'Moving {quantity} {item}. Need cash fast. ${price} for all. {urgency}.',
    'Bulk sale: {quantity}x {item}. Your cut: ${price}. Limited time.',
    'Quality {item} available. {quantity} units. ${price} takes all.',
    'Hot merchandise: {quantity}x {item}. ${price}. No questions asked.',
    'Clearance: {item} x{quantity}. ${price} firm. Gone by {time}.',
    'Excess inventory: {quantity} {item}. ${price}. Quick turnaround.'
  ],

  SCAM_PITCH: [
    'BRO this {scheme} is INSANE! Just need ${amount} to get in. GUARANTEED {return}x!!!',
    'YO heard about {opportunity}?? Only ${amount} to join. Everyone making BANK!!!',
    'URGENT: {scheme} closing in {time}. Need ${amount} NOW. Don\'t miss out!!!',
    'Listen my {relation} works at {company}. Insider tip. ${amount} gets you ${return}x back!!!',
    'EXCLUSIVE opportunity. {scheme}. Just ${amount} to start. Money printer goes BRRR!!!',
    'BRO this is DIFFERENT. {scheme}. ${amount} in, ${return}x out. GUARANTEED!!!',
    'Trust me on this one: {scheme}. ${amount} needed. Returns in {time}. NO CAP!!!'
  ],

  WARNING: [
    'Heat rising in {location}. Cops asking about {event}. Lay low.',
    'Your name came up in {context}. Recommend {action} immediately.',
    'Heard {rumor}. Could be nothing, could be setup. Watch yourself.',
    'Cops increased patrols near {location}. Avoid for {duration}.',
    'Someone talking about {event}. Might want to {action}.',
    'Undercovers spotted in {location}. Stay away for now.',
    '{contact} mentioned your name. Not good. {action}.'
  ],

  JOB_OFFER: [
    'Client needs {task} done. ${reward}. {difficulty} difficulty.',
    '{task} job available. ${reward} on completion. {timeframe}.',
    'Quick work: {task}. ${reward}. Need answer now.',
    'Contract: {task}. ${reward} guaranteed. {requirements}.',
    'Opportunity: {task}. ${reward}. {clientType} client.'
  ],

  BETRAYAL: [
    'Sorry but survival comes first. Cops have your location.',
    'Nothing personal. They offered more. You\'re on your own.',
    'Business is business. The heat was too much. Good luck.',
    'Had to make a choice. Wasn\'t easy. They know everything.',
    'Forgive me. They threatened my family. Run while you can.'
  ],

  CREW_MISSION: [
    'Crew hitting {location}. Need {role}. Your cut: ${reward}. You in?',
    '{territory} operation tonight. {crewSize} person job. ${reward} each.',
    'Big score at {location}. Need {role}. {difficulty}. ${reward}.',
    'Territory move on {location}. We need you as {role}. ${reward}.',
    'Joint op: {location}. {crewSize} needed. Your cut: ${reward}.'
  ]
}

// Context generators
const contextGenerators = {
  location: () => LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
  time: () => TIME_PERIODS[Math.floor(Math.random() * TIME_PERIODS.length)],
  item: () => ITEMS[Math.floor(Math.random() * ITEMS.length)],
  securityLevel: () => SECURITY_LEVELS[Math.floor(Math.random() * SECURITY_LEVELS.length)],
  scheme: () => SCHEMES[Math.floor(Math.random() * SCHEMES.length)],
  duration: () => ['5 minutes', '10 minutes', '15 minutes', '30 minutes', '1 hour'][Math.floor(Math.random() * 5)],
  frequency: () => ['hour', 'day', 'Tuesday', 'night', 'week'][Math.floor(Math.random() * 5)],
  quantity: () => Math.floor(Math.random() * 20) + 5,
  price: () => (Math.floor(Math.random() * 50) + 5) * 100,
  discount: () => Math.floor(Math.random() * 30) + 10,
  amount: () => (Math.floor(Math.random() * 30) + 5) * 100,
  return: () => Math.floor(Math.random() * 8) + 2,
  reward: () => (Math.floor(Math.random() * 100) + 10) * 100,
  urgency: () => ['Act fast.', 'Going quick.', 'First come first serve.', 'Won\'t last.'][Math.floor(Math.random() * 4)],
  target: () => ['Guard', 'Manager', 'Owner', 'Driver', 'Courier'][Math.floor(Math.random() * 5)],
  event: () => ['that heist', 'the score', 'your last job', 'recent activity'][Math.floor(Math.random() * 4)],
  context: () => ['a conversation', 'a report', 'police radio', 'street talk'][Math.floor(Math.random() * 4)],
  action: () => ['lay low', 'bank your cash', 'change locations', 'go dark'][Math.floor(Math.random() * 4)],
  rumor: () => ['someone snitched', 'cops planning raid', 'your stash compromised', 'undercover in area'][Math.floor(Math.random() * 4)],
  task: () => ['delivery', 'pickup', 'lookout duty', 'driver work', 'muscle backup'][Math.floor(Math.random() * 5)],
  difficulty: () => ['Easy', 'Moderate', 'Hard', 'Risky'][Math.floor(Math.random() * 4)],
  timeframe: () => ['Tonight only.', '24 hours.', 'This week.', 'ASAP.'][Math.floor(Math.random() * 4)],
  requirements: () => ['No heat required.', 'Level 5+.', 'Clean record.', 'Experienced only.'][Math.floor(Math.random() * 4)],
  clientType: () => ['High-profile', 'Discreet', 'Repeat', 'New'][Math.floor(Math.random() * 4)],
  role: () => ['lookout', 'driver', 'muscle', 'hacker', 'insider'][Math.floor(Math.random() * 5)],
  territory: () => ['Jane & Finch', 'Parkdale', 'Scarborough', 'Downtown'][Math.floor(Math.random() * 4)],
  crewSize: () => [2, 3, 4][Math.floor(Math.random() * 3)],
  opportunity: () => ['this forex thing', 'the crypto club', 'my investment group'][Math.floor(Math.random() * 3)],
  relation: () => ['cousin', 'uncle', 'buddy', 'contact'][Math.floor(Math.random() * 4)],
  company: () => ['the bank', 'a hedge fund', 'a crypto exchange'][Math.floor(Math.random() * 3)],
  contact: () => ['Snoop', 'Watcher', 'Someone'][Math.floor(Math.random() * 3)]
}

class MessageTemplateSystem {
  constructor() {
    this.templates = MESSAGE_TEMPLATES
  }

  /**
   * Generate a message from template
   */
  generateMessage(type, context = {}) {
    const templates = this.templates[type]
    if (!templates || templates.length === 0) {
      console.warn(`[MessageTemplateSystem] No templates for type: ${type}`)
      return null
    }

    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)]

    // Fill in template variables
    return this.fillTemplate(template, context)
  }

  /**
   * Generate message with NPC personality applied
   */
  generateNPCMessage(npcId, type, context = {}) {
    const npc = NPC_CONTACTS[npcId]
    if (!npc) {
      console.warn(`[MessageTemplateSystem] Unknown NPC: ${npcId}`)
      return this.generateMessage(type, context)
    }

    // Get base message
    let message = this.generateMessage(type, context)
    if (!message) return null

    // Apply personality adjustments
    message = this.applyPersonality(message, npc.personality)

    return {
      text: message,
      npc,
      type,
      context
    }
  }

  /**
   * Fill template with context values
   */
  fillTemplate(template, context = {}) {
    let result = template

    // Find all {variable} placeholders
    const matches = template.match(/\{(\w+)\}/g)
    if (!matches) return result

    matches.forEach(match => {
      const varName = match.slice(1, -1) // Remove { and }

      // Check if context has value
      if (context[varName] !== undefined) {
        result = result.replace(match, context[varName])
      } else if (contextGenerators[varName]) {
        // Generate value from generator
        result = result.replace(match, contextGenerators[varName]())
      } else {
        // Unknown variable, leave as is or use placeholder
        result = result.replace(match, '???')
      }
    })

    return result
  }

  /**
   * Apply NPC personality to message
   */
  applyPersonality(message, personality) {
    switch (personality) {
      case 'chatty':
        // Add filler words
        return message.replace(/\. /g, ', you know? ')
      case 'aggressive':
        // All caps and emphasis
        return message.toUpperCase().replace(/\./g, '!!!')
      case 'professional':
        // Clean, formal
        return message
      case 'paranoid':
        // Add caution
        return message + ' Delete this message after reading.'
      case 'mentor':
        // Add wisdom
        return 'Listen up: ' + message
      case 'observant':
        // Terse
        return message.replace(/, /g, '. ')
      case 'desperate':
        // Add urgency
        return message.replace(/\./g, '!') + ' Please!'
      case 'calculated':
        // Add formality
        return 'Opportunity: ' + message + ' Confirm within 1 hour.'
      case 'tough':
        // Direct
        return message.replace(/\?/g, '.')
      default:
        return message
    }
  }

  /**
   * Generate contextual message based on player state
   */
  generateContextualMessage(npcId, playerContext = {}) {
    const player = gameManager.player || {}
    const heat = player.heat || 0
    const level = player.level || 1
    const cash = player.cash || 0

    // Determine message type based on context
    let type = 'INTEL_TIP'

    if (heat >= 70) {
      type = 'WARNING'
    } else if (level >= 10 && Math.random() < 0.3) {
      type = 'CREW_MISSION'
    } else if (Math.random() < 0.4) {
      type = 'DEAL_OFFER'
    } else if (Math.random() < 0.5) {
      type = 'JOB_OFFER'
    }

    // Build context
    const context = {
      ...playerContext,
      playerLevel: level,
      playerHeat: heat,
      playerCash: cash
    }

    return this.generateNPCMessage(npcId, type, context)
  }

  /**
   * Get template for specific NPC and type
   */
  getTemplatesForNPC(npcId, type) {
    const npc = NPC_CONTACTS[npcId]
    if (!npc) return []

    // Check if NPC has custom templates
    if (npc.messageTemplates && npc.messageTemplates[type]) {
      return npc.messageTemplates[type]
    }

    // Fall back to generic templates
    return this.templates[type] || []
  }

  /**
   * Generate scam message (for Ironman/Morgan)
   */
  generateScamMessage(context = {}) {
    return this.generateMessage('SCAM_PITCH', {
      ...context,
      amount: context.amount || (Math.floor(Math.random() * 20) + 5) * 100,
      return: context.return || Math.floor(Math.random() * 8) + 2
    })
  }

  /**
   * Generate warning message
   */
  generateWarningMessage(context = {}) {
    const player = gameManager.player
    return this.generateMessage('WARNING', {
      ...context,
      location: player?.currentDistrict || 'the area'
    })
  }

  /**
   * Generate crew mission offer
   */
  generateCrewMissionMessage(context = {}) {
    return this.generateMessage('CREW_MISSION', {
      reward: (Math.floor(Math.random() * 50) + 20) * 100,
      ...context
    })
  }
}

// Singleton instance
export const messageTemplateSystem = new MessageTemplateSystem()

export default messageTemplateSystem
