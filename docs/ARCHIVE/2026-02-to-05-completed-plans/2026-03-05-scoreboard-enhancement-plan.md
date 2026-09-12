# Scoreboard Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign scoreboard to group evidence by character with pips, add scrolling score ticker, replace wall clock with game countdown, and fix session transition bugs.

**Architecture:** Backend enrichment adds `owner` and `teamScore` fields to existing WebSocket payloads (additive, non-breaking). Frontend is a complete rewrite of the JS + HTML in `scoreboard.html` while preserving the "Classified Evidence Terminal" CSS aesthetic. Page-based evidence cycling replaces the hero+grid model. Design doc: `docs/plans/2026-03-05-scoreboard-enhancement-design.md`.

**Tech Stack:** Node.js backend (Jest TDD), vanilla JS frontend (single HTML file), Socket.io WebSocket, CSS animations.

**Test Baselines Before Starting:**
```bash
cd backend && npm test        # Unit + contract: ~1468 tests
cd backend && npm run test:integration  # Integration: ~278 tests
```

---

## Phase 1: Backend Enrichment (TDD)

All backend changes are additive -- no existing behavior modified. Each task follows red-green-commit.

---

### Task 1: Add `owner` to tokenService metadata

**Files:**
- Modify: `backend/src/services/tokenService.js` (line 127-133, metadata object)
- Test: `backend/tests/unit/services/tokenService.test.js`

**Context:** The `loadTokens()` function builds a metadata object at lines 127-133. Currently has: `rfid`, `group`, `originalType`, `rating`, `summary`. The raw token data already contains an `owner` field (from Notion sync). We need to pass it through.

**Step 1: Write the failing test**

In `backend/tests/unit/services/tokenService.test.js`, add a new describe block:

```javascript
describe('loadTokens metadata', () => {
  it('should include owner field in metadata', () => {
    // loadTokens reads from ALN-TokenData/tokens.json
    const tokens = loadTokens();
    expect(tokens.length).toBeGreaterThan(0);

    // Every token should have metadata.owner (string or null)
    tokens.forEach(token => {
      expect(token.metadata).toHaveProperty('owner');
    });

    // Find a token that has an owner in the raw data to verify passthrough
    const rawTokens = loadRawTokens();
    const rawEntries = Object.entries(rawTokens);
    const withOwner = rawEntries.find(([, t]) => t.owner);

    if (withOwner) {
      const [id, raw] = withOwner;
      const transformed = tokens.find(t => t.id === id);
      expect(transformed.metadata.owner).toBe(raw.owner);
    }
  });

  it('should default owner to null when not present', () => {
    const tokens = loadTokens();
    const rawTokens = loadRawTokens();
    const rawEntries = Object.entries(rawTokens);
    const withoutOwner = rawEntries.find(([, t]) => !t.owner);

    if (withoutOwner) {
      const transformed = tokens.find(t => t.id === withoutOwner[0]);
      expect(transformed.metadata.owner).toBeNull();
    }
  });
});
```

Note: `loadTokens` and `loadRawTokens` are already imported at the top of the test file.

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/unit/services/tokenService.test.js --verbose
```

Expected: FAIL -- `metadata` does not have property `owner`.

**Step 3: Write minimal implementation**

In `backend/src/services/tokenService.js`, add one line inside the `metadata` object (after line 132):

```javascript
      metadata: {
        rfid: token.SF_RFID,
        group: token.SF_Group,
        originalType: token.SF_MemoryType,
        rating: token.SF_ValueRating,
        summary: validateSummary(token.summary, token.SF_RFID),
        owner: token.owner || null
      }
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/unit/services/tokenService.test.js --verbose
```

Expected: PASS.

**Step 5: Run full test suite to check for regressions**

```bash
cd backend && npm test
```

Expected: All existing tests pass.

**Step 6: Commit**

```bash
cd backend && git add src/services/tokenService.js tests/unit/services/tokenService.test.js
git commit -m "feat(tokenService): add owner field to token metadata"
```

---

### Task 2: Add `owner` to transaction:new enrichment in broadcasts.js

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (lines 176-192, transaction:added listener payload)
- Test: `backend/tests/contract/websocket/transaction-events.test.js`

**Context:** The `transaction:added` listener at line 171 enriches the transaction with token data before broadcasting as `transaction:new`. Currently adds: `memoryType`, `valueRating`, `group`, `summary`, `isUnknown`. Need to add `owner`.

**Step 1: Write the failing test**

In `backend/tests/contract/websocket/transaction-events.test.js`, find the existing `transaction:new` broadcast test (around line 100-129). Add a new test after it:

```javascript
  it('transaction:new should include owner field from token metadata', (done) => {
    const testSocket = createTestSocket(server, adminToken);

    testSocket.on('transaction:new', (eventData) => {
      const tx = eventData.data.transaction;
      // owner should be present (string or null)
      expect(tx).toHaveProperty('owner');
      testSocket.disconnect();
      done();
    });

    testSocket.on('connect', async () => {
      // Create session and process a scan to trigger transaction:new
      await sessionService.createSession({ name: 'owner-test', teams: ['Team A'] });
      await sessionService.startSession();
      await transactionService.processScan({
        tokenId: '534e2b03',  // Known test token (Technical, rating=3)
        teamId: 'Team A',
        deviceId: 'test-gm',
        deviceType: 'gm',
        mode: 'blackmarket',
      });
    });
  });
```

Adjust imports/helpers as needed -- look at existing tests in the file for the pattern (they use `createTestSocket`, `adminToken`, etc.).

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/contract/websocket/transaction-events.test.js --verbose
```

Expected: FAIL -- `owner` property not present in transaction payload.

**Step 3: Write minimal implementation**

In `backend/src/websocket/broadcasts.js`, add `owner` to the payload object inside the `transaction:added` listener. After line 191 (`isUnknown: !token`), add:

```javascript
        owner: token?.metadata?.owner || null
```

The full payload block (lines 176-193) becomes:

```javascript
    const payload = {
      transaction: {
        id: transaction.id,
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        deviceId: transaction.deviceId,
        mode: transaction.mode,
        status: transaction.status,
        points: transaction.points,
        timestamp: transaction.timestamp,
        memoryType: token?.memoryType || 'UNKNOWN',
        valueRating: token?.metadata?.rating || 0,
        group: token?.metadata?.group || token?.groupId || 'No Group',
        summary: transaction.summary || null,
        isUnknown: !token,
        owner: token?.metadata?.owner || null
      }
    };
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/contract/websocket/transaction-events.test.js --verbose
```

Expected: PASS.

**Step 5: Run full test suite**

```bash
cd backend && npm test
```

**Step 6: Commit**

```bash
cd backend && git add src/websocket/broadcasts.js tests/contract/websocket/transaction-events.test.js
git commit -m "feat(broadcasts): add owner field to transaction:new payload"
```

---

### Task 3: Add `owner`, `group`, `isUnknown` to sync:full recentTransactions enrichment

**Files:**
- Modify: `backend/src/websocket/syncHelpers.js` (lines 60-75, recentTransactions map)
- Test: `backend/tests/unit/websocket/syncHelpers.test.js`

**Context:** The `recentTransactions` enrichment in `buildSyncFullPayload()` at lines 60-75 is missing `group`, `isUnknown`, and `owner` compared to the `transaction:new` enrichment in `broadcasts.js`. This is a pre-existing inconsistency the design doc calls out. Fix it for parity.

**Step 1: Write the failing test**

In `backend/tests/unit/websocket/syncHelpers.test.js`, add tests for `buildSyncFullPayload` recentTransactions enrichment:

```javascript
const { buildSyncFullPayload } = require('../../../src/websocket/syncHelpers');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');

describe('buildSyncFullPayload recentTransactions enrichment', () => {
  beforeAll(async () => {
    // Initialize services (loads tokens)
    const { initializeServices } = require('../../../src/app');
    await initializeServices();
  });

  beforeEach(() => {
    sessionService.reset();
    transactionService.reset();
  });

  it('should include owner, group, and isUnknown in recentTransactions', async () => {
    await sessionService.createSession({ name: 'sync-test', teams: ['Team A'] });
    await sessionService.startSession();

    // Process a known token to create a transaction
    await transactionService.processScan({
      tokenId: '534e2b03',  // Known token
      teamId: 'Team A',
      deviceId: 'gm-1',
      deviceType: 'gm',
      mode: 'blackmarket',
    });

    const payload = await buildSyncFullPayload({
      sessionService,
      transactionService,
      videoQueueService: require('../../../src/services/videoQueueService'),
    });

    expect(payload.recentTransactions.length).toBeGreaterThan(0);
    const tx = payload.recentTransactions[0];
    expect(tx).toHaveProperty('owner');
    expect(tx).toHaveProperty('group');
    expect(tx).toHaveProperty('isUnknown');
    expect(tx.isUnknown).toBe(false);  // Known token
  });

  it('should set isUnknown true for unknown token', async () => {
    await sessionService.createSession({ name: 'sync-test-2', teams: ['Team B'] });
    await sessionService.startSession();

    await transactionService.processScan({
      tokenId: 'nonexistent-token-xyz',
      teamId: 'Team B',
      deviceId: 'gm-1',
      deviceType: 'gm',
      mode: 'blackmarket',
    });

    const payload = await buildSyncFullPayload({
      sessionService,
      transactionService,
      videoQueueService: require('../../../src/services/videoQueueService'),
    });

    const tx = payload.recentTransactions.find(t => t.tokenId === 'nonexistent-token-xyz');
    if (tx) {
      expect(tx.isUnknown).toBe(true);
      expect(tx.owner).toBeNull();
    }
  });
});
```

**Important:** This test needs service initialization. Check existing tests in the file for setup patterns. If `buildSyncFullPayload` requires more service args (bluetoothService, etc.), pass them or pass `undefined` -- the function handles missing services gracefully.

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/unit/websocket/syncHelpers.test.js --verbose
```

Expected: FAIL -- `owner`, `group`, `isUnknown` not present.

**Step 3: Write minimal implementation**

In `backend/src/websocket/syncHelpers.js`, update the recentTransactions map (lines 62-74) to add the three missing fields:

```javascript
  const recentTransactions = (session?.transactions || []).map(transaction => {
    const token = transactionService.getToken(transaction.tokenId);
    return {
      id: transaction.id,
      tokenId: transaction.tokenId,
      teamId: transaction.teamId,
      deviceId: transaction.deviceId,
      mode: transaction.mode,
      status: transaction.status,
      points: transaction.points,
      timestamp: transaction.timestamp,
      memoryType: token?.memoryType || 'UNKNOWN',
      valueRating: token?.metadata?.rating || 0,
      group: token?.metadata?.group || token?.groupId || 'No Group',
      summary: transaction.summary || null,
      isUnknown: !token,
      owner: token?.metadata?.owner || null,
    };
  });
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/unit/websocket/syncHelpers.test.js --verbose
```

Expected: PASS.

**Step 5: Run full test suite**

```bash
cd backend && npm test
```

**Step 6: Commit**

```bash
cd backend && git add src/websocket/syncHelpers.js tests/unit/websocket/syncHelpers.test.js
git commit -m "feat(syncHelpers): add owner, group, isUnknown to recentTransactions enrichment"
```

---

### Task 4: Add `teamScore` to transaction:new payload via stash pattern

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (lines 171-208 and 235-237)
- Test: `backend/tests/contract/websocket/transaction-events.test.js`

**Context:** The design requires `transaction:new` to carry `teamScore` so the scoreboard can update its ticker from transaction events without listening to the deprecated `score:updated`. The event flow is: `transaction:accepted` (has `teamScore`) fires BEFORE `transaction:added` (triggers `transaction:new`). We stash the teamScore keyed by transaction ID.

**Step 1: Write the failing test**

In `backend/tests/contract/websocket/transaction-events.test.js`, add:

```javascript
  it('transaction:new should include teamScore from transaction:accepted', (done) => {
    const testSocket = createTestSocket(server, adminToken);

    testSocket.on('transaction:new', (eventData) => {
      const data = eventData.data;
      expect(data).toHaveProperty('teamScore');
      expect(data.teamScore).toHaveProperty('teamId', 'Team Score');
      expect(data.teamScore).toHaveProperty('currentScore');
      expect(typeof data.teamScore.currentScore).toBe('number');
      testSocket.disconnect();
      done();
    });

    testSocket.on('connect', async () => {
      await sessionService.createSession({ name: 'score-stash-test', teams: ['Team Score'] });
      await sessionService.startSession();
      await transactionService.processScan({
        tokenId: '534e2b03',
        teamId: 'Team Score',
        deviceId: 'test-gm',
        deviceType: 'gm',
        mode: 'blackmarket',
      });
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/contract/websocket/transaction-events.test.js --verbose
```

Expected: FAIL -- `teamScore` not present in eventData.data.

**Step 3: Write minimal implementation**

In `backend/src/websocket/broadcasts.js`, add a stash Map at module scope (near the top of `setupBroadcasts`), then wire it:

Near the top of `setupBroadcasts()` (before the listeners):
```javascript
  // Stash teamScore from transaction:accepted for enriching transaction:new
  const teamScoreStash = new Map();
```

In the `transaction:accepted` listener (lines 235-237), stash the score:
```javascript
    addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
      // Stash teamScore for upcoming transaction:new broadcast
      if (payload.transaction?.id && payload.teamScore) {
        teamScoreStash.set(payload.transaction.id, payload.teamScore);
      }
      broadcastScoreUpdate(payload.teamScore, 'transaction:accepted');
    });
```

In the `transaction:added` listener (around line 176), add teamScore to the payload:
```javascript
    // Retrieve stashed teamScore (from transaction:accepted that fires first)
    const stashedTeamScore = teamScoreStash.get(transaction.id);
    teamScoreStash.delete(transaction.id);

    const payload = {
      transaction: {
        // ... existing fields ...
      },
      teamScore: stashedTeamScore || null
    };
```

Note: `teamScore` is a sibling of `transaction` in the payload, NOT nested inside `transaction`.

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/contract/websocket/transaction-events.test.js --verbose
```

Expected: PASS.

**Step 5: Run full test suite**

```bash
cd backend && npm test
```

**Step 6: Commit**

```bash
cd backend && git add src/websocket/broadcasts.js tests/contract/websocket/transaction-events.test.js
git commit -m "feat(broadcasts): add teamScore to transaction:new via stash pattern"
```

---

### Task 5: Add `score:adjusted` WebSocket broadcast

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (lines 240-242, score:adjusted listener)
- Test: `backend/tests/contract/websocket/score-events.test.js`

**Context:** Currently the `score:adjusted` internal event broadcasts as `score:updated` (same as `transaction:accepted`). The scoreboard needs a separate `score:adjusted` WebSocket event to know when scores change from admin adjustments (which don't flow through `transaction:new`). The existing `score:updated` broadcast continues unchanged.

**Step 1: Write the failing test**

In `backend/tests/contract/websocket/score-events.test.js`, add:

```javascript
  it('should broadcast score:adjusted event on admin score adjustment', (done) => {
    const testSocket = createTestSocket(server, adminToken);

    testSocket.on('score:adjusted', (eventData) => {
      const data = eventData.data;
      expect(data).toHaveProperty('teamScore');
      expect(data.teamScore).toHaveProperty('teamId', 'Team Adj');
      expect(data.teamScore).toHaveProperty('currentScore');
      testSocket.disconnect();
      done();
    });

    testSocket.on('connect', async () => {
      await sessionService.createSession({ name: 'adj-test', teams: ['Team Adj'] });
      await sessionService.startSession();
      // Process a token first so the team has a score
      await transactionService.processScan({
        tokenId: '534e2b03',
        teamId: 'Team Adj',
        deviceId: 'test-gm',
        deviceType: 'gm',
        mode: 'blackmarket',
      });
      // Now adjust score (this triggers internal score:adjusted event)
      transactionService.adjustScore('Team Adj', 5000, 'test-gm', 'bonus');
    });
  });
```

Check how `adjustScore` is called in existing tests -- the signature may vary. Look at `transactionService.adjustScore()` for the exact parameters.

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/contract/websocket/score-events.test.js --verbose
```

Expected: FAIL -- no `score:adjusted` WebSocket event received.

**Step 3: Write minimal implementation**

In `backend/src/websocket/broadcasts.js`, update the `score:adjusted` listener (lines 240-242) to ALSO emit a `score:adjusted` WebSocket event:

```javascript
    addTrackedListener(transactionService, 'score:adjusted', (payload) => {
      // Existing: broadcast as score:updated (for GM Scanner compatibility)
      broadcastScoreUpdate(payload.teamScore, 'score:adjusted');

      // New: broadcast score:adjusted to session room for scoreboard
      const session = sessionService.getCurrentSession();
      if (session) {
        emitToRoom(io, `session:${session.id}`, 'score:adjusted', {
          teamScore: payload.teamScore
        });
      }
    });
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/contract/websocket/score-events.test.js --verbose
```

Expected: PASS.

**Step 5: Run full test suite**

```bash
cd backend && npm test
```

**Step 6: Commit**

```bash
cd backend && git add src/websocket/broadcasts.js tests/contract/websocket/score-events.test.js
git commit -m "feat(broadcasts): add score:adjusted WebSocket event for scoreboard"
```

---

### Task 6: Wire expectedDuration from config

**Files:**
- Modify: `backend/src/websocket/syncHelpers.js` (lines 140, 146, 150 -- `buildGameClockState`)
- Test: `backend/tests/unit/websocket/syncHelpers.test.js`

**Context:** `buildGameClockState()` hardcodes `expectedDuration: 7200` in three places. The config already has `session.sessionTimeout` (default 120 minutes). Wire it through.

**Step 1: Write the failing test**

In `backend/tests/unit/websocket/syncHelpers.test.js`, add:

```javascript
describe('buildGameClockState', () => {
  // buildGameClockState is not exported directly -- it's internal to syncHelpers.
  // Test via buildSyncFullPayload which calls it.

  it('should use config sessionTimeout for expectedDuration', async () => {
    const config = require('../../../src/config');
    const expectedSeconds = config.session.sessionTimeout * 60;

    const payload = await buildSyncFullPayload({
      sessionService: require('../../../src/services/sessionService'),
      transactionService: require('../../../src/services/transactionService'),
      videoQueueService: require('../../../src/services/videoQueueService'),
      gameClockService: null,  // null triggers fallback path
    });

    expect(payload.gameClock.expectedDuration).toBe(expectedSeconds);
  });

  it('should use config value when gameClockService is available', async () => {
    const config = require('../../../src/config');
    const expectedSeconds = config.session.sessionTimeout * 60;
    const gameClockService = require('../../../src/services/gameClockService');

    const payload = await buildSyncFullPayload({
      sessionService: require('../../../src/services/sessionService'),
      transactionService: require('../../../src/services/transactionService'),
      videoQueueService: require('../../../src/services/videoQueueService'),
      gameClockService,
    });

    expect(payload.gameClock.expectedDuration).toBe(expectedSeconds);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/unit/websocket/syncHelpers.test.js --verbose
```

Expected: FAIL if `SESSION_TIMEOUT` env var is not 120 (which would make 7200 wrong). Actually with default 120 it would be 7200 anyway. To force failure, we need a different approach.

**Alternative approach:** Since default is 120 min = 7200s, the test would pass by coincidence. Instead, test that `buildGameClockState` uses config dynamically. Temporarily set `SESSION_TIMEOUT` env:

```javascript
  it('should derive expectedDuration from SESSION_TIMEOUT config', async () => {
    // Save original
    const originalTimeout = process.env.SESSION_TIMEOUT;
    process.env.SESSION_TIMEOUT = '90';  // 90 minutes

    // Re-require config to pick up new env
    jest.resetModules();
    const { buildSyncFullPayload } = require('../../../src/websocket/syncHelpers');

    const payload = await buildSyncFullPayload({
      sessionService: require('../../../src/services/sessionService'),
      transactionService: require('../../../src/services/transactionService'),
      videoQueueService: require('../../../src/services/videoQueueService'),
      gameClockService: null,
    });

    expect(payload.gameClock.expectedDuration).toBe(5400);  // 90 * 60

    // Restore
    if (originalTimeout !== undefined) {
      process.env.SESSION_TIMEOUT = originalTimeout;
    } else {
      delete process.env.SESSION_TIMEOUT;
    }
    jest.resetModules();
  });
```

**Step 3: Write minimal implementation**

In `backend/src/websocket/syncHelpers.js`, add config import at the top:

```javascript
const config = require('../config');
```

Then replace all three `7200` occurrences in `buildGameClockState()`:

```javascript
function buildGameClockState(gameClockService) {
  const expectedDuration = config.session.sessionTimeout * 60;
  try {
    if (!gameClockService) {
      return { status: 'stopped', elapsed: 0, expectedDuration };
    }
    const state = gameClockService.getState();
    return {
      status: state.status,
      elapsed: state.elapsed,
      expectedDuration
    };
  } catch (err) {
    logger.warn('Failed to gather game clock state for sync:full', { error: err.message });
    return { status: 'stopped', elapsed: 0, expectedDuration };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/unit/websocket/syncHelpers.test.js --verbose
```

Expected: PASS.

**Step 5: Run full test suite**

```bash
cd backend && npm test
```

**Step 6: Commit**

```bash
cd backend && git add src/websocket/syncHelpers.js tests/unit/websocket/syncHelpers.test.js
git commit -m "feat(syncHelpers): wire expectedDuration from config.session.sessionTimeout"
```

---

### Task 7: Update AsyncAPI contract

**Files:**
- Modify: `backend/contracts/asyncapi.yaml` (TransactionNew schema ~line 780, add new ScoreAdjusted event)

**Context:** Add `owner`, `status`, `isUnknown`, and `teamScore` to the `transaction:new` schema. Add new `score:adjusted` event. No `additionalProperties: false` exists, so these are non-breaking additions.

**Step 1: Add `owner` field to TransactionNew transaction properties**

In `backend/contracts/asyncapi.yaml`, after the `summary` property (around line 839), add:

```yaml
                  status:
                    type: string
                    enum: [accepted, duplicate, error]
                    description: Transaction processing result
                    example: "accepted"
                  isUnknown:
                    type: boolean
                    description: True if token ID not found in database
                    example: false
                  owner:
                    type: [string, "null"]
                    description: Character who owns this memory (from tokens.json)
                    example: "Alex Reeves"
```

Add `teamScore` as a sibling of `transaction` inside the `data` object (after the `transaction` object closes):

```yaml
              teamScore:
                type: [object, "null"]
                description: Team score after this transaction (null if unavailable)
                properties:
                  teamId:
                    type: string
                  currentScore:
                    type: integer
                  baseScore:
                    type: integer
                  bonusPoints:
                    type: integer
                  tokensScanned:
                    type: integer
                  completedGroups:
                    type: array
                    items:
                      type: string
                  adminAdjustments:
                    type: array
                    items:
                      type: object
                  lastUpdate:
                    type: string
                    format: date-time
```

**Step 2: Add ScoreAdjusted event**

After the `ScoreUpdated` message definition, add a new `ScoreAdjusted` message:

```yaml
    ScoreAdjusted:
      name: score:adjusted
      title: Admin Score Adjustment Broadcast
      summary: Broadcast admin score adjustment to session room
      description: |
        Broadcast when an admin adjusts a team's score manually. Sent to session room
        so scoreboard can update its ticker without relying on score:updated.
      payload:
        type: object
        required:
          - event
          - data
          - timestamp
        properties:
          event:
            type: string
            const: score:adjusted
            description: Event name
          data:
            type: object
            required:
              - teamScore
            properties:
              teamScore:
                type: object
                required:
                  - teamId
                  - currentScore
                  - baseScore
                  - bonusPoints
                  - tokensScanned
                  - completedGroups
                  - adminAdjustments
                  - lastUpdate
                properties:
                  teamId:
                    type: string
                    description: Team ID
                    example: "Team Alpha"
                  currentScore:
                    type: integer
                    description: Total score
                    example: 16500
                  baseScore:
                    type: integer
                  bonusPoints:
                    type: integer
                  tokensScanned:
                    type: integer
                  completedGroups:
                    type: array
                    items:
                      type: string
                  adminAdjustments:
                    type: array
                    items:
                      type: object
                  lastUpdate:
                    type: string
                    format: date-time
          timestamp:
            type: string
            format: date-time
            description: Event timestamp
```

Also register `score:adjusted` in the channel subscriptions section if one exists.

**Step 3: Run contract tests**

```bash
cd backend && npm run test:contract
```

Expected: All pass. The new fields are optional additions.

**Step 4: Commit**

```bash
cd backend && git add contracts/asyncapi.yaml
git commit -m "docs(asyncapi): add owner, teamScore to transaction:new; add score:adjusted event"
```

---

### Phase 1 Checkpoint

```bash
cd backend && npm test                    # All unit + contract pass
cd backend && npm run test:integration    # All integration pass
```

Review all Phase 1 changes before proceeding to frontend work.

---

## Phase 2: Scoreboard Rewrite - Data Layer & Session Fix

The scoreboard is a self-contained HTML file (`backend/public/scoreboard.html`, ~1528 lines). These tasks rewrite the JavaScript section. The CSS aesthetic is preserved but layout CSS changes to support the new structure.

**Important:** The scoreboard has no separate test file. Verification is manual (browser) + E2E if applicable. Each task should be testable by loading `/scoreboard` in a browser.

---

### Task 8: New state model and /api/tokens fetch for pip data

**Files:**
- Modify: `backend/public/scoreboard.html` (lines 888-900, state object; lines 1500-1520, initialize function)

**Context:** Replace the current state model with one that supports character grouping, page cycling, and countdown. Add an HTTP fetch of `/api/tokens` at startup to build a `Map<owner, totalCount>` for pip display.

**Step 1: Replace the state object** (lines 888-900)

```javascript
const state = {
  socket: null,
  token: null,
  isConnected: false,
  sessionId: null,                  // Track current session for boundary detection
  teamScores: new Map(),            // teamId -> score object
  evidenceByOwner: new Map(),       // owner -> {entries: [], lastExposed: Date}
  ownerTotalTokens: new Map(),      // owner -> total token count (from /api/tokens)
  pages: [],                        // Array of arrays of owner names per page
  currentPage: 0,                   // Current page index
  pageCycleTimer: null,             // setInterval ID for page cycling
  displayMode: 'SCOREBOARD',
  kioskMode: false,
  countdown: {                      // Game countdown state
    status: 'stopped',              // stopped | running | paused
    elapsed: 0,                     // Seconds elapsed (from server)
    expectedDuration: 7200,         // Seconds total (from server)
    tickInterval: null,             // setInterval ID for client-side tick
    lastSyncTime: null,             // Date.now() of last server sync
  },
};
```

**Step 2: Add fetchTokenTotals function** (before the `initialize` function)

```javascript
async function fetchTokenTotals() {
  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/tokens`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const tokens = data.data?.tokens || data.tokens || {};

    state.ownerTotalTokens.clear();
    for (const [, token] of Object.entries(tokens)) {
      const owner = token.owner;
      if (owner) {
        state.ownerTotalTokens.set(owner, (state.ownerTotalTokens.get(owner) || 0) + 1);
      }
    }
    console.log('[Scoreboard] Token totals loaded:', state.ownerTotalTokens.size, 'characters');
  } catch (error) {
    console.error('[Scoreboard] Failed to fetch token totals:', error);
  }
}
```

**Step 3: Call fetchTokenTotals in initialize** (update the `initialize` function)

```javascript
async function initialize() {
  console.log('[Scoreboard] Initializing Evidence Board...');
  initModes();

  const authenticated = await authenticate();
  if (!authenticated) return;

  await fetchTokenTotals();
  await connectWebSocket();

  // Token refresh cycle
  setInterval(async () => {
    console.log('[Scoreboard] Refreshing token...');
    await authenticate();
    if (state.socket && state.socket.connected) {
      state.socket.disconnect();
      await connectWebSocket();
    }
  }, CONFIG.tokenRefreshInterval);
}
```

**Step 4: Verify in browser**

Load `https://[IP]:3000/scoreboard` in a browser. Open console. Confirm:
- `[Scoreboard] Token totals loaded: N characters` appears
- No JS errors

**Step 5: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "feat(scoreboard): new state model with character grouping and /api/tokens fetch"
```

---

### Task 9: Session transition fix

**Files:**
- Modify: `backend/public/scoreboard.html` (sync:full handler ~line 1438, session:update handler ~line 1385)

**Context:** Root cause: `sync:full` appends to evidenceLog instead of replacing, and no session ID tracking. Fix: track `state.sessionId`, replace data on sync:full, detect session boundaries.

**Step 1: Add session boundary helper**

```javascript
function handleSessionBoundary(newSessionId) {
  if (state.sessionId && state.sessionId !== newSessionId) {
    console.log('[Scoreboard] Session boundary detected:', state.sessionId, '->', newSessionId);
    // Clear all session-scoped data
    state.evidenceByOwner.clear();
    state.teamScores.clear();
    state.pages = [];
    state.currentPage = 0;
    stopPageCycling();
    stopCountdown();
  }
  state.sessionId = newSessionId;
}
```

**Step 2: Rewrite sync:full handler** (replace lines 1438-1488)

```javascript
state.socket.on('sync:full', (eventData) => {
  const data = eventData.data;
  console.log('[Scoreboard] Full sync received');

  // Session boundary detection
  const sessionId = data.session?.id;
  if (sessionId) {
    handleSessionBoundary(sessionId);
  }

  // REPLACE scores (not append)
  state.teamScores.clear();
  if (data.scores && Array.isArray(data.scores)) {
    data.scores.forEach(score => {
      state.teamScores.set(score.teamId, score);
    });
  }

  // REPLACE evidence (not append) -- fixes the stale data bug
  state.evidenceByOwner.clear();
  if (data.recentTransactions && Array.isArray(data.recentTransactions)) {
    data.recentTransactions
      .filter(tx => tx.mode === 'detective')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))  // Chronological
      .forEach(tx => {
        const owner = tx.owner || 'Unknown';
        if (!state.evidenceByOwner.has(owner)) {
          state.evidenceByOwner.set(owner, { entries: [], lastExposed: null });
        }
        const group = state.evidenceByOwner.get(owner);
        group.entries.push({
          id: tx.id || `${tx.tokenId}-${tx.teamId}`,
          tokenId: tx.tokenId,
          timestamp: tx.timestamp,
          summary: tx.summary || tx.tokenId,
        });
        group.lastExposed = new Date(tx.timestamp);
      });
  }

  // Sync countdown from gameClock
  if (data.gameClock) {
    syncCountdown(data.gameClock);
  }

  // Render everything
  renderEvidence();
  renderTicker();
});
```

**Step 3: Rewrite session:update handler** (replace lines 1385-1408)

```javascript
state.socket.on('session:update', (eventData) => {
  const data = eventData.data;
  console.log('[Scoreboard] Session update:', data);

  // Detect new session by ID comparison
  if (data.id && data.id !== state.sessionId) {
    handleSessionBoundary(data.id);
    renderEvidence();
    renderTicker();
  }

  // Handle session ended
  if (data.status === 'ended') {
    stopPageCycling();
    stopCountdown();
    // Evidence stays visible, countdown frozen at 00:00:00
  }

  // Initialize any new teams
  if (data.teams && Array.isArray(data.teams)) {
    data.teams.forEach(teamId => {
      if (!state.teamScores.has(teamId)) {
        state.teamScores.set(teamId, {
          teamId, currentScore: 0, baseScore: 0, bonusPoints: 0,
          tokensScanned: 0, completedGroups: [], adminAdjustments: []
        });
      }
    });
    renderTicker();
  }
});
```

**Step 4: Verify in browser**

1. Start a session, expose some evidence
2. End the session
3. Start a new session -- evidence should clear without refresh

**Step 5: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "fix(scoreboard): session transition boundary detection and data replacement"
```

---

## Phase 3: Scoreboard Rewrite - Evidence Display

---

### Task 10: Character-grouped evidence rendering with pips

**Files:**
- Modify: `backend/public/scoreboard.html` (replace `renderHeroEvidence`, `renderEvidenceFeed`, `addEvidence` functions; update HTML structure and CSS)

**Context:** Replace hero+grid model with character-grouped "pinned documents". Each character group is a single card with: header (name + pips), chronological entries. Groups ordered by most recent exposure. Pips show exposed/total tokens.

**Step 1: Update HTML structure** (replace lines 804-816 `<main>` section)

```html
<!-- Evidence Content Area -->
<main class="evidence-content" id="evidenceContent">
  <!-- Pages rendered dynamically -->
  <div class="evidence-page" id="evidencePage"></div>
  <div class="page-dots" id="pageDots"></div>
</main>
```

Remove the `heroEvidence` and `evidenceFeed` elements from the `elements` object in JS. Add:
```javascript
evidenceContent: document.getElementById('evidenceContent'),
evidencePage: document.getElementById('evidencePage'),
pageDots: document.getElementById('pageDots'),
```

**Step 2: Add CSS for character groups** (in the `<style>` section)

```css
.character-group {
  background: var(--paper-cream);
  border-left: 4px solid var(--evidence-red);
  padding: 1.2rem 1.5rem;
  margin-bottom: var(--card-gap);
  position: relative;
  box-shadow: 2px 3px 8px rgba(0,0,0,0.3);
}

.character-group::before {
  content: '';
  position: absolute;
  top: 12px;
  left: -12px;
  width: 20px;
  height: 20px;
  background: var(--evidence-red);
  border-radius: 50%;
  box-shadow: inset -2px -2px 3px rgba(0,0,0,0.3);
}

.character-group__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  border-bottom: 1px solid var(--paper-shadow);
  padding-bottom: 0.5rem;
}

.character-group__name {
  font-family: var(--font-typewriter);
  font-size: clamp(1rem, 2vw, 1.4rem);
  text-transform: uppercase;
  color: var(--ink-black);
  letter-spacing: 0.05em;
}

.character-group__pips {
  display: flex;
  gap: 4px;
}

.pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--evidence-red-dark);
  transition: background-color 500ms ease;
}

.pip--filled {
  background-color: var(--evidence-red);
}

.character-group__entry {
  font-family: var(--font-body);
  font-size: clamp(0.85rem, 1.5vw, 1.05rem);
  color: var(--ink-black);
  line-height: 1.5;
  margin-bottom: 0.6rem;
  padding-left: 0.5rem;
}

.character-group__entry::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--evidence-red);
  border-radius: 50%;
  margin-right: 0.5rem;
  vertical-align: middle;
}

.character-group__timestamp {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: #666;
  margin-right: 0.5rem;
}

.page-dots {
  position: absolute;
  bottom: 1rem;
  right: 1.5rem;
  display: flex;
  gap: 6px;
}

.page-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  transition: background 300ms;
}

.page-dot--active {
  background: var(--terminal-green);
}

/* Evidence arrival animation */
.character-group--new {
  animation: evidenceDrop 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes evidenceDrop {
  0% { opacity: 0; transform: translateY(-30px) rotate(-1deg); }
  60% { transform: translateY(5px) rotate(0.5deg); }
  100% { opacity: 1; transform: translateY(0) rotate(0deg); }
}

/* Page transition */
.evidence-page--transitioning {
  animation: pageCut 400ms ease;
}

@keyframes pageCut {
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
}
```

**Step 3: Write renderEvidence function** (replace `renderHeroEvidence` and `renderEvidenceFeed`)

```javascript
function renderEvidence() {
  // Sort character groups by most recent exposure
  const sortedOwners = [...state.evidenceByOwner.entries()]
    .sort((a, b) => (b[1].lastExposed || 0) - (a[1].lastExposed || 0));

  if (sortedOwners.length === 0) {
    elements.evidencePage.innerHTML = '<div class="evidence-empty">Awaiting evidence...</div>';
    elements.pageDots.innerHTML = '';
    return;
  }

  // Calculate pages based on available height
  state.pages = calculatePages(sortedOwners);

  // Clamp current page
  if (state.currentPage >= state.pages.length) {
    state.currentPage = 0;
  }

  // Render current page
  renderPage(state.currentPage);
  renderPageDots();
  startPageCycling();
}

function calculatePages(sortedOwners) {
  // Estimate available height
  const headerHeight = 80;   // var(--header-height)
  const tickerHeight = 120;  // Updated ticker height
  const padding = 64;        // 2rem * 2
  const availableHeight = window.innerHeight - headerHeight - tickerHeight - padding;

  const pages = [];
  let currentPageOwners = [];
  let currentHeight = 0;

  for (const [owner, group] of sortedOwners) {
    // Estimate group height: header (~50px) + entries (~40px each) + margins (~30px)
    const groupHeight = 50 + (group.entries.length * 40) + 30;

    if (currentHeight + groupHeight > availableHeight && currentPageOwners.length > 0) {
      // Start new page
      pages.push(currentPageOwners);
      currentPageOwners = [];
      currentHeight = 0;
    }

    currentPageOwners.push(owner);
    currentHeight += groupHeight;
  }

  if (currentPageOwners.length > 0) {
    pages.push(currentPageOwners);
  }

  return pages;
}

function renderPage(pageIndex) {
  if (!state.pages[pageIndex]) return;

  const owners = state.pages[pageIndex];
  const html = owners.map(owner => {
    const group = state.evidenceByOwner.get(owner);
    if (!group) return '';

    const totalTokens = state.ownerTotalTokens.get(owner) || 0;
    const exposedCount = group.entries.length;

    // Build pips
    const pipsHtml = Array.from({ length: totalTokens }, (_, i) =>
      `<span class="pip ${i < exposedCount ? 'pip--filled' : ''}"></span>`
    ).join('');

    // Build entries (chronological)
    const entriesHtml = group.entries.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      return `<div class="character-group__entry">
        <span class="character-group__timestamp">${time}</span>
        ${escapeHtml(entry.summary)}
      </div>`;
    }).join('');

    const rotation = getRandomRotation();
    return `<div class="character-group" style="transform: rotate(${rotation}deg)" data-owner="${escapeHtml(owner)}">
      <div class="character-group__header">
        <span class="character-group__name">${escapeHtml(owner)}</span>
        <div class="character-group__pips">${pipsHtml}</div>
      </div>
      ${entriesHtml}
    </div>`;
  }).join('');

  elements.evidencePage.innerHTML = html;
}

function renderPageDots() {
  if (state.pages.length <= 1) {
    elements.pageDots.innerHTML = '';
    return;
  }
  elements.pageDots.innerHTML = state.pages.map((_, i) =>
    `<span class="page-dot ${i === state.currentPage ? 'page-dot--active' : ''}"></span>`
  ).join('');
}
```

**Step 4: Write addEvidence to update character groups** (replace existing `addEvidence`)

```javascript
function addEvidence(transaction) {
  if (transaction.mode !== 'detective') return;

  const owner = transaction.owner || 'Unknown';
  if (!state.evidenceByOwner.has(owner)) {
    state.evidenceByOwner.set(owner, { entries: [], lastExposed: null });
  }

  const group = state.evidenceByOwner.get(owner);
  const entryId = transaction.id || `${transaction.tokenId}-${transaction.teamId}-${Date.now()}`;

  // Duplicate check
  if (group.entries.some(e => e.id === entryId)) return;

  group.entries.push({
    id: entryId,
    tokenId: transaction.tokenId,
    timestamp: transaction.timestamp || new Date().toISOString(),
    summary: transaction.summary || transaction.tokenId,
  });
  group.lastExposed = new Date(transaction.timestamp || Date.now());

  // Flash effect
  triggerFlash();

  // Recalculate pages and jump to the page containing this character
  renderEvidence();

  // Find which page this owner is on and jump to it
  const targetPage = state.pages.findIndex(p => p.includes(owner));
  if (targetPage >= 0 && targetPage !== state.currentPage) {
    transitionToPage(targetPage);
  }
}
```

**Step 5: Update removeEvidence for character grouping**

```javascript
function removeEvidence(transactionId, tokenId, teamId) {
  let removed = false;
  for (const [owner, group] of state.evidenceByOwner) {
    const before = group.entries.length;
    group.entries = group.entries.filter(e => {
      const matches = e.id === transactionId ||
        (e.tokenId === tokenId);
      return !matches;
    });
    if (group.entries.length < before) removed = true;
    if (group.entries.length === 0) {
      state.evidenceByOwner.delete(owner);
    }
  }
  if (removed) renderEvidence();
}
```

**Step 6: Verify in browser**

Load scoreboard, process detective transactions. Verify:
- Evidence grouped by character name
- Pips show filled/empty correctly
- Groups ordered by most recent exposure
- No JS errors

**Step 7: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "feat(scoreboard): character-grouped evidence display with pip indicators"
```

---

### Task 11: Page cycling with adaptive intervals

**Files:**
- Modify: `backend/public/scoreboard.html` (add page cycling functions)

**Step 1: Add page cycling functions**

```javascript
function startPageCycling() {
  stopPageCycling();
  if (state.pages.length <= 1) return;

  // Adaptive interval: 2-3 pages = 18s, 4+ = 12s
  const interval = state.pages.length <= 3 ? 18000 : 12000;

  state.pageCycleTimer = setInterval(() => {
    const nextPage = (state.currentPage + 1) % state.pages.length;
    transitionToPage(nextPage);
  }, interval);
}

function stopPageCycling() {
  if (state.pageCycleTimer) {
    clearInterval(state.pageCycleTimer);
    state.pageCycleTimer = null;
  }
}

function transitionToPage(pageIndex) {
  if (pageIndex === state.currentPage) return;

  // Fade-to-black transition
  elements.evidencePage.classList.add('evidence-page--transitioning');

  setTimeout(() => {
    state.currentPage = pageIndex;
    renderPage(pageIndex);
    renderPageDots();
  }, 200);  // Halfway through 400ms animation

  setTimeout(() => {
    elements.evidencePage.classList.remove('evidence-page--transitioning');
  }, 400);

  // Reset cycle timer so this page gets full display time
  startPageCycling();
}
```

**Step 2: Add window resize handler** (recalculate pages on resize)

```javascript
window.addEventListener('resize', () => {
  const sortedOwners = [...state.evidenceByOwner.entries()]
    .sort((a, b) => (b[1].lastExposed || 0) - (a[1].lastExposed || 0));
  if (sortedOwners.length > 0) {
    state.pages = calculatePages(sortedOwners);
    if (state.currentPage >= state.pages.length) {
      state.currentPage = 0;
    }
    renderPage(state.currentPage);
    renderPageDots();
  }
});
```

**Step 3: Verify in browser**

With multiple detective transactions, verify pages cycle. Resize window to see recalculation.

**Step 4: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "feat(scoreboard): adaptive page cycling with fade transitions"
```

---

## Phase 4: Score Ticker & Countdown Timer

---

### Task 12: Scrolling score ticker marquee

**Files:**
- Modify: `backend/public/scoreboard.html` (replace `renderScoreboard`, update ticker HTML + CSS)

**Step 1: Update ticker HTML** (replace lines 820-825)

```html
<!-- Score Ticker -->
<footer class="score-ticker" id="scoreTicker">
  <div class="ticker-track" id="tickerTrack">
    <div class="ticker-content" id="tickerContent">
      <span class="ticker-empty">No scores recorded</span>
    </div>
  </div>
</footer>
```

**Step 2: Update ticker CSS** (replace existing `.score-ticker` and `.score-entry` styles)

```css
.score-ticker {
  height: 120px;
  background: linear-gradient(180deg, rgba(10,9,8,0.95), rgba(10,9,8,0.98));
  border-top: 2px solid var(--evidence-red-dark);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
}

.ticker-track {
  width: 100%;
  overflow: hidden;
}

.ticker-content {
  display: flex;
  align-items: center;
  white-space: nowrap;
  animation: tickerScroll var(--ticker-duration, 30s) linear infinite;
}

.ticker-content.paused {
  animation-play-state: paused;
}

@keyframes tickerScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.ticker-entry {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0 1.5rem;
  font-family: var(--font-mono);
  color: var(--terminal-green);
  transition: color 300ms;
}

.ticker-entry--flash {
  color: var(--terminal-amber);
}

.ticker-entry__rank {
  font-size: clamp(1rem, 2vw, 1.5rem);
  font-weight: 700;
  opacity: 0.7;
}

.ticker-entry__name {
  font-size: clamp(1.25rem, 2.5vw, 2rem);
  font-weight: 600;
  font-family: var(--font-typewriter);
  color: var(--paper-cream);
}

.ticker-entry__score {
  font-size: clamp(1.25rem, 2.5vw, 2rem);
  font-weight: 700;
}

.ticker-separator {
  color: var(--evidence-red);
  font-size: 1.5rem;
  padding: 0 0.5rem;
  opacity: 0.5;
}

.ticker-empty {
  font-family: var(--font-mono);
  color: rgba(255,255,255,0.3);
  font-size: 1.2rem;
  padding: 0 2rem;
}
```

**Step 3: Rewrite renderScoreboard as renderTicker** (replace function, rename references)

```javascript
function renderTicker() {
  const scores = Array.from(state.teamScores.values())
    .filter(team => team.currentScore > 0 || team.tokensScanned > 0 ||
      (team.adminAdjustments && team.adminAdjustments.length > 0))
    .sort((a, b) => b.currentScore - a.currentScore);

  if (scores.length === 0) {
    elements.tickerContent.innerHTML = '<span class="ticker-empty">No scores recorded</span>';
    elements.tickerContent.style.removeProperty('--ticker-duration');
    return;
  }

  const buildEntries = (scores) => scores.map((team, index) => {
    const rank = index + 1;
    return `<span class="ticker-entry" data-team="${escapeHtml(team.teamId)}">
      <span class="ticker-entry__rank">#${rank}</span>
      <span class="ticker-entry__name">${escapeHtml(team.teamId)}</span>
      <span class="ticker-entry__score">$${team.currentScore.toLocaleString()}</span>
    </span>
    <span class="ticker-separator">&bull;</span>`;
  }).join('');

  const entriesHtml = buildEntries(scores);

  if (scores.length <= 3) {
    // Few teams: no scroll, center content
    elements.tickerContent.innerHTML = entriesHtml;
    elements.tickerContent.classList.add('paused');
    elements.tickerContent.style.justifyContent = 'center';
  } else {
    // Duplicate content for seamless loop
    elements.tickerContent.innerHTML = entriesHtml + entriesHtml;
    elements.tickerContent.classList.remove('paused');
    elements.tickerContent.style.justifyContent = '';

    // Adaptive scroll duration based on content width
    // ~80px per second, estimate ~300px per entry
    const duration = Math.max(15, (scores.length * 300) / 80);
    elements.tickerContent.style.setProperty('--ticker-duration', `${duration}s`);
  }
}

function flashTickerEntry(teamId) {
  const entry = document.querySelector(`.ticker-entry[data-team="${teamId}"]`);
  if (entry) {
    entry.classList.add('ticker-entry--flash');
    setTimeout(() => entry.classList.remove('ticker-entry--flash'), 1500);
  }
}
```

**Step 4: Update updateTeamScore to use renderTicker and flash**

```javascript
function updateTeamScore(scoreData) {
  const existing = state.teamScores.get(scoreData.teamId);
  state.teamScores.set(scoreData.teamId, scoreData);

  renderTicker();

  if (existing && existing.currentScore !== scoreData.currentScore) {
    setTimeout(() => flashTickerEntry(scoreData.teamId), 100);
  }
}
```

**Step 5: Update DOM elements object**

Replace:
```javascript
scoreTicker: document.getElementById('scoreTicker'),
tickerEntries: document.getElementById('tickerEntries'),
```
With:
```javascript
scoreTicker: document.getElementById('scoreTicker'),
tickerTrack: document.getElementById('tickerTrack'),
tickerContent: document.getElementById('tickerContent'),
```

**Step 6: Verify in browser**

Process blackmarket transactions. Verify:
- Ticker shows all teams (no `slice(0, 6)`)
- Scrolls when 4+ teams
- Score changes flash amber

**Step 7: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "feat(scoreboard): scrolling score ticker marquee with all teams"
```

---

### Task 13: Game countdown timer

**Files:**
- Modify: `backend/public/scoreboard.html` (replace wall clock, add service:state gameclock listener)

**Context:** Replace the wall clock (`updateTimestamp` function, line 947-959) with a countdown showing `expectedDuration - elapsed`. Listen to `service:state` domain `gameclock` for lifecycle changes.

**Step 1: Replace updateTimestamp with countdown functions**

Remove the wall clock `setInterval(updateTimestamp, 1000)` (line 958) and `updateTimestamp()` call (line 959).

Replace with:

```javascript
function formatCountdown(remainingSeconds) {
  if (remainingSeconds <= 0) return { hours: '00', minutes: '00', seconds: '00' };
  const h = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(remainingSeconds % 60)).padStart(2, '0');
  return { hours: h, minutes: m, seconds: s };
}

function renderCountdown() {
  const cd = state.countdown;

  if (cd.status === 'stopped') {
    elements.timestamp.querySelector('.hours').textContent = '--';
    elements.timestamp.querySelector('.minutes').textContent = '--';
    elements.timestamp.querySelector('.seconds').textContent = '--';
    elements.timestamp.classList.remove('countdown--running', 'countdown--paused', 'countdown--overtime');
    return;
  }

  // Calculate current elapsed (server elapsed + client drift since last sync)
  let currentElapsed = cd.elapsed;
  if (cd.status === 'running' && cd.lastSyncTime) {
    const drift = (Date.now() - cd.lastSyncTime) / 1000;
    currentElapsed = cd.elapsed + drift;
  }

  const remaining = Math.max(0, cd.expectedDuration - currentElapsed);
  const { hours, minutes, seconds } = formatCountdown(remaining);

  elements.timestamp.querySelector('.hours').textContent = hours;
  elements.timestamp.querySelector('.minutes').textContent = minutes;
  elements.timestamp.querySelector('.seconds').textContent = seconds;

  // Visual states
  elements.timestamp.classList.remove('countdown--running', 'countdown--paused', 'countdown--overtime');
  if (remaining <= 0) {
    elements.timestamp.classList.add('countdown--overtime');
  } else if (cd.status === 'paused') {
    elements.timestamp.classList.add('countdown--paused');
  } else {
    elements.timestamp.classList.add('countdown--running');
  }
}

function syncCountdown(gameClock) {
  const cd = state.countdown;
  cd.status = gameClock.status || 'stopped';
  cd.elapsed = gameClock.elapsed || 0;
  cd.expectedDuration = gameClock.expectedDuration || 7200;
  cd.lastSyncTime = Date.now();

  // Start/stop client-side tick
  if (cd.status === 'running') {
    startCountdownTick();
  } else {
    stopCountdownTick();
  }

  renderCountdown();
}

function startCountdownTick() {
  stopCountdownTick();
  state.countdown.tickInterval = setInterval(renderCountdown, 1000);
}

function stopCountdownTick() {
  if (state.countdown.tickInterval) {
    clearInterval(state.countdown.tickInterval);
    state.countdown.tickInterval = null;
  }
}

function stopCountdown() {
  stopCountdownTick();
  state.countdown.status = 'stopped';
  renderCountdown();
}

// Initial render (shows --:--:--)
renderCountdown();
```

**Step 2: Add service:state listener for gameclock domain**

In the WebSocket event handlers section (after the existing handlers), add:

```javascript
state.socket.on('service:state', (eventData) => {
  const data = eventData.data;
  if (data?.domain === 'gameclock' && data.state) {
    syncCountdown(data.state);
  }
});
```

**Step 3: Add countdown CSS**

```css
.countdown--running .colon {
  animation: colonBlink 1s step-end infinite;
}

.countdown--paused {
  animation: fullBlink 1s step-end infinite;
}

.countdown--overtime {
  color: var(--evidence-red) !important;
  animation: fullBlink 0.5s step-end infinite;
}

@keyframes colonBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

@keyframes fullBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.3; }
}
```

**Step 4: Verify in browser**

1. No session: shows `--:--:--`
2. Start game clock: countdown starts in green with blinking colons
3. Pause: entire time string blinks
4. Let it expire: shows `00:00:00` blinking red

**Step 5: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "feat(scoreboard): game countdown timer replacing wall clock"
```

---

## Phase 5: Event Wiring & Final Polish

---

### Task 14: Wire new event handlers (transaction:new with owner, score:adjusted, scores:reset)

**Files:**
- Modify: `backend/public/scoreboard.html` (update transaction:new, add score:adjusted, update scores:reset)

**Step 1: Update transaction:new handler** (replace lines 1367-1373)

```javascript
state.socket.on('transaction:new', (eventData) => {
  const data = eventData.data;
  const transaction = data?.transaction;
  if (transaction) {
    console.log('[Scoreboard] New transaction:', transaction.tokenId, 'owner:', transaction.owner);
    addEvidence(transaction);
  }
  // Update ticker from teamScore if present
  if (data?.teamScore) {
    updateTeamScore(data.teamScore);
  }
});
```

**Step 2: Add score:adjusted handler**

```javascript
state.socket.on('score:adjusted', (eventData) => {
  const data = eventData.data;
  if (data?.teamScore) {
    console.log('[Scoreboard] Score adjusted:', data.teamScore.teamId);
    updateTeamScore(data.teamScore);
  }
});
```

**Step 3: Update scores:reset handler** (replace lines 1411-1435)

```javascript
state.socket.on('scores:reset', (eventData) => {
  console.log('[Scoreboard] Scores reset');

  // Clear all scores but keep teams
  state.teamScores.forEach((score, teamId) => {
    state.teamScores.set(teamId, {
      teamId, currentScore: 0, baseScore: 0, bonusPoints: 0,
      tokensScanned: 0, completedGroups: [], adminAdjustments: []
    });
  });

  // Clear evidence
  state.evidenceByOwner.clear();
  state.pages = [];
  state.currentPage = 0;
  stopPageCycling();

  renderEvidence();
  renderTicker();
});
```

**Step 4: Update transaction:deleted handler** (already done in Task 10 `removeEvidence`)

Verify the existing `transaction:deleted` handler calls the updated `removeEvidence`.

**Step 5: Keep score:updated handler** for backward compatibility

The existing `score:updated` handler (lines 1353-1357) can stay -- it calls `updateTeamScore` which updates the ticker. No change needed.

**Step 6: Verify in browser**

1. Blackmarket transaction: ticker updates from `teamScore` in `transaction:new`
2. Admin score adjustment: ticker updates from `score:adjusted`
3. Scores reset: everything clears

**Step 7: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "feat(scoreboard): wire score:adjusted, teamScore in transaction:new, updated reset"
```

---

### Task 15: Clean up removed code and final CSS adjustments

**Files:**
- Modify: `backend/public/scoreboard.html`

**Step 1: Remove dead code**

- Remove `renderHeroEvidence()` function (replaced by `renderEvidence`/`renderPage`)
- Remove `renderEvidenceFeed()` function (replaced)
- Remove `CONFIG.maxFeedCards` and `CONFIG.heroDisplayDuration` (no longer used)
- Remove `state.heroEvidence` and `state.heroTimeout` (no longer used)
- Remove `state.viewMode` if detective-only view mode is handled by evidence display
- Remove old `.hero-evidence` and `.evidence-card` CSS styles (replaced by `.character-group`)
- Remove `.score-entry` CSS styles (replaced by `.ticker-entry`)
- Remove `cardCascade` animation CSS
- Remove hero-specific CSS (`.hero-evidence__header`, `.hero-evidence__team`, etc.)
- Remove old `elements.heroEvidence` and `elements.evidenceFeed` references

**Step 2: Update CSS layout variable**

```css
:root {
  /* ... existing ... */
  --ticker-height: 120px;  /* Updated from 100px */
}

.evidence-content {
  height: calc(100vh - var(--header-height) - var(--ticker-height));
  overflow: hidden;
  position: relative;
  padding: var(--content-padding);
}
```

**Step 3: Verify no JS errors in browser**

Load scoreboard, run through full game flow.

**Step 4: Commit**

```bash
cd backend && git add public/scoreboard.html
git commit -m "refactor(scoreboard): remove dead hero/grid code, finalize CSS layout"
```

---

## Phase 5 Checkpoint: Full Verification

```bash
# Backend tests
cd backend && npm test                    # Unit + contract
cd backend && npm run test:integration    # Integration

# Manual browser verification
# 1. Load /scoreboard in browser
# 2. Create session with 2+ teams
# 3. Process detective transactions for different characters
# 4. Verify character grouping, pips, page cycling
# 5. Process blackmarket transactions
# 6. Verify ticker scrolls with all teams
# 7. Start game clock, verify countdown
# 8. End session, start new session WITHOUT refresh
# 9. Verify old data clears and new session works
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | Tasks 1-7 | Backend enrichment (TDD, ~7 commits) |
| 2 | Tasks 8-9 | Scoreboard data layer + session fix (~2 commits) |
| 3 | Tasks 10-11 | Character-grouped evidence display (~2 commits) |
| 4 | Tasks 12-13 | Score ticker + countdown timer (~2 commits) |
| 5 | Tasks 14-15 | Event wiring + cleanup (~2 commits) |

**Total: 15 tasks, ~15 commits**
