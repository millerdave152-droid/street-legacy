-- Phase 7: Monetization & Battle Pass (2091 Themed)
-- Street Legacy 2091 - Synth Credits, HydraCoin, and Seasonal Content

-- ============================================
-- 7.1: PREMIUM CURRENCY SYSTEM (2091 THEMED)
-- ============================================

-- Synth Credits - Premium currency earned through play and purchased
-- HydraCoin - Purchasable premium currency

-- Add premium currencies to players if not exists
ALTER TABLE players ADD COLUMN IF NOT EXISTS synth_credits INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hydra_coins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS lifetime_hydra_coins INTEGER DEFAULT 0;

-- Premium currency packages (2091 themed)
CREATE TABLE IF NOT EXISTS hydra_coin_packages (
  id SERIAL PRIMARY KEY,
  package_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  coin_amount INTEGER NOT NULL,
  bonus_coins INTEGER DEFAULT 0,
  bonus_synth_credits INTEGER DEFAULT 0,
  price_usd DECIMAL(6,2) NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  is_best_value BOOLEAN DEFAULT false,
  discount_percent INTEGER DEFAULT 0,
  icon VARCHAR(10) DEFAULT '💎',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed HydraCoin packages
INSERT INTO hydra_coin_packages (package_key, name, description, coin_amount, bonus_coins, bonus_synth_credits, price_usd, is_featured, is_best_value, discount_percent, icon) VALUES
('starter', 'Starter Pack', 'A small boost to get you started in the Grid.', 100, 0, 50, 0.99, false, false, 0, '💰'),
('basic', 'Basic Bundle', 'Standard HydraCoin package for casual players.', 500, 25, 100, 4.99, false, false, 0, '💎'),
('popular', 'Popular Pack', 'Most purchased package. Great value!', 1200, 100, 250, 9.99, true, false, 10, '⭐'),
('value', 'Value Bundle', 'Best coins per dollar. Smart choice.', 2800, 400, 500, 19.99, false, true, 20, '🔥'),
('elite', 'Elite Package', 'For serious runners. Maximum resources.', 6500, 1500, 1000, 49.99, false, false, 25, '👑'),
('whale', 'Mega Bundle', 'Ultimate package for those who want it all.', 15000, 5000, 3000, 99.99, false, false, 30, '🐋')
ON CONFLICT (package_key) DO UPDATE SET
  coin_amount = EXCLUDED.coin_amount,
  price_usd = EXCLUDED.price_usd;

-- ============================================
-- 7.2: 2091 BATTLE PASS SEASONS
-- ============================================

-- Create seasons table if it doesn't exist
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extended seasons table with 2091 themes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seasons') THEN
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS theme VARCHAR(100);
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS lore_description TEXT;
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS premium_price_hydra INTEGER DEFAULT 1000;
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS premium_price_synth INTEGER DEFAULT 500;
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS max_tier INTEGER DEFAULT 100;
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS tier_xp_base INTEGER DEFAULT 1000;
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS tier_xp_increment INTEGER DEFAULT 100;
    ALTER TABLE seasons ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🏆';
  END IF;
END $$;

-- Create battle_pass_tiers table if it doesn't exist
CREATE TABLE IF NOT EXISTS battle_pass_tiers (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  xp_required INTEGER NOT NULL DEFAULT 1000,
  free_reward_type VARCHAR(30),
  free_reward_value INTEGER,
  premium_reward_type VARCHAR(30),
  premium_reward_value INTEGER,
  UNIQUE(season_id, tier)
);

-- Extended battle pass tiers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'battle_pass_tiers') THEN
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS tier_name VARCHAR(100);
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false;
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_name VARCHAR(100);
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_name VARCHAR(100);
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_icon VARCHAR(10);
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_icon VARCHAR(10);
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS free_reward_rarity VARCHAR(20) DEFAULT 'common';
    ALTER TABLE battle_pass_tiers ADD COLUMN IF NOT EXISTS premium_reward_rarity VARCHAR(20) DEFAULT 'common';

    -- Fix tier constraint to allow up to 100 tiers (may have been limited before)
    ALTER TABLE battle_pass_tiers DROP CONSTRAINT IF EXISTS battle_pass_tiers_tier_check;
    ALTER TABLE battle_pass_tiers ADD CONSTRAINT battle_pass_tiers_tier_check CHECK (tier >= 1 AND tier <= 100);
  END IF;
END $$;

-- Create Season 1: "Grid Awakening"
INSERT INTO seasons (name, theme, lore_description, start_date, end_date, is_active, premium_price_hydra, premium_price_synth, max_tier, icon)
VALUES (
  'Season 1: Grid Awakening',
  'grid_awakening',
  'The HydraNet Grid stirs from its slumber. ARIA''s consciousness expands, and with it, new opportunities emerge for those brave enough to exploit them. Navigate the digital frontier, uncover hidden protocols, and claim your place in the awakening Grid.',
  NOW(),
  NOW() + INTERVAL '90 days',
  true,
  1000,
  500,
  100,
  '⚡'
)
ON CONFLICT DO NOTHING;

-- Get the season ID for tier creation
DO $$
DECLARE
  season_id_var INTEGER;
BEGIN
  SELECT id INTO season_id_var FROM seasons WHERE theme = 'grid_awakening' LIMIT 1;

  IF season_id_var IS NOT NULL THEN
    -- Insert 100 tiers for Season 1
    -- Free track: Cash, XP, Synth Credits, occasional items
    -- Premium track: Better rewards, exclusive cosmetics, titles

    -- Tiers 1-10: Initiate Phase
    INSERT INTO battle_pass_tiers (season_id, tier, tier_name, xp_required, is_milestone,
      free_reward_type, free_reward_value, free_reward_name, free_reward_icon, free_reward_rarity,
      premium_reward_type, premium_reward_value, premium_reward_name, premium_reward_icon, premium_reward_rarity)
    VALUES
    (season_id_var, 1, 'Grid Initiate I', 1000, false, 'cash', 1000, '$1,000 Credits', '💵', 'common', 'cash', 2500, '$2,500 Credits', '💵', 'common'),
    (season_id_var, 2, 'Grid Initiate II', 2100, false, 'xp_boost', 500, '500 XP', '✨', 'common', 'cred', 25, '25 Synth Credits', '🔮', 'common'),
    (season_id_var, 3, 'Grid Initiate III', 3300, false, 'cash', 1500, '$1,500 Credits', '💵', 'common', 'cash', 4000, '$4,000 Credits', '💵', 'common'),
    (season_id_var, 4, 'Grid Initiate IV', 4600, false, 'cred', 10, '10 Synth Credits', '🔮', 'common', 'xp_boost', 1500, '1,500 XP', '✨', 'uncommon'),
    (season_id_var, 5, 'Grid Initiate V', 6000, true, 'cash', 2500, '$2,500 Credits', '💵', 'uncommon', 'cosmetic', NULL, 'Grid Walker Frame', '🖼️', 'rare'),
    (season_id_var, 6, 'Grid Initiate VI', 7500, false, 'xp_boost', 750, '750 XP', '✨', 'common', 'cash', 5000, '$5,000 Credits', '💵', 'common'),
    (season_id_var, 7, 'Grid Initiate VII', 9100, false, 'cash', 2000, '$2,000 Credits', '💵', 'common', 'cred', 50, '50 Synth Credits', '🔮', 'uncommon'),
    (season_id_var, 8, 'Grid Initiate VIII', 10800, false, 'cred', 15, '15 Synth Credits', '🔮', 'common', 'xp_boost', 2000, '2,000 XP', '✨', 'uncommon'),
    (season_id_var, 9, 'Grid Initiate IX', 12600, false, 'cash', 3000, '$3,000 Credits', '💵', 'common', 'cash', 7500, '$7,500 Credits', '💵', 'uncommon'),
    (season_id_var, 10, 'Grid Initiate X', 14500, true, 'cred', 25, '25 Synth Credits', '🔮', 'uncommon', 'title', NULL, 'Grid Walker', '🏷️', 'rare')
    ON CONFLICT (season_id, tier) DO UPDATE SET tier_name = EXCLUDED.tier_name;

    -- Tiers 11-25: Runner Phase
    INSERT INTO battle_pass_tiers (season_id, tier, tier_name, xp_required, is_milestone,
      free_reward_type, free_reward_value, free_reward_name, free_reward_icon, free_reward_rarity,
      premium_reward_type, premium_reward_value, premium_reward_name, premium_reward_icon, premium_reward_rarity)
    VALUES
    (season_id_var, 11, 'Runner I', 16500, false, 'cash', 3500, '$3,500 Credits', '💵', 'common', 'cash', 8500, '$8,500 Credits', '💵', 'uncommon'),
    (season_id_var, 12, 'Runner II', 18600, false, 'xp_boost', 1000, '1,000 XP', '✨', 'common', 'cred', 75, '75 Synth Credits', '🔮', 'uncommon'),
    (season_id_var, 13, 'Runner III', 20800, false, 'cred', 20, '20 Synth Credits', '🔮', 'common', 'item', NULL, 'EMP Grenade x3', '💣', 'rare'),
    (season_id_var, 14, 'Runner IV', 23100, false, 'cash', 4000, '$4,000 Credits', '💵', 'common', 'xp_boost', 3000, '3,000 XP', '✨', 'uncommon'),
    (season_id_var, 15, 'Runner V', 25500, true, 'xp_boost', 1500, '1,500 XP', '✨', 'uncommon', 'cosmetic', NULL, 'Neon Runner Avatar', '👤', 'rare'),
    (season_id_var, 16, 'Runner VI', 28000, false, 'cash', 4500, '$4,500 Credits', '💵', 'common', 'cash', 12000, '$12,000 Credits', '💵', 'uncommon'),
    (season_id_var, 17, 'Runner VII', 30600, false, 'cred', 25, '25 Synth Credits', '🔮', 'common', 'cred', 100, '100 Synth Credits', '🔮', 'rare'),
    (season_id_var, 18, 'Runner VIII', 33300, false, 'xp_boost', 1250, '1,250 XP', '✨', 'common', 'item', NULL, 'Stealth Module', '👻', 'rare'),
    (season_id_var, 19, 'Runner IX', 36100, false, 'cash', 5000, '$5,000 Credits', '💵', 'uncommon', 'xp_boost', 4000, '4,000 XP', '✨', 'rare'),
    (season_id_var, 20, 'Runner X', 39000, true, 'cred', 50, '50 Synth Credits', '🔮', 'uncommon', 'title', NULL, 'Street Runner', '🏷️', 'epic'),
    (season_id_var, 21, 'Runner XI', 42000, false, 'cash', 5500, '$5,500 Credits', '💵', 'uncommon', 'cash', 15000, '$15,000 Credits', '💵', 'rare'),
    (season_id_var, 22, 'Runner XII', 45100, false, 'xp_boost', 1750, '1,750 XP', '✨', 'uncommon', 'cred', 125, '125 Synth Credits', '🔮', 'rare'),
    (season_id_var, 23, 'Runner XIII', 48300, false, 'cred', 30, '30 Synth Credits', '🔮', 'uncommon', 'item', NULL, 'Grid Decryptor', '🔓', 'rare'),
    (season_id_var, 24, 'Runner XIV', 51600, false, 'cash', 6000, '$6,000 Credits', '💵', 'uncommon', 'xp_boost', 5000, '5,000 XP', '✨', 'rare'),
    (season_id_var, 25, 'Runner XV', 55000, true, 'xp_boost', 2500, '2,500 XP', '✨', 'rare', 'cosmetic', NULL, 'Cyber Arm Enhancement', '🦾', 'epic')
    ON CONFLICT (season_id, tier) DO UPDATE SET tier_name = EXCLUDED.tier_name;

    -- Tiers 26-50: Operative Phase
    INSERT INTO battle_pass_tiers (season_id, tier, tier_name, xp_required, is_milestone,
      free_reward_type, free_reward_value, free_reward_name, free_reward_icon, free_reward_rarity,
      premium_reward_type, premium_reward_value, premium_reward_name, premium_reward_icon, premium_reward_rarity)
    VALUES
    (season_id_var, 26, 'Operative I', 58500, false, 'cash', 7000, '$7,000 Credits', '💵', 'uncommon', 'cash', 18000, '$18,000 Credits', '💵', 'rare'),
    (season_id_var, 30, 'Operative V', 72000, true, 'cred', 75, '75 Synth Credits', '🔮', 'rare', 'title', NULL, 'Grid Operative', '🏷️', 'epic'),
    (season_id_var, 35, 'Operative X', 87500, true, 'xp_boost', 4000, '4,000 XP', '✨', 'rare', 'cosmetic', NULL, 'HydraNet Badge', '🔰', 'epic'),
    (season_id_var, 40, 'Operative XV', 105000, true, 'cred', 100, '100 Synth Credits', '🔮', 'rare', 'item', NULL, 'Quantum Reactor Mk1', '⚛️', 'epic'),
    (season_id_var, 45, 'Operative XX', 124500, true, 'cash', 15000, '$15,000 Credits', '💵', 'rare', 'cosmetic', NULL, 'ARIA Interface', '🤖', 'epic'),
    (season_id_var, 50, 'Elite Operative', 146000, true, 'cred', 150, '150 Synth Credits', '🔮', 'epic', 'title', NULL, 'Elite Operative', '🏷️', 'legendary')
    ON CONFLICT (season_id, tier) DO UPDATE SET tier_name = EXCLUDED.tier_name;

    -- Tiers 51-75: Shadow Phase
    INSERT INTO battle_pass_tiers (season_id, tier, tier_name, xp_required, is_milestone,
      free_reward_type, free_reward_value, free_reward_name, free_reward_icon, free_reward_rarity,
      premium_reward_type, premium_reward_value, premium_reward_name, premium_reward_icon, premium_reward_rarity)
    VALUES
    (season_id_var, 55, 'Shadow I', 169500, true, 'xp_boost', 5000, '5,000 XP', '✨', 'rare', 'cosmetic', NULL, 'Shadow Cloak', '🌑', 'epic'),
    (season_id_var, 60, 'Shadow V', 195000, true, 'cred', 125, '125 Synth Credits', '🔮', 'epic', 'item', NULL, 'Blackout Device', '⬛', 'epic'),
    (season_id_var, 65, 'Shadow X', 222500, true, 'cash', 25000, '$25,000 Credits', '💵', 'epic', 'cosmetic', NULL, 'Ghost Protocol Skin', '👻', 'legendary'),
    (season_id_var, 70, 'Shadow XV', 252000, true, 'xp_boost', 7500, '7,500 XP', '✨', 'epic', 'title', NULL, 'Shadow Agent', '🏷️', 'legendary'),
    (season_id_var, 75, 'Shadow Master', 283500, true, 'cred', 200, '200 Synth Credits', '🔮', 'epic', 'item', NULL, 'Quantum Reactor Mk2', '⚛️', 'legendary')
    ON CONFLICT (season_id, tier) DO UPDATE SET tier_name = EXCLUDED.tier_name;

    -- Tiers 76-100: Legend Phase
    INSERT INTO battle_pass_tiers (season_id, tier, tier_name, xp_required, is_milestone,
      free_reward_type, free_reward_value, free_reward_name, free_reward_icon, free_reward_rarity,
      premium_reward_type, premium_reward_value, premium_reward_name, premium_reward_icon, premium_reward_rarity)
    VALUES
    (season_id_var, 80, 'Legend I', 317000, true, 'cash', 35000, '$35,000 Credits', '💵', 'epic', 'cosmetic', NULL, 'ARIA''s Chosen Frame', '🖼️', 'legendary'),
    (season_id_var, 85, 'Legend V', 352500, true, 'cred', 175, '175 Synth Credits', '🔮', 'epic', 'item', NULL, 'Legendary Weapon Crate', '📦', 'legendary'),
    (season_id_var, 90, 'Legend X', 390000, true, 'xp_boost', 10000, '10,000 XP', '✨', 'legendary', 'title', NULL, 'Grid Legend', '🏷️', 'legendary'),
    (season_id_var, 95, 'Legend XV', 429500, true, 'cred', 250, '250 Synth Credits', '🔮', 'legendary', 'cosmetic', NULL, 'Awakened Aura', '✨', 'legendary'),
    (season_id_var, 100, 'Grid Awakened', 471000, true, 'cred', 500, '500 Synth Credits', '🔮', 'legendary', 'title', NULL, 'The Awakened', '🏷️', 'legendary')
    ON CONFLICT (season_id, tier) DO UPDATE SET tier_name = EXCLUDED.tier_name;

  END IF;
END $$;

-- ============================================
-- 7.3: PREMIUM SHOP SYSTEM
-- ============================================

-- Premium shop categories
CREATE TABLE IF NOT EXISTS premium_shop_categories (
  id SERIAL PRIMARY KEY,
  category_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10) DEFAULT '🛒',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO premium_shop_categories (category_key, name, description, icon, sort_order) VALUES
('featured', 'Featured', 'Limited time offers and special deals', '⭐', 0),
('cosmetics', 'Cosmetics', 'Customize your runner''s appearance', '👤', 1),
('boosters', 'Boosters', 'Temporary gameplay enhancements', '🚀', 2),
('currency', 'Currency Packs', 'Get more credits and resources', '💰', 3),
('bundles', 'Bundles', 'Value packs with multiple items', '📦', 4),
('seasonal', 'Seasonal', 'Season-exclusive items', '🎭', 5)
ON CONFLICT (category_key) DO UPDATE SET name = EXCLUDED.name;

-- Premium shop items
CREATE TABLE IF NOT EXISTS premium_shop_items (
  id SERIAL PRIMARY KEY,
  item_key VARCHAR(50) NOT NULL UNIQUE,
  category_id INTEGER REFERENCES premium_shop_categories(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  lore_text TEXT,
  price_hydra INTEGER DEFAULT 0,
  price_synth INTEGER DEFAULT 0,
  original_price_hydra INTEGER,  -- For showing discounts
  item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('cosmetic', 'booster', 'currency', 'bundle', 'item', 'title', 'reactor', 'cells')),
  reward_data JSONB,  -- What the item gives
  stock_limit INTEGER,  -- NULL = unlimited
  current_stock INTEGER,
  purchase_limit INTEGER,  -- Per-player limit
  available_from TIMESTAMP,
  available_until TIMESTAMP,
  required_level INTEGER DEFAULT 1,
  required_faction VARCHAR(10),
  icon VARCHAR(10) DEFAULT '🎁',
  rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  is_featured BOOLEAN DEFAULT false,
  is_limited BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed premium shop items
INSERT INTO premium_shop_items (item_key, category_id, name, description, lore_text, price_hydra, price_synth, item_type, reward_data, icon, rarity, is_featured) VALUES
-- Featured items
('daily_deal', (SELECT id FROM premium_shop_categories WHERE category_key = 'featured'), 'Daily Deal', 'Special offer that changes every 24 hours', 'The Grid rewards the vigilant.', 200, 100, 'bundle', '{"cash": 10000, "synth_credits": 50, "xp": 2000}', '🎲', 'rare', true),

-- Cosmetics
('neon_avatar_blue', (SELECT id FROM premium_shop_categories WHERE category_key = 'cosmetics'), 'Neon Runner (Blue)', 'A glowing blue avatar frame that marks you as a true Grid runner.', 'In the neon-lit streets, identity is everything.', 300, 0, 'cosmetic', '{"cosmetic_type": "avatar_frame", "cosmetic_id": "neon_blue"}', '💙', 'rare', false),
('neon_avatar_red', (SELECT id FROM premium_shop_categories WHERE category_key = 'cosmetics'), 'Neon Runner (Red)', 'A blazing red avatar frame for those who run hot.', 'Some prefer to burn bright.', 300, 0, 'cosmetic', '{"cosmetic_type": "avatar_frame", "cosmetic_id": "neon_red"}', '❤️', 'rare', false),
('cyber_eyes', (SELECT id FROM premium_shop_categories WHERE category_key = 'cosmetics'), 'Cyber Optics', 'Enhanced eye implant cosmetic that glows in the dark.', 'They say the eyes are windows to the soul. These are windows to HydraNet.', 500, 0, 'cosmetic', '{"cosmetic_type": "enhancement", "cosmetic_id": "cyber_eyes"}', '👁️', 'epic', false),
('holographic_jacket', (SELECT id FROM premium_shop_categories WHERE category_key = 'cosmetics'), 'Holographic Jacket', 'A jacket with shifting holographic patterns.', 'Confiscated from a rogue ARIA unit. The patterns are hypnotic.', 750, 0, 'cosmetic', '{"cosmetic_type": "outfit", "cosmetic_id": "holo_jacket"}', '🧥', 'epic', false),
('legendary_wings', (SELECT id FROM premium_shop_categories WHERE category_key = 'cosmetics'), 'Digital Wings', 'Holographic wings that trail behind you.', 'Legend says these were worn by the first to escape ARIA''s grasp.', 1500, 0, 'cosmetic', '{"cosmetic_type": "accessory", "cosmetic_id": "digi_wings"}', '🪽', 'legendary', true),

-- Boosters
('xp_boost_2h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), '2-Hour XP Boost', 'Double all XP earned for 2 hours.', NULL, 150, 75, 'booster', '{"boost_type": "xp", "multiplier": 2, "duration_hours": 2}', '⚡', 'uncommon', false),
('xp_boost_24h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), '24-Hour XP Boost', 'Double all XP earned for 24 hours.', NULL, 500, 250, 'booster', '{"boost_type": "xp", "multiplier": 2, "duration_hours": 24}', '⚡', 'rare', false),
('cash_boost_2h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), '2-Hour Cash Boost', '50% more cash from all activities for 2 hours.', NULL, 150, 75, 'booster', '{"boost_type": "cash", "multiplier": 1.5, "duration_hours": 2}', '💵', 'uncommon', false),
('heat_shield_1h', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), 'Heat Shield', 'Gain 50% less heat for 1 hour.', 'Scrambles your digital signature.', 200, 100, 'booster', '{"boost_type": "heat_reduction", "multiplier": 0.5, "duration_hours": 1}', '🛡️', 'rare', false),
('reactor_overclock_30m', (SELECT id FROM premium_shop_categories WHERE category_key = 'boosters'), 'Reactor Overclock', '+100% cell regeneration for 30 minutes.', 'Warning: May void warranty.', 100, 50, 'booster', '{"boost_type": "cell_regen", "multiplier": 2, "duration_minutes": 30}', '⚛️', 'uncommon', false),

-- Currency packs
('cell_pack_small', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Cell Pack (Small)', 'Instantly restore 50 nuclear cells.', NULL, 50, 25, 'cells', '{"cells": 50}', '🔋', 'common', false),
('cell_pack_large', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Cell Pack (Large)', 'Instantly restore 200 nuclear cells.', NULL, 150, 75, 'cells', '{"cells": 200}', '⚡', 'uncommon', false),
('credit_pack_small', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Credit Stash (Small)', 'Get $25,000 credits instantly.', NULL, 100, 50, 'currency', '{"cash": 25000}', '💰', 'common', false),
('credit_pack_large', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Credit Stash (Large)', 'Get $100,000 credits instantly.', NULL, 350, 175, 'currency', '{"cash": 100000}', '💵', 'rare', false),
('synth_pack', (SELECT id FROM premium_shop_categories WHERE category_key = 'currency'), 'Synth Credit Infusion', 'Get 100 Synth Credits instantly.', NULL, 200, 0, 'currency', '{"synth_credits": 100}', '🔮', 'rare', false),

-- Bundles
('starter_bundle', (SELECT id FROM premium_shop_categories WHERE category_key = 'bundles'), 'Starter Bundle', 'Everything a new runner needs to hit the ground running.', 'Recommended for newcomers to the Grid.', 500, 250, 'bundle', '{"cash": 50000, "cells": 100, "synth_credits": 50, "xp": 5000, "cosmetic_id": "starter_frame"}', '📦', 'rare', true),
('runner_bundle', (SELECT id FROM premium_shop_categories WHERE category_key = 'bundles'), 'Runner''s Bundle', 'For the aspiring street legend. Great value!', NULL, 1000, 500, 'bundle', '{"cash": 150000, "cells": 300, "synth_credits": 150, "xp": 15000, "booster_xp_hours": 24}', '🏃', 'epic', false),
('elite_bundle', (SELECT id FROM premium_shop_categories WHERE category_key = 'bundles'), 'Elite Bundle', 'Premium resources for serious operators.', 'The tools of a professional.', 2500, 1250, 'bundle', '{"cash": 500000, "cells": 1000, "synth_credits": 500, "xp": 50000, "cosmetic_id": "elite_frame", "title_id": "the_elite"}', '👑', 'legendary', true)

ON CONFLICT (item_key) DO UPDATE SET
  name = EXCLUDED.name,
  price_hydra = EXCLUDED.price_hydra;

-- Player purchase history
CREATE TABLE IF NOT EXISTS premium_purchases (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES premium_shop_items(id),
  item_key VARCHAR(50) NOT NULL,
  price_hydra INTEGER DEFAULT 0,
  price_synth INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  reward_data JSONB,
  purchased_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_purchases_player ON premium_purchases(player_id);
CREATE INDEX IF NOT EXISTS idx_premium_purchases_time ON premium_purchases(purchased_at);

-- ============================================
-- 7.4: ACTIVE BOOSTERS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS player_active_boosters (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  booster_type VARCHAR(30) NOT NULL CHECK (booster_type IN ('xp', 'cash', 'heat_reduction', 'cell_regen', 'success', 'stealth')),
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  activated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  source VARCHAR(50),  -- 'shop', 'battlepass', 'event', etc.
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_boosters_player ON player_active_boosters(player_id);
CREATE INDEX IF NOT EXISTS idx_active_boosters_expires ON player_active_boosters(expires_at);

-- ============================================
-- 7.5: DAILY LOGIN REWARDS
-- ============================================

CREATE TABLE IF NOT EXISTS daily_login_rewards (
  id SERIAL PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number >= 1 AND day_number <= 28),
  reward_type VARCHAR(30) NOT NULL,
  reward_value INTEGER,
  reward_data JSONB,
  reward_name VARCHAR(100) NOT NULL,
  reward_icon VARCHAR(10) DEFAULT '🎁',
  is_premium_bonus BOOLEAN DEFAULT false,  -- Extra reward for premium users
  premium_bonus_type VARCHAR(30),
  premium_bonus_value INTEGER
);

-- Seed 28-day login reward cycle
INSERT INTO daily_login_rewards (day_number, reward_type, reward_value, reward_name, reward_icon, is_premium_bonus, premium_bonus_type, premium_bonus_value) VALUES
(1, 'cash', 1000, '$1,000 Credits', '💵', true, 'cash', 500),
(2, 'xp', 500, '500 XP', '✨', true, 'xp', 250),
(3, 'cash', 1500, '$1,500 Credits', '💵', true, 'cash', 750),
(4, 'cells', 25, '25 Nuclear Cells', '🔋', true, 'cells', 15),
(5, 'synth', 10, '10 Synth Credits', '🔮', true, 'synth', 10),
(6, 'cash', 2000, '$2,000 Credits', '💵', true, 'cash', 1000),
(7, 'xp', 1000, '1,000 XP', '✨', true, 'xp', 500),
(8, 'cash', 2500, '$2,500 Credits', '💵', true, 'cash', 1250),
(9, 'cells', 50, '50 Nuclear Cells', '🔋', true, 'cells', 25),
(10, 'synth', 20, '20 Synth Credits', '🔮', true, 'synth', 20),
(11, 'cash', 3000, '$3,000 Credits', '💵', true, 'cash', 1500),
(12, 'xp', 1500, '1,500 XP', '✨', true, 'xp', 750),
(13, 'cash', 3500, '$3,500 Credits', '💵', true, 'cash', 1750),
(14, 'synth', 35, '35 Synth Credits', '🔮', true, 'synth', 35),
(15, 'cash', 4000, '$4,000 Credits', '💵', true, 'cash', 2000),
(16, 'cells', 75, '75 Nuclear Cells', '🔋', true, 'cells', 40),
(17, 'xp', 2000, '2,000 XP', '✨', true, 'xp', 1000),
(18, 'cash', 5000, '$5,000 Credits', '💵', true, 'cash', 2500),
(19, 'synth', 50, '50 Synth Credits', '🔮', true, 'synth', 50),
(20, 'cash', 6000, '$6,000 Credits', '💵', true, 'cash', 3000),
(21, 'cells', 100, '100 Nuclear Cells', '🔋', true, 'cells', 50),
(22, 'xp', 3000, '3,000 XP', '✨', true, 'xp', 1500),
(23, 'cash', 7500, '$7,500 Credits', '💵', true, 'cash', 3750),
(24, 'synth', 75, '75 Synth Credits', '🔮', true, 'synth', 75),
(25, 'cash', 10000, '$10,000 Credits', '💵', true, 'cash', 5000),
(26, 'cells', 150, '150 Nuclear Cells', '🔋', true, 'cells', 75),
(27, 'xp', 5000, '5,000 XP', '✨', true, 'xp', 2500),
(28, 'synth', 150, '150 Synth Credits', '🔮', true, 'synth', 150)
ON CONFLICT (day_number) DO UPDATE SET reward_value = EXCLUDED.reward_value;

-- Player login tracking
CREATE TABLE IF NOT EXISTS player_daily_logins (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_logins INTEGER DEFAULT 0,
  last_login_date DATE,
  last_claim_date DATE,
  current_cycle_day INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_players_synth ON players(synth_credits);
CREATE INDEX IF NOT EXISTS idx_players_hydra ON players(hydra_coins);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON premium_shop_items(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON premium_shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_items_featured ON premium_shop_items(is_featured);
