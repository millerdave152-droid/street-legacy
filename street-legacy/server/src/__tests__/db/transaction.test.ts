/**
 * Transaction Tests
 * Tests for database transaction utilities and SQL injection prevention
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the pool before importing
const mockQuery = jest.fn<() => Promise<{ rows: any[] }>>();
const mockRelease = jest.fn();
const mockClient = {
  query: mockQuery,
  release: mockRelease,
};

jest.unstable_mockModule('../db/connection.js', () => ({
  default: {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    query: mockQuery,
    on: jest.fn(),
  },
}));

// Import after mocking
const transaction = await import('../../db/transaction.js');

describe('Transaction Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
  });

  describe('SQL Injection Prevention', () => {
    describe('lockRowForUpdate', () => {
      it('should accept valid table names', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1, username: 'test' }] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withTransaction(async (client) => {
          const result = await transaction.lockRowForUpdate(client as any, 'players', 1);
          expect(result).toEqual({ id: 1, username: 'test' });
        });
      });

      it('should reject invalid table names', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN

        await expect(
          transaction.withTransaction(async (client) => {
            await transaction.lockRowForUpdate(client as any, 'invalid_table', 1);
          })
        ).rejects.toThrow('Invalid table name');
      });

      it('should reject SQL injection in table name', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN

        await expect(
          transaction.withTransaction(async (client) => {
            await transaction.lockRowForUpdate(client as any, 'players; DROP TABLE players;--', 1);
          })
        ).rejects.toThrow('Invalid table name');
      });

      it('should accept valid column names', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withTransaction(async (client) => {
          const result = await transaction.lockRowForUpdate(client as any, 'players', 1, 'player_id');
          expect(result).toEqual({ id: 1 });
        });
      });

      it('should reject invalid column names', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN

        await expect(
          transaction.withTransaction(async (client) => {
            await transaction.lockRowForUpdate(client as any, 'players', 1, 'invalid_column');
          })
        ).rejects.toThrow('Invalid column name');
      });

      it('should reject SQL injection in column name', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN

        await expect(
          transaction.withTransaction(async (client) => {
            await transaction.lockRowForUpdate(client as any, 'players', 1, 'id; DROP TABLE players;--');
          })
        ).rejects.toThrow('Invalid column name');
      });
    });

    describe('lockRowsForUpdate', () => {
      it('should sort IDs to prevent deadlocks', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withTransaction(async (client) => {
          await transaction.lockRowsForUpdate(client as any, 'players', [3, 1, 2]);
        });

        // Verify the IDs were sorted in the query
        const selectCall = (mockQuery.mock.calls as unknown[][]).find(
          (call) => typeof call[0] === 'string' && (call[0] as string).includes('SELECT')
        );
        expect(selectCall).toBeDefined();
        expect(selectCall![1]).toEqual([1, 2, 3]); // Sorted
      });

      it('should reject invalid table in lockRowsForUpdate', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN

        await expect(
          transaction.withTransaction(async (client) => {
            await transaction.lockRowsForUpdate(client as any, 'evil_table', [1, 2]);
          })
        ).rejects.toThrow('Invalid table name');
      });
    });

    describe('withRowLock', () => {
      it('should accept safe where clauses', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withRowLock('players', 'id = $1', [1], async (client, row) => {
          expect(row).toEqual({ id: 1 });
          return row;
        });
      });

      it('should reject dangerous characters in where clause', async () => {
        await expect(
          transaction.withRowLock('players', 'id = $1; DROP TABLE players;--', [1], async () => {})
        ).rejects.toThrow('Invalid characters in where clause');
      });

      it('should reject quotes in where clause', async () => {
        await expect(
          transaction.withRowLock('players', "id = '1'", [], async () => {})
        ).rejects.toThrow('Invalid characters in where clause');
      });
    });
  });

  describe('Transaction Handling', () => {
    describe('withTransaction', () => {
      it('should commit on success', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User query
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        const result = await transaction.withTransaction(async (client) => {
          const res = await client.query('SELECT * FROM players WHERE id = $1', [1]);
          return res.rows[0];
        });

        expect(result).toEqual({ id: 1 });
        expect(mockQuery).toHaveBeenCalledWith('BEGIN');
        expect(mockQuery).toHaveBeenCalledWith('COMMIT');
        expect(mockRelease).toHaveBeenCalled();
      });

      it('should rollback on error', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Query failed')) // User query
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        await expect(
          transaction.withTransaction(async (client) => {
            await client.query('INVALID SQL');
          })
        ).rejects.toThrow('Query failed');

        expect(mockQuery).toHaveBeenCalledWith('BEGIN');
        expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
        expect(mockRelease).toHaveBeenCalled();
      });

      it('should always release the client', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withTransaction(async () => {});

        expect(mockRelease).toHaveBeenCalled();
      });
    });

    describe('withSafeTransaction', () => {
      it('should return success result on success', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        const result = await transaction.withSafeTransaction(async () => {
          return { data: 'test' };
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ data: 'test' });
      });

      it('should return error result on failure', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Test error'))
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        const result = await transaction.withSafeTransaction(async () => {
          throw new Error('Test error');
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Test error');
      });
    });

    describe('withRetryableTransaction', () => {
      it('should retry on serialization failure', async () => {
        const serializationError = { code: '40001' };

        mockQuery
          // First attempt
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(serializationError)
          .mockResolvedValueOnce({ rows: [] }) // ROLLBACK
          // Second attempt (success)
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        const result = await transaction.withRetryableTransaction(async (client) => {
          const res = await client.query('SELECT * FROM test');
          return res.rows[0];
        });

        expect(result).toEqual({ id: 1 });
      });

      it('should not retry non-serialization errors', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce({ code: '23505' }) // Unique violation
          .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        await expect(
          transaction.withRetryableTransaction(async (client) => {
            await client.query('INSERT INTO test VALUES (1)');
          })
        ).rejects.toEqual({ code: '23505' });
      });

      it('should give up after max retries', async () => {
        const serializationError = { code: '40001' };

        // Mock 3 failed attempts
        for (let i = 0; i < 3; i++) {
          mockQuery
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockRejectedValueOnce(serializationError)
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
        }

        await expect(
          transaction.withRetryableTransaction(async () => {
            throw serializationError;
          }, 3)
        ).rejects.toEqual(serializationError);
      });
    });
  });

  describe('Allowed Tables and Columns', () => {
    const validTables = [
      'players', 'crews', 'crew_members', 'businesses', 'properties',
      'items', 'player_inventory', 'transactions', 'friends',
      'notifications', 'crime_logs', 'districts', 'marketplace_listings'
    ];

    const validColumns = [
      'id', 'player_id', 'crew_id', 'business_id', 'property_id',
      'item_id', 'mission_id', 'district_id'
    ];

    validTables.forEach(table => {
      it(`should allow table: ${table}`, async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withTransaction(async (client) => {
          await transaction.lockRowForUpdate(client as any, table, 1);
        });

        // Should not throw
      });
    });

    validColumns.forEach(column => {
      it(`should allow column: ${column}`, async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await transaction.withTransaction(async (client) => {
          await transaction.lockRowForUpdate(client as any, 'players', 1, column);
        });

        // Should not throw
      });
    });
  });
});
