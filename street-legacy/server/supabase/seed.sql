-- Street Legacy: Seed Data
-- Populates all reference tables with game data
-- Based on shared/src/config/game-constants.ts and districts.ts

-- =============================================================================
-- 1. DISTRICTS - All 16 Toronto Districts
-- =============================================================================

INSERT INTO districts (id, name, description, total_parcels, difficulty, base_property_price, economy_level, police_presence, crime_rate, is_starter_district) VALUES
('scarborough', 'Scarborough', 'Eastern suburb with diverse communities and plenty of opportunity for those starting out.', 500, 1, 10000, 40, 30, 60, TRUE),
('etobicoke', 'Etobicoke', 'Western suburb with industrial areas and residential neighborhoods. Good for beginners.', 450, 1, 12000, 45, 35, 55, TRUE),
('north_york', 'North York', 'Large northern district with mix of residential and commercial zones.', 400, 2, 25000, 55, 50, 45, FALSE),
('east_york', 'East York', 'Quiet residential area with growing business opportunities.', 300, 2, 20000, 50, 45, 50, FALSE),
('york', 'York', 'Central-west district with working class roots and tight-knit communities.', 350, 2, 18000, 45, 40, 55, FALSE),
('queen_west', 'Queen West', 'Trendy arts district with boutiques, galleries, and nightlife.', 200, 3, 50000, 65, 55, 40, FALSE),
('kensington', 'Kensington Market', 'Bohemian neighborhood with vintage shops and diverse food scene.', 150, 3, 45000, 60, 45, 50, FALSE),
('chinatown', 'Chinatown', 'Vibrant cultural hub with restaurants, shops, and traditional businesses.', 150, 3, 40000, 60, 50, 45, FALSE),
('downtown', 'Downtown Core', 'Heart of the city. High risk, high reward. Corporate towers and urban density.', 250, 4, 100000, 80, 70, 35, FALSE),
('entertainment', 'Entertainment District', 'Clubs, theaters, and sports venues. Money flows freely after dark.', 150, 4, 80000, 75, 65, 40, FALSE),
('yorkville', 'Yorkville', 'Luxury shopping and high-end residences. Old money and new wealth collide.', 100, 4, 150000, 85, 80, 20, FALSE),
('financial', 'Financial District', 'Bay Street towers and corporate headquarters. The big leagues.', 100, 5, 200000, 90, 85, 15, FALSE),
('waterfront', 'Waterfront', 'Condos and marinas along the lake. Tourism and shipping.', 150, 3, 60000, 70, 60, 35, FALSE),
('distillery', 'Distillery District', 'Historic area turned trendy. Galleries, restaurants, and events.', 75, 3, 55000, 65, 55, 30, FALSE),
('liberty', 'Liberty Village', 'Converted industrial lofts and tech startups. Young professionals.', 125, 3, 65000, 70, 60, 35, FALSE),
('parkdale', 'Parkdale', 'Gentrifying neighborhood with mix of old and new. Opportunity knocks.', 200, 2, 22000, 50, 40, 60, FALSE);

-- =============================================================================
-- 2. CRIME TYPES - All 8 Crime Types from game-constants.ts
-- =============================================================================

INSERT INTO crime_types (id, name, description, category, required_level, payout_min, payout_max, success_rate, heat_min, heat_max, energy_cost, cooldown_seconds, allows_pvp, has_minigame, requires_weapon, xp_reward) VALUES
('pickpocket', 'Pickpocket', 'Lift wallets and phones from distracted pedestrians.', 'petty', 1, 20, 80, 70, 2, 5, 5, 30, FALSE, FALSE, FALSE, 10),
('shoplifting', 'Shoplifting', 'Five-finger discount from local stores.', 'petty', 1, 30, 100, 65, 3, 8, 8, 60, FALSE, FALSE, FALSE, 15),
('mugging', 'Mugging', 'Confront targets in quiet areas and demand valuables.', 'violent', 2, 50, 200, 55, 8, 15, 12, 120, TRUE, FALSE, FALSE, 25),
('car_theft', 'Car Theft', 'Boost vehicles from parking lots and streets.', 'property', 3, 200, 800, 45, 15, 25, 15, 300, FALSE, TRUE, FALSE, 40),
('burglary', 'Burglary', 'Break into homes and businesses after hours.', 'property', 4, 300, 1200, 40, 20, 35, 20, 600, FALSE, TRUE, FALSE, 60),
('drug_run', 'Drug Run', 'Transport packages across district lines.', 'organized', 2, 100, 400, 50, 10, 20, 10, 180, FALSE, FALSE, FALSE, 30),
('armed_robbery', 'Armed Robbery', 'Hit stores and businesses with weapon in hand.', 'violent', 5, 500, 2000, 35, 30, 50, 25, 900, FALSE, FALSE, TRUE, 100),
('bank_heist', 'Bank Heist', 'The big score. Requires careful planning and nerves of steel.', 'organized', 8, 5000, 20000, 20, 50, 80, 50, 3600, FALSE, TRUE, FALSE, 500);

-- =============================================================================
-- 3. JOB TYPES - All 5 Job Types from game-constants.ts
-- =============================================================================

INSERT INTO job_types (id, name, description, category, required_level, payout, energy_cost, cooldown_seconds, xp_reward) VALUES
('delivery', 'Delivery Driver', 'Deliver packages and food across the city.', 'manual', 1, 50, 10, 60, 10),
('security', 'Security Guard', 'Watch over properties and businesses overnight.', 'service', 2, 100, 15, 120, 20),
('temp_work', 'Temp Work', 'Day labor at warehouses and construction sites.', 'manual', 1, 75, 20, 90, 15),
('bartending', 'Bartending', 'Mix drinks and work the crowd at local bars.', 'service', 3, 150, 12, 150, 25),
('accounting', 'Accounting', 'Crunch numbers for businesses that need discretion.', 'professional', 5, 300, 8, 300, 50);

-- =============================================================================
-- 4. BUSINESS TYPES - All 10 Business Types from game-constants.ts
-- =============================================================================

INSERT INTO business_types (id, name, category, setup_cost, income_per_hour, cost_per_hour, max_employees, required_level, heat_generation, required_rep_business, required_rep_crime) VALUES
('laundromat', 'Laundromat', 'legit', 5000, 50, 10, 2, 1, 0, 0, 0),
('restaurant', 'Restaurant', 'legit', 15000, 150, 40, 5, 2, 0, 0, 0),
('bar', 'Bar', 'legit', 25000, 250, 60, 4, 3, 0, 0, 0),
('gym', 'Gym', 'legit', 30000, 200, 50, 3, 3, 0, 0, 0),
('pawn_shop', 'Pawn Shop', 'gray', 10000, 120, 25, 2, 1, 5, 0, 0),
('dispensary', 'Dispensary', 'gray', 20000, 300, 70, 3, 3, 10, 100, 0),
('drug_lab', 'Drug Lab', 'underground', 50000, 500, 100, 4, 5, 30, 0, 200),
('chop_shop', 'Chop Shop', 'underground', 40000, 400, 80, 5, 4, 25, 0, 150),
('gambling_den', 'Gambling Den', 'underground', 35000, 350, 90, 4, 4, 20, 0, 0),
('weapons_cache', 'Weapons Cache', 'underground', 60000, 600, 120, 3, 6, 40, 0, 300);

-- =============================================================================
-- 5. ITEMS - Weapons, Vehicles, Tools, Consumables
-- =============================================================================

-- Weapons
INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements, durability_max) VALUES
('knife', 'Pocket Knife', 'A small folding knife. Better than nothing.', 'weapon', 'common', 100, 1, TRUE, TRUE, 'weapon', '{"crime_success_bonus": 3, "intimidation": 5}'::jsonb, '{"level": 1}'::jsonb, 100),
('bat', 'Baseball Bat', 'Aluminum bat. Good reach and solid impact.', 'weapon', 'common', 150, 1, TRUE, TRUE, 'weapon', '{"crime_success_bonus": 5, "intimidation": 10}'::jsonb, '{"level": 1}'::jsonb, 150),
('pistol', 'Pistol', 'Compact handgun. Required for armed robbery.', 'weapon', 'uncommon', 500, 1, TRUE, TRUE, 'weapon', '{"crime_success_bonus": 10, "intimidation": 25, "enables_armed_robbery": true}'::jsonb, '{"level": 3}'::jsonb, 200),
('shotgun', 'Shotgun', 'Pump-action shotgun. Serious firepower.', 'weapon', 'rare', 1500, 1, TRUE, TRUE, 'weapon', '{"crime_success_bonus": 15, "intimidation": 40}'::jsonb, '{"level": 5}'::jsonb, 250),
('assault_rifle', 'Assault Rifle', 'Military-grade automatic weapon.', 'weapon', 'epic', 5000, 1, TRUE, TRUE, 'weapon', '{"crime_success_bonus": 20, "intimidation": 60}'::jsonb, '{"level": 8}'::jsonb, 300);

-- Vehicles
INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements) VALUES
('bicycle', 'Bicycle', 'Basic transportation. Quiet and inconspicuous.', 'vehicle', 'common', 200, 1, TRUE, TRUE, 'vehicle', '{"escape_bonus": 2, "travel_speed": 1.1}'::jsonb, '{"level": 1}'::jsonb),
('scooter', 'Scooter', 'Motorized scooter. Faster getaways.', 'vehicle', 'common', 800, 1, TRUE, TRUE, 'vehicle', '{"escape_bonus": 5, "travel_speed": 1.25}'::jsonb, '{"level": 2}'::jsonb),
('sedan', 'Sedan', 'Reliable four-door car. Blends in anywhere.', 'vehicle', 'uncommon', 3000, 1, TRUE, TRUE, 'vehicle', '{"escape_bonus": 10, "travel_speed": 1.5, "enables_car_crimes": true}'::jsonb, '{"level": 3}'::jsonb),
('sports_car', 'Sports Car', 'High-performance vehicle. Speed when you need it.', 'vehicle', 'rare', 15000, 1, TRUE, TRUE, 'vehicle', '{"escape_bonus": 15, "travel_speed": 2.0}'::jsonb, '{"level": 6}'::jsonb),
('motorcycle', 'Motorcycle', 'Fast and maneuverable. Perfect for quick escapes.', 'vehicle', 'uncommon', 5000, 1, TRUE, TRUE, 'vehicle', '{"escape_bonus": 12, "travel_speed": 1.75}'::jsonb, '{"level": 4}'::jsonb);

-- Tools
INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements, durability_max) VALUES
('lockpick_set', 'Lockpick Set', 'Professional lockpicking tools. Essential for burglary.', 'tool', 'uncommon', 300, 5, TRUE, TRUE, 'tool', '{"burglary_bonus": 10}'::jsonb, '{"level": 3}'::jsonb, 10),
('scanner', 'RF Scanner', 'Electronic scanner for casing targets.', 'tool', 'rare', 1000, 1, TRUE, TRUE, 'tool', '{"reveals_property_value": true, "crime_success_bonus": 5}'::jsonb, '{"level": 4}'::jsonb, 50),
('signal_jammer', 'Signal Jammer', 'Disables alarms and security systems temporarily.', 'tool', 'epic', 3000, 1, TRUE, TRUE, 'tool', '{"disables_security": true, "burglary_bonus": 20}'::jsonb, '{"level": 6}'::jsonb, 25);

-- Consumables
INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements) VALUES
('energy_drink', 'Energy Drink', 'Restores 25 energy instantly.', 'consumable', 'common', 50, 10, TRUE, FALSE, NULL, '{"restore_energy": 25}'::jsonb, '{}'::jsonb),
('first_aid_kit', 'First Aid Kit', 'Heals injuries and reduces heat by 10.', 'consumable', 'uncommon', 200, 5, TRUE, FALSE, NULL, '{"reduce_heat": 10}'::jsonb, '{}'::jsonb),
('burner_phone', 'Burner Phone', 'Disposable phone. Reduces heat by 20.', 'consumable', 'uncommon', 150, 5, TRUE, FALSE, NULL, '{"reduce_heat": 20}'::jsonb, '{}'::jsonb),
('fake_id', 'Fake ID', 'Quality forgery. Reduces heat by 30.', 'consumable', 'rare', 500, 3, TRUE, FALSE, NULL, '{"reduce_heat": 30}'::jsonb, '{"level": 3}'::jsonb),
('bribe_money', 'Bribe Envelope', 'Cash for greasing palms. Reduces heat by 50.', 'consumable', 'epic', 2000, 2, TRUE, FALSE, NULL, '{"reduce_heat": 50}'::jsonb, '{"level": 5}'::jsonb);

-- Materials (for crafting/trading)
INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements) VALUES
('scrap_metal', 'Scrap Metal', 'Useful metal scraps for repairs and crafting.', 'material', 'common', 25, 50, TRUE, FALSE, NULL, '{}'::jsonb, '{}'::jsonb),
('electronics', 'Electronic Parts', 'Salvaged electronic components.', 'material', 'uncommon', 100, 25, TRUE, FALSE, NULL, '{}'::jsonb, '{}'::jsonb),
('chemicals', 'Chemical Compounds', 'Various chemicals with multiple uses.', 'material', 'rare', 250, 10, TRUE, FALSE, NULL, '{}'::jsonb, '{"level": 3}'::jsonb);

-- Cosmetics
INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements) VALUES
('gold_chain', 'Gold Chain', 'Flashy gold chain. Shows you''ve made it.', 'cosmetic', 'rare', 2500, 1, TRUE, TRUE, 'accessory', '{"rep_display_bonus": 10}'::jsonb, '{"level": 5}'::jsonb),
('designer_watch', 'Designer Watch', 'Luxury timepiece. Status symbol.', 'cosmetic', 'epic', 10000, 1, TRUE, TRUE, 'accessory', '{"rep_display_bonus": 25}'::jsonb, '{"level": 8}'::jsonb),
('custom_jacket', 'Custom Jacket', 'Personalized leather jacket with crew colors.', 'cosmetic', 'uncommon', 500, 1, TRUE, TRUE, 'outfit', '{"crew_rep_bonus": 5}'::jsonb, '{"level": 2}'::jsonb);

-- =============================================================================
-- 6. MISSIONS - Onboarding, Daily, Weekly
-- =============================================================================

-- Onboarding Missions
INSERT INTO missions (id, name, description, mission_type, category, requirements, rewards, required_level, required_missions, is_repeatable, sort_order, is_active) VALUES
('onboard_1_first_job', 'Honest Work', 'Complete your first job to earn some legitimate cash. Everyone starts somewhere.', 'onboarding', 'general', '[{"type": "complete_job", "count": 1}]'::jsonb, '{"cash": 200, "xp": 50}'::jsonb, 1, '{}', FALSE, 1, TRUE),
('onboard_2_first_crime', 'Breaking Bad', 'Commit your first crime. The streets are calling.', 'onboarding', 'crime', '[{"type": "complete_crime", "count": 1}]'::jsonb, '{"cash": 100, "xp": 50, "rep_crime": 5}'::jsonb, 1, ARRAY['onboard_1_first_job'], FALSE, 2, TRUE),
('onboard_3_explore', 'Know Your City', 'Travel to a different district. Explore what Toronto has to offer.', 'onboarding', 'general', '[{"type": "travel_district", "count": 1}]'::jsonb, '{"xp": 100}'::jsonb, 1, ARRAY['onboard_2_first_crime'], FALSE, 3, TRUE),
('onboard_4_first_property', 'Real Estate', 'Buy your first property. Building an empire starts with one lot.', 'onboarding', 'property', '[{"type": "buy_property", "count": 1}]'::jsonb, '{"cash": 500, "xp": 200}'::jsonb, 1, ARRAY['onboard_3_explore'], FALSE, 4, TRUE),
('onboard_5_first_income', 'Passive Income', 'Collect income from a property or business. Money working for you.', 'onboarding', 'business', '[{"type": "collect_income", "count": 1}]'::jsonb, '{"xp": 100, "rep_business": 10}'::jsonb, 1, ARRAY['onboard_4_first_property'], FALSE, 5, TRUE),
('onboard_6_complete', 'Street Ready', 'You''ve learned the basics. Now go build your legacy.', 'onboarding', 'general', '[{"type": "claim_mission", "mission_id": "onboard_5_first_income"}]'::jsonb, '{"cash": 1000, "xp": 500}'::jsonb, 1, ARRAY['onboard_5_first_income'], FALSE, 6, TRUE);

-- Daily Missions
INSERT INTO missions (id, name, description, mission_type, category, requirements, rewards, required_level, is_repeatable, repeat_cooldown_hours, sort_order, is_active) VALUES
('daily_jobs', 'Day Shift', 'Complete 3 jobs today.', 'daily', 'general', '[{"type": "complete_job", "count": 3}]'::jsonb, '{"cash": 300, "xp": 100}'::jsonb, 1, TRUE, 24, 10, TRUE),
('daily_crimes', 'Night Moves', 'Successfully commit 3 crimes today.', 'daily', 'crime', '[{"type": "complete_crime", "count": 3, "require_success": true}]'::jsonb, '{"cash": 500, "xp": 150, "rep_crime": 5}'::jsonb, 2, TRUE, 24, 11, TRUE),
('daily_income', 'Collection Day', 'Collect income from all your businesses.', 'daily', 'business', '[{"type": "collect_income", "count": 1}]'::jsonb, '{"xp": 50, "rep_business": 3}'::jsonb, 1, TRUE, 24, 12, TRUE),
('daily_social', 'Networking', 'Send a message to another player.', 'daily', 'social', '[{"type": "send_message", "count": 1}]'::jsonb, '{"xp": 25, "rep_family": 2}'::jsonb, 1, TRUE, 24, 13, TRUE);

-- Weekly Missions
INSERT INTO missions (id, name, description, mission_type, category, requirements, rewards, required_level, is_repeatable, repeat_cooldown_hours, sort_order, is_active) VALUES
('weekly_grind', 'Weekly Grind', 'Complete 20 jobs this week.', 'weekly', 'general', '[{"type": "complete_job", "count": 20}]'::jsonb, '{"cash": 2000, "xp": 500}'::jsonb, 1, TRUE, 168, 20, TRUE),
('weekly_crime_spree', 'Crime Spree', 'Successfully commit 15 crimes this week.', 'weekly', 'crime', '[{"type": "complete_crime", "count": 15, "require_success": true}]'::jsonb, '{"cash": 3000, "xp": 750, "rep_crime": 25}'::jsonb, 3, TRUE, 168, 21, TRUE),
('weekly_mogul', 'Business Mogul', 'Earn $10,000 from businesses this week.', 'weekly', 'business', '[{"type": "business_earnings", "amount": 10000}]'::jsonb, '{"cash": 2500, "xp": 600, "rep_business": 20}'::jsonb, 3, TRUE, 168, 22, TRUE),
('weekly_property', 'Property Baron', 'Own 5 properties simultaneously.', 'weekly', 'property', '[{"type": "own_properties", "count": 5}]'::jsonb, '{"cash": 5000, "xp": 1000}'::jsonb, 5, TRUE, 168, 23, TRUE);

-- Story Missions (examples)
INSERT INTO missions (id, name, description, mission_type, category, requirements, rewards, required_level, required_missions, is_repeatable, sort_order, is_active) VALUES
('story_1_rise', 'The Rise Begins', 'Reach level 5 and establish yourself in the city.', 'story', 'general', '[{"type": "reach_level", "level": 5}]'::jsonb, '{"cash": 2500, "xp": 1000}'::jsonb, 1, ARRAY['onboard_6_complete'], FALSE, 100, TRUE),
('story_2_territory', 'Marking Territory', 'Own properties in 3 different districts.', 'story', 'property', '[{"type": "own_properties_districts", "count": 3}]'::jsonb, '{"cash": 5000, "xp": 2000, "rep_crime": 25}'::jsonb, 5, ARRAY['story_1_rise'], FALSE, 101, TRUE),
('story_3_empire', 'Building an Empire', 'Open 3 businesses of any type.', 'story', 'business', '[{"type": "open_business", "count": 3}]'::jsonb, '{"cash": 10000, "xp": 3000, "rep_business": 50}'::jsonb, 8, ARRAY['story_2_territory'], FALSE, 102, TRUE),
('story_4_crew', 'Strength in Numbers', 'Join or create a crew.', 'story', 'social', '[{"type": "join_crew", "count": 1}]'::jsonb, '{"xp": 2000, "rep_family": 50}'::jsonb, 3, ARRAY['story_1_rise'], FALSE, 103, TRUE);

-- =============================================================================
-- 7. GENERATE PROPERTY PARCELS FOR EACH DISTRICT
-- =============================================================================

-- Function to generate parcels for a district
CREATE OR REPLACE FUNCTION generate_district_parcels(p_district_id VARCHAR, p_prefix VARCHAR, p_count INT, p_base_price BIGINT)
RETURNS void AS $$
DECLARE
  i INT;
  parcel_code VARCHAR;
  property_type property_type_enum;
  type_roll INT;
  price_variance BIGINT;
BEGIN
  FOR i IN 1..p_count LOOP
    parcel_code := p_prefix || '-' || LPAD(i::text, 4, '0');

    -- Randomly assign property types (60% empty, 20% residential, 15% commercial, 5% industrial)
    type_roll := floor(random() * 100);
    IF type_roll < 60 THEN
      property_type := 'empty';
    ELSIF type_roll < 80 THEN
      property_type := 'residential';
    ELSIF type_roll < 95 THEN
      property_type := 'commercial';
    ELSE
      property_type := 'industrial';
    END IF;

    -- Calculate price variance (+/- 20% of base price)
    price_variance := floor(random() * (p_base_price * 0.4)) - floor(p_base_price * 0.2);

    INSERT INTO properties (district_id, parcel_code, property_type, base_value, current_value)
    VALUES (
      p_district_id,
      parcel_code,
      property_type,
      p_base_price + price_variance,
      p_base_price + price_variance
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate parcels for each district (total: 3,450 properties)
SELECT generate_district_parcels('scarborough', 'SCA', 500, 10000);
SELECT generate_district_parcels('etobicoke', 'ETB', 450, 12000);
SELECT generate_district_parcels('north_york', 'NYK', 400, 25000);
SELECT generate_district_parcels('east_york', 'EYK', 300, 20000);
SELECT generate_district_parcels('york', 'YRK', 350, 18000);
SELECT generate_district_parcels('queen_west', 'QWS', 200, 50000);
SELECT generate_district_parcels('kensington', 'KEN', 150, 45000);
SELECT generate_district_parcels('chinatown', 'CHN', 150, 40000);
SELECT generate_district_parcels('downtown', 'DWT', 250, 100000);
SELECT generate_district_parcels('entertainment', 'ENT', 150, 80000);
SELECT generate_district_parcels('yorkville', 'YKV', 100, 150000);
SELECT generate_district_parcels('financial', 'FIN', 100, 200000);
SELECT generate_district_parcels('waterfront', 'WTF', 150, 60000);
SELECT generate_district_parcels('distillery', 'DST', 75, 55000);
SELECT generate_district_parcels('liberty', 'LIB', 125, 65000);
SELECT generate_district_parcels('parkdale', 'PKD', 200, 22000);

-- Clean up the function (optional - can keep for future regeneration)
-- DROP FUNCTION IF EXISTS generate_district_parcels;

-- =============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- =============================================================================

-- SELECT 'Districts:', count(*) FROM districts;
-- SELECT 'Crime Types:', count(*) FROM crime_types;
-- SELECT 'Job Types:', count(*) FROM job_types;
-- SELECT 'Business Types:', count(*) FROM business_types;
-- SELECT 'Items:', count(*) FROM items;
-- SELECT 'Missions:', count(*) FROM missions;
-- SELECT 'Properties:', count(*) FROM properties;
-- SELECT 'Properties by district:', district_id, count(*) FROM properties GROUP BY district_id ORDER BY district_id;
