-- Street Legacy: Social & Crew Tables Migration
-- Migration: 003_social_tables
-- Description: Creates ENUMs and tables for crews, memberships, invites,
--              district influence, player relationships, and messaging

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Crew member roles (hierarchy)
CREATE TYPE crew_role_enum AS ENUM (
  'leader',
  'co_leader',
  'officer',
  'member'
);

-- Invitation status
CREATE TYPE invite_status_enum AS ENUM (
  'pending',
  'accepted',
  'declined',
  'expired'
);

-- Player relationship types
CREATE TYPE relationship_type_enum AS ENUM (
  'friend',
  'blocked',
  'rival'
);

-- =============================================================================
-- CREWS TABLE
-- =============================================================================

CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  tag VARCHAR(5) UNIQUE NOT NULL,
  description TEXT,
  leader_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  primary_district_id VARCHAR(50) REFERENCES districts(id) ON DELETE SET NULL,

  -- Progression
  level INT DEFAULT 1 CHECK (level >= 1 AND level <= 20),
  xp BIGINT DEFAULT 0 CHECK (xp >= 0),
  crew_rep INT DEFAULT 0 CHECK (crew_rep >= 0 AND crew_rep <= 1000),

  -- Membership
  member_count INT DEFAULT 1 CHECK (member_count >= 1),
  max_members INT DEFAULT 10 CHECK (max_members >= 1 AND max_members <= 100),

  -- Finances
  vault_balance BIGINT DEFAULT 0 CHECK (vault_balance >= 0),
  tax_rate INT DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 50),

  -- Customization
  emblem_data JSONB DEFAULT '{"primaryColor": "#ff0000", "secondaryColor": "#000000", "icon": "default"}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,

  -- Recruitment settings
  is_recruiting BOOLEAN DEFAULT TRUE,
  min_level_to_join INT DEFAULT 1,
  min_rep_to_join INT DEFAULT 0,

  -- Statistics
  total_earnings BIGINT DEFAULT 0,
  territories_controlled INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE crews IS 'Player-created crews/gangs';
COMMENT ON COLUMN crews.tag IS 'Short tag displayed before player names (e.g., [TAG])';
COMMENT ON COLUMN crews.leader_id IS 'Player who owns/leads the crew';
COMMENT ON COLUMN crews.vault_balance IS 'Shared crew treasury';
COMMENT ON COLUMN crews.tax_rate IS 'Percentage of member earnings taxed to vault (0-50)';
COMMENT ON COLUMN crews.emblem_data IS 'JSON containing crew emblem customization';

-- =============================================================================
-- CREW MEMBERS TABLE
-- =============================================================================

CREATE TABLE crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  player_id UUID NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  role crew_role_enum DEFAULT 'member',

  -- Contribution tracking
  contribution_total BIGINT DEFAULT 0 CHECK (contribution_total >= 0),
  earnings_taxed BIGINT DEFAULT 0 CHECK (earnings_taxed >= 0),

  -- Status
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  left_at TIMESTAMPTZ
);

COMMENT ON TABLE crew_members IS 'Crew membership records';
COMMENT ON COLUMN crew_members.contribution_total IS 'Total amount contributed to crew vault';
COMMENT ON COLUMN crew_members.earnings_taxed IS 'Total earnings that were taxed by crew';
COMMENT ON COLUMN crew_members.is_active IS 'FALSE if member left but record kept for history';

-- =============================================================================
-- CREW INVITES TABLE
-- =============================================================================

CREATE TABLE crew_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  invited_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  invited_by_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status invite_status_enum DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ
);

COMMENT ON TABLE crew_invites IS 'Pending crew invitations';
COMMENT ON COLUMN crew_invites.expires_at IS 'Invite expires after 7 days by default';

-- =============================================================================
-- DISTRICT INFLUENCE TABLE
-- =============================================================================

CREATE TABLE district_influence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  influence_score NUMERIC DEFAULT 0 CHECK (influence_score >= 0),
  influence_sources JSONB DEFAULT '{"properties": 0, "crimes": 0, "businesses": 0, "members": 0}'::jsonb,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each crew can only have one influence record per district
  UNIQUE(district_id, crew_id)
);

COMMENT ON TABLE district_influence IS 'Crew influence scores per district';
COMMENT ON COLUMN district_influence.influence_sources IS 'Breakdown of influence by source type';

-- =============================================================================
-- PLAYER RELATIONSHIPS TABLE
-- =============================================================================

CREATE TABLE player_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  relationship_type relationship_type_enum NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each player can only have one relationship type per target
  UNIQUE(player_id, target_player_id),

  -- Cannot have relationship with self
  CHECK (player_id != target_player_id)
);

COMMENT ON TABLE player_relationships IS 'Friend/block/rival relationships between players';
COMMENT ON COLUMN player_relationships.relationship_type IS 'friend=mutual friends, blocked=cannot interact, rival=PvP target';

-- =============================================================================
-- PLAYER MESSAGES TABLE (Direct Messages)
-- =============================================================================

CREATE TABLE player_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cannot message self
  CHECK (from_player_id != to_player_id)
);

COMMENT ON TABLE player_messages IS 'Direct messages between players';
COMMENT ON COLUMN player_messages.content IS 'Message content (max 500 characters)';

-- =============================================================================
-- DISTRICT CHAT TABLE (Public Chat)
-- =============================================================================

CREATE TABLE district_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id VARCHAR(50) NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE district_chat IS 'Public chat per district';
COMMENT ON COLUMN district_chat.content IS 'Chat message content (max 300 characters)';
COMMENT ON COLUMN district_chat.deleted_by IS 'Player/mod who deleted (if deleted)';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Crews indexes
CREATE INDEX idx_crews_leader ON crews(leader_id);
CREATE INDEX idx_crews_primary_district ON crews(primary_district_id);
CREATE INDEX idx_crews_recruiting ON crews(is_recruiting) WHERE is_recruiting = TRUE;
CREATE INDEX idx_crews_level ON crews(level DESC);
CREATE INDEX idx_crews_name ON crews(name);
CREATE INDEX idx_crews_tag ON crews(tag);

-- Crew members indexes
CREATE INDEX idx_crew_members_crew ON crew_members(crew_id);
CREATE INDEX idx_crew_members_player ON crew_members(player_id);
CREATE INDEX idx_crew_members_active ON crew_members(crew_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_crew_members_role ON crew_members(crew_id, role);

-- Crew invites indexes
CREATE INDEX idx_crew_invites_crew ON crew_invites(crew_id);
CREATE INDEX idx_crew_invites_invited_player ON crew_invites(invited_player_id);
CREATE INDEX idx_crew_invites_pending ON crew_invites(invited_player_id, status) WHERE status = 'pending';
CREATE INDEX idx_crew_invites_expires ON crew_invites(expires_at) WHERE status = 'pending';

-- District influence indexes
CREATE INDEX idx_district_influence_district ON district_influence(district_id);
CREATE INDEX idx_district_influence_crew ON district_influence(crew_id);
CREATE INDEX idx_district_influence_score ON district_influence(district_id, influence_score DESC);

-- Player relationships indexes
CREATE INDEX idx_relationships_player ON player_relationships(player_id);
CREATE INDEX idx_relationships_target ON player_relationships(target_player_id);
CREATE INDEX idx_relationships_type ON player_relationships(player_id, relationship_type);
CREATE INDEX idx_relationships_friends ON player_relationships(player_id) WHERE relationship_type = 'friend';
CREATE INDEX idx_relationships_blocked ON player_relationships(player_id) WHERE relationship_type = 'blocked';

-- Player messages indexes
CREATE INDEX idx_messages_to_player ON player_messages(to_player_id);
CREATE INDEX idx_messages_from_player ON player_messages(from_player_id);
CREATE INDEX idx_messages_unread ON player_messages(to_player_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_messages_conversation ON player_messages(
  LEAST(from_player_id, to_player_id),
  GREATEST(from_player_id, to_player_id),
  created_at DESC
);

-- District chat indexes
CREATE INDEX idx_district_chat_district ON district_chat(district_id);
CREATE INDEX idx_district_chat_player ON district_chat(player_id);
CREATE INDEX idx_district_chat_recent ON district_chat(district_id, created_at DESC) WHERE is_deleted = FALSE;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at trigger for crews
CREATE TRIGGER update_crews_updated_at
  BEFORE UPDATE ON crews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CREW MEMBER COUNT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_crew_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE crews SET member_count = member_count + 1 WHERE id = NEW.crew_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crews SET member_count = member_count - 1 WHERE id = OLD.crew_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle is_active status changes
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
      UPDATE crews SET member_count = member_count - 1 WHERE id = NEW.crew_id;
    ELSIF OLD.is_active = FALSE AND NEW.is_active = TRUE THEN
      UPDATE crews SET member_count = member_count + 1 WHERE id = NEW.crew_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crew_member_count
  AFTER INSERT OR DELETE OR UPDATE OF is_active ON crew_members
  FOR EACH ROW EXECUTE FUNCTION update_crew_member_count();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if player can message another player (not blocked)
CREATE OR REPLACE FUNCTION can_message_player(
  p_from_player_id UUID,
  p_to_player_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if target has blocked sender
  RETURN NOT EXISTS (
    SELECT 1 FROM player_relationships
    WHERE player_id = p_to_player_id
    AND target_player_id = p_from_player_id
    AND relationship_type = 'blocked'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_message_player IS 'Check if player can send message (not blocked)';

-- Function to get crew by player ID
CREATE OR REPLACE FUNCTION get_player_crew(p_player_id UUID)
RETURNS UUID AS $$
DECLARE
  v_crew_id UUID;
BEGIN
  SELECT crew_id INTO v_crew_id
  FROM crew_members
  WHERE player_id = p_player_id
  AND is_active = TRUE;

  RETURN v_crew_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_player_crew IS 'Get crew ID for a player (NULL if not in crew)';

-- Function to check if player has permission in crew
CREATE OR REPLACE FUNCTION has_crew_permission(
  p_player_id UUID,
  p_required_role crew_role_enum
)
RETURNS BOOLEAN AS $$
DECLARE
  v_player_role crew_role_enum;
  v_role_hierarchy INT[];
BEGIN
  -- Get player's role
  SELECT role INTO v_player_role
  FROM crew_members
  WHERE player_id = p_player_id
  AND is_active = TRUE;

  IF v_player_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy: leader=0, co_leader=1, officer=2, member=3
  -- Lower number = more permissions
  RETURN (
    CASE v_player_role
      WHEN 'leader' THEN 0
      WHEN 'co_leader' THEN 1
      WHEN 'officer' THEN 2
      WHEN 'member' THEN 3
    END
  ) <= (
    CASE p_required_role
      WHEN 'leader' THEN 0
      WHEN 'co_leader' THEN 1
      WHEN 'officer' THEN 2
      WHEN 'member' THEN 3
    END
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_crew_permission IS 'Check if player has required crew role or higher';

-- Function to expire old invites
CREATE OR REPLACE FUNCTION expire_old_invites()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE crew_invites
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_invites IS 'Mark expired pending invites, returns count updated';

-- Function to calculate district controlling crew
CREATE OR REPLACE FUNCTION calculate_district_controller(p_district_id VARCHAR(50))
RETURNS UUID AS $$
DECLARE
  v_controlling_crew_id UUID;
BEGIN
  -- Get crew with highest influence in this district
  SELECT crew_id INTO v_controlling_crew_id
  FROM district_influence
  WHERE district_id = p_district_id
  AND influence_score > 0
  ORDER BY influence_score DESC
  LIMIT 1;

  -- Update district's controlling_crew_id
  UPDATE districts
  SET controlling_crew_id = v_controlling_crew_id
  WHERE id = p_district_id;

  RETURN v_controlling_crew_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_district_controller IS 'Determine and set which crew controls a district';

-- =============================================================================
-- DEFERRED FOREIGN KEYS FROM PREVIOUS MIGRATIONS
-- =============================================================================

-- Add FK from districts to crews (was deferred in migration 001)
ALTER TABLE districts
  ADD CONSTRAINT fk_districts_controlling_crew
  FOREIGN KEY (controlling_crew_id) REFERENCES crews(id) ON DELETE SET NULL;

-- Add crew_id column and FK to transactions table (for crew-related transactions)
ALTER TABLE transactions
  ADD COLUMN crew_id UUID;

ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_crew
  FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE SET NULL;

-- Index for crew transactions
CREATE INDEX idx_transactions_crew ON transactions(crew_id) WHERE crew_id IS NOT NULL;

-- =============================================================================
-- VALIDATION CONSTRAINTS
-- =============================================================================

-- Ensure leader is a member of the crew
CREATE OR REPLACE FUNCTION validate_crew_leader()
RETURNS TRIGGER AS $$
BEGIN
  -- On crew creation, we need to allow the leader before the member record exists
  -- This validation is for updates to leader_id
  IF TG_OP = 'UPDATE' AND OLD.leader_id != NEW.leader_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM crew_members
      WHERE crew_id = NEW.id
      AND player_id = NEW.leader_id
      AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'New leader must be an active member of the crew';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_crew_leader_trigger
  BEFORE UPDATE OF leader_id ON crews
  FOR EACH ROW EXECUTE FUNCTION validate_crew_leader();

-- Prevent inviting players already in a crew
CREATE OR REPLACE FUNCTION validate_crew_invite()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if player is already in a crew
  IF EXISTS (
    SELECT 1 FROM crew_members
    WHERE player_id = NEW.invited_player_id
    AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Cannot invite player who is already in a crew';
  END IF;

  -- Check if there's already a pending invite from this crew
  IF EXISTS (
    SELECT 1 FROM crew_invites
    WHERE crew_id = NEW.crew_id
    AND invited_player_id = NEW.invited_player_id
    AND status = 'pending'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) THEN
    RAISE EXCEPTION 'Player already has pending invite from this crew';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_crew_invite_trigger
  BEFORE INSERT ON crew_invites
  FOR EACH ROW EXECUTE FUNCTION validate_crew_invite();

-- Prevent messaging blocked players
CREATE OR REPLACE FUNCTION validate_player_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT can_message_player(NEW.from_player_id, NEW.to_player_id) THEN
    RAISE EXCEPTION 'Cannot send message to player who has blocked you';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_player_message_trigger
  BEFORE INSERT ON player_messages
  FOR EACH ROW EXECUTE FUNCTION validate_player_message();

