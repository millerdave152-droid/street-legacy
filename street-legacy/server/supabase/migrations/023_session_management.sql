-- Street Legacy: Session Management System
-- Migration: 023_session_management
-- Description: Adds session tracking for secure logout and session invalidation

-- =============================================================================
-- ACTIVE SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL, -- SHA256 hash of JWT token (first 32 chars)
  device_info TEXT, -- User agent / device description
  ip_address VARCHAR(45), -- IPv4 or IPv6
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ, -- NULL if session is active
  revoked_reason VARCHAR(50) -- 'logout', 'logout_all', 'admin', 'password_change', 'security'
);

COMMENT ON TABLE player_sessions IS 'Tracks active player sessions for security and logout functionality';
COMMENT ON COLUMN player_sessions.token_hash IS 'SHA256 hash of JWT for validation without storing token';
COMMENT ON COLUMN player_sessions.revoked_at IS 'When session was invalidated (NULL = active)';
COMMENT ON COLUMN player_sessions.revoked_reason IS 'Why session was revoked';

-- Indexes for fast lookups
CREATE INDEX idx_sessions_player ON player_sessions(player_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_token_hash ON player_sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON player_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_last_active ON player_sessions(last_active_at);

-- =============================================================================
-- SESSION INVALIDATION VERSION (Alternative lightweight approach)
-- =============================================================================

-- Add invalidation timestamp to players table
-- Any token issued before this timestamp is invalid
ALTER TABLE players
ADD COLUMN IF NOT EXISTS sessions_invalidated_at TIMESTAMPTZ;

COMMENT ON COLUMN players.sessions_invalidated_at IS 'All sessions issued before this time are invalid';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Create a new session for a player
 */
CREATE OR REPLACE FUNCTION create_player_session(
  p_player_id INT,
  p_token_hash VARCHAR(64),
  p_device_info TEXT,
  p_ip_address VARCHAR(45),
  p_expires_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO player_sessions (player_id, token_hash, device_info, ip_address, expires_at)
  VALUES (p_player_id, p_token_hash, p_device_info, p_ip_address, p_expires_at)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Validate a session by token hash
 * Returns player_id if valid, NULL if invalid
 */
CREATE OR REPLACE FUNCTION validate_session(p_token_hash VARCHAR(64))
RETURNS TABLE(
  is_valid BOOLEAN,
  player_id INT,
  session_id UUID
) AS $$
DECLARE
  v_session player_sessions%ROWTYPE;
  v_player players%ROWTYPE;
BEGIN
  -- Find the session
  SELECT * INTO v_session
  FROM player_sessions
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if player has invalidated all sessions
  SELECT * INTO v_player FROM players WHERE id = v_session.player_id;

  IF v_player.sessions_invalidated_at IS NOT NULL
     AND v_session.created_at < v_player.sessions_invalidated_at THEN
    -- Session was created before invalidation - mark as revoked
    UPDATE player_sessions
    SET revoked_at = NOW(), revoked_reason = 'logout_all'
    WHERE id = v_session.id;

    RETURN QUERY SELECT FALSE, NULL::INT, NULL::UUID;
    RETURN;
  END IF;

  -- Update last active timestamp
  UPDATE player_sessions
  SET last_active_at = NOW()
  WHERE id = v_session.id;

  RETURN QUERY SELECT TRUE, v_session.player_id, v_session.id;
END;
$$ LANGUAGE plpgsql;

/**
 * Revoke a specific session
 */
CREATE OR REPLACE FUNCTION revoke_session(
  p_session_id UUID,
  p_reason VARCHAR(50) DEFAULT 'logout'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE player_sessions
  SET revoked_at = NOW(), revoked_reason = p_reason
  WHERE id = p_session_id AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

/**
 * Revoke all sessions for a player
 */
CREATE OR REPLACE FUNCTION revoke_all_player_sessions(
  p_player_id INT,
  p_reason VARCHAR(50) DEFAULT 'logout_all',
  p_except_session_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  -- Update the player's invalidation timestamp
  UPDATE players
  SET sessions_invalidated_at = NOW()
  WHERE id = p_player_id;

  -- Revoke all active sessions except optionally the current one
  UPDATE player_sessions
  SET revoked_at = NOW(), revoked_reason = p_reason
  WHERE player_id = p_player_id
    AND revoked_at IS NULL
    AND (p_except_session_id IS NULL OR id != p_except_session_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Get active sessions for a player
 */
CREATE OR REPLACE FUNCTION get_player_sessions(p_player_id INT)
RETURNS TABLE(
  session_id UUID,
  device_info TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  is_current BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.device_info,
    ps.ip_address,
    ps.created_at,
    ps.last_active_at,
    FALSE -- Caller should mark current session
  FROM player_sessions ps
  WHERE ps.player_id = p_player_id
    AND ps.revoked_at IS NULL
    AND ps.expires_at > NOW()
  ORDER BY ps.last_active_at DESC;
END;
$$ LANGUAGE plpgsql;

/**
 * Cleanup expired sessions (run periodically)
 */
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  -- Delete sessions expired more than 30 days ago
  DELETE FROM player_sessions
  WHERE expires_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ADMIN FUNCTIONS
-- =============================================================================

/**
 * Admin: Revoke all sessions for a player (security action)
 */
CREATE OR REPLACE FUNCTION admin_revoke_player_sessions(
  p_admin_id INT,
  p_target_player_id INT,
  p_reason VARCHAR(50) DEFAULT 'admin'
)
RETURNS INT AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_count INT;
BEGIN
  -- Verify admin status
  SELECT is_master INTO v_is_admin FROM players WHERE id = p_admin_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Revoke all sessions
  SELECT revoke_all_player_sessions(p_target_player_id, p_reason) INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;

-- Players can only see their own sessions
CREATE POLICY "Players can view own sessions"
ON player_sessions
FOR SELECT
TO authenticated
USING (player_id = current_setting('app.current_player_id')::INT);

-- Only server can manage sessions
CREATE POLICY "Service role manages sessions"
ON player_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
