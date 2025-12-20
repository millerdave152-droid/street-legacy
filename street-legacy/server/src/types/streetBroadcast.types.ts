/**
 * Street Broadcast System Types
 * Dynamic news generation about player events
 */

// =============================================================================
// ENUMS / UNION TYPES
// =============================================================================

/**
 * Types of news articles
 * - breaking: Immediate high-impact news
 * - rumor: Unverified player gossip
 * - weekly_recap: District weekly summary
 * - district_update: District-specific news
 * - player_spotlight: Featured player story
 */
export type NewsType =
  | 'breaking'
  | 'rumor'
  | 'weekly_recap'
  | 'district_update'
  | 'player_spotlight';

/**
 * Categories for organizing news content
 */
export type NewsCategory =
  | 'crime'
  | 'business'
  | 'territory'
  | 'crew'
  | 'politics'
  | 'general';

/**
 * Types of news subscriptions players can have
 */
export type SubscriptionType =
  | 'district'
  | 'crew'
  | 'player'
  | 'category';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * A street news article displayed in player feeds
 */
export interface StreetNews {
  /** Unique identifier */
  id: string;

  /** News headline (max 200 chars) */
  headline: string;

  /** Full news body text */
  body: string;

  /** Type of news article */
  newsType: NewsType;

  /** Content category */
  category: NewsCategory;

  /** Impact/importance level (1-10) */
  significance: number;

  /** District where the news originated */
  districtId?: number;

  /** Human-readable district name (from join) */
  districtName?: string;

  /** Players mentioned in this news */
  relatedPlayerIds: number[];

  /** Player usernames (from join) */
  relatedPlayerNames?: string[];

  /** Crews mentioned in this news */
  relatedCrewIds: number[];

  /** Crew names (from join) */
  relatedCrewNames?: string[];

  /** Reference to triggering event if any */
  sourceEventId?: string;

  /** Whether to hide player names in public feed */
  isAnonymous: boolean;

  /** Number of times this news was viewed */
  viewCount: number;

  /** When this news expires (null = never) */
  expiresAt?: Date;

  /** When the news was published */
  publishedAt: Date;

  /** When the record was created */
  createdAt: Date;

  /** Whether current player has read this (player-specific) */
  isRead?: boolean;

  /** Calculated relevance score (player-specific) */
  relevanceScore?: number;
}

/**
 * Record of a player reading a news article
 */
export interface PlayerNewsRead {
  /** Unique identifier */
  id: string;

  /** Player who read the news */
  playerId: number;

  /** News article that was read */
  newsId: string;

  /** When the player read it */
  readAt: Date;
}

/**
 * A player's subscription to specific news sources
 */
export interface NewsSubscription {
  /** Unique identifier */
  id: string;

  /** Player who subscribed */
  playerId: number;

  /** Type of subscription */
  subscriptionType: SubscriptionType;

  /** ID of subscribed entity or category name */
  targetId: string;

  /** Human-readable name (from join) */
  targetName?: string;

  /** When subscription was created */
  createdAt: Date;
}

/**
 * Template for generating news from events
 */
export interface NewsTemplate {
  /** Template identifier (e.g., 'crime_heist_success') */
  id: string;

  /** Type of news this template generates */
  newsType: NewsType;

  /** Category of news this template generates */
  category: NewsCategory;

  /** Headline with placeholders: {player}, {district}, etc */
  headlineTemplate: string;

  /** Body text with placeholders */
  bodyTemplate: string;

  /** Minimum event significance to use this template */
  minSignificance: number;

  /** When template was created */
  createdAt: Date;
}

// =============================================================================
// DATABASE ROW TYPES (snake_case)
// =============================================================================

/**
 * Database row for street_news table
 */
export interface StreetNewsRow {
  id: string;
  headline: string;
  body: string;
  news_type: NewsType;
  category: NewsCategory;
  significance: number;
  district_id: number | null;
  district_name?: string;
  related_player_ids: number[];
  related_player_names?: string[];
  related_crew_ids: number[];
  related_crew_names?: string[];
  source_event_id: string | null;
  is_anonymous: boolean;
  view_count: number;
  expires_at: string | null;
  published_at: string;
  created_at: string;
  is_read?: boolean;
  relevance_score?: number;
}

/**
 * Database row for player_news_reads table
 */
export interface PlayerNewsReadRow {
  id: string;
  player_id: number;
  news_id: string;
  read_at: string;
}

/**
 * Database row for player_news_subscriptions table
 */
export interface NewsSubscriptionRow {
  id: string;
  player_id: number;
  subscription_type: SubscriptionType;
  target_id: string;
  target_name?: string;
  created_at: string;
}

/**
 * Database row for news_templates table
 */
export interface NewsTemplateRow {
  id: string;
  news_type: NewsType;
  category: NewsCategory;
  headline_template: string;
  body_template: string;
  min_significance: number;
  created_at: string;
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Request to create a news article
 */
export interface CreateNewsRequest {
  /** Type of news */
  newsType: NewsType;

  /** Content category */
  category: NewsCategory;

  /** News headline */
  headline: string;

  /** Full news body */
  body: string;

  /** District where news occurred */
  districtId?: number;

  /** Players to mention */
  relatedPlayerIds?: number[];

  /** Crews to mention */
  relatedCrewIds?: number[];

  /** Impact level (1-10, default 5) */
  significance?: number;

  /** Hours until expiration (null = never) */
  expiresHours?: number | null;

  /** Hide player names */
  isAnonymous?: boolean;

  /** Reference to triggering event */
  sourceEventId?: string;
}

/**
 * Request to subscribe to news
 */
export interface SubscribeRequest {
  /** Type of subscription */
  subscriptionType: SubscriptionType;

  /** ID of entity to subscribe to */
  targetId: string;
}

/**
 * Request to unsubscribe from news
 */
export interface UnsubscribeRequest {
  /** Subscription ID to remove */
  subscriptionId: string;
}

/**
 * Request to generate news from a game event
 */
export interface GenerateNewsFromEventRequest {
  /** Type of game event */
  eventType: string;

  /** Player who performed the action */
  playerId: number;

  /** District where event occurred */
  districtId: number;

  /** Additional event data for template variables */
  metadata: Record<string, unknown>;

  /** Optional target player (for PvP events) */
  targetPlayerId?: number;

  /** Optional crew involved */
  crewId?: number;
}

/**
 * Query parameters for getting news feed
 */
export interface GetNewsFeedParams {
  /** Maximum number of articles */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Include already-read articles */
  includeRead?: boolean;

  /** Filter by category */
  category?: NewsCategory;

  /** Filter by district */
  districtId?: number;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Response for getting news feed
 */
export interface GetNewsFeedResponse {
  success: boolean;
  data: {
    /** News articles for player's feed */
    news: StreetNews[];

    /** Total unread count */
    unreadCount: number;

    /** Whether more articles exist */
    hasMore: boolean;
  };
}

/**
 * Response for getting a single news article
 */
export interface GetNewsArticleResponse {
  success: boolean;
  data: StreetNews;
}

/**
 * Response for creating news
 */
export interface CreateNewsResponse {
  success: boolean;
  data: {
    newsId: string;
    headline: string;
  };
}

/**
 * Response for marking news as read
 */
export interface MarkReadResponse {
  success: boolean;
  data: {
    newsId: string;
    readAt: Date;
  };
}

/**
 * Response for getting subscriptions
 */
export interface GetSubscriptionsResponse {
  success: boolean;
  data: {
    subscriptions: NewsSubscription[];
    total: number;
  };
}

/**
 * Response for subscribing
 */
export interface SubscribeResponse {
  success: boolean;
  data: {
    subscriptionId: string;
    subscriptionType: SubscriptionType;
    targetId: string;
  };
}

/**
 * Response for generating district recap
 */
export interface GenerateRecapResponse {
  success: boolean;
  data: {
    newsId: string;
    districtId: number;
    districtName: string;
  };
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

/**
 * Variables available for news template substitution
 */
export interface TemplateVariables {
  /** Player username */
  player?: string;

  /** District name */
  district?: string;

  /** Crew name */
  crew?: string;

  /** Numeric amount (money, damage, etc) */
  amount?: number;

  /** Target player/entity name */
  target?: string;

  /** Property/business name */
  property?: string;

  /** Faction name */
  faction?: string;

  /** Event description */
  event?: string;

  /** Allow additional custom variables */
  [key: string]: string | number | undefined;
}

/**
 * Result of template processing
 */
export interface ProcessedTemplate {
  headline: string;
  body: string;
  missingVariables: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default expiry hours for each news type
 * null means the news never expires
 */
export const NEWS_EXPIRY_HOURS: Record<NewsType, number | null> = {
  breaking: 48,           // 2 days
  rumor: 168,             // 1 week
  district_update: 72,    // 3 days
  player_spotlight: null, // Never expires
  weekly_recap: 168       // 1 week (until next recap)
};

/**
 * Default significance levels for news types
 */
export const DEFAULT_SIGNIFICANCE: Record<NewsType, number> = {
  breaking: 8,
  rumor: 4,
  district_update: 5,
  player_spotlight: 7,
  weekly_recap: 6
};

/**
 * Human-readable labels for news types
 */
export const NEWS_TYPE_LABELS: Record<NewsType, string> = {
  breaking: 'Breaking News',
  rumor: 'Street Rumor',
  district_update: 'District Update',
  player_spotlight: 'Player Spotlight',
  weekly_recap: 'Weekly Recap'
};

/**
 * Human-readable labels for news categories
 */
export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  crime: 'Crime',
  business: 'Business',
  territory: 'Territory',
  crew: 'Crew Activity',
  politics: 'Politics',
  general: 'General'
};

/**
 * Icons/emojis for news categories (for UI display)
 */
export const NEWS_CATEGORY_ICONS: Record<NewsCategory, string> = {
  crime: '🔫',
  business: '💰',
  territory: '🏴',
  crew: '👥',
  politics: '🏛️',
  general: '📰'
};

/**
 * Maximum news articles per feed request
 */
export const MAX_FEED_LIMIT = 50;

/**
 * Default feed limit if not specified
 */
export const DEFAULT_FEED_LIMIT = 20;

/**
 * Maximum subscriptions per player
 */
export const MAX_SUBSCRIPTIONS_PER_PLAYER = 20;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to StreetNews interface
 */
export function rowToStreetNews(row: StreetNewsRow): StreetNews {
  return {
    id: row.id,
    headline: row.headline,
    body: row.body,
    newsType: row.news_type,
    category: row.category,
    significance: row.significance,
    districtId: row.district_id ?? undefined,
    districtName: row.district_name,
    relatedPlayerIds: row.related_player_ids || [],
    relatedPlayerNames: row.related_player_names,
    relatedCrewIds: row.related_crew_ids || [],
    relatedCrewNames: row.related_crew_names,
    sourceEventId: row.source_event_id ?? undefined,
    isAnonymous: row.is_anonymous,
    viewCount: row.view_count,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    publishedAt: new Date(row.published_at),
    createdAt: new Date(row.created_at),
    isRead: row.is_read,
    relevanceScore: row.relevance_score
  };
}

/**
 * Convert database row to PlayerNewsRead interface
 */
export function rowToPlayerNewsRead(row: PlayerNewsReadRow): PlayerNewsRead {
  return {
    id: row.id,
    playerId: row.player_id,
    newsId: row.news_id,
    readAt: new Date(row.read_at)
  };
}

/**
 * Convert database row to NewsSubscription interface
 */
export function rowToNewsSubscription(row: NewsSubscriptionRow): NewsSubscription {
  return {
    id: row.id,
    playerId: row.player_id,
    subscriptionType: row.subscription_type,
    targetId: row.target_id,
    targetName: row.target_name,
    createdAt: new Date(row.created_at)
  };
}

/**
 * Convert database row to NewsTemplate interface
 */
export function rowToNewsTemplate(row: NewsTemplateRow): NewsTemplate {
  return {
    id: row.id,
    newsType: row.news_type,
    category: row.category,
    headlineTemplate: row.headline_template,
    bodyTemplate: row.body_template,
    minSignificance: row.min_significance,
    createdAt: new Date(row.created_at)
  };
}

/**
 * Process a template string with variables
 * Replaces {variable} placeholders with values
 */
export function processTemplate(
  template: string,
  variables: TemplateVariables
): { result: string; missing: string[] } {
  const missing: string[] = [];

  const result = template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) {
      missing.push(key);
      return match; // Keep placeholder if no value
    }
    return String(value);
  });

  return { result, missing };
}

/**
 * Check if a news article has expired
 */
export function isNewsExpired(news: StreetNews): boolean {
  if (!news.expiresAt) return false;
  return new Date() > news.expiresAt;
}

/**
 * Get time remaining until news expires (in hours)
 */
export function getExpiryTimeRemaining(news: StreetNews): number | null {
  if (!news.expiresAt) return null;
  const remaining = news.expiresAt.getTime() - Date.now();
  return Math.max(0, remaining / (1000 * 60 * 60));
}

/**
 * Calculate default expiry date for a news type
 */
export function getDefaultExpiryDate(newsType: NewsType): Date | null {
  const hours = NEWS_EXPIRY_HOURS[newsType];
  if (hours === null) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
