// Street Legacy - Auth Handler Edge Function
// Handles player creation, profile management, and authentication

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, getAuthenticatedUser } from '../_shared/auth.ts'

interface CreatePlayerRequest {
  username: string
  starter_build: 'hustler' | 'entrepreneur' | 'community_kid'
  starting_district?: string
}

interface UpdateProfileRequest {
  display_name?: string
  settings?: Record<string, unknown>
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    const { user, error: authError } = await getAuthenticatedUser(supabase, authHeader)

    if (authError || !user) {
      return errorResponse(authError || 'Unauthorized', 401)
    }

    // Parse action from URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const action = pathParts[pathParts.length - 1]

    switch (action) {
      // =========================================================================
      // CREATE PLAYER PROFILE
      // =========================================================================
      case 'create-player': {
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 405)
        }

        const body: CreatePlayerRequest = await req.json()

        // Validate username
        if (!body.username || body.username.length < 3 || body.username.length > 30) {
          return errorResponse('Username must be 3-30 characters')
        }

        if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
          return errorResponse('Username can only contain letters, numbers, and underscores')
        }

        // Validate starter build
        const validBuilds = ['hustler', 'entrepreneur', 'community_kid']
        if (!body.starter_build || !validBuilds.includes(body.starter_build)) {
          return errorResponse('Invalid starter build. Choose: hustler, entrepreneur, or community_kid')
        }

        // Check if player already exists
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('id', user.id)
          .single()

        if (existingPlayer) {
          return errorResponse('Player profile already exists', 409)
        }

        // Check username availability (case-insensitive)
        const { data: usernameTaken } = await supabase
          .from('players')
          .select('id')
          .ilike('username', body.username)
          .single()

        if (usernameTaken) {
          return errorResponse('Username already taken', 409)
        }

        // Get starting district (validate it's a starter district)
        let startingDistrictId = 'scarborough' // Default

        if (body.starting_district) {
          const { data: district } = await supabase
            .from('districts')
            .select('id, is_starter_district')
            .eq('id', body.starting_district)
            .single()

          if (district && district.is_starter_district) {
            startingDistrictId = district.id
          }
        }

        // Determine starting bonuses based on build
        let startingCash = 500
        let startingRepCrime = 0
        let startingRepBusiness = 0
        let startingRepFamily = 0

        switch (body.starter_build) {
          case 'hustler':
            startingCash = 300
            startingRepCrime = 25
            break
          case 'entrepreneur':
            startingCash = 750
            startingRepBusiness = 25
            break
          case 'community_kid':
            startingCash = 400
            startingRepFamily = 50
            break
        }

        // Create player profile using RPC function
        const { data: createResult, error: createError } = await supabase.rpc('create_player_profile', {
          p_username: body.username,
          p_starter_build: body.starter_build,
          p_starting_district_id: startingDistrictId
        })

        if (createError) {
          console.error('Create player error:', createError)
          return errorResponse(createError.message || 'Failed to create player', 500)
        }

        // Apply build-specific bonuses
        if (body.starter_build !== 'hustler') {
          await supabase
            .from('players')
            .update({
              cash_balance: startingCash,
              rep_crime: startingRepCrime,
              rep_business: startingRepBusiness,
              rep_family: startingRepFamily,
            })
            .eq('id', user.id)
        }

        // Assign starter items based on build
        const starterItems: { id: string; quantity: number }[] = []

        switch (body.starter_build) {
          case 'hustler':
            starterItems.push(
              { id: 'switchblade', quantity: 1 },
              { id: 'burner_phone', quantity: 2 },
              { id: 'energy_drink', quantity: 3 }
            )
            break
          case 'entrepreneur':
            starterItems.push(
              { id: 'business_suit', quantity: 1 },
              { id: 'burner_phone', quantity: 1 },
              { id: 'meal', quantity: 3 }
            )
            break
          case 'community_kid':
            starterItems.push(
              { id: 'street_clothes', quantity: 1 },
              { id: 'burner_phone', quantity: 1 },
              { id: 'energy_drink', quantity: 5 }
            )
            break
        }

        // Insert starter items
        for (const item of starterItems) {
          await supabase
            .from('player_inventory')
            .insert({
              player_id: user.id,
              item_id: item.id,
              quantity: item.quantity,
              acquired_via: 'reward',
            })
            .onConflict('player_id,item_id')
            .ignore()
        }

        // Fetch complete player profile
        const { data: player } = await supabase
          .from('players')
          .select(`
            *,
            current_district:districts(id, name, description, difficulty)
          `)
          .eq('id', user.id)
          .single()

        // Log the event
        await supabase.from('game_events').insert({
          player_id: user.id,
          event_type: 'progression',
          event_subtype: 'player_created',
          district_id: startingDistrictId,
          metadata: {
            username: body.username,
            starter_build: body.starter_build,
            starting_district: startingDistrictId,
          },
        })

        return jsonResponse({ success: true, player }, 201)
      }

      // =========================================================================
      // GET PLAYER PROFILE
      // =========================================================================
      case 'get-profile': {
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405)
        }

        // Use RPC to get player with calculated energy
        const { data: playerData, error: playerError } = await supabase.rpc(
          'get_player_with_energy'
        )

        if (playerError) {
          if (playerError.message.includes('not found')) {
            return jsonResponse({ error: 'Player not found', needsSetup: true }, 404)
          }
          return errorResponse(playerError.message, 500)
        }

        // Get additional relations
        const { data: player } = await supabase
          .from('players')
          .select(`
            *,
            current_district:districts(id, name, description, difficulty, economy_level, police_presence, crime_rate),
            home_district:districts!players_home_district_id_fkey(id, name)
          `)
          .eq('id', user.id)
          .single()

        if (!player) {
          return jsonResponse({ error: 'Player not found', needsSetup: true }, 404)
        }

        // Get crew membership if any
        const { data: crewMembership } = await supabase
          .from('crew_members')
          .select(`
            role,
            joined_at,
            contribution_total,
            crew:crews(id, name, tag, level, member_count)
          `)
          .eq('player_id', user.id)
          .eq('is_active', true)
          .single()

        // Merge energy data
        const fullPlayer = {
          ...player,
          energy: playerData.current_energy,
          crew: crewMembership?.crew || null,
          crew_role: crewMembership?.role || null,
        }

        return jsonResponse({ player: fullPlayer })
      }

      // =========================================================================
      // UPDATE PLAYER PROFILE
      // =========================================================================
      case 'update-profile': {
        if (req.method !== 'PUT' && req.method !== 'PATCH') {
          return errorResponse('Method not allowed', 405)
        }

        const body: UpdateProfileRequest = await req.json()

        // Only allow updating specific fields
        const allowedFields = ['display_name', 'settings']
        const updates: Record<string, unknown> = {}

        for (const field of allowedFields) {
          if (body[field as keyof UpdateProfileRequest] !== undefined) {
            updates[field] = body[field as keyof UpdateProfileRequest]
          }
        }

        // Validate display_name if provided
        if (updates.display_name !== undefined) {
          const displayName = updates.display_name as string
          if (displayName && (displayName.length < 1 || displayName.length > 50)) {
            return errorResponse('Display name must be 1-50 characters')
          }
        }

        if (Object.keys(updates).length === 0) {
          return errorResponse('No valid fields to update')
        }

        const { data: player, error } = await supabase
          .from('players')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single()

        if (error) {
          return errorResponse('Failed to update profile', 500)
        }

        return jsonResponse({ success: true, player })
      }

      // =========================================================================
      // CHECK USERNAME AVAILABILITY
      // =========================================================================
      case 'check-username': {
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405)
        }

        const username = url.searchParams.get('username')

        if (!username || username.length < 3) {
          return errorResponse('Username must be at least 3 characters')
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          return errorResponse('Username can only contain letters, numbers, and underscores')
        }

        const { data: existing } = await supabase
          .from('players')
          .select('id')
          .ilike('username', username)
          .single()

        return jsonResponse({
          username,
          available: !existing,
        })
      }

      // =========================================================================
      // GET STARTER DISTRICTS
      // =========================================================================
      case 'starter-districts': {
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405)
        }

        const { data: districts, error } = await supabase
          .from('districts')
          .select('id, name, description, difficulty, economy_level, police_presence, crime_rate')
          .eq('is_starter_district', true)
          .order('difficulty', { ascending: true })

        if (error) {
          return errorResponse('Failed to fetch districts', 500)
        }

        return jsonResponse({ districts })
      }

      // =========================================================================
      // DELETE ACCOUNT (Soft delete - marks as banned)
      // =========================================================================
      case 'delete-account': {
        if (req.method !== 'DELETE') {
          return errorResponse('Method not allowed', 405)
        }

        // Soft delete - mark as banned with reason
        const { error } = await supabase
          .from('players')
          .update({
            is_banned: true,
            ban_reason: 'Account deleted by user request',
          })
          .eq('id', user.id)

        if (error) {
          return errorResponse('Failed to delete account', 500)
        }

        // Log the event
        await supabase.from('game_events').insert({
          player_id: user.id,
          event_type: 'system',
          event_subtype: 'account_deleted',
          metadata: {
            deleted_at: new Date().toISOString(),
          },
        })

        return jsonResponse({ success: true, message: 'Account marked for deletion' })
      }

      // =========================================================================
      // DEFAULT - Unknown action
      // =========================================================================
      default:
        return errorResponse(`Unknown action: ${action}`, 404)
    }
  } catch (error) {
    console.error('Auth handler error:', error)
    return errorResponse('Internal server error', 500)
  }
})
