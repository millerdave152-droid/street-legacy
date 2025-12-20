// Street Legacy - Supabase Client
// Direct Supabase integration for authentication and data
// Supports pure local mode when Supabase is not configured

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey &&
  supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined'

if (!isSupabaseConfigured) {
  console.log('[Supabase] Running in LOCAL-ONLY mode (no cloud sync)')
}

// Create client only if configured, otherwise create a mock client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage
      }
    })
  : {
      // Mock client for local-only mode
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: null, error: { message: 'Local mode - no auth' } }),
        signUp: async () => ({ data: null, error: { message: 'Local mode - no auth' } }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({ data: null, error: { message: 'Local mode' } }),
        insert: () => ({ data: null, error: { message: 'Local mode' } }),
        update: () => ({ data: null, error: { message: 'Local mode' } }),
        delete: () => ({ data: null, error: { message: 'Local mode' } }),
        upsert: () => ({ data: null, error: { message: 'Local mode' } })
      }),
      channel: () => ({
        on: () => ({ subscribe: () => {} }),
        subscribe: () => {}
      }),
      removeChannel: () => {}
    }

export const isLocalMode = !isSupabaseConfigured
export default supabase
