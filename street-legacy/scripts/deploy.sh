#!/bin/bash
set -e

# Street Legacy Deployment Script
# Usage: ./scripts/deploy.sh [user@host] [deploy_path]

SSH_TARGET=${1:-"user@your-server.com"}
DEPLOY_PATH=${2:-"/opt/street-legacy"}

echo "=== Street Legacy Deployment ==="
echo "Target: $SSH_TARGET"
echo "Path: $DEPLOY_PATH"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "Error: .env.production file not found"
    echo "Copy .env.production.example to .env.production and configure it"
    exit 1
fi

# Create deployment archive
echo "Creating deployment archive..."
tar -czf deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='deploy.tar.gz' \
    .

# Upload to server
echo "Uploading to server..."
scp deploy.tar.gz "$SSH_TARGET:/tmp/street-legacy-deploy.tar.gz"
scp .env.production "$SSH_TARGET:/tmp/street-legacy.env"

# Deploy on server
echo "Deploying on server..."
ssh "$SSH_TARGET" << 'ENDSSH'
set -e

DEPLOY_PATH="${DEPLOY_PATH:-/opt/street-legacy}"

# Create directory if needed
sudo mkdir -p $DEPLOY_PATH
cd $DEPLOY_PATH

# Backup current deployment
if [ -d "current" ]; then
    sudo mv current "backup-$(date +%Y%m%d-%H%M%S)" || true
fi

# Extract new deployment
sudo mkdir -p current
sudo tar -xzf /tmp/street-legacy-deploy.tar.gz -C current
sudo mv /tmp/street-legacy.env current/.env

cd current

# Build and start containers
sudo docker compose down || true
sudo docker compose build --no-cache
sudo docker compose up -d

# Run database migrations
echo "Waiting for database..."
sleep 10

# Initialize database (create tables)
sudo docker compose exec -T server node server/dist/db/init.js || echo "Tables may already exist"

# Seed database (insert initial data)
sudo docker compose exec -T server node server/dist/db/seed.js || echo "Data may already exist"

# Cleanup
rm -f /tmp/street-legacy-deploy.tar.gz
rm -f /tmp/street-legacy.env

# Show status
sudo docker compose ps

echo ""
echo "Deployment complete!"
ENDSSH

# Cleanup local archive
rm -f deploy.tar.gz

echo ""
echo "=== Deployment finished ==="
