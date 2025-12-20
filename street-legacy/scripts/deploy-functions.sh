#!/bin/bash
# =============================================================================
# STREET LEGACY - DEPLOY EDGE FUNCTIONS
# Deploys all Supabase Edge Functions
# =============================================================================

set -e

echo ""
echo "=========================================="
echo "   Deploying Supabase Edge Functions"
echo "=========================================="
echo ""

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "ERROR: Supabase CLI is required but not installed."
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Check for project ref
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    # Try to get from .env file
    if [ -f "server/.env" ]; then
        export $(grep -v '^#' server/.env | xargs)
    fi
fi

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "ERROR: SUPABASE_PROJECT_REF is not set."
    echo "Set it in server/.env or as environment variable."
    exit 1
fi

echo "Project: $SUPABASE_PROJECT_REF"
echo ""

# Navigate to server directory
cd server

# List of functions to deploy
FUNCTIONS=(
    "auth-handler"
    "player-actions"
    "crew-actions"
    "social-actions"
    "admin-actions"
    "scheduled-maintenance"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$func" ]; then
        echo "Deploying $func..."
        supabase functions deploy $func --project-ref $SUPABASE_PROJECT_REF
        echo "  Done."
    else
        echo "  Skipping $func (directory not found)"
    fi
done

echo ""
echo "=========================================="
echo "   Deployment Complete!"
echo "=========================================="
echo ""
echo "Important: Set the SCHEDULER_SECRET in Supabase Dashboard:"
echo "  Project Settings > Edge Functions > scheduled-maintenance > Secrets"
echo ""
