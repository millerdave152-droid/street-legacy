/**
 * Validation Schemas Index
 *
 * Central export point for all validation schemas.
 */

// Common schemas and types
export * from './common.schema.js';

// Auth schemas
export * from './auth.schema.js';

// Game/crime schemas
export * from './game.schema.js';

// Banking schemas
export * from './banking.schema.js';

// Property schemas
export * from './property.schema.js';

// Social schemas (crew, friends, chat, trading)
export * from './social.schema.js';

// Extended validation schemas (only export non-conflicting items)
export { heistDifficultySchema, startHeistSchema, heistActionSchema, heistCheckpointSchema, abortHeistSchema, splitLootSchema } from './heists.schema.js';
export { claimMissionSchema, updateMissionProgressSchema } from './missions.schema.js';
export { tradeActionSchema, createTradeSchema } from './trading.schema.js';
export { chatChannelSchema, sendPrivateMessageSchema, getChatHistorySchema, getPrivateMessagesSchema, reportMessageSchema } from './chat.schema.js';
export { crewTagSchema, crewNameSchema, updateCrewSchema, crewInviteActionSchema, kickMemberSchema, changeMemberRankSchema, searchCrewsSchema, crewMessageSchema } from './crews.schema.js';
export { addFriendSchema, friendRequestActionSchema, blockPlayerSchema, unblockPlayerSchema, searchPlayersSchema } from './friends.schema.js';
export { itemCategorySchema, itemRaritySchema, getInventorySchema, useItemSchema, dropItemSchema, transferItemSchema, buyItemSchema, sellItemSchema } from './inventory.schema.js';
export { revengeAttackSchema, useCombatItemSchema, fleeCombatSchema, cancelBountySchema, attackTypeSchema } from './pvp.schema.js';
export { territoryActionSchema, captureTerritorySchema, defendTerritorySchema, upgradeTerritorySchema, setPropertyRentSchema, evictTenantSchema, startPropertyOperationSchema, raidPropertySchema } from './territory.schema.js';
