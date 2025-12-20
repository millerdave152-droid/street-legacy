-- Street Legacy: Crew Management Functions Migration
-- Migration: 011_crew_functions
-- Description: SECURITY DEFINER functions for crew operations including
--              creation, membership, invites, vault, and leadership management

-- =============================================================================
-- CREATE CREW
-- Create a new crew (costs $10,000, requires level 5)
-- =============================================================================

CREATE OR REPLACE FUNCTION create_crew(
  p_name VARCHAR(50),
  p_tag VARCHAR(5),
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  crew_id UUID,
  crew_name VARCHAR,
  crew_tag VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player RECORD;
  v_crew_id UUID;
  v_creation_cost BIGINT := 10000;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get player
  SELECT * INTO v_player FROM players WHERE id = v_player_id;

  -- Validation
  IF LENGTH(p_name) < 3 OR LENGTH(p_name) > 50 THEN
    RAISE EXCEPTION 'Crew name must be between 3 and 50 characters';
  END IF;

  IF LENGTH(p_tag) < 2 OR LENGTH(p_tag) > 5 THEN
    RAISE EXCEPTION 'Crew tag must be between 2 and 5 characters';
  END IF;

  IF p_tag !~ '^[A-Z0-9]+$' THEN
    RAISE EXCEPTION 'Crew tag can only contain uppercase letters and numbers';
  END IF;

  -- Check if player is already in a crew
  IF EXISTS (SELECT 1 FROM crew_members WHERE player_id = v_player_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'You are already in a crew. Leave your current crew first.';
  END IF;

  -- Check level requirement (level 5 to create crew)
  IF v_player.level < 5 THEN
    RAISE EXCEPTION 'You must be level 5 or higher to create a crew';
  END IF;

  -- Check unique name and tag
  IF EXISTS (SELECT 1 FROM crews WHERE LOWER(name) = LOWER(p_name) AND is_active = TRUE) THEN
    RAISE EXCEPTION 'A crew with that name already exists';
  END IF;

  IF EXISTS (SELECT 1 FROM crews WHERE UPPER(tag) = UPPER(p_tag) AND is_active = TRUE) THEN
    RAISE EXCEPTION 'A crew with that tag already exists';
  END IF;

  -- Deduct creation cost
  PERFORM modify_player_balance(
    v_player_id,
    -v_creation_cost,
    'cash',
    'crew',
    'Created crew: ' || p_name,
    NULL,
    NULL,
    NULL,
    NULL
  );

  -- Create crew
  INSERT INTO crews (name, tag, description, leader_id, home_district_id)
  VALUES (p_name, UPPER(p_tag), p_description, v_player_id, v_player.home_district_id)
  RETURNING id INTO v_crew_id;

  -- Add founder as leader
  INSERT INTO crew_members (crew_id, player_id, role, invited_by_player_id)
  VALUES (v_crew_id, v_player_id, 'leader', v_player_id);

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'created', v_crew_id,
    jsonb_build_object('name', p_name, 'tag', UPPER(p_tag)));

  -- Update mission progress
  PERFORM update_mission_progress(v_player_id, 'create_crew', jsonb_build_object('crew_id', v_crew_id));

  RETURN QUERY SELECT
    TRUE,
    v_crew_id,
    p_name::VARCHAR,
    UPPER(p_tag)::VARCHAR,
    ('Created crew [' || UPPER(p_tag) || '] ' || p_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_crew IS 'Creates a new crew (costs $10,000, requires level 5)';

-- =============================================================================
-- GET CREW DETAILS
-- Get full crew information
-- =============================================================================

CREATE OR REPLACE FUNCTION get_crew_details(p_crew_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  tag VARCHAR,
  description TEXT,
  leader_id UUID,
  leader_username VARCHAR,
  home_district_id VARCHAR,
  home_district_name VARCHAR,
  level INT,
  xp BIGINT,
  member_count INT,
  max_members INT,
  vault_balance BIGINT,
  tax_rate INT,
  total_influence INT,
  reputation INT,
  wars_won INT,
  wars_lost INT,
  is_recruiting BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.tag,
    c.description,
    c.leader_id,
    p.username AS leader_username,
    c.home_district_id,
    d.name AS home_district_name,
    c.level,
    c.xp,
    c.member_count,
    c.max_members,
    c.vault_balance,
    c.tax_rate,
    c.total_influence,
    c.reputation,
    c.wars_won,
    c.wars_lost,
    c.is_recruiting,
    c.created_at
  FROM crews c
  JOIN players p ON p.id = c.leader_id
  LEFT JOIN districts d ON d.id = c.home_district_id
  WHERE c.id = p_crew_id AND c.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_crew_details IS 'Returns full details for a crew';

-- =============================================================================
-- GET CREW MEMBERS
-- Get all active members of a crew
-- =============================================================================

CREATE OR REPLACE FUNCTION get_crew_members(p_crew_id UUID)
RETURNS TABLE (
  id UUID,
  player_id UUID,
  username VARCHAR,
  display_name VARCHAR,
  level INT,
  role crew_role_enum,
  contribution_points BIGINT,
  earnings_taxed BIGINT,
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  is_online BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.player_id,
    p.username,
    p.display_name,
    p.level,
    cm.role,
    cm.contribution_points,
    cm.earnings_taxed,
    cm.joined_at,
    p.updated_at AS last_active_at,
    p.updated_at > NOW() - INTERVAL '5 minutes' AS is_online
  FROM crew_members cm
  JOIN players p ON p.id = cm.player_id
  WHERE cm.crew_id = p_crew_id AND cm.is_active = TRUE
  ORDER BY
    CASE cm.role
      WHEN 'leader' THEN 1
      WHEN 'officer' THEN 2
      ELSE 3
    END,
    cm.contribution_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_crew_members IS 'Returns all active members of a crew';

-- =============================================================================
-- INVITE TO CREW
-- Send a crew invitation to another player
-- =============================================================================

CREATE OR REPLACE FUNCTION invite_to_crew(
  p_crew_id UUID,
  p_target_username VARCHAR(30)
)
RETURNS TABLE (
  success BOOLEAN,
  invite_id UUID,
  target_username VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_role crew_role_enum;
  v_target_id UUID;
  v_crew RECORD;
  v_invite_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get crew
  SELECT * INTO v_crew FROM crews WHERE id = p_crew_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crew not found';
  END IF;

  -- Check inviter role
  SELECT role INTO v_player_role
  FROM crew_members
  WHERE crew_id = p_crew_id AND player_id = v_player_id AND is_active = TRUE;

  IF NOT FOUND OR v_player_role NOT IN ('leader', 'officer') THEN
    RAISE EXCEPTION 'Only leaders and officers can invite players';
  END IF;

  -- Check crew capacity
  IF v_crew.member_count >= v_crew.max_members THEN
    RAISE EXCEPTION 'Crew is at maximum capacity (%)', v_crew.max_members;
  END IF;

  -- Find target player
  SELECT id INTO v_target_id FROM players WHERE LOWER(username) = LOWER(p_target_username);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', p_target_username;
  END IF;

  IF v_target_id = v_player_id THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;

  -- Check if target is already in a crew
  IF EXISTS (SELECT 1 FROM crew_members WHERE player_id = v_target_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Player is already in a crew';
  END IF;

  -- Check for existing pending invite
  IF EXISTS (
    SELECT 1 FROM crew_invites
    WHERE crew_id = p_crew_id
    AND invited_player_id = v_target_id
    AND status = 'pending'
    AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Player already has a pending invite from this crew';
  END IF;

  -- Create invite
  INSERT INTO crew_invites (crew_id, invited_player_id, invited_by_player_id, expires_at)
  VALUES (p_crew_id, v_target_id, v_player_id, NOW() + INTERVAL '7 days')
  RETURNING id INTO v_invite_id;

  -- Send message to target
  INSERT INTO player_messages (sender_id, recipient_id, subject, content, metadata)
  VALUES (v_player_id, v_target_id,
    'Crew Invite: ' || v_crew.name,
    'You have been invited to join [' || v_crew.tag || '] ' || v_crew.name,
    jsonb_build_object('type', 'crew_invite', 'invite_id', v_invite_id, 'crew_id', p_crew_id, 'crew_name', v_crew.name));

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'invite_sent', v_target_id, p_crew_id,
    jsonb_build_object('invite_id', v_invite_id, 'target_username', p_target_username));

  RETURN QUERY SELECT
    TRUE,
    v_invite_id,
    p_target_username::VARCHAR,
    ('Invited ' || p_target_username || ' to the crew')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION invite_to_crew IS 'Sends a crew invitation to another player';

-- =============================================================================
-- ACCEPT CREW INVITE
-- Accept a pending crew invitation
-- =============================================================================

CREATE OR REPLACE FUNCTION accept_crew_invite(p_invite_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  crew_id UUID,
  crew_name VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_invite RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get invite with lock
  SELECT ci.*, c.name AS crew_name, c.member_count, c.max_members
  INTO v_invite
  FROM crew_invites ci
  JOIN crews c ON c.id = ci.crew_id
  WHERE ci.id = p_invite_id
  FOR UPDATE OF ci;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.invited_player_id != v_player_id THEN
    RAISE EXCEPTION 'This invite is not for you';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer valid. Status: %', v_invite.status;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE crew_invites SET status = 'expired' WHERE id = p_invite_id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  -- Check if already in a crew
  IF EXISTS (SELECT 1 FROM crew_members WHERE player_id = v_player_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'You are already in a crew';
  END IF;

  -- Check crew capacity
  IF v_invite.member_count >= v_invite.max_members THEN
    RAISE EXCEPTION 'Crew is at maximum capacity';
  END IF;

  -- Accept invite
  UPDATE crew_invites SET status = 'accepted' WHERE id = p_invite_id;

  -- Add to crew
  INSERT INTO crew_members (crew_id, player_id, role, invited_by_player_id)
  VALUES (v_invite.crew_id, v_player_id, 'member', v_invite.invited_by_player_id);

  -- Update crew member count (trigger should handle this, but explicit update for safety)
  UPDATE crews SET member_count = member_count + 1 WHERE id = v_invite.crew_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'joined', v_invite.crew_id,
    jsonb_build_object('crew_name', v_invite.crew_name));

  -- Update mission progress
  PERFORM update_mission_progress(v_player_id, 'join_crew', jsonb_build_object('crew_id', v_invite.crew_id));

  RETURN QUERY SELECT
    TRUE,
    v_invite.crew_id,
    v_invite.crew_name::VARCHAR,
    ('Joined crew: ' || v_invite.crew_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION accept_crew_invite IS 'Accepts a pending crew invitation';

-- =============================================================================
-- DECLINE CREW INVITE
-- Decline a pending crew invitation
-- =============================================================================

CREATE OR REPLACE FUNCTION decline_crew_invite(p_invite_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE crew_invites
  SET status = 'declined'
  WHERE id = p_invite_id
  AND invited_player_id = v_player_id
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already processed';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decline_crew_invite IS 'Declines a pending crew invitation';

-- =============================================================================
-- LEAVE CREW
-- Leave current crew (leader cannot leave)
-- =============================================================================

CREATE OR REPLACE FUNCTION leave_crew()
RETURNS TABLE (
  success BOOLEAN,
  former_crew_name VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_membership RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get membership
  SELECT cm.*, c.name AS crew_name, c.leader_id
  INTO v_membership
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.player_id = v_player_id AND cm.is_active = TRUE
  FOR UPDATE OF cm;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not in a crew';
  END IF;

  -- Leader cannot leave (must transfer leadership or disband)
  IF v_membership.role = 'leader' THEN
    RAISE EXCEPTION 'Leaders cannot leave. Transfer leadership or disband the crew.';
  END IF;

  -- Deactivate membership
  UPDATE crew_members
  SET is_active = FALSE, left_at = NOW()
  WHERE id = v_membership.id;

  -- Update crew count
  UPDATE crews SET member_count = member_count - 1 WHERE id = v_membership.crew_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'left', v_membership.crew_id,
    jsonb_build_object('crew_name', v_membership.crew_name));

  RETURN QUERY SELECT
    TRUE,
    v_membership.crew_name::VARCHAR,
    ('Left crew: ' || v_membership.crew_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION leave_crew IS 'Leaves current crew (leader cannot leave)';

-- =============================================================================
-- KICK CREW MEMBER
-- Remove a member from the crew
-- =============================================================================

CREATE OR REPLACE FUNCTION kick_crew_member(p_target_player_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  kicked_username VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_membership RECORD;
  v_target_membership RECORD;
  v_target_username VARCHAR;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get kicker's membership
  SELECT * INTO v_player_membership
  FROM crew_members
  WHERE player_id = v_player_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not in a crew';
  END IF;

  -- Get target's membership
  SELECT cm.*, p.username INTO v_target_membership
  FROM crew_members cm
  JOIN players p ON p.id = cm.player_id
  WHERE cm.player_id = p_target_player_id
  AND cm.crew_id = v_player_membership.crew_id
  AND cm.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player is not in your crew';
  END IF;

  v_target_username := v_target_membership.username;

  -- Check permissions
  IF v_player_membership.role = 'member' THEN
    RAISE EXCEPTION 'Only leaders and officers can kick members';
  END IF;

  -- Officers cannot kick other officers or leader
  IF v_player_membership.role = 'officer' AND v_target_membership.role IN ('leader', 'officer') THEN
    RAISE EXCEPTION 'Officers cannot kick other officers or the leader';
  END IF;

  -- Leader cannot be kicked
  IF v_target_membership.role = 'leader' THEN
    RAISE EXCEPTION 'The leader cannot be kicked';
  END IF;

  -- Kick the member
  UPDATE crew_members
  SET is_active = FALSE, left_at = NOW()
  WHERE id = v_target_membership.id;

  -- Update crew count
  UPDATE crews SET member_count = member_count - 1 WHERE id = v_player_membership.crew_id;

  -- Send notification
  INSERT INTO player_messages (sender_id, recipient_id, subject, content)
  VALUES (v_player_id, p_target_player_id,
    'Removed from crew',
    'You have been removed from the crew.');

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'member_kicked', p_target_player_id, v_player_membership.crew_id,
    jsonb_build_object('kicked_username', v_target_username));

  RETURN QUERY SELECT
    TRUE,
    v_target_username,
    ('Kicked ' || v_target_username || ' from the crew')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION kick_crew_member IS 'Removes a member from the crew';

-- =============================================================================
-- PROMOTE CREW MEMBER
-- Promote a member to officer (leader only)
-- =============================================================================

CREATE OR REPLACE FUNCTION promote_crew_member(p_target_player_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  promoted_username VARCHAR,
  new_role crew_role_enum,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_membership RECORD;
  v_target_membership RECORD;
  v_target_username VARCHAR;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get promoter's membership
  SELECT * INTO v_player_membership
  FROM crew_members
  WHERE player_id = v_player_id AND is_active = TRUE;

  IF NOT FOUND OR v_player_membership.role != 'leader' THEN
    RAISE EXCEPTION 'Only the crew leader can promote members';
  END IF;

  -- Get target's membership
  SELECT cm.*, p.username INTO v_target_membership
  FROM crew_members cm
  JOIN players p ON p.id = cm.player_id
  WHERE cm.player_id = p_target_player_id
  AND cm.crew_id = v_player_membership.crew_id
  AND cm.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player is not in your crew';
  END IF;

  v_target_username := v_target_membership.username;

  IF v_target_membership.role != 'member' THEN
    RAISE EXCEPTION 'Only members can be promoted to officer';
  END IF;

  -- Promote
  UPDATE crew_members SET role = 'officer' WHERE id = v_target_membership.id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'member_promoted', p_target_player_id, v_player_membership.crew_id,
    jsonb_build_object('username', v_target_username, 'new_role', 'officer'));

  RETURN QUERY SELECT
    TRUE,
    v_target_username,
    'officer'::crew_role_enum,
    ('Promoted ' || v_target_username || ' to officer')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION promote_crew_member IS 'Promotes a member to officer';

-- =============================================================================
-- DEMOTE CREW MEMBER
-- Demote an officer to member (leader only)
-- =============================================================================

CREATE OR REPLACE FUNCTION demote_crew_member(p_target_player_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  demoted_username VARCHAR,
  new_role crew_role_enum,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_membership RECORD;
  v_target_membership RECORD;
  v_target_username VARCHAR;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get demoter's membership
  SELECT * INTO v_player_membership
  FROM crew_members
  WHERE player_id = v_player_id AND is_active = TRUE;

  IF NOT FOUND OR v_player_membership.role != 'leader' THEN
    RAISE EXCEPTION 'Only the crew leader can demote members';
  END IF;

  -- Get target's membership
  SELECT cm.*, p.username INTO v_target_membership
  FROM crew_members cm
  JOIN players p ON p.id = cm.player_id
  WHERE cm.player_id = p_target_player_id
  AND cm.crew_id = v_player_membership.crew_id
  AND cm.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player is not in your crew';
  END IF;

  v_target_username := v_target_membership.username;

  IF v_target_membership.role != 'officer' THEN
    RAISE EXCEPTION 'Only officers can be demoted';
  END IF;

  -- Demote
  UPDATE crew_members SET role = 'member' WHERE id = v_target_membership.id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'member_demoted', p_target_player_id, v_player_membership.crew_id,
    jsonb_build_object('username', v_target_username, 'new_role', 'member'));

  RETURN QUERY SELECT
    TRUE,
    v_target_username,
    'member'::crew_role_enum,
    ('Demoted ' || v_target_username || ' to member')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION demote_crew_member IS 'Demotes an officer to member';

-- =============================================================================
-- TRANSFER CREW LEADERSHIP
-- Transfer leadership to another member
-- =============================================================================

CREATE OR REPLACE FUNCTION transfer_crew_leadership(p_target_player_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  new_leader_username VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_player_membership RECORD;
  v_target_membership RECORD;
  v_target_username VARCHAR;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current leader's membership
  SELECT * INTO v_player_membership
  FROM crew_members
  WHERE player_id = v_player_id AND is_active = TRUE;

  IF NOT FOUND OR v_player_membership.role != 'leader' THEN
    RAISE EXCEPTION 'Only the crew leader can transfer leadership';
  END IF;

  -- Get target's membership
  SELECT cm.*, p.username INTO v_target_membership
  FROM crew_members cm
  JOIN players p ON p.id = cm.player_id
  WHERE cm.player_id = p_target_player_id
  AND cm.crew_id = v_player_membership.crew_id
  AND cm.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player is not in your crew';
  END IF;

  v_target_username := v_target_membership.username;

  -- Transfer leadership
  UPDATE crew_members SET role = 'officer' WHERE id = v_player_membership.id;
  UPDATE crew_members SET role = 'leader' WHERE id = v_target_membership.id;
  UPDATE crews SET leader_id = p_target_player_id WHERE id = v_player_membership.crew_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, target_player_id, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'leadership_transferred', p_target_player_id, v_player_membership.crew_id,
    jsonb_build_object('new_leader', v_target_username));

  RETURN QUERY SELECT
    TRUE,
    v_target_username,
    ('Transferred leadership to ' || v_target_username)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION transfer_crew_leadership IS 'Transfers crew leadership to another member';

-- =============================================================================
-- DISBAND CREW
-- Delete crew entirely (leader only), returns vault to leader
-- =============================================================================

CREATE OR REPLACE FUNCTION disband_crew()
RETURNS TABLE (
  success BOOLEAN,
  crew_name VARCHAR,
  vault_returned BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_membership RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get membership
  SELECT cm.*, c.name AS crew_name, c.vault_balance
  INTO v_membership
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.player_id = v_player_id AND cm.is_active = TRUE;

  IF NOT FOUND OR v_membership.role != 'leader' THEN
    RAISE EXCEPTION 'Only the crew leader can disband the crew';
  END IF;

  -- Return vault to leader
  IF v_membership.vault_balance > 0 THEN
    PERFORM modify_player_balance(
      v_player_id,
      v_membership.vault_balance,
      'cash',
      'crew',
      'Vault returned from disbanded crew: ' || v_membership.crew_name,
      NULL,
      NULL,
      NULL,
      NULL
    );
  END IF;

  -- Notify all members
  INSERT INTO player_messages (sender_id, recipient_id, subject, content)
  SELECT v_player_id, cm.player_id,
    'Crew disbanded',
    'The crew [' || v_membership.crew_name || '] has been disbanded by the leader.'
  FROM crew_members cm
  WHERE cm.crew_id = v_membership.crew_id
  AND cm.is_active = TRUE
  AND cm.player_id != v_player_id;

  -- Deactivate all memberships
  UPDATE crew_members
  SET is_active = FALSE, left_at = NOW()
  WHERE crew_id = v_membership.crew_id;

  -- Cancel pending invites
  UPDATE crew_invites SET status = 'expired'
  WHERE crew_id = v_membership.crew_id AND status = 'pending';

  -- Mark crew as inactive (soft delete)
  UPDATE crews SET is_active = FALSE WHERE id = v_membership.crew_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, metadata)
  VALUES (v_player_id, 'crew', 'disbanded', v_membership.crew_id,
    jsonb_build_object('crew_name', v_membership.crew_name, 'vault_returned', v_membership.vault_balance));

  RETURN QUERY SELECT
    TRUE,
    v_membership.crew_name::VARCHAR,
    v_membership.vault_balance,
    ('Disbanded crew: ' || v_membership.crew_name)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION disband_crew IS 'Disbands the crew and returns vault to leader';

-- =============================================================================
-- DEPOSIT TO CREW VAULT
-- Contribute cash to crew vault (earns contribution points)
-- =============================================================================

CREATE OR REPLACE FUNCTION deposit_to_crew_vault(p_amount BIGINT)
RETURNS TABLE (
  success BOOLEAN,
  new_vault_balance BIGINT,
  contribution_points_earned BIGINT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_membership RECORD;
  v_new_vault BIGINT;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Get membership
  SELECT cm.*, c.vault_balance, c.name AS crew_name
  INTO v_membership
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.player_id = v_player_id AND cm.is_active = TRUE
  FOR UPDATE OF cm, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not in a crew';
  END IF;

  -- Deduct from player
  PERFORM modify_player_balance(
    v_player_id,
    -p_amount,
    'cash',
    'crew',
    'Deposit to crew vault',
    NULL,
    NULL,
    NULL,
    v_membership.crew_id
  );

  -- Add to vault
  UPDATE crews
  SET vault_balance = vault_balance + p_amount
  WHERE id = v_membership.crew_id
  RETURNING vault_balance INTO v_new_vault;

  -- Add contribution points (1 point per $100)
  UPDATE crew_members
  SET contribution_points = contribution_points + (p_amount / 100)
  WHERE id = v_membership.id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, value_numeric, metadata)
  VALUES (v_player_id, 'crew', 'vault_deposit', v_membership.crew_id, p_amount,
    jsonb_build_object('new_balance', v_new_vault));

  RETURN QUERY SELECT
    TRUE,
    v_new_vault,
    (p_amount / 100)::BIGINT,
    ('Deposited $' || p_amount || ' to crew vault')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deposit_to_crew_vault IS 'Deposits cash to crew vault and earns contribution points';

-- =============================================================================
-- SET CREW TAX RATE
-- Set the earnings tax rate (0-50%, leader only)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_crew_tax_rate(p_rate INT)
RETURNS TABLE (
  success BOOLEAN,
  new_rate INT,
  message TEXT
) AS $$
DECLARE
  v_player_id UUID;
  v_membership RECORD;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rate < 0 OR p_rate > 50 THEN
    RAISE EXCEPTION 'Tax rate must be between 0 and 50 percent';
  END IF;

  -- Get membership
  SELECT cm.*, c.name AS crew_name
  INTO v_membership
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.player_id = v_player_id AND cm.is_active = TRUE;

  IF NOT FOUND OR v_membership.role != 'leader' THEN
    RAISE EXCEPTION 'Only the crew leader can set the tax rate';
  END IF;

  -- Update tax rate
  UPDATE crews SET tax_rate = p_rate WHERE id = v_membership.crew_id;

  -- Log event
  INSERT INTO game_events (player_id, event_type, event_subtype, crew_id, value_numeric, metadata)
  VALUES (v_player_id, 'crew', 'tax_rate_changed', v_membership.crew_id, p_rate,
    jsonb_build_object('new_rate', p_rate));

  RETURN QUERY SELECT
    TRUE,
    p_rate,
    ('Set crew tax rate to ' || p_rate || '%')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_crew_tax_rate IS 'Sets the crew earnings tax rate (0-50%)';

-- =============================================================================
-- GET MY CREW
-- Get current player's crew info and membership details
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_crew()
RETURNS TABLE (
  crew_id UUID,
  crew_name VARCHAR,
  crew_tag VARCHAR,
  my_role crew_role_enum,
  my_contribution_points BIGINT,
  my_earnings_taxed BIGINT,
  member_count INT,
  max_members INT,
  vault_balance BIGINT,
  tax_rate INT,
  crew_level INT,
  pending_invites INT
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS crew_id,
    c.name AS crew_name,
    c.tag AS crew_tag,
    cm.role AS my_role,
    cm.contribution_points AS my_contribution_points,
    cm.earnings_taxed AS my_earnings_taxed,
    c.member_count,
    c.max_members,
    c.vault_balance,
    c.tax_rate,
    c.level AS crew_level,
    (SELECT COUNT(*)::INT FROM crew_invites ci WHERE ci.crew_id = c.id AND ci.status = 'pending' AND ci.expires_at > NOW()) AS pending_invites
  FROM crew_members cm
  JOIN crews c ON c.id = cm.crew_id
  WHERE cm.player_id = v_player_id AND cm.is_active = TRUE AND c.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_my_crew IS 'Returns current player''s crew info and membership details';

-- =============================================================================
-- GET PENDING CREW INVITES
-- Get all pending invites for the current player
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_crew_invites()
RETURNS TABLE (
  invite_id UUID,
  crew_id UUID,
  crew_name VARCHAR,
  crew_tag VARCHAR,
  invited_by_username VARCHAR,
  invited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := current_player_id();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    ci.id AS invite_id,
    ci.crew_id,
    c.name AS crew_name,
    c.tag AS crew_tag,
    p.username AS invited_by_username,
    ci.created_at AS invited_at,
    ci.expires_at
  FROM crew_invites ci
  JOIN crews c ON c.id = ci.crew_id
  JOIN players p ON p.id = ci.invited_by_player_id
  WHERE ci.invited_player_id = v_player_id
  AND ci.status = 'pending'
  AND ci.expires_at > NOW()
  AND c.is_active = TRUE
  ORDER BY ci.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pending_crew_invites IS 'Returns all pending crew invites for the player';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION create_crew TO authenticated;
GRANT EXECUTE ON FUNCTION get_crew_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_crew_members TO authenticated;
GRANT EXECUTE ON FUNCTION invite_to_crew TO authenticated;
GRANT EXECUTE ON FUNCTION accept_crew_invite TO authenticated;
GRANT EXECUTE ON FUNCTION decline_crew_invite TO authenticated;
GRANT EXECUTE ON FUNCTION leave_crew TO authenticated;
GRANT EXECUTE ON FUNCTION kick_crew_member TO authenticated;
GRANT EXECUTE ON FUNCTION promote_crew_member TO authenticated;
GRANT EXECUTE ON FUNCTION demote_crew_member TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_crew_leadership TO authenticated;
GRANT EXECUTE ON FUNCTION disband_crew TO authenticated;
GRANT EXECUTE ON FUNCTION deposit_to_crew_vault TO authenticated;
GRANT EXECUTE ON FUNCTION set_crew_tax_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_crew TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_crew_invites TO authenticated;
