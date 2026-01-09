/**
 * Command Module Index
 * Registers all terminal commands
 */

import { registerInfoCommands } from './InfoCommands'
import { registerSystemCommands } from './SystemCommands'
import { registerNavigationCommands } from './NavigationCommands'
import { registerSarahCommands } from './SarahCommands'
import { registerNPCCommands } from './NPCCommands'
import { registerContactCommands } from './ContactCommands'
import { registerReputationCommands } from './ReputationCommands'
import { registerDefenseCommands } from './DefenseCommands'
import { registerOpportunityCommands } from './OpportunityCommands'
import { registerSettingsCommands } from './SettingsCommands'
import { registerMarketCommands } from './MarketCommands'
import { registerTerritoryCommands } from './TerritoryCommands'
import { terminalNPCManager } from '../../managers/TerminalNPCManager'
import { heatEventSystem } from '../../managers/HeatEventSystem'
import { playerReputationManager } from '../../managers/PlayerReputationManager'
import { progressionManager } from '../../managers/ProgressionManager'
import { worldEventSystem } from '../../managers/WorldEventSystem'
import { storyArcManager } from '../../managers/StoryArcManager'
import { dialogueTreeManager } from '../DialogueTreeManager'

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

  // Named NPC contact commands
  registerContactCommands()

  // Reputation and intel commands
  registerReputationCommands()

  // Defense commands (lawyer, hideout, payoff)
  registerDefenseCommands()

  // Opportunity commands (negotiate, events, arc)
  registerOpportunityCommands()

  // Settings/Power user commands (theme, vim, macro, undo)
  registerSettingsCommands()

  // Market commands (buy, sell, listings)
  registerMarketCommands()

  // Territory and contract commands (invest, contracts)
  registerTerritoryCommands()

  // Initialize NPC manager for random messages
  terminalNPCManager.initialize()

  // Initialize heat event system (Detective Morgan, raid warnings)
  heatEventSystem.initialize()

  // Initialize player reputation manager (factions, trust)
  playerReputationManager.initialize()

  // Initialize progression manager (level-based unlocks)
  progressionManager.initialize()

  // Initialize world event system (police crackdown, gang war, etc)
  worldEventSystem.initialize()

  // Initialize story arc manager (multi-phase missions)
  storyArcManager.initialize()

  // Initialize dialogue tree manager (negotiations)
  dialogueTreeManager.initialize()

  commandsRegistered = true
  console.log('[Commands] All commands registered')
}

export default registerAllCommands
