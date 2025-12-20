-- Performance optimization indexes
-- Run this migration to improve query performance

-- Player heat level for matchmaking and leaderboards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'heat_level') THEN
    CREATE INDEX IF NOT EXISTS idx_players_heat ON players(heat_level) WHERE heat_level > 0;
  END IF;
END $$;

-- Player online status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'last_seen') THEN
    CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen DESC);
  END IF;
END $$;

-- Combat sessions for active fights
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'combat_sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_combat_sessions_status ON combat_sessions(status, updated_at) WHERE status IN ('active', 'waiting');
  END IF;
END $$;

-- Active bounties sorted by amount
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bounties') THEN
    CREATE INDEX IF NOT EXISTS idx_bounties_active_amount ON bounties(amount DESC) WHERE status = 'active';
  END IF;
END $$;

-- Player jail status for quick lookups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'in_jail') THEN
    CREATE INDEX IF NOT EXISTS idx_players_jail ON players(in_jail, jail_release_at) WHERE in_jail = true;
  END IF;
END $$;

-- Crew territory control
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'districts' AND column_name = 'controlling_crew_id') THEN
    CREATE INDEX IF NOT EXISTS idx_districts_crew ON districts(controlling_crew_id) WHERE controlling_crew_id IS NOT NULL;
  END IF;
END $$;

-- Chat messages for efficient polling
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_chat_recent ON chat_messages(created_at DESC, id DESC);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'channel') THEN
      CREATE INDEX IF NOT EXISTS idx_chat_channel_recent ON chat_messages(channel, created_at DESC);
    END IF;
  END IF;
END $$;

-- Player properties for income collection
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_properties') THEN
    CREATE INDEX IF NOT EXISTS idx_player_properties_income ON player_properties(player_id, last_collected_at);
  END IF;
END $$;

-- Active heists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'active_heists') THEN
    CREATE INDEX IF NOT EXISTS idx_active_heists_status ON active_heists(status, crew_id) WHERE status IN ('planning', 'ready', 'in_progress');
  END IF;
END $$;

-- Faction reputation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_faction_reputation') THEN
    CREATE INDEX IF NOT EXISTS idx_player_faction_rep ON player_faction_reputation(player_id, faction_id);
  END IF;
END $$;

-- Currency transactions for audit
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'currency_transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_currency_tx_player_date ON currency_transactions(player_id, created_at DESC);
  END IF;
END $$;

-- Player stats composite index for leaderboards
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_stats') THEN
    CREATE INDEX IF NOT EXISTS idx_player_stats_leaderboard ON player_stats(total_crimes DESC, successful_crimes DESC);
  END IF;
END $$;

-- Partial index for non-banned active players
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'banned_at')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_earnings') THEN
    CREATE INDEX IF NOT EXISTS idx_players_active ON players(level DESC, total_earnings DESC) WHERE banned_at IS NULL;
  END IF;
END $$;

-- Gang war active status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gang_wars') THEN
    CREATE INDEX IF NOT EXISTS idx_gang_wars_active ON gang_wars(district_id, status) WHERE status = 'active';
  END IF;
END $$;

-- Trade pending offers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
    CREATE INDEX IF NOT EXISTS idx_trades_pending ON trades(to_player_id, status, created_at DESC) WHERE status = 'pending';
  END IF;
END $$;

-- Notifications unread
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(player_id, created_at DESC) WHERE read = false;
  END IF;
END $$;

-- Mission progress tracking
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_missions') THEN
    CREATE INDEX IF NOT EXISTS idx_player_missions_active ON player_missions(player_id, completed, assigned_at) WHERE completed = false;
  END IF;
END $$;

-- Black market availability
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'black_market_inventory') THEN
    CREATE INDEX IF NOT EXISTS idx_black_market_available ON black_market_inventory(available_until) WHERE quantity > 0;
  END IF;
END $$;

-- Player operations by status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_operations') THEN
    CREATE INDEX IF NOT EXISTS idx_player_operations_active ON player_operations(player_id, status) WHERE status = 'active';
  END IF;
END $$;

-- Analyze tables after creating indexes (only if they exist)
ANALYZE players;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'districts') THEN ANALYZE districts; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crime_logs') THEN ANALYZE crime_logs; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN ANALYZE chat_messages; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_cooldowns') THEN ANALYZE player_cooldowns; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bounties') THEN ANALYZE bounties; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN ANALYZE trades; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN ANALYZE notifications; END IF; END $$;
