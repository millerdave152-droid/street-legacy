/**
 * Global Error Handler Middleware
 *
 * Centralized error handling for the Express application.
 * Provides consistent error responses and logging.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, unknown>;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes from programming errors

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Pre-defined error creators for common scenarios
 */
export const Errors = {
  // 400 Bad Request
  badRequest: (message: string = 'Bad request', details?: Record<string, unknown>) =>
    new ApiError(message, 400, 'BAD_REQUEST', details),

  validationFailed: (message: string = 'Validation failed', details?: Record<string, unknown>) =>
    new ApiError(message, 400, 'VALIDATION_FAILED', details),

  // 401 Unauthorized
  unauthorized: (message: string = 'Unauthorized') =>
    new ApiError(message, 401, 'UNAUTHORIZED'),

  invalidCredentials: () =>
    new ApiError('Invalid credentials', 401, 'INVALID_CREDENTIALS'),

  tokenExpired: () =>
    new ApiError('Token expired', 401, 'TOKEN_EXPIRED'),

  invalidToken: () =>
    new ApiError('Invalid token', 401, 'INVALID_TOKEN'),

  // 403 Forbidden
  forbidden: (message: string = 'Forbidden') =>
    new ApiError(message, 403, 'FORBIDDEN'),

  insufficientPermissions: () =>
    new ApiError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'),

  accountBanned: (reason?: string) =>
    new ApiError(reason || 'Account banned', 403, 'ACCOUNT_BANNED'),

  emailNotVerified: () =>
    new ApiError('Email not verified', 403, 'EMAIL_NOT_VERIFIED'),

  // 404 Not Found
  notFound: (resource: string = 'Resource') =>
    new ApiError(`${resource} not found`, 404, 'NOT_FOUND'),

  playerNotFound: () =>
    new ApiError('Player not found', 404, 'PLAYER_NOT_FOUND'),

  // 409 Conflict
  conflict: (message: string = 'Conflict') =>
    new ApiError(message, 409, 'CONFLICT'),

  alreadyExists: (resource: string = 'Resource') =>
    new ApiError(`${resource} already exists`, 409, 'ALREADY_EXISTS'),

  // 422 Unprocessable Entity
  unprocessable: (message: string, details?: Record<string, unknown>) =>
    new ApiError(message, 422, 'UNPROCESSABLE_ENTITY', details),

  insufficientFunds: (required?: number, available?: number) =>
    new ApiError('Insufficient funds', 422, 'INSUFFICIENT_FUNDS', { required, available }),

  insufficientEnergy: (required?: number, available?: number) =>
    new ApiError('Insufficient energy', 422, 'INSUFFICIENT_ENERGY', { required, available }),

  insufficientNerve: (required?: number, available?: number) =>
    new ApiError('Insufficient nerve', 422, 'INSUFFICIENT_NERVE', { required, available }),

  cooldownActive: (remainingSeconds: number) =>
    new ApiError(`Action on cooldown. Try again in ${remainingSeconds} seconds`, 422, 'COOLDOWN_ACTIVE', { remainingSeconds }),

  levelTooLow: (required: number, current: number) =>
    new ApiError(`Level ${required} required`, 422, 'LEVEL_TOO_LOW', { required, current }),

  inJail: () =>
    new ApiError('You are in jail', 422, 'IN_JAIL'),

  // 429 Too Many Requests
  rateLimitExceeded: (retryAfter?: number) =>
    new ApiError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter }),

  // 500 Internal Server Error
  internal: (message: string = 'Internal server error') =>
    new ApiError(message, 500, 'INTERNAL_ERROR'),

  databaseError: () =>
    new ApiError('Database error', 500, 'DATABASE_ERROR'),

  // 503 Service Unavailable
  serviceUnavailable: (message: string = 'Service temporarily unavailable') =>
    new ApiError(message, 503, 'SERVICE_UNAVAILABLE'),

  maintenanceMode: () =>
    new ApiError('Server is under maintenance', 503, 'MAINTENANCE_MODE')
};

// =============================================================================
// Error Response Interface
// =============================================================================

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format Zod validation errors into a consistent structure
 */
function formatZodError(error: ZodError): Record<string, unknown> {
  return {
    fields: error.issues.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code
    }))
  };
}

/**
 * Check if error is a known operational error
 */
function isOperationalError(error: Error): boolean {
  if (error instanceof ApiError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Get request ID from headers or generate placeholder
 */
function getRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined;
}

// =============================================================================
// Global Error Handler
// =============================================================================

/**
 * Global error handling middleware
 * Must be registered AFTER all routes
 */
export const globalErrorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = getRequestId(req);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
      details: formatZodError(error),
      requestId
    };

    logger.debug('Validation error', {
      path: req.path,
      method: req.method,
      errors: error.issues
    });

    res.status(400).json(response);
    return;
  }

  // Handle custom API errors
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
      requestId
    };

    // Log operational errors at info level, unexpected at error level
    if (error.isOperational) {
      logger.info('API error', {
        path: req.path,
        method: req.method,
        code: error.code,
        statusCode: error.statusCode
      });
    } else {
      logger.error('Unexpected API error', error, {
        path: req.path,
        method: req.method
      });
    }

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle database errors (PostgreSQL)
  if ((error as any).code && typeof (error as any).code === 'string' && (error as any).code.length === 5) {
    const pgError = error as any;
    let message = 'Database error';
    let statusCode = 500;
    let code = 'DATABASE_ERROR';

    // Handle specific PostgreSQL error codes
    switch (pgError.code) {
      case '23505': // unique_violation
        message = 'Resource already exists';
        statusCode = 409;
        code = 'DUPLICATE_KEY';
        break;
      case '23503': // foreign_key_violation
        message = 'Referenced resource not found';
        statusCode = 422;
        code = 'FOREIGN_KEY_VIOLATION';
        break;
      case '23502': // not_null_violation
        message = 'Required field is missing';
        statusCode = 400;
        code = 'REQUIRED_FIELD_MISSING';
        break;
      case '22P02': // invalid_text_representation
        message = 'Invalid input format';
        statusCode = 400;
        code = 'INVALID_INPUT_FORMAT';
        break;
      default:
        // Log unexpected database errors
        logger.error('Database error', error, {
          path: req.path,
          pgCode: pgError.code
        });
    }

    const response: ErrorResponse = {
      success: false,
      error: message,
      code,
      requestId
    };

    res.status(statusCode).json(response);
    return;
  }

  // Handle syntax errors (JSON parsing)
  if (error instanceof SyntaxError && 'body' in error) {
    const response: ErrorResponse = {
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      requestId
    };

    res.status(400).json(response);
    return;
  }

  // Unknown/unexpected errors
  logger.error('Unhandled error', error, {
    path: req.path,
    method: req.method
  });

  // Don't expose error details in production
  const isDev = process.env.NODE_ENV === 'development';
  const response: ErrorResponse = {
    success: false,
    error: isDev ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId
  };

  res.status(500).json(response);
};

// =============================================================================
// 404 Handler
// =============================================================================

/**
 * Handler for routes that don't exist
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ErrorResponse = {
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND'
  };

  res.status(404).json(response);
};

// =============================================================================
// Async Handler Wrapper
// =============================================================================

/**
 * Wrap async route handlers to catch errors and forward to error handler
 * Eliminates the need for try-catch in every route
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default globalErrorHandler;
