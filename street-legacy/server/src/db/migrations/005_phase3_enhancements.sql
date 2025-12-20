-- Phase 3.3 Enhancements Migration
-- Chat unread tracking, trading improvements, performance indexes

-- =============================================================================
-- CHAT UNREAD TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_read_positions (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel_id VARCHAR(50) NOT NULL,
  last_read_message_id BIGINT DEFAULT 0,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, channel_id)
);

COMMENT ON TABLE chat_read_positions IS 'Tracks last read message position per player per channel';

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_chat_read_player_channel
  ON chat_read_positions(player_id, channel_id);

-- =============================================================================
-- TRADE HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS trade_history (
  id SERIAL PRIMARY KEY,
  trade_id INT NOT NULL,
  from_player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'cancelled', 'expired', 'rejected')),
  from_items JSONB DEFAULT '[]',
  to_items JSONB DEFAULT '[]',
  from_cash INT DEFAULT 0,
  to_cash INT DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE trade_history IS 'Historical record of completed/cancelled trades';

CREATE INDEX IF NOT EXISTS idx_trade_history_from_player
  ON trade_history(from_player_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_history_to_player
  ON trade_history(to_player_id, completed_at DESC);

-- =============================================================================
-- ITEM SALES TABLE (for sell-back feature)
-- =============================================================================

CREATE TABLE IF NOT EXISTS item_sales (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  sale_price INT NOT NULL,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE item_sales IS 'Records of items sold back to shop';

CREATE INDEX IF NOT EXISTS idx_item_sales_player
  ON item_sales(player_id, sold_at DESC);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Chat message performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created
  ON chat_messages(channel, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_player_created
  ON chat_messages(player_id, created_at DESC);

-- Chat mutes active lookup (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_mutes') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_mutes_player_active ON chat_mutes(player_id, channel_id, expires_at);
  END IF;
END $$;

-- Trade items batch loading (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trade_items') THEN
    CREATE INDEX IF NOT EXISTS idx_trade_items_trade_id ON trade_items(trade_id);
  END IF;
END $$;

-- Trades by player status (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
    CREATE INDEX IF NOT EXISTS idx_trades_from_player_status ON trades(from_player_id, status) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_trades_to_player_status ON trades(to_player_id, status) WHERE status = 'pending';
  END IF;
END $$;

-- Player cooldowns active (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_cooldowns') THEN
    -- Check which schema version we have
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_cooldowns' AND column_name = 'action_type') THEN
      CREATE INDEX IF NOT EXISTS idx_player_cooldowns_active ON player_cooldowns(player_id, action_type, expires_at);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_cooldowns' AND column_name = 'crime_id') THEN
      CREATE INDEX IF NOT EXISTS idx_player_cooldowns_active ON player_cooldowns(player_id, crime_id, available_at);
    END IF;
  END IF;
END $$;

-- Friends bidirectional lookup (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friends') THEN
    CREATE INDEX IF NOT EXISTS idx_friends_player_status ON friends(player_id, status);
    CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON friends(friend_id, status);
  END IF;
END $$;

-- Direct messages conversation lookup (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'direct_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_direct_messages_from_to ON direct_messages(from_id, to_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_to_from ON direct_messages(to_id, from_id, created_at DESC);
  END IF;
END $$;

-- =============================================================================
-- ADD EXPIRES_AT TO TRADES TABLE
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'trades' AND column_name = 'expires_at'
    ) THEN
      ALTER TABLE trades ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');
    END IF;
    -- Index for trade expiration cleanup
    CREATE INDEX IF NOT EXISTS idx_trades_expires ON trades(expires_at) WHERE status = 'pending';
  END IF;
END $$;

-- =============================================================================
-- ITEM PRICES TABLE (for sell values)
-- =============================================================================

-- Add sell_price column to items if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'items' AND column_name = 'sell_price'
    ) THEN
      ALTER TABLE items ADD COLUMN sell_price INT DEFAULT 0;
      -- Default sell price is 40% of buy price
      UPDATE items SET sell_price = COALESCE(price * 0.4, 0)::INT WHERE sell_price = 0 OR sell_price IS NULL;
    END IF;
  END IF;
END $$;

