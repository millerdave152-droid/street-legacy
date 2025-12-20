-- Street Legacy: Player Management Functions Migration
-- Migration: 006_player_functions
-- Description: SECURITY DEFINER functions for player operations that bypass RLS
--              to perform validated, atomic operations

-- =============================================================================
-- CREATE PLAYER PROFILE
-- Called after auth signup to create initial player record
-- =============================================================================

CREATE OR REPLACE FUNCTION create_player_profile(
  p_user_id UUID,
  p_username VARCHAR(30),
  p_starter_build starter_build_enum DEFAULT 'hustler'
)
RETURNS UUID AS $$
DECLARE
  v_player_id UUID;
  v_starting_cash BIGINT;
  v_starting_district VARCHAR(50) := 'scarborough';
BEGIN
  -- Validate username
  IF LENGTH(p_username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters';
  END IF;

  IF p_username !~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;

  -- Check username availability
  IF EXISTS (SELECT 1 FROM players WHERE LOWER(username) = LOWER(p_username)) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Check user doesn't already have a player
  IF EXISTS (SELECT 1 FROM players WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already has a player profile';
  END IF;

  -- Set starting cash based on build
  v_starting_cash := CASE p_starter_build
    WHEN 'hustler' THEN 5000
    WHEN 'enforcer' THEN 3000
    WHEN 'connector' THEN 4000
    WHEN 'schemer' THEN 6000
    ELSE 5000
  END;

  -- Create player record
  INSERT INTO players (
    user_id,
    username,
    starter_build,
    cash,
    bank,
    current_district,
    home_district,
    energy,
    max_energy,
    level,
    xp,
    xp_to_next_level,
    reputation_legit,
    reputation_street,
    newbie_protection_until
  ) VALUES (
    p_user_id,
    p_username,
    p_starter_build,
    v_starting_cash,
    0,
    v_starting_district,
    v_starting_district,
    100,
    100,
    1,
    0,
    1000,
    0,
    0,
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id INTO v_player_id;

  -- Log the creation event
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    district_id,
    value_numeric,
    metadata
  ) VALUES (
    v_player_id,
    'player',
    'profile_created',
    v_starting_district,
    v_starting_cash,
    jsonb_build_object(
      'username', p_username,
      'starter_build', p_starter_build
    )
  );

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_player_profile IS 'Creates a new player profile after auth signup';

-- =============================================================================
-- GET PLAYER WITH ENERGY
-- Returns player data with calculated current energy based on regeneration
-- =============================================================================

CREATE OR REPLACE FUNCTION get_player_with_energy(p_player_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username VARCHAR(30),
  starter_build starter_build_enum,
  cash BIGINT,
  bank BIGINT,
  current_district VARCHAR(50),
  home_district VARCHAR(50),
  current_energy INT,
  max_energy INT,
  level INT,
  xp BIGINT,
  xp_to_next_level BIGINT,
  reputation_legit INT,
  reputation_street INT,
  crew_id UUID,
  newbie_protection_until TIMESTAMPTZ,
  is_online BOOLEAN,
  last_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_player RECORD;
  v_minutes_since_update INT;
  v_energy_regenerated INT;
  v_calculated_energy INT;
BEGIN
  -- Get player record
  SELECT p.* INTO v_player
  FROM players p
  WHERE p.id = p_player_id;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Calculate energy regeneration (1 energy per 2 minutes)
  v_minutes_since_update := EXTRACT(EPOCH FROM (NOW() - v_player.energy_updated_at)) / 60;
  v_energy_regenerated := v_minutes_since_update / 2;
  v_calculated_energy := LEAST(v_player.energy + v_energy_regenerated, v_player.max_energy);

  -- Return player with calculated energy
  RETURN QUERY SELECT
    v_player.id,
    v_player.user_id,
    v_player.username,
    v_player.starter_build,
    v_player.cash,
    v_player.bank,
    v_player.current_district,
    v_player.home_district,
    v_calculated_energy,
    v_player.max_energy,
    v_player.level,
    v_player.xp,
    v_player.xp_to_next_level,
    v_player.reputation_legit,
    v_player.reputation_street,
    v_player.crew_id,
    v_player.newbie_protection_until,
    v_player.is_online,
    v_player.last_action_at,
    v_player.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_player_with_energy IS 'Returns player data with calculated current energy';

-- =============================================================================
-- UPDATE PLAYER ENERGY
-- Regenerates energy based on time elapsed and updates the stored value
-- =============================================================================

CREATE OR REPLACE FUNCTION update_player_energy(p_player_id UUID)
RETURNS INT AS $$
DECLARE
  v_player RECORD;
  v_minutes_since_update INT;
  v_energy_regenerated INT;
  v_new_energy INT;
BEGIN
  -- Get player with lock
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Calculate energy regeneration (1 energy per 2 minutes)
  v_minutes_since_update := EXTRACT(EPOCH FROM (NOW() - v_player.energy_updated_at)) / 60;
  v_energy_regenerated := v_minutes_since_update / 2;
  v_new_energy := LEAST(v_player.energy + v_energy_regenerated, v_player.max_energy);

  -- Only update if energy changed
  IF v_new_energy > v_player.energy THEN
    UPDATE players
    SET
      energy = v_new_energy,
      energy_updated_at = NOW()
    WHERE id = p_player_id;
  END IF;

  RETURN v_new_energy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_player_energy IS 'Regenerates and updates player energy based on time elapsed';

-- =============================================================================
-- CONSUME ENERGY
-- Deducts energy for actions, returns success/failure
-- =============================================================================

CREATE OR REPLACE FUNCTION consume_energy(
  p_player_id UUID,
  p_amount INT,
  p_action_type VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_energy INT;
BEGIN
  -- First regenerate energy
  v_current_energy := update_player_energy(p_player_id);

  -- Check if enough energy
  IF v_current_energy < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct energy
  UPDATE players
  SET
    energy = energy - p_amount,
    energy_updated_at = NOW(),
    last_action_at = NOW()
  WHERE id = p_player_id;

  -- Log energy consumption if action type provided
  IF p_action_type IS NOT NULL THEN
    INSERT INTO game_events (
      player_id,
      event_type,
      event_subtype,
      value_numeric,
      metadata
    ) VALUES (
      p_player_id,
      'energy',
      'consumed',
      p_amount,
      jsonb_build_object('action_type', p_action_type)
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION consume_energy IS 'Deducts energy for player actions';

-- =============================================================================
-- ADD PLAYER XP
-- Adds XP and handles level ups, returns new level if leveled up
-- =============================================================================

CREATE OR REPLACE FUNCTION add_player_xp(
  p_player_id UUID,
  p_xp_amount BIGINT,
  p_source VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  new_xp BIGINT,
  new_level INT,
  leveled_up BOOLEAN,
  levels_gained INT
) AS $$
DECLARE
  v_player RECORD;
  v_new_xp BIGINT;
  v_new_level INT;
  v_new_xp_to_next BIGINT;
  v_levels_gained INT := 0;
  v_max_level INT := 100;
BEGIN
  -- Get player with lock
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  v_new_xp := v_player.xp + p_xp_amount;
  v_new_level := v_player.level;
  v_new_xp_to_next := v_player.xp_to_next_level;

  -- Process level ups
  WHILE v_new_xp >= v_new_xp_to_next AND v_new_level < v_max_level LOOP
    v_new_xp := v_new_xp - v_new_xp_to_next;
    v_new_level := v_new_level + 1;
    v_levels_gained := v_levels_gained + 1;
    -- XP required increases by 15% per level
    v_new_xp_to_next := FLOOR(v_new_xp_to_next * 1.15);
  END LOOP;

  -- Cap XP at max level
  IF v_new_level >= v_max_level THEN
    v_new_level := v_max_level;
    v_new_xp := 0;
    v_new_xp_to_next := 0;
  END IF;

  -- Update player
  UPDATE players
  SET
    xp = v_new_xp,
    level = v_new_level,
    xp_to_next_level = v_new_xp_to_next,
    -- Increase max energy on level up (+2 per level)
    max_energy = 100 + (v_new_level - 1) * 2,
    last_action_at = NOW()
  WHERE id = p_player_id;

  -- Log XP gain
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    value_numeric,
    metadata
  ) VALUES (
    p_player_id,
    'xp',
    COALESCE(p_source, 'generic'),
    p_xp_amount,
    jsonb_build_object(
      'old_level', v_player.level,
      'new_level', v_new_level,
      'levels_gained', v_levels_gained
    )
  );

  -- Log level up if occurred
  IF v_levels_gained > 0 THEN
    INSERT INTO game_events (
      player_id,
      event_type,
      event_subtype,
      value_numeric,
      metadata
    ) VALUES (
      p_player_id,
      'player',
      'level_up',
      v_new_level,
      jsonb_build_object(
        'old_level', v_player.level,
        'levels_gained', v_levels_gained
      )
    );
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_levels_gained > 0), v_levels_gained;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_player_xp IS 'Adds XP to player and handles level ups';

-- =============================================================================
-- MODIFY PLAYER BALANCE
-- Central function for ALL currency changes, creates transaction record
-- =============================================================================

CREATE OR REPLACE FUNCTION modify_player_balance(
  p_player_id UUID,
  p_amount BIGINT,
  p_currency currency_enum,
  p_domain transaction_domain_enum,
  p_description TEXT,
  p_related_player_id UUID DEFAULT NULL,
  p_related_property_id UUID DEFAULT NULL,
  p_related_business_id UUID DEFAULT NULL,
  p_related_crew_id UUID DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_player RECORD;
  v_new_balance BIGINT;
  v_balance_before BIGINT;
BEGIN
  -- Get player with lock
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Get current balance based on currency
  v_balance_before := CASE p_currency
    WHEN 'cash' THEN v_player.cash
    WHEN 'bank' THEN v_player.bank
  END;

  -- Calculate new balance
  v_new_balance := v_balance_before + p_amount;

  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient funds: have %, need %', v_balance_before, ABS(p_amount);
  END IF;

  -- Update appropriate balance
  IF p_currency = 'cash' THEN
    UPDATE players SET cash = v_new_balance, last_action_at = NOW() WHERE id = p_player_id;
  ELSE
    UPDATE players SET bank = v_new_balance, last_action_at = NOW() WHERE id = p_player_id;
  END IF;

  -- Create immutable transaction record
  INSERT INTO transactions (
    player_id,
    amount,
    currency,
    balance_before,
    balance_after,
    domain,
    description,
    related_player_id,
    property_id,
    business_id,
    crew_id
  ) VALUES (
    p_player_id,
    p_amount,
    p_currency,
    v_balance_before,
    v_new_balance,
    p_domain,
    p_description,
    p_related_player_id,
    p_related_property_id,
    p_related_business_id,
    p_related_crew_id
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION modify_player_balance IS 'Central function for all currency changes with transaction logging';

-- =============================================================================
-- TRAVEL TO DISTRICT
-- Moves player to another district, validates and consumes energy
-- =============================================================================

CREATE OR REPLACE FUNCTION travel_to_district(
  p_player_id UUID,
  p_district_id VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_player RECORD;
  v_district RECORD;
  v_travel_cost INT := 5; -- Base energy cost
BEGIN
  -- Get player
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Check not already in district
  IF v_player.current_district = p_district_id THEN
    RAISE EXCEPTION 'Already in this district';
  END IF;

  -- Validate district exists
  SELECT * INTO v_district
  FROM districts
  WHERE id = p_district_id;

  IF v_district IS NULL THEN
    RAISE EXCEPTION 'District not found';
  END IF;

  -- Check level requirement
  IF v_player.level < v_district.level_required THEN
    RAISE EXCEPTION 'Level % required to enter %', v_district.level_required, v_district.name;
  END IF;

  -- Consume energy for travel
  IF NOT consume_energy(p_player_id, v_travel_cost, 'travel') THEN
    RAISE EXCEPTION 'Not enough energy to travel';
  END IF;

  -- Update player location
  UPDATE players
  SET
    current_district = p_district_id,
    last_action_at = NOW()
  WHERE id = p_player_id;

  -- Log travel event
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    district_id,
    metadata
  ) VALUES (
    p_player_id,
    'travel',
    'district_change',
    p_district_id,
    jsonb_build_object(
      'from_district', v_player.current_district,
      'to_district', p_district_id
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION travel_to_district IS 'Moves player to another district with energy cost';

-- =============================================================================
-- ADD PLAYER REPUTATION
-- Modifies reputation scores (street or legit)
-- =============================================================================

CREATE OR REPLACE FUNCTION add_player_reputation(
  p_player_id UUID,
  p_reputation_type VARCHAR(10), -- 'street' or 'legit'
  p_amount INT,
  p_source VARCHAR(50) DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_player RECORD;
  v_new_reputation INT;
  v_min_rep INT := -1000;
  v_max_rep INT := 1000;
BEGIN
  -- Validate reputation type
  IF p_reputation_type NOT IN ('street', 'legit') THEN
    RAISE EXCEPTION 'Invalid reputation type: must be street or legit';
  END IF;

  -- Get player with lock
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Calculate new reputation (clamped to bounds)
  IF p_reputation_type = 'street' THEN
    v_new_reputation := GREATEST(v_min_rep, LEAST(v_max_rep, v_player.reputation_street + p_amount));
    UPDATE players SET reputation_street = v_new_reputation WHERE id = p_player_id;
  ELSE
    v_new_reputation := GREATEST(v_min_rep, LEAST(v_max_rep, v_player.reputation_legit + p_amount));
    UPDATE players SET reputation_legit = v_new_reputation WHERE id = p_player_id;
  END IF;

  -- Log reputation change
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    value_numeric,
    metadata
  ) VALUES (
    p_player_id,
    'reputation',
    p_reputation_type,
    p_amount,
    jsonb_build_object(
      'source', COALESCE(p_source, 'unknown'),
      'new_value', v_new_reputation
    )
  );

  RETURN v_new_reputation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_player_reputation IS 'Modifies player reputation (street or legit)';

-- =============================================================================
-- CHECK NEWBIE PROTECTION
-- Checks if player has newbie protection, optionally removes it
-- =============================================================================

CREATE OR REPLACE FUNCTION check_newbie_protection(
  p_player_id UUID,
  p_remove_if_expired BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_player RECORD;
  v_is_protected BOOLEAN;
BEGIN
  -- Get player
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Check if protection is active
  v_is_protected := v_player.newbie_protection_until IS NOT NULL
                    AND v_player.newbie_protection_until > NOW();

  -- Remove expired protection if requested
  IF p_remove_if_expired AND NOT v_is_protected AND v_player.newbie_protection_until IS NOT NULL THEN
    UPDATE players
    SET newbie_protection_until = NULL
    WHERE id = p_player_id;

    -- Log protection expiry
    INSERT INTO game_events (
      player_id,
      event_type,
      event_subtype,
      metadata
    ) VALUES (
      p_player_id,
      'player',
      'newbie_protection_expired',
      jsonb_build_object('expired_at', v_player.newbie_protection_until)
    );
  END IF;

  RETURN v_is_protected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_newbie_protection IS 'Checks if player has newbie protection status';

-- =============================================================================
-- UPDATE MISSION PROGRESS
-- Stub for mission system - updates progress on player missions
-- =============================================================================

CREATE OR REPLACE FUNCTION update_mission_progress(
  p_player_id UUID,
  p_event_type VARCHAR(50),
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_mission RECORD;
BEGIN
  -- This is a stub function that will be expanded when missions are fully implemented
  -- For now, it just logs the event for future mission tracking

  -- Find active missions for this player that might be affected by this event
  FOR v_mission IN
    SELECT pm.*, m.requirements, m.rewards
    FROM player_missions pm
    JOIN missions m ON m.id = pm.mission_id
    WHERE pm.player_id = p_player_id
    AND pm.status = 'active'
  LOOP
    -- Mission progress logic will be implemented here
    -- For now, just acknowledge the function exists
    NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_mission_progress IS 'Stub function for updating mission progress based on game events';

-- =============================================================================
-- BANK DEPOSIT
-- Transfers cash to bank account
-- =============================================================================

CREATE OR REPLACE FUNCTION bank_deposit(
  p_player_id UUID,
  p_amount BIGINT
)
RETURNS TABLE (
  new_cash BIGINT,
  new_bank BIGINT
) AS $$
DECLARE
  v_player RECORD;
  v_new_cash BIGINT;
  v_new_bank BIGINT;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive';
  END IF;

  -- Get player with lock
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Check sufficient cash
  IF v_player.cash < p_amount THEN
    RAISE EXCEPTION 'Insufficient cash: have %, need %', v_player.cash, p_amount;
  END IF;

  -- Perform transfer
  v_new_cash := v_player.cash - p_amount;
  v_new_bank := v_player.bank + p_amount;

  UPDATE players
  SET
    cash = v_new_cash,
    bank = v_new_bank,
    last_action_at = NOW()
  WHERE id = p_player_id;

  -- Log transaction (cash withdrawal)
  INSERT INTO transactions (
    player_id,
    amount,
    currency,
    balance_before,
    balance_after,
    domain,
    description
  ) VALUES (
    p_player_id,
    -p_amount,
    'cash',
    v_player.cash,
    v_new_cash,
    'banking',
    'Bank deposit'
  );

  -- Log transaction (bank deposit)
  INSERT INTO transactions (
    player_id,
    amount,
    currency,
    balance_before,
    balance_after,
    domain,
    description
  ) VALUES (
    p_player_id,
    p_amount,
    'bank',
    v_player.bank,
    v_new_bank,
    'banking',
    'Bank deposit'
  );

  -- Log event
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    value_numeric,
    metadata
  ) VALUES (
    p_player_id,
    'banking',
    'deposit',
    p_amount,
    jsonb_build_object(
      'cash_before', v_player.cash,
      'bank_before', v_player.bank
    )
  );

  RETURN QUERY SELECT v_new_cash, v_new_bank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION bank_deposit IS 'Transfers cash to bank account';

-- =============================================================================
-- BANK WITHDRAW
-- Transfers bank balance to cash
-- =============================================================================

CREATE OR REPLACE FUNCTION bank_withdraw(
  p_player_id UUID,
  p_amount BIGINT
)
RETURNS TABLE (
  new_cash BIGINT,
  new_bank BIGINT
) AS $$
DECLARE
  v_player RECORD;
  v_new_cash BIGINT;
  v_new_bank BIGINT;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  -- Get player with lock
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Check sufficient bank balance
  IF v_player.bank < p_amount THEN
    RAISE EXCEPTION 'Insufficient bank balance: have %, need %', v_player.bank, p_amount;
  END IF;

  -- Perform transfer
  v_new_cash := v_player.cash + p_amount;
  v_new_bank := v_player.bank - p_amount;

  UPDATE players
  SET
    cash = v_new_cash,
    bank = v_new_bank,
    last_action_at = NOW()
  WHERE id = p_player_id;

  -- Log transaction (bank withdrawal)
  INSERT INTO transactions (
    player_id,
    amount,
    currency,
    balance_before,
    balance_after,
    domain,
    description
  ) VALUES (
    p_player_id,
    -p_amount,
    'bank',
    v_player.bank,
    v_new_bank,
    'banking',
    'Bank withdrawal'
  );

  -- Log transaction (cash deposit)
  INSERT INTO transactions (
    player_id,
    amount,
    currency,
    balance_before,
    balance_after,
    domain,
    description
  ) VALUES (
    p_player_id,
    p_amount,
    'cash',
    v_player.cash,
    v_new_cash,
    'banking',
    'Bank withdrawal'
  );

  -- Log event
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    value_numeric,
    metadata
  ) VALUES (
    p_player_id,
    'banking',
    'withdrawal',
    p_amount,
    jsonb_build_object(
      'cash_before', v_player.cash,
      'bank_before', v_player.bank
    )
  );

  RETURN QUERY SELECT v_new_cash, v_new_bank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION bank_withdraw IS 'Transfers bank balance to cash';
