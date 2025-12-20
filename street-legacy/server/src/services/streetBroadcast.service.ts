/**
 * Street Broadcast Service
 * Dynamic news generation about player events
 */

import pool from '../db/connection.js';
import {
  StreetNews,
  StreetNewsRow,
  NewsSubscription,
  NewsSubscriptionRow,
  NewsTemplate,
  NewsTemplateRow,
  NewsType,
  NewsCategory,
  SubscriptionType,
  CreateNewsRequest,
  TemplateVariables,
  NEWS_EXPIRY_HOURS,
  DEFAULT_SIGNIFICANCE,
  rowToStreetNews,
  rowToNewsSubscription,
  rowToNewsTemplate,
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT
} from '../types/streetBroadcast.types.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map database row to StreetNews (with additional fields from joins)
 */
function mapRowToNews(row: StreetNewsRow): StreetNews {
  return rowToStreetNews(row);
}

/**
 * Map database row to NewsSubscription
 */
function mapRowToSubscription(row: NewsSubscriptionRow): NewsSubscription {
  return rowToNewsSubscription(row);
}

/**
 * Get default significance based on event type
 */
function getSignificanceForEvent(eventType: string): number {
  const eventSignificance: Record<string, number> = {
    // High significance events
    'heist_complete': 8,
    'territory_capture': 8,
    'crew_battle': 8,
    'landmark_event': 9,
    'major_deal': 7,

    // Medium significance events
    'pvp_victory': 6,
    'property_purchase': 5,
    'business_opened': 5,
    'faction_mission': 5,
    'crime_committed': 4,

    // Lower significance
    'level_up': 3,
    'crew_joined': 4,
    'achievement': 4
  };

  return eventSignificance[eventType] || 5;
}

/**
 * Get news category based on event type
 */
function getCategoryForEvent(eventType: string): NewsCategory {
  const eventCategories: Record<string, NewsCategory> = {
    'crime_committed': 'crime',
    'heist_complete': 'crime',
    'pvp_victory': 'crime',
    'property_purchase': 'business',
    'business_opened': 'business',
    'major_deal': 'business',
    'territory_capture': 'territory',
    'crew_battle': 'crew',
    'crew_joined': 'crew',
    'faction_mission': 'politics',
    'landmark_event': 'general'
  };

  return eventCategories[eventType] || 'general';
}

/**
 * Fill template placeholders with actual values
 */
export function fillTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return match; // Keep placeholder if no value
    }
    return String(value);
  });
}

// =============================================================================
// CORE NEWS FUNCTIONS
// =============================================================================

/**
 * Create a news article
 */
export async function createNews(params: CreateNewsRequest): Promise<StreetNews | null> {
  const {
    newsType,
    category,
    headline,
    body,
    districtId,
    relatedPlayerIds = [],
    relatedCrewIds = [],
    significance = DEFAULT_SIGNIFICANCE[newsType],
    expiresHours,
    isAnonymous = false,
    sourceEventId
  } = params;

  // Calculate expiration
  const expiryHours = expiresHours !== undefined ? expiresHours : NEWS_EXPIRY_HOURS[newsType];
  const expiresAt = expiryHours ? new Date(Date.now() + expiryHours * 60 * 60 * 1000) : null;

  console.log(`[StreetBroadcast] Creating ${newsType} news: ${headline}`);

  try {
    const result = await pool.query(
      `INSERT INTO street_news (
         headline, body, news_type, category, significance,
         district_id, related_player_ids, related_crew_ids,
         source_event_id, is_anonymous, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        headline,
        body,
        newsType,
        category,
        Math.min(10, Math.max(1, significance)),
        districtId || null,
        relatedPlayerIds,
        relatedCrewIds,
        sourceEventId || null,
        isAnonymous,
        expiresAt
      ]
    );

    if (result.rows.length === 0) {
      console.log(`[StreetBroadcast] Failed to create news`);
      return null;
    }

    console.log(`[StreetBroadcast] Created ${newsType} news: ${headline}`);
    return mapRowToNews(result.rows[0] as StreetNewsRow);
  } catch (error) {
    console.error(`[StreetBroadcast] Error creating news:`, error);
    return null;
  }
}

/**
 * Generate news from a game event using templates
 */
export async function generateNewsFromEvent(
  eventType: string,
  playerId: string,
  districtId: string,
  metadata: Record<string, unknown> = {}
): Promise<StreetNews | null> {
  console.log(`[StreetBroadcast] Generating news from event: ${eventType}`);

  try {
    // Find matching template
    const templateResult = await pool.query(
      `SELECT * FROM news_templates
       WHERE id LIKE $1 || '%'
       ORDER BY min_significance DESC
       LIMIT 1`,
      [eventType]
    );

    let headlineTemplate: string;
    let bodyTemplate: string;
    let newsType: NewsType = 'district_update';
    let category: NewsCategory = getCategoryForEvent(eventType);

    if (templateResult.rows.length > 0) {
      const template = templateResult.rows[0];
      headlineTemplate = template.headline_template;
      bodyTemplate = template.body_template;
      newsType = template.news_type;
      category = template.category;
    } else {
      // Fallback templates
      headlineTemplate = 'Activity in {district}';
      bodyTemplate = '{player} was involved in some activity in {district}.';
    }

    // Get player name
    const playerResult = await pool.query(
      `SELECT username FROM players WHERE id = $1`,
      [playerId]
    );
    const playerName = playerResult.rows[0]?.username || 'Unknown';

    // Get district name
    const districtResult = await pool.query(
      `SELECT name FROM districts WHERE id = $1`,
      [districtId]
    );
    const districtName = districtResult.rows[0]?.name || 'Unknown District';

    // Build template variables
    const variables: TemplateVariables = {
      player: playerName,
      district: districtName,
      ...metadata as Record<string, string | number | undefined>
    };

    // Fill templates
    const headline = fillTemplate(headlineTemplate, variables);
    const body = fillTemplate(bodyTemplate, variables);

    // Determine significance
    const significance = (metadata.severity as number) || getSignificanceForEvent(eventType);

    // Determine news type based on significance
    if (significance >= 8) {
      newsType = 'breaking';
    } else if (significance <= 4) {
      newsType = 'rumor';
    }

    // Create the news
    return await createNews({
      newsType,
      category,
      headline,
      body,
      districtId: parseInt(districtId, 10),
      relatedPlayerIds: [parseInt(playerId, 10)],
      relatedCrewIds: metadata.crewId ? [metadata.crewId as number] : [],
      significance,
      sourceEventId: metadata.eventId as string
    });
  } catch (error) {
    console.error(`[StreetBroadcast] Error generating news from event:`, error);
    return null;
  }
}

// =============================================================================
// FEED FUNCTIONS
// =============================================================================

/**
 * Get personalized news feed for a player
 */
export async function getPlayerFeed(
  playerId: string,
  limit: number = DEFAULT_FEED_LIMIT,
  offset: number = 0,
  includeRead: boolean = false
): Promise<{ news: StreetNews[]; unreadCount: number }> {
  console.log(`[StreetBroadcast] Getting feed for player: ${playerId}`);

  const safeLimit = Math.min(MAX_FEED_LIMIT, Math.max(1, limit));

  try {
    // Get player's current district
    const playerResult = await pool.query(
      `SELECT current_district_id FROM players WHERE id = $1`,
      [playerId]
    );
    const currentDistrict = playerResult.rows[0]?.current_district_id;

    // Get player's subscriptions
    const subscriptionsResult = await pool.query(
      `SELECT subscription_type, target_id FROM player_news_subscriptions WHERE player_id = $1`,
      [playerId]
    );
    const subscriptions = subscriptionsResult.rows;

    // Build subscription filters
    const districtSubs = subscriptions
      .filter(s => s.subscription_type === 'district')
      .map(s => parseInt(s.target_id, 10));
    const categorySubs = subscriptions
      .filter(s => s.subscription_type === 'category')
      .map(s => s.target_id);
    const playerSubs = subscriptions
      .filter(s => s.subscription_type === 'player')
      .map(s => parseInt(s.target_id, 10));
    const crewSubs = subscriptions
      .filter(s => s.subscription_type === 'crew')
      .map(s => parseInt(s.target_id, 10));

    // Query news with read status
    const newsResult = await pool.query(
      `SELECT
         sn.*,
         d.name as district_name,
         pnr.id IS NOT NULL as is_read,
         (
           sn.significance +
           CASE WHEN sn.district_id = $2 THEN 3 ELSE 0 END +
           CASE WHEN $1 = ANY(sn.related_player_ids) THEN 5 ELSE 0 END +
           CASE WHEN sn.news_type = 'breaking' AND sn.significance >= 8 THEN 5 ELSE 0 END
         ) as relevance_score
       FROM street_news sn
       LEFT JOIN districts d ON d.id = sn.district_id
       LEFT JOIN player_news_reads pnr ON pnr.news_id = sn.id AND pnr.player_id = $1
       WHERE
         (sn.expires_at IS NULL OR sn.expires_at > NOW())
         AND ($9 OR pnr.id IS NULL)
         AND (
           sn.district_id = $2
           OR $1 = ANY(sn.related_player_ids)
           OR sn.significance >= 8
           OR sn.district_id = ANY($3::int[])
           OR sn.category = ANY($4::text[])
           OR sn.related_player_ids && $5::int[]
           OR sn.related_crew_ids && $6::int[]
         )
       ORDER BY
         (pnr.id IS NULL) DESC,
         relevance_score DESC,
         sn.published_at DESC
       LIMIT $7 OFFSET $8`,
      [
        playerId,
        currentDistrict,
        districtSubs.length > 0 ? districtSubs : [0],
        categorySubs.length > 0 ? categorySubs : [''],
        playerSubs.length > 0 ? playerSubs : [0],
        crewSubs.length > 0 ? crewSubs : [0],
        safeLimit,
        offset,
        includeRead
      ]
    );

    // Count unread
    const countResult = await pool.query(
      `SELECT COUNT(*) as unread_count
       FROM street_news sn
       WHERE
         (sn.expires_at IS NULL OR sn.expires_at > NOW())
         AND NOT EXISTS (
           SELECT 1 FROM player_news_reads pnr
           WHERE pnr.news_id = sn.id AND pnr.player_id = $1
         )
         AND (
           sn.district_id = $2
           OR $1 = ANY(sn.related_player_ids)
           OR sn.significance >= 8
           OR sn.district_id = ANY($3::int[])
           OR sn.category = ANY($4::text[])
         )`,
      [
        playerId,
        currentDistrict,
        districtSubs.length > 0 ? districtSubs : [0],
        categorySubs.length > 0 ? categorySubs : ['']
      ]
    );

    const news = newsResult.rows.map(row => mapRowToNews(row as StreetNewsRow));
    const unreadCount = parseInt(countResult.rows[0].unread_count, 10);

    console.log(`[StreetBroadcast] Found ${news.length} news items, ${unreadCount} unread`);

    return { news, unreadCount };
  } catch (error) {
    console.error(`[StreetBroadcast] Error getting player feed:`, error);
    return { news: [], unreadCount: 0 };
  }
}

/**
 * Mark news as read for a player
 */
export async function markNewsRead(playerId: string, newsId: string): Promise<boolean> {
  console.log(`[StreetBroadcast] Marking news ${newsId} as read for player ${playerId}`);

  try {
    // Insert read record (ignore if exists)
    await pool.query(
      `INSERT INTO player_news_reads (player_id, news_id)
       VALUES ($1, $2)
       ON CONFLICT (player_id, news_id) DO NOTHING`,
      [playerId, newsId]
    );

    // Increment view count
    await pool.query(
      `UPDATE street_news SET view_count = view_count + 1 WHERE id = $1`,
      [newsId]
    );

    return true;
  } catch (error) {
    console.error(`[StreetBroadcast] Error marking news read:`, error);
    return false;
  }
}

/**
 * Get news for a specific district
 */
export async function getDistrictNews(
  districtId: string,
  limit: number = DEFAULT_FEED_LIMIT
): Promise<StreetNews[]> {
  console.log(`[StreetBroadcast] Getting news for district: ${districtId}`);

  try {
    const result = await pool.query(
      `SELECT sn.*, d.name as district_name
       FROM street_news sn
       LEFT JOIN districts d ON d.id = sn.district_id
       WHERE
         (sn.expires_at IS NULL OR sn.expires_at > NOW())
         AND (sn.district_id = $1 OR sn.significance >= 8)
       ORDER BY sn.significance DESC, sn.published_at DESC
       LIMIT $2`,
      [districtId, Math.min(MAX_FEED_LIMIT, limit)]
    );

    return result.rows.map(row => mapRowToNews(row as StreetNewsRow));
  } catch (error) {
    console.error(`[StreetBroadcast] Error getting district news:`, error);
    return [];
  }
}

/**
 * Get a single news article by ID
 */
export async function getNewsById(newsId: string): Promise<StreetNews | null> {
  console.log(`[StreetBroadcast] Getting news by ID: ${newsId}`);

  try {
    const result = await pool.query(
      `SELECT sn.*, d.name as district_name
       FROM street_news sn
       LEFT JOIN districts d ON d.id = sn.district_id
       WHERE sn.id = $1`,
      [newsId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToNews(result.rows[0] as StreetNewsRow);
  } catch (error) {
    console.error(`[StreetBroadcast] Error getting news by ID:`, error);
    return null;
  }
}

// =============================================================================
// SUBSCRIPTION FUNCTIONS
// =============================================================================

/**
 * Subscribe to a news source
 */
export async function subscribe(
  playerId: string,
  subscriptionType: SubscriptionType,
  targetId: string
): Promise<NewsSubscription | null> {
  console.log(`[StreetBroadcast] Player ${playerId} subscribing to ${subscriptionType}:${targetId}`);

  try {
    const result = await pool.query(
      `INSERT INTO player_news_subscriptions (player_id, subscription_type, target_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, subscription_type, target_id) DO UPDATE
         SET player_id = EXCLUDED.player_id
       RETURNING *`,
      [playerId, subscriptionType, targetId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Get target name for response
    let targetName: string | undefined;
    if (subscriptionType === 'district') {
      const districtResult = await pool.query(
        `SELECT name FROM districts WHERE id = $1`,
        [targetId]
      );
      targetName = districtResult.rows[0]?.name;
    } else if (subscriptionType === 'crew') {
      const crewResult = await pool.query(
        `SELECT name FROM crews WHERE id = $1`,
        [targetId]
      );
      targetName = crewResult.rows[0]?.name;
    } else if (subscriptionType === 'player') {
      const playerResult = await pool.query(
        `SELECT username FROM players WHERE id = $1`,
        [targetId]
      );
      targetName = playerResult.rows[0]?.username;
    } else if (subscriptionType === 'category') {
      targetName = targetId; // Category name is the ID
    }

    const subscription = mapRowToSubscription(result.rows[0] as NewsSubscriptionRow);
    subscription.targetName = targetName;

    console.log(`[StreetBroadcast] Subscription created: ${subscription.id}`);
    return subscription;
  } catch (error) {
    console.error(`[StreetBroadcast] Error subscribing:`, error);
    return null;
  }
}

/**
 * Unsubscribe from a news source
 */
export async function unsubscribe(
  playerId: string,
  subscriptionType: SubscriptionType,
  targetId: string
): Promise<boolean> {
  console.log(`[StreetBroadcast] Player ${playerId} unsubscribing from ${subscriptionType}:${targetId}`);

  try {
    const result = await pool.query(
      `DELETE FROM player_news_subscriptions
       WHERE player_id = $1 AND subscription_type = $2 AND target_id = $3
       RETURNING id`,
      [playerId, subscriptionType, targetId]
    );

    const success = result.rows.length > 0;
    console.log(`[StreetBroadcast] Unsubscribe ${success ? 'successful' : 'failed'}`);
    return success;
  } catch (error) {
    console.error(`[StreetBroadcast] Error unsubscribing:`, error);
    return false;
  }
}

/**
 * Get all subscriptions for a player with target names
 */
export async function getSubscriptions(playerId: string): Promise<NewsSubscription[]> {
  console.log(`[StreetBroadcast] Getting subscriptions for player: ${playerId}`);

  try {
    const result = await pool.query(
      `SELECT
         pns.*,
         CASE
           WHEN pns.subscription_type = 'district' THEN d.name
           WHEN pns.subscription_type = 'crew' THEN c.name
           WHEN pns.subscription_type = 'player' THEN p.username
           WHEN pns.subscription_type = 'category' THEN pns.target_id
         END as target_name
       FROM player_news_subscriptions pns
       LEFT JOIN districts d ON pns.subscription_type = 'district' AND d.id = pns.target_id::int
       LEFT JOIN crews c ON pns.subscription_type = 'crew' AND c.id = pns.target_id::int
       LEFT JOIN players p ON pns.subscription_type = 'player' AND p.id = pns.target_id::int
       WHERE pns.player_id = $1
       ORDER BY pns.subscription_type, pns.created_at`,
      [playerId]
    );

    return result.rows.map(row => mapRowToSubscription(row as NewsSubscriptionRow));
  } catch (error) {
    console.error(`[StreetBroadcast] Error getting subscriptions:`, error);
    return [];
  }
}

// =============================================================================
// RECAP GENERATION
// =============================================================================

/**
 * Generate weekly recap for a district
 */
export async function generateDistrictRecap(districtId: string): Promise<StreetNews | null> {
  console.log(`[StreetBroadcast] Generating weekly recap for district: ${districtId}`);

  try {
    // Get district name
    const districtResult = await pool.query(
      `SELECT name FROM districts WHERE id = $1`,
      [districtId]
    );

    if (districtResult.rows.length === 0) {
      console.log(`[StreetBroadcast] District not found: ${districtId}`);
      return null;
    }

    const districtName = districtResult.rows[0].name;

    // Aggregate stats from past week
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE category = 'crime') as crime_count,
         COUNT(*) FILTER (WHERE category = 'business') as business_count,
         COUNT(*) FILTER (WHERE category = 'territory') as territory_count,
         COUNT(*) FILTER (WHERE category = 'crew') as crew_count,
         COUNT(*) as total_count
       FROM street_news
       WHERE district_id = $1
         AND published_at > NOW() - INTERVAL '7 days'
         AND news_type != 'weekly_recap'`,
      [districtId]
    );

    const stats = statsResult.rows[0];
    const crimeCount = parseInt(stats.crime_count, 10);
    const businessCount = parseInt(stats.business_count, 10);
    const territoryCount = parseInt(stats.territory_count, 10);
    const crewCount = parseInt(stats.crew_count, 10);
    const totalCount = parseInt(stats.total_count, 10);

    // Get most mentioned players
    const playersResult = await pool.query(
      `SELECT UNNEST(related_player_ids) as player_id, COUNT(*) as mentions
       FROM street_news
       WHERE district_id = $1
         AND published_at > NOW() - INTERVAL '7 days'
       GROUP BY player_id
       ORDER BY mentions DESC
       LIMIT 3`,
      [districtId]
    );

    const topPlayerIds = playersResult.rows.map(r => r.player_id);

    // Generate headline
    const headline = `Weekly Recap: ${districtName}`;

    // Generate body
    let body = `This week in ${districtName}:\n\n`;

    if (crimeCount > 0) {
      body += `• ${crimeCount} crime-related incident${crimeCount > 1 ? 's' : ''} reported\n`;
    }
    if (businessCount > 0) {
      body += `• ${businessCount} business activit${businessCount > 1 ? 'ies' : 'y'} noted\n`;
    }
    if (territoryCount > 0) {
      body += `• ${territoryCount} territory change${territoryCount > 1 ? 's' : ''} observed\n`;
    }
    if (crewCount > 0) {
      body += `• ${crewCount} crew-related event${crewCount > 1 ? 's' : ''}\n`;
    }

    if (totalCount === 0) {
      body = `This week in ${districtName}:\n\nA quiet week on the streets. Stay vigilant.`;
    } else {
      body += `\nThe streets are always watching.`;
    }

    // Create the recap
    return await createNews({
      newsType: 'weekly_recap',
      category: 'general',
      headline,
      body,
      districtId: parseInt(districtId, 10),
      relatedPlayerIds: topPlayerIds,
      significance: 6,
      expiresHours: 168 // 1 week
    });
  } catch (error) {
    console.error(`[StreetBroadcast] Error generating district recap:`, error);
    return null;
  }
}

/**
 * Generate recaps for all districts (for scheduled job)
 */
export async function generateAllRecaps(): Promise<number> {
  console.log(`[StreetBroadcast] Generating all district recaps`);

  try {
    const districtsResult = await pool.query(`SELECT id FROM districts`);
    let count = 0;

    for (const row of districtsResult.rows) {
      const recap = await generateDistrictRecap(String(row.id));
      if (recap) {
        count++;
      }
    }

    console.log(`[StreetBroadcast] Generated ${count} district recaps`);
    return count;
  } catch (error) {
    console.error(`[StreetBroadcast] Error generating all recaps:`, error);
    return 0;
  }
}

// =============================================================================
// MAINTENANCE FUNCTIONS
// =============================================================================

/**
 * Clean up expired news articles
 */
export async function cleanupExpiredNews(): Promise<number> {
  console.log(`[StreetBroadcast] Cleaning up expired news`);

  try {
    const result = await pool.query(
      `DELETE FROM street_news
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING id`
    );

    const count = result.rows.length;
    console.log(`[StreetBroadcast] Deleted ${count} expired news articles`);
    return count;
  } catch (error) {
    console.error(`[StreetBroadcast] Error cleaning up expired news:`, error);
    return 0;
  }
}

/**
 * Get all news templates
 */
export async function getNewsTemplates(): Promise<NewsTemplate[]> {
  console.log(`[StreetBroadcast] Getting all news templates`);

  try {
    const result = await pool.query(
      `SELECT * FROM news_templates ORDER BY news_type, category, id`
    );

    return result.rows.map(row => rowToNewsTemplate(row as NewsTemplateRow));
  } catch (error) {
    console.error(`[StreetBroadcast] Error getting news templates:`, error);
    return [];
  }
}

/**
 * Get unread news count for a player
 */
export async function getUnreadCount(playerId: string): Promise<number> {
  console.log(`[StreetBroadcast] Getting unread count for player: ${playerId}`);

  try {
    // Get player's current district
    const playerResult = await pool.query(
      `SELECT current_district_id FROM players WHERE id = $1`,
      [playerId]
    );
    const currentDistrict = playerResult.rows[0]?.current_district_id;

    const result = await pool.query(
      `SELECT COUNT(*) as unread_count
       FROM street_news sn
       WHERE
         (sn.expires_at IS NULL OR sn.expires_at > NOW())
         AND NOT EXISTS (
           SELECT 1 FROM player_news_reads pnr
           WHERE pnr.news_id = sn.id AND pnr.player_id = $1
         )
         AND (
           sn.district_id = $2
           OR $1 = ANY(sn.related_player_ids)
           OR sn.significance >= 8
         )`,
      [playerId, currentDistrict]
    );

    return parseInt(result.rows[0].unread_count, 10);
  } catch (error) {
    console.error(`[StreetBroadcast] Error getting unread count:`, error);
    return 0;
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  createNews,
  generateNewsFromEvent,
  fillTemplate,
  getPlayerFeed,
  markNewsRead,
  getDistrictNews,
  getNewsById,
  subscribe,
  unsubscribe,
  getSubscriptions,
  generateDistrictRecap,
  generateAllRecaps,
  cleanupExpiredNews,
  getNewsTemplates,
  getUnreadCount
};
