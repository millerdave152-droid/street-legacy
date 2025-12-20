/**
 * AIMessageManager - Handles AI-to-player messages and offers
 *
 * Features:
 * - Generate contextual offers based on AI personality
 * - Handle deceptive vs honest offers
 * - Track player responses and trust changes
 * - Queue and manage active messages
 */

import { aiPlayerManager } from './AIPlayerManager.js'
import {
  getPersonality,
  PERSONALITY_TYPES,
  OFFER_TYPES,
  DECEPTION_TYPES
} from '../data/AIPersonalities.js'
import { TRADING_GOODS } from '../data/GameData.js'

const STORAGE_KEY = 'street_legacy_ai_messages'
const MAX_ACTIVE_MESSAGES = 5
const MESSAGE_EXPIRE_TIME = 600000 // 10 minutes

class AIMessageManagerClass {
  constructor() {
    this.activeMessages = []
    this.messageHistory = []
    this.listeners = new Map()
    this.isInitialized = false
  }

  /**
   * Initialize the message manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadFromStorage()
    this.cleanupExpiredMessages()
    this.isInitialized = true

    console.log(`[AIMessageManager] Initialized with ${this.activeMessages.length} active messages`)
  }

  /**
   * Generate a new offer from an AI
   */
  generateOffer(ai) {
    if (this.activeMessages.length >= MAX_ACTIVE_MESSAGES) {
      // Remove oldest message
      this.activeMessages.shift()
    }

    const personality = getPersonality(ai.personality)

    // Determine if this offer will be deceptive
    const deceptionChance = ai.deceptiveness * ((100 - ai.playerTrust) / 100)
    const isDeceptive = Math.random() < deceptionChance

    // Select offer type based on personality
    const offerType = this.selectOfferType(ai, personality)

    // Generate the offer content
    const offer = this.createOffer(ai, personality, offerType, isDeceptive)

    // Add to active messages
    this.activeMessages.push(offer)
    this.save()

    // Emit new message event
    this.emit('newMessage', offer)

    console.log(`[AIMessageManager] ${ai.username} sent offer: ${offer.title} (deceptive: ${isDeceptive})`)

    return offer
  }

  /**
   * Select offer type based on AI personality
   */
  selectOfferType(ai, personality) {
    const preferredOffers = personality.preferredOffers || [OFFER_TYPES.TRADE_DEAL]

    // Add some randomness
    if (Math.random() < 0.2) {
      // 20% chance of random offer type
      const allTypes = Object.values(OFFER_TYPES)
      return allTypes[Math.floor(Math.random() * allTypes.length)]
    }

    return preferredOffers[Math.floor(Math.random() * preferredOffers.length)]
  }

  /**
   * Create the offer content
   */
  createOffer(ai, personality, offerType, isDeceptive) {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Base offer structure
    const offer = {
      id,
      fromAI: ai.id,
      fromUsername: ai.username,
      fromPersonality: ai.personality,
      type: offerType,
      isDeceptive,
      deceptionType: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + MESSAGE_EXPIRE_TIME,
      read: false,
      responded: false,
      response: null
    }

    // Generate type-specific content
    switch (offerType) {
      case OFFER_TYPES.TRADE_DEAL:
        this.populateTradeDeal(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.HOT_TIP:
        this.populateHotTip(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.ALLIANCE:
        this.populateAllianceRequest(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.WARNING:
        this.populateWarning(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.INVESTMENT:
        this.populateInvestment(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.PROTECTION:
        this.populateProtection(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.JOB_OFFER:
        this.populateJobOffer(offer, ai, personality, isDeceptive)
        break

      case OFFER_TYPES.GIFT:
        this.populateGift(offer, ai, personality, isDeceptive)
        break

      default:
        this.populateGenericOffer(offer, ai, personality)
    }

    // Add speech style from personality
    const greeting = personality.speechStyle.greetings[
      Math.floor(Math.random() * personality.speechStyle.greetings.length)
    ]
    const closing = personality.speechStyle.closings[
      Math.floor(Math.random() * personality.speechStyle.closings.length)
    ]

    offer.message = `${greeting}\n\n${offer.message}\n\n${closing}`

    return offer
  }

  /**
   * Populate trade deal offer
   */
  populateTradeDeal(offer, ai, personality, isDeceptive) {
    const goods = TRADING_GOODS.filter(g => ai.level >= (g.min_level || 1))
    const good = goods[Math.floor(Math.random() * goods.length)]

    if (!good) {
      this.populateGenericOffer(offer, ai, personality)
      return
    }

    const basePrice = good.basePrice || 100
    let offeredPrice

    if (isDeceptive) {
      // Inflated price (15-35% markup)
      offeredPrice = Math.floor(basePrice * (1.15 + Math.random() * 0.2))
      offer.deceptionType = DECEPTION_TYPES.INFLATED_PRICE
      offer.actualValue = basePrice
    } else {
      // Fair to good price (85-100%)
      offeredPrice = Math.floor(basePrice * (0.85 + Math.random() * 0.15))
      offer.actualValue = offeredPrice
    }

    const quantity = Math.floor(Math.random() * 5) + 2

    offer.title = `Trade Deal: ${good.name}`
    offer.message = `I've got ${quantity}x ${good.name} available for $${offeredPrice} each. Total: $${offeredPrice * quantity}. Good stuff, hard to find.`
    offer.data = {
      good: good.id,
      goodName: good.name,
      quantity,
      priceEach: offeredPrice,
      totalPrice: offeredPrice * quantity
    }
    offer.choices = [
      { label: `Buy ($${offeredPrice * quantity})`, action: 'accept' },
      { label: 'Decline', action: 'decline' },
      { label: 'Counter Offer', action: 'counter' }
    ]
  }

  /**
   * Populate hot tip offer
   */
  populateHotTip(offer, ai, personality, isDeceptive) {
    const goods = TRADING_GOODS
    const good = goods[Math.floor(Math.random() * goods.length)]

    const tipTypes = ['price_spike', 'price_crash', 'supply_shortage', 'cop_raid']
    const tipType = tipTypes[Math.floor(Math.random() * tipTypes.length)]

    if (isDeceptive) {
      // False information
      offer.deceptionType = DECEPTION_TYPES.BAD_INTEL

      if (tipType === 'price_spike') {
        offer.title = 'Hot Tip: Market Intel'
        offer.message = `${good.name} prices are about to SPIKE. Stock up now before everyone else catches on.`
        offer.data = { tipType, good: good.id, direction: 'up', actualDirection: 'down' }
      } else {
        offer.title = 'URGENT: Market Warning'
        offer.message = `Word on the street is ${good.name} market is about to CRASH. Sell now!`
        offer.data = { tipType, good: good.id, direction: 'down', actualDirection: 'up' }
      }
    } else {
      // Genuine tip
      offer.title = 'Market Intelligence'
      const direction = Math.random() < 0.5 ? 'up' : 'down'
      offer.message = direction === 'up'
        ? `Reliable source says ${good.name} demand is increasing. Might be worth stocking up.`
        : `Heads up - ${good.name} supply is flooding the market. Prices might dip soon.`
      offer.data = { tipType, good: good.id, direction, actualDirection: direction }
    }

    offer.choices = [
      { label: 'Thanks', action: 'accept' },
      { label: 'Ignore', action: 'decline' }
    ]
  }

  /**
   * Populate alliance request
   */
  populateAllianceRequest(offer, ai, personality, isDeceptive) {
    offer.title = 'Alliance Proposal'

    if (isDeceptive) {
      offer.deceptionType = DECEPTION_TYPES.BETRAYAL
      offer.message = `We should team up. Together we can dominate this city. I'll watch your back, you watch mine. What do you say?`
      offer.data = { willBetray: true, betrayalTiming: Math.floor(Math.random() * 5) + 3 } // Betray after 3-7 actions
    } else {
      offer.message = `You've impressed me. I think we could do well working together. Alliance means shared intel, backup when needed, and mutual respect. Interested?`
      offer.data = { willBetray: false }
    }

    offer.choices = [
      { label: 'Form Alliance', action: 'accept' },
      { label: 'Not Interested', action: 'decline' },
      { label: 'Need Time to Think', action: 'defer' }
    ]
  }

  /**
   * Populate warning message
   */
  populateWarning(offer, ai, personality, isDeceptive) {
    offer.title = 'Warning'

    const warningTypes = ['cops', 'rival', 'market', 'heat']
    const type = warningTypes[Math.floor(Math.random() * warningTypes.length)]

    if (isDeceptive) {
      offer.deceptionType = DECEPTION_TYPES.FALSE_PANIC

      switch (type) {
        case 'cops':
          offer.message = `URGENT! Police are planning a major bust tonight. Dump your inventory NOW before they confiscate everything!`
          break
        case 'rival':
          offer.message = `Someone put a hit on you. Lay low for a while. Don't do any jobs today.`
          break
        default:
          offer.message = `Things are heating up. I'd stay off the streets if I were you.`
      }

      offer.data = { type, isFalse: true }
    } else {
      switch (type) {
        case 'cops':
          offer.message = `Heard through the grapevine that heat is increasing in your area. Might want to keep your head down.`
          break
        case 'rival':
          offer.message = `Watch out - ${aiPlayerManager.getAll()[0]?.username || 'someone'} has been asking about you. Could be trouble.`
          break
        default:
          offer.message = `Just a heads up - be careful out there. Streets aren't safe right now.`
      }

      offer.data = { type, isFalse: false }
    }

    offer.choices = [
      { label: 'Thanks for the heads up', action: 'accept' },
      { label: 'I\'ll be fine', action: 'decline' }
    ]
  }

  /**
   * Populate investment offer
   */
  populateInvestment(offer, ai, personality, isDeceptive) {
    const investmentAmount = Math.floor(Math.random() * 5000) + 1000
    const returnMultiplier = isDeceptive
      ? (2.0 + Math.random() * 1.0) // Too good to be true: 200-300%
      : (1.2 + Math.random() * 0.3) // Realistic: 120-150%

    offer.title = 'Investment Opportunity'

    if (isDeceptive) {
      offer.deceptionType = DECEPTION_TYPES.SCAM
      offer.message = `Big opportunity here. Put in $${investmentAmount} and I guarantee you'll get back $${Math.floor(investmentAmount * returnMultiplier)} within a week. My operation is foolproof.`
      offer.data = {
        amount: investmentAmount,
        promisedReturn: Math.floor(investmentAmount * returnMultiplier),
        actualReturn: 0, // Scam - they get nothing back
        isScam: true
      }
    } else {
      offer.message = `Got a job lined up that needs capital. Invest $${investmentAmount} and I'll cut you in for $${Math.floor(investmentAmount * returnMultiplier)} when it pays off. Risky, but the reward is real.`
      offer.data = {
        amount: investmentAmount,
        promisedReturn: Math.floor(investmentAmount * returnMultiplier),
        actualReturn: Math.floor(investmentAmount * returnMultiplier * (0.8 + Math.random() * 0.4)),
        isScam: false
      }
    }

    offer.choices = [
      { label: `Invest $${investmentAmount}`, action: 'accept' },
      { label: 'Too Risky', action: 'decline' }
    ]
  }

  /**
   * Populate protection offer
   */
  populateProtection(offer, ai, personality, isDeceptive) {
    const protectionCost = Math.floor(Math.random() * 2000) + 500

    offer.title = 'Protection Offer'

    if (isDeceptive) {
      offer.deceptionType = DECEPTION_TYPES.EXTORTION
      offer.message = `Nice operation you've got. Would be a shame if something happened to it. Pay me $${protectionCost} and I'll make sure nobody bothers you.`
      offer.data = {
        cost: protectionCost,
        isExtortion: true,
        consequenceIfDecline: 'harassment'
      }
    } else {
      offer.message = `The streets are dangerous. For $${protectionCost}, I can make sure the wrong people don't mess with you. Consider it insurance.`
      offer.data = {
        cost: protectionCost,
        isExtortion: false,
        benefit: 'heat_reduction'
      }
    }

    offer.choices = [
      { label: `Pay $${protectionCost}`, action: 'accept' },
      { label: 'I can handle myself', action: 'decline' }
    ]
  }

  /**
   * Populate job offer
   */
  populateJobOffer(offer, ai, personality, isDeceptive) {
    const jobPay = Math.floor(Math.random() * 3000) + 1000
    const jobTypes = ['heist', 'delivery', 'muscle', 'lookout']
    const jobType = jobTypes[Math.floor(Math.random() * jobTypes.length)]

    offer.title = `Job: ${jobType.charAt(0).toUpperCase() + jobType.slice(1)} Work`

    if (isDeceptive) {
      offer.deceptionType = DECEPTION_TYPES.SETUP
      offer.message = `Got a ${jobType} job that pays $${jobPay}. Easy money, low risk. You in?`
      offer.data = {
        jobType,
        pay: jobPay,
        isSetup: true,
        actualOutcome: 'caught' // Player gets busted
      }
    } else {
      offer.message = `Need someone reliable for a ${jobType} job. Pays $${jobPay}. There's risk, but the pay is fair. Interested?`
      offer.data = {
        jobType,
        pay: jobPay,
        isSetup: false,
        successRate: 0.6 + Math.random() * 0.3
      }
    }

    offer.choices = [
      { label: 'Take the Job', action: 'accept' },
      { label: 'Pass', action: 'decline' }
    ]
  }

  /**
   * Populate gift offer
   */
  populateGift(offer, ai, personality, isDeceptive) {
    const giftAmount = Math.floor(Math.random() * 1000) + 200

    offer.title = 'A Gift'

    if (isDeceptive) {
      offer.deceptionType = DECEPTION_TYPES.DEBT_TRAP
      offer.message = `Consider this a gift - $${giftAmount}, no strings attached. I like to help out promising players.`
      offer.data = {
        amount: giftAmount,
        hasStrings: true,
        futureDebt: giftAmount * 3 // They'll want 3x back later
      }
    } else {
      offer.message = `Here's $${giftAmount}. Call it an investment in goodwill. No catch.`
      offer.data = {
        amount: giftAmount,
        hasStrings: false
      }
    }

    offer.choices = [
      { label: 'Accept Gift', action: 'accept' },
      { label: 'Decline', action: 'decline' }
    ]
  }

  /**
   * Populate generic offer
   */
  populateGenericOffer(offer, ai, personality) {
    offer.title = 'Message'
    offer.message = `Just checking in. Let me know if you need anything.`
    offer.choices = [
      { label: 'Thanks', action: 'accept' },
      { label: 'OK', action: 'decline' }
    ]
  }

  /**
   * Handle player response to an offer
   */
  handleResponse(messageId, action, playerData = {}) {
    const message = this.activeMessages.find(m => m.id === messageId)
    if (!message) return null

    message.responded = true
    message.response = action
    message.respondedAt = Date.now()

    const ai = aiPlayerManager.getById(message.fromAI)
    const result = {
      success: false,
      cashChange: 0,
      respectChange: 0,
      trustChange: 0,
      message: ''
    }

    if (action === 'accept') {
      result = this.processAccept(message, ai, playerData)
    } else if (action === 'decline') {
      result = this.processDecline(message, ai)
    } else if (action === 'counter') {
      result = this.processCounter(message, ai, playerData)
    }

    // Update trust based on outcome
    if (result.trustChange !== 0) {
      aiPlayerManager.adjustPlayerTrust(message.fromAI, result.trustChange)
    }

    // Record deal outcome
    if (action === 'accept') {
      aiPlayerManager.recordDeal(message.fromAI, !message.isDeceptive)
    }

    // Move to history
    this.messageHistory.push(message)
    this.activeMessages = this.activeMessages.filter(m => m.id !== messageId)

    this.save()
    this.emit('messageResponded', { message, action, result })

    return result
  }

  /**
   * Process accept action
   */
  processAccept(message, ai, playerData) {
    const result = {
      success: true,
      cashChange: 0,
      respectChange: 0,
      trustChange: 0,
      message: ''
    }

    switch (message.type) {
      case OFFER_TYPES.TRADE_DEAL:
        if (message.isDeceptive) {
          // Player paid inflated price
          result.cashChange = -message.data.totalPrice
          result.trustChange = -15
          result.message = 'Deal complete. (You paid above market price)'
        } else {
          result.cashChange = -message.data.totalPrice
          result.trustChange = 5
          result.message = 'Fair deal. Goods acquired.'
        }
        break

      case OFFER_TYPES.INVESTMENT:
        if (message.data.isScam) {
          result.cashChange = -message.data.amount
          result.trustChange = -25
          result.message = 'Investment made... but something feels off.'
        } else {
          result.cashChange = -message.data.amount
          result.trustChange = 5
          result.message = 'Investment made. Time will tell if it pays off.'
        }
        break

      case OFFER_TYPES.GIFT:
        result.cashChange = message.data.amount
        if (message.data.hasStrings) {
          result.trustChange = -5 // Slight suspicion
          result.message = 'Gift accepted. They might want something later...'
        } else {
          result.trustChange = 10
          result.message = 'Gift accepted gratefully.'
        }
        break

      case OFFER_TYPES.PROTECTION:
        result.cashChange = -message.data.cost
        result.trustChange = message.data.isExtortion ? -10 : 5
        result.message = 'Protection payment made.'
        break

      case OFFER_TYPES.ALLIANCE:
        if (message.data.willBetray) {
          result.trustChange = 5 // They seem trustworthy... for now
          result.message = 'Alliance formed. Let\'s hope it lasts.'
        } else {
          result.trustChange = 15
          result.respectChange = 10
          result.message = 'Alliance formed!'
        }
        aiPlayerManager.updatePlayerRelationship(message.fromAI, 'allied')
        break

      case OFFER_TYPES.HOT_TIP:
      case OFFER_TYPES.WARNING:
        if (message.isDeceptive) {
          result.trustChange = 0 // They won't know yet
          result.message = 'Information noted.'
        } else {
          result.trustChange = 5
          result.message = 'Thanks for the intel.'
        }
        break

      case OFFER_TYPES.JOB_OFFER:
        if (message.data.isSetup) {
          result.cashChange = 0 // No pay, got caught
          result.trustChange = -20
          result.message = 'You walked into a trap!'
        } else {
          result.cashChange = message.data.pay
          result.trustChange = 10
          result.respectChange = 5
          result.message = `Job complete. Earned $${message.data.pay}`
        }
        break
    }

    return result
  }

  /**
   * Process decline action
   */
  processDecline(message, ai) {
    const result = {
      success: true,
      cashChange: 0,
      respectChange: 0,
      trustChange: 0,
      message: 'Offer declined.'
    }

    // Some personalities react negatively to rejection
    if (ai.personality === PERSONALITY_TYPES.ENFORCER) {
      result.trustChange = -5
      result.message = 'Offer declined. They didn\'t seem happy about it.'
    } else if (ai.personality === PERSONALITY_TYPES.MENTOR) {
      result.trustChange = 2 // Mentor respects caution
      result.message = 'Offer declined. They seem to respect your caution.'
    }

    return result
  }

  /**
   * Process counter offer action
   */
  processCounter(message, ai, playerData) {
    // Counter offers have 50% chance of being accepted
    const accepted = Math.random() < 0.5

    if (accepted) {
      return {
        success: true,
        cashChange: Math.floor(message.data?.totalPrice * 0.8) || 0, // 20% discount
        respectChange: 5,
        trustChange: 5,
        message: 'Counter offer accepted!'
      }
    } else {
      return {
        success: false,
        cashChange: 0,
        respectChange: -2,
        trustChange: -2,
        message: 'Counter offer rejected. Deal\'s off.'
      }
    }
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId) {
    const message = this.activeMessages.find(m => m.id === messageId)
    if (message) {
      message.read = true
      this.save()
    }
  }

  /**
   * Get all active messages
   */
  getActiveMessages() {
    this.cleanupExpiredMessages()
    return this.activeMessages
  }

  /**
   * Get unread message count
   */
  getUnreadCount() {
    return this.activeMessages.filter(m => !m.read).length
  }

  /**
   * Get message history with an AI
   */
  getHistoryWith(aiId) {
    return this.messageHistory.filter(m => m.fromAI === aiId)
  }

  /**
   * Cleanup expired messages
   */
  cleanupExpiredMessages() {
    const now = Date.now()
    this.activeMessages = this.activeMessages.filter(m => m.expiresAt > now)
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      const data = {
        activeMessages: this.activeMessages,
        messageHistory: this.messageHistory.slice(-100) // Keep last 100
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[AIMessageManager] Failed to save:', e)
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.activeMessages = parsed.activeMessages || []
        this.messageHistory = parsed.messageHistory || []
      }
    } catch (e) {
      console.error('[AIMessageManager] Failed to load:', e)
    }
  }

  /**
   * Reset all messages (for testing)
   */
  reset() {
    this.activeMessages = []
    this.messageHistory = []
    localStorage.removeItem(STORAGE_KEY)
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (e) {
          console.error(`[AIMessageManager] Error in ${event} listener:`, e)
        }
      })
    }
  }
}

// Singleton instance
export const aiMessageManager = new AIMessageManagerClass()
export default aiMessageManager
