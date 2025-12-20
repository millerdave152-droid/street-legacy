-- Phase 5: Nuclear Cells Energy System
-- Street Legacy 2091 - Replace stamina/energy with Nuclear Cells

-- ============================================
-- 5.1: ADD NUCLEAR CELLS TO PLAYERS
-- ============================================

-- Add new nuclear cell columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS nuclear_cells INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS nuclear_cells_max INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_cell_regen TIMESTAMP DEFAULT NOW();
ALTER TABLE players ADD COLUMN IF NOT EXISTS reactor_level INTEGER DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS reactor_efficiency DECIMAL(3,2) DEFAULT 1.00;

-- Add stamina columns if they don't exist (for backwards compatibility)
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_max INTEGER DEFAULT 100;

-- ============================================
-- 5.2: REACTOR SYSTEM
-- ============================================

-- Player reactor configurations
CREATE TABLE IF NOT EXISTS player_reactors (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  reactor_type VARCHAR(50) DEFAULT 'basic' CHECK (reactor_type IN ('basic', 'standard', 'advanced', 'fusion', 'quantum')),
  reactor_name VARCHAR(100) DEFAULT 'Basic Cell Generator',
  max_capacity INTEGER DEFAULT 100,
  regen_rate INTEGER DEFAULT 1,  -- cells per regen tick
  regen_interval_seconds INTEGER DEFAULT 60,  -- seconds between regen ticks
  efficiency_bonus DECIMAL(3,2) DEFAULT 0.00,  -- reduces cell cost by this %
  is_overclocked BOOLEAN DEFAULT false,
  overclock_expires_at TIMESTAMP,
  installed_at TIMESTAMP DEFAULT NOW(),
  last_maintenance TIMESTAMP DEFAULT NOW(),
  condition_percent INTEGER DEFAULT 100 CHECK (condition_percent >= 0 AND condition_percent <= 100)
);

-- Reactor upgrades/types available
CREATE TABLE IF NOT EXISTS reactor_types (
  id SERIAL PRIMARY KEY,
  type_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_capacity INTEGER NOT NULL,
  base_regen_rate INTEGER NOT NULL,
  regen_interval_seconds INTEGER NOT NULL,
  efficiency_bonus DECIMAL(3,2) DEFAULT 0.00,
  purchase_price INTEGER NOT NULL,
  min_level INTEGER DEFAULT 1,
  min_faction_rank VARCHAR(30),
  faction_required VARCHAR(10),  -- NNB, FFN, HNC, LST
  icon VARCHAR(10) DEFAULT '⚡'
);

-- Seed reactor types
INSERT INTO reactor_types (type_key, name, description, max_capacity, base_regen_rate, regen_interval_seconds, efficiency_bonus, purchase_price, min_level, min_faction_rank, faction_required, icon) VALUES
('basic', 'Basic Cell Generator', 'Salvaged tech that barely keeps the lights on. Standard issue for newcomers.', 100, 1, 60, 0.00, 0, 1, NULL, NULL, '🔋'),
('standard', 'Standard Reactor Core', 'Reliable HNC-approved power unit. Nothing fancy, but it works.', 150, 2, 55, 0.05, 25000, 10, NULL, NULL, '⚡'),
('advanced', 'Advanced Power Cell', 'Military-grade reactor salvaged from the Collapse. High output.', 200, 3, 50, 0.10, 75000, 20, 'associate', NULL, '💡'),
('fusion', 'Micro-Fusion Reactor', 'FFN special. Experimental but powerful. May cause mild radiation.', 250, 4, 45, 0.15, 200000, 30, 'member', 'FFN', '☢️'),
('quantum', 'Quantum Flux Generator', 'The rarest reactor type. Rumored to tap into parallel dimensions for power.', 300, 5, 40, 0.25, 500000, 40, 'trusted', NULL, '✨')
ON CONFLICT (type_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_capacity = EXCLUDED.max_capacity,
  base_regen_rate = EXCLUDED.base_regen_rate,
  regen_interval_seconds = EXCLUDED.regen_interval_seconds,
  efficiency_bonus = EXCLUDED.efficiency_bonus,
  purchase_price = EXCLUDED.purchase_price;

-- ============================================
-- 5.3: ACTION CELL COSTS (High-Risk Actions)
-- ============================================

-- Cell costs for different action types
CREATE TABLE IF NOT EXISTS action_cell_costs (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL UNIQUE,
  action_category VARCHAR(30) NOT NULL CHECK (action_category IN ('crime', 'job', 'combat', 'heist', 'faction', 'territory', 'travel', 'special')),
  base_cost INTEGER NOT NULL DEFAULT 0,
  is_high_risk BOOLEAN DEFAULT false,  -- High-risk actions REQUIRE cells
  description TEXT,
  icon VARCHAR(10)
);

-- Seed action costs - ONLY high-risk actions require cells
INSERT INTO action_cell_costs (action_type, action_category, base_cost, is_high_risk, description, icon) VALUES
-- Crimes (basic crimes are free, advanced cost cells)
('petty_theft', 'crime', 0, false, 'Low-risk petty crimes are free', '🔓'),
('pickpocket', 'crime', 0, false, 'Basic pickpocketing requires no cells', '👛'),
('burglary', 'crime', 5, true, 'Breaking and entering requires power', '🏠'),
('armed_robbery', 'crime', 10, true, 'Armed operations need serious juice', '🔫'),
('bank_heist', 'crime', 25, true, 'Major heists drain significant power', '🏦'),
('corporate_hack', 'crime', 15, true, 'Hacking HydraNet requires stable power', '💻'),

-- Jobs (most jobs are free, high-paying ones cost cells)
('basic_job', 'job', 0, false, 'Grunt work doesn''t need tech', '💼'),
('skilled_job', 'job', 3, false, 'Skilled work uses some power', '🔧'),
('specialist_job', 'job', 8, true, 'Specialist operations need juice', '⚙️'),

-- Combat (PvP and faction combat)
('pvp_attack', 'combat', 10, true, 'Attacking another player', '⚔️'),
('pvp_defend', 'combat', 0, false, 'Defending is free', '🛡️'),
('npc_combat', 'combat', 5, false, 'Fighting NPCs uses some power', '👊'),
('boss_fight', 'combat', 20, true, 'Boss battles are intense', '💀'),

-- Heists
('heist_plan', 'heist', 5, false, 'Planning phase', '📋'),
('heist_execute', 'heist', 30, true, 'Executing heist requires full power', '🎯'),
('heist_escape', 'heist', 15, true, 'Escape sequence', '🚗'),

-- Faction activities
('faction_mission', 'faction', 10, true, 'Faction missions need dedication', '🏴'),
('territory_attack', 'territory', 20, true, 'Attacking territory is resource-intensive', '⚔️'),
('territory_defend', 'territory', 10, true, 'Defending your turf', '🏰'),
('diplomacy', 'faction', 5, false, 'Political maneuvering', '🤝'),

-- Travel (long-distance or dangerous travel)
('local_travel', 'travel', 0, false, 'Moving around your sector', '🚶'),
('sector_travel', 'travel', 5, false, 'Traveling between sectors', '🚗'),
('blackout_travel', 'travel', 15, true, 'Entering blackout zones', '🌑'),

-- Special
('overclock', 'special', 0, false, 'Temporarily boost reactor', '⚡'),
('emergency_evac', 'special', 50, true, 'Emergency escape from bad situation', '🆘')
ON CONFLICT (action_type) DO UPDATE SET
  base_cost = EXCLUDED.base_cost,
  is_high_risk = EXCLUDED.is_high_risk;

-- ============================================
-- 5.4: CELL REGENERATION TRACKING
-- ============================================

-- Track cell regeneration history (for analytics)
CREATE TABLE IF NOT EXISTS cell_regen_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  regen_type VARCHAR(30) NOT NULL CHECK (regen_type IN ('passive', 'reactor', 'item', 'purchase', 'faction', 'event')),
  amount INTEGER NOT NULL,
  source VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cell_regen_player ON cell_regen_log(player_id);
CREATE INDEX IF NOT EXISTS idx_cell_regen_timestamp ON cell_regen_log(timestamp);

-- ============================================
-- 5.5: PREMIUM CELL PURCHASES (Non-P2W)
-- ============================================

-- Cell packs available for purchase
CREATE TABLE IF NOT EXISTS cell_packs (
  id SERIAL PRIMARY KEY,
  pack_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cell_amount INTEGER NOT NULL,
  price_credits INTEGER NOT NULL,  -- In-game credits
  price_tokens INTEGER DEFAULT 0,   -- Premium tokens (optional)
  bonus_cells INTEGER DEFAULT 0,    -- Extra cells for bundles
  cooldown_hours INTEGER DEFAULT 0, -- Per-player purchase cooldown
  daily_limit INTEGER DEFAULT 0,    -- 0 = unlimited
  is_premium BOOLEAN DEFAULT false, -- Premium shop item
  min_level INTEGER DEFAULT 1,
  icon VARCHAR(10) DEFAULT '🔋'
);

-- Seed cell packs (balanced for non-P2W)
INSERT INTO cell_packs (pack_key, name, description, cell_amount, price_credits, price_tokens, bonus_cells, cooldown_hours, daily_limit, is_premium, min_level, icon) VALUES
-- Credit purchases (grindable)
('cell_small', 'Cell Pack (Small)', 'A modest recharge for your reactor.', 25, 5000, 0, 0, 1, 10, false, 1, '🔋'),
('cell_medium', 'Cell Pack (Medium)', 'Standard energy refill.', 50, 9000, 0, 5, 2, 5, false, 5, '🔋'),
('cell_large', 'Cell Pack (Large)', 'Substantial power boost.', 100, 16000, 0, 15, 4, 3, false, 10, '⚡'),
('cell_mega', 'Cell Pack (Mega)', 'Major energy infusion.', 200, 30000, 0, 40, 8, 2, false, 20, '⚡'),

-- Token purchases (premium, but NOT better value than grinding)
('cell_premium_small', 'Premium Cell Pack', 'Quick recharge, no cooldown.', 50, 0, 10, 0, 0, 5, true, 1, '💎'),
('cell_premium_bundle', 'Premium Cell Bundle', 'Convenient energy package.', 150, 0, 25, 10, 0, 3, true, 10, '💎'),

-- Special packs (faction stores, events)
('cell_faction_nnb', 'NNB Organic Cells', 'Sustainably harvested power cells from NNB.', 75, 8000, 0, 10, 6, 2, false, 15, '🌿'),
('cell_faction_ffn', 'FFN Hacked Cells', 'Cracked HNC cells with boosted output.', 80, 7500, 0, 15, 6, 2, false, 15, '👻'),
('cell_faction_hnc', 'HNC Standard Issue', 'Official HydraNet power cells.', 60, 6000, 0, 0, 4, 5, false, 10, '⚡'),
('cell_faction_lst', 'LST Black Market Cells', 'No questions asked.', 90, 10000, 0, 20, 8, 2, false, 20, '🔥')
ON CONFLICT (pack_key) DO UPDATE SET
  cell_amount = EXCLUDED.cell_amount,
  price_credits = EXCLUDED.price_credits,
  price_tokens = EXCLUDED.price_tokens;

-- Track cell purchases
CREATE TABLE IF NOT EXISTS cell_purchases (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  pack_key VARCHAR(50) NOT NULL,
  cells_received INTEGER NOT NULL,
  price_paid_credits INTEGER DEFAULT 0,
  price_paid_tokens INTEGER DEFAULT 0,
  purchased_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cell_purchases_player ON cell_purchases(player_id);
CREATE INDEX IF NOT EXISTS idx_cell_purchases_time ON cell_purchases(purchased_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate passive regen based on reactor
CREATE OR REPLACE FUNCTION calculate_cell_regen(p_player_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_regen INTEGER;
  v_reactor_type VARCHAR(50);
  v_efficiency DECIMAL(3,2);
  v_condition INTEGER;
BEGIN
  SELECT pr.reactor_type, pr.efficiency_bonus, pr.condition_percent
  INTO v_reactor_type, v_efficiency, v_condition
  FROM player_reactors pr
  WHERE pr.player_id = p_player_id;

  IF NOT FOUND THEN
    RETURN 1; -- Default regen
  END IF;

  SELECT rt.base_regen_rate INTO v_regen
  FROM reactor_types rt
  WHERE rt.type_key = v_reactor_type;

  -- Apply condition modifier (at 50% condition, only 75% regen)
  v_regen := v_regen * (0.5 + (v_condition::DECIMAL / 200));

  RETURN GREATEST(1, v_regen);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate action cost with efficiency
CREATE OR REPLACE FUNCTION calculate_action_cost(p_player_id INTEGER, p_action_type VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
  v_base_cost INTEGER;
  v_efficiency DECIMAL(3,2);
  v_final_cost INTEGER;
BEGIN
  SELECT base_cost INTO v_base_cost
  FROM action_cell_costs
  WHERE action_type = p_action_type;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(pr.efficiency_bonus, 0) + COALESCE(rt.efficiency_bonus, 0)
  INTO v_efficiency
  FROM player_reactors pr
  LEFT JOIN reactor_types rt ON pr.reactor_type = rt.type_key
  WHERE pr.player_id = p_player_id;

  IF NOT FOUND THEN
    v_efficiency := 0;
  END IF;

  v_final_cost := GREATEST(0, v_base_cost - ROUND(v_base_cost * v_efficiency));

  RETURN v_final_cost;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_players_nuclear_cells ON players(nuclear_cells);
CREATE INDEX IF NOT EXISTS idx_players_last_regen ON players(last_cell_regen);
CREATE INDEX IF NOT EXISTS idx_player_reactors_type ON player_reactors(reactor_type);
