// Street Legacy - Social Actions Edge Function
// Handles messaging, relationships, chat, player search, and leaderboards

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, getAuthenticatedUser } from '../_shared/auth.ts'

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

    // Parse request body for POST/PUT methods
    let body: Record<string, unknown> = {}
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        body = await req.json()
      } catch {
        // Empty body is ok for some endpoints
      }
    }

    switch (action) {
      // =========================================================================
      // SEND DIRECT MESSAGE
      // =========================================================================
      case 'send-message': {
        const toPlayerId = body.to_player_id as string
        const content = body.content as string

        if (!toPlayerId || !content) {
          return errorResponse('to_player_id and content required')
        }

        if (content.length > 500) {
          return errorResponse('Message too long (max 500 characters)')
        }

        if (toPlayerId === user.id) {
          return errorResponse('Cannot send message to yourself')
        }

        // Check if blocked by recipient
        const { data: blocked } = await supabase
          .from('player_relationships')
          .select('id')
          .eq('player_id', toPlayerId)
          .eq('target_player_id', user.id)
          .eq('relationship_type', 'blocked')
          .single()

        if (blocked) {
          return errorResponse('Cannot send message to this player', 403)
        }

        // Check if recipient exists
        const { data: recipient } = await supabase
          .from('players')
          .select('id, username')
          .eq('id', toPlayerId)
          .single()

        if (!recipient) {
          return errorResponse('Player not found', 404)
        }

        const { data: message, error } = await supabase
          .from('player_messages')
          .insert({
            from_player_id: user.id,
            to_player_id: toPlayerId,
            content: content.trim(),
          })
          .select()
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ success: true, message })
      }

      // =========================================================================
      // GET MESSAGES WITH PLAYER
      // =========================================================================
      case 'get-messages': {
        const withPlayerId = url.searchParams.get('with')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
        const before = url.searchParams.get('before')

        if (!withPlayerId) {
          return errorResponse('with parameter required (player ID)')
        }

        let query = supabase
          .from('player_messages')
          .select(`
            id, content, is_read, created_at,
            from_player_id, to_player_id
          `)
          .or(
            `and(from_player_id.eq.${user.id},to_player_id.eq.${withPlayerId}),` +
            `and(from_player_id.eq.${withPlayerId},to_player_id.eq.${user.id})`
          )
          .order('created_at', { ascending: false })
          .limit(limit)

        if (before) {
          query = query.lt('created_at', before)
        }

        const { data: messages, error } = await query

        if (error) {
          return errorResponse(error.message)
        }

        // Mark received messages as read
        if (messages && messages.length > 0) {
          const unreadIds = messages
            .filter((m) => m.to_player_id === user.id && !m.is_read)
            .map((m) => m.id)

          if (unreadIds.length > 0) {
            await supabase
              .from('player_messages')
              .update({ is_read: true })
              .in('id', unreadIds)
          }
        }

        return jsonResponse({ messages: (messages || []).reverse() })
      }

      // =========================================================================
      // GET CONVERSATIONS LIST
      // =========================================================================
      case 'get-conversations': {
        const { data: conversations, error } = await supabase.rpc(
          'get_player_conversations',
          { p_player_id: user.id }
        )

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ conversations: conversations || [] })
      }

      // =========================================================================
      // GET UNREAD COUNT
      // =========================================================================
      case 'unread-count': {
        const { count, error } = await supabase
          .from('player_messages')
          .select('*', { count: 'exact', head: true })
          .eq('to_player_id', user.id)
          .eq('is_read', false)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ unread_count: count || 0 })
      }

      // =========================================================================
      // SEND DISTRICT CHAT MESSAGE
      // =========================================================================
      case 'district-chat': {
        const content = body.content as string

        if (!content) {
          return errorResponse('content required')
        }

        if (content.length > 300) {
          return errorResponse('Message too long (max 300 characters)')
        }

        // Get player's current district
        const { data: player } = await supabase
          .from('players')
          .select('current_district_id, username')
          .eq('id', user.id)
          .single()

        if (!player?.current_district_id) {
          return errorResponse('Player not in a district')
        }

        const { data: message, error } = await supabase
          .from('district_chat')
          .insert({
            district_id: player.current_district_id,
            player_id: user.id,
            content: content.trim(),
          })
          .select(`
            id, content, created_at, district_id
          `)
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({
          success: true,
          message: {
            ...message,
            player: { id: user.id, username: player.username },
          },
        })
      }

      // =========================================================================
      // GET DISTRICT CHAT
      // =========================================================================
      case 'get-district-chat': {
        const districtId = url.searchParams.get('district_id')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
        const before = url.searchParams.get('before')

        // Use provided district or player's current district
        let targetDistrict = districtId

        if (!targetDistrict) {
          const { data: player } = await supabase
            .from('players')
            .select('current_district_id')
            .eq('id', user.id)
            .single()

          targetDistrict = player?.current_district_id
        }

        if (!targetDistrict) {
          return errorResponse('No district specified')
        }

        let query = supabase
          .from('district_chat')
          .select(`
            id, content, created_at, district_id,
            player:players(id, username, level)
          `)
          .eq('district_id', targetDistrict)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (before) {
          query = query.lt('created_at', before)
        }

        const { data: messages, error } = await query

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ messages: (messages || []).reverse() })
      }

      // =========================================================================
      // SET RELATIONSHIP
      // =========================================================================
      case 'set-relationship': {
        const targetPlayerId = body.target_player_id as string
        const relationshipType = body.relationship_type as string

        if (!targetPlayerId || !relationshipType) {
          return errorResponse('target_player_id and relationship_type required')
        }

        const validTypes = ['friend', 'blocked', 'rival']
        if (!validTypes.includes(relationshipType)) {
          return errorResponse('Invalid relationship type. Use: friend, blocked, or rival')
        }

        if (targetPlayerId === user.id) {
          return errorResponse('Cannot set relationship with yourself')
        }

        // Check if target player exists
        const { data: targetPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('id', targetPlayerId)
          .single()

        if (!targetPlayer) {
          return errorResponse('Player not found', 404)
        }

        const { data, error } = await supabase
          .from('player_relationships')
          .upsert(
            {
              player_id: user.id,
              target_player_id: targetPlayerId,
              relationship_type: relationshipType,
            },
            {
              onConflict: 'player_id,target_player_id',
            }
          )
          .select()
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ success: true, relationship: data })
      }

      // =========================================================================
      // REMOVE RELATIONSHIP
      // =========================================================================
      case 'remove-relationship': {
        const targetPlayerId = body.target_player_id as string

        if (!targetPlayerId) {
          return errorResponse('target_player_id required')
        }

        const { error } = await supabase
          .from('player_relationships')
          .delete()
          .eq('player_id', user.id)
          .eq('target_player_id', targetPlayerId)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ success: true })
      }

      // =========================================================================
      // GET RELATIONSHIPS
      // =========================================================================
      case 'get-relationships': {
        const type = url.searchParams.get('type')

        let query = supabase
          .from('player_relationships')
          .select(`
            relationship_type, created_at,
            target_player:players!player_relationships_target_player_id_fkey(
              id, username, level
            )
          `)
          .eq('player_id', user.id)

        if (type && ['friend', 'blocked', 'rival'].includes(type)) {
          query = query.eq('relationship_type', type)
        }

        const { data: relationships, error } = await query

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ relationships: relationships || [] })
      }

      // =========================================================================
      // SEARCH PLAYERS
      // =========================================================================
      case 'search-players': {
        const query = url.searchParams.get('q')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

        if (!query || query.length < 2) {
          return errorResponse('Search query must be at least 2 characters')
        }

        const { data: players, error } = await supabase
          .from('players')
          .select(`
            id, username, display_name, level,
            rep_crime, rep_business
          `)
          .ilike('username', `%${query}%`)
          .neq('id', user.id)
          .eq('is_banned', false)
          .order('level', { ascending: false })
          .limit(limit)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ players: players || [] })
      }

      // =========================================================================
      // GET PLAYER PROFILE
      // =========================================================================
      case 'get-player-profile': {
        const playerId = url.searchParams.get('id')

        if (!playerId) {
          return errorResponse('Player ID required')
        }

        const { data: player, error } = await supabase
          .from('players')
          .select(`
            id, username, display_name, level, xp,
            rep_crime, rep_business, rep_family,
            properties_owned, total_earnings,
            created_at,
            current_district:districts(id, name)
          `)
          .eq('id', playerId)
          .eq('is_banned', false)
          .single()

        if (error || !player) {
          return errorResponse('Player not found', 404)
        }

        // Get crew membership if any
        const { data: crewMembership } = await supabase
          .from('crew_members')
          .select(`
            role,
            crew:crews(id, name, tag)
          `)
          .eq('player_id', playerId)
          .eq('is_active', true)
          .single()

        // Get relationship with this player
        const { data: relationship } = await supabase
          .from('player_relationships')
          .select('relationship_type')
          .eq('player_id', user.id)
          .eq('target_player_id', playerId)
          .single()

        return jsonResponse({
          player: {
            ...player,
            crew: crewMembership?.crew || null,
            crew_role: crewMembership?.role || null,
          },
          relationship: relationship?.relationship_type || null,
        })
      }

      // =========================================================================
      // GET LEADERBOARD
      // =========================================================================
      case 'get-leaderboard': {
        const type = url.searchParams.get('type') || 'level'
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)

        let orderColumn: string
        switch (type) {
          case 'earnings':
            orderColumn = 'total_earnings'
            break
          case 'properties':
            orderColumn = 'properties_owned'
            break
          case 'crime_rep':
            orderColumn = 'rep_crime'
            break
          case 'business_rep':
            orderColumn = 'rep_business'
            break
          case 'crimes':
            orderColumn = 'crimes_committed'
            break
          case 'level':
          default:
            orderColumn = 'level'
        }

        const { data: players, error } = await supabase
          .from('players')
          .select(`
            id, username, level, xp,
            rep_crime, rep_business,
            total_earnings, properties_owned, crimes_committed
          `)
          .eq('is_banned', false)
          .order(orderColumn, { ascending: false })
          .order('xp', { ascending: false })
          .limit(limit)

        if (error) {
          return errorResponse(error.message)
        }

        // Get current player's rank
        const { data: playerRank } = await supabase.rpc('get_player_rank', {
          p_player_id: user.id,
          p_order_column: orderColumn,
        })

        return jsonResponse({
          players: players || [],
          current_player_rank: playerRank || null,
          leaderboard_type: type,
        })
      }

      // =========================================================================
      // GET NEARBY PLAYERS (same district)
      // =========================================================================
      case 'nearby-players': {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

        // Get player's current district
        const { data: player } = await supabase
          .from('players')
          .select('current_district_id')
          .eq('id', user.id)
          .single()

        if (!player?.current_district_id) {
          return errorResponse('Player not in a district')
        }

        const { data: nearbyPlayers, error } = await supabase
          .from('players')
          .select(`
            id, username, level,
            rep_crime, rep_business
          `)
          .eq('current_district_id', player.current_district_id)
          .neq('id', user.id)
          .eq('is_banned', false)
          .order('level', { ascending: false })
          .limit(limit)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({
          players: nearbyPlayers || [],
          district_id: player.current_district_id,
        })
      }

      // =========================================================================
      // DEFAULT
      // =========================================================================
      default:
        return errorResponse(`Unknown action: ${action}`, 404)
    }
  } catch (error) {
    console.error('Social action error:', error)
    return errorResponse('Internal server error', 500)
  }
})
