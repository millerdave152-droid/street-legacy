# Street Legacy - Developer Handoff Document
## Version 3.0 | Comprehensive Technical Overview

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Backend Implementation](#6-backend-implementation)
7. [Database Schema](#7-database-schema)
8. [Game Systems & Features](#8-game-systems--features)
9. [API Reference](#9-api-reference)
10. [Deployment & DevOps](#10-deployment--devops)
11. [Current Status & Known Issues](#11-current-status--known-issues)
12. [Development Roadmap](#12-development-roadmap)
13. [Getting Started](#13-getting-started)

---

# 1. EXECUTIVE SUMMARY

**Street Legacy** is a persistent multiplayer crime/business simulation MMO set in Toronto. Players progress through criminal activities, build legitimate businesses as fronts, form crews, control territory, and compete on leaderboards.

## Quick Stats
| Metric | Value |
|--------|-------|
| **Project Status** | ~80% Production Ready |
| **Total Source Files** | 254+ |
| **Lines of Code** | ~35,000+ |
| **API Endpoints** | 56 route files |
| **React Components** | 90+ TSX files |
| **Database Migrations** | 15 SQL files |
| **Game Systems** | 29 major features |

## Build Status
- **Frontend:** Compiled & bundled (Vite)
- **Backend:** Compiled (TypeScript)
- **Database:** Migrations ready
- **Docker:** Configured for dev/prod
- **Tests:** Not implemented

---

# 2. PROJECT OVERVIEW

## 2.1 Game Concept

**Genre:** Browser-based Multiplayer Crime Simulation MMO

**Core Gameplay Loop:**
1. Commit crimes to earn cash and XP
2. Avoid jail, manage "heat" (police attention)
3. Level up to unlock better crimes and districts
4. Buy properties, run business fronts
5. Join or create crews for cooperative play
6. Control territory for passive income
7. Compete on leaderboards
8. Prestige to reset with permanent bonuses

**Setting:** 12 Toronto neighborhoods, each with unique characteristics:
- Downtown Core, Yorkville, The Beaches, Scarborough
- North York, Etobicoke, Mississauga, Brampton
- East End, West End, The Junction, Liberty Village

## 2.2 Target Platform
- **Primary:** Desktop web browsers
- **Secondary:** Mobile-responsive design
- **Engine:** React UI + Phaser 3 (legacy, mostly unused)

## 2.3 Monetization Model
- **Tokens:** Premium currency for convenience features
- **Battle Pass:** Seasonal progression rewards
- **Cosmetics:** Character customization items

---

# 3. TECHNOLOGY STACK

## 3.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI framework |
| **TypeScript** | 5.3.3 | Type safety |
| **Vite** | 5.0.11 | Build tool & dev server |
| **Zustand** | 4.4.7 | State management |
| **React Router** | 6.21.2 | Client-side routing |
| **Axios** | 1.6.5 | HTTP client |
| **Framer Motion** | 12.23.25 | Animations |
| **Leaflet** | 1.9.4 | Map visualization |
| **Lucide React** | 0.556.0 | Icon library |
| **Phaser** | 3.90.0 | Game engine (legacy) |
| **Supabase JS** | 2.87.0 | Backend client |

## 3.2 Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | >=18.0.0 | Runtime |
| **Express** | 4.18.2 | Web framework |
| **TypeScript** | 5.3.3 | Type safety |
| **PostgreSQL** | 16 | Database (via Supabase) |
| **Supabase** | 2.39.0 | BaaS platform |
| **jsonwebtoken** | 9.0.2 | JWT authentication |
| **bcrypt** | 5.1.1 | Password hashing |
| **ws** | 8.16.0 | WebSocket server |
| **pg** | 8.11.3 | PostgreSQL client |
| **cors** | 2.8.5 | CORS middleware |

## 3.3 Infrastructure

| Tool | Purpose |
|------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Nginx** | Production reverse proxy |
| **Supabase Cloud** | Hosted backend services |
| **Redis** | Optional caching layer |

---

# 4. ARCHITECTURE OVERVIEW

## 4.1 Project Structure

```
C:\Users\davem\Game 3.0\
└── street-legacy/                    # Main monorepo
    ├── package.json                  # Workspace configuration
    ├── docker-compose.yml            # Container orchestration
    ├── README.md                     # Project documentation
    ├── AUDIT_REPORT.md              # Security audit findings
    │
    ├── client/                       # FRONTEND APPLICATION
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   ├── index.html
    │   ├── Dockerfile.dev           # Development container
    │   ├── Dockerfile.prod          # Production container
    │   ├── nginx.conf               # Production web server
    │   │
    │   ├── public/                  # Static assets
    │   │   └── assets/              # Game assets (images, sounds)
    │   │
    │   └── src/
    │       ├── main.tsx             # Application entry point
    │       ├── App.tsx              # Root component with routing
    │       ├── vite-env.d.ts        # Vite type definitions
    │       │
    │       ├── api/                 # API client configuration
    │       │   └── client.ts        # Axios instance with interceptors
    │       │
    │       ├── components/          # React components (90+ files)
    │       │   ├── Banking.tsx
    │       │   ├── Casino.tsx
    │       │   ├── Crew.tsx
    │       │   ├── Equipment.tsx
    │       │   ├── Inventory.tsx
    │       │   ├── MapView.tsx
    │       │   ├── Missions.tsx
    │       │   ├── Properties.tsx
    │       │   ├── PvP.tsx
    │       │   ├── Schemes.tsx
    │       │   ├── Shop.tsx
    │       │   ├── Territory.tsx
    │       │   ├── ... (80+ more)
    │       │   │
    │       │   ├── crimes/          # Crime system components
    │       │   ├── game/            # Game-specific UI
    │       │   ├── layout/          # Layout components
    │       │   ├── mobile/          # Mobile-specific components
    │       │   └── ui/              # Reusable UI primitives
    │       │
    │       ├── game/                # Phaser game engine (legacy)
    │       │   ├── config.js
    │       │   ├── GameManager.js
    │       │   └── scenes/          # Phaser scenes
    │       │
    │       ├── hooks/               # Custom React hooks
    │       │   ├── useApi.ts
    │       │   ├── useCrimes.ts
    │       │   ├── useToast.ts
    │       │   └── ...
    │       │
    │       ├── pages/               # Page components
    │       │   ├── Game.tsx         # Main game hub (29 tabs)
    │       │   ├── Login.tsx
    │       │   ├── Register.tsx
    │       │   ├── Leaderboard.tsx
    │       │   ├── Stats.tsx
    │       │   ├── AdminLogin.tsx
    │       │   └── AdminDashboard.tsx
    │       │
    │       ├── services/            # API service modules
    │       │   ├── auth.ts
    │       │   ├── game.ts
    │       │   ├── crew.ts
    │       │   └── ...
    │       │
    │       ├── stores/              # Zustand state stores
    │       │   ├── authStore.ts     # Authentication state
    │       │   ├── gameStore.ts     # Main game state
    │       │   └── ...
    │       │
    │       ├── styles/              # CSS stylesheets
    │       │   ├── game.css
    │       │   ├── animations.css
    │       │   └── ...
    │       │
    │       └── utils/               # Utility functions
    │           ├── formatters.ts
    │           └── ...
    │
    ├── server/                       # BACKEND APPLICATION
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── Dockerfile.scheduler     # Cron job container
    │   │
    │   ├── src/
    │   │   ├── index.ts             # Express app entry point
    │   │   │
    │   │   ├── db/                  # Database utilities
    │   │   │   ├── connection.ts    # PostgreSQL connection pool
    │   │   │   ├── init.ts          # Database initialization
    │   │   │   ├── seed.ts          # Seed data
    │   │   │   └── init-phase*.ts   # Feature phase initializers
    │   │   │
    │   │   ├── middleware/          # Express middleware
    │   │   │   └── auth.ts          # JWT authentication
    │   │   │
    │   │   ├── routes/              # API route handlers (56 files)
    │   │   │   ├── auth.ts          # Authentication
    │   │   │   ├── game.ts          # Core gameplay
    │   │   │   ├── achievements.ts
    │   │   │   ├── banking.ts
    │   │   │   ├── battlepass.ts
    │   │   │   ├── blackmarket.ts
    │   │   │   ├── bounties.ts
    │   │   │   ├── business.ts
    │   │   │   ├── business-fronts.ts
    │   │   │   ├── casino.ts
    │   │   │   ├── challenges.ts
    │   │   │   ├── chat.ts
    │   │   │   ├── combat.ts
    │   │   │   ├── cosmetics.ts
    │   │   │   ├── crew-ranks.ts
    │   │   │   ├── crews.ts
    │   │   │   ├── drops.ts
    │   │   │   ├── economy.ts
    │   │   │   ├── equipment.ts
    │   │   │   ├── events.ts
    │   │   │   ├── expansions.ts
    │   │   │   ├── faction-missions.ts
    │   │   │   ├── factions.ts
    │   │   │   ├── friends.ts
    │   │   │   ├── heists.ts
    │   │   │   ├── heritage.ts
    │   │   │   ├── hospital.ts
    │   │   │   ├── inventory.ts
    │   │   │   ├── investigations.ts
    │   │   │   ├── jail.ts
    │   │   │   ├── leaderboard.ts
    │   │   │   ├── map.ts
    │   │   │   ├── missions.ts
    │   │   │   ├── missions-available.ts
    │   │   │   ├── money-laundering.ts
    │   │   │   ├── npcs.ts
    │   │   │   ├── poi-capture.ts
    │   │   │   ├── prestige.ts
    │   │   │   ├── properties.ts
    │   │   │   ├── property-operations.ts
    │   │   │   ├── property-raids.ts
    │   │   │   ├── property-upgrades.ts
    │   │   │   ├── pvp.ts
    │   │   │   ├── real-estate.ts
    │   │   │   ├── referral.ts
    │   │   │   ├── robbing.ts
    │   │   │   ├── schemes.ts
    │   │   │   ├── stats.ts
    │   │   │   ├── story.ts
    │   │   │   ├── streetcred.ts
    │   │   │   ├── taxes.ts
    │   │   │   ├── territory.ts
    │   │   │   ├── territory-wars.ts
    │   │   │   ├── trading.ts
    │   │   │   ├── vehicles.ts
    │   │   │   └── admin.ts
    │   │   │
    │   │   ├── utils/               # Server utilities
    │   │   │   ├── logger.ts
    │   │   │   └── cache.ts
    │   │   │
    │   │   └── websocket/           # WebSocket handlers
    │   │       └── index.ts
    │   │
    │   ├── supabase/
    │   │   ├── functions/           # Edge Functions (6 files)
    │   │   │   ├── auth-handler/
    │   │   │   ├── player-actions/
    │   │   │   ├── crew-actions/
    │   │   │   ├── social-actions/
    │   │   │   ├── admin-actions/
    │   │   │   └── scheduled-maintenance/
    │   │   │
    │   │   └── migrations/          # Database migrations (15 files)
    │   │       ├── 001_core_tables.sql
    │   │       ├── 002_economy_tables.sql
    │   │       ├── 003_social_tables.sql
    │   │       ├── 004_missions_items_events.sql
    │   │       ├── 005_rls_policies.sql
    │   │       ├── 006_player_functions.sql
    │   │       ├── 007_property_functions.sql
    │   │       ├── 008_business_functions.sql
    │   │       ├── 009_crime_functions.sql
    │   │       ├── 010_job_mission_functions.sql
    │   │       ├── 011_crew_functions.sql
    │   │       ├── 012_seed_data.sql
    │   │       ├── 014_triggers_scheduled.sql
    │   │       ├── 015_social_functions.sql
    │   │       └── 016_scheduled_functions.sql
    │   │
    │   └── scripts/                 # Utility scripts
    │       ├── deploy-functions.sh
    │       └── ...
    │
    └── shared/                       # SHARED CODE
        ├── package.json
        ├── tsconfig.json
        │
        └── src/
            ├── index.ts             # Main exports (~1200 lines of types)
            ├── config/              # Shared configuration
            ├── types/               # TypeScript interfaces
            └── lib/
                └── supabase.ts      # Supabase client factory
```

## 4.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  Pages   │ → │  Stores  │ → │ Services │ → │   API    │    │
│  │ (React)  │   │ (Zustand)│   │ (Axios)  │   │ Client   │    │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘    │
└────────────────────────────────────────────────────┼──────────┘
                                                     │ HTTP/WS
┌────────────────────────────────────────────────────┼──────────┐
│                      SERVER (Express)              │          │
├────────────────────────────────────────────────────┼──────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───▼──────┐   │
│  │  Routes  │ ← │Middleware│ ← │WebSocket │ ← │ Express  │   │
│  │ Handlers │   │  (Auth)  │   │  Server  │   │   App    │   │
│  └────┬─────┘   └──────────┘   └──────────┘   └──────────┘   │
│       │                                                       │
│       ▼                                                       │
│  ┌──────────┐                                                 │
│  │ Database │ (PostgreSQL via pg client)                      │
│  │  Queries │                                                 │
│  └────┬─────┘                                                 │
└───────┼───────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│                    SUPABASE (Backend-as-a-Service)            │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │PostgreSQL│   │   Auth   │   │ Realtime │   │  Edge    │   │
│  │    DB    │   │ Service  │   │Subscript.│   │Functions │   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## 4.3 Authentication Flow

```
1. User submits login form
   └─→ POST /api/auth/login { email, password }

2. Server validates credentials
   └─→ bcrypt.compare(password, hashedPassword)

3. Server generates JWT
   └─→ jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' })

4. Client stores token
   └─→ localStorage.setItem('token', jwt)

5. Subsequent requests include token
   └─→ Authorization: Bearer <jwt>

6. Auth middleware validates
   └─→ jwt.verify(token, JWT_SECRET)
```

---

# 5. FRONTEND IMPLEMENTATION

## 5.1 Application Entry Point

**`client/src/main.tsx`**
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

## 5.2 Routing Structure

**`client/src/App.tsx`**
```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Navigate to="/login" />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
    <Route path="/leaderboard" element={<Leaderboard />} />
    <Route path="/stats" element={<Stats />} />
    <Route path="/admin" element={<AdminLogin />} />
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
  </Routes>
</BrowserRouter>
```

## 5.3 State Management (Zustand)

### Auth Store (`stores/authStore.ts`)
```typescript
interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}
```

### Game Store (`stores/gameStore.ts`)
```typescript
interface GameState {
  player: PlayerState | null;
  currentDistrict: District | null;
  districts: District[];
  crimes: Crime[];
  cooldowns: Map<number, Date>;
  isLoading: boolean;
  error: string | null;
  lastCrimeResult: CrimeResult | null;

  fetchState: () => Promise<void>;
  commitCrime: (crimeId: number) => Promise<void>;
  travel: (districtId: number) => Promise<void>;
  // ... more actions
}
```

## 5.4 Main Game Page Structure

**`client/src/pages/Game.tsx`** manages 29 game tabs:

| Tab ID | Component | Purpose |
|--------|-----------|---------|
| `crimes` | CrimesTab | Commit criminal activities |
| `rob` | Robbing | Rob other players/NPCs |
| `map` | MapView | District navigation (Leaflet) |
| `territory` | Territory | Territory control system |
| `properties` | Properties | Property ownership |
| `bank` | Banking | Deposit/withdraw funds |
| `shop` | Shop | Purchase items |
| `inventory` | Inventory | Manage owned items |
| `equipment` | Equipment | Equip gear/weapons |
| `schemes` | Schemes | Plan complex operations |
| `crew` | Crew | Crew management |
| `heists` | Heists | Multi-player heists |
| `pvp` | PvP | Player vs player combat |
| `missions` | Missions | Story & side missions |
| `story` | Story | Main storyline progression |
| `achievements` | Achievements | Achievement tracking |
| `prestige` | Prestige | Reset for bonuses |
| `casino` | Casino | Gambling minigames |
| `vehicles` | Vehicles | Vehicle ownership |
| `jail` | Jail | Jail break/wait system |
| `blackmarket` | BlackMarket | Illegal item trading |
| `business` | Business | Business front management |
| `friends` | Friends | Friend list & social |
| `trading` | Trading | Player-to-player trading |
| `events` | Events | Limited-time events |
| `cred` | StreetCred | Reputation system |
| `cosmetics` | Cosmetics | Character customization |
| `battlepass` | BattlePass | Season pass rewards |
| `challenges` | Challenges | Daily/weekly challenges |

## 5.5 Key Components

### CrimesTab (`components/crimes/CrimesTab.tsx`)
- Displays available crimes filtered by player level
- Shows cooldown timers
- Handles crime execution with animations
- Displays success/failure results

### MapView (`components/MapView.tsx`)
- Interactive Toronto map using Leaflet
- Shows 12 districts with travel options
- Displays territory control colors
- Real-time player positions (WebSocket)

### Banking (`components/Banking.tsx`)
- Deposit cash to bank
- Withdraw from bank
- View transaction history
- Interest accrual display

### Equipment (`components/Equipment.tsx`)
- View equipped items
- Manage inventory slots
- Equipment stat bonuses
- Specialization trees

---

# 6. BACKEND IMPLEMENTATION

## 6.1 Server Entry Point

**`server/src/index.ts`** configures:

```typescript
// Core middleware
app.use(express.json({ limit: '10kb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rate limiting (in-memory)
app.use('/api/', rateLimiter(100));        // 100 req/min
app.use('/api/auth/', rateLimiter(10));    // 10 req/min

// 56 route handlers registered
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
// ... (54 more route registrations)

// WebSocket server
const httpServer = createServer(app);
setupWebSocket(httpServer);
```

## 6.2 Authentication Middleware

**`server/src/middleware/auth.ts`**
```typescript
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

## 6.3 Database Connection

**`server/src/db/connection.ts`**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;
```

## 6.4 Route Handler Pattern

All route files follow this pattern:

```typescript
// server/src/routes/example.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/connection.js';

const router = Router();

// Protected route example
router.get('/data', authenticate, async (req, res) => {
  try {
    const playerId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM table WHERE player_id = $1',
      [playerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

export default router;
```

## 6.5 Scheduled Tasks

The scheduler container runs periodic maintenance:

| Task | Interval | Function |
|------|----------|----------|
| Energy Regeneration | 10 min | Restore player energy |
| Jail Release | 5 min | Release eligible prisoners |
| Business Income | 1 hour | Process business earnings |
| Property Taxes | 1 hour | Deduct property taxes |
| Territory Income | 1 hour | Pay territory control bonuses |
| Heat Decay | 1 day | Reduce player heat levels |
| Daily Reset | 1 day | Reset daily limits |
| Weekly Rewards | 1 week | Distribute leaderboard prizes |

---

# 7. DATABASE SCHEMA

## 7.1 Migration Files

| Migration | Purpose |
|-----------|---------|
| `001_core_tables.sql` | Players, districts, properties, crimes |
| `002_economy_tables.sql` | Businesses, currencies, transactions |
| `003_social_tables.sql` | Crews, chat, friends, messages |
| `004_missions_items_events.sql` | Missions, items, inventory, events |
| `005_rls_policies.sql` | Row-level security policies |
| `006_player_functions.sql` | Player action functions |
| `007_property_functions.sql` | Property management functions |
| `008_business_functions.sql` | Business operation functions |
| `009_crime_functions.sql` | Crime execution functions |
| `010_job_mission_functions.sql` | Job and mission functions |
| `011_crew_functions.sql` | Crew management functions |
| `012_seed_data.sql` | Initial game data |
| `014_triggers_scheduled.sql` | Automatic triggers |
| `015_social_functions.sql` | Social interaction functions |
| `016_scheduled_functions.sql` | Scheduled maintenance functions |

## 7.2 Core Tables

### `players`
```sql
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  cash BIGINT DEFAULT 500,
  bank BIGINT DEFAULT 0,
  clean_money BIGINT DEFAULT 0,
  crypto BIGINT DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  stamina INTEGER DEFAULT 100,
  stamina_max INTEGER DEFAULT 100,
  focus INTEGER DEFAULT 100,
  focus_max INTEGER DEFAULT 100,
  heat INTEGER DEFAULT 0,
  influence INTEGER DEFAULT 0,
  street_rep INTEGER DEFAULT 0,
  current_district_id INTEGER REFERENCES districts(id),
  in_jail BOOLEAN DEFAULT FALSE,
  jail_release_at TIMESTAMP,
  prestige_level INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);
```

### `districts`
```sql
CREATE TABLE districts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  min_level INTEGER DEFAULT 1,
  danger_level INTEGER DEFAULT 1,
  police_presence INTEGER DEFAULT 50,
  crime_bonus DECIMAL(3,2) DEFAULT 1.00,
  is_unlocked BOOLEAN DEFAULT TRUE
);
```

### `crimes`
```sql
CREATE TABLE crimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  min_level INTEGER DEFAULT 1,
  stamina_cost INTEGER DEFAULT 10,
  focus_cost INTEGER DEFAULT 0,
  base_success_rate INTEGER DEFAULT 50,
  min_payout INTEGER DEFAULT 10,
  max_payout INTEGER DEFAULT 100,
  xp_reward INTEGER DEFAULT 10,
  heat_generated INTEGER DEFAULT 5,
  cooldown_seconds INTEGER DEFAULT 30,
  jail_minutes INTEGER DEFAULT 5
);
```

### `player_properties`
```sql
CREATE TABLE player_properties (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  property_id INTEGER REFERENCES properties(id),
  district_id INTEGER REFERENCES districts(id),
  purchase_price BIGINT,
  current_value BIGINT,
  income_per_hour INTEGER DEFAULT 0,
  upgrade_level INTEGER DEFAULT 1,
  is_business_front BOOLEAN DEFAULT FALSE,
  purchased_at TIMESTAMP DEFAULT NOW()
);
```

### `crews`
```sql
CREATE TABLE crews (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  tag VARCHAR(5) UNIQUE NOT NULL,
  leader_id INTEGER REFERENCES players(id),
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  bank BIGINT DEFAULT 0,
  max_members INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 8. GAME SYSTEMS & FEATURES

## 8.1 Core Systems

### Crime System
- 50+ crime types across categories (theft, fraud, assault, etc.)
- Level-gated progression
- Success rate based on stats + equipment
- Cooldown timers per crime
- Heat generation (police attention)
- Jail time on failure

### Currency System
| Currency | Purpose |
|----------|---------|
| Cash | Primary currency, earned from crimes |
| Bank | Safe storage, earns interest |
| Clean Money | Laundered funds for legal purchases |
| Crypto | Untraceable digital currency |
| Tokens | Premium currency (real money) |

### Player Attributes
| Attribute | Purpose |
|-----------|---------|
| Stamina | Action resource, regenerates over time |
| Focus | Mental resource for complex crimes |
| Heat | Police attention level (0-100) |
| Influence | Social capital for negotiations |
| Street Rep | Permanent reputation score |

## 8.2 Property & Business

### Property Types
- Apartments, Houses, Warehouses
- Storefronts, Nightclubs, Restaurants
- Each district has limited property slots

### Business Fronts
- Convert properties to business fronts
- Generate income + launder money
- Risk of police raids based on heat
- Upgrade for better efficiency

### Money Laundering
- Convert dirty cash to clean money
- Multiple laundering methods
- Risk/reward tradeoffs

## 8.3 Social Systems

### Crews
- Create or join crews (max 10 members)
- Crew bank for shared funds
- Crew ranks with permissions
- Crew-only heists and missions

### Territory Wars
- Crews compete for district control
- Control grants passive income
- War declaration and combat phases
- Point-of-interest capture mechanics

### PvP Combat
- Attack other players
- Turn-based combat resolution
- Equipment affects outcomes
- Bounty system for revenge

## 8.4 Progression Systems

### Leveling (1-50)
- XP from crimes, missions, activities
- Level unlocks new content
- Stat increases per level

### Prestige
- Reset at max level
- Keep permanent bonuses
- Unlock prestige-only content

### Achievements
- 100+ achievements
- Reward bonuses and cosmetics

### Battle Pass
- Seasonal progression track
- Free and premium tiers
- Exclusive rewards

---

# 9. API REFERENCE

## 9.1 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Get current user |

## 9.2 Game Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/game/state` | Full player state |
| POST | `/api/game/crime` | Commit a crime |
| POST | `/api/game/travel` | Travel to district |
| GET | `/api/game/crimes` | Available crimes |
| GET | `/api/game/districts` | All districts |

## 9.3 Economy Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/banking/balance` | Bank balance |
| POST | `/api/banking/deposit` | Deposit cash |
| POST | `/api/banking/withdraw` | Withdraw cash |
| GET | `/api/shop/items` | Shop inventory |
| POST | `/api/shop/buy` | Purchase item |
| GET | `/api/inventory` | Player inventory |

## 9.4 Social Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crews` | List all crews |
| POST | `/api/crews/create` | Create crew |
| POST | `/api/crews/join` | Join crew |
| GET | `/api/friends` | Friend list |
| POST | `/api/friends/add` | Send friend request |
| GET | `/api/chat/messages` | Get chat messages |
| POST | `/api/chat/send` | Send message |

## 9.5 Combat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pvp/attack` | Attack player |
| GET | `/api/pvp/status` | Combat status |
| POST | `/api/bounties/place` | Place bounty |
| GET | `/api/bounties/list` | Active bounties |

---

# 10. DEPLOYMENT & DEVOPS

## 10.1 Docker Configuration

### Development
```bash
docker-compose up client
# Runs Vite dev server on :5173
```

### Production
```bash
docker-compose --profile production up -d client-prod
# Builds and serves via Nginx on :80
```

### With Scheduler
```bash
docker-compose --profile with-scheduler up -d
# Adds cron job container
```

### Full Stack (Local DB)
```bash
docker-compose --profile local-db --profile with-cache up
# Includes PostgreSQL and Redis
```

## 10.2 Environment Variables

### Client (`.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=Street Legacy
VITE_ENV=development
```

### Server (`.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
PORT=3001
SCHEDULER_SECRET=your-scheduler-secret
```

## 10.3 Build Commands

```bash
# Install all dependencies (from root)
npm install

# Development (runs both client & server)
npm run dev

# Build all packages
npm run build

# Client only
cd client && npm run dev      # Development
cd client && npm run build    # Production build
cd client && npm run preview  # Preview build

# Server only
cd server && npm run dev      # Watch mode
cd server && npm run build    # Compile TypeScript
cd server && npm run start    # Run compiled

# Database
cd server && npm run db:init  # Initialize schema
cd server && npm run db:seed  # Seed data
```

---

# 11. CURRENT STATUS & KNOWN ISSUES

## 11.1 Implementation Status

### Fully Implemented
- User authentication (JWT)
- Player progression (levels 1-50)
- Crime system with cooldowns
- 12 Toronto districts
- Property ownership
- Business fronts
- Money laundering
- Crew system
- Territory control
- PvP combat
- Bounty system
- Equipment system
- Inventory management
- Banking
- Shop
- Missions
- Achievements
- Prestige system
- Casino gambling
- Battle Pass
- Admin dashboard

### Partially Implemented
- WebSocket real-time updates (some polling remains)
- Mobile responsiveness
- Performance optimization

### Not Implemented
- Email verification
- Password reset
- Two-factor authentication (2FA)
- Unit/integration tests
- Comprehensive error tracking

## 11.2 Critical Issues (MUST FIX)

### Security
1. **SQL Injection** - `server/src/routes/game.ts:409-413`
   - String interpolation in cooldown query
   - Fix: Use parameterized query

2. **Missing Input Validation**
   - Email, username, password not properly validated
   - Fix: Add Zod/Joi validation

3. **Weak Password Policy**
   - Only 6 character minimum
   - Fix: Require 8+ chars, uppercase, number

### Stability
4. **Race Conditions**
   - Crime execution not transaction-wrapped
   - Fix: Wrap in database transaction

5. **Database Connection**
   - No error handling on connection failures
   - Fix: Add retry logic and error handling

6. **Memory Leak Potential**
   - React useEffect cleanup issues
   - Fix: Review interval cleanup in Game.tsx

## 11.3 Performance Issues

1. **N+1 Query Problem** - Multiple sequential queries in game state
2. **No Caching Layer** - Redis configured but not integrated
3. **Client Over-Fetching** - Full state refresh after every action
4. **Missing Database Indexes** - Some common queries unoptimized

---

# 12. DEVELOPMENT ROADMAP

## Phase 1: Security Hardening (Priority: CRITICAL)
- [ ] Fix SQL injection vulnerability
- [ ] Add comprehensive input validation
- [ ] Strengthen password requirements
- [ ] Add CSRF protection
- [ ] Implement proper rate limiting

## Phase 2: Stability (Priority: HIGH)
- [ ] Wrap critical operations in transactions
- [ ] Add database connection error handling
- [ ] Fix React memory leak issues
- [ ] Standardize error response format
- [ ] Add Error Boundaries

## Phase 3: Performance (Priority: MEDIUM)
- [ ] Optimize N+1 queries with JOINs
- [ ] Implement Redis caching
- [ ] Add database indexes
- [ ] Implement optimistic UI updates
- [ ] Reduce client-side over-fetching

## Phase 4: Testing (Priority: MEDIUM)
- [ ] Add unit tests for critical paths
- [ ] Add integration tests for API
- [ ] Add E2E tests for main flows
- [ ] Set up CI/CD pipeline

## Phase 5: Features (Priority: LOW)
- [ ] Email verification
- [ ] Password reset flow
- [ ] Two-factor authentication
- [ ] Audit logging
- [ ] API versioning (/api/v1)

---

# 13. GETTING STARTED

## 13.1 Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose
- Supabase account (or local PostgreSQL)

## 13.2 Quick Start

```bash
# 1. Clone/download the project
cd "C:\Users\davem\Game 3.0\street-legacy"

# 2. Install dependencies
npm install

# 3. Copy environment files
cp client/.env.example client/.env
cp server/.env.example server/.env

# 4. Configure environment variables
# Edit both .env files with your Supabase credentials

# 5. Run database migrations
# Go to Supabase Dashboard > SQL Editor
# Run each file in server/supabase/migrations/ in order

# 6. Start development servers
npm run dev

# 7. Open browser
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

## 13.3 Development Workflow

1. **Frontend changes:** Edit files in `client/src/` - Vite hot reloads
2. **Backend changes:** Edit files in `server/src/` - tsx watches and restarts
3. **Database changes:** Create new migration file in `server/supabase/migrations/`
4. **Shared types:** Edit `shared/src/index.ts` and rebuild

## 13.4 Key Files to Understand

| File | Why It's Important |
|------|-------------------|
| `client/src/pages/Game.tsx` | Main game hub, all tabs |
| `client/src/stores/gameStore.ts` | Central state management |
| `server/src/index.ts` | All route registrations |
| `server/src/routes/game.ts` | Core crime/travel logic |
| `server/src/middleware/auth.ts` | Authentication |
| `shared/src/index.ts` | All TypeScript interfaces |

---

# APPENDIX A: Type Definitions

## Core Player State
```typescript
interface PlayerState {
  id: number;
  username: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  cash: number;
  bank: number;
  cleanMoney: number;
  crypto: number;
  tokens: number;
  stamina: number;
  staminaMax: number;
  focus: number;
  focusMax: number;
  heat: number;
  influence: number;
  streetRep: number;
  inJail: boolean;
  jailReleaseAt: string | null;
  prestigeLevel: number;
}
```

## Crime Definition
```typescript
interface CrimeDefinition {
  id: number;
  name: string;
  description: string;
  category: string;
  minLevel: number;
  staminaCost: number;
  focusCost: number;
  baseSuccessRate: number;
  minPayout: number;
  maxPayout: number;
  cooldownSeconds: number;
  jailMinutes: number;
  heatGenerated: number;
}
```

## API Response
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

# APPENDIX B: Contact & Resources

- **Project Location:** `C:\Users\davem\Game 3.0\street-legacy`
- **Documentation:** `README.md`, `AUDIT_REPORT.md`
- **Supabase Docs:** https://supabase.com/docs
- **React Docs:** https://react.dev
- **Express Docs:** https://expressjs.com

---

*Document generated: December 2024*
*Street Legacy v3.0*
