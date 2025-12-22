// Street Legacy - Local Game Data
// ALL GAME DATA - NO API NEEDED

export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', description: 'The heart of Toronto', danger_level: 3, police_presence: 4, min_level: 1, economy_level: 80 },
  { id: 'parkdale', name: 'Parkdale', description: 'Gritty neighborhood with opportunity', danger_level: 4, police_presence: 2, min_level: 1, economy_level: 40 },
  { id: 'scarborough', name: 'Scarborough', description: 'Suburban sprawl, less heat', danger_level: 2, police_presence: 3, min_level: 3, economy_level: 50 },
  { id: 'etobicoke', name: 'Etobicoke', description: 'Industrial area, big scores', danger_level: 3, police_presence: 2, min_level: 5, economy_level: 55 },
  { id: 'northyork', name: 'North York', description: 'Wealthy suburbs', danger_level: 2, police_presence: 4, min_level: 7, economy_level: 75 },
  { id: 'yorkville', name: 'Yorkville', description: 'High-end district, high risk high reward', danger_level: 3, police_presence: 5, min_level: 10, economy_level: 95 },
  { id: 'kensington', name: 'Kensington Market', description: 'Bohemian area, unique opportunities', danger_level: 2, police_presence: 2, min_level: 4, economy_level: 45 },
  { id: 'portlands', name: 'Port Lands', description: 'Industrial waterfront', danger_level: 4, police_presence: 1, min_level: 12, economy_level: 60 },
  { id: 'thebeach', name: 'The Beach', description: 'Quiet area, tourist targets', danger_level: 1, police_presence: 3, min_level: 6, economy_level: 65 },
  { id: 'regent', name: 'Regent Park', description: 'Rebuilding neighborhood', danger_level: 5, police_presence: 3, min_level: 8, economy_level: 35 },
  { id: 'financial', name: 'Financial District', description: 'Corporate towers, white collar crime', danger_level: 2, police_presence: 5, min_level: 15, economy_level: 100 },
  { id: 'chinatown', name: 'Chinatown', description: 'Bustling markets, underground connections', danger_level: 3, police_presence: 2, min_level: 9, economy_level: 50 },
]

export const CRIMES = [
  // === TIER 1-9: STREET CRIMES (Level 1-20) ===
  { id: 'pickpocket', name: 'Pickpocket', description: 'Steal wallets from distracted people', min_payout: 50, max_payout: 150, energy_cost: 5, base_success_rate: 85, heat_gain: 2, min_level: 1, xp_reward: 10, category: 'street' },
  { id: 'shoplift', name: 'Shoplifting', description: 'Five finger discount at stores', min_payout: 75, max_payout: 200, energy_cost: 5, base_success_rate: 80, heat_gain: 3, min_level: 1, xp_reward: 12, category: 'street' },
  { id: 'carbreak', name: 'Car Break-in', description: 'Smash and grab from vehicles', min_payout: 100, max_payout: 350, energy_cost: 10, base_success_rate: 75, heat_gain: 5, min_level: 2, xp_reward: 18, category: 'street' },
  { id: 'mugging', name: 'Mugging', description: 'Rob people in dark alleys', min_payout: 200, max_payout: 500, energy_cost: 15, base_success_rate: 70, heat_gain: 8, min_level: 3, xp_reward: 25, category: 'street' },
  { id: 'drugdeal', name: 'Drug Deal', description: 'Move product on street corners', min_payout: 300, max_payout: 800, energy_cost: 15, base_success_rate: 65, heat_gain: 10, min_level: 5, xp_reward: 35, category: 'street' },
  { id: 'cartheft', name: 'Car Theft', description: 'Steal vehicles for the chop shop', min_payout: 500, max_payout: 1500, energy_cost: 20, base_success_rate: 60, heat_gain: 15, min_level: 7, xp_reward: 50, category: 'street' },
  { id: 'burglary', name: 'Burglary', description: 'Break into homes and businesses', min_payout: 800, max_payout: 2500, energy_cost: 25, base_success_rate: 55, heat_gain: 20, min_level: 10, xp_reward: 75, category: 'street' },
  { id: 'armedrobbery', name: 'Armed Robbery', description: 'Hold up stores at gunpoint', min_payout: 1500, max_payout: 5000, energy_cost: 35, base_success_rate: 45, heat_gain: 35, min_level: 15, xp_reward: 120, category: 'street' },
  { id: 'bankheist', name: 'Bank Heist', description: 'The big score', min_payout: 5000, max_payout: 20000, energy_cost: 50, base_success_rate: 30, heat_gain: 50, min_level: 20, xp_reward: 250, category: 'street' },

  // === TIER 10: VICE & GAMBLING (Level 15-40) ===
  { id: 'dice_game', name: 'Street Dice', description: 'Run dice games in back alleys', min_payout: 100, max_payout: 1000, energy_cost: 10, base_success_rate: 80, heat_gain: 5, min_level: 15, xp_reward: 30, category: 'vice' },
  { id: 'bootleg_goods', name: 'Bootleg Sales', description: 'Sell counterfeit goods on the street', min_payout: 300, max_payout: 1500, energy_cost: 15, base_success_rate: 75, heat_gain: 12, min_level: 18, xp_reward: 45, category: 'vice' },
  { id: 'underground_poker', name: 'Underground Poker', description: 'Host high-stakes illegal poker games', min_payout: 500, max_payout: 3000, energy_cost: 20, base_success_rate: 70, heat_gain: 10, min_level: 22, xp_reward: 60, category: 'vice' },
  { id: 'fight_club', name: 'Fight Club', description: 'Run illegal underground fights', min_payout: 1000, max_payout: 5000, energy_cost: 30, base_success_rate: 55, heat_gain: 20, min_level: 28, xp_reward: 85, category: 'vice' },
  { id: 'escort_ring', name: 'Escort Service', description: 'Manage high-end escort operations', min_payout: 2000, max_payout: 8000, energy_cost: 25, base_success_rate: 60, heat_gain: 25, min_level: 35, xp_reward: 120, category: 'vice' },

  // === TIER 11: WHITE COLLAR (Level 25-45) ===
  { id: 'tax_evasion', name: 'Tax Scheme', description: 'Help businesses cook their books', min_payout: 2000, max_payout: 10000, energy_cost: 20, base_success_rate: 55, heat_gain: 8, min_level: 25, xp_reward: 80, category: 'whitecollar' },
  { id: 'bribery', name: 'Official Bribery', description: 'Pay off officials to reduce heat', min_payout: -5000, max_payout: -1000, energy_cost: 15, base_success_rate: 60, heat_gain: -20, min_level: 28, xp_reward: 50, category: 'whitecollar', special: 'reduces_heat' },
  { id: 'blackmail', name: 'Blackmail', description: 'Collect payments using compromising intel', min_payout: 3000, max_payout: 15000, energy_cost: 25, base_success_rate: 50, heat_gain: 20, min_level: 32, xp_reward: 100, category: 'whitecollar' },
  { id: 'embezzlement', name: 'Embezzlement', description: 'Siphon funds from corporate accounts', min_payout: 5000, max_payout: 25000, energy_cost: 25, base_success_rate: 50, heat_gain: 15, min_level: 38, xp_reward: 150, category: 'whitecollar' },
  { id: 'stock_manipulation', name: 'Pump & Dump', description: 'Manipulate stock prices for massive gains', min_payout: 10000, max_payout: 50000, energy_cost: 30, base_success_rate: 45, heat_gain: 10, min_level: 42, xp_reward: 200, category: 'whitecollar' },

  // === TIER 12: TERRITORY & TURF (Level 30-50) ===
  { id: 'protection_collect', name: 'Collection Run', description: 'Collect weekly protection money from businesses', min_payout: 500, max_payout: 2000, energy_cost: 20, base_success_rate: 75, heat_gain: 15, min_level: 30, xp_reward: 70, category: 'territory' },
  { id: 'drive_by', name: 'Drive-By', description: 'Intimidate rivals with a show of force', min_payout: 0, max_payout: 0, energy_cost: 35, base_success_rate: 40, heat_gain: 60, min_level: 35, xp_reward: 100, category: 'territory', special: 'intimidation' },
  { id: 'territory_defend', name: 'Defend Turf', description: 'Protect your territory from encroachment', min_payout: 0, max_payout: 0, energy_cost: 30, base_success_rate: 60, heat_gain: 25, min_level: 38, xp_reward: 90, category: 'territory', special: 'defense' },
  { id: 'gang_war', name: 'Gang Clash', description: 'All-out battle with a rival crew', min_payout: 1000, max_payout: 5000, energy_cost: 50, base_success_rate: 35, heat_gain: 50, min_level: 42, xp_reward: 150, category: 'territory' },
  { id: 'turf_takeover', name: 'Turf Takeover', description: 'Claim a new block for your operation', min_payout: 2000, max_payout: 8000, energy_cost: 40, base_success_rate: 45, heat_gain: 40, min_level: 48, xp_reward: 200, category: 'territory' },
]

export const JOBS = [
  // === TIER 1-7: STANDARD JOBS (Level 1-15) ===
  { id: 'dishes', name: 'Wash Dishes', description: 'Scrub plates at the diner', base_pay: 25, energy_cost: 10, xp_reward: 5, min_level: 1, cooldown_seconds: 30, category: 'service' },
  { id: 'delivery', name: 'Delivery Driver', description: 'Deliver packages around the city', base_pay: 40, energy_cost: 15, xp_reward: 8, min_level: 1, cooldown_seconds: 45, category: 'service' },
  { id: 'bouncer', name: 'Club Bouncer', description: 'Keep troublemakers out', base_pay: 60, energy_cost: 20, xp_reward: 12, min_level: 3, cooldown_seconds: 60, category: 'security' },
  { id: 'bartender', name: 'Bartender', description: 'Mix drinks, hear secrets', base_pay: 70, energy_cost: 15, xp_reward: 12, min_level: 4, cooldown_seconds: 55, category: 'service' },
  { id: 'mechanic', name: 'Mechanic', description: 'Fix cars at the garage', base_pay: 80, energy_cost: 20, xp_reward: 15, min_level: 5, cooldown_seconds: 60, category: 'trade' },
  { id: 'security', name: 'Security Guard', description: 'Night shift at the warehouse', base_pay: 90, energy_cost: 25, xp_reward: 18, min_level: 7, cooldown_seconds: 90, category: 'security' },
  { id: 'driver', name: 'Getaway Driver', description: 'No questions asked driving', base_pay: 150, energy_cost: 30, xp_reward: 25, min_level: 10, cooldown_seconds: 120, category: 'underground' },
  { id: 'fixer', name: 'Fixer', description: 'Connect people who need things', base_pay: 200, energy_cost: 25, xp_reward: 30, min_level: 15, cooldown_seconds: 150, category: 'underground' },

  // === TIER 8: UNDERGROUND ECONOMY (Level 20-40) ===
  { id: 'weapon_transport', name: 'Weapon Courier', description: 'Transport firearms between locations', base_pay: 250, energy_cost: 20, xp_reward: 35, min_level: 20, cooldown_seconds: 50, category: 'underground' },
  { id: 'debt_enforcer', name: 'Debt Enforcer', description: 'Collect debts through intimidation', base_pay: 200, energy_cost: 25, xp_reward: 30, min_level: 22, cooldown_seconds: 45, category: 'underground' },
  { id: 'alibi_service', name: 'Alibi Provider', description: 'Provide cover stories for clients', base_pay: 150, energy_cost: 10, xp_reward: 25, min_level: 18, cooldown_seconds: 30, category: 'underground' },
  { id: 'lookout_service', name: 'Professional Lookout', description: 'Watch for police during operations', base_pay: 180, energy_cost: 15, xp_reward: 28, min_level: 20, cooldown_seconds: 40, category: 'underground' },
  { id: 'smuggler_assist', name: 'Smuggler Assistant', description: 'Help move contraband across borders', base_pay: 300, energy_cost: 30, xp_reward: 40, min_level: 25, cooldown_seconds: 60, category: 'underground' },

  // === TIER 9: SPECIALIST WORK (Level 30-50) ===
  { id: 'safe_technician', name: 'Safe Technician', description: 'Crack safes for legal repo work', base_pay: 400, energy_cost: 20, xp_reward: 50, min_level: 30, cooldown_seconds: 55, category: 'specialist' },
  { id: 'security_consultant', name: 'Security Consultant', description: 'Case locations for security flaws', base_pay: 350, energy_cost: 15, xp_reward: 45, min_level: 28, cooldown_seconds: 50, category: 'specialist' },
  { id: 'process_server', name: 'Process Server', description: 'Serve legal papers to hard targets', base_pay: 180, energy_cost: 12, xp_reward: 25, min_level: 25, cooldown_seconds: 35, category: 'specialist' },
  { id: 'skip_tracer', name: 'Skip Tracer', description: 'Track down people who owe debts', base_pay: 280, energy_cost: 18, xp_reward: 38, min_level: 28, cooldown_seconds: 50, category: 'specialist' },
  { id: 'night_auditor', name: 'Night Auditor', description: 'Overnight hotel accounting work', base_pay: 120, energy_cost: 10, xp_reward: 20, min_level: 22, cooldown_seconds: 40, category: 'specialist' },
  { id: 'private_investigator', name: 'Private Investigator', description: 'Investigate cases for clients', base_pay: 320, energy_cost: 22, xp_reward: 42, min_level: 32, cooldown_seconds: 55, category: 'specialist' },
  { id: 'bail_bondsman', name: 'Bail Bond Enforcer', description: 'Track and return bail jumpers', base_pay: 450, energy_cost: 35, xp_reward: 55, min_level: 35, cooldown_seconds: 70, category: 'specialist' },
]

export const ITEMS = [
  { id: 'lockpick', name: 'Lockpick Set', description: 'Improves burglary success', price: 500, category: 'tool', effect: { burglaryBonus: 10 } },
  { id: 'mask', name: 'Ski Mask', description: 'Reduces heat gain', price: 200, category: 'gear', effect: { heatReduction: 20 } },
  { id: 'knife', name: 'Switchblade', description: 'Improves mugging success', price: 300, category: 'weapon', effect: { muggingBonus: 15 } },
  { id: 'scanner', name: 'Police Scanner', description: 'Warns of police activity', price: 1000, category: 'electronics', effect: { heatReduction: 30 } },
  { id: 'toolkit', name: 'Auto Toolkit', description: 'Improves car theft', price: 800, category: 'tool', effect: { carTheftBonus: 20 } },
  { id: 'gun', name: 'Pistol', description: 'Required for armed robbery', price: 2000, category: 'weapon', effect: { armedRobberyUnlock: true } },
  { id: 'vest', name: 'Kevlar Vest', description: 'Reduces damage taken', price: 1500, category: 'gear', effect: { damageReduction: 25 } },
  { id: 'phone', name: 'Burner Phone', description: 'Reduces cooldowns', price: 400, category: 'electronics', effect: { cooldownReduction: 15 } },
  { id: 'energy_drink', name: 'Energy Drink', description: 'Restores 25 energy', price: 50, category: 'consumable', effect: { energyRestore: 25 }, stackable: true },
  { id: 'medkit', name: 'First Aid Kit', description: 'Restores 50 health', price: 100, category: 'consumable', effect: { healthRestore: 50 }, stackable: true },
  { id: 'bribe_money', name: 'Bribe Money', description: 'Reduces heat by 20', price: 500, category: 'consumable', effect: { heatReduction: 20 }, stackable: true },
]

export const PROPERTIES = [
  { id: 'apartment', name: 'Small Apartment', description: 'A place to rest', price: 5000, income_per_hour: 10, district: 'parkdale', min_level: 1 },
  { id: 'garage', name: 'Garage', description: 'Store vehicles and goods', price: 15000, income_per_hour: 25, district: 'etobicoke', min_level: 5 },
  { id: 'warehouse', name: 'Warehouse', description: 'Large storage facility', price: 50000, income_per_hour: 75, district: 'portlands', min_level: 10 },
  { id: 'nightclub', name: 'Nightclub', description: 'Make money while you sleep', price: 100000, income_per_hour: 150, district: 'downtown', min_level: 15 },
  { id: 'penthouse', name: 'Penthouse', description: 'Luxury living', price: 250000, income_per_hour: 300, district: 'yorkville', min_level: 20 },
]

// Heist data for local mode
export const HEISTS = [
  // === STARTER HEISTS (Level 5-20) ===
  { id: 'convenience', name: 'Convenience Store', description: 'Quick cash grab from a corner store', min_level: 5, min_payout: 500, max_payout: 1500, min_crew: 1, max_crew: 2, success_rate: 80, heat_gain: 15, difficulty: 1, category: 'smash_grab' },
  { id: 'pawn_shop', name: 'Pawn Shop', description: 'Hit a pawn shop after hours', min_level: 8, min_payout: 1500, max_payout: 4000, min_crew: 2, max_crew: 3, success_rate: 70, heat_gain: 20, difficulty: 2, category: 'burglary' },
  { id: 'jewelry', name: 'Jewelry Store', description: 'Smash and grab diamonds', min_level: 10, min_payout: 2000, max_payout: 5000, min_crew: 2, max_crew: 3, success_rate: 65, heat_gain: 25, difficulty: 2, category: 'smash_grab' },
  { id: 'electronics', name: 'Electronics Store', description: 'High-value tech heist', min_level: 12, min_payout: 3000, max_payout: 8000, min_crew: 2, max_crew: 4, success_rate: 60, heat_gain: 28, difficulty: 3, category: 'smash_grab' },
  { id: 'mansion', name: 'Mansion Burglary', description: 'Hit a wealthy estate under cover of night', min_level: 15, min_payout: 8000, max_payout: 20000, min_crew: 2, max_crew: 3, success_rate: 50, heat_gain: 35, difficulty: 3, category: 'burglary', requires: 'night_only' },
  { id: 'warehouse', name: 'Warehouse Raid', description: 'Hit a smuggling operation', min_level: 15, min_payout: 5000, max_payout: 12000, min_crew: 3, max_crew: 4, success_rate: 55, heat_gain: 35, difficulty: 3, category: 'raid' },
  { id: 'train', name: 'Train Robbery', description: 'Intercept cargo on the rails', min_level: 20, min_payout: 15000, max_payout: 40000, min_crew: 2, max_crew: 4, success_rate: 40, heat_gain: 45, difficulty: 4, category: 'intercept', bonus: 'driver' },
  { id: 'armored', name: 'Armored Truck', description: 'Intercept cash transport', min_level: 20, min_payout: 10000, max_payout: 25000, min_crew: 3, max_crew: 5, success_rate: 45, heat_gain: 45, difficulty: 4, category: 'intercept', bonus: 'driver' },

  // === MAJOR HEISTS (Level 25-40) ===
  { id: 'museum', name: 'Museum Heist', description: 'Steal priceless art from the city museum', min_level: 25, min_payout: 30000, max_payout: 80000, min_crew: 3, max_crew: 5, success_rate: 35, heat_gain: 50, difficulty: 5, category: 'infiltration', requires: 'art_fence' },
  { id: 'diamond_exchange', name: 'Diamond Exchange', description: 'Hit the diamond trading floor', min_level: 28, min_payout: 40000, max_payout: 90000, min_crew: 4, max_crew: 5, success_rate: 32, heat_gain: 55, difficulty: 5, category: 'infiltration' },
  { id: 'bank', name: 'Bank Vault', description: 'The classic bank job', min_level: 30, min_payout: 50000, max_payout: 100000, min_crew: 4, max_crew: 6, success_rate: 30, heat_gain: 60, difficulty: 5, category: 'vault', requires: 'hacker' },
  { id: 'casino', name: 'Casino Vault', description: 'Clean out the casino\'s vault', min_level: 35, min_payout: 75000, max_payout: 200000, min_crew: 4, max_crew: 6, success_rate: 25, heat_gain: 70, difficulty: 6, category: 'vault', requires: 'hacker' },
  { id: 'penthouse', name: 'Penthouse Heist', description: 'Rob a billionaire\'s penthouse suite', min_level: 38, min_payout: 80000, max_payout: 180000, min_crew: 3, max_crew: 5, success_rate: 28, heat_gain: 65, difficulty: 6, category: 'burglary', requires: 'night_only' },

  // === LEGENDARY HEISTS (Level 40+) ===
  { id: 'yacht', name: 'Yacht Heist', description: 'Rob a billionaire\'s yacht during a party', min_level: 40, min_payout: 100000, max_payout: 250000, min_crew: 5, max_crew: 6, success_rate: 20, heat_gain: 80, difficulty: 7, category: 'infiltration' },
  { id: 'gold_reserve', name: 'Gold Reserve', description: 'Hit the city\'s gold reserve', min_level: 45, min_payout: 200000, max_payout: 500000, min_crew: 5, max_crew: 6, success_rate: 15, heat_gain: 90, difficulty: 8, category: 'vault', requires: 'hacker' },
  { id: 'federal_reserve', name: 'The Big One', description: 'The impossible score - Federal Reserve', min_level: 50, min_payout: 500000, max_payout: 1000000, min_crew: 6, max_crew: 6, success_rate: 10, heat_gain: 100, difficulty: 10, category: 'legendary', requires: 'full_crew' },
]

// Trading goods for local mode
export const TRADING_GOODS = [
  // Starter goods (Level 1-5)
  { id: 'weed', name: 'Cannabis', description: 'Low risk, low reward', buy_price: 100, sell_price: 150, risk: 'Low', min_level: 1 },
  { id: 'stolen', name: 'Stolen Goods', description: 'Hot merchandise', buy_price: 150, sell_price: 250, risk: 'Low', min_level: 1 },
  { id: 'pills', name: 'Pills', description: 'Party supplies', buy_price: 200, sell_price: 350, risk: 'Medium', min_level: 3 },
  { id: 'electronics', name: 'Hot Electronics', description: 'Boosted tech', buy_price: 300, sell_price: 500, risk: 'Medium', min_level: 5 },

  // Mid-tier goods (Level 6-10)
  { id: 'coke', name: 'Cocaine', description: 'High risk, high reward', buy_price: 500, sell_price: 900, risk: 'High', min_level: 7 },
  { id: 'fake_ids', name: 'Fake IDs', description: 'Identity documents', buy_price: 400, sell_price: 700, risk: 'Medium', min_level: 8 },
  { id: 'guns', name: 'Firearms', description: 'Very dangerous to carry', buy_price: 1000, sell_price: 1800, risk: 'Very High', min_level: 10 },
  { id: 'crypto', name: 'Crypto Wallets', description: 'Anonymous digital assets', buy_price: 2000, sell_price: 3500, risk: 'Low', min_level: 10 },

  // High-tier goods (Level 11-15)
  { id: 'counterfeit', name: 'Counterfeit Cash', description: 'Fake bills, real risk', buy_price: 800, sell_price: 1400, risk: 'High', min_level: 12 },
  { id: 'art_forgery', name: 'Art Forgeries', description: 'High-value fakes', buy_price: 3000, sell_price: 5500, risk: 'Medium', min_level: 14 },
  { id: 'exotic_cars', name: 'Exotic Cars', description: 'Luxury vehicles', buy_price: 5000, sell_price: 9000, risk: 'Very High', min_level: 15 },
]

// NPC Crew members for local mode
export const CREW_MEMBERS = [
  { id: 'marcus', name: 'Marcus', role: 'driver', skill: 'Getaway Expert', bonus: '+20% escape chance', cost: 2000, cut: 15, min_level: 5 },
  { id: 'luna', name: 'Luna', role: 'hacker', skill: 'Security Bypass', bonus: '+15% success rate', cost: 5000, cut: 20, min_level: 10 },
  { id: 'tony', name: 'Big Tony', role: 'muscle', skill: 'Intimidation', bonus: '+25% intimidation', cost: 3000, cut: 15, min_level: 7 },
  { id: 'slim', name: 'Slim', role: 'locksmith', skill: 'Safe Cracker', bonus: '+20% vault bonus', cost: 4000, cut: 18, min_level: 8 },
  { id: 'jenny', name: 'Jenny', role: 'insider', skill: 'Intel Gathering', bonus: '-15% heat', cost: 6000, cut: 22, min_level: 12 },
]

// Achievements for local mode
export const ACHIEVEMENTS = [
  // Basic Achievements
  { id: 'first_crime', name: 'First Timer', description: 'Complete your first crime', reward: 100, icon: '🔫' },
  { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', reward: 500, icon: '⭐' },
  { id: 'level_10', name: 'Made Man', description: 'Reach level 10', reward: 1000, icon: '🎖️' },
  { id: 'level_20', name: 'Crime Boss', description: 'Reach level 20', reward: 2500, icon: '👑' },
  { id: 'rich_10k', name: 'Money Bags', description: 'Have $10,000 cash', reward: 500, icon: '💰' },
  { id: 'rich_100k', name: 'High Roller', description: 'Have $100,000 cash', reward: 2000, icon: '💎' },
  { id: 'banker_50k', name: 'Smart Saver', description: 'Bank $50,000', reward: 1000, icon: '🏦' },
  { id: 'property', name: 'Landlord', description: 'Own a property', reward: 500, icon: '🏠' },
  { id: 'crew', name: 'Gang Leader', description: 'Recruit a crew member', reward: 500, icon: '👥' },
  { id: 'traveler', name: 'Tourist', description: 'Visit 5 different districts', reward: 300, icon: '🗺️' },

  // Witness System Achievements
  { id: 'clean_getaway', name: 'Ghost', description: 'Complete 10 crimes with no witnesses', reward: 750, icon: '👻', stat: 'clean_crimes', target: 10 },
  { id: 'clean_master', name: 'Phantom', description: 'Complete 50 crimes with no witnesses', reward: 2500, icon: '🌑', stat: 'clean_crimes', target: 50 },
  { id: 'night_owl', name: 'Night Owl', description: 'Complete 25 crimes at night (midnight-6am)', reward: 1000, icon: '🦉', stat: 'night_crimes', target: 25 },

  // District Heat Achievements
  { id: 'district_master', name: 'District King', description: 'Max heat in 5 different districts', reward: 1500, icon: '🔥', stat: 'districts_heated', target: 5 },
  { id: 'port_rat', name: 'Port Rat', description: 'Complete 20 crimes in Port Lands', reward: 500, icon: '🚢', stat: 'crimes_port_lands', target: 20 },
  { id: 'downtown_danger', name: 'Downtown Danger', description: 'Complete 15 crimes in high-police districts', reward: 1000, icon: '🏙️', stat: 'crimes_high_police', target: 15 },

  // Heist Planning Achievements
  { id: 'planner', name: 'The Planner', description: 'Complete all planning activities for a heist', reward: 1000, icon: '📋', stat: 'fully_planned_heists', target: 1 },
  { id: 'mastermind', name: 'Mastermind', description: 'Complete 5 fully-planned heists', reward: 3000, icon: '🧠', stat: 'fully_planned_heists', target: 5 },
  { id: 'scout_expert', name: 'Scout Expert', description: 'Complete 10 scouting activities', reward: 500, icon: '🔍', stat: 'scout_activities', target: 10 },
  { id: 'intel_master', name: 'Intel Master', description: 'Gather intel 15 times', reward: 750, icon: '📡', stat: 'intel_activities', target: 15 },

  // Heist Achievements
  { id: 'first_heist', name: 'Big Score', description: 'Complete your first heist', reward: 1000, icon: '💼' },
  { id: 'heist_5', name: 'Serial Heister', description: 'Complete 5 heists', reward: 2500, icon: '🎭', stat: 'heists_completed', target: 5 },
  { id: 'heist_10', name: 'Professional', description: 'Complete 10 heists', reward: 5000, icon: '🎪', stat: 'heists_completed', target: 10 },
  { id: 'bank_job', name: 'Bank Robber', description: 'Successfully rob a bank', reward: 5000, icon: '🏛️' },
  { id: 'yacht_heist', name: 'High Seas', description: 'Complete the Yacht Heist', reward: 10000, icon: '🛥️' },
  { id: 'big_one', name: 'The Big One', description: 'Complete The Big One heist', reward: 25000, icon: '🏆' },

  // Lawyer System Achievements
  { id: 'legal_up', name: 'Lawyer Up', description: 'Hire your first lawyer', reward: 500, icon: '⚖️' },
  { id: 'elite_defense', name: 'Best Defense', description: 'Hire an Elite Defense lawyer', reward: 2000, icon: '🎓' },
  { id: 'fixer', name: 'The Fixer', description: 'Hire The Fixer', reward: 5000, icon: '🕴️' },
  { id: 'bail_out', name: 'Bail Bondsman', description: 'Pay bail 10 times', reward: 750, icon: '🔓', stat: 'bails_paid', target: 10 },

  // Jail Achievements
  { id: 'jailbird', name: 'Jailbird', description: 'Get arrested 5 times', reward: 250, icon: '🔒', stat: 'times_arrested', target: 5 },
  { id: 'escape_artist', name: 'Escape Artist', description: 'Escape from jail 3 times', reward: 1500, icon: '🏃', stat: 'jail_escapes', target: 3 },
  { id: 'good_behavior', name: 'Good Behavior', description: 'Get released early for good behavior', reward: 500, icon: '😇' },
  { id: 'prison_connections', name: 'Prison Rep', description: 'Make 10 connections in jail', reward: 750, icon: '🤝', stat: 'prison_connections', target: 10 },

  // Time-based Achievements
  { id: 'early_bird', name: 'Early Bird', description: 'Complete 10 crimes in the morning', reward: 500, icon: '🌅', stat: 'morning_crimes', target: 10 },
  { id: 'night_shift', name: 'Night Shift', description: 'Work 20 jobs at night', reward: 750, icon: '🌙', stat: 'night_jobs', target: 20 },

  // Advanced Crime Achievements
  { id: 'turf_war', name: 'Turf War', description: 'Complete a Turf Takeover', reward: 2000, icon: '⚔️' },
  { id: 'white_collar', name: 'White Collar', description: 'Complete an embezzlement scheme', reward: 2500, icon: '📊' },
  { id: 'vice_lord', name: 'Vice Lord', description: 'Run an underground poker game', reward: 1500, icon: '🎰' },

  // ========== MINI-GAME ACHIEVEMENTS ==========
  // Win Streak Achievements
  { id: 'streak_3', name: 'Hot Hand', description: 'Win 3 mini-games in a row', reward: 250, icon: '🔥', stat: 'mini_game_streak', target: 3, benefit: { type: 'streak_bonus', value: 0.10 } },
  { id: 'streak_5', name: 'On Fire', description: 'Win 5 mini-games in a row', reward: 500, icon: '🔥', stat: 'mini_game_streak', target: 5, benefit: { type: 'streak_bonus', value: 0.20 } },
  { id: 'streak_10', name: 'Unstoppable', description: 'Win 10 mini-games in a row', reward: 1000, icon: '💥', stat: 'mini_game_streak', target: 10, benefit: { type: 'streak_bonus', value: 0.35 } },
  { id: 'streak_25', name: 'Legendary Streak', description: 'Win 25 mini-games in a row', reward: 2500, icon: '👑', stat: 'mini_game_streak', target: 25, benefit: { type: 'streak_bonus', value: 0.50 } },

  // Perfect Run Achievements
  { id: 'first_perfect', name: 'First Perfect', description: 'Get a perfect score in any mini-game', reward: 300, icon: '⭐', stat: 'perfect_runs', target: 1, benefit: { type: 'xp_bonus', value: 0.05 } },
  { id: 'perfect_10', name: 'Perfectionist', description: 'Get 10 perfect scores', reward: 1000, icon: '⭐', stat: 'perfect_runs', target: 10, benefit: { type: 'xp_bonus', value: 0.10 } },
  { id: 'perfect_25', name: 'Flawless', description: 'Get 25 perfect scores', reward: 2500, icon: '💎', stat: 'perfect_runs', target: 25, benefit: { type: 'xp_bonus', value: 0.15 } },
  { id: 'perfect_50', name: 'Master of Games', description: 'Get 50 perfect scores', reward: 5000, icon: '🏆', stat: 'perfect_runs', target: 50, benefit: { type: 'xp_bonus', value: 0.25 } },

  // Mini-Game Mastery
  { id: 'mini_games_10', name: 'Game Player', description: 'Win 10 mini-games', reward: 200, icon: '🎮', stat: 'mini_games_won', target: 10 },
  { id: 'mini_games_50', name: 'Skilled Operator', description: 'Win 50 mini-games', reward: 750, icon: '🎮', stat: 'mini_games_won', target: 50, benefit: { type: 'success_bonus', value: 0.05 } },
  { id: 'mini_games_100', name: 'Mini-Game Master', description: 'Win 100 mini-games', reward: 1500, icon: '🎯', stat: 'mini_games_won', target: 100, benefit: { type: 'success_bonus', value: 0.10 } },
  { id: 'mini_games_250', name: 'Gaming Legend', description: 'Win 250 mini-games', reward: 5000, icon: '👾', stat: 'mini_games_won', target: 250, benefit: { type: 'success_bonus', value: 0.15 } },

  // Speed Achievements
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a mini-game with >20 seconds remaining', reward: 500, icon: '⚡', benefit: { type: 'cooldown_reduction', value: 0.05 } },

  // Curveball Achievements
  { id: 'curveball_survivor', name: 'Curveball Survivor', description: 'Survive 25 curveball challenges', reward: 500, icon: '🌀', stat: 'total_curveballs_survived', target: 25 },
  { id: 'curveball_master', name: 'Curveball King', description: 'Survive 100 curveball challenges', reward: 1500, icon: '🎪', stat: 'total_curveballs_survived', target: 100, benefit: { type: 'curveball_bonus', value: 25 } },

  // Variety Achievements
  { id: 'jack_of_trades', name: 'Jack of All Trades', description: 'Win at least one of each mini-game type', reward: 2000, icon: '🃏', benefit: { type: 'unlock', feature: 'hard_mode' } },

  // Daily Play Achievements
  { id: 'daily_grind', name: 'Daily Grinder', description: 'Play 5 mini-games in a single day for 7 days', reward: 1500, icon: '📆', benefit: { type: 'permanent_cash', value: 0.02 } },
]

// Mini-Game Achievement Benefits - Maps achievement IDs to their gameplay benefits
export const MINI_GAME_ACHIEVEMENT_BENEFITS = {
  streak_3: { type: 'streak_bonus', value: 0.10, description: '+10% rewards during streaks' },
  streak_5: { type: 'streak_bonus', value: 0.20, description: '+20% rewards during streaks' },
  streak_10: { type: 'streak_bonus', value: 0.35, description: '+35% rewards during streaks' },
  streak_25: { type: 'streak_bonus', value: 0.50, description: '+50% rewards during streaks' },
  first_perfect: { type: 'xp_bonus', value: 0.05, description: '+5% XP from mini-games' },
  perfect_10: { type: 'xp_bonus', value: 0.10, description: '+10% XP from mini-games' },
  perfect_25: { type: 'xp_bonus', value: 0.15, description: '+15% XP from mini-games' },
  perfect_50: { type: 'xp_bonus', value: 0.25, description: '+25% XP from mini-games' },
  mini_games_50: { type: 'success_bonus', value: 0.05, description: '+5% mini-game success rate' },
  mini_games_100: { type: 'success_bonus', value: 0.10, description: '+10% mini-game success rate' },
  mini_games_250: { type: 'success_bonus', value: 0.15, description: '+15% mini-game success rate' },
  speed_demon: { type: 'cooldown_reduction', value: 0.05, description: '-5% crime cooldowns' },
  curveball_master: { type: 'curveball_bonus', value: 25, description: '+25 points per curveball survived' },
  jack_of_trades: { type: 'unlock', feature: 'hard_mode', description: 'Unlocks Hard Mode for 3x rewards' },
  daily_grind: { type: 'permanent_cash', value: 0.02, description: '+2% permanent cash bonus' }
}

/**
 * Get total mini-game achievement benefits for a player
 * @param {Object} player - Player data
 * @returns {Object} Combined benefits from all unlocked achievements
 */
export function getMiniGameAchievementBenefits(player) {
  const benefits = {
    streak_bonus: 0,
    xp_bonus: 0,
    success_bonus: 0,
    cooldown_reduction: 0,
    curveball_bonus: 0,
    permanent_cash: 0,
    unlocks: []
  }

  if (!player || !player.achievements) return benefits

  player.achievements.forEach(achId => {
    const benefit = MINI_GAME_ACHIEVEMENT_BENEFITS[achId]
    if (!benefit) return

    switch (benefit.type) {
      case 'streak_bonus':
        benefits.streak_bonus = Math.max(benefits.streak_bonus, benefit.value)
        break
      case 'xp_bonus':
        benefits.xp_bonus += benefit.value
        break
      case 'success_bonus':
        benefits.success_bonus += benefit.value
        break
      case 'cooldown_reduction':
        benefits.cooldown_reduction += benefit.value
        break
      case 'curveball_bonus':
        benefits.curveball_bonus += benefit.value
        break
      case 'permanent_cash':
        benefits.permanent_cash += benefit.value
        break
      case 'unlock':
        benefits.unlocks.push(benefit.feature)
        break
    }
  })

  return benefits
}

/**
 * Check all achievements against player stats and return newly unlocked ones
 * @param {Object} player - Player data object
 * @returns {Array} Array of newly unlocked achievements
 */
export function checkLocalAchievements(player) {
  if (!player) return []

  const unlocked = player.achievements || []
  const newlyUnlocked = []

  ACHIEVEMENTS.forEach(achievement => {
    // Skip if already unlocked
    if (unlocked.includes(achievement.id)) return

    let earned = false

    // Check stat-based achievements
    if (achievement.stat && achievement.target) {
      // Check in player directly, player.stats, and player.minigameStats
      let statValue = player[achievement.stat] || 0
      if (statValue === 0 && player.stats) {
        statValue = player.stats[achievement.stat] || 0
      }
      if (statValue >= achievement.target) {
        earned = true
      }
    } else {
      // Check specific trigger achievements
      switch (achievement.id) {
        // Basic achievements
        case 'first_crime':
          earned = (player.crimes_committed || 0) >= 1
          break
        case 'level_5':
          earned = (player.level || 1) >= 5
          break
        case 'level_10':
          earned = (player.level || 1) >= 10
          break
        case 'level_20':
          earned = (player.level || 1) >= 20
          break
        case 'rich_10k':
          earned = (player.cash || 0) >= 10000
          break
        case 'rich_100k':
          earned = (player.cash || 0) >= 100000
          break
        case 'banker_50k':
          earned = (player.banked || 0) >= 50000
          break
        case 'property':
          earned = (player.properties?.length || 0) >= 1
          break
        case 'crew':
          earned = (player.crew?.length || 0) >= 1
          break
        case 'traveler':
          earned = (player.districts_visited?.length || 0) >= 5
          break

        // Heist achievements
        case 'first_heist':
          earned = (player.heists_completed || 0) >= 1
          break
        case 'bank_job':
          earned = (player.bank_heists_completed || 0) >= 1
          break
        case 'yacht_heist':
          earned = player.yacht_heist_completed === true
          break
        case 'big_one':
          earned = player.big_one_completed === true
          break

        // Lawyer achievements
        case 'legal_up':
          earned = player.lawyer != null && player.lawyer !== 'public'
          break
        case 'elite_defense':
          earned = player.lawyer === 'elite'
          break
        case 'fixer':
          earned = player.lawyer === 'fixer'
          break

        // Jail achievements
        case 'good_behavior':
          earned = player.early_releases >= 1
          break

        // Crime type achievements (tracked when completing specific crimes)
        case 'turf_war':
          earned = player.turf_takeovers_completed >= 1
          break
        case 'white_collar':
          earned = player.embezzlement_completed >= 1
          break
        case 'vice_lord':
          earned = player.poker_games_run >= 1
          break
      }
    }

    if (earned) {
      newlyUnlocked.push(achievement)
    }
  })

  // Add newly unlocked to player achievements and award rewards
  if (newlyUnlocked.length > 0) {
    player.achievements = [...unlocked, ...newlyUnlocked.map(a => a.id)]
    newlyUnlocked.forEach(a => {
      player.cash = (player.cash || 0) + (a.reward || 0)
    })
    savePlayerData(player)
  }

  return newlyUnlocked
}

// ============================================
// DYNAMIC NEWS SYSTEM - Player Action News
// ============================================

/**
 * News templates for player actions
 */
export const PLAYER_ACTION_NEWS = {
  heist_success: [
    { headline: 'Major Heist Rocks {district}', summary: 'Daring criminals made off with an estimated {amount} from {target}. Police are investigating.', significance: 8 },
    { headline: 'Vault Emptied in Brazen Robbery', summary: 'Professional crew executes flawless heist, escaping with {amount}.', significance: 7 },
    { headline: 'Security Breach at {target}', summary: 'Thieves bypass state-of-the-art security to steal {amount}.', significance: 7 }
  ],
  heist_fail: [
    { headline: 'Heist Gone Wrong', summary: 'Attempted robbery at {target} foiled as suspects flee empty-handed.', significance: 6 },
    { headline: 'Failed Heist Triggers Manhunt', summary: 'Police searching for suspects after botched robbery attempt.', significance: 5 }
  ],
  arrest: [
    { headline: 'Notorious Criminal Apprehended', summary: 'Police take suspect into custody after extensive investigation.', significance: 6 },
    { headline: 'Arrest Made in {district}', summary: 'Law enforcement scores victory as wanted individual is detained.', significance: 5 }
  ],
  jailbreak: [
    { headline: 'BREAKING: Prisoner Escapes Custody', summary: 'Inmate escapes detention facility. Authorities launch citywide search.', significance: 9 },
    { headline: 'Daring Jailbreak Stuns Officials', summary: 'Security lapse allows prisoner to flee. Public warned.', significance: 8 }
  ],
  level_milestone: [
    { headline: 'New Crime Boss Emerges', summary: 'Street sources report a rising figure gaining power in the underworld.', significance: 5 },
    { headline: 'Criminal Empire Grows', summary: 'Authorities concerned about expanding criminal operation.', significance: 6 }
  ],
  wealth_milestone: [
    { headline: 'Millionaire Criminal at Large', summary: 'Investigators trace massive illicit fortune to unknown kingpin.', significance: 7 },
    { headline: 'Shadow Fortune Uncovered', summary: 'Financial crimes unit tracks suspicious wealth accumulation.', significance: 6 }
  ],
  turf_takeover: [
    { headline: 'Gang Territory Changes Hands', summary: 'Power shift in {district} as new crew claims control of the streets.', significance: 7 },
    { headline: 'Turf War Concludes', summary: 'Violent struggle for territory ends with new leadership emerging.', significance: 6 }
  ],
  big_crime: [
    { headline: 'Major Crime Shakes {district}', summary: 'Brazen criminal activity reported. Police increase patrols.', significance: 6 },
    { headline: 'Criminal Strikes Again', summary: 'Serial offender believed responsible for latest incident.', significance: 5 }
  ]
}

/**
 * Generate news for player actions
 */
export function generatePlayerNews(actionType, details = {}) {
  const templates = PLAYER_ACTION_NEWS[actionType]
  if (!templates || templates.length === 0) return null

  const template = templates[Math.floor(Math.random() * templates.length)]
  const district = details.district || 'Downtown'
  const amount = details.amount ? `$${details.amount.toLocaleString()}` : 'substantial sum'
  const target = details.target || 'local establishment'

  const news = {
    id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    category: actionType.includes('heist') ? 'crime' : 'player',
    headline: template.headline
      .replace(/{district}/g, district)
      .replace(/{amount}/g, amount)
      .replace(/{target}/g, target),
    summary: template.summary
      .replace(/{district}/g, district)
      .replace(/{amount}/g, amount)
      .replace(/{target}/g, target),
    significance: template.significance,
    districtName: district,
    createdAt: Date.now(),
    isRead: false,
    source: 'Street Wire',
    isPlayerAction: true
  }

  // Save to local storage
  addNewsToFeed(news)

  return news
}

/**
 * Add news item to the local feed
 */
export function addNewsToFeed(newsItem) {
  try {
    const newsData = JSON.parse(localStorage.getItem('street_legacy_news') || '{"feed":[],"subscriptions":[],"lastGenerated":0}')
    newsData.feed = [newsItem, ...(newsData.feed || [])].slice(0, 50) // Keep max 50 items
    localStorage.setItem('street_legacy_news', JSON.stringify(newsData))
    return true
  } catch (e) {
    console.error('Failed to add news:', e)
    return false
  }
}

// ============================================
// WORLD EVENTS SYSTEM - Random Events
// ============================================

export const WORLD_EVENTS = [
  {
    id: 'police_crackdown',
    name: 'Police Crackdown',
    description: 'Increased police presence in all districts',
    duration: 30 * 60 * 1000, // 30 minutes
    effects: { heatGainMultiplier: 1.5, pursuitChanceMultiplier: 1.3 },
    chance: 0.05,
    icon: '🚔',
    news: { headline: 'BREAKING: Citywide Police Crackdown', summary: 'Law enforcement launches major operation. All districts affected.', significance: 9 }
  },
  {
    id: 'gang_war',
    name: 'Gang War',
    description: 'Rival gangs clash - opportunity for bold moves',
    duration: 45 * 60 * 1000, // 45 minutes
    effects: { crimeSuccessBonus: 10, territoryPayoutMultiplier: 1.5 },
    chance: 0.04,
    icon: '⚔️',
    news: { headline: 'Gang Violence Erupts', summary: 'Multiple crews clash in bloody territorial dispute.', significance: 8 }
  },
  {
    id: 'market_boom',
    name: 'Market Boom',
    description: 'Black market prices surge',
    duration: 60 * 60 * 1000, // 1 hour
    effects: { tradingPriceMultiplier: 1.3, crimePayoutMultiplier: 1.2 },
    chance: 0.06,
    icon: '📈',
    news: { headline: 'Underground Economy Booms', summary: 'Street prices reach record highs as demand surges.', significance: 6 }
  },
  {
    id: 'heat_wave',
    name: 'Heat Wave',
    description: 'Cops taking it easy in the heat',
    duration: 45 * 60 * 1000, // 45 minutes
    effects: { heatDecayMultiplier: 2, pursuitChanceMultiplier: 0.7 },
    chance: 0.05,
    icon: '🌡️',
    news: { headline: 'Heatwave Hits City', summary: 'Record temperatures lead to reduced police patrols.', significance: 4 }
  },
  {
    id: 'power_outage',
    name: 'Power Outage',
    description: 'Security systems down - prime opportunity',
    duration: 20 * 60 * 1000, // 20 minutes
    effects: { heistSuccessBonus: 15, heatGainMultiplier: 0.8 },
    chance: 0.03,
    icon: '⚡',
    news: { headline: 'BREAKING: Major Power Outage', summary: 'Citywide blackout disables security systems.', significance: 9 }
  },
  {
    id: 'festival',
    name: 'Street Festival',
    description: 'Crowds provide cover for operations',
    duration: 90 * 60 * 1000, // 90 minutes
    effects: { pickpocketPayoutMultiplier: 2, witnessChanceReduction: 0.5 },
    chance: 0.04,
    icon: '🎉',
    news: { headline: 'Annual Street Festival Begins', summary: 'Thousands gather for citywide celebration.', significance: 3 }
  },
  {
    id: 'informant',
    name: 'Informant in the Ranks',
    description: 'Someone is talking - be careful',
    duration: 60 * 60 * 1000, // 1 hour
    effects: { heatGainMultiplier: 1.3, crimeSuccessBonus: -10 },
    chance: 0.03,
    icon: '🐀',
    news: { headline: 'Police Tip Line Busy', summary: 'Anonymous tips lead to multiple arrests this week.', significance: 5 }
  },
  {
    id: 'double_xp',
    name: 'Street Cred Weekend',
    description: 'Your reputation spreads faster',
    duration: 120 * 60 * 1000, // 2 hours
    effects: { xpMultiplier: 2 },
    chance: 0.03,
    icon: '⭐',
    news: { headline: 'Underworld Buzzing', summary: 'Word on the street spreads fast this week.', significance: 4 }
  }
]

/**
 * Check and trigger random world events
 */
export function checkWorldEvents(player) {
  const now = Date.now()

  // Initialize event tracking
  if (!player.world_events) {
    player.world_events = { active: [], history: [], lastCheck: 0 }
  }

  // Only check every 5 minutes
  if (now - (player.world_events.lastCheck || 0) < 5 * 60 * 1000) {
    return player.world_events.active || []
  }
  player.world_events.lastCheck = now

  // Clear expired events
  player.world_events.active = (player.world_events.active || []).filter(e => {
    return now < e.expiresAt
  })

  // Don't have more than 2 events at once
  if (player.world_events.active.length >= 2) {
    savePlayerData(player)
    return player.world_events.active
  }

  // Check for new events
  WORLD_EVENTS.forEach(event => {
    // Don't trigger same event twice in short period
    const lastTriggered = player.world_events.history?.find(h => h.id === event.id)?.triggeredAt || 0
    if (now - lastTriggered < event.duration * 2) return

    // Check if already active
    if (player.world_events.active.some(e => e.id === event.id)) return

    // Roll for event
    if (Math.random() < event.chance) {
      const activeEvent = {
        ...event,
        triggeredAt: now,
        expiresAt: now + event.duration
      }
      player.world_events.active.push(activeEvent)
      player.world_events.history = [
        { id: event.id, triggeredAt: now },
        ...(player.world_events.history || []).slice(0, 20)
      ]

      // Generate news for the event
      if (event.news) {
        addNewsToFeed({
          id: `event_${event.id}_${now}`,
          category: 'breaking',
          headline: event.news.headline,
          summary: event.news.summary,
          significance: event.news.significance,
          createdAt: now,
          isRead: false,
          source: 'Street Wire'
        })
      }
    }
  })

  savePlayerData(player)
  return player.world_events.active
}

/**
 * Get current event effects
 */
export function getActiveEventEffects(player) {
  const effects = {
    heatGainMultiplier: 1,
    heatDecayMultiplier: 1,
    pursuitChanceMultiplier: 1,
    crimeSuccessBonus: 0,
    crimePayoutMultiplier: 1,
    heistSuccessBonus: 0,
    tradingPriceMultiplier: 1,
    territoryPayoutMultiplier: 1,
    xpMultiplier: 1,
    witnessChanceReduction: 0,
    pickpocketPayoutMultiplier: 1
  }

  const activeEvents = player.world_events?.active || []
  const now = Date.now()

  activeEvents.forEach(event => {
    if (now < event.expiresAt && event.effects) {
      Object.keys(event.effects).forEach(key => {
        if (key.includes('Multiplier')) {
          effects[key] *= event.effects[key]
        } else if (key.includes('Bonus') || key.includes('Reduction')) {
          effects[key] += event.effects[key]
        }
      })
    }
  })

  return effects
}

// ============================================
// HEAT REDUCTION METHODS
// ============================================

export const HEAT_REDUCTION_METHODS = [
  {
    id: 'bribe_cop',
    name: 'Bribe a Cop',
    description: 'Pay off a dirty cop to look the other way',
    costMin: 500,
    costMax: 2000,
    heatReduction: { min: 15, max: 30 },
    failChance: 0.15,
    failPenalty: 20,
    cooldown: 5 * 60 * 1000, // 5 minutes
    icon: '💸'
  },
  {
    id: 'safe_house',
    name: 'Safe House',
    description: 'Lay low at a secure location',
    costPerMinute: 50,
    heatReductionPerMinute: 5,
    minDuration: 5 * 60 * 1000, // 5 minutes minimum
    maxDuration: 30 * 60 * 1000, // 30 minutes max
    requires: 'property',
    icon: '🏠'
  },
  {
    id: 'leave_city',
    name: 'Leave the City',
    description: 'Skip town until things cool down',
    cost: 5000,
    heatReduction: 40,
    duration: 2 * 60 * 60 * 1000, // 2 hours
    disablesPlay: true,
    icon: '🚗'
  },
  {
    id: 'plastic_surgery',
    name: 'Plastic Surgery',
    description: 'Change your appearance completely',
    cost: 25000,
    heatReduction: 50,
    cooldown: 24 * 60 * 60 * 1000, // 24 hours
    oneTime: false,
    icon: '🏥'
  },
  {
    id: 'witness_elimination',
    name: 'Handle Witnesses',
    description: 'Make sure no one talks',
    cost: 5000,
    heatReduction: 25,
    failChance: 0.2,
    failPenalty: 30,
    cooldown: 60 * 60 * 1000, // 1 hour
    icon: '🤫',
    risky: true
  }
]

/**
 * Perform heat reduction method
 */
export function performHeatReduction(player, methodId) {
  const method = HEAT_REDUCTION_METHODS.find(m => m.id === methodId)
  if (!method) return { success: false, message: 'Invalid method' }

  const now = Date.now()

  // Check cooldown
  const cooldowns = player.heat_reduction_cooldowns || {}
  if (cooldowns[methodId] && now < cooldowns[methodId]) {
    const remaining = Math.ceil((cooldowns[methodId] - now) / 60000)
    return { success: false, message: `Available in ${remaining} minutes` }
  }

  // Calculate cost
  let cost = method.cost || 0
  if (method.costMin && method.costMax) {
    cost = Math.floor(method.costMin + Math.random() * (method.costMax - method.costMin))
  }

  // Check if player can afford
  if ((player.cash || 0) < cost) {
    return { success: false, message: `Need $${cost.toLocaleString()}` }
  }

  // Check for failure
  if (method.failChance && Math.random() < method.failChance) {
    // Failed - add heat instead
    player.heat = Math.min(100, (player.heat || 0) + method.failPenalty)
    player.cash -= Math.floor(cost / 2) // Still lose half the money
    player.heat_reduction_cooldowns = { ...cooldowns, [methodId]: now + (method.cooldown || 0) }
    savePlayerData(player)
    return {
      success: false,
      message: `Failed! +${method.failPenalty} heat`,
      heatChange: method.failPenalty,
      costPaid: Math.floor(cost / 2)
    }
  }

  // Success - reduce heat
  let heatReduction = method.heatReduction || 0
  if (typeof heatReduction === 'object') {
    heatReduction = Math.floor(heatReduction.min + Math.random() * (heatReduction.max - heatReduction.min))
  }

  player.heat = Math.max(0, (player.heat || 0) - heatReduction)
  player.cash -= cost
  player.heat_reduction_cooldowns = { ...cooldowns, [methodId]: now + (method.cooldown || 0) }
  savePlayerData(player)

  return {
    success: true,
    message: `Heat reduced by ${heatReduction}`,
    heatChange: -heatReduction,
    costPaid: cost
  }
}

// ============================================
// POLICE HEAT SYSTEM - Wanted Levels
// ============================================

export const WANTED_LEVELS = [
  { level: 0, name: 'Clean', minHeat: 0, maxHeat: 24, pursuitChance: 0, jailTime: 0, stars: 0 },
  { level: 1, name: 'Noticed', minHeat: 25, maxHeat: 44, pursuitChance: 0.05, jailTime: 30, stars: 1 },
  { level: 2, name: 'Wanted', minHeat: 45, maxHeat: 64, pursuitChance: 0.15, jailTime: 30, stars: 2 },
  { level: 3, name: 'Hot', minHeat: 65, maxHeat: 79, pursuitChance: 0.30, jailTime: 45, stars: 3 },
  { level: 4, name: 'Manhunt', minHeat: 80, maxHeat: 89, pursuitChance: 0.50, jailTime: 45, stars: 4 },
  { level: 5, name: 'Most Wanted', minHeat: 90, maxHeat: 100, pursuitChance: 0.75, jailTime: 60, stars: 5 },
]

export const POLICE_CONFIG = {
  // Heat decay
  heatDecayPerMinute: 2,
  layLowHeatDecayMultiplier: 3,

  // Pursuit settings
  gracePeriodAfterEscape: 3 * 60 * 1000, // 3 minutes
  pursuitWarningDuration: 2000, // 2 seconds warning before chase

  // Consequences (Forgiving mode)
  cashConfiscationMin: 0.05, // 5% min
  cashConfiscationMax: 0.15, // 15% max
  heatResetAfterJail: 15, // Reset to 15% heat after jail

  // Escape rewards (Forgiving mode)
  escapeHeatReductionMin: 20,
  escapeHeatReductionMax: 30,
  escapeXPBase: 75,
  escapeXPPerLevel: 25,

  // Item modifiers
  scannerPursuitReduction: 0.30, // -30% pursuit chance
  maskPursuitReduction: 0.15, // -15% pursuit chance
}

export const LAY_LOW_OPTIONS = {
  quick: {
    id: 'quick',
    name: 'Quick Hide',
    description: 'Duck into an alley for a bit',
    duration: 5 * 60 * 1000, // 5 minutes
    heatReduction: 10,
    energyCost: 10,
    cashCost: 0,
    icon: '🏃'
  },
  safe: {
    id: 'safe',
    name: 'Safe House',
    description: 'Lay low at a safe location',
    duration: 15 * 60 * 1000, // 15 minutes
    heatReduction: 25,
    energyCost: 0,
    cashCost: 500,
    icon: '🏠'
  },
  leave: {
    id: 'leave',
    name: 'Leave Town',
    description: 'Skip town until things cool down',
    duration: 30 * 60 * 1000, // 30 minutes
    heatReduction: 50,
    energyCost: 0,
    cashCost: 2000,
    icon: '🚗'
  }
}

// ============================================
// DISTRICT HEAT SYSTEM - Per-District Tracking
// ============================================

// District heat modifiers based on police_presence level
export const DISTRICT_HEAT_CONFIG = {
  // Heat gain modifier based on police presence (1-5)
  heatGainModifier: {
    1: 0.6,   // Port Lands - low police, 40% less heat
    2: 0.8,   // Parkdale, Etobicoke, Kensington, Chinatown - 20% less
    3: 1.0,   // Standard districts
    4: 1.2,   // Downtown, North York - 20% more heat
    5: 1.5    // Yorkville, Financial - 50% more heat
  },
  // Heat decay rate per minute by police presence
  heatDecayRate: {
    1: 4,     // Fast decay in low-police areas
    2: 3,
    3: 2,
    4: 1.5,
    5: 1      // Slow decay in high-police areas
  },
  // Pursuit chance modifier
  pursuitModifier: {
    1: 0.5,   // 50% normal pursuit chance
    2: 0.7,
    3: 1.0,
    4: 1.3,
    5: 1.6   // 60% higher pursuit chance
  },
  // District-specific effects when heat is high
  highHeatEffects: {
    threshold: 50,  // Heat level to trigger effects
    shopMarkup: 0.15,  // 15% higher prices
    jobPayPenalty: 0.10,  // 10% less job pay
    crimeSuccessPenalty: 0.05  // 5% lower success rate
  }
}

// Get district heat for a specific district
export function getDistrictHeat(player, districtId) {
  if (!player.district_heat) {
    player.district_heat = {}
  }
  return player.district_heat[districtId] || 0
}

// Add heat to a specific district
export function addDistrictHeat(player, districtId, amount) {
  if (!player.district_heat) {
    player.district_heat = {}
  }

  const district = DISTRICTS.find(d => d.id === districtId)
  const policePresence = district?.police_presence || 3
  const modifier = DISTRICT_HEAT_CONFIG.heatGainModifier[policePresence] || 1.0

  const adjustedAmount = Math.round(amount * modifier)
  const currentHeat = player.district_heat[districtId] || 0
  player.district_heat[districtId] = Math.min(100, currentHeat + adjustedAmount)

  // Also update global heat (average of district heats weighted by recent activity)
  updateGlobalHeatFromDistricts(player)

  return {
    districtId,
    previousHeat: currentHeat,
    addedHeat: adjustedAmount,
    newHeat: player.district_heat[districtId],
    modifier
  }
}

// Decay district heat over time
export function decayDistrictHeat(player, minutesElapsed = 1) {
  if (!player.district_heat) return

  Object.keys(player.district_heat).forEach(districtId => {
    const district = DISTRICTS.find(d => d.id === districtId)
    const policePresence = district?.police_presence || 3
    const decayRate = DISTRICT_HEAT_CONFIG.heatDecayRate[policePresence] || 2

    const decay = decayRate * minutesElapsed
    player.district_heat[districtId] = Math.max(0, player.district_heat[districtId] - decay)

    // Remove entry if heat is 0
    if (player.district_heat[districtId] <= 0) {
      delete player.district_heat[districtId]
    }
  })

  updateGlobalHeatFromDistricts(player)
}

// Update global heat based on district heats
function updateGlobalHeatFromDistricts(player) {
  if (!player.district_heat || Object.keys(player.district_heat).length === 0) {
    return
  }

  // Global heat is the max of any district heat (you're as hot as your hottest district)
  const maxDistrictHeat = Math.max(...Object.values(player.district_heat))
  player.heat = Math.max(player.heat || 0, maxDistrictHeat)
}

// Get district effects based on heat level
export function getDistrictEffects(player, districtId) {
  const heat = getDistrictHeat(player, districtId)
  const district = DISTRICTS.find(d => d.id === districtId)
  const policePresence = district?.police_presence || 3

  const effects = {
    districtId,
    districtName: district?.name || 'Unknown',
    heat,
    policePresence,
    pursuitModifier: DISTRICT_HEAT_CONFIG.pursuitModifier[policePresence] || 1.0,
    heatGainModifier: DISTRICT_HEAT_CONFIG.heatGainModifier[policePresence] || 1.0,
    isHot: heat >= DISTRICT_HEAT_CONFIG.highHeatEffects.threshold,
    shopMarkup: 0,
    jobPayPenalty: 0,
    crimeSuccessPenalty: 0
  }

  // Apply high heat penalties
  if (effects.isHot) {
    effects.shopMarkup = DISTRICT_HEAT_CONFIG.highHeatEffects.shopMarkup
    effects.jobPayPenalty = DISTRICT_HEAT_CONFIG.highHeatEffects.jobPayPenalty
    effects.crimeSuccessPenalty = DISTRICT_HEAT_CONFIG.highHeatEffects.crimeSuccessPenalty
  }

  return effects
}

// Get heat status for all districts
export function getAllDistrictHeat(player) {
  return DISTRICTS.map(district => ({
    ...district,
    heat: getDistrictHeat(player, district.id),
    effects: getDistrictEffects(player, district.id)
  }))
}

// ============================================
// WITNESS SYSTEM - Clean vs Dirty Execution
// ============================================

export const WITNESS_CONFIG = {
  // Base chance of witnesses seeing the crime (modified by crime type and time)
  baseWitnessChance: {
    petty: 0.30,      // 30% chance of witnesses for petty crimes
    theft: 0.40,
    violent: 0.60,    // 60% for violent crimes
    vehicle: 0.45,
    fraud: 0.20,      // Fraud is less visible
    drugs: 0.35,
    organized: 0.25,
    cyber: 0.10,      // Cyber crimes rarely have witnesses
    classic: 0.35,
    territory: 0.55,  // Territory crimes are public
    whitecollar: 0.15,
    vice: 0.30
  },
  // Time of day modifiers for witness chance
  timeModifiers: {
    morning: 1.3,    // More witnesses in morning
    afternoon: 1.5,  // Most witnesses in afternoon
    evening: 0.8,    // Fewer in evening
    night: 0.4       // Least witnesses at night
  },
  // Effects of witness presence
  effects: {
    clean: {
      heatMultiplier: 0.6,      // 40% less heat
      pursuitMultiplier: 0.5,   // 50% less pursuit chance
      xpBonus: 1.15,            // 15% more XP for clean execution
      message: 'Clean getaway - no witnesses!'
    },
    dirty: {
      heatMultiplier: 1.4,      // 40% more heat
      pursuitMultiplier: 1.5,   // 50% more pursuit chance
      xpBonus: 1.0,             // Normal XP
      message: 'Witnesses spotted you!'
    },
    compromised: {
      heatMultiplier: 2.0,      // Double heat
      pursuitMultiplier: 2.0,   // Double pursuit chance
      xpBonus: 0.8,             // Less XP
      message: 'Multiple witnesses - you were identified!'
    }
  },
  // Skill modifiers that reduce witness chance
  skillModifiers: {
    mask: 0.7,            // Ski mask reduces chance by 30%
    insider: 0.8,         // Insider crew reduces by 20%
    experienced: 0.95     // Each 10 levels = 5% reduction
  }
}

// Calculate witness outcome for a crime
export function calculateWitnessOutcome(player, crime, timeOfDay) {
  const tier = crime.tier || 'petty'
  let baseChance = WITNESS_CONFIG.baseWitnessChance[tier] || 0.35

  // Apply time modifier
  const timeMod = WITNESS_CONFIG.timeModifiers[timeOfDay] || 1.0
  baseChance *= timeMod

  // Apply player level reduction (experienced criminals are more careful)
  const levelReduction = Math.floor((player.level || 1) / 10) * 0.05
  baseChance *= (1 - Math.min(levelReduction, 0.25)) // Max 25% reduction from level

  // Apply item modifiers
  if (player.inventory && player.inventory.some(i => i.id === 'mask')) {
    baseChance *= WITNESS_CONFIG.skillModifiers.mask
  }

  // Roll for witnesses
  const roll = Math.random()

  if (roll > baseChance * 1.5) {
    // Clean execution - no witnesses at all
    return {
      outcome: 'clean',
      ...WITNESS_CONFIG.effects.clean,
      roll,
      threshold: baseChance
    }
  } else if (roll > baseChance) {
    // Dirty - some witnesses
    return {
      outcome: 'dirty',
      ...WITNESS_CONFIG.effects.dirty,
      roll,
      threshold: baseChance
    }
  } else {
    // Compromised - multiple witnesses, possibly identified
    return {
      outcome: 'compromised',
      ...WITNESS_CONFIG.effects.compromised,
      roll,
      threshold: baseChance
    }
  }
}

// Get witness chance preview for a crime
export function getWitnessChancePreview(player, crime, timeOfDay) {
  const tier = crime.tier || 'petty'
  let baseChance = WITNESS_CONFIG.baseWitnessChance[tier] || 0.35
  const timeMod = WITNESS_CONFIG.timeModifiers[timeOfDay] || 1.0
  baseChance *= timeMod

  const levelReduction = Math.floor((player.level || 1) / 10) * 0.05
  baseChance *= (1 - Math.min(levelReduction, 0.25))

  if (player.inventory && player.inventory.some(i => i.id === 'mask')) {
    baseChance *= WITNESS_CONFIG.skillModifiers.mask
  }

  const cleanChance = Math.round((1 - baseChance * 1.5) * 100)
  const dirtyChance = Math.round((baseChance * 0.5) * 100)
  const compromisedChance = Math.round(baseChance * 100)

  return {
    cleanChance: Math.max(0, cleanChance),
    dirtyChance: Math.max(0, Math.min(100 - cleanChance, dirtyChance)),
    compromisedChance: Math.max(0, compromisedChance),
    riskLevel: baseChance < 0.25 ? 'Low' : baseChance < 0.5 ? 'Medium' : 'High'
  }
}

// ============================================
// HEIST PLANNING SYSTEM - Pre-Heist Preparation
// ============================================

export const HEIST_PLANNING_CONFIG = {
  // Planning activities available before a heist
  activities: [
    {
      id: 'scout',
      name: 'Scout Location',
      description: 'Case the target for entry points and guard patterns',
      duration: 60,  // seconds
      energyCost: 15,
      maxLevel: 3,   // Can do up to 3 times
      bonuses: {
        successBonus: 5,    // +5% success per level
        heatReduction: 0,
        escapeBonus: 0
      },
      icon: '🔍'
    },
    {
      id: 'intel',
      name: 'Gather Intel',
      description: 'Research security systems and schedules',
      duration: 45,
      energyCost: 10,
      maxLevel: 2,
      bonuses: {
        successBonus: 3,
        heatReduction: 10,  // -10% heat per level
        escapeBonus: 0
      },
      icon: '📋'
    },
    {
      id: 'escape_route',
      name: 'Plan Escape',
      description: 'Map out getaway routes and safe houses',
      duration: 50,
      energyCost: 12,
      maxLevel: 3,
      bonuses: {
        successBonus: 0,
        heatReduction: 0,
        escapeBonus: 15    // +15% escape chance per level
      },
      icon: '🚗'
    },
    {
      id: 'equipment',
      name: 'Prep Equipment',
      description: 'Gather and test specialized gear',
      duration: 40,
      energyCost: 8,
      maxLevel: 2,
      bonuses: {
        successBonus: 4,
        heatReduction: 5,
        escapeBonus: 5
      },
      icon: '🛠️'
    },
    {
      id: 'bribe_insider',
      name: 'Bribe Insider',
      description: 'Pay off an employee for inside help',
      duration: 30,
      energyCost: 5,
      cashCost: 1000,   // Costs money
      maxLevel: 1,
      bonuses: {
        successBonus: 10,
        heatReduction: 15,
        escapeBonus: 0
      },
      icon: '💰'
    }
  ],
  // Minimum planning required by heist difficulty
  minPlanningByDifficulty: {
    1: 0,    // Easy heists need no planning
    2: 0,
    3: 1,    // Medium heists need 1 planning activity
    4: 2,    // Hard heists need 2
    5: 2,
    6: 3,    // Extreme heists need 3
    7: 3,
    10: 4   // Legendary needs 4
  },
  // Planning decay - plans lose effectiveness over time
  planningDecayHours: 24,  // Plans expire after 24 hours
  maxTotalBonuses: {
    successBonus: 30,     // Max 30% success bonus from planning
    heatReduction: 40,    // Max 40% heat reduction
    escapeBonus: 45       // Max 45% escape bonus
  }
}

// Initialize or get heist planning state
export function getHeistPlanning(player, heistId) {
  if (!player.heist_planning) {
    player.heist_planning = {}
  }
  if (!player.heist_planning[heistId]) {
    player.heist_planning[heistId] = {
      activities: {},
      startedAt: null,
      totalBonuses: {
        successBonus: 0,
        heatReduction: 0,
        escapeBonus: 0
      }
    }
  }
  return player.heist_planning[heistId]
}

// Perform a planning activity for a heist
export function performPlanningActivity(player, heistId, activityId) {
  const activity = HEIST_PLANNING_CONFIG.activities.find(a => a.id === activityId)
  if (!activity) {
    return { success: false, message: 'Invalid planning activity' }
  }

  const planning = getHeistPlanning(player, heistId)

  // Check if already at max level for this activity
  const currentLevel = planning.activities[activityId] || 0
  if (currentLevel >= activity.maxLevel) {
    return { success: false, message: `Already completed ${activity.name} (max level)` }
  }

  // Check energy
  if ((player.energy || 0) < activity.energyCost) {
    return { success: false, message: 'Not enough energy' }
  }

  // Check cash if required
  if (activity.cashCost && (player.cash || 0) < activity.cashCost) {
    return { success: false, message: `Need $${activity.cashCost} to bribe insider` }
  }

  // Deduct resources
  player.energy -= activity.energyCost
  if (activity.cashCost) {
    player.cash -= activity.cashCost
  }

  // Update activity level
  planning.activities[activityId] = currentLevel + 1
  if (!planning.startedAt) {
    planning.startedAt = Date.now()
  }

  // Calculate total bonuses
  recalculatePlanningBonuses(planning)

  savePlayerData(player)

  return {
    success: true,
    message: `Completed ${activity.name}!`,
    newLevel: planning.activities[activityId],
    bonuses: planning.totalBonuses,
    duration: activity.duration
  }
}

// Recalculate total planning bonuses
function recalculatePlanningBonuses(planning) {
  planning.totalBonuses = {
    successBonus: 0,
    heatReduction: 0,
    escapeBonus: 0
  }

  Object.entries(planning.activities).forEach(([activityId, level]) => {
    const activity = HEIST_PLANNING_CONFIG.activities.find(a => a.id === activityId)
    if (activity && level > 0) {
      planning.totalBonuses.successBonus += activity.bonuses.successBonus * level
      planning.totalBonuses.heatReduction += activity.bonuses.heatReduction * level
      planning.totalBonuses.escapeBonus += activity.bonuses.escapeBonus * level
    }
  })

  // Cap bonuses
  const caps = HEIST_PLANNING_CONFIG.maxTotalBonuses
  planning.totalBonuses.successBonus = Math.min(planning.totalBonuses.successBonus, caps.successBonus)
  planning.totalBonuses.heatReduction = Math.min(planning.totalBonuses.heatReduction, caps.heatReduction)
  planning.totalBonuses.escapeBonus = Math.min(planning.totalBonuses.escapeBonus, caps.escapeBonus)
}

// Check if heist planning is still valid (not expired)
export function isPlanningValid(player, heistId) {
  const planning = getHeistPlanning(player, heistId)
  if (!planning.startedAt) return true  // No planning started yet

  const hoursElapsed = (Date.now() - planning.startedAt) / (1000 * 60 * 60)
  return hoursElapsed < HEIST_PLANNING_CONFIG.planningDecayHours
}

// Get planning status for heist display
export function getHeistPlanningStatus(player, heistId, heistDifficulty) {
  const planning = getHeistPlanning(player, heistId)
  const minRequired = HEIST_PLANNING_CONFIG.minPlanningByDifficulty[heistDifficulty] || 0
  const activitiesCompleted = Object.values(planning.activities).filter(v => v > 0).length
  const isValid = isPlanningValid(player, heistId)

  return {
    planning,
    activitiesCompleted,
    minRequired,
    meetsMinimum: activitiesCompleted >= minRequired,
    isValid,
    bonuses: isValid ? planning.totalBonuses : { successBonus: 0, heatReduction: 0, escapeBonus: 0 },
    readyToExecute: activitiesCompleted >= minRequired && isValid
  }
}

// Clear heist planning after execution
export function clearHeistPlanning(player, heistId) {
  if (player.heist_planning && player.heist_planning[heistId]) {
    delete player.heist_planning[heistId]
    savePlayerData(player)
  }
}

// ============================================
// HEIST REQUIREMENTS - Special conditions for heists
// ============================================

/**
 * Check if a heist's special requirements are met
 * @param {Object} player - Player data
 * @param {Object} heist - Heist data with requires/bonus fields
 * @returns {Object} { canStart, requirements, bonuses, messages }
 */
export function checkHeistRequirements(player, heist) {
  const crewMembers = player.crewMembers || []
  const timeOfDay = getTimeOfDay()
  const requirements = []
  const bonuses = []
  const messages = []
  let canStart = true

  // Check special requirements
  if (heist.requires) {
    switch (heist.requires) {
      case 'night_only':
        const isNight = timeOfDay === 'night' || timeOfDay === 'evening'
        requirements.push({
          id: 'night_only',
          name: 'Night Only',
          icon: '🌙',
          met: isNight,
          message: isNight ? 'Darkness provides cover' : 'Wait until nightfall (6PM-6AM)'
        })
        if (!isNight) {
          canStart = false
          messages.push('This heist can only be done at night')
        }
        break

      case 'hacker':
        const hasHacker = crewMembers.some(m => m.role === 'hacker')
        requirements.push({
          id: 'hacker',
          name: 'Hacker Required',
          icon: '💻',
          met: hasHacker,
          message: hasHacker ? 'Luna can bypass security' : 'Recruit a hacker crew member'
        })
        if (!hasHacker) {
          canStart = false
          messages.push('Need a hacker to bypass security systems')
        }
        break

      case 'art_fence':
        // Art fence is unlocked at higher levels or with specific contacts
        const hasArtFence = (player.level || 1) >= 25 || (player.contacts || []).includes('art_fence')
        requirements.push({
          id: 'art_fence',
          name: 'Art Fence Contact',
          icon: '🖼️',
          met: hasArtFence,
          message: hasArtFence ? 'You know someone who moves art' : 'Need art fence contact (Level 25+)'
        })
        if (!hasArtFence) {
          canStart = false
          messages.push('Need a contact to fence stolen art')
        }
        break

      case 'full_crew':
        const crewSize = crewMembers.length
        const maxCrew = heist.max_crew || 6
        const hasFull = crewSize >= maxCrew
        requirements.push({
          id: 'full_crew',
          name: 'Full Crew Required',
          icon: '👥',
          met: hasFull,
          message: hasFull ? `Full crew of ${crewSize} ready` : `Need ${maxCrew} crew members (have ${crewSize})`
        })
        if (!hasFull) {
          canStart = false
          messages.push(`This heist requires a full crew of ${maxCrew}`)
        }
        break
    }
  }

  // Check for bonuses
  if (heist.bonus) {
    switch (heist.bonus) {
      case 'driver':
        const hasDriver = crewMembers.some(m => m.role === 'driver')
        if (hasDriver) {
          bonuses.push({
            id: 'driver',
            name: 'Getaway Driver',
            icon: '🚗',
            effect: '+20% escape chance',
            value: 0.20
          })
        }
        break

      case 'locksmith':
        const hasLocksmith = crewMembers.some(m => m.role === 'locksmith')
        if (hasLocksmith) {
          bonuses.push({
            id: 'locksmith',
            name: 'Safe Cracker',
            icon: '🔓',
            effect: '+15% success rate',
            value: 0.15
          })
        }
        break
    }
  }

  // Always check for hacker bonus (even if not required)
  const hackerMember = crewMembers.find(m => m.role === 'hacker')
  if (hackerMember && heist.requires !== 'hacker') {
    bonuses.push({
      id: 'hacker_bonus',
      name: 'Security Bypass',
      icon: '💻',
      effect: '+10% success rate',
      value: 0.10
    })
  }

  return {
    canStart,
    requirements,
    bonuses,
    messages,
    hasRequirements: requirements.length > 0,
    hasBonuses: bonuses.length > 0
  }
}

// ============================================
// LAWYER SYSTEM - Legal Representation
// ============================================

export const LAWYERS = [
  {
    id: 'public',
    name: 'Public Defender',
    description: 'Free but overworked. Basic representation.',
    retainer: 0,
    perCase: 0,
    bailReduction: 0,
    sentenceReduction: 0,
    icon: '⚖️',
    minLevel: 1
  },
  {
    id: 'street',
    name: 'Street Lawyer',
    description: 'Knows the local courts. Gets you out faster.',
    retainer: 1000,
    perCase: 500,
    bailReduction: 0.20,
    sentenceReduction: 0.15,
    icon: '📋',
    minLevel: 5
  },
  {
    id: 'criminal',
    name: 'Criminal Attorney',
    description: 'Experienced defender. Plea deals available.',
    retainer: 5000,
    perCase: 2000,
    bailReduction: 0.40,
    sentenceReduction: 0.30,
    icon: '🏛️',
    minLevel: 10
  },
  {
    id: 'elite',
    name: 'Elite Defense',
    description: 'Top-tier representation. Can dismiss charges.',
    retainer: 20000,
    perCase: 10000,
    bailReduction: 0.60,
    sentenceReduction: 0.50,
    icon: '👔',
    minLevel: 20
  },
  {
    id: 'fixer',
    name: 'The Fixer',
    description: 'Makes problems disappear. No questions asked.',
    retainer: 100000,
    perCase: 25000,
    bailReduction: 0.80,
    sentenceReduction: 0.70,
    icon: '🎭',
    minLevel: 35
  }
]

// ============================================
// ENHANCED JAIL SYSTEM - Timing by Wanted Level
// ============================================

export const JAIL_TIMES = {
  1: 2 * 60 * 1000,   // 2 minutes for Noticed
  2: 5 * 60 * 1000,   // 5 minutes for Wanted
  3: 15 * 60 * 1000,  // 15 minutes for Hot
  4: 30 * 60 * 1000,  // 30 minutes for Manhunt
  5: 60 * 60 * 1000   // 60 minutes for Most Wanted
}

export const JAIL_ACTIVITIES = [
  {
    id: 'work_detail',
    name: 'Work Detail',
    description: 'Earn a little cash and reduce time',
    icon: '🔨',
    cooldown: 30000, // 30 seconds
    effects: {
      cashMin: 5,
      cashMax: 20,
      timeReduction: 10000 // 10 seconds off sentence
    }
  },
  {
    id: 'connections',
    name: 'Make Connections',
    description: 'Network with other inmates',
    icon: '🤝',
    cooldown: 60000, // 60 seconds
    effects: {
      prisonRep: 5, // Future use
      unlockContacts: true
    }
  },
  {
    id: 'plan_escape',
    name: 'Plan Escape',
    description: 'Increase your jailbreak chances',
    icon: '📝',
    cooldown: 120000, // 2 minutes
    effects: {
      jailbreakBonus: 5 // +5% to jailbreak success
    }
  },
  {
    id: 'lay_low',
    name: 'Lay Low',
    description: 'Good behavior for faster release',
    icon: '😴',
    cooldown: 0, // Toggle, no cooldown
    effects: {
      timeMultiplier: 1.2 // Time passes 20% faster
    }
  }
]

// ============================================
// PAROLE SYSTEM - Early release from jail
// ============================================

export const PAROLE_CONFIG = {
  eligibleAfterPercent: 0.50, // Can request parole after 50% of sentence
  baseSuccessChance: 0.40, // 40% base chance
  goodBehaviorBonus: 0.15, // +15% if laying low
  lawyerBonus: 0.20, // +20% with lawyer
  priorParolesPenalty: 0.10, // -10% per previous parole granted
  cooldownAfterDenial: 60000 // 1 minute before can request again
}

// Request parole hearing - can only be done after serving 50% of sentence
export function requestParole(player) {
  if (!player.is_jailed || !player.jail_until) {
    return { success: false, message: 'You are not in jail' }
  }

  const now = Date.now()
  const jailEnd = new Date(player.jail_until).getTime()
  const jailStart = player.jail_start ? new Date(player.jail_start).getTime() : (jailEnd - JAIL_TIMES[player.jail_wanted_level || 1])
  const totalSentence = jailEnd - jailStart
  const timeServed = now - jailStart
  const percentServed = timeServed / totalSentence

  // Check if eligible (50% served)
  if (percentServed < PAROLE_CONFIG.eligibleAfterPercent) {
    const percentNeeded = Math.ceil(PAROLE_CONFIG.eligibleAfterPercent * 100)
    const currentPercent = Math.floor(percentServed * 100)
    return {
      success: false,
      message: `Must serve ${percentNeeded}% of sentence (currently ${currentPercent}%)`,
      percentServed: currentPercent
    }
  }

  // Check cooldown after denial
  if (player.parole_denied_at) {
    const deniedAt = new Date(player.parole_denied_at).getTime()
    if (now - deniedAt < PAROLE_CONFIG.cooldownAfterDenial) {
      const remaining = Math.ceil((PAROLE_CONFIG.cooldownAfterDenial - (now - deniedAt)) / 1000)
      return { success: false, message: `Wait ${remaining}s before requesting again` }
    }
  }

  // Calculate success chance
  let successChance = PAROLE_CONFIG.baseSuccessChance

  // Good behavior bonus (if laying low)
  if (player.laying_low) {
    successChance += PAROLE_CONFIG.goodBehaviorBonus
  }

  // Lawyer bonus
  const lawyer = getPlayerLawyer(player)
  if (lawyer && lawyer.id !== 'public') {
    successChance += PAROLE_CONFIG.lawyerBonus * (lawyer.sentenceReduction || 0.2)
  }

  // Prior paroles penalty
  const priorParoles = player.paroles_granted || 0
  successChance -= (priorParoles * PAROLE_CONFIG.priorParolesPenalty)

  // Clamp between 10% and 85%
  successChance = Math.max(0.10, Math.min(0.85, successChance))

  // Roll for parole
  const roll = Math.random()

  if (roll < successChance) {
    // Parole granted!
    player.is_jailed = false
    player.jail_until = null
    player.paroles_granted = (player.paroles_granted || 0) + 1
    player.on_parole = true
    player.parole_until = new Date(now + 24 * 60 * 60 * 1000).toISOString() // 24 hour parole period
    player.jailbreakBonus = 0
    player.stats.jail_escapes = (player.stats?.jail_escapes || 0) + 1

    // Track lawyer case history for parole
    if (lawyer && lawyer.id !== 'public') {
      player.lawyer_cases = player.lawyer_cases || []
      player.lawyer_cases.push({
        date: new Date().toISOString(),
        type: 'parole',
        lawyer: lawyer.id,
        lawyerName: lawyer.name,
        chance: Math.round(successChance * 100),
        result: 'granted',
        savedTime: 'Early release'
      })
      if (player.lawyer_cases.length > 20) {
        player.lawyer_cases = player.lawyer_cases.slice(-20)
      }
    }

    savePlayerData(player)

    return {
      success: true,
      granted: true,
      message: 'Parole GRANTED! You are released on good behavior.',
      chance: Math.round(successChance * 100),
      onParole: true,
      paroleEnds: player.parole_until
    }
  } else {
    // Parole denied
    player.parole_denied_at = new Date(now).toISOString()
    savePlayerData(player)

    return {
      success: true,
      granted: false,
      message: 'Parole DENIED. The board did not find your case compelling.',
      chance: Math.round(successChance * 100)
    }
  }
}

// Check parole status - if on parole and committing crimes, risk re-arrest
export function checkParoleViolation(player, actionType) {
  if (!player.on_parole || !player.parole_until) return { violated: false }

  const now = Date.now()
  const paroleEnd = new Date(player.parole_until).getTime()

  // Parole expired naturally
  if (now >= paroleEnd) {
    player.on_parole = false
    player.parole_until = null
    savePlayerData(player)
    return { violated: false, expired: true }
  }

  // Check for violation based on action type
  if (actionType === 'crime') {
    // 30% chance of violation detection when committing crimes on parole
    if (Math.random() < 0.30) {
      player.on_parole = false
      player.parole_until = null

      // Re-arrest with extended sentence
      const wantedLevel = Math.min(5, (player.jail_wanted_level || 1) + 1)
      player.jail_wanted_level = wantedLevel
      player.is_jailed = true
      player.jail_start = new Date(now).toISOString()
      player.jail_until = new Date(now + JAIL_TIMES[wantedLevel] * 1.5).toISOString() // 50% longer sentence
      player.stats.times_jailed = (player.stats?.times_jailed || 0) + 1

      savePlayerData(player)

      return {
        violated: true,
        message: 'PAROLE VIOLATION! You were caught committing a crime and sent back to jail with an extended sentence!',
        newSentence: JAIL_TIMES[wantedLevel] * 1.5
      }
    }
  }

  return { violated: false }
}

// ============================================
// ENERGY SCALING - Max energy by player level
// ============================================

export const ENERGY_SCALING = {
  1: { maxEnergy: 100, regenRate: 5 },   // Level 1-10
  11: { maxEnergy: 120, regenRate: 6 },  // Level 11-25
  26: { maxEnergy: 150, regenRate: 7 },  // Level 26-40
  41: { maxEnergy: 180, regenRate: 8 },  // Level 41-50
  51: { maxEnergy: 200, regenRate: 10 }  // Level 51+
}

export function getEnergyStats(playerLevel) {
  const level = playerLevel || 1

  // Find appropriate tier
  const tiers = Object.keys(ENERGY_SCALING).map(Number).sort((a, b) => b - a)
  for (const tier of tiers) {
    if (level >= tier) {
      return ENERGY_SCALING[tier]
    }
  }
  return ENERGY_SCALING[1]
}

// Update player's max energy based on level
export function updatePlayerEnergy(player) {
  const stats = getEnergyStats(player.level || 1)
  const oldMax = player.maxEnergy || 100
  player.maxEnergy = stats.maxEnergy
  player.energyRegenRate = stats.regenRate

  // If max energy increased, grant bonus energy
  if (stats.maxEnergy > oldMax) {
    player.energy = Math.min(stats.maxEnergy, (player.energy || 0) + (stats.maxEnergy - oldMax))
  }

  return stats
}

// ============================================
// DYNAMIC COOLDOWNS - Various modifiers
// ============================================

export const COOLDOWN_MODIFIERS = {
  crewHacker: -0.20,       // -20% cooldown with hacker in crew
  burnerPhone: -0.15,      // -15% with burner phone item
  highHeat: 0.50,          // +50% cooldown at heat level 4+
  sameCategory: 0.25,      // +25% for same crime category in a row
  varietyBonus: -0.10,     // -10% for switching crime categories
  lawyerBonus: -0.10       // -10% with lawyer on retainer
}

export const CRIME_CATEGORIES = {
  petty: ['pickpocket', 'shoplift', 'carbreak', 'purse_snatch', 'phone_theft', 'tip_jar_theft'],
  violent: ['mugging', 'assault', 'intimidation', 'drive_by', 'gang_war'],
  property: ['burglary', 'cartheft', 'vandalism', 'arson', 'mansion_burglary'],
  drugs: ['drugdeal', 'drug_run', 'meth_cook', 'drug_lab'],
  organized: ['armedrobbery', 'bankheist', 'kidnapping', 'extortion', 'protection_collect'],
  whitecollar: ['embezzlement', 'stock_manipulation', 'tax_evasion', 'bribery', 'blackmail'],
  vice: ['underground_poker', 'dice_game', 'fight_club', 'escort_ring', 'bootleg_goods'],
  territory: ['turf_takeover', 'territory_defend', 'gang_war']
}

// Get the category of a crime
export function getCrimeCategory(crimeId) {
  for (const [category, crimes] of Object.entries(CRIME_CATEGORIES)) {
    if (crimes.includes(crimeId)) return category
  }
  return 'other'
}

// Calculate dynamic cooldown for crimes
export function calculateDynamicCooldown(player, baseCooldown, crimeId) {
  let modifier = 1.0

  // Check for crew hacker
  const crewMembers = player.crewMembers || []
  const hasHacker = crewMembers.some(m => m.role === 'hacker' || m.specialty === 'hacker')
  if (hasHacker) {
    modifier += COOLDOWN_MODIFIERS.crewHacker
  }

  // Check for burner phone
  const inventory = player.inventory || []
  const hasBurnerPhone = inventory.some(i => i.id === 'phone' || i.id === 'burner_phone')
  if (hasBurnerPhone) {
    modifier += COOLDOWN_MODIFIERS.burnerPhone
  }

  // High heat penalty
  const wantedLevel = getWantedLevel(player.heat || 0).level
  if (wantedLevel >= 4) {
    modifier += COOLDOWN_MODIFIERS.highHeat
  }

  // Check for lawyer on retainer
  if (player.lawyer && player.lawyer !== 'public') {
    modifier += COOLDOWN_MODIFIERS.lawyerBonus
  }

  // Crime variety bonus/penalty
  const lastCrimeCategory = player.lastCrimeCategory
  const currentCategory = getCrimeCategory(crimeId)

  if (lastCrimeCategory) {
    if (lastCrimeCategory === currentCategory) {
      // Same category = penalty (cops are watching for this pattern)
      modifier += COOLDOWN_MODIFIERS.sameCategory
    } else {
      // Different category = bonus (unpredictable)
      modifier += COOLDOWN_MODIFIERS.varietyBonus
    }
  }

  // Update last crime category and persist
  player.lastCrimeCategory = currentCategory
  savePlayerData(player)

  // Clamp modifier between 0.5x and 2.0x
  modifier = Math.max(0.5, Math.min(2.0, modifier))

  return Math.round(baseCooldown * modifier)
}

// Get cooldown status text for UI
export function getCooldownModifiersText(player, crimeId) {
  const modifiers = []

  const crewMembers = player.crewMembers || []
  const hasHacker = crewMembers.some(m => m.role === 'hacker' || m.specialty === 'hacker')
  if (hasHacker) modifiers.push({ text: 'Hacker: -20%', color: 0x22c55e })

  const inventory = player.inventory || []
  const hasBurnerPhone = inventory.some(i => i.id === 'phone' || i.id === 'burner_phone')
  if (hasBurnerPhone) modifiers.push({ text: 'Burner Phone: -15%', color: 0x22c55e })

  const wantedLevel = getWantedLevel(player.heat || 0).level
  if (wantedLevel >= 4) modifiers.push({ text: 'High Heat: +50%', color: 0xef4444 })

  if (player.lawyer && player.lawyer !== 'public') {
    modifiers.push({ text: 'Lawyer: -10%', color: 0x22c55e })
  }

  const lastCrimeCategory = player.lastCrimeCategory
  const currentCategory = getCrimeCategory(crimeId)

  if (lastCrimeCategory) {
    if (lastCrimeCategory === currentCategory) {
      modifiers.push({ text: 'Same Type: +25%', color: 0xf59e0b })
    } else {
      modifiers.push({ text: 'Variety: -10%', color: 0x22c55e })
    }
  }

  return modifiers
}

// ============================================
// TIME-OF-DAY SYSTEM (Real Device Clock)
// ============================================

export const TIME_PERIODS = {
  morning: { start: 6, end: 12, name: 'Morning', icon: '🌅' },
  afternoon: { start: 12, end: 18, name: 'Afternoon', icon: '☀️' },
  evening: { start: 18, end: 24, name: 'Evening', icon: '🌆' },
  night: { start: 0, end: 6, name: 'Night', icon: '🌙' }
}

export const TIME_MODIFIERS = {
  morning: {
    successMod: -0.10,
    heatMod: 1.20,
    jobPayMod: 1.0,
    description: 'More witnesses, higher risk'
  },
  afternoon: {
    successMod: 0,
    heatMod: 1.0,
    jobPayMod: 1.10, // Peak hours = better tips
    description: 'Normal conditions'
  },
  evening: {
    successMod: 0.10,
    heatMod: 1.0,
    jobPayMod: 1.05,
    description: 'Darkness provides cover'
  },
  night: {
    successMod: 0.20,
    heatMod: 0.80,
    jobPayMod: 0.90, // Fewer customers
    description: 'Best time for ops, fewer patrols'
  }
}

// Get current time period based on real device clock
export function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 24) return 'evening'
  return 'night' // 0-5
}

// Get time modifier for current period
export function getCurrentTimeModifier() {
  const period = getTimeOfDay()
  return {
    period,
    ...TIME_MODIFIERS[period],
    ...TIME_PERIODS[period]
  }
}

// Apply time modifier to crime success rate
export function applyTimeModifierToCrime(baseSuccess, baseHeat) {
  const mod = getCurrentTimeModifier()
  return {
    adjustedSuccess: Math.round(baseSuccess + (baseSuccess * mod.successMod)),
    adjustedHeat: Math.round(baseHeat * mod.heatMod),
    period: mod.period,
    periodName: mod.name,
    periodIcon: mod.icon
  }
}

// Apply time modifier to job pay
export function applyTimeModifierToJob(basePay) {
  const mod = getCurrentTimeModifier()
  return {
    adjustedPay: Math.round(basePay * mod.jobPayMod),
    period: mod.period,
    periodName: mod.name,
    periodIcon: mod.icon
  }
}

// Get wanted level info from heat value
export function getWantedLevel(heat) {
  const h = Math.max(0, Math.min(100, heat || 0))
  for (let i = WANTED_LEVELS.length - 1; i >= 0; i--) {
    if (h >= WANTED_LEVELS[i].minHeat) {
      return WANTED_LEVELS[i]
    }
  }
  return WANTED_LEVELS[0]
}

// Check if pursuit should trigger after a crime
export function checkPursuitTrigger(player, crimeResult, districtId) {
  const heat = player.heat || 0
  const wantedInfo = getWantedLevel(heat)

  // No pursuit at level 0
  if (wantedInfo.level === 0) return { shouldPursue: false }

  // Check grace period
  if (player.policeGraceUntil && Date.now() < player.policeGraceUntil) {
    return { shouldPursue: false, reason: 'grace_period' }
  }

  // Get district police presence modifier
  const district = DISTRICTS.find(d => d.id === districtId)
  const policePresence = district?.police_presence || 3
  const districtModifier = policePresence / 5 // 0.2 to 1.0

  // Item modifiers
  let itemModifier = 1.0
  const inventory = player.inventory || []
  if (inventory.some(i => i.id === 'scanner' || i.item_id === 'scanner')) {
    itemModifier -= POLICE_CONFIG.scannerPursuitReduction
  }
  if (inventory.some(i => i.id === 'mask' || i.item_id === 'mask')) {
    itemModifier -= POLICE_CONFIG.maskPursuitReduction
  }
  itemModifier = Math.max(0.1, itemModifier) // Minimum 10% chance modifier

  // Failed crime at high heat = guaranteed pursuit
  if (!crimeResult.success && wantedInfo.level >= 3) {
    return {
      shouldPursue: true,
      reason: 'failed_high_heat',
      wantedLevel: wantedInfo.level,
      jailTime: wantedInfo.jailTime
    }
  }

  // Calculate final pursuit chance
  const basePursuitChance = wantedInfo.pursuitChance
  const finalChance = basePursuitChance * districtModifier * itemModifier

  const roll = Math.random()
  const shouldPursue = roll < finalChance

  return {
    shouldPursue,
    reason: shouldPursue ? 'random_patrol' : 'lucky',
    wantedLevel: wantedInfo.level,
    jailTime: wantedInfo.jailTime,
    pursuitChance: finalChance,
    roll
  }
}

// XP required for each level
export const XP_PER_LEVEL = [0, 0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000]

export function getRequiredXP(level) {
  return XP_PER_LEVEL[level] || level * 50000
}

// Local storage key
const STORAGE_KEY = 'streetLegacyPlayer'

// Get or create default player data
export function getPlayerData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Ensure all fields exist
      return {
        id: parsed.id || 'local_' + Date.now(),
        username: parsed.username || 'Player',
        level: parsed.level || 1,
        xp: parsed.xp || 0,
        cash: parsed.cash ?? 500,
        bank: parsed.bank || 0,
        energy: parsed.energy ?? 100,
        maxEnergy: parsed.maxEnergy || 100,
        stamina: parsed.stamina ?? 100,
        health: parsed.health ?? 100,
        maxHealth: parsed.maxHealth || 100,
        heat: parsed.heat || 0,
        heat_level: parsed.heat_level || 0,
        district_heat: parsed.district_heat || {},
        current_district_id: parsed.current_district_id || 'parkdale',
        current_district: parsed.current_district || DISTRICTS.find(d => d.id === 'parkdale'),
        inventory: parsed.inventory || [],
        properties: parsed.properties || [],
        crewId: parsed.crewId || null,
        stats: parsed.stats || {
          crimes_committed: 0,
          crimes_successful: 0,
          jobs_completed: 0,
          total_earnings: 0,
          times_jailed: 0,
        },
        is_jailed: parsed.is_jailed || false,
        jail_until: parsed.jail_until || null,
        jail_wanted_level: parsed.jail_wanted_level || 1,
        lawyer: parsed.lawyer || null, // Lawyer ID if hired
        lawyerRetainerPaid: parsed.lawyerRetainerPaid || false,
        jailbreakBonus: parsed.jailbreakBonus || 0, // Bonus from planning
        prisonRep: parsed.prisonRep || 0, // Prison reputation
        usedPlasticSurgery: parsed.usedPlasticSurgery || false,
        heatReductionCooldowns: parsed.heatReductionCooldowns || {},
        heist_planning: parsed.heist_planning || {},
        // Parole system
        on_parole: parsed.on_parole || false,
        parole_until: parsed.parole_until || null,
        paroles_granted: parsed.paroles_granted || 0,
        parole_denied_at: parsed.parole_denied_at || null,
        jail_start: parsed.jail_start || null,
        // Dynamic cooldowns
        lastCrimeCategory: parsed.lastCrimeCategory || null,
        heatCooldowns: parsed.heatCooldowns || {},
        is_admin: parsed.is_admin || false,
        is_master: parsed.is_master || false,
      }
    }
  } catch (e) {
    console.error('Failed to parse player data:', e)
  }

  // Return default player
  return {
    id: 'local_' + Date.now(),
    username: 'Player',
    level: 1,
    xp: 0,
    cash: 500,
    bank: 0,
    energy: 100,
    maxEnergy: 100,
    stamina: 100,
    health: 100,
    maxHealth: 100,
    heat: 0,
    heat_level: 0,
    district_heat: {},  // Per-district heat tracking
    current_district_id: 'parkdale',
    current_district: DISTRICTS.find(d => d.id === 'parkdale'),
    inventory: [],
    properties: [],
    crewId: null,
    stats: {
      crimes_committed: 0,
      crimes_successful: 0,
      jobs_completed: 0,
      total_earnings: 0,
      times_jailed: 0,
    },
    is_jailed: false,
    jail_until: null,
    jail_wanted_level: 1,
    lawyer: null,
    lawyerRetainerPaid: false,
    jailbreakBonus: 0,
    prisonRep: 0,
    usedPlasticSurgery: false,
    heatReductionCooldowns: {},
    heist_planning: {},  // Per-heist planning state
    is_admin: false,
    is_master: false,
  }
}

// Check and clean up expired parole status
export function checkParoleExpiry(player) {
  if (!player.on_parole || !player.parole_until) return { expired: false }

  const now = Date.now()
  const paroleEnd = new Date(player.parole_until).getTime()

  if (now >= paroleEnd) {
    // Parole has expired - player completed it successfully
    player.on_parole = false
    player.parole_until = null
    savePlayerData(player)

    return {
      expired: true,
      completed: true,
      message: 'Your parole period has ended. You are now free!'
    }
  }

  return { expired: false }
}

// Check and clean up expired jail status
export function checkJailExpiry(player) {
  if (!player.is_jailed || !player.jail_until) return { released: false }

  const now = Date.now()
  const jailEnd = new Date(player.jail_until).getTime()

  if (now >= jailEnd) {
    // Jail time served
    player.is_jailed = false
    player.jail_until = null
    player.jail_start = null
    player.jailbreakBonus = 0
    savePlayerData(player)

    return {
      released: true,
      message: 'You have been released from jail!'
    }
  }

  return { released: false }
}

// Initialize player state on game load - cleans up expired statuses
export function initializePlayerState(player) {
  const results = {
    paroleExpired: false,
    jailReleased: false,
    messages: []
  }

  // Check parole expiry
  const paroleCheck = checkParoleExpiry(player)
  if (paroleCheck.expired) {
    results.paroleExpired = true
    results.messages.push(paroleCheck.message)
  }

  // Check jail expiry
  const jailCheck = checkJailExpiry(player)
  if (jailCheck.released) {
    results.jailReleased = true
    results.messages.push(jailCheck.message)
  }

  // Update energy based on level (in case player leveled up offline)
  updatePlayerEnergy(player)

  return results
}

// Save player data to localStorage
export function savePlayerData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('Failed to save player data:', e)
    return false
  }
}

// Clear player data (for reset)
export function clearPlayerData() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (e) {
    console.error('Failed to clear player data:', e)
    return false
  }
}

// Check for level up and apply it
export function checkLevelUp(player) {
  let leveledUp = false
  let xpRemaining = player.xp
  let newLevel = player.level

  while (xpRemaining >= getRequiredXP(newLevel + 1)) {
    xpRemaining -= getRequiredXP(newLevel + 1)
    newLevel++
    leveledUp = true
  }

  if (leveledUp) {
    const oldLevel = player.level
    player.level = newLevel
    player.xp = xpRemaining

    // Apply energy scaling based on new level tier
    const energyStats = updatePlayerEnergy(player)

    // Additional health bonus per level
    player.maxHealth = 100 + (newLevel * 5)

    // Log level up with new energy stats
    console.log(`[LevelUp] ${oldLevel} -> ${newLevel} | Max Energy: ${energyStats.maxEnergy} | Regen: ${energyStats.regenRate}/min`)
  }

  return { leveledUp, newLevel }
}

// Execute a crime locally
export function executeCrime(player, crime) {
  const result = {
    success: false,
    cash_earned: 0,
    xp_earned: 0,
    heat_gained: 0,
    leveled_up: false,
    new_level: player.level,
    caught: false,
    message: '',
  }

  // Check energy
  if (player.energy < crime.energy_cost) {
    result.message = 'Not enough energy!'
    return result
  }

  // Deduct energy
  player.energy -= crime.energy_cost
  player.stamina = player.energy

  // Calculate success
  const successRoll = Math.random() * 100
  const successRate = crime.base_success_rate - (player.heat / 2)

  result.success = successRoll < successRate

  // Update stats
  player.stats.crimes_committed++

  // Track crimes by category
  const crimeCategory = crime.category || getCrimeCategory(crime.id) || 'other'
  player.stats.crimes_by_category = player.stats.crimes_by_category || {}
  player.stats.crimes_by_category[crimeCategory] = (player.stats.crimes_by_category[crimeCategory] || 0) + 1

  // Track time-of-day crimes
  const timeOfDay = getTimeOfDay()
  if (timeOfDay === 'night') {
    player.stats.night_crimes = (player.stats.night_crimes || 0) + 1
  } else if (timeOfDay === 'morning') {
    player.stats.morning_crimes = (player.stats.morning_crimes || 0) + 1
  }

  if (result.success) {
    // Success - earn money
    const payout = Math.floor(
      Math.random() * (crime.max_payout - crime.min_payout) + crime.min_payout
    )
    result.cash_earned = payout
    result.xp_earned = crime.xp_reward
    result.heat_gained = crime.heat_gain

    player.cash += payout
    player.xp += crime.xp_reward
    player.heat = Math.min(100, player.heat + crime.heat_gain)
    player.heat_level = player.heat
    player.stats.crimes_successful++
    player.stats.total_earnings += payout

    result.message = `Got away with $${payout}!`

    // Check for level up
    const levelCheck = checkLevelUp(player)
    result.leveled_up = levelCheck.leveledUp
    result.new_level = levelCheck.newLevel
  } else {
    // Failed
    result.heat_gained = crime.heat_gain * 2
    result.xp_earned = 5 // Small XP for trying
    player.xp += 5
    player.heat = Math.min(100, player.heat + crime.heat_gain * 2)
    player.heat_level = player.heat

    // Check if caught (high heat = higher chance)
    const catchChance = player.heat / 2
    result.caught = Math.random() * 100 < catchChance

    if (result.caught) {
      player.is_jailed = true
      player.jail_until = new Date(Date.now() + 60000).toISOString() // 1 minute jail
      player.stats.times_jailed++
      result.message = 'Busted! You were caught and sent to jail!'
    } else {
      result.message = 'Failed but got away!'
    }
  }

  // Save player data
  savePlayerData(player)

  // Return result with updated player
  result.player = { ...player }

  return result
}

// Execute a job locally
export function executeJob(player, job) {
  const result = {
    success: true,
    job_name: job.name,
    cash_earned: 0,
    xp_earned: 0,
    rep_earned: 0,
    energy_spent: 0,
    leveled_up: false,
    new_level: player.level,
    cooldown_seconds: job.cooldown_seconds || 60,
    message: '',
  }

  // Check energy
  if (player.energy < job.energy_cost) {
    result.success = false
    result.message = 'Not enough energy!'
    return result
  }

  // Deduct energy
  result.energy_spent = job.energy_cost
  player.energy -= job.energy_cost
  player.stamina = player.energy

  // Calculate pay with level bonus
  const levelBonus = 1 + (player.level * 0.05)
  const pay = Math.floor(job.base_pay * levelBonus)

  result.cash_earned = pay
  result.xp_earned = job.xp_reward
  result.rep_earned = Math.max(1, Math.floor(pay / 200))

  player.cash += pay
  player.xp += job.xp_reward
  player.stats.jobs_completed++
  player.stats.total_earnings += pay

  // Track jobs by category and time
  const jobCategory = job.category || 'service'
  player.stats.jobs_by_category = player.stats.jobs_by_category || {}
  player.stats.jobs_by_category[jobCategory] = (player.stats.jobs_by_category[jobCategory] || 0) + 1

  const timeOfDay = getTimeOfDay()
  if (timeOfDay === 'night' || timeOfDay === 'evening') {
    player.stats.night_jobs = (player.stats.night_jobs || 0) + 1
  }

  result.message = `Earned $${pay}!`

  // Check for level up
  const levelCheck = checkLevelUp(player)
  result.leveled_up = levelCheck.leveledUp
  result.new_level = levelCheck.newLevel

  // Save player data
  savePlayerData(player)

  // Return result with updated player
  result.player = { ...player }

  return result
}

// Travel to a district
export function travelToDistrict(player, districtId) {
  const district = DISTRICTS.find(d => d.id === districtId)

  if (!district) {
    return { success: false, message: 'District not found' }
  }

  if (district.min_level > player.level) {
    return { success: false, message: `Requires level ${district.min_level}` }
  }

  player.current_district_id = districtId
  player.current_district = district

  savePlayerData(player)

  return {
    success: true,
    district: district,
    message: `Arrived in ${district.name}!`,
    player: { ...player }
  }
}

// Bank deposit
export function bankDeposit(player, amount) {
  if (amount <= 0 || amount > player.cash) {
    return { success: false, message: 'Invalid amount' }
  }

  player.cash -= amount
  player.bank += amount

  savePlayerData(player)

  return {
    success: true,
    amount: amount,
    newCash: player.cash,
    newBank: player.bank,
    player: { ...player }
  }
}

// Bank withdraw
export function bankWithdraw(player, amount) {
  if (amount <= 0 || amount > player.bank) {
    return { success: false, message: 'Invalid amount' }
  }

  player.bank -= amount
  player.cash += amount

  savePlayerData(player)

  return {
    success: true,
    amount: amount,
    newCash: player.cash,
    newBank: player.bank,
    player: { ...player }
  }
}

// Use an item
export function useItem(player, itemId) {
  const inventoryIndex = player.inventory.findIndex(i => i.id === itemId || i.item_id === itemId)

  if (inventoryIndex === -1) {
    return { success: false, message: 'Item not found in inventory' }
  }

  const invItem = player.inventory[inventoryIndex]
  const item = ITEMS.find(i => i.id === itemId || i.id === invItem.item_id)

  if (!item) {
    return { success: false, message: 'Unknown item' }
  }

  let message = `Used ${item.name}`

  // Apply effects
  if (item.effect) {
    if (item.effect.energyRestore) {
      const restored = Math.min(item.effect.energyRestore, player.maxEnergy - player.energy)
      player.energy += restored
      player.stamina = player.energy
      message = `Restored ${restored} energy!`
    }
    if (item.effect.healthRestore) {
      const restored = Math.min(item.effect.healthRestore, player.maxHealth - player.health)
      player.health += restored
      message = `Restored ${restored} health!`
    }
    if (item.effect.heatReduction) {
      const reduced = Math.min(item.effect.heatReduction, player.heat)
      player.heat -= reduced
      player.heat_level = player.heat
      message = `Reduced heat by ${reduced}!`
    }
  }

  // Remove consumable item
  if (item.stackable || item.category === 'consumable') {
    if (invItem.quantity > 1) {
      invItem.quantity--
    } else {
      player.inventory.splice(inventoryIndex, 1)
    }
  }

  savePlayerData(player)

  return {
    success: true,
    message: message,
    player: { ...player }
  }
}

// Buy an item from shop
export function buyItem(player, itemId) {
  const item = ITEMS.find(i => i.id === itemId)

  if (!item) {
    return { success: false, message: 'Item not found' }
  }

  if (player.cash < item.price) {
    return { success: false, message: 'Not enough cash!' }
  }

  player.cash -= item.price

  // Add to inventory
  const existingItem = player.inventory.find(i => i.id === itemId || i.item_id === itemId)
  if (existingItem && item.stackable) {
    existingItem.quantity = (existingItem.quantity || 1) + 1
  } else {
    player.inventory.push({
      id: itemId,
      item_id: itemId,
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: 1,
      effect: item.effect
    })
  }

  savePlayerData(player)

  return {
    success: true,
    message: `Bought ${item.name}!`,
    player: { ...player }
  }
}

// Get player's lawyer info
export function getPlayerLawyer(player) {
  if (!player.lawyer) return null
  return LAWYERS.find(l => l.id === player.lawyer) || null
}

// Calculate bail amount with lawyer reduction
export function calculateBail(player) {
  const wantedLevel = player.jail_wanted_level || 1
  const baseBail = 500 + (player.level * 100) + (wantedLevel * 500)

  const lawyer = getPlayerLawyer(player)
  const reduction = lawyer ? lawyer.bailReduction : 0
  const finalBail = Math.round(baseBail * (1 - reduction))

  return {
    baseBail,
    reduction,
    finalBail,
    lawyer: lawyer ? lawyer.name : null
  }
}

// Arrest player and set up jail data
export function arrestPlayer(player) {
  // Calculate wanted level based on heat
  const heat = player.heat || 0
  let wantedLevel = 1
  if (heat >= 80) wantedLevel = 5
  else if (heat >= 60) wantedLevel = 4
  else if (heat >= 40) wantedLevel = 3
  else if (heat >= 20) wantedLevel = 2

  // Store wanted level at time of arrest for sentencing
  player.jail_wanted_level = wantedLevel

  // Calculate sentence with lawyer reduction
  const jailTime = calculateJailTime(player)

  // Set jail state
  player.is_jailed = true
  player.jail_start = new Date(Date.now()).toISOString() // Track when sentence started
  player.jail_until = new Date(Date.now() + jailTime.finalTime).toISOString()
  player.jailbreakBonus = 0 // Reset any escape planning
  player.parole_denied_at = null // Reset parole denial cooldown

  // Reduce heat since player got caught
  player.heat = Math.max(0, heat - 30)

  // Track stats
  player.stats = player.stats || {}
  player.stats.times_jailed = (player.stats.times_jailed || 0) + 1

  savePlayerData(player)

  return {
    wantedLevel,
    jailTime: jailTime.finalTime,
    baseTime: jailTime.baseTime,
    reduction: jailTime.reduction,
    lawyer: jailTime.lawyer,
    bail: calculateBail(player),
    player: { ...player }
  }
}

// Calculate jail time with lawyer reduction
export function calculateJailTime(player) {
  const wantedLevel = player.jail_wanted_level || 1
  const baseTime = JAIL_TIMES[wantedLevel] || JAIL_TIMES[1]

  const lawyer = getPlayerLawyer(player)
  const reduction = lawyer ? lawyer.sentenceReduction : 0
  const finalTime = Math.round(baseTime * (1 - reduction))

  return {
    baseTime,
    reduction,
    finalTime,
    lawyer: lawyer ? lawyer.name : null
  }
}

// Pay bail to get out of jail
export function payBail(player) {
  if (!player.is_jailed) {
    return { success: false, message: 'You are not in jail' }
  }

  const bailInfo = calculateBail(player)
  const lawyer = getPlayerLawyer(player)

  // Add lawyer per-case fee if applicable
  let totalCost = bailInfo.finalBail
  if (lawyer && lawyer.perCase > 0) {
    totalCost += lawyer.perCase
  }

  if (player.cash < totalCost) {
    return { success: false, message: `Not enough cash! Bail is $${bailInfo.finalBail}${lawyer ? ` + $${lawyer.perCase} lawyer fee` : ''}` }
  }

  player.cash -= totalCost
  player.is_jailed = false
  player.jail_until = null
  player.jailbreakBonus = 0 // Reset jailbreak planning

  // Track bails paid for achievements
  player.bails_paid = (player.bails_paid || 0) + 1

  // Track lawyer case history
  if (lawyer && lawyer.id !== 'public') {
    player.lawyer_cases = player.lawyer_cases || []
    player.lawyer_cases.push({
      date: new Date().toISOString(),
      type: 'bail',
      lawyer: lawyer.id,
      lawyerName: lawyer.name,
      bailAmount: bailInfo.baseBail,
      discount: bailInfo.reduction,
      finalCost: totalCost,
      savedAmount: bailInfo.baseBail - bailInfo.finalBail
    })
    // Keep only last 20 cases
    if (player.lawyer_cases.length > 20) {
      player.lawyer_cases = player.lawyer_cases.slice(-20)
    }
  }

  savePlayerData(player)

  const lawyerMsg = lawyer ? ` (${Math.round(bailInfo.reduction * 100)}% discount from ${lawyer.name})` : ''
  return {
    success: true,
    message: `Paid $${totalCost} bail${lawyerMsg}. You are free!`,
    bailPaid: bailInfo.finalBail,
    lawyerFee: lawyer ? lawyer.perCase : 0,
    player: { ...player }
  }
}

// Attempt jailbreak
export function attemptJailbreak(player) {
  if (!player.is_jailed) {
    return { success: false, message: 'You are not in jail' }
  }

  // 30% base success rate + planning bonus
  const baseRate = 30
  const planningBonus = player.jailbreakBonus || 0
  const successRate = Math.min(80, baseRate + planningBonus) // Cap at 80%
  const success = Math.random() * 100 < successRate

  if (success) {
    player.is_jailed = false
    player.jail_until = null
    player.heat = Math.min(100, player.heat + 20)
    player.heat_level = player.heat
    player.jailbreakBonus = 0 // Reset planning bonus

    savePlayerData(player)

    return {
      success: true,
      successRate,
      message: 'Jailbreak successful! But your heat increased.',
      player: { ...player }
    }
  } else {
    // Extend jail time
    const currentJail = player.jail_until ? new Date(player.jail_until) : new Date()
    player.jail_until = new Date(currentJail.getTime() + 30000).toISOString() // +30 seconds

    savePlayerData(player)

    return {
      success: false,
      successRate,
      message: 'Jailbreak failed! Jail time extended by 30 seconds.',
      player: { ...player }
    }
  }
}

// ============================================
// LAWYER MANAGEMENT FUNCTIONS
// ============================================

// Hire a lawyer (pay retainer)
export function hireLawyer(player, lawyerId) {
  const lawyer = LAWYERS.find(l => l.id === lawyerId)

  if (!lawyer) {
    return { success: false, message: 'Unknown lawyer' }
  }

  if (player.level < lawyer.minLevel) {
    return { success: false, message: `Requires level ${lawyer.minLevel}` }
  }

  if (player.cash < lawyer.retainer) {
    return { success: false, message: `Not enough cash! Retainer is $${lawyer.retainer}` }
  }

  // Fire current lawyer first (no refund)
  player.lawyer = lawyerId
  player.lawyerRetainerPaid = true
  player.cash -= lawyer.retainer

  savePlayerData(player)

  return {
    success: true,
    message: lawyer.retainer > 0
      ? `Hired ${lawyer.name} for $${lawyer.retainer} retainer.`
      : `${lawyer.name} assigned to your case.`,
    lawyer,
    player: { ...player }
  }
}

// Fire lawyer (no refund)
export function fireLawyer(player) {
  if (!player.lawyer) {
    return { success: false, message: 'No lawyer to fire' }
  }

  const oldLawyer = getPlayerLawyer(player)
  player.lawyer = null
  player.lawyerRetainerPaid = false

  savePlayerData(player)

  return {
    success: true,
    message: `${oldLawyer?.name || 'Lawyer'} has been dismissed.`,
    player: { ...player }
  }
}

// Get lawyer case history
export function getLawyerCaseHistory(player) {
  const cases = player.lawyer_cases || []
  const stats = {
    totalCases: cases.length,
    bailCases: cases.filter(c => c.type === 'bail').length,
    paroleCases: cases.filter(c => c.type === 'parole').length,
    totalSaved: cases.reduce((sum, c) => sum + (c.savedAmount || 0), 0),
    recentCases: cases.slice(-5).reverse() // Last 5 cases, most recent first
  }
  return { cases, stats }
}

// ============================================
// HEAT REDUCTION FUNCTIONS
// ============================================

// Attempt to bribe a cop
export function bribeCop(player) {
  const method = HEAT_REDUCTION_METHODS.find(m => m.id === 'bribe_cop')

  // Check cooldown
  const lastUsed = player.heatReductionCooldowns?.bribe_cop || 0
  if (Date.now() - lastUsed < method.cooldown) {
    const remaining = Math.ceil((method.cooldown - (Date.now() - lastUsed)) / 60000)
    return { success: false, message: `Cooldown: ${remaining} minutes remaining` }
  }

  // Calculate cost (random in range)
  const cost = Math.floor(Math.random() * (method.costMax - method.costMin) + method.costMin)

  if (player.cash < cost) {
    return { success: false, message: `Not enough cash! Need at least $${method.costMin}` }
  }

  player.cash -= cost

  // Check if bribe fails
  if (Math.random() < method.failChance) {
    player.heat = Math.min(100, player.heat + method.failPenalty)
    player.heat_level = player.heat
    player.heatReductionCooldowns = player.heatReductionCooldowns || {}
    player.heatReductionCooldowns.bribe_cop = Date.now()

    savePlayerData(player)

    return {
      success: false,
      cost,
      message: `Bribe backfired! The cop reported you. +${method.failPenalty} heat!`,
      player: { ...player }
    }
  }

  // Success - reduce heat
  const reduction = Math.floor(Math.random() * (method.reductionMax - method.reductionMin) + method.reductionMin)
  player.heat = Math.max(0, player.heat - reduction)
  player.heat_level = player.heat
  player.heatReductionCooldowns = player.heatReductionCooldowns || {}
  player.heatReductionCooldowns.bribe_cop = Date.now()

  savePlayerData(player)

  return {
    success: true,
    cost,
    reduction,
    message: `Bribe successful! -${reduction} heat for $${cost}`,
    player: { ...player }
  }
}

// Lawyer intervention to reduce heat
export function lawyerIntervention(player) {
  const method = HEAT_REDUCTION_METHODS.find(m => m.id === 'lawyer_intervention')
  const lawyer = getPlayerLawyer(player)

  if (!lawyer || lawyer.id === 'public') {
    return { success: false, message: 'Need at least a Street Lawyer for this' }
  }

  // Check cooldown
  const lastUsed = player.heatReductionCooldowns?.lawyer_intervention || 0
  if (Date.now() - lastUsed < method.cooldown) {
    const remaining = Math.ceil((method.cooldown - (Date.now() - lastUsed)) / 60000)
    return { success: false, message: `Cooldown: ${remaining} minutes remaining` }
  }

  if (player.cash < method.cost) {
    return { success: false, message: `Not enough cash! Cost is $${method.cost}` }
  }

  player.cash -= method.cost
  player.heat = Math.max(0, player.heat - method.reduction)
  player.heat_level = player.heat
  player.heatReductionCooldowns = player.heatReductionCooldowns || {}
  player.heatReductionCooldowns.lawyer_intervention = Date.now()

  savePlayerData(player)

  return {
    success: true,
    cost: method.cost,
    reduction: method.reduction,
    message: `${lawyer.name} made some calls. -${method.reduction} heat.`,
    player: { ...player }
  }
}

// Restore energy over time (call periodically)
export function restoreEnergy(player, deltaSeconds = 60) {
  const energyPerMinute = 5
  const energyGain = Math.floor((deltaSeconds / 60) * energyPerMinute)

  if (player.energy < player.maxEnergy) {
    player.energy = Math.min(player.maxEnergy, player.energy + energyGain)
    player.stamina = player.energy
    savePlayerData(player)
  }

  return player
}

// Reduce heat over time
export function reduceHeat(player, deltaSeconds = 60) {
  const heatReductionPerMinute = 2
  const heatReduction = Math.floor((deltaSeconds / 60) * heatReductionPerMinute)

  if (player.heat > 0) {
    player.heat = Math.max(0, player.heat - heatReduction)
    player.heat_level = player.heat
    savePlayerData(player)
  }

  return player
}

// Check if player is still jailed
export function checkJailStatus(player) {
  if (player.is_jailed && player.jail_until) {
    const jailEnd = new Date(player.jail_until)
    if (new Date() >= jailEnd) {
      player.is_jailed = false
      player.jail_until = null
      savePlayerData(player)
    }
  }
  return player
}

// ============================================
// MINI-GAME REWARD SYSTEM ENHANCEMENTS (P41-P50)
// ============================================

/**
 * Daily Mini-Game Challenges
 * 3 rotating challenges per day with bonus rewards
 */
export const DAILY_CHALLENGE_TYPES = [
  { id: 'win_count', name: 'Victory Rush', description: 'Win {target} mini-games', icon: '🏆', baseReward: 500 },
  { id: 'perfect_count', name: 'Perfectionist', description: 'Get {target} perfect scores', icon: '⭐', baseReward: 750 },
  { id: 'streak_reach', name: 'Hot Streak', description: 'Reach a {target} win streak', icon: '🔥', baseReward: 600 },
  { id: 'score_total', name: 'Score Hunter', description: 'Score {target} total points', icon: '🎯', baseReward: 400 },
  { id: 'game_type', name: 'Specialist', description: 'Win {target} {gameType} games', icon: '🎮', baseReward: 550 },
  { id: 'speed_wins', name: 'Speed Demon', description: 'Win {target} games with 15+ seconds left', icon: '⚡', baseReward: 700 },
  { id: 'no_fail', name: 'Flawless Run', description: 'Win {target} games without failing any', icon: '💎', baseReward: 800 },
  { id: 'gold_tier', name: 'Gold Rush', description: 'Get {target} Gold or Perfect ratings', icon: '🥇', baseReward: 650 }
]

export const GAME_TYPE_NAMES = {
  snake: 'Snake', lockpick: 'Lockpick', qte: 'QTE', frogger: 'Frogger',
  memory: 'Memory', steadyhand: 'Steady Hand', chase: 'Chase', sniper: 'Sniper',
  safecrack: 'Safe Crack', wire: 'Wire', rhythm: 'Rhythm', hacking: 'Hacking',
  getaway: 'Getaway', negotiation: 'Negotiation', surveillance: 'Surveillance'
}

/**
 * Generate daily challenges based on the current date
 */
export function generateDailyChallenges(playerLevel = 1) {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()

  // Seeded random for consistent daily challenges
  const seededRandom = (n) => {
    const x = Math.sin(seed + n) * 10000
    return x - Math.floor(x)
  }

  const challenges = []
  const usedTypes = new Set()
  const gameTypes = Object.keys(GAME_TYPE_NAMES)

  for (let i = 0; i < 3; i++) {
    let challengeType
    let attempts = 0
    do {
      const idx = Math.floor(seededRandom(i + attempts * 10) * DAILY_CHALLENGE_TYPES.length)
      challengeType = DAILY_CHALLENGE_TYPES[idx]
      attempts++
    } while (usedTypes.has(challengeType.id) && attempts < 20)

    usedTypes.add(challengeType.id)

    // Scale target based on player level
    const levelMult = 1 + Math.floor(playerLevel / 10) * 0.3
    let target = 3
    let gameType = null

    switch (challengeType.id) {
      case 'win_count': target = Math.floor((3 + seededRandom(i + 100) * 4) * levelMult); break
      case 'perfect_count': target = Math.floor((1 + seededRandom(i + 200) * 3) * levelMult); break
      case 'streak_reach': target = Math.floor(3 + seededRandom(i + 300) * 4); break
      case 'score_total': target = Math.floor((2000 + seededRandom(i + 400) * 3000) * levelMult); break
      case 'game_type':
        target = Math.floor((2 + seededRandom(i + 500) * 3) * levelMult)
        gameType = gameTypes[Math.floor(seededRandom(i + 600) * gameTypes.length)]
        break
      case 'speed_wins': target = Math.floor((2 + seededRandom(i + 700) * 3) * levelMult); break
      case 'no_fail': target = Math.floor((3 + seededRandom(i + 800) * 3) * levelMult); break
      case 'gold_tier': target = Math.floor((2 + seededRandom(i + 900) * 4) * levelMult); break
    }

    const reward = Math.floor(challengeType.baseReward * levelMult * (1 + i * 0.2))

    challenges.push({
      id: `daily_${i}_${seed}`,
      type: challengeType.id,
      name: challengeType.name,
      description: challengeType.description
        .replace('{target}', target)
        .replace('{gameType}', gameType ? GAME_TYPE_NAMES[gameType] : ''),
      icon: challengeType.icon,
      target,
      gameType,
      reward,
      xpReward: Math.floor(reward / 5),
      progress: 0,
      completed: false,
      claimed: false,
      expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()
    })
  }

  return challenges
}

/**
 * Weekly Super Challenge
 */
export const WEEKLY_CHALLENGES = [
  { id: 'marathon', name: 'Mini-Game Marathon', description: 'Win 50 mini-games this week', target: 50, reward: 5000, xpReward: 500, icon: '🏃' },
  { id: 'perfectionist', name: 'Week of Perfection', description: 'Get 15 perfect scores this week', target: 15, reward: 7500, xpReward: 750, icon: '💎' },
  { id: 'streak_master', name: 'Streak Master', description: 'Reach a 15 win streak', target: 15, reward: 6000, xpReward: 600, icon: '🔥' },
  { id: 'variety', name: 'Jack of All Trades', description: 'Win at least 3 of each mini-game type', target: 45, reward: 8000, xpReward: 800, icon: '🃏' },
  { id: 'score_king', name: 'Score King', description: 'Accumulate 50,000 total points', target: 50000, reward: 6500, xpReward: 650, icon: '👑' }
]

export function generateWeeklyChallenge(playerLevel = 1) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekSeed = Math.floor(weekStart.getTime() / (7 * 24 * 60 * 60 * 1000))

  const idx = weekSeed % WEEKLY_CHALLENGES.length
  const challenge = { ...WEEKLY_CHALLENGES[idx] }

  const levelMult = 1 + Math.floor(playerLevel / 15) * 0.25
  challenge.reward = Math.floor(challenge.reward * levelMult)
  challenge.xpReward = Math.floor(challenge.xpReward * levelMult)
  challenge.progress = 0
  challenge.completed = false
  challenge.claimed = false
  challenge.expiresAt = weekStart.getTime() + (7 * 24 * 60 * 60 * 1000)

  return challenge
}

/**
 * Rare Loot Drops on Perfect Scores
 */
export const RARE_LOOT_TABLE = [
  { id: 'gold_lockpick', name: 'Golden Lockpick', description: '+25% lockpick success', rarity: 'rare', chance: 0.15, effect: { lockpickBonus: 25 }, icon: '🔑' },
  { id: 'lucky_dice', name: 'Lucky Dice', description: '+10% all mini-game scores', rarity: 'rare', chance: 0.12, effect: { scoreBonus: 0.10 }, icon: '🎲' },
  { id: 'speed_boots', name: 'Speed Boots', description: '+5 seconds on all timers', rarity: 'rare', chance: 0.10, effect: { timerBonus: 5 }, icon: '👟' },
  { id: 'focus_lens', name: 'Focus Lens', description: '+15% steady hand precision', rarity: 'epic', chance: 0.08, effect: { precisionBonus: 15 }, icon: '🔍' },
  { id: 'combo_gloves', name: 'Combo Gloves', description: '+25% combo multiplier', rarity: 'epic', chance: 0.06, effect: { comboBonus: 0.25 }, icon: '🧤' },
  { id: 'time_crystal', name: 'Time Crystal', description: 'Freeze time once per game', rarity: 'epic', chance: 0.05, effect: { timeFreeze: 1 }, icon: '💠' },
  { id: 'perfect_gem', name: 'Perfect Gem', description: '+50% perfect score rewards', rarity: 'legendary', chance: 0.03, effect: { perfectBonus: 0.50 }, icon: '💎' },
  { id: 'master_key', name: 'Master Key', description: 'Auto-win one mini-game daily', rarity: 'legendary', chance: 0.02, effect: { autoWin: 1 }, icon: '🗝️' },
  { id: 'cash_bundle', name: 'Cash Bundle', description: 'Instant $1,000-$5,000', rarity: 'common', chance: 0.25, cashMin: 1000, cashMax: 5000, icon: '💵' },
  { id: 'xp_tome', name: 'XP Tome', description: 'Instant 100-500 XP', rarity: 'common', chance: 0.20, xpMin: 100, xpMax: 500, icon: '📖' }
]

export function rollForLoot(isPerfect = false, streakLength = 0) {
  if (!isPerfect && streakLength < 5) return null

  // Base chance increases with streak
  const streakBonus = Math.min(streakLength * 0.02, 0.30)
  const perfectBonus = isPerfect ? 0.15 : 0

  for (const loot of RARE_LOOT_TABLE) {
    const adjustedChance = loot.chance + streakBonus + perfectBonus
    if (Math.random() < adjustedChance) {
      const drop = { ...loot }

      // Handle cash/xp drops
      if (drop.cashMin) {
        drop.cashAmount = Math.floor(drop.cashMin + Math.random() * (drop.cashMax - drop.cashMin))
      }
      if (drop.xpMin) {
        drop.xpAmount = Math.floor(drop.xpMin + Math.random() * (drop.xpMax - drop.xpMin))
      }

      return drop
    }
  }

  return null
}

/**
 * Streak Milestone Rewards
 */
export const STREAK_MILESTONES = [
  { streak: 3, reward: 250, xp: 25, message: '🔥 3 Win Streak! +$250', multiplier: 1.10 },
  { streak: 5, reward: 500, xp: 50, message: '🔥🔥 5 Win Streak! +$500', multiplier: 1.20 },
  { streak: 10, reward: 1500, xp: 150, message: '🔥🔥🔥 10 Win Streak! +$1,500', multiplier: 1.35, lootChance: true },
  { streak: 15, reward: 3000, xp: 300, message: '💥 15 Win Streak! +$3,000', multiplier: 1.50, lootChance: true },
  { streak: 25, reward: 7500, xp: 750, message: '👑 25 Win Streak! LEGENDARY! +$7,500', multiplier: 1.75, lootChance: true, badge: 'streak_legend' },
  { streak: 50, reward: 20000, xp: 2000, message: '🏆 50 WIN STREAK! UNSTOPPABLE! +$20,000', multiplier: 2.00, lootChance: true, badge: 'streak_god' }
]

export function checkStreakMilestone(currentStreak, previousStreak) {
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak >= milestone.streak && previousStreak < milestone.streak) {
      return milestone
    }
  }
  return null
}

/**
 * Local Mini-Game Leaderboards
 */
export function getLocalLeaderboards() {
  const stored = localStorage.getItem('street_legacy_leaderboards')
  if (stored) {
    return JSON.parse(stored)
  }
  return {
    highScores: {},
    bestStreaks: [],
    perfectRuns: [],
    fastestWins: {},
    lastUpdated: Date.now()
  }
}

export function updateLeaderboard(gameType, score, time, isPerfect, playerName = 'Player') {
  const leaderboards = getLocalLeaderboards()

  // Update high scores per game type
  if (!leaderboards.highScores[gameType]) {
    leaderboards.highScores[gameType] = []
  }
  leaderboards.highScores[gameType].push({
    score, playerName, date: Date.now(), isPerfect
  })
  leaderboards.highScores[gameType].sort((a, b) => b.score - a.score)
  leaderboards.highScores[gameType] = leaderboards.highScores[gameType].slice(0, 10)

  // Update fastest wins
  if (!leaderboards.fastestWins[gameType] || time < leaderboards.fastestWins[gameType].time) {
    leaderboards.fastestWins[gameType] = { time, playerName, date: Date.now() }
  }

  // Update perfect runs
  if (isPerfect) {
    leaderboards.perfectRuns.push({ gameType, score, playerName, date: Date.now() })
    leaderboards.perfectRuns.sort((a, b) => b.score - a.score)
    leaderboards.perfectRuns = leaderboards.perfectRuns.slice(0, 50)
  }

  leaderboards.lastUpdated = Date.now()
  localStorage.setItem('street_legacy_leaderboards', JSON.stringify(leaderboards))

  return leaderboards
}

export function updateStreakLeaderboard(streak, playerName = 'Player') {
  const leaderboards = getLocalLeaderboards()

  leaderboards.bestStreaks.push({ streak, playerName, date: Date.now() })
  leaderboards.bestStreaks.sort((a, b) => b.streak - a.streak)
  leaderboards.bestStreaks = leaderboards.bestStreaks.slice(0, 20)

  leaderboards.lastUpdated = Date.now()
  localStorage.setItem('street_legacy_leaderboards', JSON.stringify(leaderboards))

  return leaderboards
}

/**
 * Hard Mode System
 */
export const HARD_MODE_SETTINGS = {
  timeReduction: 0.7, // 30% less time
  targetIncrease: 1.5, // 50% higher targets
  curveballFrequency: 2.0, // Double curveballs
  rewardMultiplier: 3.0, // 3x rewards
  unlockRequirement: 'jack_of_trades' // Achievement required
}

export function isHardModeUnlocked(player) {
  return player?.achievements?.includes('jack_of_trades') || false
}

/**
 * Bonus Multiplier Stacking System
 */
export function calculateTotalMultiplier(player, performanceTier, streak = 0) {
  let multiplier = 1.0

  // Performance tier multiplier
  const tierMults = { FAILED: 0.3, BRONZE: 1.0, SILVER: 1.5, GOLD: 2.0, PERFECT: 3.0 }
  multiplier *= tierMults[performanceTier] || 1.0

  // Streak multiplier (diminishing returns)
  if (streak >= 3) {
    const streakMilestone = STREAK_MILESTONES.find(m => streak >= m.streak)
    if (streakMilestone) {
      multiplier *= streakMilestone.multiplier
    }
  }

  // Achievement bonuses
  const benefits = getMiniGameAchievementBenefits(player)
  if (streak >= 3 && benefits.streak_bonus) {
    multiplier *= (1 + benefits.streak_bonus)
  }

  // First win of day bonus
  if (isFirstWinOfDay(player)) {
    multiplier *= 1.5
  }

  // Hard mode bonus
  if (player?.hardModeEnabled) {
    multiplier *= HARD_MODE_SETTINGS.rewardMultiplier
  }

  return Math.round(multiplier * 100) / 100
}

/**
 * Time-Based Bonuses
 */
export function getTimeBonus(remainingTime, totalTime) {
  const ratio = remainingTime / totalTime

  if (ratio >= 0.7) return { multiplier: 1.5, label: 'SPEED BONUS! +50%' }
  if (ratio >= 0.5) return { multiplier: 1.25, label: 'Quick! +25%' }
  if (ratio >= 0.3) return { multiplier: 1.10, label: 'Good pace! +10%' }
  return { multiplier: 1.0, label: null }
}

/**
 * Combo Cash Bonus System
 */
export function calculateComboCash(baseReward, comboCount, maxCombo) {
  if (comboCount < 5) return 0

  const comboRatio = comboCount / Math.max(maxCombo, comboCount)
  const bonusPercent = Math.min(comboRatio * 0.5, 0.5) // Up to 50% bonus

  return Math.floor(baseReward * bonusPercent)
}

/**
 * First Win of Day Bonus
 */
export function isFirstWinOfDay(player) {
  if (!player?.lastMiniGameWin) return true

  const lastWin = new Date(player.lastMiniGameWin)
  const today = new Date()

  return lastWin.getDate() !== today.getDate() ||
         lastWin.getMonth() !== today.getMonth() ||
         lastWin.getFullYear() !== today.getFullYear()
}

export function markMiniGameWin(player) {
  player.lastMiniGameWin = Date.now()
  if (isFirstWinOfDay(player)) {
    player.dailyFirstWinClaimed = true
  }
  savePlayerData(player)
}

/**
 * Second Chance Token System
 */
export function getSecondChanceTokens(player) {
  return player?.secondChanceTokens || 0
}

export function useSecondChanceToken(player) {
  if ((player?.secondChanceTokens || 0) > 0) {
    player.secondChanceTokens--
    savePlayerData(player)
    return true
  }
  return false
}

export function awardSecondChanceToken(player, count = 1) {
  player.secondChanceTokens = (player.secondChanceTokens || 0) + count
  savePlayerData(player)
}

// ============================================
// P71-P80: GAMEPLAY DEPTH FEATURES
// ============================================

/**
 * P71: Practice Mode Configuration
 * Allows players to practice mini-games without stakes
 */
export const PRACTICE_MODE_CONFIG = {
  enabled: true,
  unlockLevel: 5,           // Level required to unlock practice mode
  dailyLimit: 10,           // Max practice games per day
  noRewards: true,          // No cash/XP in practice
  noHeat: true,             // No heat gain
  showTutorialHints: true,  // Display tutorial hints during practice
  difficultyOptions: ['easy', 'normal', 'hard', 'expert'],
  selectableGames: true     // Can choose which game to practice
}

export function canUsePracticeMode(player) {
  if (!PRACTICE_MODE_CONFIG.enabled) return false
  if ((player?.level || 1) < PRACTICE_MODE_CONFIG.unlockLevel) return false

  const today = new Date().toDateString()
  const practiceData = player?.practiceMode || {}

  if (practiceData.lastDate !== today) {
    return true // New day, can practice
  }

  return (practiceData.gamesPlayed || 0) < PRACTICE_MODE_CONFIG.dailyLimit
}

export function recordPracticeGame(player) {
  const today = new Date().toDateString()

  if (!player.practiceMode) {
    player.practiceMode = { lastDate: today, gamesPlayed: 0 }
  }

  if (player.practiceMode.lastDate !== today) {
    player.practiceMode = { lastDate: today, gamesPlayed: 0 }
  }

  player.practiceMode.gamesPlayed++
  savePlayerData(player)
}

export function getPracticeGamesRemaining(player) {
  const today = new Date().toDateString()
  const practiceData = player?.practiceMode || {}

  if (practiceData.lastDate !== today) return PRACTICE_MODE_CONFIG.dailyLimit

  return Math.max(0, PRACTICE_MODE_CONFIG.dailyLimit - (practiceData.gamesPlayed || 0))
}

/**
 * P72: Tutorial Overlay System
 * Context-aware hints for each mini-game
 */
export const MINI_GAME_TUTORIALS = {
  snake: {
    title: 'Data Snake',
    objective: 'Collect data nodes without hitting walls or yourself',
    controls: ['Arrow keys or swipe to move', 'Collect green nodes', 'Avoid red obstacles'],
    tips: ['Start slow, speed up as you improve', 'Plan your route ahead', 'Corners are dangerous']
  },
  lockpick: {
    title: 'Lock Pick',
    objective: 'Find the sweet spot on each tumbler',
    controls: ['Tap/click to set tumbler', 'Move to next tumbler', 'Complete all tumblers'],
    tips: ['Watch for visual cues', 'Listen for audio feedback', 'Faster = more points']
  },
  qte: {
    title: 'Quick Time Event',
    objective: 'Press the correct buttons before time runs out',
    controls: ['Watch for button prompts', 'Press matching key/button', 'Chain hits for combo'],
    tips: ['Focus on timing not speed', 'Perfect hits = 2x points', 'Combo builds faster score']
  },
  memory: {
    title: 'Memory Match',
    objective: 'Match all pairs of cards',
    controls: ['Tap cards to flip', 'Match identical pairs', 'Remember card positions'],
    tips: ['Start with corners', 'Group cards by position', 'Fewer moves = higher score']
  },
  frogger: {
    title: 'Street Runner',
    objective: 'Cross the street without getting hit',
    controls: ['Tap/arrow to move', 'Avoid moving obstacles', 'Reach the safe zones'],
    tips: ['Watch traffic patterns', 'Use safe zones to rest', 'Timing is everything']
  },
  steadyhand: {
    title: 'Steady Hand',
    objective: 'Hold position without touching the edges',
    controls: ['Move pointer carefully', 'Stay in the safe zone', 'Avoid touching walls'],
    tips: ['Move slowly', 'Breathe steadily', 'Small movements only']
  },
  chase: {
    title: 'The Chase',
    objective: 'Escape pursuers by dodging obstacles',
    controls: ['Swipe/arrows to dodge', 'Collect power-ups', 'Avoid obstacles'],
    tips: ['Stay in center when possible', 'Watch for upcoming lanes', 'Power-ups extend time']
  },
  sniper: {
    title: 'Precision Shot',
    objective: 'Hit targets before they disappear',
    controls: ['Move scope with pointer', 'Click/tap to shoot', 'Hit moving targets'],
    tips: ['Lead your targets', 'Headshots = more points', 'Miss penalty reduces score']
  },
  safecrack: {
    title: 'Safe Cracker',
    objective: 'Find the correct combination',
    controls: ['Turn dial left/right', 'Listen for clicks', 'Enter correct numbers'],
    tips: ['Watch dial closely', 'Audio cues are key', 'Numbers are sequential hints']
  },
  wire: {
    title: 'Wire Connect',
    objective: 'Connect matching wire pairs',
    controls: ['Drag from start to end', 'Match colors', 'Avoid crossing wires'],
    tips: ['Start with obvious pairs', 'Use outer paths', 'Plan before connecting']
  },
  rhythm: {
    title: 'Beat Master',
    objective: 'Hit notes as they reach the zone',
    controls: ['Tap when notes reach line', 'Match arrow directions', 'Build combos'],
    tips: ['Feel the beat', 'Watch multiple lanes', 'Perfect timing = max points']
  },
  hacking: {
    title: 'System Breach',
    objective: 'Connect nodes to breach security',
    controls: ['Click nodes to select', 'Build paths to target', 'Avoid firewalls'],
    tips: ['Multiple paths are safer', 'Firewalls block nodes', 'Speed matters']
  },
  getaway: {
    title: 'Getaway Driver',
    objective: 'Outrun police while collecting cash',
    controls: ['Swipe/arrows to change lanes', 'Avoid police cars', 'Collect cash bags'],
    tips: ['Stay ahead of sirens', 'Near misses = bonus', 'Cash = better score']
  },
  negotiation: {
    title: 'The Deal',
    objective: 'Make the right choices to succeed',
    controls: ['Read the situation', 'Choose your response', 'Build rapport or pressure'],
    tips: ['Body language matters', 'High risk = high reward', 'Some choices are traps']
  },
  surveillance: {
    title: 'Eagle Eye',
    objective: 'Identify targets in the crowd',
    controls: ['Scan the scene', 'Click/tap targets', 'Avoid decoys'],
    tips: ['Look for description matches', 'Decoys cost points', 'Speed = bonus']
  }
}

export function getTutorial(gameType) {
  return MINI_GAME_TUTORIALS[gameType?.toLowerCase()] || {
    title: 'Mini-Game',
    objective: 'Complete the challenge',
    controls: ['Follow on-screen prompts'],
    tips: ['Good luck!']
  }
}

/**
 * P73: Adaptive Difficulty System
 * Adjusts difficulty based on player performance
 */
export const ADAPTIVE_DIFFICULTY_CONFIG = {
  enabled: true,
  trackLastGames: 10,       // Number of games to track
  adjustmentThreshold: 0.7, // Win rate threshold for adjustment

  difficultyLevels: {
    easy: { speedMult: 0.8, targetMult: 1.3, timerMult: 1.3, label: 'Easy' },
    normal: { speedMult: 1.0, targetMult: 1.0, timerMult: 1.0, label: 'Normal' },
    hard: { speedMult: 1.2, targetMult: 0.8, timerMult: 0.8, label: 'Hard' },
    expert: { speedMult: 1.5, targetMult: 0.6, timerMult: 0.6, label: 'Expert' }
  },

  // Win rate ranges for auto-adjustment
  autoAdjust: {
    decreaseDifficulty: 0.3,  // Below 30% win rate
    increaseDifficulty: 0.8   // Above 80% win rate
  }
}

export function getAdaptiveDifficulty(player, gameType) {
  if (!ADAPTIVE_DIFFICULTY_CONFIG.enabled) {
    return ADAPTIVE_DIFFICULTY_CONFIG.difficultyLevels.normal
  }

  const key = `adaptive_${gameType}`
  const history = player?.gameHistory?.[key] || []

  if (history.length < 3) {
    return ADAPTIVE_DIFFICULTY_CONFIG.difficultyLevels.normal
  }

  const recentGames = history.slice(-ADAPTIVE_DIFFICULTY_CONFIG.trackLastGames)
  const winRate = recentGames.filter(g => g.won).length / recentGames.length

  const currentDifficulty = player?.difficultySettings?.[gameType] || 'normal'
  const levels = ['easy', 'normal', 'hard', 'expert']
  const currentIndex = levels.indexOf(currentDifficulty)

  // Auto-adjust
  if (winRate < ADAPTIVE_DIFFICULTY_CONFIG.autoAdjust.decreaseDifficulty && currentIndex > 0) {
    return ADAPTIVE_DIFFICULTY_CONFIG.difficultyLevels[levels[currentIndex - 1]]
  }
  if (winRate > ADAPTIVE_DIFFICULTY_CONFIG.autoAdjust.increaseDifficulty && currentIndex < levels.length - 1) {
    return ADAPTIVE_DIFFICULTY_CONFIG.difficultyLevels[levels[currentIndex + 1]]
  }

  return ADAPTIVE_DIFFICULTY_CONFIG.difficultyLevels[currentDifficulty]
}

export function recordGameResult(player, gameType, won, score) {
  if (!player.gameHistory) player.gameHistory = {}

  const key = `adaptive_${gameType}`
  if (!player.gameHistory[key]) player.gameHistory[key] = []

  player.gameHistory[key].push({
    won,
    score,
    timestamp: Date.now()
  })

  // Keep only last N games
  if (player.gameHistory[key].length > ADAPTIVE_DIFFICULTY_CONFIG.trackLastGames * 2) {
    player.gameHistory[key] = player.gameHistory[key].slice(-ADAPTIVE_DIFFICULTY_CONFIG.trackLastGames)
  }

  savePlayerData(player)
}

/**
 * P74: Boss Mini-Games
 * Special challenging versions that appear occasionally
 */
export const BOSS_GAMES_CONFIG = {
  unlockLevel: 20,
  appearChance: 0.05,  // 5% chance after unlock
  rewardMultiplier: 5, // 5x normal rewards
  difficultyBoost: 2.0, // Double difficulty

  bossTypes: {
    snake: {
      name: 'The Hydra',
      description: 'Multi-headed data serpent challenge',
      modifier: { speed: 1.5, targets: 25, obstacles: true }
    },
    lockpick: {
      name: 'The Vault',
      description: 'Bank vault with 10 tumblers',
      modifier: { tumblers: 10, precision: 0.5, time: 45 }
    },
    memory: {
      name: 'Memory Palace',
      description: '24 pairs with time pressure',
      modifier: { pairs: 24, time: 60, flipTime: 0.5 }
    },
    qte: {
      name: 'Final Showdown',
      description: 'Rapid-fire 50 button sequence',
      modifier: { sequence: 50, speed: 0.3, combo: true }
    },
    hacking: {
      name: 'Mainframe Breach',
      description: 'Corporate server with heavy security',
      modifier: { nodes: 30, firewalls: 15, time: 120 }
    },
    getaway: {
      name: 'Heat Five',
      description: 'Maximum wanted level escape',
      modifier: { cops: 10, helicopters: true, duration: 90 }
    }
  }
}

export function shouldTriggerBossGame(player, gameType) {
  if ((player?.level || 1) < BOSS_GAMES_CONFIG.unlockLevel) return false
  if (!BOSS_GAMES_CONFIG.bossTypes[gameType]) return false

  // Check if player hasn't done this boss today
  const today = new Date().toDateString()
  const lastBoss = player?.bossGames?.[gameType]
  if (lastBoss === today) return false

  return Math.random() < BOSS_GAMES_CONFIG.appearChance
}

export function getBossConfig(gameType) {
  const boss = BOSS_GAMES_CONFIG.bossTypes[gameType]
  if (!boss) return null

  return {
    ...boss,
    rewardMultiplier: BOSS_GAMES_CONFIG.rewardMultiplier,
    difficultyBoost: BOSS_GAMES_CONFIG.difficultyBoost
  }
}

export function recordBossAttempt(player, gameType) {
  if (!player.bossGames) player.bossGames = {}
  player.bossGames[gameType] = new Date().toDateString()
  savePlayerData(player)
}

/**
 * P75: Power-Up System
 * Collectible power-ups during mini-games
 */
export const POWER_UPS = {
  timeFreeze: {
    id: 'time_freeze',
    name: 'Time Freeze',
    description: 'Freezes timer for 3 seconds',
    duration: 3000,
    rarity: 'rare',
    icon: '⏱️',
    effect: 'freezeTimer'
  },
  doublePoints: {
    id: 'double_points',
    name: 'Double Points',
    description: 'All points are doubled for 5 seconds',
    duration: 5000,
    rarity: 'uncommon',
    icon: '✨',
    effect: 'doubleScore'
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Blocks one mistake',
    duration: 10000,
    rarity: 'common',
    icon: '🛡️',
    effect: 'blockMistake'
  },
  slowMotion: {
    id: 'slow_motion',
    name: 'Slow Motion',
    description: 'Everything slows down',
    duration: 4000,
    rarity: 'rare',
    icon: '🐢',
    effect: 'slowTime'
  },
  scoreBoost: {
    id: 'score_boost',
    name: 'Score Boost',
    description: 'Instant +500 points',
    duration: 0,
    rarity: 'common',
    icon: '💯',
    effect: 'instantScore',
    value: 500
  },
  comboKeeper: {
    id: 'combo_keeper',
    name: 'Combo Keeper',
    description: 'Combo won\'t break for 5 seconds',
    duration: 5000,
    rarity: 'uncommon',
    icon: '🔥',
    effect: 'protectCombo'
  },
  autoComplete: {
    id: 'auto_complete',
    name: 'Auto Complete',
    description: 'Automatically completes one action',
    duration: 0,
    rarity: 'epic',
    icon: '⚡',
    effect: 'autoAction'
  }
}

export function getRandomPowerUp(difficulty = 'normal') {
  const weights = {
    easy: { common: 60, uncommon: 30, rare: 8, epic: 2 },
    normal: { common: 50, uncommon: 35, rare: 12, epic: 3 },
    hard: { common: 40, uncommon: 35, rare: 20, epic: 5 },
    expert: { common: 30, uncommon: 35, rare: 25, epic: 10 }
  }

  const w = weights[difficulty] || weights.normal
  const roll = Math.random() * 100

  let targetRarity
  if (roll < w.epic) targetRarity = 'epic'
  else if (roll < w.epic + w.rare) targetRarity = 'rare'
  else if (roll < w.epic + w.rare + w.uncommon) targetRarity = 'uncommon'
  else targetRarity = 'common'

  const options = Object.values(POWER_UPS).filter(p => p.rarity === targetRarity)
  return options[Math.floor(Math.random() * options.length)]
}

/**
 * P76: Time Freeze Ability
 * Player can freeze time once per game
 */
export const TIME_FREEZE_CONFIG = {
  duration: 3000,           // 3 seconds freeze
  cooldownGames: 5,         // Can use once every 5 games
  unlockLevel: 10,
  upgradeEffect: {
    10: { duration: 3000 },
    20: { duration: 4000 },
    30: { duration: 5000 },
    50: { duration: 6000, cooldownGames: 3 }
  }
}

export function canUseTimeFreeze(player) {
  if ((player?.level || 1) < TIME_FREEZE_CONFIG.unlockLevel) return false

  const gamesSinceFreeze = player?.gamesSinceTimeFreeze || TIME_FREEZE_CONFIG.cooldownGames
  return gamesSinceFreeze >= TIME_FREEZE_CONFIG.cooldownGames
}

export function getTimeFreezeConfig(player) {
  const level = player?.level || 1
  const upgrades = TIME_FREEZE_CONFIG.upgradeEffect

  // Find highest applicable upgrade
  let config = { duration: TIME_FREEZE_CONFIG.duration, cooldownGames: TIME_FREEZE_CONFIG.cooldownGames }
  for (const [lvl, upgrade] of Object.entries(upgrades).sort((a, b) => b[0] - a[0])) {
    if (level >= parseInt(lvl)) {
      config = { ...config, ...upgrade }
      break
    }
  }

  return config
}

export function useTimeFreeze(player) {
  player.gamesSinceTimeFreeze = 0
  savePlayerData(player)
}

export function incrementGamesSinceFreeze(player) {
  player.gamesSinceTimeFreeze = (player.gamesSinceTimeFreeze || 0) + 1
  savePlayerData(player)
}

/**
 * P78: Stats Screen Data
 * Detailed statistics for mini-games
 */
export function getMiniGameStats(player) {
  const stats = player?.miniGameStats || {}

  return {
    totalGamesPlayed: stats.totalPlayed || 0,
    totalWins: stats.wins || 0,
    totalLosses: stats.losses || 0,
    winRate: stats.totalPlayed > 0 ? ((stats.wins / stats.totalPlayed) * 100).toFixed(1) : '0.0',

    highestScore: stats.highScore || 0,
    totalPointsEarned: stats.totalPoints || 0,
    averageScore: stats.totalPlayed > 0 ? Math.floor(stats.totalPoints / stats.totalPlayed) : 0,

    longestStreak: stats.longestStreak || 0,
    currentStreak: player?.miniGameStreak || 0,

    perfectGames: stats.perfectGames || 0,
    goldGames: stats.goldGames || 0,
    silverGames: stats.silverGames || 0,
    bronzeGames: stats.bronzeGames || 0,

    totalCashEarned: stats.totalCash || 0,
    totalXPEarned: stats.totalXP || 0,

    fastestWin: stats.fastestWin || null,
    slowestWin: stats.slowestWin || null,

    gameTypeStats: stats.byType || {},

    achievementsEarned: stats.achievements?.length || 0,
    favoriteGame: getFavoriteGame(stats.byType || {}),

    bossesDefeated: stats.bossesDefeated || 0,
    powerUpsUsed: stats.powerUpsUsed || 0,
    timeFreezeUsed: stats.timeFreezeUsed || 0,
    secondChancesUsed: stats.secondChancesUsed || 0
  }
}

function getFavoriteGame(byType) {
  if (!byType || Object.keys(byType).length === 0) return null

  let favorite = null
  let maxPlayed = 0

  for (const [type, data] of Object.entries(byType)) {
    if (data.played > maxPlayed) {
      maxPlayed = data.played
      favorite = type
    }
  }

  return favorite
}

export function updateMiniGameStats(player, gameType, result) {
  if (!player.miniGameStats) {
    player.miniGameStats = {
      totalPlayed: 0, wins: 0, losses: 0,
      highScore: 0, totalPoints: 0,
      longestStreak: 0, perfectGames: 0,
      goldGames: 0, silverGames: 0, bronzeGames: 0,
      totalCash: 0, totalXP: 0,
      byType: {}
    }
  }

  const stats = player.miniGameStats
  stats.totalPlayed++
  stats.totalPoints += result.score || 0
  stats.totalCash += result.cash || 0
  stats.totalXP += result.xp || 0

  if (result.score > stats.highScore) {
    stats.highScore = result.score
  }

  if (result.won) {
    stats.wins++

    // Track time records
    if (result.timeRemaining) {
      if (!stats.fastestWin || result.timeRemaining > stats.fastestWin) {
        stats.fastestWin = result.timeRemaining
      }
      if (!stats.slowestWin || result.timeRemaining < stats.slowestWin) {
        stats.slowestWin = result.timeRemaining
      }
    }

    // Track performance tier
    if (result.tier === 'perfect') stats.perfectGames++
    else if (result.tier === 'gold') stats.goldGames++
    else if (result.tier === 'silver') stats.silverGames++
    else if (result.tier === 'bronze') stats.bronzeGames++
  } else {
    stats.losses++
  }

  // Update longest streak
  const currentStreak = player.miniGameStreak || 0
  if (currentStreak > stats.longestStreak) {
    stats.longestStreak = currentStreak
  }

  // Update by-type stats
  if (!stats.byType[gameType]) {
    stats.byType[gameType] = { played: 0, wins: 0, highScore: 0, totalPoints: 0 }
  }
  stats.byType[gameType].played++
  stats.byType[gameType].totalPoints += result.score || 0
  if (result.won) stats.byType[gameType].wins++
  if (result.score > stats.byType[gameType].highScore) {
    stats.byType[gameType].highScore = result.score
  }

  savePlayerData(player)
}

/**
 * P79: Favorite Games System
 * Let players mark and quick-access favorite mini-games
 */
export function getFavoriteGames(player) {
  return player?.favoriteGames || []
}

export function addFavoriteGame(player, gameType) {
  if (!player.favoriteGames) player.favoriteGames = []

  if (!player.favoriteGames.includes(gameType)) {
    player.favoriteGames.push(gameType)
    // Limit to 5 favorites
    if (player.favoriteGames.length > 5) {
      player.favoriteGames = player.favoriteGames.slice(-5)
    }
    savePlayerData(player)
  }
}

export function removeFavoriteGame(player, gameType) {
  if (!player.favoriteGames) return

  player.favoriteGames = player.favoriteGames.filter(g => g !== gameType)
  savePlayerData(player)
}

export function isFavoriteGame(player, gameType) {
  return (player?.favoriteGames || []).includes(gameType)
}

/**
 * P80: Tournament Events System
 * Periodic competitive events with leaderboards
 */
export const TOURNAMENT_CONFIG = {
  enabled: true,
  types: {
    daily: {
      name: 'Daily Challenge',
      duration: 24 * 60 * 60 * 1000, // 24 hours
      entryFee: 0,
      minLevel: 5,
      maxAttempts: 3,
      rewards: [
        { rank: 1, cash: 5000, xp: 500, badge: 'Daily Champion' },
        { rank: 2, cash: 3000, xp: 300, badge: null },
        { rank: 3, cash: 2000, xp: 200, badge: null },
        { rank: 10, cash: 1000, xp: 100, badge: null },
        { rank: 50, cash: 500, xp: 50, badge: null }
      ]
    },
    weekly: {
      name: 'Weekly Showdown',
      duration: 7 * 24 * 60 * 60 * 1000,
      entryFee: 500,
      minLevel: 10,
      maxAttempts: 10,
      rewards: [
        { rank: 1, cash: 25000, xp: 2500, badge: 'Weekly Winner', tokens: 5 },
        { rank: 2, cash: 15000, xp: 1500, badge: null, tokens: 3 },
        { rank: 3, cash: 10000, xp: 1000, badge: null, tokens: 2 },
        { rank: 10, cash: 5000, xp: 500, badge: null, tokens: 1 },
        { rank: 100, cash: 1000, xp: 100, badge: null, tokens: 0 }
      ]
    },
    special: {
      name: 'Special Event',
      duration: 3 * 24 * 60 * 60 * 1000,
      entryFee: 1000,
      minLevel: 20,
      maxAttempts: 5,
      rewards: [
        { rank: 1, cash: 50000, xp: 5000, badge: 'Event Champion', tokens: 10, item: 'exclusive_item' },
        { rank: 2, cash: 30000, xp: 3000, badge: 'Event Runner-Up', tokens: 7 },
        { rank: 3, cash: 20000, xp: 2000, badge: null, tokens: 5 },
        { rank: 10, cash: 10000, xp: 1000, badge: null, tokens: 3 },
        { rank: 50, cash: 5000, xp: 500, badge: null, tokens: 1 }
      ]
    }
  }
}

export function getActiveTournament() {
  // Check for stored active tournament
  const stored = localStorage.getItem('streetLegacy_activeTournament')
  if (stored) {
    try {
      const tournament = JSON.parse(stored)
      if (tournament.endTime > Date.now()) {
        return tournament
      }
    } catch (e) {
      // Invalid data, generate new
    }
  }

  // Generate daily tournament
  return generateTournament('daily')
}

export function generateTournament(type = 'daily') {
  const config = TOURNAMENT_CONFIG.types[type]
  if (!config) return null

  const gameTypes = ['snake', 'lockpick', 'qte', 'memory', 'frogger', 'hacking', 'rhythm']
  const selectedGame = gameTypes[Math.floor(Math.random() * gameTypes.length)]

  const now = Date.now()
  const tournament = {
    id: `${type}_${now}`,
    type,
    name: config.name,
    gameType: selectedGame,
    startTime: now,
    endTime: now + config.duration,
    entryFee: config.entryFee,
    minLevel: config.minLevel,
    maxAttempts: config.maxAttempts,
    rewards: config.rewards,
    leaderboard: []
  }

  localStorage.setItem('streetLegacy_activeTournament', JSON.stringify(tournament))
  return tournament
}

export function canEnterTournament(player, tournament) {
  if (!tournament) return { can: false, reason: 'No active tournament' }
  if ((player?.level || 1) < tournament.minLevel) {
    return { can: false, reason: `Requires level ${tournament.minLevel}` }
  }
  if ((player?.cash || 0) < tournament.entryFee) {
    return { can: false, reason: `Requires $${tournament.entryFee} entry fee` }
  }

  const attempts = getTournamentAttempts(player, tournament.id)
  if (attempts >= tournament.maxAttempts) {
    return { can: false, reason: `Max attempts (${tournament.maxAttempts}) reached` }
  }

  return { can: true, attemptsRemaining: tournament.maxAttempts - attempts }
}

export function getTournamentAttempts(player, tournamentId) {
  return player?.tournamentAttempts?.[tournamentId] || 0
}

export function recordTournamentAttempt(player, tournamentId, score) {
  if (!player.tournamentAttempts) player.tournamentAttempts = {}
  if (!player.tournamentScores) player.tournamentScores = {}

  player.tournamentAttempts[tournamentId] = (player.tournamentAttempts[tournamentId] || 0) + 1

  // Store best score
  const currentBest = player.tournamentScores[tournamentId] || 0
  if (score > currentBest) {
    player.tournamentScores[tournamentId] = score
    updateTournamentLeaderboard(tournamentId, player.id || 'player', player.username || 'You', score)
  }

  savePlayerData(player)
}

function updateTournamentLeaderboard(tournamentId, playerId, playerName, score) {
  const stored = localStorage.getItem('streetLegacy_activeTournament')
  if (!stored) return

  try {
    const tournament = JSON.parse(stored)
    if (tournament.id !== tournamentId) return

    // Find or add player entry
    const existingIndex = tournament.leaderboard.findIndex(e => e.id === playerId)
    if (existingIndex >= 0) {
      if (score > tournament.leaderboard[existingIndex].score) {
        tournament.leaderboard[existingIndex].score = score
      }
    } else {
      tournament.leaderboard.push({ id: playerId, name: playerName, score })
    }

    // Sort leaderboard
    tournament.leaderboard.sort((a, b) => b.score - a.score)

    localStorage.setItem('streetLegacy_activeTournament', JSON.stringify(tournament))
  } catch (e) {
    // Error updating
  }
}

export function getTournamentRank(player, tournamentId) {
  const stored = localStorage.getItem('streetLegacy_activeTournament')
  if (!stored) return null

  try {
    const tournament = JSON.parse(stored)
    if (tournament.id !== tournamentId) return null

    const playerId = player?.id || 'player'
    const rank = tournament.leaderboard.findIndex(e => e.id === playerId) + 1

    return rank > 0 ? rank : null
  } catch (e) {
    return null
  }
}
