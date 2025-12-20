// Street Legacy - Crew Actions Edge Function
// Handles crew creation, management, invites, and membership

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
      // CREATE CREW
      // =========================================================================
      case 'create': {
        const name = body.name as string
        const tag = body.tag as string
        const description = body.description as string | undefined

        if (!name || !tag) {
          return errorResponse('name and tag required')
        }

        // Validate tag format (2-5 uppercase letters/numbers)
        if (!/^[A-Z0-9]{2,5}$/.test(tag.toUpperCase())) {
          return errorResponse('Tag must be 2-5 uppercase letters/numbers')
        }

        // Validate name length
        if (name.length < 3 || name.length > 50) {
          return errorResponse('Crew name must be 3-50 characters')
        }

        const { data, error } = await supabase.rpc('create_crew', {
          p_name: name,
          p_tag: tag.toUpperCase(),
          p_description: description || null,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data, 201)
      }

      // =========================================================================
      // GET MY CREW
      // =========================================================================
      case 'my-crew': {
        const { data, error } = await supabase.rpc('get_my_crew')

        if (error) {
          if (error.message.includes('not in a crew')) {
            return jsonResponse({ crew: null, membership: null })
          }
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // GET CREW DETAILS
      // =========================================================================
      case 'get-crew': {
        const crewId = url.searchParams.get('id')

        if (!crewId) {
          // Get player's own crew
          const { data, error } = await supabase.rpc('get_my_crew')

          if (error) {
            return errorResponse(error.message)
          }

          return jsonResponse(data)
        }

        // Get specific crew (public info)
        const { data, error } = await supabase.rpc('get_crew_details', {
          p_crew_id: crewId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // GET CREW MEMBERS
      // =========================================================================
      case 'members': {
        const crewId = url.searchParams.get('crew_id')

        if (!crewId) {
          return errorResponse('crew_id required')
        }

        const { data, error } = await supabase.rpc('get_crew_members', {
          p_crew_id: crewId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ members: data })
      }

      // =========================================================================
      // INVITE PLAYER
      // =========================================================================
      case 'invite': {
        const playerId = body.player_id as string
        const message = body.message as string | undefined

        if (!playerId) {
          return errorResponse('player_id required')
        }

        const { data, error } = await supabase.rpc('invite_to_crew', {
          p_invited_player_id: playerId,
          p_message: message || null,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // ACCEPT INVITE
      // =========================================================================
      case 'accept-invite': {
        const inviteId = body.invite_id as string

        if (!inviteId) {
          return errorResponse('invite_id required')
        }

        const { data, error } = await supabase.rpc('accept_crew_invite', {
          p_invite_id: inviteId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // DECLINE INVITE
      // =========================================================================
      case 'decline-invite': {
        const inviteId = body.invite_id as string

        if (!inviteId) {
          return errorResponse('invite_id required')
        }

        const { data, error } = await supabase.rpc('decline_crew_invite', {
          p_invite_id: inviteId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // GET PENDING INVITES
      // =========================================================================
      case 'get-invites': {
        const { data, error } = await supabase.rpc('get_pending_crew_invites')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ invites: data })
      }

      // =========================================================================
      // LEAVE CREW
      // =========================================================================
      case 'leave': {
        const { data, error } = await supabase.rpc('leave_crew')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // KICK MEMBER
      // =========================================================================
      case 'kick': {
        const playerId = body.player_id as string

        if (!playerId) {
          return errorResponse('player_id required')
        }

        const { data, error } = await supabase.rpc('kick_crew_member', {
          p_target_player_id: playerId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // PROMOTE MEMBER
      // =========================================================================
      case 'promote': {
        const playerId = body.player_id as string

        if (!playerId) {
          return errorResponse('player_id required')
        }

        const { data, error } = await supabase.rpc('promote_crew_member', {
          p_target_player_id: playerId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // DEMOTE MEMBER
      // =========================================================================
      case 'demote': {
        const playerId = body.player_id as string

        if (!playerId) {
          return errorResponse('player_id required')
        }

        const { data, error } = await supabase.rpc('demote_crew_member', {
          p_target_player_id: playerId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // TRANSFER LEADERSHIP
      // =========================================================================
      case 'transfer-leadership': {
        const playerId = body.player_id as string

        if (!playerId) {
          return errorResponse('player_id required')
        }

        const { data, error } = await supabase.rpc('transfer_crew_leadership', {
          p_new_leader_id: playerId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // DISBAND CREW
      // =========================================================================
      case 'disband': {
        const { data, error } = await supabase.rpc('disband_crew')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // DEPOSIT TO VAULT
      // =========================================================================
      case 'deposit': {
        const amount = body.amount as number

        if (!amount || amount <= 0) {
          return errorResponse('Valid positive amount required')
        }

        const { data, error } = await supabase.rpc('deposit_to_crew_vault', {
          p_amount: Math.floor(amount),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // SET TAX RATE
      // =========================================================================
      case 'set-tax-rate': {
        const taxRate = body.tax_rate as number

        if (taxRate === undefined || taxRate < 0 || taxRate > 50) {
          return errorResponse('Tax rate must be between 0 and 50')
        }

        const { data, error } = await supabase.rpc('set_crew_tax_rate', {
          p_tax_rate: Math.floor(taxRate),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // UPDATE CREW SETTINGS
      // =========================================================================
      case 'update-settings': {
        // Get player's crew membership
        const { data: membership } = await supabase
          .from('crew_members')
          .select('crew_id, role')
          .eq('player_id', user.id)
          .eq('is_active', true)
          .single()

        if (!membership) {
          return errorResponse('Not in a crew', 403)
        }

        // Check if officer or higher
        const canEdit = ['leader', 'co_leader', 'officer'].includes(membership.role)
        if (!canEdit) {
          return errorResponse('Must be an officer or leader to update settings', 403)
        }

        // Build updates object
        const updates: Record<string, unknown> = {}

        if (body.description !== undefined) {
          updates.description = body.description
        }
        if (body.is_recruiting !== undefined) {
          updates.is_recruiting = body.is_recruiting
        }
        if (body.min_level_to_join !== undefined) {
          const minLevel = body.min_level_to_join as number
          if (minLevel < 1 || minLevel > 50) {
            return errorResponse('min_level_to_join must be 1-50')
          }
          updates.min_level_to_join = minLevel
        }
        if (body.min_rep_to_join !== undefined) {
          updates.min_rep_to_join = body.min_rep_to_join
        }
        if (body.emblem_data !== undefined) {
          updates.emblem_data = body.emblem_data
        }

        if (Object.keys(updates).length === 0) {
          return errorResponse('No valid fields to update')
        }

        const { data, error } = await supabase
          .from('crews')
          .update(updates)
          .eq('id', membership.crew_id)
          .select()
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ success: true, crew: data })
      }

      // =========================================================================
      // LIST RECRUITING CREWS
      // =========================================================================
      case 'list-recruiting': {
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        const { data: crews, error } = await supabase
          .from('crews')
          .select(`
            id, name, tag, description, level, member_count, max_members,
            crew_rep, is_recruiting, min_level_to_join, min_rep_to_join,
            emblem_data, created_at
          `)
          .eq('is_recruiting', true)
          .order('crew_rep', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ crews: crews || [] })
      }

      // =========================================================================
      // SEARCH CREWS
      // =========================================================================
      case 'search': {
        const query = url.searchParams.get('q')
        const limit = parseInt(url.searchParams.get('limit') || '20')

        if (!query || query.length < 2) {
          return errorResponse('Search query must be at least 2 characters')
        }

        const { data: crews, error } = await supabase
          .from('crews')
          .select(`
            id, name, tag, description, level, member_count,
            crew_rep, is_recruiting
          `)
          .or(`name.ilike.%${query}%,tag.ilike.%${query}%`)
          .order('crew_rep', { ascending: false })
          .limit(limit)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ crews: crews || [] })
      }

      // =========================================================================
      // CREW LEADERBOARD
      // =========================================================================
      case 'leaderboard': {
        const type = url.searchParams.get('type') || 'reputation'
        const limit = parseInt(url.searchParams.get('limit') || '50')

        let orderColumn: string
        switch (type) {
          case 'level':
            orderColumn = 'level'
            break
          case 'members':
            orderColumn = 'member_count'
            break
          case 'vault':
            orderColumn = 'vault_balance'
            break
          case 'reputation':
          default:
            orderColumn = 'crew_rep'
        }

        const { data: crews, error } = await supabase
          .from('crews')
          .select(`
            id, name, tag, level, member_count, crew_rep, vault_balance,
            territories_controlled, emblem_data
          `)
          .order(orderColumn, { ascending: false })
          .limit(limit)

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ crews: crews || [] })
      }

      // =========================================================================
      // DEFAULT
      // =========================================================================
      default:
        return errorResponse(`Unknown action: ${action}`, 404)
    }
  } catch (error) {
    console.error('Crew action error:', error)
    return errorResponse('Internal server error', 500)
  }
})
