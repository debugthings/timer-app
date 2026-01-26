#!/bin/bash
#
# Timer App Update Script
# Run this script to update to the latest version from GitHub
#

DEPLOY_DIR="/opt/timer-app"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: This script must be run as root"
    echo "Usage: sudo $0"
    exit 1
fi

echo "========================================"
echo "Timer App Update"
echo "========================================"
echo ""

# Stop the service
log "Stopping timer-app service..."
systemctl stop timer-app

# Backup database
log "Backing up database..."
cp "$DEPLOY_DIR/data/timer.db" "$DEPLOY_DIR/data/timer.db.backup.$(date +%Y%m%d_%H%M%S)"

# Run deployment script
log "Running deployment..."
if [ -x "$DEPLOY_DIR/deploy.sh" ]; then
    # Temporarily enable auto-update flag for this run
    touch "$DEPLOY_DIR/.auto-update-enabled"
    
    # Run deploy script
    if "$DEPLOY_DIR/deploy.sh"; then
        log "Deployment successful!"
    else
        log "ERROR: Deployment failed"
        log "Attempting to start service with existing code..."
    fi
    
    # Remove auto-update flag (keep updates manual)
    rm -f "$DEPLOY_DIR/.auto-update-enabled"
else
    log "ERROR: deploy.sh not found at $DEPLOY_DIR/deploy.sh"
    exit 1
fi

# Start the service
log "Starting timer-app service..."
systemctl start timer-app

# Check status
echo ""
log "Update complete! Checking service status..."
sleep 2
systemctl status timer-app --no-pager

echo ""
echo "========================================"
echo "Update Summary"
echo "========================================"
echo "Database backup: $DEPLOY_DIR/data/timer.db.backup.*"
echo "Service status: $(systemctl is-active timer-app)"
echo ""
echo "View logs: sudo journalctl -u timer-app -f"
echo ""
