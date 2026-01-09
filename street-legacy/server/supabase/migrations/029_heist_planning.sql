-- ============================================================================
-- Migration 029: Heist Planning Sessions
-- Stores server-side heist planning state for solo heists
-- ============================================================================

-- Heist planning sessions table
CREATE TABLE IF NOT EXISTS heist_planning_sessions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  heist_id VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  activities JSONB DEFAULT '{}',
  total_bonuses JSONB DEFAULT '{"successBonus": 0, "heatReduction": 0, "escapeBonus": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_player_heist UNIQUE(player_id, heist_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_heist_planning_player ON heist_planning_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_heist_planning_expires ON heist_planning_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_heist_planning_heist ON heist_planning_sessions(heist_id);

-- Mini-game statistics for validation
CREATE TABLE IF NOT EXISTS minigame_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crime_id VARCHAR(50) NOT NULL,
  game_type VARCHAR(30),
  plays INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  high_score INTEGER DEFAULT 0,
  avg_time_ms INTEGER,
  min_time_ms INTEGER,
  last_played TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_player_crime_minigame UNIQUE(player_id, crime_id)
);

CREATE INDEX IF NOT EXISTS idx_minigame_stats_player ON minigame_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_minigame_stats_crime ON minigame_stats(crime_id);

-- Offline action queue for sync reconciliation (audit trail)
CREATE TABLE IF NOT EXISTS offline_action_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action_type VARCHAR(20) NOT NULL,  -- 'crime', 'heist', 'property'
  action_data JSONB NOT NULL,
  local_result JSONB,
  server_result JSONB,
  offline_timestamp TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  result_differed BOOLEAN DEFAULT FALSE,
  reconciliation_applied JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_log_player ON offline_action_log(player_id);
CREATE INDEX IF NOT EXISTS idx_offline_log_type ON offline_action_log(action_type);
CREATE INDEX IF NOT EXISTS idx_offline_log_synced ON offline_action_log(synced_at);

-- Function to clean up expired heist planning sessions
CREATE OR REPLACE FUNCTION cleanup_expired_heist_planning()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM heist_planning_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update heist planning activity
CREATE OR REPLACE FUNCTION update_heist_planning_activity(
  p_player_id INTEGER,
  p_heist_id VARCHAR(50),
  p_activity_id VARCHAR(30),
  p_new_level INTEGER,
  p_bonus_success INTEGER,
  p_bonus_heat INTEGER,
  p_bonus_escape INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_session heist_planning_sessions%ROWTYPE;
  v_activities JSONB;
  v_bonuses JSONB;
BEGIN
  -- Get or create session
  SELECT * INTO v_session
  FROM heist_planning_sessions
  WHERE player_id = p_player_id AND heist_id = p_heist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No planning session found for heist %', p_heist_id;
  END IF;

  -- Check if expired
  IF v_session.expires_at < NOW() THEN
    DELETE FROM heist_planning_sessions WHERE id = v_session.id;
    RAISE EXCEPTION 'Planning session has expired';
  END IF;

  -- Update activities
  v_activities := COALESCE(v_session.activities, '{}'::JSONB);
  v_activities := jsonb_set(v_activities, ARRAY[p_activity_id], to_jsonb(p_new_level));

  -- Update bonuses
  v_bonuses := jsonb_build_object(
    'successBonus', p_bonus_success,
    'heatReduction', p_bonus_heat,
    'escapeBonus', p_bonus_escape
  );

  -- Save updates
  UPDATE heist_planning_sessions
  SET
    activities = v_activities,
    total_bonuses = v_bonuses,
    updated_at = NOW()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'activities', v_activities,
    'bonuses', v_bonuses,
    'expiresAt', v_session.expires_at
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_heist_planning_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_heist_planning_updated ON heist_planning_sessions;
CREATE TRIGGER trg_heist_planning_updated
  BEFORE UPDATE ON heist_planning_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_heist_planning_timestamp();

DROP TRIGGER IF EXISTS trg_minigame_stats_updated ON minigame_stats;
CREATE TRIGGER trg_minigame_stats_updated
  BEFORE UPDATE ON minigame_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_heist_planning_timestamp();

-- Comments for documentation
COMMENT ON TABLE heist_planning_sessions IS 'Server-side storage for solo heist planning state';
COMMENT ON TABLE minigame_stats IS 'Player mini-game statistics for validation and anti-cheat';
COMMENT ON TABLE offline_action_log IS 'Audit log for offline actions synced to server';
COMMENT ON COLUMN heist_planning_sessions.activities IS 'JSON object mapping activity_id to completion level';
COMMENT ON COLUMN heist_planning_sessions.total_bonuses IS 'Calculated bonuses from all activities';
COMMENT ON COLUMN minigame_stats.avg_time_ms IS 'Average completion time for plausibility validation';
