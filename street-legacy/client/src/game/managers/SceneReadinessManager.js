/**
 * SceneReadinessManager - Manages scene lifecycle with proper async handling
 *
 * Solves the hub scene freeze issue by:
 * - Blocking input until scene is truly ready (after async content loads)
 * - Handling UIScene pause/resume with error recovery
 * - Ensuring cleanup on shutdown (UIScene always resumed)
 * - Providing safe scene close ordering (resume BEFORE stop)
 */
export class SceneReadinessManager {
  constructor(scene) {
    this.scene = scene
    this.isReady = false
    this.shutdownBound = false
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
   * Safely pause UIScene with error handling
   */
  pauseUIScene() {
    try {
      if (this.scene.scene.isActive('UIScene')) {
        this.scene.scene.pause('UIScene')
        console.log(`[${this.scene.scene.key}] SceneReadinessManager: UIScene paused`)
        return true
      }
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to pause UIScene:`, e)
    }
    return false
  }

  /**
   * Safely resume UIScene with error handling
   */
  resumeUIScene() {
    try {
      // Always try to resume - safe even if already running
      this.scene.scene.resume('UIScene')
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: UIScene resumed`)
      return true
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to resume UIScene:`, e)
    }
    return false
  }

  /**
   * Safely close the scene with proper ordering
   * CRITICAL: Resume other scenes BEFORE stopping this one
   * @param {string} returnScene - Scene to resume (default: GameScene)
   */
  closeScene(returnScene = 'GameScene') {
    console.log(`[${this.scene.scene.key}] SceneReadinessManager: Closing scene, returning to ${returnScene}`)

    // Step 1: Resume the return scene FIRST
    try {
      this.scene.scene.resume(returnScene)
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Resumed ${returnScene}`)
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to resume ${returnScene}:`, e)
    }

    // Step 2: Resume UIScene
    this.resumeUIScene()

    // Step 3: Stop this scene LAST
    try {
      this.scene.scene.stop()
      console.log(`[${this.scene.scene.key}] SceneReadinessManager: Scene stopped`)
    } catch (e) {
      console.error(`[${this.scene.scene.key}] SceneReadinessManager: Failed to stop scene:`, e)
    }
  }

  /**
   * Cleanup on shutdown - ensures UIScene is never left paused
   */
  onShutdown() {
    console.log(`[${this.scene.scene.key}] SceneReadinessManager: Shutdown cleanup`)

    // Safety net: always try to resume UIScene on shutdown
    // This prevents UIScene from being permanently paused if something goes wrong
    this.resumeUIScene()
  }
}

export default SceneReadinessManager
