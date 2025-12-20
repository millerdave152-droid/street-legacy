/**
 * Game/Crime Validation Schemas
 *
 * Validates game actions including crimes, travel, and player actions.
 */

import { z } from 'zod';
import {
  idSchema,
  crimeIdSchema,
  districtIdSchema,
  paginationSchema,
  booleanQuerySchema,
  positiveIntSchema
} from './common.schema.js';

// ============================================================================
// Crime Schemas
// ============================================================================

/**
 * Commit crime validation
 */
export const commitCrimeSchema = z.object({
  body: z.object({
    crimeId: crimeIdSchema
  })
});

export type CommitCrimeInput = z.infer<typeof commitCrimeSchema>['body'];

/**
 * Get crime history query parameters
 */
export const crimeHistorySchema = z.object({
  query: paginationSchema.extend({
    success: booleanQuerySchema.optional(),
    crimeId: crimeIdSchema.optional(),
    districtId: districtIdSchema.optional()
  })
});

export type CrimeHistoryQuery = z.infer<typeof crimeHistorySchema>['query'];

// ============================================================================
// Travel Schemas
// ============================================================================

/**
 * Travel to district validation
 */
export const travelSchema = z.object({
  body: z.object({
    districtId: districtIdSchema
  })
});

export type TravelInput = z.infer<typeof travelSchema>['body'];

// ============================================================================
// Rob Player Schemas
// ============================================================================

/**
 * Rob another player validation
 */
export const robPlayerSchema = z.object({
  body: z.object({
    targetId: idSchema
  })
});

export type RobPlayerInput = z.infer<typeof robPlayerSchema>['body'];

// ============================================================================
// Jail Schemas
// ============================================================================

/**
 * Attempt jailbreak validation
 */
export const jailbreakSchema = z.object({
  body: z.object({
    method: z.enum(['bribe', 'escape', 'wait'], {
      message: 'Invalid jailbreak method'
    }).default('wait')
  })
});

export type JailbreakInput = z.infer<typeof jailbreakSchema>['body'];

/**
 * Pay bail validation
 */
export const payBailSchema = z.object({
  body: z.object({
    // Amount is calculated server-side, this is just confirmation
    confirm: z.boolean().refine(val => val === true, 'Must confirm bail payment')
  })
});

export type PayBailInput = z.infer<typeof payBailSchema>['body'];

// ============================================================================
// PvP/Combat Schemas
// ============================================================================

/**
 * Attack player validation
 */
export const attackPlayerSchema = z.object({
  body: z.object({
    targetId: idSchema,
    weapon: z.string().optional() // Optional equipped weapon ID
  })
});

export type AttackPlayerInput = z.infer<typeof attackPlayerSchema>['body'];

/**
 * Combat action validation (during active combat)
 */
export const combatActionSchema = z.object({
  body: z.object({
    combatId: idSchema,
    action: z.enum(['attack', 'defend', 'flee', 'use_item'], {
      message: 'Invalid combat action'
    }),
    itemId: idSchema.optional() // Required if action is 'use_item'
  }).refine(
    (data) => data.action !== 'use_item' || data.itemId !== undefined,
    {
      message: 'Item ID required when using an item',
      path: ['itemId']
    }
  )
});

export type CombatActionInput = z.infer<typeof combatActionSchema>['body'];

// ============================================================================
// Bounty Schemas
// ============================================================================

/**
 * Place bounty validation
 */
export const placeBountySchema = z.object({
  body: z.object({
    targetId: idSchema,
    amount: z.coerce
      .number()
      .int('Bounty must be a whole number')
      .min(1000, 'Minimum bounty is $1,000')
      .max(100_000_000, 'Maximum bounty is $100,000,000'),
    reason: z.string()
      .max(200, 'Reason too long')
      .transform(val => val.replace(/[<>'"`;]/g, '').trim())
      .optional()
  })
});

export type PlaceBountyInput = z.infer<typeof placeBountySchema>['body'];

/**
 * Claim bounty validation
 */
export const claimBountySchema = z.object({
  params: z.object({
    bountyId: idSchema
  })
});

// ============================================================================
// Equipment Schemas
// ============================================================================

/**
 * Equip item validation
 */
export const equipItemSchema = z.object({
  body: z.object({
    itemId: idSchema,
    slot: z.enum(['weapon', 'armor', 'accessory', 'vehicle'], {
      message: 'Invalid equipment slot'
    })
  })
});

export type EquipItemInput = z.infer<typeof equipItemSchema>['body'];

/**
 * Unequip item validation
 */
export const unequipItemSchema = z.object({
  body: z.object({
    slot: z.enum(['weapon', 'armor', 'accessory', 'vehicle'], {
      message: 'Invalid equipment slot'
    })
  })
});

export type UnequipItemInput = z.infer<typeof unequipItemSchema>['body'];

// ============================================================================
// Mission Schemas
// ============================================================================

/**
 * Start mission validation
 */
export const startMissionSchema = z.object({
  params: z.object({
    missionId: idSchema
  })
});

/**
 * Complete mission objective validation
 */
export const completeMissionObjectiveSchema = z.object({
  params: z.object({
    missionId: idSchema
  }),
  body: z.object({
    objectiveId: idSchema
  })
});

// ============================================================================
// Heist Schemas
// ============================================================================

/**
 * Create heist validation
 */
export const createHeistSchema = z.object({
  body: z.object({
    heistType: z.string().min(1, 'Heist type required'),
    targetId: idSchema.optional(), // Target property/business
    crewRequired: z.coerce.number().int().min(1).max(10).default(1)
  })
});

export type CreateHeistInput = z.infer<typeof createHeistSchema>['body'];

/**
 * Join heist validation
 */
export const joinHeistSchema = z.object({
  params: z.object({
    heistId: idSchema
  }),
  body: z.object({
    role: z.enum(['leader', 'muscle', 'tech', 'driver', 'lookout'], {
      message: 'Invalid heist role'
    }).optional()
  })
});

// ============================================================================
// Scheme Schemas
// ============================================================================

/**
 * Start scheme validation
 */
export const startSchemeSchema = z.object({
  body: z.object({
    schemeId: idSchema,
    investedCash: z.coerce
      .number()
      .nonnegative('Investment cannot be negative')
      .optional()
  })
});

export type StartSchemeInput = z.infer<typeof startSchemeSchema>['body'];

/**
 * Scheme action validation
 */
export const schemeActionSchema = z.object({
  params: z.object({
    activeSchemeId: idSchema
  }),
  body: z.object({
    action: z.enum(['progress', 'abort', 'complete'], {
      message: 'Invalid scheme action'
    })
  })
});
