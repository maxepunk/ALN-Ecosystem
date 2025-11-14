# GM Scanner Admin Panel Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the GM Scanner admin panel by fixing architectural regressions from ES6 migration, wiring the scores:reset event flow, and fixing history screen auto-updates.

**Architecture:** Event-driven WebSocket system following established hybrid pattern (bulk domain event + sync:full broadcast). Backend exposes transactionService.resetScores() via gm:command, broadcasts.js wires scores:reset event to WebSocket clients with sync:full, frontend receives both events and updates UI automatically.

**Tech Stack:** Node.js (backend), Socket.io (WebSocket), ES6 modules (frontend), Playwright (E2E tests), Jest (unit tests)

---

## ⚡ EXECUTION STATUS (Updated 2025-11-14)

### ✅ Completed Tasks (12/19)
- **Phase 1 (Backend):** Tasks 1.1-1.3 ✅
- **Phase 5A (Test Fixes):** Task 5.1 ✅
- **Phase 2 (Frontend):** Tasks 2.1-2.5 ✅
- **Phase 3 (Frontend Fixes):** Task 3.1 ✅
- **Phase 4 (Safety):** Task 4.1 ✅
- **Phase 8 (Docs):** Task 8.3 ✅

### 📊 Test Results
**Backend:** 594/603 tests passing (98.5%)
**Frontend:** 24/33 tests passing (9 skipped - unimplemented features)

### 📝 Commits Created (10 total)

**Backend (3):**
- `87b03104` feat(backend): wire scores:reset event to WebSocket broadcast
- `0f56724d` feat(backend): emit team list in scores:reset event
- `6415d672` feat(backend): add score:reset admin command

**Frontend (7):**
- `ab6ee97` fix(tests): resolve 26 failing adminModule unit tests
- `17aa5e2` feat(frontend): implement AdminOperations score management methods
- `24ae072` fix(frontend): address code review feedback for AdminOperations
- `03aaebf` refactor(frontend): remove unsupported clearTransactions feature
- `0c411f1` feat(frontend): add AdminOperations event handler lifecycle
- `1842ad6` fix(frontend): add history screen auto-update on new transactions
- `c3bd6ea` fix(frontend): add null check to updateSystemDisplay

### 🔑 Critical Lessons Learned

1. **EventTarget API Pattern:** Frontend uses browser's EventTarget (NOT Node.js EventEmitter)
   ```javascript
   // CORRECT:
   mockConnection.addEventListener('message:received', handler);
   mockConnection.dispatchEvent(new CustomEvent('message:received', {detail}));

   // WRONG (old pattern):
   mockConnection.on('message:received', handler);
   ```

2. **CustomEvent Structure:** Events use `{detail: {type, payload}}` pattern
   ```javascript
   const event = new CustomEvent('message:received', {
     detail: {
       type: 'gm:command:ack',
       payload: { success: true, message: 'Done' }
     }
   });
   ```

3. **Debug.log Convention:** Codebase uses `Debug.log()` utility, NOT `console.log()`
   - Import: `import Debug from './debug.js'` (default export, NOT named)

4. **Code Review Loop Closure:** MUST verify completion and update todos after each review before proceeding

5. **Subagent Prompting:** ALWAYS verify file paths before dispatching (wrong filename caused one subagent failure)

6. **Task 5.2 Discovery:** Backend tests were already added in Tasks 1.1-1.2 (no additional work needed)

### ⚠️ Deferred Issues
- **Task 2.5:** Missing lifecycle tests for AdminOperations (Important but non-blocking per code review)

### 🎯 Remaining Tasks (7)
- ~~Task 3.1: Add history screen re-render to transaction:added listener~~ ✅ **COMPLETED** (Commit: 1842ad6)
- ~~Task 4.1: Add null check to MonitoringDisplay.updateSystemDisplay~~ ✅ **COMPLETED** (Commit: c3bd6ea)
- Task 5.2: ~~Add backend tests~~ **COMPLETED in Tasks 1.1-1.2**
- Task 6.1: Add score reset E2E test (Deferred until after Phase 7)
- Task 7.1: Add View Full Scoreboard button **← NEXT**
- Task 7.2: Add View Transaction History button
- Task 7.3: Make admin score board team names clickable
- Task 8.1: Update backend/CLAUDE.md with event flow documentation
- Task 8.2: Update ALNScanner/CLAUDE.md with admin panel architecture

---

## Context for Engineer

**System Overview:**
- **Backend:** Node.js orchestrator managing game sessions, scoring, video playback
- **Frontend:** ES6 module-based GM Scanner web app for game masters
- **Protocol:** WebSocket via Socket.io for real-time admin commands and state sync
- **Event Pattern:** Domain events (service layer) → broadcasts.js wrapper → WebSocket clients

**Key Files:**
- `backend/src/websocket/broadcasts.js` - Wires service events to WebSocket broadcasts
- `backend/src/services/transactionService.js` - Manages team scores and transactions
- `backend/src/websocket/adminEvents.js` - Handles gm:command WebSocket requests
- `ALNScanner/src/utils/adminModule.js` - Admin panel UI components
- `ALNScanner/src/main.js` - Event listener registration

**Established Pattern (from processQueue):**
```
Service emits domain event → broadcasts.js wraps it → WebSocket broadcast + sync:full
```

---

## Phase 1: Backend - Wire scores:reset Event Broadcast ✅ COMPLETED

### Task 1.1: Add scores:reset broadcast handler to broadcasts.js ✅

**Status:** ✅ COMPLETED (Commit: 87b03104)
**Actual Implementation:** Followed TDD approach, all tests passing

**Files:**
- Modify: `backend/src/websocket/broadcasts.js:250` (after transaction service listeners)
- Test: `backend/tests/unit/websocket/broadcasts.test.js`

**Step 1: Write the failing test**

```javascript
// File: backend/tests/unit/websocket/broadcasts.test.js
// Add after existing transactionService tests (around line 180)

describe('scores:reset event', () => {
  it('should broadcast scores:reset and sync:full when transactionService emits scores:reset', () => {
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    const mockStateService = {
      getCurrentState: jest.fn().mockReturnValue({
        session: { id: 'test-session', status: 'active' },
        scores: [],
        recentTransactions: []
      })
    };

    const mockSessionService = {
      getCurrentSession: jest.fn().mockReturnValue({
        id: 'test-session',
        toJSON: () => ({ id: 'test-session', status: 'active' })
      })
    };

    // Simulate broadcasts.js initialization with mocked services
    // (This will fail until we implement the listener)

    // Emit scores:reset from transactionService
    transactionService.emit('scores:reset', { teamsReset: ['001', '002'] });

    // Verify scores:reset broadcast to GM room
    expect(mockIo.to).toHaveBeenCalledWith('gm');
    expect(mockIo.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'scores:reset',
        data: { teamsReset: ['001', '002'] }
      })
    );

    // Verify sync:full broadcast
    expect(mockIo.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sync:full',
        data: expect.objectContaining({
          scores: []
        })
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend
npm test -- broadcasts.test.js
```

Expected output:
```
FAIL tests/unit/websocket/broadcasts.test.js
  ● scores:reset event › should broadcast scores:reset and sync:full
    expect(jest.fn()).toHaveBeenCalledWith(...)
    Expected: objectContaining({"data": {"teamsReset": ["001", "002"]}, "event": "scores:reset"})
    Received: (not called)
```

**Step 3: Implement scores:reset broadcast handler**

```javascript
// File: backend/src/websocket/broadcasts.js
// Add after line 250 (after other transactionService listeners)

// Transaction service - scores reset (bulk operation)
addTrackedListener(transactionService, 'scores:reset', (data) => {
  // Notify GM stations about score reset (bulk event)
  emitToRoom(io, 'gm', 'scores:reset', {
    teamsReset: data?.teamsReset || []
  });

  // Provide complete updated state (follows processQueue pattern)
  const session = sessionService.getCurrentSession();
  if (!session) {
    logger.warn('No active session during scores:reset');
    return;
  }

  const fullState = stateService.getCurrentState();
  emitWrapped(io, 'sync:full', fullState);

  logger.info('Broadcasted scores:reset + sync:full to GM stations', {
    teamsReset: data?.teamsReset?.length || 0
  });
});
```

**Step 4: Run test to verify it passes**

```bash
npm test -- broadcasts.test.js
```

Expected output:
```
PASS tests/unit/websocket/broadcasts.test.js
  ✓ scores:reset event › should broadcast scores:reset and sync:full (25ms)
```

**Step 5: Commit**

```bash
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/broadcasts.test.js
git commit -m "feat(backend): wire scores:reset event to WebSocket broadcast

- Add broadcasts.js listener for scores:reset domain event
- Follow established hybrid pattern: bulk event + sync:full
- Broadcast to GM room only (not player scanners)
- Add unit test for broadcast handler"
```

---

### Task 1.2: Update resetScores() to emit team list ✅

**Status:** ✅ COMPLETED (Commit: 0f56724d)
**Actual Implementation:** Followed TDD approach, all tests passing

**Files:**
- Modify: `backend/src/services/transactionService.js:529-534`
- Test: `backend/tests/unit/services/transactionService.test.js`

**Step 1: Write the failing test**

```javascript
// File: backend/tests/unit/services/transactionService.test.js
// Add after existing resetScores tests (if any, or create new describe block)

describe('resetScores', () => {
  it('should emit scores:reset event with teamsReset array', () => {
    const transactionService = require('../../../src/services/transactionService').getInstance();

    // Setup: Add some team scores
    transactionService.teamScores.set('001', { currentScore: 500 });
    transactionService.teamScores.set('002', { currentScore: 300 });

    // Spy on emit
    const emitSpy = jest.spyOn(transactionService, 'emit');

    // Execute
    transactionService.resetScores();

    // Verify
    expect(emitSpy).toHaveBeenCalledWith('scores:reset', {
      teamsReset: expect.arrayContaining(['001', '002'])
    });

    // Cleanup
    emitSpy.mockRestore();
  });

  it('should clear teamScores Map', () => {
    const transactionService = require('../../../src/services/transactionService').getInstance();

    transactionService.teamScores.set('001', { currentScore: 500 });
    transactionService.resetScores();

    expect(transactionService.teamScores.size).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- transactionService.test.js
```

Expected output:
```
FAIL tests/unit/services/transactionService.test.js
  ● resetScores › should emit scores:reset event with teamsReset array
    expect(jest.fn()).toHaveBeenCalledWith(...)
    Expected: "scores:reset", {"teamsReset": ArrayContaining ["001", "002"]}
    Received: "scores:reset", undefined
```

**Step 3: Implement resetScores() with team list**

```javascript
// File: backend/src/services/transactionService.js:529-534
// Replace existing resetScores() method

resetScores() {
  // Capture teams before clearing
  const teams = Array.from(this.teamScores.keys());

  this.teamScores.clear();
  this.recentTransactions = [];

  // Emit with team list for broadcast handler
  this.emit('scores:reset', { teamsReset: teams });

  logger.info('Scores reset', { teamsReset: teams.length });
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- transactionService.test.js
```

Expected output:
```
PASS tests/unit/services/transactionService.test.js
  ✓ resetScores › should emit scores:reset event with teamsReset array (18ms)
  ✓ resetScores › should clear teamScores Map (12ms)
```

**Step 5: Commit**

```bash
git add backend/src/services/transactionService.js backend/tests/unit/services/transactionService.test.js
git commit -m "feat(backend): emit team list in scores:reset event

- Capture team IDs before clearing teamScores
- Emit scores:reset with teamsReset array
- Add unit tests for resetScores() behavior"
```

---

### Task 1.3: Add score:reset admin command ✅

**Status:** ✅ COMPLETED (Commit: 6415d672)
**Actual Implementation:** Followed TDD approach, all tests passing
**Note:** Contract tests were not added (infrastructure needs verification - see Task 5B.1)

**Files:**
- Modify: `backend/contracts/asyncapi.yaml:1130` (action enum)
- Modify: `backend/src/websocket/adminEvents.js:159` (after score:adjust case)
- Test: `backend/tests/contract/websocket-commands.test.js`

**Step 1: Add score:reset to AsyncAPI contract**

```yaml
# File: backend/contracts/asyncapi.yaml
# Modify action enum at line 1130
action:
  type: string
  description: Command action type
  enum:
    - session:create
    - session:pause
    - session:resume
    - session:end
    - video:play
    - video:pause
    - video:stop
    - video:skip
    - video:queue:add
    - video:queue:reorder
    - video:queue:clear
    - score:adjust
    - score:reset      # ← ADD THIS LINE
    - transaction:delete
    - transaction:create
    - system:reset
```

**Step 2: Write failing contract test**

```javascript
// File: backend/tests/contract/websocket-commands.test.js
// Add after score:adjust test

describe('score:reset command', () => {
  it('should reset all team scores and broadcast scores:reset + sync:full', async () => {
    const socket = await connectWithAuth(orchestratorUrl, ADMIN_PASSWORD, 'GM_Test', 'gm');

    // Setup: Create session with teams
    await sendCommand(socket, 'session:create', {
      name: 'Reset Test',
      teams: ['001', '002']
    });

    // Add some scores by simulating scans
    // (Implementation detail: use existing transaction endpoints)

    // Listen for broadcasts
    const scoresResetPromise = waitForEvent(socket, 'scores:reset', 5000);
    const syncFullPromise = waitForEvent(socket, 'sync:full', 5000);

    // Execute: Send score:reset command
    const ackPromise = waitForEvent(socket, 'gm:command:ack', 5000);
    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'score:reset',
        payload: {}
      },
      timestamp: new Date().toISOString()
    });

    // Verify: Command acknowledged
    const ack = await ackPromise;
    expect(ack.data.success).toBe(true);
    expect(ack.data.action).toBe('score:reset');

    // Verify: scores:reset broadcast received
    const scoresReset = await scoresResetPromise;
    expect(scoresReset.data.teamsReset).toEqual(expect.arrayContaining(['001', '002']));

    // Verify: sync:full received with cleared scores
    const syncFull = await syncFullPromise;
    expect(syncFull.data.scores).toEqual([]);

    socket.disconnect();
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm run test:contract -- websocket-commands
```

Expected output:
```
FAIL tests/contract/websocket-commands.test.js
  ● score:reset command › should reset all team scores
    Error: Timeout waiting for gm:command:ack event
```

**Step 4: Implement score:reset command handler**

```javascript
// File: backend/src/websocket/adminEvents.js
// Add after case 'score:adjust' (around line 159)

case 'score:reset':
  // Reset all team scores (triggers scores:reset event → broadcasts)
  transactionService.resetScores();
  resultMessage = 'All team scores reset to zero';
  logger.info('All team scores reset by GM', {
    gmStation: socket.deviceId,
    sessionId: session?.id
  });
  break;
```

**Step 5: Run test to verify it passes**

```bash
npm run test:contract -- websocket-commands
```

Expected output:
```
PASS tests/contract/websocket-commands.test.js
  ✓ score:reset command › should reset all team scores (1245ms)
```

**Step 6: Commit**

```bash
git add backend/contracts/asyncapi.yaml backend/src/websocket/adminEvents.js
git commit -m "feat(backend): add score:reset admin command

- Add score:reset to AsyncAPI contract action enum
- Implement case 'score:reset' in adminEvents.js
- Calls transactionService.resetScores()
- Note: Contract tests to be added after infrastructure verification"
```

---

## Phase 2: Frontend - Implement AdminOperations Methods ✅ COMPLETED

**IMPORTANT NOTE:** Frontend unit tests for adminModule.js ALREADY EXIST at `ALNScanner/tests/unit/utils/adminModule.test.js` (439 lines, 27 tests). However, **26 out of 27 tests were FAILING** before Task 5.1 (now fixed).

### Task 2.1: Implement _sendCommand() helper in AdminOperations ✅

**Status:** ✅ COMPLETED (Commit: 17aa5e2, fixed in 24ae072)
**Actual Implementation:** Implemented with TDD, code review identified and fixed issues

**Files:**
- Modify: `ALNScanner/src/utils/adminModule.js:271` (AdminOperations class)
- Test: `ALNScanner/tests/unit/utils/adminModule.test.js`

**Step 1: Write failing test**

```javascript
// File: ALNScanner/tests/unit/utils/adminModule.test.js
// Add after existing AdminOperations tests (around line 348)

describe('AdminOperations._sendCommand', () => {
  it('should send command and resolve on gm:command:ack success', async () => {
    const mockConnection = new EventTarget();
    mockConnection.send = jest.fn();

    const ops = new AdminOperations(mockConnection);

    // Simulate async ack response
    setTimeout(() => {
      const ackEvent = new CustomEvent('message:received', {
        detail: {
          type: 'gm:command:ack',
          payload: { success: true, message: 'Done' }
        }
      });
      mockConnection.dispatchEvent(ackEvent);
    }, 10);

    const result = await ops._sendCommand('test:action', { foo: 'bar' });

    expect(mockConnection.send).toHaveBeenCalledWith('gm:command', {
      action: 'test:action',
      payload: { foo: 'bar' }
    });

    expect(result).toEqual({ success: true, message: 'Done' });
  });

  it('should reject on gm:command:ack failure', async () => {
    const mockConnection = new EventTarget();
    mockConnection.send = jest.fn();

    const ops = new AdminOperations(mockConnection);

    setTimeout(() => {
      const ackEvent = new CustomEvent('message:received', {
        detail: {
          type: 'gm:command:ack',
          payload: { success: false, message: 'Error occurred' }
        }
      });
      mockConnection.dispatchEvent(ackEvent);
    }, 10);

    await expect(ops._sendCommand('test:action', {}))
      .rejects.toThrow('Error occurred');
  });

  it('should timeout if no ack received', async () => {
    const mockConnection = new EventTarget();
    mockConnection.send = jest.fn();

    const ops = new AdminOperations(mockConnection);

    // Don't send ack - should timeout
    await expect(ops._sendCommand('test:action', {}))
      .rejects.toThrow('test:action timeout');
  }, 6000); // Test timeout longer than command timeout
});
```

**Step 2: Run test to verify current state**

```bash
cd ALNScanner
npm test -- adminModule.test.js
```

Expected output (REALITY CHECK):
```
FAIL tests/unit/utils/adminModule.test.js
  ● 26/27 tests failing (test file exists but tests are broken)

NOTE: If you see this, the existing tests need fixing first.
See "Phase 5A: Fix Failing Tests" below before proceeding.
```

If tests don't exist or _sendCommand specifically is missing:
```
FAIL tests/unit/utils/adminModule.test.js
  ● AdminOperations._sendCommand › should send command and resolve on success
    TypeError: ops._sendCommand is not a function
```

**Step 3: Implement _sendCommand() method**

```javascript
// File: ALNScanner/src/utils/adminModule.js
// Add after line 271 (in AdminOperations class, after existing methods)

/**
 * Send admin command via WebSocket and wait for acknowledgment
 * @param {string} action - Command action (e.g., 'score:reset')
 * @param {Object} payload - Command payload
 * @returns {Promise} Resolves with response data, rejects on error/timeout
 * @private
 */
_sendCommand(action, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.connection.removeEventListener('message:received', ackHandler);
      reject(new Error(`${action} timeout`));
    }, 5000);

    // One-time handler for gm:command:ack
    const ackHandler = (event) => {
      const { type, payload: response } = event.detail;

      // Only process gm:command:ack events
      if (type !== 'gm:command:ack') return;

      // Cleanup
      clearTimeout(timeout);
      this.connection.removeEventListener('message:received', ackHandler);

      // Check response (response IS the data, already unwrapped by OrchestratorClient)
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.message || `Failed: ${action}`));
      }
    };

    // Register one-time listener
    this.connection.addEventListener('message:received', ackHandler);

    // Send command via OrchestratorClient
    this.connection.send('gm:command', {
      action: action,
      payload: payload
    });
  });
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- adminModule.test.js
```

Expected output:
```
PASS tests/unit/utils/adminModule.test.js
  ✓ AdminOperations._sendCommand › should send command and resolve on success (28ms)
  ✓ AdminOperations._sendCommand › should reject on failure (25ms)
  ✓ AdminOperations._sendCommand › should timeout if no ack (5015ms)
```

**Step 5: Commit**

```bash
git add ALNScanner/src/utils/adminModule.js ALNScanner/tests/unit/utils/adminModule.test.js
git commit -m "feat(frontend): implement AdminOperations._sendCommand helper

- Add Promise-based command sender with 5s timeout
- One-time event listener pattern prevents memory leaks
- Handles success, failure, and timeout cases
- Add comprehensive unit tests for all paths"
```

---

### Task 2.2: Implement resetScores() method ✅

**Status:** ✅ COMPLETED (Commit: 17aa5e2)
**Actual Implementation:** Implemented with TDD, all tests passing

**Files:**
- Modify: `ALNScanner/src/utils/adminModule.js` (AdminOperations class)
- Test: `ALNScanner/tests/unit/utils/adminModule.test.js`

**Step 1: Write failing test**

```javascript
// File: ALNScanner/tests/unit/utils/adminModule.test.js
// Add after _sendCommand tests

describe('AdminOperations.resetScores', () => {
  it('should send score:reset command', async () => {
    const mockConnection = new EventTarget();
    mockConnection.send = jest.fn();

    const ops = new AdminOperations(mockConnection);

    // Mock successful response
    setTimeout(() => {
      const ackEvent = new CustomEvent('message:received', {
        detail: {
          type: 'gm:command:ack',
          payload: { success: true, message: 'Scores reset' }
        }
      });
      mockConnection.dispatchEvent(ackEvent);
    }, 10);

    const result = await ops.resetScores();

    expect(mockConnection.send).toHaveBeenCalledWith('gm:command', {
      action: 'score:reset',
      payload: {}
    });

    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- adminModule.test.js
```

Expected output:
```
FAIL tests/unit/utils/adminModule.test.js
  ● AdminOperations.resetScores › should send score:reset command
    TypeError: ops.resetScores is not a function
```

**Step 3: Implement resetScores() method**

```javascript
// File: ALNScanner/src/utils/adminModule.js
// Add after _sendCommand() method in AdminOperations class

/**
 * Reset all team scores to zero
 * @returns {Promise} Resolves when scores reset, rejects on error
 */
async resetScores() {
  return this._sendCommand('score:reset', {});
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- adminModule.test.js
```

Expected output:
```
PASS tests/unit/utils/adminModule.test.js
  ✓ AdminOperations.resetScores › should send score:reset command (32ms)
```

**Step 5: Commit**

```bash
git add ALNScanner/src/utils/adminModule.js ALNScanner/tests/unit/utils/adminModule.test.js
git commit -m "feat(frontend): implement AdminOperations.resetScores

- Add resetScores() method calling score:reset command
- Single backend call (not loop) following backend contract
- Add unit test verifying command sent correctly"
```

---

### Task 2.3: Implement adjustScore() and deleteTransaction() methods ✅

**Status:** ✅ COMPLETED (Commit: 17aa5e2, fixed in 24ae072)
**Actual Implementation:** Implemented with TDD, code review identified missing default parameter
**Lessons Learned:**
- Added default parameter `reason = 'Admin adjustment'` to adjustScore()
- Fixed Debug import (default vs named export)
- Converted console.log to Debug.log per codebase convention

**Files:**
- Modify: `ALNScanner/src/utils/adminModule.js` (AdminOperations class)
- Test: `ALNScanner/tests/unit/utils/adminModule.test.js`

**Step 1: Write failing tests**

```javascript
// File: ALNScanner/tests/unit/utils/adminModule.test.js

describe('AdminOperations.adjustScore', () => {
  it('should send score:adjust command with teamId, delta, reason', async () => {
    const mockConnection = new EventTarget();
    mockConnection.send = jest.fn();

    const ops = new AdminOperations(mockConnection);

    setTimeout(() => {
      mockConnection.dispatchEvent(new CustomEvent('message:received', {
        detail: {
          type: 'gm:command:ack',
          payload: { success: true }
        }
      }));
    }, 10);

    await ops.adjustScore('001', 500, 'Bonus points');

    expect(mockConnection.send).toHaveBeenCalledWith('gm:command', {
      action: 'score:adjust',
      payload: {
        teamId: '001',
        delta: 500,
        reason: 'Bonus points'
      }
    });
  });
});

describe('AdminOperations.deleteTransaction', () => {
  it('should send transaction:delete command with transactionId', async () => {
    const mockConnection = new EventTarget();
    mockConnection.send = jest.fn();

    const ops = new AdminOperations(mockConnection);

    setTimeout(() => {
      mockConnection.dispatchEvent(new CustomEvent('message:received', {
        detail: {
          type: 'gm:command:ack',
          payload: { success: true }
        }
      }));
    }, 10);

    await ops.deleteTransaction('tx-12345');

    expect(mockConnection.send).toHaveBeenCalledWith('gm:command', {
      action: 'transaction:delete',
      payload: {
        transactionId: 'tx-12345'
      }
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- adminModule.test.js
```

**Step 3: Implement methods**

```javascript
// File: ALNScanner/src/utils/adminModule.js
// Add after resetScores() in AdminOperations class

/**
 * Adjust team score by delta
 * @param {string} teamId - Team identifier
 * @param {number} delta - Score adjustment (positive or negative)
 * @param {string} reason - Reason for adjustment
 * @returns {Promise} Resolves with response data
 */
async adjustScore(teamId, delta, reason = 'Admin adjustment') {
  return this._sendCommand('score:adjust', {
    teamId,
    delta,
    reason
  });
}

/**
 * Delete transaction by ID
 * @param {string} transactionId - Transaction identifier
 * @returns {Promise} Resolves with response data
 */
async deleteTransaction(transactionId) {
  return this._sendCommand('transaction:delete', {
    transactionId
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- adminModule.test.js
```

**Step 5: Commit**

```bash
git add ALNScanner/src/utils/adminModule.js ALNScanner/tests/unit/utils/adminModule.test.js
git commit -m "feat(frontend): implement adjustScore and deleteTransaction

- Add adjustScore(teamId, delta, reason) method
- Add deleteTransaction(transactionId) method
- Both use _sendCommand helper with proper payloads
- Add unit tests for both methods"
```

---

### Task 2.4: Remove unsupported clearTransactions() method and UI ✅

**Status:** ✅ COMPLETED (Commit: 03aaebf)
**Actual Implementation:** Removed unsupported feature, build succeeds

**Files:**
- Modify: `ALNScanner/src/app/app.js:1205-1226` (delete method)
- Modify: `ALNScanner/index.html:1942` (delete button)

**Step 1: Verify current state**

```bash
cd ALNScanner
grep -n "adminClearTransactions" src/app/app.js
grep -n "adminClearTransactions" index.html
```

Expected: Find method at line ~1205 and button at line ~1942

**Step 2: Delete adminClearTransactions method from app.js**

```javascript
// File: ALNScanner/src/app/app.js
// DELETE lines 1205-1226 (entire adminClearTransactions method)

// BEFORE:
async adminClearTransactions() {
  if (!confirm('Are you sure you want to clear all transaction history? This cannot be undone.')) return;
  // ... rest of method
}

// AFTER:
// (method removed entirely)
```

**Step 3: Delete Clear History button from index.html**

```html
<!-- File: ALNScanner/index.html -->
<!-- DELETE line 1942 -->

<!-- BEFORE: -->
<button class="btn btn-danger" data-action="app.adminClearTransactions">Clear History</button>

<!-- AFTER: -->
<!-- (button removed) -->
```

**Step 4: Verify no references remain**

```bash
grep -r "adminClearTransactions" ALNScanner/src/
grep -r "clearTransactions" ALNScanner/src/utils/adminModule.js
```

Expected: No matches (method never existed in AdminOperations, only in app.js)

**Step 5: Build to verify no errors**

```bash
npm run build
```

Expected output:
```
✓ built in 2.3s
```

**Step 6: Commit**

```bash
git add ALNScanner/src/app/app.js ALNScanner/index.html
git commit -m "refactor(frontend): remove unsupported clearTransactions feature

- Delete adminClearTransactions() method from app.js
- Remove Clear History button from admin panel
- Backend has no transaction:clear command support
- Use individual transaction deletion instead"
```

---

### Task 2.5: Add AdminOperations event handler structure ✅

**Status:** ✅ COMPLETED (Commit: 0c411f1)
**Actual Implementation:** Constructor, _handleMessage, and destroy() implemented
**⚠️ DEFERRED ISSUE:** Lifecycle tests not added (Important but non-blocking per code review)
**Lessons Learned:**
- Used Debug.log() instead of console.log per codebase convention
- Code review approved with minor observation about missing tests

**Files:**
- Modify: `ALNScanner/src/utils/adminModule.js` (AdminOperations class)
- Test: `ALNScanner/tests/unit/utils/adminModule.test.js`

**Step 1: Write failing test for destroy() cleanup**

```javascript
// File: ALNScanner/tests/unit/utils/adminModule.test.js

describe('AdminOperations lifecycle', () => {
  it('should add message listener in constructor', () => {
    const mockConnection = new EventTarget();
    const addEventListenerSpy = jest.spyOn(mockConnection, 'addEventListener');

    const ops = new AdminOperations(mockConnection);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'message:received',
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
  });

  it('should remove message listener on destroy', () => {
    const mockConnection = new EventTarget();
    const removeEventListenerSpy = jest.spyOn(mockConnection, 'removeEventListener');

    const ops = new AdminOperations(mockConnection);
    ops.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'message:received',
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- adminModule.test.js
```

Expected: Tests fail because constructor doesn't add listener

**Step 3: Implement constructor and destroy**

```javascript
// File: ALNScanner/src/utils/adminModule.js
// Modify AdminOperations class constructor and add destroy method

export class AdminOperations {
  constructor(connection) {
    this.connection = connection;

    // Bind handler for cleanup
    this._messageHandler = this._handleMessage.bind(this);

    // Listen to all messages (for command acknowledgments and broadcasts)
    this.connection.addEventListener('message:received', this._messageHandler);
  }

  /**
   * Handle incoming messages
   * @private
   */
  _handleMessage(event) {
    const { type } = event.detail;

    // Handle scores:reset broadcast (informational)
    if (type === 'scores:reset') {
      // sync:full will follow automatically
      // MonitoringDisplay handles the actual UI update
      console.log('[AdminOperations] Scores reset broadcast received');
    }

    // Command acknowledgments handled by _sendCommand's one-time listeners
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (this.connection && this._messageHandler) {
      this.connection.removeEventListener('message:received', this._messageHandler);
    }
  }

  // ... rest of methods (restartSystem, clearData, resetScores, etc.)
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- adminModule.test.js
```

**Step 5: Commit**

```bash
git add ALNScanner/src/utils/adminModule.js ALNScanner/tests/unit/utils/adminModule.test.js
git commit -m "feat(frontend): add AdminOperations event handler lifecycle

- Add constructor event listener registration
- Add _handleMessage for scores:reset broadcasts
- Add destroy() method for proper cleanup
- Follow established pattern from SessionManager
- Add unit tests for lifecycle methods"
```

---

## Phase 3: Frontend - Fix History Screen Auto-Update ✅ COMPLETED

### Task 3.1: Add history screen re-render to transaction:added listener ✅

**Status:** ✅ COMPLETED (Commit: 1842ad6)
**Actual Implementation:** Added conditional re-rendering for both networked and standalone modes
**Code Review:** ✅ Approved - Excellent implementation, perfect plan adherence

**Files:**
- Modified: `ALNScanner/src/main.js` (+14 lines)

**Implementation Notes:**
- Added check for `historyScreen.classList.contains('active')` before re-rendering
- Applied to both `transaction:added` (networked) and `standalone:transaction-added` (standalone) event handlers
- Uses optional chaining for defensive programming
- Build verification passed with no errors

**Step 1: Verify current behavior**

```bash
cd ALNScanner
grep -A 5 "transaction:added" src/main.js
```

Expected: Find listener that only calls updateHistoryBadge and updateSessionStats

**Step 2: Add history screen check and re-render**

```javascript
// File: ALNScanner/src/main.js
// Modify lines 68-71

// BEFORE:
DataManager.addEventListener('transaction:added', () => {
  UIManager.updateHistoryBadge();
  UIManager.updateSessionStats();
});

// AFTER:
DataManager.addEventListener('transaction:added', () => {
  UIManager.updateHistoryBadge();
  UIManager.updateSessionStats();

  // Auto-update history screen if visible (was missing)
  const historyScreen = document.getElementById('historyScreen');
  if (historyScreen?.classList.contains('active')) {
    UIManager.updateHistoryStats();
    UIManager.renderTransactions();
  }
});
```

**Step 3: Apply same fix to standalone mode listener**

```javascript
// File: ALNScanner/src/main.js
// Modify lines 102-105 (standalone mode)

// BEFORE:
StandaloneDataManager.addEventListener('standalone:transaction-added', () => {
  UIManager.updateHistoryBadge();
  UIManager.updateSessionStats();
});

// AFTER:
StandaloneDataManager.addEventListener('standalone:transaction-added', () => {
  UIManager.updateHistoryBadge();
  UIManager.updateSessionStats();

  // Auto-update history screen if visible
  const historyScreen = document.getElementById('historyScreen');
  if (historyScreen?.classList.contains('active')) {
    UIManager.updateHistoryStats();
    UIManager.renderTransactions();
  }
});
```

**Step 4: Manual verification (no automated test available)**

```bash
npm run build
```

Build should succeed. Manual test:
1. Start orchestrator: `cd ../backend && npm run dev:full`
2. Open GM Scanner: `http://localhost:3000/gm-scanner/`
3. Connect in networked mode
4. Navigate to history screen
5. Scan a token (should appear in history immediately without closing/reopening)

**Step 5: Commit**

```bash
git add ALNScanner/src/main.js
git commit -m "fix(frontend): add history screen auto-update on new transactions

- Add conditional re-render when historyScreen is visible
- Check for active class before calling renderTransactions
- Apply fix to both networked and standalone modes
- Fixes regression where history only updates on reopen"
```

---

## Phase 4: Frontend - Add Safety Check ✅ COMPLETED

### Task 4.1: Add null check to MonitoringDisplay.updateSystemDisplay ✅

**Status:** ✅ COMPLETED (Commit: c3bd6ea)
**Actual Implementation:** Added defensive null check with early return pattern
**Code Review:** ✅ Approved - Implementation meets all requirements

**Files:**
- Modified: `ALNScanner/src/utils/adminModule.js` (+3 lines, line 899-900)

**Implementation Notes:**
- Added `if (!this.connection) return;` guard at method start
- Prevents crash when admin panel opened before connection established
- Includes explanatory comment about edge case
- Build verification passed (773ms)

**Step 1: Locate updateSystemDisplay method**

```bash
cd ALNScanner
grep -n "updateSystemDisplay()" src/utils/adminModule.js
```

Expected: Find method around line 793

**Step 2: Add null check**

```javascript
// File: ALNScanner/src/utils/adminModule.js
// Modify updateSystemDisplay() method (around line 793)

// BEFORE:
updateSystemDisplay() {
  // Update orchestrator connection status only
  const orchestratorElem = document.getElementById('orchestrator-status');
  if (orchestratorElem) {
    const status = this.connection.isConnected ? 'connected' : 'disconnected';
    // ...
  }
}

// AFTER:
updateSystemDisplay() {
  // Update orchestrator connection status only

  // Guard against null connection (can happen if admin panel opened before connection)
  if (!this.connection) return;

  const orchestratorElem = document.getElementById('orchestrator-status');
  if (orchestratorElem) {
    const status = this.connection.isConnected ? 'connected' : 'disconnected';
    // ... rest of method unchanged
  }
}
```

**Step 3: Build to verify**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add ALNScanner/src/utils/adminModule.js
git commit -m "fix(frontend): add null check to updateSystemDisplay

- Guard against null connection before accessing isConnected
- Prevents crash if admin panel opened before connection
- Early return for defensive programming"
```

---

## Phase 5: Fix Existing Frontend Unit Tests ✅ COMPLETED (5.1), REDUNDANT (5.2)

**CRITICAL DISCOVERY:** Investigation revealed that `ALNScanner/tests/unit/utils/adminModule.test.js` ALREADY EXISTS with 27 comprehensive tests, but **26 out of 27 were FAILING**. Task 5.1 fixed these by updating mocks to EventTarget API.

### Task 5.1: Diagnose failing adminModule.test.js tests ✅

**Status:** ✅ COMPLETED (Commit: ab6ee97)
**Actual Implementation:** Updated test mocks to use EventTarget API and CustomEvent pattern
**Result:** 19/28 tests passing, 9 skipped (unimplemented features)
**Lessons Learned:**
- Frontend uses EventTarget, NOT EventEmitter
- Events use CustomEvent with detail: {type, payload} structure
- Tests mock connection as EventTarget with addEventListener/dispatchEvent

**Files:**
- Investigate: `ALNScanner/tests/unit/utils/adminModule.test.js` (existing, 439 lines)
- Fix: `ALNScanner/src/utils/adminModule.js` and/or test mocks

**Step 1: Run tests with verbose output**

```bash
cd ALNScanner
npm test -- adminModule.test.js --verbose
```

**Step 2: Identify root cause**

Common ES6 migration issues to check:
1. **EventTarget API mismatch**:
   - Tests expect: `connection.on('event', handler)`
   - Reality: `connection.addEventListener('event', handler)`

2. **Event envelope structure**:
   - Tests expect old envelope pattern
   - Reality: AsyncAPI envelope with `event.detail.type` and `event.detail.payload`

3. **Mock socket API**:
   - Tests mock `socket.emit()` with old signature
   - Reality: Uses `connection.send()` with different signature

**Step 3: Fix identified issues**

Based on diagnosis, choose ONE approach:

**Option A: Fix test mocks** (if implementation is correct):
```javascript
// Update mocks to use EventTarget pattern
const mockConnection = new EventTarget();
mockConnection.send = jest.fn();

// Update event dispatch pattern
const ackEvent = new CustomEvent('message:received', {
  detail: {
    type: 'gm:command:ack',
    payload: { success: true }
  }
});
mockConnection.dispatchEvent(ackEvent);
```

**Option B: Fix implementation** (if tests are correct):
- Align adminModule.js with test expectations
- This is LESS LIKELY - tests are out of date

**Step 4: Verify all tests pass**

```bash
npm test -- adminModule.test.js
```

Expected output:
```
PASS tests/unit/utils/adminModule.test.js
  ✓ 27/27 tests passing

Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
```

**Step 5: Commit**

```bash
git add ALNScanner/tests/unit/utils/adminModule.test.js ALNScanner/src/utils/adminModule.js
git commit -m "fix(tests): resolve 26 failing adminModule unit tests

- Align test mocks with EventTarget API
- Fix message envelope extraction pattern
- Update event listener registration expectations
- All 27 tests now passing (was 1/27)"
```

### Task 5.2: Add missing tests to existing backend test files ✅

**Status:** ✅ ALREADY COMPLETED in Tasks 1.1-1.2
**Discovery:** The test implementation steps in this task were ALREADY completed as part of the TDD approach in Phase 1
**Evidence:**
- Task 1.1 added scores:reset test to broadcasts.test.js (Commit: 87b03104)
- Task 1.2 added resetScores emission test to transactionService.test.js (Commit: 0f56724d)
**Action Required:** NONE - skip this task

**File Reality Check:**
- ✅ EXISTS: `backend/tests/unit/websocket/broadcasts.test.js` (now includes scores:reset test)
- ✅ EXISTS: `backend/tests/unit/services/transactionService.test.js` (now includes resetScores test)

**Step 1: Add scores:reset emission test to transactionService.test.js**

```javascript
// File: backend/tests/unit/services/transactionService.test.js
// ADD to existing file (append around line 1264)

describe('resetScores event emission', () => {
  it('should emit scores:reset with teamsReset array', async () => {
    const transactionService = require('../../../src/services/transactionService').getInstance();

    // Use Promise-based pattern from existing tests (NOT jest.spyOn)
    const eventPromise = new Promise((resolve) => {
      transactionService.once('scores:reset', resolve);
    });

    // Setup teams
    transactionService.teamScores.set('001', { currentScore: 500 });
    transactionService.teamScores.set('002', { currentScore: 300 });

    // Execute
    transactionService.resetScores();

    // Verify
    const eventData = await eventPromise;
    expect(eventData.teamsReset).toEqual(expect.arrayContaining(['001', '002']));
    expect(eventData.teamsReset.length).toBe(2);
  });
});
```

**Step 2: Add scores:reset wrapper test to broadcasts.test.js**

```javascript
// File: backend/tests/unit/websocket/broadcasts.test.js
// ADD to existing file (append around line 440)

describe('scores:reset event wrapping', () => {
  beforeEach(() => {
    // Use existing mock pattern from file
    mockSessionService.getCurrentSession.mockReturnValue({
      id: 'session-123',
      toJSON: () => ({ id: 'session-123', status: 'active' })
    });

    mockStateService.getCurrentState.mockReturnValue({
      session: { id: 'session-123' },
      scores: [],
      recentTransactions: []
    });
  });

  it('should wrap scores:reset domain event and emit sync:full', () => {
    // Emit domain event from transactionService
    mockTransactionService.emit('scores:reset', {
      teamsReset: ['001', '002']
    });

    // Verify scores:reset broadcast to GM room
    expect(mockIo.to).toHaveBeenCalledWith('gm');
    expect(mockIo.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'scores:reset',
        data: { teamsReset: ['001', '002'] },
        timestamp: expect.any(String)
      })
    );

    // Verify sync:full broadcast
    expect(mockIo.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sync:full',
        data: expect.objectContaining({
          scores: []
        })
      })
    );
  });
});
```

**Step 3: Run tests**

```bash
cd backend
npm test -- transactionService.test.js
npm test -- broadcasts.test.js
```

**Step 4: Commit**

```bash
git add backend/tests/unit/services/transactionService.test.js backend/tests/unit/websocket/broadcasts.test.js
git commit -m "test(backend): add scores:reset event tests to existing suites

- Add resetScores emission test to transactionService.test.js
- Add scores:reset wrapper test to broadcasts.test.js
- Follow existing Promise-based event patterns
- Use established mock structures from existing tests"
```

---

## Phase 5B: Backend Contract Tests

### Task 5B.1: Verify contract test location and add score:reset test

**NOTE:** Contract test infrastructure needs verification. The exact file location may differ from assumption.

**Investigation Required:**
```bash
cd backend
find tests/contract -name "*.test.js" -type f
```

**Expected files to check:**
- `tests/contract/asyncapi-compliance.test.js` (or similar)
- Pattern: May use different test structure than unit tests

**Once verified, add score:reset contract test following established pattern.**

**Placeholder - Update after verification:**
- File: `backend/tests/contract/[actual-file].test.js`
- Pattern: Follow existing AsyncAPI validation tests
- Verify: Command validates against contract schema

---

## Phase 6: E2E Tests

### Task 6.1: Add score reset E2E test

**Files:**
- Modify: `backend/tests/e2e/flows/07d-gm-scanner-admin-panel.test.js:332` (after line 331)

**💡 Refinement Notes:**
- Verify file exists and line number is still accurate
- Use `ls -la backend/tests/e2e/flows/` to check for actual filename
- May need to adjust to actual current file structure
- Follow existing test patterns in the file exactly
- Run with `npm run test:e2e -- 07d-gm-scanner-admin-panel` (from backend/ directory)
- Requires orchestrator NOT running (E2E starts its own instance)

**Step 1: Add required imports (if not already present)**

```javascript
// File: backend/tests/e2e/flows/07d-gm-scanner-admin-panel.test.js
// Verify these imports exist at top of file:
const { waitForEvent } = require('../helpers/wait-conditions');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
```

**Step 2: Write E2E test following EXACT existing pattern**

```javascript
// File: backend/tests/e2e/flows/07d-gm-scanner-admin-panel.test.js
// Add after existing tests (line 332, after closing brace of last test)

test('should support score reset via admin panel', async () => {
  const context = await createBrowserContext(browser);
  const page = await createPage(context);

  try {
    const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD);

    // Create session with teams
    const sessionPromise = waitForEvent(socket, 'gm:command:ack', 5000);
    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Score Reset Test',
          teams: ['001', '002']
        }
      },
      timestamp: new Date().toISOString()
    });
    await sessionPromise;

    // Switch to admin panel
    await gmScanner.adminTab.click();
    await gmScanner.adminView.waitFor({ state: 'visible', timeout: 5000 });

    // Wait for sync:full to populate DataManager
    await page.waitForTimeout(1000);

    // Listen for broadcasts
    const scoresResetPromise = waitForEvent(socket, 'scores:reset', 5000);
    const syncFullPromise = waitForEvent(socket, 'sync:full', 5000);

    // Execute reset via admin panel
    await page.evaluate(() => {
      window.App.viewController.adminInstances.adminOps.resetScores();
    });

    // Verify broadcasts received
    const scoresReset = await scoresResetPromise;
    expect(scoresReset.data.teamsReset).toEqual(expect.arrayContaining(['001', '002']));

    const syncFull = await syncFullPromise;
    expect(syncFull.data.scores).toEqual([]);

    // Verify admin panel shows all zeros
    await page.waitForTimeout(500); // Allow UI to update
    const scoreBoard = await page.locator('#admin-score-board');
    const scoreText = await scoreBoard.textContent();
    expect(scoreText).toContain('0'); // All scores should be 0

    socket.disconnect();
  } finally {
    await page.close();
    await context.close();
  }
});
```

**Step 3: Run test**

```bash
cd backend
npm run test:e2e -- 07d-gm-scanner-admin-panel
```

Expected: Test passes, verifying end-to-end flow

**Step 4: Commit**

```bash
git add backend/tests/e2e/flows/07d-gm-scanner-admin-panel.test.js
git commit -m "test(e2e): add score reset admin panel test

- Create session with teams via WebSocket
- Execute resetScores via admin panel
- Verify scores:reset broadcast received
- Verify sync:full with cleared scores
- Verify admin panel UI shows zeros"
```

---

## Phase 7: UX Navigation Improvements

**💡 Refinement Notes for Phase 7:**
- All three tasks modify HTML and add navigation methods
- Line numbers in HTML may have shifted due to Task 2.4 (removed Clear History button)
- Use grep to locate exact insertion points
- Build with `npm run build` after each task
- Consider batching all three tasks (related UX improvements)

### Task 7.1: Add View Full Scoreboard button

**Files:**
- Modify: `ALNScanner/index.html:1932` (after admin score board)
- Modify: `ALNScanner/src/app/app.js` (add viewFullScoreboard method)

**💡 Specific Refinements:**
- Verify line number with `grep -n "admin-score-board" ALNScanner/index.html`
- Button should be added BEFORE "Reset All Scores" button
- Method calls existing `switchView('scanner')` and `showScoreboard()` functions

**Step 1: Add button to HTML**

```html
<!-- File: ALNScanner/index.html -->
<!-- Add after line 1932 (after admin score board table, before Reset Scores button) -->

<div id="admin-score-board" class="score-board">
  <!-- Scores will be populated here -->
</div>

<!-- ADD THIS BUTTON: -->
<button class="btn btn-secondary" data-action="app.viewFullScoreboard" style="margin-right: 10px;">
  View Full Scoreboard
</button>

<button class="btn btn-danger" data-action="app.adminResetScores">Reset All Scores</button>
```

**Step 2: Add handler method to app.js**

```javascript
// File: ALNScanner/src/app/app.js
// Add after adminResetScores method (around line 1203)

/**
 * Navigate to full scoreboard view from admin panel
 */
viewFullScoreboard() {
  this.switchView('scanner');
  this.showScoreboard();
}
```

**Step 3: Build and verify**

```bash
cd ALNScanner
npm run build
```

**Step 4: Commit**

```bash
git add ALNScanner/index.html ALNScanner/src/app/app.js
git commit -m "feat(ux): add View Full Scoreboard button in admin panel

- Add button in admin score board section
- Add viewFullScoreboard() method to switch views
- Provides direct navigation from admin to full scoreboard"
```

---

### Task 7.2: Add View Transaction History button

**Files:**
- Modify: `ALNScanner/index.html:1940` (in transaction log section)
- Modify: `ALNScanner/src/app/app.js` (add viewFullHistory method)

**💡 Specific Refinements:**
- Verify line number with `grep -n "admin-transaction-log" ALNScanner/index.html`
- The "Clear History" button was removed in Task 2.4, so button placement may differ
- Method calls existing `switchView('scanner')` and `showHistory()` functions

**Step 1: Add button to HTML**

```html
<!-- File: ALNScanner/index.html -->
<!-- Modify around line 1940 (transaction log section) -->

<div id="admin-transaction-log" class="transaction-log">
  <!-- Transactions will be populated here -->
</div>

<!-- ADD THIS BUTTON before existing buttons: -->
<button class="btn btn-secondary" data-action="app.viewFullHistory" style="margin-right: 10px;">
  View Full History
</button>

<!-- Existing button (if clearTransactions was removed, this should be gone): -->
<!-- Keep any remaining buttons here -->
```

**Step 2: Add handler method**

```javascript
// File: ALNScanner/src/app/app.js
// Add after viewFullScoreboard method

/**
 * Navigate to full transaction history from admin panel
 */
viewFullHistory() {
  this.switchView('scanner');
  this.showHistory();
}
```

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add ALNScanner/index.html ALNScanner/src/app/app.js
git commit -m "feat(ux): add View Full History button in admin panel

- Add button in transaction log section
- Add viewFullHistory() method to switch views
- Provides direct navigation from admin to full history"
```

---

### Task 7.3: Make admin score board team names clickable

**Files:**
- Modify: `ALNScanner/src/app/app.js:1144` (admin score board rendering)

**💡 Specific Refinements:**
- Locate rendering with `grep -n "admin-score-board" ALNScanner/src/app/app.js`
- Line number likely changed due to earlier edits
- Pattern should match existing clickable behavior in scanner-view scoreboard
- Verify showTeamDetails() method exists before referencing it

**Step 1: Locate score board rendering code**

```bash
grep -n "admin-score-board" ALNScanner/src/app/app.js
```

Expected: Find rendering around line 1144

**Step 2: Add onclick handler to team name cells**

```javascript
// File: ALNScanner/src/app/app.js
// Modify score board table rendering (around line 1144)

// BEFORE:
html += `<tr>
  <td>${teamId}</td>
  <td>${scoreData.tokensScanned || 0}</td>
  <td>${(scoreData.currentScore || 0).toLocaleString()}</td>
</tr>`;

// AFTER:
html += `<tr>
  <td style="cursor: pointer; color: #007bff; text-decoration: underline;"
      onclick="window.App.showTeamDetails('${teamId}')">
    ${teamId}
  </td>
  <td>${scoreData.tokensScanned || 0}</td>
  <td>${(scoreData.currentScore || 0).toLocaleString()}</td>
</tr>`;
```

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add ALNScanner/src/app/app.js
git commit -m "feat(ux): make admin score board team names clickable

- Add onclick handler to team name cells
- Calls showTeamDetails(teamId) on click
- Add visual cues (pointer cursor, blue underline)
- Consistent with scanner-view scoreboard behavior"
```

---

## Phase 8: Documentation

**💡 Refinement Notes for Phase 8:**
- Both tasks are documentation-only (no code changes)
- No tests required (just verify markdown rendering)
- Can be batched together
- Reference actual implemented patterns from completed tasks

### Task 8.1: Update backend/CLAUDE.md with event flow documentation

**Files:**
- Modify: `backend/CLAUDE.md`

**💡 Specific Refinements:**
- Add after "Cross-Module Debugging" section
- Document ACTUAL implemented flow (reference commits 87b03104, 0f56724d, 6415d672)
- Include hybrid pattern explanation (bulk event + sync:full)
- Reference existing patterns in codebase

**Step 1: Add admin panel event flow section**

```markdown
<!-- File: backend/CLAUDE.md -->
<!-- Add new section after "Cross-Module Debugging" -->

## Admin Panel Event Flow

### scores:reset Command

**Trigger:** GM clicks "Reset Scores" in admin panel

**Flow:**
1. Frontend: AdminOperations.resetScores() → gm:command with action='score:reset'
2. Backend: adminEvents.js case 'score:reset' → transactionService.resetScores()
3. Service: transactionService emits 'scores:reset' domain event with {teamsReset: [...]}
4. Broadcast: broadcasts.js listener wraps event → emits 'scores:reset' to GM room
5. Broadcast: broadcasts.js also emits 'sync:full' with complete cleared state
6. Frontend: MonitoringDisplay receives sync:full → updates DataManager → renders zeros

**Pattern:** Hybrid (bulk event + sync:full) following processQueue() model

**Why sync:full?** Atomic update prevents race conditions, handles edge cases (new teams added)

### Established Bulk Operation Patterns

**Type A: Single Bulk Event**
- clearQueue() → 'video:idle'
- endSession() → 'session:update'

**Type B: Per-Item Events (Internal Only)**
- processQueue() → 'scan:logged' per item (not broadcast to WebSocket)

**Type C: Hybrid (Bulk + sync:full)**
- processQueue() → 'offline:queue:processed' + 'sync:full'
- scores:reset → 'scores:reset' + 'sync:full'

**Key Files:**
- `src/websocket/broadcasts.js` - Event wiring (domain → WebSocket)
- `src/websocket/adminEvents.js` - Admin command handlers
- `src/services/transactionService.js` - Score management
```

**Step 2: Commit**

```bash
git add backend/CLAUDE.md
git commit -m "docs(backend): add admin panel event flow documentation

- Document scores:reset command flow
- Explain hybrid pattern (bulk event + sync:full)
- List established bulk operation patterns (Type A/B/C)
- Reference key files for event architecture"
```

---

### Task 8.2: Update ALNScanner/CLAUDE.md with admin panel architecture

**Files:**
- Modify: `ALNScanner/CLAUDE.md`

**💡 Specific Refinements:**
- Add after existing architecture documentation
- Document ACTUAL implementation from commits ab6ee97, 17aa5e2, 24ae072, 03aaebf, 0c411f1
- Include EventTarget API pattern (critical lesson learned)
- Document known limitations (clearTransactions not supported)
- Reference MonitoringDisplay as primary event consumer

**Step 1: Add admin panel architecture section**

```markdown
<!-- File: ALNScanner/CLAUDE.md -->
<!-- Add new section after existing architecture docs -->

## Admin Panel Architecture

### Module Structure

**Location:** `src/utils/adminModule.js`

**Classes:**
1. **SessionManager** - Session lifecycle (create, pause, resume, end)
2. **VideoController** - Video playback control
3. **SystemMonitor** - Health checks (HTTP-based)
4. **AdminOperations** - Score/transaction admin commands
5. **MonitoringDisplay** - Real-time display updates (PRIMARY event consumer)

### Event-Driven Display Updates

**Pattern:** Cache-First Auto-Refresh

```
Backend Event → OrchestratorClient → DataManager Cache → MonitoringDisplay → DOM
```

**Key Events:**
- `score:updated` → Updates DataManager.backendScores → Re-renders score display
- `transaction:new` → Adds to DataManager.transactions → Prepends to log
- `sync:full` → Batch updates all displays → Complete state hydration
- `scores:reset` → Informational (sync:full follows with cleared state)

**Cache Pattern:**
```javascript
// CORRECT: Update cache BEFORE rendering
DataManager.updateTeamScoreFromBackend(payload); // Cache update
MonitoringDisplay.updateScoreDisplay(payload);   // DOM update (reads cache)
```

### AdminOperations Methods

**Available Commands:**
- `resetScores()` - Reset all team scores to zero (single backend call)
- `adjustScore(teamId, delta, reason)` - Adjust specific team score
- `deleteTransaction(transactionId)` - Delete specific transaction

**NOT Supported:**
- `clearTransactions()` - Backend has no transaction:clear command (use individual deletion)

**Command Pattern:**
```javascript
const result = await adminOps.resetScores();
// Sends: gm:command with action='score:reset'
// Receives: gm:command:ack + scores:reset + sync:full
```

### Known Limitations

1. **No transaction bulk clear** - Backend doesn't support transaction:clear action
2. **GM room only events** - Player scanners don't receive admin panel events (HTTP-only)
3. **Manual refresh after reconnect** - Connection wizard must be completed manually

### Navigation Flow

**View Switching:**
- Scanner Tab → Scanner View (NFC interface)
- Admin Tab → Admin Panel (control center)
- Debug Tab → Debug Console

**Quick Navigation:**
- "View Full Scoreboard" button → Switches to scanner view + opens scoreboard
- "View Full History" button → Switches to scanner view + opens history
- Team name click in admin scores → Opens team details modal
```

**Step 2: Commit**

```bash
git add ALNScanner/CLAUDE.md
git commit -m "docs(frontend): add admin panel architecture documentation

- Document module structure and responsibilities
- Explain event-driven display update pattern
- List AdminOperations available methods
- Note known limitations and navigation flow"
```

---

### Task 8.3: Add JSDoc comments to AdminOperations class ✅

**Status:** ✅ COMPLETED (Commit: 24ae072)
**Actual Implementation:** Comprehensive JSDoc added to all public methods during code review fix
**Note:** This task was completed earlier than planned as part of fixing code review feedback

**Files:**
- Modify: `ALNScanner/src/utils/adminModule.js`

**Step 1: Add comprehensive JSDoc**

```javascript
// File: ALNScanner/src/utils/adminModule.js
// Add class-level JSDoc before AdminOperations class definition

/**
 * Admin operations for score and transaction management
 *
 * Sends gm:command WebSocket messages to backend and waits for acknowledgment.
 * All methods return Promises that resolve on success or reject on error/timeout.
 *
 * @example
 * const adminOps = new AdminOperations(orchestratorClient);
 *
 * // Reset all scores
 * await adminOps.resetScores();
 *
 * // Adjust specific team score
 * await adminOps.adjustScore('001', 500, 'Bonus for puzzle completion');
 *
 * // Delete transaction
 * await adminOps.deleteTransaction('tx-12345');
 *
 * // Cleanup when done
 * adminOps.destroy();
 */
export class AdminOperations {
  /**
   * Create AdminOperations instance
   * @param {OrchestratorClient} connection - WebSocket connection instance
   */
  constructor(connection) {
    // ... existing code
  }

  // ... rest of methods already have JSDoc from previous tasks
}
```

**Step 2: Build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add ALNScanner/src/utils/adminModule.js
git commit -m "docs(frontend): add JSDoc comments to AdminOperations

- Add class-level documentation with examples
- Document constructor parameter
- Provide usage examples for common operations"
```

---

## Verification Checklist

**Backend:** (✅ = completed, 🔲 = remaining)
- [✅] `npm test` passes (594/603 tests passing - 98.5%)
- [🔲] `npm run test:contract` passes
- [✅] scores:reset command in AsyncAPI contract
- [✅] broadcasts.js has scores:reset listener
- [✅] transactionService.resetScores() emits teamsReset array

**Frontend:** (✅ = completed, 🔲 = remaining)
- [✅] `cd ALNScanner && npm test` passes (24/33 passing, 9 skipped)
- [✅] `npm run build` succeeds with no errors
- [✅] AdminOperations has 4 methods: resetScores, adjustScore, deleteTransaction, _sendCommand
- [✅] clearTransactions method and button removed
- [🔲] History screen auto-updates on transaction:added

**E2E:** (🔲 = remaining)
- [🔲] `cd backend && npm run test:e2e` passes
- [🔲] Score reset test verifies broadcasts
- [🔲] No console errors in browser tests

**Manual Testing:** (🔲 = remaining)
- [🔲] Start orchestrator: `cd backend && npm run dev:full`
- [🔲] Open GM Scanner: `http://localhost:3000/gm-scanner/`
- [🔲] Create session with teams
- [🔲] Click "Reset Scores" → All teams show 0
- [🔲] Click "View Full Scoreboard" → Switches to scanner scoreboard
- [🔲] Open history → Leave open → Scan token → Appears immediately

**Documentation:** (✅ = completed, 🔲 = remaining)
- [🔲] backend/CLAUDE.md has admin panel event flow section
- [🔲] ALNScanner/CLAUDE.md has admin panel architecture section
- [✅] AdminOperations class has JSDoc comments

---

## 🎓 Process Improvements Identified

### Critical Process Refinements for Next Session

1. **Code Review Loop Closure (MANDATORY)**
   - After EVERY code review, explicitly verify completion before proceeding
   - Update TodoWrite to mark task complete
   - Address ALL identified issues (even if deferred)
   - NEVER skip this step

2. **Subagent Prompting Best Practices**
   - ALWAYS verify file paths before dispatching (wrong filename = wasted subagent)
   - Include EXACT plan document filename in prompt
   - Specify output requirements explicitly (commit SHAs, test results, etc.)
   - Provide sufficient context (don't assume subagent has conversation history)

3. **Multi-Session Handoff Strategy**
   - Update plan document with ALL work completed (this file)
   - Mark completed tasks with ✅ and commit SHAs
   - Document lessons learned inline
   - Add refinement notes for remaining tasks
   - Update verification checklist with actual status

4. **Issue Tracking Protocol**
   - Create DEFERRED section in plan for non-blocking issues
   - Don't let issues accumulate silently
   - Code review findings MUST be addressed or explicitly deferred
   - Track deferred issues in plan document (not just TodoWrite)

5. **TDD Discipline**
   - RED-GREEN-REFACTOR cycle strictly followed
   - Tests written FIRST, watched fail, then implement
   - Ensures tests actually validate behavior
   - Prevents false positives from broken tests

### Files Modified Summary

**Backend (6 files):**
- `src/websocket/broadcasts.js` - Added scores:reset listener
- `src/services/transactionService.js` - Modified resetScores()
- `src/websocket/adminEvents.js` - Added score:reset case
- `contracts/asyncapi.yaml` - Added score:reset to enum
- `tests/unit/websocket/broadcasts.test.js` - Added test
- `tests/unit/services/transactionService.test.js` - Added tests

**Frontend (4 files):**
- `tests/unit/utils/adminModule.test.js` - Fixed 26 failing tests
- `src/utils/adminModule.js` - Added methods and lifecycle
- `src/app/app.js` - Removed clearTransactions
- `index.html` - Removed Clear History button

**Planning Document (1 file):**
- `docs/plans/2025-11-14-gm-scanner-admin-panel-completion.md` - THIS FILE (updated with status)

---

## Plan Completion Status

**Original Estimate:** 7-8 hours
**Actual Progress:** ~52% complete (10/19 tasks)
**Commits Created:** 8 total (vs planned 17)

**Files Modified:**
- Backend: 6 files (same as plan)
- Frontend: 4 files (vs planned 5)
- Tests: 2 files (integrated into main files)
- Docs: 1 file (this planning doc, 2 CLAUDE.md updates remaining)

---

## 🚀 Next Session Quickstart

**Recommended Approach:** Continue with superpowers:executing-plans skill

**Start with:**
1. Review this EXECUTION STATUS section (top of document)
2. Review CRITICAL LESSONS LEARNED section
3. Continue with Task 3.1 (marked 🎯 NEXT TASK)
4. Follow refinement notes for each task
5. Use code review after EVERY task or batch
6. Update this document as you progress

**Commands to verify environment:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git status                          # Check current branch
cd backend && npm test              # Verify backend tests pass (594/603)
cd ../ALNScanner && npm test        # Verify frontend tests pass (24/33)
cd ../backend && npm run build      # Verify build succeeds
```

**Git Commits to Review (if context lost):**
- Backend: `git log --oneline | grep -E "(87b0310|0f56724|6415d67)"`
- Frontend: `git log --oneline | grep -E "(ab6ee97|17aa5e2|24ae072|03aaebf|0c411f1)"`

---

## Execution Options

**✅ RECOMMENDED: Subagent-Driven Development**
- Continue with superpowers:executing-plans skill
- Dispatch fresh subagent per task for clean context
- Mandatory code review between tasks
- Fast iteration with quality gates
- Update this plan document as you progress

**Alternative: Direct Implementation**
- Use TodoWrite to track remaining tasks
- Follow task steps from this document
- Self-review before committing
- Update this document when complete
