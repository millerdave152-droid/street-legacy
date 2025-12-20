-- Street Legacy: Initial Database Schema
-- Toronto-based persistent multiplayer crime/business simulation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- PLAYERS TABLE
-- Core player data linked to Supabase Auth
-- ============================================================================
CREATE TABLE players (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,

    -- Game Stats
    cash BIGINT NOT NULL DEFAULT 1000,
    bank_balance BIGINT NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 0,
    respect INTEGER NOT NULL DEFAULT 0,
    heat INTEGER NOT NULL DEFAULT 0, -- Police attention level (0-100)

    -- Player Status
    health INTEGER NOT NULL DEFAULT 100 CHECK (health >= 0 AND health <= 100),
    energy INTEGER NOT NULL DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
    is_online BOOLEAN NOT NULL DEFAULT false,
    is_in_jail BOOLEAN NOT NULL DEFAULT false,
    jail_release_at TIMESTAMPTZ,
    is_in_hospital BOOLEAN NOT NULL DEFAULT false,
    hospital_release_at TIMESTAMPTZ,

    -- Location (Toronto coordinates)
    current_district_id UUID,
    position_x FLOAT,
    position_y FLOAT,

    -- Timestamps
    last_action_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DISTRICTS TABLE
-- Toronto neighborhoods/areas
-- ============================================================================
CREATE TABLE districts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,

    -- Geographic bounds (for Phaser map)
    bounds_x FLOAT NOT NULL,
    bounds_y FLOAT NOT NULL,
    bounds_width FLOAT NOT NULL,
    bounds_height FLOAT NOT NULL,

    -- District properties
    danger_level INTEGER NOT NULL DEFAULT 1 CHECK (danger_level >= 1 AND danger_level <= 10),
    police_presence INTEGER NOT NULL DEFAULT 5 CHECK (police_presence >= 0 AND police_presence <= 10),
    wealth_level INTEGER NOT NULL DEFAULT 5 CHECK (wealth_level >= 1 AND wealth_level <= 10),

    -- Control
    controlling_crew_id UUID,
    control_strength INTEGER DEFAULT 0 CHECK (control_strength >= 0 AND control_strength <= 100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key after districts table exists
ALTER TABLE players
    ADD CONSTRAINT fk_players_district
    FOREIGN KEY (current_district_id)
    REFERENCES districts(id) ON DELETE SET NULL;

-- ============================================================================
-- CREWS TABLE
-- Player organizations/gangs
-- ============================================================================
CREATE TABLE crews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    tag TEXT UNIQUE, -- Short 3-4 letter tag
    description TEXT,

    -- Leadership
    leader_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

    -- Stats
    reputation INTEGER NOT NULL DEFAULT 0,
    bank_balance BIGINT NOT NULL DEFAULT 0,
    member_count INTEGER NOT NULL DEFAULT 1,
    max_members INTEGER NOT NULL DEFAULT 10,

    -- Territory
    territory_count INTEGER NOT NULL DEFAULT 0,

    -- Settings
    is_recruiting BOOLEAN NOT NULL DEFAULT true,
    min_reputation_to_join INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key for district control
ALTER TABLE districts
    ADD CONSTRAINT fk_districts_crew
    FOREIGN KEY (controlling_crew_id)
    REFERENCES crews(id) ON DELETE SET NULL;

-- ============================================================================
-- CREW MEMBERS TABLE
-- Crew membership with roles
-- ============================================================================
CREATE TABLE crew_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member', 'recruit')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Permissions
    can_invite BOOLEAN NOT NULL DEFAULT false,
    can_kick BOOLEAN NOT NULL DEFAULT false,
    can_manage_business BOOLEAN NOT NULL DEFAULT false,

    UNIQUE(crew_id, player_id)
);

-- ============================================================================
-- BUSINESSES TABLE
-- Legitimate and illegitimate businesses
-- ============================================================================
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    business_type TEXT NOT NULL,

    -- Ownership
    owner_id UUID REFERENCES players(id) ON DELETE SET NULL,
    crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,

    -- Location
    district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    position_x FLOAT NOT NULL,
    position_y FLOAT NOT NULL,

    -- Business Stats
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 10),
    income_per_tick BIGINT NOT NULL DEFAULT 0,
    operating_cost BIGINT NOT NULL DEFAULT 0,

    -- Status
    is_operational BOOLEAN NOT NULL DEFAULT true,
    health INTEGER NOT NULL DEFAULT 100 CHECK (health >= 0 AND health <= 100),
    last_collection_at TIMESTAMPTZ DEFAULT NOW(),

    -- For illegal businesses
    is_front BOOLEAN NOT NULL DEFAULT false, -- Legitimate front for illegal ops
    heat INTEGER NOT NULL DEFAULT 0, -- Police suspicion level

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- BUSINESS TYPES TABLE
-- Definition of available business types
-- ============================================================================
CREATE TABLE business_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('legitimate', 'illegal', 'front')),

    -- Costs
    purchase_price BIGINT NOT NULL,
    base_income BIGINT NOT NULL,
    base_operating_cost BIGINT NOT NULL,
    upgrade_cost_multiplier FLOAT NOT NULL DEFAULT 1.5,

    -- Requirements
    min_reputation INTEGER NOT NULL DEFAULT 0,
    min_level INTEGER NOT NULL DEFAULT 1,

    -- Risk (for illegal)
    base_heat_generation INTEGER NOT NULL DEFAULT 0,
    police_raid_chance FLOAT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INVENTORY TABLE
-- Player items and equipment
-- ============================================================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

    -- Equipment status
    is_equipped BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(player_id, item_id, is_equipped)
);

-- ============================================================================
-- ITEMS TABLE
-- Item definitions
-- ============================================================================
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('weapon', 'vehicle', 'tool', 'consumable', 'material', 'special')),

    -- Stats
    base_price BIGINT NOT NULL DEFAULT 0,

    -- For weapons
    damage INTEGER,
    accuracy INTEGER,

    -- For vehicles
    speed INTEGER,
    capacity INTEGER,

    -- For consumables
    effect_type TEXT,
    effect_value INTEGER,

    -- Requirements
    min_level INTEGER NOT NULL DEFAULT 1,

    -- Flags
    is_tradeable BOOLEAN NOT NULL DEFAULT true,
    is_legal BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MISSIONS TABLE
-- Available missions/jobs
-- ============================================================================
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Location
    district_id UUID REFERENCES districts(id) ON DELETE CASCADE,

    -- Requirements
    min_level INTEGER NOT NULL DEFAULT 1,
    min_reputation INTEGER NOT NULL DEFAULT 0,
    required_items JSONB DEFAULT '[]',
    required_crew_size INTEGER,

    -- Rewards
    cash_reward BIGINT NOT NULL DEFAULT 0,
    reputation_reward INTEGER NOT NULL DEFAULT 0,
    respect_reward INTEGER NOT NULL DEFAULT 0,
    item_rewards JSONB DEFAULT '[]',

    -- Costs
    energy_cost INTEGER NOT NULL DEFAULT 10,
    heat_gain INTEGER NOT NULL DEFAULT 0,

    -- Timing
    cooldown_minutes INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 0,

    -- Difficulty
    success_base_chance FLOAT NOT NULL DEFAULT 0.7,
    danger_level INTEGER NOT NULL DEFAULT 1,

    -- Availability
    is_repeatable BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PLAYER MISSIONS TABLE
-- Track player mission progress
-- ============================================================================
CREATE TABLE player_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned')),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- For cooldowns
    last_completed_at TIMESTAMPTZ
);

-- ============================================================================
-- TRANSACTIONS TABLE
-- Financial transaction history
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

    transaction_type TEXT NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,

    -- Reference
    reference_type TEXT, -- 'business', 'mission', 'trade', 'crew', etc.
    reference_id UUID,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CHAT MESSAGES TABLE
-- In-game chat (uses Supabase Realtime)
-- ============================================================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    channel_type TEXT NOT NULL CHECK (channel_type IN ('global', 'district', 'crew', 'private')),
    channel_id UUID, -- For crew/district/private channels

    sender_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    sender_username TEXT NOT NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- GAME EVENTS TABLE
-- Log of significant game events
-- ============================================================================
CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,

    -- Actors
    actor_id UUID REFERENCES players(id) ON DELETE SET NULL,
    target_id UUID REFERENCES players(id) ON DELETE SET NULL,

    -- Context
    district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
    crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,

    -- Event data
    data JSONB DEFAULT '{}',

    -- Visibility
    is_public BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Players
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_district ON players(current_district_id);
CREATE INDEX idx_players_online ON players(is_online) WHERE is_online = true;
CREATE INDEX idx_players_reputation ON players(reputation DESC);

-- Crews
CREATE INDEX idx_crews_leader ON crews(leader_id);
CREATE INDEX idx_crews_reputation ON crews(reputation DESC);

-- Crew Members
CREATE INDEX idx_crew_members_player ON crew_members(player_id);
CREATE INDEX idx_crew_members_crew ON crew_members(crew_id);

-- Businesses
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_crew ON businesses(crew_id);
CREATE INDEX idx_businesses_district ON businesses(district_id);
CREATE INDEX idx_businesses_type ON businesses(business_type);

-- Inventory
CREATE INDEX idx_inventory_player ON inventory(player_id);
CREATE INDEX idx_inventory_item ON inventory(item_id);

-- Missions
CREATE INDEX idx_player_missions_player ON player_missions(player_id);
CREATE INDEX idx_player_missions_status ON player_missions(status);

-- Transactions
CREATE INDEX idx_transactions_player ON transactions(player_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- Chat
CREATE INDEX idx_chat_channel ON chat_messages(channel_type, channel_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at DESC);

-- Events
CREATE INDEX idx_events_type ON game_events(event_type);
CREATE INDEX idx_events_actor ON game_events(actor_id);
CREATE INDEX idx_events_created ON game_events(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_districts_updated_at
    BEFORE UPDATE ON districts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_crews_updated_at
    BEFORE UPDATE ON crews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

-- Districts, missions, items, business_types are public read
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_types ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Districts are viewable by everyone" ON districts FOR SELECT USING (true);
CREATE POLICY "Missions are viewable by everyone" ON missions FOR SELECT USING (true);
CREATE POLICY "Items are viewable by everyone" ON items FOR SELECT USING (true);
CREATE POLICY "Business types are viewable by everyone" ON business_types FOR SELECT USING (true);

-- Players policies
CREATE POLICY "Players can view all players" ON players FOR SELECT USING (true);
CREATE POLICY "Players can update own record" ON players FOR UPDATE USING (auth.uid() = id);

-- Crews policies
CREATE POLICY "Crews are viewable by everyone" ON crews FOR SELECT USING (true);
CREATE POLICY "Crew leaders can update their crew" ON crews FOR UPDATE USING (auth.uid() = leader_id);

-- Crew members policies
CREATE POLICY "Crew members are viewable by everyone" ON crew_members FOR SELECT USING (true);
CREATE POLICY "Players can leave crews" ON crew_members FOR DELETE USING (auth.uid() = player_id);

-- Businesses policies
CREATE POLICY "Businesses are viewable by everyone" ON businesses FOR SELECT USING (true);
CREATE POLICY "Owners can update their businesses" ON businesses FOR UPDATE USING (auth.uid() = owner_id);

-- Inventory policies
CREATE POLICY "Players can view own inventory" ON inventory FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can manage own inventory" ON inventory FOR ALL USING (auth.uid() = player_id);

-- Player missions policies
CREATE POLICY "Players can view own missions" ON player_missions FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can manage own missions" ON player_missions FOR ALL USING (auth.uid() = player_id);

-- Transactions policies
CREATE POLICY "Players can view own transactions" ON transactions FOR SELECT USING (auth.uid() = player_id);

-- Chat policies
CREATE POLICY "Global chat is viewable by everyone" ON chat_messages FOR SELECT USING (channel_type = 'global');
CREATE POLICY "Players can send chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Game events policies
CREATE POLICY "Public events are viewable by everyone" ON game_events FOR SELECT USING (is_public = true);
CREATE POLICY "Players can view events they're involved in" ON game_events FOR SELECT USING (auth.uid() = actor_id OR auth.uid() = target_id);
