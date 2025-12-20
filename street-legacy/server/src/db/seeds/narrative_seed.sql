-- ============================================================================
-- Narrative Systems Seed Data
-- Seeds test data for all narrative features
-- Run after core migrations and player seeds
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATE MISSING TABLES (with safe column additions for existing tables)
-- ============================================================================

-- World Events Table (for narrative integration service)
-- Drop and recreate to ensure correct schema
DROP TABLE IF EXISTS world_events CASCADE;
CREATE TABLE world_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  district_id VARCHAR(50),
  caused_by_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  title VARCHAR(200),
  description TEXT,
  significance INTEGER DEFAULT 5 CHECK (significance >= 1 AND significance <= 10),
  is_landmark BOOLEAN DEFAULT FALSE,
  monument_name VARCHAR(200),
  monument_description TEXT,
  involved_players TEXT[],
  involved_factions TEXT[],
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_world_events_district ON world_events(district_id);
CREATE INDEX idx_world_events_type ON world_events(event_type);
CREATE INDEX idx_world_events_significance ON world_events(significance DESC);
CREATE INDEX idx_world_events_player ON world_events(caused_by_player_id);
CREATE INDEX idx_world_events_landmark ON world_events(is_landmark) WHERE is_landmark = true;

-- NPC Memories Table
DROP TABLE IF EXISTS npc_memories CASCADE;
CREATE TABLE npc_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  npc_id VARCHAR(100) NOT NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  memory_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  emotional_tone VARCHAR(50),
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  district_id VARCHAR(50),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_npc_memories_npc ON npc_memories(npc_id);
CREATE INDEX idx_npc_memories_player ON npc_memories(player_id);
CREATE INDEX idx_npc_memories_district ON npc_memories(district_id);

-- Street News Table
DROP TABLE IF EXISTS street_news CASCADE;
CREATE TABLE street_news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  headline VARCHAR(300) NOT NULL,
  content TEXT,
  district_id VARCHAR(50),
  related_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  related_crew_id INTEGER,
  is_breaking BOOLEAN DEFAULT FALSE,
  significance INTEGER DEFAULT 5,
  source_type VARCHAR(50) DEFAULT 'anonymous',
  read_by INTEGER[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_street_news_category ON street_news(category);
CREATE INDEX idx_street_news_district ON street_news(district_id);
CREATE INDEX idx_street_news_breaking ON street_news(is_breaking) WHERE is_breaking = true;
CREATE INDEX idx_street_news_created ON street_news(created_at DESC);

-- News Subscriptions Table
DROP TABLE IF EXISTS news_subscriptions CASCADE;
CREATE TABLE news_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subscription_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, subscription_type, target_id)
);

CREATE INDEX idx_news_subscriptions_player ON news_subscriptions(player_id);

-- Debts Table
DROP TABLE IF EXISTS debt_marketplace CASCADE;
DROP TABLE IF EXISTS debt_transfers CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creditor_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  debtor_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  debt_type VARCHAR(50) NOT NULL,
  description TEXT,
  original_value INTEGER DEFAULT 0,
  current_value INTEGER DEFAULT 0,
  interest_rate INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'outstanding',
  due_date TIMESTAMPTZ,
  called_in_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debts_creditor ON debts(creditor_id);
CREATE INDEX idx_debts_debtor ON debts(debtor_id);
CREATE INDEX idx_debts_status ON debts(status);

-- Debt Transfers Table
CREATE TABLE debt_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  from_creditor_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  to_creditor_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  transfer_price INTEGER DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debt Marketplace Table
CREATE TABLE debt_marketplace (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  asking_price INTEGER NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  buyer_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ
);

CREATE INDEX idx_debt_marketplace_status ON debt_marketplace(status);
CREATE INDEX idx_debt_marketplace_seller ON debt_marketplace(seller_id);

-- Dynasty/Continuity tables - only create if migration 032 hasn't run
-- Check if character_endings exists and has the right columns
DO $$
BEGIN
  -- Only create these if they don't exist (migration 032 should have created them)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_endings') THEN
    CREATE TABLE character_endings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      ending_type VARCHAR(50) NOT NULL,
      ending_description TEXT,
      final_stats JSONB DEFAULT '{}',
      legacy_score INTEGER DEFAULT 0,
      occurred_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_character_endings_player ON character_endings(player_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_lineage') THEN
    CREATE TABLE player_lineage (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      predecessor_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      dynasty_id INTEGER,
      generation INTEGER DEFAULT 1,
      inheritance_received JSONB DEFAULT '{}',
      relationship VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_player_lineage_player ON player_lineage(player_id);
    CREATE INDEX idx_player_lineage_predecessor ON player_lineage(predecessor_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'succession_plans') THEN
    CREATE TABLE succession_plans (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
      heir_type VARCHAR(50) DEFAULT 'random',
      designated_heir_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      cash_percent INTEGER DEFAULT 50,
      property_percent INTEGER DEFAULT 50,
      reputation_percent INTEGER DEFAULT 25,
      crew_transfer BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_succession_plans_player ON succession_plans(player_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dynasty_achievements') THEN
    CREATE TABLE dynasty_achievements (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      dynasty_id VARCHAR(100) NOT NULL,
      achievement_type VARCHAR(50) NOT NULL,
      achievement_name VARCHAR(200) NOT NULL,
      description TEXT,
      achieved_by_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      achieved_at TIMESTAMPTZ DEFAULT NOW(),
      bonus_granted JSONB DEFAULT '{}',
      metadata JSONB DEFAULT '{}'
    );
    CREATE INDEX idx_dynasty_achievements_dynasty ON dynasty_achievements(dynasty_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_life_state') THEN
    CREATE TABLE player_life_state (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
      current_chapter VARCHAR(50) DEFAULT 'young_hustler',
      character_age INTEGER DEFAULT 18,
      years_active INTEGER DEFAULT 0,
      health_status INTEGER DEFAULT 100,
      chapter_started_at TIMESTAMPTZ DEFAULT NOW(),
      unlocked_features TEXT[] DEFAULT '{}',
      milestones_achieved TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_player_life_state_player ON player_life_state(player_id);
    CREATE INDEX idx_player_life_state_chapter ON player_life_state(current_chapter);
  END IF;
END $$;

-- ============================================================================
-- CREATE TEST PLAYERS
-- ============================================================================

INSERT INTO players (id, username, email, password_hash, level, cash, bank, current_district, created_at)
VALUES
  (901, 'TestBoss', 'testboss@test.com', '$2b$10$test', 45, 500000, 2000000, 1, NOW() - INTERVAL '2 years'),
  (902, 'TestHustler', 'testhustler@test.com', '$2b$10$test', 25, 50000, 100000, 2, NOW() - INTERVAL '6 months'),
  (903, 'TestRookie', 'testrookie@test.com', '$2b$10$test', 10, 5000, 10000, 3, NOW() - INTERVAL '1 month'),
  (904, 'TestVeteran', 'testveteran@test.com', '$2b$10$test', 60, 1000000, 5000000, 1, NOW() - INTERVAL '5 years'),
  (905, 'TestEnforcer', 'testenforcer@test.com', '$2b$10$test', 35, 200000, 500000, 4, NOW() - INTERVAL '1 year'),
  (906, 'LegacyFounder', 'legacyfounder@test.com', '$2b$10$test', 1, 0, 0, 1, NOW() - INTERVAL '10 years'),
  (907, 'LegacyHeir', 'legacyheir@test.com', '$2b$10$test', 1, 0, 0, 1, NOW() - INTERVAL '5 years'),
  (908, 'LegacyCurrent', 'legacycurrent@test.com', '$2b$10$test', 30, 300000, 800000, 1, NOW() - INTERVAL '1 year')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;

-- ============================================================================
-- WORLD MEMORY SYSTEM
-- ============================================================================

-- 10 Sample World Events across districts
INSERT INTO world_events (event_type, title, description, district_id, significance, involved_players, involved_factions, metadata, occurred_at)
VALUES
  ('gang_war', 'The Downtown Massacre', 'A brutal gang war erupted between the Eastside Kings and Westside Lords, leaving 12 dead.', '1', 10, ARRAY['901', '904'], ARRAY['eastside_kings', 'westside_lords'], '{"casualties": 12}', NOW() - INTERVAL '30 days'),
  ('heist', 'The First National Heist', 'A legendary crew pulled off the biggest bank heist in city history, stealing $50 million.', '2', 9, ARRAY['901', '902', '905'], NULL, '{"stolen_amount": 50000000}', NOW() - INTERVAL '60 days'),
  ('territory_capture', 'Fall of the Parkdale Kings', 'The infamous Parkdale Kings lost control of their home turf.', '3', 8, ARRAY['904', '905'], ARRAY['parkdale_kings'], '{"territory_size": 5}', NOW() - INTERVAL '14 days'),
  ('crime_spree', 'The Week of Chaos', 'A week-long crime spree terrorized the district with over 50 reported robberies.', '4', 7, ARRAY['902', '903'], NULL, '{"total_crimes": 52}', NOW() - INTERVAL '21 days'),
  ('police_raid', 'Operation Clean Streets', 'Police conducted massive raids, arresting 25 suspected gang members.', '5', 7, ARRAY['901'], ARRAY['syndicate'], '{"arrests": 25}', NOW() - INTERVAL '7 days'),
  ('alliance_formed', 'The North Pact', 'Three rival crews signed a non-aggression pact, reshaping power dynamics.', '6', 6, ARRAY['901', '904', '905'], ARRAY['north_kings', 'york_demons'], '{"crews_involved": 3}', NOW() - INTERVAL '45 days'),
  ('business_takeover', 'The Yorkville Buyout', 'A mysterious investor bought out three nightclubs.', '7', 5, ARRAY['901'], NULL, '{"businesses_acquired": 3}', NOW() - INTERVAL '10 days'),
  ('street_race', 'Midnight Thunder', 'An illegal street race drew crowds of 500 spectators.', '8', 4, ARRAY['902', '903'], NULL, '{"participants": 12}', NOW() - INTERVAL '3 days'),
  ('informant_exposed', 'The Rat Revealed', 'A long-suspected informant was finally exposed.', '9', 6, ARRAY['904', '905'], ARRAY['portlands_crew'], '{"informant_fate": "disappeared"}', NOW() - INTERVAL '5 days'),
  ('celebrity_sighting', 'VIP at The Beach', 'A famous rapper was spotted at an underground club.', '10', 3, ARRAY['902'], NULL, '{"publicity_boost": true}', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- 5 Landmark Events with Monuments
INSERT INTO world_events (event_type, title, description, district_id, significance, is_landmark, monument_name, monument_description, involved_players, occurred_at)
VALUES
  ('legendary_heist', 'The Great Train Score', 'The legendary heist that put the city on the map. $100 million in gold disappeared.', '9', 10, true, 'Platform 7 Plaque', 'A weathered brass plaque reads: "Here, legends were made."', ARRAY['906'], NOW() - INTERVAL '5 years'),
  ('gang_war', 'The Truce of Blood Alley', 'After months of bloodshed, rival gang leaders met to negotiate peace.', '3', 10, true, 'Blood Alley Mural', 'A massive mural depicts two hands shaking over a blood-red background.', ARRAY['906', '907'], NOW() - INTERVAL '8 years'),
  ('assassination', 'Fall of Don Marcello', 'The legendary crime boss was assassinated at his favorite restaurant.', '8', 10, true, 'Don Marcello Memorial', 'A small shrine with photos and candles marks the corner booth.', ARRAY['906'], NOW() - INTERVAL '10 years'),
  ('prison_break', 'The Impossible Escape', 'Three inmates escaped from the supposedly escape-proof Central Detention.', '1', 9, true, 'Freedom Birds Graffiti', 'Graffiti shows three birds flying free, repainted whenever removed.', ARRAY['906', '907'], NOW() - INTERVAL '7 years'),
  ('betrayal', 'The Night of Long Knives', 'A coordinated betrayal wiped out an entire crime family.', '2', 10, true, 'Black Obelisk', 'An unmarked black obelisk stands in the park. Locals know its meaning.', ARRAY['907'], NOW() - INTERVAL '4 years')
ON CONFLICT DO NOTHING;

-- 20 NPC Memories
INSERT INTO npc_memories (npc_id, player_id, memory_type, description, emotional_tone, importance, district_id, expires_at, created_at)
VALUES
  ('bartender_mike', 901, 'witnessed', 'I saw this guy take out three armed men without breaking a sweat.', 'respect', 9, '1', NULL, NOW() - INTERVAL '6 months'),
  ('dealer_tony', 901, 'business', 'We did a big deal together. Clean, professional, no drama.', 'trust', 8, '3', NULL, NOW() - INTERVAL '3 months'),
  ('informant_snake', 901, 'fear', 'I gave the cops some info about his crew. Praying he never finds out.', 'fear', 10, '4', NOW() + INTERVAL '30 days', NOW() - INTERVAL '1 month'),
  ('shopkeeper_chen', 901, 'protection', 'He keeps the troublemakers away from my store.', 'gratitude', 7, '8', NULL, NOW() - INTERVAL '1 year'),
  ('fence_maria', 902, 'business', 'Young and ambitious, but sometimes too eager.', 'cautious', 6, '8', NULL, NOW() - INTERVAL '2 months'),
  ('driver_pete', 902, 'heist', 'We did that race together. Kid can handle a car.', 'respect', 5, '10', NULL, NOW() - INTERVAL '3 days'),
  ('bouncer_big_joe', 902, 'witnessed', 'Tried to start something in my club. Handled it poorly.', 'annoyance', 4, '7', NOW() + INTERVAL '14 days', NOW() - INTERVAL '2 weeks'),
  ('mentor_oldman', 903, 'teaching', 'Got potential, this one. Reminds me of myself forty years ago.', 'fondness', 6, '3', NULL, NOW() - INTERVAL '3 weeks'),
  ('rival_jimmy', 903, 'conflict', 'This punk tried to move in on my corner.', 'anger', 5, '4', NULL, NOW() - INTERVAL '1 week'),
  ('waitress_linda', 903, 'kindness', 'He always tips well, even when hes clearly broke.', 'warmth', 3, '9', NULL, NOW() - INTERVAL '5 days'),
  ('cop_rodriguez', 904, 'investigation', 'Been after this one for 20 years. Always one step ahead.', 'grudging_respect', 9, '1', NULL, NOW() - INTERVAL '2 years'),
  ('judge_morrison', 904, 'legal', 'Walked out of my courtroom three times. Best lawyers money can buy.', 'frustration', 8, '2', NULL, NOW() - INTERVAL '1 year'),
  ('widow_anna', 904, 'grief', 'He killed my husband. I will see him pay.', 'hatred', 10, '6', NULL, NOW() - INTERVAL '5 years'),
  ('priest_father_tom', 904, 'confession', 'He comes to confession every Sunday. The weight he carries...', 'concern', 7, '3', NULL, NOW() - INTERVAL '6 months'),
  ('victim_marcus', 905, 'violence', 'Broke both my legs over a late payment. I still walk with a limp.', 'terror', 8, '5', NULL, NOW() - INTERVAL '8 months'),
  ('boss_don_carlo', 905, 'loyalty', 'My most reliable soldier. When I need something done, he does it.', 'trust', 9, '1', NULL, NOW() - INTERVAL '3 months'),
  ('rival_enforcer_bone', 905, 'respect', 'We fought twice. Won once each. Next time decides it all.', 'rivalry', 7, '3', NULL, NOW() - INTERVAL '4 months'),
  ('homeless_willie', 901, 'witnessed', 'I seen everything from my corner. That man in the suit? He runs this whole block.', 'awe', 6, '1', NULL, NOW() - INTERVAL '1 year'),
  ('street_kid_ricky', 902, 'aspiration', 'Thats who I wanna be when I grow up.', 'admiration', 4, '4', NULL, NOW() - INTERVAL '2 months'),
  ('taxi_driver_ahmed', 904, 'fear', 'I drove him once. Never again. The silence in that car...', 'dread', 5, '2', NULL, NOW() - INTERVAL '3 months')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- WITNESS SYSTEM (using existing table schema)
-- ============================================================================

-- Witnessed Events
INSERT INTO witnessed_events (event_type, actor_player_id, target_player_id, district_id, event_description, event_severity, metadata, verification_window_ends, occurred_at)
VALUES
  ('crime_committed', 901, NULL, '1', 'TestBoss executed a perfect heist at the Diamond Exchange.', 9, '{"crime_type": "heist", "value": 5000000}', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '3 days'),
  ('player_attack', 905, 903, '3', 'TestEnforcer brutally defeated TestRookie in a street fight.', 7, '{"damage_dealt": 150}', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '2 days'),
  ('territory_capture', 904, NULL, '5', 'TestVeteran and his crew seized control of three blocks.', 8, '{"blocks_captured": 3}', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '5 days'),
  ('crime_committed', 901, NULL, '8', 'TestBoss and TestHustler completed a major exchange.', 6, '{"deal_type": "goods", "value": 200000}', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '7 days'),
  ('crime_committed', 905, NULL, '4', 'TestEnforcer made an example of a local shopkeeper.', 5, '{"method": "intimidation"}', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '10 days'),
  ('crime_committed', 902, NULL, '10', 'TestHustler allegedly robbed a high-end jewelry store.', 7, '{"crime_type": "robbery", "value": 150000}', NOW() + INTERVAL '12 hours', NOW() - INTERVAL '6 hours'),
  ('player_attack', 904, 901, '1', 'TestVeteran reportedly ordered a hit on TestBoss.', 10, '{"method": "ambush", "outcome": "failed"}', NOW() + INTERVAL '18 hours', NOW() - INTERVAL '12 hours'),
  ('crime_committed', 901, NULL, '2', 'TestBoss was seen paying off a police captain.', 6, '{"amount": 50000}', NOW() + INTERVAL '20 hours', NOW() - INTERVAL '8 hours')
ON CONFLICT DO NOTHING;

-- Event Witnesses (linked to witnessed_events)
INSERT INTO event_witnesses (witnessed_event_id, witness_player_id, witness_status, testimony)
SELECT
  we.id,
  p.id,
  'verified'::witness_status_enum,
  'I was there. Saw the whole thing go down.'
FROM witnessed_events we
CROSS JOIN (SELECT id FROM players WHERE id IN (902, 903, 905) LIMIT 1) p
WHERE we.event_severity >= 7
LIMIT 5
ON CONFLICT DO NOTHING;

-- Player Testimonials
INSERT INTO player_testimonials (player_id, witness_player_id, testimonial_text, event_type)
VALUES
  (901, 902, 'TestBoss runs a tight operation. Saw him handle a crisis like a true professional.', 'crime_committed'),
  (901, 903, 'I watched him deal with a snitch. I will never cross this man.', 'player_attack'),
  (901, 905, 'We worked together on the Downtown job. Reliable partner.', 'heist'),
  (904, 901, 'TestVeteran thinks he runs this city. We will see about that.', 'territory_capture'),
  (905, 902, 'TestEnforcer broke my friends arm over $500. The man is a monster.', 'player_attack'),
  (902, 903, 'TestHustler showed me the ropes when I was new. Good mentor.', 'teaching'),
  (904, 905, 'Old school. Does things the right way. Earned his reputation.', 'crime_committed'),
  (902, 901, 'Kid has potential. Needs to learn patience but hes going places.', 'mentorship')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STREET BROADCAST SYSTEM
-- ============================================================================

-- Street News Articles
INSERT INTO street_news (category, headline, content, district_id, related_player_id, is_breaking, significance, source_type, metadata, expires_at)
VALUES
  ('breaking', 'BREAKING: Massive Shootout Downtown', 'Multiple casualties reported as rival gangs clash in broad daylight.', '1', NULL, true, 10, 'system', '{"casualties": 5}', NOW() + INTERVAL '24 hours'),
  ('breaking', 'BREAKING: Federal Indictments Expected', 'Sources say the FBI is preparing major RICO indictments.', '2', NULL, true, 9, 'anonymous', '{}', NOW() + INTERVAL '48 hours'),
  ('crime', 'Diamond Exchange Heist: $5M Missing', 'A sophisticated crew hit the Diamond Exchange last night.', '2', 901, false, 8, 'reporter', '{"stolen_value": 5000000}', NULL),
  ('crime', 'Arson Investigation Ongoing', 'Fire investigators suspect foul play in warehouse blaze.', '6', NULL, false, 6, 'reporter', '{}', NULL),
  ('crime', 'String of Robberies Continues', 'Police urge vigilance as robbery spree continues.', '4', NULL, false, 5, 'reporter', '{"incidents": 15}', NULL),
  ('territory', 'Power Shift in Parkdale', 'Long-standing crew loses grip on territory.', '3', 904, false, 7, 'anonymous', '{}', NULL),
  ('territory', 'New Alliance Reshapes North', 'Three crews sign historic non-aggression pact.', '6', 901, false, 7, 'insider', '{}', NULL),
  ('economy', 'Nightlife Under New Management', 'Mysterious investor acquires three premium nightclubs.', '7', 901, false, 5, 'business', '{}', NULL),
  ('economy', 'Underground Casino Raided', 'High-stakes poker operation shut down.', '1', 902, false, 6, 'reporter', '{}', NULL),
  ('crew', 'Rising Crew Makes Bold Moves', 'New organization rapidly expanding influence.', NULL, NULL, false, 6, 'insider', '{}', NULL),
  ('player', 'Street Legend Spotted', 'Famous rapper seen at exclusive underground venue.', '10', 902, false, 3, 'entertainment', '{}', NULL),
  ('player', 'Newcomer Making Waves', 'Young hustler rapidly climbing ranks.', '4', 903, false, 4, 'observer', '{}', NULL),
  ('system', 'Double XP Weekend Active', 'All activities grant double experience points.', NULL, NULL, false, 5, 'system', '{"multiplier": 2}', NOW() + INTERVAL '36 hours'),
  ('crime', 'Big Score Being Planned?', 'Word on the street says something major is in the works.', '2', NULL, false, 5, 'anonymous', '{}', NULL),
  ('crime', 'Police Have Inside Man', 'Rumors circulate about an informant within a major crew.', NULL, NULL, false, 7, 'anonymous', '{}', NULL)
ON CONFLICT DO NOTHING;

-- News Subscriptions
INSERT INTO news_subscriptions (player_id, subscription_type, target_id)
VALUES
  (901, 'district', '1'),
  (901, 'district', '2'),
  (901, 'category', 'breaking'),
  (902, 'district', '4'),
  (902, 'category', 'crime'),
  (902, 'category', 'economy'),
  (903, 'district', '4'),
  (903, 'category', 'crew'),
  (904, 'district', '1'),
  (904, 'category', 'territory'),
  (905, 'district', '3'),
  (905, 'category', 'breaking')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEBT ECONOMY SYSTEM
-- ============================================================================

-- Sample Debts
INSERT INTO debts (creditor_id, debtor_id, debt_type, description, original_value, current_value, interest_rate, status, due_date, called_in_at)
VALUES
  (901, 902, 'loan', 'Fronted cash for the Kensington deal', 50000, 55000, 10, 'outstanding', NOW() + INTERVAL '30 days', NULL),
  (901, 903, 'favor', 'Saved his life during the Scarborough incident', 0, 0, 0, 'outstanding', NULL, NULL),
  (901, 905, 'service', 'Provided muscle for the Yorkville takeover', 25000, 25000, 0, 'called_in', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 days'),
  (904, 901, 'blood_debt', 'For the death of his nephew', 0, 0, 0, 'outstanding', NULL, NULL),
  (905, 901, 'protection', 'Covered for him during the police raid', 0, 0, 0, 'outstanding', NULL, NULL),
  (904, 902, 'loan', 'Start-up capital for operations', 100000, 120000, 20, 'outstanding', NOW() + INTERVAL '60 days', NULL),
  (902, 903, 'favor', 'Introduced him to key contacts', 0, 0, 0, 'outstanding', NULL, NULL),
  (905, 902, 'service', 'Handled a problem quietly', 10000, 10000, 0, 'called_in', NOW() + INTERVAL '3 days', NOW() - INTERVAL '4 days'),
  (901, 904, 'loan', 'Emergency funds during investigation', 200000, 0, 0, 'fulfilled', NULL, NULL),
  (902, 901, 'favor', 'Provided alibi for the Diamond Exchange job', 0, 0, 0, 'fulfilled', NULL, NULL),
  (904, 903, 'loan', 'Small loan to get started', 5000, 0, 0, 'forgiven', NULL, NULL),
  (905, 903, 'loan', 'Payment for protection services', 15000, 18000, 20, 'defaulted', NOW() - INTERVAL '14 days', NOW() - INTERVAL '30 days')
ON CONFLICT DO NOTHING;

-- Debt Marketplace Offers
INSERT INTO debt_marketplace (debt_id, seller_id, asking_price, discount_percent, expires_at)
SELECT d.id, d.creditor_id, (d.current_value * 0.7)::INT, 30, NOW() + INTERVAL '14 days'
FROM debts d
WHERE d.status = 'outstanding' AND d.current_value > 0
LIMIT 3
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GENERATIONAL CONTINUITY / DYNASTY SYSTEM
-- ============================================================================

-- Character Endings for Predecessors
INSERT INTO character_endings (player_id, ending_type, ending_description, final_stats, legacy_score, occurred_at)
VALUES
  (906, 'death', 'Don Marcello, the founder of the Marcello dynasty, was assassinated at his favorite restaurant after 30 years of running the streets.',
   '{"level": 65, "total_earnings": 50000000, "kills": 47, "territories_held": 8}', 950, NOW() - INTERVAL '10 years'),
  (907, 'prison', 'Marco Marcello, son of Don Marcello, received a life sentence after being convicted on RICO charges.',
   '{"level": 55, "total_earnings": 35000000, "kills": 23, "territories_held": 5}', 720, NOW() - INTERVAL '5 years')
ON CONFLICT DO NOTHING;

-- Lineage Records
INSERT INTO player_lineage (player_id, predecessor_id, dynasty_id, generation, inheritance_received, relationship)
VALUES
  (907, 906, 906, 2, '{"cash": 10000000, "properties": ["downtown_warehouse"], "reputation_bonus": 50}', 'son'),
  (908, 907, 906, 3, '{"cash": 5000000, "properties": ["downtown_warehouse"], "reputation_bonus": 30}', 'nephew')
ON CONFLICT DO NOTHING;

-- Succession Plans
INSERT INTO succession_plans (player_id, heir_type, designated_heir_id, cash_percent, property_percent, reputation_percent, crew_transfer, notes)
VALUES
  (901, 'protege', 902, 60, 100, 40, true, 'TestHustler has proven himself loyal.'),
  (904, 'family', NULL, 80, 100, 50, true, 'Blood is blood. The family name must continue.'),
  (905, 'random', NULL, 30, 50, 20, false, 'Let the strongest rise. No hand-outs.'),
  (908, 'chosen', 903, 50, 100, 35, true, 'TestRookie reminds me of grandfather.')
ON CONFLICT (player_id) DO UPDATE SET updated_at = NOW();

-- Dynasty Achievements
INSERT INTO dynasty_achievements (dynasty_id, achievement_type, achievement_name, description, achieved_by_player_id, achieved_at, bonus_granted)
VALUES
  ('906', 'wealth', 'Made Man', 'Accumulated $1 million in total earnings', 906, NOW() - INTERVAL '25 years', '{"reputation": 10}'),
  ('906', 'wealth', 'Street Millionaire', 'Accumulated $10 million in total earnings', 906, NOW() - INTERVAL '20 years', '{"reputation": 25}'),
  ('906', 'territory', 'Block Boss', 'Controlled 3 territories simultaneously', 906, NOW() - INTERVAL '22 years', '{"income_bonus": 0.1}'),
  ('906', 'territory', 'District King', 'Controlled 5 territories simultaneously', 906, NOW() - INTERVAL '18 years', '{"income_bonus": 0.2}'),
  ('906', 'longevity', 'Survivor', 'Reached age 50 in the game', 906, NOW() - INTERVAL '12 years', '{"respect": 20}'),
  ('906', 'longevity', 'Legend', 'Reached age 60 in the game', 906, NOW() - INTERVAL '10 years', '{"respect": 50}'),
  ('906', 'legacy', 'Dynasty Founder', 'Successfully passed leadership to next generation', 906, NOW() - INTERVAL '10 years', '{"heir_bonus": 0.1}'),
  ('906', 'wealth', 'Made Man', 'Accumulated $1 million in total earnings', 907, NOW() - INTERVAL '12 years', '{"reputation": 10}'),
  ('906', 'legacy', 'Dynasty Continued', 'Passed leadership to third generation', 907, NOW() - INTERVAL '5 years', '{"heir_bonus": 0.15}'),
  ('906', 'wealth', 'Made Man', 'Accumulated $1 million in total earnings', 908, NOW() - INTERVAL '1 year', '{"reputation": 10}')
ON CONFLICT DO NOTHING;

-- Player Life State
INSERT INTO player_life_state (player_id, current_chapter, character_age, years_active, health_status, chapter_started_at, milestones_achieved, unlocked_features)
VALUES
  (901, 'established_boss', 42, 24, 85, NOW() - INTERVAL '2 years', ARRAY['first_million', 'crew_leader', 'territory_holder'], ARRAY['major_heists', 'business_empire']),
  (902, 'rising_player', 28, 10, 95, NOW() - INTERVAL '6 months', ARRAY['first_heist', 'crew_member'], ARRAY['crew_formation', 'territory_control']),
  (903, 'young_hustler', 19, 1, 100, NOW() - INTERVAL '1 month', ARRAY['first_crime'], ARRAY['petty_crime', 'basic_jobs']),
  (904, 'aging_legend', 58, 40, 65, NOW() - INTERVAL '5 years', ARRAY['first_million', 'crew_leader', 'survivor_50', 'legend_status'], ARRAY['succession_planning', 'mentor_role']),
  (905, 'rising_player', 32, 14, 90, NOW() - INTERVAL '1 year', ARRAY['first_kill', 'enforcer_role'], ARRAY['crew_formation', 'debt_creation']),
  (908, 'rising_player', 30, 5, 92, NOW() - INTERVAL '1 year', ARRAY['heir_bonus', 'first_million', 'dynasty_member'], ARRAY['debt_creation', 'debt_trading'])
ON CONFLICT (player_id) DO UPDATE SET updated_at = NOW();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This seed file creates:
-- - Required narrative tables (world_events, npc_memories, etc.)
-- - 8 test players (IDs 901-908)
-- - 15 world events (10 regular + 5 landmarks)
-- - 20 NPC memories
-- - 8 witnessed events with witnesses and testimonials
-- - 15 street news articles + subscriptions
-- - 12 debts with marketplace offers
-- - 3-generation dynasty with endings, lineage, succession plans
-- - Life state for 6 players
-- ============================================================================

SELECT 'Narrative seed data loaded successfully!' AS status;
