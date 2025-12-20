/**
 * CSRF Protection Middleware
 *
 * Provides Cross-Site Request Forgery protection for the Street Legacy API.
 * Uses double-submit cookie pattern with secure configuration.
 */

import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

// Configure CSRF protection
export const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 3600 // 1 hour
  }
});

/**
 * Middleware to provide CSRF token to client
 * Sets the token in a readable cookie for the SPA
 */
export const provideCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Only set token if CSRF protection was applied
  if (typeof req.csrfToken === 'function') {
    // Set CSRF token in response header for SPA to read
    res.cookie('XSRF-TOKEN', req.csrfToken(), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }
  next();
};

/**
 * Error handler for CSRF failures
 * Returns a consistent error response for CSRF validation failures
 */
export const csrfErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_ERROR'
    });
  }
  next(err);
};

// Routes that should be exempt from CSRF (webhooks, public APIs, health checks)
const csrfExemptRoutes = [
  '/api/webhooks/',
  '/api/public/',
  '/api/health',
  '/api/csrf-token' // Token endpoint itself should be exempt
];

// Routes that use JWT authentication (API routes that don't need CSRF)
// These routes are protected by Bearer token authentication instead
const jwtProtectedRoutes = [
  '/api/auth/login',
  '/api/auth/register'
];

/**
 * Conditional CSRF middleware
 * Applies CSRF protection selectively based on route and method
 */
export const conditionalCsrf = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for exempt routes
  if (csrfExemptRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Skip CSRF for JWT-protected auth routes (login/register use different protection)
  if (jwtProtectedRoutes.some(route => req.path === route)) {
    return next();
  }

  // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // But still set up CSRF for token generation on GET requests
    return csrfProtection(req, res, (err) => {
      if (err) {
        // If CSRF setup fails on GET, just continue (might be first request)
        return next();
      }
      next();
    });
  }

  // Apply CSRF protection for state-changing methods
  csrfProtection(req, res, next);
};

/**
 * Route handler for getting a CSRF token
 * Used by SPA on initial load
 */
export const getCsrfToken = (req: Request, res: Response) => {
  if (typeof req.csrfToken === 'function') {
    res.json({
      success: true,
      csrfToken: req.csrfToken()
    });
  } else {
    res.json({
      success: true,
      csrfToken: null,
      message: 'CSRF protection not required for this request'
    });
  }
};
