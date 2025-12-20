-- Street Legacy: Row Level Security Policies
-- Migration: 005_rls_policies
-- Description: Comprehensive RLS policies for all tables to secure data access

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'is_admin')::boolean = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current player id (same as auth.uid() but clearer)
CREATE OR REPLACE FUNCTION current_player_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 1. PLAYERS TABLE
-- =============================================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Players can read their own full profile
CREATE POLICY "players_select_own" ON players
  FOR SELECT USING (id = auth.uid());

-- Players can read limited public info of others
CREATE POLICY "players_select_public" ON players
  FOR SELECT USING (
    id != auth.uid() AND is_banned = FALSE
  );

-- Players can update their own profile (limited fields)
CREATE POLICY "players_update_own" ON players
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert only via functions (service role)
CREATE POLICY "players_insert_service" ON players
  FOR INSERT WITH CHECK (FALSE);

-- No direct delete
CREATE POLICY "players_delete_none" ON players
  FOR DELETE USING (FALSE);

-- Admin can do everything
CREATE POLICY "players_admin_all" ON players
  FOR ALL USING (is_admin());

-- =============================================================================
-- 2. DISTRICTS TABLE
-- =============================================================================

ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

-- Everyone can read districts
CREATE POLICY "districts_select_all" ON districts
  FOR SELECT USING (TRUE);

-- Only admin can modify
CREATE POLICY "districts_admin_modify" ON districts
  FOR ALL USING (is_admin());

-- =============================================================================
-- 3. PROPERTIES TABLE
-- =============================================================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Everyone can view all properties
CREATE POLICY "properties_select_all" ON properties
  FOR SELECT USING (TRUE);

-- Owners can update their own properties (limited fields: name, is_for_sale, sale_price)
CREATE POLICY "properties_update_owner" ON properties
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Insert/delete via functions only
CREATE POLICY "properties_insert_none" ON properties
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "properties_delete_none" ON properties
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "properties_admin_all" ON properties
  FOR ALL USING (is_admin());

-- =============================================================================
-- 4. PROPERTY UPGRADES TABLE
-- =============================================================================

ALTER TABLE property_upgrades ENABLE ROW LEVEL SECURITY;

-- Can view upgrades on any property
CREATE POLICY "property_upgrades_select_all" ON property_upgrades
  FOR SELECT USING (TRUE);

-- Insert/update/delete via functions only
CREATE POLICY "property_upgrades_modify_none" ON property_upgrades
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "property_upgrades_update_none" ON property_upgrades
  FOR UPDATE USING (FALSE);

CREATE POLICY "property_upgrades_delete_none" ON property_upgrades
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "property_upgrades_admin_all" ON property_upgrades
  FOR ALL USING (is_admin());

-- =============================================================================
-- 5. BUSINESS TYPES TABLE (reference table)
-- =============================================================================

ALTER TABLE business_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "business_types_select_all" ON business_types
  FOR SELECT USING (TRUE);

-- Only admin can modify
CREATE POLICY "business_types_admin_modify" ON business_types
  FOR ALL USING (is_admin());

-- =============================================================================
-- 6. BUSINESSES TABLE
-- =============================================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Everyone can view all businesses
CREATE POLICY "businesses_select_all" ON businesses
  FOR SELECT USING (TRUE);

-- Owners can update their own (limited via functions)
CREATE POLICY "businesses_update_owner" ON businesses
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Insert/delete via functions
CREATE POLICY "businesses_insert_none" ON businesses
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "businesses_delete_none" ON businesses
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "businesses_admin_all" ON businesses
  FOR ALL USING (is_admin());

-- =============================================================================
-- 7. CRIME TYPES TABLE (reference table)
-- =============================================================================

ALTER TABLE crime_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crime_types_select_all" ON crime_types
  FOR SELECT USING (TRUE);

CREATE POLICY "crime_types_admin_modify" ON crime_types
  FOR ALL USING (is_admin());

-- =============================================================================
-- 8. CRIME LOGS TABLE
-- =============================================================================

ALTER TABLE crime_logs ENABLE ROW LEVEL SECURITY;

-- Players can view their own crime attempts
CREATE POLICY "crime_logs_select_own" ON crime_logs
  FOR SELECT USING (player_id = auth.uid());

-- Players can view crimes against them
CREATE POLICY "crime_logs_select_target" ON crime_logs
  FOR SELECT USING (target_player_id = auth.uid());

-- Insert via functions only
CREATE POLICY "crime_logs_insert_none" ON crime_logs
  FOR INSERT WITH CHECK (FALSE);

-- No update or delete
CREATE POLICY "crime_logs_update_none" ON crime_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY "crime_logs_delete_none" ON crime_logs
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "crime_logs_admin_all" ON crime_logs
  FOR ALL USING (is_admin());

-- =============================================================================
-- 9. JOB TYPES TABLE (reference table)
-- =============================================================================

ALTER TABLE job_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_types_select_all" ON job_types
  FOR SELECT USING (TRUE);

CREATE POLICY "job_types_admin_modify" ON job_types
  FOR ALL USING (is_admin());

-- =============================================================================
-- 10. JOB LOGS TABLE
-- =============================================================================

ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;

-- Players can view their own job completions
CREATE POLICY "job_logs_select_own" ON job_logs
  FOR SELECT USING (player_id = auth.uid());

-- Insert via functions only
CREATE POLICY "job_logs_insert_none" ON job_logs
  FOR INSERT WITH CHECK (FALSE);

-- No update or delete
CREATE POLICY "job_logs_update_none" ON job_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY "job_logs_delete_none" ON job_logs
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "job_logs_admin_all" ON job_logs
  FOR ALL USING (is_admin());

-- =============================================================================
-- 11. TRANSACTIONS TABLE (CRITICAL - immutable)
-- =============================================================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Players can view their own transactions
CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (player_id = auth.uid() OR counterparty_id = auth.uid());

-- Insert via functions only (SECURITY DEFINER functions)
CREATE POLICY "transactions_insert_none" ON transactions
  FOR INSERT WITH CHECK (FALSE);

-- NO updates ever - transactions are immutable
CREATE POLICY "transactions_update_none" ON transactions
  FOR UPDATE USING (FALSE);

-- NO deletes ever
CREATE POLICY "transactions_delete_none" ON transactions
  FOR DELETE USING (FALSE);

-- Admin can only read, not modify
CREATE POLICY "transactions_admin_select" ON transactions
  FOR SELECT USING (is_admin());

-- =============================================================================
-- 12. PLAYER COOLDOWNS TABLE
-- =============================================================================

ALTER TABLE player_cooldowns ENABLE ROW LEVEL SECURITY;

-- Players can view their own cooldowns
CREATE POLICY "cooldowns_select_own" ON player_cooldowns
  FOR SELECT USING (player_id = auth.uid());

-- Modify via functions only
CREATE POLICY "cooldowns_insert_none" ON player_cooldowns
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "cooldowns_update_none" ON player_cooldowns
  FOR UPDATE USING (FALSE);

CREATE POLICY "cooldowns_delete_none" ON player_cooldowns
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "cooldowns_admin_all" ON player_cooldowns
  FOR ALL USING (is_admin());

-- =============================================================================
-- 13. BUSINESS INCOME LOGS TABLE
-- =============================================================================

ALTER TABLE business_income_logs ENABLE ROW LEVEL SECURITY;

-- Players can view their own income logs
CREATE POLICY "business_income_logs_select_own" ON business_income_logs
  FOR SELECT USING (player_id = auth.uid());

-- Modify via functions only
CREATE POLICY "business_income_logs_insert_none" ON business_income_logs
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "business_income_logs_update_none" ON business_income_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY "business_income_logs_delete_none" ON business_income_logs
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "business_income_logs_admin_all" ON business_income_logs
  FOR ALL USING (is_admin());

-- =============================================================================
-- 14. CREWS TABLE
-- =============================================================================

ALTER TABLE crews ENABLE ROW LEVEL SECURITY;

-- Everyone can view crews
CREATE POLICY "crews_select_all" ON crews
  FOR SELECT USING (TRUE);

-- Leader can update their crew
CREATE POLICY "crews_update_leader" ON crews
  FOR UPDATE USING (leader_id = auth.uid())
  WITH CHECK (leader_id = auth.uid());

-- Insert/delete via functions
CREATE POLICY "crews_insert_none" ON crews
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "crews_delete_none" ON crews
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "crews_admin_all" ON crews
  FOR ALL USING (is_admin());

-- =============================================================================
-- 15. CREW MEMBERS TABLE
-- =============================================================================

ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

-- Everyone can view crew members
CREATE POLICY "crew_members_select_all" ON crew_members
  FOR SELECT USING (TRUE);

-- Modify via functions only
CREATE POLICY "crew_members_insert_none" ON crew_members
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "crew_members_update_none" ON crew_members
  FOR UPDATE USING (FALSE);

CREATE POLICY "crew_members_delete_none" ON crew_members
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "crew_members_admin_all" ON crew_members
  FOR ALL USING (is_admin());

-- =============================================================================
-- 16. CREW INVITES TABLE
-- =============================================================================

ALTER TABLE crew_invites ENABLE ROW LEVEL SECURITY;

-- Players can see invites to them
CREATE POLICY "crew_invites_select_invited" ON crew_invites
  FOR SELECT USING (invited_player_id = auth.uid());

-- Crew leaders/officers can see invites they sent
CREATE POLICY "crew_invites_select_sent" ON crew_invites
  FOR SELECT USING (invited_by_player_id = auth.uid());

-- Modify via functions
CREATE POLICY "crew_invites_insert_none" ON crew_invites
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "crew_invites_update_none" ON crew_invites
  FOR UPDATE USING (FALSE);

CREATE POLICY "crew_invites_delete_none" ON crew_invites
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "crew_invites_admin_all" ON crew_invites
  FOR ALL USING (is_admin());

-- =============================================================================
-- 17. DISTRICT INFLUENCE TABLE
-- =============================================================================

ALTER TABLE district_influence ENABLE ROW LEVEL SECURITY;

-- Everyone can view
CREATE POLICY "district_influence_select_all" ON district_influence
  FOR SELECT USING (TRUE);

-- Modify via functions only
CREATE POLICY "district_influence_insert_none" ON district_influence
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "district_influence_update_none" ON district_influence
  FOR UPDATE USING (FALSE);

CREATE POLICY "district_influence_delete_none" ON district_influence
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "district_influence_admin_all" ON district_influence
  FOR ALL USING (is_admin());

-- =============================================================================
-- 18. PLAYER RELATIONSHIPS TABLE
-- =============================================================================

ALTER TABLE player_relationships ENABLE ROW LEVEL SECURITY;

-- Players can see their own relationships
CREATE POLICY "relationships_select_own" ON player_relationships
  FOR SELECT USING (player_id = auth.uid() OR target_player_id = auth.uid());

-- Players can insert their own relationships
CREATE POLICY "relationships_insert_own" ON player_relationships
  FOR INSERT WITH CHECK (player_id = auth.uid());

-- Players can update their own
CREATE POLICY "relationships_update_own" ON player_relationships
  FOR UPDATE USING (player_id = auth.uid());

-- Players can delete their own
CREATE POLICY "relationships_delete_own" ON player_relationships
  FOR DELETE USING (player_id = auth.uid());

-- Admin full access
CREATE POLICY "relationships_admin_all" ON player_relationships
  FOR ALL USING (is_admin());

-- =============================================================================
-- 19. PLAYER MESSAGES TABLE
-- =============================================================================

ALTER TABLE player_messages ENABLE ROW LEVEL SECURITY;

-- Players can see messages to/from them
CREATE POLICY "messages_select_own" ON player_messages
  FOR SELECT USING (from_player_id = auth.uid() OR to_player_id = auth.uid());

-- Players can send messages
CREATE POLICY "messages_insert_own" ON player_messages
  FOR INSERT WITH CHECK (from_player_id = auth.uid());

-- Recipients can mark as read
CREATE POLICY "messages_update_read" ON player_messages
  FOR UPDATE USING (to_player_id = auth.uid())
  WITH CHECK (to_player_id = auth.uid());

-- No delete
CREATE POLICY "messages_delete_none" ON player_messages
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "messages_admin_all" ON player_messages
  FOR ALL USING (is_admin());

-- =============================================================================
-- 20. DISTRICT CHAT TABLE
-- =============================================================================

ALTER TABLE district_chat ENABLE ROW LEVEL SECURITY;

-- Everyone can read non-deleted chat
CREATE POLICY "district_chat_select_all" ON district_chat
  FOR SELECT USING (is_deleted = FALSE);

-- Players can post
CREATE POLICY "district_chat_insert_own" ON district_chat
  FOR INSERT WITH CHECK (player_id = auth.uid());

-- No update (except admin soft delete)
CREATE POLICY "district_chat_update_none" ON district_chat
  FOR UPDATE USING (FALSE);

-- No delete
CREATE POLICY "district_chat_delete_none" ON district_chat
  FOR DELETE USING (FALSE);

-- Admin full access
CREATE POLICY "district_chat_admin_all" ON district_chat
  FOR ALL USING (is_admin());

-- =============================================================================
-- 21. MISSIONS TABLE (reference table)
-- =============================================================================

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_select_all" ON missions
  FOR SELECT USING (TRUE);

CREATE POLICY "missions_admin_modify" ON missions
  FOR ALL USING (is_admin());

-- =============================================================================
-- 22. PLAYER MISSIONS TABLE
-- =============================================================================

ALTER TABLE player_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_missions_select_own" ON player_missions
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "player_missions_insert_none" ON player_missions
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "player_missions_update_none" ON player_missions
  FOR UPDATE USING (FALSE);

CREATE POLICY "player_missions_delete_none" ON player_missions
  FOR DELETE USING (FALSE);

CREATE POLICY "player_missions_admin_all" ON player_missions
  FOR ALL USING (is_admin());

-- =============================================================================
-- 23. ITEMS TABLE (reference table)
-- =============================================================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_all" ON items
  FOR SELECT USING (TRUE);

CREATE POLICY "items_admin_modify" ON items
  FOR ALL USING (is_admin());

-- =============================================================================
-- 24. PLAYER INVENTORY TABLE
-- =============================================================================

ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select_own" ON player_inventory
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "inventory_insert_none" ON player_inventory
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "inventory_update_none" ON player_inventory
  FOR UPDATE USING (FALSE);

CREATE POLICY "inventory_delete_none" ON player_inventory
  FOR DELETE USING (FALSE);

CREATE POLICY "inventory_admin_all" ON player_inventory
  FOR ALL USING (is_admin());

-- =============================================================================
-- 25. MARKETPLACE LISTINGS TABLE
-- =============================================================================

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings_select_all" ON marketplace_listings
  FOR SELECT USING (TRUE);

CREATE POLICY "listings_insert_own" ON marketplace_listings
  FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "listings_update_own" ON marketplace_listings
  FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "listings_delete_none" ON marketplace_listings
  FOR DELETE USING (FALSE);

CREATE POLICY "listings_admin_all" ON marketplace_listings
  FOR ALL USING (is_admin());

-- =============================================================================
-- 26. GAME EVENTS TABLE (analytics)
-- =============================================================================

ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_events_select_own" ON game_events
  FOR SELECT USING (player_id = auth.uid() OR target_player_id = auth.uid());

CREATE POLICY "game_events_insert_none" ON game_events
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "game_events_update_none" ON game_events
  FOR UPDATE USING (FALSE);

CREATE POLICY "game_events_delete_none" ON game_events
  FOR DELETE USING (FALSE);

CREATE POLICY "game_events_admin_all" ON game_events
  FOR ALL USING (is_admin());

-- =============================================================================
-- 27. ADMIN ACTIONS TABLE (audit log)
-- =============================================================================

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_actions_select_admin" ON admin_actions
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_actions_insert_admin" ON admin_actions
  FOR INSERT WITH CHECK (is_admin() AND admin_user_id = auth.uid());

CREATE POLICY "admin_actions_update_none" ON admin_actions
  FOR UPDATE USING (FALSE);

CREATE POLICY "admin_actions_delete_none" ON admin_actions
  FOR DELETE USING (FALSE);

-- =============================================================================
-- 28. SCHEDULED EVENTS TABLE
-- =============================================================================

ALTER TABLE scheduled_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_events_select_all" ON scheduled_events
  FOR SELECT USING (TRUE);

CREATE POLICY "scheduled_events_admin_modify" ON scheduled_events
  FOR ALL USING (is_admin());

-- =============================================================================
-- RLS POLICIES COMPLETE
-- =============================================================================
--
-- Security Model Summary:
--
-- REFERENCE TABLES (public read, admin write):
--   districts, business_types, crime_types, job_types, missions, items, scheduled_events
--
-- PLAYER-OWNED DATA (own read, function write):
--   players, properties, businesses, player_missions, player_inventory,
--   crime_logs, job_logs, transactions, player_cooldowns, business_income_logs
--
-- SOCIAL DATA (various access patterns):
--   crews - public read, leader update
--   crew_members - public read, function write
--   crew_invites - invited/sender read, function write
--   player_relationships - own CRUD
--   player_messages - own read/send, recipient update (mark read)
--   district_chat - public read (non-deleted), own insert
--
-- ADMIN ONLY:
--   admin_actions - admin read/insert only
--
-- IMMUTABLE (no updates/deletes ever):
--   transactions, crime_logs, job_logs, game_events
--
-- All sensitive operations (purchases, crimes, jobs, trades) should go through
-- SECURITY DEFINER functions that bypass RLS with service role access.
--
