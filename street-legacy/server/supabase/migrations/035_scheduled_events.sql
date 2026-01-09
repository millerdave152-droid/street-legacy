-- Street Legacy: Scheduled World Events
-- Migration: 035_scheduled_events
-- Description: Server-driven recurring events like Street Festival, Midnight Market

-- =============================================================================
-- SCHEDULED EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS scheduled_world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Schedule (cron-style or interval)
  schedule_cron VARCHAR(100),           -- e.g., '0 18 * * 5' (Friday 6PM)
  schedule_interval_hours INT,          -- Alternative: every N hours

  -- Duration and timing
  duration_hours INT DEFAULT 24,
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at TIMESTAMPTZ,

  -- Scope
  affected_districts TEXT[],            -- NULL = all districts

  -- Effects (applied while event is active)
  effects JSONB NOT NULL DEFAULT '{}',
  -- e.g., {"crimePayoutModifier": 1.2, "propertyIncomeModifier": 1.15}

  -- Display
  icon VARCHAR(50),
  color VARCHAR(20),
  announcement_message TEXT,

  -- State
  is_active BOOLEAN DEFAULT true,
  is_currently_running BOOLEAN DEFAULT false,
  current_run_started_at TIMESTAMPTZ,
  current_run_ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scheduled_world_events IS 'Server-driven recurring world events';
COMMENT ON COLUMN scheduled_world_events.schedule_cron IS 'Cron expression for scheduling (minute hour day month weekday)';
COMMENT ON COLUMN scheduled_world_events.affected_districts IS 'NULL means all districts affected';

-- =============================================================================
-- EVENT RUN HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS world_event_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES scheduled_world_events(id) ON DELETE CASCADE,
  event_key VARCHAR(100) NOT NULL,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_end_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,

  -- Stats collected during run
  players_participated INT DEFAULT 0,
  total_bonus_payouts BIGINT DEFAULT 0,

  -- State
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE world_event_runs IS 'History of world event activations';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_scheduled_events_active ON scheduled_world_events(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_events_running ON scheduled_world_events(is_currently_running) WHERE is_currently_running = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_events_next ON scheduled_world_events(next_trigger_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_event_runs_event ON world_event_runs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_runs_active ON world_event_runs(status) WHERE status = 'active';

-- =============================================================================
-- DEFAULT SCHEDULED EVENTS
-- =============================================================================

INSERT INTO scheduled_world_events (event_key, name, description, schedule_cron, duration_hours, effects, icon, color, announcement_message) VALUES
  ('street_festival',
   'Street Festival',
   'The streets come alive with opportunity. Crime payouts increased, property income boosted.',
   '0 18 * * 5',  -- Friday 6PM
   48,            -- 48 hours (whole weekend)
   '{"crimePayoutModifier": 1.20, "propertyIncomeModifier": 1.15, "xpModifier": 1.10}',
   'party',
   '#ff6b6b',
   'The Street Festival has begun! Increased payouts all weekend!'),

  ('midnight_market',
   'Midnight Market',
   'Underground dealers offer rare items at steep discounts. Black market prices slashed.',
   '0 0 * * 6',   -- Saturday midnight
   6,             -- 6 hours
   '{"shopPriceModifier": 0.75, "blackMarketDiscount": 0.25, "rareItemChance": 1.5}',
   'moon',
   '#9b59b6',
   'The Midnight Market opens its doors... rare deals await in the shadows.'),

  ('heat_wave',
   'Heat Wave Sunday',
   'Cops are slow in the heat. Crime success up, but heat decays slower.',
   '0 12 * * 0',  -- Sunday noon
   8,             -- 8 hours
   '{"crimeSuccessModifier": 0.15, "heatDecayModifier": 0.7, "policeResponseModifier": 1.3}',
   'fire',
   '#e74c3c',
   'Heat wave in effect! Police response times slowed.'),

  ('payday_friday',
   'Payday Friday',
   'Workers just got paid. Mugging and theft payouts significantly increased.',
   '0 17 * * 5',  -- Friday 5PM
   6,
   '{"crimePayoutModifier": 1.35, "muggingPayoutModifier": 1.5, "heatGainModifier": 1.1}',
   'money',
   '#2ecc71',
   'Payday Friday! The streets are flush with cash.'),

  ('police_shift_change',
   'Shift Change',
   'Police shift change creates a window of opportunity. Reduced police presence.',
   '0 6 * * *',   -- Daily at 6AM
   2,             -- 2 hours
   '{"policePresenceModifier": 0.6, "crimeSuccessModifier": 0.10, "escapeChanceModifier": 1.2}',
   'clock',
   '#3498db',
   'Police shift change in progress. Streets are quieter than usual.'),

  ('double_xp_weekend',
   'Double XP Weekend',
   'All experience gains doubled for the weekend.',
   '0 0 * * 6',   -- Saturday midnight
   48,
   '{"xpModifier": 2.0}',
   'star',
   '#f1c40f',
   'DOUBLE XP WEEKEND! All experience gains doubled!')
ON CONFLICT (event_key) DO NOTHING;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Calculate next trigger time from cron expression
 * Simplified version - handles basic patterns
 */
CREATE OR REPLACE FUNCTION calculate_next_trigger(
  p_cron VARCHAR(100),
  p_from TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_parts TEXT[];
  v_minute INT;
  v_hour INT;
  v_day_of_week INT;
  v_next TIMESTAMPTZ;
  v_current TIMESTAMPTZ;
BEGIN
  -- Parse cron: minute hour day month weekday
  v_parts := string_to_array(p_cron, ' ');

  IF array_length(v_parts, 1) < 5 THEN
    RETURN NULL;
  END IF;

  v_minute := CASE WHEN v_parts[1] = '*' THEN 0 ELSE v_parts[1]::INT END;
  v_hour := CASE WHEN v_parts[2] = '*' THEN 0 ELSE v_parts[2]::INT END;
  v_day_of_week := CASE WHEN v_parts[5] = '*' THEN -1 ELSE v_parts[5]::INT END;

  -- Start from current time
  v_current := p_from;

  -- Find next occurrence
  FOR i IN 1..8 LOOP  -- Check up to 8 days ahead
    v_next := DATE_TRUNC('day', v_current) + (i - 1) * INTERVAL '1 day'
              + v_hour * INTERVAL '1 hour' + v_minute * INTERVAL '1 minute';

    -- Check if day of week matches (or if any day is ok)
    IF v_day_of_week = -1 OR EXTRACT(DOW FROM v_next) = v_day_of_week THEN
      IF v_next > p_from THEN
        RETURN v_next;
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

/**
 * Start a scheduled event
 */
CREATE OR REPLACE FUNCTION start_scheduled_event(p_event_key VARCHAR(100))
RETURNS UUID AS $$
DECLARE
  v_event RECORD;
  v_run_id UUID;
  v_ends_at TIMESTAMPTZ;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM scheduled_world_events WHERE event_key = p_event_key;

  IF NOT FOUND OR NOT v_event.is_active THEN
    RETURN NULL;
  END IF;

  -- Check if already running
  IF v_event.is_currently_running THEN
    RETURN NULL;
  END IF;

  v_ends_at := NOW() + (v_event.duration_hours || ' hours')::INTERVAL;

  -- Create run record
  INSERT INTO world_event_runs (event_id, event_key, scheduled_end_at)
  VALUES (v_event.id, p_event_key, v_ends_at)
  RETURNING id INTO v_run_id;

  -- Update event state
  UPDATE scheduled_world_events SET
    is_currently_running = true,
    current_run_started_at = NOW(),
    current_run_ends_at = v_ends_at,
    last_triggered_at = NOW(),
    next_trigger_at = calculate_next_trigger(schedule_cron, NOW() + INTERVAL '1 day'),
    updated_at = NOW()
  WHERE event_key = p_event_key;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

/**
 * End a scheduled event
 */
CREATE OR REPLACE FUNCTION end_scheduled_event(p_event_key VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
  v_event RECORD;
BEGIN
  SELECT * INTO v_event FROM scheduled_world_events WHERE event_key = p_event_key;

  IF NOT FOUND OR NOT v_event.is_currently_running THEN
    RETURN FALSE;
  END IF;

  -- End active run
  UPDATE world_event_runs SET
    actual_end_at = NOW(),
    status = 'completed'
  WHERE event_key = p_event_key AND status = 'active';

  -- Update event state
  UPDATE scheduled_world_events SET
    is_currently_running = false,
    current_run_started_at = NULL,
    current_run_ends_at = NULL,
    updated_at = NOW()
  WHERE event_key = p_event_key;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

/**
 * Get all currently active world events
 */
CREATE OR REPLACE FUNCTION get_active_world_events()
RETURNS TABLE (
  event_key VARCHAR(100),
  name VARCHAR(100),
  description TEXT,
  effects JSONB,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  time_remaining INTERVAL,
  icon VARCHAR(50),
  color VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    swe.event_key,
    swe.name,
    swe.description,
    swe.effects,
    swe.current_run_started_at AS started_at,
    swe.current_run_ends_at AS ends_at,
    GREATEST(swe.current_run_ends_at - NOW(), INTERVAL '0 seconds') AS time_remaining,
    swe.icon,
    swe.color
  FROM scheduled_world_events swe
  WHERE swe.is_currently_running = true
  AND swe.current_run_ends_at > NOW();
END;
$$ LANGUAGE plpgsql;

/**
 * Get combined modifiers from all active world events
 */
CREATE OR REPLACE FUNCTION get_world_event_modifiers()
RETURNS JSONB AS $$
DECLARE
  v_combined JSONB := '{}';
  v_event RECORD;
BEGIN
  FOR v_event IN
    SELECT effects FROM scheduled_world_events
    WHERE is_currently_running = true
    AND current_run_ends_at > NOW()
  LOOP
    v_combined := v_combined || v_event.effects;
  END LOOP;

  RETURN v_combined;
END;
$$ LANGUAGE plpgsql;

/**
 * Check and start due events, end expired events
 */
CREATE OR REPLACE FUNCTION process_scheduled_events()
RETURNS TABLE (
  action VARCHAR(20),
  event_key VARCHAR(100)
) AS $$
DECLARE
  v_event RECORD;
BEGIN
  -- End expired events
  FOR v_event IN
    SELECT swe.event_key FROM scheduled_world_events swe
    WHERE swe.is_currently_running = true
    AND swe.current_run_ends_at < NOW()
  LOOP
    PERFORM end_scheduled_event(v_event.event_key);
    action := 'ended';
    event_key := v_event.event_key;
    RETURN NEXT;
  END LOOP;

  -- Start due events
  FOR v_event IN
    SELECT swe.event_key FROM scheduled_world_events swe
    WHERE swe.is_active = true
    AND swe.is_currently_running = false
    AND swe.next_trigger_at IS NOT NULL
    AND swe.next_trigger_at <= NOW()
  LOOP
    PERFORM start_scheduled_event(v_event.event_key);
    action := 'started';
    event_key := v_event.event_key;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INITIALIZE NEXT TRIGGER TIMES
-- =============================================================================

UPDATE scheduled_world_events
SET next_trigger_at = calculate_next_trigger(schedule_cron, NOW())
WHERE schedule_cron IS NOT NULL AND next_trigger_at IS NULL;
