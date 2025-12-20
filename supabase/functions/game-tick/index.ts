// Street Legacy: Game Tick Edge Function
// Processes periodic game updates (income, cooldowns, events)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TickResult {
  playersProcessed: number;
  businessesProcessed: number;
  totalIncomeDistributed: number;
  jailReleasesProcessed: number;
  hospitalReleasesProcessed: number;
  heatDecayed: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: TickResult = {
      playersProcessed: 0,
      businessesProcessed: 0,
      totalIncomeDistributed: 0,
      jailReleasesProcessed: 0,
      hospitalReleasesProcessed: 0,
      heatDecayed: 0,
    };

    const now = new Date();

    // ========================================================================
    // 1. Process Business Income
    // ========================================================================
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id, owner_id, income_per_tick, operating_cost, last_collection_at, is_operational")
      .eq("is_operational", true);

    if (bizError) throw bizError;

    for (const business of businesses || []) {
      if (!business.owner_id) continue;

      const netIncome = business.income_per_tick - business.operating_cost;

      if (netIncome > 0) {
        // Add income to player's cash
        const { error: updateError } = await supabase.rpc("add_player_cash", {
          p_player_id: business.owner_id,
          p_amount: netIncome,
        });

        if (!updateError) {
          result.businessesProcessed++;
          result.totalIncomeDistributed += netIncome;

          // Update last collection time
          await supabase
            .from("businesses")
            .update({ last_collection_at: now.toISOString() })
            .eq("id", business.id);

          // Log transaction
          await supabase.from("transactions").insert({
            player_id: business.owner_id,
            transaction_type: "business_income",
            amount: netIncome,
            balance_after: 0, // Will be updated by trigger
            reference_type: "business",
            reference_id: business.id,
            description: `Income from business`,
          });
        }
      }
    }

    // ========================================================================
    // 2. Process Jail Releases
    // ========================================================================
    const { data: jailedPlayers, error: jailError } = await supabase
      .from("players")
      .select("id")
      .eq("is_in_jail", true)
      .lte("jail_release_at", now.toISOString());

    if (jailError) throw jailError;

    for (const player of jailedPlayers || []) {
      const { error: releaseError } = await supabase
        .from("players")
        .update({
          is_in_jail: false,
          jail_release_at: null,
          heat: 0, // Reset heat on release
        })
        .eq("id", player.id);

      if (!releaseError) {
        result.jailReleasesProcessed++;

        // Log event
        await supabase.from("game_events").insert({
          event_type: "jail_release",
          actor_id: player.id,
          is_public: false,
          data: { automatic: true },
        });
      }
    }

    // ========================================================================
    // 3. Process Hospital Releases
    // ========================================================================
    const { data: hospitalizedPlayers, error: hospitalError } = await supabase
      .from("players")
      .select("id")
      .eq("is_in_hospital", true)
      .lte("hospital_release_at", now.toISOString());

    if (hospitalError) throw hospitalError;

    for (const player of hospitalizedPlayers || []) {
      const { error: releaseError } = await supabase
        .from("players")
        .update({
          is_in_hospital: false,
          hospital_release_at: null,
          health: 100, // Full health on release
        })
        .eq("id", player.id);

      if (!releaseError) {
        result.hospitalReleasesProcessed++;

        await supabase.from("game_events").insert({
          event_type: "hospital_release",
          actor_id: player.id,
          is_public: false,
          data: { automatic: true },
        });
      }
    }

    // ========================================================================
    // 4. Decay Heat for All Players
    // ========================================================================
    const { data: heatedPlayers, error: heatError } = await supabase
      .from("players")
      .select("id, heat")
      .gt("heat", 0);

    if (heatError) throw heatError;

    for (const player of heatedPlayers || []) {
      // Decay heat by 1 per tick (minimum 0)
      const newHeat = Math.max(0, player.heat - 1);

      const { error: updateError } = await supabase
        .from("players")
        .update({ heat: newHeat })
        .eq("id", player.id);

      if (!updateError) {
        result.heatDecayed++;
      }
    }

    // ========================================================================
    // 5. Regenerate Energy for Online Players
    // ========================================================================
    const { data: onlinePlayers, error: onlineError } = await supabase
      .from("players")
      .select("id, energy")
      .eq("is_online", true)
      .lt("energy", 100);

    if (onlineError) throw onlineError;

    for (const player of onlinePlayers || []) {
      // Regenerate 1 energy per tick (max 100)
      const newEnergy = Math.min(100, player.energy + 1);

      await supabase
        .from("players")
        .update({ energy: newEnergy })
        .eq("id", player.id);

      result.playersProcessed++;
    }

    // ========================================================================
    // 6. Random Police Raids on High-Heat Businesses
    // ========================================================================
    const { data: riskyBusinesses, error: riskyError } = await supabase
      .from("businesses")
      .select(`
        id,
        owner_id,
        name,
        heat,
        business_types!inner(police_raid_chance)
      `)
      .gt("heat", 50)
      .eq("is_operational", true);

    if (!riskyError && riskyBusinesses) {
      for (const business of riskyBusinesses) {
        const raidChance = (business.business_types as any).police_raid_chance * (business.heat / 100);

        if (Math.random() < raidChance) {
          // Raid happens!
          await supabase
            .from("businesses")
            .update({
              is_operational: false,
              health: 0,
            })
            .eq("id", business.id);

          // Add heat to owner
          if (business.owner_id) {
            await supabase.rpc("add_player_heat", {
              p_player_id: business.owner_id,
              p_amount: 30,
            });
          }

          await supabase.from("game_events").insert({
            event_type: "police_raid",
            actor_id: business.owner_id,
            data: {
              business_id: business.id,
              business_name: business.name,
            },
            is_public: true,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Game tick error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
