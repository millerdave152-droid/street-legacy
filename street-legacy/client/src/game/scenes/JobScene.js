import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { achievementPopup } from '../ui/AchievementPopup'
import { notificationManager } from '../managers/NotificationManager'
import { audioManager } from '../managers/AudioManager'
import { networkMessageManager, MESSAGE_TYPES, HANDLERS } from '../managers/NetworkMessageManager'
import { PlayerStatsBar } from '../ui/PlayerStatsBar'
import { getJobMapping, getSceneKeyForGame, createDefaultJobMapping } from '../config/JobGameMapping'

// Network Theme
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'

// Time-of-day system
import { getCurrentTimeModifier, applyTimeModifierToJob } from '../data/GameData.js'

// Local storage helpers
const getPlayerData = () => {
  try {
    const data = localStorage.getItem('street_legacy_player')
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

const savePlayerData = (player) => {
  try {
    localStorage.setItem('street_legacy_player', JSON.stringify(player))
  } catch (e) {
    console.error('[JobScene] Failed to save player data:', e)
  }
}

// Full job database for local play - organized by tier
const LOCAL_JOBS = [
  // === TIER 1: ENTRY-LEVEL WORK (Level 1-5) ===
  { id: 'dishwasher', name: 'Dishwasher', description: 'Wash dishes at a local restaurant', min_level: 1, energy_cost: 10, base_pay: 35, xp_reward: 5, duration_seconds: 30, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'street_sweeper', name: 'Street Sweeper', description: 'Clean sidewalks and streets', min_level: 1, energy_cost: 15, base_pay: 30, xp_reward: 6, duration_seconds: 35, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'flyer_dist', name: 'Flyer Distributor', description: 'Hand out promotional flyers', min_level: 1, energy_cost: 8, base_pay: 25, xp_reward: 4, duration_seconds: 25, tier: 'entry', skill: 'Charisma' },
  { id: 'sign_spinner', name: 'Sign Spinner', description: 'Hold advertising signs on corners', min_level: 1, energy_cost: 12, base_pay: 30, xp_reward: 5, duration_seconds: 30, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'grocery_bagger', name: 'Grocery Bagger', description: 'Bag groceries at the store', min_level: 1, energy_cost: 8, base_pay: 28, xp_reward: 4, duration_seconds: 25, tier: 'entry', skill: 'Technical', has_minigame: true },
  { id: 'car_wash', name: 'Car Wash Attendant', description: 'Wash and dry vehicles', min_level: 1, energy_cost: 12, base_pay: 32, xp_reward: 5, duration_seconds: 30, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'recycling', name: 'Recycling Collector', description: 'Collect cans and bottles for money', min_level: 1, energy_cost: 15, base_pay: 20, xp_reward: 6, duration_seconds: 35, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'dog_walker', name: 'Dog Walker', description: 'Walk neighborhood dogs', min_level: 2, energy_cost: 10, base_pay: 40, xp_reward: 6, duration_seconds: 30, tier: 'entry', skill: 'Charisma', has_minigame: true },
  { id: 'lawn_mowing', name: 'Lawn Mowing', description: 'Mow residential lawns', min_level: 2, energy_cost: 18, base_pay: 45, xp_reward: 7, duration_seconds: 35, tier: 'entry', skill: 'Endurance', has_minigame: true },
  { id: 'newspaper', name: 'Newspaper Delivery', description: 'Deliver papers early morning', min_level: 2, energy_cost: 12, base_pay: 35, xp_reward: 5, duration_seconds: 30, tier: 'entry', skill: 'Endurance' },

  // === TIER 2: SERVICE INDUSTRY (Level 5-15) ===
  { id: 'fast_food', name: 'Fast Food Worker', description: 'Take orders, cook, and serve', min_level: 5, energy_cost: 12, base_pay: 40, xp_reward: 8, duration_seconds: 35, tier: 'service', skill: 'Charisma', has_minigame: true },
  { id: 'barista', name: 'Barista', description: 'Make specialty coffee drinks', min_level: 5, energy_cost: 10, base_pay: 45, xp_reward: 8, duration_seconds: 30, tier: 'service', skill: 'Technical', has_minigame: true },
  { id: 'bartender', name: 'Bartender', description: 'Mix drinks and serve customers', min_level: 8, energy_cost: 15, base_pay: 60, xp_reward: 11, duration_seconds: 40, tier: 'service', skill: 'Charisma', has_minigame: true },
  { id: 'waiter', name: 'Waiter/Waitress', description: 'Serve tables and earn tips', min_level: 6, energy_cost: 15, base_pay: 50, xp_reward: 10, duration_seconds: 40, tier: 'service', skill: 'Charisma', has_minigame: true },
  { id: 'housekeeper', name: 'Hotel Housekeeper', description: 'Clean hotel rooms', min_level: 5, energy_cost: 18, base_pay: 50, xp_reward: 9, duration_seconds: 40, tier: 'service', skill: 'Endurance', has_minigame: true },
  { id: 'cashier', name: 'Retail Cashier', description: 'Ring up customers at checkout', min_level: 5, energy_cost: 10, base_pay: 42, xp_reward: 7, duration_seconds: 30, tier: 'service', skill: 'Charisma', has_minigame: true },
  { id: 'gas_attendant', name: 'Gas Station Attendant', description: 'Pump gas and run the register', min_level: 5, energy_cost: 12, base_pay: 38, xp_reward: 7, duration_seconds: 35, tier: 'service', skill: 'Technical' },
  { id: 'usher', name: 'Movie Theater Usher', description: 'Clean theaters and check tickets', min_level: 5, energy_cost: 10, base_pay: 35, xp_reward: 6, duration_seconds: 30, tier: 'service', skill: 'Charisma' },
  { id: 'pizza_delivery', name: 'Pizza Delivery', description: 'Deliver pizzas around town', min_level: 6, energy_cost: 12, base_pay: 55, xp_reward: 9, duration_seconds: 35, tier: 'service', skill: 'Street Cred', has_minigame: true },
  { id: 'food_delivery', name: 'Food Delivery (App)', description: 'Deliver via food delivery apps', min_level: 5, energy_cost: 10, base_pay: 48, xp_reward: 8, duration_seconds: 30, tier: 'service', skill: 'Street Cred', has_minigame: true },

  // === TIER 3: SKILLED LABOR (Level 10-25) ===
  { id: 'warehouse', name: 'Warehouse Worker', description: 'Load and unload shipments', min_level: 10, energy_cost: 20, base_pay: 65, xp_reward: 12, duration_seconds: 45, tier: 'labor', skill: 'Endurance', has_minigame: true },
  { id: 'forklift', name: 'Forklift Operator', description: 'Move pallets around warehouse', min_level: 12, energy_cost: 15, base_pay: 70, xp_reward: 13, duration_seconds: 40, tier: 'labor', skill: 'Technical', has_minigame: true },
  { id: 'construction', name: 'Construction Laborer', description: 'General construction work', min_level: 12, energy_cost: 25, base_pay: 80, xp_reward: 15, duration_seconds: 50, tier: 'labor', skill: 'Endurance', has_minigame: true },
  { id: 'painter', name: 'Painter', description: 'Paint buildings and rooms', min_level: 10, energy_cost: 20, base_pay: 75, xp_reward: 12, duration_seconds: 45, tier: 'labor', skill: 'Technical', has_minigame: true },
  { id: 'mover', name: 'Mover', description: 'Move furniture and boxes', min_level: 10, energy_cost: 25, base_pay: 85, xp_reward: 14, duration_seconds: 50, tier: 'labor', skill: 'Endurance', has_minigame: true },
  { id: 'landscaper', name: 'Landscaper', description: 'Garden and yard maintenance', min_level: 10, energy_cost: 22, base_pay: 70, xp_reward: 12, duration_seconds: 45, tier: 'labor', skill: 'Endurance', has_minigame: true },
  { id: 'carpet_installer', name: 'Carpet Installer', description: 'Install flooring and carpet', min_level: 15, energy_cost: 20, base_pay: 90, xp_reward: 16, duration_seconds: 50, tier: 'labor', skill: 'Technical', has_minigame: true },
  { id: 'assembly_line', name: 'Assembly Line Worker', description: 'Factory assembly work', min_level: 10, energy_cost: 18, base_pay: 65, xp_reward: 11, duration_seconds: 40, tier: 'labor', skill: 'Technical', has_minigame: true },
  { id: 'auto_detailer', name: 'Auto Detailer', description: 'Detail and clean vehicles', min_level: 10, energy_cost: 18, base_pay: 80, xp_reward: 13, duration_seconds: 45, tier: 'labor', skill: 'Technical', has_minigame: true },
  { id: 'demolition', name: 'Demolition Worker', description: 'Tear down structures', min_level: 15, energy_cost: 28, base_pay: 85, xp_reward: 15, duration_seconds: 55, tier: 'labor', skill: 'Endurance', has_minigame: true },

  // === TIER 4: DRIVING & DELIVERY (Level 8-20) ===
  { id: 'rideshare', name: 'Rideshare Driver', description: 'Drive for Uber/Lyft', min_level: 8, energy_cost: 15, base_pay: 75, xp_reward: 12, duration_seconds: 40, tier: 'driving', skill: 'Street Cred', has_minigame: true },
  { id: 'taxi', name: 'Taxi Driver', description: 'Traditional cab driving', min_level: 8, energy_cost: 15, base_pay: 85, xp_reward: 13, duration_seconds: 40, tier: 'driving', skill: 'Street Cred', has_minigame: true },
  { id: 'truck_local', name: 'Truck Driver (Local)', description: 'Local delivery truck runs', min_level: 12, energy_cost: 20, base_pay: 100, xp_reward: 16, duration_seconds: 50, tier: 'driving', skill: 'Technical', has_minigame: true },
  { id: 'courier', name: 'Courier', description: 'Rush deliveries across the city', min_level: 10, energy_cost: 12, base_pay: 80, xp_reward: 12, duration_seconds: 35, tier: 'driving', skill: 'Street Cred', has_minigame: true },
  { id: 'tow_truck', name: 'Tow Truck Driver', description: 'Tow disabled vehicles', min_level: 12, energy_cost: 18, base_pay: 90, xp_reward: 14, duration_seconds: 45, tier: 'driving', skill: 'Technical', has_minigame: true },
  { id: 'bus_driver', name: 'Bus Driver', description: 'Public transit driver', min_level: 15, energy_cost: 20, base_pay: 110, xp_reward: 18, duration_seconds: 55, tier: 'driving', skill: 'Charisma' },
  { id: 'medical_transport', name: 'Medical Transport', description: 'Transport patients safely', min_level: 12, energy_cost: 15, base_pay: 85, xp_reward: 13, duration_seconds: 40, tier: 'driving', skill: 'Charisma' },
  { id: 'repo', name: 'Repo Driver', description: 'Repossess vehicles', min_level: 18, energy_cost: 20, base_pay: 150, xp_reward: 22, duration_seconds: 50, tier: 'driving', skill: 'Street Cred', has_minigame: true },

  // === TIER 5: SECURITY & PROTECTION (Level 15-30) ===
  { id: 'security', name: 'Security Guard', description: 'Watch over businesses', min_level: 15, energy_cost: 12, base_pay: 55, xp_reward: 10, duration_seconds: 40, tier: 'security', skill: 'Street Cred', has_minigame: true },
  { id: 'bouncer', name: 'Nightclub Bouncer', description: 'Door security at clubs', min_level: 15, energy_cost: 18, base_pay: 80, xp_reward: 14, duration_seconds: 45, tier: 'security', skill: 'Street Cred', has_minigame: true },
  { id: 'mall_security', name: 'Mall Security', description: 'Patrol shopping centers', min_level: 12, energy_cost: 15, base_pay: 60, xp_reward: 11, duration_seconds: 40, tier: 'security', skill: 'Street Cred', has_minigame: true },
  { id: 'event_security', name: 'Event Security', description: 'Security at concerts/events', min_level: 18, energy_cost: 20, base_pay: 75, xp_reward: 13, duration_seconds: 50, tier: 'security', skill: 'Street Cred', has_minigame: true },
  { id: 'armored_car', name: 'Armored Car Guard', description: 'Protect cash transports', min_level: 22, energy_cost: 22, base_pay: 120, xp_reward: 20, duration_seconds: 55, tier: 'security', skill: 'Street Cred' },
  { id: 'bodyguard', name: 'Bodyguard', description: 'Personal protection services', min_level: 25, energy_cost: 25, base_pay: 180, xp_reward: 28, duration_seconds: 60, tier: 'security', skill: 'Street Cred', has_minigame: true },
  { id: 'loss_prevention', name: 'Loss Prevention', description: 'Catch shoplifters', min_level: 15, energy_cost: 15, base_pay: 70, xp_reward: 12, duration_seconds: 45, tier: 'security', skill: 'Street Cred', has_minigame: true },

  // === TIER 6: TECHNICAL/SKILLED (Level 20-35) ===
  { id: 'electrician_helper', name: 'Electrician Helper', description: 'Assist licensed electricians', min_level: 20, energy_cost: 18, base_pay: 85, xp_reward: 15, duration_seconds: 50, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'plumber_helper', name: 'Plumber Helper', description: 'Assist licensed plumbers', min_level: 20, energy_cost: 20, base_pay: 80, xp_reward: 14, duration_seconds: 50, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'hvac', name: 'HVAC Technician', description: 'Install and repair AC/heating', min_level: 25, energy_cost: 22, base_pay: 100, xp_reward: 18, duration_seconds: 55, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'mechanic', name: 'Auto Mechanic', description: 'Repair and maintain vehicles', min_level: 20, energy_cost: 20, base_pay: 90, xp_reward: 16, duration_seconds: 50, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'welder', name: 'Welder', description: 'Metal fabrication and welding', min_level: 25, energy_cost: 25, base_pay: 110, xp_reward: 20, duration_seconds: 55, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'locksmith', name: 'Locksmith', description: 'Install and open locks', min_level: 22, energy_cost: 15, base_pay: 95, xp_reward: 16, duration_seconds: 45, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'computer_repair', name: 'Computer Repair', description: 'Fix and upgrade computers', min_level: 20, energy_cost: 12, base_pay: 85, xp_reward: 14, duration_seconds: 40, tier: 'technical', skill: 'Technical', has_minigame: true },
  { id: 'phone_repair', name: 'Phone Repair', description: 'Fix mobile devices', min_level: 18, energy_cost: 10, base_pay: 75, xp_reward: 12, duration_seconds: 35, tier: 'technical', skill: 'Technical', has_minigame: true },

  // === TIER 7: GIG ECONOMY (Level 5-25) ===
  { id: 'taskrabbit', name: 'TaskRabbit Jobs', description: 'Odd jobs for people', min_level: 5, energy_cost: 15, base_pay: 55, xp_reward: 10, duration_seconds: 40, tier: 'gig', skill: 'Charisma', has_minigame: true },
  { id: 'furniture_assembly', name: 'Furniture Assembly', description: 'Build IKEA furniture', min_level: 8, energy_cost: 15, base_pay: 60, xp_reward: 10, duration_seconds: 40, tier: 'gig', skill: 'Technical', has_minigame: true },
  { id: 'handyman', name: 'Handyman', description: 'General home repairs', min_level: 15, energy_cost: 18, base_pay: 70, xp_reward: 12, duration_seconds: 45, tier: 'gig', skill: 'Technical', has_minigame: true },
  { id: 'pet_sitting', name: 'Pet Sitting', description: 'Watch people\'s pets', min_level: 5, energy_cost: 8, base_pay: 50, xp_reward: 8, duration_seconds: 35, tier: 'gig', skill: 'Charisma', has_minigame: true },
  { id: 'house_sitting', name: 'House Sitting', description: 'Watch homes while owners away', min_level: 8, energy_cost: 5, base_pay: 40, xp_reward: 6, duration_seconds: 30, tier: 'gig', skill: 'Charisma' },
  { id: 'mystery_shopper', name: 'Mystery Shopper', description: 'Evaluate stores anonymously', min_level: 10, energy_cost: 8, base_pay: 35, xp_reward: 7, duration_seconds: 30, tier: 'gig', skill: 'Charisma', has_minigame: true },
  { id: 'focus_group', name: 'Focus Group', description: 'Participate in market research', min_level: 8, energy_cost: 5, base_pay: 65, xp_reward: 8, duration_seconds: 35, tier: 'gig', skill: 'Charisma' },
  { id: 'plasma', name: 'Plasma Donation', description: 'Donate plasma for cash', min_level: 5, energy_cost: 10, base_pay: 50, xp_reward: 5, duration_seconds: 40, tier: 'gig', skill: 'Endurance' },

  // === SPECIAL: HIGH-LEVEL JOBS (Level 25+) ===
  { id: 'manager', name: 'Shift Manager', description: 'Manage staff at local stores', min_level: 25, energy_cost: 15, base_pay: 120, xp_reward: 20, duration_seconds: 50, tier: 'service', skill: 'Charisma' },
  { id: 'fixer', name: 'The Fixer', description: 'Solve problems for high-paying clients', min_level: 30, energy_cost: 30, base_pay: 250, xp_reward: 40, duration_seconds: 70, tier: 'technical', skill: 'Street Cred', has_minigame: true },
  { id: 'contractor', name: 'General Contractor', description: 'Manage construction projects', min_level: 30, energy_cost: 20, base_pay: 200, xp_reward: 35, duration_seconds: 60, tier: 'technical', skill: 'Technical' },
  { id: 'private_investigator', name: 'Private Investigator', description: 'Investigate cases for clients', min_level: 28, energy_cost: 18, base_pay: 180, xp_reward: 30, duration_seconds: 55, tier: 'security', skill: 'Street Cred', has_minigame: true },

  // === TIER 8: UNDERGROUND ECONOMY (Level 20-40) ===
  { id: 'getaway_driver', name: 'Getaway Driver', description: 'Help criminals escape the scene', min_level: 20, energy_cost: 25, base_pay: 300, xp_reward: 40, duration_seconds: 60, tier: 'underground', skill: 'Street Cred', has_minigame: true },
  { id: 'weapon_transport', name: 'Weapon Courier', description: 'Transport weapons for buyers', min_level: 22, energy_cost: 20, base_pay: 250, xp_reward: 35, duration_seconds: 50, tier: 'underground', skill: 'Street Cred', has_minigame: true },
  { id: 'debt_enforcer', name: 'Debt Enforcer', description: 'Collect debts by any means', min_level: 25, energy_cost: 25, base_pay: 200, xp_reward: 30, duration_seconds: 45, tier: 'underground', skill: 'Street Cred', has_minigame: true },
  { id: 'alibi_service', name: 'Alibi Provider', description: 'Provide cover stories for clients', min_level: 18, energy_cost: 10, base_pay: 150, xp_reward: 25, duration_seconds: 30, tier: 'underground', skill: 'Charisma' },
  { id: 'lookout_service', name: 'Professional Lookout', description: 'Watch for police during operations', min_level: 20, energy_cost: 15, base_pay: 180, xp_reward: 28, duration_seconds: 40, tier: 'underground', skill: 'Street Cred', has_minigame: true },
  { id: 'document_forger', name: 'Document Forger', description: 'Create fake IDs and papers', min_level: 28, energy_cost: 18, base_pay: 280, xp_reward: 38, duration_seconds: 55, tier: 'underground', skill: 'Technical', has_minigame: true },
  { id: 'money_courier', name: 'Money Courier', description: 'Transport cash for criminal ops', min_level: 25, energy_cost: 22, base_pay: 350, xp_reward: 42, duration_seconds: 55, tier: 'underground', skill: 'Street Cred', has_minigame: true },
  { id: 'disposal_specialist', name: 'Disposal Specialist', description: 'Clean up evidence and problems', min_level: 30, energy_cost: 28, base_pay: 400, xp_reward: 50, duration_seconds: 65, tier: 'underground', skill: 'Technical', has_minigame: true },
  { id: 'smuggler', name: 'Smuggler', description: 'Move contraband across borders', min_level: 32, energy_cost: 30, base_pay: 450, xp_reward: 55, duration_seconds: 70, tier: 'underground', skill: 'Street Cred', has_minigame: true },
  { id: 'fence_operator', name: 'Fence Operator', description: 'Buy and resell stolen goods', min_level: 28, energy_cost: 15, base_pay: 320, xp_reward: 45, duration_seconds: 50, tier: 'underground', skill: 'Charisma', has_minigame: true },

  // === TIER 9: SPECIALIST WORK (Level 30-50) ===
  { id: 'safe_technician', name: 'Safe Cracker', description: 'Open safes for legal repossessions', min_level: 30, energy_cost: 20, base_pay: 400, xp_reward: 50, duration_seconds: 55, tier: 'specialist', skill: 'Technical', has_minigame: true },
  { id: 'security_consultant', name: 'Security Consultant', description: 'Advise businesses on security flaws', min_level: 32, energy_cost: 15, base_pay: 350, xp_reward: 45, duration_seconds: 50, tier: 'specialist', skill: 'Technical', has_minigame: true },
  { id: 'process_server', name: 'Process Server', description: 'Serve legal documents to targets', min_level: 25, energy_cost: 12, base_pay: 180, xp_reward: 25, duration_seconds: 35, tier: 'specialist', skill: 'Street Cred', has_minigame: true },
  { id: 'skip_tracer', name: 'Skip Tracer', description: 'Find people who owe money', min_level: 28, energy_cost: 18, base_pay: 280, xp_reward: 38, duration_seconds: 50, tier: 'specialist', skill: 'Street Cred', has_minigame: true },
  { id: 'night_auditor', name: 'Night Auditor', description: 'Overnight hotel desk work', min_level: 22, energy_cost: 10, base_pay: 120, xp_reward: 20, duration_seconds: 40, tier: 'specialist', skill: 'Technical' },
  { id: 'bounty_hunter', name: 'Bounty Hunter', description: 'Track and capture bail jumpers', min_level: 35, energy_cost: 30, base_pay: 500, xp_reward: 65, duration_seconds: 75, tier: 'specialist', skill: 'Street Cred', has_minigame: true },
  { id: 'crisis_negotiator', name: 'Crisis Negotiator', description: 'Negotiate high-stakes situations', min_level: 38, energy_cost: 25, base_pay: 450, xp_reward: 60, duration_seconds: 65, tier: 'specialist', skill: 'Charisma', has_minigame: true },
  { id: 'surveillance_expert', name: 'Surveillance Expert', description: 'Install and monitor surveillance', min_level: 32, energy_cost: 20, base_pay: 380, xp_reward: 48, duration_seconds: 55, tier: 'specialist', skill: 'Technical', has_minigame: true },
  { id: 'extraction_specialist', name: 'Extraction Specialist', description: 'Extract people from dangerous situations', min_level: 40, energy_cost: 35, base_pay: 600, xp_reward: 80, duration_seconds: 80, tier: 'specialist', skill: 'Street Cred', has_minigame: true },
  { id: 'information_broker', name: 'Information Broker', description: 'Trade valuable information', min_level: 35, energy_cost: 15, base_pay: 420, xp_reward: 55, duration_seconds: 50, tier: 'specialist', skill: 'Charisma', has_minigame: true },
]

export class JobScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JobScene' })
    this.statsBar = null
    this.jobCards = []
  }

  /**
   * Send contract offers for newly available jobs
   * Only sends contracts that haven't been offered before
   */
  sendNewContractOffers(jobs) {
    const player = gameManager.player || getPlayerData() || {}
    const playerLevel = player.level || 1

    // Get list of jobs we've already sent contracts for
    let sentContracts = []
    try {
      const saved = localStorage.getItem('network_sent_contracts')
      sentContracts = saved ? JSON.parse(saved) : []
    } catch (e) {
      sentContracts = []
    }

    // Find newly available jobs (unlocked by level and not yet offered)
    const newJobs = jobs.filter(job => {
      const jobLevel = job.min_level || job.required_level || 1
      return jobLevel <= playerLevel && !sentContracts.includes(job.id)
    })

    // Send up to 2 new contract offers at a time
    const toSend = newJobs.slice(0, 2)

    toSend.forEach(job => {
      // Determine job category for handler assignment
      const jobName = job.name.toLowerCase()
      let category = 'manual'
      if (jobName.includes('bartender') || jobName.includes('bouncer') || jobName.includes('security')) category = 'service'
      else if (jobName.includes('mechanic') || jobName.includes('fixer')) category = 'skilled'
      else if (jobName.includes('driver') || jobName.includes('getaway')) category = 'criminal'

      // Add category to job for handler mapping
      const jobWithCategory = { ...job, category }

      // Send as Network contract message
      networkMessageManager.jobToMessage(jobWithCategory)

      // Track that we've sent this contract
      sentContracts.push(job.id)
    })

    // Save updated sent contracts list
    try {
      localStorage.setItem('network_sent_contracts', JSON.stringify(sentContracts))
    } catch (e) {
      console.error('[JobScene] Failed to save sent contracts:', e)
    }

    if (toSend.length > 0) {
      console.log(`[JobScene] Sent ${toSend.length} new contract offers`)
    }
  }

  async create() {
    console.log('[JobScene] create() started')

    // CRITICAL: Reset camera state to prevent colored screen from mini-games
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.tweens.timeScale = 1
      this.tweens.killTweensOf(this.cameras.main)
    } catch (e) {
      console.warn('[JobScene] Camera reset warning:', e)
    }

    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top of scene stack for input priority
    // This ensures JobScene receives input, not GameScene below
    this.scene.bringToTop()
    console.log('[JobScene] Brought self to top of scene stack')

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
        console.log('[JobScene] Disabled GameScene input')
      }
    } catch (e) {
      console.log('[JobScene] Could not access GameScene:', e.message)
    }

    // Full screen background - Network dark
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive()

    // Subtle pattern overlay
    this.createBackgroundPattern()

    // Play scene intro animation
    networkTransition.playSceneIntro(this, 'JobScene')

    // Header bar - Network panel
    this.add.rectangle(width / 2, 38, width, 76, COLORS.bg.panel, 0.95)
      .setDepth(DEPTH.CARDS)
    this.add.rectangle(width / 2, 74, width, 2, COLORS.network.primary, 0.6)
      .setDepth(DEPTH.CARDS)

    // Header icon - Network terminal style (contract bracket)
    const headerIcon = this.add.text(width / 2 - 150, 30, '[C]', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Animate icon
    this.tweens.add({
      targets: headerIcon,
      alpha: { from: 1, to: 0.6 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Header text - Network terminal style
    this.add.text(width / 2, 30, '[ INCOMING CONTRACTS ]', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Subtitle - Network style
    this.add.text(width / 2, 55, `${SYMBOLS.system} HANDLER: THE FIXER ${SYMBOLS.system} SECURE CHANNEL`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Close button
    this.createCloseButton()

    // Player stats bar (energy, cooldown) - no heat for jobs
    this.statsBar = new PlayerStatsBar(this, {
      y: 85,
      cooldownAction: 'job',
      showHeat: false,  // Jobs don't affect heat
      depth: 150
    }).create()

    // Long-term benefits panel
    this.createBenefitsPanel()

    // Loading - Network terminal style
    this.loadingText = this.add.text(width / 2, height / 2, `${SYMBOLS.system} LOADING CONTRACTS...`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Load available jobs
    try {
      let jobs
      try {
        jobs = await gameManager.getAvailableJobs()
      } catch (e) {
        console.log('[JobScene] API failed, using local jobs')
        jobs = LOCAL_JOBS
      }
      if (!jobs || jobs.length === 0) {
        jobs = LOCAL_JOBS
      }
      this.loadingText.destroy()

      // Send contract offers for newly available jobs (THE NETWORK integration)
      this.sendNewContractOffers(jobs)

      this.createJobList(jobs)
    } catch (error) {
      console.error('[JobScene] Failed to load:', error)
      this.loadingText.destroy()

      // Send contract offers even on error (THE NETWORK integration)
      this.sendNewContractOffers(LOCAL_JOBS)

      this.createJobList(LOCAL_JOBS)
    }
  }

  createBackgroundPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(DEPTH.CONTENT_BASE)

    // Subtle diagonal lines - Network dark green
    graphics.lineStyle(1, COLORS.network.dark, 0.3)
    for (let i = -height; i < width + height; i += 40) {
      graphics.moveTo(i, 0)
      graphics.lineTo(i + height, height)
    }
    graphics.strokePath()
  }

  createBenefitsPanel() {
    const { width } = this.cameras.main
    const player = gameManager.player || {}
    const statsBarHeight = this.statsBar ? this.statsBar.getHeight() : 0
    const panelY = 85 + statsBarHeight + 10
    const panelHeight = 45

    // Benefits panel background - Network dark panel
    this.add.rectangle(width / 2, panelY + panelHeight / 2, width - 30, panelHeight, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, COLORS.network.primary, 0.3)
      .setDepth(DEPTH.CARDS)

    // Label - Network terminal style
    this.add.text(30, panelY + 8, `${SYMBOLS.system} CONTRACT BENEFITS`, {
      ...getTextStyle('xs', COLORS.network.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANELS)

    // Benefits chips - terminal bracket style
    const benefits = [
      { icon: '[0]', label: 'No Heat', desc: 'Safe income' },
      { icon: '[+]', label: 'Skills', desc: 'Level faster' },
      { icon: '[$]', label: 'Reputation', desc: 'Unlock better jobs' },
    ]

    let chipX = 30
    benefits.forEach(benefit => {
      const chipWidth = 85
      this.add.rectangle(chipX + chipWidth / 2, panelY + 30, chipWidth, 20, COLORS.bg.card, 0.8)
        .setStrokeStyle(1, COLORS.network.dim, 0.2)
        .setDepth(DEPTH.PANELS)

      this.add.text(chipX + chipWidth / 2, panelY + 30, `${benefit.icon} ${benefit.label}`, {
        ...getTextStyle('xs', COLORS.network.primary, 'terminal'),
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

      chipX += chipWidth + 8
    })

    // Store the panel height for job list positioning
    this.benefitsPanelHeight = panelHeight + 15
  }

  createCloseButton() {
    const { width } = this.cameras.main

    // Create close button with high depth to ensure it's always clickable - Network style
    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.secondary)
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)  // Always on top
    .setInteractive({ useHandCursor: true })

    // Visual feedback
    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.network.primary))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.secondary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[JobScene] Close button clicked')
      this.closeScene()
    })
  }

  createJobList(jobs) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || {}
    const playerLevel = player.level || 1
    // Account for stats bar height and benefits panel
    const statsBarHeight = this.statsBar ? this.statsBar.getHeight() : 0
    const benefitsHeight = this.benefitsPanelHeight || 0
    const startY = 85 + statsBarHeight + benefitsHeight + 10
    const itemHeight = 100  // Taller cards for more info

    console.log('[JobScene] createJobList called')
    console.log('[JobScene] Jobs received:', jobs?.length || 0, jobs)
    console.log('[JobScene] Player level:', playerLevel)

    // Handle case where jobs is undefined or empty
    if (!jobs || jobs.length === 0) {
      console.log('[JobScene] No jobs array provided, using local database')
      jobs = LOCAL_JOBS
    }

    const availableJobs = jobs.filter(j => {
      const jobLevel = j.min_level || j.required_level || 1
      return jobLevel <= playerLevel
    })

    console.log('[JobScene] Available jobs after filter:', availableJobs.length)

    if (availableJobs.length === 0) {
      this.add.text(width / 2, height / 2, `${SYMBOLS.system} NO CONTRACTS AVAILABLE AT YOUR LEVEL`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.CARDS)
      return
    }

    this.jobCards = []

    availableJobs.forEach((job, index) => {
      if (startY + index * itemHeight > height - 100) return
      const y = startY + index * itemHeight
      console.log(`[JobScene] Rendering job ${index}: ${job.name} at Y=${y}`)
      this.createJobCard(job, y)
    })
  }

  createJobCard(job, y) {
    const { width } = this.cameras.main
    const player = gameManager.player || {}

    const playerEnergy = player.energy || player.stamina || 100
    const energyCost = job.energy_cost || job.stamina_cost || 10
    const canWork = playerEnergy >= energyCost

    // Job category colors and icons - Network terminal style with bracket icons
    const jobConfig = {
      entry: { bg: COLORS.bg.panel, border: COLORS.network.primary, icon: '[E]', skillColor: COLORS.network.primary },    // Green - entry level
      service: { bg: COLORS.bg.panel, border: 0x3b82f6, icon: '[S]', skillColor: 0x3b82f6 },  // Blue - service industry
      labor: { bg: COLORS.bg.panel, border: 0xf59e0b, icon: '[L]', skillColor: 0xf59e0b },    // Orange - skilled labor
      driving: { bg: COLORS.bg.panel, border: 0xa855f7, icon: '[D]', skillColor: 0xa855f7 },  // Purple - driving/delivery
      security: { bg: COLORS.bg.panel, border: 0xef4444, icon: '[X]', skillColor: 0xef4444 }, // Red - security
      technical: { bg: COLORS.bg.panel, border: 0x06b6d4, icon: '[T]', skillColor: 0x06b6d4 }, // Cyan - technical
      gig: { bg: COLORS.bg.panel, border: 0x8b5cf6, icon: '[G]', skillColor: 0x8b5cf6 },      // Violet - gig economy
      trade: { bg: COLORS.bg.panel, border: 0xf59e0b, icon: '[W]', skillColor: 0xf59e0b },    // Orange - skilled trade
      underground: { bg: COLORS.bg.panel, border: 0xdc2626, icon: '[U]', skillColor: 0xdc2626 }, // Dark red - underground economy
      specialist: { bg: COLORS.bg.panel, border: 0x0891b2, icon: '[P]', skillColor: 0x0891b2 }, // Teal - specialist work
      default: { bg: COLORS.bg.panel, border: COLORS.network.primary, icon: '[J]', skillColor: COLORS.network.primary }
    }

    // Use tier from job data, or determine from name as fallback
    let category = job.category || job.tier || 'default'
    if (category === 'default') {
      const jobName = job.name.toLowerCase()
      if (jobName.includes('bartender') || jobName.includes('waiter') || jobName.includes('barista') || jobName.includes('cashier') || jobName.includes('fast food') || jobName.includes('dishes')) category = 'service'
      else if (jobName.includes('mechanic') || jobName.includes('electrician') || jobName.includes('plumber') || jobName.includes('hvac') || jobName.includes('welder')) category = 'trade'
      else if (jobName.includes('driver') || jobName.includes('delivery') || jobName.includes('taxi') || jobName.includes('courier') || jobName.includes('truck')) category = 'driving'
      else if (jobName.includes('security') || jobName.includes('bouncer') || jobName.includes('bodyguard') || jobName.includes('guard')) category = 'security'
      else if (jobName.includes('warehouse') || jobName.includes('construction') || jobName.includes('mover') || jobName.includes('landscaper')) category = 'labor'
      else if (jobName.includes('taskrabbit') || jobName.includes('handyman') || jobName.includes('pet') || jobName.includes('gig')) category = 'gig'
      // New category fallbacks
      else if (jobName.includes('weapon') || jobName.includes('enforcer') || jobName.includes('alibi') || jobName.includes('lookout') || jobName.includes('smuggler') || jobName.includes('getaway') || jobName.includes('fixer')) category = 'underground'
      else if (jobName.includes('safe') || jobName.includes('consultant') || jobName.includes('process') || jobName.includes('skip') || jobName.includes('auditor') || jobName.includes('investigator') || jobName.includes('bail bond')) category = 'specialist'
      else category = 'entry'
    }

    const config = jobConfig[category] || jobConfig.default
    const cardHeight = 88

    // Card background - Network style
    const cardBg = canWork ? config.bg : COLORS.bg.void
    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight, cardBg, canWork ? 0.95 : 0.6)
      .setDepth(DEPTH.CARDS)

    // Entrance animation
    card.setAlpha(0).setScale(0.95)
    this.tweens.add({
      targets: card,
      alpha: canWork ? 0.95 : 0.6,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut'
    })

    // Left accent bar - Network glow bar
    const accentBar = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, canWork ? config.border : COLORS.text.muted)
      .setDepth(DEPTH.PANELS)

    if (canWork) {
      card.setStrokeStyle(1, config.border, 0.4)
        .setInteractive({ useHandCursor: true })

      card.on('pointerover', () => {
        card.setFillStyle(Phaser.Display.Color.ValueToColor(config.bg).lighten(15).color, 1)
        card.setStrokeStyle(2, config.border, 0.7)
        accentBar.setFillStyle(Phaser.Display.Color.ValueToColor(config.border).lighten(20).color)
        this.tweens.add({
          targets: card,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 80
        })
      })

      card.on('pointerout', () => {
        card.setFillStyle(config.bg, 0.95)
        card.setStrokeStyle(1, config.border, 0.4)
        accentBar.setFillStyle(config.border)
        this.tweens.add({
          targets: card,
          scaleX: 1,
          scaleY: 1,
          duration: 80
        })
      })

      card.on('pointerdown', () => {
        this.tweens.add({
          targets: card,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          onComplete: () => this.workJob(job)
        })
      })
    } else {
      card.setStrokeStyle(1, COLORS.bg.elevated, 0.3)
    }

    // Job icon - Network terminal style bracket
    const iconBg = this.add.circle(48, y + cardHeight / 2 - 8, 18, config.border, 0.15)
      .setDepth(DEPTH.PANELS)
    this.add.text(48, y + cardHeight / 2 - 8, config.icon, {
      ...getTerminalStyle('lg'),
      color: toHexString(config.border)
    })
      .setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT).setAlpha(canWork ? 1 : 0.4)

    // Job name - Network terminal style
    this.add.text(75, y + 12, job.name.toUpperCase(), {
      ...getTextStyle('md', canWork ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANELS)

    // Job description - Network style
    if (job.description) {
      this.add.text(75, y + 32, job.description.substring(0, 35) + (job.description.length > 35 ? '...' : ''), {
        ...getTextStyle('xs', canWork ? COLORS.text.secondary : COLORS.text.muted, 'body')
      }).setDepth(DEPTH.PANELS)
    }

    // Long-term effect indicator - use job's skill property with terminal bracket
    const skillName = job.skill || 'Experience'
    this.add.text(75, y + 48, `[+] BUILDS ${skillName.toUpperCase()}`, {
      ...getTextStyle('xs', canWork ? config.skillColor : COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANELS)

    // Stats row at bottom - Network terminal style
    const statsY = y + 70
    let statsX = 35

    // Energy pill - Network style
    const energyPillWidth = 50
    this.add.rectangle(statsX + energyPillWidth / 2, statsY, energyPillWidth, 18, 0x3b82f6, 0.15)
      .setStrokeStyle(1, 0x3b82f6, 0.3).setDepth(DEPTH.PANELS)
    this.add.text(statsX + energyPillWidth / 2, statsY, `E:${energyCost}`, {
      ...getTextStyle('xs', canWork ? 0x60a5fa : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    statsX += energyPillWidth + 6

    // Duration pill - Network style
    const duration = job.duration_seconds || job.cooldown_seconds || 60
    const durationPillWidth = 48
    this.add.rectangle(statsX + durationPillWidth / 2, statsY, durationPillWidth, 18, 0x8b5cf6, 0.15)
      .setStrokeStyle(1, 0x8b5cf6, 0.3).setDepth(DEPTH.PANELS)
    this.add.text(statsX + durationPillWidth / 2, statsY, `${duration}s`, {
      ...getTextStyle('xs', canWork ? 0xa78bfa : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // XP pill - Network style
    statsX += durationPillWidth + 6
    const xp = job.xp_reward || 10
    const xpPillWidth = 45
    this.add.rectangle(statsX + xpPillWidth / 2, statsY, xpPillWidth, 18, 0xf59e0b, 0.15)
      .setStrokeStyle(1, 0xf59e0b, 0.3).setDepth(DEPTH.PANELS)
    this.add.text(statsX + xpPillWidth / 2, statsY, `+${xp}XP`, {
      ...getTextStyle('xs', canWork ? 0xfbbf24 : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Pay display - right side - Network terminal style
    const pay = job.base_pay || job.payout || job.min_payout || 0
    const levelBonus = Math.floor((player.level || 1) * 5)
    const bonusPay = Math.floor(pay * (1 + levelBonus / 100))

    // Pay box - Network dark panel
    const payBoxWidth = 80
    this.add.rectangle(width - 15 - payBoxWidth / 2, y + cardHeight / 2, payBoxWidth, cardHeight - 16, COLORS.bg.void, 0.95)
      .setStrokeStyle(1, COLORS.network.primary, canWork ? 0.5 : 0.2).setDepth(DEPTH.PANELS)

    this.add.text(width - 15 - payBoxWidth / 2, y + 18, SYMBOLS.cash, {
      ...getTerminalStyle('lg'),
      color: toHexString(canWork ? COLORS.text.gold : COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.add.text(width - 15 - payBoxWidth / 2, y + 38, formatMoney(bonusPay), {
      ...getTextStyle('md', canWork ? COLORS.text.gold : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Show bonus if applicable - Network style
    if (levelBonus > 0 && canWork) {
      this.add.text(width - 15 - payBoxWidth / 2, y + 56, `+${levelBonus}%`, {
        ...getTextStyle('xs', COLORS.network.primary, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

      this.add.text(width - 15 - payBoxWidth / 2, y + 68, 'LV BONUS', {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    }

    this.jobCards.push(card)
  }

  async workJob(job) {
    // Check cooldown first
    if (gameManager.isOnCooldown('job')) {
      if (this.statsBar) {
        this.statsBar.showCooldownWarning()
      }
      audioManager.playMiss()
      return
    }

    const player = gameManager.player
    const playerEnergy = player.energy || player.stamina || 0
    const energyCost = job.energy_cost || job.stamina_cost || 0

    // Check energy
    if (playerEnergy < energyCost) {
      if (this.statsBar) {
        this.statsBar.showWarning(`Need ${energyCost} energy (have ${Math.floor(playerEnergy)})`)
      } else {
        gameManager.addNotification('warning', 'Not enough energy!')
      }
      audioManager.playMiss()
      return
    }

    // Check if this job has a mini-game
    const mapping = getJobMapping(job.id)

    if (mapping && job.has_minigame) {
      // Launch mini-game for this job
      this.launchJobMiniGame(job, mapping)
    } else {
      // No mini-game - show standard working animation
      this.showWorkingAnimation(job)
    }
  }

  /**
   * Launch a mini-game for a job
   */
  launchJobMiniGame(job, mapping) {
    console.log(`[JobScene] Launching mini-game for job: ${job.id}`)

    // Calculate progressive difficulty (similar to crimes)
    const playerLevel = gameManager.player?.level || 1
    const baseDifficulty = mapping.difficulty || 1
    const difficulty = Math.min(5, baseDifficulty + Math.floor(playerLevel / 10))

    // Build game data
    const gameData = {
      crimeId: job.id, // Use crimeId for compatibility with existing mini-game system
      crimeName: job.name,
      gameType: mapping.gameType,
      difficulty,
      timeLimit: mapping.timeLimit,
      targetScore: mapping.targetScore,
      perfectScore: mapping.perfectScore,
      theme: mapping.theme,
      returnScene: 'JobScene',
      isJob: true, // Flag to identify this as a job
      jobData: job,
      onComplete: (result) => this.handleMiniGameComplete(result, job),
      // Progressive difficulty data
      difficultyTier: { name: 'Worker', color: '#22c55e' },
      rewardMultiplier: 1 + (playerLevel * 0.05),
      baseCashReward: job.base_pay || 50,
      baseXpReward: job.xp_reward || 10
    }

    // Get scene key
    const sceneKey = getSceneKeyForGame(mapping.gameType)

    // Check if scene exists
    if (!this.scene.get(sceneKey)) {
      console.error(`[JobScene] Mini-game scene not found: ${sceneKey}`)
      // Fallback to standard working animation
      this.showWorkingAnimation(job)
      return
    }

    // Store job data for when we return
    this.pendingJob = job
    this.pendingGameData = gameData

    // Clean up stats bar before leaving
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    // Launch the mini-game
    console.log(`[JobScene] Starting mini-game: ${sceneKey}`)
    this.scene.stop()
    this.scene.start(sceneKey, gameData)
  }

  /**
   * Handle mini-game completion and apply job rewards
   */
  handleMiniGameComplete(result, job) {
    console.log('[JobScene] Mini-game completed:', result)

    if (!result) {
      console.warn('[JobScene] No result from mini-game')
      return
    }

    // Calculate rewards based on mini-game performance
    const basePay = job.base_pay || 50
    const baseXp = job.xp_reward || 10
    const bonusMultiplier = result.bonusMultiplier || 1

    // Apply multiplier based on success/failure
    let cashEarned = 0
    let xpEarned = 0

    if (result.success) {
      cashEarned = Math.floor(basePay * bonusMultiplier)
      xpEarned = Math.floor(baseXp * bonusMultiplier)

      // Perfect run bonus
      if (result.perfectRun) {
        cashEarned = Math.floor(cashEarned * 1.5)
        xpEarned = Math.floor(xpEarned * 1.5)
      }
    } else {
      // Failed - still get small amount for trying
      cashEarned = Math.floor(basePay * 0.2)
      xpEarned = Math.floor(baseXp * 0.3)
    }

    // Apply rewards to player
    const player = gameManager.player || getPlayerData() || {}
    player.cash = (player.cash || 0) + cashEarned
    player.totalEarnings = (player.totalEarnings || 0) + cashEarned
    player.xp = (player.xp || 0) + xpEarned
    player.jobs_completed = (player.jobs_completed || 0) + 1

    // Deduct energy
    const energyCost = job.energy_cost || job.stamina_cost || 10
    player.energy = Math.max(0, (player.energy || 100) - energyCost)

    // Check for level up
    const oldLevel = player.level || 1
    const newLevel = Math.floor(Math.sqrt((player.xp || 0) / 100)) + 1

    if (newLevel > oldLevel) {
      player.level = newLevel
      // Send new contract offers
      this.sendNewContractOffers(LOCAL_JOBS)
      // Send level up message
      networkMessageManager.createSystemMessage(
        `LEVEL ${newLevel} ACHIEVED`,
        `Your work ethic has paid off. New opportunities may be available.`
      )
    }

    // Save player data
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    // Set cooldown
    const cooldown = (job.duration_seconds || 60) * 1000
    gameManager.setCooldown('job', cooldown)
  }

  /**
   * Show the standard working animation (for jobs without mini-games)
   */
  showWorkingAnimation(job) {
    // Disable cards
    this.jobCards.forEach(c => c.disableInteractive())

    // Show working animation - Network terminal style
    const { width, height } = this.cameras.main
    const workingBg = this.add.rectangle(width / 2, height / 2, 300, 150, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, COLORS.network.primary, 0.5)
    const workingText = this.add.text(width / 2, height / 2 - 20, `${SYMBOLS.system} EXECUTING CONTRACT...`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    const progressBg = this.add.rectangle(width / 2, height / 2 + 30, 200, 20, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.network.dim, 0.5)
    const progressBar = this.add.rectangle(width / 2 - 100, height / 2 + 30, 0, 20, COLORS.network.primary).setOrigin(0, 0.5)

    // Animate progress
    this.tweens.add({
      targets: progressBar,
      width: 200,
      duration: 1500,
      ease: 'Linear',
      onComplete: async () => {
        let result
        try {
          result = await gameManager.workJob(job.id)
        } catch (error) {
          console.log('[JobScene] API failed, executing locally')
          result = this.executeJobLocally(job)
        }

        // Initialize notification manager for floating gains
        notificationManager.setScene(this)

        // Play job complete sound (using cash sound as job complete)
        audioManager.playCashGain(result.cash_earned || 0)

        // Update working text - Network style
        workingText.setText(`${SYMBOLS.check} CONTRACT COMPLETE`)
        progressBar.destroy()
        progressBg.destroy()

        this.add.text(width / 2, height / 2 + 20, `EARNED ${formatMoney(result.cash_earned || 0)}`, {
          ...getTerminalStyle('md'),
          color: toHexString(COLORS.text.gold)
        }).setOrigin(0.5)

        // Show floating cash gain
        if (result.cash_earned) {
          notificationManager.showCashGain(width / 2 - 30, height / 2 - 10, result.cash_earned)
        }
        // Show XP gain if any
        if (result.xp_earned) {
          this.time.delayedCall(200, () => {
            notificationManager.showXPGain(width / 2 + 30, height / 2 - 10, result.xp_earned)
          })
        }

        if (result.leveled_up) {
          this.add.text(width / 2, height / 2 + 45, `${SYMBOLS.check} LEVEL UP! NOW LV.${result.new_level}`, {
            ...getTerminalStyle('sm'),
            color: toHexString(0x8b5cf6)
          }).setOrigin(0.5)

          // Show level up notification and play sound
          this.time.delayedCall(400, () => {
            audioManager.playLevelUp()
            notificationManager.showLevelUp(result.new_level)
          })
        }

        // Check for achievements after job
        this.checkAchievements()

        // Auto close after delay
        this.time.delayedCall(2000, () => {
          this.scene.restart()
        })
      }
    })
  }

  // Execute job with local storage only (no API)
  executeJobLocally(job) {
    const player = gameManager.player || getPlayerData() || {}
    const energyCost = job.energy_cost || job.stamina_cost || 10

    // Deduct energy
    player.energy = Math.max(0, (player.energy || 100) - energyCost)

    // Get time-of-day modifier
    const basePay = job.base_pay || job.payout || 50
    const timeAdjusted = applyTimeModifierToJob(basePay)

    // Calculate pay with level bonus + time modifier
    const levelBonus = Math.floor((player.level || 1) * 5)
    const cashEarned = Math.floor(timeAdjusted.adjustedPay * (1 + levelBonus / 100))
    const xpEarned = job.xp_reward || Math.floor(basePay * 0.2)

    // Update player stats
    player.cash = (player.cash || 0) + cashEarned
    player.totalEarnings = (player.totalEarnings || 0) + cashEarned
    player.xp = (player.xp || 0) + xpEarned
    player.jobs_completed = (player.jobs_completed || 0) + 1

    // Check for level up
    const oldLevel = player.level || 1
    const newLevel = Math.floor(Math.sqrt((player.xp || 0) / 100)) + 1
    let leveledUp = false
    if (newLevel > oldLevel) {
      player.level = newLevel
      leveledUp = true

      // Send new contract offers for newly unlocked jobs (THE NETWORK integration)
      this.sendNewContractOffers(LOCAL_JOBS)

      // Send level up message to THE NETWORK
      networkMessageManager.createSystemMessage(
        `LEVEL ${newLevel} ACHIEVED`,
        `Congratulations. Your network reputation has increased. New opportunities may now be available.\n\nCheck your contracts - your handlers have been notified of your progress.`
      )
    }

    // Save updated player data
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    // Set cooldown
    const cooldown = (job.duration_seconds || 60) * 1000
    gameManager.setCooldown('job', cooldown)

    return {
      success: true,
      cash_earned: cashEarned,
      xp_earned: xpEarned,
      leveled_up: leveledUp,
      new_level: newLevel,
      timeOfDay: timeAdjusted.periodName,
      timeIcon: timeAdjusted.periodIcon
    }
  }

  async checkAchievements() {
    try {
      achievementPopup.setScene(this)
      const result = await gameManager.checkAchievements()
      if (result?.new_achievements?.length > 0) {
        achievementPopup.showMultiple(result.new_achievements)
      }
    } catch (error) {
      console.error('Failed to check achievements:', error)
    }
  }

  closeScene() {
    // Clean up stats bar
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    // Get scene manager reference before stopping
    const sceneManager = this.scene

    // CRITICAL: Re-enable input on GameScene BEFORE resuming
    try {
      const gameScene = sceneManager.get('GameScene')
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[JobScene] Re-enabled GameScene input')
      }
    } catch (e) {
      console.error('[JobScene] Failed to re-enable GameScene input:', e)
    }

    // Stop this scene
    sceneManager.stop()

    // CRITICAL: Bring GameScene to top of scene stack for input priority
    try {
      sceneManager.bringToTop('GameScene')
      console.log('[JobScene] Brought GameScene to top')
    } catch (e) {
      console.error('[JobScene] Failed to bring GameScene to top:', e)
    }

    // Resume GameScene and UIScene
    sceneManager.resume('GameScene')
    try {
      sceneManager.resume('UIScene')
    } catch (e) {
      // UIScene might already be running
    }
  }
}
