/**
 * Rate Limiter Configuration
 *
 * Defines rate limiting rules for different endpoint categories
 * to prevent brute force attacks and API abuse.
 */

export interface RateLimitMessage {
  success: false;
  error: string;
  retryAfter: number;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: RateLimitMessage;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const rateLimitConfig = {
  /**
   * Global default - applies to all routes as a baseline
   * 100 requests per 15 minutes per IP
   */
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      success: false as const,
      error: 'Too many requests, please try again later.',
      retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Auth endpoints (login) - relaxed for development
   * 50 attempts per 15 minutes per IP (was 5)
   * Successful logins don't count against the limit
   */
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: {
      success: false as const,
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
  } satisfies RateLimitConfig,

  /**
   * Registration limits - relaxed for development
   * 50 registrations per hour per IP (was 3)
   */
  registration: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: {
      success: false as const,
      error: 'Too many accounts created from this IP. Please try again later.',
      retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Game action limits (crimes, attacks, travel, etc.)
   * 30 actions per minute per user
   */
  gameActions: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: {
      success: false as const,
      error: 'Slow down! Too many actions.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Sensitive operations (money transfers, property purchases, trading)
   * 10 operations per 5 minutes per user
   */
  sensitive: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: {
      success: false as const,
      error: 'Too many sensitive operations. Please wait before trying again.',
      retryAfter: 5 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Heavy API operations (leaderboards, searches, player lists)
   * 10 requests per minute per user
   */
  heavy: {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: {
      success: false as const,
      error: 'Too many requests. Please wait a moment.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Chat/messaging rate limits
   * 20 messages per minute per user
   */
  chat: {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
      success: false as const,
      error: 'You are sending messages too quickly. Please slow down.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Admin endpoints - moderate limits
   * 50 requests per minute per admin
   */
  admin: {
    windowMs: 60 * 1000, // 1 minute
    max: 50,
    message: {
      success: false as const,
      error: 'Too many admin requests.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Password reset / account recovery
   * 3 attempts per hour per IP
   */
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
      success: false as const,
      error: 'Too many password reset attempts. Please try again later.',
      retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Casino/gambling endpoints - moderate limits
   * 60 bets per minute per user (1 per second average)
   */
  casino: {
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: {
      success: false as const,
      error: 'Slow down! You are placing bets too quickly.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Crew operations
   * 20 operations per minute per user
   */
  crew: {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
      success: false as const,
      error: 'Too many crew operations. Please wait.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig,

  /**
   * Combat/PvP operations
   * 15 combat actions per minute per user
   */
  combat: {
    windowMs: 60 * 1000, // 1 minute
    max: 15,
    message: {
      success: false as const,
      error: 'Too many combat actions. Please wait.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  } satisfies RateLimitConfig
};

// Type for configuration keys
export type RateLimitConfigKey = keyof typeof rateLimitConfig;
