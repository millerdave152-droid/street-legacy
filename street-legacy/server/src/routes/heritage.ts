import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware as authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ============================================
// HERITAGE BACKGROUNDS DATA
// ============================================

interface HeritageBonus {
  stat: string;
  value: number;
  description: string;
}

interface HeritageAbility {
  id: string;
  name: string;
  description: string;
  type: 'active' | 'passive';
  unlockRep: number;
  unlockCost: number;
  cooldownMinutes?: number;
  effect: Record<string, any>;
}

interface HeritageData {
  name: string;
  region: string;
  flag: string;
  description: string;
  lore: string;
  bonuses: HeritageBonus[];
  abilities: HeritageAbility[];
  restrictions: string[];
  startingCash: number;
  startingRep: number;
}

const HERITAGE_DATA: Record<string, HeritageData> = {
  // CARIBBEAN
  jamaican: {
    name: 'Jamaican',
    region: 'Caribbean',
    flag: '🇯🇲',
    description: 'From the streets of Kingston to the GTA, Jamaican heritage brings respect and fear.',
    lore: 'The Jamaican posse has roots going back to the 80s in Toronto. Known for their fearless approach and tight community bonds, they control key distribution networks across the city.',
    bonuses: [
      { stat: 'intimidation', value: 15, description: '+15% Intimidation' },
      { stat: 'drug_profits', value: 10, description: '+10% Drug Trade Profits' },
      { stat: 'music_influence', value: 10, description: '+10% Music Industry Connections' }
    ],
    abilities: [
      { id: 'yardie_connect', name: 'Yardie Connect', description: 'Access wholesale drug prices once per day', type: 'active', unlockRep: 500, unlockCost: 5000, cooldownMinutes: 1440, effect: { drug_discount: 0.3 } },
      { id: 'kingston_heat', name: 'Kingston Heat', description: 'Increased damage in close combat', type: 'passive', unlockRep: 1000, unlockCost: 10000, effect: { melee_damage: 1.2 } }
    ],
    restrictions: ['russian_contacts', 'yakuza_missions'],
    startingCash: 2500,
    startingRep: 50
  },
  haitian: {
    name: 'Haitian',
    region: 'Caribbean',
    flag: '🇭🇹',
    description: 'Haitian heritage carries ancient wisdom and unbreakable resilience.',
    lore: 'The Haitian community in Toronto is small but fiercely loyal. Their spiritual practices and community bonds make them formidable allies and dangerous enemies.',
    bonuses: [
      { stat: 'debuff_power', value: 20, description: '+20% Debuff Effectiveness' },
      { stat: 'resilience', value: 10, description: '+10% Damage Resistance' },
      { stat: 'community_trust', value: 15, description: '+15% Community Trust' }
    ],
    abilities: [
      { id: 'loas_favor', name: "Loa's Favor", description: 'Curse an enemy to reduce their stats for 24 hours', type: 'active', unlockRep: 750, unlockCost: 7500, cooldownMinutes: 1440, effect: { enemy_stat_reduction: 0.15 } },
      { id: 'voodoo_ward', name: 'Voodoo Ward', description: 'Reduce incoming debuff duration', type: 'passive', unlockRep: 1500, unlockCost: 15000, effect: { debuff_resistance: 0.25 } }
    ],
    restrictions: [],
    startingCash: 2000,
    startingRep: 75
  },
  trinidadian: {
    name: 'Trinidadian',
    region: 'Caribbean',
    flag: '🇹🇹',
    description: 'Trinidadian heritage brings the spirit of Carnival and street smart hustle.',
    lore: 'Trini culture runs deep in Toronto. From Caribana to the underground party scene, those with Trinidadian roots know how to work a crowd and make money flow.',
    bonuses: [
      { stat: 'event_earnings', value: 15, description: '+15% Event Earnings' },
      { stat: 'music_scams', value: 10, description: '+10% Entertainment Fraud' },
      { stat: 'charm', value: 10, description: '+10% Charm' }
    ],
    abilities: [
      { id: 'carnival_king', name: 'Carnival King', description: 'Double earnings during city events', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { event_multiplier: 2.0 } },
      { id: 'soca_network', name: 'Soca Network', description: 'Access exclusive party venue missions', type: 'active', unlockRep: 1000, unlockCost: 8000, cooldownMinutes: 720, effect: { unlock_party_missions: true } }
    ],
    restrictions: [],
    startingCash: 3000,
    startingRep: 40
  },

  // EUROPEAN
  french: {
    name: 'French',
    region: 'European',
    flag: '🇫🇷',
    description: 'French heritage brings sophistication to the criminal underworld.',
    lore: 'The French connection in Toronto operates differently - art heists, high-end fraud, and romance scams targeting the wealthy. Style matters as much as results.',
    bonuses: [
      { stat: 'art_theft', value: 15, description: '+15% Art Theft Success' },
      { stat: 'romance_scams', value: 10, description: '+10% Romance Scam Profits' },
      { stat: 'high_society', value: 10, description: '+10% High Society Access' }
    ],
    abilities: [
      { id: 'savoir_faire', name: 'Savoir Faire', description: 'Blend into high-class environments without suspicion', type: 'passive', unlockRep: 750, unlockCost: 10000, effect: { elite_disguise: true } },
      { id: 'louvre_touch', name: 'Louvre Touch', description: 'Identify valuable art pieces for theft', type: 'active', unlockRep: 1500, unlockCost: 20000, cooldownMinutes: 480, effect: { art_detection: true } }
    ],
    restrictions: [],
    startingCash: 4000,
    startingRep: 25
  },
  italian: {
    name: 'Italian',
    region: 'European',
    flag: '🇮🇹',
    description: 'Italian heritage carries centuries of organized crime tradition.',
    lore: 'The Italian families have operated in Toronto since the early 1900s. From the old Calabrian crews to modern operations, family loyalty is everything.',
    bonuses: [
      { stat: 'family_loyalty', value: 20, description: '+20% Family/Crew Bonuses' },
      { stat: 'restaurant_fronts', value: 10, description: '+10% Front Business Income' },
      { stat: 'respect', value: 10, description: '+10% Respect Earned' }
    ],
    abilities: [
      { id: 'omerta', name: 'Omertà', description: 'Cannot be forced to snitch, even under pressure', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { snitch_immunity: true } },
      { id: 'family_meeting', name: 'Family Meeting', description: 'Summon crew for emergency backup', type: 'active', unlockRep: 2000, unlockCost: 25000, cooldownMinutes: 2880, effect: { summon_backup: 3 } }
    ],
    restrictions: [],
    startingCash: 3500,
    startingRep: 60
  },
  russian: {
    name: 'Russian',
    region: 'European',
    flag: '🇷🇺',
    description: 'Russian heritage brings cold efficiency and brutal effectiveness.',
    lore: 'The Bratva arrived in Toronto after the Soviet collapse. They brought military training, no fear, and connections to global arms networks.',
    bonuses: [
      { stat: 'weapons_deals', value: 15, description: '+15% Weapons Deal Profits' },
      { stat: 'cold_resistance', value: 10, description: '+10% Winter Operation Bonus' },
      { stat: 'intimidation', value: 10, description: '+10% Intimidation' }
    ],
    abilities: [
      { id: 'bratva_code', name: 'Bratva Code', description: 'Access to exclusive weapons black market', type: 'passive', unlockRep: 1000, unlockCost: 15000, effect: { weapons_blackmarket: true } },
      { id: 'siberian_training', name: 'Siberian Training', description: 'Ignore environmental penalties', type: 'passive', unlockRep: 500, unlockCost: 7500, effect: { weather_immunity: true } }
    ],
    restrictions: ['jamaican_contacts', 'caribbean_missions'],
    startingCash: 3000,
    startingRep: 45
  },
  polish: {
    name: 'Polish',
    region: 'European',
    flag: '🇵🇱',
    description: 'Polish heritage brings blue-collar toughness and construction connections.',
    lore: 'The Polish community built half of Toronto, literally. Their construction unions and trades connections make them invaluable for certain operations.',
    bonuses: [
      { stat: 'construction_access', value: 20, description: '+20% Construction Site Access' },
      { stat: 'physical_labor', value: 10, description: '+10% Physical Job Rewards' },
      { stat: 'endurance', value: 10, description: '+10% Stamina' }
    ],
    abilities: [
      { id: 'union_card', name: 'Union Card', description: 'Access any construction site without suspicion', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { construction_access: true } },
      { id: 'concrete_shoes', name: 'Concrete Shoes', description: 'Special disposal method for bodies', type: 'active', unlockRep: 1500, unlockCost: 20000, cooldownMinutes: 4320, effect: { evidence_disposal: true } }
    ],
    restrictions: [],
    startingCash: 2500,
    startingRep: 35
  },

  // AFRICAN
  nigerian: {
    name: 'Nigerian',
    region: 'African',
    flag: '🇳🇬',
    description: 'Nigerian heritage brings global connections and digital expertise.',
    lore: 'The Nigerian network in Toronto is sophisticated and far-reaching. From crypto to oil money, they understand how to move wealth across borders.',
    bonuses: [
      { stat: 'crypto_scams', value: 20, description: '+20% Crypto/Email Scam Profits' },
      { stat: 'oil_contacts', value: 10, description: '+10% Oil Industry Connections' },
      { stat: 'global_network', value: 10, description: '+10% International Deal Bonuses' }
    ],
    abilities: [
      { id: 'prince_protocol', name: 'Prince Protocol', description: 'Launch sophisticated email campaigns for profit', type: 'active', unlockRep: 500, unlockCost: 5000, cooldownMinutes: 720, effect: { email_scam_launch: true } },
      { id: 'lagos_hustle', name: 'Lagos Hustle', description: 'Negotiate better prices on all deals', type: 'passive', unlockRep: 1000, unlockCost: 12000, effect: { negotiation_bonus: 0.1 } }
    ],
    restrictions: [],
    startingCash: 3000,
    startingRep: 40
  },
  south_african: {
    name: 'South African',
    region: 'African',
    flag: '🇿🇦',
    description: 'South African heritage brings diamond expertise and diverse skills.',
    lore: 'From Johannesburg to Toronto, South Africans brought expertise in precious gems and a unique perspective from the rainbow nation.',
    bonuses: [
      { stat: 'diamond_heists', value: 15, description: '+15% Diamond/Gem Heist Success' },
      { stat: 'safari_smuggling', value: 10, description: '+10% Exotic Smuggling Profits' },
      { stat: 'multilingual', value: 10, description: '+10% Negotiation (Multi-language)' }
    ],
    abilities: [
      { id: 'blood_diamond', name: 'Blood Diamond', description: 'Identify and fence precious gems at premium prices', type: 'passive', unlockRep: 1000, unlockCost: 15000, effect: { gem_bonus: 0.25 } },
      { id: 'kruger_contacts', name: 'Kruger Contacts', description: 'Access exotic animal smuggling network', type: 'active', unlockRep: 2000, unlockCost: 25000, cooldownMinutes: 2880, effect: { exotic_smuggling: true } }
    ],
    restrictions: [],
    startingCash: 3500,
    startingRep: 35
  },
  somali: {
    name: 'Somali',
    region: 'African',
    flag: '🇸🇴',
    description: 'Somali heritage brings maritime knowledge and tight community bonds.',
    lore: 'The Somali community in Toronto is tight-knit and fiercely protective. Their knowledge of shipping routes and ports is unmatched.',
    bonuses: [
      { stat: 'port_operations', value: 15, description: '+15% Port/Shipping Operations' },
      { stat: 'community_protection', value: 15, description: '+15% Community Protection' },
      { stat: 'navigation', value: 10, description: '+10% Vehicle Theft (Maritime)' }
    ],
    abilities: [
      { id: 'pirate_legacy', name: 'Pirate Legacy', description: 'Access shipping container heist opportunities', type: 'active', unlockRep: 1000, unlockCost: 12000, cooldownMinutes: 1440, effect: { container_heists: true } },
      { id: 'clan_protection', name: 'Clan Protection', description: 'Reduced targeting from rivals in Somali areas', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { territory_protection: 0.2 } }
    ],
    restrictions: [],
    startingCash: 2000,
    startingRep: 55
  },

  // ASIAN
  chinese: {
    name: 'Chinese',
    region: 'Asian',
    flag: '🇨🇳',
    description: 'Chinese heritage brings ancient organization and modern business acumen.',
    lore: 'From the old Chinatown to Markham, Chinese organizations have operated in Toronto for over a century. Import/export and gambling are their domains.',
    bonuses: [
      { stat: 'import_export', value: 15, description: '+15% Import/Export Profits' },
      { stat: 'gambling', value: 10, description: '+10% Gambling Winnings' },
      { stat: 'patience', value: 10, description: '+10% Long-term Investment Returns' }
    ],
    abilities: [
      { id: 'triad_ties', name: 'Triad Ties', description: 'Access to international smuggling routes', type: 'passive', unlockRep: 1000, unlockCost: 15000, effect: { international_smuggling: true } },
      { id: 'red_envelope', name: 'Red Envelope', description: 'Bribe officials with increased effectiveness', type: 'active', unlockRep: 750, unlockCost: 10000, cooldownMinutes: 720, effect: { bribe_bonus: 0.3 } }
    ],
    restrictions: ['yakuza_missions'],
    startingCash: 4000,
    startingRep: 30
  },
  japanese: {
    name: 'Japanese',
    region: 'Asian',
    flag: '🇯🇵',
    description: 'Japanese heritage brings honor, precision, and technological mastery.',
    lore: 'The Yakuza presence in Toronto is subtle but powerful. They operate with precision and honor, focusing on tech crimes and high-end operations.',
    bonuses: [
      { stat: 'tech_crimes', value: 10, description: '+10% Tech Crime Success' },
      { stat: 'honor_duels', value: 15, description: '+15% PvP Duel Bonuses' },
      { stat: 'precision', value: 10, description: '+10% Critical Hit Chance' }
    ],
    abilities: [
      { id: 'yakuza_protocol', name: 'Yakuza Protocol', description: 'Formal duel system with increased stakes', type: 'active', unlockRep: 1000, unlockCost: 15000, cooldownMinutes: 1440, effect: { formal_duel: true } },
      { id: 'bushido_code', name: 'Bushido Code', description: 'Cannot be attacked during certain honor periods', type: 'passive', unlockRep: 2000, unlockCost: 25000, effect: { honor_protection: true } }
    ],
    restrictions: ['triad_missions', 'chinese_contacts'],
    startingCash: 3500,
    startingRep: 40
  },
  filipino: {
    name: 'Filipino',
    region: 'Asian',
    flag: '🇵🇭',
    description: 'Filipino heritage brings maritime expertise and healthcare connections.',
    lore: 'The Filipino community is one of Toronto\'s largest. Their presence in healthcare and maritime industries provides unique opportunities.',
    bonuses: [
      { stat: 'maritime_crimes', value: 15, description: '+15% Maritime Crime Success' },
      { stat: 'healthcare_scams', value: 10, description: '+10% Healthcare Fraud Profits' },
      { stat: 'community_size', value: 10, description: '+10% Community Job Availability' }
    ],
    abilities: [
      { id: 'balikbayan_box', name: 'Balikbayan Box', description: 'Smuggle items internationally without detection', type: 'active', unlockRep: 750, unlockCost: 8000, cooldownMinutes: 2880, effect: { smuggle_international: true } },
      { id: 'hospital_contacts', name: 'Hospital Contacts', description: 'Access to prescription drug supplies', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { prescription_access: true } }
    ],
    restrictions: [],
    startingCash: 2500,
    startingRep: 45
  },
  vietnamese: {
    name: 'Vietnamese',
    region: 'Asian',
    flag: '🇻🇳',
    description: 'Vietnamese heritage brings resilience and cultivation expertise.',
    lore: 'The Vietnamese community built their reputation through hard work and tight-knit operations. Their expertise in cultivation is legendary.',
    bonuses: [
      { stat: 'cultivation', value: 20, description: '+20% Drug Cultivation Yields' },
      { stat: 'nail_salon_fronts', value: 15, description: '+15% Salon Front Income' },
      { stat: 'resilience', value: 10, description: '+10% Recovery Speed' }
    ],
    abilities: [
      { id: 'green_thumb', name: 'Green Thumb', description: 'Grow operations produce higher quality product', type: 'passive', unlockRep: 500, unlockCost: 6000, effect: { grow_quality: 1.25 } },
      { id: 'tunnel_vision', name: 'Tunnel Vision', description: 'Build hidden grow operations', type: 'active', unlockRep: 1500, unlockCost: 20000, cooldownMinutes: 4320, effect: { hidden_grow: true } }
    ],
    restrictions: [],
    startingCash: 2000,
    startingRep: 50
  },
  indian: {
    name: 'Indian',
    region: 'Asian',
    flag: '🇮🇳',
    description: 'Indian heritage brings business acumen and vast family networks.',
    lore: 'The Indian community in the GTA is massive and diverse. From Brampton to Scarborough, their business networks and family connections are invaluable.',
    bonuses: [
      { stat: 'business_operations', value: 15, description: '+15% Business Front Profits' },
      { stat: 'family_network', value: 15, description: '+15% Family Connection Bonuses' },
      { stat: 'negotiation', value: 10, description: '+10% Deal Negotiation' }
    ],
    abilities: [
      { id: 'family_business', name: 'Family Business', description: 'Start businesses with reduced costs', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { business_discount: 0.2 } },
      { id: 'cousin_network', name: 'Cousin Network', description: 'Call in favors from extensive family', type: 'active', unlockRep: 1000, unlockCost: 10000, cooldownMinutes: 1440, effect: { family_favor: true } }
    ],
    restrictions: [],
    startingCash: 3500,
    startingRep: 35
  },

  // NORTH AMERICAN
  canadian: {
    name: 'Canadian',
    region: 'North American',
    flag: '🇨🇦',
    description: 'Born and raised on home turf, Canadian heritage means knowing every corner.',
    lore: 'Homegrown talent that knows Toronto inside and out. From the Beaches to Rexdale, born Canadians have the home advantage.',
    bonuses: [
      { stat: 'all_stats', value: 10, description: '+10% All Stats (Home Turf)' },
      { stat: 'hockey_betting', value: 15, description: '+15% Sports Betting Returns' },
      { stat: 'local_knowledge', value: 10, description: '+10% Map Discovery' }
    ],
    abilities: [
      { id: 'home_ice', name: 'Home Ice Advantage', description: 'Bonus stats when operating in your home district', type: 'passive', unlockRep: 250, unlockCost: 3000, effect: { home_district_bonus: 0.2 } },
      { id: 'true_north', name: 'True North', description: 'Never get lost, always know escape routes', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { escape_bonus: 0.25 } }
    ],
    restrictions: [],
    startingCash: 3000,
    startingRep: 50
  },
  mexican: {
    name: 'Mexican',
    region: 'North American',
    flag: '🇲🇽',
    description: 'Mexican heritage brings cartel connections and border expertise.',
    lore: 'Mexican operations in Toronto connect to the massive cartels down south. Their supply chain knowledge is unparalleled.',
    bonuses: [
      { stat: 'border_operations', value: 20, description: '+20% Border/Import Operations' },
      { stat: 'cartel_connections', value: 10, description: '+10% Cartel Contact Trust' },
      { stat: 'family_loyalty', value: 10, description: '+10% Family Operation Bonuses' }
    ],
    abilities: [
      { id: 'cartel_pipeline', name: 'Cartel Pipeline', description: 'Access bulk drug imports at reduced prices', type: 'passive', unlockRep: 1000, unlockCost: 15000, effect: { bulk_drug_discount: 0.25 } },
      { id: 'plaza_boss', name: 'Plaza Boss', description: 'Control a distribution territory', type: 'active', unlockRep: 2500, unlockCost: 50000, cooldownMinutes: 10080, effect: { territory_control: true } }
    ],
    restrictions: [],
    startingCash: 2500,
    startingRep: 55
  },
  american: {
    name: 'American',
    region: 'North American',
    flag: '🇺🇸',
    description: 'American heritage brings cross-border connections and media savvy.',
    lore: 'Americans in Toronto often came north to escape heat down south. They bring connections, cash, and knowledge of both sides of the border.',
    bonuses: [
      { stat: 'media_manipulation', value: 15, description: '+15% Media/Publicity Operations' },
      { stat: 'cross_border', value: 15, description: '+15% Cross-Border Operations' },
      { stat: 'cash_flow', value: 10, description: '+10% Cash Earning Speed' }
    ],
    abilities: [
      { id: 'american_dream', name: 'American Dream', description: 'Higher risk, higher reward on all jobs', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { risk_reward_multiplier: 1.5 } },
      { id: 'border_run', name: 'Border Run', description: 'Quick escape across the border when heat is high', type: 'active', unlockRep: 1000, unlockCost: 10000, cooldownMinutes: 4320, effect: { border_escape: true } }
    ],
    restrictions: [],
    startingCash: 4000,
    startingRep: 30
  },

  // MIDDLE EASTERN
  lebanese: {
    name: 'Lebanese',
    region: 'Middle Eastern',
    flag: '🇱🇧',
    description: 'Lebanese heritage brings Mediterranean charm and business networks.',
    lore: 'The Lebanese community has strong roots in Toronto\'s restaurant and nightlife scenes. Their business networks span the globe.',
    bonuses: [
      { stat: 'nightclub_operations', value: 15, description: '+15% Nightclub/Bar Operations' },
      { stat: 'charm', value: 15, description: '+15% Charm/Persuasion' },
      { stat: 'restaurant_fronts', value: 10, description: '+10% Restaurant Front Income' }
    ],
    abilities: [
      { id: 'cedar_connections', name: 'Cedar Connections', description: 'Access to international diamond trade', type: 'passive', unlockRep: 1000, unlockCost: 12000, effect: { diamond_access: true } },
      { id: 'mediterranean_hospitality', name: 'Mediterranean Hospitality', description: 'NPCs give better information', type: 'passive', unlockRep: 500, unlockCost: 5000, effect: { info_bonus: 0.2 } }
    ],
    restrictions: [],
    startingCash: 3500,
    startingRep: 40
  },
  iranian: {
    name: 'Iranian',
    region: 'Middle Eastern',
    flag: '🇮🇷',
    description: 'Iranian heritage brings ancient merchant traditions and cultural pride.',
    lore: 'The Iranian community in North York is affluent and connected. Their carpet shops and businesses often hide significant wealth.',
    bonuses: [
      { stat: 'luxury_goods', value: 15, description: '+15% Luxury Goods Trafficking' },
      { stat: 'antique_knowledge', value: 15, description: '+15% Antique Identification' },
      { stat: 'wealth_hiding', value: 10, description: '+10% Money Laundering' }
    ],
    abilities: [
      { id: 'persian_empire', name: 'Persian Empire', description: 'Access to luxury goods smuggling network', type: 'passive', unlockRep: 1000, unlockCost: 15000, effect: { luxury_smuggling: true } },
      { id: 'bazaar_master', name: 'Bazaar Master', description: 'Always get the best prices when buying/selling', type: 'passive', unlockRep: 750, unlockCost: 8000, effect: { trade_bonus: 0.15 } }
    ],
    restrictions: [],
    startingCash: 4500,
    startingRep: 25
  }
};

// ============================================
// APPEARANCE OPTIONS
// ============================================

const APPEARANCE_OPTIONS = {
  skinTones: [
    { id: 'very_light', name: 'Very Light', hex: '#FFE4C4' },
    { id: 'light', name: 'Light', hex: '#F5DEB3' },
    { id: 'medium_light', name: 'Medium Light', hex: '#DEB887' },
    { id: 'medium', name: 'Medium', hex: '#D2A679' },
    { id: 'medium_dark', name: 'Medium Dark', hex: '#A0785A' },
    { id: 'dark', name: 'Dark', hex: '#8B6914' },
    { id: 'very_dark', name: 'Very Dark', hex: '#4A3728' }
  ],
  hairStyles: [
    { id: 'bald', name: 'Bald', gender: 'any' },
    { id: 'buzz', name: 'Buzz Cut', gender: 'any' },
    { id: 'short', name: 'Short', gender: 'any' },
    { id: 'medium', name: 'Medium', gender: 'any' },
    { id: 'long', name: 'Long', gender: 'any' },
    { id: 'braids', name: 'Braids', gender: 'any' },
    { id: 'dreads', name: 'Dreadlocks', gender: 'any' },
    { id: 'afro', name: 'Afro', gender: 'any' },
    { id: 'cornrows', name: 'Cornrows', gender: 'any' },
    { id: 'mohawk', name: 'Mohawk', gender: 'any' },
    { id: 'ponytail', name: 'Ponytail', gender: 'any' },
    { id: 'slicked', name: 'Slicked Back', gender: 'any' }
  ],
  hairColors: [
    { id: 'black', name: 'Black', hex: '#0A0A0A' },
    { id: 'dark_brown', name: 'Dark Brown', hex: '#3D2314' },
    { id: 'brown', name: 'Brown', hex: '#6B4423' },
    { id: 'light_brown', name: 'Light Brown', hex: '#A67B5B' },
    { id: 'blonde', name: 'Blonde', hex: '#E8D5A3' },
    { id: 'red', name: 'Red', hex: '#8B2500' },
    { id: 'grey', name: 'Grey', hex: '#808080' },
    { id: 'white', name: 'White', hex: '#E8E8E8' },
    { id: 'blue', name: 'Blue', hex: '#0066CC' },
    { id: 'purple', name: 'Purple', hex: '#6B238E' },
    { id: 'green', name: 'Green', hex: '#228B22' }
  ],
  eyeColors: [
    { id: 'brown', name: 'Brown', hex: '#634E34' },
    { id: 'dark_brown', name: 'Dark Brown', hex: '#3D2314' },
    { id: 'hazel', name: 'Hazel', hex: '#8E7618' },
    { id: 'green', name: 'Green', hex: '#3D9970' },
    { id: 'blue', name: 'Blue', hex: '#4A90D9' },
    { id: 'grey', name: 'Grey', hex: '#808080' },
    { id: 'amber', name: 'Amber', hex: '#FFBF00' }
  ],
  faceShapes: [
    { id: 'oval', name: 'Oval' },
    { id: 'round', name: 'Round' },
    { id: 'square', name: 'Square' },
    { id: 'heart', name: 'Heart' },
    { id: 'oblong', name: 'Oblong' },
    { id: 'diamond', name: 'Diamond' }
  ],
  facialHair: [
    { id: 'none', name: 'None' },
    { id: 'stubble', name: 'Stubble' },
    { id: 'goatee', name: 'Goatee' },
    { id: 'mustache', name: 'Mustache' },
    { id: 'full_beard', name: 'Full Beard' },
    { id: 'mutton_chops', name: 'Mutton Chops' },
    { id: 'chin_strap', name: 'Chin Strap' }
  ],
  builds: [
    { id: 'slim', name: 'Slim' },
    { id: 'average', name: 'Average' },
    { id: 'athletic', name: 'Athletic' },
    { id: 'muscular', name: 'Muscular' },
    { id: 'heavy', name: 'Heavy' }
  ],
  clothingStyles: [
    { id: 'streetwear', name: 'Streetwear' },
    { id: 'business', name: 'Business' },
    { id: 'casual', name: 'Casual' },
    { id: 'athletic', name: 'Athletic' },
    { id: 'luxury', name: 'Luxury' },
    { id: 'vintage', name: 'Vintage' },
    { id: 'punk', name: 'Punk' }
  ],
  scars: [
    { id: 'none', name: 'None' },
    { id: 'cheek', name: 'Cheek Scar' },
    { id: 'eyebrow', name: 'Eyebrow Scar' },
    { id: 'lip', name: 'Lip Scar' },
    { id: 'forehead', name: 'Forehead Scar' },
    { id: 'neck', name: 'Neck Scar' }
  ]
};

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initHeritageSystem(): Promise<void> {
  try {
    // Create heritage_backgrounds table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heritage_backgrounds (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        region VARCHAR(50) NOT NULL,
        flag VARCHAR(10) NOT NULL,
        description TEXT,
        lore TEXT,
        base_bonuses JSONB NOT NULL DEFAULT '[]',
        unlockable_abilities JSONB NOT NULL DEFAULT '[]',
        restrictions JSONB NOT NULL DEFAULT '[]',
        starting_cash INTEGER NOT NULL DEFAULT 2500,
        starting_rep INTEGER NOT NULL DEFAULT 50,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create character_appearance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS character_appearance (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
        skin_tone VARCHAR(30),
        hair_style VARCHAR(30),
        hair_color VARCHAR(30),
        face_shape VARCHAR(30),
        eye_color VARCHAR(30),
        facial_hair VARCHAR(30),
        scars JSONB DEFAULT '[]',
        tattoos JSONB DEFAULT '[]',
        height INTEGER DEFAULT 170,
        build VARCHAR(30),
        age_appearance INTEGER DEFAULT 25,
        clothing_style VARCHAR(30),
        accessories JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create player_heritage table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_heritage (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE UNIQUE,
        primary_heritage VARCHAR(50) NOT NULL,
        secondary_heritage VARCHAR(50),
        mixed_heritage BOOLEAN DEFAULT FALSE,
        heritage_bonuses JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create heritage_abilities table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heritage_abilities (
        id SERIAL PRIMARY KEY,
        ability_key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        heritage_key VARCHAR(50) NOT NULL,
        ability_type VARCHAR(20) NOT NULL,
        unlock_rep INTEGER NOT NULL DEFAULT 0,
        unlock_cost INTEGER NOT NULL DEFAULT 0,
        cooldown_minutes INTEGER,
        effect JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create player_unlocked_abilities table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_unlocked_abilities (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        ability_key VARCHAR(50) NOT NULL,
        unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_used TIMESTAMP WITH TIME ZONE,
        UNIQUE(player_id, ability_key)
      )
    `);

    // Add heritage columns to players if they don't exist
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE players ADD COLUMN IF NOT EXISTS character_created BOOLEAN DEFAULT FALSE;
        ALTER TABLE players ADD COLUMN IF NOT EXISTS primary_heritage VARCHAR(50);
        ALTER TABLE players ADD COLUMN IF NOT EXISTS secondary_heritage VARCHAR(50);
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Seed heritage data
    for (const [key, data] of Object.entries(HERITAGE_DATA)) {
      await pool.query(`
        INSERT INTO heritage_backgrounds (key, name, region, flag, description, lore, base_bonuses, unlockable_abilities, restrictions, starting_cash, starting_rep)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          region = EXCLUDED.region,
          flag = EXCLUDED.flag,
          description = EXCLUDED.description,
          lore = EXCLUDED.lore,
          base_bonuses = EXCLUDED.base_bonuses,
          unlockable_abilities = EXCLUDED.unlockable_abilities,
          restrictions = EXCLUDED.restrictions,
          starting_cash = EXCLUDED.starting_cash,
          starting_rep = EXCLUDED.starting_rep
      `, [key, data.name, data.region, data.flag, data.description, data.lore,
          JSON.stringify(data.bonuses), JSON.stringify(data.abilities),
          JSON.stringify(data.restrictions), data.startingCash, data.startingRep]);

      // Seed abilities
      for (const ability of data.abilities) {
        await pool.query(`
          INSERT INTO heritage_abilities (ability_key, name, description, heritage_key, ability_type, unlock_rep, unlock_cost, cooldown_minutes, effect)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (ability_key) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            heritage_key = EXCLUDED.heritage_key,
            ability_type = EXCLUDED.ability_type,
            unlock_rep = EXCLUDED.unlock_rep,
            unlock_cost = EXCLUDED.unlock_cost,
            cooldown_minutes = EXCLUDED.cooldown_minutes,
            effect = EXCLUDED.effect
        `, [ability.id, ability.name, ability.description, key, ability.type,
            ability.unlockRep, ability.unlockCost, ability.cooldownMinutes || null,
            JSON.stringify(ability.effect)]);
      }
    }

    console.log('Heritage system initialized successfully');
  } catch (error) {
    console.error('Error initializing heritage system:', error);
  }
}

// ============================================
// API ROUTES
// ============================================

// Get all heritage backgrounds
router.get('/list', async (_req, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT key, name, region, flag, description, lore, base_bonuses,
             unlockable_abilities, restrictions, starting_cash, starting_rep
      FROM heritage_backgrounds
      ORDER BY region, name
    `);

    // Group by region
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!grouped[row.region]) {
        grouped[row.region] = [];
      }
      grouped[row.region].push({
        key: row.key,
        name: row.name,
        flag: row.flag,
        description: row.description,
        lore: row.lore,
        bonuses: row.base_bonuses,
        abilities: row.unlockable_abilities,
        restrictions: row.restrictions,
        startingCash: row.starting_cash,
        startingRep: row.starting_rep
      });
    }

    res.json({ success: true, data: { heritages: grouped, regions: Object.keys(grouped) } });
  } catch (error) {
    console.error('Error fetching heritages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch heritages' });
  }
});

// Get appearance options
router.get('/appearance-options', (_req, res: Response) => {
  res.json({ success: true, data: APPEARANCE_OPTIONS });
});

// Check if character is created
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT character_created, primary_heritage, secondary_heritage
      FROM players WHERE id = $1
    `, [playerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const player = result.rows[0];

    res.json({
      success: true,
      data: {
        characterCreated: player.character_created || false,
        primaryHeritage: player.primary_heritage,
        secondaryHeritage: player.secondary_heritage
      }
    });
  } catch (error) {
    console.error('Error checking character status:', error);
    res.status(500).json({ success: false, error: 'Failed to check character status' });
  }
});

// Create character (full wizard)
router.post('/create', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const playerId = req.player!.id;
    const {
      primaryHeritage,
      secondaryHeritage,
      appearance,
      startingDistrict
    } = req.body;

    // Validate heritage
    if (!primaryHeritage || !HERITAGE_DATA[primaryHeritage]) {
      return res.status(400).json({ success: false, error: 'Invalid primary heritage' });
    }

    if (secondaryHeritage && !HERITAGE_DATA[secondaryHeritage]) {
      return res.status(400).json({ success: false, error: 'Invalid secondary heritage' });
    }

    // Check if character already created
    const existingCheck = await client.query(
      'SELECT character_created FROM players WHERE id = $1',
      [playerId]
    );

    if (existingCheck.rows[0]?.character_created) {
      return res.status(400).json({ success: false, error: 'Character already created' });
    }

    await client.query('BEGIN');

    // Calculate bonuses
    const primaryData = HERITAGE_DATA[primaryHeritage];
    let bonuses: Record<string, number> = {};
    let startingCash = primaryData.startingCash;
    let startingRep = primaryData.startingRep;

    // Apply primary heritage bonuses
    for (const bonus of primaryData.bonuses) {
      const multiplier = secondaryHeritage ? 0.75 : 1.0;
      bonuses[bonus.stat] = bonus.value * multiplier;
    }

    // Apply secondary heritage bonuses if mixed
    if (secondaryHeritage) {
      const secondaryData = HERITAGE_DATA[secondaryHeritage];
      for (const bonus of secondaryData.bonuses) {
        if (bonuses[bonus.stat]) {
          bonuses[bonus.stat] += bonus.value * 0.75;
        } else {
          bonuses[bonus.stat] = bonus.value * 0.75;
        }
      }
      // Average starting values for mixed heritage
      startingCash = Math.floor((primaryData.startingCash + secondaryData.startingCash) / 2);
      startingRep = Math.floor((primaryData.startingRep + secondaryData.startingRep) / 2);
    }

    // Update player with heritage and starting stats
    await client.query(`
      UPDATE players SET
        character_created = TRUE,
        primary_heritage = $2,
        secondary_heritage = $3,
        cash = cash + $4,
        street_cred = street_cred + $5,
        current_district = $6
      WHERE id = $1
    `, [playerId, primaryHeritage, secondaryHeritage, startingCash, startingRep, startingDistrict || null]);

    // Create player_heritage record
    await client.query(`
      INSERT INTO player_heritage (player_id, primary_heritage, secondary_heritage, mixed_heritage, heritage_bonuses)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (player_id) DO UPDATE SET
        primary_heritage = EXCLUDED.primary_heritage,
        secondary_heritage = EXCLUDED.secondary_heritage,
        mixed_heritage = EXCLUDED.mixed_heritage,
        heritage_bonuses = EXCLUDED.heritage_bonuses
    `, [playerId, primaryHeritage, secondaryHeritage, !!secondaryHeritage, JSON.stringify(bonuses)]);

    // Create appearance record
    if (appearance) {
      await client.query(`
        INSERT INTO character_appearance (
          player_id, skin_tone, hair_style, hair_color, face_shape, eye_color,
          facial_hair, scars, tattoos, height, build, age_appearance, clothing_style, accessories
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (player_id) DO UPDATE SET
          skin_tone = EXCLUDED.skin_tone,
          hair_style = EXCLUDED.hair_style,
          hair_color = EXCLUDED.hair_color,
          face_shape = EXCLUDED.face_shape,
          eye_color = EXCLUDED.eye_color,
          facial_hair = EXCLUDED.facial_hair,
          scars = EXCLUDED.scars,
          tattoos = EXCLUDED.tattoos,
          height = EXCLUDED.height,
          build = EXCLUDED.build,
          age_appearance = EXCLUDED.age_appearance,
          clothing_style = EXCLUDED.clothing_style,
          accessories = EXCLUDED.accessories,
          updated_at = NOW()
      `, [
        playerId,
        appearance.skinTone,
        appearance.hairStyle,
        appearance.hairColor,
        appearance.faceShape,
        appearance.eyeColor,
        appearance.facialHair,
        JSON.stringify(appearance.scars || []),
        JSON.stringify(appearance.tattoos || []),
        appearance.height || 170,
        appearance.build,
        appearance.ageAppearance || 25,
        appearance.clothingStyle,
        JSON.stringify(appearance.accessories || [])
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: 'Character created successfully',
        heritage: {
          primary: primaryHeritage,
          secondary: secondaryHeritage,
          bonuses
        },
        startingCash,
        startingRep
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating character:', error);
    res.status(500).json({ success: false, error: 'Failed to create character' });
  } finally {
    client.release();
  }
});

// Get character appearance
router.get('/appearance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT * FROM character_appearance WHERE player_id = $1
    `, [playerId]);

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        skinTone: row.skin_tone,
        hairStyle: row.hair_style,
        hairColor: row.hair_color,
        faceShape: row.face_shape,
        eyeColor: row.eye_color,
        facialHair: row.facial_hair,
        scars: row.scars,
        tattoos: row.tattoos,
        height: row.height,
        build: row.build,
        ageAppearance: row.age_appearance,
        clothingStyle: row.clothing_style,
        accessories: row.accessories
      }
    });
  } catch (error) {
    console.error('Error fetching appearance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch appearance' });
  }
});

// Update character appearance (costs tokens)
router.put('/appearance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { appearance } = req.body;
    const APPEARANCE_CHANGE_COST = 1000; // Cost in cash

    // Check if player has enough cash
    const playerResult = await pool.query('SELECT cash FROM players WHERE id = $1', [playerId]);
    if (playerResult.rows[0].cash < APPEARANCE_CHANGE_COST) {
      return res.status(400).json({ success: false, error: `Not enough cash. Appearance change costs $${APPEARANCE_CHANGE_COST}` });
    }

    // Deduct cost and update appearance
    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [APPEARANCE_CHANGE_COST, playerId]);

    await pool.query(`
      UPDATE character_appearance SET
        skin_tone = COALESCE($2, skin_tone),
        hair_style = COALESCE($3, hair_style),
        hair_color = COALESCE($4, hair_color),
        face_shape = COALESCE($5, face_shape),
        eye_color = COALESCE($6, eye_color),
        facial_hair = COALESCE($7, facial_hair),
        scars = COALESCE($8, scars),
        tattoos = COALESCE($9, tattoos),
        height = COALESCE($10, height),
        build = COALESCE($11, build),
        age_appearance = COALESCE($12, age_appearance),
        clothing_style = COALESCE($13, clothing_style),
        accessories = COALESCE($14, accessories),
        updated_at = NOW()
      WHERE player_id = $1
    `, [
      playerId,
      appearance.skinTone,
      appearance.hairStyle,
      appearance.hairColor,
      appearance.faceShape,
      appearance.eyeColor,
      appearance.facialHair,
      appearance.scars ? JSON.stringify(appearance.scars) : null,
      appearance.tattoos ? JSON.stringify(appearance.tattoos) : null,
      appearance.height,
      appearance.build,
      appearance.ageAppearance,
      appearance.clothingStyle,
      appearance.accessories ? JSON.stringify(appearance.accessories) : null
    ]);

    res.json({ success: true, data: { message: 'Appearance updated', cost: APPEARANCE_CHANGE_COST } });
  } catch (error) {
    console.error('Error updating appearance:', error);
    res.status(500).json({ success: false, error: 'Failed to update appearance' });
  }
});

// Get player's heritage info
router.get('/my-heritage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT ph.*, p.primary_heritage, p.secondary_heritage
      FROM players p
      LEFT JOIN player_heritage ph ON p.id = ph.player_id
      WHERE p.id = $1
    `, [playerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const row = result.rows[0];
    const primaryData = HERITAGE_DATA[row.primary_heritage];
    const secondaryData = row.secondary_heritage ? HERITAGE_DATA[row.secondary_heritage] : null;

    res.json({
      success: true,
      data: {
        primary: primaryData ? {
          key: row.primary_heritage,
          ...primaryData
        } : null,
        secondary: secondaryData ? {
          key: row.secondary_heritage,
          ...secondaryData
        } : null,
        bonuses: row.heritage_bonuses || {},
        mixed: row.mixed_heritage || false
      }
    });
  } catch (error) {
    console.error('Error fetching heritage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch heritage' });
  }
});

// Get available abilities for player's heritage
router.get('/abilities/available', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player's heritage and rep
    const playerResult = await pool.query(`
      SELECT primary_heritage, secondary_heritage, street_cred FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const heritages = [player.primary_heritage];
    if (player.secondary_heritage) heritages.push(player.secondary_heritage);

    // Get all abilities for player's heritages
    const abilitiesResult = await pool.query(`
      SELECT ha.*,
        CASE WHEN pua.ability_key IS NOT NULL THEN TRUE ELSE FALSE END as unlocked,
        pua.last_used
      FROM heritage_abilities ha
      LEFT JOIN player_unlocked_abilities pua ON ha.ability_key = pua.ability_key AND pua.player_id = $1
      WHERE ha.heritage_key = ANY($2)
      ORDER BY ha.unlock_rep
    `, [playerId, heritages]);

    const abilities = abilitiesResult.rows.map((row: any) => ({
      key: row.ability_key,
      name: row.name,
      description: row.description,
      heritage: row.heritage_key,
      type: row.ability_type,
      unlockRep: row.unlock_rep,
      unlockCost: row.unlock_cost,
      cooldownMinutes: row.cooldown_minutes,
      effect: row.effect,
      unlocked: row.unlocked,
      canUnlock: player.street_cred >= row.unlock_rep && !row.unlocked,
      lastUsed: row.last_used,
      onCooldown: row.last_used && row.cooldown_minutes ?
        (new Date().getTime() - new Date(row.last_used).getTime()) < (row.cooldown_minutes * 60 * 1000) : false
    }));

    res.json({ success: true, data: { abilities, playerRep: player.street_cred } });
  } catch (error) {
    console.error('Error fetching abilities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch abilities' });
  }
});

// Unlock an ability
router.post('/abilities/unlock/:abilityKey', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const playerId = req.player!.id;
    const { abilityKey } = req.params;

    await client.query('BEGIN');

    // Get ability info
    const abilityResult = await client.query(
      'SELECT * FROM heritage_abilities WHERE ability_key = $1',
      [abilityKey]
    );

    if (abilityResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Ability not found' });
    }

    const ability = abilityResult.rows[0];

    // Check if player has the heritage
    const playerResult = await client.query(`
      SELECT primary_heritage, secondary_heritage, street_cred, cash FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];
    const heritages = [player.primary_heritage, player.secondary_heritage].filter(Boolean);

    if (!heritages.includes(ability.heritage_key)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'This ability is not available for your heritage' });
    }

    // Check rep requirement
    if (player.street_cred < ability.unlock_rep) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Need ${ability.unlock_rep} street cred to unlock this ability` });
    }

    // Check cash
    if (player.cash < ability.unlock_cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Need $${ability.unlock_cost} to unlock this ability` });
    }

    // Check if already unlocked
    const unlockedCheck = await client.query(
      'SELECT * FROM player_unlocked_abilities WHERE player_id = $1 AND ability_key = $2',
      [playerId, abilityKey]
    );

    if (unlockedCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Ability already unlocked' });
    }

    // Deduct cost and unlock
    await client.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [ability.unlock_cost, playerId]);
    await client.query(
      'INSERT INTO player_unlocked_abilities (player_id, ability_key) VALUES ($1, $2)',
      [playerId, abilityKey]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Unlocked ${ability.name}!`,
        ability: {
          key: ability.ability_key,
          name: ability.name,
          description: ability.description,
          type: ability.ability_type
        }
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error unlocking ability:', error);
    res.status(500).json({ success: false, error: 'Failed to unlock ability' });
  } finally {
    client.release();
  }
});

// Use an active ability
router.post('/abilities/use/:abilityKey', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const playerId = req.player!.id;
    const { abilityKey } = req.params;

    await client.query('BEGIN');

    // Check if unlocked
    const unlockedResult = await client.query(`
      SELECT pua.*, ha.*
      FROM player_unlocked_abilities pua
      JOIN heritage_abilities ha ON pua.ability_key = ha.ability_key
      WHERE pua.player_id = $1 AND pua.ability_key = $2
    `, [playerId, abilityKey]);

    if (unlockedResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Ability not unlocked' });
    }

    const ability = unlockedResult.rows[0];

    // Check if passive (can't be "used")
    if (ability.ability_type === 'passive') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Passive abilities are always active' });
    }

    // Check cooldown
    if (ability.last_used && ability.cooldown_minutes) {
      const timeSinceUse = new Date().getTime() - new Date(ability.last_used).getTime();
      const cooldownMs = ability.cooldown_minutes * 60 * 1000;
      if (timeSinceUse < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceUse) / 60000);
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Ability on cooldown. ${remainingMinutes} minutes remaining`
        });
      }
    }

    // Update last used
    await client.query(
      'UPDATE player_unlocked_abilities SET last_used = NOW() WHERE player_id = $1 AND ability_key = $2',
      [playerId, abilityKey]
    );

    // Apply ability effect (this would integrate with other game systems)
    // For now, we'll create a buff record
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Most active abilities last 24 hours

    await client.query(`
      INSERT INTO player_buffs (player_id, buff_type, buff_value, expires_at, source)
      VALUES ($1, $2, $3, $4, $5)
    `, [playerId, ability.ability_key, 1, expiresAt, `heritage_ability:${ability.name}`]);

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Activated ${ability.name}!`,
        effect: ability.effect,
        expiresAt
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error using ability:', error);
    res.status(500).json({ success: false, error: 'Failed to use ability' });
  } finally {
    client.release();
  }
});

// Get full character info
router.get('/character', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT
        p.id, p.username, p.character_created, p.primary_heritage, p.secondary_heritage,
        p.level, p.street_cred, p.cash,
        ca.*,
        ph.heritage_bonuses, ph.mixed_heritage
      FROM players p
      LEFT JOIN character_appearance ca ON p.id = ca.player_id
      LEFT JOIN player_heritage ph ON p.id = ph.player_id
      WHERE p.id = $1
    `, [playerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const row = result.rows[0];
    const primaryData = row.primary_heritage ? HERITAGE_DATA[row.primary_heritage] : null;
    const secondaryData = row.secondary_heritage ? HERITAGE_DATA[row.secondary_heritage] : null;

    // Get unlocked abilities
    const abilitiesResult = await pool.query(`
      SELECT ha.* FROM player_unlocked_abilities pua
      JOIN heritage_abilities ha ON pua.ability_key = ha.ability_key
      WHERE pua.player_id = $1
    `, [playerId]);

    res.json({
      success: true,
      data: {
        characterCreated: row.character_created,
        username: row.username,
        level: row.level,
        streetCred: row.street_cred,
        heritage: {
          primary: primaryData ? { key: row.primary_heritage, ...primaryData } : null,
          secondary: secondaryData ? { key: row.secondary_heritage, ...secondaryData } : null,
          bonuses: row.heritage_bonuses || {},
          mixed: row.mixed_heritage
        },
        appearance: row.skin_tone ? {
          skinTone: row.skin_tone,
          hairStyle: row.hair_style,
          hairColor: row.hair_color,
          faceShape: row.face_shape,
          eyeColor: row.eye_color,
          facialHair: row.facial_hair,
          scars: row.scars,
          tattoos: row.tattoos,
          height: row.height,
          build: row.build,
          ageAppearance: row.age_appearance,
          clothingStyle: row.clothing_style,
          accessories: row.accessories
        } : null,
        abilities: abilitiesResult.rows.map((a: any) => ({
          key: a.ability_key,
          name: a.name,
          description: a.description,
          type: a.ability_type
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch character' });
  }
});

export default router;
