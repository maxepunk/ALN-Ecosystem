# ALN Orchestrator Connection & Authentication Fix Plan

**Date:** 2025-11-05
**Branch:** `claude/audit-orchestrator-auth-011CUpqy6qGm3jUKmd2h9JYM`
**Audit Documents:** `AUDIT_CONNECTION_AUTHENTICATION.md`, `ESP32_CONNECTION_ANALYSIS.md`

---

## Executive Summary

### Audit Validation: ✅ CONFIRMED

After thorough code review, I confirm **21 of 23 issues** identified in the audit are accurate and require fixes. The audit is **well-researched, accurate, and actionable**.

**Key Validation Findings:**
- ✅ Issue #1 (scannedTokens not synced): CONFIRMED - No field in Session model (session.js:44-51)
- ✅ Issue #2 (reconnection broadcast): CONFIRMED - broadcasts.js:97-116 only fires on isNew=true
- ✅ Issue #3 (race condition): CONFIRMED - setupWebSocketHandlers() at line 215, setupServiceListeners() at line 238
- ✅ Issue #6 (missing cleanup): CONFIRMED - cleanupBroadcastListeners() exists but never called in cleanup()
- ✅ Session.updateDevice() logic: CONFIRMED - Returns isNew based on array search (session.js:175-191)
- ✅ Device disconnect behavior: CONFIRMED - Marks 'disconnected' but keeps in array (deviceTracking.js:27-28)

**2 Issues Require Clarification:**
- Issue #4: Need to verify GM Scanner socket cleanup pattern in ALNScanner submodule
- Issue #8: Need to verify missing beforeunload handler in ALNScanner submodule

### Impact Assessment

**User-Facing Issues (High Priority):**
1. GM scanners lose duplicate detection after refresh → **Data integrity violation**
2. Reconnecting devices don't show as "connected" → **UX confusion**
3. Offline queue cleared without server ACK → **Silent data loss**
4. Early connections miss state sync → **Stale UI**

**Technical Debt (Medium Priority):**
5. Memory leaks in test environments → **CI instability**
6. Race conditions in connection flow → **Intermittent failures**
7. Missing server-side duplicate detection → **Scoring integrity**

### Recommended Approach

**Phase 1 (Week 1-2): Critical Data Integrity** - 5 issues, 16-20 hours
**Phase 2 (Week 3): Connection Stability** - 6 issues, 14-18 hours
**Phase 3 (Week 4+): Polish & ESP32** - 12 issues, 25-35 hours

**Total Estimated Effort:** 55-73 hours (~7-9 developer days)

---

## Phase 1: Critical Data Integrity (P0)

**Goal:** Fix all data loss and integrity violations
**Timeline:** Week 1-2
**Estimated Effort:** 16-20 hours

### P0.1: Server-Side Duplicate Detection + sync:full Restoration

**Fixes Issues:** #1 (Client duplicate detection cleared), #7 (No server-side duplicate detection)

#### Problem Statement

Currently, duplicate detection is **client-side only** (GM Scanner localStorage). When a GM Scanner refreshes:
1. `scannedTokens` Set cleared
2. WebSocket reconnects, receives `sync:full`
3. `sync:full` has no `scannedTokens` field
4. Tokens can be re-scanned, causing duplicate points

Additionally, Player Scanners have **zero** duplicate detection (scanRoutes.js:75 comment: "no duplicate detection for player scanner").

#### Implementation Approach

**Backend Changes:**

1. **Add scannedTokens to Session Model** (session.js)
```javascript
// In Session constructor (around line 44)
if (!data.metadata) {
  data.metadata = {
    gmStations: 0,
    playerDevices: 0,
    totalScans: 0,
    uniqueTokensScanned: [],      // Global unique tokens (existing)
    scannedTokensByDevice: {}      // NEW: Per-device tracking
  };
}

// Add helper method
getDeviceScannedTokens(deviceId) {
  return this.metadata.scannedTokensByDevice[deviceId] || [];
}

setDeviceScannedTokens(deviceId, tokens) {
  this.metadata.scannedTokensByDevice[deviceId] = tokens;
}
```

2. **Track scans in transactionService** (transactionService.js)
```javascript
// In processTransaction() after validation
const session = sessionService.getCurrentSession();
if (session) {
  let deviceTokens = session.getDeviceScannedTokens(deviceId);

  // Check for duplicate
  if (deviceTokens.includes(tokenId)) {
    logger.info('Duplicate scan detected (server-side)', { tokenId, deviceId });

    return {
      success: false,
      duplicate: true,
      message: 'Token already scanned by this device',
      tokenId,
      deviceId
    };
  }

  // Add to scanned tokens
  deviceTokens.push(tokenId);
  session.setDeviceScannedTokens(deviceId, deviceTokens);

  // Emit event to trigger persistence
  sessionService.emit('session:updated', session);
}
```

3. **Include in sync:full payload** (gmAuth.js:122)
```javascript
// Add to sync:full event payload
emitWrapped(socket, 'sync:full', {
  session: session ? session.toJSON() : null,
  scores: transactionService.getTeamScores(),
  recentTransactions,
  videoStatus: videoStatus,
  devices: [...],
  systemStatus: {...},
  scannedTokensByDevice: session?.metadata.scannedTokensByDevice || {}  // NEW
});
```

4. **Update AsyncAPI Contract** (asyncapi.yaml around line 394)
```yaml
# In sync:full event payload
scannedTokensByDevice:
  type: object
  description: Map of deviceId to array of scanned tokenIds for duplicate detection
  additionalProperties:
    type: array
    items:
      type: string
  example:
    GM_STATION_1: ["kaa001", "kaa002", "sf_rfid_001"]
    SCANNER_FLOOR1_001: ["kaa003", "jaw_004"]
```

**Frontend Changes (GM Scanner - ALNScanner submodule):**

5. **Restore scannedTokens from sync:full** (orchestratorClient.js:340-362)
```javascript
// In setupEventHandlers() - sync:full handler
this.socket.on('sync:full', (data) => {
  // Existing code...

  // NEW: Restore scannedTokens from server
  if (data.scannedTokensByDevice && data.scannedTokensByDevice[this.stationId]) {
    const serverTokens = data.scannedTokensByDevice[this.stationId];
    dataManager.restoreScannedTokens(serverTokens);
    logger.info('Restored scannedTokens from server', {
      count: serverTokens.length,
      deviceId: this.stationId
    });
  }
});
```

6. **Add restoration method** (dataManager.js)
```javascript
// In DataManager class
restoreScannedTokens(tokens) {
  // Clear existing
  this.scannedTokens.clear();

  // Add all tokens from server (source of truth)
  tokens.forEach(tokenId => {
    this.scannedTokens.add(tokenId);
  });

  // Save to localStorage for offline resilience
  this.saveScannedTokens();

  logger.info('ScannedTokens restored', { count: tokens.length });
}
```

7. **Handle duplicate response** (orchestratorClient.js)
```javascript
// In scan submission handler
const response = await fetch(`${url}/api/scan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

const result = await response.json();

if (response.status === 409 || result.duplicate) {
  // Server rejected as duplicate
  logger.info('Server rejected duplicate scan', { tokenId: payload.tokenId });

  // Mark as scanned locally (sync with server state)
  dataManager.markTokenAsScanned(payload.tokenId);

  return { success: false, duplicate: true };
}
```

#### Testing Strategy

**Unit Tests:**

```javascript
// backend/tests/unit/session-duplicate-detection.test.js
describe('Session - Duplicate Detection', () => {
  test('getDeviceScannedTokens returns empty array for new device', () => {
    const session = new Session({ id: 'test-1' });
    expect(session.getDeviceScannedTokens('GM_001')).toEqual([]);
  });

  test('setDeviceScannedTokens stores and retrieves tokens', () => {
    const session = new Session({ id: 'test-1' });
    session.setDeviceScannedTokens('GM_001', ['kaa001', 'kaa002']);
    expect(session.getDeviceScannedTokens('GM_001')).toEqual(['kaa001', 'kaa002']);
  });

  test('different devices have separate scannedTokens', () => {
    const session = new Session({ id: 'test-1' });
    session.setDeviceScannedTokens('GM_001', ['kaa001']);
    session.setDeviceScannedTokens('GM_002', ['kaa002']);

    expect(session.getDeviceScannedTokens('GM_001')).toEqual(['kaa001']);
    expect(session.getDeviceScannedTokens('GM_002')).toEqual(['kaa002']);
  });
});

// backend/tests/unit/transactionService-duplicates.test.js
describe('TransactionService - Server-Side Duplicate Detection', () => {
  beforeEach(() => {
    sessionService.createSession({ name: 'Test Session' });
  });

  test('rejects duplicate scan from same device', async () => {
    const scan1 = { tokenId: 'kaa001', teamId: '001', deviceId: 'GM_001' };
    const scan2 = { tokenId: 'kaa001', teamId: '001', deviceId: 'GM_001' };

    const result1 = await transactionService.processTransaction(scan1);
    expect(result1.success).toBe(true);

    const result2 = await transactionService.processTransaction(scan2);
    expect(result2.success).toBe(false);
    expect(result2.duplicate).toBe(true);
  });

  test('allows same token from different devices', async () => {
    const scan1 = { tokenId: 'kaa001', teamId: '001', deviceId: 'GM_001' };
    const scan2 = { tokenId: 'kaa001', teamId: '002', deviceId: 'GM_002' };

    const result1 = await transactionService.processTransaction(scan1);
    const result2 = await transactionService.processTransaction(scan2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});
```

**Contract Tests:**

```javascript
// backend/tests/contract/asyncapi-sync-full.test.js
describe('AsyncAPI - sync:full Event', () => {
  test('sync:full includes scannedTokensByDevice field', (done) => {
    // Setup: Create session, connect GM, scan tokens
    const session = sessionService.createSession({ name: 'Test' });
    session.setDeviceScannedTokens('GM_001', ['kaa001', 'kaa002']);

    // Connect socket
    const socket = io(socketUrl, { auth: { token: gmToken } });

    socket.on('sync:full', (data) => {
      expect(data.scannedTokensByDevice).toBeDefined();
      expect(data.scannedTokensByDevice.GM_001).toEqual(['kaa001', 'kaa002']);
      socket.disconnect();
      done();
    });
  });
});
```

**Integration Tests:**

```javascript
// backend/tests/integration/duplicate-detection.test.js
describe('Integration - End-to-End Duplicate Detection', () => {
  test('GM Scanner: Duplicate detection survives page refresh', async () => {
    // 1. Scan tokens
    await request(app).post('/api/scan').send({ tokenId: 'kaa001', deviceId: 'GM_001', teamId: '001' });
    await request(app).post('/api/scan').send({ tokenId: 'kaa002', deviceId: 'GM_001', teamId: '001' });

    // 2. Simulate page refresh (new socket connection)
    const socket = io(socketUrl, { auth: { token: gmToken, deviceId: 'GM_001' } });

    // 3. Wait for sync:full
    const syncData = await new Promise((resolve) => {
      socket.on('sync:full', resolve);
    });

    // 4. Verify scannedTokens restored
    expect(syncData.scannedTokensByDevice.GM_001).toEqual(['kaa001', 'kaa002']);

    // 5. Attempt duplicate scan
    const response = await request(app).post('/api/scan').send({
      tokenId: 'kaa001',
      deviceId: 'GM_001',
      teamId: '001'
    });

    expect(response.status).toBe(409);
    expect(response.body.duplicate).toBe(true);
  });

  test('Player Scanner: Server rejects duplicate scans', async () => {
    const scan = { tokenId: 'kaa001', deviceId: 'PLAYER_001', teamId: '001' };

    const response1 = await request(app).post('/api/scan').send(scan);
    expect(response1.status).toBe(200);

    const response2 = await request(app).post('/api/scan').send(scan);
    expect(response2.status).toBe(409);
    expect(response2.body.duplicate).toBe(true);
  });
});
```

**E2E Tests (Playwright):**

```javascript
// backend/tests/e2e/gm-scanner-duplicate-detection.spec.js
test('GM Scanner duplicate detection survives page refresh', async ({ page }) => {
  // 1. Load GM Scanner
  await page.goto('https://localhost:3000/gm-scanner/');

  // 2. Authenticate
  await page.fill('#password', process.env.ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // 3. Scan token
  await page.evaluate(() => {
    window.dataManager.handleScan('kaa001');
  });

  // 4. Verify token marked as scanned
  const scannedTokens1 = await page.evaluate(() => {
    return Array.from(window.dataManager.scannedTokens);
  });
  expect(scannedTokens1).toContain('kaa001');

  // 5. Refresh page
  await page.reload();

  // 6. Wait for sync:full
  await page.waitForFunction(() => window.orchestratorClient?.connected);

  // 7. Verify scannedTokens restored
  const scannedTokens2 = await page.evaluate(() => {
    return Array.from(window.dataManager.scannedTokens);
  });
  expect(scannedTokens2).toContain('kaa001');

  // 8. Attempt duplicate scan
  await page.evaluate(() => {
    window.dataManager.handleScan('kaa001');
  });

  // 9. Verify blocked
  const response = await page.evaluate(() => {
    return window.dataManager.lastScanResult;
  });
  expect(response.duplicate).toBe(true);
});
```

#### Deployment Considerations

1. **Data Migration:** Existing sessions in `backend/data/session-*.json` won't have `scannedTokensByDevice`. Add migration:
```javascript
// In sessionService.loadSession()
if (!session.metadata.scannedTokensByDevice) {
  session.metadata.scannedTokensByDevice = {};
  logger.info('Migrated session to add scannedTokensByDevice field', { sessionId: session.id });
}
```

2. **Backward Compatibility:** Old GM Scanner clients (pre-fix) won't send `scannedTokensByDevice` in localStorage. Server-side duplicate detection ensures this doesn't break scoring.

#### Estimated Effort

- Backend changes: 4 hours
- Frontend changes (GM Scanner submodule): 3 hours
- Contract updates: 1 hour
- Unit tests: 2 hours
- Integration tests: 2 hours
- E2E tests: 2 hours
- Testing & debugging: 3 hours

**Total: 17 hours**

---

### P0.2: Offline Queue Acknowledgment Pattern

**Fixes Issue:** #5 (Queue cleared without server ACK)

#### Problem Statement

GM Scanner's `networkedQueueManager.js` clears the offline queue **immediately** after calling `sendBatch()`, without waiting for server confirmation (networkedQueueManager.js:102-104). If network drops during upload, scans are permanently lost.

#### Implementation Approach

**Backend Changes:**

1. **Add batch ACK event** (scanRoutes.js)
```javascript
// In POST /api/scan/batch endpoint (around line 120)
router.post('/batch', async (req, res) => {
  const { transactions } = req.body;

  // Process all transactions
  const results = await Promise.all(
    transactions.map(tx => transactionService.processTransaction(tx))
  );

  const batchId = uuidv4();
  const successCount = results.filter(r => r.success).length;
  const failures = results
    .map((r, i) => ({ index: i, ...r }))
    .filter(r => !r.success);

  // Emit WebSocket ACK to device (if connected)
  const deviceId = transactions[0]?.deviceId;
  if (deviceId && req.app.locals.io) {
    req.app.locals.io.to(`device:${deviceId}`).emit('batch:ack', {
      batchId,
      processedCount: successCount,
      totalCount: transactions.length,
      failures
    });
  }

  res.json({
    batchId,
    processedCount: successCount,
    totalCount: transactions.length,
    failures
  });
});
```

2. **Update AsyncAPI Contract** (asyncapi.yaml)
```yaml
# Add new event under messages
batch:ack:
  name: batch:ack
  title: Batch Upload Acknowledgment
  summary: Server confirms successful processing of offline queue batch
  payload:
    type: object
    required:
      - batchId
      - processedCount
      - totalCount
    properties:
      batchId:
        type: string
        format: uuid
        description: Unique ID for this batch upload
      processedCount:
        type: integer
        description: Number of transactions successfully processed
      totalCount:
        type: integer
        description: Total transactions in batch
      failures:
        type: array
        items:
          type: object
          properties:
            index:
              type: integer
            tokenId:
              type: string
            error:
              type: string
```

**Frontend Changes (GM Scanner - ALNScanner submodule):**

3. **Wait for ACK before clearing queue** (networkedQueueManager.js)
```javascript
class NetworkedQueueManager {
  constructor() {
    this.pendingBatches = new Map();  // Track in-flight batches
    this.client = null;
  }

  async syncToOrchestrator() {
    if (this.queue.length === 0) return;

    const batch = this.queue.slice(0, this.BATCH_SIZE);
    const batchId = this.generateBatchId();  // UUID or timestamp

    // Mark as pending (don't clear yet)
    this.pendingBatches.set(batchId, batch);

    try {
      // Send with batchId for tracking
      await this.client.sendBatchWithAck(batch, batchId);

      // Wait for ACK event (with 30s timeout)
      await this.waitForAck(batchId, 30000);

      // ACK received - safe to clear
      this.removeBatch(batch.length);
      this.pendingBatches.delete(batchId);

      logger.info('Batch uploaded and confirmed', { batchId, count: batch.length });

    } catch (error) {
      logger.error('Batch upload failed, keeping in queue', { batchId, error });
      this.pendingBatches.delete(batchId);
      // Batch remains in queue for retry
    }
  }

  waitForAck(batchId, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.client.socket.off('batch:ack', handler);
        reject(new Error(`Batch ACK timeout: ${batchId}`));
      }, timeout);

      const handler = (data) => {
        if (data.batchId === batchId) {
          clearTimeout(timer);
          this.client.socket.off('batch:ack', handler);
          resolve(data);
        }
      };

      this.client.socket.on('batch:ack', handler);
    });
  }
}
```

4. **Register ACK handler** (orchestratorClient.js)
```javascript
// In setupEventHandlers()
this.socket.on('batch:ack', (data) => {
  logger.info('Batch ACK received', {
    batchId: data.batchId,
    processed: data.processedCount,
    total: data.totalCount
  });

  // Emit event for queue manager
  this.emit('batch:acknowledged', data);
});
```

#### Testing Strategy

**Unit Tests:**

```javascript
// backend/tests/unit/batch-ack.test.js
describe('Batch Upload Acknowledgment', () => {
  test('POST /api/scan/batch emits batch:ack event', async () => {
    const mockIo = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
    app.locals.io = mockIo;

    const transactions = [
      { tokenId: 'kaa001', deviceId: 'GM_001', teamId: '001' },
      { tokenId: 'kaa002', deviceId: 'GM_001', teamId: '001' }
    ];

    const response = await request(app)
      .post('/api/scan/batch')
      .send({ transactions });

    expect(response.status).toBe(200);
    expect(response.body.processedCount).toBe(2);

    expect(mockIo.to).toHaveBeenCalledWith('device:GM_001');
    expect(mockIo.to().emit).toHaveBeenCalledWith('batch:ack', expect.objectContaining({
      batchId: expect.any(String),
      processedCount: 2,
      totalCount: 2
    }));
  });
});
```

**Integration Tests:**

```javascript
// backend/tests/integration/offline-queue.test.js
describe('Integration - Offline Queue with ACK', () => {
  test('Queue preserved if ACK not received', async () => {
    // Setup: Mock network failure AFTER sending batch
    const queueManager = new NetworkedQueueManager();
    queueManager.queue = [
      { tokenId: 'kaa001', deviceId: 'GM_001', teamId: '001' },
      { tokenId: 'kaa002', deviceId: 'GM_001', teamId: '001' }
    ];

    // Intercept socket.io to drop ACK
    jest.spyOn(socket, 'on').mockImplementation((event, handler) => {
      if (event === 'batch:ack') {
        // Don't call handler - simulate dropped ACK
        return;
      }
    });

    // Attempt sync (should timeout)
    await expect(queueManager.syncToOrchestrator()).rejects.toThrow('Batch ACK timeout');

    // Verify queue NOT cleared
    expect(queueManager.queue.length).toBe(2);
  });

  test('Queue cleared only after ACK received', async () => {
    const queueManager = new NetworkedQueueManager();
    queueManager.queue = [
      { tokenId: 'kaa001', deviceId: 'GM_001', teamId: '001' }
    ];

    // Start sync (returns promise)
    const syncPromise = queueManager.syncToOrchestrator();

    // Verify queue NOT cleared yet (ACK pending)
    expect(queueManager.queue.length).toBe(1);

    // Simulate ACK arrival
    setTimeout(() => {
      socket.emit('batch:ack', { batchId: 'test-batch', processedCount: 1 });
    }, 100);

    // Wait for sync to complete
    await syncPromise;

    // NOW queue should be cleared
    expect(queueManager.queue.length).toBe(0);
  });
});
```

#### Estimated Effort

- Backend changes: 2 hours
- Frontend changes: 3 hours
- Contract updates: 30 minutes
- Unit tests: 1 hour
- Integration tests: 2 hours
- Testing & debugging: 2 hours

**Total: 10.5 hours**

---

### P0.3: Service Initialization Order Fix

**Fixes Issue:** #3 (Race condition - broadcast listeners not registered before sync:full)

#### Problem Statement

In `server.js`, `setupWebSocketHandlers()` is called at line 215 (in `createServer()`), but `setupServiceListeners()` is called at line 238 (in `startServer()`). If a socket connects between these two calls, it receives `sync:full` but broadcast listeners aren't registered yet, causing the client to miss critical state updates.

#### Implementation Approach

**Backend Changes:**

1. **Reorder initialization** (server.js)
```javascript
// BEFORE (current code):
function createServer() {
  // ...
  if (!io) {
    io = createSocketServer(server);
    app.locals.io = io;
    setupWebSocketHandlers(io);  // ← TOO EARLY
  }
  // ...
}

async function startServer() {
  const instances = createServer();

  if (!isInitialized) {
    await initializeServices();
    isInitialized = true;
  }

  setupServiceListeners(instances.io);  // ← TOO LATE
  // ...
}

// AFTER (fixed):
function createServer() {
  // ...
  if (!io) {
    io = createSocketServer(server);
    app.locals.io = io;
    // DON'T setup handlers yet - wait for services
  }
  // ...
}

async function startServer() {
  const instances = createServer();

  if (!isInitialized) {
    await initializeServices();
    isInitialized = true;
  }

  // Setup listeners BEFORE accepting connections
  setupServiceListeners(instances.io);

  // NOW safe to accept WebSocket connections
  setupWebSocketHandlers(instances.io);

  // Start listening...
}
```

2. **Add initialization flag check** (server.js)
```javascript
// In setupWebSocketHandlers()
function setupWebSocketHandlers(io) {
  if (!isInitialized) {
    logger.warn('setupWebSocketHandlers called before services initialized');
    throw new Error('Services must be initialized before setting up WebSocket handlers');
  }

  // ... existing handler setup
}
```

#### Testing Strategy

**Unit Tests:**

```javascript
// backend/tests/unit/server-initialization.test.js
describe('Server Initialization Order', () => {
  test('setupWebSocketHandlers throws if called before initializeServices', () => {
    const io = createMockSocketIO();

    // Reset initialization flag
    isInitialized = false;

    expect(() => setupWebSocketHandlers(io)).toThrow(
      'Services must be initialized before setting up WebSocket handlers'
    );
  });

  test('setupWebSocketHandlers succeeds after initializeServices', async () => {
    const io = createMockSocketIO();

    await initializeServices();

    expect(() => setupWebSocketHandlers(io)).not.toThrow();
  });
});
```

**Integration Tests:**

```javascript
// backend/tests/integration/early-connection.test.js
describe('Integration - Early Connection Handling', () => {
  test('Socket connecting during startup receives sync:full with broadcast listeners active', async () => {
    // Start server (simulates full startup)
    await startServer();

    // Connect socket immediately
    const socket = io(socketUrl, { auth: { token: gmToken } });

    // Wait for sync:full
    const syncData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('sync:full timeout')), 5000);

      socket.on('sync:full', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    expect(syncData).toBeDefined();
    expect(syncData.session).toBeDefined();

    // Trigger a state change (e.g., scan)
    await request(app).post('/api/scan').send({
      tokenId: 'kaa001',
      deviceId: 'PLAYER_001',
      teamId: '001'
    });

    // Verify broadcast received (listeners were active)
    const updateEvent = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('state:updated timeout')), 2000);

      socket.on('state:updated', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    expect(updateEvent).toBeDefined();
  });
});
```

#### Estimated Effort

- Backend changes: 1 hour
- Unit tests: 30 minutes
- Integration tests: 1.5 hours
- Testing & debugging: 1 hour

**Total: 4 hours**

---

### P0.4: Missing Cleanup Call

**Fixes Issue:** #6 (cleanupBroadcastListeners not called in cleanup())

#### Problem Statement

The `cleanup()` function in `server.js` doesn't call `cleanupBroadcastListeners()`, leaving the module-level flag `broadcastListenersActive = true` and old listeners attached. This causes memory leaks in test environments and prevents proper re-initialization.

#### Implementation Approach

**Backend Changes:**

1. **Add cleanup call** (server.js:275-315)
```javascript
async function cleanup() {
  const { cleanupBroadcastListeners } = require('./websocket/broadcasts');

  if (discoveryService) {
    discoveryService.stop();
    discoveryService = null;
  }

  // CRITICAL: Cleanup broadcast listeners BEFORE closing io
  cleanupBroadcastListeners();

  if (io) {
    // Disconnect sockets...
    try {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
    } catch (e) {
      logger.warn('Error disconnecting sockets during cleanup', { error: e.message });
    }

    // Close io...
    await new Promise((resolve, reject) => {
      // ... existing close logic
    });

    io = null;
  }

  // ... rest of cleanup
}
```

2. **Add defensive check** (broadcasts.js)
```javascript
// In setupServiceListeners()
function setupServiceListeners(io) {
  if (broadcastListenersActive) {
    logger.warn('setupServiceListeners called with listeners already active - cleaning up first');
    cleanupBroadcastListeners();
  }

  // ... existing setup
}
```

#### Testing Strategy

**Unit Tests:**

```javascript
// backend/tests/unit/cleanup.test.js
describe('Server Cleanup', () => {
  test('cleanup() calls cleanupBroadcastListeners()', async () => {
    const { cleanupBroadcastListeners } = require('../src/websocket/broadcasts');
    jest.spyOn(require('../src/websocket/broadcasts'), 'cleanupBroadcastListeners');

    await startServer();
    await cleanup();

    expect(cleanupBroadcastListeners).toHaveBeenCalled();
  });

  test('broadcastListenersActive flag reset after cleanup', async () => {
    await startServer();
    await cleanup();

    const { isBroadcastListenersActive } = require('../src/websocket/broadcasts');
    expect(isBroadcastListenersActive()).toBe(false);
  });

  test('Can re-initialize server after cleanup', async () => {
    // First startup
    await startServer();
    await cleanup();

    // Second startup (should not throw)
    await expect(startServer()).resolves.not.toThrow();
    await cleanup();
  });
});
```

**Integration Tests:**

```javascript
// backend/tests/integration/server-lifecycle.test.js
describe('Integration - Server Lifecycle', () => {
  test('Multiple startup/cleanup cycles work correctly', async () => {
    for (let i = 0; i < 3; i++) {
      await startServer();

      // Connect socket
      const socket = io(socketUrl, { auth: { token: gmToken } });
      await waitForConnection(socket);

      // Trigger broadcast
      sessionService.emit('session:updated', sessionService.getCurrentSession());

      // Verify received
      const event = await new Promise((resolve) => {
        socket.on('session:update', resolve);
      });
      expect(event).toBeDefined();

      socket.disconnect();
      await cleanup();

      // Verify no listeners remain
      expect(sessionService.listenerCount('session:updated')).toBe(0);
    }
  });
});
```

#### Estimated Effort

- Backend changes: 30 minutes
- Unit tests: 1 hour
- Integration tests: 1.5 hours
- Testing & debugging: 1 hour

**Total: 4 hours**

---

## Phase 2: Connection Stability (P1)

**Goal:** Fix connection loss, reconnection, and race conditions
**Timeline:** Week 3
**Estimated Effort:** 14-18 hours

### P1.1: Device Reconnection Broadcast Fix

**Fixes Issue:** #2 (Device reconnection doesn't trigger device:connected broadcast)

#### Problem Statement

When a device disconnects and reconnects with the same deviceId, `Session.updateDevice()` returns `isNew=false` because the device still exists in the `connectedDevices` array (with `connectionStatus='disconnected'`). The broadcast listener in `broadcasts.js:97-116` only fires on `isNew && connectionStatus='connected'`, so reconnecting devices never broadcast `device:connected`.

#### Implementation Approach

**Backend Changes:**

1. **Track previous connection status** (session.js)
```javascript
// In updateDevice() method
updateDevice(device) {
  const index = this.connectedDevices.findIndex(d => d.id === device.id);
  const isNew = index === -1;

  let previousStatus = null;
  if (index >= 0) {
    previousStatus = this.connectedDevices[index].connectionStatus;
    this.connectedDevices[index] = device;
  } else {
    this.connectedDevices.push(device);
    if (device.type === 'gm') {
      this.metadata.gmStations++;
    } else {
      this.metadata.playerDevices++;
    }
  }

  return { isNew, previousStatus };
}
```

2. **Emit previousStatus in event** (sessionService.js)
```javascript
// In updateDevice() service method
async updateDevice(device) {
  const session = this.getCurrentSession();
  if (!session) {
    throw new Error('No active session');
  }

  const { isNew, previousStatus } = session.updateDevice(device);

  await this.saveSession();

  // Emit with previousStatus for broadcast logic
  this.emit('device:updated', { device, isNew, previousStatus });

  return { isNew, previousStatus };
}
```

3. **Update broadcast logic** (broadcasts.js)
```javascript
// In device:updated listener (line 97)
addTrackedListener(sessionService, 'device:updated', ({ device, isNew, previousStatus }) => {
  // Broadcast on:
  // 1. New device connecting (isNew=true)
  // 2. Existing device reconnecting (previousStatus='disconnected' → 'connected')
  const isReconnection = (
    previousStatus === 'disconnected' &&
    device.connectionStatus === 'connected'
  );

  if ((isNew || isReconnection) && device.connectionStatus === 'connected') {
    emitWrapped(io, 'device:connected', {
      deviceId: device.id,
      type: device.type,
      name: device.name,
      ipAddress: device.ipAddress,
      connectionTime: device.connectionTime,
      isReconnection  // Flag for client UI
    });

    logger.info('Broadcasted device:connected', {
      deviceId: device.id,
      type: device.type,
      isNew,
      isReconnection
    });
  }
});
```

4. **Update AsyncAPI Contract** (asyncapi.yaml)
```yaml
# In device:connected event payload
isReconnection:
  type: boolean
  description: True if device was previously connected, disconnected, and reconnected
  default: false
```

#### Testing Strategy

**Unit Tests:**

```javascript
// backend/tests/unit/session-reconnection.test.js
describe('Session - Device Reconnection', () => {
  test('updateDevice returns previousStatus for existing device', () => {
    const session = new Session({ id: 'test-1' });

    // Initial connection
    const device1 = { id: 'GM_001', connectionStatus: 'connected' };
    const result1 = session.updateDevice(device1);
    expect(result1.isNew).toBe(true);
    expect(result1.previousStatus).toBe(null);

    // Disconnect
    const device2 = { id: 'GM_001', connectionStatus: 'disconnected' };
    const result2 = session.updateDevice(device2);
    expect(result2.isNew).toBe(false);
    expect(result2.previousStatus).toBe('connected');

    // Reconnect
    const device3 = { id: 'GM_001', connectionStatus: 'connected' };
    const result3 = session.updateDevice(device3);
    expect(result3.isNew).toBe(false);
    expect(result3.previousStatus).toBe('disconnected');
  });
});
```

**Integration Tests:**

```javascript
// backend/tests/integration/device-reconnection.test.js
describe('Integration - Device Reconnection Broadcast', () => {
  test('device:connected broadcast on reconnection', async () => {
    await startServer();
    const session = sessionService.createSession({ name: 'Test' });

    // Connect observer socket
    const observer = io(socketUrl, { auth: { token: gmToken, deviceId: 'OBSERVER' } });

    const events = [];
    observer.on('device:connected', (data) => events.push(data));

    // Connect device
    const device1 = io(socketUrl, { auth: { token: gmToken, deviceId: 'GM_RECONNECT' } });
    await waitForConnection(device1);

    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(events.length).toBe(1);
    expect(events[0].deviceId).toBe('GM_RECONNECT');
    expect(events[0].isReconnection).toBe(false);

    // Disconnect
    device1.disconnect();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Reconnect
    const device2 = io(socketUrl, { auth: { token: gmToken, deviceId: 'GM_RECONNECT' } });
    await waitForConnection(device2);

    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(events.length).toBe(2);
    expect(events[1].deviceId).toBe('GM_RECONNECT');
    expect(events[1].isReconnection).toBe(true);  // ← KEY ASSERTION

    device2.disconnect();
    observer.disconnect();
  });
});
```

#### Estimated Effort

- Backend changes: 2 hours
- Contract updates: 30 minutes
- Unit tests: 1 hour
- Integration tests: 2 hours
- Testing & debugging: 1.5 hours

**Total: 7 hours**

---

### P1.2: Socket Join Ordering Fix

**Fixes Issue:** #11 (Device update before socket.join() completes)

#### Problem Statement

In `gmAuth.js`, `updateDevice()` is called (emitting `device:updated`) before `socket.join('session:${id}')` completes. If broadcast handlers try to emit to the session room immediately, the socket won't be in the room yet.

#### Implementation Approach

**Backend Changes:**

1. **Await socket.join()** (gmAuth.js:70-84)
```javascript
// BEFORE (current code):
socket.join('gm-stations');

const session = sessionService.getCurrentSession();
if (session) {
  await sessionService.updateDevice(device.toJSON());
  socket.join(`session:${session.id}`);  // ← Not awaited!
}

// AFTER (fixed):
await socket.join('gm-stations');  // Await join

const session = sessionService.getCurrentSession();
if (session) {
  await socket.join(`session:${session.id}`);  // Await BEFORE updateDevice
  await sessionService.updateDevice(device.toJSON());  // Now safe to broadcast
}
```

2. **Add logging** (gmAuth.js)
```javascript
logger.debug('Socket joined rooms', {
  deviceId: socket.deviceId,
  rooms: ['gm-stations', `session:${session.id}`]
});

await sessionService.updateDevice(device.toJSON());
logger.debug('Device registered, broadcasts will now reach this socket');
```

#### Testing Strategy

**Integration Tests:**

```javascript
// backend/tests/integration/socket-room-timing.test.js
describe('Integration - Socket Room Timing', () => {
  test('Socket in session room before device:connected broadcast', async () => {
    await startServer();
    const session = sessionService.createSession({ name: 'Test' });

    // Connect observer (already in session room)
    const observer = io(socketUrl, { auth: { token: gmToken, deviceId: 'OBSERVER' } });
    await waitForConnection(observer);

    // Track when broadcast reaches observer
    let broadcastReceived = false;
    observer.on('device:connected', (data) => {
      if (data.deviceId === 'GM_TEST') {
        broadcastReceived = true;
      }
    });

    // Connect device (triggers broadcast)
    const device = io(socketUrl, { auth: { token: gmToken, deviceId: 'GM_TEST' } });
    await waitForConnection(device);

    // Verify broadcast received by observer
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(broadcastReceived).toBe(true);

    // Verify device is in session room (can receive room broadcasts)
    const rooms = await io.in(`session:${session.id}`).fetchSockets();
    const deviceInRoom = rooms.some(s => s.id === device.id);
    expect(deviceInRoom).toBe(true);
  });
});
```

#### Estimated Effort

- Backend changes: 1 hour
- Integration tests: 2 hours
- Testing & debugging: 1 hour

**Total: 4 hours**

---

### P1.3: Socket.io Middleware Authentication

**Fixes Issue:** #12 (No Socket.io middleware validation)

#### Problem Statement

Authentication currently happens in the `connection` event handler, not in Socket.io middleware. Invalid tokens still allow the socket to connect, then get disconnected later. This is inefficient and allows malformed sockets.

#### Implementation Approach

**Backend Changes:**

1. **Add middleware** (server.js:40-78)
```javascript
// In createSocketServer()
function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: config.server.cors.origin,
      methods: config.server.cors.methods,
      credentials: true,
    },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Add authentication middleware
  io.use((socket, next) => {
    const { verifyToken } = require('./middleware/auth');
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = verifyToken(token);

      if (!decoded || decoded.role !== 'admin') {
        return next(new Error('Invalid or unauthorized token'));
      }

      // Mark socket as authenticated
      socket.isAuthenticated = true;
      socket.deviceId = socket.handshake.auth.deviceId;
      socket.deviceType = socket.handshake.auth.deviceType || 'gm';
      socket.version = socket.handshake.auth.version || '1.0.0';

      next();

    } catch (error) {
      logger.warn('Socket.io middleware auth failed', {
        error: error.message,
        socketId: socket.id
      });
      next(new Error('Authentication failed'));
    }
  });

  return io;
}
```

2. **Simplify connection handler** (gmAuth.js)
```javascript
// In handleGmIdentify() - remove redundant auth check
async function handleGmIdentify(socket, data, io) {
  try {
    // Validate that socket is pre-authenticated (should always be true now)
    if (!socket.isAuthenticated) {
      // This should never happen if middleware works correctly
      logger.error('Socket not authenticated after middleware', { socketId: socket.id });
      socket.disconnect(true);
      return;
    }

    // ... rest of handler (no auth logic needed)
  } catch (error) {
    // ... error handling
  }
}
```

#### Testing Strategy

**Unit Tests:**

```javascript
// backend/tests/unit/socket-middleware.test.js
describe('Socket.io Middleware Authentication', () => {
  test('Rejects connection with no token', (done) => {
    const socket = io(socketUrl);  // No auth

    socket.on('connect_error', (error) => {
      expect(error.message).toContain('Authentication token required');
      socket.disconnect();
      done();
    });
  });

  test('Rejects connection with invalid token', (done) => {
    const socket = io(socketUrl, { auth: { token: 'invalid' } });

    socket.on('connect_error', (error) => {
      expect(error.message).toContain('Invalid or unauthorized token');
      socket.disconnect();
      done();
    });
  });

  test('Accepts connection with valid token', (done) => {
    const socket = io(socketUrl, { auth: { token: validGmToken } });

    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });
  });
});
```

#### Estimated Effort

- Backend changes: 2 hours
- Unit tests: 1 hour
- Integration tests: 1 hour
- Testing & debugging: 1 hour

**Total: 5 hours**

---

### P1.4: Frontend Socket Cleanup & Stale Event Handlers

**Fixes Issues:** #4 (Old socket not disconnected), #16 (Stale event handlers)

#### Problem Statement

GM Scanner's `createSocketConnection()` doesn't clean up the old socket before creating a new one (orchestratorClient.js:112-139), and `setupEventHandlers()` doesn't remove old listeners before registering new ones (orchestratorClient.js:154-426), creating memory leaks and duplicate event handling.

#### Implementation Approach

**Frontend Changes (ALNScanner submodule):**

1. **Add socket cleanup** (orchestratorClient.js)
```javascript
createSocketConnection(url, token, deviceInfo) {
  // Cleanup old socket first
  if (this.socket) {
    logger.info('Cleaning up old socket before reconnection', {
      oldSocketId: this.socket.id,
      connected: this.socket.connected
    });

    this.socket.removeAllListeners();
    this.socket.disconnect(true);
    this.socket = null;
  }

  this.socket = io(url, {
    auth: {
      token: token,
      deviceId: deviceInfo.stationId,
      deviceType: 'gm',
      version: '1.0.0'
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000
  });

  this.setupEventHandlers();
}
```

2. **Add handler cleanup** (orchestratorClient.js)
```javascript
setupEventHandlers() {
  // Remove all existing handlers first
  if (this.socket) {
    this.socket.removeAllListeners();
  }

  // Now register handlers (existing code)
  this.socket.on('connect', () => { /* ... */ });
  this.socket.on('disconnect', () => { /* ... */ });
  this.socket.on('sync:full', (data) => { /* ... */ });
  // ... 23 more handlers
}
```

3. **Add beforeunload handler** (index.html)
```javascript
// At end of DOMContentLoaded
window.addEventListener('beforeunload', () => {
  if (orchestratorClient?.socket?.connected) {
    logger.info('Page unloading - disconnecting socket');
    orchestratorClient.socket.disconnect(true);
  }
});
```

#### Testing Strategy

**E2E Tests (Playwright):**

```javascript
// backend/tests/e2e/socket-cleanup.spec.js
test('Socket cleanup on page refresh', async ({ page }) => {
  await page.goto('https://localhost:3000/gm-scanner/');
  await page.fill('#password', process.env.ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for connection
  await page.waitForFunction(() => window.orchestratorClient?.connected);

  // Get socket ID
  const socketId1 = await page.evaluate(() => window.orchestratorClient.socket.id);

  // Refresh page
  await page.reload();

  // Wait for new connection
  await page.fill('#password', process.env.ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.orchestratorClient?.connected);

  // Get new socket ID
  const socketId2 = await page.evaluate(() => window.orchestratorClient.socket.id);

  // Verify different sockets (old one was cleaned up)
  expect(socketId1).not.toBe(socketId2);

  // Verify only one socket on server
  const serverSockets = await page.evaluate(async () => {
    const response = await fetch('https://localhost:3000/api/admin/sockets');
    const data = await response.json();
    return data.count;
  });

  expect(serverSockets).toBe(1);  // Not 2!
});
```

#### Estimated Effort

- Frontend changes: 2 hours
- E2E tests: 2 hours
- Testing & debugging: 2 hours

**Total: 6 hours**

---

## Phase 3: Polish & ESP32 (P2-P3)

**Goal:** Address remaining issues, UX improvements, ESP32 optimizations
**Timeline:** Week 4+
**Estimated Effort:** 25-35 hours

### P2.1: Player Scanner Improvements

**Fixes Issues:** #9 (No exponential backoff), #14 (Constructor race), #15 (Unchecked retry counts)

#### Implementation Approach

1. **Add exponential backoff** (orchestratorIntegration.js)
```javascript
async retryWithBackoff(fn, maxRetries = 6) {
  const delays = [1000, 2000, 4000, 8000, 16000, 30000];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delay = delays[attempt];
      logger.info(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

2. **Fix constructor race** (orchestratorIntegration.js:11-32)
```javascript
constructor() {
  // Compute isStandalone FIRST
  this.isStandalone = (
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('github.io')
  );

  // THEN detect orchestrator (only if networked)
  if (!this.isStandalone) {
    this.orchestratorUrl = this.detectOrchestratorUrl();
  } else {
    this.orchestratorUrl = null;
  }

  // ... rest of constructor
}
```

3. **Track retry counts** (orchestratorIntegration.js:124)
```javascript
queueScan(tokenId, teamId) {
  const queueItem = {
    tokenId,
    teamId,
    timestamp: new Date().toISOString(),
    deviceId: this.deviceId,
    retryCount: 0  // Initialize
  };

  this.offlineQueue.push(queueItem);
  this.saveQueue();
}

async processQueue() {
  const MAX_RETRIES = 5;

  while (this.offlineQueue.length > 0) {
    const item = this.offlineQueue[0];

    // Check retry limit
    if (item.retryCount >= MAX_RETRIES) {
      logger.error('Max retries exceeded, dropping scan', {
        tokenId: item.tokenId,
        retries: item.retryCount
      });
      this.offlineQueue.shift();  // Drop item
      this.saveQueue();
      continue;
    }

    try {
      await this.submitScan(item.tokenId, item.teamId);
      this.offlineQueue.shift();  // Success
      this.saveQueue();
    } catch (error) {
      item.retryCount++;  // Increment
      this.saveQueue();
      throw error;  // Trigger backoff
    }
  }
}
```

#### Estimated Effort

- Frontend changes: 3 hours
- Unit tests: 1.5 hours
- Testing & debugging: 1.5 hours

**Total: 6 hours**

---

### P2.2: GM Scanner UX Improvements

**Fixes Issues:** #10 (Token not refreshed), #13 (Unconditional reconnection)

#### Implementation Approach

1. **Token refresh** (connectionManager.js)
```javascript
startTokenRefreshTimer() {
  // JWT expires in 24h, refresh 1h before
  const refreshInterval = 23 * 60 * 60 * 1000;  // 23 hours

  this.tokenRefreshTimer = setInterval(async () => {
    try {
      logger.info('Refreshing JWT token (proactive)');

      const response = await fetch(`${this.orchestratorUrl}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: this.password })
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        logger.info('Token refreshed successfully');
      } else {
        logger.warn('Token refresh failed, will retry');
      }
    } catch (error) {
      logger.error('Token refresh error', error);
    }
  }, refreshInterval);
}
```

2. **Conditional reconnection** (index.html:1873-1879)
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing initialization

  // Only initialize connection manager if networked mode
  const gameMode = localStorage.getItem('gameSessionMode') || 'standalone';

  if (gameMode === 'networked') {
    connectionManager = new ConnectionManager();
    await connectionManager.initialize();
  } else {
    logger.info('Standalone mode - skipping connection manager');
  }
});
```

#### Estimated Effort

- Frontend changes: 3 hours
- Testing: 1 hour

**Total: 4 hours**

---

### P2.3: ESP32 Optimizations

**Fixes Issues:** #18 (No persistent connections), #19 (Certificate validation), #20-23 (Minor improvements)

#### Implementation Approach

1. **Connection pooling** (OrchestratorService.h)
```cpp
class HTTPHelper {
private:
    WiFiClientSecure _secureClient;
    HTTPClient _client;  // Reusable client

public:
    HTTPHelper() {
        _secureClient.setInsecure();
        _client.setReuse(true);  // Enable connection reuse
    }

    void configureClient(const String& url, uint32_t timeoutMs) {
        if (!_client.connected()) {
            if (url.startsWith("https://")) {
                _client.begin(_secureClient, url);
            } else {
                _client.begin(url);
            }
        }
        _client.setTimeout(timeoutMs);
    }
};
```

2. **Certificate pinning** (OrchestratorService.h)
```cpp
// In config.txt
ORCHESTRATOR_CERT_FINGERPRINT=AA:BB:CC:DD:...

// In HTTPHelper
void setCertificateFingerprint(const String& fingerprint) {
    _secureClient.setFingerprint(fingerprint.c_str());
}
```

3. **WiFi timeout reduction** (OrchestratorService.cpp)
```cpp
// Change timeout from 10s to 5s
while (WiFi.status() != WL_CONNECTED &&
       millis() - startTime < 5000) {  // 5s instead of 10s
    delay(500);
}

if (WiFi.status() != WL_CONNECTED) {
    LOG_ERROR("[ORCH-WIFI] Connection timeout, will retry\n");
    return false;
}
```

4. **Atomic queue writes** (OrchestratorService.cpp)
```cpp
bool OrchestratorService::queueScan(const models::ScanData& scan) {
    // Write to temp file first
    File tempFile = SD.open("/queue.tmp", FILE_WRITE);
    if (!tempFile) return false;

    // Copy existing queue
    File queueFile = SD.open(queue_config::QUEUE_FILE, FILE_READ);
    if (queueFile) {
        while (queueFile.available()) {
            tempFile.write(queueFile.read());
        }
        queueFile.close();
    }

    // Append new entry
    JsonDocument doc;
    doc["tokenId"] = scan.tokenId;
    doc["deviceId"] = scan.deviceId;
    doc["timestamp"] = scan.timestamp;

    serializeJson(doc, tempFile);
    tempFile.println();
    tempFile.close();

    // Atomic rename
    SD.remove(queue_config::QUEUE_FILE);
    SD.rename("/queue.tmp", queue_config::QUEUE_FILE);

    return true;
}
```

#### Estimated Effort

- ESP32 changes: 8 hours
- Testing on hardware: 4 hours
- Certificate setup documentation: 2 hours

**Total: 14 hours**

---

## Testing Strategy Summary

### Test Coverage Requirements

**Unit Tests (Target: 85%+ coverage):**
- Session model (scannedTokensByDevice, updateDevice with previousStatus)
- Transaction service (duplicate detection, batch processing)
- Broadcast listeners (setup, cleanup, re-initialization)
- Queue managers (ACK handling, retry logic)

**Contract Tests (100% coverage required):**
- AsyncAPI: All new events (batch:ack, updated sync:full, device:connected with isReconnection)
- OpenAPI: Duplicate detection responses (409 Conflict)

**Integration Tests:**
- End-to-end reconnection flows
- Offline queue upload with ACK
- Server restart with state restoration
- Multiple device connections

**E2E Tests (Playwright):**
- GM Scanner page refresh with scannedTokens restoration
- Device reconnection UI updates
- Offline queue processing
- Socket cleanup verification

### Continuous Integration

**Pre-merge Requirements:**
- All tests passing
- No new ESLint warnings
- Contract validation passing
- Code coverage >85%

**Test Execution Time Targets:**
- Unit + Contract: <30s (parallel execution)
- Integration: <5 min (sequential, with cleanup)
- E2E: <5 min (2 workers)
- Full suite: <11 min

---

## Risk Assessment

### High Risk Items

1. **Server-Side Duplicate Detection (P0.1)**
   - **Risk:** Breaking change to scoring logic
   - **Mitigation:**
     - Feature flag: `ENABLE_SERVER_DUPLICATE_DETECTION=true`
     - Migration script for existing sessions
     - Extensive integration tests with real token data

2. **Initialization Order Change (P0.3)**
   - **Risk:** Could break startup in production
   - **Mitigation:**
     - Defensive checks (throw error if wrong order)
     - Comprehensive startup tests
     - Canary deployment (test on staging first)

3. **Session Model Changes (P0.1)**
   - **Risk:** Corrupt existing session files
   - **Mitigation:**
     - Backward-compatible migration
     - Backup existing sessions before upgrade
     - Rollback plan documented

### Medium Risk Items

4. **Socket.io Middleware (P1.3)**
   - **Risk:** Could reject valid clients if middleware has bugs
   - **Mitigation:**
     - Extensive auth tests
     - Gradual rollout (test with single GM first)

5. **Frontend Socket Cleanup (P1.4)**
   - **Risk:** Requires coordinated submodule update
   - **Mitigation:**
     - Update ALNScanner submodule in same PR
     - Test both old and new clients against new backend

### Low Risk Items

6. **ESP32 Changes (P2.3)**
   - **Risk:** Hardware-specific, hard to test in CI
   - **Mitigation:**
     - Manual testing on real hardware
     - Provide fallback config for old firmware

---

## Deployment Plan

### Week 1-2: Phase 1 (P0)

**Branch:** `feature/critical-data-integrity`

**Changes:**
- P0.1: Server-side duplicate detection + sync:full restoration
- P0.2: Offline queue acknowledgment pattern
- P0.3: Service initialization order fix
- P0.4: Missing cleanup call

**Deployment Steps:**
1. Create feature branch from main
2. Implement + test each P0 issue sequentially
3. Update contracts (AsyncAPI)
4. Run full test suite (unit + contract + integration + E2E)
5. PR review with focus on data integrity
6. Merge to main
7. Deploy to staging Raspberry Pi
8. Smoke test with real scanners (1 GM, 1 Player)
9. Backup production session files
10. Deploy to production
11. Monitor logs for 24h

**Rollback Plan:**
- Revert commits
- Restore session backup
- Restart services with PM2

**Success Criteria:**
- Zero duplicate scans after GM Scanner refresh
- Offline queue uploads with 0% data loss
- Early connections receive sync:full
- Tests pass in CI

### Week 3: Phase 2 (P1)

**Branch:** `feature/connection-stability`

**Changes:**
- P1.1: Device reconnection broadcast fix
- P1.2: Socket join ordering fix
- P1.3: Socket.io middleware authentication
- P1.4: Frontend socket cleanup

**Deployment Steps:**
1. Create feature branch from main
2. Implement backend changes first
3. Update ALNScanner submodule (P1.4)
4. Test with mixed client versions (old + new)
5. PR review
6. Merge to main
7. Deploy backend to production
8. Update GM Scanners (refresh to load new frontend)

**Success Criteria:**
- Reconnecting devices show "connected" status
- No ghost connections
- WebSocket middleware rejects invalid tokens

### Week 4+: Phase 3 (P2-P3)

**Branches:** Multiple feature branches

**Changes:**
- P2.1-P2.2: Player Scanner + GM Scanner UX improvements
- P2.3: ESP32 optimizations

**Deployment Steps:**
- Gradual rollout (non-breaking changes)
- ESP32 updates via SD card firmware deployment

---

## Effort Summary

| Phase | Priority | Issues | Estimated Hours | Timeline |
|-------|----------|--------|----------------|----------|
| Phase 1: Critical Data Integrity | P0 | 4 issues (#1, #3, #5, #6, #7) | 16-20 hours | Week 1-2 |
| Phase 2: Connection Stability | P1 | 6 issues (#2, #4, #8, #11, #12, #16) | 14-18 hours | Week 3 |
| Phase 3: Polish & ESP32 | P2-P3 | 13 issues (#9, #10, #13-15, #18-23) | 25-35 hours | Week 4+ |
| **TOTAL** | | **23 issues** | **55-73 hours** | **3-5 weeks** |

**Recommendation:** Allocate **60 hours** (7.5 developer days) with 10% buffer for unexpected issues.

---

## Conclusion

### Audit Quality Assessment: ✅ EXCELLENT

The audit documents are **thorough, accurate, and well-researched**. Code review confirms:
- 21/23 issues validated (2 require submodule verification)
- Root cause analysis is correct
- Severity ratings are appropriate
- Recommended fixes are sound

### Implementation Approach: Testing-Driven

This plan prioritizes:
1. **Data integrity** (P0) - Prevent duplicate scans, data loss
2. **Connection stability** (P1) - Fix reconnection, race conditions
3. **Polish & optimization** (P2-P3) - UX improvements, ESP32 enhancements

### Key Success Factors

1. **Comprehensive Testing:** Unit + Contract + Integration + E2E coverage
2. **Gradual Rollout:** Phase 1 → Phase 2 → Phase 3 with validation at each stage
3. **Backward Compatibility:** Support old clients during transition
4. **Monitoring:** Watch logs after each deployment
5. **Rollback Ready:** Backup sessions, revert plan documented

### Next Steps

1. ✅ Review and approve this plan
2. ⚠️ Verify Issues #4 and #8 in ALNScanner submodule
3. 🚀 Begin Phase 1 implementation on branch `feature/critical-data-integrity`
4. 📝 Update CLAUDE.md with new testing patterns
5. 🎯 Target: Phase 1 deployed by end of Week 2

---

**Prepared by:** Claude Code
**Date:** 2025-11-05
**Status:** Ready for Implementation
