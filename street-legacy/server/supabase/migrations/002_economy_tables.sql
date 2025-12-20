-- Street Legacy: Economy Tables Migration
-- Migration: 002_economy_tables
-- Description: Creates ENUMs and tables for businesses, crimes, jobs, transactions,
--              and player activity tracking

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Business category (legality level)
CREATE TYPE business_category_enum AS ENUM (
  'legit',
  'gray',
  'underground'
);

-- Business operational status
CREATE TYPE business_status_enum AS ENUM (
  'closed',
  'open',
  'raided',
  'suspended'
);

-- Crime category for grouping
CREATE TYPE crime_category_enum AS ENUM (
  'petty',
  'property',
  'violent',
  'organized'
);

-- Crime attempt outcomes
CREATE TYPE crime_result_enum AS ENUM (
  'success',
  'failure',
  'caught',
  'escaped'
);

-- Job category
CREATE TYPE job_category_enum AS ENUM (
  'manual',
  'service',
  'professional'
);

-- Transaction domain (what system generated it)
CREATE TYPE transaction_domain_enum AS ENUM (
  'crime',
  'job',
  'business',
  'property',
  'trade',
  'bank',
  'system',
  'crew'
);

-- Currency types
CREATE TYPE currency_enum AS ENUM (
  'cash',
  'bank',
  'crypto',
  'tokens'
);

-- =============================================================================
-- BUSINESS TYPES TABLE (reference/lookup table)
-- =============================================================================

CREATE TABLE business_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category business_category_enum NOT NULL,
  setup_cost BIGINT NOT NULL CHECK (setup_cost > 0),
  income_per_hour BIGINT NOT NULL CHECK (income_per_hour >= 0),
  cost_per_hour BIGINT NOT NULL CHECK (cost_per_hour >= 0),
  max_employees INT NOT NULL CHECK (max_employees >= 0 AND max_employees <= 20),
  required_level INT NOT NULL CHECK (required_level >= 1 AND required_level <= 50),
  heat_generation INT DEFAULT 0 CHECK (heat_generation >= 0 AND heat_generation <= 100),
  required_rep_business INT DEFAULT 0 CHECK (required_rep_business >= 0),
  required_rep_crime INT DEFAULT 0 CHECK (required_rep_crime >= 0),
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE business_types IS 'Reference table for all business types available in game';
COMMENT ON COLUMN business_types.category IS 'Legality category: legit, gray, or underground';
COMMENT ON COLUMN business_types.heat_generation IS 'Heat generated per hour (for gray/underground)';

-- =============================================================================
-- CRIME TYPES TABLE (reference/lookup table)
-- =============================================================================

CREATE TABLE crime_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category crime_category_enum NOT NULL,
  required_level INT NOT NULL CHECK (required_level >= 1 AND required_level <= 50),
  payout_min BIGINT NOT NULL CHECK (payout_min >= 0),
  payout_max BIGINT NOT NULL CHECK (payout_max >= payout_min),
  success_rate INT NOT NULL CHECK (success_rate >= 0 AND success_rate <= 100),
  heat_min INT NOT NULL CHECK (heat_min >= 0),
  heat_max INT NOT NULL CHECK (heat_max >= heat_min AND heat_max <= 100),
  energy_cost INT NOT NULL CHECK (energy_cost > 0 AND energy_cost <= 100),
  cooldown_seconds INT NOT NULL CHECK (cooldown_seconds >= 0),
  allows_pvp BOOLEAN DEFAULT FALSE,
  has_minigame BOOLEAN DEFAULT FALSE,
  requires_weapon BOOLEAN DEFAULT FALSE,
  xp_reward INT DEFAULT 10 CHECK (xp_reward >= 0),
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE crime_types IS 'Reference table for all crime types available in game';
COMMENT ON COLUMN crime_types.success_rate IS 'Base success rate (0-100) before modifiers';
COMMENT ON COLUMN crime_types.allows_pvp IS 'Whether this crime can target other players';

-- =============================================================================
-- JOB TYPES TABLE (reference/lookup table)
-- =============================================================================

CREATE TABLE job_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category job_category_enum NOT NULL,
  required_level INT NOT NULL CHECK (required_level >= 1 AND required_level <= 50),
  payout BIGINT NOT NULL CHECK (payout > 0),
  energy_cost INT NOT NULL CHECK (energy_cost > 0 AND energy_cost <= 100),
  cooldown_seconds INT NOT NULL CHECK (cooldown_seconds >= 0),
  xp_reward INT DEFAULT 5 CHECK (xp_reward >= 0),
  required_rep_business INT DEFAULT 0 CHECK (required_rep_business >= 0),
  icon VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE job_types IS 'Reference table for all legal job types available in game';

-- =============================================================================
-- BUSINESSES TABLE (player-owned business instances)
-- =============================================================================

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  business_type_id VARCHAR(50) NOT NULL REFERENCES business_types(id),

  -- Business details
  name VARCHAR(100),
  status business_status_enum DEFAULT 'closed',

  -- Financials
  total_revenue BIGINT DEFAULT 0,
  total_expenses BIGINT DEFAULT 0,
  last_collection_at TIMESTAMPTZ,

  -- Staff
  employee_count INT DEFAULT 0 CHECK (employee_count >= 0),

  -- Status tracking
  heat_level INT DEFAULT 0 CHECK (heat_level >= 0 AND heat_level <= 100),
  times_raided INT DEFAULT 0,
  last_raided_at TIMESTAMPTZ,
  suspended_until TIMESTAMPTZ,

  -- Upgrades & improvements
  upgrade_level INT DEFAULT 0 CHECK (upgrade_level >= 0 AND upgrade_level <= 10),
  efficiency_bonus NUMERIC(5,2) DEFAULT 0.00,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE businesses IS 'Player-owned business instances';
COMMENT ON COLUMN businesses.efficiency_bonus IS 'Percentage bonus to income from upgrades';
COMMENT ON COLUMN businesses.suspended_until IS 'If suspended, when can it reopen';

-- =============================================================================
-- CRIME LOGS TABLE (player crime attempt history)
-- =============================================================================

CREATE TABLE crime_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  crime_type_id VARCHAR(50) NOT NULL REFERENCES crime_types(id),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id),

  -- Target (for PvP crimes)
  target_player_id UUID REFERENCES players(id) ON DELETE SET NULL,

  -- Outcome
  result crime_result_enum NOT NULL,
  payout BIGINT DEFAULT 0,
  heat_gained INT DEFAULT 0,
  xp_gained INT DEFAULT 0,

  -- Arrest info (if caught)
  jail_time_seconds INT DEFAULT 0,
  fine_amount BIGINT DEFAULT 0,

  -- Context
  energy_spent INT NOT NULL,
  success_roll INT,  -- The random number rolled (for debugging/fairness verification)

  -- Timestamps
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE crime_logs IS 'Log of all crime attempts by players';
COMMENT ON COLUMN crime_logs.success_roll IS 'Random roll value for transparency';

-- =============================================================================
-- JOB LOGS TABLE (player job completion history)
-- =============================================================================

CREATE TABLE job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  job_type_id VARCHAR(50) NOT NULL REFERENCES job_types(id),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id),

  -- Outcome
  payout BIGINT NOT NULL,
  xp_gained INT DEFAULT 0,
  energy_spent INT NOT NULL,

  -- Bonus info
  bonus_applied NUMERIC(5,2) DEFAULT 0.00,
  bonus_reason VARCHAR(100),

  -- Timestamps
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE job_logs IS 'Log of all job completions by players';

-- =============================================================================
-- TRANSACTIONS TABLE (all financial transactions)
-- =============================================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Transaction details
  domain transaction_domain_enum NOT NULL,
  currency currency_enum NOT NULL DEFAULT 'cash',
  amount BIGINT NOT NULL,  -- Positive = credit, Negative = debit
  balance_after BIGINT NOT NULL,

  -- Reference to source
  reference_id UUID,  -- Can reference crime_logs, job_logs, businesses, properties, etc.
  reference_type VARCHAR(50),  -- 'crime', 'job', 'business', 'property_purchase', etc.

  -- Other party (for trades, crew payments)
  counterparty_id UUID REFERENCES players(id) ON DELETE SET NULL,

  -- Description
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'Complete financial transaction history for all players';
COMMENT ON COLUMN transactions.amount IS 'Positive = money in, Negative = money out';
COMMENT ON COLUMN transactions.balance_after IS 'Balance after this transaction (for audit trail)';

-- =============================================================================
-- PLAYER COOLDOWNS TABLE (action cooldown tracking)
-- =============================================================================

CREATE TABLE player_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,  -- 'crime:pickpocket', 'job:delivery', etc.
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each player can only have one cooldown per action type
  UNIQUE(player_id, action_type)
);

COMMENT ON TABLE player_cooldowns IS 'Active cooldowns for player actions';
COMMENT ON COLUMN player_cooldowns.action_type IS 'Action identifier like crime:pickpocket or job:delivery';

-- =============================================================================
-- BUSINESS INCOME LOGS TABLE (periodic income collection)
-- =============================================================================

CREATE TABLE business_income_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Income calculation
  hours_elapsed NUMERIC(10,2) NOT NULL,
  gross_income BIGINT NOT NULL,
  operating_cost BIGINT NOT NULL,
  net_income BIGINT NOT NULL,

  -- Modifiers applied
  efficiency_bonus NUMERIC(5,2) DEFAULT 0.00,
  district_modifier NUMERIC(5,2) DEFAULT 0.00,

  -- Heat impact
  heat_generated INT DEFAULT 0,

  -- Timestamps
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE business_income_logs IS 'Log of business income collections';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Business types indexes
CREATE INDEX idx_business_types_category ON business_types(category);
CREATE INDEX idx_business_types_level ON business_types(required_level);

-- Crime types indexes
CREATE INDEX idx_crime_types_category ON crime_types(category);
CREATE INDEX idx_crime_types_level ON crime_types(required_level);

-- Job types indexes
CREATE INDEX idx_job_types_category ON job_types(category);
CREATE INDEX idx_job_types_level ON job_types(required_level);

-- Businesses indexes
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_property ON businesses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_businesses_type ON businesses(business_type_id);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_heat ON businesses(heat_level) WHERE heat_level > 0;

-- Crime logs indexes
CREATE INDEX idx_crime_logs_player ON crime_logs(player_id);
CREATE INDEX idx_crime_logs_type ON crime_logs(crime_type_id);
CREATE INDEX idx_crime_logs_district ON crime_logs(district_id);
CREATE INDEX idx_crime_logs_attempted_at ON crime_logs(attempted_at);
CREATE INDEX idx_crime_logs_target ON crime_logs(target_player_id) WHERE target_player_id IS NOT NULL;

-- Job logs indexes
CREATE INDEX idx_job_logs_player ON job_logs(player_id);
CREATE INDEX idx_job_logs_type ON job_logs(job_type_id);
CREATE INDEX idx_job_logs_completed_at ON job_logs(completed_at);

-- Transactions indexes
CREATE INDEX idx_transactions_player ON transactions(player_id);
CREATE INDEX idx_transactions_domain ON transactions(domain);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_reference ON transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- Player cooldowns indexes
CREATE INDEX idx_player_cooldowns_player ON player_cooldowns(player_id);
CREATE INDEX idx_player_cooldowns_expires ON player_cooldowns(expires_at);

-- Business income logs indexes
CREATE INDEX idx_business_income_logs_business ON business_income_logs(business_id);
CREATE INDEX idx_business_income_logs_player ON business_income_logs(player_id);
CREATE INDEX idx_business_income_logs_collected ON business_income_logs(collected_at);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at triggers for tables with that column
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to clean up expired cooldowns
CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM player_cooldowns WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_cooldowns IS 'Removes expired cooldowns, returns count deleted';

-- Function to check if player has active cooldown
CREATE OR REPLACE FUNCTION has_cooldown(
  p_player_id UUID,
  p_action_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM player_cooldowns
    WHERE player_id = p_player_id
    AND action_type = p_action_type
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_cooldown IS 'Check if player has active cooldown for action';

-- Function to get cooldown remaining seconds
CREATE OR REPLACE FUNCTION get_cooldown_remaining(
  p_player_id UUID,
  p_action_type VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT GREATEST(0, EXTRACT(EPOCH FROM (expires_at - NOW()))::INTEGER)
  INTO remaining
  FROM player_cooldowns
  WHERE player_id = p_player_id
  AND action_type = p_action_type
  AND expires_at > NOW();

  RETURN COALESCE(remaining, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_cooldown_remaining IS 'Get seconds remaining on cooldown (0 if none)';

-- Function to set a cooldown
CREATE OR REPLACE FUNCTION set_cooldown(
  p_player_id UUID,
  p_action_type VARCHAR(50),
  p_seconds INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO player_cooldowns (player_id, action_type, expires_at)
  VALUES (p_player_id, p_action_type, NOW() + (p_seconds || ' seconds')::INTERVAL)
  ON CONFLICT (player_id, action_type)
  DO UPDATE SET expires_at = NOW() + (p_seconds || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_cooldown IS 'Set or update a cooldown for a player action';

-- Function to calculate business income
CREATE OR REPLACE FUNCTION calculate_business_income(
  p_business_id UUID,
  p_collect BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  hours_elapsed NUMERIC,
  gross_income BIGINT,
  operating_cost BIGINT,
  net_income BIGINT,
  heat_generated INTEGER
) AS $$
DECLARE
  v_business RECORD;
  v_business_type RECORD;
  v_hours NUMERIC;
  v_gross BIGINT;
  v_cost BIGINT;
  v_net BIGINT;
  v_heat INTEGER;
  v_efficiency NUMERIC;
BEGIN
  -- Get business and type info
  SELECT b.*, bt.income_per_hour, bt.cost_per_hour, bt.heat_generation
  INTO v_business
  FROM businesses b
  JOIN business_types bt ON b.business_type_id = bt.id
  WHERE b.id = p_business_id AND b.status = 'open';

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::INTEGER;
    RETURN;
  END IF;

  -- Calculate hours since last collection
  v_hours := EXTRACT(EPOCH FROM (NOW() - COALESCE(v_business.last_collection_at, v_business.opened_at))) / 3600.0;

  -- Calculate income with efficiency bonus
  v_efficiency := 1.0 + (v_business.efficiency_bonus / 100.0);
  v_gross := (v_business.income_per_hour * v_hours * v_efficiency)::BIGINT;
  v_cost := (v_business.cost_per_hour * v_hours)::BIGINT;
  v_net := v_gross - v_cost;
  v_heat := (COALESCE(v_business.heat_generation, 0) * v_hours)::INTEGER;

  -- If collecting, update the business
  IF p_collect THEN
    UPDATE businesses
    SET
      last_collection_at = NOW(),
      total_revenue = total_revenue + v_gross,
      total_expenses = total_expenses + v_cost,
      heat_level = LEAST(100, heat_level + v_heat)
    WHERE id = p_business_id;

    -- Log the collection
    INSERT INTO business_income_logs (
      business_id, player_id, hours_elapsed,
      gross_income, operating_cost, net_income,
      efficiency_bonus, heat_generated,
      period_start, period_end
    ) VALUES (
      p_business_id, v_business.owner_id, v_hours,
      v_gross, v_cost, v_net,
      v_business.efficiency_bonus, v_heat,
      COALESCE(v_business.last_collection_at, v_business.opened_at), NOW()
    );
  END IF;

  RETURN QUERY SELECT v_hours, v_gross, v_cost, v_net, v_heat;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_business_income IS 'Calculate pending income for a business, optionally collect it';

-- =============================================================================
-- VALIDATION CONSTRAINTS
-- =============================================================================

-- Ensure businesses reference valid property (if any)
-- The property must be owned by the same player
CREATE OR REPLACE FUNCTION validate_business_property()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.property_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM properties
      WHERE id = NEW.property_id
      AND owner_id = NEW.owner_id
    ) THEN
      RAISE EXCEPTION 'Business property must be owned by the business owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_business_property_trigger
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION validate_business_property();

-- Ensure employee count doesn't exceed max for business type
CREATE OR REPLACE FUNCTION validate_employee_count()
RETURNS TRIGGER AS $$
DECLARE
  max_emp INT;
BEGIN
  SELECT max_employees INTO max_emp
  FROM business_types
  WHERE id = NEW.business_type_id;

  IF NEW.employee_count > max_emp THEN
    RAISE EXCEPTION 'Employee count (%) exceeds maximum (%) for this business type',
      NEW.employee_count, max_emp;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_employee_count_trigger
  BEFORE INSERT OR UPDATE OF employee_count ON businesses
  FOR EACH ROW EXECUTE FUNCTION validate_employee_count();

-- =============================================================================
-- SEED REFERENCE DATA
-- =============================================================================

-- Insert business types from game constants
INSERT INTO business_types (id, name, category, setup_cost, income_per_hour, cost_per_hour, max_employees, required_level, heat_generation, required_rep_business, required_rep_crime) VALUES
  ('laundromat', 'Laundromat', 'legit', 5000, 50, 10, 2, 1, 0, 0, 0),
  ('restaurant', 'Restaurant', 'legit', 15000, 150, 40, 5, 2, 0, 0, 0),
  ('bar', 'Bar', 'legit', 25000, 250, 60, 4, 3, 0, 0, 0),
  ('gym', 'Gym', 'legit', 30000, 200, 50, 3, 3, 0, 0, 0),
  ('pawn_shop', 'Pawn Shop', 'gray', 10000, 120, 25, 2, 1, 5, 0, 0),
  ('dispensary', 'Dispensary', 'gray', 20000, 300, 70, 3, 3, 10, 100, 0),
  ('drug_lab', 'Drug Lab', 'underground', 50000, 500, 100, 4, 5, 30, 0, 200),
  ('chop_shop', 'Chop Shop', 'underground', 40000, 400, 80, 5, 4, 25, 0, 150),
  ('gambling_den', 'Gambling Den', 'underground', 35000, 350, 90, 4, 4, 20, 0, 0),
  ('weapons_cache', 'Weapons Cache', 'underground', 60000, 600, 120, 3, 6, 40, 0, 300);

-- Insert crime types from game constants
INSERT INTO crime_types (id, name, category, required_level, payout_min, payout_max, success_rate, heat_min, heat_max, energy_cost, cooldown_seconds, allows_pvp, has_minigame, requires_weapon, xp_reward) VALUES
  ('pickpocket', 'Pickpocket', 'petty', 1, 20, 80, 70, 2, 5, 5, 30, FALSE, FALSE, FALSE, 5),
  ('shoplifting', 'Shoplifting', 'petty', 1, 30, 100, 65, 3, 8, 8, 60, FALSE, FALSE, FALSE, 8),
  ('mugging', 'Mugging', 'violent', 2, 50, 200, 55, 8, 15, 12, 120, TRUE, FALSE, FALSE, 15),
  ('car_theft', 'Car Theft', 'property', 3, 200, 800, 45, 15, 25, 15, 300, FALSE, TRUE, FALSE, 25),
  ('burglary', 'Burglary', 'property', 4, 300, 1200, 40, 20, 35, 20, 600, FALSE, TRUE, FALSE, 35),
  ('drug_run', 'Drug Run', 'organized', 2, 100, 400, 50, 10, 20, 10, 180, FALSE, FALSE, FALSE, 20),
  ('armed_robbery', 'Armed Robbery', 'violent', 5, 500, 2000, 35, 30, 50, 25, 900, FALSE, FALSE, TRUE, 50),
  ('bank_heist', 'Bank Heist', 'organized', 8, 5000, 20000, 20, 50, 80, 50, 3600, FALSE, TRUE, FALSE, 100);

-- Insert job types from game constants
INSERT INTO job_types (id, name, category, required_level, payout, energy_cost, cooldown_seconds, xp_reward) VALUES
  ('delivery', 'Delivery Driver', 'manual', 1, 50, 10, 60, 5),
  ('security', 'Security Guard', 'service', 2, 100, 15, 120, 10),
  ('temp_work', 'Temp Work', 'manual', 1, 75, 20, 90, 7),
  ('bartending', 'Bartending', 'service', 3, 150, 12, 150, 12),
  ('accounting', 'Accounting', 'professional', 5, 300, 8, 300, 20);

