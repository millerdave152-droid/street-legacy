-- Street Legacy: Property Management Functions Migration
-- Migration: 007_property_functions
-- Description: SECURITY DEFINER functions for property operations including
--              buying, selling, upgrading, and marketplace listings

-- =============================================================================
-- GET AVAILABLE PROPERTIES
-- List unclaimed properties in a district with optional filters
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_properties(
  p_district_id VARCHAR(50),
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_property_type property_type_enum DEFAULT NULL,
  p_max_price BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  district_id VARCHAR,
  parcel_code VARCHAR,
  property_type property_type_enum,
  base_value BIGINT,
  current_value BIGINT,
  district_name VARCHAR,
  district_difficulty INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.district_id,
    p.parcel_code,
    p.property_type,
    p.base_value,
    p.current_value,
    d.name AS district_name,
    d.difficulty AS district_difficulty
  FROM properties p
  JOIN districts d ON d.id = p.district_id
  WHERE p.district_id = p_district_id
    AND p.owner_id IS NULL
    AND (p_property_type IS NULL OR p.property_type = p_property_type)
    AND (p_max_price IS NULL OR p.current_value <= p_max_price)
  ORDER BY p.current_value ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_available_properties IS 'Lists unclaimed properties in a district with optional filters';

-- =============================================================================
-- GET PLAYER PROPERTIES
-- Get all properties owned by a player with business info
-- =============================================================================

CREATE OR REPLACE FUNCTION get_player_properties(p_player_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  district_id VARCHAR,
  parcel_code VARCHAR,
  name VARCHAR,
  property_type property_type_enum,
  base_value BIGINT,
  current_value BIGINT,
  purchase_price BIGINT,
  condition INT,
  upgrade_level INT,
  has_business BOOLEAN,
  is_for_sale BOOLEAN,
  sale_price BIGINT,
  heat_level INT,
  claimed_at TIMESTAMPTZ,
  district_name VARCHAR,
  business_id UUID,
  business_name VARCHAR,
  business_type VARCHAR,
  pending_income BIGINT
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := COALESCE(p_player_id, current_player_id());

  RETURN QUERY
  SELECT
    p.id,
    p.district_id,
    p.parcel_code,
    p.name,
    p.property_type,
    p.base_value,
    p.current_value,
    p.purchase_price,
    p.condition,
    p.upgrade_level,
    p.has_business,
    p.is_for_sale,
    p.sale_price,
    p.heat_level,
    p.claimed_at,
    d.name AS district_name,
    b.id AS business_id,
    b.name AS business_name,
    b.business_type_id AS business_type,
    -- Calculate pending income if business exists
    CASE WHEN b.id IS NOT NULL AND b.operational_status = 'active' THEN
      GREATEST(0,
        (b.income_per_hour - b.operating_cost_per_hour - (b.employees * 10)) *
        LEAST(24, EXTRACT(EPOCH FROM (NOW() - b.last_income_collected_at)) / 3600)
      )::BIGINT
    ELSE 0 END AS pending_income
  FROM properties p
  JOIN districts d ON d.id = p.district_id
  LEFT JOIN businesses b ON b.property_id = p.id
  WHERE p.owner_id = v_player_id
  ORDER BY p.claimed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_player_properties IS 'Returns all properties owned by a player with business details';

-- =============================================================================
-- BUY PROPERTY
-- Purchase an unclaimed property
-- =============================================================================

CREATE OR REPLACE FUNCTION buy_property(
  p_property_id UUID,
  p_use_bank BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  success BOOLEAN,
  property_id UUID,
  parcel_code VARCHAR,
  district_name VARCHAR,
  price_paid BIGINT,
  new_balance BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_level INT;
  v_property RECORD;
  v_district RECORD;
  v_currency currency_enum;
  v_new_balance BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get player level
  SELECT level INTO v_player_level FROM players WHERE id = v_player_id;

  -- Get property details with lock
  SELECT p.*, d.name AS district_name, d.difficulty AS district_difficulty
  INTO v_property
  FROM properties p
  JOIN districts d ON d.id = p.district_id
  WHERE p.id = p_property_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  -- Check if already owned
  IF v_property.owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Property is already owned';
  END IF;

  -- Check level requirement (difficulty * 2 - 1)
  IF v_player_level < (v_property.district_difficulty * 2 - 1) THEN
    RAISE EXCEPTION 'You need to be level % to buy property in this district', (v_property.district_difficulty * 2 - 1);
  END IF;

  -- Set currency
  v_currency := CASE WHEN p_use_bank THEN 'bank'::currency_enum ELSE 'cash'::currency_enum END;

  -- Deduct payment
  v_new_balance := modify_player_balance(
    v_player_id,
    -v_property.current_value,
    v_currency,
    'property',
    'Purchased property ' || v_property.parcel_code,
    NULL,
    p_property_id,
    NULL,
    NULL
  );

  -- Transfer ownership
  UPDATE properties
  SET
    owner_id = v_player_id,
    purchase_price = current_value,
    claimed_at = NOW()
  WHERE id = p_property_id;

  -- Update district parcels_claimed
  UPDATE districts
  SET parcels_claimed = parcels_claimed + 1
  WHERE id = v_property.district_id;

  -- Update player properties_owned
  UPDATE players
  SET properties_owned = properties_owned + 1
  WHERE id = v_player_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, value_numeric, metadata)
  VALUES (v_player_id, 'property', 'bought', v_property.district_id, v_property.current_value,
    jsonb_build_object('property_id', p_property_id, 'parcel_code', v_property.parcel_code, 'price', v_property.current_value));

  -- Update mission progress
  PERFORM update_mission_progress(v_player_id, 'buy_property', jsonb_build_object('property_id', p_property_id, 'district_id', v_property.district_id));

  RETURN QUERY SELECT
    TRUE,
    p_property_id,
    v_property.parcel_code::VARCHAR,
    v_property.district_name::VARCHAR,
    v_property.current_value,
    v_new_balance,
    ('Purchased ' || v_property.parcel_code || ' in ' || v_property.district_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION buy_property IS 'Purchases an unclaimed property for the authenticated player';

-- =============================================================================
-- SELL PROPERTY TO SYSTEM
-- Sell property back at 70% value
-- =============================================================================

CREATE OR REPLACE FUNCTION sell_property_to_system(p_property_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  sale_amount BIGINT,
  new_balance BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_property RECORD;
  v_sale_amount BIGINT;
  v_new_balance BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

  -- Check ownership
  IF v_property.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this property';
  END IF;

  -- Check for active business
  IF v_property.has_business THEN
    RAISE EXCEPTION 'Close the business before selling the property';
  END IF;

  -- Calculate sale amount (70% of current value)
  v_sale_amount := (v_property.current_value * 0.7)::BIGINT;

  -- Credit player
  v_new_balance := modify_player_balance(
    v_player_id,
    v_sale_amount,
    'cash',
    'property',
    'Sold property ' || v_property.parcel_code,
    NULL,
    p_property_id,
    NULL,
    NULL
  );

  -- Clear ownership
  UPDATE properties
  SET
    owner_id = NULL,
    name = NULL,
    purchase_price = NULL,
    claimed_at = NULL,
    is_for_sale = FALSE,
    sale_price = NULL,
    condition = 100,
    heat_level = 0
  WHERE id = p_property_id;

  -- Delete upgrades
  DELETE FROM property_upgrades WHERE property_id = p_property_id;

  -- Update district parcels_claimed
  UPDATE districts
  SET parcels_claimed = parcels_claimed - 1
  WHERE id = v_property.district_id;

  -- Update player properties_owned
  UPDATE players
  SET properties_owned = properties_owned - 1
  WHERE id = v_player_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, district_id, value_numeric, metadata)
  VALUES (v_player_id, 'property', 'sold_system', v_property.district_id, v_sale_amount,
    jsonb_build_object('property_id', p_property_id, 'parcel_code', v_property.parcel_code, 'sale_amount', v_sale_amount));

  RETURN QUERY SELECT
    TRUE,
    v_sale_amount,
    v_new_balance,
    ('Sold ' || v_property.parcel_code || ' for $' || v_sale_amount)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sell_property_to_system IS 'Sells property back to system at 70% value';

-- =============================================================================
-- UPGRADE PROPERTY
-- Add upgrades to a property
-- =============================================================================

CREATE OR REPLACE FUNCTION upgrade_property(
  p_property_id UUID,
  p_upgrade_type upgrade_type_enum
)
RETURNS TABLE (
  success BOOLEAN,
  upgrade_level INT,
  cost_paid BIGINT,
  new_property_value BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_property RECORD;
  v_current_upgrade RECORD;
  v_new_level INT;
  v_base_cost BIGINT;
  v_cost BIGINT;
  v_value_increase BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get property
  SELECT * INTO v_property FROM properties WHERE id = p_property_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  IF v_property.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this property';
  END IF;

  -- Get current upgrade level
  SELECT * INTO v_current_upgrade
  FROM property_upgrades
  WHERE property_id = p_property_id AND upgrade_type = p_upgrade_type;

  IF FOUND THEN
    IF v_current_upgrade.level >= 5 THEN
      RAISE EXCEPTION 'Upgrade already at max level';
    END IF;
    v_new_level := v_current_upgrade.level + 1;
  ELSE
    v_new_level := 1;
  END IF;

  -- Calculate cost based on upgrade type and level
  v_base_cost := CASE p_upgrade_type
    WHEN 'security' THEN 500
    WHEN 'renovation' THEN 1000
    WHEN 'expansion' THEN 2000
    WHEN 'storage' THEN 750
    WHEN 'front' THEN 1500
  END;

  v_cost := v_base_cost * v_new_level;
  v_value_increase := (v_cost * 0.8)::BIGINT; -- Upgrade adds 80% of cost to property value

  -- Deduct cost
  PERFORM modify_player_balance(
    v_player_id,
    -v_cost,
    'cash',
    'property',
    'Upgraded ' || p_upgrade_type::TEXT || ' to level ' || v_new_level,
    NULL,
    p_property_id,
    NULL,
    NULL
  );

  -- Insert or update upgrade
  INSERT INTO property_upgrades (property_id, upgrade_type, level, cost_paid, effect_metadata)
  VALUES (p_property_id, p_upgrade_type, v_new_level, v_cost,
    jsonb_build_object('value_added', v_value_increase))
  ON CONFLICT (property_id, upgrade_type)
  DO UPDATE SET
    level = v_new_level,
    cost_paid = property_upgrades.cost_paid + v_cost,
    effect_metadata = jsonb_build_object('value_added',
      COALESCE((property_upgrades.effect_metadata->>'value_added')::BIGINT, 0) + v_value_increase
    );

  -- Update property value and upgrade level
  UPDATE properties
  SET
    current_value = current_value + v_value_increase,
    upgrade_level = (
      SELECT COALESCE(MAX(level), 0) FROM property_upgrades WHERE property_id = p_property_id
    )
  WHERE id = p_property_id
  RETURNING current_value INTO v_property.current_value;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'property', 'upgraded', v_cost,
    jsonb_build_object('property_id', p_property_id, 'upgrade_type', p_upgrade_type, 'level', v_new_level));

  RETURN QUERY SELECT
    TRUE,
    v_new_level,
    v_cost,
    v_property.current_value,
    (p_upgrade_type::TEXT || ' upgraded to level ' || v_new_level)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION upgrade_property IS 'Upgrades a property with a specific upgrade type';

-- =============================================================================
-- REPAIR PROPERTY
-- Restore property condition to 100%
-- =============================================================================

CREATE OR REPLACE FUNCTION repair_property(p_property_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  new_condition INT,
  repair_cost BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_property RECORD;
  v_repair_cost BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get property
  SELECT * INTO v_property FROM properties WHERE id = p_property_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  IF v_property.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this property';
  END IF;

  IF v_property.condition >= 100 THEN
    RETURN QUERY SELECT FALSE, 100, 0::BIGINT, 'Property is already in perfect condition'::TEXT;
    RETURN;
  END IF;

  -- Calculate repair cost ($10 per condition point)
  v_repair_cost := (100 - v_property.condition) * 10;

  -- Deduct cost
  PERFORM modify_player_balance(
    v_player_id,
    -v_repair_cost,
    'cash',
    'property',
    'Repaired property ' || v_property.parcel_code,
    NULL,
    p_property_id,
    NULL,
    NULL
  );

  -- Repair property
  UPDATE properties
  SET condition = 100
  WHERE id = p_property_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'property', 'repaired', v_repair_cost,
    jsonb_build_object('property_id', p_property_id, 'old_condition', v_property.condition, 'cost', v_repair_cost));

  RETURN QUERY SELECT
    TRUE,
    100,
    v_repair_cost,
    ('Repaired property to 100% condition for $' || v_repair_cost)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION repair_property IS 'Repairs a property to 100% condition';

-- =============================================================================
-- RENAME PROPERTY
-- Set a custom name for a property
-- =============================================================================

CREATE OR REPLACE FUNCTION rename_property(p_property_id UUID, p_name VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate name length
  IF LENGTH(p_name) < 1 OR LENGTH(p_name) > 100 THEN
    RAISE EXCEPTION 'Name must be between 1 and 100 characters';
  END IF;

  -- Update if owner
  UPDATE properties
  SET name = p_name
  WHERE id = p_property_id AND owner_id = v_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found or you do not own it';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rename_property IS 'Sets a custom name for an owned property';

-- =============================================================================
-- LIST PROPERTY FOR SALE
-- Put property on marketplace
-- =============================================================================

CREATE OR REPLACE FUNCTION list_property_for_sale(
  p_property_id UUID,
  p_price BIGINT
)
RETURNS UUID AS $$
DECLARE
  v_player_id UUID;
  v_property RECORD;
  v_listing_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be positive';
  END IF;

  -- Get property
  SELECT * INTO v_property FROM properties WHERE id = p_property_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  IF v_property.owner_id != v_player_id THEN
    RAISE EXCEPTION 'You do not own this property';
  END IF;

  IF v_property.is_for_sale THEN
    RAISE EXCEPTION 'Property is already listed for sale';
  END IF;

  IF v_property.has_business THEN
    RAISE EXCEPTION 'Close the business before listing property for sale';
  END IF;

  -- Update property
  UPDATE properties
  SET is_for_sale = TRUE, sale_price = p_price
  WHERE id = p_property_id;

  -- Create marketplace listing
  INSERT INTO marketplace_listings (seller_id, listing_type, property_id, asking_price, currency)
  VALUES (v_player_id, 'property', p_property_id, p_price, 'cash')
  RETURNING id INTO v_listing_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
  VALUES (v_player_id, 'property', 'listed', p_price,
    jsonb_build_object('property_id', p_property_id, 'listing_id', v_listing_id, 'price', p_price));

  RETURN v_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION list_property_for_sale IS 'Lists an owned property on the marketplace';

-- =============================================================================
-- CANCEL PROPERTY LISTING
-- Remove property from marketplace
-- =============================================================================

CREATE OR REPLACE FUNCTION cancel_property_listing(p_property_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update property
  UPDATE properties
  SET is_for_sale = FALSE, sale_price = NULL
  WHERE id = p_property_id AND owner_id = v_player_id AND is_for_sale = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found, not owned by you, or not for sale';
  END IF;

  -- Cancel listing
  UPDATE marketplace_listings
  SET status = 'cancelled'
  WHERE property_id = p_property_id AND seller_id = v_player_id AND status = 'active';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cancel_property_listing IS 'Removes a property listing from the marketplace';

-- =============================================================================
-- BUY LISTED PROPERTY
-- Purchase a property from another player via marketplace
-- =============================================================================

CREATE OR REPLACE FUNCTION buy_listed_property(p_listing_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  property_id UUID,
  parcel_code VARCHAR,
  price_paid BIGINT,
  seller_username VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_buyer_id UUID;
  v_listing RECORD;
  v_property RECORD;
  v_seller RECORD;
BEGIN
  v_buyer_id := current_player_id();

  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get listing with lock
  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND OR v_listing.status != 'active' THEN
    RAISE EXCEPTION 'Listing not found or no longer active';
  END IF;

  IF v_listing.listing_type != 'property' THEN
    RAISE EXCEPTION 'This listing is not for a property';
  END IF;

  IF v_listing.seller_id = v_buyer_id THEN
    RAISE EXCEPTION 'Cannot buy your own listing';
  END IF;

  -- Get property
  SELECT p.*, d.name AS district_name INTO v_property
  FROM properties p
  JOIN districts d ON d.id = p.district_id
  WHERE p.id = v_listing.property_id FOR UPDATE OF p;

  -- Get seller info
  SELECT * INTO v_seller FROM players WHERE id = v_listing.seller_id;

  -- Deduct from buyer
  PERFORM modify_player_balance(
    v_buyer_id,
    -v_listing.asking_price,
    v_listing.currency,
    'trade',
    'Bought property from ' || v_seller.username,
    v_listing.seller_id,
    v_listing.property_id,
    NULL,
    NULL
  );

  -- Credit seller
  PERFORM modify_player_balance(
    v_listing.seller_id,
    v_listing.asking_price,
    v_listing.currency,
    'trade',
    'Sold property to buyer',
    v_buyer_id,
    v_listing.property_id,
    NULL,
    NULL
  );

  -- Transfer ownership
  UPDATE properties
  SET
    owner_id = v_buyer_id,
    purchase_price = v_listing.asking_price,
    claimed_at = NOW(),
    is_for_sale = FALSE,
    sale_price = NULL
  WHERE id = v_listing.property_id;

  -- Update listing
  UPDATE marketplace_listings
  SET status = 'sold', buyer_id = v_buyer_id, final_price = asking_price, sold_at = NOW()
  WHERE id = p_listing_id;

  -- Update player counts
  UPDATE players SET properties_owned = properties_owned + 1 WHERE id = v_buyer_id;
  UPDATE players SET properties_owned = properties_owned - 1 WHERE id = v_listing.seller_id;

  -- Log events for buyer
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, value_numeric, metadata)
  VALUES (v_buyer_id, 'property', 'bought_player', v_listing.seller_id, v_listing.asking_price,
    jsonb_build_object('property_id', v_listing.property_id, 'seller', v_seller.username));

  -- Log events for seller
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, value_numeric, metadata)
  VALUES (v_listing.seller_id, 'property', 'sold_player', v_buyer_id, v_listing.asking_price,
    jsonb_build_object('property_id', v_listing.property_id, 'listing_id', p_listing_id));

  RETURN QUERY SELECT
    TRUE,
    v_listing.property_id,
    v_property.parcel_code::VARCHAR,
    v_listing.asking_price,
    v_seller.username::VARCHAR,
    ('Purchased ' || v_property.parcel_code || ' from ' || v_seller.username || ' for $' || v_listing.asking_price)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION buy_listed_property IS 'Purchases a property from another player via marketplace listing';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_available_properties TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_properties TO authenticated;
GRANT EXECUTE ON FUNCTION buy_property TO authenticated;
GRANT EXECUTE ON FUNCTION sell_property_to_system TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_property TO authenticated;
GRANT EXECUTE ON FUNCTION repair_property TO authenticated;
GRANT EXECUTE ON FUNCTION rename_property TO authenticated;
GRANT EXECUTE ON FUNCTION list_property_for_sale TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_property_listing TO authenticated;
GRANT EXECUTE ON FUNCTION buy_listed_property TO authenticated;
