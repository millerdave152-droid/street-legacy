/**
 * NavigationCommands - Scene navigation commands
 * go, back, home
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'

// Location mappings - aliases to scene keys
const LOCATIONS = {
  // Operations Hub
  ops: { scene: 'OperationsHubScene', name: 'Operations Hub' },
  operations: { scene: 'OperationsHubScene', name: 'Operations Hub' },

  // Commerce Hub
  trade: { scene: 'CommerceHubScene', name: 'Commerce Hub' },
  commerce: { scene: 'CommerceHubScene', name: 'Commerce Hub' },
  shop: { scene: 'CommerceHubScene', name: 'Commerce Hub' },

  // Connections Hub
  net: { scene: 'ConnectionsHubScene', name: 'Connections Hub' },
  network: { scene: 'ConnectionsHubScene', name: 'Connections Hub' },
  connections: { scene: 'ConnectionsHubScene', name: 'Connections Hub' },
  crew: { scene: 'CrewScene', name: 'Crew' },

  // System Hub
  sys: { scene: 'SystemHubScene', name: 'System Hub' },
  system: { scene: 'SystemHubScene', name: 'System Hub' },

  // Feature scenes
  crime: { scene: 'CrimeScene', name: 'Crime' },
  crimes: { scene: 'CrimeScene', name: 'Crime' },

  jobs: { scene: 'JobScene', name: 'Jobs' },
  job: { scene: 'JobScene', name: 'Jobs' },
  work: { scene: 'JobScene', name: 'Jobs' },

  heist: { scene: 'HeistsScene', name: 'Heists' },
  heists: { scene: 'HeistsScene', name: 'Heists' },

  bank: { scene: 'BankScene', name: 'Bank' },
  money: { scene: 'BankScene', name: 'Bank' },

  property: { scene: 'PropertyScene', name: 'Property' },
  properties: { scene: 'PropertyScene', name: 'Property' },

  trading: { scene: 'TradingScene', name: 'Trading' },
  market: { scene: 'TradingScene', name: 'Trading' },

  inventory: { scene: 'InventoryScene', name: 'Inventory' },
  inv: { scene: 'InventoryScene', name: 'Inventory' },
  items: { scene: 'InventoryScene', name: 'Inventory' },

  inbox: { scene: 'NetworkInboxScene', name: 'Network Inbox' },
  mail: { scene: 'NetworkInboxScene', name: 'Network Inbox' },
  messages: { scene: 'NetworkInboxScene', name: 'Network Inbox' },

  rep: { scene: 'ReputationScene', name: 'Reputation' },
  reputation: { scene: 'ReputationScene', name: 'Reputation' },

  map: { scene: 'MapScene', name: 'Map' },
  travel: { scene: 'TravelScene', name: 'Travel' },

  achievements: { scene: 'AchievementsScene', name: 'Achievements' },
  achieve: { scene: 'AchievementsScene', name: 'Achievements' },

  leaderboard: { scene: 'LeaderboardScene', name: 'Leaderboard' },
  leaders: { scene: 'LeaderboardScene', name: 'Leaderboard' },
  lb: { scene: 'LeaderboardScene', name: 'Leaderboard' },

  news: { scene: 'NewsFeedScene', name: 'News Feed' },
  feed: { scene: 'NewsFeedScene', name: 'News Feed' },

  events: { scene: 'EventsScene', name: 'Events' },

  settings: { scene: 'SettingsScene', name: 'Settings' },
  config: { scene: 'SettingsScene', name: 'Settings' },

  admin: { scene: 'AdminScene', name: 'Admin Panel', minLevel: 99 },
}

// Navigation history stack
let navigationHistory = []

/**
 * Register all navigation commands
 */
export function registerNavigationCommands() {
  // GO command - navigate to a location
  commandRegistry.register({
    name: 'go',
    aliases: ['cd', 'open', 'goto', 'nav'],
    handler: async ({ args, terminal }) => {
      if (args.length === 0) {
        // Show available locations
        const output = [
          { text: '  Available locations:', type: 'system' },
          { text: '', type: 'response' },
          { text: '  [HUBS]', type: 'system' },
          { text: '    ops      Operations Hub (crime, jobs, heists)', type: 'response' },
          { text: '    trade    Commerce Hub (trading, property, bank)', type: 'response' },
          { text: '    net      Connections Hub (crew, inventory)', type: 'response' },
          { text: '    sys      System Hub (reputation, settings)', type: 'response' },
          { text: '', type: 'response' },
          { text: '  [SCENES]', type: 'system' },
          { text: '    crime, jobs, heists, bank, property', type: 'response' },
          { text: '    trading, inventory, inbox, map', type: 'response' },
          { text: '', type: 'response' },
          { text: '  Usage: go <location>', type: 'system' },
        ]
        return { output }
      }

      const locationKey = args[0].toLowerCase()
      const location = LOCATIONS[locationKey]

      if (!location) {
        return {
          error: true,
          message: `Unknown location: ${locationKey}. Type "go" to see available locations.`
        }
      }

      // Check level requirement
      if (location.minLevel) {
        const playerLevel = terminal.currentScene?.registry?.get('playerLevel') || 1
        if (playerLevel < location.minLevel) {
          return {
            error: true,
            message: `${location.name} requires level ${location.minLevel}`
          }
        }
      }

      // Navigate
      terminal.addSystemMessage(`Navigating to ${location.name}...`)

      if (terminal.currentScene) {
        // Save current scene to history
        const currentKey = terminal.currentScene.scene.key
        if (currentKey !== location.scene) {
          navigationHistory.push(currentKey)
        }

        // Navigate to new scene
        try {
          // If on GameScene, pause it and launch the target
          if (currentKey === 'GameScene') {
            terminal.currentScene.scene.pause()
            terminal.currentScene.scene.launch(location.scene)
          } else {
            // If on another scene, stop it and start the target
            terminal.currentScene.scene.stop()
            terminal.currentScene.scene.start(location.scene)
          }
        } catch (e) {
          console.error('[NavigationCommands] Navigation error:', e)
          return { error: true, message: `Failed to navigate: ${e.message}` }
        }
      }

      return null
    },
    help: 'Navigate to a location',
    usage: 'go <location>',
    category: CATEGORIES.NAVIGATION,
    minLevel: 1,
    getSuggestions: (args) => {
      if (args.length === 0 || args[0] === '') {
        return Object.keys(LOCATIONS).slice(0, 10)
      }
      const partial = args[0].toLowerCase()
      return Object.keys(LOCATIONS).filter(k => k.startsWith(partial))
    },
  })

  // BACK command - go to previous scene
  commandRegistry.register({
    name: 'back',
    aliases: ['..', 'prev', 'return'],
    handler: async ({ terminal }) => {
      if (navigationHistory.length === 0) {
        // Default to going home
        terminal.addSystemMessage('Returning to dashboard...')

        if (terminal.currentScene) {
          const currentKey = terminal.currentScene.scene.key
          if (currentKey !== 'GameScene') {
            terminal.currentScene.scene.stop()
            terminal.currentScene.scene.resume('GameScene')
          }
        }
        return null
      }

      const previousScene = navigationHistory.pop()
      terminal.addSystemMessage(`Returning to ${previousScene}...`)

      if (terminal.currentScene) {
        try {
          terminal.currentScene.scene.stop()
          terminal.currentScene.scene.resume(previousScene)
        } catch (e) {
          // Scene might not be paused, try starting it
          terminal.currentScene.scene.start(previousScene)
        }
      }

      return null
    },
    help: 'Return to previous scene',
    usage: 'back',
    category: CATEGORIES.NAVIGATION,
    minLevel: 1,
  })

  // HOME command - return to dashboard
  commandRegistry.register({
    name: 'home',
    aliases: ['~', 'dashboard', 'main', 'hub'],
    handler: async ({ terminal }) => {
      terminal.addSystemMessage('Returning to dashboard...')

      // Clear navigation history
      navigationHistory = []

      if (terminal.currentScene) {
        const currentKey = terminal.currentScene.scene.key

        if (currentKey === 'GameScene') {
          // Already home
          return { output: '  Already at dashboard' }
        }

        try {
          // Stop current scene
          terminal.currentScene.scene.stop()

          // Resume GameScene
          terminal.currentScene.scene.resume('GameScene')

          // Make sure UIScene is running
          if (!terminal.currentScene.scene.isActive('UIScene')) {
            terminal.currentScene.scene.launch('UIScene')
          }
        } catch (e) {
          console.error('[NavigationCommands] Home error:', e)
        }
      }

      return null
    },
    help: 'Return to main dashboard',
    usage: 'home',
    category: CATEGORIES.NAVIGATION,
    minLevel: 1,
  })

  // WHERE command - show current location
  commandRegistry.register({
    name: 'where',
    aliases: ['pwd', 'location', 'loc'],
    handler: async ({ terminal }) => {
      const currentScene = terminal.currentScene?.scene?.key || 'Unknown'

      // Find friendly name
      let friendlyName = currentScene
      for (const [key, loc] of Object.entries(LOCATIONS)) {
        if (loc.scene === currentScene) {
          friendlyName = loc.name
          break
        }
      }

      if (currentScene === 'GameScene') {
        friendlyName = 'Dashboard'
      }

      return {
        output: [
          { text: `  Current: ${friendlyName}`, type: 'response' },
          { text: `  Scene: ${currentScene}`, type: 'system' },
        ]
      }
    },
    help: 'Show current location',
    usage: 'where',
    category: CATEGORIES.NAVIGATION,
    minLevel: 1,
  })

  // ============================================
  // SHORTCUT COMMANDS - Direct navigation without "go"
  // ============================================
  const shortcuts = [
    { name: 'jobs', aliases: ['job', 'work'], scene: 'JobScene', display: 'Jobs' },
    { name: 'crime', aliases: ['crimes'], scene: 'CrimeScene', display: 'Crime' },
    { name: 'bank', aliases: ['banking'], scene: 'BankScene', display: 'Bank' },
    { name: 'heist', aliases: ['heists'], scene: 'HeistsScene', display: 'Heists' },
    { name: 'inventory', aliases: ['inv', 'items'], scene: 'InventoryScene', display: 'Inventory' },
    { name: 'ops', aliases: ['operations'], scene: 'OperationsHubScene', display: 'Operations Hub' },
    { name: 'map', aliases: ['travel'], scene: 'MapScene', display: 'Map' },
    { name: 'crew', aliases: ['gang', 'team'], scene: 'CrewScene', display: 'Crew' }
  ]

  shortcuts.forEach(({ name, aliases, scene, display }) => {
    commandRegistry.register({
      name,
      aliases,
      handler: async ({ terminal }) => {
        terminal.addSystemMessage(`Opening ${display}...`)

        if (terminal.currentScene) {
          try {
            const currentKey = terminal.currentScene.scene.key
            if (currentKey !== scene && currentKey !== 'GameScene') {
              navigationHistory.push(currentKey)
            }
            terminal.currentScene.scene.launch(scene)
          } catch (e) {
            console.error(`[NavigationCommands] Error launching ${scene}:`, e)
            return { error: true, message: `Unable to open ${display}` }
          }
        }
        return null
      },
      help: `Go to ${display}`,
      usage: name,
      category: CATEGORIES.NAVIGATION,
      minLevel: 1,
    })
  })

  console.log('[NavigationCommands] Registered navigation commands')
}

export default registerNavigationCommands
