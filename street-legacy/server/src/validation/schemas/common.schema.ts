/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for validating common data types
 * across the Street Legacy API.
 */

import { z } from 'zod';

// ============================================================================
// ID & Reference Schemas
// ============================================================================

/**
 * Positive integer ID (database primary keys)
 */
export const idSchema = z.coerce
  .number()
  .int('ID must be a whole number')
  .positive('ID must be positive');

/**
 * UUID format validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

// ============================================================================
// User Identity Schemas
// ============================================================================

/**
 * Username validation
 * - 3-20 characters
 * - Only alphanumeric and underscores
 * - No consecutive underscores
 * - Cannot start/end with underscore
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .regex(/^(?!_)/, 'Username cannot start with underscore')
  .regex(/(?<!_)$/, 'Username cannot end with underscore')
  .regex(/^(?!.*__).+$/, 'Username cannot contain consecutive underscores');

/**
 * Email validation with length limit
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be at most 255 characters')
  .toLowerCase();

/**
 * Strong password validation
 * - At least 8 characters
 * - Contains uppercase, lowercase, number, and special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Simple password for login (no complexity check, just length)
 */
export const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(128, 'Password too long');

// ============================================================================
// Number Schemas
// ============================================================================

/**
 * Positive integer (> 0)
 */
export const positiveIntSchema = z.coerce
  .number()
  .int('Must be a whole number')
  .positive('Must be a positive number');

/**
 * Non-negative integer (>= 0)
 */
export const nonNegativeIntSchema = z.coerce
  .number()
  .int('Must be a whole number')
  .nonnegative('Cannot be negative');

/**
 * Money amount validation
 * - Non-negative
 * - Maximum 999 billion
 * - Rounded to whole numbers
 */
export const moneySchema = z.coerce
  .number()
  .nonnegative('Amount cannot be negative')
  .max(999_999_999_999, 'Amount exceeds maximum limit')
  .transform(val => Math.floor(val)); // Round down to whole number

/**
 * Positive money amount (for transactions)
 */
export const positiveMoneySchema = moneySchema
  .refine(val => val > 0, 'Amount must be greater than 0');

/**
 * Percentage (0-100)
 */
export const percentageSchema = z.coerce
  .number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100');

// ============================================================================
// Pagination & Sorting Schemas
// ============================================================================

/**
 * Standard pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

/**
 * Extended pagination with sorting
 */
export const paginationWithSortSchema = paginationSchema.extend({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// Game-Specific Schemas
// ============================================================================

/**
 * District ID validation
 * Valid Toronto districts in the game
 */
export const districtIdSchema = z.coerce
  .number()
  .int('District ID must be a whole number')
  .min(1, 'Invalid district')
  .max(12, 'Invalid district');

/**
 * District name validation
 */
export const districtNameSchema = z.enum([
  'downtown',
  'yorkville',
  'the-beaches',
  'scarborough',
  'north-york',
  'etobicoke',
  'mississauga',
  'brampton',
  'east-end',
  'west-end',
  'the-junction',
  'liberty-village'
], {
  message: 'Invalid district name'
});

/**
 * Crime ID validation
 */
export const crimeIdSchema = z.coerce
  .number()
  .int('Crime ID must be a whole number')
  .positive('Invalid crime ID');

/**
 * Player level validation (1-50)
 */
export const levelSchema = z.coerce
  .number()
  .int('Level must be a whole number')
  .min(1, 'Level must be at least 1')
  .max(50, 'Level cannot exceed 50');

// ============================================================================
// String Sanitization Schemas
// ============================================================================

/**
 * Sanitized string - removes potentially dangerous characters
 * Use for user-provided text that will be displayed
 */
export const sanitizedStringSchema = z
  .string()
  .transform(val => val
    .replace(/[<>]/g, '') // Remove angle brackets (XSS)
    .replace(/['";`]/g, '') // Remove quotes (SQL injection)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
  );

/**
 * Chat message validation
 * - 1-500 characters
 * - Sanitized
 */
export const chatMessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(500, 'Message too long (max 500 characters)')
  .transform(val => val
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
  );

/**
 * Short text input (names, titles)
 * - 1-50 characters
 * - Sanitized
 */
export const shortTextSchema = z
  .string()
  .min(1, 'Text is required')
  .max(50, 'Text too long (max 50 characters)')
  .transform(val => val
    .replace(/[<>'"`;]/g, '')
    .trim()
  );

/**
 * Long text input (descriptions)
 * - 0-1000 characters
 * - Sanitized
 */
export const longTextSchema = z
  .string()
  .max(1000, 'Text too long (max 1000 characters)')
  .transform(val => val
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
  )
  .optional();

// ============================================================================
// Date/Time Schemas
// ============================================================================

/**
 * ISO date string validation
 */
export const isoDateSchema = z.string().datetime({ message: 'Invalid date format' });

/**
 * Unix timestamp validation
 */
export const timestampSchema = z.coerce
  .number()
  .int()
  .positive('Invalid timestamp');

// ============================================================================
// Boolean Schema
// ============================================================================

/**
 * Boolean that accepts string 'true'/'false' from query params
 */
export const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform(val => val === true || val === 'true');

// ============================================================================
// Type Exports
// ============================================================================

export type Pagination = z.infer<typeof paginationSchema>;
export type PaginationWithSort = z.infer<typeof paginationWithSortSchema>;
