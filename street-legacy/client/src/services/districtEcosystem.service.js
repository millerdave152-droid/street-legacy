/**
 * District Ecosystem Service
 * Handles API calls for district state data with 5-minute caching
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Cache storage
const cache = {
  allStates: { data: null, timestamp: 0 },
  districtStates: new Map(), // Map<districtId, { data, timestamp }>
  districtHistory: new Map(), // Map<districtId, { data, timestamp }>
  modifiers: new Map() // Map<districtId, { data, timestamp }>
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

function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.data) return false;
  return Date.now() - cacheEntry.timestamp < CACHE_DURATION_MS;
}

/**
 * Get all district states (cached)
 * @param {boolean} forceRefresh - Bypass cache
 * @returns {Promise<Array>} Array of district states
 */
export async function getAllDistrictStates(forceRefresh = false) {
  // Check cache
  if (!forceRefresh && isCacheValid(cache.allStates)) {
    console.log('[DistrictEcosystem] Returning cached all states');
    return cache.allStates.data;
  }

  try {
    const result = await apiRequest('/districts/states');
    const states = result.states || result || [];

    // Update cache
    cache.allStates = {
      data: states,
      timestamp: Date.now()
    };

    // Also update individual district caches
    states.forEach(state => {
      cache.districtStates.set(state.districtId, {
        data: state,
        timestamp: Date.now()
      });
    });

    console.log(`[DistrictEcosystem] Fetched ${states.length} district states`);
    return states;
  } catch (error) {
    console.error('[DistrictEcosystem] Failed to fetch all states:', error);

    // Return cached data if available, even if stale
    if (cache.allStates.data) {
      console.log('[DistrictEcosystem] Returning stale cached data');
      return cache.allStates.data;
    }

    // Return empty array with default states as fallback
    return getDefaultDistrictStates();
  }
}

/**
 * Get single district state (cached)
 * @param {string} districtId
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} District state
 */
export async function getDistrictState(districtId, forceRefresh = false) {
  // Check cache
  const cached = cache.districtStates.get(districtId);
  if (!forceRefresh && isCacheValid(cached)) {
    console.log(`[DistrictEcosystem] Returning cached state for ${districtId}`);
    return cached.data;
  }

  try {
    const result = await apiRequest(`/districts/${districtId}/state`);
    const state = result.state || result;

    // Update cache
    cache.districtStates.set(districtId, {
      data: state,
      timestamp: Date.now()
    });

    return state;
  } catch (error) {
    console.error(`[DistrictEcosystem] Failed to fetch state for ${districtId}:`, error);

    // Return cached data if available
    if (cached?.data) {
      return cached.data;
    }

    // Return default state
    return getDefaultState(districtId);
  }
}

/**
 * Get district modifiers (cached)
 * @param {string} districtId
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} District modifiers
 */
export async function getDistrictModifiers(districtId, forceRefresh = false) {
  // Check cache
  const cached = cache.modifiers.get(districtId);
  if (!forceRefresh && isCacheValid(cached)) {
    console.log(`[DistrictEcosystem] Returning cached modifiers for ${districtId}`);
    return cached.data;
  }

  try {
    const result = await apiRequest(`/districts/${districtId}/modifiers`);
    const modifiers = result.modifiers || result;

    // Update cache
    cache.modifiers.set(districtId, {
      data: modifiers,
      timestamp: Date.now()
    });

    return modifiers;
  } catch (error) {
    console.error(`[DistrictEcosystem] Failed to fetch modifiers for ${districtId}:`, error);

    // Return cached data if available
    if (cached?.data) {
      return cached.data;
    }

    // Return default modifiers
    return getDefaultModifiers();
  }
}

/**
 * Get district event history (cached)
 * @param {string} districtId
 * @param {number} limit
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>} Array of events
 */
export async function getDistrictHistory(districtId, limit = 10, forceRefresh = false) {
  // Check cache
  const cached = cache.districtHistory.get(districtId);
  if (!forceRefresh && isCacheValid(cached)) {
    console.log(`[DistrictEcosystem] Returning cached history for ${districtId}`);
    return cached.data.slice(0, limit);
  }

  try {
    const result = await apiRequest(`/districts/${districtId}/history?limit=${limit}`);
    const events = result.events || result || [];

    // Update cache
    cache.districtHistory.set(districtId, {
      data: events,
      timestamp: Date.now()
    });

    return events;
  } catch (error) {
    console.error(`[DistrictEcosystem] Failed to fetch history for ${districtId}:`, error);

    // Return cached data if available
    if (cached?.data) {
      return cached.data.slice(0, limit);
    }

    return [];
  }
}

/**
 * Get full district info (state + modifiers + recent events)
 * @param {string} districtId
 * @param {boolean} forceRefresh
 * @returns {Promise<Object>} Combined district data
 */
export async function getFullDistrictInfo(districtId, forceRefresh = false) {
  try {
    const [state, modifiers, events] = await Promise.all([
      getDistrictState(districtId, forceRefresh),
      getDistrictModifiers(districtId, forceRefresh),
      getDistrictHistory(districtId, 10, forceRefresh)
    ]);

    return {
      state,
      modifiers,
      events
    };
  } catch (error) {
    console.error(`[DistrictEcosystem] Failed to get full info for ${districtId}:`, error);
    return {
      state: getDefaultState(districtId),
      modifiers: getDefaultModifiers(),
      events: []
    };
  }
}

/**
 * Clear all cached data
 */
export function clearCache() {
  cache.allStates = { data: null, timestamp: 0 };
  cache.districtStates.clear();
  cache.districtHistory.clear();
  cache.modifiers.clear();
  console.log('[DistrictEcosystem] Cache cleared');
}

/**
 * Clear cache for specific district
 * @param {string} districtId
 */
export function clearDistrictCache(districtId) {
  cache.districtStates.delete(districtId);
  cache.districtHistory.delete(districtId);
  cache.modifiers.delete(districtId);
  console.log(`[DistrictEcosystem] Cache cleared for ${districtId}`);
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  return {
    allStatesValid: isCacheValid(cache.allStates),
    allStatesAge: cache.allStates.timestamp ? Date.now() - cache.allStates.timestamp : null,
    districtStatesCount: cache.districtStates.size,
    historyCount: cache.districtHistory.size,
    modifiersCount: cache.modifiers.size
  };
}

// Default fallback data
function getDefaultState(districtId) {
  return {
    districtId: districtId,
    crimeIndex: 50,
    policePresence: 50,
    propertyValues: 50,
    businessHealth: 50,
    streetActivity: 50,
    status: 'stable',
    heatLevel: 0,
    crewTension: 0
  };
}

function getDefaultModifiers() {
  return {
    crimeDifficulty: 1.0,
    crimePayoutBonus: 0,
    policeAlertChance: 0,
    propertyIncomeMultiplier: 1.0,
    pvpDamageMultiplier: 1.0,
    heatGainMultiplier: 1.0,
    xpMultiplier: 1.0
  };
}

function getDefaultDistrictStates() {
  const districts = [
    'downtown', 'parkdale', 'scarborough', 'etobicoke', 'northyork',
    'yorkville', 'kensington', 'portlands', 'thebeach', 'regent',
    'financial', 'chinatown'
  ];

  return districts.map(id => getDefaultState(id));
}

// Export as singleton service object
export const districtEcosystemService = {
  getAllDistrictStates,
  getDistrictState,
  getDistrictModifiers,
  getDistrictHistory,
  getFullDistrictInfo,
  clearCache,
  clearDistrictCache,
  getCacheStatus
};

export default districtEcosystemService;
