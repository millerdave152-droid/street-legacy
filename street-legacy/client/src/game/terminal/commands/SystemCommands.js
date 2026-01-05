/**
 * SystemCommands - System and utility commands
 * clear, settings, mute, logout, tutorial
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { audioManager } from '../../managers/AudioManager'
import { gameManager } from '../../GameManager'

// Tutorial state for interactive walkthrough
const tutorialState = {
  active: false,
  step: 0,
  completedSteps: new Set()
}

/**
 * Register all system commands
 */
export function registerSystemCommands() {
  // DEBUG TEST command - remove after debugging
  commandRegistry.register({
    name: 'test',
    aliases: ['t'],
    handler: async () => {
      console.log('[SystemCommands] TEST command executed!')
      return {
        output: [
          { text: ':: TEST COMMAND WORKING ::', type: 'system' },
          { text: '  If you see this, commands are working!', type: 'success' },
          { text: '  The issue is elsewhere.', type: 'response' },
        ]
      }
    },
    help: 'Test command',
    usage: 'test',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // CLEAR command
  commandRegistry.register({
    name: 'clear',
    aliases: ['cls', 'clr'],
    handler: async ({ terminal }) => {
      terminal.clearOutput()
      return null // No additional output
    },
    help: 'Clear terminal output',
    usage: 'clear',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // SETTINGS command
  commandRegistry.register({
    name: 'settings',
    aliases: ['config', 'cfg', 'options'],
    handler: async ({ terminal }) => {
      // Navigate to settings scene
      if (terminal.currentScene) {
        terminal.addSystemMessage('Opening settings...')
        terminal.currentScene.scene.launch('SettingsScene')
        return null
      }
      return { error: true, message: 'Cannot access settings from here' }
    },
    help: 'Open settings menu',
    usage: 'settings',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // MUTE command
  commandRegistry.register({
    name: 'mute',
    aliases: ['quiet', 'silent'],
    handler: async ({ terminal }) => {
      if (audioManager) {
        audioManager.setMasterVolume(0)
        return { output: '  Audio muted', type: 'success' }
      }
      return { output: '  Audio system not available', type: 'warning' }
    },
    help: 'Mute all audio',
    usage: 'mute',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // UNMUTE command
  commandRegistry.register({
    name: 'unmute',
    aliases: ['sound', 'audio'],
    handler: async ({ terminal }) => {
      if (audioManager) {
        audioManager.setMasterVolume(1)
        return { output: '  Audio unmuted', type: 'success' }
      }
      return { output: '  Audio system not available', type: 'warning' }
    },
    help: 'Unmute audio',
    usage: 'unmute',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // LOGOUT command
  commandRegistry.register({
    name: 'logout',
    aliases: ['exit', 'quit', 'menu'],
    handler: async ({ terminal }) => {
      terminal.addSystemMessage('Logging out...')

      // Short delay for effect
      await new Promise(resolve => setTimeout(resolve, 500))

      if (terminal.currentScene) {
        // Stop all scenes and go to main menu
        terminal.currentScene.scene.stop('GameScene')
        terminal.currentScene.scene.stop('UIScene')
        terminal.currentScene.scene.start('MainMenuScene')
        return null
      }
      return { error: true, message: 'Cannot logout from here' }
    },
    help: 'Return to main menu',
    usage: 'logout',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // ECHO command (for fun/testing)
  commandRegistry.register({
    name: 'echo',
    aliases: ['say', 'print'],
    handler: async ({ args }) => {
      if (args.length === 0) {
        return { output: '' }
      }
      return { output: `  ${args.join(' ')}` }
    },
    help: 'Echo text back',
    usage: 'echo <text>',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
    hidden: true,
  })

  // PING command (network test)
  commandRegistry.register({
    name: 'ping',
    handler: async ({ terminal }) => {
      terminal.addOutput('  Pinging THE NETWORK...', 'response')

      // Simulate network latency
      const latency = Math.floor(Math.random() * 50) + 10

      await new Promise(resolve => setTimeout(resolve, latency))

      return {
        output: [
          { text: `  Reply from NETWORK: ${latency}ms`, type: 'success' },
          { text: '  Connection: SECURE', type: 'success' },
        ]
      }
    },
    help: 'Test network connection',
    usage: 'ping',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
    hidden: true,
  })

  // TIMESTAMPS command - Toggle timestamp display
  commandRegistry.register({
    name: 'timestamps',
    aliases: ['ts', 'time-stamps'],
    handler: async ({ args, terminal }) => {
      if (args.length === 0) {
        // Toggle
        const enabled = terminal.toggleTimestamps()
        return {
          output: [
            { text: `:: Timestamps ${enabled ? 'enabled' : 'disabled'}`, type: 'system' },
            { text: `  Use "timestamps on/off" to set explicitly.`, type: 'response' },
          ]
        }
      }

      const arg = args[0].toLowerCase()
      if (arg === 'on' || arg === 'enable' || arg === 'true' || arg === '1') {
        terminal.toggleTimestamps(true)
        return { output: ':: Timestamps enabled' }
      } else if (arg === 'off' || arg === 'disable' || arg === 'false' || arg === '0') {
        terminal.toggleTimestamps(false)
        return { output: ':: Timestamps disabled' }
      } else {
        return { error: true, message: 'Usage: timestamps [on|off]' }
      }
    },
    help: 'Toggle timestamp display on console messages',
    usage: 'timestamps [on|off]',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // HISTORY command
  commandRegistry.register({
    name: 'history',
    aliases: ['hist'],
    handler: async ({ args, terminal }) => {
      const count = parseInt(args[0]) || 10
      const history = terminal.commandHistory.slice(0, count)

      if (history.length === 0) {
        return { output: '  No command history' }
      }

      const output = [{ text: '  Recent commands:', type: 'system' }]
      history.forEach((cmd, i) => {
        output.push({ text: `  ${i + 1}. ${cmd}`, type: 'response' })
      })

      return { output }
    },
    help: 'Show command history',
    usage: 'history [count]',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // TUTORIAL command - Interactive onboarding
  commandRegistry.register({
    name: 'tutorial',
    aliases: ['tut', 'learn', 'guide', 'onboard'],
    handler: async ({ args, terminal }) => {
      const subcommand = (args[0] || 'start').toLowerCase()

      // Tutorial steps
      const steps = [
        {
          title: 'Welcome to THE CONSOLE',
          content: [
            { text: ':: TUTORIAL - Step 1/8: Welcome', type: 'system' },
            { text: '', type: 'response' },
            { text: '  Welcome to Street Legacy!', type: 'success' },
            { text: '  You\'re about to enter Toronto\'s criminal underworld.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  This terminal is your command center.', type: 'response' },
            { text: '  Type commands to navigate, commit crimes,', type: 'response' },
            { text: '  manage money, and build your empire.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" to continue...', type: 'system' },
          ]
        },
        {
          title: 'Checking Your Status',
          content: [
            { text: ':: TUTORIAL - Step 2/8: Your Status', type: 'system' },
            { text: '', type: 'response' },
            { text: '  First, let\'s check your stats.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Try typing: status', type: 'success' },
            { text: '', type: 'response' },
            { text: '  This shows your cash, heat, energy, and XP.', type: 'response' },
            { text: '  You can also type "s" as a shortcut!', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" after trying it...', type: 'system' },
          ]
        },
        {
          title: 'Navigation',
          content: [
            { text: ':: TUTORIAL - Step 3/8: Getting Around', type: 'system' },
            { text: '', type: 'response' },
            { text: '  Navigate to different areas using "go".', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Try: go ops  (Operations Hub)', type: 'success' },
            { text: '  Or:  go trade  (Commerce Hub)', type: 'success' },
            { text: '', type: 'response' },
            { text: '  Type "go" alone to see all locations.', type: 'response' },
            { text: '  Use "back" or "home" to return.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Natural language works too:', type: 'response' },
            { text: '  "take me to ops" → goes to Operations Hub', type: 'warning' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" to continue...', type: 'system' },
          ]
        },
        {
          title: 'Making Money - Crimes',
          content: [
            { text: ':: TUTORIAL - Step 4/8: Committing Crimes', type: 'system' },
            { text: '', type: 'response' },
            { text: '  Crimes are your main income source.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Type: crime', type: 'success' },
            { text: '', type: 'response' },
            { text: '  This opens the crime menu where you', type: 'response' },
            { text: '  can pick pocket, mug, or more!', type: 'response' },
            { text: '', type: 'response' },
            { text: '  ⚠️ Crimes increase your HEAT level.', type: 'warning' },
            { text: '  Too much heat attracts police!', type: 'warning' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" to continue...', type: 'system' },
          ]
        },
        {
          title: 'Making Money - Jobs',
          content: [
            { text: ':: TUTORIAL - Step 5/8: Legitimate Work', type: 'system' },
            { text: '', type: 'response' },
            { text: '  Jobs are a safer income source.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Type: jobs', type: 'success' },
            { text: '', type: 'response' },
            { text: '  Jobs don\'t increase heat and are', type: 'response' },
            { text: '  great when you need to lay low.', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Less risky = smaller payouts though!', type: 'warning' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" to continue...', type: 'system' },
          ]
        },
        {
          title: 'Managing Money',
          content: [
            { text: ':: TUTORIAL - Step 6/8: Banking', type: 'system' },
            { text: '', type: 'response' },
            { text: '  Keep your money safe in the bank!', type: 'response' },
            { text: '', type: 'response' },
            { text: '  deposit 500  - Save $500 to bank', type: 'success' },
            { text: '  withdraw 500 - Get $500 from bank', type: 'success' },
            { text: '  balance      - Check all your money', type: 'success' },
            { text: '', type: 'response' },
            { text: '  Use "deposit all" to save everything.', type: 'response' },
            { text: '  Shorthand: "5k" = 5000, "1m" = 1000000', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" to continue...', type: 'system' },
          ]
        },
        {
          title: 'Getting Help',
          content: [
            { text: ':: TUTORIAL - Step 7/8: S.A.R.A.H. & Help', type: 'system' },
            { text: '', type: 'response' },
            { text: '  Need advice? Ask S.A.R.A.H.!', type: 'response' },
            { text: '', type: 'response' },
            { text: '  ask what crime should I do?', type: 'success' },
            { text: '  ask how do I reduce heat?', type: 'success' },
            { text: '  advice - Get quick strategic tips', type: 'success' },
            { text: '', type: 'response' },
            { text: '  For command help:', type: 'response' },
            { text: '  help - See all commands', type: 'success' },
            { text: '  help crime - Details on "crime"', type: 'success' },
            { text: '', type: 'response' },
            { text: '  Type "tutorial next" to continue...', type: 'system' },
          ]
        },
        {
          title: 'Tips & Tricks',
          content: [
            { text: ':: TUTORIAL - Step 8/8: Pro Tips', type: 'system' },
            { text: '', type: 'response' },
            { text: '  ⌨️  Keyboard Shortcuts:', type: 'success' },
            { text: '  Tab        - Autocomplete commands', type: 'response' },
            { text: '  ↑/↓ Arrows - Browse command history', type: 'response' },
            { text: '  PageUp/Dn  - Scroll console output', type: 'response' },
            { text: '', type: 'response' },
            { text: '  💡 Quick Commands:', type: 'success' },
            { text: '  s = status, h = help', type: 'response' },
            { text: '  clear = clean screen', type: 'response' },
            { text: '  scroll = view history', type: 'response' },
            { text: '', type: 'response' },
            { text: ':: TUTORIAL COMPLETE! 🎉', type: 'success' },
            { text: '  Here\'s $250 to get started!', type: 'success' },
            { text: '', type: 'response' },
            { text: '  Type "help" to see all commands.', type: 'system' },
          ],
          reward: true
        }
      ]

      switch (subcommand) {
        case 'start':
        case 'begin':
          tutorialState.active = true
          tutorialState.step = 0
          return { output: steps[0].content }

        case 'next':
        case 'continue':
        case 'n':
          if (!tutorialState.active) {
            return { error: true, message: 'No tutorial in progress. Type "tutorial" to start.' }
          }
          tutorialState.step++
          if (tutorialState.step >= steps.length) {
            tutorialState.active = false
            return { output: [{ text: ':: Tutorial already completed!', type: 'system' }] }
          }
          const nextStep = steps[tutorialState.step]
          // Award reward on last step
          if (nextStep.reward && gameManager.addCash) {
            gameManager.addCash(250)
          }
          return { output: nextStep.content }

        case 'skip':
        case 'stop':
        case 'exit':
          tutorialState.active = false
          return {
            output: [
              { text: ':: Tutorial skipped', type: 'system' },
              { text: '  Type "tutorial" anytime to restart.', type: 'response' },
            ]
          }

        case 'step':
          const stepNum = parseInt(args[1])
          if (isNaN(stepNum) || stepNum < 1 || stepNum > steps.length) {
            return { error: true, message: `Step must be 1-${steps.length}` }
          }
          tutorialState.active = true
          tutorialState.step = stepNum - 1
          return { output: steps[stepNum - 1].content }

        case 'status':
          return {
            output: [
              { text: ':: Tutorial Status', type: 'system' },
              { text: `  Active: ${tutorialState.active ? 'Yes' : 'No'}`, type: 'response' },
              { text: `  Step: ${tutorialState.step + 1}/${steps.length}`, type: 'response' },
            ]
          }

        default:
          // If first arg is a number, jump to that step
          const num = parseInt(subcommand)
          if (!isNaN(num) && num >= 1 && num <= steps.length) {
            tutorialState.active = true
            tutorialState.step = num - 1
            return { output: steps[num - 1].content }
          }

          // Otherwise start from beginning
          tutorialState.active = true
          tutorialState.step = 0
          return { output: steps[0].content }
      }
    },
    help: 'Start the interactive tutorial',
    usage: 'tutorial [next|skip|step N]',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  // SCROLL command - Navigate terminal output
  commandRegistry.register({
    name: 'scroll',
    aliases: ['sc'],
    handler: async ({ args, terminal }) => {
      if (args.length === 0) {
        const scrollInfo = terminal.getScrollInfo()
        return {
          output: [
            { text: '  Scroll Controls:', type: 'system' },
            { text: '', type: 'response' },
            { text: '  scroll up [n]     - Scroll up n lines (default 5)', type: 'response' },
            { text: '  scroll down [n]   - Scroll down n lines (default 5)', type: 'response' },
            { text: '  scroll top        - Jump to oldest message', type: 'response' },
            { text: '  scroll bottom     - Jump to newest message', type: 'response' },
            { text: '', type: 'response' },
            { text: '  Keyboard shortcuts:', type: 'system' },
            { text: '  PageUp/PageDown   - Scroll 5 lines', type: 'response' },
            { text: '  Ctrl+Home/End     - Jump to top/bottom', type: 'response' },
            { text: '  Mouse wheel       - Scroll in terminal area', type: 'response' },
            { text: '', type: 'response' },
            { text: `  Position: ${scrollInfo.offset} lines from bottom (${scrollInfo.total} total)`, type: 'system' },
          ]
        }
      }

      const direction = args[0].toLowerCase()
      const amount = parseInt(args[1]) || 5

      switch (direction) {
        case 'up':
        case 'u':
          terminal.scrollOutput(amount)
          return { output: `  Scrolled up ${amount} lines` }

        case 'down':
        case 'd':
          terminal.scrollOutput(-amount)
          return { output: `  Scrolled down ${amount} lines` }

        case 'top':
        case 't':
          terminal.scrollToTop()
          return { output: '  Jumped to top of output' }

        case 'bottom':
        case 'bot':
        case 'b':
          terminal.scrollToBottom()
          return { output: '  Jumped to bottom of output' }

        default:
          return { error: true, message: `Unknown scroll direction: ${direction}. Use up, down, top, or bottom.` }
      }
    },
    help: 'Navigate terminal output history',
    usage: 'scroll [up|down|top|bottom] [lines]',
    category: CATEGORIES.SYSTEM,
    minLevel: 1,
  })

  // KEYS/HOTKEYS command - Show keyboard shortcuts
  commandRegistry.register({
    name: 'keys',
    aliases: ['hotkeys', 'shortcuts', 'keyboard', 'keybinds'],
    handler: async () => {
      return {
        output: [
          { text: ':: KEYBOARD SHORTCUTS ::', type: 'system' },
          { text: '', type: 'response' },
          { text: '  [TERMINAL INPUT]', type: 'handler' },
          { text: '  Tab          Autocomplete command', type: 'response' },
          { text: '  Enter        Execute command', type: 'response' },
          { text: '  Escape       Unfocus terminal', type: 'response' },
          { text: '  ↑ / ↓        Browse command history', type: 'response' },
          { text: '  ← / →        Move cursor', type: 'response' },
          { text: '  Home / End   Jump to start/end of line', type: 'response' },
          { text: '', type: 'response' },
          { text: '  [SCROLLING]', type: 'handler' },
          { text: '  PageUp       Scroll up 5 lines', type: 'response' },
          { text: '  PageDown     Scroll down 5 lines', type: 'response' },
          { text: '  Ctrl+Home    Jump to oldest message', type: 'response' },
          { text: '  Ctrl+End     Jump to newest message', type: 'response' },
          { text: '  Mouse wheel  Scroll in terminal area', type: 'response' },
          { text: '', type: 'response' },
          { text: '  [QUICK COMMANDS]', type: 'handler' },
          { text: '  s      → status  (check your stats)', type: 'response' },
          { text: '  h      → help    (command list)', type: 'response' },
          { text: '  bal    → balance (check money)', type: 'response' },
          { text: '  inv    → inventory', type: 'response' },
          { text: '  ts     → timestamps toggle', type: 'response' },
          { text: '', type: 'response' },
          { text: '  [NATURAL LANGUAGE]', type: 'handler' },
          { text: '  "take me to ops"  → go ops', type: 'response' },
          { text: '  "how am I doing?" → status analysis', type: 'response' },
          { text: '  "what crime should I do?" → advice', type: 'response' },
        ]
      }
    },
    help: 'Show keyboard shortcuts and hotkeys',
    usage: 'keys',
    category: CATEGORIES.INFO,
    minLevel: 1,
  })

  console.log('[SystemCommands] Registered system commands')
}

export default registerSystemCommands
