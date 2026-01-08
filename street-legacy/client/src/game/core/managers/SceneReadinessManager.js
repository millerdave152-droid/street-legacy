/**
 * SceneReadinessManager - Manages scene lifecycle with proper async handling
 *
 * Core engine component - no game-specific logic.
 *
 * Solves scene freeze issues by:
 * - Blocking input until scene is truly ready (after async content loads)
 * - Handling overlay scene pause/resume with error recovery
 * - Ensuring cleanup on shutdown (overlay scene always resumed)
 * - Providing safe scene close ordering (resume BEFORE stop)
 *
 * @param {Phaser.Scene} scene - The scene to manage
 * @param {Object} config - Configuration options
 * @param {string} config.overlayScene - Name of the overlay scene (default: 'UIScene')
 * @param {string} config.mainScene - Name of the main game scene (default: 'GameScene')
 */
export class SceneReadinessManager {
  constructor(scene, config = {}) {
    this.scene = scene
    this.isReady = false
    this.shutdownBound = false

    // Configurable scene names - defaults for backwards compatibility
    this.overlayScene = config.overlayScene || 'UIScene'
    this.mainScene = config.mainScene || 'GameScene'
  }

  /**
   * Call this at the START of create() to block input
   */
  beginCreate() {
    this.scene.input.enabled = false
    this.isReady = false
    console.log(`[${this.scene.scene.key}] SceneReadinessManager: Input blocked, waiting for ready`)

    // Register shutdown handler once
    if (!this.shutdownBound) {
      this.scene.events.once('shutdown', () => this.onShutdown())
      this.shutdownBound = true
    }
  }

  /**
   * Call this AFTER all async content has loaded to enable input
   * @param {number} minDelay - Minimum delay before enabling input (prevents click propagation)
   */
  async markReady(minDelay = 100) {
    if (this.isReady) {
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Already marked ready`)
      return
    }

    this.isReady = true
    console.log(`[${this.scene.scene.key}] SceneReadinessManager: Marking ready, waiting ${minDelay}ms`)

    // Wait minimum delay to prevent click propagation from source scene
    await new Promise(resolve => {
      if (!this.scene.scene.isActive(this.scene.scene.key)) {
        console.log(`[${this.scene.scene.key}] SceneReadinessManager: Scene no longer active, skipping delay`)
        resolve()
        return
      }
      this.scene.time.delayedCall(minDelay, resolve)
    })

    // Enable input only if scene is still active
    if (this.scene.scene.isActive(this.scene.scene.key)) {
      this.scene.input.enabled = true
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Input enabled, scene ready`)
    } else {
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Scene became inactive, input not enabled`)
    }
  }

  /**
   * Safely pause the overlay scene with error handling
   */
  pauseOverlayScene() {
    try {
      if (this.scene.scene.isActive(this.overlayScene)) {
        this.scene.scene.pause(this.overlayScene)
        console.log(`[${this.scene.scene.key}] SceneReadinessManager: ${this.overlayScene} paused`)
        return true
      }
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to pause ${this.overlayScene}:`, e)
    }
    return false
  }

  /**
   * Safely resume the overlay scene with error handling
   */
  resumeOverlayScene() {
    try {
      // Always try to resume - safe even if already running
      this.scene.scene.resume(this.overlayScene)
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: ${this.overlayScene} resumed`)
      return true
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to resume ${this.overlayScene}:`, e)
    }
    return false
  }

  // Legacy method names for backwards compatibility
  pauseUIScene() {
    return this.pauseOverlayScene()
  }

  resumeUIScene() {
    return this.resumeOverlayScene()
  }

  /**
   * Safely close the scene with proper ordering
   * CRITICAL: Resume other scenes BEFORE stopping this one
   * @param {string} returnScene - Scene to resume (default: configured mainScene)
   */
  closeScene(returnScene = null) {
    const targetScene = returnScene || this.mainScene
    console.log(`[${this.scene.scene.key}] SceneReadinessManager: Closing scene, returning to ${targetScene}`)

    // Step 1: Resume the return scene FIRST
    try {
      this.scene.scene.resume(targetScene)
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Resumed ${targetScene}`)
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to resume ${targetScene}:`, e)
    }

    // Step 2: Resume overlay scene
    this.resumeOverlayScene()

    // Step 3: Stop this scene LAST
    try {
      this.scene.scene.stop()
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Scene stopped`)
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to stop scene:`, e)
    }
  }

  /**
   * Cleanup on shutdown - ensures overlay scene is never left paused
   */
  onShutdown() {
    console.log(`[${this.scene.scene.key}] SceneReadinessManager: Shutdown cleanup`)

    // Safety net: always try to resume overlay scene on shutdown
    // This prevents overlay scene from being permanently paused if something goes wrong
    this.resumeOverlayScene()
  }
}

export default SceneReadinessManager
