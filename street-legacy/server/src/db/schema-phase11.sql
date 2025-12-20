-- Phase 11: PVP Combat and Bounty System Schema

-- Add combat stats to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS max_health INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS attack INTEGER DEFAULT 10;
ALTER TABLE players ADD COLUMN IF NOT EXISTS defense INTEGER DEFAULT 10;
ALTER TABLE players ADD COLUMN IF NOT EXISTS accuracy INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS evasion INTEGER DEFAULT 20;
ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_weapon_id INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_armor_id INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS combat_level INTEGER DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS combat_xp INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_kills INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_deaths INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS current_kill_streak INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS best_kill_streak INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bounties_claimed INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bounties_on_head INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_hospitalized BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hospital_release_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_combat_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS current_district_id INTEGER DEFAULT 1;

-- Combat sessions (active fights)
CREATE TABLE IF NOT EXISTS combat_sessions (
  id SERIAL PRIMARY KEY,
  attacker_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  defender_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  district_id INTEGER,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'attacker_won', 'defender_won', 'draw', 'fled', 'timeout')),
  current_round INTEGER DEFAULT 1,
  max_rounds INTEGER DEFAULT 10,
  attacker_health INTEGER NOT NULL,
  defender_health INTEGER NOT NULL,
  attacker_starting_health INTEGER NOT NULL,
  defender_starting_health INTEGER NOT NULL,
  attacker_action VARCHAR(30),
  defender_action VARCHAR(30),
  combat_log JSONB DEFAULT '[]',
  loot_amount INTEGER DEFAULT 0,
  winner_id INTEGER,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  UNIQUE(attacker_id, defender_id, status) -- Only one active combat between same players
);

-- Combat history
CREATE TABLE IF NOT EXISTS combat_history (
  id SERIAL PRIMARY KEY,
  attacker_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  defender_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  winner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  district_id INTEGER,
  rounds_fought INTEGER,
  attacker_damage_dealt INTEGER DEFAULT 0,
  defender_damage_dealt INTEGER DEFAULT 0,
  loot_transferred INTEGER DEFAULT 0,
  combat_xp_gained INTEGER DEFAULT 0,
  was_bounty_kill BOOLEAN DEFAULT false,
  bounty_claimed INTEGER DEFAULT 0,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Combat cooldowns (prevent spam attacks)
CREATE TABLE IF NOT EXISTS combat_cooldowns (
  id SERIAL PRIMARY KEY,
  attacker_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  target_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  cooldown_until TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attacker_id, target_id)
);

-- Bounties
CREATE TABLE IF NOT EXISTS bounties (
  id SERIAL PRIMARY KEY,
  target_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  placed_by_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount >= 1000),
  reason VARCHAR(200),
  is_anonymous BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired', 'cancelled', 'paid_off')),
  is_auto_bounty BOOLEAN DEFAULT false,
  auto_bounty_type VARCHAR(50),
  expires_at TIMESTAMP NOT NULL,
  claimed_by_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bounty contributions (multiple players can add to same target)
CREATE TABLE IF NOT EXISTS bounty_contributions (
  id SERIAL PRIMARY KEY,
  bounty_id INTEGER REFERENCES bounties(id) ON DELETE CASCADE,
  contributor_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hitmen NPCs
CREATE TABLE IF NOT EXISTS hitmen (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  skill_level INTEGER DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 5),
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  success_rate INTEGER DEFAULT 50,
  price_multiplier DECIMAL(3,2) DEFAULT 1.0,
  min_bounty_amount INTEGER DEFAULT 5000,
  icon VARCHAR(10) DEFAULT '🎯',
  is_active BOOLEAN DEFAULT true
);

-- Hitman attempts on players
CREATE TABLE IF NOT EXISTS hitman_attempts (
  id SERIAL PRIMARY KEY,
  hitman_id INTEGER REFERENCES hitmen(id) ON DELETE SET NULL,
  target_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  bounty_id INTEGER REFERENCES bounties(id) ON DELETE SET NULL,
  was_successful BOOLEAN,
  damage_dealt INTEGER DEFAULT 0,
  cash_taken INTEGER DEFAULT 0,
  target_survived BOOLEAN,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bodyguards (protection from hitmen)
CREATE TABLE IF NOT EXISTS player_bodyguards (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  bodyguard_type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  protection_level INTEGER DEFAULT 1,
  daily_cost INTEGER NOT NULL,
  hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(player_id, bodyguard_type)
);

-- Injuries
CREATE TABLE IF NOT EXISTS injuries (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  injury_type VARCHAR(50) NOT NULL,
  injury_name VARCHAR(100) NOT NULL,
  severity INTEGER DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
  effects JSONB DEFAULT '{}',
  source VARCHAR(50),
  source_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  heals_at TIMESTAMP NOT NULL,
  is_healed BOOLEAN DEFAULT false,
  healed_by VARCHAR(50)
);

-- Injury types reference
CREATE TABLE IF NOT EXISTS injury_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type_code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  severity INTEGER DEFAULT 1,
  base_heal_minutes INTEGER NOT NULL,
  effects JSONB DEFAULT '{}',
  icon VARCHAR(10) DEFAULT '🩹'
);

-- Hospital services
CREATE TABLE IF NOT EXISTS hospital_services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  service_type VARCHAR(50) NOT NULL,
  base_cost INTEGER NOT NULL,
  heal_time_reduction INTEGER DEFAULT 50, -- percentage reduction
  min_severity INTEGER DEFAULT 1,
  max_severity INTEGER DEFAULT 5,
  is_legal BOOLEAN DEFAULT true,
  requires_level INTEGER DEFAULT 1,
  icon VARCHAR(10) DEFAULT '🏥'
);

-- Safe zones (no PvP areas)
CREATE TABLE IF NOT EXISTS safe_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  zone_type VARCHAR(50) NOT NULL,
  district_id INTEGER,
  poi_id INTEGER,
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Combat buffs/debuffs
CREATE TABLE IF NOT EXISTS player_combat_buffs (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  buff_type VARCHAR(50) NOT NULL,
  buff_name VARCHAR(100) NOT NULL,
  stat_modifiers JSONB DEFAULT '{}',
  source VARCHAR(50),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Kill tracking (for auto-bounties)
CREATE TABLE IF NOT EXISTS player_kill_log (
  id SERIAL PRIMARY KEY,
  killer_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  victim_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  district_id INTEGER,
  was_bounty_kill BOOLEAN DEFAULT false,
  killed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_combat_sessions_attacker ON combat_sessions(attacker_id);
CREATE INDEX IF NOT EXISTS idx_combat_sessions_defender ON combat_sessions(defender_id);
CREATE INDEX IF NOT EXISTS idx_combat_sessions_status ON combat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_player_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounties_expires ON bounties(expires_at);
CREATE INDEX IF NOT EXISTS idx_injuries_player ON injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_injuries_heals ON injuries(heals_at);
CREATE INDEX IF NOT EXISTS idx_combat_cooldowns_attacker ON combat_cooldowns(attacker_id);
CREATE INDEX IF NOT EXISTS idx_player_kill_log_killer ON player_kill_log(killer_id);
CREATE INDEX IF NOT EXISTS idx_player_kill_log_time ON player_kill_log(killed_at);
