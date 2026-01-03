/**
 * ResponseComposer - Phase 7: Dynamic Response Composition
 *
 * Creates natural responses from composable segments instead of static templates.
 * Segments: opener, core info, tip, signoff
 * Selection based on: player state, urgency, session length, familiarity
 */

import { sessionContext } from './SessionContext'
import { sarahPersonality } from './SarahPersonality'
import { gameManager } from '../GameManager'

// Response segment pools
const SEGMENTS = {
  // Openers - how to start the response
  openers: {
    neutral: [
      "",
      "Here's the deal: ",
      "OK, ",
      "Right, ",
      "So, ",
    ],
    urgent: [
      "Listen up: ",
      "Important: ",
      "Heads up - ",
      "Quick: ",
      "Alert: ",
    ],
    friendly: [
      "Hey, ",
      "Yo, ",
      "Look, ",
      "Check it - ",
      "Here's what I got: ",
    ],
    formal: [
      "According to my analysis, ",
      "Based on available data, ",
      "Assessment complete: ",
      "Analysis indicates: ",
      "",
    ],
  },

  // Transitions between sections
  transitions: {
    addInfo: [
      "\n\nAlso worth noting: ",
      "\n\nAdditionally: ",
      "\n\nOn top of that: ",
      "\n\nAnd here's the thing: ",
      "\n\nPlus: ",
    ],
    contrast: [
      "\n\nBut here's the catch: ",
      "\n\nHowever, ",
      "\n\nThat said, ",
      "\n\nOn the flip side: ",
      "\n\nThe downside: ",
    ],
    emphasis: [
      "\n\nKey point: ",
      "\n\nMost important: ",
      "\n\nBottom line: ",
      "\n\nWhat matters: ",
      "\n\nCritical: ",
    ],
  },

  // Tips - contextual advice at the end
  tips: {
    crime: [
      "\n\nPro tip: Crimes at your level give best XP/reward ratio.",
      "\n\nRemember: Bank your cash to protect it from arrests.",
      "\n\nTip: Watch your heat - it makes everything harder.",
      "\n\nSide note: Equipment upgrades multiply your success rate.",
    ],
    heat: [
      "\n\nQuick tip: Jobs don't add heat and still pay decent.",
      "\n\nPro tip: Police Scanner reduces arrest chance significantly.",
      "\n\nRemember: Heat decays at about 1 point per minute.",
      "\n\nTip: Bribing cops is expensive but fast.",
    ],
    money: [
      "\n\nMoney tip: Properties generate passive income even when offline.",
      "\n\nPro tip: Higher risk = higher reward, but also higher heat.",
      "\n\nRemember: Trading between districts can be very profitable.",
      "\n\nTip: Don't keep too much cash on hand - banks are safer.",
    ],
    general: [
      "\n\nNeed more help? Try 'ask help' for my full capabilities.",
      "\n\nLet me know if you need anything else.",
      "\n\nHit me up if you have more questions.",
      "",
    ],
    none: ["", "", "", ""],
  },

  // Sign-offs
  signoffs: {
    casual: [
      "",
      " Good luck out there.",
      " Stay sharp.",
      " Watch your back.",
      " Make it count.",
    ],
    encouraging: [
      " You got this.",
      " Go get 'em.",
      " Make some moves.",
      " Time to hustle.",
      "",
    ],
    warning: [
      " Be careful.",
      " Don't get caught.",
      " Stay low.",
      " Eyes open.",
      " Keep your head down.",
    ],
    formal: [
      "",
      " End of analysis.",
      " Report complete.",
      "",
      "",
    ],
  },
}

// Urgency thresholds
const URGENCY = {
  CRITICAL: 'critical',  // Player in danger
  HIGH: 'high',          // Important info
  NORMAL: 'normal',      // Standard response
  LOW: 'low',            // Background info
}

class ResponseComposerClass {
  /**
   * Compose a dynamic response from segments
   *
   * @param {string} coreContent - The main response content
   * @param {object} options - Composition options
   * @returns {string} Composed response
   */
  compose(coreContent, options = {}) {
    const {
      topic = 'general',
      urgency = URGENCY.NORMAL,
      includeOpener = true,
      includeTip = true,
      includeSignoff = true,
      transitions = [],
      additionalContent = [],
    } = options

    // Get player and session context
    const player = gameManager.player || {}
    const modifiers = sessionContext.getResponseModifiers()
    const tone = this.determineTone(player, modifiers, urgency)

    // Build response parts
    const parts = []

    // 1. Opener
    if (includeOpener) {
      const opener = this.selectOpener(tone, urgency, modifiers)
      if (opener) parts.push(opener)
    }

    // 2. Core content
    parts.push(coreContent)

    // 3. Additional content with transitions
    if (additionalContent.length > 0) {
      additionalContent.forEach((content, index) => {
        const transitionType = transitions[index] || 'addInfo'
        const transition = this.selectTransition(transitionType)
        parts.push(transition + content)
      })
    }

    // 4. Contextual tip
    if (includeTip && this.shouldIncludeTip(modifiers)) {
      const tip = this.selectTip(topic, player)
      if (tip) parts.push(tip)
    }

    // 5. Sign-off
    if (includeSignoff && this.shouldIncludeSignoff(modifiers)) {
      const signoff = this.selectSignoff(tone, urgency, player)
      if (signoff) parts.push(signoff)
    }

    return parts.join('')
  }

  /**
   * Determine the appropriate tone based on context
   */
  determineTone(player, modifiers, urgency) {
    const { familiarity, interactionCount } = modifiers

    // Urgency overrides familiarity
    if (urgency === URGENCY.CRITICAL) {
      return 'urgent'
    }

    // Familiarity-based tone
    if (familiarity === 'new') {
      return 'formal'
    } else if (familiarity === 'veteran' || interactionCount > 30) {
      return 'friendly'
    } else if (familiarity === 'regular') {
      return 'casual'
    }

    return 'neutral'
  }

  /**
   * Select appropriate opener
   */
  selectOpener(tone, urgency, modifiers) {
    // Skip opener for veteran users sometimes
    if (modifiers.familiarity === 'veteran' && Math.random() < 0.5) {
      return ''
    }

    const pool = urgency === URGENCY.CRITICAL || urgency === URGENCY.HIGH
      ? SEGMENTS.openers.urgent
      : SEGMENTS.openers[tone] || SEGMENTS.openers.neutral

    return sarahPersonality.pickRandom(pool)
  }

  /**
   * Select transition phrase
   */
  selectTransition(type) {
    const pool = SEGMENTS.transitions[type] || SEGMENTS.transitions.addInfo
    return sarahPersonality.pickRandom(pool)
  }

  /**
   * Select contextual tip based on topic and player state
   */
  selectTip(topic, player) {
    // Determine which tip pool to use
    let pool = SEGMENTS.tips.general

    if (topic === 'crime' || topic === 'crimes') {
      pool = SEGMENTS.tips.crime
    } else if (topic === 'heat' || topic === 'police' || topic === 'wanted') {
      pool = SEGMENTS.tips.heat
    } else if (topic === 'money' || topic === 'cash' || topic === 'investment') {
      pool = SEGMENTS.tips.money
    }

    // Player state can override topic
    if ((player.heat || 0) >= 60) {
      pool = SEGMENTS.tips.heat
    } else if ((player.cash || 0) > 10000 && (player.bank || 0) < (player.cash || 0) / 2) {
      pool = SEGMENTS.tips.money
    }

    return sarahPersonality.pickRandom(pool)
  }

  /**
   * Select sign-off based on tone and player state
   */
  selectSignoff(tone, urgency, player) {
    let pool = SEGMENTS.signoffs.casual

    if (urgency === URGENCY.CRITICAL || (player.heat || 0) >= 70) {
      pool = SEGMENTS.signoffs.warning
    } else if (tone === 'formal') {
      pool = SEGMENTS.signoffs.formal
    } else if (tone === 'friendly') {
      pool = SEGMENTS.signoffs.encouraging
    }

    return sarahPersonality.pickRandom(pool)
  }

  /**
   * Determine if we should include a tip
   */
  shouldIncludeTip(modifiers) {
    // Veterans don't need tips every time
    if (modifiers.familiarity === 'veteran') {
      return Math.random() < 0.2  // 20% chance
    }
    if (modifiers.familiarity === 'regular') {
      return Math.random() < 0.5  // 50% chance
    }
    // New and familiar users get tips more often
    return Math.random() < 0.7  // 70% chance
  }

  /**
   * Determine if we should include a sign-off
   */
  shouldIncludeSignoff(modifiers) {
    // Veterans get shorter responses
    if (modifiers.familiarity === 'veteran') {
      return Math.random() < 0.3
    }
    return Math.random() < 0.6
  }

  /**
   * Build a multi-part response with structured sections
   *
   * @param {object} sections - Named content sections
   * @returns {string} Composed response
   */
  buildStructured(sections) {
    const {
      main,           // Main content (required)
      details,        // Additional details
      warning,        // Warning message
      action,         // Suggested action
      options,        // List of options
    } = sections

    const parts = []

    // Main content
    if (main) parts.push(main)

    // Details with appropriate transition
    if (details) {
      parts.push(this.selectTransition('addInfo') + details)
    }

    // Warning with emphasis
    if (warning) {
      parts.push(this.selectTransition('emphasis') + warning)
    }

    // Options formatted as list
    if (options && options.length > 0) {
      const optionsList = options.map(o => `• ${o}`).join('\n')
      parts.push('\n\nOptions:\n' + optionsList)
    }

    // Action suggestion
    if (action) {
      parts.push('\n\n→ ' + action)
    }

    return parts.join('')
  }

  /**
   * Create a quick response (no frills, for repeated questions)
   */
  quick(content) {
    return content
  }

  /**
   * Create an urgent response
   */
  urgent(content, warning = null) {
    return this.compose(content, {
      urgency: URGENCY.CRITICAL,
      includeTip: false,
      additionalContent: warning ? [warning] : [],
      transitions: ['emphasis'],
    })
  }

  /**
   * Create a detailed response (for new users)
   */
  detailed(content, tip = null, action = null) {
    const parts = [content]
    if (tip) parts.push('\n\nTip: ' + tip)
    if (action) parts.push('\n\n→ ' + action)
    return this.compose(parts.join(''), {
      includeTip: false,  // We already added a custom tip
      includeSignoff: true,
    })
  }

  /**
   * Get urgency level based on player state
   */
  assessUrgency(player) {
    const heat = player.heat || 0
    const health = player.health || 100
    const energy = player.energy || 0

    if (health < 20 || heat >= 90) {
      return URGENCY.CRITICAL
    }
    if (heat >= 70 || health < 40 || energy < 10) {
      return URGENCY.HIGH
    }
    if (heat >= 40 || energy < 30) {
      return URGENCY.NORMAL
    }
    return URGENCY.LOW
  }
}

// Export singleton and constants
export const responseComposer = new ResponseComposerClass()
export { URGENCY }
export default responseComposer
