# Daily Timer App

A self-hosted PWA for managing daily time allocations with checkout functionality. Perfect for managing screen time, homework time, or any time-based activities.

## Features

- **Multiple Timers**: Create timers for different people and activities
- **Daily Allocations**: Set daily time limits that reset at midnight
- **Weekly Schedules**: Configure different time allocations for each day of the week
- **Expiration Times**: Set daily expiration times after which timers become unavailable
- **Checkout System**: Check out a portion of time to use, returns unused time to the pool
- **Admin PIN Protection**: Simple PIN-based access control for management functions
- **PWA Support**: Install on iOS/Android home screens
- **Offline Capable**: Works offline with service worker caching
- **Self-Hosted**: Run on your own Debian/Proxmox LXC container

## Quick Start (Proxmox Deployment)

Deploy to a Proxmox LXC container in 2 steps:

```bash
# 1. Create Debian LXC container (on Proxmox host)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/debian.sh)"

# 2. Install Timer App (inside container - use 'pct enter CONTAINER_ID')
bash -c "$(curl -fsSL https://raw.githubusercontent.com/debugthings/timer-app/master/install.sh)"
```

Access at `http://YOUR_CONTAINER_IP:3001`

[Full deployment instructions →](#deployment-to-proxmox-lxc-container)

## Architecture

- **Frontend**: React 18, TypeScript, TailwindCSS, Vite, React Query
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: SQLite (file-based, no setup required)
- **Testing**: Vitest (backend API tests), Playwright (E2E tests)
- **Deployment**: Single Node.js service serves both API and frontend

## Prerequisites

- Node.js 20 LTS or higher
- npm or yarn

## Development Setup

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Or manually:
cd backend && npm install
cd ../frontend && npm install
```

### 2. Setup Database

```bash
cd backend
cp .env.example .env
# Edit .env if needed
npx prisma generate
npx prisma migrate dev
```

### 3. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the backend at `http://localhost:3001`.

## Testing

### Backend API Tests (Vitest)

```bash
# Run all backend tests
npm run test:backend

# Or from backend directory
cd backend
npm test

# Watch mode
cd backend
npm run test:watch
```

The backend tests cover:
- Admin API (settings, PIN management)
- People CRUD operations
- Timer CRUD operations and expiration
- Checkout lifecycle (create, start, pause, stop, cancel)
- Transactional integrity and concurrent operation handling

### E2E Tests (Playwright)

```bash
# Run E2E tests (requires both servers running)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with Playwright UI
npm run test:e2e:ui
```

The E2E tests cover:
- First-time setup flow
- Admin panel authentication
- Timer management
- Checkout flow (start, pause, resume, stop)
- Timer expiration behavior

### Run All Tests

```bash
npm run test:all
```

## Production Build

### 1. Build Frontend

```bash
cd frontend
npm run build
```

### 2. Copy Frontend to Backend

```bash
# Windows (PowerShell)
Copy-Item -Path frontend/dist/* -Destination backend/public -Recurse -Force

# Linux/Mac
cp -r frontend/dist/* backend/public/
```

### 3. Build Backend

```bash
cd backend
npm run build
```

### 4. Setup Database

```bash
cd backend
npx prisma migrate deploy
```

### 5. Run Production Server

```bash
cd backend
npm start
```

The app will be available at `http://localhost:3001`.

## Deployment to Proxmox LXC Container

### Quick Deploy (Automated)

#### Step 1: Create Debian LXC Container

From your Proxmox host:

```bash
# Create a Debian 12 LXC container using community scripts
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/debian.sh)"

# Note the container ID (e.g., 100)
```

#### Step 2: Run Installation Script

Enter the container and run the automated installation:

```bash
# Enter the container (replace 100 with your container ID)
pct enter 100

# Download and run the installation script
bash -c "$(curl -fsSL https://raw.githubusercontent.com/debugthings/timer-app/master/install.sh)"
```

The script will:
- Install Node.js 20 LTS and build tools
- Clone the repository from GitHub
- Build the frontend and backend
- Set up the database
- Create a system user and directories
- Install update scripts (`deploy.sh` and `update.sh`)
- Install and start the systemd service

#### Step 3: Access the Application

The app will be available at `http://YOUR_CONTAINER_IP:3001`

### Manual Installation (Step-by-Step)

If you prefer manual installation or need to customize the setup:

#### 1. Create and Enter Container

```bash
# On Proxmox host
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/debian.sh)"

# Enter the container (replace 100 with your container ID)
pct enter 100
```

#### 2. Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install build tools and git
apt install -y build-essential git curl sqlite3

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

#### 3. Clone and Build Application

```bash
# Clone repository
git clone https://github.com/debugthings/timer-app.git /tmp/timer-app
cd /tmp/timer-app

# Install and build frontend
cd frontend
npm install
npm run build

# Install and build backend
cd ../backend
npm install
npm run build

# Copy built frontend to backend public folder
mkdir -p public
cp -r ../frontend/dist/* public/
```

#### 4. Setup Application Directory

```bash
# Create system user
useradd -r -s /bin/false timer-app

# Create application directory
mkdir -p /opt/timer-app
mkdir -p /opt/timer-app/data

# Copy built backend
cp -r /tmp/timer-app-build/backend/dist /opt/timer-app/
cp -r /tmp/timer-app-build/backend/public /opt/timer-app/
cp -r /tmp/timer-app-build/backend/node_modules /opt/timer-app/
cp -r /tmp/timer-app-build/backend/prisma /opt/timer-app/
cp /tmp/timer-app-build/backend/package*.json /opt/timer-app/

# Create production .env file
cat > /opt/timer-app/.env << 'ENVEOF'
DATABASE_URL="file:/opt/timer-app/data/timer.db"
PORT=3001
NODE_ENV=production
ENVEOF

# Setup database (before setting permissions)
cd /opt/timer-app
export DATABASE_URL="file:/opt/timer-app/data/timer.db"
npx prisma generate
npx prisma migrate deploy

# Set permissions AFTER database is created
chown -R timer-app:timer-app /opt/timer-app
```

#### 5. Copy Update Scripts

```bash
# Copy the deployment and update scripts
cp /tmp/timer-app/deploy.sh /opt/timer-app/
cp /tmp/timer-app/update.sh /opt/timer-app/
chmod +x /opt/timer-app/deploy.sh
chmod +x /opt/timer-app/update.sh
chown root:root /opt/timer-app/deploy.sh
chown root:root /opt/timer-app/update.sh
```

#### 6. Create Systemd Service

```bash
# Create service file
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
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATABASE_URL=file:/opt/timer-app/data/timer.db

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable timer-app
systemctl start timer-app

# Check status
systemctl status timer-app
```

#### 7. Verify Installation

```bash
# Check if service is running
systemctl status timer-app

# Check logs
journalctl -u timer-app -f

# Test API
curl http://localhost:3001/api/admin/settings
```

### Configure NGINX Reverse Proxy (Optional)

If you want to access the app through a domain name or NGINX proxy:

Add this location block to your NGINX configuration:

```nginx
location / {
    proxy_pass http://10.x.x.x:3001;  # Your LXC IP
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

Reload NGINX:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Update to Latest Version

**Simple update command:**

```bash
# Run the update script
sudo /opt/timer-app/update.sh
```

The update script will:
1. ✅ Stop the service
2. ✅ Backup the database (timestamped)
3. ✅ Clone latest code from GitHub
4. ✅ Build frontend and backend
5. ✅ Deploy new files
6. ✅ Run database migrations
7. ✅ Restart the service

**Manual update** (alternative method):

```bash
# Stop service and backup
sudo systemctl stop timer-app
sudo cp /opt/timer-app/data/timer.db /opt/timer-app/data/timer.db.backup.$(date +%Y%m%d)

# Run deployment
sudo touch /opt/timer-app/.auto-update-enabled  # Enable deployment
sudo /opt/timer-app/deploy.sh
sudo rm /opt/timer-app/.auto-update-enabled     # Disable again

# Restart service
sudo systemctl start timer-app
```

**View update logs:**

```bash
# Watch service logs during/after update
sudo journalctl -u timer-app -f
```

### Database Backups

The update script automatically backs up your database. For manual backups:

```bash
# Manual backup
sudo cp /opt/timer-app/data/timer.db /opt/timer-app/data/timer.db.backup.$(date +%Y%m%d)

# Restore from backup
sudo systemctl stop timer-app
sudo cp /opt/timer-app/data/timer.db.backup.YYYYMMDD /opt/timer-app/data/timer.db
sudo systemctl start timer-app
```

## Usage

### First-Time Setup

1. Visit the app URL
2. You'll be prompted to set an admin PIN
3. Enter a PIN (minimum 4 characters)

### Creating People and Timers (Admin)

1. Click "Admin Panel" on the dashboard
2. Add people (e.g., "John", "Sarah")
3. Add timers for each person (e.g., "Screen Time", "Homework")
4. Set default daily time allocations (e.g., 2 hours)
5. Optionally configure weekly schedules with different times per day
6. Optionally set expiration times for each day

### Weekly Schedules

Timers can have custom schedules for each day of the week:
- Set different time allocations per day (e.g., 2 hours on weekdays, 4 hours on weekends)
- Set expiration times per day (e.g., timer expires at 8:00 PM)
- Days without custom schedules use the default daily allocation

### Timer Expiration

When a timer has an expiration time set:
- The timer becomes unavailable after the expiration time
- Active checkouts are automatically force-stopped and cancelled
- The timer becomes available again the next day
- Users see a clear "Expired" indicator

### Using Timers

1. View all timers on the dashboard
2. Click a timer to see details
3. Click "Checkout Time" to reserve a portion of time
4. Start the timer to begin counting down
5. Pause/Stop as needed
6. Unused time is returned to the daily pool

## API Endpoints

### Admin
- `GET /api/admin/settings` - Get settings (timezone, PIN status)
- `POST /api/admin/verify-pin` - Verify PIN
- `POST /api/admin/set-pin` - Set/change PIN
- `PUT /api/admin/settings` - Update settings (admin)

### People
- `GET /api/people` - List all people with their timers
- `GET /api/people/:id` - Get person by ID
- `POST /api/people` - Create person (admin)
- `PUT /api/people/:id` - Update person (admin)
- `DELETE /api/people/:id` - Delete person (admin)

### Timers
- `GET /api/timers` - List all timers with today's allocations
- `GET /api/timers/:id` - Get timer with today's allocation
- `GET /api/timers/:id/current` - Get timer with today's allocation and active status
- `GET /api/timers/:id/allocation` - Get allocation for specific date
- `POST /api/timers` - Create timer (admin)
- `PUT /api/timers/:id` - Update timer (admin)
- `DELETE /api/timers/:id` - Delete timer (admin)

### Checkouts
- `POST /api/checkouts` - Create checkout
- `GET /api/checkouts/:id` - Get checkout status
- `POST /api/checkouts/:id/start` - Start timer
- `POST /api/checkouts/:id/pause` - Pause timer
- `POST /api/checkouts/:id/stop` - Stop and return unused time
- `POST /api/checkouts/:id/cancel` - Cancel checkout

## Data Integrity

The application uses several techniques to ensure data integrity:

- **Prisma Transactions**: All multi-step database operations are wrapped in transactions to ensure atomicity
- **Race Condition Prevention**: Frontend uses `useRef` flags to prevent double-clicks and concurrent API calls
- **Auto-pause Protection**: Active timers that complete automatically are protected against multiple pause attempts

## Troubleshooting

### Check Logs

```bash
# Systemd logs
sudo journalctl -u timer-app -f

# Application logs
cd /opt/timer-app
# Logs are output to stdout/stderr
```

### Reset Admin PIN

**Option 1: Reset PIN via SQLite (Preserves Data)**

```bash
# Open the database with SQLite
sudo sqlite3 /opt/timer-app/data/timer.db

# Reset the PIN (sets it to NULL, triggering first-time setup)
UPDATE Settings SET adminPinHash = NULL WHERE id = 1;

# Verify the change
SELECT id, adminPinHash, timezone FROM Settings;

# Exit SQLite
.quit

# Restart the service
sudo systemctl restart timer-app

# You'll be prompted to set a new PIN on first visit
```

**Option 2: Delete Database (WARNING: Deletes All Data)**

```bash
# Stop the service
sudo systemctl stop timer-app

# Delete the database (WARNING: This deletes all data)
sudo rm /opt/timer-app/data/timer.db

# Restart the service
sudo systemctl start timer-app

# You'll be prompted to set a new PIN on first visit
```

### Database Backup

```bash
# Backup
sudo cp /opt/timer-app/data/timer.db /opt/timer-app/data/timer.db.backup

# Restore
sudo cp /opt/timer-app/data/timer.db.backup /opt/timer-app/data/timer.db
sudo systemctl restart timer-app
```

## Project Structure

```
timer-app/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── migrations/        # Database migrations
│   ├── src/
│   │   ├── index.ts           # Express app entry point
│   │   ├── routes/            # API route handlers
│   │   │   ├── admin.ts
│   │   │   ├── checkouts.ts
│   │   │   ├── people.ts
│   │   │   └── timers.ts
│   │   ├── middleware/        # Express middleware
│   │   │   └── adminAuth.ts
│   │   ├── utils/             # Utility functions
│   │   │   ├── dateTime.ts    # Date/time helpers
│   │   │   └── timerExpiration.ts
│   │   └── tests/             # Backend tests
│   └── public/                # Built frontend (production)
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── pages/             # Page components
│   │   ├── services/          # API client
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utility functions
│   └── public/                # Static assets
├── e2e/                       # Playwright E2E tests
├── playwright.config.ts       # Playwright configuration
└── package.json               # Root package.json with scripts
```

## License

MIT
