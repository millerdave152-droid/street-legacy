/**
 * Validation Middleware
 *
 * Express middleware for validating requests using Zod schemas.
 * Provides consistent error responses and request transformation.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  success: false;
  error: string;
  details: ValidationErrorDetail[];
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format Zod error issues into a consistent structure
 */
function formatZodErrors(issues: ZodIssue[]): ValidationErrorDetail[] {
  return issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));
}

/**
 * Create a standardized validation error response
 */
function createValidationErrorResponse(errors: ValidationErrorDetail[]): ValidationErrorResponse {
  return {
    success: false,
    error: 'Validation failed',
    details: errors
  };
}

// ============================================================================
// Main Validation Middleware
// ============================================================================

/**
 * Create validation middleware for a Zod schema
 *
 * The schema should validate an object with optional `body`, `params`, and `query` properties.
 * Validated and transformed data will replace the original request data.
 *
 * @example
 * const schema = z.object({
 *   body: z.object({ email: z.string().email() }),
 *   params: z.object({ id: z.coerce.number() })
 * });
 *
 * router.post('/:id', validate(schema), handler);
 */
export function validate<T extends ZodSchema>(schema: T): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Create validation input from request
      const input = {
        body: req.body,
        params: req.params,
        query: req.query
      };

      // Validate and transform
      const validated = await schema.parseAsync(input);

      // Replace request data with validated/transformed data
      const validatedData = validated as any;
      if (validatedData.body !== undefined) {
        req.body = validatedData.body;
      }
      if (validatedData.params !== undefined) {
        req.params = validatedData.params;
      }
      if (validatedData.query !== undefined) {
        req.query = validatedData.query;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodErrors(error.issues);

        // Log validation failure (debug level)
        logger.debug('Validation failed', {
          path: req.path,
          method: req.method,
          errors
        });

        res.status(400).json(createValidationErrorResponse(errors));
        return;
      }

      // Unexpected error - log and return generic error
      logger.error('Unexpected validation error', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

// ============================================================================
// Body-Only Validation
// ============================================================================

/**
 * Validate only the request body
 * Convenience wrapper when you only need body validation
 *
 * @example
 * const bodySchema = z.object({ email: z.string().email() });
 * router.post('/', validateBody(bodySchema), handler);
 */
export function validateBody<T extends ZodSchema>(schema: T): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodErrors(error.issues);
        res.status(400).json(createValidationErrorResponse(errors));
        return;
      }

      logger.error('Unexpected validation error', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

// ============================================================================
// Query-Only Validation
// ============================================================================

/**
 * Validate only query parameters
 * Useful for GET requests with query params
 *
 * @example
 * const querySchema = z.object({ page: z.coerce.number().default(1) });
 * router.get('/', validateQuery(querySchema), handler);
 */
export function validateQuery<T extends ZodSchema>(schema: T): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodErrors(error.issues);
        res.status(400).json(createValidationErrorResponse(errors));
        return;
      }

      logger.error('Unexpected validation error', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

// ============================================================================
// Params-Only Validation
// ============================================================================

/**
 * Validate only URL parameters
 *
 * @example
 * const paramsSchema = z.object({ id: z.coerce.number().positive() });
 * router.get('/:id', validateParams(paramsSchema), handler);
 */
export function validateParams<T extends ZodSchema>(schema: T): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodErrors(error.issues);
        res.status(400).json(createValidationErrorResponse(errors));
        return;
      }

      logger.error('Unexpected validation error', error instanceof Error ? error : undefined);
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

// ============================================================================
// Utility: Safe Parse (non-throwing)
// ============================================================================

/**
 * Safely parse input without throwing
 * Returns { success: true, data } or { success: false, errors }
 */
export async function safeParse<T extends ZodSchema>(
  schema: T,
  input: unknown
): Promise<
  | { success: true; data: T['_output'] }
  | { success: false; errors: ValidationErrorDetail[] }
> {
  const result = await schema.safeParseAsync(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error.issues)
  };
}
