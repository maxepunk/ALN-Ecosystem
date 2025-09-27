# Research Document: ALN Video Playback System Integration

**Feature**: ALN Video Playback & State Synchronization System - Integration Phase  
**Date**: 2025-09-24  
**Status**: Complete

## Executive Summary
Research conducted to complete the integration of the ALN orchestrator with existing scanner submodules, implement network flexibility for any venue deployment, and address all remaining work identified in PRD_ADDENDUM_COMPLETE.md while maintaining constitutional compliance.

## Technology Decisions

### 1. Web Framework Selection
**Decision**: Express.js  
**Rationale**: Lightweight, mature, minimal dependencies, runs efficiently on Raspberry Pi 4, extensive middleware ecosystem  
**Alternatives considered**: 
- Fastify: More performant but less ecosystem support
- Koa: Smaller but requires more setup
- Native HTTP: Too low-level for rapid development

### 2. WebSocket Implementation
**Decision**: Socket.io  
**Rationale**: Auto-reconnection, fallback transports, room management for GM stations, battle-tested in production  
**Alternatives considered**:
- ws: Lower level, requires more manual implementation
- WebSocket native: No reconnection handling
- Server-Sent Events: Unidirectional only

### 3. Session Persistence
**Decision**: JSON files with node-persist  
**Rationale**: No database required (constitutional compliance), atomic writes, simple backup/restore, human-readable format  
**Alternatives considered**:
- SQLite: Violates "no database" constitution requirement
- Redis: External dependency, overkill for scale
- Memory-only: No crash recovery

### 4. VLC Control Method
**Decision**: VLC HTTP API via axios  
**Rationale**: Native VLC feature, no additional software, simple HTTP interface, cross-platform compatible  
**Alternatives considered**:
- VLC RC interface: Requires telnet, more complex
- libVLC bindings: Native dependencies, complex setup
- MPV: Would require replacing existing VLC setup

### 5. Process Management
**Decision**: PM2 for production, direct node for development  
**Rationale**: Auto-restart, log management, zero-downtime reload, simple configuration  
**Alternatives considered**:
- SystemD: Platform-specific (Linux only)
- Forever: Less features than PM2
- Docker: Added complexity for field deployment

### 6. Authentication Method
**Decision**: Simple password authentication with bcrypt  
**Rationale**: Single admin user (FR-016), no user management needed, secure hashing  
**Alternatives considered**:
- JWT: Overkill for single user
- OAuth: External dependency, internet required
- No auth: Security risk for admin panel

### 7. API Documentation
**Decision**: OpenAPI 3.0 specification  
**Rationale**: Industry standard, auto-generates documentation, enables contract testing  
**Alternatives considered**:
- Swagger 2.0: Older version
- RAML: Less adoption
- Manual docs: Maintenance burden

### 8. Testing Framework
**Decision**: Jest + Supertest  
**Rationale**: Integrated solution, mocking support, async testing, API testing capabilities  
**Alternatives considered**:
- Mocha + Chai: More setup required
- Tap: Less ecosystem support
- AVA: Smaller community

## Architecture Patterns

### Event-Driven State Management
All state changes flow through central event emitter to ensure consistency and enable real-time updates to connected clients. This supports FR-003 (authoritative state) and FR-011 (real-time communication).

### Graceful Degradation Pattern
Each component assumes others may be unavailable. Player scanners cache state locally, GM stations handle disconnections, orchestrator persists queue on crash (FR-017).

### First-Write-Wins Conflict Resolution
Timestamps attached to all transactions, earliest timestamp accepted for conflicts (FR-018). Simple, deterministic, no complex conflict resolution needed.

## Performance Considerations

### Network Optimization
- HTTP Keep-Alive for player scanners
- WebSocket connection pooling for GM stations
- Compression for large state transfers
- Debounced state broadcasts (max 10/second)

### Resource Management
- Maximum 15 concurrent connections (10 players + 5 GM)
- JSON file writes throttled to prevent I/O saturation
- VLC commands queued to prevent overload
- Memory limit monitoring for Raspberry Pi

### Latency Targets
- Player scan response: <100ms (local network)
- GM state update broadcast: <50ms
- Video playback start: <2 seconds
- Session recovery on reconnect: <500ms

## Security Measures

### Network Security
- CORS configured for known scanner origins only
- Rate limiting on player endpoints (10 req/second)
- WebSocket authentication required for GM stations
- Admin panel password protected

### Data Protection
- No PII collected or stored
- Session data encrypted at rest
- Ephemeral team IDs per session
- Logs sanitized of sensitive data

## Deployment Strategy

### Development Setup
```bash
npm install
npm run dev  # Runs with nodemon for hot reload
```

### Production Deployment
```bash
npm install --production
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enables auto-start on boot
```

### Configuration Management
- Environment variables for configuration
- .env.example provided for setup reference
- Sensible defaults for all settings
- Static IPs configured via environment

## Integration Points

### VLC Media Player
- HTTP interface on port 8080 (configurable)
- Password authentication required
- Playlist management via HTTP API
- Status polling for playback state

### Scanner Communication
- Player scanners: POST to /api/scan
- GM scanners: WebSocket to /ws
- Token data from ALN-TokenData submodule
- Heartbeat mechanism for connection monitoring

### File System
- Sessions stored in ./data/sessions/
- Logs stored in ./logs/
- Video mappings in token data
- Backup snapshots in ./data/backups/

## Risk Mitigation

### Single Points of Failure
- **Risk**: Orchestrator crash loses state
- **Mitigation**: Persist queue and state to disk (FR-017)

### Network Disruptions
- **Risk**: Scanners lose connectivity
- **Mitigation**: Offline mode support, auto-reconnect (FR-007, FR-004)

### Resource Exhaustion
- **Risk**: Raspberry Pi runs out of memory/CPU
- **Mitigation**: Connection limits, throttling, monitoring

### Video File Issues
- **Risk**: Missing or corrupted video files
- **Mitigation**: Graceful handling, GM notification only (FR-019)

## Compliance Verification

All decisions align with ALN Ecosystem Constitution v1.0.1:
- ✅ Component Independence maintained
- ✅ Single Source of Truth preserved  
- ✅ Asymmetric Communication patterns followed
- ✅ Minimal Infrastructure requirements met
- ✅ Progressive Enhancement principles applied

## Integration Requirements from PRD Addendum

### Critical Path Items

#### 1. Git Submodule Configuration (CRITICAL - 4 hours)
**Decision**: Configure nested submodules for scanners with direct ALN-TokenData access  
**Rationale**: Maintains scanner independence while providing orchestrator access to tokens  
**Implementation**: Use --recurse flag for nested submodules, direct folder for orchestrator

#### 2. Backend Token Loading Fix (CRITICAL - 2 hours)
**Decision**: Remove hardcoded tokens, load from ALN-TokenData/tokens.json  
**Rationale**: Constitutional violation - Single Source of Truth must be maintained  
**Implementation**: Dynamic loading with multiple fallback paths

#### 3. Network Flexibility (HIGH - 3 hours)
**Decision**: Add discovery service with mDNS, UDP broadcast, and manual config  
**Rationale**: Must work in any venue without router configuration  
**Implementation**: DiscoveryService class with multiple detection methods

### Scanner Integration Patterns

#### Player Scanner (aln-memory-scanner) - 10 hours
- Add orchestratorIntegration.js module
- Implement offline queue (100 transactions max)  
- Auto-retry every 30 seconds
- Connection status indicator
- Processing screen for video tokens

#### GM Scanner (ALNScanner) - 12 hours
- Add orchestratorWebSocket.js with Socket.io client
- Full state sync on connect/reconnect
- Transaction queuing when offline
- Video playback indicators
- Admin control integration

#### ESP32 Hardware Scanner - 8 hours
- SD card marker files for video tokens
- Power management with deep sleep
- Configurable network settings
- Processing image display

### Admin Interface - 6 hours
- Video control panel
- Session management
- Device monitoring
- Activity logging
- Manual controls for testing

## Network Flexibility Research

### Venue Network Challenges
- Convention centers: Isolated networks, no mDNS
- Hotels: Guest WiFi restrictions
- Corporate: Strict firewalls
- Private homes: Variable router access

### Solution: Multi-Method Discovery
1. **mDNS/Bonjour**: Works on home networks
2. **UDP Broadcast**: Fallback discovery
3. **Manual Config**: Always available
4. **QR Code**: Quick setup option

### Implementation Requirements
- Dynamic IP support (no static required)
- Configuration page for scanners
- Clear IP display on orchestrator startup
- Travel router recommendation for isolation

## Testing Strategy Updates

### Integration Testing Focus
- Submodule token loading
- Cross-component state sync
- Network failure recovery
- Offline queue processing
- Video playback coordination

### Manual Testing Requirements  
- Multiple device connections
- Network disruption scenarios
- VLC integration
- ESP32 hardware validation
- Admin panel functionality

## Deployment Considerations

### Submodule Deployment
```bash
# Scanner deployment remains independent
git submodule update --remote --merge
# Each scanner has own GitHub Pages workflow
```

### Orchestrator Deployment
```bash
# Plain Node.js primary (Docker optional)
npm install --production
npm start
# Or with PM2 for production
pm2 start ecosystem.config.js
```

## Risk Analysis

### Integration Risks
1. **Submodule sync failures**: Mitigated by fallback paths
2. **Network discovery fails**: Manual config always available
3. **Scanner compatibility**: Progressive enhancement approach
4. **Token data divergence**: Single source enforced

### Operational Risks
1. **Venue network blocks**: Travel router solution
2. **VLC not available**: Graceful degradation
3. **Device limits exceeded**: Connection pooling
4. **Session data loss**: Persistence to disk

## Compliance Verification Updates

### Constitution Alignment
- ✅ Scanner independence preserved through progressive enhancement
- ✅ Single Source of Truth maintained via submodules
- ✅ Asymmetric communication (HTTP/WebSocket) implemented
- ✅ Raspberry Pi compatibility confirmed
- ✅ Offline operation supported

### Remaining Violation
- ❌ Backend hardcoded tokens - MUST BE FIXED in implementation

## Implementation Timeline

Total: 48 hours (6 days at 8 hours/day)

### Day 1: Foundation (6 hours)
1. Git submodule configuration (2 hours)
2. Backend token loading fix (2 hours)
3. Token schema updates (2 hours)

### Days 2-3: Scanner Integration (22 hours)
4. Player scanner integration (10 hours)
5. GM scanner WebSocket (12 hours)

### Day 4: Hardware & Admin (14 hours)
6. ESP32 implementation (8 hours)
7. Admin interface (6 hours)

### Day 5: Deployment & Testing (6 hours)
8. Network configuration (3 hours)
9. Integration testing (3 hours)

## 2025 Technology Updates

### Raspberry Pi & Node.js Compatibility (Updated 2025-09-24)
**Critical Finding**: Node.js 18.x reaches end-of-life April 2025
**Decision Update**: Migrate to Node.js 20.x or 22.x for long-term support
**Rationale**:
- Node.js 20.x supported until April 2026
- Node.js 22.x supported until April 2027
- Both versions fully compatible with Raspberry Pi 4 ARM architecture
**Implementation Notes**:
- Raspberry Pi OS Bookworm recommended for 2025
- Use NodeSource repository or NVM for installation
- ARM v7/v8 fully supported (Pi 3, Pi 4, Pi 5)
- Pi Zero/Pi 1 requires unofficial builds for armv6l

### PM2 Process Management on ARM (Updated 2025-09-24)
**Confirmed**: Full ARM support for Raspberry Pi deployments
**Key Features Verified**:
- Systemd integration for auto-start on boot
- Cluster mode supports multi-core Pi 4/5
- Memory monitoring critical for 100MB constraint
- Log rotation built-in for SD card management
**Production Setup**:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u pi --hp /home/pi
```
**Performance Note**: Use cluster mode (`-i max`) for Pi 4 quad-core utilization

### Git Submodule Configuration (Updated 2025-09-24)
**Best Practices for Nested Submodules**:
```bash
# Initial setup with recursion
git clone --recurse-submodules [repo]
git config submodule.recurse true

# Update all nested submodules
git submodule update --init --recursive --jobs 4

# Sync after URL changes
git submodule sync --recursive
git submodule update --init --recursive

# Update to latest remote commits
git submodule update --recursive --remote
```
**Critical for ALN**: Configure `submodule.recurse true` for automatic nested updates

### Node.js ES6 Module Migration (Updated 2025-09-24)
**Migration Strategy from CommonJS**:
1. Add `"type": "module"` to package.json
2. Use `.mjs` extension OR configure package.json type
3. Include file extensions in all relative imports (`.js` required)
4. Replace `__dirname` with `import.meta.url` patterns:
```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```
**Interoperability**:
- ES modules can import CommonJS (default import only)
- CommonJS can use dynamic `import()` for ES modules
- Tool: `cjs-to-es6` CLI for partial automation (~80% success rate)

### Express.js with ES6 Modules (Updated 2025-09-24)
**Setup Requirements**:
```javascript
// With "type": "module" in package.json
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```
**Router Pattern**:
```javascript
// routes/auth.js
import express from 'express';
const router = express.Router();
export default router;

// main app
import authRouter from './routes/auth.js'; // Extension required!
```
**2025 Best Practice**: Use TypeScript with tsx runner for type safety

### Socket.io v4 Implementation (Updated 2025-09-24)
**Current Version**: 4.8.1 (October 2024)
**Key Features**:
- Connection State Recovery (v4.6.0+): Auto-restores rooms on reconnect
- Automatic room cleanup on disconnect
- Adapter pattern for room management
**Implementation Pattern**:
```javascript
import { Server } from 'socket.io';

const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  }
});

io.on('connection', (socket) => {
  socket.join('room1'); // Auto-cleaned on disconnect
  // recovered property indicates state recovery success
  if (socket.recovered) {
    // State was restored
  }
});
```

### Network Discovery Options (Updated 2025-09-24)
**Recommended Libraries**:
1. **bonjour-service** (TypeScript, actively maintained)
2. **bonjour** (Pure JS, no native deps)
3. **node-dns-sd** (Pure JS, IPv4 focused)

**Implementation Example**:
```javascript
import bonjour from 'bonjour';
const bonjourInstance = bonjour();

// Advertise service
const service = bonjourInstance.publish({
  name: 'ALN Orchestrator',
  type: 'http',
  port: 3000
});

// Discover services
bonjourInstance.find({ type: 'http' }, (service) => {
  console.log('Found:', service.name, service.addresses);
});
```
**Fallback**: UDP broadcast on port 5353 for networks blocking mDNS

## Frontend Integration Technologies (Updated 2025-09-24)

### Socket.io v4 Client Configuration
**Reconnection Strategy**:
```javascript
const socket = io("http://localhost:3000", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  transports: ["websocket", "polling"]
});

// Handle reconnection events on io manager, not socket
socket.io.on("reconnect", (attempt) => {
  console.log('Reconnected after', attempt, 'attempts');
});

// Check recovery status (v4.6.0+)
socket.on("connect", () => {
  if (socket.recovered) {
    // State was successfully recovered
  }
});
```
**Key Features**:
- Exponential backoff with randomization
- Automatic packet buffering during disconnect
- Connection state recovery preserves rooms

### Service Worker Offline Strategies
**Cache Strategies**:
1. **Cache First**: Serve from cache, fallback to network
2. **Network First, Cache Second**: Fresh content when online, cached when offline
3. **Stale While Revalidate**: Serve cached immediately, update in background

**Implementation Note**: Service Workers cannot use localStorage (synchronous), must use Cache API or IndexedDB

**Offline Queue Pattern**:
```javascript
// Main app code (not in Service Worker)
function queueOfflineSubmission(data) {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  queue.push({
    timestamp: Date.now(),
    data: data,
    retryCount: 0
  });
  localStorage.setItem('offlineQueue', JSON.stringify(queue));
}
```

### Connection Detection Best Practices
**navigator.onLine Limitations**:
- Only detects network adapter status, not internet connectivity
- Different behavior across browsers (Chrome vs IE)
- Virtual adapters can report false positives

**Reliable Detection Pattern**:
```javascript
const checkOnlineStatus = async () => {
  try {
    const response = await fetch('/ping', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Combined approach
window.addEventListener("online", async () => {
  const truly

Online = await checkOnlineStatus();
  if (trulyOnline) {
    processOfflineQueue();
  }
});
```

### localStorage Queue Libraries (2025)
**Recommended Options**:
1. **@segment/localstorage-retry**
   - Exponential backoff built-in
   - Multi-tab coordination
   - 100 item max recommended
   - Automatic task claiming from dead tabs

2. **storage-based-queue**
   - Promise-based worker pattern
   - Automatic retry with freeze on max attempts
   - Specially designed for offline scenarios

**Implementation Pattern**:
```javascript
import { LocalStorageRetry } from '@segment/localstorage-retry';

const retry = new LocalStorageRetry({
  minRetryDelay: 1000,
  maxRetryDelay: 30000,
  backoffFactor: 2,
  maxAttempts: 3,
  maxItems: 100
});

retry.on('processed', (item) => {
  console.log('Successfully synced:', item);
});
```

**Multi-tab Coordination**: Modern implementations use ack timestamps to prevent multiple tabs from processing same queue

## ES6 Migration Risk Areas (Critical Research - Updated 2025-09-24)

### Risk 1: Circular Dependencies & Import Order
**Problem**: ES6 modules evaluate differently than CommonJS - circular dependencies can cause undefined values
**Impact**: Services/models that reference each other may break
**Solution**:
1. Use "Internal.js Pattern" - single file imports/exports all modules
2. Forward declarations - only call functions after initialization
3. Restructure code to minimize circular dependencies
**Critical Files**: Check services that import each other

### Risk 2: PM2 Configuration with ES6
**Problem**: PM2's ecosystem.config.js uses require() internally, conflicts with ES6 modules
**Impact**: Production deployment fails on Raspberry Pi
**Solutions**:
1. **Rename config**: `ecosystem.config.js` → `ecosystem.config.cjs`
2. **Keep CommonJS syntax** in PM2 config:
```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'aln-orchestrator',
    script: './backend/src/index.js',
    instances: 'max',
    max_memory_restart: '100M'
  }]
}
```

### Risk 3: dotenv Import Order
**Problem**: ES6 imports are hoisted - dotenv.config() runs too late
**Impact**: Environment variables undefined in imported modules
**Solution**: Use side-effect import FIRST in entry file:
```javascript
// ✅ CORRECT - First line in index.js
import 'dotenv/config'
import app from './app.js'
// ❌ WRONG
import dotenv from 'dotenv'
dotenv.config()  // Too late!
```

### Risk 4: __dirname Replacement
**Problem**: __dirname not available in ES6 modules
**Impact**: Express static files, path resolution breaks
**Solutions**:
1. **Node.js 20.11+**: Use `import.meta.dirname` (new feature)
2. **Fallback method**:
```javascript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express static files
app.use(express.static(join(__dirname, 'public')));
```

### Risk 5: Nodemon Configuration
**Problem**: Nodemon may need special flags for ES6 modules
**Impact**: Development server fails to restart
**Solution**: Update package.json:
```json
{
  "nodemonConfig": {
    "watch": ["src"],
    "ext": "js,mjs,json",
    "delay": 1000
  }
}
```
Note: Modern Node.js 20+ doesn't need experimental flags

### Risk 6: Jest Test Migration
**Problem**: Jest needs special configuration for native ES6
**Impact**: All tests fail after migration
**Solution**: Already covered in T005b but critical:
```json
{
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest"
  }
}
```

### Risk 7: Socket.io Initialization
**Problem**: Socket.io server setup may differ with ES6 imports
**Impact**: WebSocket connections fail
**Solution**: Ensure proper import/export:
```javascript
// server.js
import { createServer } from 'http';
import { Server } from 'socket.io';
const httpServer = createServer(app);
const io = new Server(httpServer);
export { io };
```

### Risk 8: Dynamic Imports
**Problem**: require() for conditional loading must be replaced
**Impact**: Optional modules/plugins fail to load
**Solution**: Use dynamic import():
```javascript
// OLD: const plugin = require(pluginPath);
// NEW:
const plugin = await import(pluginPath);
```

## External Services Integration (Updated 2025-09-24)

### VLC HTTP Interface API
**Setup Requirements**:
1. Enable LUA HTTP interface in VLC preferences
2. Set password under Main Interfaces → Lua
3. Default port: 8080 (configurable)
4. Authentication: Basic auth with password only (no username)

**Core API Endpoints**:
```bash
# Status and control
GET http://127.0.0.1:8080/requests/status.xml
GET http://127.0.0.1:8080/requests/status.xml?command=pl_pause
GET http://127.0.0.1:8080/requests/status.xml?command=pl_stop

# Playlist management
GET http://127.0.0.1:8080/requests/playlist.xml
GET http://127.0.0.1:8080/requests/status.xml?command=pl_empty
GET http://127.0.0.1:8080/requests/status.xml?command=in_enqueue&input=<url_encoded_mrl>
GET http://127.0.0.1:8080/requests/status.xml?command=pl_play&id=<item_id>

# Volume control (0-512 = 0-200%)
GET http://127.0.0.1:8080/requests/status.xml?command=volume&val=256

# Seek (seconds)
GET http://127.0.0.1:8080/requests/status.xml?command=seek&val=30
```

**Node.js Integration with axios**:
```javascript
import axios from 'axios';

const vlcApi = axios.create({
  baseURL: 'http://127.0.0.1:8080',
  auth: {
    username: '',  // VLC only uses password
    password: 'your-password'
  }
});

// Play video
async function playVideo(videoPath) {
  const encodedPath = encodeURIComponent(videoPath);
  await vlcApi.get(`/requests/status.xml?command=in_play&input=${encodedPath}`);
}
```

### CORS Configuration for Local Network (2025)
**Key Principles**:
- Origin = protocol + domain + port (all must match)
- `localhost:3000` and `localhost:8080` are different origins
- Avoid wildcards (`*`) for internal networks
- Explicitly list allowed origins for security

**Express.js CORS Setup**:
```javascript
import cors from 'cors';

const corsOptions = {
  origin: [
    'http://localhost:8000',     // Player scanner
    'http://localhost:8001',     // GM scanner
    'http://192.168.1.10:8000',  // Network IP access
    'http://192.168.1.10:8001'
  ],
  credentials: true,  // Allow cookies/auth headers
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

**Security Notes**:
- CORS relaxes security, not enhances it
- Server-side auth still required
- Never use `Access-Control-Allow-Origin: null`
- Wildcards prevent credential sharing (cookies, auth headers)

**Troubleshooting**:
1. Check browser DevTools Network tab for blocked requests
2. Verify origin matches exactly (including port)
3. Ensure methods and headers are allowed
4. Remember CORS only affects browser requests, not server-to-server

## Next Steps

Research complete. Ready for Phase 1: Design & Architecture which will produce:
- Data model specification
- API contracts (OpenAPI)
- Contract test templates
- Quickstart guide
- CLAUDE.md updates

All integration requirements from PRD_ADDENDUM_COMPLETE.md have been researched and incorporated into the implementation plan.