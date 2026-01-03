/**
 * OpportunityCommands - Commands for managing opportunities, negotiations, and events
 *
 * Commands:
 * - negotiate <id> [amount]: Counter-offer on a deal
 * - events: View active world events
 * - arc [id]: View story arc status
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'
import { opportunityManager } from '../../opportunity/OpportunityManager'
import { dialogueTreeManager } from '../DialogueTreeManager'
import { worldEventSystem, WORLD_EVENT_TYPES } from '../../managers/WorldEventSystem'
import { storyArcManager } from '../../managers/StoryArcManager'
import { NPC_CONTACTS } from '../../data/NPCContacts'

/**
 * Register opportunity and event commands
 */
export function registerOpportunityCommands() {
  // ============================================================
  // NEGOTIATE Command - Counter-offer on deals
  // ============================================================
  commandRegistry.register({
    name: 'negotiate',
    aliases: ['counter', 'counteroffer', 'offer'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        // Show negotiable opportunities
        const opportunities = opportunityManager.getActiveOpportunities()
        const negotiable = opportunities.filter(opp =>
          opp.type === 'NPC_JOB' || opp.type === 'DEAL'
        )

        if (negotiable.length === 0) {
          return {
            output: [
              { text: `No active opportunities to negotiate.`, type: 'response' },
              { text: `Wait for NPCs to send offers.`, type: 'system' }
            ]
          }
        }

        const output = [
          { text: ``, type: 'system' },
          { text: `:: NEGOTIABLE OFFERS ::`, type: 'system' },
          { text: ``, type: 'system' }
        ]

        negotiable.forEach((opp, i) => {
          const npc = opp.npcId ? NPC_CONTACTS[opp.npcId] : null
          const reward = opp.rewards?.cash || 0

          output.push({
            text: `[${i + 1}] ${npc?.name || 'Unknown'}: ${opp.title}`,
            type: 'handler'
          })
          output.push({
            text: `    Current offer: $${reward.toLocaleString()}`,
            type: 'response'
          })
        })

        output.push({ text: ``, type: 'system' })
        output.push({ text: `Usage: negotiate <#> [amount]`, type: 'system' })
        output.push({ text: `Example: negotiate 1 5000`, type: 'system' })

        return { output }
      }

      // Parse opportunity ID
      const oppIndex = parseInt(args[0]) - 1
      const opportunities = opportunityManager.getActiveOpportunities()
        .filter(opp => opp.type === 'NPC_JOB' || opp.type === 'DEAL')

      if (isNaN(oppIndex) || oppIndex < 0 || oppIndex >= opportunities.length) {
        return { error: true, message: 'Invalid opportunity number.' }
      }

      const opportunity = opportunities[oppIndex]
      const npc = opportunity.npcId ? NPC_CONTACTS[opportunity.npcId] : null
      const currentOffer = opportunity.rewards?.cash || 0

      // Parse requested amount if provided
      let requestedAmount = null
      if (args.length > 1) {
        requestedAmount = parseInt(args[1].replace(/[$,]/g, ''))
        if (isNaN(requestedAmount)) {
          return { error: true, message: 'Invalid amount. Use a number.' }
        }
      }

      // Start negotiation dialogue
      if (npc) {
        const dialogueId = dialogueTreeManager.createNegotiation(
          opportunity.npcId,
          currentOffer,
          {
            title: opportunity.title,
            requestedAmount,
            item: opportunity.details?.item || 'goods',
            quantity: opportunity.details?.quantity || 1
          }
        )

        if (dialogueId) {
          return { success: true }
        }
      }

      // Fallback simple negotiation
      const output = [
        { text: ``, type: 'system' },
        { text: `:: NEGOTIATION ::`, type: 'system' },
        { text: `Current offer: $${currentOffer.toLocaleString()}`, type: 'handler' },
      ]

      if (requestedAmount) {
        const increase = requestedAmount - currentOffer
        const percentIncrease = Math.round((increase / currentOffer) * 100)

        if (percentIncrease > 30) {
          output.push({
            text: `${npc?.name || 'Contact'}: \"${percentIncrease}%? Are you crazy? No deal.\"`,
            type: 'error'
          })
        } else if (percentIncrease > 15) {
          const counterOffer = Math.floor(currentOffer * 1.1)
          output.push({
            text: `${npc?.name || 'Contact'}: \"Best I can do is $${counterOffer.toLocaleString()}.\"`,
            type: 'warning'
          })
          output.push({
            text: `Type 'accept ${oppIndex + 1}' to take this offer.`,
            type: 'system'
          })

          // Update opportunity
          opportunity.rewards.cash = counterOffer
          opportunity.negotiated = true
        } else {
          output.push({
            text: `${npc?.name || 'Contact'}: \"Fine. $${requestedAmount.toLocaleString()}. Don't push your luck.\"`,
            type: 'success'
          })

          // Update opportunity
          opportunity.rewards.cash = requestedAmount
          opportunity.negotiated = true
        }
      } else {
        output.push({
          text: `Specify amount: negotiate ${oppIndex + 1} <amount>`,
          type: 'system'
        })
      }

      return { output }
    },
    help: 'Counter-offer on a deal or job opportunity',
    usage: 'negotiate <opportunity#> [amount]',
    examples: ['negotiate', 'negotiate 1', 'negotiate 1 5000'],
    category: CATEGORIES.ACTION,
  })

  // ============================================================
  // EVENTS Command - View world events
  // ============================================================
  commandRegistry.register({
    name: 'events',
    aliases: ['worldevents', 'world', 'status'],
    handler: async () => {
      const summary = worldEventSystem.getEventSummary()

      const output = [
        { text: ``, type: 'system' },
        { text: `:: WORLD STATUS ::`, type: 'system' },
        { text: ``, type: 'system' }
      ]

      if (!summary.active) {
        output.push({
          text: `No active world events.`,
          type: 'response'
        })
        output.push({
          text: `The streets are quiet... for now.`,
          type: 'system'
        })
      } else {
        summary.events.forEach(event => {
          output.push({
            text: `${event.icon} ${event.name}`,
            type: 'warning'
          })
          output.push({
            text: `   ${event.description}`,
            type: 'response'
          })
          output.push({
            text: `   Time remaining: ${event.remainingMins} minutes`,
            type: 'system'
          })
          if (event.effects) {
            output.push({
              text: `   Effects: ${event.effects}`,
              type: 'handler'
            })
          }
          output.push({ text: ``, type: 'system' })
        })
      }

      // Show modifiers if any events active
      if (summary.active) {
        const mods = worldEventSystem.getActiveModifiers()
        output.push({ text: `[ACTIVE MODIFIERS]`, type: 'handler' })

        if (mods.successRateMod !== 0) {
          output.push({
            text: `  Success Rate: ${mods.successRateMod > 0 ? '+' : ''}${Math.round(mods.successRateMod * 100)}%`,
            type: mods.successRateMod > 0 ? 'success' : 'error'
          })
        }
        if (mods.heatGainMod !== 1) {
          output.push({
            text: `  Heat Gain: x${mods.heatGainMod}`,
            type: mods.heatGainMod < 1 ? 'success' : 'error'
          })
        }
        if (mods.sellPriceMod !== 1) {
          output.push({
            text: `  Sell Prices: x${mods.sellPriceMod}`,
            type: mods.sellPriceMod > 1 ? 'success' : 'response'
          })
        }
      }

      return { output }
    },
    help: 'View active world events and their effects',
    usage: 'events',
    category: CATEGORIES.INFO,
  })

  // ============================================================
  // ARC Command - View story arcs
  // ============================================================
  commandRegistry.register({
    name: 'arc',
    aliases: ['story', 'arcs', 'mission'],
    handler: async ({ args }) => {
      const output = [
        { text: ``, type: 'system' },
        { text: `:: STORY ARCS ::`, type: 'system' },
        { text: ``, type: 'system' }
      ]

      // If specific arc requested
      if (args.length > 0) {
        const arcId = args.join('_').toLowerCase()
        const status = storyArcManager.getArcStatus(arcId)

        if (status.status === 'unknown') {
          return { error: true, message: `Unknown story arc: "${args.join(' ')}"` }
        }

        const allArcs = storyArcManager.getAllArcs()
        const arc = allArcs.find(a => a.id === arcId)

        if (arc) {
          output.push({ text: `[${arc.name}]`, type: 'handler' })
          output.push({ text: arc.description, type: 'response' })
          output.push({ text: `Status: ${status.status.toUpperCase()}`, type: 'system' })

          if (status.status === 'active') {
            output.push({ text: `Phase: ${status.phaseTitle}`, type: 'warning' })
            if (Object.keys(status.progress).length > 0) {
              output.push({ text: `Progress: ${JSON.stringify(status.progress)}`, type: 'system' })
            }
          } else if (status.status === 'locked') {
            output.push({ text: `Requires: Level ${status.requiredLevel}`, type: 'error' })
          }
        }

        return { output }
      }

      // Show all arcs
      const allArcs = storyArcManager.getAllArcs()
      const active = allArcs.filter(a => a.status.status === 'active')
      const available = allArcs.filter(a => a.status.status === 'available')
      const locked = allArcs.filter(a => a.status.status === 'locked')
      const completed = allArcs.filter(a => a.status.status === 'completed')

      if (active.length > 0) {
        output.push({ text: `[ACTIVE]`, type: 'success' })
        active.forEach(arc => {
          const npc = NPC_CONTACTS[arc.npcId]
          output.push({
            text: `  ${arc.name} (${npc?.name})`,
            type: 'handler'
          })
          output.push({
            text: `    Phase: ${arc.status.phaseTitle}`,
            type: 'response'
          })
        })
        output.push({ text: ``, type: 'system' })
      }

      if (available.length > 0) {
        output.push({ text: `[AVAILABLE]`, type: 'handler' })
        available.forEach(arc => {
          const npc = NPC_CONTACTS[arc.npcId]
          output.push({
            text: `  ${arc.name} - ${arc.description}`,
            type: 'response'
          })
        })
        output.push({ text: ``, type: 'system' })
      }

      if (locked.length > 0) {
        output.push({ text: `[LOCKED]`, type: 'response' })
        locked.forEach(arc => {
          output.push({
            text: `  ${arc.name} - Level ${arc.minLevel} required`,
            type: 'response'
          })
        })
        output.push({ text: ``, type: 'system' })
      }

      if (completed.length > 0) {
        output.push({ text: `[COMPLETED]`, type: 'success' })
        completed.forEach(arc => {
          output.push({
            text: `  ${arc.name}`,
            type: 'success'
          })
        })
      }

      if (allArcs.length === 0) {
        output.push({
          text: `No story arcs available yet. Keep playing!`,
          type: 'response'
        })
      }

      return { output }
    },
    help: 'View story arcs and their progress',
    usage: 'arc [arc_name]',
    examples: ['arc', 'arc architect_heist'],
    category: CATEGORIES.INFO,
  })

  // ============================================================
  // TRIGGER (Admin) - Force start an event
  // ============================================================
  commandRegistry.register({
    name: 'triggerevent',
    aliases: ['forceevent'],
    hidden: true, // Admin command
    handler: async ({ args }) => {
      if (args.length === 0) {
        const types = Object.values(WORLD_EVENT_TYPES).join(', ')
        return {
          output: [
            { text: `Available events: ${types}`, type: 'system' },
            { text: `Usage: triggerevent <type> [duration_mins]`, type: 'system' }
          ]
        }
      }

      const type = args[0].toLowerCase()
      const duration = args[1] ? parseInt(args[1]) : null

      const eventId = worldEventSystem.forceEvent(type, duration)

      if (eventId) {
        return {
          output: [
            { text: `Event triggered: ${type}`, type: 'success' }
          ]
        }
      }

      return { error: true, message: `Failed to trigger event: ${type}` }
    },
    help: 'Force start a world event (admin)',
    usage: 'triggerevent <type> [duration]',
    category: CATEGORIES.SYSTEM,
  })

  console.log('[OpportunityCommands] Registered opportunity commands')
}

export default registerOpportunityCommands
