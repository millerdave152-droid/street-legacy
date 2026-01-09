-- Street Legacy: District Threshold Events
-- Migration: 034_district_events
-- Description: Enable threshold-triggered district events based on player behavior

-- =============================================================================
-- DISTRICT STATE EXTENSIONS
-- =============================================================================

-- Add active event tracking to district_states (if table exists)
DO $$
BEGIN
  -- Check if district_states table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'district_states') THEN
    ALTER TABLE district_states ADD COLUMN IF NOT EXISTS active_event VARCHAR(50);
    ALTER TABLE district_states ADD COLUMN IF NOT EXISTS event_expires_at TIMESTAMPTZ;
    ALTER TABLE district_states ADD COLUMN IF NOT EXISTS event_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================================================
-- DISTRICT EVENT HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS district_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id),
  event_type VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(50) NOT NULL, -- 'threshold' | 'scheduled' | 'admin' | 'player'
  trigger_value INT,
  trigger_metric VARCHAR(50), -- 'crime_index' | 'police_presence' | 'business_health' etc.

  -- Event details
  effects JSONB DEFAULT '{}',
  duration_minutes INT DEFAULT 120,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by VARCHAR(50), -- 'expired' | 'admin' | 'countered'

  -- Participation
  players_affected INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE district_event_history IS 'History of district-wide events triggered by thresholds';
COMMENT ON COLUMN district_event_history.triggered_by IS 'What caused this event: threshold, scheduled, admin, player';
COMMENT ON COLUMN district_event_history.trigger_metric IS 'Which metric triggered the event';

-- =============================================================================
-- DISTRICT EVENT DEFINITIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS district_event_types (
  event_type VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Trigger conditions
  trigger_metric VARCHAR(50), -- 'crime_index' | 'police_presence' | 'business_health' | 'street_activity'
  trigger_threshold INT,
  trigger_direction VARCHAR(10), -- 'above' | 'below'

  -- Effects
  effects JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"crimeSuccessModifier": -0.15, "heatGainModifier": 2.0}

  -- Duration
  default_duration_minutes INT DEFAULT 120,
  cooldown_minutes INT DEFAULT 60, -- Minimum time before same event can trigger again

  -- Display
  icon VARCHAR(50),
  color VARCHAR(20),

  is_active BOOLEAN DEFAULT true
);

-- Insert default event types
INSERT INTO district_event_types (event_type, name, description, trigger_metric, trigger_threshold, trigger_direction, effects, default_duration_minutes, cooldown_minutes, icon, color) VALUES
  ('police_crackdown', 'Police Crackdown', 'Increased police presence reduces crime success and doubles heat gain',
   'crime_index', 80, 'above',
   '{"crimeSuccessModifier": -0.15, "heatGainModifier": 2.0, "policeResponseModifier": 0.7}',
   120, 60, 'police', '#ff4444'),

  ('lawless_zone', 'Lawless Zone', 'Low police presence creates opportunities but increases danger',
   'police_presence', 20, 'below',
   '{"crimeSuccessModifier": 0.10, "crimePayoutModifier": 1.25, "pvpDamageModifier": 1.5}',
   90, 120, 'skull', '#ff8800'),

  ('economic_boom', 'Economic Boom', 'Thriving business district increases property income and shop deals',
   'business_health', 80, 'above',
   '{"propertyIncomeModifier": 1.3, "shopPriceModifier": 0.9, "businessRevenueModifier": 1.25}',
   180, 90, 'money', '#44ff44'),

  ('street_heat', 'Street Heat', 'High street activity draws attention but increases payouts',
   'street_activity', 75, 'above',
   '{"crimePayoutModifier": 1.2, "heatGainModifier": 1.3, "xpModifier": 1.15}',
   60, 45, 'fire', '#ffaa00'),

  ('gang_tensions', 'Gang Tensions', 'Crew conflicts make the streets dangerous but profitable',
   'crew_tension', 70, 'above',
   '{"crimePayoutModifier": 1.15, "territoryPointModifier": 1.5, "pvpDamageModifier": 1.25}',
   120, 180, 'warning', '#ff6600'),

  ('quiet_streets', 'Quiet Streets', 'Low activity makes crimes easier but less rewarding',
   'street_activity', 25, 'below',
   '{"crimeSuccessModifier": 0.10, "crimePayoutModifier": 0.8, "heatGainModifier": 0.7}',
   60, 30, 'moon', '#6666ff')
ON CONFLICT (event_type) DO NOTHING;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_district_events_district ON district_event_history(district_id);
CREATE INDEX IF NOT EXISTS idx_district_events_type ON district_event_history(event_type);
CREATE INDEX IF NOT EXISTS idx_district_events_active ON district_event_history(district_id, started_at DESC) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_district_events_time ON district_event_history(started_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Check if a specific event type is currently active in a district
 */
CREATE OR REPLACE FUNCTION is_district_event_active(
  p_district_id VARCHAR(50),
  p_event_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM district_event_history
    WHERE district_id = p_district_id
    AND event_type = p_event_type
    AND ended_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;

/**
 * Check if event is on cooldown for a district
 */
CREATE OR REPLACE FUNCTION is_district_event_on_cooldown(
  p_district_id VARCHAR(50),
  p_event_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_cooldown_minutes INT;
  v_last_ended TIMESTAMPTZ;
BEGIN
  SELECT cooldown_minutes INTO v_cooldown_minutes
  FROM district_event_types WHERE event_type = p_event_type;

  SELECT MAX(COALESCE(ended_at, expires_at)) INTO v_last_ended
  FROM district_event_history
  WHERE district_id = p_district_id AND event_type = p_event_type;

  IF v_last_ended IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_last_ended + (v_cooldown_minutes || ' minutes')::INTERVAL > NOW();
END;
$$ LANGUAGE plpgsql;

/**
 * Trigger a district event
 */
CREATE OR REPLACE FUNCTION trigger_district_event(
  p_district_id VARCHAR(50),
  p_event_type VARCHAR(50),
  p_triggered_by VARCHAR(50) DEFAULT 'threshold',
  p_trigger_value INT DEFAULT NULL,
  p_trigger_metric VARCHAR(50) DEFAULT NULL,
  p_duration_override INT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_def RECORD;
  v_event_id UUID;
  v_duration INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get event definition
  SELECT * INTO v_event_def FROM district_event_types WHERE event_type = p_event_type;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown event type: %', p_event_type;
  END IF;

  -- Check if already active
  IF is_district_event_active(p_district_id, p_event_type) THEN
    RETURN NULL;
  END IF;

  -- Check cooldown
  IF is_district_event_on_cooldown(p_district_id, p_event_type) THEN
    RETURN NULL;
  END IF;

  -- Calculate duration and expiry
  v_duration := COALESCE(p_duration_override, v_event_def.default_duration_minutes);
  v_expires_at := NOW() + (v_duration || ' minutes')::INTERVAL;

  -- Insert event
  INSERT INTO district_event_history (
    district_id, event_type, triggered_by, trigger_value, trigger_metric,
    effects, duration_minutes, expires_at
  ) VALUES (
    p_district_id, p_event_type, p_triggered_by, p_trigger_value, p_trigger_metric,
    v_event_def.effects, v_duration, v_expires_at
  )
  RETURNING id INTO v_event_id;

  -- Update district_states if table exists
  BEGIN
    UPDATE district_states SET
      active_event = p_event_type,
      event_started_at = NOW(),
      event_expires_at = v_expires_at
    WHERE district_id = p_district_id;
  EXCEPTION WHEN undefined_table THEN
    NULL; -- district_states doesn't exist yet
  END;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

/**
 * End a district event
 */
CREATE OR REPLACE FUNCTION end_district_event(
  p_district_id VARCHAR(50),
  p_event_type VARCHAR(50),
  p_ended_by VARCHAR(50) DEFAULT 'expired'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE district_event_history SET
    ended_at = NOW(),
    ended_by = p_ended_by
  WHERE district_id = p_district_id
  AND event_type = p_event_type
  AND ended_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Clear district_states
  BEGIN
    UPDATE district_states SET
      active_event = NULL,
      event_started_at = NULL,
      event_expires_at = NULL
    WHERE district_id = p_district_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

/**
 * Get active events for a district with effects
 */
CREATE OR REPLACE FUNCTION get_active_district_events(p_district_id VARCHAR(50))
RETURNS TABLE (
  event_id UUID,
  event_type VARCHAR(50),
  name VARCHAR(100),
  description TEXT,
  effects JSONB,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  time_remaining INTERVAL,
  icon VARCHAR(50),
  color VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    deh.id AS event_id,
    deh.event_type,
    det.name,
    det.description,
    deh.effects,
    deh.started_at,
    deh.expires_at,
    GREATEST(deh.expires_at - NOW(), INTERVAL '0 seconds') AS time_remaining,
    det.icon,
    det.color
  FROM district_event_history deh
  JOIN district_event_types det ON deh.event_type = det.event_type
  WHERE deh.district_id = p_district_id
  AND deh.ended_at IS NULL
  AND (deh.expires_at IS NULL OR deh.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

/**
 * Get combined event modifiers for a district
 */
CREATE OR REPLACE FUNCTION get_district_event_modifiers(p_district_id VARCHAR(50))
RETURNS JSONB AS $$
DECLARE
  v_combined JSONB := '{}';
  v_event RECORD;
BEGIN
  FOR v_event IN
    SELECT effects FROM district_event_history
    WHERE district_id = p_district_id
    AND ended_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LOOP
    -- Merge effects (later events override earlier ones for same key)
    v_combined := v_combined || v_event.effects;
  END LOOP;

  RETURN v_combined;
END;
$$ LANGUAGE plpgsql;

/**
 * Check and trigger threshold events for all districts
 * Should be called periodically (e.g., every 5 minutes)
 */
CREATE OR REPLACE FUNCTION check_all_district_thresholds()
RETURNS TABLE (
  district_id VARCHAR(50),
  event_triggered VARCHAR(50)
) AS $$
DECLARE
  v_district RECORD;
  v_event_type RECORD;
  v_triggered BOOLEAN;
BEGIN
  -- This requires district_states table to exist
  FOR v_district IN
    SELECT ds.district_id, ds.crime_index, ds.police_presence,
           ds.business_health, ds.street_activity, ds.crew_tension
    FROM district_states ds
  LOOP
    -- Check each event type
    FOR v_event_type IN
      SELECT * FROM district_event_types WHERE is_active = true AND trigger_metric IS NOT NULL
    LOOP
      v_triggered := FALSE;

      -- Check if threshold is crossed
      IF v_event_type.trigger_direction = 'above' THEN
        CASE v_event_type.trigger_metric
          WHEN 'crime_index' THEN v_triggered := v_district.crime_index >= v_event_type.trigger_threshold;
          WHEN 'police_presence' THEN v_triggered := v_district.police_presence >= v_event_type.trigger_threshold;
          WHEN 'business_health' THEN v_triggered := v_district.business_health >= v_event_type.trigger_threshold;
          WHEN 'street_activity' THEN v_triggered := v_district.street_activity >= v_event_type.trigger_threshold;
          WHEN 'crew_tension' THEN v_triggered := v_district.crew_tension >= v_event_type.trigger_threshold;
          ELSE NULL;
        END CASE;
      ELSIF v_event_type.trigger_direction = 'below' THEN
        CASE v_event_type.trigger_metric
          WHEN 'crime_index' THEN v_triggered := v_district.crime_index <= v_event_type.trigger_threshold;
          WHEN 'police_presence' THEN v_triggered := v_district.police_presence <= v_event_type.trigger_threshold;
          WHEN 'business_health' THEN v_triggered := v_district.business_health <= v_event_type.trigger_threshold;
          WHEN 'street_activity' THEN v_triggered := v_district.street_activity <= v_event_type.trigger_threshold;
          WHEN 'crew_tension' THEN v_triggered := v_district.crew_tension <= v_event_type.trigger_threshold;
          ELSE NULL;
        END CASE;
      END IF;

      -- Trigger event if threshold crossed
      IF v_triggered THEN
        IF trigger_district_event(
          v_district.district_id,
          v_event_type.event_type,
          'threshold',
          CASE v_event_type.trigger_metric
            WHEN 'crime_index' THEN v_district.crime_index
            WHEN 'police_presence' THEN v_district.police_presence
            WHEN 'business_health' THEN v_district.business_health
            WHEN 'street_activity' THEN v_district.street_activity
            WHEN 'crew_tension' THEN v_district.crew_tension
          END,
          v_event_type.trigger_metric
        ) IS NOT NULL THEN
          district_id := v_district.district_id;
          event_triggered := v_event_type.event_type;
          RETURN NEXT;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

/**
 * Expire ended events
 */
CREATE OR REPLACE FUNCTION expire_district_events()
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_event RECORD;
BEGIN
  FOR v_event IN
    SELECT id, district_id, event_type
    FROM district_event_history
    WHERE ended_at IS NULL AND expires_at < NOW()
  LOOP
    PERFORM end_district_event(v_event.district_id, v_event.event_type, 'expired');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
