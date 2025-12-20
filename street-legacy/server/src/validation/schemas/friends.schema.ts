/**
 * Friends/Social Validation Schemas
 */

import { z } from 'zod';
import { idSchema, usernameSchema, shortTextSchema, paginationSchema } from './common.schema.js';

// Add friend by username
export const addFriendSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username required').max(30)
  })
});

// Accept/decline friend request
export const friendRequestActionSchema = z.object({
  body: z.object({
    requestId: idSchema
  })
});

// Remove friend
export const removeFriendSchema = z.object({
  body: z.object({
    friendId: idSchema
  })
});

// Block player
export const blockPlayerSchema = z.object({
  body: z.object({
    playerId: idSchema,
    reason: shortTextSchema.optional()
  })
});

// Unblock player
export const unblockPlayerSchema = z.object({
  body: z.object({
    playerId: idSchema
  })
});

// Search players
export const searchPlayersSchema = z.object({
  query: z.object({
    search: z.string().min(1).max(30),
    ...paginationSchema.shape
  })
});

export type AddFriend = z.infer<typeof addFriendSchema>['body'];
export type FriendRequestAction = z.infer<typeof friendRequestActionSchema>['body'];
export type RemoveFriend = z.infer<typeof removeFriendSchema>['body'];
export type BlockPlayer = z.infer<typeof blockPlayerSchema>['body'];
export type SearchPlayers = z.infer<typeof searchPlayersSchema>['query'];
