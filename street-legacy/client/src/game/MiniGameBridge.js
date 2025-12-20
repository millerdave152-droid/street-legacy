// MiniGameBridge.js
// Bridge between React crime system and Phaser mini-games
// Allows React components to launch Phaser mini-game scenes and receive results

import { getGame } from './index'
import { getCrimeMapping, getSceneKeyForGame, createDefaultMapping } from './config/CrimeGameMapping'

/**
 * Mini-game result callback type
 * @typedef {Object} MiniGameResult
 * @property {boolean} success - Whether the mini-game was won
 * @property {number} score - Final score achieved
 * @property {number} bonusMultiplier - Multiplier for rewards (1.0 - 2.5)
 * @property {boolean} perfectRun - Whether player achieved perfect score
 * @property {number} timeRemaining - Seconds left when game ended
 */

// Store for pending mini-game callbacks
let pendingCallback = null
let pendingCrimeId = null

/**
 * Check if a crime has an associated mini-game
 * @param {number|string} crimeId - The crime ID or name
 * @returns {boolean}
 */
export function hasMiniGame(crimeId) {
  const mapping = getCrimeMapping(crimeId)
  return mapping !== null
}

/**
 * Get the mini-game type for a crime
 * @param {number|string} crimeId - The crime ID or name
 * @returns {string|null} The mini-game type or null
 */
export function getMiniGameType(crimeId) {
  const mapping = getCrimeMapping(crimeId)
  return mapping ? mapping.gameType : null
}

/**
 * Launch a mini-game for a crime
 * @param {Object} options
 * @param {number|string} options.crimeId - The crime ID or name
 * @param {string} options.crimeName - Display name of the crime
 * @param {number} options.playerLevel - Player's current level
 * @param {function} options.onComplete - Callback when mini-game finishes
 * @returns {boolean} True if mini-game was launched, false otherwise
 */
export function launchMiniGame({ crimeId, crimeName, playerLevel = 1, onComplete }) {
  const game = getGame()

  if (!game) {
    console.warn('[MiniGameBridge] No Phaser game instance found')
    return false
  }

  // Get the mini-game mapping for this crime
  let mapping = getCrimeMapping(crimeId)

  // If no mapping found, try by name
  if (!mapping && crimeName) {
    mapping = getCrimeMapping(crimeName)
  }

  // If still no mapping, use default
  if (!mapping) {
    console.log('[MiniGameBridge] No mapping for crime:', crimeId, 'using default')
    mapping = createDefaultMapping(crimeId, crimeName || String(crimeId), 1)
  }

  const sceneKey = getSceneKeyForGame(mapping.gameType)

  if (!sceneKey) {
    console.warn('[MiniGameBridge] No scene key for game type:', mapping.gameType)
    return false
  }

  // Calculate difficulty with level bonus
  const difficulty = Math.min(5, mapping.difficulty + Math.floor(playerLevel / 10))
  const timeLimit = Math.max(15, mapping.timeLimit - (difficulty - mapping.difficulty) * 2)

  // Store callback for when mini-game completes
  pendingCallback = onComplete
  pendingCrimeId = crimeId

  // Build game data to pass to the scene
  const gameData = {
    crimeId,
    crimeName: crimeName || mapping.name || 'Unknown Crime',
    gameType: mapping.gameType,
    difficulty,
    timeLimit,
    targetScore: mapping.targetScore,
    perfectScore: mapping.perfectScore || mapping.targetScore * 2,
    theme: mapping.theme,
    returnScene: null, // We're coming from React, not another scene
    onComplete: handleMiniGameComplete
  }

  console.log('[MiniGameBridge] Launching mini-game:', sceneKey, gameData)

  // Start the mini-game scene
  try {
    // Check if scene exists
    if (!game.scene.getScene(sceneKey)) {
      console.error('[MiniGameBridge] Scene not found:', sceneKey)
      return false
    }

    // Stop any currently running game scenes (but not UI)
    const activeScenes = game.scene.getScenes(true)
    activeScenes.forEach(scene => {
      if (scene.scene.key !== 'UIScene' && scene.scene.key !== 'BootScene' && scene.scene.key !== 'PreloadScene') {
        game.scene.stop(scene.scene.key)
      }
    })

    // Start the mini-game scene
    game.scene.start(sceneKey, gameData)

    return true
  } catch (error) {
    console.error('[MiniGameBridge] Failed to launch mini-game:', error)
    pendingCallback = null
    pendingCrimeId = null
    return false
  }
}

/**
 * Handle mini-game completion - called from Phaser scene
 * @param {MiniGameResult} result
 */
function handleMiniGameComplete(result) {
  console.log('[MiniGameBridge] Mini-game complete:', result)

  const callback = pendingCallback
  const crimeId = pendingCrimeId

  // Clear pending state
  pendingCallback = null
  pendingCrimeId = null

  // Call the callback with result
  if (callback) {
    callback({
      ...result,
      crimeId
    })
  }

  // Return to game scene or main menu
  const game = getGame()
  if (game) {
    // Try to resume GameScene if it exists
    if (game.scene.getScene('GameScene')) {
      game.scene.start('GameScene')
    } else if (game.scene.getScene('MainMenuScene')) {
      game.scene.start('MainMenuScene')
    }
  }
}

/**
 * Cancel any pending mini-game
 */
export function cancelMiniGame() {
  pendingCallback = null
  pendingCrimeId = null

  const game = getGame()
  if (game) {
    // Stop all mini-game scenes
    const miniGameScenes = [
      'SnakeGame', 'LockPickGame', 'QTEGame', 'FroggerGame',
      'MemoryGame', 'SteadyHandGame', 'ChaseGame', 'SniperGame',
      'SafeCrackGame', 'WireGame', 'MiniGameResult'
    ]

    miniGameScenes.forEach(sceneKey => {
      if (game.scene.isActive(sceneKey)) {
        game.scene.stop(sceneKey)
      }
    })

    // Return to main game
    if (game.scene.getScene('GameScene')) {
      game.scene.start('GameScene')
    }
  }
}

/**
 * Check if a mini-game is currently active
 * @returns {boolean}
 */
export function isMiniGameActive() {
  const game = getGame()
  if (!game) return false

  const miniGameScenes = [
    'SnakeGame', 'LockPickGame', 'QTEGame', 'FroggerGame',
    'MemoryGame', 'SteadyHandGame', 'ChaseGame', 'SniperGame',
    'SafeCrackGame', 'WireGame', 'MiniGameResult'
  ]

  return miniGameScenes.some(sceneKey => game.scene.isActive(sceneKey))
}

export default {
  hasMiniGame,
  getMiniGameType,
  launchMiniGame,
  cancelMiniGame,
  isMiniGameActive
}
