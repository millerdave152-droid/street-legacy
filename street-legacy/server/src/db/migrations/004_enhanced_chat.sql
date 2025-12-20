-- Enhanced Chat System Migration
-- Adds support for multiple chat channels (global, crew, district, private)

-- =============================================================================
-- CHAT CHANNELS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_channels (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('global', 'district', 'crew', 'private', 'system')),
  description TEXT,
  is_moderated BOOLEAN DEFAULT TRUE,
  min_level INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE chat_channels IS 'Chat channel definitions';

-- Insert default channels
INSERT INTO chat_channels (id, name, type, description, min_level) VALUES
('global', 'Global Chat', 'global', 'Main chat for all players', 1),
('trade', 'Trade Chat', 'global', 'Buy, sell, and trade items', 5),
('help', 'Help Chat', 'global', 'Ask questions and get help', 1),
('crew', 'Crew Chat', 'crew', 'Private crew communications', 1),
('system', 'System', 'system', 'System announcements', 1)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CHAT MESSAGES ENHANCEMENTS
-- Add missing columns to existing chat_messages table if they don't exist
-- =============================================================================

DO $$
BEGIN
  -- Add reply_to_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reply_to_id') THEN
    ALTER TABLE chat_messages ADD COLUMN reply_to_id INT;
  END IF;

  -- Add is_deleted column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_deleted') THEN
    ALTER TABLE chat_messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add deleted_by column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'deleted_by') THEN
    ALTER TABLE chat_messages ADD COLUMN deleted_by INT;
  END IF;

  -- Add deleted_reason column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'deleted_reason') THEN
    ALTER TABLE chat_messages ADD COLUMN deleted_reason TEXT;
  END IF;

  -- Add metadata column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'metadata') THEN
    ALTER TABLE chat_messages ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- =============================================================================
-- CHAT MUTES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_mutes (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  muted_by INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel VARCHAR(50), -- NULL = all channels
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, channel)
);

COMMENT ON TABLE chat_mutes IS 'Player chat mutes by channel';

-- =============================================================================
-- PROFANITY FILTER TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_filter_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(100) NOT NULL UNIQUE,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  replacement VARCHAR(100) DEFAULT '***',
  is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE chat_filter_words IS 'Words to filter from chat';

-- Insert some basic filter words
INSERT INTO chat_filter_words (word, severity) VALUES
('spam', 'low'),
('scam', 'medium')
ON CONFLICT (word) DO NOTHING;

-- =============================================================================
-- CHAT REPORTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_reports (
  id SERIAL PRIMARY KEY,
  message_id INT NOT NULL,
  reporter_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'scam', 'other')),
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by INT REFERENCES players(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, reporter_id)
);

COMMENT ON TABLE chat_reports IS 'User reports for chat messages';

-- =============================================================================
-- INDEXES (conditional based on existing columns)
-- =============================================================================

-- Add channel column to chat_messages if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'channel') THEN
    ALTER TABLE chat_messages ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'global';
  END IF;
END $$;

-- Chat messages indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'channel') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel, created_at DESC);
  END IF;

  CREATE INDEX IF NOT EXISTS idx_chat_messages_player ON chat_messages(player_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

  -- Conditional index for is_deleted (only if column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_deleted')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'channel') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON chat_messages(channel, created_at DESC) WHERE is_deleted = FALSE;
  END IF;
END $$;

-- Chat mutes indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_mutes') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_mutes_player ON chat_mutes(player_id);
    -- Check which column exists: channel or channel_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_mutes' AND column_name = 'channel') THEN
      CREATE INDEX IF NOT EXISTS idx_chat_mutes_expires ON chat_mutes(player_id, channel, expires_at);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_mutes' AND column_name = 'channel_id') THEN
      CREATE INDEX IF NOT EXISTS idx_chat_mutes_expires ON chat_mutes(player_id, channel_id, expires_at);
    ELSE
      CREATE INDEX IF NOT EXISTS idx_chat_mutes_expires ON chat_mutes(player_id, expires_at);
    END IF;
  END IF;
END $$;

-- Chat reports indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_reports') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_reports_pending ON chat_reports(status) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_chat_reports_message ON chat_reports(message_id);
  END IF;
END $$;

-- =============================================================================
-- CREW CHAT CHANNEL CREATION TRIGGER (only if crews table exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crews') THEN
    -- Create the function
    CREATE OR REPLACE FUNCTION create_crew_chat_channel()
    RETURNS TRIGGER AS $func$
    BEGIN
      INSERT INTO chat_channels (id, name, type, description)
      VALUES ('crew:' || NEW.id, NEW.name || ' Crew Chat', 'crew', 'Private chat for ' || NEW.name)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    -- Create the trigger
    DROP TRIGGER IF EXISTS trigger_create_crew_chat ON crews;
    CREATE TRIGGER trigger_create_crew_chat
      AFTER INSERT ON crews
      FOR EACH ROW
      EXECUTE FUNCTION create_crew_chat_channel();
  END IF;
END $$;

-- =============================================================================
-- DISTRICT CHAT CHANNEL CREATION (only if districts table exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'districts') THEN
    INSERT INTO chat_channels (id, name, type, description)
    SELECT
      'district:' || id,
      name || ' District Chat',
      'district',
      'Chat for players in ' || name
    FROM districts
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
