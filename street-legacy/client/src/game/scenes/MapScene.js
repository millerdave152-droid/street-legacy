import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { achievementPopup } from '../ui/AchievementPopup'
import { DISTRICTS } from '../data/GameData.js'
import { DistrictStateIndicator } from '../ui/DistrictStateIndicator.js'
import { DistrictDetailPanel } from '../ui/DistrictDetailPanel.js'
import { districtEcosystemService } from '../../services/districtEcosystem.service.js'
import { audioManager } from '../managers/AudioManager'

export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' })
    this.districtStates = new Map() // Map<districtId, state>
    this.stateIndicators = new Map() // Map<districtId, DistrictStateIndicator>
  }

  async create() {
    console.log('[MapScene] create() started')
    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
      }
    } catch (e) {}

    // Overlay
    this.add.rectangle(0, 0, width, height, 0x0a0a1a, 1).setOrigin(0).setDepth(100).setInteractive()

    // Grid pattern
    this.createGridPattern()

    // Header with icon
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Get player and districts (local data)
    const player = gameManager.player || {}
    const playerLevel = player.level || 1

    // Current location panel
    this.createCurrentLocationPanel(player)

    // Use local districts data
    let districts = []
    try {
      districts = await gameManager.getDistricts()
    } catch (error) {
      console.log('[MapScene] Using fallback districts')
    }

    // Fallback to local data if needed
    if (!districts || districts.length === 0) {
      districts = DISTRICTS.map(d => ({
        ...d,
        is_current: d.id === player.current_district_id,
        is_locked: (d.min_level || 1) > playerLevel,
      }))
    }

    // Load district ecosystem states
    await this.loadDistrictStates()

    this.createDistrictList(districts)

    // Create detail panel (hidden initially)
    this.createDetailPanel()

    // Cooldown display
    this.cooldownText = this.add.text(width / 2, height - 30, '', {
      fontSize: '12px',
      color: '#fbbf24'
    }).setOrigin(0.5).setDepth(101)

    this.updateCooldown()
  }

  createGridPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(100)

    graphics.lineStyle(1, 0x1a2530, 0.15)
    for (let x = 0; x < width; x += 30) {
      graphics.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 30) {
      graphics.lineBetween(0, y, width, y)
    }
  }

  createHeader() {
    const { width } = this.cameras.main

    // Icon background
    const iconBg = this.add.circle(width / 2, 32, 26, 0x1a2530)
      .setStrokeStyle(2, 0x3b82f6, 0.5)
      .setDepth(101)

    this.add.text(width / 2, 32, '🗺️', {
      fontSize: '26px'
    }).setOrigin(0.5).setDepth(102)

    // Title
    this.add.text(width / 2, 68, 'TRAVEL', {
      fontSize: '18px',
      color: '#3b82f6',
      fontFamily: 'Arial Black, Arial'
    }).setOrigin(0.5).setDepth(101)
  }

  createCurrentLocationPanel(player) {
    const { width } = this.cameras.main
    const panelY = 105
    const panelHeight = 65

    // Find current district
    const currentDistrictId = player.current_district_id || 'parkdale'
    const currentDistrict = DISTRICTS.find(d => d.id === currentDistrictId) || DISTRICTS[0]

    const districtIcons = {
      'parkdale': '🏠', 'downtown': '🏙️', 'chinatown': '🏮', 'waterfront': '⚓',
      'financial': '💼', 'industrial': '🏭', 'suburbs': '🏡', 'underground': '🚇'
    }
    const icon = districtIcons[currentDistrictId] || '📍'

    // District bonuses based on type
    const districtBonuses = {
      'parkdale': { bonus: '+10% Job Pay', icon: '💰' },
      'downtown': { bonus: '+15% Robbery Loot', icon: '💎' },
      'chinatown': { bonus: '+20% Black Market', icon: '🎰' },
      'waterfront': { bonus: '+15% Smuggling', icon: '📦' },
      'financial': { bonus: '+25% Investment Returns', icon: '📈' },
      'industrial': { bonus: '+20% Crew Efficiency', icon: '⚙️' },
      'suburbs': { bonus: '-20% Heat Gain', icon: '🛡️' },
      'underground': { bonus: '+30% Crime Payout', icon: '💀' }
    }
    const bonusInfo = districtBonuses[currentDistrictId] || { bonus: 'None', icon: '❓' }

    // Panel background
    this.add.rectangle(width / 2, panelY, width - 30, panelHeight, 0x1e3050, 0.95)
      .setStrokeStyle(1, 0x3b82f6, 0.5)
      .setDepth(101)

    // Current location label
    this.add.text(25, panelY - 25, '📍 CURRENT LOCATION', {
      fontSize: '9px',
      color: '#3b82f6',
      fontStyle: 'bold'
    }).setDepth(102)

    // District icon and name
    this.add.text(30, panelY - 5, `${icon} ${currentDistrict?.name || 'Unknown'}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(102)

    // District bonus display
    this.add.text(30, panelY + 15, `${bonusInfo.icon} ${bonusInfo.bonus}`, {
      fontSize: '11px',
      color: '#22c55e'
    }).setDepth(102)

    // Danger level badge
    const dangerLevel = currentDistrict?.danger_level || 1
    const dangerNames = { 1: 'Safe', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Extreme' }
    const dangerColors = { 1: 0x22c55e, 2: 0x3b82f6, 3: 0xf59e0b, 4: 0xf97316, 5: 0xef4444 }

    const badgeX = width - 60
    this.add.rectangle(badgeX, panelY - 8, 70, 20, dangerColors[dangerLevel], 0.3)
      .setStrokeStyle(1, dangerColors[dangerLevel], 0.5)
      .setDepth(102)

    this.add.text(badgeX, panelY - 8, `${dangerNames[dangerLevel]}`, {
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(103)

    // Rewards multiplier indicator
    const rewardsMult = dangerLevel === 1 ? '1x' : `${1 + (dangerLevel - 1) * 0.25}x`
    this.add.text(badgeX, panelY + 12, `💵 ${rewardsMult} Rewards`, {
      fontSize: '9px',
      color: '#fbbf24'
    }).setOrigin(0.5).setDepth(102)
  }

  async loadDistrictStates() {
    try {
      const states = await districtEcosystemService.getAllDistrictStates()
      states.forEach(state => {
        this.districtStates.set(state.districtId, state)
      })
      console.log(`[MapScene] Loaded ${states.length} district states`)
    } catch (error) {
      console.error('[MapScene] Failed to load district states:', error)
    }
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    })
    .setOrigin(0.5)
    .setDepth(999)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#3b82f6')
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff')
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[MapScene] Close button clicked')
      this.closeScene()
    })
  }

  createDistrictList(districts) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || {}
    const playerLevel = player.level || 1
    const startY = 175 // Account for header + current location panel
    const itemHeight = 55

    console.log('[MapScene] createDistrictList called with', districts?.length || 0, 'districts')

    if (!districts || districts.length === 0) {
      this.add.text(width / 2, 200, 'No districts available', {
        fontSize: '16px',
        color: '#888888'
      }).setOrigin(0.5).setDepth(101)
      return
    }

    // Calculate max visible districts
    const maxVisible = Math.floor((height - startY - 60) / itemHeight)

    this.districtCards = []

    districts.slice(0, maxVisible).forEach((district, index) => {
      const y = startY + index * itemHeight
      this.createDistrictCard(district, y, player, playerLevel)
    })
  }

  createDistrictCard(district, y, player, playerLevel) {
    const { width } = this.cameras.main
    const itemHeight = 55

    const isCurrentDistrict = district.id === (player.current_district_id || 'parkdale') || district.is_current
    const minLevel = district.min_level || 1
    const canTravel = minLevel <= playerLevel
    const isLocked = !canTravel || district.is_locked

    // Get district ecosystem state
    const districtState = this.districtStates.get(district.id)
    const status = districtState?.status || 'stable'

    // Danger-based colors with ecosystem status overlay
    const dangerColors = {
      1: { bg: 0x1e3a2e, border: 0x22c55e, name: 'Safe' },
      2: { bg: 0x1e2a3e, border: 0x3b82f6, name: 'Low' },
      3: { bg: 0x2e2a1e, border: 0xf59e0b, name: 'Medium' },
      4: { bg: 0x3e2a1e, border: 0xf97316, name: 'High' },
      5: { bg: 0x3e1e2e, border: 0xef4444, name: 'Extreme' }
    }

    // Status-based color adjustments
    const statusColorMods = {
      stable: { tint: null, particle: null },
      volatile: { tint: 0xf59e0b, particle: 'orange' },
      warzone: { tint: 0xef4444, particle: 'red' },
      gentrifying: { tint: 0x22c55e, particle: 'green' },
      declining: { tint: 0x6b7280, particle: 'gray' }
    }

    const dangerLevel = district.danger_level || 1
    const colors = dangerColors[dangerLevel] || dangerColors[1]
    const statusMod = statusColorMods[status] || statusColorMods.stable

    let bgColor = colors.bg
    let borderColor = colors.border
    let borderAlpha = 0.4

    // Apply status tint
    if (statusMod.tint && canTravel && !isCurrentDistrict) {
      bgColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(bgColor),
        Phaser.Display.Color.ValueToColor(statusMod.tint),
        100,
        20 // 20% blend
      )
      bgColor = Phaser.Display.Color.GetColor(bgColor.r, bgColor.g, bgColor.b)
    }

    if (isCurrentDistrict) {
      bgColor = 0x1e3050
      borderColor = 0x3b82f6
      borderAlpha = 0.8
    } else if (isLocked) {
      bgColor = 0x1a1a2a
      borderColor = 0x333333
      borderAlpha = 0.3
    }

    // Card background
    const card = this.add.rectangle(width / 2, y + 25, width - 35, itemHeight - 5, bgColor, canTravel ? 0.95 : 0.6)
      .setDepth(101)

    // Left accent bar - colored by ecosystem status if volatile/warzone
    let accentColor = canTravel ? borderColor : 0x444444
    if (status === 'warzone') accentColor = 0xef4444
    else if (status === 'volatile') accentColor = 0xf59e0b
    else if (status === 'gentrifying') accentColor = 0x22c55e

    const accentBar = this.add.rectangle(23, y + 25, 4, itemHeight - 15, accentColor)
      .setDepth(102)

    // Add subtle particle effect for warzone/volatile districts
    if ((status === 'warzone' || status === 'volatile') && canTravel) {
      this.addStatusParticles(card, y, status)
    }

    if (canTravel && !isCurrentDistrict) {
      card.setStrokeStyle(1, borderColor, borderAlpha)
        .setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(Phaser.Display.Color.ValueToColor(bgColor).lighten(15).color, 1)
        card.setStrokeStyle(2, borderColor, 0.7)
        accentBar.setFillStyle(Phaser.Display.Color.ValueToColor(accentColor).lighten(20).color)
        this.tweens.add({
          targets: card,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 80
        })
      })

      card.on('pointerout', () => {
        card.setFillStyle(bgColor, 0.95)
        card.setStrokeStyle(1, borderColor, borderAlpha)
        accentBar.setFillStyle(accentColor)
        this.tweens.add({
          targets: card,
          scaleX: 1,
          scaleY: 1,
          duration: 80
        })
      })

      card.on('pointerdown', () => {
        this.tweens.add({
          targets: card,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          onComplete: () => this.travelTo(district)
        })
      })
    } else if (isCurrentDistrict) {
      card.setStrokeStyle(2, 0x3b82f6, 0.8)
    } else {
      card.setStrokeStyle(1, 0x333333, 0.3)
    }

    // District icon based on type
    const districtIcons = {
      'parkdale': '🏠',
      'downtown': '🏙️',
      'chinatown': '🏮',
      'waterfront': '⚓',
      'financial': '💼',
      'industrial': '🏭',
      'suburbs': '🏡',
      'underground': '🚇'
    }
    const icon = districtIcons[district.id] || '📍'
    this.add.text(38, y + 18, icon, { fontSize: '16px' }).setDepth(103).setAlpha(canTravel ? 0.9 : 0.4)

    // District name
    this.add.text(60, y + 12, district.name, {
      fontSize: '14px',
      color: canTravel ? '#ffffff' : '#555555',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setDepth(102)

    // Danger badge
    if (canTravel && !isCurrentDistrict) {
      const badgeWidth = 50
      this.add.rectangle(60 + badgeWidth / 2, y + 32, badgeWidth, 14, borderColor, 0.2)
        .setStrokeStyle(1, borderColor, 0.4).setDepth(102)
      this.add.text(60 + badgeWidth / 2, y + 32, colors.name, {
        fontSize: '8px',
        color: canTravel ? '#ffffff' : '#555555'
      }).setOrigin(0.5).setDepth(103)
    }

    // Description
    if (district.description) {
      this.add.text(125, y + 28, district.description.substring(0, 30) + (district.description.length > 30 ? '...' : ''), {
        fontSize: '9px',
        color: canTravel ? '#999999' : '#444444'
      }).setDepth(102)
    }

    // District State Indicator (ecosystem status)
    if (canTravel && districtState) {
      const indicator = new DistrictStateIndicator(this, width - 120, y + 25, {
        districtId: district.id,
        width: 70,
        height: 20,
        onClick: (state, districtId) => this.showDistrictDetail(district, state)
      })
      indicator.setDepth(104)
      indicator.setState(districtState)
      this.stateIndicators.set(district.id, indicator)
    }

    // Right side status
    if (isCurrentDistrict) {
      // Current location badge
      const hereBg = this.add.rectangle(width - 55, y + 25, 70, 24, 0x3b82f6, 0.3)
        .setStrokeStyle(1, 0x3b82f6, 0.6).setDepth(102)
      this.add.text(width - 55, y + 25, '📍 HERE', {
        fontSize: '11px',
        color: '#60a5fa',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(103)

      // Pulsing effect
      this.tweens.add({
        targets: hereBg,
        alpha: { from: 0.3, to: 0.6 },
        duration: 800,
        yoyo: true,
        repeat: -1
      })

      // Add state indicator below the HERE badge for current district
      if (districtState) {
        const indicator = new DistrictStateIndicator(this, width - 55, y + 45, {
          districtId: district.id,
          width: 65,
          height: 18,
          compact: true,
          onClick: (state, districtId) => this.showDistrictDetail(district, state)
        })
        indicator.setDepth(104)
        indicator.setState(districtState)
        this.stateIndicators.set(district.id, indicator)
      }
    } else if (isLocked) {
      this.add.rectangle(width - 55, y + 25, 60, 22, 0xef4444, 0.15)
        .setStrokeStyle(1, 0xef4444, 0.3).setDepth(102)
      this.add.text(width - 55, y + 25, `🔒 Lv.${minLevel}`, {
        fontSize: '10px',
        color: '#ef4444'
      }).setOrigin(0.5).setDepth(103)
    } else {
      // Travel indicator (moved to make room for state indicator)
      this.add.text(width - 25, y + 25, '→', {
        fontSize: '18px',
        color: borderColor
      }).setOrigin(0.5).setDepth(103).setAlpha(0.6)
    }

    this.districtCards.push(card)
  }

  addStatusParticles(card, y, status) {
    // Simple pulsing glow effect for dangerous districts
    const glowColor = status === 'warzone' ? 0xef4444 : 0xf59e0b
    const glowAlpha = status === 'warzone' ? 0.15 : 0.1

    const glow = this.add.rectangle(card.x, y + 25, card.width + 10, card.height + 5, glowColor, 0)
      .setDepth(100)

    this.tweens.add({
      targets: glow,
      alpha: { from: 0, to: glowAlpha },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  createDetailPanel() {
    const { width, height } = this.cameras.main

    this.detailPanel = new DistrictDetailPanel(this, width / 2, height / 2, {
      width: Math.min(320, width - 40),
      height: Math.min(400, height - 80),
      onClose: () => {
        // Panel handles its own hide animation
      }
    })
    this.detailPanel.setDepth(200)
  }

  async showDistrictDetail(district, state) {
    if (!this.detailPanel) return

    // Update panel with district info
    this.detailPanel.config.districtName = district.name
    this.detailPanel.titleText?.setText(district.name.toUpperCase())

    // Fetch full district info (state + modifiers + events)
    try {
      const fullInfo = await districtEcosystemService.getFullDistrictInfo(district.id)
      this.detailPanel.setState(fullInfo.state, fullInfo.modifiers)
      this.detailPanel.setEvents(fullInfo.events)
    } catch (error) {
      console.error('[MapScene] Failed to load district detail:', error)
      // Use cached state if available
      if (state) {
        this.detailPanel.setState(state, null)
        this.detailPanel.setEvents([])
      }
    }

    this.detailPanel.show(district.name)
  }

  async travelTo(district) {
    if (gameManager.isOnCooldown('travel')) {
      audioManager.playMiss()
      this.showCooldownWarning()
      return
    }

    const { width, height } = this.cameras.main

    // Play travel sound
    audioManager.playSuccess()

    // Show traveling animation
    const travelBg = this.add.rectangle(width / 2, height / 2, 300, 120, 0x1a2530, 0.98)
      .setStrokeStyle(2, 0x3b82f6, 0.6)
      .setDepth(300)

    const travelIcon = this.add.text(width / 2, height / 2 - 20, '🚗', {
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(301)

    const travelText = this.add.text(width / 2, height / 2 + 20, `Traveling to ${district.name}...`, {
      fontSize: '16px',
      color: '#60a5fa',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(301)

    // Animate travel icon
    this.tweens.add({
      targets: travelIcon,
      x: width / 2 + 30,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    try {
      await gameManager.travel(district.id)

      // Stop icon animation
      this.tweens.killTweensOf(travelIcon)
      travelIcon.setX(width / 2)
      travelIcon.setText('✅')
      travelText.setText(`Arrived in ${district.name}!`)
      travelText.setColor('#22c55e')

      // Flash effect
      this.cameras.main.flash(200, 34, 197, 94)
      audioManager.playHit()

      // Clear district cache for new location to get fresh data
      districtEcosystemService.clearDistrictCache(district.id)

      // Check for travel achievements
      this.checkAchievements()

      this.time.delayedCall(1000, () => {
        this.closeScene()
      })
    } catch (error) {
      this.tweens.killTweensOf(travelIcon)
      travelIcon.setText('❌')
      travelText.setText('Travel failed!')
      travelText.setColor('#ef4444')
      audioManager.playMiss()

      this.time.delayedCall(1500, () => {
        travelBg.destroy()
        travelIcon.destroy()
        travelText.destroy()
      })
    }
  }

  showCooldownWarning() {
    const { width } = this.cameras.main
    const remaining = gameManager.getCooldownRemaining('travel')
    const seconds = Math.ceil(remaining / 1000)

    const warningBg = this.add.rectangle(width / 2, 200, 220, 40, 0x7f1d1d, 0.95)
      .setStrokeStyle(1, 0xef4444, 0.6)
      .setDepth(250)

    const warningText = this.add.text(width / 2, 200, `⏱️ Wait ${seconds}s to travel`, {
      fontSize: '13px',
      color: '#fecaca',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(251)

    // Shake effect
    this.tweens.add({
      targets: [warningBg, warningText],
      x: '+=4',
      duration: 50,
      yoyo: true,
      repeat: 3
    })

    // Fade out
    this.time.delayedCall(2000, () => {
      this.tweens.add({
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

  async checkAchievements() {
    try {
      achievementPopup.setScene(this)
      const result = await gameManager.checkAchievements()
      if (result?.new_achievements?.length > 0) {
        achievementPopup.showMultiple(result.new_achievements)
      }
    } catch (error) {
      console.error('Failed to check achievements:', error)
    }
  }

  updateCooldown() {
    this.cooldownTimer = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        const remaining = gameManager.getCooldownRemaining('travel')
        if (remaining > 0) {
          this.cooldownText.setText(`Travel cooldown: ${(remaining / 1000).toFixed(1)}s`)
          this.cooldownText.setVisible(true)
        } else {
          this.cooldownText.setVisible(false)
        }
      }
    })
  }

  closeScene() {
    if (this.cooldownTimer) this.cooldownTimer.destroy()

    // Cleanup indicators
    this.stateIndicators.forEach(indicator => indicator.destroy())
    this.stateIndicators.clear()

    // Cleanup detail panel
    if (this.detailPanel) {
      this.detailPanel.destroy()
    }

    const sceneManager = this.scene

    // CRITICAL: Re-enable input on GameScene BEFORE resuming
    try {
      const gameScene = sceneManager.get('GameScene')
      if (gameScene) {
        gameScene.input.enabled = true
      }
    } catch (e) {}

    sceneManager.stop()

    // CRITICAL: Bring GameScene to top and resume
    try {
      sceneManager.bringToTop('GameScene')
    } catch (e) {}
    sceneManager.resume('GameScene')
    try {
      sceneManager.resume('UIScene')
    } catch (e) {}
  }
}
