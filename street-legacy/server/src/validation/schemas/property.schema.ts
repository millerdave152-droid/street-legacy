/**
 * Property Validation Schemas
 *
 * Validates property operations including purchases, sales, and upgrades.
 */

import { z } from 'zod';
import {
  idSchema,
  districtIdSchema,
  positiveMoneySchema,
  moneySchema,
  paginationSchema,
  booleanQuerySchema
} from './common.schema.js';

// ============================================================================
// Property Type Enums
// ============================================================================

export const propertyTypeSchema = z.enum([
  'apartment',
  'house',
  'warehouse',
  'storefront',
  'nightclub',
  'restaurant',
  'factory',
  'office',
  'penthouse',
  'mansion'
], {
  message: 'Invalid property type'
});

export const upgradeTypeSchema = z.enum([
  'security',
  'capacity',
  'efficiency',
  'stealth',
  'defense',
  'income',
  'storage'
], {
  message: 'Invalid upgrade type'
});

// ============================================================================
// Purchase & Sell Schemas
// ============================================================================

/**
 * Purchase property validation
 */
export const purchasePropertySchema = z.object({
  params: z.object({
    propertyId: idSchema
  }),
  body: z.object({
    offerAmount: positiveMoneySchema.optional() // Optional negotiated price
  })
});

export type PurchasePropertyParams = z.infer<typeof purchasePropertySchema>['params'];
export type PurchasePropertyInput = z.infer<typeof purchasePropertySchema>['body'];

/**
 * Sell property validation
 */
export const sellPropertySchema = z.object({
  params: z.object({
    propertyId: idSchema
  }),
  body: z.object({
    askingPrice: positiveMoneySchema,
    sellToMarket: z.boolean().default(false) // Instant sell vs player listing
  })
});

export type SellPropertyParams = z.infer<typeof sellPropertySchema>['params'];
export type SellPropertyInput = z.infer<typeof sellPropertySchema>['body'];

// ============================================================================
// Upgrade Schema
// ============================================================================

/**
 * Upgrade property validation
 */
export const upgradePropertySchema = z.object({
  params: z.object({
    propertyId: idSchema
  }),
  body: z.object({
    upgradeType: upgradeTypeSchema
  })
});

export type UpgradePropertyParams = z.infer<typeof upgradePropertySchema>['params'];
export type UpgradePropertyInput = z.infer<typeof upgradePropertySchema>['body'];

// ============================================================================
// List Properties Schema
// ============================================================================

/**
 * List properties query parameters
 */
export const listPropertiesSchema = z.object({
  query: paginationSchema.extend({
    district: districtIdSchema.optional(),
    type: propertyTypeSchema.optional(),
    forSale: booleanQuerySchema.optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    owned: booleanQuerySchema.optional(), // Filter to player's owned properties
    sortBy: z.enum(['price', 'income', 'level', 'created']).default('price')
  })
});

export type ListPropertiesQuery = z.infer<typeof listPropertiesSchema>['query'];

// ============================================================================
// Business Front Schemas
// ============================================================================

/**
 * Convert property to business front validation
 */
export const convertToBusinessSchema = z.object({
  params: z.object({
    propertyId: idSchema
  }),
  body: z.object({
    businessType: z.enum([
      'laundromat',
      'restaurant',
      'bar',
      'car_wash',
      'convenience_store',
      'pawn_shop',
      'strip_club',
      'casino_front'
    ], {
      message: 'Invalid business type'
    }),
    businessName: z.string()
      .min(3, 'Business name must be at least 3 characters')
      .max(50, 'Business name too long')
      .transform(val => val.replace(/[<>'"`;]/g, '').trim())
  })
});

export type ConvertToBusinessParams = z.infer<typeof convertToBusinessSchema>['params'];
export type ConvertToBusinessInput = z.infer<typeof convertToBusinessSchema>['body'];

/**
 * Set business operating hours validation
 */
export const setBusinessHoursSchema = z.object({
  params: z.object({
    propertyId: idSchema
  }),
  body: z.object({
    openHour: z.coerce.number().int().min(0).max(23),
    closeHour: z.coerce.number().int().min(0).max(23),
    daysOpen: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
      .min(1, 'Must be open at least one day')
  })
});

// ============================================================================
// Property Operations Schemas
// ============================================================================

/**
 * Start property operation validation
 */
export const startOperationSchema = z.object({
  params: z.object({
    propertyId: idSchema
  }),
  body: z.object({
    operationType: z.string().min(1, 'Operation type required'),
    investedAmount: positiveMoneySchema.optional()
  })
});

/**
 * Collect property income validation
 */
export const collectIncomeSchema = z.object({
  params: z.object({
    propertyId: idSchema
  })
});

// ============================================================================
// Real Estate Market Schemas
// ============================================================================

/**
 * Search real estate market query parameters
 */
export const searchMarketSchema = z.object({
  query: paginationSchema.extend({
    district: districtIdSchema.optional(),
    type: propertyTypeSchema.optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minIncome: z.coerce.number().nonnegative().optional(),
    minLevel: z.coerce.number().int().min(1).max(50).optional(),
    sortBy: z.enum(['price_asc', 'price_desc', 'income_desc', 'newest']).default('price_asc')
  })
});

export type SearchMarketQuery = z.infer<typeof searchMarketSchema>['query'];
