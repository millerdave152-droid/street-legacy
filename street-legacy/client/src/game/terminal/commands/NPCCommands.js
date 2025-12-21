/**
 * NPCCommands - Commands for interacting with NPC offers
 *
 * Handles accept/decline for terminal NPC opportunities
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { terminalNPCManager } from '../../managers/TerminalNPCManager'

/**
 * Register NPC-related commands
 */
export function registerNPCCommands() {
  // Accept command
  commandRegistry.register({
    name: 'accept',
    aliases: ['yes', 'ok', 'y', 'take', 'deal'],
    handler: async ({ terminal }) => {
      if (!terminalNPCManager.hasPendingOpportunity()) {
        return {
          error: true,
          message: "No pending offer to accept. Wait for an opportunity to come in."
        }
      }

      const result = terminalNPCManager.handleAccept()
      return result
    },
    help: 'Accept a pending NPC offer',
    usage: 'accept',
    category: CATEGORIES.SOCIAL,
  })

  // Decline command
  commandRegistry.register({
    name: 'decline',
    aliases: ['no', 'n', 'pass', 'nah', 'reject'],
    handler: async ({ terminal }) => {
      if (!terminalNPCManager.hasPendingOpportunity()) {
        return {
          error: true,
          message: "No pending offer to decline."
        }
      }

      const result = terminalNPCManager.handleDecline()
      return result
    },
    help: 'Decline a pending NPC offer',
    usage: 'decline',
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
