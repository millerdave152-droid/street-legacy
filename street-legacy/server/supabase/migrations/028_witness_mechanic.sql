-- Street Legacy: Witness Mechanic System Migration
-- Migration: 028_witness_mechanic
-- Description: Creates a social proof system where players can witness and verify events
--              Verified witnesses create testimonials that boost reputation

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE witness_status_enum AS ENUM (
    'potential',   -- Player was in district, could verify
    'verified',    -- Player confirmed they witnessed the event
    'disputed',    -- Player disputes the event occurred
    'expired'      -- Verification window passed without action
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- WITNESSED EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS witnessed_events (
  id SERIAL PRIMARY KEY,

  -- Event details
  event_type VARCHAR(50) NOT NULL,  -- crime_committed, heist, pvp_victory, property_purchase, crew_battle
  actor_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,  -- For PvP events
  district_id VARCHAR(50) NOT NULL,

  -- Description and severity
  event_description TEXT,
  event_severity INTEGER DEFAULT 5 CHECK (event_severity >= 1 AND event_severity <= 10),

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Verification window (24 hours from creation)
  verification_window_ends TIMESTAMPTZ,

  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table comments
COMMENT ON TABLE witnessed_events IS 'Events that can be witnessed and verified by other players for social proof';
COMMENT ON COLUMN witnessed_events.event_type IS 'Type of event: crime_committed, heist, pvp_victory, property_purchase, crew_battle';
COMMENT ON COLUMN witnessed_events.actor_player_id IS 'The player who performed the action';
COMMENT ON COLUMN witnessed_events.target_player_id IS 'Target player for PvP events';
COMMENT ON COLUMN witnessed_events.event_severity IS 'How significant the event is (1-10)';
COMMENT ON COLUMN witnessed_events.verification_window_ends IS '24 hours from creation, after which witnesses cannot verify';

-- Indexes for witnessed_events
CREATE INDEX IF NOT EXISTS idx_witnessed_events_district_occurred ON witnessed_events(district_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_witnessed_events_actor ON witnessed_events(actor_player_id);
CREATE INDEX IF NOT EXISTS idx_witnessed_events_target ON witnessed_events(target_player_id) WHERE target_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_witnessed_events_window ON witnessed_events(verification_window_ends);
CREATE INDEX IF NOT EXISTS idx_witnessed_events_type ON witnessed_events(event_type);

-- =============================================================================
-- EVENT WITNESSES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_witnesses (
  id SERIAL PRIMARY KEY,

  -- References
  witnessed_event_id INTEGER NOT NULL REFERENCES witnessed_events(id) ON DELETE CASCADE,
  witness_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Witness status
  witness_status witness_status_enum DEFAULT 'potential',
  verified_at TIMESTAMPTZ,

  -- Optional testimony
  testimony TEXT,

  -- Reputation tracking
  reputation_bonus_given BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one witness record per player per event
  CONSTRAINT unique_event_witness UNIQUE (witnessed_event_id, witness_player_id)
);

-- Table comments
COMMENT ON TABLE event_witnesses IS 'Tracks which players witnessed events and their verification status';
COMMENT ON COLUMN event_witnesses.witness_status IS 'Status: potential (can verify), verified (confirmed), disputed (challenged), expired (window passed)';
COMMENT ON COLUMN event_witnesses.testimony IS 'Optional comment from the witness about what they saw';
COMMENT ON COLUMN event_witnesses.reputation_bonus_given IS 'Whether the actor received reputation bonus from this verification';

-- Indexes for event_witnesses
CREATE INDEX IF NOT EXISTS idx_event_witnesses_witness ON event_witnesses(witness_player_id);
CREATE INDEX IF NOT EXISTS idx_event_witnesses_event ON event_witnesses(witnessed_event_id);
CREATE INDEX IF NOT EXISTS idx_event_witnesses_status ON event_witnesses(witness_status);
CREATE INDEX IF NOT EXISTS idx_event_witnesses_potential ON event_witnesses(witnessed_event_id, witness_status) WHERE witness_status = 'potential';

-- =============================================================================
-- PLAYER TESTIMONIALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_testimonials (
  id SERIAL PRIMARY KEY,

  -- Player references
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,  -- The actor who received testimonial
  witness_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,  -- Who gave the testimonial

  -- Event reference (may be null if event deleted)
  witnessed_event_id INTEGER REFERENCES witnessed_events(id) ON DELETE SET NULL,

  -- Testimonial content
  testimonial_text TEXT NOT NULL,
  event_type VARCHAR(50),

  -- Display options
  featured BOOLEAN DEFAULT FALSE,  -- Player can feature on their profile

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table comments
COMMENT ON TABLE player_testimonials IS 'Verified witness testimonials that appear on player profiles';
COMMENT ON COLUMN player_testimonials.player_id IS 'The player who received this testimonial (the actor)';
COMMENT ON COLUMN player_testimonials.witness_player_id IS 'The player who gave this testimonial (the witness)';
COMMENT ON COLUMN player_testimonials.featured IS 'Whether the player has featured this testimonial on their profile';

-- Indexes for player_testimonials
CREATE INDEX IF NOT EXISTS idx_player_testimonials_player ON player_testimonials(player_id, featured DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_testimonials_witness ON player_testimonials(witness_player_id);
CREATE INDEX IF NOT EXISTS idx_player_testimonials_event ON player_testimonials(witnessed_event_id) WHERE witnessed_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_testimonials_type ON player_testimonials(event_type);

-- =============================================================================
-- FUNCTION: Create Witnessed Event
-- =============================================================================

CREATE OR REPLACE FUNCTION create_witnessed_event(
  p_event_type VARCHAR(50),
  p_actor_id INTEGER,
  p_district_id VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_severity INTEGER DEFAULT 5,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_target_id INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_event_id INTEGER;
  v_witness_record RECORD;
  v_witness_count INTEGER := 0;
BEGIN
  -- Insert the witnessed event with 24-hour verification window
  INSERT INTO witnessed_events (
    event_type,
    actor_player_id,
    target_player_id,
    district_id,
    event_description,
    event_severity,
    metadata,
    verification_window_ends
  ) VALUES (
    p_event_type,
    p_actor_id,
    p_target_id,
    p_district_id,
    p_description,
    LEAST(GREATEST(p_severity, 1), 10),  -- Clamp between 1-10
    p_metadata,
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id INTO v_event_id;

  -- Find potential witnesses: players in the same district
  -- who were active recently (within last 30 minutes) and aren't the actor
  FOR v_witness_record IN
    SELECT DISTINCT p.id
    FROM players p
    WHERE p.current_district = p_district_id
      AND p.id != p_actor_id
      AND p.id != COALESCE(p_target_id, 0)
      AND p.last_active > NOW() - INTERVAL '30 minutes'
    LIMIT 20  -- Cap potential witnesses to prevent spam
  LOOP
    INSERT INTO event_witnesses (witnessed_event_id, witness_player_id, witness_status)
    VALUES (v_event_id, v_witness_record.id, 'potential')
    ON CONFLICT (witnessed_event_id, witness_player_id) DO NOTHING;

    v_witness_count := v_witness_count + 1;
  END LOOP;

  -- Log the creation
  RAISE NOTICE 'Created witnessed event % with % potential witnesses', v_event_id, v_witness_count;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION create_witnessed_event IS 'Creates a witnessed event and finds potential witnesses in the district';

-- =============================================================================
-- FUNCTION: Verify Witness
-- =============================================================================

CREATE OR REPLACE FUNCTION verify_witness(
  p_witnessed_event_id INTEGER,
  p_witness_player_id INTEGER,
  p_testimony TEXT DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  testimonial_id INTEGER,
  reputation_bonus INTEGER
) AS $$
DECLARE
  v_event RECORD;
  v_witness RECORD;
  v_testimonial_id INTEGER;
  v_reputation_bonus INTEGER := 0;
  v_first_verification BOOLEAN;
  v_testimonial_text TEXT;
  v_witness_username TEXT;
BEGIN
  -- Get the event details
  SELECT * INTO v_event
  FROM witnessed_events
  WHERE id = p_witnessed_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Event not found'::TEXT, NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Check verification window
  IF v_event.verification_window_ends < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Verification window has expired'::TEXT, NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Get the witness record
  SELECT * INTO v_witness
  FROM event_witnesses
  WHERE witnessed_event_id = p_witnessed_event_id
    AND witness_player_id = p_witness_player_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'You are not a potential witness for this event'::TEXT, NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Check witness status
  IF v_witness.witness_status != 'potential' THEN
    RETURN QUERY SELECT FALSE, ('You have already ' || v_witness.witness_status::TEXT || ' this event')::TEXT, NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Check if this is the first verification (for reputation bonus)
  SELECT NOT EXISTS(
    SELECT 1 FROM event_witnesses
    WHERE witnessed_event_id = p_witnessed_event_id
      AND witness_status = 'verified'
  ) INTO v_first_verification;

  -- Update witness to verified
  UPDATE event_witnesses
  SET witness_status = 'verified',
      verified_at = NOW(),
      testimony = p_testimony,
      reputation_bonus_given = v_first_verification
  WHERE id = v_witness.id;

  -- Get witness username for testimonial
  SELECT username INTO v_witness_username
  FROM players
  WHERE id = p_witness_player_id;

  -- Generate testimonial text
  IF p_testimony IS NOT NULL AND p_testimony != '' THEN
    v_testimonial_text := p_testimony;
  ELSE
    v_testimonial_text := 'I witnessed this ' || v_event.event_type || ' in ' || v_event.district_id || '.';
  END IF;

  -- Create testimonial for the actor
  INSERT INTO player_testimonials (
    player_id,
    witness_player_id,
    witnessed_event_id,
    testimonial_text,
    event_type
  ) VALUES (
    v_event.actor_player_id,
    p_witness_player_id,
    p_witnessed_event_id,
    v_testimonial_text,
    v_event.event_type
  )
  RETURNING id INTO v_testimonial_id;

  -- Calculate reputation bonus (first verification = bigger bonus)
  IF v_first_verification THEN
    v_reputation_bonus := v_event.event_severity * 2;  -- First witness gets double
  ELSE
    v_reputation_bonus := v_event.event_severity;
  END IF;

  -- Award reputation to actor (if reputation system exists)
  -- This integrates with the contextual reputation system
  BEGIN
    PERFORM modify_reputation(
      v_event.actor_player_id,
      'district'::reputation_type_enum,
      v_event.district_id,
      'respect'::reputation_dimension_enum,
      v_reputation_bonus,
      'Event witnessed: ' || v_event.event_type,
      p_witness_player_id
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Reputation system may not be available, continue anyway
      RAISE NOTICE 'Could not award reputation bonus: %', SQLERRM;
  END;

  RETURN QUERY SELECT TRUE, 'Successfully verified as witness'::TEXT, v_testimonial_id, v_reputation_bonus;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION verify_witness IS 'Allows a potential witness to verify they saw an event, creating a testimonial';

-- =============================================================================
-- FUNCTION: Dispute Witness
-- =============================================================================

CREATE OR REPLACE FUNCTION dispute_witness(
  p_witnessed_event_id INTEGER,
  p_witness_player_id INTEGER,
  p_reason TEXT DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_event RECORD;
  v_witness RECORD;
BEGIN
  -- Get the event details
  SELECT * INTO v_event
  FROM witnessed_events
  WHERE id = p_witnessed_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Event not found'::TEXT;
    RETURN;
  END IF;

  -- Check verification window
  IF v_event.verification_window_ends < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Verification window has expired'::TEXT;
    RETURN;
  END IF;

  -- Get the witness record
  SELECT * INTO v_witness
  FROM event_witnesses
  WHERE witnessed_event_id = p_witnessed_event_id
    AND witness_player_id = p_witness_player_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'You are not a potential witness for this event'::TEXT;
    RETURN;
  END IF;

  -- Check witness status
  IF v_witness.witness_status != 'potential' THEN
    RETURN QUERY SELECT FALSE, ('You have already ' || v_witness.witness_status::TEXT || ' this event')::TEXT;
    RETURN;
  END IF;

  -- Update witness to disputed
  UPDATE event_witnesses
  SET witness_status = 'disputed',
      verified_at = NOW(),
      testimony = p_reason
  WHERE id = v_witness.id;

  RETURN QUERY SELECT TRUE, 'Event disputed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION dispute_witness IS 'Allows a potential witness to dispute that an event occurred';

-- =============================================================================
-- FUNCTION: Get Potential Witnesses
-- =============================================================================

CREATE OR REPLACE FUNCTION get_potential_witnesses(
  p_witnessed_event_id INTEGER
) RETURNS TABLE(
  witness_id INTEGER,
  witness_player_id INTEGER,
  witness_username VARCHAR(50),
  witness_status witness_status_enum,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ew.id as witness_id,
    ew.witness_player_id,
    p.username as witness_username,
    ew.witness_status,
    ew.created_at
  FROM event_witnesses ew
  JOIN players p ON p.id = ew.witness_player_id
  WHERE ew.witnessed_event_id = p_witnessed_event_id
    AND ew.witness_status = 'potential'
  ORDER BY ew.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_potential_witnesses IS 'Returns list of potential witnesses who have not yet verified or disputed';

-- =============================================================================
-- FUNCTION: Get Event Witnesses (All)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_event_witnesses(
  p_witnessed_event_id INTEGER
) RETURNS TABLE(
  witness_id INTEGER,
  witness_player_id INTEGER,
  witness_username VARCHAR(50),
  witness_status witness_status_enum,
  testimony TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ew.id as witness_id,
    ew.witness_player_id,
    p.username as witness_username,
    ew.witness_status,
    ew.testimony,
    ew.verified_at,
    ew.created_at
  FROM event_witnesses ew
  JOIN players p ON p.id = ew.witness_player_id
  WHERE ew.witnessed_event_id = p_witnessed_event_id
  ORDER BY
    CASE ew.witness_status
      WHEN 'verified' THEN 1
      WHEN 'disputed' THEN 2
      WHEN 'potential' THEN 3
      ELSE 4
    END,
    ew.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_event_witnesses IS 'Returns all witnesses for an event with their status';

-- =============================================================================
-- FUNCTION: Expire Witness Windows
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_witness_windows()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  -- Update all potential witnesses to expired for events past their window
  UPDATE event_witnesses ew
  SET witness_status = 'expired'
  FROM witnessed_events we
  WHERE ew.witnessed_event_id = we.id
    AND ew.witness_status = 'potential'
    AND we.verification_window_ends < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RAISE NOTICE 'Expired % witness records', v_expired_count;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION expire_witness_windows IS 'Expires potential witnesses whose verification window has passed (run hourly)';

-- =============================================================================
-- FUNCTION: Get Player Testimonials
-- =============================================================================

CREATE OR REPLACE FUNCTION get_player_testimonials(
  p_player_id INTEGER,
  p_featured_only BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE(
  testimonial_id INTEGER,
  witness_player_id INTEGER,
  witness_username VARCHAR(50),
  testimonial_text TEXT,
  event_type VARCHAR(50),
  featured BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id as testimonial_id,
    pt.witness_player_id,
    p.username as witness_username,
    pt.testimonial_text,
    pt.event_type,
    pt.featured,
    pt.created_at
  FROM player_testimonials pt
  JOIN players p ON p.id = pt.witness_player_id
  WHERE pt.player_id = p_player_id
    AND (NOT p_featured_only OR pt.featured = TRUE)
  ORDER BY pt.featured DESC, pt.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_player_testimonials IS 'Returns testimonials for a player profile, optionally only featured ones';

-- =============================================================================
-- FUNCTION: Toggle Testimonial Featured
-- =============================================================================

CREATE OR REPLACE FUNCTION toggle_testimonial_featured(
  p_testimonial_id INTEGER,
  p_player_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_new_featured BOOLEAN;
BEGIN
  -- Update only if the testimonial belongs to the player
  UPDATE player_testimonials
  SET featured = NOT featured
  WHERE id = p_testimonial_id
    AND player_id = p_player_id
  RETURNING featured INTO v_new_featured;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Testimonial not found or does not belong to player';
  END IF;

  RETURN v_new_featured;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION toggle_testimonial_featured IS 'Toggles whether a testimonial is featured on a player profile';

-- =============================================================================
-- FUNCTION: Get Pending Verifications for Witness
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_verifications(
  p_witness_player_id INTEGER
) RETURNS TABLE(
  event_id INTEGER,
  event_type VARCHAR(50),
  actor_player_id INTEGER,
  actor_username VARCHAR(50),
  district_id VARCHAR(50),
  event_description TEXT,
  event_severity INTEGER,
  verification_window_ends TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id as event_id,
    we.event_type,
    we.actor_player_id,
    p.username as actor_username,
    we.district_id,
    we.event_description,
    we.event_severity,
    we.verification_window_ends,
    we.occurred_at
  FROM witnessed_events we
  JOIN event_witnesses ew ON ew.witnessed_event_id = we.id
  JOIN players p ON p.id = we.actor_player_id
  WHERE ew.witness_player_id = p_witness_player_id
    AND ew.witness_status = 'potential'
    AND we.verification_window_ends > NOW()
  ORDER BY we.occurred_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_pending_verifications IS 'Returns events awaiting verification from a specific witness';

-- =============================================================================
-- FUNCTION: Get Witness Statistics
-- =============================================================================

CREATE OR REPLACE FUNCTION get_witness_stats(
  p_player_id INTEGER
) RETURNS TABLE(
  events_witnessed INTEGER,
  events_verified INTEGER,
  events_disputed INTEGER,
  testimonials_given INTEGER,
  testimonials_received INTEGER,
  featured_testimonials INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM event_witnesses WHERE witness_player_id = p_player_id),
    (SELECT COUNT(*)::INTEGER FROM event_witnesses WHERE witness_player_id = p_player_id AND witness_status = 'verified'),
    (SELECT COUNT(*)::INTEGER FROM event_witnesses WHERE witness_player_id = p_player_id AND witness_status = 'disputed'),
    (SELECT COUNT(*)::INTEGER FROM player_testimonials WHERE witness_player_id = p_player_id),
    (SELECT COUNT(*)::INTEGER FROM player_testimonials WHERE player_id = p_player_id),
    (SELECT COUNT(*)::INTEGER FROM player_testimonials WHERE player_id = p_player_id AND featured = TRUE);
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_witness_stats IS 'Returns witness/testimonial statistics for a player';

-- =============================================================================
-- RLS POLICIES (Commented out - using custom auth)
-- =============================================================================

-- Note: RLS policies are disabled since this database uses custom auth
-- instead of Supabase Auth. Access control is handled at the API layer.

-- ALTER TABLE witnessed_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE event_witnesses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_testimonials ENABLE ROW LEVEL SECURITY;

-- Players can view witnessed events in their district
-- DROP POLICY IF EXISTS witnessed_events_select ON witnessed_events;
-- CREATE POLICY witnessed_events_select ON witnessed_events
--   FOR SELECT USING (true);

-- Service role can insert witnessed events
-- DROP POLICY IF EXISTS witnessed_events_insert ON witnessed_events;
-- CREATE POLICY witnessed_events_insert ON witnessed_events
--   FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Players can view witness records
-- DROP POLICY IF EXISTS event_witnesses_select ON event_witnesses;
-- CREATE POLICY event_witnesses_select ON event_witnesses
--   FOR SELECT USING (true);

-- Players can only verify their own witness records
-- DROP POLICY IF EXISTS event_witnesses_update ON event_witnesses;
-- CREATE POLICY event_witnesses_update ON event_witnesses
--   FOR UPDATE USING (witness_player_id = auth.uid());

-- Players can view testimonials
-- DROP POLICY IF EXISTS player_testimonials_select ON player_testimonials;
-- CREATE POLICY player_testimonials_select ON player_testimonials
--   FOR SELECT USING (true);

-- Players can toggle featured on their own testimonials
-- DROP POLICY IF EXISTS player_testimonials_update ON player_testimonials;
-- CREATE POLICY player_testimonials_update ON player_testimonials
--   FOR UPDATE USING (player_id = auth.uid());

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$ BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Witness Mechanic System migration completed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - witnessed_events (events that can be witnessed)';
  RAISE NOTICE '  - event_witnesses (witness records with status)';
  RAISE NOTICE '  - player_testimonials (verified testimonials for profiles)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - create_witnessed_event()';
  RAISE NOTICE '  - verify_witness()';
  RAISE NOTICE '  - dispute_witness()';
  RAISE NOTICE '  - get_potential_witnesses()';
  RAISE NOTICE '  - get_event_witnesses()';
  RAISE NOTICE '  - expire_witness_windows()';
  RAISE NOTICE '  - get_player_testimonials()';
  RAISE NOTICE '  - toggle_testimonial_featured()';
  RAISE NOTICE '  - get_pending_verifications()';
  RAISE NOTICE '  - get_witness_stats()';
  RAISE NOTICE '========================================';
END $$;
