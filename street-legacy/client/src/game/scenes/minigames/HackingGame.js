// HackingGame - Node connection puzzle mini-game
// Connect nodes to complete the circuit before security catches you

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, toHexString, getTerminalStyle } from '../../ui/NetworkTheme'
import { createMiniGameEffects } from '../../utils/MiniGameEffects'

export class HackingGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.BLUR,
      CURVEBALL_TYPES.BLACKOUT
    ]
  }

  constructor() {
    super('HackingGame')

    this.nodes = []
    this.connections = []
    this.selectedNode = null
    this.startNode = null
    this.endNode = null
    this.firewalls = []
    this.effects = null
    this.connectionLine = null
    this.securityLevel = 0
    this.securityBar = null
    this.nodesConnected = 0
    this.requiredConnections = 0
  }

  init(data) {
    super.init(data)
    this.nodes = []
    this.connections = []
    this.selectedNode = null
    this.firewalls = []
    this.securityLevel = 0
    this.nodesConnected = 0

    // Difficulty scaling
    const tier = data.difficultyTier?.name || 'Novice'
    const nodeConfigs = {
      Novice: { nodes: 6, firewalls: 1, required: 4 },
      Apprentice: { nodes: 8, firewalls: 2, required: 5 },
      Skilled: { nodes: 10, firewalls: 3, required: 6 },
      Expert: { nodes: 12, firewalls: 4, required: 7 },
      Master: { nodes: 14, firewalls: 5, required: 8 }
    }
    this.config = nodeConfigs[tier] || nodeConfigs.Novice
    this.requiredConnections = this.config.required
  }

  create() {
    super.create()

    this.effects = createMiniGameEffects(this)

    const { width, height } = this.scale

    // Grid area
    const gridTop = 150
    const gridBottom = height - 150
    const gridLeft = 40
    const gridRight = width - 40
    const gridHeight = gridBottom - gridTop
    const gridWidth = gridRight - gridLeft

    // Grid background
    this.add.rectangle(width / 2, (gridTop + gridBottom) / 2, gridWidth + 20, gridHeight + 20, COLORS.bg.panel, 0.3)
      .setStrokeStyle(2, COLORS.network.dim, 0.5)

    // Grid lines for cyber effect
    const gridSpacing = 30
    for (let x = gridLeft; x <= gridRight; x += gridSpacing) {
      this.add.line(0, 0, x, gridTop, x, gridBottom, COLORS.network.dim, 0.1).setOrigin(0)
    }
    for (let y = gridTop; y <= gridBottom; y += gridSpacing) {
      this.add.line(0, 0, gridLeft, y, gridRight, y, COLORS.network.dim, 0.1).setOrigin(0)
    }

    // Create nodes
    this.generateNodes(gridLeft, gridRight, gridTop, gridBottom)

    // Create firewalls
    this.createFirewalls()

    // Security progress bar
    this.createSecurityBar(width)

    // Connection counter
    this.connectionText = this.add.text(width / 2, height - 80, `Connections: 0 / ${this.requiredConnections}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    // Instructions
    this.add.text(width / 2, height - 50, 'Click nodes to connect them. Avoid firewalls!', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Draw line graphics for connections
    this.connectionGraphics = this.add.graphics().setDepth(10)

    // Temporary line when dragging
    this.dragLine = this.add.graphics().setDepth(15)

    // Input handlers
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)

    // Security timer - increases over time
    this.time.addEvent({
      delay: 1000,
      callback: () => this.increaseSecurityLevel(2),
      loop: true
    })
  }

  generateNodes(left, right, top, bottom) {
    const nodeCount = this.config.nodes
    const padding = 50
    const usableWidth = right - left - padding * 2
    const usableHeight = bottom - top - padding * 2

    // Generate node positions with minimum spacing
    const minDistance = 70
    const positions = []

    for (let i = 0; i < nodeCount; i++) {
      let attempts = 0
      let pos = null

      while (attempts < 50) {
        const x = left + padding + Math.random() * usableWidth
        const y = top + padding + Math.random() * usableHeight

        // Check distance from other nodes
        let valid = true
        for (const p of positions) {
          const dist = Phaser.Math.Distance.Between(x, y, p.x, p.y)
          if (dist < minDistance) {
            valid = false
            break
          }
        }

        if (valid) {
          pos = { x, y }
          break
        }
        attempts++
      }

      if (!pos) {
        pos = {
          x: left + padding + (i % 4) * (usableWidth / 4),
          y: top + padding + Math.floor(i / 4) * (usableHeight / 3)
        }
      }

      positions.push(pos)
    }

    // Create node objects
    positions.forEach((pos, i) => {
      const isStart = i === 0
      const isEnd = i === nodeCount - 1

      const node = this.createNode(pos.x, pos.y, i, isStart, isEnd)
      this.nodes.push(node)

      if (isStart) this.startNode = node
      if (isEnd) this.endNode = node
    })
  }

  createNode(x, y, id, isStart, isEnd) {
    const container = this.add.container(x, y).setDepth(20)

    // Node color based on type
    let color = COLORS.network.primary
    let label = `N${id}`

    if (isStart) {
      color = COLORS.status.success
      label = 'START'
    } else if (isEnd) {
      color = COLORS.cred.gold
      label = 'END'
    }

    // Outer glow
    const glow = this.add.circle(0, 0, 28, color, 0.2)

    // Main circle
    const circle = this.add.circle(0, 0, 22, COLORS.bg.panel, 0.95)
    circle.setStrokeStyle(3, color, 0.9)

    // Label
    const text = this.add.text(0, 0, label, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: isStart || isEnd ? '10px' : '11px',
      color: toHexString(color),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    container.add([glow, circle, text])

    // Make interactive
    circle.setInteractive({ useHandCursor: true })
    circle.on('pointerover', () => {
      circle.setStrokeStyle(4, color, 1)
      glow.setAlpha(0.4)
    })
    circle.on('pointerout', () => {
      if (container !== this.selectedNode) {
        circle.setStrokeStyle(3, color, 0.9)
        glow.setAlpha(0.2)
      }
    })

    container.setData('id', id)
    container.setData('color', color)
    container.setData('connections', [])
    container.setData('circle', circle)
    container.setData('glow', glow)
    container.setData('isStart', isStart)
    container.setData('isEnd', isEnd)

    return container
  }

  createFirewalls() {
    const firewallCount = this.config.firewalls

    for (let i = 0; i < firewallCount; i++) {
      // Random position
      const x = Phaser.Math.Between(80, this.scale.width - 80)
      const y = Phaser.Math.Between(180, this.scale.height - 180)

      // Random size
      const width = Phaser.Math.Between(40, 80)
      const height = Phaser.Math.Between(40, 80)

      const firewall = this.add.rectangle(x, y, width, height, COLORS.status.danger, 0.3)
        .setStrokeStyle(2, COLORS.status.danger, 0.8)
        .setDepth(5)

      // Animated pulse
      this.tweens.add({
        targets: firewall,
        alpha: { from: 0.3, to: 0.5 },
        duration: 800,
        yoyo: true,
        repeat: -1
      })

      // Firewall label
      this.add.text(x, y, '🔥', { fontSize: '16px' }).setOrigin(0.5).setDepth(6)

      this.firewalls.push({
        rect: firewall,
        x, y, width, height
      })
    }
  }

  createSecurityBar(width) {
    const barY = 130
    const barWidth = 200

    // Background
    this.add.rectangle(width / 2, barY, barWidth + 4, 16, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.status.danger, 0.5)

    // Fill
    this.securityBar = this.add.rectangle(width / 2 - barWidth / 2, barY, 0, 12, COLORS.status.danger, 0.8)
      .setOrigin(0, 0.5)

    // Label
    this.add.text(width / 2 - barWidth / 2 - 80, barY, 'SECURITY:', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0, 0.5)

    this.maxSecurityWidth = barWidth
  }

  increaseSecurityLevel(amount) {
    if (this.isGameOver || this.isPaused) return

    this.securityLevel = Math.min(100, this.securityLevel + amount)
    this.securityBar.width = (this.securityLevel / 100) * this.maxSecurityWidth

    // Color changes as it fills
    if (this.securityLevel >= 80) {
      this.securityBar.setFillStyle(0xff0000, 1)
      this.effects.dangerBorder()
    } else if (this.securityLevel >= 60) {
      this.securityBar.setFillStyle(0xff4400, 0.9)
    }

    // Game over if security reaches 100
    if (this.securityLevel >= 100) {
      this.endGame(false)
    }
  }

  onPointerDown(pointer) {
    if (this.isGameOver || this.isPaused) return

    // Find clicked node
    const clickedNode = this.getNodeAt(pointer.x, pointer.y)

    if (clickedNode) {
      this.selectedNode = clickedNode
      const circle = clickedNode.getData('circle')
      const glow = clickedNode.getData('glow')
      const color = clickedNode.getData('color')

      circle.setStrokeStyle(4, 0xffffff, 1)
      glow.setAlpha(0.6)

      audioManager.playHover()
    }
  }

  onPointerMove(pointer) {
    if (!this.selectedNode || this.isGameOver) return

    // Draw temporary line from selected node to pointer
    this.dragLine.clear()
    this.dragLine.lineStyle(3, COLORS.network.primary, 0.6)
    this.dragLine.beginPath()
    this.dragLine.moveTo(this.selectedNode.x, this.selectedNode.y)
    this.dragLine.lineTo(pointer.x, pointer.y)
    this.dragLine.strokePath()
  }

  onPointerUp(pointer) {
    if (!this.selectedNode || this.isGameOver) return

    this.dragLine.clear()

    const targetNode = this.getNodeAt(pointer.x, pointer.y)

    if (targetNode && targetNode !== this.selectedNode) {
      this.tryConnect(this.selectedNode, targetNode)
    }

    // Deselect
    if (this.selectedNode) {
      const circle = this.selectedNode.getData('circle')
      const glow = this.selectedNode.getData('glow')
      const color = this.selectedNode.getData('color')

      circle.setStrokeStyle(3, color, 0.9)
      glow.setAlpha(0.2)
    }

    this.selectedNode = null
  }

  getNodeAt(x, y) {
    const hitRadius = 30

    for (const node of this.nodes) {
      const dist = Phaser.Math.Distance.Between(x, y, node.x, node.y)
      if (dist <= hitRadius) {
        return node
      }
    }
    return null
  }

  tryConnect(nodeA, nodeB) {
    // Check if already connected
    const existingConnections = nodeA.getData('connections')
    if (existingConnections.includes(nodeB.getData('id'))) {
      audioManager.playMiss()
      return false
    }

    // Check if connection crosses firewall
    if (this.crossesFirewall(nodeA.x, nodeA.y, nodeB.x, nodeB.y)) {
      this.failConnection()
      return false
    }

    // Success - make connection
    this.makeConnection(nodeA, nodeB)
    return true
  }

  crossesFirewall(x1, y1, x2, y2) {
    for (const fw of this.firewalls) {
      if (this.lineIntersectsRect(x1, y1, x2, y2, fw.x - fw.width / 2, fw.y - fw.height / 2, fw.width, fw.height)) {
        return true
      }
    }
    return false
  }

  lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Check if line intersects rectangle
    // Using line segment intersection with rectangle edges

    const left = rx
    const right = rx + rw
    const top = ry
    const bottom = ry + rh

    // Check if line endpoints are both on one side
    if ((x1 < left && x2 < left) || (x1 > right && x2 > right) ||
        (y1 < top && y2 < top) || (y1 > bottom && y2 > bottom)) {
      return false
    }

    // Check line intersection with each edge
    return this.lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) ||
           this.lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) ||
           this.lineIntersectsLine(x1, y1, x2, y2, left, bottom, right, bottom) ||
           this.lineIntersectsLine(x1, y1, x2, y2, left, top, left, bottom)
  }

  lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
    if (Math.abs(denom) < 0.001) return false

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
  }

  failConnection() {
    audioManager.playMiss()
    this.effects.failureFlash(150)
    this.effects.shake({ intensity: 0.02, duration: 200 })
    this.increaseSecurityLevel(15)

    // Show warning
    const warning = this.add.text(this.scale.width / 2, this.scale.height / 2, 'FIREWALL DETECTED!', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '20px',
      color: toHexString(COLORS.status.danger),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100)

    this.tweens.add({
      targets: warning,
      scale: { from: 0.5, to: 1.2 },
      alpha: { from: 1, to: 0 },
      duration: 800,
      onComplete: () => warning.destroy()
    })
  }

  makeConnection(nodeA, nodeB) {
    // Store connection
    nodeA.getData('connections').push(nodeB.getData('id'))
    nodeB.getData('connections').push(nodeA.getData('id'))

    this.connections.push({ a: nodeA, b: nodeB })
    this.nodesConnected++

    // Draw connection line
    this.connectionGraphics.lineStyle(3, COLORS.network.primary, 0.8)
    this.connectionGraphics.beginPath()
    this.connectionGraphics.moveTo(nodeA.x, nodeA.y)
    this.connectionGraphics.lineTo(nodeB.x, nodeB.y)
    this.connectionGraphics.strokePath()

    // Effects
    this.effects.electricSpark((nodeA.x + nodeB.x) / 2, (nodeA.y + nodeB.y) / 2)
    audioManager.playHit()

    // Update counter
    this.connectionText.setText(`Connections: ${this.nodesConnected} / ${this.requiredConnections}`)

    // Add score
    this.addScore(50)

    // Check win condition
    if (this.nodesConnected >= this.requiredConnections) {
      // Bonus for connecting start to end
      if (this.isPathComplete()) {
        this.addScore(200)
        this.effects.confetti(this.scale.width, this.scale.height)
      }
      this.endGame(true)
    }
  }

  isPathComplete() {
    // BFS from start to end
    const visited = new Set()
    const queue = [this.startNode.getData('id')]

    while (queue.length > 0) {
      const current = queue.shift()
      if (current === this.endNode.getData('id')) {
        return true
      }

      if (visited.has(current)) continue
      visited.add(current)

      // Find node
      const node = this.nodes.find(n => n.getData('id') === current)
      if (node) {
        const connections = node.getData('connections')
        connections.forEach(id => {
          if (!visited.has(id)) {
            queue.push(id)
          }
        })
      }
    }

    return false
  }

  shutdown() {
    if (this.effects) {
      this.effects.cleanup()
    }
    this.input.removeAllListeners()
  }
}

export default HackingGame
