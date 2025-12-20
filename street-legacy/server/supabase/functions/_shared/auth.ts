// Street Legacy - Authentication Utility
// Shared utilities for Edge Functions

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Create a Supabase client with service role key
 * This client bypasses RLS for admin operations
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Create a Supabase client that respects RLS using the user's JWT
 * Use this when you want operations to be scoped to the user
 */
export function getSupabaseClientWithAuth(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export interface AuthResult {
  user: User | null
  error: string | null
}

/**
 * Get authenticated user from authorization header
 * @param supabase - Supabase client (service role)
 * @param authHeader - Authorization header from request
 * @returns User object or error message
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient,
  authHeader: string | null
): Promise<AuthResult> {
  if (!authHeader) {
    return { user: null, error: 'No authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return { user: null, error: 'Invalid authorization header format' }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error) {
      console.error('Auth error:', error.message)
      return { user: null, error: 'Invalid or expired token' }
    }

    if (!user) {
      return { user: null, error: 'User not found' }
    }

    return { user, error: null }
  } catch (err) {
    console.error('Auth exception:', err)
    return { user: null, error: 'Authentication failed' }
  }
}

/**
 * Validate that a player profile exists for the authenticated user
 * @param supabase - Supabase client
 * @param userId - User ID from auth
 * @returns Player data or null
 */
export async function getPlayerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ player: Record<string, unknown> | null; error: string | null }> {
  try {
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { player: null, error: 'Player profile not found' }
      }
      return { player: null, error: error.message }
    }

    return { player, error: null }
  } catch (err) {
    console.error('Get player error:', err)
    return { player: null, error: 'Failed to fetch player profile' }
  }
}
