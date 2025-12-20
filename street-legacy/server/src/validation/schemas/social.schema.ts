/**
 * Social Validation Schemas
 *
 * Validates crew, friends, chat, and trading operations.
 */

import { z } from 'zod';
import {
  idSchema,
  usernameSchema,
  shortTextSchema,
  chatMessageSchema,
  positiveMoneySchema,
  paginationSchema
} from './common.schema.js';

// ============================================================================
// Crew Schemas
// ============================================================================

/**
 * Create crew validation
 */
export const createCrewSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Crew name must be at least 3 characters')
      .max(30, 'Crew name too long')
      .regex(/^[a-zA-Z0-9_ ]+$/, 'Crew name can only contain letters, numbers, underscores, and spaces')
      .transform(val => val.trim()),
    tag: z.string()
      .min(2, 'Crew tag must be at least 2 characters')
      .max(5, 'Crew tag must be at most 5 characters')
      .regex(/^[A-Z0-9]+$/, 'Crew tag must be uppercase letters and numbers only')
      .toUpperCase()
  })
});

export type CreateCrewInput = z.infer<typeof createCrewSchema>['body'];

/**
 * Join crew validation
 */
export const joinCrewSchema = z.object({
  params: z.object({
    crewId: idSchema
  })
});

/**
 * Invite to crew validation
 */
export const inviteToCrewSchema = z.object({
  body: z.object({
    playerId: idSchema.optional(),
    username: usernameSchema.optional()
  }).refine(
    (data) => data.playerId !== undefined || data.username !== undefined,
    {
      message: 'Either playerId or username is required',
      path: ['playerId']
    }
  )
});

export type InviteToCrewInput = z.infer<typeof inviteToCrewSchema>['body'];

/**
 * Kick from crew validation
 */
export const kickFromCrewSchema = z.object({
  body: z.object({
    playerId: idSchema
  })
});

export type KickFromCrewInput = z.infer<typeof kickFromCrewSchema>['body'];

/**
 * Update crew settings validation
 */
export const updateCrewSettingsSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_ ]+$/)
      .optional(),
    description: z.string()
      .max(500, 'Description too long')
      .transform(val => val.replace(/[<>]/g, '').trim())
      .optional(),
    isRecruiting: z.boolean().optional(),
    minLevelToJoin: z.coerce.number().int().min(1).max(50).optional()
  })
});

export type UpdateCrewSettingsInput = z.infer<typeof updateCrewSettingsSchema>['body'];

/**
 * Crew bank deposit validation
 */
export const crewBankDepositSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema
  })
});

export type CrewBankDepositInput = z.infer<typeof crewBankDepositSchema>['body'];

/**
 * Crew bank withdrawal validation (leader only)
 */
export const crewBankWithdrawSchema = z.object({
  body: z.object({
    amount: positiveMoneySchema,
    reason: z.string()
      .max(200)
      .transform(val => val.replace(/[<>'"`;]/g, '').trim())
      .optional()
  })
});

export type CrewBankWithdrawInput = z.infer<typeof crewBankWithdrawSchema>['body'];

// ============================================================================
// Friends Schemas
// ============================================================================

/**
 * Send friend request validation
 */
export const sendFriendRequestSchema = z.object({
  body: z.object({
    playerId: idSchema.optional(),
    username: usernameSchema.optional()
  }).refine(
    (data) => data.playerId !== undefined || data.username !== undefined,
    {
      message: 'Either playerId or username is required',
      path: ['playerId']
    }
  )
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>['body'];

/**
 * Respond to friend request validation
 */
export const respondFriendRequestSchema = z.object({
  params: z.object({
    requestId: idSchema
  }),
  body: z.object({
    accept: z.boolean()
  })
});

/**
 * Remove friend validation
 */
export const removeFriendSchema = z.object({
  params: z.object({
    friendId: idSchema
  })
});

// ============================================================================
// Chat Schemas
// ============================================================================

/**
 * Send chat message validation
 */
export const sendMessageSchema = z.object({
  body: z.object({
    message: chatMessageSchema,
    channel: z.enum(['district', 'crew', 'global', 'private']).default('district'),
    recipientId: idSchema.optional() // Required if channel is 'private'
  }).refine(
    (data) => data.channel !== 'private' || data.recipientId !== undefined,
    {
      message: 'Recipient ID required for private messages',
      path: ['recipientId']
    }
  )
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>['body'];

/**
 * Get chat messages query parameters
 */
export const getChatMessagesSchema = z.object({
  query: z.object({
    channel: z.enum(['district', 'crew', 'global', 'private']).default('district'),
    before: z.coerce.number().int().positive().optional(), // Message ID for pagination
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
});

export type GetChatMessagesQuery = z.infer<typeof getChatMessagesSchema>['query'];

// ============================================================================
// Trading Schemas
// ============================================================================

/**
 * Create trade offer validation
 */
export const createTradeOfferSchema = z.object({
  body: z.object({
    targetPlayerId: idSchema,
    offeredItems: z.array(idSchema).max(10, 'Maximum 10 items per trade'),
    offeredCash: z.coerce.number().nonnegative().default(0),
    requestedItems: z.array(idSchema).max(10, 'Maximum 10 items per trade'),
    requestedCash: z.coerce.number().nonnegative().default(0),
    message: z.string()
      .max(200)
      .transform(val => val.replace(/[<>'"`;]/g, '').trim())
      .optional()
  }).refine(
    (data) => data.offeredItems.length > 0 || data.offeredCash > 0 ||
              data.requestedItems.length > 0 || data.requestedCash > 0,
    {
      message: 'Trade must include items or cash',
      path: ['offeredItems']
    }
  )
});

export type CreateTradeOfferInput = z.infer<typeof createTradeOfferSchema>['body'];

/**
 * Respond to trade offer validation
 */
export const respondTradeOfferSchema = z.object({
  params: z.object({
    tradeId: idSchema
  }),
  body: z.object({
    accept: z.boolean()
  })
});

/**
 * Counter trade offer validation
 */
export const counterTradeOfferSchema = z.object({
  params: z.object({
    tradeId: idSchema
  }),
  body: z.object({
    offeredItems: z.array(idSchema).max(10),
    offeredCash: z.coerce.number().nonnegative().default(0),
    requestedItems: z.array(idSchema).max(10),
    requestedCash: z.coerce.number().nonnegative().default(0),
    message: z.string()
      .max(200)
      .transform(val => val.replace(/[<>'"`;]/g, '').trim())
      .optional()
  })
});

export type CounterTradeOfferInput = z.infer<typeof counterTradeOfferSchema>['body'];

// ============================================================================
// Leaderboard Schemas
// ============================================================================

/**
 * Get leaderboard query parameters
 */
export const leaderboardSchema = z.object({
  query: z.object({
    type: z.enum([
      'cash',
      'level',
      'crimes',
      'reputation',
      'kills',
      'heists',
      'crew_wealth',
      'crew_territory'
    ]).default('cash'),
    timeframe: z.enum(['daily', 'weekly', 'monthly', 'alltime']).default('alltime'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
});

export type LeaderboardQuery = z.infer<typeof leaderboardSchema>['query'];
