# Test-Mode Elimination Implementation Plan

**Created**: 2025-10-05
**Updated**: 2025-10-05 (Corrected with 7 critical fixes)
**Status**: Implementation Ready - CORRECTED VERSION
**Purpose**: Remove test-mode code divergence and integrate real scanner modules into tests

---

## Problem Statement

Production code contains conditional branches that execute different logic when `process.env.NODE_ENV === 'test'`. This creates two separate code paths:
- **Test path**: Auto-initializes services, creates mock tokens, bypasses auth
- **Production path**: Untested, may be broken

Integration tests use simulated WebSocket clients (`socket.io-client`) instead of actual scanner code from the `ALNScanner` and `aln-memory-scanner` submodules.

**Result**: Tests pass while testing different code than production runs.

---

## Part 1: Test-Mode Conditionals to Remove

### File: `backend/src/routes/scanRoutes.js` (236 lines total)

**Line 50-53: Auto-initialize services**
```javascript
// CURRENT CODE (DELETE)
if (process.env.NODE_ENV === 'test' && transactionService.tokens.size === 0) {
  const { initializeServices } = require('../app');
  await initializeServices();
}
```

**Replacement**:
```javascript
// NEW CODE
if (transactionService.tokens.size === 0) {
  logger.error('Services not initialized - tokens not loaded');
  return res.status(503).json({
    error: 'SERVICE_UNAVAILABLE',
    message: 'Server is still initializing, please retry'
  });
}
```

**Rationale**: If services aren't initialized, return error. Tests must call production startup.

---

**Line 57-63: Auto-create session**
```javascript
// CURRENT CODE (DELETE)
let session = sessionService.getCurrentSession();
if (!session && process.env.NODE_ENV === 'test') {
  session = await sessionService.createSession({
    name: 'Test Session',
    teams: ['001', '002'],
  });
}
```

**Replacement**:
```javascript
// NEW CODE
const session = sessionService.getCurrentSession();
if (!session) {
  logger.warn('Scan rejected: no active session');
  return res.status(409).json({
    error: 'SESSION_NOT_FOUND',
    message: 'No active session - admin must create session first'
  });
}
```

**Rationale**: Per functional requirements (docs/api-alignment/08-functional-requirements.md Section 1.2), sessions are created by admin commands, not automatically.

---

**Line 77-89: Create mock tokens**
```javascript
// CURRENT CODE (DELETE)
if (!token && process.env.NODE_ENV === 'test' && (scanRequest.tokenId.startsWith('TEST_') || scanRequest.tokenId.startsWith('MEM_'))) {
  const tokenId = scanRequest.tokenId;
  const isVideoToken = tokenId.startsWith('TEST_VIDEO_') || tokenId.startsWith('MEM_VIDEO_');

  token = new Token({
    id: tokenId,
    name: `Test Token ${tokenId}`,
    value: 10,
    memoryType: 'Technical',
    mediaAssets: isVideoToken ? { video: `/test/videos/${tokenId}.mp4` } : {},
    metadata: isVideoToken ? { duration: 30 } : {},
  });
}
```

**Replacement**:
```javascript
// NEW CODE (after line 74 where token lookup happens)
if (!token) {
  logger.warn('Scan rejected: token not found', { tokenId: scanRequest.tokenId });
  return res.status(404).json({
    error: 'TOKEN_NOT_FOUND',
    message: `Token ${scanRequest.tokenId} not recognized`
  });
}
```

**Rationale**: Tests should use real tokens from ALN-TokenData submodule, not fabricated TEST_* tokens.

---

**Line 166-169: Duplicate auto-initialize in batch endpoint**
```javascript
// CURRENT CODE (DELETE) - Same pattern as line 50
if (process.env.NODE_ENV === 'test' && transactionService.tokens.size === 0) {
  const { initializeServices } = require('../app');
  await initializeServices();
}
```

**Replacement**: Same as line 50 replacement (return 503 error)

---

**Line 187-199: Duplicate mock token creation in batch endpoint**
```javascript
// CURRENT CODE (DELETE) - Same pattern as line 77
if (!token && process.env.NODE_ENV === 'test' && scanRequest.tokenId && (scanRequest.tokenId.startsWith('TEST_') || scanRequest.tokenId.startsWith('MEM_'))) {
  // ... same mock token creation
}
```

**Replacement**: Same as line 77 replacement (return 404 error)

---

### File: `backend/src/services/transactionService.js` (660 lines total)

**Line 96-122: Create mock tokens for GM transactions**
```javascript
// CURRENT CODE (DELETE)
if (!token && process.env.NODE_ENV === 'test') {
  const tokenId = transaction.tokenId;
  if (tokenId.startsWith('TEST_') ||
      tokenId.startsWith('ORDER_') ||
      tokenId.startsWith('TIME_') ||
      tokenId.startsWith('RATE_') ||
      tokenId.startsWith('MEM_') ||
      tokenId === 'AFTER_LIMIT') {
    // Create a mock token for testing
    const Token = require('../models/token');
    const isVideoToken = tokenId.startsWith('TEST_VIDEO_') || tokenId === 'TEST_VIDEO_TX' || tokenId.startsWith('MEM_VIDEO_');

    token = new Token({
      id: tokenId,
      name: `Test Token ${tokenId}`,
      value: 10,
      memoryType: 'visual',
      mediaAssets: isVideoToken ? { video: `/test/videos/${tokenId}.mp4` } : {},
      metadata: isVideoToken ? { duration: 30 } : {},
    });
  } else if (tokenId === 'invalid_token') {
    token = null;
  }
}
```

**Replacement**:
```javascript
// DELETE ENTIRE BLOCK - let natural validation handle missing tokens
// Code at line 124 already handles this:
if (!token) {
  transaction.reject('Invalid token ID');
  logger.warn('Scan rejected: invalid token', { tokenId: transaction.tokenId });
  return transaction;
}
```

**Rationale**: Remove test bypass. If token doesn't exist, validation fails naturally.

---

### File: `backend/src/websocket/gmAuth.js` (200 lines total)

**Line 24-34: Skip authentication in test mode**
```javascript
// CURRENT CODE (DELETE)
const isTestMode = process.env.NODE_ENV === 'test';

if (!isTestMode && (!socket.isAuthenticated || !socket.deviceId)) {
  emitWrapped(socket, 'error', {
    code: 'AUTH_REQUIRED',
    message: 'Authentication required - connection not pre-authenticated',
  });
  socket.disconnect(true);
  return;
}
```

**Replacement**:
```javascript
// NEW CODE
if (!socket.isAuthenticated || !socket.deviceId) {
  emitWrapped(socket, 'error', {
    code: 'AUTH_REQUIRED',
    message: 'Authentication required - connection not pre-authenticated',
  });
  socket.disconnect(true);
  return;
}
```

**Rationale**: Always require authentication. Tests must authenticate via HTTP endpoint before WebSocket connection.

---

### File: `backend/src/services/videoQueueService.js` (693 lines total)

**Line 45-54: Immediate vs delayed queue processing**
```javascript
// CURRENT CODE (DELETE)
if (process.env.NODE_ENV === 'test') {
  logger.debug('Processing queue immediately (test mode)', { tokenId: token.id });
  this.processQueue();
} else {
  logger.debug('Scheduling queue processing for', { tokenId: token.id });
  setImmediate(() => {
    logger.debug('Processing queue for', { tokenId: token.id });
    this.processQueue();
  });
}
```

**Replacement**:
```javascript
// NEW CODE
setImmediate(() => {
  logger.debug('Processing queue for', { tokenId: token.id });
  this.processQueue();
});
```

**Rationale**: Always use production timing. Tests already handle async with `waitForEvent()`.

---

**Line 114: Similar pattern (exact same fix)**

---

### File: `backend/src/services/sessionService.js` (444 lines total)

**Line 431-434: Clear persistence only in test mode**
```javascript
// CURRENT CODE (DELETE)
if (process.env.NODE_ENV === 'test') {
  await persistenceService.delete('session:current');
  await persistenceService.delete('gameState:current');
}
```

**Replacement**:
```javascript
// NEW CODE
await persistenceService.delete('session:current');
await persistenceService.delete('gameState:current');
```

**Rationale**: Reset should always clear persistence. This actually fixes a production bug.

---

### File: `backend/src/services/offlineQueueService.js` (391 lines total)

**Line 379: Early return in test mode**
```javascript
// CURRENT CODE (DELETE)
if (process.env.NODE_ENV === 'test') {
  return;
}
```

**Replacement**: Delete the entire conditional. Let the code after it execute normally.

---

## Part 2: Scanner Module Integration

**Critical Understanding**: We have TWO completely different scanner architectures with different APIs, initialization requirements, and test patterns.

---

### Player Scanner (aln-memory-scanner)

**Module**: `aln-memory-scanner/js/orchestratorIntegration.js`
**Architecture**: Simple HTTP client class
**Purpose**: Fire-and-forget token scans from player devices (ESP32 compatible per FR 2.1)

**Key Characteristics**:
- HTTP-only (no WebSocket complexity)
- Client-side media display (images/audio from local assets)
- Offline queue with automatic batch sync
- Connection monitoring with auto-retry
- Works standalone when orchestrator unavailable

**Public API**:
```javascript
scanToken(tokenId, teamId)           // Submit scan via HTTP POST /api/scan
checkConnection()                     // Test orchestrator availability
processOfflineQueue()                 // Sync queued scans when reconnected
getQueueStatus()                      // Get queue info
clearQueue()                          // Clear offline queue
```

**Initialization**: SIMPLE - No complex setup required
```javascript
const client = new OrchestratorIntegration();
client.baseUrl = 'http://localhost:3000';
client.deviceId = 'PLAYER_TEST_01'; // Optional
// Ready to use - call client.scanToken()
```

**Browser Dependencies** (all handled by browser-mocks.js):
- `localStorage` - Offline queue persistence
- `fetch` - HTTP requests
- `window.location` - URL detection for auto-config

**Export**: Already Node.js compatible (line 234)

**Testing Scope**: HTTP endpoints, offline queue behavior, fire-and-forget pattern

---

### GM Scanner (ALNScanner)

**Module**: `ALNScanner/js/app/app.js` (main entry point + multiple dependencies)
**Architecture**: Complex multi-module browser application
**Purpose**: Real-time game transaction processing with admin panel (FR 3.1-3.4, 4.1-4.2)

**Key Characteristics**:
- WebSocket-driven bidirectional communication
- Multi-module architecture with interdependencies
- Requires global state objects for production operation
- Admin panel integrated (shares same WebSocket connection)
- Networked mode requires SessionModeManager coordination

**Core Modules Required** (all must be initialized):
1. **App** (`app/app.js`) - Main application controller
2. **SessionModeManager** (`app/sessionModeManager.js`) - Networked vs standalone mode
3. **NetworkedQueueManager** (`network/networkedQueueManager.js`) - Transaction queueing
4. **OrchestratorClient** (`network/orchestratorClient.js`) - WebSocket connection
5. **Settings** (`ui/settings.js`) - Device ID and station mode configuration
6. **ConnectionManager** - Referenced by scanner code (line 503)

**Public API**:
```javascript
// Transaction Processing
App.recordTransaction(token, tokenId, isUnknown)  // Process token scan
App.processNFCRead(result)                         // Handle NFC scan event

// Mode Management
App.toggleMode()                                   // Switch detective ↔ blackmarket
sessionModeManager.setMode('networked')            // Set session mode

// Settings
Settings.deviceId = 'GM_TEST_01'                  // Configure device
Settings.stationMode = 'blackmarket'               // Set mode
```

**Critical Initialization Requirements**:
```javascript
// REQUIRED global objects (scanner expects these to exist):
global.window.sessionModeManager = new SessionModeManager();
global.window.sessionModeManager.mode = 'networked';
global.window.queueManager = new NetworkedQueueManager(client);
global.window.connectionManager = { client, isConnected: true, ... };

// REQUIRED settings configuration:
Settings.deviceId = 'GM_TEST_01';
Settings.stationMode = 'blackmarket'; // or 'detective'

// ONLY THEN can you call:
scanner.App.currentTeamId = '001';
scanner.App.recordTransaction(token, tokenId, false);
```

**Browser Dependencies** (all handled by browser-mocks.js):
- `localStorage` - Settings and offline queue
- `window` - Global state management
- `document` - UI manipulation (mocked as no-ops)
- `EventTarget` - Event system base class
- `io()` - Socket.io client
- `ConnectionManager` - Custom class (mock in browser-mocks)

**The Critical Bug** (revealed only when using real scanner API):
```javascript
// What scanner ACTUALLY sends (app.js:663-669):
window.queueManager.queueTransaction({
    tokenId: tokenId,
    teamId: this.currentTeamId,
    deviceId: Settings.deviceId,
    stationMode: Settings.stationMode,  // ❌ Contract says 'mode'
    timestamp: transaction.timestamp
    // ❌ NO wrapped envelope (event, data, timestamp)
});

// What contract requires (asyncapi.yaml:534-559):
{
    event: 'transaction:submit',
    data: {
        tokenId, teamId, deviceId,
        mode: 'detective' | 'blackmarket'  // ← NOT 'stationMode'
    },
    timestamp: ISO8601
}
```

**Testing Scope**: WebSocket transaction flow, admin commands, mode switching, networked queue management

**Admin Panel Integration**:
- Admin panel is part of GM Scanner (same WebSocket connection)
- Commands sent via `socket.emit('gm:command', {action, payload})`
- Tests admin panel when using real scanner connection
- Covers: session control, score adjustment, transaction intervention, video control

---

### Export Verification

**Both scanners are Node.js compatible** when browser APIs are mocked:

```javascript
// GM Scanner (app.js:905, orchestratorClient.js:end)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;  // or OrchestratorClient
}

// Player Scanner (orchestratorIntegration.js:234)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrchestratorIntegration;
}
```

---

## Part 3: Helper File Consolidation

### Current State

```
backend/tests/helpers/
├── test-server.js (155 lines)
├── integration-test-server.js (157 lines)
├── websocket-helpers.js (174 lines)
├── contract-validator.js
└── mock-vlc-server.js
```

**Problem**: `test-server.js` and `integration-test-server.js` are nearly identical (98% same code).

**Usage**:
- `test-server.js`: Used by 9 contract test files
- `integration-test-server.js`: Used by 10 integration test files

---

### Target State

```
backend/tests/helpers/
├── integration-test-server.js (UPDATED - consolidate both)
├── websocket-helpers.js (UPDATED - add scanner helper)
├── browser-mocks.js (NEW - mock browser APIs)
├── contract-validator.js (unchanged)
└── mock-vlc-server.js (unchanged)

DELETED:
├── test-server.js (removed - duplicate)
```

---

### Action: Update `integration-test-server.js`

**Current implementation**: Already correct - keep as-is with one verification addition.

**Why keep current approach:**
- Manual server creation is simpler and works reliably
- Random port via `.listen(0)` avoids PORT env var manipulation complexity
- Config module caching issues avoided entirely
- Test isolation maintained without production dependencies

**Required change**: Add service initialization verification.

**Updated implementation** (minimal changes to existing file):
```javascript
/**
 * Setup integration test server with full WebSocket support
 * Uses manual server creation (not production startServer) for test isolation
 */
async function setupIntegrationTestServer() {
  // Initialize ALL services with real token data
  await initializeServices();

  // VERIFY services initialized correctly
  const transactionService = require('../../src/services/transactionService');
  if (transactionService.tokens.size === 0) {
    throw new Error('Service initialization failed: tokens not loaded');
  }

  // Create HTTP server
  const server = http.createServer(app.app);

  // Create Socket.IO server
  const io = createSocketServer(server);

  // Setup WebSocket handlers (existing code unchanged)
  io.on('connection', async (socket) => {
    // ... existing handler code ...
  });

  // Setup broadcast listeners (existing code unchanged)
  setupBroadcastListeners(io, { /* ... */ });

  // Start server on random available port (OS assigns)
  const port = await new Promise((resolve) => {
    const svr = server.listen(0, () => {
      resolve(svr.address().port);
    });
  });

  const url = `http://localhost:${port}`;

  logger.info('Integration test server started', { port, url });

  return {
    server,
    io,
    port,
    url,
    socketUrl: url
  };
}
```

**Rationale**: Current pattern is simpler, works reliably, and provides adequate test coverage. Production startup sequence is already tested via manual QA and health checks.

---

### Action: Update `websocket-helpers.js`

**Add TWO new scanner helper functions**:

---

#### Player Scanner Helper (SIMPLE - Already Works)

```javascript
/**
 * Create Player Scanner using REAL player scanner code
 * NOTE: Requires browser-mocks.js to be loaded first
 * @param {string} url - Server URL
 * @param {string} deviceId - Optional device ID (auto-generated if omitted)
 * @returns {OrchestratorIntegration} Player Scanner instance (ready to use)
 */
function createPlayerScanner(url, deviceId) {
  const OrchestratorIntegration = require('../../../aln-memory-scanner/js/orchestratorIntegration');

  const client = new OrchestratorIntegration();
  client.baseUrl = url;

  if (deviceId) {
    client.deviceId = deviceId;
  }

  // That's it - client is ready to use
  return client;
}
```

**Usage**:
```javascript
const scanner = createPlayerScanner(server.url, 'PLAYER_TEST_01');
const result = await scanner.scanToken('534e2b03', '001');
```

---

#### GM Scanner Helper (COMPLEX - Requires Full Initialization)

**CRITICAL**: This helper must initialize ALL components required for scanner operation.

```javascript
/**
 * Create authenticated GM Scanner using REAL scanner code with FULL initialization
 * NOTE: Requires browser-mocks.js to be loaded first
 *
 * Initializes ALL required components:
 * - OrchestratorClient (WebSocket connection)
 * - SessionModeManager (networked mode coordination)
 * - NetworkedQueueManager (transaction queueing)
 * - Settings (deviceId, stationMode)
 * - All global window objects scanner expects
 *
 * @param {string} url - Server URL
 * @param {string} deviceId - Scanner device ID
 * @param {string} mode - Station mode ('detective' | 'blackmarket')
 * @param {string} password - Admin password
 * @returns {Promise<Object>} Fully initialized scanner with App API exposed
 */
async function createAuthenticatedScanner(url, deviceId, mode = 'blackmarket', password = 'test-admin-password') {
  // 1. Import ALL required scanner modules
  const OrchestratorClient = require('../../../ALNScanner/js/network/orchestratorClient');
  const NetworkedQueueManager = require('../../../ALNScanner/js/network/networkedQueueManager');
  const SessionModeManager = require('../../../ALNScanner/js/app/sessionModeManager');
  const Settings = require('../../../ALNScanner/js/ui/settings');
  const App = require('../../../ALNScanner/js/app/app');

  // 2. Authenticate via HTTP
  const fetch = require('node-fetch');
  const authResponse = await fetch(`${url}/api/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (!authResponse.ok) {
    throw new Error(`Auth failed: ${authResponse.status}`);
  }

  const { token } = await authResponse.json();

  // 3. Create and configure OrchestratorClient
  const client = new OrchestratorClient({
    url,
    deviceId,
    version: '1.0.0'
  });
  client.token = token;

  // 4. Connect WebSocket and wait for connection
  client.connect();

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    client.socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    client.socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket connection failed: ${error.message}`));
    });
  });

  // 5. Initialize SessionModeManager (CRITICAL - scanner checks this)
  global.window.sessionModeManager = new SessionModeManager();
  global.window.sessionModeManager.mode = 'networked';
  global.window.sessionModeManager.locked = true;

  // 6. Configure Settings (CRITICAL - used in recordTransaction)
  Settings.deviceId = deviceId;
  Settings.stationMode = mode;

  // 7. Create NetworkedQueueManager (CRITICAL - recordTransaction calls this)
  global.window.queueManager = new NetworkedQueueManager(client);

  // 8. Set ConnectionManager reference (scanner checks this at line 503)
  global.window.connectionManager = {
    client: client,
    isConnected: true,
    deviceId: deviceId,
    stationMode: mode
  };

  // 9. Return fully wired scanner with App API exposed
  return {
    client,                       // OrchestratorClient instance
    socket: client.socket,        // Direct socket access (for event listeners)
    App,                          // REAL scanner App module (call App.recordTransaction)
    Settings,                     // Settings reference (for assertions)
    sessionModeManager: global.window.sessionModeManager,
    queueManager: global.window.queueManager
  };
}
```

**Usage**:
```javascript
const scanner = await createAuthenticatedScanner(server.url, 'GM_TEST_01', 'blackmarket');

// Create token object (matches tokens.json structure)
const token = {
  id: '534e2b03',
  SF_MemoryType: 'Technical',
  SF_ValueRating: 3,
  SF_Group: 'TechGroup'
};

// Set team
scanner.App.currentTeamId = '001';

// Use REAL scanner API (not socket.emit!)
scanner.App.recordTransaction(token, '534e2b03', false);

// For admin commands, use socket directly:
scanner.socket.emit('gm:command', {
  event: 'gm:command',
  data: { action: 'session:create', payload: {...} },
  timestamp: new Date().toISOString()
});
```

---

**Module Exports**:
```javascript
module.exports = {
  createTrackedSocket,
  waitForEvent,
  connectAndIdentify,           // Keep for now (contract tests use it)
  waitForMultipleEvents,
  cleanupSockets,
  testDelay,
  createAuthenticatedScanner,   // NEW - Full GM Scanner
  createPlayerScanner,          // NEW - Simple Player Scanner
};
```

**Rationale**:
- Player Scanner is simple - just instantiate and use
- GM Scanner is complex - must initialize all interdependent components
- Only with full initialization can tests use `App.recordTransaction()` API
- Only then will tests reveal the `stationMode` bug

---

### Action: Create `browser-mocks.js`

**New file**: `backend/tests/helpers/browser-mocks.js`

```javascript
/**
 * Browser API Mocks for Scanner Module Testing in Node.js
 * Provides minimal browser environment for ALNScanner modules
 */

// Mock localStorage
global.localStorage = {
  _data: {},
  getItem(key) {
    return this._data[key] || null;
  },
  setItem(key, value) {
    this._data[key] = String(value);
  },
  removeItem(key) {
    delete this._data[key];
  },
  clear() {
    this._data = {};
  }
};

// Mock window (minimal - only what scanner uses)
global.window = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/gm-scanner/'
  },
  connectionManager: null  // Scanner checks this
};

// Mock document (minimal - only what scanner uses)
global.document = {
  readyState: 'complete',
  getElementById: () => null,
  createElement: (tag) => ({
    href: '',
    download: '',
    click: () => {},
    remove: () => {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// Socket.io-client (scanner expects it globally)
global.io = require('socket.io-client');

// Fetch API (for scanner HTTP requests)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

module.exports = {};  // Exports nothing - mocks are global side effects
```

**Rationale**: Scanner modules use browser APIs. Must mock for Node.js. EventTarget is built-in since Node.js 14.5+, no polyfill needed.

---

### Action: Delete `test-server.js`

**Steps**:
1. Update 9 contract test files to import from `integration-test-server.js`:
   ```javascript
   // Change this:
   const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');

   // To this:
   const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
   ```

2. Update function calls in those tests:
   ```javascript
   // Change this:
   testContext = await setupTestServer();
   await cleanupTestServer(testContext);

   // To this:
   testContext = await setupIntegrationTestServer();
   await cleanupIntegrationTestServer(testContext);
   ```

3. Delete `backend/tests/helpers/test-server.js`

**Rationale**: Eliminates duplicate code, single source of truth.

---

### Action: Update HTTP Contract Tests

**Problem**: Plan originally only addressed WebSocket contract tests. HTTP contract tests also need updates to handle removed test-mode code.

**Files Affected (5 HTTP contract tests):**
1. `tests/contract/http/admin.test.js`
2. `tests/contract/http/resource.test.js`
3. `tests/contract/http/scan.test.js` ← **CRITICAL - uses scanRoutes.js**
4. `tests/contract/http/session.test.js`
5. `tests/contract/http/state.test.js`

**Why They'll Break:**
- These tests use `supertest` directly on `app.app` (no server startup)
- After removing scanRoutes.js lines 50-53 (auto-initialize), requests will hit uninitialized services
- `transactionService.tokens.size === 0` → 503 "Service unavailable" error

**Required Changes** - Apply this EXACT pattern to ALL 5 HTTP contract test files:

```javascript
// AT TOP OF FILE - Add these imports:
const { initializeServices } = require('../../../src/app');
const tokenService = require('../../../src/services/tokenService');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const videoQueueService = require('../../../src/services/videoQueueService');

describe('POST /api/scan', () => {
  // Initialize services ONCE for all tests
  beforeAll(async () => {
    await initializeServices();
  });

  beforeEach(async () => {
    // Full reset of all services
    await sessionService.reset();
    await transactionService.reset();
    videoQueueService.reset();

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Create test session
    await sessionService.createSession({
      name: 'Contract Test Session',
      teams: ['001', '002']
    });
  });

  // ... rest of tests unchanged (already use real tokens like '534e2b03')
});
```

**Apply this pattern to ALL 5 files:**
1. `tests/contract/http/scan.test.js` ← **Most critical (uses removed auto-init)**
2. `tests/contract/http/admin.test.js`
3. `tests/contract/http/session.test.js`
4. `tests/contract/http/state.test.js`
5. `tests/contract/http/resource.test.js` (needed for `/api/tokens` endpoint)

**Key points:**
- Use **full reset + re-init** pattern (NOT partial state clearing)
- Always re-load tokens after `transactionService.reset()`
- Consistent pattern across all HTTP contract tests

**Rationale**: HTTP contract tests bypass server startup and need explicit service initialization after test-mode auto-init is removed.

---

## Part 4: Integration Test Transformation

**Integration Test Scope**: Test complete workflows from real scanner modules → server processing → broadcasts to all clients. Validate AsyncAPI/OpenAPI contract compliance, state propagation, and network resilience.

**NOT in scope**: Unit logic, implementation details, performance testing.

---

### Why Tests Must Fail First

**Core Philosophy**: Fix tests to fix production.

Integration tests currently use fake clients (`socket.io-client`, `axios`) with manually crafted data. This creates a **false positive** problem:
- Tests pass because manual data matches what server expects
- Production scanner code may NOT match what server expects
- Bugs remain hidden until deployment

**The TDD Sequence**:

1. **Transform tests** → Use REAL scanner code (createAuthenticatedScanner, createPlayerScanner)
2. **Tests FAIL** → Real scanner behavior doesn't match server expectations
3. **Investigate failures** → Consult contracts (OpenAPI/AsyncAPI) and FRs to understand CORRECT behavior
4. **Fix implementation** → Update scanner OR server to match contracts (contract is source of truth)
5. **Tests pass** → Integration now validated end-to-end

**Example (GM Transaction Bug)**:

Current (WRONG):
```javascript
// Test manually creates correct data
gmSocket.emit('transaction:submit', {
  data: { mode: 'blackmarket' }  // ← Manually correct
});
// ✅ Test passes
```

After transformation (REVEALS BUG):
```javascript
// Test uses REAL scanner API
scanner.App.recordTransaction(token, tokenId, false);
// Scanner actually sends: { stationMode: 'blackmarket' }  ❌ Wrong field!
// ❌ Test FAILS - server doesn't recognize 'stationMode'
```

Investigation:
- Check AsyncAPI contract (lines 534-559): Requires `mode` field
- Check scanner code (app.js:667): Sends `stationMode` field
- Check server validator (validators.js:154): Defaults to 'blackmarket' when `mode` missing

**Bug identified**: Scanner violates contract. Server silently accepts via lenient default.

Fix:
1. Update scanner (app.js:667): `stationMode` → `mode`
2. Update server validator: Remove `.default('blackmarket')` - enforce contract strictly
3. Re-run test: ✅ Passes

**Result**: Production bug fixed, contract compliance validated.

---

**Critical Reminders**:
- **Don't fix tests to match broken implementation** - Fix implementation to match contracts
- **Contracts are source of truth** - OpenAPI + AsyncAPI + FRs define correct behavior
- **NO backward compatibility** - If scanner/server violates contract, implementation is wrong
- **Let tests reveal unknowns** - We can't predict all bugs, that's why we use real code

---

### Integration Tests by Category

**GM Transaction Tests** (8 files) - Use `scanner.App.recordTransaction()`:
- `transaction-flow.test.js` [Phase 3.4 - Transform FIRST]
- `duplicate-detection.test.js`
- `error-propagation.test.js`
- `group-completion.test.js`
- `multi-client-broadcasts.test.js`
- `offline-queue-sync.test.js` (GM portion)
- `state-synchronization.test.js`
- `session-lifecycle.test.js` (transaction portions)

**Admin Command Tests** (2 files) - Use `scanner.socket.emit('gm:command')`:
- `admin-interventions.test.js`
- `session-lifecycle.test.js` (admin command portions)

**Player Scanner Tests** (1 existing + 1 new) - Use `scanner.scanToken()`:
- `video-orchestration.test.js` (transform existing Player Scanner usage)
- NEW: `player-scanner-http.test.js` (offline queue, batch sync)

**Service-Level Tests** (1 file) - No scanner needed:
- `service-events.test.js` (pure service event communication)

**Helper Verification** (1 file) - Needs update with Phase 3.3 fix:
- `_scanner-helpers.test.js` (verify FULL scanner initialization, not just connection)

**Total**: 12 files (10 to transform, 1 new, 2 keep as-is)

---

### Transformation Pattern 1: GM Transaction Tests

**Files**: transaction-flow.test.js, duplicate-detection.test.js, error-propagation.test.js, group-completion.test.js, multi-client-broadcasts.test.js, offline-queue-sync.test.js (GM portion), state-synchronization.test.js

**Current pattern** (WRONG - uses fake socket.io-client):
```javascript
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');

describe('Transaction Flow', () => {
  let testContext, gmSocket;

  beforeEach(async () => {
    testContext = await setupIntegrationTestServer();

    // Manual reset
    await sessionService.reset();
    await transactionService.reset();

    // Manual token loading
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Manual listener setup
    setupBroadcastListeners(testContext.io, { /* ... */ });

    // Manual session creation
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['001', '002']
    });

    // Fake client
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEST');
  });

  it('should process transaction', async () => {
    const resultPromise = waitForEvent(gmSocket, 'transaction:result');

    // Raw WebSocket emit with manual data
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'TEST_VIDEO_1',  // ← Fake token
        teamId: '001',
        deviceId: 'GM_TEST',
        mode: 'blackmarket'       // ← Manually adding correct field
      },
      timestamp: new Date().toISOString()
    });

    const result = await resultPromise;
    expect(result.data.status).toBe('accepted');
  });
});
```

**Problems**:
- Uses fake socket.io-client (not real scanner)
- Manually crafts transaction data (bypasses scanner code)
- Uses fake tokens (TEST_VIDEO_1)
- Manually adds `mode` field (hides scanner's `stationMode` bug)
- **Doesn't test real scanner code path**

---

**CORRECT pattern** (use real scanner API):
```javascript
// CRITICAL: Import browser mocks FIRST
require('../helpers/browser-mocks');

const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');

describe('Transaction Flow - REAL Scanner Integration', () => {
  let testContext, scanner;

  beforeEach(async () => {
    // Start server (initializes services with real tokens)
    testContext = await setupIntegrationTestServer();

    // Create FULLY initialized scanner (with SessionModeManager, NetworkedQueueManager, Settings)
    scanner = await createAuthenticatedScanner(testContext.url, 'GM_TEST_01', 'blackmarket');

    // Create session (via service - simpler than admin command for setup)
    await sessionService.createSession({
      name: 'Transaction Flow Test',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    if (scanner?.socket?.connected) scanner.socket.disconnect();
    await cleanupIntegrationTestServer(testContext);
  });

  it('should process transaction using REAL scanner API', async () => {
    // Listen for server response
    const resultPromise = waitForEvent(scanner.socket, 'transaction:result');

    // Create token object (from tokens.json structure)
    const token = {
      id: '534e2b03',
      SF_MemoryType: 'Technical',
      SF_ValueRating: 3,
      SF_Group: 'TechGroup'
    };

    // Set team (how real scanner does it)
    scanner.App.currentTeamId = '001';

    // Use REAL scanner API (not manual socket.emit!)
    // This calls scanner's recordTransaction which will send stationMode (revealing bug)
    scanner.App.recordTransaction(token, '534e2b03', false);

    const result = await resultPromise;
    expect(result.data.status).toBe('accepted');
    expect(result.data.tokenId).toBe('534e2b03');
    expect(result.data.points).toBe(5000);
  });
});
```

**Why this is correct**:
- Uses `scanner.App.recordTransaction()` (REAL scanner API)
- Scanner sends `stationMode` field (production bug revealed)
- Server must handle actual scanner behavior (not idealized test data)
- Tests REAL code path from production scanner
- Bug will be revealed when scanner sends wrong field

---

---

### Transformation Pattern 2: Admin Command Tests

**Files**: admin-interventions.test.js, session-lifecycle.test.js (admin command portions)

**Contract Reference**:
- AsyncAPI gm:command event (lines 983-1075)
- AsyncAPI gm:command:ack event (lines 1077-1130)
- Functional Requirements Section 4.2 (Admin Panel Intervention Functions)

**Critical Context**:
- AsyncAPI contract (line 1002): "Breaking Changes: Admin commands moved from HTTP POST to WebSocket"
- Admin Panel integrated into GM Scanner (shares same WebSocket connection per FR 4.2)
- Tests currently use WebSocket `gm:command` (following contract)
- Tests use fake socket.io-client (NOT real scanner)

---

**Current pattern** (uses fake socket.io-client):
```javascript
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');

describe('Admin Interventions', () => {
  let testContext, gmAdmin, gmObserver;

  beforeEach(async () => {
    testContext = await setupIntegrationTestServer();

    // Fake socket.io-client connections
    gmAdmin = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ADMIN');
    gmObserver = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_OBSERVER');

    // Create session
    await sessionService.createSession({
      name: 'Admin Test Session',
      teams: ['001', '002']
    });
  });

  it('should adjust score via admin command', async () => {
    const ackPromise = waitForEvent(gmAdmin, 'gm:command:ack');
    const scorePromise = waitForEvent(gmObserver, 'score:updated');

    // Raw socket.emit with command structure from AsyncAPI contract
    gmAdmin.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'score:adjust',
        payload: {
          teamId: '001',
          delta: -500,
          reason: 'Penalty for rule violation'
        }
      },
      timestamp: new Date().toISOString()
    });

    const [ack, scoreUpdate] = await Promise.all([ackPromise, scorePromise]);

    expect(ack.data.success).toBe(true);
    expect(ack.data.action).toBe('score:adjust');
    expect(scoreUpdate.data.teamId).toBe('001');
  });
});
```

**Why current pattern is PARTIALLY correct**:
- ✅ Command structure matches AsyncAPI contract (event, data.action, data.payload, timestamp)
- ✅ Uses WebSocket (correct per contract line 1002)
- ✅ Tests command acknowledgment (gm:command:ack) per contract
- ✅ Tests broadcast propagation (score:updated to observer)
- ❌ Uses fake socket.io-client (not real GM Scanner)
- ❌ Doesn't test actual Admin Panel implementation

---

**CORRECT pattern** (use real GM Scanner with integrated Admin Panel):
```javascript
// CRITICAL: Import browser mocks FIRST
require('../helpers/browser-mocks');

const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');

describe('Admin Interventions - REAL Scanner Integration', () => {
  let testContext, adminScanner, observerScanner;

  beforeEach(async () => {
    testContext = await setupIntegrationTestServer();

    // Create REAL GM Scanners (Admin Panel integrated into GM Scanner per FR 4.2)
    adminScanner = await createAuthenticatedScanner(testContext.url, 'GM_ADMIN', 'blackmarket');
    observerScanner = await createAuthenticatedScanner(testContext.url, 'GM_OBSERVER', 'blackmarket');

    // Create session
    await sessionService.createSession({
      name: 'Admin Intervention Test',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    if (adminScanner?.socket?.connected) adminScanner.socket.disconnect();
    if (observerScanner?.socket?.connected) observerScanner.socket.disconnect();
    await cleanupIntegrationTestServer(testContext);
  });

  it('should adjust score via admin command using REAL scanner', async () => {
    const ackPromise = waitForEvent(adminScanner.socket, 'gm:command:ack');
    const scorePromise = waitForEvent(observerScanner.socket, 'score:updated');

    // Use REAL GM Scanner socket (Admin Panel shares this connection)
    // Command structure per AsyncAPI gm:command specification
    adminScanner.socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'score:adjust',
        payload: {
          teamId: '001',
          delta: -500,
          reason: 'Penalty for rule violation'
        }
      },
      timestamp: new Date().toISOString()
    });

    const [ack, scoreUpdate] = await Promise.all([ackPromise, scorePromise]);

    // Validate acknowledgment structure per AsyncAPI gm:command:ack
    expect(ack.event).toBe('gm:command:ack');
    expect(ack.data.success).toBeDefined();
    expect(ack.data.action).toBe('score:adjust');
    expect(ack.data.message).toBeDefined();

    // Validate broadcast structure per AsyncAPI score:updated
    expect(scoreUpdate.event).toBe('score:updated');
    expect(scoreUpdate.data.teamId).toBe('001');
    expect(scoreUpdate.data.currentScore).toBeDefined();
  });

  it('should pause/resume session via admin command', async () => {
    // Test session:pause command (AsyncAPI action: 'session:pause')
    const pauseAckPromise = waitForEvent(adminScanner.socket, 'gm:command:ack');
    const sessionUpdatePromise = waitForEvent(observerScanner.socket, 'session:update');

    adminScanner.socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:pause',
        payload: {}
      },
      timestamp: new Date().toISOString()
    });

    const [ack, update] = await Promise.all([pauseAckPromise, sessionUpdatePromise]);

    // Validate per AsyncAPI contract
    expect(ack.data.success).toBeDefined();
    expect(update.data.status).toBe('paused');
  });
});
```

**Why this is correct**:
- Uses REAL GM Scanner WebSocket connection (Admin Panel integrated per FR 4.2)
- Tests actual production scanner behavior
- Admin Panel shares GM Scanner connection (not separate WebSocket)
- Tests broadcast propagation to multiple real scanners
- Uses real authentication flow (HTTP POST /api/admin/auth → JWT → WebSocket handshake)

**What this transformation will REVEAL**:
- Whether Admin Panel actually implements WebSocket commands (contract says it should)
- Whether command structure matches AsyncAPI specification
- Whether acknowledgments follow contract structure
- Whether broadcasts propagate correctly through real scanner connections
- Any bugs in command validation, authorization, or execution

**Contract Compliance Verification**:
- All commands must match AsyncAPI action enum (session:create, session:pause, session:resume, session:end, video:skip, score:adjust, etc.)
- All acknowledgments must include: `success` (boolean), `action` (string), `message` (string)
- All side effects must broadcast to other clients (session:update, score:updated, video:status)
- Refer to AsyncAPI gm:command specification (lines 983-1075) for complete action list and payload structures
- Refer to Functional Requirements Section 4.2 for admin intervention behavior

**NO backward compatibility**: Contract is source of truth. If production Admin Panel uses HTTP instead of WebSocket, implementation must be updated to match contract.

---

### Transformation Pattern 3: Player Scanner Tests

**Files**: video-orchestration.test.js (transform existing), player-scanner-http.test.js (NEW)

**Contract Reference**:
- OpenAPI POST /api/scan (lines 48-200)
- OpenAPI POST /api/scan/batch (lines 201-280)
- Functional Requirements Section 2.1 (Player Scanner token submission)
- Functional Requirements Section 2.3 (Connection management, offline queue)

**Critical Context**:
- Player Scanner is HTTP-only client (fire-and-forget, ESP32 compatible per FR 2.1)
- No WebSocket connection (simpler architecture than GM Scanner)
- Offline queue with automatic batch sync
- Tests currently use axios directly (bypassing Player Scanner code)

---

**Current pattern** (bypasses Player Scanner):
```javascript
const axios = require('axios');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');

describe('Video Orchestration', () => {
  let testContext, gmSocket;

  beforeEach(async () => {
    testContext = await setupIntegrationTestServer();
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_VIDEO_TEST');

    await sessionService.createSession({
      name: 'Video Test Session',
      teams: ['001', '002']
    });
  });

  it('should queue video from player scan', async () => {
    const videoStatusPromise = waitForEvent(gmSocket, 'video:status');

    // Direct HTTP POST (bypasses Player Scanner code entirely)
    const response = await axios.post(`${testContext.url}/api/scan`, {
      tokenId: '534e2b03',
      deviceId: 'PLAYER_SCANNER_01',
      timestamp: new Date().toISOString()
    });

    expect(response.status).toBe(200);
    expect(response.data.status).toBe('accepted');
    expect(response.data.videoQueued).toBe(true);

    const videoEvent = await videoStatusPromise;
    expect(videoEvent.data.status).toBe('loading');
  });
});
```

**Why current pattern is WRONG**:
- ❌ Uses axios directly (doesn't test Player Scanner code)
- ❌ Doesn't test Player Scanner's offline queue logic
- ❌ Doesn't test Player Scanner's connection management
- ❌ Doesn't test Player Scanner's error handling
- ❌ Doesn't test batch sync after offline queue
- ✅ Correctly validates video:status broadcast to GM clients

---

**CORRECT pattern** (use real Player Scanner API):
```javascript
// CRITICAL: Import browser mocks FIRST
require('../helpers/browser-mocks');

const { createPlayerScanner } = require('../helpers/websocket-helpers');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');

describe('Video Orchestration - REAL Player Scanner Integration', () => {
  let testContext, playerScanner, gmSocket;

  beforeEach(async () => {
    testContext = await setupIntegrationTestServer();

    // Create REAL Player Scanner
    playerScanner = createPlayerScanner(testContext.url, 'PLAYER_TEST_01');

    // Connect GM scanner to observe broadcasts
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_VIDEO_TEST');

    await sessionService.createSession({
      name: 'Video Orchestration Test',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    await cleanupIntegrationTestServer(testContext);
  });

  it('should queue video using REAL Player Scanner API', async () => {
    const videoStatusPromise = waitForEvent(gmSocket, 'video:status');

    // Use REAL Player Scanner API (not axios!)
    // This triggers scanner's actual scanToken() implementation
    const result = await playerScanner.scanToken('534e2b03', '001');

    // Validate Player Scanner response per OpenAPI /api/scan response schema
    expect(result.status).toBeDefined();

    // Validate video:status broadcast per AsyncAPI contract
    const videoEvent = await videoStatusPromise;
    expect(videoEvent.event).toBe('video:status');
    expect(videoEvent.data.status).toBeDefined();
    expect(videoEvent.data.queueLength).toBeDefined();
  });

  it('should handle offline queue when disconnected', async () => {
    // Disconnect Player Scanner
    playerScanner.connected = false;

    // Scan while offline (uses REAL offline queue logic from orchestratorIntegration.js)
    const result = await playerScanner.scanToken('rat001', '001');

    // Validate offline behavior per Player Scanner implementation
    expect(result.status).toBe('offline');
    expect(result.queued).toBe(true);
    expect(playerScanner.offlineQueue.length).toBe(1);

    // Verify queue structure
    const queued = playerScanner.offlineQueue[0];
    expect(queued.tokenId).toBe('rat001');
    expect(queued.teamId).toBe('001');
    expect(queued.timestamp).toBeDefined();
  });

  it('should sync offline queue when reconnected', async () => {
    // Queue multiple offline scans
    playerScanner.connected = false;
    await playerScanner.scanToken('rat001', '001');
    await playerScanner.scanToken('asm001', '002');

    expect(playerScanner.offlineQueue.length).toBe(2);

    // Reconnect and sync (uses REAL processOfflineQueue logic)
    playerScanner.connected = true;
    await playerScanner.processOfflineQueue();

    // Validate queue processed
    expect(playerScanner.offlineQueue.length).toBe(0);
  });
});
```

**Why this is correct**:
- Uses `playerScanner.scanToken()` (REAL Player Scanner API)
- Tests actual offline queue implementation (orchestratorIntegration.js lines 61-76)
- Tests actual batch sync logic (lines 99-129)
- Tests real connection management and error handling
- Validates HTTP responses match OpenAPI schema
- Validates broadcasts match AsyncAPI schema

**What this transformation will REVEAL**:
- Whether Player Scanner correctly implements HTTP POST /api/scan per OpenAPI contract
- Whether offline queue persistence works correctly
- Whether batch sync matches OpenAPI POST /api/scan/batch specification
- Whether Player Scanner error handling matches documented behavior
- Any bugs in connection detection, retry logic, or queue management

**Contract Compliance Verification**:
- HTTP requests must match OpenAPI /api/scan schema (tokenId, deviceId, teamId optional, timestamp)
- HTTP responses must match OpenAPI response schema (status, message, videoQueued)
- Batch requests must match OpenAPI /api/scan/batch schema (array of transactions)
- Refer to Functional Requirements Section 2.1 for scan submission behavior
- Refer to Functional Requirements Section 2.3 for offline queue behavior

**Additional Player Scanner Test** (NEW file):

Create `tests/integration/player-scanner-http.test.js` to thoroughly test Player Scanner HTTP workflow:
- Online scanning (immediate HTTP POST)
- Offline queueing (localStorage persistence)
- Connection recovery (auto-retry logic)
- Batch sync (POST /api/scan/batch with multiple scans)
- Error handling (network failures, server errors)

This complements video-orchestration.test.js which focuses on video playback flow.

---

### Real Token IDs

**Verified tokens from ALN-TokenData/tokens.json**:
- `534e2b02`
- `534e2b03`
- `asm001`
- `fli001`
- `hos001`
- `jaw001`
- `kaa001`
- `rat001`
- `tac001`

**Usage in tests**:
```javascript
// Replace this:
tokenId: 'TEST_VIDEO_1'

// With this:
tokenId: '534e2b03'
```

---

## Part 5: UDP Discovery Integration Test

**Why**: UDP discovery is a core scanner connectivity feature, currently untested.

**Create new file**: `backend/tests/integration/udp-discovery.test.js`

```javascript
/**
 * UDP Discovery Integration Test
 * Tests scanner auto-discovery of orchestrator on local network
 *
 * Feature: Scanners broadcast "ALN_DISCOVER" on UDP port 8888
 * Orchestrator responds with service info (port, addresses)
 */

const dgram = require('dgram');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const DiscoveryService = require('../../src/services/discoveryService');

describe('UDP Discovery Feature', () => {
  let server, discoveryService;

  beforeAll(async () => {
    // Start integration test server
    server = await setupIntegrationTestServer();

    // Manually create and start discovery service
    // (integration-test-server doesn't use production startup, so discovery not auto-created)
    discoveryService = new DiscoveryService();
    discoveryService.start(server.port);
  });

  afterAll(async () => {
    // Stop discovery service
    if (discoveryService) {
      discoveryService.stop();
    }

    // Cleanup test server
    await cleanupIntegrationTestServer(server);
  });

  it('should respond to ALN_DISCOVER broadcast', async () => {
    const client = dgram.createSocket('udp4');

    // Listen for discovery response
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discovery timeout - no response received'));
      }, 2000);

      client.on('message', (msg) => {
        clearTimeout(timeout);
        resolve(JSON.parse(msg.toString()));
      });
    });

    // Bind to random port
    await new Promise((resolve) => {
      client.bind(0, () => resolve());
    });

    // Send discovery broadcast to orchestrator
    const message = Buffer.from('ALN_DISCOVER');
    client.send(message, 0, message.length, 8888, '127.0.0.1');

    // Wait for response
    const response = await responsePromise;

    // Validate response structure
    expect(response).toHaveProperty('service', 'ALN_ORCHESTRATOR');
    expect(response).toHaveProperty('version', '1.0.0');
    expect(response).toHaveProperty('port', server.port);
    expect(response).toHaveProperty('addresses');
    expect(response).toHaveProperty('timestamp');
    expect(Array.isArray(response.addresses)).toBe(true);

    client.close();
  });
});
```

**Rationale**: Tests real scanner discovery workflow end-to-end. Manually creates DiscoveryService since integration-test-server uses manual server creation (not production startup).

---

## Part 6: Implementation Checklist

### Phase 1: Production Code Cleanup ✅ COMPLETE
- [x] Review relevant code and prepare for implementation.
- [x] Edit `src/routes/scanRoutes.js` - Delete lines 50-53, 57-63, 77-89, 166-169, 187-199
- [x] Edit `src/routes/scanRoutes.js` - Add error returns (503, 409, 404)
- [x] Edit `src/services/transactionService.js` - Delete lines 96-122
- [x] Edit `src/websocket/gmAuth.js` - Delete line 24, update line 27 condition
- [x] Edit `src/services/videoQueueService.js` - Delete lines 45-54, update line 114
- [x] Edit `src/services/sessionService.js` - Delete line 431 conditional (always clear persistence)
- [x] Edit `src/services/offlineQueueService.js` - Delete line 379
- [x] Verify successful and COMPLETE phase implementation.
- [x] Git Commit & Update Implementation Checklist (Commit: 6787da02)

### Phase 2: Helper Files & Contract Tests ✅ COMPLETE
- [x] Review previous steps' work and relevant code for this phase and prepare for implementation.
- [x] Edit `tests/helpers/integration-test-server.js` - Move auth from middleware to connection handler (match production)
- [x] Edit `tests/helpers/websocket-helpers.js` - Update connectAndIdentify to use handshake.auth (remove sync:full wait)
- [x] Create `tests/helpers/browser-mocks.js` - New file (deferred to Phase 3 - not needed for contract tests)
- [x] Delete `tests/helpers/test-server.js` - Remove duplicate helper
- [x] Delete `tests/contract/websocket/auth-events.test.js` - Auth flow tested implicitly by other tests
- [x] Update `tests/contract/websocket/device-events.test.js` - Add device:connected test (complete device lifecycle coverage)
- [x] Update `tests/contract/websocket/session-events.test.js` - Fix sync:full test to use handshake auth
- [x] HTTP contract tests already had correct pattern (no changes needed)
- [x] Verify successful and COMPLETE phase implementation - All 13 contract test suites pass (56 tests)
- [x] Git Commit & Update Implementation Checklist (Commit: 36826d10)

**Key Learnings from Phase 2**:
1. **Contract tests validate events, NOT workflows** - Auth flow is proven by tests passing, doesn't need explicit test
2. **Separation of concerns** - Connection helper (connectAndIdentify) ≠ workflow validator (don't force sync:full wait)
3. **Match production timing** - Auth in connection handler (not middleware) to match server.js execution order
4. **AsyncAPI contract is source of truth** - gm:identify/gm:identified were antipatterns, not in contract
5. **Test what production does** - Deleted 8/9 WebSocket imports task, only needed to fix tests using antipatterns


### Phase 3: Integration Tests - Use Real Scanner Modules

**Core Problem**: Integration tests use raw `socket.io-client` and `fetch`, NOT the actual deployed scanner code from submodules. This means:
- GM Scanner (`ALNScanner/js/network/orchestratorClient.js`) is **never tested**
- Player Scanner (`aln-memory-scanner/js/orchestratorIntegration.js`) is **never tested**
- Tests passing gives false confidence about deployed code quality

**Investigation Findings**:
- ✅ Prerequisites: browser-mocks.js exists, scanner modules have exports, dependencies installed
- ✅ Most integration tests already use real tokens (534e2b03, tac001)
- ❌ Gap 1: browser-mocks.js missing globals (App, Debug, window.sessionModeManager/queueManager)
- ❌ Gap 2: No Player Scanner helper or integration tests
- ❌ Gap 3: Integration tests use raw socket.io-client, not real OrchestratorClient
- ❌ Gap 4: Few tests still use TEST_* tokens (error-propagation, video-orchestration)

---

#### Phase 3.1: Complete Browser Mocks (Prerequisite) ✅ COMPLETE
- [x] **Update browser-mocks.js** - Add missing globals for GM scanner:
  ```javascript
  global.App = { viewController: null, updateAdminPanel: () => {} };
  global.Debug = { log: () => {}, warn: () => {}, error: () => {} };
  global.window.sessionModeManager = null;
  global.window.queueManager = null;
  global.console = console;
  ```
- [x] **Test GM Scanner loads** - DISCOVERED BUG #1: Missing `ConnectionManager` global (line 503)
- [x] **Fix Bug #1** - Added `global.ConnectionManager = class ConnectionManager {};`
- [x] **Test Player Scanner loads** - DISCOVERED BUG #2: `setInterval()` in constructor keeps Node.js alive
- [x] **Fix Bug #2** - Mocked `setInterval/clearInterval` to register but not execute
- [x] **Verification**: Both scanner modules load without errors

**Production Bugs Found**:
1. **GM Scanner crash**: References undefined `ConnectionManager` global (orchestratorClient.js:503)
   - Would fail in any non-browser environment (Node.js, Deno, etc.)
2. **Player Scanner hangs**: Constructor starts `setInterval()` that prevents process exit
   - Would cause memory leaks in long-running Node.js contexts (server-side rendering, CLIs)

#### Phase 3.2: Create Player Scanner Helper ✅ COMPLETE
- [x] **Add createPlayerScanner() to websocket-helpers.js**:
  ```javascript
  function createPlayerScanner(url, deviceId) {
    const OrchestratorIntegration = require('../../../aln-memory-scanner/js/orchestratorIntegration');
    const client = new OrchestratorIntegration();
    client.baseUrl = url;
    if (deviceId) {
      client.deviceId = deviceId;
    }
    return client;
  }
  ```
- [x] **Export in module.exports**
- [x] **Verification**: Function exists and creates instance (tested in Phase 3.3)

#### Phase 3.3: Test Scanner Helpers Work ✅ COMPLETE

**PRODUCTION BUG DISCOVERED & FIXED (from initial attempt):**
- **Bug**: AsyncAPI contract specifies `deviceId` in handshake.auth, production server expected `stationId`
- **Impact**: GM Scanners would connect but fail all transaction submissions with "Not identified" error
- **Root Cause**: Contract violation - server.js line 41 extracted `stationId` instead of `deviceId`
- **Files Fixed**:
  - backend/src/server.js (lines 41, 43, 54, 66)
  - backend/src/websocket/gmAuth.js (lines 18, 35, 40, 46)
  - backend/tests/helpers/integration-test-server.js (lines 53, 55, 60, 72)
  - backend/tests/helpers/websocket-helpers.js (line 78)
  - backend/tests/contract/websocket/session-events.test.js (line 91)
- **Verification**: All contract tests pass (56/56)

**What We Actually Did (complete implementation):**

1. **Fixed `createAuthenticatedScanner()` in websocket-helpers.js**:
   - ✅ Added SessionModeManager initialization (mode='networked', locked=true)
   - ✅ Added NetworkedQueueManager initialization (with OrchestratorClient)
   - ✅ Added Settings configuration (deviceId, stationMode)
   - ✅ Added global window objects (sessionModeManager, queueManager, connectionManager)
   - ✅ Made Settings globally available (App module expects it)
   - ✅ Changed return value to wrapper object: `{ client, socket, App, Settings, sessionModeManager, queueManager }`

2. **Enhanced browser-mocks.js** (discovered additional requirements):
   - ✅ Added global Settings mock (App.recordTransaction uses Settings.deviceId, Settings.stationMode)
   - ✅ Added global DataManager mock (App.recordTransaction uses DataManager.markTokenAsScanned)
   - ✅ Added global UIManager mock (App.recordTransaction uses UIManager.updateSessionStats, showTokenResult)
   - ✅ Enhanced document.getElementById to return proper mock elements with properties (disabled, textContent, style, classList)
   - ✅ Fixed diagnostic warning (unused `tag` parameter → `_tag`)

3. **Updated _scanner-helpers.test.js**:
   - ✅ Fixed existing tests to use `scanner.client.*` instead of `scanner.*` (wrapper object change)
   - ✅ Added comprehensive initialization test:
     - Verifies all returned object properties (client, socket, App, Settings, sessionModeManager, queueManager)
     - Verifies Settings configured correctly (deviceId, stationMode)
     - Verifies SessionModeManager configured (mode='networked', locked=true)
     - Verifies global window objects exist
     - **CRITICAL**: Verifies `App.recordTransaction()` can be called without crashing (proves full initialization)

**Test Results**:
```
Scanner Helper Verification
  GM Scanner (OrchestratorClient)
    ✓ should create GM Scanner instance
    ✓ should connect and authenticate GM Scanner via HTTP + WebSocket
    ✓ should receive and process sync:full after connection
    ✓ should send and receive transaction events
    ✓ should fully initialize GM Scanner with all required components  ← NEW
  Player Scanner (OrchestratorIntegration)
    ✓ should create Player Scanner instance
    ✓ should POST /api/scan via real Player Scanner code
    ✓ should queue scans when offline

Test Suites: 1 passed
Tests:       8 passed, 8 total
```

**What Changed vs Plan**:
- **Plan said**: Phase 3.1 browser-mocks.js was complete
- **Reality**: Needed additional globals (Settings, DataManager, UIManager) discovered during Phase 3.3
- **Plan said**: Test verifies App.recordTransaction "works" (expects transaction result)
- **Reality**: Test verifies App.recordTransaction "doesn't crash" (proves initialization, NOT correctness)
- **Reason**: Phase 3.3 tests helper completeness, Phase 3.4 tests production bug discovery

**Key Learnings**:
1. **Incremental discovery is normal**: Can't predict all browser mocks needed until real scanner code runs
2. **Test scope matters**: Phase 3.3 = "helper works", Phase 3.4 = "scanner sends correct data"
3. **Return wrapper object**: Returning `{ client, App, Settings, ... }` gives tests access to everything
4. **Global scope required**: Scanner modules expect Settings/DataManager/UIManager globally, not just as imports

#### Phase 3.4: Transform ONE GM Test (Pattern Validation) ✅ COMPLETE (with critical discovery)
- [x] **Transformed transaction-flow.test.js to use REAL scanner entry point**
**Final implementation** (used production entry point, not intermediate layer):
  ```javascript
  // Scanner helper loads RAW tokens from ALN-TokenData (not server's transformed tokens)
  const rawTokens = JSON.parse(fs.readFileSync('../ALN-TokenData/tokens.json'));
  global.TokenManager.database = rawTokens;

  // Use REAL production entry point (not recordTransaction):
  scanner.App.currentTeamId = '001';
  scanner.App.processNFCRead({id: '534e2b03'});  // ← Full production flow
  ```

**Implementation bugs fixed**:
- [x] Scanner event wrapping (networkedQueueManager.js:60, 90) - now wraps per AsyncAPI
- [x] Scanner field naming (app.js:667) - `stationMode` → `mode`
- [x] Server envelope strictness (adminEvents.js:140) - removed fallback
- [x] Server mode field (validators.js:154) - removed `.default()`, now required
- [x] Unit tests (validators.test.js) - added missing `mode` field

**Token data format issue discovered & fixed**:
- Scanner expects: Raw format (`SF_Group`, `SF_MemoryType`, `SF_ValueRating`)
- Server uses: Transformed format (`group`, `memoryType`, `valueRating`)
- Wire protocol: Only `tokenId` (no format conflict in production)
- Fix: Load raw tokens for scanner, not server's transformed tokens

**Test Results**: 4/6 passing
- ✅ Blackmarket transaction processing
- ✅ Detective mode (no score update)
- ✅ Broadcast to multiple GMs (1 submits, others observe)
- ✅ Same-team duplicate detection
- ❌ Concurrent transactions from different teams
- ❌ Different-team duplicate detection

**CRITICAL DISCOVERY: Scanner Singleton Architecture**

The 2 failures revealed a fundamental architectural reality:

**Scanner is designed as singleton object literal**:
```javascript
const App = { currentTeamId: '', ... }  // Singleton, not class
const Settings = { deviceId: '001', stationMode: 'detective' }  // Singleton
```

**In Production** (works correctly):
- Each GM = separate browser tab = isolated JavaScript execution context
- Each tab has its own `App` singleton (no collision)

**In Node.js Tests** (cannot work):
- Module caching returns SAME object for all `require()` calls
- `gm1.App === gm2.App` (true - same object!)
- `gm1.App.currentTeamId = '001'; gm2.App.currentTeamId = '002'` → collision!

**This is NOT a bug** - it's an architectural constraint. Scanner code was designed for one-GM-per-browser-tab isolation.

**Decision: Option 3 - Layer-Appropriate Testing**

**Single-GM Integration Tests** (use real scanner):
- Tests: "Does one GM scanner correctly integrate with server?"
- Pattern: `scanner.App.processNFCRead()` (real production code path)
- File: `transaction-flow.test.js`

**Multi-GM Coordination Tests** (use manual socket.emit):
- Tests: "Does server correctly coordinate multiple independent GM inputs?"
- Pattern: Manual `socket.emit()` to simulate independent GMs (like contract tests)
- File: NEW `multi-gm-coordination.test.js`

**Rationale**:
- Matches production architecture (one GM = one browser tab)
- Tests each layer appropriately (single-GM integration vs server coordination)
- E2E multi-GM testing done via manual QA (multiple real browser tabs)

---

#### Phase 3.5: Reorganize Tests by Architecture ✅ COMPLETE
- [x] **Keep in transaction-flow.test.js** (4 single-GM tests - ALL PASSING)
  - ✅ Blackmarket transaction processing
  - ✅ Detective mode (no score update)
  - ✅ Broadcast observation (1 GM submits, others observe)
  - ✅ Same-team duplicate detection
- [x] **Created multi-gm-coordination.test.js** (multi-GM server coordination)
  - ✅ Concurrent transactions from different teams (PASSES)
  - ✅ Different-team duplicate detection (PASSES after fix)
- [x] **Pattern documented** - transaction-flow.test.js serves as reference

**Bug Discovered & Fixed**:
- **Symptom**: Team 001 score was 10000 instead of 5000 after duplicate detection test
- **Root Cause**: Missing `transactionService.reset()` in beforeEach caused listener accumulation
- **Fix Applied**: Added full reset pattern (reset services → re-init tokens → re-setup broadcast listeners)
- **Result**: Both tests now pass ✅
- **Key Learning**: Test infrastructure bugs can masquerade as production bugs - always verify test setup first

#### Phase 3.6: Transform Remaining Single-GM Integration Tests

**Phase 3.6a: admin-interventions.test.js** ✅ COMPLETE
- [x] **Added 9 failing tests** for unimplemented admin commands (contract-specified, FR-required)
- [x] **Implemented 9 missing commands**:
  - `video:play`, `video:pause`, `video:stop` (FR 4.2.2) - Added vlcService calls
  - `video:queue:add`, `video:queue:reorder`, `video:queue:clear` (FR 4.2.2) - Added videoQueueService methods
  - `transaction:delete`, `transaction:create` (FR 4.2.4) - Added transactionService methods
  - `system:reset` (FR 4.2.5) - Added full system reset
- [x] **Fixed implementation bugs revealed by tests**:
  - Missing imports: `config`, `vlcService` in adminEvents.js
  - Undefined variable: `currentSession` → use `sessionService.getCurrentSession()` per case
  - Test data issue: Used token with video asset (534e2b03) not rat001
  - Method name: `addToQueue()` not `addVideo()` in videoQueueService
- [x] **Verification**: All 21 tests pass (12 existing + 9 new)

**Implementation Gaps Found**:
1. Video playback commands existed in AsyncAPI contract but had no implementation
2. Video queue management methods partially missing (add/reorder existed conceptually but not as admin commands)
3. Transaction intervention commands defined in FR 4.2.4 but unimplemented
4. System reset command defined in FR 4.2.5 but unimplemented
5. Admin command handler missing required service imports

**Phase 3.6b: error-propagation.test.js** ✅ COMPLETE
- [x] **Minimal transformation** - Replaced `TEST_VIDEO_ERROR` with real token (534e2b03)
- [x] **Kept manual socket.emit()** - Tests server error handling, not scanner integration
- [x] **Kept fake socket.io-client** - Need to inject invalid/malformed data that real scanner wouldn't send
- [x] **Verification**: All 10 tests pass

**Decision**: Error propagation is at **server coordination layer**, not scanner integration layer.
- Tests adversarial scenarios (invalid data, malformed requests, missing parameters)
- Real GM Scanner validates before sending - wouldn't produce these error cases
- Similar to multi-gm-coordination.test.js - testing server behavior with various inputs
- Pattern: Keep manual socket.emit for error injection

**Phase 3.6c: Critical Test Infrastructure Issue - Async Timer Leaks** ✅ COMPLETE

**Discovery**: While working on group-completion.test.js transformation, encountered non-deterministic test failures:
- Run 1 (full suite): 1 failed, 89 passed
- Run 2 (isolated file): 0 failed, 6 passed (group-completion PASSES alone)
- Run 3 (full suite): 2 failed, 88 passed (different tests failing)

**Pattern Analysis**:
- Tests passing alone but failing in suite → test isolation failure
- Error: `ReferenceError: You are trying to 'import' a file after the Jest environment has been torn down`
- Stack trace: `videoQueueService.js:223` → lazy `require('./vlcService')` in timer callback
- Listener accumulation: `totalRemoved` varied (21, 29) across runs

**Root Cause Identified**:

VideoQueueService had **untracked async timer** that outlived test teardown:

```javascript
// Line 179 - Anonymous setTimeout, NO reference stored
setTimeout(() => {
  this.monitorVlcPlayback(queueItem, duration);
}, 1500);

// Line 223 - Lazy require in timer callback
async monitorVlcPlayback(queueItem, expectedDuration) {
  const vlcService = require('./vlcService');  // ❌ Fires after Jest teardown
```

**Failure Sequence**:
1. Test scans `534e2b03` (has video asset) → triggers playback
2. Playback sets 1.5s monitoring delay timer (untracked)
3. Test completes → `videoQueueService.reset()` clears tracked timers only
4. Jest tears down environment
5. **1.5s later**: Timer fires → `require()` → ReferenceError

**Why Non-Deterministic**:
- Depends on which test scans video token ~1.5s before suite completion
- Test execution order + timing determines failure location
- Explains why group-completion passed alone but failed in suite

**Fixes Applied**:

1. **Track monitoring delay timer** (src/services/videoQueueService.js):
```javascript
// Constructor
this.monitoringDelayTimer = null;

// Line 180 - Store reference
this.monitoringDelayTimer = setTimeout(() => {
  this.monitoringDelayTimer = null;
  this.monitorVlcPlayback(queueItem, duration);
}, 1500);

// reset() - Clear timer
if (this.monitoringDelayTimer) {
  clearTimeout(this.monitoringDelayTimer);
  this.monitoringDelayTimer = null;
}
```

2. **Eager load vlcService** (defensive fix):
```javascript
// Top of file - avoid lazy require in timer callbacks
const vlcService = require('./vlcService');

// Removed 6 lazy requires throughout file (lines 73, 113, 222, 345, 369, 398)
```

3. **Add videoQueueService.reset() to integration tests**:
- Updated: transaction-flow.test.js, group-completion.test.js, multi-gm-coordination.test.js, admin-interventions.test.js
- Pattern: Call `videoQueueService.reset()` in beforeEach after requiring service, before setupBroadcastListeners

4. **Audited all services with timers**:
- ✅ vlcService: Properly tracks `healthCheckInterval`, `reconnectTimer`
- ✅ stateService: Properly tracks `debounceTimer`, `syncInterval`
- ✅ sessionService: Properly tracks `sessionTimeoutTimer`
- ✅ offlineQueueService: Uses `setImmediate` (no persistent timers)
- ✅ videoQueueService: NOW properly tracks all timers (playbackTimer, progressTimer, fallbackTimer, monitoringDelayTimer)

**Verification**:
- [x] All 365 tests passing (219 unit + 56 contract + 90 integration)
- [x] No more "require after teardown" errors
- [x] Tests pass consistently in suite and isolation
- [x] Timer cleanup verified via listener count logs

**Key Learnings**:
1. **Async resources outlive tests** - ALL timers/intervals must be tracked and cleared
2. **Non-deterministic = timing issue** - Test passes alone but fails in suite indicates leaked async
3. **Lazy requires in async callbacks are dangerous** - Can fire after module system teardown
4. **Follow actual execution path** - Video token → queue → playback → monitoring → timer
5. **Test isolation requires explicit cleanup** - Services must reset ALL state including timers
6. **Think holistically about system flow** - Don't work mechanically, understand WHY each component exists

**Remaining Phase 3.6 Tasks - ACCURATE ASSESSMENT**:

After systematic review of all 13 integration test files (90 tests total):

**ALREADY TRANSFORMED ✅ (3 files, 35 tests):**
- ✅ `_scanner-helpers.test.js` - Tests helper functions via real scanner (8 tests)
- ✅ `admin-interventions.test.js` - Admin commands via real GM scanner (21 tests)
- ✅ `transaction-flow.test.js` - Single GM transaction flow via real scanner (6 tests)

**CORRECTLY using socket.emit ✅ (6 files, 33 tests):**
These test **SERVER COORDINATION LOGIC** - manual socket.emit is the correct pattern:
- ✅ `duplicate-detection.test.js` - Server duplicate tracking across teams (6 tests)
- ✅ `error-propagation.test.js` - Server error handling/error injection (10 tests)
- ✅ `multi-client-broadcasts.test.js` - Server broadcast infrastructure (7 tests)
- ✅ `multi-gm-coordination.test.js` - Server concurrent GM resolution (2 tests)
- ✅ `service-events.test.js` - Internal service events (4 tests)
- ✅ `offline-queue-sync.test.js` - Server offline queue processing (4 tests)

**NEED TRANSFORMATION ❌ (4 files, 25 tests):**
These test **SINGLE GM/PLAYER INTEGRATION** - should use real scanner API:
- [ ] **group-completion.test.js** - Single GM scans group tokens → Use real scanner (6 tests)
- [ ] **state-synchronization.test.js** - Late-joining GM connection → Use real scanner (3 tests)
- [ ] **session-lifecycle.test.js** - GM scanner session workflow (create→pause→resume→end) → Use real scanner (7 tests)
- [ ] **video-orchestration.test.js** - Player scan → video queue → Use createPlayerScanner (9 tests)

**CRITICAL REMINDER:**
When transforming tests to use real scanner API, **tests may FAIL** - this is EXPECTED and GOOD.
Failures reveal:
- Bugs in scanner code (wrong field names, missing data)
- Bugs in server code (wrong validation, missing handlers)
- Contract violations (implementation doesn't match AsyncAPI/OpenAPI)

**When tests fail after transformation:**
1. ✅ Investigate what scanner actually sends vs what contract specifies
2. ✅ Check if server correctly handles what contract specifies
3. ✅ Fix implementation code (scanner OR server) to match contract
4. ❌ DO NOT fix test to match broken implementation
5. ✅ Contract is source of truth

#### Phase 3.7: Create Multi-GM Coordination Tests ✅ COMPLETE
- [x] **Create tests/integration/multi-gm-coordination.test.js** (Created in Phase 3.5)
- [x] **Move concurrent transaction tests** from transaction-flow.test.js
- [x] **Move different-team duplicate test** from transaction-flow.test.js
- [x] **Use manual socket.emit pattern** (like contract tests)
- [x] **Test server coordination logic** (not scanner integration)
- [x] **Verification**: Multi-GM coordination tests pass (2/2 passing)

#### Phase 3.8: Create Player Scanner Integration Tests
- [ ] **Create tests/integration/player-scanner-http.test.js** - Test real Player Scanner HTTP workflow
- [ ] **Test POST /api/scan when online**
- [ ] **Test offline queue** - Scans queued when disconnected
- [ ] **Test POST /api/scan/batch** - Offline queue sync
- [ ] **Run**: `npm test -- tests/integration/player-scanner-http.test.js`
- [ ] **Fix issues**
- [ ] **Verification**: Player Scanner integration test passes

#### Phase 3.9: Final Verification
- [ ] **Run all integration tests**: `npm run test:integration`
- [ ] **Verify**: 12/12 pass (11 GM + 1 Player)
- [ ] **Verify**: No test-mode conditionals
- [ ] **Verify**: All use real scanner modules
- [ ] **Verify**: All use real tokens from ALN-TokenData
- [ ] **Check for leaks**: `npm test -- --detectOpenHandles`
- [ ] **Verification**: 12/12 integration tests pass

#### Phase 3.10: Documentation & Commit
- [ ] **Update this plan** - Mark Phase 3 complete, document actual changes vs plan, add lessons learned
- [ ] **Git commit**: Phase 3 implementation with detailed commit message
- [ ] **Verification**: Plan document updated, changes committed

---

**Key Learnings from Phase 3.4**:
1. **Use production entry points**: `processNFCRead()` not `recordTransaction()` - tests full flow
2. **Respect data format boundaries**: Scanner uses raw tokens, server transforms separately
3. **Singleton architecture limits testing**: Can't have multiple scanner instances in one process
4. **Layer-appropriate testing**: Single-GM via real scanner, multi-GM via manual socket.emit
5. **Architectural constraints are valid**: Not all production patterns can be integration tested

**Anti-Pattern Avoidance for Phase 3**:
- ❌ Don't batch transform without testing ONE first
- ❌ Don't assume scanner modules work - test loading first
- ❌ Don't skip Player Scanner (both scanners must be tested)
- ❌ Don't mechanically follow plan - understand WHY each step matters
- ✅ Read actual code before assuming behavior
- ✅ Test incrementally (one file at a time)
- ✅ Verify after each change
- ✅ Fix gaps as discovered

### Phase 4: UDP Discovery
- [ ] Review previous steps' work and relevant code for this phase and prepare for implementation. 
- [ ] Create `tests/integration/udp-discovery.test.js` - New file
- [ ] Verify successful and COMPLETE phase implementation. 
- [ ] Git Commit & Update Implementation Checklist


### Phase 5: Validation
- [ ] Run `npm test` - Verify all tests pass
- [ ] Run `npm run dev` - Verify production server starts
- [ ] Manual test: Scan without session - Verify 409 error
- [ ] Manual test: Scan with unknown token - Verify 404 error
- [ ] Verify successful and COMPLETE phase implementation. 
- [ ] Git Commit & Update Implementation Checklist

---

## Part 7: File Change Summary

**Production files modified: 6**
1. src/routes/scanRoutes.js (remove 5 conditionals, add 3 errors)
2. src/services/transactionService.js (remove 1 conditional)
3. src/websocket/gmAuth.js (remove 1 conditional)
4. src/services/videoQueueService.js (remove 2 conditionals)
5. src/services/sessionService.js (remove 1 conditional - always clear persistence)
6. src/services/offlineQueueService.js (remove 1 conditional)

**Helper files: 4 operations**
1. UPDATE: tests/helpers/integration-test-server.js (add service init verification)
2. UPDATE: tests/helpers/websocket-helpers.js (add createAuthenticatedScanner function)
3. CREATE: tests/helpers/browser-mocks.js (without EventTarget polyfill)
4. DELETE: tests/helpers/test-server.js

**Contract tests updated: 14 files**
- 9 WebSocket tests (change imports from test-server to integration-test-server)
- 5 HTTP tests (add beforeAll + beforeEach with full reset + re-init pattern)

**Integration tests transformed: 11 files** (use real scanner code, real tokens)

**New integration test: 1 file** (UDP discovery - manually creates DiscoveryService)

**Total: 36 files affected**

---

## Success Criteria

### Production Code
✅ Zero `NODE_ENV === 'test'` conditionals in business logic (routes, services, websocket)
✅ Proper error responses (503, 409, 404) for edge cases
✅ Services always initialize properly (no auto-init bypasses)

### Helper Files
✅ No duplicate helper files (test-server.js deleted)
✅ Single consolidated integration-test-server.js
✅ Scanner client helper available (createAuthenticatedScanner)
✅ Browser APIs properly mocked (without EventTarget polyfill)

### Contract Tests
✅ All 9 WebSocket tests import from integration-test-server (not test-server)
✅ All 5 HTTP tests initialize services properly via beforeAll
✅ All 5 HTTP tests use full reset + re-init pattern (not partial state clearing)
✅ All contract tests use real tokens from ALN-TokenData
✅ HTTP tests handle 503 errors when services not initialized

### Integration Tests
✅ All tests use manual server creation (simpler than production startup)
✅ All tests optionally use real scanner modules (createAuthenticatedScanner available)
✅ All tests use real tokens from ALN-TokenData (no TEST_* tokens)
✅ All tests authenticate via HTTP when using scanner modules
✅ All tests create sessions via admin commands or service calls

### Test Results
✅ Unit tests pass (unchanged)
✅ Contract tests pass (14 files updated correctly)
✅ Integration tests pass (with real tokens)
✅ UDP discovery test passes (manually creates DiscoveryService)
✅ Production server starts and handles errors correctly

---

**END OF IMPLEMENTATION PLAN**
