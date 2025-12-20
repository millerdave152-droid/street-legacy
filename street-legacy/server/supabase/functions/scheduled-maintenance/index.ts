// Street Legacy - Scheduled Maintenance Edge Function
// Called by external scheduler (cron job, GitHub Actions, etc.)
// Requires SCHEDULER_SECRET for authentication instead of user JWT

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Verify scheduler secret
    const authHeader = req.headers.get('Authorization')
    const schedulerSecret = Deno.env.get('SCHEDULER_SECRET')

    if (!schedulerSecret) {
      console.error('SCHEDULER_SECRET not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!authHeader || authHeader !== `Bearer ${schedulerSecret}`) {
      console.warn('Unauthorized scheduler access attempt')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const jobType = url.searchParams.get('job') || 'hourly'

    console.log(`Starting scheduled job: ${jobType}`)

    let result: Record<string, unknown>

    switch (jobType) {
      // =========================================================================
      // HOURLY MAINTENANCE
      // =========================================================================
      case 'hourly': {
        const { data, error } = await supabase.rpc('run_hourly_maintenance')

        if (error) {
          console.error('Hourly maintenance error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'hourly' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'hourly', ...data }
        break
      }

      // =========================================================================
      // DAILY MAINTENANCE
      // =========================================================================
      case 'daily': {
        const { data, error } = await supabase.rpc('run_daily_maintenance')

        if (error) {
          console.error('Daily maintenance error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'daily' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'daily', ...data }
        break
      }

      // =========================================================================
      // WEEKLY MAINTENANCE
      // =========================================================================
      case 'weekly': {
        const { data, error } = await supabase.rpc('run_weekly_maintenance')

        if (error) {
          console.error('Weekly maintenance error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'weekly' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'weekly', ...data }
        break
      }

      // =========================================================================
      // ENERGY REGENERATION (every 10 minutes)
      // =========================================================================
      case 'energy-regen': {
        const { data, error } = await supabase.rpc('regenerate_player_energy')

        if (error) {
          console.error('Energy regen error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'energy-regen' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'energy-regen', ...data }
        break
      }

      // =========================================================================
      // BUSINESS INCOME ACCUMULATION (every hour)
      // =========================================================================
      case 'business-income': {
        const { data, error } = await supabase.rpc('accumulate_business_income')

        if (error) {
          console.error('Business income error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'business-income' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'business-income', ...data }
        break
      }

      // =========================================================================
      // HEAT DECAY (can be run independently)
      // =========================================================================
      case 'heat-decay': {
        const { data, error } = await supabase.rpc('process_heat_decay')

        if (error) {
          console.error('Heat decay error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'heat-decay' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'heat-decay', ...data }
        break
      }

      // =========================================================================
      // MISSION EXPIRATIONS
      // =========================================================================
      case 'mission-expire': {
        const { data, error } = await supabase.rpc('check_mission_expirations')

        if (error) {
          console.error('Mission expiration error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'mission-expire' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'mission-expire', ...data }
        break
      }

      // =========================================================================
      // JAIL RELEASES
      // =========================================================================
      case 'jail-release': {
        const { data, error } = await supabase.rpc('process_jail_releases')

        if (error) {
          console.error('Jail release error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'jail-release' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'jail-release', ...data }
        break
      }

      // =========================================================================
      // PROPERTY TAXES (daily)
      // =========================================================================
      case 'property-tax': {
        const { data, error } = await supabase.rpc('collect_property_taxes')

        if (error) {
          console.error('Property tax error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'property-tax' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'property-tax', ...data }
        break
      }

      // =========================================================================
      // CLEANUP OLD DATA (weekly)
      // =========================================================================
      case 'cleanup': {
        const { data, error } = await supabase.rpc('cleanup_old_events')

        if (error) {
          console.error('Cleanup error:', error)
          return new Response(
            JSON.stringify({ error: error.message, job: 'cleanup' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = { job: 'cleanup', ...data }
        break
      }

      // =========================================================================
      // HEALTH CHECK
      // =========================================================================
      case 'health': {
        // Simple health check - verify database connection
        const { data, error } = await supabase
          .from('districts')
          .select('id')
          .limit(1)

        if (error) {
          return new Response(
            JSON.stringify({ status: 'unhealthy', error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        result = {
          job: 'health',
          status: 'healthy',
          database: 'connected',
          timestamp: new Date().toISOString(),
        }
        break
      }

      // =========================================================================
      // UNKNOWN JOB
      // =========================================================================
      default:
        return new Response(
          JSON.stringify({
            error: 'Unknown job type',
            valid_jobs: [
              'hourly',
              'daily',
              'weekly',
              'energy-regen',
              'business-income',
              'heat-decay',
              'mission-expire',
              'jail-release',
              'property-tax',
              'cleanup',
              'health',
            ],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const duration = Date.now() - startTime
    console.log(`Scheduled job ${jobType} completed in ${duration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        result,
        duration_ms: duration,
        completed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Scheduled maintenance error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
