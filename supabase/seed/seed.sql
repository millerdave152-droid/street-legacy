-- Street Legacy: Seed Data
-- Toronto-based persistent multiplayer crime/business simulation

-- ============================================================================
-- TORONTO DISTRICTS
-- Real Toronto neighborhoods with game-balanced stats
-- ============================================================================

INSERT INTO districts (name, description, bounds_x, bounds_y, bounds_width, bounds_height, danger_level, police_presence, wealth_level) VALUES

-- Downtown Core
('Financial District', 'The heart of Toronto''s financial sector. High security, wealthy targets, but heavy police presence.', 0, 0, 200, 200, 3, 9, 10),
('Entertainment District', 'Clubs, bars, and nightlife. Money flows freely after dark.', 200, 0, 200, 200, 5, 7, 7),
('Chinatown', 'Bustling markets and restaurants. A mix of legitimate business and underground activity.', 400, 0, 150, 150, 4, 5, 5),
('Kensington Market', 'Eclectic neighborhood with vintage shops and street vendors. Easy to blend in.', 400, 150, 150, 150, 3, 4, 4),

-- Midtown
('Yorkville', 'Toronto''s most upscale shopping district. Designer stores and wealthy residents.', 0, 200, 200, 200, 2, 8, 10),
('The Annex', 'University area with students and professors. Lower crime but good for recruiting.', 200, 200, 200, 200, 2, 6, 6),
('Little Italy', 'Traditional Italian neighborhood. Some old-school operations still run here.', 400, 300, 150, 150, 5, 5, 6),

-- East End
('Leslieville', 'Gentrifying neighborhood with young professionals. Growing opportunities.', 600, 0, 200, 200, 3, 6, 7),
('Regent Park', 'Once notorious, now being redeveloped. Still has underground connections.', 600, 200, 200, 200, 7, 4, 3),
('East Chinatown', 'Smaller Chinatown with tight-knit community. Harder to break into.', 800, 0, 150, 150, 4, 4, 4),

-- West End
('Parkdale', 'Diverse neighborhood in transition. Mix of old and new money.', -200, 0, 200, 200, 6, 4, 4),
('Liberty Village', 'Former industrial area, now condos and tech startups. New money.', -200, 200, 200, 200, 3, 6, 7),
('Junction', 'Up-and-coming area with craft breweries and small businesses.', -200, 400, 200, 200, 4, 5, 6),

-- North End
('North York', 'Suburban feel with shopping centers. Family territory disputes.', 0, 400, 300, 200, 5, 6, 6),
('Scarborough', 'Large suburban area. Various crews compete for control.', 600, 400, 300, 200, 7, 4, 4),

-- Waterfront
('Harbourfront', 'Tourist area with waterfront condos. Seasonal opportunities.', 200, -200, 300, 200, 3, 7, 8),
('Port Lands', 'Industrial waterfront area. Good for smuggling and warehouses.', 500, -200, 300, 200, 6, 3, 3);

-- ============================================================================
-- BUSINESS TYPES
-- ============================================================================

INSERT INTO business_types (id, name, description, category, purchase_price, base_income, base_operating_cost, upgrade_cost_multiplier, min_reputation, min_level, base_heat_generation, police_raid_chance) VALUES

-- Legitimate Businesses
('convenience_store', 'Convenience Store', 'A small corner store selling everyday items. Steady, low-risk income.', 'legitimate', 50000, 500, 100, 1.5, 0, 1, 0, 0),
('restaurant', 'Restaurant', 'A local eatery. Requires management but good returns.', 'legitimate', 150000, 1500, 400, 1.5, 100, 3, 0, 0),
('bar', 'Bar', 'A neighborhood bar. Good income, especially on weekends.', 'legitimate', 200000, 2000, 500, 1.5, 200, 5, 0, 0),
('nightclub', 'Nightclub', 'High-end nightclub. Expensive to run but very profitable.', 'legitimate', 500000, 5000, 1500, 1.6, 500, 8, 0, 0),
('auto_shop', 'Auto Shop', 'Vehicle repair and customization. Essential for any crew.', 'legitimate', 300000, 2500, 600, 1.5, 300, 6, 0, 0),
('laundromat', 'Laundromat', 'Self-service laundry. Perfect for cleaning more than clothes.', 'legitimate', 100000, 800, 200, 1.4, 50, 2, 0, 0),

-- Front Businesses (appear legitimate, enable illegal operations)
('car_wash', 'Car Wash', 'A car wash that''s perfect for laundering money.', 'front', 150000, 1000, 300, 1.5, 200, 4, 5, 0.02),
('pawn_shop', 'Pawn Shop', 'Buy and sell "pre-owned" goods. No questions asked.', 'front', 200000, 1500, 400, 1.5, 300, 5, 10, 0.03),
('import_export', 'Import/Export Co.', 'International trade company. Perfect cover for smuggling.', 'front', 400000, 3000, 800, 1.6, 600, 8, 15, 0.04),
('strip_club', 'Strip Club', 'Adult entertainment venue. Multiple revenue streams.', 'front', 600000, 6000, 2000, 1.6, 700, 9, 20, 0.05),

-- Illegal Operations
('drug_lab', 'Drug Lab', 'Manufacturing facility for illegal substances. High risk, high reward.', 'illegal', 250000, 8000, 1000, 1.7, 400, 6, 40, 0.15),
('chop_shop', 'Chop Shop', 'Disassemble stolen vehicles for parts. Needs steady supply.', 'illegal', 300000, 6000, 800, 1.6, 350, 5, 30, 0.10),
('gambling_den', 'Gambling Den', 'Underground gambling operation. House always wins.', 'illegal', 200000, 5000, 600, 1.6, 300, 5, 25, 0.08),
('weapon_stash', 'Weapon Stash', 'Arms storage and distribution point. Very illegal.', 'illegal', 400000, 7000, 1200, 1.7, 500, 7, 50, 0.20),
('counterfeit_shop', 'Counterfeit Shop', 'Produce fake documents and currency.', 'illegal', 350000, 5500, 900, 1.6, 450, 6, 35, 0.12);

-- ============================================================================
-- ITEMS
-- ============================================================================

INSERT INTO items (id, name, description, category, base_price, damage, accuracy, speed, capacity, effect_type, effect_value, min_level, is_tradeable, is_legal) VALUES

-- Weapons - Melee
('brass_knuckles', 'Brass Knuckles', 'Classic street fighting gear. Concealable.', 'weapon', 500, 15, 90, NULL, NULL, NULL, NULL, 1, true, false),
('baseball_bat', 'Baseball Bat', 'America''s pastime, Toronto style.', 'weapon', 200, 25, 85, NULL, NULL, NULL, NULL, 1, true, true),
('knife', 'Combat Knife', 'Sharp and deadly. Don''t bring to a gunfight.', 'weapon', 800, 30, 80, NULL, NULL, NULL, NULL, 2, true, false),
('machete', 'Machete', 'For when you need to make a statement.', 'weapon', 1200, 40, 75, NULL, NULL, NULL, NULL, 4, true, false),

-- Weapons - Firearms
('pistol', '9mm Pistol', 'Standard sidearm. Reliable and common.', 'weapon', 5000, 35, 70, NULL, NULL, NULL, NULL, 3, true, false),
('revolver', '.357 Revolver', 'Six shots of stopping power.', 'weapon', 8000, 45, 65, NULL, NULL, NULL, NULL, 5, true, false),
('shotgun', 'Pump Shotgun', 'Close range devastation.', 'weapon', 15000, 60, 55, NULL, NULL, NULL, NULL, 6, true, false),
('smg', 'SMG', 'Compact and fully automatic.', 'weapon', 25000, 30, 60, NULL, NULL, NULL, NULL, 8, true, false),
('rifle', 'Assault Rifle', 'Military-grade firepower.', 'weapon', 50000, 50, 75, NULL, NULL, NULL, NULL, 10, true, false),

-- Vehicles
('bicycle', 'Bicycle', 'Eco-friendly getaway vehicle. Blends in anywhere.', 'vehicle', 500, NULL, NULL, 20, 1, NULL, NULL, 1, true, true),
('scooter', 'Scooter', 'Nimble and quick for city streets.', 'vehicle', 3000, NULL, NULL, 40, 1, NULL, NULL, 2, true, true),
('sedan', 'Sedan', 'Standard four-door. Nothing special.', 'vehicle', 15000, NULL, NULL, 60, 4, NULL, NULL, 3, true, true),
('muscle_car', 'Muscle Car', 'American classic. Fast but conspicuous.', 'vehicle', 45000, NULL, NULL, 85, 2, NULL, NULL, 5, true, true),
('suv', 'SUV', 'Room for the crew and their equipment.', 'vehicle', 50000, NULL, NULL, 70, 6, NULL, NULL, 5, true, true),
('sports_car', 'Sports Car', 'When you need to outrun everyone.', 'vehicle', 100000, NULL, NULL, 95, 2, NULL, NULL, 8, true, true),
('van', 'Van', 'Perfect for... deliveries.', 'vehicle', 30000, NULL, NULL, 55, 8, NULL, NULL, 4, true, true),
('motorcycle', 'Motorcycle', 'Fast and maneuverable. Lane splitting approved.', 'vehicle', 20000, NULL, NULL, 90, 1, NULL, NULL, 4, true, true),

-- Tools
('lockpick_set', 'Lockpick Set', 'For doors that forgot to stay open.', 'tool', 2000, NULL, NULL, NULL, NULL, NULL, NULL, 2, true, false),
('crowbar', 'Crowbar', 'Multi-purpose entry tool.', 'tool', 500, NULL, NULL, NULL, NULL, NULL, NULL, 1, true, true),
('body_armor', 'Body Armor', 'Kevlar vest. Reduces damage taken.', 'tool', 10000, NULL, NULL, NULL, NULL, 'damage_reduction', 30, 4, true, false),
('police_scanner', 'Police Scanner', 'Know when they''re coming.', 'tool', 5000, NULL, NULL, NULL, NULL, 'heat_reduction', 10, 3, true, true),
('burner_phone', 'Burner Phone', 'Untraceable communication.', 'tool', 200, NULL, NULL, NULL, NULL, NULL, NULL, 1, true, true),

-- Consumables
('bandages', 'Bandages', 'Basic first aid. Heals minor wounds.', 'consumable', 100, NULL, NULL, NULL, NULL, 'heal', 20, 1, true, true),
('medkit', 'Medical Kit', 'Professional medical supplies.', 'consumable', 500, NULL, NULL, NULL, NULL, 'heal', 50, 3, true, true),
('energy_drink', 'Energy Drink', 'Restores energy for more activities.', 'consumable', 50, NULL, NULL, NULL, NULL, 'energy', 25, 1, true, true),
('painkillers', 'Painkillers', 'Prescription strength. Heals and energizes.', 'consumable', 300, NULL, NULL, NULL, NULL, 'heal', 30, 2, true, false),

-- Materials (for crafting/trading)
('stolen_goods', 'Stolen Goods', 'Hot merchandise that needs fencing.', 'material', 100, NULL, NULL, NULL, NULL, NULL, NULL, 1, true, false),
('drug_package', 'Drug Package', 'Product ready for distribution.', 'material', 500, NULL, NULL, NULL, NULL, NULL, NULL, 3, true, false),
('weapon_parts', 'Weapon Parts', 'Components for weapon assembly.', 'material', 1000, NULL, NULL, NULL, NULL, NULL, NULL, 5, true, false),
('counterfeit_cash', 'Counterfeit Cash', 'Fake bills. Spend carefully.', 'material', 200, NULL, NULL, NULL, NULL, NULL, NULL, 4, true, false);

-- ============================================================================
-- MISSIONS
-- ============================================================================

INSERT INTO missions (mission_type, name, description, min_level, min_reputation, cash_reward, reputation_reward, respect_reward, energy_cost, heat_gain, cooldown_minutes, duration_minutes, success_base_chance, danger_level, is_repeatable) VALUES

-- Starter Missions (Level 1-3)
('errand', 'Corner Store Shakedown', 'Convince a local shop owner to pay for "protection".', 1, 0, 500, 10, 5, 10, 5, 30, 5, 0.85, 1, true),
('errand', 'Package Delivery', 'Deliver a package across town. No questions.', 1, 0, 300, 5, 2, 5, 2, 15, 10, 0.95, 1, true),
('errand', 'Debt Collection', 'Someone owes money. Make sure they pay.', 2, 25, 800, 15, 10, 15, 8, 45, 10, 0.80, 2, true),
('theft', 'Car Boost - Economy', 'Steal a standard vehicle for the chop shop.', 2, 50, 1000, 20, 15, 20, 15, 60, 15, 0.75, 2, true),

-- Mid-Level Missions (Level 4-6)
('theft', 'Car Boost - Luxury', 'Steal a high-end vehicle. Riskier but pays more.', 4, 150, 5000, 40, 30, 25, 25, 120, 20, 0.65, 4, true),
('theft', 'Warehouse Raid', 'Break into a warehouse and grab valuable goods.', 4, 200, 4000, 35, 25, 30, 20, 90, 25, 0.70, 4, true),
('dealing', 'Street Corner Sales', 'Move product on your assigned corner.', 3, 100, 2000, 25, 20, 15, 20, 45, 30, 0.80, 3, true),
('dealing', 'Club Distribution', 'Supply product to a nightclub.', 5, 300, 6000, 50, 40, 25, 30, 180, 20, 0.70, 5, true),
('muscle', 'Intimidation Job', 'Send a message to someone who''s been talking.', 4, 200, 3000, 30, 35, 20, 15, 60, 15, 0.75, 4, true),

-- High-Level Missions (Level 7-10)
('heist', 'Jewelry Store Hit', 'Rob a jewelry store. Requires planning and a crew.', 7, 500, 25000, 100, 80, 40, 50, 360, 45, 0.55, 7, true),
('heist', 'Bank Job', 'The big score. Hit a bank vault.', 9, 800, 100000, 200, 150, 50, 80, 720, 60, 0.40, 9, true),
('territory', 'Turf War', 'Take control of a street corner from rivals.', 6, 400, 8000, 80, 100, 35, 40, 240, 30, 0.60, 6, true),
('smuggling', 'Border Run', 'Smuggle goods across the border.', 8, 600, 50000, 120, 90, 45, 60, 480, 90, 0.50, 8, true),
('assassination', 'Contract Hit', 'Eliminate a target. Professional work only.', 10, 1000, 75000, 150, 200, 50, 100, 1440, 30, 0.45, 10, true),

-- Special/Story Missions (one-time)
('story', 'Welcome to Toronto', 'Meet your contact and learn how things work around here.', 1, 0, 1000, 25, 10, 0, 0, 0, 5, 1.0, 1, false),
('story', 'First Blood', 'Someone disrespected you. Time to earn your reputation.', 2, 30, 2000, 50, 50, 20, 10, 0, 15, 0.90, 2, false),
('story', 'Crew Up', 'Join or form a crew to expand your operations.', 5, 250, 5000, 100, 100, 0, 0, 0, 0, 1.0, 1, false);

-- ============================================================================
-- LINK MISSIONS TO DISTRICTS
-- ============================================================================

-- Update missions with district requirements
UPDATE missions SET district_id = (SELECT id FROM districts WHERE name = 'Regent Park') WHERE name = 'Corner Store Shakedown';
UPDATE missions SET district_id = (SELECT id FROM districts WHERE name = 'Entertainment District') WHERE name = 'Club Distribution';
UPDATE missions SET district_id = (SELECT id FROM districts WHERE name = 'Financial District') WHERE name = 'Bank Job';
UPDATE missions SET district_id = (SELECT id FROM districts WHERE name = 'Yorkville') WHERE name = 'Jewelry Store Hit';
UPDATE missions SET district_id = (SELECT id FROM districts WHERE name = 'Port Lands') WHERE name = 'Border Run';
