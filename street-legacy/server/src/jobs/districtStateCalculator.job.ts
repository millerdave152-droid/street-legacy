// District State Calculator Job
// Periodically recalculates district states based on recent events

import pool from '../db/connection.js';
import {
  recalculateDistrictState,
  getAllDistrictStates
} from '../services/districtEcosystem.service.js';
import { DistrictState } from '../types/districtEcosystem.types.js';

// Job configuration
const JOB_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INITIAL_DELAY_MS = 20 * 1000; // 20 seconds after startup

// Track job state
let isRunning = false;
let lastRunAt: Date | null = null;
let lastRunDuration: number | null = null;
let lastRunResults: {
  processed: number;
  failed: number;
  statusChanges: string[];
} | null = null;

/**
 * Main job function - recalculates all district states
 */
export async function runDistrictStateCalculation(): Promise<{
  processed: number;
  failed: number;
  statusChanges: string[];
  durationMs: number;
}> {
  if (isRunning) {
    console.log('[DistrictStateCalculator] Job already running, skipping...');
    return { processed: 0, failed: 0, statusChanges: [], durationMs: 0 };
  }

  isRunning = true;
  const startTime = Date.now();
  const statusChanges: string[] = [];
  let processed = 0;
  let failed = 0;

  console.log('[DistrictStateCalculator] Starting district state recalculation...');
  console.log(`[DistrictStateCalculator] Timestamp: ${new Date().toISOString()}`);

  try {
    // Get all district IDs from district_states table
    const districtsResult = await pool.query(
      'SELECT district_id FROM district_states ORDER BY district_id'
    );

    const districts = districtsResult.rows;
    console.log(`[DistrictStateCalculator] Found ${districts.length} districts to process`);

    // Get current states for comparison
    const beforeStates = await getAllDistrictStates();
    const beforeStatusMap = new Map<string, string>();
    beforeStates.forEach(s => beforeStatusMap.set(s.districtId, s.status));

    // Process each district
    for (const district of districts) {
      const districtId = district.district_id;

      try {
        console.log(`[DistrictStateCalculator] Processing: ${districtId}`);

        const newState = await recalculateDistrictState(districtId);

        if (newState) {
          processed++;

          // Check for status change
          const beforeStatus = beforeStatusMap.get(districtId);
          if (beforeStatus && beforeStatus !== newState.status) {
            const changeMsg = `${districtId}: ${beforeStatus} -> ${newState.status}`;
            statusChanges.push(changeMsg);
            console.log(`[DistrictStateCalculator] STATUS CHANGE: ${changeMsg}`);
          }

          // Log key metrics
          console.log(`[DistrictStateCalculator]   - crime=${newState.crimeIndex}, police=${newState.policePresence}, status=${newState.status}`);
        } else {
          console.warn(`[DistrictStateCalculator] No state returned for ${districtId}`);
          failed++;
        }
      } catch (error) {
        console.error(`[DistrictStateCalculator] Error processing ${districtId}:`, error);
        failed++;
        // Continue with next district - don't let one failure stop others
      }
    }

    const durationMs = Date.now() - startTime;

    // Update job state
    lastRunAt = new Date();
    lastRunDuration = durationMs;
    lastRunResults = { processed, failed, statusChanges };

    // Summary logging
    console.log('[DistrictStateCalculator] ========================================');
    console.log(`[DistrictStateCalculator] Job completed in ${durationMs}ms`);
    console.log(`[DistrictStateCalculator] Processed: ${processed}, Failed: ${failed}`);
    if (statusChanges.length > 0) {
      console.log(`[DistrictStateCalculator] Status changes: ${statusChanges.length}`);
      statusChanges.forEach(c => console.log(`[DistrictStateCalculator]   - ${c}`));
    } else {
      console.log('[DistrictStateCalculator] No status changes detected');
    }
    console.log('[DistrictStateCalculator] ========================================');

    return { processed, failed, statusChanges, durationMs };
  } catch (error) {
    console.error('[DistrictStateCalculator] Fatal error in job:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Get job status information
 */
export function getJobStatus(): {
  isRunning: boolean;
  lastRunAt: Date | null;
  lastRunDuration: number | null;
  lastRunResults: typeof lastRunResults;
  nextRunIn: number | null;
} {
  let nextRunIn: number | null = null;
  if (lastRunAt) {
    const msSinceLastRun = Date.now() - lastRunAt.getTime();
    nextRunIn = Math.max(0, JOB_INTERVAL_MS - msSinceLastRun);
  }

  return {
    isRunning,
    lastRunAt,
    lastRunDuration,
    lastRunResults,
    nextRunIn
  };
}

/**
 * Start the scheduled job
 */
export function startDistrictStateCalculatorJob(): NodeJS.Timeout {
  console.log('[DistrictStateCalculator] Initializing job scheduler...');
  console.log(`[DistrictStateCalculator] Interval: ${JOB_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`[DistrictStateCalculator] Initial delay: ${INITIAL_DELAY_MS / 1000} seconds`);

  // Initial run after delay
  setTimeout(() => {
    console.log('[DistrictStateCalculator] Running initial calculation...');
    runDistrictStateCalculation().catch(err => {
      console.error('[DistrictStateCalculator] Initial run failed:', err);
    });
  }, INITIAL_DELAY_MS);

  // Schedule periodic runs
  const intervalId = setInterval(() => {
    console.log('[DistrictStateCalculator] Scheduled run triggered');
    runDistrictStateCalculation().catch(err => {
      console.error('[DistrictStateCalculator] Scheduled run failed:', err);
    });
  }, JOB_INTERVAL_MS);

  console.log('[DistrictStateCalculator] Job scheduler started');
  return intervalId;
}

/**
 * Stop the scheduled job
 */
export function stopDistrictStateCalculatorJob(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('[DistrictStateCalculator] Job scheduler stopped');
}

export default {
  runDistrictStateCalculation,
  getJobStatus,
  startDistrictStateCalculatorJob,
  stopDistrictStateCalculatorJob
};
