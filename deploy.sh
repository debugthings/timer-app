#!/bin/bash
#
# Timer App Deployment Script
# This script pulls the latest code, builds, and deploys to /opt/timer-app
#

set -e  # Exit on error

REPO_URL="https://github.com/debugthings/timer-app.git"
BUILD_DIR="/tmp/timer-app-build"
DEPLOY_DIR="/opt/timer-app"
BRANCH="master"

echo "========================================"
echo "Timer App Deployment"
echo "========================================"
echo ""

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting deployment process..."

# Clean up old build directory if it exists
if [ -d "$BUILD_DIR" ]; then
    log "Removing old build directory..."
    rm -rf "$BUILD_DIR"
fi

# Clone the repository
log "Cloning repository from $REPO_URL..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$BUILD_DIR"
cd "$BUILD_DIR"

log "Repository cloned successfully"

# Build Frontend
log "Building frontend..."
cd frontend
npm install --production=false
npm run build
log "Frontend built successfully"

# Build Backend
log "Building backend..."
cd ../backend
npm install --production=false
npm run build
log "Backend built successfully"

# Copy built frontend to backend public folder
log "Copying frontend to backend public folder..."
mkdir -p public
cp -r ../frontend/dist/* public/

# Deploy to production directory
log "Deploying to $DEPLOY_DIR..."

# Backup current deployment (if exists)
if [ -d "$DEPLOY_DIR/dist" ]; then
    log "Backing up current deployment..."
    mkdir -p "$DEPLOY_DIR/backup"
    cp -r "$DEPLOY_DIR/dist" "$DEPLOY_DIR/backup/dist.$(date +%Y%m%d_%H%M%S)"
    cp -r "$DEPLOY_DIR/public" "$DEPLOY_DIR/backup/public.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
fi

# Copy new files
log "Copying built files to $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR/dist"
rm -rf "$DEPLOY_DIR/public"
cp -r dist "$DEPLOY_DIR/"
cp -r public "$DEPLOY_DIR/"
cp -r node_modules "$DEPLOY_DIR/"
cp -r prisma "$DEPLOY_DIR/"
cp package*.json "$DEPLOY_DIR/"

# Ensure .env exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    log "Creating .env file..."
    cat > "$DEPLOY_DIR/.env" << 'EOF'
DATABASE_URL="file:/opt/timer-app/data/timer.db"
PORT=3001
NODE_ENV=production
EOF
fi

# Run database migrations
log "Running database migrations..."
cd "$DEPLOY_DIR"
export DATABASE_URL="file:/opt/timer-app/data/timer.db"
npx prisma generate
npx prisma migrate deploy

# Set permissions
log "Setting permissions..."
chown -R timer-app:timer-app "$DEPLOY_DIR"

# Clean up build directory
log "Cleaning up build directory..."
cd /
rm -rf "$BUILD_DIR"

log "Deployment completed successfully!"
echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo "Deployed to: $DEPLOY_DIR"
echo "Service will start with latest code"
echo ""
