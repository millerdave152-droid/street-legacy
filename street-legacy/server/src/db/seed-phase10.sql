-- Phase 10: Factions and Reputation Seed Data

-- ============================================
-- FACTIONS
-- ============================================

-- STREET GANGS
INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
('Northside Kings', 'gang', '[1, 2]', 'Street dominance, loyalty above all',
'Born in the housing projects of North York, the Northside Kings started as a group of teenagers defending their block. Now they control a significant portion of the north end, dealing in street-level drugs and running protection rackets. Young, aggressive, and hungry for respect.',
'#FFD700', '👑', '{"2": 300, "3": 200}', 45, 150000, 120, 3),

('Scarborough Bloods', 'gang', '[3, 4]', 'Blood in, blood out. Family first.',
'The Scarborough Bloods emerged from the Jamaican immigrant community in the 90s. They''ve built an empire on the drug trade, particularly cocaine and crack distribution. Known for their brutal enforcement and tight-knit family structure.',
'#DC143C', '🩸', '{"1": 300, "4": 150}', 50, 200000, 150, 5),

('Queen Street Crew', 'gang', '[5, 6]', 'Smart money, clean hands',
'Not your typical gang - the Queen Street Crew are hipster criminals who operate in the arts district. They specialize in identity theft, credit card fraud, and high-tech scams. They look down on "street" criminals but aren''t afraid to get violent when needed.',
'#9370DB', '💻', '{"7": 100}', 35, 500000, 45, 8);

-- ORGANIZED CRIME
INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
('The Commission', 'mafia', '[7, 8, 9]', 'Tradition, respect, omertà',
'The Commission represents the old guard - Italian families who''ve controlled organized crime in Toronto for generations. They deal in everything: gambling, loan sharking, unions, construction. They see themselves as businessmen, not criminals. Respect is everything.',
'#1C1C1C', '🎩', '{"5": 400, "6": 200}', 75, 5000000, 200, 10),

('Bratva Toronto', 'mafia', '[10, 11]', 'Strength through unity, profit through fear',
'Russian organized crime arrived in Toronto after the Soviet collapse. The Bratva deals in weapons trafficking, human trafficking, and cybercrime. They''re known for extreme violence and connections to the motherland. Their soldiers are often ex-military.',
'#B22222', '🐻', '{"4": 400, "7": 300}', 65, 3000000, 80, 12),

('14K Triad', 'syndicate', '[12, 13]', 'Ancient traditions, modern methods',
'Branch of the Hong Kong 14K Triad, established in Toronto''s Chinatown decades ago. They control gambling dens, import/export "businesses", and have deep connections to overseas operations. Highly secretive, with elaborate initiation rituals.',
'#FFD700', '🐉', '{"5": 200}', 70, 4000000, 150, 15);

-- CARTELS
INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
('Los Diablos', 'cartel', '[14, 15]', 'Plata o plomo - silver or lead',
'Representatives of a major Mexican cartel, Los Diablos handle wholesale drug distribution for the entire GTA. They don''t deal retail - they supply everyone else. Cross them and your family back in Mexico might have visitors. Extremely dangerous, extremely wealthy.',
'#228B22', '😈', '{"8": 500, "9": 300}', 85, 10000000, 60, 20),

('Kingston Connect', 'cartel', '[16, 17]', 'One love, one blood, one business',
'The Caribbean connection - a loose network of Jamaican posses who control marijuana and gun imports. They have connections throughout the islands and run legitimate businesses as fronts. Known for their reggae clubs and violent enforcement.',
'#008000', '🦁', '{"2": 200, "8": 150}', 55, 2000000, 100, 10);

-- CORPORATE
INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
('Sterling Industries', 'corporate', '[18, 19]', 'Everything has a price',
'On paper, Sterling Industries is a legitimate holding company with interests in real estate, finance, and consulting. In reality, they''re the white-collar crime syndicate - money laundering, securities fraud, bribery, and corporate espionage. They own politicians and police.',
'#4169E1', '💼', '{}', 80, 50000000, 30, 25),

('DataVault Inc', 'corporate', '[20]', 'Information is the ultimate currency',
'A tech company specializing in "data security" - which means they know how to steal it. DataVault runs ransomware operations, sells zero-day exploits, and maintains a network of hackers worldwide. Their downtown office looks completely legitimate.',
'#00CED1', '🔐', '{"3": 100}', 60, 8000000, 25, 20);

-- ============================================
-- FACTION MISSIONS
-- ============================================

-- Northside Kings Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(1, 'Corner Collection', 'One of our corner boys is holding out. Go remind him who he works for.', 'collection', 'outsider', 0, 25, 500, 50, '[{"type": "visit_location", "target": "corner_store"}, {"type": "intimidate", "target": "dealer_npc"}]', 30, 1, true, 1, '💰'),
(1, 'Block Party Crasher', 'The Bloods are trying to set up on our turf. Show them this is King territory.', 'enforcement', 'associate', 100, 50, 1500, 100, '[{"type": "defeat_enemies", "count": 3, "faction": 2}]', 45, 2, false, NULL, '👊'),
(1, 'Crown Initiation', 'Time to earn your crown. Rob the corner store on Blood turf without getting caught.', 'heist', 'associate', 300, 100, 3000, 200, '[{"type": "rob_location", "district": 3}, {"type": "escape_heat", "max_wanted": 2}]', 60, 3, true, 2, '👑'),
(1, 'Territory Defense', 'Bloods are pushing hard. Hold down the block for the next hour.', 'defense', 'member', 500, 75, 2500, 150, '[{"type": "defend_territory", "duration_minutes": 60}]', 90, 3, false, NULL, '🛡️'),
(1, 'King''s Ransom', 'We''re taking over their trap house. Lead the assault.', 'war', 'made', 700, 150, 10000, 500, '[{"type": "capture_poi", "target": "trap_house"}, {"type": "defeat_boss"}]', 120, 5, true, 3, '⚔️');

-- Scarborough Bloods Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, enemy_faction_id, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(2, 'Package Delivery', 'Take this package to the address. Don''t open it, don''t ask questions.', 'smuggling', 'outsider', 0, 25, 800, 50, NULL, '[{"type": "deliver_item", "item": "package"}]', 20, 1, true, 1, '📦'),
(2, 'Blood Oath', 'To join us, you need to put in work. Handle this snitch.', 'enforcement', 'associate', 100, 75, 2000, 150, NULL, '[{"type": "eliminate_target", "target": "snitch_npc"}]', 45, 3, true, 2, '🔪'),
(2, 'Turf War', 'The Kings keep disrespecting. Time to push back.', 'war', 'member', 400, 100, 5000, 250, 1, '[{"type": "defeat_enemies", "count": 5, "faction": 1}]', 60, 4, false, NULL, '💥'),
(2, 'Supply Run', 'Pick up the shipment from the port. Watch for cops.', 'smuggling', 'member', 500, 60, 3000, 200, NULL, '[{"type": "pickup_item", "location": "port"}, {"type": "deliver_item", "location": "stash_house"}, {"type": "avoid_police"}]', 45, 3, false, NULL, '🚗'),
(2, 'Takeover', 'We''re expanding into North York. Lead the crew.', 'expansion', 'captain', 800, 200, 15000, 600, 1, '[{"type": "capture_territory", "district": 2}]', 180, 5, true, 3, '🩸');

-- Queen Street Crew Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(3, 'Data Mining', 'We need credit card numbers from this coffee shop''s POS system. Be subtle.', 'heist', 'outsider', 0, 30, 1000, 75, '[{"type": "hack_target", "location": "coffee_shop"}, {"type": "avoid_detection"}]', 30, 2, true, 1, '💳'),
(3, 'Identity Acquisition', 'Get into this mark''s apartment and clone their identity. Everything - SSN, credit, the works.', 'heist', 'associate', 150, 60, 3000, 150, '[{"type": "break_in", "location": "apartment"}, {"type": "steal_documents"}, {"type": "escape_undetected"}]', 45, 3, false, NULL, '🎭'),
(3, 'Art Heist', 'There''s a Basquiat in that gallery worth millions. Our buyer is waiting.', 'heist', 'member', 400, 100, 25000, 400, '[{"type": "case_location"}, {"type": "disable_security"}, {"type": "steal_item", "item": "painting"}, {"type": "escape"}]', 90, 4, true, 2, '🖼️'),
(3, 'Corporate Espionage', 'Sterling Industries has files we need. Infiltrate their servers.', 'sabotage', 'made', 600, 150, 50000, 600, '[{"type": "infiltrate_building"}, {"type": "hack_mainframe"}, {"type": "extract_data"}, {"type": "escape_undetected"}]', 120, 5, true, 3, '🔓');

-- The Commission Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(4, 'Collections', 'Mr. Rosetti owes us $50,000. He''s been avoiding calls. Make him answer.', 'collection', 'outsider', 0, 25, 2000, 100, '[{"type": "visit_location", "target": "restaurant"}, {"type": "intimidate", "target": "rosetti_npc"}, {"type": "collect_debt", "amount": 50000}]', 60, 2, true, 1, '💰'),
(4, 'Union Business', 'The dockworkers are getting ideas. Remind them who really runs the union.', 'enforcement', 'associate', 200, 50, 5000, 200, '[{"type": "visit_location", "target": "docks"}, {"type": "intimidate_group"}]', 45, 3, false, NULL, '🔨'),
(4, 'Made Man Ceremony', 'You''ve proven yourself. Come to the restaurant tonight. Dress nice.', 'recruitment', 'member', 500, 150, 10000, 500, '[{"type": "attend_ceremony"}, {"type": "take_oath"}]', 30, 2, true, 2, '🎩'),
(4, 'Russian Problem', 'The Bratva is moving product through our docks without paying tribute. This cannot stand.', 'war', 'made', 700, 200, 25000, 750, '[{"type": "destroy_shipment"}, {"type": "send_message", "target": "bratva_captain"}]', 120, 5, false, NULL, '⚔️'),
(4, 'The Big Score', 'Casino heist. Old school. We''ve got a man inside. Don''t mess this up.', 'heist', 'captain', 850, 300, 100000, 1000, '[{"type": "infiltrate_casino"}, {"type": "access_vault"}, {"type": "escape_with_money", "min_amount": 500000}]', 180, 5, true, 3, '🎰');

-- Bratva Toronto Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, enemy_faction_id, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(5, 'Weapons Delivery', 'Crate of AKs coming through customs. Pick up, deliver, no questions.', 'smuggling', 'outsider', 0, 30, 3000, 100, NULL, '[{"type": "pickup_item", "location": "warehouse"}, {"type": "deliver_item", "location": "safehouse"}, {"type": "avoid_police"}]', 45, 2, true, 1, '🔫'),
(5, 'Debt Collection - Bratva Style', 'This man owes us money and thinks he can hide. Find him. Make example.', 'enforcement', 'associate', 150, 75, 5000, 200, NULL, '[{"type": "find_target"}, {"type": "eliminate_target"}]', 60, 3, false, NULL, '💀'),
(5, 'Italian Job', 'Commission thinks they own the docks. Time to show them who is stronger.', 'war', 'member', 400, 100, 10000, 400, 4, '[{"type": "attack_poi", "target": "commission_warehouse"}, {"type": "defeat_enemies", "count": 5}]', 90, 4, false, NULL, '🐻'),
(5, 'Cyber Operation', 'Our friends in Moscow need access to Canadian banking systems. Make it happen.', 'sabotage', 'made', 650, 150, 30000, 600, NULL, '[{"type": "infiltrate_bank"}, {"type": "install_backdoor"}, {"type": "escape_undetected"}]', 120, 5, true, 2, '💻'),
(5, 'Vor Initiation', 'To become Vor v Zakone, you must pass the test. Kill the traitor in our ranks.', 'assassination', 'made', 800, 250, 50000, 800, NULL, '[{"type": "identify_traitor"}, {"type": "eliminate_target"}, {"type": "dispose_evidence"}]', 180, 5, true, 3, '⭐');

-- 14K Triad Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(6, 'Dragon''s Errand', 'Deliver this envelope to the Golden Dragon restaurant. Speak to no one.', 'smuggling', 'outsider', 0, 20, 1000, 50, '[{"type": "deliver_item", "location": "golden_dragon"}]', 20, 1, true, 1, '✉️'),
(6, 'Gambling Den Protection', 'Our Mahjong parlor is being watched. Deal with the informant.', 'enforcement', 'associate', 150, 60, 4000, 200, '[{"type": "identify_informant"}, {"type": "eliminate_target"}]', 60, 3, false, NULL, '🀄'),
(6, 'Dragon Head Trial', 'The Dragon Head wishes to test your loyalty. Retrieve the jade statue from the museum.', 'heist', 'member', 450, 125, 20000, 500, '[{"type": "infiltrate_museum"}, {"type": "disable_security"}, {"type": "steal_item", "item": "jade_statue"}, {"type": "escape"}]', 120, 4, true, 2, '🐉'),
(6, 'Hong Kong Connection', 'Shipment coming from Hong Kong. Very valuable. Very dangerous if lost.', 'smuggling', 'made', 650, 175, 40000, 700, '[{"type": "secure_port_access"}, {"type": "pickup_shipment"}, {"type": "deliver_to_warehouse"}, {"type": "eliminate_witnesses"}]', 150, 5, false, NULL, '🚢'),
(6, 'Red Pole Ceremony', 'You have earned the rank of Red Pole - enforcer of the 14K. Prove yourself in combat.', 'enforcement', 'made', 850, 250, 75000, 900, '[{"type": "defeat_champion"}, {"type": "take_oath"}, {"type": "receive_mark"}]', 60, 5, true, 3, '🔴');

-- Los Diablos Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(7, 'Mule Run', 'Cross the border with this package. You don''t want to know what happens if you fail.', 'smuggling', 'outsider', 0, 35, 5000, 100, '[{"type": "cross_border"}, {"type": "avoid_inspection"}, {"type": "deliver_package"}]', 60, 3, true, 1, '📦'),
(7, 'Competitor Elimination', 'Another supplier is undercutting our prices. This is bad for business. End their business.', 'enforcement', 'associate', 200, 100, 15000, 300, '[{"type": "locate_stash_house"}, {"type": "destroy_product"}, {"type": "eliminate_crew"}]', 90, 4, false, NULL, '💀'),
(7, 'Cartel Justice', 'A dealer has been skimming. In Mexico, we would skin him alive. Here, be creative.', 'assassination', 'member', 500, 150, 25000, 500, '[{"type": "find_target"}, {"type": "interrogate"}, {"type": "execute"}, {"type": "send_message"}]', 120, 4, true, 2, '😈'),
(7, 'Wholesale Takeover', 'We''re eliminating middle-men. Take over distribution for the entire east side.', 'expansion', 'captain', 800, 300, 100000, 1000, '[{"type": "eliminate_distributors", "count": 5}, {"type": "recruit_dealers", "count": 10}, {"type": "establish_supply_route"}]', 240, 5, true, 3, '🌎');

-- Kingston Connect Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(8, 'Herb Transport', 'Pick up the ganja from the grow op and bring it to the club. Easy money, bredren.', 'smuggling', 'outsider', 0, 25, 2000, 75, '[{"type": "pickup_item", "location": "grow_op"}, {"type": "deliver_item", "location": "reggae_club"}]', 30, 1, true, 1, '🌿'),
(8, 'Sound System Defense', 'Rival crew trying to shut down our dance. Make sure the music keeps playing.', 'defense', 'associate', 150, 50, 3000, 150, '[{"type": "defend_location", "duration": 60}]', 90, 2, false, NULL, '🔊'),
(8, 'Gun Runner', 'Shipment of pieces coming from Jamaica. Meet the boat, distribute the goods.', 'smuggling', 'member', 400, 100, 10000, 300, '[{"type": "meet_boat"}, {"type": "avoid_coast_guard"}, {"type": "distribute_weapons", "locations": 3}]', 120, 4, true, 2, '🔫'),
(8, 'Yardie Justice', 'This bwoy disrespected the Don. Find him and teach him respect.', 'enforcement', 'made', 650, 150, 20000, 500, '[{"type": "hunt_target"}, {"type": "public_execution"}]', 90, 4, false, NULL, '🦁'),
(8, 'Island Connection', 'Establish new route from Kingston. Big opportunity, big risk.', 'expansion', 'captain', 850, 250, 75000, 800, '[{"type": "travel_to_jamaica"}, {"type": "negotiate_with_don"}, {"type": "establish_route"}, {"type": "first_shipment"}]', 300, 5, true, 3, '🏝️');

-- Sterling Industries Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(9, 'Document Acquisition', 'We need certain documents from City Hall. Use your discretion.', 'heist', 'outsider', 0, 30, 5000, 100, '[{"type": "infiltrate_building"}, {"type": "access_records"}, {"type": "copy_documents"}, {"type": "leave_no_trace"}]', 60, 2, true, 1, '📄'),
(9, 'Hostile Takeover', 'Acquire compromising information on this CEO. We''re acquiring his company.', 'sabotage', 'associate', 200, 75, 20000, 300, '[{"type": "surveil_target"}, {"type": "gather_evidence"}, {"type": "plant_evidence"}]', 120, 3, false, NULL, '💼'),
(9, 'Political Investment', 'Councilman needs persuading on the zoning vote. Money didn''t work. Try another approach.', 'enforcement', 'member', 450, 100, 50000, 500, '[{"type": "gather_leverage"}, {"type": "confront_target"}, {"type": "secure_vote"}]', 180, 4, true, 2, '🏛️'),
(9, 'Clean Sweep', 'Federal investigation getting too close. Time to clean house.', 'sabotage', 'made', 700, 200, 100000, 800, '[{"type": "identify_investigators"}, {"type": "destroy_evidence"}, {"type": "discredit_witnesses"}]', 240, 5, false, NULL, '🧹'),
(9, 'Board Seat', 'You''ve proven useful. Time to make it official. Handle this last problem.', 'assassination', 'captain', 900, 300, 250000, 1000, '[{"type": "eliminate_board_member"}, {"type": "stage_accident"}, {"type": "attend_funeral"}]', 300, 5, true, 3, '👔');

-- DataVault Inc Missions
INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, time_limit_minutes, difficulty, is_story_mission, story_order, icon) VALUES
(10, 'Zero-Day Test', 'We have a new exploit. Test it on this small business. Document results.', 'sabotage', 'outsider', 0, 25, 3000, 100, '[{"type": "deploy_malware"}, {"type": "document_access"}, {"type": "clean_logs"}]', 45, 2, true, 1, '🔐'),
(10, 'Ransomware Deployment', 'Hospital IT systems are vulnerable. Deploy our package. They''ll pay.', 'sabotage', 'associate', 150, 60, 15000, 250, '[{"type": "infiltrate_network"}, {"type": "deploy_ransomware"}, {"type": "manage_negotiation"}]', 90, 3, false, NULL, '💉'),
(10, 'Data Extraction', 'Defense contractor has files we can sell. Get in, get data, get out.', 'heist', 'member', 400, 100, 50000, 500, '[{"type": "bypass_air_gap"}, {"type": "extract_classified_data"}, {"type": "exfiltrate_safely"}]', 150, 4, true, 2, '🔓'),
(10, 'Infrastructure Attack', 'Client wants power grid access. Make it happen.', 'sabotage', 'made', 700, 175, 100000, 750, '[{"type": "map_scada_systems"}, {"type": "deploy_backdoor"}, {"type": "demonstrate_access"}]', 240, 5, false, NULL, '⚡'),
(10, 'The Architect', 'Design the perfect attack. Target: major bank. Goal: complete control.', 'heist', 'captain', 900, 300, 500000, 1000, '[{"type": "design_attack_vector"}, {"type": "assemble_team"}, {"type": "execute_heist"}, {"type": "launder_proceeds"}]', 360, 5, true, 3, '🏗️');

-- ============================================
-- FACTION SHOP ITEMS
-- ============================================

-- Northside Kings Shop
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
(1, 'weapon', 'King''s Glock', 'Gold-plated Glock 19. Status symbol.', 5000, 'associate', 100, 5),
(1, 'drug', 'Premium Loud', 'Best weed in North York.', 500, 'associate', 100, 10),
(1, 'service', 'Crown Protection', '24hr crew protection in King territory.', 2500, 'member', 300, 5),
(1, 'vehicle', 'King''s Crown Vic', 'Blacked out Crown Vic. Crew approved.', 25000, 'made', 500, 10);

-- Scarborough Bloods Shop
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
(2, 'weapon', 'Blood Mac-10', 'Compact and deadly.', 8000, 'associate', 100, 5),
(2, 'drug', 'Pure Rock', 'Uncut cocaine. The real deal.', 2000, 'member', 300, 10),
(2, 'service', 'Blood Oath Backup', 'Call in the homies when needed.', 5000, 'member', 400, 5);

-- The Commission Shop
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
(4, 'weapon', 'Commission Special', 'Untraceable revolver. Old school.', 15000, 'member', 400, 5),
(4, 'service', 'Legal Representation', 'Our lawyers. Very good. Very expensive.', 25000, 'associate', 200, 10),
(4, 'service', 'Commission Loan', 'Need money? We provide. Interest reasonable.', 50000, 'member', 400, 5),
(4, 'property', 'Restaurant Front', 'Legitimate business. Good for laundering.', 250000, 'made', 600, 10);

-- Bratva Shop
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
(5, 'weapon', 'AK-47', 'Classic Russian engineering.', 12000, 'associate', 150, 5),
(5, 'weapon', 'Dragunov SVD', 'For long-range problems.', 35000, 'made', 600, 5),
(5, 'armor', 'Russian Plate Carrier', 'Military grade protection.', 20000, 'member', 400, 10);

-- Los Diablos Shop
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
(7, 'drug', 'Cartel Grade', 'Direct from source. 95% pure.', 5000, 'associate', 200, 15),
(7, 'weapon', 'Cartel AR-15', 'Custom narco rifle. Gold accents.', 25000, 'member', 500, 5),
(7, 'service', 'Sicario Contract', 'Professional elimination service.', 100000, 'captain', 800, 10);

-- DataVault Shop
INSERT INTO faction_shop_items (faction_id, item_type, name, description, base_price, min_rank, min_reputation, discount_per_rank) VALUES
(10, 'tool', 'Zero-Day Exploit Kit', 'Latest vulnerabilities. Limited use.', 50000, 'member', 400, 5),
(10, 'tool', 'Identity Package', 'Complete fake identity. Passport included.', 25000, 'associate', 200, 10),
(10, 'service', 'Digital Cleanup', 'Erase your digital footprint.', 10000, 'associate', 150, 5);

-- ============================================
-- FACTION SAFEHOUSES
-- ============================================

INSERT INTO faction_safehouses (faction_id, name, district_id, capacity, amenities, heat_reduction, healing_rate, min_rank) VALUES
(1, 'King''s Court Apartment', 1, 5, '["beds", "stash", "weapons_locker"]', 25, 15, 'associate'),
(2, 'Blood Manor', 3, 8, '["beds", "stash", "medical", "weapons_locker"]', 30, 20, 'associate'),
(3, 'The Loft', 5, 4, '["beds", "computers", "stash"]', 20, 10, 'member'),
(4, 'Commission Clubhouse', 7, 10, '["beds", "stash", "medical", "weapons_locker", "meeting_room"]', 40, 25, 'member'),
(5, 'Bratva Bunker', 10, 6, '["beds", "weapons_locker", "armory", "interrogation"]', 35, 15, 'member'),
(6, '14K Temple', 12, 8, '["beds", "stash", "medical", "shrine"]', 30, 20, 'member'),
(7, 'Diablo Compound', 14, 4, '["beds", "armory", "tunnel", "medical"]', 50, 30, 'made'),
(8, 'Yard House', 16, 6, '["beds", "stash", "studio"]', 25, 15, 'associate'),
(9, 'Sterling Penthouse', 18, 3, '["beds", "office", "panic_room"]', 45, 25, 'made'),
(10, 'DataVault Bunker', 20, 4, '["beds", "server_room", "faraday_cage"]', 35, 10, 'member');

-- ============================================
-- INITIAL FACTION WARS (TENSIONS)
-- ============================================

INSERT INTO faction_wars (aggressor_faction_id, defender_faction_id, war_state, aggressor_score, defender_score) VALUES
(1, 2, 'hot_war', 150, 180),
(4, 5, 'cold_war', 50, 75),
(7, 8, 'tension', 20, 15);
