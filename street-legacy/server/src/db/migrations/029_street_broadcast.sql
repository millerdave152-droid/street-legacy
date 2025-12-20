-- ============================================================================
-- Migration 029: Street Broadcast System
-- Dynamic news generation about player events
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- News type enum
DO $$ BEGIN
  CREATE TYPE news_type_enum AS ENUM (
    'breaking',        -- Immediate high-impact news
    'rumor',           -- Unverified player gossip
    'weekly_recap',    -- District weekly summary
    'district_update', -- District-specific news
    'player_spotlight' -- Featured player story
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- News category enum
DO $$ BEGIN
  CREATE TYPE news_category_enum AS ENUM (
    'crime',     -- Criminal activity
    'business',  -- Business/economy news
    'territory', -- Territory changes
    'crew',      -- Crew activity
    'politics',  -- Faction/political news
    'general'    -- General news
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Street News - main news articles
CREATE TABLE IF NOT EXISTS street_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  news_type news_type_enum NOT NULL,
  category news_category_enum NOT NULL,
  significance INTEGER NOT NULL DEFAULT 5 CHECK (significance >= 1 AND significance <= 10),
  district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
  related_player_ids INTEGER[] DEFAULT '{}',
  related_crew_ids INTEGER[] DEFAULT '{}',
  source_event_id UUID,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to street_news if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'news_type') THEN
    ALTER TABLE street_news ADD COLUMN news_type TEXT NOT NULL DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'category') THEN
    ALTER TABLE street_news ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'is_anonymous') THEN
    ALTER TABLE street_news ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'view_count') THEN
    ALTER TABLE street_news ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'expires_at') THEN
    ALTER TABLE street_news ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'published_at') THEN
    ALTER TABLE street_news ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'source_event_id') THEN
    ALTER TABLE street_news ADD COLUMN source_event_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'related_player_ids') THEN
    ALTER TABLE street_news ADD COLUMN related_player_ids INTEGER[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'related_crew_ids') THEN
    ALTER TABLE street_news ADD COLUMN related_crew_ids INTEGER[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'significance') THEN
    ALTER TABLE street_news ADD COLUMN significance INTEGER NOT NULL DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'headline') THEN
    ALTER TABLE street_news ADD COLUMN headline VARCHAR(200) NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'body') THEN
    ALTER TABLE street_news ADD COLUMN body TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'street_news' AND column_name = 'district_id') THEN
    ALTER TABLE street_news ADD COLUMN district_id INTEGER;
  END IF;
END $$;

COMMENT ON TABLE street_news IS 'Dynamic news articles generated from player events';
COMMENT ON COLUMN street_news.significance IS 'Impact level 1-10, affects visibility and sorting';
COMMENT ON COLUMN street_news.is_anonymous IS 'Hide player names in public feed';
COMMENT ON COLUMN street_news.expires_at IS 'NULL means never expires';

-- Player News Reads - track what players have read
CREATE TABLE IF NOT EXISTS player_news_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES street_news(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, news_id)
);

COMMENT ON TABLE player_news_reads IS 'Tracks which news articles each player has read';

-- Player News Subscriptions - custom feed preferences
CREATE TABLE IF NOT EXISTS player_news_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subscription_type VARCHAR(30) NOT NULL CHECK (subscription_type IN ('district', 'crew', 'player', 'category')),
  target_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, subscription_type, target_id)
);

COMMENT ON TABLE player_news_subscriptions IS 'Player subscriptions to specific news sources';
COMMENT ON COLUMN player_news_subscriptions.subscription_type IS 'Type: district, crew, player, or category';
COMMENT ON COLUMN player_news_subscriptions.target_id IS 'ID of subscribed entity or category name';

-- News Templates - for generating news from events
CREATE TABLE IF NOT EXISTS news_templates (
  id VARCHAR(50) PRIMARY KEY,
  news_type news_type_enum NOT NULL,
  category news_category_enum NOT NULL,
  headline_template VARCHAR(200) NOT NULL,
  body_template TEXT NOT NULL,
  min_significance INTEGER NOT NULL DEFAULT 1 CHECK (min_significance >= 1 AND min_significance <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE news_templates IS 'Templates for generating news articles';
COMMENT ON COLUMN news_templates.headline_template IS 'Template with placeholders: {player}, {district}, {crew}, {amount}, etc';
COMMENT ON COLUMN news_templates.min_significance IS 'Minimum event significance to use this template';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Street news indexes
CREATE INDEX IF NOT EXISTS idx_street_news_published_at
  ON street_news(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_street_news_district_published
  ON street_news(district_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_street_news_type
  ON street_news(news_type);

CREATE INDEX IF NOT EXISTS idx_street_news_category
  ON street_news(category);

CREATE INDEX IF NOT EXISTS idx_street_news_significance
  ON street_news(significance DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_street_news_expires
  ON street_news(expires_at)
  WHERE expires_at IS NOT NULL;

-- GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_street_news_related_players
  ON street_news USING GIN(related_player_ids);

CREATE INDEX IF NOT EXISTS idx_street_news_related_crews
  ON street_news USING GIN(related_crew_ids);

-- Player news reads indexes
CREATE INDEX IF NOT EXISTS idx_player_news_reads_player
  ON player_news_reads(player_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_news_reads_news
  ON player_news_reads(news_id);

-- Player news subscriptions index
CREATE INDEX IF NOT EXISTS idx_player_news_subscriptions_player
  ON player_news_subscriptions(player_id);

CREATE INDEX IF NOT EXISTS idx_player_news_subscriptions_target
  ON player_news_subscriptions(subscription_type, target_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Create news article
CREATE OR REPLACE FUNCTION create_news(
  p_news_type news_type_enum,
  p_category news_category_enum,
  p_headline VARCHAR(200),
  p_body TEXT,
  p_district_id INTEGER DEFAULT NULL,
  p_player_ids INTEGER[] DEFAULT '{}',
  p_crew_ids INTEGER[] DEFAULT '{}',
  p_significance INTEGER DEFAULT 5,
  p_expires_hours INTEGER DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT FALSE,
  p_source_event_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_news_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration if provided
  IF p_expires_hours IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_hours || ' hours')::INTERVAL;
  END IF;

  -- Insert news article
  INSERT INTO street_news (
    headline,
    body,
    news_type,
    category,
    significance,
    district_id,
    related_player_ids,
    related_crew_ids,
    source_event_id,
    is_anonymous,
    expires_at
  ) VALUES (
    p_headline,
    p_body,
    p_news_type,
    p_category,
    LEAST(10, GREATEST(1, p_significance)),
    p_district_id,
    COALESCE(p_player_ids, '{}'),
    COALESCE(p_crew_ids, '{}'),
    p_source_event_id,
    p_is_anonymous,
    v_expires_at
  )
  RETURNING id INTO v_news_id;

  RETURN v_news_id;
END;
$$;

COMMENT ON FUNCTION create_news IS 'Create a news article with optional expiration';

-- Function: Get personalized news feed for a player
CREATE OR REPLACE FUNCTION get_player_feed(
  p_player_id INTEGER,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_include_read BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  headline VARCHAR(200),
  body TEXT,
  news_type news_type_enum,
  category news_category_enum,
  significance INTEGER,
  district_id INTEGER,
  district_name VARCHAR(100),
  related_player_ids INTEGER[],
  related_crew_ids INTEGER[],
  is_anonymous BOOLEAN,
  view_count INTEGER,
  published_at TIMESTAMPTZ,
  is_read BOOLEAN,
  relevance_score INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_district INTEGER;
BEGIN
  -- Get player's current district
  SELECT current_district_id INTO v_current_district
  FROM players
  WHERE players.id = p_player_id;

  RETURN QUERY
  WITH player_subscriptions AS (
    SELECT subscription_type, target_id
    FROM player_news_subscriptions
    WHERE player_id = p_player_id
  ),
  read_news AS (
    SELECT news_id
    FROM player_news_reads
    WHERE player_id = p_player_id
  ),
  scored_news AS (
    SELECT
      sn.*,
      d.name as district_name,
      EXISTS(SELECT 1 FROM read_news WHERE news_id = sn.id) as is_read,
      -- Calculate relevance score
      (
        -- Base significance
        sn.significance +
        -- Bonus for player's current district
        CASE WHEN sn.district_id = v_current_district THEN 3 ELSE 0 END +
        -- Bonus for news mentioning this player
        CASE WHEN p_player_id = ANY(sn.related_player_ids) THEN 5 ELSE 0 END +
        -- Bonus for subscribed districts
        CASE WHEN EXISTS(
          SELECT 1 FROM player_subscriptions
          WHERE subscription_type = 'district' AND target_id = sn.district_id::TEXT
        ) THEN 2 ELSE 0 END +
        -- Bonus for subscribed crews
        CASE WHEN EXISTS(
          SELECT 1 FROM player_subscriptions ps
          WHERE ps.subscription_type = 'crew'
            AND ps.target_id::INTEGER = ANY(sn.related_crew_ids)
        ) THEN 2 ELSE 0 END +
        -- Bonus for subscribed categories
        CASE WHEN EXISTS(
          SELECT 1 FROM player_subscriptions
          WHERE subscription_type = 'category' AND target_id = sn.category::TEXT
        ) THEN 2 ELSE 0 END +
        -- Breaking news always relevant
        CASE WHEN sn.news_type = 'breaking' AND sn.significance >= 8 THEN 5 ELSE 0 END
      ) as relevance_score
    FROM street_news sn
    LEFT JOIN districts d ON d.id = sn.district_id
    WHERE
      -- Not expired
      (sn.expires_at IS NULL OR sn.expires_at > NOW())
      -- Optionally exclude read
      AND (p_include_read OR NOT EXISTS(SELECT 1 FROM read_news WHERE news_id = sn.id))
      -- Must have some relevance (in district, subscribed, mentioned, or breaking)
      AND (
        sn.district_id = v_current_district
        OR p_player_id = ANY(sn.related_player_ids)
        OR sn.significance >= 8
        OR EXISTS(
          SELECT 1 FROM player_subscriptions ps
          WHERE
            (ps.subscription_type = 'district' AND ps.target_id = sn.district_id::TEXT)
            OR (ps.subscription_type = 'crew' AND ps.target_id::INTEGER = ANY(sn.related_crew_ids))
            OR (ps.subscription_type = 'category' AND ps.target_id = sn.category::TEXT)
            OR (ps.subscription_type = 'player' AND ps.target_id::INTEGER = ANY(sn.related_player_ids))
        )
      )
  )
  SELECT
    sn.id,
    sn.headline,
    sn.body,
    sn.news_type,
    sn.category,
    sn.significance,
    sn.district_id,
    sn.district_name,
    sn.related_player_ids,
    sn.related_crew_ids,
    sn.is_anonymous,
    sn.view_count,
    sn.published_at,
    sn.is_read,
    sn.relevance_score
  FROM scored_news sn
  ORDER BY sn.relevance_score DESC, sn.published_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_player_feed IS 'Get personalized news feed based on location, subscriptions, and mentions';

-- Function: Mark news as read and increment view count
CREATE OR REPLACE FUNCTION mark_news_read(
  p_player_id INTEGER,
  p_news_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert read record (ignore if already exists)
  INSERT INTO player_news_reads (player_id, news_id)
  VALUES (p_player_id, p_news_id)
  ON CONFLICT (player_id, news_id) DO NOTHING;

  -- Increment view count
  UPDATE street_news
  SET view_count = view_count + 1
  WHERE id = p_news_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION mark_news_read IS 'Mark a news article as read and increment view count';

-- Function: Generate district weekly recap
CREATE OR REPLACE FUNCTION generate_district_recap(
  p_district_id INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_district_name VARCHAR(100);
  v_crime_count INTEGER;
  v_business_count INTEGER;
  v_territory_count INTEGER;
  v_top_players INTEGER[];
  v_headline VARCHAR(200);
  v_body TEXT;
  v_news_id UUID;
BEGIN
  -- Get district name
  SELECT name INTO v_district_name
  FROM districts
  WHERE id = p_district_id;

  IF v_district_name IS NULL THEN
    RAISE EXCEPTION 'District not found: %', p_district_id;
  END IF;

  -- Count events from past week by category
  SELECT
    COUNT(*) FILTER (WHERE category = 'crime'),
    COUNT(*) FILTER (WHERE category = 'business'),
    COUNT(*) FILTER (WHERE category = 'territory')
  INTO v_crime_count, v_business_count, v_territory_count
  FROM street_news
  WHERE district_id = p_district_id
    AND published_at > NOW() - INTERVAL '7 days'
    AND news_type != 'weekly_recap';

  -- Get most mentioned players this week
  SELECT ARRAY_AGG(DISTINCT player_id) INTO v_top_players
  FROM (
    SELECT UNNEST(related_player_ids) as player_id
    FROM street_news
    WHERE district_id = p_district_id
      AND published_at > NOW() - INTERVAL '7 days'
    LIMIT 5
  ) sub;

  -- Generate headline
  v_headline := 'Weekly Recap: ' || v_district_name;

  -- Generate body
  v_body := 'This week in ' || v_district_name || E':\n\n';

  IF v_crime_count > 0 THEN
    v_body := v_body || '- ' || v_crime_count || ' crime-related incidents reported' || E'\n';
  END IF;

  IF v_business_count > 0 THEN
    v_body := v_body || '- ' || v_business_count || ' business activities noted' || E'\n';
  END IF;

  IF v_territory_count > 0 THEN
    v_body := v_body || '- ' || v_territory_count || ' territory changes observed' || E'\n';
  END IF;

  IF v_crime_count = 0 AND v_business_count = 0 AND v_territory_count = 0 THEN
    v_body := v_body || 'A quiet week on the streets. Stay vigilant.';
  ELSE
    v_body := v_body || E'\nThe streets are always watching.';
  END IF;

  -- Create the recap news article
  v_news_id := create_news(
    'weekly_recap'::news_type_enum,
    'general'::news_category_enum,
    v_headline,
    v_body,
    p_district_id,
    COALESCE(v_top_players, '{}'),
    '{}',
    6,  -- Medium-high significance
    168 -- Expires in 1 week (168 hours)
  );

  RETURN v_news_id;
END;
$$;

COMMENT ON FUNCTION generate_district_recap IS 'Generate weekly recap news for a district';

-- Function: Clean up expired news
CREATE OR REPLACE FUNCTION cleanup_expired_news()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired news older than 30 days (keep recent for history)
  DELETE FROM street_news
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_news IS 'Remove expired news articles older than 30 days';

-- Function: Get unread count for a player
CREATE OR REPLACE FUNCTION get_unread_news_count(
  p_player_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_district INTEGER;
  v_count INTEGER;
BEGIN
  -- Get player's current district
  SELECT current_district_id INTO v_current_district
  FROM players
  WHERE id = p_player_id;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM street_news sn
  WHERE
    (sn.expires_at IS NULL OR sn.expires_at > NOW())
    AND NOT EXISTS(
      SELECT 1 FROM player_news_reads
      WHERE player_id = p_player_id AND news_id = sn.id
    )
    AND (
      sn.district_id = v_current_district
      OR p_player_id = ANY(sn.related_player_ids)
      OR sn.significance >= 8
      OR EXISTS(
        SELECT 1 FROM player_news_subscriptions ps
        WHERE ps.player_id = p_player_id
          AND (
            (ps.subscription_type = 'district' AND ps.target_id = sn.district_id::TEXT)
            OR (ps.subscription_type = 'category' AND ps.target_id = sn.category::TEXT)
          )
      )
    );

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_unread_news_count IS 'Get count of unread relevant news for a player';

-- ============================================================================
-- SEED NEWS TEMPLATES
-- ============================================================================

INSERT INTO news_templates (id, news_type, category, headline_template, body_template, min_significance) VALUES
  -- Crime templates
  ('crime_heist_success', 'breaking', 'crime',
   'Major Heist Rocks {district}',
   'A daring heist was pulled off in {district} today. {player} and their crew made off with substantial gains. Local authorities are baffled.',
   7),
  ('crime_pvp_victory', 'rumor', 'crime',
   'Street Fight Ends Badly in {district}',
   'Word on the street is that {player} laid someone out cold in {district}. Witnesses say it was brutal.',
   5),
  ('crime_general', 'district_update', 'crime',
   'Criminal Activity Reported in {district}',
   'Reports of criminal activity are coming in from {district}. {player} may be involved, according to sources.',
   3),

  -- Business templates
  ('business_property_purchase', 'district_update', 'business',
   'New Owner Takes Over in {district}',
   '{player} has acquired property in {district}. The business landscape is shifting.',
   4),
  ('business_major_deal', 'breaking', 'business',
   'Major Deal Closes in {district}',
   'A significant transaction went down in {district}. {player} was seen at the center of it all. The amount? Rumored to be substantial.',
   6),
  ('business_opened', 'district_update', 'business',
   'New Business Opens in {district}',
   'A new establishment has opened its doors in {district}. {player} is reportedly behind the venture.',
   4),

  -- Territory templates
  ('territory_capture', 'breaking', 'territory',
   'Territory Changes Hands in {district}',
   'Control of key territory in {district} has shifted. {player} now holds the block. Previous owners are not happy.',
   6),
  ('territory_crew_battle', 'breaking', 'territory',
   'Crew War Erupts in {district}',
   'Violence broke out between crews in {district}. {player} was in the thick of it. Casualties reported.',
   8),

  -- Crew templates
  ('crew_formed', 'rumor', 'crew',
   'New Crew Emerges in {district}',
   'A new crew has been spotted operating in {district}. {player} is said to be calling the shots.',
   5),
  ('crew_alliance', 'district_update', 'crew',
   'Alliance Formed in the Underground',
   'Word is that crews are joining forces. {player} brokered the deal. The balance of power may be shifting.',
   6),

  -- Politics/Faction templates
  ('faction_mission_complete', 'district_update', 'politics',
   '{player} Gains Favor with Local Powers',
   'Completing a mission for local factions, {player} has increased their standing in {district}. Doors are opening.',
   5),
  ('faction_standing_change', 'rumor', 'politics',
   'Shifting Loyalties in {district}',
   'Rumors swirl about {player}''s changing allegiances. Some factions are pleased. Others, not so much.',
   4),

  -- General/Spotlight templates
  ('player_spotlight_rising', 'player_spotlight', 'general',
   'Rising Star: {player}',
   'All eyes are on {player} lately. Their reputation in {district} is growing. Some say they''re destined for greatness.',
   7),
  ('landmark_event', 'breaking', 'general',
   'Historic Moment in {district}',
   'Something significant happened in {district} today. {player} was at the center of it. This one will be remembered.',
   9)
ON CONFLICT (id) DO UPDATE SET
  headline_template = EXCLUDED.headline_template,
  body_template = EXCLUDED.body_template,
  min_significance = EXCLUDED.min_significance;

-- ============================================================================
-- RLS POLICIES (Optional - enable if using Supabase auth)
-- ============================================================================

-- Note: These policies assume the application handles authorization
-- If using Supabase auth with UUID-based auth.uid(), adjust accordingly

-- ALTER TABLE street_news ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_news_reads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_news_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE news_templates ENABLE ROW LEVEL SECURITY;

-- Street news is readable by all authenticated users
-- CREATE POLICY "street_news_select" ON street_news
--   FOR SELECT TO authenticated
--   USING (expires_at IS NULL OR expires_at > NOW());

-- News reads - handled by application layer authorization
-- CREATE POLICY "player_news_reads_all" ON player_news_reads
--   FOR ALL TO authenticated
--   USING (true);

-- Subscriptions - handled by application layer authorization
-- CREATE POLICY "player_news_subscriptions_all" ON player_news_subscriptions
--   FOR ALL TO authenticated
--   USING (true);

-- News templates are readable by all
-- CREATE POLICY "news_templates_select" ON news_templates
--   FOR SELECT TO authenticated
--   USING (true);

-- ============================================================================
-- GRANTS (uncomment if using role-based access)
-- ============================================================================

-- GRANT SELECT ON street_news TO authenticated;
-- GRANT SELECT, INSERT ON player_news_reads TO authenticated;
-- GRANT SELECT, INSERT, DELETE ON player_news_subscriptions TO authenticated;
-- GRANT SELECT ON news_templates TO authenticated;

-- GRANT EXECUTE ON FUNCTION create_news TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_player_feed TO authenticated;
-- GRANT EXECUTE ON FUNCTION mark_news_read TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_district_recap TO authenticated;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_news TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_unread_news_count TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- - Created news_type_enum and news_category_enum
-- - Created street_news table for dynamic news articles
-- - Created player_news_reads for tracking read status
-- - Created player_news_subscriptions for custom feeds
-- - Created news_templates for generating news from events
-- - Added indexes for efficient queries
-- - Created functions: create_news, get_player_feed, mark_news_read,
--   generate_district_recap, cleanup_expired_news, get_unread_news_count
-- - Seeded 15 news templates for various event types
