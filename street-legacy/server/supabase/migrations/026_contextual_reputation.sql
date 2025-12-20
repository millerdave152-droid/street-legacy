-- Street Legacy: Contextual Reputation System Migration
-- Migration: 026_contextual_reputation
-- Description: Creates multi-dimensional reputation system with respect, fear, trust, and heat
--              Tracks player reputation across districts, factions, crews, and other players

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE reputation_type_enum AS ENUM (
    'district',
    'faction',
    'crew',
    'player'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reputation_dimension_enum AS ENUM (
    'respect',
    'fear',
    'trust',
    'heat'
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
  home_district VARCHAR(50) NOT NULL,
  allied_districts TEXT[] DEFAULT '{}',
  values_loyalty BOOLEAN DEFAULT true,
  values_violence BOOLEAN DEFAULT false,
  values_business BOOLEAN DEFAULT true,
  allies TEXT[] DEFAULT '{}',
  enemies TEXT[] DEFAULT '{}',
  icon VARCHAR(10) DEFAULT '👥',
  color VARCHAR(7) DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_factions_home_district ON reputation_factions(home_district);

-- =============================================================================
-- PLAYER REPUTATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_reputations (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reputation_type reputation_type_enum NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  respect INTEGER DEFAULT 0 CHECK (respect >= -100 AND respect <= 100),
  fear INTEGER DEFAULT 0 CHECK (fear >= -100 AND fear <= 100),
  trust INTEGER DEFAULT 0 CHECK (trust >= -100 AND trust <= 100),
  heat INTEGER DEFAULT 0 CHECK (heat >= 0 AND heat <= 100),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_reputation UNIQUE (player_id, reputation_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_player_reputations_player ON player_reputations(player_id);
CREATE INDEX IF NOT EXISTS idx_player_reputations_type ON player_reputations(reputation_type);
CREATE INDEX IF NOT EXISTS idx_player_reputations_target ON player_reputations(target_id);
CREATE INDEX IF NOT EXISTS idx_player_reputations_player_type ON player_reputations(player_id, reputation_type);

-- =============================================================================
-- REPUTATION EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS reputation_events (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reputation_type reputation_type_enum NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  dimension reputation_dimension_enum NOT NULL,
  change_amount INTEGER NOT NULL,
  old_value INTEGER,
  new_value INTEGER,
  reason VARCHAR(100) NOT NULL,
  related_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_player_created ON reputation_events(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_events_target ON reputation_events(target_id, created_at DESC);

-- =============================================================================
-- TRIGGERS
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

-- =============================================================================
-- RLS POLICIES (Commented out - not using Supabase Auth)
-- =============================================================================

-- Note: RLS policies are disabled since this database uses custom auth
-- instead of Supabase Auth. Access control is handled at the API layer.

-- ALTER TABLE player_reputations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reputation_factions ENABLE ROW LEVEL SECURITY;

-- Players can read their own reputations
-- DROP POLICY IF EXISTS player_reputations_select_own ON player_reputations;
-- CREATE POLICY player_reputations_select_own ON player_reputations
--   FOR SELECT USING (player_id = auth.uid());

-- Players can read reputations others have with them
-- DROP POLICY IF EXISTS player_reputations_select_target ON player_reputations;
-- CREATE POLICY player_reputations_select_target ON player_reputations
--   FOR SELECT USING (reputation_type = 'player' AND target_id = auth.uid()::VARCHAR);

-- Players can read their own reputation events
-- DROP POLICY IF EXISTS reputation_events_select_own ON reputation_events;
-- CREATE POLICY reputation_events_select_own ON reputation_events
--   FOR SELECT USING (player_id = auth.uid());

-- Anyone can read reputation factions
-- DROP POLICY IF EXISTS reputation_factions_select_all ON reputation_factions;
-- CREATE POLICY reputation_factions_select_all ON reputation_factions
--   FOR SELECT USING (true);

-- =============================================================================
-- SEED REPUTATION FACTIONS
-- =============================================================================

INSERT INTO reputation_factions (id, name, description, home_district, values_loyalty, values_violence, values_business, allies, enemies, icon, color)
VALUES
  ('dixon_bloods', 'Dixon City Bloods', 'Rexdale crew with fierce loyalty and deep roots in the community.', 'etobicoke', true, true, false, '{}', '{"galloway_boys"}', '🩸', '#dc2626'),
  ('galloway_boys', 'Galloway Boys', 'Scarborough east side crew. Volatile and unpredictable.', 'scarborough', false, true, false, '{}', '{"dixon_bloods"}', '⚡', '#f59e0b'),
  ('regent_park_og', 'Regent Park OGs', 'Old school crew that respects tradition and hierarchy.', 'regent_park', true, false, true, '{}', '{}', '👑', '#8b5cf6'),
  ('queen_street_kings', 'Queen Street Kings', 'Downtown movers and shakers. Business-minded.', 'downtown', false, false, true, '{"yorkville_elite"}', '{}', '💎', '#3b82f6'),
  ('yorkville_elite', 'Yorkville Elite', 'White collar connects with clean money.', 'yorkville', false, false, true, '{"queen_street_kings"}', '{}', '🎩', '#6366f1'),
  ('junction_crew', 'Junction Crew', 'West end tight-knit family operation.', 'junction', true, false, true, '{}', '{}', '🔗', '#22c55e'),
  ('port_lands_union', 'Port Lands Union', 'Dockworkers running import/export operations.', 'port_lands', true, false, true, '{}', '{}', '⚓', '#0891b2'),
  ('little_italy_family', 'Little Italy Family', 'Old country ties with traditional values.', 'little_italy', true, false, true, '{}', '{}', '🍷', '#be123c')
ON CONFLICT (id) DO NOTHING;
