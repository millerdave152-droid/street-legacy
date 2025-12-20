-- Street Legacy: Database Functions
-- Helper functions for game operations

-- ============================================================================
-- Add Player Cash (with transaction logging)
-- ============================================================================
CREATE OR REPLACE FUNCTION add_player_cash(p_player_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    UPDATE players
    SET cash = cash + p_amount
    WHERE id = p_player_id
    RETURNING cash INTO v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Add Player Heat
-- ============================================================================
CREATE OR REPLACE FUNCTION add_player_heat(p_player_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET heat = LEAST(100, heat + p_amount)
    WHERE id = p_player_id;

    -- Check for arrest if heat is maxed
    IF (SELECT heat FROM players WHERE id = p_player_id) >= 100 THEN
        PERFORM arrest_player(p_player_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Arrest Player
-- ============================================================================
CREATE OR REPLACE FUNCTION arrest_player(p_player_id UUID)
RETURNS VOID AS $$
DECLARE
    v_jail_time INTERVAL;
    v_release_at TIMESTAMPTZ;
BEGIN
    -- Calculate jail time based on reputation (more notorious = longer sentence)
    v_jail_time := INTERVAL '30 minutes' +
        (SELECT (reputation / 100) * INTERVAL '1 minute' FROM players WHERE id = p_player_id);

    v_release_at := NOW() + v_jail_time;

    UPDATE players
    SET
        is_in_jail = TRUE,
        jail_release_at = v_release_at,
        heat = 0,
        -- Lose some cash (bail/bribes)
        cash = GREATEST(0, cash - (cash * 0.1)::BIGINT)
    WHERE id = p_player_id;

    -- Log arrest event
    INSERT INTO game_events (event_type, actor_id, data, is_public)
    VALUES (
        'player_arrested',
        p_player_id,
        jsonb_build_object('jail_until', v_release_at),
        TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Create Player Profile (called on signup)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_player_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
    v_starting_district UUID;
BEGIN
    -- Generate username from email or random
    v_username := COALESCE(
        SPLIT_PART(NEW.email, '@', 1),
        'Player_' || SUBSTRING(NEW.id::TEXT, 1, 8)
    );

    -- Make username unique if needed
    WHILE EXISTS (SELECT 1 FROM players WHERE username = v_username) LOOP
        v_username := v_username || '_' || FLOOR(RANDOM() * 1000)::TEXT;
    END LOOP;

    -- Get a random starting district (prefer lower danger areas)
    SELECT id INTO v_starting_district
    FROM districts
    WHERE danger_level <= 4
    ORDER BY RANDOM()
    LIMIT 1;

    INSERT INTO players (
        id,
        username,
        display_name,
        current_district_id,
        position_x,
        position_y
    )
    VALUES (
        NEW.id,
        v_username,
        v_username,
        v_starting_district,
        0,
        0
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto player creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_player_profile();

-- ============================================================================
-- Get Nearby Players
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nearby_players(
    p_player_id UUID,
    p_radius FLOAT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    reputation INTEGER,
    crew_tag TEXT,
    distance FLOAT
) AS $$
DECLARE
    v_player_x FLOAT;
    v_player_y FLOAT;
    v_district_id UUID;
BEGIN
    SELECT position_x, position_y, current_district_id
    INTO v_player_x, v_player_y, v_district_id
    FROM players
    WHERE players.id = p_player_id;

    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.reputation,
        c.tag AS crew_tag,
        SQRT(POWER(p.position_x - v_player_x, 2) + POWER(p.position_y - v_player_y, 2)) AS distance
    FROM players p
    LEFT JOIN crew_members cm ON p.id = cm.player_id
    LEFT JOIN crews c ON cm.crew_id = c.id
    WHERE p.id != p_player_id
        AND p.current_district_id = v_district_id
        AND p.is_online = TRUE
        AND p.is_in_jail = FALSE
        AND p.is_in_hospital = FALSE
        AND SQRT(POWER(p.position_x - v_player_x, 2) + POWER(p.position_y - v_player_y, 2)) <= p_radius
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get District Leaderboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_district_leaderboard(p_district_id UUID)
RETURNS TABLE (
    player_id UUID,
    username TEXT,
    reputation INTEGER,
    crew_name TEXT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS player_id,
        p.username,
        p.reputation,
        c.name AS crew_name,
        ROW_NUMBER() OVER (ORDER BY p.reputation DESC) AS rank
    FROM players p
    LEFT JOIN crew_members cm ON p.id = cm.player_id
    LEFT JOIN crews c ON cm.crew_id = c.id
    WHERE p.current_district_id = p_district_id
    ORDER BY p.reputation DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get Global Leaderboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_global_leaderboard(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    player_id UUID,
    username TEXT,
    reputation INTEGER,
    respect INTEGER,
    crew_name TEXT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS player_id,
        p.username,
        p.reputation,
        p.respect,
        c.name AS crew_name,
        ROW_NUMBER() OVER (ORDER BY p.reputation DESC) AS rank
    FROM players p
    LEFT JOIN crew_members cm ON p.id = cm.player_id
    LEFT JOIN crews c ON cm.crew_id = c.id
    ORDER BY p.reputation DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get Crew Leaderboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_crew_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    crew_id UUID,
    name TEXT,
    tag TEXT,
    reputation INTEGER,
    member_count INTEGER,
    territory_count INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS crew_id,
        c.name,
        c.tag,
        c.reputation,
        c.member_count,
        c.territory_count,
        ROW_NUMBER() OVER (ORDER BY c.reputation DESC) AS rank
    FROM crews c
    ORDER BY c.reputation DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Calculate Business Income
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_business_income(p_business_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_income BIGINT;
    v_level INTEGER;
    v_base_income BIGINT;
    v_district_wealth INTEGER;
BEGIN
    SELECT
        b.level,
        bt.base_income,
        d.wealth_level
    INTO v_level, v_base_income, v_district_wealth
    FROM businesses b
    JOIN business_types bt ON b.business_type = bt.id
    JOIN districts d ON b.district_id = d.id
    WHERE b.id = p_business_id;

    -- Income = base * level bonus * district wealth modifier
    v_income := v_base_income * (1 + (v_level - 1) * 0.25) * (0.5 + v_district_wealth * 0.1);

    RETURN v_income::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update Player Online Status
-- ============================================================================
CREATE OR REPLACE FUNCTION update_player_online_status(p_player_id UUID, p_is_online BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE players
    SET
        is_online = p_is_online,
        last_login_at = CASE WHEN p_is_online THEN NOW() ELSE last_login_at END
    WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant function execution to authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_nearby_players TO authenticated;
GRANT EXECUTE ON FUNCTION get_district_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_crew_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_online_status TO authenticated;
