-- Street Legacy: Job and Mission Functions Migration
-- Migration: 010_job_mission_functions
-- Description: SECURITY DEFINER functions for jobs and mission system including
--              job completion, mission progress tracking, and reward claiming

-- =============================================================================
-- GET AVAILABLE JOBS
-- List jobs player can do with eligibility info
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_jobs(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  id VARCHAR,
  name VARCHAR,
  description TEXT,
  category job_category_enum,
  base_payout BIGINT,
  calculated_payout BIGINT,
  energy_cost INT,
  xp_reward INT,
  cooldown_seconds INT,
  required_level INT,
  required_rep_business INT,
  player_can_work BOOLEAN,
  is_on_cooldown BOOLEAN,
  cooldown_remaining_seconds INT,
  reason_unavailable TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player RECORD;
  v_district RECORD;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  -- Get player data
  SELECT * INTO v_player FROM players WHERE id = v_player_id;

  -- Get district for economy modifier
  SELECT * INTO v_district FROM districts WHERE id = v_player.current_district_id;

  RETURN QUERY
  SELECT
    jt.id,
    jt.name,
    jt.description,
    jt.category,
    jt.payout AS base_payout,
    -- Calculate actual payout with level bonus and district economy
    (jt.payout * (1 + v_player.level * 0.05) * (v_district.economy_level / 50.0))::BIGINT AS calculated_payout,
    jt.energy_cost,
    jt.xp_reward,
    jt.cooldown_seconds,
    jt.required_level,
    jt.required_rep_business,
    -- Can work check
    (
      v_player.level >= jt.required_level
      AND v_player.rep_business >= COALESCE(jt.required_rep_business, 0)
    ) AS player_can_work,
    -- Cooldown check
    has_cooldown(v_player_id, 'job:' || jt.id) AS is_on_cooldown,
    -- Cooldown remaining
    get_cooldown_remaining(v_player_id, 'job:' || jt.id) AS cooldown_remaining_seconds,
    -- Reason if unavailable
    CASE
      WHEN v_player.level < jt.required_level THEN 'Requires level ' || jt.required_level
      WHEN v_player.rep_business < COALESCE(jt.required_rep_business, 0) THEN 'Requires ' || jt.required_rep_business || ' business rep'
      ELSE NULL
    END AS reason_unavailable
  FROM job_types jt
  WHERE jt.is_active = TRUE
  ORDER BY jt.required_level, jt.payout;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_available_jobs IS 'Lists all jobs with player eligibility and cooldown status';

-- =============================================================================
-- COMPLETE JOB
-- Execute a job and receive payment
-- =============================================================================

CREATE OR REPLACE FUNCTION complete_job(p_job_type_id VARCHAR(50))
RETURNS TABLE (
  success BOOLEAN,
  payout BIGINT,
  xp_gained INT,
  message TEXT,
  leveled_up BOOLEAN,
  new_level INT
) AS $$
DECLARE
  v_player_id UUID;
  v_player RECORD;
  v_job_type RECORD;
  v_district RECORD;
  v_payout BIGINT;
  v_xp INT;
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

  -- Get job type
  SELECT * INTO v_job_type FROM job_types WHERE id = p_job_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid job type';
  END IF;

  IF NOT v_job_type.is_active THEN
    RAISE EXCEPTION 'This job is not currently available';
  END IF;

  -- Get district
  SELECT * INTO v_district FROM districts WHERE id = v_player.current_district_id;

  -- Validation checks
  IF v_player.level < v_job_type.required_level THEN
    RAISE EXCEPTION 'You need to be level % to do this job', v_job_type.required_level;
  END IF;

  IF v_player.rep_business < COALESCE(v_job_type.required_rep_business, 0) THEN
    RAISE EXCEPTION 'You need % business reputation to do this job', v_job_type.required_rep_business;
  END IF;

  -- Check cooldown
  IF has_cooldown(v_player_id, 'job:' || p_job_type_id) THEN
    RAISE EXCEPTION 'Job on cooldown. Wait % more seconds.',
      get_cooldown_remaining(v_player_id, 'job:' || p_job_type_id);
  END IF;

  -- Check and regenerate energy
  PERFORM update_player_energy(v_player_id);
  SELECT energy INTO v_player.energy FROM players WHERE id = v_player_id;

  IF v_player.energy < v_job_type.energy_cost THEN
    RAISE EXCEPTION 'Not enough energy. Need: %, Have: %', v_job_type.energy_cost, v_player.energy;
  END IF;

  -- Consume energy
  PERFORM consume_energy(v_player_id, v_job_type.energy_cost, 'job');

  -- Set cooldown
  PERFORM set_cooldown(v_player_id, 'job:' || p_job_type_id, v_job_type.cooldown_seconds);

  -- Calculate payout with level bonus (+5% per level) and district economy
  v_payout := (v_job_type.payout * (1 + v_player.level * 0.05) * (v_district.economy_level / 50.0))::BIGINT;
  v_xp := v_job_type.xp_reward;

  -- Credit player
  PERFORM modify_player_balance(
    v_player_id,
    v_payout,
    'cash',
    'job',
    v_job_type.name || ' completed',
    NULL,
    NULL,
    NULL,
    NULL
  );

  -- Update player last_job_at
  UPDATE players
  SET last_job_at = NOW()
  WHERE id = v_player_id;

  -- Add XP
  SELECT * INTO v_level_result FROM add_player_xp(v_player_id, v_xp, 'job');
  v_leveled_up := v_level_result.leveled_up;
  v_new_level := v_level_result.new_level;

  -- Add business rep (small amount per job)
  PERFORM add_player_reputation(v_player_id, 'legit', GREATEST(1, (v_payout / 200)::INT), 'job');

  -- Record completion in job_logs
  INSERT INTO job_logs (player_id, job_type_id, district_id, payout, xp_gained, energy_spent)
  VALUES (v_player_id, p_job_type_id, v_player.current_district_id, v_payout, v_xp, v_job_type.energy_cost);

  -- Log game event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, value_numeric, metadata)
  VALUES (v_player_id, 'job', 'completed', v_player.current_district_id, v_payout,
    jsonb_build_object('job_type', p_job_type_id, 'payout', v_payout, 'xp', v_xp));

  -- Update mission progress
  PERFORM update_mission_progress(v_player_id, 'complete_job',
    jsonb_build_object('job_type', p_job_type_id, 'payout', v_payout));

  RETURN QUERY SELECT
    TRUE,
    v_payout,
    v_xp,
    ('Completed ' || v_job_type.name || ' and earned $' || v_payout)::TEXT,
    v_leveled_up,
    v_new_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_job IS 'Completes a job and grants payment and XP';

-- =============================================================================
-- GET JOB HISTORY
-- Get player's job completion history
-- =============================================================================

CREATE OR REPLACE FUNCTION get_job_history(
  p_player_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  job_type_id VARCHAR,
  job_name VARCHAR,
  district_id VARCHAR,
  district_name VARCHAR,
  payout BIGINT,
  xp_gained INT,
  completed_at TIMESTAMPTZ
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    jl.id,
    jl.job_type_id,
    jt.name AS job_name,
    jl.district_id,
    d.name AS district_name,
    jl.payout,
    jl.xp_gained,
    jl.completed_at
  FROM job_logs jl
  JOIN job_types jt ON jt.id = jl.job_type_id
  JOIN districts d ON d.id = jl.district_id
  WHERE jl.player_id = v_player_id
  ORDER BY jl.completed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_job_history IS 'Returns job completion history for a player';

-- =============================================================================
-- GET PLAYER MISSIONS
-- Get all missions for a player with full details
-- =============================================================================

CREATE OR REPLACE FUNCTION get_player_missions(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  mission_id VARCHAR,
  mission_name VARCHAR,
  mission_description TEXT,
  mission_type mission_type_enum,
  category mission_category_enum,
  status mission_status_enum,
  progress JSONB,
  requirements JSONB,
  rewards JSONB,
  required_level INT,
  is_repeatable BOOLEAN,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  sort_order INT
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    pm.id,
    pm.mission_id,
    m.name AS mission_name,
    m.description AS mission_description,
    m.mission_type,
    m.category,
    pm.status,
    pm.progress,
    m.requirements,
    m.rewards,
    m.required_level,
    m.is_repeatable,
    pm.started_at,
    pm.completed_at,
    pm.expires_at,
    m.sort_order
  FROM player_missions pm
  JOIN missions m ON m.id = pm.mission_id
  WHERE pm.player_id = v_player_id
  ORDER BY
    CASE pm.status
      WHEN 'active' THEN 1
      WHEN 'completed' THEN 2
      WHEN 'available' THEN 3
      ELSE 4
    END,
    m.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_player_missions IS 'Returns all missions for a player with status and progress';

-- =============================================================================
-- UPDATE MISSION PROGRESS (replaces stub from migration 006)
-- Update mission progress based on player actions
-- =============================================================================

CREATE OR REPLACE FUNCTION update_mission_progress(
  p_player_id UUID,
  p_action_type VARCHAR(50),
  p_action_data JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  mission_id VARCHAR,
  mission_name VARCHAR,
  status_changed BOOLEAN,
  new_status mission_status_enum,
  progress JSONB
) AS $$
DECLARE
  v_player_mission RECORD;
  v_requirement JSONB;
  v_current_count INT;
  v_required_count INT;
  v_is_complete BOOLEAN;
  v_all_complete BOOLEAN;
  v_updated_progress JSONB;
BEGIN
  -- Loop through all active missions for this player
  FOR v_player_mission IN
    SELECT pm.*, m.requirements, m.name AS mission_name
    FROM player_missions pm
    JOIN missions m ON m.id = pm.mission_id
    WHERE pm.player_id = p_player_id
    AND pm.status = 'active'
  LOOP
    v_all_complete := TRUE;
    v_updated_progress := v_player_mission.progress;

    -- Check each requirement
    FOR v_requirement IN SELECT * FROM jsonb_array_elements(v_player_mission.requirements)
    LOOP
      -- Check if this action matches the requirement type
      IF v_requirement->>'type' = p_action_type THEN
        -- Get current progress
        v_current_count := COALESCE((v_updated_progress->>p_action_type)::INT, 0);
        v_required_count := COALESCE((v_requirement->>'count')::INT, 1);

        -- Increment based on action type
        CASE p_action_type
          WHEN 'complete_job' THEN
            v_current_count := v_current_count + 1;
          WHEN 'complete_crime' THEN
            -- Only count successes if required
            IF COALESCE((v_requirement->>'require_success')::BOOLEAN, FALSE) THEN
              IF (p_action_data->>'result') = 'success' THEN
                v_current_count := v_current_count + 1;
              END IF;
            ELSE
              v_current_count := v_current_count + 1;
            END IF;
          WHEN 'buy_property' THEN
            v_current_count := v_current_count + 1;
          WHEN 'collect_income' THEN
            v_current_count := v_current_count + COALESCE((p_action_data->>'amount')::INT, 1);
          WHEN 'travel_district' THEN
            v_current_count := v_current_count + 1;
          WHEN 'open_business' THEN
            v_current_count := v_current_count + 1;
          WHEN 'earn_from_business' THEN
            v_current_count := v_current_count + COALESCE((p_action_data->>'amount')::INT, 0);
          WHEN 'claim_mission' THEN
            v_current_count := v_current_count + 1;
          ELSE
            v_current_count := v_current_count + 1;
        END CASE;

        -- Update progress tracking
        v_updated_progress := v_updated_progress || jsonb_build_object(p_action_type, v_current_count);

        -- Check if this requirement is complete
        v_is_complete := v_current_count >= v_required_count;
      ELSE
        -- Check if other requirements are complete
        v_current_count := COALESCE((v_updated_progress->>(v_requirement->>'type'))::INT, 0);
        v_required_count := COALESCE((v_requirement->>'count')::INT, 1);
        v_is_complete := v_current_count >= v_required_count;
      END IF;

      IF NOT v_is_complete THEN
        v_all_complete := FALSE;
      END IF;
    END LOOP;

    -- Update progress in database
    UPDATE player_missions
    SET progress = v_updated_progress
    WHERE id = v_player_mission.id;

    -- If all requirements complete, mark mission as completed
    IF v_all_complete THEN
      UPDATE player_missions
      SET status = 'completed', completed_at = NOW()
      WHERE id = v_player_mission.id;

      -- Log event
      INSERT INTO game_events (player_id, event_type, event_subtype, metadata)
      VALUES (p_player_id, 'mission', 'completed',
        jsonb_build_object('mission_id', v_player_mission.mission_id, 'name', v_player_mission.mission_name));

      RETURN QUERY SELECT
        v_player_mission.mission_id,
        v_player_mission.mission_name,
        TRUE,
        'completed'::mission_status_enum,
        v_updated_progress;
    END IF;
  END LOOP;

  -- Return empty if no missions completed
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_mission_progress IS 'Updates progress on active missions based on player actions';

-- =============================================================================
-- CLAIM MISSION REWARD
-- Claim rewards for a completed mission
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_mission_reward(p_player_mission_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  cash_reward BIGINT,
  xp_reward INT,
  rep_street_reward INT,
  rep_legit_reward INT,
  items_granted TEXT[],
  message TEXT,
  leveled_up BOOLEAN,
  new_level INT,
  next_mission_id VARCHAR
) AS $$
DECLARE
  v_player_id UUID;
  v_player_mission RECORD;
  v_rewards JSONB;
  v_cash BIGINT := 0;
  v_xp INT := 0;
  v_rep_street INT := 0;
  v_rep_legit INT := 0;
  v_items TEXT[] := '{}';
  v_level_result RECORD;
  v_leveled_up BOOLEAN := FALSE;
  v_new_level INT;
  v_next_mission_id VARCHAR;
  v_item RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get player mission
  SELECT pm.*, m.rewards, m.name AS mission_name, m.mission_type, m.sort_order
  INTO v_player_mission
  FROM player_missions pm
  JOIN missions m ON m.id = pm.mission_id
  WHERE pm.id = p_player_mission_id AND pm.player_id = v_player_id
  FOR UPDATE OF pm;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF v_player_mission.status != 'completed' THEN
    RAISE EXCEPTION 'Mission is not completed. Status: %', v_player_mission.status;
  END IF;

  v_rewards := v_player_mission.rewards;

  -- Extract rewards
  v_cash := COALESCE((v_rewards->>'cash')::BIGINT, 0);
  v_xp := COALESCE((v_rewards->>'xp')::INT, 0);
  v_rep_street := COALESCE((v_rewards->>'rep_street')::INT, COALESCE((v_rewards->>'rep_crime')::INT, 0));
  v_rep_legit := COALESCE((v_rewards->>'rep_legit')::INT, COALESCE((v_rewards->>'rep_business')::INT, 0));

  -- Grant cash
  IF v_cash > 0 THEN
    PERFORM modify_player_balance(
      v_player_id,
      v_cash,
      'cash',
      'system',
      'Mission reward: ' || v_player_mission.mission_name,
      NULL,
      NULL,
      NULL,
      NULL
    );
  END IF;

  -- Grant XP
  IF v_xp > 0 THEN
    SELECT * INTO v_level_result FROM add_player_xp(v_player_id, v_xp, 'mission');
    v_leveled_up := v_level_result.leveled_up;
    v_new_level := v_level_result.new_level;
  ELSE
    SELECT level INTO v_new_level FROM players WHERE id = v_player_id;
  END IF;

  -- Grant rep
  IF v_rep_street > 0 THEN
    PERFORM add_player_reputation(v_player_id, 'street', v_rep_street, 'mission');
  END IF;
  IF v_rep_legit > 0 THEN
    PERFORM add_player_reputation(v_player_id, 'legit', v_rep_legit, 'mission');
  END IF;

  -- Grant items (if any)
  IF v_rewards->'items' IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_rewards->'items')
    LOOP
      INSERT INTO player_inventory (player_id, item_id, quantity, acquired_via)
      VALUES (v_player_id, v_item->>'id', COALESCE((v_item->>'quantity')::INT, 1), 'reward')
      ON CONFLICT (player_id, item_id)
      DO UPDATE SET quantity = player_inventory.quantity + COALESCE((v_item->>'quantity')::INT, 1);

      v_items := array_append(v_items, v_item->>'id');
    END LOOP;
  END IF;

  -- Mark as claimed
  UPDATE player_missions
  SET status = 'claimed', claimed_at = NOW()
  WHERE id = p_player_mission_id;

  -- For onboarding missions, activate the next one
  IF v_player_mission.mission_type = 'onboarding' THEN
    UPDATE player_missions pm
    SET status = 'active', started_at = NOW()
    FROM missions m
    WHERE pm.mission_id = m.id
    AND pm.player_id = v_player_id
    AND pm.status = 'available'
    AND m.mission_type = 'onboarding'
    AND m.sort_order = v_player_mission.sort_order + 1
    RETURNING pm.mission_id INTO v_next_mission_id;
  END IF;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'mission', 'claimed', v_cash,
    jsonb_build_object('mission_id', v_player_mission.mission_id, 'rewards', v_rewards));

  RETURN QUERY SELECT
    TRUE,
    v_cash,
    v_xp,
    v_rep_street,
    v_rep_legit,
    v_items,
    ('Claimed rewards for: ' || v_player_mission.mission_name)::TEXT,
    v_leveled_up,
    v_new_level,
    v_next_mission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION claim_mission_reward IS 'Claims rewards for a completed mission';

-- =============================================================================
-- START MISSION
-- Activate an available mission
-- =============================================================================

CREATE OR REPLACE FUNCTION start_mission(p_player_mission_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  mission_id VARCHAR,
  mission_name VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_mission RECORD;
  v_player RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get player mission
  SELECT pm.*, m.name AS mission_name, m.required_level, m.required_missions, m.time_limit_minutes
  INTO v_player_mission
  FROM player_missions pm
  JOIN missions m ON m.id = pm.mission_id
  WHERE pm.id = p_player_mission_id AND pm.player_id = v_player_id
  FOR UPDATE OF pm;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF v_player_mission.status != 'available' THEN
    RAISE EXCEPTION 'Mission is not available. Status: %', v_player_mission.status;
  END IF;

  -- Get player
  SELECT * INTO v_player FROM players WHERE id = v_player_id;

  -- Check level requirement
  IF v_player.level < v_player_mission.required_level THEN
    RAISE EXCEPTION 'You need to be level % to start this mission', v_player_mission.required_level;
  END IF;

  -- Check prerequisite missions
  IF v_player_mission.required_missions IS NOT NULL AND array_length(v_player_mission.required_missions, 1) > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM player_missions pm
      WHERE pm.player_id = v_player_id
      AND pm.mission_id = ANY(v_player_mission.required_missions)
      AND pm.status = 'claimed'
    ) THEN
      RAISE EXCEPTION 'You must complete prerequisite missions first';
    END IF;
  END IF;

  -- Activate mission
  UPDATE player_missions
  SET
    status = 'active',
    started_at = NOW(),
    progress = '{}'::jsonb,
    expires_at = CASE
      WHEN v_player_mission.time_limit_minutes IS NOT NULL
      THEN NOW() + (v_player_mission.time_limit_minutes || ' minutes')::INTERVAL
      ELSE NULL
    END
  WHERE id = p_player_mission_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, metadata)
  VALUES (v_player_id, 'mission', 'started',
    jsonb_build_object('mission_id', v_player_mission.mission_id, 'name', v_player_mission.mission_name));

  RETURN QUERY SELECT
    TRUE,
    v_player_mission.mission_id,
    v_player_mission.mission_name,
    ('Started mission: ' || v_player_mission.mission_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION start_mission IS 'Starts an available mission';

-- =============================================================================
-- RESET DAILY MISSIONS
-- Reset daily missions for all players (scheduled job)
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_daily_missions()
RETURNS TABLE (missions_reset INT) AS $$
DECLARE
  v_count INT;
BEGIN
  -- Reset claimed daily missions to available
  WITH reset AS (
    UPDATE player_missions pm
    SET
      status = 'available',
      progress = '{}'::jsonb,
      started_at = NULL,
      completed_at = NULL,
      claimed_at = NULL
    FROM missions m
    WHERE pm.mission_id = m.id
    AND m.mission_type = 'daily'
    AND m.is_repeatable = TRUE
    AND pm.status = 'claimed'
    AND pm.claimed_at < CURRENT_DATE
    RETURNING pm.id
  )
  SELECT COUNT(*) INTO v_count FROM reset;

  -- Also handle expired missions
  UPDATE player_missions
  SET status = 'expired'
  WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_daily_missions IS 'Resets daily missions for all players (call via cron)';

-- =============================================================================
-- RESET WEEKLY MISSIONS
-- Reset weekly missions for all players (scheduled job)
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_weekly_missions()
RETURNS TABLE (missions_reset INT) AS $$
DECLARE
  v_count INT;
BEGIN
  WITH reset AS (
    UPDATE player_missions pm
    SET
      status = 'available',
      progress = '{}'::jsonb,
      started_at = NULL,
      completed_at = NULL,
      claimed_at = NULL
    FROM missions m
    WHERE pm.mission_id = m.id
    AND m.mission_type = 'weekly'
    AND m.is_repeatable = TRUE
    AND pm.status = 'claimed'
    AND pm.claimed_at < date_trunc('week', CURRENT_DATE)
    RETURNING pm.id
  )
  SELECT COUNT(*) INTO v_count FROM reset;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_weekly_missions IS 'Resets weekly missions for all players (call via cron)';

-- =============================================================================
-- ASSIGN MISSIONS TO PLAYER
-- Assign all applicable missions to a player (called on profile creation)
-- =============================================================================

CREATE OR REPLACE FUNCTION assign_player_missions(p_player_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_mission RECORD;
BEGIN
  -- Assign onboarding missions (first one active, rest available)
  FOR v_mission IN
    SELECT m.id, m.sort_order
    FROM missions m
    WHERE m.mission_type = 'onboarding'
    AND m.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM player_missions pm
      WHERE pm.player_id = p_player_id
      AND pm.mission_id = m.id
    )
    ORDER BY m.sort_order
  LOOP
    INSERT INTO player_missions (player_id, mission_id, status, started_at)
    VALUES (
      p_player_id,
      v_mission.id,
      CASE WHEN v_mission.sort_order = 1 THEN 'active' ELSE 'available' END,
      CASE WHEN v_mission.sort_order = 1 THEN NOW() ELSE NULL END
    );
    v_count := v_count + 1;
  END LOOP;

  -- Assign daily missions
  FOR v_mission IN
    SELECT m.id
    FROM missions m
    WHERE m.mission_type = 'daily'
    AND m.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM player_missions pm
      WHERE pm.player_id = p_player_id
      AND pm.mission_id = m.id
    )
  LOOP
    INSERT INTO player_missions (player_id, mission_id, status)
    VALUES (p_player_id, v_mission.id, 'available');
    v_count := v_count + 1;
  END LOOP;

  -- Assign weekly missions
  FOR v_mission IN
    SELECT m.id
    FROM missions m
    WHERE m.mission_type = 'weekly'
    AND m.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM player_missions pm
      WHERE pm.player_id = p_player_id
      AND pm.mission_id = m.id
    )
  LOOP
    INSERT INTO player_missions (player_id, mission_id, status)
    VALUES (p_player_id, v_mission.id, 'available');
    v_count := v_count + 1;
  END LOOP;

  -- Assign story missions (only if prerequisites met)
  FOR v_mission IN
    SELECT m.id
    FROM missions m
    WHERE m.mission_type = 'story'
    AND m.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM player_missions pm
      WHERE pm.player_id = p_player_id
      AND pm.mission_id = m.id
    )
  LOOP
    INSERT INTO player_missions (player_id, mission_id, status)
    VALUES (p_player_id, v_mission.id, 'available');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_player_missions IS 'Assigns all applicable missions to a player';

-- =============================================================================
-- GET JOB STATS
-- Get player's job statistics
-- =============================================================================

CREATE OR REPLACE FUNCTION get_job_stats(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_jobs_completed BIGINT,
  total_earnings BIGINT,
  total_xp_earned BIGINT,
  favorite_job VARCHAR,
  most_profitable_job VARCHAR
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_jobs_completed,
    COALESCE(SUM(jl.payout), 0)::BIGINT AS total_earnings,
    COALESCE(SUM(jl.xp_gained), 0)::BIGINT AS total_xp_earned,
    (
      SELECT jt.name FROM job_logs jl2
      JOIN job_types jt ON jt.id = jl2.job_type_id
      WHERE jl2.player_id = v_player_id
      GROUP BY jt.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS favorite_job,
    (
      SELECT jt.name FROM job_logs jl2
      JOIN job_types jt ON jt.id = jl2.job_type_id
      WHERE jl2.player_id = v_player_id
      GROUP BY jt.name
      ORDER BY SUM(jl2.payout) DESC
      LIMIT 1
    ) AS most_profitable_job
  FROM job_logs jl
  WHERE jl.player_id = v_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_job_stats IS 'Returns job statistics for a player';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_available_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION complete_job TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_missions TO authenticated;
GRANT EXECUTE ON FUNCTION update_mission_progress TO authenticated;
GRANT EXECUTE ON FUNCTION claim_mission_reward TO authenticated;
GRANT EXECUTE ON FUNCTION start_mission TO authenticated;
GRANT EXECUTE ON FUNCTION assign_player_missions TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_stats TO authenticated;
-- reset_daily_missions and reset_weekly_missions should only be called by service role (cron)
