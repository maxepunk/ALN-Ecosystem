# ALN Ecosystem Deployment Guide

## System Overview

The About Last Night (ALN) Ecosystem is a memory token scanning and video playback system designed for tabletop gaming. It runs in two modes:

1. **Orchestrated Mode** - Full integration with local server, video playback, session management
2. **Standalone Mode** - Scanners work independently via GitHub Pages (fallback)

## Prerequisites

### Required Software
- **Node.js 20+** or **22+** (LTS recommended)
- **VLC Media Player** (for video output)
- **PM2** (for production deployment)
- **Git** with submodule support
- **Python 3** (for local scanner testing)

### Hardware Requirements
- **Minimum RAM**: 256MB (Raspberry Pi), 512MB (Desktop)
- **Storage**: 500MB for application + space for videos
- **Display**: HDMI or monitor for video output
- **Network**: WiFi or Ethernet for scanner connectivity

## Installation

### 1. Clone Repository with Submodules

```bash
# Clone with all submodules
git clone --recurse-submodules https://github.com/[user]/ALN-Ecosystem.git
cd ALN-Ecosystem

# If already cloned without submodules
git submodule update --init --recursive
```

### 2. Platform-Specific Setup

#### Ubuntu/Debian (Including Raspberry Pi OS)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install VLC
sudo apt-get update
sudo apt-get install -y vlc

# Install PM2 globally
sudo npm install -g pm2

# Setup backend
cd backend
npm install
```

#### Windows (WSL2)

```bash
# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install VLC (requires X server like VcXsrv)
sudo apt update
sudo apt install -y vlc

# Set DISPLAY for GUI apps
echo 'export DISPLAY=:0' >> ~/.bashrc
source ~/.bashrc

# Install PM2
npm install -g pm2

# Setup backend
cd backend
npm install
```

#### macOS

```bash
# Install Node.js via Homebrew
brew install node@20

# Install VLC
brew install --cask vlc

# Install PM2
npm install -g pm2

# Setup backend
cd backend
npm install
```

### 3. Configure Environment

Create `.env` file in backend directory:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# VLC Configuration
VLC_HOST=localhost
VLC_PORT=8080
VLC_PASSWORD=vlc

# Feature Flags
FEATURE_VIDEO_PLAYBACK=true
FEATURE_OFFLINE_MODE=true

# CORS Origins (optional)
CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Additional Settings (optional)
LOG_LEVEL=info
SESSION_TIMEOUT=3600000
MAX_QUEUE_SIZE=50
VIDEO_TRANSITION_DELAY=1000
```

#### Environment Variables Explained

##### Server Configuration

- **NODE_ENV** (`development` | `test` | `production`)
  - `development`: Enables debug logging, hot reload, detailed error messages
  - `test`: Used for running tests, disables rate limiting
  - `production`: Optimized performance, minimal logging, security features enabled
  - Default: `development`

- **PORT** (number)
  - TCP port for the HTTP/WebSocket server
  - Common values: `3000` (development), `80` (production HTTP), `443` (production HTTPS)
  - Ensure port is not in use: `lsof -i :3000`
  - Default: `3000`

- **HOST** (IP address)
  - Network interface to bind to
  - `0.0.0.0`: Listen on all network interfaces (recommended for network access)
  - `127.0.0.1` or `localhost`: Local access only (more secure but no network access)
  - Default: `0.0.0.0`

##### VLC Configuration

- **VLC_HOST** (hostname/IP)
  - Where VLC HTTP interface is running
  - `localhost` or `127.0.0.1`: VLC on same machine (typical)
  - Remote IP: VLC on different machine (advanced setup)
  - Default: `localhost`

- **VLC_PORT** (number)
  - Port for VLC HTTP interface
  - Must match VLC's `--http-port` setting
  - Standard: `8080` (avoid conflict with other web services)
  - Default: `8080`

- **VLC_PASSWORD** (string)
  - Authentication for VLC HTTP interface
  - **CRITICAL**: Must exactly match VLC's `--http-password` parameter
  - Common issue: Using `vlc-password` instead of `vlc`
  - For security: Change from default in production
  - Default: `vlc`

##### Feature Flags

- **FEATURE_VIDEO_PLAYBACK** (`true` | `false`)
  - `true`: Enable VLC integration and video playback
  - `false`: Disable video features (scanner-only mode)
  - Use `false` if VLC not available or for testing without video
  - Default: `true`

- **FEATURE_OFFLINE_MODE** (`true` | `false`)
  - `true`: Enable offline queue and session persistence
  - `false`: Require constant connection (not recommended)
  - Allows scanners to queue scans when disconnected
  - Default: `true`

##### Network Configuration

- **CORS_ORIGINS** (comma-separated URLs)
  - Allowed origins for cross-origin requests
  - Format: `protocol://host:port,protocol://host2:port2`
  - Example: `http://localhost:3000,http://192.168.1.100:3000,https://example.com`
  - Leave empty to allow configured defaults
  - Add scanner GitHub Pages URLs if using hybrid mode
  - Default: Allows localhost and local network IPs

##### Logging Configuration

- **LOG_LEVEL** (`error` | `warn` | `info` | `debug`)
  - `error`: Only critical errors
  - `warn`: Errors and warnings
  - `info`: Normal operation logs (recommended for production)
  - `debug`: Detailed debugging information
  - Default: `info`

- **LOG_TO_FILE** (`true` | `false`)
  - `true`: Write logs to files in `backend/logs/`
  - `false`: Console output only
  - Default: `true` in production, `false` in development

##### Session Configuration

- **SESSION_TIMEOUT** (milliseconds)
  - How long before an inactive session expires
  - `3600000` = 1 hour
  - `86400000` = 24 hours
  - `0` = Never expire (not recommended)
  - Default: `3600000` (1 hour)

- **PERSISTENCE_DIR** (path)
  - Where to store persistent data (sessions, state)
  - Relative paths are from backend directory
  - Example: `./data` or `/var/lib/aln-orchestrator`
  - Default: `./data`

##### Video Queue Configuration

- **MAX_QUEUE_SIZE** (number)
  - Maximum videos that can be queued
  - Prevents memory exhaustion from spam
  - Recommended: 20-100 depending on memory
  - Default: `50`

- **VIDEO_TRANSITION_DELAY** (milliseconds)
  - Delay between videos in queue
  - `0` = Immediate playback
  - `1000` = 1 second pause
  - Useful for visual separation between memories
  - Default: `1000`

- **DEFAULT_VIDEO_DURATION** (seconds)
  - Fallback duration when VLC can't determine length
  - Used for scheduling next video
  - Should match your typical video length
  - Default: `30`

##### Discovery Service

- **DISCOVERY_ENABLED** (`true` | `false`)
  - Enable UDP broadcast for auto-discovery
  - Scanners can automatically find orchestrator
  - Default: `true`

- **DISCOVERY_PORT** (number)
  - UDP port for discovery broadcasts
  - Must be different from main HTTP port
  - Standard: `8888`
  - Default: `8888`

- **DISCOVERY_INTERVAL** (milliseconds)
  - How often to broadcast presence
  - `5000` = Every 5 seconds
  - Lower = Faster discovery, more network traffic
  - Default: `5000`

##### Security Settings (Production)

- **RATE_LIMIT_WINDOW** (milliseconds)
  - Time window for rate limiting
  - `900000` = 15 minutes
  - Default: `900000`

- **RATE_LIMIT_MAX** (number)
  - Maximum requests per window per IP
  - Prevents API abuse
  - Default: `100`

- **ADMIN_PASSWORD** (string)
  - Password for admin panel access
  - Required for `/admin` routes
  - Generate strong password for production
  - Default: none (admin disabled)

#### Example Configurations

##### Development Setup
```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug
VLC_PASSWORD=vlc
FEATURE_VIDEO_PLAYBACK=true
```

##### Production Raspberry Pi
```env
NODE_ENV=production
PORT=80
HOST=0.0.0.0
LOG_LEVEL=info
VLC_PASSWORD=MySecurePassword123!
FEATURE_VIDEO_PLAYBACK=true
SESSION_TIMEOUT=86400000
PERSISTENCE_DIR=/var/lib/aln-orchestrator
ADMIN_PASSWORD=ChangeMeInProduction!
```

##### Scanner-Only Mode (No Video)
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
FEATURE_VIDEO_PLAYBACK=false
FEATURE_OFFLINE_MODE=true
```

##### High-Security Setup
```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
VLC_PASSWORD=ComplexPassword!@#$
CORS_ORIGINS=https://trusted-domain.com
RATE_LIMIT_MAX=50
ADMIN_PASSWORD=VerySecureAdminPass123!
LOG_LEVEL=warn
```

## Token Configuration

### CRITICAL: Token Media Path Format

The `ALN-TokenData/tokens.json` file is shared between scanners and orchestrator via git submodules. Different components use different media types:

```json
{
  "534e2b03": {
    "video": "test_30sec.mp4",              // Orchestrator: plays from backend/public/videos/
    "audio": "assets/audio/534e2b03.mp3",   // Scanners: play locally from scanner's data/assets/
    "image": "assets/images/534e2b03.jpg",  // Scanners: display locally from scanner's data/assets/
    "processingImage": "assets/images/processing.jpg", // Scanners: local loading image
    "SF_RFID": "534e2b03",
    "SF_ValueRating": 3,
    "SF_MemoryType": "Technical"
  }
}
```

### Path Rules by Media Type

#### Videos (Orchestrator handles these)
- Use **just the filename**: `"video": "memory_video.mp4"`
- Orchestrator looks in: `backend/public/videos/`
- Played on TV/display via VLC when token is scanned

#### Images & Audio (Scanners handle these)
- Use **assets/ paths**: `"image": "assets/images/token123.jpg"`
- Use **assets/ paths**: `"audio": "assets/audio/sound.mp3"`
- Scanners play these locally from their `data/assets/` directory
- Each scanner has the files via ALN-TokenData submodule

#### Important Notes
- **DO NOT** put images/audio in backend - scanners can't access them
- **DO NOT** use assets/video/ paths - videos only exist on orchestrator
- The same tokens.json works for both systems because each ignores irrelevant paths

### File Locations

#### Scanner Repositories (via submodule)
```bash
aln-memory-scanner/
└── data/                    # ALN-TokenData submodule
    ├── tokens.json
    └── assets/
        ├── images/          # Local images displayed on scanner device
        │   ├── token1.jpg
        │   └── token2.png
        └── audio/           # Local audio played on scanner device
            ├── sound1.mp3
            └── sound2.wav
```

#### Orchestrator Backend
```bash
backend/
├── ALN-TokenData/           # Direct submodule for token definitions
│   └── tokens.json          # Read by orchestrator
└── public/
    └── videos/              # Video files for TV playback
        ├── memory1.mp4
        ├── memory2.mp4
        └── test_30sec.mp4
```

### Adding New Media

1. **For Videos** (TV playback):
   - Add .mp4 file to `backend/public/videos/`
   - Update tokens.json: `"video": "filename.mp4"`

2. **For Images/Audio** (scanner feedback):
   - Add files to `ALN-TokenData/assets/images/` or `assets/audio/`
   - Update tokens.json: `"image": "assets/images/filename.jpg"`
   - Commit and push ALN-TokenData submodule
   - Update submodule reference in scanner repos

## Deployment

### Quick Start

```bash
cd backend
npm install         # Install dependencies (if not done)
npm start           # Builds GM Scanner + starts full system with PM2
```

**What happens when you run `npm start`:**
1. **Automatic GM Scanner Build** - Builds ALNScanner/dist/ via prestart hook
2. **Orchestrator Launch** - Starts orchestrator with PM2
3. **VLC Launch** - Starts VLC with video output via PM2

The GM Scanner is automatically served at `https://localhost:3000/gm-scanner/` via symlink.

### Development Workflows

#### Interactive Development Mode (Recommended)
```bash
npm run dev         # Opens interactive menu
```

Choose from:
1. **Full System** - VLC with video + Orchestrator with hot reload
2. **Orchestrator Only** - No video (for API development)
3. **PM2 Managed** - Like production but for development
4. **Headless Mode** - For CI/testing without GUI

#### Direct Commands
```bash
# Full system with hot reload
npm run dev:full

# Just the orchestrator (no video)
npm run dev:no-video

# Headless mode (no GUI)
npm run dev:headless

# Individual components
npm run orchestrator:dev    # Just orchestrator with nodemon
npm run vlc:gui             # Just VLC with video output
```

### Production Deployment

#### Using PM2 (Recommended)
```bash
# Start production system
npm run prod:start          # or just: npm start
# Note: Automatically builds GM Scanner before starting

# Monitor and manage
npm run prod:status         # Check process status
npm run prod:logs           # View logs
npm run prod:monit          # Real-time monitoring

# Control processes
npm run prod:stop           # Stop all
npm run prod:restart        # Restart all
npm run prod:reload         # Zero-downtime reload
```

#### Auto-start on Boot
```bash
# Save current PM2 configuration
npm run prod:save

# Generate startup script
npm run prod:startup
# Follow the command it outputs (usually a systemctl command)

# After reboot, both processes auto-start
```

### System Health Verification

```bash
# Full health check
npm run health

# Quick checks
npm run health:api          # Check orchestrator
npm run health:vlc          # Check VLC
npm run health:quick        # Basic connectivity
```

Expected healthy output:
```
✅ Orchestrator: Running
✅ VLC: Running
✅ VLC Integration: Connected
✅ Video Display: Ready
```

### Understanding the System

The ALN system has TWO components that must run together:

1. **Orchestrator** (Node.js server)
   - Handles scanner connections
   - Manages sessions and state
   - Controls video playback
   - Serves admin interface

2. **VLC Media Player**
   - Displays videos on screen/HDMI
   - Controlled via HTTP interface
   - Must have GUI for video output

### Common Workflows

#### Testing Video Playback
```bash
# 1. Start the system
npm start

# 2. Check health
npm run health

# 3. Trigger test scan
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "534e2b03", "teamId": "TEAM_A", "scannerId": "test"}'
```

#### Switching Configurations
```bash
# Stop everything
npm run stop

# Clean slate
npm run reset               # Clears logs and data

# Start with different mode
npm run dev                 # Interactive chooser
```

#### Troubleshooting Commands
```bash
# Check what's running
npm run prod:status

# View logs
npm run prod:logs

# Stop VLC if stuck
npm run vlc:stop

# Clean restart
npm run stop && npm run clean:all && npm start
```

### Access Points

Once running (any method):
- **Orchestrator API**: `http://localhost:3000`
- **Health Status**: `http://localhost:3000/health`
- **Admin Panel**: `http://localhost:3000/admin/`
- **Player Scanner**: `http://localhost:3000/player-scanner/`
- **GM Scanner**: `http://localhost:3000/gm-scanner/`
- **Scoreboard Display**: `http://localhost:3000/scoreboard`
- **VLC Control**: `http://localhost:8080` (password: vlc)

## Raspberry Pi Deployment

### 1. Prepare Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs vlc git

# Install PM2
sudo npm install -g pm2

# Clone repository
cd ~
git clone --recurse-submodules https://github.com/[user]/ALN-Ecosystem.git
cd ALN-Ecosystem/backend
npm install
```

### 2. Configure for HDMI Output

Edit `/boot/config.txt`:
```ini
# Force HDMI output
hdmi_force_hotplug=1
hdmi_drive=2
hdmi_group=2
hdmi_mode=82  # 1080p 60Hz
```

### 3. Set Static IP (Optional)

Edit `/etc/dhcpcd.conf`:
```bash
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8 8.8.4.4
```

### 4. Enable Auto-start

```bash
cd ~/ALN-Ecosystem/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command it outputs
```

## Network Configuration

### Finding Your IP Address

```bash
# Linux/Mac
hostname -I | cut -d' ' -f1

# Windows (in WSL2)
ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'

# Alternative
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Firewall Configuration

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp  # HTTP/WebSocket
sudo ufw allow 8080/tcp  # VLC HTTP interface
sudo ufw allow 8888/udp  # Discovery broadcast

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8888/udp
sudo firewall-cmd --reload
```

## Scanner Access

### When Orchestrator IS Running

Mobile devices on same network:
1. Connect to same WiFi
2. Open browser to:
   - Player: `http://[SERVER-IP]:3000/player-scanner/`
   - GM: `http://[SERVER-IP]:3000/gm-scanner/`
3. Scanners auto-detect orchestrator via UDP broadcast

### When Orchestrator IS NOT Running (Fallback)

Use GitHub Pages directly:
- Player: `https://[username].github.io/ALNPlayerScan/`
- GM: `https://[username].github.io/ALNScanner/`

Features work in degraded mode (no video playback).

## Scoreboard Display

### Accessing the Scoreboard

The scoreboard is a TV-optimized display showing live Black Market rankings and Detective Log entries:

**URL**: `http://[SERVER-IP]:3000/scoreboard`

- **Purpose**: Large-screen display of team scores, group completions, and detective scans
- **Optimized for**: TV/monitor displays with responsive design
- **Updates**: Real-time via WebSocket connection
- **Network**: Works on any device with browser access to orchestrator

### Features

1. **Team Rankings** - Live scoreboard with medals (🥇🥈🥉) for top 3 teams
   - Shows only teams with activity (teams appear after first token scan)
   - Real-time score updates
   - Token counts and completed group bonuses

2. **Detective Log** - Token IDs scanned in Detective Mode
   - Chronological list of detective scans
   - Shows token ID and scan timestamp
   - Placeholder for future narrative log expansion

3. **Group Completion Notifications** - Animated alerts when teams complete token groups
   - Shows team, group name, and bonus points
   - Auto-dismisses after 8 seconds

4. **Connection Status** - Visual indicator in top-right corner
   - Green: Connected (live updates)
   - Red: Offline (displays last known state, attempting reconnect)
   - Yellow: Connecting

### Setup for Display Devices

#### Option 1: Dedicated Device (Recommended)
Use any spare device with a browser:
- Raspberry Pi Zero W ($15) + monitor
- Old tablet in kiosk mode
- Spare laptop/computer
- Amazon Fire Tablet

Steps:
1. Connect device to same network as orchestrator
2. Open browser to `http://[ORCHESTRATOR-IP]:3000/scoreboard`
3. Press F11 for fullscreen (or use device's kiosk mode)
4. Display auto-updates as teams scan tokens

#### Option 2: Chromium Kiosk Mode (Linux/Raspberry Pi)
```bash
# Install Chromium if needed
sudo apt install chromium-browser

# Create kiosk launcher script
cat > ~/scoreboard.sh << 'EOF'
#!/bin/bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble \
  --app=http://[ORCHESTRATOR-IP]:3000/scoreboard
EOF
chmod +x ~/scoreboard.sh

# Auto-start on boot (add to ~/.config/lxsession/LXDE-pi/autostart)
@/home/pi/scoreboard.sh
```

#### Option 3: Firefox Kiosk Mode
```bash
firefox --kiosk http://[ORCHESTRATOR-IP]:3000/scoreboard
```

### Authentication Details

**IMPORTANT SECURITY NOTE**: The scoreboard uses hardcoded authentication for read-only display access.

- **How it works**: Admin password is embedded in the scoreboard HTML for automatic WebSocket authentication
- **Security tradeoff**: Password visible in HTML source, but scoreboard is read-only (cannot send commands)
- **Configuration**: Update the `adminPassword` in `/backend/public/scoreboard.html` to match your `ADMIN_PASSWORD` in `.env`

```javascript
// In scoreboard.html (line ~440)
const CONFIG = {
    adminPassword: '@LN-c0nn3ct',  // CHANGE THIS to match your .env ADMIN_PASSWORD
    // ...
};
```

**Why this approach?**
1. **No user interaction required** - Perfect for unattended displays
2. **Auto-reconnect** - Works across network interruptions
3. **Simplicity** - No separate authentication flow needed
4. **Read-only access** - Scoreboard can only receive updates, not send commands

**For higher security:**
- Keep scoreboard on local/trusted network only
- Use firewall rules to restrict access to port 3000
- Change `ADMIN_PASSWORD` from default value
- Consider separate VLAN for display devices

### Troubleshooting Scoreboard

#### Blank screen or "Auth Failed"
```bash
# Verify admin password matches between .env and scoreboard.html
grep ADMIN_PASSWORD backend/.env
grep adminPassword backend/public/scoreboard.html

# Check orchestrator is running
curl http://localhost:3000/health

# Check browser console for errors (F12)
```

#### No teams showing
- Teams only appear after scanning at least one token
- Check WebSocket connection status (indicator in top-right)
- Verify session is active and teams exist: `curl http://localhost:3000/api/state`

#### Connection keeps dropping
- Check network stability between display device and orchestrator
- Ensure display device doesn't sleep/hibernate
- Verify firewall allows WebSocket connections (port 3000)

#### Not responsive on TV
- Try different browser (Chromium recommended)
- Check TV resolution settings
- Use `Ctrl + 0` to reset zoom level
- Enable fullscreen mode (F11)

### Display Recommendations

**Optimal Setup:**
- **Resolution**: 1080p or higher
- **Orientation**: Landscape (responsive design supports both)
- **Browser**: Chrome/Chromium 89+ or Firefox 90+
- **Network**: Wired ethernet preferred for reliability
- **Power**: Disable sleep mode on display device

**Layout Adapts:**
- **Desktop/TV**: 2-column layout (scoreboard + detective log side-by-side)
- **Tablet**: Single column, stacked layout
- **Mobile**: Optimized touch targets and font sizes

## Testing

### 1. Test VLC Video Output

```bash
# Manual VLC test
vlc --intf qt --extraintf http --http-password vlc \
    --http-host 0.0.0.0 --http-port 8080 \
    --fullscreen --video-on-top \
    /path/to/test/video.mp4
```

### 2. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/health | jq

# Simulate token scan
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "534e2b03", "teamId": "TEAM_A", "scannerId": "test"}' | jq
```

### 3. Test Scanner Connection

```bash
# Start local scanner for testing
cd aln-memory-scanner
python3 -m http.server 8001

# Access at http://localhost:8001
# Check WebSocket connection in browser console
```

## Troubleshooting

### Common Issues and Solutions

#### npm start not working
```bash
# Check package.json points to correct file
grep '"start"' package.json
# Should show: "start": "node src/server.js"

# Run directly if needed
node src/server.js
```

#### VLC not showing video
```bash
# Check PM2 VLC configuration
grep "args:" ecosystem.config.js
# Must include: --intf qt --extraintf http

# Check DISPLAY variable (Linux)
echo $DISPLAY  # Should be :0 or similar

# Restart PM2 processes
pm2 restart all
```

#### "VLC not connected" error
```bash
# Check VLC password in .env
grep VLC_PASSWORD .env
# Must be: VLC_PASSWORD=vlc (not vlc-password)

# Verify VLC is running
ps aux | grep vlc

# Check VLC HTTP interface
curl -u :vlc http://localhost:8080/requests/status.json
```

#### Token scan plays wrong/no video
```bash
# Check token paths in ALN-TokenData/tokens.json
# Should be just filenames, not assets/video/...

# Verify video file exists
ls backend/public/videos/

# Check logs
pm2 logs aln-orchestrator --lines 50
```

#### Mobile can't connect
1. Verify same network: `ping [server-ip]` from mobile
2. Check firewall: `sudo ufw status`
3. Ensure using IP not localhost in URL
4. Try disabling mobile browser's "HTTPS-only" mode

#### Port already in use
```bash
# Find process using port
sudo lsof -i :3000
sudo lsof -i :8080

# Kill if needed (use PID from above)
kill -9 [PID]
```

## Performance Optimization

### For Raspberry Pi
```bash
# Limit memory usage in ecosystem.config.js
max_memory_restart: '256M'
node_args: '--max-old-space-size=256'

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon
```

### For Production
- Use wired ethernet when possible
- Set static IP to avoid DHCP delays
- Pre-load videos in VLC playlist
- Minimize background processes

## Security Considerations

### Production Deployment
1. Change default VLC password
2. Use firewall to restrict access
3. Enable HTTPS with reverse proxy (nginx/caddy)
4. Limit CORS origins in .env
5. Run as non-root user

### Basic Security Setup
```bash
# Create dedicated user
sudo useradd -m -s /bin/bash alnuser
sudo usermod -aG video,audio alnuser

# Set ownership
sudo chown -R alnuser:alnuser /opt/aln-ecosystem

# Run PM2 as user
sudo -u alnuser pm2 start ecosystem.config.js
```

## Monitoring

### Health Checks
```bash
# Simple health check
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/api/state

# PM2 monitoring
pm2 web  # Opens web dashboard on port 9615
```

### Log Locations
```
backend/logs/
├── combined.log   # All logs
├── error.log      # Errors only
├── out.log        # PM2 stdout
├── vlc-error.log  # VLC errors
└── vlc-out.log    # VLC output
```

## Quick Reference

| Feature | Development | Production (PM2) |
|---------|------------|------------------|
| Start | `npm start` | `pm2 start ecosystem.config.js` |
| Stop | `Ctrl+C` | `pm2 stop all` |
| Logs | Console output | `pm2 logs` |
| Restart | Stop & Start | `pm2 restart all` |
| Auto-start | No | `pm2 startup && pm2 save` |

| URL | Purpose | Mode |
|-----|---------|------|
| http://[ip]:3000 | Main orchestrator | Orchestrated |
| http://[ip]:3000/health | Health check | Orchestrated |
| http://[ip]:3000/admin/ | Admin panel | Orchestrated |
| http://[ip]:3000/player-scanner/ | Player scanner | Orchestrated |
| http://[ip]:3000/gm-scanner/ | GM scanner | Orchestrated |
| http://[ip]:3000/scoreboard | Scoreboard display | Orchestrated |
| https://[user].github.io/ALNPlayerScan/ | Player scanner | Standalone |
| https://[user].github.io/ALNScanner/ | GM scanner | Standalone |

## Support

For issues or questions:
1. Check logs: `pm2 logs --lines 100`
2. Verify configuration: `pm2 show aln-orchestrator`
3. Test health endpoint: `curl http://localhost:3000/health`
4. Review this guide's troubleshooting section

## Summary

This deployment provides:
- **Reliability**: Automatic fallback to standalone mode
- **Simplicity**: Single `pm2 start` command for production
- **Flexibility**: Works on any local network without router config
- **Scalability**: From Raspberry Pi to cloud deployment
- **Progressive Enhancement**: Core features always work, enhanced when orchestrator available