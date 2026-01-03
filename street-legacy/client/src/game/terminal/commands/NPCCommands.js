/**
 * NPCCommands - Commands for interacting with NPC offers
 *
 * Handles accept/decline for terminal NPC opportunities
 * Now routes through unified OpportunityManager
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { terminalNPCManager } from '../../managers/TerminalNPCManager'
import { opportunityManager } from '../../opportunity/OpportunityManager'
import { NPC_CONTACTS } from '../../data/NPCContacts'

/**
 * Format remaining time with urgency indicators
 */
function formatTimeRemaining(expiresAt) {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return { text: 'EXPIRED', urgency: 'expired' }

  const seconds = Math.floor(remaining / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  let text, urgency

  if (hours > 0) {
    text = `${hours}h ${minutes % 60}m`
    urgency = 'normal'
  } else if (minutes > 5) {
    text = `${minutes}m`
    urgency = 'normal'
  } else if (minutes > 1) {
    text = `${minutes}m ${seconds % 60}s`
    urgency = 'warning'
  } else {
    text = `${seconds}s`
    urgency = 'critical'
  }

  return { text, urgency }
}

/**
 * Register NPC-related commands
 */
export function registerNPCCommands() {
  // Accept command - routes to OpportunityManager via TerminalNPCManager
  commandRegistry.register({
    name: 'accept',
    aliases: ['yes', 'ok', 'y', 'take', 'deal'],
    handler: async ({ terminal }) => {
      // handleAccept now checks OpportunityManager and returns proper errors
      const result = terminalNPCManager.handleAccept()
      if (result.error) {
        return { error: true, message: result.message }
      }
      return result
    },
    help: 'Accept a pending NPC offer (use "respond N yes" for multiple offers)',
    usage: 'accept',
    category: CATEGORIES.SOCIAL,
  })

  // Decline command - routes to OpportunityManager via TerminalNPCManager
  commandRegistry.register({
    name: 'decline',
    aliases: ['no', 'n', 'pass', 'nah', 'reject'],
    handler: async ({ terminal }) => {
      // handleDecline now checks OpportunityManager and returns proper errors
      const result = terminalNPCManager.handleDecline()
      if (result.error) {
        return { error: true, message: result.message }
      }
      return result
    },
    help: 'Decline a pending NPC offer (use "respond N no" for multiple offers)',
    usage: 'decline',
    category: CATEGORIES.SOCIAL,
  })

  // ============================================================
  // OPPORTUNITIES Command - List pending offers with timers
  // ============================================================
  commandRegistry.register({
    name: 'opportunities',
    aliases: ['offers', 'pending', 'opps'],
    handler: async () => {
      const opportunities = opportunityManager.getActiveOpportunities()

      const output = [
        { text: ``, type: 'system' },
        { text: `:: PENDING OPPORTUNITIES ::`, type: 'system' },
        { text: ``, type: 'system' }
      ]

      if (opportunities.length === 0) {
        output.push({ text: `No pending opportunities.`, type: 'response' })
        output.push({ text: `Wait for NPCs to contact you.`, type: 'system' })
        return { output }
      }

      opportunities.forEach((opp, index) => {
        const npc = opp.npcId ? NPC_CONTACTS[opp.npcId] : null
        const timer = formatTimeRemaining(opp.expiresAt)
        const reward = opp.rewards?.cash || 0
        const risk = opp.risks?.heat || 0

        // Determine color based on urgency
        let timerType = 'response'
        if (timer.urgency === 'warning') timerType = 'warning'
        if (timer.urgency === 'critical') timerType = 'error'
        if (timer.urgency === 'expired') timerType = 'error'

        // Show opportunity header
        output.push({
          text: `[${index + 1}] ${npc?.displayPrefix || '[UNKNOWN]'} ${opp.title}`,
          type: opp.type === 'NPC_JOB' ? 'npc_job' : 'npc_deal'
        })

        // Show message
        if (opp.shortMessage || opp.message) {
          output.push({
            text: `    "${opp.shortMessage || opp.message.substring(0, 60)}..."`,
            type: 'response'
          })
        }

        // Show rewards and risks
        output.push({
          text: `    Reward: $${reward.toLocaleString()} | Heat: +${risk}%`,
          type: reward > 5000 ? 'success' : 'response'
        })

        // Show timer with urgency indicator
        let timerPrefix = '   '
        if (timer.urgency === 'critical') timerPrefix = ' ! '
        if (timer.urgency === 'warning') timerPrefix = ' * '

        output.push({
          text: `${timerPrefix} Expires in: ${timer.text}`,
          type: timerType
        })

        output.push({ text: ``, type: 'system' })
      })

      // Show commands
      output.push({ text: `Commands:`, type: 'system' })
      output.push({ text: `  accept / decline - Respond to first offer`, type: 'handler' })
      output.push({ text: `  respond <#> yes/no - Respond to specific offer`, type: 'handler' })
      output.push({ text: `  negotiate <#> [amount] - Counter-offer`, type: 'handler' })

      return { output }
    },
    help: 'List all pending NPC opportunities with countdown timers',
    usage: 'opportunities',
    category: CATEGORIES.SOCIAL,
  })

  // ============================================================
  // RESPOND Command - Respond to specific opportunity
  // ============================================================
  commandRegistry.register({
    name: 'respond',
    aliases: ['reply', 'answer'],
    handler: async ({ args }) => {
      if (args.length < 2) {
        return {
          error: true,
          message: "Usage: respond <#> <yes/no>\nExample: respond 1 yes"
        }
      }

      const index = parseInt(args[0]) - 1
      const response = args[1].toLowerCase()
      const accept = ['yes', 'y', 'accept', 'deal', 'ok'].includes(response)
      const decline = ['no', 'n', 'decline', 'pass', 'reject'].includes(response)

      if (!accept && !decline) {
        return {
          error: true,
          message: "Response must be 'yes' or 'no'"
        }
      }

      const opportunities = opportunityManager.getActiveOpportunities()

      if (index < 0 || index >= opportunities.length) {
        return {
          error: true,
          message: `Invalid opportunity number. Use 'opportunities' to see list.`
        }
      }

      const opportunity = opportunities[index]

      if (accept) {
        const result = opportunityManager.acceptOpportunity(opportunity.id)
        return result
      } else {
        const result = opportunityManager.declineOpportunity(opportunity.id)
        return result
      }
    },
    help: 'Respond to a specific opportunity by number',
    usage: 'respond <#> <yes/no>',
    examples: ['respond 1 yes', 'respond 2 no'],
    category: CATEGORIES.SOCIAL,
  })

  // Force a message (debug/testing)
  commandRegistry.register({
    name: 'npctest',
    aliases: [],
    handler: async ({ args }) => {
      const type = args[0] || null
      terminalNPCManager.forceMessage(type)
      return {
        output: [{ text: ':: Forced NPC message delivery', type: 'system' }]
      }
    },
    help: 'Force an NPC message (debug)',
    usage: 'npctest [type]',
    category: CATEGORIES.SYSTEM,
    hidden: true, // Hide from help menu
  })

  console.log('[NPCCommands] Registered NPC commands')
}

export default registerNPCCommands
