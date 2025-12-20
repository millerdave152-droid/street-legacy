/**
 * Street Legacy - Supabase Client
 * Shared Supabase client initialization for browser and server use
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface SupabaseClientOptions {
  autoRefreshToken?: boolean;
  persistSession?: boolean;
  detectSessionInUrl?: boolean;
}

// =============================================================================
// CLIENT CREATION - BROWSER
// =============================================================================

/**
 * Create a Supabase client for browser/client-side use
 * Uses the anon key which has Row Level Security applied
 *
 * @param url - Supabase project URL
 * @param anonKey - Supabase anonymous (public) key
 * @param options - Optional client configuration
 * @returns SupabaseClient instance
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options: SupabaseClientOptions = {}
): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are required');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: options.autoRefreshToken ?? true,
      persistSession: options.persistSession ?? true,
      detectSessionInUrl: options.detectSessionInUrl ?? true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: {
        'x-client-info': 'street-legacy-client'
      }
    }
  });
}

// =============================================================================
// CLIENT CREATION - SERVER
// =============================================================================

/**
 * Create a Supabase client for server-side use
 * Uses the service role key which bypasses Row Level Security
 *
 * WARNING: Never expose this client or the service role key to the browser!
 *
 * @param url - Supabase project URL
 * @param serviceRoleKey - Supabase service role (secret) key
 * @returns SupabaseClient instance with admin privileges
 */
export function createSupabaseServerClient(
  url: string,
  serviceRoleKey: string
): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase URL and service role key are required');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'x-client-info': 'street-legacy-server'
      }
    }
  });
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export commonly used types from @supabase/supabase-js
export type { SupabaseClient } from '@supabase/supabase-js';
export type { User, Session, AuthError } from '@supabase/supabase-js';
export type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
