-- Street Legacy: Weekly Player Stats
-- Migration: 033_weekly_stats
-- Description: Track weekly player performance for competitive leaderboards

-- =============================================================================
-- WEEKLY STATS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS weekly_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,

  -- Performance metrics
  cash_earned BIGINT DEFAULT 0,
  cash_spent BIGINT DEFAULT 0,
  heat_accumulated INT DEFAULT 0,
  biggest_heist_payout BIGINT DEFAULT 0,
  biggest_heist_name VARCHAR(100),
  property_value_gained BIGINT DEFAULT 0,

  -- Activity metrics
  crimes_attempted INT DEFAULT 0,
  crimes_succeeded INT DEFAULT 0,
  heists_attempted INT DEFAULT 0,
  heists_succeeded INT DEFAULT 0,
  properties_purchased INT DEFAULT 0,
  crew_members_hired INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_id, week_start)
);

COMMENT ON TABLE weekly_player_stats IS 'Weekly aggregated player stats for leaderboards';
COMMENT ON COLUMN weekly_player_stats.week_start IS 'Monday of the week (DATE_TRUNC week)';
COMMENT ON COLUMN weekly_player_stats.cash_earned IS 'Total cash earned from all sources';
COMMENT ON COLUMN weekly_player_stats.heat_accumulated IS 'Total heat gained (before decay)';
COMMENT ON COLUMN weekly_player_stats.biggest_heist_payout IS 'Largest single heist payout';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_weekly_stats_week ON weekly_player_stats(week_start DESC);
CREATE INDEX idx_weekly_stats_player ON weekly_player_stats(player_id, week_start DESC);
CREATE INDEX idx_weekly_stats_cash ON weekly_player_stats(week_start, cash_earned DESC);
CREATE INDEX idx_weekly_stats_heat ON weekly_player_stats(week_start, heat_accumulated DESC);
CREATE INDEX idx_weekly_stats_heist ON weekly_player_stats(week_start, biggest_heist_payout DESC);
CREATE INDEX idx_weekly_stats_property ON weekly_player_stats(week_start, property_value_gained DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Get or create weekly stats record for a player
 */
CREATE OR REPLACE FUNCTION get_or_create_weekly_stats(p_player_id UUID)
RETURNS UUID AS $$
DECLARE
  v_week_start DATE;
  v_stats_id UUID;
BEGIN
  -- Get Monday of current week
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  -- Try to get existing record
  SELECT id INTO v_stats_id
  FROM weekly_player_stats
  WHERE player_id = p_player_id AND week_start = v_week_start;

  -- Create if not exists
  IF v_stats_id IS NULL THEN
    INSERT INTO weekly_player_stats (player_id, week_start)
    VALUES (p_player_id, v_week_start)
    RETURNING id INTO v_stats_id;
  END IF;

  RETURN v_stats_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Record cash earned for weekly stats
 */
CREATE OR REPLACE FUNCTION record_weekly_cash_earned(
  p_player_id UUID,
  p_amount BIGINT
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  INSERT INTO weekly_player_stats (player_id, week_start, cash_earned)
  VALUES (p_player_id, v_week_start, p_amount)
  ON CONFLICT (player_id, week_start)
  DO UPDATE SET
    cash_earned = weekly_player_stats.cash_earned + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

/**
 * Record heat accumulated for weekly stats
 */
CREATE OR REPLACE FUNCTION record_weekly_heat(
  p_player_id UUID,
  p_heat INT
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  INSERT INTO weekly_player_stats (player_id, week_start, heat_accumulated)
  VALUES (p_player_id, v_week_start, p_heat)
  ON CONFLICT (player_id, week_start)
  DO UPDATE SET
    heat_accumulated = weekly_player_stats.heat_accumulated + p_heat,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

/**
 * Record heist for weekly stats (updates if bigger)
 */
CREATE OR REPLACE FUNCTION record_weekly_heist(
  p_player_id UUID,
  p_payout BIGINT,
  p_heist_name VARCHAR(100) DEFAULT NULL,
  p_success BOOLEAN DEFAULT true
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  INSERT INTO weekly_player_stats (
    player_id, week_start,
    biggest_heist_payout, biggest_heist_name,
    heists_attempted, heists_succeeded
  )
  VALUES (
    p_player_id, v_week_start,
    CASE WHEN p_success THEN p_payout ELSE 0 END,
    CASE WHEN p_success THEN p_heist_name ELSE NULL END,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END
  )
  ON CONFLICT (player_id, week_start)
  DO UPDATE SET
    biggest_heist_payout = GREATEST(weekly_player_stats.biggest_heist_payout, CASE WHEN p_success THEN p_payout ELSE 0 END),
    biggest_heist_name = CASE
      WHEN p_success AND p_payout > weekly_player_stats.biggest_heist_payout THEN p_heist_name
      ELSE weekly_player_stats.biggest_heist_name
    END,
    heists_attempted = weekly_player_stats.heists_attempted + 1,
    heists_succeeded = weekly_player_stats.heists_succeeded + CASE WHEN p_success THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

/**
 * Record property purchase for weekly stats
 */
CREATE OR REPLACE FUNCTION record_weekly_property(
  p_player_id UUID,
  p_value BIGINT
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  INSERT INTO weekly_player_stats (player_id, week_start, property_value_gained, properties_purchased)
  VALUES (p_player_id, v_week_start, p_value, 1)
  ON CONFLICT (player_id, week_start)
  DO UPDATE SET
    property_value_gained = weekly_player_stats.property_value_gained + p_value,
    properties_purchased = weekly_player_stats.properties_purchased + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

/**
 * Record crime for weekly stats
 */
CREATE OR REPLACE FUNCTION record_weekly_crime(
  p_player_id UUID,
  p_success BOOLEAN
)
RETURNS void AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  INSERT INTO weekly_player_stats (player_id, week_start, crimes_attempted, crimes_succeeded)
  VALUES (p_player_id, v_week_start, 1, CASE WHEN p_success THEN 1 ELSE 0 END)
  ON CONFLICT (player_id, week_start)
  DO UPDATE SET
    crimes_attempted = weekly_player_stats.crimes_attempted + 1,
    crimes_succeeded = weekly_player_stats.crimes_succeeded + CASE WHEN p_success THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- LEADERBOARD FUNCTIONS
-- =============================================================================

/**
 * Get weekly leaderboard by category
 */
CREATE OR REPLACE FUNCTION get_weekly_leaderboard(
  p_category VARCHAR(50),
  p_limit INT DEFAULT 50,
  p_week_offset INT DEFAULT 0  -- 0 = current week, 1 = last week, etc.
)
RETURNS TABLE (
  rank BIGINT,
  player_id UUID,
  username VARCHAR(30),
  display_name VARCHAR(50),
  level INT,
  value BIGINT,
  extra_info TEXT
) AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := (DATE_TRUNC('week', CURRENT_DATE) - (p_week_offset * INTERVAL '1 week'))::DATE;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY
      CASE p_category
        WHEN 'cash' THEN ws.cash_earned
        WHEN 'heat' THEN ws.heat_accumulated::BIGINT
        WHEN 'heist' THEN ws.biggest_heist_payout
        WHEN 'property' THEN ws.property_value_gained
        ELSE ws.cash_earned
      END DESC
    ) AS rank,
    p.id AS player_id,
    p.username,
    p.display_name,
    p.level,
    CASE p_category
      WHEN 'cash' THEN ws.cash_earned
      WHEN 'heat' THEN ws.heat_accumulated::BIGINT
      WHEN 'heist' THEN ws.biggest_heist_payout
      WHEN 'property' THEN ws.property_value_gained
      ELSE ws.cash_earned
    END AS value,
    CASE p_category
      WHEN 'heist' THEN ws.biggest_heist_name
      ELSE NULL
    END AS extra_info
  FROM weekly_player_stats ws
  JOIN players p ON ws.player_id = p.id
  WHERE ws.week_start = v_week_start
  AND CASE p_category
    WHEN 'cash' THEN ws.cash_earned > 0
    WHEN 'heat' THEN ws.heat_accumulated > 0
    WHEN 'heist' THEN ws.biggest_heist_payout > 0
    WHEN 'property' THEN ws.property_value_gained > 0
    ELSE ws.cash_earned > 0
  END
  ORDER BY
    CASE p_category
      WHEN 'cash' THEN ws.cash_earned
      WHEN 'heat' THEN ws.heat_accumulated::BIGINT
      WHEN 'heist' THEN ws.biggest_heist_payout
      WHEN 'property' THEN ws.property_value_gained
      ELSE ws.cash_earned
    END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Get player's weekly rank for a category
 */
CREATE OR REPLACE FUNCTION get_player_weekly_rank(
  p_player_id UUID,
  p_category VARCHAR(50)
)
RETURNS TABLE (
  rank BIGINT,
  value BIGINT,
  total_players BIGINT
) AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      ws.player_id,
      CASE p_category
        WHEN 'cash' THEN ws.cash_earned
        WHEN 'heat' THEN ws.heat_accumulated::BIGINT
        WHEN 'heist' THEN ws.biggest_heist_payout
        WHEN 'property' THEN ws.property_value_gained
        ELSE ws.cash_earned
      END AS value,
      ROW_NUMBER() OVER (ORDER BY
        CASE p_category
          WHEN 'cash' THEN ws.cash_earned
          WHEN 'heat' THEN ws.heat_accumulated::BIGINT
          WHEN 'heist' THEN ws.biggest_heist_payout
          WHEN 'property' THEN ws.property_value_gained
          ELSE ws.cash_earned
        END DESC
      ) AS rank
    FROM weekly_player_stats ws
    WHERE ws.week_start = v_week_start
  )
  SELECT
    r.rank,
    r.value,
    (SELECT COUNT(*) FROM ranked) AS total_players
  FROM ranked r
  WHERE r.player_id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CLEANUP
-- =============================================================================

/**
 * Archive old weekly stats (keep 12 weeks)
 */
CREATE OR REPLACE FUNCTION cleanup_old_weekly_stats(
  p_weeks_to_keep INT DEFAULT 12
)
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM weekly_player_stats
  WHERE week_start < DATE_TRUNC('week', CURRENT_DATE) - (p_weeks_to_keep * INTERVAL '1 week');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
