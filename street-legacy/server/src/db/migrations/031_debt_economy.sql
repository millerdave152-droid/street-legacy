-- ============================================================================
-- Migration 031: Debt Economy System
-- Favors as binding social contracts between players
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Debt status enum
DO $$ BEGIN
  CREATE TYPE debt_status_enum AS ENUM (
    'outstanding',  -- Debt exists, not yet called in
    'called_in',    -- Creditor has demanded fulfillment
    'fulfilled',    -- Debt has been paid/honored
    'defaulted',    -- Debtor failed to fulfill
    'transferred',  -- Debt ownership changed hands
    'forgiven'      -- Creditor waived the debt
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Debt type enum
DO $$ BEGIN
  CREATE TYPE debt_type_enum AS ENUM (
    'favor',        -- General favor owed
    'money',        -- Financial debt
    'protection',   -- Owes protection/backup
    'service',      -- Owes specific service
    'information',  -- Owes intel/secrets
    'blood_debt'    -- Life debt - most serious
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Player debts - the core debt records
CREATE TABLE IF NOT EXISTS player_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  debtor_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  debt_type debt_type_enum NOT NULL,
  description TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 1 AND value <= 10),
  original_value INTEGER CHECK (original_value >= 1 AND original_value <= 10),
  status debt_status_enum NOT NULL DEFAULT 'outstanding',
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_in_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  transferred_from_id INTEGER REFERENCES players(id),
  CONSTRAINT different_players CHECK (creditor_id != debtor_id)
);

COMMENT ON TABLE player_debts IS 'Social contract debts between players';
COMMENT ON COLUMN player_debts.value IS 'Severity/importance of debt (1=minor, 10=blood debt)';
COMMENT ON COLUMN player_debts.original_value IS 'Original value if debt was reduced';
COMMENT ON COLUMN player_debts.context IS 'How the debt was incurred';
COMMENT ON COLUMN player_debts.transferred_from_id IS 'Previous creditor if debt was transferred';

-- Debt transfers - history of debt ownership changes
CREATE TABLE IF NOT EXISTS debt_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES player_debts(id) ON DELETE CASCADE,
  from_creditor_id INTEGER NOT NULL REFERENCES players(id),
  to_creditor_id INTEGER NOT NULL REFERENCES players(id),
  transfer_reason TEXT,
  value_at_transfer INTEGER,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to debt_transfers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debt_transfers' AND column_name = 'value_at_transfer') THEN
    ALTER TABLE debt_transfers ADD COLUMN value_at_transfer INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debt_transfers' AND column_name = 'transfer_reason') THEN
    ALTER TABLE debt_transfers ADD COLUMN transfer_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debt_transfers' AND column_name = 'transferred_at') THEN
    ALTER TABLE debt_transfers ADD COLUMN transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

COMMENT ON TABLE debt_transfers IS 'History of debt ownership transfers';
COMMENT ON COLUMN debt_transfers.value_at_transfer IS 'Debt value at time of transfer';

-- Debt defaults - record of broken promises
CREATE TABLE IF NOT EXISTS debt_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES player_debts(id) ON DELETE CASCADE,
  debtor_id INTEGER NOT NULL REFERENCES players(id),
  creditor_id INTEGER NOT NULL REFERENCES players(id),
  default_reason TEXT,
  reputation_penalty_applied BOOLEAN NOT NULL DEFAULT FALSE,
  penalty_amount INTEGER,
  defaulted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE debt_defaults IS 'Records of debts that were defaulted';
COMMENT ON COLUMN debt_defaults.penalty_amount IS 'Trust damage applied to debtor';

-- Debt offers - marketplace for trading debts
CREATE TABLE IF NOT EXISTS debt_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES player_debts(id) ON DELETE CASCADE,
  offering_player_id INTEGER NOT NULL REFERENCES players(id),
  asking_price_type VARCHAR(30) NOT NULL CHECK (asking_price_type IN ('cash', 'favor', 'other_debt', 'service')),
  asking_price_value INTEGER,
  asking_price_details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'withdrawn', 'expired')),
  accepted_by_id INTEGER REFERENCES players(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

COMMENT ON TABLE debt_offers IS 'Marketplace for trading debt ownership';
COMMENT ON COLUMN debt_offers.asking_price_type IS 'What the creditor wants in exchange';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Player debts indexes
CREATE INDEX IF NOT EXISTS idx_player_debts_creditor_status
  ON player_debts(creditor_id, status);

CREATE INDEX IF NOT EXISTS idx_player_debts_debtor_status
  ON player_debts(debtor_id, status);

CREATE INDEX IF NOT EXISTS idx_player_debts_status_due
  ON player_debts(status, due_date)
  WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_debts_outstanding
  ON player_debts(status, created_at DESC)
  WHERE status = 'outstanding';

CREATE INDEX IF NOT EXISTS idx_player_debts_called_in
  ON player_debts(status, called_in_at)
  WHERE status = 'called_in';

-- Debt defaults indexes
CREATE INDEX IF NOT EXISTS idx_debt_defaults_debtor
  ON debt_defaults(debtor_id, defaulted_at DESC);

CREATE INDEX IF NOT EXISTS idx_debt_defaults_creditor
  ON debt_defaults(creditor_id, defaulted_at DESC);

-- Debt transfers indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debt_transfers' AND column_name = 'transferred_at') THEN
    CREATE INDEX IF NOT EXISTS idx_debt_transfers_debt ON debt_transfers(debt_id, transferred_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debt_transfers' AND column_name = 'from_creditor_id') THEN
    CREATE INDEX IF NOT EXISTS idx_debt_transfers_from ON debt_transfers(from_creditor_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debt_transfers' AND column_name = 'to_creditor_id') THEN
    CREATE INDEX IF NOT EXISTS idx_debt_transfers_to ON debt_transfers(to_creditor_id);
  END IF;
END $$;

-- Debt offers indexes
CREATE INDEX IF NOT EXISTS idx_debt_offers_open
  ON debt_offers(status, expires_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_debt_offers_debt
  ON debt_offers(debt_id);

CREATE INDEX IF NOT EXISTS idx_debt_offers_offering_player
  ON debt_offers(offering_player_id, status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Create a new debt
CREATE OR REPLACE FUNCTION create_debt(
  p_creditor_id INTEGER,
  p_debtor_id INTEGER,
  p_debt_type debt_type_enum,
  p_description TEXT,
  p_value INTEGER,
  p_context TEXT DEFAULT NULL,
  p_due_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_id UUID;
BEGIN
  -- Validate different players
  IF p_creditor_id = p_debtor_id THEN
    RAISE EXCEPTION 'Cannot create debt to yourself';
  END IF;

  -- Validate value
  IF p_value < 1 OR p_value > 10 THEN
    RAISE EXCEPTION 'Debt value must be between 1 and 10';
  END IF;

  -- Insert debt
  INSERT INTO player_debts (
    creditor_id, debtor_id, debt_type, description,
    value, original_value, context, due_date
  ) VALUES (
    p_creditor_id, p_debtor_id, p_debt_type, p_description,
    p_value, p_value, p_context, p_due_date
  )
  RETURNING id INTO v_debt_id;

  RETURN v_debt_id;
END;
$$;

COMMENT ON FUNCTION create_debt IS 'Create a new debt between players';

-- Function: Call in a debt (demand fulfillment)
CREATE OR REPLACE FUNCTION call_in_debt(
  p_debt_id UUID,
  p_creditor_id INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  debt_id UUID,
  debtor_id INTEGER,
  debt_type debt_type_enum,
  value INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt RECORD;
BEGIN
  -- Get debt and validate ownership
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = p_debt_id;

  IF v_debt IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, NULL::debt_type_enum, NULL::INTEGER, 'Debt not found'::TEXT;
    RETURN;
  END IF;

  IF v_debt.creditor_id != p_creditor_id THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, NULL::debt_type_enum, NULL::INTEGER, 'You are not the creditor of this debt'::TEXT;
    RETURN;
  END IF;

  IF v_debt.status != 'outstanding' THEN
    RETURN QUERY SELECT FALSE, p_debt_id, v_debt.debtor_id, v_debt.debt_type, v_debt.value, ('Debt is not outstanding (current status: ' || v_debt.status || ')')::TEXT;
    RETURN;
  END IF;

  -- Update debt status
  UPDATE player_debts
  SET status = 'called_in',
      called_in_at = NOW()
  WHERE id = p_debt_id;

  RETURN QUERY SELECT TRUE, p_debt_id, v_debt.debtor_id, v_debt.debt_type, v_debt.value, 'Debt has been called in'::TEXT;
END;
$$;

COMMENT ON FUNCTION call_in_debt IS 'Creditor calls in a debt, demanding fulfillment';

-- Function: Fulfill a debt
CREATE OR REPLACE FUNCTION fulfill_debt(
  p_debt_id UUID,
  p_debtor_id INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  debt_id UUID,
  creditor_id INTEGER,
  trust_bonus INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt RECORD;
  v_trust_bonus INTEGER;
BEGIN
  -- Get debt and validate
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = p_debt_id;

  IF v_debt IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, NULL::INTEGER, 'Debt not found'::TEXT;
    RETURN;
  END IF;

  IF v_debt.debtor_id != p_debtor_id THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, NULL::INTEGER, 'You are not the debtor of this debt'::TEXT;
    RETURN;
  END IF;

  IF v_debt.status NOT IN ('outstanding', 'called_in') THEN
    RETURN QUERY SELECT FALSE, p_debt_id, v_debt.creditor_id, NULL::INTEGER, ('Debt cannot be fulfilled (current status: ' || v_debt.status || ')')::TEXT;
    RETURN;
  END IF;

  -- Calculate trust bonus based on debt value
  v_trust_bonus := 3 + (v_debt.value / 2);

  -- Update debt status
  UPDATE player_debts
  SET status = 'fulfilled',
      resolved_at = NOW()
  WHERE id = p_debt_id;

  -- Award reputation bonus (trust) to debtor with creditor
  -- This would be done by the application layer calling reputation service
  -- Just return the bonus amount for the application to apply

  RETURN QUERY SELECT TRUE, p_debt_id, v_debt.creditor_id, v_trust_bonus, 'Debt fulfilled successfully'::TEXT;
END;
$$;

COMMENT ON FUNCTION fulfill_debt IS 'Debtor fulfills their debt obligation';

-- Function: Default on a debt
CREATE OR REPLACE FUNCTION default_on_debt(
  p_debt_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  debt_id UUID,
  debtor_id INTEGER,
  creditor_id INTEGER,
  trust_penalty INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt RECORD;
  v_trust_penalty INTEGER;
  v_default_id UUID;
BEGIN
  -- Get debt
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = p_debt_id;

  IF v_debt IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, 'Debt not found'::TEXT;
    RETURN;
  END IF;

  IF v_debt.status NOT IN ('outstanding', 'called_in') THEN
    RETURN QUERY SELECT FALSE, p_debt_id, v_debt.debtor_id, v_debt.creditor_id, NULL::INTEGER, ('Debt cannot be defaulted (current status: ' || v_debt.status || ')')::TEXT;
    RETURN;
  END IF;

  -- Calculate trust penalty based on debt value (20-50 range)
  v_trust_penalty := 20 + (v_debt.value * 3);

  -- Create default record
  INSERT INTO debt_defaults (
    debt_id, debtor_id, creditor_id, default_reason,
    reputation_penalty_applied, penalty_amount
  ) VALUES (
    p_debt_id, v_debt.debtor_id, v_debt.creditor_id, p_reason,
    TRUE, v_trust_penalty
  )
  RETURNING id INTO v_default_id;

  -- Update debt status
  UPDATE player_debts
  SET status = 'defaulted',
      resolved_at = NOW()
  WHERE id = p_debt_id;

  RETURN QUERY SELECT TRUE, p_debt_id, v_debt.debtor_id, v_debt.creditor_id, v_trust_penalty, 'Debt defaulted - reputation penalty applied'::TEXT;
END;
$$;

COMMENT ON FUNCTION default_on_debt IS 'Record a debt default and apply penalties';

-- Function: Transfer debt to another creditor
CREATE OR REPLACE FUNCTION transfer_debt(
  p_debt_id UUID,
  p_from_creditor_id INTEGER,
  p_to_creditor_id INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  debt_id UUID,
  new_creditor_id INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt RECORD;
BEGIN
  -- Get debt and validate
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = p_debt_id;

  IF v_debt IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, 'Debt not found'::TEXT;
    RETURN;
  END IF;

  IF v_debt.creditor_id != p_from_creditor_id THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, 'You are not the creditor of this debt'::TEXT;
    RETURN;
  END IF;

  IF v_debt.status NOT IN ('outstanding', 'called_in') THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, ('Cannot transfer debt (current status: ' || v_debt.status || ')')::TEXT;
    RETURN;
  END IF;

  IF p_to_creditor_id = v_debt.debtor_id THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, 'Cannot transfer debt to the debtor'::TEXT;
    RETURN;
  END IF;

  IF p_from_creditor_id = p_to_creditor_id THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, 'Cannot transfer debt to yourself'::TEXT;
    RETURN;
  END IF;

  -- Record the transfer
  INSERT INTO debt_transfers (
    debt_id, from_creditor_id, to_creditor_id,
    transfer_reason, value_at_transfer
  ) VALUES (
    p_debt_id, p_from_creditor_id, p_to_creditor_id,
    p_reason, v_debt.value
  );

  -- Update the debt
  UPDATE player_debts
  SET creditor_id = p_to_creditor_id,
      transferred_from_id = p_from_creditor_id,
      status = CASE
        WHEN status = 'called_in' THEN 'outstanding' -- Reset to outstanding on transfer
        ELSE status
      END
  WHERE id = p_debt_id;

  RETURN QUERY SELECT TRUE, p_debt_id, p_to_creditor_id, 'Debt transferred successfully'::TEXT;
END;
$$;

COMMENT ON FUNCTION transfer_debt IS 'Transfer debt ownership to another player';

-- Function: Forgive a debt
CREATE OR REPLACE FUNCTION forgive_debt(
  p_debt_id UUID,
  p_creditor_id INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  debt_id UUID,
  debtor_id INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt RECORD;
BEGIN
  -- Get debt and validate
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = p_debt_id;

  IF v_debt IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, 'Debt not found'::TEXT;
    RETURN;
  END IF;

  IF v_debt.creditor_id != p_creditor_id THEN
    RETURN QUERY SELECT FALSE, p_debt_id, NULL::INTEGER, 'You are not the creditor of this debt'::TEXT;
    RETURN;
  END IF;

  IF v_debt.status NOT IN ('outstanding', 'called_in') THEN
    RETURN QUERY SELECT FALSE, p_debt_id, v_debt.debtor_id, ('Cannot forgive debt (current status: ' || v_debt.status || ')')::TEXT;
    RETURN;
  END IF;

  -- Update debt status
  UPDATE player_debts
  SET status = 'forgiven',
      resolved_at = NOW()
  WHERE id = p_debt_id;

  -- This could trigger a small trust/respect bonus
  RETURN QUERY SELECT TRUE, p_debt_id, v_debt.debtor_id, 'Debt has been forgiven'::TEXT;
END;
$$;

COMMENT ON FUNCTION forgive_debt IS 'Creditor forgives a debt, releasing the debtor';

-- Function: Check for overdue debts
CREATE OR REPLACE FUNCTION check_overdue_debts()
RETURNS TABLE (
  debt_id UUID,
  debtor_id INTEGER,
  creditor_id INTEGER,
  debt_type debt_type_enum,
  value INTEGER,
  days_overdue INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.debtor_id,
    pd.creditor_id,
    pd.debt_type,
    pd.value,
    EXTRACT(DAY FROM (NOW() - pd.due_date))::INTEGER as days_overdue
  FROM player_debts pd
  WHERE pd.due_date < NOW()
    AND pd.status IN ('outstanding', 'called_in')
  ORDER BY pd.due_date ASC;
END;
$$;

COMMENT ON FUNCTION check_overdue_debts IS 'Find all overdue debts for processing';

-- Function: Get player debt summary
CREATE OR REPLACE FUNCTION get_player_debt_summary(p_player_id INTEGER)
RETURNS TABLE (
  debts_owed_count INTEGER,
  debts_owed_value INTEGER,
  debts_held_count INTEGER,
  debts_held_value INTEGER,
  defaults_count INTEGER,
  fulfilled_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM player_debts WHERE debtor_id = p_player_id AND status IN ('outstanding', 'called_in')),
    (SELECT COALESCE(SUM(value), 0)::INTEGER FROM player_debts WHERE debtor_id = p_player_id AND status IN ('outstanding', 'called_in')),
    (SELECT COUNT(*)::INTEGER FROM player_debts WHERE creditor_id = p_player_id AND status IN ('outstanding', 'called_in')),
    (SELECT COALESCE(SUM(value), 0)::INTEGER FROM player_debts WHERE creditor_id = p_player_id AND status IN ('outstanding', 'called_in')),
    (SELECT COUNT(*)::INTEGER FROM debt_defaults WHERE debtor_id = p_player_id),
    (SELECT COUNT(*)::INTEGER FROM player_debts WHERE debtor_id = p_player_id AND status = 'fulfilled');
END;
$$;

COMMENT ON FUNCTION get_player_debt_summary IS 'Get summary of player debt situation';

-- Function: Create debt offer (to sell/trade debt)
CREATE OR REPLACE FUNCTION create_debt_offer(
  p_debt_id UUID,
  p_offering_player_id INTEGER,
  p_asking_price_type VARCHAR(30),
  p_asking_price_value INTEGER DEFAULT NULL,
  p_asking_price_details TEXT DEFAULT NULL,
  p_expires_hours INTEGER DEFAULT 72
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt RECORD;
  v_offer_id UUID;
BEGIN
  -- Validate debt ownership
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = p_debt_id;

  IF v_debt IS NULL THEN
    RAISE EXCEPTION 'Debt not found';
  END IF;

  IF v_debt.creditor_id != p_offering_player_id THEN
    RAISE EXCEPTION 'You are not the creditor of this debt';
  END IF;

  IF v_debt.status NOT IN ('outstanding', 'called_in') THEN
    RAISE EXCEPTION 'Cannot offer debt for sale (status: %)', v_debt.status;
  END IF;

  -- Check for existing open offers
  IF EXISTS (
    SELECT 1 FROM debt_offers
    WHERE debt_id = p_debt_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'An open offer already exists for this debt';
  END IF;

  -- Create offer
  INSERT INTO debt_offers (
    debt_id, offering_player_id, asking_price_type,
    asking_price_value, asking_price_details, expires_at
  ) VALUES (
    p_debt_id, p_offering_player_id, p_asking_price_type,
    p_asking_price_value, p_asking_price_details,
    NOW() + (p_expires_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$;

COMMENT ON FUNCTION create_debt_offer IS 'Create an offer to sell/trade a debt';

-- Function: Accept debt offer
CREATE OR REPLACE FUNCTION accept_debt_offer(
  p_offer_id UUID,
  p_accepting_player_id INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  debt_id UUID,
  new_creditor_id INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_offer RECORD;
  v_debt RECORD;
BEGIN
  -- Get offer
  SELECT * INTO v_offer
  FROM debt_offers
  WHERE id = p_offer_id;

  IF v_offer IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, 'Offer not found'::TEXT;
    RETURN;
  END IF;

  IF v_offer.status != 'open' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, ('Offer is not open (status: ' || v_offer.status || ')')::TEXT;
    RETURN;
  END IF;

  IF v_offer.expires_at IS NOT NULL AND v_offer.expires_at < NOW() THEN
    -- Mark as expired
    UPDATE debt_offers SET status = 'expired', resolved_at = NOW() WHERE id = p_offer_id;
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::INTEGER, 'Offer has expired'::TEXT;
    RETURN;
  END IF;

  -- Get debt to check debtor
  SELECT * INTO v_debt
  FROM player_debts
  WHERE id = v_offer.debt_id;

  IF p_accepting_player_id = v_debt.debtor_id THEN
    RETURN QUERY SELECT FALSE, v_offer.debt_id, NULL::INTEGER, 'Cannot accept offer for your own debt'::TEXT;
    RETURN;
  END IF;

  IF p_accepting_player_id = v_offer.offering_player_id THEN
    RETURN QUERY SELECT FALSE, v_offer.debt_id, NULL::INTEGER, 'Cannot accept your own offer'::TEXT;
    RETURN;
  END IF;

  -- Transfer the debt
  PERFORM transfer_debt(v_offer.debt_id, v_offer.offering_player_id, p_accepting_player_id, 'Debt offer accepted');

  -- Mark offer as accepted
  UPDATE debt_offers
  SET status = 'accepted',
      accepted_by_id = p_accepting_player_id,
      resolved_at = NOW()
  WHERE id = p_offer_id;

  RETURN QUERY SELECT TRUE, v_offer.debt_id, p_accepting_player_id, 'Debt offer accepted and debt transferred'::TEXT;
END;
$$;

COMMENT ON FUNCTION accept_debt_offer IS 'Accept a debt offer and receive the debt';

-- Function: Expire old debt offers
CREATE OR REPLACE FUNCTION expire_debt_offers()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE debt_offers
  SET status = 'expired',
      resolved_at = NOW()
  WHERE status = 'open'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_debt_offers IS 'Mark expired debt offers';

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active debts with player names
CREATE OR REPLACE VIEW active_debts_view AS
SELECT
  pd.id,
  pd.debt_type,
  pd.description,
  pd.value,
  pd.status,
  pd.context,
  pd.created_at,
  pd.called_in_at,
  pd.due_date,
  pd.creditor_id,
  c.username as creditor_name,
  pd.debtor_id,
  d.username as debtor_name,
  CASE
    WHEN pd.due_date IS NOT NULL AND pd.due_date < NOW() THEN TRUE
    ELSE FALSE
  END as is_overdue,
  CASE
    WHEN pd.due_date IS NOT NULL THEN EXTRACT(DAY FROM (pd.due_date - NOW()))::INTEGER
    ELSE NULL
  END as days_until_due
FROM player_debts pd
JOIN players c ON c.id = pd.creditor_id
JOIN players d ON d.id = pd.debtor_id
WHERE pd.status IN ('outstanding', 'called_in');

COMMENT ON VIEW active_debts_view IS 'Active debts with player names and status';

-- View: Open debt offers with details
CREATE OR REPLACE VIEW open_debt_offers_view AS
SELECT
  dof.id as offer_id,
  dof.debt_id,
  pd.debt_type,
  pd.description,
  pd.value as debt_value,
  dof.asking_price_type,
  dof.asking_price_value,
  dof.asking_price_details,
  dof.expires_at,
  dof.offering_player_id,
  op.username as offering_player_name,
  pd.debtor_id,
  db.username as debtor_name
FROM debt_offers dof
JOIN player_debts pd ON pd.id = dof.debt_id
JOIN players op ON op.id = dof.offering_player_id
JOIN players db ON db.id = pd.debtor_id
WHERE dof.status = 'open'
  AND (dof.expires_at IS NULL OR dof.expires_at > NOW());

COMMENT ON VIEW open_debt_offers_view IS 'Currently open debt offers';

-- ============================================================================
-- RLS POLICIES (Optional)
-- ============================================================================

-- Note: Enable these if using Supabase auth
-- Players can see debts where they are creditor OR debtor

-- ALTER TABLE player_debts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE debt_transfers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE debt_defaults ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE debt_offers ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "debts_visible_to_parties" ON player_debts
--   FOR SELECT
--   USING (creditor_id = current_user_id() OR debtor_id = current_user_id());

-- CREATE POLICY "transfers_visible_to_parties" ON debt_transfers
--   FOR SELECT
--   USING (
--     from_creditor_id = current_user_id()
--     OR to_creditor_id = current_user_id()
--     OR EXISTS (
--       SELECT 1 FROM player_debts pd
--       WHERE pd.id = debt_transfers.debt_id
--         AND (pd.creditor_id = current_user_id() OR pd.debtor_id = current_user_id())
--     )
--   );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- - Created debt_status_enum and debt_type_enum
-- - Created player_debts table for tracking debts/favors
-- - Created debt_transfers for tracking ownership changes
-- - Created debt_defaults for tracking broken promises
-- - Created debt_offers for debt marketplace
-- - Implemented functions:
--   * create_debt - Create new debt between players
--   * call_in_debt - Creditor demands fulfillment
--   * fulfill_debt - Debtor honors obligation
--   * default_on_debt - Record default and penalties
--   * transfer_debt - Change debt ownership
--   * forgive_debt - Creditor releases debtor
--   * check_overdue_debts - Find overdue debts
--   * get_player_debt_summary - Player debt statistics
--   * create_debt_offer - List debt for sale
--   * accept_debt_offer - Buy a debt
--   * expire_debt_offers - Cleanup expired offers
-- - Created views for active debts and open offers
