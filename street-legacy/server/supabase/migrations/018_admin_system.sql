-- =============================================================================
-- Street Legacy - Admin System Migration
-- =============================================================================
-- Adds admin capabilities for game management and debugging
-- =============================================================================

-- Add is_admin column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_admin_action TIMESTAMPTZ;

-- Create admin action log table
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES players(id),
  target_player_id UUID REFERENCES players(id),
  action_type TEXT NOT NULL,
  action_data JSONB DEFAULT '{}',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for admin logs
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_player ON admin_logs(target_player_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- =============================================================================
-- ADMIN CHECK FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION is_player_admin(player_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players
    WHERE id = player_uuid AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: MODIFY PLAYER STATS
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_modify_player_stats(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_stat_type TEXT,
  p_value NUMERIC,
  p_is_set BOOLEAN DEFAULT FALSE,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_old_value NUMERIC;
  v_new_value NUMERIC;
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get current value and update based on stat type
  CASE p_stat_type
    WHEN 'cash' THEN
      SELECT cash INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := GREATEST(0, p_value);
      ELSE
        v_new_value := GREATEST(0, v_old_value + p_value);
      END IF;
      UPDATE players SET cash = v_new_value WHERE id = p_target_player_id;

    WHEN 'bank_balance' THEN
      SELECT bank_balance INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := GREATEST(0, p_value);
      ELSE
        v_new_value := GREATEST(0, v_old_value + p_value);
      END IF;
      UPDATE players SET bank_balance = v_new_value WHERE id = p_target_player_id;

    WHEN 'energy' THEN
      SELECT energy INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := LEAST(100, GREATEST(0, p_value));
      ELSE
        v_new_value := LEAST(100, GREATEST(0, v_old_value + p_value));
      END IF;
      UPDATE players SET energy = v_new_value WHERE id = p_target_player_id;

    WHEN 'heat' THEN
      SELECT heat INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := LEAST(100, GREATEST(0, p_value));
      ELSE
        v_new_value := LEAST(100, GREATEST(0, v_old_value + p_value));
      END IF;
      UPDATE players SET heat = v_new_value WHERE id = p_target_player_id;

    WHEN 'xp' THEN
      SELECT xp INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := GREATEST(0, p_value);
      ELSE
        v_new_value := GREATEST(0, v_old_value + p_value);
      END IF;
      UPDATE players SET xp = v_new_value WHERE id = p_target_player_id;

    WHEN 'level' THEN
      SELECT level INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := LEAST(100, GREATEST(1, p_value));
      ELSE
        v_new_value := LEAST(100, GREATEST(1, v_old_value + p_value));
      END IF;
      UPDATE players SET level = v_new_value WHERE id = p_target_player_id;

    WHEN 'respect' THEN
      SELECT respect INTO v_old_value FROM players WHERE id = p_target_player_id;
      IF p_is_set THEN
        v_new_value := GREATEST(0, p_value);
      ELSE
        v_new_value := GREATEST(0, v_old_value + p_value);
      END IF;
      UPDATE players SET respect = v_new_value WHERE id = p_target_player_id;

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid stat type');
  END CASE;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (
    p_admin_id,
    p_target_player_id,
    'modify_stats',
    jsonb_build_object(
      'stat_type', p_stat_type,
      'old_value', v_old_value,
      'new_value', v_new_value,
      'is_set', p_is_set
    ),
    p_reason
  );

  -- Update admin's last action timestamp
  UPDATE players SET last_admin_action = NOW() WHERE id = p_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'stat_type', p_stat_type,
    'old_value', v_old_value,
    'new_value', v_new_value
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: JAIL/RELEASE PLAYER
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_jail_player(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_duration_minutes INTEGER,
  p_reason TEXT DEFAULT 'Admin action'
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE players SET
    is_jailed = TRUE,
    jail_release_at = NOW() + (p_duration_minutes || ' minutes')::INTERVAL
  WHERE id = p_target_player_id;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (
    p_admin_id,
    p_target_player_id,
    'jail_player',
    jsonb_build_object('duration_minutes', p_duration_minutes),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'message', 'Player jailed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_release_player(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_reason TEXT DEFAULT 'Admin action'
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE players SET
    is_jailed = FALSE,
    jail_release_at = NULL
  WHERE id = p_target_player_id;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (p_admin_id, p_target_player_id, 'release_player', '{}', p_reason);

  RETURN jsonb_build_object('success', true, 'message', 'Player released');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: BAN/UNBAN PLAYER
-- =============================================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION admin_ban_player(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_duration_hours INTEGER DEFAULT NULL, -- NULL = permanent
  p_reason TEXT DEFAULT 'Violation of terms'
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Prevent banning other admins
  IF is_player_admin(p_target_player_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot ban another admin');
  END IF;

  UPDATE players SET
    is_banned = TRUE,
    ban_reason = p_reason,
    banned_until = CASE
      WHEN p_duration_hours IS NULL THEN NULL
      ELSE NOW() + (p_duration_hours || ' hours')::INTERVAL
    END
  WHERE id = p_target_player_id;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (
    p_admin_id,
    p_target_player_id,
    'ban_player',
    jsonb_build_object('duration_hours', p_duration_hours, 'permanent', p_duration_hours IS NULL),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'message', 'Player banned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_unban_player(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_reason TEXT DEFAULT 'Admin action'
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE players SET
    is_banned = FALSE,
    ban_reason = NULL,
    banned_until = NULL
  WHERE id = p_target_player_id;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (p_admin_id, p_target_player_id, 'unban_player', '{}', p_reason);

  RETURN jsonb_build_object('success', true, 'message', 'Player unbanned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: GIVE ITEM
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_give_item(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_item_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_reason TEXT DEFAULT 'Admin grant'
)
RETURNS JSONB AS $$
DECLARE
  v_existing_id UUID;
  v_item_name TEXT;
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get item name
  SELECT name INTO v_item_name FROM items WHERE id = p_item_id;
  IF v_item_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;

  -- Check if player already has this item
  SELECT id INTO v_existing_id FROM player_inventory
  WHERE player_id = p_target_player_id AND item_id = p_item_id;

  IF v_existing_id IS NOT NULL THEN
    -- Update quantity
    UPDATE player_inventory SET quantity = quantity + p_quantity
    WHERE id = v_existing_id;
  ELSE
    -- Insert new
    INSERT INTO player_inventory (player_id, item_id, quantity)
    VALUES (p_target_player_id, p_item_id, p_quantity);
  END IF;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (
    p_admin_id,
    p_target_player_id,
    'give_item',
    jsonb_build_object('item_id', p_item_id, 'item_name', v_item_name, 'quantity', p_quantity),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'item', v_item_name, 'quantity', p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: TELEPORT PLAYER
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_teleport_player(
  p_admin_id UUID,
  p_target_player_id UUID,
  p_district_id INTEGER,
  p_reason TEXT DEFAULT 'Admin teleport'
)
RETURNS JSONB AS $$
DECLARE
  v_district_name TEXT;
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get district name
  SELECT name INTO v_district_name FROM districts WHERE id = p_district_id;
  IF v_district_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'District not found');
  END IF;

  UPDATE players SET current_district_id = p_district_id
  WHERE id = p_target_player_id;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data, reason)
  VALUES (
    p_admin_id,
    p_target_player_id,
    'teleport',
    jsonb_build_object('district_id', p_district_id, 'district_name', v_district_name),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'district', v_district_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: BROADCAST MESSAGE
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_broadcast(
  p_admin_id UUID,
  p_message TEXT,
  p_message_type TEXT DEFAULT 'info'
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Log the broadcast
  INSERT INTO admin_logs (admin_id, action_type, action_data)
  VALUES (
    p_admin_id,
    'broadcast',
    jsonb_build_object('message', p_message, 'type', p_message_type)
  );

  -- The actual broadcast is handled via realtime/websocket on the client
  RETURN jsonb_build_object('success', true, 'message', 'Broadcast sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: GET PLAYER INFO
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_get_player_info(
  p_admin_id UUID,
  p_target_player_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_player RECORD;
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_target_player_id;

  IF v_player IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'player', jsonb_build_object(
      'id', v_player.id,
      'username', v_player.username,
      'level', v_player.level,
      'xp', v_player.xp,
      'cash', v_player.cash,
      'bank_balance', v_player.bank_balance,
      'energy', v_player.energy,
      'heat', v_player.heat,
      'respect', v_player.respect,
      'current_district_id', v_player.current_district_id,
      'is_jailed', v_player.is_jailed,
      'jail_release_at', v_player.jail_release_at,
      'is_banned', v_player.is_banned,
      'ban_reason', v_player.ban_reason,
      'banned_until', v_player.banned_until,
      'is_admin', v_player.is_admin,
      'is_moderator', v_player.is_moderator,
      'created_at', v_player.created_at,
      'last_active', v_player.last_active,
      'total_crimes', v_player.total_crimes,
      'successful_crimes', v_player.successful_crimes
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: SEARCH PLAYERS
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_search_players(
  p_admin_id UUID,
  p_search_term TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'players', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'username', username,
        'level', level,
        'cash', cash,
        'is_jailed', is_jailed,
        'is_banned', is_banned,
        'is_admin', is_admin,
        'last_active', last_active
      ))
      FROM players
      WHERE p_search_term IS NULL
        OR username ILIKE '%' || p_search_term || '%'
      ORDER BY last_active DESC NULLS LAST
      LIMIT p_limit
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: GET LOGS
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_get_logs(
  p_admin_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_action_type TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'logs', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', al.id,
        'admin_username', p.username,
        'target_username', tp.username,
        'action_type', al.action_type,
        'action_data', al.action_data,
        'reason', al.reason,
        'created_at', al.created_at
      ) ORDER BY al.created_at DESC)
      FROM admin_logs al
      JOIN players p ON p.id = al.admin_id
      LEFT JOIN players tp ON tp.id = al.target_player_id
      WHERE p_action_type IS NULL OR al.action_type = p_action_type
      LIMIT p_limit
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ADMIN: RESET COOLDOWNS
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_reset_cooldowns(
  p_admin_id UUID,
  p_target_player_id UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin status
  IF NOT is_player_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE players SET
    crime_cooldown_until = NULL,
    job_cooldown_until = NULL,
    travel_cooldown_until = NULL
  WHERE id = p_target_player_id;

  -- Log the action
  INSERT INTO admin_logs (admin_id, target_player_id, action_type, action_data)
  VALUES (p_admin_id, p_target_player_id, 'reset_cooldowns', '{}');

  RETURN jsonb_build_object('success', true, 'message', 'Cooldowns reset');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Allow authenticated users to check if they're admin
GRANT EXECUTE ON FUNCTION is_player_admin TO authenticated;

-- Admin functions (will be called via edge functions with service role)
GRANT EXECUTE ON FUNCTION admin_modify_player_stats TO service_role;
GRANT EXECUTE ON FUNCTION admin_jail_player TO service_role;
GRANT EXECUTE ON FUNCTION admin_release_player TO service_role;
GRANT EXECUTE ON FUNCTION admin_ban_player TO service_role;
GRANT EXECUTE ON FUNCTION admin_unban_player TO service_role;
GRANT EXECUTE ON FUNCTION admin_give_item TO service_role;
GRANT EXECUTE ON FUNCTION admin_teleport_player TO service_role;
GRANT EXECUTE ON FUNCTION admin_broadcast TO service_role;
GRANT EXECUTE ON FUNCTION admin_get_player_info TO service_role;
GRANT EXECUTE ON FUNCTION admin_search_players TO service_role;
GRANT EXECUTE ON FUNCTION admin_get_logs TO service_role;
GRANT EXECUTE ON FUNCTION admin_reset_cooldowns TO service_role;

COMMENT ON TABLE admin_logs IS 'Audit log for all admin actions';
