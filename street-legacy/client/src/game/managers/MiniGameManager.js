// Mini-Game Manager
// Manages launching and coordinating mini-games from crime scenes

import { getCrimeMapping, getSceneKeyForGame, createDefaultMapping } from '../config/CrimeGameMapping'
import { gameManager } from '../GameManager'

export class MiniGameManager {
  constructor(scene) {
    this.scene = scene
  }

  /**
   * Start a mini-game for a specific crime
   * @param {string} crimeId - Crime identifier
   * @param {number} playerLevel - Player's current level
   * @param {string} returnScene - Scene to return to after mini-game
   * @param {Function} onComplete - Callback with mini-game result
   * @returns {boolean} Whether the mini-game was started
   */
  startGame(crimeId, playerLevel = 1, returnScene = 'CrimeScene', onComplete = null) {
    // Get mapping for this crime
    let mapping = getCrimeMapping(crimeId)

    if (!mapping) {
      // Create a default mapping for unknown crimes
      console.warn(`No mini-game mapping for crime: ${crimeId}, using default QTE`)
      mapping = createDefaultMapping(crimeId, crimeId, 1)
    }

    // Calculate progressive difficulty based on play history
    const baseDifficulty = mapping.difficulty || 1
    const difficultyData = gameManager.calculateMinigameDifficulty(crimeId, baseDifficulty)

    // Apply difficulty scaling
    const difficulty = difficultyData.difficulty
    const timeLimit = Math.max(10, mapping.timeLimit - difficultyData.timeReduction)
    const scaledTargetScore = Math.floor((mapping.targetScore || 100) * difficultyData.targetMultiplier)
    const scaledPerfectScore = Math.floor((mapping.perfectScore || 150) * difficultyData.targetMultiplier)

    console.log(`[MiniGameManager] Starting ${crimeId} at ${difficultyData.tier.name} tier (difficulty ${difficulty})`)
    console.log(`[MiniGameManager] Reward multiplier: ${difficultyData.rewardMultiplier.toFixed(2)}x`)

    // Build game data
    const gameData = {
      crimeId: mapping.crimeId,
      crimeName: mapping.crimeName,
      gameType: mapping.gameType,
      difficulty,
      timeLimit,
      targetScore: scaledTargetScore,
      perfectScore: scaledPerfectScore,
      theme: mapping.theme,
      returnScene,
      onComplete,
      // Progressive difficulty data
      difficultyTier: difficultyData.tier,
      rewardMultiplier: difficultyData.rewardMultiplier,
      playerStats: difficultyData.stats,
      nextTier: difficultyData.nextTier,
      playsToNextTier: difficultyData.playsToNextTier,
      // Additional data for rewards calculation
      baseCashReward: Math.floor(500 * difficultyData.rewardMultiplier),
      baseXpReward: Math.floor(50 * difficultyData.rewardMultiplier)
    }

    // Get scene key
    const sceneKey = getSceneKeyForGame(mapping.gameType)

    // Check if scene exists
    if (!this.scene.scene.get(sceneKey)) {
      console.error(`Mini-game scene not found: ${sceneKey}`)
      return false
    }

    // Get scene manager reference BEFORE stopping (after stop, scene reference may be invalid)
    const sceneManager = this.scene.scene

    // Launch the mini-game
    console.log(`Starting mini-game: ${sceneKey} for crime: ${crimeId}`)
    sceneManager.stop()  // Stop CrimeScene before starting minigame
    sceneManager.start(sceneKey, gameData)
    return true
  }

  /**
   * Check if a crime has a mini-game mapping
   * @param {string} crimeId
   * @returns {boolean}
   */
  hasMiniGame(crimeId) {
    return getCrimeMapping(crimeId) !== null
  }

  /**
   * Get the mini-game type for a crime
   * @param {string} crimeId
   * @returns {string|null}
   */
  getGameType(crimeId) {
    const mapping = getCrimeMapping(crimeId)
    return mapping ? mapping.gameType : null
  }
}

export default MiniGameManager
