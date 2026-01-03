/**
 * DefenseCommands - Commands for defending against heat and threats
 *
 * Commands:
 * - lawyer: Pay a lawyer to reduce heat
 * - hideout: Rent a temporary safe house
 * - payoff <npc>: Bribe an NPC for loyalty
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'
import { getContactByName, getContactById } from '../../data/NPCContacts'

// Lawyer pricing tiers
const LAWYER_TIERS = [
  { name: 'Public Defender', cost: 500, heatReduction: 10, description: 'Basic legal help' },
  { name: 'Street Lawyer', cost: 1500, heatReduction: 20, description: 'Knows the system' },
  { name: 'Criminal Attorney', cost: 3000, heatReduction: 35, description: 'Gets results' },
  { name: 'Power Attorney', cost: 5000, heatReduction: 50, description: 'Makes problems disappear' }
]

// Hideout options
const HIDEOUT_OPTIONS = {
  basic: { name: 'Basement Hideout', cost: 500, duration: 12, heatDecayBonus: 1.5 },
  standard: { name: 'Safe House', cost: 1000, duration: 24, heatDecayBonus: 2.0 },
  premium: { name: 'Secure Location', cost: 2500, duration: 48, heatDecayBonus: 3.0 }
}

/**
 * Register defense commands
 */
export function registerDefenseCommands() {
  // ============================================================
  // LAWYER Command - Pay to reduce heat
  // ============================================================
  commandRegistry.register({
    name: 'lawyer',
    aliases: ['legal', 'attorney'],
    handler: async ({ args }) => {
      const player = gameManager.player || {}
      const heat = player.heat || 0
      const cash = player.cash || 0

      // If no args, show options
      if (args.length === 0) {
        const output = [
          { text: ``, type: 'system' },
          { text: `:: LEGAL SERVICES ::`, type: 'system' },
          { text: `Current Heat: ${heat}%`, type: heat > 50 ? 'warning' : 'response' },
          { text: `Your Cash: $${cash.toLocaleString()}`, type: 'handler' },
          { text: ``, type: 'system' },
        ]

        LAWYER_TIERS.forEach((tier, index) => {
          const canAfford = cash >= tier.cost
          const useful = heat >= tier.heatReduction

          output.push({
            text: `[${index + 1}] ${tier.name} - $${tier.cost.toLocaleString()}`,
            type: canAfford ? 'handler' : 'error'
          })
          output.push({
            text: `    ${tier.description} | Heat -${tier.heatReduction}%`,
            type: 'response'
          })
        })

        output.push({ text: ``, type: 'system' })
        output.push({ text: `Usage: lawyer <1-4> to hire`, type: 'system' })

        return { output }
      }

      // Parse tier selection
      const tierIndex = parseInt(args[0]) - 1
      if (isNaN(tierIndex) || tierIndex < 0 || tierIndex >= LAWYER_TIERS.length) {
        return { error: true, message: `Invalid option. Use 'lawyer' to see available options.` }
      }

      const tier = LAWYER_TIERS[tierIndex]

      // Check cash
      if (cash < tier.cost) {
        return {
          error: true,
          message: `Not enough cash. Need $${tier.cost.toLocaleString()}, have $${cash.toLocaleString()}.`
        }
      }

      // Check if useful
      if (heat < 5) {
        return {
          error: true,
          message: `Your heat is already minimal. Save your money.`
        }
      }

      // Apply the service
      const newHeat = Math.max(0, heat - tier.heatReduction)
      const newCash = cash - tier.cost

      gameManager.updatePlayer({
        cash: newCash,
        heat: newHeat
      })

      return {
        output: [
          { text: ``, type: 'system' },
          { text: `:: ${tier.name.toUpperCase()} HIRED ::`, type: 'success' },
          { text: `Paid: $${tier.cost.toLocaleString()}`, type: 'warning' },
          { text: `Heat reduced: ${heat}% → ${newHeat}% (-${heat - newHeat}%)`, type: 'success' },
          { text: ``, type: 'system' },
          { text: `"Consider staying out of trouble for a while."`, type: 'response' }
        ]
      }
    },
    help: 'Pay a lawyer to reduce your heat level',
    usage: 'lawyer [tier]',
    examples: ['lawyer', 'lawyer 2'],
    category: CATEGORIES.ACTION,
  })

  // ============================================================
  // HIDEOUT Command - Rent temporary safe house
  // ============================================================
  commandRegistry.register({
    name: 'hideout',
    aliases: ['safehouse', 'hide', 'laylow'],
    handler: async ({ args }) => {
      const player = gameManager.player || {}
      const cash = player.cash || 0
      const currentHideout = player.activeHideout || null

      // Check if already in hideout
      if (currentHideout && currentHideout.expiresAt > Date.now()) {
        const remaining = Math.ceil((currentHideout.expiresAt - Date.now()) / (60 * 60 * 1000))
        return {
          output: [
            { text: ``, type: 'system' },
            { text: `:: CURRENT HIDEOUT ::`, type: 'system' },
            { text: `Location: ${currentHideout.name}`, type: 'handler' },
            { text: `Time remaining: ${remaining} hours`, type: 'success' },
            { text: `Heat decay bonus: ${currentHideout.heatDecayBonus}x`, type: 'success' }
          ]
        }
      }

      // If no args, show options
      if (args.length === 0) {
        const output = [
          { text: ``, type: 'system' },
          { text: `:: HIDEOUT OPTIONS ::`, type: 'system' },
          { text: `Your Cash: $${cash.toLocaleString()}`, type: 'handler' },
          { text: ``, type: 'system' },
        ]

        Object.entries(HIDEOUT_OPTIONS).forEach(([key, option]) => {
          const canAfford = cash >= option.cost

          output.push({
            text: `[${key}] ${option.name} - $${option.cost.toLocaleString()}`,
            type: canAfford ? 'handler' : 'error'
          })
          output.push({
            text: `    Duration: ${option.duration}hrs | Heat decay: ${option.heatDecayBonus}x faster`,
            type: 'response'
          })
        })

        output.push({ text: ``, type: 'system' })
        output.push({ text: `Usage: hideout <basic|standard|premium>`, type: 'system' })

        return { output }
      }

      // Parse selection
      const selection = args[0].toLowerCase()
      const option = HIDEOUT_OPTIONS[selection]

      if (!option) {
        return { error: true, message: `Invalid hideout. Options: basic, standard, premium` }
      }

      // Check cash
      if (cash < option.cost) {
        return {
          error: true,
          message: `Not enough cash. Need $${option.cost.toLocaleString()}, have $${cash.toLocaleString()}.`
        }
      }

      // Apply hideout
      const hideout = {
        name: option.name,
        type: selection,
        heatDecayBonus: option.heatDecayBonus,
        startedAt: Date.now(),
        expiresAt: Date.now() + (option.duration * 60 * 60 * 1000)
      }

      gameManager.updatePlayer({
        cash: cash - option.cost,
        activeHideout: hideout
      })

      return {
        output: [
          { text: ``, type: 'system' },
          { text: `:: HIDEOUT SECURED ::`, type: 'success' },
          { text: `Location: ${option.name}`, type: 'handler' },
          { text: `Duration: ${option.duration} hours`, type: 'success' },
          { text: `Heat decay: ${option.heatDecayBonus}x faster while here`, type: 'success' },
          { text: `Paid: $${option.cost.toLocaleString()}`, type: 'warning' },
          { text: ``, type: 'system' },
          { text: `Stay low and let the heat die down.`, type: 'response' }
        ]
      }
    },
    help: 'Rent a temporary safe house to accelerate heat decay',
    usage: 'hideout [basic|standard|premium]',
    examples: ['hideout', 'hideout standard'],
    category: CATEGORIES.ACTION,
  })

  // ============================================================
  // PAYOFF Command - Bribe an NPC
  // ============================================================
  commandRegistry.register({
    name: 'payoff',
    aliases: ['bribe', 'grease'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        return {
          error: true,
          message: "Usage: payoff <contact_name> <amount>\nBribe an NPC for loyalty or information."
        }
      }

      const player = gameManager.player || {}
      const cash = player.cash || 0

      // Parse contact name and amount
      let contactName, amount

      // Check if last arg is a number (the amount)
      const lastArg = args[args.length - 1]
      if (/^\$?\d+$/.test(lastArg)) {
        amount = parseInt(lastArg.replace('$', ''))
        contactName = args.slice(0, -1).join(' ')
      } else {
        // No amount specified, use default based on contact
        contactName = args.join(' ')
        amount = null
      }

      const contact = getContactByName(contactName) || getContactById(contactName)

      if (!contact) {
        return {
          error: true,
          message: `Unknown contact: "${contactName}"\nType 'contacts' to see available contacts.`
        }
      }

      // Can't bribe undercover cops
      if (contact.role === 'UNDERCOVER') {
        return {
          output: [
            { text: ``, type: 'system' },
            { text: `You try to slip ${contact.name} some cash...`, type: 'response' },
            { text: ``, type: 'system' },
            { text: `${contact.name} looks at you coldly. "Keep your money."`, type: 'warning' },
            { text: `Something feels off about this person...`, type: 'warning' }
          ]
        }
      }

      // Default payoff amounts based on contact
      if (!amount) {
        const baseCosts = {
          'FIXER': 500,
          'INTEL': 300,
          'BROKER': 1000,
          'HUSTLER': 200,
          'SUPPLIER': 800,
          'SPECIALIST': 1500,
          'CREW': 750,
          'MASTERMIND': 2000,
          'SNITCH': 1000
        }
        amount = baseCosts[contact.role] || 500
      }

      // Check cash
      if (cash < amount) {
        return {
          error: true,
          message: `Not enough cash. Need $${amount.toLocaleString()}, have $${cash.toLocaleString()}.`
        }
      }

      // Apply payoff
      gameManager.updatePlayer({ cash: cash - amount })

      // Different outcomes based on contact type
      const outcomes = {
        'SNITCH': {
          success: Math.random() > 0.3, // 70% success
          successMsg: `"Alright, alright... I'll keep my mouth shut. For now."`,
          failMsg: `"Thanks for the cash, but... I already talked. Sorry."`,
          effect: 'May delay betrayal'
        },
        'HUSTLER': {
          success: Math.random() > 0.5, // 50% success
          successMsg: `"We cool now. I got you on the next deal, for real this time."`,
          failMsg: `"Yeah yeah, thanks..." (You're not sure if they'll remember)`,
          effect: 'May get better deals'
        },
        default: {
          success: true,
          successMsg: `"Appreciate it. I'll remember this when something comes up."`,
          effect: 'Improved trust'
        }
      }

      const outcome = outcomes[contact.role] || outcomes.default

      if (outcome.success === false) {
        return {
          output: [
            { text: ``, type: 'system' },
            { text: `You hand ${contact.name} $${amount.toLocaleString()}...`, type: 'response' },
            { text: ``, type: 'system' },
            { text: outcome.failMsg, type: 'warning' },
            { text: `Cash: -$${amount.toLocaleString()}`, type: 'error' }
          ]
        }
      }

      return {
        output: [
          { text: ``, type: 'system' },
          { text: `:: PAYOFF SUCCESSFUL ::`, type: 'success' },
          { text: `Paid ${contact.name}: $${amount.toLocaleString()}`, type: 'handler' },
          { text: ``, type: 'system' },
          { text: outcome.successMsg, type: 'response' },
          { text: `Effect: ${outcome.effect}`, type: 'success' }
        ]
      }
    },
    help: 'Bribe an NPC for loyalty or information',
    usage: 'payoff <contact_name> [amount]',
    examples: ['payoff rat 1000', 'payoff snoop'],
    category: CATEGORIES.ACTION,
  })

  console.log('[DefenseCommands] Registered defense commands')
}

export default registerDefenseCommands
