/**
 * Street Legacy - Toronto Districts
 * 16 distinct neighborhoods with unique characteristics
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface District {
  name: string;
  totalParcels: number;
  difficulty: number;
  basePropertyPrice: number;
  economyLevel: number;
  policePresence: number;
  crimeRate: number;
  isStarterDistrict: boolean;
}

// =============================================================================
// DISTRICTS
// =============================================================================

export const DISTRICTS: Record<string, District> = {
  scarborough: {
    name: 'Scarborough',
    totalParcels: 500,
    difficulty: 1,
    basePropertyPrice: 10000,
    economyLevel: 40,
    policePresence: 30,
    crimeRate: 60,
    isStarterDistrict: true
  },
  etobicoke: {
    name: 'Etobicoke',
    totalParcels: 450,
    difficulty: 1,
    basePropertyPrice: 12000,
    economyLevel: 45,
    policePresence: 35,
    crimeRate: 55,
    isStarterDistrict: true
  },
  north_york: {
    name: 'North York',
    totalParcels: 400,
    difficulty: 2,
    basePropertyPrice: 25000,
    economyLevel: 55,
    policePresence: 50,
    crimeRate: 45,
    isStarterDistrict: false
  },
  east_york: {
    name: 'East York',
    totalParcels: 300,
    difficulty: 2,
    basePropertyPrice: 20000,
    economyLevel: 50,
    policePresence: 45,
    crimeRate: 50,
    isStarterDistrict: false
  },
  york: {
    name: 'York',
    totalParcels: 350,
    difficulty: 2,
    basePropertyPrice: 18000,
    economyLevel: 45,
    policePresence: 40,
    crimeRate: 55,
    isStarterDistrict: false
  },
  queen_west: {
    name: 'Queen West',
    totalParcels: 200,
    difficulty: 3,
    basePropertyPrice: 50000,
    economyLevel: 65,
    policePresence: 55,
    crimeRate: 40,
    isStarterDistrict: false
  },
  kensington: {
    name: 'Kensington Market',
    totalParcels: 150,
    difficulty: 3,
    basePropertyPrice: 45000,
    economyLevel: 60,
    policePresence: 45,
    crimeRate: 50,
    isStarterDistrict: false
  },
  chinatown: {
    name: 'Chinatown',
    totalParcels: 150,
    difficulty: 3,
    basePropertyPrice: 40000,
    economyLevel: 60,
    policePresence: 50,
    crimeRate: 45,
    isStarterDistrict: false
  },
  downtown: {
    name: 'Downtown Core',
    totalParcels: 250,
    difficulty: 4,
    basePropertyPrice: 100000,
    economyLevel: 80,
    policePresence: 70,
    crimeRate: 35,
    isStarterDistrict: false
  },
  entertainment: {
    name: 'Entertainment District',
    totalParcels: 150,
    difficulty: 4,
    basePropertyPrice: 80000,
    economyLevel: 75,
    policePresence: 65,
    crimeRate: 40,
    isStarterDistrict: false
  },
  yorkville: {
    name: 'Yorkville',
    totalParcels: 100,
    difficulty: 4,
    basePropertyPrice: 150000,
    economyLevel: 85,
    policePresence: 80,
    crimeRate: 20,
    isStarterDistrict: false
  },
  financial: {
    name: 'Financial District',
    totalParcels: 100,
    difficulty: 5,
    basePropertyPrice: 200000,
    economyLevel: 90,
    policePresence: 85,
    crimeRate: 15,
    isStarterDistrict: false
  },
  waterfront: {
    name: 'Waterfront',
    totalParcels: 150,
    difficulty: 3,
    basePropertyPrice: 60000,
    economyLevel: 70,
    policePresence: 60,
    crimeRate: 35,
    isStarterDistrict: false
  },
  distillery: {
    name: 'Distillery District',
    totalParcels: 75,
    difficulty: 3,
    basePropertyPrice: 55000,
    economyLevel: 65,
    policePresence: 55,
    crimeRate: 30,
    isStarterDistrict: false
  },
  liberty: {
    name: 'Liberty Village',
    totalParcels: 125,
    difficulty: 3,
    basePropertyPrice: 65000,
    economyLevel: 70,
    policePresence: 60,
    crimeRate: 35,
    isStarterDistrict: false
  },
  parkdale: {
    name: 'Parkdale',
    totalParcels: 200,
    difficulty: 2,
    basePropertyPrice: 22000,
    economyLevel: 50,
    policePresence: 40,
    crimeRate: 60,
    isStarterDistrict: false
  }
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all starter district IDs
 */
export function getStarterDistricts(): string[] {
  return Object.entries(DISTRICTS)
    .filter(([_, district]) => district.isStarterDistrict)
    .map(([id, _]) => id);
}

/**
 * Get a district by ID
 */
export function getDistrictById(id: string): District | undefined {
  return DISTRICTS[id];
}

/**
 * Get districts by difficulty level
 */
export function getDistrictsByDifficulty(difficulty: number): District[] {
  return Object.values(DISTRICTS).filter(d => d.difficulty === difficulty);
}

/**
 * Get all districts as an array
 */
export function getAllDistricts(): District[] {
  return Object.values(DISTRICTS);
}

/**
 * Get all district IDs
 */
export function getAllDistrictIds(): string[] {
  return Object.keys(DISTRICTS);
}

/**
 * Get districts sorted by a property
 */
export function getDistrictsSortedBy(
  property: keyof District,
  ascending: boolean = true
): District[] {
  const districts = Object.values(DISTRICTS);
  return districts.sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return ascending ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });
}

/**
 * Calculate property price in a district
 */
export function calculatePropertyPrice(districtId: string, parcelIndex: number = 0): number {
  const district = DISTRICTS[districtId];
  if (!district) return 0;

  // Price varies by location within district (center is more expensive)
  const centerDistance = Math.abs(parcelIndex - district.totalParcels / 2) / (district.totalParcels / 2);
  const locationMultiplier = 1 + (1 - centerDistance) * 0.5;

  return Math.floor(district.basePropertyPrice * locationMultiplier);
}

/**
 * Get crime success modifier for a district
 */
export function getDistrictCrimeModifier(districtId: string): number {
  const district = DISTRICTS[districtId];
  if (!district) return 0;

  // Higher crime rate = easier crimes, higher police = harder
  const crimeBonus = (district.crimeRate - 50) / 250;
  const policePenalty = (district.policePresence - 50) / 250;

  return crimeBonus - policePenalty;
}

/**
 * Get heat multiplier for a district
 */
export function getDistrictHeatMultiplier(districtId: string): number {
  const district = DISTRICTS[districtId];
  if (!district) return 1;

  // Higher police presence = more heat gained
  return 0.5 + (district.policePresence / 100) * 1.5;
}

/**
 * Get business income multiplier for a district
 */
export function getDistrictIncomeMultiplier(districtId: string): number {
  const district = DISTRICTS[districtId];
  if (!district) return 1;

  // Higher economy = more income
  return 0.5 + (district.economyLevel / 100);
}

/**
 * Check if player can access a district based on level
 */
export function canAccessDistrict(playerLevel: number, districtId: string): boolean {
  const district = DISTRICTS[districtId];
  if (!district) return false;

  // Each difficulty level requires 2 player levels
  const requiredLevel = (district.difficulty - 1) * 2 + 1;
  return playerLevel >= requiredLevel;
}

/**
 * Get total parcels across all districts
 */
export function getTotalParcels(): number {
  return Object.values(DISTRICTS).reduce((sum, d) => sum + d.totalParcels, 0);
}

/**
 * Get district statistics summary
 */
export function getDistrictStats(): {
  totalDistricts: number;
  totalParcels: number;
  starterDistricts: number;
  avgEconomy: number;
  avgPolice: number;
  avgCrime: number;
  difficultyBreakdown: Record<number, number>;
} {
  const districts = Object.values(DISTRICTS);
  return {
    totalDistricts: districts.length,
    totalParcels: getTotalParcels(),
    starterDistricts: districts.filter(d => d.isStarterDistrict).length,
    avgEconomy: Math.round(districts.reduce((sum, d) => sum + d.economyLevel, 0) / districts.length),
    avgPolice: Math.round(districts.reduce((sum, d) => sum + d.policePresence, 0) / districts.length),
    avgCrime: Math.round(districts.reduce((sum, d) => sum + d.crimeRate, 0) / districts.length),
    difficultyBreakdown: {
      1: districts.filter(d => d.difficulty === 1).length,
      2: districts.filter(d => d.difficulty === 2).length,
      3: districts.filter(d => d.difficulty === 3).length,
      4: districts.filter(d => d.difficulty === 4).length,
      5: districts.filter(d => d.difficulty === 5).length
    }
  };
}
