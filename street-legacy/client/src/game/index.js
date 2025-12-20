// Street Legacy - Phaser Game Integration
// Entry point for initializing and managing the Phaser game instance

import Phaser from 'phaser'
import { gameConfig } from './config'
import { gameManager } from './GameManager'

let gameInstance = null

/**
 * Initialize the Phaser game
 * @param {string} containerId - DOM element ID to mount the game
 * @returns {Phaser.Game} The game instance
 */
export const initGame = (containerId = 'game-container') => {
  // Destroy existing instance if any
  if (gameInstance) {
    destroyGame()
  }

  // Create game config with the specified container
  const config = {
    ...gameConfig,
    parent: containerId
  }

  // Create and return the game instance
  gameInstance = new Phaser.Game(config)

  // Handle visibility changes (pause when tab is hidden)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return gameInstance
}

/**
 * Destroy the Phaser game instance
 */
export const destroyGame = () => {
  if (gameInstance) {
    // Clean up game manager
    gameManager.cleanup()

    // Remove event listener
    document.removeEventListener('visibilitychange', handleVisibilityChange)

    // Destroy the game
    gameInstance.destroy(true)
    gameInstance = null
  }
}

/**
 * Get the current game instance
 * @returns {Phaser.Game|null}
 */
export const getGame = () => gameInstance

/**
 * Check if game is running
 * @returns {boolean}
 */
export const isGameRunning = () => gameInstance !== null && !gameInstance.isRunning === false

/**
 * Pause the game
 */
export const pauseGame = () => {
  if (gameInstance) {
    gameInstance.scene.scenes.forEach(scene => {
      if (scene.scene.isActive()) {
        scene.scene.pause()
      }
    })
  }
}

/**
 * Resume the game
 */
export const resumeGame = () => {
  if (gameInstance) {
    gameInstance.scene.scenes.forEach(scene => {
      if (scene.scene.isPaused()) {
        scene.scene.resume()
      }
    })
  }
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is hidden - could pause game here if desired
    // pauseGame()
  } else {
    // Page is visible again
    // resumeGame()
  }
}

// Export game manager for direct access
export { gameManager }

// Export scene classes for external use if needed
export { BootScene } from './scenes/BootScene'
export { PreloadScene } from './scenes/PreloadScene'
export { MainMenuScene } from './scenes/MainMenuScene'
export { GameScene } from './scenes/GameScene'
export { UIScene } from './scenes/UIScene'
export { CrimeScene } from './scenes/CrimeScene'
export { JobScene } from './scenes/JobScene'
export { MapScene } from './scenes/MapScene'
export { PropertyScene } from './scenes/PropertyScene'
export { InventoryScene } from './scenes/InventoryScene'
export { CrewScene } from './scenes/CrewScene'
export { BankScene } from './scenes/BankScene'
export { LeaderboardScene } from './scenes/LeaderboardScene'
export { AchievementsScene } from './scenes/AchievementsScene'
export { EventsScene } from './scenes/EventsScene'
export { AudioSettingsScene } from './scenes/AudioSettingsScene'
export { SettingsScene } from './scenes/SettingsScene'
export { AdminScene } from './scenes/AdminScene'

// Export mini-game scenes
export { SnakeGame } from './scenes/minigames/SnakeGame'
export { LockPickGame } from './scenes/minigames/LockPickGame'
export { QTEGame } from './scenes/minigames/QTEGame'
export { FroggerGame } from './scenes/minigames/FroggerGame'
export { MemoryGame } from './scenes/minigames/MemoryGame'
export { SteadyHandGame } from './scenes/minigames/SteadyHandGame'
export { ChaseGame } from './scenes/minigames/ChaseGame'
export { SniperGame } from './scenes/minigames/SniperGame'
export { SafeCrackGame } from './scenes/minigames/SafeCrackGame'
export { WireGame } from './scenes/minigames/WireGame'
export { MiniGameResult } from './scenes/minigames/MiniGameResult'

// Export mini-game manager and config
export { MiniGameManager } from './managers/MiniGameManager'
export { getCrimeMapping, getSceneKeyForGame, CRIME_GAME_MAPPINGS } from './config/CrimeGameMapping'

// Export managers
export { notificationManager } from './managers/NotificationManager'
export { audioManager } from './managers/AudioManager'
export { tutorialManager } from './managers/TutorialManager'
export { adminManager } from './managers/AdminManager'

// Export utilities
export { AnimationHelper } from './utils/AnimationHelper'
export { ParticleHelper } from './utils/ParticleHelper'
export { ButtonFactory } from './utils/ButtonFactory'
export { StatBar } from './utils/StatBar'

// Export base scene for extending
export { BaseScene } from './scenes/BaseScene'

// Export UI components
export { EmptyState } from './ui/EmptyState'

// Export constants
export { DEBUG, VERSION, COLORS, COLORS_HEX, ICONS, EMPTY_STATES, GAME } from './config/Constants'
