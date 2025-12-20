/**
 * Street Legacy - Game Constants
 *
 * Centralized configuration for colors, debug settings, and game constants
 */

// ==========================================================================
// DEBUG CONFIGURATION
// ==========================================================================

export const DEBUG = {
  // Enable debug mode in development
  ENABLED: import.meta.env.DEV,

  // Skip authentication (for testing)
  SKIP_AUTH: false,

  // Infinite energy for testing
  INFINITE_ENERGY: false,

  // No cooldowns for testing
  NO_COOLDOWNS: false,

  // Show FPS counter
  SHOW_FPS: import.meta.env.DEV,

  // Log all API calls to console
  LOG_API_CALLS: import.meta.env.DEV,

  // Show scene boundaries and hitboxes
  SHOW_BOUNDS: false,

  // Auto-win mini-games
  AUTO_WIN_MINIGAMES: false,

  // Skip tutorial automatically (set to true to unblock game until tutorial is updated)
  SKIP_TUTORIAL: true,

  // Verbose logging
  VERBOSE: import.meta.env.DEV
}

// ==========================================================================
// GAME VERSION
// ==========================================================================

export const VERSION = {
  MAJOR: 3,
  MINOR: 0,
  PATCH: 0,
  BUILD: 'release',
  get STRING() {
    return `v${this.MAJOR}.${this.MINOR}.${this.PATCH}`
  },
  get FULL() {
    return `Street Legacy ${this.STRING} (${this.BUILD})`
  }
}

// ==========================================================================
// COLOR PALETTE
// ==========================================================================

export const COLORS = {
  // Primary colors
  PRIMARY: 0x8b5cf6,        // Purple
  PRIMARY_LIGHT: 0xa78bfa,
  PRIMARY_DARK: 0x7c3aed,

  // Secondary colors
  SECONDARY: 0x6366f1,      // Indigo
  SECONDARY_LIGHT: 0x818cf8,
  SECONDARY_DARK: 0x4f46e5,

  // Status colors
  SUCCESS: 0x22c55e,        // Green
  SUCCESS_LIGHT: 0x4ade80,
  SUCCESS_DARK: 0x16a34a,

  ERROR: 0xef4444,          // Red
  ERROR_LIGHT: 0xf87171,
  ERROR_DARK: 0xdc2626,

  WARNING: 0xf59e0b,        // Amber
  WARNING_LIGHT: 0xfbbf24,
  WARNING_DARK: 0xd97706,

  INFO: 0x3b82f6,           // Blue
  INFO_LIGHT: 0x60a5fa,
  INFO_DARK: 0x2563eb,

  // Neutral colors
  WHITE: 0xffffff,
  BLACK: 0x000000,

  // Background colors
  BG_DARK: 0x0a0a0a,
  BG_MEDIUM: 0x1a1a2e,
  BG_LIGHT: 0x1e293b,

  // Gray scale
  GRAY_100: 0xf3f4f6,
  GRAY_200: 0xe5e7eb,
  GRAY_300: 0xd1d5db,
  GRAY_400: 0x9ca3af,
  GRAY_500: 0x6b7280,
  GRAY_600: 0x4b5563,
  GRAY_700: 0x374151,
  GRAY_800: 0x1f2937,
  GRAY_900: 0x111827,

  // Game-specific colors
  CASH: 0x22c55e,           // Green for money
  XP: 0x8b5cf6,             // Purple for experience
  ENERGY: 0x22c55e,         // Green for energy
  HEAT: 0xef4444,           // Red for heat/wanted level
  RESPECT: 0xf59e0b,        // Gold for respect
  HEALTH: 0xef4444,         // Red for health

  // Crime difficulty colors
  CRIME_EASY: 0x22c55e,
  CRIME_MEDIUM: 0xf59e0b,
  CRIME_HARD: 0xef4444,
  CRIME_EXTREME: 0x9333ea
}

// Hex color strings (for text)
export const COLORS_HEX = {
  PRIMARY: '#8b5cf6',
  SECONDARY: '#6366f1',
  SUCCESS: '#22c55e',
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
  WHITE: '#ffffff',
  BLACK: '#000000',
  GRAY: '#9ca3af',
  GRAY_LIGHT: '#d1d5db',
  GRAY_DARK: '#4b5563',
  CASH: '#22c55e',
  XP: '#8b5cf6',
  ENERGY: '#22c55e',
  HEAT: '#ef4444',
  RESPECT: '#f59e0b'
}

// ==========================================================================
// ICONS (Emoji-based)
// ==========================================================================

export const ICONS = {
  // Navigation
  BACK: '←',
  CLOSE: '×',
  MENU: '☰',
  SETTINGS: '⚙️',
  HOME: '🏠',

  // Actions
  CRIME: '🔫',
  JOB: '💼',
  BANK: '🏦',
  MAP: '🗺️',
  SHOP: '🛒',
  INVENTORY: '🎒',
  PROPERTY: '🏢',
  CREW: '👥',
  CASINO: '🎰',
  MESSAGES: '💬',

  // Stats
  CASH: '💵',
  ENERGY: '⚡',
  HEAT: '🔥',
  RESPECT: '⭐',
  LEVEL: '📊',
  XP: '✨',
  HEALTH: '❤️',

  // Status
  SUCCESS: '✓',
  FAIL: '✗',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  TIMER: '⏱️',

  // Achievements
  TROPHY: '🏆',
  MEDAL: '🏅',
  STAR: '⭐',
  CROWN: '👑',

  // Crime types
  PICKPOCKET: '👛',
  SHOPLIFTING: '🛒',
  MUGGING: '🔪',
  CAR_THEFT: '🚗',
  BURGLARY: '🏠',
  ROBBERY: '🔫',
  DRUG_DEAL: '💊',
  HEIST: '🏦',
  ASSASSINATION: '🎯',

  // Social
  CREW_MEMBER: '👤',
  GANG: '💀',
  POLICE: '🚔',
  NOTIFICATION: '🔔',

  // Misc
  LOADING: '⏳',
  SOUND_ON: '🔊',
  SOUND_OFF: '🔇',
  MUSIC_ON: '🎵',
  MUSIC_OFF: '🎵',
  TUTORIAL: '📖',
  LEADERBOARD: '📊',
  EVENTS: '📅'
}

// ==========================================================================
// TEXT STYLES
// ==========================================================================

export const TEXT_STYLES = {
  // Headers
  H1: {
    fontFamily: 'Arial Black, Arial',
    fontSize: '32px',
    color: COLORS_HEX.WHITE
  },
  H2: {
    fontFamily: 'Arial Black, Arial',
    fontSize: '24px',
    color: COLORS_HEX.WHITE
  },
  H3: {
    fontFamily: 'Arial Black, Arial',
    fontSize: '20px',
    color: COLORS_HEX.WHITE
  },

  // Body text
  BODY: {
    fontSize: '14px',
    color: COLORS_HEX.WHITE
  },
  BODY_SMALL: {
    fontSize: '12px',
    color: COLORS_HEX.GRAY
  },
  BODY_LARGE: {
    fontSize: '16px',
    color: COLORS_HEX.WHITE
  },

  // Special
  BUTTON: {
    fontFamily: 'Arial Black, Arial',
    fontSize: '16px',
    color: COLORS_HEX.WHITE
  },
  LABEL: {
    fontSize: '12px',
    color: COLORS_HEX.GRAY
  },
  VALUE: {
    fontFamily: 'Arial Black, Arial',
    fontSize: '18px',
    color: COLORS_HEX.WHITE
  },
  MONO: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: COLORS_HEX.WHITE
  }
}

// ==========================================================================
// GAME CONSTANTS
// ==========================================================================

export const GAME = {
  // Energy
  MAX_ENERGY: 100,
  ENERGY_REGEN_RATE: 1,        // Per minute
  ENERGY_REGEN_INTERVAL: 60000, // 1 minute

  // Heat
  MAX_HEAT: 100,
  HEAT_DECAY_RATE: 1,          // Per minute
  HEAT_DECAY_INTERVAL: 60000,  // 1 minute

  // Cooldowns (in milliseconds)
  COOLDOWN_CRIME: 30000,       // 30 seconds
  COOLDOWN_JOB: 60000,         // 1 minute
  COOLDOWN_TRAVEL: 10000,      // 10 seconds

  // XP formula: XP needed = BASE * (MULTIPLIER ^ (level - 1))
  XP_BASE: 100,
  XP_MULTIPLIER: 1.5,

  // Economy
  STARTING_CASH: 500,
  BANK_INTEREST_RATE: 0.01,    // 1% per hour
  MAX_CREW_MEMBERS: 4,

  // Animation durations
  SCENE_TRANSITION_DURATION: 300,
  TOAST_DURATION: 3000,
  MODAL_ANIMATION_DURATION: 300
}

// ==========================================================================
// EMPTY STATE MESSAGES
// ==========================================================================

export const EMPTY_STATES = {
  INVENTORY: {
    icon: '🎒',
    title: 'Inventory Empty',
    message: 'Visit the shop to buy items'
  },
  PROPERTIES: {
    icon: '🏢',
    title: 'No Properties',
    message: 'Buy properties to earn passive income'
  },
  CREW: {
    icon: '👥',
    title: 'No Crew Members',
    message: 'Hire crew to boost your crimes'
  },
  MESSAGES: {
    icon: '💬',
    title: 'No Messages',
    message: 'Your inbox is empty'
  },
  ACHIEVEMENTS: {
    icon: '🏆',
    title: 'No Achievements Yet',
    message: 'Complete tasks to unlock achievements'
  },
  EVENTS: {
    icon: '📅',
    title: 'No Active Events',
    message: 'Check back later for events'
  },
  LEADERBOARD: {
    icon: '📊',
    title: 'Leaderboard Empty',
    message: 'Be the first to make your mark!'
  }
}

// ==========================================================================
// LOADING MESSAGES
// ==========================================================================

export const LOADING_MESSAGES = [
  'Loading...',
  'Preparing the streets...',
  'Gathering intel...',
  'Setting up operations...',
  'Connecting to the network...'
]

/**
 * Get a random loading message
 * @returns {string}
 */
export function getRandomLoadingMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
}

// ==========================================================================
// EXPORTS
// ==========================================================================

export default {
  DEBUG,
  VERSION,
  COLORS,
  COLORS_HEX,
  ICONS,
  TEXT_STYLES,
  GAME,
  EMPTY_STATES,
  LOADING_MESSAGES,
  getRandomLoadingMessage
}
