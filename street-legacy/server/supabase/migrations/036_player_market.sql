-- Street Legacy: Player Market Board
-- Migration: 036_player_market
-- Description: P2P marketplace for items, services, and favors

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status_enum') THEN
    CREATE TYPE listing_status_enum AS ENUM ('active', 'sold', 'expired', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type_enum') THEN
    CREATE TYPE listing_type_enum AS ENUM ('item', 'service', 'favor', 'intel');
  END IF;
END $$;

-- =============================================================================
-- MARKET LISTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Listing details
  listing_type listing_type_enum NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,

  -- Pricing
  asking_price BIGINT NOT NULL CHECK (asking_price > 0),
  listing_fee BIGINT DEFAULT 0,          -- 5% of asking price, paid upfront
  min_offer BIGINT,                       -- Optional: minimum acceptable offer

  -- Item data (for item listings)
  item_data JSONB,
  -- e.g., {"itemId": "weapon_pistol", "quantity": 1, "quality": 85}

  -- Service/favor details
  service_details JSONB,
  -- e.g., {"serviceType": "heist_help", "duration": "1 heist"}

  -- Status
  status listing_status_enum DEFAULT 'active',
  buyer_id UUID REFERENCES players(id),
  sold_price BIGINT,
  sold_at TIMESTAMPTZ,

  -- Location (optional - district-specific listings)
  district_id VARCHAR(50) REFERENCES districts(id),

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE market_listings IS 'Player-to-player marketplace listings';
COMMENT ON COLUMN market_listings.listing_fee IS '5% fee paid when creating listing';
COMMENT ON COLUMN market_listings.item_data IS 'JSON containing item details for item listings';

-- =============================================================================
-- MARKET OFFERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  offer_amount BIGINT NOT NULL CHECK (offer_amount > 0),
  message TEXT,

  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'withdrawn'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  UNIQUE(listing_id, buyer_id)  -- One offer per buyer per listing
);

COMMENT ON TABLE market_offers IS 'Offers on market listings';

-- =============================================================================
-- MARKET TRANSACTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES market_listings(id),

  seller_id UUID NOT NULL REFERENCES players(id),
  buyer_id UUID NOT NULL REFERENCES players(id),

  sale_price BIGINT NOT NULL,
  listing_fee BIGINT DEFAULT 0,
  transaction_fee BIGINT DEFAULT 0,      -- 2% fee on sale

  listing_type listing_type_enum NOT NULL,
  item_data JSONB,

  completed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE market_transactions IS 'Completed market sales';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_status ON market_listings(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_market_listings_type ON market_listings(listing_type, status);
CREATE INDEX IF NOT EXISTS idx_market_listings_district ON market_listings(district_id) WHERE district_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_listings_expires ON market_listings(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_market_listings_price ON market_listings(asking_price) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_market_offers_listing ON market_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_market_offers_buyer ON market_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_market_offers_pending ON market_offers(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_market_transactions_seller ON market_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_market_transactions_buyer ON market_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_market_transactions_time ON market_transactions(completed_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

/**
 * Calculate listing fee (5% of asking price)
 */
CREATE OR REPLACE FUNCTION calculate_listing_fee(p_asking_price BIGINT)
RETURNS BIGINT AS $$
BEGIN
  RETURN GREATEST(100, ROUND(p_asking_price * 0.05));  -- Minimum $100 fee
END;
$$ LANGUAGE plpgsql;

/**
 * Calculate transaction fee (2% of sale price)
 */
CREATE OR REPLACE FUNCTION calculate_transaction_fee(p_sale_price BIGINT)
RETURNS BIGINT AS $$
BEGIN
  RETURN GREATEST(50, ROUND(p_sale_price * 0.02));  -- Minimum $50 fee
END;
$$ LANGUAGE plpgsql;

/**
 * Create a new market listing
 */
CREATE OR REPLACE FUNCTION create_market_listing(
  p_seller_id UUID,
  p_listing_type listing_type_enum,
  p_title VARCHAR(100),
  p_description TEXT,
  p_asking_price BIGINT,
  p_item_data JSONB DEFAULT NULL,
  p_service_details JSONB DEFAULT NULL,
  p_district_id VARCHAR(50) DEFAULT NULL,
  p_duration_days INT DEFAULT 7
)
RETURNS TABLE (
  success BOOLEAN,
  listing_id UUID,
  fee_charged BIGINT,
  error_message TEXT
) AS $$
DECLARE
  v_fee BIGINT;
  v_seller_cash BIGINT;
  v_listing_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate fee
  v_fee := calculate_listing_fee(p_asking_price);

  -- Check seller has enough cash for fee
  SELECT cash_balance INTO v_seller_cash FROM players WHERE id = p_seller_id;

  IF v_seller_cash IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::BIGINT, 'Seller not found'::TEXT;
    RETURN;
  END IF;

  IF v_seller_cash < v_fee THEN
    RETURN QUERY SELECT false, NULL::UUID, v_fee, 'Insufficient funds for listing fee'::TEXT;
    RETURN;
  END IF;

  -- Deduct fee from seller
  UPDATE players SET cash_balance = cash_balance - v_fee WHERE id = p_seller_id;

  -- Calculate expiry
  v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;

  -- Create listing
  INSERT INTO market_listings (
    seller_id, listing_type, title, description, asking_price,
    listing_fee, item_data, service_details, district_id, expires_at
  ) VALUES (
    p_seller_id, p_listing_type, p_title, p_description, p_asking_price,
    v_fee, p_item_data, p_service_details, p_district_id, v_expires_at
  )
  RETURNING id INTO v_listing_id;

  RETURN QUERY SELECT true, v_listing_id, v_fee, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Purchase a listing directly at asking price
 */
CREATE OR REPLACE FUNCTION purchase_listing(
  p_listing_id UUID,
  p_buyer_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  transaction_id UUID,
  amount_paid BIGINT,
  error_message TEXT
) AS $$
DECLARE
  v_listing RECORD;
  v_buyer_cash BIGINT;
  v_transaction_fee BIGINT;
  v_seller_receives BIGINT;
  v_transaction_id UUID;
BEGIN
  -- Get listing
  SELECT * INTO v_listing FROM market_listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::BIGINT, 'Listing not found'::TEXT;
    RETURN;
  END IF;

  IF v_listing.status != 'active' THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::BIGINT, 'Listing is no longer available'::TEXT;
    RETURN;
  END IF;

  IF v_listing.seller_id = p_buyer_id THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::BIGINT, 'Cannot buy your own listing'::TEXT;
    RETURN;
  END IF;

  -- Check buyer has enough cash
  SELECT cash_balance INTO v_buyer_cash FROM players WHERE id = p_buyer_id FOR UPDATE;

  IF v_buyer_cash < v_listing.asking_price THEN
    RETURN QUERY SELECT false, NULL::UUID, v_listing.asking_price, 'Insufficient funds'::TEXT;
    RETURN;
  END IF;

  -- Calculate fees
  v_transaction_fee := calculate_transaction_fee(v_listing.asking_price);
  v_seller_receives := v_listing.asking_price - v_transaction_fee;

  -- Transfer funds
  UPDATE players SET cash_balance = cash_balance - v_listing.asking_price WHERE id = p_buyer_id;
  UPDATE players SET cash_balance = cash_balance + v_seller_receives WHERE id = v_listing.seller_id;

  -- Update listing
  UPDATE market_listings SET
    status = 'sold',
    buyer_id = p_buyer_id,
    sold_price = v_listing.asking_price,
    sold_at = NOW(),
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- Record transaction
  INSERT INTO market_transactions (
    listing_id, seller_id, buyer_id, sale_price, listing_fee,
    transaction_fee, listing_type, item_data
  ) VALUES (
    p_listing_id, v_listing.seller_id, p_buyer_id, v_listing.asking_price,
    v_listing.listing_fee, v_transaction_fee, v_listing.listing_type, v_listing.item_data
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_transaction_id, v_listing.asking_price, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Cancel a listing (refunds 50% of listing fee)
 */
CREATE OR REPLACE FUNCTION cancel_listing(
  p_listing_id UUID,
  p_seller_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  refund_amount BIGINT,
  error_message TEXT
) AS $$
DECLARE
  v_listing RECORD;
  v_refund BIGINT;
BEGIN
  SELECT * INTO v_listing FROM market_listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::BIGINT, 'Listing not found'::TEXT;
    RETURN;
  END IF;

  IF v_listing.seller_id != p_seller_id THEN
    RETURN QUERY SELECT false, 0::BIGINT, 'Not your listing'::TEXT;
    RETURN;
  END IF;

  IF v_listing.status != 'active' THEN
    RETURN QUERY SELECT false, 0::BIGINT, 'Listing is not active'::TEXT;
    RETURN;
  END IF;

  -- Refund 50% of listing fee
  v_refund := ROUND(v_listing.listing_fee * 0.5);

  -- Update listing
  UPDATE market_listings SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- Refund seller
  UPDATE players SET cash_balance = cash_balance + v_refund WHERE id = p_seller_id;

  RETURN QUERY SELECT true, v_refund, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

/**
 * Get active listings with filters
 */
CREATE OR REPLACE FUNCTION get_market_listings(
  p_listing_type listing_type_enum DEFAULT NULL,
  p_district_id VARCHAR(50) DEFAULT NULL,
  p_max_price BIGINT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_username VARCHAR(30),
  listing_type listing_type_enum,
  title VARCHAR(100),
  description TEXT,
  asking_price BIGINT,
  item_data JSONB,
  service_details JSONB,
  district_id VARCHAR(50),
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  time_remaining INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.seller_id,
    p.username AS seller_username,
    ml.listing_type,
    ml.title,
    ml.description,
    ml.asking_price,
    ml.item_data,
    ml.service_details,
    ml.district_id,
    ml.created_at,
    ml.expires_at,
    GREATEST(ml.expires_at - NOW(), INTERVAL '0 seconds') AS time_remaining
  FROM market_listings ml
  JOIN players p ON ml.seller_id = p.id
  WHERE ml.status = 'active'
  AND ml.expires_at > NOW()
  AND (p_listing_type IS NULL OR ml.listing_type = p_listing_type)
  AND (p_district_id IS NULL OR ml.district_id = p_district_id OR ml.district_id IS NULL)
  AND (p_max_price IS NULL OR ml.asking_price <= p_max_price)
  AND (p_search IS NULL OR ml.title ILIKE '%' || p_search || '%' OR ml.description ILIKE '%' || p_search || '%')
  ORDER BY ml.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

/**
 * Expire old listings
 */
CREATE OR REPLACE FUNCTION expire_market_listings()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE market_listings SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'active'
  AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Get player's active listings
 */
CREATE OR REPLACE FUNCTION get_player_listings(p_player_id UUID)
RETURNS TABLE (
  id UUID,
  listing_type listing_type_enum,
  title VARCHAR(100),
  asking_price BIGINT,
  status listing_status_enum,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  offer_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.listing_type,
    ml.title,
    ml.asking_price,
    ml.status,
    ml.created_at,
    ml.expires_at,
    (SELECT COUNT(*) FROM market_offers mo WHERE mo.listing_id = ml.id AND mo.status = 'pending') AS offer_count
  FROM market_listings ml
  WHERE ml.seller_id = p_player_id
  ORDER BY ml.created_at DESC;
END;
$$ LANGUAGE plpgsql;

/**
 * Get market stats
 */
CREATE OR REPLACE FUNCTION get_market_stats()
RETURNS TABLE (
  active_listings BIGINT,
  total_volume_24h BIGINT,
  avg_price BIGINT,
  listings_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM market_listings WHERE status = 'active')::BIGINT,
    (SELECT COALESCE(SUM(sale_price), 0) FROM market_transactions WHERE completed_at > NOW() - INTERVAL '24 hours')::BIGINT,
    (SELECT COALESCE(AVG(asking_price), 0)::BIGINT FROM market_listings WHERE status = 'active'),
    (SELECT jsonb_object_agg(listing_type, cnt) FROM (
      SELECT listing_type, COUNT(*) as cnt FROM market_listings WHERE status = 'active' GROUP BY listing_type
    ) sub);
END;
$$ LANGUAGE plpgsql;
