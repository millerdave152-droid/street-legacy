/**
 * Event Pipeline Service
 * Centralized event processing with idempotency tracking and audit logging
 *
 * Features:
 * - Operation idempotency via operationId
 * - Audit logging for all game operations
 * - Automatic broadcasting based on action type
 * - Consistent validation patterns
 */

import pool from '../db/connection.js';
import { broadcast, sendToUser, sendToCrew, sendToDistrict } from '../websocket/index.js';

// ============================================================================
// TYPES
// ============================================================================

export type IntentType =
  | 'COMMIT_CRIME'
  | 'EXECUTE_HEIST'
  | 'BUY_PROPERTY'
  | 'SELL_PROPERTY'
  | 'UPGRADE_PROPERTY'
  | 'COLLECT_INCOME'
  | 'DEPOSIT_FUNDS'
  | 'WITHDRAW_FUNDS'
  | 'TRANSFER_FUNDS'
  | 'TRAVEL_TO_DISTRICT'
  | 'JOIN_HEIST_ROOM'
  | 'LEAVE_HEIST_ROOM'
  | 'SET_HEIST_READY';

export interface GameIntent {
  operationId?: string;
  type: IntentType;
  params: Record<string, any>;
  timestamp?: number;
}

export interface GameResult {
  success: boolean;
  operationId?: string;
  type: IntentType;
  data: Record<string, any>;
  playerState?: PlayerStateSnapshot;
  error?: string;
  duplicate?: boolean;
}

export interface PlayerStateSnapshot {
  cash: number;
  xp: number;
  heat: number;
  energy: number;
  health?: number;
  level?: number;
}

export interface AuditEntry {
  operationId: string;
  playerId: number;
  type: string;
  params: Record<string, any>;
  result: 'success' | 'failure' | 'duplicate';
  resultData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface BroadcastContext {
  playerId: number;
  crewId?: number;
  districtId?: number;
  isNewsworthy?: boolean;
  newsSignificance?: number; // 1-9 scale
}

// ============================================================================
// OPERATION TRACKER (Idempotency)
// ============================================================================

class OperationTracker {
  // In-memory cache for recent operations
  // For production with multiple servers, use Redis
  private recentOps = new Map<string, { result: any; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if operation was already processed, or process and store result
   */
  async checkAndStore<T extends Record<string, any>>(
    operationId: string | undefined,
    execute: () => Promise<T>
  ): Promise<T & { duplicate?: boolean }> {
    // If no operationId, just execute (backward compatibility)
    if (!operationId) {
      const result = await execute();
      return { ...result, duplicate: false };
    }

    // Check cache for existing result
    const existing = this.recentOps.get(operationId);
    if (existing && Date.now() - existing.timestamp < this.TTL) {
      console.log(`[EventPipeline] Duplicate operation detected: ${operationId}`);
      return { ...existing.result, duplicate: true };
    }

    // Execute and store
    const result = await execute();
    this.recentOps.set(operationId, { result, timestamp: Date.now() });

    return { ...result, duplicate: false };
  }

  /**
   * Check if operation exists without executing
   */
  exists(operationId: string): boolean {
    const existing = this.recentOps.get(operationId);
    return !!(existing && Date.now() - existing.timestamp < this.TTL);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of this.recentOps.entries()) {
      if (now - value.timestamp >= this.TTL) {
        this.recentOps.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[EventPipeline] Cleaned up ${cleaned} expired operations`);
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { activeOperations: number; oldestTimestamp: number | null } {
    let oldest: number | null = null;
    for (const value of this.recentOps.values()) {
      if (oldest === null || value.timestamp < oldest) {
        oldest = value.timestamp;
      }
    }
    return {
      activeOperations: this.recentOps.size,
      oldestTimestamp: oldest,
    };
  }
}

// ============================================================================
// AUDIT LOGGER
// ============================================================================

class AuditLogger {
  /**
   * Log an operation to the database
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO operation_audit_log
         (operation_id, player_id, operation_type, params, result, result_data, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.operationId,
          entry.playerId,
          entry.type,
          JSON.stringify(entry.params),
          entry.result,
          entry.resultData ? JSON.stringify(entry.resultData) : null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.timestamp,
        ]
      );
    } catch (error) {
      // Log error but don't fail the operation
      console.error('[AuditLogger] Failed to log operation:', error);
    }
  }

  /**
   * Query audit log for a specific player
   */
  async getPlayerHistory(
    playerId: number,
    limit: number = 100
  ): Promise<AuditEntry[]> {
    const result = await pool.query(
      `SELECT operation_id, player_id, operation_type, params, result, result_data, ip_address, user_agent, created_at
       FROM operation_audit_log
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [playerId, limit]
    );
    return result.rows.map((row) => ({
      operationId: row.operation_id,
      playerId: row.player_id,
      type: row.operation_type,
      params: row.params,
      result: row.result,
      resultData: row.result_data,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: row.created_at,
    }));
  }

  /**
   * Check for suspicious patterns (rate of failures, etc.)
   */
  async checkSuspiciousActivity(
    playerId: number,
    windowMinutes: number = 30
  ): Promise<{ suspicious: boolean; reason?: string }> {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE result = 'failure') as failures,
         COUNT(*) FILTER (WHERE result = 'duplicate') as duplicates,
         COUNT(*) as total
       FROM operation_audit_log
       WHERE player_id = $1
         AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'`,
      [playerId]
    );

    const { failures, duplicates, total } = result.rows[0];
    const failureRate = total > 0 ? failures / total : 0;
    const duplicateRate = total > 0 ? duplicates / total : 0;

    if (duplicateRate > 0.5 && total > 10) {
      return {
        suspicious: true,
        reason: `High duplicate rate: ${(duplicateRate * 100).toFixed(1)}%`,
      };
    }

    if (failureRate > 0.8 && total > 20) {
      return {
        suspicious: true,
        reason: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
      };
    }

    return { suspicious: false };
  }
}

// ============================================================================
// BROADCAST ROUTER
// ============================================================================

class BroadcastRouter {
  /**
   * Route broadcast based on action type and context
   */
  broadcast(
    intentType: IntentType,
    result: GameResult,
    context: BroadcastContext
  ): void {
    // Always send stat update to the player
    if (result.playerState) {
      sendToUser(context.playerId, {
        type: 'game:stat_update',
        timestamp: Date.now(),
        stats: result.playerState,
      });
    }

    // Route based on intent type
    switch (intentType) {
      case 'COMMIT_CRIME':
        this.broadcastCrimeResult(result, context);
        break;
      case 'EXECUTE_HEIST':
        this.broadcastHeistResult(result, context);
        break;
      case 'BUY_PROPERTY':
      case 'SELL_PROPERTY':
        // Properties are private - no broadcast
        break;
      case 'TRANSFER_FUNDS':
        this.broadcastTransfer(result, context);
        break;
      case 'TRAVEL_TO_DISTRICT':
        this.broadcastTravel(result, context);
        break;
      default:
        // Other actions don't need broadcast
        break;
    }

    // Newsworthy events get global broadcast
    if (context.isNewsworthy && context.newsSignificance && context.newsSignificance >= 7) {
      this.broadcastNews(intentType, result, context);
    }
  }

  private broadcastCrimeResult(result: GameResult, context: BroadcastContext): void {
    // If crime caused significant heat change, notify district
    const heatGained = result.data?.heatGained || 0;
    if (heatGained >= 5 && context.districtId) {
      sendToDistrict(context.districtId, {
        type: 'district:heat_changed',
        timestamp: Date.now(),
        heat: result.data?.districtHeat || 0,
        delta: heatGained,
        cause: 'criminal_activity',
      });
    }
  }

  private broadcastHeistResult(result: GameResult, context: BroadcastContext): void {
    // Notify crew of heist completion
    if (context.crewId && result.success) {
      sendToCrew(context.crewId, {
        type: 'crew:heist_completed',
        timestamp: Date.now(),
        heistId: result.data?.heistId,
        success: result.data?.heistSuccess,
        payout: result.data?.payout,
      });
    }
  }

  private broadcastTransfer(result: GameResult, context: BroadcastContext): void {
    // Notify recipient of transfer
    const recipientId = result.data?.recipientId;
    if (recipientId && result.success) {
      sendToUser(recipientId, {
        type: 'economy:transfer_received',
        timestamp: Date.now(),
        fromPlayer: result.data?.fromPlayer,
        amount: result.data?.amount,
        newBankBalance: result.data?.recipientNewBalance,
        note: result.data?.note,
      });
    }
  }

  private broadcastTravel(result: GameResult, context: BroadcastContext): void {
    const oldDistrictId = result.data?.oldDistrictId;
    const newDistrictId = result.data?.newDistrictId;
    const username = result.data?.username;

    // Notify old district of departure
    if (oldDistrictId && username) {
      sendToDistrict(oldDistrictId, {
        type: 'district:player_left',
        timestamp: Date.now(),
        username,
      });
    }

    // Notify new district of arrival
    if (newDistrictId && username) {
      sendToDistrict(newDistrictId, {
        type: 'district:player_entered',
        timestamp: Date.now(),
        username,
      });
    }
  }

  private broadcastNews(
    intentType: IntentType,
    result: GameResult,
    context: BroadcastContext
  ): void {
    const headlines: Record<string, string> = {
      EXECUTE_HEIST: result.data?.heistSuccess
        ? `Major heist pulled off in ${result.data?.districtName || 'the city'}!`
        : `Failed heist attempt rocks ${result.data?.districtName || 'the city'}`,
      COMMIT_CRIME: `Crime wave hits ${result.data?.districtName || 'the streets'}`,
    };

    const headline = headlines[intentType];
    if (headline) {
      broadcast({
        type: 'world:news',
        timestamp: Date.now(),
        headline,
        category: 'crime',
        significance: context.newsSignificance || 5,
      });
    }
  }
}

// ============================================================================
// EVENT PIPELINE SERVICE
// ============================================================================

class EventPipelineService {
  private operationTracker: OperationTracker;
  private auditLogger: AuditLogger;
  private broadcastRouter: BroadcastRouter;

  constructor() {
    this.operationTracker = new OperationTracker();
    this.auditLogger = new AuditLogger();
    this.broadcastRouter = new BroadcastRouter();
  }

  /**
   * Process a game intent with idempotency and audit logging
   */
  async processIntent<T extends GameResult>(
    playerId: number,
    intent: GameIntent,
    execute: () => Promise<T>,
    context?: Partial<BroadcastContext>,
    requestInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<T> {
    const operationId = intent.operationId || `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check idempotency and execute
    const result = await this.operationTracker.checkAndStore(
      intent.operationId, // Only use provided operationId for idempotency
      execute
    );

    // Determine audit result
    let auditResult: 'success' | 'failure' | 'duplicate' = 'success';
    if (result.duplicate) {
      auditResult = 'duplicate';
    } else if (!result.success) {
      auditResult = 'failure';
    }

    // Log to audit trail (async, don't await)
    this.auditLogger.log({
      operationId,
      playerId,
      type: intent.type,
      params: intent.params,
      result: auditResult,
      resultData: result.data,
      ipAddress: requestInfo?.ipAddress,
      userAgent: requestInfo?.userAgent,
      timestamp: new Date(),
    }).catch((err) => console.error('[EventPipeline] Audit log error:', err));

    // Broadcast result if not a duplicate
    if (!result.duplicate && result.success) {
      const fullContext: BroadcastContext = {
        playerId,
        ...context,
      };
      this.broadcastRouter.broadcast(intent.type, result, fullContext);
    }

    // Add operationId to result
    return {
      ...result,
      operationId,
    };
  }

  /**
   * Check if an operation ID was already processed
   */
  isOperationProcessed(operationId: string): boolean {
    return this.operationTracker.exists(operationId);
  }

  /**
   * Get audit history for a player
   */
  async getPlayerAuditHistory(playerId: number, limit?: number): Promise<AuditEntry[]> {
    return this.auditLogger.getPlayerHistory(playerId, limit);
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(playerId: number): Promise<{ suspicious: boolean; reason?: string }> {
    return this.auditLogger.checkSuspiciousActivity(playerId);
  }

  /**
   * Get operation tracker stats for monitoring
   */
  getTrackerStats(): { activeOperations: number; oldestTimestamp: number | null } {
    return this.operationTracker.getStats();
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    this.operationTracker.stop();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const eventPipeline = new EventPipelineService();

// Export types and classes for testing
export { OperationTracker, AuditLogger, BroadcastRouter };
