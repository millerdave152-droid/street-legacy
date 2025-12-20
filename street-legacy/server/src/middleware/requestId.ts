/**
 * Request ID Middleware
 *
 * Generates unique request IDs for request correlation and tracing.
 * Useful for debugging, logging, and tracking requests across services.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      requestStartTime: number;
    }
  }
}

/**
 * Request ID header names
 */
const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Middleware to assign or propagate request IDs
 *
 * If a request ID is provided in headers (from upstream services),
 * it will be used. Otherwise, a new UUID is generated.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check for existing request ID from headers
  const existingId = req.headers[REQUEST_ID_HEADER] || req.headers[CORRELATION_ID_HEADER];

  // Use existing or generate new
  const requestId = typeof existingId === 'string' ? existingId : randomUUID();

  // Attach to request object
  req.requestId = requestId;
  req.requestStartTime = Date.now();

  // Set response header so clients can see the request ID
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}

/**
 * Request timing middleware
 *
 * Calculates and logs request duration. Can be used with the request ID
 * for detailed performance tracking.
 */
export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Set timing header before response finishes
  res.on('close', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Log slow requests (>500ms) or errors
    if (duration > 500 || statusCode >= 400) {
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      const logData = {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode,
        duration: `${duration}ms`,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        ip: req.ip || req.socket.remoteAddress
      };

      if (logLevel === 'error') {
        console.error('[REQUEST]', JSON.stringify(logData));
      } else if (logLevel === 'warn') {
        console.warn('[REQUEST]', JSON.stringify(logData));
      } else if (duration > 1000) {
        // Only log slow successful requests
        console.log('[SLOW REQUEST]', JSON.stringify(logData));
      }
    }
  });

  next();
}

/**
 * Get the current request ID (for use in services/utilities)
 */
export function getRequestId(req: Request): string {
  return req.requestId || 'unknown';
}

/**
 * Create a logging context object with request info
 */
export function createRequestContext(req: Request): object {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).player?.id
  };
}

export default requestIdMiddleware;
