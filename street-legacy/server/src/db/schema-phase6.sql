-- =====================================================
-- PHASE 6: ALWAYS-AVAILABLE MISSIONS AND MICRO-ECONOMY
-- =====================================================

-- =====================================================
-- POINTS OF INTEREST (POI) SYSTEM
-- =====================================================

-- POI table for NPC locations
CREATE TABLE IF NOT EXISTS points_of_interest (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('bar', 'garage', 'clinic', 'office', 'warehouse', 'market', 'club', 'street_corner', 'docks', 'safehouse')),
  description TEXT,
  UNIQUE(district_id, name)
);

-- =====================================================
-- NPC CONTACT SYSTEM
-- =====================================================

-- NPCs table
CREATE TABLE IF NOT EXISTS npcs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('fixer', 'fence', 'informant', 'supplier', 'lawyer', 'doctor')),
  district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
  poi_id INTEGER REFERENCES points_of_interest(id) ON DELETE SET NULL,
  trust_level_required INTEGER NOT NULL DEFAULT 0,
  dialogue JSONB NOT NULL DEFAULT '{}',
  available_missions JSONB NOT NULL DEFAULT '[]',
  schedule JSONB DEFAULT '{"days": [0,1,2,3,4,5,6], "hours_start": 0, "hours_end": 24}',
  avatar_emoji VARCHAR(10) DEFAULT '👤',
  description TEXT,
  cut_percentage INTEGER DEFAULT 10 CHECK (cut_percentage >= 0 AND cut_percentage <= 50)
);

-- NPC relationships with players
CREATE TABLE IF NOT EXISTS npc_relationships (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  trust INTEGER NOT NULL DEFAULT 0 CHECK (trust >= 0 AND trust <= 100),
  missions_completed INTEGER NOT NULL DEFAULT 0,
  missions_failed INTEGER NOT NULL DEFAULT 0,
  gifts_given INTEGER NOT NULL DEFAULT 0,
  last_interaction TIMESTAMP,
  notes JSONB DEFAULT '[]',
  UNIQUE(player_id, npc_id)
);

-- =====================================================
-- EXPANDED MISSION SYSTEM
-- =====================================================

-- Mission categories table
CREATE TABLE IF NOT EXISTS mission_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(10) DEFAULT '📋',
  refresh_type VARCHAR(20) NOT NULL CHECK (refresh_type IN ('always', 'daily', 'hourly', 'weekly', 'one_time', 'random'))
);

-- NPC missions (infinite scaling difficulty)
CREATE TABLE IF NOT EXISTS npc_missions (
  id SERIAL PRIMARY KEY,
  npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  dialogue_intro TEXT,
  dialogue_success TEXT,
  dialogue_failure TEXT,
  mission_type VARCHAR(30) NOT NULL CHECK (mission_type IN ('crime', 'delivery', 'collect', 'intimidate', 'steal', 'escort', 'investigate', 'sabotage')),

  -- Requirements
  min_level INTEGER NOT NULL DEFAULT 1,
  min_trust INTEGER NOT NULL DEFAULT 0,
  required_district_id INTEGER REFERENCES districts(id),

  -- Costs
  stamina_cost INTEGER NOT NULL DEFAULT 10,
  focus_cost INTEGER NOT NULL DEFAULT 10,
  time_minutes INTEGER NOT NULL DEFAULT 30,

  -- Success/Failure
  base_success_rate INTEGER NOT NULL DEFAULT 50 CHECK (base_success_rate >= 1 AND base_success_rate <= 100),
  difficulty_scaling DECIMAL(3,2) DEFAULT 1.0,

  -- Rewards (scaled by difficulty)
  base_cash_reward INTEGER NOT NULL DEFAULT 500,
  base_xp_reward INTEGER NOT NULL DEFAULT 100,
  trust_reward INTEGER NOT NULL DEFAULT 5,
  influence_reward INTEGER NOT NULL DEFAULT 0,

  -- Penalties
  trust_penalty INTEGER NOT NULL DEFAULT 10,
  heat_generated INTEGER NOT NULL DEFAULT 10,
  jail_minutes INTEGER NOT NULL DEFAULT 15,

  -- Availability
  is_repeatable BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_hours INTEGER DEFAULT 24,
  available_start_hour INTEGER DEFAULT 0,
  available_end_hour INTEGER DEFAULT 24
);

-- Daily contracts (5 new missions every day)
CREATE TABLE IF NOT EXISTS daily_contracts (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mission_data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(date)
);

-- Player daily contract progress
CREATE TABLE IF NOT EXISTS player_daily_contracts (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  contract_date DATE NOT NULL,
  contract_index INTEGER NOT NULL CHECK (contract_index >= 0 AND contract_index < 5),
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(player_id, contract_date, contract_index)
);

-- Hourly tasks (quick actions refresh every hour)
CREATE TABLE IF NOT EXISTS hourly_tasks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  task_type VARCHAR(30) NOT NULL CHECK (task_type IN ('quick_crime', 'delivery', 'errand', 'scout', 'message')),
  stamina_cost INTEGER NOT NULL DEFAULT 5,
  focus_cost INTEGER NOT NULL DEFAULT 5,
  time_minutes INTEGER NOT NULL DEFAULT 5,
  base_cash_reward INTEGER NOT NULL DEFAULT 100,
  base_xp_reward INTEGER NOT NULL DEFAULT 25,
  min_level INTEGER NOT NULL DEFAULT 1
);

-- Player hourly task tracking
CREATE TABLE IF NOT EXISTS player_hourly_tasks (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  task_ids JSONB NOT NULL DEFAULT '[]',
  completed_ids JSONB NOT NULL DEFAULT '[]',
  refreshes_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(player_id)
);

-- Random encounter definitions
CREATE TABLE IF NOT EXISTS random_encounters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  encounter_type VARCHAR(30) NOT NULL CHECK (encounter_type IN ('opportunity', 'danger', 'npc_meeting', 'loot', 'ambush', 'tip')),
  trigger_chance DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  trigger_context VARCHAR(30) CHECK (trigger_context IN ('travel', 'crime', 'idle', 'any')),
  district_id INTEGER REFERENCES districts(id),
  min_level INTEGER NOT NULL DEFAULT 1,
  max_level INTEGER,
  choices JSONB NOT NULL DEFAULT '[]',
  outcomes JSONB NOT NULL DEFAULT '{}'
);

-- Player encounter log
CREATE TABLE IF NOT EXISTS player_encounters (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  encounter_id INTEGER NOT NULL REFERENCES random_encounters(id) ON DELETE CASCADE,
  choice_made VARCHAR(50),
  outcome VARCHAR(50),
  rewards_gained JSONB,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Crew assignment missions
CREATE TABLE IF NOT EXISTS crew_assignments (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  assigned_by INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES players(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  mission_type VARCHAR(30) NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 1,
  progress INTEGER NOT NULL DEFAULT 0,

  -- Rewards
  cash_reward INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  rep_reward INTEGER NOT NULL DEFAULT 0,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- =====================================================
-- REGENERATION MISSIONS SYSTEM
-- =====================================================

-- Regeneration activities
CREATE TABLE IF NOT EXISTS regen_activities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN ('stamina', 'focus', 'heat', 'influence')),

  -- What it recovers/reduces
  stamina_regen INTEGER DEFAULT 0,
  focus_regen INTEGER DEFAULT 0,
  heat_reduction INTEGER DEFAULT 0,
  influence_gain INTEGER DEFAULT 0,

  -- Costs
  time_minutes INTEGER NOT NULL DEFAULT 30,
  cash_cost INTEGER NOT NULL DEFAULT 0,

  -- Requirements
  min_level INTEGER NOT NULL DEFAULT 1,
  required_property_type VARCHAR(30),
  required_poi_type VARCHAR(30),

  -- Availability
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  available_hours_start INTEGER DEFAULT 0,
  available_hours_end INTEGER DEFAULT 24
);

-- Player regen activity log/cooldowns
CREATE TABLE IF NOT EXISTS player_regen_cooldowns (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES regen_activities(id) ON DELETE CASCADE,
  available_at TIMESTAMP NOT NULL,
  UNIQUE(player_id, activity_id)
);

-- =====================================================
-- MICRO-ECONOMY SYSTEM
-- =====================================================

-- Payment tiers
CREATE TABLE IF NOT EXISTS payment_tiers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  tier_type VARCHAR(20) NOT NULL CHECK (tier_type IN ('penny', 'nickel', 'dollar')),
  min_usd DECIMAL(6,2) NOT NULL,
  max_usd DECIMAL(6,2) NOT NULL,
  tokens_min INTEGER NOT NULL,
  tokens_max INTEGER NOT NULL,
  description TEXT
);

-- Token packages for purchase
CREATE TABLE IF NOT EXISTS token_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tokens INTEGER NOT NULL,
  price_usd DECIMAL(6,2) NOT NULL,
  bonus_tokens INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_price_id VARCHAR(100)
);

-- Token purchase history
CREATE TABLE IF NOT EXISTS token_purchases (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES token_packages(id),
  tokens_purchased INTEGER NOT NULL,
  amount_usd DECIMAL(6,2) NOT NULL,
  stripe_payment_id VARCHAR(100),
  stripe_session_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Token spend log
CREATE TABLE IF NOT EXISTS token_spend_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tokens_spent INTEGER NOT NULL,
  spend_type VARCHAR(50) NOT NULL,
  item_id INTEGER,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Spending safeguards/limits
CREATE TABLE IF NOT EXISTS player_spend_limits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  daily_limit_usd DECIMAL(6,2) NOT NULL DEFAULT 5.00,
  weekly_limit_usd DECIMAL(6,2) NOT NULL DEFAULT 20.00,
  daily_spent_usd DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  weekly_spent_usd DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  total_spent_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  last_daily_reset TIMESTAMP NOT NULL DEFAULT NOW(),
  last_weekly_reset TIMESTAMP NOT NULL DEFAULT NOW(),
  cooling_off_until TIMESTAMP,
  verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Token skip/instant actions
CREATE TABLE IF NOT EXISTS token_actions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('skip_wait', 'instant_travel', 'refresh', 'cosmetic', 'expand_cap', 'boost')),
  token_cost INTEGER NOT NULL,
  effect_value INTEGER,
  effect_type VARCHAR(50),
  max_daily_uses INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Player token action usage
CREATE TABLE IF NOT EXISTS player_token_actions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action_id INTEGER NOT NULL REFERENCES token_actions(id) ON DELETE CASCADE,
  daily_uses INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(player_id, action_id)
);

-- =====================================================
-- CAPACITY EXPANSION SYSTEM
-- =====================================================

-- Expansion types
CREATE TABLE IF NOT EXISTS capacity_expansions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  expansion_type VARCHAR(30) NOT NULL CHECK (expansion_type IN ('stamina_max', 'focus_max', 'influence_max', 'inventory_slots')),

  -- Gameplay path
  mission_chain_name VARCHAR(100),
  mission_chain_stages INTEGER DEFAULT 5,
  expansion_per_stage INTEGER NOT NULL DEFAULT 5,

  -- Purchase path
  token_cost INTEGER,
  max_purchases INTEGER NOT NULL DEFAULT 3,
  expansion_per_purchase INTEGER NOT NULL DEFAULT 5,

  -- Limits
  max_total_expansion INTEGER NOT NULL DEFAULT 50
);

-- Player expansion progress
CREATE TABLE IF NOT EXISTS player_expansions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expansion_id INTEGER NOT NULL REFERENCES capacity_expansions(id) ON DELETE CASCADE,
  missions_completed INTEGER NOT NULL DEFAULT 0,
  tokens_purchased INTEGER NOT NULL DEFAULT 0,
  total_expansion INTEGER NOT NULL DEFAULT 0,
  UNIQUE(player_id, expansion_id)
);

-- =====================================================
-- INDEXES FOR PHASE 6
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_npcs_district ON npcs(district_id);
CREATE INDEX IF NOT EXISTS idx_npcs_type ON npcs(type);
CREATE INDEX IF NOT EXISTS idx_npc_relationships_player ON npc_relationships(player_id);
CREATE INDEX IF NOT EXISTS idx_npc_relationships_trust ON npc_relationships(npc_id, trust);
CREATE INDEX IF NOT EXISTS idx_npc_missions_npc ON npc_missions(npc_id);
CREATE INDEX IF NOT EXISTS idx_daily_contracts_date ON daily_contracts(date);
CREATE INDEX IF NOT EXISTS idx_player_daily_contracts ON player_daily_contracts(player_id, contract_date);
CREATE INDEX IF NOT EXISTS idx_player_hourly_tasks ON player_hourly_tasks(player_id, refreshes_at);
CREATE INDEX IF NOT EXISTS idx_random_encounters_trigger ON random_encounters(trigger_context, trigger_chance);
CREATE INDEX IF NOT EXISTS idx_player_encounters ON player_encounters(player_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_crew ON crew_assignments(crew_id, status);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_player ON crew_assignments(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_regen_activities_type ON regen_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_player_regen_cooldowns ON player_regen_cooldowns(player_id, available_at);
CREATE INDEX IF NOT EXISTS idx_token_purchases_player ON token_purchases(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_spend_log_player ON token_spend_log(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_spend_limits ON player_spend_limits(player_id);
CREATE INDEX IF NOT EXISTS idx_player_token_actions ON player_token_actions(player_id, action_id);
CREATE INDEX IF NOT EXISTS idx_player_expansions ON player_expansions(player_id);
CREATE INDEX IF NOT EXISTS idx_poi_district ON points_of_interest(district_id);
