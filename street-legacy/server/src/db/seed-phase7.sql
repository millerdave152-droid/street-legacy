-- =====================================================
-- PHASE 7 SEED DATA: PROPERTY SYSTEM AND REAL ESTATE EMPIRE
-- =====================================================

-- =====================================================
-- PROPERTY LISTINGS - RESIDENTIAL
-- =====================================================

INSERT INTO property_listings (name, description, property_type, category, district_id, base_price, clean_money_required, min_level, base_income_per_hour, base_storage_capacity, base_heat_reduction, base_influence_bonus, upgrade_slots, vehicle_slots, can_be_crew_hq, is_hidden) VALUES
  -- Downtown Core (district 1) - Expensive properties
  ('Bay Street Penthouse', 'Luxury penthouse with stunning city views. The ultimate status symbol.', 'penthouse', 'residential', 1, 5000000, 2500000, 15, 500, 50, 10, 50, 5, 2, TRUE, FALSE),
  ('King West Condo', 'Modern condo in the trendy King West neighborhood.', 'condo', 'residential', 1, 350000, 100000, 5, 100, 20, 5, 10, 3, 1, FALSE, FALSE),
  ('Financial District Apartment', 'Small but well-located apartment near the banks.', 'apartment', 'residential', 1, 80000, 0, 1, 25, 10, 2, 0, 2, 0, FALSE, FALSE),

  -- Kensington Market (district 2) - Affordable, character
  ('Market Loft', 'Quirky loft above a vintage shop.', 'apartment', 'residential', 2, 45000, 0, 1, 15, 8, 0, 5, 2, 0, FALSE, FALSE),
  ('Kensington House', 'Victorian house with a hidden basement.', 'house', 'residential', 2, 400000, 50000, 6, 150, 35, 5, 15, 4, 2, TRUE, FALSE),

  -- Scarborough (district 3) - Working class
  ('Scarborough Townhouse', 'Modest townhouse with garage space.', 'house', 'residential', 3, 350000, 0, 4, 100, 30, 3, 5, 3, 2, FALSE, FALSE),
  ('Kennedy Apartment', 'Basic apartment near the subway.', 'apartment', 'residential', 3, 35000, 0, 1, 10, 5, 0, 0, 2, 0, FALSE, FALSE),

  -- York (district 4)
  ('Weston House', 'Family home with a large backyard.', 'house', 'residential', 4, 450000, 50000, 5, 120, 35, 5, 10, 4, 2, TRUE, FALSE),

  -- Etobicoke (district 5) - Upscale suburban
  ('Lakeshore Mansion', 'Waterfront mansion with private dock access.', 'mansion', 'residential', 5, 2500000, 1000000, 12, 400, 100, 20, 35, 6, 4, TRUE, FALSE),
  ('Mimico Condo', 'Waterfront condo with lake views.', 'condo', 'residential', 5, 280000, 50000, 4, 80, 18, 5, 8, 3, 1, FALSE, FALSE),

  -- North York (district 6)
  ('North York Mansion', 'Sprawling estate in a gated community.', 'mansion', 'residential', 6, 2200000, 800000, 10, 350, 90, 15, 30, 6, 4, TRUE, FALSE),
  ('Yonge & Sheppard Condo', 'High-rise condo near the subway.', 'condo', 'residential', 6, 320000, 75000, 5, 90, 20, 5, 10, 3, 1, FALSE, FALSE),

  -- East York (district 7)
  ('Danforth Apartment', 'Cozy apartment above a Greek restaurant.', 'apartment', 'residential', 7, 40000, 0, 1, 12, 6, 0, 3, 2, 0, FALSE, FALSE),
  ('East York Bungalow', 'Classic bungalow with a finished basement.', 'house', 'residential', 7, 380000, 25000, 4, 100, 30, 3, 8, 3, 1, FALSE, FALSE),

  -- Parkdale (district 8) - Cheap but rough
  ('Parkdale Studio', 'Cheap studio in a rough building.', 'apartment', 'residential', 8, 25000, 0, 1, 5, 3, 0, 0, 1, 0, FALSE, FALSE),
  ('Queen West Apartment', 'Artist loft with character.', 'apartment', 'residential', 8, 55000, 0, 2, 20, 10, 0, 5, 2, 0, FALSE, FALSE)
ON CONFLICT (district_id, name) DO NOTHING;

-- =====================================================
-- PROPERTY LISTINGS - COMMERCIAL
-- =====================================================

INSERT INTO property_listings (name, description, property_type, category, district_id, base_price, clean_money_required, min_level, base_income_per_hour, base_storage_capacity, base_heat_reduction, base_influence_bonus, upgrade_slots, staff_slots, can_launder_money) VALUES
  -- Downtown Core
  ('King Street Nightclub', 'Premier nightclub in the entertainment district.', 'nightclub', 'commercial', 1, 1200000, 500000, 10, 2500, 30, 0, 40, 5, 8, TRUE),
  ('Bay Street Restaurant', 'Upscale Italian restaurant frequented by executives.', 'restaurant', 'commercial', 1, 450000, 150000, 6, 800, 20, 0, 20, 4, 5, TRUE),
  ('Downtown Strip Mall', 'Small strip mall with multiple retail spaces.', 'strip_mall', 'commercial', 1, 1500000, 600000, 12, 3000, 50, 0, 25, 5, 6, TRUE),

  -- Kensington Market
  ('Vintage Corner Store', 'Eclectic shop selling a bit of everything.', 'corner_store', 'commercial', 2, 85000, 0, 2, 150, 15, 0, 5, 2, 2, FALSE),
  ('Market Cafe', 'Popular cafe with loyal customers.', 'restaurant', 'commercial', 2, 200000, 50000, 4, 400, 15, 0, 10, 3, 4, TRUE),

  -- Scarborough
  ('Scarborough Car Wash', 'Busy car wash near the mall.', 'car_wash', 'commercial', 3, 180000, 50000, 4, 400, 10, 0, 5, 3, 3, TRUE),
  ('Kennedy Road Corner Store', 'Convenience store open 24/7.', 'corner_store', 'commercial', 3, 75000, 0, 2, 120, 12, 0, 3, 2, 2, FALSE),
  ('STC Nightclub', 'Popular nightclub in Scarborough Town Centre.', 'nightclub', 'commercial', 3, 650000, 200000, 8, 1500, 25, 0, 25, 4, 6, TRUE),

  -- Etobicoke
  ('Lakeshore Restaurant', 'Waterfront dining with a patio.', 'restaurant', 'commercial', 5, 380000, 100000, 5, 650, 18, 0, 15, 4, 5, TRUE),
  ('Islington Car Wash', 'High-volume car wash with detailing.', 'car_wash', 'commercial', 5, 200000, 75000, 5, 450, 12, 0, 8, 3, 3, TRUE),

  -- North York
  ('Yonge Strip Mall', 'Busy strip mall on Yonge Street.', 'strip_mall', 'commercial', 6, 1200000, 400000, 10, 2500, 45, 0, 20, 5, 6, TRUE),
  ('Empress Walk Restaurant', 'Trendy Asian fusion restaurant.', 'restaurant', 'commercial', 6, 350000, 100000, 5, 600, 18, 0, 12, 4, 5, TRUE),

  -- Parkdale
  ('Parkdale Dive Bar', 'Gritty bar with character.', 'nightclub', 'commercial', 8, 250000, 50000, 4, 500, 15, 0, 10, 3, 4, TRUE),
  ('Queen West Corner Store', 'Hip convenience store.', 'corner_store', 'commercial', 8, 65000, 0, 2, 100, 10, 0, 5, 2, 2, FALSE)
ON CONFLICT (district_id, name) DO NOTHING;

-- =====================================================
-- PROPERTY LISTINGS - INDUSTRIAL
-- =====================================================

INSERT INTO property_listings (name, description, property_type, category, district_id, base_price, clean_money_required, min_level, base_income_per_hour, base_storage_capacity, base_heat_reduction, upgrade_slots, vehicle_slots, can_store_vehicles, can_manufacture) VALUES
  -- Scarborough - Industrial zone
  ('Port Lands Warehouse', 'Massive warehouse near the port.', 'warehouse', 'industrial', 3, 550000, 100000, 6, 200, 300, 0, 4, 6, TRUE, FALSE),
  ('Scarborough Garage', 'Full-service auto repair shop.', 'garage', 'industrial', 3, 280000, 50000, 4, 150, 50, 0, 3, 8, TRUE, FALSE),
  ('Eastern Docks Access', 'Private dock access for boats and shipments.', 'dock_access', 'industrial', 3, 900000, 300000, 9, 400, 150, 0, 4, 4, TRUE, FALSE),

  -- Etobicoke
  ('Kipling Warehouse', 'Industrial warehouse with loading bays.', 'warehouse', 'industrial', 5, 480000, 75000, 5, 180, 250, 0, 4, 5, TRUE, FALSE),
  ('QEW Factory', 'Manufacturing facility with equipment.', 'factory', 'industrial', 5, 1800000, 500000, 12, 500, 200, 0, 5, 3, FALSE, TRUE),

  -- North York
  ('Downsview Warehouse', 'Secure warehouse in industrial park.', 'warehouse', 'industrial', 6, 420000, 50000, 5, 160, 220, 0, 4, 4, TRUE, FALSE),
  ('Wilson Garage', 'Auto body shop with paint booth.', 'garage', 'industrial', 6, 320000, 75000, 5, 180, 60, 0, 3, 10, TRUE, FALSE),

  -- York
  ('Junction Factory', 'Old factory converted for modern use.', 'factory', 'industrial', 4, 1500000, 400000, 10, 450, 180, 0, 5, 2, FALSE, TRUE),
  ('Weston Warehouse', 'No-frills warehouse space.', 'warehouse', 'industrial', 4, 350000, 25000, 4, 120, 200, 0, 3, 4, TRUE, FALSE)
ON CONFLICT (district_id, name) DO NOTHING;

-- =====================================================
-- PROPERTY LISTINGS - ILLEGAL
-- =====================================================

INSERT INTO property_listings (name, description, property_type, category, district_id, base_price, clean_money_required, min_level, base_income_per_hour, base_storage_capacity, base_heat_reduction, upgrade_slots, is_hidden, can_manufacture) VALUES
  -- Various districts - illegal properties
  ('Parkdale Trap House', 'Run-down house used for drug operations.', 'trap_house', 'illegal', 8, 75000, 0, 3, 300, 25, 0, 2, TRUE, FALSE),
  ('Scarborough Trap', 'Basement operation in a quiet neighborhood.', 'trap_house', 'illegal', 3, 80000, 0, 3, 350, 30, 0, 2, TRUE, FALSE),
  ('Junction Trap', 'Hidden operation in York.', 'trap_house', 'illegal', 4, 70000, 0, 3, 280, 22, 0, 2, TRUE, FALSE),

  ('Etobicoke Chop Shop', 'Full vehicle disassembly operation.', 'chop_shop', 'illegal', 5, 350000, 50000, 6, 800, 100, 0, 4, TRUE, FALSE),
  ('Scarborough Chop Shop', 'High-volume car chopping operation.', 'chop_shop', 'illegal', 3, 320000, 25000, 5, 700, 90, 0, 3, TRUE, FALSE),

  ('Downtown Safehouse', 'Secure location to lay low.', 'safehouse', 'illegal', 1, 200000, 100000, 5, 0, 30, 25, 3, TRUE, FALSE),
  ('Kensington Safehouse', 'Hidden apartment above a shop.', 'safehouse', 'illegal', 2, 150000, 50000, 4, 0, 25, 20, 3, TRUE, FALSE),
  ('North York Safehouse', 'Suburban house with panic room.', 'safehouse', 'illegal', 6, 180000, 75000, 5, 0, 35, 22, 3, TRUE, FALSE),

  ('Underground Bunker', 'Secret underground facility. Completely off the grid.', 'underground_bunker', 'illegal', 3, 2500000, 1000000, 15, 0, 200, 50, 5, TRUE, TRUE)
ON CONFLICT (district_id, name) DO NOTHING;

-- =====================================================
-- PROPERTY UPGRADE TYPES - SECURITY
-- =====================================================

INSERT INTO property_upgrade_types (name, description, category, applicable_categories, cost, monthly_cost, min_level, effects, install_time_hours, icon) VALUES
  ('Basic Alarm System', 'Simple alarm that alerts you to break-ins.', 'security', ARRAY['residential', 'commercial', 'industrial'], 5000, 0, 1, '{"raid_resistance": 10, "alert_on_raid": true}', 2, '🚨'),
  ('Security Camera System', 'CCTV coverage of all entry points.', 'security', ARRAY['residential', 'commercial', 'industrial'], 15000, 0, 3, '{"raid_resistance": 20, "see_attacker_info": true}', 4, '📹'),
  ('Armed Security Guard', 'Professional armed guard on-site.', 'security', ARRAY['commercial', 'industrial', 'illegal'], 0, 1500, 5, '{"raid_resistance": 35, "guard_combat": true}', 0, '💂'),
  ('Guard Dog', 'Trained attack dog for security.', 'security', ARRAY['residential', 'industrial', 'illegal'], 3000, 200, 3, '{"raid_resistance": 15, "detection_bonus": 10}', 1, '🐕'),
  ('Panic Room', 'Fortified room to protect valuables during raids.', 'security', ARRAY['residential', 'commercial'], 100000, 0, 8, '{"raid_resistance": 25, "protect_inventory_percent": 50}', 48, '🚪'),
  ('Anti-Police Tech', 'Scanner jammers and evidence disposal system.', 'security', ARRAY['illegal'], 75000, 500, 10, '{"heat_reduction_bonus": 10, "evidence_destruction": true}', 24, '📡'),
  ('Reinforced Doors', 'Steel doors that slow down raiders.', 'security', ARRAY['residential', 'commercial', 'industrial', 'illegal'], 8000, 0, 2, '{"raid_resistance": 12, "raid_delay_minutes": 5}', 8, '🚧'),
  ('Safe Room', 'Hidden room for cash and valuables.', 'security', ARRAY['residential', 'illegal'], 50000, 0, 6, '{"hidden_storage": 50, "protect_cash_percent": 75}', 24, '🔐')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PROPERTY UPGRADE TYPES - INCOME
-- =====================================================

INSERT INTO property_upgrade_types (name, description, category, applicable_categories, cost, monthly_cost, min_level, effects, install_time_hours, icon) VALUES
  ('Basic Renovations', 'Fresh paint and modern fixtures.', 'income', ARRAY['residential', 'commercial'], 25000, 0, 2, '{"income_multiplier": 1.25}', 48, '🎨'),
  ('Premium Fixtures', 'High-end finishes throughout.', 'income', ARRAY['residential', 'commercial'], 50000, 0, 4, '{"income_multiplier": 1.5, "influence_bonus": 5}', 72, '✨'),
  ('VIP Section', 'Exclusive area for high-rollers.', 'income', ARRAY['commercial'], 100000, 0, 7, '{"income_multiplier": 2.0, "influence_bonus": 15}', 96, '👑'),
  ('Automation System', 'Reduce staff costs with smart systems.', 'income', ARRAY['commercial', 'industrial'], 75000, 0, 6, '{"staff_cost_reduction": 0.5, "income_multiplier": 1.1}', 48, '🤖'),
  ('Luxury Upgrades', 'Top-tier luxury throughout.', 'income', ARRAY['residential'], 150000, 0, 10, '{"income_multiplier": 1.75, "influence_bonus": 20}', 120, '💎'),
  ('Commercial Kitchen', 'Professional kitchen upgrade.', 'income', ARRAY['commercial'], 80000, 0, 5, '{"income_multiplier": 1.4}', 72, '👨‍🍳')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PROPERTY UPGRADE TYPES - STORAGE
-- =====================================================

INSERT INTO property_upgrade_types (name, description, category, applicable_categories, cost, monthly_cost, min_level, effects, install_time_hours, icon) VALUES
  ('Basement Extension', 'Dig out more basement space.', 'storage', ARRAY['residential', 'commercial'], 20000, 0, 3, '{"storage_bonus": 50}', 168, '⬇️'),
  ('Hidden Compartments', 'Secret hiding spots throughout.', 'storage', ARRAY['residential', 'illegal'], 30000, 0, 4, '{"hidden_storage": 25, "raid_proof_storage": true}', 48, '🔍'),
  ('Industrial Vault', 'Bank-grade vault installation.', 'storage', ARRAY['commercial', 'industrial'], 100000, 0, 8, '{"storage_bonus": 100, "protect_cash_percent": 90}', 96, '🏦'),
  ('Garage Extension', 'Additional garage bays.', 'storage', ARRAY['residential', 'industrial'], 40000, 0, 5, '{"vehicle_slots_bonus": 2, "storage_bonus": 30}', 72, '🚗'),
  ('Warehouse Expansion', 'Additional warehouse space.', 'storage', ARRAY['industrial'], 60000, 0, 6, '{"storage_bonus": 150}', 120, '📦'),
  ('Underground Storage', 'Secret underground storage area.', 'storage', ARRAY['illegal'], 80000, 0, 7, '{"hidden_storage": 75, "raid_proof_storage": true}', 168, '🕳️')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PROPERTY UPGRADE TYPES - OPERATIONS
-- =====================================================

INSERT INTO property_upgrade_types (name, description, category, applicable_categories, cost, monthly_cost, min_level, effects, install_time_hours, icon) VALUES
  ('Back Office', 'Private office for business operations.', 'operations', ARRAY['commercial'], 40000, 0, 4, '{"enable_laundering": true, "laundering_fee_reduction": 0.05}', 24, '🏢'),
  ('Loading Bay', 'Dedicated loading dock for shipments.', 'operations', ARRAY['industrial', 'commercial'], 60000, 0, 5, '{"smuggling_speed_bonus": 1.5, "storage_bonus": 30}', 72, '🚛'),
  ('Lab Equipment', 'Professional laboratory setup.', 'operations', ARRAY['industrial', 'illegal'], 150000, 500, 8, '{"enable_manufacturing": true, "product_quality_bonus": 1.25}', 96, '🧪'),
  ('Counterfeiting Press', 'High-quality printing equipment.', 'operations', ARRAY['industrial', 'illegal'], 200000, 0, 10, '{"enable_counterfeiting": true}', 48, '🖨️'),
  ('Vehicle Lift', 'Professional vehicle lift system.', 'operations', ARRAY['industrial'], 25000, 0, 4, '{"vehicle_work_speed": 1.5}', 24, '🔧'),
  ('Cold Storage', 'Temperature controlled storage.', 'operations', ARRAY['industrial', 'commercial'], 35000, 200, 5, '{"product_preservation": true, "storage_bonus": 40}', 48, '❄️')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PROPERTY UPGRADE TYPES - SPECIAL
-- =====================================================

INSERT INTO property_upgrade_types (name, description, category, applicable_categories, cost, monthly_cost, min_level, effects, install_time_hours, icon) VALUES
  ('Helipad', 'Private helipad access.', 'special', ARRAY['residential'], 500000, 1000, 15, '{"instant_travel": true, "prestige_bonus": 50}', 168, '🚁'),
  ('Private Pool', 'Luxury swimming pool.', 'special', ARRAY['residential'], 75000, 200, 8, '{"influence_bonus": 10, "income_multiplier": 1.1}', 120, '🏊'),
  ('Home Theater', 'Professional cinema room.', 'special', ARRAY['residential'], 50000, 0, 6, '{"influence_bonus": 8}', 48, '🎬'),
  ('Wine Cellar', 'Temperature controlled wine storage.', 'special', ARRAY['residential', 'commercial'], 30000, 0, 5, '{"influence_bonus": 5, "storage_bonus": 20}', 72, '🍷'),
  ('Crew Meeting Room', 'Secure room for crew operations.', 'special', ARRAY['residential', 'commercial'], 60000, 0, 7, '{"crew_hq_bonus": true, "planning_bonus": 1.2}', 48, '🤝'),
  ('Escape Tunnel', 'Secret underground escape route.', 'special', ARRAY['illegal', 'residential'], 120000, 0, 10, '{"escape_chance": 0.9, "raid_escape": true}', 240, '🚇')
ON CONFLICT (name) DO NOTHING;
