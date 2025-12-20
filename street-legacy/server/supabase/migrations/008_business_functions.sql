-- Street Legacy: Business Management Functions Migration
-- Migration: 008_business_functions
-- Description: SECURITY DEFINER functions for business operations including
--              opening, closing, income collection, employees, and upgrades

-- =============================================================================
-- GET BUSINESS TYPES
-- List all available business types with player eligibility
-- =============================================================================

CREATE OR REPLACE FUNCTION get_business_types(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  id VARCHAR,
  name VARCHAR,
  category business_category_enum,
  description TEXT,
  base_income_per_hour BIGINT,
  base_operating_cost BIGINT,
  setup_cost BIGINT,
  max_employees INT,
  employee_cost_per_hour BIGINT,
  required_property_type property_type_enum,
  required_rep_street INT,
  required_rep_legit INT,
  required_level INT,
  heat_generation INT,
  player_can_open BOOLEAN
) AS $$
DECLARE
  v_player_id UUID;
  v_player_level INT;
  v_player_rep_street INT;
  v_player_rep_legit INT;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  -- Get player stats if authenticated
  IF v_player_id IS NOT NULL THEN
    SELECT level, reputation_street, reputation_legit
    INTO v_player_level, v_player_rep_street, v_player_rep_legit
    FROM players WHERE id = v_player_id;
  END IF;

  RETURN QUERY
  SELECT
    bt.id,
    bt.name,
    bt.category,
    bt.description,
    bt.base_income_per_hour,
    bt.base_operating_cost,
    bt.setup_cost,
    bt.max_employees,
    bt.employee_cost_per_hour,
    bt.required_property_type,
    bt.required_rep_street,
    bt.required_rep_legit,
    bt.required_level,
    bt.heat_generation,
    -- Check if player can open this business type
    CASE WHEN v_player_id IS NOT NULL THEN
      v_player_level >= bt.required_level
      AND v_player_rep_street >= COALESCE(bt.required_rep_street, 0)
      AND v_player_rep_legit >= COALESCE(bt.required_rep_legit, 0)
    ELSE FALSE END AS player_can_open
  FROM business_types bt
  ORDER BY bt.required_level, bt.setup_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_business_types IS 'Lists all business types with player eligibility check';

-- =============================================================================
-- OPEN BUSINESS
-- Start a business on a property
-- =============================================================================

CREATE OR REPLACE FUNCTION open_business(
  p_property_id UUID,
  p_business_type_id VARCHAR(50),
  p_name VARCHAR(100)
)
RETURNS TABLE (
  success BOOLEAN,
  business_id UUID,
  business_name VARCHAR,
  business_type VARCHAR,
  income_per_hour BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player RECORD;
  v_property RECORD;
  v_business_type RECORD;
  v_new_business_id UUID;
  v_income_per_hour BIGINT;
  v_operating_cost BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate name
  IF LENGTH(p_name) < 1 OR LENGTH(p_name) > 100 THEN
    RAISE EXCEPTION 'Business name must be between 1 and 100 characters';
  END IF;

  -- Get player
  SELECT * INTO v_player FROM players WHERE id = v_player_id;

  -- Get property with lock
  SELECT p.*, d.name AS district_name
  INTO v_property
  FROM properties p
  JOIN districts d ON d.id = p.district_id
  WHERE p.id = p_property_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  IF v_property.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this property';
  END IF;

  IF v_property.has_business THEN
    RAISE EXCEPTION 'Property already has a business';
  END IF;

  -- Get business type
  SELECT * INTO v_business_type FROM business_types WHERE id = p_business_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid business type';
  END IF;

  -- Check property type
  IF v_business_type.required_property_type IS NOT NULL
     AND v_property.property_type != v_business_type.required_property_type THEN
    RAISE EXCEPTION 'This property type cannot support this business. Requires: %', v_business_type.required_property_type;
  END IF;

  -- Check level requirement
  IF v_player.level < v_business_type.required_level THEN
    RAISE EXCEPTION 'You need to be level % to open this business', v_business_type.required_level;
  END IF;

  -- Check rep requirements
  IF v_player.reputation_street < COALESCE(v_business_type.required_rep_street, 0) THEN
    RAISE EXCEPTION 'You need % street reputation to open this business', v_business_type.required_rep_street;
  END IF;

  IF v_player.reputation_legit < COALESCE(v_business_type.required_rep_legit, 0) THEN
    RAISE EXCEPTION 'You need % legit reputation to open this business', v_business_type.required_rep_legit;
  END IF;

  -- Deduct setup cost
  PERFORM modify_player_balance(
    v_player_id,
    -v_business_type.setup_cost,
    'cash',
    'business',
    'Opened ' || p_name,
    NULL,
    p_property_id,
    NULL,
    NULL
  );

  -- Calculate initial income (base, modified by property condition)
  v_income_per_hour := (v_business_type.base_income_per_hour * v_property.condition / 100)::BIGINT;
  v_operating_cost := v_business_type.base_operating_cost;

  -- Create business
  INSERT INTO businesses (
    property_id,
    owner_id,
    business_type_id,
    name,
    operational_status,
    income_per_hour,
    operating_cost_per_hour,
    last_income_collected_at
  ) VALUES (
    p_property_id,
    v_player_id,
    p_business_type_id,
    p_name,
    'active',
    v_income_per_hour,
    v_operating_cost,
    NOW()
  )
  RETURNING id INTO v_new_business_id;

  -- Update property
  UPDATE properties
  SET has_business = TRUE
  WHERE id = p_property_id;

  -- Add heat if underground business
  IF v_business_type.heat_generation > 0 THEN
    UPDATE properties
    SET heat_level = LEAST(100, heat_level + v_business_type.heat_generation / 2)
    WHERE id = p_property_id;
  END IF;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, value_numeric, metadata)
  VALUES (v_player_id, 'business', 'opened', v_property.district_id, v_business_type.setup_cost,
    jsonb_build_object('business_id', v_new_business_id, 'business_type', p_business_type_id, 'name', p_name));

  RETURN QUERY SELECT
    TRUE,
    v_new_business_id,
    p_name::VARCHAR,
    v_business_type.name::VARCHAR,
    v_income_per_hour,
    ('Opened ' || p_name || ' (' || v_business_type.name || ')')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION open_business IS 'Opens a new business on an owned property';

-- =============================================================================
-- CLOSE BUSINESS
-- Shut down a business
-- =============================================================================

CREATE OR REPLACE FUNCTION close_business(p_business_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get business with lock
  SELECT b.*, p.district_id
  INTO v_business
  FROM businesses b
  JOIN properties p ON p.id = b.property_id
  WHERE b.id = p_business_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this business';
  END IF;

  IF v_business.operational_status = 'closed' THEN
    RAISE EXCEPTION 'Business is already closed';
  END IF;

  -- Update business
  UPDATE businesses
  SET operational_status = 'closed'
  WHERE id = p_business_id;

  -- Update property
  UPDATE properties
  SET has_business = FALSE
  WHERE id = v_business.property_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, metadata)
  VALUES (v_player_id, 'business', 'closed', v_business.district_id,
    jsonb_build_object('business_id', p_business_id, 'name', v_business.name));

  RETURN QUERY SELECT TRUE, ('Closed ' || v_business.name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION close_business IS 'Closes an owned business';

-- =============================================================================
-- COLLECT BUSINESS INCOME
-- Collect earnings from a business (max 24 hours accumulation)
-- =============================================================================

CREATE OR REPLACE FUNCTION collect_business_income(p_business_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  gross_income BIGINT,
  operating_costs BIGINT,
  employee_costs BIGINT,
  crew_tax BIGINT,
  net_income BIGINT,
  hours_collected NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
  v_property RECORD;
  v_district RECORD;
  v_crew_member RECORD;
  v_hours NUMERIC;
  v_gross BIGINT;
  v_op_costs BIGINT;
  v_emp_costs BIGINT;
  v_crew_tax BIGINT := 0;
  v_net BIGINT;
  v_economy_modifier NUMERIC;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get business with all related data
  SELECT b.*, bt.employee_cost_per_hour, bt.heat_generation
  INTO v_business
  FROM businesses b
  JOIN business_types bt ON bt.id = b.business_type_id
  WHERE b.id = p_business_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this business';
  END IF;

  IF v_business.operational_status != 'active' THEN
    RAISE EXCEPTION 'Business is not active. Status: %', v_business.operational_status;
  END IF;

  -- Get property and district
  SELECT * INTO v_property FROM properties WHERE id = v_business.property_id;
  SELECT * INTO v_district FROM districts WHERE id = v_property.district_id;

  -- Calculate hours since last collection (max 24)
  v_hours := LEAST(24, EXTRACT(EPOCH FROM (NOW() - v_business.last_income_collected_at)) / 3600);

  IF v_hours < 0.1 THEN -- Less than 6 minutes
    RETURN QUERY SELECT FALSE, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::NUMERIC, 'No income to collect yet'::TEXT;
    RETURN;
  END IF;

  -- Economy modifier based on district
  v_economy_modifier := v_district.economy_level / 50.0;

  -- Calculate income components
  v_gross := (v_business.income_per_hour * v_hours * v_economy_modifier)::BIGINT;
  v_op_costs := (v_business.operating_cost_per_hour * v_hours)::BIGINT;
  v_emp_costs := (v_business.employees * v_business.employee_cost_per_hour * v_hours)::BIGINT;

  -- Check for crew tax
  SELECT cm.*, c.tax_rate, c.id AS the_crew_id
  INTO v_crew_member
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.player_id = v_player_id AND cm.is_active = TRUE;

  IF FOUND AND v_crew_member.tax_rate > 0 THEN
    v_crew_tax := ((v_gross - v_op_costs - v_emp_costs) * v_crew_member.tax_rate / 100)::BIGINT;
    IF v_crew_tax > 0 THEN
      -- Add to crew vault
      UPDATE crews SET vault_balance = vault_balance + v_crew_tax WHERE id = v_crew_member.the_crew_id;
      UPDATE crew_members SET earnings_taxed = earnings_taxed + v_crew_tax WHERE id = v_crew_member.id;
    END IF;
  END IF;

  -- Calculate net income
  v_net := GREATEST(0, v_gross - v_op_costs - v_emp_costs - v_crew_tax);

  -- Credit player
  IF v_net > 0 THEN
    PERFORM modify_player_balance(
      v_player_id,
      v_net,
      'cash',
      'business',
      'Income from ' || v_business.name,
      NULL,
      v_property.id,
      p_business_id,
      CASE WHEN v_crew_member.the_crew_id IS NOT NULL THEN v_crew_member.the_crew_id ELSE NULL END
    );
  END IF;

  -- Update business
  UPDATE businesses
  SET
    last_income_collected_at = NOW(),
    total_revenue = total_revenue + v_gross,
    total_expenses = total_expenses + v_op_costs + v_emp_costs,
    customer_rating = GREATEST(0, LEAST(100, customer_rating + (random() * 6 - 3)::INT))
  WHERE id = p_business_id;

  -- Add heat for underground businesses
  IF v_business.heat_generation > 0 THEN
    UPDATE properties
    SET heat_level = LEAST(100, heat_level + (v_business.heat_generation * v_hours / 24)::INT)
    WHERE id = v_property.id;
  END IF;

  -- Add business rep
  IF v_net > 0 THEN
    PERFORM add_player_reputation(v_player_id, 'legit', GREATEST(1, (v_net / 500)::INT), 'business_income');
  END IF;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, value_numeric, metadata)
  VALUES (v_player_id, 'business', 'income_collected', v_property.district_id, v_net,
    jsonb_build_object('business_id', p_business_id, 'name', v_business.name, 'gross', v_gross, 'net', v_net));

  -- Update mission progress
  PERFORM update_mission_progress(v_player_id, 'collect_income', jsonb_build_object('amount', v_net, 'business_id', p_business_id));

  RETURN QUERY SELECT
    TRUE,
    v_gross,
    v_op_costs,
    v_emp_costs,
    v_crew_tax,
    v_net,
    ROUND(v_hours, 2),
    ('Collected $' || v_net || ' from ' || v_business.name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION collect_business_income IS 'Collects accumulated income from a business (max 24 hours)';

-- =============================================================================
-- COLLECT ALL BUSINESS INCOME
-- Collect from all player's active businesses at once
-- =============================================================================

CREATE OR REPLACE FUNCTION collect_all_business_income()
RETURNS TABLE (
  businesses_collected INT,
  total_net_income BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
  v_count INT := 0;
  v_total BIGINT := 0;
  v_result RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Loop through all active businesses
  FOR v_business IN
    SELECT id FROM businesses
    WHERE owner_id = v_player_id AND operational_status = 'active'
  LOOP
    BEGIN
      SELECT * INTO v_result FROM collect_business_income(v_business.id);
      IF v_result.success THEN
        v_count := v_count + 1;
        v_total := v_total + v_result.net_income;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip businesses that fail (e.g., nothing to collect)
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT
    v_count,
    v_total,
    ('Collected $' || v_total || ' from ' || v_count || ' businesses')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION collect_all_business_income IS 'Collects income from all active businesses at once';

-- =============================================================================
-- HIRE EMPLOYEE
-- Add an employee to a business (increases income by 10%)
-- =============================================================================

CREATE OR REPLACE FUNCTION hire_employee(p_business_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  new_employee_count INT,
  new_income_per_hour BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
  v_new_income BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get business
  SELECT b.*, bt.max_employees, bt.base_income_per_hour
  INTO v_business
  FROM businesses b
  JOIN business_types bt ON bt.id = b.business_type_id
  WHERE b.id = p_business_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this business';
  END IF;

  IF v_business.employees >= v_business.max_employees THEN
    RAISE EXCEPTION 'Business already has maximum employees (%)', v_business.max_employees;
  END IF;

  -- Each employee adds 10% to base income
  v_new_income := (v_business.income_per_hour * 1.1)::BIGINT;

  -- Update business
  UPDATE businesses
  SET
    employees = employees + 1,
    income_per_hour = v_new_income
  WHERE id = p_business_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, metadata)
  VALUES (v_player_id, 'business', 'employee_hired',
    jsonb_build_object('business_id', p_business_id, 'new_count', v_business.employees + 1));

  RETURN QUERY SELECT
    TRUE,
    v_business.employees + 1,
    v_new_income,
    ('Hired employee #' || (v_business.employees + 1))::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION hire_employee IS 'Hires an employee for a business (increases income by 10%)';

-- =============================================================================
-- FIRE EMPLOYEE
-- Remove an employee from a business
-- =============================================================================

CREATE OR REPLACE FUNCTION fire_employee(p_business_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  new_employee_count INT,
  new_income_per_hour BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
  v_new_income BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get business
  SELECT b.*, bt.base_income_per_hour
  INTO v_business
  FROM businesses b
  JOIN business_types bt ON bt.id = b.business_type_id
  WHERE b.id = p_business_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this business';
  END IF;

  IF v_business.employees <= 0 THEN
    RAISE EXCEPTION 'Business has no employees to fire';
  END IF;

  -- Reduce income by ~9% (inverse of 10% increase)
  v_new_income := (v_business.income_per_hour / 1.1)::BIGINT;

  -- Update business
  UPDATE businesses
  SET
    employees = employees - 1,
    income_per_hour = v_new_income
  WHERE id = p_business_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, metadata)
  VALUES (v_player_id, 'business', 'employee_fired',
    jsonb_build_object('business_id', p_business_id, 'new_count', v_business.employees - 1));

  RETURN QUERY SELECT
    TRUE,
    v_business.employees - 1,
    v_new_income,
    ('Fired an employee. Now have ' || (v_business.employees - 1))::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fire_employee IS 'Fires an employee from a business';

-- =============================================================================
-- UPGRADE BUSINESS
-- Increase business level (max 10, +20% income per level)
-- =============================================================================

CREATE OR REPLACE FUNCTION upgrade_business(p_business_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  new_level INT,
  upgrade_cost BIGINT,
  new_income_per_hour BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
  v_cost BIGINT;
  v_new_income BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get business
  SELECT * INTO v_business FROM businesses WHERE id = p_business_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this business';
  END IF;

  IF v_business.level >= 10 THEN
    RAISE EXCEPTION 'Business is already at max level (10)';
  END IF;

  -- Calculate upgrade cost (level * 5000)
  v_cost := v_business.level * 5000;

  -- Deduct cost
  PERFORM modify_player_balance(
    v_player_id,
    -v_cost,
    'cash',
    'business',
    'Upgraded ' || v_business.name || ' to level ' || (v_business.level + 1),
    NULL,
    v_business.property_id,
    p_business_id,
    NULL
  );

  -- Increase income by 20%
  v_new_income := (v_business.income_per_hour * 1.2)::BIGINT;

  -- Update business
  UPDATE businesses
  SET
    level = level + 1,
    income_per_hour = v_new_income
  WHERE id = p_business_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'business', 'upgraded', v_cost,
    jsonb_build_object('business_id', p_business_id, 'new_level', v_business.level + 1));

  RETURN QUERY SELECT
    TRUE,
    v_business.level + 1,
    v_cost,
    v_new_income,
    ('Upgraded ' || v_business.name || ' to level ' || (v_business.level + 1))::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION upgrade_business IS 'Upgrades a business level (max 10, +20% income per level)';

-- =============================================================================
-- REOPEN RAIDED BUSINESS
-- Pay fine (50% of setup cost) to reopen a raided business
-- =============================================================================

CREATE OR REPLACE FUNCTION reopen_raided_business(p_business_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  fine_paid BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_business RECORD;
  v_fine BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get business
  SELECT b.*, bt.setup_cost
  INTO v_business
  FROM businesses b
  JOIN business_types bt ON bt.id = b.business_type_id
  WHERE b.id = p_business_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_business.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this business';
  END IF;

  IF v_business.operational_status != 'raided' THEN
    RAISE EXCEPTION 'Business is not in raided status';
  END IF;

  -- Fine is 50% of setup cost
  v_fine := (v_business.setup_cost * 0.5)::BIGINT;

  -- Deduct fine
  PERFORM modify_player_balance(
    v_player_id,
    -v_fine,
    'cash',
    'business',
    'Paid fine to reopen ' || v_business.name,
    NULL,
    v_business.property_id,
    p_business_id,
    NULL
  );

  -- Reopen business
  UPDATE businesses
  SET
    operational_status = 'active',
    last_income_collected_at = NOW()
  WHERE id = p_business_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'business', 'reopened', v_fine,
    jsonb_build_object('business_id', p_business_id, 'fine', v_fine));

  RETURN QUERY SELECT
    TRUE,
    v_fine,
    ('Reopened ' || v_business.name || ' after paying $' || v_fine || ' fine')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reopen_raided_business IS 'Pays fine to reopen a raided business';

-- =============================================================================
-- GET PLAYER BUSINESSES
-- Get all player's businesses with full details
-- =============================================================================

CREATE OR REPLACE FUNCTION get_player_businesses(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  property_id UUID,
  name VARCHAR,
  business_type_id VARCHAR,
  business_type_name VARCHAR,
  category business_category_enum,
  level INT,
  operational_status business_status_enum,
  employees INT,
  max_employees INT,
  income_per_hour BIGINT,
  operating_cost_per_hour BIGINT,
  employee_cost_per_hour BIGINT,
  net_income_per_hour BIGINT,
  customer_rating INT,
  last_income_collected_at TIMESTAMPTZ,
  hours_since_collection NUMERIC,
  pending_income BIGINT,
  total_revenue BIGINT,
  total_expenses BIGINT,
  raid_count INT,
  district_id VARCHAR,
  district_name VARCHAR,
  parcel_code VARCHAR
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    b.id,
    b.property_id,
    b.name,
    b.business_type_id,
    bt.name AS business_type_name,
    bt.category,
    b.level,
    b.operational_status,
    b.employees,
    bt.max_employees,
    b.income_per_hour,
    b.operating_cost_per_hour,
    bt.employee_cost_per_hour,
    (b.income_per_hour - b.operating_cost_per_hour - (b.employees * bt.employee_cost_per_hour))::BIGINT AS net_income_per_hour,
    b.customer_rating,
    b.last_income_collected_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - b.last_income_collected_at)) / 3600, 2) AS hours_since_collection,
    CASE WHEN b.operational_status = 'active' THEN
      GREATEST(0,
        ((b.income_per_hour - b.operating_cost_per_hour - (b.employees * bt.employee_cost_per_hour)) *
        LEAST(24, EXTRACT(EPOCH FROM (NOW() - b.last_income_collected_at)) / 3600))::BIGINT
      )
    ELSE 0 END AS pending_income,
    b.total_revenue,
    b.total_expenses,
    b.raid_count,
    p.district_id,
    d.name AS district_name,
    p.parcel_code
  FROM businesses b
  JOIN business_types bt ON bt.id = b.business_type_id
  JOIN properties p ON p.id = b.property_id
  JOIN districts d ON d.id = p.district_id
  WHERE b.owner_id = v_player_id
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_player_businesses IS 'Returns all businesses owned by a player with full details';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_business_types TO authenticated;
GRANT EXECUTE ON FUNCTION open_business TO authenticated;
GRANT EXECUTE ON FUNCTION close_business TO authenticated;
GRANT EXECUTE ON FUNCTION collect_business_income TO authenticated;
GRANT EXECUTE ON FUNCTION collect_all_business_income TO authenticated;
GRANT EXECUTE ON FUNCTION hire_employee TO authenticated;
GRANT EXECUTE ON FUNCTION fire_employee TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_business TO authenticated;
GRANT EXECUTE ON FUNCTION reopen_raided_business TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_businesses TO authenticated;
