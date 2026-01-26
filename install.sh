#!/bin/bash

# Timer App Installation Script for Debian/Proxmox LXC
# This script automates the installation of the Timer App
# Run this inside your LXC container

set -e  # Exit on error

echo "========================================"
echo "Timer App Installation Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}➜${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo or run in LXC container as root)"
    exit 1
fi

print_info "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

print_info "Installing build dependencies..."
apt install -y build-essential git curl sqlite3
print_success "Build tools installed"

print_info "Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js $(node --version) installed"

print_info "Cloning Timer App repository..."
cd /tmp
rm -rf timer-app
git clone https://github.com/debugthings/timer-app.git
cd timer-app
print_success "Repository cloned"

print_info "Building frontend..."
cd frontend
npm install
npm run build
print_success "Frontend built"

print_info "Building backend..."
cd ../backend
npm install
npm run build
print_success "Backend built"

print_info "Copying built frontend to backend..."
mkdir -p public
cp -r ../frontend/dist/* public/
print_success "Frontend copied to backend"

print_info "Creating system user 'timer-app'..."
if id "timer-app" &>/dev/null; then
    print_info "User 'timer-app' already exists, skipping..."
else
    useradd -r -s /bin/false timer-app
    print_success "User 'timer-app' created"
fi

print_info "Setting up application directory..."
mkdir -p /opt/timer-app
mkdir -p /opt/timer-app/data

# Copy files
cp -r dist /opt/timer-app/
cp -r public /opt/timer-app/
cp -r node_modules /opt/timer-app/
cp -r prisma /opt/timer-app/
cp package*.json /opt/timer-app/

# Create production .env file
cat > /opt/timer-app/.env << 'ENVEOF'
DATABASE_URL="file:/opt/timer-app/data/timer.db"
PORT=3001
NODE_ENV=production
ENVEOF

print_success "Application directory created"

print_info "Setting up database..."
cd /opt/timer-app

# Set DATABASE_URL for Prisma
export DATABASE_URL="file:/opt/timer-app/data/timer.db"

npx prisma generate
npx prisma migrate deploy

# Set permissions AFTER database is created
chown -R timer-app:timer-app /opt/timer-app
print_success "Database configured"

print_info "Creating systemd service..."
cat > /etc/systemd/system/timer-app.service << 'EOF'
[Unit]
Description=Timer App
After=network.target

[Service]
Type=simple
User=timer-app
WorkingDirectory=/opt/timer-app
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATABASE_URL=file:/opt/timer-app/data/timer.db

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
print_success "Systemd service created"

print_info "Starting Timer App service..."
systemctl enable timer-app
systemctl start timer-app
print_success "Service started"

# Wait a moment for service to start
sleep 2

# Check if service is running
if systemctl is-active --quiet timer-app; then
    print_success "Timer App is running!"
else
    print_error "Timer App failed to start. Checking logs..."
    journalctl -u timer-app -n 20 --no-pager
    exit 1
fi

# Get container IP
CONTAINER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "========================================"
print_success "Installation Complete!"
echo "========================================"
echo ""
echo "Timer App is now running at:"
echo "  http://${CONTAINER_IP}:3001"
echo ""
echo "Useful commands:"
echo "  Status:  systemctl status timer-app"
echo "  Logs:    journalctl -u timer-app -f"
echo "  Stop:    systemctl stop timer-app"
echo "  Start:   systemctl start timer-app"
echo "  Restart: systemctl restart timer-app"
echo ""
echo "On first visit, you'll be prompted to set an admin PIN."
echo ""

# Cleanup
print_info "Cleaning up temporary files..."
cd /tmp
rm -rf timer-app
print_success "Cleanup complete"
