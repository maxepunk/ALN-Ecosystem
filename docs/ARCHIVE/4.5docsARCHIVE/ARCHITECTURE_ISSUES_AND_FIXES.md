# ALN Ecosystem: Architecture Issues & Fixes Roadmap

**Document Version**: 1.0
**Date Created**: 2025-09-29
**Status**: In Progress

---

## Issue #1: Backend Duplicate Score Updates ⚠️ CRITICAL

### Module: Session Model
**File**: `backend/src/models/session.js`
**Lines**: 149-176

### Intended Purpose
The Session model is a **data container** representing one complete game session. It should:
- Store the list of transactions (who scanned what token when)
- Store team scores as a snapshot
- Track connected devices
- Keep metadata about the session (start time, end time, status)

It's meant to be a **passive data structure** - just holding information that other services put into it.

### Intended Code Flow (How Scoring Should Work)
1. **GM Scanner** sends token scan via WebSocket → `transaction:submit` event
2. **Backend adminEvents.js** receives it, calls `transactionService.processScan()`
3. **TransactionService** does all the game logic:
   - Validates token exists
   - Checks for duplicates
   - Calculates points (base value + type multiplier)
   - Updates its internal `teamScores` Map
   - Checks for group completion bonuses
   - Emits `transaction:accepted` event
4. **AdminEvents.js** then calls `sessionService.addTransaction()` to record the transaction
5. **SessionService** calls `session.addTransaction()` to store it in the session history
6. **StateService** listens to the `transaction:accepted` event and broadcasts updated scores to all clients

### The Issue
The Session model is doing **business logic** (score calculation) when it should just be **storing data**.

**Current Code** (lines 158-175):
```javascript
// PROBLEM: Session model recalculates scores!
let teamScore = this.scores.find(s => s.teamId === transaction.teamId);

if (!teamScore) {
    const newTeamScore = TeamScore.createInitial(transaction.teamId);
    this.scores.push(newTeamScore.toJSON());
    teamScore = this.scores.find(s => s.teamId === transaction.teamId);
}

// Doing simple addition when transactionService already did complex calculations
if (teamScore && transaction.points) {
    teamScore.currentScore = (teamScore.currentScore || 0) + transaction.points;
    teamScore.tokensScanned = (teamScore.tokensScanned || 0) + 1;
    teamScore.lastTokenTime = transaction.timestamp;
    teamScore.lastUpdate = new Date().toISOString();
}
```

### Why This Is Wrong
- The `transactionService` already calculated points with multipliers and group bonuses
- Session model does **simple addition** of `transaction.points`, ignoring complex scoring rules
- Creates a **second source of truth** for scores (Session.scores vs TransactionService.teamScores)
- Violates Single Responsibility Principle (data model shouldn't contain business logic)

### Actual Impact
- Session's internal `scores` array doesn't match authoritative `transactionService.teamScores`
- If session is reloaded from disk, scores might be incorrect
- Session exports have wrong score data
- Confusing for debugging (which score is correct?)
- While clients currently receive correct scores (from transactionService), persistence is broken

### The Fix
**Action**: Remove score calculation logic from `Session.addTransaction()`

**Modified Code** (backend/src/models/session.js:149-157):
```javascript
addTransaction(transaction) {
    this.transactions.push(transaction);
    this.metadata.totalScans++;

    // Track unique tokens
    if (!this.metadata.uniqueTokensScanned.includes(transaction.tokenId)) {
        this.metadata.uniqueTokensScanned.push(transaction.tokenId);
    }

    // DELETE lines 158-175 - score updates
    // Scores are managed by transactionService, NOT by Session model
}
```

### Verification Steps
1. Run integration tests for score calculations
2. Submit multiple transactions with group completion bonuses
3. Verify scores match between:
   - `transactionService.getTeamScores()`
   - `session.scores` (should be updated ONLY by transactionService)
   - Client-side displays
4. Restart backend and reload session from disk
5. Verify scores are still correct after reload

### Priority
🔴 **P0 - CRITICAL**: Fix before production use

---

## Issue #2: Dual Queue Data Loss in GM Scanner ⚠️ CRITICAL

### Module: GM Scanner Transaction Queueing
**File**: `ALNScanner/index.html`
**Lines**: 4332-4343 (fallback queue), 5222-5320 (main queue)

### Intended Purpose
When the GM Scanner is in **networked mode** but temporarily disconnected from the orchestrator, it should:
1. Queue transactions locally
2. Continue accepting scans (don't block gameplay - important for unreliable local networks)
3. Automatically sync the queued transactions when connection returns
4. Clear the queue only after successful sync

The system should have **one queue** that handles all disconnection scenarios.

### Intended Code Flow
1. User scans token while **connected** → Send immediately via WebSocket
2. User scans token while **disconnected** → Add to queue, save to localStorage
3. Connection restored → Auto-sync queue to backend
4. Backend confirms → Clear queue

### The Issue
There are **TWO separate transaction storage locations** that don't communicate:

**Queue #1: "Pending Networked Transactions"** (Fallback queue)
- **localStorage key**: `pendingNetworkedTransactions`
- **When used**: During app initialization, before `NetworkedQueueManager` is ready
- **Location**: Lines 4332-4343

```javascript
// If queue manager not yet initialized
const tempQueue = JSON.parse(localStorage.getItem('pendingNetworkedTransactions') || '[]');
tempQueue.push({
    tokenId: tokenId,
    teamId: this.currentTeamId,
    scannerId: Settings.stationId,
    stationMode: Settings.stationMode,
    timestamp: transaction.timestamp
});
localStorage.setItem('pendingNetworkedTransactions', JSON.stringify(tempQueue));
```

**Queue #2: "Networked Temp Queue"** (Main queue)
- **localStorage key**: `networkedTempQueue`
- **When used**: Normal operation after `NetworkedQueueManager` is initialized
- **Location**: Line 5291

```javascript
saveQueue() {
    if (this.tempQueue.length > 0) {
        localStorage.setItem('networkedTempQueue', JSON.stringify(this.tempQueue));
    } else {
        localStorage.removeItem('networkedTempQueue');
    }
}
```

### Why This Is Wrong
The sync logic **ONLY reads from the main queue**:

```javascript
loadQueue() {
    const saved = localStorage.getItem('networkedTempQueue');  // Only loads THIS queue!
    if (saved) {
        this.tempQueue = JSON.parse(saved);
    }
}
```

**Transactions in `pendingNetworkedTransactions` are NEVER synced to the backend.**

### Real-World Failure Scenario
1. User starts GM Scanner, selects "Networked Mode"
2. Connection wizard appears
3. **While connecting** (before `NetworkedQueueManager` initializes), user scans 3 tokens
4. Transactions go to `pendingNetworkedTransactions` (fallback queue)
5. Connection succeeds, `NetworkedQueueManager` initializes
6. It loads `networkedTempQueue` (which is empty)
7. **Those 3 early transactions are orphaned forever** - never sent to backend

### Actual Impact
- **Data loss** for any transactions submitted during initialization
- Critical for unreliable networks where connection may take several seconds
- Silent failure - no error shown to user
- Orphaned transactions accumulate in localStorage without being cleared

### The Fix
**Action**: Merge orphaned transactions on initialization, then eliminate the fallback queue

**Step 1**: Add merge logic to `NetworkedQueueManager` constructor (line ~5223):

```javascript
class NetworkedQueueManager {
    constructor(connection) {
        this.connection = connection;
        this.tempQueue = [];
        this.syncing = false;

        // Load primary queue
        this.loadQueue(); // Loads from 'networkedTempQueue'

        // Rescue any orphaned transactions from fallback queue
        this.mergeOrphanedTransactions();
    }

    /**
     * Merge any orphaned transactions from the fallback queue
     * This rescues transactions that were submitted before queue manager initialized
     */
    mergeOrphanedTransactions() {
        try {
            const orphaned = localStorage.getItem('pendingNetworkedTransactions');
            if (orphaned) {
                const pending = JSON.parse(orphaned);
                if (pending.length > 0) {
                    Debug.log(`Merging ${pending.length} orphaned transactions from initialization period`);
                    this.tempQueue.push(...pending);
                    this.saveQueue(); // Persist merged queue
                }
                // Clean up fallback queue
                localStorage.removeItem('pendingNetworkedTransactions');
                Debug.log('Fallback queue cleaned up');
            }
        } catch (error) {
            Debug.error('Failed to merge orphaned transactions', error);
        }
    }

    // ... rest of class
}
```

**Step 2**: Remove fallback queue usage in `App.recordTransaction()` (lines 4332-4343):

```javascript
// In recordTransaction method, replace fallback queue logic:
if (window.sessionModeManager && window.sessionModeManager.isNetworked()) {
    DataManager.markTokenAsScanned(tokenId);

    if (window.queueManager) {
        // Queue manager ready - use it normally
        window.queueManager.queueTransaction({
            tokenId: tokenId,
            teamId: this.currentTeamId,
            scannerId: Settings.stationId,
            stationMode: Settings.stationMode,
            timestamp: transaction.timestamp
        });
        Debug.log(`Transaction queued: ${tokenId}`);
    } else {
        // Queue manager NOT ready - this should not happen if initialization is correct
        Debug.error('NetworkedQueueManager not initialized - scan blocked');
        alert('Connection still initializing, please wait a moment and try again.');
        return; // Reject the scan
    }
}
```

### Why This Approach
- **Rescues any existing orphaned data** from development/testing
- **Eliminates dual queue** going forward
- **Maintains reliable network resilience** (critical for local network gameplay)
- **Fails visibly** if queue manager isn't ready (rather than silently losing data)

### Verification Steps
1. Clear localStorage completely
2. Start GM Scanner in networked mode
3. **Immediately** scan 2 tokens while connection wizard is showing
4. Complete connection wizard
5. Verify both transactions are in `networkedTempQueue`
6. Verify `pendingNetworkedTransactions` doesn't exist
7. Disconnect network
8. Scan 2 more tokens
9. Reconnect network
10. Verify all 4 transactions sync to backend
11. Verify queue is cleared after successful sync

### Priority
🔴 **P0 - CRITICAL**: Fix before production use (data loss risk in unreliable network conditions)

---

## Issue #3: Auto-Session Creation Anti-Pattern ⚠️ CRITICAL

### Module: Session Service
**File**: `backend/src/services/sessionService.js`
**Lines**: 405-415

### Intended Purpose
The Session Service manages game session lifecycle:
- Create new sessions when admin/GM explicitly starts a game
- Track session state (active, paused, completed)
- Store session data (transactions, devices, scores)
- Provide query methods to check system readiness

The `canAcceptGmStation()` method should be a **query method** (predicate) that answers: "Can we accept another GM station right now?"

It should return `true` or `false` based on current state **WITHOUT changing anything**.

### Intended User Flow
The GM Scanner contains an embedded Admin panel (tabbed interface):

1. GM opens scanner on tablet
2. Selects "Networked Mode"
3. Connects to orchestrator (WebSocket handshake + authentication)
4. Scanner shows **3 tabs**: Scanner / Admin / Debug
5. GM switches to **Admin tab**
6. Clicks **"New Session"** button → Prompts for session name
7. Creates session via authenticated POST to `/api/session`
8. **NOW** session exists, GM switches back to Scanner tab
9. GM can start scanning tokens

This flow allows the GM to:
- Connect to orchestrator to access Admin panel
- Explicitly create and name the session
- Have clear "game start" moment

### The Issue
The `canAcceptGmStation()` method **creates a session as a side effect**:

**Current Code** (lines 405-415):
```javascript
canAcceptGmStation() {
    if (!this.currentSession) {
        // PROBLEM: Query method creates state!
        this.createSession({
            name: `Session_${Date.now()}`,
            maxPlayers: config.session.maxPlayers,
            maxGmStations: config.session.maxGmStations
        });
    }
    return this.currentSession.canAcceptGmStation(config.session.maxGmStations);
}
```

This is called during GM authentication (`backend/src/websocket/gmAuth.js:62`):
```javascript
// Check if can accept GM station
if (!sessionService.canAcceptGmStation()) {
    socket.emit('error', { message: 'Maximum GM stations reached' });
    socket.disconnect(true);
    return;
}
```

### Why This Is Wrong
**Violates Command-Query Separation Principle:**
- **Query** = asks a question, returns information, changes nothing
- **Command** = performs an action, changes state
- `canAcceptGmStation()` is named like a query but acts like a command

**Actual Problems:**
1. **Bypasses intended flow**: First GM to connect auto-creates session, "New Session" button becomes misleading
2. **No admin control**: Session starts automatically without GM knowledge
3. **Auto-generated names**: Session name is `Session_1234567890` instead of descriptive name
4. **Race conditions**: Multiple GMs connecting simultaneously could call `createSession()` multiple times
5. **Confusing debugging**: "Why does a session exist? We didn't create one!"

### Why This Design Was Attempted
The code tried to solve a **bootstrapping problem**:
- GM needs to **connect** to access the Admin tab
- But connection requires passing `canAcceptGmStation()` check
- If no session exists, should connection be rejected?
- Original solution: Auto-create session so GM can connect

**However**, this creates more problems than it solves. The correct solution is to allow connection WITHOUT requiring a session.

### Actual Impact
- "New Session" button appears to do nothing (session already exists from connection)
- Sessions have meaningless auto-generated names
- No explicit "game start" moment
- Admins confused about when sessions are created
- Multiple unnamed sessions accumulate from testing/reconnections

### The Fix
**Action**: Remove auto-creation, allow GM connection without session

**Step 1**: Modify `canAcceptGmStation()` to be a pure query (backend/src/services/sessionService.js:405-415):

```javascript
canAcceptGmStation() {
    // If no session exists, allow GM to connect
    // They'll create one properly via the Admin tab
    if (!this.currentSession) {
        return true; // Changed from auto-creating session
    }

    // If session exists, check capacity
    return this.currentSession.canAcceptGmStation(config.session.maxGmStations);
}
```

**Step 2**: Update GM authentication to handle no-session state (backend/src/websocket/gmAuth.js:82-88):

```javascript
// Update session with device ONLY if session exists
const session = sessionService.getCurrentSession();
if (session) {
    await sessionService.updateDevice(device.toJSON());
    // Join session room
    socket.join(`session:${session.id}`);
} else {
    // No session yet - GM is connecting to create one via Admin panel
    logger.info('GM connected without active session - awaiting session creation', {
        deviceId: socket.deviceId
    });
}
```

**Step 3**: Add session check to transaction handler (backend/src/websocket/adminEvents.js:150-157):

```javascript
const session = sessionService.getCurrentSession();
if (!session) {
    socket.emit('error', {
        code: 'SESSION_NOT_FOUND',
        message: 'No active session. Please create a session via the Admin tab before scanning tokens.',
    });
    return;
}
```

### Why This Approach
- **Explicit control**: Session creation is visible and intentional
- **Proper naming**: GMs name their sessions via Admin panel prompt
- **Clear flow**: Connect → Create Session → Scan (each step is explicit)
- **No side effects**: Query methods stay pure
- **Fail visibly**: Attempting to scan without session gives clear error message
- **Simplest solution**: Aligns with existing Admin tab functionality

### User Experience
**Before Fix:**
1. GM connects → Session auto-created with name "Session_1738123456789"
2. GM clicks "New Session" → Either creates duplicate or appears to do nothing
3. Confusion about which session is active

**After Fix:**
1. GM connects → Can access Admin tab
2. GM clicks "New Session" → Prompted for name, creates "Friday Night Game"
3. GM switches to Scanner tab → Scans tokens
4. Clear mental model: "I created the session, now I can scan"

### Verification Steps
1. Clear all sessions from backend
2. Connect GM scanner in networked mode
3. Verify connection succeeds WITHOUT creating a session
4. Switch to Admin tab
5. Verify no session is shown (displays "-" or "No active session")
6. Click "New Session", enter name "Test Game"
7. Verify session is created with correct name
8. Switch to Scanner tab
9. Try to scan token → Should work
10. Check backend: Only 1 session exists, properly named
11. Disconnect and reconnect GM → Session persists, no duplicate created

### Priority
🔴 **P0 - CRITICAL**: Fix before production use (confusing UX, session management issues)

---

## Issue #4: Networked Mode Connection State Not Verified on Restore ⚠️ CRITICAL

### Module: GM Scanner Session Mode Management
**File**: `ALNScanner/index.html`
**Lines**: 3803-3809 (app initialization), 4620-4652 (mode setting), 4640-4652 (networked mode init)

### Intended Purpose
When a user selects **"Networked Mode"**, the system should:
1. Show connection wizard (modal with server discovery and manual entry)
2. Require successful connection before proceeding
3. Only allow scanning after connection established
4. If page refreshes, verify connection still exists before proceeding

The connection wizard provides:
- **Auto-discovery**: Scans local network for game servers
- **Manual entry**: Server URL, station name, GM password
- **Connect button**: Validates and establishes WebSocket connection
- **Cancel button**: Returns to mode selection screen

### Intended Code Flow

**First-time setup:**
1. User clicks "Networked Game" button
2. `SessionModeManager.setMode('networked')` called
3. Mode saved to localStorage
4. `initNetworkedMode()` called → shows connection wizard
5. User fills in credentials and clicks "Connect"
6. Connection established → Modal closes → Team entry screen shown

**After page refresh:**
1. App loads
2. Checks localStorage for saved mode
3. **Should verify**: If networked mode, is connection still active?
4. If yes → Proceed to team entry
5. If no → Show connection wizard again

### The Issue

When the app restores a saved mode from localStorage, it **skips connection verification**:

**Current Code** (lines 3803-3809):
```javascript
const savedMode = window.sessionModeManager.restoreMode();
if (savedMode) {
    Debug.log(`Restored previous session mode: ${savedMode}`);
    // Continue where we left off
    UIManager.showScreen('teamEntry');  // ← Goes directly to team entry!
} else {
    UIManager.showScreen('gameModeScreen');
}
```

**What's Wrong:**
- If user had selected 'networked' mode, then refreshes page (or app crashes)
- App restores `mode = 'networked'` from localStorage
- **Skips connection wizard entirely**
- Goes straight to team entry screen
- **No connection exists** - WebSocket was lost on refresh
- User can attempt to scan tokens
- Transactions queue forever or fail silently

### Why This Happens

The mode initialization happens in two different places:

**Path 1: Fresh mode selection** (line 4627-4634)
```javascript
setMode(mode) {
    this.mode = mode;
    this.locked = true;
    localStorage.setItem('gameSessionMode', mode);

    if (mode === 'networked') {
        this.initNetworkedMode();  // ← Shows wizard, requires connection
    }
}
```

**Path 2: Mode restoration from localStorage** (line 3803)
```javascript
const savedMode = window.sessionModeManager.restoreMode();
if (savedMode) {
    UIManager.showScreen('teamEntry');  // ← Bypasses initNetworkedMode()!
}
```

Path 2 skips `initNetworkedMode()`, so no wizard shown, no connection required.

### Real-World Failure Scenarios

**Scenario 1: User refreshes mid-game**
1. User is in networked mode, scanning tokens
2. Accidentally refreshes browser
3. App restores 'networked' mode
4. Goes to team entry, but **WebSocket connection lost**
5. User scans token → Goes to fallback queue
6. **Data loss** (per Issue #2 if queue bugs exist)

**Scenario 2: Browser crashes during initial setup**
1. User clicks "Networked Mode"
2. Mode saved to localStorage
3. Before completing wizard, browser crashes
4. User reopens → Mode is 'networked'
5. Goes straight to team entry **without ever connecting**
6. System appears broken

**Scenario 3: Server goes down, user refreshes**
1. User was connected, server crashes
2. User doesn't notice, refreshes page
3. App thinks it's in networked mode
4. No connection exists, transactions fail
5. Confusing error messages

### Actual Impact
- **Broken state after refresh**: App in networked mode without connection
- **Silent failures**: Transactions queue or fail without clear indication
- **Data loss risk**: Depends on queue implementation (Issue #2)
- **User confusion**: "I selected networked mode, why isn't it working?"
- **No recovery path**: User stuck unless they manually clear localStorage

### The Fix
**Action**: Add connection state verification when restoring networked mode

**Step 1**: Add connection verification method to SessionModeManager (after line 4671):

```javascript
/**
 * Check if networked mode connection is actually ready
 * @returns {boolean} True if connection ready (or not needed)
 */
isConnectionReady() {
    if (this.mode !== 'networked') {
        // Standalone mode doesn't need connection
        return true;
    }

    // Networked mode - verify WebSocket connection exists and is active
    return window.connectionManager?.client?.connected === true;
}
```

**Step 2**: Modify app initialization to verify connection state (replace lines 3803-3809):

```javascript
// Check if we have a previously selected mode
const savedMode = window.sessionModeManager.restoreMode();
if (savedMode) {
    Debug.log(`Found saved session mode: ${savedMode}`);

    if (savedMode === 'networked') {
        // Networked mode - verify connection still exists
        if (window.sessionModeManager.isConnectionReady()) {
            Debug.log('Networked mode connection verified - continuing session');
            UIManager.showScreen('teamEntry');
        } else {
            Debug.log('Networked mode saved but not connected - showing wizard');
            // Connection lost or never established - show wizard
            window.sessionModeManager.initNetworkedMode();
            // Note: wizard handles progression to team entry after successful connection
        }
    } else if (savedMode === 'standalone') {
        // Standalone mode - initialize local data manager and proceed
        Debug.log('Restoring standalone mode');
        window.dataManager = window.dataManager || new StandaloneDataManager();
        UIManager.showScreen('teamEntry');
    } else {
        // Unknown mode - clear and start over
        Debug.warn(`Unknown saved mode: ${savedMode} - clearing`);
        window.sessionModeManager.clearMode();
        UIManager.showScreen('gameModeScreen');
    }
} else {
    // No saved mode - show game mode selection as first screen
    Debug.log('No previous mode - showing game mode selection');
    UIManager.showScreen('gameModeScreen');
}
```

**Step 3**: Ensure ConnectionManager's `connect()` method sets `client.connected` properly (verify line 4883):

```javascript
// After successful connection
await this.client.connect();

// Verify connected flag is set
if (this.client.socket?.connected) {
    this.client.connected = true;  // Ensure flag is set for verification
    this.retryCount = 0;
    return true;
}
```

### Why This Approach

**Benefits:**
1. **Preserves good UX**: If connection still active after refresh, user continues seamlessly
2. **Handles failures gracefully**: If connection lost, shows wizard to reconnect
3. **Explicit verification**: Checks actual WebSocket state, not just localStorage
4. **Mode-specific logic**: Handles standalone vs networked appropriately
5. **Self-healing**: System recovers from broken states automatically
6. **Clear user path**: If not connected, wizard provides recovery options (reconnect or cancel to standalone)

**Edge Cases Handled:**

| Scenario | Behavior After Fix |
|----------|-------------------|
| User refreshes mid-game, connection active | ✅ Continues to team entry seamlessly |
| User refreshes, connection lost | ✅ Shows wizard, can reconnect |
| Browser crashes during wizard setup | ✅ Shows wizard again on reload |
| Server goes down, user refreshes | ✅ Shows wizard, clear error state |
| User clicks "Networked", crashes before connecting | ✅ Shows wizard on reload to complete setup |
| Standalone mode refresh | ✅ Works normally (no connection needed) |

### User Experience

**Before Fix:**
1. User in networked mode, refreshes page
2. App shows team entry screen
3. User scans token → Silent failure or queuing
4. Confusion: "Why isn't it working?"

**After Fix:**
1. User in networked mode, refreshes page
2. App checks connection state
3. **If connected**: Continues normally
4. **If not connected**: Shows wizard with message "Please reconnect to server"
5. User reconnects or cancels to standalone mode
6. Clear recovery path

### Verification Steps
1. Start GM Scanner, select "Networked Mode"
2. Complete connection wizard successfully
3. Verify you're at team entry screen
4. **Refresh browser**
5. Verify connection persists → Stays at team entry (no modal)
6. Disconnect server
7. **Refresh browser again**
8. Verify wizard appears with prompt to reconnect
9. Click "Cancel" → Returns to mode selection
10. Select "Networked Mode" again
11. Browser crashes before clicking "Connect"
12. Reopen browser → Wizard appears (mode was saved but incomplete)
13. Complete wizard → Proceeds to team entry

### Additional Considerations

**Network Resilience**: This fix works in conjunction with `NetworkedQueueManager` to handle temporary disconnections:
- **Momentary disconnect**: Queue manager holds transactions, auto-syncs on reconnect
- **Page refresh**: This fix ensures connection is re-established before proceeding
- **Complete failure**: Cancel button provides escape hatch to standalone mode

**Connection State Tracking**: Relies on `OrchestratorClient.connected` flag being accurate. Verify this flag is:
- Set to `true` on successful connection
- Set to `false` on disconnect/error events
- Checked by `isConnectionReady()` for state verification

### Priority
🔴 **P0 - CRITICAL**: Fix before production use (broken state on refresh, silent failures)

---

## Issue #5: LocalStorage QuotaExceededError Not Handled 🟡 NICE-TO-HAVE

### Module: Storage Operations
**File**: `ALNScanner/index.html`
**Lines**: StandaloneDataManager.saveLocalSession() (~5156)

### Intended Purpose
When saving session data to localStorage in standalone mode, handle the case where browser storage quota is exceeded gracefully.

### The Issue
Currently, `localStorage.setItem()` is called without try/catch. If quota exceeded (5-10MB limit), it throws `QuotaExceededError` which:
- Crashes the save operation
- No user feedback
- Data appears saved but isn't

**Current Code**:
```javascript
saveLocalSession() {
    localStorage.setItem('standaloneSession', JSON.stringify(this.sessionData));
}
```

### Why This Is Low Priority
Based on usage analysis:
- Expected scans per game: <100
- Transaction size: ~200 bytes each
- Total data per game: ~20KB
- localStorage limit: 5MB (5,000KB)
- **Would need 250+ games of data before hitting limit**

However, catching the error provides better user experience if it ever occurs.

### Actual Impact
- **Very unlikely to occur** with expected usage (<100 scans/game)
- If it does occur, user gets confusing behavior (no save, no error message)
- Simple fix, minimal code

### The Fix
**Action**: Add try/catch around localStorage operations with user-friendly error

**Modified Code** (ALNScanner/index.html, StandaloneDataManager.saveLocalSession()):

```javascript
saveLocalSession() {
    try {
        localStorage.setItem('standaloneSession', JSON.stringify(this.sessionData));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            Debug.error('LocalStorage quota exceeded', {
                sessionId: this.sessionData.sessionId,
                transactionCount: this.sessionData.transactions?.length
            });
            alert('⚠️ Storage full! Please export your session data (Settings → Export) and start a new session.');
            return false;
        }
        // Re-throw unexpected errors
        throw e;
    }
}
```

**Apply same pattern to queue operations**:

```javascript
// In NetworkedQueueManager.saveQueue()
saveQueue() {
    try {
        if (this.tempQueue.length > 0) {
            localStorage.setItem('networkedTempQueue', JSON.stringify(this.tempQueue));
        } else {
            localStorage.removeItem('networkedTempQueue');
        }
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            Debug.error('Queue storage full');
            alert('⚠️ Storage full! Please reconnect to sync queued transactions.');
            // Don't throw - allow app to continue
        } else {
            throw e;
        }
    }
}
```

### Why This Approach
- **Minimal code**: Just wrap existing calls in try/catch
- **User-friendly**: Clear error message with action to take
- **Graceful degradation**: App continues running, just can't save
- **Defensive coding**: Handles unexpected errors properly
- **No complexity**: No proactive monitoring, size checking, or warnings

### What We're NOT Doing
❌ Proactive size monitoring (overkill for <100 scans)
❌ Warning thresholds at 80% capacity (premature optimization)
❌ Automatic data pruning (adds complexity)
❌ Storage usage dashboards (unnecessary)

### Verification Steps
1. Manually fill localStorage to near capacity
2. Start standalone session
3. Scan tokens until quota exceeded
4. Verify clear error message appears
5. Verify app doesn't crash
6. Verify user can export data
7. Clear localStorage and verify normal operation resumes

### Priority
🟡 **P2 - NICE-TO-HAVE**: Very unlikely scenario, but simple to implement

---

## Implementation Summary

### 🔴 P0 - CRITICAL (Must Fix Before Production)

| Issue | Module | Impact | Complexity |
|-------|--------|--------|------------|
| #1: Duplicate Score Updates | Backend Session Model | Score calculation errors | Low |
| #2: Dual Queue Data Loss | GM Scanner Queue | Data loss on init | Medium |
| #3: Auto-Session Creation | Backend Session Service | Confusing UX, race conditions | Low |
| #4: Connection State Not Verified | GM Scanner Mode Manager | Broken state on refresh | Medium |

**Total P0 Issues**: 4

### 🟡 P2 - NICE-TO-HAVE (Optional Improvements)

| Issue | Module | Impact | Complexity |
|-------|--------|--------|------------|
| #5: QuotaExceededError Handling | GM Scanner Storage | Better error messages | Very Low |

**Total P2 Issues**: 1

### ❌ P1 Issues - DROPPED (Based on Minimal Implementation Review)

| Issue | Reason Dropped |
|-------|----------------|
| Session Lifecycle Management | Page refresh is acceptable workaround |
| Queue Size Limits | Expected <100 scans/game, way below any limits |
| Session ID in Queued Transactions | Theoretical edge case, revisit if needed in playtesting |
| Proactive Storage Monitoring | Overkill - just catch errors when they happen |

---

## Implementation Order Recommendation

**Phase 1: Backend Fixes** (Independent, can be done in parallel)
1. Issue #1: Remove Session.addTransaction() score logic
2. Issue #3: Remove auto-session creation

**Phase 2: Frontend Fixes** (Dependent on each other)
3. Issue #2: Merge dual queues
4. Issue #4: Add connection verification on restore

**Phase 3: Polish** (Optional)
5. Issue #5: Add QuotaExceededError handling

**Estimated Implementation Time:**
- Phase 1: 1-2 hours
- Phase 2: 2-3 hours
- Phase 3: 30 minutes

**Total**: 4-6 hours for all P0 fixes

---
