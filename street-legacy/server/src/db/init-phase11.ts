import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPhase11System(): Promise<void> {
  console.log('Initializing Phase 11 PVP Combat and Bounty System...');

  try {
    // Check if injury_types table exists (indicates Phase 11 is set up)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'injury_types'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating Phase 11 tables...');

      // Try to read and execute schema file
      try {
        const schemaPath = path.join(__dirname, 'schema-phase11.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSQL);
        console.log('Phase 11 schema created from file');
      } catch (fileError) {
        console.log('Schema file not found, creating tables inline...');
        await createPhase11TablesInline();
      }

      // Seed initial data
      try {
        const seedPath = path.join(__dirname, 'seed-phase11.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSQL);
        console.log('Phase 11 seed data loaded from file');
      } catch (fileError) {
        console.log('Seed file not found, seeding minimal data inline...');
        await seedPhase11DataInline();
      }
    } else {
      console.log('Phase 11 tables already exist');

      // Check if we need to seed data
      const injuryCheck = await pool.query('SELECT COUNT(*) FROM injury_types');
      if (parseInt(injuryCheck.rows[0].count) === 0) {
        console.log('Seeding Phase 11 data...');
        try {
          const seedPath = path.join(__dirname, 'seed-phase11.sql');
          const seedSQL = fs.readFileSync(seedPath, 'utf8');
          await pool.query(seedSQL);
          console.log('Phase 11 seed data loaded');
        } catch (fileError) {
          await seedPhase11DataInline();
        }
      }
    }

    // Ensure player columns exist
    await pool.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS max_health INTEGER DEFAULT 100;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS attack INTEGER DEFAULT 10;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS defense INTEGER DEFAULT 10;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS accuracy INTEGER DEFAULT 50;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS evasion INTEGER DEFAULT 20;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS combat_level INTEGER DEFAULT 1;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS combat_xp INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS total_kills INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS total_deaths INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS current_kill_streak INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS best_kill_streak INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS bounties_claimed INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS bounties_on_head INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS is_hospitalized BOOLEAN DEFAULT false;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS hospital_release_at TIMESTAMP;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS last_combat_at TIMESTAMP;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS current_district_id INTEGER DEFAULT 1;
    `);

    console.log('Phase 11 PVP Combat and Bounty System initialized successfully');
  } catch (error) {
    console.error('Error initializing Phase 11 system:', error);
  }
}

async function createPhase11TablesInline(): Promise<void> {
  await pool.query(`
    -- Combat sessions
    CREATE TABLE IF NOT EXISTS combat_sessions (
      id SERIAL PRIMARY KEY,
      attacker_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      defender_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      district_id INTEGER,
      status VARCHAR(30) DEFAULT 'active',
      current_round INTEGER DEFAULT 1,
      max_rounds INTEGER DEFAULT 10,
      attacker_health INTEGER NOT NULL,
      defender_health INTEGER NOT NULL,
      attacker_starting_health INTEGER NOT NULL,
      defender_starting_health INTEGER NOT NULL,
      attacker_action VARCHAR(30),
      defender_action VARCHAR(30),
      combat_log JSONB DEFAULT '[]',
      loot_amount INTEGER DEFAULT 0,
      winner_id INTEGER,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP
    );

    -- Combat history
    CREATE TABLE IF NOT EXISTS combat_history (
      id SERIAL PRIMARY KEY,
      attacker_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      defender_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      winner_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      district_id INTEGER,
      rounds_fought INTEGER,
      attacker_damage_dealt INTEGER DEFAULT 0,
      defender_damage_dealt INTEGER DEFAULT 0,
      loot_transferred INTEGER DEFAULT 0,
      combat_xp_gained INTEGER DEFAULT 0,
      was_bounty_kill BOOLEAN DEFAULT false,
      bounty_claimed INTEGER DEFAULT 0,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Combat cooldowns
    CREATE TABLE IF NOT EXISTS combat_cooldowns (
      id SERIAL PRIMARY KEY,
      attacker_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      target_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      cooldown_until TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(attacker_id, target_id)
    );

    -- Bounties
    CREATE TABLE IF NOT EXISTS bounties (
      id SERIAL PRIMARY KEY,
      target_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      placed_by_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      amount INTEGER NOT NULL CHECK (amount >= 1000),
      reason VARCHAR(200),
      is_anonymous BOOLEAN DEFAULT false,
      status VARCHAR(30) DEFAULT 'active',
      is_auto_bounty BOOLEAN DEFAULT false,
      auto_bounty_type VARCHAR(50),
      expires_at TIMESTAMP NOT NULL,
      claimed_by_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      claimed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bounty contributions
    CREATE TABLE IF NOT EXISTS bounty_contributions (
      id SERIAL PRIMARY KEY,
      bounty_id INTEGER REFERENCES bounties(id) ON DELETE CASCADE,
      contributor_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      amount INTEGER NOT NULL,
      is_anonymous BOOLEAN DEFAULT false,
      contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Hitmen
    CREATE TABLE IF NOT EXISTS hitmen (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      skill_level INTEGER DEFAULT 1,
      attack INTEGER NOT NULL,
      defense INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      success_rate INTEGER DEFAULT 50,
      price_multiplier DECIMAL(3,2) DEFAULT 1.0,
      min_bounty_amount INTEGER DEFAULT 5000,
      icon VARCHAR(10) DEFAULT '🎯',
      is_active BOOLEAN DEFAULT true
    );

    -- Hitman attempts
    CREATE TABLE IF NOT EXISTS hitman_attempts (
      id SERIAL PRIMARY KEY,
      hitman_id INTEGER REFERENCES hitmen(id) ON DELETE SET NULL,
      target_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      bounty_id INTEGER REFERENCES bounties(id) ON DELETE SET NULL,
      was_successful BOOLEAN,
      damage_dealt INTEGER DEFAULT 0,
      cash_taken INTEGER DEFAULT 0,
      target_survived BOOLEAN,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Player bodyguards
    CREATE TABLE IF NOT EXISTS player_bodyguards (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      bodyguard_type VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      protection_level INTEGER DEFAULT 1,
      daily_cost INTEGER NOT NULL,
      hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT true,
      UNIQUE(player_id, bodyguard_type)
    );

    -- Injuries
    CREATE TABLE IF NOT EXISTS injuries (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      injury_type VARCHAR(50) NOT NULL,
      injury_name VARCHAR(100) NOT NULL,
      severity INTEGER DEFAULT 1,
      effects JSONB DEFAULT '{}',
      source VARCHAR(50),
      source_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      heals_at TIMESTAMP NOT NULL,
      is_healed BOOLEAN DEFAULT false,
      healed_by VARCHAR(50)
    );

    -- Injury types
    CREATE TABLE IF NOT EXISTS injury_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type_code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      severity INTEGER DEFAULT 1,
      base_heal_minutes INTEGER NOT NULL,
      effects JSONB DEFAULT '{}',
      icon VARCHAR(10) DEFAULT '🩹'
    );

    -- Hospital services
    CREATE TABLE IF NOT EXISTS hospital_services (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      service_type VARCHAR(50) NOT NULL,
      base_cost INTEGER NOT NULL,
      heal_time_reduction INTEGER DEFAULT 50,
      min_severity INTEGER DEFAULT 1,
      max_severity INTEGER DEFAULT 5,
      is_legal BOOLEAN DEFAULT true,
      requires_level INTEGER DEFAULT 1,
      icon VARCHAR(10) DEFAULT '🏥'
    );

    -- Safe zones
    CREATE TABLE IF NOT EXISTS safe_zones (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      zone_type VARCHAR(50) NOT NULL,
      district_id INTEGER,
      poi_id INTEGER,
      description TEXT,
      is_active BOOLEAN DEFAULT true
    );

    -- Combat buffs
    CREATE TABLE IF NOT EXISTS player_combat_buffs (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      buff_type VARCHAR(50) NOT NULL,
      buff_name VARCHAR(100) NOT NULL,
      stat_modifiers JSONB DEFAULT '{}',
      source VARCHAR(50),
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT true
    );

    -- Kill log
    CREATE TABLE IF NOT EXISTS player_kill_log (
      id SERIAL PRIMARY KEY,
      killer_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      victim_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      district_id INTEGER,
      was_bounty_kill BOOLEAN DEFAULT false,
      killed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_combat_sessions_status ON combat_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
    CREATE INDEX IF NOT EXISTS idx_bounties_target ON bounties(target_player_id);
    CREATE INDEX IF NOT EXISTS idx_injuries_player ON injuries(player_id);
  `);

  console.log('Phase 11 tables created inline');
}

async function seedPhase11DataInline(): Promise<void> {
  // Check if we already have data
  const existing = await pool.query('SELECT COUNT(*) FROM injury_types');
  if (parseInt(existing.rows[0].count) > 0) {
    console.log('Phase 11 data already exists, skipping seed');
    return;
  }

  await pool.query(`
    -- Basic injury types
    INSERT INTO injury_types (name, type_code, description, severity, base_heal_minutes, effects, icon) VALUES
    ('Bruised Ribs', 'bruised_ribs', 'Painful but not serious.', 1, 15, '{"defense": -2}', '🩹'),
    ('Black Eye', 'black_eye', 'Swollen eye affects vision.', 1, 10, '{"accuracy": -5}', '👁️'),
    ('Cracked Rib', 'cracked_rib', 'Every breath hurts.', 2, 45, '{"defense": -5, "evasion": -10}', '🦴'),
    ('Concussion', 'concussion', 'Head trauma.', 2, 60, '{"accuracy": -15, "evasion": -10}', '🤕'),
    ('Broken Arm', 'broken_arm', 'Fractured bone.', 3, 120, '{"attack": -20, "accuracy": -15}', '🦴'),
    ('Internal Bleeding', 'internal_bleeding', 'Serious condition.', 3, 90, '{"max_health": -25}', '🩸'),
    ('Punctured Lung', 'punctured_lung', 'Every breath is agony.', 4, 240, '{"max_health": -40}', '🫁'),
    ('Critical Gunshot', 'critical_gunshot', 'Bullet near vital organs.', 5, 360, '{"max_health": -60}', '🔫');

    -- Hospital services
    INSERT INTO hospital_services (name, description, service_type, base_cost, heal_time_reduction, min_severity, max_severity, is_legal, requires_level, icon) VALUES
    ('Emergency Room', 'Standard ER treatment.', 'emergency', 500, 30, 1, 3, true, 1, '🏥'),
    ('Priority Care', 'Skip the line.', 'priority', 2000, 50, 1, 4, true, 5, '⚕️'),
    ('ICU', 'Critical care.', 'icu', 10000, 70, 3, 5, true, 10, '🏨'),
    ('Back Alley Doc', 'No questions asked.', 'black_market', 1000, 40, 1, 3, false, 3, '🩺'),
    ('Underground Clinic', 'Professional, no records.', 'black_market', 3000, 55, 2, 4, false, 10, '💊');

    -- Hitmen
    INSERT INTO hitmen (name, description, skill_level, attack, defense, accuracy, success_rate, price_multiplier, min_bounty_amount, icon) VALUES
    ('Street Punk', 'Amateur. Cheap but unreliable.', 1, 15, 10, 40, 30, 0.8, 2000, '🔪'),
    ('Local Enforcer', 'Gang muscle.', 2, 25, 20, 55, 45, 1.0, 5000, '👊'),
    ('Professional Hitter', 'Gets the job done.', 3, 40, 30, 70, 60, 1.5, 10000, '🎯'),
    ('Cartel Sicario', 'Trained killer.', 4, 55, 40, 80, 75, 2.0, 25000, '💀'),
    ('Ghost', '100% success rate... until now.', 5, 75, 55, 95, 90, 3.0, 50000, '👻');

    -- Safe zones
    INSERT INTO safe_zones (name, zone_type, district_id, description) VALUES
    ('Central Hospital', 'hospital', 1, 'Medical facility'),
    ('City Hall', 'government', 1, 'Government building'),
    ('Police HQ', 'police', 1, 'Police headquarters');
  `);

  console.log('Phase 11 minimal seed data loaded');
}
