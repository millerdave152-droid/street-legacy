-- Phase 8: Crew Wars and Territory Control System Schema

-- Update districts table with territory control fields
ALTER TABLE districts ADD COLUMN IF NOT EXISTS controlling_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS control_percentage INTEGER DEFAULT 0 CHECK (control_percentage >= 0 AND control_percentage <= 100);
ALTER TABLE districts ADD COLUMN IF NOT EXISTS contested BOOLEAN DEFAULT false;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS contesting_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS last_war_end TIMESTAMP;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS peace_until TIMESTAMP;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS territory_bonuses JSONB DEFAULT '{}';
ALTER TABLE districts ADD COLUMN IF NOT EXISTS adjacent_districts INTEGER[] DEFAULT '{}';

-- Crew ranks table
CREATE TABLE IF NOT EXISTS crew_ranks (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  rank_level INTEGER NOT NULL DEFAULT 1,
  permissions JSONB DEFAULT '{}',
  war_role VARCHAR(50),
  salary_per_day INTEGER DEFAULT 0,
  max_members INTEGER,
  icon VARCHAR(10) DEFAULT '👤',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(crew_id, name),
  UNIQUE(crew_id, rank_level)
);

-- Create index for crew ranks
CREATE INDEX IF NOT EXISTS idx_crew_ranks_crew ON crew_ranks(crew_id);

-- Update crew_members table to reference crew_ranks
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS rank_id INTEGER REFERENCES crew_ranks(id);
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_role VARCHAR(50);
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_points INTEGER DEFAULT 0;
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_kills INTEGER DEFAULT 0;
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_deaths INTEGER DEFAULT 0;
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS last_war_action TIMESTAMP;

-- Territory wars table
CREATE TABLE IF NOT EXISTS territory_wars (
  id SERIAL PRIMARY KEY,
  district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
  attacker_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  defender_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  prep_ends_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  attacker_points INTEGER DEFAULT 0,
  defender_points INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'preparing' CHECK (status IN ('preparing', 'active', 'attacker_won', 'defender_won', 'stalemate', 'cancelled')),
  war_log JSONB DEFAULT '[]',
  war_config JSONB DEFAULT '{}',
  cash_prize INTEGER DEFAULT 50000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for territory wars
CREATE INDEX IF NOT EXISTS idx_territory_wars_district ON territory_wars(district_id);
CREATE INDEX IF NOT EXISTS idx_territory_wars_attacker ON territory_wars(attacker_crew_id);
CREATE INDEX IF NOT EXISTS idx_territory_wars_defender ON territory_wars(defender_crew_id);
CREATE INDEX IF NOT EXISTS idx_territory_wars_status ON territory_wars(status);

-- War missions table
CREATE TABLE IF NOT EXISTS war_missions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  mission_type VARCHAR(50) NOT NULL,
  points_reward INTEGER NOT NULL,
  cash_reward INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 0,
  stamina_cost INTEGER DEFAULT 20,
  focus_cost INTEGER DEFAULT 10,
  min_level INTEGER DEFAULT 1,
  required_role VARCHAR(50),
  cooldown_minutes INTEGER DEFAULT 30,
  success_rate INTEGER DEFAULT 70,
  target_type VARCHAR(50),
  icon VARCHAR(10) DEFAULT '⚔️',
  is_active BOOLEAN DEFAULT true
);

-- Player war mission assignments
CREATE TABLE IF NOT EXISTS player_war_missions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
  mission_id INTEGER REFERENCES war_missions(id) ON DELETE CASCADE,
  target_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  target_poi_id INTEGER,
  status VARCHAR(30) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'failed', 'expired')),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  completed_at TIMESTAMP,
  points_earned INTEGER DEFAULT 0
);

-- Create indexes for player war missions
CREATE INDEX IF NOT EXISTS idx_player_war_missions_player ON player_war_missions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_war_missions_war ON player_war_missions(war_id);
CREATE INDEX IF NOT EXISTS idx_player_war_missions_status ON player_war_missions(status);

-- War events log
CREATE TABLE IF NOT EXISTS war_events (
  id SERIAL PRIMARY KEY,
  war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  target_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  poi_id INTEGER,
  points_earned INTEGER DEFAULT 0,
  description TEXT,
  event_data JSONB DEFAULT '{}',
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for war events
CREATE INDEX IF NOT EXISTS idx_war_events_war ON war_events(war_id);
CREATE INDEX IF NOT EXISTS idx_war_events_occurred ON war_events(occurred_at);

-- POI control during wars
CREATE TABLE IF NOT EXISTS poi_control (
  id SERIAL PRIMARY KEY,
  poi_id INTEGER NOT NULL,
  war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
  controlling_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  capture_started_at TIMESTAMP,
  capture_progress INTEGER DEFAULT 0,
  capturing_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  capturing_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  is_contested BOOLEAN DEFAULT false,
  points_generated INTEGER DEFAULT 0,
  last_point_tick TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  strategic_value INTEGER DEFAULT 1,
  UNIQUE(poi_id, war_id)
);

-- Create index for POI control
CREATE INDEX IF NOT EXISTS idx_poi_control_war ON poi_control(war_id);
CREATE INDEX IF NOT EXISTS idx_poi_control_controlling ON poi_control(controlling_crew_id);

-- Crew war stats
CREATE TABLE IF NOT EXISTS crew_war_stats (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  wars_won INTEGER DEFAULT 0,
  wars_lost INTEGER DEFAULT 0,
  wars_stalemated INTEGER DEFAULT 0,
  total_war_points INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  territories_captured INTEGER DEFAULT 0,
  territories_lost INTEGER DEFAULT 0,
  pois_captured INTEGER DEFAULT 0,
  cash_won INTEGER DEFAULT 0,
  cash_lost INTEGER DEFAULT 0,
  current_war_streak INTEGER DEFAULT 0,
  best_war_streak INTEGER DEFAULT 0,
  last_war_date TIMESTAMP,
  UNIQUE(crew_id)
);

-- Create index for crew war stats
CREATE INDEX IF NOT EXISTS idx_crew_war_stats_crew ON crew_war_stats(crew_id);

-- Peace treaties
CREATE TABLE IF NOT EXISTS peace_treaties (
  id SERIAL PRIMARY KEY,
  crew1_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  crew2_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
  war_id INTEGER REFERENCES territory_wars(id) ON DELETE SET NULL,
  treaty_type VARCHAR(30) DEFAULT 'standard' CHECK (treaty_type IN ('standard', 'surrender', 'mutual')),
  expires_at TIMESTAMP NOT NULL,
  terms JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for peace treaties
CREATE INDEX IF NOT EXISTS idx_peace_treaties_crews ON peace_treaties(crew1_id, crew2_id);
CREATE INDEX IF NOT EXISTS idx_peace_treaties_expires ON peace_treaties(expires_at);

-- War revenge tracking
CREATE TABLE IF NOT EXISTS war_revenge_bonus (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  against_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  original_war_id INTEGER REFERENCES territory_wars(id) ON DELETE SET NULL,
  bonus_percentage INTEGER DEFAULT 10,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(crew_id, against_crew_id)
);

-- Crew bank updates for war costs
ALTER TABLE crews ADD COLUMN IF NOT EXISTS bank_balance INTEGER DEFAULT 0;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS war_debuff_until TIMESTAMP;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS last_war_won TIMESTAMP;
ALTER TABLE crews ADD COLUMN IF NOT EXISTS last_war_lost TIMESTAMP;

-- Player presence tracking for POI capture
CREATE TABLE IF NOT EXISTS player_poi_presence (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  poi_id INTEGER NOT NULL,
  war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
  entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, poi_id, war_id)
);

-- Create index for player presence
CREATE INDEX IF NOT EXISTS idx_player_poi_presence_poi ON player_poi_presence(poi_id, war_id);
