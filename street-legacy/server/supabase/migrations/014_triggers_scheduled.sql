-- Street Legacy: Triggers and Scheduled Functions Migration
-- Migration: 014_triggers_scheduled
-- Description: Database triggers for game events and scheduled maintenance functions

-- =============================================================================
-- GENERIC UPDATED_AT TRIGGER
-- =============================================================================

-- The function already exists from migration 001, but we'll ensure all tables have the trigger
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
    AND table_name NOT IN ('players', 'districts', 'properties', 'businesses', 'crews')  -- Already have triggers
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END $$;

-- =============================================================================
-- PLAYER BALANCE CHANGE TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION on_player_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate balances never go negative (belt and suspenders)
  IF NEW.cash_balance < 0 THEN
    RAISE EXCEPTION 'Cash balance cannot be negative';
  END IF;

  IF NEW.bank_balance < 0 THEN
    RAISE EXCEPTION 'Bank balance cannot be negative';
  END IF;

  -- Log significant balance changes (>= $10,000)
  IF ABS(NEW.cash_balance - OLD.cash_balance) >= 10000 OR
     ABS(NEW.bank_balance - OLD.bank_balance) >= 10000 THEN
    INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
    VALUES (NEW.id, 'economy', 'large_balance_change',
      GREATEST(ABS(NEW.cash_balance - OLD.cash_balance), ABS(NEW.bank_balance - OLD.bank_balance)),
      jsonb_build_object(
        'old_cash', OLD.cash_balance,
        'new_cash', NEW.cash_balance,
        'old_bank', OLD.bank_balance,
        'new_bank', NEW.bank_balance,
        'cash_diff', NEW.cash_balance - OLD.cash_balance,
        'bank_diff', NEW.bank_balance - OLD.bank_balance
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS player_balance_change ON players;
CREATE TRIGGER player_balance_change
  BEFORE UPDATE OF cash_balance, bank_balance ON players
  FOR EACH ROW
  EXECUTE FUNCTION on_player_balance_change();

COMMENT ON FUNCTION on_player_balance_change IS 'Validates balance constraints and logs large changes';

-- =============================================================================
-- PROPERTY OWNER CHANGE TRIGGER (Enhanced version)
-- =============================================================================

-- Drop existing triggers that we'll replace with enhanced version
DROP TRIGGER IF EXISTS update_parcels_claimed ON properties;
DROP TRIGGER IF EXISTS update_properties_owned ON properties;

CREATE OR REPLACE FUNCTION on_property_owner_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old owner's property count
  IF OLD.owner_id IS NOT NULL AND (NEW.owner_id IS NULL OR NEW.owner_id != OLD.owner_id) THEN
    UPDATE players
    SET properties_owned = GREATEST(0, properties_owned - 1)
    WHERE id = OLD.owner_id;
  END IF;

  -- Update new owner's property count
  IF NEW.owner_id IS NOT NULL AND (OLD.owner_id IS NULL OR NEW.owner_id != OLD.owner_id) THEN
    UPDATE players
    SET properties_owned = properties_owned + 1
    WHERE id = NEW.owner_id;
  END IF;

  -- Update district parcels_claimed count
  IF OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    UPDATE districts
    SET parcels_claimed = parcels_claimed + 1
    WHERE id = NEW.district_id;
  ELSIF OLD.owner_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    UPDATE districts
    SET parcels_claimed = GREATEST(0, parcels_claimed - 1)
    WHERE id = NEW.district_id;
  END IF;

  -- Log the transfer
  INSERT INTO game_events (
    player_id,
    event_type,
    event_subtype,
    district_id,
    metadata
  )
  VALUES (
    COALESCE(NEW.owner_id, OLD.owner_id),
    'property',
    'ownership_change',
    NEW.district_id,
    jsonb_build_object(
      'property_id', NEW.id,
      'property_name', COALESCE(NEW.name, NEW.parcel_code),
      'from_player', OLD.owner_id,
      'to_player', NEW.owner_id,
      'property_value', NEW.current_value
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_owner_change
  AFTER UPDATE OF owner_id ON properties
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION on_property_owner_change();

COMMENT ON FUNCTION on_property_owner_change IS 'Updates counts and logs property ownership changes';

-- =============================================================================
-- CREW MEMBER TRIGGERS (Enhanced versions)
-- =============================================================================

-- Drop existing trigger to replace with enhanced version
DROP TRIGGER IF EXISTS trigger_crew_member_count ON crew_members;

CREATE OR REPLACE FUNCTION on_crew_member_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE crews
    SET member_count = member_count + 1
    WHERE id = NEW.crew_id;

    -- Log member join
    INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
    VALUES (NEW.player_id, 'crew', 'member_joined', NEW.crew_id, jsonb_build_object(
      'role', NEW.role
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_crew_member_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_crew RECORD;
  v_new_leader_id UUID;
BEGIN
  IF OLD.is_active THEN
    UPDATE crews
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.crew_id;

    -- Check if this was the leader
    SELECT * INTO v_crew FROM crews WHERE id = OLD.crew_id;
    IF v_crew.leader_id = OLD.player_id THEN
      -- Find next highest rank member to promote
      SELECT player_id INTO v_new_leader_id
      FROM crew_members
      WHERE crew_id = OLD.crew_id
        AND is_active = TRUE
        AND player_id != OLD.player_id
      ORDER BY
        CASE role
          WHEN 'co_leader' THEN 1
          WHEN 'officer' THEN 2
          WHEN 'member' THEN 3
        END,
        joined_at ASC
      LIMIT 1;

      IF v_new_leader_id IS NOT NULL THEN
        UPDATE crews SET leader_id = v_new_leader_id WHERE id = OLD.crew_id;
        UPDATE crew_members SET role = 'leader' WHERE crew_id = OLD.crew_id AND player_id = v_new_leader_id;

        -- Log leadership transfer
        INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
        VALUES (v_new_leader_id, 'crew', 'leadership_transferred', OLD.crew_id, jsonb_build_object(
          'from_player', OLD.player_id,
          'reason', 'previous_leader_left'
        ));
      ELSE
        -- No members left, mark crew as inactive
        UPDATE crews SET member_count = 0 WHERE id = OLD.crew_id;

        -- Log crew dissolution
        INSERT INTO game_events (event_type, event_subtype, crew_id, metadata)
        VALUES ('crew', 'dissolved', OLD.crew_id, jsonb_build_object(
          'reason', 'no_members_remaining',
          'last_leader', OLD.player_id
        ));
      END IF;
    END IF;

    -- Log member departure
    INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
    VALUES (OLD.player_id, 'crew', 'member_left', OLD.crew_id, jsonb_build_object(
      'role', OLD.role
    ));
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_crew_member_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle active status changes
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    UPDATE crews SET member_count = GREATEST(0, member_count - 1) WHERE id = NEW.crew_id;

    -- Log member deactivation
    INSERT INTO game_events (player_id, event_type, event_subtype, crew_id)
    VALUES (NEW.player_id, 'crew', 'member_deactivated', NEW.crew_id);

  ELSIF OLD.is_active = FALSE AND NEW.is_active = TRUE THEN
    UPDATE crews SET member_count = member_count + 1 WHERE id = NEW.crew_id;

    -- Log member reactivation
    INSERT INTO game_events (player_id, event_type, event_subtype, crew_id)
    VALUES (NEW.player_id, 'crew', 'member_reactivated', NEW.crew_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crew_member_insert
  AFTER INSERT ON crew_members
  FOR EACH ROW
  EXECUTE FUNCTION on_crew_member_insert();

CREATE TRIGGER crew_member_delete
  AFTER DELETE ON crew_members
  FOR EACH ROW
  EXECUTE FUNCTION on_crew_member_delete();

CREATE TRIGGER crew_member_status_update
  AFTER UPDATE OF is_active ON crew_members
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION on_crew_member_status_update();

-- =============================================================================
-- BUSINESS STATUS CHANGE TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION on_business_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_district_id VARCHAR(50);
BEGIN
  -- Get district ID from property if available
  IF NEW.property_id IS NOT NULL THEN
    SELECT district_id INTO v_district_id FROM properties WHERE id = NEW.property_id;
  END IF;

  -- Business got raided
  IF NEW.status = 'raided' AND OLD.status != 'raided' THEN
    INSERT INTO game_events (player_id, event_type, event_subtype, district_id, metadata)
    VALUES (NEW.owner_id, 'business', 'raided', v_district_id, jsonb_build_object(
      'business_id', NEW.id,
      'business_name', NEW.name,
      'business_type', NEW.business_type_id,
      'property_id', NEW.property_id,
      'times_raided', NEW.times_raided
    ));

    -- Add heat to the property
    IF NEW.property_id IS NOT NULL THEN
      UPDATE properties
      SET heat_level = LEAST(heat_level + 25, 100)
      WHERE id = NEW.property_id;
    END IF;
  END IF;

  -- Business became open from closed
  IF NEW.status = 'open' AND OLD.status = 'closed' THEN
    INSERT INTO game_events (player_id, event_type, event_subtype, district_id, metadata)
    VALUES (NEW.owner_id, 'business', 'opened', v_district_id, jsonb_build_object(
      'business_id', NEW.id,
      'business_name', NEW.name,
      'business_type', NEW.business_type_id
    ));
  END IF;

  -- Business was closed
  IF NEW.status = 'closed' AND OLD.status = 'open' THEN
    INSERT INTO game_events (player_id, event_type, event_subtype, district_id, metadata)
    VALUES (NEW.owner_id, 'business', 'closed', v_district_id, jsonb_build_object(
      'business_id', NEW.id,
      'business_name', NEW.name,
      'total_revenue', NEW.total_revenue,
      'total_expenses', NEW.total_expenses
    ));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS business_status_change ON businesses;
CREATE TRIGGER business_status_change
  AFTER UPDATE OF status ON businesses
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION on_business_status_change();

COMMENT ON FUNCTION on_business_status_change IS 'Logs business status changes and handles raid consequences';

-- =============================================================================
-- TRANSACTION INSERT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION on_transaction_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player's total earnings or spending stats
  IF NEW.amount > 0 THEN
    UPDATE players
    SET total_earnings = total_earnings + NEW.amount
    WHERE id = NEW.player_id;
  ELSIF NEW.amount < 0 THEN
    UPDATE players
    SET total_spent = total_spent + ABS(NEW.amount)
    WHERE id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_insert ON transactions;
CREATE TRIGGER transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION on_transaction_insert();

COMMENT ON FUNCTION on_transaction_insert IS 'Updates player earning/spending statistics on transactions';

-- =============================================================================
-- CRIME LOG INSERT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION on_crime_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player crime statistics
  UPDATE players
  SET
    crimes_committed = crimes_committed + 1,
    crimes_succeeded = crimes_succeeded + CASE WHEN NEW.result = 'success' THEN 1 ELSE 0 END,
    last_crime_at = NEW.attempted_at
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crime_log_insert ON crime_logs;
CREATE TRIGGER crime_log_insert
  AFTER INSERT ON crime_logs
  FOR EACH ROW
  EXECUTE FUNCTION on_crime_log_insert();

COMMENT ON FUNCTION on_crime_log_insert IS 'Updates player crime statistics when crimes are logged';

-- =============================================================================
-- JOB LOG INSERT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION on_job_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player's last job timestamp
  UPDATE players
  SET last_job_at = NEW.completed_at
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_log_insert ON job_logs;
CREATE TRIGGER job_log_insert
  AFTER INSERT ON job_logs
  FOR EACH ROW
  EXECUTE FUNCTION on_job_log_insert();

COMMENT ON FUNCTION on_job_log_insert IS 'Updates player job timestamp when jobs are completed';

-- =============================================================================
-- PLAYER LEVEL UP TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION on_player_level_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.level > OLD.level THEN
    -- Log level up event
    INSERT INTO game_events (player_id, event_type, event_subtype, value_numeric, metadata)
    VALUES (NEW.id, 'progression', 'level_up', NEW.level, jsonb_build_object(
      'old_level', OLD.level,
      'new_level', NEW.level,
      'total_xp', NEW.xp
    ));

    -- Check if newbie protection should be removed (level 5+)
    IF NEW.level >= 5 AND NEW.newbie_protected = TRUE THEN
      NEW.newbie_protected := FALSE;
      NEW.newbie_protection_until := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS player_level_change ON players;
CREATE TRIGGER player_level_change
  BEFORE UPDATE OF level ON players
  FOR EACH ROW
  WHEN (OLD.level IS DISTINCT FROM NEW.level)
  EXECUTE FUNCTION on_player_level_change();

COMMENT ON FUNCTION on_player_level_change IS 'Logs level ups and removes newbie protection at level 5';

-- =============================================================================
-- SCHEDULED FUNCTIONS (Called by external scheduler / pg_cron)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PROCESS HEAT DECAY (Hourly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_heat_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_properties_updated INTEGER;
  v_players_updated INTEGER;
BEGIN
  -- Decay property heat by 1 point per hour, minimum 0
  UPDATE properties
  SET heat_level = GREATEST(heat_level - 1, 0)
  WHERE heat_level > 0;

  GET DIAGNOSTICS v_properties_updated = ROW_COUNT;

  -- Decay player heat by 1 point per hour
  UPDATE players
  SET heat_level = GREATEST(heat_level - 1, 0)
  WHERE heat_level > 0;

  GET DIAGNOSTICS v_players_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'properties_updated', v_properties_updated,
    'players_updated', v_players_updated,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION process_heat_decay IS 'Reduces heat levels by 1 per hour for properties and players';

-- -----------------------------------------------------------------------------
-- EXPIRE MARKETPLACE LISTINGS (Hourly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expire_marketplace_listings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
  v_items_returned INTEGER := 0;
  v_listing RECORD;
BEGIN
  -- Get listings about to expire and return items
  FOR v_listing IN
    SELECT ml.*
    FROM marketplace_listings ml
    WHERE ml.status = 'active'
    AND ml.expires_at < NOW()
  LOOP
    -- Return items to seller
    IF v_listing.listing_type = 'item' AND v_listing.item_id IS NOT NULL THEN
      INSERT INTO player_inventory (player_id, item_id, quantity, acquired_via)
      VALUES (v_listing.seller_id, v_listing.item_id, v_listing.quantity, 'reward')
      ON CONFLICT (player_id, item_id)
      DO UPDATE SET quantity = player_inventory.quantity + EXCLUDED.quantity;

      v_items_returned := v_items_returned + 1;
    END IF;

    -- For property listings, just cancel the sale flag
    IF v_listing.listing_type = 'property' AND v_listing.property_id IS NOT NULL THEN
      UPDATE properties
      SET is_for_sale = FALSE, sale_price = NULL
      WHERE id = v_listing.property_id;
    END IF;
  END LOOP;

  -- Mark listings as expired
  UPDATE marketplace_listings
  SET status = 'expired'
  WHERE status = 'active'
  AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', v_expired_count,
    'items_returned', v_items_returned,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION expire_marketplace_listings IS 'Expires old listings and returns items to sellers';

-- -----------------------------------------------------------------------------
-- CHECK MISSION EXPIRATIONS (Hourly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_mission_expirations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  -- Fail missions that have exceeded their time limit
  UPDATE player_missions
  SET status = 'failed',
      completed_at = NOW()
  WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_missions', v_expired_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION check_mission_expirations IS 'Marks timed-out active missions as failed';

-- -----------------------------------------------------------------------------
-- CLEANUP EXPIRED COOLDOWNS (Hourly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns_scheduled()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM player_cooldowns WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cooldowns_deleted', v_deleted_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION cleanup_expired_cooldowns_scheduled IS 'Removes expired cooldown records';

-- -----------------------------------------------------------------------------
-- EXPIRE CREW INVITES (Hourly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expire_crew_invites_scheduled()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE crew_invites
  SET status = 'expired',
      responded_at = NOW()
  WHERE status = 'pending'
  AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'invites_expired', v_expired_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION expire_crew_invites_scheduled IS 'Expires pending crew invitations past their expiry date';

-- -----------------------------------------------------------------------------
-- COLLECT PROPERTY TAXES (Daily)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION collect_property_taxes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property RECORD;
  v_tax_amount BIGINT;
  v_total_collected BIGINT := 0;
  v_properties_taxed INTEGER := 0;
  v_properties_seized INTEGER := 0;
BEGIN
  FOR v_property IN
    SELECT p.*, pl.cash_balance, pl.bank_balance
    FROM properties p
    JOIN players pl ON p.owner_id = pl.id
    WHERE p.owner_id IS NOT NULL
    AND (p.last_tax_paid_at IS NULL OR p.last_tax_paid_at < CURRENT_DATE)
  LOOP
    -- Tax is 0.5% of property value, minimum $50
    v_tax_amount := GREATEST(v_property.current_value / 200, 50);

    -- Try to collect from bank first, then cash
    IF v_property.bank_balance >= v_tax_amount THEN
      UPDATE players SET bank_balance = bank_balance - v_tax_amount WHERE id = v_property.owner_id;
      UPDATE properties SET last_tax_paid_at = NOW() WHERE id = v_property.id;
      v_total_collected := v_total_collected + v_tax_amount;
      v_properties_taxed := v_properties_taxed + 1;

      INSERT INTO transactions (player_id, domain, currency, amount, balance_after, description)
      VALUES (v_property.owner_id, 'property', 'bank', -v_tax_amount,
              v_property.bank_balance - v_tax_amount,
              'Property tax for ' || COALESCE(v_property.name, v_property.parcel_code));

    ELSIF v_property.cash_balance >= v_tax_amount THEN
      UPDATE players SET cash_balance = cash_balance - v_tax_amount WHERE id = v_property.owner_id;
      UPDATE properties SET last_tax_paid_at = NOW() WHERE id = v_property.id;
      v_total_collected := v_total_collected + v_tax_amount;
      v_properties_taxed := v_properties_taxed + 1;

      INSERT INTO transactions (player_id, domain, currency, amount, balance_after, description)
      VALUES (v_property.owner_id, 'property', 'cash', -v_tax_amount,
              v_property.cash_balance - v_tax_amount,
              'Property tax for ' || COALESCE(v_property.name, v_property.parcel_code));
    ELSE
      -- Cannot pay tax - property seized
      UPDATE properties
      SET owner_id = NULL,
          claimed_at = NULL,
          purchase_price = NULL,
          is_for_sale = FALSE,
          sale_price = NULL
      WHERE id = v_property.id;

      v_properties_seized := v_properties_seized + 1;

      INSERT INTO game_events (player_id, event_type, event_subtype, district_id, metadata)
      VALUES (v_property.owner_id, 'property', 'seized', v_property.district_id, jsonb_build_object(
        'property_id', v_property.id,
        'property_name', COALESCE(v_property.name, v_property.parcel_code),
        'tax_owed', v_tax_amount,
        'reason', 'unpaid_taxes'
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_collected', v_total_collected,
    'properties_taxed', v_properties_taxed,
    'properties_seized', v_properties_seized,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION collect_property_taxes IS 'Daily property tax collection, seizes properties if unpaid';

-- -----------------------------------------------------------------------------
-- RESET DAILY MISSIONS (Daily at midnight)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reset_daily_missions_scheduled()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleared_count INTEGER;
BEGIN
  -- Clear yesterday's daily missions that weren't completed
  DELETE FROM player_missions
  WHERE mission_id IN (SELECT id FROM missions WHERE mission_type = 'daily')
  AND status IN ('available', 'active')
  AND DATE(created_at) < CURRENT_DATE;

  GET DIAGNOSTICS v_cleared_count = ROW_COUNT;

  -- Daily missions will be assigned when players log in via assign_player_missions

  RETURN jsonb_build_object(
    'cleared_missions', v_cleared_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION reset_daily_missions_scheduled IS 'Clears incomplete daily missions from previous days';

-- -----------------------------------------------------------------------------
-- RESET WEEKLY MISSIONS (Weekly on Monday)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reset_weekly_missions_scheduled()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleared_count INTEGER;
BEGIN
  -- Clear last week's weekly missions that weren't completed
  DELETE FROM player_missions
  WHERE mission_id IN (SELECT id FROM missions WHERE mission_type = 'weekly')
  AND status IN ('available', 'active')
  AND created_at < DATE_TRUNC('week', CURRENT_DATE);

  GET DIAGNOSTICS v_cleared_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleared_missions', v_cleared_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION reset_weekly_missions_scheduled IS 'Clears incomplete weekly missions from previous weeks';

-- -----------------------------------------------------------------------------
-- UPDATE PROPERTY VALUES (Daily)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_property_values()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_district RECORD;
  v_adjustment DECIMAL;
  v_districts_processed INTEGER := 0;
  v_properties_updated INTEGER := 0;
  v_update_count INTEGER;
BEGIN
  -- Property values fluctuate based on district activity
  FOR v_district IN SELECT * FROM districts LOOP
    -- Base adjustment: -2% to +2% random
    v_adjustment := 0.98 + (random() * 0.04);

    -- Bonus for high occupancy districts (>50% claimed)
    IF v_district.total_parcels > 0 AND
       v_district.parcels_claimed > v_district.total_parcels * 0.5 THEN
      v_adjustment := v_adjustment + 0.01;
    END IF;

    -- Bonus for high economy districts
    IF v_district.economy_level > 70 THEN
      v_adjustment := v_adjustment + 0.005;
    END IF;

    -- Penalty for high crime districts
    IF v_district.crime_rate > 70 THEN
      v_adjustment := v_adjustment - 0.01;
    END IF;

    -- Penalty for high police presence (indicates instability)
    IF v_district.police_presence > 80 THEN
      v_adjustment := v_adjustment - 0.005;
    END IF;

    UPDATE properties
    SET current_value = GREATEST(
      base_value / 2,  -- Never below 50% of base
      LEAST(
        base_value * 3,  -- Never above 300% of base
        ROUND(current_value * v_adjustment)
      )
    )
    WHERE district_id = v_district.id;

    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    v_properties_updated := v_properties_updated + v_update_count;
    v_districts_processed := v_districts_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'districts_processed', v_districts_processed,
    'properties_updated', v_properties_updated,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION update_property_values IS 'Daily property value fluctuation based on district metrics';

-- -----------------------------------------------------------------------------
-- PROCESS JAIL RELEASES (Hourly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_jail_releases()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_released_count INTEGER := 0;
  v_player RECORD;
BEGIN
  -- Find players whose jail time has expired
  -- (Using heat_level = 100 as "in jail" indicator and checking cooldown)
  FOR v_player IN
    SELECT p.id, p.username
    FROM players p
    WHERE p.heat_level >= 100
    AND NOT EXISTS (
      SELECT 1 FROM player_cooldowns pc
      WHERE pc.player_id = p.id
      AND pc.action_type = 'jail'
      AND pc.expires_at > NOW()
    )
  LOOP
    -- Release from jail (reduce heat to 50)
    UPDATE players
    SET heat_level = 50
    WHERE id = v_player.id;

    v_released_count := v_released_count + 1;

    -- Log release event
    INSERT INTO game_events (player_id, event_type, event_subtype, metadata)
    VALUES (v_player.id, 'crime', 'jail_release', jsonb_build_object(
      'release_type', 'time_served'
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'players_released', v_released_count,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION process_jail_releases IS 'Releases players from jail when their sentence expires';

-- -----------------------------------------------------------------------------
-- CLEANUP OLD EVENTS (Weekly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events_deleted INTEGER;
  v_messages_deleted INTEGER;
  v_chat_deleted INTEGER;
BEGIN
  -- Delete game events older than 30 days (keep important ones)
  DELETE FROM game_events
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND event_type NOT IN ('property', 'crew')
  AND event_subtype NOT IN ('ownership_change', 'seized', 'level_up', 'leadership_transferred', 'dissolved');

  GET DIAGNOSTICS v_events_deleted = ROW_COUNT;

  -- Delete read messages older than 14 days
  DELETE FROM player_messages
  WHERE is_read = TRUE
  AND created_at < NOW() - INTERVAL '14 days';

  GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;

  -- Delete old district chat messages
  DELETE FROM district_chat
  WHERE created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_chat_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'events_deleted', v_events_deleted,
    'messages_deleted', v_messages_deleted,
    'chat_deleted', v_chat_deleted,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION cleanup_old_events IS 'Weekly cleanup of old events, messages, and chat logs';

-- =============================================================================
-- MASTER SCHEDULER FUNCTIONS
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

  -- Log the maintenance run
  INSERT INTO game_events (event_type, event_subtype, metadata)
  VALUES ('system', 'hourly_maintenance', v_results);

  RETURN v_results;
END;
$$;

COMMENT ON FUNCTION run_hourly_maintenance IS 'Master function for all hourly maintenance tasks';

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

  -- Log the maintenance run
  INSERT INTO game_events (event_type, event_subtype, metadata)
  VALUES ('system', 'daily_maintenance', v_results);

  RETURN v_results;
END;
$$;

COMMENT ON FUNCTION run_daily_maintenance IS 'Master function for all daily maintenance tasks';

CREATE OR REPLACE FUNCTION run_weekly_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_results jsonb := '{}'::jsonb;
BEGIN
  v_results := v_results || jsonb_build_object('weekly_missions', reset_weekly_missions_scheduled());
  v_results := v_results || jsonb_build_object('cleanup', cleanup_old_events());

  -- Log the maintenance run
  INSERT INTO game_events (event_type, event_subtype, metadata)
  VALUES ('system', 'weekly_maintenance', v_results);

  RETURN v_results;
END;
$$;

COMMENT ON FUNCTION run_weekly_maintenance IS 'Master function for all weekly maintenance tasks';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Revoke public access from maintenance functions
REVOKE ALL ON FUNCTION run_hourly_maintenance() FROM PUBLIC;
REVOKE ALL ON FUNCTION run_daily_maintenance() FROM PUBLIC;
REVOKE ALL ON FUNCTION run_weekly_maintenance() FROM PUBLIC;

-- Individual scheduled functions should also be protected
REVOKE ALL ON FUNCTION process_heat_decay() FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_marketplace_listings() FROM PUBLIC;
REVOKE ALL ON FUNCTION check_mission_expirations() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired_cooldowns_scheduled() FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_crew_invites_scheduled() FROM PUBLIC;
REVOKE ALL ON FUNCTION collect_property_taxes() FROM PUBLIC;
REVOKE ALL ON FUNCTION reset_daily_missions_scheduled() FROM PUBLIC;
REVOKE ALL ON FUNCTION reset_weekly_missions_scheduled() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_property_values() FROM PUBLIC;
REVOKE ALL ON FUNCTION process_jail_releases() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_old_events() FROM PUBLIC;

-- Grant to service_role for edge function / pg_cron calls
GRANT EXECUTE ON FUNCTION run_hourly_maintenance() TO service_role;
GRANT EXECUTE ON FUNCTION run_daily_maintenance() TO service_role;
GRANT EXECUTE ON FUNCTION run_weekly_maintenance() TO service_role;

-- Also grant individual functions to service_role for flexibility
GRANT EXECUTE ON FUNCTION process_heat_decay() TO service_role;
GRANT EXECUTE ON FUNCTION expire_marketplace_listings() TO service_role;
GRANT EXECUTE ON FUNCTION check_mission_expirations() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_cooldowns_scheduled() TO service_role;
GRANT EXECUTE ON FUNCTION expire_crew_invites_scheduled() TO service_role;
GRANT EXECUTE ON FUNCTION collect_property_taxes() TO service_role;
GRANT EXECUTE ON FUNCTION reset_daily_missions_scheduled() TO service_role;
GRANT EXECUTE ON FUNCTION reset_weekly_missions_scheduled() TO service_role;
GRANT EXECUTE ON FUNCTION update_property_values() TO service_role;
GRANT EXECUTE ON FUNCTION process_jail_releases() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_events() TO service_role;
