import { PoolClient } from 'pg';
import pool from './connection.js';

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// SECURITY: Whitelist of allowed table names to prevent SQL injection
const ALLOWED_TABLES = new Set([
  'players',
  'crews',
  'crew_members',
  'crew_invites',
  'businesses',
  'business_types',
  'properties',
  'property_upgrades',
  'items',
  'player_inventory',
  'transactions',
  'friends',
  'player_relationships',
  'player_messages',
  'notifications',
  'crime_logs',
  'crime_types',
  'job_logs',
  'job_types',
  'districts',
  'district_influence',
  'district_chat',
  'player_cooldowns',
  'player_missions',
  'player_achievements',
  'missions',
  'achievements',
  'marketplace_listings',
  'game_events',
  'scheduled_events',
  'admin_actions',
  'business_income_logs'
]);

// SECURITY: Whitelist of allowed ID column names
const ALLOWED_ID_COLUMNS = new Set([
  'id',
  'player_id',
  'crew_id',
  'business_id',
  'property_id',
  'item_id',
  'mission_id',
  'district_id',
  'crime_type_id',
  'job_type_id',
  'achievement_id'
]);

/**
 * Validate table name against whitelist to prevent SQL injection
 */
function validateTableName(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
}

/**
 * Validate column name against whitelist to prevent SQL injection
 */
function validateColumnName(column: string): void {
  if (!ALLOWED_ID_COLUMNS.has(column)) {
    throw new Error(`Invalid column name: ${column}`);
  }
}

/**
 * Execute a callback within a database transaction
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction and return a result object (doesn't throw)
 */
export async function withSafeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<TransactionResult<T>> {
  try {
    const data = await withTransaction(callback);
    return { success: true, data };
  } catch (error) {
    console.error('Transaction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed'
    };
  }
}

/**
 * Lock a row for update within a transaction (prevents race conditions)
 */
export async function lockRowForUpdate<T = any>(
  client: PoolClient,
  table: string,
  id: number | string,
  idColumn: string = 'id'
): Promise<T | null> {
  // SECURITY: Validate table and column names against whitelist
  validateTableName(table);
  validateColumnName(idColumn);

  const result = await client.query(
    `SELECT * FROM ${table} WHERE ${idColumn} = $1 FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Lock multiple rows for update (use consistent ordering to prevent deadlocks)
 */
export async function lockRowsForUpdate<T = any>(
  client: PoolClient,
  table: string,
  ids: (number | string)[],
  idColumn: string = 'id'
): Promise<T[]> {
  // SECURITY: Validate table and column names against whitelist
  validateTableName(table);
  validateColumnName(idColumn);

  // Sort IDs to prevent deadlocks when locking multiple rows
  const sortedIds = [...ids].sort();
  const placeholders = sortedIds.map((_, i) => `$${i + 1}`).join(', ');

  const result = await client.query(
    `SELECT * FROM ${table} WHERE ${idColumn} IN (${placeholders}) ORDER BY ${idColumn} FOR UPDATE`,
    sortedIds
  );
  return result.rows;
}

/**
 * Execute a callback with a SELECT FOR UPDATE lock
 * Prevents race conditions on specific rows
 * Note: whereClause should only contain parameterized conditions (e.g., "id = $1")
 */
export async function withRowLock<T>(
  tableName: string,
  whereClause: string,
  params: any[],
  callback: (client: PoolClient, lockedRow: any) => Promise<T>
): Promise<T> {
  // SECURITY: Validate table name against whitelist
  validateTableName(tableName);

  // SECURITY: Basic validation of whereClause to prevent obvious injection
  // Only allow alphanumeric characters, spaces, basic operators, and parameter placeholders
  const safeWherePattern = /^[\w\s=<>!$,()]+$/;
  if (!safeWherePattern.test(whereClause)) {
    throw new Error('Invalid characters in where clause');
  }

  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT * FROM ${tableName} WHERE ${whereClause} FOR UPDATE`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`Row not found in ${tableName}`);
    }

    return callback(client, result.rows[0]);
  });
}

/**
 * Retry a transaction on serialization failure
 * Useful for high-concurrency scenarios
 */
export async function withRetryableTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withTransaction(callback);
    } catch (error: any) {
      lastError = error;

      // Check if it's a serialization failure (code 40001)
      if (error.code === '40001' && attempt < maxRetries - 1) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export default {
  withTransaction,
  withSafeTransaction,
  withRowLock,
  withRetryableTransaction,
  lockRowForUpdate,
  lockRowsForUpdate
};
