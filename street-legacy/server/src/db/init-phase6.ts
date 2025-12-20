import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPhase6System() {
  try {
    console.log('Initializing Phase 6 system...');

    // Check if Phase 6 tables already exist
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'npcs'
      ) as exists
    `);

    if (checkResult.rows[0].exists) {
      // Check if NPCs are seeded
      const npcCount = await pool.query('SELECT COUNT(*) FROM npcs');
      if (parseInt(npcCount.rows[0].count) > 0) {
        console.log('Phase 6 system already initialized');
        return;
      }
    }

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema-phase6.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('Phase 6 schema applied');
    } else {
      console.log('Phase 6 schema file not found, creating tables inline...');
      await createPhase6TablesInline();
    }

    // Read and execute seed data
    const seedPath = path.join(__dirname, 'seed-phase6.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seed);
      console.log('Phase 6 seed data applied');
    } else {
      console.log('Phase 6 seed file not found, seeding inline...');
      await seedPhase6DataInline();
    }

    console.log('Phase 6 system initialized successfully!');
  } catch (error) {
    console.error('Error initializing Phase 6 system:', error);
  }
}

async function createPhase6TablesInline() {
  // Create core tables if schema file not available
  await pool.query(`
    -- POI table for NPC locations
    CREATE TABLE IF NOT EXISTS points_of_interest (
      id SERIAL PRIMARY KEY,
      district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(30) NOT NULL,
      description TEXT,
      UNIQUE(district_id, name)
    );

    -- NPCs table
    CREATE TABLE IF NOT EXISTS npcs (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      type VARCHAR(30) NOT NULL,
      district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
      poi_id INTEGER REFERENCES points_of_interest(id) ON DELETE SET NULL,
      trust_level_required INTEGER NOT NULL DEFAULT 0,
      dialogue JSONB NOT NULL DEFAULT '{}',
      available_missions JSONB NOT NULL DEFAULT '[]',
      schedule JSONB DEFAULT '{"days": [0,1,2,3,4,5,6], "hours_start": 0, "hours_end": 24}',
      avatar_emoji VARCHAR(10) DEFAULT '???',
      description TEXT,
      cut_percentage INTEGER DEFAULT 10
    );

    -- NPC relationships
    CREATE TABLE IF NOT EXISTS npc_relationships (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
      trust INTEGER NOT NULL DEFAULT 0,
      missions_completed INTEGER NOT NULL DEFAULT 0,
      missions_failed INTEGER NOT NULL DEFAULT 0,
      gifts_given INTEGER NOT NULL DEFAULT 0,
      last_interaction TIMESTAMP,
      notes JSONB DEFAULT '[]',
      UNIQUE(player_id, npc_id)
    );

    -- Mission categories
    CREATE TABLE IF NOT EXISTS mission_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(10) DEFAULT '???',
      refresh_type VARCHAR(20) NOT NULL
    );

    -- NPC missions
    CREATE TABLE IF NOT EXISTS npc_missions (
      id SERIAL PRIMARY KEY,
      npc_id INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      dialogue_intro TEXT,
      dialogue_success TEXT,
      dialogue_failure TEXT,
      mission_type VARCHAR(30) NOT NULL,
      min_level INTEGER NOT NULL DEFAULT 1,
      min_trust INTEGER NOT NULL DEFAULT 0,
      required_district_id INTEGER REFERENCES districts(id),
      stamina_cost INTEGER NOT NULL DEFAULT 10,
      focus_cost INTEGER NOT NULL DEFAULT 10,
      time_minutes INTEGER NOT NULL DEFAULT 30,
      base_success_rate INTEGER NOT NULL DEFAULT 50,
      difficulty_scaling DECIMAL(3,2) DEFAULT 1.0,
      base_cash_reward INTEGER NOT NULL DEFAULT 500,
      base_xp_reward INTEGER NOT NULL DEFAULT 100,
      trust_reward INTEGER NOT NULL DEFAULT 5,
      influence_reward INTEGER NOT NULL DEFAULT 0,
      trust_penalty INTEGER NOT NULL DEFAULT 10,
      heat_generated INTEGER NOT NULL DEFAULT 10,
      jail_minutes INTEGER NOT NULL DEFAULT 15,
      is_repeatable BOOLEAN NOT NULL DEFAULT TRUE,
      cooldown_hours INTEGER DEFAULT 24,
      available_start_hour INTEGER DEFAULT 0,
      available_end_hour INTEGER DEFAULT 24
    );

    -- Daily contracts
    CREATE TABLE IF NOT EXISTS daily_contracts (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      mission_data JSONB NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      UNIQUE(date)
    );

    -- Player daily contract progress
    CREATE TABLE IF NOT EXISTS player_daily_contracts (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      contract_date DATE NOT NULL,
      contract_index INTEGER NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      claimed BOOLEAN NOT NULL DEFAULT FALSE,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      UNIQUE(player_id, contract_date, contract_index)
    );

    -- Hourly tasks
    CREATE TABLE IF NOT EXISTS hourly_tasks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      task_type VARCHAR(30) NOT NULL,
      stamina_cost INTEGER NOT NULL DEFAULT 5,
      focus_cost INTEGER NOT NULL DEFAULT 5,
      time_minutes INTEGER NOT NULL DEFAULT 5,
      base_cash_reward INTEGER NOT NULL DEFAULT 100,
      base_xp_reward INTEGER NOT NULL DEFAULT 25,
      min_level INTEGER NOT NULL DEFAULT 1
    );

    -- Player hourly tasks
    CREATE TABLE IF NOT EXISTS player_hourly_tasks (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
      task_ids JSONB NOT NULL DEFAULT '[]',
      completed_ids JSONB NOT NULL DEFAULT '[]',
      refreshes_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
    );

    -- Random encounters
    CREATE TABLE IF NOT EXISTS random_encounters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      encounter_type VARCHAR(30) NOT NULL,
      trigger_chance DECIMAL(5,4) NOT NULL DEFAULT 0.05,
      trigger_context VARCHAR(30),
      district_id INTEGER REFERENCES districts(id),
      min_level INTEGER NOT NULL DEFAULT 1,
      max_level INTEGER,
      choices JSONB NOT NULL DEFAULT '[]',
      outcomes JSONB NOT NULL DEFAULT '{}'
    );

    -- Player encounters
    CREATE TABLE IF NOT EXISTS player_encounters (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      encounter_id INTEGER NOT NULL,
      choice_made VARCHAR(50),
      outcome VARCHAR(50),
      rewards_gained JSONB,
      occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Regeneration activities
    CREATE TABLE IF NOT EXISTS regen_activities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      activity_type VARCHAR(30) NOT NULL,
      stamina_regen INTEGER DEFAULT 0,
      focus_regen INTEGER DEFAULT 0,
      heat_reduction INTEGER DEFAULT 0,
      influence_gain INTEGER DEFAULT 0,
      time_minutes INTEGER NOT NULL DEFAULT 30,
      cash_cost INTEGER NOT NULL DEFAULT 0,
      min_level INTEGER NOT NULL DEFAULT 1,
      required_property_type VARCHAR(30),
      required_poi_type VARCHAR(30),
      cooldown_minutes INTEGER NOT NULL DEFAULT 60,
      available_hours_start INTEGER DEFAULT 0,
      available_hours_end INTEGER DEFAULT 24
    );

    -- Player regen cooldowns
    CREATE TABLE IF NOT EXISTS player_regen_cooldowns (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES regen_activities(id) ON DELETE CASCADE,
      available_at TIMESTAMP NOT NULL,
      UNIQUE(player_id, activity_id)
    );

    -- Payment tiers
    CREATE TABLE IF NOT EXISTS payment_tiers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      tier_type VARCHAR(20) NOT NULL,
      min_usd DECIMAL(6,2) NOT NULL,
      max_usd DECIMAL(6,2) NOT NULL,
      tokens_min INTEGER NOT NULL,
      tokens_max INTEGER NOT NULL,
      description TEXT
    );

    -- Token packages
    CREATE TABLE IF NOT EXISTS token_packages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      tokens INTEGER NOT NULL,
      price_usd DECIMAL(6,2) NOT NULL,
      bonus_tokens INTEGER NOT NULL DEFAULT 0,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      stripe_price_id VARCHAR(100)
    );

    -- Token purchases
    CREATE TABLE IF NOT EXISTS token_purchases (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      package_id INTEGER REFERENCES token_packages(id),
      tokens_purchased INTEGER NOT NULL,
      amount_usd DECIMAL(6,2) NOT NULL,
      stripe_payment_id VARCHAR(100),
      stripe_session_id VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    );

    -- Token spend log
    CREATE TABLE IF NOT EXISTS token_spend_log (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      tokens_spent INTEGER NOT NULL,
      spend_type VARCHAR(50) NOT NULL,
      item_id INTEGER,
      description TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Player spend limits
    CREATE TABLE IF NOT EXISTS player_spend_limits (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE UNIQUE,
      daily_limit_usd DECIMAL(6,2) NOT NULL DEFAULT 5.00,
      weekly_limit_usd DECIMAL(6,2) NOT NULL DEFAULT 20.00,
      daily_spent_usd DECIMAL(6,2) NOT NULL DEFAULT 0.00,
      weekly_spent_usd DECIMAL(6,2) NOT NULL DEFAULT 0.00,
      total_spent_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      last_daily_reset TIMESTAMP NOT NULL DEFAULT NOW(),
      last_weekly_reset TIMESTAMP NOT NULL DEFAULT NOW(),
      cooling_off_until TIMESTAMP,
      verified BOOLEAN NOT NULL DEFAULT FALSE
    );

    -- Token actions
    CREATE TABLE IF NOT EXISTS token_actions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      action_type VARCHAR(30) NOT NULL,
      token_cost INTEGER NOT NULL,
      effect_value INTEGER,
      effect_type VARCHAR(50),
      max_daily_uses INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    -- Player token actions
    CREATE TABLE IF NOT EXISTS player_token_actions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      action_id INTEGER NOT NULL REFERENCES token_actions(id) ON DELETE CASCADE,
      daily_uses INTEGER NOT NULL DEFAULT 0,
      last_used_at TIMESTAMP,
      last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE(player_id, action_id)
    );

    -- Capacity expansions
    CREATE TABLE IF NOT EXISTS capacity_expansions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      expansion_type VARCHAR(30) NOT NULL,
      mission_chain_name VARCHAR(100),
      mission_chain_stages INTEGER DEFAULT 5,
      expansion_per_stage INTEGER NOT NULL DEFAULT 5,
      token_cost INTEGER,
      max_purchases INTEGER NOT NULL DEFAULT 3,
      expansion_per_purchase INTEGER NOT NULL DEFAULT 5,
      max_total_expansion INTEGER NOT NULL DEFAULT 50
    );

    -- Player expansions
    CREATE TABLE IF NOT EXISTS player_expansions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      expansion_id INTEGER NOT NULL REFERENCES capacity_expansions(id) ON DELETE CASCADE,
      missions_completed INTEGER NOT NULL DEFAULT 0,
      tokens_purchased INTEGER NOT NULL DEFAULT 0,
      total_expansion INTEGER NOT NULL DEFAULT 0,
      UNIQUE(player_id, expansion_id)
    );

    -- Crew assignments
    CREATE TABLE IF NOT EXISTS crew_assignments (
      id SERIAL PRIMARY KEY,
      crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
      assigned_by INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      assigned_to INTEGER REFERENCES players(id) ON DELETE SET NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      mission_type VARCHAR(30) NOT NULL,
      target_value INTEGER NOT NULL DEFAULT 1,
      progress INTEGER NOT NULL DEFAULT 0,
      cash_reward INTEGER NOT NULL DEFAULT 0,
      xp_reward INTEGER NOT NULL DEFAULT 0,
      rep_reward INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMP,
      completed_at TIMESTAMP,
      expires_at TIMESTAMP
    );
  `);

  // Create indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_npcs_district ON npcs(district_id);
    CREATE INDEX IF NOT EXISTS idx_npcs_type ON npcs(type);
    CREATE INDEX IF NOT EXISTS idx_npc_relationships_player ON npc_relationships(player_id);
    CREATE INDEX IF NOT EXISTS idx_npc_missions_npc ON npc_missions(npc_id);
    CREATE INDEX IF NOT EXISTS idx_daily_contracts_date ON daily_contracts(date);
    CREATE INDEX IF NOT EXISTS idx_player_daily_contracts ON player_daily_contracts(player_id, contract_date);
    CREATE INDEX IF NOT EXISTS idx_player_hourly_tasks ON player_hourly_tasks(player_id);
    CREATE INDEX IF NOT EXISTS idx_token_purchases_player ON token_purchases(player_id);
    CREATE INDEX IF NOT EXISTS idx_token_spend_log_player ON token_spend_log(player_id);
    CREATE INDEX IF NOT EXISTS idx_player_expansions ON player_expansions(player_id);
  `);
}

async function seedPhase6DataInline() {
  // Minimal seed data if seed file not available
  console.log('Seeding Phase 6 data inline...');

  // Add sample NPCs
  await pool.query(`
    INSERT INTO npcs (name, type, district_id, trust_level_required, dialogue, avatar_emoji, description, cut_percentage)
    VALUES
      ('Marcus "The Connect" Johnson', 'fixer', 1, 0,
       '{"greeting": "You looking for work? I got work."}',
       '???', 'The go-to fixer downtown.', 15),
      ('Doc Wilson', 'doctor', 8, 0,
       '{"greeting": "Let me take a look at you."}',
       '???', 'A street doctor in Parkdale.', 0)
    ON CONFLICT (name) DO NOTHING
  `);

  // Add hourly tasks
  await pool.query(`
    INSERT INTO hourly_tasks (name, description, task_type, stamina_cost, focus_cost, time_minutes, base_cash_reward, base_xp_reward, min_level)
    VALUES
      ('Quick Delivery', 'Run a package across the block.', 'delivery', 5, 3, 5, 100, 20, 1),
      ('Street Scout', 'Check out a location and report back.', 'scout', 5, 5, 10, 125, 25, 1)
    ON CONFLICT DO NOTHING
  `);

  // Add regen activities
  await pool.query(`
    INSERT INTO regen_activities (name, description, activity_type, stamina_regen, focus_regen, heat_reduction, influence_gain, time_minutes, cash_cost, min_level, cooldown_minutes)
    VALUES
      ('Rest at Safehouse', 'Take some time to recover.', 'stamina', 30, 10, 5, 0, 60, 0, 1, 120),
      ('Meditate', 'Clear your mind and regain focus.', 'focus', 10, 40, 0, 0, 30, 0, 1, 90),
      ('Lay Low', 'Stay off the radar for a while.', 'heat', 0, 0, 20, 0, 120, 0, 1, 180)
    ON CONFLICT (name) DO NOTHING
  `);

  // Add token packages
  await pool.query(`
    INSERT INTO token_packages (name, tokens, price_usd, bonus_tokens, is_featured)
    VALUES
      ('Starter Pack', 100, 0.10, 0, FALSE),
      ('Value Pack', 3000, 2.00, 500, TRUE)
    ON CONFLICT DO NOTHING
  `);

  // Add token actions
  await pool.query(`
    INSERT INTO token_actions (name, description, action_type, token_cost, effect_value, effect_type, max_daily_uses)
    VALUES
      ('Skip 10 Minute Wait', 'Skip a 10 minute cooldown.', 'skip_wait', 5, 10, 'minutes', NULL),
      ('Instant Travel', 'Travel to any district instantly.', 'instant_travel', 10, 1, 'travel', 10),
      ('Stamina Boost (+25)', 'Instantly restore 25 stamina.', 'boost', 30, 25, 'stamina', 5)
    ON CONFLICT (name) DO NOTHING
  `);

  // Add capacity expansions
  await pool.query(`
    INSERT INTO capacity_expansions (name, description, expansion_type, mission_chain_name, mission_chain_stages, expansion_per_stage, token_cost, max_purchases, expansion_per_purchase, max_total_expansion)
    VALUES
      ('Endurance Training', 'Increase your maximum stamina.', 'stamina_max', 'Iron Will Training', 5, 10, 200, 3, 5, 65),
      ('Mental Fortitude', 'Increase your maximum focus.', 'focus_max', 'Mind Over Matter', 5, 10, 200, 3, 5, 65)
    ON CONFLICT (name) DO NOTHING
  `);
}
