#!/bin/bash
set -e

# AWS EC2 Deployment Script for Street Legacy
SERVER_IP="98.93.57.54"
SSH_KEY="C:/Users/davem/OneDrive/Desktop/street-legacy-key.pem"
SSH_USER="ubuntu"
DEPLOY_PATH="/home/ubuntu/street-legacy"

# Generated secure credentials
POSTGRES_PASSWORD="rpEcG11mkl8UD557HKvwGdv"
JWT_SECRET="HadzSpS6pY89nQmKafVxAEnlD8UJwiiyHP3xfzLptxNtYXb"

echo "=== Street Legacy AWS Deployment ==="
echo "Server: $SSH_USER@$SERVER_IP"
echo "Path: $DEPLOY_PATH"
echo ""

# Create tarball excluding node_modules and git
echo "Creating deployment archive..."
cd "$(dirname "$0")/.."
tar -czf /tmp/street-legacy-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='deploy.tar.gz' \
    .

# Create .env file locally to upload
echo "Creating .env file..."
cat > /tmp/street-legacy.env << EOF
POSTGRES_USER=streetlegacy
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=streetlegacy
JWT_SECRET=${JWT_SECRET}
PORT=80
EOF

# Upload to server
echo "Uploading to server..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/street-legacy-deploy.tar.gz "$SSH_USER@$SERVER_IP:/tmp/"
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/street-legacy.env "$SSH_USER@$SERVER_IP:/tmp/"

# Deploy on server
echo "Deploying on server..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" << 'ENDSSH'
set -e

DEPLOY_PATH="/home/ubuntu/street-legacy"

echo "Setting up deployment directory..."
sudo mkdir -p $DEPLOY_PATH
sudo chown -R ubuntu:ubuntu $DEPLOY_PATH
cd $DEPLOY_PATH

# Extract deployment
echo "Extracting files..."
tar -xzf /tmp/street-legacy-deploy.tar.gz
mv /tmp/street-legacy.env .env
rm -f /tmp/street-legacy-deploy.tar.gz

echo "Building Docker containers..."
sudo docker compose build

echo "Starting containers..."
sudo docker compose up -d

echo "Waiting for database to be ready..."
sleep 15

echo "Initializing database..."
sudo docker compose exec -T server node server/dist/db/init.js || echo "Init may have already run"

echo "Seeding database..."
sudo docker compose exec -T server node server/dist/db/seed.js || echo "Seed may have already run"

echo ""
echo "=== Container Status ==="
sudo docker compose ps

echo ""
echo "=== Deployment Complete ==="
ENDSSH

# Cleanup local files
rm -f /tmp/street-legacy-deploy.tar.gz
rm -f /tmp/street-legacy.env

echo ""
echo "=== Deployment finished ==="
echo "Game URL: http://$SERVER_IP"
