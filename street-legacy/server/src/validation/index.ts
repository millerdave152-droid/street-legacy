/**
 * Validation Module Index
 *
 * Central export point for validation schemas and middleware.
 */

// Export all schemas
export * from './schemas/index.js';

// Export validation middleware
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  safeParse,
  type ValidationErrorDetail,
  type ValidationErrorResponse
} from './validate.middleware.js';
