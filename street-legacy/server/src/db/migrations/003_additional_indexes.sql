-- Additional Performance Indexes
-- Phase 2.2 Database Optimization

-- =============================================================================
-- COMPOSITE INDEXES FOR JOIN PATTERNS
-- =============================================================================

-- Player properties composite for property ownership lookups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_properties') THEN
    CREATE INDEX IF NOT EXISTS idx_player_properties_composite ON player_properties(player_id, property_id);
  END IF;
END $$;

-- Player inventory composite for item ownership checks
CREATE INDEX IF NOT EXISTS idx_player_inventory_composite
ON player_inventory(player_id, item_id);

-- Friends relationship lookup (both directions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friends') THEN
    CREATE INDEX IF NOT EXISTS idx_friends_players ON friends(player_id, friend_id, status);
    CREATE INDEX IF NOT EXISTS idx_friends_reverse ON friends(friend_id, player_id, status);
  END IF;
END $$;

-- Direct messages for conversation lookups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'direct_messages') THEN
    CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(from_id, to_id, created_at DESC);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'read') THEN
      CREATE INDEX IF NOT EXISTS idx_direct_messages_unread ON direct_messages(to_id, read, from_id) WHERE read = false;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- CRIME AND TERRITORY INDEXES
-- =============================================================================

-- Crime logs for territory control calculation (removed NOW() - not allowed in index)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crime_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_crime_logs_territory ON crime_logs(district_id, created_at DESC, success) WHERE success = true;
    CREATE INDEX IF NOT EXISTS idx_crime_logs_player_district ON crime_logs(player_id, district_id, crime_id, created_at DESC);
  END IF;
END $$;

-- POI control for territory wars
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poi_control') THEN
    CREATE INDEX IF NOT EXISTS idx_poi_control_war ON poi_control(war_id, controlling_crew_id);
  END IF;
END $$;

-- Territory wars active status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'territory_wars')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'territory_wars' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_territory_wars_active ON territory_wars(status, district_id) WHERE status IN ('active', 'pending');
  END IF;
END $$;

-- =============================================================================
-- HEIST INDEXES
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'heist_participants') THEN
    CREATE INDEX IF NOT EXISTS idx_heist_participants_heist ON heist_participants(active_heist_id, player_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'heist_roles') THEN
    CREATE INDEX IF NOT EXISTS idx_heist_roles_heist ON heist_roles(heist_id);
  END IF;
END $$;

-- =============================================================================
-- PVP AND BOUNTY INDEXES
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pvp_fights') THEN
    CREATE INDEX IF NOT EXISTS idx_pvp_fights_attacker ON pvp_fights(attacker_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pvp_fights_player ON pvp_fights(attacker_id, defender_id, created_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bounties') THEN
    CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_id, status) WHERE status = 'active';
  END IF;
END $$;

-- =============================================================================
-- CREW INDEXES
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crew_members') THEN
    CREATE INDEX IF NOT EXISTS idx_crew_members_crew ON crew_members(crew_id, role, joined_at);
  END IF;
  -- Player crew lookup (check if crew_id column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'crew_id') THEN
    CREATE INDEX IF NOT EXISTS idx_players_crew ON players(crew_id) WHERE crew_id IS NOT NULL;
  END IF;
END $$;

-- =============================================================================
-- TRADE INDEXES
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trade_items') THEN
    CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id, direction);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
    CREATE INDEX IF NOT EXISTS idx_trades_from_player ON trades(from_player_id, status, created_at DESC);
  END IF;
END $$;

-- =============================================================================
-- ACHIEVEMENT AND STATS INDEXES
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_achievements') THEN
    CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id, unlocked_at DESC);
  END IF;
END $$;

-- =============================================================================
-- LEADERBOARD OPTIMIZATION
-- =============================================================================

DO $$
BEGIN
  -- Check if banned_at column exists before creating filtered index
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'banned_at') THEN
    CREATE INDEX IF NOT EXISTS idx_players_level_leaderboard ON players(level DESC, xp DESC) WHERE banned_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_players_cash_leaderboard ON players(cash DESC) WHERE banned_at IS NULL;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_players_level_leaderboard ON players(level DESC, xp DESC);
    CREATE INDEX IF NOT EXISTS idx_players_cash_leaderboard ON players(cash DESC);
  END IF;
END $$;

-- =============================================================================
-- JSONB INDEXES (for filtering on JSONB fields)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(player_id, type, created_at DESC);
  END IF;
END $$;

-- =============================================================================
-- UPDATE TABLE STATISTICS (only for tables that exist)
-- =============================================================================

ANALYZE players;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_properties') THEN ANALYZE player_properties; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_inventory') THEN ANALYZE player_inventory; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friends') THEN ANALYZE friends; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'direct_messages') THEN ANALYZE direct_messages; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crime_logs') THEN ANALYZE crime_logs; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'territory_wars') THEN ANALYZE territory_wars; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poi_control') THEN ANALYZE poi_control; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'heist_participants') THEN ANALYZE heist_participants; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pvp_fights') THEN ANALYZE pvp_fights; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bounties') THEN ANALYZE bounties; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crew_members') THEN ANALYZE crew_members; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN ANALYZE trades; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trade_items') THEN ANALYZE trade_items; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_achievements') THEN ANALYZE player_achievements; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN ANALYZE notifications; END IF; END $$;
