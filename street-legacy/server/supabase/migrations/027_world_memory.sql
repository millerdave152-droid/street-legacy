-- Street Legacy: World Memory System Migration
-- Migration: 027_world_memory
-- Description: Creates permanent memory of significant game events that NPCs and the world reference
--              Landmark events create monuments, NPCs remember and discuss major happenings

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Significance levels for world events
DO $$ BEGIN
  CREATE TYPE world_event_significance_enum AS ENUM (
    'minor',        -- Small local events, quickly forgotten
    'notable',      -- Noteworthy, remembered for a while
    'significant',  -- Important district-level events
    'major',        -- City-wide impact, widely discussed
    'landmark',     -- Historic, permanently remembered
    'legendary'     -- Defining moments in city history
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- WORLD EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS world_events (
  id SERIAL PRIMARY KEY,

  -- Event classification
  event_type VARCHAR(50) NOT NULL,  -- 'first_district_monopoly', 'crew_wipe', 'heist_record', etc.
  significance INTEGER NOT NULL CHECK (significance >= 1 AND significance <= 10),

  -- Human-readable content
  headline VARCHAR(200) NOT NULL,   -- Auto-generated news-style headline
  description TEXT,                  -- Longer narrative description

  -- Involved entities
  primary_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  secondary_player_ids INTEGER[] DEFAULT '{}',  -- Other involved players
  crew_id INTEGER,                   -- If crew-related (references crews.id)
  district_id VARCHAR(50),           -- District where event occurred

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Landmark flag (auto-set for significance >= 8)
  is_landmark BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table comments
COMMENT ON TABLE world_events IS 'Permanent record of significant game events that shape the world history';
COMMENT ON COLUMN world_events.event_type IS 'Type identifier (first_district_monopoly, crew_wipe, heist_record, property_empire, crew_war_ended)';
COMMENT ON COLUMN world_events.significance IS 'Event importance (1=minor, 10=legendary). Events >= 8 become landmarks';
COMMENT ON COLUMN world_events.headline IS 'News-style headline summarizing the event';
COMMENT ON COLUMN world_events.description IS 'Detailed narrative description of what happened';
COMMENT ON COLUMN world_events.is_landmark IS 'True for significance >= 8, creates permanent monument';

-- Indexes for world_events
CREATE INDEX IF NOT EXISTS idx_world_events_created ON world_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_district_created ON world_events(district_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_primary_player ON world_events(primary_player_id) WHERE primary_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_world_events_significance ON world_events(significance DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_landmarks ON world_events(is_landmark, created_at DESC) WHERE is_landmark = TRUE;
CREATE INDEX IF NOT EXISTS idx_world_events_type ON world_events(event_type);

-- =============================================================================
-- WORLD MONUMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS world_monuments (
  id SERIAL PRIMARY KEY,

  -- Reference to the event this commemorates
  world_event_id INTEGER NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,

  -- Location
  district_id VARCHAR(50) NOT NULL,

  -- Monument details
  monument_type VARCHAR(50) NOT NULL,  -- 'plaque', 'memorial', 'statue', 'renamed_location'
  title VARCHAR(100) NOT NULL,
  inscription TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table comments
COMMENT ON TABLE world_monuments IS 'Physical monuments created for landmark events (significance >= 8)';
COMMENT ON COLUMN world_monuments.monument_type IS 'Type of monument: plaque, memorial, statue, renamed_location';
COMMENT ON COLUMN world_monuments.title IS 'Name/title of the monument';
COMMENT ON COLUMN world_monuments.inscription IS 'Text inscribed on the monument';

-- Indexes for world_monuments
CREATE INDEX IF NOT EXISTS idx_world_monuments_district ON world_monuments(district_id);
CREATE INDEX IF NOT EXISTS idx_world_monuments_event ON world_monuments(world_event_id);

-- =============================================================================
-- NPC MEMORIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS npc_memories (
  id SERIAL PRIMARY KEY,

  -- NPC identification
  npc_id VARCHAR(50) NOT NULL,

  -- Reference to the event remembered
  world_event_id INTEGER NOT NULL REFERENCES world_events(id) ON DELETE CASCADE,

  -- Memory details
  memory_type VARCHAR(30) NOT NULL,  -- 'witnessed', 'heard_rumor', 'personal_impact'
  sentiment VARCHAR(20) NOT NULL,     -- 'positive', 'negative', 'neutral', 'fearful', 'respectful'
  dialogue_snippets TEXT[] DEFAULT '{}',  -- Things NPC might say about this event

  -- Memory duration
  expires_at TIMESTAMPTZ,  -- NULL = permanent memory

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table comments
COMMENT ON TABLE npc_memories IS 'NPCs remember world events and reference them in dialogue';
COMMENT ON COLUMN npc_memories.npc_id IS 'Identifier for the NPC who has this memory';
COMMENT ON COLUMN npc_memories.memory_type IS 'How the NPC knows about this: witnessed, heard_rumor, personal_impact';
COMMENT ON COLUMN npc_memories.sentiment IS 'NPC feeling about the event: positive, negative, neutral, fearful, respectful';
COMMENT ON COLUMN npc_memories.dialogue_snippets IS 'Array of dialogue lines the NPC might say about this event';
COMMENT ON COLUMN npc_memories.expires_at IS 'When this memory fades (NULL = never forgets)';

-- Indexes for npc_memories
CREATE INDEX IF NOT EXISTS idx_npc_memories_npc ON npc_memories(npc_id);
CREATE INDEX IF NOT EXISTS idx_npc_memories_event ON npc_memories(world_event_id);
CREATE INDEX IF NOT EXISTS idx_npc_memories_expires ON npc_memories(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_npc_memories_npc_sentiment ON npc_memories(npc_id, sentiment);

-- =============================================================================
-- FUNCTION: Record World Event
-- =============================================================================

CREATE OR REPLACE FUNCTION record_world_event(
  p_event_type VARCHAR(50),
  p_significance INTEGER,
  p_headline VARCHAR(200),
  p_description TEXT DEFAULT NULL,
  p_primary_player_id INTEGER DEFAULT NULL,
  p_district_id VARCHAR(50) DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_secondary_player_ids INTEGER[] DEFAULT '{}',
  p_crew_id INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_event_id INTEGER;
  v_is_landmark BOOLEAN;
  v_monument_type VARCHAR(50);
  v_monument_title VARCHAR(100);
BEGIN
  -- Determine if this is a landmark event
  v_is_landmark := p_significance >= 8;

  -- Insert the world event
  INSERT INTO world_events (
    event_type,
    significance,
    headline,
    description,
    primary_player_id,
    secondary_player_ids,
    crew_id,
    district_id,
    metadata,
    is_landmark
  ) VALUES (
    p_event_type,
    p_significance,
    p_headline,
    p_description,
    p_primary_player_id,
    p_secondary_player_ids,
    p_crew_id,
    p_district_id,
    p_metadata,
    v_is_landmark
  )
  RETURNING id INTO v_event_id;

  -- Auto-create monument for landmark events
  IF v_is_landmark AND p_district_id IS NOT NULL THEN
    -- Determine monument type based on event type
    CASE p_event_type
      WHEN 'first_district_monopoly' THEN
        v_monument_type := 'plaque';
        v_monument_title := 'District Monopoly Memorial';
      WHEN 'crew_wipe' THEN
        v_monument_type := 'memorial';
        v_monument_title := 'Fallen Crew Memorial';
      WHEN 'heist_record' THEN
        v_monument_type := 'plaque';
        v_monument_title := 'Historic Heist Marker';
      WHEN 'property_empire' THEN
        v_monument_type := 'statue';
        v_monument_title := 'Real Estate Baron Statue';
      WHEN 'crew_war_ended' THEN
        v_monument_type := 'memorial';
        v_monument_title := 'Peace Memorial';
      ELSE
        v_monument_type := 'plaque';
        v_monument_title := 'Historic Event Marker';
    END CASE;

    INSERT INTO world_monuments (
      world_event_id,
      district_id,
      monument_type,
      title,
      inscription
    ) VALUES (
      v_event_id,
      p_district_id,
      v_monument_type,
      v_monument_title,
      p_headline || ' - ' || TO_CHAR(NOW(), 'Month DD, YYYY')
    );
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION record_world_event IS 'Records a world event and auto-creates monument if significance >= 8';

-- =============================================================================
-- FUNCTION: Get District History
-- =============================================================================

CREATE OR REPLACE FUNCTION get_district_history(
  p_district_id VARCHAR(50),
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id INTEGER,
  event_type VARCHAR(50),
  significance INTEGER,
  headline VARCHAR(200),
  description TEXT,
  primary_player_id INTEGER,
  is_landmark BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id,
    we.event_type,
    we.significance,
    we.headline,
    we.description,
    we.primary_player_id,
    we.is_landmark,
    we.created_at
  FROM world_events we
  WHERE we.district_id = p_district_id
  ORDER BY we.significance DESC, we.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_district_history IS 'Returns world events for a district, ordered by significance then date';

-- =============================================================================
-- FUNCTION: Get NPC Dialogue About Event
-- =============================================================================

CREATE OR REPLACE FUNCTION get_npc_dialogue_about_events(
  p_npc_id VARCHAR(50),
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  event_headline VARCHAR(200),
  sentiment VARCHAR(20),
  dialogue TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.headline,
    nm.sentiment,
    unnest(nm.dialogue_snippets) as dialogue
  FROM npc_memories nm
  JOIN world_events we ON we.id = nm.world_event_id
  WHERE nm.npc_id = p_npc_id
    AND (nm.expires_at IS NULL OR nm.expires_at > NOW())
  ORDER BY we.significance DESC, we.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_npc_dialogue_about_events IS 'Returns dialogue snippets an NPC might say about remembered events';

-- =============================================================================
-- FUNCTION: Add NPC Memory
-- =============================================================================

CREATE OR REPLACE FUNCTION add_npc_memory(
  p_npc_id VARCHAR(50),
  p_world_event_id INTEGER,
  p_memory_type VARCHAR(30),
  p_sentiment VARCHAR(20),
  p_dialogue_snippets TEXT[],
  p_duration_days INTEGER DEFAULT NULL  -- NULL = permanent
) RETURNS INTEGER AS $$
DECLARE
  v_memory_id INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration if duration provided
  IF p_duration_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;
  END IF;

  INSERT INTO npc_memories (
    npc_id,
    world_event_id,
    memory_type,
    sentiment,
    dialogue_snippets,
    expires_at
  ) VALUES (
    p_npc_id,
    p_world_event_id,
    p_memory_type,
    p_sentiment,
    p_dialogue_snippets,
    v_expires_at
  )
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION add_npc_memory IS 'Adds a memory of a world event to an NPC with optional expiration';

-- =============================================================================
-- FUNCTION: Clean Expired Memories
-- =============================================================================

CREATE OR REPLACE FUNCTION clean_expired_npc_memories()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM npc_memories
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION clean_expired_npc_memories IS 'Removes NPC memories that have expired';

-- =============================================================================
-- FUNCTION: Get Landmarks
-- =============================================================================

CREATE OR REPLACE FUNCTION get_world_landmarks(
  p_district_id VARCHAR(50) DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  event_id INTEGER,
  event_type VARCHAR(50),
  significance INTEGER,
  headline VARCHAR(200),
  district_id VARCHAR(50),
  monument_type VARCHAR(50),
  monument_title VARCHAR(100),
  monument_inscription TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id as event_id,
    we.event_type,
    we.significance,
    we.headline,
    we.district_id,
    wm.monument_type,
    wm.title as monument_title,
    wm.inscription as monument_inscription,
    we.created_at
  FROM world_events we
  LEFT JOIN world_monuments wm ON wm.world_event_id = we.id
  WHERE we.is_landmark = TRUE
    AND (p_district_id IS NULL OR we.district_id = p_district_id)
  ORDER BY we.significance DESC, we.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function comment
COMMENT ON FUNCTION get_world_landmarks IS 'Returns landmark events with their monuments, optionally filtered by district';

-- =============================================================================
-- SEED DATA: Example Event Types
-- =============================================================================

-- Insert some example world events to demonstrate the system
-- (These would normally be created through gameplay)

-- Note: Uncomment the following to add sample data for testing:
/*
SELECT record_world_event(
  'first_district_monopoly',
  9,
  'Shadow Empire Seizes Complete Control of Downtown',
  'In an unprecedented move, the Shadow Empire crew has acquired every property in Downtown, marking the first complete district monopoly in city history.',
  NULL,
  'downtown',
  '{"property_count": 50, "total_value": 5000000}'::jsonb
);
*/

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$ BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'World Memory System migration completed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - world_events (permanent event history)';
  RAISE NOTICE '  - world_monuments (physical monuments for landmarks)';
  RAISE NOTICE '  - npc_memories (NPC memory of events)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - record_world_event()';
  RAISE NOTICE '  - get_district_history()';
  RAISE NOTICE '  - get_npc_dialogue_about_events()';
  RAISE NOTICE '  - add_npc_memory()';
  RAISE NOTICE '  - clean_expired_npc_memories()';
  RAISE NOTICE '  - get_world_landmarks()';
  RAISE NOTICE '========================================';
END $$;
