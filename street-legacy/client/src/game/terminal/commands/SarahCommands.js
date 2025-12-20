/**
 * SarahCommands - Terminal command integration for S.A.R.A.H.
 * Street Autonomous Response & Assistance Hub
 *
 * Registers commands to interact with S.A.R.A.H. AI assistant.
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { sarahManager } from '../../sarah'

/**
 * Register all S.A.R.A.H.-related commands
 */
export function registerSarahCommands() {
  console.log('[SarahCommands] Registering S.A.R.A.H. commands...')

  // Main ask command
  commandRegistry.register({
    name: 'ask',
    aliases: ['sarah', 'ai', 's'],
    handler: async ({ args, terminal }) => {
      // Initialize S.A.R.A.H. if needed
      if (!sarahManager.isInitialized) {
        sarahManager.initialize()
      }

      // If no query, show greeting
      if (args.length === 0) {
        return sarahManager.getGreeting()
      }

      // Process the query
      const query = args.join(' ')
      return sarahManager.processQuery(query)
    },
    help: 'Ask S.A.R.A.H. for advice or information',
    usage: 'ask <question>',
    category: CATEGORIES.INFO,
    minLevel: 1,
    getSuggestions: (args) => {
      // Suggest common question starters
      if (args.length === 0 || args[0].length < 3) {
        return [
          'what crime should I do?',
          'how do I reduce heat?',
          'how am I doing?',
          'help',
        ]
      }
      return []
    },
  })

  // Quick advice command
  commandRegistry.register({
    name: 'advice',
    aliases: ['tip'],
    handler: async ({ terminal }) => {
      // Initialize S.A.R.A.H. if needed
      if (!sarahManager.isInitialized) {
        sarahManager.initialize()
      }

      return sarahManager.getQuickAdvice()
    },
    help: 'Get quick strategic advice based on your current state',
    usage: 'advice',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // S.A.R.A.H. help command
  commandRegistry.register({
    name: 'askhelp',
    aliases: ['sarahhelp', 'aihelp'],
    handler: async ({ terminal }) => {
      // Initialize S.A.R.A.H. if needed
      if (!sarahManager.isInitialized) {
        sarahManager.initialize()
      }

      return sarahManager.getHelp()
    },
    help: 'See what S.A.R.A.H. can help with',
    usage: 'askhelp',
    category: CATEGORIES.INFO,
    minLevel: 1,
    hidden: true, // Hidden since 'ask help' works too
  })

  // Debug command (hidden)
  commandRegistry.register({
    name: 'sarahdebug',
    aliases: [],
    handler: async ({ args, terminal }) => {
      if (!sarahManager.isInitialized) {
        sarahManager.initialize()
      }

      const subcommand = args[0]?.toLowerCase()

      switch (subcommand) {
        case 'on':
          sarahManager.setDebugMode(true)
          return { output: '[S.A.R.A.H.] Debug mode enabled', type: 'system' }

        case 'off':
          sarahManager.setDebugMode(false)
          return { output: '[S.A.R.A.H.] Debug mode disabled', type: 'system' }

        case 'status':
          const status = sarahManager.getStatus()
          return {
            output: [
              ':: S.A.R.A.H. STATUS',
              `Initialized: ${status.initialized}`,
              `Context length: ${status.contextLength}`,
              `Proactive: ${status.proactiveStatus.isInitialized}`,
              `Personality: ${status.personality.name} v${status.personality.version}`,
            ],
            type: 'system',
          }

        case 'check':
          sarahManager.forceProactiveCheck()
          return { output: '[S.A.R.A.H.] Forced proactive check', type: 'system' }

        case 'clear':
          sarahManager.clearContext()
          return { output: '[S.A.R.A.H.] Context cleared', type: 'system' }

        default:
          return {
            output: [
              ':: S.A.R.A.H. DEBUG COMMANDS',
              'sarahdebug on     - Enable debug logging',
              'sarahdebug off    - Disable debug logging',
              'sarahdebug status - Show system status',
              'sarahdebug check  - Force proactive check',
              'sarahdebug clear  - Clear conversation context',
            ],
            type: 'system',
          }
      }
    },
    help: 'S.A.R.A.H. debug commands',
    usage: 'sarahdebug <on|off|status|check|clear>',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
    hidden: true, // Hidden debug command
  })

  console.log('[SarahCommands] S.A.R.A.H. commands registered')
}

export default registerSarahCommands
