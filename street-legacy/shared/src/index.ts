// Shared types for Street Legacy

// Re-export config modules (these are the primary exports for types)
export * from './config';

// Re-export type definitions (excluding duplicates that are already in config)
export {
  // Starter Build types (extended)
  type StarterBuildType,
  type StarterBuildsMap,

  // Crime types (extended)
  type CrimeTypeId,
  type CrimeTypesMap,

  // Job types (extended)
  type JobTypeId,
  type JobTypesMap,

  // Business types (extended)
  type BusinessTypeId,
  type BusinessTypesMap,

  // District types (extended)
  type DistrictId,
  type DistrictDifficulty,
  type DistrictsMap,

  // Progression types
  type ProgressionConfig,

  // Economy types
  type EconomyConfig,

  // Player types
  type PlayerReputation,
  type PlayerCurrency,
  type PlayerAttributes as TypedPlayerAttributes,
  type PlayerStatus,
  type PlayerLocation,
  type Player,

  // Action result types
  type ActionResult,
  type CrimeResult,
  type JobResult,
  type BusinessIncomeResult,

  // Cooldown types
  type CooldownStatus,
  type CooldownMap,

  // Utility types
  type PaginationParams,
  type PaginatedResponse,
  type SortDirection,
  type SortParams,
  type ApiError,
  type ApiResponse as TypedApiResponse
} from './types';

// Re-export Supabase client
export * from './lib/supabase';

// Legacy types (keeping for backward compatibility)
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthCheck {
  status: string;
  timestamp: string;
}

// Phase 1A: New Attribute System
export interface PlayerAttributes {
  // Physical attributes
  stamina: number;
  staminaMax: number;
  focus: number;
  focusMax: number;

  // Social/reputation attributes
  heat: number;          // Law enforcement attention (0-100)
  influence: number;     // Social capital for negotiations (0-100)
  streetRep: number;     // Permanent reputation score
}

// =====================================================
// PHASE 5: NUCLEAR CELLS ENERGY SYSTEM (2091)
// =====================================================

// Nuclear Cells - Primary energy resource in 2091
export interface NuclearCellState {
  cells: number;                    // Current cell count
  maxCells: number;                 // Maximum capacity
  lastRegen: string;                // ISO timestamp of last regen
  regenRate: number;                // Cells per regen tick
  regenIntervalSeconds: number;     // Seconds between regen ticks
  efficiency: number;               // Cost reduction multiplier (0.00 - 0.25)
}

// Reactor configuration
export interface PlayerReactor {
  id: number;
  playerId: number;
  reactorType: ReactorType;
  reactorName: string;
  maxCapacity: number;
  regenRate: number;
  regenIntervalSeconds: number;
  efficiencyBonus: number;
  isOverclocked: boolean;
  overclockExpiresAt?: string;
  installedAt: string;
  lastMaintenance: string;
  conditionPercent: number;         // 0-100, affects regen
}

// Reactor types available
export type ReactorType = 'basic' | 'standard' | 'advanced' | 'fusion' | 'quantum';

export interface ReactorTypeInfo {
  id: number;
  typeKey: ReactorType;
  name: string;
  description: string;
  maxCapacity: number;
  baseRegenRate: number;
  regenIntervalSeconds: number;
  efficiencyBonus: number;
  purchasePrice: number;
  minLevel: number;
  minFactionRank?: string;
  factionRequired?: FactionCode;
  icon: string;
}

// Action cell costs
export type ActionCategory = 'crime' | 'job' | 'combat' | 'heist' | 'faction' | 'territory' | 'travel' | 'special';

export interface ActionCellCost {
  id: number;
  actionType: string;
  actionCategory: ActionCategory;
  baseCost: number;
  isHighRisk: boolean;             // If true, action REQUIRES cells
  description: string;
  icon: string;
}

// Cell packs for purchase
export interface CellPack {
  id: number;
  packKey: string;
  name: string;
  description: string;
  cellAmount: number;
  priceCredits: number;
  priceTokens: number;
  bonusCells: number;
  cooldownHours: number;
  dailyLimit: number;
  isPremium: boolean;
  minLevel: number;
  icon: string;
  // Computed fields
  canPurchase?: boolean;
  nextPurchaseAt?: string;
  purchasesToday?: number;
}

// Cell regeneration log entry
export interface CellRegenLog {
  id: number;
  playerId: number;
  regenType: 'passive' | 'reactor' | 'item' | 'purchase' | 'faction' | 'event';
  amount: number;
  source: string;
  timestamp: string;
}

// API Responses for Nuclear Cells
export interface NuclearCellsStatusResponse {
  cells: NuclearCellState;
  reactor: PlayerReactor | null;
  nextRegen: {
    inSeconds: number;
    amount: number;
  };
  availableUpgrades: ReactorTypeInfo[];
}

export interface CellPurchaseResponse {
  success: boolean;
  cellsReceived: number;
  bonusCells: number;
  newTotal: number;
  priceCredits?: number;
  priceTokens?: number;
}

export interface ReactorUpgradeResponse {
  success: boolean;
  newReactor: PlayerReactor;
  previousType: ReactorType;
  capacityIncrease: number;
  efficiencyIncrease: number;
}

// Phase 1A: New Currency System
export interface PlayerCurrencies {
  cash: number;          // Dirty money - main currency
  bank: number;          // Banked cash
  cleanMoney: number;    // Laundered funds for legal purchases
  crypto: number;        // Untraceable digital currency
  tokens: number;        // Premium currency
}

// Full player state combining attributes and currencies
export interface PlayerState extends PlayerAttributes, PlayerCurrencies {
  id: number;
  username: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalEarnings: number;
  inJail: boolean;
  jailReleaseAt: string | null;
  isMaster: boolean;
  prestigeLevel: number;

  // Legacy fields (kept for backward compatibility during transition)
  energy?: number;
  nerve?: number;
  streetCred?: number;
}

// Crime definition with new cost system
export interface CrimeDefinition {
  id: number;
  name: string;
  description: string;
  category: string;
  minLevel: number;
  staminaCost: number;
  focusCost: number;
  influenceRequired: number;
  heatGenerated: number;
  baseSuccessRate: number;
  minPayout: number;
  maxPayout: number;
  cooldownSeconds: number;
  jailMinutes: number;

  // Legacy fields
  energyCost?: number;
  nerveCost?: number;
}

// =====================================================
// PHASE 6: ALWAYS-AVAILABLE MISSIONS AND MICRO-ECONOMY
// =====================================================

// NPC Types
export type NPCType = 'fixer' | 'fence' | 'informant' | 'supplier' | 'lawyer' | 'doctor';

// NPC Contact
export interface NPC {
  id: number;
  name: string;
  type: NPCType;
  avatarEmoji: string;
  description: string;
  cutPercentage: number;
  trustRequired: number;
  districtId?: number;
  districtName?: string;
  location?: {
    name: string;
    type: string;
  };
}

// NPC Relationship
export interface NPCRelationship {
  trust: number;
  missionsCompleted: number;
  missionsFailed: number;
  lastInteraction: string | null;
  isUnlocked: boolean;
}

// NPC with player relationship
export interface NPCWithRelationship extends NPC {
  playerTrust: number;
  missionsCompleted: number;
  isUnlocked: boolean;
}

// Mission Categories
export type MissionCategory =
  | 'npc_job'
  | 'daily_contract'
  | 'hourly_task'
  | 'story'
  | 'crew_assignment'
  | 'random_encounter'
  | 'regen';

// NPC Mission
export interface NPCMission {
  id: number;
  npcId: number;
  title: string;
  description: string;
  missionType: string;
  minLevel: number;
  minTrust: number;
  staminaCost: number;
  focusCost: number;
  timeMinutes: number;
  baseSuccessRate: number;
  baseCashReward: number;
  baseXpReward: number;
  trustReward: number;
  heatGenerated: number;
  isRepeatable: boolean;
  onCooldown: boolean;
}

// Daily Contract
export interface DailyContract {
  id: string;
  category: 'daily_contract';
  index: number;
  title: string;
  description: string;
  type: string;
  targetValue: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  cashReward: number;
  xpReward: number;
  difficulty: string;
}

// Hourly Task
export interface HourlyTask {
  id: number;
  category: 'hourly_task';
  name: string;
  description: string;
  taskType: string;
  staminaCost: number;
  focusCost: number;
  timeMinutes: number;
  cashReward: number;
  xpReward: number;
  completed: boolean;
}

// Regeneration Activity
export interface RegenActivity {
  id: number;
  name: string;
  description: string;
  activityType: 'stamina' | 'focus' | 'heat' | 'influence';
  staminaRegen: number;
  focusRegen: number;
  heatReduction: number;
  influenceGain: number;
  timeMinutes: number;
  cashCost: number;
  cooldownMinutes: number;
  onCooldown: boolean;
  availableAt: string | null;
}

// Random Encounter
export interface RandomEncounter {
  id: number;
  name: string;
  description: string;
  encounterType: 'opportunity' | 'danger' | 'npc_meeting' | 'loot' | 'ambush' | 'tip';
  choices: {
    id: string;
    text: string;
  }[];
}

// Crew Assignment
export interface CrewAssignment {
  id: number;
  category: 'crew_assignment';
  title: string;
  description: string;
  assignedBy: string;
  missionType: string;
  targetValue: number;
  progress: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  cashReward: number;
  xpReward: number;
  repReward: number;
  expiresAt: string | null;
}

// Available Missions Response
export interface AvailableMissionsResponse {
  npcJobs: {
    category: string;
    description: string;
    icon: string;
    missions: NPCMission[];
  };
  dailyContracts: {
    category: string;
    description: string;
    icon: string;
    refreshesAt: string;
    missions: DailyContract[];
  };
  hourlyTasks: {
    category: string;
    description: string;
    icon: string;
    missions: HourlyTask[];
    refreshesAt: string;
  };
  storyMissions: {
    category: string;
    description: string;
    icon: string;
    missions: any[];
  };
  crewAssignments: {
    category: string;
    description: string;
    icon: string;
    missions: CrewAssignment[];
  };
  regenActivities: {
    category: string;
    description: string;
    icon: string;
    activities: RegenActivity[];
  };
}

// =====================================================
// MICRO-ECONOMY TYPES
// =====================================================

// Token Package
export interface TokenPackage {
  id: number;
  name: string;
  tokens: number;
  bonusTokens: number;
  totalTokens: number;
  priceUsd: number;
  isFeatured: boolean;
  valuePerDollar: number;
}

// Token Action
export interface TokenAction {
  id: number;
  name: string;
  description: string;
  actionType: 'skip_wait' | 'instant_travel' | 'refresh' | 'cosmetic' | 'expand_cap' | 'boost';
  tokenCost: number;
  effectValue: number | null;
  effectType: string | null;
  maxDailyUses: number | null;
  dailyUsesRemaining: number | null;
  canUse: boolean;
}

// Spending Limits
export interface SpendingLimits {
  dailySpent: number;
  dailyLimit: number;
  dailyRemaining: number;
  weeklySpent: number;
  weeklyLimit: number;
  weeklyRemaining: number;
  totalSpent: number;
  verified: boolean;
}

// Token Balance Response
export interface TokenBalanceResponse {
  tokens: number;
  spending: SpendingLimits;
  coolingOff: {
    active: boolean;
    until: string | null;
  };
}

// =====================================================
// CAPACITY EXPANSION TYPES
// =====================================================

export type ExpansionType = 'stamina_max' | 'focus_max' | 'influence_max' | 'inventory_slots';

// Expansion Mission Chain
export interface ExpansionMissionChain {
  name: string;
  totalStages: number;
  completedStages: number;
  remainingStages: number;
  expansionPerStage: number;
  potentialExpansion: number;
}

// Expansion Token Purchase
export interface ExpansionTokenPurchase {
  tokenCost: number;
  maxPurchases: number;
  purchasesMade: number;
  purchasesRemaining: number;
  expansionPerPurchase: number;
  potentialExpansion: number;
}

// Capacity Expansion
export interface CapacityExpansion {
  id: number;
  name: string;
  description: string;
  expansionType: ExpansionType;
  currentCap: number;
  missionChain: ExpansionMissionChain;
  tokenPurchase: ExpansionTokenPurchase;
  totalExpansion: number;
  maxTotalExpansion: number;
  expansionRemaining: number;
  percentComplete: number;
}

// Point of Interest
export interface PointOfInterest {
  id: number;
  name: string;
  type: string;
  description: string;
  districtId: number;
}

// =====================================================
// PHASE 7: PROPERTY SYSTEM AND REAL ESTATE EMPIRE
// =====================================================

// Property Categories
export type PropertyCategory = 'residential' | 'commercial' | 'industrial' | 'illegal';

// Property Types
export type PropertyType =
  | 'apartment' | 'condo' | 'house' | 'mansion' | 'penthouse'
  | 'corner_store' | 'restaurant' | 'nightclub' | 'strip_mall' | 'office_building'
  | 'warehouse' | 'factory' | 'distribution_center' | 'port_facility'
  | 'trap_house' | 'stash_house' | 'front_business' | 'underground_bunker';

// Property Listing (available for purchase)
export interface PropertyListing {
  id: number;
  name: string;
  propertyType: PropertyType;
  category: PropertyCategory;
  districtId: number;
  districtName?: string;
  description: string;
  basePrice: number;
  monthlyMaintenance: number;
  baseIncome: number;
  incomeFrequencyHours: number;
  storageCapacity: number;
  upgradeSlots: number;
  minLevel: number;
  minRep: number;
  heatGenerated: number;
  raidRisk: number;
  icon: string;
  canAfford?: boolean;
  meetsLevel?: boolean;
  meetsRep?: boolean;
}

// Owned Property
export interface OwnedProperty {
  id: number;
  listingId: number;
  name: string;
  customName: string | null;
  propertyType: PropertyType;
  category: PropertyCategory;
  districtId: number;
  districtName?: string;
  description: string;
  condition: number;
  lastMaintenance: string;
  lastIncomeCollection: string;
  currentHeat: number;
  isOperational: boolean;
  hasManager: boolean;
  managerCost: number;
  purchasePrice: number;
  purchasedAt: string;
  baseIncome: number;
  monthlyMaintenance: number;
  incomeFrequencyHours: number;
  storageCapacity: number;
  upgradeSlots: number;
  usedSlots?: number;
  icon: string;
  upgrades?: PropertyUpgrade[];
  pendingIncome?: number;
  hoursUntilNextIncome?: number;
}

// Property Upgrade Category
export type UpgradeCategory = 'security' | 'income' | 'storage' | 'operations' | 'special';

// Property Upgrade Type (available for installation)
export interface PropertyUpgradeType {
  id: number;
  name: string;
  description: string;
  category: UpgradeCategory;
  applicableTypes: PropertyType[];
  applicableCategories: PropertyCategory[];
  cost: number;
  monthlyCost: number;
  minLevel: number;
  requiredUpgradeId: number | null;
  effects: PropertyUpgradeEffects;
  installTimeHours: number;
  icon: string;
  canInstall?: boolean;
  canAfford?: boolean;
  meetsLevel?: boolean;
  requiredUpgrade?: {
    id: number;
    isInstalled: boolean;
  } | null;
}

// Property Upgrade Effects
export interface PropertyUpgradeEffects {
  // Security effects
  raidChanceReduction?: number;
  detectEarlyChance?: number;
  seizureReduction?: number;
  alarmSystem?: boolean;
  panicRoom?: boolean;

  // Income effects
  incomeMultiplier?: number;
  incomeBonus?: number;
  customerCapacity?: number;

  // Storage effects
  storageBonus?: number;
  storageMultiplier?: number;
  hiddenStorage?: boolean;

  // Operations effects
  operationEfficiency?: number;
  maxLaunderingDaily?: number;
  launderingFeeReduction?: number;
  productionSpeedBonus?: number;
  qualityBonus?: number;

  // Special effects
  heatReduction?: number;
  maintenanceReduction?: number;
  managerEfficiency?: number;
}

// Installed Property Upgrade
export interface PropertyUpgrade {
  id: number;
  upgradeTypeId: number;
  name: string;
  category: UpgradeCategory;
  effects: PropertyUpgradeEffects;
  isActive: boolean;
  installedAt: string;
  installingUntil: string | null;
  isInstalling: boolean;
  monthlyCost: number;
  icon: string;
}

// Property Operation Types
export type OperationType =
  | 'money_laundering'
  | 'drug_manufacturing'
  | 'vehicle_chopping'
  | 'smuggling'
  | 'counterfeiting'
  | 'protection_racket';

// Property Operation
export interface PropertyOperation {
  id: number;
  propertyId: number;
  operationType: OperationType;
  isActive: boolean;
  intensity: number;
  efficiency: number;
  startedAt: string;
  lastCollection: string;
  totalProduced: number;
  totalRevenue: number;
  heatGenerated: number;
}

// Operation Config
export interface OperationConfig {
  type: OperationType;
  name: string;
  description: string;
  requiredPropertyTypes: PropertyType[];
  requiredUpgrades: string[];
  baseOutput: number;
  outputUnit: string;
  baseRevenuePerUnit: number;
  heatPerHour: number;
  riskPerHour: number;
  minLevel: number;
}

// Laundering Transaction
export interface LaunderingTransaction {
  id: number;
  propertyId: number;
  dirtyAmount: number;
  cleanAmount: number;
  fee: number;
  feePercentage: number;
  status: 'pending' | 'processing' | 'completed' | 'seized';
  startedAt: string;
  completesAt: string;
  completedAt: string | null;
}

// Property Raid
export interface PropertyRaid {
  id: number;
  propertyId: number;
  raidType: 'police' | 'rival_gang' | 'federal';
  severity: 'minor' | 'standard' | 'major';
  success: boolean;
  cashSeized: number;
  inventorySeized: any;
  productsSeized: number;
  damageDealt: number;
  wasDefended: boolean;
  defenseMethod: string | null;
  occurredAt: string;
}

// Property Defense Status
export interface PropertyDefenseStatus {
  propertyId: number;
  propertyName: string;
  currentHeat: number;
  raidRisk: number;
  baseRaidChance: number;
  effectiveRaidChance: number;
  securityLevel: number;
  securityUpgrades: string[];
  hasAlarm: boolean;
  hasPanicRoom: boolean;
  lastRaid: string | null;
  hoursSinceLastRaid: number | null;
  raidImmunityUntil: string | null;
  isImmune: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// Property Income Log
export interface PropertyIncomeLog {
  id: number;
  propertyId: number;
  amount: number;
  source: 'rent' | 'business' | 'operation' | 'laundering';
  collectedAt: string;
}

// Property Maintenance Log
export interface PropertyMaintenanceLog {
  id: number;
  propertyId: number;
  cost: number;
  conditionBefore: number;
  conditionAfter: number;
  maintenanceType: 'routine' | 'repair' | 'emergency';
  performedAt: string;
}

// Property Staff
export interface PropertyStaff {
  id: number;
  propertyId: number;
  staffType: 'manager' | 'security' | 'worker';
  name: string;
  salary: number;
  efficiency: number;
  loyalty: number;
  hiredAt: string;
}

// Property Inventory Item
export interface PropertyInventoryItem {
  id: number;
  propertyId: number;
  itemType: string;
  itemName: string;
  quantity: number;
  value: number;
  storedAt: string;
}

// Real Estate Response Types
export interface PropertyListingsResponse {
  listings: PropertyListing[];
  playerFunds: number;
  playerLevel: number;
  playerRep: number;
  filters: {
    categories: PropertyCategory[];
    types: PropertyType[];
    districts: { id: number; name: string }[];
  };
}

export interface OwnedPropertiesResponse {
  properties: OwnedProperty[];
  totalValue: number;
  totalMonthlyIncome: number;
  totalMonthlyMaintenance: number;
  netMonthlyIncome: number;
  totalPendingIncome: number;
}

export interface PropertyDetailResponse {
  property: OwnedProperty;
  upgrades: PropertyUpgrade[];
  operations: PropertyOperation[];
  staff: PropertyStaff[];
  inventory: PropertyInventoryItem[];
  recentIncome: PropertyIncomeLog[];
  recentRaids: PropertyRaid[];
  defenseStatus: PropertyDefenseStatus;
}

// =====================================================
// PHASE 8: CREW WARS AND TERRITORY CONTROL
// =====================================================

// War Status
export type WarStatus = 'preparing' | 'active' | 'attacker_won' | 'defender_won' | 'stalemate' | 'cancelled';

// War Role
export type WarRole = 'warlord' | 'captain' | 'soldier' | 'spy' | 'medic' | 'engineer';

// Territory with Control Info
export interface Territory {
  id: number;
  name: string;
  controllingCrewId: number | null;
  controllingCrewName: string | null;
  controlPercentage: number;
  contested: boolean;
  contestingCrewId: number | null;
  contestingCrewName: string | null;
  adjacentDistricts: number[];
  hasActiveWar: boolean;
  peaceUntil: string | null;
  isUnderPeace: boolean;
  benefits: TerritoryBenefits;
  isOwnTerritory: boolean;
}

// Territory Benefits
export interface TerritoryBenefits {
  incomeBonusPercent?: number;
  showOnMap?: boolean;
  safehouseAccess?: boolean;
  rivalPenaltyPercent?: number;
  fullControl?: boolean;
  specialOps?: boolean;
}

// Territory War
export interface TerritoryWar {
  id: number;
  districtId: number;
  districtName: string;
  attackerCrewId: number;
  attackerCrewName: string;
  defenderCrewId: number;
  defenderCrewName: string;
  status: WarStatus;
  attackerPoints: number;
  defenderPoints: number;
  startedAt: string;
  prepEndsAt: string;
  endsAt: string;
  cashPrize: number;
  isInvolved?: boolean;
  isPrepping?: boolean;
  timeRemainingMs?: number;
}

// Active War (player perspective)
export interface ActiveWar extends TerritoryWar {
  isAttacker: boolean;
  yourCrewName: string;
  enemyCrewName: string;
  yourPoints: number;
  enemyPoints: number;
  yourPois: number;
  enemyPois: number;
  prepTimeRemainingMs: number;
  recentEvents: WarEvent[];
  activeMissions: PlayerWarMission[];
}

// War Event
export interface WarEvent {
  id: number;
  type: string;
  crewId?: number;
  playerName?: string;
  targetName?: string;
  pointsEarned: number;
  description: string;
  occurredAt: string;
}

// War Mission
export interface WarMission {
  id: number;
  name: string;
  description: string;
  type: string;
  pointsReward: number;
  cashReward: number;
  xpReward: number;
  staminaCost: number;
  focusCost: number;
  successRate: number;
  requiredRole: WarRole | null;
  cooldownMinutes: number;
  icon: string;
  isActive?: boolean;
  onCooldown?: boolean;
  cooldownEndsAt?: string | null;
  canAccept?: boolean;
}

// Player War Mission
export interface PlayerWarMission {
  id: number;
  missionId: number;
  name: string;
  description: string;
  type: string;
  pointsReward: number;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed' | 'expired';
  expiresAt: string | null;
  icon: string;
}

// POI Control (during war)
export interface PoiControl {
  poiId: number;
  name: string;
  type: string;
  strategicValue: number;
  controllingCrewId: number | null;
  controllingCrewName: string | null;
  isYourPoi: boolean;
  isEnemyPoi: boolean;
  isNeutral: boolean;
  isContested: boolean;
  capturingCrewId: number | null;
  capturingCrewName: string | null;
  capturingPlayerName: string | null;
  captureProgress: number;
  captureTimeMinutes: number;
  youAreCapturing: boolean;
  enemyIsCapturing: boolean;
  pointsGenerated: number;
  yourPresence: number;
  enemyPresence: number;
  youArePresent: boolean;
  canCapture: boolean;
  canContest: boolean;
}

// War Contributor
export interface WarContributor {
  playerId: number;
  username: string;
  warPoints: number;
  warKills: number;
  warRole: WarRole | null;
  side: 'attacker' | 'defender';
}

// Crew Rank
export interface CrewRank {
  id: number;
  name: string;
  rankLevel: number;
  permissions: Record<string, boolean>;
  warRole?: WarRole;
  salaryPerDay: number;
  maxMembers: number | null;
  memberCount?: number;
  icon: string;
}

// Crew Member (with rank and war info)
export interface CrewMemberWithRank {
  playerId: number;
  username: string;
  level: number;
  isLeader: boolean;
  rankId: number | null;
  rankName: string;
  rankIcon: string;
  rankLevel: number | null;
  warRole: WarRole | null;
  warRoleName: string | null;
  warPoints: number;
  warKills: number;
  warDeaths: number;
  lastWarAction: string | null;
  joinedAt: string;
}

// War Role Info
export interface WarRoleInfo {
  id: string;
  name: string;
  description: string;
  maxPerCrew: number | null;
  permissions: string[];
  bonuses: Record<string, number | boolean>;
}

// Crew War Stats
export interface CrewWarStats {
  crewId: number;
  warsWon: number;
  warsLost: number;
  warsStalemate: number;
  totalWarPoints: number;
  totalKills: number;
  totalDeaths: number;
  territoriesCaptured: number;
  territoriesLost: number;
  poisCaptured: number;
  cashWon: number;
  cashLost: number;
  currentWarStreak: number;
  bestWarStreak: number;
  lastWarDate: string | null;
}

// Peace Treaty
export interface PeaceTreaty {
  id: number;
  crew1Id: number;
  crew2Id: number;
  districtId: number;
  warId: number | null;
  treatyType: 'standard' | 'surrender' | 'mutual';
  expiresAt: string;
  terms: Record<string, any>;
  createdAt: string;
}

// Territory Map Response
export interface TerritoryMapResponse {
  territories: Territory[];
  activeWars: TerritoryWar[];
  playerCrewId: number | null;
  playerCrewName: string | null;
}

// Active Wars Response
export interface ActiveWarsResponse {
  wars: ActiveWar[];
  isInCrew: boolean;
  crewId?: number;
}

// War Status Response
export interface WarStatusResponse {
  war: TerritoryWar;
  pois: PoiControl[];
  topContributors: WarContributor[];
  recentEvents: WarEvent[];
  isInvolved: boolean;
  playerCrewId: number | null;
  playerSide: 'attacker' | 'defender' | null;
}

// POI Status Response
export interface PoiStatusResponse {
  warId: number;
  districtName: string;
  status: WarStatus;
  pois: PoiControl[];
  summary: {
    total: number;
    yourControl: number;
    enemyControl: number;
    neutral: number;
    contested: number;
    beingCapturedByYou: number;
    beingCapturedByEnemy: number;
  };
}

// Crew Ranks Response
export interface CrewRanksResponse {
  ranks: CrewRank[];
  isLeader: boolean;
  canManageRanks: boolean;
}

// Crew Members Response
export interface CrewMembersResponse {
  members: CrewMemberWithRank[];
  roleCounts: Record<string, number>;
  totalMembers: number;
}

// =====================================================
// PHASE 9: LEGAL BUSINESS FRONTS AND MONEY LAUNDERING
// =====================================================

// Business Front Type
export interface BusinessFrontType {
  id: number;
  name: string;
  typeCode: string;
  description: string;
  setupCost: number;
  monthlyExpenses: number;
  baseLaunderingRate: number;
  maxDailyLaundering: number;
  minLegitimacy: number;
  requiredPropertyTypes: string[];
  employeeSlots: number;
  baseEmployeeCost: number;
  taxRate: number;
  auditRiskMultiplier: number;
  requiredLevel: number;
  requiredConnections: number;
  icon: string;
  canUnlock?: boolean;
  meetsLevel?: boolean;
  meetsConnections?: boolean;
}

// Business Front
export interface BusinessFront {
  id: number;
  name: string;
  typeName: string;
  typeCode: string;
  typeIcon: string;
  propertyId: number;
  propertyName: string;
  districtName: string;
  legitimacyRating: number;
  reputation: number;
  isOperational: boolean;
  operatingHours: string;
  dailyCustomers: number;
  employeeCount: number;
  employeeSlots: number;
  employeeQuality: number;
  hasLicense: boolean;
  licenseExpiresAt: string | null;
  dirtyCashStored: number;
  cleanCashPending: number;
  pendingLaundering: number;
  totalLaundered: number;
  baseLaunderingRate: number;
  effectiveLaunderingRate?: number;
  maxDailyLaundering: number;
  monthlyExpenses: number;
  taxRate: number;
  isUnderInvestigation: boolean;
  auditFlags: number;
  lastAuditDate: string | null;
  createdAt: string;
}

// Business Employee
export interface BusinessEmployee {
  id: number;
  name: string;
  role: string;
  salary: number;
  quality: number;
  loyalty: number;
  isLegitimate: boolean;
  knowsAboutLaundering: boolean;
  hiredAt: string;
}

// Business Operation Log Entry
export interface BusinessOperationLog {
  id: number;
  type: string;
  revenue: number;
  expenses: number;
  customersServed: number;
  occurredAt: string;
}

// Business Event
export interface BusinessEvent {
  id: number;
  type: string;
  title: string;
  description: string;
  choices: BusinessEventChoice[];
  occurredAt: string;
  expiresAt: string | null;
}

// Business Event Choice
export interface BusinessEventChoice {
  id: string;
  text: string;
  cost: number;
  success_rate: number;
  legitimacy_change: number;
  outcome_success: string;
  outcome_fail: string;
}

// Business Review
export interface BusinessReview {
  id: number;
  rating: number;
  text: string;
  type: string;
  createdAt: string;
}

// Laundering Operation
export interface LaunderingOp {
  id: number;
  businessId: number;
  businessName: string;
  businessIcon?: string;
  dirtyAmount: number;
  cleanAmount: number;
  fee: number;
  feePercent: number;
  startedAt: string;
  completesAt: string;
  isReady: boolean;
  wasFlagged: boolean;
  flagReason: string | null;
}

// Laundering Status
export interface LaunderingStatus {
  dirtyCash: number;
  cleanCash: number;
  totalTaxesPaid: number;
  totalDirtyStored: number;
  totalCleanPending: number;
  totalLaundered: number;
  pendingDirtyAmount: number;
  pendingCleanAmount: number;
  recentFlags: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  launderingFeePercent: number;
}

// Cash Transaction Flag
export interface CashTransactionFlag {
  id: number;
  businessName: string | null;
  transactionType: string;
  amount: number;
  flagType: string;
  reason: string;
  reportedToAuthorities: boolean;
  createdAt: string;
}

// Tax Record
export interface TaxRecord {
  id: number;
  businessId: number;
  businessName: string;
  period: string;
  grossIncome: number;
  reportedIncome: number;
  taxesOwed: number;
  taxesPaid: number;
  remaining: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'partial' | 'overdue' | 'audited';
  isOverdue: boolean;
  auditFlag: boolean;
  penalty: number;
}

// Tax Attorney
export interface TaxAttorney {
  id: number;
  name: string;
  tier: number;
  description: string;
  monthlyRetainer: number;
  auditReduction: number;
  investigationHelp: number;
  icon: string;
  spotsAvailable: number | 'Unlimited';
}

// Player Attorney Relationship
export interface PlayerAttorney {
  name: string;
  tier: number;
  retainerFee: number;
  retainerPaidUntil: string;
  isActive: boolean;
  casesHandled: number;
  auditReduction: number;
}

// Investigation Stage
export type InvestigationStage = 'preliminary' | 'active' | 'subpoena' | 'charges_filed' | 'resolved' | 'dismissed';

// Investigation
export interface Investigation {
  id: number;
  businessId: number | null;
  businessName: string | null;
  type: string;
  triggerReason: string;
  stage: InvestigationStage | 'unknown';
  severity: number;
  evidenceStrength: number | null;
  evidenceCollected?: any[];
  leadAgent: string | null;
  agency: string;
  startedAt: string;
  playerNotifiedAt: string | null;
  subpoenaIssuedAt: string | null;
  chargesFiledAt: string | null;
  isKnown: boolean;
  canRespond: boolean;
  possibleConsequences: InvestigationConsequences | null;
  notes?: any[];
}

// Investigation Consequences
export interface InvestigationConsequences {
  fineMin: number;
  fineMax: number;
  jailHoursMin: number;
  jailHoursMax: number;
  assetSeizurePercent: number;
}

// Defense Option
export interface DefenseOption {
  id: string;
  name: string;
  description: string;
  cost: number;
  successChance: number;
  severityReduction?: number;
  consequence?: string;
}

// Investigation History Entry
export interface InvestigationHistoryEntry {
  id: number;
  businessName: string | null;
  type: string;
  outcome: string;
  fineAmount: number;
  jailHours: number;
  assetsSeized: number;
  resolvedAt: string;
}

// Business Fronts Response
export interface BusinessFrontsResponse {
  businesses: BusinessFront[];
  summary: {
    totalBusinesses: number;
    totalDirtyCashStored: number;
    totalPendingLaundering: number;
    totalLaundered: number;
    averageLegitimacy: number;
  };
}

// Business Detail Response
export interface BusinessDetailResponse {
  business: BusinessFront;
  employees: BusinessEmployee[];
  employeeSlots: number;
  recentOperations: BusinessOperationLog[];
  pendingLaundering: LaunderingOp[];
  reviews: BusinessReview[];
  activeEvents: BusinessEvent[];
}

// Tax Status Response
export interface TaxStatusResponse {
  totalTaxesPaid: number;
  totalTaxEvasion: number;
  totalOwed: number;
  overdueCount: number;
  pendingTaxes: TaxRecord[];
  recentPayments: {
    id: number;
    businessName: string;
    period: string;
    taxesPaid: number;
    paidAt: string;
  }[];
}

// Attorneys Response
export interface AttorneysResponse {
  currentAttorney: PlayerAttorney | null;
  availableAttorneys: TaxAttorney[];
}

// Investigations Response
export interface InvestigationsResponse {
  investigations: Investigation[];
  totalActive: number;
  knownInvestigations: number;
  hasAttorney: boolean;
  attorneyName?: string;
  attorneyHelpPercent?: number;
}

// =====================================================
// PHASE 10: REPUTATION AND FACTION SYSTEMS
// =====================================================

// Faction Types
// 2091 Faction Types (includes legacy types for backward compatibility)
export type FactionType =
  | 'gang' | 'mafia' | 'cartel' | 'syndicate' | 'corporate' | 'government'  // Legacy types
  | 'tech_collective' | 'resistance' | 'enforcement' | 'underground';        // 2091 types

// 2091 Faction Ranks
export type FactionRank =
  | 'outsider' | 'associate' | 'member' | 'made' | 'captain' | 'underboss' | 'boss'  // Legacy ranks
  | 'contact' | 'trusted' | 'lieutenant' | 'commander' | 'council';                   // 2091 ranks

export type WarState = 'peace' | 'tension' | 'cold_war' | 'hot_war' | 'total_war';

// 2091 Mission Types
export type FactionMissionType =
  | 'collection' | 'enforcement' | 'defense' | 'expansion' | 'war' | 'smuggling'  // Classic types
  | 'recruitment' | 'heist' | 'assassination' | 'sabotage'                         // Classic types cont.
  | 'data_extraction' | 'grid_hack' | 'supply_run' | 'mesh_defense'                // 2091 types
  | 'corporate_infiltration' | 'blackout_ops' | 'territory_scan'                   // 2091 types cont.
  | 'resource_acquisition' | 'signal_intercept' | 'dead_drop' | 'extraction';      // 2091 types cont.

// 2091 Faction Codes
export type FactionCode = 'NNB' | 'FFN' | 'HNC' | 'LST';

// 2091 Sector Codes (Toronto Districts)
export type SectorCode =
  | 'ON-0' | 'ON-1' | 'ON-2' | 'ON-3' | 'ON-4' | 'ON-5'
  | 'ON-6' | 'ON-7' | 'ON-8' | 'ON-9' | 'ON-10' | 'ON-11'
  | 'ON-12' | 'ON-13' | 'ON-14';

// 2091 Resource Types
export type FactionResourceType =
  | 'nuclear_cells' | 'data_packets' | 'clean_water' | 'organic_goods'
  | 'weapons' | 'chems' | 'contraband' | 'credits' | 'energy_credits';
export type StoryChapter = 'introduction' | 'rising' | 'initiation' | 'climb' | 'crisis' | 'resolution';

// Reputation Level
export interface ReputationLevel {
  min: number;
  max: number;
  name: string;
  canInteract: boolean;
  attackOnSight: boolean;
}

// Faction (base interface)
export interface Faction {
  id: number;
  name: string;
  type: FactionType;
  territoryDistrictIds: number[];
  hqPoiId?: number;
  ideology: string;
  backgroundLore: string;
  leaderNpcId?: number;
  color: string;
  icon: string;
  hostilities: Record<number, number>;
  powerLevel: number;
  wealth: number;
  memberCount: number;
  isRecruitable: boolean;
  minLevelToJoin: number;
  isActive: boolean;
}

// 2091 Extended Faction (includes cyberpunk-specific fields)
export interface Faction2091 extends Faction {
  code: FactionCode;                    // NNB, FFN, HNC, LST
  slogan: string;                       // Faction motto
  hydranetChannel: string;              // HydraNet broadcast channel
  primarySector: SectorCode;            // Main sector of operations
  resourceType: FactionResourceType;    // Primary resource they trade
  controlStyle: string;                 // How they govern (council, hierarchy, etc.)
  techLevel: number;                    // 1-10, how advanced their tech is
  visibility: 'public' | 'semi_hidden' | 'hidden' | 'underground';
}

// 2091 Faction Territory
export interface FactionTerritory2091 {
  id: number;
  factionId: number;
  sectorCode: SectorCode;
  controlPercentage: number;
  contestedBy?: number;
  infrastructureControl: {
    power: number;
    water: number;
    data: number;
    transit: number;
  };
  notableLocations: string[];
  dailyIncome: number;
  defenseRating: number;
  lastConflict?: string;
  establishedAt: string;
}

// 2091 Faction Resources
export interface FactionResource {
  id: number;
  factionId: number;
  resourceType: FactionResourceType;
  quantity: number;
  productionRate: number;
  consumptionRate: number;
  tradeValue: number;
  isTradeable: boolean;
  updatedAt: string;
}

// Player Faction History (action log)
export interface PlayerFactionHistory {
  id: number;
  playerId: number;
  factionId: number;
  actionType: string;
  reputationChange: number;
  oldRank?: FactionRank;
  newRank?: FactionRank;
  description: string;
  relatedMissionId?: number;
  timestamp: string;
}

// Faction with player reputation
export interface FactionWithRep extends Faction {
  playerReputation: number;
  playerRank: FactionRank;
  missionsCompleted: number;
  isBanned: boolean;
  reputationLevel: ReputationLevel;
}

// Player Faction Reputation
export interface PlayerFactionRep {
  id: number;
  playerId: number;
  factionId: number;
  reputation: number;
  rank: FactionRank;
  missionsCompleted: number;
  membersKilled: number;
  moneyDonated: number;
  territoriesDefended: number;
  enemiesKilled: number;
  joinedAt?: string;
  lastInteraction: string;
  isBanned: boolean;
  banReason?: string;
}

// Faction Mission
export interface FactionMission {
  id: number;
  factionId: number;
  name: string;
  description: string;
  missionType: FactionMissionType;
  minRank: FactionRank;
  minReputation: number;
  reputationReward: number;
  cashReward: number;
  xpReward: number;
  enemyFactionId?: number;
  enemyFactionName?: string;
  enemyFactionIcon?: string;
  targetNpcId?: number;
  targetPoiId?: number;
  targetDistrictId?: number;
  objectives: MissionObjective[];
  timeLimitMinutes: number;
  difficulty: number;
  cooldownHours: number;
  maxDailyCompletions: number;
  requiredCrewSize: number;
  isStoryMission: boolean;
  storyOrder?: number;
  prerequisites: number[];
  isActive: boolean;
  icon: string;
}

// Mission Objective
export interface MissionObjective {
  type: string;
  target?: string;
  location?: string;
  count?: number;
  item?: string;
  faction?: number;
  duration?: number;
  minAmount?: number;
}

// Available Faction Mission (with player-specific data)
export interface AvailableFactionMission extends FactionMission {
  canAccept: boolean;
  isActive: boolean;
  isOnCooldown: boolean;
  dailyLimitReached: boolean;
  completionsToday: number;
  cooldownEnds?: string;
  meetsRankRequirement: boolean;
  meetsRepRequirement: boolean;
  storyAvailable: boolean;
}

// Active Faction Mission
export interface ActiveFactionMission {
  id: number;
  playerId: number;
  missionId: number;
  factionId: number;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  progress: Record<string, number>;
  startedAt: string;
  expiresAt: string;
  completedAt?: string;
  crewMembers: number[];
  rewardsClaimed: boolean;
  // Mission details
  name: string;
  description: string;
  missionType: FactionMissionType;
  objectives: MissionObjective[];
  reputationReward: number;
  cashReward: number;
  xpReward: number;
  difficulty: number;
  icon: string;
  factionName: string;
  factionIcon: string;
  factionColor: string;
}

// Faction War
export interface FactionWar {
  id: number;
  aggressorFactionId: number;
  defenderFactionId: number;
  aggressorName: string;
  aggressorIcon: string;
  defenderName: string;
  defenderIcon: string;
  warState: WarState;
  aggressorScore: number;
  defenderScore: number;
  territoriesContested: number[];
  casualtiesAggressor: number;
  casualtiesDefender: number;
  startedAt: string;
  escalatedAt?: string;
  endedAt?: string;
  outcome?: string;
  peaceTerms?: Record<string, any>;
}

// Faction Shop Item
export interface FactionShopItem {
  id: number;
  factionId: number;
  itemType: string;
  itemId?: number;
  name: string;
  description: string;
  basePrice: number;
  minRank: FactionRank;
  minReputation: number;
  discountPerRank: number;
  stockLimit?: number;
  currentStock?: number;
  restockHours: number;
  lastRestock: string;
  isActive: boolean;
  // Calculated fields
  discountPercent?: number;
  finalPrice?: number;
  canPurchase?: boolean;
}

// Faction Safehouse
export interface FactionSafehouse {
  id: number;
  factionId: number;
  name: string;
  districtId?: number;
  poiId?: number;
  capacity: number;
  currentOccupants: number;
  amenities: string[];
  heatReduction: number;
  healingRate: number;
  isCompromised: boolean;
  minRank: FactionRank;
  isActive: boolean;
}

// Faction Story Progress
export interface FactionStoryProgress {
  id: number;
  playerId: number;
  factionId: number;
  currentChapter: StoryChapter;
  chapterProgress: number;
  choicesMade: number[];
  storyFlags: Record<string, any>;
  startedAt: string;
  lastProgress: string;
  completedAt?: string;
}

// Player Standing (for faction summary)
export interface PlayerFactionStanding {
  reputation: number;
  rank: FactionRank;
  missionsCompleted: number;
  membersKilled: number;
  moneyDonated: number;
  reputationLevel: ReputationLevel;
  nextRank: FactionRank;
  repToNextRank: number;
}

// =====================================================
// PHASE 10: API RESPONSES
// =====================================================

// Factions List Response
export interface FactionsListResponse {
  factions: FactionWithRep[];
}

// Faction Details Response
export interface FactionDetailsResponse {
  faction: Faction;
  playerStanding: PlayerFactionStanding;
  members: {
    id: number;
    username: string;
    level: number;
    reputation: number;
    rank: FactionRank;
    missionsCompleted: number;
  }[];
  activeWars: {
    id: number;
    enemyName: string;
    enemyIcon: string;
    warState: WarState;
    ourRole: 'aggressor' | 'defender';
    ourScore: number;
    enemyScore: number;
  }[];
  safehouses: FactionSafehouse[];
  storyProgress: FactionStoryProgress | null;
  rankThresholds: Record<FactionRank, number>;
}

// Faction Missions Response
export interface FactionMissionsResponse {
  playerRank: FactionRank;
  playerReputation: number;
  missions: {
    available: AvailableFactionMission[];
    locked: AvailableFactionMission[];
    active: AvailableFactionMission[];
  };
  storyProgress?: FactionStoryProgress;
}

// Faction Shop Response
export interface FactionShopResponse {
  items: FactionShopItem[];
  playerRank: FactionRank;
  playerReputation: number;
}

// Faction Relationships Response
export interface FactionRelationshipsResponse {
  activeWars: FactionWar[];
  factions: {
    id: number;
    name: string;
    hostilities: Record<number, number>;
    icon: string;
    color: string;
  }[];
}

// Player Faction Standing Response
export interface PlayerFactionStandingResponse {
  allStandings: (Faction & {
    reputation: number;
    rank: FactionRank;
    missionsCompleted: number;
    membersKilled: number;
    moneyDonated: number;
    isBanned: boolean;
    joinedAt?: string;
    reputationLevel: ReputationLevel;
  })[];
  grouped: {
    hostile: any[];
    unfriendly: any[];
    neutral: any[];
    friendly: any[];
    allied: any[];
  };
}

// Mission Accept Response
export interface FactionMissionAcceptResponse {
  message: string;
  mission: FactionMission & {
    activeId: number;
    expiresAt: string;
    progress: Record<string, number>;
  };
}

// Mission Complete Response
export interface FactionMissionCompleteResponse {
  message: string;
  rewards: {
    cash: number;
    xp: number;
    reputation: number;
  };
  factionStanding: {
    newReputation: number;
    newRank: FactionRank;
    levelName: string;
  };
  enemyRepLost: number;
}

// Donation Response
export interface FactionDonationResponse {
  message: string;
  reputationGained: number;
  newReputation: number;
  newRank: FactionRank;
  reputationLevel: ReputationLevel;
}

// Join/Leave Faction Response
export interface FactionMembershipResponse {
  message: string;
  rank?: FactionRank;
  faction?: string;
  reputationPenalty?: number;
}

// Active Faction Missions Response
export interface ActiveFactionMissionsResponse {
  activeMissions: ActiveFactionMission[];
  expiredMissions: number;
}

// Mission History Response
export interface FactionMissionHistoryResponse {
  history: {
    id: number;
    missionId: number;
    factionId: number;
    completedAt: string;
    wasSuccessful: boolean;
    reputationEarned: number;
    cashEarned: number;
    name: string;
    missionType: FactionMissionType;
    difficulty: number;
    icon: string;
    factionName: string;
    factionIcon: string;
  }[];
  stats: {
    totalCompleted: number;
    successful: number;
    totalRepEarned: number;
    totalCashEarned: number;
  };
}

// =====================================================
// PHASE 11: PVP COMBAT AND BOUNTY SYSTEM
// =====================================================

// Combat Types
export type CombatAction = 'attack' | 'defend' | 'heavy_attack' | 'flee';
export type CombatStatus = 'active' | 'attacker_won' | 'defender_won' | 'draw' | 'fled' | 'timeout';
export type BountyStatus = 'active' | 'claimed' | 'expired' | 'cancelled' | 'paid_off';
export type InjurySeverity = 1 | 2 | 3 | 4 | 5;

// Combat Stats
export interface CombatStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  accuracy: number;
  evasion: number;
}

// Combat Session
export interface CombatSession {
  id: number;
  attackerId: number;
  defenderId: number;
  districtId: number;
  status: CombatStatus;
  currentRound: number;
  maxRounds: number;
  attackerHealth: number;
  defenderHealth: number;
  attackerStartingHealth: number;
  defenderStartingHealth: number;
  attackerAction?: CombatAction;
  defenderAction?: CombatAction;
  combatLog: CombatLogEntry[];
  lootAmount: number;
  winnerId?: number;
  startedAt: string;
  lastActionAt: string;
  endedAt?: string;
}

// Combat Log Entry
export interface CombatLogEntry {
  round: number;
  type: 'combat_start' | 'action' | 'damage' | 'miss' | 'critical' | 'combat_end';
  attackerAction?: CombatAction;
  defenderAction?: CombatAction;
  attackerDamage?: number;
  defenderDamage?: number;
  attackerHealth?: number;
  defenderHealth?: number;
  player?: 'attacker' | 'defender';
  message: string;
  damage?: number;
  critical?: boolean;
  timestamp: string;
  events?: any[];
}

// Combat History
export interface CombatHistory {
  id: number;
  attackerId: number;
  defenderId: number;
  winnerId?: number;
  attackerUsername: string;
  defenderUsername: string;
  winnerUsername?: string;
  districtId: number;
  roundsFought: number;
  attackerDamageDealt: number;
  defenderDamageDealt: number;
  lootTransferred: number;
  combatXpGained: number;
  wasBountyKill: boolean;
  bountyClaimed: number;
  occurredAt: string;
  wasAttacker?: boolean;
  won?: boolean;
}

// Combat Record
export interface CombatRecord {
  kills: number;
  deaths: number;
  kdr: string;
  currentStreak: number;
  bestStreak: number;
  combatLevel: number;
  combatXp: number;
  xpToNextLevel: number;
  bountiesClaimed: number;
}

// Bounty
export interface Bounty {
  id: number;
  targetPlayerId: number;
  placedByPlayerId?: number;
  amount: number;
  reason?: string;
  isAnonymous: boolean;
  status: BountyStatus;
  isAutoBounty: boolean;
  autoBountyType?: string;
  expiresAt: string;
  claimedByPlayerId?: number;
  claimedAt?: string;
  createdAt: string;
  // Joined fields
  targetUsername?: string;
  targetLevel?: number;
  targetDistrict?: number;
  targetLastSeen?: string;
  placedByUsername?: string;
  contributorCount?: number;
  totalContributions?: number;
  isMyBounty?: boolean;
  isOnMe?: boolean;
  timeRemaining?: number;
}

// Hitman
export interface Hitman {
  id: number;
  name: string;
  description: string;
  skillLevel: number;
  attack: number;
  defense: number;
  accuracy: number;
  successRate: number;
  priceMultiplier: number;
  minBountyAmount: number;
  icon: string;
  isActive: boolean;
}

// Bodyguard
export interface Bodyguard {
  type: string;
  name: string;
  protectionLevel: number;
  dailyCost: number;
  description?: string;
}

// Player Bodyguard
export interface PlayerBodyguard {
  id: number;
  playerId: number;
  bodyguardType: string;
  name: string;
  protectionLevel: number;
  dailyCost: number;
  hiredAt: string;
  expiresAt: string;
  isActive: boolean;
}

// Injury
export interface Injury {
  id: number;
  playerId: number;
  injuryType: string;
  injuryName: string;
  severity: InjurySeverity;
  effects: Record<string, number>;
  source: string;
  sourcePlayerId?: number;
  appliedAt: string;
  healsAt: string;
  isHealed: boolean;
  healedBy?: string;
  // Joined fields
  causedByUsername?: string;
  timeToHeal?: number;
}

// Injury Type
export interface InjuryType {
  id: number;
  name: string;
  typeCode: string;
  description: string;
  severity: InjurySeverity;
  baseHealMinutes: number;
  effects: Record<string, number>;
  icon: string;
}

// Hospital Service
export interface HospitalService {
  id: number;
  name: string;
  description: string;
  serviceType: string;
  baseCost: number;
  healTimeReduction: number;
  minSeverity: number;
  maxSeverity: number;
  isLegal: boolean;
  requiresLevel: number;
  icon: string;
}

// Combat Buff
export interface CombatBuff {
  id: number;
  playerId: number;
  buffType: string;
  buffName: string;
  statModifiers: Record<string, number>;
  source: string;
  appliedAt: string;
  expiresAt: string;
  isActive: boolean;
}

// Safe Zone
export interface SafeZone {
  id: number;
  name: string;
  zoneType: string;
  districtId?: number;
  poiId?: number;
  description: string;
  isActive: boolean;
}

// =====================================================
// PHASE 11: API RESPONSES
// =====================================================

// Combat Attack Response
export interface CombatAttackResponse {
  combatId: number;
  message: string;
  attacker: {
    id: number;
    username: string;
    health: number;
    maxHealth: number;
  };
  defender: {
    id: number;
    username: string;
    health: number;
    maxHealth: number;
  };
  currentRound: number;
  maxRounds: number;
}

// Combat Active Response
export interface CombatActiveResponse {
  inCombat: boolean;
  combatId?: number;
  isAttacker?: boolean;
  currentRound?: number;
  maxRounds?: number;
  yourHealth?: number;
  yourMaxHealth?: number;
  opponentHealth?: number;
  opponentMaxHealth?: number;
  opponentUsername?: string;
  yourActionSubmitted?: boolean;
  opponentActionSubmitted?: boolean;
  combatLog?: CombatLogEntry[];
  timeRemaining?: number;
  combatEnded?: boolean;
  reason?: string;
}

// Combat Action Response
export interface CombatActionResponse {
  action?: CombatAction;
  success?: boolean;
  message: string;
  waitingForOpponent?: boolean;
  damageTaken?: number;
  cashLost?: number;
  combatEnded?: boolean;
  // Round result
  roundComplete?: boolean;
  round?: number;
  attackerHealth?: number;
  defenderHealth?: number;
  roundLog?: any[];
  nextRound?: number;
  // Combat end
  status?: CombatStatus;
  reason?: string;
  winner?: number;
  loser?: number;
  lootAmount?: number;
  combatXp?: number;
  finalAttackerHealth?: number;
  finalDefenderHealth?: number;
}

// Combat Stats Response
export interface CombatStatsResponse {
  stats: CombatStats & { level: number; stamina: number; staminaMax: number };
  record: CombatRecord;
  injuries: Injury[];
  buffs: CombatBuff[];
}

// Combat History Response
export interface CombatHistoryResponse {
  history: CombatHistory[];
}

// Bounty Board Response
export interface BountyBoardResponse {
  bounties: Bounty[];
  totalActiveBounties: number;
  totalBountyPool: number;
}

// My Bounties Response
export interface MyBountiesResponse {
  bountiesOnMe: Bounty[];
  totalBountyOnMe: number;
  bountiesPlaced: Bounty[];
  bountiesClaimed: Bounty[];
}

// Place Bounty Response
export interface PlaceBountyResponse {
  message: string;
  bountyId: number;
  totalCost: number;
  anonymousFee: number;
  expiresAt: string;
}

// Claim Bounty Response
export interface ClaimBountyResponse {
  message: string;
  amount: number;
  target: string;
}

// Payoff Bounty Response
export interface PayoffBountyResponse {
  message: string;
  cost: number;
  originalAmount: number;
}

// Hitman Response
export interface HitmenResponse {
  hitmen: Hitman[];
}

// Hire Hitman Response
export interface HireHitmanResponse {
  success: boolean;
  message: string;
  damageDealt: number;
  targetSurvived: boolean;
  bountyCompleted?: boolean;
  hitman: string;
  cost: number;
}

// Bodyguards Response
export interface BodyguardsResponse {
  bodyguards: Bodyguard[];
}

// Hire Bodyguard Response
export interface HireBodyguardResponse {
  message: string;
  cost: number;
  expiresAt: string;
}

// Hospital Status Response
export interface HospitalStatusResponse {
  health: number;
  maxHealth: number;
  healthPercent: number;
  isHospitalized: boolean;
  hospitalReleaseAt?: string;
  timeToRelease: number;
  injuries: Injury[];
  totalInjuries: number;
  statPenalties: Record<string, number>;
  services: HospitalService[];
}

// Heal Response
export interface HealResponse {
  message: string;
  cost: number;
  newHealsAt?: string;
  healed?: boolean;
  healthRestored?: number;
  newHealth?: number;
  injuriesHealed?: number;
  injuriesReduced?: number;
}

// Revive Response
export interface ReviveResponse {
  message: string;
  cost: number;
  minutesSaved: number;
}

// Rest Response
export interface RestResponse {
  message: string;
  health: number;
  maxHealth: number;
  healRate: string;
  estimatedFullHealth: string;
}

// =====================================================
// PHASE 6 (2091): WORLD EVENTS & AI GRID SYSTEM
// =====================================================

// Sector Codes (ON-0 through ON-14)
export type SectorCode2091 =
  | 'ON-0' | 'ON-1' | 'ON-2' | 'ON-3' | 'ON-4'
  | 'ON-5' | 'ON-6' | 'ON-7' | 'ON-8' | 'ON-9'
  | 'ON-10' | 'ON-11' | 'ON-12' | 'ON-13' | 'ON-14';

// Grid Status
export type GridStatus = 'active' | 'degraded' | 'offline' | 'blackout';

// Alert Level
export type AlertLevel = 'minimal' | 'normal' | 'elevated' | 'high' | 'critical' | 'lockdown';

// Sector Surveillance
export interface SectorSurveillance {
  id: number;
  sectorCode: SectorCode2091;
  surveillanceLevel: number;  // 0-100
  gridStatus: GridStatus;
  droneDensity: number;  // 0-20
  scannerCoverage: number;  // 0.00-1.00
  hncPresence: number;  // 0-100
  lastSweep: string;
  sweepIntervalMinutes: number;
  alertLevel: AlertLevel;
}

// Player Heat (AI Grid tracking)
export interface PlayerHeat {
  id: number;
  playerId: number;
  heatLevel: number;  // 0-100
  lastCrimeDetected: string | null;
  crimesInSession: number;
  currentSector: SectorCode2091;
  isFlagged: boolean;
  flagReason: string | null;
  flagExpiresAt: string | null;
  droneTracking: boolean;
  lastScanEvaded: string | null;
  totalScansEvaded: number;
  totalDetections: number;
  bountyFromHnc: number;
}

// Grid Incident Types
export type GridIncidentType =
  | 'crime_detected' | 'scan_evaded' | 'pursuit_initiated' | 'pursuit_escaped'
  | 'pursuit_caught' | 'grid_hack' | 'drone_destroyed' | 'blackout_triggered'
  | 'surveillance_disrupted' | 'hnc_patrol' | 'checkpoint_encounter' | 'identity_scanned';

// Grid Incident
export interface GridIncident {
  id: number;
  incidentType: GridIncidentType;
  playerId: number | null;
  sectorCode: SectorCode2091;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
  heatChange: number;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

// World Event Categories
export type WorldEventCategory =
  | 'grid' | 'faction' | 'economic' | 'environmental' | 'crisis' | 'opportunity' | 'special';

// World Event Rarity
export type WorldEventRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// World Event Effects (JSON structure)
export interface WorldEventEffects {
  payoutBonus?: number;
  xpBonus?: number;
  heatReduction?: number;
  heatMultiplier?: number;
  successBonus?: number;
  surveillanceDisabled?: boolean;
  detectionBonus?: number;
  dronesDense?: boolean;
  scannersBypass?: boolean;
  heatGainReduction?: number;
  ffnReputationBonus?: number;
  randomEffects?: boolean;
  chaosFactor?: number;
  heatRandom?: boolean;
  nnbZoneSafe?: boolean;
  healingBonus?: number;
  communityBonus?: boolean;
  dataRewards?: boolean;
  ffnMissionBonus?: number;
  intelGain?: boolean;
  checkpointsActive?: boolean;
  hncBonusPay?: number;
  shopDiscount?: number;
  rareItemsAvailable?: boolean;
  lstZoneActive?: boolean;
  bankInterestBonus?: number;
  payoutPenalty?: number;
  crimeDemandBonus?: number;
  desperation?: boolean;
  mercWorkAvailable?: boolean;
  missionPayBonus?: number;
  heatFromCorp?: boolean;
  outdoorPenalty?: number;
  indoorBonus?: number;
  healthDrain?: boolean;
  techFailureChance?: number;
  overchargeBonus?: number;
  reactorBonus?: boolean;
  visibilityPenalty?: number;
  stealthBonus?: number;
  factionTensionBonus?: number;
  pvpEnabled?: boolean;
  sectorLockdown?: boolean;
  hazardBonus?: number;
  heatSuspended?: boolean;
  bountyBonusMultiplier?: number;
  androidEnemies?: boolean;
  synthsHostile?: boolean;
  infoBrokerActive?: boolean;
  intelTrading?: boolean;
  artifactHuntActive?: boolean;
  rareDropBonus?: number;
  memorialActive?: boolean;
  hncMissionsBonus?: number;
  surveillanceIntense?: boolean;
  festivalRewards?: boolean;
}

// World Event Participation Rewards (JSON structure)
export interface WorldEventReward {
  xp?: number;
  cash?: number;
  reputation_nnb?: number;
  reputation_ffn?: number;
  reputation_hnc?: number;
  reputation_lst?: number;
  faction_rep_any?: number;
  healing?: number;
  rare_item?: boolean;
  legendary_item?: boolean;
  intel_item?: boolean;
  commemorative_item?: boolean;
}

// World Event Definition (2091)
export interface WorldEvent2091 {
  id: number;
  eventKey: string;
  name: string;
  description: string;
  loreText: string | null;
  eventCategory: WorldEventCategory;
  affectedSectors: SectorCode2091[] | null;  // null = global
  effects: WorldEventEffects;
  requirements: {
    minLevel?: number;
    factionRequired?: string;
  } | null;
  durationHours: number;
  rarity: WorldEventRarity;
  triggerChance: number;
  icon: string;
  isPositive: boolean;
  canParticipate: boolean;
  participationReward: WorldEventReward | null;
  minParticipants: number;
  maxConcurrent: number;
}

// Active World Event
export interface ActiveWorldEvent {
  id: number;
  eventKey: string;
  event: WorldEvent2091;  // Joined data
  affectedSectors: SectorCode2091[] | null;
  startedAt: string;
  endsAt: string;
  triggeredBy: 'system' | 'admin' | 'faction_action' | 'player_action';
  triggerPlayerId: number | null;
  participants: number;
  isActive: boolean;
  timeRemaining: number;  // Calculated
}

// Event Participation
export interface EventParticipation {
  id: number;
  eventId: number;
  playerId: number;
  joinedAt: string;
  contributionScore: number;
  rewardsClaimed: boolean;
  rewardsData: WorldEventReward | null;
}

// Pursuit Level
export interface PursuitLevel {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  description: string;
  drones: number;
  enforcers: number;
  escapeDifficulty: number;
  heatRequired: number;
  penaltyCashPercent: number;
  penaltyJailMinutes: number;
  icon: string;
}

// HNC Pursuit (active pursuit on player)
export interface HNCPursuit {
  id: number;
  playerId: number;
  pursuitLevel: 1 | 2 | 3 | 4 | 5;
  levelInfo: PursuitLevel;  // Joined data
  startedAt: string;
  lastSpottedSector: SectorCode2091 | null;
  lastSpottedAt: string | null;
  dronesAssigned: number;
  enforcersAssigned: number;
  isActive: boolean;
  escapedAt: string | null;
  caughtAt: string | null;
  escapeMethod: string | null;
  penaltyApplied: {
    cashLost?: number;
    jailMinutes?: number;
  } | null;
}

// =====================================================
// PHASE 6: API RESPONSES
// =====================================================

// Sector Surveillance Response
export interface SectorSurveillanceResponse {
  sectors: SectorSurveillance[];
  globalAlertLevel: AlertLevel;
  ariaCoreStatus: 'online' | 'degraded' | 'offline';
}

// Player Heat Response
export interface PlayerHeatResponse {
  heat: PlayerHeat;
  currentSector: SectorSurveillance;
  pursuitStatus: HNCPursuit | null;
  recentIncidents: GridIncident[];
  detectionChance: number;  // Calculated based on heat + sector
  recommendations: string[];  // Tips to reduce heat
}

// Active Events Response
export interface ActiveEventsResponse {
  events: ActiveWorldEvent[];
  globalEvents: ActiveWorldEvent[];
  sectorEvents: ActiveWorldEvent[];
  upcomingEvents: WorldEvent2091[];  // Potential events based on conditions
  playerParticipating: EventParticipation[];
}

// Event Details Response
export interface EventDetailsResponse {
  event: ActiveWorldEvent;
  participation: EventParticipation | null;
  topContributors: {
    playerId: number;
    username: string;
    score: number;
    rank: number;
  }[];
  totalParticipants: number;
  canJoin: boolean;
  joinRequirements: string[] | null;
}

// Join Event Response
export interface JoinEventResponse {
  success: boolean;
  message: string;
  participation: EventParticipation;
  eventEffects: string[];  // Active effects from this event
}

// Claim Event Rewards Response
export interface ClaimEventRewardsResponse {
  success: boolean;
  message: string;
  rewards: WorldEventReward;
  contribution: {
    score: number;
    rank: number;
    totalParticipants: number;
  };
}

// Grid Status Response
export interface GridStatusResponse {
  ariaStatus: 'online' | 'degraded' | 'offline' | 'hostile';
  globalSurveillance: number;  // Average across all sectors
  activeBlackouts: SectorCode2091[];
  hncAlertLevel: AlertLevel;
  activePursuits: number;  // Server-wide count
  recentGridHacks: number;
  gridHealthPercent: number;
}

// Pursuit Status Response
export interface PursuitStatusResponse {
  isPursued: boolean;
  pursuit: HNCPursuit | null;
  escapeOptions: {
    method: string;
    description: string;
    successChance: number;
    cost: number;
    requirements: string[];
  }[];
  nearestSafeSectors: SectorCode2091[];
  timeBeforeEscalation: number | null;  // Seconds until pursuit level increases
}

// Evade Pursuit Response
export interface EvadePursuitResponse {
  success: boolean;
  message: string;
  methodUsed: string;
  heatReduced: number;
  newPursuitLevel: number | null;  // null if escaped
  costPaid: number;
  consequenceApplied: string | null;
}

// Grid Hack Response
export interface GridHackResponse {
  success: boolean;
  message: string;
  effectDuration: number;  // Seconds
  sectorAffected: SectorCode2091;
  surveillanceReduced: number;
  heatGained: number;  // If detected
  reputationGained: {
    ffn?: number;
    hnc?: number;  // negative
  };
}

// =====================================================
// PHASE 7: MONETIZATION & BATTLE PASS (2091)
// =====================================================

// Premium Currencies
export interface PlayerCurrencies2091 {
  cash: number;
  bank: number;
  synthCredits: number;
  hydraCoins: number;
  lifetimeHydraCoins: number;
}

// HydraCoin Package
export interface HydraCoinPackage {
  id: number;
  packageKey: string;
  name: string;
  description: string | null;
  coinAmount: number;
  bonusCoins: number;
  bonusSynthCredits: number;
  totalCoins: number;
  priceUsd: number;
  isFeatured: boolean;
  isBestValue: boolean;
  discountPercent: number;
  icon: string;
}

// Shop Category
export interface PremiumShopCategory {
  id: number;
  categoryKey: string;
  name: string;
  description: string | null;
  icon: string;
  itemCount: number;
}

// Shop Item Rarity
export type ShopItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Shop Item Type
export type ShopItemType = 'cosmetic' | 'booster' | 'currency' | 'bundle' | 'item' | 'title' | 'reactor' | 'cells';

// Premium Shop Item
export interface PremiumShopItem {
  id: number;
  itemKey: string;
  categoryKey: string;
  name: string;
  description: string | null;
  loreText: string | null;
  priceHydra: number;
  priceSynth: number;
  originalPriceHydra: number | null;
  itemType: ShopItemType;
  rewardData: Record<string, any> | null;
  stockLimit: number | null;
  currentStock: number | null;
  purchaseLimit: number | null;
  playerPurchases: number;
  availableUntil: string | null;
  requiredLevel: number;
  requiredFaction: string | null;
  icon: string;
  rarity: ShopItemRarity;
  isFeatured: boolean;
  isLimited: boolean;
  canPurchase: boolean;
  canAfford: boolean;
  meetsRequirements: boolean;
}

// Active Booster
export interface ActiveBooster {
  id: number;
  boosterType: 'xp' | 'cash' | 'heat_reduction' | 'cell_regen' | 'success' | 'stealth';
  multiplier: number;
  activatedAt: string;
  expiresAt: string;
  timeRemaining: number;
  source: string;
}

// Booster Effects (aggregated)
export interface BoosterEffects {
  xpMultiplier: number;
  cashMultiplier: number;
  heatReduction: number;
  cellRegenMultiplier: number;
}

// Daily Login Reward
export interface DailyLoginReward {
  dayNumber: number;
  rewardType: string;
  rewardValue: number;
  rewardName: string;
  rewardIcon: string;
  isClaimed: boolean;
  isToday: boolean;
  premiumBonusType: string | null;
  premiumBonusValue: number | null;
}

// Daily Login Status
export interface DailyLoginStatus {
  currentStreak: number;
  longestStreak: number;
  totalLogins: number;
  currentCycleDay: number;
  canClaim: boolean;
  lastClaimDate: string | null;
  hasPremium: boolean;
  rewards: DailyLoginReward[];
  todayReward: DailyLoginReward | null;
}

// Battle Pass Season (2091)
export interface BattlePassSeason2091 {
  id: number;
  name: string;
  theme: string;
  loreDescription: string | null;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isActive: boolean;
  premiumPriceHydra: number;
  premiumPriceSynth: number;
  maxTier: number;
  icon: string;
}

// Battle Pass Tier (2091)
export interface BattlePassTier2091 {
  id: number;
  seasonId: number;
  tier: number;
  tierName: string | null;
  xpRequired: number;
  isMilestone: boolean;
  freeRewardType: string | null;
  freeRewardValue: number | null;
  freeRewardName: string | null;
  freeRewardIcon: string | null;
  freeRewardRarity: ShopItemRarity;
  premiumRewardType: string | null;
  premiumRewardValue: number | null;
  premiumRewardName: string | null;
  premiumRewardIcon: string | null;
  premiumRewardRarity: ShopItemRarity;
  isUnlocked: boolean;
  freeClaimed: boolean;
  premiumClaimed: boolean;
}

// Battle Pass Progress
export interface BattlePassProgress2091 {
  currentTier: number;
  xp: number;
  xpToNextTier: number;
  isPremium: boolean;
  claimedTiers: {
    free: number[];
    premium: number[];
  };
}

// Purchase Record
export interface PremiumPurchaseRecord {
  id: number;
  itemKey: string;
  itemName: string;
  icon: string;
  rarity: ShopItemRarity;
  priceHydra: number;
  priceSynth: number;
  quantity: number;
  rewardData: Record<string, any> | null;
  purchasedAt: string;
}

// =====================================================
// PHASE 7: API RESPONSES
// =====================================================

// Premium Shop Response
export interface PremiumShopResponse {
  currencies: {
    synthCredits: number;
    hydraCoins: number;
  };
  categories: PremiumShopCategory[];
  items: PremiumShopItem[];
  itemsByCategory: Record<string, PremiumShopItem[]>;
  featuredItems: string[];
}

// Shop Purchase Response
export interface ShopPurchaseResponse {
  success: boolean;
  message: string;
  itemName: string;
  pricePaid: {
    hydra: number;
    synth: number;
  };
  rewards: string[];
  newBalances: {
    synthCredits: number;
    hydraCoins: number;
  };
}

// Coin Packages Response
export interface CoinPackagesResponse {
  packages: HydraCoinPackage[];
}

// Active Boosters Response
export interface ActiveBoostersResponse {
  boosters: ActiveBooster[];
  activeEffects: BoosterEffects;
}

// Daily Login Claim Response
export interface DailyLoginClaimResponse {
  success: boolean;
  message: string;
  dayNumber: number;
  rewards: string[];
  baseReward: {
    type: string;
    value: number;
    name: string;
  };
  premiumBonus: {
    type: string;
    value: number;
  } | null;
  newStreak: number;
  nextDay: number;
}

// Battle Pass Response (2091)
export interface BattlePassResponse2091 {
  season: BattlePassSeason2091 | null;
  progress: BattlePassProgress2091;
  tiers: BattlePassTier2091[];
  currencies: {
    synthCredits: number;
    hydraCoins: number;
  };
  premiumPrices: {
    hydra: number;
    synth: number;
  };
}
