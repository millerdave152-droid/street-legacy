/**
 * Trading Validation Schemas
 */

import { z } from 'zod';
import { idSchema, positiveMoneySchema, nonNegativeIntSchema } from './common.schema.js';

// Create trade offer
export const createTradeSchema = z.object({
  body: z.object({
    targetPlayerId: idSchema,
    offeringItems: z.array(idSchema).max(20, 'Maximum 20 items per trade').default([]),
    requestingItems: z.array(idSchema).max(20, 'Maximum 20 items per trade').default([]),
    offeringCash: nonNegativeIntSchema.default(0),
    requestingCash: nonNegativeIntSchema.default(0)
  }).refine(
    data => data.offeringItems.length > 0 || data.requestingItems.length > 0 ||
            data.offeringCash > 0 || data.requestingCash > 0,
    'Trade must include at least one item or cash amount'
  )
});

// Accept/decline/cancel trade
export const tradeActionSchema = z.object({
  body: z.object({
    tradeId: idSchema
  })
});

export type CreateTrade = z.infer<typeof createTradeSchema>['body'];
export type TradeAction = z.infer<typeof tradeActionSchema>['body'];
