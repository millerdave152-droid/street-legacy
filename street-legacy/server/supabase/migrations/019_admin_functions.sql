-- ============================================================================
-- Street Legacy - Admin RPC Functions
-- Migration 019: Additional admin-only functions for stat modifications
-- ============================================================================

-- ==========================================================================
-- ADMIN SET PLAYER STATS
-- Set multiple player stats at once (admin only)
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_set_player_stats(
  p_admin_id UUID,
  p_target_id UUID,
  p_cash BIGINT DEFAULT NULL,
  p_bank BIGINT DEFAULT NULL,
  p_energy INTEGER DEFAULT NULL,
  p_health INTEGER DEFAULT NULL,
  p_heat INTEGER DEFAULT NULL,
  p_xp BIGINT DEFAULT NULL,
  p_level INTEGER DEFAULT NULL,
  p_respect BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update player stats
  UPDATE players SET
    cash = COALESCE(p_cash, cash),
    bank_balance = COALESCE(p_bank, bank_balance),
    energy = COALESCE(LEAST(p_energy, max_energy), energy),
    health = COALESCE(LEAST(p_health, max_health), health),
    heat = COALESCE(LEAST(GREATEST(p_heat, 0), 100), heat),
    xp = COALESCE(p_xp, xp),
    level = COALESCE(LEAST(GREATEST(p_level, 1), 100), level),
    respect = COALESCE(p_respect, respect),
    updated_at = NOW()
  WHERE id = p_target_id;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'set_stats',
    p_target_id,
    jsonb_build_object(
      'cash', p_cash,
      'bank', p_bank,
      'energy', p_energy,
      'health', p_health,
      'heat', p_heat,
      'xp', p_xp,
      'level', p_level,
      'respect', p_respect
    )
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN UNLOCK ALL DISTRICTS
-- Set player level high enough to unlock all districts
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_unlock_all_districts(
  p_admin_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Set player level to 50 (should unlock all districts)
  UPDATE players SET
    level = GREATEST(level, 50),
    updated_at = NOW()
  WHERE id = p_target_id;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (p_admin_id, 'unlock_districts', p_target_id, '{"action": "unlocked_all_districts"}'::jsonb);

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN GIVE ALL ITEMS
-- Give player 10 of each item in the game
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_give_all_items(
  p_admin_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_count INTEGER;
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Give 10 of each item (or add to existing)
  INSERT INTO inventory (player_id, item_id, quantity)
  SELECT p_target_id, id, 10 FROM items
  ON CONFLICT (player_id, item_id)
  DO UPDATE SET quantity = inventory.quantity + 10;

  GET DIAGNOSTICS v_item_count = ROW_COUNT;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'give_items',
    p_target_id,
    jsonb_build_object('items_given', v_item_count, 'quantity_each', 10)
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN CLEAR COOLDOWNS
-- Remove all cooldown entries for a player
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_clear_cooldowns(
  p_admin_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Delete crime cooldowns if table exists
  DELETE FROM crime_cooldowns WHERE player_id = p_target_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Also update player's last_crime_at to allow immediate crime
  UPDATE players SET
    last_crime_at = NULL,
    last_job_at = NULL,
    jail_until = NULL,
    updated_at = NOW()
  WHERE id = p_target_id;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'clear_cooldowns',
    p_target_id,
    jsonb_build_object('cooldowns_cleared', v_deleted_count)
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN UNLOCK ALL ACHIEVEMENTS
-- Unlock (but not claim) all achievements for a player
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_unlock_all_achievements(
  p_admin_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unlocked_count INTEGER;
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Unlock all achievements (not claimed yet)
  INSERT INTO player_achievements (player_id, achievement_id, unlocked_at, claimed)
  SELECT p_target_id, id, NOW(), FALSE FROM achievements
  ON CONFLICT (player_id, achievement_id) DO NOTHING;

  GET DIAGNOSTICS v_unlocked_count = ROW_COUNT;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'unlock_achievements',
    p_target_id,
    jsonb_build_object('achievements_unlocked', v_unlocked_count)
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN RESET PLAYER
-- Full reset of a player's progress (careful!)
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_reset_player(
  p_admin_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Prevent resetting admins (safety measure)
  IF EXISTS (SELECT 1 FROM players WHERE id = p_target_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Cannot reset admin accounts';
  END IF;

  -- Reset player stats to starting values
  UPDATE players SET
    level = 1,
    xp = 0,
    xp_to_next = 100,
    cash = 500,
    bank_balance = 0,
    health = 100,
    max_health = 100,
    energy = 100,
    max_energy = 100,
    heat = 0,
    respect = 0,
    total_crimes = 0,
    successful_crimes = 0,
    total_earnings = 0,
    tutorial_completed = FALSE,
    tutorial_step = 0,
    current_district_id = 1,
    jail_until = NULL,
    last_crime_at = NULL,
    last_job_at = NULL,
    is_jailed = FALSE,
    updated_at = NOW()
  WHERE id = p_target_id;

  -- Clear inventory
  DELETE FROM inventory WHERE player_id = p_target_id;

  -- Clear achievements
  DELETE FROM player_achievements WHERE player_id = p_target_id;

  -- Clear cooldowns
  DELETE FROM crime_cooldowns WHERE player_id = p_target_id;

  -- Release owned properties
  UPDATE properties SET
    owner_id = NULL,
    purchase_date = NULL
  WHERE owner_id = p_target_id;

  -- Release crew members
  UPDATE crew_members SET
    owner_id = NULL,
    available = TRUE,
    hired_at = NULL
  WHERE owner_id = p_target_id;

  -- Clear event history
  DELETE FROM player_events WHERE player_id = p_target_id;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'reset_player',
    p_target_id,
    '{"action": "full_player_reset"}'::jsonb
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN GIVE SPECIFIC ITEM
-- Give a specific item to a player
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_give_item(
  p_admin_id UUID,
  p_target_id UUID,
  p_item_id INTEGER,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Verify item exists
  IF NOT EXISTS (SELECT 1 FROM items WHERE id = p_item_id) THEN
    RAISE EXCEPTION 'Item does not exist';
  END IF;

  -- Add item to inventory
  INSERT INTO inventory (player_id, item_id, quantity)
  VALUES (p_target_id, p_item_id, p_quantity)
  ON CONFLICT (player_id, item_id)
  DO UPDATE SET quantity = inventory.quantity + p_quantity;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'give_item',
    p_target_id,
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity)
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- ADMIN SET TUTORIAL
-- Set tutorial step/completion for a player
-- ==========================================================================

CREATE OR REPLACE FUNCTION admin_set_tutorial(
  p_admin_id UUID,
  p_target_id UUID,
  p_completed BOOLEAN DEFAULT FALSE,
  p_step INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin status
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_admin_id AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update tutorial status
  UPDATE players SET
    tutorial_completed = p_completed,
    tutorial_step = p_step,
    updated_at = NOW()
  WHERE id = p_target_id;

  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, target_player_id, details)
  VALUES (
    p_admin_id,
    'set_tutorial',
    p_target_id,
    jsonb_build_object('completed', p_completed, 'step', p_step)
  );

  RETURN TRUE;
END;
$$;

-- ==========================================================================
-- GRANT EXECUTE PERMISSIONS
-- ==========================================================================

GRANT EXECUTE ON FUNCTION admin_set_player_stats TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unlock_all_districts TO authenticated;
GRANT EXECUTE ON FUNCTION admin_give_all_items TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clear_cooldowns TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unlock_all_achievements TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_player TO authenticated;
GRANT EXECUTE ON FUNCTION admin_give_item TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_tutorial TO authenticated;

-- ==========================================================================
-- CREATE crime_cooldowns TABLE IF NOT EXISTS
-- (Referenced in clear_cooldowns function)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS crime_cooldowns (
  id SERIAL PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  crime_type_id INTEGER REFERENCES crime_types(id),
  cooldown_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, crime_type_id)
);

CREATE INDEX IF NOT EXISTS idx_crime_cooldowns_player ON crime_cooldowns(player_id);
CREATE INDEX IF NOT EXISTS idx_crime_cooldowns_until ON crime_cooldowns(cooldown_until);

-- ==========================================================================
-- COMMENT ON FUNCTIONS
-- ==========================================================================

COMMENT ON FUNCTION admin_set_player_stats IS 'Admin-only: Set multiple player stats at once';
COMMENT ON FUNCTION admin_unlock_all_districts IS 'Admin-only: Unlock all districts for a player by setting level to 50';
COMMENT ON FUNCTION admin_give_all_items IS 'Admin-only: Give 10 of each item to a player';
COMMENT ON FUNCTION admin_clear_cooldowns IS 'Admin-only: Clear all cooldowns for a player';
COMMENT ON FUNCTION admin_unlock_all_achievements IS 'Admin-only: Unlock all achievements (unclaimed) for a player';
COMMENT ON FUNCTION admin_reset_player IS 'Admin-only: Full reset of player progress';
COMMENT ON FUNCTION admin_give_item IS 'Admin-only: Give a specific item to a player';
COMMENT ON FUNCTION admin_set_tutorial IS 'Admin-only: Set tutorial completion/step for a player';
