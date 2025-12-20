-- =====================================================
-- PHASE 7: PROPERTY SYSTEM AND REAL ESTATE EMPIRE
-- =====================================================

-- =====================================================
-- PROPERTY LISTINGS (Available properties for purchase)
-- =====================================================

CREATE TABLE IF NOT EXISTS property_listings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  property_type VARCHAR(30) NOT NULL CHECK (property_type IN (
    -- Residential
    'apartment', 'condo', 'house', 'mansion', 'penthouse',
    -- Commercial
    'corner_store', 'restaurant', 'nightclub', 'car_wash', 'strip_mall',
    -- Industrial
    'warehouse', 'garage', 'dock_access', 'factory',
    -- Illegal
    'trap_house', 'chop_shop', 'safehouse', 'underground_bunker'
  )),
  category VARCHAR(20) NOT NULL CHECK (category IN ('residential', 'commercial', 'industrial', 'illegal')),
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,

  -- Location
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  address VARCHAR(200),

  -- Pricing
  base_price INTEGER NOT NULL,
  clean_money_required INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 1,

  -- Base stats
  base_income_per_hour INTEGER NOT NULL DEFAULT 0,
  base_storage_capacity INTEGER NOT NULL DEFAULT 0,
  base_heat_reduction INTEGER NOT NULL DEFAULT 0,
  base_influence_bonus INTEGER NOT NULL DEFAULT 0,

  -- Capacity
  upgrade_slots INTEGER NOT NULL DEFAULT 3,
  vehicle_slots INTEGER NOT NULL DEFAULT 0,
  staff_slots INTEGER NOT NULL DEFAULT 0,

  -- Capabilities
  can_launder_money BOOLEAN NOT NULL DEFAULT FALSE,
  can_manufacture BOOLEAN NOT NULL DEFAULT FALSE,
  can_store_vehicles BOOLEAN NOT NULL DEFAULT FALSE,
  can_be_crew_hq BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,

  -- Availability
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(district_id, name)
);

-- =====================================================
-- OWNED PROPERTIES
-- =====================================================

CREATE TABLE IF NOT EXISTS owned_properties (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Purchase info
  purchase_price INTEGER NOT NULL,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Current state
  custom_name VARCHAR(100),
  condition INTEGER NOT NULL DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  last_maintained TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Upgrades (JSONB array of upgrade IDs and their state)
  installed_upgrades JSONB NOT NULL DEFAULT '[]',

  -- Income tracking
  total_income_earned INTEGER NOT NULL DEFAULT 0,
  last_income_collected TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Staff
  has_property_manager BOOLEAN NOT NULL DEFAULT FALSE,
  manager_fee_per_day INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_crew_hq BOOLEAN NOT NULL DEFAULT FALSE,
  is_raided BOOLEAN NOT NULL DEFAULT FALSE,
  raid_lockout_until TIMESTAMP,

  UNIQUE(listing_id, owner_id)
);

-- =====================================================
-- PROPERTY UPGRADE TYPES
-- =====================================================

CREATE TABLE IF NOT EXISTS property_upgrade_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('security', 'income', 'storage', 'operations', 'special')),

  -- Which property types can use this upgrade
  applicable_types TEXT[] NOT NULL DEFAULT '{}',
  applicable_categories TEXT[] NOT NULL DEFAULT '{}',

  -- Cost and requirements
  cost INTEGER NOT NULL,
  monthly_cost INTEGER NOT NULL DEFAULT 0,
  min_level INTEGER NOT NULL DEFAULT 1,
  required_upgrade_id INTEGER REFERENCES property_upgrade_types(id),

  -- Effects (stored as JSONB for flexibility)
  effects JSONB NOT NULL DEFAULT '{}',
  -- Example effects:
  -- {"raid_resistance": 10, "income_multiplier": 1.25, "storage_bonus": 50, "heat_reduction": 5}

  -- Installation
  install_time_hours INTEGER NOT NULL DEFAULT 1,

  -- Visual
  icon VARCHAR(10) DEFAULT '🔧'
);

-- =====================================================
-- INSTALLED UPGRADES (tracking for properties)
-- =====================================================

CREATE TABLE IF NOT EXISTS property_upgrades (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,
  upgrade_type_id INTEGER NOT NULL REFERENCES property_upgrade_types(id) ON DELETE CASCADE,

  -- Installation tracking
  installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  installing_until TIMESTAMP, -- NULL if installation complete

  -- For recurring cost upgrades
  last_payment TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE(property_id, upgrade_type_id)
);

-- =====================================================
-- PROPERTY OPERATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS property_operations (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,
  operation_type VARCHAR(30) NOT NULL CHECK (operation_type IN (
    'money_laundering', 'drug_manufacturing', 'weapon_storage',
    'vehicle_chopping', 'smuggling', 'counterfeiting', 'protection_racket'
  )),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'busted')),

  -- Configuration
  intensity INTEGER NOT NULL DEFAULT 1 CHECK (intensity >= 1 AND intensity <= 5),
  -- Higher intensity = more income but more heat

  -- Tracking
  started_at TIMESTAMP,
  last_payout TIMESTAMP,
  total_revenue INTEGER NOT NULL DEFAULT 0,
  total_heat_generated INTEGER NOT NULL DEFAULT 0,

  -- Heat from this operation
  current_heat INTEGER NOT NULL DEFAULT 0,

  UNIQUE(property_id, operation_type)
);

-- =====================================================
-- PROPERTY STAFF
-- =====================================================

CREATE TABLE IF NOT EXISTS property_staff (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,

  staff_type VARCHAR(30) NOT NULL CHECK (staff_type IN (
    'manager', 'security_guard', 'cleaner', 'accountant', 'cook', 'bouncer', 'mechanic'
  )),

  -- NPC reference (optional - could be a named NPC)
  npc_name VARCHAR(100),

  -- Cost and effectiveness
  daily_salary INTEGER NOT NULL,
  effectiveness INTEGER NOT NULL DEFAULT 50 CHECK (effectiveness >= 1 AND effectiveness <= 100),

  -- Status
  hired_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_paid TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================
-- PROPERTY RAIDS
-- =====================================================

CREATE TABLE IF NOT EXISTS property_raids (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,

  -- Raid details
  raid_type VARCHAR(20) NOT NULL CHECK (raid_type IN ('police', 'rival_crew', 'random')),
  triggered_by VARCHAR(50), -- What caused the raid

  -- Outcome
  raid_success BOOLEAN,
  defense_rating INTEGER, -- What defense level the property had

  -- Losses
  cash_seized INTEGER NOT NULL DEFAULT 0,
  inventory_seized JSONB DEFAULT '[]',
  products_seized JSONB DEFAULT '[]',

  -- Consequences
  arrests_made INTEGER NOT NULL DEFAULT 0,
  property_damage INTEGER NOT NULL DEFAULT 0, -- Condition loss
  operations_busted JSONB DEFAULT '[]',

  -- Timing
  raided_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Evidence/heat
  heat_generated INTEGER NOT NULL DEFAULT 0,
  evidence_found JSONB DEFAULT '{}'
);

-- =====================================================
-- PROPERTY INVENTORY (Items stored at properties)
-- =====================================================

CREATE TABLE IF NOT EXISTS property_inventory (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,

  item_type VARCHAR(30) NOT NULL CHECK (item_type IN (
    'cash', 'product', 'weapon', 'vehicle', 'equipment', 'contraband'
  )),
  item_id INTEGER, -- Reference to specific item if applicable

  quantity INTEGER NOT NULL DEFAULT 1,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE, -- In hidden compartment

  stored_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(property_id, item_type, item_id)
);

-- =====================================================
-- PROPERTY INCOME LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS property_income_log (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,

  income_type VARCHAR(30) NOT NULL CHECK (income_type IN (
    'passive', 'operation', 'laundering', 'special_event'
  )),

  amount INTEGER NOT NULL,
  is_clean_money BOOLEAN NOT NULL DEFAULT FALSE,

  source_description TEXT,
  logged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PROPERTY MAINTENANCE LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS property_maintenance_log (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,

  maintenance_type VARCHAR(30) NOT NULL CHECK (maintenance_type IN (
    'repair', 'upgrade', 'manager_auto', 'decay'
  )),

  condition_before INTEGER NOT NULL,
  condition_after INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,

  performed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MONEY LAUNDERING TRANSACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS laundering_transactions (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES owned_properties(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  dirty_amount INTEGER NOT NULL,
  clean_amount INTEGER NOT NULL,
  fee_amount INTEGER NOT NULL,
  fee_percentage DECIMAL(5,2) NOT NULL,

  -- Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'seized')),
  processing_time_hours INTEGER NOT NULL DEFAULT 24,

  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Risk
  heat_generated INTEGER NOT NULL DEFAULT 0,
  was_detected BOOLEAN NOT NULL DEFAULT FALSE
);

-- =====================================================
-- INDEXES FOR PHASE 7
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_property_listings_district ON property_listings(district_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_type ON property_listings(property_type);
CREATE INDEX IF NOT EXISTS idx_property_listings_category ON property_listings(category);
CREATE INDEX IF NOT EXISTS idx_property_listings_available ON property_listings(is_available, base_price);

CREATE INDEX IF NOT EXISTS idx_owned_properties_owner ON owned_properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_owned_properties_listing ON owned_properties(listing_id);
CREATE INDEX IF NOT EXISTS idx_owned_properties_condition ON owned_properties(condition);

CREATE INDEX IF NOT EXISTS idx_property_upgrades_property ON property_upgrades(property_id);
CREATE INDEX IF NOT EXISTS idx_property_operations_property ON property_operations(property_id, status);
CREATE INDEX IF NOT EXISTS idx_property_staff_property ON property_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_property_raids_property ON property_raids(property_id, raided_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_inventory_property ON property_inventory(property_id);
CREATE INDEX IF NOT EXISTS idx_property_income_log_property ON property_income_log(property_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_laundering_transactions_player ON laundering_transactions(player_id, status);
