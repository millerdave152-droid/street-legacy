-- Street Legacy: Social Helper Functions Migration
-- Migration: 015_social_functions
-- Description: Helper functions for social features, conversations, and leaderboards

-- =============================================================================
-- GET PLAYER CONVERSATIONS
-- =============================================================================

-- Returns a list of conversation partners with latest message and unread count
CREATE OR REPLACE FUNCTION get_player_conversations(p_player_id UUID)
RETURNS TABLE (
  other_player_id UUID,
  other_player_username VARCHAR,
  other_player_level INTEGER,
  last_message_content TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_from_me BOOLEAN,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH conversation_partners AS (
    -- Get all unique conversation partners
    SELECT DISTINCT
      CASE
        WHEN from_player_id = p_player_id THEN to_player_id
        ELSE from_player_id
      END AS partner_id
    FROM player_messages
    WHERE from_player_id = p_player_id OR to_player_id = p_player_id
  ),
  latest_messages AS (
    -- Get the latest message for each conversation
    SELECT DISTINCT ON (partner_id)
      CASE
        WHEN from_player_id = p_player_id THEN to_player_id
        ELSE from_player_id
      END AS partner_id,
      content,
      created_at,
      from_player_id = p_player_id AS from_me
    FROM player_messages
    WHERE from_player_id = p_player_id OR to_player_id = p_player_id
    ORDER BY partner_id, created_at DESC
  ),
  unread_counts AS (
    -- Count unread messages from each partner
    SELECT
      from_player_id AS partner_id,
      COUNT(*) AS unread
    FROM player_messages
    WHERE to_player_id = p_player_id AND is_read = FALSE
    GROUP BY from_player_id
  )
  SELECT
    p.id,
    p.username,
    p.level,
    lm.content,
    lm.created_at,
    lm.from_me,
    COALESCE(uc.unread, 0)
  FROM conversation_partners cp
  JOIN players p ON p.id = cp.partner_id
  LEFT JOIN latest_messages lm ON lm.partner_id = cp.partner_id
  LEFT JOIN unread_counts uc ON uc.partner_id = cp.partner_id
  WHERE p.is_banned = FALSE
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION get_player_conversations IS 'Get list of message conversations with latest message and unread count';

-- =============================================================================
-- GET PLAYER RANK
-- =============================================================================

-- Returns the player's rank for a given leaderboard column
CREATE OR REPLACE FUNCTION get_player_rank(
  p_player_id UUID,
  p_order_column TEXT DEFAULT 'level'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rank INTEGER;
  v_valid_columns TEXT[] := ARRAY['level', 'total_earnings', 'properties_owned', 'rep_crime', 'rep_business', 'crimes_committed', 'xp'];
BEGIN
  -- Validate column name to prevent SQL injection
  IF NOT (p_order_column = ANY(v_valid_columns)) THEN
    p_order_column := 'level';
  END IF;

  -- Use dynamic SQL to get rank
  EXECUTE format('
    SELECT rank::INTEGER FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY %I DESC, xp DESC) as rank
      FROM players
      WHERE is_banned = FALSE
    ) ranked
    WHERE id = $1
  ', p_order_column)
  INTO v_rank
  USING p_player_id;

  RETURN v_rank;
END;
$$;

COMMENT ON FUNCTION get_player_rank IS 'Get player rank for a specific leaderboard type';

-- =============================================================================
-- GET ONLINE PLAYERS IN DISTRICT
-- =============================================================================

-- Returns players currently in a district (active in last 15 minutes)
CREATE OR REPLACE FUNCTION get_online_players_in_district(
  p_district_id VARCHAR(50),
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  player_id UUID,
  username VARCHAR,
  level INTEGER,
  crew_tag VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.level,
    c.tag
  FROM players p
  LEFT JOIN crew_members cm ON cm.player_id = p.id AND cm.is_active = TRUE
  LEFT JOIN crews c ON c.id = cm.crew_id
  WHERE p.current_district_id = p_district_id
    AND p.is_banned = FALSE
    AND p.updated_at > NOW() - INTERVAL '15 minutes'
  ORDER BY p.level DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_online_players_in_district IS 'Get recently active players in a district';

-- =============================================================================
-- GET MUTUAL FRIENDS
-- =============================================================================

-- Returns players who are mutual friends (both have marked each other as friend)
CREATE OR REPLACE FUNCTION get_mutual_friends(p_player_id UUID)
RETURNS TABLE (
  friend_id UUID,
  friend_username VARCHAR,
  friend_level INTEGER,
  friends_since TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.level,
    pr1.created_at
  FROM player_relationships pr1
  JOIN player_relationships pr2
    ON pr1.target_player_id = pr2.player_id
    AND pr1.player_id = pr2.target_player_id
  JOIN players p ON p.id = pr1.target_player_id
  WHERE pr1.player_id = p_player_id
    AND pr1.relationship_type = 'friend'
    AND pr2.relationship_type = 'friend'
    AND p.is_banned = FALSE
  ORDER BY pr1.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_mutual_friends IS 'Get players with mutual friend relationship';

-- =============================================================================
-- CHECK IF BLOCKED
-- =============================================================================

-- Check if target player has blocked the source player
CREATE OR REPLACE FUNCTION is_blocked_by(
  p_source_player_id UUID,
  p_target_player_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM player_relationships
    WHERE player_id = p_target_player_id
      AND target_player_id = p_source_player_id
      AND relationship_type = 'blocked'
  );
END;
$$;

COMMENT ON FUNCTION is_blocked_by IS 'Check if source player is blocked by target player';

-- =============================================================================
-- GET DISTRICT ACTIVITY FEED
-- =============================================================================

-- Returns recent notable events in a district
CREATE OR REPLACE FUNCTION get_district_activity_feed(
  p_district_id VARCHAR(50),
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  event_id UUID,
  event_type VARCHAR,
  event_subtype VARCHAR,
  player_username VARCHAR,
  player_level INTEGER,
  description TEXT,
  event_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ge.id,
    ge.event_type,
    ge.event_subtype,
    p.username,
    p.level,
    CASE
      WHEN ge.event_subtype = 'ownership_change' THEN
        p.username || ' acquired property in ' || p_district_id
      WHEN ge.event_subtype = 'business_opened' THEN
        p.username || ' opened a new business'
      WHEN ge.event_subtype = 'raided' THEN
        p.username || '''s business was raided'
      WHEN ge.event_subtype = 'level_up' THEN
        p.username || ' reached level ' || (ge.metadata->>'new_level')::TEXT
      ELSE
        ge.event_type || ': ' || ge.event_subtype
    END,
    ge.created_at
  FROM game_events ge
  LEFT JOIN players p ON p.id = ge.player_id
  WHERE ge.district_id = p_district_id
    AND ge.created_at > NOW() - INTERVAL '24 hours'
    AND ge.event_type IN ('property', 'business', 'progression')
  ORDER BY ge.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_district_activity_feed IS 'Get recent notable events in a district';

-- =============================================================================
-- CREW LEADERBOARD
-- =============================================================================

-- Returns crew rankings
CREATE OR REPLACE FUNCTION get_crew_leaderboard(
  p_order_by TEXT DEFAULT 'crew_rep',
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  crew_id UUID,
  crew_name VARCHAR,
  crew_tag VARCHAR,
  crew_level INTEGER,
  member_count INTEGER,
  crew_rep INTEGER,
  vault_balance BIGINT,
  territories_controlled INTEGER,
  rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid_columns TEXT[] := ARRAY['crew_rep', 'level', 'member_count', 'vault_balance', 'territories_controlled'];
BEGIN
  -- Validate column name
  IF NOT (p_order_by = ANY(v_valid_columns)) THEN
    p_order_by := 'crew_rep';
  END IF;

  RETURN QUERY EXECUTE format('
    SELECT
      id,
      name,
      tag,
      level,
      member_count,
      crew_rep,
      vault_balance,
      territories_controlled,
      ROW_NUMBER() OVER (ORDER BY %I DESC)::INTEGER as rank
    FROM crews
    WHERE member_count > 0
    ORDER BY %I DESC
    LIMIT $1
  ', p_order_by, p_order_by)
  USING p_limit;
END;
$$;

COMMENT ON FUNCTION get_crew_leaderboard IS 'Get crew rankings by various metrics';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_player_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_rank(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_online_players_in_district(VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mutual_friends(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_blocked_by(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_district_activity_feed(VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_crew_leaderboard(TEXT, INTEGER) TO authenticated;
