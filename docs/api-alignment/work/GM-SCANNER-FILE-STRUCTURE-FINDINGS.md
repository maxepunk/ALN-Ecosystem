# GM Scanner File Structure Findings

**Purpose**: Atomic findings log for GM Scanner file structure investigation (Phase 6.2)
**Created**: 2025-10-01
**Status**: 🔄 IN PROGRESS - Phase 6.2.1 (Structural Mapping Complete), Phase 6.2.2 (Contract Violations) Starting
**Component**: ALNScanner (GM Scanner PWA)

---

## Investigation Scope

**Primary File**: ALNScanner/index.html (6,428 lines total)
- Lines 1-1737: HTML + CSS
- Lines 1738-6428: JavaScript (4,690 lines)

**Supporting Files**:
- sw.js (service worker)
- data/ (submodule to ALN-TokenData)
- manifest.json

**Investigation Focus**:
1. Contract violations (Decision #2, #4, #10)
2. Standalone mode game logic architecture
3. WebSocket integration patterns
4. HTTP endpoint usage
5. Defensive code patterns (normalization layers)
6. Client-side duplication of backend logic
7. Refactor coordination requirements

---

## Finding Template

```markdown
---
**Finding #N**: [One-line summary]
**Category**: Architecture / Pattern / Violation / Dead Code / Anti-Pattern / Info
**Location**: file:line-range
**Severity**: 🔴 Critical / 🟡 Important / 🟢 Note / 🔵 Info
**Contract Alignment**: Decision #X reference
**Operational Mode**: [NETWORKED] / [STANDALONE] / [BOTH]

**Code Snippet**:
```javascript
// relevant code
```

**Observation**: What was found

**Backend Comparison**: How this compares to backend (if applicable)

**Issue**: Problem identified (if any)

**Impact**: Breaking change risk / refactor coordination required

**Action Required**: What needs to be done

**Related Findings**: Backend #X, GM #Y
---
```

---

# FINDINGS START HERE

---

## Phase 6.2.1: Structural Mapping (COMPLETE ✅)

**Output**: work/GM-SCANNER-MODULE-MAP.md (450 lines)

**Summary**:
- Mapped all 14 internal modules + 5 ES6 classes
- Identified module boundaries (line ranges for each)
- Tagged operational modes ([NETWORKED], [STANDALONE], [BOTH])
- Created dependency graph
- Documented critical observations

**Key Discoveries**:
- Single-file architecture (6,428 lines) with well-organized internal modules
- Dual operation support: Full game logic client-side for standalone mode
- Admin panel integrated (not separate app)
- 16+ WebSocket events used
- 11+ HTTP endpoints referenced (many ELIMINATED in Phase 4.9)

---

## Phase 6.2.2: Contract Alignment Analysis - Field Naming

### Finding #50: Defensive Field Normalization Layer
**Category**: Defensive Code
**Location**: index.html:2672 (DataManager.addTransaction)
**Severity**: 🟡 Important
**Contract Alignment**: Decision #4 (deviceId field naming)
**Operational Mode**: [BOTH]

**Code Snippet**:
```javascript
// DataManager.addTransaction() - lines 2656-2685
addTransaction(transaction) {
    const normalizedTx = {
        timestamp: transaction.timestamp || new Date().toISOString(),
        stationId: transaction.scannerId || transaction.stationId || Settings.stationId,  // ← Triple fallback
        stationMode: transaction.stationMode || Settings.stationMode,
        teamId: transaction.teamId || App.currentTeamId,
        rfid: transaction.tokenId || transaction.rfid,
        tokenId: transaction.tokenId || transaction.rfid,
        // ... more fields
    };
    this.transactions.push(normalizedTx);
}
```

**Observation**: Triple fallback handles backend sending `scannerId`, internal usage of `stationId`, or Settings default.

**Issue**: Defensive code masks field naming inconsistency between backend and scanner.

**Action Required** (ATOMIC with Backend #40, #34):
- **Line 2672**: Change to `deviceId: transaction.deviceId || Settings.deviceId`
- Coordinate with Backend Transaction.toJSON() fix and validators.js fix
- Single PR across repos

---

### Finding #51: ROOT CAUSE - GM Scanner Sends scannerId to Backend
**Category**: Violation
**Location**: index.html:4510 (App.processTransaction - networked mode)
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #4 (deviceId field naming)
**Operational Mode**: [NETWORKED]

**Code Snippet**:
```javascript
// Line 4510 - App.processTransaction()
if (window.connectionManager.connected) {
    const txId = window.queueManager.queueTransaction({
        ...transaction,
        scannerId: Settings.stationId,  // ← Sends scannerId
        sessionId: window.connectionManager.sessionId
    });
}
```

**Observation**: Sends `scannerId` field to backend via `transaction:submit` WebSocket event.

**Issue**: Violates Decision #4 (should be `deviceId`). GM Scanner complies with CURRENT broken backend, not contracts.

**Action Required** (ATOMIC with Backend #40, #34, #28):
- **Line 4510**: Change `scannerId: Settings.stationId` → `deviceId: Settings.deviceId`
- Change with backend Transaction.toJSON(), validators.js, broadcasts.js
- Single coordinated PR across backend + scanner repos
- All transaction tests update field name

---

### Finding #52: Internal stationId Field - 17 Locations
**Category**: Violation
**Location**: index.html (17 code locations + 3 UI elements)
**Severity**: 🟡 Important
**Contract Alignment**: Decision #4 (deviceId field naming)
**Operational Mode**: [BOTH]

**Code Locations** (complete list):
```
Settings module:
  3813: stationId: '001' (default)
  3822: this.stationId = window.connectionManager.stationId
  3825: localStorage.getItem('stationId')
  3829: document.getElementById('stationId')
  3842: document.getElementById('stationId').value
  3851: localStorage.setItem('stationId', ...)

App module:
  4485: stationId: Settings.stationId

ConnectionManager:
  4893: keys.STATION_ID
  4940-4948: get/set stationId()
  5040: stationId: this.stationId (auth)
  5259: this.stationId = stationName

OrchestratorClient:
  5590: stationId: stationName (session)
  5618-5619: config.stationId validation
  5674: stationId: this.config.stationId (transaction)
  5977: stationId: this.config.stationId (admin)
  6314: window.connectionManager.stationId
  6333: window.connectionManager.stationId

HTML:
  1385: <span id="stationIdDisplay">
  1421: <label for="stationId">
  1422: <input type="text" id="stationId">
```

**Observation**: Entire GM Scanner uses `stationId` internally (17 code + 3 HTML locations). localStorage key is `'stationId'`.

**Issue**: Violates Decision #4 (should be `deviceId`).

**Action Required** (GM Scanner only - internal change):
- **Code**: Change all 17 `stationId` → `deviceId`
- **HTML**: Change 3 UI elements (IDs, label text "Station ID" → "Device ID")
- **localStorage**: Change key `'stationId'` → `'deviceId'` (existing users re-enter, pre-production)
- Single commit, redeploy

---

## Phase 6.2.2: Contract Alignment Analysis - Event Structure

### Finding #53: Defensive Event Unwrapping - transaction:new
**Category**: Defensive Code
**Location**: index.html:5789 (ConnectionManager.setupSocketEventHandlers)
**Severity**: 🟢 Note
**Contract Alignment**: Decision #2 (wrapped WebSocket envelope)
**Operational Mode**: [NETWORKED]

**Code Snippet**:
```javascript
// Line 5789
const transaction = eventData.data || eventData;  // ← Defensive fallback
```

**Observation**: Fallback handles both wrapped (`eventData.data`) and unwrapped (`eventData`) formats. Comment says backend sends wrapped, but code doesn't trust it.

**Issue**: Defensive code masks inconsistency.

**Action Required** (ATOMIC with Backend #21-#27 wrapping fixes):
- **Line 5789**: Change to `const transaction = eventData.data;` (remove fallback)
- Coordinate with backend eventWrapper.js adoption
- Single PR across repos

---

### Finding #54: Inconsistent Event Data Access - 3 Patterns
**Category**: Inconsistency
**Location**: index.html:5777-5939 (14 application event handlers)
**Severity**: 🟡 Important
**Contract Alignment**: Decision #2 (wrapped WebSocket envelope)
**Operational Mode**: [NETWORKED]

**Three Access Patterns Observed**:
```javascript
// Pattern A: Defensive fallback (1 event)
Line 5789: const transaction = eventData.data || eventData;  // transaction:new

// Pattern B: Direct wrapped access (3 events)
Line 5803: DataManager.updateTeamScoreFromBackend(data.data);  // score:updated
Line 5829: UIManager.showGroupCompletionNotification(data.data);  // group:completed
Line 5836: console.log('New team created:', data.data);  // team:created

// Pattern C: Direct unwrapped access (10 events)
Line 5778: this.sessionId = data.sessionId;  // gm:identified (assumes unwrapped)
Line 5783: this.emit('state:update', data);  // state:update (unwrapped)
// ... 8 more events
```

**Observation**: Scanner code reflects backend's inconsistent wrapping (Backend #22: 62% non-compliant).

**Issue**: Three different patterns across 14 handlers.

**Action Required** (ATOMIC with Backend #21-#27):
- Standardize ALL 14 handlers to `const payload = eventData.data;`
- Coordinate with backend eventWrapper.js adoption
- Single PR across repos

---

### Finding #55: 4 Eliminated Event Handlers (Dead Code)
**Category**: Dead Code
**Location**: index.html:5782, 5808, 5834, 5856
**Severity**: 🟡 Important
**Contract Alignment**: 09-essential-api-list.md (16 events only)
**Operational Mode**: [NETWORKED]

**Handlers to DELETE**:
```javascript
Line 5782: socket.on('state:update')     // ELIMINATED (use sync:full)
Line 5808: socket.on('scores:reset')     // ELIMINATED (use gm:command:ack)
Line 5834: socket.on('team:created')     // ELIMINATED (not needed)
Line 5856: socket.on('state:sync')       // ELIMINATED (use sync:full)
```

**Observation**: 4 handlers for events eliminated in Phase 4.9. Backend still emits (Backend #25-#27).

**Issue**: Dead code maintaining over-engineered architecture.

**Action Required** (INDEPENDENT of backend):
- **DELETE lines 5782-5785** (`state:update` handler)
- **DELETE lines 5808-5823** (`scores:reset` handler)
- **DELETE lines 5834-5837** (`team:created` handler)
- **DELETE lines 5856-5862** (`state:sync` handler)
- Backend stops emitting separately (no coordination needed)

---

### Finding #56: 19 WebSocket Event Handlers Inventory
**Category**: Info
**Location**: index.html:5706-5939 (ConnectionManager.setupSocketEventHandlers)
**Severity**: 🔵 Info
**Contract Alignment**: Reference for complete handler list
**Operational Mode**: [NETWORKED]

**Complete Handler List**:

**Socket.io Protocol Events** (5):
1. Line 5706: `connect` - Connection established
2. Line 5725: `disconnect` - Connection lost
3. Line 5753: `connect_error` - Connection failed
4. Line 5766: `reconnecting` - Reconnection attempt
5. Line 5770: `reconnect` - Reconnected

**Application Events** (14):
6. Line 5777: `gm:identified` - GM authentication success
7. Line 5782: `state:update` - ❌ ELIMINATED
8. Line 5787: `transaction:new` - New transaction broadcast
9. Line 5794: `video:status` - Video playback status
10. Line 5799: `score:updated` - Team score update
11. Line 5808: `scores:reset` - ❌ ELIMINATED
12. Line 5825: `group:completed` - Group completion bonus
13. Line 5834: `team:created` - ❌ ELIMINATED
14. Line 5839: `device:connected` - Device connection
15. Line 5844: `device:disconnected` - Device disconnection
16. Line 5849: `sync:full` - Full state synchronization
17. Line 5856: `state:sync` - ❌ ELIMINATED
18. Line 5934: `error` - Error message
19. Line 5939: `heartbeat:ack` - Heartbeat acknowledgment

**Target State** (from 09-essential-api-list.md):
- **16 essential events**
- **4 to be deleted**: `state:update`, `scores:reset`, `team:created`, `state:sync`
- **Remaining 10 application events** should match essential list

**Action Required**: Map remaining 10 to essential API list, identify any missing handlers

**Related Findings**: GM #55 (Eliminated events)

---

## Phase 6.2.2: Contract Alignment Analysis - Error Display

### Finding #57: No User-Facing Error Display Methods
**Category**: Missing Abstraction
**Location**: index.html:3281-3809 (UIManager module - 528 lines)
**Severity**: 🟡 Important
**Contract Alignment**: Decision #10 (error display to users)
**Operational Mode**: [BOTH]

**Observation**: UIManager has NO error display methods.

**Methods that exist**:
- Line 3306: `showScreen()` - Screen navigation
- Line 3367: `showGroupCompletionNotification()` - Group bonus notification
- Line 3795: `showTokenResult()` - Token scan result display

**Methods missing**:
- `showError(message)` - User-facing error display
- `showToast(message, type)` - Temporary notifications
- `clearErrors()` - Clear error state

**Issue**: Decision #10 requires user-facing error display. Currently no mechanism exists.

**Action Required** (GM Scanner only - INDEPENDENT):
- **ADD** error display methods to UIManager (3 methods)
- **ADD** HTML error container elements
- **UPDATE** 20+ catch blocks to call UIManager.showError()
- No backend coordination needed

---

###Finding #58: Console-Only Error Handling - 20+ Catch Blocks
**Category**: Violation
**Location**: index.html (20+ error handling locations)
**Severity**: 🟡 Important
**Contract Alignment**: Decision #10 (error display to users)
**Operational Mode**: [BOTH]

**Sample Locations** (console.error only):
```
Line 2172: catch (error) { console.error(...); }  // NFCHandler
Line 4986: catch (error) { console.error('Invalid token format'); }  // ConnectionManager
Line 5246: catch (error) { console.error('Connection failed'); }  // OrchestratorClient
Line 5936: socket.on('error') → console.error()  // WebSocket errors
```

**Pattern**: ALL error handling uses `console.error()` or `console.log()`. Zero user-facing display.

**Issue**: Users don't see errors (hidden in browser console). Violates Decision #10.

**Action Required** (after Finding #57 methods exist):
- **UPDATE** ~20 catch blocks: Add `UIManager.showError(error.message)` calls
- Keep console.error for developer debugging
- Independent change (no coordination)

---

---

## Summary Statistics

**Findings Documented**: 9 (Finding #50-#58)

**Severity**:
- 🔴 Critical: 1 (#51 - ROOT CAUSE sends scannerId)
- 🟡 Important: 6 (#50, #52, #54, #55, #57, #58)
- 🟢 Note: 1 (#53)
- 🔵 Info: 1 (#56)

**Contract Violations Found**:
- Decision #4 (deviceId): 3 findings (#50, #51, #52)
- Decision #2 (wrapped events): 3 findings (#53, #54, #55)
- Decision #10 (error display): 2 findings (#57, #58)

**Refactor Coordination**:

**ATOMIC** (must change together):
1. **Field naming** (#50, #51): Backend (Transaction.toJSON, validators.js, broadcasts.js) + GM Scanner (lines 2672, 4510) + Tests
2. **Event wrapping** (#53, #54): Backend (adopt eventWrapper.js for all events) + GM Scanner (standardize 14 handlers) + Tests

**INDEPENDENT** (GM Scanner only):
1. **Internal stationId → deviceId** (#52): 17 code + 3 HTML locations
2. **Delete eliminated handlers** (#55): 4 handlers (lines 5782, 5808, 5834, 5856)
3. **Add error display** (#57, #58): UIManager methods + HTML + update 20+ catch blocks

**Pre-Production**: No backwards compatibility code - users re-enter settings after redeploy

**Investigation Progress**:
- ✅ Phase 6.2.1: Structural Mapping (GM-SCANNER-MODULE-MAP.md)
- ✅ Phase 6.2.2: Contract Violations - ALL COMPLETE (9 findings)
  - ✅ Field Naming (3 findings)
  - ✅ Event Structure (4 findings)
  - ✅ Error Display (2 findings)
- ⏳ Phase 6.2.3+: Defensive Code Analysis, Game Logic Comparison, etc.

---
