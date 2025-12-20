-- Street Legacy: Contextual Reputation System Migration
-- Migration: 013_contextual_reputation
-- Description: Creates multi-dimensional reputation system with respect, fear, trust, and heat
--              Tracks player reputation across districts, factions, crews, and other players
-- Run: psql -h localhost -U postgres -d street_legacy -f 013_contextual_reputation.sql

-- =============================================================================
-- ENUMS (with IF NOT EXISTS safety)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE reputation_type_enum AS ENUM (
    'district',   -- Reputation within a district
    'faction',    -- Reputation with a faction/gang
    'crew',       -- Reputation with a player crew
    'player'      -- Reputation with an individual player
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reputation_dimension_enum AS ENUM (
    'respect',    -- Earned through skill, success, and fair dealing
    'fear',       -- Earned through violence and intimidation
    'trust',      -- Earned through loyalty and keeping promises
    'heat'        -- Negative attention from authorities/enemies
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- REPUTATION FACTIONS TABLE (for contextual reputation system)
-- Note: This is separate from the Phase 10 factions table which tracks
-- the legacy faction system. This table stores faction metadata for
-- the contextual reputation propagation system.
-- =============================================================================

CREATE TABLE IF NOT EXISTS reputation_factions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Territory
  home_district VARCHAR(50) NOT NULL,
  allied_districts TEXT[] DEFAULT '{}',

  -- Values that affect reputation gains
  values_loyalty BOOLEAN DEFAULT true,     -- Rewards loyalty, punishes betrayal
  values_violence BOOLEAN DEFAULT false,   -- Respects violence, fear builds faster
  values_business BOOLEAN DEFAULT true,    -- Respects business acumen, deal-making

  -- Relationships with other factions
  allies TEXT[] DEFAULT '{}',              -- Faction IDs of allies
  enemies TEXT[] DEFAULT '{}',             -- Faction IDs of enemies

  -- Metadata
  icon VARCHAR(10) DEFAULT '👥',
  color VARCHAR(7) DEFAULT '#6b7280',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on home district
CREATE INDEX IF NOT EXISTS idx_reputation_factions_home_district ON reputation_factions(home_district);

-- =============================================================================
-- PLAYER REPUTATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_reputations (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- What type of entity this reputation is with
  reputation_type reputation_type_enum NOT NULL,
  target_id VARCHAR(50) NOT NULL,  -- district_id, faction_id, crew_id, or player_id

  -- Multi-dimensional reputation scores (-100 to 100, except heat 0-100)
  respect INTEGER DEFAULT 0 CHECK (respect >= -100 AND respect <= 100),
  fear INTEGER DEFAULT 0 CHECK (fear >= -100 AND fear <= 100),
  trust INTEGER DEFAULT 0 CHECK (trust >= -100 AND trust <= 100),
  heat INTEGER DEFAULT 0 CHECK (heat >= 0 AND heat <= 100),

  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one reputation record per player-type-target combo
  CONSTRAINT unique_player_reputation UNIQUE (player_id, reputation_type, target_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_player_reputations_player ON player_reputations(player_id);
CREATE INDEX IF NOT EXISTS idx_player_reputations_type ON player_reputations(reputation_type);
CREATE INDEX IF NOT EXISTS idx_player_reputations_target ON player_reputations(target_id);
CREATE INDEX IF NOT EXISTS idx_player_reputations_player_type ON player_reputations(player_id, reputation_type);
CREATE INDEX IF NOT EXISTS idx_player_reputations_respect ON player_reputations(respect DESC);
CREATE INDEX IF NOT EXISTS idx_player_reputations_fear ON player_reputations(fear DESC);

-- =============================================================================
-- REPUTATION EVENTS TABLE (Audit Log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS reputation_events (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- What reputation was affected
  reputation_type reputation_type_enum NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  dimension reputation_dimension_enum NOT NULL,

  -- Change details
  change_amount INTEGER NOT NULL,
  old_value INTEGER,
  new_value INTEGER,
  reason VARCHAR(100) NOT NULL,

  -- Related entities
  related_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying event history
CREATE INDEX IF NOT EXISTS idx_reputation_events_player_created ON reputation_events(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_events_target ON reputation_events(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_events_type ON reputation_events(reputation_type);
CREATE INDEX IF NOT EXISTS idx_reputation_events_dimension ON reputation_events(dimension);
CREATE INDEX IF NOT EXISTS idx_reputation_events_related_player ON reputation_events(related_player_id) WHERE related_player_id IS NOT NULL;

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_player_reputations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_player_reputations_updated_at ON player_reputations;
CREATE TRIGGER trigger_player_reputations_updated_at
  BEFORE UPDATE ON player_reputations
  FOR EACH ROW
  EXECUTE FUNCTION update_player_reputations_updated_at();

CREATE OR REPLACE FUNCTION update_reputation_factions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reputation_factions_updated_at ON reputation_factions;
CREATE TRIGGER trigger_reputation_factions_updated_at
  BEFORE UPDATE ON reputation_factions
  FOR EACH ROW
  EXECUTE FUNCTION update_reputation_factions_updated_at();

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Get or create reputation record for a player
CREATE OR REPLACE FUNCTION get_or_create_reputation(
  p_player_id INTEGER,
  p_reputation_type reputation_type_enum,
  p_target_id VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
  v_reputation_id INTEGER;
BEGIN
  -- Try to get existing reputation
  SELECT id INTO v_reputation_id
  FROM player_reputations
  WHERE player_id = p_player_id
    AND reputation_type = p_reputation_type
    AND target_id = p_target_id;

  -- Create if not exists
  IF v_reputation_id IS NULL THEN
    INSERT INTO player_reputations (player_id, reputation_type, target_id)
    VALUES (p_player_id, p_reputation_type, p_target_id)
    RETURNING id INTO v_reputation_id;
  END IF;

  RETURN v_reputation_id;
END;
$$ LANGUAGE plpgsql;

-- Modify reputation with event logging
CREATE OR REPLACE FUNCTION modify_reputation(
  p_player_id INTEGER,
  p_reputation_type reputation_type_enum,
  p_target_id VARCHAR(50),
  p_dimension reputation_dimension_enum,
  p_change_amount INTEGER,
  p_reason VARCHAR(100),
  p_related_player_id INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE(
  reputation_id INTEGER,
  old_value INTEGER,
  new_value INTEGER,
  clamped BOOLEAN
) AS $$
DECLARE
  v_reputation_id INTEGER;
  v_old_value INTEGER;
  v_new_value INTEGER;
  v_clamped BOOLEAN := FALSE;
  v_min_value INTEGER;
  v_max_value INTEGER;
BEGIN
  -- Ensure reputation record exists
  v_reputation_id := get_or_create_reputation(p_player_id, p_reputation_type, p_target_id);

  -- Determine min/max based on dimension
  IF p_dimension = 'heat' THEN
    v_min_value := 0;
    v_max_value := 100;
  ELSE
    v_min_value := -100;
    v_max_value := 100;
  END IF;

  -- Get current value and calculate new value
  EXECUTE format(
    'SELECT %I FROM player_reputations WHERE id = $1',
    p_dimension::TEXT
  ) INTO v_old_value USING v_reputation_id;

  v_new_value := v_old_value + p_change_amount;

  -- Clamp to valid range
  IF v_new_value < v_min_value THEN
    v_new_value := v_min_value;
    v_clamped := TRUE;
  ELSIF v_new_value > v_max_value THEN
    v_new_value := v_max_value;
    v_clamped := TRUE;
  END IF;

  -- Update reputation
  EXECUTE format(
    'UPDATE player_reputations SET %I = $1 WHERE id = $2',
    p_dimension::TEXT
  ) USING v_new_value, v_reputation_id;

  -- Log the event
  INSERT INTO reputation_events (
    player_id, reputation_type, target_id, dimension,
    change_amount, old_value, new_value, reason,
    related_player_id, metadata
  ) VALUES (
    p_player_id, p_reputation_type, p_target_id, p_dimension,
    p_change_amount, v_old_value, v_new_value, p_reason,
    p_related_player_id, p_metadata
  );

  -- Return results
  reputation_id := v_reputation_id;
  old_value := v_old_value;
  new_value := v_new_value;
  clamped := v_clamped;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Get all reputations for a player
CREATE OR REPLACE FUNCTION get_player_reputations(
  p_player_id INTEGER,
  p_reputation_type reputation_type_enum DEFAULT NULL
) RETURNS TABLE(
  id INTEGER,
  reputation_type reputation_type_enum,
  target_id VARCHAR(50),
  target_name VARCHAR(100),
  respect INTEGER,
  fear INTEGER,
  trust INTEGER,
  heat INTEGER,
  combined_score INTEGER,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.reputation_type,
    pr.target_id,
    CASE
      WHEN pr.reputation_type = 'faction' THEN COALESCE(rf.name, pr.target_id)
      WHEN pr.reputation_type = 'crew' THEN COALESCE(c.name, pr.target_id)
      WHEN pr.reputation_type = 'player' THEN COALESCE(p.username, pr.target_id)
      ELSE pr.target_id
    END::VARCHAR(100) AS target_name,
    pr.respect,
    pr.fear,
    pr.trust,
    pr.heat,
    (pr.respect + pr.fear + pr.trust - pr.heat)::INTEGER AS combined_score,
    pr.last_updated
  FROM player_reputations pr
  LEFT JOIN reputation_factions rf ON pr.reputation_type = 'faction' AND pr.target_id = rf.id
  LEFT JOIN crews c ON pr.reputation_type = 'crew' AND pr.target_id = c.id::VARCHAR
  LEFT JOIN players p ON pr.reputation_type = 'player' AND pr.target_id = p.id::VARCHAR
  WHERE pr.player_id = p_player_id
    AND (p_reputation_type IS NULL OR pr.reputation_type = p_reputation_type)
  ORDER BY (pr.respect + pr.fear + pr.trust - pr.heat) DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculate reputation standing (text description)
CREATE OR REPLACE FUNCTION get_reputation_standing(
  p_respect INTEGER,
  p_fear INTEGER,
  p_trust INTEGER
) RETURNS VARCHAR(50) AS $$
DECLARE
  v_combined INTEGER;
  v_dominant VARCHAR(20);
BEGIN
  v_combined := p_respect + p_fear + p_trust;

  -- Determine dominant dimension
  IF p_fear > p_respect AND p_fear > p_trust THEN
    v_dominant := 'feared';
  ELSIF p_trust > p_respect AND p_trust > p_fear THEN
    v_dominant := 'trusted';
  ELSE
    v_dominant := 'respected';
  END IF;

  -- Determine tier based on combined score
  IF v_combined >= 200 THEN
    RETURN 'Legendary ' || v_dominant;
  ELSIF v_combined >= 100 THEN
    RETURN 'Renowned ' || v_dominant;
  ELSIF v_combined >= 50 THEN
    RETURN 'Well-known ' || v_dominant;
  ELSIF v_combined >= 0 THEN
    RETURN 'Recognized';
  ELSIF v_combined >= -50 THEN
    RETURN 'Unknown';
  ELSIF v_combined >= -100 THEN
    RETURN 'Distrusted';
  ELSE
    RETURN 'Despised';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Decay heat over time (to be called by scheduled job)
CREATE OR REPLACE FUNCTION decay_reputation_heat(
  p_decay_amount INTEGER DEFAULT 1,
  p_min_heat INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE player_reputations
  SET heat = GREATEST(p_min_heat, heat - p_decay_amount)
  WHERE heat > p_min_heat;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED REPUTATION FACTIONS (Toronto Crews for contextual reputation)
-- =============================================================================

INSERT INTO reputation_factions (id, name, description, home_district, values_loyalty, values_violence, values_business, allies, enemies, icon, color)
VALUES
  ('dixon_bloods', 'Dixon City Bloods', 'Rexdale crew with fierce loyalty and deep roots in the community. Known for protecting their own.', 'etobicoke', true, true, false, '{}', '{"galloway_boys"}', '🩸', '#dc2626'),
  ('galloway_boys', 'Galloway Boys', 'Scarborough east side crew. Volatile and unpredictable, quick to violence.', 'scarborough', false, true, false, '{}', '{"dixon_bloods"}', '⚡', '#f59e0b'),
  ('regent_park_og', 'Regent Park OGs', 'Old school crew that respects tradition and hierarchy. Been around since the towers.', 'regent_park', true, false, true, '{}', '{}', '👑', '#8b5cf6'),
  ('queen_street_kings', 'Queen Street Kings', 'Downtown movers and shakers. Business-minded, always looking for the next opportunity.', 'downtown', false, false, true, '{"yorkville_elite"}', '{}', '💎', '#3b82f6'),
  ('yorkville_elite', 'Yorkville Elite', 'White collar connects with clean money. Laundering specialists with high-end clientele.', 'yorkville', false, false, true, '{"queen_street_kings"}', '{}', '🎩', '#6366f1'),
  ('junction_crew', 'Junction Crew', 'West end tight-knit group. Family operation that looks after the neighborhood.', 'junction', true, false, true, '{}', '{}', '🔗', '#22c55e'),
  ('port_lands_union', 'Port Lands Union', 'Dockworkers collective running import/export operations. Control the waterfront.', 'port_lands', true, false, true, '{}', '{}', '⚓', '#0891b2'),
  ('little_italy_family', 'Little Italy Family', 'Old country ties with traditional values. Connected to networks beyond the city.', 'little_italy', true, false, true, '{}', '{}', '🍷', '#be123c')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  home_district = EXCLUDED.home_district,
  values_loyalty = EXCLUDED.values_loyalty,
  values_violence = EXCLUDED.values_violence,
  values_business = EXCLUDED.values_business,
  allies = EXCLUDED.allies,
  enemies = EXCLUDED.enemies,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$ BEGIN
  RAISE NOTICE '✅ Contextual Reputation System migration completed successfully!';
  RAISE NOTICE '   - Created reputation_factions table with % factions', (SELECT COUNT(*) FROM reputation_factions);
  RAISE NOTICE '   - Created player_reputations table';
  RAISE NOTICE '   - Created reputation_events audit log';
  RAISE NOTICE '   - Created helper functions:';
  RAISE NOTICE '     • get_or_create_reputation()';
  RAISE NOTICE '     • modify_reputation()';
  RAISE NOTICE '     • get_player_reputations()';
  RAISE NOTICE '     • get_reputation_standing()';
  RAISE NOTICE '     • decay_reputation_heat()';
END $$;
