# ALN Ecosystem: Architecture Issues Backlog (P1-P3)

**Document Version**: 1.0
**Date Created**: 2025-09-29
**Status**: Backlog (Not Yet Implemented)

**Note**: This document contains P1-P3 priority issues identified during architecture review. P0 critical issues are documented in `ARCHITECTURE_ISSUES_AND_FIXES.md`.

---

## 🟡 P1 - HIGH PRIORITY ISSUES

---

## Issue #5: Session Lifecycle Not Properly Managed 🟡 HIGH

### Module: GM Scanner Session Mode Management
**File**: `ALNScanner/index.html`
**Lines**: 4612-4675 (SessionModeManager class)

### The Issue
SessionModeManager has a `locked` flag but no proper lifecycle management:
- No `startGame()`, `endSession()`, `resetForNewGame()` methods
- Lock happens immediately on mode selection (not on first scan/game start)
- No UI feedback when mode is locked
- No way to unlock except page reload or manual localStorage clear
- Lock state doesn't reflect actual game state

### Current Behavior
```javascript
setMode(mode) {
    if (this.locked) {
        throw new Error('Cannot change session mode after game start');
    }
    this.mode = mode;
    this.locked = true;  // ← Locks immediately!
    localStorage.setItem('gameSessionMode', mode);
}
```

### Intended Behavior
Mode should be selectable but not locked until game actually starts (first token scan). Between games, should be unlockable without page reload.

**Lifecycle should be:**
```
Select Mode → Connect (if networked) → Start Game (lock on first scan) → Play → End Session (unlock) → Select Mode Again
```

### Impact
- Users can't switch modes between games without page reload
- Testing is difficult (constant localStorage clearing)
- "Locked" state doesn't match user mental model
- No explicit "start game" moment

### Proposed Fix
Add proper lifecycle methods:

```javascript
class SessionModeManager {
    constructor() {
        this.mode = null;
        this.locked = false;
        this.gameStarted = false;  // NEW: track if game in progress
    }

    setMode(mode) {
        if (this.locked && this.gameStarted) {
            throw new Error('Cannot change mode during active game');
        }
        this.mode = mode;
        // Don't lock yet - lock on first scan
        localStorage.setItem('gameSessionMode', mode);

        if (mode === 'networked') {
            this.initNetworkedMode();
        } else {
            this.initStandaloneMode();
        }
    }

    startGame() {
        // Called on first token scan
        if (!this.mode) throw new Error('Mode must be selected first');
        this.locked = true;
        this.gameStarted = true;
        Debug.log('Game started, mode locked:', this.mode);
    }

    endSession() {
        // Called when user explicitly ends session
        this.locked = false;
        this.gameStarted = false;
        Debug.log('Session ended, mode can be changed');
    }

    resetForNewGame() {
        // Full reset - clears everything
        this.locked = false;
        this.gameStarted = false;
        this.mode = null;
        localStorage.removeItem('gameSessionMode');
        UIManager.showScreen('gameModeScreen');
        Debug.log('Reset for new game - mode selection required');
    }
}
```

### Verification Steps
1. Select mode → Mode selected but not locked
2. Scan first token → Mode locks
3. Try to change mode → Error shown
4. End session → Mode unlocks
5. Select different mode → Works without page reload

### Priority
🟡 **P1 - HIGH**: Improves UX significantly, but workarounds exist (page reload)

---

## Issue #6: No Transaction Queue Size Limits 🟡 HIGH

### Module: GM Scanner Queue Management
**File**: `ALNScanner/index.html`
**Lines**: 5222-5320 (NetworkedQueueManager), `backend/src/services/offlineQueueService.js`

### The Issue
Neither `NetworkedQueueManager` nor backend `offlineQueueService` enforce maximum queue size. Queues can grow unbounded.

### Impact
- LocalStorage has 5-10MB limit per origin
- Unbounded queue growth can fill storage, causing:
  - Browser errors
  - Silent save failures
  - Data loss
- No warning to user when approaching limit

### Current Code
```javascript
queueTransaction(transaction) {
    // No size check!
    this.tempQueue.push(transaction);
    this.saveQueue();
}
```

### Proposed Fix
Add configurable queue size limits:

```javascript
class NetworkedQueueManager {
    constructor(connection) {
        this.connection = connection;
        this.tempQueue = [];
        this.syncing = false;
        this.MAX_QUEUE_SIZE = 1000;  // Configurable limit
        this.loadQueue();
        this.mergeOrphanedTransactions();
    }

    queueTransaction(transaction) {
        // Check queue size
        if (this.tempQueue.length >= this.MAX_QUEUE_SIZE) {
            Debug.error('Queue full', {
                size: this.tempQueue.length,
                limit: this.MAX_QUEUE_SIZE
            });
            throw new Error(`Queue full (${this.MAX_QUEUE_SIZE} transactions). Please sync with orchestrator.`);
        }

        // Check if connected first
        if (!this.connection || !this.connection.socket?.connected) {
            this.tempQueue.push(transaction);
            this.saveQueue();

            // Warn if queue getting large
            if (this.tempQueue.length > this.MAX_QUEUE_SIZE * 0.8) {
                Debug.warn('Queue nearly full', {
                    size: this.tempQueue.length,
                    limit: this.MAX_QUEUE_SIZE
                });
            }

            Debug.log('Transaction queued', {
                tokenId: transaction.tokenId,
                queueSize: this.tempQueue.length
            });
        } else {
            // Send immediately if connected
            this.connection.socket.emit('transaction:submit', transaction);
        }
    }
}
```

### Backend Equivalent
Add same check to `backend/src/services/offlineQueueService.js`:

```javascript
enqueue(scanRequest) {
    if (this.queue.length >= this.maxQueueSize) {
        logger.warn('Offline queue full', { size: this.queue.length });
        return null;  // Queue full
    }
    // ... existing logic
}
```

### Verification Steps
1. Disconnect from orchestrator
2. Scan 1000+ tokens rapidly
3. Verify queue stops at limit with clear error message
4. Reconnect and verify sync works
5. Check no data corruption from limit enforcement

### Priority
🟡 **P1 - HIGH**: Prevents storage exhaustion, easy to implement

---

## Issue #7: Queued Transactions Missing Session ID 🟡 HIGH

### Module: Transaction Queue Format
**File**: `ALNScanner/index.html` (NetworkedQueueManager), `backend/src/websocket/adminEvents.js`

### The Issue
When transactions are queued offline, they don't include `sessionId`. If session ends and new one starts before queue syncs, transactions get applied to wrong session.

### Current Queue Format
```javascript
queueTransaction(transaction) {
    this.tempQueue.push({
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        scannerId: transaction.scannerId,
        stationMode: transaction.stationMode,
        timestamp: transaction.timestamp
        // Missing: sessionId!
    });
}
```

### Failure Scenario
1. User scans 5 tokens in Session A (offline)
2. Session A ends
3. User creates Session B
4. Connection restored
5. Queue syncs
6. **5 tokens from Session A are applied to Session B**
7. Scores corrupted (wrong session context)

### Impact
- Score corruption across sessions
- Transaction history integrity compromised
- Duplicate detection breaks (checks session.transactions)

### Proposed Fix

**Frontend - Add sessionId when queuing:**
```javascript
queueTransaction(transaction) {
    // Get current session ID from backend state or generate one
    const sessionId = this.getSessionId();

    const queuedTransaction = {
        ...transaction,
        sessionId: sessionId,  // Include session context
        queuedAt: new Date().toISOString()  // Track when queued
    };

    this.tempQueue.push(queuedTransaction);
    this.saveQueue();
}

getSessionId() {
    // Try to get from last known state
    if (window.connectionManager?.lastKnownSessionId) {
        return window.connectionManager.lastKnownSessionId;
    }

    // Generate temporary ID for offline context
    if (!this.offlineSessionId) {
        this.offlineSessionId = `OFFLINE_${Date.now()}`;
    }
    return this.offlineSessionId;
}
```

**Backend - Validate session on sync:**
```javascript
async function handleTransactionSubmit(socket, data, io) {
    const session = sessionService.getCurrentSession();

    if (!session) {
        socket.emit('error', {
            code: 'SESSION_NOT_FOUND',
            message: 'No active session',
        });
        return;
    }

    // Validate transaction session matches current session
    if (data.sessionId && data.sessionId !== session.id) {
        logger.warn('Transaction from old session rejected', {
            transactionSessionId: data.sessionId,
            currentSessionId: session.id,
            tokenId: data.tokenId
        });

        socket.emit('transaction:result', {
            status: 'rejected',
            reason: 'SESSION_MISMATCH',
            message: 'Transaction from previous session cannot be applied',
            transactionId: data.id
        });
        return;
    }

    // Process normally
    const result = await transactionService.processScan(data, session);
    // ...
}
```

### Verification Steps
1. Start Session A, scan 3 tokens offline
2. End Session A
3. Start Session B
4. Reconnect network
5. Verify queued transactions are rejected with session mismatch
6. Verify Session B scores are not affected
7. Check logs show clear rejection reason

### Priority
🟡 **P1 - HIGH**: Data integrity issue, but unlikely in practice (sessions usually span full games)

---

## Issue #8: No LocalStorage Size Monitoring 🟡 HIGH

### Module: Storage Management (Both Frontend and Backend)
**File**: `ALNScanner/index.html` (StandaloneDataManager), `backend/src/services/persistenceService.js`

### The Issue
No monitoring of localStorage usage. Browser limits are 5-10MB per origin. Large sessions can hit this limit silently.

### Impact
- **Standalone mode**: Long games accumulate transaction history
- **Offline queues**: Disconnection periods accumulate queued transactions
- When limit hit:
  - `localStorage.setItem()` throws `QuotaExceededError`
  - If not caught, app crashes
  - If caught and ignored, data silently lost

### Current Code (No Size Check)
```javascript
saveLocalSession() {
    localStorage.setItem('standaloneSession', JSON.stringify(this.sessionData));
}
```

### Proposed Fix

**Add size monitoring utility:**
```javascript
class StorageMonitor {
    static getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    }

    static getStorageSizeMB() {
        return (this.getStorageSize() / (1024 * 1024)).toFixed(2);
    }

    static checkQuota(dataToSave, key) {
        const currentSize = this.getStorageSize();
        const dataSize = JSON.stringify(dataToSave).length + key.length;
        const newSize = currentSize + dataSize;
        const limitMB = 5;  // Conservative estimate
        const limitBytes = limitMB * 1024 * 1024;

        if (newSize > limitBytes * 0.9) {  // Warn at 90%
            Debug.warn('Storage nearly full', {
                currentMB: (currentSize / (1024 * 1024)).toFixed(2),
                newMB: (newSize / (1024 * 1024)).toFixed(2),
                limitMB: limitMB
            });
            return 'warning';
        }

        if (newSize > limitBytes) {
            Debug.error('Storage limit exceeded', {
                currentMB: (currentSize / (1024 * 1024)).toFixed(2),
                limitMB: limitMB
            });
            return 'error';
        }

        return 'ok';
    }
}
```

**Use in StandaloneDataManager:**
```javascript
saveLocalSession() {
    const data = JSON.stringify(this.sessionData);
    const sizeMB = new Blob([data]).size / (1024 * 1024);

    // Check quota before saving
    const quotaStatus = StorageMonitor.checkQuota(this.sessionData, 'standaloneSession');

    if (quotaStatus === 'warning') {
        Debug.warn(`Session data large: ${sizeMB.toFixed(2)}MB`);
        alert('⚠️ Storage nearly full. Consider exporting session data.');
    } else if (quotaStatus === 'error') {
        Debug.error('Cannot save - storage full');
        alert('❌ Storage full! Export data immediately or clear old sessions.');
        return false;
    }

    try {
        localStorage.setItem('standaloneSession', data);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            Debug.error('QuotaExceededError caught', { sizeMB });
            alert('❌ Storage full! Cannot save session.');
            return false;
        }
        throw e;
    }
}
```

**Add export/cleanup functionality:**
```javascript
exportAndClearOldData() {
    // Export current session to download
    const data = JSON.stringify(this.sessionData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${this.sessionData.sessionId}_${Date.now()}.json`;
    a.click();

    // Clear old data
    this.sessionData.transactions = this.sessionData.transactions.slice(-100);  // Keep recent 100
    this.saveLocalSession();

    Debug.log('Old data exported and cleared');
}
```

### Verification Steps
1. Start standalone mode
2. Scan 500+ tokens to generate large dataset
3. Verify warning appears before hitting limit
4. Continue scanning until error
5. Verify export option is offered
6. Export data and verify file downloads
7. Verify space freed after export

### Priority
🟡 **P1 - HIGH**: Prevents data loss in long games, easy to implement

---

## 🟢 P2 - MEDIUM PRIORITY ISSUES

---

## Issue #9: Unused Delta Calculation ⚪ MEDIUM

### Module: Backend GameState Model
**File**: `backend/src/models/gameState.js`
**Lines**: 243-279

### The Issue
`GameState.createDelta()` method performs expensive JSON.stringify comparisons to create state deltas, but:
- Deltas are never actually sent to clients
- `stateService` always emits full state (line 426 in stateService.js)
- JSON comparison is slow and unnecessary

### Current Code
```javascript
createDelta(previousState) {
    const delta = {};
    // Expensive JSON.stringify for every field comparison
    if (JSON.stringify(this.scores) !== JSON.stringify(prevData.scores)) {
        delta.scores = this.scores;
    }
    // ... similar for other fields
    return delta;
}
```

**But then in stateService:**
```javascript
const delta = this.createStateDelta();  // Creates delta
// ... then ignores it!
const fullState = this.currentState.toJSON();
this.emit('state:updated', fullState);  // Sends full state anyway
```

### Impact
- Wasted CPU cycles on every state update
- Over-engineering for no benefit
- Misleading code (looks like deltas are used)

### Proposed Fix

**Option 1: Remove delta calculation entirely**
```javascript
// Delete createDelta() method from GameState
// Delete createStateDelta() from stateService
// Always emit full state (already doing this)
```

**Option 2: Actually use deltas to reduce bandwidth**
```javascript
// In stateService - emit deltas for non-critical updates
if (Object.keys(delta).length > 0) {
    if (options.immediate) {
        this.emit('state:updated', this.currentState.toJSON());  // Full state
    } else {
        this.emit('state:delta', delta);  // Just changes
    }
}

// Clients would need to handle both events:
// state:updated = full replace
// state:delta = merge changes
```

### Recommendation
**Option 1** - Remove entirely. System works fine with full state updates. Bandwidth savings are minimal (state is small), complexity increase is significant.

### Priority
🟢 **P2 - MEDIUM**: Performance optimization, not affecting functionality

---

## Issue #10: No Schema Versioning ⚪ MEDIUM

### Module: Persistence Layer
**File**: `backend/src/services/persistenceService.js`, various localStorage usage

### The Issue
No version field in persisted state/session data. If data model changes, old stored data breaks the app.

### Example Failure
1. App version 1.0 stores session with fields: `{id, name, transactions}`
2. App version 1.1 adds required field: `scores`
3. User with old stored session opens app
4. App tries to load session → validation fails or crashes

### Impact
- Breaking changes require manual localStorage clearing
- No migration path for data
- Testing old data compatibility is impossible
- Users lose data on updates

### Proposed Fix

**Add version to all persisted data:**
```javascript
// When saving
const dataWithVersion = {
    version: "1.0",
    data: sessionData
};
localStorage.setItem('session', JSON.stringify(dataWithVersion));

// When loading
const stored = JSON.parse(localStorage.getItem('session'));
if (!stored) return null;

if (!stored.version || stored.version !== CURRENT_VERSION) {
    // Run migration
    const migrated = migrateData(stored.data, stored.version || "0.0", CURRENT_VERSION);
    return migrated;
}

return stored.data;
```

**Migration function:**
```javascript
function migrateData(data, fromVersion, toVersion) {
    let current = data;

    // Chain migrations
    if (fromVersion === "0.0" && toVersion >= "1.0") {
        current = migrateV0toV1(current);
    }
    if (fromVersion <= "1.0" && toVersion >= "1.1") {
        current = migrateV1toV1_1(current);
    }

    return current;
}

function migrateV0toV1(data) {
    // Add missing fields with defaults
    return {
        ...data,
        scores: data.scores || []
    };
}
```

### Verification Steps
1. Save session in current version
2. Modify code to expect new required field
3. Load old session
4. Verify migration runs
5. Verify data is usable with new schema

### Priority
🟢 **P2 - MEDIUM**: Important for maintainability, but app is pre-production (no deployed data yet)

---

## Issue #11: Inconsistent Error Handling ⚪ MEDIUM

### Module: System-wide
**Files**: Multiple across backend and frontend

### The Issue
Mixed error handling patterns:
- Backend: Some methods throw errors, others return `{success, error}` objects
- Frontend: Some use alerts, some console.error, some silent failures
- No standardized error codes or messages
- Difficult to debug and maintain

### Examples

**Backend inconsistency:**
```javascript
// Some methods throw
async createSession(data) {
    if (!data.name) {
        throw new Error('Name required');  // Throws
    }
}

// Others return error objects
async processScan(request) {
    if (!token) {
        return { success: false, error: 'Invalid token' };  // Returns
    }
}
```

**Frontend inconsistency:**
```javascript
// Some alert
if (!connected) {
    alert('Connection failed');  // Alert
}

// Some log
if (!token) {
    console.error('No token');  // Just log
}

// Some silent
if (!session) {
    return;  // Silent failure
}
```

### Proposed Fix

**Backend: Standardize on throwing typed errors**
```javascript
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class NotFoundError extends Error {
    constructor(resource, id) {
        super(`${resource} not found: ${id}`);
        this.name = 'NotFoundError';
    }
}

// Always throw, let middleware catch
async createSession(data) {
    if (!data.name) {
        throw new ValidationError('Name required', 'name');
    }
}

// Middleware converts to response
app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
    } else if (err instanceof NotFoundError) {
        res.status(404).json({ error: 'NOT_FOUND', message: err.message });
    } else {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Server error' });
    }
});
```

**Frontend: Centralized error handler**
```javascript
class ErrorHandler {
    static handle(error, context) {
        // Log all errors
        Debug.error(context, error);

        // User-facing message
        if (error.code === 'NETWORK_ERROR') {
            this.showToast('Connection lost. Queueing transactions...', 'warning');
        } else if (error.code === 'VALIDATION_ERROR') {
            this.showToast(`Invalid input: ${error.message}`, 'error');
        } else {
            this.showToast('Something went wrong. Please try again.', 'error');
        }
    }

    static showToast(message, type) {
        // Show non-blocking notification instead of alert()
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Usage
try {
    await window.connectionManager.connect();
} catch (error) {
    ErrorHandler.handle(error, 'connection');
}
```

### Priority
🟢 **P2 - MEDIUM**: Code quality improvement, doesn't affect core functionality

---

## Issue #12: Circular Dependency Risk with Late require() ⚪ MEDIUM

### Module: Service Layer Dependencies
**Files**: `backend/src/services/*.js`

### The Issue
Services use `require()` inside methods to avoid circular dependencies:

```javascript
// In stateService.js
setupTransactionListeners() {
    const transactionService = require('./transactionService');  // Late require
    const sessionService = require('./sessionService');
    // ...
}
```

### Problems
- Hides dependency graph (not clear from imports)
- Risk of circular require loops at runtime
- Difficult to test (can't easily mock dependencies)
- Harder to reason about service relationships

### Impact
- Not a current bug, but maintenance risk
- Refactoring is dangerous (could introduce cycles)
- Testing requires complex setup

### Proposed Fix

**Option 1: Dependency injection**
```javascript
class StateService {
    constructor(dependencies = {}) {
        this.transactionService = dependencies.transactionService;
        this.sessionService = dependencies.sessionService;
    }

    setupTransactionListeners() {
        this.transactionService.on('transaction:accepted', ...);
    }
}

// In app initialization
const transactionService = new TransactionService();
const sessionService = new SessionService();
const stateService = new StateService({ transactionService, sessionService });
```

**Option 2: Event-driven architecture (already partially used)**
```javascript
// Services emit events, don't directly call each other
transactionService.emit('transaction:accepted', transaction);

// Any service can listen, no direct coupling
stateService.on('transaction:accepted', handleTransaction);
sessionService.on('transaction:accepted', handleTransaction);
```

### Recommendation
Stick with event-driven pattern already in place. It naturally avoids circular dependencies.

### Priority
🟢 **P2 - MEDIUM**: Architecture improvement, current implementation works

---

## ⚪ P3 - LOW PRIORITY ISSUES

---

## Issue #13: Documentation Gaps ⚪ LOW

### Areas Needing Documentation
- Service interaction diagrams
- WebSocket event flow charts
- State machine diagrams for session/mode lifecycle
- API contract documentation
- Deployment checklist

### Priority
⚪ **P3 - LOW**: Important for onboarding, but app works without it

---

## Issue #14: Test Coverage Gaps ⚪ LOW

### Missing Tests
- Session mode restoration logic
- Queue size limit enforcement
- LocalStorage quota handling
- Network resilience scenarios
- Rapid session creation/deletion

### Priority
⚪ **P3 - LOW**: Already has good test coverage, these are edge cases

---

## Issue #15: Performance Profiling ⚪ LOW

### Areas to Profile
- State update frequency and size
- WebSocket message throughput
- LocalStorage read/write performance
- Token lookup efficiency

### Priority
⚪ **P3 - LOW**: System performs well currently, optimization can wait

---

## Summary

**P1 Issues (4)**: Lifecycle management, queue limits, session validation, storage monitoring
**P2 Issues (4)**: Delta calculation, schema versioning, error handling, dependencies
**P3 Issues (3)**: Documentation, tests, performance

**Total Backlog**: 11 issues

**Next Steps**: Review P1 issues with maintainer to determine which align with "minimal implementation" principle before prioritizing implementation.