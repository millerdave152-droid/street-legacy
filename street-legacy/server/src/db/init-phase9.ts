import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPhase9System(): Promise<void> {
  console.log('Initializing Phase 9 Business Fronts System...');

  try {
    // Check if business_front_types table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'business_front_types'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating Phase 9 tables...');

      // Try to read and execute schema file
      try {
        const schemaPath = path.join(__dirname, 'schema-phase9.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSQL);
        console.log('Phase 9 schema created from file');
      } catch (fileError) {
        console.log('Schema file not found, creating tables inline...');
        await createPhase9TablesInline();
      }

      // Seed initial data
      try {
        const seedPath = path.join(__dirname, 'seed-phase9.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSQL);
        console.log('Phase 9 seed data loaded from file');
      } catch (fileError) {
        console.log('Seed file not found, seeding minimal data inline...');
        await seedPhase9DataInline();
      }
    } else {
      console.log('Phase 9 tables already exist');
    }

    // Ensure player columns exist
    await pool.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS clean_bank_balance INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS total_taxes_paid INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS tax_evasion_amount INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS financial_investigation_count INTEGER DEFAULT 0;
    `);

    console.log('Phase 9 Business Fronts System initialized successfully');
  } catch (error) {
    console.error('Error initializing Phase 9 system:', error);
  }
}

async function createPhase9TablesInline(): Promise<void> {
  await pool.query(`
    -- Business front types reference table
    CREATE TABLE IF NOT EXISTS business_front_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type_code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      base_setup_cost INTEGER NOT NULL,
      monthly_expenses INTEGER NOT NULL,
      base_laundering_rate INTEGER NOT NULL,
      max_daily_laundering INTEGER NOT NULL,
      min_legitimacy INTEGER DEFAULT 0,
      required_property_types TEXT[] DEFAULT '{}',
      employee_slots INTEGER DEFAULT 5,
      base_employee_cost INTEGER DEFAULT 1000,
      tax_rate DECIMAL(5,2) DEFAULT 15.00,
      audit_risk_multiplier DECIMAL(3,2) DEFAULT 1.0,
      required_level INTEGER DEFAULT 1,
      required_connections INTEGER DEFAULT 0,
      icon VARCHAR(10) DEFAULT '🏪',
      is_active BOOLEAN DEFAULT true
    );

    -- Player-owned business fronts
    CREATE TABLE IF NOT EXISTS business_fronts (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      business_type_id INTEGER REFERENCES business_front_types(id),
      name VARCHAR(100) NOT NULL,
      legitimacy_rating INTEGER DEFAULT 50,
      reputation INTEGER DEFAULT 50,
      dirty_cash_stored INTEGER DEFAULT 0,
      clean_cash_pending INTEGER DEFAULT 0,
      total_laundered INTEGER DEFAULT 0,
      total_legitimate_income INTEGER DEFAULT 0,
      is_operational BOOLEAN DEFAULT false,
      operating_hours VARCHAR(20) DEFAULT '9-17',
      daily_customers INTEGER DEFAULT 0,
      employee_count INTEGER DEFAULT 0,
      employee_quality INTEGER DEFAULT 50,
      has_license BOOLEAN DEFAULT false,
      license_expires_at TIMESTAMP,
      permits JSONB DEFAULT '[]',
      is_under_investigation BOOLEAN DEFAULT false,
      investigation_id INTEGER,
      last_audit_date TIMESTAMP,
      audit_flags INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_tax_paid TIMESTAMP
    );

    -- Business employees
    CREATE TABLE IF NOT EXISTS business_employees (
      id SERIAL PRIMARY KEY,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      salary INTEGER NOT NULL,
      quality INTEGER DEFAULT 50,
      loyalty INTEGER DEFAULT 50,
      is_legitimate BOOLEAN DEFAULT true,
      knows_about_laundering BOOLEAN DEFAULT false,
      hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_paid TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Laundering operations
    CREATE TABLE IF NOT EXISTS laundering_operations (
      id SERIAL PRIMARY KEY,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      dirty_amount INTEGER NOT NULL,
      clean_amount INTEGER NOT NULL,
      fee_amount INTEGER NOT NULL,
      fee_percentage DECIMAL(5,2) NOT NULL,
      status VARCHAR(30) DEFAULT 'processing',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completes_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      was_flagged BOOLEAN DEFAULT false,
      flag_reason VARCHAR(100)
    );

    -- Tax records
    CREATE TABLE IF NOT EXISTS tax_records (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
      tax_period VARCHAR(20) NOT NULL,
      gross_income INTEGER DEFAULT 0,
      reported_income INTEGER DEFAULT 0,
      deductions INTEGER DEFAULT 0,
      taxes_owed INTEGER DEFAULT 0,
      taxes_paid INTEGER DEFAULT 0,
      payment_status VARCHAR(30) DEFAULT 'pending',
      due_date TIMESTAMP NOT NULL,
      paid_at TIMESTAMP,
      audit_flag BOOLEAN DEFAULT false,
      audit_result VARCHAR(30),
      penalty_amount INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(business_id, tax_period)
    );

    -- Investigations
    CREATE TABLE IF NOT EXISTS investigations (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE SET NULL,
      investigation_type VARCHAR(50) NOT NULL,
      trigger_reason VARCHAR(100) NOT NULL,
      stage VARCHAR(30) DEFAULT 'preliminary',
      severity INTEGER DEFAULT 1,
      evidence_collected JSONB DEFAULT '[]',
      evidence_strength INTEGER DEFAULT 0,
      lead_agent VARCHAR(100),
      agency VARCHAR(50) DEFAULT 'IRS',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      player_notified_at TIMESTAMP,
      subpoena_issued_at TIMESTAMP,
      charges_filed_at TIMESTAMP,
      resolved_at TIMESTAMP,
      outcome VARCHAR(50),
      fine_amount INTEGER DEFAULT 0,
      jail_time_hours INTEGER DEFAULT 0,
      assets_seized INTEGER DEFAULT 0,
      notes JSONB DEFAULT '[]'
    );

    -- Cash transaction flags
    CREATE TABLE IF NOT EXISTS cash_transaction_flags (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE SET NULL,
      transaction_type VARCHAR(50) NOT NULL,
      amount INTEGER NOT NULL,
      flag_type VARCHAR(50) NOT NULL,
      flag_reason TEXT,
      reported_to_authorities BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Business operations log
    CREATE TABLE IF NOT EXISTS business_operations_log (
      id SERIAL PRIMARY KEY,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
      operation_type VARCHAR(50) NOT NULL,
      revenue INTEGER DEFAULT 0,
      expenses INTEGER DEFAULT 0,
      customers_served INTEGER DEFAULT 0,
      notes TEXT,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Business events
    CREATE TABLE IF NOT EXISTS business_events (
      id SERIAL PRIMARY KEY,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      title VARCHAR(100) NOT NULL,
      description TEXT,
      choices JSONB DEFAULT '[]',
      selected_choice INTEGER,
      outcome JSONB,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      expires_at TIMESTAMP
    );

    -- Business reviews
    CREATE TABLE IF NOT EXISTS business_reviews (
      id SERIAL PRIMARY KEY,
      business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
      reviewer_type VARCHAR(30) DEFAULT 'customer',
      rating INTEGER,
      review_text TEXT,
      is_fake BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Player attorney relationships
    CREATE TABLE IF NOT EXISTS player_attorney_relationships (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      attorney_name VARCHAR(100) NOT NULL,
      attorney_tier INTEGER DEFAULT 1,
      retainer_fee INTEGER NOT NULL,
      retainer_paid_until TIMESTAMP,
      cases_handled INTEGER DEFAULT 0,
      audit_reduction_percent INTEGER DEFAULT 10,
      is_active BOOLEAN DEFAULT true,
      hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id)
    );

    -- Attorney NPCs
    CREATE TABLE IF NOT EXISTS attorney_npcs (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      tier INTEGER NOT NULL,
      description TEXT,
      monthly_retainer INTEGER NOT NULL,
      audit_reduction_percent INTEGER NOT NULL,
      investigation_help_percent INTEGER NOT NULL,
      max_clients INTEGER DEFAULT 10,
      current_clients INTEGER DEFAULT 0,
      min_legitimacy INTEGER DEFAULT 0,
      required_level INTEGER DEFAULT 1,
      icon VARCHAR(10) DEFAULT '👔'
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_business_fronts_owner ON business_fronts(owner_id);
    CREATE INDEX IF NOT EXISTS idx_laundering_operations_player ON laundering_operations(player_id);
    CREATE INDEX IF NOT EXISTS idx_laundering_operations_status ON laundering_operations(status);
    CREATE INDEX IF NOT EXISTS idx_tax_records_player ON tax_records(player_id);
    CREATE INDEX IF NOT EXISTS idx_investigations_player ON investigations(player_id);
  `);
  console.log('Phase 9 tables created inline');
}

async function seedPhase9DataInline(): Promise<void> {
  // Check if we already have business types
  const existingTypes = await pool.query('SELECT COUNT(*) FROM business_front_types');
  if (parseInt(existingTypes.rows[0].count) > 0) {
    console.log('Business front types already exist, skipping seed');
    return;
  }

  await pool.query(`
    -- Business Front Types
    INSERT INTO business_front_types (name, type_code, description, base_setup_cost, monthly_expenses, base_laundering_rate, max_daily_laundering, min_legitimacy, required_property_types, employee_slots, base_employee_cost, tax_rate, audit_risk_multiplier, required_level, required_connections, icon) VALUES
    ('Convenience Store', 'convenience_store', 'A small corner store dealing primarily in cash transactions.', 25000, 3000, 2500, 5000, 0, '{corner_store}', 3, 800, 12.00, 0.8, 3, 0, '🏪'),
    ('Laundromat', 'laundromat', 'Coin-operated machines mean lots of cash and few questions.', 40000, 2500, 3500, 7500, 0, '{corner_store,warehouse}', 2, 600, 10.00, 0.7, 5, 0, '🧺'),
    ('Diner', 'diner', 'Classic American diner. Good food, better books.', 75000, 8000, 5000, 10000, 10, '{corner_store,restaurant}', 8, 1200, 15.00, 0.9, 5, 0, '🍳'),
    ('Bar', 'bar', 'Neighborhood watering hole. Cash bar means cash flow.', 100000, 10000, 7500, 15000, 20, '{restaurant,nightclub}', 6, 1500, 18.00, 1.0, 10, 200, '🍺'),
    ('Used Car Lot', 'car_dealership', 'Buy cars for cash, sell for more cash.', 500000, 30000, 25000, 50000, 60, '{warehouse,distribution_center}', 10, 3000, 18.00, 1.5, 25, 1000, '🚗'),
    ('Real Estate Agency', 'real_estate', 'Buy, sell, and launder through property transactions.', 1000000, 35000, 50000, 100000, 75, '{office_building,strip_mall}', 12, 5000, 25.00, 1.6, 35, 2000, '🏢');

    -- Attorney NPCs
    INSERT INTO attorney_npcs (name, tier, description, monthly_retainer, audit_reduction_percent, investigation_help_percent, max_clients, min_legitimacy, required_level, icon) VALUES
    ('Jimmy "The Fixer" Novak', 1, 'A strip mall lawyer who knows which palms to grease.', 2500, 15, 10, 20, 0, 5, '👔'),
    ('Sarah Chen, Esq.', 2, 'Former IRS agent turned defense attorney.', 7500, 30, 25, 10, 30, 15, '👩‍⚖️'),
    ('Victoria Sterling III', 3, 'Old money attorney with connections everywhere.', 25000, 50, 45, 5, 60, 30, '🎩');
  `);

  console.log('Phase 9 minimal seed data loaded');
}
