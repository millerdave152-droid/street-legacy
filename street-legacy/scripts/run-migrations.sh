#!/bin/bash
# =============================================================================
# STREET LEGACY - DATABASE MIGRATIONS
# Instructions for running database migrations
# =============================================================================

echo ""
echo "=========================================="
echo "   Database Migrations"
echo "=========================================="
echo ""
echo "Supabase manages the database. Run migrations via:"
echo ""
echo "OPTION 1: Supabase Dashboard (Recommended)"
echo "=========================================="
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Run each migration file in order:"
echo ""

# List migration files
if [ -d "server/supabase/migrations" ]; then
    echo "Migration files found:"
    ls -1 server/supabase/migrations/*.sql 2>/dev/null | while read f; do
        echo "  - $(basename $f)"
    done
else
    echo "  (No migration files found)"
fi

echo ""
echo "OPTION 2: Supabase CLI"
echo "=========================================="
echo "If you have the Supabase CLI configured:"
echo ""
echo "  cd server"
echo "  supabase db push"
echo ""
echo "Or to reset and reseed:"
echo ""
echo "  supabase db reset"
echo ""
echo "=========================================="
echo ""
