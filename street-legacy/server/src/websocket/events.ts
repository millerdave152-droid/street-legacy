/**
 * WebSocket Event Types
 *
 * Comprehensive type definitions for all real-time game events
 */

// ============================================================================
// Base Event Types
// ============================================================================

export type WSEventType =
  // Connection events
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'ping'
  | 'pong'

  // Chat events
  | 'chat'
  | 'chat:message'
  | 'chat:message_deleted'
  | 'chat:history'
  | 'chat:typing'
  | 'chat:subscribe'
  | 'chat:unsubscribe'
  | 'chat:subscribed'
  | 'chat:unsubscribed'

  // Game action events
  | 'game:crime_result'
  | 'game:cooldown_ready'
  | 'game:level_up'
  | 'game:achievement'
  | 'game:stat_update'

  // Economy events
  | 'economy:transaction'
  | 'economy:transfer_received'
  | 'economy:property_income'
  | 'economy:business_income'

  // Combat/PvP events
  | 'pvp:attack_received'
  | 'pvp:attack_result'
  | 'pvp:bounty_placed'
  | 'pvp:bounty_claimed'
  | 'pvp:jail_released'

  // Territory events
  | 'territory:control_changed'
  | 'territory:war_started'
  | 'territory:war_ended'
  | 'territory:contribution'

  // Crew events
  | 'crew:member_joined'
  | 'crew:member_left'
  | 'crew:member_online'
  | 'crew:member_offline'
  | 'crew:rank_changed'
  | 'crew:announcement'
  | 'crew:war_declared'

  // Social events
  | 'social:friend_request'
  | 'social:friend_accepted'
  | 'social:friend_online'
  | 'social:friend_offline'

  // Trading events
  | 'trade:request_received'
  | 'trade:request_cancelled'
  | 'trade:accepted'
  | 'trade:rejected'
  | 'trade:completed'
  | 'trade:expired'

  // Heist events
  | 'heist:started'
  | 'heist:player_joined'
  | 'heist:player_left'
  | 'heist:ready'
  | 'heist:executed'
  | 'heist:cancelled'
  | 'heist:room_created'
  | 'heist:room_state_sync'
  | 'heist:member_ready'
  | 'heist:role_selected'
  | 'heist:countdown_started'
  | 'heist:result'

  // World state events
  | 'world:district_heat_update'
  | 'world:market_prices'
  | 'world:event_started'
  | 'world:event_ended'
  | 'world:news'
  | 'world:leaderboard_change'

  // District events
  | 'district:heat_changed'
  | 'district:player_entered'
  | 'district:player_left'
  | 'district:event_active'

  // Crew heist events
  | 'crew:heist_completed'

  // Notification events
  | 'notification'
  | 'notification:system'
  | 'notification:alert'

  // Presence events
  | 'presence:online_count'
  | 'presence:district_players'

  // Narrative events
  | 'narrative:witness_opportunity'
  | 'narrative:news_breaking'
  | 'narrative:debt_called_in'
  | 'narrative:debt_transferred'
  | 'narrative:chapter_transition'
  | 'narrative:district_status_change'
  | 'narrative:testimonial_received'
  | 'narrative:succession_triggered'
  | 'narrative:reputation_shift'
  | 'narrative:legacy_milestone';

// ============================================================================
// Event Payloads
// ============================================================================

export interface BaseWSEvent {
  type: WSEventType;
  timestamp: number;
}

// Connection events
export interface ConnectedEvent extends BaseWSEvent {
  type: 'connected';
  userId: number;
  username: string;
  onlineCount: number;
}

export interface ErrorEvent extends BaseWSEvent {
  type: 'error';
  code: string;
  message: string;
}

// Chat events
export interface ChatMessage {
  id: number;
  message: string;
  createdAt: string;
  player: {
    id: number;
    username: string;
    level: number;
    crewTag?: string;
  };
}

export interface ChatEvent extends BaseWSEvent {
  type: 'chat';
  channel: string;
  message: ChatMessage;
}

export interface ChatHistoryEvent extends BaseWSEvent {
  type: 'chat:history';
  channel: string;
  messages: ChatMessage[];
}

export interface ChatTypingEvent extends BaseWSEvent {
  type: 'chat:typing';
  channel: string;
  userId: number;
  username: string;
}

export interface ChatMessageEvent extends BaseWSEvent {
  type: 'chat:message';
  id: number;
  message: string;
  createdAt: string;
  replyToId: number | null;
  channel: string;
  player: {
    id: number;
    username: string;
    level: number;
    prestigeLevel?: number;
    crewTag?: string;
  };
}

export interface ChatMessageDeletedEvent extends BaseWSEvent {
  type: 'chat:message_deleted';
  messageId: number;
}

// Game action events
export interface CrimeResultEvent extends BaseWSEvent {
  type: 'game:crime_result';
  crimeId: number;
  crimeName: string;
  success: boolean;
  payout?: number;
  xpGained?: number;
  heatGain?: number;
  jailed?: boolean;
  jailTime?: number;
  cooldownEnds: number;
}

export interface CooldownReadyEvent extends BaseWSEvent {
  type: 'game:cooldown_ready';
  action: 'crime' | 'attack' | 'heal' | 'travel';
  actionId?: number;
}

export interface LevelUpEvent extends BaseWSEvent {
  type: 'game:level_up';
  oldLevel: number;
  newLevel: number;
  rewards: {
    cash?: number;
    statPoints?: number;
    unlocks?: string[];
  };
}

export interface AchievementEvent extends BaseWSEvent {
  type: 'game:achievement';
  achievementId: number;
  name: string;
  description: string;
  reward?: {
    cash?: number;
    xp?: number;
    item?: string;
  };
}

export interface StatUpdateEvent extends BaseWSEvent {
  type: 'game:stat_update';
  stats: {
    cash?: number;
    bank?: number;
    xp?: number;
    energy?: number;
    nerve?: number;
    health?: number;
    heatLevel?: number;
  };
}

// Economy events
export interface TransactionEvent extends BaseWSEvent {
  type: 'economy:transaction';
  transactionType: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'purchase' | 'sale';
  amount: number;
  balance: {
    cash: number;
    bank: number;
  };
  description?: string;
}

export interface TransferReceivedEvent extends BaseWSEvent {
  type: 'economy:transfer_received';
  fromPlayer: {
    id: number;
    username: string;
  };
  amount: number;
  note?: string;
  newBankBalance: number;
}

export interface PropertyIncomeEvent extends BaseWSEvent {
  type: 'economy:property_income';
  propertyId: number;
  propertyName: string;
  income: number;
  totalProperties: number;
}

export interface BusinessIncomeEvent extends BaseWSEvent {
  type: 'economy:business_income';
  businessId: number;
  businessName: string;
  income: number;
  totalBusinesses: number;
}

// PvP events
export interface AttackReceivedEvent extends BaseWSEvent {
  type: 'pvp:attack_received';
  attacker: {
    id: number;
    username: string;
    level: number;
    crewTag?: string;
  };
  damage: number;
  healthRemaining: number;
  cashLost?: number;
}

export interface AttackResultEvent extends BaseWSEvent {
  type: 'pvp:attack_result';
  target: {
    id: number;
    username: string;
    level: number;
  };
  success: boolean;
  damage?: number;
  loot?: number;
  xpGained?: number;
  targetHealth: number;
}

export interface BountyPlacedEvent extends BaseWSEvent {
  type: 'pvp:bounty_placed';
  targetId: number;
  targetUsername: string;
  amount: number;
  placedBy?: string; // Hidden if anonymous
  totalBounty: number;
}

export interface BountyClaimedEvent extends BaseWSEvent {
  type: 'pvp:bounty_claimed';
  targetId: number;
  targetUsername: string;
  claimedBy: {
    id: number;
    username: string;
  };
  amount: number;
}

export interface JailReleasedEvent extends BaseWSEvent {
  type: 'pvp:jail_released';
  method: 'time_served' | 'bail' | 'bribed' | 'escaped';
}

// Territory events
export interface TerritoryControlChangedEvent extends BaseWSEvent {
  type: 'territory:control_changed';
  districtId: number;
  districtName: string;
  newController?: {
    crewId: number;
    crewName: string;
    crewTag: string;
  };
  previousController?: {
    crewId: number;
    crewName: string;
    crewTag: string;
  };
}

export interface TerritoryWarStartedEvent extends BaseWSEvent {
  type: 'territory:war_started';
  warId: number;
  districtId: number;
  districtName: string;
  attackingCrew: {
    id: number;
    name: string;
    tag: string;
  };
  defendingCrew: {
    id: number;
    name: string;
    tag: string;
  };
  endsAt: number;
}

export interface TerritoryWarEndedEvent extends BaseWSEvent {
  type: 'territory:war_ended';
  warId: number;
  districtId: number;
  districtName: string;
  winner: {
    crewId: number;
    crewName: string;
    crewTag: string;
  };
}

export interface TerritoryContributionEvent extends BaseWSEvent {
  type: 'territory:contribution';
  districtId: number;
  districtName: string;
  crewId: number;
  crimeCount: number;
  currentLeader?: {
    crewId: number;
    crewName: string;
    crimeCount: number;
  };
}

// Crew events
export interface CrewMemberJoinedEvent extends BaseWSEvent {
  type: 'crew:member_joined';
  crewId: number;
  member: {
    id: number;
    username: string;
    level: number;
  };
}

export interface CrewMemberLeftEvent extends BaseWSEvent {
  type: 'crew:member_left';
  crewId: number;
  member: {
    id: number;
    username: string;
  };
  reason: 'left' | 'kicked' | 'banned';
}

export interface CrewMemberOnlineEvent extends BaseWSEvent {
  type: 'crew:member_online';
  crewId: number;
  member: {
    id: number;
    username: string;
  };
  onlineCount: number;
}

export interface CrewMemberOfflineEvent extends BaseWSEvent {
  type: 'crew:member_offline';
  crewId: number;
  member: {
    id: number;
    username: string;
  };
  onlineCount: number;
}

export interface CrewRankChangedEvent extends BaseWSEvent {
  type: 'crew:rank_changed';
  crewId: number;
  member: {
    id: number;
    username: string;
  };
  oldRank: string;
  newRank: string;
}

export interface CrewAnnouncementEvent extends BaseWSEvent {
  type: 'crew:announcement';
  crewId: number;
  message: string;
  from: {
    id: number;
    username: string;
    rank: string;
  };
}

// Social events
export interface FriendRequestEvent extends BaseWSEvent {
  type: 'social:friend_request';
  from: {
    id: number;
    username: string;
    level: number;
  };
}

export interface FriendAcceptedEvent extends BaseWSEvent {
  type: 'social:friend_accepted';
  friend: {
    id: number;
    username: string;
    level: number;
  };
}

export interface FriendOnlineEvent extends BaseWSEvent {
  type: 'social:friend_online';
  friend: {
    id: number;
    username: string;
  };
}

export interface FriendOfflineEvent extends BaseWSEvent {
  type: 'social:friend_offline';
  friend: {
    id: number;
    username: string;
  };
}

// Notification events
export interface NotificationEvent extends BaseWSEvent {
  type: 'notification';
  id?: number;
  category: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  link?: string;
  persistent?: boolean;
}

export interface SystemNotificationEvent extends BaseWSEvent {
  type: 'notification:system';
  message: string;
  level: 'info' | 'warning' | 'critical';
}

// Presence events
export interface OnlineCountEvent extends BaseWSEvent {
  type: 'presence:online_count';
  count: number;
  byDistrict?: Record<number, number>;
}

export interface DistrictPlayersEvent extends BaseWSEvent {
  type: 'presence:district_players';
  districtId: number;
  players: Array<{
    id: number;
    username: string;
    level: number;
    crewTag?: string;
  }>;
}

// World state events
export interface WorldDistrictHeatUpdateEvent extends BaseWSEvent {
  type: 'world:district_heat_update';
  districts: Array<{
    id: number;
    name: string;
    heat: number;
    trend: 'rising' | 'falling' | 'stable';
  }>;
}

export interface WorldMarketPricesEvent extends BaseWSEvent {
  type: 'world:market_prices';
  goods: Array<{
    id: string;
    name: string;
    buyPrice: number;
    sellPrice: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export interface WorldEventStartedEvent extends BaseWSEvent {
  type: 'world:event_started';
  eventId: string;
  eventType: string;
  districtId?: number;
  districtName?: string;
  duration: number;
  description: string;
}

export interface WorldEventEndedEvent extends BaseWSEvent {
  type: 'world:event_ended';
  eventId: string;
  results?: {
    participants: number;
    rewards?: string;
  };
}

export interface WorldNewsEvent extends BaseWSEvent {
  type: 'world:news';
  headline: string;
  category: 'crime' | 'economy' | 'politics' | 'social';
  significance: number;
  districtId?: number;
}

export interface WorldLeaderboardChangeEvent extends BaseWSEvent {
  type: 'world:leaderboard_change';
  category: 'wealth' | 'level' | 'reputation';
  top: Array<{
    rank: number;
    playerId: number;
    username: string;
    value: number;
  }>;
}

// District events
export interface DistrictHeatChangedEvent extends BaseWSEvent {
  type: 'district:heat_changed';
  heat: number;
  delta: number;
  cause: 'criminal_activity' | 'police_raid' | 'time_decay';
}

export interface DistrictPlayerEnteredEvent extends BaseWSEvent {
  type: 'district:player_entered';
  username: string;
}

export interface DistrictPlayerLeftEvent extends BaseWSEvent {
  type: 'district:player_left';
  username: string;
}

export interface DistrictEventActiveEvent extends BaseWSEvent {
  type: 'district:event_active';
  event: {
    id: string;
    type: string;
    endsAt: number;
    description: string;
  };
}

// Crew heist events
export interface CrewHeistCompletedEvent extends BaseWSEvent {
  type: 'crew:heist_completed';
  heistId: string;
  success: boolean;
  payout?: number;
}

// Heist room events
export interface HeistRoomCreatedEvent extends BaseWSEvent {
  type: 'heist:room_created';
  roomId: string;
  heistId: string;
  leaderId: number;
  leaderName: string;
}

export interface HeistRoomStateSyncEvent extends BaseWSEvent {
  type: 'heist:room_state_sync';
  roomId: string;
  state: 'waiting' | 'ready' | 'executing' | 'completed';
  members: Array<{
    playerId: number;
    username: string;
    role?: string;
    ready: boolean;
  }>;
}

export interface HeistMemberReadyEvent extends BaseWSEvent {
  type: 'heist:member_ready';
  roomId: string;
  playerId: number;
  username: string;
  ready: boolean;
}

export interface HeistRoleSelectedEvent extends BaseWSEvent {
  type: 'heist:role_selected';
  roomId: string;
  playerId: number;
  username: string;
  role: string;
}

export interface HeistCountdownStartedEvent extends BaseWSEvent {
  type: 'heist:countdown_started';
  roomId: string;
  startsAt: number;
}

export interface HeistResultEvent extends BaseWSEvent {
  type: 'heist:result';
  roomId: string;
  success: boolean;
  payout: number;
  memberPayouts: Array<{
    playerId: number;
    amount: number;
    xpGained: number;
  }>;
}

// ============================================================================
// Client -> Server Message Types
// ============================================================================

export interface ClientChatMessage {
  type: 'chat';
  channel: string;
  message: string;
}

export interface ClientSubscribeMessage {
  type: 'subscribe';
  channel: string;
}

export interface ClientUnsubscribeMessage {
  type: 'unsubscribe';
  channel: string;
}

export interface ClientTypingMessage {
  type: 'typing';
  channel: string;
}

export interface ClientPresenceRequest {
  type: 'presence:request';
  districtId?: number;
}

export type ClientMessage =
  | ClientChatMessage
  | ClientSubscribeMessage
  | ClientUnsubscribeMessage
  | ClientTypingMessage
  | ClientPresenceRequest;

// ============================================================================
// Server -> Client Event Union
// ============================================================================

export type ServerEvent =
  | ConnectedEvent
  | ErrorEvent
  | ChatEvent
  | ChatHistoryEvent
  | ChatTypingEvent
  | ChatMessageEvent
  | ChatMessageDeletedEvent
  | CrimeResultEvent
  | CooldownReadyEvent
  | LevelUpEvent
  | AchievementEvent
  | StatUpdateEvent
  | TransactionEvent
  | TransferReceivedEvent
  | PropertyIncomeEvent
  | BusinessIncomeEvent
  | AttackReceivedEvent
  | AttackResultEvent
  | BountyPlacedEvent
  | BountyClaimedEvent
  | JailReleasedEvent
  | TerritoryControlChangedEvent
  | TerritoryWarStartedEvent
  | TerritoryWarEndedEvent
  | TerritoryContributionEvent
  | CrewMemberJoinedEvent
  | CrewMemberLeftEvent
  | CrewMemberOnlineEvent
  | CrewMemberOfflineEvent
  | CrewRankChangedEvent
  | CrewAnnouncementEvent
  | FriendRequestEvent
  | FriendAcceptedEvent
  | FriendOnlineEvent
  | FriendOfflineEvent
  | NotificationEvent
  | SystemNotificationEvent
  | OnlineCountEvent
  | DistrictPlayersEvent
  // World state events
  | WorldDistrictHeatUpdateEvent
  | WorldMarketPricesEvent
  | WorldEventStartedEvent
  | WorldEventEndedEvent
  | WorldNewsEvent
  | WorldLeaderboardChangeEvent
  // District events
  | DistrictHeatChangedEvent
  | DistrictPlayerEnteredEvent
  | DistrictPlayerLeftEvent
  | DistrictEventActiveEvent
  // Crew heist events
  | CrewHeistCompletedEvent
  // Heist room events
  | HeistRoomCreatedEvent
  | HeistRoomStateSyncEvent
  | HeistMemberReadyEvent
  | HeistRoleSelectedEvent
  | HeistCountdownStartedEvent
  | HeistResultEvent;

// ============================================================================
// Channel Types
// ============================================================================

export type ChatChannel =
  | 'global'
  | 'district'
  | 'crew'
  | 'trade'
  | 'help';

export function isValidChannel(channel: string): channel is ChatChannel {
  return ['global', 'district', 'crew', 'trade', 'help'].includes(channel);
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createEvent<T extends BaseWSEvent>(
  type: T['type'],
  data: Omit<T, 'type' | 'timestamp'>
): T {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as T;
}

export function createNotification(
  category: 'info' | 'success' | 'warning' | 'danger',
  title: string,
  message: string,
  options?: { link?: string; persistent?: boolean }
): NotificationEvent {
  return createEvent<NotificationEvent>('notification', {
    category,
    title,
    message,
    ...options,
  });
}
