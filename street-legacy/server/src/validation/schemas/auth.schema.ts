/**
 * Authentication Validation Schemas
 *
 * Validates login, registration, and password-related requests.
 */

import { z } from 'zod';
import {
  usernameSchema,
  emailSchema,
  passwordSchema,
  loginPasswordSchema
} from './common.schema.js';

// ============================================================================
// Login Schema
// ============================================================================

export const loginSchema = z.object({
  body: z.object({
    username: z.string()
      .min(1, 'Username is required')
      .max(255, 'Username too long'),
    password: loginPasswordSchema
  })
});

export type LoginInput = z.infer<typeof loginSchema>['body'];

// ============================================================================
// Registration Schema
// ============================================================================

export const registerSchema = z.object({
  body: z.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password')
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  )
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];

// ============================================================================
// Change Password Schema
// ============================================================================

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password')
  }).refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  ).refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message: 'New password must be different from current password',
      path: ['newPassword']
    }
  )
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];

// ============================================================================
// Password Reset Request Schema
// ============================================================================

export const passwordResetRequestSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>['body'];

// ============================================================================
// Password Reset Schema
// ============================================================================

export const passwordResetSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password')
  }).refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  )
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>['body'];

// ============================================================================
// Update Profile Schema
// ============================================================================

export const updateProfileSchema = z.object({
  body: z.object({
    email: emailSchema.optional(),
    // Other profile fields that can be updated
    displayName: z.string()
      .min(1, 'Display name cannot be empty')
      .max(30, 'Display name too long')
      .regex(/^[a-zA-Z0-9_ ]+$/, 'Display name contains invalid characters')
      .optional()
  })
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];

// ============================================================================
// Refresh Token Schema
// ============================================================================

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
