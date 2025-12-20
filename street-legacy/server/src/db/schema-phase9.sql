-- Phase 9: Legal Business Fronts and Money Laundering Schema

-- Business front types reference table
CREATE TABLE IF NOT EXISTS business_front_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type_code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  base_setup_cost INTEGER NOT NULL,
  monthly_expenses INTEGER NOT NULL,
  base_laundering_rate INTEGER NOT NULL, -- $ per day
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
  legitimacy_rating INTEGER DEFAULT 50 CHECK (legitimacy_rating >= 0 AND legitimacy_rating <= 100),
  reputation INTEGER DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),

  -- Financial tracking
  dirty_cash_stored INTEGER DEFAULT 0,
  clean_cash_pending INTEGER DEFAULT 0,
  total_laundered INTEGER DEFAULT 0,
  total_legitimate_income INTEGER DEFAULT 0,

  -- Operations
  is_operational BOOLEAN DEFAULT false,
  operating_hours VARCHAR(20) DEFAULT '9-17',
  daily_customers INTEGER DEFAULT 0,

  -- Employees
  employee_count INTEGER DEFAULT 0,
  employee_quality INTEGER DEFAULT 50,

  -- Licensing
  has_license BOOLEAN DEFAULT false,
  license_expires_at TIMESTAMP,
  permits JSONB DEFAULT '[]',

  -- Status
  is_under_investigation BOOLEAN DEFAULT false,
  investigation_id INTEGER,
  last_audit_date TIMESTAMP,
  audit_flags INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_tax_paid TIMESTAMP
);

-- Create indexes for business_fronts
CREATE INDEX IF NOT EXISTS idx_business_fronts_owner ON business_fronts(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_fronts_property ON business_fronts(property_id);

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

-- Create index for business employees
CREATE INDEX IF NOT EXISTS idx_business_employees_business ON business_employees(business_id);

-- Laundering transactions
CREATE TABLE IF NOT EXISTS laundering_operations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  dirty_amount INTEGER NOT NULL,
  clean_amount INTEGER NOT NULL,
  fee_amount INTEGER NOT NULL,
  fee_percentage DECIMAL(5,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'seized', 'cancelled')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completes_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  was_flagged BOOLEAN DEFAULT false,
  flag_reason VARCHAR(100)
);

-- Create indexes for laundering operations
CREATE INDEX IF NOT EXISTS idx_laundering_operations_business ON laundering_operations(business_id);
CREATE INDEX IF NOT EXISTS idx_laundering_operations_player ON laundering_operations(player_id);
CREATE INDEX IF NOT EXISTS idx_laundering_operations_status ON laundering_operations(status);

-- Tax records
CREATE TABLE IF NOT EXISTS tax_records (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
  tax_period VARCHAR(20) NOT NULL, -- 'YYYY-MM' format
  gross_income INTEGER DEFAULT 0,
  reported_income INTEGER DEFAULT 0,
  deductions INTEGER DEFAULT 0,
  taxes_owed INTEGER DEFAULT 0,
  taxes_paid INTEGER DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'overdue', 'audited')),
  due_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  audit_flag BOOLEAN DEFAULT false,
  audit_result VARCHAR(30),
  penalty_amount INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, tax_period)
);

-- Create indexes for tax records
CREATE INDEX IF NOT EXISTS idx_tax_records_player ON tax_records(player_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_business ON tax_records(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_status ON tax_records(payment_status);

-- Investigations
CREATE TABLE IF NOT EXISTS investigations (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES business_fronts(id) ON DELETE SET NULL,
  investigation_type VARCHAR(50) NOT NULL,
  trigger_reason VARCHAR(100) NOT NULL,
  stage VARCHAR(30) DEFAULT 'preliminary' CHECK (stage IN ('preliminary', 'active', 'subpoena', 'charges_filed', 'resolved', 'dismissed')),
  severity INTEGER DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),

  -- Evidence
  evidence_collected JSONB DEFAULT '[]',
  evidence_strength INTEGER DEFAULT 0,

  -- Agents
  lead_agent VARCHAR(100),
  agency VARCHAR(50) DEFAULT 'IRS',

  -- Timeline
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  player_notified_at TIMESTAMP,
  subpoena_issued_at TIMESTAMP,
  charges_filed_at TIMESTAMP,
  resolved_at TIMESTAMP,

  -- Outcome
  outcome VARCHAR(50),
  fine_amount INTEGER DEFAULT 0,
  jail_time_hours INTEGER DEFAULT 0,
  assets_seized INTEGER DEFAULT 0,

  notes JSONB DEFAULT '[]'
);

-- Create indexes for investigations
CREATE INDEX IF NOT EXISTS idx_investigations_player ON investigations(player_id);
CREATE INDEX IF NOT EXISTS idx_investigations_business ON investigations(business_id);
CREATE INDEX IF NOT EXISTS idx_investigations_stage ON investigations(stage);

-- Business operations log (for legitimacy tracking)
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

-- Create index for business operations log
CREATE INDEX IF NOT EXISTS idx_business_operations_log_business ON business_operations_log(business_id);

-- Business inventory (for retail/restaurant/dealer types)
CREATE TABLE IF NOT EXISTS business_inventory (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 0,
  cost_per_unit INTEGER NOT NULL,
  sale_price INTEGER NOT NULL,
  acquired_legitimately BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for business inventory
CREATE INDEX IF NOT EXISTS idx_business_inventory_business ON business_inventory(business_id);

-- Business reviews (for reputation)
CREATE TABLE IF NOT EXISTS business_reviews (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES business_fronts(id) ON DELETE CASCADE,
  reviewer_type VARCHAR(30) DEFAULT 'customer', -- customer, critic, inspector
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_fake BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for business reviews
CREATE INDEX IF NOT EXISTS idx_business_reviews_business ON business_reviews(business_id);

-- Business events (random events that occur)
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

-- Create index for business events
CREATE INDEX IF NOT EXISTS idx_business_events_business ON business_events(business_id);

-- Cash transaction flags (for pattern detection)
CREATE TABLE IF NOT EXISTS cash_transaction_flags (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES business_fronts(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  flag_type VARCHAR(50) NOT NULL, -- 'large_deposit', 'structuring', 'velocity', 'pattern'
  flag_reason TEXT,
  reported_to_authorities BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for cash transaction flags
CREATE INDEX IF NOT EXISTS idx_cash_flags_player ON cash_transaction_flags(player_id);
CREATE INDEX IF NOT EXISTS idx_cash_flags_business ON cash_transaction_flags(business_id);

-- Tax attorney NPC relationships
CREATE TABLE IF NOT EXISTS player_attorney_relationships (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  attorney_name VARCHAR(100) NOT NULL,
  attorney_tier INTEGER DEFAULT 1, -- 1=cheap/basic, 2=competent, 3=elite
  retainer_fee INTEGER NOT NULL,
  retainer_paid_until TIMESTAMP,
  cases_handled INTEGER DEFAULT 0,
  audit_reduction_percent INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  hired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id)
);

-- Clean money accounts (legal bank accounts)
ALTER TABLE players ADD COLUMN IF NOT EXISTS clean_bank_balance INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_taxes_paid INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tax_evasion_amount INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS financial_investigation_count INTEGER DEFAULT 0;
