// Street Legacy - Player Actions Edge Function
// Handles all gameplay actions: crimes, jobs, travel, banking, properties, businesses, missions

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
      // TRAVEL
      // =========================================================================
      case 'travel': {
        const districtId = body.district_id as string

        if (!districtId) {
          return errorResponse('district_id required')
        }

        const { data, error } = await supabase.rpc('travel_to_district', {
          p_district_id: districtId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // CRIMES
      // =========================================================================
      case 'commit-crime': {
        const crimeTypeId = body.crime_type_id as string

        if (!crimeTypeId) {
          return errorResponse('crime_type_id required')
        }

        const { data, error } = await supabase.rpc('attempt_crime', {
          p_crime_type_id: crimeTypeId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'get-crimes': {
        const { data, error } = await supabase.rpc('get_available_crimes')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ crimes: data })
      }

      case 'crime-history': {
        const limit = parseInt(url.searchParams.get('limit') || '20')

        const { data, error } = await supabase.rpc('get_crime_history', {
          p_limit: Math.min(limit, 100),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ history: data })
      }

      case 'crime-stats': {
        const { data, error } = await supabase.rpc('get_crime_stats')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ stats: data })
      }

      // =========================================================================
      // JOBS
      // =========================================================================
      case 'complete-job': {
        const jobTypeId = body.job_type_id as string

        if (!jobTypeId) {
          return errorResponse('job_type_id required')
        }

        const { data, error } = await supabase.rpc('complete_job', {
          p_job_type_id: jobTypeId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'get-jobs': {
        const { data, error } = await supabase.rpc('get_available_jobs')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ jobs: data })
      }

      case 'job-history': {
        const limit = parseInt(url.searchParams.get('limit') || '20')

        const { data, error } = await supabase.rpc('get_job_history', {
          p_limit: Math.min(limit, 100),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ history: data })
      }

      case 'job-stats': {
        const { data, error } = await supabase.rpc('get_job_stats')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ stats: data })
      }

      // =========================================================================
      // BANKING
      // =========================================================================
      case 'bank-deposit': {
        const amount = body.amount as number

        if (!amount || amount <= 0) {
          return errorResponse('Valid positive amount required')
        }

        const { data, error } = await supabase.rpc('bank_deposit', {
          p_amount: Math.floor(amount),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'bank-withdraw': {
        const amount = body.amount as number

        if (!amount || amount <= 0) {
          return errorResponse('Valid positive amount required')
        }

        const { data, error } = await supabase.rpc('bank_withdraw', {
          p_amount: Math.floor(amount),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // PROPERTIES
      // =========================================================================
      case 'get-properties': {
        const districtId = url.searchParams.get('district_id')

        if (districtId) {
          const { data, error } = await supabase.rpc('get_available_properties', {
            p_district_id: districtId,
          })

          if (error) {
            return errorResponse(error.message)
          }

          return jsonResponse({ properties: data })
        } else {
          const { data, error } = await supabase.rpc('get_player_properties')

          if (error) {
            return errorResponse(error.message)
          }

          return jsonResponse({ properties: data })
        }
      }

      case 'buy-property': {
        const propertyId = body.property_id as string

        if (!propertyId) {
          return errorResponse('property_id required')
        }

        const { data, error } = await supabase.rpc('buy_property', {
          p_property_id: propertyId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'sell-property': {
        const propertyId = body.property_id as string

        if (!propertyId) {
          return errorResponse('property_id required')
        }

        const { data, error } = await supabase.rpc('sell_property_to_system', {
          p_property_id: propertyId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'upgrade-property': {
        const propertyId = body.property_id as string

        if (!propertyId) {
          return errorResponse('property_id required')
        }

        const { data, error } = await supabase.rpc('upgrade_property', {
          p_property_id: propertyId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'repair-property': {
        const propertyId = body.property_id as string

        if (!propertyId) {
          return errorResponse('property_id required')
        }

        const { data, error } = await supabase.rpc('repair_property', {
          p_property_id: propertyId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'list-property': {
        const propertyId = body.property_id as string
        const askingPrice = body.asking_price as number

        if (!propertyId || !askingPrice) {
          return errorResponse('property_id and asking_price required')
        }

        const { data, error } = await supabase.rpc('list_property_for_sale', {
          p_property_id: propertyId,
          p_asking_price: Math.floor(askingPrice),
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // BUSINESSES
      // =========================================================================
      case 'get-business-types': {
        const { data, error } = await supabase.rpc('get_business_types')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ business_types: data })
      }

      case 'get-businesses': {
        const { data, error } = await supabase.rpc('get_player_businesses')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ businesses: data })
      }

      case 'open-business': {
        const propertyId = body.property_id as string
        const businessTypeId = body.business_type_id as string
        const customName = body.name as string | undefined

        if (!propertyId || !businessTypeId) {
          return errorResponse('property_id and business_type_id required')
        }

        const { data, error } = await supabase.rpc('open_business', {
          p_property_id: propertyId,
          p_business_type_id: businessTypeId,
          p_custom_name: customName || null,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'close-business': {
        const businessId = body.business_id as string

        if (!businessId) {
          return errorResponse('business_id required')
        }

        const { data, error } = await supabase.rpc('close_business', {
          p_business_id: businessId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'collect-income': {
        const businessId = body.business_id as string | undefined

        if (businessId) {
          const { data, error } = await supabase.rpc('collect_business_income', {
            p_business_id: businessId,
          })

          if (error) {
            return errorResponse(error.message)
          }

          return jsonResponse(data)
        } else {
          const { data, error } = await supabase.rpc('collect_all_business_income')

          if (error) {
            return errorResponse(error.message)
          }

          return jsonResponse(data)
        }
      }

      case 'hire-employee': {
        const businessId = body.business_id as string

        if (!businessId) {
          return errorResponse('business_id required')
        }

        const { data, error } = await supabase.rpc('hire_employee', {
          p_business_id: businessId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'fire-employee': {
        const businessId = body.business_id as string

        if (!businessId) {
          return errorResponse('business_id required')
        }

        const { data, error } = await supabase.rpc('fire_employee', {
          p_business_id: businessId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'upgrade-business': {
        const businessId = body.business_id as string

        if (!businessId) {
          return errorResponse('business_id required')
        }

        const { data, error } = await supabase.rpc('upgrade_business', {
          p_business_id: businessId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // MISSIONS
      // =========================================================================
      case 'get-missions': {
        const { data, error } = await supabase.rpc('get_player_missions')

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ missions: data })
      }

      case 'start-mission': {
        const missionId = body.mission_id as string

        if (!missionId) {
          return errorResponse('mission_id required')
        }

        const { data, error } = await supabase.rpc('start_mission', {
          p_mission_id: missionId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      case 'claim-mission-reward': {
        const playerMissionId = body.player_mission_id as string

        if (!playerMissionId) {
          return errorResponse('player_mission_id required')
        }

        const { data, error } = await supabase.rpc('claim_mission_reward', {
          p_player_mission_id: playerMissionId,
        })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse(data)
      }

      // =========================================================================
      // INVENTORY / ITEMS
      // =========================================================================
      case 'get-inventory': {
        const { data, error } = await supabase
          .from('player_inventory')
          .select(`
            quantity,
            durability,
            is_equipped,
            acquired_via,
            acquired_at,
            item:items(*)
          `)
          .eq('player_id', user.id)
          .gt('quantity', 0)
          .order('acquired_at', { ascending: false })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ inventory: data })
      }

      case 'equip-item': {
        const itemId = body.item_id as string

        if (!itemId) {
          return errorResponse('item_id required')
        }

        // Get item details
        const { data: item } = await supabase
          .from('items')
          .select('is_equippable, equip_slot')
          .eq('id', itemId)
          .single()

        if (!item || !item.is_equippable) {
          return errorResponse('Item cannot be equipped')
        }

        // Unequip any item in the same slot
        if (item.equip_slot) {
          await supabase
            .from('player_inventory')
            .update({ is_equipped: false })
            .eq('player_id', user.id)
            .eq('is_equipped', true)
            .in('item_id',
              supabase
                .from('items')
                .select('id')
                .eq('equip_slot', item.equip_slot)
            )
        }

        // Equip the new item
        const { data, error } = await supabase
          .from('player_inventory')
          .update({ is_equipped: true })
          .eq('player_id', user.id)
          .eq('item_id', itemId)
          .gt('quantity', 0)
          .select()
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ success: true, equipped: data })
      }

      case 'unequip-item': {
        const itemId = body.item_id as string

        if (!itemId) {
          return errorResponse('item_id required')
        }

        const { data, error } = await supabase
          .from('player_inventory')
          .update({ is_equipped: false })
          .eq('player_id', user.id)
          .eq('item_id', itemId)
          .select()
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ success: true, unequipped: data })
      }

      // =========================================================================
      // GAME STATE
      // =========================================================================
      case 'get-game-state': {
        // Fetch comprehensive game state in parallel
        const [
          playerResult,
          inventoryResult,
          propertiesResult,
          businessesResult,
          missionsResult,
          crimesResult,
          jobsResult,
          districtsResult,
          crewResult,
        ] = await Promise.all([
          supabase.rpc('get_player_with_energy'),
          supabase
            .from('player_inventory')
            .select('quantity, is_equipped, item:items(*)')
            .eq('player_id', user.id)
            .gt('quantity', 0),
          supabase.rpc('get_player_properties'),
          supabase.rpc('get_player_businesses'),
          supabase.rpc('get_player_missions'),
          supabase.rpc('get_available_crimes'),
          supabase.rpc('get_available_jobs'),
          supabase
            .from('districts')
            .select('*')
            .order('difficulty', { ascending: true }),
          supabase
            .from('crew_members')
            .select('role, crew:crews(*)')
            .eq('player_id', user.id)
            .eq('is_active', true)
            .single(),
        ])

        if (playerResult.error) {
          return errorResponse(playerResult.error.message)
        }

        // Get full player data
        const { data: playerFull } = await supabase
          .from('players')
          .select(`
            *,
            current_district:districts(*)
          `)
          .eq('id', user.id)
          .single()

        return jsonResponse({
          player: {
            ...playerFull,
            energy: playerResult.data?.current_energy,
          },
          inventory: inventoryResult.data || [],
          properties: propertiesResult.data || [],
          businesses: businessesResult.data || [],
          missions: missionsResult.data || [],
          crimes: crimesResult.data || [],
          jobs: jobsResult.data || [],
          districts: districtsResult.data || [],
          crew: crewResult.data?.crew || null,
          crew_role: crewResult.data?.role || null,
          serverTime: new Date().toISOString(),
        })
      }

      // =========================================================================
      // DISTRICTS
      // =========================================================================
      case 'get-districts': {
        const { data, error } = await supabase
          .from('districts')
          .select('*')
          .order('difficulty', { ascending: true })

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ districts: data })
      }

      case 'get-district': {
        const districtId = url.searchParams.get('district_id')

        if (!districtId) {
          return errorResponse('district_id required')
        }

        const { data, error } = await supabase
          .from('districts')
          .select(`
            *,
            controlling_crew:crews(id, name, tag)
          `)
          .eq('id', districtId)
          .single()

        if (error) {
          return errorResponse(error.message)
        }

        return jsonResponse({ district: data })
      }

      // =========================================================================
      // DEFAULT
      // =========================================================================
      default:
        return errorResponse(`Unknown action: ${action}`, 404)
    }
  } catch (error) {
    console.error('Player action error:', error)
    return errorResponse('Internal server error', 500)
  }
})
