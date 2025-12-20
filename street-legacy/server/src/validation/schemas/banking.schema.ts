/**
 * Banking Validation Schemas
 *
 * Validates banking operations including deposits, withdrawals, transfers, and loans.
 */

import { z } from 'zod';
import {
  idSchema,
  positiveMoneySchema,
  moneySchema,
  usernameSchema,
  shortTextSchema,
  paginationSchema
} from './common.schema.js';

// ============================================================================
// Deposit & Withdrawal Schemas
// ============================================================================

/**
 * Deposit cash to bank validation
 */
export const depositSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema
  })
});

export type DepositInput = z.infer<typeof depositSchema>['body'];

/**
 * Withdraw cash from bank validation
 */
export const withdrawSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema
  })
});

export type WithdrawInput = z.infer<typeof withdrawSchema>['body'];

// ============================================================================
// Transfer Schema
// ============================================================================

/**
 * Transfer money to another player validation
 */
export const transferSchema = z.object({
  body: z.object({
    // Can specify recipient by ID or username
    recipientId: idSchema.optional(),
    recipientUsername: usernameSchema.optional(),
    amount: positiveMoneySchema,
    note: z.string()
      .max(200, 'Note too long (max 200 characters)')
      .transform(val => val.replace(/[<>'"`;]/g, '').trim())
      .optional()
  }).refine(
    (data) => data.recipientId !== undefined || data.recipientUsername !== undefined,
    {
      message: 'Either recipientId or recipientUsername is required',
      path: ['recipientId']
    }
  )
});

export type TransferInput = z.infer<typeof transferSchema>['body'];

// ============================================================================
// Loan Schemas
// ============================================================================

/**
 * Request loan validation
 */
export const requestLoanSchema = z.object({
  body: z.object({
    amount: z.coerce
      .number()
      .int('Loan amount must be a whole number')
      .min(1000, 'Minimum loan is $1,000')
      .max(10_000_000, 'Maximum loan is $10,000,000')
  })
});

export type RequestLoanInput = z.infer<typeof requestLoanSchema>['body'];

/**
 * Repay loan validation
 */
export const repayLoanSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema,
    payAll: z.boolean().default(false) // Pay off entire remaining balance
  })
});

export type RepayLoanInput = z.infer<typeof repayLoanSchema>['body'];

// ============================================================================
// Safe Deposit Box Schemas
// ============================================================================

/**
 * Upgrade safe deposit box validation
 */
export const upgradeSafeSchema = z.object({
  body: z.object({
    tier: z.coerce
      .number()
      .int('Tier must be a whole number')
      .min(1, 'Invalid tier')
      .max(5, 'Maximum tier is 5')
  })
});

export type UpgradeSafeInput = z.infer<typeof upgradeSafeSchema>['body'];

/**
 * Store in safe deposit box validation
 */
export const storeInSafeSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema
  })
});

export type StoreInSafeInput = z.infer<typeof storeInSafeSchema>['body'];

/**
 * Withdraw from safe deposit box validation
 */
export const withdrawFromSafeSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema
  })
});

export type WithdrawFromSafeInput = z.infer<typeof withdrawFromSafeSchema>['body'];

// ============================================================================
// Transaction History Schema
// ============================================================================

/**
 * Get transaction history query parameters
 */
export const transactionHistorySchema = z.object({
  query: paginationSchema.extend({
    type: z.enum(['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'loan', 'repayment', 'all'])
      .default('all'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
});

export type TransactionHistoryQuery = z.infer<typeof transactionHistorySchema>['query'];

// ============================================================================
// Money Laundering Schemas
// ============================================================================

/**
 * Launder money validation
 */
export const launderMoneySchema = z.object({
  body: z.object({
    amount: z.coerce
      .number()
      .int('Amount must be a whole number')
      .min(1000, 'Minimum laundering amount is $1,000')
      .max(100_000_000, 'Maximum laundering amount is $100,000,000'),
    method: z.enum(['business_front', 'casino', 'real_estate', 'crypto'], {
      message: 'Invalid laundering method'
    }),
    businessId: idSchema.optional() // Required if method is 'business_front'
  }).refine(
    (data) => data.method !== 'business_front' || data.businessId !== undefined,
    {
      message: 'Business ID required for business front laundering',
      path: ['businessId']
    }
  )
});

export type LaunderMoneyInput = z.infer<typeof launderMoneySchema>['body'];
