-- =====================================================
-- STREET LEGACY 2091 - COMBINED MIGRATION SCRIPT
-- Apply this to your Supabase database via SQL Editor
-- =====================================================
-- Contains: Phases 4-7 (2091 Systems)
-- - Phase 4: New Faction System (NNB, FFN, HNC, LST)
-- - Phase 5: Nuclear Cells Energy System
-- - Phase 6: AI Grid & World Events
-- - Phase 7: Monetization & Battle Pass
-- =====================================================

-- ============================================
-- PHASE 4.1: 2091 FACTIONS SCHEMA
-- ============================================

-- Clear old faction data if exists
DELETE FROM faction_war_contributions WHERE TRUE;
DELETE FROM faction_wars WHERE TRUE;
DELETE FROM faction_story_progress WHERE TRUE;
DELETE FROM faction_events WHERE TRUE;
DELETE FROM faction_mission_completions WHERE TRUE;
DELETE FROM active_faction_missions WHERE TRUE;
DELETE FROM faction_missions WHERE TRUE;
DELETE FROM faction_shop_items WHERE TRUE;
DELETE FROM faction_safehouses WHERE TRUE;
DELETE FROM player_faction_rep WHERE TRUE;
DELETE FROM factions WHERE TRUE;

-- Add new columns to factions table
ALTER TABLE factions ADD COLUMN IF NOT EXISTS code VARCHAR(10);
ALTER TABLE factions ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS hydranet_channel VARCHAR(50);
ALTER TABLE factions ADD COLUMN IF NOT EXISTS primary_sector VARCHAR(10);
ALTER TABLE factions ADD COLUMN IF NOT EXISTS resource_type VARCHAR(30);
ALTER TABLE factions ADD COLUMN IF NOT EXISTS control_style VARCHAR(30);
ALTER TABLE factions ADD COLUMN IF NOT EXISTS tech_level INTEGER DEFAULT 5;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';

-- Update faction type enum
ALTER TABLE factions DROP CONSTRAINT IF EXISTS factions_type_check;
ALTER TABLE factions ADD CONSTRAINT factions_type_check
  CHECK (type IN ('gang', 'mafia', 'cartel', 'syndicate', 'corporate', 'government',
                  'tech_collective', 'resistance', 'enforcement', 'underground'));

-- Insert the four 2091 factions
INSERT INTO factions (
  name, code, type, slogan, ideology, background_lore,
  color, icon, hydranet_channel, primary_sector, resource_type, control_style,
  territory_district_ids, power_level, wealth, member_count, tech_level,
  min_level_to_join, is_recruitable, visibility
) VALUES
-- NNB: NEW NORTH BLOC
(
  'New North Bloc', 'NNB', 'resistance',
  'From the ashes, we rise.',
  'Community sovereignty, mutual aid, resistance to corporate control',
  'Born from the collapse of the old welfare state, the New North Bloc emerged from the refugee camps and abandoned housing projects of Northern Toronto. When HydraNet''s corporate surveillance grid failed to reach the northern sectors, communities organized their own networks. NNB runs on barter economies, mesh networks, and old-school street loyalty.',
  '#22c55e', '🌿', 'NNB_COMMUNITY_MESH', 'ON-1', 'organic_goods', 'democratic_council',
  '[1, 2, 3]', 45, 500000, 2500, 3, 3, true, 'semi_hidden'
),
-- FFN: FREE FOLK NETWORK
(
  'Free Folk Network', 'FFN', 'tech_collective',
  'Information wants to be free. So do we.',
  'Digital liberation, decentralization, information anarchism',
  'The Free Folk Network began as a hacker collective in the basements of Old Chinatown, cracking HydraNet''s encryption for fun. After the Corporate Data Monopoly Act of 2085 made independent data storage illegal, FFN became the underground railroad of information.',
  '#3b82f6', '👻', 'FFN_DARKNET_PRIMARY', 'ON-5', 'data', 'mesh_consensus',
  '[5, 6, 12]', 55, 2000000, 800, 9, 8, true, 'hidden'
),
-- HNC: HYDRANET COLLECTIVE
(
  'HydraNet Collective', 'HNC', 'corporate',
  'Connection is compliance. Compliance is peace.',
  'Order through surveillance, prosperity through integration, peace through control',
  'The HydraNet Collective isn''t a faction - it''s THE system. After the Collapse of 2084, the megacorps pooled their surveillance networks into HydraNet, promising to rebuild Toronto''s infrastructure in exchange for total data access. HNC represents the "legitimate" path.',
  '#f59e0b', '⚡', 'HNC_OFFICIAL_BROADCAST', 'ON-0', 'energy_credits', 'corporate_hierarchy',
  '[0, 7, 8, 9]', 90, 50000000, 10000, 10, 5, true, 'public'
),
-- LST: LAST STAND TORONTO
(
  'Last Stand Toronto', 'LST', 'underground',
  'The streets remember what the towers forgot.',
  'Street sovereignty, old codes, survival of the realest',
  'When the corps carved up Toronto, the old criminal organizations didn''t disappear - they evolved. Last Stand Toronto is a coalition of what remains: the Italian families, Jamaican posses, Vietnamese syndicates, and biker clubs. They run the physical underworld.',
  '#ef4444', '🔥', 'LST_NUMBERS_STATION', 'ON-4', 'contraband', 'council_of_nine',
  '[4, 10, 11, 14]', 70, 15000000, 5000, 5, 10, true, 'underground'
);

-- Faction hostilities
UPDATE factions SET hostilities = '{"2": 30, "3": 80, "4": 45}' WHERE code = 'NNB';
UPDATE factions SET hostilities = '{"1": 30, "3": 90, "4": 50}' WHERE code = 'FFN';
UPDATE factions SET hostilities = '{"1": 80, "2": 90, "4": 60}' WHERE code = 'HNC';
UPDATE factions SET hostilities = '{"1": 45, "2": 50, "3": 60}' WHERE code = 'LST';

-- Faction rank constraints
ALTER TABLE player_faction_rep DROP CONSTRAINT IF EXISTS player_faction_rep_rank_check;
ALTER TABLE player_faction_rep ADD CONSTRAINT player_faction_rep_rank_check
  CHECK (rank IN ('outsider', 'contact', 'associate', 'member', 'trusted', 'lieutenant', 'commander', 'council'));

-- Mission types
ALTER TABLE faction_missions DROP CONSTRAINT IF EXISTS faction_missions_mission_type_check;
ALTER TABLE faction_missions ADD CONSTRAINT faction_missions_mission_type_check
  CHECK (mission_type IN (
    'collection', 'enforcement', 'defense', 'expansion', 'war',
    'smuggling', 'recruitment', 'heist', 'assassination', 'sabotage',
    'data_extraction', 'grid_hack', 'supply_run', 'mesh_defense',
    'corporate_infiltration', 'blackout_ops', 'territory_scan',
    'resource_acquisition', 'signal_intercept', 'dead_drop', 'extraction'
  ));

ALTER TABLE faction_missions ADD COLUMN IF NOT EXISTS requires_neural_implant BOOLEAN DEFAULT false;
ALTER TABLE faction_missions ADD COLUMN IF NOT EXISTS hydranet_detection_risk INTEGER DEFAULT 0;
ALTER TABLE faction_missions ADD COLUMN IF NOT EXISTS sector_requirement VARCHAR(10);

-- Faction territories 2091
CREATE TABLE IF NOT EXISTS faction_territories_2091 (
  id SERIAL PRIMARY KEY,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  sector_code VARCHAR(10) NOT NULL,
  control_percentage INTEGER DEFAULT 0 CHECK (control_percentage >= 0 AND control_percentage <= 100),
  contested_by INTEGER REFERENCES factions(id),
  infrastructure_control JSONB DEFAULT '{"power": 0, "water": 0, "data": 0, "transit": 0}',
  notable_locations JSONB DEFAULT '[]',
  daily_income INTEGER DEFAULT 0,
  defense_rating INTEGER DEFAULT 50,
  last_conflict TIMESTAMP,
  established_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faction_territories_sector ON faction_territories_2091(sector_code);
CREATE INDEX IF NOT EXISTS idx_faction_territories_faction ON faction_territories_2091(faction_id);

-- Faction resources
CREATE TABLE IF NOT EXISTS faction_resources (
  id SERIAL PRIMARY KEY,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  quantity INTEGER DEFAULT 0,
  production_rate INTEGER DEFAULT 0,
  consumption_rate INTEGER DEFAULT 0,
  trade_value INTEGER DEFAULT 100,
  is_tradeable BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(faction_id, resource_type)
);

-- Player faction history
CREATE TABLE IF NOT EXISTS player_faction_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  reputation_change INTEGER DEFAULT 0,
  old_rank VARCHAR(30),
  new_rank VARCHAR(30),
  description TEXT,
  related_mission_id INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faction_history_player ON player_faction_history(player_id);
CREATE INDEX IF NOT EXISTS idx_faction_history_faction ON player_faction_history(faction_id);
CREATE INDEX IF NOT EXISTS idx_factions_code ON factions(code);
CREATE INDEX IF NOT EXISTS idx_factions_type ON factions(type);
CREATE INDEX IF NOT EXISTS idx_factions_primary_sector ON factions(primary_sector);

-- ============================================
-- PHASE 4.2: 2091 FACTIONS SEED DATA
-- ============================================

-- NNB Missions
INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'NNB'),
  'Community Harvest', 'The hydroponic bay needs organic supplies. Raid the abandoned greenhouse in ON-2 before HNC drones spot you.',
  'supply_run', 'contact', 0, 30, 800, 60,
  '[{"type": "travel_to", "sector": "ON-2"}, {"type": "collect_resources", "item": "organic_supplies", "amount": 5}, {"type": "return_to_safehouse"}]',
  45, 1, 15, true, 1, '🌱'),
((SELECT id FROM factions WHERE code = 'NNB'),
  'Mesh Node Setup', 'Install a new mesh relay on the water tower in ON-3.',
  'mesh_defense', 'associate', 100, 50, 1500, 100,
  '[{"type": "acquire_equipment", "item": "mesh_relay"}, {"type": "install_at_location", "location": "water_tower_on3"}, {"type": "verify_signal"}]',
  60, 2, 25, false, NULL, '📡'),
((SELECT id FROM factions WHERE code = 'NNB'),
  'Food Depot Liberation', 'HNC hoards food while the north starves. Time to redistribute.',
  'heist', 'member', 300, 100, 5000, 200,
  '[{"type": "scout_location"}, {"type": "disable_surveillance"}, {"type": "steal_supplies", "min_amount": 1000}, {"type": "escape_sector"}]',
  90, 3, 60, true, 2, '📦');

-- FFN Missions
INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  requires_neural_implant, is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'FFN'),
  'Dead Drop Protocol', 'Encrypted package at the old library. Retrieve it before HNC sweepers find it.',
  'dead_drop', 'contact', 0, 25, 1000, 50,
  '[{"type": "locate_dead_drop"}, {"type": "decrypt_package"}, {"type": "deliver_to_contact"}]',
  30, 1, 30, false, true, 1, '📧'),
((SELECT id FROM factions WHERE code = 'FFN'),
  'Signal Pirate', 'Intercept HydraNet traffic between ON-0 and ON-7.',
  'signal_intercept', 'associate', 150, 75, 3000, 150,
  '[{"type": "position_at_relay"}, {"type": "deploy_interceptor"}, {"type": "capture_packets", "min_count": 100}, {"type": "extract_cleanly"}]',
  60, 3, 55, true, false, NULL, '📶'),
((SELECT id FROM factions WHERE code = 'FFN'),
  'Ghost Protocol', 'Create a fake identity in HydraNet''s citizen database.',
  'grid_hack', 'member', 400, 100, 8000, 250,
  '[{"type": "access_hydranet_terminal"}, {"type": "bypass_security_layers", "count": 3}, {"type": "create_identity"}, {"type": "wipe_traces"}]',
  90, 4, 75, true, true, 2, '👻');

-- HNC Missions
INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  requires_neural_implant, is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'HNC'),
  'Compliance Check', 'Citizen in ON-4 has been flagged for suspicious behavior. Verify their activities.',
  'territory_scan', 'contact', 0, 20, 1500, 40,
  '[{"type": "travel_to_sector", "sector": "ON-4"}, {"type": "locate_target"}, {"type": "scan_activities"}, {"type": "submit_report"}]',
  30, 1, 0, true, true, 1, '📋'),
((SELECT id FROM factions WHERE code = 'HNC'),
  'Network Enforcement', 'Unauthorized mesh node detected in ON-3. Locate and disable.',
  'enforcement', 'associate', 100, 40, 4000, 120,
  '[{"type": "trace_signal"}, {"type": "locate_node"}, {"type": "disable_hardware"}, {"type": "identify_operators"}]',
  60, 2, 0, true, false, NULL, '🔌'),
((SELECT id FROM factions WHERE code = 'HNC'),
  'Corporate Extraction', 'Defector in FFN territory has intel we need. Extract them to ON-0.',
  'extraction', 'member', 350, 80, 10000, 250,
  '[{"type": "infiltrate_ffn_territory"}, {"type": "locate_defector"}, {"type": "extract_safely"}, {"type": "deliver_to_sterling"}]',
  120, 4, 10, false, true, 2, '🎯');

-- LST Missions
INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'LST'),
  'Package Run', 'Deliver this package to the address. Don''t open it. Don''t ask questions.',
  'smuggling', 'contact', 0, 25, 1200, 50,
  '[{"type": "pickup_package"}, {"type": "avoid_checkpoints"}, {"type": "deliver_package"}, {"type": "collect_payment"}]',
  30, 1, 20, true, 1, '📦'),
((SELECT id FROM factions WHERE code = 'LST'),
  'Debt Collection', 'Someone owes the families. They think HydraNet will protect them.',
  'collection', 'associate', 100, 50, 3000, 100,
  '[{"type": "locate_debtor"}, {"type": "avoid_surveillance"}, {"type": "persuade_payment"}, {"type": "return_funds"}]',
  60, 2, 35, false, NULL, '💳'),
((SELECT id FROM factions WHERE code = 'LST'),
  'The Old Way', 'Traitor in our ranks. Council wants it handled quiet.',
  'assassination', 'member', 400, 100, 8000, 250,
  '[{"type": "identify_traitor"}, {"type": "isolate_target"}, {"type": "eliminate_quietly"}, {"type": "dispose_evidence"}]',
  120, 4, 15, true, 2, '🔪');

-- Faction shop items
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
((SELECT id FROM factions WHERE code = 'NNB'), 'consumable', 'Organic Stims', 'Home-grown stimulants. +20 energy.', 500, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'NNB'), 'equipment', 'Mesh Transponder', 'Access NNB''s off-grid network.', 2500, 'associate', 150, 8),
((SELECT id FROM factions WHERE code = 'FFN'), 'tool', 'Burner Identity', 'Disposable HydraNet ID. 24 hour use.', 3000, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'FFN'), 'tool', 'ICE Breaker v3.2', '+25% success on grid hacks.', 15000, 'associate', 200, 10),
((SELECT id FROM factions WHERE code = 'HNC'), 'equipment', 'Corporate Neural Link', 'Standard HNC implant. +10% all rewards.', 5000, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'HNC'), 'weapon', 'Enforcer Taser', 'Non-lethal takedowns. Corporate approved.', 8000, 'associate', 150, 8),
((SELECT id FROM factions WHERE code = 'LST'), 'weapon', 'Street Piece', 'Unregistered handgun. No trace.', 5000, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'LST'), 'consumable', 'Combat Chems', 'Black market stims. +25 damage.', 3000, 'associate', 150, 8);

-- Faction safehouses
INSERT INTO faction_safehouses (faction_id, name, district_id, capacity, amenities, heat_reduction, healing_rate, min_rank) VALUES
((SELECT id FROM factions WHERE code = 'NNB'), 'The Greenhouse', 1, 10, '["hydroponic_beds", "mesh_node", "water_purifier"]', 35, 20, 'associate'),
((SELECT id FROM factions WHERE code = 'FFN'), 'Node Zero', 5, 6, '["server_room", "faraday_cage", "neural_chairs"]', 40, 15, 'associate'),
((SELECT id FROM factions WHERE code = 'HNC'), 'Corporate Housing Block 7', 7, 20, '["auto_medical", "gym", "nutrition_dispenser"]', 25, 25, 'contact'),
((SELECT id FROM factions WHERE code = 'LST'), 'The Warehouse', 4, 12, '["stash_room", "weapons_locker", "garage"]', 30, 15, 'associate');

-- Faction wars/tensions
INSERT INTO faction_wars (aggressor_faction_id, defender_faction_id, war_state, aggressor_score, defender_score, territories_contested) VALUES
((SELECT id FROM factions WHERE code = 'HNC'), (SELECT id FROM factions WHERE code = 'FFN'), 'cold_war', 250, 180, '["ON-5", "ON-6"]'),
((SELECT id FROM factions WHERE code = 'HNC'), (SELECT id FROM factions WHERE code = 'NNB'), 'tension', 50, 30, '["ON-1", "ON-2"]'),
((SELECT id FROM factions WHERE code = 'LST'), (SELECT id FROM factions WHERE code = 'HNC'), 'cold_war', 120, 150, '["ON-10", "ON-11"]');

-- Faction territory assignments
INSERT INTO faction_territories_2091 (faction_id, sector_code, control_percentage, infrastructure_control, notable_locations, daily_income, defense_rating) VALUES
((SELECT id FROM factions WHERE code = 'NNB'), 'ON-1', 75, '{"power": 30, "water": 60, "data": 10, "transit": 40}', '["The Greenhouse", "Community Center"]', 5000, 45),
((SELECT id FROM factions WHERE code = 'NNB'), 'ON-2', 60, '{"power": 20, "water": 50, "data": 5, "transit": 30}', '["Northern Markets"]', 3500, 40),
((SELECT id FROM factions WHERE code = 'FFN'), 'ON-5', 65, '{"power": 25, "water": 20, "data": 90, "transit": 15}', '["Node Zero", "Data Bazaar"]', 8000, 55),
((SELECT id FROM factions WHERE code = 'FFN'), 'ON-6', 45, '{"power": 20, "water": 15, "data": 70, "transit": 10}', '["Signal Station"]', 5500, 40),
((SELECT id FROM factions WHERE code = 'HNC'), 'ON-0', 95, '{"power": 100, "water": 100, "data": 100, "transit": 100}', '["Sterling Tower", "Central Grid Hub"]', 50000, 95),
((SELECT id FROM factions WHERE code = 'HNC'), 'ON-7', 85, '{"power": 90, "water": 90, "data": 95, "transit": 85}', '["Financial District"]', 35000, 85),
((SELECT id FROM factions WHERE code = 'LST'), 'ON-4', 70, '{"power": 40, "water": 35, "data": 20, "transit": 50}', '["The Warehouse", "Old Docks"]', 12000, 60),
((SELECT id FROM factions WHERE code = 'LST'), 'ON-10', 65, '{"power": 35, "water": 30, "data": 15, "transit": 45}', '["Smuggler''s Row"]', 10000, 55);

-- Faction resources initial state
INSERT INTO faction_resources (faction_id, resource_type, quantity, production_rate, consumption_rate, trade_value) VALUES
((SELECT id FROM factions WHERE code = 'NNB'), 'organic_goods', 5000, 200, 150, 80),
((SELECT id FROM factions WHERE code = 'NNB'), 'clean_water', 3000, 100, 120, 120),
((SELECT id FROM factions WHERE code = 'FFN'), 'data_packets', 10000, 500, 300, 150),
((SELECT id FROM factions WHERE code = 'FFN'), 'credits', 2000000, 50000, 40000, 1),
((SELECT id FROM factions WHERE code = 'HNC'), 'credits', 50000000, 500000, 300000, 1),
((SELECT id FROM factions WHERE code = 'HNC'), 'nuclear_cells', 50000, 2000, 1500, 150),
((SELECT id FROM factions WHERE code = 'LST'), 'contraband', 8000, 300, 250, 180),
((SELECT id FROM factions WHERE code = 'LST'), 'weapons', 5000, 100, 80, 250);

-- ============================================
-- PHASE 5: NUCLEAR CELLS ENERGY SYSTEM
-- ============================================

-- Add nuclear cells to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS nuclear_cells INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS nuclear_cells_max INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_cell_regen TIMESTAMP DEFAULT NOW();
ALTER TABLE players ADD COLUMN IF NOT EXISTS reactor_level INTEGER DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS reactor_efficiency DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina INTEGER DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_max INTEGER DEFAULT 100;

-- Player reactor configurations
CREATE TABLE IF NOT EXISTS player_reactors (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  reactor_type VARCHAR(50) DEFAULT 'basic' CHECK (reactor_type IN ('basic', 'standard', 'advanced', 'fusion', 'quantum')),
  reactor_name VARCHAR(100) DEFAULT 'Basic Cell Generator',
  max_capacity INTEGER DEFAULT 100,
  regen_rate INTEGER DEFAULT 1,
  regen_interval_seconds INTEGER DEFAULT 60,
  efficiency_bonus DECIMAL(3,2) DEFAULT 0.00,
  is_overclocked BOOLEAN DEFAULT false,
  overclock_expires_at TIMESTAMP,
  installed_at TIMESTAMP DEFAULT NOW(),
  last_maintenance TIMESTAMP DEFAULT NOW(),
  condition_percent INTEGER DEFAULT 100 CHECK (condition_percent >= 0 AND condition_percent <= 100)
);

-- Reactor types
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
  faction_required VARCHAR(10),
  icon VARCHAR(10) DEFAULT '⚡'
);

INSERT INTO reactor_types (type_key, name, description, max_capacity, base_regen_rate, regen_interval_seconds, efficiency_bonus, purchase_price, min_level, min_faction_rank, faction_required, icon) VALUES
('basic', 'Basic Cell Generator', 'Salvaged tech that barely keeps the lights on.', 100, 1, 60, 0.00, 0, 1, NULL, NULL, '🔋'),
('standard', 'Standard Reactor Core', 'Reliable HNC-approved power unit.', 150, 2, 55, 0.05, 25000, 10, NULL, NULL, '⚡'),
('advanced', 'Advanced Power Cell', 'Military-grade reactor salvaged from the Collapse.', 200, 3, 50, 0.10, 75000, 20, 'associate', NULL, '💡'),
('fusion', 'Micro-Fusion Reactor', 'FFN special. Experimental but powerful.', 250, 4, 45, 0.15, 200000, 30, 'member', 'FFN', '☢️'),
('quantum', 'Quantum Flux Generator', 'The rarest reactor type.', 300, 5, 40, 0.25, 500000, 40, 'trusted', NULL, '✨')
ON CONFLICT (type_key) DO UPDATE SET name = EXCLUDED.name;

-- Action cell costs
CREATE TABLE IF NOT EXISTS action_cell_costs (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL UNIQUE,
  action_category VARCHAR(30) NOT NULL CHECK (action_category IN ('crime', 'job', 'combat', 'heist', 'faction', 'territory', 'travel', 'special')),
  base_cost INTEGER NOT NULL DEFAULT 0,
  is_high_risk BOOLEAN DEFAULT false,
  description TEXT,
  icon VARCHAR(10)
);

INSERT INTO action_cell_costs (action_type, action_category, base_cost, is_high_risk, description, icon) VALUES
('petty_theft', 'crime', 0, false, 'Low-risk petty crimes are free', '🔓'),
('pickpocket', 'crime', 0, false, 'Basic pickpocketing requires no cells', '👛'),
('burglary', 'crime', 5, true, 'Breaking and entering requires power', '🏠'),
('armed_robbery', 'crime', 10, true, 'Armed operations need serious juice', '🔫'),
('bank_heist', 'crime', 25, true, 'Major heists drain significant power', '🏦'),
('corporate_hack', 'crime', 15, true, 'Hacking HydraNet requires stable power', '💻'),
('basic_job', 'job', 0, false, 'Grunt work doesn''t need tech', '💼'),
('skilled_job', 'job', 3, false, 'Skilled work uses some power', '🔧'),
('specialist_job', 'job', 8, true, 'Specialist operations need juice', '⚙️'),
('pvp_attack', 'combat', 10, true, 'Attacking another player', '⚔️'),
('pvp_defend', 'combat', 0, false, 'Defending is free', '🛡️'),
('npc_combat', 'combat', 5, false, 'Fighting NPCs uses some power', '👊'),
('boss_fight', 'combat', 20, true, 'Boss battles are intense', '💀'),
('heist_plan', 'heist', 5, false, 'Planning phase', '📋'),
('heist_execute', 'heist', 30, true, 'Executing heist requires full power', '🎯'),
('heist_escape', 'heist', 15, true, 'Escape sequence', '🚗'),
('faction_mission', 'faction', 10, true, 'Faction missions need dedication', '🏴'),
('territory_attack', 'territory', 20, true, 'Attacking territory', '⚔️'),
('territory_defend', 'territory', 10, true, 'Defending your turf', '🏰'),
('local_travel', 'travel', 0, false, 'Moving around your sector', '🚶'),
('sector_travel', 'travel', 5, false, 'Traveling between sectors', '🚗'),
('blackout_travel', 'travel', 15, true, 'Entering blackout zones', '🌑'),
('overclock', 'special', 0, false, 'Temporarily boost reactor', '⚡'),
('emergency_evac', 'special', 50, true, 'Emergency escape', '🆘')
ON CONFLICT (action_type) DO UPDATE SET base_cost = EXCLUDED.base_cost;

-- Cell regen log
CREATE TABLE IF NOT EXISTS cell_regen_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  regen_type VARCHAR(30) NOT NULL CHECK (regen_type IN ('passive', 'reactor', 'item', 'purchase', 'faction', 'event')),
  amount INTEGER NOT NULL,
  source VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cell_regen_player ON cell_regen_log(player_id);

-- Cell packs
CREATE TABLE IF NOT EXISTS cell_packs (
  id SERIAL PRIMARY KEY,
  pack_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cell_amount INTEGER NOT NULL,
  price_credits INTEGER NOT NULL,
  price_tokens INTEGER DEFAULT 0,
  bonus_cells INTEGER DEFAULT 0,
  cooldown_hours INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  min_level INTEGER DEFAULT 1,
  icon VARCHAR(10) DEFAULT '🔋'
);

INSERT INTO cell_packs (pack_key, name, description, cell_amount, price_credits, price_tokens, bonus_cells, cooldown_hours, daily_limit, is_premium, min_level, icon) VALUES
('cell_small', 'Cell Pack (Small)', 'A modest recharge.', 25, 5000, 0, 0, 1, 10, false, 1, '🔋'),
('cell_medium', 'Cell Pack (Medium)', 'Standard refill.', 50, 9000, 0, 5, 2, 5, false, 5, '🔋'),
('cell_large', 'Cell Pack (Large)', 'Substantial boost.', 100, 16000, 0, 15, 4, 3, false, 10, '⚡'),
('cell_mega', 'Cell Pack (Mega)', 'Major infusion.', 200, 30000, 0, 40, 8, 2, false, 20, '⚡')
ON CONFLICT (pack_key) DO UPDATE SET cell_amount = EXCLUDED.cell_amount;

-- Cell purchases
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
CREATE INDEX IF NOT EXISTS idx_players_nuclear_cells ON players(nuclear_cells);

-- ============================================
-- PHASE 6: AI GRID & WORLD EVENTS
-- ============================================

-- Sector surveillance
CREATE TABLE IF NOT EXISTS sector_surveillance (
  id SERIAL PRIMARY KEY,
  sector_code VARCHAR(10) NOT NULL UNIQUE,
  surveillance_level INTEGER DEFAULT 50 CHECK (surveillance_level >= 0 AND surveillance_level <= 100),
  grid_status VARCHAR(20) DEFAULT 'active' CHECK (grid_status IN ('active', 'degraded', 'offline', 'blackout')),
  drone_density INTEGER DEFAULT 5 CHECK (drone_density >= 0 AND drone_density <= 20),
  scanner_coverage DECIMAL(3,2) DEFAULT 0.75,
  hnc_presence INTEGER DEFAULT 50 CHECK (hnc_presence >= 0 AND hnc_presence <= 100),
  last_sweep TIMESTAMP DEFAULT NOW(),
  sweep_interval_minutes INTEGER DEFAULT 30,
  alert_level VARCHAR(20) DEFAULT 'normal' CHECK (alert_level IN ('minimal', 'normal', 'elevated', 'high', 'critical', 'lockdown')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO sector_surveillance (sector_code, surveillance_level, grid_status, drone_density, scanner_coverage, hnc_presence, alert_level) VALUES
('ON-0', 90, 'active', 15, 0.95, 90, 'elevated'),
('ON-1', 85, 'active', 12, 0.90, 85, 'elevated'),
('ON-2', 70, 'active', 8, 0.80, 70, 'normal'),
('ON-3', 60, 'active', 6, 0.70, 60, 'normal'),
('ON-4', 55, 'active', 5, 0.65, 55, 'normal'),
('ON-5', 40, 'degraded', 3, 0.50, 40, 'normal'),
('ON-6', 35, 'degraded', 2, 0.45, 35, 'minimal'),
('ON-7', 50, 'active', 5, 0.60, 50, 'normal'),
('ON-8', 45, 'active', 4, 0.55, 45, 'normal'),
('ON-9', 30, 'degraded', 2, 0.35, 30, 'minimal'),
('ON-10', 25, 'offline', 1, 0.25, 25, 'minimal'),
('ON-11', 15, 'blackout', 0, 0.10, 10, 'minimal'),
('ON-12', 20, 'blackout', 0, 0.15, 15, 'minimal'),
('ON-13', 10, 'blackout', 0, 0.05, 5, 'minimal'),
('ON-14', 80, 'active', 10, 0.85, 80, 'normal')
ON CONFLICT (sector_code) DO UPDATE SET surveillance_level = EXCLUDED.surveillance_level;

-- Player heat
CREATE TABLE IF NOT EXISTS player_heat (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  heat_level INTEGER DEFAULT 0 CHECK (heat_level >= 0 AND heat_level <= 100),
  last_crime_detected TIMESTAMP,
  crimes_in_session INTEGER DEFAULT 0,
  current_sector VARCHAR(10) DEFAULT 'ON-0',
  is_flagged BOOLEAN DEFAULT false,
  flag_reason VARCHAR(200),
  flag_expires_at TIMESTAMP,
  drone_tracking BOOLEAN DEFAULT false,
  last_scan_evaded TIMESTAMP,
  total_scans_evaded INTEGER DEFAULT 0,
  total_detections INTEGER DEFAULT 0,
  bounty_from_hnc INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Grid incidents
CREATE TABLE IF NOT EXISTS grid_incidents (
  id SERIAL PRIMARY KEY,
  incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN (
    'crime_detected', 'scan_evaded', 'pursuit_initiated', 'pursuit_escaped',
    'pursuit_caught', 'grid_hack', 'drone_destroyed', 'blackout_triggered',
    'surveillance_disrupted', 'hnc_patrol', 'checkpoint_encounter', 'identity_scanned'
  )),
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  sector_code VARCHAR(10) NOT NULL,
  severity INTEGER DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
  description TEXT,
  heat_change INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grid_incidents_player ON grid_incidents(player_id);
CREATE INDEX IF NOT EXISTS idx_grid_incidents_sector ON grid_incidents(sector_code);

-- World events 2091
CREATE TABLE IF NOT EXISTS world_events_2091 (
  id SERIAL PRIMARY KEY,
  event_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  lore_text TEXT,
  event_category VARCHAR(30) NOT NULL CHECK (event_category IN (
    'grid', 'faction', 'economic', 'environmental', 'crisis', 'opportunity', 'special'
  )),
  affected_sectors TEXT[],
  effects JSONB NOT NULL,
  requirements JSONB,
  duration_hours INTEGER NOT NULL DEFAULT 2,
  rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  trigger_chance DECIMAL(4,3) DEFAULT 0.100,
  icon VARCHAR(10) DEFAULT '⚡',
  is_positive BOOLEAN DEFAULT true,
  can_participate BOOLEAN DEFAULT true,
  participation_reward JSONB,
  min_participants INTEGER DEFAULT 0,
  max_concurrent INTEGER DEFAULT 1
);

INSERT INTO world_events_2091 (event_key, name, description, lore_text, event_category, affected_sectors, effects, duration_hours, rarity, trigger_chance, icon, is_positive, can_participate, participation_reward) VALUES
('grid_blackout', 'Sector Blackout', 'Grid failure plunges sector into darkness.', 'A cascade failure in the HydraNet power grid has knocked out surveillance.', 'grid', NULL, '{"heatReduction": 50, "surveillanceDisabled": true}', 3, 'uncommon', 0.080, '🌑', true, true, '{"xp": 500, "cash": 2500}'),
('drone_swarm', 'Drone Swarm Deployment', 'HNC deploys emergency surveillance drones.', 'Following a spike in unauthorized activity, HydraNet has deployed its reserve drone fleet.', 'grid', NULL, '{"heatMultiplier": 2.0, "detectionBonus": 30}', 2, 'common', 0.100, '🤖', false, true, '{"xp": 300}'),
('nnb_rally', 'NNB Community Rally', 'New North Bloc organizes public demonstration.', 'The resistance has called a gathering in the harbor.', 'faction', ARRAY['ON-5'], '{"nnbZoneSafe": true, "healingBonus": 50}', 4, 'common', 0.120, '✊', true, true, '{"xp": 400, "reputation_nnb": 15}'),
('ffn_data_drop', 'FFN Data Liberation', 'Free Folk Network is distributing stolen corporate data.', 'Encrypted drives are being handed out in Old Town.', 'faction', ARRAY['ON-6'], '{"dataRewards": true, "ffnMissionBonus": 100}', 3, 'uncommon', 0.080, '💾', true, true, '{"xp": 600, "cash": 5000}'),
('hnc_crackdown', 'HNC Security Sweep', 'HydraNet Collective conducting sector-wide security operation.', 'Checkpoints on every corner. Drones overhead.', 'faction', NULL, '{"heatMultiplier": 1.5, "checkpointsActive": true}', 4, 'common', 0.100, '🔒', false, true, '{"reputation_hnc": 10}'),
('lst_black_market', 'Underground Market Night', 'LST opens exclusive black market trading session.', 'Word spreads through back channels: the Last Stand is holding a market tonight.', 'faction', ARRAY['ON-9'], '{"shopDiscount": 30, "rareItemsAvailable": true}', 6, 'uncommon', 0.070, '🏪', true, true, '{"xp": 500}'),
('credit_surge', 'Credit Market Surge', 'Economic instability causes credit values to spike.', 'The Toronto Stock Exchange AI has gone haywire.', 'economic', NULL, '{"payoutBonus": 40}', 3, 'common', 0.090, '📈', true, false, NULL),
('acid_rain', 'Acid Rain Warning', 'Toxic precipitation. Outdoor activities hazardous.', 'The clouds are that sickly yellow-green again.', 'environmental', NULL, '{"outdoorPenalty": -20, "healthDrain": true}', 2, 'common', 0.100, '☔', false, false, NULL),
('riot_outbreak', 'Civil Unrest', 'Protests have turned violent. Citywide chaos.', 'It started as a peaceful demonstration.', 'crisis', NULL, '{"chaosFactor": 0.5, "factionTensionBonus": 100}', 4, 'rare', 0.030, '🔥', false, true, '{"xp": 1500}'),
('synth_uprising', 'Synthetic Rebellion', 'Rogue androids causing chaos. High bounties available.', 'They were supposed to be tools. Servants.', 'crisis', NULL, '{"bountyBonusMultiplier": 3.0, "androidEnemies": true}', 8, 'legendary', 0.010, '🤖', false, true, '{"xp": 5000, "cash": 50000}')
ON CONFLICT (event_key) DO UPDATE SET name = EXCLUDED.name;

-- Active world events
CREATE TABLE IF NOT EXISTS active_world_events (
  id SERIAL PRIMARY KEY,
  event_key VARCHAR(50) NOT NULL REFERENCES world_events_2091(event_key),
  affected_sectors TEXT[],
  started_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL,
  triggered_by VARCHAR(50),
  trigger_player_id INTEGER REFERENCES players(id),
  participants INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_events_key ON active_world_events(event_key);
CREATE INDEX IF NOT EXISTS idx_active_events_active ON active_world_events(is_active);

-- Event participation
CREATE TABLE IF NOT EXISTS event_participation (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES active_world_events(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  contribution_score INTEGER DEFAULT 0,
  rewards_claimed BOOLEAN DEFAULT false,
  rewards_data JSONB,
  UNIQUE(event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participation_player ON event_participation(player_id);

-- HNC pursuits
CREATE TABLE IF NOT EXISTS hnc_pursuits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  pursuit_level INTEGER DEFAULT 1 CHECK (pursuit_level >= 1 AND pursuit_level <= 5),
  started_at TIMESTAMP DEFAULT NOW(),
  last_spotted_sector VARCHAR(10),
  last_spotted_at TIMESTAMP,
  drones_assigned INTEGER DEFAULT 1,
  enforcers_assigned INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  escaped_at TIMESTAMP,
  caught_at TIMESTAMP,
  escape_method VARCHAR(50),
  penalty_applied JSONB
);

CREATE INDEX IF NOT EXISTS idx_pursuits_player ON hnc_pursuits(player_id);

-- Pursuit levels
CREATE TABLE IF NOT EXISTS pursuit_levels (
  level INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  drones INTEGER NOT NULL,
  enforcers INTEGER NOT NULL,
  escape_difficulty INTEGER NOT NULL,
  heat_required INTEGER NOT NULL,
  penalty_cash_percent INTEGER DEFAULT 0,
  penalty_jail_minutes INTEGER DEFAULT 0,
  icon VARCHAR(10)
);

INSERT INTO pursuit_levels (level, name, description, drones, enforcers, escape_difficulty, heat_required, penalty_cash_percent, penalty_jail_minutes, icon) VALUES
(1, 'Drone Scan', 'A single drone has marked you.', 1, 0, 20, 20, 5, 5, '👁️'),
(2, 'Active Interest', 'Multiple drones tracking. HNC is aware.', 3, 0, 35, 40, 10, 15, '🔍'),
(3, 'Pursuit Initiated', 'Ground units dispatched.', 5, 2, 50, 60, 20, 30, '🚨'),
(4, 'Priority Target', 'Full pursuit team assigned.', 8, 5, 70, 80, 35, 60, '⚠️'),
(5, 'Maximum Response', 'ARIA has flagged you as primary threat.', 15, 10, 90, 100, 50, 120, '💀')
ON CONFLICT (level) DO UPDATE SET name = EXCLUDED.name;

CREATE INDEX IF NOT EXISTS idx_sector_surveillance_level ON sector_surveillance(surveillance_level);
CREATE INDEX IF NOT EXISTS idx_player_heat_level ON player_heat(heat_level);

-- ============================================
-- PHASE 7: MONETIZATION & BATTLE PASS
-- ============================================

-- Premium currencies
ALTER TABLE players ADD COLUMN IF NOT EXISTS synth_credits INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hydra_coins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS lifetime_hydra_coins INTEGER DEFAULT 0;

-- HydraCoin packages
CREATE TABLE IF NOT EXISTS hydra_coin_packages (
  id SERIAL PRIMARY KEY,
  package_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  coin_amount INTEGER NOT NULL,
  bonus_coins INTEGER DEFAULT 0,
  bonus_synth_credits INTEGER DEFAULT 0,
  price_usd DECIMAL(6,2) NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  is_best_value BOOLEAN DEFAULT false,
  discount_percent INTEGER DEFAULT 0,
  icon VARCHAR(10) DEFAULT '💎',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO hydra_coin_packages (package_key, name, description, coin_amount, bonus_coins, bonus_synth_credits, price_usd, is_featured, is_best_value, discount_percent, icon) VALUES
('starter', 'Starter Pack', 'A small boost to get started.', 100, 0, 50, 0.99, false, false, 0, '💰'),
('basic', 'Basic Bundle', 'Standard package for casual players.', 500, 25, 100, 4.99, false, false, 0, '💎'),
('popular', 'Popular Pack', 'Most purchased package!', 1200, 100, 250, 9.99, true, false, 10, '⭐'),
('value', 'Value Bundle', 'Best coins per dollar.', 2800, 400, 500, 19.99, false, true, 20, '🔥'),
('elite', 'Elite Package', 'For serious runners.', 6500, 1500, 1000, 49.99, false, false, 25, '👑'),
('whale', 'Mega Bundle', 'Ultimate package.', 15000, 5000, 3000, 99.99, false, false, 30, '🐋')
ON CONFLICT (package_key) DO UPDATE SET coin_amount = EXCLUDED.coin_amount;

-- Season extensions
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS theme VARCHAR(100);
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS lore_description TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS premium_price_hydra INTEGER DEFAULT 1000;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS premium_price_synth INTEGER DEFAULT 500;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS max_tier INTEGER DEFAULT 100;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS tier_xp_base INTEGER DEFAULT 1000;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS tier_xp_increment INTEGER DEFAULT 100;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🏆';

-- Battle pass tier extensions
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS tier_name VARCHAR(100);
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false;
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_name VARCHAR(100);
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_name VARCHAR(100);
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_icon VARCHAR(10);
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_icon VARCHAR(10);
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_rarity VARCHAR(20) DEFAULT 'common';
ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_rarity VARCHAR(20) DEFAULT 'common';

-- Premium shop categories
CREATE TABLE IF NOT EXISTS premium_shop_categories (
  id SERIAL PRIMARY KEY,
  category_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10) DEFAULT '🛒',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO premium_shop_categories (category_key, name, description, icon, sort_order) VALUES
('featured', 'Featured', 'Limited time offers', '⭐', 0),
('cosmetics', 'Cosmetics', 'Customize your runner', '👤', 1),
('boosters', 'Boosters', 'Temporary enhancements', '🚀', 2),
('currency', 'Currency Packs', 'Get more credits', '💰', 3),
('bundles', 'Bundles', 'Value packs', '📦', 4),
('seasonal', 'Seasonal', 'Season-exclusive items', '🎭', 5)
ON CONFLICT (category_key) DO UPDATE SET name = EXCLUDED.name;

-- Premium shop items
CREATE TABLE IF NOT EXISTS premium_shop_items (
  id SERIAL PRIMARY KEY,
  item_key VARCHAR(50) NOT NULL UNIQUE,
  category_id INTEGER REFERENCES premium_shop_categories(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  lore_text TEXT,
  price_hydra INTEGER DEFAULT 0,
  price_synth INTEGER DEFAULT 0,
  original_price_hydra INTEGER,
  item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('cosmetic', 'booster', 'currency', 'bundle', 'item', 'title', 'reactor', 'cells')),
  reward_data JSONB,
  stock_limit INTEGER,
  current_stock INTEGER,
  purchase_limit INTEGER,
  available_from TIMESTAMP,
  available_until TIMESTAMP,
  required_level INTEGER DEFAULT 1,
  required_faction VARCHAR(10),
  icon VARCHAR(10) DEFAULT '🎁',
  rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  is_featured BOOLEAN DEFAULT false,
  is_limited BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO premium_shop_items (item_key, category_id, name, description, price_hydra, price_synth, item_type, reward_data, icon, rarity, is_featured) VALUES
('xp_boost_2h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), '2-Hour XP Boost', 'Double all XP for 2 hours.', 150, 75, 'booster', '{"boost_type": "xp", "multiplier": 2, "duration_hours": 2}', '⚡', 'uncommon', false),
('xp_boost_24h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), '24-Hour XP Boost', 'Double all XP for 24 hours.', 500, 250, 'booster', '{"boost_type": "xp", "multiplier": 2, "duration_hours": 24}', '⚡', 'rare', false),
('cash_boost_2h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), '2-Hour Cash Boost', '50% more cash for 2 hours.', 150, 75, 'booster', '{"boost_type": "cash", "multiplier": 1.5, "duration_hours": 2}', '💵', 'uncommon', false),
('cell_pack_small', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Cell Pack (Small)', 'Restore 50 nuclear cells.', 50, 25, 'cells', '{"cells": 50}', '🔋', 'common', false),
('cell_pack_large', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Cell Pack (Large)', 'Restore 200 nuclear cells.', 150, 75, 'cells', '{"cells": 200}', '⚡', 'uncommon', false),
('starter_bundle', (SELECT id FROM premium_shop_categories WHERE category_key = 'bundles'), 'Starter Bundle', 'Everything a new runner needs.', 500, 250, 'bundle', '{"cash": 50000, "cells": 100, "synth_credits": 50, "xp": 5000}', '📦', 'rare', true)
ON CONFLICT (item_key) DO UPDATE SET name = EXCLUDED.name;

-- Premium purchases
CREATE TABLE IF NOT EXISTS premium_purchases (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES premium_shop_items(id),
  item_key VARCHAR(50) NOT NULL,
  price_hydra INTEGER DEFAULT 0,
  price_synth INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  reward_data JSONB,
  purchased_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_purchases_player ON premium_purchases(player_id);

-- Active boosters
CREATE TABLE IF NOT EXISTS player_active_boosters (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  booster_type VARCHAR(30) NOT NULL CHECK (booster_type IN ('xp', 'cash', 'heat_reduction', 'cell_regen', 'success', 'stealth')),
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  source VARCHAR(50),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_boosters_player ON player_active_boosters(player_id);
CREATE INDEX IF NOT EXISTS idx_active_boosters_expires ON player_active_boosters(expires_at);

-- Daily login rewards
CREATE TABLE IF NOT EXISTS daily_login_rewards (
  id SERIAL PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number >= 1 AND day_number <= 28),
  reward_type VARCHAR(30) NOT NULL,
  reward_value INTEGER,
  reward_data JSONB,
  reward_name VARCHAR(100) NOT NULL,
  reward_icon VARCHAR(10) DEFAULT '🎁',
  is_premium_bonus BOOLEAN DEFAULT false,
  premium_bonus_type VARCHAR(30),
  premium_bonus_value INTEGER
);

INSERT INTO daily_login_rewards (day_number, reward_type, reward_value, reward_name, reward_icon, is_premium_bonus, premium_bonus_type, premium_bonus_value) VALUES
(1, 'cash', 1000, '$1,000 Credits', '💵', true, 'cash', 500),
(2, 'xp', 500, '500 XP', '✨', true, 'xp', 250),
(3, 'cash', 1500, '$1,500 Credits', '💵', true, 'cash', 750),
(4, 'cells', 25, '25 Nuclear Cells', '🔋', true, 'cells', 15),
(5, 'synth', 10, '10 Synth Credits', '🔮', true, 'synth', 10),
(6, 'cash', 2000, '$2,000 Credits', '💵', true, 'cash', 1000),
(7, 'xp', 1000, '1,000 XP', '✨', true, 'xp', 500),
(8, 'cash', 2500, '$2,500 Credits', '💵', true, 'cash', 1250),
(9, 'cells', 50, '50 Nuclear Cells', '🔋', true, 'cells', 25),
(10, 'synth', 20, '20 Synth Credits', '🔮', true, 'synth', 20),
(11, 'cash', 3000, '$3,000 Credits', '💵', true, 'cash', 1500),
(12, 'xp', 1500, '1,500 XP', '✨', true, 'xp', 750),
(13, 'cash', 3500, '$3,500 Credits', '💵', true, 'cash', 1750),
(14, 'synth', 35, '35 Synth Credits', '🔮', true, 'synth', 35),
(15, 'cash', 4000, '$4,000 Credits', '💵', true, 'cash', 2000),
(16, 'cells', 75, '75 Nuclear Cells', '🔋', true, 'cells', 40),
(17, 'xp', 2000, '2,000 XP', '✨', true, 'xp', 1000),
(18, 'cash', 5000, '$5,000 Credits', '💵', true, 'cash', 2500),
(19, 'synth', 50, '50 Synth Credits', '🔮', true, 'synth', 50),
(20, 'cash', 6000, '$6,000 Credits', '💵', true, 'cash', 3000),
(21, 'cells', 100, '100 Nuclear Cells', '🔋', true, 'cells', 50),
(22, 'xp', 3000, '3,000 XP', '✨', true, 'xp', 1500),
(23, 'cash', 7500, '$7,500 Credits', '💵', true, 'cash', 3750),
(24, 'synth', 75, '75 Synth Credits', '🔮', true, 'synth', 75),
(25, 'cash', 10000, '$10,000 Credits', '💵', true, 'cash', 5000),
(26, 'cells', 150, '150 Nuclear Cells', '🔋', true, 'cells', 75),
(27, 'xp', 5000, '5,000 XP', '✨', true, 'xp', 2500),
(28, 'synth', 150, '150 Synth Credits', '🔮', true, 'synth', 150)
ON CONFLICT (day_number) DO UPDATE SET reward_value = EXCLUDED.reward_value;

-- Player daily logins
CREATE TABLE IF NOT EXISTS player_daily_logins (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_logins INTEGER DEFAULT 0,
  last_login_date DATE,
  last_claim_date DATE,
  current_cycle_day INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_synth ON players(synth_credits);
CREATE INDEX IF NOT EXISTS idx_players_hydra ON players(hydra_coins);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON premium_shop_items(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON premium_shop_items(is_active);

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Your database now has:
-- - 4 Factions: NNB, FFN, HNC, LST
-- - Nuclear Cells energy system
-- - AI Grid surveillance (15 sectors ON-0 to ON-14)
-- - World Events system
-- - Premium shop & HydraCoin currency
-- - Battle Pass framework
-- - Daily login rewards
-- =====================================================
