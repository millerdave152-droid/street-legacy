import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { MiniGameManager } from '../managers/MiniGameManager'
import { achievementPopup } from '../ui/AchievementPopup'
import { notificationManager } from '../managers/NotificationManager'
import { audioManager } from '../managers/AudioManager'
import { AnimationHelper } from '../utils/AnimationHelper'
import { ParticleHelper } from '../utils/ParticleHelper'
import { ButtonFactory } from '../utils/ButtonFactory'
import { PlayerStatsBar } from '../ui/PlayerStatsBar'

// Network Theme
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'

// Time-of-day system, arrest function, district heat, witness system, dynamic cooldowns, and world events
import { getCurrentTimeModifier, applyTimeModifierToCrime, arrestPlayer, addDistrictHeat, getDistrictEffects, calculateWitnessOutcome, DISTRICTS, calculateDynamicCooldown, checkParoleViolation, getCooldownModifiersText, getEnergyStats, getActiveEventEffects } from '../data/GameData.js'

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
    console.error('[CrimeScene] Failed to save player data:', e)
  }
}

// Full crime database for local play - organized by tier
const LOCAL_CRIMES = [
  // === TIER 1: PETTY STREET CRIMES (Level 1-5) ===
  { id: 'pickpocket', name: 'Pickpocket', description: 'Lift wallets from distracted tourists', min_level: 1, energy_cost: 5, base_success_rate: 85, min_payout: 20, max_payout: 100, heat_gain: 3, xp_reward: 10, tier: 'petty', has_minigame: true },
  { id: 'shoplift', name: 'Shoplifting', description: 'Five finger discount at local stores', min_level: 1, energy_cost: 5, base_success_rate: 80, min_payout: 15, max_payout: 75, heat_gain: 2, xp_reward: 8, tier: 'petty', has_minigame: true },
  { id: 'panhandling_scam', name: 'Panhandling Scam', description: 'Fake disability story for sympathy cash', min_level: 1, energy_cost: 4, base_success_rate: 90, min_payout: 10, max_payout: 50, heat_gain: 1, xp_reward: 5, tier: 'petty' },
  { id: 'dine_dash', name: 'Dine and Dash', description: 'Eat a meal and bolt before paying', min_level: 1, energy_cost: 6, base_success_rate: 75, min_payout: 20, max_payout: 60, heat_gain: 2, xp_reward: 7, tier: 'petty', has_minigame: true },
  { id: 'purse_snatch', name: 'Purse Snatching', description: 'Grab and run in crowded areas', min_level: 2, energy_cost: 8, base_success_rate: 70, min_payout: 30, max_payout: 150, heat_gain: 5, xp_reward: 12, tier: 'petty', has_minigame: true },
  { id: 'package_theft', name: 'Package Theft', description: 'Steal packages from porches', min_level: 2, energy_cost: 6, base_success_rate: 85, min_payout: 20, max_payout: 200, heat_gain: 3, xp_reward: 10, tier: 'petty', has_minigame: true },
  { id: 'gas_driveoff', name: 'Gas Station Drive-off', description: 'Fill up and speed away', min_level: 2, energy_cost: 7, base_success_rate: 70, min_payout: 30, max_payout: 80, heat_gain: 5, xp_reward: 9, tier: 'petty', has_minigame: true },
  { id: 'toll_scam', name: 'Toll Booth Scam', description: 'Fake parking tickets on windshields', min_level: 3, energy_cost: 5, base_success_rate: 80, min_payout: 25, max_payout: 100, heat_gain: 3, xp_reward: 8, tier: 'petty' },

  // === TIER 2: PROPERTY CRIMES (Level 5-15) ===
  { id: 'car_break_in', name: 'Car Break-in', description: 'Smash windows, grab valuables', min_level: 5, energy_cost: 10, base_success_rate: 75, min_payout: 50, max_payout: 300, heat_gain: 8, xp_reward: 15, tier: 'theft', has_minigame: true },
  { id: 'bike_theft', name: 'Bike Theft', description: 'Steal bicycles to sell', min_level: 5, energy_cost: 8, base_success_rate: 80, min_payout: 50, max_payout: 200, heat_gain: 3, xp_reward: 12, tier: 'theft', has_minigame: true },
  { id: 'joyriding', name: 'Joyriding', description: 'Steal car for a temporary thrill ride', min_level: 6, energy_cost: 12, base_success_rate: 70, min_payout: 0, max_payout: 50, heat_gain: 5, xp_reward: 20, tier: 'theft', has_minigame: true },
  { id: 'copper_theft', name: 'Copper Wire Theft', description: 'Strip wiring from buildings', min_level: 7, energy_cost: 15, base_success_rate: 70, min_payout: 100, max_payout: 400, heat_gain: 8, xp_reward: 18, tier: 'theft', has_minigame: true },
  { id: 'catalytic_theft', name: 'Catalytic Converter Theft', description: 'Cut converters from parked cars', min_level: 8, energy_cost: 15, base_success_rate: 65, min_payout: 150, max_payout: 500, heat_gain: 10, xp_reward: 22, tier: 'theft', has_minigame: true },
  { id: 'graffiti_vandalism', name: 'Graffiti Tag', description: 'Tag walls for gang reputation', min_level: 5, energy_cost: 8, base_success_rate: 90, min_payout: 0, max_payout: 50, heat_gain: 5, xp_reward: 15, tier: 'theft', has_minigame: true },
  { id: 'house_burglary', name: 'House Burglary', description: 'Break into residential homes', min_level: 10, energy_cost: 20, base_success_rate: 60, min_payout: 200, max_payout: 1000, heat_gain: 15, xp_reward: 35, tier: 'theft', has_minigame: true },
  { id: 'atm_skimming', name: 'ATM Skimming', description: 'Install card reader devices', min_level: 12, energy_cost: 18, base_success_rate: 55, min_payout: 200, max_payout: 800, heat_gain: 15, xp_reward: 40, tier: 'theft', has_minigame: true },

  // === TIER 3: ROBBERY & THEFT (Level 10-25) ===
  { id: 'mugging', name: 'Mugging', description: 'Rob pedestrians in dark alleys', min_level: 10, energy_cost: 15, base_success_rate: 70, min_payout: 50, max_payout: 300, heat_gain: 10, xp_reward: 25, tier: 'violent', has_minigame: true },
  { id: 'strong_arm', name: 'Strong-arm Robbery', description: 'Forceful street robbery', min_level: 12, energy_cost: 18, base_success_rate: 65, min_payout: 100, max_payout: 500, heat_gain: 15, xp_reward: 30, tier: 'violent', has_minigame: true },
  { id: 'convenience_robbery', name: 'Convenience Store Robbery', description: 'Hold up small shops', min_level: 14, energy_cost: 22, base_success_rate: 60, min_payout: 200, max_payout: 800, heat_gain: 20, xp_reward: 40, tier: 'violent', has_minigame: true },
  { id: 'gas_station_robbery', name: 'Gas Station Robbery', description: 'Rob gas station registers', min_level: 15, energy_cost: 20, base_success_rate: 60, min_payout: 150, max_payout: 600, heat_gain: 18, xp_reward: 35, tier: 'violent', has_minigame: true },
  { id: 'liquor_store_robbery', name: 'Liquor Store Robbery', description: 'Hold up liquor stores', min_level: 16, energy_cost: 22, base_success_rate: 55, min_payout: 300, max_payout: 1200, heat_gain: 22, xp_reward: 45, tier: 'violent', has_minigame: true },
  { id: 'jewelry_smash', name: 'Jewelry Smash & Grab', description: 'Break display cases, grab goods', min_level: 18, energy_cost: 25, base_success_rate: 50, min_payout: 500, max_payout: 3000, heat_gain: 25, xp_reward: 55, tier: 'violent', has_minigame: true },

  // === TIER 4: VEHICLE CRIMES (Level 15-30) ===
  { id: 'car_theft', name: 'Car Theft', description: 'Steal vehicles for the chop shop', min_level: 15, energy_cost: 20, base_success_rate: 60, min_payout: 1000, max_payout: 5000, heat_gain: 20, xp_reward: 50, tier: 'vehicle', has_minigame: true },
  { id: 'luxury_theft', name: 'Luxury Car Theft', description: 'Target high-end vehicles', min_level: 20, energy_cost: 28, base_success_rate: 50, min_payout: 3000, max_payout: 15000, heat_gain: 30, xp_reward: 80, tier: 'vehicle', has_minigame: true },
  { id: 'chop_shop', name: 'Chop Shop Work', description: 'Disassemble stolen vehicles', min_level: 18, energy_cost: 25, base_success_rate: 75, min_payout: 500, max_payout: 2000, heat_gain: 5, xp_reward: 45, tier: 'vehicle', has_minigame: true },
  { id: 'vin_switching', name: 'VIN Switching', description: 'Change vehicle identities', min_level: 22, energy_cost: 20, base_success_rate: 65, min_payout: 800, max_payout: 2500, heat_gain: 10, xp_reward: 55, tier: 'vehicle', has_minigame: true },
  { id: 'carjacking', name: 'Carjacking', description: 'Take vehicles by force', min_level: 25, energy_cost: 35, base_success_rate: 45, min_payout: 500, max_payout: 2000, heat_gain: 35, xp_reward: 70, tier: 'vehicle', has_minigame: true },
  { id: 'truck_hijacking', name: 'Truck Hijacking', description: 'Steal delivery trucks', min_level: 28, energy_cost: 40, base_success_rate: 40, min_payout: 2000, max_payout: 8000, heat_gain: 35, xp_reward: 90, tier: 'vehicle', has_minigame: true },

  // === TIER 5: CON ARTIST & FRAUD (Level 10-35) ===
  { id: 'change_scam', name: 'Change Scam', description: 'Confuse cashiers during change', min_level: 10, energy_cost: 8, base_success_rate: 75, min_payout: 50, max_payout: 200, heat_gain: 2, xp_reward: 18, tier: 'fraud' },
  { id: 'fake_charity', name: 'Fake Charity', description: 'Collect for fake causes', min_level: 12, energy_cost: 10, base_success_rate: 80, min_payout: 100, max_payout: 500, heat_gain: 5, xp_reward: 25, tier: 'fraud', has_minigame: true },
  { id: 'identity_theft', name: 'Identity Theft', description: 'Steal personal information', min_level: 15, energy_cost: 15, base_success_rate: 60, min_payout: 300, max_payout: 2000, heat_gain: 15, xp_reward: 45, tier: 'fraud', has_minigame: true },
  { id: 'check_fraud', name: 'Check Fraud', description: 'Forge and cash bad checks', min_level: 18, energy_cost: 12, base_success_rate: 55, min_payout: 200, max_payout: 1500, heat_gain: 12, xp_reward: 40, tier: 'fraud', has_minigame: true },
  { id: 'credit_fraud', name: 'Credit Card Fraud', description: 'Use stolen card data', min_level: 16, energy_cost: 10, base_success_rate: 65, min_payout: 100, max_payout: 1000, heat_gain: 10, xp_reward: 35, tier: 'fraud', has_minigame: true },
  { id: 'rental_scam', name: 'Rental Scam', description: 'Fake landlord property scam', min_level: 20, energy_cost: 18, base_success_rate: 60, min_payout: 500, max_payout: 3000, heat_gain: 8, xp_reward: 50, tier: 'fraud', has_minigame: true },
  { id: 'insurance_fraud', name: 'Insurance Fraud', description: 'Fake accidents and injuries', min_level: 25, energy_cost: 22, base_success_rate: 50, min_payout: 500, max_payout: 5000, heat_gain: 10, xp_reward: 65, tier: 'fraud', has_minigame: true },
  { id: 'romance_scam', name: 'Romance Scam', description: 'Long con romantic targets', min_level: 28, energy_cost: 15, base_success_rate: 55, min_payout: 1000, max_payout: 10000, heat_gain: 5, xp_reward: 80, tier: 'fraud', has_minigame: true },

  // === TIER 6: DRUG OPERATIONS (Level 15-40) ===
  { id: 'street_deal', name: 'Street Dealing', description: 'Sell small quantities on corners', min_level: 15, energy_cost: 12, base_success_rate: 70, min_payout: 50, max_payout: 300, heat_gain: 10, xp_reward: 25, tier: 'drugs', has_minigame: true },
  { id: 'dead_drop', name: 'Dead Drop Pickup', description: 'Retrieve stashed product', min_level: 16, energy_cost: 10, base_success_rate: 80, min_payout: 100, max_payout: 400, heat_gain: 5, xp_reward: 22, tier: 'drugs', has_minigame: true },
  { id: 'drug_runner', name: 'Drug Runner', description: 'Transport between locations', min_level: 18, energy_cost: 18, base_success_rate: 65, min_payout: 200, max_payout: 800, heat_gain: 15, xp_reward: 35, tier: 'drugs', has_minigame: true },
  { id: 'stash_guard', name: 'Stash House Guard', description: 'Protect drug locations', min_level: 20, energy_cost: 20, base_success_rate: 85, min_payout: 300, max_payout: 600, heat_gain: 8, xp_reward: 30, tier: 'drugs' },
  { id: 'drug_mule', name: 'Drug Mule', description: 'Cross-border transport', min_level: 25, energy_cost: 30, base_success_rate: 50, min_payout: 1000, max_payout: 5000, heat_gain: 30, xp_reward: 70, tier: 'drugs', has_minigame: true },
  { id: 'cutting_packaging', name: 'Cutting & Packaging', description: 'Prepare product for distribution', min_level: 22, energy_cost: 15, base_success_rate: 85, min_payout: 200, max_payout: 800, heat_gain: 10, xp_reward: 40, tier: 'drugs', has_minigame: true },
  { id: 'corner_boss', name: 'Corner Boss', description: 'Manage street-level operations', min_level: 30, energy_cost: 25, base_success_rate: 70, min_payout: 1000, max_payout: 3000, heat_gain: 25, xp_reward: 75, tier: 'drugs' },

  // === TIER 7: ORGANIZED CRIME (Level 25-50) ===
  { id: 'protection_racket', name: 'Protection Racket', description: 'Collect "insurance" from businesses', min_level: 25, energy_cost: 20, base_success_rate: 75, min_payout: 500, max_payout: 2000, heat_gain: 15, xp_reward: 55, tier: 'organized', has_minigame: true },
  { id: 'numbers_running', name: 'Numbers Running', description: 'Illegal gambling courier work', min_level: 20, energy_cost: 12, base_success_rate: 85, min_payout: 200, max_payout: 800, heat_gain: 10, xp_reward: 35, tier: 'organized' },
  { id: 'loan_sharking', name: 'Loan Sharking', description: 'Predatory lending operations', min_level: 28, energy_cost: 15, base_success_rate: 80, min_payout: 500, max_payout: 3000, heat_gain: 12, xp_reward: 60, tier: 'organized' },
  { id: 'debt_collection', name: 'Debt Collection', description: 'Enforce loan repayment', min_level: 25, energy_cost: 22, base_success_rate: 65, min_payout: 300, max_payout: 1500, heat_gain: 20, xp_reward: 50, tier: 'organized', has_minigame: true },
  { id: 'fencing', name: 'Fencing', description: 'Buy and sell stolen goods', min_level: 22, energy_cost: 12, base_success_rate: 80, min_payout: 300, max_payout: 2000, heat_gain: 8, xp_reward: 45, tier: 'organized', has_minigame: true },
  { id: 'bookmaking', name: 'Bookmaking', description: 'Take illegal sports bets', min_level: 25, energy_cost: 15, base_success_rate: 75, min_payout: 500, max_payout: 5000, heat_gain: 10, xp_reward: 55, tier: 'organized' },
  { id: 'fight_fixing', name: 'Fight Fixing', description: 'Rig sporting events', min_level: 32, energy_cost: 25, base_success_rate: 55, min_payout: 2000, max_payout: 10000, heat_gain: 15, xp_reward: 85, tier: 'organized', has_minigame: true },
  { id: 'money_laundering', name: 'Money Laundering', description: 'Clean dirty money', min_level: 35, energy_cost: 20, base_success_rate: 70, min_payout: 1000, max_payout: 10000, heat_gain: 5, xp_reward: 95, tier: 'organized', has_minigame: true },
  { id: 'smuggling', name: 'Smuggling', description: 'Move contraband across borders', min_level: 38, energy_cost: 35, base_success_rate: 50, min_payout: 2000, max_payout: 15000, heat_gain: 25, xp_reward: 120, tier: 'organized', has_minigame: true },

  // === TIER 8: CYBER CRIMES (Level 20-45) ===
  { id: 'phishing', name: 'Phishing', description: 'Fake emails to steal credentials', min_level: 20, energy_cost: 10, base_success_rate: 75, min_payout: 100, max_payout: 1000, heat_gain: 5, xp_reward: 35, tier: 'cyber', has_minigame: true },
  { id: 'card_skimming', name: 'Card Skimming', description: 'Clone credit cards at POS', min_level: 22, energy_cost: 15, base_success_rate: 65, min_payout: 200, max_payout: 2000, heat_gain: 12, xp_reward: 45, tier: 'cyber', has_minigame: true },
  { id: 'sim_swapping', name: 'SIM Swapping', description: 'Take over phone numbers', min_level: 25, energy_cost: 18, base_success_rate: 55, min_payout: 500, max_payout: 5000, heat_gain: 15, xp_reward: 60, tier: 'cyber', has_minigame: true },
  { id: 'atm_hack', name: 'ATM Hacking', description: 'Crack ATM machines for cash', min_level: 28, energy_cost: 25, base_success_rate: 50, min_payout: 1000, max_payout: 5000, heat_gain: 18, xp_reward: 75, tier: 'cyber', has_minigame: true },
  { id: 'account_takeover', name: 'Account Takeover', description: 'Hijack online accounts', min_level: 25, energy_cost: 15, base_success_rate: 60, min_payout: 300, max_payout: 3000, heat_gain: 12, xp_reward: 55, tier: 'cyber', has_minigame: true },
  { id: 'e_fencing', name: 'E-Fencing', description: 'Sell stolen goods online', min_level: 18, energy_cost: 10, base_success_rate: 80, min_payout: 200, max_payout: 1500, heat_gain: 8, xp_reward: 40, tier: 'cyber' },
  { id: 'ransomware', name: 'Ransomware Attack', description: 'Encrypt data for ransom', min_level: 35, energy_cost: 30, base_success_rate: 45, min_payout: 1000, max_payout: 20000, heat_gain: 25, xp_reward: 100, tier: 'cyber', has_minigame: true },
  { id: 'crypto_scam', name: 'Crypto Scam', description: 'Fake investment schemes', min_level: 30, energy_cost: 20, base_success_rate: 55, min_payout: 2000, max_payout: 50000, heat_gain: 15, xp_reward: 110, tier: 'cyber', has_minigame: true },

  // === TIER 9: CLASSIC CRIMES (Level 10-35) ===
  { id: 'three_card', name: 'Three-Card Monte', description: 'Street card game hustle', min_level: 10, energy_cost: 8, base_success_rate: 80, min_payout: 50, max_payout: 500, heat_gain: 3, xp_reward: 20, tier: 'classic', has_minigame: true },
  { id: 'shell_game', name: 'Shell Game', description: 'Ball-under-cup street con', min_level: 10, energy_cost: 8, base_success_rate: 85, min_payout: 30, max_payout: 300, heat_gain: 2, xp_reward: 18, tier: 'classic', has_minigame: true },
  { id: 'bootlegging', name: 'Bootlegging', description: 'Make and sell illegal alcohol', min_level: 18, energy_cost: 20, base_success_rate: 70, min_payout: 300, max_payout: 1500, heat_gain: 15, xp_reward: 45, tier: 'classic', has_minigame: true },
  { id: 'counterfeiting', name: 'Counterfeiting', description: 'Print fake currency', min_level: 25, energy_cost: 25, base_success_rate: 55, min_payout: 500, max_payout: 5000, heat_gain: 20, xp_reward: 70, tier: 'classic', has_minigame: true },
  { id: 'art_forgery', name: 'Art Forgery', description: 'Create and sell fake artwork', min_level: 28, energy_cost: 30, base_success_rate: 50, min_payout: 2000, max_payout: 20000, heat_gain: 10, xp_reward: 90, tier: 'classic', has_minigame: true },
  { id: 'safe_cracking', name: 'Safe Cracking', description: 'Break into safes and vaults', min_level: 22, energy_cost: 28, base_success_rate: 45, min_payout: 1000, max_payout: 10000, heat_gain: 15, xp_reward: 75, tier: 'classic', has_minigame: true },
  { id: 'cat_burglary', name: 'Cat Burglary', description: 'High-end stealth theft', min_level: 30, energy_cost: 35, base_success_rate: 40, min_payout: 2000, max_payout: 15000, heat_gain: 20, xp_reward: 100, tier: 'classic', has_minigame: true },
  { id: 'warehouse_heist', name: 'Warehouse Raid', description: 'Hit a warehouse full of goods', min_level: 35, energy_cost: 45, base_success_rate: 35, min_payout: 3000, max_payout: 20000, heat_gain: 35, xp_reward: 130, tier: 'organized', has_minigame: true },

  // === TIER 10: TERRITORY & TURF (Level 30-50) ===
  { id: 'turf_takeover', name: 'Turf Takeover', description: 'Claim a block from rival crews', min_level: 30, energy_cost: 40, base_success_rate: 45, min_payout: 2000, max_payout: 8000, heat_gain: 40, xp_reward: 120, tier: 'territory', has_minigame: true },
  { id: 'gang_clash', name: 'Gang Clash', description: 'Fight rival gang members for dominance', min_level: 32, energy_cost: 50, base_success_rate: 35, min_payout: 1000, max_payout: 5000, heat_gain: 50, xp_reward: 100, tier: 'territory', has_minigame: true },
  { id: 'collection_run', name: 'Collection Run', description: 'Collect weekly protection money', min_level: 28, energy_cost: 20, base_success_rate: 75, min_payout: 500, max_payout: 2000, heat_gain: 15, xp_reward: 55, tier: 'territory' },
  { id: 'drive_by', name: 'Drive-By', description: 'Intimidation hit on rival territory', min_level: 35, energy_cost: 35, base_success_rate: 40, min_payout: 0, max_payout: 500, heat_gain: 60, xp_reward: 85, tier: 'territory', has_minigame: true },
  { id: 'territory_defend', name: 'Defend Turf', description: 'Protect your territory from rivals', min_level: 30, energy_cost: 30, base_success_rate: 60, min_payout: 300, max_payout: 1500, heat_gain: 25, xp_reward: 70, tier: 'territory', has_minigame: true },
  { id: 'corner_setup', name: 'Corner Setup', description: 'Establish a new dealing corner', min_level: 33, energy_cost: 35, base_success_rate: 50, min_payout: 800, max_payout: 3000, heat_gain: 30, xp_reward: 90, tier: 'territory', has_minigame: true },
  { id: 'turf_expansion', name: 'Turf Expansion', description: 'Extend your territory into new blocks', min_level: 40, energy_cost: 45, base_success_rate: 40, min_payout: 3000, max_payout: 12000, heat_gain: 45, xp_reward: 140, tier: 'territory', has_minigame: true },

  // === TIER 11: WHITE COLLAR (Level 25-45) ===
  { id: 'embezzlement', name: 'Embezzlement', description: 'Skim funds from corporate accounts', min_level: 25, energy_cost: 25, base_success_rate: 50, min_payout: 5000, max_payout: 25000, heat_gain: 15, xp_reward: 95, tier: 'whitecollar', has_minigame: true },
  { id: 'stock_manipulation', name: 'Pump & Dump', description: 'Manipulate stock prices for profit', min_level: 30, energy_cost: 30, base_success_rate: 45, min_payout: 10000, max_payout: 50000, heat_gain: 10, xp_reward: 120, tier: 'whitecollar', has_minigame: true },
  { id: 'tax_evasion', name: 'Tax Scheme', description: 'Hide income through shell companies', min_level: 28, energy_cost: 20, base_success_rate: 55, min_payout: 2000, max_payout: 10000, heat_gain: 8, xp_reward: 75, tier: 'whitecollar' },
  { id: 'bribery', name: 'Official Bribery', description: 'Pay off officials to reduce heat', min_level: 25, energy_cost: 15, base_success_rate: 60, min_payout: -5000, max_payout: -1000, heat_gain: -20, xp_reward: 50, tier: 'whitecollar' },
  { id: 'blackmail', name: 'Blackmail', description: 'Leverage secrets for cash', min_level: 30, energy_cost: 25, base_success_rate: 50, min_payout: 3000, max_payout: 15000, heat_gain: 20, xp_reward: 85, tier: 'whitecollar', has_minigame: true },
  { id: 'insider_trading', name: 'Insider Trading', description: 'Trade on confidential information', min_level: 35, energy_cost: 20, base_success_rate: 55, min_payout: 8000, max_payout: 40000, heat_gain: 12, xp_reward: 110, tier: 'whitecollar', has_minigame: true },
  { id: 'corporate_espionage', name: 'Corporate Espionage', description: 'Steal trade secrets for competitors', min_level: 38, energy_cost: 35, base_success_rate: 40, min_payout: 15000, max_payout: 75000, heat_gain: 18, xp_reward: 150, tier: 'whitecollar', has_minigame: true },
  { id: 'ponzi_scheme', name: 'Ponzi Scheme', description: 'Run an elaborate investment fraud', min_level: 42, energy_cost: 40, base_success_rate: 35, min_payout: 20000, max_payout: 100000, heat_gain: 25, xp_reward: 180, tier: 'whitecollar', has_minigame: true },

  // === TIER 12: VICE & GAMBLING (Level 15-40) ===
  { id: 'underground_poker', name: 'Run Poker Game', description: 'Host illegal high-stakes poker', min_level: 18, energy_cost: 20, base_success_rate: 70, min_payout: 500, max_payout: 3000, heat_gain: 10, xp_reward: 45, tier: 'vice', has_minigame: true },
  { id: 'dice_game', name: 'Street Dice', description: 'Run craps games on street corners', min_level: 15, energy_cost: 10, base_success_rate: 80, min_payout: 100, max_payout: 1000, heat_gain: 5, xp_reward: 25, tier: 'vice', has_minigame: true },
  { id: 'fight_club', name: 'Fight Club', description: 'Run illegal underground fights', min_level: 25, energy_cost: 30, base_success_rate: 55, min_payout: 1000, max_payout: 5000, heat_gain: 20, xp_reward: 65, tier: 'vice', has_minigame: true },
  { id: 'escort_ring', name: 'Escort Service', description: 'Manage high-end escort operations', min_level: 28, energy_cost: 25, base_success_rate: 60, min_payout: 2000, max_payout: 8000, heat_gain: 25, xp_reward: 80, tier: 'vice' },
  { id: 'speakeasy', name: 'Speakeasy', description: 'Run an illegal after-hours bar', min_level: 22, energy_cost: 22, base_success_rate: 65, min_payout: 800, max_payout: 3500, heat_gain: 12, xp_reward: 55, tier: 'vice' },
  { id: 'casino_operation', name: 'Underground Casino', description: 'Operate illegal gambling den', min_level: 35, energy_cost: 35, base_success_rate: 50, min_payout: 3000, max_payout: 15000, heat_gain: 22, xp_reward: 100, tier: 'vice', has_minigame: true },
  { id: 'match_fixing', name: 'Match Fixing', description: 'Fix sports matches for big payouts', min_level: 38, energy_cost: 30, base_success_rate: 45, min_payout: 5000, max_payout: 25000, heat_gain: 18, xp_reward: 115, tier: 'vice', has_minigame: true },
  { id: 'slot_rigging', name: 'Slot Machine Rigging', description: 'Hack casino slot machines', min_level: 32, energy_cost: 28, base_success_rate: 40, min_payout: 2000, max_payout: 12000, heat_gain: 30, xp_reward: 90, tier: 'vice', has_minigame: true },
]

export class CrimeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CrimeScene' })
    this.miniGameManager = null
    this.pendingCrime = null
    this.crewBonuses = null
    this.crewMembers = []
    this.statsBar = null

    // UI Settings
    this.settings = {
      holdToConfirm: false,        // Require hold for dangerous crimes
      holdDuration: 500,           // ms to hold for confirm
      touchSensitivity: 'normal',  // 'low', 'normal', 'high'
      animationsEnabled: true,
      showRiskIndicator: true,
    }

    // Scroll state
    this.scrollY = 0
    this.maxScrollY = 0
    this.isDragging = false
    this.dragStartY = 0
    this.scrollContainer = null
    this.scrollMask = null

    // Hold-to-confirm state
    this.holdTimer = null
    this.holdProgress = null
    this.isHolding = false
  }

  init(data) {
    // Check if we're returning from a police chase
    if (this.registry.get('returnFromPoliceChase') && data && data.miniGameResult !== undefined) {
      this.policeChaseResult = data
      console.log('[CrimeScene] Returned from police chase')
      return
    }

    // Check if we're returning from a mini-game
    if (data && data.miniGameResult) {
      this.miniGameResult = data.miniGameResult
      // Restore pending crime from scene registry if available
      this.pendingCrime = this.registry.get('pendingCrime') || null
      console.log('[CrimeScene] Returned from minigame, pendingCrime:', this.pendingCrime?.name)
    } else {
      this.miniGameResult = null
      this.pendingCrime = null
    }

    this.policeChaseResult = null
    this.pursuitTriggered = false
  }

  async create() {
    console.log('[CrimeScene] create() started')

    // CRITICAL: Reset camera state to prevent colored screen from mini-games
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.tweens.timeScale = 1
      this.tweens.killTweensOf(this.cameras.main)
    } catch (e) {
      console.warn('[CrimeScene] Camera reset warning:', e)
    }

    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top of scene stack for input priority
    // This ensures CrimeScene receives input, not GameScene below
    this.scene.bringToTop()
    console.log('[CrimeScene] Brought self to top of scene stack')

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    // GameScene may have been opened before us and could intercept clicks
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
        console.log('[CrimeScene] Disabled GameScene input')
      }
    } catch (e) {
      console.log('[CrimeScene] Could not access GameScene:', e.message)
    }

    // Initialize mini-game manager
    this.miniGameManager = new MiniGameManager(this)

    // Check if returning from police chase
    if (this.policeChaseResult && this.registry.get('returnFromPoliceChase')) {
      console.log('[CrimeScene] Handling police chase return')
      this.handlePoliceChaseReturn(this.policeChaseResult)
      this.policeChaseResult = null
      return
    }

    // Check if returning from mini-game
    if (this.miniGameResult && this.pendingCrime) {
      console.log('[CrimeScene] Handling mini-game result')
      // Process the mini-game result
      await this.handleMiniGameResult(this.miniGameResult, this.pendingCrime)
      this.miniGameResult = null
      this.pendingCrime = null
      return
    }

    console.log('[CrimeScene] Creating full UI (not returning from minigame/chase)')

    // Full screen background - Network dark
    this.overlay = this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive() // Prevent clicks passing through

    // Play scene intro animation
    networkTransition.playSceneIntro(this, 'CrimeScene')

    // Subtle grid pattern overlay for texture
    this.createBackgroundPattern()

    // Header container with icon
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Settings button
    this.createSettingsButton()

    // Player stats bar (energy, heat, cooldown)
    this.statsBar = new PlayerStatsBar(this, {
      y: 70,
      cooldownAction: 'crime',
      showHeat: true,
      depth: 150
    }).create()

    // Loading text - Network style
    this.loadingText = this.add.text(width / 2, height / 2, `${SYMBOLS.system} LOADING OPERATIONS...`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.dim)
    }).setOrigin(0.5)

    // Load crew bonuses and crimes
    try {
      await this.loadCrewData()
      let crimes
      try {
        crimes = await gameManager.getAvailableCrimes()
      } catch (e) {
        console.log('[CrimeScene] API failed, using local crimes')
        crimes = LOCAL_CRIMES
      }
      if (!crimes || crimes.length === 0) {
        crimes = LOCAL_CRIMES
      }
      this.loadingText.destroy()
      this.createActiveEffectsPanel()
      this.createCrewBonusPanel()
      this.createCooldownModifiersPanel()
      this.createCrimeList(crimes)
    } catch (error) {
      console.error('[CrimeScene] Failed to load:', error)
      this.loadingText.destroy()
      this.createCrimeList(LOCAL_CRIMES)
    }
  }

  async loadCrewData() {
    // Always set defaults - crew data not needed for local-only mode
    this.crewBonuses = { violence: 0, cooldown: 0, escape: 0, heat: 0, vehicle: 0 }
    this.crewMembers = []

    // Only try API if not in local mode
    if (!gameManager.useLocalData) {
      try {
        const [bonuses, members] = await Promise.all([
          gameManager.getCrewBonuses().catch(() => null),
          gameManager.getPlayerCrewMembers().catch(() => [])
        ])
        this.crewBonuses = bonuses || this.crewBonuses
        this.crewMembers = members || []
      } catch (e) {
        // Keep defaults
      }
    }
  }

  createBackgroundPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(DEPTH.CONTENT_BASE)

    // Subtle grid pattern for Network aesthetic
    graphics.lineStyle(1, COLORS.network.dark, 0.2)
    const gridSize = 40
    for (let x = 0; x < width; x += gridSize) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.moveTo(0, y)
      graphics.lineTo(width, y)
    }
    graphics.strokePath()

    // Vignette effect (darker edges) - Network style
    const vignette = this.add.graphics().setDepth(DEPTH.CONTENT_BASE)
    vignette.fillStyle(COLORS.bg.void, 0)
    vignette.fillRect(0, 0, width, height)

    // Top and bottom gradients
    for (let i = 0; i < 60; i++) {
      const alpha = (60 - i) / 60 * 0.4
      vignette.fillStyle(COLORS.bg.void, alpha)
      vignette.fillRect(0, i, width, 1)
      vignette.fillRect(0, height - i - 1, width, 1)
    }
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background bar - Network dark panel
    const headerBg = this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(DEPTH.CARDS)

    // Red accent line at bottom of header - danger color
    this.add.rectangle(width / 2, 68, width, 2, COLORS.status.danger, 0.8)
      .setDepth(DEPTH.CARDS)

    // Street Ops icon - Network terminal style
    const icon = this.add.text(width / 2 - 110, 28, '[S]', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Animate icon
    if (this.settings.animationsEnabled) {
      this.tweens.add({
        targets: icon,
        alpha: { from: 1, to: 0.5 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }

    // Title - Network terminal style
    this.add.text(width / 2, 28, 'STREET OPS', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)

    // Subtitle - Network style
    this.add.text(width / 2, 52, `${SYMBOLS.system} SELECT TARGET OPERATION`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5).setDepth(DEPTH.PANELS)
  }

  createSettingsButton() {
    const { width } = this.cameras.main

    // Settings gear button
    const settingsBtn = this.add.text(width - 60, 35, '⚙️', {
      fontSize: '20px'
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON).setInteractive({ useHandCursor: true })

    settingsBtn.on('pointerover', () => {
      settingsBtn.setScale(1.2)
      this.tweens.add({
        targets: settingsBtn,
        angle: 90,
        duration: 300,
        ease: 'Power2'
      })
    })

    settingsBtn.on('pointerout', () => {
      settingsBtn.setScale(1)
      this.tweens.add({
        targets: settingsBtn,
        angle: 0,
        duration: 300,
        ease: 'Power2'
      })
    })

    settingsBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.showSettingsPanel()
    })
  }

  showSettingsPanel() {
    const { width, height } = this.cameras.main

    // Panel overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setDepth(DEPTH.MODAL).setInteractive()

    // Settings panel
    const panel = this.add.rectangle(width / 2, height / 2, 300, 320, 0x1a1a2e, 0.98)
      .setStrokeStyle(2, 0x4b5563)
      .setDepth(DEPTH.MODAL_CONTENT)

    // Panel title
    this.add.text(width / 2, height / 2 - 130, '⚙️ Settings', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Setting options
    const settingsY = height / 2 - 70
    const settingSpacing = 55

    // 1. Hold to Confirm Toggle
    this.createSettingToggle(
      width / 2, settingsY,
      'Hold to Confirm',
      'Require hold for risky crimes',
      this.settings.holdToConfirm,
      (value) => { this.settings.holdToConfirm = value }
    )

    // 2. Touch Sensitivity
    this.createSettingSelector(
      width / 2, settingsY + settingSpacing,
      'Touch Sensitivity',
      ['Low', 'Normal', 'High'],
      this.settings.touchSensitivity === 'low' ? 0 : this.settings.touchSensitivity === 'normal' ? 1 : 2,
      (index) => {
        this.settings.touchSensitivity = ['low', 'normal', 'high'][index]
      }
    )

    // 3. Animations Toggle
    this.createSettingToggle(
      width / 2, settingsY + settingSpacing * 2,
      'Animations',
      'Enable card animations',
      this.settings.animationsEnabled,
      (value) => { this.settings.animationsEnabled = value }
    )

    // 4. Risk Indicator Toggle
    this.createSettingToggle(
      width / 2, settingsY + settingSpacing * 3,
      'Risk Indicator',
      'Show risk/reward bars',
      this.settings.showRiskIndicator,
      (value) => { this.settings.showRiskIndicator = value }
    )

    // Close button
    const closeBtn = this.add.text(width / 2, height / 2 + 130, '✕ Close', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#374151',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT).setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#4b5563' }))
    closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#374151' }))
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      overlay.destroy()
      panel.destroy()
      closeBtn.destroy()
      // Destroy all setting elements (they're auto-destroyed with panel due to depth management)
      this.children.list.filter(c => c.depth >= 502 && c.depth < 510).forEach(c => c.destroy())
      // Refresh scene to apply settings
      this.scene.restart()
    })
  }

  createSettingToggle(x, y, label, description, initialValue, onChange) {
    // Label
    this.add.text(x - 100, y - 10, label, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

    // Description
    this.add.text(x - 100, y + 8, description, {
      fontSize: '10px',
      color: '#888888'
    }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

    // Toggle button
    const toggleBg = this.add.rectangle(x + 90, y, 50, 26, initialValue ? 0x22c55e : 0x374151)
      .setStrokeStyle(1, 0x4b5563)
      .setDepth(DEPTH.MODAL_BUTTONS)
      .setInteractive({ useHandCursor: true })

    const toggleKnob = this.add.circle(initialValue ? x + 102 : x + 78, y, 10, 0xffffff)
      .setDepth(DEPTH.MODAL_BUTTONS)

    let isOn = initialValue

    toggleBg.on('pointerdown', () => {
      isOn = !isOn
      audioManager.playClick()

      this.tweens.add({
        targets: toggleKnob,
        x: isOn ? x + 102 : x + 78,
        duration: 150,
        ease: 'Power2'
      })

      toggleBg.setFillStyle(isOn ? 0x22c55e : 0x374151)
      onChange(isOn)
    })
  }

  createSettingSelector(x, y, label, options, initialIndex, onChange) {
    // Label
    this.add.text(x - 100, y - 10, label, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_BUTTONS)

    // Options
    let selectedIndex = initialIndex
    const optionTexts = []

    options.forEach((option, index) => {
      const optX = x + 30 + index * 55
      const isSelected = index === selectedIndex

      const optBg = this.add.rectangle(optX, y + 8, 50, 24, isSelected ? 0x3b82f6 : 0x374151)
        .setStrokeStyle(1, isSelected ? 0x60a5fa : 0x4b5563)
        .setDepth(DEPTH.MODAL_BUTTONS)
        .setInteractive({ useHandCursor: true })

      const optText = this.add.text(optX, y + 8, option, {
        fontSize: '10px',
        color: isSelected ? '#ffffff' : '#888888'
      }).setOrigin(0.5).setDepth(DEPTH.MODAL_BUTTONS)

      optionTexts.push({ bg: optBg, text: optText, index })

      optBg.on('pointerdown', () => {
        audioManager.playClick()
        selectedIndex = index

        // Update all options
        optionTexts.forEach(opt => {
          const isNowSelected = opt.index === selectedIndex
          opt.bg.setFillStyle(isNowSelected ? 0x3b82f6 : 0x374151)
          opt.bg.setStrokeStyle(1, isNowSelected ? 0x60a5fa : 0x4b5563)
          opt.text.setColor(isNowSelected ? '#ffffff' : '#888888')
        })

        onChange(selectedIndex)
      })
    })
  }

  createActiveEffectsPanel() {
    const { width } = this.cameras.main

    // Get active effects from gameManager (set by GameScene)
    const activeEffects = gameManager.activeEffects || []

    // Filter for crime-relevant effects
    const relevantEffects = activeEffects.filter(e =>
      ['cash', 'xp', 'success', 'heat', 'bonus'].includes(e.type)
    )

    if (relevantEffects.length === 0) {
      this.effectsPanelHeight = 0
      return
    }

    // Panel position - below stats bar
    const statsBarHeight = this.statsBar ? this.statsBar.getHeight() : 0
    const panelY = 70 + statsBarHeight + 5
    const panelHeight = 35
    this.effectsPanelHeight = panelHeight + 5

    // Panel background - Network style
    this.effectsPanel = this.add.rectangle(width / 2, panelY + panelHeight / 2, width - 40, panelHeight, COLORS.bg.panel, 0.95)
    this.effectsPanel.setStrokeStyle(BORDERS.thin, 0x8b5cf6, 0.6)

    // Label - Network terminal style
    this.add.text(30, panelY + 8, `${SYMBOLS.system} ACTIVE EFFECTS`, {
      ...getTextStyle('xs', 0x8b5cf6, 'terminal'),
      fontStyle: 'bold'
    })

    // Effect chips - Network style
    let chipX = 130
    relevantEffects.slice(0, 4).forEach((effect) => {
      const isPositive = effect.value >= 0
      const color = isPositive ? COLORS.status.success : COLORS.status.danger

      // Chip background - Network style
      const chipBg = this.add.rectangle(chipX + 30, panelY + panelHeight / 2, 60, 22, COLORS.bg.void, 0.9)
      chipBg.setStrokeStyle(BORDERS.thin, color, 0.6)

      // Effect text - Network terminal style
      const valueStr = effect.value > 0 ? `+${effect.value}` : effect.value
      const suffix = effect.type === 'bonus' ? 'x' : '%'
      this.add.text(chipX + 30, panelY + panelHeight / 2, `${valueStr}${suffix}`, {
        ...getTextStyle('xs', color, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(0.5)

      chipX += 68
    })

    // More indicator - Network style
    if (relevantEffects.length > 4) {
      this.add.text(chipX + 10, panelY + panelHeight / 2, `+${relevantEffects.length - 4}`, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0, 0.5)
    }
  }

  getEffectIcon(effectType) {
    // Network terminal-style icons (not used anymore, but kept for compatibility)
    const icons = {
      cash: SYMBOLS.cash,
      xp: '+',
      heat: SYMBOLS.heat,
      bonus: 'x',
      success: '%',
      cooldown: '-'
    }
    return icons[effectType] || '?'
  }

  createCrewBonusPanel() {
    const { width } = this.cameras.main

    // Account for stats bar height
    const statsBarHeight = this.statsBar ? this.statsBar.getHeight() : 0
    const baseY = 70 + statsBarHeight + 5

    // Only show if there are active bonuses
    const hasActiveBonuses = this.crewMembers.length > 0 &&
      (this.crewBonuses.violence > 0 || this.crewBonuses.cooldown > 0 ||
       this.crewBonuses.escape > 0 || this.crewBonuses.heat > 0 ||
       this.crewBonuses.vehicle > 0)

    if (!hasActiveBonuses) {
      // Still set crime list start Y based on effects panel
      if (this.effectsPanelHeight > 0) {
        this.crimeListStartY = baseY + this.effectsPanelHeight + 10
      } else {
        this.crimeListStartY = baseY + 5
      }
      return
    }

    // Panel background - Network style
    const panelY = baseY + (this.effectsPanelHeight || 0)
    const panelHeight = 45
    this.crewPanel = this.add.rectangle(width / 2, panelY + panelHeight / 2, width - 40, panelHeight, COLORS.bg.panel, 0.95)
    this.crewPanel.setStrokeStyle(BORDERS.thin, 0x06b6d4, 0.6)

    // Crew icons - Network terminal style
    const roleIcons = {
      enforcer: '[E]',
      hacker: '[H]',
      driver: '[D]',
      lookout: '[L]'
    }

    let iconX = 30
    this.crewMembers.forEach((member) => {
      const icon = roleIcons[member.role] || '[?]'
      const iconText = this.add.text(iconX, panelY + 15, icon, {
        ...getTerminalStyle('sm'),
        color: toHexString(0x06b6d4)
      })
      iconX += 35
    })

    // Bonus summary text - Network style
    const bonusStrings = []
    if (this.crewBonuses.violence > 0) bonusStrings.push(`+${this.crewBonuses.violence}% SUCCESS`)
    if (this.crewBonuses.cooldown > 0) bonusStrings.push(`-${this.crewBonuses.cooldown}% CD`)
    if (this.crewBonuses.heat > 0) bonusStrings.push(`-${this.crewBonuses.heat}% HEAT`)
    if (this.crewBonuses.escape > 0) bonusStrings.push(`+${this.crewBonuses.escape}% ESCAPE`)

    const bonusText = bonusStrings.join(` ${SYMBOLS.system} `)
    this.add.text(iconX + 10, panelY + 15, bonusText, {
      ...getTextStyle('xs', COLORS.status.success, 'terminal')
    })

    // Adjust crime list start position
    this.crimeListStartY = panelY + panelHeight + 15
  }

  createCooldownModifiersPanel() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Get cooldown modifiers for display
    const modifiers = getCooldownModifiersText(player, null) // null = generic view

    if (modifiers.length === 0) return 0

    // Panel position
    const panelY = this.crimeListStartY || 180
    const panelHeight = 30

    // Panel background
    this.cooldownPanel = this.add.rectangle(width / 2, panelY + panelHeight / 2, width - 40, panelHeight, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0xf59e0b, 0.4)
      .setDepth(DEPTH.CARDS)

    // Label
    this.add.text(30, panelY + panelHeight / 2, `${SYMBOLS.system} COOLDOWN`, {
      ...getTextStyle('xs', 0xf59e0b, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANELS)

    // Modifier chips
    let chipX = 110
    modifiers.forEach(mod => {
      const chipText = this.add.text(chipX, panelY + panelHeight / 2, mod.text, {
        ...getTextStyle('xs', mod.color, 'terminal')
      }).setOrigin(0, 0.5).setDepth(DEPTH.PANELS)
      chipX += chipText.width + 12
    })

    // Update crime list start
    this.crimeListStartY = panelY + panelHeight + 10

    return panelHeight + 10
  }

  createCloseButton() {
    const { width } = this.cameras.main

    // Create close button with Network theme - high depth to ensure it's always clickable
    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.primary)
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)  // Always on top
    .setInteractive({ useHandCursor: true })

    // Visual feedback - Network style
    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.status.danger))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.primary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[CrimeScene] Close button clicked')
      audioManager.playClick()
      this.closeScene()
    })
  }

  createCrimeList(crimes) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || {}
    const playerLevel = player.level || 1  // Default to level 1 if not set
    // Account for stats bar height in default start position
    const statsBarHeight = this.statsBar ? this.statsBar.getHeight() : 0
    const startY = this.crimeListStartY || (70 + statsBarHeight + 15)
    const itemHeight = 85  // Compact card height for more crimes

    console.log('[CrimeScene] createCrimeList called')
    console.log('[CrimeScene] Crimes received:', crimes?.length || 0, crimes)
    console.log('[CrimeScene] Player level:', playerLevel)

    // Handle case where crimes is undefined or empty
    if (!crimes || crimes.length === 0) {
      console.log('[CrimeScene] No crimes array provided, using local database')
      crimes = LOCAL_CRIMES
    }

    // Separate available and locked crimes
    const availableCrimes = crimes.filter(c => {
      const crimeLevel = c.min_level || c.required_level || 1
      return crimeLevel <= playerLevel
    })

    const lockedCrimes = crimes.filter(c => {
      const crimeLevel = c.min_level || c.required_level || 1
      return crimeLevel > playerLevel
    })

    console.log('[CrimeScene] Available crimes:', availableCrimes.length, 'Locked:', lockedCrimes.length)

    this.crimeCards = []

    // Calculate how many crimes fit on screen
    const availableHeight = height - startY - 60
    const maxVisible = Math.floor(availableHeight / itemHeight)

    // Adjust item height based on risk indicator setting
    const actualItemHeight = this.settings.showRiskIndicator ? 95 : itemHeight

    // Show ALL available crimes first (scrollable if needed)
    let currentY = startY
    availableCrimes.forEach((crime, index) => {
      if (currentY + actualItemHeight < height - 40) {
        console.log(`[CrimeScene] Rendering crime ${index}: ${crime.name} at Y=${currentY}`)
        this.createCrimeCard(crime, currentY, index)
        currentY += actualItemHeight
      }
    })

    // Then show some locked crimes as preview (if space permits)
    const remainingSpace = height - currentY - 60
    const lockedToShow = Math.min(lockedCrimes.length, Math.floor(remainingSpace / actualItemHeight))

    if (lockedToShow > 0) {
      lockedCrimes.slice(0, lockedToShow).forEach((crime, index) => {
        if (currentY + actualItemHeight < height - 40) {
          this.createLockedCrimeCard(crime, currentY, availableCrimes.length + index)
          currentY += actualItemHeight
        }
      })
    }

    // If no crimes available at all - Network style
    if (availableCrimes.length === 0) {
      this.add.text(width / 2, height / 2 - 50, `${SYMBOLS.system} NO OPERATIONS AVAILABLE`, {
        ...getTerminalStyle('lg'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.CARDS)

      this.add.text(width / 2, height / 2 - 20, 'GAIN EXPERIENCE TO UNLOCK MORE ACTIVITIES', {
        ...getTextStyle('sm', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.CARDS)
    }
  }

  createLockedCrimeCard(crime, y, index = 0) {
    const { width } = this.cameras.main
    const minLevel = crime.min_level || crime.required_level || 1

    // Adjust card height to match
    const cardHeight = this.settings.showRiskIndicator ? 82 : 68
    const cardY = y + cardHeight / 2 + 4

    // Locked card background - Network style
    const card = this.add.rectangle(width / 2, cardY, width - 40, cardHeight, COLORS.bg.panel, 0.5)
      .setStrokeStyle(1, COLORS.text.muted, 0.3)
      .setDepth(DEPTH.CARDS)

    // Entrance animation
    if (this.settings.animationsEnabled) {
      card.setAlpha(0).setScale(0.95)
      this.tweens.add({
        targets: card,
        alpha: 0.8,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        delay: index * 50,
        ease: 'Back.easeOut'
      })
    }

    // Locked icon and name - Network style
    this.add.text(45, cardY - 10, '[X]', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANELS).setAlpha(0.4)
    this.add.text(70, cardY - 10, crime.name, {
      ...getTextStyle('md', COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANELS)

    // Level requirement with progress hint
    const player = gameManager.player || {}
    const playerLevel = player.level || 1
    const levelsNeeded = minLevel - playerLevel

    this.add.text(70, cardY + 10, `${SYMBOLS.system} REQUIRES LVL ${minLevel} (+${levelsNeeded})`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANELS)

    // Progress bar to unlock - Network style
    const progressWidth = 80
    const progress = Math.min(1, playerLevel / minLevel)
    this.add.rectangle(width - 70, cardY, progressWidth, 8, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.text.muted, 0.3)
      .setDepth(DEPTH.PANELS)
    this.add.rectangle(width - 70 - (progressWidth / 2) + (progressWidth * progress / 2), cardY, progressWidth * progress, 8, COLORS.status.neutral)
      .setDepth(DEPTH.PANEL_CONTENT)

    this.crimeCards.push(card)
  }

  createCrimeCard(crime, y, index = 0) {
    const { width } = this.cameras.main
    const player = gameManager.player || {}

    // Check if player has enough energy/stamina
    const playerEnergy = player.energy || player.stamina || 100
    const energyCost = crime.energy_cost || crime.stamina_cost || 5
    const canAttempt = playerEnergy >= energyCost

    // Crime category colors - Network theme style
    const categoryColors = {
      petty: { bg: COLORS.bg.card, border: COLORS.network.primary, riskLevel: 1 },       // Green - low risk
      theft: { bg: COLORS.bg.card, border: COLORS.status.info, riskLevel: 2 },           // Blue - property crimes
      violent: { bg: COLORS.bg.card, border: COLORS.status.danger, riskLevel: 4 },       // Red - violent/robbery
      vehicle: { bg: COLORS.bg.card, border: COLORS.status.warning, riskLevel: 3 },      // Orange - vehicle crimes
      fraud: { bg: COLORS.bg.card, border: 0x06b6d4, riskLevel: 2 },                     // Cyan - con artist
      drugs: { bg: COLORS.bg.card, border: 0xa855f7, riskLevel: 3 },                     // Purple - drug ops
      organized: { bg: COLORS.bg.card, border: COLORS.cred.gold, riskLevel: 5 },         // Gold - organized crime
      cyber: { bg: COLORS.bg.card, border: COLORS.network.glow, riskLevel: 3 },          // Matrix green - hacking
      classic: { bg: COLORS.bg.card, border: COLORS.cred.bronze, riskLevel: 3 },         // Bronze - old school
      territory: { bg: COLORS.bg.card, border: 0xef4444, riskLevel: 5 },                 // Crimson - turf wars
      whitecollar: { bg: COLORS.bg.card, border: 0x3b82f6, riskLevel: 2 },               // Royal blue - corporate crime
      vice: { bg: COLORS.bg.card, border: 0xec4899, riskLevel: 3 },                      // Pink - vice & gambling
      default: { bg: COLORS.bg.card, border: COLORS.status.neutral, riskLevel: 2 }
    }

    // Use tier from crime data, or determine from name as fallback
    let category = crime.tier || 'default'
    if (category === 'default') {
      // Fallback: determine category from crime name
      const crimeName = crime.name.toLowerCase()
      if (crimeName.includes('pickpocket') || crimeName.includes('shoplift') || crimeName.includes('snatch') || crimeName.includes('dash') || crimeName.includes('scam')) category = 'petty'
      else if (crimeName.includes('burglary') || crimeName.includes('break') || crimeName.includes('skim') || crimeName.includes('theft') && !crimeName.includes('car')) category = 'theft'
      else if (crimeName.includes('mug') || crimeName.includes('assault') || crimeName.includes('rob') || crimeName.includes('strong')) category = 'violent'
      else if (crimeName.includes('car') || crimeName.includes('vehicle') || crimeName.includes('jack') || crimeName.includes('truck') || crimeName.includes('chop')) category = 'vehicle'
      else if (crimeName.includes('fraud') || crimeName.includes('identity') || crimeName.includes('rental') || crimeName.includes('insurance') || crimeName.includes('romance')) category = 'fraud'
      else if (crimeName.includes('drug') || crimeName.includes('deal') || crimeName.includes('mule') || crimeName.includes('stash') || crimeName.includes('corner boss')) category = 'drugs'
      else if (crimeName.includes('heist') || crimeName.includes('launder') || crimeName.includes('smuggl') || crimeName.includes('fence')) category = 'organized'
      else if (crimeName.includes('hack') || crimeName.includes('phish') || crimeName.includes('cyber') || crimeName.includes('ransom') || crimeName.includes('crypto') || crimeName.includes('sim')) category = 'cyber'
      else if (crimeName.includes('monte') || crimeName.includes('shell') || crimeName.includes('counterfeit') || crimeName.includes('safe crack') || crimeName.includes('forgery')) category = 'classic'
      // New category fallbacks
      else if (crimeName.includes('turf') || crimeName.includes('gang') || crimeName.includes('territory') || crimeName.includes('drive-by') || crimeName.includes('collection run')) category = 'territory'
      else if (crimeName.includes('embezzle') || crimeName.includes('stock') || crimeName.includes('tax') || crimeName.includes('brib') || crimeName.includes('blackmail') || crimeName.includes('ponzi') || crimeName.includes('insider') || crimeName.includes('espionage')) category = 'whitecollar'
      else if (crimeName.includes('poker') || crimeName.includes('dice') || crimeName.includes('fight club') || crimeName.includes('escort') || crimeName.includes('speakeasy') || crimeName.includes('bootleg')) category = 'vice'
    }

    const catStyle = categoryColors[category]
    const isHighRisk = catStyle.riskLevel >= 4

    // Adjust card height based on risk indicator setting
    const cardHeight = this.settings.showRiskIndicator ? 82 : 72
    const cardY = y + cardHeight / 2 + 4

    // Crime card background - Network style
    const cardBg = canAttempt ? catStyle.bg : COLORS.bg.panel
    const card = this.add.rectangle(width / 2, cardY, width - 40, cardHeight, cardBg, canAttempt ? 0.95 : 0.5)
      .setDepth(DEPTH.CARDS)

    // Entrance animation
    if (this.settings.animationsEnabled) {
      card.setAlpha(0).setScale(0.95)
      this.tweens.add({
        targets: card,
        alpha: canAttempt ? 0.95 : 0.6,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        delay: index * 50,
        ease: 'Back.easeOut'
      })
    }

    // Left accent bar with glow effect for high-risk crimes - Network style
    const accentBar = this.add.rectangle(30, cardY, 4, cardHeight - 8, canAttempt ? catStyle.border : COLORS.text.muted)
      .setDepth(DEPTH.PANELS)

    // Glow effect for high-risk crimes
    if (canAttempt && isHighRisk) {
      const glow = this.add.rectangle(30, cardY, 8, cardHeight - 8, catStyle.border, 0.3)
        .setDepth(DEPTH.CARDS)
      if (this.settings.animationsEnabled) {
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.3, to: 0.1 },
          duration: 800,
          yoyo: true,
          repeat: -1
        })
      }
    }

    // Touch area size based on sensitivity
    const touchPadding = this.settings.touchSensitivity === 'low' ? 15 :
                         this.settings.touchSensitivity === 'high' ? 5 : 10

    if (canAttempt) {
      card.setStrokeStyle(BORDERS.thin, catStyle.border, 0.5)
        .setInteractive({
          useHandCursor: true,
          hitArea: new Phaser.Geom.Rectangle(
            -touchPadding, -touchPadding,
            width - 40 + touchPadding * 2,
            cardHeight + touchPadding * 2
          ),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains
        })

      card.on('pointerover', () => {
        if (this.settings.animationsEnabled) {
          card.setFillStyle(Phaser.Display.Color.ValueToColor(catStyle.bg).lighten(15).color, 1)
          card.setStrokeStyle(BORDERS.medium, catStyle.border, 0.8)
          accentBar.setFillStyle(Phaser.Display.Color.ValueToColor(catStyle.border).lighten(20).color)

          this.tweens.add({
            targets: [card, accentBar],
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 80
          })
        } else {
          card.setStrokeStyle(BORDERS.medium, catStyle.border, 0.8)
        }
      })

      card.on('pointerout', () => {
        // Cancel hold if dragging out
        this.cancelHold()

        if (this.settings.animationsEnabled) {
          card.setFillStyle(catStyle.bg, 0.95)
          card.setStrokeStyle(BORDERS.thin, catStyle.border, 0.5)
          accentBar.setFillStyle(catStyle.border)

          this.tweens.add({
            targets: [card, accentBar],
            scaleX: 1,
            scaleY: 1,
            duration: 80
          })
        } else {
          card.setStrokeStyle(BORDERS.thin, catStyle.border, 0.5)
        }
      })

      card.on('pointerdown', (pointer) => {
        // Hold-to-confirm for high-risk crimes
        if (this.settings.holdToConfirm && isHighRisk) {
          this.startHold(crime, card, cardY, catStyle.border)
        } else {
          // Quick press effect
          if (this.settings.animationsEnabled) {
            this.tweens.add({
              targets: card,
              scaleX: 0.98,
              scaleY: 0.98,
              duration: 50,
              yoyo: true,
              onComplete: () => this.attemptCrime(crime)
            })
          } else {
            this.attemptCrime(crime)
          }
        }
      })

      card.on('pointerup', () => {
        if (this.settings.holdToConfirm && isHighRisk) {
          this.cancelHold()
        }
      })
    } else {
      card.setStrokeStyle(BORDERS.thin, COLORS.text.muted, 0.3)
    }

    // Category icon - Network terminal style with brackets
    const terminalIcons = {
      petty: '[C]',        // Common crimes
      theft: '[T]',        // Theft
      violent: '[!]',      // Danger/Alert
      vehicle: '[V]',      // Vehicle
      fraud: '[F]',        // Fraud
      drugs: '[D]',        // Drugs
      organized: '[O]',    // Organized
      cyber: '[H]',        // Hacking
      classic: '[K]',      // Klassic
      default: '[?]'
    }

    const iconText = terminalIcons[category] || terminalIcons.default
    this.add.text(50, cardY - 12, iconText, {
      ...getTerminalStyle('md'),
      color: toHexString(canAttempt ? catStyle.border : COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT).setAlpha(canAttempt ? 1 : 0.4)

    // Crime name - Network terminal style
    this.add.text(78, cardY - 22, crime.name.toUpperCase(), {
      ...getTextStyle('md', canAttempt ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANELS)

    // Description (if available) - Network style
    if (crime.description) {
      this.add.text(78, cardY - 2, `${SYMBOLS.system} ${crime.description.substring(0, 35)}${crime.description.length > 35 ? '...' : ''}`, {
        ...getTextStyle('xs', canAttempt ? COLORS.text.secondary : COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.PANELS)
    }

    // Calculate success rate with crew bonuses
    let baseSuccessRate = crime.base_success_rate || 50
    let crewBonus = 0

    if (this.crewBonuses) {
      // Apply violence bonus for violent crimes
      const isViolentCrime = ['mugging', 'robbery', 'assault', 'carjacking'].some(
        v => crime.name.toLowerCase().includes(v)
      )
      if (isViolentCrime && this.crewBonuses.violence > 0) {
        crewBonus += this.crewBonuses.violence
      }

      // Apply vehicle bonus for vehicle crimes
      const isVehicleCrime = ['carjacking', 'getaway', 'driver', 'vehicle'].some(
        v => crime.name.toLowerCase().includes(v)
      )
      if (isVehicleCrime && this.crewBonuses.vehicle > 0) {
        crewBonus += this.crewBonuses.vehicle
      }
    }

    const modifiedSuccessRate = Math.min(95, baseSuccessRate + crewBonus)
    const hasCrewBonus = crewBonus > 0

    // Stats pills at bottom of card
    const statsY = cardY + 18
    let statsX = 45

    // Success rate pill - Network style
    const successColor = modifiedSuccessRate >= 70 ? COLORS.status.success : modifiedSuccessRate >= 50 ? COLORS.status.warning : COLORS.status.danger
    const successPillWidth = hasCrewBonus ? 95 : 65
    this.add.rectangle(statsX + successPillWidth / 2, statsY, successPillWidth, 18, COLORS.bg.void, 0.9)
      .setStrokeStyle(1, successColor, 0.5).setDepth(DEPTH.PANELS)

    const successText = hasCrewBonus
      ? `${baseSuccessRate}→${modifiedSuccessRate}%`
      : `${modifiedSuccessRate}%`
    this.add.text(statsX + successPillWidth / 2, statsY, successText, {
      ...getTextStyle('xs', canAttempt ? successColor : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    statsX += successPillWidth + 8

    // Energy pill - Network style
    const energyPillWidth = 55
    this.add.rectangle(statsX + energyPillWidth / 2, statsY, energyPillWidth, 18, COLORS.bg.void, 0.9)
      .setStrokeStyle(1, COLORS.status.info, 0.5).setDepth(DEPTH.PANELS)
    this.add.text(statsX + energyPillWidth / 2, statsY, `-${energyCost}`, {
      ...getTextStyle('xs', canAttempt ? COLORS.status.info : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Right side: Reward display - Network style
    const reward = crime.base_cash_reward || crime.max_payout || 0
    const rewardBg = this.add.rectangle(width - 55, cardY - 6, 85, 36, COLORS.bg.void, 0.9)
      .setStrokeStyle(1, COLORS.text.gold, canAttempt ? 0.6 : 0.2).setDepth(DEPTH.PANELS)

    this.add.text(width - 55, cardY - 15, SYMBOLS.cash, {
      ...getTerminalStyle('md'),
      color: toHexString(canAttempt ? COLORS.text.gold : COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.add.text(width - 55, cardY + 4, formatMoney(reward), {
      ...getTextStyle('md', canAttempt ? COLORS.text.gold : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Heat indicator
    let heatGain = crime.heat_gain || crime.heat_generated || 0
    let displayHeat = heatGain
    let hasHeatReduction = false

    if (this.crewBonuses && this.crewBonuses.heat > 0) {
      const reducedHeat = Math.floor(heatGain * (1 - this.crewBonuses.heat / 100))
      if (reducedHeat < heatGain) {
        hasHeatReduction = true
        displayHeat = reducedHeat
      }
    }

    const heatColor = heatGain > 10 ? COLORS.status.danger : heatGain > 5 ? 0xf97316 : COLORS.status.warning
    this.add.text(width - 60, cardY + 20, hasHeatReduction ? `+${heatGain}→${displayHeat}` : `+${heatGain}`, {
      ...getTextStyle('xs', canAttempt ? (hasHeatReduction ? COLORS.status.info : heatColor) : COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Mini-game indicator badge - Network style
    if (this.miniGameManager && this.miniGameManager.hasMiniGame(crime.name)) {
      const minigameBadge = this.add.rectangle(width - 95, cardY - 22, 40, 16, COLORS.bg.void, 0.9)
        .setStrokeStyle(1, 0xa855f7, 0.6).setDepth(DEPTH.PANELS)
      this.add.text(width - 95, cardY - 22, '[M]', {
        ...getTextStyle('xs', 0xa855f7, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    }

    // Risk/Reward indicator bar (if enabled) - Network style
    if (this.settings.showRiskIndicator && canAttempt) {
      const riskBarY = cardY + 32
      const riskBarWidth = width - 80

      // Background bar
      this.add.rectangle(width / 2, riskBarY, riskBarWidth, 6, COLORS.bg.void)
        .setDepth(DEPTH.PANELS)

      // Risk portion (red, from left)
      const riskPercent = Math.min(1, (100 - modifiedSuccessRate) / 100)
      const riskWidth = riskBarWidth * riskPercent * 0.5
      if (riskWidth > 0) {
        this.add.rectangle(40 + riskWidth / 2, riskBarY, riskWidth, 6, COLORS.status.danger, 0.8)
          .setDepth(DEPTH.PANEL_CONTENT)
      }

      // Reward portion (gold, from right)
      const rewardPercent = Math.min(1, reward / 2000) // Normalize to max 2000
      const rewardWidth = riskBarWidth * rewardPercent * 0.5
      if (rewardWidth > 0) {
        this.add.rectangle(width - 40 - rewardWidth / 2, riskBarY, rewardWidth, 6, COLORS.text.gold, 0.8)
          .setDepth(DEPTH.PANEL_CONTENT)
      }

      // Labels - Network terminal style
      this.add.text(40, riskBarY, 'RISK', {
        ...getTextStyle('xs', COLORS.status.danger, 'terminal')
      }).setOrigin(0, 0.5).setDepth(DEPTH.STATS_BAR)

      this.add.text(width - 40, riskBarY, 'REWARD', {
        ...getTextStyle('xs', COLORS.text.gold, 'terminal')
      }).setOrigin(1, 0.5).setDepth(DEPTH.STATS_BAR)
    }

    this.crimeCards.push(card)
  }

  // Hold-to-confirm for risky crimes
  startHold(crime, card, cardY, borderColor) {
    const { width } = this.cameras.main

    this.isHolding = true

    // Create progress bar overlay
    this.holdProgress = this.add.rectangle(width / 2, cardY, 0, 8, borderColor, 0.8)
      .setDepth(DEPTH.MODAL_BACKDROP)

    // Progress animation
    this.tweens.add({
      targets: this.holdProgress,
      width: width - 60,
      duration: this.settings.holdDuration,
      ease: 'Linear',
      onComplete: () => {
        if (this.isHolding) {
          this.cancelHold()
          this.attemptCrime(crime)
        }
      }
    })

    // Visual feedback on card
    card.setStrokeStyle(3, borderColor, 1)

    // Hold text
    this.holdText = this.add.text(width / 2, cardY - 20, '⏳ Hold to confirm...', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(DEPTH.MODAL)
  }

  cancelHold() {
    this.isHolding = false

    if (this.holdProgress) {
      this.tweens.killTweensOf(this.holdProgress)
      this.holdProgress.destroy()
      this.holdProgress = null
    }

    if (this.holdText) {
      this.holdText.destroy()
      this.holdText = null
    }
  }

  async attemptCrime(crime) {
    // Check cooldown first
    if (gameManager.isOnCooldown('crime')) {
      if (this.statsBar) {
        this.statsBar.showCooldownWarning()
      }
      audioManager.playMiss()
      return
    }

    const player = gameManager.player
    const playerEnergy = player.energy || player.stamina || 0
    const energyCost = crime.energy_cost || crime.stamina_cost || 0

    // Check if player is on parole - show warning
    if (player.on_parole && player.parole_until && !this.paroleWarningShown) {
      const paroleEnd = new Date(player.parole_until).getTime()
      if (Date.now() < paroleEnd) {
        this.showParoleWarning(crime)
        return
      }
    }
    // Reset parole warning flag after proceeding
    this.paroleWarningShown = false

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

    // Store the pending crime for when mini-game returns (both locally and in registry for scene restarts)
    this.pendingCrime = crime
    this.registry.set('pendingCrime', crime)

    // Use the crime.id directly (it's already in correct format like 'pickpocket', 'mugging')
    // Also try normalized crime name as fallback
    const crimeId = crime.id || crime.name.toLowerCase().replace(/\s+/g, '_')

    console.log('[CrimeScene] Attempting crime:', crimeId, 'has_minigame:', crime.has_minigame)

    // Check if this crime should have a minigame (database flag OR mapping exists)
    const hasMinigame = crime.has_minigame || this.miniGameManager.hasMiniGame(crimeId)

    if (hasMinigame) {
      // Try to start mini-game
      const started = this.miniGameManager.startGame(
        crimeId,
        player.level,
        'CrimeScene',
        (result) => this.onMiniGameComplete(result, crime)
      )

      if (started) {
        console.log('[CrimeScene] Mini-game started for:', crimeId)
        return // Mini-game will handle the rest
      } else {
        console.warn('[CrimeScene] Mini-game failed to start for:', crimeId)
      }
    }

    // No mini-game for this crime (or failed to start), execute directly
    this.pendingCrime = null
    this.registry.remove('pendingCrime')
    try {
      const result = await gameManager.commitCrime(crime.id)
      this.showResult(result, crime)

      // Check achievements and trigger random event
      this.checkAchievements()
      this.triggerRandomEvent()
    } catch (error) {
      console.error('[CrimeScene] API failed, executing locally:', error)
      const result = this.executeCrimeLocally(crime)
      this.showResult(result, crime)
      this.triggerRandomEvent()
    }
  }

  // Execute crime with local storage only (no API)
  executeCrimeLocally(crime) {
    const player = gameManager.player || getPlayerData() || {}
    const energyCost = crime.energy_cost || crime.stamina_cost || 5

    // Deduct energy
    player.energy = Math.max(0, (player.energy || 100) - energyCost)

    // Get time-of-day modifier
    const timeModifier = getCurrentTimeModifier()
    const baseSuccessRate = crime.base_success_rate || 50
    const baseHeat = crime.heat_gain || 5

    // Apply time modifier to success and heat
    const timeAdjusted = applyTimeModifierToCrime(baseSuccessRate, baseHeat)

    // Get district effects
    const districtId = player.current_district_id || 'parkdale'
    const districtEffects = getDistrictEffects(player, districtId)

    // Get active world event effects
    const eventEffects = getActiveEventEffects(player)

    // Calculate success with crew bonuses + time modifier + district effects + world events
    // Track breakdown for explanation display
    const breakdown = {
      baseRate: baseSuccessRate,
      factors: []
    }

    let successRate = timeAdjusted.adjustedSuccess

    // Time modifier
    const timeDiff = timeAdjusted.adjustedSuccess - baseSuccessRate
    if (timeDiff !== 0) {
      breakdown.factors.push({
        name: `${timeAdjusted.periodIcon} ${timeAdjusted.periodName}`,
        value: timeDiff,
        type: timeDiff > 0 ? 'bonus' : 'penalty'
      })
    }

    // Crew bonuses
    if (this.crewBonuses) {
      if (this.crewBonuses.violence > 0) {
        successRate += this.crewBonuses.violence
        breakdown.factors.push({
          name: 'Crew Violence Bonus',
          value: this.crewBonuses.violence,
          type: 'bonus'
        })
      }
    }

    // District penalty
    if (districtEffects.crimeSuccessPenalty > 0) {
      const penalty = Math.floor(successRate * districtEffects.crimeSuccessPenalty)
      successRate *= (1 - districtEffects.crimeSuccessPenalty)
      breakdown.factors.push({
        name: 'High District Heat',
        value: -penalty,
        type: 'penalty'
      })
    }

    // World event modifier
    if (eventEffects.crimeSuccess) {
      const eventBonus = Math.floor(successRate * eventEffects.crimeSuccess)
      successRate *= (1 + eventEffects.crimeSuccess)
      breakdown.factors.push({
        name: 'World Event',
        value: eventBonus,
        type: eventBonus > 0 ? 'bonus' : 'penalty'
      })
    }

    breakdown.finalRate = Math.min(95, successRate)
    successRate = breakdown.finalRate

    const roll = Math.random() * 100
    const success = roll < successRate

    // Store roll info for explanation
    breakdown.roll = Math.floor(roll)
    breakdown.needed = Math.floor(successRate)

    let result = {
      success,
      cash_earned: 0,
      xp_earned: 0,
      heat_gained: 0,
      leveled_up: false,
      jailed: false,
      message: '',
      timeOfDay: timeAdjusted.periodName,
      timeIcon: timeAdjusted.periodIcon,
      breakdown  // Add breakdown to result
    }

    if (success) {
      // Calculate witness outcome
      const witnessOutcome = calculateWitnessOutcome(player, crime, timeAdjusted.periodName)
      result.witnessOutcome = witnessOutcome

      // Calculate rewards (with witness XP modifier)
      const minPayout = crime.min_payout || 50
      const maxPayout = crime.max_payout || 200
      result.cash_earned = Math.floor(minPayout + Math.random() * (maxPayout - minPayout))
      const baseXP = crime.xp_reward || Math.floor(result.cash_earned * 0.1)
      result.xp_earned = Math.floor(baseXP * witnessOutcome.xpBonus)

      // Apply heat with time modifier, crew bonuses, witness modifier, and world events
      let heatGain = timeAdjusted.adjustedHeat
      if (this.crewBonuses && this.crewBonuses.heat > 0) {
        heatGain = Math.floor(heatGain * (1 - this.crewBonuses.heat / 100))
      }
      // Apply witness heat multiplier
      heatGain = Math.floor(heatGain * witnessOutcome.heatMultiplier)
      // Apply world event heat modifier
      if (eventEffects.heatGain) {
        heatGain = Math.floor(heatGain * (1 + eventEffects.heatGain))
      }
      result.heat_gained = heatGain

      // Apply world event XP modifier
      if (eventEffects.xpGain) {
        result.xp_earned = Math.floor(result.xp_earned * (1 + eventEffects.xpGain))
      }

      // Apply world event cash modifier
      if (eventEffects.cashGain) {
        result.cash_earned = Math.floor(result.cash_earned * (1 + eventEffects.cashGain))
      }

      // Add heat to current district (handles district modifiers automatically)
      const districtId = player.current_district_id || 'parkdale'
      const districtHeatResult = addDistrictHeat(player, districtId, heatGain)
      result.district_heat = districtHeatResult

      // Update player
      player.cash = (player.cash || 0) + result.cash_earned
      player.totalEarnings = (player.totalEarnings || 0) + result.cash_earned
      player.xp = (player.xp || 0) + result.xp_earned
      // Global heat is now managed by addDistrictHeat
      player.crimes_committed = (player.crimes_committed || 0) + 1
      player.successful_crimes = (player.successful_crimes || 0) + 1

      // Track clean executions
      if (witnessOutcome.outcome === 'clean') {
        player.clean_crimes = (player.clean_crimes || 0) + 1
      }

      // Track time-based crimes for achievements
      if (timeAdjusted.periodName === 'night') {
        player.night_crimes = (player.night_crimes || 0) + 1
      } else if (timeAdjusted.periodName === 'morning') {
        player.morning_crimes = (player.morning_crimes || 0) + 1
      }

      // Track high-police district crimes (police_presence >= 4)
      const currentDistrict = DISTRICTS.find(d => d.id === districtId)
      if (currentDistrict && currentDistrict.police_presence >= 4) {
        player.crimes_high_police = (player.crimes_high_police || 0) + 1
      }

      // Track Port Lands crimes
      if (districtId === 'port_lands') {
        player.crimes_port_lands = (player.crimes_port_lands || 0) + 1
      }

      // Track districts where player has maxed heat
      const districtHeat = player.district_heat?.[districtId] || 0
      if (districtHeat >= 90 && !player.districts_heated_list?.includes(districtId)) {
        player.districts_heated_list = player.districts_heated_list || []
        player.districts_heated_list.push(districtId)
        player.districts_heated = player.districts_heated_list.length
      }

      // Check level up
      const oldLevel = player.level || 1
      const newLevel = Math.floor(Math.sqrt((player.xp || 0) / 100)) + 1
      if (newLevel > oldLevel) {
        player.level = newLevel
        result.leveled_up = true
        result.new_level = newLevel
      }

      // Set message based on witness outcome
      result.message = witnessOutcome.message
    } else {
      // Failed - check for arrest based on district heat
      const districtId = player.current_district_id || 'parkdale'
      const districtEffects = getDistrictEffects(player, districtId)
      const arrestChance = (districtEffects.heat || player.heat || 0) / 2 * districtEffects.pursuitModifier

      if (Math.random() * 100 < arrestChance) {
        result.jailed = true
        result.jail_duration = 60
        player.heat = Math.max(0, (player.heat || 0) - 30)
        result.message = 'You got caught and sent to jail!'
      } else {
        // Add small heat for failed attempt (to current district)
        addDistrictHeat(player, districtId, 2)
        result.message = 'You failed and had to run!'
      }
      player.crimes_committed = (player.crimes_committed || 0) + 1
    }

    // Save updated player data
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    savePlayerData(player)

    // Check for new achievements
    gameManager.checkAchievements()

    // Set dynamic cooldown based on player bonuses and penalties
    const baseCooldown = 15000 // 15 second base cooldown
    const dynamicCooldown = calculateDynamicCooldown(player, baseCooldown, crime.id)
    gameManager.setCooldown('crime', dynamicCooldown)

    // Check for parole violation if on parole
    const paroleCheck = checkParoleViolation(player, 'crime')
    if (paroleCheck.violated) {
      // Save the violation result to show after the crime result
      result.paroleViolated = true
      result.paroleMessage = paroleCheck.message
    }

    return result
  }

  async onMiniGameComplete(miniGameResult, crime) {
    // This is called via the onComplete callback from mini-game
    // The scene will restart with miniGameResult data
    this.pendingCrime = crime
    this.miniGameResult = miniGameResult
  }

  async handleMiniGameResult(miniGameResult, crime) {
    const { width, height } = this.cameras.main

    // Clear the pending crime from registry
    this.registry.remove('pendingCrime')

    // FULL opaque background - covers everything underneath
    this.add.rectangle(0, 0, width, height, 0x0a0a15, 1).setOrigin(0).setDepth(DEPTH.CONTENT_BASE)

    // Add emergency close button at highest depth - always available
    const emergencyCloseBg = this.add.circle(width - 30, 30, 22, 0x1f2937, 0.9)
      .setDepth(DEPTH.CLOSE_BUTTON)
      .setStrokeStyle(2, 0x4b5563, 0.8)

    const emergencyClose = this.add.text(width - 30, 30, '✕', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.CLOSE_BUTTON).setInteractive({ useHandCursor: true })

    emergencyClose.on('pointerover', () => {
      emergencyClose.setColor('#ef4444')
      emergencyCloseBg.setFillStyle(0x374151)
      emergencyCloseBg.setStrokeStyle(2, 0xef4444, 1)
    })
    emergencyClose.on('pointerout', () => {
      emergencyClose.setColor('#ffffff')
      emergencyCloseBg.setFillStyle(0x1f2937, 0.9)
      emergencyCloseBg.setStrokeStyle(2, 0x4b5563, 0.8)
    })
    emergencyClose.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })

    console.log('[CrimeScene] Processing mini-game result for crime:', crime?.name || crime?.id)

    let result
    try {
      // Execute the crime with bonus multiplier from mini-game
      result = await gameManager.commitCrime(crime.id)
    } catch (error) {
      console.error('[CrimeScene] API failed after minigame, executing locally:', error)
      result = this.executeCrimeLocally(crime)
    }

    // Apply mini-game bonus to the result
    if (miniGameResult.success && result.success) {
      result.cash_earned = Math.floor((result.cash_earned || 0) * miniGameResult.bonusMultiplier)
      result.xp_earned = Math.floor((result.xp_earned || 0) * miniGameResult.bonusMultiplier)
      result.miniGameBonus = miniGameResult.bonusMultiplier
      result.perfectRun = miniGameResult.perfectRun

      // Update player data with bonus
      const player = gameManager.player || getPlayerData()
      if (player) {
        player.cash = (player.cash || 0) + Math.floor((result.cash_earned || 0) * (miniGameResult.bonusMultiplier - 1))
        player.xp = (player.xp || 0) + Math.floor((result.xp_earned || 0) * (miniGameResult.bonusMultiplier - 1))
        savePlayerData(player)
      }
    } else if (!miniGameResult.success) {
      // Failed mini-game reduces success chance significantly
      if (result.success) {
        result.miniGameRecovery = true
      }
    }

    this.showResult(result, crime, miniGameResult)

    // Check for new achievements after crime
    this.checkAchievements()

    // Random event trigger (5% chance after each crime)
    this.triggerRandomEvent()
  }

  async checkAchievements() {
    try {
      // Set scene for achievement popup
      achievementPopup.setScene(this)

      // Check for newly unlocked achievements
      const result = await gameManager.checkAchievements()

      if (result && result.new_achievements && result.new_achievements.length > 0) {
        // Show achievement popups
        achievementPopup.showMultiple(result.new_achievements)
      }
    } catch (error) {
      console.error('Failed to check achievements:', error)
    }
  }

  showResult(result, crime, miniGameResult = null) {
    const { width, height } = this.cameras.main

    // Set high depth for all result elements so they appear above background
    const RESULT_DEPTH = 200

    // Initialize notification manager for floating gains
    notificationManager.setScene(this)

    // === POLICE PURSUIT CHECK ===
    // Check if police pursuit should trigger (only if not already jailed and not from a chase)
    const isJailedForPursuit = result.jailed ?? result.caught ?? false
    const isFromChase = result.isFromChase ?? false

    if (!isJailedForPursuit && !isFromChase && !this.pursuitTriggered) {
      const pursuitCheck = gameManager.shouldTriggerPursuit(result)

      if (pursuitCheck.shouldPursue) {
        // Store data for after chase
        this.pendingCrimeResult = result
        this.pendingCrime = crime
        this.pendingMiniGameResult = miniGameResult
        this.pursuitTriggered = true

        // Show pursuit warning and launch chase
        this.showPursuitWarning(pursuitCheck)
        return // Don't show normal result yet
      }
    }

    // Reset pursuit flag
    this.pursuitTriggered = false

    // Add close/home button in top right corner - always visible
    const closeBtnBg = this.add.circle(width - 30, 30, 22, 0x1f2937, 0.9)
      .setDepth(RESULT_DEPTH + 10)
      .setStrokeStyle(2, 0x4b5563, 0.8)

    const closeBtn = this.add.text(width - 30, 30, '✕', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(RESULT_DEPTH + 11).setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ef4444')
      closeBtnBg.setFillStyle(0x374151)
      closeBtnBg.setStrokeStyle(2, 0xef4444, 1)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff')
      closeBtnBg.setFillStyle(0x1f2937, 0.9)
      closeBtnBg.setStrokeStyle(2, 0x4b5563, 0.8)
    })
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })

    // Normalize result structure (API returns crimeSuccess, but we use success)
    const success = result.success ?? result.crimeSuccess ?? false
    const cashEarned = result.cash_earned ?? result.cashGained ?? 0
    const xpEarned = result.xp_earned ?? result.xpGained ?? 0
    const leveledUp = result.leveled_up ?? result.leveledUp ?? false
    const newLevel = result.new_level ?? result.newLevel ?? null
    const jailed = result.jailed ?? result.caught ?? false

    // Play appropriate sound and visual effects
    if (success) {
      audioManager.playCrimeSuccess()
      if (cashEarned) {
        this.time.delayedCall(300, () => audioManager.playCashGain(cashEarned))
      }
      // Success visual effects
      AnimationHelper.successFlash(this)
      if (miniGameResult && miniGameResult.perfectRun) {
        ParticleHelper.successConfetti(this)
      }
    } else {
      audioManager.playCrimeFail()
      // Failure visual effects
      AnimationHelper.cameraShake(this, 400, 0.03)
      ParticleHelper.failSmoke(this, width / 2, height / 2)
      if (jailed) {
        this.time.delayedCall(500, () => audioManager.playJailed())
        ParticleHelper.vignetteFlash(this, 0x3b82f6, 500) // Blue police flash
      }
    }

    // Disable crime cards during result display
    if (this.crimeCards) {
      this.crimeCards.forEach(card => card.disableInteractive())
    }

    // Result overlay with animation
    const overlay = this.add.rectangle(width / 2, height / 2, 340, 280,
      success ? 0x22c55e : 0xef4444, 0.95).setDepth(RESULT_DEPTH)
    AnimationHelper.expandModal(this, overlay, 300)

    // Title
    let titleText = success ? 'SUCCESS!' : 'BUSTED!'
    if (miniGameResult && success && miniGameResult.perfectRun) {
      titleText = 'PERFECT!'
    }

    const title = this.add.text(width / 2, height / 2 - 100,
      titleText, {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial Black, Arial'
      }).setOrigin(0.5).setDepth(RESULT_DEPTH + 1)

    // Crime name
    this.add.text(width / 2, height / 2 - 65, crime.name, {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(RESULT_DEPTH + 1)

    // Result details
    let detailText = ''
    if (success) {
      detailText = `Earned ${formatMoney(cashEarned)}\n+${xpEarned} XP`

      // Show floating gains
      if (cashEarned) {
        notificationManager.showCashGain(width / 2 - 50, height / 2 - 30, cashEarned)
      }
      if (xpEarned) {
        this.time.delayedCall(200, () => {
          notificationManager.showXPGain(width / 2 + 50, height / 2 - 30, xpEarned)
        })
      }

      // Show witness outcome
      if (result.witnessOutcome) {
        const wo = result.witnessOutcome
        let witnessIcon = '👻'
        let witnessColor = '#22c55e'
        if (wo.outcome === 'dirty') {
          witnessIcon = '👀'
          witnessColor = '#fbbf24'
        } else if (wo.outcome === 'compromised') {
          witnessIcon = '🚨'
          witnessColor = '#ef4444'
        }
        detailText += `\n${witnessIcon} ${wo.message}`
      }

      // Show bonus from mini-game
      if (result.miniGameBonus && result.miniGameBonus > 1) {
        detailText += `\n\n🎮 Skill Bonus: ${result.miniGameBonus.toFixed(1)}x`
      }

      if (result.perfectRun) {
        detailText += '\n⭐ Perfect Run!'
      }

      // Show escape info if escaped a pursuit
      if (result.escaped_pursuit) {
        detailText += `\n\n🚔 Escaped Pursuit!`
        detailText += `\n-${result.escape_heat_reduction} Heat, +${result.escape_xp} XP`
      }

      if (leveledUp) {
        detailText += `\n\nLEVEL UP! Now Lv.${newLevel}`
        // Show level up notification and play sound
        this.time.delayedCall(500, () => {
          audioManager.playLevelUp()
          notificationManager.showLevelUp(newLevel)
        })
      }
    } else {
      detailText = result.message || 'You got caught!'
      if (jailed) {
        detailText += '\n\nYou were sent to jail!'
        // Show jailed notification
        this.time.delayedCall(300, () => {
          notificationManager.showJailed(result.jail_duration || 60)
        })
      }
    }

    // Check for parole violation
    if (result.paroleViolated) {
      detailText += '\n\n⚖️ PAROLE VIOLATION!'
      detailText += '\nExtended sentence!'
      // Flash the screen red
      this.time.delayedCall(500, () => {
        ParticleHelper.vignetteFlash(this, 0xA855F7, 400)
        audioManager.playJailed()
      })
    }

    this.add.text(width / 2, height / 2 + 10, detailText, {
      fontSize: '15px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5).setDepth(RESULT_DEPTH + 1)

    // Show breakdown explanation panel
    if (result.breakdown) {
      const bd = result.breakdown
      let breakdownText = ''

      // Build explanation based on factors
      if (bd.factors && bd.factors.length > 0) {
        const bonuses = bd.factors.filter(f => f.type === 'bonus')
        const penalties = bd.factors.filter(f => f.type === 'penalty')

        if (success && bonuses.length > 0) {
          breakdownText = bonuses.map(f => `+${f.value}% ${f.name}`).join(', ')
        } else if (!success) {
          // Show what worked against them
          if (penalties.length > 0) {
            breakdownText = penalties.map(f => `${f.value}% ${f.name}`).join(', ')
          }
          // Show the roll info
          breakdownText += `\nRolled ${bd.roll} (needed <${bd.needed})`
        }
      }

      if (breakdownText) {
        this.add.text(width / 2, height / 2 + 65, breakdownText, {
          fontSize: '11px',
          color: success ? '#a7f3d0' : '#fca5a5',
          align: 'center',
          fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(RESULT_DEPTH + 1)
      }
    }

    // Continue button
    const continueBtn = this.add.rectangle(width / 2, height / 2 + 100, 150, 40, jailed ? 0x3b82f6 : 0x333333)
      .setDepth(RESULT_DEPTH + 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => continueBtn.setFillStyle(jailed ? 0x2563eb : 0x444444))
      .on('pointerout', () => continueBtn.setFillStyle(jailed ? 0x3b82f6 : 0x333333))
      .on('pointerdown', () => {
        audioManager.playClick()
        if (jailed) {
          // Arrest the player properly and transition to JailScene
          const player = getPlayerData()
          if (player) {
            const arrestInfo = arrestPlayer(player)
            console.log('[CrimeScene] Player arrested, transitioning to JailScene:', arrestInfo)
          }
          // Transition to JailScene
          this.scene.stop()
          this.scene.start('JailScene')
        } else {
          // Remove result display and refresh the crime list
          overlay.destroy()
          title.destroy()
          continueBtn.destroy()
          this.scene.restart()
        }
      })

    this.add.text(width / 2, height / 2 + 100, jailed ? 'Go to Jail' : 'Continue', {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(RESULT_DEPTH + 2)
  }

  /**
   * Show police pursuit warning and launch chase game
   */
  showPursuitWarning(pursuitCheck) {
    const { width, height } = this.cameras.main
    const PURSUIT_DEPTH = 300

    // Full screen dark overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.95)
      .setOrigin(0)
      .setDepth(PURSUIT_DEPTH)

    // Red/blue flashing effect
    const flashOverlay = this.add.rectangle(0, 0, width, height, 0xff0000, 0)
      .setOrigin(0)
      .setDepth(PURSUIT_DEPTH + 1)

    this.tweens.add({
      targets: flashOverlay,
      alpha: { from: 0, to: 0.3 },
      duration: 200,
      yoyo: true,
      repeat: 5,
      onYoyo: () => {
        flashOverlay.setFillStyle(flashOverlay.fillColor === 0xff0000 ? 0x0000ff : 0xff0000)
      }
    })

    // Siren icons
    const siren1 = this.add.text(width / 2 - 80, height / 2 - 80, '🚨', { fontSize: '48px' })
      .setOrigin(0.5)
      .setDepth(PURSUIT_DEPTH + 2)
    const siren2 = this.add.text(width / 2 + 80, height / 2 - 80, '🚨', { fontSize: '48px' })
      .setOrigin(0.5)
      .setDepth(PURSUIT_DEPTH + 2)

    // Pulse sirens
    this.tweens.add({
      targets: [siren1, siren2],
      scale: { from: 1, to: 1.3 },
      duration: 300,
      yoyo: true,
      repeat: -1
    })

    // Main warning text
    const warningText = this.add.text(width / 2, height / 2, 'POLICE PURSUIT!', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '36px',
      color: '#ef4444',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(PURSUIT_DEPTH + 2)

    // Wanted stars
    const wantedInfo = gameManager.getWantedLevel()
    const stars = '★'.repeat(wantedInfo.stars) + '☆'.repeat(5 - wantedInfo.stars)
    const starsText = this.add.text(width / 2, height / 2 + 50, stars, {
      fontSize: '28px',
      color: '#fbbf24'
    }).setOrigin(0.5).setDepth(PURSUIT_DEPTH + 2)

    // Status text
    const statusText = this.add.text(width / 2, height / 2 + 90, `Wanted Level: ${wantedInfo.name}`, {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(PURSUIT_DEPTH + 2)

    // Camera shake
    this.cameras.main.shake(500, 0.02)

    // Play siren sound if available
    try {
      audioManager.playSiren?.() || audioManager.playThreat?.()
    } catch (e) { /* ignore */ }

    // After warning, launch chase game
    this.time.delayedCall(2000, () => {
      // Clean up warning UI
      overlay.destroy()
      flashOverlay.destroy()
      siren1.destroy()
      siren2.destroy()
      warningText.destroy()
      starsText.destroy()
      statusText.destroy()

      // Launch chase game
      this.launchPoliceChase()
    })
  }

  /**
   * Launch the police chase minigame
   */
  launchPoliceChase() {
    const chaseData = gameManager.getPoliceChaseData()

    // Store return data in registry
    this.registry.set('pendingCrimeResult', this.pendingCrimeResult)
    this.registry.set('pendingCrime', this.pendingCrime)
    this.registry.set('pendingMiniGameResult', this.pendingMiniGameResult)
    this.registry.set('returnFromPoliceChase', true)

    // Launch chase game
    this.scene.start('ChaseGame', {
      ...chaseData,
      returnScene: 'CrimeScene'
    })
  }

  /**
   * Handle return from police chase
   */
  handlePoliceChaseReturn(chaseResult) {
    // Get stored data
    const crimeResult = this.registry.get('pendingCrimeResult')
    const crime = this.registry.get('pendingCrime')
    const miniGameResult = this.registry.get('pendingMiniGameResult')

    // Clear registry
    this.registry.remove('pendingCrimeResult')
    this.registry.remove('pendingCrime')
    this.registry.remove('pendingMiniGameResult')
    this.registry.remove('returnFromPoliceChase')

    // Process chase result through game manager
    const chaseOutcome = gameManager.handleChaseResult(chaseResult)

    // If caught, modify the crime result to show jail
    if (!chaseOutcome.escaped) {
      crimeResult.jailed = true
      crimeResult.jail_duration = chaseOutcome.jailTime
      crimeResult.cash_lost = chaseOutcome.cashLost
      crimeResult.isFromChase = true
      crimeResult.message = `Caught after chase! Lost $${chaseOutcome.cashLost.toLocaleString()}`
    } else {
      // Escaped - add bonus info to result
      crimeResult.escaped_pursuit = true
      crimeResult.escape_heat_reduction = chaseOutcome.heatReduction
      crimeResult.escape_xp = chaseOutcome.xpReward
      crimeResult.isFromChase = true
    }

    // Show the combined result
    this.pursuitTriggered = false
    this.showResult(crimeResult, crime, miniGameResult)
  }

  async triggerRandomEvent() {
    // 5% chance to trigger a random event after each crime
    const roll = Math.random()
    if (roll > 0.05) return

    // Delay before showing event (let crime result show first)
    this.time.delayedCall(2500, async () => {
      try {
        // Check server for random event
        const result = await gameManager.checkForEvents().catch(() => null)

        if (result && result.new_events && result.new_events.length > 0) {
          // Show the first new event
          notificationManager.showEvent(result.new_events[0])
        } else {
          // Generate a local random event if server doesn't provide one
          const randomEvents = [
            {
              type: 'opportunity',
              title: 'Underground Contact',
              description: 'A shady figure approaches you with a tip on a lucrative opportunity nearby.',
              effect_type: 'cash',
              effect_value: 10,
              duration_minutes: 5
            },
            {
              type: 'threat',
              title: 'Heat Wave',
              description: 'Police activity in the area has increased. Lay low for a while.',
              effect_type: 'heat',
              effect_value: 15,
              duration_minutes: 3
            },
            {
              type: 'bonus',
              title: 'Lucky Streak',
              description: 'You\'re feeling lucky! Your next few crimes have better odds.',
              effect_type: 'success',
              effect_value: 10,
              duration_minutes: 10
            },
            {
              type: 'random',
              title: 'Street Informant',
              description: 'Someone offers to share valuable intel... for a price.',
              effect_type: 'xp',
              effect_value: 25,
              choices: [
                { label: 'Pay $500', action: 'pay', type: 'success' },
                { label: 'Decline', action: 'decline' }
              ]
            },
            {
              type: 'gang',
              title: 'Rival Crew',
              description: 'A rival gang member spotted you on their turf. They want a cut of your earnings.',
              effect_type: 'cash',
              effect_value: -5,
              choices: [
                { label: 'Pay Them', action: 'pay' },
                { label: 'Fight Back', action: 'fight', type: 'danger' },
                { label: 'Run', action: 'run', type: 'success' }
              ]
            }
          ]

          const event = randomEvents[Math.floor(Math.random() * randomEvents.length)]
          notificationManager.showEvent(event)
        }
      } catch (error) {
        console.error('Failed to trigger random event:', error)
      }
    })
  }

  closeScene() {
    // Clean up stats bar
    if (this.statsBar) {
      this.statsBar.destroy()
      this.statsBar = null
    }

    // Get scene manager reference before stopping - after stop(), 'this' may be invalid
    const sceneManager = this.scene

    // CRITICAL: Re-enable input on GameScene BEFORE resuming
    // GameScene's input was disabled when hub scene launched
    try {
      const gameScene = sceneManager.get('GameScene')
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[CrimeScene] Re-enabled GameScene input')
      }
    } catch (e) {
      console.error('[CrimeScene] Failed to re-enable GameScene input:', e)
    }

    // Stop this scene
    sceneManager.stop()

    // CRITICAL: Bring GameScene to top of scene stack for input priority
    try {
      sceneManager.bringToTop('GameScene')
      console.log('[CrimeScene] Brought GameScene to top')
    } catch (e) {
      console.error('[CrimeScene] Failed to bring GameScene to top:', e)
    }

    // Resume GameScene
    sceneManager.resume('GameScene')

    // Also resume UIScene
    try {
      sceneManager.resume('UIScene')
    } catch (e) {
      // UIScene might already be running
    }
  }

  showParoleWarning(crime) {
    const { width, height } = this.cameras.main

    // Dim overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0)
      .setDepth(DEPTH.MODAL)
      .setInteractive() // Block clicks through

    // Warning panel
    const panel = this.add.rectangle(width / 2, height / 2, 300, 200, 0x1a1a2e, 0.98)
      .setStrokeStyle(2, 0xA855F7, 0.8)
      .setDepth(DEPTH.MODAL_CONTENT)

    // Warning icon
    this.add.text(width / 2, height / 2 - 60, '⚖️', {
      fontSize: '40px'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Warning title
    this.add.text(width / 2, height / 2 - 20, 'PAROLE WARNING', {
      ...getTerminalStyle('lg'),
      color: '#A855F7'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Warning message
    this.add.text(width / 2, height / 2 + 15, 'You are currently on parole!\nCommitting crimes risks violation\nand extended jail time.', {
      ...getTextStyle('sm', COLORS.text.muted, 'terminal'),
      align: 'center'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Proceed button
    const proceedBtn = this.add.rectangle(width / 2 - 65, height / 2 + 70, 100, 36, 0xef4444, 0.3)
      .setStrokeStyle(1, 0xef4444, 0.6)
      .setDepth(DEPTH.MODAL_CONTENT)
      .setInteractive({ useHandCursor: true })

    this.add.text(width / 2 - 65, height / 2 + 70, 'RISK IT', {
      ...getTextStyle('sm', 0xef4444, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_BUTTONS)

    proceedBtn.on('pointerover', () => proceedBtn.setFillStyle(0xef4444, 0.5))
    proceedBtn.on('pointerout', () => proceedBtn.setFillStyle(0xef4444, 0.3))
    proceedBtn.on('pointerdown', () => {
      audioManager.playClick()
      // Set flag to skip warning on retry
      this.paroleWarningShown = true
      // Close warning and proceed
      overlay.destroy()
      panel.destroy()
      this.attemptCrime(crime)
    })

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 + 65, height / 2 + 70, 100, 36, 0x22c55e, 0.3)
      .setStrokeStyle(1, 0x22c55e, 0.6)
      .setDepth(DEPTH.MODAL_CONTENT)
      .setInteractive({ useHandCursor: true })

    this.add.text(width / 2 + 65, height / 2 + 70, 'CANCEL', {
      ...getTextStyle('sm', 0x22c55e, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_BUTTONS)

    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x22c55e, 0.5))
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x22c55e, 0.3))
    cancelBtn.on('pointerdown', () => {
      audioManager.playClick()
      overlay.destroy()
      panel.destroy()
    })
  }
}
