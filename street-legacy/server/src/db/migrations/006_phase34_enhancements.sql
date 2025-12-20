-- Phase 3.4 Enhancements Migration
-- Security hardening, session management optimization, additional indexes

-- =============================================================================
-- CREATE MISSING TABLES (if they don't exist)
-- =============================================================================

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT REFERENCES players(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat reports table
CREATE TABLE IF NOT EXISTS chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  reporter_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by INT REFERENCES players(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat mutes table
CREATE TABLE IF NOT EXISTS chat_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel_id TEXT,
  muted_by INT REFERENCES players(id),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  offered_items JSONB DEFAULT '[]',
  requested_items JSONB DEFAULT '[]',
  offered_cash BIGINT DEFAULT 0,
  requested_cash BIGINT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trade history table
CREATE TABLE IF NOT EXISTS trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID,
  from_player_id INT NOT NULL,
  to_player_id INT NOT NULL,
  items_traded JSONB DEFAULT '[]',
  cash_traded BIGINT DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item sales table
CREATE TABLE IF NOT EXISTS item_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity INT DEFAULT 1,
  price BIGINT NOT NULL,
  buyer_type TEXT DEFAULT 'npc' CHECK (buyer_type IN ('npc', 'player', 'market')),
  buyer_id INT,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SESSION MANAGEMENT INDEXES
-- =============================================================================

-- User sessions lookup by user and expiration
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires
  ON user_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

-- Session device fingerprint for security checks
CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint
  ON user_sessions(device_fingerprint, created_at DESC);

-- Active sessions cleanup index
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_cleanup
  ON user_sessions(expires_at)
  WHERE revoked_at IS NULL;

-- =============================================================================
-- EMAIL VERIFICATION INDEXES
-- =============================================================================

-- Token lookup for verification
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_lookup
  ON email_verification_tokens(token, expires_at)
  WHERE used_at IS NULL;

-- User verification status
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens(user_id, created_at DESC);

-- =============================================================================
-- PASSWORD RESET INDEXES
-- =============================================================================

-- Token lookup for password reset
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_lookup
  ON password_reset_tokens(token, expires_at)
  WHERE used_at IS NULL;

-- User password reset rate limiting
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_recent
  ON password_reset_tokens(user_id, created_at DESC);

-- IP-based rate limiting for password resets
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_ip
  ON password_reset_tokens(ip_address, created_at DESC);

-- =============================================================================
-- AUDIT LOG INDEXES
-- =============================================================================

-- Audit logs by action type for security monitoring
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_recent
  ON audit_logs(action, created_at DESC);

-- Audit logs by IP for suspicious activity detection
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_recent
  ON audit_logs(ip_address, created_at DESC);

-- Audit logs by user for account activity review
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_recent
  ON audit_logs(user_id, created_at DESC);

-- =============================================================================
-- CHAT PERFORMANCE INDEXES
-- =============================================================================

-- Chat messages for channel pagination (most recent first)
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_pagination
  ON chat_messages(channel, created_at DESC, id DESC);

-- Chat reports for moderation queue
CREATE INDEX IF NOT EXISTS idx_chat_reports_pending
  ON chat_reports(status, created_at)
  WHERE status = 'pending';

-- Player chat bans active check
CREATE INDEX IF NOT EXISTS idx_chat_mutes_active
  ON chat_mutes(player_id, channel_id, expires_at);

-- =============================================================================
-- TRADING PERFORMANCE INDEXES
-- =============================================================================

-- Trades pending for user (incoming and outgoing)
CREATE INDEX IF NOT EXISTS idx_trades_pending_to
  ON trades(to_player_id, created_at DESC)
  WHERE status = 'pending';

-- Trade history for analytics
CREATE INDEX IF NOT EXISTS idx_trade_history_recent
  ON trade_history(completed_at DESC);

-- Trade history by player for profile view
CREATE INDEX IF NOT EXISTS idx_trade_history_player
  ON trade_history(from_player_id, completed_at DESC);

-- =============================================================================
-- INVENTORY PERFORMANCE INDEXES
-- =============================================================================

-- Player inventory equipped items quick lookup
CREATE INDEX IF NOT EXISTS idx_player_inventory_equipped
  ON player_inventory(player_id)
  WHERE equipped = true;

-- Item sales for economy tracking
CREATE INDEX IF NOT EXISTS idx_item_sales_recent
  ON item_sales(sold_at DESC);

-- =============================================================================
-- ADDITIONAL SECURITY COLUMNS (must be added before indexes that reference them)
-- =============================================================================

-- Add failed_login_attempts to players if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE players ADD COLUMN failed_login_attempts INT DEFAULT 0;
  END IF;
END $$;

-- Add locked_until to players if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE players ADD COLUMN locked_until TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Add last_active_at to players if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE players ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add banned_at to players if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'banned_at'
  ) THEN
    ALTER TABLE players ADD COLUMN banned_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Add email_verified_at to players if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE players ADD COLUMN email_verified_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- =============================================================================
-- PLAYER PERFORMANCE INDEXES
-- =============================================================================

-- Players online status (for presence system)
CREATE INDEX IF NOT EXISTS idx_players_last_active
  ON players(last_active_at DESC);

-- Players by district (for district presence counts)
CREATE INDEX IF NOT EXISTS idx_players_by_district
  ON players(current_district, last_active_at DESC)
  WHERE banned_at IS NULL;

-- Players email verified status
CREATE INDEX IF NOT EXISTS idx_players_email_verified
  ON players(email_verified_at)
  WHERE email_verified_at IS NULL;

-- =============================================================================
-- ECONOMY AUDIT INDEXES
-- =============================================================================

-- Currency transactions for monitoring large transfers
CREATE INDEX IF NOT EXISTS idx_currency_transactions_large_amounts
  ON currency_transactions(amount DESC, created_at DESC)
  WHERE amount > 100000;

-- Currency transaction patterns by type
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type_recent
  ON currency_transactions(transaction_type, created_at DESC);

-- =============================================================================
-- UPDATE STATISTICS
-- =============================================================================

ANALYZE players;
ANALYZE user_sessions;
ANALYZE email_verification_tokens;
ANALYZE password_reset_tokens;
ANALYZE audit_logs;
ANALYZE chat_messages;
ANALYZE chat_reports;
ANALYZE chat_mutes;
ANALYZE trades;
ANALYZE trade_history;
ANALYZE player_inventory;
ANALYZE item_sales;
ANALYZE currency_transactions;
