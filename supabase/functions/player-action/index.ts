// Street Legacy: Player Action Edge Function
// Handles player actions like missions, combat, trading, etc.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ActionType =
  | "start_mission"
  | "complete_mission"
  | "attack_player"
  | "purchase_business"
  | "upgrade_business"
  | "purchase_item"
  | "use_item"
  | "travel"
  | "deposit_bank"
  | "withdraw_bank"
  | "join_crew"
  | "leave_crew"
  | "create_crew";

interface ActionRequest {
  action: ActionType;
  payload: Record<string, unknown>;
}

interface ActionResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client for user context
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Get player data
    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("id", user.id)
      .single();

    if (playerError || !player) {
      return new Response(JSON.stringify({ success: false, message: "Player not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Check if player can act
    if (player.is_in_jail) {
      return new Response(JSON.stringify({ success: false, message: "You are in jail" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (player.is_in_hospital) {
      return new Response(JSON.stringify({ success: false, message: "You are in hospital" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const body: ActionRequest = await req.json();
    let response: ActionResponse;

    switch (body.action) {
      case "start_mission":
        response = await handleStartMission(supabaseAdmin, player, body.payload);
        break;
      case "complete_mission":
        response = await handleCompleteMission(supabaseAdmin, player, body.payload);
        break;
      case "attack_player":
        response = await handleAttackPlayer(supabaseAdmin, player, body.payload);
        break;
      case "purchase_business":
        response = await handlePurchaseBusiness(supabaseAdmin, player, body.payload);
        break;
      case "purchase_item":
        response = await handlePurchaseItem(supabaseAdmin, player, body.payload);
        break;
      case "use_item":
        response = await handleUseItem(supabaseAdmin, player, body.payload);
        break;
      case "travel":
        response = await handleTravel(supabaseAdmin, player, body.payload);
        break;
      case "deposit_bank":
        response = await handleBankDeposit(supabaseAdmin, player, body.payload);
        break;
      case "withdraw_bank":
        response = await handleBankWithdraw(supabaseAdmin, player, body.payload);
        break;
      case "create_crew":
        response = await handleCreateCrew(supabaseAdmin, player, body.payload);
        break;
      case "join_crew":
        response = await handleJoinCrew(supabaseAdmin, player, body.payload);
        break;
      case "leave_crew":
        response = await handleLeaveCrew(supabaseAdmin, player, body.payload);
        break;
      default:
        response = { success: false, message: "Unknown action" };
    }

    // Update last action timestamp
    await supabaseAdmin
      .from("players")
      .update({ last_action_at: new Date().toISOString() })
      .eq("id", player.id);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.success ? 200 : 400,
    });

  } catch (error) {
    console.error("Action error:", error);
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleStartMission(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const missionId = payload.mission_id as string;

  // Get mission details
  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (missionError || !mission) {
    return { success: false, message: "Mission not found" };
  }

  // Check requirements
  if ((player.reputation as number) < mission.min_reputation) {
    return { success: false, message: "Not enough reputation" };
  }

  if ((player.energy as number) < mission.energy_cost) {
    return { success: false, message: "Not enough energy" };
  }

  // Check cooldown
  const { data: lastMission } = await supabase
    .from("player_missions")
    .select("last_completed_at")
    .eq("player_id", player.id)
    .eq("mission_id", missionId)
    .eq("status", "completed")
    .order("last_completed_at", { ascending: false })
    .limit(1)
    .single();

  if (lastMission?.last_completed_at && mission.cooldown_minutes > 0) {
    const cooldownEnd = new Date(lastMission.last_completed_at);
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + mission.cooldown_minutes);

    if (new Date() < cooldownEnd) {
      const minutesLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
      return { success: false, message: `Mission on cooldown. ${minutesLeft} minutes remaining.` };
    }
  }

  // Deduct energy
  await supabase
    .from("players")
    .update({ energy: (player.energy as number) - mission.energy_cost })
    .eq("id", player.id);

  // Create mission record
  const { data: playerMission, error: createError } = await supabase
    .from("player_missions")
    .insert({
      player_id: player.id,
      mission_id: missionId,
      status: "in_progress",
    })
    .select()
    .single();

  if (createError) {
    return { success: false, message: "Failed to start mission" };
  }

  return {
    success: true,
    message: `Started mission: ${mission.name}`,
    data: {
      player_mission_id: playerMission.id,
      duration_minutes: mission.duration_minutes,
      ends_at: new Date(Date.now() + mission.duration_minutes * 60000).toISOString(),
    },
  };
}

async function handleCompleteMission(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const playerMissionId = payload.player_mission_id as string;

  const { data: playerMission, error } = await supabase
    .from("player_missions")
    .select("*, missions(*)")
    .eq("id", playerMissionId)
    .eq("player_id", player.id)
    .eq("status", "in_progress")
    .single();

  if (error || !playerMission) {
    return { success: false, message: "Mission not found or already completed" };
  }

  const mission = playerMission.missions;
  const startTime = new Date(playerMission.started_at);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - startTime.getTime()) / 60000;

  if (elapsedMinutes < mission.duration_minutes) {
    return { success: false, message: "Mission not yet complete" };
  }

  // Calculate success
  const successRoll = Math.random();
  const success = successRoll <= mission.success_base_chance;

  if (success) {
    // Award rewards
    await supabase
      .from("players")
      .update({
        cash: (player.cash as number) + mission.cash_reward,
        reputation: (player.reputation as number) + mission.reputation_reward,
        respect: (player.respect as number) + mission.respect_reward,
        heat: Math.min(100, (player.heat as number) + mission.heat_gain),
      })
      .eq("id", player.id);

    // Log transaction
    await supabase.from("transactions").insert({
      player_id: player.id,
      transaction_type: "mission_reward",
      amount: mission.cash_reward,
      balance_after: (player.cash as number) + mission.cash_reward,
      reference_type: "mission",
      reference_id: mission.id,
      description: `Completed: ${mission.name}`,
    });

    // Update mission status
    await supabase
      .from("player_missions")
      .update({
        status: "completed",
        completed_at: now.toISOString(),
        last_completed_at: now.toISOString(),
      })
      .eq("id", playerMissionId);

    // Log event
    await supabase.from("game_events").insert({
      event_type: "mission_complete",
      actor_id: player.id,
      district_id: mission.district_id,
      data: { mission_name: mission.name, rewards: { cash: mission.cash_reward } },
      is_public: mission.danger_level >= 7,
    });

    return {
      success: true,
      message: `Mission completed! Earned $${mission.cash_reward}`,
      data: {
        cash_reward: mission.cash_reward,
        reputation_reward: mission.reputation_reward,
        respect_reward: mission.respect_reward,
        heat_gained: mission.heat_gain,
      },
    };
  } else {
    // Mission failed
    const healthLoss = Math.floor(mission.danger_level * 5 * Math.random());

    await supabase
      .from("players")
      .update({
        health: Math.max(0, (player.health as number) - healthLoss),
        heat: Math.min(100, (player.heat as number) + Math.floor(mission.heat_gain / 2)),
      })
      .eq("id", player.id);

    await supabase
      .from("player_missions")
      .update({
        status: "failed",
        completed_at: now.toISOString(),
      })
      .eq("id", playerMissionId);

    // Check if player needs hospital
    if ((player.health as number) - healthLoss <= 0) {
      const hospitalTime = new Date();
      hospitalTime.setMinutes(hospitalTime.getMinutes() + 15);

      await supabase
        .from("players")
        .update({
          is_in_hospital: true,
          hospital_release_at: hospitalTime.toISOString(),
        })
        .eq("id", player.id);

      return {
        success: false,
        message: `Mission failed! You were injured and sent to the hospital.`,
        data: { health_lost: healthLoss, hospitalized: true },
      };
    }

    return {
      success: false,
      message: `Mission failed! Lost ${healthLoss} health.`,
      data: { health_lost: healthLoss },
    };
  }
}

async function handleAttackPlayer(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const targetId = payload.target_id as string;

  if (targetId === player.id) {
    return { success: false, message: "You can't attack yourself" };
  }

  // Get target
  const { data: target, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", targetId)
    .single();

  if (error || !target) {
    return { success: false, message: "Target not found" };
  }

  if (target.is_in_jail || target.is_in_hospital) {
    return { success: false, message: "Target is unavailable" };
  }

  // Check energy
  const energyCost = 20;
  if ((player.energy as number) < energyCost) {
    return { success: false, message: "Not enough energy" };
  }

  // Calculate combat (simplified)
  const attackerPower = (player.respect as number) + Math.random() * 50;
  const defenderPower = (target.respect as number) + Math.random() * 50;

  const attackerWins = attackerPower > defenderPower;

  // Deduct energy
  await supabase
    .from("players")
    .update({ energy: (player.energy as number) - energyCost })
    .eq("id", player.id);

  if (attackerWins) {
    // Calculate loot (10-20% of target's cash)
    const lootPercent = 0.1 + Math.random() * 0.1;
    const loot = Math.floor((target.cash as number) * lootPercent);

    // Update attacker
    await supabase
      .from("players")
      .update({
        cash: (player.cash as number) + loot,
        respect: (player.respect as number) + 5,
        heat: Math.min(100, (player.heat as number) + 10),
      })
      .eq("id", player.id);

    // Update target
    const targetHealthLoss = 20 + Math.floor(Math.random() * 30);
    const targetNewHealth = Math.max(0, (target.health as number) - targetHealthLoss);

    const targetUpdate: Record<string, unknown> = {
      cash: (target.cash as number) - loot,
      health: targetNewHealth,
    };

    if (targetNewHealth <= 0) {
      const hospitalTime = new Date();
      hospitalTime.setMinutes(hospitalTime.getMinutes() + 30);
      targetUpdate.is_in_hospital = true;
      targetUpdate.hospital_release_at = hospitalTime.toISOString();
    }

    await supabase
      .from("players")
      .update(targetUpdate)
      .eq("id", targetId);

    // Log event
    await supabase.from("game_events").insert({
      event_type: "player_attack",
      actor_id: player.id as string,
      target_id: targetId,
      data: { winner: "attacker", loot },
      is_public: true,
    });

    return {
      success: true,
      message: `You defeated ${target.username} and stole $${loot}!`,
      data: { loot, target_hospitalized: targetNewHealth <= 0 },
    };
  } else {
    // Attacker loses
    const healthLoss = 15 + Math.floor(Math.random() * 20);
    const newHealth = Math.max(0, (player.health as number) - healthLoss);

    const playerUpdate: Record<string, unknown> = { health: newHealth };

    if (newHealth <= 0) {
      const hospitalTime = new Date();
      hospitalTime.setMinutes(hospitalTime.getMinutes() + 15);
      playerUpdate.is_in_hospital = true;
      playerUpdate.hospital_release_at = hospitalTime.toISOString();
    }

    await supabase
      .from("players")
      .update(playerUpdate)
      .eq("id", player.id);

    await supabase.from("game_events").insert({
      event_type: "player_attack",
      actor_id: player.id as string,
      target_id: targetId,
      data: { winner: "defender" },
      is_public: true,
    });

    return {
      success: false,
      message: `${target.username} fought back! You lost ${healthLoss} health.`,
      data: { health_lost: healthLoss, hospitalized: newHealth <= 0 },
    };
  }
}

async function handlePurchaseBusiness(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const businessTypeId = payload.business_type_id as string;
  const districtId = payload.district_id as string;
  const name = payload.name as string;

  // Get business type
  const { data: bizType, error } = await supabase
    .from("business_types")
    .select("*")
    .eq("id", businessTypeId)
    .single();

  if (error || !bizType) {
    return { success: false, message: "Business type not found" };
  }

  // Check requirements
  if ((player.cash as number) < bizType.purchase_price) {
    return { success: false, message: "Not enough cash" };
  }

  if ((player.reputation as number) < bizType.min_reputation) {
    return { success: false, message: "Not enough reputation" };
  }

  // Deduct cash and create business
  await supabase
    .from("players")
    .update({ cash: (player.cash as number) - bizType.purchase_price })
    .eq("id", player.id);

  const { data: business, error: createError } = await supabase
    .from("businesses")
    .insert({
      name: name || `${player.username}'s ${bizType.name}`,
      business_type: businessTypeId,
      owner_id: player.id,
      district_id: districtId,
      position_x: Math.random() * 100,
      position_y: Math.random() * 100,
      income_per_tick: bizType.base_income,
      operating_cost: bizType.base_operating_cost,
      is_front: bizType.category === "front",
    })
    .select()
    .single();

  if (createError) {
    // Refund
    await supabase
      .from("players")
      .update({ cash: player.cash })
      .eq("id", player.id);
    return { success: false, message: "Failed to create business" };
  }

  // Log transaction
  await supabase.from("transactions").insert({
    player_id: player.id,
    transaction_type: "business_purchase",
    amount: -bizType.purchase_price,
    balance_after: (player.cash as number) - bizType.purchase_price,
    reference_type: "business",
    reference_id: business.id,
    description: `Purchased ${bizType.name}`,
  });

  return {
    success: true,
    message: `Purchased ${bizType.name} for $${bizType.purchase_price}`,
    data: { business_id: business.id },
  };
}

async function handlePurchaseItem(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const itemId = payload.item_id as string;
  const quantity = (payload.quantity as number) || 1;

  const { data: item, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (error || !item) {
    return { success: false, message: "Item not found" };
  }

  const totalCost = item.base_price * quantity;

  if ((player.cash as number) < totalCost) {
    return { success: false, message: "Not enough cash" };
  }

  // Deduct cash
  await supabase
    .from("players")
    .update({ cash: (player.cash as number) - totalCost })
    .eq("id", player.id);

  // Add to inventory (upsert)
  const { data: existing } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("player_id", player.id)
    .eq("item_id", itemId)
    .eq("is_equipped", false)
    .single();

  if (existing) {
    await supabase
      .from("inventory")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id);
  } else {
    await supabase.from("inventory").insert({
      player_id: player.id,
      item_type: item.category,
      item_id: itemId,
      quantity,
    });
  }

  return {
    success: true,
    message: `Purchased ${quantity}x ${item.name} for $${totalCost}`,
    data: { item_id: itemId, quantity, total_cost: totalCost },
  };
}

async function handleUseItem(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const inventoryId = payload.inventory_id as string;

  const { data: invItem, error } = await supabase
    .from("inventory")
    .select("*, items(*)")
    .eq("id", inventoryId)
    .eq("player_id", player.id)
    .single();

  if (error || !invItem) {
    return { success: false, message: "Item not found in inventory" };
  }

  const item = invItem.items;

  if (item.category !== "consumable") {
    return { success: false, message: "This item cannot be used" };
  }

  // Apply effect
  const updates: Record<string, number> = {};

  if (item.effect_type === "heal") {
    updates.health = Math.min(100, (player.health as number) + item.effect_value);
  } else if (item.effect_type === "energy") {
    updates.energy = Math.min(100, (player.energy as number) + item.effect_value);
  }

  await supabase
    .from("players")
    .update(updates)
    .eq("id", player.id);

  // Remove from inventory
  if (invItem.quantity > 1) {
    await supabase
      .from("inventory")
      .update({ quantity: invItem.quantity - 1 })
      .eq("id", inventoryId);
  } else {
    await supabase.from("inventory").delete().eq("id", inventoryId);
  }

  return {
    success: true,
    message: `Used ${item.name}`,
    data: { effect_type: item.effect_type, effect_value: item.effect_value },
  };
}

async function handleTravel(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const districtId = payload.district_id as string;

  const { data: district, error } = await supabase
    .from("districts")
    .select("*")
    .eq("id", districtId)
    .single();

  if (error || !district) {
    return { success: false, message: "District not found" };
  }

  const energyCost = 5;
  if ((player.energy as number) < energyCost) {
    return { success: false, message: "Not enough energy to travel" };
  }

  await supabase
    .from("players")
    .update({
      current_district_id: districtId,
      position_x: district.bounds_x + Math.random() * district.bounds_width,
      position_y: district.bounds_y + Math.random() * district.bounds_height,
      energy: (player.energy as number) - energyCost,
    })
    .eq("id", player.id);

  return {
    success: true,
    message: `Traveled to ${district.name}`,
    data: { district_id: districtId, district_name: district.name },
  };
}

async function handleBankDeposit(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const amount = payload.amount as number;

  if (amount <= 0) {
    return { success: false, message: "Invalid amount" };
  }

  if ((player.cash as number) < amount) {
    return { success: false, message: "Not enough cash" };
  }

  await supabase
    .from("players")
    .update({
      cash: (player.cash as number) - amount,
      bank_balance: (player.bank_balance as number) + amount,
    })
    .eq("id", player.id);

  await supabase.from("transactions").insert({
    player_id: player.id,
    transaction_type: "bank_deposit",
    amount: -amount,
    balance_after: (player.cash as number) - amount,
    description: "Bank deposit",
  });

  return {
    success: true,
    message: `Deposited $${amount} to bank`,
    data: { new_cash: (player.cash as number) - amount, new_bank: (player.bank_balance as number) + amount },
  };
}

async function handleBankWithdraw(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const amount = payload.amount as number;

  if (amount <= 0) {
    return { success: false, message: "Invalid amount" };
  }

  if ((player.bank_balance as number) < amount) {
    return { success: false, message: "Not enough funds in bank" };
  }

  await supabase
    .from("players")
    .update({
      cash: (player.cash as number) + amount,
      bank_balance: (player.bank_balance as number) - amount,
    })
    .eq("id", player.id);

  await supabase.from("transactions").insert({
    player_id: player.id,
    transaction_type: "bank_withdraw",
    amount: amount,
    balance_after: (player.cash as number) + amount,
    description: "Bank withdrawal",
  });

  return {
    success: true,
    message: `Withdrew $${amount} from bank`,
    data: { new_cash: (player.cash as number) + amount, new_bank: (player.bank_balance as number) - amount },
  };
}

async function handleCreateCrew(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const name = payload.name as string;
  const tag = payload.tag as string;

  if (!name || name.length < 3) {
    return { success: false, message: "Crew name must be at least 3 characters" };
  }

  // Check if player is already in a crew
  const { data: existingMembership } = await supabase
    .from("crew_members")
    .select("id")
    .eq("player_id", player.id)
    .single();

  if (existingMembership) {
    return { success: false, message: "You are already in a crew" };
  }

  const crewCost = 10000;
  if ((player.cash as number) < crewCost) {
    return { success: false, message: `Creating a crew costs $${crewCost}` };
  }

  // Create crew
  const { data: crew, error } = await supabase
    .from("crews")
    .insert({
      name,
      tag: tag?.toUpperCase(),
      leader_id: player.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, message: "Crew name or tag already exists" };
    }
    return { success: false, message: "Failed to create crew" };
  }

  // Add leader as member
  await supabase.from("crew_members").insert({
    crew_id: crew.id,
    player_id: player.id,
    role: "leader",
    can_invite: true,
    can_kick: true,
    can_manage_business: true,
  });

  // Deduct cost
  await supabase
    .from("players")
    .update({ cash: (player.cash as number) - crewCost })
    .eq("id", player.id);

  return {
    success: true,
    message: `Created crew: ${name}`,
    data: { crew_id: crew.id },
  };
}

async function handleJoinCrew(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const crewId = payload.crew_id as string;

  // Check if already in crew
  const { data: existingMembership } = await supabase
    .from("crew_members")
    .select("id")
    .eq("player_id", player.id)
    .single();

  if (existingMembership) {
    return { success: false, message: "You are already in a crew" };
  }

  // Get crew
  const { data: crew, error } = await supabase
    .from("crews")
    .select("*")
    .eq("id", crewId)
    .single();

  if (error || !crew) {
    return { success: false, message: "Crew not found" };
  }

  if (!crew.is_recruiting) {
    return { success: false, message: "This crew is not recruiting" };
  }

  if ((player.reputation as number) < crew.min_reputation_to_join) {
    return { success: false, message: "You don't have enough reputation to join" };
  }

  if (crew.member_count >= crew.max_members) {
    return { success: false, message: "This crew is full" };
  }

  // Join crew
  await supabase.from("crew_members").insert({
    crew_id: crewId,
    player_id: player.id,
    role: "recruit",
  });

  // Update member count
  await supabase
    .from("crews")
    .update({ member_count: crew.member_count + 1 })
    .eq("id", crewId);

  return {
    success: true,
    message: `Joined crew: ${crew.name}`,
    data: { crew_id: crewId },
  };
}

async function handleLeaveCrew(
  supabase: ReturnType<typeof createClient>,
  player: Record<string, unknown>,
  _payload: Record<string, unknown>
): Promise<ActionResponse> {
  const { data: membership, error } = await supabase
    .from("crew_members")
    .select("*, crews(*)")
    .eq("player_id", player.id)
    .single();

  if (error || !membership) {
    return { success: false, message: "You are not in a crew" };
  }

  if (membership.role === "leader") {
    return { success: false, message: "Leaders cannot leave. Transfer leadership or disband the crew." };
  }

  // Leave crew
  await supabase
    .from("crew_members")
    .delete()
    .eq("id", membership.id);

  // Update member count
  await supabase
    .from("crews")
    .update({ member_count: membership.crews.member_count - 1 })
    .eq("id", membership.crew_id);

  return {
    success: true,
    message: `Left crew: ${membership.crews.name}`,
  };
}
