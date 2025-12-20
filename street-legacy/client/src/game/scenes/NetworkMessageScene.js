/**
 * THE NETWORK - Message Detail Scene
 *
 * Full message view with sender info, body, payload, and action buttons.
 * Displays encrypted message details and allows interaction.
 */

import Phaser from 'phaser'
import { COLORS, BORDERS, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkMessageManager, MESSAGE_TYPES, HANDLERS } from '../managers/NetworkMessageManager'
import { audioManager } from '../managers/AudioManager'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'

export default class NetworkMessageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NetworkMessageScene' })
  }

  init(data) {
    this.messageId = data?.messageId
    this.message = networkMessageManager.getMessage(this.messageId)
  }

  create() {
    const { width, height } = this.cameras.main

    if (!this.message) {
      this.closeScene()
      return
    }

    // Full opaque background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(100)
      .setInteractive()

    this.createHeader()
    this.createSenderSection()
    this.createMessageBody()

    if (this.message.payload) {
      this.createPayloadCard()
    }

    this.createActionButtons()
    this.createBackButton()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background
    this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(101)

    // Type-colored accent line
    const typeColor = this.getTypeColor(this.message.type)
    this.add.rectangle(width / 2, 68, width, 2, typeColor, 0.8)
      .setDepth(101)

    // Back arrow
    const backBtn = this.add.text(25, 35, SYMBOLS.back, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true })

    backBtn.on('pointerover', () => backBtn.setColor(toHexString(COLORS.network.primary)))
    backBtn.on('pointerout', () => backBtn.setColor(toHexString(COLORS.text.secondary)))
    backBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })

    // Message type label
    const typeLabels = {
      [MESSAGE_TYPES.INTEL]: 'INTEL',
      [MESSAGE_TYPES.CONTRACT]: 'CONTRACT',
      [MESSAGE_TYPES.ALERT]: 'ALERT',
      [MESSAGE_TYPES.CONTACT]: 'CONTACT',
      [MESSAGE_TYPES.CHANNEL]: 'CHANNEL',
      [MESSAGE_TYPES.SYSTEM]: 'SYSTEM'
    }

    this.add.text(width / 2, 25, typeLabels[this.message.type] || 'MESSAGE', {
      ...getTerminalStyle('sm'),
      color: toHexString(typeColor)
    }).setOrigin(0.5).setDepth(102)

    // Timestamp
    const timestamp = new Date(this.message.timestamp).toLocaleString()
    this.add.text(width / 2, 48, timestamp, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(102)

    // Star/favorite button
    const starBtn = this.add.text(width - 25, 35, this.message.starred ? SYMBOLS.star : SYMBOLS.starEmpty, {
      ...getTerminalStyle('xl'),
      color: toHexString(this.message.starred ? COLORS.cred.gold : COLORS.text.muted)
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true })

    starBtn.on('pointerdown', () => {
      networkMessageManager.toggleStarred(this.message.id)
      this.message = networkMessageManager.getMessage(this.messageId)
      starBtn.setText(this.message.starred ? SYMBOLS.star : SYMBOLS.starEmpty)
      starBtn.setColor(toHexString(this.message.starred ? COLORS.cred.gold : COLORS.text.muted))
    })
  }

  createSenderSection() {
    const { width } = this.cameras.main
    const y = 95

    // Sender card
    const cardBg = this.add.rectangle(width / 2, y + 30, width - 30, 60, COLORS.bg.panel, 0.9)
      .setStrokeStyle(BORDERS.thin, COLORS.network.dim)

    // Avatar
    const avatarX = 45
    const typeColor = this.getTypeColor(this.message.type)

    const avatarBg = this.add.rectangle(avatarX, y + 30, 44, 44, typeColor, 0.2)
      .setStrokeStyle(BORDERS.medium, typeColor)

    this.add.text(avatarX, y + 30, this.message.from.avatar, {
      ...getTerminalStyle('lg'),
      color: toHexString(typeColor)
    }).setOrigin(0.5)

    // Sender name and role
    const nameX = 80
    this.add.text(nameX, y + 20, this.message.from.name, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    })

    // Encryption badge + role
    const roleText = this.message.from.encrypted ? `${SYMBOLS.locked} ENCRYPTED • ${this.message.from.role}` : this.message.from.role
    this.add.text(nameX, y + 42, roleText, {
      ...getTerminalStyle('xs'),
      color: toHexString(this.message.from.encrypted ? COLORS.network.primary : COLORS.text.muted)
    })

    // Expiration warning if applicable
    if (this.message.expiresAt) {
      const remaining = networkMessageManager.getTimeRemaining(this.message.expiresAt)
      if (remaining && remaining !== 'EXPIRED') {
        this.add.text(width - 25, y + 30, `${SYMBOLS.alert} EXPIRES: ${remaining}`, {
          ...getTerminalStyle('xs'),
          color: toHexString(COLORS.status.warning)
        }).setOrigin(1, 0.5)
      }
    }
  }

  createMessageBody() {
    const { width, height } = this.cameras.main
    const startY = 170
    const bodyHeight = this.message.payload ? 180 : 280

    // Subject
    this.add.text(20, startY, this.message.subject, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold',
      wordWrap: { width: width - 40 }
    })

    // Divider
    this.add.rectangle(width / 2, startY + 35, width - 40, 1, COLORS.network.dim)

    // Body text container for scrolling
    const bodyStartY = startY + 50
    const bodyText = this.add.text(0, 0, this.message.body, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.secondary),
      wordWrap: { width: width - 40 },
      lineSpacing: 6
    })

    // Check if scrolling is needed
    if (bodyText.height > bodyHeight) {
      // Create scroll container
      this.scrollContainer = this.add.container(20, bodyStartY)
      this.scrollContainer.add(bodyText)

      // Create mask for clipping
      const maskGraphics = this.make.graphics()
      maskGraphics.fillRect(20, bodyStartY, width - 40, bodyHeight)
      const mask = maskGraphics.createGeometryMask()
      this.scrollContainer.setMask(mask)

      // Scroll state
      this.scrollOffset = 0
      this.maxScroll = bodyText.height - bodyHeight

      // Scroll indicator
      this.scrollIndicator = this.add.text(width - 25, bodyStartY + bodyHeight - 20,
        `${SYMBOLS.down} SCROLL`, {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(1, 0.5)

      // Mouse wheel scrolling
      this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
        this.scrollOffset = Phaser.Math.Clamp(
          this.scrollOffset + deltaY * 0.5,
          0,
          this.maxScroll
        )
        bodyText.y = -this.scrollOffset

        // Update scroll indicator
        if (this.scrollOffset >= this.maxScroll - 10) {
          this.scrollIndicator.setText(`${SYMBOLS.up} TOP`)
        } else if (this.scrollOffset <= 10) {
          this.scrollIndicator.setText(`${SYMBOLS.down} SCROLL`)
        } else {
          this.scrollIndicator.setText(`${SYMBOLS.up}${SYMBOLS.down}`)
        }
      })

      // Touch drag scrolling
      let dragStartY = 0
      let dragStartOffset = 0

      this.input.on('pointerdown', (pointer) => {
        if (pointer.y > bodyStartY && pointer.y < bodyStartY + bodyHeight) {
          dragStartY = pointer.y
          dragStartOffset = this.scrollOffset
        }
      })

      this.input.on('pointermove', (pointer) => {
        if (pointer.isDown && dragStartY > 0) {
          const deltaY = dragStartY - pointer.y
          this.scrollOffset = Phaser.Math.Clamp(
            dragStartOffset + deltaY,
            0,
            this.maxScroll
          )
          bodyText.y = -this.scrollOffset
        }
      })

      this.input.on('pointerup', () => {
        dragStartY = 0
      })
    } else {
      // No scrolling needed, just position the text
      bodyText.setPosition(20, bodyStartY)
    }
  }

  createPayloadCard() {
    const { width } = this.cameras.main
    const payload = this.message.payload
    const y = 380

    if (!payload || !payload.data) return

    // Payload container
    const cardBg = this.add.rectangle(width / 2, y + 50, width - 30, 100, COLORS.bg.card, 0.95)
      .setStrokeStyle(BORDERS.medium, this.getTypeColor(this.message.type))

    // Payload header
    const payloadLabels = {
      job: 'CONTRACT DETAILS',
      event: 'INTEL DETAILS',
      trade: 'TRADE OFFER',
      heist: 'OPERATION DETAILS'
    }

    this.add.text(25, y + 10, payloadLabels[payload.type] || 'DETAILS', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    })

    // Payload content based on type
    if (payload.type === 'job' && payload.data) {
      const job = payload.data
      this.add.text(25, y + 35, `PAY: ${formatMoney(job.base_pay)}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.gold)
      })
      this.add.text(25, y + 58, `DURATION: ${Math.floor(job.duration_seconds / 60)} MIN`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.secondary)
      })
      this.add.text(25, y + 78, `ENERGY: ${job.energy_cost}`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.status.info)
      })

      // Level requirement
      if (job.min_level > 1) {
        this.add.text(width - 25, y + 35, `LV.${job.min_level} REQUIRED`, {
          ...getTerminalStyle('sm'),
          color: toHexString(COLORS.status.warning)
        }).setOrigin(1, 0)
      }
    } else if (payload.type === 'event' && payload.data) {
      const event = payload.data
      if (event.effect_type && event.effect_value) {
        const effectText = event.effect_type === 'cash'
          ? formatMoney(event.effect_value)
          : `${event.effect_value > 0 ? '+' : ''}${event.effect_value} ${event.effect_type.toUpperCase()}`

        this.add.text(25, y + 45, `EFFECT: ${effectText}`, {
          ...getTerminalStyle('md'),
          color: toHexString(event.effect_value > 0 ? COLORS.status.success : COLORS.status.danger)
        })
      }
    }
  }

  createActionButtons() {
    const { width, height } = this.cameras.main
    const payload = this.message.payload
    const buttonY = height - 80

    if (!payload || !payload.actions || payload.actions.length === 0) {
      // Just an acknowledge button
      this.createButton(width / 2, buttonY, 'ACKNOWLEDGE', COLORS.network.primary, () => {
        this.closeScene()
      })
      return
    }

    const actions = payload.actions
    const buttonWidth = 140
    const spacing = 15

    if (actions.length === 1) {
      this.createButton(width / 2, buttonY, actions[0].toUpperCase(), COLORS.network.primary, () => {
        this.handleAction(actions[0])
      })
    } else if (actions.length === 2) {
      // Two buttons side by side
      this.createButton(width / 2 - buttonWidth / 2 - spacing / 2, buttonY,
        actions[0].toUpperCase(), COLORS.status.success, () => {
          this.handleAction(actions[0])
        })
      this.createButton(width / 2 + buttonWidth / 2 + spacing / 2, buttonY,
        actions[1].toUpperCase(), COLORS.status.danger, () => {
          this.handleAction(actions[1])
        })
    } else {
      // Multiple buttons stacked
      actions.slice(0, 3).forEach((action, index) => {
        const y = buttonY - (actions.length - 1 - index) * 50
        const color = index === 0 ? COLORS.status.success :
                     index === actions.length - 1 ? COLORS.status.danger :
                     COLORS.network.primary
        this.createButton(width / 2, y, action.toUpperCase(), color, () => {
          this.handleAction(action)
        })
      })
    }
  }

  createButton(x, y, text, color, onClick) {
    const btn = this.add.rectangle(x, y, 140, 44, COLORS.bg.elevated, 0.95)
      .setStrokeStyle(BORDERS.medium, color)
      .setInteractive({ useHandCursor: true })

    const btnText = this.add.text(x, y, text, {
      ...getTerminalStyle('md'),
      color: toHexString(color)
    }).setOrigin(0.5)

    btn.on('pointerover', () => {
      btn.setFillStyle(color, 0.2)
      btn.setStrokeStyle(BORDERS.thick, color)
    })

    btn.on('pointerout', () => {
      btn.setFillStyle(COLORS.bg.elevated, 0.95)
      btn.setStrokeStyle(BORDERS.medium, color)
    })

    btn.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    return { btn, text: btnText }
  }

  createBackButton() {
    // Delete button at bottom
    const { width, height } = this.cameras.main

    const deleteBtn = this.add.text(width / 2, height - 25, `${SYMBOLS.close} DELETE MESSAGE`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    deleteBtn.on('pointerover', () => deleteBtn.setColor(toHexString(COLORS.status.danger)))
    deleteBtn.on('pointerout', () => deleteBtn.setColor(toHexString(COLORS.text.muted)))
    deleteBtn.on('pointerdown', () => {
      networkMessageManager.deleteMessage(this.message.id)
      this.closeScene()
    })
  }

  handleAction(action) {
    const payload = this.message.payload

    // Handle different action types
    switch (action.toLowerCase()) {
      case 'accept':
        if (payload.type === 'job') {
          // Start the job
          this.startJob(payload.data)
        } else if (payload.type === 'event') {
          // Accept event
          this.acceptEvent(payload.data)
        }
        break

      case 'decline':
        // Just close the message
        networkMessageManager.createSystemMessage(
          'Offer declined',
          'You have declined the offer. Your contact has been notified.'
        )
        break

      case 'acknowledge':
      case 'understood':
        // Just acknowledge and close
        break

      default:
        console.log('[NetworkMessageScene] Unknown action:', action)
    }

    this.closeScene()
  }

  startJob(job) {
    // Check energy
    const state = gameManager.getState()
    if (state.energy < job.energy_cost) {
      networkMessageManager.createAlert(
        'INSUFFICIENT ENERGY',
        `You need ${job.energy_cost} energy to take this contract. Rest or use items to restore energy.`,
        'general'
      )
      return
    }

    // Deduct energy and add rewards
    gameManager.updateEnergy(-job.energy_cost)
    gameManager.addCash(job.base_pay)
    gameManager.addXP(job.xp_reward || 50)

    // Create completion message
    networkMessageManager.addMessage({
      type: MESSAGE_TYPES.CONTRACT,
      from: HANDLERS.THE_FIXER,
      subject: 'Contract Complete',
      body: `Good work on the ${job.name} job. Payment of ${formatMoney(job.base_pay)} has been deposited.\n\nKeep this up and I'll have more work for you.`,
      read: false
    })
  }

  acceptEvent(event) {
    // Apply event effect
    if (event.effect_type && event.effect_value) {
      switch (event.effect_type) {
        case 'cash':
          gameManager.addCash(event.effect_value)
          break
        case 'xp':
          gameManager.addXP(event.effect_value)
          break
        case 'heat':
          gameManager.addHeat(event.effect_value)
          break
        case 'energy':
          gameManager.updateEnergy(event.effect_value)
          break
      }
    }

    // Create follow-up message
    const resultMessage = event.effect_value > 0
      ? `Intel proved accurate. ${event.effect_type === 'cash' ? formatMoney(event.effect_value) : event.effect_value + ' ' + event.effect_type} gained.`
      : `Intel acted upon. Effects applied.`

    networkMessageManager.addMessage({
      type: MESSAGE_TYPES.INTEL,
      from: HANDLERS.THE_WHISPER,
      subject: 'Intel Confirmed',
      body: resultMessage,
      read: false
    })
  }

  getTypeColor(type) {
    switch (type) {
      case MESSAGE_TYPES.INTEL: return COLORS.status.info
      case MESSAGE_TYPES.CONTRACT: return COLORS.network.primary
      case MESSAGE_TYPES.ALERT: return COLORS.status.danger
      case MESSAGE_TYPES.CONTACT: return COLORS.cred.gold
      case MESSAGE_TYPES.CHANNEL: return 0x7c3aed
      case MESSAGE_TYPES.SYSTEM: return COLORS.text.muted
      default: return COLORS.network.primary
    }
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('NetworkInboxScene')
  }
}
