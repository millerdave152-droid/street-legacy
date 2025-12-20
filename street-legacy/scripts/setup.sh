#!/bin/bash
# =============================================================================
# STREET LEGACY - SETUP SCRIPT
# One-time setup for development environment
# =============================================================================

set -e

echo ""
echo "=========================================="
echo "   STREET LEGACY - Setup Script"
echo "=========================================="
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is required but not installed."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "  Node.js: $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is required but not installed."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "  npm: v$NPM_VERSION"

# Optional: Check for Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker -v | cut -d' ' -f3 | tr -d ',')
    echo "  Docker: v$DOCKER_VERSION"
else
    echo "  Docker: Not installed (optional)"
fi

# Optional: Check for Supabase CLI
if command -v supabase &> /dev/null; then
    SUPABASE_VERSION=$(supabase -v | head -n1)
    echo "  Supabase CLI: $SUPABASE_VERSION"
else
    echo "  Supabase CLI: Not installed (optional)"
    echo "    Install with: npm install -g supabase"
fi

echo ""
echo "Installing dependencies..."

# Install root dependencies (if any)
if [ -f "package.json" ]; then
    echo "  Installing root dependencies..."
    npm install
fi

# Install client dependencies
if [ -d "client" ]; then
    echo "  Installing client dependencies..."
    cd client
    npm install
    cd ..
fi

# Install shared dependencies (if exists)
if [ -d "shared" ] && [ -f "shared/package.json" ]; then
    echo "  Installing shared dependencies..."
    cd shared
    npm install
    cd ..
fi

echo ""
echo "Setting up environment files..."

# Create client .env if not exists
if [ ! -f "client/.env" ]; then
    if [ -f "client/.env.example" ]; then
        cp client/.env.example client/.env
        echo "  Created client/.env from template"
        echo "  -> Please edit client/.env with your Supabase credentials"
    fi
else
    echo "  client/.env already exists"
fi

# Create server .env if not exists
if [ ! -f "server/.env" ]; then
    if [ -f "server/.env.example" ]; then
        cp server/.env.example server/.env
        echo "  Created server/.env from template"
        echo "  -> Please edit server/.env with your Supabase credentials"
    fi
else
    echo "  server/.env already exists"
fi

echo ""
echo "=========================================="
echo "   Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your Supabase credentials:"
echo "   - Edit client/.env"
echo "   - Edit server/.env"
echo ""
echo "2. Run database migrations:"
echo "   ./scripts/run-migrations.sh"
echo ""
echo "3. Deploy Edge Functions:"
echo "   ./scripts/deploy-functions.sh"
echo ""
echo "4. Start development server:"
echo "   cd client && npm run dev"
echo ""
echo "Happy coding!"
