/**
 * Inventory & Items Validation Schemas
 */

import { z } from 'zod';
import { idSchema, positiveIntSchema, paginationSchema } from './common.schema.js';

// Item categories
export const itemCategorySchema = z.enum([
  'weapon',
  'armor',
  'vehicle',
  'tool',
  'consumable',
  'material',
  'cosmetic',
  'special'
], { message: 'Invalid item category' });

// Item rarity
export const itemRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary'
], { message: 'Invalid item rarity' });

// Get inventory with filters
export const getInventorySchema = z.object({
  query: z.object({
    category: itemCategorySchema.optional(),
    rarity: itemRaritySchema.optional(),
    equipped: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    ...paginationSchema.shape
  })
});

// Use item
export const useItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    quantity: positiveIntSchema.default(1)
  })
});

// Equip/unequip item
export const equipItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    slot: z.enum([
      'weapon',
      'armor',
      'accessory',
      'vehicle'
    ]).optional()
  })
});

// Drop/destroy item
export const dropItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    quantity: positiveIntSchema.default(1)
  })
});

// Transfer item (to another player or storage)
export const transferItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    quantity: positiveIntSchema.default(1),
    targetType: z.enum(['player', 'storage', 'property']),
    targetId: idSchema
  })
});

// Buy item from shop
export const buyItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    quantity: positiveIntSchema.default(1)
  })
});

// Sell item
export const sellItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    quantity: positiveIntSchema.default(1)
  })
});

export type ItemCategory = z.infer<typeof itemCategorySchema>;
export type ItemRarity = z.infer<typeof itemRaritySchema>;
export type GetInventory = z.infer<typeof getInventorySchema>['query'];
export type UseItem = z.infer<typeof useItemSchema>['body'];
export type EquipItem = z.infer<typeof equipItemSchema>['body'];
export type TransferItem = z.infer<typeof transferItemSchema>['body'];
export type BuyItem = z.infer<typeof buyItemSchema>['body'];
