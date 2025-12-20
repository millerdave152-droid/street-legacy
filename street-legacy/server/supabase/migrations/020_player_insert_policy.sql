-- Street Legacy: Player Insert Policy & Create Function
-- Migration: 020_player_insert_policy
-- Description: Allow authenticated users to create their own player profile

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "players_insert_service" ON players;

-- Allow authenticated users to create their own player profile
-- The id must match their auth.uid()
CREATE POLICY "players_insert_own" ON players
  FOR INSERT WITH CHECK (id = auth.uid());

-- Also ensure districts can be read by anyone (for starter district selection)
-- This should already exist but let's make sure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'districts' AND policyname = 'districts_select_all'
  ) THEN
    CREATE POLICY "districts_select_all" ON districts
      FOR SELECT USING (TRUE);
  END IF;
END $$;

-- =============================================================================
-- CREATE PLAYER RPC FUNCTION
-- Callable from client with SECURITY DEFINER to bypass RLS
-- =============================================================================

CREATE OR REPLACE FUNCTION create_new_player(
  p_username VARCHAR(30),
  p_starter_build TEXT DEFAULT 'hustler',
  p_district_id VARCHAR(50) DEFAULT 'scarborough'
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_player RECORD;
  v_starting_cash BIGINT;
  v_rep_crime INT := 0;
  v_rep_business INT := 0;
  v_rep_family INT := 0;
  v_build starter_build_enum;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if player already exists
  IF EXISTS (SELECT 1 FROM players WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Player profile already exists';
  END IF;

  -- Validate username
  IF LENGTH(p_username) < 3 OR LENGTH(p_username) > 30 THEN
    RAISE EXCEPTION 'Username must be 3-30 characters';
  END IF;

  IF p_username !~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;

  -- Check username availability
  IF EXISTS (SELECT 1 FROM players WHERE LOWER(username) = LOWER(p_username)) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Cast and validate starter build
  BEGIN
    v_build := p_starter_build::starter_build_enum;
  EXCEPTION WHEN OTHERS THEN
    v_build := 'hustler'::starter_build_enum;
  END;

  -- Set starting values based on build
  CASE v_build
    WHEN 'hustler' THEN
      v_starting_cash := 300;
      v_rep_crime := 25;
    WHEN 'entrepreneur' THEN
      v_starting_cash := 750;
      v_rep_business := 25;
    WHEN 'community_kid' THEN
      v_starting_cash := 400;
      v_rep_family := 50;
    ELSE
      v_starting_cash := 500;
  END CASE;

  -- Create player
  INSERT INTO players (
    id,
    username,
    starter_build,
    current_district_id,
    home_district_id,
    cash_balance,
    rep_crime,
    rep_business,
    rep_family
  ) VALUES (
    v_user_id,
    p_username,
    v_build,
    COALESCE(p_district_id, 'scarborough'),
    COALESCE(p_district_id, 'scarborough'),
    v_starting_cash,
    v_rep_crime,
    v_rep_business,
    v_rep_family
  )
  RETURNING * INTO v_player;

  RETURN to_jsonb(v_player);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_new_player IS 'Creates a new player profile for the authenticated user';
