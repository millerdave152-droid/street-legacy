/**
 * Street Legacy - Centralized Logging System
 *
 * Use this instead of raw console.log throughout the codebase.
 * In production, debug logs are suppressed automatically.
 */

// Check if we're in production mode
const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.PROD

// Debug settings - can be toggled for specific components
const DEBUG_CONFIG = {
  enabled: !isProduction,
  // Enable verbose logging for specific components
  verbose: {
    scenes: false,
    managers: false,
    minigames: false,
    sarah: false,
    network: false,
    audio: false
  }
}

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

// Current log level (DEBUG in dev, WARN in prod)
const currentLevel = isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG

/**
 * Logger class - use the exported singleton instance
 */
class LoggerClass {
  constructor() {
    this.config = DEBUG_CONFIG
    this.level = currentLevel
  }

  /**
   * Format a log message with component prefix
   */
  _format(component, message) {
    const timestamp = new Date().toLocaleTimeString()
    return `[${timestamp}] [${component}] ${message}`
  }

  /**
   * Debug level logging - only in development
   * @param {string} component - Component name (e.g., 'GameScene', 'AudioManager')
   * @param {string} message - Log message
   * @param {any} [data] - Optional data to log
   */
  debug(component, message, data) {
    if (this.level > LOG_LEVELS.DEBUG) return

    if (data !== undefined) {
      console.log(this._format(component, message), data)
    } else {
      console.log(this._format(component, message))
    }
  }

  /**
   * Info level logging - general information
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {any} [data] - Optional data to log
   */
  info(component, message, data) {
    if (this.level > LOG_LEVELS.INFO) return

    if (data !== undefined) {
      console.info(this._format(component, message), data)
    } else {
      console.info(this._format(component, message))
    }
  }

  /**
   * Warning level logging - potential issues
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {any} [error] - Optional error or data
   */
  warn(component, message, error) {
    if (this.level > LOG_LEVELS.WARN) return

    if (error !== undefined) {
      console.warn(this._format(component, message), error)
    } else {
      console.warn(this._format(component, message))
    }
  }

  /**
   * Error level logging - always logged
   * @param {string} component - Component name
   * @param {string} message - Log message
   * @param {any} [error] - Optional error object
   */
  error(component, message, error) {
    if (error !== undefined) {
      console.error(this._format(component, message), error)
    } else {
      console.error(this._format(component, message))
    }
  }

  /**
   * Trace logging with stack trace - development only
   * @param {string} component - Component name
   * @param {string} message - Log message
   */
  trace(component, message) {
    if (this.level > LOG_LEVELS.DEBUG) return
    console.trace(this._format(component, message))
  }

  /**
   * Group related logs together
   * @param {string} label - Group label
   * @param {Function} fn - Function containing logs
   */
  group(label, fn) {
    if (this.level > LOG_LEVELS.DEBUG) {
      fn()
      return
    }
    console.group(label)
    fn()
    console.groupEnd()
  }

  /**
   * Performance timing
   * @param {string} label - Timer label
   */
  time(label) {
    if (this.level > LOG_LEVELS.DEBUG) return
    console.time(label)
  }

  timeEnd(label) {
    if (this.level > LOG_LEVELS.DEBUG) return
    console.timeEnd(label)
  }

  /**
   * Check if verbose logging is enabled for a category
   * @param {string} category - Category name (scenes, managers, etc.)
   * @returns {boolean}
   */
  isVerbose(category) {
    return this.config.enabled && this.config.verbose[category]
  }

  /**
   * Enable/disable debug mode at runtime
   * @param {boolean} enabled
   */
  setDebugEnabled(enabled) {
    this.config.enabled = enabled
    this.level = enabled ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN
  }

  /**
   * Enable verbose logging for a category
   * @param {string} category
   * @param {boolean} enabled
   */
  setVerbose(category, enabled) {
    if (this.config.verbose.hasOwnProperty(category)) {
      this.config.verbose[category] = enabled
    }
  }
}

// Export singleton instance
export const Logger = new LoggerClass()

// Also export as default for convenience
export default Logger
