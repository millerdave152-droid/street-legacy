-- Street Legacy: Additional Scheduled Functions Migration
-- Migration: 016_scheduled_functions
-- Description: Additional scheduled functions for energy regeneration, business income, and ban expiration

-- =============================================================================
-- REGENERATE PLAYER ENERGY
-- Runs every 10 minutes - restores 5 energy per interval
-- =============================================================================

CREATE OR REPLACE FUNCTION regenerate_player_energy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Regenerate 5 energy every 10 minutes, up to max_energy
  UPDATE players
  SET
    energy = LEAST(energy + 5, max_energy),
    energy_updated_at = NOW()
  WHERE energy < max_energy
    AND is_banned = FALSE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'players_updated', v_updated_count,
    'energy_restored', 5,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION regenerate_player_energy IS 'Regenerates 5 energy for all players below max, runs every 10 minutes';

-- =============================================================================
-- ACCUMULATE BUSINESS INCOME
-- Runs every hour - accumulates income for active businesses
-- =============================================================================

CREATE OR REPLACE FUNCTION accumulate_business_income()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business RECORD;
  v_income BIGINT;
  v_total_accumulated BIGINT := 0;
  v_businesses_processed INTEGER := 0;
  v_efficiency_bonus NUMERIC;
BEGIN
  FOR v_business IN
    SELECT
      b.id,
      b.owner_id,
      b.upgrade_level,
      b.efficiency_bonus,
      b.employee_count,
      bt.income_per_hour,
      bt.cost_per_hour,
      bt.max_employees
    FROM businesses b
    JOIN business_types bt ON b.business_type_id = bt.id
    WHERE b.status = 'open'
      AND b.owner_id IS NOT NULL
  LOOP
    -- Calculate hourly income with upgrade bonus (20% per level)
    v_efficiency_bonus := 1.0 + (v_business.upgrade_level * 0.20) + (v_business.efficiency_bonus / 100.0);

    -- Employee bonus: 10% per employee
    v_efficiency_bonus := v_efficiency_bonus + (v_business.employee_count * 0.10);

    v_income := FLOOR(v_business.income_per_hour * v_efficiency_bonus) - v_business.cost_per_hour;

    -- Ensure minimum income of 0
    v_income := GREATEST(v_income, 0);

    -- Update business with accumulated income
    UPDATE businesses
    SET
      total_revenue = total_revenue + GREATEST(v_income, 0),
      total_expenses = total_expenses + v_business.cost_per_hour
    WHERE id = v_business.id;

    v_total_accumulated := v_total_accumulated + v_income;
    v_businesses_processed := v_businesses_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'businesses_processed', v_businesses_processed,
    'total_accumulated', v_total_accumulated,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION accumulate_business_income IS 'Accumulates hourly income for all active businesses';

-- =============================================================================
-- CHECK BAN EXPIRATIONS
-- Runs hourly - automatically unbans players with expired temporary bans
-- =============================================================================

CREATE OR REPLACE FUNCTION check_ban_expirations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unbanned_count INTEGER;
BEGIN
  -- Note: ban_until column may need to be added if not exists
  -- For now, this is a placeholder that can be enabled when temp bans are implemented

  -- Check for any players with expired bans (if ban_until column exists)
  -- UPDATE players
  -- SET is_banned = FALSE,
  --     ban_reason = NULL
  -- WHERE is_banned = TRUE
  --   AND ban_until IS NOT NULL
  --   AND ban_until < NOW();

  -- GET DIAGNOSTICS v_unbanned_count = ROW_COUNT;

  v_unbanned_count := 0;

  RETURN jsonb_build_object(
    'players_unbanned', v_unbanned_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION check_ban_expirations IS 'Checks and removes expired temporary bans';

-- =============================================================================
-- UPDATE DISTRICT STATISTICS
-- Runs daily - updates district crime rate and economy based on activity
-- =============================================================================

CREATE OR REPLACE FUNCTION update_district_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_district RECORD;
  v_crime_count INTEGER;
  v_transaction_count INTEGER;
  v_new_crime_rate INTEGER;
  v_new_economy_level INTEGER;
  v_updated_count INTEGER := 0;
BEGIN
  FOR v_district IN SELECT id, crime_rate, economy_level FROM districts LOOP
    -- Count crimes in last 24 hours in this district
    SELECT COUNT(*) INTO v_crime_count
    FROM crime_logs cl
    WHERE cl.district_id = v_district.id
      AND cl.attempted_at > NOW() - INTERVAL '24 hours';

    -- Count transactions in last 24 hours from players in this district
    SELECT COUNT(*) INTO v_transaction_count
    FROM transactions t
    JOIN players p ON t.player_id = p.id
    WHERE p.current_district_id = v_district.id
      AND t.created_at > NOW() - INTERVAL '24 hours';

    -- Calculate new crime rate (blend old with new, max 100)
    v_new_crime_rate := LEAST(100, GREATEST(10,
      (v_district.crime_rate * 0.7 + LEAST(v_crime_count * 2, 100) * 0.3)::INTEGER
    ));

    -- Calculate new economy level (blend old with new, max 100)
    v_new_economy_level := LEAST(100, GREATEST(20,
      (v_district.economy_level * 0.7 + LEAST(v_transaction_count / 5, 100) * 0.3)::INTEGER
    ));

    -- Update district
    UPDATE districts
    SET
      crime_rate = v_new_crime_rate,
      economy_level = v_new_economy_level
    WHERE id = v_district.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'districts_updated', v_updated_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION update_district_statistics IS 'Updates district crime rate and economy based on 24h activity';

-- =============================================================================
-- EXPIRE NEWBIE PROTECTION
-- Runs daily - removes newbie protection from players past their protection period
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_newbie_protection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE players
  SET newbie_protected = FALSE
  WHERE newbie_protected = TRUE
    AND (
      newbie_protection_until < NOW()
      OR level >= 5
    );

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'players_expired', v_expired_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION expire_newbie_protection IS 'Removes newbie protection from expired or leveled players';

-- =============================================================================
-- UPDATE CREW STATISTICS
-- Runs daily - updates crew level, influence, and territory control
-- =============================================================================

CREATE OR REPLACE FUNCTION update_crew_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_crew RECORD;
  v_total_member_level INTEGER;
  v_new_xp BIGINT;
  v_updated_count INTEGER := 0;
BEGIN
  FOR v_crew IN
    SELECT c.id, c.xp, c.level
    FROM crews c
    WHERE c.member_count > 0
  LOOP
    -- Calculate crew XP from member activities
    SELECT COALESCE(SUM(p.xp), 0) / 100 INTO v_new_xp
    FROM crew_members cm
    JOIN players p ON cm.player_id = p.id
    WHERE cm.crew_id = v_crew.id
      AND cm.is_active = TRUE;

    -- Update crew XP and potentially level
    UPDATE crews
    SET xp = xp + v_new_xp
    WHERE id = v_crew.id;

    -- Check for level up (every 10000 XP)
    IF (v_crew.xp + v_new_xp) >= (v_crew.level * 10000) AND v_crew.level < 20 THEN
      UPDATE crews
      SET
        level = level + 1,
        max_members = max_members + 5  -- +5 slots per level
      WHERE id = v_crew.id;
    END IF;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Update district control
  PERFORM calculate_district_controller(id) FROM districts;

  RETURN jsonb_build_object(
    'crews_updated', v_updated_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION update_crew_statistics IS 'Updates crew XP, levels, and territory control';

-- =============================================================================
-- UPDATED HOURLY MAINTENANCE (include new functions)
-- =============================================================================

CREATE OR REPLACE FUNCTION run_hourly_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_results jsonb := '{}'::jsonb;
BEGIN
  v_results := v_results || jsonb_build_object('heat_decay', process_heat_decay());
  v_results := v_results || jsonb_build_object('expired_listings', expire_marketplace_listings());
  v_results := v_results || jsonb_build_object('mission_expirations', check_mission_expirations());
  v_results := v_results || jsonb_build_object('cooldowns_cleanup', cleanup_expired_cooldowns_scheduled());
  v_results := v_results || jsonb_build_object('crew_invites', expire_crew_invites_scheduled());
  v_results := v_results || jsonb_build_object('jail_releases', process_jail_releases());
  v_results := v_results || jsonb_build_object('ban_expirations', check_ban_expirations());
  v_results := v_results || jsonb_build_object('business_income', accumulate_business_income());

  -- Log the maintenance run
  INSERT INTO game_events (event_type, event_subtype, metadata)
  VALUES ('system', 'hourly_maintenance', v_results);

  RETURN v_results;
END;
$$;

-- =============================================================================
-- UPDATED DAILY MAINTENANCE (include new functions)
-- =============================================================================

CREATE OR REPLACE FUNCTION run_daily_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_results jsonb := '{}'::jsonb;
BEGIN
  v_results := v_results || jsonb_build_object('property_taxes', collect_property_taxes());
  v_results := v_results || jsonb_build_object('daily_missions', reset_daily_missions_scheduled());
  v_results := v_results || jsonb_build_object('property_values', update_property_values());
  v_results := v_results || jsonb_build_object('district_stats', update_district_statistics());
  v_results := v_results || jsonb_build_object('newbie_protection', expire_newbie_protection());
  v_results := v_results || jsonb_build_object('crew_stats', update_crew_statistics());

  -- Log the maintenance run
  INSERT INTO game_events (event_type, event_subtype, metadata)
  VALUES ('system', 'daily_maintenance', v_results);

  RETURN v_results;
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

REVOKE ALL ON FUNCTION regenerate_player_energy() FROM PUBLIC;
REVOKE ALL ON FUNCTION accumulate_business_income() FROM PUBLIC;
REVOKE ALL ON FUNCTION check_ban_expirations() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_district_statistics() FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_newbie_protection() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_crew_statistics() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION regenerate_player_energy() TO service_role;
GRANT EXECUTE ON FUNCTION accumulate_business_income() TO service_role;
GRANT EXECUTE ON FUNCTION check_ban_expirations() TO service_role;
GRANT EXECUTE ON FUNCTION update_district_statistics() TO service_role;
GRANT EXECUTE ON FUNCTION expire_newbie_protection() TO service_role;
GRANT EXECUTE ON FUNCTION update_crew_statistics() TO service_role;
