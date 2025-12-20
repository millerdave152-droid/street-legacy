/**
 * Crews Validation Schemas
 */

import { z } from 'zod';
import { idSchema, shortTextSchema, longTextSchema, positiveMoneySchema, paginationSchema } from './common.schema.js';

// Crew tag validation (3-5 uppercase letters/numbers)
export const crewTagSchema = z.string()
  .min(3, 'Crew tag must be 3-5 characters')
  .max(5, 'Crew tag must be 3-5 characters')
  .regex(/^[A-Z0-9]+$/, 'Crew tag must be uppercase letters and numbers only')
  .toUpperCase();

// Crew name validation
export const crewNameSchema = z.string()
  .min(3, 'Crew name must be at least 3 characters')
  .max(30, 'Crew name must be at most 30 characters')
  .regex(/^[a-zA-Z0-9\s_-]+$/, 'Crew name contains invalid characters');

// Create crew
export const createCrewSchema = z.object({
  body: z.object({
    name: crewNameSchema,
    tag: crewTagSchema,
    description: longTextSchema.default('')
  })
});

// Update crew
export const updateCrewSchema = z.object({
  body: z.object({
    description: longTextSchema.optional(),
    isRecruiting: z.boolean().optional(),
    minLevel: z.number().int().min(1).max(50).optional(),
    maxMembers: z.number().int().min(5).max(100).optional()
  })
});

// Invite player
export const inviteToCrewSchema = z.object({
  body: z.object({
    playerId: idSchema
  })
});

// Accept/decline invite
export const crewInviteActionSchema = z.object({
  body: z.object({
    inviteId: idSchema
  })
});

// Kick member
export const kickMemberSchema = z.object({
  body: z.object({
    memberId: idSchema,
    reason: shortTextSchema.optional()
  })
});

// Promote/demote member
export const changeMemberRankSchema = z.object({
  body: z.object({
    memberId: idSchema,
    rank: z.enum(['member', 'officer', 'leader'])
  })
});

// Deposit to crew bank
export const crewBankDepositSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema
  })
});

// Withdraw from crew bank (leaders only)
export const crewBankWithdrawSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema,
    reason: shortTextSchema
  })
});

// Search crews
export const searchCrewsSchema = z.object({
  query: z.object({
    search: z.string().max(30).optional(),
    isRecruiting: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    minLevel: z.coerce.number().int().min(1).max(50).optional(),
    ...paginationSchema.shape
  })
});

// Crew message
export const crewMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(500)
  })
});

export type CrewTag = z.infer<typeof crewTagSchema>;
export type CrewName = z.infer<typeof crewNameSchema>;
export type CreateCrew = z.infer<typeof createCrewSchema>['body'];
export type UpdateCrew = z.infer<typeof updateCrewSchema>['body'];
export type InviteToCrew = z.infer<typeof inviteToCrewSchema>['body'];
export type KickMember = z.infer<typeof kickMemberSchema>['body'];
export type ChangeMemberRank = z.infer<typeof changeMemberRankSchema>['body'];
export type CrewBankDeposit = z.infer<typeof crewBankDepositSchema>['body'];
export type CrewBankWithdraw = z.infer<typeof crewBankWithdrawSchema>['body'];
export type SearchCrews = z.infer<typeof searchCrewsSchema>['query'];
