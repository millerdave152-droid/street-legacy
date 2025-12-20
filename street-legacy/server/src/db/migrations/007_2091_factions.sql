-- Phase 4.1: Street Legacy 2091 - Faction System Schema
-- The Four Major Factions of Toronto 2091

-- ============================================
-- DROP EXISTING FACTION DATA FOR CLEAN SLATE
-- (Will be re-seeded with 2091 factions)
-- ============================================

-- Clear old faction data if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_war_contributions') THEN
    DELETE FROM faction_war_contributions WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_wars') THEN
    DELETE FROM faction_wars WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_story_progress') THEN
    DELETE FROM faction_story_progress WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_events') THEN
    DELETE FROM faction_events WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_mission_completions') THEN
    DELETE FROM faction_mission_completions WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'active_faction_missions') THEN
    DELETE FROM active_faction_missions WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_missions') THEN
    DELETE FROM faction_missions WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_shop_items') THEN
    DELETE FROM faction_shop_items WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_safehouses') THEN
    DELETE FROM faction_safehouses WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_faction_rep') THEN
    DELETE FROM player_faction_rep WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'factions') THEN
    DELETE FROM factions WHERE TRUE;
  END IF;
END $$;

-- ============================================
-- UPDATE FACTIONS TABLE FOR 2091 THEME
-- ============================================

-- Add new columns if factions table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'factions') THEN
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS code VARCHAR(10);
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS slogan TEXT;
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS hydranet_channel VARCHAR(50);
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS primary_sector VARCHAR(10);
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS resource_type VARCHAR(30);
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS control_style VARCHAR(30);
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS tech_level INTEGER DEFAULT 5;
    ALTER TABLE factions ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';

    -- Update type enum to include 2091 types
    ALTER TABLE factions DROP CONSTRAINT IF EXISTS factions_type_check;
    ALTER TABLE factions ADD CONSTRAINT factions_type_check
      CHECK (type IN ('gang', 'mafia', 'cartel', 'syndicate', 'corporate', 'government',
                      'tech_collective', 'resistance', 'enforcement', 'underground'));
  END IF;
END $$;

-- ============================================
-- INSERT THE FOUR 2091 FACTIONS
-- ============================================

INSERT INTO factions (
  name, code, type, slogan, ideology, background_lore,
  color, icon, hydranet_channel, primary_sector, resource_type, control_style,
  territory_district_ids, power_level, wealth, member_count, tech_level,
  min_level_to_join, is_recruitable, visibility
) VALUES

-- NNB: NEW NORTH BLOC
(
  'New North Bloc',
  'NNB',
  'resistance',
  'From the ashes, we rise.',
  'Community sovereignty, mutual aid, resistance to corporate control',
  'Born from the collapse of the old welfare state, the New North Bloc emerged from the refugee camps and abandoned housing projects of Northern Toronto. When HydraNet''s corporate surveillance grid failed to reach the northern sectors, communities organized their own networks. NNB runs on barter economies, mesh networks, and old-school street loyalty. They reject both corporate credits and HydraNet tracking. Their leader, Mother June, is a former social worker who orchestrated the Great Food Depot Raids of 2088. NNB believes the only path forward is to build parallel systems outside corporate control - grow your own food, hack your own networks, protect your own people.',
  '#22c55e',
  '🌿',
  'NNB_COMMUNITY_MESH',
  'ON-1',
  'organic_goods',
  'democratic_council',
  '[1, 2, 3]',
  45,
  500000,
  2500,
  3,
  3,
  true,
  'semi_hidden'
),

-- FFN: FREE FOLK NETWORK
(
  'Free Folk Network',
  'FFN',
  'tech_collective',
  'Information wants to be free. So do we.',
  'Digital liberation, decentralization, information anarchism',
  'The Free Folk Network began as a hacker collective in the basements of Old Chinatown, cracking HydraNet''s encryption for fun. After the Corporate Data Monopoly Act of 2085 made independent data storage illegal, FFN became the underground railroad of information. They run darknet markets, sell cracked HydraNet access, and maintain the last truly free communication channels in Toronto. Their anonymous founder, known only as Ghost_0, allegedly used to be a HydraNet architect. FFN members never meet in person - they exist as encrypted identities on the mesh. To join, you must prove you can break at least three HydraNet security protocols.',
  '#3b82f6',
  '👻',
  'FFN_DARKNET_PRIMARY',
  'ON-5',
  'data',
  'mesh_consensus',
  '[5, 6, 12]',
  55,
  2000000,
  800,
  9,
  8,
  true,
  'hidden'
),

-- HNC: HYDRANET COLLECTIVE
(
  'HydraNet Collective',
  'HNC',
  'corporate',
  'Connection is compliance. Compliance is peace.',
  'Order through surveillance, prosperity through integration, peace through control',
  'The HydraNet Collective isn''t a faction - it''s THE system. After the Collapse of 2084, the megacorps pooled their surveillance networks into HydraNet, promising to rebuild Toronto''s infrastructure in exchange for total data access. HNC represents the "legitimate" path: registered citizens with clean credit scores, neural implants synced to the grid, and corporate employment. They control the power grid, water treatment, and all official commerce. Their CEO-Governor, Marcus Webb III, rules from the Sterling Tower in ON-0. But HNC needs street operators too - off-book enforcers who do the dirty work that can''t appear on quarterly reports. Join them, and you''ll never want for credits. Just don''t ask questions.',
  '#f59e0b',
  '⚡',
  'HNC_OFFICIAL_BROADCAST',
  'ON-0',
  'energy_credits',
  'corporate_hierarchy',
  '[0, 7, 8, 9]',
  90,
  50000000,
  10000,
  10,
  5,
  true,
  'public'
),

-- LST: LAST STAND TORONTO
(
  'Last Stand Toronto',
  'LST',
  'underground',
  'The streets remember what the towers forgot.',
  'Street sovereignty, old codes, survival of the realest',
  'When the corps carved up Toronto, the old criminal organizations didn''t disappear - they evolved. Last Stand Toronto is a coalition of what remains: the Italian families who ran the waterfront, the Jamaican posses from Scarborough, the Vietnamese syndicates of Spadina, the biker clubs from the industrial zones. They put aside old beefs when HydraNet tried to digitize the drug trade. LST runs the physical underworld - flesh, chemicals, weapons, anything that needs to move without leaving a data trail. Their Council of Nine includes representatives from each legacy organization. Don Castellano, the ancient head of the Commission, serves as mediator. LST plays by the old rules: respect, territory, and blood loyalty. In a world of algorithms, they bet on human nature.',
  '#ef4444',
  '🔥',
  'LST_NUMBERS_STATION',
  'ON-4',
  'contraband',
  'council_of_nine',
  '[4, 10, 11, 14]',
  70,
  15000000,
  5000,
  5,
  10,
  true,
  'underground'
);

-- ============================================
-- FACTION RELATIONSHIPS (HOSTILITIES)
-- ============================================

-- Update faction hostilities if factions table and hostilities column exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'factions' AND column_name = 'hostilities') THEN
    UPDATE factions SET hostilities = '{"2": 30, "3": 80, "4": 45}' WHERE code = 'NNB';  -- NNB: friendly with FFN, hostile to HNC, wary of LST
    UPDATE factions SET hostilities = '{"1": 30, "3": 90, "4": 50}' WHERE code = 'FFN';  -- FFN: friendly with NNB, at war with HNC, neutral with LST
    UPDATE factions SET hostilities = '{"1": 80, "2": 90, "4": 60}' WHERE code = 'HNC';  -- HNC: hostile to NNB/FFN, competitive with LST
    UPDATE factions SET hostilities = '{"1": 45, "2": 50, "3": 60}' WHERE code = 'LST';  -- LST: wary of all, competes with HNC
  END IF;
END $$;

-- ============================================
-- FACTION RANKS (2091 themed)
-- ============================================

-- Update player_faction_rep rank check for 2091 terminology
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_faction_rep') THEN
    ALTER TABLE player_faction_rep DROP CONSTRAINT IF EXISTS player_faction_rep_rank_check;
    ALTER TABLE player_faction_rep ADD CONSTRAINT player_faction_rep_rank_check
      CHECK (rank IN (
        -- Universal ranks
        'outsider',      -- No affiliation
        'contact',       -- Initial contact, probationary
        'associate',     -- Proven useful
        'member',        -- Full member
        'trusted',       -- Inner circle
        'lieutenant',    -- Leadership role
        'commander',     -- High command
        'council'        -- Ruling council
      ));
  END IF;
END $$;

-- ============================================
-- FACTION-SPECIFIC MISSION TYPES (2091)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faction_missions') THEN
    ALTER TABLE faction_missions DROP CONSTRAINT IF EXISTS faction_missions_mission_type_check;
    ALTER TABLE faction_missions ADD CONSTRAINT faction_missions_mission_type_check
      CHECK (mission_type IN (
        -- Classic types
        'collection', 'enforcement', 'defense', 'expansion', 'war',
        'smuggling', 'recruitment', 'heist', 'assassination', 'sabotage',
        'extraction',
        -- 2091 types
        'data_extraction', 'grid_hack', 'supply_run', 'mesh_defense',
        'corporate_infiltration', 'blackout_ops', 'territory_scan',
        'resource_acquisition', 'signal_intercept', 'dead_drop'
      ));

    -- Add 2091 specific columns to faction_missions
    ALTER TABLE faction_missions ADD COLUMN IF NOT EXISTS requires_neural_implant BOOLEAN DEFAULT false;
    ALTER TABLE faction_missions ADD COLUMN IF NOT EXISTS hydranet_detection_risk INTEGER DEFAULT 0;
    ALTER TABLE faction_missions ADD COLUMN IF NOT EXISTS sector_requirement VARCHAR(10);
  END IF;
END $$;

-- ============================================
-- FACTION TERRITORIES (Toronto 2091 Sectors)
-- ============================================

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

-- ============================================
-- FACTION RESOURCES (2091 Economy)
-- ============================================

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

-- Resource types for 2091
COMMENT ON TABLE faction_resources IS 'Resources: nuclear_cells, data_packets, clean_water, organic_goods, weapons, chems, contraband, credits';

-- ============================================
-- PLAYER FACTION STANDING HISTORY
-- ============================================

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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_factions_code ON factions(code);
CREATE INDEX IF NOT EXISTS idx_factions_type ON factions(type);
CREATE INDEX IF NOT EXISTS idx_factions_primary_sector ON factions(primary_sector);
