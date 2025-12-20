// Street Legacy - Admin Actions Edge Function
// Administrative operations for game management
// Requires authenticated user with is_admin = true

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

    // Check if user is admin
    const { data: player } = await supabase
      .from('players')
      .select('is_banned, settings')
      .eq('id', user.id)
      .single()

    // Check admin status from settings JSONB field (is_admin might not exist as column)
    const isAdmin = player?.settings?.is_admin === true

    if (!isAdmin) {
      return errorResponse('Admin access required', 403)
    }

    if (player?.is_banned) {
      return errorResponse('Account is banned', 403)
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
      // GET GAME STATISTICS
      // =========================================================================
      case 'get-stats': {
        const [
          playersResult,
          activePlayersResult,
          crewsResult,
          propertiesResult,
          claimedPropertiesResult,
          businessesResult,
          transactionsResult,
        ] = await Promise.all([
          supabase.from('players').select('*', { count: 'exact', head: true }),
          supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from('crews')
            .select('*', { count: 'exact', head: true })
            .gt('member_count', 0),
          supabase.from('properties').select('*', { count: 'exact', head: true }),
          supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .not('owner_id', 'is', null),
          supabase
            .from('businesses')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open'),
          supabase
            .from('transactions')
            .select('amount, domain')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        ])

        // Calculate economy stats
        const economyStats = (transactionsResult.data || []).reduce(
          (acc, t) => {
            if (t.amount > 0) acc.totalEarned += t.amount
            else acc.totalSpent += Math.abs(t.amount)
            acc.transactionCount++
            return acc
          },
          { totalEarned: 0, totalSpent: 0, transactionCount: 0 }
        )

        return jsonResponse({
          players: {
            total: playersResult.count || 0,
            active24h: activePlayersResult.count || 0,
          },
          crews: {
            total: crewsResult.count || 0,
          },
          properties: {
            total: propertiesResult.count || 0,
            claimed: claimedPropertiesResult.count || 0,
          },
          businesses: {
            active: businessesResult.count || 0,
          },
          economy24h: economyStats,
        })
      }

      // =========================================================================
      // GET PLAYERS LIST
      // =========================================================================
      case 'get-players': {
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
        const search = url.searchParams.get('search')
        const offset = (page - 1) * limit

        let query = supabase
          .from('players')
          .select(
            `
            id, username, display_name, level, xp,
            cash_balance, bank_balance,
            rep_crime, rep_business,
            is_banned, ban_reason,
            created_at, updated_at,
            current_district:districts(id, name)
          `,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (search) {
          query = query.ilike('username', `%${search}%`)
        }

        const { data: players, count, error } = await query

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({
          players: players || [],
          total: count || 0,
          page,
          totalPages: Math.ceil((count || 0) / limit),
        })
      }

      // =========================================================================
      // GET PLAYER DETAILS
      // =========================================================================
      case 'get-player': {
        const playerId = url.searchParams.get('id')

        if (!playerId) {
          return errorResponse('Player ID required')
        }

        const { data: playerData, error } = await supabase
          .from('players')
          .select(
            `
            *,
            current_district:districts(id, name),
            home_district:districts!players_home_district_id_fkey(id, name)
          `
          )
          .eq('id', playerId)
          .single()

        if (error || !playerData) {
          return errorResponse('Player not found', 404)
        }

        // Get additional data
        const [propertiesResult, businessesResult, crewResult] = await Promise.all([
          supabase
            .from('properties')
            .select('id, name, parcel_code, current_value, district_id')
            .eq('owner_id', playerId),
          supabase
            .from('businesses')
            .select('id, name, business_type_id, status, total_revenue')
            .eq('owner_id', playerId),
          supabase
            .from('crew_members')
            .select('role, crew:crews(id, name, tag)')
            .eq('player_id', playerId)
            .eq('is_active', true)
            .single(),
        ])

        return jsonResponse({
          player: playerData,
          properties: propertiesResult.data || [],
          businesses: businessesResult.data || [],
          crew: crewResult.data?.crew || null,
          crew_role: crewResult.data?.role || null,
        })
      }

      // =========================================================================
      // BAN PLAYER
      // =========================================================================
      case 'ban-player': {
        const playerId = body.player_id as string
        const reason = body.reason as string
        const durationHours = body.duration_hours as number | undefined

        if (!playerId) {
          return errorResponse('player_id required')
        }

        // Prevent self-ban
        if (playerId === user.id) {
          return errorResponse('Cannot ban yourself')
        }

        const banUntil = durationHours
          ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
          : null // null = permanent

        const { error } = await supabase
          .from('players')
          .update({
            is_banned: true,
            ban_reason: reason || 'Violation of terms of service',
          })
          .eq('id', playerId)

        if (error) {
          return errorResponse(error.message)
        }

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: playerId,
          event_type: 'admin',
          event_subtype: 'player_banned',
          metadata: {
            banned_by: user.id,
            reason,
            duration_hours: durationHours,
            ban_until: banUntil,
            permanent: !durationHours,
          },
        })

        return jsonResponse({ success: true, ban_until: banUntil })
      }

      // =========================================================================
      // UNBAN PLAYER
      // =========================================================================
      case 'unban-player': {
        const playerId = body.player_id as string

        if (!playerId) {
          return errorResponse('player_id required')
        }

        const { error } = await supabase
          .from('players')
          .update({
            is_banned: false,
            ban_reason: null,
          })
          .eq('id', playerId)

        if (error) {
          return errorResponse(error.message)
        }

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: playerId,
          event_type: 'admin',
          event_subtype: 'player_unbanned',
          metadata: { unbanned_by: user.id },
        })

        return jsonResponse({ success: true })
      }

      // =========================================================================
      // ADJUST PLAYER BALANCE
      // =========================================================================
      case 'adjust-balance': {
        const playerId = body.player_id as string
        const amount = body.amount as number
        const reason = body.reason as string
        const balanceType = (body.balance_type as string) || 'cash'

        if (!playerId || amount === undefined) {
          return errorResponse('player_id and amount required')
        }

        const column = balanceType === 'bank' ? 'bank_balance' : 'cash_balance'

        // Get current balance
        const { data: playerData } = await supabase
          .from('players')
          .select(column)
          .eq('id', playerId)
          .single()

        if (!playerData) {
          return errorResponse('Player not found', 404)
        }

        const currentBalance = (playerData[column] as number) || 0
        const newBalance = Math.max(0, currentBalance + amount)

        const { error } = await supabase
          .from('players')
          .update({ [column]: newBalance })
          .eq('id', playerId)

        if (error) {
          return errorResponse(error.message)
        }

        // Log transaction
        await supabase.from('transactions').insert({
          player_id: playerId,
          domain: 'system',
          currency: balanceType,
          amount: amount,
          balance_after: newBalance,
          description: reason || 'Admin balance adjustment',
        })

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: playerId,
          event_type: 'admin',
          event_subtype: 'balance_adjusted',
          value_numeric: amount,
          metadata: {
            adjusted_by: user.id,
            amount,
            balance_type: balanceType,
            reason,
            old_balance: currentBalance,
            new_balance: newBalance,
          },
        })

        return jsonResponse({ success: true, new_balance: newBalance })
      }

      // =========================================================================
      // SET PLAYER LEVEL
      // =========================================================================
      case 'set-level': {
        const playerId = body.player_id as string
        const level = body.level as number

        if (!playerId || !level) {
          return errorResponse('player_id and level required')
        }

        if (level < 1 || level > 50) {
          return errorResponse('Level must be between 1 and 50')
        }

        const { error } = await supabase
          .from('players')
          .update({ level, xp: 0 })
          .eq('id', playerId)

        if (error) {
          return errorResponse(error.message)
        }

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: playerId,
          event_type: 'admin',
          event_subtype: 'level_set',
          value_numeric: level,
          metadata: { set_by: user.id, new_level: level },
        })

        return jsonResponse({ success: true })
      }

      // =========================================================================
      // BROADCAST MESSAGE
      // =========================================================================
      case 'broadcast-message': {
        const message = body.message as string
        const targetDistrict = body.district_id as string | undefined

        if (!message) {
          return errorResponse('message required')
        }

        if (message.length > 500) {
          return errorResponse('Message too long (max 500 characters)')
        }

        // Get target players
        let playersQuery = supabase
          .from('players')
          .select('id')
          .eq('is_banned', false)
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        if (targetDistrict) {
          playersQuery = playersQuery.eq('current_district_id', targetDistrict)
        }

        const { data: targetPlayers } = await playersQuery

        if (targetPlayers && targetPlayers.length > 0) {
          // Insert system messages
          const messages = targetPlayers.map((p) => ({
            from_player_id: user.id,
            to_player_id: p.id,
            content: `[SYSTEM] ${message}`,
          }))

          // Insert in batches to avoid timeout
          const batchSize = 100
          for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize)
            await supabase.from('player_messages').insert(batch)
          }
        }

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: user.id,
          event_type: 'admin',
          event_subtype: 'broadcast_sent',
          district_id: targetDistrict || null,
          metadata: {
            message,
            recipients_count: targetPlayers?.length || 0,
            target_district: targetDistrict,
          },
        })

        return jsonResponse({
          success: true,
          recipients: targetPlayers?.length || 0,
        })
      }

      // =========================================================================
      // GET GAME EVENTS
      // =========================================================================
      case 'get-events': {
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)
        const eventType = url.searchParams.get('type')
        const playerId = url.searchParams.get('player_id')
        const offset = (page - 1) * limit

        let query = supabase
          .from('game_events')
          .select(
            `
            id, event_type, event_subtype, value_numeric, metadata, created_at,
            player:players(id, username)
          `,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (eventType) {
          query = query.eq('event_type', eventType)
        }

        if (playerId) {
          query = query.eq('player_id', playerId)
        }

        const { data: events, count, error } = await query

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({
          events: events || [],
          total: count || 0,
          page,
          totalPages: Math.ceil((count || 0) / limit),
        })
      }

      // =========================================================================
      // RESET PLAYER
      // =========================================================================
      case 'reset-player': {
        const playerId = body.player_id as string
        const keepUsername = body.keep_username !== false

        if (!playerId) {
          return errorResponse('player_id required')
        }

        // Prevent self-reset
        if (playerId === user.id) {
          return errorResponse('Cannot reset yourself')
        }

        // Get starter district
        const { data: starterDistrict } = await supabase
          .from('districts')
          .select('id')
          .eq('is_starter_district', true)
          .limit(1)
          .single()

        const startingDistrictId = starterDistrict?.id || 'scarborough'

        // Reset player stats
        const { error } = await supabase
          .from('players')
          .update({
            level: 1,
            xp: 0,
            cash_balance: 500,
            bank_balance: 0,
            rep_crime: 0,
            rep_business: 0,
            rep_family: 0,
            heat_level: 0,
            energy: 100,
            properties_owned: 0,
            crimes_committed: 0,
            crimes_succeeded: 0,
            total_earnings: 0,
            total_spent: 0,
            current_district_id: startingDistrictId,
            home_district_id: startingDistrictId,
            newbie_protected: true,
            newbie_protection_until: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
          .eq('id', playerId)

        if (error) {
          return errorResponse(error.message)
        }

        // Clear player's properties
        await supabase
          .from('properties')
          .update({
            owner_id: null,
            claimed_at: null,
            purchase_price: null,
            is_for_sale: false,
            sale_price: null,
          })
          .eq('owner_id', playerId)

        // Delete player's businesses
        await supabase.from('businesses').delete().eq('owner_id', playerId)

        // Clear inventory
        await supabase.from('player_inventory').delete().eq('player_id', playerId)

        // Clear missions
        await supabase.from('player_missions').delete().eq('player_id', playerId)

        // Remove from crew
        await supabase
          .from('crew_members')
          .update({ is_active: false, left_at: new Date().toISOString() })
          .eq('player_id', playerId)

        // Clear cooldowns
        await supabase.from('player_cooldowns').delete().eq('player_id', playerId)

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: playerId,
          event_type: 'admin',
          event_subtype: 'player_reset',
          metadata: { reset_by: user.id },
        })

        return jsonResponse({ success: true })
      }

      // =========================================================================
      // TRIGGER MAINTENANCE JOB
      // =========================================================================
      case 'run-maintenance': {
        const jobType = body.job_type as string

        if (!jobType) {
          return errorResponse('job_type required')
        }

        const validJobs = ['hourly', 'daily', 'weekly']
        if (!validJobs.includes(jobType)) {
          return errorResponse(`Invalid job type. Use: ${validJobs.join(', ')}`)
        }

        const rpcName = `run_${jobType}_maintenance`
        const { data, error } = await supabase.rpc(rpcName)

        if (error) {
          return errorResponse(error.message)
        }

        // Log admin action
        await supabase.from('game_events').insert({
          player_id: user.id,
          event_type: 'admin',
          event_subtype: 'maintenance_triggered',
          metadata: { job_type: jobType, result: data },
        })

        return jsonResponse({ success: true, result: data })
      }

      // =========================================================================
      // DEFAULT
      // =========================================================================
      default:
        return errorResponse(`Unknown action: ${action}`, 404)
    }
  } catch (error) {
    console.error('Admin action error:', error)
    return errorResponse('Internal server error', 500)
  }
})
