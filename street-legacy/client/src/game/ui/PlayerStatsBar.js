// PlayerStatsBar - Displays energy, heat, and cooldown status
// Reusable component for CrimeScene, JobScene, and other action screens

import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { DEPTH, LAYOUT } from './NetworkTheme'

export class PlayerStatsBar {
  constructor(scene, options = {}) {
    this.scene = scene
    this.x = options.x || 20
    this.y = options.y || LAYOUT.SAFE_AREA_TOP + 5
    this.width = options.width || scene.cameras.main.width - 40
    this.depth = options.depth || DEPTH.STATS_BAR
    this.showHeat = options.showHeat !== false
    this.cooldownAction = options.cooldownAction || 'crime' // 'crime' or 'job'

    this.container = null
    this.energyBar = null
    this.energyFill = null
    this.energyText = null
    this.heatBar = null
    this.heatFill = null
    this.heatText = null
    this.cooldownBar = null
    this.cooldownFill = null
    this.cooldownText = null
    this.regenText = null

    this.updateTimer = null
    this.lastCooldownEnd = 0
  }

  create() {
    const { width } = this.scene.cameras.main
    const barHeight = 55
    const player = gameManager.player || {}

    // Container for all stats
    this.container = this.scene.add.container(0, 0).setDepth(this.depth)

    // Background panel
    const bg = this.scene.add.rectangle(
      this.x + this.width / 2,
      this.y + barHeight / 2,
      this.width,
      barHeight,
      0x1a1a2e,
      0.95
    ).setStrokeStyle(1, 0x2a2a4a, 0.8)
    this.container.add(bg)

    // === ENERGY BAR ===
    const energyX = this.x + 15
    const energyY = this.y + 18
    const energyBarWidth = this.showHeat ? (this.width - 40) / 2 - 10 : this.width - 40

    // Energy label
    const energyLabel = this.scene.add.text(energyX, energyY - 10, '⚡ ENERGY', {
      fontSize: '9px',
      color: '#60a5fa',
      fontStyle: 'bold'
    })
    this.container.add(energyLabel)

    // Energy bar background
    this.energyBar = this.scene.add.rectangle(
      energyX + energyBarWidth / 2,
      energyY + 8,
      energyBarWidth,
      14,
      0x1e3a5f,
      1
    ).setStrokeStyle(1, 0x3b82f6, 0.5)
    this.container.add(this.energyBar)

    // Energy fill
    const energy = player.energy || player.stamina || 100
    const maxEnergy = player.maxEnergy || 100
    const energyPercent = energy / maxEnergy

    this.energyFill = this.scene.add.rectangle(
      energyX + 1,
      energyY + 8,
      Math.max(1, (energyBarWidth - 2) * energyPercent),
      12,
      this.getEnergyColor(energyPercent)
    ).setOrigin(0, 0.5)
    this.container.add(this.energyFill)

    // Energy text
    this.energyText = this.scene.add.text(
      energyX + energyBarWidth / 2,
      energyY + 8,
      `${Math.floor(energy)} / ${maxEnergy}`,
      {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5)
    this.container.add(this.energyText)

    // Regen indicator
    this.regenText = this.scene.add.text(
      energyX + energyBarWidth + 5,
      energyY + 8,
      '+5/min',
      {
        fontSize: '8px',
        color: '#22c55e'
      }
    ).setOrigin(0, 0.5)
    this.container.add(this.regenText)

    // === HEAT BAR (if enabled) ===
    if (this.showHeat) {
      const heatX = this.x + this.width / 2 + 10
      const heatY = this.y + 18
      const heatBarWidth = (this.width - 40) / 2 - 10

      // Heat label
      const heatLabel = this.scene.add.text(heatX, heatY - 10, '🔥 HEAT', {
        fontSize: '9px',
        color: '#f97316',
        fontStyle: 'bold'
      })
      this.container.add(heatLabel)

      // Heat bar background
      this.heatBar = this.scene.add.rectangle(
        heatX + heatBarWidth / 2,
        heatY + 8,
        heatBarWidth,
        14,
        0x3f1f1f,
        1
      ).setStrokeStyle(1, 0xef4444, 0.5)
      this.container.add(this.heatBar)

      // Heat fill
      const heat = player.heat || player.heat_level || 0
      const heatPercent = heat / 100

      this.heatFill = this.scene.add.rectangle(
        heatX + 1,
        heatY + 8,
        Math.max(1, (heatBarWidth - 2) * heatPercent),
        12,
        this.getHeatColor(heatPercent)
      ).setOrigin(0, 0.5)
      this.container.add(this.heatFill)

      // Heat text
      this.heatText = this.scene.add.text(
        heatX + heatBarWidth / 2,
        heatY + 8,
        `${Math.floor(heat)}%`,
        {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5)
      this.container.add(this.heatText)

      // Heat warning indicator
      if (heat >= 50) {
        const warningText = this.scene.add.text(
          heatX + heatBarWidth + 5,
          heatY + 8,
          heat >= 75 ? '⚠️' : '!',
          {
            fontSize: '10px',
            color: heat >= 75 ? '#ef4444' : '#f97316'
          }
        ).setOrigin(0, 0.5)
        this.container.add(warningText)
      }
    }

    // === COOLDOWN BAR (bottom row) ===
    const cooldownY = this.y + 40
    const cooldownWidth = this.width - 30
    const cooldownX = this.x + 15

    // Cooldown bar background (hidden when no cooldown)
    this.cooldownBar = this.scene.add.rectangle(
      cooldownX + cooldownWidth / 2,
      cooldownY,
      cooldownWidth,
      10,
      0x2a2a3a,
      1
    ).setStrokeStyle(1, 0x4b5563, 0.5).setVisible(false)
    this.container.add(this.cooldownBar)

    // Cooldown fill
    this.cooldownFill = this.scene.add.rectangle(
      cooldownX + 1,
      cooldownY,
      0,
      8,
      0x8b5cf6
    ).setOrigin(0, 0.5).setVisible(false)
    this.container.add(this.cooldownFill)

    // Cooldown text
    this.cooldownText = this.scene.add.text(
      cooldownX + cooldownWidth / 2,
      cooldownY,
      '⏱️ Ready',
      {
        fontSize: '9px',
        color: '#22c55e',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5)
    this.container.add(this.cooldownText)

    // Start update loop
    this.startUpdating()

    return this
  }

  getEnergyColor(percent) {
    if (percent > 0.6) return 0x22c55e // Green
    if (percent > 0.3) return 0xf59e0b // Orange
    return 0xef4444 // Red
  }

  getHeatColor(percent) {
    if (percent < 0.3) return 0xf59e0b // Orange
    if (percent < 0.6) return 0xf97316 // Dark Orange
    return 0xef4444 // Red
  }

  startUpdating() {
    // Update every 100ms for smooth cooldown display
    this.updateTimer = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.update()
    })
  }

  update() {
    const player = gameManager.player
    if (!player) return

    // Update energy bar
    const energy = player.energy || player.stamina || 100
    const maxEnergy = player.maxEnergy || 100
    const energyPercent = Math.max(0, Math.min(1, energy / maxEnergy))
    const energyBarWidth = this.showHeat ? (this.width - 40) / 2 - 10 : this.width - 40

    this.energyFill.width = Math.max(1, (energyBarWidth - 2) * energyPercent)
    this.energyFill.setFillStyle(this.getEnergyColor(energyPercent))
    this.energyText.setText(`${Math.floor(energy)} / ${maxEnergy}`)

    // Pulse energy bar when low
    if (energyPercent < 0.3) {
      const pulse = 0.8 + Math.sin(Date.now() * 0.01) * 0.2
      this.energyFill.setAlpha(pulse)
    } else {
      this.energyFill.setAlpha(1)
    }

    // Update heat bar (if showing)
    if (this.showHeat && this.heatFill) {
      const heat = player.heat || player.heat_level || 0
      const heatPercent = Math.max(0, Math.min(1, heat / 100))
      const heatBarWidth = (this.width - 40) / 2 - 10

      this.heatFill.width = Math.max(1, (heatBarWidth - 2) * heatPercent)
      this.heatFill.setFillStyle(this.getHeatColor(heatPercent))
      this.heatText.setText(`${Math.floor(heat)}%`)

      // Pulse heat bar when high
      if (heatPercent > 0.7) {
        const pulse = 0.8 + Math.sin(Date.now() * 0.01) * 0.2
        this.heatFill.setAlpha(pulse)
      } else {
        this.heatFill.setAlpha(1)
      }
    }

    // Update cooldown display
    const cooldownRemaining = gameManager.getCooldownRemaining(this.cooldownAction)
    const cooldownWidth = this.width - 30

    if (cooldownRemaining > 0) {
      // Show cooldown bar
      this.cooldownBar.setVisible(true)
      this.cooldownFill.setVisible(true)

      // Calculate progress - use stored cooldown duration or estimate from action type
      // Crime cooldowns are typically 15-45s, job cooldowns 30-90s
      if (!this.cooldownDuration || cooldownRemaining > this.cooldownDuration) {
        // Store initial duration when cooldown first appears or resets
        this.cooldownDuration = Math.max(cooldownRemaining,
          this.cooldownAction === 'crime' ? 30000 : 60000)
      }
      const elapsed = this.cooldownDuration - cooldownRemaining
      const progress = Math.min(1, elapsed / this.cooldownDuration)

      this.cooldownFill.width = Math.max(1, (cooldownWidth - 2) * progress)

      const seconds = (cooldownRemaining / 1000).toFixed(1)
      this.cooldownText.setText(`⏱️ Cooldown: ${seconds}s`)
      this.cooldownText.setColor('#fbbf24')

      // Pulse cooldown bar
      const pulse = 0.7 + Math.sin(Date.now() * 0.008) * 0.3
      this.cooldownFill.setAlpha(pulse)
    } else {
      // Hide cooldown bar, show ready
      this.cooldownBar.setVisible(false)
      this.cooldownFill.setVisible(false)
      this.cooldownText.setText('✅ Ready!')
      this.cooldownText.setColor('#22c55e')
      // Reset stored duration for next cooldown
      this.cooldownDuration = null
    }
  }

  // Show a warning message (e.g., "Not enough energy!")
  showWarning(message) {
    const { width, height } = this.scene.cameras.main

    const warningBg = this.scene.add.rectangle(
      width / 2,
      this.y + 80,
      250,
      36,
      0x7f1d1d,
      0.95
    ).setStrokeStyle(2, 0xef4444, 0.8).setDepth(this.depth + 10)

    const warningText = this.scene.add.text(
      width / 2,
      this.y + 80,
      `⚠️ ${message}`,
      {
        fontSize: '14px',
        color: '#fecaca',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5).setDepth(this.depth + 11)

    // Shake effect
    this.scene.tweens.add({
      targets: [warningBg, warningText],
      x: '+=5',
      duration: 50,
      yoyo: true,
      repeat: 3
    })

    // Fade out after 2 seconds
    this.scene.time.delayedCall(2000, () => {
      this.scene.tweens.add({
        targets: [warningBg, warningText],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          warningBg.destroy()
          warningText.destroy()
        }
      })
    })
  }

  // Show cooldown warning with remaining time
  showCooldownWarning() {
    const remaining = gameManager.getCooldownRemaining(this.cooldownAction)
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000)
      this.showWarning(`Wait ${seconds}s before next action`)
    }
  }

  // Get the height of the stats bar (for positioning content below)
  getHeight() {
    return 65
  }

  destroy() {
    if (this.updateTimer) {
      this.updateTimer.destroy()
    }
    if (this.container) {
      this.container.destroy()
    }
  }
}

export default PlayerStatsBar
