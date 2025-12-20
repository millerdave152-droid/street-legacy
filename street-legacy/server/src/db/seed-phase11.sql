-- Phase 11: PVP Combat and Bounty System Seed Data

-- ============================================
-- INJURY TYPES
-- ============================================

INSERT INTO injury_types (name, type_code, description, severity, base_heal_minutes, effects, icon) VALUES
-- Severity 1: Minor injuries
('Bruised Ribs', 'bruised_ribs', 'Painful but not serious. Movement is slightly impaired.', 1, 15, '{"defense": -2, "evasion": -5}', '🩹'),
('Black Eye', 'black_eye', 'Swollen eye affects your vision slightly.', 1, 10, '{"accuracy": -5}', '👁️'),
('Split Lip', 'split_lip', 'Painful cut that makes talking difficult.', 1, 10, '{"influence": -5}', '👄'),
('Sprained Wrist', 'sprained_wrist', 'Weak grip affects weapon handling.', 1, 20, '{"attack": -3}', '✋'),

-- Severity 2: Moderate injuries
('Cracked Rib', 'cracked_rib', 'Every breath hurts. Movement is significantly impaired.', 2, 45, '{"defense": -5, "evasion": -10, "stamina_regen": -20}', '🦴'),
('Concussion', 'concussion', 'Head trauma causes dizziness and confusion.', 2, 60, '{"accuracy": -15, "evasion": -10, "focus_regen": -30}', '🤕'),
('Deep Laceration', 'deep_laceration', 'Bleeding wound that needs attention.', 2, 30, '{"health_regen": -50, "max_health": -10}', '🩸'),
('Dislocated Shoulder', 'dislocated_shoulder', 'Arm is nearly useless until reset.', 2, 40, '{"attack": -10, "accuracy": -10}', '💪'),

-- Severity 3: Serious injuries
('Broken Arm', 'broken_arm', 'Fractured bone requires time to heal properly.', 3, 120, '{"attack": -20, "accuracy": -15, "defense": -5}', '🦴'),
('Broken Leg', 'broken_leg', 'Can barely walk. Forget about running.', 3, 180, '{"evasion": -30, "movement_speed": -50}', '🦵'),
('Internal Bleeding', 'internal_bleeding', 'Serious condition requiring immediate rest.', 3, 90, '{"max_health": -25, "health_regen": -75, "stamina_regen": -50}', '🩸'),
('Severe Concussion', 'severe_concussion', 'Major head trauma. Everything is difficult.', 3, 120, '{"accuracy": -25, "evasion": -20, "focus_max": -30}', '🧠'),

-- Severity 4: Critical injuries
('Punctured Lung', 'punctured_lung', 'Every breath is agony. Medical attention required.', 4, 240, '{"max_health": -40, "stamina_max": -50, "evasion": -25}', '🫁'),
('Shattered Kneecap', 'shattered_kneecap', 'Mobility severely compromised.', 4, 300, '{"evasion": -50, "movement_speed": -75, "defense": -15}', '🦴'),
('Severe Blood Loss', 'severe_blood_loss', 'Critical condition. Need blood transfusion.', 4, 180, '{"max_health": -50, "attack": -20, "defense": -20, "stamina_max": -40}', '💉'),

-- Severity 5: Near-death injuries
('Multiple Organ Failure', 'organ_failure', 'Hovering between life and death.', 5, 480, '{"max_health": -70, "attack": -40, "defense": -40, "stamina_max": -60}', '☠️'),
('Traumatic Brain Injury', 'brain_injury', 'Severe neurological damage.', 5, 600, '{"accuracy": -50, "evasion": -40, "focus_max": -50, "influence": -30}', '🧠'),
('Gunshot Wound (Critical)', 'critical_gunshot', 'Bullet lodged near vital organs.', 5, 360, '{"max_health": -60, "movement_speed": -80, "attack": -30}', '🔫');

-- ============================================
-- HOSPITAL SERVICES
-- ============================================

INSERT INTO hospital_services (name, description, service_type, base_cost, heal_time_reduction, min_severity, max_severity, is_legal, requires_level, icon) VALUES
-- Legal hospital services
('Emergency Room Visit', 'Standard ER treatment. Questions asked, records kept.', 'emergency', 500, 30, 1, 3, true, 1, '🏥'),
('Priority Care', 'Skip the line with premium insurance.', 'priority', 2000, 50, 1, 4, true, 5, '⚕️'),
('Intensive Care Unit', 'Full medical team for critical injuries.', 'icu', 10000, 70, 3, 5, true, 10, '🏨'),
('Physical Therapy', 'Accelerate recovery from bone injuries.', 'therapy', 1500, 40, 2, 4, true, 5, '💪'),
('Surgery', 'Surgical intervention for serious injuries.', 'surgery', 5000, 60, 3, 5, true, 15, '🔪'),

-- Black market medical services
('Back Alley Doc', 'No questions, no records. Cash only.', 'black_market', 1000, 40, 1, 3, false, 3, '🩺'),
('Underground Clinic', 'Professional equipment, no paper trail.', 'black_market', 3000, 55, 2, 4, false, 10, '💊'),
('Mob Doctor', 'The best illegal medicine money can buy.', 'mob_doctor', 8000, 75, 3, 5, false, 20, '🏴'),
('Combat Stims', 'Get back in the fight fast. Side effects may occur.', 'stimulants', 2500, 80, 1, 2, false, 8, '💉'),
('Experimental Treatment', 'Cutting edge, completely illegal.', 'experimental', 15000, 85, 4, 5, false, 25, '🧪');

-- ============================================
-- HITMEN NPCs
-- ============================================

INSERT INTO hitmen (name, description, skill_level, attack, defense, accuracy, success_rate, price_multiplier, min_bounty_amount, icon) VALUES
('Street Punk', 'Amateur looking to make a name. Cheap but unreliable.', 1, 15, 10, 40, 30, 0.8, 2000, '🔪'),
('Local Enforcer', 'Does dirty work for the neighborhood gangs.', 2, 25, 20, 55, 45, 1.0, 5000, '👊'),
('Professional Hitter', 'Clean, efficient, experienced. Gets the job done.', 3, 40, 30, 70, 60, 1.5, 10000, '🎯'),
('Cartel Sicario', 'Trained killer from south of the border.', 4, 55, 40, 80, 75, 2.0, 25000, '💀'),
('Ghost', 'Nobody knows their real name. 100% success rate... until now.', 5, 75, 55, 95, 90, 3.0, 50000, '👻');

-- ============================================
-- BODYGUARD TYPES
-- ============================================

-- Note: These are templates, actual bodyguards are created in player_bodyguards
-- We'll reference these types in the code

-- ============================================
-- SAFE ZONES
-- ============================================

INSERT INTO safe_zones (name, zone_type, district_id, description) VALUES
('Central Hospital', 'hospital', 1, 'Medical facility - violence not tolerated'),
('City Hall', 'government', 1, 'Government building with heavy security'),
('Police Headquarters', 'police', 1, 'Attacking here would be suicide'),
('Federal Courthouse', 'government', 2, 'Federal marshals everywhere'),
('International Airport', 'transit', 3, 'TSA and airport police patrol constantly'),
('Major Shopping Mall', 'commercial', 4, 'Too many witnesses and security'),
('University Campus', 'education', 5, 'Campus police and too many students'),
('Embassy Row', 'diplomatic', 6, 'International incident waiting to happen');

-- ============================================
-- DEFAULT COMBAT BUFFS (Templates)
-- ============================================

-- These are examples of buff types that can be applied
-- Actual buffs are created dynamically

-- Crew Backup: +10 attack, +10 defense when crew members nearby
-- Adrenaline Rush: +20% damage for 5 minutes after kill
-- Defensive Stance: +25 defense, -10 attack for combat duration
-- Berserker: +30 attack, -15 defense, -10 accuracy
-- Sharp Shooter: +25 accuracy, -5 evasion
-- Pain Killers: Ignore injury effects for 30 minutes
-- Liquid Courage: +15 attack, -10 accuracy (alcohol)
