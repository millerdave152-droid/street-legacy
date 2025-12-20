-- Street Legacy Database Schema

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 10),
  police_presence INTEGER NOT NULL CHECK (police_presence >= 1 AND police_presence <= 10),
  wealth INTEGER NOT NULL CHECK (wealth >= 1 AND wealth <= 10),
  controlling_crew_id INTEGER,
  control_started_at TIMESTAMP,
  UNIQUE(city, name)
);

-- Seed districts immediately so foreign keys work
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

-- Crews table (must be before players due to foreign key)
CREATE TABLE IF NOT EXISTS crews (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  tag VARCHAR(4) NOT NULL UNIQUE,
  leader_id INTEGER NOT NULL,
  bank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  cash INTEGER NOT NULL DEFAULT 500,
  bank INTEGER NOT NULL DEFAULT 0,
  energy INTEGER NOT NULL DEFAULT 100,
  nerve INTEGER NOT NULL DEFAULT 50,
  total_earnings INTEGER NOT NULL DEFAULT 0,
  prestige_level INTEGER NOT NULL DEFAULT 0,
  current_district INTEGER REFERENCES districts(id),
  crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  in_jail BOOLEAN NOT NULL DEFAULT FALSE,
  jail_release_at TIMESTAMP,
  last_rob_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add foreign key for crews.leader_id after players table exists
ALTER TABLE crews DROP CONSTRAINT IF EXISTS crews_leader_id_fkey;
ALTER TABLE crews ADD CONSTRAINT crews_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES players(id);

-- Crew members table
CREATE TABLE IF NOT EXISTS crew_members (
  crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (crew_id, player_id)
);

-- Crimes table
CREATE TABLE IF NOT EXISTS crimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  min_level INTEGER NOT NULL DEFAULT 1,
  energy_cost INTEGER NOT NULL DEFAULT 5,
  nerve_cost INTEGER NOT NULL DEFAULT 5,
  base_success_rate INTEGER NOT NULL CHECK (base_success_rate >= 1 AND base_success_rate <= 100),
  min_payout INTEGER NOT NULL DEFAULT 0,
  max_payout INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  jail_minutes INTEGER NOT NULL DEFAULT 5
);

-- Crime logs table
CREATE TABLE IF NOT EXISTS crime_logs (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crime_id INTEGER NOT NULL REFERENCES crimes(id) ON DELETE CASCADE,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  cash_gained INTEGER NOT NULL DEFAULT 0,
  caught BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Player cooldowns table
CREATE TABLE IF NOT EXISTS player_cooldowns (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crime_id INTEGER NOT NULL REFERENCES crimes(id) ON DELETE CASCADE,
  available_at TIMESTAMP NOT NULL,
  PRIMARY KEY (player_id, crime_id)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL DEFAULT 'global',
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('weapon', 'tool', 'vehicle')),
  bonus_type VARCHAR(30) NOT NULL CHECK (bonus_type IN ('success_rate', 'payout', 'cooldown', 'crime_specific')),
  bonus_value INTEGER NOT NULL DEFAULT 0,
  crime_category VARCHAR(50),
  price INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 1
);

-- Player inventory table
CREATE TABLE IF NOT EXISTS player_inventory (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, item_id)
);

-- Missions table
CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('crime_count', 'district', 'crime_type', 'earnings', 'specific_crime')),
  target_value INTEGER NOT NULL,
  target_district_id INTEGER REFERENCES districts(id),
  target_crime_id INTEGER REFERENCES crimes(id),
  reward_cash INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0
);

-- Player missions table
CREATE TABLE IF NOT EXISTS player_missions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Rob cooldowns table
CREATE TABLE IF NOT EXISTS rob_cooldowns (
  attacker_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  available_at TIMESTAMP NOT NULL,
  PRIMARY KEY (attacker_id, target_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(10) DEFAULT '🏆',
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 1,
  requirement_extra JSONB,
  reward_cash INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0
);

-- Player achievements table
CREATE TABLE IF NOT EXISTS player_achievements (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, achievement_id)
);

-- Friends table
CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, friend_id)
);

-- Direct messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  from_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  from_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_cash INTEGER NOT NULL DEFAULT 0,
  to_cash INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Trade items table
CREATE TABLE IF NOT EXISTS trade_items (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('offering', 'requesting'))
);

-- Global events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  bonus_type VARCHAR(50) NOT NULL,
  bonus_value INTEGER NOT NULL DEFAULT 0,
  affected_district_id INTEGER REFERENCES districts(id),
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP NOT NULL
);

-- Territory war history
CREATE TABLE IF NOT EXISTS territory_wars (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  winning_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  crime_count INTEGER NOT NULL DEFAULT 0,
  war_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(district_id, war_date)
);

-- Player stats tracking (for achievements)
CREATE TABLE IF NOT EXISTS player_stats (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  total_crimes INTEGER NOT NULL DEFAULT 0,
  successful_crimes INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  total_jail_minutes INTEGER NOT NULL DEFAULT 0,
  districts_visited INTEGER[] DEFAULT '{}',
  crimes_committed INTEGER[] DEFAULT '{}',
  items_purchased INTEGER NOT NULL DEFAULT 0
);

-- =====================================================
-- ADMIN & MONETIZATION TABLES
-- =====================================================

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'moderator' CHECK (role IN ('superadmin', 'moderator')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Player reports table
CREATE TABLE IF NOT EXISTS player_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reported_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  admin_notes TEXT,
  reviewed_by INTEGER REFERENCES admin_users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

-- Add moderation columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS street_cred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8) UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES players(id);
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_login_date DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS name_color VARCHAR(50);
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT FALSE;

-- Add street cred reward to achievements
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reward_cred INTEGER NOT NULL DEFAULT 0;

-- Street cred transactions table
CREATE TABLE IF NOT EXISTS street_cred_transactions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'spend', 'bonus', 'refund')),
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cosmetics table
CREATE TABLE IF NOT EXISTS cosmetics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('name_color', 'avatar_border', 'chat_badge', 'title')),
  css_value TEXT NOT NULL,
  price_cred INTEGER,
  price_cash INTEGER,
  min_level INTEGER NOT NULL DEFAULT 1,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE
);

-- Player cosmetics table
CREATE TABLE IF NOT EXISTS player_cosmetics (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  cosmetic_id INTEGER NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, cosmetic_id)
);

-- Referral tracking table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  referee_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  rewarded_at TIMESTAMP,
  UNIQUE(referrer_id, referee_id)
);

-- Seasons table (for Battle Pass)
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE
);

-- Battle pass tiers table
CREATE TABLE IF NOT EXISTS battle_pass_tiers (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 100),
  xp_required INTEGER NOT NULL,
  free_reward_type VARCHAR(30) CHECK (free_reward_type IN ('cash', 'cred', 'xp_boost', 'cosmetic', 'item')),
  free_reward_value INTEGER,
  free_reward_id INTEGER,
  premium_reward_type VARCHAR(30) CHECK (premium_reward_type IN ('cash', 'cred', 'xp_boost', 'cosmetic', 'item', 'title')),
  premium_reward_value INTEGER,
  premium_reward_id INTEGER,
  UNIQUE(season_id, tier)
);

-- Player battle pass progress
CREATE TABLE IF NOT EXISTS player_battle_pass (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  current_tier INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_tiers JSONB NOT NULL DEFAULT '{"free": [], "premium": []}',
  UNIQUE(player_id, season_id)
);

-- Scheduled events table (for admin scheduling)
CREATE TABLE IF NOT EXISTS scheduled_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  event_config JSONB NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES admin_users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- STORYLINE SYSTEM TABLES
-- =====================================================

-- Story chapters (main storylines)
CREATE TABLE IF NOT EXISTS story_chapters (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  chapter_number INTEGER NOT NULL UNIQUE,
  min_level INTEGER NOT NULL DEFAULT 1,
  reward_cash INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_cred INTEGER NOT NULL DEFAULT 0,
  unlock_item_id INTEGER REFERENCES items(id)
);

-- Story missions (individual missions within chapters)
CREATE TABLE IF NOT EXISTS story_missions (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES story_chapters(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  dialogue TEXT,
  mission_order INTEGER NOT NULL,
  mission_type VARCHAR(30) NOT NULL CHECK (mission_type IN ('crime', 'travel', 'collect', 'rob', 'deliver', 'boss')),
  target_crime_id INTEGER REFERENCES crimes(id),
  target_district_id INTEGER REFERENCES districts(id),
  target_count INTEGER NOT NULL DEFAULT 1,
  target_amount INTEGER,
  boss_name VARCHAR(100),
  boss_difficulty INTEGER CHECK (boss_difficulty >= 1 AND boss_difficulty <= 10),
  energy_cost INTEGER NOT NULL DEFAULT 10,
  nerve_cost INTEGER NOT NULL DEFAULT 10,
  time_limit_minutes INTEGER,
  reward_cash INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  UNIQUE(chapter_id, mission_order)
);

-- Player story progress
CREATE TABLE IF NOT EXISTS player_story_progress (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES story_chapters(id) ON DELETE CASCADE,
  current_mission INTEGER NOT NULL DEFAULT 1,
  mission_progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(player_id, chapter_id)
);

-- Story mission dialogue (NPCs and conversations)
CREATE TABLE IF NOT EXISTS story_npcs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(100),
  description TEXT,
  avatar_emoji VARCHAR(10) DEFAULT '👤'
);

-- =====================================================
-- PROPERTIES/REAL ESTATE SYSTEM
-- =====================================================

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  property_type VARCHAR(30) NOT NULL CHECK (property_type IN ('safehouse', 'business', 'warehouse', 'club', 'mansion')),
  purchase_price INTEGER NOT NULL,
  daily_income INTEGER NOT NULL DEFAULT 0,
  storage_capacity INTEGER NOT NULL DEFAULT 0,
  heat_reduction INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 1
);

-- Player properties
CREATE TABLE IF NOT EXISTS player_properties (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  upgrade_level INTEGER NOT NULL DEFAULT 1,
  UNIQUE(player_id, property_id)
);

-- =====================================================
-- HEIST SYSTEM
-- =====================================================

-- Heist definitions
CREATE TABLE IF NOT EXISTS heists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 5,
  min_crew_size INTEGER NOT NULL DEFAULT 2,
  max_crew_size INTEGER NOT NULL DEFAULT 6,
  planning_hours INTEGER NOT NULL DEFAULT 24,
  base_success_rate INTEGER NOT NULL CHECK (base_success_rate >= 1 AND base_success_rate <= 100),
  min_payout INTEGER NOT NULL,
  max_payout INTEGER NOT NULL,
  heat_generated INTEGER NOT NULL DEFAULT 50,
  cooldown_hours INTEGER NOT NULL DEFAULT 72
);

-- Heist roles
CREATE TABLE IF NOT EXISTS heist_roles (
  id SERIAL PRIMARY KEY,
  heist_id INTEGER NOT NULL REFERENCES heists(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  description TEXT,
  bonus_type VARCHAR(30) CHECK (bonus_type IN ('success', 'payout', 'escape')),
  bonus_value INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false
);

-- Active heists (in planning/progress)
CREATE TABLE IF NOT EXISTS active_heists (
  id SERIAL PRIMARY KEY,
  heist_id INTEGER NOT NULL REFERENCES heists(id) ON DELETE CASCADE,
  crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  leader_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'ready', 'in_progress', 'completed', 'failed', 'cancelled')),
  planned_for TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_payout INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Heist participants
CREATE TABLE IF NOT EXISTS heist_participants (
  id SERIAL PRIMARY KEY,
  active_heist_id INTEGER NOT NULL REFERENCES active_heists(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES heist_roles(id),
  ready BOOLEAN NOT NULL DEFAULT false,
  payout_share INTEGER,
  UNIQUE(active_heist_id, player_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_district ON players(current_district);
CREATE INDEX IF NOT EXISTS idx_players_crew ON players(crew_id);
CREATE INDEX IF NOT EXISTS idx_crime_logs_player_id ON crime_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_crime_logs_created_at ON crime_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_player_cooldowns_available_at ON player_cooldowns(available_at);
CREATE INDEX IF NOT EXISTS idx_players_total_earnings ON players(total_earnings DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_player_inventory_player ON player_inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_player_missions_player ON player_missions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_missions_date ON player_missions(assigned_at);
CREATE INDEX IF NOT EXISTS idx_notifications_player ON notifications(player_id, read);
CREATE INDEX IF NOT EXISTS idx_crew_members_player ON crew_members(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_friends_player ON friends(player_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_direct_messages_to ON direct_messages(to_id, read);
CREATE INDEX IF NOT EXISTS idx_trades_to ON trades(to_player_id, status);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_crime_logs_district_date ON crime_logs(district_id, created_at);
CREATE INDEX IF NOT EXISTS idx_street_cred_transactions ON street_cred_transactions(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_cosmetics ON player_cosmetics(player_id);
CREATE INDEX IF NOT EXISTS idx_player_battle_pass ON player_battle_pass(player_id, season_id);
CREATE INDEX IF NOT EXISTS idx_player_reports ON player_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_referral ON players(referral_code);
CREATE INDEX IF NOT EXISTS idx_scheduled_events ON scheduled_events(scheduled_for, executed);
CREATE INDEX IF NOT EXISTS idx_player_story_progress ON player_story_progress(player_id);
CREATE INDEX IF NOT EXISTS idx_player_properties ON player_properties(player_id);
CREATE INDEX IF NOT EXISTS idx_active_heists ON active_heists(crew_id, status);
CREATE INDEX IF NOT EXISTS idx_heist_participants ON heist_participants(player_id);

-- =====================================================
-- SEED DATA: STORY CHAPTERS AND MISSIONS
-- =====================================================

-- Insert story NPCs
INSERT INTO story_npcs (name, title, description, avatar_emoji) VALUES
  ('Marcus "Ghost" Williams', 'Street Mentor', 'A legendary hustler who took you under his wing. He knows everyone and everything on the streets.', '👻'),
  ('Detective Sarah Chen', 'Nemesis', 'A relentless cop determined to bring you down. She has been tracking your rise through the ranks.', '👮'),
  ('Big Tony Moretti', 'Crime Boss', 'The old-school mafia boss who controls the downtown area. Cross him and you disappear.', '🎩'),
  ('Jade "The Viper" Nguyen', 'Rival', 'Your main competition. She runs her own crew and wants the same territory you do.', '🐍'),
  ('Dex', 'Tech Genius', 'Your go-to hacker. He can get into any system for the right price.', '💻')
ON CONFLICT (name) DO NOTHING;

-- Chapter 1: The Beginning
INSERT INTO story_chapters (title, description, chapter_number, min_level, reward_cash, reward_xp, reward_cred) VALUES
  ('The Beginning', 'Every legend has a beginning. Yours starts on the streets of Scarborough, with nothing but ambition and a need to survive. Marcus "Ghost" Williams sees potential in you.', 1, 1, 5000, 500, 50)
ON CONFLICT (chapter_number) DO NOTHING;

-- Chapter 1 Missions
INSERT INTO story_missions (chapter_id, title, description, dialogue, mission_order, mission_type, target_count, energy_cost, nerve_cost, reward_cash, reward_xp) VALUES
  (1, 'First Score', 'Marcus wants to see what you are made of. Pull off your first petty theft to prove yourself.', 'Ghost: "Everyone starts somewhere, kid. Show me you have got the nerve for this life. Go boost something - anything. Just do not get caught."', 1, 'crime', 1, 5, 5, 100, 50),
  (1, 'Learning the Trade', 'You have got potential. Now prove you can do it consistently. Complete 3 crimes without getting caught.', 'Ghost: "Not bad. But one score does not make a hustler. Show me you can keep your cool under pressure."', 2, 'crime', 3, 5, 5, 300, 100),
  (1, 'Know Your Turf', 'Ghost wants you to learn the neighborhood. Travel to Downtown to see how the other half lives.', 'Ghost: "You need to understand the whole city if you want to make it big. Go check out Downtown - but keep your head down. Different rules over there."', 3, 'travel', 1, 10, 0, 200, 75),
  (1, 'Building a Bankroll', 'You need capital to make moves. Earn $1,000 through any means necessary.', 'Ghost: "Money talks in this game. You need a real bankroll before anyone will take you seriously. Get out there and stack some paper."', 4, 'collect', 1, 0, 0, 500, 150),
  (1, 'The Test', 'Ghost has one final test. Take down a local tough guy who has been causing problems. Show him you mean business.', 'Ghost: "There is a punk named Rico who has been shaking down the local shops. Handle him, and you will have earned your place."', 5, 'boss', 1, 15, 15, 1000, 300)
ON CONFLICT (chapter_id, mission_order) DO NOTHING;

-- Update mission 5 with boss info
UPDATE story_missions SET boss_name = 'Rico "The Rat"', boss_difficulty = 2 WHERE chapter_id = 1 AND mission_order = 5;

-- Chapter 2: Rising Heat
INSERT INTO story_chapters (title, description, chapter_number, min_level, reward_cash, reward_xp, reward_cred) VALUES
  ('Rising Heat', 'Word of your skills is spreading. But success brings attention - both from potential allies and dangerous enemies. Detective Chen has started a file on you.', 2, 3, 15000, 1500, 100)
ON CONFLICT (chapter_number) DO NOTHING;

-- Chapter 2 Missions
INSERT INTO story_missions (chapter_id, title, description, dialogue, mission_order, mission_type, target_count, energy_cost, nerve_cost, reward_cash, reward_xp) VALUES
  (2, 'Unwanted Attention', 'Detective Chen is sniffing around. Lay low and complete crimes in a new district to throw her off.', 'Ghost: "Word is there is a cop named Chen building a case on you. Smart move is to change up your pattern. Try working a different area for a while."', 1, 'travel', 1, 10, 0, 500, 200),
  (2, 'The Competition', 'Jade "The Viper" has been moving in on your territory. Rob one of her runners to send a message.', 'Ghost: "You have got a problem. Some girl called The Viper thinks she can muscle in on our turf. Time to show her this is your block."', 2, 'rob', 1, 10, 20, 1000, 300),
  (2, 'Building Rep', 'To compete with Jade, you need to build your reputation. Complete 5 successful crimes.', 'Ghost: "If you want people to respect you over The Viper, you need to make a name for yourself. Get out there and put in work."', 3, 'crime', 5, 5, 5, 2000, 500),
  (2, 'The Big Score', 'Ghost has intel on a major target. Earn $5,000 to fund the operation.', 'Ghost: "I have got something big in the works, but we need capital. Get me five grand and I will cut you in."', 4, 'collect', 5000, 0, 0, 3000, 600),
  (2, 'Viper Strike', 'Jade has sent her enforcer after you. Take him down or lose everything you have built.', 'Jade (message): "You should not have crossed me. Marcus "Bones" is coming for you. Say your prayers."', 5, 'boss', 1, 20, 20, 5000, 1000)
ON CONFLICT (chapter_id, mission_order) DO NOTHING;

-- Update mission 5 with boss info
UPDATE story_missions SET boss_name = 'Marcus "Bones" Jackson', boss_difficulty = 4 WHERE chapter_id = 2 AND mission_order = 5;

-- Chapter 3: Into the Big Leagues
INSERT INTO story_chapters (title, description, chapter_number, min_level, reward_cash, reward_xp, reward_cred) VALUES
  ('Into the Big Leagues', 'Your success has caught the attention of Big Tony Moretti. The old mob boss wants to meet. This could be your ticket to the big time - or your grave.', 3, 5, 50000, 5000, 250)
ON CONFLICT (chapter_number) DO NOTHING;

-- Chapter 3 Missions
INSERT INTO story_missions (chapter_id, title, description, dialogue, mission_order, mission_type, target_count, energy_cost, nerve_cost, reward_cash, reward_xp) VALUES
  (3, 'The Invitation', 'Big Tony wants to meet. Travel to his territory downtown.', 'Ghost: "Big Tony Moretti wants a sit-down. This is huge, kid. He does not meet with just anyone. Do not keep him waiting."', 1, 'travel', 1, 10, 0, 1000, 500),
  (3, 'Proving Your Worth', 'Tony needs to know you can handle serious work. Complete 3 high-level crimes.', 'Tony: "Ghost says you are good. I need to see it for myself. Show me you can handle real jobs, not this penny-ante street stuff."', 2, 'crime', 3, 10, 10, 5000, 1000),
  (3, 'The Test Run', 'Tony has a job for you. Collect a debt from a restaurant owner who has been holding out.', 'Tony: "There is a restaurant on 5th that owes me $10,000. The owner thinks he can stall. Convince him otherwise."', 3, 'collect', 10000, 15, 15, 8000, 1500),
  (3, 'Cleaning House', 'Detective Chen has an informant in Tony organization. Find and deal with them.', 'Tony: "We have a rat. Someone is feeding info to that Chen cop. I am told they are hiding in Midtown. Handle it."', 4, 'boss', 1, 20, 25, 15000, 2500),
  (3, 'Made Man', 'Complete Tony final test - a high-stakes heist that will cement your place in the organization.', 'Tony: "You have done well. One last job and you are in. There is a jewelry store on Main Street. Clean it out."', 5, 'crime', 1, 30, 30, 25000, 5000)
ON CONFLICT (chapter_id, mission_order) DO NOTHING;

-- Update bosses
UPDATE story_missions SET boss_name = 'Tommy "The Snitch" Russo', boss_difficulty = 5 WHERE chapter_id = 3 AND mission_order = 4;

-- =====================================================
-- SEED DATA: PROPERTIES
-- =====================================================

INSERT INTO properties (name, description, district_id, property_type, purchase_price, daily_income, storage_capacity, heat_reduction, min_level) VALUES
  ('Run-down Apartment', 'A small apartment in a rough neighborhood. Not much, but it is yours.', 1, 'safehouse', 5000, 50, 0, 5, 1),
  ('Corner Store', 'A small convenience store that serves as a front for your operations.', 1, 'business', 25000, 500, 100, 0, 3),
  ('Storage Unit', 'A secure storage facility for keeping your goods safe.', 1, 'warehouse', 15000, 0, 500, 0, 2),
  ('Downtown Loft', 'A sleek apartment in a better part of town.', 2, 'safehouse', 50000, 200, 0, 15, 5),
  ('Nightclub', 'A popular nightclub that brings in good money and connects.', 2, 'club', 200000, 2000, 200, 10, 8),
  ('Distribution Warehouse', 'A large warehouse perfect for moving product.', 3, 'warehouse', 100000, 500, 2000, 0, 6),
  ('Luxury Penthouse', 'The ultimate status symbol. A penthouse overlooking the city.', 2, 'mansion', 1000000, 5000, 100, 25, 10),
  ('Auto Shop', 'A legitimate auto repair shop with some side business.', 1, 'business', 75000, 1000, 300, 5, 5),
  ('Private Club', 'An exclusive members-only club for the criminal elite.', 3, 'club', 500000, 3500, 150, 20, 9)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: HEISTS
-- =====================================================

INSERT INTO heists (name, description, min_level, min_crew_size, max_crew_size, planning_hours, base_success_rate, min_payout, max_payout, heat_generated, cooldown_hours) VALUES
  ('Corner Store Robbery', 'A quick smash and grab at a local convenience store. Low risk, low reward.', 3, 2, 3, 1, 75, 1000, 5000, 10, 24),
  ('Bank Truck Heist', 'Hit an armored truck during its rounds. Timing is everything.', 5, 3, 4, 12, 55, 25000, 75000, 40, 48),
  ('Jewelry Store Heist', 'A sophisticated heist targeting high-end jewelry. Requires finesse.', 7, 3, 5, 24, 45, 50000, 150000, 60, 72),
  ('Casino Vault Job', 'The ultimate score. Crack the casino vault and walk away rich.', 10, 4, 6, 48, 30, 200000, 500000, 90, 168),
  ('Art Museum Heist', 'Steal priceless artwork from the city museum. High risk, legendary payout.', 8, 4, 5, 36, 35, 100000, 300000, 75, 120)
ON CONFLICT (name) DO NOTHING;

-- Heist Roles for Bank Truck Heist
INSERT INTO heist_roles (heist_id, role_name, description, bonus_type, bonus_value, required) VALUES
  (2, 'Driver', 'Handles the getaway vehicle. Must be fast and cool under pressure.', 'escape', 20, true),
  (2, 'Gunner', 'Provides firepower and intimidation. Keeps the guards in check.', 'success', 10, true),
  (2, 'Grabber', 'Quickly loads the cash. Speed is essential.', 'payout', 15, false)
ON CONFLICT DO NOTHING;

-- Heist Roles for Casino Vault Job
INSERT INTO heist_roles (heist_id, role_name, description, bonus_type, bonus_value, required) VALUES
  (4, 'Hacker', 'Disables security systems and cameras. Essential for the job.', 'success', 15, true),
  (4, 'Safecracker', 'Opens the vault. The job cannot happen without them.', 'success', 20, true),
  (4, 'Lookout', 'Monitors police scanners and watches for trouble.', 'escape', 25, true),
  (4, 'Muscle', 'Handles any unexpected resistance.', 'success', 10, false),
  (4, 'Driver', 'Gets everyone out fast when it goes down.', 'escape', 20, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ENHANCED BANKING SYSTEM
-- =====================================================

-- Bank loans table
CREATE TABLE IF NOT EXISTS bank_loans (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  total_owed INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Safe deposit boxes table
CREATE TABLE IF NOT EXISTS safe_deposit_boxes (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 5),
  capacity INTEGER NOT NULL DEFAULT 10000,
  protected_cash INTEGER NOT NULL DEFAULT 0,
  monthly_fee INTEGER NOT NULL DEFAULT 100,
  last_fee_paid TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id)
);

-- Bank interest history
CREATE TABLE IF NOT EXISTS bank_interest_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  interest_earned INTEGER NOT NULL,
  bank_balance INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- VEHICLE SYSTEM
-- =====================================================

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('economy', 'sports', 'luxury', 'muscle', 'exotic', 'utility')),
  price INTEGER NOT NULL,
  speed INTEGER NOT NULL CHECK (speed >= 1 AND speed <= 100),
  escape_bonus INTEGER NOT NULL DEFAULT 0,
  crime_bonus INTEGER NOT NULL DEFAULT 0,
  storage INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 1
);

-- Player vehicles table
CREATE TABLE IF NOT EXISTS player_vehicles (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  condition INTEGER NOT NULL DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, vehicle_id)
);

-- =====================================================
-- PVP COMBAT & BOUNTY SYSTEM
-- =====================================================

-- PvP fights table
CREATE TABLE IF NOT EXISTS pvp_fights (
  id SERIAL PRIMARY KEY,
  attacker_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  defender_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  winner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  attacker_damage INTEGER NOT NULL DEFAULT 0,
  defender_damage INTEGER NOT NULL DEFAULT 0,
  cash_stolen INTEGER NOT NULL DEFAULT 0,
  xp_gained INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bounties table
CREATE TABLE IF NOT EXISTS bounties (
  id SERIAL PRIMARY KEY,
  target_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  placed_by INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 1000),
  reason TEXT,
  claimed_by INTEGER REFERENCES players(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired', 'cancelled')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Player combat stats
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS pvp_wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS pvp_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS bounties_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS bounties_on_head INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- CASINO / GAMBLING SYSTEM
-- =====================================================

-- Casino games table
CREATE TABLE IF NOT EXISTS casino_games (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_type VARCHAR(30) NOT NULL CHECK (game_type IN ('slots', 'blackjack', 'poker', 'roulette', 'dice')),
  bet_amount INTEGER NOT NULL,
  win_amount INTEGER NOT NULL DEFAULT 0,
  result JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Casino stats
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS casino_wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS casino_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS biggest_win INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS total_wagered INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- GANG WARS SYSTEM
-- =====================================================

-- Gang wars table
CREATE TABLE IF NOT EXISTS gang_wars (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  attacker_crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  defender_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  attacker_score INTEGER NOT NULL DEFAULT 0,
  defender_score INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  winner_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP NOT NULL
);

-- Gang war contributions
CREATE TABLE IF NOT EXISTS gang_war_contributions (
  id SERIAL PRIMARY KEY,
  war_id INTEGER NOT NULL REFERENCES gang_wars(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  crimes_committed INTEGER NOT NULL DEFAULT 0,
  cash_contributed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(war_id, player_id)
);

-- =====================================================
-- BLACK MARKET SYSTEM
-- =====================================================

-- Black market items table
CREATE TABLE IF NOT EXISTS black_market_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('contraband', 'weapon', 'intel', 'service', 'rare')),
  base_price INTEGER NOT NULL,
  effect_type VARCHAR(50),
  effect_value INTEGER,
  min_level INTEGER NOT NULL DEFAULT 1,
  rarity VARCHAR(20) NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
);

-- Black market inventory (rotating stock)
CREATE TABLE IF NOT EXISTS black_market_inventory (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES black_market_items(id) ON DELETE CASCADE,
  current_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  available_until TIMESTAMP NOT NULL
);

-- Player black market purchases
CREATE TABLE IF NOT EXISTS player_black_market (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES black_market_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- BUSINESS OPERATIONS SYSTEM
-- =====================================================

-- Business operations table
CREATE TABLE IF NOT EXISTS business_operations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('front', 'racket', 'smuggling', 'manufacturing', 'distribution')),
  setup_cost INTEGER NOT NULL,
  daily_revenue INTEGER NOT NULL,
  daily_expense INTEGER NOT NULL DEFAULT 0,
  heat_generated INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 1,
  required_property_type VARCHAR(30)
);

-- Player operations
CREATE TABLE IF NOT EXISTS player_operations (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  operation_id INTEGER NOT NULL REFERENCES business_operations(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES player_properties(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'raided', 'shutdown')),
  heat_level INTEGER NOT NULL DEFAULT 0,
  last_collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, operation_id)
);

-- =====================================================
-- DAILY/WEEKLY CHALLENGES SYSTEM
-- =====================================================

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('daily', 'weekly')),
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL,
  reward_cash INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_cred INTEGER NOT NULL DEFAULT 0,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard', 'extreme'))
);

-- Player challenges (JSON-based for flexible daily/weekly tracking)
CREATE TABLE IF NOT EXISTS player_challenges (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  daily_challenges JSONB NOT NULL DEFAULT '[]',
  daily_progress JSONB NOT NULL DEFAULT '{}',
  daily_reset_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '1 day',
  weekly_challenges JSONB NOT NULL DEFAULT '[]',
  weekly_progress JSONB NOT NULL DEFAULT '{}',
  weekly_reset_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- =====================================================
-- ENHANCED JAIL SYSTEM
-- =====================================================

-- Jail records table
CREATE TABLE IF NOT EXISTS jail_records (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crime_id INTEGER REFERENCES crimes(id),
  sentence_minutes INTEGER NOT NULL,
  bail_amount INTEGER,
  bail_paid BOOLEAN NOT NULL DEFAULT FALSE,
  escaped BOOLEAN NOT NULL DEFAULT FALSE,
  escape_attempts INTEGER NOT NULL DEFAULT 0,
  jailed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP
);

-- Add heat system to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS heat_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS protected_cash INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- EQUIPMENT SLOTS FOR INVENTORY
-- =====================================================

-- Add equipment slots column
ALTER TABLE player_inventory ADD COLUMN IF NOT EXISTS slot VARCHAR(30) CHECK (slot IN ('weapon', 'armor', 'accessory', 'vehicle', NULL));

-- Expand items table for equipment
ALTER TABLE items ADD COLUMN IF NOT EXISTS slot VARCHAR(30) CHECK (slot IN ('weapon', 'armor', 'accessory', NULL));
ALTER TABLE items ADD COLUMN IF NOT EXISTS attack_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS defense_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'));

-- =====================================================
-- NEW INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bank_loans_player ON bank_loans(player_id, status);
CREATE INDEX IF NOT EXISTS idx_safe_deposit ON safe_deposit_boxes(player_id);
CREATE INDEX IF NOT EXISTS idx_player_vehicles ON player_vehicles(player_id);
CREATE INDEX IF NOT EXISTS idx_pvp_fights_attacker ON pvp_fights(attacker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_fights_defender ON pvp_fights(defender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_id, status);
CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_casino_games ON casino_games(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gang_wars_district ON gang_wars(district_id, status);
CREATE INDEX IF NOT EXISTS idx_gang_war_contributions ON gang_war_contributions(war_id, crew_id);
CREATE INDEX IF NOT EXISTS idx_black_market_inventory ON black_market_inventory(available_until);
CREATE INDEX IF NOT EXISTS idx_player_operations ON player_operations(player_id, status);
CREATE INDEX IF NOT EXISTS idx_player_challenges ON player_challenges(player_id);
CREATE INDEX IF NOT EXISTS idx_jail_records ON jail_records(player_id, released_at);

-- =====================================================
-- SEED DATA: VEHICLES
-- =====================================================

INSERT INTO vehicles (name, description, type, price, speed, escape_bonus, crime_bonus, storage, min_level) VALUES
  ('Rusty Sedan', 'A beat-up old car. It runs... mostly.', 'economy', 2000, 20, 5, 0, 50, 1),
  ('Honda Civic', 'Reliable and inconspicuous. Perfect for blending in.', 'economy', 8000, 35, 10, 0, 100, 2),
  ('Ford Mustang', 'American muscle. Fast and loud.', 'muscle', 35000, 60, 20, 5, 150, 5),
  ('BMW M3', 'German engineering at its finest.', 'sports', 65000, 75, 25, 5, 100, 7),
  ('Dodge Charger', 'The getaway car of choice.', 'muscle', 45000, 65, 30, 10, 200, 6),
  ('Mercedes S-Class', 'Luxury and class. Shows you have made it.', 'luxury', 120000, 55, 15, 0, 150, 8),
  ('Lamborghini Huracan', 'Pure exotic speed.', 'exotic', 250000, 95, 35, 10, 50, 10),
  ('Panel Van', 'Perfect for moving product. Lots of storage.', 'utility', 25000, 30, 5, 15, 500, 4),
  ('Porsche 911', 'Iconic sports car. Fast and stylish.', 'sports', 150000, 85, 30, 5, 75, 9),
  ('Chevrolet Suburban', 'Big, tough, and practical.', 'utility', 55000, 40, 10, 5, 400, 5)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SEED DATA: BLACK MARKET ITEMS
-- =====================================================

INSERT INTO black_market_items (name, description, type, base_price, effect_type, effect_value, min_level, rarity) VALUES
  ('Fake ID', 'A high-quality fake identification. Reduces heat by 10.', 'service', 5000, 'heat_reduction', 10, 1, 'common'),
  ('Police Scanner', 'Listen in on police communications. +5% escape chance.', 'intel', 15000, 'escape_bonus', 5, 3, 'uncommon'),
  ('Silenced Pistol', 'A quiet solution. Reduces crime detection.', 'weapon', 25000, 'stealth_bonus', 10, 5, 'rare'),
  ('Insider Info', 'Intel on a big score. +20% payout on next heist.', 'intel', 50000, 'heist_payout', 20, 7, 'rare'),
  ('Burner Phone', 'Untraceable communication. Essential for operations.', 'contraband', 2000, 'heat_reduction', 5, 1, 'common'),
  ('Lock Pick Set', 'Professional grade tools. +10% success on burglaries.', 'contraband', 8000, 'crime_bonus', 10, 2, 'uncommon'),
  ('Body Armor', 'Military-grade protection. +20 defense in PvP.', 'weapon', 35000, 'defense_bonus', 20, 6, 'rare'),
  ('Getaway Driver Contact', 'A pro driver on speed dial. +15% escape chance.', 'service', 40000, 'escape_bonus', 15, 5, 'rare'),
  ('Blackmail Material', 'Leverage over a city official. Reduces jail time by 50%.', 'intel', 100000, 'jail_reduction', 50, 8, 'epic'),
  ('Golden Gun', 'A legendary weapon. +30% crime success, +25 attack.', 'weapon', 500000, 'crime_bonus', 30, 10, 'legendary')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: BUSINESS OPERATIONS
-- =====================================================

INSERT INTO business_operations (name, description, type, setup_cost, daily_revenue, daily_expense, heat_generated, min_level, required_property_type) VALUES
  ('Money Laundering', 'Clean dirty money through a legitimate front.', 'front', 50000, 2000, 500, 5, 3, 'business'),
  ('Protection Racket', 'Local businesses pay for your "protection".', 'racket', 25000, 1500, 200, 15, 2, NULL),
  ('Drug Distribution', 'Move product through the streets.', 'distribution', 100000, 5000, 1000, 25, 5, 'warehouse'),
  ('Chop Shop', 'Strip stolen cars for parts.', 'manufacturing', 75000, 3000, 750, 20, 4, 'warehouse'),
  ('Smuggling Ring', 'Import contraband across borders.', 'smuggling', 150000, 7500, 2000, 30, 7, 'warehouse'),
  ('Underground Casino', 'Run illegal gambling operations.', 'front', 200000, 10000, 3000, 20, 8, 'club'),
  ('Counterfeiting', 'Print your own money. What could go wrong?', 'manufacturing', 100000, 4000, 1500, 35, 6, 'warehouse'),
  ('Numbers Racket', 'Run an illegal lottery. House always wins.', 'racket', 30000, 2000, 300, 10, 3, NULL)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SEED DATA: CHALLENGES
-- =====================================================

INSERT INTO challenges (name, description, type, requirement_type, requirement_value, reward_cash, reward_xp, reward_cred, difficulty) VALUES
  -- Daily Challenges
  ('Street Hustler', 'Complete 5 crimes today.', 'daily', 'crimes_completed', 5, 500, 100, 5, 'easy'),
  ('Cash Collector', 'Earn $5,000 today.', 'daily', 'cash_earned', 5000, 1000, 200, 10, 'normal'),
  ('Crime Spree', 'Complete 15 crimes without getting caught.', 'daily', 'crime_streak', 15, 2500, 500, 25, 'hard'),
  ('Rob the Rich', 'Successfully rob 3 players today.', 'daily', 'players_robbed', 3, 2000, 400, 20, 'hard'),
  ('Energy Efficient', 'Complete 10 crimes using less than 50 energy.', 'daily', 'efficient_crimes', 10, 1500, 300, 15, 'normal'),
  -- Weekly Challenges
  ('Criminal Mastermind', 'Complete 50 crimes this week.', 'weekly', 'crimes_completed', 50, 10000, 2000, 100, 'normal'),
  ('Big Earner', 'Earn $100,000 this week.', 'weekly', 'cash_earned', 100000, 25000, 5000, 200, 'hard'),
  ('Untouchable', 'Avoid jail for 7 days straight.', 'weekly', 'days_free', 7, 15000, 3000, 150, 'hard'),
  ('Territory Boss', 'Help your crew control 3 territories.', 'weekly', 'territories_controlled', 3, 50000, 10000, 500, 'extreme'),
  ('High Roller', 'Win $50,000 at the casino.', 'weekly', 'casino_winnings', 50000, 20000, 4000, 250, 'hard')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA: EXPANDED SHOP ITEMS
-- =====================================================

-- Weapons
INSERT INTO items (name, description, type, bonus_type, bonus_value, price, min_level, slot, attack_bonus, defense_bonus, rarity) VALUES
  ('Baseball Bat', 'A classic street weapon.', 'weapon', 'success_rate', 3, 500, 1, 'weapon', 5, 0, 'common'),
  ('Brass Knuckles', 'For when things get personal.', 'weapon', 'success_rate', 5, 1500, 2, 'weapon', 8, 0, 'common'),
  ('Switchblade', 'Quick and deadly.', 'weapon', 'success_rate', 7, 3000, 3, 'weapon', 12, 0, 'uncommon'),
  ('Crowbar', 'Break in anywhere.', 'tool', 'crime_specific', 15, 2000, 2, 'weapon', 10, 0, 'common'),
  ('Glock 19', 'Reliable handgun.', 'weapon', 'success_rate', 10, 8000, 5, 'weapon', 20, 0, 'uncommon'),
  ('Sawed-off Shotgun', 'Up close devastation.', 'weapon', 'success_rate', 15, 15000, 7, 'weapon', 35, 0, 'rare'),
  ('AK-47', 'Serious firepower.', 'weapon', 'success_rate', 20, 35000, 9, 'weapon', 50, 0, 'rare'),
  ('Gold-Plated Desert Eagle', 'Style and stopping power.', 'weapon', 'success_rate', 25, 75000, 10, 'weapon', 45, 0, 'epic')
ON CONFLICT (name) DO NOTHING;

-- Armor
INSERT INTO items (name, description, type, bonus_type, bonus_value, price, min_level, slot, attack_bonus, defense_bonus, rarity) VALUES
  ('Leather Jacket', 'Basic protection and street cred.', 'tool', 'success_rate', 2, 1000, 1, 'armor', 0, 5, 'common'),
  ('Kevlar Vest', 'Standard bulletproof protection.', 'tool', 'success_rate', 5, 10000, 4, 'armor', 0, 20, 'uncommon'),
  ('Tactical Vest', 'Military-grade protection.', 'tool', 'success_rate', 8, 25000, 6, 'armor', 0, 35, 'rare'),
  ('Armored Suit', 'Full body protection disguised as a suit.', 'tool', 'success_rate', 12, 50000, 8, 'armor', 0, 50, 'epic')
ON CONFLICT (name) DO NOTHING;

-- Accessories
INSERT INTO items (name, description, type, bonus_type, bonus_value, price, min_level, slot, attack_bonus, defense_bonus, rarity) VALUES
  ('Ski Mask', 'Hide your identity.', 'tool', 'success_rate', 5, 500, 1, 'accessory', 0, 0, 'common'),
  ('Night Vision Goggles', 'See in the dark.', 'tool', 'crime_specific', 20, 15000, 5, 'accessory', 0, 0, 'uncommon'),
  ('Police Radio', 'Know when heat is coming.', 'tool', 'cooldown', 10, 8000, 4, 'accessory', 0, 0, 'uncommon'),
  ('Diamond Watch', 'Shows you have made it. +5% payout.', 'tool', 'payout', 5, 50000, 7, 'accessory', 0, 0, 'rare'),
  ('Lucky Dice', 'Feeling lucky? +3% success on all crimes.', 'tool', 'success_rate', 3, 25000, 5, 'accessory', 0, 0, 'rare'),
  ('Hacking Laptop', 'Digital crimes made easy.', 'tool', 'crime_specific', 25, 40000, 6, 'accessory', 0, 0, 'rare')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PHASE 1A: NEW ATTRIBUTE AND CURRENCY SYSTEM
-- =====================================================

-- New player attributes (Stamina replaces Energy, Focus replaces Nerve)
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina INTEGER NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_max INTEGER NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_regen_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS focus INTEGER NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS focus_max INTEGER NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS focus_regen_at TIMESTAMP;
ALTER TABLE players ADD COLUMN IF NOT EXISTS influence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS street_rep INTEGER NOT NULL DEFAULT 0;

-- New currency system
ALTER TABLE players ADD COLUMN IF NOT EXISTS clean_money INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS crypto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tokens INTEGER NOT NULL DEFAULT 0;

-- New crime costs
ALTER TABLE crimes ADD COLUMN IF NOT EXISTS stamina_cost INTEGER NOT NULL DEFAULT 5;
ALTER TABLE crimes ADD COLUMN IF NOT EXISTS focus_cost INTEGER NOT NULL DEFAULT 5;
ALTER TABLE crimes ADD COLUMN IF NOT EXISTS influence_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crimes ADD COLUMN IF NOT EXISTS heat_generated INTEGER NOT NULL DEFAULT 5;

-- Story mission costs
ALTER TABLE story_missions ADD COLUMN IF NOT EXISTS stamina_cost INTEGER NOT NULL DEFAULT 10;
ALTER TABLE story_missions ADD COLUMN IF NOT EXISTS focus_cost INTEGER NOT NULL DEFAULT 10;

-- Currency transactions tracking
CREATE TABLE IF NOT EXISTS currency_transactions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  currency_type VARCHAR(20) NOT NULL CHECK (currency_type IN ('cash', 'bank', 'clean_money', 'crypto', 'tokens')),
  amount INTEGER NOT NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('earn', 'spend', 'transfer', 'convert', 'bonus', 'refund')),
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Attribute regeneration tracking
CREATE TABLE IF NOT EXISTS attribute_regen_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attribute_type VARCHAR(20) NOT NULL CHECK (attribute_type IN ('stamina', 'focus')),
  amount_regenerated INTEGER NOT NULL,
  regenerated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_player ON currency_transactions(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type ON currency_transactions(currency_type, transaction_type);
CREATE INDEX IF NOT EXISTS idx_attribute_regen_player ON attribute_regen_log(player_id, regenerated_at DESC);
