# Quickstart Guide: ALN Orchestrator System

## Prerequisites

- Node.js 20+ or 22+ and npm installed (Node.js 18 reaches EOL April 2025)
- VLC Media Player installed with HTTP interface enabled
- Network accessible to player scanners and GM stations
- Video files available in a known directory
- Git with submodule support

## Installation

```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/your-org/ALN-Ecosystem.git
cd ALN-Ecosystem

# Configure submodule recursion for nested updates
git config submodule.recurse true
git submodule update --init --recursive --jobs 4

# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Ensure package.json has ES6 modules enabled
# Should contain: "type": "module"

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

### Environment Variables (.env)
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# VLC Configuration
VLC_HOST=localhost
VLC_PORT=8080
VLC_PASSWORD=vlcpassword

# Admin Configuration
ADMIN_PASSWORD=changeme

# Network Configuration (Scanner ports)
CORS_ORIGINS=http://localhost:8000,http://localhost:8001,http://192.168.1.10:8000,http://192.168.1.10:8001

# Session Configuration
MAX_PLAYERS=10
MAX_GM_STATIONS=5
SESSION_TIMEOUT_MINUTES=240
```

### VLC Setup
```bash
# Start VLC with HTTP interface
vlc --intf http --http-host 0.0.0.0 --http-port 8080 --http-password vlcpassword

# Or add to VLC preferences for permanent configuration:
# Tools → Preferences → Show All → Interface → Main interfaces → Lua
# - Enable HTTP interface
# - Set port to 8080
# - Set password (authentication is password-only, no username)
```

### Network Discovery
The orchestrator will display available network IPs on startup:
```
Starting ALN Orchestrator...
Connect scanners to:
  - http://192.168.1.10:3000
  - http://10.0.0.5:3000
  - http://localhost:3000
mDNS advertising as: aln-orchestrator.local
```

Scanners can discover the orchestrator via:
1. mDNS/Bonjour (automatic on supported networks)
2. Manual IP configuration in scanner config pages
3. QR code with orchestrator URL (optional)

## Quick Test Workflow

### 1. Start the Orchestrator
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### 2. Verify System Status
```bash
# Check orchestrator is running
curl http://localhost:3000/api/state

# Expected response:
{
  "sessionId": null,
  "lastUpdate": "2025-09-23T10:00:00Z",
  "scores": [],
  "systemStatus": {
    "orchestratorOnline": true,
    "vlcConnected": true,
    "videoDisplayReady": true
  }
}
```

### 3. Create a Game Session
```bash
# Authenticate as admin
TOKEN=$(curl -X POST http://localhost:3000/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"changeme"}' | jq -r '.token')

# Create new session
curl -X POST http://localhost:3000/api/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Game Session"}'
```

### 4. Simulate Player Scan
```bash
# Simulate scanning a regular memory token
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "MEM_001",
    "teamId": "TEAM_A",
    "scannerId": "SCANNER_01"
  }'

# Simulate scanning a video token
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "MEM_VIDEO_01",
    "teamId": "TEAM_A",
    "scannerId": "SCANNER_01"
  }'
```

### 5. Connect GM Station (WebSocket)
```javascript
// ES6 module syntax for Node.js script (with "type": "module")
import { io } from 'socket.io-client';

// Configure with reconnection options (Socket.io v4)
const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to orchestrator');

  // Check if connection was recovered (v4.6.0+ feature)
  if (socket.recovered) {
    console.log('State recovered from previous session');
  }

  // Identify as GM station
  socket.emit('gm:identify', {
    stationId: 'GM_STATION_01',
    version: '1.0.0'
  });
});

// Handle reconnection events (on io manager, not socket)
socket.io.on('reconnect', (attempt) => {
  console.log(`Reconnected after ${attempt} attempts`);
});

socket.io.on('reconnect_attempt', (attempt) => {
  console.log(`Reconnection attempt ${attempt}`);
});

socket.on('gm:identified', (data) => {
  console.log('Identified successfully:', data);
});

socket.on('state:update', (state) => {
  console.log('Game state updated:', state);
});

socket.on('transaction:new', (transaction) => {
  console.log('New transaction:', transaction);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (socket.active) {
    console.log('Will attempt automatic reconnection');
  }
});
```

### 6. Monitor Real-Time Updates
```bash
# Watch orchestrator logs
tail -f logs/orchestrator.log

# Monitor active connections
curl http://localhost:3000/api/session | jq '.connectedDevices'

# Check current scores
curl http://localhost:3000/api/state | jq '.scores'
```

## Testing Scenarios

### Scenario 1: Video Playback
1. Start orchestrator and VLC
2. Create session
3. Scan token with video asset
4. Verify video plays on VLC
5. Scan another video token while playing
6. Verify rejection with "try again" message

### Scenario 2: Network Recovery
1. Connect GM station via WebSocket
2. Submit several transactions
3. Disconnect network (kill WebSocket)
4. Submit transactions while disconnected
5. Reconnect network
6. Verify state synchronization occurs

### Scenario 3: Duplicate Detection
1. Scan a token from Team A
2. Try scanning same token from Team A again
3. Verify rejection as duplicate
4. Scan same token from Team B
5. Verify rejection (session-wide duplicate)

### Scenario 4: Orchestrator Restart
1. Create session with active game
2. Queue video playback
3. Kill orchestrator (Ctrl+C)
4. Restart orchestrator
5. Verify session restored
6. Verify video queue resumed

### Scenario 5: Player Scanner Offline Queue
1. Configure player scanner with orchestrator URL
2. Disconnect scanner from network (airplane mode)
3. Scan up to 100 tokens while offline
4. Reconnect to network
5. Verify all queued transactions sync automatically
6. Check orchestrator logs for batch processing

### Scenario 6: Connection Detection
1. Test navigator.onLine status in browser console
2. Disconnect network adapter
3. Verify navigator.onLine may still report true (limitation)
4. Test actual connectivity with:
```javascript
fetch('/api/ping', { method: 'HEAD', cache: 'no-cache' })
  .then(() => console.log('Actually online'))
  .catch(() => console.log('Actually offline'));
```

## Troubleshooting

### VLC Connection Issues
```bash
# Test VLC HTTP interface directly (password-only auth)
curl http://localhost:8080/requests/status.xml --user :vlcpassword

# If fails, check:
# - VLC is running with HTTP interface enabled
# - Password set in Tools → Preferences → Interface → Lua
# - Firewall allows port 8080
# - Authentication uses empty username with password
```

### WebSocket Connection Issues
```javascript
// Enable Socket.io v4 debug mode in browser
localStorage.debug = 'socket.io-client:*';

// Test connection with recovery status
socket.on('connect', () => {
  console.log('Connected, recovered:', socket.recovered);
});

// Check for CORS issues in browser console
// Verify CORS_ORIGINS in .env includes all scanner URLs and ports
```

### Session Persistence Issues
```bash
# Check data directory exists and is writable
ls -la data/
# Should show: sessions/ directory with write permissions

# Check for session files
ls -la data/sessions/

# View session data
cat data/sessions/current-session.json | jq
```

### Performance Issues
```bash
# Monitor resource usage
top -p $(pgrep -f "node.*orchestrator")

# Check connection count
netstat -an | grep :3000 | wc -l

# Review logs for errors
grep ERROR logs/orchestrator.log
```

## Production Deployment

### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2 (specify Node.js version)
pm2 start ecosystem.config.js --interpreter node@20

# Monitor
pm2 monit

# View logs
pm2 logs aln-orchestrator

# Setup auto-start on boot (Raspberry Pi specific)
pm2 startup systemd -u pi --hp /home/pi
pm2 save

# For cluster mode on Pi 4 (4 cores)
pm2 start ecosystem.config.js -i max
```

### Using SystemD
```bash
# Create service file
sudo nano /etc/systemd/system/aln-orchestrator.service

# Add configuration (with ES6 module support):
[Unit]
Description=ALN Orchestrator Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ALN-Ecosystem/backend
ExecStart=/usr/bin/node --experimental-modules server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=NODE_OPTIONS="--experimental-modules"

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable aln-orchestrator
sudo systemctl start aln-orchestrator
```

## Validation Checklist

- [ ] Orchestrator starts without errors
- [ ] VLC connection established
- [ ] Admin authentication works
- [ ] Session creation successful
- [ ] Player scan endpoint responds
- [ ] GM WebSocket connects
- [ ] State synchronization occurs
- [ ] Video playback triggers
- [ ] Duplicate detection works
- [ ] Session persists across restart
- [ ] Network recovery functions
- [ ] Logs are being written

## Next Steps

1. Configure player scanners to point to orchestrator URL
2. Configure GM stations for WebSocket connection
3. Place video files in configured directory
4. Update token data with video paths
5. Run full end-to-end test with all components