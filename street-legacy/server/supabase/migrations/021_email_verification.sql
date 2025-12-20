-- Street Legacy: Email Verification System
-- Migration: 021_email_verification
-- Description: Adds email verification support for player accounts

-- =============================================================================
-- EMAIL VERIFICATION TOKENS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens for account activation';
COMMENT ON COLUMN email_verification_tokens.token IS 'Secure random token sent via email';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Token expires after 24 hours';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'Timestamp when token was used (NULL if unused)';

-- Index for fast token lookups
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_email_verification_player ON email_verification_tokens(player_id);
CREATE INDEX idx_email_verification_expires ON email_verification_tokens(expires_at) WHERE used_at IS NULL;

-- =============================================================================
-- ADD EMAIL VERIFICATION COLUMNS TO PLAYERS TABLE
-- =============================================================================

-- Add email_verified column to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE players
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN players.email_verified IS 'Whether player has verified their email address';
COMMENT ON COLUMN players.email_verified_at IS 'Timestamp when email was verified';

-- =============================================================================
-- CLEANUP FUNCTION FOR EXPIRED TOKENS
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < NOW() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_verification_tokens() IS 'Removes expired unused verification tokens';

-- =============================================================================
-- VERIFICATION HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION verify_email_token(p_token VARCHAR(64))
RETURNS TABLE(
  success BOOLEAN,
  player_id INT,
  email VARCHAR(255),
  error_message TEXT
) AS $$
DECLARE
  v_token_record email_verification_tokens%ROWTYPE;
BEGIN
  -- Find the token
  SELECT * INTO v_token_record
  FROM email_verification_tokens
  WHERE token = p_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::VARCHAR(255), 'Invalid verification token'::TEXT;
    RETURN;
  END IF;

  -- Token already used
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::VARCHAR(255), 'Token has already been used'::TEXT;
    RETURN;
  END IF;

  -- Token expired
  IF v_token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, NULL::INT, NULL::VARCHAR(255), 'Token has expired'::TEXT;
    RETURN;
  END IF;

  -- Mark token as used
  UPDATE email_verification_tokens
  SET used_at = NOW()
  WHERE id = v_token_record.id;

  -- Update player email verification status
  UPDATE players
  SET email_verified = TRUE, email_verified_at = NOW()
  WHERE id = v_token_record.player_id;

  -- Return success
  RETURN QUERY SELECT TRUE, v_token_record.player_id, v_token_record.email, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_email_token(VARCHAR) IS 'Verifies an email token and activates the player account';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow server (service role) to manage tokens
CREATE POLICY "Service role manages verification tokens"
ON email_verification_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Players cannot directly access verification tokens
CREATE POLICY "Players cannot access verification tokens"
ON email_verification_tokens
FOR SELECT
TO authenticated
USING (false);
