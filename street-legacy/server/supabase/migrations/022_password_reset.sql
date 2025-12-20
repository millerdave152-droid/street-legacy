-- Street Legacy: Password Reset System
-- Migration: 022_password_reset
-- Description: Adds password reset token support for player accounts

-- =============================================================================
-- PASSWORD RESET TOKENS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT
);

COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for account recovery';
COMMENT ON COLUMN password_reset_tokens.token IS 'Secure random token sent via email';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expires after 1 hour for security';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (NULL if unused)';
COMMENT ON COLUMN password_reset_tokens.ip_address IS 'IP address that requested the reset';

-- Index for fast token lookups
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_password_reset_player ON password_reset_tokens(player_id);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at) WHERE used_at IS NULL;
CREATE INDEX idx_password_reset_email ON password_reset_tokens(email);

-- =============================================================================
-- CLEANUP FUNCTION FOR EXPIRED TOKENS
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_password_reset_tokens() IS 'Removes expired unused password reset tokens';

-- =============================================================================
-- PASSWORD RESET VALIDATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_password_reset_token(p_token VARCHAR(64))
RETURNS TABLE(
  is_valid BOOLEAN,
  player_id INT,
  email VARCHAR(255),
  error_message TEXT
) AS $$
DECLARE
  v_token_record password_reset_tokens%ROWTYPE;
BEGIN
  -- Find the token
  SELECT * INTO v_token_record
  FROM password_reset_tokens
  WHERE token = p_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::VARCHAR(255), 'Invalid or expired reset link'::TEXT;
    RETURN;
  END IF;

  -- Token already used
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::VARCHAR(255), 'This reset link has already been used'::TEXT;
    RETURN;
  END IF;

  -- Token expired
  IF v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::VARCHAR(255), 'This reset link has expired. Please request a new one.'::TEXT;
    RETURN;
  END IF;

  -- Token is valid
  RETURN QUERY SELECT TRUE, v_token_record.player_id, v_token_record.email, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_password_reset_token(VARCHAR) IS 'Validates a password reset token without consuming it';

-- =============================================================================
-- PASSWORD RESET EXECUTION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION execute_password_reset(p_token VARCHAR(64), p_new_password_hash VARCHAR(255))
RETURNS TABLE(
  success BOOLEAN,
  player_id INT,
  error_message TEXT
) AS $$
DECLARE
  v_token_record password_reset_tokens%ROWTYPE;
BEGIN
  -- Find and validate the token
  SELECT * INTO v_token_record
  FROM password_reset_tokens
  WHERE token = p_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INT, 'Invalid or expired reset link'::TEXT;
    RETURN;
  END IF;

  -- Token already used
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INT, 'This reset link has already been used'::TEXT;
    RETURN;
  END IF;

  -- Token expired
  IF v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, NULL::INT, 'This reset link has expired. Please request a new one.'::TEXT;
    RETURN;
  END IF;

  -- Mark token as used
  UPDATE password_reset_tokens
  SET used_at = NOW()
  WHERE id = v_token_record.id;

  -- Update player password
  UPDATE players
  SET password_hash = p_new_password_hash
  WHERE id = v_token_record.player_id;

  -- Invalidate all other reset tokens for this player
  UPDATE password_reset_tokens
  SET used_at = NOW()
  WHERE player_id = v_token_record.player_id AND used_at IS NULL;

  -- Return success
  RETURN QUERY SELECT TRUE, v_token_record.player_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION execute_password_reset(VARCHAR, VARCHAR) IS 'Executes password reset and invalidates all tokens for the player';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow server (service role) to manage tokens
CREATE POLICY "Service role manages password reset tokens"
ON password_reset_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Players cannot directly access reset tokens
CREATE POLICY "Players cannot access password reset tokens"
ON password_reset_tokens
FOR SELECT
TO authenticated
USING (false);
