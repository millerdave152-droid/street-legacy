// Job to Mini-Game Mapping Configuration
// Maps each job type to its corresponding mini-game for bonus opportunities

// Import MINI_GAME_TYPES from CrimeGameMapping to include all game types
import { MINI_GAME_TYPES } from './CrimeGameMapping'

// Re-export for convenience
export { MINI_GAME_TYPES }

const COLORS = {
  GREEN: 0x22c55e,
  BLUE: 0x3b82f6,
  AMBER: 0xf59e0b,
  PURPLE: 0xa855f7,
  ORANGE: 0xf97316,
  CYAN: 0x06b6d4,
  RED: 0xef4444,
  GRAY: 0x6b7280,
  DARK: 0x0a0a0a,
  SUCCESS: 0x10b981,
}

/**
 * Job to mini-game mappings
 * Jobs use mini-games themed around work tasks rather than criminal activity
 */
export const JOB_GAME_MAPPINGS = {
  // ==========================================
  // TIER 1: ENTRY-LEVEL WORK (Level 1-5)
  // ==========================================

  dishwasher: {
    jobId: 'dishwasher',
    jobName: 'Dishwasher',
    gameType: MINI_GAME_TYPES.RHYTHM,
    difficulty: 1,
    timeLimit: 25,
    targetScore: 400,
    perfectScore: 700,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍽️'
    },
    description: 'Scrub to the rhythm!'
  },

  street_sweeper: {
    jobId: 'street_sweeper',
    jobName: 'Street Sweeper',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 1,
    timeLimit: 25,
    targetScore: 400,
    perfectScore: 700,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🧹'
    },
    description: 'Collect all the trash!'
  },

  sign_spinner: {
    jobId: 'sign_spinner',
    jobName: 'Sign Spinner',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 18,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📢'
    },
    description: 'Spin and flip that sign!'
  },

  grocery_bagger: {
    jobId: 'grocery_bagger',
    jobName: 'Grocery Bagger',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 1,
    timeLimit: 20,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🛒'
    },
    description: 'Bag items quickly!'
  },

  car_wash: {
    jobId: 'car_wash',
    jobName: 'Car Wash Attendant',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 1,
    timeLimit: 20,
    targetScore: 100,
    perfectScore: 180,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚿'
    },
    description: 'Wash every spot!'
  },

  recycling: {
    jobId: 'recycling',
    jobName: 'Recycling Collector',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 1,
    timeLimit: 25,
    targetScore: 4,
    perfectScore: 7,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '♻️'
    },
    description: 'Sort recyclables correctly!'
  },

  dog_walker: {
    jobId: 'dog_walker',
    jobName: 'Dog Walker',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 1,
    timeLimit: 22,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🐕'
    },
    description: 'Walk dogs safely through traffic!'
  },

  lawn_mowing: {
    jobId: 'lawn_mowing',
    jobName: 'Lawn Mowing',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 1,
    timeLimit: 25,
    targetScore: 500,
    perfectScore: 800,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🌿'
    },
    description: 'Mow the whole lawn!'
  },

  // ==========================================
  // TIER 2: SERVICE INDUSTRY (Level 5-15)
  // ==========================================

  fast_food: {
    jobId: 'fast_food',
    jobName: 'Fast Food Worker',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 22,
    targetScore: 12,
    perfectScore: 18,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: COLORS.AMBER,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍔'
    },
    description: 'Fill orders fast!'
  },

  barista: {
    jobId: 'barista',
    jobName: 'Barista',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: 0x8b4513,
      secondaryColor: 0x654321,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '☕'
    },
    description: 'Remember the drink orders!'
  },

  bartender: {
    jobId: 'bartender',
    jobName: 'Bartender',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 6,
    perfectScore: 10,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍸'
    },
    description: 'Mix drinks from memory!'
  },

  waiter: {
    jobId: 'waiter',
    jobName: 'Waiter/Waitress',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍽️'
    },
    description: 'Remember all the orders!'
  },

  housekeeper: {
    jobId: 'housekeeper',
    jobName: 'Hotel Housekeeper',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.CYAN,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🛏️'
    },
    description: 'Clean rooms quickly!'
  },

  cashier: {
    jobId: 'cashier',
    jobName: 'Retail Cashier',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 22,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💵'
    },
    description: 'Ring up customers fast!'
  },

  pizza_delivery: {
    jobId: 'pizza_delivery',
    jobName: 'Pizza Delivery',
    gameType: MINI_GAME_TYPES.GETAWAY,
    difficulty: 2,
    timeLimit: 40,
    targetScore: 600,
    perfectScore: 1000,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: COLORS.AMBER,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🍕'
    },
    description: 'Deliver hot and fast!'
  },

  food_delivery: {
    jobId: 'food_delivery',
    jobName: 'Food Delivery (App)',
    gameType: MINI_GAME_TYPES.GETAWAY,
    difficulty: 2,
    timeLimit: 35,
    targetScore: 550,
    perfectScore: 950,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📱'
    },
    description: 'Complete deliveries on time!'
  },

  // ==========================================
  // TIER 3: SKILLED LABOR (Level 10-25)
  // ==========================================

  warehouse: {
    jobId: 'warehouse',
    jobName: 'Warehouse Worker',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📦'
    },
    description: 'Navigate the busy warehouse!'
  },

  forklift: {
    jobId: 'forklift',
    jobName: 'Forklift Operator',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 150,
    perfectScore: 250,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏗️'
    },
    description: 'Lift pallets carefully!'
  },

  construction: {
    jobId: 'construction',
    jobName: 'Construction Laborer',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 12,
    perfectScore: 18,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔨'
    },
    description: 'Build it right!'
  },

  painter: {
    jobId: 'painter',
    jobName: 'Painter',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 180,
    perfectScore: 280,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎨'
    },
    description: 'Paint clean lines!'
  },

  mover: {
    jobId: 'mover',
    jobName: 'Mover',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 2,
    timeLimit: 32,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚚'
    },
    description: 'Move furniture safely!'
  },

  landscaper: {
    jobId: 'landscaper',
    jobName: 'Landscaper',
    gameType: MINI_GAME_TYPES.SNAKE,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 600,
    perfectScore: 1000,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🌳'
    },
    description: 'Trim the entire yard!'
  },

  carpet_installer: {
    jobId: 'carpet_installer',
    jobName: 'Carpet Installer',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 3,
    timeLimit: 32,
    targetScore: 200,
    perfectScore: 320,
    theme: {
      primaryColor: 0x8b4513,
      secondaryColor: 0x654321,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏠'
    },
    description: 'Cut and lay perfectly!'
  },

  assembly_line: {
    jobId: 'assembly_line',
    jobName: 'Assembly Line Worker',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 14,
    perfectScore: 20,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '⚙️'
    },
    description: 'Keep up with the line!'
  },

  auto_detailer: {
    jobId: 'auto_detailer',
    jobName: 'Auto Detailer',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 160,
    perfectScore: 260,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '✨'
    },
    description: 'Detail every inch!'
  },

  demolition: {
    jobId: 'demolition',
    jobName: 'Demolition Worker',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 15,
    perfectScore: 22,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: COLORS.AMBER,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💥'
    },
    description: 'Demolish safely!'
  },

  // ==========================================
  // TIER 4: DRIVING & DELIVERY (Level 8-20)
  // ==========================================

  rideshare: {
    jobId: 'rideshare',
    jobName: 'Rideshare Driver',
    gameType: MINI_GAME_TYPES.GETAWAY,
    difficulty: 2,
    timeLimit: 40,
    targetScore: 650,
    perfectScore: 1100,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚗'
    },
    description: 'Pick up passengers on time!'
  },

  taxi: {
    jobId: 'taxi',
    jobName: 'Taxi Driver',
    gameType: MINI_GAME_TYPES.GETAWAY,
    difficulty: 2,
    timeLimit: 42,
    targetScore: 700,
    perfectScore: 1200,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚕'
    },
    description: 'Navigate the city fast!'
  },

  truck_local: {
    jobId: 'truck_local',
    jobName: 'Truck Driver (Local)',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 3,
    timeLimit: 42,
    targetScore: 1500,
    perfectScore: 2500,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚛'
    },
    description: 'Deliver on schedule!'
  },

  courier: {
    jobId: 'courier',
    jobName: 'Courier',
    gameType: MINI_GAME_TYPES.CHASE,
    difficulty: 2,
    timeLimit: 32,
    targetScore: 1100,
    perfectScore: 1800,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📨'
    },
    description: 'Rush delivery!'
  },

  tow_truck: {
    jobId: 'tow_truck',
    jobName: 'Tow Truck Driver',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 200,
    perfectScore: 320,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: COLORS.AMBER,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚨'
    },
    description: 'Hook vehicles carefully!'
  },

  repo: {
    jobId: 'repo',
    jobName: 'Repo Driver',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 28,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: COLORS.AMBER,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔑'
    },
    description: 'Grab the car fast!'
  },

  // ==========================================
  // TIER 5: SECURITY & PROTECTION (Level 15-30)
  // ==========================================

  security: {
    jobId: 'security',
    jobName: 'Security Guard',
    gameType: MINI_GAME_TYPES.SURVEILLANCE,
    difficulty: 2,
    timeLimit: 40,
    targetScore: 3,
    perfectScore: 5,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🛡️'
    },
    description: 'Spot suspicious activity!'
  },

  bouncer: {
    jobId: 'bouncer',
    jobName: 'Nightclub Bouncer',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 25,
    targetScore: 12,
    perfectScore: 18,
    theme: {
      primaryColor: COLORS.RED,
      secondaryColor: 0xdc2626,
      dangerColor: COLORS.AMBER,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🚪'
    },
    description: 'Check IDs and handle trouble!'
  },

  mall_security: {
    jobId: 'mall_security',
    jobName: 'Mall Security',
    gameType: MINI_GAME_TYPES.FROGGER,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🏬'
    },
    description: 'Patrol the mall!'
  },

  event_security: {
    jobId: 'event_security',
    jobName: 'Event Security',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 3,
    timeLimit: 28,
    targetScore: 14,
    perfectScore: 20,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🎤'
    },
    description: 'Manage the crowd!'
  },

  bodyguard: {
    jobId: 'bodyguard',
    jobName: 'Bodyguard',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 4,
    timeLimit: 30,
    targetScore: 15,
    perfectScore: 22,
    theme: {
      primaryColor: 0x1e293b,
      secondaryColor: 0x0f172a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🕴️'
    },
    description: 'Protect the VIP!'
  },

  loss_prevention: {
    jobId: 'loss_prevention',
    jobName: 'Loss Prevention',
    gameType: MINI_GAME_TYPES.SURVEILLANCE,
    difficulty: 3,
    timeLimit: 45,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '👁️'
    },
    description: 'Spot the shoplifters!'
  },

  // ==========================================
  // TIER 6: TECHNICAL/SKILLED (Level 20-35)
  // ==========================================

  electrician_helper: {
    jobId: 'electrician_helper',
    jobName: 'Electrician Helper',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 32,
    targetScore: 5,
    perfectScore: 7,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '⚡'
    },
    description: 'Wire it right!'
  },

  plumber_helper: {
    jobId: 'plumber_helper',
    jobName: 'Plumber Helper',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 32,
    targetScore: 5,
    perfectScore: 7,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔧'
    },
    description: 'Connect the pipes!'
  },

  hvac: {
    jobId: 'hvac',
    jobName: 'HVAC Technician',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 6,
    perfectScore: 9,
    theme: {
      primaryColor: COLORS.CYAN,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '❄️'
    },
    description: 'Fix the system!'
  },

  mechanic: {
    jobId: 'mechanic',
    jobName: 'Auto Mechanic',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 6,
    perfectScore: 9,
    theme: {
      primaryColor: COLORS.GRAY,
      secondaryColor: 0x4b5563,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔧'
    },
    description: 'Diagnose and repair!'
  },

  welder: {
    jobId: 'welder',
    jobName: 'Welder',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 4,
    timeLimit: 35,
    targetScore: 280,
    perfectScore: 420,
    theme: {
      primaryColor: COLORS.ORANGE,
      secondaryColor: 0xea580c,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔥'
    },
    description: 'Weld a clean bead!'
  },

  locksmith: {
    jobId: 'locksmith',
    jobName: 'Locksmith',
    gameType: MINI_GAME_TYPES.LOCKPICK,
    difficulty: 3,
    timeLimit: 30,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔐'
    },
    description: 'Open the lock!'
  },

  computer_repair: {
    jobId: 'computer_repair',
    jobName: 'Computer Repair',
    gameType: MINI_GAME_TYPES.HACKING,
    difficulty: 3,
    timeLimit: 35,
    targetScore: 400,
    perfectScore: 700,
    theme: {
      primaryColor: 0x00ff41,
      secondaryColor: 0x00cc33,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💻'
    },
    description: 'Debug the network!'
  },

  phone_repair: {
    jobId: 'phone_repair',
    jobName: 'Phone Repair',
    gameType: MINI_GAME_TYPES.STEADYHAND,
    difficulty: 3,
    timeLimit: 28,
    targetScore: 200,
    perfectScore: 320,
    theme: {
      primaryColor: COLORS.CYAN,
      secondaryColor: 0x0891b2,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '📱'
    },
    description: 'Replace the screen!'
  },

  // ==========================================
  // TIER 7: GIG ECONOMY (Level 5-25)
  // ==========================================

  taskrabbit: {
    jobId: 'taskrabbit',
    jobName: 'TaskRabbit Jobs',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 2,
    timeLimit: 25,
    targetScore: 10,
    perfectScore: 15,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '✅'
    },
    description: 'Complete the task!'
  },

  furniture_assembly: {
    jobId: 'furniture_assembly',
    jobName: 'Furniture Assembly',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 30,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.BLUE,
      secondaryColor: 0x2563eb,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🪑'
    },
    description: 'Follow the instructions!'
  },

  handyman: {
    jobId: 'handyman',
    jobName: 'Handyman',
    gameType: MINI_GAME_TYPES.WIRE,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 4,
    perfectScore: 6,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🛠️'
    },
    description: 'Fix the problem!'
  },

  pet_sitting: {
    jobId: 'pet_sitting',
    jobName: 'Pet Sitting',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 1,
    timeLimit: 25,
    targetScore: 4,
    perfectScore: 7,
    theme: {
      primaryColor: COLORS.AMBER,
      secondaryColor: 0xd97706,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🐾'
    },
    description: 'Remember pet routines!'
  },

  mystery_shopper: {
    jobId: 'mystery_shopper',
    jobName: 'Mystery Shopper',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 2,
    timeLimit: 28,
    targetScore: 5,
    perfectScore: 8,
    theme: {
      primaryColor: COLORS.PURPLE,
      secondaryColor: 0x9333ea,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔍'
    },
    description: 'Remember what you saw!'
  },

  // ==========================================
  // SPECIAL: HIGH-LEVEL JOBS (Level 25+)
  // ==========================================

  fixer: {
    jobId: 'fixer',
    jobName: 'The Fixer',
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: 4,
    timeLimit: 35,
    targetScore: 18,
    perfectScore: 25,
    theme: {
      primaryColor: 0x1e293b,
      secondaryColor: 0x0f172a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🕴️'
    },
    description: 'Solve the problem!'
  },

  private_investigator: {
    jobId: 'private_investigator',
    jobName: 'Private Investigator',
    gameType: MINI_GAME_TYPES.MEMORY,
    difficulty: 4,
    timeLimit: 40,
    targetScore: 8,
    perfectScore: 12,
    theme: {
      primaryColor: 0x1e293b,
      secondaryColor: 0x0f172a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '🔎'
    },
    description: 'Gather the evidence!'
  }
}

/**
 * Get mini-game mapping for a job
 * @param {string} jobId - Job identifier
 * @returns {Object|null} The job mapping or null
 */
export function getJobMapping(jobId) {
  const normalizedId = String(jobId).toLowerCase().replace(/\s+/g, '_')

  if (JOB_GAME_MAPPINGS[normalizedId]) {
    return JOB_GAME_MAPPINGS[normalizedId]
  }

  // Try matching by job name
  for (const key of Object.keys(JOB_GAME_MAPPINGS)) {
    const mapping = JOB_GAME_MAPPINGS[key]
    if (mapping.jobName.toLowerCase().replace(/\s+/g, '_') === normalizedId) {
      return mapping
    }
  }

  return null
}

/**
 * Get the scene key for a mini-game type
 * @param {string} gameType - Mini-game type
 * @returns {string} Scene key
 */
export function getSceneKeyForGame(gameType) {
  const sceneMap = {
    [MINI_GAME_TYPES.SNAKE]: 'SnakeGame',
    [MINI_GAME_TYPES.LOCKPICK]: 'LockPickGame',
    [MINI_GAME_TYPES.QTE]: 'QTEGame',
    [MINI_GAME_TYPES.FROGGER]: 'FroggerGame',
    [MINI_GAME_TYPES.MEMORY]: 'MemoryGame',
    [MINI_GAME_TYPES.STEADYHAND]: 'SteadyHandGame',
    [MINI_GAME_TYPES.CHASE]: 'ChaseGame',
    [MINI_GAME_TYPES.SNIPER]: 'SniperGame',
    [MINI_GAME_TYPES.SAFECRACK]: 'SafeCrackGame',
    [MINI_GAME_TYPES.WIRE]: 'WireGame',
    // New enhanced mini-games
    [MINI_GAME_TYPES.RHYTHM]: 'RhythmGame',
    [MINI_GAME_TYPES.HACKING]: 'HackingGame',
    [MINI_GAME_TYPES.GETAWAY]: 'GetawayGame',
    [MINI_GAME_TYPES.NEGOTIATION]: 'NegotiationGame',
    [MINI_GAME_TYPES.SURVEILLANCE]: 'SurveillanceGame'
  }
  return sceneMap[gameType] || 'QTEGame'
}

/**
 * Create a default mapping for jobs without specific mappings
 */
export function createDefaultJobMapping(jobId, jobName, difficulty = 1) {
  return {
    jobId,
    jobName,
    gameType: MINI_GAME_TYPES.QTE,
    difficulty: Math.min(5, Math.max(1, difficulty)),
    timeLimit: 20,
    targetScore: 8,
    perfectScore: 12,
    theme: {
      primaryColor: COLORS.GREEN,
      secondaryColor: 0x16a34a,
      dangerColor: COLORS.RED,
      successColor: COLORS.SUCCESS,
      backgroundColor: COLORS.DARK,
      icon: '💼'
    },
    description: 'Complete the work!'
  }
}
