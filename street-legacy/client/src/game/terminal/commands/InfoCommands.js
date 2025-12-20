/**
 * InfoCommands - Information display commands
 * help, status, whoami, time
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'
import { formatMoney } from '../../../utils/formatters'
import { getCurrentTimeModifier } from '../../data/GameData'

/**
 * Render a text-based progress bar
 */
function renderBar(value, max, length = 10) {
  const filled = Math.round((value / max) * length)
  const empty = length - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Register all info commands
 */
export function registerInfoCommands() {
  // HELP command
  commandRegistry.register({
    name: 'help',
    aliases: ['?', 'h', 'commands'],
    handler: async ({ args, terminal }) => {
      if (args.length > 0) {
        // Help for specific command
        const lines = commandRegistry.getHelp(args[0])
        return { output: lines }
      }
      // Full help
      return { output: commandRegistry.getFullHelp() }
    },
    help: 'Show available commands',
    usage: 'help [command]',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // STATUS command
  commandRegistry.register({
    name: 'status',
    aliases: ['stats', 'stat', 's'],
    handler: async ({ terminal }) => {
      const player = gameManager.player || {}
      const output = []

      // Identity line
      const username = player.username || 'player'
      const level = player.level || 1
      const district = player.current_district || player.district || 'Unknown'
      output.push({ text: `  @${username} | LV${level} | ${district}`, type: 'response' })
      output.push({ text: '', type: 'response' })

      // Cash
      const cash = player.cash || 0
      const hourlyIncome = player.hourlyIncome || 0
      const incomeText = hourlyIncome > 0 ? ` (+${formatMoney(hourlyIncome)}/hr)` : ''
      output.push({ text: `  CASH: ${formatMoney(cash)}${incomeText}`, type: 'success' })

      // Heat
      const heat = player.heat || 0
      const heatBar = renderBar(heat, 100)
      const heatType = heat >= 75 ? 'error' : heat >= 50 ? 'warning' : 'response'
      output.push({ text: `  HEAT: ${heatBar} ${heat}%`, type: heatType })

      // Energy
      const energy = Math.floor(player.energy || player.stamina || 100)
      const maxEnergy = player.maxEnergy || 100
      const energyBar = renderBar(energy, maxEnergy)
      const energyType = energy < 30 ? 'warning' : 'response'
      output.push({ text: `  ENERGY: ${energyBar} ${energy}/${maxEnergy}`, type: energyType })

      // XP progress
      const xp = player.xp || 0
      const nextLevelXp = ((level + 1) * (level + 1)) * 100
      const currentLevelXp = (level * level) * 100
      const xpProgress = xp - currentLevelXp
      const xpNeeded = nextLevelXp - currentLevelXp
      const xpBar = renderBar(xpProgress, xpNeeded)
      output.push({ text: `  XP: ${xpBar} ${xpProgress}/${xpNeeded}`, type: 'response' })

      // Bank
      if (player.bank !== undefined) {
        output.push({ text: `  BANK: ${formatMoney(player.bank || 0)}`, type: 'response' })
      }

      // Reputation if tracked
      if (player.reputation !== undefined) {
        output.push({ text: `  REP: ${player.reputation || 0}`, type: 'response' })
      }

      return { output }
    },
    help: 'View your current stats',
    usage: 'status',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // WHOAMI command
  commandRegistry.register({
    name: 'whoami',
    aliases: ['who', 'me', 'id'],
    handler: async ({ terminal }) => {
      const player = gameManager.player || {}
      const username = player.username || 'player'
      const level = player.level || 1
      const district = player.current_district || player.district || 'Unknown'
      const build = player.build || 'Unknown'
      const createdAt = player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'Unknown'

      const output = [
        { text: `  @${username}`, type: 'success' },
        { text: `  Level ${level} ${build}`, type: 'response' },
        { text: `  District: ${district}`, type: 'response' },
        { text: `  Member since: ${createdAt}`, type: 'response' },
      ]

      // Show stats summary
      const crimes = player.crimes_committed || 0
      const jobs = player.jobs_completed || 0
      const totalEarnings = player.totalEarnings || 0

      output.push({ text: '', type: 'response' })
      output.push({ text: `  Crimes: ${crimes} | Jobs: ${jobs}`, type: 'response' })
      output.push({ text: `  Total Earnings: ${formatMoney(totalEarnings)}`, type: 'response' })

      return { output }
    },
    help: 'Show your identity',
    usage: 'whoami',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // TIME command
  commandRegistry.register({
    name: 'time',
    aliases: ['clock', 'when'],
    handler: async ({ terminal }) => {
      const timeData = getCurrentTimeModifier()
      const now = new Date()
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

      const output = [
        { text: `  ${timeData.periodIcon} ${timeData.periodName}`, type: 'response' },
        { text: `  ${timeStr} - ${dateStr}`, type: 'response' },
      ]

      // Show any time-based modifiers
      if (timeData.crimeMultiplier !== 1 || timeData.jobMultiplier !== 1) {
        output.push({ text: '', type: 'response' })
        if (timeData.crimeMultiplier > 1) {
          output.push({ text: `  Crime payout: +${Math.round((timeData.crimeMultiplier - 1) * 100)}%`, type: 'success' })
        } else if (timeData.crimeMultiplier < 1) {
          output.push({ text: `  Crime payout: ${Math.round((timeData.crimeMultiplier - 1) * 100)}%`, type: 'warning' })
        }
        if (timeData.jobMultiplier > 1) {
          output.push({ text: `  Job payout: +${Math.round((timeData.jobMultiplier - 1) * 100)}%`, type: 'success' })
        } else if (timeData.jobMultiplier < 1) {
          output.push({ text: `  Job payout: ${Math.round((timeData.jobMultiplier - 1) * 100)}%`, type: 'warning' })
        }
      }

      return { output }
    },
    help: 'Show current game time',
    usage: 'time',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // VERSION command (hidden)
  commandRegistry.register({
    name: 'version',
    aliases: ['ver', 'v'],
    handler: async () => {
      return {
        output: [
          { text: '  Street Legacy v3.1.1', type: 'system' },
          { text: '  THE CONSOLE v1.0.0', type: 'system' },
          { text: '  Powered by Phaser 3', type: 'response' },
        ]
      }
    },
    help: 'Show version info',
    usage: 'version',
    category: CATEGORIES.INFO,
    minLevel: 1,
    hidden: true,
  })

  console.log('[InfoCommands] Registered info commands')
}

export default registerInfoCommands
