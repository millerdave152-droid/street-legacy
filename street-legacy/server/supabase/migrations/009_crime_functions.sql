-- Street Legacy: Crime System Functions Migration
-- Migration: 009_crime_functions
-- Description: SECURITY DEFINER functions for crime operations including
--              attempting crimes, calculating success rates, and heat management

-- =============================================================================
-- GET AVAILABLE CRIMES
-- List crimes player can attempt with eligibility info
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_crimes(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  id VARCHAR,
  name VARCHAR,
  description TEXT,
  category crime_category_enum,
  required_level INT,
  payout_min BIGINT,
  payout_max BIGINT,
  success_rate INT,
  energy_cost INT,
  heat_min INT,
  heat_max INT,
  xp_reward INT,
  cooldown_seconds INT,
  requires_weapon BOOLEAN,
  allows_pvp BOOLEAN,
  has_minigame BOOLEAN,
  player_can_attempt BOOLEAN,
  is_on_cooldown BOOLEAN,
  cooldown_remaining_seconds INT,
  calculated_success_rate INT,
  reason_unavailable TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player RECORD;
  v_has_weapon BOOLEAN;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  -- Get player data
  SELECT * INTO v_player
  FROM players WHERE id = v_player_id;

  -- Check if player has a weapon equipped
  SELECT EXISTS (
    SELECT 1 FROM player_inventory pi
    JOIN items i ON i.id = pi.item_id
    WHERE pi.player_id = v_player_id
    AND pi.is_equipped = TRUE
    AND i.category = 'weapon'
  ) INTO v_has_weapon;

  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.description,
    ct.category,
    ct.required_level,
    ct.payout_min,
    ct.payout_max,
    ct.success_rate,
    ct.energy_cost,
    ct.heat_min,
    ct.heat_max,
    ct.xp_reward,
    ct.cooldown_seconds,
    ct.requires_weapon,
    ct.allows_pvp,
    ct.has_minigame,
    -- Can attempt check
    (
      v_player.level >= ct.required_level
      AND (NOT ct.requires_weapon OR v_has_weapon)
      AND v_player.heat_level < 100
    ) AS player_can_attempt,
    -- Cooldown check using cooldowns table
    has_cooldown(v_player_id, 'crime:' || ct.id) AS is_on_cooldown,
    -- Cooldown remaining
    get_cooldown_remaining(v_player_id, 'crime:' || ct.id) AS cooldown_remaining_seconds,
    -- Calculated success rate
    calculate_crime_success_rate(v_player_id, ct.id, v_player.current_district_id) AS calculated_success_rate,
    -- Reason if unavailable
    CASE
      WHEN v_player.level < ct.required_level THEN 'Requires level ' || ct.required_level
      WHEN ct.requires_weapon AND NOT v_has_weapon THEN 'Requires a weapon'
      WHEN v_player.heat_level >= 100 THEN 'Heat too high - laying low'
      ELSE NULL
    END AS reason_unavailable
  FROM crime_types ct
  WHERE ct.is_active = TRUE
  ORDER BY ct.required_level, ct.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_available_crimes IS 'Lists all crimes with player eligibility and cooldown status';

-- =============================================================================
-- CALCULATE CRIME SUCCESS RATE
-- Calculate actual success chance with all modifiers
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_crime_success_rate(
  p_player_id UUID,
  p_crime_type_id VARCHAR(50),
  p_district_id VARCHAR(50)
)
RETURNS INT AS $$
DECLARE
  v_player RECORD;
  v_crime_type RECORD;
  v_district RECORD;
  v_base_rate INT;
  v_final_rate INT;
  v_equipment_bonus INT := 0;
BEGIN
  -- Get player
  SELECT * INTO v_player FROM players WHERE id = p_player_id;

  -- Get crime type
  SELECT * INTO v_crime_type FROM crime_types WHERE id = p_crime_type_id;

  -- Get district
  SELECT * INTO v_district FROM districts WHERE id = p_district_id;

  IF v_crime_type IS NULL THEN
    RETURN 0;
  END IF;

  v_base_rate := v_crime_type.success_rate;

  -- Rep bonus: +0.5% per 10 crime rep (max +50%)
  v_final_rate := v_base_rate + LEAST(50, (v_player.rep_crime / 20));

  -- District police penalty: -0.5% per point above 50
  IF v_district.police_presence > 50 THEN
    v_final_rate := v_final_rate - ((v_district.police_presence - 50) / 2);
  ELSE
    -- Bonus for low police presence
    v_final_rate := v_final_rate + ((50 - v_district.police_presence) / 4);
  END IF;

  -- Heat penalty: -1% per 10 heat
  v_final_rate := v_final_rate - (v_player.heat_level / 10);

  -- Level bonus: +1% per level above requirement
  IF v_player.level > v_crime_type.required_level THEN
    v_final_rate := v_final_rate + LEAST(10, v_player.level - v_crime_type.required_level);
  END IF;

  -- Equipment bonuses from equipped items
  SELECT COALESCE(SUM((i.effects->>'crime_success_bonus')::INT), 0)
  INTO v_equipment_bonus
  FROM player_inventory pi
  JOIN items i ON i.id = pi.item_id
  WHERE pi.player_id = p_player_id AND pi.is_equipped = TRUE;

  v_final_rate := v_final_rate + v_equipment_bonus;

  -- Burglary-specific tool bonus
  IF p_crime_type_id = 'burglary' THEN
    SELECT COALESCE(SUM((i.effects->>'burglary_bonus')::INT), 0)
    INTO v_equipment_bonus
    FROM player_inventory pi
    JOIN items i ON i.id = pi.item_id
    WHERE pi.player_id = p_player_id;

    v_final_rate := v_final_rate + v_equipment_bonus;
  END IF;

  -- Clamp between 5% and 95%
  RETURN GREATEST(5, LEAST(95, v_final_rate));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_crime_success_rate IS 'Calculates modified success rate for a crime attempt';

-- =============================================================================
-- CALCULATE CRIME PAYOUT
-- Calculate actual payout with district and level modifiers
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_crime_payout(
  p_crime_type_id VARCHAR(50),
  p_district_id VARCHAR(50),
  p_player_level INT
)
RETURNS BIGINT AS $$
DECLARE
  v_crime_type RECORD;
  v_district RECORD;
  v_base_payout BIGINT;
  v_final_payout BIGINT;
BEGIN
  SELECT * INTO v_crime_type FROM crime_types WHERE id = p_crime_type_id;
  SELECT * INTO v_district FROM districts WHERE id = p_district_id;

  -- Random base payout between min and max
  v_base_payout := v_crime_type.payout_min +
    floor(random() * (v_crime_type.payout_max - v_crime_type.payout_min + 1));

  -- District economy modifier
  v_final_payout := (v_base_payout * v_district.economy_level / 50)::BIGINT;

  -- Level bonus: +2% per level
  v_final_payout := (v_final_payout * (1 + p_player_level * 0.02))::BIGINT;

  RETURN v_final_payout;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_crime_payout IS 'Calculates payout for a successful crime';

-- =============================================================================
-- ATTEMPT CRIME
-- Main crime execution function
-- =============================================================================

CREATE OR REPLACE FUNCTION attempt_crime(
  p_crime_type_id VARCHAR(50),
  p_target_player_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  result crime_result_enum,
  payout BIGINT,
  heat_gained INT,
  xp_gained INT,
  cash_lost BIGINT,
  message TEXT,
  leveled_up BOOLEAN,
  new_level INT
) AS $$
DECLARE
  v_player_id UUID;
  v_player RECORD;
  v_crime_type RECORD;
  v_district RECORD;
  v_target RECORD;
  v_success_rate INT;
  v_roll INT;
  v_result crime_result_enum;
  v_payout BIGINT := 0;
  v_heat INT := 0;
  v_xp INT := 0;
  v_cash_lost BIGINT := 0;
  v_message TEXT;
  v_log_id UUID;
  v_level_result RECORD;
  v_leveled_up BOOLEAN := FALSE;
  v_new_level INT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get player with lock
  SELECT * INTO v_player FROM players WHERE id = v_player_id FOR UPDATE;

  -- Get crime type
  SELECT * INTO v_crime_type FROM crime_types WHERE id = p_crime_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid crime type';
  END IF;

  IF NOT v_crime_type.is_active THEN
    RAISE EXCEPTION 'This crime is not currently available';
  END IF;

  -- Get district
  SELECT * INTO v_district FROM districts WHERE id = v_player.current_district_id;

  -- Validation checks
  IF v_player.level < v_crime_type.required_level THEN
    RAISE EXCEPTION 'You need to be level % to attempt this crime', v_crime_type.required_level;
  END IF;

  IF v_player.heat_level >= 100 THEN
    RAISE EXCEPTION 'Your heat is too high. Lay low until it drops.';
  END IF;

  -- Check cooldown
  IF has_cooldown(v_player_id, 'crime:' || p_crime_type_id) THEN
    RAISE EXCEPTION 'Crime on cooldown. Wait % more seconds.',
      get_cooldown_remaining(v_player_id, 'crime:' || p_crime_type_id);
  END IF;

  -- Check weapon requirement
  IF v_crime_type.requires_weapon THEN
    IF NOT EXISTS (
      SELECT 1 FROM player_inventory pi
      JOIN items i ON i.id = pi.item_id
      WHERE pi.player_id = v_player_id
      AND pi.is_equipped = TRUE
      AND i.category = 'weapon'
    ) THEN
      RAISE EXCEPTION 'This crime requires a weapon';
    END IF;
  END IF;

  -- Check and regenerate energy
  PERFORM update_player_energy(v_player_id);
  SELECT energy INTO v_player.energy FROM players WHERE id = v_player_id;

  IF v_player.energy < v_crime_type.energy_cost THEN
    RAISE EXCEPTION 'Not enough energy. Need: %, Have: %', v_crime_type.energy_cost, v_player.energy;
  END IF;

  -- PvP validation
  IF p_target_player_id IS NOT NULL THEN
    IF NOT v_crime_type.allows_pvp THEN
      RAISE EXCEPTION 'This crime type does not allow PvP';
    END IF;

    SELECT * INTO v_target FROM players WHERE id = p_target_player_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target player not found';
    END IF;

    IF v_target.current_district_id != v_player.current_district_id THEN
      RAISE EXCEPTION 'Target must be in the same district';
    END IF;

    IF v_target.newbie_protected AND v_target.newbie_protection_until > NOW() THEN
      RAISE EXCEPTION 'Target is under newbie protection';
    END IF;

    IF v_target.cash_balance < 100 THEN
      RAISE EXCEPTION 'Target does not have enough cash to steal';
    END IF;

    -- Check if same crew
    IF EXISTS (
      SELECT 1 FROM crew_members cm1
      JOIN crew_members cm2 ON cm1.crew_id = cm2.crew_id
      WHERE cm1.player_id = v_player_id
      AND cm2.player_id = p_target_player_id
      AND cm1.is_active = TRUE AND cm2.is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Cannot target your own crew member';
    END IF;
  END IF;

  -- Consume energy
  PERFORM consume_energy(v_player_id, v_crime_type.energy_cost, 'crime');

  -- Set cooldown
  PERFORM set_cooldown(v_player_id, 'crime:' || p_crime_type_id, v_crime_type.cooldown_seconds);

  -- Calculate success rate
  v_success_rate := calculate_crime_success_rate(v_player_id, p_crime_type_id, v_player.current_district_id);

  -- Roll for outcome
  v_roll := floor(random() * 100) + 1;

  IF v_roll <= v_success_rate THEN
    -- SUCCESS
    v_result := 'success';

    -- Calculate payout
    IF p_target_player_id IS NOT NULL THEN
      -- PvP: steal 10-20% of target's cash
      v_payout := (v_target.cash_balance * (10 + floor(random() * 11)) / 100)::BIGINT;
      v_payout := GREATEST(50, v_payout); -- Minimum 50

      -- Deduct from target
      PERFORM modify_player_balance(
        p_target_player_id,
        -v_payout,
        'cash',
        'crime',
        'Robbed by ' || v_player.username,
        v_player_id,
        NULL,
        NULL,
        NULL
      );
    ELSE
      -- NPC crime
      v_payout := calculate_crime_payout(p_crime_type_id, v_player.current_district_id, v_player.level);
    END IF;

    -- Credit player
    PERFORM modify_player_balance(
      v_player_id,
      v_payout,
      'cash',
      'crime',
      v_crime_type.name || ' successful',
      p_target_player_id,
      NULL,
      NULL,
      NULL
    );

    -- Heat gain (lower end on success)
    v_heat := v_crime_type.heat_min + floor(random() * ((v_crime_type.heat_max - v_crime_type.heat_min) / 2 + 1));

    -- XP
    v_xp := v_crime_type.xp_reward;

    v_message := 'Success! Earned $' || v_payout;

  ELSIF v_roll <= v_success_rate + 30 THEN
    -- FAILURE (but not caught)
    v_result := 'failure';
    v_heat := floor(v_crime_type.heat_min / 2);
    v_xp := floor(v_crime_type.xp_reward / 4); -- Small XP for trying
    v_message := 'Failed! The attempt did not succeed.';

  ELSE
    -- CAUGHT
    v_result := 'caught';

    -- Higher heat
    v_heat := v_crime_type.heat_max + floor(random() * 10);

    -- Cash fine (10-30% of cash on hand)
    v_cash_lost := (v_player.cash_balance * (10 + floor(random() * 21)) / 100)::BIGINT;
    v_cash_lost := LEAST(v_cash_lost, v_player.cash_balance); -- Can't lose more than you have

    IF v_cash_lost > 0 THEN
      PERFORM modify_player_balance(
        v_player_id,
        -v_cash_lost,
        'cash',
        'crime',
        'Caught during ' || v_crime_type.name,
        NULL,
        NULL,
        NULL,
        NULL
      );
    END IF;

    v_message := 'Caught! Lost $' || v_cash_lost || ' and gained ' || v_heat || ' heat.';
  END IF;

  -- Apply heat and update stats
  UPDATE players
  SET heat_level = LEAST(100, heat_level + v_heat),
      last_crime_at = NOW(),
      crimes_committed = crimes_committed + 1,
      crimes_succeeded = crimes_succeeded + CASE WHEN v_result = 'success' THEN 1 ELSE 0 END
  WHERE id = v_player_id;

  -- Apply XP
  IF v_xp > 0 THEN
    SELECT * INTO v_level_result FROM add_player_xp(v_player_id, v_xp, 'crime');
    v_leveled_up := v_level_result.leveled_up;
    v_new_level := v_level_result.new_level;
  ELSE
    SELECT level INTO v_new_level FROM players WHERE id = v_player_id;
  END IF;

  -- Apply rep on success
  IF v_result = 'success' THEN
    PERFORM add_player_reputation(v_player_id, 'street', GREATEST(1, (v_payout / 100)::INT), 'crime');
  END IF;

  -- Check/remove newbie protection (committing crimes removes protection)
  UPDATE players SET newbie_protected = FALSE, newbie_protection_until = NULL
  WHERE id = v_player_id AND newbie_protected = TRUE;

  -- Record crime log
  INSERT INTO crime_logs (
    player_id, crime_type_id, district_id, target_player_id,
    result, payout, heat_gained, xp_gained, energy_spent, success_roll, fine_amount
  ) VALUES (
    v_player_id, p_crime_type_id, v_player.current_district_id, p_target_player_id,
    v_result, v_payout, v_heat, v_xp, v_crime_type.energy_cost, v_roll, v_cash_lost
  )
  RETURNING id INTO v_log_id;

  -- Log game event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, target_player_id, value_numeric, metadata)
  VALUES (v_player_id, 'crime', v_result::TEXT, v_player.current_district_id, p_target_player_id, v_payout,
    jsonb_build_object('crime_type', p_crime_type_id, 'log_id', v_log_id, 'heat_gained', v_heat, 'roll', v_roll, 'success_rate', v_success_rate));

  -- Update mission progress
  PERFORM update_mission_progress(v_player_id, 'complete_crime',
    jsonb_build_object('crime_type', p_crime_type_id, 'result', v_result, 'payout', v_payout));

  RETURN QUERY SELECT
    v_result = 'success',
    v_result,
    v_payout,
    v_heat,
    v_xp,
    v_cash_lost,
    v_message,
    v_leveled_up,
    v_new_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION attempt_crime IS 'Attempts a crime and returns the result';

-- =============================================================================
-- GET CRIME HISTORY
-- Get player's crime attempt history
-- =============================================================================

CREATE OR REPLACE FUNCTION get_crime_history(
  p_player_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  crime_type_id VARCHAR,
  crime_name VARCHAR,
  district_id VARCHAR,
  district_name VARCHAR,
  target_player_id UUID,
  target_username VARCHAR,
  result crime_result_enum,
  payout BIGINT,
  heat_gained INT,
  xp_gained INT,
  fine_amount BIGINT,
  attempted_at TIMESTAMPTZ
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    cl.id,
    cl.crime_type_id,
    ct.name AS crime_name,
    cl.district_id,
    d.name AS district_name,
    cl.target_player_id,
    tp.username AS target_username,
    cl.result,
    cl.payout,
    cl.heat_gained,
    cl.xp_gained,
    cl.fine_amount,
    cl.attempted_at
  FROM crime_logs cl
  JOIN crime_types ct ON ct.id = cl.crime_type_id
  JOIN districts d ON d.id = cl.district_id
  LEFT JOIN players tp ON tp.id = cl.target_player_id
  WHERE cl.player_id = v_player_id
  ORDER BY cl.attempted_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_crime_history IS 'Returns crime attempt history for a player';

-- =============================================================================
-- GET CRIME STATS
-- Get player's crime statistics
-- =============================================================================

CREATE OR REPLACE FUNCTION get_crime_stats(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_attempts BIGINT,
  total_successes BIGINT,
  total_failures BIGINT,
  total_caught BIGINT,
  success_rate NUMERIC,
  total_earnings BIGINT,
  total_fines_paid BIGINT,
  net_earnings BIGINT,
  total_heat_gained BIGINT,
  favorite_crime_type VARCHAR,
  most_profitable_crime VARCHAR
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_attempts,
    COUNT(*) FILTER (WHERE cl.result = 'success')::BIGINT AS total_successes,
    COUNT(*) FILTER (WHERE cl.result = 'failure')::BIGINT AS total_failures,
    COUNT(*) FILTER (WHERE cl.result = 'caught')::BIGINT AS total_caught,
    ROUND(
      COUNT(*) FILTER (WHERE cl.result = 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      1
    ) AS success_rate,
    COALESCE(SUM(cl.payout), 0)::BIGINT AS total_earnings,
    COALESCE(SUM(cl.fine_amount), 0)::BIGINT AS total_fines_paid,
    (COALESCE(SUM(cl.payout), 0) - COALESCE(SUM(cl.fine_amount), 0))::BIGINT AS net_earnings,
    COALESCE(SUM(cl.heat_gained), 0)::BIGINT AS total_heat_gained,
    (
      SELECT ct.name FROM crime_logs cl2
      JOIN crime_types ct ON ct.id = cl2.crime_type_id
      WHERE cl2.player_id = v_player_id
      GROUP BY ct.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS favorite_crime_type,
    (
      SELECT ct.name FROM crime_logs cl2
      JOIN crime_types ct ON ct.id = cl2.crime_type_id
      WHERE cl2.player_id = v_player_id AND cl2.result = 'success'
      GROUP BY ct.name
      ORDER BY SUM(cl2.payout) DESC
      LIMIT 1
    ) AS most_profitable_crime
  FROM crime_logs cl
  WHERE cl.player_id = v_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_crime_stats IS 'Returns crime statistics for a player';

-- =============================================================================
-- PROCESS HEAT DECAY
-- Scheduled function to reduce heat over time
-- =============================================================================

CREATE OR REPLACE FUNCTION process_heat_decay()
RETURNS TABLE (players_updated INT, total_heat_reduced INT) AS $$
DECLARE
  v_updated INT;
  v_heat_reduced INT;
BEGIN
  -- Reduce heat by 2 for all players with heat > 0
  WITH updated AS (
    UPDATE players
    SET heat_level = GREATEST(0, heat_level - 2)
    WHERE heat_level > 0
    RETURNING id, 2 AS reduced
  )
  SELECT COUNT(*)::INT, COALESCE(SUM(reduced), 0)::INT
  INTO v_updated, v_heat_reduced
  FROM updated;

  -- Also reduce property heat
  UPDATE properties
  SET heat_level = GREATEST(0, heat_level - 1)
  WHERE heat_level > 0;

  RETURN QUERY SELECT v_updated, v_heat_reduced;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_heat_decay IS 'Reduces heat for all players (call via cron job)';

-- =============================================================================
-- CHECK JAIL STATUS
-- Check if player is "jailed" due to high heat
-- =============================================================================

CREATE OR REPLACE FUNCTION check_jail_status(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  is_jailed BOOLEAN,
  heat_level INT,
  heat_until_free INT,
  estimated_hours_remaining NUMERIC
) AS $$
DECLARE
  v_player_id UUID;
  v_heat INT;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  SELECT p.heat_level INTO v_heat FROM players p WHERE p.id = v_player_id;

  RETURN QUERY SELECT
    v_heat >= 100 AS is_jailed,
    v_heat,
    CASE WHEN v_heat >= 100 THEN v_heat - 99 ELSE 0 END AS heat_until_free,
    CASE WHEN v_heat >= 100 THEN ROUND((v_heat - 99) / 2.0, 1) ELSE 0::NUMERIC END AS estimated_hours_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_jail_status IS 'Checks if player is jailed due to high heat';

-- =============================================================================
-- USE HEAT REDUCTION ITEM
-- Use a consumable to reduce heat
-- =============================================================================

CREATE OR REPLACE FUNCTION use_heat_reduction_item(p_inventory_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  heat_reduced INT,
  new_heat_level INT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_inventory RECORD;
  v_item RECORD;
  v_heat_reduction INT;
  v_current_heat INT;
  v_new_heat INT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get inventory item
  SELECT * INTO v_inventory
  FROM player_inventory
  WHERE id = p_inventory_id AND player_id = v_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found in inventory';
  END IF;

  -- Get item details
  SELECT * INTO v_item FROM items WHERE id = v_inventory.item_id;

  IF v_item.category != 'consumable' THEN
    RAISE EXCEPTION 'This item is not consumable';
  END IF;

  -- Get heat reduction amount
  v_heat_reduction := COALESCE((v_item.effects->>'reduce_heat')::INT, 0);

  IF v_heat_reduction <= 0 THEN
    RAISE EXCEPTION 'This item does not reduce heat';
  END IF;

  -- Get current heat
  SELECT p.heat_level INTO v_current_heat FROM players p WHERE p.id = v_player_id;

  -- Calculate new heat
  v_new_heat := GREATEST(0, v_current_heat - v_heat_reduction);

  -- Update player heat
  UPDATE players SET heat_level = v_new_heat WHERE id = v_player_id;

  -- Consume item
  IF v_inventory.quantity <= 1 THEN
    DELETE FROM player_inventory WHERE id = p_inventory_id;
  ELSE
    UPDATE player_inventory SET quantity = quantity - 1 WHERE id = p_inventory_id;
  END IF;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'item', 'used_heat_reduction', v_heat_reduction,
    jsonb_build_object('item_id', v_item.id, 'old_heat', v_current_heat, 'new_heat', v_new_heat));

  RETURN QUERY SELECT
    TRUE,
    v_heat_reduction,
    v_new_heat,
    ('Used ' || v_item.name || '. Heat reduced by ' || v_heat_reduction)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION use_heat_reduction_item IS 'Uses a consumable item to reduce player heat';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_available_crimes TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_crime_success_rate TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_crime_payout TO authenticated;
GRANT EXECUTE ON FUNCTION attempt_crime TO authenticated;
GRANT EXECUTE ON FUNCTION get_crime_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_crime_stats TO authenticated;
GRANT EXECUTE ON FUNCTION check_jail_status TO authenticated;
GRANT EXECUTE ON FUNCTION use_heat_reduction_item TO authenticated;
-- process_heat_decay should only be called by service role (cron job)
