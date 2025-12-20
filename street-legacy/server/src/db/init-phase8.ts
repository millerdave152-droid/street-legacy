import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPhase8System(): Promise<void> {
  console.log('Initializing Phase 8 Crew Wars System...');

  try {
    // Check if territory_wars table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'territory_wars'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating Phase 8 tables...');

      // Try to read and execute schema file
      try {
        const schemaPath = path.join(__dirname, 'schema-phase8.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSQL);
        console.log('Phase 8 schema created from file');
      } catch (fileError) {
        console.log('Schema file not found, creating tables inline...');
        await createPhase8TablesInline();
      }

      // Seed initial data
      try {
        const seedPath = path.join(__dirname, 'seed-phase8.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSQL);
        console.log('Phase 8 seed data loaded from file');
      } catch (fileError) {
        console.log('Seed file not found, seeding minimal data inline...');
        await seedPhase8DataInline();
      }
    } else {
      console.log('Phase 8 tables already exist');

      // Ensure war stats exist for all crews
      await pool.query(`
        INSERT INTO crew_war_stats (crew_id)
        SELECT id FROM crews
        WHERE id NOT IN (SELECT crew_id FROM crew_war_stats)
        ON CONFLICT (crew_id) DO NOTHING
      `);
    }

    console.log('Phase 8 Crew Wars System initialized successfully');
  } catch (error) {
    console.error('Error initializing Phase 8 system:', error);
  }
}

async function createPhase8TablesInline(): Promise<void> {
  await pool.query(`
    -- Update districts table with territory control fields
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS controlling_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL;
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS control_percentage INTEGER DEFAULT 0;
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS contested BOOLEAN DEFAULT false;
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS contesting_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL;
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS last_war_end TIMESTAMP;
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS peace_until TIMESTAMP;
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS territory_bonuses JSONB DEFAULT '{}';
    ALTER TABLE districts ADD COLUMN IF NOT EXISTS adjacent_districts INTEGER[] DEFAULT '{}';

    -- Crew ranks table
    CREATE TABLE IF NOT EXISTS crew_ranks (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      rank_level INTEGER NOT NULL DEFAULT 1,
      permissions JSONB DEFAULT '{}',
      war_role VARCHAR(50),
      salary_per_day INTEGER DEFAULT 0,
      max_members INTEGER,
      icon VARCHAR(10) DEFAULT '👤',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(crew_id, name),
      UNIQUE(crew_id, rank_level)
    );

    -- Update crew_members table
    ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS rank_id INTEGER REFERENCES crew_ranks(id);
    ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_role VARCHAR(50);
    ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_points INTEGER DEFAULT 0;
    ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_kills INTEGER DEFAULT 0;
    ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS war_deaths INTEGER DEFAULT 0;
    ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS last_war_action TIMESTAMP;

    -- Territory wars table
    CREATE TABLE IF NOT EXISTS territory_wars (
      id SERIAL PRIMARY KEY,
      district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
      attacker_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      defender_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      prep_ends_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      attacker_points INTEGER DEFAULT 0,
      defender_points INTEGER DEFAULT 0,
      status VARCHAR(30) DEFAULT 'preparing',
      war_log JSONB DEFAULT '[]',
      war_config JSONB DEFAULT '{}',
      cash_prize INTEGER DEFAULT 50000,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- War missions table
    CREATE TABLE IF NOT EXISTS war_missions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      mission_type VARCHAR(50) NOT NULL,
      points_reward INTEGER NOT NULL,
      cash_reward INTEGER DEFAULT 0,
      xp_reward INTEGER DEFAULT 0,
      stamina_cost INTEGER DEFAULT 20,
      focus_cost INTEGER DEFAULT 10,
      min_level INTEGER DEFAULT 1,
      required_role VARCHAR(50),
      cooldown_minutes INTEGER DEFAULT 30,
      success_rate INTEGER DEFAULT 70,
      target_type VARCHAR(50),
      icon VARCHAR(10) DEFAULT '⚔️',
      is_active BOOLEAN DEFAULT true
    );

    -- Player war mission assignments
    CREATE TABLE IF NOT EXISTS player_war_missions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
      mission_id INTEGER REFERENCES war_missions(id) ON DELETE CASCADE,
      target_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      target_poi_id INTEGER,
      status VARCHAR(30) DEFAULT 'assigned',
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      completed_at TIMESTAMP,
      points_earned INTEGER DEFAULT 0
    );

    -- War events log
    CREATE TABLE IF NOT EXISTS war_events (
      id SERIAL PRIMARY KEY,
      war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      target_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      poi_id INTEGER,
      points_earned INTEGER DEFAULT 0,
      description TEXT,
      event_data JSONB DEFAULT '{}',
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- POI control during wars
    CREATE TABLE IF NOT EXISTS poi_control (
      id SERIAL PRIMARY KEY,
      poi_id INTEGER NOT NULL,
      war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
      controlling_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
      capture_started_at TIMESTAMP,
      capture_progress INTEGER DEFAULT 0,
      capturing_crew_id INTEGER REFERENCES crews(id) ON DELETE SET NULL,
      capturing_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      is_contested BOOLEAN DEFAULT false,
      points_generated INTEGER DEFAULT 0,
      last_point_tick TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      strategic_value INTEGER DEFAULT 1,
      UNIQUE(poi_id, war_id)
    );

    -- Crew war stats
    CREATE TABLE IF NOT EXISTS crew_war_stats (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      wars_won INTEGER DEFAULT 0,
      wars_lost INTEGER DEFAULT 0,
      wars_stalemated INTEGER DEFAULT 0,
      total_war_points INTEGER DEFAULT 0,
      total_kills INTEGER DEFAULT 0,
      total_deaths INTEGER DEFAULT 0,
      territories_captured INTEGER DEFAULT 0,
      territories_lost INTEGER DEFAULT 0,
      pois_captured INTEGER DEFAULT 0,
      cash_won INTEGER DEFAULT 0,
      cash_lost INTEGER DEFAULT 0,
      current_war_streak INTEGER DEFAULT 0,
      best_war_streak INTEGER DEFAULT 0,
      last_war_date TIMESTAMP,
      UNIQUE(crew_id)
    );

    -- Peace treaties
    CREATE TABLE IF NOT EXISTS peace_treaties (
      id SERIAL PRIMARY KEY,
      crew1_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      crew2_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
      war_id INTEGER REFERENCES territory_wars(id) ON DELETE SET NULL,
      treaty_type VARCHAR(30) DEFAULT 'standard',
      expires_at TIMESTAMP NOT NULL,
      terms JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- War revenge tracking
    CREATE TABLE IF NOT EXISTS war_revenge_bonus (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      against_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
      original_war_id INTEGER REFERENCES territory_wars(id) ON DELETE SET NULL,
      bonus_percentage INTEGER DEFAULT 10,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(crew_id, against_crew_id)
    );

    -- Crew bank updates
    ALTER TABLE crews ADD COLUMN IF NOT EXISTS bank_balance INTEGER DEFAULT 0;
    ALTER TABLE crews ADD COLUMN IF NOT EXISTS war_debuff_until TIMESTAMP;
    ALTER TABLE crews ADD COLUMN IF NOT EXISTS last_war_won TIMESTAMP;
    ALTER TABLE crews ADD COLUMN IF NOT EXISTS last_war_lost TIMESTAMP;

    -- Player POI presence tracking
    CREATE TABLE IF NOT EXISTS player_poi_presence (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      poi_id INTEGER NOT NULL,
      war_id INTEGER REFERENCES territory_wars(id) ON DELETE CASCADE,
      entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, poi_id, war_id)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_crew_ranks_crew ON crew_ranks(crew_id);
    CREATE INDEX IF NOT EXISTS idx_territory_wars_district ON territory_wars(district_id);
    CREATE INDEX IF NOT EXISTS idx_territory_wars_status ON territory_wars(status);
    CREATE INDEX IF NOT EXISTS idx_player_war_missions_player ON player_war_missions(player_id);
    CREATE INDEX IF NOT EXISTS idx_war_events_war ON war_events(war_id);
    CREATE INDEX IF NOT EXISTS idx_poi_control_war ON poi_control(war_id);
  `);
  console.log('Phase 8 tables created inline');
}

async function seedPhase8DataInline(): Promise<void> {
  // Check if we already have war missions
  const existingMissions = await pool.query('SELECT COUNT(*) FROM war_missions');
  if (parseInt(existingMissions.rows[0].count) > 0) {
    console.log('War missions already exist, skipping seed');
    return;
  }

  await pool.query(`
    -- Sample war missions
    INSERT INTO war_missions (name, description, mission_type, points_reward, cash_reward, xp_reward, stamina_cost, focus_cost, min_level, required_role, cooldown_minutes, success_rate, target_type, icon) VALUES
    ('Assassinate Target', 'Hunt down and eliminate a specific rival crew member', 'assassination', 100, 5000, 500, 30, 20, 10, NULL, 60, 60, 'player', '🎯'),
    ('Sabotage Operation', 'Destroy rival crew''s product or equipment', 'sabotage', 75, 3000, 400, 25, 15, 8, NULL, 45, 70, 'operation', '💣'),
    ('Flip Informant', 'Turn a rival''s NPC contact to your side', 'intel', 50, 2000, 300, 20, 25, 8, 'spy', 40, 65, 'npc', '🕵️'),
    ('Protect Shipment', 'Defend crew cargo from interception', 'defense', 60, 3000, 350, 25, 15, 8, NULL, 40, 75, 'cargo', '🛡️'),
    ('Tag Territory', 'Vandalize rival property to mark territory', 'capture', 25, 500, 150, 10, 5, 3, NULL, 15, 90, 'property', '🎨'),
    ('Ambush Patrol', 'Attack rival crew members on patrol', 'combat', 80, 4000, 450, 30, 15, 10, 'soldier', 45, 65, 'patrol', '🔫'),
    ('Seize POI', 'Take control of strategic location', 'capture', 100, 5000, 500, 30, 20, 10, NULL, 45, 60, 'poi', '⚔️'),
    ('Heal Wounded', 'Patch up injured crew members', 'support', 30, 1000, 200, 10, 20, 5, 'medic', 20, 90, 'ally', '💊');

    -- Set up adjacent districts
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
  `);

  console.log('Phase 8 minimal seed data loaded');
}
