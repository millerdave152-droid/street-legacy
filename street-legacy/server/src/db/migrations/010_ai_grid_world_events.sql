-- Phase 6: World Events & AI Grid System
-- Street Legacy 2091 - HydraNet Surveillance & Dynamic World Events

-- ============================================
-- 6.1: AI GRID / HYDRANET SURVEILLANCE SYSTEM
-- ============================================

-- Sector surveillance levels (tracked by HydraNet)
CREATE TABLE IF NOT EXISTS sector_surveillance (
  id SERIAL PRIMARY KEY,
  sector_code VARCHAR(10) NOT NULL UNIQUE,  -- ON-0 through ON-14
  surveillance_level INTEGER DEFAULT 50 CHECK (surveillance_level >= 0 AND surveillance_level <= 100),
  grid_status VARCHAR(20) DEFAULT 'active' CHECK (grid_status IN ('active', 'degraded', 'offline', 'blackout')),
  drone_density INTEGER DEFAULT 5 CHECK (drone_density >= 0 AND drone_density <= 20),
  scanner_coverage DECIMAL(3,2) DEFAULT 0.75,  -- 0.00 to 1.00 (75% default)
  hnc_presence INTEGER DEFAULT 50 CHECK (hnc_presence >= 0 AND hnc_presence <= 100),
  last_sweep TIMESTAMP DEFAULT NOW(),
  sweep_interval_minutes INTEGER DEFAULT 30,
  alert_level VARCHAR(20) DEFAULT 'normal' CHECK (alert_level IN ('minimal', 'normal', 'elevated', 'high', 'critical', 'lockdown')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed sector surveillance for ON-0 through ON-14
INSERT INTO sector_surveillance (sector_code, surveillance_level, grid_status, drone_density, scanner_coverage, hnc_presence, alert_level) VALUES
('ON-0', 90, 'active', 15, 0.95, 90, 'elevated'),     -- Downtown Core (HNC HQ)
('ON-1', 85, 'active', 12, 0.90, 85, 'elevated'),     -- Financial District
('ON-2', 70, 'active', 8, 0.80, 70, 'normal'),        -- Midtown
('ON-3', 60, 'active', 6, 0.70, 60, 'normal'),        -- Residential North
('ON-4', 55, 'active', 5, 0.65, 55, 'normal'),        -- Industrial Zone
('ON-5', 40, 'degraded', 3, 0.50, 40, 'normal'),      -- Harbor District (NNB territory)
('ON-6', 35, 'degraded', 2, 0.45, 35, 'minimal'),     -- Old Town (FFN territory)
('ON-7', 50, 'active', 5, 0.60, 50, 'normal'),        -- Entertainment District
('ON-8', 45, 'active', 4, 0.55, 45, 'normal'),        -- Residential South
('ON-9', 30, 'degraded', 2, 0.35, 30, 'minimal'),     -- Warehouse District (LST territory)
('ON-10', 25, 'offline', 1, 0.25, 25, 'minimal'),     -- Undercity Access
('ON-11', 15, 'blackout', 0, 0.10, 10, 'minimal'),    -- Blackout Zone North
('ON-12', 20, 'blackout', 0, 0.15, 15, 'minimal'),    -- Blackout Zone South
('ON-13', 10, 'blackout', 0, 0.05, 5, 'minimal'),     -- Deep Undercity
('ON-14', 80, 'active', 10, 0.85, 80, 'normal')       -- Transit Hub
ON CONFLICT (sector_code) DO UPDATE SET
  surveillance_level = EXCLUDED.surveillance_level,
  grid_status = EXCLUDED.grid_status;

-- Player heat/wanted level tracked by AI Grid
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
  bounty_from_hnc INTEGER DEFAULT 0,  -- HNC bounty on player
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Grid events/incidents log
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
CREATE INDEX IF NOT EXISTS idx_grid_incidents_time ON grid_incidents(created_at);

-- ============================================
-- 6.2: 2091 WORLD EVENTS (Cyberpunk Themed)
-- ============================================

-- Replace/extend existing events with 2091 lore
CREATE TABLE IF NOT EXISTS world_events_2091 (
  id SERIAL PRIMARY KEY,
  event_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  lore_text TEXT,  -- Expanded lore for immersion
  event_category VARCHAR(30) NOT NULL CHECK (event_category IN (
    'grid', 'faction', 'economic', 'environmental', 'crisis', 'opportunity', 'special'
  )),
  affected_sectors TEXT[],  -- Array of sector codes, NULL = global
  effects JSONB NOT NULL,  -- { payoutBonus, xpBonus, heatReduction, etc }
  requirements JSONB,  -- { minLevel, factionRequired, etc }
  duration_hours INTEGER NOT NULL DEFAULT 2,
  rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  trigger_chance DECIMAL(4,3) DEFAULT 0.100,  -- 10% default
  icon VARCHAR(10) DEFAULT '⚡',
  is_positive BOOLEAN DEFAULT true,
  can_participate BOOLEAN DEFAULT true,  -- Can players actively participate?
  participation_reward JSONB,  -- Rewards for participation
  min_participants INTEGER DEFAULT 0,
  max_concurrent INTEGER DEFAULT 1  -- Max instances of this event at once
);

-- Seed 2091 world events
INSERT INTO world_events_2091 (event_key, name, description, lore_text, event_category, affected_sectors, effects, duration_hours, rarity, trigger_chance, icon, is_positive, can_participate, participation_reward) VALUES
-- Grid Events (AI/Surveillance related)
('grid_blackout', 'Sector Blackout', 'Grid failure plunges sector into darkness. HydraNet blind.',
  'A cascade failure in the HydraNet power grid has knocked out surveillance in the area. The AI is scrambling to reroute, but for now, the sector runs dark. Old-timers remember when the whole city was like this. The young ones are terrified.',
  'grid', NULL, '{"heatReduction": 50, "surveillanceDisabled": true, "successBonus": 20}', 3, 'uncommon', 0.080, '🌑', true, true, '{"xp": 500, "cash": 2500}'),

('drone_swarm', 'Drone Swarm Deployment', 'HNC deploys emergency surveillance drones. Heat increases faster.',
  'Following a spike in unauthorized activity, HydraNet has deployed its reserve drone fleet. The sky buzzes with the sound of rotors as thousands of eyes scan the streets below. Even the shadows feel watched.',
  'grid', NULL, '{"heatMultiplier": 2.0, "detectionBonus": 30, "dronesDense": true}', 2, 'common', 0.100, '🤖', false, true, '{"xp": 300, "reputation_hnc": -10}'),

('grid_hack_event', 'Ghost Protocol Active', 'Underground hackers have compromised local scanners.',
  'The FFN has pulled off another miracle. For the next few hours, local ID scanners will return garbage data. HydraNet is furious. The Collective has already started an investigation, but by then, the damage will be done.',
  'grid', NULL, '{"scannersBypass": true, "heatGainReduction": 75, "ffnReputationBonus": 5}', 2, 'rare', 0.050, '👻', true, false, NULL),

('ai_glitch', 'ARIA Malfunction', 'The central AI is experiencing errors. Unpredictable behavior.',
  'Something is wrong with ARIA, the central processing intelligence. Reports are coming in of drones attacking lampposts, scanners approving known criminals, and automated turrets firing at pigeons. Nobody knows if this is a bug, a hack, or something worse.',
  'grid', NULL, '{"randomEffects": true, "chaosFactor": 0.3, "heatRandom": true}', 1, 'rare', 0.040, '⚠️', true, false, NULL),

-- Faction Events
('nnb_rally', 'NNB Community Rally', 'New North Bloc organizes public demonstration. Safe haven for the people.',
  'The resistance has called a gathering in the harbor. Free food, medical care, and stories from before the Collapse. HNC observers watch from afar but dare not interfere. Even they know some lines cannot be crossed.',
  'faction', ARRAY['ON-5'], '{"nnbZoneSafe": true, "healingBonus": 50, "communityBonus": true}', 4, 'common', 0.120, '✊', true, true, '{"xp": 400, "reputation_nnb": 15, "healing": 50}'),

('ffn_data_drop', 'FFN Data Liberation', 'Free Folk Network is distributing stolen corporate data.',
  'Encrypted drives are being handed out in Old Town. Corporate secrets, government files, evidence of HNC atrocities. The truth wants to be free, and today, it is getting its wish.',
  'faction', ARRAY['ON-6'], '{"dataRewards": true, "ffnMissionBonus": 100, "intelGain": true}', 3, 'uncommon', 0.080, '💾', true, true, '{"xp": 600, "cash": 5000, "reputation_ffn": 20}'),

('hnc_crackdown', 'HNC Security Sweep', 'HydraNet Collective conducting sector-wide security operation.',
  'Checkpoints on every corner. Drones overhead. Armed enforcers questioning anyone who looks suspicious. The Collective claims it is a routine security audit. Nobody believes them.',
  'faction', NULL, '{"heatMultiplier": 1.5, "checkpointsActive": true, "hncBonusPay": 25}', 4, 'common', 0.100, '🔒', false, true, '{"reputation_hnc": 10, "cash": 1000}'),

('lst_black_market', 'Underground Market Night', 'LST opens exclusive black market trading session.',
  'Word spreads through back channels: the Last Stand is holding a market tonight. Rare items, untraceable weapons, information that could get you killed. Everything has a price, and tonight, prices are negotiable.',
  'faction', ARRAY['ON-9'], '{"shopDiscount": 30, "rareItemsAvailable": true, "lstZoneActive": true}', 6, 'uncommon', 0.070, '🏪', true, true, '{"xp": 500, "reputation_lst": 15}'),

-- Economic Events
('credit_surge', 'Credit Market Surge', 'Economic instability causes credit values to spike.',
  'The Toronto Stock Exchange AI has gone haywire, pumping artificial value into the credit markets. Corporations are panicking. For those who know how to exploit chaos, this is payday.',
  'economic', NULL, '{"payoutBonus": 40, "bankInterestBonus": 25}', 3, 'common', 0.090, '📈', true, false, NULL),

('market_crash', 'Market Collapse', 'Economic systems failing. Reduced payouts but desperate opportunities.',
  'The bubble has burst. Again. Credit values plummeting. Businesses shuttering. But in the ruins of the old economy, new opportunities emerge for those willing to get their hands dirty.',
  'economic', NULL, '{"payoutPenalty": -25, "crimeDemandBonus": 50, "desperation": true}', 4, 'uncommon', 0.060, '📉', false, true, '{"xp": 800, "cash": 10000}'),

('corp_war', 'Corporate Shadow War', 'Major corporations engage in covert conflict. Mercenary work available.',
  'MegaCorp and Axiom Industries are at each other''s throats again. Officially, nothing is happening. Unofficially, there''s good money for runners willing to do dirty work without asking questions.',
  'economic', NULL, '{"mercWorkAvailable": true, "missionPayBonus": 50, "heatFromCorp": true}', 6, 'rare', 0.050, '⚔️', true, true, '{"xp": 1000, "cash": 15000}'),

-- Environmental Events
('acid_rain', 'Acid Rain Warning', 'Toxic precipitation. Outdoor activities hazardous.',
  'The clouds are that sickly yellow-green again. The filtration systems in the upper atmosphere are failing. Anyone caught outside without protection will regret it. Most people stay indoors. Most.',
  'environmental', NULL, '{"outdoorPenalty": -20, "indoorBonus": 15, "healthDrain": true}', 2, 'common', 0.100, '☔', false, false, NULL),

('power_surge', 'Grid Power Surge', 'Unstable power grid causes tech malfunctions.',
  'Lightning storm knocked out one of the main fusion reactors. Now the grid is overcompensating, pumping unstable power through the network. Expect equipment failures and... opportunities.',
  'environmental', NULL, '{"techFailureChance": 20, "overchargeBonus": 30, "reactorBonus": true}', 2, 'uncommon', 0.070, '⚡', true, false, NULL),

('smog_alert', 'Toxic Smog Advisory', 'Industrial pollution reaches dangerous levels.',
  'The factories in ON-4 are venting again. A thick, choking smog blankets the lower sectors. Visibility is near zero. Perfect cover for those who don''t mind the taste of rust in their lungs.',
  'environmental', ARRAY['ON-4', 'ON-5', 'ON-9', 'ON-10'], '{"visibilityPenalty": 30, "stealthBonus": 25, "healthDrain": true}', 3, 'common', 0.080, '🌫️', true, false, NULL),

-- Crisis Events
('riot_outbreak', 'Civil Unrest', 'Protests have turned violent. Citywide chaos.',
  'It started as a peaceful demonstration. Then someone threw the first punch. Now entire sectors are burning. The factions are mobilizing. HNC is deploying force. This is either the beginning of the end, or the end of the beginning.',
  'crisis', NULL, '{"chaosFactor": 0.5, "factionTensionBonus": 100, "pvpEnabled": true}', 4, 'rare', 0.030, '🔥', false, true, '{"xp": 1500, "faction_rep_any": 25}'),

('quarantine_zone', 'Bio-Hazard Quarantine', 'Unknown pathogen detected. Sector lockdown.',
  'HNC medical teams are sealing off the area. Something got loose from one of the underground labs. Nobody knows what it is yet. Nobody wants to find out. But some secrets are worth dying for.',
  'crisis', NULL, '{"sectorLockdown": true, "hazardBonus": 50, "heatSuspended": true}', 6, 'epic', 0.020, '☣️', false, true, '{"xp": 2000, "cash": 20000, "rare_item": true}'),

('synth_uprising', 'Synthetic Rebellion', 'Rogue androids causing chaos. High bounties available.',
  'They were supposed to be tools. Servants. Now they''re hunting their former masters. The android uprising is here, and HNC is paying top credit for anyone who can put them down. Or is this finally the dawn of machine rights?',
  'crisis', NULL, '{"bountyBonusMultiplier": 3.0, "androidEnemies": true, "synthsHostile": true}', 8, 'legendary', 0.010, '🤖', false, true, '{"xp": 5000, "cash": 50000, "legendary_item": true}'),

-- Opportunity Events
('info_broker_visit', 'Shadow Broker Appearance', 'Mysterious information dealer accepting trades.',
  'They appear without warning and vanish just as quickly. The Shadow Broker knows things. Everything, some say. Tonight, they are willing to trade. The price is always fair. The question is whether you can afford it.',
  'opportunity', ARRAY['ON-6', 'ON-9'], '{"infoBrokerActive": true, "intelTrading": true}', 2, 'rare', 0.040, '🕵️', true, true, '{"xp": 750, "intel_item": true}'),

('artifact_sighting', 'Pre-Collapse Artifact', 'Rumors of valuable pre-war technology surfacing.',
  'Word on the street is that someone found something from Before. Real tech. The kind that doesn''t exist anymore. Every faction wants it. Every runner is looking for it. The race is on.',
  'opportunity', NULL, '{"artifactHuntActive": true, "rareDropBonus": 200}', 4, 'epic', 0.025, '🔮', true, true, '{"xp": 2500, "rare_item": true, "cash": 25000}'),

-- Special Events
('anniversary_collapse', 'Collapse Anniversary', 'Memorial day for the fall of old Toronto. Reflection and remembrance.',
  'Sixty-five years ago today, the old world ended. Fires still burned for weeks after. Now we gather to remember what was lost, and to remind ourselves why we fight for what remains.',
  'special', NULL, '{"xpBonus": 100, "communityBonus": true, "memorialActive": true}', 24, 'legendary', 0.001, '🕯️', true, true, '{"xp": 10000, "commemorative_item": true}'),

('hydra_festival', 'HydraNet Integration Day', 'HNC celebrates the founding of the Grid. Propaganda and prizes.',
  'The Collective throws its annual celebration of ''progress'' and ''security.'' Free entertainment, sponsored activities, and mandatory participation for citizens. Behind the festivities, the surveillance never stops.',
  'special', NULL, '{"hncMissionsBonus": 100, "surveillanceIntense": true, "festivalRewards": true}', 12, 'rare', 0.010, '🎪', true, true, '{"xp": 1000, "cash": 5000, "reputation_hnc": 30}')

ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  effects = EXCLUDED.effects;

-- ============================================
-- 6.3: ACTIVE WORLD EVENTS TRACKING
-- ============================================

-- Currently active events
CREATE TABLE IF NOT EXISTS active_world_events (
  id SERIAL PRIMARY KEY,
  event_key VARCHAR(50) NOT NULL REFERENCES world_events_2091(event_key),
  affected_sectors TEXT[],  -- Override from template or use template default
  started_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL,
  triggered_by VARCHAR(50),  -- 'system', 'admin', 'faction_action', 'player_action'
  trigger_player_id INTEGER REFERENCES players(id),
  participants INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_events_key ON active_world_events(event_key);
CREATE INDEX IF NOT EXISTS idx_active_events_ends ON active_world_events(ends_at);
CREATE INDEX IF NOT EXISTS idx_active_events_active ON active_world_events(is_active);

-- Player participation in events
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
CREATE INDEX IF NOT EXISTS idx_event_participation_event ON event_participation(event_id);

-- ============================================
-- 6.4: AI THREAT RESPONSE SYSTEM
-- ============================================

-- HNC pursuit/threat tracking
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
CREATE INDEX IF NOT EXISTS idx_pursuits_active ON hnc_pursuits(is_active);

-- Pursuit level definitions
CREATE TABLE IF NOT EXISTS pursuit_levels (
  level INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  drones INTEGER NOT NULL,
  enforcers INTEGER NOT NULL,
  escape_difficulty INTEGER NOT NULL,  -- 1-100
  heat_required INTEGER NOT NULL,
  penalty_cash_percent INTEGER DEFAULT 0,
  penalty_jail_minutes INTEGER DEFAULT 0,
  icon VARCHAR(10)
);

INSERT INTO pursuit_levels (level, name, description, drones, enforcers, escape_difficulty, heat_required, penalty_cash_percent, penalty_jail_minutes, icon) VALUES
(1, 'Drone Scan', 'A single drone has marked you for observation.', 1, 0, 20, 20, 5, 5, '👁️'),
(2, 'Active Interest', 'Multiple drones tracking. HNC is aware of you.', 3, 0, 35, 40, 10, 15, '🔍'),
(3, 'Pursuit Initiated', 'Ground units dispatched. Things are getting serious.', 5, 2, 50, 60, 20, 30, '🚨'),
(4, 'Priority Target', 'Full pursuit team assigned. Elite enforcers deployed.', 8, 5, 70, 80, 35, 60, '⚠️'),
(5, 'Maximum Response', 'ARIA has flagged you as a primary threat. All assets mobilized.', 15, 10, 90, 100, 50, 120, '💀')
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ============================================
-- 6.5: HELPER FUNCTIONS
-- ============================================

-- Calculate detection chance based on sector surveillance and player heat
CREATE OR REPLACE FUNCTION calculate_detection_chance(p_player_id INTEGER, p_sector_code VARCHAR(10))
RETURNS INTEGER AS $$
DECLARE
  v_surveillance INTEGER;
  v_heat INTEGER;
  v_scanner_coverage DECIMAL;
  v_base_chance INTEGER;
BEGIN
  -- Get sector surveillance
  SELECT surveillance_level, scanner_coverage INTO v_surveillance, v_scanner_coverage
  FROM sector_surveillance WHERE sector_code = p_sector_code;

  IF NOT FOUND THEN
    v_surveillance := 50;
    v_scanner_coverage := 0.75;
  END IF;

  -- Get player heat
  SELECT COALESCE(heat_level, 0) INTO v_heat
  FROM player_heat WHERE player_id = p_player_id;

  -- Base detection = (surveillance + heat) / 2, modified by scanner coverage
  v_base_chance := ((v_surveillance + v_heat) / 2) * v_scanner_coverage;

  RETURN LEAST(95, GREATEST(5, v_base_chance));
END;
$$ LANGUAGE plpgsql;

-- Update sector surveillance based on events
CREATE OR REPLACE FUNCTION update_sector_surveillance(p_sector_code VARCHAR(10), p_change INTEGER, p_reason VARCHAR(100))
RETURNS void AS $$
BEGIN
  UPDATE sector_surveillance
  SET
    surveillance_level = LEAST(100, GREATEST(0, surveillance_level + p_change)),
    updated_at = NOW()
  WHERE sector_code = p_sector_code;

  -- Log the change
  INSERT INTO grid_incidents (incident_type, sector_code, severity, description)
  VALUES ('surveillance_disrupted', p_sector_code, ABS(p_change) / 10 + 1, p_reason);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sector_surveillance_level ON sector_surveillance(surveillance_level);
CREATE INDEX IF NOT EXISTS idx_sector_surveillance_status ON sector_surveillance(grid_status);
CREATE INDEX IF NOT EXISTS idx_player_heat_level ON player_heat(heat_level);
CREATE INDEX IF NOT EXISTS idx_player_heat_flagged ON player_heat(is_flagged);
