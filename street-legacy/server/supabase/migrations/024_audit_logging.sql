-- Street Legacy: Audit Logging System
-- Migration: 024_audit_logging
-- Description: Comprehensive audit logging for security-sensitive actions

-- =============================================================================
-- AUDIT LOGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,

  -- When the action occurred
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Who performed the action (NULL for system actions or unauthenticated)
  player_id INT REFERENCES players(id) ON DELETE SET NULL,

  -- What category of action
  category VARCHAR(50) NOT NULL,
  -- auth, admin, economy, security, player, system

  -- Specific action type
  action VARCHAR(100) NOT NULL,
  -- Examples: login, logout, password_change, cash_transfer, ban_player, etc.

  -- Severity level
  severity VARCHAR(20) DEFAULT 'info' NOT NULL,
  -- debug, info, warning, error, critical

  -- Target of the action (if applicable)
  target_type VARCHAR(50), -- 'player', 'item', 'property', 'business', etc.
  target_id INT,           -- ID of the target entity

  -- Request context
  ip_address VARCHAR(45),   -- IPv4 or IPv6
  user_agent TEXT,          -- Browser/client info

  -- Action details (JSON for flexibility)
  details JSONB DEFAULT '{}',

  -- Result of the action
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

COMMENT ON TABLE audit_logs IS 'Security audit trail for all sensitive actions';
COMMENT ON COLUMN audit_logs.category IS 'Action category: auth, admin, economy, security, player, system';
COMMENT ON COLUMN audit_logs.severity IS 'Log level: debug, info, warning, error, critical';
COMMENT ON COLUMN audit_logs.details IS 'Additional context as JSON';

-- =============================================================================
-- INDEXES FOR EFFICIENT QUERYING
-- =============================================================================

-- Primary query patterns
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_player ON audit_logs(player_id, created_at DESC) WHERE player_id IS NOT NULL;
CREATE INDEX idx_audit_category ON audit_logs(category, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_severity ON audit_logs(severity, created_at DESC) WHERE severity IN ('warning', 'error', 'critical');
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id, created_at DESC) WHERE target_type IS NOT NULL;
CREATE INDEX idx_audit_ip ON audit_logs(ip_address, created_at DESC) WHERE ip_address IS NOT NULL;
CREATE INDEX idx_audit_failed ON audit_logs(created_at DESC) WHERE success = false;

-- Composite for security monitoring
CREATE INDEX idx_audit_security_monitoring ON audit_logs(category, action, ip_address, created_at DESC);

-- =============================================================================
-- AUDIT LOG CATEGORIES AND ACTIONS
-- =============================================================================

-- Create a reference table for valid categories and actions
CREATE TABLE IF NOT EXISTS audit_action_types (
  category VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  default_severity VARCHAR(20) DEFAULT 'info',
  PRIMARY KEY (category, action)
);

-- Populate with known action types
INSERT INTO audit_action_types (category, action, description, default_severity) VALUES
  -- Authentication
  ('auth', 'login_success', 'Successful login', 'info'),
  ('auth', 'login_failed', 'Failed login attempt', 'warning'),
  ('auth', 'logout', 'User logged out', 'info'),
  ('auth', 'logout_all', 'User logged out from all devices', 'info'),
  ('auth', 'register', 'New user registration', 'info'),
  ('auth', 'email_verified', 'Email verification completed', 'info'),
  ('auth', 'password_changed', 'Password changed', 'info'),
  ('auth', 'password_reset_requested', 'Password reset requested', 'info'),
  ('auth', 'password_reset_completed', 'Password reset completed', 'info'),
  ('auth', 'session_revoked', 'Session manually revoked', 'info'),
  ('auth', 'session_invalidated', 'Session invalidated by system', 'warning'),

  -- Admin actions
  ('admin', 'ban_player', 'Player banned', 'warning'),
  ('admin', 'unban_player', 'Player unbanned', 'info'),
  ('admin', 'mute_player', 'Player muted', 'info'),
  ('admin', 'unmute_player', 'Player unmuted', 'info'),
  ('admin', 'grant_admin', 'Admin privileges granted', 'critical'),
  ('admin', 'revoke_admin', 'Admin privileges revoked', 'critical'),
  ('admin', 'modify_cash', 'Player cash modified', 'warning'),
  ('admin', 'modify_stats', 'Player stats modified', 'warning'),
  ('admin', 'force_logout', 'Forced player logout', 'warning'),
  ('admin', 'delete_player', 'Player account deleted', 'critical'),
  ('admin', 'view_player', 'Admin viewed player details', 'debug'),
  ('admin', 'system_announcement', 'System announcement sent', 'info'),

  -- Economy
  ('economy', 'cash_transfer', 'Cash transferred between players', 'info'),
  ('economy', 'bank_deposit', 'Cash deposited to bank', 'info'),
  ('economy', 'bank_withdraw', 'Cash withdrawn from bank', 'info'),
  ('economy', 'item_purchase', 'Item purchased', 'info'),
  ('economy', 'item_sold', 'Item sold', 'info'),
  ('economy', 'property_purchase', 'Property purchased', 'info'),
  ('economy', 'property_sold', 'Property sold', 'info'),
  ('economy', 'business_purchase', 'Business purchased', 'info'),
  ('economy', 'large_transaction', 'Large transaction detected', 'warning'),

  -- Security events
  ('security', 'rate_limit_hit', 'Rate limit exceeded', 'warning'),
  ('security', 'suspicious_activity', 'Suspicious activity detected', 'warning'),
  ('security', 'multiple_failed_logins', 'Multiple failed login attempts', 'warning'),
  ('security', 'ip_blocked', 'IP address blocked', 'warning'),
  ('security', 'token_reuse', 'Attempted token reuse detected', 'warning'),
  ('security', 'invalid_token', 'Invalid token presented', 'warning'),

  -- Player actions
  ('player', 'crime_committed', 'Crime action performed', 'debug'),
  ('player', 'job_completed', 'Job completed', 'debug'),
  ('player', 'level_up', 'Player leveled up', 'info'),
  ('player', 'crew_created', 'Crew created', 'info'),
  ('player', 'crew_joined', 'Joined a crew', 'info'),
  ('player', 'crew_left', 'Left a crew', 'info'),

  -- System events
  ('system', 'server_start', 'Server started', 'info'),
  ('system', 'server_shutdown', 'Server shutting down', 'info'),
  ('system', 'maintenance_mode', 'Maintenance mode toggled', 'warning'),
  ('system', 'database_backup', 'Database backup completed', 'info'),
  ('system', 'cleanup_expired', 'Expired data cleanup', 'debug')
ON CONFLICT (category, action) DO NOTHING;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Log an audit event
 */
CREATE OR REPLACE FUNCTION log_audit_event(
  p_player_id INT,
  p_category VARCHAR(50),
  p_action VARCHAR(100),
  p_severity VARCHAR(20) DEFAULT NULL,
  p_target_type VARCHAR(50) DEFAULT NULL,
  p_target_id INT DEFAULT NULL,
  p_ip_address VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_severity VARCHAR(20);
  v_log_id BIGINT;
BEGIN
  -- Get default severity if not provided
  IF p_severity IS NULL THEN
    SELECT default_severity INTO v_severity
    FROM audit_action_types
    WHERE category = p_category AND action = p_action;

    IF v_severity IS NULL THEN
      v_severity := 'info';
    END IF;
  ELSE
    v_severity := p_severity;
  END IF;

  INSERT INTO audit_logs (
    player_id, category, action, severity,
    target_type, target_id,
    ip_address, user_agent,
    details, success, error_message
  ) VALUES (
    p_player_id, p_category, p_action, v_severity,
    p_target_type, p_target_id,
    p_ip_address, p_user_agent,
    p_details, p_success, p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get audit logs with filtering
 */
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_player_id INT DEFAULT NULL,
  p_category VARCHAR(50) DEFAULT NULL,
  p_action VARCHAR(100) DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT NULL,
  p_target_type VARCHAR(50) DEFAULT NULL,
  p_target_id INT DEFAULT NULL,
  p_ip_address VARCHAR(45) DEFAULT NULL,
  p_success BOOLEAN DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  player_id INT,
  player_username VARCHAR(30),
  category VARCHAR(50),
  action VARCHAR(100),
  severity VARCHAR(20),
  target_type VARCHAR(50),
  target_id INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  success BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.player_id,
    p.username AS player_username,
    al.category,
    al.action,
    al.severity,
    al.target_type,
    al.target_id,
    al.ip_address,
    al.user_agent,
    al.details,
    al.success,
    al.error_message
  FROM audit_logs al
  LEFT JOIN players p ON al.player_id = p.id
  WHERE
    (p_player_id IS NULL OR al.player_id = p_player_id)
    AND (p_category IS NULL OR al.category = p_category)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_severity IS NULL OR al.severity = p_severity)
    AND (p_target_type IS NULL OR al.target_type = p_target_type)
    AND (p_target_id IS NULL OR al.target_id = p_target_id)
    AND (p_ip_address IS NULL OR al.ip_address = p_ip_address)
    AND (p_success IS NULL OR al.success = p_success)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

/**
 * Get security alerts (failed/suspicious events)
 */
CREATE OR REPLACE FUNCTION get_security_alerts(
  p_hours INT DEFAULT 24,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  created_at TIMESTAMPTZ,
  player_id INT,
  player_username VARCHAR(30),
  category VARCHAR(50),
  action VARCHAR(100),
  severity VARCHAR(20),
  ip_address VARCHAR(45),
  details JSONB,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.player_id,
    p.username AS player_username,
    al.category,
    al.action,
    al.severity,
    al.ip_address,
    al.details,
    al.error_message
  FROM audit_logs al
  LEFT JOIN players p ON al.player_id = p.id
  WHERE
    al.created_at >= NOW() - (p_hours || ' hours')::INTERVAL
    AND (
      al.success = false
      OR al.severity IN ('warning', 'error', 'critical')
      OR al.category = 'security'
    )
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Get login history for a player
 */
CREATE OR REPLACE FUNCTION get_login_history(
  p_player_id INT,
  p_days INT DEFAULT 30,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  created_at TIMESTAMPTZ,
  action VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.created_at,
    al.action,
    al.ip_address,
    al.user_agent,
    al.success
  FROM audit_logs al
  WHERE
    al.player_id = p_player_id
    AND al.category = 'auth'
    AND al.action IN ('login_success', 'login_failed', 'logout', 'logout_all')
    AND al.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Count failed login attempts from an IP in recent time window
 */
CREATE OR REPLACE FUNCTION count_failed_logins(
  p_ip_address VARCHAR(45),
  p_minutes INT DEFAULT 15
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM audit_logs
  WHERE
    ip_address = p_ip_address
    AND category = 'auth'
    AND action = 'login_failed'
    AND created_at >= NOW() - (p_minutes || ' minutes')::INTERVAL;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Cleanup old audit logs (keep recent, archive critical)
 */
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  p_days_to_keep INT DEFAULT 90,
  p_critical_days INT DEFAULT 365
)
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  -- Delete old non-critical logs
  DELETE FROM audit_logs
  WHERE
    created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    AND severity NOT IN ('error', 'critical');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Delete very old critical logs
  DELETE FROM audit_logs
  WHERE
    created_at < NOW() - (p_critical_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AUDIT SUMMARY VIEWS
-- =============================================================================

-- Daily audit summary
CREATE OR REPLACE VIEW audit_daily_summary AS
SELECT
  DATE(created_at) AS log_date,
  category,
  action,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE success = true) AS success_count,
  COUNT(*) FILTER (WHERE success = false) AS failure_count,
  COUNT(DISTINCT player_id) AS unique_players,
  COUNT(DISTINCT ip_address) AS unique_ips
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), category, action
ORDER BY log_date DESC, category, action;

-- Security dashboard view
CREATE OR REPLACE VIEW security_dashboard AS
SELECT
  'last_24h' AS period,
  COUNT(*) FILTER (WHERE category = 'auth' AND action = 'login_failed') AS failed_logins,
  COUNT(*) FILTER (WHERE category = 'auth' AND action = 'login_success') AS successful_logins,
  COUNT(*) FILTER (WHERE category = 'security') AS security_events,
  COUNT(*) FILTER (WHERE severity IN ('warning', 'error', 'critical')) AS alerts,
  COUNT(DISTINCT ip_address) FILTER (WHERE category = 'auth' AND action = 'login_failed') AS suspicious_ips
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM players
    WHERE id = current_setting('app.current_player_id', true)::INT
    AND (is_admin = true OR is_master = true)
  )
);

-- Only service role can insert logs
CREATE POLICY "Service role inserts audit logs"
ON audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Audit logs cannot be updated or deleted through normal means
-- Only cleanup function can delete
