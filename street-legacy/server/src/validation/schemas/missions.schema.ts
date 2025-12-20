/**
 * Mission Validation Schemas
 */

import { z } from 'zod';
import { idSchema } from './common.schema.js';

// Claim mission reward
export const claimMissionSchema = z.object({
  body: z.object({
    playerMissionId: idSchema
  })
});

// Update mission progress (internal use)
export const updateMissionProgressSchema = z.object({
  body: z.object({
    missionType: z.enum([
      'crimes_commit',
      'crimes_success',
      'jobs_complete',
      'cash_earn',
      'district_visit',
      'crime_specific',
      'level_reach'
    ]),
    progress: z.number().int().nonnegative().optional(),
    districtId: idSchema.optional(),
    crimeId: idSchema.optional()
  })
});

export type ClaimMission = z.infer<typeof claimMissionSchema>['body'];
export type UpdateMissionProgress = z.infer<typeof updateMissionProgressSchema>['body'];
