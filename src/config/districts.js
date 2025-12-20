/**
 * Street Legacy - Toronto Districts
 * 16 distinct neighborhoods with unique characteristics
 */

// =============================================================================
// DISTRICT DEFINITIONS
// =============================================================================
export const DISTRICTS = {
  scarborough: {
    id: 'scarborough',
    name: 'Scarborough',
    description: 'A sprawling eastern suburb with diverse communities and plenty of opportunity for those starting out.',
    parcels: 500,
    difficulty: 1,
    base_price: 10000,
    economy: 40,
    police_presence: 30,
    crime_rate: 60,
    is_starter: true,
    map_position: { x: 900, y: 300 },
    color: '#4a7c59'
  },
  etobicoke: {
    id: 'etobicoke',
    name: 'Etobicoke',
    description: 'Western suburbs with industrial areas and residential neighborhoods. Good place to learn the ropes.',
    parcels: 450,
    difficulty: 1,
    base_price: 12000,
    economy: 45,
    police_presence: 35,
    crime_rate: 55,
    is_starter: true,
    map_position: { x: 100, y: 350 },
    color: '#5c8a4d'
  },
  north_york: {
    id: 'north_york',
    name: 'North York',
    description: 'Northern district with shopping centers and diverse communities. Moderate competition.',
    parcels: 400,
    difficulty: 2,
    base_price: 25000,
    economy: 55,
    police_presence: 50,
    crime_rate: 45,
    is_starter: false,
    map_position: { x: 500, y: 150 },
    color: '#6b9e5a'
  },
  east_york: {
    id: 'east_york',
    name: 'East York',
    description: 'Small but established neighborhood east of downtown. Working-class roots.',
    parcels: 300,
    difficulty: 2,
    base_price: 20000,
    economy: 50,
    police_presence: 45,
    crime_rate: 50,
    is_starter: false,
    map_position: { x: 700, y: 400 },
    color: '#7aad69'
  },
  york: {
    id: 'york',
    name: 'York',
    description: 'Central-west district with mixed residential and commercial areas.',
    parcels: 350,
    difficulty: 2,
    base_price: 18000,
    economy: 45,
    police_presence: 40,
    crime_rate: 55,
    is_starter: false,
    map_position: { x: 300, y: 400 },
    color: '#89bc78'
  },
  queen_west: {
    id: 'queen_west',
    name: 'Queen West',
    description: 'Trendy arts district with galleries, boutiques, and nightlife. Gentrifying rapidly.',
    parcels: 200,
    difficulty: 3,
    base_price: 50000,
    economy: 65,
    police_presence: 55,
    crime_rate: 40,
    is_starter: false,
    map_position: { x: 350, y: 500 },
    color: '#c9a227'
  },
  kensington: {
    id: 'kensington',
    name: 'Kensington Market',
    description: 'Bohemian neighborhood with vintage shops, street food, and eclectic culture.',
    parcels: 150,
    difficulty: 3,
    base_price: 45000,
    economy: 60,
    police_presence: 45,
    crime_rate: 50,
    is_starter: false,
    map_position: { x: 420, y: 480 },
    color: '#d4b82e'
  },
  chinatown: {
    id: 'chinatown',
    name: 'Chinatown',
    description: 'Vibrant cultural hub with bustling markets and traditional businesses.',
    parcels: 150,
    difficulty: 3,
    base_price: 40000,
    economy: 60,
    police_presence: 50,
    crime_rate: 45,
    is_starter: false,
    map_position: { x: 450, y: 510 },
    color: '#e6c935'
  },
  downtown: {
    id: 'downtown',
    name: 'Downtown',
    description: 'The heart of Toronto. High stakes, high rewards, and constant scrutiny.',
    parcels: 250,
    difficulty: 4,
    base_price: 100000,
    economy: 80,
    police_presence: 70,
    crime_rate: 35,
    is_starter: false,
    map_position: { x: 500, y: 500 },
    color: '#2c5282'
  },
  entertainment: {
    id: 'entertainment',
    name: 'Entertainment District',
    description: 'Clubs, theaters, and nightlife. Money flows freely after dark.',
    parcels: 150,
    difficulty: 4,
    base_price: 80000,
    economy: 75,
    police_presence: 65,
    crime_rate: 40,
    is_starter: false,
    map_position: { x: 480, y: 550 },
    color: '#9b2c2c'
  },
  yorkville: {
    id: 'yorkville',
    name: 'Yorkville',
    description: 'Toronto\'s most upscale neighborhood. Designer stores and wealthy residents.',
    parcels: 100,
    difficulty: 4,
    base_price: 150000,
    economy: 85,
    police_presence: 80,
    crime_rate: 20,
    is_starter: false,
    map_position: { x: 520, y: 400 },
    color: '#805ad5'
  },
  financial: {
    id: 'financial',
    name: 'Financial District',
    description: 'The beating heart of Canadian finance. Maximum security, maximum opportunity.',
    parcels: 100,
    difficulty: 5,
    base_price: 200000,
    economy: 90,
    police_presence: 85,
    crime_rate: 15,
    is_starter: false,
    map_position: { x: 530, y: 530 },
    color: '#1a365d'
  },
  waterfront: {
    id: 'waterfront',
    name: 'Waterfront',
    description: 'Scenic lakefront area with condos and tourist attractions.',
    parcels: 150,
    difficulty: 3,
    base_price: 60000,
    economy: 70,
    police_presence: 60,
    crime_rate: 35,
    is_starter: false,
    map_position: { x: 500, y: 620 },
    color: '#2b6cb0'
  },
  distillery: {
    id: 'distillery',
    name: 'Distillery District',
    description: 'Historic district with cobblestone streets, galleries, and upscale dining.',
    parcels: 75,
    difficulty: 3,
    base_price: 55000,
    economy: 65,
    police_presence: 55,
    crime_rate: 30,
    is_starter: false,
    map_position: { x: 600, y: 580 },
    color: '#744210'
  },
  liberty: {
    id: 'liberty',
    name: 'Liberty Village',
    description: 'Former industrial area turned trendy condo neighborhood. Tech startups and young professionals.',
    parcels: 125,
    difficulty: 3,
    base_price: 65000,
    economy: 70,
    police_presence: 60,
    crime_rate: 35,
    is_starter: false,
    map_position: { x: 380, y: 580 },
    color: '#c05621'
  },
  parkdale: {
    id: 'parkdale',
    name: 'Parkdale',
    description: 'Diverse neighborhood in transition. Mix of old and new, with opportunities on both sides.',
    parcels: 200,
    difficulty: 2,
    base_price: 22000,
    economy: 50,
    police_presence: 40,
    crime_rate: 60,
    is_starter: false,
    map_position: { x: 250, y: 550 },
    color: '#975a16'
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all districts as an array
 * @returns {object[]} Array of district objects
 */
export function getAllDistricts() {
  return Object.values(DISTRICTS);
}

/**
 * Get a district by ID
 * @param {string} id - District ID
 * @returns {object|null} District object or null
 */
export function getDistrictById(id) {
  return DISTRICTS[id] || null;
}

/**
 * Get all starter districts
 * @returns {object[]} Array of starter districts
 */
export function getStarterDistricts() {
  return Object.values(DISTRICTS).filter(d => d.is_starter);
}

/**
 * Get districts by difficulty level
 * @param {number} difficulty - Difficulty level (1-5)
 * @returns {object[]} Array of matching districts
 */
export function getDistrictsByDifficulty(difficulty) {
  return Object.values(DISTRICTS).filter(d => d.difficulty === difficulty);
}

/**
 * Get districts sorted by a property
 * @param {string} property - Property to sort by
 * @param {boolean} ascending - Sort direction
 * @returns {object[]} Sorted array of districts
 */
export function getDistrictsSortedBy(property, ascending = true) {
  const districts = Object.values(DISTRICTS);
  return districts.sort((a, b) => {
    if (ascending) {
      return a[property] - b[property];
    }
    return b[property] - a[property];
  });
}

/**
 * Calculate property price in a district
 * @param {string} districtId - District ID
 * @param {number} parcelIndex - Parcel number (0 to parcels-1)
 * @returns {number} Property price
 */
export function calculatePropertyPrice(districtId, parcelIndex = 0) {
  const district = DISTRICTS[districtId];
  if (!district) return 0;

  // Price varies by location within district (center is more expensive)
  const centerDistance = Math.abs(parcelIndex - district.parcels / 2) / (district.parcels / 2);
  const locationMultiplier = 1 + (1 - centerDistance) * 0.5; // Up to 50% more for central parcels

  return Math.floor(district.base_price * locationMultiplier);
}

/**
 * Get crime success modifier for a district
 * @param {string} districtId - District ID
 * @returns {number} Success modifier (-0.2 to +0.2)
 */
export function getDistrictCrimeModifier(districtId) {
  const district = DISTRICTS[districtId];
  if (!district) return 0;

  // Higher crime rate = easier crimes, higher police = harder
  const crimeBonus = (district.crime_rate - 50) / 250; // -0.2 to +0.2
  const policePenalty = (district.police_presence - 50) / 250; // -0.2 to +0.2

  return crimeBonus - policePenalty;
}

/**
 * Get heat multiplier for a district
 * @param {string} districtId - District ID
 * @returns {number} Heat multiplier (0.5 to 2.0)
 */
export function getDistrictHeatMultiplier(districtId) {
  const district = DISTRICTS[districtId];
  if (!district) return 1;

  // Higher police presence = more heat gained
  return 0.5 + (district.police_presence / 100) * 1.5;
}

/**
 * Get business income multiplier for a district
 * @param {string} districtId - District ID
 * @returns {number} Income multiplier (0.5 to 1.5)
 */
export function getDistrictIncomeMultiplier(districtId) {
  const district = DISTRICTS[districtId];
  if (!district) return 1;

  // Higher economy = more income
  return 0.5 + (district.economy / 100);
}

/**
 * Check if player can access a district based on level
 * @param {number} playerLevel - Player's current level
 * @param {string} districtId - District ID
 * @returns {boolean} Whether player can access district
 */
export function canAccessDistrict(playerLevel, districtId) {
  const district = DISTRICTS[districtId];
  if (!district) return false;

  // Each difficulty level requires 2 player levels
  const requiredLevel = (district.difficulty - 1) * 2 + 1;
  return playerLevel >= requiredLevel;
}

/**
 * Get adjacent districts for travel
 * @param {string} districtId - Current district ID
 * @returns {string[]} Array of adjacent district IDs
 */
export function getAdjacentDistricts(districtId) {
  const adjacencyMap = {
    scarborough: ['east_york', 'north_york'],
    etobicoke: ['york', 'parkdale'],
    north_york: ['scarborough', 'east_york', 'york', 'yorkville'],
    east_york: ['scarborough', 'north_york', 'downtown', 'distillery'],
    york: ['etobicoke', 'north_york', 'queen_west', 'parkdale'],
    queen_west: ['york', 'kensington', 'liberty', 'parkdale'],
    kensington: ['queen_west', 'chinatown', 'downtown'],
    chinatown: ['kensington', 'downtown', 'entertainment'],
    downtown: ['east_york', 'kensington', 'chinatown', 'entertainment', 'yorkville', 'financial', 'waterfront'],
    entertainment: ['chinatown', 'downtown', 'financial', 'waterfront', 'liberty'],
    yorkville: ['north_york', 'downtown'],
    financial: ['downtown', 'entertainment', 'waterfront', 'distillery'],
    waterfront: ['downtown', 'entertainment', 'financial', 'distillery', 'liberty'],
    distillery: ['east_york', 'financial', 'waterfront'],
    liberty: ['queen_west', 'entertainment', 'waterfront', 'parkdale'],
    parkdale: ['etobicoke', 'york', 'queen_west', 'liberty']
  };

  return adjacencyMap[districtId] || [];
}

/**
 * Calculate travel cost between districts
 * @param {string} fromDistrictId - Origin district ID
 * @param {string} toDistrictId - Destination district ID
 * @returns {object} Travel cost { cash: number, energy: number, time_seconds: number }
 */
export function calculateTravelCost(fromDistrictId, toDistrictId) {
  const from = DISTRICTS[fromDistrictId];
  const to = DISTRICTS[toDistrictId];

  if (!from || !to) {
    return { cash: 0, energy: 0, time_seconds: 0 };
  }

  // Calculate distance based on map positions
  const dx = to.map_position.x - from.map_position.x;
  const dy = to.map_position.y - from.map_position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Normalize distance (max map distance ~800)
  const normalizedDistance = distance / 800;

  // Base costs scale with distance
  const baseCash = 10;
  const baseEnergy = 5;
  const baseTime = 30; // seconds

  return {
    cash: Math.floor(baseCash + normalizedDistance * 40),
    energy: Math.floor(baseEnergy + normalizedDistance * 10),
    time_seconds: Math.floor(baseTime + normalizedDistance * 90)
  };
}

/**
 * Get total parcels across all districts
 * @returns {number} Total parcel count
 */
export function getTotalParcels() {
  return Object.values(DISTRICTS).reduce((sum, d) => sum + d.parcels, 0);
}

/**
 * Get district statistics summary
 * @returns {object} Statistics object
 */
export function getDistrictStats() {
  const districts = Object.values(DISTRICTS);
  return {
    total_districts: districts.length,
    total_parcels: getTotalParcels(),
    starter_districts: districts.filter(d => d.is_starter).length,
    avg_economy: Math.round(districts.reduce((sum, d) => sum + d.economy, 0) / districts.length),
    avg_police: Math.round(districts.reduce((sum, d) => sum + d.police_presence, 0) / districts.length),
    avg_crime: Math.round(districts.reduce((sum, d) => sum + d.crime_rate, 0) / districts.length),
    difficulty_breakdown: {
      1: districts.filter(d => d.difficulty === 1).length,
      2: districts.filter(d => d.difficulty === 2).length,
      3: districts.filter(d => d.difficulty === 3).length,
      4: districts.filter(d => d.difficulty === 4).length,
      5: districts.filter(d => d.difficulty === 5).length
    }
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================
export default {
  DISTRICTS,
  getAllDistricts,
  getDistrictById,
  getStarterDistricts,
  getDistrictsByDifficulty,
  getDistrictsSortedBy,
  calculatePropertyPrice,
  getDistrictCrimeModifier,
  getDistrictHeatMultiplier,
  getDistrictIncomeMultiplier,
  canAccessDistrict,
  getAdjacentDistricts,
  calculateTravelCost,
  getTotalParcels,
  getDistrictStats
};
