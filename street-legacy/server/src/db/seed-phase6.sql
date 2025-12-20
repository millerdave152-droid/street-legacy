-- =====================================================
-- PHASE 6 SEED DATA: ALWAYS-AVAILABLE MISSIONS AND MICRO-ECONOMY
-- =====================================================

-- =====================================================
-- POINTS OF INTEREST
-- =====================================================

INSERT INTO points_of_interest (district_id, name, type, description) VALUES
  -- Downtown Core (district 1)
  (1, 'The Underground', 'bar', 'A dive bar with a reputation for shady dealings'),
  (1, 'Legal Eagles LLP', 'office', 'A law firm known for defending criminals'),
  (1, 'Midnight Garage', 'garage', 'A 24-hour auto shop that asks no questions'),
  (1, 'The Velvet Room', 'club', 'An exclusive club for the criminal elite'),

  -- Kensington Market (district 2)
  (2, 'The Pawn Broker', 'market', 'A cluttered shop that buys anything'),
  (2, 'Herbal Remedies', 'clinic', 'A back-alley clinic with alternative treatments'),
  (2, 'Market Corner', 'street_corner', 'The busiest corner for street deals'),

  -- Scarborough (district 3)
  (3, 'The Loading Dock', 'docks', 'Where shipments come and go'),
  (3, 'Big Mikes Warehouse', 'warehouse', 'A storage facility with flexible rules'),
  (3, 'The Pit', 'bar', 'A rough bar for rough people'),

  -- York (district 4)
  (4, 'The Safe House', 'safehouse', 'A nondescript building for laying low'),
  (4, 'Connors Garage', 'garage', 'Specializes in vehicle modifications'),
  (4, 'The Info Desk', 'office', 'An information broker operation'),

  -- Etobicoke (district 5)
  (5, 'Lake Shore Docks', 'docks', 'Waterfront operations'),
  (5, 'The Country Club', 'club', 'Where business meets pleasure'),
  (5, 'Westside Medical', 'clinic', 'Discreet medical services'),

  -- North York (district 6)
  (6, 'The Tech Hub', 'office', 'A front for digital operations'),
  (6, 'Night Owl Market', 'market', 'Open all night for those who work late'),
  (6, 'The Bunker', 'warehouse', 'A fortified storage location'),

  -- East York (district 7)
  (7, 'Dannys Corner', 'street_corner', 'A well-known meeting spot'),
  (7, 'The Chop Shop', 'garage', 'Where hot cars go to disappear'),
  (7, 'Recovery Room', 'safehouse', 'A place to heal up'),

  -- Parkdale (district 8)
  (8, 'The Rusty Anchor', 'bar', 'Cheap drinks, no questions'),
  (8, 'Street Doc', 'clinic', 'Emergency medical for those who cant go to hospitals'),
  (8, 'The Corner Store', 'market', 'Sells more than groceries')
ON CONFLICT (district_id, name) DO NOTHING;

-- =====================================================
-- NPC CONTACTS
-- =====================================================

INSERT INTO npcs (name, type, district_id, trust_level_required, dialogue, available_missions, avatar_emoji, description, cut_percentage) VALUES
  -- FIXERS (connect you to jobs)
  ('Marcus "The Connect" Johnson', 'fixer', 1, 0,
   '{"greeting": "You looking for work? I got work.", "low_trust": "Prove yourself first, then we talk bigger jobs.", "high_trust": "My best earner! Got something special for you."}',
   '[{"type": "crime", "difficulty_range": [1, 5]}, {"type": "delivery", "difficulty_range": [1, 3]}]',
   '🔗', 'The go-to fixer downtown. He knows everyone and has a job for every skill level.', 15),

  ('Elena "Whisper" Vega', 'fixer', 3, 20,
   '{"greeting": "Keep your voice down. What do you need?", "low_trust": "I dont work with strangers.", "high_trust": "I have something delicate that needs handling."}',
   '[{"type": "steal", "difficulty_range": [3, 7]}, {"type": "investigate", "difficulty_range": [2, 5]}]',
   '🤫', 'A mysterious fixer who specializes in quiet operations. Works out of Scarborough.', 20),

  ('Big Sal', 'fixer', 5, 35,
   '{"greeting": "What can Big Sal do for ya?", "low_trust": "Come back when you got more experience.", "high_trust": "You earned this. Big money, big risk."}',
   '[{"type": "intimidate", "difficulty_range": [5, 10]}, {"type": "escort", "difficulty_range": [4, 8]}]',
   '💪', 'A heavyweight fixer in Etobicoke. Handles the rough stuff.', 12),

  -- FENCES (buy stolen goods)
  ('Raymond "The Rat" Chen', 'fence', 2, 0,
   '{"greeting": "What you got for me today?", "low_trust": "I buy low from newcomers. Build trust, get better prices.", "high_trust": "For you? Premium rates. You bring quality."}',
   '[]',
   '🐀', 'A fence in Kensington Market. He will buy anything, but his prices depend on your relationship.', 0),

  ('Sofia "Silk" Marconi', 'fence', 1, 30,
   '{"greeting": "Ah, let me see what treasures you bring.", "low_trust": "Beautiful items deserve beautiful trust.", "high_trust": "For my favorite supplier, only the best prices."}',
   '[]',
   '🧵', 'A high-end fence downtown. She specializes in jewelry and art.', 0),

  -- INFORMANTS (sell info)
  ('Tommy "Eyes" Malone', 'informant', 4, 10,
   '{"greeting": "I see things. You want to know things?", "low_trust": "Information costs, and you aint earned a discount.", "high_trust": "Special intel just for you. Nobody else knows this."}',
   '[]',
   '👀', 'An informant in York. He has eyes everywhere and information on everyone.', 0),

  ('Jade "Network" Liu', 'informant', 6, 25,
   '{"greeting": "Data flows through me.", "low_trust": "Access level: Basic. Upgrade your clearance.", "high_trust": "Full database access granted. What do you need to know?"}',
   '[]',
   '🌐', 'A digital informant in North York. She can find any information online.', 0),

  -- SUPPLIERS (equipment, weapons, vehicles)
  ('Viktor "The Provider" Petrov', 'supplier', 3, 15,
   '{"greeting": "You need equipment? Viktor provides.", "low_trust": "Basic stock for basic customers.", "high_trust": "Special inventory, just for trusted friends."}',
   '[]',
   '📦', 'A supplier in Scarborough. Weapons, tools, whatever you need.', 0),

  ('Rosa "Motors" Gonzalez', 'supplier', 7, 20,
   '{"greeting": "Looking for wheels?", "low_trust": "Standard selection only.", "high_trust": "Let me show you the premium garage."}',
   '[]',
   '🚗', 'A vehicle specialist in East York. Cars, bikes, getaway vehicles.', 0),

  -- LAWYERS (reduce heat, clear investigations)
  ('David "Loophole" Sterling', 'lawyer', 1, 25,
   '{"greeting": "In legal trouble? I can help.", "low_trust": "My services require a retainer.", "high_trust": "For my valued clients, I work miracles."}',
   '[]',
   '⚖️', 'A criminal defense lawyer downtown. He knows every loophole.', 0),

  ('Patricia "The Shark" Wade', 'lawyer', 5, 40,
   '{"greeting": "They call me The Shark for a reason.", "low_trust": "Prove you are worth my time.", "high_trust": "I have never lost a case for a friend."}',
   '[]',
   '🦈', 'A notorious lawyer in Etobicoke. Expensive but effective.', 0),

  -- DOCTORS (heal injuries, no questions)
  ('Doc Wilson', 'doctor', 8, 0,
   '{"greeting": "Let me take a look at you.", "low_trust": "Standard patch job. Nothing fancy.", "high_trust": "Full treatment, priority service."}',
   '[]',
   '💊', 'A street doctor in Parkdale. He treats anyone, no questions asked.', 0),

  ('Dr. Sarah "Surgeon" Kim', 'doctor', 6, 35,
   '{"greeting": "Back again? What happened this time?", "low_trust": "Basic care only. Serious injuries require trust.", "high_trust": "I can fix anything. You are in the best hands."}',
   '[]',
   '🏥', 'A former ER surgeon in North York. Now treats the criminal elite.', 0)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- MISSION CATEGORIES
-- =====================================================

INSERT INTO mission_categories (name, description, icon, refresh_type) VALUES
  ('NPC Jobs', 'Jobs from your contacts in the criminal underworld', '🤝', 'always'),
  ('Daily Contracts', 'Fresh opportunities every day', '📅', 'daily'),
  ('Hourly Tasks', 'Quick jobs that refresh every hour', '⏰', 'hourly'),
  ('Story Missions', 'One-time campaign missions', '📖', 'one_time'),
  ('Crew Assignments', 'Tasks from your crew leadership', '👥', 'always'),
  ('Random Encounters', 'Unexpected opportunities while traveling', '🎲', 'random')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- NPC MISSIONS (from fixers)
-- =====================================================

-- Marcus "The Connect" missions
INSERT INTO npc_missions (npc_id, title, description, dialogue_intro, dialogue_success, dialogue_failure, mission_type, min_level, min_trust, stamina_cost, focus_cost, time_minutes, base_success_rate, base_cash_reward, base_xp_reward, trust_reward, heat_generated, jail_minutes) VALUES
  ((SELECT id FROM npcs WHERE name = 'Marcus "The Connect" Johnson'), 'Package Delivery', 'Deliver a package across town, no questions asked.', 'Got a package needs delivering. Simple job, just dont look inside.', 'Clean delivery. Here is your cut.', 'You lost the package?! Get out of my sight.', 'delivery', 1, 0, 10, 5, 15, 75, 300, 50, 3, 5, 10),
  ((SELECT id FROM npcs WHERE name = 'Marcus "The Connect" Johnson'), 'Collect a Debt', 'Someone owes money. Make them pay up.', 'This guy owes me money. Go remind him to pay.', 'Good work. The money is all here.', 'You let him get away?! Useless.', 'collect', 2, 10, 15, 10, 20, 65, 500, 75, 4, 10, 15),
  ((SELECT id FROM npcs WHERE name = 'Marcus "The Connect" Johnson'), 'Warehouse Grab', 'Steal from a warehouse. Quick in, quick out.', 'I got info on a warehouse with light security. Clean it out.', 'Nice haul. You are getting good at this.', 'Caught? Amateur hour over here.', 'steal', 3, 20, 20, 15, 30, 55, 800, 100, 5, 15, 20),
  ((SELECT id FROM npcs WHERE name = 'Marcus "The Connect" Johnson'), 'Send a Message', 'Someone needs to learn a lesson.', 'This guy has been talking too much. Shut him up.', 'He will think twice before running his mouth again.', 'You couldn not handle one loudmouth?', 'intimidate', 4, 35, 25, 20, 25, 50, 1200, 150, 6, 20, 30);

-- Elena "Whisper" Vega missions
INSERT INTO npc_missions (npc_id, title, description, dialogue_intro, dialogue_success, dialogue_failure, mission_type, min_level, min_trust, stamina_cost, focus_cost, time_minutes, base_success_rate, base_cash_reward, base_xp_reward, trust_reward, heat_generated, jail_minutes) VALUES
  ((SELECT id FROM npcs WHERE name = 'Elena "Whisper" Vega'), 'Silent Extraction', 'Retrieve an item without being noticed.', 'whispers I need something retrieved. Quietly. Can you do quiet?', 'Perfect. Like a ghost. I knew I could count on you.', 'You made noise. We do not make noise.', 'steal', 3, 0, 15, 20, 25, 60, 600, 100, 4, 8, 20),
  ((SELECT id FROM npcs WHERE name = 'Elena "Whisper" Vega'), 'Gather Intel', 'Investigate a target and report back.', 'I need eyes on someone. Watch, learn, report.', 'Excellent intelligence. This is exactly what I needed.', 'You were spotted. The target knows they are being watched now.', 'investigate', 4, 15, 10, 25, 40, 55, 750, 125, 5, 5, 15),
  ((SELECT id FROM npcs WHERE name = 'Elena "Whisper" Vega'), 'Document Acquisition', 'Steal important documents from an office.', 'There are files I need. Security is tight, but you are better.', 'These documents will change everything. Thank you.', 'No documents? This was our one chance.', 'steal', 5, 30, 20, 25, 35, 45, 1500, 200, 7, 12, 35),
  ((SELECT id FROM npcs WHERE name = 'Elena "Whisper" Vega'), 'The Setup', 'Frame someone for a crime they did not commit.', 'Someone needs to take a fall. Make sure it is not us.', 'The frame is perfect. They will never know what hit them.', 'The evidence did not stick. We are exposed.', 'sabotage', 6, 50, 25, 30, 45, 40, 2500, 300, 10, 25, 45);

-- Big Sal missions
INSERT INTO npc_missions (npc_id, title, description, dialogue_intro, dialogue_success, dialogue_failure, mission_type, min_level, min_trust, stamina_cost, focus_cost, time_minutes, base_success_rate, base_cash_reward, base_xp_reward, trust_reward, heat_generated, jail_minutes) VALUES
  ((SELECT id FROM npcs WHERE name = 'Big Sal'), 'Protection Run', 'Escort a VIP safely across dangerous territory.', 'Got a friend who needs to get somewhere safe. You are his protection.', 'Delivered safe and sound. You did good, kid.', 'You lost my friend?! This is bad. Real bad.', 'escort', 5, 0, 25, 15, 35, 55, 1000, 150, 5, 15, 25),
  ((SELECT id FROM npcs WHERE name = 'Big Sal'), 'Shake Down', 'Intimidate a business owner into paying protection.', 'This shop owner forgot who runs this block. Remind him.', 'He will remember to pay on time from now on.', 'He called the cops? What kind of amateur are you?', 'intimidate', 6, 20, 30, 20, 25, 50, 1500, 200, 6, 25, 40),
  ((SELECT id FROM npcs WHERE name = 'Big Sal'), 'Heavy Lifting', 'Rob a heavily guarded location.', 'This is not for lightweights. Guards, cameras, the works.', 'Now that is how it is done! You got heart, kid.', 'You got caught on the big one. Disappointing.', 'crime', 8, 40, 40, 30, 60, 40, 5000, 500, 10, 40, 60),
  ((SELECT id FROM npcs WHERE name = 'Big Sal'), 'Send a Serious Message', 'Make an example of someone who crossed the wrong people.', 'This guy thought he could steal from us. Show everyone what happens.', 'Message received, loud and clear. Nobody will try that again.', 'You went soft? We don not go soft.', 'intimidate', 10, 60, 50, 35, 45, 35, 8000, 750, 15, 50, 90);

-- =====================================================
-- HOURLY TASKS
-- =====================================================

INSERT INTO hourly_tasks (name, description, task_type, stamina_cost, focus_cost, time_minutes, base_cash_reward, base_xp_reward, min_level) VALUES
  ('Quick Delivery', 'Run a package across the block.', 'delivery', 5, 3, 5, 100, 20, 1),
  ('Street Scout', 'Check out a location and report back.', 'scout', 5, 5, 10, 125, 25, 1),
  ('Pass a Message', 'Deliver a verbal message to a contact.', 'message', 3, 5, 5, 75, 15, 1),
  ('Quick Grab', 'Steal something small from an easy target.', 'quick_crime', 8, 5, 10, 200, 35, 2),
  ('Run an Errand', 'Pick up supplies for the crew.', 'errand', 5, 3, 15, 150, 30, 1),
  ('Corner Watch', 'Watch a corner and report any activity.', 'scout', 3, 8, 20, 175, 40, 2),
  ('Intimidation Check', 'Remind someone they owe money.', 'quick_crime', 10, 8, 10, 250, 45, 3),
  ('Information Drop', 'Pass intel to a contact in another district.', 'message', 8, 10, 15, 300, 50, 3)
ON CONFLICT DO NOTHING;

-- =====================================================
-- RANDOM ENCOUNTERS
-- =====================================================

INSERT INTO random_encounters (name, description, encounter_type, trigger_chance, trigger_context, min_level, choices, outcomes) VALUES
  ('Dropped Wallet', 'You spot a wallet on the ground.', 'opportunity', 0.05, 'travel', 1,
   '[{"id": "take", "text": "Take it"}, {"id": "return", "text": "Return it"}, {"id": "ignore", "text": "Walk away"}]',
   '{"take": {"cash": [50, 200], "heat": 2}, "return": {"trust_random_npc": 5, "xp": 25}, "ignore": {}}'),

  ('Suspicious Deal', 'You witness a deal going down in an alley.', 'opportunity', 0.03, 'travel', 2,
   '[{"id": "join", "text": "Try to join"}, {"id": "rob", "text": "Rob them"}, {"id": "leave", "text": "Walk away"}]',
   '{"join": {"cash": [100, 500], "heat": 5, "success_rate": 60}, "rob": {"cash": [200, 800], "heat": 15, "success_rate": 40}, "leave": {}}'),

  ('Police Patrol', 'A police car slows down near you.', 'danger', 0.04, 'travel', 1,
   '[{"id": "act_normal", "text": "Act normal"}, {"id": "run", "text": "Run"}, {"id": "hide", "text": "Hide"}]',
   '{"act_normal": {"heat": -3, "success_rate": 80, "fail_jail": 10}, "run": {"heat": 10, "success_rate": 60, "fail_jail": 20}, "hide": {"success_rate": 70, "fail_heat": 5}}'),

  ('Street Tip', 'A homeless person offers you information.', 'tip', 0.04, 'travel', 1,
   '[{"id": "pay", "text": "Pay $50 for info"}, {"id": "ignore", "text": "Ignore them"}]',
   '{"pay": {"cash": -50, "reveal_crime_opportunity": true, "xp": 20}, "ignore": {}}'),

  ('Ambush!', 'Someone jumps out at you!', 'ambush', 0.02, 'travel', 3,
   '[{"id": "fight", "text": "Fight back"}, {"id": "pay", "text": "Pay them off"}, {"id": "run", "text": "Try to escape"}]',
   '{"fight": {"success_rate": 50, "win_cash": [100, 300], "lose_cash_percent": 10}, "pay": {"cash_percent": -5}, "run": {"success_rate": 65, "fail_cash_percent": -10}}'),

  ('NPC Introduction', 'Someone important wants to meet you.', 'npc_meeting', 0.03, 'crime', 5,
   '[{"id": "meet", "text": "Agree to meet"}, {"id": "decline", "text": "Decline"}]',
   '{"meet": {"unlock_npc": true, "trust_bonus": 10}, "decline": {}}'),

  ('Lucky Find', 'You stumble upon a hidden stash.', 'loot', 0.02, 'travel', 1,
   '[{"id": "take", "text": "Take everything"}, {"id": "take_some", "text": "Take some"}, {"id": "leave", "text": "Leave it"}]',
   '{"take": {"cash": [200, 1000], "heat": 5, "item_chance": 20}, "take_some": {"cash": [100, 400], "heat": 2}, "leave": {}}'),

  ('Rival Crew', 'You cross paths with a rival crew member.', 'danger', 0.03, 'travel', 4,
   '[{"id": "confront", "text": "Confront them"}, {"id": "avoid", "text": "Avoid them"}, {"id": "follow", "text": "Follow them"}]',
   '{"confront": {"success_rate": 50, "win_rep": 25, "lose_rep": -15}, "avoid": {}, "follow": {"success_rate": 60, "intel_bonus": true, "fail_rep": -10}}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- REGENERATION ACTIVITIES
-- =====================================================

INSERT INTO regen_activities (name, description, activity_type, stamina_regen, focus_regen, heat_reduction, influence_gain, time_minutes, cash_cost, min_level, cooldown_minutes) VALUES
  -- Stamina recovery
  ('Rest at Safehouse', 'Take some time to recover at your safehouse.', 'stamina', 30, 10, 5, 0, 60, 0, 1, 120),
  ('Visit Spa', 'Treat yourself to a relaxing spa day.', 'stamina', 50, 20, 0, 0, 90, 500, 3, 240),
  ('Sleep It Off', 'Get some serious rest.', 'stamina', 75, 25, 10, 0, 180, 0, 1, 360),
  ('Energy Drinks', 'Quick stamina boost from energy drinks.', 'stamina', 15, 0, 0, 0, 5, 50, 1, 30),
  ('Gym Session', 'Work out to build stamina.', 'stamina', 25, 5, 0, 0, 45, 100, 2, 180),

  -- Focus recovery
  ('Meditate', 'Clear your mind and regain focus.', 'focus', 10, 40, 0, 0, 30, 0, 1, 90),
  ('Plan Next Move', 'Study your options and strategize.', 'focus', 5, 50, 0, 5, 60, 0, 2, 120),
  ('Read Intel', 'Go through intelligence reports.', 'focus', 0, 35, 0, 0, 45, 0, 1, 60),
  ('Coffee Break', 'Quick focus boost from caffeine.', 'focus', 5, 15, 0, 0, 10, 25, 1, 30),
  ('Review Operations', 'Analyze past jobs for insights.', 'focus', 10, 60, 0, 10, 90, 0, 4, 240),

  -- Heat reduction
  ('Lay Low', 'Stay off the radar for a while.', 'heat', 0, 0, 20, 0, 120, 0, 1, 180),
  ('Bribe Officer', 'Pay off a cop to lose some heat.', 'heat', 0, 0, 35, 0, 30, 2000, 3, 360),
  ('Create Alibi', 'Establish a solid alibi for your activities.', 'heat', 0, 0, 25, 0, 60, 500, 2, 240),
  ('Change Appearance', 'Alter your look to avoid recognition.', 'heat', 0, 0, 15, 0, 45, 300, 1, 120),
  ('Use Safe House', 'Hide out in a secure location.', 'heat', 10, 5, 30, 0, 180, 0, 4, 480),

  -- Influence gain
  ('Attend Party', 'Schmooze at an upscale event.', 'influence', 0, 0, 0, 15, 120, 1000, 5, 360),
  ('Make Introduction', 'Connect two valuable contacts.', 'influence', 0, 5, 0, 20, 60, 0, 3, 240),
  ('Show Respect', 'Pay respects to a powerful figure.', 'influence', 0, 0, 0, 10, 30, 500, 2, 120),
  ('Donate to Cause', 'Make a charitable donation for reputation.', 'influence', 0, 0, -5, 25, 15, 2500, 4, 480),
  ('Host Dinner', 'Entertain important people.', 'influence', -10, -10, 0, 35, 180, 5000, 7, 720)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PAYMENT TIERS
-- =====================================================

INSERT INTO payment_tiers (name, tier_type, min_usd, max_usd, tokens_min, tokens_max, description) VALUES
  ('Penny Basic', 'penny', 0.01, 0.05, 10, 50, 'Smallest purchases for quick conveniences'),
  ('Penny Plus', 'penny', 0.05, 0.10, 50, 100, 'Small token amounts for minor boosts'),
  ('Nickel Starter', 'nickel', 0.25, 0.35, 300, 400, 'Medium purchases for cosmetics and skips'),
  ('Nickel Standard', 'nickel', 0.35, 0.50, 400, 600, 'Popular tier for most purchases'),
  ('Dollar Basic', 'dollar', 1.00, 2.00, 1500, 3200, 'Larger token bundles'),
  ('Dollar Premium', 'dollar', 2.00, 5.00, 3200, 8000, 'Best value token packages')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- TOKEN PACKAGES
-- =====================================================

INSERT INTO token_packages (name, tokens, price_usd, bonus_tokens, is_featured) VALUES
  ('Starter Pack', 100, 0.10, 0, FALSE),
  ('Small Bundle', 500, 0.45, 50, FALSE),
  ('Medium Bundle', 1200, 1.00, 150, FALSE),
  ('Value Pack', 3000, 2.00, 500, TRUE),
  ('Premium Bundle', 6500, 4.00, 1500, FALSE),
  ('Ultimate Pack', 10000, 5.00, 3000, TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- TOKEN ACTIONS
-- =====================================================

INSERT INTO token_actions (name, description, action_type, token_cost, effect_value, effect_type, max_daily_uses) VALUES
  ('Skip 10 Minute Wait', 'Skip a 10 minute cooldown or wait time.', 'skip_wait', 5, 10, 'minutes', NULL),
  ('Skip 30 Minute Wait', 'Skip a 30 minute cooldown or wait time.', 'skip_wait', 12, 30, 'minutes', NULL),
  ('Skip 1 Hour Wait', 'Skip a 1 hour cooldown or wait time.', 'skip_wait', 20, 60, 'minutes', NULL),
  ('Instant Travel', 'Travel to any district instantly.', 'instant_travel', 10, 1, 'travel', 10),
  ('Refresh Daily Missions', 'Get a new set of daily missions.', 'refresh', 25, 1, 'daily_missions', 2),
  ('Refresh Hourly Tasks', 'Get new hourly tasks immediately.', 'refresh', 15, 1, 'hourly_tasks', 5),
  ('Stamina Boost (+25)', 'Instantly restore 25 stamina.', 'boost', 30, 25, 'stamina', 5),
  ('Focus Boost (+25)', 'Instantly restore 25 focus.', 'boost', 30, 25, 'focus', 5),
  ('Heat Reduction (-15)', 'Instantly reduce heat by 15.', 'boost', 50, 15, 'heat_reduction', 3),
  ('XP Boost (30 min)', '50% bonus XP for 30 minutes.', 'boost', 75, 30, 'xp_boost_minutes', 3),
  ('Name Color Change', 'Change your name color (unlocks one color).', 'cosmetic', 300, 1, 'name_color', 1),
  ('Expand Stamina Cap (+5)', 'Permanently increase max stamina by 5.', 'expand_cap', 200, 5, 'stamina_max', 3),
  ('Expand Focus Cap (+5)', 'Permanently increase max focus by 5.', 'expand_cap', 200, 5, 'focus_max', 3)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- CAPACITY EXPANSIONS
-- =====================================================

INSERT INTO capacity_expansions (name, description, expansion_type, mission_chain_name, mission_chain_stages, expansion_per_stage, token_cost, max_purchases, expansion_per_purchase, max_total_expansion) VALUES
  ('Endurance Training', 'Increase your maximum stamina through training or purchase.', 'stamina_max', 'Iron Will Training', 5, 10, 200, 3, 5, 65),
  ('Mental Fortitude', 'Increase your maximum focus through meditation or purchase.', 'focus_max', 'Mind Over Matter', 5, 10, 200, 3, 5, 65),
  ('Social Network', 'Expand your influence capacity through connections or purchase.', 'influence_max', 'Building Connections', 5, 5, 150, 3, 3, 40),
  ('Storage Expansion', 'Increase your inventory slots through missions or purchase.', 'inventory_slots', 'Organizational Skills', 3, 5, 100, 5, 3, 30)
ON CONFLICT (name) DO NOTHING;
