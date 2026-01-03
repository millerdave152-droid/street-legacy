/**
 * ContactCommands - Commands for managing NPC contacts
 *
 * Commands:
 * - msg <npc>: Message a specific NPC
 * - contacts: List all known contacts with trust levels
 * - block <npc>: Block an NPC from messaging you
 * - unblock <npc>: Unblock an NPC
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { terminalNPCManager } from '../../managers/TerminalNPCManager'
import { gameManager } from '../../GameManager'
import { NPC_CONTACTS, getContactByName, getContactById } from '../../data/NPCContacts'
import { progressionManager, PROGRESSION_TIERS } from '../../managers/ProgressionManager'

/**
 * Get trust level display string
 */
function getTrustDisplay(trustLevel) {
  if (trustLevel >= 80) return { text: 'LOYAL', color: 'success' }
  if (trustLevel >= 50) return { text: 'TRUSTED', color: 'success' }
  if (trustLevel >= 20) return { text: 'FRIENDLY', color: 'handler' }
  if (trustLevel >= 0) return { text: 'NEUTRAL', color: 'response' }
  if (trustLevel >= -20) return { text: 'WARY', color: 'warning' }
  if (trustLevel >= -50) return { text: 'DISTRUSTED', color: 'error' }
  return { text: 'HOSTILE', color: 'error' }
}

/**
 * Get status indicators for a contact
 */
function getStatusIndicators(contact, player) {
  const indicators = []

  // Level locked
  if (contact.minLevel && (player?.level || 1) < contact.minLevel) {
    indicators.push(`[Lv${contact.minLevel}+]`)
  }

  // Blocked
  if (terminalNPCManager.isContactBlocked(contact.id)) {
    indicators.push('[BLOCKED]')
  }

  // High risk
  if (contact.riskLevel === 'high' || contact.riskLevel === 'very_high') {
    indicators.push('[RISKY]')
  }

  // Crew member
  if (contact.role === 'CREW' || contact.role === 'MASTERMIND') {
    indicators.push('[CREW]')
  }

  return indicators.join(' ')
}

/**
 * Register contact management commands
 */
export function registerContactCommands() {
  // ============================================================
  // MSG Command - Message a specific NPC
  // ============================================================
  commandRegistry.register({
    name: 'msg',
    aliases: ['message', 'dm', 'whisper'],
    handler: async ({ args, terminal }) => {
      if (args.length === 0) {
        return {
          error: true,
          message: "Usage: msg <contact_name>\nType 'contacts' to see available contacts."
        }
      }

      const contactName = args.join(' ').toLowerCase()
      const contact = getContactByName(contactName) || getContactById(contactName)

      if (!contact) {
        return {
          error: true,
          message: `Unknown contact: "${args.join(' ')}"\nType 'contacts' to see available contacts.`
        }
      }

      const player = gameManager.player
      const playerLevel = player?.level || 1

      // Check level requirement
      if (contact.minLevel && playerLevel < contact.minLevel) {
        return {
          error: true,
          message: `${contact.name} requires Level ${contact.minLevel}+ to contact. You are Level ${playerLevel}.`
        }
      }

      // Check if blocked
      if (terminalNPCManager.isContactBlocked(contact.id)) {
        return {
          error: true,
          message: `${contact.name} is blocked. Use 'unblock ${contact.name}' to unblock.`
        }
      }

      // Send a message from this NPC (if they have pending messages)
      // For now, just acknowledge the contact
      const output = [
        { text: ``, type: 'system' },
        { text: `:: CONTACTING ${contact.name.toUpperCase()} ::`, type: 'system' },
        { text: `${contact.displayPrefix} ${contact.description}`, type: 'handler' },
        { text: ``, type: 'system' },
      ]

      // Check if they have any pending messages
      const canMessage = terminalNPCManager.canNPCSendMessage(contact, player)
      if (canMessage) {
        // Trigger a message from this NPC
        const messageType = contact.preferredMessageTypes?.[0] || 'TIP'
        terminalNPCManager.sendNamedNPCMessage(contact.id, messageType)
      } else {
        output.push({
          text: `${contact.name} has no new messages for you right now.`,
          type: 'response'
        })
      }

      return { output }
    },
    help: 'Message a specific NPC contact',
    usage: 'msg <contact_name>',
    examples: ['msg snoop', 'msg the connect', 'msg scarlett'],
    category: CATEGORIES.SOCIAL,
  })

  // ============================================================
  // CONTACTS Command - List all known contacts
  // ============================================================
  commandRegistry.register({
    name: 'contacts',
    aliases: ['people', 'network', 'who'],
    handler: async ({ terminal }) => {
      const player = gameManager.player
      const playerLevel = player?.level || 1
      const contactsWithStatus = terminalNPCManager.getAllContactsWithStatus(player)
      const currentTier = progressionManager.getCurrentTier()

      const output = [
        { text: ``, type: 'system' },
        { text: `:: CONTACT NETWORK ::`, type: 'system' },
        { text: `Level ${playerLevel} | Tier: ${currentTier.name}`, type: 'handler' },
        { text: ``, type: 'system' },
      ]

      // Separate unlocked and locked contacts
      const available = contactsWithStatus.filter(c => c.isUnlocked)
      const locked = contactsWithStatus.filter(c => !c.isUnlocked)

      // Show available contacts by archetype
      if (available.length > 0) {
        output.push({ text: `[AVAILABLE CONTACTS]`, type: 'success' })

        // Group by archetype
        const groups = {
          informant: [],
          dealer: [],
          crew: []
        }

        available.forEach(contact => {
          const group = groups[contact.archetype] || groups.informant
          group.push(contact)
        })

        for (const [archetype, contacts] of Object.entries(groups)) {
          contacts.forEach(contact => {
            const trust = getTrustDisplay(contact.baseTrust || 0)
            let statusBadges = []

            if (contact.isBlocked) statusBadges.push('[BLOCKED]')
            if (contact.isSilent) statusBadges.push('[SILENT]')
            if (contact.riskLevel === 'high' || contact.riskLevel === 'very_high') statusBadges.push('[RISKY]')

            let line = `  ${contact.name} (${contact.role})`
            if (statusBadges.length > 0) line += ' ' + statusBadges.join(' ')

            if (contact.isBlocked) {
              output.push({ text: line, type: 'error' })
            } else if (contact.isSilent) {
              output.push({ text: line + ' - Heat too high', type: 'warning' })
            } else {
              output.push({ text: line, type: trust.color })
            }
          })
        }

        output.push({ text: ``, type: 'system' })
      }

      // Show locked contacts grouped by tier
      if (locked.length > 0) {
        output.push({ text: `[LOCKED - Higher level required]`, type: 'response' })

        // Sort by minLevel
        locked.sort((a, b) => (a.minLevel || 99) - (b.minLevel || 99))

        locked.forEach(contact => {
          const tierName = getTierForLevel(contact.minLevel || 1)
          output.push({
            text: `  ${contact.name} (${contact.role}) - Lv${contact.minLevel} [${tierName}]`,
            type: 'response'
          })
        })

        output.push({ text: ``, type: 'system' })
      }

      // Show progression info
      const nextTier = progressionManager.getNextTier()
      if (nextTier) {
        output.push({
          text: `Next tier: ${nextTier.name} at Level ${nextTier.minLevel}`,
          type: 'system'
        })
      }

      output.push({ text: ``, type: 'system' })
      output.push({ text: `Commands: msg <name> | block <name> | unblock`, type: 'system' })

      return { output }
    },
    help: 'List all known NPC contacts and their status',
    usage: 'contacts',
    category: CATEGORIES.SOCIAL,
  })

  /**
   * Helper to get tier name for a level
   */
  function getTierForLevel(level) {
    for (const [key, tier] of Object.entries(PROGRESSION_TIERS)) {
      if (level >= tier.minLevel && level <= tier.maxLevel) {
        return tier.name
      }
    }
    return 'Elite'
  }

  // ============================================================
  // BLOCK Command - Block an NPC
  // ============================================================
  commandRegistry.register({
    name: 'block',
    aliases: ['mute', 'ignore'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        return {
          error: true,
          message: "Usage: block <contact_name>\nBlocks the NPC from sending you messages."
        }
      }

      const contactName = args.join(' ')
      const result = terminalNPCManager.blockContact(contactName)

      if (!result.success) {
        return { error: true, message: result.error }
      }

      return {
        output: [
          { text: ``, type: 'system' },
          { text: result.message, type: 'success' }
        ]
      }
    },
    help: 'Block an NPC from messaging you',
    usage: 'block <contact_name>',
    examples: ['block ironman', 'block rat'],
    category: CATEGORIES.SOCIAL,
  })

  // ============================================================
  // UNBLOCK Command - Unblock an NPC
  // ============================================================
  commandRegistry.register({
    name: 'unblock',
    aliases: ['unmute'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        // Show blocked contacts
        const blocked = terminalNPCManager.getBlockedContacts()
        if (blocked.length === 0) {
          return {
            output: [
              { text: `You have no blocked contacts.`, type: 'response' }
            ]
          }
        }

        const output = [
          { text: ``, type: 'system' },
          { text: `:: BLOCKED CONTACTS ::`, type: 'system' },
        ]

        blocked.forEach(contact => {
          output.push({ text: `  ${contact.name} (${contact.role})`, type: 'error' })
        })

        output.push({ text: ``, type: 'system' })
        output.push({ text: `Use 'unblock <name>' to unblock.`, type: 'system' })

        return { output }
      }

      const contactName = args.join(' ')
      const result = terminalNPCManager.unblockContact(contactName)

      if (!result.success) {
        return { error: true, message: result.error }
      }

      return {
        output: [
          { text: ``, type: 'system' },
          { text: result.message, type: 'success' }
        ]
      }
    },
    help: 'Unblock an NPC so they can message you again',
    usage: 'unblock [contact_name]',
    examples: ['unblock', 'unblock ironman'],
    category: CATEGORIES.SOCIAL,
  })

  console.log('[ContactCommands] Registered contact commands')
}

export default registerContactCommands
