import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { createServer } from 'http';
import type { ApiResponse, HealthCheck } from '@street-legacy/shared';
import { setupWebSocket } from './websocket/index.js';
import { logger } from './utils/logger.js';
import { initConfig } from './utils/config.js';
import { setupSwagger } from './docs/swagger.js';
import { requestIdMiddleware, requestTimingMiddleware } from './middleware/requestId.js';
import healthRoutes from './routes/health.js';
import {
  globalLimiter,
  authLimiter,
  registrationLimiter,
  gameActionLimiter,
  sensitiveLimiter,
  heavyLimiter,
  chatLimiter,
  adminLimiter,
  passwordResetLimiter,
  casinoLimiter,
  crewLimiter,
  combatLimiter,
  shutdownRateLimiter,
  getStorageType
} from './middleware/index.js';
import {
  conditionalCsrf,
  provideCsrfToken,
  csrfErrorHandler,
  getCsrfToken
} from './middleware/csrf.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import leaderboardRoutes from './routes/leaderboard.js';
import chatRoutes from './routes/chat.js';
import statsRoutes from './routes/stats.js';
import inventoryRoutes from './routes/inventory.js';
import crewsRoutes from './routes/crews.js';
import robbingRoutes from './routes/robbing.js';
import missionsRoutes from './routes/missions.js';
import prestigeRoutes from './routes/prestige.js';
import achievementsRoutes from './routes/achievements.js';
import territoryRoutes from './routes/territory.js';
import friendsRoutes from './routes/friends.js';
import tradingRoutes from './routes/trading.js';
import eventsRoutes from './routes/events.js';
import adminRoutes from './routes/admin.js';
import streetcredRoutes from './routes/streetcred.js';
import cosmeticsRoutes from './routes/cosmetics.js';
import referralRoutes from './routes/referral.js';
import battlepassRoutes from './routes/battlepass.js';
import storyRoutes from './routes/story.js';
import propertiesRoutes from './routes/properties.js';
import heistsRoutes from './routes/heists.js';
import bankingRoutes from './routes/banking.js';
import casinoRoutes from './routes/casino.js';
import vehiclesRoutes from './routes/vehicles.js';
import pvpRoutes from './routes/pvp.js';
import challengesRoutes from './routes/challenges.js';
import jailRoutes from './routes/jail.js';
import blackmarketRoutes from './routes/blackmarket.js';
import businessRoutes from './routes/business.js';
import mapRoutes from './routes/map.js';
import dropsRoutes, { spawnDrops, cleanupExpiredDrops } from './routes/drops.js';
import heritageRoutes, { initHeritageSystem } from './routes/heritage.js';
import equipmentRoutes, { initEquipmentSystem } from './routes/equipment.js';
import schemesRoutes, { initSchemesSystem, spawnMapEvents } from './routes/schemes.js';
import npcsRoutes from './routes/npcs.js';
import missionsAvailableRoutes from './routes/missions-available.js';
import economyRoutes from './routes/economy.js';
import expansionsRoutes from './routes/expansions.js';
import realEstateRoutes, { processPropertyDecay } from './routes/real-estate.js';
import propertyUpgradesRoutes from './routes/property-upgrades.js';
import propertyOperationsRoutes from './routes/property-operations.js';
import propertyRaidsRoutes, { checkAllPropertiesForRaids } from './routes/property-raids.js';
import territoryWarsRoutes, { processWarEndings, awardPoiControlPoints } from './routes/territory-wars.js';
import poiCaptureRoutes, { processPoiCaptures } from './routes/poi-capture.js';
import crewRanksRoutes, { payCrewSalaries } from './routes/crew-ranks.js';
import businessFrontsRoutes, { processBusinessDecay } from './routes/business-fronts.js';
import moneyLaunderingRoutes, { processLaunderingOperations } from './routes/money-laundering.js';
import taxesRoutes, { processOverdueTaxes } from './routes/taxes.js';
import investigationsRoutes, { processInvestigations } from './routes/investigations.js';
import factionsRoutes, { processFactionEvents } from './routes/factions.js';
import factionMissionsRoutes, { processExpiredMissions } from './routes/faction-missions.js';
import combatRoutes, { processTimedOutCombats } from './routes/combat.js';
import bountiesRoutes, { processExpiredBounties, processHitmanAttempts } from './routes/bounties.js';
import hospitalRoutes, { processNaturalHealing } from './routes/hospital.js';
import jobsRoutes from './routes/jobs.js';
import nuclearCellsRoutes, { processPassiveRegen } from './routes/nuclear-cells.js';
import aiGridRoutes, { processHeatDecay, processSectorSweeps } from './routes/ai-grid.js';
import worldEvents2091Routes, { triggerRandomWorldEvent, cleanupEndedEvents } from './routes/world-events-2091.js';
import premiumShopRoutes, { processExpiredBoosters } from './routes/premium-shop.js';
import districtEcosystemRoutes from './routes/districtEcosystem.routes.js';
import reputationRoutes from './routes/reputation.routes.js';
import worldMemoryRoutes, { cleanExpiredMemories } from './routes/worldMemory.routes.js';

// Narrative Systems (Phase 2-3) Imports
import witnessRoutes from './routes/witness.routes.js';
import streetBroadcastRoutes from './routes/streetBroadcast.routes.js';
import lifeChaptersRoutes from './routes/lifeChapters.routes.js';
import debtEconomyRoutes from './routes/debtEconomy.routes.js';
import generationalContinuityRoutes from './routes/generationalContinuity.routes.js';
import opsHeistRoutes from './routes/ops-heist.js';
import { startDistrictStateCalculatorJob, getJobStatus } from './jobs/districtStateCalculator.job.js';
import { updateTerritoryControl, payTerritoryIncome } from './routes/territory.js';
import { triggerRandomEvent } from './routes/events.js';
import { initPhase6System } from './db/init-phase6.js';
import { initPhase7System } from './db/init-phase7.js';
import { initPhase8System } from './db/init-phase8.js';
import { initPhase9System } from './db/init-phase9.js';
import { initPhase10System } from './db/init-phase10.js';
import { initPhase11System } from './db/init-phase11.js';

// Validate configuration before starting
const config = initConfig();

const app = express();
const PORT = config.server.port;

// Request ID and timing middleware (must be first)
app.use(requestIdMiddleware);
app.use(requestTimingMiddleware);

// Response compression for bandwidth optimization
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses for SSE or WebSocket upgrade requests
    if (req.headers['accept'] === 'text/event-stream') return false;
    if (req.headers['upgrade']) return false;
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level
}));

// Security: Request body size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// CORS configuration - support multiple origins
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // In development, allow any localhost port (Vite may use 5173, 5174, 5175, etc.)
    if (process.env.NODE_ENV !== 'production' && origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Cookie parser (required for CSRF)
app.use(cookieParser());

// CSRF Protection - only in production (disabled for local development)
if (process.env.NODE_ENV === 'production') {
  app.use(conditionalCsrf);
  app.use(provideCsrfToken);
  logger.info('CSRF protection enabled (production mode)');
} else {
  logger.info('CSRF protection disabled (development mode)');
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  next();
});

// Note: Request logging is handled by requestTimingMiddleware (added at top)

// ============================================================================
// RATE LIMITING - Comprehensive protection against abuse
// Uses Redis if REDIS_URL is set, otherwise falls back to memory store
// ============================================================================

// Global rate limiter - baseline protection for all API routes
// 100 requests per 15 minutes per IP/user
app.use('/api/', globalLimiter);

// Authentication rate limiters - strict limits to prevent brute force
// Login: 5 attempts per 15 minutes (successful logins don't count)
app.use('/api/auth/login', authLimiter);
// Registration: 3 accounts per hour per IP
app.use('/api/auth/register', registrationLimiter);
// Password reset: 3 attempts per hour per IP (very strict to prevent enumeration)
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/auth/resend-verification', authLimiter);

// Game action rate limiters - prevent automation abuse
// 30 actions per minute for game actions
app.use('/api/game/crime', gameActionLimiter);
app.use('/api/game/travel', gameActionLimiter);
app.use('/api/rob', gameActionLimiter);
app.use('/api/jail', gameActionLimiter);

// Sensitive operations - financial and property transactions
// 10 operations per 5 minutes
app.use('/api/banking/transfer', sensitiveLimiter);
app.use('/api/banking/deposit', sensitiveLimiter);
app.use('/api/banking/withdraw', sensitiveLimiter);
app.use('/api/properties/purchase', sensitiveLimiter);
app.use('/api/properties/sell', sensitiveLimiter);
app.use('/api/real-estate', sensitiveLimiter);
app.use('/api/trade', sensitiveLimiter);
app.use('/api/money-laundering', sensitiveLimiter);

// Heavy API operations - resource-intensive queries
// 10 requests per minute
app.use('/api/leaderboard', heavyLimiter);
app.use('/api/stats', heavyLimiter);

// Chat rate limiting - 20 messages per minute
app.use('/api/chat', chatLimiter);

// Admin endpoints - 50 requests per minute
app.use('/api/admin', adminLimiter);

// Casino/gambling - 60 bets per minute
app.use('/api/casino', casinoLimiter);

// Crew operations - 20 per minute
app.use('/api/crews', crewLimiter);
app.use('/api/crew-ranks', crewLimiter);

// Combat/PvP operations - 15 per minute
app.use('/api/pvp', combatLimiter);
app.use('/api/combat', combatLimiter);
app.use('/api/bounties', combatLimiter);

// Nuclear Cells operations - 30 per minute (same as game actions)
app.use('/api/nuclear-cells', gameActionLimiter);

// AI Grid operations - 30 per minute
app.use('/api/ai-grid', gameActionLimiter);

// World Events - 30 per minute
app.use('/api/world-events', gameActionLimiter);

// Premium Shop - 20 per minute (sensitive operations)
app.use('/api/premium-shop', sensitiveLimiter);

// Operations endpoints (server-authoritative actions) - 30 per minute
app.use('/api/ops', gameActionLimiter);

// Log rate limiter storage type on startup
logger.info(`Rate limiter initialized with ${getStorageType()} store`);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shop', inventoryRoutes);
app.use('/api/crews', crewsRoutes);
app.use('/api/rob', robbingRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/prestige', prestigeRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/territory', territoryRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/trade', tradingRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cred', streetcredRoutes);
app.use('/api/cosmetics', cosmeticsRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/battlepass', battlepassRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/heists', heistsRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/casino', casinoRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/pvp', pvpRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/jail', jailRoutes);
app.use('/api/blackmarket', blackmarketRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/drops', dropsRoutes);
app.use('/api/heritage', heritageRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/schemes', schemesRoutes);
app.use('/api/npcs', npcsRoutes);
app.use('/api/missions', missionsAvailableRoutes);  // Adds /available, /daily, /hourly, /regen routes
app.use('/api/economy', economyRoutes);
app.use('/api/expansions', expansionsRoutes);
app.use('/api/real-estate', realEstateRoutes);
app.use('/api/property-upgrades', propertyUpgradesRoutes);
app.use('/api/property-operations', propertyOperationsRoutes);
app.use('/api/property-raids', propertyRaidsRoutes);
app.use('/api/territory-wars', territoryWarsRoutes);
app.use('/api/poi-capture', poiCaptureRoutes);
app.use('/api/crew-ranks', crewRanksRoutes);
app.use('/api/business-fronts', businessFrontsRoutes);
app.use('/api/money-laundering', moneyLaunderingRoutes);
app.use('/api/taxes', taxesRoutes);
app.use('/api/investigations', investigationsRoutes);
app.use('/api/factions', factionsRoutes);
app.use('/api/factions', factionMissionsRoutes);  // Adds mission-related routes under /api/factions
app.use('/api/combat', combatRoutes);
app.use('/api/bounties', bountiesRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/nuclear-cells', nuclearCellsRoutes);
app.use('/api/ai-grid', aiGridRoutes);
app.use('/api/world-events', worldEvents2091Routes);
app.use('/api/premium-shop', premiumShopRoutes);
app.use('/api/districts', districtEcosystemRoutes);
app.use('/api', reputationRoutes);  // Reputation routes (handles /players/:id/reputation, /factions, etc.)
app.use('/api/world-memory', worldMemoryRoutes);  // World Memory routes (events, monuments, NPC memories)

// Server-Authoritative Operations (anti-cheat)
app.use('/api/ops/heist', opsHeistRoutes);  // Solo heist planning/execution

// Narrative Systems (Phase 2-3)
app.use('/api', witnessRoutes);  // Witness system (accounts, testimonies, investigations)
app.use('/api', streetBroadcastRoutes);  // Street broadcasts and announcer events
app.use('/api', lifeChaptersRoutes);  // Life chapters and milestones
app.use('/api', debtEconomyRoutes);  // Debt economy (favors, loans, trust)
app.use('/api', generationalContinuityRoutes);  // Succession, endings, dynasties

// CSRF token endpoint - for SPA initial load
app.get('/api/csrf-token', getCsrfToken);

// Health check routes (basic and detailed)
app.get('/api/health', (_req, res) => {
  const response: ApiResponse<HealthCheck> = {
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  };
  res.json(response);
});
app.use('/api/health', healthRoutes);

// API Documentation (Swagger UI)
setupSwagger(app);

// CSRF error handler (must come after routes)
app.use(csrfErrorHandler);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last middleware)
app.use(globalErrorHandler);

// Create HTTP server and attach WebSocket
const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info('WebSocket server ready on /ws');
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`Health Check: http://localhost:${PORT}/api/health/detailed`);

  // Periodic tasks
  // Update territory control every 15 minutes
  setInterval(() => {
    updateTerritoryControl();
  }, 15 * 60 * 1000);

  // Pay territory income every hour
  setInterval(() => {
    payTerritoryIncome();
  }, 60 * 60 * 1000);

  // Check for random events every 30 minutes
  setInterval(() => {
    triggerRandomEvent();
  }, 30 * 60 * 1000);

  // Spawn drop zones every 20 minutes (3-5 drops per spawn)
  setInterval(() => {
    const dropCount = 3 + Math.floor(Math.random() * 3); // 3-5 drops
    spawnDrops(dropCount);
  }, 20 * 60 * 1000);

  // Clean up expired drops every 5 minutes
  setInterval(() => {
    cleanupExpiredDrops();
  }, 5 * 60 * 1000);

  // Spawn initial drops on server start
  setTimeout(() => {
    spawnDrops(5);
    console.log('Initial drop zones spawned');
  }, 5000);

  // Initialize heritage system (creates tables and seeds data)
  setTimeout(() => {
    initHeritageSystem();
  }, 3000);

  // Initialize equipment system (creates tables and seeds data)
  setTimeout(() => {
    initEquipmentSystem();
  }, 4000);

  // Initialize schemes system (creates tables and seeds data)
  setTimeout(() => {
    initSchemesSystem();
  }, 5000);

  // Spawn map events every 15 minutes
  setInterval(() => {
    spawnMapEvents();
  }, 15 * 60 * 1000);

  // Initial map events spawn
  setTimeout(() => {
    spawnMapEvents();
    console.log('Initial map events spawned');
  }, 6000);

  // Initialize Phase 6 system (NPCs, missions, economy)
  setTimeout(() => {
    initPhase6System();
  }, 7000);

  // Initialize Phase 7 system (Real Estate, Properties)
  setTimeout(() => {
    initPhase7System();
  }, 8000);

  // Process property decay every 6 hours
  setInterval(() => {
    processPropertyDecay();
  }, 6 * 60 * 60 * 1000);

  // Check for property raids every hour
  setInterval(() => {
    checkAllPropertiesForRaids();
  }, 60 * 60 * 1000);

  // Initialize Phase 8 system (Crew Wars, Territory Control)
  setTimeout(() => {
    initPhase8System();
  }, 9000);

  // Process war endings and state changes every 5 minutes
  setInterval(() => {
    processWarEndings();
  }, 5 * 60 * 1000);

  // Award POI control points every hour
  setInterval(() => {
    awardPoiControlPoints();
  }, 60 * 60 * 1000);

  // Process POI captures every minute
  setInterval(() => {
    processPoiCaptures();
  }, 60 * 1000);

  // Pay crew salaries once per day (check every hour)
  let lastSalaryDay = -1;
  setInterval(() => {
    const today = new Date().getUTCDay();
    if (today !== lastSalaryDay) {
      lastSalaryDay = today;
      payCrewSalaries();
      console.log('Crew salaries paid');
    }
  }, 60 * 60 * 1000);

  // Initialize Phase 9 system (Business Fronts, Money Laundering)
  setTimeout(() => {
    initPhase9System();
  }, 10000);

  // Process business legitimacy decay every 12 hours
  setInterval(() => {
    processBusinessDecay();
  }, 12 * 60 * 60 * 1000);

  // Process overdue taxes every 6 hours
  setInterval(() => {
    processOverdueTaxes();
  }, 6 * 60 * 60 * 1000);

  // Process investigation progression every hour
  setInterval(() => {
    processInvestigations();
  }, 60 * 60 * 1000);

  // Log laundering operations (monitoring only) every 30 minutes
  setInterval(() => {
    processLaunderingOperations();
  }, 30 * 60 * 1000);

  // Initialize Phase 10 system (Factions, Reputation)
  setTimeout(() => {
    initPhase10System();
  }, 11000);

  // Process faction events (war escalations, etc.) every hour
  setInterval(() => {
    processFactionEvents();
  }, 60 * 60 * 1000);

  // Process expired faction missions every 5 minutes
  setInterval(() => {
    processExpiredMissions();
  }, 5 * 60 * 1000);

  // Initialize Phase 11 system (PVP Combat, Bounties)
  setTimeout(() => {
    initPhase11System();
  }, 12000);

  // Process timed out combat sessions every 30 seconds
  setInterval(() => {
    processTimedOutCombats();
  }, 30 * 1000);

  // Process expired bounties every hour
  setInterval(() => {
    processExpiredBounties();
  }, 60 * 60 * 1000);

  // Process hitman attempts on high bounties every 6 hours
  setInterval(() => {
    processHitmanAttempts();
  }, 6 * 60 * 60 * 1000);

  // Process natural healing every 5 minutes
  setInterval(() => {
    processNaturalHealing();
  }, 5 * 60 * 1000);

  // Process nuclear cell passive regeneration every minute
  setInterval(() => {
    processPassiveRegen();
  }, 60 * 1000);

  // Process AI Grid heat decay every 5 minutes
  setInterval(() => {
    processHeatDecay();
  }, 5 * 60 * 1000);

  // Process AI Grid sector sweeps every 10 minutes
  setInterval(() => {
    processSectorSweeps();
  }, 10 * 60 * 1000);

  // Trigger random 2091 world events every 20 minutes
  setInterval(() => {
    triggerRandomWorldEvent();
  }, 20 * 60 * 1000);

  // Clean up ended world events every 5 minutes
  setInterval(() => {
    cleanupEndedEvents();
  }, 5 * 60 * 1000);

  // Process expired premium shop boosters every 5 minutes
  setInterval(() => {
    processExpiredBoosters();
  }, 5 * 60 * 1000);

  // Clean up expired NPC memories every 6 hours (World Memory System)
  setInterval(() => {
    cleanExpiredMemories();
  }, 6 * 60 * 60 * 1000);

  // Start district state calculator job (handles its own scheduling with 15-min interval)
  startDistrictStateCalculatorJob();
  console.log('District State Calculator job scheduler initialized');
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Close rate limiter Redis connection
  await shutdownRateLimiter();

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
