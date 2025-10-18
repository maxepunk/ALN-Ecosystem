# Scanner Modules - Cursory Investigation Findings

**Date**: 2025-09-29
**Purpose**: Quick structural assessment to inform detailed investigation plan

---

## GM Scanner (ALNScanner) Structure

### Architecture
- **Type**: Single-page application (SPA)
- **Main File**: `index.html` (260KB - all code embedded)
- **Service Worker**: `sw.js` (PWA offline capability)
- **Communication**: WebSocket (Socket.io 4.5.4) + HTTP (fetch)
- **Dual Mode**: ✅ Networked (with orchestrator) OR Standalone (GitHub Pages)

### Backend API Integration

#### WebSocket Events

**Outgoing (Scanner → Backend)**:
- `transaction:submit` - Submit token scan for scoring
- `heartbeat` - Keep-alive ping with stationId
- `state:request` - Request current game state

**Incoming (Backend → Scanner)**:
- `gm:identified` - Authentication confirmation
- `state:sync` - Full state synchronization
- `state:update` - State delta updates
- `transaction:result` - Transaction processing result (for submitted scan)
- `transaction:new` - New transaction from any scanner (broadcast)
- `score:updated` - Score update for a team
- `group:completed` - Group completion bonus notification
- `team:created` - New team created
- `video:status` - Video playback status changes
- `scores:reset` - Admin reset all scores
- `device:connected` / `device:disconnected` - Device status
- `sync:full` - Full system state sync
- `heartbeat:ack` - Heartbeat acknowledgment
- `error` - Server error notifications

**WebSocket Usage Pattern**:
```javascript
// Connection with handshake auth
socket = io(url, {
  auth: {
    token: '<jwt-token>',
    stationId: 'GM-01',
    deviceType: 'gm',
    version: '1.0.0'
  }
});

// Transaction submission
socket.emit('transaction:submit', {
  tokenId: 'abc123',
  teamId: '1',
  scannerId: 'GM-01',
  stationMode: 'blackmarket',
  timestamp: '2025-09-29T...'
});

// Listening for results
socket.once('transaction:result', (result) => {
  // Handle result
  // result has: status, transactionId, points?, etc
});
```

#### HTTP API Calls

**Session Management**:
- `POST /api/session` - Create new session (with Bearer token)
- `PUT /api/session` - Update session status (with Bearer token)

**Video Control**:
- `POST /api/video/control` - Control video playback (with Bearer token)
  - Actions: play, pause, stop, skip

**Authentication Pattern**:
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
}
```

### Key Code Locations

**Authentication Management**: Lines 5661-5700 (handshake auth setup)
**Transaction Submission**: Lines 5467-5493 (emit + queue logic)
**WebSocket Event Handlers**: Lines 5706-5942 (connection, server events)
**Session Management**: Lines 1759-1874 (AdminModule.SessionManager)
**Video Control**: Lines 1877-1950 (AdminModule.VideoController)

### Response Parsing Patterns

**Transaction Result** (line 5470):
```javascript
socket.once('transaction:result', (result) => {
  // Expects: { status, transactionId, points, ... }
});
```

**Score Updates** (lines 5799-5806):
```javascript
socket.on('score:updated', (data) => {
  // Expects: { event: 'score:updated', data: { ... }, timestamp }
  // Uses: data.data to access actual score object
});
```

**State Sync** (lines 5856-5931):
```javascript
socket.on('state:sync', (state) => {
  // Expects full GameState object
  // Updates admin panel displays
});
```

**Session API Responses** (lines 1775-1786):
```javascript
const data = await response.json();
if (data.id) {  // Checks for session.id directly
  this.currentSession = data;
}
```

### Offline/Standalone Capability

**Queue Management**:
- Temporary in-memory queue when disconnected
- Sends queued transactions on reconnection (lines 5490-5498)

**Standalone Mode**:
- Can load tokens from local `data/tokens.json` submodule
- Can perform scoring calculations locally
- NO video playback in standalone mode

---

## Player Scanner (aln-memory-scanner) Structure

### Architecture
- **Type**: Progressive Web App (PWA)
- **Main File**: `index.html`
- **Integration Module**: `js/orchestratorIntegration.js` (separate file)
- **Service Worker**: `sw.js` (PWA offline capability)
- **Communication**: HTTP only (fetch API)
- **Dual Mode**: ✅ Networked (with orchestrator) OR Standalone (GitHub Pages)

### Backend API Integration

#### HTTP Endpoints Used

**Primary Scan Endpoint**:
```javascript
POST /api/scan
{
  tokenId: string,
  teamId: string,
  scannerId: string,
  timestamp: ISO8601
}

// Response expectation:
// { status, message, tokenId, mediaAssets, videoPlaying, waitTime?, queued?, ... }
```

**Batch Processing**:
```javascript
POST /api/scan/batch
{
  transactions: [
    { tokenId, teamId, scannerId, timestamp },
    ...
  ]
}

// Response expectation:
// { results: [{...}, {...}] }
```

**Connection Status Check**:
```javascript
GET /api/state/status

// Used for connection monitoring (every 10 seconds)
```

### Response Parsing Patterns

**Scan Response** (lines 38-58):
```javascript
const response = await fetch(`${baseUrl}/api/scan`, {...});
return await response.json();  // Returns entire response object

// Code checks:
// - response.ok (HTTP status)
// - Then parses JSON blindly (no specific field checks shown)
```

**Status Check** (lines 143-173):
```javascript
const response = await fetch(`${baseUrl}/api/state/status`, {...});
this.connected = response.ok;  // Only checks HTTP status
```

**Offline Queue Format**:
```javascript
{
  tokenId: string,
  teamId: string,
  timestamp: number (Date.now()),
  retryCount: number
}
```

### Offline Capability

**Queue Management**:
- LocalStorage persistence: `offline_queue` key
- Max queue size: 100 transactions
- Automatic batch processing on reconnection
- Processes 10 at a time with 1-second delays

**Connection Monitoring**:
- Checks every 10 seconds via `/api/state/status`
- 5-second timeout on status checks
- Automatic queue processing when connection restored

**Standalone Mode**:
- Can load tokens from local `data/tokens.json` submodule
- Can display images/audio from local assets
- NO video playback in standalone mode
- NO scoring calculations (just logs scans)

---

## Critical Observations

### API Dependencies

**GM Scanner** depends on:
1. **WebSocket Events** (high dependency):
   - `transaction:result` - MUST have `status` field
   - `score:updated` - Expects wrapped format `{event, data, timestamp}`
   - `state:sync` - Expects full GameState object
   - All event structure changes are HIGH RISK

2. **HTTP Endpoints** (medium dependency):
   - `/api/session` responses - Checks for `data.id` field
   - `/api/video/control` - Unknown response parsing (need deeper investigation)

**Player Scanner** depends on:
1. **HTTP Endpoints** (medium dependency):
   - `/api/scan` - Returns entire response, usage unclear without seeing index.html
   - `/api/scan/batch` - Expects `results` array
   - `/api/state/status` - Only checks HTTP status (200 OK)

### Dual-Mode Architecture Implications

**Both scanners can operate standalone**, which means:
- They load tokens from local submodules
- They have their own scoring/display logic
- Orchestrator is **optional enhancement**, not required
- Breaking changes must consider standalone mode fallback

**Networked mode adds**:
- GM Scanner: Real-time state sync, video playback triggers, multi-scanner coordination
- Player Scanner: Video playback triggers, offline queue sync

### Breaking Change Risk Assessment

**HIGH RISK**:
- Changing WebSocket event structure (GM Scanner heavily dependent)
- Removing fields from `transaction:result`
- Changing `score:updated` event format
- Changing `/api/scan` response structure

**MEDIUM RISK**:
- Changing `/api/session` response format
- Adding new required fields
- Changing error response formats

**LOW RISK**:
- Adding optional fields
- Changing `/api/state/status` response (only HTTP status checked)
- Internal orchestrator-only changes

---

## Questions for Detailed Investigation

### GM Scanner

1. **Video Control**: How does it parse `/api/video/control` responses?
2. **Error Handling**: What error fields does it check? (`error`? `status`? Both?)
3. **Session Response**: What fields from session API are actually used?
4. **Transaction Result**: What's the complete structure expected for `transaction:result`?

### Player Scanner

1. **Scan Response Usage**: What fields from `/api/scan` response are actually used in index.html?
2. **Error Display**: How are error responses shown to users?
3. **Video Trigger**: How does `videoPlaying` flag affect UI?
4. **Media Assets**: How is `mediaAssets` object parsed and used?

### Both Scanners

1. **Standalone Fallback**: How do they detect orchestrator unavailability?
2. **Version Compatibility**: Any version checking between scanner and orchestrator?
3. **Feature Detection**: How do they handle missing features (e.g., no VLC)?

---

## Next Steps

1. **Deep Dive Investigation**:
   - Read Player Scanner `index.html` to find actual `/api/scan` response usage
   - Trace all error handling paths in both scanners
   - Document all field accesses on API responses

2. **Breaking Change Matrix**:
   - Map each API change to scanner impact
   - Categorize by risk level
   - Identify migration paths

3. **Standardization Decision Support**:
   - Recommend which format(s) to keep
   - Plan gradual migration if needed
   - Consider v1/v2 API versioning

---

*Investigation Status*: Cursory complete, detailed plan pending
*Date*: 2025-09-29