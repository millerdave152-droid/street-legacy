-- Street Legacy: Territorial Ecosystem Migration
-- Migration: 025_territorial_ecosystem
-- Description: Creates district_states and district_events tables for dynamic territorial ecosystem
--              Districts become living environments that respond to player behavior

-- =============================================================================
-- ENUMS
-- =============================================================================

-- District status types representing the overall state of a district
CREATE TYPE district_status_enum AS ENUM (
  'stable',       -- Normal operations, balanced metrics
  'volatile',     -- Unstable, rapid changes occurring
  'warzone',      -- Active crew conflicts, high crime
  'gentrifying',  -- Property values rising, crime decreasing
  'declining'     -- Economic downturn, businesses closing
);

-- Event types that affect district state
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

-- =============================================================================
-- DISTRICT STATES TABLE
-- =============================================================================

CREATE TABLE district_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) UNIQUE NOT NULL REFERENCES districts(id) ON DELETE CASCADE,

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

-- Table comments
COMMENT ON TABLE district_states IS 'Dynamic state tracking for each district - updates based on player activity';
COMMENT ON COLUMN district_states.crime_index IS 'Current crime activity level (0=peaceful, 100=lawless)';
COMMENT ON COLUMN district_states.police_presence IS 'Active police patrols and response (0=absent, 100=heavy)';
COMMENT ON COLUMN district_states.property_values IS 'Real estate market health (0=crashed, 100=booming)';
COMMENT ON COLUMN district_states.business_health IS 'Business prosperity level (0=failing, 100=thriving)';
COMMENT ON COLUMN district_states.street_activity IS 'General street activity/foot traffic (0=dead, 100=bustling)';
COMMENT ON COLUMN district_states.district_status IS 'Overall district classification based on metrics';
COMMENT ON COLUMN district_states.heat_level IS 'Accumulated heat from recent criminal activity';
COMMENT ON COLUMN district_states.crew_tension IS 'Tension between competing crews in the area';

-- Indexes for district_states
CREATE INDEX idx_district_states_district_id ON district_states(district_id);
CREATE INDEX idx_district_states_status ON district_states(district_status);
CREATE INDEX idx_district_states_crime_index ON district_states(crime_index);
CREATE INDEX idx_district_states_last_calculated ON district_states(last_calculated);

-- =============================================================================
-- DISTRICT EVENTS TABLE
-- =============================================================================

CREATE TABLE district_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  event_type district_event_type_enum NOT NULL,

  -- Event details
  severity INTEGER DEFAULT 1 CHECK (severity >= 1 AND severity <= 10),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  target_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  crew_id UUID, -- References crews table if applicable

  -- Flexible metadata for event-specific data
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Impact on district metrics (can be positive or negative)
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

-- Table comments
COMMENT ON TABLE district_events IS 'Event log tracking all activities that affect district state';
COMMENT ON COLUMN district_events.severity IS 'Impact severity (1=minor, 10=major district-changing event)';
COMMENT ON COLUMN district_events.metadata IS 'JSON object with event-specific details (crime_type, amount, etc.)';
COMMENT ON COLUMN district_events.crime_impact IS 'How this event affects crime_index (-50 to +50)';
COMMENT ON COLUMN district_events.processed IS 'Whether this event has been calculated into district state';

-- Indexes for district_events (optimized for common queries)
CREATE INDEX idx_district_events_district_created ON district_events(district_id, created_at DESC);
CREATE INDEX idx_district_events_type ON district_events(event_type);
CREATE INDEX idx_district_events_player ON district_events(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_district_events_unprocessed ON district_events(processed, created_at) WHERE processed = FALSE;
CREATE INDEX idx_district_events_severity ON district_events(severity DESC);
CREATE INDEX idx_district_events_recent ON district_events(created_at DESC);

-- Partial index for high-severity events
CREATE INDEX idx_district_events_high_severity ON district_events(district_id, created_at DESC)
  WHERE severity >= 7;

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

CREATE TRIGGER trigger_district_states_updated_at
  BEFORE UPDATE ON district_states
  FOR EACH ROW
  EXECUTE FUNCTION update_district_states_updated_at();

-- =============================================================================
-- FUNCTION: Calculate District Status
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_district_status(
  p_crime_index INTEGER,
  p_police_presence INTEGER,
  p_property_values INTEGER,
  p_business_health INTEGER,
  p_crew_tension INTEGER
) RETURNS district_status_enum AS $$
BEGIN
  -- Warzone: High crime AND high crew tension
  IF p_crime_index >= 70 AND p_crew_tension >= 60 THEN
    RETURN 'warzone';
  END IF;

  -- Gentrifying: High property values, increasing business, low crime
  IF p_property_values >= 65 AND p_business_health >= 60 AND p_crime_index <= 40 THEN
    RETURN 'gentrifying';
  END IF;

  -- Declining: Low business health, low property values
  IF p_business_health <= 35 AND p_property_values <= 40 THEN
    RETURN 'declining';
  END IF;

  -- Volatile: Large swings or mid-high crime with moderate tension
  IF p_crime_index >= 55 AND p_crew_tension >= 40 THEN
    RETURN 'volatile';
  END IF;

  -- Default: Stable
  RETURN 'stable';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Record District Event
-- =============================================================================

CREATE OR REPLACE FUNCTION record_district_event(
  p_district_id VARCHAR(50),
  p_event_type district_event_type_enum,
  p_player_id UUID DEFAULT NULL,
  p_severity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_target_player_id UUID DEFAULT NULL,
  p_crew_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_crime_impact INTEGER := 0;
  v_police_impact INTEGER := 0;
  v_property_impact INTEGER := 0;
  v_business_impact INTEGER := 0;
  v_activity_impact INTEGER := 0;
BEGIN
  -- Calculate impacts based on event type and severity
  CASE p_event_type
    WHEN 'crime_committed' THEN
      v_crime_impact := p_severity * 2;
      v_police_impact := p_severity;
      v_activity_impact := p_severity;
    WHEN 'property_bought' THEN
      v_property_impact := p_severity;
      v_business_impact := CEIL(p_severity * 0.5);
    WHEN 'property_sold' THEN
      v_property_impact := -CEIL(p_severity * 0.5);
    WHEN 'crew_battle' THEN
      v_crime_impact := p_severity * 3;
      v_police_impact := p_severity * 2;
      v_activity_impact := -p_severity;
      v_business_impact := -p_severity;
    WHEN 'business_opened' THEN
      v_business_impact := p_severity * 2;
      v_property_impact := p_severity;
      v_activity_impact := p_severity;
    WHEN 'business_closed' THEN
      v_business_impact := -p_severity * 2;
      v_property_impact := -p_severity;
      v_activity_impact := -p_severity;
    WHEN 'player_attacked' THEN
      v_crime_impact := p_severity;
      v_police_impact := CEIL(p_severity * 0.5);
    WHEN 'police_raid' THEN
      v_police_impact := p_severity * 3;
      v_crime_impact := -p_severity * 2;
    WHEN 'territory_claimed' THEN
      v_crime_impact := p_severity;
      v_activity_impact := p_severity;
    WHEN 'heist_executed' THEN
      v_crime_impact := p_severity * 4;
      v_police_impact := p_severity * 3;
      v_business_impact := -p_severity;
    WHEN 'gentrification' THEN
      v_property_impact := p_severity * 2;
      v_business_impact := p_severity;
      v_crime_impact := -p_severity;
    WHEN 'economic_boost' THEN
      v_business_impact := p_severity * 2;
      v_property_impact := p_severity;
      v_activity_impact := p_severity;
    WHEN 'economic_crash' THEN
      v_business_impact := -p_severity * 3;
      v_property_impact := -p_severity * 2;
      v_crime_impact := p_severity;
    ELSE
      -- Default minimal impact
      v_activity_impact := 1;
  END CASE;

  -- Insert the event
  INSERT INTO district_events (
    district_id, event_type, severity, player_id, target_player_id, crew_id,
    metadata, crime_impact, police_impact, property_impact, business_impact, activity_impact
  ) VALUES (
    p_district_id, p_event_type, p_severity, p_player_id, p_target_player_id, p_crew_id,
    p_metadata, v_crime_impact, v_police_impact, v_property_impact, v_business_impact, v_activity_impact
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Process District Events (called periodically)
-- =============================================================================

CREATE OR REPLACE FUNCTION process_district_events() RETURNS INTEGER AS $$
DECLARE
  v_district RECORD;
  v_events_processed INTEGER := 0;
  v_crime_delta INTEGER;
  v_police_delta INTEGER;
  v_property_delta INTEGER;
  v_business_delta INTEGER;
  v_activity_delta INTEGER;
  v_new_crime INTEGER;
  v_new_police INTEGER;
  v_new_property INTEGER;
  v_new_business INTEGER;
  v_new_activity INTEGER;
  v_new_status district_status_enum;
  v_crew_tension INTEGER;
BEGIN
  -- Process each district with unprocessed events
  FOR v_district IN
    SELECT DISTINCT district_id FROM district_events WHERE processed = FALSE
  LOOP
    -- Sum up all unprocessed event impacts for this district
    SELECT
      COALESCE(SUM(crime_impact), 0),
      COALESCE(SUM(police_impact), 0),
      COALESCE(SUM(property_impact), 0),
      COALESCE(SUM(business_impact), 0),
      COALESCE(SUM(activity_impact), 0),
      COUNT(*)
    INTO v_crime_delta, v_police_delta, v_property_delta, v_business_delta, v_activity_delta, v_events_processed
    FROM district_events
    WHERE district_id = v_district.district_id AND processed = FALSE;

    -- Calculate crew tension from recent crew battles
    SELECT COUNT(*) * 5 INTO v_crew_tension
    FROM district_events
    WHERE district_id = v_district.district_id
      AND event_type = 'crew_battle'
      AND created_at > NOW() - INTERVAL '24 hours';
    v_crew_tension := LEAST(100, v_crew_tension);

    -- Update district_states with clamped values
    UPDATE district_states SET
      crime_index = GREATEST(0, LEAST(100, crime_index + v_crime_delta)),
      police_presence = GREATEST(0, LEAST(100, police_presence + v_police_delta)),
      property_values = GREATEST(0, LEAST(100, property_values + v_property_delta)),
      business_health = GREATEST(0, LEAST(100, business_health + v_business_delta)),
      street_activity = GREATEST(0, LEAST(100, street_activity + v_activity_delta)),
      crew_tension = v_crew_tension,
      last_calculated = NOW()
    WHERE district_id = v_district.district_id
    RETURNING crime_index, police_presence, property_values, business_health, crew_tension
    INTO v_new_crime, v_new_police, v_new_property, v_new_business, v_crew_tension;

    -- Calculate and update status
    v_new_status := calculate_district_status(v_new_crime, v_new_police, v_new_property, v_new_business, v_crew_tension);

    UPDATE district_states SET
      district_status = v_new_status,
      last_status_change = CASE WHEN district_status != v_new_status THEN NOW() ELSE last_status_change END
    WHERE district_id = v_district.district_id;

    -- Mark events as processed
    UPDATE district_events SET
      processed = TRUE,
      processed_at = NOW()
    WHERE district_id = v_district.district_id AND processed = FALSE;
  END LOOP;

  RETURN v_events_processed;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Decay District Metrics (natural regression to baseline)
-- =============================================================================

CREATE OR REPLACE FUNCTION decay_district_metrics() RETURNS VOID AS $$
BEGIN
  -- Gradually move metrics toward baseline (50) over time
  -- This prevents permanent extreme states
  UPDATE district_states SET
    crime_index = CASE
      WHEN crime_index > 50 THEN crime_index - 1
      WHEN crime_index < 50 THEN crime_index + 1
      ELSE crime_index
    END,
    police_presence = CASE
      WHEN police_presence > 50 THEN police_presence - 1
      WHEN police_presence < 50 THEN police_presence + 1
      ELSE police_presence
    END,
    heat_level = GREATEST(0, heat_level - 2),
    crew_tension = GREATEST(0, crew_tension - 1),
    daily_crime_count = 0,  -- Reset daily counters
    daily_transaction_volume = 0,
    last_calculated = NOW()
  WHERE last_calculated < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get District Summary
-- =============================================================================

CREATE OR REPLACE FUNCTION get_district_summary(p_district_id VARCHAR(50))
RETURNS TABLE (
  district_id VARCHAR(50),
  district_name VARCHAR(100),
  crime_index INTEGER,
  police_presence INTEGER,
  property_values INTEGER,
  business_health INTEGER,
  street_activity INTEGER,
  district_status district_status_enum,
  heat_level INTEGER,
  crew_tension INTEGER,
  recent_events BIGINT,
  controlling_crew_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.district_id,
    d.name,
    ds.crime_index,
    ds.police_presence,
    ds.property_values,
    ds.business_health,
    ds.street_activity,
    ds.district_status,
    ds.heat_level,
    ds.crew_tension,
    (SELECT COUNT(*) FROM district_events de
     WHERE de.district_id = ds.district_id
     AND de.created_at > NOW() - INTERVAL '24 hours'),
    d.controlling_crew_id
  FROM district_states ds
  JOIN districts d ON d.id = ds.district_id
  WHERE ds.district_id = p_district_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DISTRICT STATES FOR ALL EXISTING DISTRICTS
-- =============================================================================

-- Insert initial state for all districts based on their existing attributes
INSERT INTO district_states (district_id, crime_index, police_presence, property_values, business_health, street_activity, district_status)
SELECT
  d.id,
  d.crime_rate,                                    -- Use existing crime_rate
  d.police_presence,                               -- Use existing police_presence
  CASE d.difficulty                                -- Property values based on difficulty
    WHEN 1 THEN 35
    WHEN 2 THEN 45
    WHEN 3 THEN 55
    WHEN 4 THEN 70
    WHEN 5 THEN 85
    ELSE 50
  END,
  d.economy_level,                                 -- Business health from economy
  CASE                                             -- Street activity based on district type
    WHEN d.id IN ('downtown', 'yorkville', 'queen_west') THEN 75
    WHEN d.id IN ('port_lands', 'bridle_path') THEN 30
    ELSE 50
  END,
  CASE                                             -- Initial status based on characteristics
    WHEN d.crime_rate >= 65 THEN 'volatile'::district_status_enum
    WHEN d.economy_level >= 80 AND d.crime_rate <= 35 THEN 'gentrifying'::district_status_enum
    WHEN d.economy_level <= 40 THEN 'declining'::district_status_enum
    ELSE 'stable'::district_status_enum
  END
FROM districts d
ON CONFLICT (district_id) DO UPDATE SET
  crime_index = EXCLUDED.crime_index,
  police_presence = EXCLUDED.police_presence,
  property_values = EXCLUDED.property_values,
  business_health = EXCLUDED.business_health,
  street_activity = EXCLUDED.street_activity,
  district_status = EXCLUDED.district_status;

-- =============================================================================
-- GRANTS (for Supabase RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE district_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_events ENABLE ROW LEVEL SECURITY;

-- Public read access to district states (game needs to see this)
CREATE POLICY "Anyone can view district states" ON district_states
  FOR SELECT USING (true);

-- Only server can modify district states
CREATE POLICY "Server can modify district states" ON district_states
  FOR ALL USING (auth.role() = 'service_role');

-- Players can view events
CREATE POLICY "Anyone can view district events" ON district_events
  FOR SELECT USING (true);

-- Server inserts events
CREATE POLICY "Server can insert district events" ON district_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION record_district_event IS 'Records a new event and calculates its impact on district metrics';
COMMENT ON FUNCTION process_district_events IS 'Processes all unprocessed events and updates district states';
COMMENT ON FUNCTION decay_district_metrics IS 'Gradually returns district metrics to baseline over time';
COMMENT ON FUNCTION calculate_district_status IS 'Determines district status based on current metrics';
COMMENT ON FUNCTION get_district_summary IS 'Returns comprehensive district state information';
