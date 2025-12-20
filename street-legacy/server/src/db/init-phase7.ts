import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initPhase7System(): Promise<void> {
  console.log('Initializing Phase 7 Property System...');

  try {
    // Check if property_listings table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'property_listings'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating Phase 7 tables...');

      // Try to read and execute schema file
      try {
        const schemaPath = path.join(__dirname, 'schema-phase7.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSQL);
        console.log('Phase 7 schema created from file');
      } catch (fileError) {
        console.log('Schema file not found, creating tables inline...');
        await createPhase7TablesInline();
      }

      // Seed initial data
      try {
        const seedPath = path.join(__dirname, 'seed-phase7.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSQL);
        console.log('Phase 7 seed data loaded from file');
      } catch (fileError) {
        console.log('Seed file not found, seeding minimal data inline...');
        await seedPhase7DataInline();
      }
    } else {
      console.log('Phase 7 tables already exist');
    }

    console.log('Phase 7 Property System initialized successfully');
  } catch (error) {
    console.error('Error initializing Phase 7 system:', error);
  }
}

async function createPhase7TablesInline(): Promise<void> {
  await pool.query(`
    -- Property listings (available for purchase)
    CREATE TABLE IF NOT EXISTS property_listings (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      property_type VARCHAR(50) NOT NULL,
      category VARCHAR(50) NOT NULL,
      district_id INTEGER REFERENCES districts(id),
      description TEXT,
      base_price INTEGER NOT NULL,
      monthly_maintenance INTEGER DEFAULT 0,
      base_income INTEGER DEFAULT 0,
      income_frequency_hours INTEGER DEFAULT 24,
      storage_capacity INTEGER DEFAULT 0,
      upgrade_slots INTEGER DEFAULT 3,
      min_level INTEGER DEFAULT 1,
      min_rep INTEGER DEFAULT 0,
      heat_generated INTEGER DEFAULT 0,
      raid_risk INTEGER DEFAULT 0,
      icon VARCHAR(10) DEFAULT '🏠',
      is_available BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Owned properties
    CREATE TABLE IF NOT EXISTS owned_properties (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      listing_id INTEGER REFERENCES property_listings(id),
      custom_name VARCHAR(100),
      condition INTEGER DEFAULT 100,
      last_maintenance TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_income_collection TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      current_heat INTEGER DEFAULT 0,
      is_operational BOOLEAN DEFAULT true,
      has_manager BOOLEAN DEFAULT false,
      manager_cost INTEGER DEFAULT 0,
      purchase_price INTEGER NOT NULL,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Property upgrade types
    CREATE TABLE IF NOT EXISTS property_upgrade_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      applicable_types TEXT[] DEFAULT '{}',
      applicable_categories TEXT[] DEFAULT '{}',
      cost INTEGER NOT NULL,
      monthly_cost INTEGER DEFAULT 0,
      min_level INTEGER DEFAULT 1,
      required_upgrade_id INTEGER REFERENCES property_upgrade_types(id),
      effects JSONB DEFAULT '{}',
      install_time_hours INTEGER DEFAULT 0,
      icon VARCHAR(10) DEFAULT '⚙️'
    );

    -- Installed property upgrades
    CREATE TABLE IF NOT EXISTS property_upgrades (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      upgrade_type_id INTEGER REFERENCES property_upgrade_types(id),
      is_active BOOLEAN DEFAULT true,
      installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      installing_until TIMESTAMP,
      UNIQUE(property_id, upgrade_type_id)
    );

    -- Property operations
    CREATE TABLE IF NOT EXISTS property_operations (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      operation_type VARCHAR(50) NOT NULL,
      is_active BOOLEAN DEFAULT false,
      intensity INTEGER DEFAULT 50,
      efficiency INTEGER DEFAULT 100,
      started_at TIMESTAMP,
      last_collection TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_produced INTEGER DEFAULT 0,
      total_revenue INTEGER DEFAULT 0,
      UNIQUE(property_id, operation_type)
    );

    -- Property staff
    CREATE TABLE IF NOT EXISTS property_staff (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      staff_type VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      salary INTEGER NOT NULL,
      efficiency INTEGER DEFAULT 100,
      loyalty INTEGER DEFAULT 50,
      hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Property raids
    CREATE TABLE IF NOT EXISTS property_raids (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      raid_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) DEFAULT 'standard',
      success BOOLEAN NOT NULL,
      cash_seized INTEGER DEFAULT 0,
      inventory_seized JSONB DEFAULT '[]',
      products_seized INTEGER DEFAULT 0,
      damage_dealt INTEGER DEFAULT 0,
      was_defended BOOLEAN DEFAULT false,
      defense_method VARCHAR(100),
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Property inventory
    CREATE TABLE IF NOT EXISTS property_inventory (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      item_type VARCHAR(50) NOT NULL,
      item_name VARCHAR(100) NOT NULL,
      quantity INTEGER DEFAULT 1,
      value INTEGER DEFAULT 0,
      stored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Property income log
    CREATE TABLE IF NOT EXISTS property_income_log (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      source VARCHAR(50) NOT NULL,
      collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Property maintenance log
    CREATE TABLE IF NOT EXISTS property_maintenance_log (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      cost INTEGER NOT NULL,
      condition_before INTEGER,
      condition_after INTEGER,
      maintenance_type VARCHAR(50) DEFAULT 'routine',
      performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Laundering transactions
    CREATE TABLE IF NOT EXISTS laundering_transactions (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES owned_properties(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      dirty_amount INTEGER NOT NULL,
      clean_amount INTEGER NOT NULL,
      fee INTEGER NOT NULL,
      fee_percentage DECIMAL(5,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completes_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_owned_properties_owner ON owned_properties(owner_id);
    CREATE INDEX IF NOT EXISTS idx_property_upgrades_property ON property_upgrades(property_id);
    CREATE INDEX IF NOT EXISTS idx_property_operations_property ON property_operations(property_id);
    CREATE INDEX IF NOT EXISTS idx_property_raids_property ON property_raids(property_id);
    CREATE INDEX IF NOT EXISTS idx_laundering_transactions_player ON laundering_transactions(player_id);
    CREATE INDEX IF NOT EXISTS idx_laundering_transactions_status ON laundering_transactions(status);
  `);
  console.log('Phase 7 tables created inline');
}

async function seedPhase7DataInline(): Promise<void> {
  // Check if we already have property listings
  const existingListings = await pool.query('SELECT COUNT(*) FROM property_listings');
  if (parseInt(existingListings.rows[0].count) > 0) {
    console.log('Property listings already exist, skipping seed');
    return;
  }

  await pool.query(`
    -- Sample property listings
    INSERT INTO property_listings (name, property_type, category, district_id, description, base_price, monthly_maintenance, base_income, income_frequency_hours, storage_capacity, upgrade_slots, min_level, min_rep, heat_generated, raid_risk, icon) VALUES
    ('Downtown Apartment', 'apartment', 'residential', 1, 'A modest apartment in the downtown area.', 50000, 500, 200, 24, 10, 2, 1, 0, 0, 5, '🏢'),
    ('Suburban House', 'house', 'residential', 2, 'A quiet house in the suburbs.', 150000, 1000, 500, 24, 25, 3, 5, 0, 0, 3, '🏠'),
    ('Corner Store', 'corner_store', 'commercial', 1, 'A small convenience store.', 75000, 750, 1000, 12, 20, 3, 3, 100, 5, 15, '🏪'),
    ('Warehouse', 'warehouse', 'industrial', 3, 'A large storage warehouse.', 200000, 1500, 0, 24, 100, 4, 8, 200, 10, 20, '🏭'),
    ('Trap House', 'trap_house', 'illegal', 4, 'An inconspicuous house for operations.', 100000, 2000, 0, 24, 30, 5, 10, 500, 25, 35, '🏚️'),
    ('Stash House', 'stash_house', 'illegal', 4, 'A secure location to store product.', 150000, 2500, 0, 24, 75, 4, 15, 750, 20, 30, '🔒');

    -- Sample upgrade types
    INSERT INTO property_upgrade_types (name, description, category, applicable_categories, cost, monthly_cost, min_level, effects, install_time_hours, icon) VALUES
    ('Basic Security System', 'Cameras and basic alarm', 'security', '{residential,commercial,industrial,illegal}', 5000, 100, 1, '{"raidChanceReduction": 10, "alarmSystem": true}', 2, '📹'),
    ('Reinforced Doors', 'Heavy-duty security doors', 'security', '{residential,commercial,industrial,illegal}', 10000, 50, 5, '{"raidChanceReduction": 15, "seizureReduction": 10}', 4, '🚪'),
    ('Income Optimizer', 'Better business practices', 'income', '{commercial}', 15000, 200, 5, '{"incomeMultiplier": 1.2}', 6, '💰'),
    ('Storage Expansion', 'Additional storage capacity', 'storage', '{residential,commercial,industrial,illegal}', 8000, 100, 3, '{"storageBonus": 25}', 4, '📦'),
    ('Money Counter', 'High-speed bill counter for laundering', 'operations', '{illegal}', 25000, 500, 10, '{"maxLaunderingDaily": 50000, "launderingFeeReduction": 2}', 8, '💵'),
    ('Hidden Compartment', 'Secret storage space', 'special', '{illegal}', 20000, 0, 12, '{"hiddenStorage": true, "seizureReduction": 25}', 12, '🔐');
  `);

  console.log('Phase 7 minimal seed data loaded');
}
