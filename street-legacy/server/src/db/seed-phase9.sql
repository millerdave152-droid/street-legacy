-- Phase 9: Legal Business Fronts and Money Laundering Seed Data

-- Business Front Types
INSERT INTO business_front_types (name, type_code, description, base_setup_cost, monthly_expenses, base_laundering_rate, max_daily_laundering, min_legitimacy, required_property_types, employee_slots, base_employee_cost, tax_rate, audit_risk_multiplier, required_level, required_connections, icon) VALUES
-- Cash-Heavy Retail
('Convenience Store', 'convenience_store', 'A small corner store dealing primarily in cash transactions. Low profile, low throughput.', 25000, 3000, 2500, 5000, 0, '{corner_store}', 3, 800, 12.00, 0.8, 3, 0, '🏪'),
('Laundromat', 'laundromat', 'Ironic but effective. Coin-operated machines mean lots of cash and few questions.', 40000, 2500, 3500, 7500, 0, '{corner_store,warehouse}', 2, 600, 10.00, 0.7, 5, 0, '🧺'),
('Pawn Shop', 'pawn_shop', 'Buy low, sell high, and move some cash through the register.', 50000, 4000, 4000, 10000, 20, '{corner_store,strip_mall}', 4, 900, 15.00, 1.1, 8, 100, '💎'),

-- Restaurant/Bar
('Diner', 'diner', 'Classic American diner. Good food, better books.', 75000, 8000, 5000, 10000, 10, '{corner_store,restaurant}', 8, 1200, 15.00, 0.9, 5, 0, '🍳'),
('Bar', 'bar', 'Neighborhood watering hole. Cash bar means cash flow.', 100000, 10000, 7500, 15000, 20, '{restaurant,nightclub}', 6, 1500, 18.00, 1.0, 10, 200, '🍺'),
('Upscale Restaurant', 'restaurant', 'Fine dining establishment. Higher class, higher throughput.', 200000, 25000, 10000, 25000, 40, '{restaurant}', 15, 2000, 20.00, 1.2, 15, 500, '🍽️'),
('Nightclub', 'nightclub', 'The party never stops, and neither does the cash flow.', 350000, 40000, 15000, 35000, 50, '{nightclub}', 20, 2500, 22.00, 1.3, 20, 750, '🎉'),

-- High-Volume Operations
('Used Car Lot', 'car_dealership', 'Buy cars for cash, sell for more cash. Simple math.', 500000, 30000, 25000, 50000, 60, '{warehouse,distribution_center}', 10, 3000, 18.00, 1.5, 25, 1000, '🚗'),
('Auto Body Shop', 'body_shop', 'Fix cars, modify titles, move money.', 300000, 20000, 15000, 30000, 40, '{warehouse}', 8, 2500, 15.00, 1.2, 18, 500, '🔧'),
('Construction Company', 'construction', 'Big projects mean big invoices. Easy to inflate.', 750000, 50000, 35000, 75000, 70, '{warehouse,factory}', 25, 3500, 20.00, 1.4, 30, 1500, '🏗️'),

-- Premium Operations
('Real Estate Agency', 'real_estate', 'Buy, sell, and launder through property transactions.', 1000000, 35000, 50000, 100000, 75, '{office_building,strip_mall}', 12, 5000, 25.00, 1.6, 35, 2000, '🏢'),
('Art Gallery', 'art_gallery', 'Art is subjective. So is its value. Perfect for moving money.', 800000, 25000, 40000, 80000, 70, '{office_building,penthouse}', 6, 4000, 20.00, 1.3, 30, 1500, '🎨'),
('Import/Export Company', 'import_export', 'International trade, international money movement.', 1500000, 75000, 75000, 150000, 80, '{warehouse,port_facility,distribution_center}', 20, 4500, 22.00, 1.8, 40, 3000, '🚢'),

-- Elite Operations
('Casino', 'casino', 'The ultimate cash business. Massive throughput, massive scrutiny.', 5000000, 200000, 100000, 250000, 90, '{nightclub,underground_bunker}', 50, 6000, 30.00, 2.0, 50, 5000, '🎰'),
('Crypto Exchange', 'crypto_exchange', 'Turn dirty cash into clean crypto. The future of laundering.', 2000000, 50000, 50000, 500000, 85, '{office_building}', 15, 8000, 15.00, 1.5, 45, 4000, '₿'),
('Private Bank', 'private_bank', 'For the discerning criminal who wants white glove service.', 10000000, 500000, 200000, 1000000, 95, '{office_building}', 30, 10000, 25.00, 2.5, 60, 10000, '🏦')
ON CONFLICT DO NOTHING;

-- Business event templates
CREATE TABLE IF NOT EXISTS business_event_templates (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  applicable_business_types TEXT[] DEFAULT '{}',
  title VARCHAR(100) NOT NULL,
  description TEXT,
  choices JSONB NOT NULL,
  probability DECIMAL(5,4) DEFAULT 0.01,
  min_legitimacy INTEGER DEFAULT 0,
  max_legitimacy INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO business_event_templates (event_type, applicable_business_types, title, description, choices, probability, min_legitimacy, max_legitimacy) VALUES
-- Health/Safety Events
('health_inspector', '{diner,bar,restaurant,nightclub,convenience_store}', 'Health Inspector Visit', 'A health inspector has arrived for a surprise inspection.', '[{"id": "bribe", "text": "Slip them $500", "cost": 500, "success_rate": 70, "legitimacy_change": -5, "outcome_success": "The inspector leaves satisfied.", "outcome_fail": "They report the bribe attempt. -15 legitimacy."}, {"id": "comply", "text": "Allow full inspection", "cost": 0, "success_rate": 50, "legitimacy_change": 5, "outcome_success": "You pass with flying colors. +5 legitimacy.", "outcome_fail": "Several violations found. $2000 fine."}, {"id": "delay", "text": "Ask them to come back tomorrow", "cost": 0, "success_rate": 30, "legitimacy_change": 0, "outcome_success": "They agree to reschedule.", "outcome_fail": "They insist on inspecting now. -3 legitimacy."}]', 0.02, 0, 100),

('difficult_customer', '{diner,bar,restaurant,convenience_store,pawn_shop}', 'Difficult Customer', 'A customer is causing a scene and demanding a refund.', '[{"id": "refund", "text": "Give full refund", "cost": 100, "success_rate": 90, "legitimacy_change": 2, "outcome_success": "Customer leaves satisfied.", "outcome_fail": "They still leave a bad review."}, {"id": "argue", "text": "Stand your ground", "cost": 0, "success_rate": 40, "legitimacy_change": -2, "outcome_success": "Other customers respect your firmness.", "outcome_fail": "Scene escalates. Bad for business."}, {"id": "security", "text": "Have them removed", "cost": 0, "success_rate": 80, "legitimacy_change": -3, "outcome_success": "Problem solved.", "outcome_fail": "They threaten to sue."}]', 0.05, 0, 100),

('fire_inspection', '{all}', 'Fire Marshal Inspection', 'The fire marshal is conducting a safety inspection.', '[{"id": "bribe", "text": "Offer a donation to their charity", "cost": 1000, "success_rate": 60, "legitimacy_change": -3, "outcome_success": "They appreciate your generosity.", "outcome_fail": "They dont take kindly to the implication."}, {"id": "comply", "text": "Full cooperation", "cost": 0, "success_rate": 60, "legitimacy_change": 3, "outcome_success": "All clear! +3 legitimacy.", "outcome_fail": "Multiple violations. $3000 in required upgrades."}]', 0.015, 0, 100),

-- Employee Events
('employee_theft', '{all}', 'Employee Caught Stealing', 'You catch an employee pocketing cash from the register.', '[{"id": "fire", "text": "Fire them immediately", "cost": 0, "success_rate": 100, "legitimacy_change": 0, "outcome_success": "Employee terminated.", "outcome_fail": ""}, {"id": "warning", "text": "Give them a warning", "cost": 0, "success_rate": 50, "legitimacy_change": 0, "outcome_success": "They shape up.", "outcome_fail": "They steal again. Bigger loss."}, {"id": "criminal", "text": "Threaten to expose their theft", "cost": 0, "success_rate": 70, "legitimacy_change": -5, "outcome_success": "They become very loyal (and scared).", "outcome_fail": "They quit and might talk."}]', 0.03, 0, 100),

('employee_suspicious', '{all}', 'Suspicious Employee', 'An employee is asking too many questions about the books.', '[{"id": "fire", "text": "Let them go", "cost": 2000, "success_rate": 100, "legitimacy_change": 0, "outcome_success": "Problem eliminated.", "outcome_fail": ""}, {"id": "promote", "text": "Promote them (keep friends close)", "cost": 5000, "success_rate": 60, "legitimacy_change": 0, "outcome_success": "Now they have a stake in the business.", "outcome_fail": "They report to authorities anyway."}, {"id": "bribe", "text": "Cut them in on the action", "cost": 0, "success_rate": 70, "legitimacy_change": -10, "outcome_success": "New partner in crime.", "outcome_fail": "They want too much. Might be a plant."}]', 0.02, 0, 70),

-- Business Opportunity Events
('bulk_cash_offer', '{laundromat,convenience_store,pawn_shop}', 'Bulk Cash Opportunity', 'Someone offers to buy gift cards with a large amount of cash.', '[{"id": "accept", "text": "Accept the deal", "cost": 0, "success_rate": 70, "legitimacy_change": -5, "outcome_success": "$5000 profit, but suspicious.", "outcome_fail": "Its a sting operation. Investigation started."}, {"id": "decline", "text": "Politely decline", "cost": 0, "success_rate": 100, "legitimacy_change": 2, "outcome_success": "You stay clean.", "outcome_fail": ""}]', 0.025, 0, 60),

('celebrity_visit', '{restaurant,nightclub,bar,art_gallery}', 'Celebrity Sighting', 'A local celebrity wants to host an event at your establishment.', '[{"id": "accept", "text": "Welcome them", "cost": 5000, "success_rate": 80, "legitimacy_change": 10, "outcome_success": "Great publicity! +10 legitimacy, +20 reputation.", "outcome_fail": "Event goes poorly. Mixed reviews."}, {"id": "decline", "text": "Too risky", "cost": 0, "success_rate": 100, "legitimacy_change": 0, "outcome_success": "Business as usual.", "outcome_fail": ""}]', 0.01, 30, 100),

-- Authority Events
('irs_letter', '{all}', 'Letter from the IRS', 'You receive an official-looking letter from the IRS requesting documentation.', '[{"id": "comply", "text": "Provide all documents", "cost": 500, "success_rate": 70, "legitimacy_change": 5, "outcome_success": "Routine inquiry satisfied.", "outcome_fail": "They want to dig deeper. Audit scheduled."}, {"id": "lawyer", "text": "Have attorney respond", "cost": 2000, "success_rate": 85, "legitimacy_change": 0, "outcome_success": "Handled professionally.", "outcome_fail": "Delays but doesnt prevent scrutiny."}, {"id": "ignore", "text": "Ignore it", "cost": 0, "success_rate": 20, "legitimacy_change": -10, "outcome_success": "It was just a form letter.", "outcome_fail": "Bad move. Investigation opened."}]', 0.03, 0, 100),

('police_questions', '{pawn_shop,body_shop,car_dealership}', 'Police Inquiry', 'Detectives are asking about a recent transaction.', '[{"id": "cooperate", "text": "Answer all questions", "cost": 0, "success_rate": 60, "legitimacy_change": 5, "outcome_success": "Theyre satisfied with your answers.", "outcome_fail": "Your answers raised more questions."}, {"id": "lawyer", "text": "Refer them to your attorney", "cost": 1000, "success_rate": 80, "legitimacy_change": -2, "outcome_success": "Professional distance maintained.", "outcome_fail": "They note your reluctance."}, {"id": "lie", "text": "Claim no knowledge", "cost": 0, "success_rate": 40, "legitimacy_change": -5, "outcome_success": "They buy it.", "outcome_fail": "They know youre lying. Investigation opened."}]', 0.02, 0, 80)
ON CONFLICT DO NOTHING;

-- Tax attorney NPCs
CREATE TABLE IF NOT EXISTS attorney_npcs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tier INTEGER NOT NULL,
  description TEXT,
  monthly_retainer INTEGER NOT NULL,
  audit_reduction_percent INTEGER NOT NULL,
  investigation_help_percent INTEGER NOT NULL,
  max_clients INTEGER DEFAULT 10,
  current_clients INTEGER DEFAULT 0,
  min_legitimacy INTEGER DEFAULT 0,
  required_level INTEGER DEFAULT 1,
  icon VARCHAR(10) DEFAULT '👔'
);

INSERT INTO attorney_npcs (name, tier, description, monthly_retainer, audit_reduction_percent, investigation_help_percent, max_clients, min_legitimacy, required_level, icon) VALUES
('Jimmy "The Fixer" Novak', 1, 'A strip mall lawyer who knows which palms to grease.', 2500, 15, 10, 20, 0, 5, '👔'),
('Sarah Chen, Esq.', 2, 'Former IRS agent turned defense attorney. Knows the system.', 7500, 30, 25, 10, 30, 15, '👩‍⚖️'),
('Victoria Sterling III', 3, 'Old money attorney with connections everywhere.', 25000, 50, 45, 5, 60, 30, '🎩'),
('The Bishop', 3, 'Nobody knows his real name. 100% success rate on serious cases.', 100000, 70, 65, 2, 80, 50, '♟️')
ON CONFLICT DO NOTHING;
