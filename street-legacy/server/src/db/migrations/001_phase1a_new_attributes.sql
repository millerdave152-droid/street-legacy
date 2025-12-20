-- Migration 001: Phase 1A - New Attribute and Currency System
-- Transforms energy/nerve into Stamina/Focus, adds Heat, Influence, Street Rep
-- Adds new currencies: Clean Money, Crypto, Tokens

-- =====================================================
-- NEW PLAYER ATTRIBUTES
-- =====================================================

-- Rename energy to stamina (will use new column instead for clarity)
-- Add stamina column (replacing energy concept)
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina INTEGER NOT NULL DEFAULT 100 CHECK (stamina >= 0 AND stamina <= 100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_max INTEGER NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_regen_at TIMESTAMP;

-- Add focus column (replacing nerve concept)
ALTER TABLE players ADD COLUMN IF NOT EXISTS focus INTEGER NOT NULL DEFAULT 100 CHECK (focus >= 0 AND focus <= 100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS focus_max INTEGER NOT NULL DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS focus_regen_at TIMESTAMP;

-- Add influence (social capital for negotiations)
ALTER TABLE players ADD COLUMN IF NOT EXISTS influence INTEGER NOT NULL DEFAULT 0 CHECK (influence >= 0 AND influence <= 100);

-- Street Rep is permanent reputation score
ALTER TABLE players ADD COLUMN IF NOT EXISTS street_rep INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- NEW CURRENCY SYSTEM
-- =====================================================

-- Clean Money (laundered funds, used for legal purchases)
ALTER TABLE players ADD COLUMN IF NOT EXISTS clean_money INTEGER NOT NULL DEFAULT 0;

-- Crypto (untraceable digital currency)
ALTER TABLE players ADD COLUMN IF NOT EXISTS crypto INTEGER NOT NULL DEFAULT 0;

-- Tokens (premium currency, replaces street_cred usage)
ALTER TABLE players ADD COLUMN IF NOT EXISTS tokens INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- UPDATE CRIMES TABLE FOR NEW ATTRIBUTE COSTS
-- =====================================================

-- Add stamina and focus costs (will replace energy_cost and nerve_cost)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crimes') THEN
    ALTER TABLE crimes ADD COLUMN IF NOT EXISTS stamina_cost INTEGER NOT NULL DEFAULT 5;
    ALTER TABLE crimes ADD COLUMN IF NOT EXISTS focus_cost INTEGER NOT NULL DEFAULT 5;
    ALTER TABLE crimes ADD COLUMN IF NOT EXISTS influence_required INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE crimes ADD COLUMN IF NOT EXISTS heat_generated INTEGER NOT NULL DEFAULT 5;
  END IF;
END $$;

-- =====================================================
-- UPDATE STORY MISSIONS FOR NEW ATTRIBUTES
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'story_missions') THEN
    ALTER TABLE story_missions ADD COLUMN IF NOT EXISTS stamina_cost INTEGER NOT NULL DEFAULT 10;
    ALTER TABLE story_missions ADD COLUMN IF NOT EXISTS focus_cost INTEGER NOT NULL DEFAULT 10;
  END IF;
END $$;

-- =====================================================
-- MIGRATE EXISTING DATA (only if old columns exist)
-- =====================================================

-- Copy existing energy values to stamina
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'energy') THEN
    UPDATE players SET stamina = LEAST(energy, 100) WHERE stamina = 100 AND energy != 100;
  END IF;
END $$;

-- Copy existing nerve values to focus
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'nerve') THEN
    UPDATE players SET focus = LEAST(nerve, 100) WHERE focus = 100 AND nerve != 100;
  END IF;
END $$;

-- Copy existing street_cred to tokens for premium currency
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'street_cred') THEN
    UPDATE players SET tokens = street_cred WHERE tokens = 0 AND street_cred > 0;
  END IF;
END $$;

-- Copy crime costs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crimes' AND column_name = 'energy_cost')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crimes' AND column_name = 'nerve_cost') THEN
    UPDATE crimes SET stamina_cost = energy_cost WHERE stamina_cost = 5 AND energy_cost != 5;
    UPDATE crimes SET focus_cost = nerve_cost WHERE focus_cost = 5 AND nerve_cost != 5;
  END IF;
END $$;

-- Copy story mission costs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'story_missions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'story_missions' AND column_name = 'energy_cost')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'story_missions' AND column_name = 'nerve_cost') THEN
    UPDATE story_missions SET stamina_cost = energy_cost WHERE stamina_cost = 10 AND energy_cost != 10;
    UPDATE story_missions SET focus_cost = nerve_cost WHERE focus_cost = 10 AND nerve_cost != 10;
  END IF;
END $$;

-- =====================================================
-- CURRENCY TRANSACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS currency_transactions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  currency_type VARCHAR(20) NOT NULL CHECK (currency_type IN ('cash', 'bank', 'clean_money', 'crypto', 'tokens')),
  amount INTEGER NOT NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('earn', 'spend', 'transfer', 'convert', 'bonus', 'refund')),
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_player ON currency_transactions(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_type ON currency_transactions(currency_type, transaction_type);

-- =====================================================
-- ATTRIBUTE REGENERATION LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS attribute_regen_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attribute_type VARCHAR(20) NOT NULL CHECK (attribute_type IN ('stamina', 'focus')),
  amount_regenerated INTEGER NOT NULL,
  regenerated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attribute_regen_player ON attribute_regen_log(player_id, regenerated_at DESC);
