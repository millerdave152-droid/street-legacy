/**
 * CrewCommands - Terminal commands for crew management
 *
 * Commands:
 * - crew: View your crew
 * - deploy: Send crew on missions
 * - recall: Recall crew from missions
 * - missions: View active missions
 * - talk: Converse with crew members
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { gameManager } from '../../GameManager'
import { crewMissionManager, MISSION_TYPES } from '../../managers/CrewMissionManager'
import { crewBonusManager } from '../../managers/CrewBonusManager'

// Crew role display info
const ROLE_DISPLAY = {
  enforcer: { icon: '[E]', name: 'Enforcer', color: 'handler' },
  hacker: { icon: '[H]', name: 'Hacker', color: 'success' },
  driver: { icon: '[D]', name: 'Driver', color: 'warning' },
  lookout: { icon: '[L]', name: 'Lookout', color: 'system' },
  muscle: { icon: '[M]', name: 'Muscle', color: 'error' },
  insider: { icon: '[I]', name: 'Insider', color: 'sarah' }
}

// Crew conversation responses based on loyalty
const CREW_RESPONSES = {
  high: [
    "Ready for anything, boss.",
    "What do you need?",
    "I got your back.",
    "Let's make some money.",
    "Name it, it's done."
  ],
  medium: [
    "Yeah, what's up?",
    "I'm listening.",
    "What do you want?",
    "Something on your mind?",
    "Go ahead."
  ],
  low: [
    "What do you want now?",
    "Make it quick.",
    "This better be good.",
    "Ugh, what?",
    "I'm busy."
  ]
}

/**
 * Register crew commands
 */
export function registerCrewCommands() {
  // Initialize mission manager
  crewMissionManager.initialize()
  crewBonusManager.initialize()

  // ============================================================
  // CREW command - View your crew
  // ============================================================
  commandRegistry.register({
    name: 'crew',
    aliases: ['team', 'gang', 'members'],
    handler: async ({ args }) => {
      const player = gameManager.player

      // Handle 'crew profile' subcommand
      if (args.length > 0 && args[0].toLowerCase() === 'profile') {
        return showCrewProfile(player)
      }

      if (!player || !player.crew || player.crew.length === 0) {
        return {
          output: [
            { text: ':: NO CREW ::', type: 'system' },
            { text: '', type: 'response' },
            { text: '  You have no crew members yet.', type: 'response' },
            { text: '  Visit the Crew scene to hire members.', type: 'system' },
            { text: '  Type "go crew" to access crew management.', type: 'response' },
          ]
        }
      }

      // If specific member requested
      if (args.length > 0) {
        const name = args.join(' ').toLowerCase()
        const member = player.crew.find(m => m.name.toLowerCase().includes(name))
        if (member) {
          return showCrewMemberDetails(member)
        }
        return { error: true, message: `Crew member "${args.join(' ')}" not found.` }
      }

      // Show all crew
      const output = [
        { text: ':: YOUR CREW ::', type: 'system' },
        { text: '', type: 'response' },
      ]

      // Get synergy info
      const synergy = crewBonusManager.getCrewSynergy()

      player.crew.forEach((member, index) => {
        const role = ROLE_DISPLAY[member.role] || { icon: '[?]', name: 'Unknown' }
        const loyaltyStatus = member.loyalty >= 70 ? 'Loyal' :
          member.loyalty >= 40 ? 'Neutral' : 'At Risk'
        const loyaltyType = member.loyalty >= 70 ? 'success' :
          member.loyalty >= 40 ? 'response' : 'error'

        // Check if on mission
        const missions = crewMissionManager.getActiveMissions()
        const onMission = missions.find(m => m.memberId === member.id)

        output.push({
          text: `  ${index + 1}. ${role.icon} ${member.name} - ${role.name}`,
          type: 'handler'
        })
        output.push({
          text: `     Skill: ${member.skill || 50}% | Loyalty: ${member.loyalty || 50}% (${loyaltyStatus})`,
          type: loyaltyType
        })

        if (onMission) {
          const remaining = crewMissionManager.formatTime(onMission.remaining)
          output.push({
            text: `     [ON MISSION: ${onMission.config.name} - ${remaining} remaining]`,
            type: 'warning'
          })
        }
      })

      output.push({ text: '', type: 'response' })
      output.push({
        text: `  Synergy: ${synergy.description} (+${synergy.bonus}% bonus)`,
        type: synergy.level >= 3 ? 'success' : 'system'
      })
      output.push({ text: '', type: 'response' })
      output.push({ text: '  Commands:', type: 'system' })
      output.push({ text: '    crew profile    - View crew profile & stats', type: 'response' })
      output.push({ text: '    crew <name>     - View member details', type: 'response' })
      output.push({ text: '    deploy <name> <mission> - Send on mission', type: 'response' })
      output.push({ text: '    talk <name>     - Talk to crew member', type: 'response' })

      return { output }
    },
    help: 'View your crew members or crew profile',
    usage: 'crew [profile | member_name]',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // ============================================================
  // DEPLOY command - Send crew on missions
  // ============================================================
  commandRegistry.register({
    name: 'deploy',
    aliases: ['send', 'assign', 'mission'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        return showDeployHelp()
      }

      // Parse arguments: deploy <name> <mission_type>
      const missionTypes = Object.keys(MISSION_TYPES).map(k => k.toLowerCase())
      let memberName = []
      let missionType = null

      // Find mission type in args
      for (let i = 0; i < args.length; i++) {
        const arg = args[i].toLowerCase()
        if (missionTypes.includes(arg)) {
          missionType = arg
          memberName = args.slice(0, i)
          break
        }
      }

      // If no mission type found, assume last arg might be partial
      if (!missionType) {
        memberName = args.slice(0, -1)
        const lastArg = args[args.length - 1].toLowerCase()

        // Try to match partial mission type
        const match = missionTypes.find(t => t.startsWith(lastArg))
        if (match) {
          missionType = match
        } else if (args.length === 1) {
          // Just member name, show available missions for them
          return showMissionsForMember(args[0])
        } else {
          return { error: true, message: `Unknown mission type. Valid: ${missionTypes.join(', ')}` }
        }
      }

      if (memberName.length === 0) {
        return { error: true, message: 'Please specify a crew member name.' }
      }

      const result = crewMissionManager.deployMember(memberName.join(' '), missionType)

      if (result.success) {
        return {
          output: [
            { text: ':: MISSION DEPLOYED ::', type: 'system' },
            { text: '', type: 'response' },
            { text: `  ${result.message}`, type: 'success' },
            { text: '', type: 'response' },
            { text: '  Type "missions" to track progress.', type: 'system' },
          ]
        }
      } else {
        return { error: true, message: result.error }
      }
    },
    help: 'Send a crew member on an autonomous mission',
    usage: 'deploy <member_name> <mission_type>',
    examples: ['deploy Marcus hustle', 'deploy Nina scout'],
    category: CATEGORIES.ACTION,
    minLevel: 1,
  })

  // ============================================================
  // RECALL command - Recall crew from missions
  // ============================================================
  commandRegistry.register({
    name: 'recall',
    aliases: ['abort', 'cancel'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        const missions = crewMissionManager.getActiveMissions()
        if (missions.length === 0) {
          return { error: true, message: 'No active missions to recall from.' }
        }

        const output = [
          { text: ':: ACTIVE MISSIONS ::', type: 'system' },
          { text: '', type: 'response' },
        ]

        missions.forEach(m => {
          output.push({
            text: `  ${m.memberName}: ${m.config.name} (${crewMissionManager.formatTime(m.remaining)} left)`,
            type: 'response'
          })
        })

        output.push({ text: '', type: 'response' })
        output.push({ text: '  Usage: recall <member_name>', type: 'system' })
        output.push({ text: '  Warning: Early recall costs loyalty!', type: 'warning' })

        return { output }
      }

      const memberName = args.join(' ')
      const result = crewMissionManager.recallMember(memberName)

      if (result.success) {
        return {
          output: [
            { text: ':: MISSION RECALLED ::', type: 'warning' },
            { text: '', type: 'response' },
            { text: `  ${result.message}`, type: 'response' },
          ]
        }
      } else {
        return { error: true, message: result.error }
      }
    },
    help: 'Recall a crew member from their mission early',
    usage: 'recall <member_name>',
    category: CATEGORIES.ACTION,
    minLevel: 1,
  })

  // ============================================================
  // MISSIONS command - View active missions
  // ============================================================
  commandRegistry.register({
    name: 'missions',
    aliases: ['active', 'deployed'],
    handler: async () => {
      const missions = crewMissionManager.getActiveMissions()

      if (missions.length === 0) {
        return {
          output: [
            { text: ':: NO ACTIVE MISSIONS ::', type: 'system' },
            { text: '', type: 'response' },
            { text: '  No crew members currently deployed.', type: 'response' },
            { text: '  Use "deploy <name> <mission>" to send someone.', type: 'system' },
          ]
        }
      }

      const output = [
        { text: ':: ACTIVE MISSIONS ::', type: 'system' },
        { text: '', type: 'response' },
      ]

      missions.forEach((mission, index) => {
        const progress = Math.round(mission.progress * 100)
        const progressBar = createProgressBar(progress)
        const remaining = crewMissionManager.formatTime(mission.remaining)

        output.push({
          text: `  ${index + 1}. ${mission.memberName}`,
          type: 'handler'
        })
        output.push({
          text: `     ${mission.config.name}`,
          type: 'response'
        })
        output.push({
          text: `     ${progressBar} ${progress}%`,
          type: progress >= 75 ? 'success' : 'response'
        })
        output.push({
          text: `     ETA: ${remaining}`,
          type: 'system'
        })
        output.push({ text: '', type: 'response' })
      })

      output.push({ text: '  Type "recall <name>" to abort early.', type: 'system' })

      return { output }
    },
    help: 'View active crew missions and progress',
    usage: 'missions',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // ============================================================
  // TALK command - Converse with crew members
  // ============================================================
  commandRegistry.register({
    name: 'talk',
    aliases: ['chat', 'speak'],
    handler: async ({ args }) => {
      const player = gameManager.player
      if (!player || !player.crew || player.crew.length === 0) {
        return { error: true, message: 'You have no crew to talk to.' }
      }

      if (args.length === 0) {
        const output = [
          { text: ':: CREW MEMBERS ::', type: 'system' },
          { text: '', type: 'response' },
        ]

        player.crew.forEach(member => {
          const role = ROLE_DISPLAY[member.role] || { icon: '[?]' }
          output.push({
            text: `  ${role.icon} ${member.name}`,
            type: 'response'
          })
        })

        output.push({ text: '', type: 'response' })
        output.push({ text: '  Usage: talk <name>', type: 'system' })

        return { output }
      }

      const name = args.join(' ').toLowerCase()
      const member = player.crew.find(m => m.name.toLowerCase().includes(name))

      if (!member) {
        return { error: true, message: `Crew member "${args.join(' ')}" not found.` }
      }

      return generateConversation(member)
    },
    help: 'Talk to a crew member',
    usage: 'talk <member_name>',
    category: CATEGORIES.SOCIAL,
    minLevel: 1,
  })

  console.log('[CrewCommands] Registered crew commands')
}

/**
 * Show details for a specific crew member
 */
function showCrewMemberDetails(member) {
  const role = ROLE_DISPLAY[member.role] || { icon: '[?]', name: 'Unknown', color: 'response' }
  const loyaltyBar = createProgressBar(member.loyalty || 50)
  const skillBar = createProgressBar(member.skill || 50)

  const output = [
    { text: `:: ${member.name.toUpperCase()} ::`, type: 'system' },
    { text: '', type: 'response' },
    { text: `  Role: ${role.icon} ${role.name}`, type: role.color },
    { text: '', type: 'response' },
    { text: `  Skill:   ${skillBar} ${member.skill || 50}%`, type: 'response' },
    { text: `  Loyalty: ${loyaltyBar} ${member.loyalty || 50}%`, type: member.loyalty >= 50 ? 'success' : 'warning' },
    { text: '', type: 'response' },
  ]

  // Check mission status
  const missions = crewMissionManager.getActiveMissions()
  const onMission = missions.find(m => m.memberId === member.id)

  if (onMission) {
    output.push({
      text: `  Status: ON MISSION`,
      type: 'warning'
    })
    output.push({
      text: `  ${onMission.config.name} - ${crewMissionManager.formatTime(onMission.remaining)} remaining`,
      type: 'response'
    })
  } else {
    output.push({
      text: `  Status: AVAILABLE`,
      type: 'success'
    })
  }

  output.push({ text: '', type: 'response' })
  output.push({ text: '  Commands:', type: 'system' })
  output.push({ text: `    talk ${member.name} - Start conversation`, type: 'response' })
  output.push({ text: `    deploy ${member.name} <mission> - Send on mission`, type: 'response' })

  return { output }
}

/**
 * Show deploy help with available missions
 */
function showDeployHelp() {
  const missionTypes = crewMissionManager.getMissionTypes()

  const output = [
    { text: ':: AVAILABLE MISSIONS ::', type: 'system' },
    { text: '', type: 'response' },
  ]

  missionTypes.forEach(mission => {
    const duration = crewMissionManager.formatTime(mission.duration)
    output.push({
      text: `  ${mission.icon} ${mission.type.toUpperCase()}`,
      type: 'handler'
    })
    output.push({
      text: `     ${mission.description}`,
      type: 'response'
    })
    output.push({
      text: `     Duration: ${duration} | Min Skill: ${mission.minSkill}%`,
      type: 'system'
    })
    output.push({ text: '', type: 'response' })
  })

  output.push({ text: '  Usage: deploy <member_name> <mission_type>', type: 'system' })
  output.push({ text: '  Example: deploy Marcus hustle', type: 'response' })

  return { output }
}

/**
 * Show available missions for a specific member
 */
function showMissionsForMember(memberName) {
  const player = gameManager.player
  if (!player || !player.crew) {
    return { error: true, message: 'No crew available.' }
  }

  const member = player.crew.find(m => m.name.toLowerCase().includes(memberName.toLowerCase()))
  if (!member) {
    return { error: true, message: `Crew member "${memberName}" not found.` }
  }

  const canDeploy = crewMissionManager.canDeploy(member)
  if (!canDeploy.can) {
    return { error: true, message: canDeploy.reason }
  }

  const missionTypes = crewMissionManager.getMissionTypes()
  const output = [
    { text: `:: MISSIONS FOR ${member.name.toUpperCase()} ::`, type: 'system' },
    { text: `  Skill: ${member.skill || 50}%`, type: 'response' },
    { text: '', type: 'response' },
  ]

  missionTypes.forEach(mission => {
    const canDo = (member.skill || 50) >= mission.minSkill
    output.push({
      text: `  ${mission.type.toUpperCase()} - ${mission.name}`,
      type: canDo ? 'success' : 'response'
    })
    if (!canDo) {
      output.push({
        text: `     [Requires ${mission.minSkill}% skill]`,
        type: 'error'
      })
    }
  })

  output.push({ text: '', type: 'response' })
  output.push({ text: `  Usage: deploy ${member.name} <mission>`, type: 'system' })

  return { output }
}

/**
 * Generate conversation with crew member
 */
function generateConversation(member) {
  const loyalty = member.loyalty || 50
  const responsePool = loyalty >= 70 ? CREW_RESPONSES.high :
    loyalty >= 40 ? CREW_RESPONSES.medium : CREW_RESPONSES.low

  const greeting = responsePool[Math.floor(Math.random() * responsePool.length)]
  const role = ROLE_DISPLAY[member.role] || { icon: '[?]' }

  const output = [
    { text: `:: CONVERSATION WITH ${member.name.toUpperCase()} ::`, type: 'system' },
    { text: '', type: 'response' },
    { text: `  ${role.icon} ${member.name}: "${greeting}"`, type: 'handler' },
    { text: '', type: 'response' },
  ]

  // Add context-specific dialogue
  if (loyalty < 30) {
    output.push({
      text: `  [${member.name} seems unhappy. Consider giving them better missions or training.]`,
      type: 'warning'
    })
  } else if (loyalty >= 80) {
    output.push({
      text: `  [${member.name} is very loyal. They might share valuable intel.]`,
      type: 'success'
    })

    // Chance for intel
    if (Math.random() < 0.3) {
      output.push({ text: '', type: 'response' })
      output.push({
        text: `  ${role.icon} ${member.name}: "Word on the street is there's a big opportunity coming up..."`,
        type: 'sarah'
      })
    }
  }

  // Check if on mission
  const missions = crewMissionManager.getActiveMissions()
  const onMission = missions.find(m => m.memberId === member.id)

  if (onMission) {
    output.push({ text: '', type: 'response' })
    output.push({
      text: `  [Currently on ${onMission.config.name} - ${Math.round(onMission.progress * 100)}% complete]`,
      type: 'system'
    })
  }

  return { output }
}

/**
 * Create ASCII progress bar
 */
function createProgressBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return '[' + '='.repeat(filled) + '-'.repeat(empty) + ']'
}

/**
 * Format money with commas
 */
function formatMoney(amount) {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return `$${amount.toLocaleString()}`
}

/**
 * Show crew profile with identity and stats
 */
function showCrewProfile(player) {
  if (!player) {
    return { error: true, message: 'Player data not available.' }
  }

  // Get crew data - could be player's personal crew or a formal crew
  const crewName = player.crew_name || player.crewName || 'Your Crew'
  const crewTag = player.crew_tag || player.crewTag || null
  const crewMembers = player.crew || []

  const output = [
    { text: '╔══════════════════════════════════════════╗', type: 'system' },
    { text: '║           CREW PROFILE                   ║', type: 'system' },
    { text: '╚══════════════════════════════════════════╝', type: 'system' },
    { text: '', type: 'response' },
  ]

  // Crew Identity
  const displayName = crewTag ? `[${crewTag}] ${crewName}` : crewName
  output.push({ text: `  ${displayName}`, type: 'handler' })
  output.push({ text: '', type: 'response' })

  // Stats section
  output.push({ text: '  ─── STATS ───', type: 'system' })

  // Member count
  const memberCount = crewMembers.length
  output.push({
    text: `  Members: ${memberCount}`,
    type: 'response'
  })

  // Calculate net worth (player cash + bank + crew value)
  const playerCash = player.cash || 0
  const playerBank = player.bank || player.bankBalance || 0
  const crewValue = crewMembers.reduce((sum, m) => {
    // Estimate crew member value based on skill and loyalty
    const skill = m.skill || 50
    const loyalty = m.loyalty || 50
    return sum + Math.round((skill + loyalty) * 100)
  }, 0)
  const totalNetWorth = playerCash + playerBank + crewValue

  output.push({
    text: `  Net Worth: ${formatMoney(totalNetWorth)}`,
    type: 'success'
  })
  output.push({
    text: `    Cash: ${formatMoney(playerCash)} | Bank: ${formatMoney(playerBank)}`,
    type: 'response'
  })

  // Best heist (from player stats if available)
  const bestHeist = player.best_heist_payout || player.bestHeistPayout || 0
  const bestHeistName = player.best_heist_name || player.bestHeistName || 'N/A'
  if (bestHeist > 0) {
    output.push({ text: '', type: 'response' })
    output.push({ text: '  ─── BEST HEIST ───', type: 'system' })
    output.push({
      text: `  ${formatMoney(bestHeist)} - ${bestHeistName}`,
      type: 'warning'
    })
  }

  // Crew roster
  if (crewMembers.length > 0) {
    output.push({ text: '', type: 'response' })
    output.push({ text: '  ─── ROSTER ───', type: 'system' })

    crewMembers.forEach(member => {
      const role = ROLE_DISPLAY[member.role] || { icon: '[?]', name: 'Unknown' }
      const skill = member.skill || 50
      const loyalty = member.loyalty || 50
      const avgStat = Math.round((skill + loyalty) / 2)

      // Color based on average stats
      const statType = avgStat >= 70 ? 'success' : avgStat >= 40 ? 'response' : 'warning'

      output.push({
        text: `  ${role.icon} ${member.name.padEnd(12)} Skill: ${skill}% | Loyalty: ${loyalty}%`,
        type: statType
      })
    })
  } else {
    output.push({ text: '', type: 'response' })
    output.push({
      text: '  No crew members yet. Type "go crew" to hire.',
      type: 'system'
    })
  }

  // Get synergy bonus if available
  if (crewMembers.length > 0) {
    const synergy = crewBonusManager.getCrewSynergy()
    output.push({ text: '', type: 'response' })
    output.push({
      text: `  Synergy: ${synergy.description} (+${synergy.bonus}% bonus)`,
      type: synergy.level >= 3 ? 'success' : 'system'
    })
  }

  output.push({ text: '', type: 'response' })
  output.push({ text: '╔══════════════════════════════════════════╗', type: 'system' })

  return { output }
}

export default registerCrewCommands
