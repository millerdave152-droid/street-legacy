-- Performance indexes for Street Legacy
-- Based on query pattern analysis - December 2024
-- These indexes optimize the most frequently executed queries

-- =====================================================
-- HIGH PRIORITY - Most impactful for performance
-- =====================================================

-- Businesses: owner + status lookup (for income collection and active business checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_owner_status
  ON businesses (owner_id, status);

-- Properties: owner + district lookup (common join pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_owner_district
  ON properties (owner_id, district_id);

-- Transactions: player domain date (for audit trail and history queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_player_domain_date
  ON transactions (player_id, domain, created_at DESC);

-- Crime logs: recent crimes per district (for territory calculations)
-- Partial index for recent data only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crime_logs_recent_district
  ON crime_logs (district_id, created_at DESC, success)
  WHERE created_at > NOW() - INTERVAL '7 days';

-- Player cooldowns: active cooldowns lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cooldowns_active_lookup
  ON player_cooldowns (player_id, crime_id, available_at)
  WHERE available_at > NOW();

-- =====================================================
-- MEDIUM PRIORITY - Good performance improvement
-- =====================================================

-- Players: energy regeneration checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_energy_regen
  ON players (id, energy_updated_at)
  WHERE energy < 100;

-- Friends: relationship status lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friends_player_status
  ON friends (player_id, friend_id, status);

-- Crew members: role-based lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crew_members_crew_role
  ON crew_members (crew_id, role);

-- Player achievements: unlocked achievements listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_achievements_recent
  ON player_achievements (player_id, unlocked_at DESC);

-- District influence: score-based ranking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_district_influence_ranking
  ON district_influence (district_id, influence_score DESC);

-- =====================================================
-- LOWER PRIORITY - Nice to have
-- =====================================================

-- Marketplace listings: active listings browsing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_active_recent
  ON marketplace_listings (status, created_at DESC)
  WHERE status = 'active';

-- Game events: player event history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_events_player_recent
  ON game_events (player_id, created_at DESC);

-- Player stats: leaderboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_crimes
  ON player_stats (total_crimes DESC, successful_crimes DESC);

-- Crime logs: player crime history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crime_logs_player_recent
  ON crime_logs (player_id, attempted_at DESC);

-- =====================================================
-- Analyze tables to update statistics
-- =====================================================
ANALYZE players;
ANALYZE businesses;
ANALYZE properties;
ANALYZE transactions;
ANALYZE crime_logs;
ANALYZE player_cooldowns;
ANALYZE friends;
ANALYZE crew_members;
ANALYZE player_achievements;
ANALYZE district_influence;
ANALYZE marketplace_listings;
ANALYZE game_events;
ANALYZE player_stats;
