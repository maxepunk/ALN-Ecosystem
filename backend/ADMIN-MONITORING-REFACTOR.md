# Admin Monitoring Display Refactoring Plan
## Phase 2.2 Continuation: Event-Driven Monitoring Architecture

**Date:** 2025-10-06
**Objective:** Refactor admin monitoring display logic to be event-driven, testable, and compliant with FR Section 4.1

---

## Problem Statement

### Current State Issues

1. **Incomplete Implementation**
   - Only 2 of 5 FR 4.1 monitoring types implemented (scores, transactions)
   - Missing: Session monitoring, Video monitoring, System monitoring displays
   - Event handlers receive data but don't update displays

2. **Scattered Logic**
   - `App.js:updateAdminPanel()` (lines 390-461): Handles scores and transactions
   - `AdminModule.SessionManager.updateDisplay()`: Exists but only called after commands
   - `AdminModule.VideoController.updateDisplay()`: Exists but only called after commands
   - `AdminModule.SystemMonitor`: Methods exist but never called

3. **No Event-Driven Updates**
   - `video:status` event received but display never updated
   - `device:connected/disconnected` updates array but never calls display
   - `sync:full` received but not used for display initialization
   - `score:updated` updates DataManager but doesn't trigger display refresh

4. **Architecture Violation**
   - AdminModule should own all admin display logic per separation of concerns
   - Current implementation violates this by keeping logic in App.js
   - Display methods exist in AdminModule but aren't wired to events

### Discovered During Testing

**Context**: Created 37 tests for AdminModule command construction (session, video, admin operations)
**User Question**: "does this test also make sure the admin panel is displaying the correct monitoring information?"
**Answer**: NO - tests only verified commands sent correctly, not monitoring display
**Decision**: "this probably calls for a carefully considered, and well designed refactor like we did with the app initialization"

---

## Contract Analysis

### FR Section 4.1 Requirements

| Monitoring Type | Required Fields | Current Status | AsyncAPI Events |
|-----------------|----------------|----------------|-----------------|
| **Session Monitoring** | Current session ID, status, start/end times; Recent 24h history | ❌ NOT IMPLEMENTED | session:update, sync:full |
| **Video Monitoring** | Current video (tokenId), queue length; **Full queue contents** | ❌ NOT IMPLEMENTED | video:status |
| **System Monitoring** | Orchestrator/VLC status; Device count and list (deviceId, type, IP, connection time) | ❌ NOT IMPLEMENTED | device:connected, device:disconnected, sync:full |
| **Score Monitoring** | All team scores (real-time); Score breakdown (base + bonus); Tokens scanned, completed groups | ✅ PARTIAL (in App.js) | score:updated |
| **Transaction Monitoring** | Recent transactions (real-time); Details: tokenId, teamId, deviceId, mode, points, timestamp; Token metadata | ✅ PARTIAL (in App.js) | transaction:new |

### AsyncAPI Contract Gaps

**Gap #1: Video Queue Contents**
- **FR Requirement**: "Full queue contents (tokenId, filename, position)" (FR 4.1.2)
- **AsyncAPI**: `video:status` only provides `queueLength` (integer)
- **Impact**: Cannot display full queue, only count
- **Resolution**: Document limitation, display queueLength only

**Gap #2: Session History**
- **FR Requirement**: "Recent session history (last 24 hours): name, times, status, final scores" (FR 4.1.1)
- **AsyncAPI**: `session:update` only provides current session
- **Impact**: Cannot display session history
- **Resolution**: Document limitation, display current session only

---

## Refactoring Strategy

### Approach: Same as App.init() Refactoring

**Proven Pattern from Phase 1.2:**
1. **Identify**: Monolithic function doing too much
2. **Extract**: Break into focused, testable functions
3. **Test**: Create comprehensive test coverage
4. **Consolidate**: Move related logic into dedicated module
5. **Validate**: Verify all functionality preserved

**Result from Phase 1.2:**
- Before: app.init() 77 lines, 0 tests
- After: 11 functions, 34 lines in init(), 58 tests, 0 bugs found

### New Architecture Design

```javascript
// NEW CLASS in AdminModule
AdminModule.MonitoringDisplay = class {
    constructor(connection) {
        this.connection = connection;
        this.setupEventListeners();
    }

    // CORE: Wire all monitoring events to display updates
    setupEventListeners() {
        this.connection.on('transaction:new', (data) => this.updateTransactionDisplay(data));
        this.connection.on('score:updated', (data) => this.updateScoreDisplay(data));
        this.connection.on('session:update', (data) => this.updateSessionDisplay(data));
        this.connection.on('video:status', (data) => this.updateVideoDisplay(data));
        this.connection.on('device:connected', () => this.updateSystemDisplay());
        this.connection.on('device:disconnected', () => this.updateSystemDisplay());
        this.connection.on('sync:full', (data) => this.updateAllDisplays(data));
    }

    // EXTRACTED from App.js:442-461
    updateTransactionDisplay(transaction) {
        const transactionLog = document.getElementById('admin-transaction-log');
        if (!transactionLog) return;

        // Append new transaction to display
        // (Extracted logic from App.js, cleaned up)
    }

    // EXTRACTED from App.js:394-441
    updateScoreDisplay(scoreData) {
        const scoreBoard = document.getElementById('admin-score-board');
        if (!scoreBoard) return;

        // Update score board with backend data
        // (Extracted logic from App.js, cleaned up)
    }

    // NEW: Implement per FR 4.1.1
    updateSessionDisplay(session) {
        const sessionIdElem = document.getElementById('admin-session-id');
        const sessionStatusElem = document.getElementById('admin-session-status');

        if (sessionIdElem) sessionIdElem.textContent = session?.id || '-';
        if (sessionStatusElem) sessionStatusElem.textContent = session?.status || 'No Session';
    }

    // NEW: Implement per FR 4.1.2
    updateVideoDisplay(videoStatus) {
        const currentVideoElem = document.getElementById('admin-current-video');
        const queueLengthElem = document.getElementById('admin-queue-length');

        if (currentVideoElem) {
            currentVideoElem.textContent = videoStatus?.tokenId || 'None';
        }
        if (queueLengthElem) {
            queueLengthElem.textContent = videoStatus?.queueLength || '0';
        }
    }

    // NEW: Implement per FR 4.1.3
    updateSystemDisplay() {
        // Orchestrator status
        const orchestratorStatus = this.connection.isConnected ? 'connected' : 'disconnected';
        const orchestratorElem = document.getElementById('orchestrator-status');
        if (orchestratorElem) {
            orchestratorElem.className = orchestratorStatus === 'connected'
                ? 'status-dot connected'
                : 'status-dot disconnected';
        }

        // Device list
        const devices = this.connection.connectedDevices || [];
        const deviceCountElem = document.getElementById('device-count');
        const deviceListElem = document.getElementById('device-list');

        if (deviceCountElem) deviceCountElem.textContent = devices.length;
        if (deviceListElem) {
            deviceListElem.innerHTML = devices.map(device => `
                <div class="device-item">
                    <span>${device.deviceId}</span>
                    <span class="device-type">${device.type}</span>
                </div>
            `).join('');
        }
    }

    // NEW: Initialize all displays from sync:full
    updateAllDisplays(syncData) {
        if (syncData.session) this.updateSessionDisplay(syncData.session);
        if (syncData.videoStatus) this.updateVideoDisplay(syncData.videoStatus);

        // Update scores for all teams
        if (syncData.scores && Array.isArray(syncData.scores)) {
            syncData.scores.forEach(score => this.updateScoreDisplay(score));
        }

        // Update transactions
        if (syncData.recentTransactions && Array.isArray(syncData.recentTransactions)) {
            // Render last 10 transactions
            const recent = syncData.recentTransactions.slice(-10).reverse();
            recent.forEach(tx => this.updateTransactionDisplay(tx));
        }

        // Update system status
        this.updateSystemDisplay();
    }

    // Helper: Refresh all displays from current data
    refreshAllDisplays() {
        // Trigger updates from cached data in DataManager
        // Used when manually switching to admin view
    }
};
```

### Integration Changes

**App.js Changes:**

```javascript
// BEFORE: Lines 390-461 (72 lines of logic)
updateAdminPanel() {
    // Score board logic (48 lines)
    const scoreBoard = document.getElementById('admin-score-board');
    if (scoreBoard) {
        // ... complex score display logic ...
    }

    // Transaction log logic (20 lines)
    const transactionLog = document.getElementById('admin-transaction-log');
    if (transactionLog) {
        // ... complex transaction display logic ...
    }
}

// AFTER: Delegation to AdminModule (5 lines)
updateAdminPanel() {
    if (this.viewController.adminInstances?.monitoring) {
        this.viewController.adminInstances.monitoring.refreshAllDisplays();
    }
}
```

**OrchestratorClient.js Changes:**

```javascript
// REMOVE manual updateAdminPanel() call (line 294)
this.socket.on('session:update', (eventData) => {
    const payload = eventData.data;
    this.emit('session:update', payload);

    if (payload.id) {
        this.sessionId = payload.id;
    }

    console.log(`Session ${payload.status}:`, payload);

    // REMOVE: Manual display update (event listener handles this now)
    // if (App.viewController?.currentView === 'admin') {
    //     App.updateAdminPanel();
    // }
});
```

**ViewController Integration:**

```javascript
// Add MonitoringDisplay to initAdminModules()
initAdminModules() {
    if (!this.client || !this.client.socket) {
        console.warn('Cannot init admin modules - no connection');
        return;
    }

    this.adminInstances = {
        sessionManager: new AdminModule.SessionManager(this.client),
        videoController: new AdminModule.VideoController(this.client),
        systemMonitor: new AdminModule.SystemMonitor(),
        adminOps: new AdminModule.AdminOperations(this.client),
        monitoring: new AdminModule.MonitoringDisplay(this.client)  // NEW
    };

    console.log('Admin modules initialized with networked connection');
}
```

---

## Implementation Plan

### Phase 1: Create MonitoringDisplay Class (TDD)

**Step 1.1: Write Tests First (Red)**
- Create `tests/unit/scanner/admin-monitoring-display.test.js`
- 17 test groups covering all monitoring types and event flows
- Tests verify event → display wiring, not implementation details

**Step 1.2: Create MonitoringDisplay Class (Green)**
- Add `AdminModule.MonitoringDisplay` class to `adminModule.js`
- Implement `setupEventListeners()` method
- Stub all display update methods (return immediately)
- Verify tests fail appropriately (event listeners work, displays empty)

**Step 1.3: Extract Transaction Display (Green)**
- Extract logic from `App.js:442-461` into `updateTransactionDisplay()`
- Clean up and simplify extracted code
- Add null checks for DOM elements
- Verify transaction display tests pass

**Step 1.4: Extract Score Display (Green)**
- Extract logic from `App.js:394-441` into `updateScoreDisplay()`
- Clean up and simplify extracted code
- Add null checks for DOM elements
- Verify score display tests pass

**Step 1.5: Implement Session Display (Green)**
- Implement `updateSessionDisplay()` per FR 4.1.1 requirements
- Use existing DOM elements: `admin-session-id`, `admin-session-status`
- Handle null session gracefully (display '-' and 'No Session')
- Verify session display tests pass

**Step 1.6: Implement Video Display (Green)**
- Implement `updateVideoDisplay()` per FR 4.1.2 requirements
- Use existing DOM elements: `admin-current-video`, `admin-queue-length`
- Display queueLength only (document full queue gap)
- Verify video display tests pass

**Step 1.7: Implement System Display (Green)**
- Implement `updateSystemDisplay()` per FR 4.1.3 requirements
- Update orchestrator/VLC status indicators
- Update device count and list
- Use `connection.connectedDevices` array
- Verify system display tests pass

**Step 1.8: Implement sync:full Handler (Green)**
- Implement `updateAllDisplays()` to initialize from sync:full
- Call all individual display methods with sync data
- Handle missing fields gracefully
- Verify sync:full tests pass

**Step 1.9: Implement Manual Refresh (Green)**
- Implement `refreshAllDisplays()` for manual triggers
- Use cached data from DataManager
- Used when switching to admin view
- Verify refresh tests pass

### Phase 2: Integrate MonitoringDisplay

**Step 2.1: Wire into ViewController**
- Modify `initAdminModules()` to create MonitoringDisplay instance
- Verify monitoring instance available in adminInstances

**Step 2.2: Replace App.updateAdminPanel()**
- Replace implementation with delegation to monitoring.refreshAllDisplays()
- Keep method signature for backwards compatibility
- Verify no functionality lost

**Step 2.3: Remove Manual Update Calls**
- Remove `App.updateAdminPanel()` call from `session:update` handler (orchestratorClient.js:294)
- Events now trigger updates automatically via MonitoringDisplay

**Step 2.4: Integration Testing**
- Run all existing tests (37 AdminModule command tests)
- Run new tests (17 MonitoringDisplay tests)
- Verify no regressions

### Phase 3: Document and Commit

**Step 3.1: Update BUG-LOG-ADMIN.md**
- Document contract gaps (video queue, session history)
- Document architectural improvement (event-driven monitoring)
- List any new bugs found during refactoring

**Step 3.2: Update TEST-IMPROVEMENT-PLAN.md**
- Mark Phase 2.2 as COMPLETE
- Document final test count (37 command + 17 monitoring = 54 tests)
- Document refactoring approach and outcomes

**Step 3.3: Commit Changes**
- Commit message: "refactor(scanner): Implement event-driven admin monitoring display"
- Include test additions, architecture improvements, contract gap documentation

---

## Testing Strategy

### Test Groups (17 New)

**GROUP 1: Event Registration**
- ✅ MonitoringDisplay registers transaction:new listener
- ✅ MonitoringDisplay registers score:updated listener
- ✅ MonitoringDisplay registers session:update listener
- ✅ MonitoringDisplay registers video:status listener
- ✅ MonitoringDisplay registers device:connected listener
- ✅ MonitoringDisplay registers device:disconnected listener
- ✅ MonitoringDisplay registers sync:full listener

**GROUP 2: Transaction Display**
- ✅ Updates transaction log when transaction:new received
- ✅ Formats transaction fields per FR 4.1.5 (tokenId, teamId, deviceId, mode, points, timestamp)
- ✅ Includes token metadata (memoryType, valueRating, group) if available
- ✅ Handles missing DOM element gracefully

**GROUP 3: Score Display**
- ✅ Updates score board when score:updated received
- ✅ Displays score breakdown (currentScore, baseScore, bonusPoints)
- ✅ Displays tokens scanned count and completed groups
- ✅ Handles missing DOM element gracefully

**GROUP 4: Session Display**
- ✅ Updates session info when session:update received
- ✅ Displays session ID, status, start/end times
- ✅ Handles null session (displays '-' and 'No Session')
- ✅ Handles missing DOM elements gracefully

**GROUP 5: Video Display**
- ✅ Updates video info when video:status received
- ✅ Displays current video tokenId
- ✅ Displays queue length
- ✅ Handles idle state (no video playing)
- ✅ Handles missing DOM elements gracefully

**GROUP 6: System Display**
- ✅ Updates orchestrator status based on connection state
- ✅ Updates device count correctly
- ✅ Updates device list with correct fields (deviceId, type)
- ✅ Handles empty device list
- ✅ Handles missing DOM elements gracefully

**GROUP 7: sync:full Initialization**
- ✅ Initializes all displays when sync:full received
- ✅ Handles sync:full with all fields present
- ✅ Handles sync:full with missing optional fields
- ✅ Displays last 10 transactions from sync:full
- ✅ Updates all team scores from sync:full

**GROUP 8: Edge Cases**
- ✅ Multiple rapid events don't cause display errors
- ✅ Display works when DOM elements not yet loaded
- ✅ Display clears appropriately on disconnect
- ✅ Manual refresh works with no cached data

### Test Approach

**Mock Strategy:**
```javascript
describe('MonitoringDisplay', () => {
    let monitoring;
    let mockConnection;
    let mockElements;

    beforeEach(() => {
        // Mock connection with event emitter
        mockConnection = {
            on: jest.fn((event, handler) => {
                mockConnection._handlers = mockConnection._handlers || {};
                mockConnection._handlers[event] = handler;
            }),
            emit: jest.fn((event, data) => {
                if (mockConnection._handlers[event]) {
                    mockConnection._handlers[event](data);
                }
            }),
            isConnected: true,
            connectedDevices: []
        };

        // Mock DOM elements
        mockElements = {
            'admin-transaction-log': { innerHTML: '' },
            'admin-score-board': { innerHTML: '' },
            'admin-session-id': { textContent: '' },
            'admin-session-status': { textContent: '' },
            'admin-current-video': { textContent: '' },
            'admin-queue-length': { textContent: '' },
            'orchestrator-status': { className: '' },
            'device-count': { textContent: '' },
            'device-list': { innerHTML: '' }
        };

        global.document.getElementById = jest.fn((id) => mockElements[id]);

        monitoring = new AdminModule.MonitoringDisplay(mockConnection);
    });

    it('should update transaction display when transaction:new received', () => {
        const transaction = {
            tokenId: 'abc123',
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket',
            points: 100,
            timestamp: '2025-10-06T10:00:00Z',
            memoryType: 'Technical',
            valueRating: 3
        };

        mockConnection.emit('transaction:new', transaction);

        const logHtml = mockElements['admin-transaction-log'].innerHTML;
        expect(logHtml).toContain('abc123');
        expect(logHtml).toContain('001');
        expect(logHtml).toContain('Technical');
    });
});
```

---

## Expected Outcomes

### Functional Improvements
- ✅ All 5 FR 4.1 monitoring types fully implemented
- ✅ Real-time event-driven updates (no manual refresh needed)
- ✅ sync:full properly initializes all displays on connection
- ✅ Displays work correctly in both networked and standalone modes

### Code Quality Improvements
- ✅ Consolidated monitoring logic in AdminModule (separation of concerns)
- ✅ Testable display functions (54 total tests)
- ✅ Clear event → display wiring
- ✅ Reduced App.js complexity (72 lines → 5 lines delegation)

### Contract Compliance
- ✅ 100% AsyncAPI event coverage for monitoring
- ✅ Documented gaps (video queue, session history)
- ✅ All available contract fields displayed

### Test Coverage
- Before: 37 tests (command construction only)
- After: 54 tests (37 commands + 17 monitoring displays)
- Coverage: Command sending + Display updates + Event handling

---

## Risks and Mitigations

### Risk 1: Breaking Existing Functionality
**Mitigation**: Keep App.updateAdminPanel() method signature, replace implementation with delegation. All existing code calling this method continues to work.

### Risk 2: Event Listener Memory Leaks
**Mitigation**: Store listener references, implement cleanup method called on disconnect. Follow OrchestratorClient pattern.

### Risk 3: Race Conditions (Multiple Events)
**Mitigation**: Each display method is idempotent - multiple calls safe. Test with rapid event bursts.

### Risk 4: DOM Elements Not Available
**Mitigation**: All display methods check for element existence before updating. Graceful degradation.

### Risk 5: AsyncAPI Contract Gaps
**Mitigation**: Document gaps, implement what's available, note future enhancements needed in backend.

---

## Success Criteria

1. ✅ All 54 tests passing (37 existing + 17 new)
2. ✅ All 5 FR 4.1 monitoring types displaying data
3. ✅ Event-driven updates working (no manual refresh)
4. ✅ sync:full initializes all displays correctly
5. ✅ No regressions in command construction functionality
6. ✅ Code consolidated in AdminModule per architecture
7. ✅ Contract gaps documented
8. ✅ BUG-LOG-ADMIN.md and TEST-IMPROVEMENT-PLAN.md updated

---

## References

- **Functional Requirements**: `/docs/api-alignment/08-functional-requirements.md` (Section 4.1, lines 789-880)
- **AsyncAPI Contract**: `/contracts/asyncapi.yaml` (lines 110-977)
- **Current Implementation**: `ALNScanner/js/app/app.js` (lines 390-461)
- **AdminModule**: `ALNScanner/js/utils/adminModule.js`
- **OrchestratorClient**: `ALNScanner/js/network/orchestratorClient.js` (lines 200-333)
- **Existing Tests**: `tests/unit/scanner/admin-module.test.js` (37 tests)
- **Bug Log**: `BUG-LOG-ADMIN.md` (8 bugs fixed in Phase 2.2)
- **Test Plan**: `TEST-IMPROVEMENT-PLAN.md` (Phase 2.2)
