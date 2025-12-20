-- Street Legacy: Seed Data Migration
-- Migration: 012_seed_data
-- Description: Comprehensive seed data for districts, crime types, job types,
--              business types, items, missions, property generation, and performance indexes

-- =============================================================================
-- TORONTO DISTRICTS
-- =============================================================================

INSERT INTO districts (id, name, description, total_parcels, difficulty, base_property_price, economy_level, police_presence, crime_rate, is_starter_district) VALUES
-- Starter Districts (Difficulty 1-2)
('scarborough', 'Scarborough', 'A diverse suburban area on the eastern edge of Toronto. Known for its multicultural communities, strip malls, and affordable housing. Perfect for new hustlers looking to make their first moves.', 80, 1, 50000, 45, 40, 55, TRUE),
('etobicoke', 'Etobicoke', 'Western Toronto suburb with a mix of industrial areas and residential neighborhoods. Old money meets working class, creating opportunities for those who know where to look.', 75, 1, 55000, 50, 45, 50, TRUE),
('north_york', 'North York', 'The northern gateway featuring high-rise condos along Yonge Street and quiet residential areas. A growing tech hub with plenty of legitimate and illegitimate opportunities.', 90, 2, 75000, 55, 50, 45, TRUE),

-- Mid-tier Districts (Difficulty 2-3)
('downtown', 'Downtown Core', 'The beating heart of Toronto. Bay Street banks, entertainment district clubs, and tourist traps. High risk, high reward - but the cops are always watching.', 120, 3, 150000, 85, 70, 60, FALSE),
('yorkville', 'Yorkville', 'Toronto''s most exclusive neighborhood. Designer boutiques, art galleries, and old money mansions. The rich play here - and where there''s money, there''s opportunity.', 50, 3, 300000, 90, 75, 30, FALSE),
('queen_west', 'Queen West', 'The arts and culture district. Trendy bars, vintage shops, and creative types with more style than sense. Gentrification has brought money, but the old guard still runs certain corners.', 65, 2, 100000, 65, 55, 55, FALSE),
('liberty_village', 'Liberty Village', 'Former industrial zone turned condo jungle. Young professionals pack the condos while the old warehouses hide interesting operations. Modern meets gritty.', 70, 2, 120000, 70, 50, 45, FALSE),

-- High-tier Districts (Difficulty 4-5)
('rosedale', 'Rosedale', 'Old Toronto money at its finest. Sprawling estates, private security, and generations of wealth. Breaking in here requires finesse, connections, and serious reputation.', 40, 4, 500000, 95, 80, 20, FALSE),
('bridle_path', 'Bridle Path', 'The billionaire''s row. Media moguls, tech titans, and the ultra-wealthy hide behind gates and private armies. Only the elite criminal can operate here.', 30, 5, 1000000, 100, 85, 15, FALSE),

-- Specialty Districts (Difficulty 3-4)
('port_lands', 'Port Lands', 'Toronto''s industrial waterfront. Shipping containers, warehouses, and secrets. The docks see everything that doesn''t want to be seen. Perfect for those in the import/export business.', 100, 4, 80000, 40, 35, 70, FALSE),
('junction', 'The Junction', 'Historic rail junction turned hipster haven. Craft breweries and vintage stores on the surface, but the old rail tunnels remember their bootlegging days.', 55, 3, 90000, 60, 50, 50, FALSE),
('parkdale', 'Parkdale', 'Toronto''s most contested neighborhood. Gentrification battles rage between old-timers and newcomers. Whoever controls Parkdale controls the west end.', 60, 3, 85000, 45, 45, 65, FALSE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  total_parcels = EXCLUDED.total_parcels,
  difficulty = EXCLUDED.difficulty,
  base_property_price = EXCLUDED.base_property_price,
  economy_level = EXCLUDED.economy_level,
  police_presence = EXCLUDED.police_presence,
  crime_rate = EXCLUDED.crime_rate,
  is_starter_district = EXCLUDED.is_starter_district;

-- =============================================================================
-- CRIME TYPES
-- =============================================================================

-- Clear existing and insert fresh (we own this data)
DELETE FROM crime_types WHERE id IN (
  'pickpocket', 'shoplifting', 'mugging', 'car_theft', 'burglary',
  'drug_run', 'armed_robbery', 'bank_heist'
);

INSERT INTO crime_types (id, name, description, category, required_level, payout_min, payout_max, success_rate, heat_min, heat_max, energy_cost, cooldown_seconds, allows_pvp, has_minigame, requires_weapon, xp_reward, icon) VALUES
-- Petty Crimes (Level 1-5)
('pickpocket', 'Pickpocket', 'Lift wallets from distracted tourists and commuters. Low risk, low reward - but everyone starts somewhere.', 'petty', 1, 20, 100, 75, 2, 5, 5, 30, FALSE, FALSE, FALSE, 5, 'hand-grab'),
('shoplifting', 'Shoplifting', 'Five-finger discount from local shops. Security cameras are getting better, so choose your targets wisely.', 'petty', 1, 50, 200, 70, 3, 8, 8, 45, FALSE, FALSE, FALSE, 8, 'shopping-bag'),
('panhandling_scam', 'Panhandling Scam', 'Work the sympathy angle. Not technically illegal, but definitely not honest work.', 'petty', 1, 30, 150, 80, 1, 3, 5, 60, FALSE, FALSE, FALSE, 5, 'coins'),
('fare_evasion', 'TTC Fare Evasion', 'Jump turnstiles and dodge fare inspectors. Small gains, but it adds up.', 'petty', 1, 5, 25, 85, 1, 2, 3, 20, FALSE, FALSE, FALSE, 3, 'train'),

-- Street Crimes (Level 3-10)
('mugging', 'Mugging', 'Confront marks in dark alleys. Get physical if they resist. Not for the faint of heart.', 'violent', 3, 100, 500, 55, 10, 20, 15, 120, TRUE, FALSE, FALSE, 20, 'fist'),
('car_prowling', 'Car Prowling', 'Check for unlocked doors and smash-and-grab valuables. Quick and dirty.', 'property', 3, 75, 350, 65, 8, 15, 10, 90, FALSE, FALSE, FALSE, 12, 'car'),
('drug_dealing', 'Street Dealing', 'Move product on the corner. Know your turf, know your customers, avoid the cops.', 'organized', 4, 150, 600, 60, 12, 25, 12, 180, FALSE, FALSE, FALSE, 25, 'pill'),
('vandalism', 'Vandalism for Hire', 'Businesses pay to damage competitors. Plausible deniability for everyone.', 'property', 3, 100, 400, 70, 8, 18, 10, 150, FALSE, FALSE, FALSE, 15, 'spray-can'),

-- Serious Crimes (Level 8-20)
('car_theft', 'Car Theft', 'Boost vehicles for chop shops or clients. High-end models pay premium, but security is tight.', 'property', 8, 500, 2500, 45, 20, 35, 20, 300, FALSE, TRUE, FALSE, 40, 'key'),
('burglary', 'Burglary', 'Hit houses when residents are away. Case the joint first, get in and out clean.', 'property', 10, 750, 4000, 40, 25, 40, 25, 600, FALSE, TRUE, FALSE, 60, 'lock-pick'),
('armed_robbery', 'Armed Robbery', 'Hold up stores and businesses. The gun does the talking - just hope they cooperate.', 'violent', 12, 1000, 5000, 35, 35, 55, 30, 900, FALSE, FALSE, TRUE, 80, 'gun'),
('drug_trafficking', 'Drug Trafficking', 'Move weight across district lines. Serious money, serious consequences if caught.', 'organized', 10, 800, 3500, 50, 25, 45, 20, 600, FALSE, FALSE, FALSE, 50, 'package'),
('extortion', 'Extortion', 'Convince businesses they need your "protection". Repeat customers are the best customers.', 'organized', 12, 1000, 4000, 45, 30, 50, 25, 1200, FALSE, FALSE, FALSE, 70, 'handshake'),

-- Organized Crimes (Level 15-30)
('heist_planning', 'Heist Planning', 'Case targets for major jobs. The planning is half the work.', 'organized', 15, 500, 2000, 70, 15, 30, 15, 1800, FALSE, FALSE, FALSE, 45, 'blueprint'),
('money_laundering', 'Money Laundering', 'Clean dirty money through front businesses. Essential for the serious criminal.', 'organized', 18, 2000, 8000, 55, 20, 40, 20, 3600, FALSE, FALSE, FALSE, 100, 'money-bill'),
('warehouse_heist', 'Warehouse Heist', 'Hit shipping warehouses for valuable cargo. Need a crew and a plan.', 'organized', 20, 5000, 20000, 30, 40, 60, 40, 7200, FALSE, TRUE, FALSE, 150, 'warehouse'),

-- Elite Crimes (Level 25+)
('bank_heist', 'Bank Heist', 'The big score. Months of planning, a reliable crew, and nerves of steel. One job can set you for life.', 'organized', 25, 25000, 100000, 20, 60, 85, 60, 14400, FALSE, TRUE, FALSE, 300, 'vault'),
('art_theft', 'Art Theft', 'Acquire rare pieces for private collectors. Discretion and expertise required.', 'organized', 28, 15000, 75000, 25, 45, 70, 45, 10800, FALSE, TRUE, FALSE, 250, 'painting')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  required_level = EXCLUDED.required_level,
  payout_min = EXCLUDED.payout_min,
  payout_max = EXCLUDED.payout_max,
  success_rate = EXCLUDED.success_rate,
  heat_min = EXCLUDED.heat_min,
  heat_max = EXCLUDED.heat_max,
  energy_cost = EXCLUDED.energy_cost,
  cooldown_seconds = EXCLUDED.cooldown_seconds,
  allows_pvp = EXCLUDED.allows_pvp,
  has_minigame = EXCLUDED.has_minigame,
  requires_weapon = EXCLUDED.requires_weapon,
  xp_reward = EXCLUDED.xp_reward,
  icon = EXCLUDED.icon;

-- =============================================================================
-- JOB TYPES
-- =============================================================================

-- Clear existing basic jobs and insert comprehensive list
DELETE FROM job_types WHERE id IN ('delivery', 'security', 'temp_work', 'bartending', 'accounting');

INSERT INTO job_types (id, name, description, category, required_level, payout, energy_cost, cooldown_seconds, xp_reward, required_rep_business, icon) VALUES
-- Entry Level Jobs (Level 1-5)
('food_delivery', 'Food Delivery', 'Deliver meals for various restaurants. Tips can be decent, especially in wealthy districts.', 'manual', 1, 50, 10, 60, 5, 0, 'motorcycle'),
('warehouse_labor', 'Warehouse Labor', 'Load and unload shipments. Hard work, honest pay.', 'manual', 1, 65, 15, 90, 7, 0, 'box'),
('retail_clerk', 'Retail Clerk', 'Work the counter at local shops. Customer service experience a plus.', 'service', 1, 55, 10, 75, 6, 0, 'register'),
('cleaning_service', 'Cleaning Service', 'Janitorial work for offices and buildings. Late nights, quiet work.', 'manual', 1, 45, 12, 60, 5, 0, 'broom'),
('flyer_distribution', 'Flyer Distribution', 'Distribute promotional materials around the city. See a lot of the neighborhood.', 'manual', 1, 35, 8, 45, 4, 0, 'envelope'),

-- Skilled Jobs (Level 5-15)
('security_guard', 'Security Guard', 'Watch over businesses and properties. Connections can be useful in this line of work.', 'service', 5, 120, 15, 180, 12, 50, 'shield'),
('bartender', 'Bartender', 'Mix drinks and work the scene. Great for networking and gathering intel.', 'service', 5, 100, 12, 150, 10, 25, 'glass'),
('bouncer', 'Bouncer', 'Door security at clubs and bars. Respect is earned at the door.', 'service', 7, 140, 18, 200, 15, 75, 'door'),
('mechanic', 'Mechanic', 'Repair and maintain vehicles. Knowing cars has other... applications.', 'manual', 6, 130, 15, 180, 12, 50, 'wrench'),
('contractor', 'Contractor', 'Construction and renovation work. Physical labor with good pay.', 'manual', 8, 160, 20, 240, 18, 100, 'hammer'),

-- Professional Jobs (Level 12-25)
('accountant', 'Accountant', 'Handle finances for businesses. Creative accounting is a valued skill.', 'professional', 12, 250, 12, 300, 25, 200, 'calculator'),
('real_estate_agent', 'Real Estate Agent', 'Broker property deals. Commission-based income with high ceiling.', 'professional', 15, 350, 15, 600, 35, 300, 'house'),
('legal_assistant', 'Legal Assistant', 'Support work for law firms. Know the law to work around it.', 'professional', 18, 400, 12, 450, 40, 400, 'gavel'),
('it_consultant', 'IT Consultant', 'Tech support and system administration. Digital skills are increasingly valuable.', 'professional', 14, 300, 10, 360, 30, 250, 'computer'),

-- High-End Jobs (Level 20+)
('private_security', 'Private Security', 'Executive protection for wealthy clients. Discretion is paramount.', 'professional', 20, 500, 20, 900, 50, 500, 'bodyguard'),
('financial_advisor', 'Financial Advisor', 'Wealth management for high-net-worth individuals. Trust is everything.', 'professional', 25, 750, 15, 1200, 75, 750, 'chart'),
('event_coordinator', 'Event Coordinator', 'Plan high-profile events for Toronto elite. Access to exclusive venues and people.', 'professional', 22, 600, 18, 1000, 60, 600, 'calendar')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  required_level = EXCLUDED.required_level,
  payout = EXCLUDED.payout,
  energy_cost = EXCLUDED.energy_cost,
  cooldown_seconds = EXCLUDED.cooldown_seconds,
  xp_reward = EXCLUDED.xp_reward,
  required_rep_business = EXCLUDED.required_rep_business,
  icon = EXCLUDED.icon;

-- =============================================================================
-- BUSINESS TYPES
-- =============================================================================

-- Clear existing and insert comprehensive list
DELETE FROM business_types;

INSERT INTO business_types (id, name, description, category, setup_cost, income_per_hour, cost_per_hour, max_employees, required_level, heat_generation, required_rep_business, required_rep_crime, icon) VALUES
-- Legitimate Businesses
('laundromat', 'Laundromat', 'Coin-operated laundry. Steady, boring, and completely legal. Also great for washing other things.', 'legit', 5000, 50, 10, 2, 1, 0, 0, 0, 'washing-machine'),
('convenience_store', 'Convenience Store', 'Corner store selling snacks, drinks, and essentials. Low margins, but always in demand.', 'legit', 8000, 75, 20, 3, 2, 0, 0, 0, 'store'),
('restaurant', 'Restaurant', 'Food service establishment. High overhead but good community presence.', 'legit', 25000, 200, 60, 6, 5, 0, 100, 0, 'utensils'),
('gym', 'Gym', 'Fitness center. Attracts a certain clientele and builds connections.', 'legit', 35000, 250, 75, 5, 6, 0, 150, 0, 'dumbbell'),
('bar', 'Bar', 'Drinking establishment. Great for networking and hearing rumors.', 'legit', 30000, 300, 80, 6, 8, 0, 200, 0, 'beer'),
('nightclub', 'Nightclub', 'Late-night entertainment venue. High revenue, high profile.', 'legit', 75000, 500, 150, 10, 15, 0, 400, 0, 'music'),
('car_dealership', 'Car Dealership', 'New and used vehicle sales. Legitimate front with interesting inventory opportunities.', 'legit', 100000, 600, 200, 8, 18, 0, 500, 0, 'car'),

-- Semi-Legal Businesses (Gray)
('pawn_shop', 'Pawn Shop', 'Buy and sell second-hand goods. No questions asked about where items came from.', 'gray', 12000, 120, 30, 3, 3, 5, 0, 50, 'ring'),
('vape_shop', 'Vape Shop', 'Sell vaping products and "accessories". Gray area regulations mean gray area operations.', 'gray', 15000, 150, 40, 3, 5, 5, 50, 0, 'cloud'),
('dispensary', 'Cannabis Dispensary', 'Licensed cannabis retail. Highly regulated but highly profitable.', 'gray', 50000, 400, 100, 5, 10, 10, 200, 100, 'leaf'),
('check_cashing', 'Check Cashing', 'Cash checks and provide payday loans. Serves the underbanked... at a premium.', 'gray', 20000, 180, 45, 4, 8, 8, 100, 75, 'money'),
('massage_parlor', 'Massage Parlor', 'Therapeutic massage services. What happens in the private rooms is private.', 'gray', 25000, 220, 55, 6, 10, 12, 75, 100, 'spa'),
('auto_body', 'Auto Body Shop', 'Vehicle repair and customization. Some cars need to look... different.', 'gray', 40000, 300, 80, 5, 12, 15, 150, 150, 'paint-roller'),

-- Underground Businesses
('drug_lab', 'Drug Lab', 'Manufacture controlled substances. High profit, high risk, high heat.', 'underground', 75000, 600, 120, 5, 15, 35, 0, 400, 'flask'),
('chop_shop', 'Chop Shop', 'Disassemble stolen vehicles for parts. Efficient and profitable.', 'underground', 60000, 500, 100, 6, 12, 30, 0, 300, 'tools'),
('gambling_den', 'Gambling Den', 'Unlicensed gambling operation. House always wins, and the house is you.', 'underground', 50000, 450, 90, 5, 10, 25, 0, 250, 'dice'),
('weapons_cache', 'Weapons Cache', 'Store and distribute firearms. Extremely dangerous, extremely profitable.', 'underground', 100000, 800, 200, 4, 20, 50, 0, 600, 'gun'),
('counterfeiting', 'Counterfeiting Operation', 'Produce fake documents, currency, and goods. Precision is everything.', 'underground', 80000, 650, 150, 4, 18, 40, 0, 500, 'printer')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  setup_cost = EXCLUDED.setup_cost,
  income_per_hour = EXCLUDED.income_per_hour,
  cost_per_hour = EXCLUDED.cost_per_hour,
  max_employees = EXCLUDED.max_employees,
  required_level = EXCLUDED.required_level,
  heat_generation = EXCLUDED.heat_generation,
  required_rep_business = EXCLUDED.required_rep_business,
  required_rep_crime = EXCLUDED.required_rep_crime,
  icon = EXCLUDED.icon;

-- =============================================================================
-- ITEMS
-- =============================================================================

INSERT INTO items (id, name, description, category, rarity, base_value, max_stack, is_tradeable, is_equippable, equip_slot, effects, requirements, durability_max) VALUES
-- Weapons
('brass_knuckles', 'Brass Knuckles', 'Classic street fighting gear. Adds punch to your punch.', 'weapon', 'common', 500, 1, TRUE, TRUE, 'weapon', '{"crime_success": 5, "intimidation": 10}'::jsonb, '{"level": 2}'::jsonb, 50),
('switchblade', 'Switchblade', 'Compact and concealable. For when things get personal.', 'weapon', 'common', 750, 1, TRUE, TRUE, 'weapon', '{"crime_success": 8, "intimidation": 15}'::jsonb, '{"level": 3}'::jsonb, 40),
('baseball_bat', 'Baseball Bat', 'America''s pastime meets Toronto streets.', 'weapon', 'common', 300, 1, TRUE, TRUE, 'weapon', '{"crime_success": 6, "intimidation": 12}'::jsonb, '{"level": 1}'::jsonb, 75),
('handgun', 'Handgun', 'Standard-issue street iron. Requires connection to acquire.', 'weapon', 'uncommon', 2500, 1, TRUE, TRUE, 'weapon', '{"crime_success": 20, "intimidation": 40}'::jsonb, '{"level": 8, "rep_crime": 100}'::jsonb, 100),
('shotgun', 'Shotgun', 'Makes a statement. Loud, messy, effective.', 'weapon', 'rare', 5000, 1, TRUE, TRUE, 'weapon', '{"crime_success": 30, "intimidation": 60}'::jsonb, '{"level": 15, "rep_crime": 250}'::jsonb, 80),
('assault_rifle', 'Assault Rifle', 'Military-grade hardware. For serious operations only.', 'weapon', 'epic', 15000, 1, TRUE, TRUE, 'weapon', '{"crime_success": 45, "intimidation": 80}'::jsonb, '{"level": 25, "rep_crime": 500}'::jsonb, 120),

-- Tools
('lockpick_set', 'Lockpick Set', 'Basic tumbler picks. Essential for B&E work.', 'tool', 'common', 400, 1, TRUE, TRUE, 'tool', '{"burglary_success": 15}'::jsonb, '{"level": 4}'::jsonb, 30),
('advanced_lockpicks', 'Advanced Lockpick Set', 'Professional-grade picks with tension wrenches.', 'tool', 'uncommon', 1500, 1, TRUE, TRUE, 'tool', '{"burglary_success": 30}'::jsonb, '{"level": 10}'::jsonb, 50),
('electronic_bypass', 'Electronic Bypass Kit', 'Defeat modern security systems and alarms.', 'tool', 'rare', 5000, 1, TRUE, TRUE, 'tool', '{"burglary_success": 50, "alarm_disable": 40}'::jsonb, '{"level": 18}'::jsonb, 25),
('slim_jim', 'Slim Jim', 'Classic car entry tool. Works on older models.', 'tool', 'common', 200, 1, TRUE, TRUE, 'tool', '{"car_theft_success": 15}'::jsonb, '{"level": 3}'::jsonb, 40),
('obd_scanner', 'OBD Scanner', 'Hack modern vehicle immobilizers.', 'tool', 'uncommon', 2000, 1, TRUE, TRUE, 'tool', '{"car_theft_success": 35}'::jsonb, '{"level": 12}'::jsonb, 60),
('scanner_radio', 'Police Scanner', 'Monitor law enforcement communications.', 'tool', 'uncommon', 800, 1, TRUE, TRUE, 'accessory', '{"heat_reduction": 10, "police_warning": true}'::jsonb, '{"level": 5}'::jsonb, NULL),
('signal_jammer', 'Signal Jammer', 'Block cell and GPS signals in the area.', 'tool', 'rare', 3500, 1, TRUE, TRUE, 'accessory', '{"heist_success": 20}'::jsonb, '{"level": 15}'::jsonb, 20),

-- Consumables
('energy_drink', 'Energy Drink', 'Instant energy boost. The taste is questionable.', 'consumable', 'common', 25, 20, TRUE, FALSE, NULL, '{"energy_restore": 15}'::jsonb, '{}'::jsonb, NULL),
('meal', 'Hot Meal', 'Proper food for proper energy recovery.', 'consumable', 'common', 50, 10, TRUE, FALSE, NULL, '{"energy_restore": 30}'::jsonb, '{}'::jsonb, NULL),
('first_aid_kit', 'First Aid Kit', 'Patch yourself up after things go wrong.', 'consumable', 'common', 100, 5, TRUE, FALSE, NULL, '{"heal": 25}'::jsonb, '{}'::jsonb, NULL),
('burner_phone', 'Burner Phone', 'Disposable communication device.', 'consumable', 'common', 75, 5, TRUE, FALSE, NULL, '{"heat_reduction": 5}'::jsonb, '{}'::jsonb, NULL),
('fake_id', 'Fake ID', 'Alternate identity documents.', 'consumable', 'uncommon', 500, 3, TRUE, FALSE, NULL, '{"heat_reduction": 20}'::jsonb, '{"level": 5}'::jsonb, NULL),
('bribe_money', 'Bribe Money', 'Pre-packaged cash for quick payments.', 'consumable', 'uncommon', 1000, 5, TRUE, FALSE, NULL, '{"heat_reduction": 35, "jail_reduction": 0.5}'::jsonb, '{"level": 8}'::jsonb, NULL),
('lawyer_retainer', 'Lawyer Retainer', 'Keep legal counsel on speed dial.', 'consumable', 'rare', 5000, 2, TRUE, FALSE, NULL, '{"jail_reduction": 0.75, "fine_reduction": 0.5}'::jsonb, '{"level": 15}'::jsonb, NULL),

-- Vehicles
('bicycle', 'Bicycle', 'Cheap transportation. Good for quick getaways in traffic.', 'vehicle', 'common', 200, 1, TRUE, TRUE, 'vehicle', '{"travel_time_reduction": 10}'::jsonb, '{}'::jsonb, 100),
('motorcycle', 'Motorcycle', 'Fast and maneuverable. Essential for delivery work.', 'vehicle', 'uncommon', 5000, 1, TRUE, TRUE, 'vehicle', '{"travel_time_reduction": 30, "job_bonus": 15}'::jsonb, '{"level": 5}'::jsonb, 150),
('sedan', 'Sedan', 'Reliable four-door. Blend in with traffic.', 'vehicle', 'uncommon', 15000, 1, TRUE, TRUE, 'vehicle', '{"travel_time_reduction": 40, "storage": 2}'::jsonb, '{"level": 8}'::jsonb, 200),
('suv', 'SUV', 'Room for crew and cargo. Suburban camouflage.', 'vehicle', 'rare', 35000, 1, TRUE, TRUE, 'vehicle', '{"travel_time_reduction": 45, "storage": 5, "crew_capacity": 4}'::jsonb, '{"level": 15}'::jsonb, 250),
('sports_car', 'Sports Car', 'Fast getaway vehicle. Makes a statement.', 'vehicle', 'rare', 75000, 1, TRUE, TRUE, 'vehicle', '{"travel_time_reduction": 60, "escape_bonus": 25}'::jsonb, '{"level": 20}'::jsonb, 180),
('luxury_sedan', 'Luxury Sedan', 'Travel in style. Impresses the right people.', 'vehicle', 'epic', 120000, 1, TRUE, TRUE, 'vehicle', '{"travel_time_reduction": 50, "rep_bonus": 10}'::jsonb, '{"level": 25}'::jsonb, 220),

-- Clothing
('street_clothes', 'Street Clothes', 'Blend in with the average citizen.', 'cosmetic', 'common', 100, 1, TRUE, TRUE, 'outfit', '{"disguise": 5}'::jsonb, '{}'::jsonb, NULL),
('business_suit', 'Business Suit', 'Look professional for legitimate dealings.', 'cosmetic', 'uncommon', 500, 1, TRUE, TRUE, 'outfit', '{"rep_business_bonus": 10, "job_bonus": 10}'::jsonb, '{"level": 5}'::jsonb, NULL),
('tactical_gear', 'Tactical Gear', 'Professional equipment for professional work.', 'cosmetic', 'rare', 2500, 1, TRUE, TRUE, 'outfit', '{"crime_success": 10, "protection": 15}'::jsonb, '{"level": 15}'::jsonb, 75),
('designer_outfit', 'Designer Outfit', 'High-end fashion for high-end districts.', 'cosmetic', 'epic', 10000, 1, TRUE, TRUE, 'outfit', '{"rep_bonus": 20, "yorkville_access": true}'::jsonb, '{"level": 20}'::jsonb, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  base_value = EXCLUDED.base_value,
  max_stack = EXCLUDED.max_stack,
  is_tradeable = EXCLUDED.is_tradeable,
  is_equippable = EXCLUDED.is_equippable,
  equip_slot = EXCLUDED.equip_slot,
  effects = EXCLUDED.effects,
  requirements = EXCLUDED.requirements,
  durability_max = EXCLUDED.durability_max;

-- =============================================================================
-- MISSIONS
-- =============================================================================

INSERT INTO missions (id, name, description, mission_type, category, requirements, rewards, required_level, required_missions, is_repeatable, repeat_cooldown_hours, time_limit_minutes, sort_order) VALUES
-- Onboarding Missions (Linear progression, must complete in order)
('onboard_1_first_steps', 'First Steps', 'Welcome to Toronto. Time to learn how things work around here. Complete your first job to earn some honest cash.', 'onboarding', 'general',
  '[{"type": "complete_job", "count": 1}]'::jsonb,
  '{"cash": 100, "xp": 25}'::jsonb,
  1, '{}', FALSE, NULL, NULL, 1),

('onboard_2_quick_cash', 'Quick Cash', 'Jobs are fine, but there are faster ways to make money. Try your hand at a petty crime.', 'onboarding', 'crime',
  '[{"type": "complete_crime", "count": 1, "category": "petty"}]'::jsonb,
  '{"cash": 150, "xp": 50, "item": "switchblade"}'::jsonb,
  1, '{onboard_1_first_steps}', FALSE, NULL, NULL, 2),

('onboard_3_know_your_hood', 'Know Your Hood', 'Travel to another district. Knowing the city is essential for any hustler.', 'onboarding', 'general',
  '[{"type": "travel", "count": 1}]'::jsonb,
  '{"cash": 100, "xp": 30}'::jsonb,
  1, '{onboard_2_quick_cash}', FALSE, NULL, NULL, 3),

('onboard_4_property_ladder', 'Property Ladder', 'Real money comes from owning things. Purchase your first property.', 'onboarding', 'property',
  '[{"type": "buy_property", "count": 1}]'::jsonb,
  '{"cash": 500, "xp": 100}'::jsonb,
  1, '{onboard_3_know_your_hood}', FALSE, NULL, NULL, 4),

('onboard_5_open_for_business', 'Open for Business', 'Properties generate passive income through businesses. Open your first business.', 'onboarding', 'business',
  '[{"type": "open_business", "count": 1}]'::jsonb,
  '{"cash": 1000, "xp": 150}'::jsonb,
  2, '{onboard_4_property_ladder}', FALSE, NULL, NULL, 5),

('onboard_6_collect_dues', 'Collect Your Dues', 'Time to collect your first business earnings. The money should be rolling in.', 'onboarding', 'business',
  '[{"type": "collect_income", "count": 1}]'::jsonb,
  '{"cash": 250, "xp": 50}'::jsonb,
  2, '{onboard_5_open_for_business}', FALSE, NULL, NULL, 6),

('onboard_7_crew_up', 'Crew Up', 'You can''t run Toronto alone. Join or create a crew to expand your influence.', 'onboarding', 'social',
  '[{"type": "join_or_create_crew", "count": 1}]'::jsonb,
  '{"cash": 500, "xp": 200, "item": "burner_phone"}'::jsonb,
  5, '{onboard_6_collect_dues}', FALSE, NULL, NULL, 7),

-- Daily Missions (Reset at midnight, 3 random assigned per day)
('daily_grind', 'Daily Grind', 'Complete 3 jobs today. Honest work for honest pay.', 'daily', 'general',
  '[{"type": "complete_job", "count": 3}]'::jsonb,
  '{"cash": 300, "xp": 75}'::jsonb,
  1, '{}', TRUE, 24, NULL, 10),

('daily_hustle', 'Daily Hustle', 'Complete 3 crimes today. Keep your skills sharp.', 'daily', 'crime',
  '[{"type": "complete_crime", "count": 3}]'::jsonb,
  '{"cash": 500, "xp": 100}'::jsonb,
  2, '{}', TRUE, 24, NULL, 11),

('daily_collection', 'Collection Day', 'Collect income from all your businesses.', 'daily', 'business',
  '[{"type": "collect_all_income", "count": 1}]'::jsonb,
  '{"cash": 200, "xp": 50}'::jsonb,
  3, '{}', TRUE, 24, NULL, 12),

('daily_explorer', 'City Explorer', 'Visit 3 different districts today.', 'daily', 'general',
  '[{"type": "visit_district", "count": 3}]'::jsonb,
  '{"cash": 150, "xp": 60}'::jsonb,
  1, '{}', TRUE, 24, NULL, 13),

('daily_crew_player', 'Crew Player', 'Contribute $500 to your crew vault.', 'daily', 'social',
  '[{"type": "crew_contribution", "amount": 500}]'::jsonb,
  '{"cash": 250, "xp": 100}'::jsonb,
  5, '{}', TRUE, 24, NULL, 14),

-- Weekly Missions (Reset on Monday, larger goals)
('weekly_mogul', 'Weekly Mogul', 'Earn $10,000 from businesses this week.', 'weekly', 'business',
  '[{"type": "business_earnings", "amount": 10000}]'::jsonb,
  '{"cash": 2500, "xp": 500}'::jsonb,
  5, '{}', TRUE, 168, NULL, 20),

('weekly_crime_spree', 'Crime Spree', 'Complete 20 crimes this week.', 'weekly', 'crime',
  '[{"type": "complete_crime", "count": 20}]'::jsonb,
  '{"cash": 3000, "xp": 750, "item": "lockpick_set"}'::jsonb,
  3, '{}', TRUE, 168, NULL, 21),

('weekly_employee', 'Model Employee', 'Complete 15 jobs this week.', 'weekly', 'general',
  '[{"type": "complete_job", "count": 15}]'::jsonb,
  '{"cash": 2000, "xp": 400}'::jsonb,
  1, '{}', TRUE, 168, NULL, 22),

('weekly_property_baron', 'Property Baron', 'Own 3 or more properties simultaneously.', 'weekly', 'property',
  '[{"type": "own_properties", "count": 3}]'::jsonb,
  '{"cash": 5000, "xp": 600}'::jsonb,
  5, '{}', TRUE, 168, NULL, 23),

('weekly_crew_builder', 'Crew Builder', 'Have your crew complete 50 total crimes.', 'weekly', 'social',
  '[{"type": "crew_crimes", "count": 50}]'::jsonb,
  '{"cash": 4000, "xp": 800}'::jsonb,
  8, '{}', TRUE, 168, NULL, 24),

-- Story Missions (One-time, unlock progressively)
('story_street_cred', 'Street Cred', 'Build your reputation on the streets. Reach 100 crime reputation.', 'story', 'crime',
  '[{"type": "reach_rep_crime", "amount": 100}]'::jsonb,
  '{"cash": 1000, "xp": 300, "item": "brass_knuckles"}'::jsonb,
  3, '{}', FALSE, NULL, NULL, 30),

('story_legitimate', 'Going Legitimate', 'Build your business reputation. Reach 100 business reputation.', 'story', 'business',
  '[{"type": "reach_rep_business", "amount": 100}]'::jsonb,
  '{"cash": 1500, "xp": 350}'::jsonb,
  5, '{}', FALSE, NULL, NULL, 31),

('story_moving_up', 'Moving Up', 'Reach level 10 and prove you''re not just another corner boy.', 'story', 'general',
  '[{"type": "reach_level", "level": 10}]'::jsonb,
  '{"cash": 5000, "xp": 500, "item": "handgun"}'::jsonb,
  1, '{}', FALSE, NULL, NULL, 32),

('story_empire_builder', 'Empire Builder', 'Own 5 businesses simultaneously. You''re building something real.', 'story', 'business',
  '[{"type": "own_businesses", "count": 5}]'::jsonb,
  '{"cash": 25000, "xp": 1500}'::jsonb,
  15, '{story_legitimate}', FALSE, NULL, NULL, 33),

('story_crew_boss', 'Crew Boss', 'Lead a crew with at least 5 members.', 'story', 'social',
  '[{"type": "crew_size", "count": 5, "role": "leader"}]'::jsonb,
  '{"cash": 10000, "xp": 1000}'::jsonb,
  10, '{}', FALSE, NULL, NULL, 34),

('story_district_control', 'District Control', 'Help your crew gain controlling influence in a district.', 'story', 'social',
  '[{"type": "control_district", "count": 1}]'::jsonb,
  '{"cash": 50000, "xp": 3000}'::jsonb,
  20, '{story_crew_boss}', FALSE, NULL, NULL, 35),

('story_the_big_score', 'The Big Score', 'Successfully complete a bank heist. This is what you''ve been building toward.', 'story', 'crime',
  '[{"type": "complete_crime", "count": 1, "crime_id": "bank_heist", "result": "success"}]'::jsonb,
  '{"cash": 100000, "xp": 5000, "item": "luxury_sedan"}'::jsonb,
  25, '{story_moving_up}', FALSE, NULL, NULL, 36)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  mission_type = EXCLUDED.mission_type,
  category = EXCLUDED.category,
  requirements = EXCLUDED.requirements,
  rewards = EXCLUDED.rewards,
  required_level = EXCLUDED.required_level,
  required_missions = EXCLUDED.required_missions,
  is_repeatable = EXCLUDED.is_repeatable,
  repeat_cooldown_hours = EXCLUDED.repeat_cooldown_hours,
  time_limit_minutes = EXCLUDED.time_limit_minutes,
  sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- PROPERTY GENERATION FUNCTION
-- =============================================================================

-- Function to generate properties for a district
CREATE OR REPLACE FUNCTION generate_district_properties(
  p_district_id VARCHAR(50),
  p_property_count INT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_district RECORD;
  v_count INT := 0;
  v_parcel_code VARCHAR(20);
  v_row_letter CHAR(1);
  v_col_number INT;
  v_property_type property_type_enum;
  v_base_value BIGINT;
  v_type_roll INT;
BEGIN
  -- Get district info
  SELECT * INTO v_district FROM districts WHERE id = p_district_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'District not found: %', p_district_id;
  END IF;

  -- Default to total_parcels if count not specified
  IF p_property_count IS NULL THEN
    p_property_count := v_district.total_parcels;
  END IF;

  -- Generate properties in a grid pattern (A1, A2, ..., B1, B2, etc.)
  FOR i IN 1..p_property_count LOOP
    -- Calculate row letter (A-Z, then AA-AZ, etc.)
    v_row_letter := CHR(65 + ((i - 1) / 10) % 26);
    v_col_number := ((i - 1) % 10) + 1;
    v_parcel_code := v_row_letter || v_col_number::TEXT;

    -- Randomize property type distribution
    v_type_roll := floor(random() * 100);
    IF v_type_roll < 40 THEN
      v_property_type := 'empty';
    ELSIF v_type_roll < 65 THEN
      v_property_type := 'residential';
    ELSIF v_type_roll < 90 THEN
      v_property_type := 'commercial';
    ELSE
      v_property_type := 'industrial';
    END IF;

    -- Calculate base value with some randomization (±20%)
    v_base_value := v_district.base_property_price * (0.8 + random() * 0.4);

    -- Adjust value based on property type
    CASE v_property_type
      WHEN 'empty' THEN v_base_value := v_base_value * 0.5;
      WHEN 'residential' THEN v_base_value := v_base_value * 0.9;
      WHEN 'commercial' THEN v_base_value := v_base_value * 1.2;
      WHEN 'industrial' THEN v_base_value := v_base_value * 1.0;
    END CASE;

    -- Insert property (skip if already exists)
    INSERT INTO properties (
      district_id,
      parcel_code,
      property_type,
      base_value,
      current_value,
      condition
    ) VALUES (
      p_district_id,
      v_parcel_code,
      v_property_type,
      v_base_value,
      v_base_value,
      80 + floor(random() * 21)  -- Random condition 80-100
    )
    ON CONFLICT (district_id, parcel_code) DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION generate_district_properties IS 'Generate property parcels for a district';

-- Generate initial properties for all districts
DO $$
DECLARE
  district_record RECORD;
  properties_created INT;
BEGIN
  FOR district_record IN SELECT id, name, total_parcels FROM districts LOOP
    -- Only generate if district has no properties yet
    IF NOT EXISTS (SELECT 1 FROM properties WHERE district_id = district_record.id) THEN
      properties_created := generate_district_properties(district_record.id);
      RAISE NOTICE 'Generated % properties for %', properties_created, district_record.name;
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- =============================================================================

-- Player performance indexes
CREATE INDEX IF NOT EXISTS idx_players_rep_crime ON players(rep_crime);
CREATE INDEX IF NOT EXISTS idx_players_rep_business ON players(rep_business);
CREATE INDEX IF NOT EXISTS idx_players_cash_balance ON players(cash_balance);
CREATE INDEX IF NOT EXISTS idx_players_total_earnings ON players(total_earnings);

-- Property search indexes
CREATE INDEX IF NOT EXISTS idx_properties_value_range ON properties(current_value) WHERE owner_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_district_type ON properties(district_id, property_type);

-- Business performance indexes
CREATE INDEX IF NOT EXISTS idx_businesses_income_calc ON businesses(status, last_collection_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_businesses_owner_status ON businesses(owner_id, status);

-- Crime/job activity indexes
CREATE INDEX IF NOT EXISTS idx_crime_logs_player_recent ON crime_logs(player_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_player_recent ON job_logs(player_id, completed_at DESC);

-- Cooldown cleanup index
CREATE INDEX IF NOT EXISTS idx_cooldowns_cleanup ON player_cooldowns(expires_at) WHERE expires_at < NOW();

-- Mission progress indexes
CREATE INDEX IF NOT EXISTS idx_player_missions_claim ON player_missions(player_id, status) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_player_missions_expire ON player_missions(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

-- Marketplace active listings
CREATE INDEX IF NOT EXISTS idx_marketplace_active_price ON marketplace_listings(asking_price, listing_type) WHERE status = 'active';

-- Crew leaderboard indexes
CREATE INDEX IF NOT EXISTS idx_crews_vault ON crews(vault_balance DESC);
CREATE INDEX IF NOT EXISTS idx_crews_level ON crews(level DESC);

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute on property generation function
GRANT EXECUTE ON FUNCTION generate_district_properties TO authenticated;
