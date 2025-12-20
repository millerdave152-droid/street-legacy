/**
 * Command Module Index
 * Registers all terminal commands
 */

import { registerInfoCommands } from './InfoCommands'
import { registerSystemCommands } from './SystemCommands'
import { registerNavigationCommands } from './NavigationCommands'
import { registerSarahCommands } from './SarahCommands'

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

  // Action commands (to be added)
  // registerActionCommands()

  // Social commands (to be added)
  // registerSocialCommands()

  commandsRegistered = true
  console.log('[Commands] All commands registered')
}

export default registerAllCommands
