/**
 * THE NETWORK - Inbox Scene
 *
 * WhatsApp/Telegram-style message list showing all incoming communications.
 * This is the primary view of THE NETWORK messaging system.
 */

import Phaser from 'phaser'
import { COLORS, BORDERS, DEPTH, getTerminalStyle, toHexString, SYMBOLS, createNetworkHeader, createEncryptedIndicator, createGlowBorder } from '../ui/NetworkTheme'
import { networkMessageManager, MESSAGE_TYPES } from '../managers/NetworkMessageManager'
import { audioManager } from '../managers/AudioManager'

export default class NetworkInboxScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NetworkInboxScene' })
  }

  init(data) {
    this.filterType = data?.filter || 'all' // 'all', 'intel', 'contract', 'alert', 'unread'
  }

  create() {
    const { width, height } = this.cameras.main

    // Full opaque background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(100)
      .setInteractive()

    // Scene layout constants
    this.HEADER_HEIGHT = 100
    this.SCROLL_START_Y = this.HEADER_HEIGHT + 10
    this.SCROLL_END_Y = height - 20
    this.CARD_HEIGHT = 80
    this.CARD_SPACING = 8

    // State
    this.scrollOffset = 0
    this.contentItems = []
    this.selectedMessageId = null

    // Create UI
    this.createHeader()
    this.createFilters()
    this.createCloseButton()
    this.setupScrolling()
    this.renderMessages()

    // Listen for message updates
    this.messageListener = (event, data) => {
      if (event === 'new_message' || event === 'message_read' || event === 'message_deleted') {
        this.renderMessages()
        this.updateUnreadBadge()
      }
    }
    networkMessageManager.addListener(this.messageListener)
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background
    this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(101)

    // Get unread count for subtitle
    const unreadCount = networkMessageManager.getUnreadCount()
    const subtitle = unreadCount > 0 ? `${unreadCount} UNREAD TRANSMISSIONS` : `SECURE INBOX`

    // Use createNetworkHeader for enhanced styling
    createNetworkHeader(this, 'INBOX', subtitle, 30, COLORS.network.primary)

    // Add encrypted indicator in top-left corner
    createEncryptedIndicator(this, 60, 15).setDepth(103)

    // Mark all read button
    if (unreadCount > 0) {
      const markReadBtn = this.add.text(width - 80, 35, 'MARK ALL', {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true })

      markReadBtn.on('pointerover', () => markReadBtn.setColor(toHexString(COLORS.network.primary)))
      markReadBtn.on('pointerout', () => markReadBtn.setColor(toHexString(COLORS.text.muted)))
      markReadBtn.on('pointerdown', () => {
        networkMessageManager.markAllAsRead()
        this.updateUnreadBadge()
        markReadBtn.destroy()
      })
    }
  }

  createFilters() {
    const { width } = this.cameras.main
    const filterY = 85
    const filters = [
      { key: 'all', label: 'ALL' },
      { key: 'unread', label: 'NEW' },
      { key: MESSAGE_TYPES.INTEL, label: 'INTEL' },
      { key: MESSAGE_TYPES.CONTRACT, label: 'JOBS' },
      { key: MESSAGE_TYPES.ALERT, label: 'ALERTS' }
    ]

    const filterWidth = 60
    const totalWidth = filters.length * filterWidth
    const startX = width / 2 - totalWidth / 2 + filterWidth / 2

    filters.forEach((filter, index) => {
      const x = startX + index * filterWidth
      const isActive = this.filterType === filter.key

      // Terminal button background for active tab
      if (isActive) {
        const btnBg = this.add.rectangle(x, filterY, filterWidth - 10, 24, COLORS.bg.elevated, 0.6)
          .setStrokeStyle(BORDERS.thin, COLORS.network.primary, 0.8)
          .setDepth(101)

        // Subtle glow effect on active tab
        const glow = this.add.rectangle(x, filterY, filterWidth - 8, 26, COLORS.network.primary, 0.1)
          .setDepth(100)

        this.tweens.add({
          targets: glow,
          alpha: { from: 0.1, to: 0.2 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      }

      const btn = this.add.text(x, filterY, filter.label, {
        ...getTerminalStyle('xs'),
        color: toHexString(isActive ? COLORS.network.primary : COLORS.text.muted),
        fontStyle: isActive ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true })

      if (isActive) {
        const underline = this.add.rectangle(x, filterY + 12, filterWidth - 10, 2, COLORS.network.primary, 0.9)
          .setDepth(102)
      }

      btn.on('pointerover', () => {
        if (!isActive) {
          btn.setColor(toHexString(COLORS.text.secondary))
          // Add subtle hover glow
          const hoverGlow = this.add.rectangle(x, filterY, filterWidth - 10, 24, COLORS.network.primary, 0.05)
            .setDepth(100)
          btn.setData('hoverGlow', hoverGlow)
        }
      })
      btn.on('pointerout', () => {
        if (!isActive) {
          btn.setColor(toHexString(COLORS.text.muted))
          const hoverGlow = btn.getData('hoverGlow')
          if (hoverGlow) {
            hoverGlow.destroy()
            btn.setData('hoverGlow', null)
          }
        }
      })
      btn.on('pointerdown', () => {
        audioManager.playClick()
        this.filterType = filter.key
        this.scrollOffset = 0
        this.clearContent()
        this.createFilters()
        this.renderMessages()
      })
    })
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON).setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => closeBtn.setColor(toHexString(COLORS.status.danger)))
    closeBtn.on('pointerout', () => closeBtn.setColor(toHexString(COLORS.text.secondary)))
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })
  }

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollOffset += deltaY * 0.5
      this.scrollOffset = Math.max(0, this.scrollOffset)
      this.renderMessages()
    })

    // Touch scrolling
    let startY = 0
    let startOffset = 0

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.SCROLL_START_Y && pointer.y < this.SCROLL_END_Y) {
        startY = pointer.y
        startOffset = this.scrollOffset
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && startY > 0) {
        const delta = startY - pointer.y
        this.scrollOffset = Math.max(0, startOffset + delta)
        this.renderMessages()
      }
    })
  }

  renderMessages() {
    this.clearContent()

    const { width } = this.cameras.main

    // Add ambient terminal border around message list area
    const listBorder = this.add.rectangle(
      width / 2,
      (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2,
      width - 20,
      this.SCROLL_END_Y - this.SCROLL_START_Y,
      0x000000,
      0
    )
    listBorder.setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.3)
    listBorder.setDepth(99)
    this.contentItems.push(listBorder)

    // Subtle pulsing glow on the border
    const borderGlow = this.add.rectangle(
      width / 2,
      (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2,
      width - 18,
      this.SCROLL_END_Y - this.SCROLL_START_Y + 2,
      COLORS.network.primary,
      0.05
    )
    borderGlow.setDepth(98)
    this.contentItems.push(borderGlow)

    this.tweens.add({
      targets: borderGlow,
      alpha: { from: 0.05, to: 0.12 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Get filtered messages
    let messages = networkMessageManager.getMessages()

    // Apply filter
    if (this.filterType === 'unread') {
      messages = messages.filter(m => !m.read)
    } else if (this.filterType !== 'all') {
      messages = messages.filter(m => m.type === this.filterType)
    }

    if (messages.length === 0) {
      this.renderEmptyState()
      return
    }

    // Calculate visible range
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    const totalHeight = messages.length * (this.CARD_HEIGHT + this.CARD_SPACING)
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, totalHeight - visibleHeight))

    // Render visible messages
    let y = this.SCROLL_START_Y - this.scrollOffset

    messages.forEach((message, index) => {
      const cardBottom = y + this.CARD_HEIGHT
      const cardTop = y

      // Only render if visible
      if (cardBottom > this.SCROLL_START_Y && cardTop < this.SCROLL_END_Y) {
        this.renderMessageCard(message, y)
      }

      y += this.CARD_HEIGHT + this.CARD_SPACING
    })

    // Fade mask at top
    if (this.scrollOffset > 0) {
      const fadeTop = this.add.rectangle(
        this.cameras.main.width / 2, this.SCROLL_START_Y + 15,
        this.cameras.main.width, 30, COLORS.bg.screen, 0.9
      )
      fadeTop.setDepth(150)
      this.contentItems.push(fadeTop)
    }
  }

  renderMessageCard(message, y) {
    const { width } = this.cameras.main
    const cardWidth = width - 30
    const x = width / 2

    // Card background
    const bgColor = message.read ? COLORS.bg.panel : COLORS.bg.card
    const cardBg = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth, this.CARD_HEIGHT - 4, bgColor, 0.95)
      .setStrokeStyle(BORDERS.thin, message.read ? COLORS.network.dim : this.getTypeColor(message.type))
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(cardBg)

    // Enhanced unread message effects
    if (!message.read) {
      const typeColor = this.getTypeColor(message.type)

      // Subtle glow effect around unread messages
      const cardGlow = this.add.rectangle(x, y + this.CARD_HEIGHT / 2, cardWidth + 4, this.CARD_HEIGHT, typeColor, 0.08)
      this.contentItems.push(cardGlow)

      // Pulsing left border for unread messages
      const leftBorder = this.add.rectangle(
        x - cardWidth / 2 + 3,
        y + this.CARD_HEIGHT / 2,
        4,
        this.CARD_HEIGHT - 4,
        typeColor,
        0.9
      )
      this.contentItems.push(leftBorder)

      // Pulse animation on the left border
      this.tweens.add({
        targets: leftBorder,
        alpha: { from: 0.9, to: 0.4 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })

      // Unread indicator dot
      const dot = this.add.circle(25, y + this.CARD_HEIGHT / 2, 5, COLORS.network.primary)
      this.contentItems.push(dot)

      // Subtle pulse on the dot
      this.tweens.add({
        targets: dot,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 1, to: 0.7 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }

    // Sender avatar
    const avatarX = 50
    const avatarBg = this.add.rectangle(avatarX, y + this.CARD_HEIGHT / 2, 36, 36,
      this.getTypeColor(message.type), 0.2)
      .setStrokeStyle(BORDERS.thin, this.getTypeColor(message.type))
    this.contentItems.push(avatarBg)

    const avatarText = this.add.text(avatarX, y + this.CARD_HEIGHT / 2, message.from.avatar, {
      ...getTerminalStyle('md'),
      color: toHexString(this.getTypeColor(message.type))
    }).setOrigin(0.5)
    this.contentItems.push(avatarText)

    // Sender name
    const nameX = 80
    const name = this.add.text(nameX, y + 18, message.from.codename || message.from.name, {
      ...getTerminalStyle('sm'),
      color: toHexString(message.read ? COLORS.text.muted : COLORS.text.primary),
      fontStyle: message.read ? 'normal' : 'bold'
    })
    this.contentItems.push(name)

    // Encryption badge
    if (message.from.encrypted) {
      const lockX = nameX + name.width + 8
      const lock = this.add.text(lockX, y + 18, SYMBOLS.locked, {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.network.primary)
      })
      this.contentItems.push(lock)
    }

    // Timestamp
    const timeText = networkMessageManager.getRelativeTime(message.timestamp)
    const time = this.add.text(width - 25, y + 18, timeText, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(1, 0.5)
    this.contentItems.push(time)

    // Subject line
    const subject = this.add.text(nameX, y + 40, message.subject, {
      ...getTerminalStyle('md'),
      color: toHexString(message.read ? COLORS.text.secondary : COLORS.text.primary)
    })
    this.contentItems.push(subject)

    // Preview text (truncated)
    let preview = message.body.replace(/\n/g, ' ')
    if (preview.length > 40) preview = preview.substring(0, 40) + '...'
    const previewText = this.add.text(nameX, y + 60, preview, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    })
    this.contentItems.push(previewText)

    // Expiration timer if applicable
    if (message.expiresAt) {
      const remaining = networkMessageManager.getTimeRemaining(message.expiresAt)
      if (remaining && remaining !== 'EXPIRED') {
        const timerText = this.add.text(width - 25, y + 55, `${SYMBOLS.alert} ${remaining}`, {
          ...getTerminalStyle('xs'),
          color: toHexString(COLORS.status.warning)
        }).setOrigin(1, 0.5)
        this.contentItems.push(timerText)
      }
    }

    // Card interactions
    cardBg.on('pointerover', () => {
      cardBg.setFillStyle(COLORS.bg.elevated, 0.95)
      cardBg.setStrokeStyle(BORDERS.medium, this.getTypeColor(message.type))
    })

    cardBg.on('pointerout', () => {
      cardBg.setFillStyle(bgColor, 0.95)
      cardBg.setStrokeStyle(BORDERS.thin, message.read ? COLORS.network.dim : this.getTypeColor(message.type))
    })

    cardBg.on('pointerdown', () => {
      audioManager.playClick()
      this.openMessage(message)
    })
  }

  renderEmptyState() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(width / 2, centerY - 40, '[N]', {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const emptyTexts = {
      all: 'NO MESSAGES',
      unread: 'NO NEW MESSAGES',
      [MESSAGE_TYPES.INTEL]: 'NO INTEL',
      [MESSAGE_TYPES.CONTRACT]: 'NO CONTRACTS',
      [MESSAGE_TYPES.ALERT]: 'NO ALERTS'
    }

    const title = this.add.text(width / 2, centerY + 10, emptyTexts[this.filterType] || 'NO MESSAGES', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5)
    this.contentItems.push(title)

    const subtitle = this.add.text(width / 2, centerY + 45, `${SYMBOLS.system} Check back later for new communications`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    this.contentItems.push(subtitle)
  }

  getTypeColor(type) {
    switch (type) {
      case MESSAGE_TYPES.INTEL: return COLORS.status.info
      case MESSAGE_TYPES.CONTRACT: return COLORS.network.primary
      case MESSAGE_TYPES.ALERT: return COLORS.status.danger
      case MESSAGE_TYPES.CONTACT: return COLORS.cred.gold
      case MESSAGE_TYPES.CHANNEL: return 0x7c3aed // purple
      case MESSAGE_TYPES.SYSTEM: return COLORS.text.muted
      default: return COLORS.network.primary
    }
  }

  openMessage(message) {
    // Mark as read
    networkMessageManager.markAsRead(message.id)

    // Open message detail scene
    this.scene.launch('NetworkMessageScene', { messageId: message.id })
    this.scene.pause()
  }

  updateUnreadBadge() {
    // Recreate the header with updated count
    this.clearContent()
    this.createHeader()
    this.createFilters()
    this.renderMessages()
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []
  }

  closeScene() {
    networkMessageManager.removeListener(this.messageListener)
    this.scene.stop()
    this.scene.resume('GameScene')
  }

  shutdown() {
    networkMessageManager.removeListener(this.messageListener)
  }
}
