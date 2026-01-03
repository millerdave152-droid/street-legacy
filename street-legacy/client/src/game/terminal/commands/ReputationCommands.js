/**
 * ReputationCommands - Commands for viewing reputation and intel
 *
 * Commands:
 * - reputation/rep: View faction standings and overall trust
 * - intel: View saved intel from informants
 * - heat: View heat level and cop activity
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'
import { consoleMessageManager } from '../../managers/ConsoleMessageManager'

/**
 * Get heat level description
 */
function getHeatDescription(heat) {
  if (heat >= 90) return { text: 'CRITICAL - Cops actively hunting you!', color: 'error' }
  if (heat >= 70) return { text: 'VERY HIGH - Contacts going silent', color: 'error' }
  if (heat >= 50) return { text: 'HIGH - Watch for undercovers', color: 'warning' }
  if (heat >= 30) return { text: 'MODERATE - Stay alert', color: 'warning' }
  if (heat >= 10) return { text: 'LOW - Flying under radar', color: 'handler' }
  return { text: 'CLEAR - No heat', color: 'success' }
}

/**
 * Get faction reputation display
 */
function getFactionDisplay(value) {
  if (value >= 50) return { text: 'Allied', color: 'success' }
  if (value >= 20) return { text: 'Friendly', color: 'handler' }
  if (value >= -20) return { text: 'Neutral', color: 'response' }
  if (value >= -50) return { text: 'Hostile', color: 'warning' }
  return { text: 'Enemy', color: 'error' }
}

/**
 * Create a progress bar
 */
function createProgressBar(value, max = 100, width = 20) {
  const filled = Math.round((value / max) * width)
  const empty = width - filled
  return '[' + '='.repeat(Math.max(0, filled)) + '-'.repeat(Math.max(0, empty)) + ']'
}

/**
 * Register reputation commands
 */
export function registerReputationCommands() {
  // ============================================================
  // REPUTATION Command - View faction standings
  // ============================================================
  commandRegistry.register({
    name: 'reputation',
    aliases: ['rep', 'trust', 'standing'],
    handler: async ({ terminal }) => {
      const player = gameManager.player || {}

      // Get player reputation data
      const respect = player.respect || 0
      const level = player.level || 1

      // Default factions if not set
      const factions = player.factions || {
        janeAndFinch: 0,
        parkdale: 0,
        yorkville: -10,
        scarborough: 0,
        downtown: 0
      }

      const output = [
        { text: ``, type: 'system' },
        { text: `:: REPUTATION STATUS ::`, type: 'system' },
        { text: ``, type: 'system' },
        { text: `Level: ${level}`, type: 'handler' },
        { text: `Street Cred: ${respect}`, type: 'handler' },
        { text: ``, type: 'system' },
        { text: `[FACTION STANDINGS]`, type: 'system' },
      ]

      // Display each faction
      const factionNames = {
        janeAndFinch: 'Jane & Finch',
        parkdale: 'Parkdale',
        yorkville: 'Yorkville',
        scarborough: 'Scarborough',
        downtown: 'Downtown'
      }

      for (const [key, displayName] of Object.entries(factionNames)) {
        const value = factions[key] || 0
        const status = getFactionDisplay(value)
        const bar = createProgressBar(value + 50, 100, 15) // -50 to 50 → 0 to 100

        output.push({
          text: `  ${displayName.padEnd(14)} ${bar} ${status.text}`,
          type: status.color
        })
      }

      output.push({ text: ``, type: 'system' })
      output.push({ text: `Tip: Complete jobs for factions to improve standing.`, type: 'response' })

      return { output }
    },
    help: 'View your reputation with different factions',
    usage: 'reputation',
    category: CATEGORIES.INFO,
  })

  // ============================================================
  // INTEL Command - View saved intel
  // ============================================================
  commandRegistry.register({
    name: 'intel',
    aliases: ['info', 'saved'],
    handler: async ({ args }) => {
      const savedIntel = consoleMessageManager.getSavedIntel()

      if (savedIntel.length === 0) {
        return {
          output: [
            { text: ``, type: 'system' },
            { text: `:: SAVED INTEL ::`, type: 'system' },
            { text: ``, type: 'system' },
            { text: `No saved intel.`, type: 'response' },
            { text: `Save intel from informant messages with 'save <id>'.`, type: 'response' }
          ]
        }
      }

      // Handle specific intel ID
      if (args.length > 0) {
        const id = args[0]
        const intel = savedIntel.find(i => i.id.includes(id))

        if (!intel) {
          return { error: true, message: `Intel "${id}" not found.` }
        }

        return {
          output: [
            { text: ``, type: 'system' },
            { text: `:: INTEL DETAILS ::`, type: 'system' },
            { text: `From: ${intel.from.name} ${intel.from.prefix}`, type: 'handler' },
            { text: ``, type: 'system' },
            { text: intel.content, type: 'response' },
            { text: ``, type: 'system' },
            { text: `Saved: ${new Date(intel.savedAt).toLocaleString()}`, type: 'system' }
          ]
        }
      }

      // List all saved intel
      const output = [
        { text: ``, type: 'system' },
        { text: `:: SAVED INTEL (${savedIntel.length}) ::`, type: 'system' },
        { text: ``, type: 'system' },
      ]

      savedIntel.forEach((intel, index) => {
        const shortId = intel.id.split('_').pop().slice(-6)
        const preview = intel.content.substring(0, 50) + (intel.content.length > 50 ? '...' : '')

        output.push({ text: `[${index + 1}] ${intel.from.name}: ${preview}`, type: 'handler' })
      })

      output.push({ text: ``, type: 'system' })
      output.push({ text: `Type 'intel <number>' to view details.`, type: 'system' })

      return { output }
    },
    help: 'View saved intel from informants',
    usage: 'intel [id]',
    examples: ['intel', 'intel 1'],
    category: CATEGORIES.INFO,
  })

  // ============================================================
  // HEAT Command - View heat level and cop activity
  // ============================================================
  commandRegistry.register({
    name: 'heat',
    aliases: ['wanted', 'cops', 'police'],
    handler: async ({ terminal }) => {
      const player = gameManager.player || {}
      const heat = player.heat || 0

      const heatStatus = getHeatDescription(heat)
      const bar = createProgressBar(heat, 100, 25)

      const output = [
        { text: ``, type: 'system' },
        { text: `:: HEAT STATUS ::`, type: 'system' },
        { text: ``, type: 'system' },
        { text: `Heat Level: ${heat}%`, type: heatStatus.color },
        { text: bar, type: heatStatus.color },
        { text: `Status: ${heatStatus.text}`, type: heatStatus.color },
        { text: ``, type: 'system' },
      ]

      // Add warnings based on heat level
      if (heat >= 70) {
        output.push({ text: `WARNING: High-value contacts have gone silent!`, type: 'error' })
        output.push({ text: `The Pharmacist, The Architect, and others won't message you.`, type: 'error' })
      }

      if (heat >= 50) {
        output.push({ text: `ALERT: Watch for undercover cops offering "too good" deals.`, type: 'warning' })
      }

      if (heat >= 30) {
        output.push({ text: `Tip: Use 'lawyer' to pay for heat reduction.`, type: 'response' })
        output.push({ text: `Tip: Use 'hideout' to rent temporary heat immunity.`, type: 'response' })
      }

      if (heat < 10) {
        output.push({ text: `You're flying under the radar. Good work.`, type: 'success' })
      }

      return { output }
    },
    help: 'View your current heat level and cop activity',
    usage: 'heat',
    category: CATEGORIES.INFO,
  })

  console.log('[ReputationCommands] Registered reputation commands')
}

export default registerReputationCommands
