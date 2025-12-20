-- ============================================================================
-- Migration 032: Generational Continuity System
-- Character endings and heir inheritance for dynasty gameplay
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Ending type enum - how a character's story ends
DO $$ BEGIN
  CREATE TYPE ending_type_enum AS ENUM (
    'death',          -- Killed in action
    'prison_life',    -- Life sentence, character removed
    'retirement',     -- Voluntary exit from the game
    'disappearance',  -- Vanished mysteriously
    'exile'           -- Forced out of the city
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Heir type enum - who inherits the legacy
DO $$ BEGIN
  CREATE TYPE heir_type_enum AS ENUM (
    'player_heir',     -- Another player character
    'npc_family',      -- NPC family member (new character)
    'npc_lieutenant',  -- Trusted NPC lieutenant
    'crew_successor'   -- Crew votes on successor
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Life chapter enum - stages of a character's life
DO $$ BEGIN
  CREATE TYPE life_chapter_enum AS ENUM (
    'youth',          -- Starting out
    'rising',         -- Building reputation
    'prime',          -- Peak of power
    'veteran',        -- Experienced but aging
    'twilight'        -- Final chapter
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Succession plans - pre-arranged inheritance settings
CREATE TABLE IF NOT EXISTS succession_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  heir_type TEXT NOT NULL DEFAULT 'npc_family',
  heir_player_id INTEGER REFERENCES players(id),
  heir_npc_name VARCHAR(100),
  property_transfer_percent INTEGER NOT NULL DEFAULT 100,
  cash_transfer_percent INTEGER NOT NULL DEFAULT 50,
  reputation_transfer_percent INTEGER NOT NULL DEFAULT 30,
  crew_position_transfer BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to existing succession_plans table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'property_transfer_percent') THEN
    ALTER TABLE succession_plans ADD COLUMN property_transfer_percent INTEGER NOT NULL DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'cash_transfer_percent') THEN
    ALTER TABLE succession_plans ADD COLUMN cash_transfer_percent INTEGER NOT NULL DEFAULT 50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'reputation_transfer_percent') THEN
    ALTER TABLE succession_plans ADD COLUMN reputation_transfer_percent INTEGER NOT NULL DEFAULT 30;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'crew_position_transfer') THEN
    ALTER TABLE succession_plans ADD COLUMN crew_position_transfer BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'notes') THEN
    ALTER TABLE succession_plans ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'updated_at') THEN
    ALTER TABLE succession_plans ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'heir_npc_name') THEN
    ALTER TABLE succession_plans ADD COLUMN heir_npc_name VARCHAR(100);
  END IF;
END $$;

COMMENT ON TABLE succession_plans IS 'Pre-arranged inheritance settings for character endings';

-- Character endings - records of how characters ended
CREATE TABLE IF NOT EXISTS character_endings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES players(id),
  ending_type TEXT NOT NULL DEFAULT 'death',
  ending_description TEXT,
  final_stats JSONB,
  final_net_worth BIGINT DEFAULT 0,
  properties_owned INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  life_chapter TEXT,
  age_at_ending INTEGER,
  caused_by_player_id INTEGER REFERENCES players(id),
  succession_executed BOOLEAN NOT NULL DEFAULT FALSE,
  heir_player_id INTEGER REFERENCES players(id),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to existing character_endings table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'caused_by_player_id') THEN
    ALTER TABLE character_endings ADD COLUMN caused_by_player_id INTEGER REFERENCES players(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'succession_executed') THEN
    ALTER TABLE character_endings ADD COLUMN succession_executed BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'heir_player_id') THEN
    ALTER TABLE character_endings ADD COLUMN heir_player_id INTEGER REFERENCES players(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'ending_description') THEN
    ALTER TABLE character_endings ADD COLUMN ending_description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'final_stats') THEN
    ALTER TABLE character_endings ADD COLUMN final_stats JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'final_net_worth') THEN
    ALTER TABLE character_endings ADD COLUMN final_net_worth BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'properties_owned') THEN
    ALTER TABLE character_endings ADD COLUMN properties_owned INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'reputation_score') THEN
    ALTER TABLE character_endings ADD COLUMN reputation_score INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'life_chapter') THEN
    ALTER TABLE character_endings ADD COLUMN life_chapter TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'age_at_ending') THEN
    ALTER TABLE character_endings ADD COLUMN age_at_ending INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'ended_at') THEN
    ALTER TABLE character_endings ADD COLUMN ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

COMMENT ON TABLE character_endings IS 'Historical record of character endings';

-- Player lineage - tracks dynasty connections
CREATE TABLE IF NOT EXISTS player_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  predecessor_player_id INTEGER REFERENCES players(id),
  predecessor_ending_id UUID,
  generation INTEGER NOT NULL DEFAULT 1,
  inherited_properties INTEGER[] DEFAULT '{}',
  inherited_cash BIGINT DEFAULT 0,
  inherited_reputation_percent INTEGER DEFAULT 0,
  inherited_crew_position BOOLEAN DEFAULT FALSE,
  dynasty_name VARCHAR(100),
  lineage_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_player_lineage UNIQUE (player_id)
);

-- Add missing columns to existing player_lineage table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'dynasty_name') THEN
    ALTER TABLE player_lineage ADD COLUMN dynasty_name VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'predecessor_player_id') THEN
    ALTER TABLE player_lineage ADD COLUMN predecessor_player_id INTEGER REFERENCES players(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'predecessor_ending_id') THEN
    ALTER TABLE player_lineage ADD COLUMN predecessor_ending_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'generation') THEN
    ALTER TABLE player_lineage ADD COLUMN generation INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'inherited_properties') THEN
    ALTER TABLE player_lineage ADD COLUMN inherited_properties INTEGER[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'inherited_cash') THEN
    ALTER TABLE player_lineage ADD COLUMN inherited_cash BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'inherited_reputation_percent') THEN
    ALTER TABLE player_lineage ADD COLUMN inherited_reputation_percent INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'inherited_crew_position') THEN
    ALTER TABLE player_lineage ADD COLUMN inherited_crew_position BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'lineage_started_at') THEN
    ALTER TABLE player_lineage ADD COLUMN lineage_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'created_at') THEN
    ALTER TABLE player_lineage ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

COMMENT ON TABLE player_lineage IS 'Dynasty and inheritance tracking for players';

-- Dynasty achievements - legacy accomplishments
CREATE TABLE IF NOT EXISTS dynasty_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dynasty_name VARCHAR(100) NOT NULL,
  achievement_type VARCHAR(50) NOT NULL,
  description TEXT,
  generation_achieved INTEGER NOT NULL DEFAULT 1,
  player_id INTEGER REFERENCES players(id),
  metadata JSONB,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dynasty_achievements IS 'Achievements earned by dynasties across generations';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Succession plans indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_succession_plans_player ON succession_plans(player_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'succession_plans' AND column_name = 'heir_player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_succession_plans_heir ON succession_plans(heir_player_id) WHERE heir_player_id IS NOT NULL;
  END IF;
END $$;

-- Character endings indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_character_endings_player ON character_endings(player_id, ended_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'ending_type') THEN
    CREATE INDEX IF NOT EXISTS idx_character_endings_type ON character_endings(ending_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'caused_by_player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_character_endings_caused_by ON character_endings(caused_by_player_id) WHERE caused_by_player_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_endings' AND column_name = 'heir_player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_character_endings_heir ON character_endings(heir_player_id) WHERE heir_player_id IS NOT NULL;
  END IF;
END $$;

-- Player lineage indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_player_lineage_player ON player_lineage(player_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'predecessor_player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_player_lineage_predecessor ON player_lineage(predecessor_player_id) WHERE predecessor_player_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'dynasty_name') THEN
    CREATE INDEX IF NOT EXISTS idx_player_lineage_dynasty ON player_lineage(dynasty_name) WHERE dynasty_name IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'dynasty_name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_lineage' AND column_name = 'generation') THEN
    CREATE INDEX IF NOT EXISTS idx_player_lineage_generation ON player_lineage(dynasty_name, generation DESC) WHERE dynasty_name IS NOT NULL;
  END IF;
END $$;

-- Dynasty achievements indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dynasty_achievements' AND column_name = 'dynasty_name') THEN
    CREATE INDEX IF NOT EXISTS idx_dynasty_achievements_dynasty ON dynasty_achievements(dynasty_name, achieved_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dynasty_achievements' AND column_name = 'achievement_type') THEN
    CREATE INDEX IF NOT EXISTS idx_dynasty_achievements_type ON dynasty_achievements(achievement_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dynasty_achievements' AND column_name = 'player_id') THEN
    CREATE INDEX IF NOT EXISTS idx_dynasty_achievements_player ON dynasty_achievements(player_id) WHERE player_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update succession_plans updated_at
CREATE OR REPLACE FUNCTION trigger_update_succession_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_succession_plans_updated ON succession_plans;
CREATE TRIGGER trg_succession_plans_updated
  BEFORE UPDATE ON succession_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_succession_timestamp();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- - Created ending_type_enum, heir_type_enum, life_chapter_enum
-- - Created succession_plans table for inheritance settings
-- - Created character_endings table for ending records
-- - Created player_lineage table for dynasty tracking
-- - Created dynasty_achievements table for legacy accomplishments
-- - Created indexes for performance
-- - Created trigger for updated_at timestamp
