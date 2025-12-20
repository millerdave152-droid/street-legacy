-- Phase 8: Crew Wars and Territory Control Seed Data

-- War Missions
INSERT INTO war_missions (name, description, mission_type, points_reward, cash_reward, xp_reward, stamina_cost, focus_cost, min_level, required_role, cooldown_minutes, success_rate, target_type, icon) VALUES
-- Assassination missions
('Assassinate Target', 'Hunt down and eliminate a specific rival crew member', 'assassination', 100, 5000, 500, 30, 20, 10, NULL, 60, 60, 'player', '🎯'),
('Execute Lieutenant', 'Take out a rival crew''s ranked member', 'assassination', 150, 8000, 750, 35, 25, 15, 'soldier', 90, 50, 'ranked_player', '💀'),

-- Sabotage missions
('Sabotage Operation', 'Destroy rival crew''s product or equipment', 'sabotage', 75, 3000, 400, 25, 15, 8, NULL, 45, 70, 'operation', '💣'),
('Burn Stash House', 'Set fire to rival''s storage location', 'sabotage', 100, 5000, 500, 30, 20, 12, 'engineer', 60, 65, 'property', '🔥'),
('Poison Supply', 'Contaminate rival''s drug supply', 'sabotage', 80, 4000, 450, 25, 20, 10, NULL, 50, 60, 'supply', '☠️'),

-- Intel missions
('Flip Informant', 'Turn a rival''s NPC contact to your side', 'intel', 50, 2000, 300, 20, 25, 8, 'spy', 40, 65, 'npc', '🕵️'),
('Gather Intel', 'Spy on rival crew movements', 'intel', 40, 1500, 250, 15, 20, 5, 'spy', 30, 80, 'crew', '📡'),
('Intercept Communications', 'Tap into rival crew''s chat', 'intel', 60, 2500, 350, 20, 30, 12, 'spy', 45, 55, 'comms', '📱'),

-- Defense missions
('Protect Shipment', 'Defend crew cargo from interception', 'defense', 60, 3000, 350, 25, 15, 8, NULL, 40, 75, 'cargo', '🛡️'),
('Guard POI', 'Defend a strategic point of interest', 'defense', 50, 2000, 300, 20, 10, 5, NULL, 30, 80, 'poi', '🏰'),
('Escort VIP', 'Safely transport crew leader', 'defense', 80, 4000, 450, 30, 20, 12, 'captain', 60, 70, 'vip', '🚗'),

-- Capture missions
('Tag Territory', 'Vandalize rival property to mark territory', 'capture', 25, 500, 150, 10, 5, 3, NULL, 15, 90, 'property', '🎨'),
('Plant Flag', 'Establish crew presence at location', 'capture', 35, 1000, 200, 15, 10, 5, NULL, 20, 85, 'poi', '🚩'),
('Seize POI', 'Take control of strategic location', 'capture', 100, 5000, 500, 30, 20, 10, NULL, 45, 60, 'poi', '⚔️'),

-- Combat missions
('Ambush Patrol', 'Attack rival crew members on patrol', 'combat', 80, 4000, 450, 30, 15, 10, 'soldier', 45, 65, 'patrol', '🔫'),
('Street Brawl', 'Engage rivals in open combat', 'combat', 60, 3000, 350, 25, 10, 8, NULL, 30, 70, 'combat', '👊'),
('Drive-By', 'Hit and run attack on rival position', 'combat', 90, 4500, 475, 30, 15, 12, NULL, 50, 60, 'position', '🚙'),

-- Support missions (Medic/Engineer specific)
('Heal Wounded', 'Patch up injured crew members', 'support', 30, 1000, 200, 10, 20, 5, 'medic', 20, 90, 'ally', '💊'),
('Revive Fallen', 'Get downed crew member back in action', 'support', 50, 2000, 300, 20, 30, 10, 'medic', 40, 75, 'ally', '❤️‍🩹'),
('Hack Security', 'Disable rival security systems', 'support', 45, 1500, 250, 15, 25, 8, 'engineer', 30, 70, 'security', '💻'),
('Fortify Position', 'Strengthen crew defenses', 'support', 40, 1000, 200, 20, 15, 8, 'engineer', 35, 85, 'defense', '🏗️'),

-- High value missions
('Raid Crew Bank', 'Steal from rival crew treasury', 'raid', 200, 10000, 1000, 40, 30, 20, 'captain', 120, 40, 'bank', '🏦'),
('Capture Leader', 'Kidnap rival crew leader', 'raid', 250, 15000, 1500, 50, 40, 25, 'warlord', 180, 30, 'leader', '👑');

-- Default crew rank templates (will be copied when crews are created or upgraded)
-- These serve as templates - actual ranks are created per crew

-- Update points_of_interest with strategic values for wars
UPDATE points_of_interest SET
  metadata = COALESCE(metadata, '{}'::jsonb) ||
  CASE
    WHEN type IN ('bank', 'warehouse', 'port') THEN '{"strategic_value": 2, "capture_time_minutes": 15}'::jsonb
    WHEN type IN ('nightclub', 'casino', 'headquarters') THEN '{"strategic_value": 2, "capture_time_minutes": 12}'::jsonb
    WHEN type IN ('safehouse', 'garage', 'hospital') THEN '{"strategic_value": 1, "capture_time_minutes": 10}'::jsonb
    ELSE '{"strategic_value": 1, "capture_time_minutes": 10}'::jsonb
  END
WHERE metadata IS NULL OR NOT (metadata ? 'strategic_value');

-- Set up adjacent districts (example - adjust based on your map)
UPDATE districts SET adjacent_districts =
  CASE id
    WHEN 1 THEN ARRAY[2, 3]
    WHEN 2 THEN ARRAY[1, 3, 4]
    WHEN 3 THEN ARRAY[1, 2, 4, 5]
    WHEN 4 THEN ARRAY[2, 3, 5, 6]
    WHEN 5 THEN ARRAY[3, 4, 6, 7]
    WHEN 6 THEN ARRAY[4, 5, 7, 8]
    WHEN 7 THEN ARRAY[5, 6, 8]
    WHEN 8 THEN ARRAY[6, 7]
    ELSE ARRAY[]::INTEGER[]
  END
WHERE adjacent_districts = '{}' OR adjacent_districts IS NULL;

-- Initialize crew war stats for existing crews
INSERT INTO crew_war_stats (crew_id)
SELECT id FROM crews
WHERE id NOT IN (SELECT crew_id FROM crew_war_stats)
ON CONFLICT (crew_id) DO NOTHING;

-- Territory bonuses by control percentage (reference data)
COMMENT ON TABLE territory_wars IS '
Territory Control Benefits:
- 25%: Crew name on map, +5% income in district
- 50%: Access to district safehouse, +10% income
- 75%: Reduce rival crew success rates by 10%, +15% income
- 100%: Full control, +25% income, special operations unlocked

War Point Earning:
- Successful crime in district: +10 points
- Kill rival crew member: +50 points
- Capture POI: +100 points
- Complete war mission: +25-200 points
- Defend POI from capture: +75 points

War Declaration:
- Costs crew bank: $100,000
- Can only declare on adjacent territories
- Defender has 24hr prep time
- War lasts 48-72 hours
- Winner takes territory
';
