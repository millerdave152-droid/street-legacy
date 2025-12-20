/**
 * Chat Validation Schemas
 */

import { z } from 'zod';
import { idSchema, chatMessageSchema, paginationSchema } from './common.schema.js';

// Chat channels
export const chatChannelSchema = z.enum([
  'global',
  'district',
  'crew',
  'trade',
  'help'
], { message: 'Invalid chat channel' });

// Send chat message
export const sendMessageSchema = z.object({
  body: z.object({
    message: chatMessageSchema,
    channel: chatChannelSchema.default('global')
  })
});

// Send private message
export const sendPrivateMessageSchema = z.object({
  body: z.object({
    recipientId: idSchema,
    message: chatMessageSchema
  })
});

// Get chat history
export const getChatHistorySchema = z.object({
  query: z.object({
    channel: chatChannelSchema.default('global'),
    before: idSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
});

// Get private messages
export const getPrivateMessagesSchema = z.object({
  params: z.object({
    recipientId: idSchema
  }),
  query: z.object({
    before: idSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
});

// Report message
export const reportMessageSchema = z.object({
  body: z.object({
    messageId: idSchema,
    reason: z.enum([
      'spam',
      'harassment',
      'hate_speech',
      'inappropriate',
      'scam',
      'other'
    ]),
    details: z.string().max(500).optional()
  })
});

export type ChatChannel = z.infer<typeof chatChannelSchema>;
export type SendMessage = z.infer<typeof sendMessageSchema>['body'];
export type SendPrivateMessage = z.infer<typeof sendPrivateMessageSchema>['body'];
export type GetChatHistory = z.infer<typeof getChatHistorySchema>['query'];
export type ReportMessage = z.infer<typeof reportMessageSchema>['body'];
