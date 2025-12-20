/**
 * Heists Validation Schemas
 */

import { z } from 'zod';
import { idSchema, positiveIntSchema } from './common.schema.js';

// Heist difficulty
export const heistDifficultySchema = z.enum([
  'easy',
  'medium',
  'hard',
  'extreme'
], { message: 'Invalid heist difficulty' });

// Start heist
export const startHeistSchema = z.object({
  body: z.object({
    heistId: idSchema,
    difficulty: heistDifficultySchema.default('medium'),
    crewMembers: z.array(idSchema).max(4, 'Maximum 4 crew members').optional()
  })
});

// Heist action during gameplay
export const heistActionSchema = z.object({
  body: z.object({
    heistInstanceId: idSchema,
    action: z.enum([
      'proceed',
      'stealth',
      'aggressive',
      'hack',
      'lockpick',
      'bribe',
      'escape',
      'abort'
    ]),
    targetId: idSchema.optional()
  })
});

// Complete heist checkpoint
export const heistCheckpointSchema = z.object({
  body: z.object({
    heistInstanceId: idSchema,
    checkpointId: idSchema,
    success: z.boolean()
  })
});

// Abort heist
export const abortHeistSchema = z.object({
  body: z.object({
    heistInstanceId: idSchema,
    reason: z.string().max(100).optional()
  })
});

// Split heist loot
export const splitLootSchema = z.object({
  body: z.object({
    heistInstanceId: idSchema,
    splits: z.array(z.object({
      playerId: idSchema,
      percentage: z.number().min(0).max(100)
    })).refine(
      splits => splits.reduce((sum, s) => sum + s.percentage, 0) === 100,
      'Loot splits must total 100%'
    )
  })
});

export type HeistDifficulty = z.infer<typeof heistDifficultySchema>;
export type StartHeist = z.infer<typeof startHeistSchema>['body'];
export type HeistAction = z.infer<typeof heistActionSchema>['body'];
export type AbortHeist = z.infer<typeof abortHeistSchema>['body'];
export type SplitLoot = z.infer<typeof splitLootSchema>['body'];
