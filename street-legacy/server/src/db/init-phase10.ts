import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPhase10System(): Promise<void> {
  console.log('Initializing Phase 10 Reputation and Faction Systems...');

  try {
    // Check if factions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'factions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating Phase 10 tables...');

      // Try to read and execute schema file
      try {
        const schemaPath = path.join(__dirname, 'schema-phase10.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSQL);
        console.log('Phase 10 schema created from file');
      } catch (fileError) {
        console.log('Schema file not found, creating tables inline...');
        await createPhase10TablesInline();
      }

      // Seed initial data
      try {
        const seedPath = path.join(__dirname, 'seed-phase10.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSQL);
        console.log('Phase 10 seed data loaded from file');
      } catch (fileError) {
        console.log('Seed file not found, seeding minimal data inline...');
        await seedPhase10DataInline();
      }
    } else {
      console.log('Phase 10 tables already exist');

      // Check if we need to seed data
      const factionsCheck = await pool.query('SELECT COUNT(*) FROM factions');
      if (parseInt(factionsCheck.rows[0].count) === 0) {
        console.log('Seeding Phase 10 data...');
        try {
          const seedPath = path.join(__dirname, 'seed-phase10.sql');
          const seedSQL = fs.readFileSync(seedPath, 'utf8');
          await pool.query(seedSQL);
          console.log('Phase 10 seed data loaded');
        } catch (fileError) {
          await seedPhase10DataInline();
        }
      }
    }

    console.log('Phase 10 Reputation and Faction Systems initialized successfully');
  } catch (error) {
    console.error('Error initializing Phase 10 system:', error);
  }
}

async function createPhase10TablesInline(): Promise<void> {
  await pool.query(`
    -- Factions table
    CREATE TABLE IF NOT EXISTS factions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      type VARCHAR(30) NOT NULL CHECK (type IN ('gang', 'mafia', 'cartel', 'syndicate', 'corporate', 'government')),
      territory_district_ids JSONB DEFAULT '[]',
      hq_poi_id INTEGER,
      ideology TEXT,
      background_lore TEXT,
      leader_npc_id INTEGER,
      color VARCHAR(20) DEFAULT '#888888',
      icon VARCHAR(10) DEFAULT '⚔️',
      hostilities JSONB DEFAULT '{}',
      power_level INTEGER DEFAULT 50,
      wealth INTEGER DEFAULT 100000,
      member_count INTEGER DEFAULT 50,
      is_recruitable BOOLEAN DEFAULT true,
      min_level_to_join INTEGER DEFAULT 5,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Player faction reputation
    CREATE TABLE IF NOT EXISTS player_faction_rep (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      reputation INTEGER DEFAULT 0 CHECK (reputation >= -1000 AND reputation <= 1000),
      rank VARCHAR(30) DEFAULT 'outsider',
      missions_completed INTEGER DEFAULT 0,
      members_killed INTEGER DEFAULT 0,
      money_donated INTEGER DEFAULT 0,
      territories_defended INTEGER DEFAULT 0,
      enemies_killed INTEGER DEFAULT 0,
      joined_at TIMESTAMP,
      last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_banned BOOLEAN DEFAULT false,
      ban_reason VARCHAR(200),
      UNIQUE(player_id, faction_id)
    );

    -- Faction missions
    CREATE TABLE IF NOT EXISTS faction_missions (
      id SERIAL PRIMARY KEY,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      mission_type VARCHAR(30) NOT NULL,
      min_rank VARCHAR(30) DEFAULT 'associate',
      min_reputation INTEGER DEFAULT 100,
      reputation_reward INTEGER NOT NULL,
      cash_reward INTEGER NOT NULL,
      xp_reward INTEGER DEFAULT 100,
      enemy_faction_id INTEGER REFERENCES factions(id),
      target_npc_id INTEGER,
      target_poi_id INTEGER,
      target_district_id INTEGER,
      objectives JSONB DEFAULT '[]',
      time_limit_minutes INTEGER DEFAULT 60,
      difficulty INTEGER DEFAULT 1,
      cooldown_hours INTEGER DEFAULT 4,
      max_daily_completions INTEGER DEFAULT 3,
      required_crew_size INTEGER DEFAULT 1,
      is_story_mission BOOLEAN DEFAULT false,
      story_order INTEGER,
      prerequisites JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      icon VARCHAR(10) DEFAULT '📋'
    );

    -- Active faction missions
    CREATE TABLE IF NOT EXISTS active_faction_missions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      mission_id INTEGER REFERENCES faction_missions(id) ON DELETE CASCADE,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      status VARCHAR(30) DEFAULT 'active',
      progress JSONB DEFAULT '{}',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      crew_members JSONB DEFAULT '[]',
      rewards_claimed BOOLEAN DEFAULT false
    );

    -- Faction mission completions
    CREATE TABLE IF NOT EXISTS faction_mission_completions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      mission_id INTEGER REFERENCES faction_missions(id) ON DELETE CASCADE,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      was_successful BOOLEAN DEFAULT true,
      reputation_earned INTEGER DEFAULT 0,
      cash_earned INTEGER DEFAULT 0
    );

    -- Faction wars
    CREATE TABLE IF NOT EXISTS faction_wars (
      id SERIAL PRIMARY KEY,
      aggressor_faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      defender_faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      war_state VARCHAR(30) DEFAULT 'tension',
      aggressor_score INTEGER DEFAULT 0,
      defender_score INTEGER DEFAULT 0,
      territories_contested JSONB DEFAULT '[]',
      casualties_aggressor INTEGER DEFAULT 0,
      casualties_defender INTEGER DEFAULT 0,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      escalated_at TIMESTAMP,
      ended_at TIMESTAMP,
      outcome VARCHAR(50),
      peace_terms JSONB,
      UNIQUE(aggressor_faction_id, defender_faction_id)
    );

    -- Faction shop items
    CREATE TABLE IF NOT EXISTS faction_shop_items (
      id SERIAL PRIMARY KEY,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      item_type VARCHAR(30) NOT NULL,
      item_id INTEGER,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      base_price INTEGER NOT NULL,
      min_rank VARCHAR(30) DEFAULT 'associate',
      min_reputation INTEGER DEFAULT 100,
      discount_per_rank INTEGER DEFAULT 5,
      stock_limit INTEGER,
      current_stock INTEGER,
      restock_hours INTEGER DEFAULT 24,
      last_restock TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT true
    );

    -- Faction story progress
    CREATE TABLE IF NOT EXISTS faction_story_progress (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      current_chapter VARCHAR(30) DEFAULT 'introduction',
      chapter_progress INTEGER DEFAULT 0,
      choices_made JSONB DEFAULT '[]',
      story_flags JSONB DEFAULT '{}',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_progress TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      UNIQUE(player_id, faction_id)
    );

    -- Faction safehouses
    CREATE TABLE IF NOT EXISTS faction_safehouses (
      id SERIAL PRIMARY KEY,
      faction_id INTEGER REFERENCES factions(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      district_id INTEGER,
      poi_id INTEGER,
      capacity INTEGER DEFAULT 10,
      current_occupants INTEGER DEFAULT 0,
      amenities JSONB DEFAULT '[]',
      heat_reduction INTEGER DEFAULT 20,
      healing_rate INTEGER DEFAULT 10,
      is_compromised BOOLEAN DEFAULT false,
      min_rank VARCHAR(30) DEFAULT 'associate',
      is_active BOOLEAN DEFAULT true
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_player_faction_rep_player ON player_faction_rep(player_id);
    CREATE INDEX IF NOT EXISTS idx_player_faction_rep_faction ON player_faction_rep(faction_id);
    CREATE INDEX IF NOT EXISTS idx_faction_missions_faction ON faction_missions(faction_id);
    CREATE INDEX IF NOT EXISTS idx_active_faction_missions_player ON active_faction_missions(player_id);
    CREATE INDEX IF NOT EXISTS idx_faction_wars_state ON faction_wars(war_state);
  `);
  console.log('Phase 10 tables created inline');
}

async function seedPhase10DataInline(): Promise<void> {
  // Check if we already have factions
  const existingFactions = await pool.query('SELECT COUNT(*) FROM factions');
  if (parseInt(existingFactions.rows[0].count) > 0) {
    console.log('Factions already exist, skipping seed');
    return;
  }

  await pool.query(`
    -- Street Gangs
    INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
    ('Northside Kings', 'gang', '[1, 2]', 'Street dominance, loyalty above all',
    'Born in the housing projects of North York, the Northside Kings started as a group of teenagers defending their block.', '#FFD700', '👑', '{"2": 300}', 45, 150000, 120, 3),
    ('Scarborough Bloods', 'gang', '[3, 4]', 'Blood in, blood out. Family first.',
    'The Scarborough Bloods emerged from the Jamaican immigrant community in the 90s.', '#DC143C', '🩸', '{"1": 300}', 50, 200000, 150, 5),
    ('Queen Street Crew', 'gang', '[5, 6]', 'Smart money, clean hands',
    'Hipster criminals who specialize in identity theft, credit card fraud, and high-tech scams.', '#9370DB', '💻', '{}', 35, 500000, 45, 8);

    -- Organized Crime
    INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
    ('The Commission', 'mafia', '[7, 8, 9]', 'Tradition, respect, omertà',
    'The old guard - Italian families who have controlled organized crime in Toronto for generations.', '#1C1C1C', '🎩', '{"5": 400}', 75, 5000000, 200, 10),
    ('Bratva Toronto', 'mafia', '[10, 11]', 'Strength through unity, profit through fear',
    'Russian organized crime arrived in Toronto after the Soviet collapse.', '#B22222', '🐻', '{"4": 400}', 65, 3000000, 80, 12),
    ('14K Triad', 'syndicate', '[12, 13]', 'Ancient traditions, modern methods',
    'Branch of the Hong Kong 14K Triad, established in Chinatown decades ago.', '#FFD700', '🐉', '{}', 70, 4000000, 150, 15);

    -- Cartels
    INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
    ('Los Diablos', 'cartel', '[14, 15]', 'Plata o plomo - silver or lead',
    'Representatives of a major Mexican cartel handling wholesale drug distribution.', '#228B22', '😈', '{}', 85, 10000000, 60, 20),
    ('Kingston Connect', 'cartel', '[16, 17]', 'One love, one blood, one business',
    'The Caribbean connection - Jamaican posses controlling marijuana and gun imports.', '#008000', '🦁', '{}', 55, 2000000, 100, 10);

    -- Corporate
    INSERT INTO factions (name, type, territory_district_ids, ideology, background_lore, color, icon, hostilities, power_level, wealth, member_count, min_level_to_join) VALUES
    ('Sterling Industries', 'corporate', '[18, 19]', 'Everything has a price',
    'White-collar crime syndicate - money laundering, securities fraud, bribery.', '#4169E1', '💼', '{}', 80, 50000000, 30, 25),
    ('DataVault Inc', 'corporate', '[20]', 'Information is the ultimate currency',
    'Tech company running ransomware operations and selling zero-day exploits.', '#00CED1', '🔐', '{}', 60, 8000000, 25, 20);

    -- Initial faction wars
    INSERT INTO faction_wars (aggressor_faction_id, defender_faction_id, war_state, aggressor_score, defender_score) VALUES
    (1, 2, 'hot_war', 150, 180),
    (4, 5, 'cold_war', 50, 75);
  `);

  // Seed basic missions for first faction
  await pool.query(`
    INSERT INTO faction_missions (faction_id, name, description, mission_type, min_rank, min_reputation, reputation_reward, cash_reward, xp_reward, objectives, difficulty, icon) VALUES
    (1, 'Corner Collection', 'One of our corner boys is holding out. Go remind him who he works for.', 'collection', 'outsider', 0, 25, 500, 50, '[{"type": "visit_location"}, {"type": "intimidate"}]', 1, '💰'),
    (1, 'Block Party Crasher', 'The Bloods are trying to set up on our turf. Show them this is King territory.', 'enforcement', 'associate', 100, 50, 1500, 100, '[{"type": "defeat_enemies", "count": 3}]', 2, '👊');
  `);

  console.log('Phase 10 minimal seed data loaded');
}
