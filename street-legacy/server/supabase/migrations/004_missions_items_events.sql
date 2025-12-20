-- Street Legacy: Missions, Items & Events Migration
-- Migration: 004_missions_items_events
-- Description: Creates ENUMs and tables for missions, inventory system,
--              marketplace, game events, and analytics/logging

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Mission type categories
CREATE TYPE mission_type_enum AS ENUM (
  'onboarding',
  'story',
  'daily',
  'weekly',
  'crew',
  'event'
);

-- Mission objective categories
CREATE TYPE mission_category_enum AS ENUM (
  'crime',
  'business',
  'social',
  'property',
  'general'
);

-- Player mission progress status
CREATE TYPE mission_status_enum AS ENUM (
  'available',
  'active',
  'completed',
  'claimed',
  'failed',
  'expired'
);

-- Item categories
CREATE TYPE item_category_enum AS ENUM (
  'weapon',
  'tool',
  'vehicle',
  'cosmetic',
  'consumable',
  'material'
);

-- Item rarity tiers
CREATE TYPE item_rarity_enum AS ENUM (
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary'
);

-- How item was acquired
CREATE TYPE acquired_via_enum AS ENUM (
  'purchase',
  'loot',
  'craft',
  'trade',
  'reward',
  'admin'
);

-- Marketplace listing types
CREATE TYPE listing_type_enum AS ENUM (
  'property',
  'item'
);

-- Marketplace listing status
CREATE TYPE listing_status_enum AS ENUM (
  'active',
  'sold',
  'cancelled',
  'expired'
);

-- Game event types
CREATE TYPE event_type_enum AS ENUM (
  'district_buff',
  'global_buff',
  'competition',
  'raid_wave',
  'tax_holiday',
  'double_xp'
);

-- =============================================================================
-- MISSIONS TABLE (reference table)
-- =============================================================================

CREATE TABLE missions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  mission_type mission_type_enum NOT NULL,
  category mission_category_enum NOT NULL,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewards JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_level INT DEFAULT 1,
  required_missions TEXT[] DEFAULT '{}',
  is_repeatable BOOLEAN DEFAULT FALSE,
  repeat_cooldown_hours INT,
  time_limit_minutes INT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE missions IS 'Mission/quest definitions';
COMMENT ON COLUMN missions.requirements IS 'JSON array of requirement objects';
COMMENT ON COLUMN missions.rewards IS 'JSON object defining rewards';
COMMENT ON COLUMN missions.required_missions IS 'Array of mission IDs that must be completed first';

-- =============================================================================
-- PLAYER MISSIONS TABLE
-- =============================================================================

CREATE TABLE player_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mission_id VARCHAR(50) NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status mission_status_enum DEFAULT 'available',
  progress JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE player_missions IS 'Player mission progress and status';
COMMENT ON COLUMN player_missions.progress IS 'JSON tracking progress towards objectives';

-- =============================================================================
-- ITEMS TABLE (reference table)
-- =============================================================================

CREATE TABLE items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category item_category_enum NOT NULL,
  rarity item_rarity_enum DEFAULT 'common',
  base_value BIGINT NOT NULL CHECK (base_value > 0),
  max_stack INT DEFAULT 1 CHECK (max_stack >= 1),
  is_tradeable BOOLEAN DEFAULT TRUE,
  is_equippable BOOLEAN DEFAULT FALSE,
  equip_slot VARCHAR(30),
  effects JSONB DEFAULT '{}'::jsonb,
  requirements JSONB DEFAULT '{}'::jsonb,
  durability_max INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE items IS 'Item definitions';
COMMENT ON COLUMN items.effects IS 'JSON object defining item effects when used/equipped';
COMMENT ON COLUMN items.requirements IS 'JSON object defining requirements to use item';

-- =============================================================================
-- PLAYER INVENTORY TABLE
-- =============================================================================

CREATE TABLE player_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1 CHECK (quantity >= 0),
  durability INT,
  is_equipped BOOLEAN DEFAULT FALSE,
  acquired_via acquired_via_enum NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  UNIQUE(player_id, item_id)
);

COMMENT ON TABLE player_inventory IS 'Player owned items';
COMMENT ON COLUMN player_inventory.durability IS 'Current durability (NULL if item has no durability)';

-- =============================================================================
-- MARKETPLACE LISTINGS TABLE
-- =============================================================================

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  listing_type listing_type_enum NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  item_id VARCHAR(50) REFERENCES items(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1 CHECK (quantity >= 1),
  asking_price BIGINT NOT NULL CHECK (asking_price > 0),
  minimum_offer BIGINT,
  currency currency_enum DEFAULT 'cash',
  status listing_status_enum DEFAULT 'active',
  buyer_id UUID REFERENCES players(id) ON DELETE SET NULL,
  final_price BIGINT,
  views INT DEFAULT 0,
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  sold_at TIMESTAMPTZ,

  -- Ensure correct type references
  CHECK (
    (listing_type = 'property' AND property_id IS NOT NULL AND item_id IS NULL) OR
    (listing_type = 'item' AND item_id IS NOT NULL AND property_id IS NULL)
  )
);

COMMENT ON TABLE marketplace_listings IS 'Player-to-player marketplace';
COMMENT ON COLUMN marketplace_listings.minimum_offer IS 'Minimum acceptable offer (NULL = no offers accepted)';
COMMENT ON COLUMN marketplace_listings.final_price IS 'Actual sale price (may differ from asking if offer accepted)';

-- =============================================================================
-- GAME EVENTS TABLE (analytics - append-only log)
-- =============================================================================

CREATE TABLE game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_subtype VARCHAR(50),
  district_id VARCHAR(50) REFERENCES districts(id) ON DELETE SET NULL,
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  target_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  value_numeric NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE game_events IS 'Analytics event log - append only';
COMMENT ON COLUMN game_events.event_type IS 'High-level event type (crime, business, trade, etc.)';
COMMENT ON COLUMN game_events.event_subtype IS 'Specific event (pickpocket_success, business_opened, etc.)';
COMMENT ON COLUMN game_events.value_numeric IS 'Numeric value associated with event (cash amount, XP, etc.)';

-- =============================================================================
-- ADMIN ACTIONS TABLE (audit log)
-- =============================================================================

CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  target_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  target_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  target_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  target_district_id VARCHAR(50) REFERENCES districts(id) ON DELETE SET NULL,
  payload_before JSONB,
  payload_after JSONB,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE admin_actions IS 'Admin action audit log';
COMMENT ON COLUMN admin_actions.payload_before IS 'State before admin action';
COMMENT ON COLUMN admin_actions.payload_after IS 'State after admin action';
COMMENT ON COLUMN admin_actions.reason IS 'Admin-provided reason for action';

-- =============================================================================
-- SCHEDULED EVENTS TABLE (game events/seasons)
-- =============================================================================

CREATE TABLE scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(100) NOT NULL,
  event_type event_type_enum NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  affected_districts TEXT[],
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (ends_at > starts_at)
);

COMMENT ON TABLE scheduled_events IS 'Time-limited game events and seasons';
COMMENT ON COLUMN scheduled_events.config IS 'JSON configuration for event effects';
COMMENT ON COLUMN scheduled_events.affected_districts IS 'Array of district IDs (NULL = global)';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Missions indexes
CREATE INDEX idx_missions_type ON missions(mission_type);
CREATE INDEX idx_missions_category ON missions(category);
CREATE INDEX idx_missions_active ON missions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_missions_sort ON missions(mission_type, sort_order);

-- Player missions indexes
CREATE INDEX idx_player_missions_player ON player_missions(player_id);
CREATE INDEX idx_player_missions_status ON player_missions(player_id, status);
CREATE INDEX idx_player_missions_active ON player_missions(player_id) WHERE status IN ('available', 'active');

-- Items indexes
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_rarity ON items(rarity);
CREATE INDEX idx_items_equippable ON items(is_equippable) WHERE is_equippable = TRUE;

-- Player inventory indexes
CREATE INDEX idx_inventory_player ON player_inventory(player_id);
CREATE INDEX idx_inventory_equipped ON player_inventory(player_id, is_equipped) WHERE is_equipped = TRUE;
CREATE INDEX idx_inventory_item ON player_inventory(item_id);

-- Marketplace indexes
CREATE INDEX idx_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX idx_listings_type ON marketplace_listings(listing_type);
CREATE INDEX idx_listings_active ON marketplace_listings(status, listing_type) WHERE status = 'active';
CREATE INDEX idx_listings_property ON marketplace_listings(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_listings_item ON marketplace_listings(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_listings_price ON marketplace_listings(asking_price) WHERE status = 'active';

-- Game events indexes (critical for analytics)
CREATE INDEX idx_game_events_player ON game_events(player_id);
CREATE INDEX idx_game_events_type ON game_events(event_type);
CREATE INDEX idx_game_events_date ON game_events(created_at);
CREATE INDEX idx_game_events_player_date ON game_events(player_id, created_at DESC);
CREATE INDEX idx_game_events_type_date ON game_events(event_type, created_at DESC);
CREATE INDEX idx_game_events_district ON game_events(district_id) WHERE district_id IS NOT NULL;

-- Admin actions indexes
CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_target_player ON admin_actions(target_player_id);
CREATE INDEX idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_date ON admin_actions(created_at DESC);

-- Scheduled events indexes
CREATE INDEX idx_scheduled_events_active ON scheduled_events(is_active, starts_at, ends_at);
CREATE INDEX idx_scheduled_events_current ON scheduled_events(starts_at, ends_at) WHERE is_active = TRUE;

