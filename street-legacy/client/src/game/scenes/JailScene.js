/**
 * JailScene - Interactive Prison Scene
 *
 * Players can perform activities while jailed:
 * - Work Detail: Earn small cash, reduce sentence
 * - Make Connections: Build prison reputation
 * - Plan Escape: Increase jailbreak success chance
 * - Lay Low: Passive good behavior for faster release
 *
 * Options to exit:
 * - Pay Bail (reduced by lawyer)
 * - Attempt Jailbreak (risky, can extend sentence)
 * - Wait for release
 */

import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import {
  getPlayerData,
  savePlayerData,
  JAIL_ACTIVITIES,
  JAIL_TIMES,
  getPlayerLawyer,
  calculateBail,
  calculateJailTime,
  payBail,
  attemptJailbreak,
  getWantedLevel,
  requestParole,
  PAROLE_CONFIG
} from '../data/GameData.js'
import { COLORS, BORDERS, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

export class JailScene extends Phaser.Scene {
  constructor() {
    super('JailScene')
    this.activityCooldowns = {}
    this.layingLow = false
    this.updateTimer = null
    this.contentItems = []
  }

  init(data) {
    this.initData = data || {}
    this.returnScene = data?.returnScene || 'GameScene'

    // Initialize activity cooldowns from player data
    const player = gameManager.player || getPlayerData() || {}
    this.activityCooldowns = player.jailActivityCooldowns || {}
    this.layingLow = player.layingLow || false
  }

  create() {
    const { width, height } = this.cameras.main

    // Dark prison background
    this.add.rectangle(0, 0, width, height, 0x0a0a0f, 1).setOrigin(0).setDepth(0)

    // Create prison bar pattern
    this.createPrisonBars()

    // Header
    this.createHeader()

    // Timer display
    this.createTimerDisplay()

    // Activities grid
    this.createActivitiesGrid()

    // Parole section
    this.createParoleSection()

    // Action buttons (Bail / Jailbreak)
    this.createActionButtons()

    // Start update loop
    this.updateTimer = this.time.addEvent({
      delay: 1000,
      callback: this.updateJailStatus,
      callbackScope: this,
      loop: true
    })

    // Initial update
    this.updateJailStatus()
  }

  createPrisonBars() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(1)

    // Vertical prison bars
    graphics.lineStyle(4, 0x333344, 0.3)
    const barSpacing = 30
    for (let x = 0; x < width; x += barSpacing) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    graphics.strokePath()

    // Horizontal bars at top and bottom
    graphics.lineStyle(6, 0x444455, 0.4)
    graphics.moveTo(0, 70)
    graphics.lineTo(width, 70)
    graphics.moveTo(0, height - 80)
    graphics.lineTo(width, height - 80)
    graphics.strokePath()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background
    this.add.rectangle(width / 2, 35, width, 70, 0x1a1a2e, 0.95).setDepth(10)

    // Red accent line
    this.add.rectangle(width / 2, 68, width, 2, 0xEF4444, 0.8).setDepth(10)

    // Prison icon
    const icon = this.add.text(width / 2 - 100, 28, '[!]', {
      ...getTerminalStyle('lg'),
      color: '#EF4444'
    }).setOrigin(0.5).setDepth(11)

    // Pulse animation
    this.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Title
    this.add.text(width / 2, 28, 'HOLDING CELL', {
      ...getTerminalStyle('xl'),
      color: '#EF4444'
    }).setOrigin(0.5).setDepth(11)

    // Subtitle
    this.add.text(width / 2, 52, `${SYMBOLS.system} DETENTION FACILITY`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(11)
  }

  createTimerDisplay() {
    const { width } = this.cameras.main
    const timerY = 100

    // Timer card background
    this.timerCard = this.add.rectangle(width / 2, timerY + 30, width - 30, 70, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xEF4444, 0.5)
      .setDepth(10)

    // Time remaining label
    this.add.text(width / 2, timerY + 10, 'TIME REMAINING', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(11)

    // Timer text (will be updated)
    this.timerText = this.add.text(width / 2, timerY + 35, '00:00', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#EF4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Status text
    this.statusText = this.add.text(width / 2, timerY + 58, 'Processing...', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(11)
  }

  createActivitiesGrid() {
    const { width } = this.cameras.main
    const startY = 190
    const cardWidth = (width - 50) / 2
    const cardHeight = 80

    this.add.text(25, startY - 15, `${SYMBOLS.system} ACTIVITIES`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(11)

    this.activityButtons = []

    JAIL_ACTIVITIES.forEach((activity, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = 25 + col * (cardWidth + 10)
      const y = startY + 10 + row * (cardHeight + 10)

      this.createActivityCard(activity, x, y, cardWidth, cardHeight)
    })
  }

  createActivityCard(activity, x, y, cardWidth, cardHeight) {
    const isLayLow = activity.id === 'lay_low'
    const isActive = isLayLow && this.layingLow

    // Card background
    const card = this.add.rectangle(x + cardWidth / 2, y + cardHeight / 2, cardWidth, cardHeight, 0x1a1a2e, 0.95)
      .setStrokeStyle(isActive ? 2 : 1, isActive ? 0x22C55E : 0x444466, isActive ? 0.8 : 0.4)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    // Icon
    const icon = this.add.text(x + 25, y + cardHeight / 2, activity.icon, {
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(11)
    this.contentItems.push(icon)

    // Name
    const name = this.add.text(x + 50, y + 15, activity.name.toUpperCase(), {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(name)

    // Description
    const desc = this.add.text(x + 50, y + 32, activity.description, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(11)
    this.contentItems.push(desc)

    // Effect text
    let effectText = ''
    if (activity.effects.cashMin) effectText = `$${activity.effects.cashMin}-${activity.effects.cashMax}`
    if (activity.effects.timeReduction) effectText += effectText ? ', -10s' : '-10s'
    if (activity.effects.jailbreakBonus) effectText = `+${activity.effects.jailbreakBonus}% escape`
    if (activity.effects.prisonRep) effectText = '+Rep'
    if (activity.effects.timeMultiplier) effectText = isActive ? 'ACTIVE' : 'Toggle'

    const effect = this.add.text(x + 50, y + 50, effectText, {
      ...getTextStyle('xs', isActive ? 0x22C55E : 0x3B82F6, 'terminal')
    }).setDepth(11)
    this.contentItems.push(effect)

    // Cooldown text (will be updated)
    const cooldownText = this.add.text(x + cardWidth - 15, y + cardHeight / 2, '', {
      ...getTextStyle('xs', 0xF59E0B, 'terminal')
    }).setOrigin(1, 0.5).setDepth(11)
    this.contentItems.push(cooldownText)

    // Store reference for updates
    this.activityButtons.push({
      activity,
      card,
      cooldownText,
      effect,
      isLayLow
    })

    // Hover effects
    card.on('pointerover', () => {
      card.setFillStyle(0x252540)
      audioManager.playHover()
    })

    card.on('pointerout', () => {
      card.setFillStyle(0x1a1a2e)
    })

    card.on('pointerdown', () => {
      audioManager.playClick()
      this.performActivity(activity)
    })
  }

  createParoleSection() {
    const { width, height } = this.cameras.main
    const paroleY = 380

    // Parole section header
    this.add.text(25, paroleY, `${SYMBOLS.system} PAROLE HEARING`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(11)

    // Parole card
    this.paroleCard = this.add.rectangle(width / 2, paroleY + 40, width - 30, 55, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0xA855F7, 0.4)
      .setDepth(10)
    this.contentItems.push(this.paroleCard)

    // Parole icon
    this.add.text(35, paroleY + 40, '⚖️', {
      fontSize: '22px'
    }).setOrigin(0.5).setDepth(11)

    // Parole info text
    this.paroleInfoText = this.add.text(55, paroleY + 28, 'Request early release', {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(this.paroleInfoText)

    // Parole eligibility/progress text
    this.paroleProgressText = this.add.text(55, paroleY + 47, `Eligible after 50% served`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(11)
    this.contentItems.push(this.paroleProgressText)

    // Request parole button
    this.paroleBtn = this.add.rectangle(width - 65, paroleY + 40, 80, 32, 0xA855F7, 0.2)
      .setStrokeStyle(1, 0xA855F7, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(this.paroleBtn)

    this.paroleBtnText = this.add.text(width - 65, paroleY + 40, 'REQUEST', {
      ...getTextStyle('xs', 0xA855F7, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(this.paroleBtnText)

    this.paroleBtn.on('pointerover', () => {
      this.paroleBtn.setFillStyle(0xA855F7, 0.35)
      audioManager.playHover()
    })
    this.paroleBtn.on('pointerout', () => {
      this.paroleBtn.setFillStyle(0xA855F7, 0.2)
    })
    this.paroleBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.attemptParole()
    })
  }

  attemptParole() {
    const player = gameManager.player || getPlayerData() || {}
    const result = requestParole(player)

    if (result.success && result.granted) {
      // Parole granted - release
      if (gameManager.player) Object.assign(gameManager.player, result.player || player)
      this.handleRelease(`${result.message} You are now on parole for 24 hours.`)
    } else if (result.success && !result.granted) {
      // Parole denied
      this.showActivityResult(`${result.message} (${result.chance}% chance)`)
    } else {
      // Not eligible or on cooldown
      this.showActivityResult(result.message)
    }
  }

  updateParoleStatus() {
    const player = gameManager.player || getPlayerData() || {}

    if (!player.is_jailed || !player.jail_until) return

    const now = Date.now()
    const jailEnd = new Date(player.jail_until).getTime()
    const jailStart = player.jail_start ? new Date(player.jail_start).getTime() : (jailEnd - JAIL_TIMES[player.jail_wanted_level || 1])
    const totalSentence = jailEnd - jailStart
    const timeServed = now - jailStart
    const percentServed = Math.min(100, Math.floor((timeServed / totalSentence) * 100))

    const isEligible = percentServed >= (PAROLE_CONFIG.eligibleAfterPercent * 100)

    // Update progress text
    if (isEligible) {
      this.paroleProgressText.setText(`Eligible! ${percentServed}% served`)
      this.paroleProgressText.setColor('#22C55E')
      this.paroleCard.setStrokeStyle(2, 0xA855F7, 0.7)
      this.paroleBtn.setAlpha(1)
      this.paroleBtnText.setText('REQUEST')
    } else {
      const needed = Math.ceil(PAROLE_CONFIG.eligibleAfterPercent * 100)
      this.paroleProgressText.setText(`${percentServed}% served (need ${needed}%)`)
      this.paroleProgressText.setColor(toHexString(COLORS.text.muted))
      this.paroleCard.setStrokeStyle(1, 0x444466, 0.4)
      this.paroleBtn.setAlpha(0.5)
      this.paroleBtnText.setText('LOCKED')
    }

    // Check cooldown after denial
    if (player.parole_denied_at) {
      const deniedAt = new Date(player.parole_denied_at).getTime()
      const remaining = Math.max(0, (deniedAt + PAROLE_CONFIG.cooldownAfterDenial) - now)
      if (remaining > 0) {
        const secs = Math.ceil(remaining / 1000)
        this.paroleBtnText.setText(`${secs}s`)
        this.paroleBtn.setAlpha(0.5)
      }
    }
  }

  createActionButtons() {
    const { width, height } = this.cameras.main
    const btnY = height - 45
    const btnWidth = (width - 50) / 2

    // Bail button
    this.bailBtn = this.add.rectangle(25 + btnWidth / 2, btnY, btnWidth, 45, 0x22C55E, 0.2)
      .setStrokeStyle(2, 0x22C55E, 0.6)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })

    this.bailText = this.add.text(25 + btnWidth / 2, btnY, 'PAY BAIL', {
      ...getTerminalStyle('sm'),
      color: '#22C55E'
    }).setOrigin(0.5).setDepth(11)

    this.bailBtn.on('pointerover', () => {
      this.bailBtn.setFillStyle(0x22C55E, 0.35)
      audioManager.playHover()
    })
    this.bailBtn.on('pointerout', () => {
      this.bailBtn.setFillStyle(0x22C55E, 0.2)
    })
    this.bailBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.attemptPayBail()
    })

    // Jailbreak button
    this.jailbreakBtn = this.add.rectangle(width - 25 - btnWidth / 2, btnY, btnWidth, 45, 0xF59E0B, 0.2)
      .setStrokeStyle(2, 0xF59E0B, 0.6)
      .setDepth(10)
      .setInteractive({ useHandCursor: true })

    this.jailbreakText = this.add.text(width - 25 - btnWidth / 2, btnY, 'JAILBREAK', {
      ...getTerminalStyle('sm'),
      color: '#F59E0B'
    }).setOrigin(0.5).setDepth(11)

    this.jailbreakBtn.on('pointerover', () => {
      this.jailbreakBtn.setFillStyle(0xF59E0B, 0.35)
      audioManager.playHover()
    })
    this.jailbreakBtn.on('pointerout', () => {
      this.jailbreakBtn.setFillStyle(0xF59E0B, 0.2)
    })
    this.jailbreakBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.attemptJailbreak()
    })
  }

  updateJailStatus() {
    const player = gameManager.player || getPlayerData() || {}

    // Check if still jailed
    if (!player.is_jailed || !player.jail_until) {
      this.handleRelease('Your sentence has been served.')
      return
    }

    const jailEnd = new Date(player.jail_until)
    const now = new Date()
    let remaining = Math.max(0, jailEnd - now)

    // Apply lay low bonus (time passes faster)
    if (this.layingLow) {
      // Don't actually speed up real time, but show it's active
      this.statusText.setText('Good behavior - Time reduction active')
      this.statusText.setColor('#22C55E')
    } else {
      const lawyer = getPlayerLawyer(player)
      if (lawyer && lawyer.id !== 'public') {
        this.statusText.setText(`${lawyer.name} on retainer`)
        this.statusText.setColor('#3B82F6')
      } else {
        this.statusText.setText('Awaiting release...')
        this.statusText.setColor(toHexString(COLORS.text.muted))
      }
    }

    // Check if time is up
    if (remaining <= 0) {
      this.handleRelease('Your sentence has been served.')
      return
    }

    // Update timer display
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    this.timerText.setText(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`)

    // Update bail button text
    const bailInfo = calculateBail(player)
    this.bailText.setText(`PAY BAIL $${formatMoney(bailInfo.finalBail).replace('$', '')}`)

    // Update jailbreak button text
    const baseChance = 30
    const bonus = player.jailbreakBonus || 0
    const totalChance = Math.min(80, baseChance + bonus)
    this.jailbreakText.setText(`JAILBREAK (${totalChance}%)`)

    // Update activity cooldowns
    this.updateActivityCooldowns()

    // Update parole status
    this.updateParoleStatus()
  }

  updateActivityCooldowns() {
    const now = Date.now()

    this.activityButtons.forEach(btn => {
      if (btn.isLayLow) {
        btn.effect.setText(this.layingLow ? 'ACTIVE' : 'Toggle')
        btn.effect.setColor(this.layingLow ? '#22C55E' : '#3B82F6')
        btn.card.setStrokeStyle(this.layingLow ? 2 : 1, this.layingLow ? 0x22C55E : 0x444466, this.layingLow ? 0.8 : 0.4)
        return
      }

      const cooldownEnd = this.activityCooldowns[btn.activity.id] || 0
      const remaining = Math.max(0, cooldownEnd - now)

      if (remaining > 0) {
        const secs = Math.ceil(remaining / 1000)
        btn.cooldownText.setText(`${secs}s`)
        btn.card.setAlpha(0.6)
      } else {
        btn.cooldownText.setText('')
        btn.card.setAlpha(1)
      }
    })
  }

  performActivity(activity) {
    const player = gameManager.player || getPlayerData() || {}
    const now = Date.now()

    // Handle lay low toggle
    if (activity.id === 'lay_low') {
      this.layingLow = !this.layingLow
      player.layingLow = this.layingLow

      // If laying low, reduce sentence faster (simulate by actually reducing jail_until)
      if (this.layingLow && player.jail_until) {
        // Reduce remaining time by 20% immediately as a bonus
        const jailEnd = new Date(player.jail_until)
        const remaining = Math.max(0, jailEnd - now)
        const newRemaining = remaining * 0.95 // 5% reduction each toggle
        player.jail_until = new Date(now + newRemaining).toISOString()
      }

      savePlayerData(player)
      if (gameManager.player) Object.assign(gameManager.player, player)

      this.showActivityResult(activity.id === 'lay_low' && this.layingLow ? 'Laying low...' : 'Stopped laying low')
      return
    }

    // Check cooldown
    const cooldownEnd = this.activityCooldowns[activity.id] || 0
    if (now < cooldownEnd) {
      this.showActivityResult('Still on cooldown!')
      return
    }

    // Perform activity
    let resultMessage = ''

    switch (activity.id) {
      case 'work_detail':
        // Earn cash and reduce time
        const cashEarned = Math.floor(Math.random() * (activity.effects.cashMax - activity.effects.cashMin) + activity.effects.cashMin)
        player.cash = (player.cash || 0) + cashEarned

        // Reduce jail time
        if (player.jail_until) {
          const jailEnd = new Date(player.jail_until)
          const newEnd = new Date(jailEnd.getTime() - activity.effects.timeReduction)
          player.jail_until = newEnd.toISOString()
        }

        resultMessage = `Earned $${cashEarned}, -10s from sentence`
        break

      case 'connections':
        // Build prison rep
        player.prisonRep = (player.prisonRep || 0) + activity.effects.prisonRep
        resultMessage = `+${activity.effects.prisonRep} prison reputation`
        break

      case 'plan_escape':
        // Increase jailbreak bonus
        player.jailbreakBonus = Math.min(50, (player.jailbreakBonus || 0) + activity.effects.jailbreakBonus)
        resultMessage = `+${activity.effects.jailbreakBonus}% jailbreak chance (${player.jailbreakBonus}% total)`
        break
    }

    // Set cooldown
    this.activityCooldowns[activity.id] = now + activity.cooldown
    player.jailActivityCooldowns = this.activityCooldowns

    // Save
    savePlayerData(player)
    if (gameManager.player) Object.assign(gameManager.player, player)

    this.showActivityResult(resultMessage)
  }

  showActivityResult(message) {
    const { width, height } = this.cameras.main

    // Flash message
    const resultText = this.add.text(width / 2, height / 2, message, {
      ...getTerminalStyle('md'),
      color: '#22C55E',
      backgroundColor: '#1a1a2e',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setDepth(100).setAlpha(0)

    this.tweens.add({
      targets: resultText,
      alpha: 1,
      y: height / 2 - 20,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: resultText,
            alpha: 0,
            y: height / 2 - 40,
            duration: 200,
            onComplete: () => resultText.destroy()
          })
        })
      }
    })
  }

  attemptPayBail() {
    const player = gameManager.player || getPlayerData() || {}
    const result = payBail(player)

    if (result.success) {
      if (gameManager.player) Object.assign(gameManager.player, result.player)
      this.handleRelease(result.message)
    } else {
      this.showActivityResult(result.message)
    }
  }

  attemptJailbreak() {
    const player = gameManager.player || getPlayerData() || {}
    const result = attemptJailbreak(player)

    if (gameManager.player) Object.assign(gameManager.player, result.player)

    if (result.success) {
      this.handleRelease(result.message)
    } else {
      this.showActivityResult(result.message)
    }
  }

  handleRelease(message) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Stop update timer
    if (this.updateTimer) {
      this.updateTimer.destroy()
      this.updateTimer = null
    }

    // Clear jail status
    player.is_jailed = false
    player.jail_until = null
    player.jailbreakBonus = 0
    player.jailActivityCooldowns = {}
    player.layingLow = false

    savePlayerData(player)
    if (gameManager.player) Object.assign(gameManager.player, player)

    // Show release message
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0).setDepth(200)

    const releaseIcon = this.add.text(width / 2, height / 2 - 40, '🔓', {
      fontSize: '48px'
    }).setOrigin(0.5).setDepth(201)

    const releaseText = this.add.text(width / 2, height / 2 + 10, 'RELEASED', {
      ...getTerminalStyle('display'),
      color: '#22C55E'
    }).setOrigin(0.5).setDepth(201)

    const messageText = this.add.text(width / 2, height / 2 + 50, message, {
      ...getTextStyle('sm', COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(201)

    // Animate and return to game
    this.tweens.add({
      targets: [releaseIcon, releaseText, messageText],
      alpha: { from: 0, to: 1 },
      y: '+=10',
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.returnToGame()
        })
      }
    })
  }

  returnToGame() {
    // Clean up
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []

    // Return to the game
    try {
      this.scene.start(this.returnScene)
    } catch (e) {
      this.scene.start('GameScene')
    }
  }

  shutdown() {
    if (this.updateTimer) {
      this.updateTimer.destroy()
      this.updateTimer = null
    }
    this.contentItems = []
  }
}

export default JailScene
