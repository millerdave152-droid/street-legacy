/**
 * Street Legacy - Pure Phaser Entry Point
 * No React - 100% Phaser.js
 */

import { createGame } from './game/config'
import './styles/game.css'

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Create the game container if it doesn't exist
  let container = document.getElementById('game-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'game-container'
    document.body.appendChild(container)
  }

  // Initialize Phaser game
  const game = createGame()

  // Store game reference globally for debugging
  if (import.meta.env.DEV) {
    ;(window as any).__PHASER_GAME__ = game
  }

  // Handle page visibility for pausing
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Optionally pause game when tab is hidden
      // game.scene.scenes.forEach(scene => scene.scene.pause())
    }
  })

  console.log('Street Legacy initialized - Pure Phaser')
})
