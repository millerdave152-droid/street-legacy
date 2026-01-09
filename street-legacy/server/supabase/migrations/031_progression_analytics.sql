-- Street Legacy: Progression Analytics System
-- Migration: 031_progression_analytics
-- Description: Tracks player progression events to identify stall points and optimize gameplay

-- =============================================================================
-- PROGRESSION EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS progression_events (
  id BIGSERIAL PRIMARY KEY,

  -- When the event occurred (client timestamp)
  event_time TIMESTAMPTZ NOT NULL,

  -- When we received it (server timestamp)
  received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Player info
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  session_id VARCHAR(50) NOT NULL,

  -- Player state at time of event
  player_level INT NOT NULL CHECK (player_level >= 1),
  player_band VARCHAR(20) NOT NULL, -- EARLY, MID, LATE

  -- Event details
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}'
);

COMMENT ON TABLE progression_events IS 'Client-side progression events for analytics';
COMMENT ON COLUMN progression_events.event_time IS 'When the event occurred on the client';
COMMENT ON COLUMN progression_events.received_at IS 'When the server received the event';
COMMENT ON COLUMN progression_events.session_id IS 'Client session identifier';
COMMENT ON COLUMN progression_events.player_band IS 'EARLY (1-10), MID (11-25), LATE (26+)';
COMMENT ON COLUMN progression_events.event_type IS 'Event type: CRIME_COMPLETED, LEVEL_UP, etc.';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_prog_events_time ON progression_events(event_time DESC);
CREATE INDEX idx_prog_events_player ON progression_events(player_id, event_time DESC) WHERE player_id IS NOT NULL;
CREATE INDEX idx_prog_events_type ON progression_events(event_type, event_time DESC);
CREATE INDEX idx_prog_events_band ON progression_events(player_band, event_time DESC);
CREATE INDEX idx_prog_events_session ON progression_events(session_id);
CREATE INDEX idx_prog_events_level ON progression_events(player_level);

-- Composite for funnel analysis
CREATE INDEX idx_prog_events_funnel ON progression_events(event_type, player_level, event_time DESC);

-- =============================================================================
-- EVENT TYPE REFERENCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS progression_event_types (
  event_type VARCHAR(50) PRIMARY KEY,
  category VARCHAR(30) NOT NULL,
  description TEXT,
  is_milestone BOOLEAN DEFAULT FALSE
);

INSERT INTO progression_event_types (event_type, category, description, is_milestone) VALUES
  -- Crime events
  ('CRIME_ATTEMPTED', 'crime', 'Player attempted a crime', FALSE),
  ('CRIME_COMPLETED', 'crime', 'Player successfully completed a crime', FALSE),
  ('CRIME_FAILED', 'crime', 'Player failed a crime attempt', FALSE),

  -- Heist events
  ('HEIST_STARTED', 'heist', 'Player started a heist', FALSE),
  ('HEIST_COMPLETED', 'heist', 'Player completed a heist', TRUE),
  ('HEIST_FAILED', 'heist', 'Player failed a heist', FALSE),

  -- Progression milestones
  ('LEVEL_UP', 'progression', 'Player leveled up', TRUE),
  ('QUEST_COMPLETED', 'progression', 'Player completed a quest', TRUE),
  ('MILESTONE_REACHED', 'progression', 'Player reached a milestone level', TRUE),
  ('BAND_TRANSITION', 'progression', 'Player moved to new band (EARLY->MID->LATE)', TRUE),

  -- Economy events
  ('PROPERTY_PURCHASED', 'economy', 'Player purchased property', TRUE),
  ('CREW_HIRED', 'economy', 'Player hired crew member', TRUE),
  ('BANK_DEPOSIT', 'economy', 'Player deposited to bank', FALSE),

  -- Session events
  ('SESSION_START', 'session', 'Player started a session', FALSE),
  ('SESSION_END', 'session', 'Player ended a session', FALSE)
ON CONFLICT (event_type) DO NOTHING;

-- =============================================================================
-- BATCH INSERT FUNCTION
-- =============================================================================

/**
 * Insert multiple progression events from a client batch
 */
CREATE OR REPLACE FUNCTION insert_progression_events(
  p_player_id UUID,
  p_events JSONB
)
RETURNS INT AS $$
DECLARE
  v_event JSONB;
  v_count INT := 0;
BEGIN
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    INSERT INTO progression_events (
      event_time,
      player_id,
      session_id,
      player_level,
      player_band,
      event_type,
      event_data
    ) VALUES (
      to_timestamp((v_event->>'timestamp')::BIGINT / 1000.0),
      p_player_id,
      v_event->>'sessionId',
      COALESCE((v_event->>'level')::INT, 1),
      COALESCE(v_event->>'band', 'EARLY'),
      v_event->>'type',
      v_event - 'timestamp' - 'sessionId' - 'level' - 'band' - 'type'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ANALYTICS VIEWS
-- =============================================================================

/**
 * Progression Funnel View
 * Shows daily counts of players reaching each milestone
 */
CREATE OR REPLACE VIEW progression_funnel AS
SELECT
  DATE(event_time) AS event_date,
  event_type,
  player_level,
  player_band,
  COUNT(*) AS event_count,
  COUNT(DISTINCT player_id) AS unique_players,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM progression_events
WHERE event_type IN (
  'LEVEL_UP', 'QUEST_COMPLETED', 'MILESTONE_REACHED', 'BAND_TRANSITION',
  'PROPERTY_PURCHASED', 'CREW_HIRED', 'HEIST_COMPLETED'
)
GROUP BY DATE(event_time), event_type, player_level, player_band
ORDER BY event_date DESC, player_level;

/**
 * Crime Success by Band View
 * Shows crime success rates segmented by player level band
 */
CREATE OR REPLACE VIEW crime_success_by_band AS
SELECT
  player_band,
  event_data->>'crimeId' AS crime_id,
  COUNT(*) FILTER (WHERE event_type = 'CRIME_COMPLETED') AS successes,
  COUNT(*) FILTER (WHERE event_type = 'CRIME_FAILED') AS failures,
  COUNT(*) AS total_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'CRIME_COMPLETED') / NULLIF(COUNT(*), 0),
    1
  ) AS success_rate,
  AVG((event_data->>'payout')::NUMERIC) FILTER (WHERE event_type = 'CRIME_COMPLETED') AS avg_payout,
  AVG((event_data->>'xpGained')::NUMERIC) FILTER (WHERE event_type = 'CRIME_COMPLETED') AS avg_xp
FROM progression_events
WHERE event_type IN ('CRIME_COMPLETED', 'CRIME_FAILED')
AND event_time >= NOW() - INTERVAL '30 days'
GROUP BY player_band, event_data->>'crimeId'
ORDER BY player_band, total_attempts DESC;

/**
 * Player Stall Analysis View
 * Identifies where players stop progressing
 */
CREATE OR REPLACE VIEW player_stall_analysis AS
WITH player_last_activity AS (
  SELECT
    player_id,
    MAX(event_time) AS last_event_time,
    MAX(player_level) AS max_level,
    MAX(CASE WHEN event_type = 'QUEST_COMPLETED' THEN event_data->>'questId' END) AS last_quest
  FROM progression_events
  WHERE player_id IS NOT NULL
  GROUP BY player_id
),
player_first_activity AS (
  SELECT
    player_id,
    MIN(event_time) AS first_event_time
  FROM progression_events
  WHERE player_id IS NOT NULL
  GROUP BY player_id
)
SELECT
  pla.player_id,
  pla.max_level,
  CASE
    WHEN pla.max_level <= 10 THEN 'EARLY'
    WHEN pla.max_level <= 25 THEN 'MID'
    ELSE 'LATE'
  END AS stall_band,
  pla.last_quest,
  pla.last_event_time,
  pfa.first_event_time,
  EXTRACT(EPOCH FROM (pla.last_event_time - pfa.first_event_time)) / 3600 AS total_hours_played,
  EXTRACT(EPOCH FROM (NOW() - pla.last_event_time)) / 86400 AS days_since_activity,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - pla.last_event_time)) > 604800 THEN 'churned_7d'
    WHEN EXTRACT(EPOCH FROM (NOW() - pla.last_event_time)) > 259200 THEN 'at_risk_3d'
    WHEN EXTRACT(EPOCH FROM (NOW() - pla.last_event_time)) > 86400 THEN 'inactive_1d'
    ELSE 'active'
  END AS player_status
FROM player_last_activity pla
JOIN player_first_activity pfa ON pla.player_id = pfa.player_id
ORDER BY pla.last_event_time DESC;

/**
 * Daily Active Users by Band
 */
CREATE OR REPLACE VIEW daily_active_by_band AS
SELECT
  DATE(event_time) AS activity_date,
  player_band,
  COUNT(DISTINCT player_id) AS unique_players,
  COUNT(DISTINCT session_id) AS unique_sessions,
  COUNT(*) AS total_events
FROM progression_events
WHERE event_time >= NOW() - INTERVAL '30 days'
GROUP BY DATE(event_time), player_band
ORDER BY activity_date DESC, player_band;

/**
 * Quest Completion Funnel
 * Shows conversion between quest stages
 */
CREATE OR REPLACE VIEW quest_completion_funnel AS
SELECT
  event_data->>'questId' AS quest_id,
  COUNT(DISTINCT player_id) AS players_completed,
  MIN(event_time) AS first_completion,
  MAX(event_time) AS last_completion,
  AVG(player_level) AS avg_level_at_completion
FROM progression_events
WHERE event_type = 'QUEST_COMPLETED'
AND event_time >= NOW() - INTERVAL '30 days'
GROUP BY event_data->>'questId'
ORDER BY
  CASE event_data->>'questId'
    WHEN 'FIRST_SCORE' THEN 1
    WHEN 'BANK_YOUR_EARNINGS' THEN 2
    WHEN 'BUILD_YOUR_STAKE' THEN 3
    WHEN 'FIRST_PROPERTY' THEN 4
    WHEN 'CREW_UP' THEN 5
    WHEN 'FIRST_HEIST' THEN 6
    ELSE 99
  END;

/**
 * Session Duration Analysis
 */
CREATE OR REPLACE VIEW session_duration_analysis AS
WITH session_bounds AS (
  SELECT
    session_id,
    player_id,
    player_band,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(*) AS event_count
  FROM progression_events
  GROUP BY session_id, player_id, player_band
)
SELECT
  player_band,
  COUNT(*) AS total_sessions,
  AVG(EXTRACT(EPOCH FROM (session_end - session_start)) / 60) AS avg_duration_minutes,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (session_end - session_start)) / 60) AS median_duration_minutes,
  AVG(event_count) AS avg_events_per_session
FROM session_bounds
WHERE session_start >= NOW() - INTERVAL '30 days'
GROUP BY player_band
ORDER BY player_band;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Get progression stats for a specific player
 */
CREATE OR REPLACE FUNCTION get_player_progression_stats(
  p_player_id UUID
)
RETURNS TABLE (
  total_crimes INT,
  successful_crimes INT,
  crime_success_rate NUMERIC,
  total_heists INT,
  successful_heists INT,
  quests_completed INT,
  total_sessions INT,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  current_level INT,
  current_band VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE event_type IN ('CRIME_COMPLETED', 'CRIME_FAILED'))::INT AS total_crimes,
    COUNT(*) FILTER (WHERE event_type = 'CRIME_COMPLETED')::INT AS successful_crimes,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE event_type = 'CRIME_COMPLETED') /
      NULLIF(COUNT(*) FILTER (WHERE event_type IN ('CRIME_COMPLETED', 'CRIME_FAILED')), 0),
      1
    ) AS crime_success_rate,
    COUNT(*) FILTER (WHERE event_type IN ('HEIST_COMPLETED', 'HEIST_FAILED'))::INT AS total_heists,
    COUNT(*) FILTER (WHERE event_type = 'HEIST_COMPLETED')::INT AS successful_heists,
    COUNT(*) FILTER (WHERE event_type = 'QUEST_COMPLETED')::INT AS quests_completed,
    COUNT(DISTINCT session_id)::INT AS total_sessions,
    MIN(event_time) AS first_seen,
    MAX(event_time) AS last_seen,
    MAX(player_level)::INT AS current_level,
    (ARRAY_AGG(player_band ORDER BY event_time DESC))[1] AS current_band
  FROM progression_events
  WHERE player_id = p_player_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get stall points - levels where players tend to stop
 */
CREATE OR REPLACE FUNCTION get_stall_points(
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  stall_level INT,
  churned_players BIGINT,
  avg_days_before_churn NUMERIC,
  common_last_quest TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH churned AS (
    SELECT
      player_id,
      max_level,
      last_quest,
      days_since_activity
    FROM player_stall_analysis
    WHERE player_status = 'churned_7d'
    AND last_event_time >= NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT
    max_level AS stall_level,
    COUNT(*) AS churned_players,
    ROUND(AVG(days_since_activity)::NUMERIC, 1) AS avg_days_before_churn,
    MODE() WITHIN GROUP (ORDER BY last_quest) AS common_last_quest
  FROM churned
  GROUP BY max_level
  ORDER BY churned_players DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

/**
 * Cleanup old analytics events
 */
CREATE OR REPLACE FUNCTION cleanup_old_progression_events(
  p_days_to_keep INT DEFAULT 90
)
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM progression_events
  WHERE received_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE progression_events ENABLE ROW LEVEL SECURITY;

-- Service role can insert events (from WebSocket handler)
CREATE POLICY "Service role inserts progression events"
ON progression_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- Admins can view all events
CREATE POLICY "Admins can view progression events"
ON progression_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM players
    WHERE id = auth.uid()
    AND (settings->>'is_admin')::boolean = true
  )
);

-- Players can view their own events
CREATE POLICY "Players can view own progression events"
ON progression_events
FOR SELECT
TO authenticated
USING (player_id = auth.uid());

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Allow service role full access for WebSocket handlers
GRANT ALL ON progression_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE progression_events_id_seq TO service_role;

-- Allow authenticated users to read views
GRANT SELECT ON progression_funnel TO authenticated;
GRANT SELECT ON crime_success_by_band TO authenticated;
GRANT SELECT ON daily_active_by_band TO authenticated;
GRANT SELECT ON quest_completion_funnel TO authenticated;
GRANT SELECT ON session_duration_analysis TO authenticated;
