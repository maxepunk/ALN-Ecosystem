# GM Scanner Module Structure Map

**File**: ALNScanner/index.html (6,428 lines)
**Created**: 2025-10-01 during Phase 6.2 investigation
**Purpose**: Complete module boundary map for investigation navigation

---

## File Structure Overview

```
index.html (6,428 lines total)
├── Lines 1-1737: HTML + CSS
└── Lines 1738-6428: JavaScript (<script> section)
    ├── Lines 1741-1751: CONFIG
    ├── Lines 1753-2061: AdminModule
    ├── Lines 2059-2132: Debug
    ├── Lines 2131-2285: NFCHandler
    ├── Lines 2284-2540: TokenManager
    ├── Lines 2539-3278: DataManager (CORE GAME LOGIC)
    ├── Lines 3277-3809: UIManager
    ├── Lines 3808-3861: Settings
    ├── Lines 3860-4781: App (main application coordinator)
    ├── Lines 4746-4881: SessionModeManager class
    ├── Lines 4880-5283: ConnectionManager class
    ├── Lines 5282-5409: StandaloneDataManager class
    ├── Lines 5408-5572: NetworkedQueueManager class
    └── Lines 5571-6428: OrchestratorClient class
```

---

## Module Details

### Lines 1744-1751: CONFIG (8 lines)
**Purpose**: Application constants
**Type**: Object literal
**Dependencies**: None
**Operational Mode**: [BOTH]

**Contents**:
- MAX_TEAM_ID_LENGTH: 6
- MAX_DEBUG_MESSAGES: 50
- ANIMATION_DURATION: 200
- MODE_TOGGLE_SCALE: 1.1
- SCAN_SIMULATION_DELAY: 1000
- NFC_PULSE_INTERVAL: 2000

---

### Lines 1757-2061: AdminModule (~304 lines)
**Purpose**: Admin panel functionality (integrated with GM Scanner)
**Type**: Object literal with nested classes
**Dependencies**: ConnectionManager (for auth token), fetch API
**Operational Mode**: [NETWORKED] (admin functions require orchestrator)

**Sub-modules**:
1. **SessionManager** (lines 1759-1855):
   - createSession()
   - pauseSession()
   - resumeSession()
   - endSession()
   - updateDisplay()

2. **VideoController** (lines 1877-1968):
   - playVideo()
   - pauseVideo()
   - stopVideo()
   - skipVideo()

3. **SystemMonitor** (lines 1970-2018):
   - updateConnectionStatus()
   - updateVLCStatus()
   - updateDeviceList()

4. **AdminOperations** (lines 2020-2061):
   - resetScores()
   - clearTransactions()

**HTTP Endpoints Used**:
- POST /api/session (create)
- PUT /api/session (pause/resume/end)
- POST /api/video/control (all video ops)
- POST /api/admin/reset-scores
- POST /api/admin/clear-transactions

**Note**: ALL these endpoints are ELIMINATED in Phase 4.9 (moved to WebSocket gm:command)

---

### Lines 2063-2132: Debug (~69 lines)
**Purpose**: Debug logging utilities
**Type**: Object literal
**Dependencies**: None
**Operational Mode**: [BOTH]

**Methods**:
- log(message, data)
- error(message, error)
- warn(message, data)
- clear()
- updateDisplay()

---

### Lines 2135-2285: NFCHandler (~150 lines)
**Purpose**: NFC hardware integration (Web NFC API)
**Type**: Object literal
**Dependencies**: Navigator.nfc (browser API)
**Operational Mode**: [BOTH] (hardware scanning works offline)

**Methods**:
- init()
- startScan()
- stopScan()
- handleNFCRead(event)
- simulateScan(tokenId) - for testing without NFC hardware

**Platform**: Android Chrome/Edge only (Web NFC API limitation)

---

### Lines 2288-2540: TokenManager (~252 lines)
**Purpose**: Token database loading and validation
**Type**: Object literal
**Dependencies**: fetch API, localStorage
**Operational Mode**: [BOTH] (loads tokens from backend OR local submodule)

**Methods**:
- loadTokens(forceFallback) - tries /api/tokens, then data/tokens.json, then demo data
- getTokenData(tokenId)
- validateToken(tokenId)
- getTokenDisplayInfo(tokenId)
- getGroupInfo(groupName)
- getAllGroups()
- getTokensByGroup(groupName)

**Token Loading Strategy** (lines 2327-2390):
1. Try orchestrator: GET /api/tokens (networked mode)
2. Fallback to local: data/tokens.json (standalone mode)
3. Fallback to demo data (development/testing)

---

### Lines 2543-3278: DataManager (~735 lines) ← **CORE GAME LOGIC**
**Purpose**: Transaction processing, scoring, duplicate detection, group bonuses
**Type**: Object literal
**Dependencies**: TokenManager, Settings
**Operational Mode**: [BOTH] (full game logic client-side for standalone mode)

**Critical Methods**:

**Transaction Management**:
- addTransaction(transaction) - lines 2656-2685 (NORMALIZATION HERE!)
- getRecentTransactions(limit)
- getTransactionsByTeam(teamId)
- exportTransactions(format)

**Scoring Algorithms**:
- calculateScores() - lines 2787-2924 (COMPLETE SCORING LOGIC)
- calculateTokenValue(token, mode) - lines 2706-2739
- calculateBlackMarketScore(transactions)
- calculateDetectiveScore(transactions)

**Duplicate Detection**:
- isDuplicate(tokenId, teamId) - lines 2696-2704 (LOCAL DUPLICATE CHECK)

**Group Bonuses**:
- calculateGroupBonuses(teamId, tokensScanned) - lines 3115-3186 (COMPLEX LOGIC)
- getCompletedGroups()
- getIncompleteGroups()

**Backend Sync** (Networked Mode Only):
- syncWithBackend(backendScores) - lines 2973-2990
- mergeBackendScore(teamId, backendScore)

**State**:
- this.transactions = [] - all transactions
- this.scores = new Map() - team scores
- this.backendScores = new Map() - scores from backend (networked mode)

**FINDING**: This is where client-side game logic lives. Must compare to backend algorithms.

---

### Lines 3281-3809: UIManager (~528 lines)
**Purpose**: DOM manipulation and UI rendering
**Type**: Object literal
**Dependencies**: DataManager, Settings, App
**Operational Mode**: [BOTH]

**Methods**:
- updateLeaderboard()
- updateTransactionLog()
- updateStats()
- showToast(message, type)
- showError(message)
- updateConnectionStatus(status)
- updateModeIndicator(mode)
- renderStandaloneScores()
- renderBackendScores()

**UI Components Managed**:
- Leaderboard display
- Transaction log
- Stats panel
- Toast notifications
- Connection status indicator
- Mode indicator (Networked vs Standalone)
- Debug panel

---

### Lines 3812-3861: Settings (~49 lines)
**Purpose**: User settings and preferences
**Type**: Object literal
**Dependencies**: localStorage
**Operational Mode**: [BOTH]

**Settings Stored**:
- stationId - scanner identifier
- stationMode - "detective" | "blackmarket"
- currentTeamId - selected team

**Methods**:
- load()
- save()
- get(key)
- set(key, value)

---

### Lines 3864-4781: App (~917 lines) ← **MAIN APPLICATION COORDINATOR**
**Purpose**: Application initialization, event coordination, view management
**Type**: Object literal
**Dependencies**: ALL other modules
**Operational Mode**: [BOTH]

**Key Responsibilities**:

**Initialization**:
- init() - lines 3889-4050 (app startup sequence)
- setupEventListeners()
- setupNFC()
- initializeConnection()

**View Management**:
- switchView(viewName) - lines 4046-4078
- updateView()
- showScanner()
- showLeaderboard()
- showAnalytics()
- showAdmin()
- showDebug()

**Transaction Processing**:
- processTransaction(tokenId) - lines 4478-4543 (main transaction handler)
- submitToBackend(transaction) - networked mode
- queueForLater(transaction) - offline mode
- handleTransactionResult(result)

**Session Management**:
- loadExistingSession() - lines 4080-4111
- handleSessionUpdate(session)

**Event Handlers**:
- handleScan(tokenId)
- handleModeChange(mode)
- handleTeamSelect(teamId)
- handleNetworkChange()

**FINDING**: App is the central coordinator. All modules flow through here.

---

### Lines 4783-4881: SessionModeManager class (~98 lines)
**Purpose**: Manage switching between Networked and Standalone modes
**Type**: ES6 Class
**Dependencies**: App, UIManager, ConnectionManager
**Operational Mode**: [BOTH] (manages mode transitions)

**Methods**:
- constructor()
- switchToNetworked()
- switchToStandalone()
- getCurrentMode()
- updateUI(mode)
- handleModeChange(mode)

**State**:
- this.currentMode - "networked" | "standalone"
- this.isTransitioning - boolean

**FINDING**: This is critical for understanding operational mode switching.

---

### Lines 4880-5283: ConnectionManager class (~403 lines)
**Purpose**: WebSocket + HTTP communication with orchestrator
**Type**: ES6 Class
**Dependencies**: Socket.io client, fetch API
**Operational Mode**: [NETWORKED] (only used when orchestrator available)

**WebSocket Events**:

**Outgoing** (client → server):
- gm:identify (auth with JWT)
- transaction:submit
- heartbeat
- sync:request
- gm:command (admin commands)

**Incoming** (server → client):
- gm:identified
- transaction:result
- transaction:new
- score:updated
- group:completed
- video:status
- session:update
- state:sync
- sync:full
- heartbeat:ack
- error

**HTTP Methods**:
- authenticate(password) - POST /api/admin/auth
- getSession() - GET /api/session
- submitTransaction(transaction) - via WebSocket (not HTTP)

**Connection Management**:
- connect()
- disconnect()
- reconnect()
- handleDisconnect()
- handleReconnect()
- checkHealth()

**FINDING**: All backend integration points here. Must check contract violations.

---

### Lines 5282-5409: StandaloneDataManager class (~127 lines)
**Purpose**: Standalone mode data persistence (LocalStorage/IndexedDB)
**Type**: ES6 Class
**Dependencies**: localStorage
**Operational Mode**: [STANDALONE] only

**Methods**:
- saveTransaction(transaction)
- loadTransactions()
- saveScores(scores)
- loadScores()
- clearData()
- exportData()

**Storage Keys**:
- standalone_transactions
- standalone_scores
- standalone_session

**FINDING**: This enables full offline operation.

---

### Lines 5408-5572: NetworkedQueueManager class (~164 lines)
**Purpose**: Offline queue when temporarily disconnected (networked mode)
**Type**: ES6 Class
**Dependencies**: localStorage, ConnectionManager
**Operational Mode**: [NETWORKED] (queues for sync when back online)

**Methods**:
- queueTransaction(transaction)
- processQueue()
- clearQueue()
- getQueueLength()
- onBackOnline()

**Storage Key**: offline_queue

**FINDING**: Different from StandaloneDataManager. This is for TEMPORARY offline in networked mode.

---

### Lines 5571-6428: OrchestratorClient class (~857 lines)
**Purpose**: High-level orchestrator API abstraction
**Type**: ES6 Class
**Dependencies**: ConnectionManager, fetch API
**Operational Mode**: [NETWORKED]

**API Methods**:
- getTokens() - GET /api/tokens
- getSession() - GET /api/session
- createSession(name) - POST /api/session
- pauseSession() - PUT /api/session
- resumeSession() - PUT /api/session
- endSession() - PUT /api/session
- submitTransaction(transaction) - via WebSocket
- getState() - GET /api/state
- controlVideo(action) - POST /api/video/control
- resetScores() - POST /api/admin/reset-scores
- clearTransactions() - POST /api/admin/clear-transactions

**Error Handling**:
- handleHTTPError(response)
- handleWebSocketError(error)
- retry logic
- fallback strategies

**FINDING**: More HTTP endpoints used. Many are ELIMINATED in Phase 4.9.

---

## Module Dependencies Graph

```
App (main coordinator)
  ├─→ Settings
  ├─→ Debug
  ├─→ NFCHandler
  ├─→ TokenManager
  ├─→ DataManager (CORE LOGIC)
  ├─→ UIManager
  ├─→ AdminModule
  ├─→ SessionModeManager
  ├─→ ConnectionManager
  │     ├─→ WebSocket events (16+)
  │     └─→ HTTP endpoints (11+)
  ├─→ StandaloneDataManager (standalone mode)
  ├─→ NetworkedQueueManager (networked mode offline queue)
  └─→ OrchestratorClient (networked mode API)

DataManager
  ├─→ TokenManager (token data)
  └─→ Settings (stationId, mode)

UIManager
  ├─→ DataManager (scores, transactions)
  └─→ Settings (display preferences)

AdminModule
  └─→ ConnectionManager (auth token)

SessionModeManager
  ├─→ App
  ├─→ UIManager
  └─→ ConnectionManager
```

---

## Operational Mode Code Paths

### [NETWORKED] Only:
- ConnectionManager (all methods)
- OrchestratorClient (all methods)
- NetworkedQueueManager (offline queue for temp disconnect)
- AdminModule (all admin functions)
- DataManager.syncWithBackend()
- App.submitToBackend()

### [STANDALONE] Only:
- StandaloneDataManager (all methods)
- DataManager local scoring (no backend sync)
- UIManager.renderStandaloneScores()

### [BOTH]:
- CONFIG
- Debug
- NFCHandler
- TokenManager (tries backend, falls back to local)
- DataManager (CORE LOGIC - works in both modes!)
- UIManager (adapts rendering based on mode)
- Settings
- App (main coordinator)
- SessionModeManager (manages transitions)

---

## Critical Observations

**1. Dual Operation Support is Complete**:
- Full game logic in DataManager works offline (standalone)
- NetworkedQueueManager handles temporary disconnects (networked)
- StandaloneDataManager handles permanent standalone operation
- SessionModeManager coordinates mode transitions

**2. Admin Panel is Integrated**:
- Not a separate app
- Uses same ConnectionManager
- Shares auth token
- Mixed with scanner in single file

**3. Single-File Architecture**:
- 6,428 lines total
- ~4,690 lines JavaScript
- ~1,738 lines HTML/CSS
- 14 major modules
- 5 ES6 classes
- Well-organized despite size

**4. Backend Integration Points** (MUST CHECK CONTRACTS):
- **11+ HTTP endpoints** used (many ELIMINATED in Phase 4.9)
- **16+ WebSocket events** used (must check wrapping)
- **Field naming**: Need to check scannerId vs deviceId
- **Error handling**: Need to check error display

**5. Client-Side Game Logic is Complete**:
- DataManager.calculateScores() is full algorithm (~137 lines)
- Duplicate detection fully implemented
- Group bonuses fully implemented
- Can operate 100% offline

---

**Structure Mapping Complete**: ✅
**Next**: Phase 2 - Contract Alignment Analysis (search for violations)

---
