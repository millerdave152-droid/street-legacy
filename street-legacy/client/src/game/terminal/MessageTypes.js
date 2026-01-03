/**
 * MessageTypes.js - Console Message Type Definitions
 *
 * Defines the 6 types of messages NPCs can send through the terminal:
 * - INTEL: Informant tips, schedules, intel
 * - DEALS: Buy/sell opportunities
 * - JOBS: Crew missions, heists
 * - SCAMS: Traps that lose money
 * - WARNINGS: Danger alerts, heat warnings
 * - BETRAYALS: Snitch events, urgent escapes
 */

// Message urgency levels
export const URGENCY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical'
}

// Urgency colors (hex values for Phaser)
export const URGENCY_COLORS = {
  [URGENCY.LOW]: 0x22c55e,      // Green
  [URGENCY.NORMAL]: 0xfbbf24,   // Amber
  [URGENCY.HIGH]: 0xf97316,     // Orange
  [URGENCY.CRITICAL]: 0xef4444  // Red
}

// Message type definitions
export const MESSAGE_TYPES = {
  /**
   * INTEL - Informant messages with tips, schedules, opportunities
   * Response: respond (view details) | save (bookmark) | ignore (dismiss)
   */
  INTEL: {
    id: 'INTEL',
    name: 'Intel',
    description: 'Tips, schedules, and opportunity intel from informants',
    color: 0x06b6d4, // Cyan
    urgencyDefault: URGENCY.NORMAL,

    // Response options
    responseOptions: [
      { id: 'respond', label: 'View Details', command: 'respond' },
      { id: 'save', label: 'Save for Later', command: 'save' },
      { id: 'ignore', label: 'Dismiss', command: 'ignore' }
    ],

    // Expiry range in milliseconds
    expiryRange: {
      min: 10 * 60 * 1000,  // 10 minutes
      max: 30 * 60 * 1000   // 30 minutes
    },

    // Display settings
    prefix: '::INTEL::',
    icon: '[i]'
  },

  /**
   * DEALS - Buy/sell opportunities from dealers
   * Response: accept (buy) | negotiate (counter-offer) | decline (pass)
   */
  DEALS: {
    id: 'DEALS',
    name: 'Deal',
    description: 'Trade opportunities and bulk purchase offers',
    color: 0x22c55e, // Green
    urgencyDefault: URGENCY.NORMAL,

    responseOptions: [
      { id: 'accept', label: 'Accept Deal', command: 'accept' },
      { id: 'negotiate', label: 'Negotiate', command: 'negotiate' },
      { id: 'decline', label: 'Decline', command: 'decline' }
    ],

    expiryRange: {
      min: 5 * 60 * 1000,   // 5 minutes
      max: 15 * 60 * 1000   // 15 minutes
    },

    prefix: '::DEAL::',
    icon: '[$]'
  },

  /**
   * JOBS - Crew missions and heist invites
   * Response: accept (join) | counter (negotiate cut) | decline (pass)
   */
  JOBS: {
    id: 'JOBS',
    name: 'Job',
    description: 'Crew missions, heist invites, and job offers',
    color: 0xfbbf24, // Amber
    urgencyDefault: URGENCY.HIGH,

    responseOptions: [
      { id: 'accept', label: 'Accept Job', command: 'accept' },
      { id: 'counter', label: 'Counter Offer', command: 'counter' },
      { id: 'decline', label: 'Decline', command: 'decline' }
    ],

    expiryRange: {
      min: 10 * 60 * 1000,  // 10 minutes
      max: 30 * 60 * 1000   // 30 minutes
    },

    prefix: '::JOB OFFER::',
    icon: '[!]'
  },

  /**
   * SCAMS - Trap messages that lose money (from hustlers or undercover cops)
   * Response: accept (fall for it) | ask_questions (detect trap) | block (block sender)
   */
  SCAMS: {
    id: 'SCAMS',
    name: 'Opportunity', // Displayed as "opportunity" to hide scam nature
    description: 'Suspicious offers that may be scams',
    color: 0xef4444, // Red (but displayed as green to look legit)
    displayColor: 0x22c55e, // Appears green to player
    urgencyDefault: URGENCY.NORMAL,

    responseOptions: [
      { id: 'accept', label: 'Accept', command: 'accept', warning: true },
      { id: 'ask_questions', label: 'Ask Questions', command: 'ask' },
      { id: 'block', label: 'Block Sender', command: 'block' }
    ],

    expiryRange: {
      min: 5 * 60 * 1000,   // 5 minutes - short window to pressure
      max: 10 * 60 * 1000   // 10 minutes
    },

    prefix: '::OPPORTUNITY::',
    icon: '[$]', // Looks like a deal

    // Scam detection hints
    detectionHints: [
      'Uses phrases like "guaranteed" or "no risk"',
      'Offers significantly above market value',
      'Pushes for immediate decision',
      'Sender is unknown or new contact',
      'Too good to be true'
    ]
  },

  /**
   * WARNINGS - Danger alerts, heat warnings, cop activity
   * Response: pay_lawyer | lay_low | ignore
   */
  WARNINGS: {
    id: 'WARNINGS',
    name: 'Warning',
    description: 'Heat alerts, cop activity, and danger warnings',
    color: 0xf97316, // Orange
    urgencyDefault: URGENCY.HIGH,

    responseOptions: [
      { id: 'pay_lawyer', label: 'Pay Lawyer', command: 'lawyer', cost: true },
      { id: 'lay_low', label: 'Lay Low', command: 'laylow' },
      { id: 'ignore', label: 'Ignore (Risky)', command: 'ignore' }
    ],

    expiryRange: {
      min: 5 * 60 * 1000,   // 5 minutes
      max: 10 * 60 * 1000   // 10 minutes
    },

    prefix: ':: WARNING ::',
    icon: '[!]'
  },

  /**
   * BETRAYALS - Snitch events, urgent escape scenarios
   * Response: hide_stash | flee | retaliate
   */
  BETRAYALS: {
    id: 'BETRAYALS',
    name: 'URGENT',
    description: 'Betrayal events requiring immediate response',
    color: 0xef4444, // Red
    urgencyDefault: URGENCY.CRITICAL,

    responseOptions: [
      { id: 'hide_stash', label: 'Bank Cash NOW', command: 'bank', urgent: true },
      { id: 'flee', label: 'Flee ($500)', command: 'flee', cost: 500 },
      { id: 'retaliate', label: 'Hunt Them Down', command: 'retaliate' }
    ],

    expiryRange: {
      min: 1 * 60 * 1000,   // 1 minute - very urgent!
      max: 3 * 60 * 1000    // 3 minutes
    },

    prefix: ':: URGENT ::',
    icon: '[!!!]'
  }
}

/**
 * Get message type by ID
 */
export function getMessageType(typeId) {
  return MESSAGE_TYPES[typeId] || MESSAGE_TYPES.INTEL
}

/**
 * Get random expiry time for a message type
 */
export function getRandomExpiry(typeId) {
  const type = MESSAGE_TYPES[typeId]
  if (!type) return 10 * 60 * 1000 // Default 10 minutes

  const { min, max } = type.expiryRange
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Get urgency color for display
 */
export function getUrgencyColor(urgency) {
  return URGENCY_COLORS[urgency] || URGENCY_COLORS[URGENCY.NORMAL]
}

/**
 * Get display color for message type (handles scams showing as deals)
 */
export function getMessageTypeColor(typeId) {
  const type = MESSAGE_TYPES[typeId]
  if (!type) return 0x06b6d4

  // Scams display as green to look legitimate
  return type.displayColor || type.color
}

/**
 * Check if a message type requires immediate response
 */
export function isUrgentMessageType(typeId) {
  const type = MESSAGE_TYPES[typeId]
  return type?.urgencyDefault === URGENCY.CRITICAL
}

/**
 * Get response options for a message type
 */
export function getResponseOptions(typeId) {
  const type = MESSAGE_TYPES[typeId]
  return type?.responseOptions || []
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(expiresAt) {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'EXPIRED'

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  if (minutes === 0) {
    return `${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}

/**
 * Check if message is about to expire (under 2 minutes)
 */
export function isAboutToExpire(expiresAt) {
  const remaining = expiresAt - Date.now()
  return remaining > 0 && remaining < 2 * 60 * 1000
}

/**
 * Get message type prefix for terminal display
 */
export function getMessagePrefix(typeId) {
  const type = MESSAGE_TYPES[typeId]
  return type?.prefix || ':: MESSAGE ::'
}

/**
 * Get all message types as array
 */
export function getAllMessageTypes() {
  return Object.values(MESSAGE_TYPES)
}

export default MESSAGE_TYPES
