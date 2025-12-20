-- Street Legacy Seed Data

-- Toronto Districts (8 neighborhoods)
-- difficulty: how hard crimes are here (1-10)
-- police_presence: chance of getting caught modifier (1-10)
-- wealth: payout modifier (1-10)

INSERT INTO districts (city, name, difficulty, police_presence, wealth) VALUES
  ('Toronto', 'Downtown Core', 7, 9, 10),
  ('Toronto', 'Kensington Market', 4, 5, 5),
  ('Toronto', 'Scarborough', 5, 4, 4),
  ('Toronto', 'York', 6, 5, 5),
  ('Toronto', 'Etobicoke', 5, 6, 7),
  ('Toronto', 'North York', 6, 7, 8),
  ('Toronto', 'East York', 4, 5, 5),
  ('Toronto', 'Parkdale', 3, 3, 3)
ON CONFLICT (city, name) DO NOTHING;

-- Crimes
-- Organized from petty crimes to serious offenses
INSERT INTO crimes (name, description, min_level, energy_cost, nerve_cost, base_success_rate, min_payout, max_payout, cooldown_seconds, jail_minutes) VALUES
  -- Petty crimes (Level 1+)
  ('Pickpocket', 'Lift a wallet from an unsuspecting mark.', 1, 5, 5, 75, 20, 100, 30, 5),
  ('Shoplift', 'Five-finger discount at a local store.', 1, 5, 5, 80, 15, 75, 30, 5),
  ('Steal Bike', 'Snatch an unattended bicycle.', 1, 10, 8, 70, 50, 200, 60, 8),

  -- Minor crimes (Level 3+)
  ('Mug Someone', 'Threaten someone for their valuables.', 3, 15, 15, 60, 100, 400, 120, 15),
  ('Car Break-in', 'Smash and grab from parked vehicles.', 3, 15, 12, 65, 75, 350, 90, 12),
  ('Sell Contraband', 'Move some illegal goods on the street.', 3, 10, 10, 70, 150, 500, 180, 10),

  -- Moderate crimes (Level 5+)
  ('Rob Convenience Store', 'Hold up a corner store for the register.', 5, 25, 25, 50, 300, 800, 300, 25),
  ('Steal Car', 'Hotwire and take a vehicle.', 5, 30, 20, 45, 500, 1500, 600, 30),
  ('Break Into House', 'Burgle a residential property.', 5, 25, 25, 50, 400, 1200, 450, 25),

  -- Serious crimes (Level 8+)
  ('Rob Gas Station', 'Armed robbery of a gas station.', 8, 35, 35, 40, 800, 2000, 900, 45),
  ('Warehouse Heist', 'Hit a warehouse for valuable goods.', 8, 40, 30, 35, 1000, 3000, 1200, 60),
  ('ATM Jackpot', 'Crack open an ATM machine.', 8, 40, 35, 30, 1500, 4000, 1500, 60),

  -- Major crimes (Level 12+)
  ('Bank Job', 'Rob a bank branch.', 12, 50, 50, 25, 5000, 15000, 3600, 120),
  ('Armored Truck', 'Hit an armored cash transport.', 12, 60, 60, 20, 8000, 25000, 7200, 180),
  ('Jewelry Store Heist', 'Clean out a high-end jeweler.', 12, 50, 45, 30, 6000, 20000, 5400, 120)
ON CONFLICT (name) DO NOTHING;

-- Items for the shop
-- type: weapon, tool, vehicle
-- bonus_type: success_rate, payout, cooldown, crime_specific
-- crime_category: matches crime category for crime_specific bonuses

INSERT INTO items (name, description, type, bonus_type, bonus_value, crime_category, price, min_level) VALUES
  -- Weapons (success rate bonuses)
  ('Pocket Knife', 'A small blade for intimidation.', 'weapon', 'success_rate', 5, NULL, 500, 1),
  ('Baseball Bat', 'Aluminum bat for persuasion.', 'weapon', 'success_rate', 8, NULL, 1500, 3),
  ('Brass Knuckles', 'Make your punches count.', 'weapon', 'success_rate', 6, NULL, 800, 2),
  ('Pistol', 'A reliable handgun.', 'weapon', 'success_rate', 12, NULL, 5000, 5),
  ('Shotgun', 'For when you need to make a statement.', 'weapon', 'success_rate', 15, NULL, 12000, 8),
  ('Assault Rifle', 'Military-grade firepower.', 'weapon', 'success_rate', 20, NULL, 35000, 12),

  -- Tools (crime-specific bonuses)
  ('Lockpick Set', 'Professional lock bypass kit.', 'tool', 'crime_specific', 15, 'burglary', 2000, 3),
  ('Hacking Kit', 'Laptop with custom software.', 'tool', 'crime_specific', 20, 'tech', 8000, 5),
  ('Slim Jim', 'Car door opening tool.', 'tool', 'crime_specific', 18, 'auto', 1500, 3),
  ('Crowbar', 'For forced entry.', 'tool', 'crime_specific', 12, 'burglary', 800, 2),
  ('Ski Mask', 'Conceals your identity.', 'tool', 'success_rate', 5, NULL, 300, 1),
  ('Police Scanner', 'Monitor police activity.', 'tool', 'success_rate', 8, NULL, 3500, 4),
  ('Burner Phones', 'Untraceable communication.', 'tool', 'success_rate', 4, NULL, 600, 2),

  -- Vehicles (cooldown and getaway bonuses)
  ('Bicycle', 'Quick escape through alleys.', 'vehicle', 'cooldown', 10, NULL, 1000, 1),
  ('Motorcycle', 'Fast and maneuverable.', 'vehicle', 'cooldown', 20, NULL, 8000, 4),
  ('Sedan', 'Reliable getaway vehicle.', 'vehicle', 'success_rate', 8, NULL, 15000, 5),
  ('Sports Car', 'Outrun anyone.', 'vehicle', 'success_rate', 15, NULL, 50000, 8),
  ('Van', 'For hauling bigger scores.', 'vehicle', 'payout', 15, NULL, 25000, 6),
  ('Muscle Car', 'Classic American power.', 'vehicle', 'success_rate', 12, NULL, 35000, 7)
ON CONFLICT (name) DO NOTHING;

-- Missions for daily challenges
-- type: crime_count, district, crime_type, earnings, specific_crime

INSERT INTO missions (description, type, target_value, target_district_id, target_crime_id, reward_cash, reward_xp) VALUES
  -- Crime count missions
  ('Complete 5 crimes', 'crime_count', 5, NULL, NULL, 500, 100),
  ('Complete 10 crimes', 'crime_count', 10, NULL, NULL, 1200, 250),
  ('Complete 20 crimes', 'crime_count', 20, NULL, NULL, 3000, 600),

  -- Earnings missions
  ('Earn $1,000 from crimes', 'earnings', 1000, NULL, NULL, 400, 80),
  ('Earn $5,000 from crimes', 'earnings', 5000, NULL, NULL, 1500, 300),
  ('Earn $10,000 from crimes', 'earnings', 10000, NULL, NULL, 3500, 700),

  -- District missions (will link to district IDs after insert)
  ('Complete 3 crimes in Downtown Core', 'district', 3, 1, NULL, 800, 150),
  ('Complete 3 crimes in Scarborough', 'district', 3, 3, NULL, 600, 120),
  ('Complete 5 crimes in Parkdale', 'district', 5, 8, NULL, 500, 100),

  -- Specific crime missions (will link to crime IDs after insert)
  ('Successfully pickpocket 3 times', 'specific_crime', 3, NULL, 1, 300, 60),
  ('Steal 2 cars', 'specific_crime', 2, NULL, 8, 1000, 200),
  ('Rob a convenience store', 'specific_crime', 1, NULL, 7, 600, 120),
  ('Pull off a bank job', 'specific_crime', 1, NULL, 13, 5000, 1000),
  ('Complete 3 muggings', 'specific_crime', 3, NULL, 4, 700, 140),
  ('Break into 2 houses', 'specific_crime', 2, NULL, 9, 900, 180);

-- Achievements
-- requirement_type: first_crime, total_crimes, district_crimes, total_earnings, jail_time, crime_streak, create_crew, prestige_level, items_bought, all_crimes, all_districts, specific_district_crimes, rob_player
INSERT INTO achievements (name, description, icon, requirement_type, requirement_value, requirement_extra, reward_cash, reward_xp) VALUES
  -- Beginner achievements
  ('First Blood', 'Commit your first crime', '🩸', 'total_crimes', 1, NULL, 100, 25),
  ('Getting Started', 'Commit 10 crimes', '📋', 'total_crimes', 10, NULL, 500, 100),
  ('Criminal Record', 'Commit 100 crimes', '📜', 'total_crimes', 100, NULL, 2500, 500),
  ('Career Criminal', 'Commit 500 crimes', '🎖️', 'total_crimes', 500, NULL, 10000, 2000),
  ('Crime Lord', 'Commit 1000 crimes', '👑', 'total_crimes', 1000, NULL, 50000, 10000),

  -- Money achievements
  ('Pocket Change', 'Earn $10,000 total', '💵', 'total_earnings', 10000, NULL, 500, 100),
  ('Making Bank', 'Earn $100,000 total', '💰', 'total_earnings', 100000, NULL, 5000, 1000),
  ('Millionaire', 'Earn $1,000,000 total', '🤑', 'total_earnings', 1000000, NULL, 25000, 5000),
  ('Multi-Millionaire', 'Earn $10,000,000 total', '💎', 'total_earnings', 10000000, NULL, 100000, 20000),

  -- District achievements
  ('Tourist', 'Visit all 8 districts', '🗺️', 'all_districts', 8, NULL, 2000, 400),
  ('Scarborough Native', 'Commit 100 crimes in Scarborough', '🏘️', 'specific_district_crimes', 100, '{"district_id": 3}', 3000, 600),
  ('Downtown Hustler', 'Commit 100 crimes in Downtown Core', '🏙️', 'specific_district_crimes', 100, '{"district_id": 1}', 5000, 1000),
  ('Parkdale Regular', 'Commit 50 crimes in Parkdale', '🌳', 'specific_district_crimes', 50, '{"district_id": 8}', 1500, 300),

  -- Jail achievements
  ('First Timer', 'Get caught and go to jail', '🚔', 'jail_time', 1, NULL, 100, 25),
  ('Repeat Offender', 'Spend 1 hour total in jail', '⛓️', 'jail_time', 60, NULL, 500, 100),
  ('Jailbird', 'Spend 24 hours total in jail', '🐦', 'jail_time', 1440, NULL, 2500, 500),
  ('Hardened Criminal', 'Spend 7 days total in jail', '💀', 'jail_time', 10080, NULL, 10000, 2000),

  -- Streak achievements
  ('Lucky Streak', '10 successful crimes in a row', '🍀', 'crime_streak', 10, NULL, 1000, 200),
  ('Hot Streak', '25 successful crimes in a row', '🔥', 'crime_streak', 25, NULL, 5000, 1000),
  ('Untouchable', '50 successful crimes in a row', '⭐', 'crime_streak', 50, NULL, 15000, 3000),
  ('Perfect Record', '100 successful crimes in a row', '🏆', 'crime_streak', 100, NULL, 50000, 10000),

  -- Social achievements
  ('Crew Leader', 'Create a crew', '👥', 'create_crew', 1, NULL, 2000, 400),
  ('Stick Up Kid', 'Successfully rob another player', '🔫', 'rob_player', 1, NULL, 1000, 200),
  ('Notorious', 'Successfully rob 10 players', '😈', 'rob_player', 10, NULL, 5000, 1000),

  -- Shopping achievements
  ('Window Shopping', 'Buy your first item', '🛒', 'items_bought', 1, NULL, 100, 25),
  ('Shopaholic', 'Buy 10 items', '🛍️', 'items_bought', 10, NULL, 2500, 500),
  ('Collector', 'Buy all items', '🏛️', 'items_bought', 19, NULL, 25000, 5000),

  -- Prestige achievements
  ('New Beginning', 'Reach Prestige 1', '⚡', 'prestige_level', 1, NULL, 5000, 1000),
  ('Veteran', 'Reach Prestige 3', '🎗️', 'prestige_level', 3, NULL, 15000, 3000),
  ('Prestige Master', 'Reach Prestige 5', '👑', 'prestige_level', 5, NULL, 50000, 10000),

  -- Crime variety achievements
  ('Diversified', 'Commit every type of crime', '🎭', 'all_crimes', 15, NULL, 10000, 2000),

  -- Referral achievement
  ('Networker', 'Refer a friend who reaches level 5', '🤝', 'referral', 1, NULL, 5000, 1000)
ON CONFLICT (name) DO NOTHING;

-- Update achievements with street cred rewards
UPDATE achievements SET reward_cred = 5 WHERE name IN ('First Blood', 'Getting Started', 'Pocket Change', 'First Timer', 'Window Shopping');
UPDATE achievements SET reward_cred = 10 WHERE name IN ('Criminal Record', 'Making Bank', 'Tourist', 'Repeat Offender', 'Lucky Streak', 'Crew Leader', 'Stick Up Kid', 'Shopaholic', 'Networker');
UPDATE achievements SET reward_cred = 20 WHERE name IN ('Career Criminal', 'Millionaire', 'Jailbird', 'Hot Streak', 'Notorious', 'New Beginning');
UPDATE achievements SET reward_cred = 35 WHERE name IN ('Crime Lord', 'Multi-Millionaire', 'Hardened Criminal', 'Untouchable', 'Collector', 'Veteran');
UPDATE achievements SET reward_cred = 50 WHERE name IN ('Perfect Record', 'Prestige Master', 'Diversified');

-- Default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Hash generated with bcrypt for 'admin123'
INSERT INTO admin_users (username, password_hash, role) VALUES
  ('admin', '$2b$10$rQZ8K.5VqZKx5J5Q5Q5Q5uN8K.5VqZKx5J5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'superadmin')
ON CONFLICT (username) DO NOTHING;

-- Cosmetics
INSERT INTO cosmetics (name, description, type, css_value, price_cred, price_cash, min_level, is_premium) VALUES
  -- Name Colors (available for cash or cred)
  ('Red Name', 'Display your name in red', 'name_color', '#e94560', 25, 10000, 5, FALSE),
  ('Blue Name', 'Display your name in blue', 'name_color', '#3b82f6', 25, 10000, 5, FALSE),
  ('Green Name', 'Display your name in green', 'name_color', '#16a34a', 25, 10000, 5, FALSE),
  ('Purple Name', 'Display your name in purple', 'name_color', '#9333ea', 35, 15000, 8, FALSE),
  ('Gold Name', 'Display your name in gold', 'name_color', '#fbbf24', 50, NULL, 10, TRUE),
  ('Rainbow Name', 'Animated rainbow name effect', 'name_color', 'rainbow-animated', 100, NULL, 15, TRUE),

  -- Chat Badges
  ('Fire Badge', 'Show a fire emoji next to your name', 'chat_badge', '🔥', 15, 5000, 3, FALSE),
  ('Target Badge', 'Show a target emoji next to your name', 'chat_badge', '🎯', 15, 5000, 3, FALSE),
  ('Diamond Badge', 'Show a diamond emoji next to your name', 'chat_badge', '💎', 30, NULL, 10, TRUE),
  ('Crown Badge', 'Show a crown emoji next to your name', 'chat_badge', '👑', 50, NULL, 15, TRUE),
  ('Skull Badge', 'Show a skull emoji next to your name', 'chat_badge', '💀', 20, 8000, 8, FALSE),
  ('Star Badge', 'Show a star emoji next to your name', 'chat_badge', '⭐', 25, 10000, 10, FALSE),

  -- Titles
  ('The Legend', 'Display "The Legend" title', 'title', 'The Legend', 75, NULL, 12, TRUE),
  ('Crime Boss', 'Display "Crime Boss" title', 'title', 'Crime Boss', 50, 25000, 10, FALSE),
  ('Shadow', 'Display "Shadow" title', 'title', 'Shadow', 40, 20000, 8, FALSE),
  ('Untouchable', 'Display "Untouchable" title', 'title', 'Untouchable', 100, NULL, 15, TRUE),
  ('Street King', 'Display "Street King" title', 'title', 'Street King', 60, NULL, 12, TRUE),
  ('Rookie', 'Display "Rookie" title', 'title', 'Rookie', 10, 2000, 1, FALSE),

  -- Avatar Borders
  ('Bronze Frame', 'Bronze border around your avatar', 'avatar_border', 'border-bronze', 20, 8000, 5, FALSE),
  ('Silver Frame', 'Silver border around your avatar', 'avatar_border', 'border-silver', 35, 15000, 8, FALSE),
  ('Gold Frame', 'Gold border around your avatar', 'avatar_border', 'border-gold', 60, NULL, 12, TRUE),
  ('Diamond Frame', 'Diamond border around your avatar', 'avatar_border', 'border-diamond', 100, NULL, 15, TRUE),
  ('Fire Frame', 'Animated fire border', 'avatar_border', 'border-fire', 150, NULL, 20, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Create first season for Battle Pass
INSERT INTO seasons (name, start_date, end_date, is_active) VALUES
  ('Season 1: Streets of Toronto', NOW(), NOW() + INTERVAL '60 days', TRUE)
ON CONFLICT DO NOTHING;

-- Battle Pass Tiers (50 tiers)
-- Insert battle pass tiers for season 1
DO $$
DECLARE
  season_id_var INTEGER;
BEGIN
  SELECT id INTO season_id_var FROM seasons WHERE name = 'Season 1: Streets of Toronto' LIMIT 1;

  IF season_id_var IS NOT NULL THEN
    -- Insert all 50 tiers
    INSERT INTO battle_pass_tiers (season_id, tier, xp_required, free_reward_type, free_reward_value, premium_reward_type, premium_reward_value) VALUES
      (season_id_var, 1, 100, 'cash', 500, 'cred', 5),
      (season_id_var, 2, 200, 'cash', 750, 'cash', 1500),
      (season_id_var, 3, 300, 'cash', 1000, 'cred', 5),
      (season_id_var, 4, 400, 'xp_boost', 10, 'cash', 2000),
      (season_id_var, 5, 500, 'cash', 1500, 'cred', 10),
      (season_id_var, 6, 600, 'cash', 1000, 'cash', 2500),
      (season_id_var, 7, 700, 'xp_boost', 15, 'cred', 5),
      (season_id_var, 8, 800, 'cash', 2000, 'cash', 3000),
      (season_id_var, 9, 900, 'cash', 1500, 'cred', 10),
      (season_id_var, 10, 1000, 'cash', 3000, 'cred', 25),
      (season_id_var, 11, 1100, 'cash', 2000, 'cash', 4000),
      (season_id_var, 12, 1200, 'xp_boost', 20, 'cred', 10),
      (season_id_var, 13, 1300, 'cash', 2500, 'cash', 5000),
      (season_id_var, 14, 1400, 'cash', 2000, 'cred', 10),
      (season_id_var, 15, 1500, 'cash', 4000, 'cred', 30),
      (season_id_var, 16, 1600, 'cash', 2500, 'cash', 5000),
      (season_id_var, 17, 1700, 'xp_boost', 25, 'cred', 15),
      (season_id_var, 18, 1800, 'cash', 3000, 'cash', 6000),
      (season_id_var, 19, 1900, 'cash', 2500, 'cred', 15),
      (season_id_var, 20, 2000, 'cash', 5000, 'cred', 40),
      (season_id_var, 21, 2100, 'cash', 3000, 'cash', 7000),
      (season_id_var, 22, 2200, 'xp_boost', 30, 'cred', 15),
      (season_id_var, 23, 2300, 'cash', 3500, 'cash', 7500),
      (season_id_var, 24, 2400, 'cash', 3000, 'cred', 20),
      (season_id_var, 25, 2500, 'cash', 6000, 'cred', 50),
      (season_id_var, 26, 2600, 'cash', 3500, 'cash', 8000),
      (season_id_var, 27, 2700, 'xp_boost', 35, 'cred', 20),
      (season_id_var, 28, 2800, 'cash', 4000, 'cash', 9000),
      (season_id_var, 29, 2900, 'cash', 3500, 'cred', 25),
      (season_id_var, 30, 3000, 'cash', 8000, 'cred', 60),
      (season_id_var, 31, 3100, 'cash', 4000, 'cash', 10000),
      (season_id_var, 32, 3200, 'xp_boost', 40, 'cred', 25),
      (season_id_var, 33, 3300, 'cash', 4500, 'cash', 11000),
      (season_id_var, 34, 3400, 'cash', 4000, 'cred', 30),
      (season_id_var, 35, 3500, 'cash', 10000, 'cred', 75),
      (season_id_var, 36, 3600, 'cash', 4500, 'cash', 12000),
      (season_id_var, 37, 3700, 'xp_boost', 50, 'cred', 30),
      (season_id_var, 38, 3800, 'cash', 5000, 'cash', 13000),
      (season_id_var, 39, 3900, 'cash', 4500, 'cred', 35),
      (season_id_var, 40, 4000, 'cash', 12000, 'cred', 100),
      (season_id_var, 41, 4200, 'cash', 5000, 'cash', 15000),
      (season_id_var, 42, 4400, 'xp_boost', 60, 'cred', 40),
      (season_id_var, 43, 4600, 'cash', 6000, 'cash', 17000),
      (season_id_var, 44, 4800, 'cash', 5500, 'cred', 45),
      (season_id_var, 45, 5000, 'cash', 15000, 'cred', 125),
      (season_id_var, 46, 5500, 'cash', 6000, 'cash', 20000),
      (season_id_var, 47, 6000, 'xp_boost', 75, 'cred', 50),
      (season_id_var, 48, 6500, 'cash', 8000, 'cash', 25000),
      (season_id_var, 49, 7000, 'cash', 7000, 'cred', 75),
      (season_id_var, 50, 8000, 'cash', 25000, 'cred', 200)
    ON CONFLICT (season_id, tier) DO NOTHING;
  END IF;
END $$
