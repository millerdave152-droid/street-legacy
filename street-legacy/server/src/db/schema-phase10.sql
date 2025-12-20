-- Phase 10: Reputation and Faction Systems Schema

-- Factions table
CREATE TABLE IF NOT EXISTS factions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('gang', 'mafia', 'cartel', 'syndicate', 'corporate', 'government')),
  territory_district_ids JSONB DEFAULT '[]',
  hq_poi_id INTEGER,
  ideology TEXT,
  background_lore TEXT,
  leader_npc_id INTEGER,
  color VARCHAR(20) DEFAULT '#888888',
  icon VARCHAR(10) DEFAULT '⚔️',
  hostilities JSONB DEFAULT '{}',
  power_level INTEGER DEFAULT 50,
  wealth INTEGER DEFAULT 100000,
  member_count INTEGER DEFAULT 50,
  is_recruitable BOOLEAN DEFAULT true,
  min_level_to_join INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player faction reputation
CREATE TABLE IF NOT EXISTS player_faction_rep (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  reputation INTEGER DEFAULT 0 CHECK (reputation >= -1000 AND reputation <= 1000),
  rank VARCHAR(30) DEFAULT 'outsider' CHECK (rank IN ('outsider', 'associate', 'member', 'made', 'captain', 'underboss', 'boss')),
  missions_completed INTEGER DEFAULT 0,
  members_killed INTEGER DEFAULT 0,
  money_donated INTEGER DEFAULT 0,
  territories_defended INTEGER DEFAULT 0,
  enemies_killed INTEGER DEFAULT 0,
  joined_at TIMESTAMP,
  last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_banned BOOLEAN DEFAULT false,
  ban_reason VARCHAR(200),
  UNIQUE(player_id, faction_id)
);

-- Faction missions
CREATE TABLE IF NOT EXISTS faction_missions (
  id SERIAL PRIMARY KEY,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  mission_type VARCHAR(30) NOT NULL CHECK (mission_type IN ('collection', 'enforcement', 'defense', 'expansion', 'war', 'smuggling', 'recruitment', 'heist', 'assassination', 'sabotage')),
  min_rank VARCHAR(30) DEFAULT 'associate',
  min_reputation INTEGER DEFAULT 100,
  reputation_reward INTEGER NOT NULL,
  cash_reward INTEGER NOT NULL,
  xp_reward INTEGER DEFAULT 100,
  enemy_faction_id INTEGER REFERENCES factions(id),
  target_npc_id INTEGER,
  target_poi_id INTEGER,
  target_district_id INTEGER,
  objectives JSONB DEFAULT '[]',
  time_limit_minutes INTEGER DEFAULT 60,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  cooldown_hours INTEGER DEFAULT 4,
  max_daily_completions INTEGER DEFAULT 3,
  required_crew_size INTEGER DEFAULT 1,
  is_story_mission BOOLEAN DEFAULT false,
  story_order INTEGER,
  prerequisites JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  icon VARCHAR(10) DEFAULT '📋'
);

-- Active faction missions (player attempts)
CREATE TABLE IF NOT EXISTS active_faction_missions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  mission_id INTEGER REFERENCES faction_missions(id) ON DELETE CASCADE,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  crew_members JSONB DEFAULT '[]',
  rewards_claimed BOOLEAN DEFAULT false
);

-- Faction mission completions (history/cooldowns)
CREATE TABLE IF NOT EXISTS faction_mission_completions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  mission_id INTEGER REFERENCES faction_missions(id) ON DELETE CASCADE,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  was_successful BOOLEAN DEFAULT true,
  reputation_earned INTEGER DEFAULT 0,
  cash_earned INTEGER DEFAULT 0
);

-- Faction wars
CREATE TABLE IF NOT EXISTS faction_wars (
  id SERIAL PRIMARY KEY,
  aggressor_faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  defender_faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  war_state VARCHAR(30) DEFAULT 'tension' CHECK (war_state IN ('peace', 'tension', 'cold_war', 'hot_war', 'total_war')),
  aggressor_score INTEGER DEFAULT 0,
  defender_score INTEGER DEFAULT 0,
  territories_contested JSONB DEFAULT '[]',
  casualties_aggressor INTEGER DEFAULT 0,
  casualties_defender INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  escalated_at TIMESTAMP,
  ended_at TIMESTAMP,
  outcome VARCHAR(50),
  peace_terms JSONB,
  UNIQUE(aggressor_faction_id, defender_faction_id)
);

-- Faction war contributions (player participation)
CREATE TABLE IF NOT EXISTS faction_war_contributions (
  id SERIAL PRIMARY KEY,
  war_id INTEGER REFERENCES faction_wars(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  kills INTEGER DEFAULT 0,
  territories_captured INTEGER DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  contribution_score INTEGER DEFAULT 0,
  last_contribution TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Faction shop items
CREATE TABLE IF NOT EXISTS faction_shop_items (
  id SERIAL PRIMARY KEY,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL,
  item_id INTEGER,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL,
  min_rank VARCHAR(30) DEFAULT 'associate',
  min_reputation INTEGER DEFAULT 100,
  discount_per_rank INTEGER DEFAULT 5,
  stock_limit INTEGER,
  current_stock INTEGER,
  restock_hours INTEGER DEFAULT 24,
  last_restock TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Faction story progress
CREATE TABLE IF NOT EXISTS faction_story_progress (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  current_chapter VARCHAR(30) DEFAULT 'introduction' CHECK (current_chapter IN ('introduction', 'rising', 'initiation', 'climb', 'crisis', 'resolution')),
  chapter_progress INTEGER DEFAULT 0,
  choices_made JSONB DEFAULT '[]',
  story_flags JSONB DEFAULT '{}',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_progress TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(player_id, faction_id)
);

-- Faction events (random world events)
CREATE TABLE IF NOT EXISTS faction_events (
  id SERIAL PRIMARY KEY,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  affects_reputation BOOLEAN DEFAULT false,
  reputation_modifier INTEGER DEFAULT 0,
  affects_territory BOOLEAN DEFAULT false,
  territory_changes JSONB,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP,
  is_resolved BOOLEAN DEFAULT false,
  resolution_outcome TEXT
);

-- Faction safehouses
CREATE TABLE IF NOT EXISTS faction_safehouses (
  id SERIAL PRIMARY KEY,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  district_id INTEGER,
  poi_id INTEGER,
  capacity INTEGER DEFAULT 10,
  current_occupants INTEGER DEFAULT 0,
  amenities JSONB DEFAULT '[]',
  heat_reduction INTEGER DEFAULT 20,
  healing_rate INTEGER DEFAULT 10,
  is_compromised BOOLEAN DEFAULT false,
  min_rank VARCHAR(30) DEFAULT 'associate',
  is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_faction_rep_player ON player_faction_rep(player_id);
CREATE INDEX IF NOT EXISTS idx_player_faction_rep_faction ON player_faction_rep(faction_id);
CREATE INDEX IF NOT EXISTS idx_player_faction_rep_reputation ON player_faction_rep(reputation);
CREATE INDEX IF NOT EXISTS idx_faction_missions_faction ON faction_missions(faction_id);
CREATE INDEX IF NOT EXISTS idx_faction_missions_type ON faction_missions(mission_type);
CREATE INDEX IF NOT EXISTS idx_active_faction_missions_player ON active_faction_missions(player_id);
CREATE INDEX IF NOT EXISTS idx_active_faction_missions_status ON active_faction_missions(status);
CREATE INDEX IF NOT EXISTS idx_faction_wars_state ON faction_wars(war_state);
CREATE INDEX IF NOT EXISTS idx_faction_story_progress_player ON faction_story_progress(player_id);
