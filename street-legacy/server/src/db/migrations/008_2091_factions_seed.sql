-- Phase 4.1: Street Legacy 2091 - Faction Seed Data
-- Missions, Shops, Safehouses for NNB, FFN, HNC, LST

-- ============================================
-- NNB (New North Bloc) MISSIONS
-- Theme: Community, survival, resistance
-- ============================================

INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  is_story_mission, story_order, icon
) VALUES
-- Get faction_id for NNB
((SELECT id FROM factions WHERE code = 'NNB'),
  'Community Harvest', 'The hydroponic bay needs organic supplies. Raid the abandoned greenhouse in ON-2 before HNC drones spot you.',
  'supply_run', 'contact', 0, 30, 800, 60,
  '[{"type": "travel_to", "sector": "ON-2"}, {"type": "collect_resources", "item": "organic_supplies", "amount": 5}, {"type": "return_to_safehouse"}]',
  45, 1, 15, true, 1, '🌱'),

((SELECT id FROM factions WHERE code = 'NNB'),
  'Mesh Node Setup', 'Install a new mesh relay on the water tower in ON-3. Keep the network growing beyond HydraNet''s reach.',
  'mesh_defense', 'associate', 100, 50, 1500, 100,
  '[{"type": "acquire_equipment", "item": "mesh_relay"}, {"type": "install_at_location", "location": "water_tower_on3"}, {"type": "verify_signal"}]',
  60, 2, 25, false, NULL, '📡'),

((SELECT id FROM factions WHERE code = 'NNB'),
  'Food Depot Liberation', 'HNC hoards food while the north starves. Time to redistribute. Hit the depot in ON-0, get out clean.',
  'heist', 'member', 300, 100, 5000, 200,
  '[{"type": "scout_location"}, {"type": "disable_surveillance"}, {"type": "steal_supplies", "min_amount": 1000}, {"type": "escape_sector"}]',
  90, 3, 60, true, 2, '📦'),

((SELECT id FROM factions WHERE code = 'NNB'),
  'Grid Independence', 'We''re building our own power. Acquire nuclear cells from the LST smugglers - without starting a war.',
  'resource_acquisition', 'trusted', 500, 75, 8000, 300,
  '[{"type": "contact_faction", "faction": "LST"}, {"type": "negotiate_trade"}, {"type": "transport_goods", "avoid_detection": true}]',
  120, 4, 40, false, NULL, '⚡'),

((SELECT id FROM factions WHERE code = 'NNB'),
  'Mother June''s Gambit', 'The council has decided: we strike at HNC''s water processing facility. Cut their hold on ON-1 forever.',
  'sabotage', 'lieutenant', 800, 200, 25000, 600,
  '[{"type": "infiltrate_facility"}, {"type": "reprogram_systems"}, {"type": "escape_before_lockdown"}, {"type": "broadcast_victory"}]',
  180, 5, 90, true, 3, '💧');

-- ============================================
-- FFN (Free Folk Network) MISSIONS
-- Theme: Hacking, data, digital freedom
-- ============================================

INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  requires_neural_implant, is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'FFN'),
  'Dead Drop Protocol', 'Encrypted package at the old library. Retrieve it before HNC sweepers find it. No traces.',
  'dead_drop', 'contact', 0, 25, 1000, 50,
  '[{"type": "locate_dead_drop"}, {"type": "decrypt_package"}, {"type": "deliver_to_contact"}]',
  30, 1, 30, false, true, 1, '📧'),

((SELECT id FROM factions WHERE code = 'FFN'),
  'Signal Pirate', 'Intercept HydraNet traffic between ON-0 and ON-7. We need their encryption keys.',
  'signal_intercept', 'associate', 150, 75, 3000, 150,
  '[{"type": "position_at_relay"}, {"type": "deploy_interceptor"}, {"type": "capture_packets", "min_count": 100}, {"type": "extract_cleanly"}]',
  60, 3, 55, true, false, NULL, '📶'),

((SELECT id FROM factions WHERE code = 'FFN'),
  'Ghost Protocol', 'Create a fake identity in HydraNet''s citizen database. Someone needs to disappear.',
  'grid_hack', 'member', 400, 100, 8000, 250,
  '[{"type": "access_hydranet_terminal"}, {"type": "bypass_security_layers", "count": 3}, {"type": "create_identity"}, {"type": "wipe_traces"}]',
  90, 4, 75, true, true, 2, '👻'),

((SELECT id FROM factions WHERE code = 'FFN'),
  'Data Heist: Sterling Archives', 'Sterling Tower''s archives hold the original HydraNet source code. Get it, and we own them.',
  'data_extraction', 'trusted', 600, 175, 20000, 400,
  '[{"type": "physical_infiltration"}, {"type": "access_air_gapped_system"}, {"type": "extract_data", "size": "massive"}, {"type": "exfiltrate"}]',
  150, 5, 95, true, false, NULL, '🔓'),

((SELECT id FROM factions WHERE code = 'FFN'),
  'Ghost_0''s Legacy', 'The founder left something in the deep grid. Find it. Whatever it is, it scares HNC.',
  'data_extraction', 'lieutenant', 900, 300, 50000, 800,
  '[{"type": "decode_coordinates"}, {"type": "navigate_deep_grid"}, {"type": "survive_ice"}, {"type": "retrieve_artifact"}]',
  240, 5, 100, true, true, 3, '🌐');

-- ============================================
-- HNC (HydraNet Collective) MISSIONS
-- Theme: Corporate enforcement, control, credits
-- ============================================

INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  requires_neural_implant, is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'HNC'),
  'Compliance Check', 'Citizen in ON-4 has been flagged for suspicious behavior. Verify their activities. Report findings.',
  'territory_scan', 'contact', 0, 20, 1500, 40,
  '[{"type": "travel_to_sector", "sector": "ON-4"}, {"type": "locate_target"}, {"type": "scan_activities"}, {"type": "submit_report"}]',
  30, 1, 0, true, true, 1, '📋'),

((SELECT id FROM factions WHERE code = 'HNC'),
  'Network Enforcement', 'Unauthorized mesh node detected in ON-3. Locate and disable. Apprehend operators if possible.',
  'enforcement', 'associate', 100, 40, 4000, 120,
  '[{"type": "trace_signal"}, {"type": "locate_node"}, {"type": "disable_hardware"}, {"type": "identify_operators"}]',
  60, 2, 0, true, false, NULL, '🔌'),

((SELECT id FROM factions WHERE code = 'HNC'),
  'Corporate Extraction', 'Defector in FFN territory has intel we need. Extract them to ON-0. Alive.',
  'extraction', 'member', 350, 80, 10000, 250,
  '[{"type": "infiltrate_ffn_territory"}, {"type": "locate_defector"}, {"type": "extract_safely"}, {"type": "deliver_to_sterling"}]',
  120, 4, 10, false, true, 2, '🎯'),

((SELECT id FROM factions WHERE code = 'HNC'),
  'Market Correction', 'LST is disrupting credit flow in ON-11. Eliminate their operation. Send a message.',
  'enforcement', 'trusted', 550, 125, 20000, 400,
  '[{"type": "identify_operation"}, {"type": "neutralize_leadership"}, {"type": "seize_assets"}, {"type": "install_surveillance"}]',
  150, 4, 5, false, false, NULL, '💰'),

((SELECT id FROM factions WHERE code = 'HNC'),
  'Operation Daylight', 'CEO Webb wants the NNB crushed. Lead the assault on their primary settlement. Total pacification.',
  'war', 'lieutenant', 850, 250, 75000, 900,
  '[{"type": "coordinate_strike_teams"}, {"type": "breach_perimeter"}, {"type": "capture_leadership"}, {"type": "establish_control"}]',
  300, 5, 0, true, true, 3, '☀️');

-- ============================================
-- LST (Last Stand Toronto) MISSIONS
-- Theme: Old school crime, loyalty, survival
-- ============================================

INSERT INTO faction_missions (
  faction_id, name, description, mission_type, min_rank, min_reputation,
  reputation_reward, cash_reward, xp_reward, objectives,
  time_limit_minutes, difficulty, hydranet_detection_risk,
  is_story_mission, story_order, icon
) VALUES
((SELECT id FROM factions WHERE code = 'LST'),
  'Package Run', 'Deliver this package to the address. Don''t open it. Don''t ask questions. Old rules.',
  'smuggling', 'contact', 0, 25, 1200, 50,
  '[{"type": "pickup_package"}, {"type": "avoid_checkpoints"}, {"type": "deliver_package"}, {"type": "collect_payment"}]',
  30, 1, 20, true, 1, '📦'),

((SELECT id FROM factions WHERE code = 'LST'),
  'Debt Collection', 'Someone owes the families. They think HydraNet will protect them. Show them different.',
  'collection', 'associate', 100, 50, 3000, 100,
  '[{"type": "locate_debtor"}, {"type": "avoid_surveillance"}, {"type": "persuade_payment"}, {"type": "return_funds"}]',
  60, 2, 35, false, NULL, '💳'),

((SELECT id FROM factions WHERE code = 'LST'),
  'The Old Way', 'Traitor in our ranks. Council wants it handled quiet. No data trail. Make it look natural.',
  'assassination', 'member', 400, 100, 8000, 250,
  '[{"type": "identify_traitor"}, {"type": "isolate_target"}, {"type": "eliminate_quietly"}, {"type": "dispose_evidence"}]',
  120, 4, 15, true, 2, '🔪'),

((SELECT id FROM factions WHERE code = 'LST'),
  'Shipment Intercept', 'HNC convoy moving weapons through ON-10. Those belong to us now. No survivors means no witnesses.',
  'heist', 'trusted', 600, 150, 15000, 400,
  '[{"type": "scout_route"}, {"type": "set_ambush"}, {"type": "neutralize_convoy"}, {"type": "extract_cargo"}]',
  150, 4, 45, false, NULL, '🚚'),

((SELECT id FROM factions WHERE code = 'LST'),
  'Council''s Decree', 'War with HNC is coming. Strike first. Hit their credit processing center in ON-7. Cripple them financially.',
  'sabotage', 'lieutenant', 850, 250, 50000, 700,
  '[{"type": "infiltrate_financial_district"}, {"type": "bypass_security"}, {"type": "plant_devices"}, {"type": "detonate_remotely"}, {"type": "escape_lockdown"}]',
  240, 5, 70, true, 3, '💥');

-- ============================================
-- FACTION SHOPS (2091 themed items)
-- ============================================

-- NNB Shop - Community goods, survival gear
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
((SELECT id FROM factions WHERE code = 'NNB'), 'consumable', 'Organic Stims', 'Home-grown stimulants. No corporate additives. +20 energy.', 500, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'NNB'), 'equipment', 'Mesh Transponder', 'Access NNB''s off-grid network. Essential for ops.', 2500, 'associate', 150, 8),
((SELECT id FROM factions WHERE code = 'NNB'), 'consumable', 'Purified Water Cache', 'Clean water, no HNC processing. Heals 50 HP.', 800, 'associate', 100, 5),
((SELECT id FROM factions WHERE code = 'NNB'), 'equipment', 'Scavenger''s Kit', '+15% loot from supply runs. Built from recycled tech.', 8000, 'member', 350, 10),
((SELECT id FROM factions WHERE code = 'NNB'), 'service', 'Community Sanctuary', 'Safe house access for 24 hours. -50 heat.', 5000, 'member', 400, 10)
ON CONFLICT DO NOTHING;

-- FFN Shop - Hacking tools, digital goods
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
((SELECT id FROM factions WHERE code = 'FFN'), 'tool', 'Burner Identity', 'Disposable HydraNet ID. 24 hour use. Untraceable.', 3000, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'FFN'), 'tool', 'ICE Breaker v3.2', '+25% success on grid hacks. Auto-updates.', 15000, 'associate', 200, 10),
((SELECT id FROM factions WHERE code = 'FFN'), 'equipment', 'Scrambler Implant', 'Neural add-on. -30% detection on all missions.', 25000, 'member', 450, 8),
((SELECT id FROM factions WHERE code = 'FFN'), 'data', 'Executive Blackmail File', 'Leverage on HNC mid-level exec. One use.', 50000, 'trusted', 600, 5),
((SELECT id FROM factions WHERE code = 'FFN'), 'service', 'Identity Wipe', 'Erase your HydraNet records. Fresh start. Permanent.', 100000, 'lieutenant', 850, 10)
ON CONFLICT DO NOTHING;

-- HNC Shop - Corporate gear, official equipment
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
((SELECT id FROM factions WHERE code = 'HNC'), 'equipment', 'Corporate Neural Link', 'Standard HNC implant. +10% all rewards. Tracked.', 5000, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'HNC'), 'weapon', 'Enforcer Taser', 'Non-lethal takedowns. Corporate approved.', 8000, 'associate', 150, 8),
((SELECT id FROM factions WHERE code = 'HNC'), 'consumable', 'Credit Boost Stim', 'Corporate performance enhancer. +30 focus, 1 hour.', 2500, 'associate', 100, 5),
((SELECT id FROM factions WHERE code = 'HNC'), 'service', 'Record Expungement', 'Clear minor infractions from your file. Official.', 25000, 'member', 400, 10),
((SELECT id FROM factions WHERE code = 'HNC'), 'equipment', 'Executive Access Pass', 'Enter any HNC facility. Very restricted.', 150000, 'lieutenant', 800, 5)
ON CONFLICT DO NOTHING;

-- LST Shop - Weapons, contraband, old school gear
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
((SELECT id FROM factions WHERE code = 'LST'), 'weapon', 'Street Piece', 'Unregistered handgun. Old but reliable. No trace.', 5000, 'contact', 50, 5),
((SELECT id FROM factions WHERE code = 'LST'), 'consumable', 'Combat Chems', 'Black market stims. +25 damage, -10 accuracy.', 3000, 'associate', 150, 8),
((SELECT id FROM factions WHERE code = 'LST'), 'weapon', 'Council''s Blade', 'Mono-edged knife. Cuts through armor. Silent.', 12000, 'member', 350, 5),
((SELECT id FROM factions WHERE code = 'LST'), 'service', 'Muscle Backup', 'Two soldiers for 1 hour. No questions.', 10000, 'member', 400, 10),
((SELECT id FROM factions WHERE code = 'LST'), 'equipment', 'Smuggler''s Vehicle', 'Modified cargo van. Hidden compartments. EMP shielded.', 75000, 'trusted', 650, 8)
ON CONFLICT DO NOTHING;

-- ============================================
-- FACTION SAFEHOUSES (2091 themed)
-- ============================================

INSERT INTO faction_safehouses (faction_id, name, district_id, capacity, amenities, heat_reduction, healing_rate, min_rank) VALUES
-- NNB Safehouses
((SELECT id FROM factions WHERE code = 'NNB'), 'The Greenhouse', 1, 10, '["hydroponic_beds", "mesh_node", "water_purifier", "community_kitchen"]', 35, 20, 'associate'),
((SELECT id FROM factions WHERE code = 'NNB'), 'Mother June''s Haven', 2, 5, '["beds", "medical_bay", "council_room", "armory_cache"]', 50, 30, 'trusted'),

-- FFN Safehouses
((SELECT id FROM factions WHERE code = 'FFN'), 'Node Zero', 5, 6, '["server_room", "faraday_cage", "neural_chairs", "encryption_suite"]', 40, 15, 'associate'),
((SELECT id FROM factions WHERE code = 'FFN'), 'Ghost''s Archive', 12, 3, '["deep_storage", "dead_drop", "scrambler_field", "emergency_wipe"]', 60, 10, 'lieutenant'),

-- HNC Safehouses (official facilities)
((SELECT id FROM factions WHERE code = 'HNC'), 'Corporate Housing Block 7', 7, 20, '["auto_medical", "gym", "nutrition_dispenser", "monitoring_suite"]', 25, 25, 'contact'),
((SELECT id FROM factions WHERE code = 'HNC'), 'Executive Safe Room', 0, 4, '["panic_room", "direct_evac", "private_grid", "defense_turrets"]', 75, 40, 'lieutenant'),

-- LST Safehouses
((SELECT id FROM factions WHERE code = 'LST'), 'The Warehouse', 4, 12, '["stash_room", "weapons_locker", "garage", "lookout_post"]', 30, 15, 'associate'),
((SELECT id FROM factions WHERE code = 'LST'), 'Council Chamber', 10, 8, '["meeting_room", "vault", "armory", "interrogation_room", "escape_tunnel"]', 55, 25, 'trusted')
ON CONFLICT DO NOTHING;

-- ============================================
-- INITIAL FACTION RELATIONSHIPS (Wars/Tensions)
-- ============================================

INSERT INTO faction_wars (aggressor_faction_id, defender_faction_id, war_state, aggressor_score, defender_score, territories_contested) VALUES
-- HNC vs FFN - Active cold war (constant hacking vs enforcement)
((SELECT id FROM factions WHERE code = 'HNC'), (SELECT id FROM factions WHERE code = 'FFN'), 'cold_war', 250, 180, '["ON-5", "ON-6"]'),
-- HNC vs NNB - Tension (HNC wants to absorb northern territories)
((SELECT id FROM factions WHERE code = 'HNC'), (SELECT id FROM factions WHERE code = 'NNB'), 'tension', 50, 30, '["ON-1", "ON-2"]'),
-- LST vs HNC - Cold war (traditional crime vs corporate control)
((SELECT id FROM factions WHERE code = 'LST'), (SELECT id FROM factions WHERE code = 'HNC'), 'cold_war', 120, 150, '["ON-10", "ON-11"]')
ON CONFLICT (aggressor_faction_id, defender_faction_id) DO NOTHING;

-- ============================================
-- FACTION TERRITORY ASSIGNMENTS
-- ============================================

INSERT INTO faction_territories_2091 (faction_id, sector_code, control_percentage, infrastructure_control, notable_locations, daily_income, defense_rating) VALUES
-- NNB Territories
((SELECT id FROM factions WHERE code = 'NNB'), 'ON-1', 75, '{"power": 30, "water": 60, "data": 10, "transit": 40}', '["The Greenhouse", "Community Center", "Mesh Tower Alpha"]', 5000, 45),
((SELECT id FROM factions WHERE code = 'NNB'), 'ON-2', 60, '{"power": 20, "water": 50, "data": 5, "transit": 30}', '["Northern Markets", "Mother June''s Haven"]', 3500, 40),
((SELECT id FROM factions WHERE code = 'NNB'), 'ON-3', 40, '{"power": 15, "water": 30, "data": 5, "transit": 20}', '["Water Tower Relay", "Scavenger Camp"]', 2000, 30),

-- FFN Territories
((SELECT id FROM factions WHERE code = 'FFN'), 'ON-5', 65, '{"power": 25, "water": 20, "data": 90, "transit": 15}', '["Node Zero", "Data Bazaar", "The Archive"]', 8000, 55),
((SELECT id FROM factions WHERE code = 'FFN'), 'ON-6', 45, '{"power": 20, "water": 15, "data": 70, "transit": 10}', '["Signal Station", "Darknet Exchange"]', 5500, 40),
((SELECT id FROM factions WHERE code = 'FFN'), 'ON-12', 55, '{"power": 30, "water": 25, "data": 85, "transit": 20}', '["Ghost''s Archive", "Encrypted Row"]', 6500, 50),

-- HNC Territories
((SELECT id FROM factions WHERE code = 'HNC'), 'ON-0', 95, '{"power": 100, "water": 100, "data": 100, "transit": 100}', '["Sterling Tower", "Central Grid Hub", "CEO Residence"]', 50000, 95),
((SELECT id FROM factions WHERE code = 'HNC'), 'ON-7', 85, '{"power": 90, "water": 90, "data": 95, "transit": 85}', '["Financial District", "Corporate Housing"]', 35000, 85),
((SELECT id FROM factions WHERE code = 'HNC'), 'ON-8', 80, '{"power": 85, "water": 85, "data": 90, "transit": 80}', '["Industrial Complex", "Processing Center"]', 25000, 75),
((SELECT id FROM factions WHERE code = 'HNC'), 'ON-9', 70, '{"power": 80, "water": 75, "data": 85, "transit": 70}', '["Transit Hub", "Enforcement HQ"]', 20000, 70),

-- LST Territories
((SELECT id FROM factions WHERE code = 'LST'), 'ON-4', 70, '{"power": 40, "water": 35, "data": 20, "transit": 50}', '["The Warehouse", "Old Docks", "Fight Club"]', 12000, 60),
((SELECT id FROM factions WHERE code = 'LST'), 'ON-10', 65, '{"power": 35, "water": 30, "data": 15, "transit": 45}', '["Smuggler''s Row", "Council Chamber"]', 10000, 55),
((SELECT id FROM factions WHERE code = 'LST'), 'ON-11', 55, '{"power": 30, "water": 25, "data": 10, "transit": 40}', '["Black Market", "Arms Depot"]', 8000, 50),
((SELECT id FROM factions WHERE code = 'LST'), 'ON-14', 45, '{"power": 25, "water": 20, "data": 5, "transit": 35}', '["Border Crossing", "Caravan Stop"]', 6000, 45)
ON CONFLICT DO NOTHING;

-- ============================================
-- FACTION RESOURCES INITIAL STATE
-- ============================================

INSERT INTO faction_resources (faction_id, resource_type, quantity, production_rate, consumption_rate, trade_value) VALUES
-- NNB Resources
((SELECT id FROM factions WHERE code = 'NNB'), 'organic_goods', 5000, 200, 150, 80),
((SELECT id FROM factions WHERE code = 'NNB'), 'clean_water', 3000, 100, 120, 120),
((SELECT id FROM factions WHERE code = 'NNB'), 'nuclear_cells', 500, 10, 50, 200),

-- FFN Resources
((SELECT id FROM factions WHERE code = 'FFN'), 'data_packets', 10000, 500, 300, 150),
((SELECT id FROM factions WHERE code = 'FFN'), 'credits', 2000000, 50000, 40000, 1),
((SELECT id FROM factions WHERE code = 'FFN'), 'nuclear_cells', 800, 20, 80, 200),

-- HNC Resources
((SELECT id FROM factions WHERE code = 'HNC'), 'credits', 50000000, 500000, 300000, 1),
((SELECT id FROM factions WHERE code = 'HNC'), 'nuclear_cells', 50000, 2000, 1500, 150),
((SELECT id FROM factions WHERE code = 'HNC'), 'clean_water', 100000, 5000, 4000, 50),

-- LST Resources
((SELECT id FROM factions WHERE code = 'LST'), 'contraband', 8000, 300, 250, 180),
((SELECT id FROM factions WHERE code = 'LST'), 'weapons', 5000, 100, 80, 250),
((SELECT id FROM factions WHERE code = 'LST'), 'credits', 15000000, 100000, 120000, 1)
ON CONFLICT (faction_id, resource_type) DO NOTHING;
