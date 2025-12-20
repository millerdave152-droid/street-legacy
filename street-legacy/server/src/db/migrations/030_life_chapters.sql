-- ============================================================================
-- Migration 030: Life Chapters System
-- Character aging with distinct life phases affecting gameplay
-- ============================================================================

-- ============================================================================
-- ENUMS (Using TEXT with CHECK constraint for Supabase compatibility)
-- ============================================================================

-- Note: Using TEXT instead of ENUM to avoid transaction commit issues with new enum values

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Life chapters configuration
CREATE TABLE IF NOT EXISTS life_chapters_config (
  id TEXT PRIMARY KEY CHECK (id IN ('come_up', 'player', 'boss', 'legacy', 'youth', 'rising', 'prime', 'veteran', 'twilight')),
  display_name VARCHAR(50) NOT NULL,
  age_range_start INTEGER NOT NULL,
  age_range_end INTEGER, -- NULL for legacy (no upper limit)
  energy_max INTEGER NOT NULL,
  description TEXT,
  unlocked_features TEXT[] DEFAULT '{}',
  locked_features TEXT[] DEFAULT '{}',
  modifiers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE life_chapters_config IS 'Configuration for each life chapter phase';
COMMENT ON COLUMN life_chapters_config.age_range_end IS 'NULL means no upper age limit (legacy phase)';
COMMENT ON COLUMN life_chapters_config.modifiers IS 'JSON object with gameplay modifiers like income_bonus, crime_xp_bonus, etc';

-- Game time configuration
CREATE TABLE IF NOT EXISTS game_time_config (
  id VARCHAR(20) PRIMARY KEY DEFAULT 'default',
  real_days_per_game_year INTEGER NOT NULL DEFAULT 30,
  current_game_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_multiplier DECIMAL(5,2) NOT NULL DEFAULT 12.17, -- 365/30 = ~12.17 game days per real day
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE game_time_config IS 'Configuration for game time progression';
COMMENT ON COLUMN game_time_config.real_days_per_game_year IS '30 means 1 real month = 1 game year';
COMMENT ON COLUMN game_time_config.time_multiplier IS 'How many game days pass per real day';

-- ============================================================================
-- PLAYER TABLE MODIFICATIONS
-- ============================================================================

-- Add life chapter columns to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS birth_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '18 years',
  ADD COLUMN IF NOT EXISTS current_chapter TEXT DEFAULT 'come_up',
  ADD COLUMN IF NOT EXISTS chapter_started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_days_played INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_age INTEGER DEFAULT 18;

COMMENT ON COLUMN players.birth_date IS 'Character birth date for age calculation';
COMMENT ON COLUMN players.current_chapter IS 'Current life chapter phase';
COMMENT ON COLUMN players.chapter_started_at IS 'When player entered current chapter';
COMMENT ON COLUMN players.total_days_played IS 'Total game days played';
COMMENT ON COLUMN players.game_age IS 'Current age in game years (cached)';

-- ============================================================================
-- CHAPTER TRANSITIONS TABLE
-- ============================================================================

-- Track chapter transitions
CREATE TABLE IF NOT EXISTS chapter_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_chapter TEXT,
  to_chapter TEXT NOT NULL,
  triggered_by VARCHAR(50) NOT NULL CHECK (triggered_by IN ('age', 'achievement', 'manual', 'death', 'system')),
  player_age_at_transition INTEGER,
  previous_stats JSONB DEFAULT '{}',
  new_stats JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chapter_transitions IS 'History of player life chapter transitions';
COMMENT ON COLUMN chapter_transitions.triggered_by IS 'What caused the transition: age, achievement, manual choice, death';
COMMENT ON COLUMN chapter_transitions.previous_stats IS 'Player stats before transition';
COMMENT ON COLUMN chapter_transitions.new_stats IS 'Player stats after transition';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_players_current_chapter
  ON players(current_chapter);

CREATE INDEX IF NOT EXISTS idx_players_game_age
  ON players(game_age);

CREATE INDEX IF NOT EXISTS idx_chapter_transitions_player
  ON chapter_transitions(player_id, transitioned_at DESC);

CREATE INDEX IF NOT EXISTS idx_chapter_transitions_to_chapter
  ON chapter_transitions(to_chapter);

-- ============================================================================
-- SEED LIFE CHAPTERS CONFIG
-- ============================================================================

INSERT INTO life_chapters_config (
  id, display_name, age_range_start, age_range_end, energy_max,
  description, unlocked_features, locked_features, modifiers
) VALUES
  (
    'come_up',
    'The Come Up',
    18,
    25,
    120,
    'Young and hungry. You''re building your name on the streets, taking risks others won''t. Energy is high, but respect must be earned.',
    ARRAY['street_crimes', 'basic_jobs', 'crew_member', 'petty_theft', 'drug_running', 'street_racing'],
    ARRAY['own_business', 'crew_leader', 'political_influence', 'money_laundering', 'delegation'],
    '{"crime_xp_bonus": 0.2, "income_penalty": 0.2, "heat_decay_bonus": 0.1, "energy_regen_bonus": 0.15, "reputation_gain_penalty": 0.1}'::jsonb
  ),
  (
    'player',
    'Player',
    26,
    35,
    100,
    'You''ve proven yourself. Time to expand your operations and build real wealth. The streets know your name.',
    ARRAY['own_business', 'crew_lieutenant', 'property_ownership', 'advanced_crimes', 'heists', 'protection_rackets', 'smuggling'],
    ARRAY['delegation', 'crew_founder', 'political_influence'],
    '{"income_bonus": 0.1, "reputation_gain_bonus": 0.15, "business_profit_bonus": 0.1, "crew_loyalty_bonus": 0.1}'::jsonb
  ),
  (
    'boss',
    'Boss',
    36,
    50,
    80,
    'You run things now. Direct your crew, manage your empire, and handle the politics. Getting your hands dirty is beneath you.',
    ARRAY['delegation', 'crew_founder', 'political_influence', 'money_laundering', 'territory_control', 'crew_wars', 'legitimate_fronts'],
    ARRAY['street_crimes', 'petty_theft', 'direct_drug_dealing', 'street_racing'],
    '{"income_bonus": 0.3, "crew_bonus": 0.2, "personal_crime_penalty": 0.5, "heat_from_crimes_bonus": 0.3, "delegation_efficiency": 0.25}'::jsonb
  ),
  (
    'legacy',
    'Legacy',
    51,
    NULL,
    60,
    'You''ve seen it all. Now it''s about passing on what you''ve built and ensuring your legacy survives. Wisdom is your greatest weapon.',
    ARRAY['succession_planning', 'mentorship', 'legacy_projects', 'wisdom_bonuses', 'retirement_options', 'dynasty_founding'],
    ARRAY['street_crimes', 'direct_combat', 'heist_participation', 'street_racing', 'drug_running'],
    '{"income_bonus": 0.5, "reputation_gain_bonus": 0.3, "energy_penalty": 0.3, "mentorship_bonus": 0.5, "crew_inheritance_bonus": 0.4, "passive_income_bonus": 0.25}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  age_range_start = EXCLUDED.age_range_start,
  age_range_end = EXCLUDED.age_range_end,
  energy_max = EXCLUDED.energy_max,
  description = EXCLUDED.description,
  unlocked_features = EXCLUDED.unlocked_features,
  locked_features = EXCLUDED.locked_features,
  modifiers = EXCLUDED.modifiers;

-- Seed default game time config
INSERT INTO game_time_config (id, real_days_per_game_year, time_multiplier)
VALUES ('default', 30, 12.17)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Calculate player's current game age
CREATE OR REPLACE FUNCTION calculate_player_age(p_player_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_birth_date TIMESTAMPTZ;
  v_real_days_passed DECIMAL;
  v_real_days_per_year INTEGER;
  v_game_years INTEGER;
BEGIN
  -- Get player birth date
  SELECT birth_date INTO v_birth_date
  FROM players
  WHERE id = p_player_id;

  IF v_birth_date IS NULL THEN
    RETURN 18; -- Default starting age
  END IF;

  -- Get time config
  SELECT real_days_per_game_year INTO v_real_days_per_year
  FROM game_time_config
  WHERE id = 'default';

  IF v_real_days_per_year IS NULL THEN
    v_real_days_per_year := 30;
  END IF;

  -- Calculate real days passed since birth
  v_real_days_passed := EXTRACT(EPOCH FROM (NOW() - v_birth_date)) / 86400.0;

  -- Convert to game years (starting at age 18)
  v_game_years := 18 + FLOOR(v_real_days_passed / v_real_days_per_year);

  RETURN v_game_years;
END;
$$;

COMMENT ON FUNCTION calculate_player_age IS 'Calculate player age in game years based on birth date and time config';

-- Function: Get chapter for a given age
CREATE OR REPLACE FUNCTION get_chapter_for_age(p_age INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_chapter TEXT;
BEGIN
  SELECT id INTO v_chapter
  FROM life_chapters_config
  WHERE p_age >= age_range_start
    AND (age_range_end IS NULL OR p_age <= age_range_end)
  ORDER BY age_range_start DESC
  LIMIT 1;

  RETURN COALESCE(v_chapter, 'come_up');
END;
$$;

COMMENT ON FUNCTION get_chapter_for_age IS 'Determine which life chapter applies for a given age';

-- Function: Check and process chapter transition
CREATE OR REPLACE FUNCTION check_chapter_transition(p_player_id INTEGER)
RETURNS TABLE (
  transitioned BOOLEAN,
  from_chapter TEXT,
  to_chapter TEXT,
  new_age INTEGER,
  transition_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_chapter TEXT;
  v_current_age INTEGER;
  v_new_chapter TEXT;
  v_transition_id UUID;
  v_previous_stats JSONB;
  v_chapter_config RECORD;
BEGIN
  -- Get current player state
  SELECT current_chapter, game_age INTO v_current_chapter, v_current_age
  FROM players
  WHERE id = p_player_id;

  IF v_current_chapter IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Calculate current age
  v_current_age := calculate_player_age(p_player_id);

  -- Update cached age
  UPDATE players SET game_age = v_current_age WHERE id = p_player_id;

  -- Determine what chapter they should be in
  v_new_chapter := get_chapter_for_age(v_current_age);

  -- Check if transition needed
  IF v_new_chapter != v_current_chapter THEN
    -- Get previous stats for logging
    SELECT jsonb_build_object(
      'level', level,
      'cash', cash,
      'energy', energy,
      'current_chapter', current_chapter
    ) INTO v_previous_stats
    FROM players WHERE id = p_player_id;

    -- Get new chapter config
    SELECT * INTO v_chapter_config
    FROM life_chapters_config
    WHERE id = v_new_chapter;

    -- Record the transition
    INSERT INTO chapter_transitions (
      player_id, from_chapter, to_chapter, triggered_by,
      player_age_at_transition, previous_stats, metadata
    ) VALUES (
      p_player_id, v_current_chapter, v_new_chapter, 'age',
      v_current_age, v_previous_stats,
      jsonb_build_object('automatic', true, 'timestamp', NOW())
    )
    RETURNING id INTO v_transition_id;

    -- Update player chapter
    UPDATE players
    SET
      current_chapter = v_new_chapter,
      chapter_started_at = NOW(),
      max_energy = v_chapter_config.energy_max
    WHERE id = p_player_id;

    RETURN QUERY SELECT TRUE, v_current_chapter, v_new_chapter, v_current_age, v_transition_id;
  ELSE
    RETURN QUERY SELECT FALSE, v_current_chapter, v_current_chapter, v_current_age, NULL::UUID;
  END IF;
END;
$$;

COMMENT ON FUNCTION check_chapter_transition IS 'Check if player should transition to new chapter based on age';

-- Function: Get chapter modifiers for a player
CREATE OR REPLACE FUNCTION get_chapter_modifiers(p_player_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_chapter TEXT;
  v_modifiers JSONB;
BEGIN
  SELECT current_chapter INTO v_current_chapter
  FROM players
  WHERE id = p_player_id;

  SELECT modifiers INTO v_modifiers
  FROM life_chapters_config
  WHERE id = v_current_chapter;

  RETURN COALESCE(v_modifiers, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_chapter_modifiers IS 'Get gameplay modifiers for player current chapter';

-- Function: Check if feature is unlocked for player chapter
CREATE OR REPLACE FUNCTION is_feature_unlocked(p_player_id INTEGER, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_chapter TEXT;
  v_unlocked TEXT[];
  v_locked TEXT[];
BEGIN
  SELECT current_chapter INTO v_current_chapter
  FROM players
  WHERE id = p_player_id;

  SELECT unlocked_features, locked_features INTO v_unlocked, v_locked
  FROM life_chapters_config
  WHERE id = v_current_chapter;

  -- Feature is available if it's in unlocked list OR not in locked list
  IF p_feature = ANY(v_locked) THEN
    RETURN FALSE;
  END IF;

  IF p_feature = ANY(v_unlocked) THEN
    RETURN TRUE;
  END IF;

  -- Default to unlocked if not in either list
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION is_feature_unlocked IS 'Check if a game feature is available for player current chapter';

-- Function: Get player chapter info
CREATE OR REPLACE FUNCTION get_player_chapter_info(p_player_id INTEGER)
RETURNS TABLE (
  player_id INTEGER,
  current_age INTEGER,
  current_chapter TEXT,
  chapter_display_name VARCHAR(50),
  chapter_description TEXT,
  energy_max INTEGER,
  unlocked_features TEXT[],
  locked_features TEXT[],
  modifiers JSONB,
  years_until_next_chapter INTEGER,
  chapter_started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_age INTEGER;
  v_chapter TEXT;
  v_next_chapter_age INTEGER;
BEGIN
  -- Calculate current age
  v_age := calculate_player_age(p_player_id);

  -- Get current chapter
  SELECT p.current_chapter INTO v_chapter
  FROM players p
  WHERE p.id = p_player_id;

  -- Get next chapter age threshold
  SELECT lc.age_range_end + 1 INTO v_next_chapter_age
  FROM life_chapters_config lc
  WHERE lc.id = v_chapter
    AND lc.age_range_end IS NOT NULL;

  RETURN QUERY
  SELECT
    p_player_id,
    v_age,
    lc.id,
    lc.display_name,
    lc.description,
    lc.energy_max,
    lc.unlocked_features,
    lc.locked_features,
    lc.modifiers,
    CASE
      WHEN v_next_chapter_age IS NOT NULL THEN v_next_chapter_age - v_age
      ELSE NULL
    END,
    p.chapter_started_at
  FROM life_chapters_config lc
  JOIN players p ON p.current_chapter = lc.id
  WHERE p.id = p_player_id;
END;
$$;

COMMENT ON FUNCTION get_player_chapter_info IS 'Get complete chapter information for a player';

-- Function: Apply modifier to a value
CREATE OR REPLACE FUNCTION apply_chapter_modifier(
  p_player_id INTEGER,
  p_modifier_name TEXT,
  p_base_value DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  v_modifiers JSONB;
  v_modifier DECIMAL;
BEGIN
  v_modifiers := get_chapter_modifiers(p_player_id);

  v_modifier := COALESCE((v_modifiers->>p_modifier_name)::DECIMAL, 0);

  -- Handle bonuses (positive) and penalties (negative naming convention)
  IF p_modifier_name LIKE '%_bonus' THEN
    RETURN p_base_value * (1 + v_modifier);
  ELSIF p_modifier_name LIKE '%_penalty' THEN
    RETURN p_base_value * (1 - v_modifier);
  ELSE
    RETURN p_base_value * (1 + v_modifier);
  END IF;
END;
$$;

COMMENT ON FUNCTION apply_chapter_modifier IS 'Apply a chapter modifier to a base value';

-- Function: Manually transition chapter (for achievements/special events)
CREATE OR REPLACE FUNCTION force_chapter_transition(
  p_player_id INTEGER,
  p_new_chapter TEXT,
  p_triggered_by VARCHAR(50),
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_chapter TEXT;
  v_current_age INTEGER;
  v_transition_id UUID;
  v_chapter_config RECORD;
BEGIN
  -- Get current state
  SELECT current_chapter, game_age INTO v_current_chapter, v_current_age
  FROM players
  WHERE id = p_player_id;

  -- Get new chapter config
  SELECT * INTO v_chapter_config
  FROM life_chapters_config
  WHERE id = p_new_chapter;

  -- Record transition
  INSERT INTO chapter_transitions (
    player_id, from_chapter, to_chapter, triggered_by,
    player_age_at_transition, metadata
  ) VALUES (
    p_player_id, v_current_chapter, p_new_chapter, p_triggered_by,
    v_current_age, p_metadata
  )
  RETURNING id INTO v_transition_id;

  -- Update player
  UPDATE players
  SET
    current_chapter = p_new_chapter,
    chapter_started_at = NOW(),
    max_energy = v_chapter_config.energy_max
  WHERE id = p_player_id;

  RETURN v_transition_id;
END;
$$;

COMMENT ON FUNCTION force_chapter_transition IS 'Force a chapter transition for achievements or special events';

-- Function: Get chapter transition history
CREATE OR REPLACE FUNCTION get_chapter_history(p_player_id INTEGER)
RETURNS TABLE (
  transition_id UUID,
  from_chapter TEXT,
  from_chapter_name VARCHAR(50),
  to_chapter TEXT,
  to_chapter_name VARCHAR(50),
  triggered_by VARCHAR(50),
  age_at_transition INTEGER,
  transitioned_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.from_chapter,
    lc_from.display_name,
    ct.to_chapter,
    lc_to.display_name,
    ct.triggered_by,
    ct.player_age_at_transition,
    ct.transitioned_at
  FROM chapter_transitions ct
  LEFT JOIN life_chapters_config lc_from ON lc_from.id = ct.from_chapter
  JOIN life_chapters_config lc_to ON lc_to.id = ct.to_chapter
  WHERE ct.player_id = p_player_id
  ORDER BY ct.transitioned_at ASC;
END;
$$;

COMMENT ON FUNCTION get_chapter_history IS 'Get player chapter transition history';

-- Function: Update all player ages (for scheduled job)
CREATE OR REPLACE FUNCTION update_all_player_ages()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_player RECORD;
  v_updated INTEGER := 0;
  v_new_age INTEGER;
BEGIN
  FOR v_player IN SELECT id FROM players WHERE is_active = true LOOP
    v_new_age := calculate_player_age(v_player.id);

    UPDATE players
    SET game_age = v_new_age,
        total_days_played = total_days_played + 1
    WHERE id = v_player.id;

    -- Check for chapter transitions
    PERFORM check_chapter_transition(v_player.id);

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION update_all_player_ages IS 'Update all active player ages and check transitions (scheduled job)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to set initial chapter on player creation
CREATE OR REPLACE FUNCTION set_initial_chapter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set birth date if not provided
  IF NEW.birth_date IS NULL THEN
    NEW.birth_date := NOW() - INTERVAL '18 years';
  END IF;

  -- Set initial chapter
  IF NEW.current_chapter IS NULL THEN
    NEW.current_chapter := 'come_up';
  END IF;

  -- Set chapter started at
  IF NEW.chapter_started_at IS NULL THEN
    NEW.chapter_started_at := NOW();
  END IF;

  -- Set initial game age
  IF NEW.game_age IS NULL THEN
    NEW.game_age := 18;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_initial_chapter ON players;
CREATE TRIGGER trg_set_initial_chapter
  BEFORE INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_chapter();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Player chapter summary
CREATE OR REPLACE VIEW player_chapter_summary AS
SELECT
  p.id as player_id,
  p.username,
  p.game_age,
  p.current_chapter,
  lc.display_name as chapter_name,
  lc.energy_max,
  lc.age_range_end - p.game_age as years_until_next_chapter,
  p.chapter_started_at,
  EXTRACT(DAYS FROM (NOW() - p.chapter_started_at)) as days_in_chapter,
  p.total_days_played
FROM players p
JOIN life_chapters_config lc ON lc.id = p.current_chapter;

COMMENT ON VIEW player_chapter_summary IS 'Summary view of player chapter information';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- - Created TEXT with 4 phases: come_up, player, boss, legacy
-- - Created life_chapters_config with modifiers and feature unlocks
-- - Created game_time_config for time progression settings
-- - Added chapter columns to players table
-- - Created chapter_transitions history table
-- - Implemented functions:
--   * calculate_player_age - Get player age in game years
--   * get_chapter_for_age - Determine chapter for age
--   * check_chapter_transition - Auto-transition by age
--   * get_chapter_modifiers - Get modifier values
--   * is_feature_unlocked - Check feature availability
--   * get_player_chapter_info - Complete chapter info
--   * apply_chapter_modifier - Apply modifiers to values
--   * force_chapter_transition - Manual transitions
--   * get_chapter_history - Transition history
--   * update_all_player_ages - Batch update for scheduled jobs
