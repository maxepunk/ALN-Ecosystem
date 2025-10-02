# Investigation Findings Log

**Purpose**: Append-only log of atomic findings during scanner investigation
**Format**: Each finding is self-contained with code location, snippet, and analysis
**Usage**: Read this file to resume after context compact/summarize

---

## Finding Template

```markdown
---
**Finding #N**: [One-line summary]
**Scanner**: GM / Player
**Location**: file:line-range
**Severity**: 🔴 Critical / 🟡 Important / 🟢 Note / 🔵 Investigation Note
**Category**: Field Usage / Bug / Mismatch / Improvement / Pattern

**Code Snippet**:
```javascript
// relevant code
```

**Observation**: What I found

**Backend Current**: What backend does (if known)

**Issue**: Problem identified (if any)

**Recommendation**: What should be done

**Impact**: Breaking change risk / improvement opportunity

**Related Findings**: #X, #Y
---
```

---

# FINDINGS START HERE

---
**Finding #1**: transaction:result event is NOT used for UI/state updates
**Scanner**: GM
**Location**: ALNScanner/index.html:5470-5475
**Severity**: 🟢 Note
**Category**: Field Usage

**Code Snippet**:
```javascript
this.connection.socket.once('transaction:result', (result) => {
    Debug.log('Transaction processed', {
        status: result.status,
        tokenId: transaction.tokenId
    });
});
```

**Observation**:
The `transaction:result` event is received but ONLY used for debug logging. Fields accessed: `result.status`, `result.tokenId` (from closure, not result). No UI updates, no state changes.

**Backend Current**:
Backend sends `transaction:result` to submitter only (adminEvents.js:168)

**Issue**:
Scanner expects this event but doesn't act on it. Logging accesses `result.status` but doesn't check values or handle errors.

**Recommendation**:
- Scanner: Either remove this listener (unused) OR add proper result handling
- Backend: Consider if this event is necessary if scanners don't use it
- If keeping: Define explicit contract for what `status` values mean

**Impact**:
🟢 Low - Event is ignored, so format changes won't break scanner
🟡 Medium - Missed opportunity for error feedback to scanning GM

**Related Findings**: #2 (transaction:new is the actual state updater)

---
**Finding #2**: transaction:new event drives actual UI/state updates
**Scanner**: GM
**Location**: ALNScanner/index.html:5787-5792
**Severity**: 🔴 Critical
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('transaction:new', (eventData) => {
    // Backend sends { event: 'transaction:new', data: {...}, timestamp: ... }
    const transaction = eventData.data || eventData;
    this.emit('transaction:new', transaction);
    this.updateDataManager({ newTransaction: transaction });
});
```

**Observation**:
Scanner expects WRAPPED format `{event, data, timestamp}` but has fallback to unwrapped. The unwrapped transaction object is passed to DataManager for normalization.

**Backend Current**:
Backend sends wrapped format (broadcasts.js:66-90):
```javascript
{
  event: 'transaction:new',
  data: {
    id, tokenId, teamId, scannerId, stationMode, status,
    points, timestamp, memoryType, valueRating, group, tokenValue
  },
  timestamp
}
```

**Issue**:
**CRITICAL MISMATCH**: Scanner's DataManager.addTransaction (lines 2656-2685) expects very different field names:
- Scanner normalizes: `scannerId → stationId`, `tokenId → rfid`, etc.
- Scanner expects: `memoryType`, `valueRating`, `group` fields
- Backend enriches these in broadcasts.js but they come from token metadata

**Scanner Field Usage in addTransaction**:
- `transaction.timestamp` ✅
- `transaction.scannerId` → normalized to `stationId` ✅
- `transaction.stationMode` ✅
- `transaction.teamId` ✅
- `transaction.tokenId` → also copied to `rfid` ✅
- `transaction.memoryType` → fallback to token lookup ⚠️
- `transaction.group` → fallback to token lookup ⚠️
- `transaction.valueRating` → fallback to token lookup ⚠️
- `transaction.isUnknown` → calculated if no token data ⚠️

**Recommendation**:
- Backend: MUST send `memoryType`, `group`, `valueRating` in transaction:new (currently does ✅)
- Scanner: Fallback to token lookup is good defensive code ✅
- Both: Align on field names (scannerId vs stationId inconsistency)

**Impact**:
🔴 Critical - If backend stops sending enriched token fields, scanner breaks
🟡 Medium - Field name inconsistencies confuse debugging

**Related Findings**: #1, #3

---
**Finding #3**: Scanner normalizes backend transaction format
**Scanner**: GM
**Location**: ALNScanner/index.html:2669-2685
**Severity**: 🟡 Important
**Category**: Pattern / Mismatch

**Code Snippet**:
```javascript
const normalizedTx = {
    timestamp: transaction.timestamp || new Date().toISOString(),
    stationId: transaction.scannerId || transaction.stationId || Settings.stationId,
    stationMode: transaction.stationMode || Settings.stationMode,
    teamId: transaction.teamId || App.currentTeamId,
    rfid: transaction.tokenId || transaction.rfid,
    tokenId: transaction.tokenId || transaction.rfid,
    memoryType: transaction.memoryType || (tokenData?.SF_MemoryType) || 'UNKNOWN',
    group: transaction.group || tokenData?.SF_Group || 'No Group',
    valueRating: transaction.valueRating !== undefined ? transaction.valueRating :
                 (tokenData?.SF_ValueRating !== undefined ? tokenData.SF_ValueRating : 0),
    isUnknown: transaction.isUnknown !== undefined ? transaction.isUnknown : !tokenData
};
```

**Observation**:
Scanner has complex normalization logic handling multiple field name variations and fallbacks. This suggests:
1. Backend and scanner have evolved separately
2. Field names aren't standardized (`scannerId` vs `stationId`, `tokenId` vs `rfid`)
3. Scanner is defensive but that masks the inconsistencies

**Backend Current**:
Backend sends `scannerId`, scanner expects `stationId` internally

**Issue**:
- Normalization layer hides API contract violations
- Multiple fallbacks (`||` chains) make actual requirements unclear
- Comment notes "backend sends different structure" - this is technical debt

**Recommendation**:
- **API Standardization**: Choose ONE name for each field
  - `scannerId` vs `stationId` → Pick one (suggest `scannerId` for API)
  - `tokenId` vs `rfid` → Pick one (suggest `tokenId`)
- **Backend**: Send consistent structure matching scanner expectations
- **Scanner**: Remove normalization once backend is consistent
- **Documentation**: Explicit contract prevents future drift

**Impact**:
🟡 Medium - Works now but fragile, makes changes risky
🔴 High - Refactoring opportunity to clean up both sides

**Related Findings**: #2

---
**Finding #4**: score:updated requires WRAPPED format with specific fields
**Scanner**: GM
**Location**: ALNScanner/index.html:5799-5806, 2873-2891
**Severity**: 🔴 Critical
**Category**: Field Usage

**Code Snippet**:
```javascript
// Event handler
this.socket.on('score:updated', (data) => {
    this.emit('score:updated', data);
    if (window.DataManager) {
        window.DataManager.updateTeamScoreFromBackend(data.data);  // ← Accessing data.data
    }
    console.log('Received score update from backend:', data.data);
});

// Usage in updateTeamScoreFromBackend
this.backendScores.set(scoreData.teamId, {
    currentScore: scoreData.currentScore,
    baseScore: scoreData.baseScore,
    bonusPoints: scoreData.bonusPoints,
    tokensScanned: scoreData.tokensScanned,
    completedGroups: scoreData.completedGroups,
    lastUpdate: scoreData.lastUpdate
});
```

**Observation**:
Scanner **REQUIRES** wrapped format `{event, data, timestamp}` and accesses `data.data` to get the actual score object. Then accesses 6 specific fields.

**Backend Current**:
Backend sends wrapped format (broadcasts.js:142-156):
```javascript
{
  event: 'score:updated',
  data: {
    teamId, currentScore, baseScore, bonusPoints,
    tokensScanned, completedGroups, lastUpdate
  },
  timestamp
}
```

**Scanner Field Usage**:
- `scoreData.teamId` ✅ (used as Map key)
- `scoreData.currentScore` ✅
- `scoreData.baseScore` ✅
- `scoreData.bonusPoints` ✅
- `scoreData.tokensScanned` ✅
- `scoreData.completedGroups` ✅ (array)
- `scoreData.lastUpdate` ✅

**Issue**:
- **CRITICAL**: Unwrapping format would break (code assumes `data.data` structure)
- All 7 fields are required (no fallbacks in scanner code)
- Backend and scanner are aligned ✅

**Recommendation**:
- ✅ Keep wrapped format for score:updated
- ✅ Backend sends all required fields
- Document this as explicit contract requirement
- Consider adding defensive checks for missing fields

**Impact**:
🔴 Critical - Changing to unwrapped format breaks scanner
🔴 Critical - Removing any of the 7 fields breaks scoreboard display

**Related Findings**: #2 (similar wrapped format for transaction:new)

---
**Finding #5**: state:sync event requires full GameState object with 4 sub-structures
**Scanner**: GM
**Location**: ALNScanner/index.html:5856-5932
**Severity**: 🔴 Critical
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('state:sync', (state) => {
    // Update video display
    if (state.currentVideo) {
        videoController.updateDisplay({
            current: state.currentVideo.tokenId  // ← Accessing currentVideo.tokenId
        });
    }

    // Update system status displays
    if (state.systemStatus) {
        systemMonitor.updateOrchestratorStatus(
            state.systemStatus.orchestratorOnline ? 'connected' : 'disconnected'
        );
        systemMonitor.updateVLCStatus(
            state.systemStatus.vlcConnected ? 'ready' : 'disconnected'
        );
    }

    // Update scores
    if (state.scores && Array.isArray(state.scores)) {
        state.scores.forEach(scoreData => {
            DataManager.backendScores.set(scoreData.teamId, scoreData);  // ← Uses full scoreData object
        });
    }

    // Update transactions
    if (state.recentTransactions && Array.isArray(state.recentTransactions)) {
        state.recentTransactions.forEach(tx => {
            DataManager.addTransaction(tx);  // ← Passes to addTransaction (Finding #2)
        });
    }
});
```

**Observation**:
Scanner expects full GameState object with 4 optional sub-structures. Each sub-structure has specific field requirements. All checks are defensive (if exists), suggesting optional fields.

**Backend Current**:
Backend broadcasts state:sync from stateService.getState() - need to verify backend structure matches scanner expectations.

**Scanner Field Usage**:
- `state.currentVideo.tokenId` ⚠️ (optional, used for display)
- `state.systemStatus.orchestratorOnline` ⚠️ (boolean, optional)
- `state.systemStatus.vlcConnected` ⚠️ (boolean, optional)
- `state.scores[]` ⚠️ (optional array of score objects)
  - Each score object uses ALL fields from Finding #4
- `state.recentTransactions[]` ⚠️ (optional array)
  - Each transaction uses ALL fields from Finding #2

**Issue**:
- **CRITICAL DEPENDENCY CHAIN**: state:sync reuses score and transaction structures
- If score/transaction formats change, state:sync breaks too
- Scanner does defensive checks (all optional), but backend should document what's always sent
- No error handling if sub-structures exist but have wrong shape

**Recommendation**:
- Document state:sync as "aggregate state object" with sub-structure references
- Explicitly define which fields are always present vs optional
- Add validation: if sub-structure exists, it must have correct fields
- Consider: should scanner validate state shape before processing?

**Impact**:
🔴 Critical - Changes to score/transaction format cascade here
🟡 Medium - Defensive code masks missing validations
🟢 Note - Proper null checks are good practice ✅

**Related Findings**: #2 (transaction format), #4 (score format)

---
**Finding #6**: state:update event is a generic wrapper with delegation pattern
**Scanner**: GM
**Location**: ALNScanner/index.html:5782-5785, 6042-6065
**Severity**: 🟢 Note
**Category**: Pattern

**Code Snippet**:
```javascript
// Event handler
this.socket.on('state:update', (data) => {
    this.emit('state:update', data);
    this.updateDataManager(data);  // ← Delegates to helper method
});

// updateDataManager method
updateDataManager(data) {
    if (data.newTransaction) {
        DataManager.addTransaction(data.newTransaction);  // Uses Finding #2 format
    }
    if (data.state) {
        DataManager.updateGameState(data.state);  // Game state update
    }
    // Then triggers UI updates
}
```

**Observation**:
state:update is NOT a specific event format - it's a generic wrapper that can contain different types of updates. Scanner checks for specific properties and delegates accordingly.

**Backend Current**:
Need to verify what backend actually sends as state:update events. Scanner expects object with optional properties: `newTransaction`, `state`.

**Scanner Field Usage**:
- `data.newTransaction` ⚠️ (optional, delegates to addTransaction from Finding #2)
- `data.state` ⚠️ (optional, delegates to updateGameState - need to investigate this method)

**Issue**:
- **PATTERN MISMATCH**: state:update appears to be a "delta update" mechanism but usage is unclear
- Scanner has defensive checks (optional properties) but no validation
- Unclear when backend sends `data.state` vs full `state:sync`
- Need to find updateGameState implementation to understand `data.state` structure

**Recommendation**:
- Investigate backend: when is state:update sent vs state:sync?
- Document state:update as "delta update event with optional properties"
- OR consider removing if redundant with specific events (transaction:new, state:sync)
- Find and document updateGameState method requirements

**Impact**:
🟢 Low - Appears to be redundant wrapper over specific events
🟡 Medium - Unclear intent suggests possible architectural confusion

**Related Findings**: #2 (transaction format), #5 (state:sync)

---
**Finding #7**: video:status event only used for admin panel display
**Scanner**: GM
**Location**: ALNScanner/index.html:5794-5796, 4137-4141, 1956-1966
**Severity**: 🟢 Note
**Category**: Field Usage

**Code Snippet**:
```javascript
// Event handler (just emits, no direct processing)
this.socket.on('video:status', (data) => {
    this.emit('video:status', data);  // ← Re-emits to listeners
});

// Admin panel listener
client.on('video:status', (data) => {
    if (this.adminInstances?.videoController) {
        this.adminInstances.videoController.updateDisplay(data);  // ← Passes to display
    }
});

// VideoController.updateDisplay method
updateDisplay(videoStatus) {
    currentElement.textContent = videoStatus?.current || 'None';  // ← Uses .current
    queueElement.textContent = videoStatus?.queueLength || '0';   // ← Uses .queueLength
}
```

**Observation**:
video:status event is only used to update admin panel UI display. Scanner expects simple object with 2 optional fields. No game logic depends on this event.

**Backend Current**:
Need to verify backend sends matching format. Scanner expects: `{ current, queueLength }`.

**Scanner Field Usage**:
- `videoStatus.current` ⚠️ (optional string, displays "None" if missing)
- `videoStatus.queueLength` ⚠️ (optional number, displays "0" if missing)

**Issue**:
- Simple display-only event, low risk
- Good defensive coding with fallback values ✅
- Admin panel only - not core functionality
- Format is simpler than other events (no wrapped format)

**Recommendation**:
- Keep simple unwrapped format for video:status (no need for wrapped envelope)
- Document as optional fields with fallback behavior
- Consider: should this include video state (playing, paused, stopped)?

**Impact**:
🟢 Low - Display-only, admin panel feature, good fallbacks
🟢 Compatible - Format changes gracefully handled

**Related Findings**: #5 (state:sync also uses currentVideo.tokenId)

---
**Finding #8**: gm:identified event stores sessionId and emits
**Scanner**: GM
**Location**: ALNScanner/index.html:5777-5780
**Severity**: 🟡 Important
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('gm:identified', (data) => {
    this.sessionId = data.sessionId;  // ← Stores sessionId
    this.emit('gm:identified', data);
});
```

**Observation**:
Authentication confirmation event after WebSocket handshake. Scanner stores the sessionId from response.

**Backend Current**:
Backend sends gm:identified after successful authentication handshake (need to verify exact payload).

**Scanner Field Usage**:
- `data.sessionId` 🔴 (required - stored in client state)

**Issue**:
- REQUIRED field with no fallback or validation
- No error handling if sessionId missing
- sessionId is stored but usage elsewhere not yet investigated

**Recommendation**:
- Add validation: check data.sessionId exists before storing
- Document as REQUIRED field in authentication flow
- Investigate: where is this.sessionId used after storage?

**Impact**:
🟡 Medium - Authentication flow dependency, but unclear downstream usage
🔴 High - No error handling if field missing

**Related Findings**: None yet (need to investigate sessionId usage)

---
**Finding #9**: scores:reset event clears backend scores cache
**Scanner**: GM
**Location**: ALNScanner/index.html:5808-5823
**Severity**: 🟢 Note
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('scores:reset', (data) => {
    this.emit('scores:reset', data);

    // Clear backend scores cache
    if (window.DataManager && window.DataManager.backendScores) {
        window.DataManager.backendScores.clear();  // ← Clears Map, doesn't use data payload
    }

    // Update admin panel
    if (App.viewController && App.viewController.currentView === 'admin') {
        App.updateAdminPanel();
    }
});
```

**Observation**:
Admin reset event that clears local score cache. Scanner does NOT use any fields from data payload - just treats as signal.

**Backend Current**:
Backend broadcasts scores:reset event (likely empty payload or unused data).

**Scanner Field Usage**:
- NONE - Event payload is ignored, only event name matters

**Issue**:
- Event is pure signal (no data needed) ✅
- Good separation of concerns
- Could send empty object {} as payload

**Recommendation**:
- Document as "signal event" with no required payload
- Backend can send {} or { timestamp } for consistency
- Keep simple - works well as-is ✅

**Impact**:
🟢 Low - Signal-only event, no breaking changes possible
🟢 Compatible - Any payload format accepted (ignored)

**Related Findings**: #4 (score:updated), #5 (state:sync scores)

---
**Finding #10**: group:completed event requires WRAPPED format with 4 specific fields
**Scanner**: GM
**Location**: ALNScanner/index.html:5825-5832, 3724-3750
**Severity**: 🔴 Critical
**Category**: Field Usage

**Code Snippet**:
```javascript
// Event handler
this.socket.on('group:completed', (data) => {
    this.emit('group:completed', data);
    if (window.UIManager) {
        window.UIManager.showGroupCompletionNotification(data.data);  // ← Accesses data.data
    }
});

// showGroupCompletionNotification usage
notification.innerHTML = `
    <div>Team ${data.teamId} - ${data.groupId}</div>          // ← Uses teamId, groupId
    <div>Bonus: +$${data.bonus.toLocaleString()} (${data.multiplier}x)</div>  // ← Uses bonus, multiplier
`;
```

**Observation**:
Group completion bonus notification event. Scanner expects WRAPPED format and accesses `data.data` to get notification object with 4 required fields.

**Backend Current**:
Backend likely sends wrapped format (need to verify): `{event, data: {teamId, groupId, bonus, multiplier}, timestamp}`.

**Scanner Field Usage**:
- `data.data.teamId` 🔴 (required - displayed in notification)
- `data.data.groupId` 🔴 (required - displayed in notification)
- `data.data.bonus` 🔴 (required - formatted as currency)
- `data.data.multiplier` 🔴 (required - displayed with bonus)

**Issue**:
- **CRITICAL**: Wrapped format required (`data.data` access)
- All 4 fields required with NO fallbacks
- Uses `.toLocaleString()` on bonus - will crash if not a number
- No error handling for missing fields

**Recommendation**:
- Add validation before accessing fields
- Add fallback values or error handling
- Document as wrapped format with 4 required fields
- Backend: ensure bonus is always a number

**Impact**:
🔴 Critical - Missing any field breaks notification display
🔴 Critical - Unwrapping format breaks scanner
🟡 Medium - Notification is nice-to-have, not core gameplay

**Related Findings**: #2 (wrapped format), #4 (wrapped format)

---
**Finding #11**: team:created event only logs data, no processing
**Scanner**: GM
**Location**: ALNScanner/index.html:5834-5837
**Severity**: 🟢 Note
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('team:created', (data) => {
    this.emit('team:created', data);
    console.log('New team created:', data.data);  // ← Only logging, no usage
});
```

**Observation**:
Team creation notification event. Scanner logs it but does NOT process or use any fields. No UI updates, no state changes.

**Backend Current**:
Backend likely sends wrapped format with team data (need to verify).

**Scanner Field Usage**:
- NONE - Event is logged but not used for any functionality

**Issue**:
- Event received but not utilized
- Scanner doesn't update team lists or display new teams
- Possible incomplete feature or future enhancement placeholder

**Recommendation**:
- Either implement team list update functionality
- OR remove listener if truly not needed
- Document as "notification only" if keeping

**Impact**:
🟢 Low - No usage means format changes won't break anything
🟡 Medium - Suggests incomplete feature or missing functionality

**Related Findings**: None

---
**Finding #12**: device:connected/disconnected events manage connectedDevices array
**Scanner**: GM
**Location**: ALNScanner/index.html:5839-5847
**Severity**: 🟡 Important
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('device:connected', (data) => {
    this.connectedDevices.push(data);  // ← Pushes entire data object
    this.emit('device:connected', data);
});

this.socket.on('device:disconnected', (data) => {
    this.connectedDevices = this.connectedDevices.filter(d => d.deviceId !== data.deviceId);  // ← Filters by deviceId
    this.emit('device:disconnected', data);
});
```

**Observation**:
Device tracking events for monitoring connected scanners. Scanner maintains array of connected devices and filters by deviceId on disconnect.

**Backend Current**:
Backend sends device data objects (need to verify exact structure).

**Scanner Field Usage**:
- device:connected: Entire `data` object is stored (structure unclear)
- device:disconnected: `data.deviceId` 🔴 (required for filtering)

**Issue**:
- **CRITICAL**: deviceId is required for disconnect filtering
- No validation before accessing data.deviceId
- Unknown what fields are in full device object
- Filter will fail silently if deviceId missing

**Recommendation**:
- Add validation: check data.deviceId exists
- Document complete device object structure
- Add defensive coding: filter only if deviceId present
- Consider: should this array be in DataManager instead?

**Impact**:
🔴 High - deviceId missing breaks disconnect filtering
🟡 Medium - Device tracking is monitoring feature, not core gameplay
🟢 Note - Array usage pattern is simple but needs validation

**Related Findings**: #13 (sync:full also uses devices array)

---
**Finding #13**: sync:full event updates connectedDevices array
**Scanner**: GM
**Location**: ALNScanner/index.html:5849-5854
**Severity**: 🟡 Important
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('sync:full', (data) => {
    if (data.devices) {
        this.connectedDevices = data.devices;  // ← Replaces entire array
    }
    this.emit('sync:full', data);
});
```

**Observation**:
Full device list synchronization event. Scanner replaces entire connectedDevices array if `data.devices` exists.

**Backend Current**:
Backend sends full sync data with optional devices array (need to verify structure).

**Scanner Field Usage**:
- `data.devices` ⚠️ (optional array, defensively checked)

**Issue**:
- Good defensive check (if exists) ✅
- Assumes devices array contains same structure as device:connected events
- No validation of array contents
- Unclear when backend sends this vs individual device events

**Recommendation**:
- Document sync:full as "full device list refresh"
- Validate array contents match device structure
- Document when backend sends sync:full vs incremental updates
- Consider: should this also sync other state?

**Impact**:
🟢 Low - Optional field with defensive check
🟡 Medium - Array contents must match device structure from Finding #12

**Related Findings**: #12 (device events), #5 (state:sync for game state)

---
**Finding #14**: error event only logs, no structured handling
**Scanner**: GM
**Location**: ALNScanner/index.html:5934-5937
**Severity**: 🟡 Important
**Category**: Error Handling / Pattern

**Code Snippet**:
```javascript
this.socket.on('error', (error) => {
    this.emit('error', error);
    console.error('OrchestratorClient: Server error:', error);  // ← Only logs
});
```

**Observation**:
Generic error event from backend. Scanner logs to console but does NOT display errors to users, handle specific error types, or take recovery actions.

**Backend Current**:
Backend sends error events (need to verify structure: message? code? details?).

**Scanner Field Usage**:
- Entire `error` object is logged (structure unknown)
- No specific field access means any structure works

**Issue**:
- **MISSING FUNCTIONALITY**: Errors not shown to users
- No error type differentiation (auth errors, validation errors, etc.)
- No recovery logic or user guidance
- Console-only errors are invisible to end users

**Recommendation**:
- Add UIManager.showError(error) to display errors to users
- Standardize error object structure: `{ code, message, details? }`
- Handle specific error types (AUTH_FAILED, TOKEN_INVALID, etc.)
- Add user-friendly error messages and recovery suggestions

**Impact**:
🔴 High - Users can't see errors, hurts UX/debugging
🟡 Medium - No breaking changes (any format works) but missing critical functionality
🔴 Critical - Silent failures confuse users

**Related Findings**: Need to investigate HTTP error handling patterns

---
**Finding #15**: heartbeat:ack event only updates timestamp
**Scanner**: GM
**Location**: ALNScanner/index.html:5939-5942
**Severity**: 🟢 Note
**Category**: Field Usage

**Code Snippet**:
```javascript
this.socket.on('heartbeat:ack', (data) => {
    this.lastHeartbeat = Date.now();  // ← Updates timestamp, ignores payload
    this.emit('heartbeat:ack', data);
});
```

**Observation**:
Heartbeat acknowledgment for connection monitoring. Scanner updates local timestamp but ignores event payload data.

**Backend Current**:
Backend sends heartbeat:ack response (payload likely unused).

**Scanner Field Usage**:
- NONE - Payload ignored, only event receipt matters

**Issue**:
- Event is pure signal (like scores:reset)
- Good pattern for keep-alive ✅
- Could be used for latency measurement (timestamp comparison)

**Recommendation**:
- Document as "signal event" with optional payload
- Consider: backend could send server timestamp for latency calculation
- Keep simple - works well as-is ✅

**Impact**:
🟢 Low - Signal-only event, no breaking changes possible
🟢 Compatible - Any payload format accepted (ignored)
🟢 Note - Could enhance for latency monitoring

**Related Findings**: #9 (scores:reset also signal-only)

---
**Finding #16**: Session API responses require id and status fields
**Scanner**: GM
**Location**: ALNScanner/index.html:1765-1872
**Severity**: 🔴 Critical
**Category**: Field Usage / HTTP

**Code Snippet**:
```javascript
// POST /api/session - Create session
const data = await response.json();
if (data.id) {  // ← Checks for id field
    this.currentSession = data;  // ← Stores entire response
    this.updateDisplay(data);
}

// PUT /api/session - Update session status
const data = await response.json();
if (data.id) {  // ← Checks for id field again
    this.currentSession = data;
    this.updateDisplay(data);
}

// updateDisplay method
updateDisplay(session) {
    if (session) {
        idElement.textContent = session.id || '-';      // ← Uses session.id
        statusElement.textContent = session.status || '-';  // ← Uses session.status
    }
}
```

**Observation**:
All session operations (create, pause, resume, end) check for `data.id` before processing. Display uses both `id` and `status` fields with fallbacks.

**Backend Current**:
Need to verify backend session API response format. Scanner expects unwrapped session object with id and status.

**Scanner Field Usage**:
- `data.id` 🔴 (required - checked before storing)
- `session.id` ⚠️ (used in display with fallback to '-')
- `session.status` ⚠️ (used in display with fallback to '-')

**Issue**:
- Pattern is confusing: checks `data.id` exists, but THEN stores entire `data` object
- If id missing, response is silently ignored (no error to user)
- Display has fallbacks but parent check means they're unnecessary
- Entire response object is stored (unknown what other fields exist)

**Recommendation**:
- Add error handling: if no id, show error to user
- Document complete session object structure
- Consider: should this throw error instead of silent return?
- Backend: document what fields are included in session response

**Impact**:
🔴 High - Missing id means session operations fail silently
🟡 Medium - Unknown what other session fields might be accessed elsewhere
🟢 Note - Display has good fallbacks for id/status

**Related Findings**: #14 (error handling patterns)

---
**Finding #17**: Video control API responses are returned but not directly used
**Scanner**: GM
**Location**: ALNScanner/index.html:1884-1954
**Severity**: 🟢 Note
**Category**: Field Usage / HTTP

**Code Snippet**:
```javascript
async playVideo() {
    const response = await fetch('/api/video/control', {
        method: 'POST',
        body: JSON.stringify({ action: 'play' })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to play video');  // ← Uses error.message
    }

    return response.json();  // ← Returns response but caller doesn't use it
}

// Similar for pauseVideo(), stopVideo(), skipVideo()
```

**Observation**:
All video control methods (play, pause, stop, skip) follow same pattern: error handling checks `error.message`, success returns response but callers don't use it.

**Backend Current**:
Need to verify backend /api/video/control response format. Scanner expects: error responses have `message` field, success responses are unused.

**Scanner Field Usage**:
- **Error case**: `error.message` ⚠️ (optional, fallback to generic message)
- **Success case**: Response returned but NOT used by callers

**Issue**:
- Good error handling pattern with fallback ✅
- Success responses are wasted (returned but ignored)
- Unclear what backend sends on success
- video:status WebSocket event (Finding #7) is used instead for UI updates

**Recommendation**:
- Document that success responses are ignored (WebSocket events used for updates)
- Backend can send simple `{success: true}` format
- Keep error.message pattern consistent across all HTTP endpoints
- Consider: could return void instead of response.json()?

**Impact**:
🟢 Low - Success responses unused, so format doesn't matter
🟢 Compatible - Error handling has good fallback
🟢 Note - WebSocket events handle state updates, not HTTP responses

**Related Findings**: #7 (video:status event), #16 (error.message pattern)

---
**Finding #18**: HTTP error handling pattern is consistent but incomplete
**Scanner**: GM
**Location**: Multiple locations (session, video, admin endpoints)
**Severity**: 🟡 Important
**Category**: Error Handling / Pattern

**Code Snippet**:
```javascript
// Standard error handling pattern across ALL HTTP endpoints
if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to [action]');  // ← Fallback message
}

// Success path
const data = await response.json();
// Process data...
```

**Observation**:
Scanner has CONSISTENT error handling across all HTTP endpoints:
- Checks `!response.ok` (HTTP status)
- Parses error response as JSON
- Accesses `error.message` with fallback
- Throws Error (doesn't display to user directly)

**Backend Current**:
Need to verify backend consistently sends `{message: string}` format for error responses.

**Scanner Field Usage**:
- HTTP status via `response.ok` 🔴 (critical check)
- `error.message` ⚠️ (optional, fallback to generic message)

**Issue**:
- **MISSING**: Errors thrown but not caught/displayed to users
- Good pattern consistency ✅
- No handling for error codes (AUTH_REQUIRED, VALIDATION_ERROR, etc.)
- No differentiation between error types (401 vs 500 vs 400)
- Backend error format assumed but not validated

**Recommendation**:
- Add try/catch wrapper to display errors to users via UIManager
- Standardize backend error format: `{message, code?, details?}`
- Handle specific error codes (show auth prompt for AUTH_REQUIRED, etc.)
- Add error recovery guidance for users
- Document error.message as standard field across all endpoints

**Impact**:
🔴 High - Errors thrown but not shown to users (UX problem)
🟢 Compatible - Fallback message prevents crashes
🟡 Medium - Missing error code handling limits smart error recovery

**Related Findings**: #14 (WebSocket error event), #16 (session API), #17 (video API)

---
**Finding #19**: Transaction submission has NO error handling
**Scanner**: GM
**Location**: ALNScanner/index.html:5467-5476, 5490-5496
**Severity**: 🔴 Critical
**Category**: Error Handling / Bug

**Code Snippet**:
```javascript
submitTransaction(transaction) {
    if (this.connection?.socket?.connected) {
        this.connection.socket.emit('transaction:submit', transaction);  // ← Fire and forget

        this.connection.socket.once('transaction:result', (result) => {
            Debug.log('Transaction processed', {
                status: result.status  // ← Logs result.status but doesn't check it
            });
        });
    }
}

// Queue sync - even worse
for (const transaction of this.tempQueue) {
    this.connection.socket.emit('transaction:submit', transaction);  // ← No result listeners at all
}
```

**Observation**:
Transaction submission is "fire and forget" with NO error handling:
- Emits transaction to backend
- Listens for result but ONLY logs it (Finding #1)
- Does NOT check if result.status is error
- Queue sync doesn't even listen for results
- Users never know if transactions failed

**Backend Current**:
Backend sends transaction:result with status field, but scanner ignores it for error handling.

**Scanner Field Usage**:
- `result.status` - logged but NOT used for error detection

**Issue**:
- **CRITICAL BUG**: Transaction failures invisible to users
- No retry logic for failed transactions
- No user feedback for rejected/failed scans
- Queue sync sends but never confirms processing
- Finding #1 identified this event is unused - now we see WHY it's a problem

**Recommendation**:
- **CRITICAL**: Check result.status in transaction:result handler
- Show error to user if status === 'error' or 'rejected'
- Add retry queue for failed transactions
- Display success/failure feedback in UI
- Queue sync needs result tracking

**Impact**:
🔴 CRITICAL - Transaction failures are silent, users think scans worked
🔴 CRITICAL - No way to recover from failed transactions
🔴 HIGH - Core gameplay functionality broken

**Related Findings**: #1 (transaction:result unused), #14 (error event)

---
**Finding #20**: session:update WebSocket event updates admin panel display
**Scanner**: GM
**Location**: ALNScanner/index.html:4131-4135
**Severity**: 🟢 Note
**Category**: Field Usage

**Code Snippet**:
```javascript
client.on('session:update', (data) => {
    if (this.adminInstances?.sessionManager) {
        this.adminInstances.sessionManager.updateDisplay(data);  // ← Passes entire data object
    }
});

// updateDisplay uses (from Finding #16):
// - data.id
// - data.status
```

**Observation**:
Admin panel listens for session updates separately from main session API responses. Uses same updateDisplay method as HTTP responses (Finding #16).

**Backend Current**:
Backend likely broadcasts session:update when session changes (need to verify format).

**Scanner Field Usage**:
- Same as Finding #16: `data.id`, `data.status`

**Issue**:
- Duplicate listener for same data (HTTP response AND WebSocket event)
- Defensive admin panel check (good) ✅
- Unclear when backend sends this vs relying on HTTP response

**Recommendation**:
- Document as "session change broadcast for admin panels"
- Ensure backend sends same format as POST/PUT /api/session responses
- Consider: is WebSocket update redundant if HTTP response already updates display?

**Impact**:
🟢 Low - Admin panel feature, defensive checks
🟢 Compatible - Reuses session object format from Finding #16

**Related Findings**: #16 (session API responses)

---
**Finding #21**: Authentication endpoint returns token field
**Scanner**: GM
**Location**: ALNScanner/index.html:5225-5250
**Severity**: 🔴 Critical
**Category**: Field Usage / HTTP / Authentication

**Code Snippet**:
```javascript
async authenticate(password) {
    const response = await fetch(`${this.url}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });

    if (!response.ok) {
        throw new Error('Invalid password');  // ← Generic error, no .message check
    }

    const { token } = await response.json();  // ← Destructures token field
    this.token = token;
    return token;
}
```

**Observation**:
Initial authentication endpoint that returns JWT token. Scanner destructures `{token}` from response - REQUIRED field.

**Backend Current**:
Backend /api/admin/auth endpoint (need to verify response format).

**Scanner Field Usage**:
- `response.token` 🔴 (CRITICAL - destructured, no fallback)

**Issue**:
- **CRITICAL**: Destructuring will fail if token field missing
- Error handling DIFFERENT from other endpoints (no error.message check)
- Just throws generic "Invalid password" for any !response.ok
- No validation that token is a valid string

**Recommendation**:
- Add validation: check token exists before destructuring
- Align error handling with other endpoints (check error.message)
- Add token format validation
- Consider: store token expiry time?

**Impact**:
🔴 CRITICAL - Missing token field crashes authentication
🔴 HIGH - Inconsistent error handling confuses debugging
🟡 Medium - No token validation allows invalid tokens

**Related Findings**: #18 (HTTP error handling pattern - this breaks the pattern)

---
**Finding #22**: Admin operations endpoints return unused responses
**Scanner**: GM
**Location**: ALNScanner/index.html:2020-2056
**Severity**: 🟢 Note
**Category**: Field Usage / HTTP

**Code Snippet**:
```javascript
async resetScores() {
    const response = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${window.connectionManager?.token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset scores');
    }

    return response.json();  // ← Returns but caller doesn't use
}

async clearTransactions() {
    // Same pattern for /api/admin/clear-transactions
}
```

**Observation**:
Two admin endpoints (reset-scores, clear-transactions) follow consistent error handling but success responses are unused. Similar pattern to video control (Finding #17).

**Backend Current**:
Need to verify backend response formats.

**Scanner Field Usage**:
- **Error case**: `error.message` ⚠️ (optional, fallback)
- **Success case**: Response returned but NOT used

**Issue**:
- Consistent with Finding #17 pattern (good) ✅
- Success responses wasted
- Relies on WebSocket scores:reset event (Finding #9) for actual state update

**Recommendation**:
- Document as "command endpoints" - responses unused, state via WebSocket
- Backend can send simple `{success: true}`
- Keep error.message pattern consistent ✅

**Impact**:
🟢 Low - Success responses unused, format doesn't matter
🟢 Compatible - Error handling has fallback
🟢 Note - WebSocket events handle state updates

**Related Findings**: #17 (video control pattern), #9 (scores:reset event), #18 (error pattern)

---
**Finding #23**: updateGameState method uses sessionId and gameMode fields
**Scanner**: GM
**Location**: ALNScanner/index.html:2720-2730, called from 6051
**Severity**: 🟡 Important
**Category**: Field Usage

**Code Snippet**:
```javascript
// Called from state:update event (Finding #6)
updateDataManager(data) {
    if (data.state) {
        DataManager.updateGameState(data.state);  // ← Passes state object
    }
}

// updateGameState implementation
updateGameState(state) {
    if (state && typeof state === 'object') {
        if (state.sessionId && this.currentSessionId !== state.sessionId) {
            this.currentSessionId = state.sessionId;  // ← Uses sessionId
        }

        if (state.gameMode && state.gameMode !== this.gameMode) {
            this.gameMode = state.gameMode;  // ← Uses gameMode
        }
    }
}
```

**Observation**:
This is the missing piece from Finding #6! state:update event's `data.state` object is passed here. Scanner tracks sessionId and gameMode changes.

**Backend Current**:
Backend sends state updates via state:update event with state object containing sessionId and gameMode.

**Scanner Field Usage**:
- `state.sessionId` ⚠️ (optional, checked before use)
- `state.gameMode` ⚠️ (optional, checked before use)

**Issue**:
- Good defensive checks ✅
- Tracks changes but doesn't appear to trigger any UI updates
- Logs changes but unclear what downstream effects occur
- gameMode tracking may be unused feature

**Recommendation**:
- Document state object structure for state:update event
- Investigate: what is gameMode used for? (detective vs blackmarket?)
- Consider: should mode changes trigger UI updates?
- Complete Finding #6 with this information

**Impact**:
🟢 Low - Optional fields with defensive checks
🟡 Medium - Unclear purpose suggests possible incomplete feature

**Related Findings**: #6 (state:update event), #8 (sessionId in gm:identified)

---
**Finding #24**: sessionId stored but only used for status reporting
**Scanner**: GM
**Location**: ALNScanner/index.html:5778 (store), 6074 (use)
**Severity**: 🟢 Note
**Category**: Field Usage / Pattern

**Code Snippet**:
```javascript
// Stored from gm:identified event
this.socket.on('gm:identified', (data) => {
    this.sessionId = data.sessionId;  // ← Store
    this.emit('gm:identified', data);
});

// Only usage - status reporting
getStatus() {
    return {
        isConnected: this.isConnected,
        status: this.connectionStatus,
        sessionId: this.sessionId,  // ← Used here
        connectedDevices: this.connectedDevices.length,
        queueSize: 0
    };
}

// Reset on disconnect
disconnect() {
    this.sessionId = null;  // ← Reset
}
```

**Observation**:
Completing Finding #8 investigation: sessionId is stored from authentication but only used in getStatus() method for reporting, not for any API calls or business logic.

**Backend Current**:
Backend sends sessionId in gm:identified event after handshake auth.

**Scanner Field Usage**:
- Stored but minimal usage
- Not sent in subsequent API calls
- Not used for session validation

**Issue**:
- Field is tracked but underutilized
- Could be used for session validation or reconnection
- getStatus() may be called by monitoring/debugging code

**Recommendation**:
- Consider: should sessionId be sent with transactions for validation?
- Consider: use sessionId for reconnection to same session?
- Document as "informational field" if truly not needed for logic

**Impact**:
🟢 Low - Field is stored but not critical for functionality
🟡 Medium - Missed opportunity for session validation?

**Related Findings**: #8 (gm:identified event), #23 (sessionId in state updates)

---
**Finding #25**: device events admin panel uses different handler accessing devices array
**Scanner**: GM
**Location**: ALNScanner/index.html:4143-4152
**Severity**: 🟢 Note
**Category**: Field Usage / Pattern

**Code Snippet**:
```javascript
// Main handler (from Finding #12)
socket.on('device:connected', (data) => {
    this.connectedDevices.push(data);  // ← Stores entire data object
});

socket.on('device:disconnected', (data) => {
    this.connectedDevices = this.connectedDevices.filter(d => d.deviceId !== data.deviceId);
});

// SEPARATE admin panel handlers
client.on('device:connected', (data) => {
    if (this.adminInstances?.systemMonitor) {
        this.adminInstances.systemMonitor.updateDeviceList(data.devices || []);  // ← Accesses data.devices array!
    }
});

client.on('device:disconnected', (data) => {
    // Same pattern - uses data.devices array
});
```

**Observation**:
Admin panel handlers for device events use DIFFERENT structure! Main handlers expect single device object, admin handlers expect `data.devices` array (full device list).

**Backend Current**:
Backend may send different event formats to different listeners, OR scanner expects wrong format in admin panel.

**Scanner Field Usage**:
- Main: entire `data` as device object (Finding #12)
- Admin: `data.devices` ⚠️ (optional array with fallback to [])

**Issue**:
- **CRITICAL MISMATCH**: Two handlers expect different event structures!
- Admin handler expects full device list, main handler expects single device
- This is a BUG - one of these is wrong
- Defensive fallback to [] prevents crash but wrong data shown

**Recommendation**:
- **CRITICAL**: Determine correct event structure from backend
- Align both handlers to same structure
- If backend sends single device, admin should maintain its own array
- If backend sends full list, main handler is wrong

**Impact**:
🔴 HIGH - Event structure mismatch indicates bug
🟡 Medium - Admin panel device list likely broken
🟢 Note - Fallback prevents crash but shows wrong data

**Related Findings**: #12 (device events), #13 (sync:full devices)

---

# PLAYER SCANNER FINDINGS

---
**Finding #26**: POST /api/scan response is logged but NOT used for any logic
**Scanner**: Player
**Location**: aln-memory-scanner/js/orchestratorIntegration.js:31-58, index.html:1075-1085
**Severity**: 🟡 Important
**Category**: Field Usage / HTTP

**Code Snippet**:
```javascript
// orchestratorIntegration.js - scanToken method
async scanToken(tokenId, teamId) {
    if (!this.connected) {
        this.queueOffline(tokenId, teamId);
        return { status: 'offline', queued: true };  // ← Returns synthetic response
    }

    try {
        const response = await fetch(`${this.baseUrl}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokenId,
                teamId,
                scannerId: this.deviceId,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();  // ← Returns entire response
    } catch (error) {
        console.error('Scan failed:', error);
        this.queueOffline(tokenId, teamId);
        return { status: 'error', queued: true, error: error.message };  // ← Returns synthetic response
    }
}

// index.html - Usage (ONLY place scanToken is called)
orchestrator.scanToken(token.SF_RFID, teamId).then(response => {
    console.log('Orchestrator response:', response);  // ← ONLY LOGS IT

    // Hide modal after 2 seconds
    setTimeout(() => {
        document.getElementById('video-processing').classList.remove('active');
    }, 2000);
}).catch(error => {
    console.error('Orchestrator error:', error);  // ← ONLY LOGS ERROR
    document.getElementById('video-processing').classList.remove('active');
});
```

**Observation**:
Player Scanner calls scanToken() but response is ONLY logged to console - NO field usage, NO UI updates based on response, NO error display to users.

**Backend Current**:
Backend /api/scan sends response with status, message, tokenId, mediaAssets, videoPlaying, etc. (from cursory investigation).

**Scanner Field Usage**:
- **NONE** - Entire response logged but never accessed

**Issue**:
- **MISSING FUNCTIONALITY**: Backend sends rich response but scanner ignores it
- Users don't see scan results, errors, status messages
- `videoPlaying` flag ignored (no indication if video triggered)
- `status` values (accepted, rejected, queued) not shown
- `waitTime` for rejected scans not displayed
- `message` from backend not shown to users

**Recommendation**:
- Add UI feedback for scan results
- Display backend messages to users
- Show different UI for accepted vs rejected vs queued
- Display waitTime for rejected scans
- Show error messages from backend
- Indicate when video is triggered

**Impact**:
🔴 HIGH - Users get no feedback on scan results
🔴 HIGH - Backend messages invisible (defeats purpose of API)
🟡 Medium - Scan still works but UX is poor
🟢 Note - No breaking changes (any format works since ignored)

**Related Findings**: #19 (GM Scanner has similar transaction result problem)

---
**Finding #27**: POST /api/scan offline mode returns synthetic response
**Scanner**: Player
**Location**: aln-memory-scanner/js/orchestratorIntegration.js:32-34, 54-57
**Severity**: 🟢 Note
**Category**: Pattern / Offline Handling

**Code Snippet**:
```javascript
async scanToken(tokenId, teamId) {
    if (!this.connected) {
        this.queueOffline(tokenId, teamId);
        return { status: 'offline', queued: true };  // ← Synthetic response
    }

    try {
        // ... fetch logic ...
    } catch (error) {
        console.error('Scan failed:', error);
        this.queueOffline(tokenId, teamId);
        return { status: 'error', queued: true, error: error.message };  // ← Synthetic response
    }
}
```

**Observation**:
When offline or on error, scanner returns synthetic response objects that mimic backend format. Has two synthetic formats: `{status: 'offline', queued: true}` and `{status: 'error', queued: true, error: message}`.

**Backend Current**:
Backend doesn't send these formats - scanner creates them for offline/error cases.

**Scanner Field Usage**:
- Creates `status`, `queued`, `error` fields
- Not used by caller (Finding #26)

**Issue**:
- Good pattern for consistent interface ✅
- But since caller ignores response, synthetic responses are wasted
- `status: 'offline'` and `status: 'error'` could be useful if displayed

**Recommendation**:
- Keep synthetic response pattern ✅
- Use these responses in UI (Finding #26)
- Document as internal format, not backend contract

**Impact**:
🟢 Low - Good defensive pattern
🟢 Note - Currently wasted due to Finding #26

**Related Findings**: #26 (response not used)

---
**Finding #28**: POST /api/scan/batch response is checked but not parsed
**Scanner**: Player
**Location**: aln-memory-scanner/js/orchestratorIntegration.js:99-140
**Severity**: 🟡 Important
**Category**: Field Usage / HTTP

**Code Snippet**:
```javascript
async processOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.connected) {
        return;
    }

    console.log(`Processing ${this.offlineQueue.length} offline transactions...`);
    const batch = this.offlineQueue.splice(0, 10); // Process up to 10 at a time

    try {
        const response = await fetch(`${this.baseUrl}/api/scan/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: batch.map(item => ({
                    tokenId: item.tokenId,
                    teamId: item.teamId,
                    scannerId: this.deviceId,
                    timestamp: new Date(item.timestamp).toISOString()
                }))
            })
        });

        if (response.ok) {
            console.log('Batch processed successfully');  // ← Only logs success
            this.saveQueue();

            // Process remaining queue
            if (this.offlineQueue.length > 0) {
                setTimeout(() => this.processOfflineQueue(), 1000);
            }
        } else {
            // Re-queue failed batch
            this.offlineQueue.unshift(...batch);
            this.saveQueue();
        }
    } catch (error) {
        console.error('Batch processing failed:', error);
        // Re-queue failed batch
        this.offlineQueue.unshift(...batch);
        this.saveQueue();
    }
}
```

**Observation**:
Batch processing checks `response.ok` but never parses response body. Success path logs but doesn't access response data. Failure path re-queues entire batch.

**Backend Current**:
Backend /api/scan/batch likely sends `{results: [{...}, {...}]}` (from cursory investigation).

**Scanner Field Usage**:
- HTTP status via `response.ok` ✅
- **Response body**: NEVER parsed, even on success

**Issue**:
- No way to know if individual scans in batch succeeded or failed
- Failed scans re-queued even if some succeeded
- No partial success handling
- Response format expectations documented but never used

**Recommendation**:
- Parse batch response: `const data = await response.json()`
- Check individual results if backend provides them
- Only re-queue items that actually failed
- Log individual scan results for debugging

**Impact**:
🟡 Medium - All-or-nothing batch processing is inefficient
🟡 Medium - No visibility into individual scan failures
🟢 Note - Works but suboptimal

**Related Findings**: #26 (single scan also ignores response)

---
**Finding #29**: GET /api/state/status only checks HTTP status
**Scanner**: Player
**Location**: aln-memory-scanner/js/orchestratorIntegration.js:142-173
**Severity**: 🟢 Note
**Category**: Field Usage / HTTP

**Code Snippet**:
```javascript
async checkConnection() {
    try {
        const response = await fetch(`${this.baseUrl}/api/state/status`, {
            method: 'GET',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
        });

        const wasOffline = !this.connected;
        this.connected = response.ok;  // ← Only checks HTTP status

        if (this.connected && wasOffline) {
            console.log('Connection restored!');
            this.onConnectionRestored();
        } else if (!this.connected && !wasOffline) {
            console.log('Connection lost!');
            this.onConnectionLost();
        }

        return this.connected;
    } catch (error) {
        const wasOnline = this.connected;
        this.connected = false;

        if (wasOnline) {
            console.log('Connection lost!');
            this.onConnectionLost();
        }

        return false;
    }
}
```

**Observation**:
Connection check only cares about HTTP 200 OK status - response body never parsed. Simple and effective for connection monitoring.

**Backend Current**:
Backend /api/state/status may send state data, but scanner only needs 200 OK.

**Scanner Field Usage**:
- HTTP status via `response.ok` ✅
- **Response body**: NEVER accessed

**Issue**: None - this is correct usage for connection check

**Recommendation**:
- Keep as-is ✅
- Backend can send empty `{}` or state data (ignored)
- Document as "connection health check only"

**Impact**:
🟢 Low - Works perfectly for intended purpose
🟢 Compatible - Any response body format works (ignored)

**Related Findings**: None

---
**Finding #30**: Connection events trigger UI updates but no queue status display
**Scanner**: Player
**Location**: aln-memory-scanner/index.html:1301-1309
**Severity**: 🟢 Note
**Category**: Pattern / UI

**Code Snippet**:
```javascript
// Listen for connection events
window.addEventListener('orchestrator:connected', () => {
    document.getElementById('connection-status').classList.add('connected');
    document.querySelector('.status-text').textContent = 'Online';
});

window.addEventListener('orchestrator:disconnected', () => {
    document.getElementById('connection-status').classList.remove('connected');
    document.querySelector('.status-text').textContent = 'Offline';
});
```

**Observation**:
CustomEvents from orchestratorIntegration.js (lines 194, 204) trigger UI updates for connection status. Simple text toggle between "Online" and "Offline".

**Backend Current**:
N/A - These are frontend events

**Scanner Field Usage**:
- Event names only (no payload)

**Issue**:
- Good pattern for connection UI ✅
- No indication of queued scan count
- Users don't know if scans are pending

**Recommendation**:
- Add queue size display (orchestrator has getQueueStatus() method)
- Show "Offline (3 scans queued)" instead of just "Offline"
- Update queue count as scans are added/processed

**Impact**:
🟢 Low - Connection status works
🟡 Medium - Missing helpful queue information

**Related Findings**: None

---
**Finding #31**: Offline queue structure is simple but effective
**Scanner**: Player
**Location**: aln-memory-scanner/js/orchestratorIntegration.js:61-76, 78-97
**Severity**: 🟢 Note
**Category**: Pattern / Offline Handling

**Code Snippet**:
```javascript
queueOffline(tokenId, teamId) {
    // Enforce queue limit
    if (this.offlineQueue.length >= this.maxQueueSize) {
        this.offlineQueue.shift(); // Remove oldest if at limit
    }

    this.offlineQueue.push({
        tokenId,
        teamId,
        timestamp: Date.now(),  // ← Note: number not ISO string
        retryCount: 0
    });

    this.saveQueue(); // Persist to localStorage
}

saveQueue() {
    try {
        localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
    } catch (e) {
        console.error('Failed to save offline queue:', e);
    }
}

loadQueue() {
    try {
        const saved = localStorage.getItem('offline_queue');
        if (saved) {
            this.offlineQueue = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load offline queue:', e);
        this.offlineQueue = [];
    }
}
```

**Observation**:
Offline queue uses localStorage for persistence. Structure: `{tokenId, teamId, timestamp, retryCount}`. Max 100 items (FIFO removal). Good error handling in save/load.

**Backend Current**:
N/A - Local queue only

**Scanner Field Usage**:
- `tokenId`, `teamId`, `timestamp` (number), `retryCount`

**Issue**:
- Good localStorage error handling ✅
- retryCount tracked but never incremented (not used)
- timestamp stored as number but sent as ISO string (conversion in batch processing)
- FIFO removal on overflow means oldest scans dropped silently

**Recommendation**:
- Either use retryCount or remove field
- Consider warning user when queue is full
- Document queue overflow behavior

**Impact**:
🟢 Low - Works well for offline support
🟢 Note - retryCount is dead code

**Related Findings**: #28 (batch processing)

---
**Finding #32**: Player Scanner error handling is minimal
**Scanner**: Player
**Location**: Multiple locations in orchestratorIntegration.js and index.html:1082-1085
**Severity**: 🔴 Critical
**Category**: Error Handling / Pattern

**Code Snippet**:
```javascript
// In orchestratorIntegration.js
async scanToken(tokenId, teamId) {
    try {
        // ...
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);  // ← Generic error
        }
        return await response.json();
    } catch (error) {
        console.error('Scan failed:', error);  // ← Only console
        this.queueOffline(tokenId, teamId);
        return { status: 'error', queued: true, error: error.message };
    }
}

// In index.html - caller
orchestrator.scanToken(token.SF_RFID, teamId).then(response => {
    console.log('Orchestrator response:', response);  // ← Logs response (Finding #26)
}).catch(error => {
    console.error('Orchestrator error:', error);  // ← ONLY LOGS ERROR
    document.getElementById('video-processing').classList.remove('active');
});
```

**Observation**:
ALL error handling just logs to console - users never see errors. No error UI, no error messages, no error indication beyond console.

**Backend Current**:
Backend may send error details in response, but scanner doesn't parse them (Finding #26).

**Scanner Field Usage**:
- Errors are strings only (error.message)
- No structured error handling

**Issue**:
- 🔴 **CRITICAL**: Users see NO error feedback
- Network errors silent
- Backend errors silent
- HTTP errors silent
- Same problem as GM Scanner (Finding #14, #18, #19)

**Recommendation**:
- Add error display UI
- Show toast/modal for errors
- Parse backend error responses
- Display user-friendly error messages

**Impact**:
🔴 CRITICAL - Users have no idea when scans fail
🔴 HIGH - Poor UX, users confused by silent failures

**Related Findings**: #14 (GM error handling), #18 (HTTP error pattern), #26 (response ignored)

---
**Finding #33**: Player Scanner triggers video from LOCAL token data, not backend response
**Scanner**: Player
**Location**: aln-memory-scanner/index.html:1066-1086
**Severity**: 🟢 Note / ⚠️ Important Clarification
**Category**: Video Trigger / Architecture

**Code Snippet**:
```javascript
processToken(token) {
    // Send to orchestrator if connected and token has video
    if (orchestrator && orchestrator.connected && token.video) {  // ← Checks LOCAL token.video
        // Show processing modal
        document.getElementById('video-processing').classList.add('active');

        // Get current team from UI or use default
        const teamId = sessionStorage.getItem('currentTeam') || 'TEAM_A';

        // Send to orchestrator
        orchestrator.scanToken(token.SF_RFID, teamId).then(response => {
            console.log('Orchestrator response:', response);  // ← Response still ignored

            // Hide modal after 2 seconds
            setTimeout(() => {
                document.getElementById('video-processing').classList.remove('active');
            }, 2000);
        }).catch(error => {
            console.error('Orchestrator error:', error);
            document.getElementById('video-processing').classList.remove('active');
        });
    }
    // ... rest of token display logic
}
```

**Observation**:
Video triggering happens BEFORE calling orchestrator, based on LOCAL tokens.json data (`token.video` field). The backend's `videoPlaying` response field is NOT used - scanner decides locally.

**Backend Current**:
Backend /api/scan sends `videoPlaying` flag in response, but scanner doesn't check it.

**Scanner Field Usage**:
- `token.video` from LOCAL tokens.json ✅ (used to trigger modal + orchestrator call)
- Backend `response.videoPlaying` ❌ (ignored, Finding #26)

**Issue/Clarification**:
- ✅ Video trigger WORKS but uses local data, not backend response
- 🤔 Backend response `videoPlaying` is redundant (scanner already knows from local token)
- 🤔 Scanner sends scan to backend but doesn't wait for/use response before showing modal
- 🟢 Pattern makes sense for ESP32: local decision, fire-and-forget to backend

**Recommendation**:
- Document that video trigger is CLIENT-SIDE decision based on tokens.json
- Backend `videoPlaying` field in response is OPTIONAL (scanner doesn't use it)
- Consider: Backend could use scan request to queue video, response field is informational only
- ESP32 version will follow same pattern: check local data, POST to backend, show UI

**Impact**:
🟢 Low - Video triggering works correctly via local token data
🟢 Note - Backend response field is unused but doesn't hurt
✅ Clarifies that video trigger is NOT dependent on backend response parsing

**Related Findings**: #26 (response ignored), #27 (fire-and-forget pattern)

---
