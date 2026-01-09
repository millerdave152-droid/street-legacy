-- Street Legacy: Crew Stats Enhancement
-- Migration: 032_crew_stats
-- Description: Add crew performance tracking columns for profiles and leaderboards

-- =============================================================================
-- CREW STATS COLUMNS
-- =============================================================================

-- Best heist tracking
ALTER TABLE crews ADD COLUMN IF NOT EXISTS best_heist_payout BIGINT DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS best_heist_date TIMESTAMPTZ;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS best_heist_name VARCHAR(100);

-- Weekly earnings tracking (resets weekly)
ALTER TABLE crews ADD COLUMN IF NOT EXISTS weekly_earnings BIGINT DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS weekly_earnings_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Total stats (lifetime)
ALTER TABLE crews ADD COLUMN IF NOT EXISTS total_heists_completed INT DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS total_crimes_committed INT DEFAULT 0;

COMMENT ON COLUMN crews.best_heist_payout IS 'Highest single heist payout by any crew member';
COMMENT ON COLUMN crews.best_heist_date IS 'When the best heist occurred';
COMMENT ON COLUMN crews.weekly_earnings IS 'Total earnings this week (resets weekly)';
COMMENT ON COLUMN crews.weekly_earnings_reset_at IS 'When weekly earnings were last reset';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Update crew best heist if new heist beats record
 */
CREATE OR REPLACE FUNCTION update_crew_best_heist(
  p_crew_id UUID,
  p_heist_payout BIGINT,
  p_heist_name VARCHAR(100) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_best BIGINT;
BEGIN
  SELECT best_heist_payout INTO v_current_best
  FROM crews WHERE id = p_crew_id;

  IF p_heist_payout > COALESCE(v_current_best, 0) THEN
    UPDATE crews SET
      best_heist_payout = p_heist_payout,
      best_heist_date = NOW(),
      best_heist_name = p_heist_name,
      total_heists_completed = total_heists_completed + 1
    WHERE id = p_crew_id;
    RETURN TRUE;
  ELSE
    UPDATE crews SET
      total_heists_completed = total_heists_completed + 1
    WHERE id = p_crew_id;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

/**
 * Add to crew weekly earnings
 */
CREATE OR REPLACE FUNCTION add_crew_weekly_earnings(
  p_crew_id UUID,
  p_amount BIGINT
)
RETURNS void AS $$
BEGIN
  UPDATE crews SET
    weekly_earnings = weekly_earnings + p_amount,
    total_earnings = total_earnings + p_amount
  WHERE id = p_crew_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Reset weekly earnings for all crews (run by scheduler)
 */
CREATE OR REPLACE FUNCTION reset_all_crew_weekly_earnings()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE crews SET
    weekly_earnings = 0,
    weekly_earnings_reset_at = NOW()
  WHERE weekly_earnings > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Get crew profile with computed stats
 */
CREATE OR REPLACE FUNCTION get_crew_profile(p_crew_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  tag VARCHAR(5),
  description TEXT,
  emblem_data JSONB,
  level INT,
  xp BIGINT,
  crew_rep INT,
  member_count INT,
  max_members INT,
  vault_balance BIGINT,
  total_net_worth BIGINT,
  best_heist_payout BIGINT,
  best_heist_date TIMESTAMPTZ,
  best_heist_name VARCHAR(100),
  weekly_earnings BIGINT,
  total_earnings BIGINT,
  total_heists_completed INT,
  territories_controlled INT,
  leader_username VARCHAR(30),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.tag,
    c.description,
    c.emblem_data,
    c.level,
    c.xp,
    c.crew_rep,
    c.member_count,
    c.max_members,
    c.vault_balance,
    -- Calculate total net worth from all members
    COALESCE((
      SELECT SUM(p.cash_balance + p.bank_balance)
      FROM crew_members cm
      JOIN players p ON cm.player_id = p.id
      WHERE cm.crew_id = c.id AND cm.is_active = true
    ), 0)::BIGINT AS total_net_worth,
    c.best_heist_payout,
    c.best_heist_date,
    c.best_heist_name,
    c.weekly_earnings,
    c.total_earnings,
    c.total_heists_completed,
    c.territories_controlled,
    leader.username AS leader_username,
    c.created_at
  FROM crews c
  LEFT JOIN players leader ON c.leader_id = leader.id
  WHERE c.id = p_crew_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get crew members with stats for profile display
 */
CREATE OR REPLACE FUNCTION get_crew_members_for_profile(p_crew_id UUID)
RETURNS TABLE (
  player_id UUID,
  username VARCHAR(30),
  display_name VARCHAR(50),
  role VARCHAR(20),
  level INT,
  net_worth BIGINT,
  contribution_total BIGINT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.player_id,
    p.username,
    p.display_name,
    cm.role::VARCHAR(20),
    p.level,
    (p.cash_balance + p.bank_balance) AS net_worth,
    cm.contribution_total,
    cm.joined_at
  FROM crew_members cm
  JOIN players p ON cm.player_id = p.id
  WHERE cm.crew_id = p_crew_id AND cm.is_active = true
  ORDER BY
    CASE cm.role
      WHEN 'leader' THEN 1
      WHEN 'co_leader' THEN 2
      WHEN 'officer' THEN 3
      WHEN 'member' THEN 4
    END,
    cm.joined_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_crews_weekly_earnings ON crews(weekly_earnings DESC) WHERE weekly_earnings > 0;
CREATE INDEX IF NOT EXISTS idx_crews_best_heist ON crews(best_heist_payout DESC) WHERE best_heist_payout > 0;
