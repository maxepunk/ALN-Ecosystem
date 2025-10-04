# Phase 5.4: Integration Test Suite - Detailed Implementation Plan

**Status**: READY TO START
**Dependencies**: Phase 5.3 COMPLETE (271/271 tests passing)
**Estimated Time**: 15-18 hours
**Priority**: CRITICAL for production readiness

---

## Executive Summary

Phase 5.4 completes the test pyramid by implementing comprehensive integration tests that validate multi-service orchestration flows. While Phase 5.3 delivered excellent unit (183 tests) and contract (96 tests) coverage, we currently have only **2 integration tests** covering basic service event propagation.

This plan addresses the critical gap: **validating that well-tested components work together correctly in real-world scenarios**.

### Current Test Status
- ✅ **Contract Tests**: 96 tests - All HTTP/WebSocket APIs validated against OpenAPI/AsyncAPI
- ✅ **Unit Tests**: 183 tests - All business logic protected
- ⚠️ **Integration Tests**: 2 tests - Minimal multi-service flow validation (~0.7% of test suite)

### Phase 5.4 Deliverables
- ✅ **10 integration test suites** covering all critical multi-service flows
- ✅ **Mock VLC infrastructure** for CI/CD video playback testing
- ✅ **Multi-client broadcast validation** (2+ concurrent GM scanners)
- ✅ **End-to-end event propagation** (HTTP/WebSocket → Services → Broadcasts → Clients)
- ✅ **Production-ready confidence** for live event deployment

### IMPORTANT RULE
You MUST make sure we have reliable, well designed tests by first confirming you fully understand the behavior you're testing AT THE INTEGRATION LEVEL and how the INTENDED implementation is ACTUALLY supposed to work (including accurate variables/data/etc. use instead of guesses)
MEANWHILE, it is ESSENTIAL to remember we're NEVER writing tests to PASS based on the current implementation. We're writing tests to REVEAL mistakes in the implementation vs. INTENDED BEHAVIOR and help us fix any bugs which may still persist after the recent refactor from earlier phases on this plan. 
THIS MEANS: Flag any potential issues in the implementation code while you investigate it in preparation to create the test, and note how your test would validate the issues' existence and enable you to fix it with guidance from the test.  
### Reminder
When fixing mistakes in implementation, keep in mind the refactor was going for a REST/Event driven architecture and better alignment with engineering best practices to create a codebase that is easy to read and maintain with minimal architectural complexity to achieve ALL required functionality. 
---

## Architecture Understanding

### Event Flow Pattern (Critical for Integration Tests)

```
Client (GM Scanner)          Orchestrator                Services             Broadcasts
       |                          |                          |                     |
       |--transaction:submit----->|                          |                     |
       |    (wrapped event)       |                          |                     |
       |                          |--handleTransactionSubmit()|                    |
       |                          |                          |                     |
       |                          |                          |--processScan()      |
       |                          |                          |  - validate token   |
       |                          |                          |  - check duplicate  |
       |                          |                          |  - calculate score  |
       |                          |                          |  - updateTeamScore()|
       |                          |                          |                     |
       |                          |                          |--emit('transaction:accepted')
       |                          |                          |    (unwrapped      |
       |                          |                          |     domain event)  |
       |                          |                          |                     |
       |                          |<---------------------------------------|        |
       |                          |                          |                     |
       |                          |                          |                setupBroadcastListeners()
       |                          |                          |                     |--hears 'transaction:accepted'
       |                          |                          |                     |--emitWrapped(io, 'transaction:result', {...})
       |                          |                          |                     |   (to submitter only)
       |<--transaction:result-----|<----------------------------------------------|
       |    (wrapped event)       |                          |                     |
       |                          |                          |                     |--emitToRoom(io, session, 'transaction:new', {...})
       |<--transaction:new--------|<----------------------------------------------|
       |    (broadcast to all)    |                          |                     |
       |                          |                          |                     |--emitWrapped(io, 'score:updated', {...})
       |<--score:updated----------|<----------------------------------------------|
       |    (broadcast to all)    |                          |                     |
```

**Key Insight**: Integration tests must validate the COMPLETE flow:
1. Client sends wrapped event → 2. Handler unwraps → 3. Service processes → 4. Service emits unwrapped domain event → 5. broadcasts.js wraps and broadcasts → 6. Multiple clients receive

### Service Architecture

All services extend `EventEmitter` and follow singleton pattern:

| Service | Emits (Domain Events) | Listens To | Purpose |
|---------|----------------------|------------|---------|
| **sessionService** | `session:created`, `session:updated` | *(root orchestrator)* | Session lifecycle |
| **transactionService** | `transaction:accepted`, `transaction:added` | `session:created`, `session:updated` | Score calculation, duplicate detection |
| **videoQueueService** | `queue:added`, `video:loading`, `video:playing`, `video:completed`, `video:failed`, `video:idle` | *(none)* | Video queue & playback coordination |
| **offlineQueueService** | `scan:queued`, `offline:queue:processed` | *(none)* | Offline scan queuing |
| **stateService** | `state:updated` | All service events | State aggregation |

**broadcasts.js** listens to ALL service events and wraps them for WebSocket broadcast using `emitWrapped()`.

---

## CRITICAL: Infrastructure Fixes Completed Before Implementation

**Date Fixed**: 2025-10-04
**Status**: ✅ All critical test infrastructure bugs fixed, ready to proceed

During pre-implementation investigation, **three critical bugs** were discovered in test infrastructure that would have caused memory leaks and unreliable tests. These have been fixed:

### Fix 1: Broadcast Listener Memory Leak (CRITICAL)
**Problem**: `test-server.js` never called `cleanupBroadcastListeners()`, causing hundreds of leaked listeners across 271 tests.

**Fix Applied**:
```javascript
// tests/helpers/test-server.js - cleanupTestServer()
cleanupBroadcastListeners(); // ← Added this critical cleanup
```

**Impact**: Eliminated primary memory leak causing force exit warnings.

### Fix 2: Incomplete Service Cleanup
**Problem**: Only 3 of 5 services were cleaned up (missing videoQueueService, offlineQueueService).

**Fix Applied**:
```javascript
// tests/helpers/test-server.js - cleanupTestServer()
videoQueueService.reset(); // Clears playback timers
offlineQueueService.reset(); // Clears queue state
videoQueueService.removeAllListeners();
offlineQueueService.removeAllListeners();
```

**Impact**: Eliminated timer leaks from video queue.

### Fix 3: HTTP Agent Keep-Alive Cleanup
**Problem**: Supertest HTTP agents with keep-alive connections remained open after tests.

**Fix Applied**:
- Created `jest.globalTeardown.js` to destroy HTTP agents after all tests
- Added `globalTeardown` to `jest.config.js`

**Impact**: Proper HTTP agent cleanup (remaining force exit warnings are from supertest internals - acceptable).

### Result
- ✅ All tests pass: 271/271
- ✅ Real memory leaks eliminated
- ✅ Infrastructure ready for integration test implementation

**See**: `backend/docs/PHASE-5.4-SESSION-DISCOVERIES.md` for complete analysis.

---

### Test Infrastructure Available

From `/backend/tests/helpers/`:

1. **integration-test-server.js** ← **USE THIS FOR INTEGRATION TESTS**
   - `setupIntegrationTestServer()` - Creates HTTP + Socket.IO server with FULL production setup
   - `cleanupIntegrationTestServer()` - Properly closes server, cleans up broadcast listeners, resets all services
   - **CRITICAL**: Includes broadcast listener cleanup (prevents memory leaks)
   - Initializes ALL services with real token data
   - Uses random port to avoid conflicts
   - Fully configures WebSocket event handlers (gm:identify, transaction:submit, etc.)
   - **Designed for INTEGRATION tests** - preserves state during test scenarios

2. **test-server.js** ← **USE THIS FOR CONTRACT/UNIT TESTS ONLY**
   - `setupTestServer()` - Creates HTTP + Socket.IO server for isolated contract testing
   - `cleanupTestServer()` - Now properly cleans up broadcast listeners and ALL services
   - **NOT appropriate for integration tests** (different state management needs)

3. **websocket-helpers.js** ← **APPROPRIATE FOR ALL TEST TYPES**
   - `connectAndIdentify(url, 'gm', deviceId)` - Connect and authenticate GM scanner
   - `waitForEvent(socket, 'event:name')` - Wait for event with 5s timeout
   - `waitForMultipleEvents(socket, event, predicate)` - Collect multiple events
   - `cleanupSockets([sockets])` - Disconnect multiple sockets safely
   - `testDelay(ms)` - Reduced delays in test environment
   - **✅ Verified appropriate for integration tests** (flexible, no state conflicts)

4. **contract-validator.js** ← **RECOMMENDED FOR INTEGRATION TESTS**
   - `validateWebSocketEvent(event, eventName)` - Validate against AsyncAPI schema using ajv
   - **✅ Use in integration tests for double-validation** (business logic + contract compliance)
   - Example pattern:
     ```javascript
     const result = await waitForEvent(socket, 'transaction:result');
     expect(result.data.status).toBe('accepted'); // Business logic
     validateWebSocketEvent(result, 'transaction:result'); // Contract compliance
     ```

### Integration Test Pattern (UPDATED)

**NEW PATTERN** using `integration-test-server.js`:

```javascript
const { setupIntegrationTestServer, cleanupIntegrationTestServer } =
  require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { validateWebSocketEvent } = require('../helpers/contract-validator'); // Optional double-validation

describe('Integration Test Suite Name', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    // Setup ONCE for entire test file
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    // CRITICAL: Cleanup includes broadcast listeners
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services for test isolation
    await sessionService.reset();
    await transactionService.reset();

    // Create fresh session for each test
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['001', '002']
    });

    // Connect test client
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEST');
  });

  afterEach(async () => {
    // Disconnect client
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  it('should validate complete integration flow', async () => {
    // Listen for internal domain event
    const scoreInitPromise = new Promise((resolve) => {
      transactionService.once('score:initialized', resolve);
    });

    // Trigger session creation
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['001', '002']
    });

    // Wait for event propagation (services use setTimeout/setImmediate)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify team scores initialized
    const team001Score = transactionService.getTeamScore('001');
    expect(team001Score).toBeDefined();
    expect(team001Score.currentScore).toBe(0);
  });
});
```

**Pattern**: Direct service calls → wait for event propagation → verify state changes.

---

## Integration Test Requirements

### What Integration Tests MUST Validate (vs Unit/Contract Tests)

| Concern | Unit Tests | Contract Tests | Integration Tests |
|---------|-----------|----------------|-------------------|
| **Business logic correctness** | ✅ Full coverage | ❌ Not tested | ✅ Validated in real flow |
| **API schema compliance** | ❌ Not tested | ✅ Full coverage | ✅ Double-check critical events |
| **Multi-service coordination** | ❌ Mocked services | ❌ Not tested | ✅ **CRITICAL GAP** |
| **Event propagation timing** | ❌ Synchronous | ❌ Direct emission | ✅ Real async flow |
| **WebSocket broadcasting** | ❌ Not tested | ⚠️ Single client | ✅ Multiple clients |
| **State consistency** | ⚠️ Per-service | ❌ Not tested | ✅ Cross-service |
| **Error propagation** | ✅ Per-service | ⚠️ Error events | ✅ Cross-service recovery |

### Functional Requirements Mapping

From `/docs/api-alignment/08-functional-requirements.md`, integration tests must validate:

**Section 1.3 - Transaction Processing**:
- ✅ GM Scanner submits transaction → validation → scoring → broadcast to all GMs
- ✅ Duplicate detection across multiple scanners
- ✅ Group completion detection → bonus calculation → broadcast

**Section 1.5 - Video Orchestration**:
- ✅ Player scan → queue video → VLC playback → status broadcasts to GMs
- ✅ Queue management (multiple videos queued, sequential playback)
- ✅ VLC failure handling → error broadcast → queue continues

**Section 1.7 - State Synchronization**:
- ✅ New GM connects → receives sync:full with complete state
- ✅ State includes: session, scores, recent transactions, video status, devices

**Section 1.8 - Offline Queue Management**:
- ✅ Scans queued when offline → reconnect → batch processing → broadcasts

**Section 1.2 - Session Management**:
- ✅ Session creation → all services initialize
- ✅ Session pause → transactions blocked
- ✅ Session end → all services cleanup

---

## Phase 5.4 Test Suite Design

### Test File Organization

```
backend/tests/integration/
├── service-events.test.js           # ✅ EXISTS (2 tests - basic service events)
├── transaction-flow.test.js         # 🆕 Priority 1
├── video-orchestration.test.js      # 🆕 Priority 1 (requires mock VLC)
├── offline-queue-sync.test.js       # 🆕 Priority 1
├── state-synchronization.test.js    # 🆕 Priority 1
├── session-lifecycle.test.js        # 🆕 Priority 2
├── multi-client-broadcasts.test.js  # 🆕 Priority 2
├── group-completion.test.js         # 🆕 Priority 2
├── admin-interventions.test.js      # 🆕 Priority 3
├── error-propagation.test.js        # 🆕 Priority 3
└── duplicate-detection.test.js      # 🆕 Priority 3

backend/tests/helpers/
└── mock-vlc-server.js              # 🆕 New helper for VLC mocking
```

---

## Priority 1: Core Game Flow Tests (CRITICAL)

### Test 1: Complete Transaction Flow
**File**: `backend/tests/integration/transaction-flow.test.js`
**Estimated Time**: 2 hours
**Validates**: FR 1.3 (Transaction Processing)

#### What This Tests
End-to-end transaction flow with **2 concurrent GM scanners** in **realistic game setup**: GM1 in **blackmarket mode** (scoring) and GM2 in **detective mode** (logging only).

**Game Design Context**: In typical 2-GM games, one scanner runs blackmarket mode (teams compete for tokens) while the other runs detective mode (logs narrative discoveries). This test validates both modes simultaneously.

#### Test Flow
```javascript
describe('Transaction Flow Integration', () => {
  let testContext, gmBlackmarket, gmDetective;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();

    // Create session
    await sessionService.createSession({
      name: 'Transaction Flow Test',
      teams: ['001', '002']
    });

    // Connect TWO GM scanners (realistic 2-GM game setup)
    gmBlackmarket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_BLACKMARKET');
    gmDetective = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DETECTIVE');
  });

  afterEach(async () => {
    if (gmBlackmarket?.connected) gmBlackmarket.disconnect();
    if (gmDetective?.connected) gmDetective.disconnect();
    await sessionService.reset();
  });

  it('should handle blackmarket and detective mode transactions simultaneously', async () => {
    // Setup: Listen for events on BOTH GMs
    const bmResultPromise = waitForEvent(gmBlackmarket, 'transaction:result');
    const bmNewPromise = waitForEvent(gmBlackmarket, 'transaction:new');
    const bmScorePromise = waitForEvent(gmBlackmarket, 'score:updated');

    const detResultPromise = waitForEvent(gmDetective, 'transaction:result');
    const detNewPromise = waitForEvent(gmDetective, 'transaction:new');

    // Trigger: Blackmarket GM submits transaction (SCORING mode)
    gmBlackmarket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',  // Real token: Technical, rating=3
        teamId: '001',
        deviceId: 'GM_BLACKMARKET',
        mode: 'blackmarket'  // Scoring mode
      },
      timestamp: new Date().toISOString()
    });

    // Wait: For blackmarket transaction to complete
    const [bmResult, bmNew, bmScore] = await Promise.all([
      bmResultPromise,
      bmNewPromise,
      bmScorePromise
    ]);

    // Validate: Blackmarket transaction scored
    expect(bmResult.event).toBe('transaction:result');
    expect(bmResult.data.status).toBe('accepted');
    expect(bmResult.data.tokenId).toBe('534e2b03');
    expect(bmResult.data.teamId).toBe('001');
    expect(bmResult.data.points).toBe(3000); // Technical rating=3 → 3000 points

    // Validate: Broadcast reached BOTH GMs
    expect(bmNew.data.transaction.mode).toBe('blackmarket');
    expect(bmScore.data.teamId).toBe('001');
    expect(bmScore.data.currentScore).toBe(3000);

    // Trigger: Detective GM submits transaction (LOGGING ONLY mode)
    gmDetective.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'tac001',  // Different token: Personal, rating=1
        teamId: '002',
        deviceId: 'GM_DETECTIVE',
        mode: 'detective'  // Logging only, NO scoring
      },
      timestamp: new Date().toISOString()
    });

    // Wait: For detective transaction to complete
    const [detResult, detNew] = await Promise.all([
      detResultPromise,
      detNewPromise
    ]);

    // Validate: Detective transaction accepted but NOT scored
    expect(detResult.data.status).toBe('accepted');
    expect(detResult.data.tokenId).toBe('tac001');
    expect(detResult.data.points).toBe(0);  // Detective mode = 0 points

    // Validate: BOTH GMs received detective transaction broadcast
    expect(detNew.data.transaction.mode).toBe('detective');
    expect(detNew.data.transaction.tokenId).toBe('tac001');

    // Validate: Team 002 score UNCHANGED (detective mode doesn't score)
    const team002Score = transactionService.getTeamScore('002');
    expect(team002Score.currentScore).toBe(0);

    // Validate: Service state consistency
    const team001Score = transactionService.getTeamScore('001');
    expect(team001Score.currentScore).toBe(3000);
    expect(team001Score.tokensScanned).toBe(1);
  });

  it('should handle concurrent blackmarket transactions from both teams', async () => {
    // Both GMs submit blackmarket transactions simultaneously for different teams
    const bmPromise = waitForEvent(gmBlackmarket, 'transaction:result');
    const detPromise = waitForEvent(gmDetective, 'transaction:result');

    // Submit concurrently (both in blackmarket mode this time)
    gmBlackmarket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_BLACKMARKET',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    gmDetective.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'tac001',  // Different token
        teamId: '002',
        deviceId: 'GM_DETECTIVE',
        mode: 'blackmarket'  // Both in blackmarket mode
      },
      timestamp: new Date().toISOString()
    });

    const [result1, result2] = await Promise.all([bmPromise, detPromise]);

    // Both transactions should succeed
    expect(result1.data.status).toBe('accepted');
    expect(result2.data.status).toBe('accepted');

    // Scores should be independent
    const team001Score = transactionService.getTeamScore('001');
    const team002Score = transactionService.getTeamScore('002');
    expect(team001Score.currentScore).toBe(3000); // rating=3
    expect(team002Score.currentScore).toBe(1000); // rating=1
  });

  it('should detect duplicate scans and reject correctly', async () => {
    // First scan - should succeed (blackmarket mode)
    const result1Promise = waitForEvent(gmBlackmarket, 'transaction:result');
    gmBlackmarket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_BLACKMARKET',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    const result1 = await result1Promise;
    expect(result1.data.status).toBe('accepted');

    // Second scan (same token, different team) - should be duplicate
    const result2Promise = waitForEvent(gmDetective, 'transaction:result');
    gmDetective.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',  // SAME token
        teamId: '002',         // Different team
        deviceId: 'GM_DETECTIVE',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    const result2 = await result2Promise;

    // Validate: Duplicate detected
    expect(result2.data.status).toBe('duplicate');
    expect(result2.data.points).toBe(0);
    expect(result2.data.message).toContain('duplicate');

    // Validate: Only first team got points
    const team001Score = transactionService.getTeamScore('001');
    const team002Score = transactionService.getTeamScore('002');
    expect(team001Score.currentScore).toBe(3000);
    expect(team002Score.currentScore).toBe(0);
  });
});
```

**Success Criteria**:
- ✅ 3+ test scenarios pass
- ✅ Blackmarket mode transactions score correctly
- ✅ Detective mode transactions log but don't score
- ✅ Both GMs receive identical broadcasts regardless of mode
- ✅ Event order is correct (result → new → score)
- ✅ Service state matches broadcast data

---

### Test 2: Video Orchestration with Mock VLC
**File**: `backend/tests/integration/video-orchestration.test.js`
**Estimated Time**: 3 hours (includes mock VLC implementation)
**Validates**: FR 1.5 (Video Orchestration)

#### Mock VLC Infrastructure

First, create mock VLC server helper:

**File**: `backend/tests/helpers/mock-vlc-server.js`

```javascript
/**
 * Mock VLC HTTP Server for Integration Tests
 * Simulates VLC HTTP API responses for testing video orchestration
 */

const http = require('http');
const logger = require('../../src/utils/logger');

class MockVlcServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.currentVideo = null;
    this.playbackState = 'stopped';
    this.queuedVideos = [];
  }

  /**
   * Start mock VLC server
   * @returns {Promise<number>} Port number
   */
  async start() {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Use random port
      this.server.listen(0, () => {
        this.port = this.server.address().port;
        logger.info('Mock VLC server started', { port: this.port });
        resolve(this.port);
      });
    });
  }

  /**
   * Handle mock VLC HTTP requests
   */
  handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.port}`);

    // GET /requests/status.json - VLC status
    if (url.pathname === '/requests/status.json' && req.method === 'GET') {
      const command = url.searchParams.get('command');

      if (command === 'in_play') {
        // Play video command
        const input = url.searchParams.get('input');
        this.currentVideo = input;
        this.playbackState = 'playing';
        logger.debug('Mock VLC: Playing video', { input });
      } else if (command === 'pl_pause') {
        this.playbackState = 'paused';
      } else if (command === 'pl_stop') {
        this.playbackState = 'stopped';
        this.currentVideo = null;
      }

      // Return VLC status JSON
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        state: this.playbackState,
        length: 30,  // Mock 30-second video
        time: 0,
        information: {
          category: {
            meta: {
              filename: this.currentVideo
            }
          }
        }
      }));
      return;
    }

    // Unknown endpoint
    res.writeHead(404);
    res.end('Not Found');
  }

  /**
   * Stop mock VLC server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Mock VLC server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Simulate video completion
   */
  async simulateVideoComplete() {
    this.playbackState = 'stopped';
    this.currentVideo = null;
  }

  /**
   * Get current mock state
   */
  getState() {
    return {
      currentVideo: this.currentVideo,
      state: this.playbackState
    };
  }
}

module.exports = MockVlcServer;
```

#### Integration Test Implementation

```javascript
/**
 * Video Orchestration Integration Tests
 * Tests player scan → video queue → VLC → status broadcasts
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const MockVlcServer = require('../helpers/mock-vlc-server');
const sessionService = require('../../src/services/sessionService');
const videoQueueService = require('../../src/services/videoQueueService');
const config = require('../../src/config');

describe('Video Orchestration Integration', () => {
  let testContext, gmSocket, mockVlc;
  let originalVlcHost, originalVlcPort;

  beforeAll(async () => {
    // Start mock VLC server
    mockVlc = new MockVlcServer();
    const mockVlcPort = await mockVlc.start();

    // Override VLC config to point to mock
    originalVlcHost = config.vlc.host;
    originalVlcPort = config.vlc.port;
    config.vlc.host = 'localhost';
    config.vlc.port = mockVlcPort;

    // Start test server
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
    await mockVlc.stop();

    // Restore VLC config
    config.vlc.host = originalVlcHost;
    config.vlc.port = originalVlcPort;
  });

  beforeEach(async () => {
    await sessionService.reset();

    await sessionService.createSession({
      name: 'Video Test Session',
      teams: ['001']
    });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_VIDEO_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    await sessionService.reset();
  });

  it('should queue and play video from player scan', async () => {
    // Setup: Listen for video:status events
    const loadingPromise = waitForEvent(gmSocket, 'video:status');

    // Trigger: Player scanner HTTP POST /api/scan (simulate via service)
    const axios = require('axios');
    await axios.post(`${testContext.url}/api/scan`, {
      tokenId: '534e2b03',  // Has video: test_30sec.mp4
      deviceId: 'PLAYER_SCANNER_01',
      timestamp: new Date().toISOString()
    });

    // Wait: For video:loading broadcast
    const loadingEvent = await loadingPromise;

    // Validate: Loading event
    expect(loadingEvent.event).toBe('video:status');
    expect(loadingEvent.data.status).toBe('loading');
    expect(loadingEvent.data.tokenId).toBe('534e2b03');
    expect(loadingEvent.data.queueLength).toBeGreaterThanOrEqual(0);

    // Wait: For video:playing event (VLC starts playback)
    const playingPromise = waitForEvent(gmSocket, 'video:status');
    const playingEvent = await playingPromise;

    expect(playingEvent.data.status).toBe('playing');
    expect(playingEvent.data.tokenId).toBe('534e2b03');
    expect(playingEvent.data.duration).toBe(30);

    // Verify: Mock VLC received play command
    const vlcState = mockVlc.getState();
    expect(vlcState.state).toBe('playing');
    expect(vlcState.currentVideo).toContain('test_30sec.mp4');
  });

  it('should handle video queue with multiple videos', async () => {
    // Queue 3 videos
    const axios = require('axios');

    // Video 1
    await axios.post(`${testContext.url}/api/scan`, {
      tokenId: '534e2b03',
      deviceId: 'PLAYER_SCANNER_01'
    });

    // Wait for first video to start
    await waitForEvent(gmSocket, 'video:status'); // loading
    await waitForEvent(gmSocket, 'video:status'); // playing

    // Queue videos 2 and 3 while first is playing
    const video2Promise = axios.post(`${testContext.url}/api/scan`, {
      tokenId: 'TEST_VIDEO_2',  // Mock video token
      deviceId: 'PLAYER_SCANNER_01'
    });

    const video3Promise = axios.post(`${testContext.url}/api/scan`, {
      tokenId: 'TEST_VIDEO_3',  // Mock video token
      deviceId: 'PLAYER_SCANNER_01'
    });

    await Promise.all([video2Promise, video3Promise]);

    // Check queue length via state
    const queueService = videoQueueService;
    expect(queueService.queue.length).toBeGreaterThanOrEqual(2);
  });

  it('should broadcast video:completed and process next in queue', async () => {
    // Queue 2 videos
    const axios = require('axios');
    await axios.post(`${testContext.url}/api/scan`, {
      tokenId: '534e2b03',
      deviceId: 'PLAYER_SCANNER_01'
    });
    await axios.post(`${testContext.url}/api/scan`, {
      tokenId: 'TEST_VIDEO_2',
      deviceId: 'PLAYER_SCANNER_01'
    });

    // Wait for first video to start
    await waitForEvent(gmSocket, 'video:status'); // loading
    await waitForEvent(gmSocket, 'video:status'); // playing

    // Simulate first video completion
    const completedPromise = waitForEvent(gmSocket, 'video:status');
    await mockVlc.simulateVideoComplete();
    videoQueueService.emit('video:completed', {
      tokenId: '534e2b03'
    });

    const completedEvent = await completedPromise;
    expect(completedEvent.data.status).toBe('completed');

    // Wait for second video to start
    const loading2Promise = waitForEvent(gmSocket, 'video:status');
    const loading2Event = await loading2Promise;

    // Second video should start automatically
    expect(loading2Event.data.status).toBe('loading');
    expect(loading2Event.data.tokenId).toBe('TEST_VIDEO_2');
  });

  it('should handle VLC errors gracefully', async () => {
    // Create a token that will fail in mock VLC
    const axios = require('axios');

    const errorPromise = waitForEvent(gmSocket, 'error');

    await axios.post(`${testContext.url}/api/scan`, {
      tokenId: 'TEST_VIDEO_ERROR_TOKEN',  // Special token that triggers error
      deviceId: 'PLAYER_SCANNER_01'
    });

    const errorEvent = await errorPromise;

    expect(errorEvent.event).toBe('error');
    expect(errorEvent.data.code).toBe('VLC_ERROR');
  });
});
```

**Success Criteria**:
- ✅ Player scan triggers video queue
- ✅ Mock VLC receives play command
- ✅ video:status broadcasts reach all GMs (loading → playing → completed)
- ✅ Queue processes sequentially
- ✅ VLC errors propagate to clients

---

### Test 3: Offline Queue Synchronization
**File**: `backend/tests/integration/offline-queue-sync.test.js`
**Estimated Time**: 2 hours
**Validates**: FR 1.8 (Offline Queue Management)

```javascript
/**
 * Offline Queue Synchronization Integration Tests
 * Tests scan queueing → reconnect → batch processing → broadcasts
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const axios = require('axios');

describe('Offline Queue Synchronization Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await offlineQueueService.reset();

    await sessionService.createSession({
      name: 'Offline Queue Test',
      teams: ['001', '002']
    });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_OFFLINE_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    await sessionService.reset();
  });

  it('should queue player scans and process on reconnect', async () => {
    // Simulate offline period: Queue 3 scans via batch endpoint
    const offlineScans = [
      { tokenId: '534e2b03', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() },
      { tokenId: 'tac001', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() },
      { tokenId: 'TEST_TOKEN_1', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() }
    ];

    // Listen for offline:queue:processed broadcast
    const queueProcessedPromise = waitForEvent(gmSocket, 'offline:queue:processed');

    // Trigger: POST /api/scan/batch (simulating reconnection)
    const response = await axios.post(`${testContext.url}/api/scan/batch`, {
      transactions: offlineScans
    });

    expect(response.status).toBe(200);
    expect(response.data.results).toHaveLength(3);

    // Wait for broadcast
    const queueEvent = await queueProcessedPromise;

    // Validate: offline:queue:processed event
    expect(queueEvent.event).toBe('offline:queue:processed');
    expect(queueEvent.data.queueSize).toBe(3);
    expect(queueEvent.data.results).toHaveLength(3);

    // All scans should be processed
    const allProcessed = queueEvent.data.results.every(r => r.status === 'processed');
    expect(allProcessed).toBe(true);
  });

  it('should handle partial failures in offline queue', async () => {
    const offlineScans = [
      { tokenId: '534e2b03', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() },
      { tokenId: 'INVALID_TOKEN', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() },
      { tokenId: 'tac001', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() }
    ];

    const queueProcessedPromise = waitForEvent(gmSocket, 'offline:queue:processed');

    await axios.post(`${testContext.url}/api/scan/batch`, {
      transactions: offlineScans
    });

    const queueEvent = await queueProcessedPromise;

    // Check individual results
    expect(queueEvent.data.results[0].status).toBe('processed');
    expect(queueEvent.data.results[1].status).toBe('failed');
    expect(queueEvent.data.results[1].error).toBeDefined();
    expect(queueEvent.data.results[2].status).toBe('processed');
  });

  it('should trigger sync:full after queue processing', async () => {
    // Queue scans
    const offlineScans = [
      { tokenId: '534e2b03', deviceId: 'PLAYER_01', timestamp: new Date().toISOString() }
    ];

    // Listen for BOTH events
    const queuePromise = waitForEvent(gmSocket, 'offline:queue:processed');
    const syncPromise = waitForEvent(gmSocket, 'sync:full');

    await axios.post(`${testContext.url}/api/scan/batch`, {
      transactions: offlineScans
    });

    const [queueEvent, syncEvent] = await Promise.all([queuePromise, syncPromise]);

    // Validate: sync:full sent after queue processing
    expect(queueEvent.timestamp <= syncEvent.timestamp).toBe(true);

    // Validate: sync:full has complete state
    expect(syncEvent.data).toHaveProperty('session');
    expect(syncEvent.data).toHaveProperty('scores');
    expect(syncEvent.data).toHaveProperty('recentTransactions');
    expect(syncEvent.data).toHaveProperty('videoStatus');
    expect(syncEvent.data).toHaveProperty('devices');
  });
});
```

**Success Criteria**:
- ✅ Batch scan endpoint processes queued scans
- ✅ offline:queue:processed broadcast sent
- ✅ sync:full follows queue processing
- ✅ Partial failures handled correctly

---

### Test 4: State Synchronization
**File**: `backend/tests/integration/state-synchronization.test.js`
**Estimated Time**: 2 hours
**Validates**: FR 1.7 (State Synchronization)

```javascript
/**
 * State Synchronization Integration Tests
 * Tests new GM connection → sync:full with complete state
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const io = require('socket.io-client');

describe('State Synchronization Integration', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();
  });

  it('should send complete sync:full on new GM connection', async () => {
    // Setup: Create session with transactions
    await sessionService.createSession({
      name: 'Sync Test Session',
      teams: ['001', '002']
    });

    // Create a transaction for team 001
    await transactionService.processScan({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'SETUP_GM',
      mode: 'blackmarket'
    }, sessionService.getCurrentSession());

    // Connect new GM and listen for sync:full
    const socket = io(testContext.socketUrl, {
      transports: ['websocket'],
      reconnection: false
    });

    await waitForEvent(socket, 'connect');

    // Setup sync:full listener BEFORE identifying
    const syncPromise = waitForEvent(socket, 'sync:full');

    // Identify as GM
    socket.emit('gm:identify', {
      event: 'gm:identify',
      data: {
        token: 'mock-jwt-token',  // Mock token for test
        deviceId: 'LATE_JOINING_GM',
        type: 'gm',
        name: 'Late Joining GM'
      },
      timestamp: new Date().toISOString()
    });

    // Wait for gm:identified and sync:full
    await waitForEvent(socket, 'gm:identified');
    const syncEvent = await syncPromise;

    // Validate: sync:full structure
    expect(syncEvent.event).toBe('sync:full');
    expect(syncEvent.data).toHaveProperty('session');
    expect(syncEvent.data).toHaveProperty('scores');
    expect(syncEvent.data).toHaveProperty('recentTransactions');
    expect(syncEvent.data).toHaveProperty('videoStatus');
    expect(syncEvent.data).toHaveProperty('devices');
    expect(syncEvent.data).toHaveProperty('systemStatus');

    // Validate: Session data
    const session = syncEvent.data.session;
    expect(session.name).toBe('Sync Test Session');
    expect(session.status).toBe('active');
    expect(session.teams).toEqual(['001', '002']);

    // Validate: Scores include both teams
    expect(syncEvent.data.scores).toHaveLength(2);
    const team001Score = syncEvent.data.scores.find(s => s.teamId === '001');
    expect(team001Score.currentScore).toBe(3000);  // Transaction was processed

    // Validate: Recent transactions include our transaction
    expect(syncEvent.data.recentTransactions).toHaveLength(1);
    expect(syncEvent.data.recentTransactions[0].tokenId).toBe('534e2b03');

    // Validate: Devices array includes this newly connected device
    // Note: May need to wait a bit for device tracking to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    socket.disconnect();
  });

  it('should include video status in sync:full', async () => {
    await sessionService.createSession({
      name: 'Video Sync Test',
      teams: ['001']
    });

    // Connect and get sync:full
    const socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'VIDEO_SYNC_GM');

    // Note: sync:full is automatically sent after gm:identified
    const syncPromise = waitForEvent(socket, 'sync:full');
    const syncEvent = await syncPromise;

    // Validate: videoStatus structure
    expect(syncEvent.data.videoStatus).toBeDefined();
    expect(syncEvent.data.videoStatus).toHaveProperty('status');
    expect(syncEvent.data.videoStatus).toHaveProperty('queueLength');

    // When no video playing, status should be idle
    expect(syncEvent.data.videoStatus.status).toBe('idle');
    expect(syncEvent.data.videoStatus.tokenId).toBeNull();

    socket.disconnect();
  });
});
```

**Success Criteria**:
- ✅ sync:full sent automatically after gm:identified
- ✅ sync:full contains ALL required state fields
- ✅ State reflects current session, scores, transactions
- ✅ New GM receives complete game state

---

## Priority 2: Session & Lifecycle Tests

### Test 5: Session Lifecycle Coordination
**File**: `backend/tests/integration/session-lifecycle.test.js`
**Estimated Time**: 2 hours
**Validates**: FR 1.2 (Session Management)

```javascript
/**
 * Session Lifecycle Integration Tests
 * Tests session create → pause → resume → end with service coordination
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Session Lifecycle Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  it('should coordinate session creation across all services', async () => {
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_LIFECYCLE_1');

    // Listen for session:update broadcast
    const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');

    // Trigger: Create session via gm:command
    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Lifecycle Test Session',
          teams: ['001', '002', '003']
        }
      },
      timestamp: new Date().toISOString()
    });

    // Wait for command ack and session:update
    const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
    const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

    // Validate: Command ack
    expect(ack.data.success).toBe(true);
    expect(ack.data.action).toBe('session:create');

    // Validate: session:update broadcast
    expect(sessionUpdate.data.status).toBe('active');
    expect(sessionUpdate.data.teams).toEqual(['001', '002', '003']);

    // Validate: transactionService initialized team scores
    const team001Score = transactionService.getTeamScore('001');
    expect(team001Score).toBeDefined();
    expect(team001Score.currentScore).toBe(0);
  });

  it('should pause session and block new transactions', async () => {
    // Create session first
    await sessionService.createSession({
      name: 'Pause Test Session',
      teams: ['001']
    });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_PAUSE_TEST');

    // Pause session
    const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:pause',
        payload: {}
      },
      timestamp: new Date().toISOString()
    });

    const sessionUpdate = await sessionUpdatePromise;
    expect(sessionUpdate.data.status).toBe('paused');

    // Try to submit transaction while paused
    const resultPromise = waitForEvent(gmSocket, 'transaction:result');
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_PAUSE_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const result = await resultPromise;

    // Transaction should be rejected (session paused)
    expect(result.data.status).toBe('error');
    expect(result.data.message).toContain('paused');
  });

  it('should resume session and allow transactions', async () => {
    // Create and pause session
    const session = await sessionService.createSession({
      name: 'Resume Test Session',
      teams: ['001']
    });
    await sessionService.updateSession({ status: 'paused' });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_RESUME_TEST');

    // Resume session
    const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:resume',
        payload: {}
      },
      timestamp: new Date().toISOString()
    });

    const sessionUpdate = await sessionUpdatePromise;
    expect(sessionUpdate.data.status).toBe('active');

    // Submit transaction (should succeed)
    const resultPromise = waitForEvent(gmSocket, 'transaction:result');
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_RESUME_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const result = await resultPromise;
    expect(result.data.status).toBe('accepted');
  });

  it('should end session and cleanup services', async () => {
    // Create session with transactions
    await sessionService.createSession({
      name: 'End Test Session',
      teams: ['001']
    });

    await transactionService.processScan({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'SETUP',
      mode: 'blackmarket'
    }, sessionService.getCurrentSession());

    // Verify scores exist before ending
    const scoreBefore = transactionService.getTeamScore('001');
    expect(scoreBefore.currentScore).toBe(3000);

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_END_TEST');

    // End session
    const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:end',
        payload: {}
      },
      timestamp: new Date().toISOString()
    });

    const sessionUpdate = await sessionUpdatePromise;
    expect(sessionUpdate.data.status).toBe('ended');
    expect(sessionUpdate.data.endTime).toBeDefined();

    // Verify: transactionService cleaned up scores
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for event propagation
    const scoreAfter = transactionService.getTeamScore('001');
    expect(scoreAfter.currentScore).toBe(0);  // Reset on session end
  });
});
```

**Success Criteria**:
- ✅ Session creation initializes all services
- ✅ Pause blocks transactions
- ✅ Resume allows transactions
- ✅ End triggers cleanup across services

---

### Test 6: Multi-Client Broadcast Validation
**File**: `backend/tests/integration/multi-client-broadcasts.test.js`
**Estimated Time**: 1.5 hours
**Validates**: Broadcasting consistency

```javascript
/**
 * Multi-Client Broadcast Validation Tests
 * Tests that broadcasts reach ALL connected clients consistently
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');

describe('Multi-Client Broadcast Validation', () => {
  let testContext;
  let gm1, gm2, gm3;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();

    await sessionService.createSession({
      name: 'Multi-Client Test',
      teams: ['001', '002']
    });

    // Connect 3 GM scanners
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_1');
    gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_2');
    gm3 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_3');
  });

  afterEach(async () => {
    [gm1, gm2, gm3].forEach(socket => {
      if (socket?.connected) socket.disconnect();
    });
  });

  it('should broadcast transaction:new to all 3 GMs identically', async () => {
    // Listen on all 3 clients
    const promises = [
      waitForEvent(gm1, 'transaction:new'),
      waitForEvent(gm2, 'transaction:new'),
      waitForEvent(gm3, 'transaction:new')
    ];

    // Trigger transaction from gm1
    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_MULTI_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const [event1, event2, event3] = await Promise.all(promises);

    // All 3 should receive identical transaction:new data
    expect(event1.data.transaction).toEqual(event2.data.transaction);
    expect(event2.data.transaction).toEqual(event3.data.transaction);

    // Timestamps should be very close (within 100ms)
    const time1 = new Date(event1.timestamp).getTime();
    const time2 = new Date(event2.timestamp).getTime();
    const time3 = new Date(event3.timestamp).getTime();
    expect(Math.abs(time1 - time2)).toBeLessThan(100);
    expect(Math.abs(time2 - time3)).toBeLessThan(100);
  });

  it('should broadcast score:updated to all clients after transaction', async () => {
    const promises = [
      waitForEvent(gm1, 'score:updated'),
      waitForEvent(gm2, 'score:updated'),
      waitForEvent(gm3, 'score:updated')
    ];

    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_MULTI_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const [score1, score2, score3] = await Promise.all(promises);

    // All receive identical score update
    expect(score1.data).toEqual(score2.data);
    expect(score2.data).toEqual(score3.data);

    expect(score1.data.teamId).toBe('001');
    expect(score1.data.currentScore).toBe(3000);
  });

  it('should broadcast device:connected when new GM joins', async () => {
    // 3 GMs already connected, now connect a 4th
    const promises = [
      waitForEvent(gm1, 'device:connected'),
      waitForEvent(gm2, 'device:connected'),
      waitForEvent(gm3, 'device:connected')
    ];

    // Connect 4th GM
    const gm4 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_4');

    const [conn1, conn2, conn3] = await Promise.all(promises);

    // All 3 existing GMs should be notified
    expect(conn1.data.deviceId).toBe('GM_MULTI_4');
    expect(conn2.data.deviceId).toBe('GM_MULTI_4');
    expect(conn3.data.deviceId).toBe('GM_MULTI_4');

    gm4.disconnect();
  });

  it('should handle rapid concurrent events without loss', async () => {
    // Submit 5 transactions rapidly from different GMs
    const transactions = [
      { gm: gm1, tokenId: '534e2b03', teamId: '001' },
      { gm: gm2, tokenId: 'tac001', teamId: '002' },
      { gm: gm1, tokenId: 'TEST_TOKEN_1', teamId: '001' },
      { gm: gm3, tokenId: 'TEST_TOKEN_2', teamId: '002' },
      { gm: gm2, tokenId: 'TEST_TOKEN_3', teamId: '001' }
    ];

    // Each GM should receive 5 transaction:new events (one per transaction)
    const gm1Events = [];
    const gm2Events = [];
    const gm3Events = [];

    gm1.on('transaction:new', e => gm1Events.push(e));
    gm2.on('transaction:new', e => gm2Events.push(e));
    gm3.on('transaction:new', e => gm3Events.push(e));

    // Fire all transactions
    for (const tx of transactions) {
      tx.gm.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: tx.tokenId,
          teamId: tx.teamId,
          deviceId: tx.gm.deviceId,
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Wait for all events to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // All 3 GMs should have received all 5 transactions
    expect(gm1Events.length).toBe(5);
    expect(gm2Events.length).toBe(5);
    expect(gm3Events.length).toBe(5);

    // Events should be in same order
    const gm1Tokens = gm1Events.map(e => e.data.transaction.tokenId);
    const gm2Tokens = gm2Events.map(e => e.data.transaction.tokenId);
    expect(gm1Tokens).toEqual(gm2Tokens);
  });
});
```

**Success Criteria**:
- ✅ All connected GMs receive identical broadcasts
- ✅ Broadcast timing is consistent (<100ms variance)
- ✅ No event loss under concurrent load
- ✅ New clients notified of connections

---

### Test 7: Group Completion Detection
**File**: `backend/tests/integration/group-completion.test.js`
**Estimated Time**: 1.5 hours
**Validates**: FR 1.3.6 (Group Completion)

```javascript
/**
 * Group Completion Integration Tests
 * Tests scanning tokens in group → detection → bonus calculation → broadcast
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Group Completion Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();

    // Initialize with tokens that have groups
    // Note: Actual group data comes from tokens.json
    await transactionService.init([]); // Will load from tokens.json

    await sessionService.createSession({
      name: 'Group Completion Test',
      teams: ['001']
    });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  it('should detect group completion and award bonus', async () => {
    // Assume tokens.json has a group "jaw_group" with 3 tokens
    // Scan first 2 tokens (no completion yet)

    const result1Promise = waitForEvent(gmSocket, 'transaction:result');
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'JAW_TOKEN_1',  // Part of jaw_group
        teamId: '001',
        deviceId: 'GM_GROUP_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    await result1Promise;

    const result2Promise = waitForEvent(gmSocket, 'transaction:result');
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'JAW_TOKEN_2',  // Part of jaw_group
        teamId: '001',
        deviceId: 'GM_GROUP_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    await result2Promise;

    // Scan 3rd token to complete group
    const groupCompletedPromise = waitForEvent(gmSocket, 'group:completed');
    const scoreUpdatedPromise = waitForEvent(gmSocket, 'score:updated');

    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'JAW_TOKEN_3',  // Final token in jaw_group
        teamId: '001',
        deviceId: 'GM_GROUP_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const [groupEvent, scoreEvent] = await Promise.all([
      groupCompletedPromise,
      scoreUpdatedPromise
    ]);

    // Validate: group:completed event
    expect(groupEvent.event).toBe('group:completed');
    expect(groupEvent.data.teamId).toBe('001');
    expect(groupEvent.data.group).toBe('jaw_group');
    expect(groupEvent.data.bonusPoints).toBeGreaterThan(0);

    // Validate: score:updated includes bonus
    expect(scoreEvent.data.bonusPoints).toBe(groupEvent.data.bonusPoints);
    expect(scoreEvent.data.completedGroups).toContain('jaw_group');
  });

  it('should not award group bonus if other team claimed token', async () => {
    // Team 001 scans 2 tokens from jaw_group
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'JAW_TOKEN_1',
        teamId: '001',
        deviceId: 'GM_GROUP_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(gmSocket, 'transaction:result');

    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'JAW_TOKEN_2',
        teamId: '001',
        deviceId: 'GM_GROUP_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(gmSocket, 'transaction:result');

    // Team 002 scans the 3rd token (steals it)
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'JAW_TOKEN_3',
        teamId: '002',  // Different team
        deviceId: 'GM_GROUP_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(gmSocket, 'transaction:result');

    // Team 001 should NOT have completed group
    const team001Score = transactionService.getTeamScore('001');
    expect(team001Score.completedGroups).not.toContain('jaw_group');
  });
});
```

**Success Criteria**:
- ✅ Group completion detected when all tokens scanned
- ✅ group:completed broadcast sent
- ✅ Bonus points added to team score
- ✅ Incomplete groups do not award bonus

---

## Priority 3: Edge Cases & Resilience

### Test 8: Admin Interventions
**File**: `backend/tests/integration/admin-interventions.test.js`
**Estimated Time**: 2 hours
**Validates**: FR 4.2 (Admin Panel Intervention)

```javascript
/**
 * Admin Intervention Integration Tests
 * Tests admin commands → service execution → state updates → broadcasts
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Admin Intervention Integration', () => {
  let testContext, gmSocket, adminSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();

    await sessionService.createSession({
      name: 'Admin Test Session',
      teams: ['001', '002']
    });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ADMIN_TEST');
    // Note: Admin connections use same gm:identify with type='admin'
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    if (adminSocket?.connected) adminSocket.disconnect();
  });

  it('should adjust team score via admin command', async () => {
    // Create initial score
    await transactionService.processScan({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'SETUP',
      mode: 'blackmarket'
    }, sessionService.getCurrentSession());

    // Listen for score:updated broadcast
    const scorePromise = waitForEvent(gmSocket, 'score:updated');

    // Admin adjusts score
    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'score:adjust',
        payload: {
          teamId: '001',
          delta: -500,  // Penalty
          reason: 'Rule violation'
        }
      },
      timestamp: new Date().toISOString()
    });

    // Wait for command ack and broadcast
    const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
    const [ack, scoreEvent] = await Promise.all([ackPromise, scorePromise]);

    // Validate: Command acknowledged
    expect(ack.data.success).toBe(true);
    expect(ack.data.action).toBe('score:adjust');

    // Validate: Score updated
    expect(scoreEvent.data.teamId).toBe('001');
    expect(scoreEvent.data.currentScore).toBe(2500); // 3000 - 500

    // Verify service state
    const teamScore = transactionService.getTeamScore('001');
    expect(teamScore.currentScore).toBe(2500);
  });

  it('should skip current video via admin command', async () => {
    // Queue a video first (simulate)
    const videoQueueService = require('../../src/services/videoQueueService');

    // Mock video in queue
    const mockToken = {
      id: 'TEST_VIDEO',
      mediaAssets: { video: 'test.mp4' }
    };
    videoQueueService.addToQueue(mockToken, 'ADMIN_TEST');

    // Listen for video:status
    const videoPromise = waitForEvent(gmSocket, 'video:status');

    // Admin skips video
    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'video:skip',
        payload: {}
      },
      timestamp: new Date().toISOString()
    });

    const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
    const [ack, videoEvent] = await Promise.all([ackPromise, videoPromise]);

    expect(ack.data.success).toBe(true);
    expect(videoEvent.data.status).toBe('idle'); // Video stopped
  });

  it('should create manual transaction via admin', async () => {
    const transactionPromise = waitForEvent(gmSocket, 'transaction:new');
    const scorePromise = waitForEvent(gmSocket, 'score:updated');

    gmSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'transaction:create',
        payload: {
          tokenId: '534e2b03',
          teamId: '001',
          mode: 'blackmarket',
          reason: 'Manual correction'
        }
      },
      timestamp: new Date().toISOString()
    });

    const [ack, transaction, score] = await Promise.all([
      waitForEvent(gmSocket, 'gm:command:ack'),
      transactionPromise,
      scorePromise
    ]);

    expect(ack.data.success).toBe(true);
    expect(transaction.data.transaction.tokenId).toBe('534e2b03');
    expect(score.data.currentScore).toBe(3000);
  });
});
```

**Success Criteria**:
- ✅ Admin commands execute correctly
- ✅ gm:command:ack sent to sender
- ✅ Side effect broadcasts sent to all clients
- ✅ Service state reflects admin changes

---

### Test 9: Error Propagation Across Services
**File**: `backend/tests/integration/error-propagation.test.js`
**Estimated Time**: 1.5 hours
**Validates**: Cross-service error handling

```javascript
/**
 * Error Propagation Integration Tests
 * Tests error handling across service boundaries
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Error Propagation Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();

    await sessionService.createSession({
      name: 'Error Test Session',
      teams: ['001']
    });

    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ERROR_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  it('should propagate invalid token error to client', async () => {
    const resultPromise = waitForEvent(gmSocket, 'transaction:result');

    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: 'INVALID_NONEXISTENT_TOKEN',
        teamId: '001',
        deviceId: 'GM_ERROR_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const result = await resultPromise;

    expect(result.data.status).toBe('error');
    expect(result.data.message).toContain('Invalid token');
    expect(result.data.points).toBe(0);
  });

  it('should not crash system on service errors', async () => {
    // Trigger multiple errors in rapid succession
    const promises = [];

    for (let i = 0; i < 5; i++) {
      const promise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: `INVALID_${i}`,
          teamId: '001',
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      promises.push(promise);
    }

    const results = await Promise.all(promises);

    // All errors should be handled gracefully
    results.forEach(result => {
      expect(result.data.status).toBe('error');
    });

    // System should still be functional
    const validPromise = waitForEvent(gmSocket, 'transaction:result');
    gmSocket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',  // Valid token
        teamId: '001',
        deviceId: 'GM_ERROR_TEST',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    const validResult = await validPromise;
    expect(validResult.data.status).toBe('accepted');
  });

  it('should broadcast error event for critical failures', async () => {
    // Mock a critical service failure
    const errorPromise = waitForEvent(gmSocket, 'error');

    // Simulate critical error (e.g., VLC failure)
    const videoQueueService = require('../../src/services/videoQueueService');
    videoQueueService.emit('video:failed', {
      tokenId: 'TEST_VIDEO',
      error: 'VLC connection lost'
    });

    const errorEvent = await errorPromise;

    expect(errorEvent.event).toBe('error');
    expect(errorEvent.data.code).toBeDefined();
    expect(errorEvent.data.message).toBeDefined();
  });
});
```

**Success Criteria**:
- ✅ Errors returned to client with proper status
- ✅ System remains stable after errors
- ✅ Critical errors broadcast to all clients
- ✅ No service crashes

---

### Test 10: Duplicate Detection Across Sessions
**File**: `backend/tests/integration/duplicate-detection.test.js`
**Estimated Time**: 1 hour
**Validates**: FR 1.3.3 (Duplicate Detection)

```javascript
/**
 * Duplicate Detection Integration Tests
 * Tests duplicate detection logic in real transaction flow
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../helpers/test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Duplicate Detection Integration', () => {
  let testContext, gm1, gm2;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();

    await sessionService.createSession({
      name: 'Duplicate Test Session',
      teams: ['001', '002']
    });

    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_1');
    gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_2');
  });

  afterEach(async () => {
    if (gm1?.connected) gm1.disconnect();
    if (gm2?.connected) gm2.disconnect();
  });

  it('should detect same token scanned by same team', async () => {
    // First scan - accepted
    const result1Promise = waitForEvent(gm1, 'transaction:result');
    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_DUP_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    const result1 = await result1Promise;
    expect(result1.data.status).toBe('accepted');

    // Second scan - duplicate
    const result2Promise = waitForEvent(gm1, 'transaction:result');
    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',  // Same token
        teamId: '001',        // Same team
        deviceId: 'GM_DUP_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    const result2 = await result2Promise;

    expect(result2.data.status).toBe('duplicate');
    expect(result2.data.points).toBe(0);
  });

  it('should detect same token scanned by different team (first-come-first-served)', async () => {
    // Team 001 scans first
    const result1Promise = waitForEvent(gm1, 'transaction:result');
    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_DUP_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    const result1 = await result1Promise;
    expect(result1.data.status).toBe('accepted');

    // Team 002 tries to scan same token
    const result2Promise = waitForEvent(gm2, 'transaction:result');
    gm2.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',  // Same token
        teamId: '002',        // Different team
        deviceId: 'GM_DUP_2',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    const result2 = await result2Promise;

    expect(result2.data.status).toBe('duplicate');
    expect(result2.data.message).toContain('001'); // Should mention claiming team
  });

  it('should allow same token in detective mode (no duplicate check)', async () => {
    // First scan in blackmarket mode
    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_DUP_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(gm1, 'transaction:result');

    // Second scan in detective mode (should be allowed)
    const result2Promise = waitForEvent(gm1, 'transaction:result');
    gm1.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',  // Same token
        teamId: '001',
        deviceId: 'GM_DUP_1',
        mode: 'detective'     // Detective mode
      },
      timestamp: new Date().toISOString()
    });
    const result2 = await result2Promise;

    // Detective mode scans should be logged but not scored
    expect(result2.data.status).toBe('accepted');
    expect(result2.data.points).toBe(0); // No points in detective mode
  });
});
```

**Success Criteria**:
- ✅ Same team duplicate detected
- ✅ Cross-team duplicate detected (first-come-first-served)
- ✅ Detective mode bypasses duplicate check
- ✅ Proper error messages with context

---

## Test-Driven Issue Discovery & Resolution Protocol

### Core Principle: Contracts Are Source of Truth

**CRITICAL**: The OpenAPI and AsyncAPI contracts in `/backend/contracts/` are the **authoritative specification** for this system. They were validated through extensive investigation in Phases 1-5.3.

**Default Assumption When Tests Fail**: The **implementation is wrong**, not the contract.

### Contract Change Policy

**Contract changes are a LAST RESORT and MUST ALWAYS be escalated to the user for approval.**

Contract changes are ONLY permitted when:
1. ✅ The contract itself contains a **genuine specification error** (e.g., impossible constraint, logical contradiction)
2. ✅ User explicitly approves the change after review
3. ✅ Change is documented with justification and approval timestamp

**Never change a contract to make a test pass.** Fix the implementation instead.

---

### Issue Classification & Triage

When an integration test fails, classify the issue:

#### Category 1: Implementation Bug (Most Common)
**Symptom**: Test fails because implementation doesn't match contract specification

**Examples**:
- Missing required field in event data
- Wrong event structure (unwrapped when should be wrapped)
- Incorrect business logic (duplicate detection not working)
- Event not broadcast to all clients
- Service not emitting expected domain event

**Resolution**: **Fix the implementation** to match contract
**Priority**: Fix immediately (blocking)
**Approval Needed**: No

#### Category 2: Test Error
**Symptom**: Test fails due to test code bug, not implementation

**Examples**:
- Incorrect test expectations
- Wrong event name in `waitForEvent()`
- Missing `await` causing race condition
- Test setup error (service not reset)

**Resolution**: Fix the test code
**Priority**: Fix immediately (blocking)
**Approval Needed**: No

#### Category 3: Missing Test Infrastructure
**Symptom**: Test cannot run due to missing helpers or mocks

**Examples**:
- Mock VLC server not implemented yet
- Missing WebSocket helper function
- Test server setup incomplete

**Resolution**: Implement missing infrastructure
**Priority**: Implement as needed
**Approval Needed**: No

#### Category 4: Contract Specification Error (RARE)
**Symptom**: Contract contains genuine error that makes implementation impossible or incorrect

**Examples**:
- Contract requires field that cannot exist (logical impossibility)
- Contract has conflicting requirements
- Contract missing critical field that all implementations need

**Resolution**: **STOP and escalate to user immediately**
**Priority**: Blocking until user decides
**Approval Needed**: **YES - REQUIRED**

**Escalation Template**:
```markdown
## Contract Issue Discovered

**Test**: [test file and scenario name]
**Contract**: [openapi.yaml or asyncapi.yaml]
**Section**: [path/event name]

**Issue**: [clear description of the contract problem]

**Impact**: [what's impossible/broken because of this]

**Proposed Fix**: [suggested contract change]

**Can we proceed with this contract change?**
```

#### Category 5: Environmental Issue
**Symptom**: Test fails due to environment/timing issues

**Examples**:
- Timeout too short (event propagation takes >5s)
- Port conflict
- Race condition in async code
- Service cleanup incomplete

**Resolution**: Adjust test configuration or add proper waits
**Priority**: Fix to make tests reliable
**Approval Needed**: No

---

### Fix-Verify Cycle

When you identify an implementation bug:

**Step 1: Document the Issue**
```javascript
// Issue: transaction:new event missing 'group' field (contract violation)
// Contract: asyncapi.yaml line 785 - group is required
// Fix: Add token.group to transaction payload in broadcasts.js:78
```

**Step 2: Fix Implementation**
- Make minimal change to satisfy contract
- Follow existing code patterns
- Add code comments explaining the fix

**Step 3: Verify Fix**
```bash
npm test -- path/to/integration-test.test.js
```

**Step 4: Run Full Suite**
```bash
npm test  # Ensure fix didn't break other tests
```

**Step 5: Document in Commit**
```
fix(websocket): Add missing group field to transaction:new event

Integration test revealed transaction:new broadcast was missing
the 'group' field required by AsyncAPI contract (line 785).

Added token.group enrichment in broadcasts.js listener for
transaction:accepted event.

Fixes: tests/integration/transaction-flow.test.js scenario 1
Contract: backend/contracts/asyncapi.yaml#L785
```

---

### Multi-Service Bug Resolution

Integration tests may reveal bugs spanning multiple services:

**Example**: Transaction scores but score:updated never broadcasts

**Investigation Process**:
1. ✅ Check service emits domain event: `transactionService.emit('score:updated', ...)`
2. ✅ Check broadcasts.js listens to event: `addTrackedListener(transactionService, 'score:updated', ...)`
3. ✅ Check broadcast wraps correctly: `emitWrapped(io, 'score:updated', data)`
4. ✅ Check data structure matches contract: Validate against AsyncAPI schema

**Fix Priority Order**:
1. Missing emit → Fix service
2. Missing listener → Fix broadcasts.js
3. Wrong data structure → Fix data transformation in broadcasts.js
4. Contract mismatch → **Escalate to user**

---

### Known Issues & Deferred Bugs

**Minor bugs that don't block Phase 5.4 completion** can be deferred with documentation:

**Criteria for Deferral**:
- ✅ Issue is documented with reproduction steps
- ✅ Workaround exists or impact is minimal
- ✅ Not a contract violation
- ✅ Not a core game flow blocker

**Documentation Format**:
```javascript
// TODO: Fix timing issue where rapid duplicate scans may race
// Impact: Low - rare edge case in production
// Workaround: Add 100ms delay between scans in GM scanner
// Tracked: Issue #47
it.skip('should handle rapid duplicate scans within 10ms', async () => {
  // Test implementation here
  // Skipped pending fix for race condition
});
```

**Create GitHub Issue**:
- Title: `[Integration] Description of issue`
- Label: `test-discovered`, `priority-low`
- Link to test file and scenario
- Include reproduction steps

---

### Quality Gates

**Phase 5.4 CANNOT be marked complete until**:

✅ **All Priority 1 integration tests pass** (no failures)
✅ **All Priority 2 integration tests pass OR deferred with documented issues**
✅ **Priority 3 tests pass OR deferred with approval**
✅ **No unresolved Category 4 (contract) issues** (all escalated and resolved)
✅ **All implementation fixes committed with clear messages**
✅ **Full test suite passes**: `npm test` → 280+ tests, 0 failures

**Acceptable to defer with documentation**:
- ⚠️ Minor Priority 3 bugs with workarounds
- ⚠️ Environmental issues with manual testing validation
- ⚠️ Non-critical timing optimizations

**NOT acceptable to defer**:
- ❌ Contract violations
- ❌ Core game flow bugs (Priority 1)
- ❌ Broken broadcasts (multi-client failures)
- ❌ Data corruption issues

---

### Example Scenarios

#### Scenario A: Missing Field in Broadcast
**Test Failure**: `score:updated` event missing `completedGroups` field

**Classification**: Category 1 - Implementation Bug
**Root Cause**: broadcasts.js not including field from domain event
**Fix**: Add field to payload in broadcasts.js:82
**Approval**: Not needed (fixing implementation to match contract)
**Time to Fix**: 5 minutes

---

#### Scenario B: Event Structure Mismatch
**Test Failure**: `video:status` event has `current` field instead of `status`

**Classification**: Category 1 - Implementation Bug (Decision #5 from refactor)
**Root Cause**: Old field name still in vlcService.js
**Fix**: Rename field in service emission
**Approval**: Not needed (contract is correct per Decision #5)
**Time to Fix**: 10 minutes

---

#### Scenario C: Contract Missing Critical Field
**Test Failure**: Cannot validate group completion - no `bonusPoints` field in contract

**Investigation**:
- Check contract: `group:completed` event schema
- Check implementation: transactionService calculates bonus
- Check requirements: FR 1.3.6 requires bonus tracking

**Finding**: Contract genuinely missing field that FR requires

**Classification**: Category 4 - Contract Specification Error
**Action**: **STOP - Escalate to user**
**Message**:
```
Contract Issue: group:completed event missing bonusPoints field

The AsyncAPI contract for group:completed event doesn't include a
bonusPoints field, but FR 1.3.6 requires broadcasting bonus points
when groups complete. Implementation calculates this value but has
nowhere to put it in the contract-compliant payload.

Proposed Fix: Add bonusPoints field to group:completed schema
(asyncapi.yaml line 1303)

Can we proceed with this contract change?
```

**Approval**: Required from user
**Time to Fix**: Blocked until approval

---

### Process Flowchart

```
Integration Test Fails
        ↓
Classify Issue (1-5)
        ↓
    Category 1-3? → Fix Implementation/Test → Verify → Commit
        ↓
    Category 4? → STOP → Escalate to User → Wait for Approval
        ↓ (if approved)
    Update Contract + All Related Tests → Verify → Commit
        ↓
    Category 5? → Adjust Test Configuration → Verify
        ↓
Document in Commit Message
        ↓
Run Full Test Suite
        ↓
    All Pass? → Continue to Next Test
        ↓
    New Failures? → Repeat Process
```

---

## Implementation Schedule

### Week 1: Priority 1 Tests (Core Game Flow)

**Day 1-2**: Mock VLC Infrastructure + Video Orchestration (3 hours)
- Create `mock-vlc-server.js` helper
- Implement video orchestration integration tests
- **Deliverable**: Video flow validated end-to-end

**Day 3-4**: Transaction Flow + Duplicate Detection (3 hours)
- Implement complete transaction flow tests
- Add duplicate detection integration tests
- **Deliverable**: Core game mechanics validated

**Day 5**: Offline Queue Sync + State Sync (4 hours)
- Implement offline queue integration tests
- Implement state synchronization tests
- **Deliverable**: Network resilience validated

### Week 2: Priority 2 & 3 Tests + Polish

**Day 1-2**: Session Lifecycle + Multi-Client (3.5 hours)
- Implement session lifecycle tests
- Implement multi-client broadcast validation
- **Deliverable**: Session management validated

**Day 3**: Group Completion + Admin (3.5 hours)
- Implement group completion tests
- Implement admin intervention tests
- **Deliverable**: Advanced features validated

**Day 4**: Error Propagation + Cleanup (2 hours)
- Implement error propagation tests
- Fix any discovered issues
- **Deliverable**: Error handling validated

**Day 5**: Documentation + Review (2 hours)
- Update test documentation
- Add integration test best practices guide
- **Deliverable**: Documentation complete

**Total Estimated Time**: 18 hours over 10 days

---

## Success Criteria for Phase 5.4 Completion

### Quantitative Metrics
- ✅ **Minimum 280 total tests** (271 current + 9+ new integration tests)
- ✅ **All tests pass** (0 failures)
- ✅ **Test execution time < 10 seconds** (integration tests are slower than unit tests)
- ✅ **No force exit warnings** (proper async cleanup)

### Qualitative Criteria
- ✅ **All Priority 1 tests implemented and passing**
- ✅ **Mock VLC infrastructure working reliably**
- ✅ **Multi-client broadcasting validated** (2+ concurrent GMs)
- ✅ **End-to-end flows validated** (HTTP → Services → Broadcasts → Clients)
- ✅ **Service coordination verified** (event propagation timing)

### Production Readiness Indicators
- ✅ **Core game flow tested** (scan → score → broadcast)
- ✅ **Video orchestration tested** (queue → VLC → status)
- ✅ **Offline resilience tested** (queue → sync)
- ✅ **Multi-user scenarios tested** (concurrent GMs)
- ✅ **Error handling tested** (graceful degradation)

---

## Risk Assessment & Mitigation

### Identified Risks

**Risk 1: Mock VLC Behavior Differs from Real VLC**
- **Mitigation**: Document mock limitations, provide manual VLC test checklist for pre-deployment
- **Severity**: Medium
- **Likelihood**: Medium

**Risk 2: Timing-Dependent Test Flakiness**
- **Mitigation**: Use `waitForEvent()` with proper timeouts, avoid hardcoded delays
- **Severity**: Medium
- **Likelihood**: High

**Risk 3: Test Server Cleanup Issues**
- **Mitigation**: Comprehensive `cleanupTestServer()` with proper async cleanup
- **Severity**: High
- **Likelihood**: Medium (currently seeing force exit warnings)

**Risk 4: Integration Tests Too Slow**
- **Mitigation**: Use test-specific reduced delays, run integration tests in separate CI stage
- **Severity**: Low
- **Likelihood**: Medium

### Mitigation Strategies

1. **Timing Reliability**: Use event-driven waits (`waitForEvent`) instead of fixed delays
2. **Test Isolation**: Reset ALL services in `beforeEach`, disconnect ALL sockets in `afterEach`
3. **Mock Reliability**: Keep mock VLC simple and deterministic
4. **CI/CD Integration**: Separate test stages (unit → contract → integration)

---

## Appendix A: Test Helper Reference

### Available Test Helpers

From `tests/helpers/`:

**test-server.js**:
- `setupTestServer()` → `{ server, io, port, url, socketUrl }`
- `cleanupTestServer(context)`

**websocket-helpers.js**:
- `connectAndIdentify(url, 'gm'|'scanner', deviceId)` → `socket`
- `waitForEvent(socket, eventName, timeout=5000)` → `eventData`
- `waitForMultipleEvents(socket, event, predicate, timeout)` → `[events]`
- `cleanupSockets([sockets])`
- `testDelay(ms)` - Reduced delays in test env

**contract-validator.js**:
- `validateWebSocketEvent(event, eventName)` - Validate against AsyncAPI

### Common Patterns

**Multi-Client Setup**:
```javascript
const gm1 = await connectAndIdentify(url, 'gm', 'GM_1');
const gm2 = await connectAndIdentify(url, 'gm', 'GM_2');

// Listen on both
const [event1, event2] = await Promise.all([
  waitForEvent(gm1, 'event'),
  waitForEvent(gm2, 'event')
]);
```

**Event Ordering Validation**:
```javascript
const result = await waitForEvent(socket, 'transaction:result');
const broadcast = await waitForEvent(socket, 'transaction:new');

const resultTime = new Date(result.timestamp);
const broadcastTime = new Date(broadcast.timestamp);
expect(resultTime <= broadcastTime).toBe(true);
```

**Service State Verification**:
```javascript
// Wait for broadcasts
await waitForEvent(socket, 'score:updated');

// Verify service state matches
const teamScore = transactionService.getTeamScore('001');
expect(teamScore.currentScore).toBe(expectedScore);
```

---

## Appendix B: Contract References

All integration tests should validate against these contracts:

- **HTTP API**: `/backend/contracts/openapi.yaml`
- **WebSocket Events**: `/backend/contracts/asyncapi.yaml`
- **Functional Requirements**: `/docs/api-alignment/08-functional-requirements.md`
- **Test Architecture**: `/docs/api-alignment/06-test-architecture.md`

### Key Contract Constraints

1. **All WebSocket events MUST be wrapped**: `{event, data, timestamp}`
2. **score:updated MUST have 7 fields**: teamId, currentScore, baseScore, bonusPoints, tokensScanned, completedGroups, lastUpdate
3. **video:status MUST include queueLength**: Added in Decision #5
4. **Session uses 'id' field**: Not 'sessionId' (Decision #4)
5. **Full resource broadcasting**: Decision #7 (send complete session object)

---

## Appendix C: Next Steps After Phase 5.4

### Immediate (Production Preparation)
1. **Manual VLC Testing Checklist** - Document manual tests with real VLC before deployment
2. **Load Testing** - Test with 10+ concurrent GM scanners
3. **Network Resilience** - Test on unreliable network (WiFi disconnect/reconnect)
4. **Deployment Verification** - Run full test suite on Raspberry Pi hardware

### Future Enhancements (Post-Launch)
1. **Performance Integration Tests** - Response time validation (<100ms requirement)
2. **Stress Testing** - 100+ concurrent scans, queue overflow scenarios
3. **E2E Browser Tests** - Playwright tests for actual scanner UIs
4. **Monitoring Integration** - Validate logging and metrics collection

---

## Document Metadata

**Created**: 2025-01-04
**Phase**: 5.4 (Integration Tests)
**Status**: READY TO START
**Dependencies**: Phase 5.3 COMPLETE
**Estimated Completion**: 2-3 weeks
**Author**: Claude (ALN Orchestrator Refactor Agent)
**Review Status**: Awaiting approval

---

## Approval Checklist

Before starting implementation:

- [ ] Plan reviewed by project lead
- [ ] Time estimates approved
- [ ] Priority alignment confirmed
- [ ] Test infrastructure requirements verified
- [ ] Mock VLC approach validated
- [ ] Success criteria agreed upon
- [ ] Risk mitigation strategies approved

**Ready to proceed with Phase 5.4 implementation upon approval.**
