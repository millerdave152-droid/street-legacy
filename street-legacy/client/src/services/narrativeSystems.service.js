/**
 * Narrative Systems Service
 * Handles API calls for all narrative features with 5-minute caching
 *
 * Systems covered:
 * - World Memory (events, history, legacy)
 * - Witness System (testimonials, verification)
 * - Street Broadcast (news, subscriptions)
 * - Life Chapters (age, modifiers, features)
 * - Debt Economy (debts, favors, trust)
 * - Succession (plans, lineage, dynasties)
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SHORT_CACHE_MS = 60 * 1000; // 1 minute for frequently changing data

// Cache storage
const cache = {
  // World Memory
  worldEvents: { data: null, timestamp: 0 },
  districtHistories: new Map(), // Map<districtId, { data, timestamp }>
  playerLegacies: new Map(), // Map<playerId, { data, timestamp }>

  // Witness
  witnessableEvents: { data: null, timestamp: 0 },
  myTestimonials: { data: null, timestamp: 0 },

  // Street Broadcast
  newsFeed: { data: null, timestamp: 0 },
  subscriptions: { data: null, timestamp: 0 },

  // Life Chapters
  myLifeState: { data: null, timestamp: 0 },
  chapterModifiers: { data: null, timestamp: 0 },
  featureAccess: new Map(), // Map<feature, { data, timestamp }>

  // Debt Economy
  myDebts: { data: null, timestamp: 0 },
  myCredits: { data: null, timestamp: 0 },

  // Succession
  successionPlan: { data: null, timestamp: 0 },
  myLineage: { data: null, timestamp: 0 },
  dynastyInfo: { data: null, timestamp: 0 }
};

function getAuthToken() {
  return localStorage.getItem('token');
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || `Request failed: ${response.status}`);
  }

  return result.data || result;
}

function isCacheValid(cacheEntry, duration = CACHE_DURATION_MS) {
  if (!cacheEntry || !cacheEntry.data) return false;
  return Date.now() - cacheEntry.timestamp < duration;
}

// ============================================================================
// World Memory API
// ============================================================================

/**
 * Get world events (cached)
 * @param {number} limit - Max events to return
 * @param {number} minSignificance - Minimum significance level (1-10)
 * @param {boolean} forceRefresh - Bypass cache
 * @returns {Promise<Array>} Array of world events
 */
export async function getWorldEvents(limit = 20, minSignificance = 1, forceRefresh = false) {
  const cacheKey = `${limit}_${minSignificance}`;

  if (!forceRefresh && isCacheValid(cache.worldEvents) && cache.worldEvents.key === cacheKey) {
    console.log('[Narrative] Returning cached world events');
    return cache.worldEvents.data;
  }

  try {
    const result = await apiRequest(`/world-memory/events?limit=${limit}&minSignificance=${minSignificance}`);
    const events = result.events || result || [];

    cache.worldEvents = {
      data: events,
      timestamp: Date.now(),
      key: cacheKey
    };

    console.log(`[Narrative] Fetched ${events.length} world events`);
    return events;
  } catch (error) {
    console.error('[Narrative] Failed to fetch world events:', error);
    return cache.worldEvents.data || [];
  }
}

/**
 * Get district history (cached)
 * @param {string} districtId
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} District narrative history
 */
export async function getDistrictHistory(districtId, forceRefresh = false) {
  const cached = cache.districtHistories.get(districtId);
  if (!forceRefresh && isCacheValid(cached)) {
    console.log(`[Narrative] Returning cached history for ${districtId}`);
    return cached.data;
  }

  try {
    const result = await apiRequest(`/world-memory/districts/${districtId}/history`);
    const history = result.history || result;

    cache.districtHistories.set(districtId, {
      data: history,
      timestamp: Date.now()
    });

    return history;
  } catch (error) {
    console.error(`[Narrative] Failed to fetch district history for ${districtId}:`, error);
    return cached?.data || { events: [], monuments: [], legends: [] };
  }
}

/**
 * Get player legacy (cached)
 * @param {string} playerId
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Player's legacy data
 */
export async function getPlayerLegacy(playerId, forceRefresh = false) {
  const cached = cache.playerLegacies.get(playerId);
  if (!forceRefresh && isCacheValid(cached)) {
    console.log(`[Narrative] Returning cached legacy for ${playerId}`);
    return cached.data;
  }

  try {
    const result = await apiRequest(`/world-memory/players/${playerId}/legacy`);
    const legacy = result.legacy || result;

    cache.playerLegacies.set(playerId, {
      data: legacy,
      timestamp: Date.now()
    });

    return legacy;
  } catch (error) {
    console.error(`[Narrative] Failed to fetch player legacy for ${playerId}:`, error);
    return cached?.data || { achievements: [], infamy: 0, legends: [] };
  }
}

// ============================================================================
// Witness System API
// ============================================================================

/**
 * Get witnessable events in current district (short cache)
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>} Array of witnessable events
 */
export async function getWitnessableEvents(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.witnessableEvents, SHORT_CACHE_MS)) {
    console.log('[Narrative] Returning cached witnessable events');
    return cache.witnessableEvents.data;
  }

  try {
    const result = await apiRequest('/witnesses/events/available');
    const events = result.events || result || [];

    cache.witnessableEvents = {
      data: events,
      timestamp: Date.now()
    };

    console.log(`[Narrative] Fetched ${events.length} witnessable events`);
    return events;
  } catch (error) {
    console.error('[Narrative] Failed to fetch witnessable events:', error);
    return cache.witnessableEvents.data || [];
  }
}

/**
 * Verify witnessing an event
 * @param {string} eventId
 * @param {string} testimony - Player's account of what they witnessed
 * @returns {Promise<Object>} Verification result
 */
export async function verifyWitness(eventId, testimony) {
  try {
    const result = await apiRequest(`/witnesses/events/${eventId}/verify`, 'POST', { testimony });

    // Invalidate related caches
    cache.witnessableEvents = { data: null, timestamp: 0 };
    cache.myTestimonials = { data: null, timestamp: 0 };

    console.log(`[Narrative] Verified witness for event ${eventId}`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to verify witness for ${eventId}:`, error);
    throw error;
  }
}

/**
 * Get my testimonials (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>} Array of player's testimonials
 */
export async function getMyTestimonials(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.myTestimonials)) {
    console.log('[Narrative] Returning cached testimonials');
    return cache.myTestimonials.data;
  }

  try {
    const result = await apiRequest('/witnesses/testimonials/mine');
    const testimonials = result.testimonials || result || [];

    cache.myTestimonials = {
      data: testimonials,
      timestamp: Date.now()
    };

    return testimonials;
  } catch (error) {
    console.error('[Narrative] Failed to fetch testimonials:', error);
    return cache.myTestimonials.data || [];
  }
}

// ============================================================================
// Street Broadcast API
// ============================================================================

/**
 * Get news feed (short cache)
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>} Array of news items
 */
export async function getNewsFeed(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.newsFeed, SHORT_CACHE_MS)) {
    console.log('[Narrative] Returning cached news feed');
    return cache.newsFeed.data;
  }

  try {
    const result = await apiRequest('/broadcasts/feed');
    const news = result.news || result.feed || result || [];

    cache.newsFeed = {
      data: news,
      timestamp: Date.now()
    };

    console.log(`[Narrative] Fetched ${news.length} news items`);
    return news;
  } catch (error) {
    console.error('[Narrative] Failed to fetch news feed:', error);
    return cache.newsFeed.data || [];
  }
}

/**
 * Mark news as read
 * @param {string} newsId
 * @returns {Promise<Object>} Result
 */
export async function markNewsRead(newsId) {
  try {
    const result = await apiRequest(`/broadcasts/news/${newsId}/read`, 'POST');
    console.log(`[Narrative] Marked news ${newsId} as read`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to mark news ${newsId} as read:`, error);
    throw error;
  }
}

/**
 * Get subscriptions (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>} Array of subscriptions
 */
export async function getSubscriptions(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.subscriptions)) {
    console.log('[Narrative] Returning cached subscriptions');
    return cache.subscriptions.data;
  }

  try {
    const result = await apiRequest('/broadcasts/subscriptions');
    const subs = result.subscriptions || result || [];

    cache.subscriptions = {
      data: subs,
      timestamp: Date.now()
    };

    return subs;
  } catch (error) {
    console.error('[Narrative] Failed to fetch subscriptions:', error);
    return cache.subscriptions.data || [];
  }
}

/**
 * Subscribe to a broadcast source
 * @param {string} type - 'player', 'crew', 'district', 'faction'
 * @param {string} targetId - ID of the target to subscribe to
 * @returns {Promise<Object>} Result
 */
export async function subscribe(type, targetId) {
  try {
    const result = await apiRequest('/broadcasts/subscriptions', 'POST', { type, targetId });
    cache.subscriptions = { data: null, timestamp: 0 }; // Invalidate cache
    console.log(`[Narrative] Subscribed to ${type}:${targetId}`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to subscribe to ${type}:${targetId}:`, error);
    throw error;
  }
}

/**
 * Unsubscribe from a broadcast source
 * @param {string} type
 * @param {string} targetId
 * @returns {Promise<Object>} Result
 */
export async function unsubscribe(type, targetId) {
  try {
    const result = await apiRequest(`/broadcasts/subscriptions/${type}/${targetId}`, 'DELETE');
    cache.subscriptions = { data: null, timestamp: 0 }; // Invalidate cache
    console.log(`[Narrative] Unsubscribed from ${type}:${targetId}`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to unsubscribe from ${type}:${targetId}:`, error);
    throw error;
  }
}

// ============================================================================
// Life Chapters API
// ============================================================================

/**
 * Get my life state (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Current life state with chapter, age, etc.
 */
export async function getMyLifeState(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.myLifeState)) {
    console.log('[Narrative] Returning cached life state');
    return cache.myLifeState.data;
  }

  try {
    const result = await apiRequest('/life-chapters/state');
    const state = result.state || result;

    cache.myLifeState = {
      data: state,
      timestamp: Date.now()
    };

    return state;
  } catch (error) {
    console.error('[Narrative] Failed to fetch life state:', error);
    return cache.myLifeState.data || getDefaultLifeState();
  }
}

/**
 * Get chapter modifiers (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Current chapter's stat modifiers
 */
export async function getChapterModifiers(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.chapterModifiers)) {
    console.log('[Narrative] Returning cached chapter modifiers');
    return cache.chapterModifiers.data;
  }

  try {
    const result = await apiRequest('/life-chapters/modifiers');
    const modifiers = result.modifiers || result;

    cache.chapterModifiers = {
      data: modifiers,
      timestamp: Date.now()
    };

    return modifiers;
  } catch (error) {
    console.error('[Narrative] Failed to fetch chapter modifiers:', error);
    return cache.chapterModifiers.data || getDefaultChapterModifiers();
  }
}

/**
 * Check if player can use a feature based on life chapter
 * @param {string} feature - Feature name to check
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} { allowed, reason, chapter }
 */
export async function canUseFeature(feature, forceRefresh = false) {
  const cached = cache.featureAccess.get(feature);
  if (!forceRefresh && isCacheValid(cached)) {
    console.log(`[Narrative] Returning cached feature access for ${feature}`);
    return cached.data;
  }

  try {
    const result = await apiRequest(`/life-chapters/features/${feature}/check`);
    const access = result.access || result;

    cache.featureAccess.set(feature, {
      data: access,
      timestamp: Date.now()
    });

    return access;
  } catch (error) {
    console.error(`[Narrative] Failed to check feature access for ${feature}:`, error);
    return cached?.data || { allowed: true, reason: null, chapter: 'unknown' };
  }
}

// ============================================================================
// Debt Economy API
// ============================================================================

/**
 * Get my debts (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} { owedToMe, owedByMe }
 */
export async function getMyDebts(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.myDebts)) {
    console.log('[Narrative] Returning cached debts');
    return cache.myDebts.data;
  }

  try {
    const [owedByMe, owedToMe] = await Promise.all([
      apiRequest('/debts/owed-by-me'),
      apiRequest('/debts/owed-to-me')
    ]);

    const debts = {
      owedByMe: owedByMe.debts || owedByMe || [],
      owedToMe: owedToMe.debts || owedToMe || []
    };

    cache.myDebts = {
      data: debts,
      timestamp: Date.now()
    };

    console.log(`[Narrative] Fetched ${debts.owedByMe.length} debts owed, ${debts.owedToMe.length} credits`);
    return debts;
  } catch (error) {
    console.error('[Narrative] Failed to fetch debts:', error);
    return cache.myDebts.data || { owedByMe: [], owedToMe: [] };
  }
}

/**
 * Create a new debt
 * @param {string} debtorId - Player who owes the debt
 * @param {string} type - 'favor', 'loan', 'blood_debt', 'service'
 * @param {string} description - Description of the debt
 * @param {number} value - Monetary value (if applicable)
 * @returns {Promise<Object>} Created debt
 */
export async function createDebt(debtorId, type, description, value = 0) {
  try {
    const result = await apiRequest('/debts', 'POST', {
      debtorId,
      debtType: type,
      description,
      value
    });

    cache.myDebts = { data: null, timestamp: 0 }; // Invalidate cache
    console.log(`[Narrative] Created ${type} debt with ${debtorId}`);
    return result.debt || result;
  } catch (error) {
    console.error('[Narrative] Failed to create debt:', error);
    throw error;
  }
}

/**
 * Call in a debt
 * @param {string} debtId
 * @returns {Promise<Object>} Result
 */
export async function callInDebt(debtId) {
  try {
    const result = await apiRequest(`/debts/${debtId}/call`, 'POST');
    cache.myDebts = { data: null, timestamp: 0 }; // Invalidate cache
    console.log(`[Narrative] Called in debt ${debtId}`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to call in debt ${debtId}:`, error);
    throw error;
  }
}

/**
 * Fulfill a debt
 * @param {string} debtId
 * @returns {Promise<Object>} Result with trust bonus
 */
export async function fulfillDebt(debtId) {
  try {
    const result = await apiRequest(`/debts/${debtId}/fulfill`, 'POST');
    cache.myDebts = { data: null, timestamp: 0 }; // Invalidate cache
    console.log(`[Narrative] Fulfilled debt ${debtId}`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to fulfill debt ${debtId}:`, error);
    throw error;
  }
}

/**
 * Transfer a debt to another player
 * @param {string} debtId
 * @param {string} toPlayerId - New creditor
 * @returns {Promise<Object>} Result
 */
export async function transferDebt(debtId, toPlayerId) {
  try {
    const result = await apiRequest(`/debts/${debtId}/transfer`, 'POST', { toPlayerId });
    cache.myDebts = { data: null, timestamp: 0 }; // Invalidate cache
    console.log(`[Narrative] Transferred debt ${debtId} to ${toPlayerId}`);
    return result;
  } catch (error) {
    console.error(`[Narrative] Failed to transfer debt ${debtId}:`, error);
    throw error;
  }
}

/**
 * Get debt marketplace offers
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>} Array of marketplace listings
 */
export async function getDebtMarketplace(forceRefresh = false) {
  try {
    const result = await apiRequest('/debts/marketplace');
    return result.offers || result || [];
  } catch (error) {
    console.error('[Narrative] Failed to fetch debt marketplace:', error);
    return [];
  }
}

// ============================================================================
// Succession API
// ============================================================================

/**
 * Get succession plan (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Current succession plan
 */
export async function getSuccessionPlan(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.successionPlan)) {
    console.log('[Narrative] Returning cached succession plan');
    return cache.successionPlan.data;
  }

  try {
    const result = await apiRequest('/succession/plan');
    const plan = result.plan || result;

    cache.successionPlan = {
      data: plan,
      timestamp: Date.now()
    };

    return plan;
  } catch (error) {
    console.error('[Narrative] Failed to fetch succession plan:', error);
    return cache.successionPlan.data || getDefaultSuccessionPlan();
  }
}

/**
 * Update succession plan
 * @param {Object} plan - Updated plan data
 * @returns {Promise<Object>} Updated plan
 */
export async function updateSuccessionPlan(plan) {
  try {
    const result = await apiRequest('/succession/plan', 'PUT', plan);

    // Update cache with new plan
    cache.successionPlan = {
      data: result.plan || result,
      timestamp: Date.now()
    };

    console.log('[Narrative] Updated succession plan');
    return result.plan || result;
  } catch (error) {
    console.error('[Narrative] Failed to update succession plan:', error);
    throw error;
  }
}

/**
 * Get my lineage (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Player's lineage/dynasty info
 */
export async function getMyLineage(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.myLineage)) {
    console.log('[Narrative] Returning cached lineage');
    return cache.myLineage.data;
  }

  try {
    const result = await apiRequest('/succession/lineage');
    const lineage = result.lineage || result;

    cache.myLineage = {
      data: lineage,
      timestamp: Date.now()
    };

    return lineage;
  } catch (error) {
    console.error('[Narrative] Failed to fetch lineage:', error);
    return cache.myLineage.data || { ancestors: [], generation: 1, dynasty: null };
  }
}

/**
 * Get dynasty info (cached)
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Dynasty statistics and achievements
 */
export async function getDynastyInfo(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cache.dynastyInfo)) {
    console.log('[Narrative] Returning cached dynasty info');
    return cache.dynastyInfo.data;
  }

  try {
    const result = await apiRequest('/succession/dynasty');
    const dynasty = result.dynasty || result;

    cache.dynastyInfo = {
      data: dynasty,
      timestamp: Date.now()
    };

    return dynasty;
  } catch (error) {
    console.error('[Narrative] Failed to fetch dynasty info:', error);
    return cache.dynastyInfo.data || null;
  }
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear all cached data
 */
export function clearCache() {
  cache.worldEvents = { data: null, timestamp: 0 };
  cache.districtHistories.clear();
  cache.playerLegacies.clear();
  cache.witnessableEvents = { data: null, timestamp: 0 };
  cache.myTestimonials = { data: null, timestamp: 0 };
  cache.newsFeed = { data: null, timestamp: 0 };
  cache.subscriptions = { data: null, timestamp: 0 };
  cache.myLifeState = { data: null, timestamp: 0 };
  cache.chapterModifiers = { data: null, timestamp: 0 };
  cache.featureAccess.clear();
  cache.myDebts = { data: null, timestamp: 0 };
  cache.myCredits = { data: null, timestamp: 0 };
  cache.successionPlan = { data: null, timestamp: 0 };
  cache.myLineage = { data: null, timestamp: 0 };
  cache.dynastyInfo = { data: null, timestamp: 0 };
  console.log('[Narrative] All caches cleared');
}

/**
 * Clear specific system cache
 * @param {string} system - 'worldMemory', 'witness', 'broadcast', 'chapters', 'debts', 'succession'
 */
export function clearSystemCache(system) {
  switch (system) {
    case 'worldMemory':
      cache.worldEvents = { data: null, timestamp: 0 };
      cache.districtHistories.clear();
      cache.playerLegacies.clear();
      break;
    case 'witness':
      cache.witnessableEvents = { data: null, timestamp: 0 };
      cache.myTestimonials = { data: null, timestamp: 0 };
      break;
    case 'broadcast':
      cache.newsFeed = { data: null, timestamp: 0 };
      cache.subscriptions = { data: null, timestamp: 0 };
      break;
    case 'chapters':
      cache.myLifeState = { data: null, timestamp: 0 };
      cache.chapterModifiers = { data: null, timestamp: 0 };
      cache.featureAccess.clear();
      break;
    case 'debts':
      cache.myDebts = { data: null, timestamp: 0 };
      cache.myCredits = { data: null, timestamp: 0 };
      break;
    case 'succession':
      cache.successionPlan = { data: null, timestamp: 0 };
      cache.myLineage = { data: null, timestamp: 0 };
      cache.dynastyInfo = { data: null, timestamp: 0 };
      break;
    default:
      console.warn(`[Narrative] Unknown system: ${system}`);
  }
  console.log(`[Narrative] Cache cleared for ${system}`);
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  return {
    worldEvents: isCacheValid(cache.worldEvents),
    districtHistories: cache.districtHistories.size,
    playerLegacies: cache.playerLegacies.size,
    witnessableEvents: isCacheValid(cache.witnessableEvents, SHORT_CACHE_MS),
    myTestimonials: isCacheValid(cache.myTestimonials),
    newsFeed: isCacheValid(cache.newsFeed, SHORT_CACHE_MS),
    subscriptions: isCacheValid(cache.subscriptions),
    myLifeState: isCacheValid(cache.myLifeState),
    chapterModifiers: isCacheValid(cache.chapterModifiers),
    featureAccess: cache.featureAccess.size,
    myDebts: isCacheValid(cache.myDebts),
    successionPlan: isCacheValid(cache.successionPlan),
    myLineage: isCacheValid(cache.myLineage),
    dynastyInfo: isCacheValid(cache.dynastyInfo)
  };
}

// ============================================================================
// Default Fallback Data
// ============================================================================

function getDefaultLifeState() {
  return {
    chapter: 'young_hustler',
    age: 18,
    yearsActive: 0,
    health: 100,
    nextChapterAt: 25,
    milestones: []
  };
}

function getDefaultChapterModifiers() {
  return {
    energyRegen: 1.0,
    learningRate: 1.2,
    maxHealth: 100,
    heatGain: 1.0,
    crimeSuccess: 0,
    pvpDamage: 1.0
  };
}

function getDefaultSuccessionPlan() {
  return {
    heirType: 'random',
    heirId: null,
    cashPercent: 50,
    propertyPercent: 100,
    reputationPercent: 30,
    lastUpdated: null
  };
}

// ============================================================================
// Export as Singleton Service
// ============================================================================

export const narrativeService = {
  // World Memory
  getWorldEvents,
  getDistrictHistory,
  getPlayerLegacy,

  // Witness
  getWitnessableEvents,
  verifyWitness,
  getMyTestimonials,

  // Street Broadcast
  getNewsFeed,
  markNewsRead,
  getSubscriptions,
  subscribe,
  unsubscribe,

  // Life Chapters
  getMyLifeState,
  getChapterModifiers,
  canUseFeature,

  // Debt Economy
  getMyDebts,
  createDebt,
  callInDebt,
  fulfillDebt,
  transferDebt,
  getDebtMarketplace,

  // Succession
  getSuccessionPlan,
  updateSuccessionPlan,
  getMyLineage,
  getDynastyInfo,

  // Cache Management
  clearCache,
  clearSystemCache,
  getCacheStatus
};

export default narrativeService;
