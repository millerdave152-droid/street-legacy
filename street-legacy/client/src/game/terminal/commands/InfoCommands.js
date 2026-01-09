/**
 * InfoCommands - Information display commands
 * help, status, whoami, time
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'
import { formatMoney } from '../../../utils/formatters'
import { getCurrentTimeModifier } from '../../data/GameData'
import { questlineManager } from '../../managers/QuestlineManager'
import { progressionManager, PROGRESSION_BANDS } from '../../managers/ProgressionManager'

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

  // ============================================
  // BANKING COMMANDS
  // ============================================

  // DEPOSIT command - Transfer cash to bank
  commandRegistry.register({
    name: 'deposit',
    aliases: ['dep', 'save'],
    handler: async ({ args }) => {
      const player = gameManager.player
      if (!player) {
        return { error: true, message: 'No player data available.' }
      }

      if (args.length === 0) {
        return {
          error: true,
          message: `Usage: deposit <amount> or 'deposit all'\nCash: ${formatMoney(player.cash || 0)} | Bank: ${formatMoney(player.bank || 0)}`
        }
      }

      let amount
      const arg = args[0].toLowerCase()

      if (arg === 'all' || arg === 'max') {
        amount = player.cash || 0
      } else {
        // Parse amount - handle formats like "500", "$500", "5k", "5000"
        const numStr = arg.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000')
        amount = parseInt(numStr)
      }

      if (isNaN(amount) || amount <= 0) {
        return { error: true, message: 'Please enter a valid amount.' }
      }

      if (amount > (player.cash || 0)) {
        return { error: true, message: `Insufficient cash. You have ${formatMoney(player.cash || 0)}.` }
      }

      // Perform the deposit
      const newCash = (player.cash || 0) - amount
      const newBank = (player.bank || 0) + amount

      gameManager.updatePlayer({ cash: newCash, bank: newBank })

      return {
        output: [
          { text: `:: DEPOSIT SUCCESSFUL ::`, type: 'system' },
          { text: `  Deposited: ${formatMoney(amount)}`, type: 'success' },
          { text: `  Cash: ${formatMoney(newCash)}`, type: 'response' },
          { text: `  Bank: ${formatMoney(newBank)}`, type: 'response' }
        ]
      }
    },
    help: 'Deposit cash into your bank account',
    usage: 'deposit <amount>',
    category: CATEGORIES.ACTION,
    minLevel: 1,
  })

  // WITHDRAW command - Transfer bank funds to cash
  commandRegistry.register({
    name: 'withdraw',
    aliases: ['wd', 'cash'],
    handler: async ({ args }) => {
      const player = gameManager.player
      if (!player) {
        return { error: true, message: 'No player data available.' }
      }

      if (args.length === 0) {
        return {
          error: true,
          message: `Usage: withdraw <amount> or 'withdraw all'\nCash: ${formatMoney(player.cash || 0)} | Bank: ${formatMoney(player.bank || 0)}`
        }
      }

      let amount
      const arg = args[0].toLowerCase()

      if (arg === 'all' || arg === 'max') {
        amount = player.bank || 0
      } else {
        // Parse amount - handle formats like "500", "$500", "5k", "5000"
        const numStr = arg.replace(/[$,]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000')
        amount = parseInt(numStr)
      }

      if (isNaN(amount) || amount <= 0) {
        return { error: true, message: 'Please enter a valid amount.' }
      }

      if (amount > (player.bank || 0)) {
        return { error: true, message: `Insufficient bank balance. You have ${formatMoney(player.bank || 0)} in the bank.` }
      }

      // Perform the withdrawal
      const newBank = (player.bank || 0) - amount
      const newCash = (player.cash || 0) + amount

      gameManager.updatePlayer({ cash: newCash, bank: newBank })

      return {
        output: [
          { text: `:: WITHDRAWAL SUCCESSFUL ::`, type: 'system' },
          { text: `  Withdrew: ${formatMoney(amount)}`, type: 'success' },
          { text: `  Cash: ${formatMoney(newCash)}`, type: 'response' },
          { text: `  Bank: ${formatMoney(newBank)}`, type: 'response' }
        ]
      }
    },
    help: 'Withdraw funds from your bank account',
    usage: 'withdraw <amount>',
    category: CATEGORIES.ACTION,
    minLevel: 1,
  })

  // ============================================
  // IDENTITY COMMANDS
  // ============================================

  // NICK command - Change player username
  commandRegistry.register({
    name: 'nick',
    aliases: ['nickname', 'name', 'setname', 'rename'],
    handler: async ({ args }) => {
      const player = gameManager.player
      if (!player) {
        return { error: true, message: 'No player data available.' }
      }

      if (args.length === 0) {
        return {
          output: [
            { text: ':: Player Identity', type: 'system' },
            { text: `  Current name: @${player.username || 'player'}`, type: 'response' },
            { text: '', type: 'response' },
            { text: '  Usage: nick <new_name>', type: 'system' },
            { text: '  Example: nick ShadowRunner', type: 'response' },
          ]
        }
      }

      const newName = args.join(' ').trim()

      // Validation
      if (newName.length < 2) {
        return { error: true, message: 'Name must be at least 2 characters.' }
      }
      if (newName.length > 20) {
        return { error: true, message: 'Name cannot exceed 20 characters.' }
      }
      if (!/^[a-zA-Z0-9_\-]+$/.test(newName)) {
        return { error: true, message: 'Name can only contain letters, numbers, underscores, and hyphens.' }
      }

      const oldName = player.username || 'player'
      gameManager.updatePlayerData({ username: newName })

      return {
        output: [
          { text: ':: Identity Updated', type: 'system' },
          { text: `  Changed from @${oldName} to @${newName}`, type: 'success' },
        ]
      }
    },
    help: 'Change your player name',
    usage: 'nick <new_name>',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // BALANCE command - Show bank balance
  commandRegistry.register({
    name: 'balance',
    aliases: ['bal', 'money'],
    handler: async () => {
      const player = gameManager.player
      if (!player) {
        return { error: true, message: 'No player data available.' }
      }

      const cash = player.cash || 0
      const bank = player.bank || 0
      const total = cash + bank

      return {
        output: [
          { text: `:: FINANCIAL STATUS ::`, type: 'system' },
          { text: `  Cash on hand: ${formatMoney(cash)}`, type: 'response' },
          { text: `  Bank account: ${formatMoney(bank)}`, type: 'response' },
          { text: `  ─────────────────────`, type: 'system' },
          { text: `  Total assets: ${formatMoney(total)}`, type: 'success' },
          { text: ``, type: 'system' },
          { text: `  Use 'deposit <amount>' to save money`, type: 'system' },
          { text: `  Use 'withdraw <amount>' to access funds`, type: 'system' }
        ]
      }
    },
    help: 'Check your financial status',
    usage: 'balance',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // ============================================
  // PROGRESSION COMMANDS
  // ============================================

  // QUEST command - Show current quest progress
  commandRegistry.register({
    name: 'quest',
    aliases: ['q', 'objective', 'mission'],
    handler: async () => {
      const progress = questlineManager.getQuestProgress()
      const output = []

      if (!progress.hasActiveQuest) {
        if (progress.isOnboardingComplete) {
          output.push({ text: ':: ONBOARDING COMPLETE ::', type: 'success' })
          output.push({ text: '', type: 'system' })
          output.push({ text: "  You've mastered the basics.", type: 'response' })
          output.push({ text: "  The streets are yours to conquer.", type: 'response' })
          output.push({ text: '', type: 'system' })
          output.push({ text: "  Use 'goals' to see your current progression goals.", type: 'system' })
        } else {
          output.push({ text: ':: NO ACTIVE QUEST ::', type: 'system' })
          output.push({ text: '', type: 'system' })
          output.push({ text: '  Level up to unlock your next objective.', type: 'response' })
        }
        return { output }
      }

      const { quest, progress: curr, target, percent } = progress

      // Quest header
      output.push({ text: ':: CURRENT OBJECTIVE ::', type: 'system' })
      output.push({ text: '', type: 'system' })
      output.push({ text: `  ${quest.title}`, type: 'success' })
      output.push({ text: `  "${quest.description}"`, type: 'response' })
      output.push({ text: '', type: 'system' })

      // Progress bar
      const barLength = 20
      const filled = Math.round((percent / 100) * barLength)
      const empty = barLength - filled
      const bar = '█'.repeat(filled) + '░'.repeat(empty)
      output.push({ text: `  Progress: ${bar} ${percent}%`, type: percent >= 100 ? 'success' : 'response' })
      output.push({ text: `  ${curr}/${target}`, type: 'response' })
      output.push({ text: '', type: 'system' })

      // Show hint
      output.push({ text: '  Hint:', type: 'system' })
      output.push({ text: `  ${quest.terminalHint || quest.sarahHint}`, type: 'handler' })

      // Show rewards
      if (quest.rewards) {
        output.push({ text: '', type: 'system' })
        const rewardParts = []
        if (quest.rewards.xp) rewardParts.push(`+${quest.rewards.xp} XP`)
        if (quest.rewards.cash) rewardParts.push(`+${formatMoney(quest.rewards.cash)}`)
        output.push({ text: `  Rewards: ${rewardParts.join(', ')}`, type: 'npc_deal' })
      }

      return { output }
    },
    help: 'View your current quest progress',
    usage: 'quest',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // GOALS command - Show progression band goals
  commandRegistry.register({
    name: 'goals',
    aliases: ['progress', 'tier'],
    handler: async () => {
      const summary = progressionManager.getBandSummary()
      const output = []

      // Band header
      output.push({ text: `:: ${summary.label.toUpperCase()} - LEVEL ${summary.level} ::`, type: 'success' })
      output.push({ text: '', type: 'system' })

      // Band progress
      const { percent, current, total } = summary.progress
      const barLength = 20
      const filled = Math.round((percent / 100) * barLength)
      const empty = barLength - filled
      const bar = '█'.repeat(filled) + '░'.repeat(empty)
      output.push({ text: `  Band Progress: ${bar} ${percent}%`, type: 'response' })
      output.push({ text: '', type: 'system' })

      // Goals
      output.push({ text: '  Goals for this tier:', type: 'system' })
      summary.goals.forEach(goal => {
        output.push({ text: `    • ${goal}`, type: 'response' })
      })
      output.push({ text: '', type: 'system' })

      // Next milestone
      if (summary.nextMilestone) {
        output.push({ text: `  Next Milestone (Level ${summary.nextMilestone.level}):`, type: 'system' })
        output.push({ text: `    ${summary.nextMilestone.description}`, type: 'handler' })
        output.push({ text: '', type: 'system' })
      }

      // Expected net worth
      const { min, max } = summary.typicalNetWorth
      output.push({ text: `  Typical Net Worth: ${formatMoney(min)} - ${formatMoney(max)}`, type: 'system' })

      return { output }
    },
    help: 'View your progression goals',
    usage: 'goals',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  console.log('[InfoCommands] Registered info commands')
}

export default registerInfoCommands
