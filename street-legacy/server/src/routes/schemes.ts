import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware as authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Initialize schemes system - create tables and seed data
export async function initSchemesSystem() {
  try {
    // Create scheme categories enum type
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE scheme_category AS ENUM ('digital', 'street', 'organized', 'social');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create location type enum
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE location_type AS ENUM ('any', 'specific_poi', 'district', 'property');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create schemes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schemes (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(20) NOT NULL,
        description TEXT,
        requirements JSONB DEFAULT '{}',
        phases JSONB DEFAULT '[]',
        base_success_rate INTEGER DEFAULT 70,
        base_payout_min INTEGER DEFAULT 100,
        base_payout_max INTEGER DEFAULT 500,
        heat_gain INTEGER DEFAULT 10,
        energy_cost INTEGER DEFAULT 10,
        nerve_cost INTEGER DEFAULT 5,
        cooldown_seconds INTEGER DEFAULT 300,
        location_type VARCHAR(20) DEFAULT 'any',
        min_level INTEGER DEFAULT 1,
        crew_size_min INTEGER DEFAULT 1,
        crew_size_max INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create player active schemes table (for multi-stage tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_schemes (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        scheme_id VARCHAR(50) REFERENCES schemes(id),
        current_phase INTEGER DEFAULT 0,
        phase_data JSONB DEFAULT '{}',
        crew_members JSONB DEFAULT '[]',
        target_poi_id INTEGER,
        target_district_id INTEGER,
        started_at TIMESTAMP DEFAULT NOW(),
        last_phase_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'planning',
        total_invested INTEGER DEFAULT 0,
        UNIQUE(player_id, scheme_id, status)
      )
    `);

    // Create scheme cooldowns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheme_cooldowns (
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        scheme_id VARCHAR(50) REFERENCES schemes(id),
        cooldown_until TIMESTAMP NOT NULL,
        PRIMARY KEY (player_id, scheme_id)
      )
    `);

    // Create scheme history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheme_history (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        scheme_id VARCHAR(50) REFERENCES schemes(id),
        outcome VARCHAR(20) NOT NULL,
        phases_completed INTEGER DEFAULT 0,
        payout INTEGER DEFAULT 0,
        heat_gained INTEGER DEFAULT 0,
        arrested BOOLEAN DEFAULT false,
        evidence_left INTEGER DEFAULT 0,
        completed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create map events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS map_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        district_id INTEGER REFERENCES districts(id),
        poi_id INTEGER,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        max_participants INTEGER DEFAULT 10,
        participants JSONB DEFAULT '[]',
        rewards JSONB DEFAULT '{}',
        consequences JSONB DEFAULT '{}',
        difficulty INTEGER DEFAULT 1,
        heat_required_max INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create player event participation table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_participation (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES map_events(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        outcome VARCHAR(20),
        rewards_claimed JSONB DEFAULT '{}',
        UNIQUE(player_id, event_id)
      )
    `);

    // Create investigations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS investigations (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        crime_type VARCHAR(50),
        scheme_id VARCHAR(50),
        evidence_level INTEGER DEFAULT 0,
        investigator_progress INTEGER DEFAULT 0,
        will_arrest_at INTEGER DEFAULT 100,
        started_at TIMESTAMP DEFAULT NOW(),
        last_update TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'active',
        witnesses JSONB DEFAULT '[]'
      )
    `);

    // Create witnesses table for investigation mechanics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS witnesses (
        id SERIAL PRIMARY KEY,
        investigation_id INTEGER REFERENCES investigations(id) ON DELETE CASCADE,
        name VARCHAR(100),
        description TEXT,
        evidence_value INTEGER DEFAULT 10,
        can_bribe BOOLEAN DEFAULT true,
        bribe_cost INTEGER DEFAULT 1000,
        can_intimidate BOOLEAN DEFAULT true,
        intimidation_difficulty INTEGER DEFAULT 50,
        is_eliminated BOOLEAN DEFAULT false,
        is_silenced BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add heat column to players if not exists
    await pool.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS heat INTEGER DEFAULT 0
    `);
    await pool.query(`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS last_heat_decay TIMESTAMP DEFAULT NOW()
    `);

    // Seed schemes data
    await seedSchemes();

    console.log('Schemes system initialized successfully');
  } catch (error) {
    console.error('Error initializing schemes system:', error);
  }
}

async function seedSchemes() {
  const schemes = [
    // DIGITAL HUSTLES
    {
      id: 'phishing_operation',
      name: 'Phishing Operation',
      category: 'digital',
      description: 'Set up fake business emails to steal credentials and sell them on the dark web.',
      requirements: { min_intelligence: 30 },
      phases: [
        { name: 'Setup Domain', description: 'Register convincing domain names', success_rate_mod: 10, cost: 200 },
        { name: 'Create Emails', description: 'Craft convincing phishing emails', success_rate_mod: 0, cost: 0 },
        { name: 'Send Campaign', description: 'Blast out to targets', success_rate_mod: -10, cost: 100 },
        { name: 'Harvest Creds', description: 'Collect and sell credentials', success_rate_mod: -5, cost: 0 }
      ],
      base_success_rate: 65,
      base_payout_min: 500,
      base_payout_max: 3000,
      heat_gain: 8,
      energy_cost: 15,
      nerve_cost: 8,
      cooldown_seconds: 3600,
      min_level: 5
    },
    {
      id: 'crypto_pump_dump',
      name: 'Crypto Pump & Dump',
      category: 'digital',
      description: 'Coordinate fake hype around a worthless coin, then dump your holdings on suckers.',
      requirements: { min_intelligence: 40, min_charisma: 30, min_cash: 5000 },
      phases: [
        { name: 'Buy Coins', description: 'Accumulate the target cryptocurrency', success_rate_mod: 20, cost: 5000 },
        { name: 'Build Hype', description: 'Spread fake news and influencer posts', success_rate_mod: 0, cost: 1000 },
        { name: 'Coordinate Pump', description: 'Get community buying frenzy started', success_rate_mod: -15, cost: 500 },
        { name: 'Dump Holdings', description: 'Sell everything at peak', success_rate_mod: -20, cost: 0 }
      ],
      base_success_rate: 55,
      base_payout_min: 8000,
      base_payout_max: 25000,
      heat_gain: 15,
      energy_cost: 20,
      nerve_cost: 15,
      cooldown_seconds: 14400,
      min_level: 15
    },
    {
      id: 'romance_scam',
      name: 'Romance Scam',
      category: 'digital',
      description: 'Create fake dating profiles to emotionally manipulate lonely targets for money.',
      requirements: { min_charisma: 50 },
      phases: [
        { name: 'Create Profile', description: 'Build convincing fake identity', success_rate_mod: 15, cost: 100 },
        { name: 'Find Target', description: 'Identify vulnerable mark', success_rate_mod: 10, cost: 0 },
        { name: 'Build Trust', description: 'Weeks of emotional manipulation', success_rate_mod: 0, cost: 200 },
        { name: 'Create Crisis', description: 'Fabricate emergency need for money', success_rate_mod: -10, cost: 0 },
        { name: 'Extract Funds', description: 'Get the wire transfer', success_rate_mod: -20, cost: 0 }
      ],
      base_success_rate: 60,
      base_payout_min: 5000,
      base_payout_max: 50000,
      heat_gain: 12,
      energy_cost: 25,
      nerve_cost: 10,
      cooldown_seconds: 86400,
      min_level: 10
    },
    {
      id: 'fake_storefront',
      name: 'Fake Storefront',
      category: 'digital',
      description: 'Set up convincing e-commerce site, take orders, never ship anything.',
      requirements: { min_intelligence: 35 },
      phases: [
        { name: 'Build Site', description: 'Create professional-looking store', success_rate_mod: 10, cost: 500 },
        { name: 'Run Ads', description: 'Drive traffic with paid ads', success_rate_mod: 5, cost: 1000 },
        { name: 'Process Orders', description: 'Collect payments for fake products', success_rate_mod: -5, cost: 0 },
        { name: 'Disappear', description: 'Shut down before chargebacks hit', success_rate_mod: -15, cost: 0 }
      ],
      base_success_rate: 70,
      base_payout_min: 2000,
      base_payout_max: 15000,
      heat_gain: 18,
      energy_cost: 20,
      nerve_cost: 12,
      cooldown_seconds: 7200,
      min_level: 8
    },
    {
      id: 'sim_swap',
      name: 'SIM Swap',
      category: 'digital',
      description: 'Social engineer phone carrier to transfer victim\'s number, drain their accounts.',
      requirements: { min_intelligence: 45, min_charisma: 40 },
      phases: [
        { name: 'Gather Intel', description: 'Research target\'s personal info', success_rate_mod: 10, cost: 200 },
        { name: 'Call Carrier', description: 'Social engineer the support rep', success_rate_mod: -10, cost: 0 },
        { name: 'Port Number', description: 'Get the number transferred', success_rate_mod: -15, cost: 0 },
        { name: 'Drain Accounts', description: 'Bypass 2FA, empty everything', success_rate_mod: -20, cost: 0 }
      ],
      base_success_rate: 50,
      base_payout_min: 3000,
      base_payout_max: 20000,
      heat_gain: 25,
      energy_cost: 18,
      nerve_cost: 15,
      cooldown_seconds: 10800,
      min_level: 12
    },

    // STREET OPERATIONS
    {
      id: 'porch_pirating',
      name: 'Porch Pirating',
      category: 'street',
      description: 'Follow delivery trucks and snatch packages from doorsteps.',
      requirements: {},
      phases: [
        { name: 'Scout Route', description: 'Follow delivery truck', success_rate_mod: 10, cost: 0 },
        { name: 'Grab Package', description: 'Snatch and run', success_rate_mod: -5, cost: 0 }
      ],
      base_success_rate: 85,
      base_payout_min: 50,
      base_payout_max: 500,
      heat_gain: 3,
      energy_cost: 8,
      nerve_cost: 3,
      cooldown_seconds: 300,
      min_level: 1,
      location_type: 'district'
    },
    {
      id: 'catalytic_converter',
      name: 'Catalytic Converter Theft',
      category: 'street',
      description: 'Slide under parked cars and saw off valuable catalytic converters.',
      requirements: { min_strength: 20 },
      phases: [
        { name: 'Find Target', description: 'Locate ideal vehicle', success_rate_mod: 15, cost: 0 },
        { name: 'Cut Converter', description: 'Sawzall time', success_rate_mod: -10, cost: 50 },
        { name: 'Escape', description: 'Get away clean', success_rate_mod: -5, cost: 0 }
      ],
      base_success_rate: 75,
      base_payout_min: 200,
      base_payout_max: 800,
      heat_gain: 8,
      energy_cost: 15,
      nerve_cost: 8,
      cooldown_seconds: 1800,
      min_level: 3,
      location_type: 'district'
    },
    {
      id: 'atm_skimming',
      name: 'ATM Skimming',
      category: 'street',
      description: 'Install card skimmer on ATM, collect card data over time.',
      requirements: { min_intelligence: 30, min_dexterity: 25 },
      phases: [
        { name: 'Acquire Skimmer', description: 'Get or build skimming device', success_rate_mod: 15, cost: 500 },
        { name: 'Install Device', description: 'Attach skimmer to ATM unnoticed', success_rate_mod: -10, cost: 0 },
        { name: 'Wait Period', description: 'Let it collect data for 48 hours', success_rate_mod: 0, cost: 0 },
        { name: 'Retrieve & Clone', description: 'Get device, clone cards', success_rate_mod: -15, cost: 200 },
        { name: 'Cash Out', description: 'Drain cloned cards', success_rate_mod: -10, cost: 0 }
      ],
      base_success_rate: 60,
      base_payout_min: 2000,
      base_payout_max: 10000,
      heat_gain: 20,
      energy_cost: 20,
      nerve_cost: 15,
      cooldown_seconds: 86400,
      min_level: 10,
      location_type: 'specific_poi'
    },
    {
      id: 'flash_mob_robbery',
      name: 'Flash Mob Robbery',
      category: 'street',
      description: 'Coordinate crew to swarm store, grab everything, scatter.',
      requirements: { min_crew: 3 },
      phases: [
        { name: 'Scout Store', description: 'Case the target location', success_rate_mod: 10, cost: 0 },
        { name: 'Coordinate Crew', description: 'Brief everyone on timing', success_rate_mod: 5, cost: 100 },
        { name: 'Execute Rush', description: 'Everyone storms in at once', success_rate_mod: -15, cost: 0 },
        { name: 'Scatter', description: 'Everyone runs different directions', success_rate_mod: -10, cost: 0 }
      ],
      base_success_rate: 65,
      base_payout_min: 1500,
      base_payout_max: 8000,
      heat_gain: 25,
      energy_cost: 20,
      nerve_cost: 20,
      cooldown_seconds: 7200,
      min_level: 8,
      crew_size_min: 3,
      crew_size_max: 8,
      location_type: 'specific_poi'
    },
    {
      id: 'car_cloning',
      name: 'Car Cloning',
      category: 'street',
      description: 'Steal a car\'s VIN, create fake papers, resell stolen vehicles as legit.',
      requirements: { min_intelligence: 35, min_dexterity: 30 },
      phases: [
        { name: 'Find Donor', description: 'Locate car with clean history', success_rate_mod: 10, cost: 0 },
        { name: 'Clone VIN', description: 'Copy VIN plates and docs', success_rate_mod: 0, cost: 300 },
        { name: 'Steal Match', description: 'Steal identical make/model', success_rate_mod: -15, cost: 0 },
        { name: 'Swap Identity', description: 'Apply cloned VIN to stolen car', success_rate_mod: -5, cost: 100 },
        { name: 'Find Buyer', description: 'Sell to unsuspecting buyer', success_rate_mod: -10, cost: 0 }
      ],
      base_success_rate: 55,
      base_payout_min: 5000,
      base_payout_max: 25000,
      heat_gain: 30,
      energy_cost: 25,
      nerve_cost: 20,
      cooldown_seconds: 43200,
      min_level: 15,
      location_type: 'district'
    },

    // ORGANIZED SCHEMES
    {
      id: 'home_invasion',
      name: 'Home Invasion',
      category: 'organized',
      description: 'Scout wealthy homes, plan entry points, execute while owners away.',
      requirements: { min_strength: 30, min_dexterity: 30 },
      phases: [
        { name: 'Scout Target', description: 'Watch house, learn patterns', success_rate_mod: 15, cost: 0 },
        { name: 'Plan Entry', description: 'Identify vulnerabilities', success_rate_mod: 5, cost: 0 },
        { name: 'Disable Security', description: 'Cut power, jam alarms', success_rate_mod: -10, cost: 200 },
        { name: 'Enter & Search', description: 'Get in, find valuables', success_rate_mod: -15, cost: 0 },
        { name: 'Escape', description: 'Get out before cops arrive', success_rate_mod: -10, cost: 0 }
      ],
      base_success_rate: 55,
      base_payout_min: 3000,
      base_payout_max: 20000,
      heat_gain: 35,
      energy_cost: 30,
      nerve_cost: 25,
      cooldown_seconds: 14400,
      min_level: 12,
      location_type: 'district'
    },
    {
      id: 'warehouse_heist',
      name: 'Warehouse Heist',
      category: 'organized',
      description: 'Multi-crew operation to hit warehouse storing valuable goods.',
      requirements: { min_crew: 4, min_level: 20 },
      phases: [
        { name: 'Intel Gathering', description: 'Learn guard schedules, inventory', success_rate_mod: 15, cost: 500 },
        { name: 'Acquire Gear', description: 'Get tools, vehicles, comms', success_rate_mod: 10, cost: 2000 },
        { name: 'Position Crew', description: 'Everyone in place', success_rate_mod: 5, cost: 0 },
        { name: 'Breach', description: 'Enter the warehouse', success_rate_mod: -15, cost: 0 },
        { name: 'Neutralize Guards', description: 'Handle security quietly', success_rate_mod: -20, cost: 0 },
        { name: 'Load Truck', description: 'Move the goods', success_rate_mod: -10, cost: 0 },
        { name: 'Escape Route', description: 'Get away clean', success_rate_mod: -15, cost: 0 }
      ],
      base_success_rate: 45,
      base_payout_min: 20000,
      base_payout_max: 100000,
      heat_gain: 50,
      energy_cost: 40,
      nerve_cost: 35,
      cooldown_seconds: 172800,
      min_level: 20,
      crew_size_min: 4,
      crew_size_max: 8,
      location_type: 'specific_poi'
    },
    {
      id: 'protection_racket',
      name: 'Protection Racket',
      category: 'organized',
      description: 'Convince local businesses they need your "protection" services.',
      requirements: { min_strength: 35, min_charisma: 30, min_intimidation: 40 },
      phases: [
        { name: 'Identify Targets', description: 'Find vulnerable businesses', success_rate_mod: 15, cost: 0 },
        { name: 'Initial Contact', description: 'Make the offer they can\'t refuse', success_rate_mod: 0, cost: 0 },
        { name: 'Demonstrate Need', description: 'Show what happens without protection', success_rate_mod: -20, cost: 500 },
        { name: 'Collect Payment', description: 'First of many payments', success_rate_mod: -5, cost: 0 }
      ],
      base_success_rate: 60,
      base_payout_min: 1000,
      base_payout_max: 5000,
      heat_gain: 20,
      energy_cost: 20,
      nerve_cost: 20,
      cooldown_seconds: 604800,
      min_level: 15,
      location_type: 'specific_poi'
    },
    {
      id: 'cargo_hijack',
      name: 'Cargo Hijack',
      category: 'organized',
      description: 'Intercept delivery trucks carrying valuable merchandise.',
      requirements: { min_strength: 30, min_dexterity: 25 },
      phases: [
        { name: 'Get Intel', description: 'Learn shipment routes and times', success_rate_mod: 10, cost: 1000 },
        { name: 'Setup Ambush', description: 'Position crew along route', success_rate_mod: 5, cost: 0 },
        { name: 'Stop Truck', description: 'Force driver to pull over', success_rate_mod: -15, cost: 0 },
        { name: 'Secure Driver', description: 'Handle the driver', success_rate_mod: -10, cost: 0 },
        { name: 'Transfer Cargo', description: 'Move goods to your vehicle', success_rate_mod: -10, cost: 0 },
        { name: 'Clean Escape', description: 'Disappear before response', success_rate_mod: -15, cost: 0 }
      ],
      base_success_rate: 50,
      base_payout_min: 10000,
      base_payout_max: 50000,
      heat_gain: 45,
      energy_cost: 35,
      nerve_cost: 30,
      cooldown_seconds: 86400,
      min_level: 18,
      crew_size_min: 2,
      crew_size_max: 5,
      location_type: 'district'
    },
    {
      id: 'money_mule_network',
      name: 'Money Mule Network',
      category: 'organized',
      description: 'Recruit people to launder money through their accounts for a cut.',
      requirements: { min_charisma: 40, min_intelligence: 35 },
      phases: [
        { name: 'Recruit Mules', description: 'Find desperate people needing cash', success_rate_mod: 15, cost: 0 },
        { name: 'Setup Accounts', description: 'Open accounts, prep transfers', success_rate_mod: 5, cost: 500 },
        { name: 'Run Money', description: 'Move funds through network', success_rate_mod: -10, cost: 0 },
        { name: 'Extract Clean', description: 'Pull out laundered money', success_rate_mod: -15, cost: 0 }
      ],
      base_success_rate: 65,
      base_payout_min: 5000,
      base_payout_max: 30000,
      heat_gain: 15,
      energy_cost: 15,
      nerve_cost: 10,
      cooldown_seconds: 259200,
      min_level: 12
    },

    // SOCIAL ENGINEERING
    {
      id: 'insurance_fraud',
      name: 'Insurance Fraud',
      category: 'social',
      description: 'Stage accidents or fake injuries to collect insurance payouts.',
      requirements: { min_charisma: 35 },
      phases: [
        { name: 'Setup Policy', description: 'Get proper insurance coverage', success_rate_mod: 20, cost: 500 },
        { name: 'Stage Incident', description: 'Create believable accident', success_rate_mod: 0, cost: 200 },
        { name: 'Document Damage', description: 'Get fake medical/repair reports', success_rate_mod: -5, cost: 1000 },
        { name: 'File Claim', description: 'Submit the fraudulent claim', success_rate_mod: -15, cost: 0 },
        { name: 'Beat Investigation', description: 'Pass adjuster scrutiny', success_rate_mod: -20, cost: 0 }
      ],
      base_success_rate: 55,
      base_payout_min: 5000,
      base_payout_max: 30000,
      heat_gain: 10,
      energy_cost: 15,
      nerve_cost: 10,
      cooldown_seconds: 604800,
      min_level: 10
    },
    {
      id: 'identity_theft',
      name: 'Identity Theft',
      category: 'social',
      description: 'Gather personal info, open accounts in victim\'s name, cash out.',
      requirements: { min_intelligence: 40 },
      phases: [
        { name: 'Gather PII', description: 'Get SSN, DOB, address', success_rate_mod: 10, cost: 200 },
        { name: 'Build Profile', description: 'Create complete identity package', success_rate_mod: 5, cost: 100 },
        { name: 'Open Accounts', description: 'Credit cards, loans', success_rate_mod: -10, cost: 0 },
        { name: 'Max Out', description: 'Spend to the limits', success_rate_mod: -15, cost: 0 },
        { name: 'Disappear', description: 'Close channels, move on', success_rate_mod: -5, cost: 0 }
      ],
      base_success_rate: 60,
      base_payout_min: 3000,
      base_payout_max: 25000,
      heat_gain: 20,
      energy_cost: 20,
      nerve_cost: 12,
      cooldown_seconds: 259200,
      min_level: 12
    },
    {
      id: 'contractor_scam',
      name: 'Contractor Scam',
      category: 'social',
      description: 'Pose as contractor, take deposits for work, never show up again.',
      requirements: { min_charisma: 45 },
      phases: [
        { name: 'Create Business', description: 'Fake license, website, reviews', success_rate_mod: 15, cost: 300 },
        { name: 'Find Marks', description: 'Target homeowners needing work', success_rate_mod: 10, cost: 100 },
        { name: 'Close Deal', description: 'Get signed contract', success_rate_mod: 0, cost: 0 },
        { name: 'Collect Deposit', description: '50% upfront is standard', success_rate_mod: -5, cost: 0 },
        { name: 'Vanish', description: 'Shut down, move on', success_rate_mod: -10, cost: 0 }
      ],
      base_success_rate: 70,
      base_payout_min: 2000,
      base_payout_max: 15000,
      heat_gain: 15,
      energy_cost: 15,
      nerve_cost: 8,
      cooldown_seconds: 86400,
      min_level: 8
    },
    {
      id: 'charity_fraud',
      name: 'Charity Fraud',
      category: 'social',
      description: 'Create fake charity, solicit donations, pocket everything.',
      requirements: { min_charisma: 50, min_intelligence: 35 },
      phases: [
        { name: 'Create Charity', description: 'Register fake 501c3', success_rate_mod: 15, cost: 500 },
        { name: 'Build Story', description: 'Create compelling cause', success_rate_mod: 10, cost: 200 },
        { name: 'Launch Campaign', description: 'GoFundMe, door-to-door', success_rate_mod: 0, cost: 500 },
        { name: 'Collect Donations', description: 'Let the money flow in', success_rate_mod: -5, cost: 0 },
        { name: 'Dissolve', description: 'Shut down before audited', success_rate_mod: -15, cost: 0 }
      ],
      base_success_rate: 65,
      base_payout_min: 5000,
      base_payout_max: 50000,
      heat_gain: 12,
      energy_cost: 20,
      nerve_cost: 10,
      cooldown_seconds: 604800,
      min_level: 15
    }
  ];

  for (const scheme of schemes) {
    await pool.query(`
      INSERT INTO schemes (id, name, category, description, requirements, phases,
        base_success_rate, base_payout_min, base_payout_max, heat_gain, energy_cost, nerve_cost,
        cooldown_seconds, min_level, crew_size_min, crew_size_max, location_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        requirements = EXCLUDED.requirements,
        phases = EXCLUDED.phases,
        base_success_rate = EXCLUDED.base_success_rate,
        base_payout_min = EXCLUDED.base_payout_min,
        base_payout_max = EXCLUDED.base_payout_max,
        heat_gain = EXCLUDED.heat_gain,
        energy_cost = EXCLUDED.energy_cost,
        nerve_cost = EXCLUDED.nerve_cost,
        cooldown_seconds = EXCLUDED.cooldown_seconds,
        min_level = EXCLUDED.min_level,
        crew_size_min = EXCLUDED.crew_size_min,
        crew_size_max = EXCLUDED.crew_size_max,
        location_type = EXCLUDED.location_type
    `, [
      scheme.id, scheme.name, scheme.category, scheme.description,
      JSON.stringify(scheme.requirements), JSON.stringify(scheme.phases),
      scheme.base_success_rate, scheme.base_payout_min, scheme.base_payout_max,
      scheme.heat_gain, scheme.energy_cost, scheme.nerve_cost,
      scheme.cooldown_seconds, scheme.min_level,
      scheme.crew_size_min || 1, scheme.crew_size_max || 1,
      scheme.location_type || 'any'
    ]);
  }
}

// Decay heat over time
async function decayHeat(playerId: number): Promise<number> {
  const result = await pool.query(`
    SELECT heat, last_heat_decay FROM players WHERE id = $1
  `, [playerId]);

  if (result.rows.length === 0) return 0;

  const { heat, last_heat_decay } = result.rows[0];
  const now = new Date();
  const lastDecay = new Date(last_heat_decay);
  const minutesPassed = Math.floor((now.getTime() - lastDecay.getTime()) / 60000);

  // Decay 1 heat per 5 minutes
  const decayAmount = Math.floor(minutesPassed / 5);
  const newHeat = Math.max(0, heat - decayAmount);

  if (decayAmount > 0) {
    await pool.query(`
      UPDATE players SET heat = $1, last_heat_decay = NOW() WHERE id = $2
    `, [newHeat, playerId]);
  }

  return newHeat;
}

// Get available schemes for player
router.get('/available', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player stats
    const playerResult = await pool.query(`
      SELECT level, cash, energy, nerve, heat,
             COALESCE((stats->>'strength')::int, 10) as strength,
             COALESCE((stats->>'dexterity')::int, 10) as dexterity,
             COALESCE((stats->>'intelligence')::int, 10) as intelligence,
             COALESCE((stats->>'charisma')::int, 10) as charisma,
             COALESCE((stats->>'intimidation')::int, 10) as intimidation
      FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const currentHeat = await decayHeat(playerId);

    // Get all active schemes
    const schemesResult = await pool.query(`
      SELECT s.*,
        sc.cooldown_until,
        ps.id as active_scheme_id,
        ps.current_phase,
        ps.status as active_status
      FROM schemes s
      LEFT JOIN scheme_cooldowns sc ON sc.scheme_id = s.id AND sc.player_id = $1
      LEFT JOIN player_schemes ps ON ps.scheme_id = s.id AND ps.player_id = $1 AND ps.status IN ('planning', 'in_progress')
      WHERE s.is_active = true
      ORDER BY s.category, s.min_level
    `, [playerId]);

    const schemes = schemesResult.rows.map(scheme => {
      const requirements = scheme.requirements || {};
      const meetsRequirements = {
        level: player.level >= scheme.min_level,
        cash: !requirements.min_cash || player.cash >= requirements.min_cash,
        strength: !requirements.min_strength || player.strength >= requirements.min_strength,
        dexterity: !requirements.min_dexterity || player.dexterity >= requirements.min_dexterity,
        intelligence: !requirements.min_intelligence || player.intelligence >= requirements.min_intelligence,
        charisma: !requirements.min_charisma || player.charisma >= requirements.min_charisma,
        intimidation: !requirements.min_intimidation || player.intimidation >= requirements.min_intimidation,
        energy: player.energy >= scheme.energy_cost,
        nerve: player.nerve >= scheme.nerve_cost
      };

      const isAvailable = Object.values(meetsRequirements).every(v => v);
      const onCooldown = scheme.cooldown_until && new Date(scheme.cooldown_until) > new Date();
      const isInProgress = scheme.active_scheme_id !== null;

      return {
        id: scheme.id,
        name: scheme.name,
        category: scheme.category,
        description: scheme.description,
        phases: scheme.phases,
        phaseCount: (scheme.phases || []).length,
        baseSuccessRate: scheme.base_success_rate,
        payoutRange: { min: scheme.base_payout_min, max: scheme.base_payout_max },
        heatGain: scheme.heat_gain,
        energyCost: scheme.energy_cost,
        nerveCost: scheme.nerve_cost,
        cooldownSeconds: scheme.cooldown_seconds,
        minLevel: scheme.min_level,
        crewSize: { min: scheme.crew_size_min, max: scheme.crew_size_max },
        locationType: scheme.location_type,
        requirements: scheme.requirements,
        meetsRequirements,
        isAvailable,
        onCooldown,
        cooldownUntil: scheme.cooldown_until,
        isInProgress,
        activeSchemeId: scheme.active_scheme_id,
        currentPhase: scheme.current_phase
      };
    });

    // Group by category
    const grouped = {
      digital: schemes.filter(s => s.category === 'digital'),
      street: schemes.filter(s => s.category === 'street'),
      organized: schemes.filter(s => s.category === 'organized'),
      social: schemes.filter(s => s.category === 'social')
    };

    res.json({
      success: true,
      data: {
        schemes: grouped,
        player: {
          level: player.level,
          cash: player.cash,
          energy: player.energy,
          nerve: player.nerve,
          heat: currentHeat,
          stats: {
            strength: player.strength,
            dexterity: player.dexterity,
            intelligence: player.intelligence,
            charisma: player.charisma,
            intimidation: player.intimidation
          }
        }
      }
    });
  } catch (error) {
    console.error('Error getting available schemes:', error);
    res.status(500).json({ success: false, error: 'Failed to get schemes' });
  }
});

// Start a new scheme
router.post('/:schemeId/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { schemeId } = req.params;
    const { targetPoiId, targetDistrictId } = req.body;

    // Get scheme details
    const schemeResult = await pool.query(`SELECT * FROM schemes WHERE id = $1 AND is_active = true`, [schemeId]);
    if (schemeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scheme not found' });
    }
    const scheme = schemeResult.rows[0];

    // Check if already has active scheme of this type
    const activeCheck = await pool.query(`
      SELECT id FROM player_schemes
      WHERE player_id = $1 AND scheme_id = $2 AND status IN ('planning', 'in_progress')
    `, [playerId, schemeId]);

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Already running this scheme' });
    }

    // Check cooldown
    const cooldownCheck = await pool.query(`
      SELECT cooldown_until FROM scheme_cooldowns
      WHERE player_id = $1 AND scheme_id = $2 AND cooldown_until > NOW()
    `, [playerId, schemeId]);

    if (cooldownCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Scheme on cooldown',
        cooldownUntil: cooldownCheck.rows[0].cooldown_until
      });
    }

    // Get player stats for validation
    const playerResult = await pool.query(`
      SELECT level, cash, energy, nerve,
             COALESCE((stats->>'strength')::int, 10) as strength,
             COALESCE((stats->>'dexterity')::int, 10) as dexterity,
             COALESCE((stats->>'intelligence')::int, 10) as intelligence,
             COALESCE((stats->>'charisma')::int, 10) as charisma,
             COALESCE((stats->>'intimidation')::int, 10) as intimidation
      FROM players WHERE id = $1
    `, [playerId]);
    const player = playerResult.rows[0];

    // Validate requirements
    const requirements = scheme.requirements || {};
    if (player.level < scheme.min_level) {
      return res.status(400).json({ success: false, error: `Requires level ${scheme.min_level}` });
    }
    if (requirements.min_cash && player.cash < requirements.min_cash) {
      return res.status(400).json({ success: false, error: `Requires $${requirements.min_cash} cash` });
    }
    if (player.energy < scheme.energy_cost) {
      return res.status(400).json({ success: false, error: 'Not enough energy' });
    }
    if (player.nerve < scheme.nerve_cost) {
      return res.status(400).json({ success: false, error: 'Not enough nerve' });
    }

    // Get first phase cost
    const phases = scheme.phases || [];
    const firstPhaseCost = phases[0]?.cost || 0;

    if (player.cash < firstPhaseCost) {
      return res.status(400).json({ success: false, error: `First phase requires $${firstPhaseCost}` });
    }

    // Create active scheme
    const insertResult = await pool.query(`
      INSERT INTO player_schemes (player_id, scheme_id, current_phase, target_poi_id, target_district_id, total_invested)
      VALUES ($1, $2, 0, $3, $4, $5)
      RETURNING id
    `, [playerId, schemeId, targetPoiId || null, targetDistrictId || null, firstPhaseCost]);

    // Deduct first phase cost
    if (firstPhaseCost > 0) {
      await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [firstPhaseCost, playerId]);
    }

    res.json({
      success: true,
      data: {
        activeSchemeId: insertResult.rows[0].id,
        scheme: {
          id: scheme.id,
          name: scheme.name,
          currentPhase: 0,
          totalPhases: phases.length,
          nextPhase: phases[0],
          invested: firstPhaseCost
        },
        message: `Started ${scheme.name}. Phase 1: ${phases[0]?.name || 'Unknown'}`
      }
    });
  } catch (error) {
    console.error('Error starting scheme:', error);
    res.status(500).json({ success: false, error: 'Failed to start scheme' });
  }
});

// Execute a phase
router.post('/:schemeId/phase/:phase', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { schemeId, phase } = req.params;
    const phaseNum = parseInt(phase);

    // Get active scheme
    const activeResult = await pool.query(`
      SELECT ps.*, s.phases, s.base_success_rate, s.base_payout_min, s.base_payout_max,
             s.heat_gain, s.energy_cost, s.nerve_cost, s.cooldown_seconds, s.name as scheme_name
      FROM player_schemes ps
      JOIN schemes s ON s.id = ps.scheme_id
      WHERE ps.player_id = $1 AND ps.scheme_id = $2 AND ps.status IN ('planning', 'in_progress')
    `, [playerId, schemeId]);

    if (activeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No active scheme found' });
    }

    const active = activeResult.rows[0];
    const phases = active.phases || [];

    // Validate phase number
    if (phaseNum !== active.current_phase) {
      return res.status(400).json({ success: false, error: `Must execute phase ${active.current_phase + 1} next` });
    }

    if (phaseNum >= phases.length) {
      return res.status(400).json({ success: false, error: 'Invalid phase' });
    }

    const currentPhase = phases[phaseNum];

    // Get player stats
    const playerResult = await pool.query(`
      SELECT level, cash, energy, nerve, heat,
             COALESCE((stats->>'intelligence')::int, 10) as intelligence,
             COALESCE((stats->>'dexterity')::int, 10) as dexterity,
             COALESCE((stats->>'charisma')::int, 10) as charisma,
             COALESCE((stats->>'luck')::int, 10) as luck
      FROM players WHERE id = $1
    `, [playerId]);
    const player = playerResult.rows[0];

    // Check energy/nerve for first phase only
    if (phaseNum === 0) {
      if (player.energy < active.energy_cost) {
        return res.status(400).json({ success: false, error: 'Not enough energy' });
      }
      if (player.nerve < active.nerve_cost) {
        return res.status(400).json({ success: false, error: 'Not enough nerve' });
      }
    }

    // Check phase cost
    const phaseCost = currentPhase.cost || 0;
    if (player.cash < phaseCost) {
      return res.status(400).json({ success: false, error: `Phase requires $${phaseCost}` });
    }

    // Calculate success rate with modifiers
    let successRate = active.base_success_rate + (currentPhase.success_rate_mod || 0);
    successRate += Math.floor(player.intelligence / 5); // +1% per 5 intelligence
    successRate += Math.floor(player.luck / 10); // +1% per 10 luck
    successRate -= Math.floor(player.heat / 10); // -1% per 10 heat
    successRate = Math.max(5, Math.min(95, successRate)); // Clamp 5-95%

    const roll = Math.random() * 100;
    const success = roll < successRate;

    // Deduct costs
    if (phaseCost > 0) {
      await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [phaseCost, playerId]);
    }

    // Deduct energy/nerve on first phase
    if (phaseNum === 0) {
      await pool.query(`
        UPDATE players SET energy = GREATEST(0, energy - $1), nerve = GREATEST(0, nerve - $2) WHERE id = $3
      `, [active.energy_cost, active.nerve_cost, playerId]);
    }

    // Update total invested
    await pool.query(`
      UPDATE player_schemes SET total_invested = total_invested + $1 WHERE id = $2
    `, [phaseCost, active.id]);

    if (success) {
      const isLastPhase = phaseNum === phases.length - 1;

      if (isLastPhase) {
        // Complete the scheme!
        const payoutMultiplier = 0.8 + (Math.random() * 0.4); // 80-120%
        const basePayout = active.base_payout_min + Math.random() * (active.base_payout_max - active.base_payout_min);
        const payout = Math.floor(basePayout * payoutMultiplier);

        // Add payout to player
        await pool.query(`
          UPDATE players SET cash = cash + $1, heat = LEAST(100, heat + $2) WHERE id = $3
        `, [payout, active.heat_gain, playerId]);

        // Mark scheme complete
        await pool.query(`
          UPDATE player_schemes SET status = 'completed', current_phase = $1 WHERE id = $2
        `, [phaseNum + 1, active.id]);

        // Record history
        await pool.query(`
          INSERT INTO scheme_history (player_id, scheme_id, outcome, phases_completed, payout, heat_gained)
          VALUES ($1, $2, 'success', $3, $4, $5)
        `, [playerId, schemeId, phases.length, payout, active.heat_gain]);

        // Set cooldown - SECURITY: Use make_interval for parameterized interval
        await pool.query(`
          INSERT INTO scheme_cooldowns (player_id, scheme_id, cooldown_until)
          VALUES ($1, $2, NOW() + make_interval(secs => $3))
          ON CONFLICT (player_id, scheme_id) DO UPDATE SET cooldown_until = NOW() + make_interval(secs => $3)
        `, [playerId, schemeId, active.cooldown_seconds]);

        // Maybe start investigation
        const investigationChance = active.heat_gain * 2;
        if (Math.random() * 100 < investigationChance) {
          await pool.query(`
            INSERT INTO investigations (player_id, crime_type, scheme_id, evidence_level)
            VALUES ($1, 'scheme', $2, $3)
          `, [playerId, schemeId, Math.floor(active.heat_gain / 2)]);
        }

        res.json({
          success: true,
          data: {
            phaseSuccess: true,
            schemeComplete: true,
            payout,
            heatGained: active.heat_gain,
            message: `${active.scheme_name} complete! Earned $${payout.toLocaleString()}`,
            newCash: player.cash - phaseCost + payout
          }
        });
      } else {
        // Move to next phase
        await pool.query(`
          UPDATE player_schemes SET current_phase = $1, status = 'in_progress', last_phase_at = NOW() WHERE id = $2
        `, [phaseNum + 1, active.id]);

        const nextPhase = phases[phaseNum + 1];

        res.json({
          success: true,
          data: {
            phaseSuccess: true,
            schemeComplete: false,
            currentPhase: phaseNum + 1,
            totalPhases: phases.length,
            nextPhase: {
              name: nextPhase.name,
              description: nextPhase.description,
              cost: nextPhase.cost || 0
            },
            message: `Phase ${phaseNum + 1} complete: ${currentPhase.name}. Next: ${nextPhase.name}`
          }
        });
      }
    } else {
      // Phase failed
      const failureHeat = Math.floor(active.heat_gain * (phaseNum + 1) / phases.length);
      const evidenceLeft = Math.floor(20 + phaseNum * 10 + Math.random() * 20);

      // Add partial heat
      await pool.query(`
        UPDATE players SET heat = LEAST(100, heat + $1) WHERE id = $2
      `, [failureHeat, playerId]);

      // Mark scheme failed
      await pool.query(`
        UPDATE player_schemes SET status = 'failed' WHERE id = $1
      `, [active.id]);

      // Record history
      await pool.query(`
        INSERT INTO scheme_history (player_id, scheme_id, outcome, phases_completed, heat_gained, evidence_left)
        VALUES ($1, $2, 'failed', $3, $4, $5)
      `, [playerId, schemeId, phaseNum, failureHeat, evidenceLeft]);

      // Higher chance of investigation on failure
      const investigationChance = 30 + phaseNum * 15;
      let arrested = false;

      if (Math.random() * 100 < investigationChance) {
        const investigationResult = await pool.query(`
          INSERT INTO investigations (player_id, crime_type, scheme_id, evidence_level)
          VALUES ($1, 'scheme', $2, $3)
          RETURNING id
        `, [playerId, schemeId, evidenceLeft]);

        // Generate witnesses
        const witnessCount = Math.floor(1 + Math.random() * 3);
        for (let i = 0; i < witnessCount; i++) {
          await pool.query(`
            INSERT INTO witnesses (investigation_id, name, evidence_value, bribe_cost, intimidation_difficulty)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            investigationResult.rows[0].id,
            `Witness ${i + 1}`,
            10 + Math.floor(Math.random() * 20),
            500 + Math.floor(Math.random() * 2000),
            30 + Math.floor(Math.random() * 40)
          ]);
        }
      }

      // Late phase failures might result in arrest
      if (phaseNum >= phases.length - 2 && Math.random() * 100 < 20) {
        arrested = true;
        // Jail time logic would go here
      }

      // Set cooldown (shorter on failure) - SECURITY: Use make_interval
      const failureCooldown = Math.floor(active.cooldown_seconds / 2);
      await pool.query(`
        INSERT INTO scheme_cooldowns (player_id, scheme_id, cooldown_until)
        VALUES ($1, $2, NOW() + make_interval(secs => $3))
        ON CONFLICT (player_id, scheme_id) DO UPDATE SET cooldown_until = NOW() + make_interval(secs => $3)
      `, [playerId, schemeId, failureCooldown]);

      res.json({
        success: true,
        data: {
          phaseSuccess: false,
          schemeComplete: true,
          outcome: 'failed',
          heatGained: failureHeat,
          evidenceLeft,
          arrested,
          moneyLost: active.total_invested + phaseCost,
          message: arrested
            ? `Busted during ${currentPhase.name}! You've been arrested.`
            : `Failed at ${currentPhase.name}. Lost $${(active.total_invested + phaseCost).toLocaleString()} invested.`
        }
      });
    }
  } catch (error) {
    console.error('Error executing phase:', error);
    res.status(500).json({ success: false, error: 'Failed to execute phase' });
  }
});

// Abort scheme
router.post('/:schemeId/abort', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { schemeId } = req.params;

    const activeResult = await pool.query(`
      SELECT ps.*, s.name as scheme_name, s.cooldown_seconds
      FROM player_schemes ps
      JOIN schemes s ON s.id = ps.scheme_id
      WHERE ps.player_id = $1 AND ps.scheme_id = $2 AND ps.status IN ('planning', 'in_progress')
    `, [playerId, schemeId]);

    if (activeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No active scheme to abort' });
    }

    const active = activeResult.rows[0];

    // Mark as aborted
    await pool.query(`UPDATE player_schemes SET status = 'aborted' WHERE id = $1`, [active.id]);

    // Record history
    await pool.query(`
      INSERT INTO scheme_history (player_id, scheme_id, outcome, phases_completed)
      VALUES ($1, $2, 'aborted', $3)
    `, [playerId, schemeId, active.current_phase]);

    // Shorter cooldown for abort - SECURITY: Use make_interval
    const abortCooldown = Math.floor(active.cooldown_seconds / 4);
    await pool.query(`
      INSERT INTO scheme_cooldowns (player_id, scheme_id, cooldown_until)
      VALUES ($1, $2, NOW() + make_interval(secs => $3))
      ON CONFLICT (player_id, scheme_id) DO UPDATE SET cooldown_until = NOW() + make_interval(secs => $3)
    `, [playerId, schemeId, abortCooldown]);

    res.json({
      success: true,
      data: {
        message: `Aborted ${active.scheme_name}. Lost $${active.total_invested.toLocaleString()} invested.`,
        moneyLost: active.total_invested
      }
    });
  } catch (error) {
    console.error('Error aborting scheme:', error);
    res.status(500).json({ success: false, error: 'Failed to abort scheme' });
  }
});

// Get active schemes
router.get('/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT ps.*, s.name, s.phases, s.category, s.description
      FROM player_schemes ps
      JOIN schemes s ON s.id = ps.scheme_id
      WHERE ps.player_id = $1 AND ps.status IN ('planning', 'in_progress')
      ORDER BY ps.started_at DESC
    `, [playerId]);

    const activeSchemes = result.rows.map(row => ({
      id: row.id,
      schemeId: row.scheme_id,
      name: row.name,
      category: row.category,
      description: row.description,
      currentPhase: row.current_phase,
      totalPhases: (row.phases || []).length,
      phases: row.phases,
      status: row.status,
      totalInvested: row.total_invested,
      startedAt: row.started_at,
      lastPhaseAt: row.last_phase_at
    }));

    res.json({ success: true, data: { activeSchemes } });
  } catch (error) {
    console.error('Error getting active schemes:', error);
    res.status(500).json({ success: false, error: 'Failed to get active schemes' });
  }
});

// Get scheme history
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await pool.query(`
      SELECT sh.*, s.name, s.category
      FROM scheme_history sh
      JOIN schemes s ON s.id = sh.scheme_id
      WHERE sh.player_id = $1
      ORDER BY sh.completed_at DESC
      LIMIT $2
    `, [playerId, limit]);

    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE outcome = 'success') as successes,
        COUNT(*) FILTER (WHERE outcome = 'failed') as failures,
        COUNT(*) FILTER (WHERE outcome = 'aborted') as aborts,
        COALESCE(SUM(payout), 0) as total_earnings,
        COALESCE(SUM(heat_gained), 0) as total_heat
      FROM scheme_history
      WHERE player_id = $1
    `, [playerId]);

    res.json({
      success: true,
      data: {
        history: result.rows,
        stats: stats.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting scheme history:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// ============ MAP EVENTS ============

// Get active map events
router.get('/events/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player heat to filter events
    const playerResult = await pool.query(`SELECT heat, current_district FROM players WHERE id = $1`, [playerId]);
    const player = playerResult.rows[0];
    const currentHeat = await decayHeat(playerId);

    // Get active events
    const eventsResult = await pool.query(`
      SELECT me.*, d.name as district_name,
        (SELECT COUNT(*) FROM jsonb_array_elements(me.participants)) as participant_count,
        EXISTS(SELECT 1 FROM event_participation ep WHERE ep.event_id = me.id AND ep.player_id = $1) as already_joined
      FROM map_events me
      LEFT JOIN districts d ON d.id = me.district_id
      WHERE me.is_active = true
        AND (me.end_time IS NULL OR me.end_time > NOW())
        AND me.heat_required_max >= $2
      ORDER BY me.start_time DESC
    `, [playerId, currentHeat]);

    const events = eventsResult.rows.map(event => ({
      id: event.id,
      type: event.event_type,
      title: event.title,
      description: event.description,
      district: event.district_name,
      districtId: event.district_id,
      location: event.latitude && event.longitude ? { lat: event.latitude, lng: event.longitude } : null,
      startTime: event.start_time,
      endTime: event.end_time,
      maxParticipants: event.max_participants,
      currentParticipants: parseInt(event.participant_count),
      difficulty: event.difficulty,
      rewards: event.rewards,
      alreadyJoined: event.already_joined
    }));

    res.json({ success: true, data: { events, playerHeat: currentHeat } });
  } catch (error) {
    console.error('Error getting map events:', error);
    res.status(500).json({ success: false, error: 'Failed to get events' });
  }
});

// Join map event
router.post('/events/:eventId/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const eventId = parseInt(req.params.eventId);

    // Get event
    const eventResult = await pool.query(`
      SELECT * FROM map_events WHERE id = $1 AND is_active = true
    `, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Check if already joined
    const joinedCheck = await pool.query(`
      SELECT id FROM event_participation WHERE player_id = $1 AND event_id = $2
    `, [playerId, eventId]);

    if (joinedCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Already joined this event' });
    }

    // Check participant limit
    const participants = event.participants || [];
    if (participants.length >= event.max_participants) {
      return res.status(400).json({ success: false, error: 'Event is full' });
    }

    // Check player heat
    const playerResult = await pool.query(`SELECT heat, username FROM players WHERE id = $1`, [playerId]);
    const player = playerResult.rows[0];
    const currentHeat = await decayHeat(playerId);

    if (currentHeat > event.heat_required_max) {
      return res.status(400).json({ success: false, error: 'Heat too high for this event' });
    }

    // Add participant
    await pool.query(`
      UPDATE map_events
      SET participants = participants || $1::jsonb
      WHERE id = $2
    `, [JSON.stringify({ playerId, username: player.username, joinedAt: new Date() }), eventId]);

    // Record participation
    await pool.query(`
      INSERT INTO event_participation (player_id, event_id) VALUES ($1, $2)
    `, [playerId, eventId]);

    // Determine outcome based on event type and difficulty
    const successChance = 80 - (event.difficulty * 10);
    const roll = Math.random() * 100;
    const success = roll < successChance;

    let rewards: { cash?: number; xp?: number; streetCred?: number } = {};
    let consequences: { heat?: number; injury?: boolean } = {};

    if (success) {
      const baseReward = event.rewards || {};
      rewards = {
        cash: baseReward.cash || Math.floor(500 + Math.random() * 1000 * event.difficulty),
        xp: baseReward.xp || Math.floor(50 + Math.random() * 50 * event.difficulty),
        streetCred: baseReward.street_cred || Math.floor(10 * event.difficulty)
      };

      // Apply rewards
      await pool.query(`
        UPDATE players
        SET cash = cash + $1, xp = xp + $2, street_cred = street_cred + $3
        WHERE id = $4
      `, [rewards.cash, rewards.xp, rewards.streetCred, playerId]);

      // Update participation
      await pool.query(`
        UPDATE event_participation SET outcome = 'success', rewards_claimed = $1 WHERE player_id = $2 AND event_id = $3
      `, [JSON.stringify(rewards), playerId, eventId]);
    } else {
      const baseConsequences = event.consequences || {};
      consequences = {
        heat: baseConsequences.heat || Math.floor(10 + event.difficulty * 5),
        injury: Math.random() < 0.3
      };

      await pool.query(`
        UPDATE players SET heat = LEAST(100, heat + $1) WHERE id = $2
      `, [consequences.heat, playerId]);

      await pool.query(`
        UPDATE event_participation SET outcome = 'failed' WHERE player_id = $1 AND event_id = $2
      `, [playerId, eventId]);
    }

    res.json({
      success: true,
      data: {
        eventJoined: true,
        outcome: success ? 'success' : 'failed',
        rewards: success ? rewards : null,
        consequences: success ? null : consequences,
        message: success
          ? `Success! Earned $${rewards.cash?.toLocaleString()}, ${rewards.xp} XP`
          : `Failed! Gained ${consequences.heat} heat${consequences.injury ? ' and got injured' : ''}`
      }
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ success: false, error: 'Failed to join event' });
  }
});

// ============ HEAT & INVESTIGATIONS ============

// Get heat status
router.get('/heat/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const currentHeat = await decayHeat(playerId);

    // Get active investigations
    const investigationsResult = await pool.query(`
      SELECT i.*, s.name as scheme_name,
        (SELECT json_agg(w.*) FROM witnesses w WHERE w.investigation_id = i.id AND NOT w.is_eliminated AND NOT w.is_silenced) as witnesses
      FROM investigations i
      LEFT JOIN schemes s ON s.id = i.scheme_id
      WHERE i.player_id = $1 AND i.status = 'active'
      ORDER BY i.evidence_level DESC
    `, [playerId]);

    // Determine heat level effects
    let heatStatus = 'low';
    let effects: string[] = [];

    if (currentHeat > 75) {
      heatStatus = 'manhunt';
      effects = ['Cannot enter government buildings', 'Police actively searching', 'Restricted travel'];
    } else if (currentHeat > 50) {
      heatStatus = 'investigation';
      effects = ['Undercover surveillance possible', 'Random checks more likely'];
    } else if (currentHeat > 25) {
      heatStatus = 'elevated';
      effects = ['Police may stop you', 'Increased scrutiny'];
    }

    res.json({
      success: true,
      data: {
        heat: currentHeat,
        heatStatus,
        effects,
        investigations: investigationsResult.rows.map(inv => ({
          id: inv.id,
          crimeType: inv.crime_type,
          schemeName: inv.scheme_name,
          evidenceLevel: inv.evidence_level,
          progress: inv.investigator_progress,
          arrestThreshold: inv.will_arrest_at,
          witnesses: inv.witnesses || [],
          startedAt: inv.started_at
        })),
        decayRate: '1 heat per 5 minutes'
      }
    });
  } catch (error) {
    console.error('Error getting heat status:', error);
    res.status(500).json({ success: false, error: 'Failed to get heat status' });
  }
});

// Reduce heat actions
router.post('/heat/reduce', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { action, targetId } = req.body;

    const playerResult = await pool.query(`SELECT cash, heat FROM players WHERE id = $1`, [playerId]);
    const player = playerResult.rows[0];

    let heatReduced = 0;
    let cost = 0;
    let message = '';

    switch (action) {
      case 'lay_low':
        // Free but takes time (just triggers decay check)
        heatReduced = 5;
        message = 'Laying low. Heat will decay naturally.';
        break;

      case 'bribe_cop':
        cost = 1000 + Math.floor(player.heat * 50);
        if (player.cash < cost) {
          return res.status(400).json({ success: false, error: `Requires $${cost} to bribe` });
        }
        heatReduced = 15 + Math.floor(Math.random() * 10);
        await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [cost, playerId]);
        message = `Bribed local cop. Cost: $${cost.toLocaleString()}`;
        break;

      case 'destroy_evidence':
        // Reduce evidence on investigation
        if (!targetId) {
          return res.status(400).json({ success: false, error: 'Must specify investigation' });
        }
        const invResult = await pool.query(`
          SELECT evidence_level FROM investigations WHERE id = $1 AND player_id = $2 AND status = 'active'
        `, [targetId, playerId]);
        if (invResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Investigation not found' });
        }
        const evidenceReduced = 10 + Math.floor(Math.random() * 15);
        await pool.query(`
          UPDATE investigations SET evidence_level = GREATEST(0, evidence_level - $1) WHERE id = $2
        `, [evidenceReduced, targetId]);
        message = `Destroyed evidence. Reduced by ${evidenceReduced} points.`;
        break;

      case 'bribe_witness':
        if (!targetId) {
          return res.status(400).json({ success: false, error: 'Must specify witness' });
        }
        const witnessResult = await pool.query(`
          SELECT w.*, i.player_id FROM witnesses w
          JOIN investigations i ON i.id = w.investigation_id
          WHERE w.id = $1 AND i.player_id = $2 AND NOT w.is_silenced AND NOT w.is_eliminated
        `, [targetId, playerId]);
        if (witnessResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Witness not found' });
        }
        const witness = witnessResult.rows[0];
        if (!witness.can_bribe) {
          return res.status(400).json({ success: false, error: 'Witness cannot be bribed' });
        }
        if (player.cash < witness.bribe_cost) {
          return res.status(400).json({ success: false, error: `Requires $${witness.bribe_cost}` });
        }
        await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [witness.bribe_cost, playerId]);
        await pool.query(`UPDATE witnesses SET is_silenced = true WHERE id = $1`, [targetId]);
        await pool.query(`
          UPDATE investigations SET evidence_level = GREATEST(0, evidence_level - $1) WHERE id = $2
        `, [witness.evidence_value, witness.investigation_id]);
        cost = witness.bribe_cost;
        message = `Bribed witness. Cost: $${cost.toLocaleString()}`;
        break;

      case 'intimidate_witness':
        if (!targetId) {
          return res.status(400).json({ success: false, error: 'Must specify witness' });
        }
        const intWitnessResult = await pool.query(`
          SELECT w.*, i.player_id FROM witnesses w
          JOIN investigations i ON i.id = w.investigation_id
          WHERE w.id = $1 AND i.player_id = $2 AND NOT w.is_silenced AND NOT w.is_eliminated
        `, [targetId, playerId]);
        if (intWitnessResult.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Witness not found' });
        }
        const intWitness = intWitnessResult.rows[0];
        if (!intWitness.can_intimidate) {
          return res.status(400).json({ success: false, error: 'Witness cannot be intimidated' });
        }
        // Intimidation check
        const intPlayerResult = await pool.query(`
          SELECT COALESCE((stats->>'intimidation')::int, 10) as intimidation FROM players WHERE id = $1
        `, [playerId]);
        const intSuccess = Math.random() * 100 < (intPlayerResult.rows[0].intimidation + 50 - intWitness.intimidation_difficulty);
        if (intSuccess) {
          await pool.query(`UPDATE witnesses SET is_silenced = true WHERE id = $1`, [targetId]);
          await pool.query(`
            UPDATE investigations SET evidence_level = GREATEST(0, evidence_level - $1) WHERE id = $2
          `, [intWitness.evidence_value, intWitness.investigation_id]);
          message = 'Successfully intimidated witness.';
        } else {
          heatReduced = -10; // Increases heat on failure
          message = 'Intimidation failed. Witness reported you.';
        }
        break;

      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    if (heatReduced !== 0) {
      await pool.query(`
        UPDATE players SET heat = GREATEST(0, LEAST(100, heat - $1)) WHERE id = $2
      `, [heatReduced, playerId]);
    }

    const newHeat = await decayHeat(playerId);

    res.json({
      success: true,
      data: {
        action,
        heatChange: heatReduced,
        cost,
        newHeat,
        message
      }
    });
  } catch (error) {
    console.error('Error reducing heat:', error);
    res.status(500).json({ success: false, error: 'Failed to reduce heat' });
  }
});

// Spawn random map events (called periodically)
export async function spawnMapEvents() {
  try {
    // Get districts
    const districtsResult = await pool.query(`SELECT id, name FROM districts`);
    const districts = districtsResult.rows;

    if (districts.length === 0) return;

    const eventTypes = [
      { type: 'gang_activity', title: 'Gang Activity Spotted', difficulty: 2, maxHeat: 100 },
      { type: 'police_patrol', title: 'Heavy Police Presence', difficulty: 1, maxHeat: 50 },
      { type: 'vip_movement', title: 'VIP Movement', difficulty: 3, maxHeat: 75 },
      { type: 'shipment_arrival', title: 'Shipment Incoming', difficulty: 2, maxHeat: 100 },
      { type: 'informant_available', title: 'Informant Spotted', difficulty: 1, maxHeat: 60 },
      { type: 'turf_dispute', title: 'Turf War Breaking Out', difficulty: 3, maxHeat: 100 }
    ];

    // Spawn 1-3 events
    const numEvents = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numEvents; i++) {
      const district = districts[Math.floor(Math.random() * districts.length)];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      const descriptions: Record<string, string> = {
        gang_activity: `Rival gang spotted in ${district.name}. Opportunity to intercept or join.`,
        police_patrol: `Heavy police presence in ${district.name}. Stay clear or bribe your way through.`,
        vip_movement: `High-value target traveling through ${district.name}. Rob or protect for reward.`,
        shipment_arrival: `Valuable shipment arriving in ${district.name}. First come, first served.`,
        informant_available: `Street informant in ${district.name} has valuable intel for sale.`,
        turf_dispute: `Two crews fighting over territory in ${district.name}. Pick a side.`
      };

      const rewards: Record<string, object> = {
        gang_activity: { cash: 2000, xp: 100, street_cred: 20 },
        police_patrol: { cash: 500, xp: 50, intel: true },
        vip_movement: { cash: 5000, xp: 200, street_cred: 50 },
        shipment_arrival: { cash: 3000, xp: 150, items: true },
        informant_available: { cash: 0, xp: 75, intel: true },
        turf_dispute: { cash: 1500, xp: 100, territory_influence: 10 }
      };

      // Check if similar event already exists in district
      const existingCheck = await pool.query(`
        SELECT id FROM map_events
        WHERE district_id = $1 AND event_type = $2 AND is_active = true AND end_time > NOW()
      `, [district.id, eventType.type]);

      if (existingCheck.rows.length === 0) {
        await pool.query(`
          INSERT INTO map_events (event_type, title, description, district_id, end_time, difficulty, heat_required_max, rewards)
          VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes', $5, $6, $7)
        `, [
          eventType.type,
          eventType.title,
          descriptions[eventType.type],
          district.id,
          eventType.difficulty,
          eventType.maxHeat,
          JSON.stringify(rewards[eventType.type])
        ]);
      }
    }

    // Clean up old events
    await pool.query(`
      UPDATE map_events SET is_active = false WHERE end_time < NOW() AND is_active = true
    `);

    console.log(`Spawned ${numEvents} map events`);
  } catch (error) {
    console.error('Error spawning map events:', error);
  }
}

export default router;
