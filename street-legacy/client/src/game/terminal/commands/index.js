/**
 * Command Module Index
 * Registers all terminal commands
 */

import { registerInfoCommands } from './InfoCommands'
import { registerSystemCommands } from './SystemCommands'
import { registerNavigationCommands } from './NavigationCommands'
import { registerSarahCommands } from './SarahCommands'
import { registerNPCCommands } from './NPCCommands'
import { terminalNPCManager } from '../../managers/TerminalNPCManager'

// Adventure commands register on import
import './AdventureCommands'

// Track if commands have been registered
let commandsRegistered = false

/**
 * Register all command modules
 */
export function registerAllCommands() {
  if (commandsRegistered) {
    console.log('[Commands] Already registered')
    return
  }

  console.log('[Commands] Registering all command modules...')

  // Core commands
  registerInfoCommands()
  registerSystemCommands()
  registerNavigationCommands()

  // S.A.R.A.H. AI assistant commands
  registerSarahCommands()

  // NPC terminal opportunity system
  registerNPCCommands()

  // Initialize NPC manager for random messages
  terminalNPCManager.initialize()

  commandsRegistered = true
  console.log('[Commands] All commands registered')
}

export default registerAllCommands
