/**
 * Street Legacy - Configuration Barrel Export
 * Re-exports all configuration modules
 */

// Game Constants
export {
  // Types
  type StarterBuild,
  type CrimeType,
  type JobType,
  type BusinessCategory,
  type BusinessType,

  // Constants
  STARTER_BUILDS,
  PROGRESSION,
  CRIME_TYPES,
  JOB_TYPES,
  BUSINESS_TYPES,
  ECONOMY,

  // Helper Functions
  getXPForLevel,
  getTotalXPForLevel,
  calculateCrimePayout,
  calculateCrimeHeat,
  rollCrimeSuccess,
  getBusinessNetIncome,
  getAvailableCrimes,
  getAvailableJobs,
  getAvailableBusinesses,
  hasNewbieProtection,
  getBusinessesByCategory,
  getCrimeById,
  getJobById,
  getBusinessById
} from './game-constants';

// Districts
export {
  // Types
  type District,

  // Constants
  DISTRICTS,

  // Helper Functions
  getStarterDistricts,
  getDistrictById,
  getDistrictsByDifficulty,
  getAllDistricts,
  getAllDistrictIds,
  getDistrictsSortedBy,
  calculatePropertyPrice,
  getDistrictCrimeModifier,
  getDistrictHeatMultiplier,
  getDistrictIncomeMultiplier,
  canAccessDistrict,
  getTotalParcels,
  getDistrictStats
} from './districts';
