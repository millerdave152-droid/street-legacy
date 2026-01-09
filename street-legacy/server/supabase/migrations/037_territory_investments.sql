-- Street Legacy: Territory Investment System
-- Migration: 037_territory_investments
-- Description: Crews invest in districts to influence metrics and gain bonuses

-- =============================================================================
-- TERRITORY INVESTMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS territory_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,

  -- Investment amounts (cumulative)
  security_investment BIGINT DEFAULT 0,      -- Increases police presence
  corruption_investment BIGINT DEFAULT 0,    -- Reduces police effectiveness
  business_investment BIGINT DEFAULT 0,      -- Boosts business health
  street_investment BIGINT DEFAULT 0,        -- Increases street activity

  -- Calculated influence (0-100 per category)
  security_influence INT DEFAULT 0,
  corruption_influence INT DEFAULT 0,
  business_influence INT DEFAULT 0,
  street_influence INT DEFAULT 0,

  -- Total investment for ranking
  total_invested BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(district_id, crew_id)
);

COMMENT ON TABLE territory_investments IS 'Crew investments in district influence';
COMMENT ON COLUMN territory_investments.security_investment IS 'Investment to increase police presence';
COMMENT ON COLUMN territory_investments.corruption_investment IS 'Investment to reduce police catch rates';
COMMENT ON COLUMN territory_investments.business_investment IS 'Investment to boost property income';
COMMENT ON COLUMN territory_investments.street_investment IS 'Investment to increase crime payouts';

-- =============================================================================
-- INVESTMENT HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS investment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),

  investment_type VARCHAR(20) NOT NULL, -- 'security', 'corruption', 'business', 'street'
  amount BIGINT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE investment_history IS 'History of individual investments';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_territory_investments_district ON territory_investments(district_id);
CREATE INDEX IF NOT EXISTS idx_territory_investments_crew ON territory_investments(crew_id);
CREATE INDEX IF NOT EXISTS idx_territory_investments_total ON territory_investments(district_id, total_invested DESC);

CREATE INDEX IF NOT EXISTS idx_investment_history_district ON investment_history(district_id);
CREATE INDEX IF NOT EXISTS idx_investment_history_crew ON investment_history(crew_id);
CREATE INDEX IF NOT EXISTS idx_investment_history_time ON investment_history(created_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Calculate influence from investment (logarithmic scaling)
 * Returns 0-100 influence based on investment amount
 */
CREATE OR REPLACE FUNCTION calculate_influence(p_investment BIGINT)
RETURNS INT AS $$
BEGIN
  IF p_investment <= 0 THEN
    RETURN 0;
  END IF;

  -- Logarithmic scaling: influence = 10 * log10(investment / 1000 + 1)
  -- $1K = ~3, $10K = ~10, $100K = ~20, $1M = ~30, $10M = ~40
  RETURN LEAST(100, GREATEST(0, ROUND(10 * LOG(p_investment::NUMERIC / 1000 + 1))));
END;
$$ LANGUAGE plpgsql;

/**
 * Make an investment in a district
 */
CREATE OR REPLACE FUNCTION make_territory_investment(
  p_crew_id UUID,
  p_player_id UUID,
  p_district_id VARCHAR(50),
  p_investment_type VARCHAR(20),
  p_amount BIGINT
)
RETURNS TABLE (
  success BOOLEAN,
  new_influence INT,
  total_invested BIGINT,
  error_message TEXT
) AS $$
DECLARE
  v_crew_bank BIGINT;
  v_current_investment BIGINT;
  v_new_investment BIGINT;
  v_new_influence INT;
  v_total BIGINT;
BEGIN
  -- Validate investment type
  IF p_investment_type NOT IN ('security', 'corruption', 'business', 'street') THEN
    RETURN QUERY SELECT false, 0, 0::BIGINT, 'Invalid investment type'::TEXT;
    RETURN;
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0, 0::BIGINT, 'Amount must be positive'::TEXT;
    RETURN;
  END IF;

  -- Check crew bank balance
  SELECT vault_balance INTO v_crew_bank FROM crews WHERE id = p_crew_id FOR UPDATE;

  IF v_crew_bank IS NULL THEN
    RETURN QUERY SELECT false, 0, 0::BIGINT, 'Crew not found'::TEXT;
    RETURN;
  END IF;

  IF v_crew_bank < p_amount THEN
    RETURN QUERY SELECT false, 0, 0::BIGINT, 'Insufficient crew funds'::TEXT;
    RETURN;
  END IF;

  -- Deduct from crew bank
  UPDATE crews SET vault_balance = vault_balance - p_amount WHERE id = p_crew_id;

  -- Upsert investment record
  INSERT INTO territory_investments (district_id, crew_id)
  VALUES (p_district_id, p_crew_id)
  ON CONFLICT (district_id, crew_id) DO NOTHING;

  -- Update investment and calculate new influence
  CASE p_investment_type
    WHEN 'security' THEN
      UPDATE territory_investments SET
        security_investment = security_investment + p_amount,
        security_influence = calculate_influence(security_investment + p_amount),
        total_invested = total_invested + p_amount,
        updated_at = NOW()
      WHERE district_id = p_district_id AND crew_id = p_crew_id
      RETURNING security_influence, territory_investments.total_invested INTO v_new_influence, v_total;

    WHEN 'corruption' THEN
      UPDATE territory_investments SET
        corruption_investment = corruption_investment + p_amount,
        corruption_influence = calculate_influence(corruption_investment + p_amount),
        total_invested = total_invested + p_amount,
        updated_at = NOW()
      WHERE district_id = p_district_id AND crew_id = p_crew_id
      RETURNING corruption_influence, territory_investments.total_invested INTO v_new_influence, v_total;

    WHEN 'business' THEN
      UPDATE territory_investments SET
        business_investment = business_investment + p_amount,
        business_influence = calculate_influence(business_investment + p_amount),
        total_invested = total_invested + p_amount,
        updated_at = NOW()
      WHERE district_id = p_district_id AND crew_id = p_crew_id
      RETURNING business_influence, territory_investments.total_invested INTO v_new_influence, v_total;

    WHEN 'street' THEN
      UPDATE territory_investments SET
        street_investment = street_investment + p_amount,
        street_influence = calculate_influence(street_investment + p_amount),
        total_invested = total_invested + p_amount,
        updated_at = NOW()
      WHERE district_id = p_district_id AND crew_id = p_crew_id
      RETURNING street_influence, territory_investments.total_invested INTO v_new_influence, v_total;
  END CASE;

  -- Record in history
  INSERT INTO investment_history (district_id, crew_id, player_id, investment_type, amount)
  VALUES (p_district_id, p_crew_id, p_player_id, p_investment_type, p_amount);

  RETURN QUERY SELECT true, v_new_influence, v_total, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Get investment status for a district
 */
CREATE OR REPLACE FUNCTION get_district_investments(p_district_id VARCHAR(50))
RETURNS TABLE (
  crew_id UUID,
  crew_name VARCHAR(100),
  crew_tag VARCHAR(5),
  security_investment BIGINT,
  corruption_investment BIGINT,
  business_investment BIGINT,
  street_investment BIGINT,
  security_influence INT,
  corruption_influence INT,
  business_influence INT,
  street_influence INT,
  total_invested BIGINT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.crew_id,
    c.name AS crew_name,
    c.tag AS crew_tag,
    ti.security_investment,
    ti.corruption_investment,
    ti.business_investment,
    ti.street_investment,
    ti.security_influence,
    ti.corruption_influence,
    ti.business_influence,
    ti.street_influence,
    ti.total_invested,
    ROW_NUMBER() OVER (ORDER BY ti.total_invested DESC) AS rank
  FROM territory_investments ti
  JOIN crews c ON ti.crew_id = c.id
  WHERE ti.district_id = p_district_id
  AND ti.total_invested > 0
  ORDER BY ti.total_invested DESC;
END;
$$ LANGUAGE plpgsql;

/**
 * Get crew's investments across all districts
 */
CREATE OR REPLACE FUNCTION get_crew_investments(p_crew_id UUID)
RETURNS TABLE (
  district_id VARCHAR(50),
  district_name VARCHAR(100),
  security_investment BIGINT,
  corruption_investment BIGINT,
  business_investment BIGINT,
  street_investment BIGINT,
  total_invested BIGINT,
  district_rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.district_id,
    d.name AS district_name,
    ti.security_investment,
    ti.corruption_investment,
    ti.business_investment,
    ti.street_investment,
    ti.total_invested,
    (SELECT COUNT(*) + 1 FROM territory_investments ti2
     WHERE ti2.district_id = ti.district_id
     AND ti2.total_invested > ti.total_invested) AS district_rank
  FROM territory_investments ti
  JOIN districts d ON ti.district_id = d.id
  WHERE ti.crew_id = p_crew_id
  AND ti.total_invested > 0
  ORDER BY ti.total_invested DESC;
END;
$$ LANGUAGE plpgsql;

/**
 * Calculate combined investment effects for a district
 * Returns modifiers based on all crew investments
 */
CREATE OR REPLACE FUNCTION get_district_investment_modifiers(p_district_id VARCHAR(50))
RETURNS TABLE (
  police_presence_mod NUMERIC,
  police_effectiveness_mod NUMERIC,
  property_income_mod NUMERIC,
  crime_payout_mod NUMERIC,
  dominant_crew_id UUID,
  dominant_crew_name VARCHAR(100)
) AS $$
DECLARE
  v_total_security BIGINT;
  v_total_corruption BIGINT;
  v_total_business BIGINT;
  v_total_street BIGINT;
  v_dominant_crew UUID;
  v_dominant_name VARCHAR(100);
BEGIN
  -- Sum all investments
  SELECT
    COALESCE(SUM(security_investment), 0),
    COALESCE(SUM(corruption_investment), 0),
    COALESCE(SUM(business_investment), 0),
    COALESCE(SUM(street_investment), 0)
  INTO v_total_security, v_total_corruption, v_total_business, v_total_street
  FROM territory_investments
  WHERE district_id = p_district_id;

  -- Find dominant crew
  SELECT ti.crew_id, c.name INTO v_dominant_crew, v_dominant_name
  FROM territory_investments ti
  JOIN crews c ON ti.crew_id = c.id
  WHERE ti.district_id = p_district_id
  ORDER BY ti.total_invested DESC
  LIMIT 1;

  -- Calculate modifiers (logarithmic, capped)
  -- Security: +1% police presence per influence point (max +30%)
  -- Corruption: -0.5% police effectiveness per influence point (max -20%)
  -- Business: +0.5% property income per influence point (max +25%)
  -- Street: +0.3% crime payout per influence point (max +20%)

  RETURN QUERY SELECT
    1.0 + LEAST(0.30, calculate_influence(v_total_security) * 0.01)::NUMERIC AS police_presence_mod,
    1.0 - LEAST(0.20, calculate_influence(v_total_corruption) * 0.005)::NUMERIC AS police_effectiveness_mod,
    1.0 + LEAST(0.25, calculate_influence(v_total_business) * 0.005)::NUMERIC AS property_income_mod,
    1.0 + LEAST(0.20, calculate_influence(v_total_street) * 0.003)::NUMERIC AS crime_payout_mod,
    v_dominant_crew,
    v_dominant_name;
END;
$$ LANGUAGE plpgsql;

/**
 * Get top investors leaderboard for a district
 */
CREATE OR REPLACE FUNCTION get_district_investor_leaderboard(
  p_district_id VARCHAR(50),
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  rank BIGINT,
  crew_id UUID,
  crew_name VARCHAR(100),
  crew_tag VARCHAR(5),
  total_invested BIGINT,
  dominant_type VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY ti.total_invested DESC) AS rank,
    ti.crew_id,
    c.name AS crew_name,
    c.tag AS crew_tag,
    ti.total_invested,
    CASE
      WHEN ti.security_investment >= ti.corruption_investment
       AND ti.security_investment >= ti.business_investment
       AND ti.security_investment >= ti.street_investment THEN 'security'
      WHEN ti.corruption_investment >= ti.business_investment
       AND ti.corruption_investment >= ti.street_investment THEN 'corruption'
      WHEN ti.business_investment >= ti.street_investment THEN 'business'
      ELSE 'street'
    END AS dominant_type
  FROM territory_investments ti
  JOIN crews c ON ti.crew_id = c.id
  WHERE ti.district_id = p_district_id
  AND ti.total_invested > 0
  ORDER BY ti.total_invested DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CONTRACTS TABLE (for heist contracts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS heist_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  funder_id UUID NOT NULL REFERENCES players(id),
  executor_id UUID REFERENCES players(id),

  -- Contract terms
  target_type VARCHAR(50) NOT NULL,        -- 'heist', 'crime', 'territory'
  target_id VARCHAR(100),                   -- Specific target if applicable
  target_description TEXT,

  funded_amount BIGINT NOT NULL,            -- Amount funded by funder
  executor_split_percent INT DEFAULT 70,    -- Executor gets this % of payout
  funder_split_percent INT DEFAULT 30,      -- Funder gets this %

  -- Status
  status VARCHAR(20) DEFAULT 'open',        -- 'open', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled'
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  payout_amount BIGINT,
  executor_payout BIGINT,
  funder_payout BIGINT,

  -- Timing
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE heist_contracts IS 'Player-funded heist contracts';
COMMENT ON COLUMN heist_contracts.funded_amount IS 'Upfront funding provided by funder';
COMMENT ON COLUMN heist_contracts.executor_split_percent IS 'Percentage of payout going to executor';

-- =============================================================================
-- CONTRACT INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_contracts_funder ON heist_contracts(funder_id);
CREATE INDEX IF NOT EXISTS idx_contracts_executor ON heist_contracts(executor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON heist_contracts(status) WHERE status IN ('open', 'accepted', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_contracts_expires ON heist_contracts(expires_at) WHERE status = 'open';

-- =============================================================================
-- CONTRACT FUNCTIONS
-- =============================================================================

/**
 * Create a new heist contract
 */
CREATE OR REPLACE FUNCTION create_heist_contract(
  p_funder_id UUID,
  p_target_type VARCHAR(50),
  p_target_description TEXT,
  p_funded_amount BIGINT,
  p_executor_split INT DEFAULT 70,
  p_target_id VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  contract_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_funder_cash BIGINT;
  v_contract_id UUID;
BEGIN
  -- Validate split
  IF p_executor_split < 50 OR p_executor_split > 90 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Executor split must be 50-90%'::TEXT;
    RETURN;
  END IF;

  -- Check funder has enough cash
  SELECT cash_balance INTO v_funder_cash FROM players WHERE id = p_funder_id FOR UPDATE;

  IF v_funder_cash < p_funded_amount THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Insufficient funds'::TEXT;
    RETURN;
  END IF;

  -- Deduct funding
  UPDATE players SET cash_balance = cash_balance - p_funded_amount WHERE id = p_funder_id;

  -- Create contract
  INSERT INTO heist_contracts (
    funder_id, target_type, target_id, target_description,
    funded_amount, executor_split_percent, funder_split_percent
  ) VALUES (
    p_funder_id, p_target_type, p_target_id, p_target_description,
    p_funded_amount, p_executor_split, 100 - p_executor_split
  )
  RETURNING id INTO v_contract_id;

  RETURN QUERY SELECT true, v_contract_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Accept a contract
 */
CREATE OR REPLACE FUNCTION accept_heist_contract(
  p_contract_id UUID,
  p_executor_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_contract RECORD;
BEGIN
  SELECT * INTO v_contract FROM heist_contracts WHERE id = p_contract_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Contract not found'::TEXT;
    RETURN;
  END IF;

  IF v_contract.status != 'open' THEN
    RETURN QUERY SELECT false, 'Contract is not open'::TEXT;
    RETURN;
  END IF;

  IF v_contract.funder_id = p_executor_id THEN
    RETURN QUERY SELECT false, 'Cannot accept your own contract'::TEXT;
    RETURN;
  END IF;

  IF v_contract.expires_at < NOW() THEN
    RETURN QUERY SELECT false, 'Contract has expired'::TEXT;
    RETURN;
  END IF;

  UPDATE heist_contracts SET
    executor_id = p_executor_id,
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_contract_id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Complete a contract (called after successful heist)
 */
CREATE OR REPLACE FUNCTION complete_heist_contract(
  p_contract_id UUID,
  p_payout_amount BIGINT
)
RETURNS TABLE (
  success BOOLEAN,
  executor_payout BIGINT,
  funder_payout BIGINT,
  error_message TEXT
) AS $$
DECLARE
  v_contract RECORD;
  v_executor_amount BIGINT;
  v_funder_amount BIGINT;
BEGIN
  SELECT * INTO v_contract FROM heist_contracts WHERE id = p_contract_id FOR UPDATE;

  IF NOT FOUND OR v_contract.status NOT IN ('accepted', 'in_progress') THEN
    RETURN QUERY SELECT false, 0::BIGINT, 0::BIGINT, 'Invalid contract status'::TEXT;
    RETURN;
  END IF;

  -- Calculate split
  v_executor_amount := ROUND(p_payout_amount * v_contract.executor_split_percent / 100.0);
  v_funder_amount := p_payout_amount - v_executor_amount;

  -- Pay executor
  UPDATE players SET cash_balance = cash_balance + v_executor_amount + v_contract.funded_amount
  WHERE id = v_contract.executor_id;

  -- Pay funder their split
  UPDATE players SET cash_balance = cash_balance + v_funder_amount
  WHERE id = v_contract.funder_id;

  -- Update contract
  UPDATE heist_contracts SET
    status = 'completed',
    completed_at = NOW(),
    payout_amount = p_payout_amount,
    executor_payout = v_executor_amount + v_contract.funded_amount,
    funder_payout = v_funder_amount,
    updated_at = NOW()
  WHERE id = p_contract_id;

  RETURN QUERY SELECT true, v_executor_amount + v_contract.funded_amount, v_funder_amount, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Get open contracts
 */
CREATE OR REPLACE FUNCTION get_open_contracts(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  funder_id UUID,
  funder_username VARCHAR(30),
  target_type VARCHAR(50),
  target_description TEXT,
  funded_amount BIGINT,
  executor_split_percent INT,
  expires_at TIMESTAMPTZ,
  time_remaining INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hc.id,
    hc.funder_id,
    p.username AS funder_username,
    hc.target_type,
    hc.target_description,
    hc.funded_amount,
    hc.executor_split_percent,
    hc.expires_at,
    GREATEST(hc.expires_at - NOW(), INTERVAL '0 seconds') AS time_remaining
  FROM heist_contracts hc
  JOIN players p ON hc.funder_id = p.id
  WHERE hc.status = 'open'
  AND hc.expires_at > NOW()
  ORDER BY hc.funded_amount DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
