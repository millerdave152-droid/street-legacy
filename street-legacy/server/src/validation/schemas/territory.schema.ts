/**
 * Territory & Property Validation Schemas
 */

import { z } from 'zod';
import { idSchema, positiveMoneySchema, positiveIntSchema, shortTextSchema } from './common.schema.js';

// Territory action
export const territoryActionSchema = z.enum([
  'capture',
  'defend',
  'abandon',
  'upgrade',
  'collect'
], { message: 'Invalid territory action' });

// Capture territory
export const captureTerritorySchema = z.object({
  body: z.object({
    territoryId: idSchema
  })
});

// Defend territory
export const defendTerritorySchema = z.object({
  body: z.object({
    territoryId: idSchema,
    defenders: z.array(idSchema).max(10, 'Maximum 10 defenders').optional()
  })
});

// Upgrade territory
export const upgradeTerritorySchema = z.object({
  body: z.object({
    territoryId: idSchema,
    upgradeType: z.enum([
      'defense',
      'income',
      'storage',
      'influence'
    ])
  })
});

// Property purchase
export const purchasePropertySchema = z.object({
  body: z.object({
    propertyId: idSchema
  })
});

// Property upgrade
export const upgradePropertySchema = z.object({
  body: z.object({
    propertyId: idSchema,
    upgradeType: z.string().min(1).max(50)
  })
});

// Set property rent
export const setPropertyRentSchema = z.object({
  body: z.object({
    propertyId: idSchema,
    rentAmount: positiveMoneySchema
  })
});

// Evict tenant
export const evictTenantSchema = z.object({
  body: z.object({
    propertyId: idSchema,
    tenantId: idSchema,
    reason: shortTextSchema.optional()
  })
});

// Start property operation
export const startPropertyOperationSchema = z.object({
  body: z.object({
    propertyId: idSchema,
    operationType: z.enum([
      'production',
      'storage',
      'laundering',
      'front'
    ]),
    workers: positiveIntSchema.max(20).default(1)
  })
});

// Raid property
export const raidPropertySchema = z.object({
  body: z.object({
    propertyId: idSchema,
    raiders: z.array(idSchema).max(5, 'Maximum 5 raiders').optional()
  })
});

export type TerritoryAction = z.infer<typeof territoryActionSchema>;
export type CaptureTerritory = z.infer<typeof captureTerritorySchema>['body'];
export type DefendTerritory = z.infer<typeof defendTerritorySchema>['body'];
export type UpgradeTerritory = z.infer<typeof upgradeTerritorySchema>['body'];
export type PurchaseProperty = z.infer<typeof purchasePropertySchema>['body'];
export type UpgradeProperty = z.infer<typeof upgradePropertySchema>['body'];
export type StartPropertyOperation = z.infer<typeof startPropertyOperationSchema>['body'];
export type RaidProperty = z.infer<typeof raidPropertySchema>['body'];
