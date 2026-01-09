-- Migration: 030_operation_audit_log
-- Purpose: Create operation audit log table for game action tracking and idempotency
-- Date: 2026-01-08

-- ============================================================================
-- OPERATION AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS operation_audit_log (
  id SERIAL PRIMARY KEY,
  operation_id VARCHAR(100) NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  params JSONB DEFAULT '{}',
  result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'duplicate')),
  result_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for idempotency lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_operation_audit_operation_id
  ON operation_audit_log(operation_id);

-- Index for player history queries
CREATE INDEX IF NOT EXISTS idx_operation_audit_player_time
  ON operation_audit_log(player_id, created_at DESC);

-- Index for operation type analysis
CREATE INDEX IF NOT EXISTS idx_operation_audit_type_time
  ON operation_audit_log(operation_type, created_at DESC);

-- Composite index for suspicious activity checks
CREATE INDEX IF NOT EXISTS idx_operation_audit_player_result_time
  ON operation_audit_log(player_id, result, created_at DESC);

-- ============================================================================
-- PARTITIONING (for high-volume tables, partition by month)
-- ============================================================================

-- Note: For production with high volume, consider partitioning:
-- CREATE TABLE operation_audit_log (
--   ...
-- ) PARTITION BY RANGE (created_at);
--
-- CREATE TABLE operation_audit_log_2026_01 PARTITION OF operation_audit_log
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ============================================================================
-- CLEANUP FUNCTION (remove old audit entries)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM operation_audit_log
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUSPICIOUS ACTIVITY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW suspicious_player_activity AS
SELECT
  player_id,
  COUNT(*) FILTER (WHERE result = 'failure') as failures,
  COUNT(*) FILTER (WHERE result = 'duplicate') as duplicates,
  COUNT(*) as total_operations,
  ROUND(100.0 * COUNT(*) FILTER (WHERE result = 'failure') / NULLIF(COUNT(*), 0), 1) as failure_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE result = 'duplicate') / NULLIF(COUNT(*), 0), 1) as duplicate_rate,
  MIN(created_at) as first_operation,
  MAX(created_at) as last_operation
FROM operation_audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY player_id
HAVING
  COUNT(*) > 10 AND (
    COUNT(*) FILTER (WHERE result = 'duplicate') > COUNT(*) * 0.5 OR
    COUNT(*) FILTER (WHERE result = 'failure') > COUNT(*) * 0.8
  );

-- ============================================================================
-- OPERATION STATS VIEW (for monitoring dashboard)
-- ============================================================================

CREATE OR REPLACE VIEW operation_stats AS
SELECT
  operation_type,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE result = 'success') as successes,
  COUNT(*) FILTER (WHERE result = 'failure') as failures,
  COUNT(*) FILTER (WHERE result = 'duplicate') as duplicates,
  COUNT(DISTINCT player_id) as unique_players
FROM operation_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation_type, DATE_TRUNC('hour', created_at)
ORDER BY hour DESC, operation_type;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE operation_audit_log IS 'Audit trail for all game operations with idempotency tracking';
COMMENT ON COLUMN operation_audit_log.operation_id IS 'Client-provided UUID for idempotency, or auto-generated';
COMMENT ON COLUMN operation_audit_log.operation_type IS 'Type of game action: COMMIT_CRIME, EXECUTE_HEIST, etc.';
COMMENT ON COLUMN operation_audit_log.params IS 'JSON parameters sent with the operation';
COMMENT ON COLUMN operation_audit_log.result IS 'Outcome: success, failure, or duplicate (idempotent replay)';
COMMENT ON COLUMN operation_audit_log.result_data IS 'JSON result data returned to client';
