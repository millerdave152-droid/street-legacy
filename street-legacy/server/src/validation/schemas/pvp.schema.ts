/**
 * PvP & Combat Validation Schemas
 */

import { z } from 'zod';
import { idSchema, positiveMoneySchema } from './common.schema.js';

// Attack type
export const attackTypeSchema = z.enum([
  'mug',
  'attack',
  'assassinate'
], { message: 'Invalid attack type' });

// Attack player
export const attackPlayerSchema = z.object({
  body: z.object({
    targetId: idSchema,
    attackType: attackTypeSchema.default('attack')
  })
});

// Rob player
export const robPlayerSchema = z.object({
  body: z.object({
    targetId: idSchema
  })
});

// Bounty schemas
export const placeBountySchema = z.object({
  body: z.object({
    targetId: idSchema,
    amount: positiveMoneySchema.refine(
      val => val >= 1000,
      'Bounty must be at least $1,000'
    ),
    reason: z.string().max(200).optional(),
    anonymous: z.boolean().default(false)
  })
});

export const claimBountySchema = z.object({
  body: z.object({
    bountyId: idSchema
  })
});

export const cancelBountySchema = z.object({
  body: z.object({
    bountyId: idSchema
  })
});

// Revenge attack (within time window after being attacked)
export const revengeAttackSchema = z.object({
  body: z.object({
    targetId: idSchema,
    originalAttackId: idSchema
  })
});

// Use combat item during fight
export const useCombatItemSchema = z.object({
  body: z.object({
    combatId: idSchema,
    itemId: idSchema
  })
});

// Flee from combat
export const fleeCombatSchema = z.object({
  body: z.object({
    combatId: idSchema
  })
});

export type AttackType = z.infer<typeof attackTypeSchema>;
export type AttackPlayer = z.infer<typeof attackPlayerSchema>['body'];
export type RobPlayer = z.infer<typeof robPlayerSchema>['body'];
export type PlaceBounty = z.infer<typeof placeBountySchema>['body'];
export type ClaimBounty = z.infer<typeof claimBountySchema>['body'];
export type RevengeAttack = z.infer<typeof revengeAttackSchema>['body'];
