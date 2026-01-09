/**
 * TerritoryCommands - Territory investment and heist contract commands
 * territory invest, territory status, contract create/accept/view
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { territoryService } from '../../../services/territory.service'

/**
 * Format currency for display
 */
function formatMoney(amount) {
  return `$${Number(amount).toLocaleString()}`
}

/**
 * Register all territory commands
 */
export function registerTerritoryCommands() {
  // TERRITORY command - territory investments and status
  commandRegistry.register({
    name: 'territory',
    aliases: ['terr', 'turf'],
    handler: async ({ args, terminal }) => {
      const subcommand = args[0]?.toLowerCase()

      if (!subcommand || subcommand === 'help') {
        return showTerritoryHelp(terminal)
      }

      switch (subcommand) {
        case 'invest':
          return handleInvest(args.slice(1), terminal)
        case 'status':
        case 'info':
          return handleStatus(args.slice(1), terminal)
        case 'my':
        case 'investments':
          return handleMyInvestments(terminal)
        case 'leaderboard':
        case 'lb':
          return handleLeaderboard(args.slice(1), terminal)
        case 'modifiers':
        case 'mods':
          return handleModifiers(args.slice(1), terminal)
        default:
          terminal.addLine(`Unknown subcommand: ${subcommand}`, 'error')
          return showTerritoryHelp(terminal)
      }
    },
    category: CATEGORIES.CREW,
    description: 'Territory investments',
    usage: 'territory <invest|status|my|leaderboard|modifiers>',
    help: `
Territory Investment System
  Crews can invest in districts to influence local metrics.

Subcommands:
  invest <district> <type> <amount>  - Make an investment
  status <district>                   - View district investments
  my                                  - View your crew's investments
  leaderboard <district>              - View top investors
  modifiers <district>                - View district modifiers

Investment Types:
  security    - Increases police presence
  corruption  - Reduces police catch rates
  business    - Boosts property income
  street      - Increases crime payouts

Examples:
  territory invest downtown security 50000
  territory status downtown
  territory my
`
  })

  // CONTRACT command - heist contracts
  commandRegistry.register({
    name: 'contract',
    aliases: ['contracts', 'job-board'],
    handler: async ({ args, terminal }) => {
      const subcommand = args[0]?.toLowerCase()

      if (!subcommand || subcommand === 'help') {
        return showContractHelp(terminal)
      }

      switch (subcommand) {
        case 'list':
        case 'view':
        case 'open':
          return handleContractList(terminal)
        case 'create':
        case 'post':
        case 'new':
          return handleContractCreate(args.slice(1), terminal)
        case 'accept':
        case 'take':
          return handleContractAccept(args.slice(1), terminal)
        case 'my':
        case 'mine':
          return handleMyContracts(terminal)
        case 'cancel':
          return handleContractCancel(args.slice(1), terminal)
        default:
          // Assume it's a contract ID to view
          return handleContractView(subcommand, terminal)
      }
    },
    category: CATEGORIES.SOCIAL,
    description: 'Heist contracts board',
    usage: 'contract <list|create|accept|my|cancel>',
    help: `
Heist Contract System
  Fund contracts for others to execute. Earn a split of the payout.

Subcommands:
  list                                       - View open contracts
  create <type> <amount> <split> <desc>      - Post a new contract
  accept <id>                                - Accept a contract
  my                                         - View your contracts
  cancel <id>                                - Cancel your open contract

Contract Types:
  heist      - Heist-based contracts
  crime      - Crime-based contracts
  territory  - Territory operations

Examples:
  contract list
  contract create heist 10000 70 "Hit the downtown vault"
  contract accept abc123
  contract my
`
  })
}

/**
 * Show territory help
 */
function showTerritoryHelp(terminal) {
  const output = [
    { text: '  Territory Investment Commands', type: 'system' },
    { text: '', type: 'response' },
    { text: '  territory invest <district> <type> <amount>', type: 'highlight' },
    { text: '    Make an investment in a district', type: 'response' },
    { text: '', type: 'response' },
    { text: '  territory status <district>', type: 'highlight' },
    { text: '    View all investments in a district', type: 'response' },
    { text: '', type: 'response' },
    { text: '  territory my', type: 'highlight' },
    { text: '    View your crew\'s investments', type: 'response' },
    { text: '', type: 'response' },
    { text: '  territory leaderboard <district>', type: 'highlight' },
    { text: '    View top investors in a district', type: 'response' },
    { text: '', type: 'response' },
    { text: '  territory modifiers <district>', type: 'highlight' },
    { text: '    View district modifiers from investments', type: 'response' },
    { text: '', type: 'response' },
    { text: '  Investment Types:', type: 'system' },
    { text: '    security    +Police presence', type: 'response' },
    { text: '    corruption  -Police catch rates', type: 'response' },
    { text: '    business    +Property income', type: 'response' },
    { text: '    street      +Crime payouts', type: 'response' },
  ]

  output.forEach(line => terminal.addLine(line.text, line.type))
}

/**
 * Handle territory invest command
 */
async function handleInvest(args, terminal) {
  if (args.length < 3) {
    terminal.addLine('  Usage: territory invest <district> <type> <amount>', 'error')
    terminal.addLine('  Example: territory invest downtown security 50000', 'muted')
    return
  }

  const [districtId, investmentType, amountStr] = args
  const amount = parseInt(amountStr.replace(/[,$]/g, ''))

  if (isNaN(amount) || amount <= 0) {
    terminal.addLine('  Invalid amount', 'error')
    return
  }

  const validTypes = ['security', 'corruption', 'business', 'street']
  if (!validTypes.includes(investmentType.toLowerCase())) {
    terminal.addLine(`  Invalid investment type. Must be: ${validTypes.join(', ')}`, 'error')
    return
  }

  terminal.addLine(`  Investing ${formatMoney(amount)} in ${investmentType}...`, 'system')

  try {
    const result = await territoryService.invest(districtId, investmentType.toLowerCase(), amount)

    if (result.success) {
      terminal.addLine('', 'response')
      terminal.addLine('  Investment successful!', 'success')
      terminal.addLine(`  New ${investmentType} influence: ${result.data.newInfluence}`, 'highlight')
      terminal.addLine(`  Total invested: ${formatMoney(result.data.totalInvested)}`, 'response')
    } else {
      terminal.addLine(`  ${result.error}`, 'error')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle territory status command
 */
async function handleStatus(args, terminal) {
  if (args.length === 0) {
    terminal.addLine('  Usage: territory status <district>', 'error')
    return
  }

  const districtId = args[0]
  terminal.addLine(`  Loading investments for ${districtId}...`, 'system')

  try {
    const result = await territoryService.getDistrictInvestments(districtId)

    if (!result.success) {
      terminal.addLine(`  ${result.error}`, 'error')
      return
    }

    const investments = result.data

    terminal.addLine('', 'response')
    terminal.addLine(`  Investments in ${districtId.toUpperCase()}`, 'system')
    terminal.addLine('  ' + '='.repeat(50), 'muted')

    if (investments.length === 0) {
      terminal.addLine('  No investments yet', 'muted')
      return
    }

    for (const inv of investments) {
      terminal.addLine('', 'response')
      terminal.addLine(`  #${inv.rank} [${inv.crewTag}] ${inv.crewName}`, 'highlight')
      terminal.addLine(`     Total: ${formatMoney(inv.totalInvested)}`, 'response')
      terminal.addLine(`     Security: ${formatMoney(inv.investments.security)} (${inv.influence.security})`, 'response')
      terminal.addLine(`     Corruption: ${formatMoney(inv.investments.corruption)} (${inv.influence.corruption})`, 'response')
      terminal.addLine(`     Business: ${formatMoney(inv.investments.business)} (${inv.influence.business})`, 'response')
      terminal.addLine(`     Street: ${formatMoney(inv.investments.street)} (${inv.influence.street})`, 'response')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle my investments command
 */
async function handleMyInvestments(terminal) {
  terminal.addLine('  Loading your crew investments...', 'system')

  try {
    const result = await territoryService.getMyInvestments()

    if (!result.success) {
      terminal.addLine(`  ${result.error}`, 'error')
      return
    }

    const investments = result.data

    terminal.addLine('', 'response')
    terminal.addLine('  Your Crew Investments', 'system')
    terminal.addLine('  ' + '='.repeat(40), 'muted')

    if (investments.length === 0) {
      terminal.addLine('  No investments yet', 'muted')
      terminal.addLine('  Use: territory invest <district> <type> <amount>', 'response')
      return
    }

    for (const inv of investments) {
      terminal.addLine('', 'response')
      terminal.addLine(`  ${inv.districtName} (#${inv.districtRank} in district)`, 'highlight')
      terminal.addLine(`     Total: ${formatMoney(inv.totalInvested)}`, 'response')
      terminal.addLine(`     S:${formatMoney(inv.investments.security)} C:${formatMoney(inv.investments.corruption)} B:${formatMoney(inv.investments.business)} St:${formatMoney(inv.investments.street)}`, 'muted')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle leaderboard command
 */
async function handleLeaderboard(args, terminal) {
  if (args.length === 0) {
    terminal.addLine('  Usage: territory leaderboard <district>', 'error')
    return
  }

  const districtId = args[0]
  terminal.addLine(`  Loading investor leaderboard for ${districtId}...`, 'system')

  try {
    const result = await territoryService.getInvestorLeaderboard(districtId)

    if (!result.success) {
      terminal.addLine(`  ${result.error}`, 'error')
      return
    }

    const leaders = result.data

    terminal.addLine('', 'response')
    terminal.addLine(`  Top Investors - ${districtId.toUpperCase()}`, 'system')
    terminal.addLine('  ' + '='.repeat(45), 'muted')

    if (leaders.length === 0) {
      terminal.addLine('  No investors yet', 'muted')
      return
    }

    for (const leader of leaders) {
      const typeIcon = {
        security: '[S]',
        corruption: '[C]',
        business: '[B]',
        street: '[St]'
      }[leader.dominantType] || ''

      terminal.addLine(
        `  #${leader.rank}  [${leader.crewTag}] ${leader.crewName.padEnd(15)} ${formatMoney(leader.totalInvested).padStart(12)} ${typeIcon}`,
        leader.rank <= 3 ? 'highlight' : 'response'
      )
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle modifiers command
 */
async function handleModifiers(args, terminal) {
  if (args.length === 0) {
    terminal.addLine('  Usage: territory modifiers <district>', 'error')
    return
  }

  const districtId = args[0]
  terminal.addLine(`  Loading modifiers for ${districtId}...`, 'system')

  try {
    const result = await territoryService.getDistrictModifiers(districtId)

    if (!result.success) {
      terminal.addLine(`  ${result.error}`, 'error')
      return
    }

    const mods = result.data

    terminal.addLine('', 'response')
    terminal.addLine(`  District Modifiers - ${districtId.toUpperCase()}`, 'system')
    terminal.addLine('  ' + '='.repeat(40), 'muted')

    const formatMod = (val) => {
      const pct = ((val - 1) * 100).toFixed(1)
      if (pct > 0) return `+${pct}%`
      if (pct < 0) return `${pct}%`
      return '0%'
    }

    terminal.addLine(`  Police Presence:     ${formatMod(mods.policePresenceMod)}`, 'response')
    terminal.addLine(`  Police Effectiveness: ${formatMod(mods.policeEffectivenessMod)}`, 'response')
    terminal.addLine(`  Property Income:      ${formatMod(mods.propertyIncomeMod)}`, 'response')
    terminal.addLine(`  Crime Payouts:        ${formatMod(mods.crimePayoutMod)}`, 'response')

    if (mods.dominantCrew) {
      terminal.addLine('', 'response')
      terminal.addLine(`  Dominant Investor: ${mods.dominantCrew.name}`, 'highlight')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Show contract help
 */
function showContractHelp(terminal) {
  const output = [
    { text: '  Heist Contract Commands', type: 'system' },
    { text: '', type: 'response' },
    { text: '  contract list', type: 'highlight' },
    { text: '    View open contracts', type: 'response' },
    { text: '', type: 'response' },
    { text: '  contract create <type> <amount> <split> <description>', type: 'highlight' },
    { text: '    Post a new contract (types: heist, crime, territory)', type: 'response' },
    { text: '    Split is % that goes to executor (50-90)', type: 'response' },
    { text: '', type: 'response' },
    { text: '  contract accept <id>', type: 'highlight' },
    { text: '    Accept and take on a contract', type: 'response' },
    { text: '', type: 'response' },
    { text: '  contract my', type: 'highlight' },
    { text: '    View your contracts (funded and accepted)', type: 'response' },
    { text: '', type: 'response' },
    { text: '  contract cancel <id>', type: 'highlight' },
    { text: '    Cancel your open contract (refund)', type: 'response' },
  ]

  output.forEach(line => terminal.addLine(line.text, line.type))
}

/**
 * Handle contract list command
 */
async function handleContractList(terminal) {
  terminal.addLine('  Loading open contracts...', 'system')

  try {
    const result = await territoryService.getOpenContracts()

    if (!result.success) {
      terminal.addLine(`  ${result.error}`, 'error')
      return
    }

    const contracts = result.data

    terminal.addLine('', 'response')
    terminal.addLine('  Open Contracts', 'system')
    terminal.addLine('  ' + '='.repeat(50), 'muted')

    if (contracts.length === 0) {
      terminal.addLine('  No open contracts', 'muted')
      terminal.addLine('  Use: contract create <type> <amount> <split> <desc>', 'response')
      return
    }

    for (const contract of contracts) {
      const hoursLeft = Math.floor(contract.timeRemainingMs / 3600000)
      terminal.addLine('', 'response')
      terminal.addLine(`  [${contract.id.slice(0, 8)}] ${contract.targetType.toUpperCase()}`, 'highlight')
      terminal.addLine(`     "${contract.targetDescription}"`, 'response')
      terminal.addLine(`     Funded: ${formatMoney(contract.fundedAmount)}  Split: ${contract.executorSplitPercent}%`, 'response')
      terminal.addLine(`     Posted by: ${contract.funderUsername}  Expires: ${hoursLeft}h`, 'muted')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle contract create command
 */
async function handleContractCreate(args, terminal) {
  if (args.length < 4) {
    terminal.addLine('  Usage: contract create <type> <amount> <split> <description>', 'error')
    terminal.addLine('  Example: contract create heist 10000 70 Hit the downtown vault', 'muted')
    return
  }

  const [type, amountStr, splitStr, ...descParts] = args
  const amount = parseInt(amountStr.replace(/[,$]/g, ''))
  const split = parseInt(splitStr)
  const description = descParts.join(' ')

  if (isNaN(amount) || amount <= 0) {
    terminal.addLine('  Invalid amount', 'error')
    return
  }

  if (isNaN(split) || split < 50 || split > 90) {
    terminal.addLine('  Split must be 50-90%', 'error')
    return
  }

  const validTypes = ['heist', 'crime', 'territory']
  if (!validTypes.includes(type.toLowerCase())) {
    terminal.addLine(`  Invalid type. Must be: ${validTypes.join(', ')}`, 'error')
    return
  }

  terminal.addLine(`  Creating contract...`, 'system')

  try {
    const result = await territoryService.createContract(type.toLowerCase(), description, amount, split)

    if (result.success) {
      terminal.addLine('', 'response')
      terminal.addLine('  Contract posted!', 'success')
      terminal.addLine(`  ID: ${result.data.contractId.slice(0, 8)}`, 'highlight')
      terminal.addLine(`  Funded: ${formatMoney(amount)}`, 'response')
      terminal.addLine(`  Executor gets: ${split}% of payout + funding`, 'response')
    } else {
      terminal.addLine(`  ${result.error}`, 'error')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle contract accept command
 */
async function handleContractAccept(args, terminal) {
  if (args.length === 0) {
    terminal.addLine('  Usage: contract accept <id>', 'error')
    return
  }

  const contractId = args[0]
  terminal.addLine(`  Accepting contract...`, 'system')

  try {
    const result = await territoryService.acceptContract(contractId)

    if (result.success) {
      terminal.addLine('', 'response')
      terminal.addLine('  Contract accepted!', 'success')
      terminal.addLine('  Complete the task to earn your payout.', 'response')
    } else {
      terminal.addLine(`  ${result.error}`, 'error')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle my contracts command
 */
async function handleMyContracts(terminal) {
  terminal.addLine('  Loading your contracts...', 'system')

  try {
    const result = await territoryService.getMyContracts()

    if (!result.success) {
      terminal.addLine(`  ${result.error}`, 'error')
      return
    }

    const contracts = result.data

    terminal.addLine('', 'response')
    terminal.addLine('  Your Contracts', 'system')
    terminal.addLine('  ' + '='.repeat(45), 'muted')

    if (contracts.length === 0) {
      terminal.addLine('  No contracts', 'muted')
      return
    }

    for (const contract of contracts) {
      const statusColor = {
        'open': 'highlight',
        'accepted': 'warning',
        'completed': 'success',
        'failed': 'error',
        'cancelled': 'muted'
      }[contract.status] || 'response'

      terminal.addLine('', 'response')
      terminal.addLine(`  [${contract.id.slice(0, 8)}] ${contract.status.toUpperCase()}`, statusColor)
      terminal.addLine(`     "${contract.targetDescription}"`, 'response')
      terminal.addLine(`     Funded: ${formatMoney(contract.fundedAmount)}  Split: ${contract.executorSplitPercent}%`, 'response')

      if (contract.status === 'completed') {
        terminal.addLine(`     Your payout: ${formatMoney(contract.executorPayout || contract.funderPayout)}`, 'success')
      }
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle contract cancel command
 */
async function handleContractCancel(args, terminal) {
  if (args.length === 0) {
    terminal.addLine('  Usage: contract cancel <id>', 'error')
    return
  }

  const contractId = args[0]
  terminal.addLine(`  Cancelling contract...`, 'system')

  try {
    const result = await territoryService.cancelContract(contractId)

    if (result.success) {
      terminal.addLine('', 'response')
      terminal.addLine('  Contract cancelled', 'success')
      terminal.addLine(`  Refunded: ${formatMoney(result.data.refundAmount)}`, 'highlight')
    } else {
      terminal.addLine(`  ${result.error}`, 'error')
    }
  } catch (error) {
    terminal.addLine(`  Error: ${error.message}`, 'error')
  }
}

/**
 * Handle viewing a specific contract
 */
async function handleContractView(contractId, terminal) {
  terminal.addLine(`  Contract viewing not yet implemented`, 'muted')
  terminal.addLine(`  Use 'contract list' to see open contracts`, 'response')
}

export default registerTerritoryCommands
