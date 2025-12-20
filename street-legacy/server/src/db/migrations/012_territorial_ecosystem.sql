-- Street Legacy: Territorial Ecosystem Migration
-- Migration: 012_territorial_ecosystem
-- Description: Creates district_states and district_events tables for dynamic territorial ecosystem
--              Districts become living environments that respond to player behavior
-- Run: psql -h localhost -U postgres -d street_legacy -f 012_territorial_ecosystem.sql

-- =============================================================================
-- ENUMS (with IF NOT EXISTS safety)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE district_status_enum AS ENUM (
    'stable',       -- Normal operations, balanced metrics
    'volatile',     -- Unstable, rapid changes occurring
    'warzone',      -- Active crew conflicts, high crime
    'gentrifying',  -- Property values rising, crime decreasing
    'declining'     -- Economic downturn, businesses closing
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE district_event_type_enum AS ENUM (
    'crime_committed',    -- Player committed a crime
    'property_bought',    -- Property purchased
    'property_sold',      -- Property sold
    'crew_battle',        -- Crew/gang conflict
    'business_opened',    -- New business established
    'business_closed',    -- Business shut down
    'player_attacked',    -- PvP attack occurred
    'police_raid',        -- Police crackdown
    'territory_claimed',  -- Crew claimed territory
    'territory_lost',     -- Crew lost territory
    'heist_executed',     -- Major heist in district
    'drug_bust',          -- Drug operation busted
    'gentrification',     -- Development/renovation
    'economic_boost',     -- Positive economic event
    'economic_crash'      -- Negative economic event
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- DISTRICT STATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS district_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) UNIQUE NOT NULL,

  -- Dynamic metrics (0-100 scale)
  crime_index INTEGER DEFAULT 50 CHECK (crime_index >= 0 AND crime_index <= 100),
  police_presence INTEGER DEFAULT 50 CHECK (police_presence >= 0 AND police_presence <= 100),
  property_values INTEGER DEFAULT 50 CHECK (property_values >= 0 AND property_values <= 100),
  business_health INTEGER DEFAULT 50 CHECK (business_health >= 0 AND business_health <= 100),
  street_activity INTEGER DEFAULT 50 CHECK (street_activity >= 0 AND street_activity <= 100),

  -- Derived status
  district_status district_status_enum DEFAULT 'stable',

  -- Heat and tension metrics
  heat_level INTEGER DEFAULT 0 CHECK (heat_level >= 0 AND heat_level <= 100),
  crew_tension INTEGER DEFAULT 0 CHECK (crew_tension >= 0 AND crew_tension <= 100),

  -- Economic indicators
  daily_crime_count INTEGER DEFAULT 0,
  daily_transaction_volume BIGINT DEFAULT 0,
  active_businesses INTEGER DEFAULT 0,

  -- Timestamps
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_district_states_district_id ON district_states(district_id);
CREATE INDEX IF NOT EXISTS idx_district_states_status ON district_states(district_status);
CREATE INDEX IF NOT EXISTS idx_district_states_crime_index ON district_states(crime_index);

-- =============================================================================
-- DISTRICT EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS district_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL,
  event_type district_event_type_enum NOT NULL,

  -- Event details
  severity INTEGER DEFAULT 1 CHECK (severity >= 1 AND severity <= 10),
  player_id UUID,
  target_player_id UUID,
  crew_id UUID,

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Impact on district metrics
  crime_impact INTEGER DEFAULT 0 CHECK (crime_impact >= -50 AND crime_impact <= 50),
  police_impact INTEGER DEFAULT 0 CHECK (police_impact >= -50 AND police_impact <= 50),
  property_impact INTEGER DEFAULT 0 CHECK (property_impact >= -50 AND property_impact <= 50),
  business_impact INTEGER DEFAULT 0 CHECK (business_impact >= -50 AND business_impact <= 50),
  activity_impact INTEGER DEFAULT 0 CHECK (activity_impact >= -50 AND activity_impact <= 50),

  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_district_events_district_created ON district_events(district_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_district_events_type ON district_events(event_type);
CREATE INDEX IF NOT EXISTS idx_district_events_player ON district_events(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_district_events_unprocessed ON district_events(processed, created_at) WHERE processed = FALSE;

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_district_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_district_states_updated_at ON district_states;
CREATE TRIGGER trigger_district_states_updated_at
  BEFORE UPDATE ON district_states
  FOR EACH ROW
  EXECUTE FUNCTION update_district_states_updated_at();

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Calculate district status from metrics
CREATE OR REPLACE FUNCTION calculate_district_status(
  p_crime_index INTEGER,
  p_police_presence INTEGER,
  p_property_values INTEGER,
  p_business_health INTEGER,
  p_crew_tension INTEGER
) RETURNS district_status_enum AS $$
BEGIN
  IF p_crime_index >= 70 AND p_crew_tension >= 60 THEN
    RETURN 'warzone';
  END IF;
  IF p_property_values >= 65 AND p_business_health >= 60 AND p_crime_index <= 40 THEN
    RETURN 'gentrifying';
  END IF;
  IF p_business_health <= 35 AND p_property_values <= 40 THEN
    RETURN 'declining';
  END IF;
  IF p_crime_index >= 55 AND p_crew_tension >= 40 THEN
    RETURN 'volatile';
  END IF;
  RETURN 'stable';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Record a district event
CREATE OR REPLACE FUNCTION record_district_event(
  p_district_id VARCHAR(50),
  p_event_type district_event_type_enum,
  p_player_id UUID DEFAULT NULL,
  p_severity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_crime_impact INTEGER := 0;
  v_police_impact INTEGER := 0;
  v_property_impact INTEGER := 0;
  v_business_impact INTEGER := 0;
  v_activity_impact INTEGER := 0;
BEGIN
  CASE p_event_type
    WHEN 'crime_committed' THEN
      v_crime_impact := p_severity * 2;
      v_police_impact := p_severity;
    WHEN 'property_bought' THEN
      v_property_impact := p_severity;
      v_business_impact := CEIL(p_severity * 0.5);
    WHEN 'crew_battle' THEN
      v_crime_impact := p_severity * 3;
      v_police_impact := p_severity * 2;
      v_business_impact := -p_severity;
    WHEN 'business_opened' THEN
      v_business_impact := p_severity * 2;
      v_property_impact := p_severity;
    WHEN 'police_raid' THEN
      v_police_impact := p_severity * 3;
      v_crime_impact := -p_severity * 2;
    WHEN 'heist_executed' THEN
      v_crime_impact := p_severity * 4;
      v_police_impact := p_severity * 3;
    ELSE
      v_activity_impact := 1;
  END CASE;

  INSERT INTO district_events (
    district_id, event_type, severity, player_id,
    metadata, crime_impact, police_impact, property_impact, business_impact, activity_impact
  ) VALUES (
    p_district_id, p_event_type, p_severity, p_player_id,
    p_metadata, v_crime_impact, v_police_impact, v_property_impact, v_business_impact, v_activity_impact
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Process unprocessed events
CREATE OR REPLACE FUNCTION process_district_events() RETURNS INTEGER AS $$
DECLARE
  v_district RECORD;
  v_total_processed INTEGER := 0;
  v_crime_delta INTEGER;
  v_police_delta INTEGER;
  v_property_delta INTEGER;
  v_business_delta INTEGER;
  v_activity_delta INTEGER;
BEGIN
  FOR v_district IN
    SELECT DISTINCT district_id FROM district_events WHERE processed = FALSE
  LOOP
    SELECT
      COALESCE(SUM(crime_impact), 0),
      COALESCE(SUM(police_impact), 0),
      COALESCE(SUM(property_impact), 0),
      COALESCE(SUM(business_impact), 0),
      COALESCE(SUM(activity_impact), 0)
    INTO v_crime_delta, v_police_delta, v_property_delta, v_business_delta, v_activity_delta
    FROM district_events
    WHERE district_id = v_district.district_id AND processed = FALSE;

    UPDATE district_states SET
      crime_index = GREATEST(0, LEAST(100, crime_index + v_crime_delta)),
      police_presence = GREATEST(0, LEAST(100, police_presence + v_police_delta)),
      property_values = GREATEST(0, LEAST(100, property_values + v_property_delta)),
      business_health = GREATEST(0, LEAST(100, business_health + v_business_delta)),
      street_activity = GREATEST(0, LEAST(100, street_activity + v_activity_delta)),
      last_calculated = NOW()
    WHERE district_id = v_district.district_id;

    UPDATE district_events SET processed = TRUE, processed_at = NOW()
    WHERE district_id = v_district.district_id AND processed = FALSE;

    v_total_processed := v_total_processed + 1;
  END LOOP;

  RETURN v_total_processed;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED INITIAL DISTRICT STATES
-- =============================================================================

INSERT INTO district_states (district_id, crime_index, police_presence, property_values, business_health, street_activity, district_status)
VALUES
  ('downtown', 60, 70, 55, 85, 75, 'stable'),
  ('yorkville', 30, 75, 85, 90, 70, 'gentrifying'),
  ('regent_park', 70, 55, 35, 40, 55, 'volatile'),
  ('scarborough', 55, 40, 35, 45, 50, 'stable'),
  ('etobicoke', 50, 45, 45, 50, 45, 'stable'),
  ('north_york', 45, 50, 50, 55, 55, 'stable'),
  ('queen_west', 55, 55, 55, 65, 75, 'stable'),
  ('kensington', 60, 45, 45, 55, 70, 'volatile'),
  ('port_lands', 70, 35, 40, 40, 30, 'declining'),
  ('junction', 50, 50, 50, 60, 55, 'stable'),
  ('parkdale', 65, 45, 40, 45, 60, 'volatile'),
  ('little_italy', 45, 50, 55, 65, 65, 'stable'),
  -- Also include districts from existing seed data
  ('liberty_village', 45, 50, 70, 70, 60, 'gentrifying'),
  ('rosedale', 20, 80, 95, 85, 40, 'gentrifying'),
  ('bridle_path', 15, 85, 100, 90, 30, 'stable')
ON CONFLICT (district_id) DO UPDATE SET
  crime_index = EXCLUDED.crime_index,
  police_presence = EXCLUDED.police_presence,
  property_values = EXCLUDED.property_values,
  business_health = EXCLUDED.business_health,
  street_activity = EXCLUDED.street_activity,
  district_status = EXCLUDED.district_status;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$ BEGIN
  RAISE NOTICE '✅ Territorial Ecosystem migration completed successfully!';
  RAISE NOTICE '   - Created district_states table';
  RAISE NOTICE '   - Created district_events table';
  RAISE NOTICE '   - Created helper functions';
  RAISE NOTICE '   - Seeded % districts', (SELECT COUNT(*) FROM district_states);
END $$;
