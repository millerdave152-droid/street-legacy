/**
 * THE NETWORK - Visual Effects System
 *
 * CRT/VHS aesthetic overlays for that raw 80s/90s feel
 * These effects are performance-optimized for mobile
 */

import { COLORS, EFFECTS } from './NetworkTheme'

/**
 * Singleton manager for visual effects across all scenes
 */
class NetworkEffectsManager {
  constructor() {
    this.scene = null
    this.container = null
    this.scanlines = null
    this.vignette = null
    this.staticNoise = null
    this.enabled = true
    this.intensity = 'medium' // 'low', 'medium', 'high', 'off'
  }

  /**
   * Initialize effects for a scene
   * @param {Phaser.Scene} scene - The Phaser scene
   */
  initialize(scene) {
    this.scene = scene
    this.container = scene.add.container(0, 0)
    this.container.setDepth(9999) // Always on top

    // IMPORTANT: Disable input on this container so it doesn't block clicks
    // Visual effects should never capture input
    this.container.setInteractive = () => this.container // no-op to prevent accidental interactivity

    // Disable input processing for the entire container
    if (this.container.input) {
      this.container.input.enabled = false
    }
    // Mark container to ignore input events
    this.container.setData('ignoreInput', true)

    // Check user preference
    const savedIntensity = localStorage.getItem('network_effects_intensity')
    if (savedIntensity) {
      this.intensity = savedIntensity
    }

    if (this.intensity === 'off') {
      this.enabled = false
      return
    }

    this.createScanlines()
    this.createVignette()
    this.createScreenGlow()

    // Only add static on high intensity
    if (this.intensity === 'high') {
      this.createStaticNoise()
    }
  }

  /**
   * Create CRT scanline effect
   */
  createScanlines() {
    if (!this.scene || !this.enabled) return

    const { width, height } = this.scene.cameras.main
    const graphics = this.scene.add.graphics()

    // Draw horizontal scanlines
    const spacing = this.intensity === 'low' ? 4 : 3
    const alpha = this.intensity === 'low' ? 0.04 :
                  this.intensity === 'medium' ? 0.06 : 0.08

    graphics.fillStyle(0x000000, alpha)

    for (let y = 0; y < height; y += spacing) {
      graphics.fillRect(0, y, width, 1)
    }

    this.scanlines = graphics
    this.container.add(graphics)

    // Subtle animation - slow scroll
    if (this.intensity !== 'low') {
      this.scene.tweens.add({
        targets: graphics,
        y: spacing,
        duration: 4000,
        repeat: -1,
        ease: 'Linear'
      })
    }
  }

  /**
   * Create vignette (darkened edges)
   */
  createVignette() {
    if (!this.scene || !this.enabled) return

    const { width, height } = this.scene.cameras.main

    // Create gradient vignette using multiple rectangles
    const graphics = this.scene.add.graphics()
    const edgeWidth = width * 0.15
    const edgeHeight = height * 0.1

    const alphaBase = this.intensity === 'low' ? 0.15 :
                      this.intensity === 'medium' ? 0.25 : 0.35

    // Top edge
    for (let i = 0; i < 5; i++) {
      const alpha = alphaBase * (1 - i / 5)
      graphics.fillStyle(0x000000, alpha)
      graphics.fillRect(0, i * (edgeHeight / 5), width, edgeHeight / 5)
    }

    // Bottom edge
    for (let i = 0; i < 5; i++) {
      const alpha = alphaBase * (i / 5)
      graphics.fillStyle(0x000000, alpha)
      graphics.fillRect(0, height - edgeHeight + i * (edgeHeight / 5), width, edgeHeight / 5)
    }

    // Left edge
    for (let i = 0; i < 5; i++) {
      const alpha = alphaBase * (1 - i / 5)
      graphics.fillStyle(0x000000, alpha)
      graphics.fillRect(i * (edgeWidth / 5), 0, edgeWidth / 5, height)
    }

    // Right edge
    for (let i = 0; i < 5; i++) {
      const alpha = alphaBase * (i / 5)
      graphics.fillStyle(0x000000, alpha)
      graphics.fillRect(width - edgeWidth + i * (edgeWidth / 5), 0, edgeWidth / 5, height)
    }

    this.vignette = graphics
    this.container.add(graphics)
  }

  /**
   * Create subtle screen glow effect
   */
  createScreenGlow() {
    if (!this.scene || !this.enabled) return
    if (this.intensity === 'low') return

    const { width, height } = this.scene.cameras.main

    // Very subtle green tint overlay
    const glow = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      COLORS.network.primary,
      this.intensity === 'medium' ? 0.015 : 0.025
    )

    this.container.add(glow)

    // Subtle pulse
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: glow.alpha, to: glow.alpha * 0.5 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  /**
   * Create static noise effect (high intensity only)
   */
  createStaticNoise() {
    if (!this.scene || !this.enabled) return

    const { width, height } = this.scene.cameras.main

    // Create a container for noise particles
    const noiseContainer = this.scene.add.container(0, 0)

    // Generate random noise particles
    const particleCount = 50
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = Math.random() * 2 + 1
      const alpha = Math.random() * 0.1

      const particle = this.scene.add.rectangle(x, y, size, size, 0xffffff, alpha)
      noiseContainer.add(particle)
    }

    this.staticNoise = noiseContainer
    this.container.add(noiseContainer)

    // Animate noise
    this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!noiseContainer.active) return

        noiseContainer.each(particle => {
          particle.x = Math.random() * width
          particle.y = Math.random() * height
          particle.alpha = Math.random() * 0.1
        })
      },
      loop: true
    })
  }

  /**
   * Trigger a glitch effect
   * @param {number} duration - Effect duration in ms
   */
  triggerGlitch(duration = 200) {
    if (!this.scene || !this.enabled) return

    const { width, height } = this.scene.cameras.main

    // Create glitch slices
    const sliceCount = 5
    const slices = []

    for (let i = 0; i < sliceCount; i++) {
      const sliceY = Math.random() * height
      const sliceHeight = Math.random() * 20 + 5
      const offset = (Math.random() - 0.5) * 20

      const slice = this.scene.add.rectangle(
        width / 2 + offset,
        sliceY,
        width,
        sliceHeight,
        Math.random() > 0.5 ? COLORS.status.danger : COLORS.network.primary,
        0.3
      )
      slice.setDepth(10000)
      slices.push(slice)
    }

    // Remove after duration
    this.scene.time.delayedCall(duration, () => {
      slices.forEach(slice => slice.destroy())
    })
  }

  /**
   * Trigger VHS tracking error effect
   */
  triggerTrackingError() {
    if (!this.scene || !this.enabled) return

    const { width, height } = this.scene.cameras.main

    // Create tracking line
    const trackingLine = this.scene.add.rectangle(
      width / 2,
      0,
      width,
      3,
      COLORS.vhs.tracking,
      0.6
    )
    trackingLine.setDepth(10000)

    // Animate down screen
    this.scene.tweens.add({
      targets: trackingLine,
      y: height,
      duration: 500,
      ease: 'Linear',
      onComplete: () => trackingLine.destroy()
    })
  }

  /**
   * Create screen flicker effect
   * @param {number} count - Number of flickers
   */
  flicker(count = 3) {
    if (!this.scene || !this.enabled) return

    const { width, height } = this.scene.cameras.main

    const overlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0
    )
    overlay.setDepth(10000)

    let flickerCount = 0
    const flickerTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        overlay.alpha = overlay.alpha > 0 ? 0 : 0.3
        flickerCount++
        if (flickerCount >= count * 2) {
          flickerTimer.remove()
          overlay.destroy()
        }
      },
      repeat: count * 2 - 1
    })
  }

  /**
   * Create scene transition effect
   * @param {Function} onMidpoint - Callback at transition midpoint
   */
  transitionOut(onMidpoint) {
    if (!this.scene) return

    const { width, height } = this.scene.cameras.main

    // Create VHS-style transition
    const bars = []
    const barCount = 20

    for (let i = 0; i < barCount; i++) {
      const bar = this.scene.add.rectangle(
        width / 2,
        (height / barCount) * i + (height / barCount / 2),
        0,
        height / barCount,
        0x000000
      )
      bar.setDepth(10001)
      bars.push(bar)
    }

    // Staggered animation
    bars.forEach((bar, index) => {
      this.scene.tweens.add({
        targets: bar,
        width: width,
        duration: 200,
        delay: index * 20,
        ease: 'Power2',
        onComplete: index === Math.floor(barCount / 2) ? onMidpoint : undefined
      })
    })

    // Cleanup after animation
    this.scene.time.delayedCall(barCount * 20 + 400, () => {
      bars.forEach(bar => bar.destroy())
    })
  }

  /**
   * Set effects intensity
   * @param {string} level - 'off', 'low', 'medium', 'high'
   */
  setIntensity(level) {
    this.intensity = level
    localStorage.setItem('network_effects_intensity', level)
    this.enabled = level !== 'off'

    // Rebuild effects with new intensity
    if (this.scene) {
      this.destroy()
      this.initialize(this.scene)
    }
  }

  /**
   * Toggle effects on/off
   */
  toggle() {
    if (this.intensity === 'off') {
      this.setIntensity('medium')
    } else {
      this.setIntensity('off')
    }
  }

  /**
   * Clean up effects
   */
  destroy() {
    if (this.container) {
      this.container.destroy()
      this.container = null
    }
    this.scanlines = null
    this.vignette = null
    this.staticNoise = null
  }
}

// Export singleton instance
export const networkEffects = new NetworkEffectsManager()

// =============================================================================
// TRANSITION EFFECTS
// =============================================================================

/**
 * Create a "signal lost" transition between scenes
 * @param {Phaser.Scene} scene - Current scene
 * @param {string} targetScene - Scene to transition to
 * @param {object} data - Data to pass to new scene
 */
export function signalLostTransition(scene, targetScene, data = {}) {
  const { width, height } = scene.cameras.main

  // Create static overlay
  const staticOverlay = scene.add.graphics()
  staticOverlay.setDepth(10000)

  // Fill with noise
  const animate = () => {
    staticOverlay.clear()
    for (let x = 0; x < width; x += 4) {
      for (let y = 0; y < height; y += 4) {
        const alpha = Math.random() * 0.8
        staticOverlay.fillStyle(0xffffff, alpha)
        staticOverlay.fillRect(x, y, 4, 4)
      }
    }
  }

  // Animate static
  const timer = scene.time.addEvent({
    delay: 50,
    callback: animate,
    repeat: 20
  })

  // Add "NO SIGNAL" text
  const noSignal = scene.add.text(width / 2, height / 2, 'NO SIGNAL', {
    fontFamily: '"Courier New", monospace',
    fontSize: '32px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(10001).setAlpha(0)

  scene.tweens.add({
    targets: noSignal,
    alpha: { from: 0, to: 1 },
    duration: 200,
    delay: 500,
    yoyo: true,
    repeat: 1
  })

  // Transition after effect
  scene.time.delayedCall(1200, () => {
    staticOverlay.destroy()
    noSignal.destroy()
    scene.scene.start(targetScene, data)
  })
}

/**
 * Create a channel change effect
 * @param {Phaser.Scene} scene - Current scene
 * @param {string} targetScene - Scene to transition to
 * @param {object} data - Data to pass to new scene
 */
export function channelChangeTransition(scene, targetScene, data = {}) {
  const { width, height } = scene.cameras.main

  // Create blue "channel change" bar
  const bar = scene.add.rectangle(
    width / 2,
    height / 2,
    width,
    0,
    COLORS.status.info
  ).setDepth(10000)

  // Expand then contract
  scene.tweens.add({
    targets: bar,
    height: height,
    duration: 150,
    ease: 'Power2',
    onComplete: () => {
      // At peak, switch scenes
      scene.scene.start(targetScene, data)
    }
  })
}

/**
 * Create encrypted/decrypted text reveal effect
 * @param {Phaser.Scene} scene - The scene
 * @param {Phaser.GameObjects.Text} textObject - Text to animate
 * @param {string} finalText - Text to reveal
 * @param {number} duration - Total duration in ms
 */
export function decryptTextEffect(scene, textObject, finalText, duration = 1000) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const iterations = 10
  const intervalTime = duration / iterations

  let currentIteration = 0

  const timer = scene.time.addEvent({
    delay: intervalTime,
    callback: () => {
      currentIteration++
      const progress = currentIteration / iterations

      let displayText = ''
      for (let i = 0; i < finalText.length; i++) {
        if (i / finalText.length < progress) {
          displayText += finalText[i]
        } else {
          displayText += chars[Math.floor(Math.random() * chars.length)]
        }
      }

      textObject.setText(displayText)

      if (currentIteration >= iterations) {
        textObject.setText(finalText)
        timer.remove()
      }
    },
    repeat: iterations
  })
}

export default networkEffects
