/**
 * SystemCommands - System and utility commands
 * clear, settings, mute, logout
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { audioManager } from '../../managers/AudioManager'

/**
 * Register all system commands
 */
export function registerSystemCommands() {
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

  console.log('[SystemCommands] Registered system commands')
}

export default registerSystemCommands
