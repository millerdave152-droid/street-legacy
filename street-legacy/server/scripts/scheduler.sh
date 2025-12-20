#!/bin/bash
# =============================================================================
# STREET LEGACY - SCHEDULER SCRIPT
# Triggers Supabase Edge Function for scheduled maintenance tasks
# =============================================================================

set -e

JOB_TYPE=${1:-hourly}
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting ${JOB_TYPE} maintenance job..."

# Validate required environment variables
if [ -z "$SUPABASE_URL" ]; then
    echo "ERROR: SUPABASE_URL is not set"
    exit 1
fi

if [ -z "$SCHEDULER_SECRET" ]; then
    echo "ERROR: SCHEDULER_SECRET is not set"
    exit 1
fi

# Make request to Edge Function
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${SUPABASE_URL}/functions/v1/scheduled-maintenance" \
    -H "Authorization: Bearer ${SCHEDULER_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"job_type\": \"${JOB_TYPE}\"}")

# Extract HTTP status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "[$TIMESTAMP] ${JOB_TYPE} job completed successfully (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
else
    echo "[$TIMESTAMP] ERROR: ${JOB_TYPE} job failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    exit 1
fi
