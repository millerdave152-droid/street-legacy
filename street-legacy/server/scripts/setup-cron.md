# Setting Up Scheduled Jobs for Street Legacy

Street Legacy requires several scheduled jobs to run game maintenance tasks like energy regeneration, business income accumulation, and cleanup operations.

## Scheduled Jobs Overview

| Job | Frequency | Description |
|-----|-----------|-------------|
| `energy-regen` | Every 10 minutes | Restores 5 energy to all players below max |
| `hourly` | Every hour | Heat decay, listing expiry, jail releases, business income |
| `daily` | Daily at midnight | Property taxes, mission resets, property values, district stats |
| `weekly` | Weekly on Sunday | Data cleanup, weekly mission resets |

## Option 1: GitHub Actions (Recommended - Free)

Create `.github/workflows/scheduled-jobs.yml`:

```yaml
name: Street Legacy Scheduled Jobs

on:
  schedule:
    # Every 10 minutes - energy regeneration
    - cron: '*/10 * * * *'
    # Every hour at minute 0 - hourly maintenance
    - cron: '0 * * * *'
    # Daily at midnight UTC - daily maintenance
    - cron: '0 0 * * *'
    # Weekly on Sunday at midnight UTC - weekly maintenance
    - cron: '0 0 * * 0'
  workflow_dispatch:
    inputs:
      job_type:
        description: 'Job to run manually'
        required: true
        default: 'hourly'
        type: choice
        options:
          - energy-regen
          - hourly
          - daily
          - weekly
          - health

jobs:
  run-maintenance:
    runs-on: ubuntu-latest
    steps:
      - name: Determine job type
        id: job
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "type=${{ github.event.inputs.job_type }}" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "*/10 * * * *" ]; then
            echo "type=energy-regen" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "0 * * * *" ]; then
            echo "type=hourly" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "0 0 * * *" ]; then
            echo "type=daily" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.schedule }}" = "0 0 * * 0" ]; then
            echo "type=weekly" >> $GITHUB_OUTPUT
          fi

      - name: Run scheduled job
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/scheduled-maintenance?job=${{ steps.job.outputs.type }}" \
            -H "Authorization: Bearer ${{ secrets.SCHEDULER_SECRET }}" \
            -H "Content-Type: application/json")

          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')

          echo "Response: $body"
          echo "HTTP Code: $http_code"

          if [ "$http_code" != "200" ]; then
            echo "Job failed with status $http_code"
            exit 1
          fi

      - name: Log result
        if: always()
        run: |
          echo "Job ${{ steps.job.outputs.type }} completed at $(date -u)"
```

### GitHub Secrets Required

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret | Description | Example |
|--------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `SCHEDULER_SECRET` | Secure random string | Generate with `openssl rand -hex 32` |

### Adding the Scheduler Secret to Supabase

```bash
# Generate a secure secret
openssl rand -hex 32

# Add to Supabase Edge Functions secrets via CLI
supabase secrets set SCHEDULER_SECRET=your-generated-secret

# Or via Supabase Dashboard:
# Project Settings > Edge Functions > Add secret
```

---

## Option 2: Supabase pg_cron (Pro Plan)

If you have Supabase Pro plan with pg_cron extension:

```sql
-- Enable pg_cron extension (requires Pro plan)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage
GRANT USAGE ON SCHEMA cron TO postgres;

-- Energy regeneration every 10 minutes
SELECT cron.schedule(
  'energy-regen',
  '*/10 * * * *',
  $$SELECT regenerate_player_energy()$$
);

-- Hourly maintenance
SELECT cron.schedule(
  'hourly-maintenance',
  '0 * * * *',
  $$SELECT run_hourly_maintenance()$$
);

-- Daily maintenance at midnight UTC
SELECT cron.schedule(
  'daily-maintenance',
  '0 0 * * *',
  $$SELECT run_daily_maintenance()$$
);

-- Weekly maintenance on Sunday at midnight UTC
SELECT cron.schedule(
  'weekly-maintenance',
  '0 0 * * 0',
  $$SELECT run_weekly_maintenance()$$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## Option 3: External Cron Service (cron-job.org)

Free tier available at https://cron-job.org

### Setup Steps:

1. Create account at https://cron-job.org
2. Add new cron jobs for each scheduled task:

| Job Name | URL | Schedule |
|----------|-----|----------|
| Energy Regen | `https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=energy-regen` | `*/10 * * * *` |
| Hourly | `https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=hourly` | `0 * * * *` |
| Daily | `https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=daily` | `0 0 * * *` |
| Weekly | `https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=weekly` | `0 0 * * 0` |

3. For each job, set the header:
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_SCHEDULER_SECRET`

---

## Option 4: Vercel Cron (if using Vercel)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/energy-regen",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/hourly",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/daily",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/weekly",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

Create API routes that call the Supabase Edge Function.

---

## Testing Scheduled Jobs

### Manual Trigger via CLI

```bash
# Test energy regeneration
curl -X POST \
  "https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=energy-regen" \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET"

# Test hourly maintenance
curl -X POST \
  "https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=hourly" \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET"

# Health check
curl -X POST \
  "https://your-project.supabase.co/functions/v1/scheduled-maintenance?job=health" \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET"
```

### Expected Response

```json
{
  "success": true,
  "result": {
    "job": "hourly",
    "heat_decay": { "properties_updated": 5, "players_updated": 12 },
    "expired_listings": { "expired_count": 0 },
    "mission_expirations": { "expired_missions": 2 },
    "ran_at": "2024-01-15T12:00:00.000Z"
  },
  "duration_ms": 234,
  "completed_at": "2024-01-15T12:00:00.234Z"
}
```

---

## Monitoring

### Check Game Events Table

```sql
-- View recent maintenance runs
SELECT *
FROM game_events
WHERE event_type = 'system'
  AND event_subtype IN ('hourly_maintenance', 'daily_maintenance', 'weekly_maintenance')
ORDER BY created_at DESC
LIMIT 10;
```

### Alert on Failures

Set up monitoring to alert if maintenance jobs haven't run:

```sql
-- Check if hourly maintenance ran in last 2 hours
SELECT
  CASE
    WHEN MAX(created_at) > NOW() - INTERVAL '2 hours' THEN 'OK'
    ELSE 'ALERT: Hourly maintenance may have failed'
  END as status,
  MAX(created_at) as last_run
FROM game_events
WHERE event_type = 'system'
  AND event_subtype = 'hourly_maintenance';
```

---

## Environment Variables Summary

| Variable | Where to Set | Description |
|----------|--------------|-------------|
| `SCHEDULER_SECRET` | Supabase Edge Function Secrets | Auth token for scheduled jobs |
| `SUPABASE_URL` | GitHub Secrets / Cron Service | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (auto-set) | Used by Edge Functions |
