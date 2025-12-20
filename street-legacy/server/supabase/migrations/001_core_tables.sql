-- Street Legacy: Core Tables Migration
-- Migration: 001_core_tables
-- Description: Creates ENUMs, core tables (players, districts, properties, property_upgrades),
--              indexes, triggers, and initial constraints

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Starter build types for new players
CREATE TYPE starter_build_enum AS ENUM (
  'hustler',
  'entrepreneur',
  'community_kid'
);

-- Property classification types
CREATE TYPE property_type_enum AS ENUM (
  'empty',
  'residential',
  'commercial',
  'industrial'
);

-- Upgrade types that can be installed on properties
CREATE TYPE upgrade_type_enum AS ENUM (
  'security',
  'renovation',
  'expansion',
  'storage',
  'front'
);

-- =============================================================================
-- DISTRICTS TABLE (created first as players references it)
-- =============================================================================

CREATE TABLE districts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  total_parcels INT NOT NULL CHECK (total_parcels > 0),
  parcels_claimed INT DEFAULT 0 CHECK (parcels_claimed >= 0),
  difficulty INT NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
  base_property_price BIGINT NOT NULL CHECK (base_property_price > 0),
  economy_level INT DEFAULT 50 CHECK (economy_level >= 0 AND economy_level <= 100),
  police_presence INT DEFAULT 50 CHECK (police_presence >= 0 AND police_presence <= 100),
  crime_rate INT DEFAULT 50 CHECK (crime_rate >= 0 AND crime_rate <= 100),
  is_starter_district BOOLEAN DEFAULT FALSE,
  controlling_crew_id UUID, -- Will reference crews table later
  influence_score NUMERIC DEFAULT 0,
  map_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE districts IS 'Toronto districts/neighborhoods';
COMMENT ON COLUMN districts.id IS 'Unique district identifier (e.g., scarborough, downtown)';
COMMENT ON COLUMN districts.total_parcels IS 'Total number of property parcels available in district';
COMMENT ON COLUMN districts.parcels_claimed IS 'Number of parcels currently owned by players';
COMMENT ON COLUMN districts.difficulty IS 'District difficulty level (1=easiest, 5=hardest)';
COMMENT ON COLUMN districts.economy_level IS 'Economic activity level (0-100), affects business income';
COMMENT ON COLUMN districts.police_presence IS 'Police activity level (0-100), affects crime difficulty and heat';
COMMENT ON COLUMN districts.crime_rate IS 'Crime activity level (0-100), affects random events';
COMMENT ON COLUMN districts.controlling_crew_id IS 'Crew that controls this district (if any)';

-- =============================================================================
-- PLAYERS TABLE
-- =============================================================================

CREATE TABLE players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(50),
  starter_build starter_build_enum NOT NULL,

  -- Progression
  level INT DEFAULT 1 CHECK (level >= 1 AND level <= 50),
  xp BIGINT DEFAULT 0 CHECK (xp >= 0),

  -- Currency
  cash_balance BIGINT DEFAULT 0 CHECK (cash_balance >= 0),
  bank_balance BIGINT DEFAULT 0 CHECK (bank_balance >= 0),

  -- Reputation (0-1000 scale for granularity)
  rep_crime INT DEFAULT 0 CHECK (rep_crime >= 0 AND rep_crime <= 1000),
  rep_business INT DEFAULT 0 CHECK (rep_business >= 0 AND rep_business <= 1000),
  rep_family INT DEFAULT 0 CHECK (rep_family >= 0 AND rep_family <= 1000),

  -- Status
  heat_level INT DEFAULT 0 CHECK (heat_level >= 0 AND heat_level <= 100),
  energy INT DEFAULT 100 CHECK (energy >= 0 AND energy <= 200),
  max_energy INT DEFAULT 100 CHECK (max_energy >= 100 AND max_energy <= 200),
  energy_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Location
  home_district_id VARCHAR(50) NOT NULL,
  current_district_id VARCHAR(50) NOT NULL,

  -- Protection
  newbie_protected BOOLEAN DEFAULT TRUE,
  newbie_protection_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Moderation
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,

  -- Cooldowns
  last_crime_at TIMESTAMPTZ,
  last_job_at TIMESTAMPTZ,

  -- Statistics
  total_earnings BIGINT DEFAULT 0,
  total_spent BIGINT DEFAULT 0,
  properties_owned INT DEFAULT 0,
  crimes_committed INT DEFAULT 0,
  crimes_succeeded INT DEFAULT 0,

  -- Settings & metadata
  settings JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE players IS 'Player profiles linked to auth.users';
COMMENT ON COLUMN players.id IS 'References auth.users(id) from Supabase Auth';
COMMENT ON COLUMN players.username IS 'Unique player username (3-30 chars)';
COMMENT ON COLUMN players.starter_build IS 'Initial build chosen at character creation';
COMMENT ON COLUMN players.cash_balance IS 'Cash on hand (can be robbed)';
COMMENT ON COLUMN players.bank_balance IS 'Banked cash (safe from robbery)';
COMMENT ON COLUMN players.rep_crime IS 'Criminal reputation (0-1000)';
COMMENT ON COLUMN players.rep_business IS 'Business reputation (0-1000)';
COMMENT ON COLUMN players.rep_family IS 'Family/community reputation (0-1000)';
COMMENT ON COLUMN players.heat_level IS 'Police attention level (0-100, jail at 100)';
COMMENT ON COLUMN players.energy IS 'Current energy for actions';
COMMENT ON COLUMN players.energy_updated_at IS 'Last time energy was calculated (for regen)';
COMMENT ON COLUMN players.newbie_protected IS 'Whether player has newbie protection active';

-- =============================================================================
-- PROPERTIES TABLE
-- =============================================================================

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  parcel_code VARCHAR(20) NOT NULL,
  owner_id UUID REFERENCES players(id) ON DELETE SET NULL,

  -- Property details
  name VARCHAR(100),
  property_type property_type_enum DEFAULT 'empty',

  -- Value
  base_value BIGINT NOT NULL CHECK (base_value > 0),
  current_value BIGINT NOT NULL CHECK (current_value > 0),
  purchase_price BIGINT,

  -- Status
  condition INT DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  upgrade_level INT DEFAULT 0 CHECK (upgrade_level >= 0 AND upgrade_level <= 10),
  has_business BOOLEAN DEFAULT FALSE,

  -- Market
  is_for_sale BOOLEAN DEFAULT FALSE,
  sale_price BIGINT,

  -- Financial
  is_mortgaged BOOLEAN DEFAULT FALSE,
  heat_level INT DEFAULT 0 CHECK (heat_level >= 0 AND heat_level <= 100),
  last_tax_paid_at TIMESTAMPTZ,

  -- Ownership tracking
  claimed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(district_id, parcel_code)
);

COMMENT ON TABLE properties IS 'Purchasable parcels within districts';
COMMENT ON COLUMN properties.parcel_code IS 'Unique code within district (e.g., A1, B12)';
COMMENT ON COLUMN properties.base_value IS 'Original property value (for tax calculation)';
COMMENT ON COLUMN properties.current_value IS 'Current market value (affected by upgrades, area)';
COMMENT ON COLUMN properties.purchase_price IS 'Price paid when purchased (NULL if unclaimed)';
COMMENT ON COLUMN properties.condition IS 'Property condition (0-100), affects income and value';
COMMENT ON COLUMN properties.upgrade_level IS 'Total upgrade level (0-10)';
COMMENT ON COLUMN properties.heat_level IS 'Police attention on this property (for illegal businesses)';

-- =============================================================================
-- PROPERTY UPGRADES TABLE
-- =============================================================================

CREATE TABLE property_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  upgrade_type upgrade_type_enum NOT NULL,
  level INT DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  cost_paid BIGINT NOT NULL,
  effect_metadata JSONB DEFAULT '{}'::jsonb,
  installed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each property can only have one of each upgrade type
  UNIQUE(property_id, upgrade_type)
);

COMMENT ON TABLE property_upgrades IS 'Upgrades installed on properties';
COMMENT ON COLUMN property_upgrades.upgrade_type IS 'Type of upgrade (security, renovation, etc.)';
COMMENT ON COLUMN property_upgrades.level IS 'Upgrade level (1-5)';
COMMENT ON COLUMN property_upgrades.cost_paid IS 'Amount paid for this upgrade';
COMMENT ON COLUMN property_upgrades.effect_metadata IS 'JSON containing upgrade-specific effects';

-- =============================================================================
-- FOREIGN KEYS FOR PLAYERS (added after districts exists)
-- =============================================================================

ALTER TABLE players
  ADD CONSTRAINT fk_players_home_district
  FOREIGN KEY (home_district_id) REFERENCES districts(id);

ALTER TABLE players
  ADD CONSTRAINT fk_players_current_district
  FOREIGN KEY (current_district_id) REFERENCES districts(id);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Players indexes
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_level ON players(level);
CREATE INDEX idx_players_home_district ON players(home_district_id);
CREATE INDEX idx_players_current_district ON players(current_district_id);
CREATE INDEX idx_players_created_at ON players(created_at);
CREATE INDEX idx_players_heat_level ON players(heat_level) WHERE heat_level > 0;
CREATE INDEX idx_players_newbie_protected ON players(newbie_protected) WHERE newbie_protected = TRUE;

-- Districts indexes
CREATE INDEX idx_districts_difficulty ON districts(difficulty);
CREATE INDEX idx_districts_is_starter ON districts(is_starter_district);
CREATE INDEX idx_districts_controlling_crew ON districts(controlling_crew_id) WHERE controlling_crew_id IS NOT NULL;

-- Properties indexes
CREATE INDEX idx_properties_district ON properties(district_id);
CREATE INDEX idx_properties_owner ON properties(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_properties_for_sale ON properties(is_for_sale) WHERE is_for_sale = TRUE;
CREATE INDEX idx_properties_unclaimed ON properties(district_id) WHERE owner_id IS NULL;
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_has_business ON properties(has_business) WHERE has_business = TRUE;

-- Property upgrades indexes
CREATE INDEX idx_property_upgrades_property ON property_upgrades(property_id);
CREATE INDEX idx_property_upgrades_type ON property_upgrades(upgrade_type);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_districts_updated_at
  BEFORE UPDATE ON districts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update parcels_claimed count when property ownership changes
CREATE OR REPLACE FUNCTION update_district_parcels_claimed()
RETURNS TRIGGER AS $$
BEGIN
  -- If owner changed from NULL to a player (property claimed)
  IF OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    UPDATE districts
    SET parcels_claimed = parcels_claimed + 1
    WHERE id = NEW.district_id;
  -- If owner changed from a player to NULL (property released)
  ELSIF OLD.owner_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    UPDATE districts
    SET parcels_claimed = parcels_claimed - 1
    WHERE id = NEW.district_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parcels_claimed
  AFTER UPDATE OF owner_id ON properties
  FOR EACH ROW EXECUTE FUNCTION update_district_parcels_claimed();

-- Function to update player's properties_owned count
CREATE OR REPLACE FUNCTION update_player_properties_owned()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrease count for old owner
  IF OLD.owner_id IS NOT NULL THEN
    UPDATE players
    SET properties_owned = properties_owned - 1
    WHERE id = OLD.owner_id;
  END IF;

  -- Increase count for new owner
  IF NEW.owner_id IS NOT NULL THEN
    UPDATE players
    SET properties_owned = properties_owned + 1
    WHERE id = NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_owned
  AFTER UPDATE OF owner_id ON properties
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION update_player_properties_owned();

-- Also handle INSERT for initial property claims
CREATE OR REPLACE FUNCTION handle_property_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    -- Update player's properties_owned count
    UPDATE players
    SET properties_owned = properties_owned + 1
    WHERE id = NEW.owner_id;

    -- Update district's parcels_claimed count
    UPDATE districts
    SET parcels_claimed = parcels_claimed + 1
    WHERE id = NEW.district_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_property_insert_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  WHEN (NEW.owner_id IS NOT NULL)
  EXECUTE FUNCTION handle_property_insert();

-- =============================================================================
-- VALIDATION CONSTRAINTS
-- =============================================================================

-- Ensure sale_price is set when property is for sale
ALTER TABLE properties
  ADD CONSTRAINT chk_sale_price_required
  CHECK (
    (is_for_sale = FALSE) OR
    (is_for_sale = TRUE AND sale_price IS NOT NULL AND sale_price > 0)
  );

-- Ensure parcels_claimed doesn't exceed total_parcels
ALTER TABLE districts
  ADD CONSTRAINT chk_parcels_not_exceeded
  CHECK (parcels_claimed <= total_parcels);

-- Ensure energy doesn't exceed max_energy
ALTER TABLE players
  ADD CONSTRAINT chk_energy_not_exceeded
  CHECK (energy <= max_energy);
