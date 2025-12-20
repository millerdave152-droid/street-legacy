/**
 * Middleware Exports
 *
 * Central export point for all middleware modules
 */

// Authentication middleware
export {
  authMiddleware,
  getPlayerById,
  JWT_SECRET,
  type AuthRequest,
  type PlayerPayload
} from './auth.js';

// Rate limiting middleware
export {
  // Pre-configured limiters
  globalLimiter,
  authLimiter,
  registrationLimiter,
  gameActionLimiter,
  sensitiveLimiter,
  heavyLimiter,
  chatLimiter,
  adminLimiter,
  passwordResetLimiter,
  casinoLimiter,
  crewLimiter,
  combatLimiter,

  // Factory function for custom limiters
  createCustomLimiter,

  // Utility functions
  isRedisConnected,
  getStorageType,
  shutdownRateLimiter,

  // Configuration
  rateLimitConfig
} from './rateLimiter.js';

// Rate limit configuration types
export type {
  RateLimitConfig,
  RateLimitMessage,
  RateLimitConfigKey
} from './rateLimiter.config.js';

// CSRF protection middleware
export {
  csrfProtection,
  provideCsrfToken,
  csrfErrorHandler,
  conditionalCsrf,
  getCsrfToken
} from './csrf.js';
