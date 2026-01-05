/**
 * Street Legacy - Phaser Game Configuration
 *
 * Production-optimized settings for mobile-first gameplay
 */

import Phaser from 'phaser'

// Core scenes
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { MainMenuScene } from './scenes/MainMenuScene'
import { GameScene } from './scenes/GameScene'
import { MapScene } from './scenes/MapScene'
import { CrimeScene } from './scenes/CrimeScene'
import { JobScene } from './scenes/JobScene'
import { HeistsScene } from './scenes/HeistsScene'
import { TradingScene } from './scenes/TradingScene'
import { PropertyScene } from './scenes/PropertyScene'
import { InventoryScene } from './scenes/InventoryScene'
import { CrewScene } from './scenes/CrewScene'
import { BankScene } from './scenes/BankScene'
import { UIScene } from './scenes/UIScene'
import { ReputationScene } from './scenes/ReputationScene'
import { TravelScene } from './scenes/TravelScene'
import { LeaderboardScene } from './scenes/LeaderboardScene'
import { AchievementsScene } from './scenes/AchievementsScene'
import { EventsScene } from './scenes/EventsScene'
import { AudioSettingsScene } from './scenes/AudioSettingsScene'
import { SettingsScene } from './scenes/SettingsScene'
import { AdminScene } from './scenes/AdminScene'
import { AIMessagesScene } from './scenes/AIMessagesScene'

// Narrative system scenes
import { NewsFeedScene } from './scenes/NewsFeedScene'
import { DebtScene } from './scenes/DebtScene'
import { LifeScene } from './scenes/LifeScene'
import { JailScene } from './scenes/JailScene'

// THE NETWORK - Messaging paradigm scenes
import NetworkBootScene from './scenes/NetworkBootScene'
import NetworkInboxScene from './scenes/NetworkInboxScene'
import NetworkMessageScene from './scenes/NetworkMessageScene'

// OS-style Hub Scenes
import { OperationsHubScene } from './scenes/OperationsHubScene'
import { CommerceHubScene } from './scenes/CommerceHubScene'
import { ConnectionsHubScene } from './scenes/ConnectionsHubScene'
import { SystemHubScene } from './scenes/SystemHubScene'

// Mini-game scenes
import { SnakeGame } from './scenes/minigames/SnakeGame'
import { LockPickGame } from './scenes/minigames/LockPickGame'
import { QTEGame } from './scenes/minigames/QTEGame'
import { FroggerGame } from './scenes/minigames/FroggerGame'
import { MemoryGame } from './scenes/minigames/MemoryGame'
import { SteadyHandGame } from './scenes/minigames/SteadyHandGame'
import { ChaseGame } from './scenes/minigames/ChaseGame'
import { SniperGame } from './scenes/minigames/SniperGame'
import { SafeCrackGame } from './scenes/minigames/SafeCrackGame'
import { WireGame } from './scenes/minigames/WireGame'
import { MiniGameResult } from './scenes/minigames/MiniGameResult'
// New enhanced mini-games
import { RhythmGame } from './scenes/minigames/RhythmGame'
import { HackingGame } from './scenes/minigames/HackingGame'
import { GetawayGame } from './scenes/minigames/GetawayGame'
import { NegotiationGame } from './scenes/minigames/NegotiationGame'
import { SurveillanceGame } from './scenes/minigames/SurveillanceGame'
import { StealthGame } from './scenes/minigames/StealthGame'
import { DisguiseGame } from './scenes/minigames/DisguiseGame'

// Casino games
import { CoinFlipScene } from './scenes/casino/CoinFlipScene'
import { DiceRollScene } from './scenes/casino/DiceRollScene'

// Detect if running in production
const isProduction = import.meta.env.PROD

// Detect mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
)

/**
 * Production Game Configuration
 * Optimized for mobile-first with desktop support
 */
export const gameConfig = {
  // Use WebGL with Canvas fallback
  type: Phaser.AUTO,

  // DOM container
  parent: 'game-container',

  // Dark background for street theme
  backgroundColor: '#0a0a0a',

  // Responsive scaling - adapts to screen size
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Base dimensions - larger for better desktop experience
    width: 450,
    height: 800,
    // Minimum supported size (small phones)
    min: {
      width: 360,
      height: 640
    },
    // Maximum size - larger for desktop/tablets
    max: {
      width: 540,
      height: 960
    },
    // Expand to fill available space
    expandParent: true
  },

  // DOM elements support (for forms, etc.)
  dom: {
    createContainer: true
  },

  // Touch and input configuration
  input: {
    // Support multi-touch (up to 3 pointers)
    activePointers: 3,
    touch: {
      capture: true,
      // Prevent default touch events for better control
      target: null
    },
    // Smooth pointer movement
    smoothFactor: 0
  },

  // Audio configuration
  audio: {
    // Use WebAudio for better performance
    disableWebAudio: false,
    // Don't lock audio (allow background music)
    noAudio: false
  },

  // Performance settings
  fps: {
    // Target 60fps
    target: 60,
    // Minimum acceptable fps
    min: 30,
    // Use requestAnimationFrame (not setTimeout)
    forceSetTimeOut: false,
    // Smooth delta time
    smoothStep: true
  },

  // Render settings
  render: {
    // Smooth graphics (not pixel art)
    pixelArt: false,
    // Enable antialiasing
    antialias: true,
    antialiasGL: true,
    // Transparent canvas (for HTML overlays if needed)
    transparent: false,
    // Preserve drawing buffer for screenshots
    preserveDrawingBuffer: false,
    // Power preference for mobile battery
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    // Batch rendering for performance
    batchSize: 4096,
    // Round pixels for crisp text
    roundPixels: true
  },

  // Physics configuration (for mini-games)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      // Debug mode (disable in production)
      debug: !isProduction,
      // FPS for physics calculations
      fps: 60,
      // Time scale (1 = normal speed)
      timeScale: 1
    }
  },

  // Loader configuration
  loader: {
    // Base URL for assets
    baseURL: '',
    // Path prefix for assets
    path: '',
    // Maximum parallel downloads
    maxParallelDownloads: 6,
    // Cross-origin setting
    crossOrigin: 'anonymous',
    // Response type
    responseType: '',
    // Async loading
    async: true,
    // Image loading settings
    imageLoadType: 'HTMLImageElement'
  },

  // Banner configuration (disable in production)
  banner: {
    hidePhaser: isProduction,
    text: '#ffffff',
    background: ['#8b5cf6', '#6366f1']
  },

  // All game scenes
  scene: [
    // Boot and loading
    BootScene,
    PreloadScene,

    // Main menu
    MainMenuScene,

    // Core gameplay scenes
    GameScene,
    UIScene,
    MapScene,
    CrimeScene,
    JobScene,
    HeistsScene,
    TradingScene,
    PropertyScene,
    InventoryScene,
    CrewScene,
    BankScene,
    ReputationScene,
    TravelScene,

    // Feature scenes
    LeaderboardScene,
    AchievementsScene,
    EventsScene,
    AudioSettingsScene,
    SettingsScene,
    AdminScene,
    AIMessagesScene,

    // Narrative system scenes
    NewsFeedScene,
    DebtScene,
    LifeScene,
    JailScene,

    // THE NETWORK - Messaging paradigm scenes
    NetworkBootScene,
    NetworkInboxScene,
    NetworkMessageScene,

    // OS-style Hub Scenes
    OperationsHubScene,
    CommerceHubScene,
    ConnectionsHubScene,
    SystemHubScene,

    // Mini-game scenes
    SnakeGame,
    LockPickGame,
    QTEGame,
    FroggerGame,
    MemoryGame,
    SteadyHandGame,
    ChaseGame,
    SniperGame,
    SafeCrackGame,
    WireGame,
    MiniGameResult,
    // New enhanced mini-games
    RhythmGame,
    HackingGame,
    GetawayGame,
    NegotiationGame,
    SurveillanceGame,
    StealthGame,
    DisguiseGame,

    // Casino games
    CoinFlipScene,
    DiceRollScene
  ],

  // Callbacks
  callbacks: {
    // Called before boot
    preBoot: (game) => {
      // Log game initialization
      if (!isProduction) {
        console.log('🎮 Street Legacy initializing...')
      }
    },
    // Called after boot
    postBoot: (game) => {
      if (!isProduction) {
        console.log('🎮 Street Legacy ready!')
      }
    }
  }
}

/**
 * Debug configuration (development only)
 */
export const debugConfig = {
  showFPS: !isProduction,
  showSceneGraph: false,
  showBounds: false,
  showPointers: false
}

/**
 * Create game instance
 * @returns {Phaser.Game}
 */
export function createGame() {
  return new Phaser.Game(gameConfig)
}

export default gameConfig
