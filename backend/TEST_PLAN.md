# ALN Architecture Fixes - Comprehensive Test Plan

## Test Environment Setup

### Prerequisites
1. **Start Backend Server**
   ```bash
   cd backend
   npm install
   npm run dev:full  # Starts orchestrator + VLC
   ```

2. **Access Applications**
   - **GM Scanner**: `http://localhost:3000/gm-scanner/`
   - **Player Scanner**: `http://localhost:3000/player-scanner/`
   - **API Docs**: `http://localhost:3000/api-docs`

3. **Browser Setup**
   - Open DevTools Console (F12)
   - Open Network tab
   - Open Application > Local Storage

---

## Phase 4: Integration Testing

### Test 4.1: Standalone Mode Verification

**Purpose**: Verify standalone mode operates completely independently without network attempts

**Setup**:
1. Open `http://localhost:3000/gm-scanner/` in an incognito/private window
2. Open DevTools before proceeding
3. Clear all site data: Application > Storage > Clear site data

**Test Steps**:
1. **Game Mode Selection**
   - [ ] Game mode selection screen appears immediately
   - [ ] Choose "Standalone Game" button
   - [ ] Verify: NO connection wizard appears
   - [ ] Verify: Proceeds directly to team entry screen

2. **Team Entry & Scanning**
   - [ ] Enter team ID using numpad: `001`
   - [ ] Click "Enter" button
   - [ ] Scan screen appears showing "Team 001 Ready"
   - [ ] Click "Manual Entry (Debug)" button
   - [ ] Enter token ID in prompt: `534e2b03`
   - [ ] Result screen shows transaction complete

3. **Verification Points**
   - [ ] Network Tab: NO requests to `/api/*` endpoints
   - [ ] Network Tab: NO WebSocket connections
   - [ ] Console: Shows "Transaction stored locally (standalone mode)"
   - [ ] LocalStorage: `standaloneSession` key exists
   - [ ] LocalStorage Data: Contains transaction with tokenId `534e2b03`

4. **Session Management**
   - [ ] Return to scan screen (Continue button)
   - [ ] Submit 3 more tokens via manual entry:
     - `51a1af24`
     - `72007dbe`
     - `74cd227e`
   - [ ] LocalStorage: Verify all 4 transactions present
   - [ ] Session data includes `sessionId` starting with `LOCAL_`

**Expected Results**:
- ✅ Zero network requests to backend API
- ✅ All data persisted in `standaloneSession` localStorage key
- ✅ Session ID format: `LOCAL_[timestamp]_[random]`
- ✅ Console shows no connection attempts

---

### Test 4.2: Networked Mode with Disconnection Handling

**Purpose**: Verify queue persistence during network disconnection

**Setup**:
1. New incognito window at `http://localhost:3000/gm-scanner/`
2. Clear all site data
3. Ensure backend is running (`npm run dev:full`)

**Test Steps**:
1. **Initial Connection**
   - [ ] Choose "Networked Game" button
   - [ ] Connection wizard appears
   - [ ] Auto-detects URL: `http://localhost:3000`
   - [ ] Click "Connect to http://localhost:3000"
   - [ ] Authenticate: username `admin`, password `admin`
   - [ ] Green "Connected" status appears
   - [ ] Team entry screen appears

2. **Connected Transactions**
   - [ ] Enter team: `002`
   - [ ] Manual entry: `534e2b03`
   - [ ] Console: "Transaction queued for orchestrator: [txId]"
   - [ ] Backend logs show: "Transaction submitted via WebSocket with ACK"
   - [ ] Submit 2 more tokens while connected

3. **Simulate Disconnection**
   - [ ] In backend terminal: Press Ctrl+C to stop server
   - [ ] Console shows disconnect event
   - [ ] Submit token while disconnected: `51a1af24`
   - [ ] Console: "Transaction queued for later submission"
   - [ ] Submit another: `72007dbe`
   - [ ] LocalStorage: `networkedTempQueue` contains 2 transactions

4. **Reconnection & Sync**
   - [ ] Restart backend: `npm run dev:full`
   - [ ] Wait ~5 seconds for auto-reconnection
   - [ ] Console: "Reconnected - syncing queued transactions..."
   - [ ] Backend logs: Both queued transactions arrive with ACKs
   - [ ] LocalStorage: `networkedTempQueue` is empty/removed
   - [ ] Console: "Queue sync complete, all transactions processed"

**Expected Results**:
- ✅ Transactions queue during disconnection
- ✅ Queue persists in `networkedTempQueue` localStorage
- ✅ Automatic sync on reconnection
- ✅ Queue cleared only after server ACK confirmation

---

### Test 4.3: Admin Interface Integration

**Purpose**: Verify unified admin interface with single WebSocket connection

**Setup**:
1. Continue from Test 4.2 (networked mode, connected)
2. Or fresh start: `http://localhost:3000/gm-scanner/` → Networked mode

**Test Steps**:
1. **Tab Navigation**
   - [ ] Three tabs visible: Scanner, Admin, Debug
   - [ ] Click "Admin" tab
   - [ ] Admin interface loads with sections:
     - Session Management
     - Video Controls
     - System Status
     - Team Scores
     - Recent Transactions

2. **Session Management**
   - [ ] Click "New Session" button
   - [ ] Enter name: "Test Session 1"
   - [ ] Session created, ID appears
   - [ ] Status shows "active"

3. **Cross-Tab Integration**
   - [ ] Switch to "Scanner" tab
   - [ ] Submit token via manual entry
   - [ ] Switch to "Admin" tab
   - [ ] Recent Transactions shows new entry
   - [ ] Team scores updated

4. **WebSocket Verification**
   - [ ] Network Tab → WS filter
   - [ ] Exactly ONE WebSocket connection to `/socket.io/`
   - [ ] Click on WebSocket → Messages tab
   - [ ] Messages include:
     - `transaction:submit`
     - `state:update`
     - `heartbeat`
   - [ ] NO duplicate connections when switching tabs

5. **Video Control** (if VLC running)
   - [ ] Video Controls section shows queue
   - [ ] Play/Pause/Stop buttons functional
   - [ ] Queue updates when scanning video tokens

**Expected Results**:
- ✅ Single WebSocket shared across all tabs
- ✅ Real-time updates without page refresh
- ✅ No connection drops when switching tabs
- ✅ Admin functions work without separate auth

---

### Test 4.4: Session Persistence & Score Reset

**Purpose**: Verify no score carryover between sessions (Phase 1 bug fix)

**Setup**:
1. `http://localhost:3000/gm-scanner/` in Networked mode
2. Connected and authenticated

**Test Steps**:
1. **First Session**
   - [ ] Admin tab → Create session "Game 1"
   - [ ] Scanner tab → Team A (001): Submit 3 tokens
   - [ ] Scanner tab → Team B (002): Submit 2 tokens
   - [ ] Admin tab → Note scores:
     - Team A: _______ points
     - Team B: _______ points
   - [ ] Click "End Session" button
   - [ ] Confirm end session

2. **Second Session - Clean Slate Test**
   - [ ] Create new session "Game 2"
   - [ ] Admin tab shows all scores at 0
   - [ ] Scanner tab → Team A: Submit 1 token
   - [ ] Admin tab → Team A score = ONLY new token value
   - [ ] Verify: NO carryover from Game 1 scores

3. **Backend Restart Test**
   - [ ] Note current Game 2 scores
   - [ ] Stop backend: Ctrl+C
   - [ ] Restart: `npm run dev:full`
   - [ ] Refresh browser
   - [ ] Reconnect in Networked mode
   - [ ] Admin tab: Scores still show Game 2 values only
   - [ ] No accumulation from Game 1

**Expected Results**:
- ✅ Each session starts with zero scores
- ✅ Session boundaries strictly enforced
- ✅ Persistence file correctly isolates sessions
- ✅ No score rebuilding from old transactions

---

## Quick Debug Commands

### Check System State
```javascript
// Run in browser console
console.table({
  'Session Mode': window.sessionModeManager?.mode,
  'Connected': window.connectionManager?.client?.isConnected,
  'Queue Status': window.queueManager?.getStatus(),
  'Current Team': App.currentTeamId,
  'Station Mode': Settings.stationMode
});
```

### Inspect Queues
```javascript
// Network queue
console.log('Network Queue:', localStorage.getItem('networkedTempQueue'));

// Standalone session
console.log('Standalone:', localStorage.getItem('standaloneSession'));

// All transactions
console.log('All Transactions:', DataManager.transactions);
```

### Force Operations
```javascript
// Force queue sync
window.queueManager?.syncQueue();

// Export standalone session
window.dataManager?.exportSession();

// Switch views
App.switchView('admin');
App.switchView('scanner');
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Can't access scanner | Wrong URL | Use `http://localhost:3000/gm-scanner/` |
| "NetworkedQueueManager not initialized" | Mode not selected | Refresh and select mode first |
| Queue not syncing | No reconnection | Check backend is running |
| Admin panel blank | Not in networked mode | Admin only works in networked mode |
| Duplicate transactions | Stale localStorage | Clear site data and restart |
| Wrong orchestrator URL | Auto-detect failed | Manually enter `http://localhost:3000` |

---

## Verification Checklist

### Phase 0 - Architectural Clarification ✅
- [x] SessionModeManager created
- [x] preferOffline removed (0 references)
- [x] StandaloneDataManager implemented
- [x] Clear mode selection screen

### Phase 1 - Bug Fixes ✅
- [x] Duplicate transaction fix (line 126)
- [x] Session state reset on new session

### Phase 2 - Interface Unification ✅
- [x] Admin integrated into scanner
- [x] Single WebSocket connection
- [x] Admin panel removed from backend
- [x] Service worker for PWA

### Phase 3 - Queue Management ✅
- [x] NetworkedQueueManager with ACK
- [x] Fix OrchestratorClient splice bug
- [x] Backend sends transaction:ack
- [x] Queue only cleared after ACK

---

## Test Execution Log

| Date | Tester | Test | Result | Notes |
|------|--------|------|--------|-------|
| | | 4.1 Standalone | ⏳ | |
| | | 4.2 Network Queue | ⏳ | |
| | | 4.3 Admin Tabs | ⏳ | |
| | | 4.4 Session Reset | ⏳ | |

---

*Test Plan Version: 2.0*
*Updated: 2025-09-28*
*Deployment: Orchestrator-served at `/gm-scanner/`*