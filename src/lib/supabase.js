/**
 * Street Legacy - Supabase Client
 * Initialize and export Supabase client for browser use
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get environment variable with fallback
 * Works in both Node.js and browser environments
 */
function getEnvVar(key, fallback = '') {
  // Browser environment (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || fallback;
  }
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
}

// Supabase configuration
const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', getEnvVar('SUPABASE_URL', 'http://127.0.0.1:54321'));
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', getEnvVar('SUPABASE_ANON_KEY', ''));

// =============================================================================
// CLIENT CREATION
// =============================================================================

/**
 * Default client options for browser use
 */
const defaultOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-client-info': 'street-legacy-game'
    }
  }
};

/**
 * Create a new Supabase client instance
 * @param {string} [url] - Supabase project URL (optional, uses env var if not provided)
 * @param {string} [anonKey] - Supabase anonymous key (optional, uses env var if not provided)
 * @param {object} [options] - Additional client options
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export function createClient(url, anonKey, options = {}) {
  const supabaseUrl = url || SUPABASE_URL;
  const supabaseKey = anonKey || SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL and Anon Key are required. Check your environment variables.');
    throw new Error('Missing Supabase configuration');
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    ...defaultOptions,
    ...options
  });
}

// =============================================================================
// SINGLETON CLIENT
// =============================================================================

let supabaseInstance = null;

/**
 * Get the singleton Supabase client instance
 * Creates the client on first call, returns existing instance on subsequent calls
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client instance
 */
export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient();
  }
  return supabaseInstance;
}

/**
 * Reset the singleton client (useful for testing or re-authentication)
 */
export function resetSupabaseClient() {
  supabaseInstance = null;
}

// =============================================================================
// AUTH HELPERS
// =============================================================================

/**
 * Get the current authenticated user
 * @returns {Promise<import('@supabase/supabase-js').User | null>} Current user or null
 */
export async function getCurrentUser() {
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting current user:', error.message);
    return null;
  }

  return user;
}

/**
 * Get the current session
 * @returns {Promise<import('@supabase/supabase-js').Session | null>} Current session or null
 */
export async function getCurrentSession() {
  const supabase = getSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting current session:', error.message);
    return null;
  }

  return session;
}

/**
 * Sign up a new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} [metadata] - Additional user metadata
 * @returns {Promise<{user: import('@supabase/supabase-js').User | null, error: Error | null}>}
 */
export async function signUp(email, password, metadata = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });

  return { user: data?.user || null, error };
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user: import('@supabase/supabase-js').User | null, session: import('@supabase/supabase-js').Session | null, error: Error | null}>}
 */
export async function signIn(email, password) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return {
    user: data?.user || null,
    session: data?.session || null,
    error
  };
}

/**
 * Sign in anonymously (for guest play)
 * @returns {Promise<{user: import('@supabase/supabase-js').User | null, session: import('@supabase/supabase-js').Session | null, error: Error | null}>}
 */
export async function signInAnonymously() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInAnonymously();

  return {
    user: data?.user || null,
    session: data?.session || null,
    error
  };
}

/**
 * Sign out the current user
 * @returns {Promise<{error: Error | null}>}
 */
export async function signOut() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Listen for auth state changes
 * @param {function} callback - Callback function (event, session) => void
 * @returns {function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  const supabase = getSupabase();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

// =============================================================================
// REALTIME HELPERS
// =============================================================================

/**
 * Subscribe to realtime changes on a table
 * @param {string} table - Table name
 * @param {function} callback - Callback function for changes
 * @param {object} [filter] - Optional filter (e.g., { column: 'id', value: '123' })
 * @returns {import('@supabase/supabase-js').RealtimeChannel} Channel instance
 */
export function subscribeToTable(table, callback, filter = null) {
  const supabase = getSupabase();

  let channel = supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        ...(filter && { filter: `${filter.column}=eq.${filter.value}` })
      },
      callback
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to presence (online status)
 * @param {string} channelName - Channel name
 * @param {object} userState - User state to track
 * @param {function} onSync - Callback when presence syncs
 * @param {function} onJoin - Callback when user joins
 * @param {function} onLeave - Callback when user leaves
 * @returns {import('@supabase/supabase-js').RealtimeChannel} Channel instance
 */
export function subscribeToPresence(channelName, userState, onSync, onJoin, onLeave) {
  const supabase = getSupabase();

  const channel = supabase.channel(channelName, {
    config: {
      presence: {
        key: userState.id || 'anonymous'
      }
    }
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onSync && onSync(state);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      onJoin && onJoin(key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      onLeave && onLeave(key, leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userState);
      }
    });

  return channel;
}

/**
 * Unsubscribe from a channel
 * @param {import('@supabase/supabase-js').RealtimeChannel} channel - Channel to unsubscribe
 */
export async function unsubscribe(channel) {
  const supabase = getSupabase();
  await supabase.removeChannel(channel);
}

// =============================================================================
// EDGE FUNCTION HELPERS
// =============================================================================

/**
 * Invoke an edge function
 * @param {string} functionName - Name of the edge function
 * @param {object} [body] - Request body
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function invokeFunction(functionName, body = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body
  });

  return { data, error };
}

/**
 * Perform a player action via edge function
 * @param {string} action - Action type
 * @param {object} payload - Action payload
 * @returns {Promise<{success: boolean, message: string, data?: object}>}
 */
export async function performAction(action, payload = {}) {
  const { data, error } = await invokeFunction('player-action', {
    action,
    payload
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return data;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  createClient,
  getSupabase,
  resetSupabaseClient,
  getCurrentUser,
  getCurrentSession,
  signUp,
  signIn,
  signInAnonymously,
  signOut,
  onAuthStateChange,
  subscribeToTable,
  subscribeToPresence,
  unsubscribe,
  invokeFunction,
  performAction
};
