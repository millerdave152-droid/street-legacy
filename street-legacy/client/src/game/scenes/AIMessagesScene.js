/**
 * AIMessagesScene - UI for viewing and responding to AI messages
 *
 * Features:
 * - List of active messages from AI players
 * - Message detail view with choices
 * - AI relationship status display
 * - Message history access
 */

import Phaser from 'phaser'
import { aiMessageManager } from '../managers/AIMessageManager.js'
import { aiPlayerManager } from '../managers/AIPlayerManager.js'
import { getPersonality, PERSONALITIES } from '../data/AIPersonalities.js'
import { gameManager } from '../GameManager.js'
import { notificationManager } from '../managers/NotificationManager.js'
import { formatMoney } from '../../utils/formatters.js'

export class AIMessagesScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AIMessagesScene' })

    this.messages = []
    this.selectedMessage = null
    this.contentItems = []
    this.scrollOffset = 0
  }

  create() {
    const { width, height } = this.cameras.main

    // Full opaque background
    this.add.rectangle(0, 0, width, height, 0x0a0a15, 1).setOrigin(0).setInteractive()

    // Initialize managers
    aiMessageManager.initialize()
    aiPlayerManager.initialize()

    // Load messages
    this.messages = aiMessageManager.getActiveMessages()

    // Create UI
    this.createHeader()
    this.createCloseButton()
    this.setupScrolling()

    // Listen for new messages
    this.messageListener = aiMessageManager.on('newMessage', (msg) => {
      this.messages = aiMessageManager.getActiveMessages()
      this.renderMessages()
    })

    // Initial render
    if (this.messages.length > 0) {
      this.renderMessages()
    } else {
      this.renderEmptyState()
    }
  }

  createHeader() {
    const { width } = this.cameras.main

    // Title
    this.add.text(width / 2, 30, '📬 MESSAGES', {
      fontSize: '24px',
      color: '#f59e0b',
      fontFamily: 'Arial Black, Arial'
    }).setOrigin(0.5)

    // Subtitle
    const unreadCount = aiMessageManager.getUnreadCount()
    this.subtitleText = this.add.text(width / 2, 58, `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`, {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5)

    // Divider
    this.add.rectangle(width / 2, 78, width - 40, 1, 0x333333)
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      fontSize: '32px',
      color: '#ffffff'
    })
      .setOrigin(0.5)
      .setDepth(999)
      .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ef4444')
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff')
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => this.closeScene())
  }

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.selectedMessage) {
        this.scrollOffset = Math.max(0, this.scrollOffset + deltaY * 0.5)
        this.renderMessages()
      }
    })
  }

  renderMessages() {
    this.clearContent()

    if (this.messages.length === 0) {
      this.renderEmptyState()
      return
    }

    const { width, height } = this.cameras.main
    const startY = 100 - this.scrollOffset
    const itemHeight = 80
    const padding = 10

    this.messages.forEach((message, index) => {
      const y = startY + index * (itemHeight + padding)

      // Skip if off screen
      if (y + itemHeight < 80 || y > height - 60) return

      this.renderMessageCard(message, y, width, itemHeight)
    })
  }

  renderMessageCard(message, y, width, height) {
    const ai = aiPlayerManager.getById(message.fromAI)
    const personality = ai ? getPersonality(ai.personality) : null

    // Card background
    const bgColor = message.read ? 0x1a1a2e : 0x2a2a4a
    const card = this.add.rectangle(width / 2, y + height / 2, width - 40, height - 5, bgColor, 0.95)
      .setStrokeStyle(message.read ? 1 : 2, personality?.color || 0x666666)
      .setInteractive({ useHandCursor: true })

    card.on('pointerdown', () => this.selectMessage(message))
    card.on('pointerover', () => card.setFillStyle(0x3a3a5a, 0.95))
    card.on('pointerout', () => card.setFillStyle(bgColor, 0.95))

    this.contentItems.push(card)

    // Unread indicator
    if (!message.read) {
      const indicator = this.add.circle(35, y + height / 2, 5, personality?.color || 0xf59e0b)
      this.contentItems.push(indicator)
    }

    // Personality icon
    const iconX = 55
    const icon = this.add.text(iconX, y + height / 2, personality?.icon || '👤', {
      fontSize: '28px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Sender name
    const nameText = this.add.text(90, y + 15, message.fromUsername || 'Unknown', {
      fontSize: '14px',
      color: personality?.color || '#ffffff',
      fontStyle: 'bold'
    })
    this.contentItems.push(nameText)

    // Message title
    const titleText = this.add.text(90, y + 35, message.title || 'Message', {
      fontSize: '12px',
      color: '#cccccc',
      wordWrap: { width: width - 180 }
    })
    this.contentItems.push(titleText)

    // Time remaining
    const timeLeft = Math.max(0, message.expiresAt - Date.now())
    const minutes = Math.floor(timeLeft / 60000)
    const timeColor = minutes < 2 ? '#ef4444' : '#888888'

    const timeText = this.add.text(width - 50, y + height / 2, `${minutes}m`, {
      fontSize: '12px',
      color: timeColor
    }).setOrigin(1, 0.5)
    this.contentItems.push(timeText)

    // Trust indicator
    if (ai) {
      const trustColor = ai.playerTrust >= 60 ? '#22c55e' :
        ai.playerTrust >= 40 ? '#f59e0b' : '#ef4444'
      const trustIcon = ai.playerTrust >= 60 ? '✓' : ai.playerTrust >= 40 ? '?' : '!'

      const trustText = this.add.text(width - 50, y + 15, trustIcon, {
        fontSize: '14px',
        color: trustColor
      }).setOrigin(1, 0.5)
      this.contentItems.push(trustText)
    }
  }

  selectMessage(message) {
    this.selectedMessage = message
    aiMessageManager.markAsRead(message.id)
    this.renderMessageDetail()
  }

  renderMessageDetail() {
    this.clearContent()

    const { width, height } = this.cameras.main
    const message = this.selectedMessage
    const ai = aiPlayerManager.getById(message.fromAI)
    const personality = ai ? getPersonality(ai.personality) : null

    // Back button
    const backBtn = this.add.text(30, 95, '← Back', {
      fontSize: '14px',
      color: '#888888'
    })
      .setInteractive({ useHandCursor: true })

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'))
    backBtn.on('pointerout', () => backBtn.setColor('#888888'))
    backBtn.on('pointerdown', () => {
      this.selectedMessage = null
      this.renderMessages()
    })
    this.contentItems.push(backBtn)

    // Header section
    const headerY = 130

    // Sender icon
    const icon = this.add.text(width / 2, headerY, personality?.icon || '👤', {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Sender name
    const nameText = this.add.text(width / 2, headerY + 45, message.fromUsername, {
      fontSize: '20px',
      color: personality?.color || '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(nameText)

    // Personality type
    const typeText = this.add.text(width / 2, headerY + 70, personality?.name || 'Unknown', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(typeText)

    // Trust meter
    if (ai) {
      this.renderTrustMeter(width / 2, headerY + 95, ai.playerTrust)
    }

    // Message title
    const titleY = headerY + 130
    const titleText = this.add.text(width / 2, titleY, message.title, {
      fontSize: '18px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    // Message content
    const contentY = titleY + 40
    const contentText = this.add.text(width / 2, contentY, message.message, {
      fontSize: '13px',
      color: '#cccccc',
      wordWrap: { width: width - 60 },
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5, 0)
    this.contentItems.push(contentText)

    // Choices
    const choicesY = height - 140
    if (message.choices && !message.responded) {
      this.renderChoices(message.choices, choicesY, width, message)
    } else if (message.responded) {
      const responseText = this.add.text(width / 2, choicesY, `You responded: ${message.response}`, {
        fontSize: '14px',
        color: '#888888'
      }).setOrigin(0.5)
      this.contentItems.push(responseText)
    }

    // Deal history hint
    if (ai && ai.totalDeals > 0) {
      const historyText = this.add.text(width / 2, height - 50,
        `Deal history: ${ai.honestDeals}/${ai.totalDeals} honest deals`, {
          fontSize: '11px',
          color: '#666666'
        }).setOrigin(0.5)
      this.contentItems.push(historyText)
    }
  }

  renderTrustMeter(x, y, trust) {
    const meterWidth = 120
    const meterHeight = 8

    // Background
    const bg = this.add.rectangle(x, y, meterWidth, meterHeight, 0x333333)
    this.contentItems.push(bg)

    // Fill
    const fillColor = trust >= 60 ? 0x22c55e : trust >= 40 ? 0xf59e0b : 0xef4444
    const fillWidth = (trust / 100) * meterWidth
    const fill = this.add.rectangle(x - meterWidth / 2 + fillWidth / 2, y, fillWidth, meterHeight, fillColor)
    this.contentItems.push(fill)

    // Label
    const label = this.add.text(x, y + 15, `Trust: ${trust}%`, {
      fontSize: '10px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(label)
  }

  renderChoices(choices, y, width, message) {
    const buttonWidth = (width - 60) / Math.min(choices.length, 3)
    const buttonHeight = 44
    const startX = 30 + buttonWidth / 2

    choices.forEach((choice, index) => {
      const x = startX + index * (buttonWidth + 10)
      const row = Math.floor(index / 3)
      const btnY = y + row * (buttonHeight + 10)

      // Button colors based on action
      let btnColor = 0x3b82f6
      if (choice.action === 'accept') btnColor = 0x22c55e
      else if (choice.action === 'decline') btnColor = 0x6b7280

      const btn = this.add.rectangle(x, btnY, buttonWidth - 10, buttonHeight, btnColor, 0.95)
        .setInteractive({ useHandCursor: true })

      const btnText = this.add.text(x, btnY, choice.label, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      btn.on('pointerover', () => btn.setAlpha(1))
      btn.on('pointerout', () => btn.setAlpha(0.95))
      btn.on('pointerdown', () => this.handleChoice(message, choice.action))

      this.contentItems.push(btn, btnText)
    })
  }

  handleChoice(message, action) {
    const player = gameManager.player

    // Process the response
    const result = aiMessageManager.handleResponse(message.id, action, {
      cash: player?.cash || 0
    })

    if (!result) {
      notificationManager.showToast('Error processing response', 'error')
      return
    }

    // Apply effects to player
    if (result.cashChange !== 0) {
      if (player) {
        player.cash = Math.max(0, (player.cash || 0) + result.cashChange)
        gameManager.savePlayer()
      }

      const sign = result.cashChange > 0 ? '+' : ''
      notificationManager.showToast(`${sign}${formatMoney(result.cashChange)}`, result.cashChange > 0 ? 'success' : 'warning')
    }

    if (result.respectChange !== 0 && player) {
      player.respect = Math.max(0, (player.respect || 0) + result.respectChange)
      gameManager.savePlayer()
    }

    // Show result message
    notificationManager.showToast(result.message, result.success ? 'success' : 'warning')

    // Refresh messages
    this.messages = aiMessageManager.getActiveMessages()

    // Go back to list if message was removed
    if (!this.messages.find(m => m.id === message.id)) {
      this.selectedMessage = null
      this.renderMessages()
    } else {
      this.renderMessageDetail()
    }
  }

  renderEmptyState() {
    this.clearContent()

    const { width, height } = this.cameras.main
    const centerY = height / 2

    const iconText = this.add.text(width / 2, centerY - 40, '📭', {
      fontSize: '56px'
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 20, 'No Messages', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 55, 'AI players will reach out with offers soon...', {
      fontSize: '13px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(msgText)
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []
  }

  closeScene() {
    if (this.messageListener) {
      aiMessageManager.off('newMessage', this.messageListener)
    }
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}

export default AIMessagesScene
